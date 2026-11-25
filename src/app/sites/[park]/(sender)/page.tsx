import { Bus, Clock, KeyRound, Receipt, Warehouse } from "lucide-react";
import { Suspense } from "react";
import { MobileShell } from "@/components/ui/shells";
import { Money } from "@/components/ui/display";
import { Card, List, ListRow, Section, Tile } from "@/components/ui/surface";
import { OpenNowBadge } from "@/features/identity/open-now-badge";
import { ParkTrackLogo } from "@/features/identity/logo";
import {
  ParkHeader,
  ParkHeaderSkeleton,
} from "@/features/identity/park-header";
import { destinationLabel, formatJourney } from "@/features/sender/format";
import { QuickQuote } from "@/features/sender/quick-quote";
import { formatNaira } from "@/lib/money";
import { parkEstimates, type ParkEstimates } from "@/server/booking";
import { getPark, type ParkRecord } from "@/server/parks";

/**
 * S01 park home ({park}.parktrack.ng/): open now, "Send a parcel from
 * {city}", the quick quote (destination + size → total), routes with
 * "from" prices, and the rules a sender should know before booking.
 * Signed-out visitors can browse; booking (/send) asks them to sign in.
 *
 * Cache Components: the page renders synchronously and reads `params`
 * inside its own <Suspense>. Park data and estimates are cached; "open
 * now" is a client component.
 */
export default function ParkHome({ params }: PageProps<"/sites/[park]">) {
  return (
    <Suspense
      fallback={
        <MobileShell topBar={<ParkHeaderSkeleton />}>
          <span className="sr-only">Loading park</span>
        </MobileShell>
      }
    >
      <ParkHomeContent params={params} />
    </Suspense>
  );
}

async function ParkHomeContent({
  params,
}: {
  params: Promise<{ park: string }>;
}) {
  const { park: slug } = await params;
  const park = await getPark(slug);
  if (!park) return null; // the layout shows "park not found"

  let estimates: ParkEstimates | null = null;
  if (park.routes.length) {
    try {
      estimates = await parkEstimates(
        slug,
        park.routes.map((r) => r.id),
      );
    } catch (e) {
      // The page still shows routes and fares; only the estimator hides.
      console.error("[park home] estimates", e);
    }
  }

  return (
    <MobileShell
      topBar={<ParkHeader park={park} />}
      className="gap-5 px-4 pt-5 pb-6"
    >
      <div className="flex flex-col gap-2 px-1">
        <OpenNowBadge hours={park.openingHours} className="self-start" />
        <h1 className="text-title">Send a parcel from {park.city}</h1>
        <p className="text-sub text-fg-2">
          Book and pay here, then drop it at the counter in seconds. You and
          your recipient can follow it all the way.
        </p>
      </div>

      {park.routes.length === 0 ? (
        <Card className="flex flex-col gap-1 p-4">
          <h2 className="text-heading">No routes yet</h2>
          <p className="text-sub text-fg-2">
            {park.name} isn’t sending parcels anywhere yet. Check back soon.
          </p>
        </Card>
      ) : (
        <>
          {estimates ? (
            <QuickQuote
              routes={park.routes.map((r) => ({
                id: r.id,
                label: destinationLabel(r.destination),
              }))}
              estimates={estimates}
            />
          ) : null}
          <Routes park={park} />
        </>
      )}

      <GoodToKnow park={park} />

      <div className="flex flex-col items-center gap-2 pt-1">
        <ParkTrackLogo />
        <span className="text-caption text-fg-3">
          One account works at every ParkTrack park
        </span>
      </div>
    </MobileShell>
  );
}

function Routes({ park }: { park: ParkRecord }) {
  return (
    <Section title="Routes from this park">
      <Card>
        <List>
          {park.routes.map((r) => {
            const from = Math.min(r.fareKobo.S, r.fareKobo.M, r.fareKobo.L);
            const stops = r.roadsidePoints.map((p) => p.name).join(", ");
            return (
              <ListRow
                key={r.id}
                leading={
                  <Tile>
                    <Bus aria-hidden />
                  </Tile>
                }
                title={destinationLabel(r.destination)}
                sub={`About ${formatJourney(r.typicalMinutes)}${stops ? ` · stops at ${stops}` : ""}`}
                trailing={
                  <div className="flex flex-col items-end">
                    <span className="text-caption text-fg-3">from</span>
                    <Money kobo={from} className="text-sub font-medium" />
                  </div>
                }
              />
            );
          })}
        </List>
      </Card>
    </Section>
  );
}

function GoodToKnow({ park }: { park: ParkRecord }) {
  const { S, M, L } = park.storage.dailyRateKobo;
  const rate =
    S === M && M === L
      ? `a fixed ${formatNaira(M)} a day`
      : `from ${formatNaira(Math.min(S, M, L))} a day, by size`;
  const items = [
    {
      icon: <Clock />,
      title: `Drop off within ${park.storage.dropoffDeadlineHours} hours of paying`,
      sub: "Unused bookings are refunded automatically.",
    },
    {
      icon: <Warehouse />,
      title: `${park.storage.windowHours} hours free storage on arrival`,
      sub: `Then ${rate}. No surprise fees.`,
    },
    {
      icon: <KeyRound />,
      title: "Released only with a one-time code",
      sub: "Sent to your recipient’s phone at the counter.",
    },
    {
      icon: <Receipt />,
      title: "Every naira goes through Interswitch",
      sub: "Pay on Interswitch’s secure page, with a receipt each time.",
    },
  ];
  return (
    <Section title="Good to know">
      <Card>
        <List>
          {items.map((i) => (
            <div
              key={i.title}
              className="flex items-start gap-3 border-t border-line px-4 py-3 first:border-t-0"
            >
              <span className="pt-px text-fg-2 [&_svg]:size-4" aria-hidden>
                {i.icon}
              </span>
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sub font-medium">{i.title}</span>
                <span className="text-small text-fg-3">{i.sub}</span>
              </div>
            </div>
          ))}
        </List>
      </Card>
    </Section>
  );
}
