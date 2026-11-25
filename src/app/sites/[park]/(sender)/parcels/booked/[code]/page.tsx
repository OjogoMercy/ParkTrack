import { CalendarClock, Info, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { bookingQr } from "@/contracts/qr";
import { SIZE_LABELS } from "@/contracts/enums";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Code } from "@/components/ui/display";
import { QRCodeView } from "@/components/ui/qr-code";
import { BottomBar, MobileShell, TopBar } from "@/components/ui/shells";
import { Card, Divider, KeyValue, Notice } from "@/components/ui/surface";
import { ShareBooking } from "@/features/sender/share-booking";
import { formatDayTime } from "@/lib/dates";
import { formatNaira } from "@/lib/money";
import { getSession } from "@/server/auth";
import { bookedParcel, type BookedView } from "@/server/booking";
import { receiptUrl } from "@/server/payments";

export const metadata: Metadata = { title: "Booked" };

/**
 * S07 booked ({park}.parktrack.ng/parcels/booked/PT-7K3Q): where the payer
 * lands after Interswitch. The booking QR (only the random publicId, via
 * bookingQr), the PT- code to write on the parcel, the drop-off deadline,
 * who it's for, and the receipt. An unpaid booking goes back to review and
 * pay (S04); a checked-in, cancelled or finished one says so.
 */
export default function BookedPage({
  params,
}: PageProps<"/sites/[park]/parcels/booked/[code]">) {
  return (
    <Suspense
      fallback={
        <MobileShell topBar={<TopBar />}>
          <span className="sr-only">Loading your booking</span>
        </MobileShell>
      }
    >
      <Booked params={params} />
    </Suspense>
  );
}

async function Booked({
  params,
}: {
  params: Promise<{ park: string; code: string }>;
}) {
  const [{ park: slug, code }, user] = await Promise.all([
    params,
    getSession(),
  ]);
  if (!user) {
    redirect(`/signin?next=${encodeURIComponent(`/parcels/booked/${code}`)}`);
  }
  const b = await bookedParcel(user.id, slug, decodeURIComponent(code));

  const close = (
    <Link
      href="/parcels"
      aria-label="Close"
      className={buttonVariants({ variant: "ghost", size: "icon" })}
    >
      <X className="size-5" />
    </Link>
  );

  if (!b) {
    return (
      <MobileShell
        topBar={<TopBar className="pl-2" leading={close} />}
        className="gap-3 p-4"
      >
        <h1 className="text-title">Booking not found</h1>
        <p className="text-sub text-fg-2">
          We couldn’t find that booking on your account at this park.
        </p>
        <Link href="/parcels" className={buttonVariants({ block: true })}>
          Go to my parcels
        </Link>
      </MobileShell>
    );
  }
  // Not paid yet (or "Try again" after a failed payment): pay it.
  if (b.status === "DRAFT") {
    redirect(`/send/review?parcel=${b.parcelCode}`);
  }
  if (b.status !== "AWAITING_DROPOFF")
    return <NotWaiting b={b} close={close} />;

  const deadline = b.dropoffDeadline ? formatDayTime(b.dropoffDeadline) : null;
  const firstName = b.recipientName.split(/\s+/)[0];
  const to =
    b.deliveryMode === "ROADSIDE"
      ? `${b.recipientName} · Roadside, ${b.roadsidePointName ?? "drop point"}`
      : `${b.recipientName} · ${b.destinationName}`;

  return (
    <MobileShell
      topBar={
        <TopBar
          className="pl-2"
          leading={close}
          trailing={
            <ShareBooking
              text={`ParkTrack booking ${b.parcelCode} to ${b.destinationName}.${deadline ? ` Drop it off at the ${b.originCity} counter by ${deadline}.` : ""}`}
            />
          }
        />
      }
      bottomBar={
        <BottomBar>
          <Link href="/parcels" className={buttonVariants({ block: true })}>
            Go to my parcels
          </Link>
        </BottomBar>
      }
      className="gap-5 px-4 pt-1 pb-6"
    >
      <div className="flex flex-col gap-1.5 px-1">
        {b.paid ? (
          <Badge tone="green" className="self-start">
            Paid {formatNaira(b.paid.amountKobo)}
          </Badge>
        ) : null}
        <h1 className="text-title">Booked. Now bring it to the park.</h1>
        <p className="text-sub text-fg-2">
          Show this QR at the {b.originCity} counter. The agent checks your
          parcel in and you’re done.
        </p>
      </div>

      <Card className="flex flex-col items-center gap-4 px-4 pt-6 pb-4">
        <QRCodeView
          value={bookingQr(b.publicId)}
          size={208}
          label={`Booking QR for ${b.parcelCode}`}
        />
        <div className="flex flex-col items-center gap-1">
          <Code className="text-[20px] font-semibold tracking-[0.04em]">
            {b.parcelCode}
          </Code>
          <span className="text-caption text-fg-3">
            Write-on code for your parcel
          </span>
        </div>
        {deadline ? (
          <>
            <Divider className="self-stretch" />
            <div className="flex items-center justify-center gap-2 text-[13px] font-medium text-amber-fg">
              <CalendarClock className="size-4" aria-hidden />
              Drop off by {deadline}
            </div>
          </>
        ) : null}
      </Card>

      <Card className="px-4 py-2">
        <KeyValue label="To" value={to} />
        <KeyValue
          label="Parcel"
          value={`${SIZE_LABELS[b.sizeClass].name} · ${b.category}`}
        />
        {b.podAmountKobo > 0 ? (
          <KeyValue
            label="Pay on delivery"
            value={formatNaira(b.podAmountKobo)}
          />
        ) : null}
        {b.paid ? (
          <KeyValue
            label="Receipt"
            value={
              <a
                href={receiptUrl(b.paid.txnRef)}
                className="font-medium underline"
              >
                View
              </a>
            }
          />
        ) : null}
      </Card>

      <Notice tone="blue" icon={<Info />}>
        {firstName} gets a tracking link the moment the agent checks your parcel
        in.
      </Notice>
    </MobileShell>
  );
}

/** Past drop-off: checked in, on its way, done, or cancelled. */
function NotWaiting({ b, close }: { b: BookedView; close: React.ReactNode }) {
  const cancelled = b.status === "CANCELLED";
  return (
    <MobileShell
      topBar={<TopBar className="pl-2" leading={close} />}
      className="gap-3 p-4"
    >
      <h1 className="text-title">
        {cancelled ? "This booking was cancelled" : "Already checked in"}
      </h1>
      <p className="text-sub text-fg-2">
        {cancelled
          ? `${b.parcelCode} wasn’t dropped off in time or was cancelled. If you paid, the money is refunded automatically.`
          : `${b.parcelCode} is past the counter. Follow it on its parcel page.`}
      </p>
      <Link
        href={cancelled ? "/parcels" : `/parcels/${b.parcelCode}`}
        className={buttonVariants({ block: true })}
      >
        {cancelled ? "Go to my parcels" : "Follow this parcel"}
      </Link>
    </MobileShell>
  );
}
