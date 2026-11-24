import type { ParcelEventType, ParcelStatus } from "@/contracts/enums";
import type { NotificationEvent } from "@/contracts/notifications";
import type { Actor, Transition } from "@/contracts/states";

/**
 * What each allowed move in src/contracts/states.ts records and announces.
 * Pure data and functions, so every rule is unit-tested without a database.
 */

/** The parcel_events type written for a move, unless the caller names one. */
export function eventTypeFor(
  from: ParcelStatus,
  to: ParcelStatus,
): ParcelEventType {
  if (from === "DISPUTED") return "RESOLVED"; // closed: back, or resolved
  if (from === "ASSIGNED" && to === "RECEIVED_AT_ORIGIN") return "UNASSIGN";
  switch (to) {
    case "AWAITING_DROPOFF":
      return "PAID";
    case "RECEIVED_AT_ORIGIN":
      return "DROPOFF";
    case "ASSIGNED":
      return "ASSIGN";
    case "IN_TRANSIT":
      return "ACCEPT";
    case "DELIVERED_ROADSIDE":
      return "ROADSIDE_DELIVERED";
    case "ARRIVED":
      return "TICK_OFF";
    case "COLLECTED":
      return "COLLECTED";
    case "UNCLAIMED":
      return "UNCLAIMED";
    case "RETURNED":
      return "RETURNED";
    case "SETTLED":
      return "SETTLED";
    case "DISPUTED":
      return "DISPUTED";
    case "RESOLVED":
      return "RESOLVED";
    case "CANCELLED":
      return "CANCELLED";
    default:
      return "NOTE";
  }
}

/**
 * The PRD §11 message a move triggers, sent after the change is saved.
 * Missing at tick-off is IN_TRANSIT → DISPUTED with event type MISSING.
 * Messages not tied to a status change (drop-off deadline, bus approaching,
 * storage reminder, collection code, roadside missed) are sent by the code
 * that causes them.
 */
export function notificationFor(
  from: ParcelStatus,
  to: ParcelStatus,
  eventType: ParcelEventType,
): NotificationEvent | null {
  if (from === "DRAFT" && to === "AWAITING_DROPOFF") return "booking_paid";
  if (from === "AWAITING_DROPOFF" && to === "RECEIVED_AT_ORIGIN")
    return "handshake_complete"; // first message to the recipient (HS-7)
  if (from === "RECEIVED_AT_ORIGIN" && to === "ASSIGNED") return "assigned";
  if (from === "ASSIGNED" && to === "IN_TRANSIT") return "load_accepted";
  if (from === "IN_TRANSIT" && to === "DELIVERED_ROADSIDE")
    return "delivered_roadside";
  if (from === "IN_TRANSIT" && to === "ARRIVED") return "arrived_at_park";
  if (from === "IN_TRANSIT" && to === "DISPUTED" && eventType === "MISSING")
    return "missing_at_tickoff";
  if ((from === "ARRIVED" || from === "UNCLAIMED") && to === "COLLECTED")
    return "collected";
  return null;
}

/**
 * Which park's staff may make a move: the origin park handles drop-off,
 * assignment and cancelling before loading; the destination park handles
 * tick-off, release, returns and disputes raised there. Park admins
 * closing a dispute may belong to either park.
 */
export function parkSideOf(
  t: Pick<Transition, "from" | "to">,
): "origin" | "destination" | "either" {
  if (t.from === "DISPUTED") return "either";
  switch (t.from) {
    case "DRAFT":
    case "AWAITING_DROPOFF":
    case "RECEIVED_AT_ORIGIN":
    case "ASSIGNED":
      return "origin";
    default:
      return "destination";
  }
}

export type ActorCheckInput = {
  transition: Pick<Transition, "from" | "to" | "by">;
  actor: Actor;
  /** The acting user, loaded from the database; required for role actors. */
  user: {
    id: string;
    role: string;
    status: string;
    parkId: string | null;
  } | null;
  parcel: {
    originParkId: string;
    destinationParkId: string;
    senderId: string | null;
    driverIds: string[];
  };
};

/**
 * Null when the actor may make this move on this parcel, otherwise the
 * reason (shown to the person). Checks the role is allowed by the state
 * table, that a person acts as their own active role, and tenancy: the
 * sender of the parcel, a driver carrying it, staff of the right park.
 */
export function actorProblem({
  transition,
  actor,
  user,
  parcel,
}: ActorCheckInput): string | null {
  if (!transition.by.includes(actor)) {
    return "You can't make this change to the parcel.";
  }
  if (actor === "SYSTEM" || actor === "RECIPIENT") return null;

  if (!user) return "Sign in to continue.";
  if (user.status !== "ACTIVE" || user.role !== actor) {
    return "You can't make this change to the parcel.";
  }

  switch (actor) {
    case "PLATFORM_ADMIN":
      return null;
    case "SENDER":
      return parcel.senderId === user.id
        ? null
        : "Only the sender can change this parcel.";
    case "DRIVER":
      return parcel.driverIds.includes(user.id)
        ? null
        : "This parcel isn't on your load.";
    case "AGENT":
    case "PARK_ADMIN": {
      const side = parkSideOf(transition);
      const ok =
        (side !== "destination" && user.parkId === parcel.originParkId) ||
        (side !== "origin" && user.parkId === parcel.destinationParkId);
      return ok ? null : "This parcel belongs to another park.";
    }
    default:
      return "You can't make this change to the parcel.";
  }
}
