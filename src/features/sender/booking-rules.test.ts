import { describe, expect, it } from "vitest";
import { BookingInput } from "@/contracts/api";
import { ITEM_CATEGORIES, PROHIBITED_ITEMS } from "@/contracts/enums";
import { prohibitedItemIn } from "@/server/parcels/pricing";
import { draftExpired } from "./format";

const booking = {
  destinationParkId: "park_ibadan",
  deliveryMode: "PARK",
  recipient: { name: "Kemi Bakare", phone: "08021189034" },
  saveRecipient: false,
  category: "Clothing & fabric",
  description: "2 bundles of ankara fabric",
  declaredValueKobo: 4_500_000,
  sizeClass: "M",
  podAmountKobo: 0,
};

describe("prohibited items can't be booked (BOOK-8)", () => {
  it("a prohibited item is never a category, so it can't be submitted", () => {
    for (const item of PROHIBITED_ITEMS) {
      expect(ITEM_CATEGORIES as readonly string[]).not.toContain(item);
      expect(
        BookingInput.safeParse({ ...booking, category: item }).success,
        item,
      ).toBe(false);
    }
    expect(BookingInput.safeParse(booking).success).toBe(true);
  });

  it("the form's live check is the server's check", () => {
    expect(prohibitedItemIn("a gas cylinder")).toBe(
      "Fuel, gas cylinders or flammable liquids",
    );
    expect(prohibitedItemIn("2 bundles of ankara fabric")).toBeNull();
    expect(prohibitedItemIn("fuel pump for a Corolla")).toBeNull();
  });
});

describe("unpaid drafts", () => {
  const now = new Date("2026-11-25T10:00:00Z");
  it("can be paid for 24 hours", () => {
    expect(
      draftExpired({ status: "DRAFT", createdAt: "2026-11-25T08:00:00Z" }, now),
    ).toBe(false);
    expect(
      draftExpired({ status: "DRAFT", createdAt: "2026-11-24T09:00:00Z" }, now),
    ).toBe(true);
    expect(
      draftExpired(
        { status: "AWAITING_DROPOFF", createdAt: "2026-11-20T09:00:00Z" },
        now,
      ),
    ).toBe(false);
  });
});

describe("declared value", () => {
  it("the cap fits the parcels table (32-bit integer kobo)", async () => {
    const { MAX_DECLARED_VALUE_KOBO } = await import("@/server/booking");
    expect(MAX_DECLARED_VALUE_KOBO).toBeLessThanOrEqual(2_147_483_647);
  });
});
