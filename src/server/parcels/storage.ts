/**
 * Storage fees at the arrival park (COL-6, Q6). Pure; ./index.ts loads the
 * parcel, park settings and rate and calls computeStorageDues().
 *
 * - The free window starts when the recipient is told the parcel arrived
 *   (`arrivalNotifiedAt`), not when the bus got in, and lasts the park's
 *   `storageWindowHours` (24 by default).
 * - After that, every started day costs the park's daily rate for the
 *   parcel's size (₦300 seeded).
 * - Charging stops at the park's maximum hold (`maxHoldDays` after the
 *   notice, 7 by default) and when the parcel is collected.
 * - Days already paid (`storagePaidUntil`) aren't charged again.
 *
 * Worked out when read, so no job has to add fees overnight.
 */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export type StorageInput = {
  /** When the recipient was told it arrived; null = clock not started. */
  notifiedAt: Date | null;
  windowHours: number;
  maxHoldDays: number;
  dailyRateKobo: number;
  /** Storage already paid up to this time (Scope 04). */
  paidUntil: Date | null;
  /** When it was collected, if it was; fees stop then. */
  collectedAt: Date | null;
  at: Date;
};

export type StorageDues = {
  storageKobo: number;
  freeUntil: string | null;
  daysCharged: number;
};

/** Started days charged between the end of the free window and `t`. */
function chargedDaysUpTo(t: Date, freeUntil: Date, holdEnd: Date): number {
  const end = Math.min(t.getTime(), holdEnd.getTime());
  if (end <= freeUntil.getTime()) return 0;
  return Math.ceil((end - freeUntil.getTime()) / DAY);
}

export function computeStorageDues(input: StorageInput): StorageDues {
  if (!input.notifiedAt) {
    return { storageKobo: 0, freeUntil: null, daysCharged: 0 };
  }
  const freeUntil = new Date(
    input.notifiedAt.getTime() + input.windowHours * HOUR,
  );
  const holdEnd = new Date(
    input.notifiedAt.getTime() + input.maxHoldDays * DAY,
  );
  const until =
    input.collectedAt && input.collectedAt < input.at
      ? input.collectedAt
      : input.at;

  const total = chargedDaysUpTo(until, freeUntil, holdEnd);
  const paid = input.paidUntil
    ? chargedDaysUpTo(input.paidUntil, freeUntil, holdEnd)
    : 0;
  const daysCharged = Math.max(0, total - paid);
  return {
    storageKobo: daysCharged * input.dailyRateKobo,
    freeUntil: freeUntil.toISOString(),
    daysCharged,
  };
}
