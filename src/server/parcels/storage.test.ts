import { describe, expect, it } from "vitest";
import { computeStorageDues, type StorageInput } from "./storage";

// Lagos is UTC+1: 2:10 PM in Lagos is 13:10 UTC.
const notified = new Date("2026-11-22T13:10:00Z"); // Sun 2:10 PM
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const plus = (ms: number) => new Date(notified.getTime() + ms);

const base: StorageInput = {
  notifiedAt: notified,
  windowHours: 24,
  maxHoldDays: 7,
  dailyRateKobo: 30_000, // ₦300 (seeded, Q6)
  paidUntil: null,
  collectedAt: null,
  at: notified,
};
const dues = (over: Partial<StorageInput>) =>
  computeStorageDues({ ...base, ...over });

describe("storage dues (COL-6)", () => {
  it("notified 2:10 PM, collected next day 3:00 PM → ₦300 for one started day", () => {
    expect(dues({ at: new Date("2026-11-23T14:00:00Z") })).toEqual({
      storageKobo: 30_000,
      freeUntil: "2026-11-23T13:10:00.000Z",
      daysCharged: 1,
    });
  });

  it("inside the free window → ₦0, up to the last second", () => {
    expect(dues({ at: plus(3 * HOUR) }).storageKobo).toBe(0);
    expect(dues({ at: plus(DAY) }).storageKobo).toBe(0); // exactly at the end
    expect(dues({ at: plus(DAY + 1000) }).storageKobo).toBe(30_000);
  });

  it("the clock doesn't start before the recipient is told", () => {
    expect(dues({ notifiedAt: null, at: plus(10 * DAY) })).toEqual({
      storageKobo: 0,
      freeUntil: null,
      daysCharged: 0,
    });
  });

  it("charges every started day", () => {
    expect(dues({ at: plus(DAY + 2 * DAY) }).daysCharged).toBe(2);
    expect(dues({ at: plus(DAY + 2 * DAY + 60_000) })).toMatchObject({
      daysCharged: 3,
      storageKobo: 90_000,
    });
  });

  it("stops at the maximum hold (7 days from the notice)", () => {
    // 24 h free, then 6 chargeable days before day 7 ends.
    expect(dues({ at: plus(30 * DAY) })).toMatchObject({
      daysCharged: 6,
      storageKobo: 180_000,
    });
  });

  it("stops when the parcel was collected", () => {
    expect(
      dues({
        collectedAt: new Date("2026-11-23T14:00:00Z"),
        at: plus(5 * DAY),
      }),
    ).toMatchObject({ daysCharged: 1, storageKobo: 30_000 });
  });

  it("doesn't charge days already paid", () => {
    const paidUntil = new Date("2026-11-23T14:00:00Z"); // paid day 1 at the counter
    expect(
      dues({ paidUntil, at: new Date("2026-11-23T16:00:00Z") }),
    ).toMatchObject({
      daysCharged: 0,
      storageKobo: 0,
    });
    expect(dues({ paidUntil, at: plus(DAY + DAY + HOUR) })).toMatchObject({
      daysCharged: 1, // day 2 only
      storageKobo: 30_000,
    });
  });

  it("uses the park's own window and rate", () => {
    expect(
      dues({
        windowHours: 48,
        dailyRateKobo: 50_000,
        at: plus(2 * DAY + HOUR),
      }),
    ).toMatchObject({ daysCharged: 1, storageKobo: 50_000 });
  });
});
