import { describe, expect, it } from "vitest";
import * as C from "@/contracts";
import * as P from "@/generated/prisma/enums";

// Contracts are browser-safe copies of the Prisma enums. This fails if the
// schema and the contracts drift apart (e.g. a status added to only one).
const pairs: [string, readonly string[], Record<string, string>][] = [
  ["Role", C.ROLES, P.Role],
  ["ParcelStatus", C.PARCEL_STATUSES, P.ParcelStatus],
  ["SizeClass", C.SIZE_CLASSES, P.SizeClass],
  ["DeliveryMode", C.DELIVERY_MODES, P.DeliveryMode],
  ["CreatedBy", C.CREATED_BY, P.CreatedBy],
  ["HandshakeMethod", C.HANDSHAKE_METHODS, P.HandshakeMethod],
  ["ParcelEventType", C.PARCEL_EVENT_TYPES, P.ParcelEventType],
  ["TripStatus", C.TRIP_STATUSES, P.TripStatus],
  ["CodePurpose", C.CODE_PURPOSES, P.CodePurpose],
  ["CollectorKind", C.COLLECTOR_KINDS, P.CollectorKind],
  ["PaymentPurpose", C.PAYMENT_PURPOSES, P.PaymentPurpose],
  ["PaymentStatus", C.PAYMENT_STATUSES, P.PaymentStatus],
  ["LedgerAccount", C.LEDGER_ACCOUNTS, P.LedgerAccount],
  ["NotificationChannel", C.NOTIFICATION_CHANNELS, P.NotificationChannel],
  ["Language", C.LANGUAGES, P.Language],
  ["DisputeType", C.DISPUTE_TYPES, P.DisputeType],
  ["DisputeStatus", C.DISPUTE_STATUSES, P.DisputeStatus],
  ["ParkStatus", C.PARK_STATUSES, P.ParkStatus],
  ["UserStatus", C.USER_STATUSES, P.UserStatus],
];

describe("contract enums match the Prisma schema", () => {
  it.each(pairs)("%s", (_name, contract, prisma) => {
    expect([...contract]).toEqual(Object.values(prisma));
  });
});
