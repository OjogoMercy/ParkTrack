import { describe, expect, it } from "vitest";
import {
  isApproaching,
  parcelEta,
  shortPark,
  stopTime,
  timelineTitle,
  type JourneyInput,
} from "./journey";

const START = new Date("2026-11-22T15:05:00Z");
const at = (mins: number) => new Date(START.getTime() + mins * 60_000);

const roadside: JourneyInput = {
  status: "IN_TRANSIT",
  deliveryMode: "ROADSIDE",
  roadsideMinutes: 95,
  typicalMinutes: 150,
  startedAt: START,
  now: at(0),
};

describe("parcelEta", () => {
  it("times a roadside parcel to its point, a park parcel to the park", () => {
    expect(parcelEta(roadside)).toEqual({
      minutes: 95,
      at: at(95).toISOString(),
    });
    expect(
      parcelEta({ ...roadside, deliveryMode: "PARK", roadsideMinutes: null }),
    ).toEqual({ minutes: 150, at: at(150).toISOString() });
  });

  it("counts down, and a late bus is due now rather than negative", () => {
    expect(parcelEta({ ...roadside, now: at(80) })?.minutes).toBe(15);
    expect(parcelEta({ ...roadside, now: at(120) })?.minutes).toBe(0);
  });

  it("has no ETA before the trip starts or once it's off the bus", () => {
    expect(parcelEta({ ...roadside, startedAt: null })).toBeNull();
    expect(parcelEta({ ...roadside, status: "ASSIGNED" })).toBeNull();
    expect(parcelEta({ ...roadside, status: "DELIVERED_ROADSIDE" })).toBeNull();
  });
});

describe("isApproaching (RD-2)", () => {
  it("is true within 20 minutes of a roadside stop only", () => {
    expect(isApproaching({ ...roadside, now: at(74) })).toBe(false);
    expect(isApproaching({ ...roadside, now: at(75) })).toBe(true);
    expect(
      isApproaching({
        ...roadside,
        deliveryMode: "PARK",
        roadsideMinutes: null,
        now: at(149),
      }),
    ).toBe(false);
  });
});

describe("stopTime", () => {
  it("is null before departure", () => {
    expect(stopTime(null, 30)).toBeNull();
    expect(stopTime(START, 30)).toBe(at(30).toISOString());
  });
});

describe("timelineTitle", () => {
  const ctx = {
    originName: "Ogbomoso Motor Park",
    destinationName: "Iwo Road Park",
    roadsidePointName: "Owode junction",
    recipientName: "Dayo Alabi",
    driverName: "Musa Ibrahim",
    actorName: "Bayo Kareem",
  };

  it("uses the designs' wording", () => {
    expect(timelineTitle("PAID", "AWAITING_DROPOFF", ctx)?.title).toBe(
      "Booked and paid",
    );
    expect(timelineTitle("DROPOFF", "RECEIVED_AT_ORIGIN", ctx)).toEqual({
      title: "Dropped off at Ogbomoso",
      sub: "Checked in by Bayo · photo taken",
    });
    expect(timelineTitle("ACCEPT", "IN_TRANSIT", ctx)?.title).toBe(
      "Load accepted by Musa",
    );
    expect(
      timelineTitle("ROADSIDE_DELIVERED", "DELIVERED_ROADSIDE", ctx)?.title,
    ).toBe("Handed over at Owode junction");
    expect(timelineTitle("TICK_OFF", "ARRIVED", ctx)?.title).toBe(
      "Ready at Iwo Road Park",
    );
  });

  it("hides internal events", () => {
    expect(timelineTitle("CREATED", "DRAFT", ctx)).toBeNull();
    expect(timelineTitle("NOTE", "IN_TRANSIT", ctx)).toBeNull();
    expect(timelineTitle("COLLECTION_CODE_ISSUED", "ARRIVED", ctx)).toBeNull();
    expect(timelineTitle("TICK_OFF", "DISPUTED", ctx)).toBeNull();
  });
});

describe("shortPark", () => {
  it("drops 'Park' and 'Motor Park'", () => {
    expect(shortPark("Ogbomoso Motor Park")).toBe("Ogbomoso");
    expect(shortPark("Iwo Road Park")).toBe("Iwo Road");
    expect(shortPark("Ojota")).toBe("Ojota");
  });
});
