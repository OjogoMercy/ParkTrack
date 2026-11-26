import { Bus, MapPin, Wallet } from "lucide-react";
import type { TrackingStop, TrackingView } from "@/contracts/dto";
import { SIZE_LABELS } from "@/contracts/enums";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Avatar, Code, Money } from "@/components/ui/display";
import { MobileShell, TopBar } from "@/components/ui/shells";
import { Card, KeyValue, Tile } from "@/components/ui/surface";
import {
  formatDayTime,
  formatRelativeDay,
  formatTime,
  formatTimeLeft,
  minutesUntil,
} from "@/lib/dates";
import { formatNaira } from "@/lib/money";
import { cn } from "@/lib/utils";
import { ShareLinkButton } from "./share-link-button";

/**
 * What the recipient sees through their link (no sign-in): R01 the parcel
 * on its way (approaching alert, stop strip, driver, dues before a
 * roadside handover), R03 ready to collect at the park, and the finished
 * states. Never the driver's exact position (RD-1). `pay` is the Pay
 * button slot (roadside POD, sl6); `handover` the R02 code card (sl6).
 */
export function RecipientView({
  view: v,
  now,
  pay,
  handover,
}: {
  view: TrackingView;
  now: Date;
  pay?: React.ReactNode;
  handover?: React.ReactNode;
}) {
  const roadside = v.deliveryMode === "ROADSIDE";
  return (
    <MobileShell
      topBar={
        <TopBar
          leading={
            <Tile className="size-8 bg-volt text-volt-ink">
              <Bus aria-hidden />
            </Tile>
          }
          title={`Parcel from ${v.senderName}`}
          sub={`${v.parcelCode} · ${roadside ? "Roadside drop" : "Park collection"}`}
          trailing={<ShareLinkButton title={`Parcel ${v.parcelCode}`} />}
        />
      }
      className="gap-3.5 pb-8"
    >
      {v.status === "ARRIVED" && v.arrival ? (
        <ReadyToCollect view={v} now={now} />
      ) : ["DELIVERED_ROADSIDE", "COLLECTED", "SETTLED"].includes(v.status) ? (
        <Finished view={v} />
      ) : ["CANCELLED", "RETURNED", "UNCLAIMED", "DISPUTED"].includes(
          v.status,
        ) ? (
        <Stopped view={v} />
      ) : (
        <OnTheWay view={v} now={now} pay={pay} handover={handover} />
      )}
    </MobileShell>
  );
}

