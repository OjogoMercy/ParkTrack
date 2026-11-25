/**
 * Owned by Scope 04 (docs/scopes/04-payments-ledger.md). Exported names and
 * types are FINAL; callers never change. Being replaced slice by slice:
 * startPayment, handleCallback, requery, paymentStatus and
 * applyVerifiedPayment are real (sl2), handleWebhook (sl4); refund (sl9)
 * still returns fixture data. STUB stays true until every function is real.
 *
 * The one rule: a payment counts only after OUR server asks Interswitch and
 * gets ResponseCode "00" with the exact kobo amount and our reference
 * (./interswitch.ts classifyRequery). Redirect values are never trusted.
 */
import "server-only";
import type { PaymentStatusView } from "@/contracts/dto";
import type { PaymentPurpose } from "@/contracts/enums";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { serverEnv } from "@/lib/env";
import { txnRef as newTxnRef } from "@/lib/ids";
import { stub } from "@/mocks/stub";
import { siteUrl } from "@/server/notify/links";
import {
  issueCollectionCode,
  ParcelError,
  storageDues,
  transition,
} from "@/server/parcels";
import { PaymentError } from "./errors";
import { SIGNATURE_HEADER, parseWebhook, verifySignature } from "./webhook";
import {
  checkoutForm,
  CHECKOUT_TTL_MINUTES,
  classifyRequery,
  iswConfig,
  requeryTransaction,
  type Verdict,
} from "./interswitch";
import {
  itemName,
  payableAmount,
  payerProblem,
  type PayablePurpose,
  type Payer,
  GIVE_UP_HOURS,
  nextCheckAt,
} from "./rules";

export const STUB = true;

export { PaymentError } from "./errors";
export type { Payer } from "./rules";

export type CheckoutStart = {
  paymentId: string;
  txnRef: string;
  amountKobo: number;
  checkout: { url: string; fields: Record<string, string> };
};

/**
 * Interswitch requires a customer email; ParkTrack accounts are phone-only,
 * so checkouts carry this address (receipts are sent by WhatsApp/SMS).
 */
const CHECKOUT_EMAIL = "noreply@parktrack.ng";
/** First background re-check of a pending payment (sl5 runs them). */
const FIRST_RECHECK_MINUTES = 10;
/** Re-check interval right after a payment changes (and for a replaced checkout). */
const RECHECK_MINUTES = 5;

const minutes = (n: number) => n * 60 * 1000;

/**
 * Creates the payment (amount computed here, never from the browser) and
 * the Web Checkout form for it (PAY-1). If the same parcel and purpose
 * already has an open checkout for the same amount (under 30 minutes old),
 * that one is reused, so two tabs can't pay twice; older open ones are
 * closed. Throws PaymentError: parcel_not_found 404, payer_not_allowed 403,
 * payment_not_allowed 409, payments_unavailable 503.
 */
