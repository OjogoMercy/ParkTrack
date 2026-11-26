import { describe, expect, it } from "vitest";
import {
  itemName,
  nextCheckAt,
  paidBySender,
  payableAmount,
  payerProblem,
  type ParcelForPayment,
} from "./rules";

const now = new Date("2026-11-24T10:00:00Z");
const draft: ParcelForPayment = {
  status: "DRAFT",
  senderId: "u_tolu",
  createdByUserId: "u_tolu",
  totalKobo: 265_000,
  topUpRequiredKobo: 0,
  podAmountKobo: 2_500_000,
  podPaidAt: null,
  draftExpiresAt: new Date("2026-11-25T10:00:00Z"),
};

describe("amount to charge (server-side only)", () => {
  it("shipping charges the booking total while the draft is open", () => {
    expect(payableAmount("SHIPPING", draft, 0, now)).toEqual({
      amountKobo: 265_000,
    });
  });

  it("an expired or already-paid booking can't be paid", () => {
    expect(
      payableAmount(
        "SHIPPING",
        { ...draft, draftExpiresAt: new Date("2026-11-24T09:59:59Z") },
        0,
        now,
      ),
    ).toMatchObject({ problem: expect.stringMatching(/expired/) });
    expect(
      payableAmount(
        "SHIPPING",
        { ...draft, status: "AWAITING_DROPOFF" },
        0,
        now,
      ),
    ).toMatchObject({ problem: expect.stringMatching(/already paid/) });
  });

  it("top-up only when one is owed at drop-off", () => {
    expect(
      payableAmount("TOP_UP", { ...draft, status: "AWAITING_DROPOFF" }, 0, now),
    ).toHaveProperty("problem");
    expect(
      payableAmount(
        "TOP_UP",
        { ...draft, status: "AWAITING_DROPOFF", topUpRequiredKobo: 150_000 },
        0,
        now,
      ),
    ).toEqual({ amountKobo: 150_000 });
  });

  it("pay-on-delivery once, while the parcel is on its way or waiting", () => {
    expect(
      payableAmount("POD", { ...draft, status: "IN_TRANSIT" }, 0, now),
    ).toEqual({ amountKobo: 2_500_000 });
    expect(payableAmount("POD", draft, 0, now)).toHaveProperty("problem");
    expect(
      payableAmount(
        "POD",
        { ...draft, status: "ARRIVED", podPaidAt: now },
        0,
        now,
      ),
    ).toMatchObject({ problem: expect.stringMatching(/already paid/) });
    expect(
      payableAmount(
        "POD",
        { ...draft, status: "ARRIVED", podAmountKobo: 0 },
        0,
        now,
      ),
    ).toHaveProperty("problem");
  });

  it("storage only at the park, only when something is owed", () => {
    expect(
      payableAmount("STORAGE", { ...draft, status: "ARRIVED" }, 30_000, now),
    ).toEqual({ amountKobo: 30_000 });
    expect(
      payableAmount("STORAGE", { ...draft, status: "ARRIVED" }, 0, now),
    ).toHaveProperty("problem");
    expect(
      payableAmount("STORAGE", { ...draft, status: "IN_TRANSIT" }, 30_000, now),
    ).toHaveProperty("problem");
  });
});

describe("who may pay", () => {
  const parcel = { id: "p1", senderId: "u_tolu", createdByUserId: "u_bayo" };

  it("sender (or the agent who booked a walk-in) pays shipping and top-ups", () => {
    expect(
      payerProblem("SHIPPING", { kind: "user", userId: "u_tolu" }, parcel),
    ).toBeNull();
    expect(
      payerProblem("SHIPPING", { kind: "user", userId: "u_bayo" }, parcel),
    ).toBeNull();
    expect(
      payerProblem("TOP_UP", { kind: "user", userId: "u_stranger" }, parcel),
    ).toMatch(/Only the sender/);
  });

  it("the recipient's link pays POD and storage for its own parcel only", () => {
    expect(
      payerProblem("POD", { kind: "recipient_link", parcelId: "p1" }, parcel),
    ).toBeNull();
    expect(
      payerProblem(
        "STORAGE",
        { kind: "recipient_link", parcelId: "p1" },
        parcel,
      ),
    ).toBeNull();
    expect(
      payerProblem("POD", { kind: "recipient_link", parcelId: "p2" }, parcel),
    ).toMatch(/another parcel/);
    expect(
      payerProblem(
        "SHIPPING",
        { kind: "recipient_link", parcelId: "p1" },
        parcel,
      ),
    ).toMatch(/Only the sender/);
  });

  it("a stranger can't pay someone's POD by signing in", () => {
    expect(
      payerProblem("POD", { kind: "user", userId: "u_stranger" }, parcel),
    ).toMatch(/link/);
  });
});

it("names the item on the Interswitch page", () => {
  expect(itemName("SHIPPING", "PT-7K3Q")).toBe("ParkTrack PT-7K3Q shipping");
});

describe("background re-check back-off (by age)", () => {
  const start = new Date("2026-11-25T10:00:00Z");
  const after = (min: number) => new Date(start.getTime() + min * 60_000);
  const gap = (min: number) => {
    const next = nextCheckAt(start, after(min));
    return next ? (next.getTime() - after(min).getTime()) / 60_000 : null;
  };
  it("every 5 min for 30 min, 15 to 2 h, then hourly, stops at 24 h", () => {
    expect(gap(10)).toBe(5);
    expect(gap(29)).toBe(5);
    expect(gap(30)).toBe(15);
    expect(gap(119)).toBe(15);
    expect(gap(120)).toBe(60);
    expect(gap(23 * 60)).toBe(60);
    expect(gap(24 * 60)).toBeNull();
  });
});

describe("paidBySender", () => {
  it("shipping and top-ups are always the sender's", () => {
    expect(paidBySender({ purpose: "SHIPPING", payerPhone: null })).toBe(true);
    expect(paidBySender({ purpose: "TOP_UP", payerPhone: null })).toBe(true);
  });
  it("POD and storage: the sender when signed in, else the recipient's link", () => {
    expect(paidBySender({ purpose: "POD", payerPhone: "+2348035554471" })).toBe(
      true,
    );
    expect(paidBySender({ purpose: "STORAGE", payerPhone: null })).toBe(false);
    expect(paidBySender({ purpose: "POD", payerPhone: null })).toBe(false);
  });
});
