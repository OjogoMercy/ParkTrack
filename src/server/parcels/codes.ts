import type {
  CodePurpose,
  DeliveryMode,
  ParcelStatus,
} from "@/contracts/enums";

/**
 * Collection code rules (COL-1, COL-2, COL-4, Q4, Q5). Pure, so each rule is
 * unit-tested; ./index.ts applies them in a database transaction.
 *
 *   COUNTER   at the arrival park; valid 10 minutes; "Get a new code"
 *             cancels the old one.
 *   ROADSIDE  handed to the driver at the drop point; valid until the trip
 *             ends or the parcel is marked Missed (no clock).
 *
 * Five wrong codes in total for a parcel and purpose lock the parcel
 * (`parcels.locked`), whichever code they were typed against, so asking for
 * a new code doesn't reset the count. A locked parcel gets no new code; an
 * admin releases it (Scope 08, V05).
 */

export const COUNTER_CODE_MINUTES = 10;
export const CODE_MAX_WRONG = 5;
/** A new code for the same parcel at most this often (SMS cost, abuse). */
export const CODE_RESEND_SECONDS = 30;

type ParcelState = {
  status: ParcelStatus;
  deliveryMode: DeliveryMode;
  locked: boolean;
};

/** Why a code can't be issued now, or null. */
export function issueProblem(
  parcel: ParcelState,
  purpose: CodePurpose,
): string | null {
  if (parcel.locked) {
    return "This parcel is locked after 5 wrong codes. A park admin must release it.";
  }
  if (purpose === "COUNTER") {
    return parcel.status === "ARRIVED" || parcel.status === "UNCLAIMED"
      ? null
      : "A collection code is only sent once the parcel is at the arrival park.";
  }
  return parcel.deliveryMode === "ROADSIDE" &&
    (parcel.status === "ASSIGNED" || parcel.status === "IN_TRANSIT")
    ? null
    : "A roadside code is only sent while the parcel is on its way to a drop point.";
}

/** When a new code expires: 10 minutes at the counter, never at the roadside. */
export function codeExpiry(purpose: CodePurpose, now: Date): Date | null {
  return purpose === "COUNTER"
    ? new Date(now.getTime() + COUNTER_CODE_MINUTES * 60 * 1000)
    : null;
}

/**
 * Why the active code can't be checked any more, or null. A roadside code
 * ends with the trip: once the parcel is no longer a roadside parcel on the
 * road (delivered, missed, arrived), it stops working.
 */
export function codeExpiredReason(
  code: { expiresAt: Date | null },
  parcel: ParcelState,
  purpose: CodePurpose,
  now: Date,
): string | null {
  if (code.expiresAt && code.expiresAt <= now) {
    return "This code has expired. Ask for a new one.";
  }
  if (
    purpose === "ROADSIDE" &&
    !(parcel.deliveryMode === "ROADSIDE" && parcel.status === "IN_TRANSIT")
  ) {
    return "This roadside code ended with the trip.";
  }
  return null;
}

/** Result after one more wrong code, given the wrong codes before it. */
export function afterWrongCode(wrongBefore: number): {
  attemptsLeft: number;
  locked: boolean;
} {
  const wrong = wrongBefore + 1;
  return {
    attemptsLeft: Math.max(0, CODE_MAX_WRONG - wrong),
    locked: wrong >= CODE_MAX_WRONG,
  };
}

/** Hash context: a code only works for its own parcel and purpose. */
export function codeContext(parcelId: string, purpose: CodePurpose): string {
  return `collection:${parcelId}:${purpose}`;
}
