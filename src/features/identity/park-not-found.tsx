import { Suspense } from "react";
import { headers } from "next/headers";
import { Clock, Search } from "lucide-react";
import { MobileShell, TopBar } from "@/components/ui/shells";
import { Tile } from "@/components/ui/surface";
import {
  listLiveParks,
  parkDisplayName,
  parkStatusBySlug,
} from "@/server/parks";
import {
  hostnameOf,
  parkHostLabel,
  parkUrl,
  resolveHost,
} from "@/server/parks/host";
import { ParkTrackLogo } from "./logo";
import { ParkSearchList } from "./park-search-list";

/**
 * S13 "There's no park at this address". Shown for unknown or reserved
 * subdomains (via /not-found-park) and for well-formed slugs with no live
 * park (from the park layout). Reads the request host, so render it inside
 * <Suspense> (ParkNotFound does that for you).
 */
export function ParkNotFound() {
  return (
    <MobileShell
      topBar={<TopBar leading={<ParkTrackLogo />} />}
      className="gap-6 px-5 py-8"
    >
      <Suspense fallback={<Heading host={null} />}>
        <ParkNotFoundBody />
      </Suspense>
    </MobileShell>
  );
}

function Heading({
  host,
  pausedPark,
}: {
  host: string | null;
  /** A real park that isn't LIVE (onboarding or suspended). */
  pausedPark?: string;
}) {
  if (pausedPark) {
    return (
      <div className="flex flex-col gap-2">
        <Tile className="size-11 [&_svg]:size-5">
          <Clock />
        </Tile>
        <h1 className="pt-2 text-title">
          {pausedPark} isn’t taking parcels right now
        </h1>
        <p className="text-sub text-fg-2">
          Bookings on this park’s page are paused. Ask at the park counter, or
          send from another park below.
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <Tile className="size-11 [&_svg]:size-5">
        <Search />
      </Tile>
      <h1 className="pt-2 text-title">There’s no park at this address</h1>
      <p className="text-sub text-fg-2">
        {host ? (
          <span className="font-mono text-[13px]">{host}</span>
        ) : (
          "This address"
        )}{" "}
        isn’t a ParkTrack park. Check the link on the counter poster, or find
        the park below.
      </p>
    </div>
  );
}

async function ParkNotFoundBody() {
  const root = process.env.ROOT_DOMAIN || "localhost:3000";
  // Read the request first: the park list is request-time content here, so
  // the build never runs the database query (CI has no DATABASE_URL). Started
  // together, the cached listLiveParks() would run during prerender.
  const rawHost = (await headers()).get("host") ?? "";
  const host = hostnameOf(rawHost);
  const target = resolveHost(rawHost, root);
  const [parks, park] = await Promise.all([
    listLiveParks(),
    target.kind === "park" ? parkStatusBySlug(target.slug) : null,
  ]);
  const pausedPark = park && park.status !== "LIVE" ? park.name : undefined;
  return (
    <>
      <Heading host={host || null} pausedPark={pausedPark} />
      <ParkSearchList
        parks={parks.map((p) => ({
          slug: p.slug,
          displayName: parkDisplayName(p),
          city: p.city,
          hostLabel: parkHostLabel(p.slug, root),
          url: parkUrl(p.slug, root),
        }))}
      />
    </>
  );
}
