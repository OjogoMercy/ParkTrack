import { Suspense } from "react";
import { headers } from "next/headers";
import { Search } from "lucide-react";
import { MobileShell, TopBar } from "@/components/ui/shells";
import { Tile } from "@/components/ui/surface";
import { listLiveParks, parkDisplayName } from "@/server/parks";
import { hostnameOf, parkHostLabel, parkUrl } from "@/server/parks/host";
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

function Heading({ host }: { host: string | null }) {
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
  const [requestHeaders, parks] = await Promise.all([
    headers(),
    listLiveParks(),
  ]);
  const host = hostnameOf(requestHeaders.get("host") ?? "");
  return (
    <>
      <Heading host={host || null} />
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
