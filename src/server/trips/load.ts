import type { DriverLoad, LoadParcel, LoadStop } from "@/contracts/dto";
import type {
  DeliveryMode,
  ParcelStatus,
  SizeClass,
  TripStatus,
} from "@/contracts/enums";

/**
 * Pure part of the driver's load (D01, D02, D05): groups the trip's parcels
 * by stop in route order — roadside points by their `order` along the
 * route, then the arrival park — and works out each stop's ETA from the
 * route timing. No database, so it is unit-tested on its own.
 */

/** Trip parcels that are no longer the driver's to carry or show. */
const OFF_THE_LOAD: ParcelStatus[] = [
  "DRAFT",
  "AWAITING_DROPOFF",
  "RECEIVED_AT_ORIGIN", // reassigned back to the counter (06 A07)
  "CANCELLED",
];

type Park = { id: string; slug: string; name: string; city: string };

export type LoadTripRow = {
  id: string;
  status: TripStatus;
  vehiclePlate: string;
  scheduledDepartureAt: Date | null;
  acceptedAt: Date | null;
  departedAt: Date | null;
  originPark: Park;
  destinationPark: Park;
  route: {
    typicalMinutes: number;
    roadsidePoints: {
      id: string;
      name: string;
      order: number;
      minutesFromOrigin: number;
    }[];
  };
  parcels: {
    assignedAt: Date;
    assignedByName: string;
    parcel: {
      id: string;
      parcelCode: string;
      sizeClass: SizeClass;
      category: string;
      recipientName: string;
      status: ParcelStatus;
      deliveryMode: DeliveryMode;
      roadsidePointId: string | null;
      podAmountKobo: number;
      podPaidAt: Date | null;
    };
  }[];
  manifest: { token: string } | null;
};

/** Statuses that mean a roadside parcel has left the bus at its stop. */
const HANDED_OVER: ParcelStatus[] = ["DELIVERED_ROADSIDE", "SETTLED"];
/** Statuses that mean a parcel has reached the arrival park. */
const AT_ARRIVAL_PARK: ParcelStatus[] = [
  "ARRIVED",
  "COLLECTED",
  "SETTLED",
  "UNCLAIMED",
  "RETURNED",
];

/** Parcels still on the bus for the arrival park (the manifest list). */
const ON_BOARD: ParcelStatus[] = ["ASSIGNED", "IN_TRANSIT"];

/**
 * Builds the DriverLoad for one trip. `trip` null (or a trip with nothing
 * left to carry) is "no load yet".
 */
export function buildLoad(trip: LoadTripRow | null): DriverLoad {
  const rows = (trip?.parcels ?? []).filter(
    (p) => !OFF_THE_LOAD.includes(p.parcel.status),
  );
  if (!trip || rows.length === 0) {
    return { trip: null, stops: [], manifest: null };
  }

  // The last assignment is when the load took its current shape.
  const last = rows.reduce((a, b) => (b.assignedAt > a.assignedAt ? b : a));
  const startedAt = trip.departedAt ?? trip.acceptedAt;
  const eta = (minutes: number) =>
    startedAt
      ? new Date(startedAt.getTime() + minutes * 60_000).toISOString()
      : null;

  const toParcel = (
    p: LoadTripRow["parcels"][number]["parcel"],
  ): LoadParcel => ({
    parcelId: p.id,
    parcelCode: p.parcelCode,
    sizeClass: p.sizeClass,
    category: p.category,
    recipientName: p.recipientName,
    status: p.status,
    duesPaid: p.podAmountKobo === 0 || p.podPaidAt !== null,
  });
  const byCode = (a: LoadParcel, b: LoadParcel) =>
    a.parcelCode.localeCompare(b.parcelCode);

  const points = [...trip.route.roadsidePoints].sort(
    (a, b) => a.order - b.order,
  );
  const stops: LoadStop[] = [];
  for (const point of points) {
    const parcels = rows
      .filter(
        (r) =>
          r.parcel.deliveryMode === "ROADSIDE" &&
          r.parcel.roadsidePointId === point.id,
      )
      .map((r) => toParcel(r.parcel))
      .sort(byCode);
    if (!parcels.length) continue;
    stops.push({
      kind: "roadside",
      name: point.name,
      order: stops.length + 1,
      roadsidePointId: point.id,
      parkId: null,
      etaAt: eta(point.minutesFromOrigin),
      passed: parcels.every((p) => HANDED_OVER.includes(p.status)),
      parcels,
    });
  }

  // Park parcels, plus any roadside parcel whose point isn't on this route
  // (it can only be dropped at the arrival park).
  const placed = new Set(
    stops.flatMap((s) => s.parcels.map((p) => p.parcelId)),
  );
  const arrival = rows
    .filter((r) => !placed.has(r.parcel.id))
    .map((r) => toParcel(r.parcel))
    .sort(byCode);
  if (arrival.length) {
    stops.push({
      kind: "arrival",
      name: parkLabel(trip.destinationPark),
      order: stops.length + 1,
      roadsidePointId: null,
      parkId: trip.destinationPark.id,
      etaAt: eta(trip.route.typicalMinutes),
      passed:
        trip.status === "ARRIVED" ||
        trip.status === "CLOSED" ||
        arrival.every((p) => AT_ARRIVAL_PARK.includes(p.status)),
      parcels: arrival,
    });
  }

  const manifest =
    trip.manifest && arrival.length
      ? {
          token: trip.manifest.token,
          destinationParkName: parkLabel(trip.destinationPark),
          parcelCodes: arrival
            .filter((p) => ON_BOARD.includes(p.status))
            .map((p) => p.parcelCode),
        }
      : null;

  return {
    trip: {
      id: trip.id,
      status: trip.status,
      vehiclePlate: trip.vehiclePlate,
      origin: parkRef(trip.originPark),
      destination: parkRef(trip.destinationPark),
      assignedByName: last.assignedByName,
      assignedAt: last.assignedAt.toISOString(),
      scheduledDepartureAt: trip.scheduledDepartureAt?.toISOString() ?? null,
      acceptedAt: trip.acceptedAt?.toISOString() ?? null,
      departedAt: trip.departedAt?.toISOString() ?? null,
      // Location is shared while the app is open on an accepted trip.
      sharingLocation: trip.status === "IN_TRANSIT",
    },
    stops,
    manifest,
  };
}

/**
 * "Iwo Road Park, Ibadan": the park name, with the city if it isn't in it.
 * Same rule as parkDisplayName in @/server/parks, kept here so this file
 * stays free of request and cache APIs.
 */
export function parkLabel(park: { name: string; city: string }): string {
  return park.name.toLowerCase().includes(park.city.toLowerCase())
    ? park.name
    : `${park.name}, ${park.city}`;
}

function parkRef(p: Park) {
  return { id: p.id, slug: p.slug, name: p.name, city: p.city };
}

/** Number of parcels the driver is carrying (or about to accept). */
export function loadCount(load: DriverLoad): number {
  return load.stops.reduce((n, s) => n + s.parcels.length, 0);
}
