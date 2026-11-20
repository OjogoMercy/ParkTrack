/**
 * STUB (Scope 01) — owned by Scope 03 (docs/scopes/03-parcel-engine.md).
 * Exported names and types are FINAL. Scope 03 replaces the bodies;
 * callers never change. Until then everything returns fixture data.
 */
import type { NotificationEvent } from "@/contracts/notifications";
import { stub } from "@/mocks/stub";

export const STUB = true;

/**
 * Sends the PRD §11 messages for an event to everyone in its audience
 * (WhatsApp, SMS fallback, or the server log when NOTIFY_MODE=console).
 * Never throws because a message failed to deliver.
 */
export async function notify(
  event: NotificationEvent,
  parcelId: string | null,
  extra: Record<string, string | number> = {},
): Promise<{ sent: number }> {
  if (process.env.NODE_ENV !== "test") {
    console.info(`[notify stub] ${event}`, parcelId ?? "", extra);
  }
  return stub({ sent: 1 });
}

/** One-off code message (sign-in OTP, SMS handshake code). */
export async function sendCode(
  phone: string,
  code: string,
  channel: "WHATSAPP" | "SMS",
): Promise<{ channel: "WHATSAPP" | "SMS" }> {
  void phone;
  void code;
  return stub({ channel });
}
