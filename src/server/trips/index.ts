/**
 * STUB (Scope 01) — owned by Scope 07 (docs/scopes/07-driver-tracking.md).
 * Exported names and types are FINAL. Scope 07 replaces the bodies;
 * callers never change. Until then everything returns fixture data.
 */
import type { DriverLoad } from "@/contracts/dto";
import { driverLoad, MANIFEST_TOKEN } from "@/mocks/fixtures";
import { stub } from "@/mocks/stub";

export const STUB = true;

/** D01/D02/D05: the driver's current load in route order. */
export async function driverLoadFor(driverId: string): Promise<DriverLoad> {
  void driverId;
  return stub(driverLoad);
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
