/**
 * Parks (Scope 02). Replaces the Scope 01 stub; exported names are unchanged.
 *
 * Park data changes rarely, so each park is cached ("use cache", tagged
 * `park:{slug}`; Scope 09 calls revalidateTag(parkCacheTag(slug)) after an
 * admin edit). "Open now" depends on the clock, so it is worked out per
 * request, outside the cache.
 */
import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";
import type { ParkPublic, ParkRef } from "@/contracts/dto";
import type { SizeClass } from "@/contracts/enums";
import { db } from "@/lib/db";
import { openStatus, type OpeningHours } from "@/lib/dates";

export const STUB = false;

export const parkCacheTag = (slug: string) => `park:${slug}`;
export const PARKS_LIST_TAG = "parks:live";

/** Park data without the time-dependent fields. */
export type ParkRecord = Omit<ParkPublic, "openNow" | "closesAt">;

const SIZES: SizeClass[] = ["S", "M", "L"];

function toRef(p: {
  id: string;
  slug: string;
  name: string;
  city: string;
}): ParkRef {
  return { id: p.id, slug: p.slug, name: p.name, city: p.city };
}

function parseOpeningHours(value: unknown): OpeningHours {
  const out: OpeningHours = {};
  if (!value || typeof value !== "object") return out;
  for (const [day, v] of Object.entries(value as Record<string, unknown>)) {
    out[day] =
      Array.isArray(v) &&
      v.length === 2 &&
      v.every((x) => typeof x === "string")
        ? [v[0] as string, v[1] as string]
        : null;
  }
  return out;
}

async function loadParkRecord(slug: string): Promise<ParkRecord | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(parkCacheTag(slug));

  const park = await db.park.findFirst({
    where: { slug, status: "LIVE" },
    include: {
      routesFrom: {
        where: { active: true },
        include: {
          destinationPark: true,
          roadsidePoints: { orderBy: { order: "asc" } },
        },
        orderBy: { typicalMinutes: "asc" },
      },
      storageRates: { orderBy: { effectiveFrom: "desc" } },
    },
  });
  if (!park) return null;

  // Latest effective rate per size class.
  const dailyRateKobo = Object.fromEntries(
    SIZES.map((size) => [
      size,
      park.storageRates.find(
        (r) => r.sizeClass === size && r.effectiveFrom <= new Date(),
      )?.dailyRateKobo ?? 0,
    ]),
  ) as Record<SizeClass, number>;

  return {
    id: park.id,
    slug: park.slug,
    name: park.name,
    logoUrl: park.logoUrl,
    city: park.city,
    state: park.state,
    address: park.address,
    counterLocationText: park.counterLocationText,
    openingHours: parseOpeningHours(park.openingHours),
    storage: {
      windowHours: park.storageWindowHours,
      maxHoldDays: park.maxHoldDays,
      dropoffDeadlineHours: park.dropoffDeadlineHours,
      dailyRateKobo,
    },
    routes: park.routesFrom.map((r) => ({
      id: r.id,
      destination: toRef(r.destinationPark),
      typicalMinutes: r.typicalMinutes,
      fareKobo: { S: r.fareSmallKobo, M: r.fareMediumKobo, L: r.fareLargeKobo },
      roadsidePoints: r.roadsidePoints.map((p) => ({
        id: p.id,
        name: p.name,
        order: p.order,
        minutesFromOrigin: p.minutesFromOrigin,
        lat: p.lat,
        lng: p.lng,
      })),
    })),
  };
}

/** Adds the time-dependent fields (Lagos time). */
export function withOpenStatus(
  record: ParkRecord,
  now: Date = new Date(),
): ParkPublic {
  const { open, closesAt } = openStatus(record.openingHours, now);
  return { ...record, openNow: open, closesAt };
}

/**
 * A live park by slug (cached, no clock-dependent fields), or null.
 * Use this in pages and layouts: it keeps them prerenderable and instant.
 * Show "open now" with a request-time or client component instead.
 */
export async function getPark(slug: string): Promise<ParkRecord | null> {
  return loadParkRecord(slug);
}

/**
 * A live park with "open now" worked out for this request, or null.
 * For API responses (GET /api/park); pages should use getPark().
 */
export async function getParkPublic(slug: string): Promise<ParkPublic | null> {
  const record = await loadParkRecord(slug);
  if (!record) return null;
  // "Open now" reads the clock, so it must run per request, never at prerender.
  await connection();
  return withOpenStatus(record);
}

/** Live parks, listed on the home page to pick a park from (Q45). */
export async function listLiveParks(): Promise<ParkRef[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(PARKS_LIST_TAG);
  const parks = await db.park.findMany({
    where: { status: "LIVE" },
    orderBy: { name: "asc" },
    select: { id: true, slug: true, name: true, city: true },
  });
  return parks.map(toRef);
}

/**
 * A park by slug whatever its status, for the "park not found" page to tell
 * "no such park" apart from "this park isn't taking parcels right now"
 * (ONBOARDING or SUSPENDED). Null when no park has that slug. Request-time
 * and rare, so not cached.
 */
export async function parkStatusBySlug(slug: string): Promise<{
  name: string;
  status: "LIVE" | "ONBOARDING" | "SUSPENDED";
} | null> {
  return db.park.findUnique({
    where: { slug },
    select: { name: true, status: true },
  });
}

/** Park whose counter poster QR carries this token (PARK-4). */
export async function getParkByCounterToken(
  token: string,
): Promise<ParkRef | null> {
  const park = await db.park.findUnique({
    where: { collectionQrToken: token },
    select: { id: true, slug: true, name: true, city: true, status: true },
  });
  return park && park.status === "LIVE" ? toRef(park) : null;
}

/** "Iwo Road Park" in Ibadan → "Iwo Road Park, Ibadan"; names that already say the city stay as they are. */
export function parkDisplayName(park: Pick<ParkRef, "name" | "city">): string {
  return park.name.toLowerCase().includes(park.city.toLowerCase())
    ? park.name
    : `${park.name}, ${park.city}`;
}
