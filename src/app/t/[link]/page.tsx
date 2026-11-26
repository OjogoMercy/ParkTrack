import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { MobileShell, TopBar } from "@/components/ui/shells";
import { Card } from "@/components/ui/surface";
import { LiveRefresh } from "@/features/tracking/live-refresh";
import { RecipientView } from "@/features/tracking/recipient-view";
import { trackingChannelForLink, trackingForLink } from "@/server/tracking";
import { recipientTopic } from "@/server/tracking/topics";

export const metadata: Metadata = {
  title: "Track your parcel",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/**
 * R01–R03: the recipient's tracking link, parktrack.ng/t/<signed token>.
 * No sign-in: the signed link is the access (AUTH-5). Shows an ETA to
 * their stop, never the driver's position (RD-1), and stays current
 * without a reload (Realtime ping + timer).
 */
export default function TrackPage({ params }: PageProps<"/t/[link]">) {
  return (
    <Suspense
      fallback={
        <MobileShell topBar={<TopBar title="Your parcel" />}>
          <span className="sr-only">Loading your parcel</span>
        </MobileShell>
      }
    >
      <Track params={params} />
    </Suspense>
  );
}

async function Track({ params }: { params: Promise<{ link: string }> }) {
  const { link } = await params;
  // Per request: the link's expiry and the ETA depend on the clock.
  await connection();
  const view = await trackingForLink(link);
  if (!view) {
    return (
      <MobileShell topBar={<TopBar title="Your parcel" />} className="pt-8">
        <Card className="flex flex-col gap-1.5 p-5">
          <h1 className="text-heading">This link isn’t valid any more</h1>
          <p className="text-sub text-fg-2">
            Tracking links expire after two weeks. Ask the sender to share your
            parcel again, or check the latest text from ParkTrack.
          </p>
        </Card>
      </MobileShell>
    );
  }
  const channel = await trackingChannelForLink(link);
  return (
    <>
      <RecipientView view={view} now={requestTime()} />
      <LiveRefresh topic={channel ? recipientTopic(channel) : null} />
    </>
  );
}

/** The time this page is rendered for (countdowns, "today"). */
function requestTime(): Date {
  return new Date();
}
