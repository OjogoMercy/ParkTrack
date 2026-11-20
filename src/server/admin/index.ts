/**
 * STUB (Scope 01) — owned by Scope 09 (docs/scopes/09-admin-jobs-launch.md).
 * Exported names and types are FINAL. Scope 09 replaces the bodies;
 * callers never change. Until then everything returns fixture data.
 */
import type {
  BySize,
  ParkOverview,
  ParkPublic,
  ParkRef,
  RouteSummary,
} from "@/contracts/dto";
import { ibadan, parkOgbomoso, parkOverview } from "@/mocks/fixtures";
import { stub } from "@/mocks/stub";

export const STUB = true;

/** P01 park overview. */
export async function parkOverviewFor(
  parkId: string,
  range: "today" | "7d" | "30d" = "today",
): Promise<ParkOverview> {
  void parkId;
  void range;
  return stub(parkOverview);
}

/** P05 add or edit a route with fares and roadside points. */
export async function upsertRoute(
  parkId: string,
  input: {
    routeId?: string;
    destinationParkId: string;
    typicalMinutes: number;
    fareKobo: BySize;
    roadsidePoints: {
      name: string;
      lat: number;
      lng: number;
      minutesFromOrigin: number;
    }[];
    active: boolean;
  },
): Promise<RouteSummary> {
  void parkId;
  void input;
  return stub(parkOgbomoso.routes[0]);
}

/** P05 storage rules. */
export async function updateStorageRules(
  parkId: string,
  input: ParkPublic["storage"] & { windowHours: number },
): Promise<ParkPublic["storage"]> {
  void parkId;
  return stub(input);
}

/** P04 invite an agent or driver (AUTH-6). */
export async function inviteStaff(
  parkId: string,
  input: {
    phone: string;
    role: "AGENT" | "DRIVER";
    driver?: { vehiclePlate: string; vehicleType: string; usesApp: boolean };
  },
  invitedById: string,
): Promise<void> {
  void parkId;
  void input;
  void invitedById;
}

/** P07 onboard a new park. */
export async function createPark(input: {
  slug: string;
  name: string;
  city: string;
  state: string;
  address: string;
}): Promise<ParkRef> {
  return stub({ ...ibadan, id: `park_${input.slug}`, ...input });
}
