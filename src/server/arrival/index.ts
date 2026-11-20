/**
 * STUB (Scope 01) — owned by Scope 08 (docs/scopes/08-arrival-collection.md).
 * Exported names and types are FINAL. Scope 08 replaces the bodies;
 * callers never change. Until then everything returns fixture data.
 */
import type {
  ArrivalsView,
  ManifestView,
  ReleaseView,
  StoreItem,
} from "@/contracts/dto";
import {
  arrivalsView,
  manifestView,
  releaseView,
  storeItems,
} from "@/mocks/fixtures";
import { stub } from "@/mocks/stub";

export const STUB = true;

export type TickMark =
  | { mark: "arrived"; parcelId: string; bay: string }
  | { mark: "missing"; parcelId: string }
  | {
      mark: "damaged";
      parcelId: string;
      bay: string;
      photoUrl: string;
      note?: string;
    };

/** V01 buses arriving and store counts. */
export async function arrivalsFor(parkId: string): Promise<ArrivalsView> {
  void parkId;
  return stub(arrivalsView);
}

/** Arrival agent scanned the manifest QR once (ARR-1). Null if not for this park. */
export async function manifestFor(
  token: string,
  agentId: string,
): Promise<ManifestView | null> {
  void token;
  void agentId;
  return stub(manifestView);
}

/** Tick off with bay → ARRIVED + recipient notified; missing → dispute (ARR-2, ARR-4). */
export async function tick(
  token: string,
  mark: TickMark,
  agentId: string,
): Promise<ManifestView> {
  void token;
  void mark;
  void agentId;
  return stub(manifestView);
}

/** "Finish · notify N recipients" (V02). */
export async function finish(
  token: string,
  agentId: string,
): Promise<{ notified: number; disputesOpened: number }> {
  void token;
  void agentId;
  return stub({ notified: 3, disputesOpened: 1 });
}

/** V03 store, with live storage dues. */
export async function storeFor(
  parkId: string,
  filter: "all" | "fees_due" | "over_5_days" = "all",
): Promise<StoreItem[]> {
  void parkId;
  if (filter === "fees_due")
    return stub(storeItems.filter((s) => s.storageDueKobo > 0));
  if (filter === "over_5_days")
    return stub(storeItems.filter((s) => s.daysHeld > 5));
  return stub(storeItems);
}

/** V04/V05 release screen. */
export async function releaseViewFor(
  parcelCode: string,
  agentId: string,
): Promise<ReleaseView | null> {
  void agentId;
  return stub({ ...releaseView, parcelCode });
}
