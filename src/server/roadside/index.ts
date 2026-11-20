/**
 * STUB (Scope 01) — owned by Scope 07 (docs/scopes/07-driver-tracking.md).
 * Exported names and types are FINAL. Scope 07 replaces the bodies;
 * callers never change. Until then everything returns fixture data.
 */
import type { ParcelSummary } from "@/contracts/dto";
import { parcelInTransitRoadside } from "@/mocks/fixtures";
import { stub } from "@/mocks/stub";

export const STUB = true;

export type HandoverResult =
  | { result: "delivered"; parcel: ParcelSummary }
  | { result: "wrong_code"; attemptsLeft: number };

/** Roadside handover with the recipient's code; dues must be prepaid (RD-3, RD-4). */
export async function handover(
  parcelId: string,
  code: string,
  driverId: string,
): Promise<HandoverResult> {
  void driverId;
  if (code !== "715204") return stub({ result: "wrong_code", attemptsLeft: 4 });
  return stub({
    result: "delivered",
    parcel: {
      ...parcelInTransitRoadside,
      id: parcelId,
      status: "DELIVERED_ROADSIDE",
    },
  });
}

/** Missed: stays on the bus and becomes a park collection (RD-5). */
export async function markMissed(
  parcelId: string,
  reason: "not_at_stop" | "code_mismatch",
  driverId: string,
): Promise<{ result: "missed"; parcel: ParcelSummary }> {
  void reason;
  void driverId;
  return stub({
    result: "missed",
    parcel: { ...parcelInTransitRoadside, id: parcelId, deliveryMode: "PARK" },
  });
}
