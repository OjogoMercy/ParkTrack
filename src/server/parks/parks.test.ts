import { describe, expect, it } from "vitest";
import { GetPark } from "@/contracts/api";
import { parkOgbomoso } from "@/mocks/fixtures";
import { parkDisplayName, withOpenStatus, type ParkRecord } from "./index";

// Fixture minus the time-dependent fields = what the cached loader returns.
const { openNow: _o, closesAt: _c, ...record } = parkOgbomoso;
void _o;
void _c;
const ogbomoso: ParkRecord = record;

describe("withOpenStatus (Lagos time)", () => {
  it("is open during hours and gives the closing time", () => {
    // Fri 20 Nov 2026, 10:00 in Lagos (09:00 UTC); hours 06:00–19:00.
    const park = withOpenStatus(ogbomoso, new Date("2026-11-20T09:00:00Z"));
    expect(park.openNow).toBe(true);
    expect(park.closesAt).toBe("19:00");
  });

  it("is closed after hours and on closed days", () => {
    expect(
      withOpenStatus(ogbomoso, new Date("2026-11-20T18:30:00Z")).openNow,
    ).toBe(false); // 19:30
    const noSunday = {
      ...ogbomoso,
      openingHours: { ...ogbomoso.openingHours, sun: null },
    };
    const sunday = withOpenStatus(noSunday, new Date("2026-11-22T10:00:00Z"));
    expect(sunday).toMatchObject({ openNow: false, closesAt: null });
  });

  it("produces a valid GET /api/park response", () => {
    const park = withOpenStatus(ogbomoso, new Date("2026-11-20T09:00:00Z"));
    expect(GetPark.response.safeParse(park).success).toBe(true);
  });
});

describe("parkDisplayName", () => {
  it("adds the city only when the name doesn't already say it", () => {
    expect(parkDisplayName({ name: "Iwo Road Park", city: "Ibadan" })).toBe(
      "Iwo Road Park, Ibadan",
    );
    expect(
      parkDisplayName({ name: "Ogbomoso Motor Park", city: "Ogbomoso" }),
    ).toBe("Ogbomoso Motor Park");
  });
});
