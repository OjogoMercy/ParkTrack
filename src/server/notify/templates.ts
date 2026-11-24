import type { Audience, NotificationEvent } from "@/contracts/notifications";
import { formatDayTime, formatTime } from "@/lib/dates";
import { formatNaira } from "@/lib/money";

/**
 * Message text for every PRD §11 event and audience. Pure: ./context.ts
 * loads a MessageContext, these functions only format it. Plain text, short
 * enough for SMS, always with the parcel code and the right link for the
 * person. English first; Pidgin is P1 (sl9).
 *
 * Links per audience: sender → their parcel page on the origin park's site;
 * recipient → their signed tracking link (only from the drop-off handshake,
 * HS-7); driver → app/driver; agents → app/counter or app/arrivals; park
 * admin → app/park.
 */

export type MessageContext = {
  parcelCode: string;
  recipientName: string;
  senderName: string;
  originPark: { name: string; city: string };
  destinationPark: {
    name: string;
    city: string;
    counterLocationText: string | null;
  };
  deliveryMode: "PARK" | "ROADSIDE";
  roadsidePointName: string | null;
  bay: string | null;
  dropoffDeadline: Date | null;
  podAmountKobo: number;
  totalKobo: number;
  driver: { name: string | null; plate: string | null } | null;
  storage: { freeUntil: Date; dailyRateKobo: number };
  /** Typical minutes from origin to the drop point or park, for estimates. */
  minutesToDestination: number | null;
  links: {
    sender: string;
    booking: string;
    recipient: string | null;
    driver: string;
    originCounter: string;
    arrivals: string;
    parkAdmin: string;
  };
  now: Date;
  extra: Record<string, string | number>;
};

/** null = nothing to send (e.g. a code message without a code). */
type Template = (c: MessageContext) => string | null;

const where = (c: MessageContext) =>
  c.deliveryMode === "ROADSIDE" && c.roadsidePointName
    ? c.roadsidePointName
    : c.destinationPark.name;

const driverText = (c: MessageContext) =>
  c.driver?.name
    ? `${c.driver.name}${c.driver.plate ? ` (${c.driver.plate})` : ""}`
    : "the driver";

const eta = (c: MessageContext) =>
  c.minutesToDestination
    ? `Expected around ${formatTime(new Date(c.now.getTime() + c.minutesToDestination * 60_000))}`
    : "We'll tell you when it's close";

const link = (url: string | null) => (url ? ` ${url}` : "");

