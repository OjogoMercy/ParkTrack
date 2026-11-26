import type {
  DeliveryMode,
  ParcelEventType,
  ParcelStatus,
} from "@/contracts/enums";

/**
 * Pure tracking rules shared by the sender page (S09–S11) and the
 * recipient link (R01–R03): ETAs from route timing (TRK-3 basic), the
 * "approaching" flag (RD-2) and timeline titles. No database.
 */

/** A roadside recipient is "approaching" this many minutes out (RD-2). */
export const APPROACH_MINUTES = 20;

/** Statuses in which the parcel is moving with a driver. */
export const ON_THE_ROAD: ParcelStatus[] = ["IN_TRANSIT"];

const MINUTE = 60_000;

export type JourneyInput = {
  status: ParcelStatus;
  deliveryMode: DeliveryMode;
  /** Minutes from the origin to the recipient's roadside point, if roadside. */
  roadsideMinutes: number | null;
  /** Route's typical journey time to the arrival park. */
  typicalMinutes: number;
  /** When the trip left (departed, else accepted); null before that. */
  startedAt: Date | null;
  now: Date;
};

/**
 * When the bus should reach the recipient's stop (their roadside point, or
 * the arrival park), while the parcel is on the road. Null otherwise.
 * `minutes` never goes below 0: a late bus is "due now".
 */
export function parcelEta(
  input: JourneyInput,
): { minutes: number; at: string } | null {
  if (!ON_THE_ROAD.includes(input.status) || !input.startedAt) return null;
  const target =
    input.deliveryMode === "ROADSIDE" && input.roadsideMinutes !== null
      ? input.roadsideMinutes
      : input.typicalMinutes;
  const at = new Date(input.startedAt.getTime() + target * MINUTE);
  const minutes = Math.max(
    0,
    Math.round((at.getTime() - input.now.getTime()) / MINUTE),
  );
  return { minutes, at: at.toISOString() };
}

/** RD-2: a roadside parcel within APPROACH_MINUTES of its stop. */
export function isApproaching(
  input: JourneyInput,
  eta = parcelEta(input),
): boolean {
  return (
    input.deliveryMode === "ROADSIDE" &&
    eta !== null &&
    eta.minutes <= APPROACH_MINUTES
  );
}

/** ETA for a stop `minutes` from the origin, once the trip has started. */
export function stopTime(
  startedAt: Date | null,
  minutes: number,
): string | null {
  return startedAt
    ? new Date(startedAt.getTime() + minutes * MINUTE).toISOString()
    : null;
}

export type TitleContext = {
  originName: string;
  destinationName: string;
  roadsidePointName: string | null;
  recipientName: string;
  /** Driver on the trip the event belongs to, if known. */
  driverName: string | null;
  /** Staff member who recorded the event, if any. */
  actorName: string | null;
};

const first = (name: string | null) => name?.trim().split(/\s+/)[0] ?? null;

/**
 * Sender-facing title and sub-line for a parcel event (S10 timeline), or
 * null for events the sender doesn't need to see (internal notes, codes).
 */
export function timelineTitle(
  type: ParcelEventType,
  to: ParcelStatus,
  ctx: TitleContext,
): { title: string; sub: string | null } | null {
  const by = first(ctx.actorName);
  switch (type) {
    case "CREATED":
      return null; // a draft isn't a step; "Booked and paid" is
    case "PAID":
      return { title: "Booked and paid", sub: null };
    case "DROPOFF":
      return {
        title: `Dropped off at ${shortPark(ctx.originName)}`,
        sub: by ? `Checked in by ${by} · photo taken` : null,
      };
    case "ASSIGN":
      return {
        title: ctx.driverName
          ? `Assigned to ${first(ctx.driverName)}’s bus`
          : "Assigned to a bus",
        sub: null,
      };
    case "UNASSIGN":
      return { title: "Back at the counter for another bus", sub: null };
    case "ACCEPT":
      return {
        title: ctx.driverName
          ? `Load accepted by ${first(ctx.driverName)}`
          : "Load accepted by the driver",
        sub: null,
      };
    case "ROADSIDE_DELIVERED":
      return {
        title: `Handed over at ${ctx.roadsidePointName ?? "the roadside stop"}`,
        sub: `Code verified with ${first(ctx.recipientName)}`,
      };
    case "ROADSIDE_MISSED":
      return {
        title: `Missed at ${ctx.roadsidePointName ?? "the roadside stop"}`,
        sub: `It continues to ${ctx.destinationName} for collection`,
      };
    case "TICK_OFF":
    case "MANIFEST_RECEIVED":
      return to === "ARRIVED"
        ? { title: `Ready at ${ctx.destinationName}`, sub: null }
        : null;
    case "COLLECTED":
      return { title: `Collected by ${first(ctx.recipientName)}`, sub: null };
    case "SETTLED":
      return { title: "Payment settled", sub: null };
    case "MISSING":
      return {
        title: "Not found at tick-off",
        sub: "ParkTrack is looking into it",
      };
    case "DAMAGED":
      return { title: "Reported damaged", sub: null };
    case "UNCLAIMED":
      return { title: "Not collected in time", sub: null };
    case "RETURNED":
      return { title: "Returned to you", sub: null };
    case "DISPUTED":
      return { title: "Under review", sub: "ParkTrack is looking into it" };
    case "RESOLVED":
      return { title: "Review closed", sub: null };
    case "CANCELLED":
      return { title: "Booking cancelled", sub: null };
    default:
      return null; // HANDSHAKE, PHOTO, COLLECTION_CODE_ISSUED, NOTE
  }
}

/** "Ogbomoso Motor Park" → "Ogbomoso"; "Iwo Road Park" → "Iwo Road". */
export function shortPark(name: string): string {
  return name.replace(/\s+(motor\s+)?park$/i, "").trim() || name;
}
