/**
 * STUB (Scope 01) — owned by Scope 04 (docs/scopes/04-payments-ledger.md).
 * Exported names and types are FINAL. Scope 04 replaces the bodies;
 * callers never change. Until then everything returns fixture data.
 */
import type { PaymentStatusView } from "@/contracts/dto";
import type { PaymentPurpose } from "@/contracts/enums";
import { paymentPending } from "@/mocks/fixtures";
import { stub } from "@/mocks/stub";

export const STUB = true;

export type Payer =
  | { kind: "user"; userId: string }
  | { kind: "recipient_link"; parcelId: string };

export type CheckoutStart = {
  paymentId: string;
  txnRef: string;
  amountKobo: number;
  checkout: { url: string; fields: Record<string, string> };
};

/** Creates the payment row (amount computed server-side) and Web Checkout params. */
export async function startPayment(
  parcelId: string,
  purpose: Exclude<PaymentPurpose, "REFUND" | "INSURANCE">,
  payer: Payer,
): Promise<CheckoutStart> {
  void parcelId;
  void payer;
  return stub({
    paymentId: "pay_1",
    txnRef: "ISW-PT-8F3KQ2",
    amountKobo: purpose === "SHIPPING" ? 265_000 : 2_500_000,
    checkout: {
      url: "https://example.test/interswitch/webpay",
      fields: { txn_ref: "ISW-PT-8F3KQ2" },
    },
  });
}

/** Redirect handler: ignores redirect values, requeries, applies (PAY-2). */
export async function handleCallback(
  query: URLSearchParams,
): Promise<{ txnRef: string; status: PaymentStatusView["status"] }> {
  return stub({
    txnRef: query.get("txnref") ?? "ISW-PT-8F3KQ2",
    status: "VERIFIED",
  });
}

/** Idempotent webhook processing (PAY-3). */
export async function handleWebhook(
  rawBody: string,
  headers: Headers,
): Promise<{ processed: boolean; duplicate: boolean }> {
  void rawBody;
  void headers;
  return stub({ processed: true, duplicate: false });
}

/** Server requery: verified only on response code 00 with the exact amount. */
export async function requery(txnRef: string): Promise<PaymentStatusView> {
  return stub({
    ...paymentPending,
    txnRef,
    status: "VERIFIED",
    responseCode: "00",
  });
}

export async function paymentStatus(
  txnRef: string,
): Promise<PaymentStatusView | null> {
  return stub({ ...paymentPending, txnRef });
}

/** Applies a verified payment exactly once (status + ledger in one transaction). */
export async function applyVerifiedPayment(
  paymentId: string,
): Promise<{ applied: boolean }> {
  void paymentId;
  return stub({ applied: true });
}

/** Refund for expiry, cancellation or refusal (PAY-6). */
export async function refund(
  parcelId: string,
  reason: string,
): Promise<{ started: boolean }> {
  void parcelId;
  void reason;
  return stub({ started: true });
}
