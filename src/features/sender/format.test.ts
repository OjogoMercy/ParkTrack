import { describe, expect, it } from "vitest";
import {
  destinationLabel,
  formatJourney,
  parcelRowDetail,
  parcelRowHref,
} from "./format";

describe("sender formatting", () => {
  it("journey times", () => {
    expect(formatJourney(90)).toBe("1h 30m");
    expect(formatJourney(270)).toBe("4h 30m");
    expect(formatJourney(540)).toBe("9h");
    expect(formatJourney(45)).toBe("45m");
  });
  it("destinations: city first unless the name already starts with it", () => {
    expect(destinationLabel({ city: "Ibadan", name: "Iwo Road Park" })).toBe(
      "Ibadan · Iwo Road Park",
    );
    expect(
      destinationLabel({ city: "Ogbomoso", name: "Ogbomoso Motor Park" }),
    ).toBe("Ogbomoso Motor Park");
  });
});

describe("S08 rows", () => {
  const fmt = {
    day: (d: Date) => `day(${d.toISOString().slice(0, 10)})`,
    dayTime: (d: Date) => `dt(${d.toISOString().slice(0, 16)})`,
  };
  type Row = Parameters<typeof parcelRowDetail>[0];
  const base: Omit<Row, "status"> = {
    parcelCode: "PT-7K3Q",
    deliveryMode: "PARK",
    originPark: { city: "Ogbomoso" },
    destinationPark: { name: "Iwo Road Park" },
    roadsidePointName: null,
    bay: null,
    etaMinutes: null,
    dropoffDeadline: null,
    createdAt: "2026-11-25T08:00:00Z",
    updatedAt: "2026-11-25T08:00:00Z",
  };
  const now = new Date("2026-11-25T10:00:00Z");
  const row = (over: Partial<Row> & { status: string }) =>
    parcelRowDetail({ ...base, ...over }, fmt, now);

  it("says what matters for each state", () => {
    expect(row({ status: "DRAFT" })).toBe("Not paid · pay within 22h");
    expect(row({ status: "DRAFT", createdAt: "2026-11-24T09:00:00Z" })).toBe(
      "Not paid · expired",
    );
    expect(
      row({
        status: "AWAITING_DROPOFF",
        dropoffDeadline: "2026-11-27T17:00:00Z",
      }),
    ).toBe("Drop off by dt(2026-11-27T17:00)");
    expect(
      row({
        status: "IN_TRANSIT",
        deliveryMode: "ROADSIDE",
        roadsidePointName: "Owode junction",
        etaMinutes: 70,
      }),
    ).toBe("Owode junction · ~1h 10m");
    expect(row({ status: "ARRIVED", bay: "C4" })).toBe(
      "Iwo Road Park · bay C4",
    );
    expect(row({ status: "COLLECTED" })).toBe("Collected day(2026-11-25)");
    expect(row({ status: "SETTLED", deliveryMode: "ROADSIDE" })).toBe(
      "Roadside · day(2026-11-25)",
    );
  });

  it("links to pay, the QR, or the parcel page", () => {
    expect(parcelRowHref({ parcelCode: "PT-7K3Q", status: "DRAFT" })).toBe(
      "/send/review?parcel=PT-7K3Q",
    );
    expect(
      parcelRowHref({ parcelCode: "PT-7K3Q", status: "AWAITING_DROPOFF" }),
    ).toBe("/parcels/booked/PT-7K3Q");
    expect(parcelRowHref({ parcelCode: "PT-7K3Q", status: "IN_TRANSIT" })).toBe(
      "/parcels/PT-7K3Q",
    );
  });
});

describe("S08 rows for bookings made at another park", () => {
  const where = {
    currentSlug: "ogbomoso",
    site: (slug: string, path: string) => `https://${slug}.parktrack.ng${path}`,
  };
  it("pay and the QR open on the park the booking was made at", () => {
    const other = { parcelCode: "PT-7K3Q", originPark: { slug: "ibadan" } };
    expect(parcelRowHref({ ...other, status: "DRAFT" }, where)).toBe(
      "https://ibadan.parktrack.ng/send/review?parcel=PT-7K3Q",
    );
    expect(parcelRowHref({ ...other, status: "AWAITING_DROPOFF" }, where)).toBe(
      "https://ibadan.parktrack.ng/parcels/booked/PT-7K3Q",
    );
    const here = { parcelCode: "PT-7K3Q", originPark: { slug: "ogbomoso" } };
    expect(parcelRowHref({ ...here, status: "DRAFT" }, where)).toBe(
      "/send/review?parcel=PT-7K3Q",
    );
  });
});