export async function startPayment(
  parcelId: string,
  purpose: Exclude<PaymentPurpose, "REFUND" | "INSURANCE">,
  payer: Payer,
): Promise<CheckoutStart> {
  const env = serverEnv();
  let config;
  try {
    config = iswConfig(env);
  } catch (e) {
    console.error("[payments] Interswitch config", e);
    throw new PaymentError(
      "payments_unavailable",
      "Payments aren't available right now. Try again later.",
      503,
    );
  }
  // Storage owed is computed by the parcel engine (Scope 03), outside the lock.
  const storageOwed =
    purpose === "STORAGE"
      ? (await storageDues(parcelId).catch(() => ({ storageKobo: 0 })))
          .storageKobo
      : 0;
  const now = new Date();

  const result = await db.$transaction(async (tx) => {
    // One payment start per parcel at a time.
    await tx.$queryRaw`SELECT id FROM parcels WHERE id = ${parcelId} FOR UPDATE`;
    const parcel = await tx.parcel.findUnique({
      where: { id: parcelId },
      include: {
        sender: { select: { name: true, phone: true } },
      },
    });
    if (!parcel) {
      throw new PaymentError("parcel_not_found", "Parcel not found.", 404);
    }
    const who = payerProblem(purpose, payer, parcel);
    if (who) throw new PaymentError("payer_not_allowed", who, 403);
    const payable = payableAmount(purpose, parcel, storageOwed, now);
    if ("problem" in payable) {
      throw new PaymentError("payment_not_allowed", payable.problem, 409);
    }

    const open = await tx.payment.findFirst({
      where: {
        parcelId,
        purpose,
        status: "PENDING",
        createdAt: {
          gt: new Date(now.getTime() - minutes(CHECKOUT_TTL_MINUTES)),
        },
      },
      orderBy: { createdAt: "desc" },
    });
    if (open && open.amountKobo === payable.amountKobo) {
      return { payment: open, parcel };
    }
    // Close older open checkouts for this parcel and purpose. Their
    // Interswitch page stays payable for 30 minutes, so they keep being
    // checked; a late payment on one is caught and flagged for a refund.
    await tx.payment.updateMany({
      where: { parcelId, purpose, status: "PENDING" },
      data: {
        status: "FAILED",
        nextRequeryAt: new Date(now.getTime() + minutes(RECHECK_MINUTES)),
        rawResponse: {
          reason: REPLACED_REASON,
          replaced: true,
          final: false,
        },
      },
    });
    const payment = await tx.payment.create({
      data: {
        parcelId,
        purpose,
        amountKobo: payable.amountKobo,
        txnRef: newTxnRef(),
        status: "PENDING",
        payerPhone:
          payer.kind === "user" ? (parcel.sender?.phone ?? null) : null,
        checkoutUrl: config.checkoutUrl,
        nextRequeryAt: new Date(now.getTime() + minutes(FIRST_RECHECK_MINUTES)),
      },
    });
    return { payment, parcel };
  });

  const { payment, parcel } = result;
  const form = checkoutForm(config, {
    txnRef: payment.txnRef,
    amountKobo: payment.amountKobo,
    redirectUrl: siteUrl(env.ROOT_DOMAIN, null, "/api/payments/callback"),
    customer: {
      id: parcel.senderId ?? `parcel-${parcel.id}`,
      name: parcel.sender?.name ?? null,
      email: CHECKOUT_EMAIL,
    },
    itemName: itemName(purpose, parcel.parcelCode),
  });
  return {
    paymentId: payment.id,
    txnRef: payment.txnRef,
    amountKobo: payment.amountKobo,
    checkout: form,
  };
}

/**
 * Redirect handler (PAY-2): only the reference is read from the redirect;
 * resp/amount are ignored. Asks Interswitch, records the verdict, applies
 * a verified payment, and returns where things stand.
 */
export async function handleCallback(
  query: URLSearchParams,
): Promise<{ txnRef: string; status: PaymentStatusView["status"] }> {
  const ref = query.get("txnref") ?? query.get("txnRef") ?? "";
  const view = await requery(ref);
  return { txnRef: view.txnRef, status: view.status };
}

/**
 * Interswitch webhook (PAY-3). Checks the X-Interswitch-Signature
 * (HMAC-SHA512 of the raw body), stores the event once in webhook_events
 * (a replay of a processed event returns duplicate: true and does nothing),
 * then asks Interswitch about the payment itself: the webhook's own
 * responseCode and amount are never trusted. Events for references that
 * aren't ours are stored and ignored. Throws PaymentError: bad_signature
 * 401, bad_webhook 400, payments_unavailable 503 (no ISW_WEBHOOK_SECRET).
 * Any other error leaves the event unprocessed so Interswitch's retry (or
 * the next one) picks it up.
 */
export async function handleWebhook(
  rawBody: string,
  headers: Headers,
): Promise<{ processed: boolean; duplicate: boolean }> {
  const secret = serverEnv().ISW_WEBHOOK_SECRET;
  if (!secret) {
    console.error(
      "[payments] webhook received but ISW_WEBHOOK_SECRET is not set",
    );
    throw new PaymentError(
      "payments_unavailable",
      "Webhooks aren't set up.",
      503,
    );
  }
  if (!verifySignature(rawBody, headers.get(SIGNATURE_HEADER), secret)) {
    throw new PaymentError("bad_signature", "Signature doesn't match.", 401);
  }
  const event = parseWebhook(rawBody);
  if (!event) {
    throw new PaymentError("bad_webhook", "Not an Interswitch event.", 400);
  }

  // Store once (unique provider_ref).
  let stored;
  try {
    stored = await db.webhookEvent.create({
      data: {
        providerRef: event.providerRef,
        payload: JSON.parse(rawBody) as Prisma.InputJsonValue,
      },
    });
  } catch (e) {
    if ((e as { code?: unknown }).code !== "P2002") throw e;
    stored = await db.webhookEvent.findUniqueOrThrow({
      where: { providerRef: event.providerRef },
    });
    if (stored.processedAt) {
      console.info(`[payments] webhook duplicate ignored ${event.providerRef}`);
      return { processed: true, duplicate: true };
    }
    // Stored before but not processed (an earlier attempt failed): retry.
  }

  if (event.event.startsWith("TRANSACTION.") && event.txnRef) {
    const payment = await db.payment.findUnique({
      where: { txnRef: event.txnRef },
      select: { id: true },
    });
    if (payment) {
      // Late results arrive here: re-ask even about a payment we had
      // settled as failed, so money that did move is caught.
      const { unreachable } = await checkPayment(event.txnRef, {
        reopenSettled: true,
      });
      if (unreachable) {
        // Leave the event unprocessed; a non-200 makes Interswitch retry.
        throw new PaymentError(
          "payments_unavailable",
          "Couldn't reach Interswitch to check this payment.",
          503,
        );
      }
    } else {
      console.info(
        `[payments] webhook for an unknown reference ${event.txnRef}`,
      );
    }
  }
  await db.webhookEvent.update({
    where: { id: stored.id },
    data: { processedAt: new Date() },
  });
  return { processed: true, duplicate: false };
}

