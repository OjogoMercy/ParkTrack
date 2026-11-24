/**
 * Owned by Scope 04 (docs/scopes/04-payments-ledger.md). Exported names and
 * types are FINAL; callers never change. Being replaced slice by slice:
 * startPayment, handleCallback, requery, paymentStatus and
 * applyVerifiedPayment are real (sl2); handleWebhook (sl4) and refund (sl9)
 * still return fixture data. STUB stays true until every function is real.
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
/** Re-check interval while a payment is pending or retryable. */
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
    // Close older open checkouts for this parcel and purpose.
    await tx.payment.updateMany({
      where: { parcelId, purpose, status: "PENDING" },
      data: {
        status: "FAILED",
        nextRequeryAt: null,
        rawResponse: { reason: "Replaced by a newer checkout", final: true },
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

/** Idempotent webhook processing (PAY-3). STUB until sl4. */
export async function handleWebhook(
  rawBody: string,
  headers: Headers,
): Promise<{ processed: boolean; duplicate: boolean }> {
  void rawBody;
  void headers;
  return stub({ processed: true, duplicate: false });
}

/**
 * Asks Interswitch about a payment and records the answer. VERIFIED only on
 * "00" + exact amount + our reference; never downgrades a verified payment.
 * A verified payment is then applied (idempotent). Throws PaymentError
 * payment_not_found (404).
 */
export async function requery(txnRef: string): Promise<PaymentStatusView> {
  const payment = await db.payment.findUnique({ where: { txnRef } });
  if (!payment) {
    throw new PaymentError("payment_not_found", "Payment not found.", 404);
  }
  const settledFailure =
    payment.status === "FAILED" &&
    (payment.rawResponse as { final?: boolean } | null)?.final === true;
  if (payment.status !== "VERIFIED" && !settledFailure) {
    const config = iswConfig(serverEnv());
    let answer;
    try {
      answer = await requeryTransaction(config, txnRef, payment.amountKobo);
    } catch (e) {
      answer = { error: e instanceof Error ? e.message : String(e) };
    }
    const verdict = classifyRequery(answer, {
      txnRef,
      amountKobo: payment.amountKobo,
      startedAt: payment.createdAt,
    });
    await recordVerdict(payment.id, verdict, answer);
  }
  const latest = await db.payment.findUniqueOrThrow({ where: { txnRef } });
  if (latest.status === "VERIFIED") await applyVerifiedPayment(latest.id);
  return (await paymentStatus(txnRef))!;
}

async function recordVerdict(
  paymentId: string,
  verdict: Verdict,
  answer: unknown,
): Promise<void> {
  const now = new Date();
  const raw = { answer, reason: "reason" in verdict ? verdict.reason : null };
  if (verdict.status === "VERIFIED") {
    // Claim: only a payment that isn't verified yet becomes verified.
    await db.payment.updateMany({
      where: { id: paymentId, status: { not: "VERIFIED" } },
      data: {
        status: "VERIFIED",
        responseCode: "00",
        verifiedAt: now,
        nextRequeryAt: null,
        rawResponse: raw as Prisma.InputJsonValue,
        requeryCount: { increment: 1 },
      },
    });
    return;
  }
  const keepChecking =
    verdict.status === "PENDING" ||
    (verdict.status === "FAILED" && !verdict.final);
  await db.payment.updateMany({
    where: { id: paymentId, status: { not: "VERIFIED" } },
    data: {
      status: verdict.status,
      responseCode: verdict.responseCode,
      nextRequeryAt: keepChecking
        ? new Date(now.getTime() + minutes(RECHECK_MINUTES))
        : null,
      rawResponse: {
        ...raw,
        final: verdict.status === "FAILED" ? verdict.final : false,
      } as Prisma.InputJsonValue,
      requeryCount: { increment: 1 },
    },
  });
}

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
  const raw = (payment.rawResponse ?? {}) as { reason?: string | null };
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
        ? payment.responseCode && /^[0-9A-Z]{2,3}$/.test(payment.responseCode)
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
 *             booking_paid). If the booking was cancelled meanwhile, the
 *             payment is flagged for a refund instead.
 *   TOP_UP    clears the size top-up.
 *   POD       marks pay-on-delivery paid; roadside parcels get their
 *             handover code (R02).
 *   STORAGE   storage paid up to when the checkout started.
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
        },
      },
    },
  });
  if (!payment || payment.status !== "VERIFIED") return { applied: false };
  const parcel = payment.parcel;
  const purpose = payment.purpose as PayablePurpose;

  switch (purpose) {
    case "SHIPPING": {
      if (parcel.status !== "DRAFT") {
        if (parcel.status === "CANCELLED") await flagRefund(payment.id);
        return { applied: false };
      }
      try {
        await transition(
          parcel.id,
          "AWAITING_DROPOFF",
          { actor: "SYSTEM" },
          {
            eventType: "PAID",
            meta: { txnRef: payment.txnRef, paymentId: payment.id },
          },
        );
        return { applied: true };
      } catch (e) {
        // Someone else applied it first, or it was cancelled meanwhile.
        if (e instanceof ParcelError) {
          const now = await db.parcel.findUnique({
            where: { id: parcel.id },
            select: { status: true },
          });
          if (now?.status === "CANCELLED") await flagRefund(payment.id);
          return { applied: false };
        }
        throw e;
      }
    }
    case "TOP_UP": {
      const { count } = await db.parcel.updateMany({
        where: { id: parcel.id, topUpRequiredKobo: payment.amountKobo },
        data: { topUpRequiredKobo: 0 },
      });
      return { applied: count === 1 };
    }
    case "POD": {
      const { count } = await db.parcel.updateMany({
        where: { id: parcel.id, podPaidAt: null },
        data: { podPaidAt: payment.verifiedAt ?? new Date() },
      });
      if (
        count === 1 &&
        parcel.deliveryMode === "ROADSIDE" &&
        (parcel.status === "ASSIGNED" || parcel.status === "IN_TRANSIT")
      ) {
        await issueCollectionCode(parcel.id, "ROADSIDE").catch((e: unknown) =>
          console.error("[payments] roadside code after POD", e),
        );
      }
      return { applied: count === 1 };
    }
    case "STORAGE": {
      const { count } = await db.parcel.updateMany({
        where: {
          id: parcel.id,
          OR: [
            { storagePaidUntil: null },
            { storagePaidUntil: { lt: payment.createdAt } },
          ],
        },
        data: { storagePaidUntil: payment.createdAt },
      });
      return { applied: count === 1 };
    }
  }
}

async function flagRefund(paymentId: string): Promise<void> {
  const payment = await db.payment.findUnique({ where: { id: paymentId } });
  const raw = (payment?.rawResponse ?? {}) as Record<string, unknown>;
  if (raw.needsRefund) return;
  await db.payment.update({
    where: { id: paymentId },
    data: {
      rawResponse: {
        ...raw,
        needsRefund: true,
        refundReason: "Paid after the booking was cancelled",
      } as Prisma.InputJsonValue,
    },
  });
  console.warn(`[payments] ${payment?.txnRef} needs a refund (sl9)`);
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
