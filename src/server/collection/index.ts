/**
 * STUB (Scope 01) — owned by Scope 08 (docs/scopes/08-arrival-collection.md).
 * Exported names and types are FINAL. Scope 08 replaces the bodies;
 * callers never change. Until then everything returns fixture data.
 */
import type { CollectView, Dues, ParcelSummary } from "@/contracts/dto";
import type { CollectorKind } from "@/contracts/enums";
import { collectView, parcelReady } from "@/mocks/fixtures";
import { stub } from "@/mocks/stub";

export const STUB = true;

/** How the recipient proved who they are at the counter (open question Q16). */
export type CollectIdentity =
  { kind: "link"; token: string } | { kind: "phone"; phone: string };

export type ReleaseResult =
  | { result: "released"; parcel: ParcelSummary }
  | { result: "wrong_code"; attemptsLeft: number }
  | { result: "locked" }
  | { result: "dues_unpaid"; dues: Dues };

/** R04: recipient scanned the counter poster; their parcels at this park (COL-1). */
export async function collectViewFor(
  parkToken: string,
  identity: CollectIdentity,
): Promise<CollectView | null> {
  void parkToken;
  void identity;
  return stub(collectView);
}

/** Issues the 10-minute counter code once dues are paid (COL-1, COL-2). */
export async function requestCode(
  parkToken: string,
  parcelId: string,
  identity: CollectIdentity,
): Promise<{ sentTo: string; expiresAt: string }> {
  void parkToken;
  void parcelId;
  void identity;
  return stub({
    sentTo: "+234 000 *** 0201",
    expiresAt: "2026-11-22T09:52:00+00:00",
  });
}

/** V04: code + dues verified → COLLECTED → settled (COL-3, COL-5). */
export async function release(
  parcelId: string,
  input: {
    code: string;
    collector: { kind: CollectorKind; name?: string };
    photoUrl?: string;
  },
  agentId: string,
): Promise<ReleaseResult> {
  void agentId;
  if (input.code !== "482913")
    return stub({ result: "wrong_code", attemptsLeft: 4 });
  return stub({
    result: "released",
    parcel: { ...parcelReady, id: parcelId, status: "COLLECTED" },
  });
}

/** Park admin release after a lock, with an ID photo (COL-4). */
export async function adminRelease(
  parcelId: string,
  input: { idPhotoUrl: string; collectorName: string },
  adminId: string,
): Promise<{ parcel: ParcelSummary }> {
  void input;
  void adminId;
  return stub({
    parcel: { ...parcelReady, id: parcelId, status: "COLLECTED" },
  });
}
