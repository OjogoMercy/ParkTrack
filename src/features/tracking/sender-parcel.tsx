import { Camera, CircleCheck, Receipt } from "lucide-react";
import type { ParcelDetail } from "@/contracts/dto";
import { SIZE_LABELS } from "@/contracts/enums";
import { bookingQr } from "@/contracts/qr";
import { Badge, LiveDot, PARCEL_STATUS_BADGE } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Avatar, Money } from "@/components/ui/display";
import { QRCodeView } from "@/components/ui/qr-code";
import { MobileShell, TopBar } from "@/components/ui/shells";
import { Card, Divider, KeyValue, Notice } from "@/components/ui/surface";
import { Timeline } from "@/components/ui/timeline";
import {
  formatDay,
  formatDayTime,
  formatTime,
  formatTimeLeft,
} from "@/lib/dates";
import { cn } from "@/lib/utils";
import { journeySteps } from "./steps";

/**
 * The sender's parcel page: S09 awaiting drop-off (QR, deadline), S10 in
 * transit (ETA, driver, drop-off photo, POD status) and S11 collected
 * (proof of delivery, money breakdown, receipt). The in-between states
 * (at the counter, assigned, ready at the park) use the same parts.
 * `live` is the map slot (sl4); `actions` holds Cancel (sl9).
 */
