/**
 * Interswitch webhooks (docs.interswitchgroup.com/docs/webhooks): the raw
 * JSON body is signed with HMAC-SHA512 (hex) using the secret from the
 * Quickteller Business dashboard, sent in X-Interswitch-Signature. A
 * message without a valid signature is not from Interswitch.
 *
 * The body is only a hint that something changed: the payment is still
 * decided by our own status check (classifyRequery), never by the webhook's
 * responseCode or amount.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const SIGNATURE_HEADER = "x-interswitch-signature";

/** True when `signature` is HMAC-SHA512(secret, rawBody) in hex. */
export function verifySignature(
  rawBody: string,
  signature: string | null,
  secret: string,
): boolean {
  if (!signature || !secret) return false;
  const given = signature.trim().toLowerCase();
  if (!/^[0-9a-f]{128}$/.test(given)) return false;
  const expected = createHmac("sha512", secret).update(rawBody).digest();
  return timingSafeEqual(Buffer.from(given, "hex"), expected);
}

export type WebhookEvent = {
  /** e.g. TRANSACTION.COMPLETED */
  event: string;
  uuid: string;
  /** Our txn_ref (data.merchantReference), when the event is about one. */
  txnRef: string | null;
  responseCode: string | null;
  /**
   * Idempotency key for webhook_events. Retries of the same message share
   * it; the CREATED/UPDATED/COMPLETED stages of one payment (which can
   * share a uuid) don't.
   */
  providerRef: string;
};

/** Reads a webhook body; null when it isn't a usable Interswitch event. */
export function parseWebhook(rawBody: string): WebhookEvent | null {
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return null;
  }
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const event = typeof b.event === "string" ? b.event : null;
  const uuid =
    typeof b.uuid === "string" || typeof b.uuid === "number"
      ? String(b.uuid)
      : null;
  if (!event || !uuid) return null;
  const data =
    b.data && typeof b.data === "object"
      ? (b.data as Record<string, unknown>)
      : {};
  const text = (v: unknown) =>
    typeof v === "string" && v.trim() ? v.trim() : null;
  const responseCode = text(data.responseCode);
  return {
    event,
    uuid,
    txnRef: text(data.merchantReference),
    responseCode,
    providerRef: [event, uuid, responseCode ?? "-"].join(":").slice(0, 255),
  };
}