/**
 * Asks Interswitch about a payment and records the answer. VERIFIED only on
 * "00" + exact amount + our reference; never downgrades a verified payment.
 * A verified payment is then applied (idempotent). Throws PaymentError
 * payment_not_found (404).
 */
export async function requery(txnRef: string): Promise<PaymentStatusView> {
  return (await checkPayment(txnRef, { reopenSettled: false })).view;
}

export type RecheckResult = {
  due: number;
  checked: number;
  verified: number;
  failed: number;
  pending: number;
  errors: number;
};

/** How long a job run holds a payment it is checking. */
const LEASE_MINUTES = 2;

/**
 * Background re-check (POST /api/jobs/requery, QStash every few minutes;
 * PRD §6.5): asks Interswitch about each payment whose re-check time has
 * passed, so a payment whose redirect was closed still gets verified and
 * applied. Also finishes applying a verified payment whose apply failed.
 * Back-off and the 24-hour stop come from nextCheckAt(). Safe to run
 * repeatedly and in parallel: each payment is claimed (its re-check time
 * pushed forward) before Interswitch is asked.
 */
export async function recheckDuePayments(
  now: Date = new Date(),
  {
    limit = 20,
    concurrency = 4,
  }: { limit?: number; concurrency?: number } = {},
): Promise<RecheckResult> {
  const due = await db.payment.findMany({
    where: { nextRequeryAt: { lte: now } },
    orderBy: { nextRequeryAt: "asc" },
    take: limit,
    select: { id: true, txnRef: true, nextRequeryAt: true },
  });
  const result: RecheckResult = {
    due: due.length,
    checked: 0,
    verified: 0,
    failed: 0,
    pending: 0,
    errors: 0,
  };
  const queue = [...due];
  const worker = async () => {
    for (let p = queue.shift(); p; p = queue.shift()) {
      const lease = new Date(Date.now() + minutes(LEASE_MINUTES));
      const { count } = await db.payment.updateMany({
        where: { id: p.id, nextRequeryAt: p.nextRequeryAt },
        data: { nextRequeryAt: lease },
      });
      if (count !== 1) continue; // another run took it
      try {
        const { view } = await checkPayment(p.txnRef, {
          reopenSettled: false,
        });
        result.checked++;
        if (view.status === "VERIFIED") result.verified++;
        else if (view.status === "FAILED") result.failed++;
        else result.pending++;
        // Nothing rescheduled it (e.g. already settled): stop picking it up.
        await db.payment.updateMany({
          where: { id: p.id, nextRequeryAt: lease },
          data: { nextRequeryAt: null },
        });
      } catch (e) {
        // The lease runs out and a later run tries again.
        result.errors++;
        console.error(`[payments] re-check ${p.txnRef}`, e);
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, due.length) }, worker),
  );
  if (result.due) console.info("[payments] re-check", result);
  return result;
}

/**
 * requery(), and for webhooks also a payment already settled as failed.
 * A settled failure only changes on a real answer (verified, or a 00 that
 * needs review), never back to pending on a timeout.
 */
