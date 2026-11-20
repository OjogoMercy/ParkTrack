/**
 * STUB (Scope 01) — owned by Scope 07 (docs/scopes/07-driver-tracking.md).
 * Exported names and types are FINAL. Scope 07 replaces the bodies;
 * callers never change. Until then everything returns fixture data.
 */
import type {
  ParcelDetail,
  ParcelSummary,
  TrackingView,
} from "@/contracts/dto";
import {
  parcelAwaiting,
  parcelDetailAwaiting,
  TRACKING_LINK,
  trackingReady,
} from "@/mocks/fixtures";
import { stub } from "@/mocks/stub";

export const STUB = true;

/** Recipient view through the signed link (R01–R03). Null for invalid/expired links. */
export async function trackingForLink(
  linkToken: string,
): Promise<TrackingView | null> {
  return linkToken === TRACKING_LINK ? stub(trackingReady) : null;
}

/** Sender's parcel page (S09–S11). Null unless this user sent it. */
export async function parcelDetailFor(
  parcelCode: string,
  userId: string,
): Promise<ParcelDetail | null> {
  void userId;
  return stub({ ...parcelDetailAwaiting, parcelCode });
}

/** Sender cancels before loading; refunded in full (PRD §9). */
export async function cancelBySender(
  parcelId: string,
  userId: string,
  reason?: string,
): Promise<{ parcel: ParcelSummary; refundStarted: boolean }> {
  void userId;
  void reason;
  return stub({
    parcel: { ...parcelAwaiting, id: parcelId, status: "CANCELLED" },
    refundStarted: true,
  });
}
