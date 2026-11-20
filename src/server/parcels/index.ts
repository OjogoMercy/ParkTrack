/**
 * STUB (Scope 01) — owned by Scope 03 (docs/scopes/03-parcel-engine.md).
 * Exported names and types are FINAL. Scope 03 replaces the bodies;
 * callers never change. Until then everything returns fixture data.
 */
import type { BookingInput } from "@/contracts/api";
import type { ParcelSummary, Quote } from "@/contracts/dto";
import type {
  CodePurpose,
  CreatedBy,
  ParcelEventType,
  ParcelStatus,
  SizeClass,
} from "@/contracts/enums";
import { canTransition, type Actor } from "@/contracts/states";
import { parcelAwaiting, quoteMedium } from "@/mocks/fixtures";
import { stub } from "@/mocks/stub";

export const STUB = true;

export type ActorRef = { actor: Actor; userId?: string };

export type TransitionDetails = {
  lat?: number;
  lng?: number;
  photoUrl?: string;
  note?: string;
  eventType?: ParcelEventType;
  meta?: Record<string, unknown>;
};

export type DraftInput = BookingInput & {
  senderId: string | null;
  originParkId: string;
  createdBy: CreatedBy;
  createdByUserId: string;
};

/** Creates a DRAFT with publicId, parcel code and fee snapshot (BOOK-1, HS-1). */
export async function createDraft(input: DraftInput): Promise<ParcelSummary> {
  void input;
  return stub({ ...parcelAwaiting, status: "DRAFT", dropoffDeadline: null });
}

/** Fare by size + platform fee (+ insurance, off for the hackathon); POD capped (BOOK-4). */
export async function quote(args: {
  routeId: string;
  size: SizeClass;
  podKobo: number;
}): Promise<Quote> {
  void args;
  return stub(quoteMedium);
}

/**
 * The only way a parcel's status changes. Checks contracts/states.ts (and
 * the actor), updates the status and writes a parcel_events row in one
 * transaction, then sends the matching notifications.
 */
export async function transition(
  parcelId: string,
  to: ParcelStatus,
  by: ActorRef,
  details: TransitionDetails = {},
): Promise<ParcelSummary> {
  void details;
  const from = parcelAwaiting.status;
  if (!canTransition(from, to, by.actor)) {
    throw new Error(`Transition ${from} → ${to} by ${by.actor} is not allowed`);
  }
  return stub({ ...parcelAwaiting, id: parcelId, status: to });
}

/** Roadside Missed: stays IN_TRANSIT, delivery mode becomes PARK (RD-5). */
export async function changeDeliveryMode(
  parcelId: string,
  mode: "PARK",
  by: ActorRef,
): Promise<ParcelSummary> {
  void by;
  return stub({
    ...parcelAwaiting,
    id: parcelId,
    status: "IN_TRANSIT",
    deliveryMode: mode,
  });
}

/** 6-digit code, stored hashed; counter codes expire in 10 minutes. */
export async function issueCollectionCode(
  parcelId: string,
  purpose: CodePurpose,
): Promise<{ sentTo: string; expiresAt: string | null }> {
  void parcelId;
  return stub({
    sentTo: "+234 000 *** 0201",
    expiresAt: purpose === "COUNTER" ? "2026-11-22T09:52:00+00:00" : null,
  });
}

/** Counts attempts and locks after 5 wrong codes (COL-4). */
export async function verifyCollectionCode(
  parcelId: string,
  code: string,
  purpose: CodePurpose,
): Promise<{ ok: boolean; attemptsLeft: number; locked: boolean }> {
  void parcelId;
  void purpose;
  return stub({
    ok: code === "482913" || code === "715204",
    attemptsLeft: 5,
    locked: false,
  });
}

/** Storage owed: 0 inside the free window (from the arrival notice), then daily rate (COL-6). */
export async function storageDues(
  parcelId: string,
  at: Date = new Date(),
): Promise<{
  storageKobo: number;
  freeUntil: string | null;
  daysCharged: number;
}> {
  void parcelId;
  void at;
  return stub({
    storageKobo: 0,
    freeUntil: "2026-11-23T13:10:00+00:00",
    daysCharged: 0,
  });
}