async function checkPayment(
  txnRef: string,
  { reopenSettled }: { reopenSettled: boolean },
): Promise<{ view: PaymentStatusView; unreachable: boolean }> {
  let unreachable = false;
  const payment = await db.payment.findUnique({ where: { txnRef } });
  if (!payment) {
    throw new PaymentError("payment_not_found", "Payment not found.", 404);
  }
  const settledFailure =
    payment.status === "FAILED" &&
    (payment.rawResponse as { final?: boolean } | null)?.final === true;
  if (payment.status !== "VERIFIED" && (!settledFailure || reopenSettled)) {
    const config = iswConfig(serverEnv());
    let answer;
    try {
      answer = await requeryTransaction(config, txnRef, payment.amountKobo);
    } catch (e) {
      answer = { error: e instanceof Error ? e.message : String(e) };
      unreachable = true;
    }
    const verdict = classifyRequery(answer, {
      txnRef,
      amountKobo: payment.amountKobo,
      startedAt: payment.createdAt,
    });
    const replaced =
      (payment.rawResponse as { replaced?: boolean } | null)?.replaced === true;
    const realAnswer =
      verdict.status === "VERIFIED" ||
      (verdict.status === "FAILED" && verdict.needsReview === true);
    if (!settledFailure || realAnswer) {
      await recordVerdict(payment.id, verdict, answer, {
        replaced,
        startedAt: payment.createdAt,
      });
    }
  }
  const latest = await db.payment.findUniqueOrThrow({ where: { txnRef } });
  if (latest.status === "VERIFIED") {
    await applyVerifiedPayment(latest.id);
    // Applied (or flagged for a refund): nothing left for the job to do.
    if (latest.nextRequeryAt) {
      await db.payment.update({
        where: { id: latest.id },
        data: { nextRequeryAt: null },
      });
    }
  }
  return { view: (await paymentStatus(txnRef))!, unreachable };
}

async function recordVerdict(
  paymentId: string,
  verdict: Verdict,
  answer: unknown,
  { replaced, startedAt }: { replaced: boolean; startedAt: Date },
): Promise<void> {
  const now = new Date();
  const raw = {
    answer,
    // A replaced checkout keeps its reason (and stays FAILED) unless it
    // turns out to be paid.
    reason: replaced
      ? REPLACED_REASON
      : "reason" in verdict
        ? verdict.reason
        : null,
    ...(replaced ? { replaced: true } : {}),
  };
  if (verdict.status === "VERIFIED") {
    // Claim: only a payment that isn't verified yet becomes verified.
    await db.payment.updateMany({
      where: { id: paymentId, status: { not: "VERIFIED" } },
      data: {
        status: "VERIFIED",
        responseCode: "00",
        verifiedAt: now,
        // Cleared once applied; if applying fails, the job tries again.
        nextRequeryAt: new Date(now.getTime() + minutes(RECHECK_MINUTES)),
        rawResponse: raw as Prisma.InputJsonValue,
        requeryCount: { increment: 1 },
      },
    });
    return;
  }
  const keepChecking =
    verdict.status === "PENDING" ||
    (verdict.status === "FAILED" && !verdict.final);
  const next = keepChecking ? nextCheckAt(startedAt, now) : null;
  // Still unanswered a day later (Interswitch unreachable): stop checking.
  const gaveUp = keepChecking && next === null;
  const review =
    (verdict.status === "FAILED" && verdict.needsReview === true) ||
    (gaveUp && !replaced);
  const detail = gaveUp
    ? `Still unconfirmed ${GIVE_UP_HOURS} hours after checkout (last: ${verdict.reason ?? verdict.responseCode ?? "no answer"})`
    : "reason" in verdict
      ? verdict.reason
      : null;
  if (review) {
    // Money may have moved, but not what we charged (or not our reference,
    // or we never got an answer): never applied; staff must check it (P07
    // payments monitor, Scope 09).
    console.warn(`[payments] NEEDS REVIEW ${paymentId}: ${detail}`);
  }
  await db.payment.updateMany({
    where: { id: paymentId, status: { not: "VERIFIED" } },
    data: {
      // Never reopen a replaced checkout as pending.
      status: replaced || gaveUp ? "FAILED" : verdict.status,
      responseCode: verdict.responseCode,
      nextRequeryAt: next,
      rawResponse: {
        ...raw,
        // The payer sees a plain message; the detail stays on the server.
        ...(review
          ? {
              reason: REVIEW_MESSAGE,
              detail,
              needsReview: true,
            }
          : {}),
        // A replaced checkout settles once Interswitch's 30 minutes are up.
        final: gaveUp
          ? true
          : verdict.status === "FAILED"
            ? verdict.final
            : replaced
              ? !keepChecking
              : false,
      } as Prisma.InputJsonValue,
      requeryCount: { increment: 1 },
    },
  });
}

