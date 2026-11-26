import { z } from "zod";

/**
 * Shared enums. Browser-safe (no Prisma import). Values match the Prisma
 * enums exactly; tests/contracts/enums-sync.test.ts fails if they drift.
 * FROZEN: add values only at the end, through a contract/* PR.
 */

/**
 * Every person is a USER: sending or receiving is what they do with a
 * parcel, not a role (Q45). A vendor is a USER with a vendor profile. Staff
 * roles belong to one park.
 */
export const ROLES = [
  "USER",
  "AGENT",
  "DRIVER",
  "PARK_ADMIN",
  "PLATFORM_ADMIN",
] as const;
export const Role = z.enum(ROLES);
export type Role = z.infer<typeof Role>;

export const PARCEL_STATUSES = [
  "DRAFT",
  "AWAITING_DROPOFF",
  "RECEIVED_AT_ORIGIN",
  "ASSIGNED",
  "IN_TRANSIT",
  "DELIVERED_ROADSIDE",
  "ARRIVED",
  "COLLECTED",
  "SETTLED",
  "UNCLAIMED",
  "RETURNED",
  "DISPUTED",
  "RESOLVED",
  "CANCELLED",
] as const;
export const ParcelStatus = z.enum(PARCEL_STATUSES);
export type ParcelStatus = z.infer<typeof ParcelStatus>;

export const SIZE_CLASSES = ["S", "M", "L"] as const;
export const SizeClass = z.enum(SIZE_CLASSES);
export type SizeClass = z.infer<typeof SizeClass>;

export const SIZE_LABELS: Record<SizeClass, { name: string; hint: string }> = {
  S: { name: "Small", hint: "Shoebox or smaller" },
  M: { name: "Medium", hint: "Travel bag size" },
  L: { name: "Large", hint: "Sack or big carton" },
};

export const DELIVERY_MODES = ["ROADSIDE", "PARK"] as const;
export const DeliveryMode = z.enum(DELIVERY_MODES);
export type DeliveryMode = z.infer<typeof DeliveryMode>;

export const CREATED_BY = ["SENDER", "AGENT"] as const;
export const CreatedBy = z.enum(CREATED_BY);
export type CreatedBy = z.infer<typeof CreatedBy>;

export const HANDSHAKE_METHODS = [
  "AGENT_SCAN",
  "SENDER_SCAN",
  "SMS_CODE",
] as const;
export const HandshakeMethod = z.enum(HANDSHAKE_METHODS);
export type HandshakeMethod = z.infer<typeof HandshakeMethod>;

export const PARCEL_EVENT_TYPES = [
  "CREATED",
  "PAID",
  "HANDSHAKE",
  "PHOTO",
  "DROPOFF",
  "ASSIGN",
  "UNASSIGN",
  "ACCEPT",
  "ROADSIDE_DELIVERED",
  "ROADSIDE_MISSED",
  "MANIFEST_RECEIVED",
  "TICK_OFF",
  "MISSING",
  "DAMAGED",
  "COLLECTION_CODE_ISSUED",
  "COLLECTED",
  "SETTLED",
  "UNCLAIMED",
  "RETURNED",
  "DISPUTED",
  "RESOLVED",
  "CANCELLED",
  "NOTE",
] as const;
export const ParcelEventType = z.enum(PARCEL_EVENT_TYPES);
export type ParcelEventType = z.infer<typeof ParcelEventType>;

export const TRIP_STATUSES = [
  "LOADING",
  "IN_TRANSIT",
  "ARRIVED",
  "CLOSED",
] as const;
export const TripStatus = z.enum(TRIP_STATUSES);
export type TripStatus = z.infer<typeof TripStatus>;

export const CODE_PURPOSES = ["ROADSIDE", "COUNTER"] as const;
export const CodePurpose = z.enum(CODE_PURPOSES);
export type CodePurpose = z.infer<typeof CodePurpose>;

export const COLLECTOR_KINDS = ["RECIPIENT", "DELEGATE"] as const;
export const CollectorKind = z.enum(COLLECTOR_KINDS);
export type CollectorKind = z.infer<typeof CollectorKind>;

export const PAYMENT_PURPOSES = [
  "SHIPPING",
  "TOP_UP",
  "INSURANCE",
  "POD",
  "STORAGE",
  "REFUND",
] as const;
export const PaymentPurpose = z.enum(PAYMENT_PURPOSES);
export type PaymentPurpose = z.infer<typeof PaymentPurpose>;

export const PAYMENT_STATUSES = ["PENDING", "VERIFIED", "FAILED"] as const;
export const PaymentStatus = z.enum(PAYMENT_STATUSES);
export type PaymentStatus = z.infer<typeof PaymentStatus>;

export const LEDGER_ACCOUNTS = [
  "HELD",
  "VENDOR",
  "DRIVER",
  "PARK",
  "PLATFORM",
  "INSURER",
  "SENDER",
] as const;
export const LedgerAccount = z.enum(LEDGER_ACCOUNTS);
export type LedgerAccount = z.infer<typeof LedgerAccount>;

export const NOTIFICATION_CHANNELS = ["WHATSAPP", "SMS", "CONSOLE"] as const;
export const NotificationChannel = z.enum(NOTIFICATION_CHANNELS);
export type NotificationChannel = z.infer<typeof NotificationChannel>;

export const LANGUAGES = ["EN", "PCM"] as const;
export const Language = z.enum(LANGUAGES);
export type Language = z.infer<typeof Language>;

export const DISPUTE_TYPES = [
  "DAMAGED",
  "MISSING",
  "WRONG_ITEM",
  "OVERCHARGED",
] as const;
export const DisputeType = z.enum(DISPUTE_TYPES);
export type DisputeType = z.infer<typeof DisputeType>;

export const DISPUTE_STATUSES = ["OPEN", "RESOLVED", "REJECTED"] as const;
export const DisputeStatus = z.enum(DISPUTE_STATUSES);
export type DisputeStatus = z.infer<typeof DisputeStatus>;

export const PARK_STATUSES = ["ONBOARDING", "LIVE", "SUSPENDED"] as const;
export const ParkStatus = z.enum(PARK_STATUSES);
export type ParkStatus = z.infer<typeof ParkStatus>;

export const USER_STATUSES = ["ACTIVE", "INVITED", "DEACTIVATED"] as const;
export const UserStatus = z.enum(USER_STATUSES);
export type UserStatus = z.infer<typeof UserStatus>;

/** Item categories offered at booking. Prohibited ones are blocked (BOOK-8). */
export const ITEM_CATEGORIES = [
  "Clothing & fabric",
  "Documents",
  "Electronics",
  "Food items (sealed)",
  "Phones & accessories",
  "Cosmetics",
  "Household items",
  "Books & stationery",
  "Shoes & bags",
  "Spare parts",
  "Other",
] as const;
export const ItemCategory = z.enum(ITEM_CATEGORIES);
export type ItemCategory = z.infer<typeof ItemCategory>;

/** Never bookable (PRD §6.5, BOOK-8). Shown to explain refusals. */
export const PROHIBITED_ITEMS = [
  "Firearms, ammunition or explosives",
  "Fuel, gas cylinders or flammable liquids",
  "Illegal drugs",
  "Live animals",
  "Cash or cheques",
  "Perishable food that isn't sealed",
] as const;
