import { Suspense } from "react";
import { connection } from "next/server";
import { listLiveParks, parkDisplayName } from "@/server/parks";
import { parkAddressLabel, parkPath } from "@/server/parks/host";
import { ParkSearchList } from "./park-search-list";

/**
 * Every live park with "Search parks by city", each linking to its page
 * (parktrack.ng/parks/{slug}). Since everything is on one domain (Q45), this
 * is how people pick the park they send from: on the home page, and when a
 * park address doesn't lead anywhere.
 */
export function ParkFinder() {
  return (
    <Suspense fallback={<ParkFinderSkeleton />}>
      <ParkFinderList />
    </Suspense>
  );
}

async function ParkFinderList() {
  // Request-time, so the build never runs the database query (CI has no
  // DATABASE_URL); listLiveParks() itself is cached.
  await connection();
  const root = process.env.ROOT_DOMAIN || "localhost:3000";
  const parks = await listLiveParks();
  return (
    <ParkSearchList
      parks={parks.map((p) => ({
        slug: p.slug,
        displayName: parkDisplayName(p),
        city: p.city,
        addressLabel: parkAddressLabel(p.slug, root),
        href: parkPath(p.slug),
      }))}
    />
  );
}

function ParkFinderSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      <div className="h-11 w-full rounded-control bg-sunken" />
      <div className="h-40 w-full rounded-card bg-sunken" />
    </div>
  );
}