const REPLACED_REASON = "Replaced by a newer checkout";

/** What the payer sees when a payment needs a person to check it. */
const REVIEW_MESSAGE =
  "We couldn't confirm this payment. Our team will check it and contact you; don't pay again";

/** What the payer sees for a payment (S05/S06), without asking Interswitch. */
export async function paymentStatus(
  txnRef: string,
): Promise<PaymentStatusView | null> {
  const payment = await db.payment.findUnique({
    where: { txnRef },
    include: {
      parcel: {
        select: { parcelCode: true, originPark: { select: { slug: true } } },
      },
    },
  });
  if (!payment) return null;
  const raw = (payment.rawResponse ?? {}) as {
    reason?: string | null;
    needsReview?: boolean;
    replaced?: boolean;
  };
  const root = serverEnv().ROOT_DOMAIN;
  const returnTo =
    payment.purpose === "SHIPPING" || payment.purpose === "TOP_UP"
      ? siteUrl(
          root,
          payment.parcel.originPark.slug,
          `/parcels/booked/${payment.parcel.parcelCode}`,
        )
      : siteUrl(root, null, "/");
  return {
    txnRef: payment.txnRef,
    purpose: payment.purpose,
    amountKobo: payment.amountKobo,
    status: payment.status,
    responseCode: payment.responseCode,
    reason:
      payment.status === "FAILED" && raw.reason
        ? // Interswitch's reason with its code, e.g. "Insufficient Funds
          // (51)" (S06). Not "(00)" on a payment held for review.
          payment.responseCode &&
          payment.responseCode !== "00" &&
          !raw.needsReview &&
          !raw.replaced &&
          /^[0-9A-Z]{2,3}$/.test(payment.responseCode)
          ? `${raw.reason} (${payment.responseCode})`
          : raw.reason
        : null,
    parcelCode: payment.parcel.parcelCode,
    returnTo,
  };
}

/**
 * Applies a verified payment exactly once (PAY-4). Each purpose checks its
 * own effect, so calling it again (callback, webhook, job) changes nothing:
 *   SHIPPING  DRAFT → AWAITING_DROPOFF (sets the drop-off deadline and sends
 *             booking_paid).
 *   TOP_UP    clears the size top-up.
 *   POD       marks pay-on-delivery paid; roadside parcels get their
 *             handover code (R02).
 *   STORAGE   storage paid up to when the checkout started.
 * Money that arrives but can't be applied (the booking was cancelled or
 * closed, another checkout already paid it, or what's owed changed) is
 * never kept silently: the payment is flagged for a refund (sl9).
 * Ledger entries are added in sl7.
 */
export async function applyVerifiedPayment(
  paymentId: string,
): Promise<{ applied: boolean }> {
  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    include: {
      parcel: {
        select: {
          id: true,
          status: true,
          deliveryMode: true,
          topUpRequiredKobo: true,
          totalKobo: true,
        },
      },
    },
  });
  if (!payment || payment.status !== "VERIFIED") return { applied: false };
  const applied = await applyOnce(payment);
  if (!applied) {
    const refundReason = await notAppliedReason(payment.id);
    if (refundReason) await flagRefund(payment.id, refundReason);
  }
  return { applied };
}

type VerifiedPayment = Prisma.PaymentGetPayload<{
  include: {
    parcel: {
      select: {
        id: true;
        status: true;
        deliveryMode: true;
        topUpRequiredKobo: true;
        totalKobo: true;
      };
    };
  };
}>;

