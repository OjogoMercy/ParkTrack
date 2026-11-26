/**
 * Trips (Scope 07): the driver's load, accepting it, location and the demo
 * trip player. Replaces the Scope 01 stub; exported names are unchanged.
 * recordLocation and simulate are still the stub until sl4.
 */
import "server-only";
import type { DriverLoad } from "@/contracts/dto";
import { db } from "@/lib/db";
import { manifestToken } from "@/lib/ids";
import { ParcelError, transition } from "@/server/parcels";
import { TripError } from "./errors";
import { buildLoad, type LoadTripRow } from "./load";

export { TripError } from "./errors";

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

/**
 * Accept load (DRV-4): the driver becomes the holder. The trip goes on the
 * road, the arrival park's manifest (one QR for everything on the bus) is
 * created, and every ASSIGNED parcel moves to IN_TRANSIT through
 * transition(), which records the event and sends load_accepted to the
 * sender, recipient and origin agent.
 *
 * Safe to repeat: accepting a trip already on the road moves any parcel
 * still ASSIGNED (e.g. after a failure part-way), and a parcel moved back
 * to the counter meanwhile is skipped. Throws TripError.
 */
export async function acceptLoad(
  tripId: string,
  driverId: string,
): Promise<DriverLoad> {
  const trip = await db.trip.findUnique({
    where: { id: tripId },
    select: { driverId: true, status: true, destinationParkId: true },
  });
  if (!trip) {
    throw new TripError(
      "trip_not_found",
      "This load isn’t there any more.",
      404,
    );
  }
  if (trip.driverId !== driverId) {
    throw new TripError(
      "not_your_trip",
      "This load is assigned to another driver.",
      403,
    );
  }
  if (trip.status !== "LOADING" && trip.status !== "IN_TRANSIT") {
    throw new TripError("trip_closed", "This trip has already ended.", 409);
  }
  const assigned = await db.tripParcel.findMany({
    where: { tripId, parcel: { status: "ASSIGNED" } },
    select: { parcelId: true },
  });
  if (trip.status === "LOADING" && assigned.length === 0) {
    throw new TripError(
      "nothing_to_accept",
      "There’s nothing on this load any more. Check with the counter.",
      409,
    );
  }

  await db.$transaction(async (tx) => {
    // Only the first accept starts the trip (a double tap changes nothing).
    await tx.trip.updateMany({
      where: { id: tripId, status: "LOADING" },
      data: { status: "IN_TRANSIT", acceptedAt: new Date() },
    });
    await tx.manifest.upsert({
      where: {
        tripId_destinationParkId: {
          tripId,
          destinationParkId: trip.destinationParkId,
        },
      },
      create: {
        tripId,
        destinationParkId: trip.destinationParkId,
        token: manifestToken(),
      },
      update: {},
    });
  });

  for (const { parcelId } of assigned) {
    try {
      await transition(parcelId, "IN_TRANSIT", {
        actor: "DRIVER",
        userId: driverId,
      });
    } catch (e) {
      // Moved back to the counter, or another accept got there first.
      if (
        e instanceof ParcelError &&
        (e.code === "transition_not_allowed" || e.code === "status_changed")
      ) {
        continue;
      }
      throw e;
    }
  }
  return driverLoadFor(driverId);
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
