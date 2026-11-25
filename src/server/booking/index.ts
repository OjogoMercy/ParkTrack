/**
 * Owned by Scope 05 (docs/scopes/05-sender-app.md). Exported names and
 * types are FINAL; callers never change. Being replaced slice by slice:
 * parkEstimates is real (sl1); createBooking (sl4) and listMyParcels (sl6)
 * still return fixture data. STUB stays true until every function is real.
 */
import { cacheLife, cacheTag } from "next/cache";
import type { BookingInput } from "@/contracts/api";
import type { ParcelSummary, Quote, VendorTotals } from "@/contracts/dto";
import { SIZE_CLASSES, type SizeClass } from "@/contracts/enums";
import { myParcels, parcelAwaiting, quoteMedium } from "@/mocks/fixtures";
import { stub } from "@/mocks/stub";
import { quote } from "@/server/parcels";
import { parkCacheTag } from "@/server/parks";

export const STUB = true;

export type BookingContext = {
  originParkId: string;
  senderId: string | null;
  createdBy: "SENDER" | "AGENT";
  createdByUserId: string;
};

/** S03 booking (also walk-ins from Scope 06): validates, quotes, creates the DRAFT. */
export async function createBooking(
  input: BookingInput,
  ctx: BookingContext,
): Promise<{ parcel: ParcelSummary; quote: Quote }> {
  void input;
  void ctx;
  return stub({
    parcel: { ...parcelAwaiting, status: "DRAFT" },
    quote: quoteMedium,
  });
}

/** S08 my parcels, with vendor totals when the sender is a vendor. */
export async function listMyParcels(
  userId: string,
  tab: "active" | "delivered" | "drafts",
): Promise<{ parcels: ParcelSummary[]; vendor: VendorTotals | null }> {
  void userId;
  void tab;
  return stub(myParcels);
}

/** Route id → size → the sender's total, as quote() works it out. */
export type ParkEstimates = Record<string, Record<SizeClass, Quote>>;

/**
 * S01 quick estimator: the real quote (fare by size + service fee, BOOK-4)
 * for every route and size of a park, so switching destination or size
 * updates the total instantly. Cached with the park (fares change through
 * the park admin, which revalidates the park tag); the service fee lives
 * in settings, so the cache is also short-lived.
 */
export async function parkEstimates(
  slug: string,
  routeIds: string[],
): Promise<ParkEstimates> {
  "use cache";
  cacheLife("minutes");
  cacheTag(parkCacheTag(slug));
  const out: ParkEstimates = {};
  for (const routeId of routeIds) {
    const bySize = {} as Record<SizeClass, Quote>;
    for (const size of SIZE_CLASSES) {
      bySize[size] = await quote({ routeId, size, podKobo: 0 });
    }
    out[routeId] = bySize;
  }
  return out;
}
