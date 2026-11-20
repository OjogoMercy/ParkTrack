/**
 * STUB (Scope 01) — owned by Scope 06 (docs/scopes/06-origin-counter.md).
 * Exported names and types are FINAL. Scope 06 replaces the bodies;
 * callers never change. Until then everything returns fixture data.
 */
import type { BookingInput } from "@/contracts/api";
import type {
  AssignView,
  CounterToday,
  LoadsView,
  ParcelSummary,
  Quote,
} from "@/contracts/dto";
import {
  assignView,
  counterToday,
  loadsView,
  parcelAwaiting,
  quoteMedium,
} from "@/mocks/fixtures";
import { stub } from "@/mocks/stub";

export const STUB = true;

/** A01 counter today. */
export async function counterTodayFor(parkId: string): Promise<CounterToday> {
  void parkId;
  return stub(counterToday);
}

/** A06 parcels to assign and eligible drivers. */
export async function assignViewFor(parkId: string): Promise<AssignView> {
  void parkId;
  return stub(assignView);
}

/** Assigns parcels to a driver's trip; roadside parcels need an on-app driver (DRV-2). */
export async function assign(args: {
  parcelIds: string[];
  driverId: string;
  agentId: string;
  scheduledDepartureAt?: Date;
}): Promise<{ tripId: string; assigned: number }> {
  return stub({ tripId: "trip_musa_1", assigned: args.parcelIds.length });
}

/** A07 loads. */
export async function loadsFor(parkId: string): Promise<LoadsView> {
  void parkId;
  return stub(loadsView);
}

export async function remindDriver(tripId: string): Promise<void> {
  void tripId;
}

/** Moves parcels back to RECEIVED_AT_ORIGIN before acceptance. */
export async function reassign(
  tripId: string,
  parcelIds?: string[],
): Promise<{ released: number }> {
  void tripId;
  return stub({ released: parcelIds?.length ?? 4 });
}

/** Walk-in booking (BOOK-6): finds or creates the sender, books, returns the agent QR token. */
export async function walkIn(args: {
  sender: { phone: string; name: string };
  booking: BookingInput;
  agentId: string;
  parkId: string;
}): Promise<{ parcel: ParcelSummary; quote: Quote; agentQrToken: string }> {
  void args;
  return stub({
    parcel: { ...parcelAwaiting, status: "DRAFT" },
    quote: quoteMedium,
    agentQrToken: "agtWalkInAdeKola2026",
  });
}
