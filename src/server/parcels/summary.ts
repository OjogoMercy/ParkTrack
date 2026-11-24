import "server-only";
import type { ParcelSummary } from "@/contracts/dto";
import type { Prisma } from "@/generated/prisma/client";
import { formatPhoneNational } from "@/lib/phone";

const parkRef = { select: { id: true, slug: true, name: true, city: true } };

/** Prisma include that has everything a ParcelSummary needs. */
export const summaryInclude = {
  originPark: parkRef,
  destinationPark: parkRef,
  roadsidePoint: { select: { name: true } },
  sender: { select: { name: true, phone: true } },
} as const satisfies Prisma.ParcelInclude;

export type ParcelWithSummary = Prisma.ParcelGetPayload<{
  include: typeof summaryInclude;
}>;

export function toParcelSummary(p: ParcelWithSummary): ParcelSummary {
  return {
    id: p.id,
    parcelCode: p.parcelCode,
    status: p.status,
    deliveryMode: p.deliveryMode,
    recipientName: p.recipientName,
    senderName:
      p.sender?.name ??
      (p.sender ? formatPhoneNational(p.sender.phone) : "Walk-in sender"),
    originPark: p.originPark,
    destinationPark: p.destinationPark,
    roadsidePointName: p.roadsidePoint?.name ?? null,
    sizeClass: p.sizeClass,
    category: p.category,
    podAmountKobo: p.podAmountKobo,
    totalKobo: p.totalKobo,
    bay: p.bay,
    etaMinutes: null, // live estimate comes from tracking (Scope 07)
    dropoffDeadline: p.dropoffDeadline?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}
