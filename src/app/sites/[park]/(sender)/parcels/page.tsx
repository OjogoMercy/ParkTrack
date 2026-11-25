import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import type { ParcelSummary } from "@/contracts/dto";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Code } from "@/components/ui/display";
import { MobileShell } from "@/components/ui/shells";
import { Card, List, ListRow, Section } from "@/components/ui/surface";
import {
  ParkHeader,
  ParkHeaderSkeleton,
} from "@/features/identity/park-header";
import {
  draftExpired,
  parcelRowDetail,
  parcelRowHref,
} from "@/features/sender/format";
import { SENDER_TABS } from "@/features/sender/tabs";
import { formatDay, formatDayTime } from "@/lib/dates";
import { formatNaira } from "@/lib/money";
import { cn } from "@/lib/utils";
import { getSession } from "@/server/auth";
import { listMyParcels, myParcelCounts } from "@/server/booking";
import { getPark } from "@/server/parks";

export const metadata: Metadata = { title: "My parcels" };

type Tab = "active" | "delivered" | "drafts";
const TABS: { value: Tab; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "delivered", label: "Delivered" },
  { value: "drafts", label: "Drafts" },
];

/**
 * S08 my parcels ({park}.parktrack.ng/parcels?tab=): the sender's parcels
 * from every park in Active / Delivered / Drafts, with status badges, the
 * vendor strip for vendors, and "Recently delivered" under Active. Rows go
 * to pay (draft), the booking QR (awaiting drop-off) or the parcel page.
 */
export default function ParcelsPage({
  params,
  searchParams,
}: PageProps<"/sites/[park]/parcels">) {
  return (
    <Suspense
      fallback={
        <MobileShell topBar={<ParkHeaderSkeleton />}>
          <span className="sr-only">Loading your parcels</span>
        </MobileShell>
      }
    >
      <Parcels params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Parcels({
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
  const raw = Array.isArray(query.tab) ? query.tab[0] : query.tab;
  const tab: Tab = TABS.some((t) => t.value === raw) ? (raw as Tab) : "active";
  if (!user) {
    redirect(
      `/signin?next=${encodeURIComponent(tab === "active" ? "/parcels" : `/parcels?tab=${tab}`)}`,
    );
  }

  const [park, list, counts, recent] = await Promise.all([
    getPark(slug),
    listMyParcels(user.id, tab),
    myParcelCounts(user.id),
    tab === "active" ? listMyParcels(user.id, "delivered") : null,
  ]);
  if (!park) return null; // the layout shows "park not found"
  const now = new Date();
  const fmt = { day: formatDay, dayTime: formatDayTime };

  return (
    <MobileShell
      topBar={<ParkHeader park={park} />}
      tabs={SENDER_TABS}
      className="gap-4 px-4 pt-5 pb-6"
    >
      <div className="flex items-center justify-between px-1">
        <h1 className="text-title">Parcels</h1>
        <Link href="/send" className={buttonVariants({ size: "sm" })}>
          <Plus className="size-4" aria-hidden />
          Send
        </Link>
      </div>

      {list.vendor ? (
        <div className="grid grid-cols-2 gap-2">
          <Card className="flex flex-col gap-0.5 px-3.5 py-3">
            <span className="text-caption text-fg-3">
              Collected for you ·{" "}
              {now.toLocaleString("en-NG", {
                month: "short",
                timeZone: "Africa/Lagos",
              })}
            </span>
            <span className="text-[17px] font-semibold num">
              {formatNaira(list.vendor.collectedThisMonthKobo)}
            </span>
          </Card>
          <Card className="flex flex-col gap-0.5 px-3.5 py-3">
            <span className="text-caption text-fg-3">Awaiting collection</span>
            <span className="text-[17px] font-semibold num">
              {formatNaira(list.vendor.awaitingCollectionKobo)}
            </span>
          </Card>
        </div>
      ) : null}

      <nav
        aria-label="Parcel lists"
        className="grid grid-cols-3 gap-0.5 rounded-control bg-sunken p-[3px]"
      >
        {TABS.map((t) => {
          const on = t.value === tab;
          const count = counts[t.value];
          return (
            <Link
              key={t.value}
              href={
                t.value === "active" ? "/parcels" : `/parcels?tab=${t.value}`
              }
              aria-current={on ? "page" : undefined}
              className={cn(
                "flex h-[34px] items-center justify-center rounded-badge text-sub font-medium text-fg-2 no-underline",
                on && "bg-panel text-fg shadow-seg",
              )}
            >
              {t.label}
              {t.value === "active" && count ? ` · ${count}` : ""}
            </Link>
          );
        })}
      </nav>

      {list.parcels.length ? (
        <Rows parcels={list.parcels} fmt={fmt} now={now} />
      ) : (
        <Empty tab={tab} />
      )}

      {recent && recent.parcels.length ? (
        <Section title="Recently delivered" className="pt-2">
          <Rows parcels={recent.parcels.slice(0, 3)} fmt={fmt} now={now} />
        </Section>
      ) : null}
    </MobileShell>
  );
}

function Rows({
  parcels,
  fmt,
  now,
}: {
  parcels: ParcelSummary[];
  fmt: { day: (d: Date) => string; dayTime: (d: Date) => string };
  now: Date;
}) {
  return (
    <Card>
      <List>
        {parcels.map((p) => (
          <ListRow
            key={p.id}
            href={parcelRowHref(p)}
            title={p.recipientName}
            sub={
              <>
                <Code className="text-[12px]">{p.parcelCode}</Code> ·{" "}
                {parcelRowDetail(p, fmt, now)}
              </>
            }
            trailing={
              p.status !== "DRAFT" ? (
                <StatusBadge status={p.status} />
              ) : draftExpired(p, now) ? (
                <Badge dot={false}>Expired</Badge>
              ) : (
                // The whole row opens review and pay (S04).
                <span
                  className={cn(
                    buttonVariants({ size: "sm" }),
                    "pointer-events-none",
                  )}
                >
                  Pay now
                </span>
              )
            }
          />
        ))}
      </List>
    </Card>
  );
}

function Empty({ tab }: { tab: Tab }) {
  const copy = {
    active: {
      title: "Nothing on the way",
      sub: "Parcels you book show here until they’re delivered.",
    },
    delivered: {
      title: "Nothing delivered yet",
      sub: "Delivered, collected and cancelled parcels show here.",
    },
    drafts: {
      title: "No unpaid bookings",
      sub: "Bookings you haven’t paid for wait here for 24 hours.",
    },
  }[tab];
  return (
    <Card className="flex flex-col items-start gap-1 p-4">
      <span className="text-sub font-medium">{copy.title}</span>
      <span className="text-small text-fg-3">{copy.sub}</span>
      {tab === "active" ? (
        <Link
          href="/send"
          className={cn(buttonVariants({ size: "sm" }), "mt-2")}
        >
          Send a parcel
        </Link>
      ) : null}
    </Card>
  );
}
