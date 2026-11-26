import { Info, PackageOpen } from "lucide-react";
import type { DriverLoad, LoadParcel, LoadStop } from "@/contracts/dto";
import { SIZE_LABELS } from "@/contracts/enums";
import { Badge } from "@/components/ui/badge";
import { Avatar, CodeTag } from "@/components/ui/display";
import { BottomBar, MobileShell, TopBar } from "@/components/ui/shells";
import { Card, List, Notice } from "@/components/ui/surface";
import { formatTime } from "@/lib/dates";

/**
 * D01 "Your load": the parcels assigned to the driver, grouped by stop in
 * route order (roadside stops first, then the arrival park), and the one
 * button that makes them the holder. `accept` is the bottom-bar action
 * (the Accept load button, sl2).
 */
export function LoadView({
  load,
  driverName,
  accept,
}: {
  load: DriverLoad;
  driverName: string;
  accept?: React.ReactNode;
}) {
  const { trip } = load;
  const count = load.stops.reduce((n, s) => n + s.parcels.length, 0);
  const topBar = (
    <TopBar
      className="pl-4"
      title="Your load"
      sub={
        trip
          ? `${trip.vehiclePlate} · ${trip.origin.city} → ${trip.destination.city}`
          : undefined
      }
      trailing={<Avatar name={driverName} />}
    />
  );

  if (!trip) {
    return (
      <MobileShell topBar={topBar} className="gap-4 px-4 pt-8">
        <Card className="flex flex-col items-center gap-2 px-6 py-8 text-center">
          <PackageOpen className="size-6 text-fg-3" aria-hidden />
          <h1 className="text-heading">No load yet</h1>
          <p className="text-sub text-fg-2">
            When an agent assigns parcels to you, we’ll message you and they’ll
            show up here.
          </p>
        </Card>
      </MobileShell>
    );
  }

  const loading = trip.status === "LOADING";
  return (
    <MobileShell
      topBar={topBar}
      className="gap-3.5 px-4 pt-4 pb-6"
      bottomBar={
        loading ? (
          <BottomBar>
            {accept}
            <p className="text-center text-caption text-fg-3">
              Location sharing starts while the app is open
            </p>
          </BottomBar>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-1 px-1 pt-1">
        <h1 className="text-title">
          {count} {count === 1 ? "parcel" : "parcels"} for you
        </h1>
        <p className="text-sub text-fg-2">
          {loading
            ? `Assigned by ${trip.assignedByName} at ${formatTime(trip.assignedAt)}. Check each one is on the bus, in route order.`
            : `You accepted this load${trip.acceptedAt ? ` at ${formatTime(trip.acceptedAt)}` : ""}.`}
        </p>
      </div>

      {load.stops.map((stop) => (
        <StopCard key={`${stop.kind}-${stop.order}`} stop={stop} />
      ))}

      {loading ? (
        <Notice icon={<Info />}>
          When you accept, you become the holder of these parcels until each one
          is handed over or ticked off.
        </Notice>
      ) : null}
    </MobileShell>
  );
}

function StopCard({ stop }: { stop: LoadStop }) {
  const n = stop.parcels.length;
  const sub =
    stop.kind === "roadside"
      ? `Roadside · ${n} ${n === 1 ? "handover" : "handovers"}`
      : `Arrival park · ${n} ${n === 1 ? "parcel" : "parcels"}`;
  return (
    <Card>
      <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
        <span
          aria-hidden
          className="grid size-[22px] shrink-0 place-items-center rounded-full bg-fg text-[12px] font-semibold text-bg"
        >
          {stop.order}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 className="truncate text-[15px] font-semibold">
            <span className="sr-only">Stop {stop.order}: </span>
            {stop.name}
          </h2>
          <span className="text-caption text-fg-3">{sub}</span>
        </div>
      </div>
      <List>
        {stop.parcels.map((p) => (
          <ParcelRow
            key={p.parcelId}
            parcel={p}
            roadside={stop.kind === "roadside"}
          />
        ))}
      </List>
    </Card>
  );
}

function ParcelRow({
  parcel,
  roadside,
}: {
  parcel: LoadParcel;
  roadside: boolean;
}) {
  const size = SIZE_LABELS[parcel.sizeClass].name;
  return (
    <div className="flex items-center gap-3 border-t border-line px-4 py-3 first:border-t-0">
      <CodeTag>{parcel.parcelCode}</CodeTag>
      <span className="min-w-0 flex-1 truncate text-small text-fg-2">
        {roadside ? `${size} · ${parcel.recipientName}` : size}
      </span>
      {roadside ? (
        parcel.duesPaid ? (
          <Badge tone="green">Paid</Badge>
        ) : (
          <Badge tone="amber">Not paid yet</Badge>
        )
      ) : null}
    </div>
  );
}
