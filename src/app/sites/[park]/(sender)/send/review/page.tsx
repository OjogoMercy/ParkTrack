import { ArrowRight, Info } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SIZE_LABELS } from "@/contracts/enums";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { BottomBar, MobileShell, TopBar } from "@/components/ui/shells";
import { Card, Divider, KeyValue, Notice } from "@/components/ui/surface";
import { BackButton } from "@/features/sender/back-button";
import { PayButton } from "@/features/sender/pay-button";
import { formatNaira } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { getSession } from "@/server/auth";
import { draftForReview } from "@/server/booking";

export const metadata: Metadata = { title: "Review and pay" };

/**
 * S04 review and pay ({park}.parktrack.ng/send/review?parcel=PT-7K3Q): the
 * booking as it will be carried, the price it was made at, the drop-off
 * rule, and Pay, which goes to Interswitch. A paid booking moves on to its
 * booked page (S07); an expired one says so.
 */
export default function ReviewPage({
  params,
  searchParams,
}: PageProps<"/sites/[park]/send/review">) {
  return (
    <Suspense
      fallback={
        <MobileShell topBar={<TopBar title="Review and pay" />}>
          <span className="sr-only">Loading your booking</span>
        </MobileShell>
      }
    >
      <Review params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Review({
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
  const code =
    (Array.isArray(query.parcel) ? query.parcel[0] : query.parcel) ?? "";
  if (!user) {
    redirect(
      `/signin?next=${encodeURIComponent(`/send/review?parcel=${code}`)}`,
    );
  }
  const topBar = (
    <TopBar
      title="Review and pay"
      leading={<BackButton fallback="/parcels?tab=drafts" />}
    />
  );

  const draft = code ? await draftForReview(user.id, slug, code) : null;
  if (!draft) {
    return (
      <MobileShell topBar={topBar} className="gap-3 p-4">
        <h1 className="text-title">Booking not found</h1>
        <p className="text-sub text-fg-2">
          We couldn’t find that booking on your account at this park.
        </p>
        <Link href="/send" className={buttonVariants({ block: true })}>
          Book a parcel
        </Link>
      </MobileShell>
    );
  }
  if (draft.status !== "DRAFT") {
    redirect(`/parcels/booked/${draft.parcelCode}`);
  }
  if (draft.expired) {
    return (
      <MobileShell topBar={topBar} className="gap-3 p-4">
        <h1 className="text-title">This booking expired</h1>
        <p className="text-sub text-fg-2">
          Unpaid bookings are kept for 24 hours. {draft.parcelCode} wasn’t paid
          in time, so it’s closed. You haven’t been charged.
        </p>
        <Link href="/send" className={buttonVariants({ block: true })}>
          Book again
        </Link>
      </MobileShell>
    );
  }

  const where =
    draft.deliveryMode === "ROADSIDE"
      ? `Roadside · ${draft.roadsidePointName ?? "drop point"}`
      : "Collect at park";

  return (
    <MobileShell
      topBar={topBar}
      bottomBar={
        <BottomBar>
          <PayButton parcelId={draft.id} totalKobo={draft.quote.totalKobo} />
        </BottomBar>
      }
      className="gap-4 p-4"
    >
      <Card>
        <div className="flex flex-col gap-2.5 border-b border-line p-4">
          <h1 className="flex flex-wrap items-center gap-2 text-[15px] font-semibold">
            <span>{draft.originCity}</span>
            <ArrowRight className="size-4 text-fg-3" aria-label="to" />
            <span>
              {draft.destination.city} · {draft.destination.name}
            </span>
          </h1>
          <div className="flex flex-wrap gap-1.5">
            <Badge dot={false}>{where}</Badge>
            <Badge dot={false}>{SIZE_LABELS[draft.sizeClass].name}</Badge>
          </div>
        </div>
        <div className="px-4 py-2">
          <KeyValue label="Recipient" value={draft.recipientName} />
          <KeyValue label="Phone" value={formatPhone(draft.recipientPhone)} />
          <KeyValue label="Item" value={draft.category} />
          <KeyValue label="Description" value={draft.description} />
          <KeyValue
            label="Declared value"
            value={formatNaira(draft.declaredValueKobo)}
          />
          {draft.podAmountKobo > 0 ? (
            <KeyValue
              label="Pay on delivery"
              value={formatNaira(draft.podAmountKobo)}
            />
          ) : null}
        </div>
      </Card>

      <Card className="px-4 py-2">
        {draft.quote.lines.map((l) => (
          <KeyValue
            key={l.label}
            label={l.label}
            value={formatNaira(l.amountKobo)}
          />
        ))}
        <Divider className="my-1" />
        <KeyValue
          className="text-[15px] [&>span:first-child]:font-medium [&>span:first-child]:text-fg [&>span:last-child]:font-semibold"
          label="Total today"
          value={formatNaira(draft.quote.totalKobo)}
        />
      </Card>

      <Notice icon={<Info />}>
        After paying, bring the parcel to {draft.originName} within{" "}
        {draft.dropoffDeadlineHours} hours. If you don’t, it’s cancelled and
        refunded automatically.
      </Notice>
    </MobileShell>
  );
}