async function applyOnce(payment: VerifiedPayment): Promise<boolean> {
  const parcel = payment.parcel;
  switch (payment.purpose as PayablePurpose) {
    case "SHIPPING": {
      if (parcel.status !== "DRAFT") return false;
      // A checkout started before the total changed doesn't pay for it.
      if (payment.amountKobo !== parcel.totalKobo) return false;
      try {
        // The PAID event carries the payment id: that's the "applied" mark.
        await transition(
          parcel.id,
          "AWAITING_DROPOFF",
          { actor: "SYSTEM" },
          {
            eventType: "PAID",
            meta: { txnRef: payment.txnRef, paymentId: payment.id },
          },
        );
        return true;
      } catch (e) {
        // Someone else applied it first, or it was cancelled meanwhile.
        if (e instanceof ParcelError) return false;
        throw e;
      }
    }
    case "TOP_UP":
      return markApplied(payment.id, (tx) =>
        tx.parcel.updateMany({
          where: { id: parcel.id, topUpRequiredKobo: payment.amountKobo },
          data: { topUpRequiredKobo: 0 },
        }),
      );
    case "POD": {
      const applied = await markApplied(payment.id, (tx) =>
        tx.parcel.updateMany({
          where: { id: parcel.id, podPaidAt: null },
          data: { podPaidAt: payment.verifiedAt ?? new Date() },
        }),
      );
      if (
        applied &&
        parcel.deliveryMode === "ROADSIDE" &&
        (parcel.status === "ASSIGNED" || parcel.status === "IN_TRANSIT")
      ) {
        await issueCollectionCode(parcel.id, "ROADSIDE").catch((e: unknown) =>
          console.error("[payments] roadside code after POD", e),
        );
      }
      return applied;
    }
    case "STORAGE":
      return markApplied(payment.id, (tx) =>
        tx.parcel.updateMany({
          where: {
            id: parcel.id,
            OR: [
              { storagePaidUntil: null },
              { storagePaidUntil: { lt: payment.createdAt } },
            ],
          },
          data: { storagePaidUntil: payment.createdAt },
        }),
      );
  }
}

/**
 * Runs the parcel update and marks the payment applied in one transaction,
 * so a replay (count 0) can tell "already applied by me" from a duplicate.
 */
async function markApplied(
  paymentId: string,
  update: (tx: Prisma.TransactionClient) => Promise<{ count: number }>,
): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const { count } = await update(tx);
    if (count !== 1) return false;
    const p = await tx.payment.findUniqueOrThrow({
      where: { id: paymentId },
      select: { rawResponse: true },
    });
    await tx.payment.update({
      where: { id: paymentId },
      data: {
        rawResponse: {
          ...((p.rawResponse ?? {}) as Record<string, unknown>),
          applied: true,
        } as Prisma.InputJsonValue,
      },
    });
    return true;
  });
}

/**
 * Why a verified payment that wasn't applied now needs a refund, or null
 * when it was applied earlier (a replay).
 */
async function notAppliedReason(paymentId: string): Promise<string | null> {
  const payment = await db.payment.findUniqueOrThrow({
    where: { id: paymentId },
    include: {
      parcel: { select: { id: true, status: true, totalKobo: true } },
    },
  });
  if ((payment.rawResponse as { applied?: boolean } | null)?.applied) {
    return null;
  }
  switch (payment.purpose as PayablePurpose) {
    case "SHIPPING": {
      const paid = await db.parcelEvent.findFirst({
        where: { parcelId: payment.parcelId, type: "PAID" },
        orderBy: { createdAt: "asc" },
        select: { meta: true },
      });
      const paidBy = (paid?.meta as { paymentId?: string } | null)?.paymentId;
      if (paidBy === payment.id) return null;
      if (paidBy) return "Booking already paid by another checkout";
      if (payment.parcel.status === "CANCELLED") {
        return "Paid after the booking was cancelled";
      }
      if (payment.parcel.status === "DRAFT") {
        return payment.amountKobo !== payment.parcel.totalKobo
          ? "Booking total changed after this checkout started"
          : null; // not settled yet
      }
      return "Paid after the booking closed";
    }
    case "TOP_UP":
      return "Top-up already paid, or changed after this checkout started";
    case "POD":
      return "Pay-on-delivery already paid by another checkout";
    case "STORAGE":
      return "Storage already paid by a later checkout";
  }
}

async function flagRefund(paymentId: string, reason: string): Promise<void> {
  const payment = await db.payment.findUnique({ where: { id: paymentId } });
  const raw = (payment?.rawResponse ?? {}) as Record<string, unknown>;
  if (raw.needsRefund) return;
  await db.payment.update({
    where: { id: paymentId },
    data: {
      rawResponse: {
        ...raw,
        needsRefund: true,
        refundReason: reason,
      } as Prisma.InputJsonValue,
    },
  });
  console.warn(`[payments] ${payment?.txnRef} needs a refund (sl9): ${reason}`);
}

/** Refund for expiry, cancellation or refusal (PAY-6). STUB until sl9. */
export async function refund(
  parcelId: string,
  reason: string,
): Promise<{ started: boolean }> {
  void parcelId;
  void reason;
  return stub({ started: true });
}