const TEMPLATES: Partial<Record<`${NotificationEvent}.${Audience}`, Template>> =
  {
    "booking_paid.sender": (c) =>
      `ParkTrack: payment received for ${c.parcelCode} (${formatNaira(c.totalKobo)}). Show your booking QR at ${c.originPark.name}${c.dropoffDeadline ? ` and drop it off by ${formatDayTime(c.dropoffDeadline)}` : ""}.${link(c.links.booking)}`,
    "booking_paid.origin_agent": (c) =>
      `ParkTrack: new paid booking ${c.parcelCode} to ${c.destinationPark.city}, waiting for drop-off.${link(c.links.originCounter)}`,

    "dropoff_deadline_near.sender": (c) =>
      `ParkTrack reminder: drop ${c.parcelCode} at ${c.originPark.name}${c.dropoffDeadline ? ` by ${formatDayTime(c.dropoffDeadline)}` : " soon"}, or the booking is cancelled and refunded.${link(c.links.booking)}`,

    "handshake_complete.sender": (c) =>
      `ParkTrack: ${c.originPark.name} has received ${c.parcelCode} for ${c.recipientName}. See the drop-off photo and follow it:${link(c.links.sender)}`,
    "handshake_complete.recipient": (c) =>
      `ParkTrack: ${c.senderName} sent you a parcel (${c.parcelCode}) from ${c.originPark.city}. ${c.deliveryMode === "ROADSIDE" && c.roadsidePointName ? `Meet the bus at ${c.roadsidePointName}` : `Collect it at ${c.destinationPark.name}`}. Follow it here:${link(c.links.recipient)}`,

    "assigned.driver": (c) =>
      `ParkTrack: new parcels are assigned to you at ${c.originPark.name}, including ${c.parcelCode}. Accept the load:${link(c.links.driver)}`,

    "load_accepted.sender": (c) =>
      `ParkTrack: ${c.parcelCode} is on the way with ${driverText(c)}. ${eta(c)}. Track it:${link(c.links.sender)}`,
    "load_accepted.recipient": (c) =>
      `ParkTrack: your parcel ${c.parcelCode} is on the way to ${where(c)}. ${eta(c)}.${link(c.links.recipient)}`,
    "load_accepted.origin_agent": (c) =>
      `ParkTrack: ${driverText(c)} accepted the load with ${c.parcelCode}.${link(c.links.originCounter)}`,

    "bus_approaching.recipient": (c) =>
      `ParkTrack: the bus with ${c.parcelCode} is about ${c.extra.minutes ?? 20} minutes from ${where(c)}.${c.podAmountKobo > 0 ? ` Pay ${formatNaira(c.podAmountKobo)} now so the driver can hand it over.` : ""}${link(c.links.recipient)}`,

    "delivered_roadside.sender": (c) =>
      `ParkTrack: ${c.parcelCode} was handed to ${c.recipientName} at ${where(c)}. Proof of delivery:${link(c.links.sender)}`,
    "delivered_roadside.recipient": (c) =>
      `ParkTrack: you received ${c.parcelCode}. Your receipt:${link(c.links.recipient)}`,
    "delivered_roadside.driver": (c) =>
      `ParkTrack: ${c.parcelCode} delivered. Your earnings have been credited.${link(c.links.driver)}`,

    "roadside_missed.sender": (c) =>
      `ParkTrack: ${c.recipientName} missed the bus at ${c.roadsidePointName ?? "the drop point"}. ${c.parcelCode} is going on to ${c.destinationPark.name} for collection.${link(c.links.sender)}`,
    "roadside_missed.recipient": (c) =>
      `ParkTrack: you missed the bus at ${c.roadsidePointName ?? "the drop point"}. Collect ${c.parcelCode} at ${c.destinationPark.name}; we'll message you when it arrives.${link(c.links.recipient)}`,
    "roadside_missed.arrival_agent": (c) =>
      `ParkTrack: ${c.parcelCode} missed its roadside drop and is coming to your counter on this load.${link(c.links.arrivals)}`,

    "arrived_at_park.sender": (c) =>
      `ParkTrack: ${c.parcelCode} has arrived at ${c.destinationPark.name}.${link(c.links.sender)}`,
    "arrived_at_park.recipient": (c) =>
      `ParkTrack: your parcel ${c.parcelCode} is at ${c.destinationPark.name}${c.bay ? `, bay ${c.bay}` : ""}${c.destinationPark.counterLocationText ? ` (${c.destinationPark.counterLocationText})` : ""}. Free storage until ${formatDayTime(c.storage.freeUntil)}, then ${formatNaira(c.storage.dailyRateKobo)} a day.${c.podAmountKobo > 0 ? ` ${formatNaira(c.podAmountKobo)} to pay on collection.` : ""}${link(c.links.recipient)}`,

    "storage_reminder.recipient": (c) =>
      `ParkTrack: ${c.parcelCode} is waiting for you at ${c.destinationPark.name}. ${c.storage.freeUntil > c.now ? `Free storage ends ${formatDayTime(c.storage.freeUntil)}` : `Storage is now ${formatNaira(c.storage.dailyRateKobo)} a day`}.${link(c.links.recipient)}`,

    "collection_started.recipient": (c) =>
      !c.extra.code
        ? null
        : c.extra.purpose === "ROADSIDE"
          ? `ParkTrack: your handover code for ${c.parcelCode} is ${c.extra.code}. Give it to the driver only when the parcel is in your hands.${link(c.links.recipient)}`
          : `ParkTrack: your collection code for ${c.parcelCode} is ${c.extra.code}. Valid for 10 minutes. Only read it to the agent at the counter.${link(c.links.recipient)}`,

    "collected.sender": (c) =>
      `ParkTrack: ${c.parcelCode} was collected at ${c.destinationPark.name} at ${formatTime(c.now)}. Proof of delivery:${link(c.links.sender)}`,
    "collected.recipient": (c) =>
      `ParkTrack: you collected ${c.parcelCode}. Your receipt:${link(c.links.recipient)}`,
    "collected.driver": (c) =>
      `ParkTrack: ${c.parcelCode} was collected. Your earnings have been credited.${link(c.links.driver)}`,

    "missing_at_tickoff.sender": (c) =>
      `ParkTrack: ${c.parcelCode} wasn't on the bus when it reached ${c.destinationPark.name}. We've opened a case and will update you.${link(c.links.sender)}`,
    "missing_at_tickoff.recipient": (c) =>
      `ParkTrack: there's a delay with ${c.parcelCode}. It wasn't found at ${c.destinationPark.name} on arrival; we're on it and will update you.${link(c.links.recipient)}`,
    "missing_at_tickoff.park_admin": (c) =>
      `ParkTrack: dispute opened. ${c.parcelCode} was missing at tick-off at ${c.destinationPark.name} (driver: ${driverText(c)}).${link(c.links.parkAdmin)}`,
    "missing_at_tickoff.driver": (c) =>
      `ParkTrack: ${c.parcelCode} was missing at tick-off at ${c.destinationPark.name}. A dispute is open; please speak to the park.${link(c.links.driver)}`,

    "payment_receipt.sender": (c) =>
      `ParkTrack: payment of ${formatNaira(Number(c.extra.amountKobo ?? c.totalKobo))} received for ${c.parcelCode}${c.extra.txnRef ? ` (ref ${c.extra.txnRef})` : ""}.${link(c.links.sender)}`,
  };

/** The text for one person, or null when the matrix sends them nothing. */
export function renderMessage(
  event: NotificationEvent,
  audience: Audience,
  context: MessageContext,
): string | null {
  const template = TEMPLATES[`${event}.${audience}`];
  return template ? template(context) : null;
}

/** Sign-in and handshake codes (sendCode). No parcel, no link. */
export function renderCodeMessage(code: string): string {
  return `${code} is your ParkTrack code. Use it within a few minutes. Never share it with anyone, including park staff.`;
}

/** Template ids that exist, for tests and the log. */
export function templateIds(): string[] {
  return Object.keys(TEMPLATES);
}
