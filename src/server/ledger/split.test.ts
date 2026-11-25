import { describe, expect, it } from "vitest";
import { SplitError, bpsOf, percent, settlementRows } from "./split";

const shares = {
  driverShareBps: 6000,
  storageParkShareBps: 8000,
  podFeeBps: 125,
};
const parcel = {
  fareKobo: 300_000,
  platformFeeKobo: 15_000,
  insuranceKobo: 0,
  senderId: "u_tolu",
  originParkId: "park_ogbomoso",
  destinationParkId: "park_iwo_road",
};
const shipping = {
  id: "pay_ship",
  purpose: "SHIPPING" as const,
  amountKobo: 315_000,
};
const pod = { id: "pay_pod", purpose: "POD" as const, amountKobo: 4_000_000 };
const credits = (rows: ReturnType<typeof settlementRows>) =>
  rows
    .filter((r) => r.account !== "HELD")
    .map((r) => [r.account, r.accountRefId, r.amountKobo, r.reason]);
const sum = (rows: ReturnType<typeof settlementRows>) =>
  rows.reduce((t, r) => t + r.amountKobo, 0);

describe("settlement split (P03 example, PT-9X1A)", () => {
  it("POD ₦40,000 + shipping ₦3,150 → exactly the five P03 credit rows", () => {
    const rows = settlementRows([shipping, pod], parcel, "u_ade", shares);
    expect(credits(rows)).toEqual([
      ["VENDOR", "u_tolu", 3_950_000, "Pay on delivery, less 1.25%"],
      ["PLATFORM", null, 50_000, "Pay-on-delivery fee"],
      ["DRIVER", "u_ade", 180_000, "Fare share"],
      ["PARK", "park_ogbomoso", 120_000, "Fare share"],
      ["PLATFORM", null, 15_000, "Service fee"],
    ]);
    // Plus each payment leaving HELD; the whole settlement sums to zero.
    expect(rows.filter((r) => r.account === "HELD")).toEqual([
      expect.objectContaining({ paymentId: "pay_pod", amountKobo: -4_000_000 }),
      expect.objectContaining({ paymentId: "pay_ship", amountKobo: -315_000 }),
    ]);
    expect(sum(rows)).toBe(0);
  });

  it("storage ₦600 → park (destination) ₦480, platform ₦120", () => {
    const rows = settlementRows(
      [{ id: "pay_st", purpose: "STORAGE", amountKobo: 60_000 }],
      parcel,
      null, // no driver needed for storage
      shares,
    );
    expect(credits(rows)).toEqual([
      ["PARK", "park_iwo_road", 48_000, "Storage"],
      ["PLATFORM", null, 12_000, "Storage share"],
    ]);
    expect(sum(rows)).toBe(0);
  });

  it("top-up is extra fare; insurance goes to the insurer", () => {
    const rows = settlementRows(
      [
        { ...shipping, amountKobo: 320_000 },
        { id: "pay_up", purpose: "TOP_UP", amountKobo: 50_000 },
      ],
      { ...parcel, insuranceKobo: 5_000 },
      "u_ade",
      shares,
    );
    expect(credits(rows)).toEqual([
      ["DRIVER", "u_ade", 180_000, "Fare share"],
      ["PARK", "park_ogbomoso", 120_000, "Fare share"],
      ["PLATFORM", null, 15_000, "Service fee"],
      ["INSURER", null, 5_000, "Insurance"],
      ["DRIVER", "u_ade", 30_000, "Fare share · size top-up"],
      ["PARK", "park_ogbomoso", 20_000, "Fare share · size top-up"],
    ]);
    expect(sum(rows)).toBe(0);
  });

  it("rounds to whole kobo and never loses one", () => {
    const rows = settlementRows(
      [{ id: "p", purpose: "POD", amountKobo: 333_333 }],
      parcel,
      null,
      { ...shares, podFeeBps: 125 },
    );
    expect(rows.every((r) => Number.isInteger(r.amountKobo))).toBe(true);
    expect(sum(rows)).toBe(0);
    expect(bpsOf(333_333, 125)).toBe(4_167);
  });

  it("refuses a fare without a driver, or a shipping amount that doesn't add up", () => {
    expect(() => settlementRows([shipping], parcel, null, shares)).toThrow(
      SplitError,
    );
    expect(() =>
      settlementRows([{ ...shipping, amountKobo: 1 }], parcel, "u_ade", shares),
    ).toThrow(/doesn't match/);
  });

  it("formats shares", () => {
    expect(percent(125)).toBe("1.25%");
    expect(percent(6000)).toBe("60%");
  });
});