export function SenderParcelView({
  parcel: p,
  now,
  backHref,
  receiptHref,
  live,
  actions,
}: {
  parcel: ParcelDetail;
  now: Date;
  backHref: string;
  receiptHref: string | null;
  live?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const roadside = p.deliveryMode === "ROADSIDE" && p.roadsidePoint;
  const steps = journeySteps(p, now);
  const done = ["DELIVERED_ROADSIDE", "COLLECTED", "SETTLED"].includes(
    p.status,
  );

  return (
    <MobileShell
      topBar={
        <TopBar
          backHref={backHref}
          title={p.parcelCode}
          sub={`To ${p.recipientName} · ${roadside ? "Roadside drop" : p.destinationPark.name}`}
        />
      }
      className="gap-3.5 pb-8"
    >
      {p.status === "AWAITING_DROPOFF" && p.publicId ? (
        <DropoffCard parcel={p} now={now} />
      ) : p.status === "IN_TRANSIT" ? (
        <OnTheRoadCard parcel={p} live={live} />
      ) : p.status === "ARRIVED" ? (
        <ReadyCard parcel={p} now={now} />
      ) : done ? (
        <DeliveredHeader parcel={p} />
      ) : (
        <StatusCard parcel={p} />
      )}

      {steps.length ? (
        <Card className="p-4">
          <Timeline
            items={steps.map((s) => ({
              title: s.title,
              sub: s.sub,
              meta: s.meta,
              state: s.state,
            }))}
          />
        </Card>
      ) : null}

      {done ? <ProofCard parcel={p} /> : <DropoffPhoto parcel={p} />}

      {done && p.settlement ? (
        <MoneyCard parcel={p} />
      ) : (
        <DetailsCard parcel={p} receiptHref={receiptHref} />
      )}

      {done && receiptHref ? (
        <a
          href={receiptHref}
          className={buttonVariants({ variant: "secondary", block: true })}
        >
          <Receipt aria-hidden /> Receipt
        </a>
      ) : null}
      {actions}
    </MobileShell>
  );
}

function DropoffCard({ parcel: p, now }: { parcel: ParcelDetail; now: Date }) {
  return (
    <Card className="flex flex-col items-center gap-3 px-4 pt-5 pb-4 text-center">
      <QRCodeView
        value={bookingQr(p.publicId!)}
        size={196}
        label={`Booking QR for ${p.parcelCode}`}
      />
      <Badge>{PARCEL_STATUS_BADGE.AWAITING_DROPOFF.label}</Badge>
      <span className="text-heading">
        Show this at the {p.originPark.city} counter
      </span>
      {p.dropoffDeadline ? (
        <span className="text-small text-fg-3">
          Drop off by {formatDayTime(p.dropoffDeadline)}
          <br />
          {formatTimeLeft(p.dropoffDeadline, now)}
        </span>
      ) : null}
    </Card>
  );
}

function OnTheRoadCard({
  parcel: p,
  live,
}: {
  parcel: ParcelDetail;
  live?: React.ReactNode;
}) {
  const stop =
    p.deliveryMode === "ROADSIDE" && p.roadsidePoint
      ? p.roadsidePoint.name
      : p.destinationPark.name;
  const eta = p.etaMinutes;
  return (
    <Card className="overflow-hidden">
      {live}
      <div className="flex items-end justify-between gap-3 px-4 pt-4 pb-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-caption text-fg-3">Arriving at {stop}</span>
          <span className="text-title num">
            {eta === null
              ? "On the way"
              : eta === 0
                ? "Due now"
                : `~${duration(eta)}`}
          </span>
        </div>
        {p.live ? (
          <Badge tone="volt">
            <LiveDot /> Live
          </Badge>
        ) : null}
      </div>
      {p.driver ? (
        <div className="flex items-center gap-3 border-t border-line px-4 py-3">
          <Avatar name={p.driver.name} />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sub font-medium">
              {p.driver.name}
            </span>
            <span className="truncate text-caption text-fg-3">
              {[p.driver.vehicleType, p.driver.vehiclePlate]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </div>
          {p.driver.verified ? <Badge>Verified</Badge> : null}
        </div>
      ) : null}
    </Card>
  );
}

function ReadyCard({ parcel: p, now }: { parcel: ParcelDetail; now: Date }) {
  return (
    <Card className="flex flex-col gap-2 p-4">
      <Badge tone="amber" className="self-start">
        Ready to collect
      </Badge>
      <h1 className="text-title">At {p.destinationPark.name}</h1>
      <p className="text-sub text-fg-2">
        {p.recipientName} can collect it at the counter
        {p.bay ? `, shelf ${p.bay}` : ""}.
        {p.freeUntil
          ? ` Free pickup until ${formatDayTime(p.freeUntil)} (${formatTimeLeft(p.freeUntil, now).replace(" left", "")} left).`
          : ""}
      </p>
      {p.storageDueKobo > 0 ? (
        <Notice tone="amber">
          Storage due so far: <Money kobo={p.storageDueKobo} />
        </Notice>
      ) : null}
    </Card>
  );
}

function StatusCard({ parcel: p }: { parcel: ParcelDetail }) {
  const badge = PARCEL_STATUS_BADGE[p.status];
  const text: Partial<Record<ParcelDetail["status"], string>> = {
    RECEIVED_AT_ORIGIN: `Checked in at ${p.originPark.name}. It goes on the next bus to ${p.destinationPark.city}.`,
    ASSIGNED: p.driver
      ? `On ${p.driver.name}’s bus (${p.driver.vehiclePlate}), waiting to leave ${p.originPark.city}.`
      : `On a bus, waiting to leave ${p.originPark.city}.`,
    CANCELLED: "This booking was cancelled.",
    DISPUTED: "ParkTrack is looking into this parcel. We’ll message you.",
    UNCLAIMED: `${p.recipientName} didn’t collect it in time.`,
    RETURNED: "This parcel was returned to you.",
  };
  return (
    <Card className="flex flex-col gap-2 p-4">
      <Badge tone={badge.tone} className="self-start">
        {badge.label}
      </Badge>
      {text[p.status] ? (
        <p className="text-sub text-fg-2">{text[p.status]}</p>
      ) : null}
    </Card>
  );
}

function DeliveredHeader({ parcel: p }: { parcel: ParcelDetail }) {
  const roadside = p.status === "DELIVERED_ROADSIDE" || !p.collected;
  const at = p.collected?.at ?? p.timeline.at(-1)?.at ?? p.updatedAt;
  return (
    <div className="flex flex-col gap-1.5 px-1 pt-1">
      <Badge tone="green" className="self-start">
        {roadside ? "Handed over" : "Collected"}
      </Badge>
      <h1 className="text-title">
        {roadside
          ? `Handed over to ${p.recipientName}`
          : `Collected by ${p.collected?.by ?? p.recipientName}`}
      </h1>
      <p className="text-sub text-fg-2">
        {roadside
          ? (p.roadsidePoint?.name ?? "Roadside")
          : (p.collected?.parkName ?? p.destinationPark.name)}{" "}
        · {formatDay(at)}, {formatTime(at)}
      </p>
    </div>
  );
}

function Photo({ url, label }: { url: string | null; label: string }) {
  return (
    <div className="flex flex-1 flex-col gap-1.5">
      <div className="grid aspect-[4/3] place-items-center overflow-hidden rounded-control bg-sunken text-fg-3">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- access-checked, short-lived link
          <img src={url} alt={label} className="size-full object-cover" />
        ) : (
          <Camera className="size-5" aria-hidden />
        )}
      </div>
      <span className="text-caption text-fg-3">{label}</span>
    </div>
  );
}

