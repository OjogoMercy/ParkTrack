import { X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SizeClass } from "@/contracts/enums";
import { buttonVariants } from "@/components/ui/button";
import { Avatar } from "@/components/ui/display";
import { MobileShell, TopBar } from "@/components/ui/shells";
import { Card, Notice } from "@/components/ui/surface";
import {
  BookingForm,
  type BookingRecipient,
  type BookingRoute,
} from "@/features/sender/booking-form";
import { destinationLabel } from "@/features/sender/format";
import { formatPhone, formatPhoneNational } from "@/lib/phone";
import { getSession } from "@/server/auth";
import { bookingLimits, parkEstimates } from "@/server/booking";
import { getPark } from "@/server/parks";
import { listRecipients } from "@/server/recipients";

export const metadata: Metadata = { title: "New parcel" };

/**
 * S03 new parcel, one page ({park}.parktrack.ng/send?route&size). The
 * sender's own details are filled in from their account; recipients come
 * from their saved list. S01's "Book this parcel" passes the route and
 * size. Signed-out visitors sign in and come back.
 */
export default function SendPage({
  params,
  searchParams,
}: PageProps<"/sites/[park]/send">) {
  return (
    <Suspense
      fallback={
        <MobileShell topBar={<TopBar title="New parcel" />}>
          <span className="sr-only">Loading the booking form</span>
        </MobileShell>
      }
    >
      <Send params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Send({
  params,
  searchParams,
}: {
  params: Promise<{ park: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ park: slug }, query, user] = await Promise.all([
    params,
    searchParams,
    getSession(),
  ]);
  const one = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : v;
  const routeParam = one(query.route);
  const sizeParam = SizeClass.safeParse(one(query.size));

  if (!user) {
    const back = new URLSearchParams();
    if (routeParam) back.set("route", routeParam);
    if (sizeParam.success) back.set("size", sizeParam.data);
    const next = `/send${back.size ? `?${back}` : ""}`;
    redirect(`/signin?next=${encodeURIComponent(next)}`);
  }

  const park = await getPark(slug);
  if (!park) return null; // the layout shows "park not found"

  const topBar = (
    <TopBar
      className="pl-2"
      leading={
        <Link
          href="/"
          aria-label="Close"
          className={buttonVariants({ variant: "ghost", size: "icon" })}
        >
          <X className="size-5" />
        </Link>
      }
      title="New parcel"
      sub={`From ${park.name}`}
    />
  );

  if (user.role !== "SENDER") {
    return (
      <MobileShell topBar={topBar} className="p-4">
        <Notice>
          You’re signed in with a staff account. To send a parcel yourself, sign
          in with your personal number. Walk-in customers are booked from the
          counter.
        </Notice>
      </MobileShell>
    );
  }
  if (park.routes.length === 0) {
    return (
      <MobileShell topBar={topBar} className="p-4">
        <Card className="flex flex-col gap-1 p-4">
          <h1 className="text-heading">No routes yet</h1>
          <p className="text-sub text-fg-2">
            {park.name} isn’t sending parcels anywhere yet. Check back soon.
          </p>
        </Card>
      </MobileShell>
    );
  }

  const [estimates, limits, saved, destinations] = await Promise.all([
    parkEstimates(
      slug,
      park.routes.map((r) => r.id),
    ),
    bookingLimits(),
    listRecipients(user.id),
    Promise.all(park.routes.map((r) => getPark(r.destination.slug))),
  ]);

  const routes: BookingRoute[] = park.routes.map((r, i) => ({
    id: r.id,
    destinationParkId: r.destination.id,
    label: destinationLabel(r.destination),
    destinationName: r.destination.name,
    fareKobo: r.fareKobo,
    points: r.roadsidePoints.map((p) => ({ id: p.id, name: p.name })),
    storage: {
      windowHours: destinations[i]?.storage.windowHours ?? 24,
      dailyRateKobo: destinations[i]?.storage.dailyRateKobo ?? {
        S: 30_000,
        M: 30_000,
        L: 30_000,
      },
    },
  }));
  const recipients: BookingRecipient[] = saved.map((r) => ({
    id: r.id,
    name: r.name,
    phone: formatPhone(r.phone).replace(/^\+234\s*/, ""),
    preferredParkId: r.preferredPark?.id ?? null,
    preferredPointId: r.preferredRoadsidePoint?.id ?? null,
  }));
  const initialRouteId =
    routes.find((r) => r.id === routeParam)?.id ?? routes[0].id;

  return (
    <BookingForm
      topBar={topBar}
      intro={
        <Card className="flex items-center gap-3 px-3 py-2.5">
          <Avatar name={user.name || user.phone.slice(-4)} />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-caption text-fg-3">Sending as</span>
            <span className="truncate text-sub font-medium">
              {user.name ? `${user.name} · ` : ""}
              {formatPhoneNational(user.phone)}
            </span>
          </div>
          <Link
            href="/account"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            {user.name ? "Edit" : "Add name"}
          </Link>
        </Card>
      }
      routes={routes}
      estimates={estimates}
      recipients={recipients}
      podLimitKobo={limits.podLimitKobo}
      initialRouteId={initialRouteId}
      initialSize={sizeParam.success ? sizeParam.data : "M"}
    />
  );
}
