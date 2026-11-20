/**
 * STUB (Scope 01) — owned by Scope 06 (docs/scopes/06-origin-counter.md).
 * Exported names and types are FINAL. Scope 06 replaces the bodies;
 * callers never change. Until then everything returns fixture data.
 */
import type { HandshakeView, ParcelSummary } from "@/contracts/dto";
import { handshakeView, parcelAwaiting } from "@/mocks/fixtures";
import { stub } from "@/mocks/stub";

export const STUB = true;

export type HandshakeProof =
  | { method: "AGENT_SCAN" }
  | { method: "SENDER_SCAN"; agentQrToken: string }
  | { method: "SMS_CODE"; code: string };

/** Agent scanned the booking QR: full details for checking (HS-2). Null if not visible to them (HS-8). */
export async function getForAgent(
  publicId: string,
  agentId: string,
): Promise<HandshakeView | null> {
  void publicId;
  void agentId;
  return stub(handshakeView);
}

/** Confirms both parties are present; links walk-in bookings to the sender (HS-3). */
export async function confirm(
  publicId: string,
  proof: HandshakeProof,
  userId: string,
): Promise<ParcelSummary> {
  void publicId;
  void proof;
  void userId;
  return stub(parcelAwaiting);
}

/** Texts a code to a walk-in sender without a smartphone (HS-4). */
export async function sendSmsCode(
  publicId: string,
): Promise<{ sentTo: string; expiresAt: string }> {
  void publicId;
  return stub({
    sentTo: "+234 000 *** 0101",
    expiresAt: "2026-11-22T08:32:00+00:00",
  });
}
