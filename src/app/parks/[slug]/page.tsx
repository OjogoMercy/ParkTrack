import { Suspense } from "react";
import { MobileShell } from "@/components/ui/shells";
import { OpenNowBadge } from "@/features/identity/open-now-badge";
import {
  ParkHeader,
  ParkHeaderSkeleton,
} from "@/features/identity/park-header";
import { ParkNotFound } from "@/features/identity/park-not-found";
import { getPark, parkStatusBySlug } from "@/server/parks";

/**
 * A park's page: parktrack.ng/parks/{slug} (Q45; was {slug}.parktrack.ng,
 * which now redirects here). PLACEHOLDER until Scope 05 moves the real S01
 * park home here.
 *
 * Pattern for park pages under Cache Components: the page renders
 * synchronously and reads `params` inside its own <Suspense>, so navigation
 * stays instant. Park data comes from the cached getPark(); "open now" is a
 * client component.
 */
export default function ParkPage({ params }: PageProps<"/parks/[slug]">) {
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

async function ParkHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getPark(slug);
  if (!data) {
    const park = await parkStatusBySlug(slug).catch(() => null);
    return (
      <ParkNotFound
        slug={slug}
        pausedPark={park && park.status !== "LIVE" ? park.name : undefined}
      />
    );
  }
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
