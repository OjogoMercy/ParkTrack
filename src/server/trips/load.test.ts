import { describe, expect, it } from "vitest";
import { DriverLoad } from "@/contracts/dto";
import type { ParcelStatus } from "@/contracts/enums";
import { buildLoad, loadCount, parkLabel, type LoadTripRow } from "./load";

const T0 = new Date("2026-11-22T09:05:00Z");
const ogbomoso = {
  id: "p1",
  slug: "ogbomoso",
  name: "Ogbomoso Motor Park",
  city: "Ogbomoso",
};
const ibadan = {
  id: "p2",
  slug: "ibadan",
  name: "Iwo Road Park",
  city: "Ibadan",
};

let n = 0;
function parcel(
  code: string,
  opts: Partial<LoadTripRow["parcels"][number]["parcel"]> = {},
  assignedAt = T0,
): LoadTripRow["parcels"][number] {
  n++;
  return {
    assignedAt,
    assignedByName: "Bayo",
    parcel: {
      id: `parcel_${n}`,
      parcelCode: code,
      sizeClass: "M",
      category: "Clothing & fabric",
      recipientName: "Kemi Bakare",
      status: "ASSIGNED",
      deliveryMode: "PARK",
      roadsidePointId: null,
      podAmountKobo: 0,
      podPaidAt: null,
      ...opts,
    },
  };
}

function trip(
  parcels: LoadTripRow["parcels"],
  over: Partial<LoadTripRow> = {},
): LoadTripRow {
  return {
    id: "trip_1",
    status: "LOADING",
    vehiclePlate: "OYO 482 KJ",
    scheduledDepartureAt: null,
    acceptedAt: null,
    departedAt: null,
    originPark: ogbomoso,
    destinationPark: ibadan,
    route: {
      typicalMinutes: 120,
      roadsidePoints: [
        { id: "far", name: "Far stop", order: 2, minutesFromOrigin: 90 },
        {
          id: "owode",
          name: "Owode junction, Oyo",
          order: 1,
          minutesFromOrigin: 45,
        },
      ],
    },
    parcels,
    manifest: null,
    ...over,
  };
}

const roadside = (code: string, point: string, extra = {}) =>
  parcel(code, { deliveryMode: "ROADSIDE", roadsidePointId: point, ...extra });

describe("buildLoad", () => {
  it("is empty without a trip, or when nothing is left on it", () => {
    expect(buildLoad(null)).toEqual({ trip: null, stops: [], manifest: null });
    const back = trip([parcel("PT-7K3Q", { status: "RECEIVED_AT_ORIGIN" })]);
    expect(buildLoad(back).trip).toBeNull();
  });

  it("groups roadside stops in route order, then the arrival park (D01)", () => {
    const load = buildLoad(
      trip([
        parcel("PT-7K3Q"),
        roadside("PT-6Q2Z", "owode", {
          sizeClass: "S",
          podAmountKobo: 500_000,
        }),
        roadside("PT-4M8C", "owode", { podAmountKobo: 500_000, podPaidAt: T0 }),
        parcel("PT-8N5D", { sizeClass: "S" }),
        roadside("PT-9F2A", "far"),
      ]),
    );
    expect(DriverLoad.parse(load)).toEqual(load);
    expect(load.stops.map((s) => [s.kind, s.name, s.order])).toEqual([
      ["roadside", "Owode junction, Oyo", 1],
      ["roadside", "Far stop", 2],
      ["arrival", "Iwo Road Park, Ibadan", 3],
    ]);
    const owode = load.stops[0];
    expect(owode.parcels.map((p) => [p.parcelCode, p.duesPaid])).toEqual([
      ["PT-4M8C", true],
      ["PT-6Q2Z", false],
    ]);
    // Nothing to pay counts as paid.
    expect(load.stops[1].parcels[0].duesPaid).toBe(true);
    expect(load.stops[2].parcels.map((p) => p.parcelCode)).toEqual([
      "PT-7K3Q",
      "PT-8N5D",
    ]);
    expect(loadCount(load)).toBe(5);
  });

  it("skips stops with no parcels and leaves out reassigned ones", () => {
    const load = buildLoad(
      trip([
        parcel("PT-7K3Q"),
        roadside("PT-6Q2Z", "far", { status: "RECEIVED_AT_ORIGIN" }),
        parcel("PT-2W7E", { status: "CANCELLED" }),
      ]),
    );
    expect(load.stops.map((s) => s.kind)).toEqual(["arrival"]);
    expect(load.stops[0].order).toBe(1);
    expect(loadCount(load)).toBe(1);
  });

  it("puts a roadside parcel whose point isn't on the route at the arrival park", () => {
    const load = buildLoad(trip([roadside("PT-6Q2Z", "elsewhere")]));
    expect(load.stops).toHaveLength(1);
    expect(load.stops[0].kind).toBe("arrival");
  });

  it("names who assigned the load last, and when", () => {
    const later = new Date(T0.getTime() + 10 * 60_000);
    const p = parcel("PT-8N5D", {}, later);
    p.assignedByName = "Funmi";
    const load = buildLoad(trip([parcel("PT-7K3Q"), p]));
    expect(load.trip).toMatchObject({
      assignedByName: "Funmi",
      assignedAt: later.toISOString(),
      status: "LOADING",
      sharingLocation: false,
      vehiclePlate: "OYO 482 KJ",
    });
  });

  it("has no ETAs until the trip starts, then times each stop from departure", () => {
    const rows = [roadside("PT-6Q2Z", "owode"), parcel("PT-7K3Q")];
    expect(buildLoad(trip(rows)).stops.every((s) => s.etaAt === null)).toBe(
      true,
    );
    const accepted = new Date("2026-11-22T09:31:00Z");
    const load = buildLoad(
      trip(rows, { status: "IN_TRANSIT", acceptedAt: accepted }),
    );
    expect(load.stops.map((s) => s.etaAt)).toEqual([
      "2026-11-22T10:16:00.000Z",
      "2026-11-22T11:31:00.000Z",
    ]);
    expect(load.trip?.sharingLocation).toBe(true);
  });

  it("marks a roadside stop passed once every parcel there is handed over", () => {
    const status = (s: ParcelStatus) =>
      buildLoad(
        trip(
          [
            roadside("PT-6Q2Z", "owode", { status: s }),
            parcel("PT-7K3Q", { status: "IN_TRANSIT" }),
          ],
          { status: "IN_TRANSIT" },
        ),
      ).stops[0].passed;
    expect(status("IN_TRANSIT")).toBe(false);
    expect(status("DELIVERED_ROADSIDE")).toBe(true);
  });

  it("lists only parcels still on the bus on the manifest", () => {
    const load = buildLoad(
      trip(
        [
          parcel("PT-7K3Q", { status: "IN_TRANSIT" }),
          parcel("PT-8N5D", { status: "ARRIVED" }),
          roadside("PT-6Q2Z", "owode", { status: "IN_TRANSIT" }),
        ],
        { status: "IN_TRANSIT", manifest: { token: "mf_abc" } },
      ),
    );
    expect(load.manifest).toEqual({
      token: "mf_abc",
      destinationParkName: "Iwo Road Park, Ibadan",
      parcelCodes: ["PT-7K3Q"],
    });
  });
});

describe("parkLabel", () => {
  it("adds the city only when the name doesn't say it", () => {
    expect(parkLabel(ibadan)).toBe("Iwo Road Park, Ibadan");
    expect(parkLabel(ogbomoso)).toBe("Ogbomoso Motor Park");
  });
});
