/**
 * STUB (Scope 01) — owned by Scope 06 (docs/scopes/06-origin-counter.md).
 * Exported names and types are FINAL. Scope 06 replaces the bodies;
 * callers never change. Until then everything returns fixture data.
 */
import type { ParcelSummary } from "@/contracts/dto";
import type { SizeClass } from "@/contracts/enums";
import { parcelAwaiting } from "@/mocks/fixtures";
import { stub } from "@/mocks/stub";

export const STUB = true;

export type DropoffInput = {
  sizeClass: SizeClass;
  codeWritten: true;
  photoUrl: string;
  corrections?: { description?: string; category?: string };
};

export type DropoffResult =
  | { state: "received"; parcel: ParcelSummary }
  | { state: "top_up_required"; topUpKobo: number };

/**
 * Check-in: size check, code written, photo. AWAITING_DROPOFF →
 * RECEIVED_AT_ORIGIN, then the recipient gets their tracking link (HS-7).
 */
export async function completeDropoff(
  parcelId: string,
  input: DropoffInput,
  agentId: string,
): Promise<DropoffResult> {
  void parcelId;
  void agentId;
  if (input.sizeClass === "L")
    return stub({ state: "top_up_required", topUpKobo: 150_000 });
  return stub({
    state: "received",
    parcel: { ...parcelAwaiting, status: "RECEIVED_AT_ORIGIN" },
  });
}

/** Refused item: logged, cancelled, refunded. */
export async function refuse(
  parcelId: string,
  reason: string,
  agentId: string,
): Promise<{ parcel: ParcelSummary; refundStarted: boolean }> {
  void reason;
  void agentId;
  return stub({
    parcel: { ...parcelAwaiting, id: parcelId, status: "CANCELLED" },
    refundStarted: true,
  });
}