function ProofCard({ parcel: p }: { parcel: ParcelDetail }) {
  const dropoff = p.timeline.find((e) => e.type === "DROPOFF");
  return (
    <Card className="flex flex-col gap-3 p-4">
      <span className="text-caption text-fg-3">Proof of delivery</span>
      <div className="flex gap-3">
        <Photo
          url={p.dropoffPhotoUrl}
          label={`Drop-off · ${p.originPark.city}${dropoff ? `, ${formatDay(dropoff.at).split(" ").slice(1).join(" ")}` : ""}`}
        />
        <Photo
          url={p.releasePhotoUrl}
          label={
            p.collected
              ? `Release · ${p.destinationPark.city}, ${formatDay(p.collected.at).split(" ").slice(1).join(" ")}`
              : "Handover"
          }
        />
      </div>
      <div className="flex flex-col">
        <KeyValue
          label={p.collected ? "Collection code" : "Handover code"}
          value={
            <span className="inline-flex items-center gap-1 text-green-fg">
              <CircleCheck className="size-4" aria-hidden /> Verified
            </span>
          }
        />
        {p.collected ? (
          <KeyValue label="Released by" value={p.collected.releasedBy} />
        ) : null}
      </div>
    </Card>
  );
}

function DropoffPhoto({ parcel: p }: { parcel: ParcelDetail }) {
  if (!p.dropoffPhotoUrl) return null;
  return (
    <Card className="flex items-center gap-3 p-3">
      <div className="size-14 shrink-0 overflow-hidden rounded-control bg-sunken">
        {/* eslint-disable-next-line @next/next/no-img-element -- access-checked, short-lived link */}
        <img
          src={p.dropoffPhotoUrl}
          alt={`Drop-off photo of ${p.parcelCode}`}
          className="size-full object-cover"
        />
      </div>
      <div className="flex min-w-0 flex-col">
        <span className="text-sub font-medium">Drop-off photo</span>
        <span className="text-caption text-fg-3">
          {p.parcelCode} written on the parcel
        </span>
      </div>
    </Card>
  );
}

function DetailsCard({
  parcel: p,
  receiptHref,
}: {
  parcel: ParcelDetail;
  receiptHref: string | null;
}) {
  const podPaid = p.payments.some(
    (x) => x.purpose === "POD" && x.status === "VERIFIED",
  );
  return (
    <Card className="px-4 py-2">
      <KeyValue
        label="Delivery"
        value={
          p.deliveryMode === "ROADSIDE" && p.roadsidePoint
            ? `Roadside at ${p.roadsidePoint.name}`
            : "Collect at park"
        }
      />
      <KeyValue
        label="Parcel"
        value={`${SIZE_LABELS[p.sizeClass].name} · ${p.category}`}
      />
      {p.status === "AWAITING_DROPOFF" ? (
        <KeyValue
          label="Declared value"
          value={<Money kobo={p.declaredValueKobo} />}
        />
      ) : null}
      {p.podAmountKobo > 0 ? (
        <KeyValue
          label="Pay on delivery"
          value={
            podPaid ? (
              <Badge tone="green">
                Paid <Money kobo={p.podAmountKobo} />
              </Badge>
            ) : (
              <Money kobo={p.podAmountKobo} />
            )
          }
        />
      ) : null}
      <KeyValue
        label="Paid"
        value={
          <span>
            <Money kobo={p.totalKobo} />
            {receiptHref ? (
              <>
                {" · "}
                <a href={receiptHref} className="underline underline-offset-2">
                  receipt
                </a>
              </>
            ) : null}
          </span>
        }
      />
    </Card>
  );
}

function MoneyCard({ parcel: p }: { parcel: ParcelDetail }) {
  const s = p.settlement!;
  return (
    <Card className="px-4 py-2">
      <KeyValue label="Shipping fee" value={<Money kobo={p.totalKobo} />} />
      {s.podCollectedKobo > 0 ? (
        <>
          <KeyValue
            label="Collected on delivery"
            value={<Money kobo={s.podCollectedKobo} />}
          />
          <KeyValue
            label={`Fee (${feePercent(s.podFeeKobo, s.podCollectedKobo)})`}
            value={<Money kobo={-s.podFeeKobo} sign />}
          />
        </>
      ) : null}
      <Divider />
      <KeyValue
        label="Credited to you"
        value={<Money kobo={s.creditedKobo} />}
        className={cn("font-semibold")}
      />
    </Card>
  );
}

/** 70 → "1h 10m", 45 → "45 min". */
function duration(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** 500 of 40,000 → "1.25%". */
function feePercent(fee: number, of: number): string {
  if (!of) return "0%";
  return `${Number(((fee / of) * 100).toFixed(2))}%`;
}
