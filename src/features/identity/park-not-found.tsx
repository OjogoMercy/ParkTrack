import { Clock, Search } from "lucide-react";
import { MobileShell, TopBar } from "@/components/ui/shells";
import { Tile } from "@/components/ui/surface";
import { ParkTrackLogo } from "./logo";
import { ParkFinder } from "./park-finder";

/**
 * A park address (parktrack.ng/parks/{slug}) that leads nowhere: no park by
 * that name, or a real park that isn't taking parcels (onboarding or
 * suspended). Lists the live parks to pick from instead (was S13, the
 * unknown-subdomain screen, before Q45).
 */
export function ParkNotFound({
  slug,
  pausedPark,
}: {
  slug: string;
  /** Name of a real park that isn't LIVE. */
  pausedPark?: string;
}) {
  return (
    <MobileShell
      topBar={<TopBar leading={<ParkTrackLogo />} />}
      className="gap-6 px-5 py-8"
    >
      {pausedPark ? (
        <div className="flex flex-col gap-2">
          <Tile className="size-11 [&_svg]:size-5">
            <Clock />
          </Tile>
          <h1 className="pt-2 text-title">
            {pausedPark} isn’t taking parcels right now
          </h1>
          <p className="text-sub text-fg-2">
            Bookings for this park are paused. Ask at the park counter, or send
            from another park below.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Tile className="size-11 [&_svg]:size-5">
            <Search />
          </Tile>
          <h1 className="pt-2 text-title">We can’t find that park</h1>
          <p className="text-sub text-fg-2">
            <span className="font-mono text-[13px]">{slug}</span> isn’t a
            ParkTrack park. Check the link on the counter poster, or find the
            park below.
          </p>
        </div>
      )}
      <ParkFinder />
    </MobileShell>
  );
}
