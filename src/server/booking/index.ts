/**
 * STUB (Scope 01) — owned by Scope 05 (docs/scopes/05-sender-app.md).
 * Exported names and types are FINAL. Scope 05 replaces the bodies;
 * callers never change. Until then everything returns fixture data.
 */
import type { BookingInput } from "@/contracts/api";
import type { ParcelSummary, Quote, VendorTotals } from "@/contracts/dto";
import { myParcels, parcelAwaiting, quoteMedium } from "@/mocks/fixtures";
import { stub } from "@/mocks/stub";

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
