import { describe, expect, it } from "vitest";
import type { ParcelDetail } from "@/contracts/dto";
import { journeySteps, stepTime } from "./steps";

const NOW = new Date("2026-11-22T15:00:00Z"); // Sun 4:00 PM in Lagos

const base: ParcelDetail = {
  id: "p1",
  parcelCode: "PT-7K3Q",
  status: "AWAITING_DROPOFF",
  deliveryMode: "PARK",
  recipientName: "Kemi Bakare",
  senderName: "Tolu Adeyemi",
  originPark: {
    id: "o",
    slug: "ogbomoso",
    name: "Ogbomoso Motor Park",
    city: "Ogbomoso",
  },
  destinationPark: {
    id: "d",
    slug: "ibadan",
    name: "Iwo Road Park",
    city: "Ibadan",
  },
  roadsidePointName: null,
  sizeClass: "M",
  category: "Clothing & fabric",
  podAmountKobo: 0,
  totalKobo: 265_000,
  bay: null,
  etaMinutes: null,
  dropoffDeadline: null,
  createdAt: "2026-11-20T15:12:00Z",
  updatedAt: "2026-11-20T15:12:00Z",
  description: "Ankara fabric",
  declaredValueKobo: 4_500_000,
  sender: { name: "Tolu Adeyemi" },
  recipient: { name: "Kemi Bakare" },
  roadsidePoint: null,
  driver: null,
  timeline: [
    {
      type: "PAID",
      title: "Booked and paid",
      sub: null,
      at: "2026-11-20T15:12:00Z",
      photoUrl: null,
    },
  ],
  payments: [],
  dropoffPhotoUrl: null,
  releasePhotoUrl: null,
  collected: null,
  storageDueKobo: 0,
  freeUntil: null,
  live: null,
  cancellable: true,
  settlement: null,
};

const titles = (p: ParcelDetail) =>
  journeySteps(p, NOW).map((s) => `${s.state}:${s.title}`);

describe("journeySteps", () => {
  it("S09: booked, drop off now, then the road and collection", () => {
    expect(titles(base)).toEqual([
      "done:Booked and paid",
      "now:Drop off at Ogbomoso Motor Park",
      "todo:On the road to Ibadan",
      "todo:Ready at Iwo Road Park",
      "todo:Collected by Kemi",
    ]);
    expect(journeySteps(base, NOW)[0].meta).toBe("Fri 4:12 PM");
  });

  it("S10 roadside: on the road now, handover next, with the 20-minute alert", () => {
    const p: ParcelDetail = {
      ...base,
      status: "IN_TRANSIT",
      deliveryMode: "ROADSIDE",
      recipientName: "Dayo Alabi",
      roadsidePoint: {
        id: "r",
        name: "Owode junction",
        order: 1,
        minutesFromOrigin: 45,
        lat: 8,
        lng: 4,
      },
    };
    const steps = journeySteps(p, NOW);
    expect(steps.map((s) => `${s.state}:${s.title}`)).toEqual([
      "done:Booked and paid",
      "now:On the road",
      "todo:Handover at Owode junction",
    ]);
    expect(steps[1].sub).toBe(
      "Dayo is alerted 20 minutes before the bus reaches Owode junction",
    );
  });

  it("names the driver while waiting for the load to be accepted", () => {
    const p: ParcelDetail = {
      ...base,
      status: "ASSIGNED",
      driver: {
        userId: "u",
        name: "Musa Ibrahim",
        vehiclePlate: "OYO 482 KJ",
        usesApp: true,
        verified: true,
      },
    };
    expect(titles(p)[1]).toBe("now:Waiting for Musa to accept the load");
  });

  it("shows only what happened once the journey is over", () => {
    expect(titles({ ...base, status: "COLLECTED" })).toEqual([
      "done:Booked and paid",
    ]);
  });
});

describe("stepTime", () => {
  it("shows the time today, and the weekday before", () => {
    expect(stepTime("2026-11-22T08:14:00Z", NOW)).toBe("9:14 AM");
    expect(stepTime("2026-11-20T15:12:00Z", NOW)).toBe("Fri 4:12 PM");
  });
});