function OnTheWay({
  view: v,
  now,
  pay,
  handover,
}: {
  view: TrackingView;
  now: Date;
  pay?: React.ReactNode;
  handover?: React.ReactNode;
}) {
  const roadside = v.deliveryMode === "ROADSIDE";
  const yourStop = v.stops.find((s) => s.isYourStop);
  const stopName = yourStop?.name ?? "your stop";
  const moving = v.status === "IN_TRANSIT";
  const badge = v.approaching
    ? { tone: "blue" as const, label: "Approaching" }
    : moving
      ? { tone: "blue" as const, label: "On the way" }
      : { tone: "neutral" as const, label: "Not on the road yet" };
  const title = !moving
    ? `Waiting to leave ${v.stops[0]?.name ?? "the park"}`
    : v.eta && v.eta.minutes === 0
      ? `Due at ${stopName} now`
      : v.eta && v.approaching
        ? `About ${v.eta.minutes} minutes from ${stopName}`
        : `On the way to ${stopName}`;
  const sub = !moving
    ? "We’ll text you when the bus leaves, with the time to expect it."
    : v.eta
      ? roadside
        ? `Be at ${stopName} by ${formatTime(v.eta.at)}. We’ll text you again when the bus is close.`
        : `Expected around ${formatTime(v.eta.at)}. We’ll text you when it’s ready to collect.`
      : null;

  return (
    <>
      {handover}
      <Card className="flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-1.5">
          <Badge tone={badge.tone} className="self-start">
            {badge.label}
          </Badge>
          <h1 className="text-title">{title}</h1>
          {sub ? <p className="text-sub text-fg-2">{sub}</p> : null}
        </div>
        <StopStrip stops={v.stops} now={now} />
        {v.driver && moving ? (
          <div className="flex items-center gap-3 border-t border-line pt-3">
            <Avatar name={v.driver.name} />
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sub font-medium">
                {v.driver.name}
              </span>
              <span className="truncate text-caption text-fg-3">
                {[v.driver.vehicleType, v.driver.vehiclePlate]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </div>
          </div>
        ) : null}
      </Card>

      {roadside && v.dues.podKobo > 0 ? (
        <Card className="flex flex-col gap-3 p-4">
          <div className="flex items-start gap-3">
            <Tile>
              <Wallet aria-hidden />
            </Tile>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sub font-medium">
                {formatNaira(v.dues.podKobo)} due before handover
              </span>
              <span className="text-small text-fg-2">
                The driver can only hand over once this is paid. Drivers never
                take cash.
              </span>
            </div>
          </div>
          {pay}
        </Card>
      ) : null}

      <Card className="px-4 py-2">
        <KeyValue
          label="Parcel"
          value={`${SIZE_LABELS[v.sizeClass].name} · ${v.category}`}
        />
        <KeyValue
          label="Sent"
          value={`${formatRelativeDay(v.sentAt, now)}, ${formatTime(v.sentAt)}`}
        />
        {!roadside && v.dues.podKobo > 0 ? (
          <KeyValue
            label="Due on collection"
            value={<Money kobo={v.dues.podKobo} />}
          />
        ) : null}
      </Card>

      {roadside ? (
        <p className="px-1 text-caption text-fg-3">
          Can’t make it? The parcel continues to{" "}
          {v.stops.at(-1)?.name ?? "the arrival park"} and you can collect it
          there. Your free storage starts when we tell you it’s arrived.
        </p>
      ) : null}
    </>
  );
}

/** Origin → (your roadside stop) → final stop, with times. */
export function StopStrip({
  stops,
  now,
}: {
  stops: TrackingStop[];
  now: Date;
}) {
  return (
    <ol className="grid auto-cols-fr grid-flow-col gap-2" aria-label="Stops">
      {stops.map((s, i) => {
        const note =
          s.kind === "origin"
            ? s.at && s.passed
              ? `Left ${formatTime(s.at)}`
              : "Not left yet"
            : s.isYourStop
              ? "Your stop"
              : s.kind === "destination"
                ? "Final stop"
                : s.at
                  ? formatTime(s.at)
                  : "";
        return (
          <li key={`${s.kind}-${i}`} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1">
              <span
                aria-hidden
                className={cn(
                  "size-2.5 shrink-0 rounded-full border-2",
                  s.passed
                    ? "border-fg bg-fg"
                    : s.isYourStop
                      ? "border-fg bg-volt"
                      : "border-line-strong bg-panel",
                )}
              />
              {i < stops.length - 1 ? (
                <span
                  aria-hidden
                  className={cn("h-0.5 flex-1", s.passed ? "bg-fg" : "bg-line")}
                />
              ) : null}
            </div>
            <span
              className={cn(
                "truncate text-small font-medium",
                s.isYourStop && "text-fg",
              )}
            >
              {s.name}
            </span>
            <span className="text-caption text-fg-3">
              {note}
              {s.isYourStop && s.at && !s.passed && minutesUntil(s.at, now) > 0
                ? ` · ${formatTime(s.at)}`
                : ""}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function ReadyToCollect({ view: v, now }: { view: TrackingView; now: Date }) {
  const a = v.arrival!;
  const windowMs =
    new Date(a.freeUntil).getTime() - new Date(a.arrivedAt).getTime();
  const leftMs = new Date(a.freeUntil).getTime() - now.getTime();
  const used =
    windowMs > 0 ? Math.min(1, Math.max(0, 1 - leftMs / windowMs)) : 1;
  const due = v.dues.totalKobo;
  const directions = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a.parkName)}`;
  return (
    <>
      <div className="flex flex-col gap-1.5 px-1 pt-1">
        <Badge tone="amber" className="self-start">
          Ready to collect
        </Badge>
        <h1 className="text-title">At {a.parkName}</h1>
        <p className="text-sub text-fg-2">
          Arrived {formatRelativeDay(a.arrivedAt, now).toLowerCase()} at{" "}
          {formatTime(a.arrivedAt)}
          {v.driver
            ? ` on ${v.driver.name}’s bus, ${v.driver.vehiclePlate}`
            : ""}
          .
        </p>
      </div>

      <Card className="flex flex-col gap-2 p-4">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-small text-fg-2">Free pickup until</span>
          <span className="text-sub font-semibold num">
            {formatDayTime(a.freeUntil)}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-sunken">
          <div
            className="h-full rounded-full bg-fg"
            style={{ width: `${Math.round(used * 100)}%` }}
          />
        </div>
        <div className="flex justify-between gap-3 text-caption text-fg-3">
          <span>{formatTimeLeft(a.freeUntil, now)}</span>
          <span>
            Then {formatNaira(a.dailyRateKobo)} a day · held up to{" "}
            {a.maxHoldDays} days
          </span>
        </div>
      </Card>

      <Card className="grid grid-cols-2 divide-x divide-line">
        <div className="flex flex-col gap-0.5 p-4">
          <span className="text-caption text-fg-3">Shelf</span>
          <Code className="text-heading">
            {a.bay ? `Bay ${a.bay}` : "At the counter"}
          </Code>
        </div>
        <div className="flex flex-col gap-0.5 p-4">
          <span className="text-caption text-fg-3">Due on collection</span>
          <Money kobo={due} className="text-heading" />
        </div>
      </Card>

      <Card className="flex flex-col gap-3 p-4">
        <span className="text-caption text-fg-3">How to collect</span>
        {[
          {
            title: "Go to the ParkTrack counter",
            sub: [a.counterLocationText ?? a.parkName, a.openingHoursText]
              .filter(Boolean)
              .join(" · "),
          },
          {
            title: "Scan the QR on the counter poster",
            sub: "Your collection code comes to this phone",
          },
          ...(due > 0
            ? [
                {
                  title: `Pay ${formatNaira(due)} due on your phone`,
                  sub: "Through Interswitch. No cash at the counter.",
                },
              ]
            : []),
          {
            title: "Read your code to the agent",
            sub: "They hand over your parcel",
          },
        ].map((step, i) => (
          <div key={step.title} className="flex items-start gap-3">
            <span
              aria-hidden
              className="grid size-[22px] shrink-0 place-items-center rounded-full bg-sunken text-[12px] font-semibold"
            >
              {i + 1}
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="text-sub font-medium">{step.title}</span>
              <span className="text-caption text-fg-3">{step.sub}</span>
            </div>
          </div>
        ))}
      </Card>

      <p className="px-1 text-caption text-fg-3">
        Sending someone else? Share this link with them. The code still comes to
        your phone, so you can call it through to them.
      </p>
      <a
        href={directions}
        target="_blank"
        rel="noreferrer"
        className={buttonVariants({ variant: "secondary", block: true })}
      >
        <MapPin aria-hidden /> Directions to the counter
      </a>
    </>
  );
}

function Finished({ view: v }: { view: TrackingView }) {
  const roadside = v.status === "DELIVERED_ROADSIDE" || !v.collected;
  const at = v.collected?.at;
  return (
    <Card className="flex flex-col gap-1.5 p-4">
      <Badge tone="green" className="self-start">
        {roadside ? "Handed over" : "Collected"}
      </Badge>
      <h1 className="text-title">
        {roadside ? "You have your parcel" : `Collected by ${v.collected!.by}`}
      </h1>
      {at ? (
        <p className="text-sub text-fg-2">
          {formatDayTime(at)}
          {v.collected?.releasedBy
            ? ` · released by ${v.collected.releasedBy}`
            : ""}
        </p>
      ) : null}
    </Card>
  );
}

function Stopped({ view: v }: { view: TrackingView }) {
  const text: Partial<Record<TrackingView["status"], string>> = {
    CANCELLED: `${v.senderName} cancelled this parcel.`,
    RETURNED: `This parcel went back to ${v.senderName}.`,
    UNCLAIMED:
      "This parcel wasn’t collected in time. The park will contact you.",
    DISPUTED: "ParkTrack is looking into this parcel. We’ll text you.",
  };
  return (
    <Card className="flex flex-col gap-1.5 p-4">
      <h1 className="text-heading">
        {text[v.status] ?? "No updates right now."}
      </h1>
    </Card>
  );
}
