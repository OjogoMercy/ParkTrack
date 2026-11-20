import type { ParcelStatus, Role } from "./enums";

/**
 * Parcel lifecycle (PRD §8) as data. Only the transitions listed here are
 * allowed; every transition writes a parcel_events row (Scope 03 transition()).
 * FROZEN: changing this table is a contract change (WORKFLOW §7).
 *
 * Actors are roles plus two non-role actors:
 *   SYSTEM    — payment verification, scheduled jobs, settlement
 *   RECIPIENT — acting through a signed tracking link (no account)
 */
export type Actor = Role | "SYSTEM" | "RECIPIENT";

export type Transition = {
  from: ParcelStatus;
  to: ParcelStatus;
  by: readonly Actor[];
  /** What causes it, in plain words (PRD §8 "Entered by"). */
  when: string;
};

/** States a parcel can be in when a dispute opens; it may return to any of them. */
export const DISPUTABLE_STATES = [
  "IN_TRANSIT",
  "DELIVERED_ROADSIDE",
  "ARRIVED",
  "COLLECTED",
] as const satisfies readonly ParcelStatus[];

export const TRANSITIONS: readonly Transition[] = [
  // Booking and payment
  {
    from: "DRAFT",
    to: "AWAITING_DROPOFF",
    by: ["SYSTEM"],
    when: "shipping fee verified by Interswitch requery",
  },
  {
    from: "DRAFT",
    to: "CANCELLED",
    by: ["SENDER", "AGENT", "SYSTEM"],
    when: "booking abandoned or draft expired (24 h)",
  },
  {
    from: "AWAITING_DROPOFF",
    to: "RECEIVED_AT_ORIGIN",
    by: ["AGENT"],
    when: "handshake done, code written, drop-off photo taken",
  },
  {
    from: "AWAITING_DROPOFF",
    to: "CANCELLED",
    by: ["SENDER", "AGENT", "SYSTEM"],
    when: "cancelled before drop-off or drop-off deadline passed (refund)",
  },
  // At the origin park
  {
    from: "RECEIVED_AT_ORIGIN",
    to: "ASSIGNED",
    by: ["AGENT"],
    when: "assigned to a driver and trip",
  },
  {
    from: "RECEIVED_AT_ORIGIN",
    to: "CANCELLED",
    by: ["SENDER", "AGENT"],
    when: "cancelled or refused before loading (refund)",
  },
  {
    from: "ASSIGNED",
    to: "IN_TRANSIT",
    by: ["DRIVER"],
    when: "driver tapped Accept load",
  },
  {
    from: "ASSIGNED",
    to: "RECEIVED_AT_ORIGIN",
    by: ["AGENT"],
    when: "reassigned before the driver accepted",
  },
  // On the road
  {
    from: "IN_TRANSIT",
    to: "DELIVERED_ROADSIDE",
    by: ["DRIVER"],
    when: "roadside handover with the recipient's code",
  },
  {
    from: "IN_TRANSIT",
    to: "ARRIVED",
    by: ["AGENT"],
    when: "ticked off at the arrival park",
  },
  {
    from: "IN_TRANSIT",
    to: "DISPUTED",
    by: ["AGENT", "SENDER", "RECIPIENT", "SYSTEM"],
    when: "missing at tick-off, or a dispute is opened",
  },
  // Delivered
  {
    from: "DELIVERED_ROADSIDE",
    to: "SETTLED",
    by: ["SYSTEM"],
    when: "ledger split recorded",
  },
  {
    from: "DELIVERED_ROADSIDE",
    to: "DISPUTED",
    by: ["SENDER", "RECIPIENT", "SYSTEM"],
    when: "dispute opened",
  },
  // At the arrival park
  {
    from: "ARRIVED",
    to: "COLLECTED",
    by: ["AGENT"],
    when: "released with the collection code and dues paid",
  },
  {
    from: "ARRIVED",
    to: "UNCLAIMED",
    by: ["SYSTEM"],
    when: "maximum hold period passed (7 days)",
  },
  {
    from: "ARRIVED",
    to: "DISPUTED",
    by: ["AGENT", "SENDER", "RECIPIENT", "SYSTEM"],
    when: "dispute opened (e.g. damaged)",
  },
  {
    from: "COLLECTED",
    to: "SETTLED",
    by: ["SYSTEM"],
    when: "ledger split recorded",
  },
  {
    from: "COLLECTED",
    to: "DISPUTED",
    by: ["SENDER", "RECIPIENT", "SYSTEM"],
    when: "dispute opened",
  },
  {
    from: "UNCLAIMED",
    to: "COLLECTED",
    by: ["AGENT"],
    when: "collected late, with storage fees paid",
  },
  {
    from: "UNCLAIMED",
    to: "RETURNED",
    by: ["AGENT", "SYSTEM"],
    when: "sent back to the sender on a return booking",
  },
  // Disputes: back to the state it came from, or resolved
  ...DISPUTABLE_STATES.map((s): Transition => ({
    from: "DISPUTED",
    to: s,
    by: ["PLATFORM_ADMIN", "PARK_ADMIN"],
    when: "dispute closed; parcel returns to its previous state",
  })),
  {
    from: "DISPUTED",
    to: "RESOLVED",
    by: ["PLATFORM_ADMIN"],
    when: "refund or insurance claim completed",
  },
];

/** States with no way out. */
export const FINAL_STATES = [
  "SETTLED",
  "RETURNED",
  "RESOLVED",
  "CANCELLED",
] as const satisfies readonly ParcelStatus[];

/** Cancellation is refunded in full only before the driver accepts (PRD §9). */
export const REFUNDABLE_CANCEL_STATES = [
  "AWAITING_DROPOFF",
  "RECEIVED_AT_ORIGIN",
] as const satisfies readonly ParcelStatus[];

export function findTransition(
  from: ParcelStatus,
  to: ParcelStatus,
): Transition | undefined {
  return TRANSITIONS.find((t) => t.from === from && t.to === to);
}

export function canTransition(
  from: ParcelStatus,
  to: ParcelStatus,
  actor?: Actor,
): boolean {
  const t = findTransition(from, to);
  if (!t) return false;
  return actor === undefined || t.by.includes(actor);
}

export function nextStates(from: ParcelStatus): ParcelStatus[] {
  return TRANSITIONS.filter((t) => t.from === from).map((t) => t.to);
}

export function isFinal(status: ParcelStatus): boolean {
  return (FINAL_STATES as readonly ParcelStatus[]).includes(status);
}
