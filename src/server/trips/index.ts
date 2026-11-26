/**
 * Trips (Scope 07): the driver's load, accepting it, location and the demo
 * trip player. Replaces the Scope 01 stub; exported names are unchanged.
 * acceptLoad, recordLocation and simulate are still the stub until their
 * slices (sl2, sl4) land.
 */
import "server-only";
import type { DriverLoad } from "@/contracts/dto";
import { db } from "@/lib/db";
import { driverLoad, MANIFEST_TOKEN } from "@/mocks/fixtures";
import { stub } from "@/mocks/stub";
import { buildLoad, type LoadTripRow } from "./load";

export const STUB = false;

const PARK = { select: { id: true, slug: true, name: true, city: true } };

/**
 * D01/D02/D05: the driver's current load in route order. The current trip
 * is the one on the road, else the newest one being loaded; a trip whose
 * parcels were all moved back to the counter doesn't count.
 */
export async function driverLoadFor(driverId: string): Promise<DriverLoad> {
  const trips = await db.trip.findMany({
    where: { driverId, status: { in: ["LOADING", "IN_TRANSIT"] } },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      status: true,
      vehiclePlate: true,
      scheduledDepartureAt: true,
      acceptedAt: true,
      departedAt: true,
      destinationParkId: true,
      originPark: PARK,
      destinationPark: PARK,
      route: {
        select: {
          typicalMinutes: true,
          roadsidePoints: {
            select: {
              id: true,
              name: true,
              order: true,
              minutesFromOrigin: true,
            },
          },
        },
      },
      parcels: {
        select: {
          assignedAt: true,
          assignedBy: { select: { name: true } },
          parcel: {
            select: {
              id: true,
              parcelCode: true,
              sizeClass: true,
              category: true,
              recipientName: true,
              status: true,
              deliveryMode: true,
              roadsidePointId: true,
              podAmountKobo: true,
              podPaidAt: true,
            },
          },
        },
      },
      manifests: { select: { token: true, destinationParkId: true } },
    },
  });
  // On the road first, then the newest being loaded.
  trips.sort(
    (a, b) =>
      Number(b.status === "IN_TRANSIT") - Number(a.status === "IN_TRANSIT"),
  );
  for (const t of trips) {
    const row: LoadTripRow = {
      ...t,
      parcels: t.parcels.map((p) => ({
        assignedAt: p.assignedAt,
        assignedByName: firstName(p.assignedBy.name ?? "the counter"),
        parcel: p.parcel,
      })),
      manifest:
        t.manifests.find((m) => m.destinationParkId === t.destinationParkId) ??
        null,
    };
    const load = buildLoad(row);
    if (load.trip) return load;
  }
  return buildLoad(null);
}

/** "Bayo Kareem" → "Bayo", as the designs name agents to drivers. */
function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

/** Accept load: all ASSIGNED → IN_TRANSIT, manifests created (DRV-4). */
export async function acceptLoad(
  tripId: string,
  driverId: string,
): Promise<DriverLoad> {
  void tripId;
  void driverId;
  return stub({
    ...driverLoad,
    trip: driverLoad.trip && {
      ...driverLoad.trip,
      status: "IN_TRANSIT",
      acceptedAt: "2026-11-22T09:31:00+00:00",
      sharingLocation: true,
    },
    manifest: {
      token: MANIFEST_TOKEN,
      destinationParkName: "Iwo Road Park, Ibadan",
      parcelCodes: ["PT-7K3Q", "PT-8N5D"],
    },
  });
}

/** Location point while the driver app is open (DRV-7). */
export async function recordLocation(
  tripId: string,
  point: { lat: number; lng: number; recordedAt?: Date },
): Promise<void> {
  void tripId;
  void point;
}

/** Demo only: plays the trip along the route and fires approach alerts. */
export async function simulate(tripId: string, speed = 60): Promise<void> {
  void tripId;
  void speed;
}
