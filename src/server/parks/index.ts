/**
 * STUB (Scope 01) — owned by Scope 02 (docs/scopes/02-parks-identity.md).
 * Exported names and types are FINAL. Scope 02 replaces the bodies;
 * callers never change. Until then everything returns fixture data.
 */
import type { ParkPublic, ParkRef } from "@/contracts/dto";
import { ibadan, ogbomoso, parkOgbomoso } from "@/mocks/fixtures";
import { stub } from "@/mocks/stub";

export const STUB = true;

/** Park resolved from the request host (subdomain), or null if unknown. */
export async function currentPark(): Promise<ParkPublic | null> {
  return stub(parkOgbomoso);
}

export async function getParkPublic(slug: string): Promise<ParkPublic | null> {
  return slug === "ogbomoso" ? stub(parkOgbomoso) : null;
}

/** Live parks, listed on the "park not found" page (S13). */
export async function listLiveParks(): Promise<ParkRef[]> {
  return stub([ogbomoso, ibadan]);
}

/** Park whose counter poster QR carries this token (PARK-4). */
export async function getParkByCounterToken(
  token: string,
): Promise<ParkRef | null> {
  void token;
  return stub(ibadan);
}
