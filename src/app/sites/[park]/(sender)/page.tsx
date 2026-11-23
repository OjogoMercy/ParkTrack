import { Suspense } from "react";
import { MobileShell } from "@/components/ui/shells";
import { OpenNowBadge } from "@/features/identity/open-now-badge";
import {
  ParkHeader,
  ParkHeaderSkeleton,
} from "@/features/identity/park-header";
import { getPark } from "@/server/parks";

/**
 * PLACEHOLDER park home, so routing and the park header can be checked before
 * Scope 05 builds the real S01. Scope 05 replaces this file.
 *
 * Pattern for park pages under Cache Components: the page renders
 * synchronously and reads `params` inside its own <Suspense>, so navigation
 * stays instant. Park data comes from the cached getPark(); "open now" is a
 * client component.
 */
export default function ParkHomePlaceholder({
  params,
}: PageProps<"/sites/[park]">) {
  return (
    <Suspense
      fallback={
        <MobileShell topBar={<ParkHeaderSkeleton />}>
          <span className="sr-only">Loading park</span>
        </MobileShell>
      }
    >
      <ParkHome params={params} />
    </Suspense>
  );
}

async function ParkHome({ params }: { params: Promise<{ park: string }> }) {
  const { park } = await params;
  const data = await getPark(park);
  if (!data) return null; // the layout shows "park not found"
  return (
    <MobileShell
      topBar={<ParkHeader park={data} />}
      className="gap-5 px-4 pt-5 pb-6"
    >
      <div className="flex flex-col gap-2 px-1">
        <OpenNowBadge hours={data.openingHours} className="self-start" />
        <h1 className="text-title">Send a parcel from {data.city}</h1>
        <p className="text-sub text-fg-2">
          {data.routes.length} route{data.routes.length === 1 ? "" : "s"} from
          this park. The full park home (S01) arrives in Scope 05.
        </p>
      </div>
    </MobileShell>
  );
}
