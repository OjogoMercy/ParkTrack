/**
 * Refunds (PAY-6, Scope 04 sl9). A refund is its own payments row
 * (purpose REFUND, txn_ref ISW-RF-… derived from the original, so the
 * same payment can't be refunded twice) plus reversing ledger entries,
 * written in one transaction:
 *   HELD   −amount  "Refunded"              (the money leaves HELD)
 *   SENDER −amount  "Refund · expired booking" (P03's refund row; the
 *                   sender's account for payments the sender made, no
 *                   account id for what the recipient paid by link)
 * Then Interswitch is asked to refund it (./refund-client.ts). If that
 * can't be done (no credentials, refused, sandbox without refunds), the
 * refund stays "refund pending" and is flagged for staff (Q15). Once
 * Interswitch accepts it, the background job asks for its status until
 * it is COMPLETE or FAILED (a failed one is flagged for staff).
 *
 * Only money still held can be refunded here; once a parcel has settled,
 * a refund is a dispute (Scope 09).
 */
import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { serverEnv } from "@/lib/env";
import { holdPayment } from "@/server/ledger";
import { PaymentError } from "./errors";
import { iswConfig, requeryTransaction } from "./interswitch";
import {
  getRefund,
  refundRefFor,
  refundState,
  requestRefund,
} from "./refund-client";
import { paidBySender } from "./rules";

const RETRY_EVERY_MS = 30 * 60 * 1000;
const RETRY_FOR_MS = 24 * 60 * 60 * 1000;
/**
 * A refund Interswitch accepted settles the next working day: its status is
 * checked every 6 hours for a week, then staff take over.
 */
const STATUS_EVERY_MS = 6 * 60 * 60 * 1000;
const STATUS_FOR_MS = 7 * 24 * 60 * 60 * 1000;

export type RefundOutcome = {
  started: boolean;
  /** ISW-RF-… */
  refundRef: string | null;
  /** Interswitch's status, or why it wasn't sent. */
  status: string;
};

type RefundRaw = {
  parentPaymentId: string;
  parentTxnRef: string;
  reason: string;
  refundStatus: string;
  providerRefundId?: string | null;
  detail?: string;
  needsReview?: boolean;
};

/**
 * Refunds one verified payment in full. Safe to call again: the ledger is
 * written once, and a refund Interswitch hasn't accepted yet is re-sent.
 * Throws PaymentError payment_not_allowed (409) for a payment that already
 * settled; returns started: false for one that isn't a verified payment.
 */
