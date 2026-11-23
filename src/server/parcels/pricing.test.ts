import { describe, expect, it } from "vitest";
import { Quote } from "@/contracts/dto";
import { ParcelError } from "./errors";
import { buildQuote, fareFor, prohibitedItemIn } from "./pricing";

// Seeded Ogbomoso → Ibadan fares (prisma/seed.ts) and settings defaults.
const ogbToIbd = {
  fareSmallKobo: 150_000,
  fareMediumKobo: 250_000,
  fareLargeKobo: 400_000,
};
const settings = { platformFeeKobo: 15_000, podLimitKobo: 20_000_000 };

const q = (size: "S" | "M" | "L", podKobo = 0) =>
  buildQuote({ fareKobo: fareFor(ogbToIbd, size), size, podKobo, ...settings });

describe("quote", () => {
  it("Ogbomoso → Ibadan Medium is ₦2,500 + ₦150 = ₦2,650 (S04)", () => {
    const quote = q("M");
    expect(quote).toEqual({
      fareKobo: 250_000,
      platformFeeKobo: 15_000,
      insuranceKobo: 0,
      totalKobo: 265_000,
      podAmountKobo: 0,
      lines: [
        { label: "Fare · Medium", amountKobo: 250_000 },
        { label: "Service fee", amountKobo: 15_000 },
      ],
    });
    expect(Quote.safeParse(quote).success).toBe(true);
  });

  it("prices each size from the route", () => {
    expect(q("S").totalKobo).toBe(165_000);
    expect(q("L").totalKobo).toBe(415_000);
    expect(q("L").lines[0].label).toBe("Fare · Large");
  });

  it("keeps pay-on-delivery out of the sender's total", () => {
    const quote = q("M", 2_500_000); // ₦25,000 to collect from the recipient
    expect(quote.totalKobo).toBe(265_000);
    expect(quote.podAmountKobo).toBe(2_500_000);
  });

  it("allows pay-on-delivery up to ₦200,000, not a kobo more", () => {
    expect(q("M", 20_000_000).podAmountKobo).toBe(20_000_000);
    const err = (() => {
      try {
        q("M", 20_000_001);
      } catch (e) {
        return e;
      }
    })();
    expect(err).toBeInstanceOf(ParcelError);
    expect(err).toMatchObject({ code: "pod_too_high", status: 400 });
    expect((err as ParcelError).message).toContain("₦200,000");
  });

  it("refuses negative or fractional amounts", () => {
    expect(() => q("M", -1)).toThrow(ParcelError);
    expect(() => q("M", 10.5)).toThrow(ParcelError);
  });
});

describe("prohibited items in the description", () => {
  it("catches the PRD §6.5 list", () => {
    expect(prohibitedItemIn("Two gas cylinders")).toMatch(/gas cylinders/i);
    expect(prohibitedItemIn("5 litres of petrol")).toMatch(/Fuel/);
    expect(prohibitedItemIn("pistol and bullets")).toMatch(/Firearms/);
    expect(prohibitedItemIn("Live chickens x4")).toBe("Live animals");
    expect(prohibitedItemIn("Envelope with cash")).toBe("Cash or cheques");
    expect(prohibitedItemIn("Cannabis")).toBe("Illegal drugs");
  });

  it("doesn't refuse ordinary goods that contain those letters", () => {
    for (const ok of [
      "Ankara fabric, 3 yards",
      "Check fabric (2 pieces)",
      "Cashew nuts, sealed",
      "Gunny sacks",
      "Fuel pump for Toyota Corolla",
      "Fuel filter and fuel tank cap",
      "Frozen fish, sealed",
    ]) {
      expect(prohibitedItemIn(ok), ok).toBeNull();
    }
    expect(prohibitedItemIn("Fuel, 2 jerrycans")).toMatch(/Fuel/);
  });
});
