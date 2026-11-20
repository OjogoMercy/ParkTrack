import { z } from "zod";

/**
 * Notification events (PRD §11). Feature scopes call
 * notify(event, parcelId, extra) from @/server/notify; Scope 03 owns the
 * templates and channels. FROZEN: add events only at the end.
 */
export const NOTIFICATION_EVENTS = [
  "booking_paid",
  "dropoff_deadline_near",
  "handshake_complete",
  "assigned",
  "load_accepted",
  "bus_approaching",
  "delivered_roadside",
  "roadside_missed",
  "arrived_at_park",
  "storage_reminder",
  "collection_started",
  "collected",
  "missing_at_tickoff",
  "payment_receipt",
  "otp",
] as const;
export const NotificationEvent = z.enum(NOTIFICATION_EVENTS);
export type NotificationEvent = z.infer<typeof NotificationEvent>;

export type Audience =
  | "sender"
  | "recipient"
  | "driver"
  | "origin_agent"
  | "arrival_agent"
  | "park_admin";

/** Who hears about each event (PRD §11 matrix). */
export const NOTIFICATION_AUDIENCE: Record<
  NotificationEvent,
  readonly Audience[]
> = {
  booking_paid: ["sender", "origin_agent"],
  dropoff_deadline_near: ["sender"],
  // The recipient hears about a parcel only after the drop-off handshake (HS-7).
  handshake_complete: ["sender", "recipient"],
  assigned: ["driver"],
  load_accepted: ["sender", "recipient", "origin_agent"],
  bus_approaching: ["recipient"],
  delivered_roadside: ["sender", "recipient", "driver"],
  roadside_missed: ["sender", "recipient", "arrival_agent"],
  arrived_at_park: ["sender", "recipient"],
  storage_reminder: ["recipient"],
  collection_started: ["recipient"],
  collected: ["sender", "recipient", "driver"],
  missing_at_tickoff: ["sender", "recipient", "park_admin", "driver"],
  payment_receipt: ["sender"],
  otp: [],
};