export async function refundPayment(
  paymentId: string,
  reason: string,
): Promise<RefundOutcome> {
  const parent = await db.payment.findUnique({
    where: { id: paymentId },
    include: { parcel: { select: { senderId: true } } },
  });
  if (!parent || parent.status !== "VERIFIED" || parent.purpose === "REFUND") {
    return { started: false, refundRef: null, status: "not_refundable" };
  }
  const refundRef = refundRefFor(parent.txnRef);

  let row = await db.payment.findUnique({ where: { txnRef: refundRef } });
  if (!row) {
    try {
      row = await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM parcels WHERE id = ${parent.parcelId} FOR UPDATE`;
        const released = await tx.ledgerEntry.count({
          where: {
            paymentId: parent.id,
            account: "HELD",
            amountKobo: { lt: 0 },
          },
        });
        if (released) {
          throw new PaymentError(
            "payment_not_allowed",
            "This payment has already been settled or refunded; open a dispute instead.",
            409,
          );
        }
        await holdPayment(tx, parent.id);
        const raw: RefundRaw = {
          parentPaymentId: parent.id,
          parentTxnRef: parent.txnRef,
          reason,
          refundStatus: "NOT_SENT",
        };
        const created = await tx.payment.create({
          data: {
            parcelId: parent.parcelId,
            purpose: "REFUND",
            amountKobo: parent.amountKobo,
            txnRef: refundRef,
            status: "PENDING",
            payerPhone: parent.payerPhone,
            rawResponse: raw as Prisma.InputJsonValue,
          },
        });
        // The refund belongs to whoever paid: the sender also for a POD or
        // storage payment they made for their recipient.
        const sendersOwn = paidBySender(parent);
        await tx.ledgerEntry.createMany({
          data: [
            {
              parcelId: parent.parcelId,
              paymentId: parent.id,
              account: "HELD",
              amountKobo: -parent.amountKobo,
              reason: "Refunded",
            },
            {
              parcelId: parent.parcelId,
              paymentId: created.id,
              account: "SENDER",
              accountRefId: sendersOwn ? parent.parcel.senderId : null,
              amountKobo: -parent.amountKobo,
              reason: `Refund · ${reason}`,
            },
          ],
        });
        // The payer's /pay page shows "We'll refund this payment".
        const parentRaw = (parent.rawResponse ?? {}) as Record<string, unknown>;
        await tx.payment.update({
          where: { id: parent.id },
          data: {
            nextRequeryAt: null,
            rawResponse: {
              ...parentRaw,
              needsRefund: true,
              refundReason: parentRaw.refundReason ?? capitalise(reason),
              refundRef,
            } as Prisma.InputJsonValue,
          },
        });
        return created;
      });
    } catch (e) {
      if ((e as { code?: unknown }).code !== "P2002") throw e;
      // Another call created it first.
      row = await db.payment.findUniqueOrThrow({
        where: { txnRef: refundRef },
      });
    }
  }

  const raw = (row.rawResponse ?? {}) as RefundRaw;
  if (raw.refundStatus !== "NOT_SENT") {
    return { started: true, refundRef, status: raw.refundStatus };
  }
  return { started: true, refundRef, status: await send(row.id, parent) };
}

/** Sends a recorded refund to Interswitch and stores the answer. */
async function send(
  refundId: string,
  parent: { txnRef: string; amountKobo: number; rawResponse: unknown },
): Promise<string> {
  const env = serverEnv();
  const row = await db.payment.findUniqueOrThrow({
    where: { id: refundId },
    select: { txnRef: true, createdAt: true },
  });
  // "Try again later" answers are re-sent by the background job
  // (recheckDuePayments) every 30 minutes for a day; then staff take over.
  const pending = (detail: string, retryable = false) => {
    const age = Date.now() - row.createdAt.getTime();
    const retry = retryable && age < RETRY_FOR_MS;
    return record(
      refundId,
      { refundStatus: "NOT_SENT", detail, needsReview: true },
      undefined,
      retry ? new Date(Date.now() + RETRY_EVERY_MS) : null,
    ).then(() => "NOT_SENT");
  };

  if (!env.ISW_CLIENT_ID || !env.ISW_SECRET) {
    return pending("ISW_CLIENT_ID / ISW_SECRET aren't set");
  }
  let config;
  try {
    config = iswConfig(env);
  } catch (e) {
    return pending(e instanceof Error ? e.message : String(e));
  }
  // Interswitch refunds point at its own PaymentId (from the status check).
  let providerPaymentId =
    (parent.rawResponse as { answer?: { paymentId?: string | null } } | null)
      ?.answer?.paymentId ?? null;
  if (!providerPaymentId) {
    const answer = await requeryTransaction(
      config,
      parent.txnRef,
      parent.amountKobo,
    ).catch(() => null);
    providerPaymentId = answer?.paymentId ?? null;
  }
  if (!providerPaymentId) {
    return pending("Interswitch didn't give a payment id to refund", true);
  }

  const answer = await requestRefund(
    config,
    { clientId: env.ISW_CLIENT_ID, secret: env.ISW_SECRET },
    {
      refundReference: row.txnRef,
      parentPaymentId: providerPaymentId,
      amountKobo: parent.amountKobo,
    },
  );
  if (answer.ok) {
    const state = refundState(answer.status);
    if (state === "FAILED") {
      console.warn(
        `[payments] refund for ${parent.txnRef} failed at Interswitch: ${answer.status}`,
      );
    }
    await record(
      refundId,
      {
        refundStatus: answer.status,
        providerRefundId: answer.providerId,
        needsReview: state === "FAILED",
        detail:
          state === "FAILED" ? "Interswitch failed the refund" : undefined,
      },
      state,
      // Accepted but not settled yet: the job checks on it until it is.
      state === "PENDING" ? new Date(Date.now() + STATUS_EVERY_MS) : null,
    );
    return answer.status;
  }
  // Refused (10400) or unknown (10500, network): staff finish it by hand
  // in Quickteller Business; it stays "refund pending" (Q15).
  console.warn(
    `[payments] refund for ${parent.txnRef} not accepted: ${answer.code} ${answer.description}`,
  );
  return pending(`${answer.code}: ${answer.description}`, answer.retryable);
}

async function record(
  refundId: string,
  patch: Partial<RefundRaw>,
  status?: "PENDING" | "VERIFIED" | "FAILED",
  nextRequeryAt?: Date | null,
): Promise<void> {
  const row = await db.payment.findUniqueOrThrow({ where: { id: refundId } });
  await db.payment.update({
    where: { id: refundId },
    data: {
      ...(nextRequeryAt !== undefined ? { nextRequeryAt } : {}),
      ...(status
        ? {
            status,
            ...(status === "VERIFIED" ? { verifiedAt: new Date() } : {}),
          }
        : {}),
      rawResponse: {
        ...((row.rawResponse ?? {}) as Record<string, unknown>),
        ...patch,
      } as Prisma.InputJsonValue,
    },
  });
}

/**
 * Called by the background job for refund rows that are due: re-sends a
 * refund Interswitch couldn't take yet, or asks where an accepted one
 * stands. Returns its status.
 */
export async function resendRefund(refundId: string): Promise<string> {
  const row = await db.payment.findUnique({ where: { id: refundId } });
  if (!row || row.purpose !== "REFUND") return "not_a_refund";
  const raw = (row.rawResponse ?? {}) as RefundRaw;
  if (raw.refundStatus !== "NOT_SENT") {
    if (row.status === "PENDING") return checkRefund(row);
    await db.payment.update({
      where: { id: refundId },
      data: { nextRequeryAt: null },
    });
    return raw.refundStatus;
  }
  const parent = await db.payment.findUniqueOrThrow({
    where: { id: raw.parentPaymentId },
  });
  return send(refundId, parent);
}

/**
 * Asks Interswitch about a refund it accepted. COMPLETE → VERIFIED,
 * FAILED → FAILED and flagged for staff; still in flight → asked again in
 * 6 hours, for a week, then flagged for staff.
 */
async function checkRefund(row: {
  id: string;
  txnRef: string;
  createdAt: Date;
  rawResponse: unknown;
}): Promise<string> {
  const env = serverEnv();
  const raw = (row.rawResponse ?? {}) as RefundRaw;
  const keepChecking = Date.now() - row.createdAt.getTime() < STATUS_FOR_MS;
  const next = keepChecking ? new Date(Date.now() + STATUS_EVERY_MS) : null;
  let config;
  try {
    if (!env.ISW_CLIENT_ID || !env.ISW_SECRET) {
      throw new Error("ISW_CLIENT_ID / ISW_SECRET aren't set");
    }
    config = iswConfig(env);
  } catch (e) {
    await record(
      row.id,
      {
        needsReview: true,
        detail: e instanceof Error ? e.message : String(e),
      },
      undefined,
      null,
    );
    return raw.refundStatus;
  }
  const answer = await getRefund(
    config,
    { clientId: env.ISW_CLIENT_ID, secret: env.ISW_SECRET },
    row.txnRef,
  );
  if (!answer.ok) {
    await record(
      row.id,
      keepChecking
        ? {}
        : {
            needsReview: true,
            detail: `Refund still unconfirmed after a week: ${answer.description}`,
          },
      undefined,
      next,
    );
    return raw.refundStatus;
  }
  const state = refundState(answer.status);
  const gaveUp = state === "PENDING" && !keepChecking;
  if (state === "FAILED") {
    console.warn(
      `[payments] refund ${row.txnRef} failed at Interswitch: ${answer.status}`,
    );
  }
  await record(
    row.id,
    {
      refundStatus: answer.status,
      ...(answer.providerId ? { providerRefundId: answer.providerId } : {}),
      ...(state === "FAILED"
        ? { needsReview: true, detail: "Interswitch failed the refund" }
        : gaveUp
          ? {
              needsReview: true,
              detail: `Refund still ${answer.status} after a week`,
            }
          : {}),
    },
    state,
    state === "PENDING" ? next : null,
  );
  return answer.status;
}

/**
 * Refunds every payment of a parcel whose money is still held (expired or
 * cancelled booking, refused at drop-off). Payments already settled or
 * refunded are left alone. started: true when at least one refund began.
 */
export async function refundParcel(
  parcelId: string,
  reason: string,
): Promise<{ started: boolean; refunds: RefundOutcome[] }> {
  const payments = await db.payment.findMany({
    where: { parcelId, status: "VERIFIED", purpose: { not: "REFUND" } },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  const refunds: RefundOutcome[] = [];
  for (const p of payments) {
    try {
      refunds.push(await refundPayment(p.id, reason));
    } catch (e) {
      // Already settled: not ours to refund here.
      if (!(e instanceof PaymentError)) throw e;
    }
  }
  return { started: refunds.some((r) => r.started), refunds };
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
