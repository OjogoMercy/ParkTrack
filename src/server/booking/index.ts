/**
 * Owned by Scope 05 (docs/scopes/05-sender-app.md). Exported names and
 * types are FINAL; callers never change. Real since sl6: parkEstimates
 * (sl1), bookingLimits (sl3), createBooking and draftForReview (sl4),
 * bookedParcel (sl5), listMyParcels (sl6).
 */
import { cacheLife, cacheTag } from "next/cache";
import type { BookingInput } from "@/contracts/api";
import type { ParcelSummary, Quote, VendorTotals } from "@/contracts/dto";
import { SIZE_CLASSES, SIZE_LABELS, type SizeClass } from "@/contracts/enums";
import { db } from "@/lib/db";
import type { ParcelStatus } from "@/contracts/enums";
import { createDraft, quote } from "@/server/parcels";
import { summaryInclude, toParcelSummary } from "@/server/parcels/summary";
import { createRecipient, RecipientError } from "@/server/recipients";
import { parkCacheTag } from "@/server/parks";

export const STUB = false;

export type BookingContext = {
  originParkId: string;
  senderId: string | null;
  createdBy: "SENDER" | "AGENT";
  createdByUserId: string;
};

/**
 * S03 booking (also walk-ins from Scope 06): validates, quotes, creates the
 * DRAFT through the parcel engine (createDraft: prohibited items, route,
 * drop point, price snapshot, 24 h expiry). When the sender asked, the
 * recipient is saved to their list; a duplicate or a full list never stops
 * the booking. Throws ParcelError (invalid_booking, prohibited_item,
 * pod_too_high 400; route_not_found 404).
 */
export async function createBooking(
  input: BookingInput,
  ctx: BookingContext,
): Promise<{ parcel: ParcelSummary; quote: Quote }> {
  const parcel = await createDraft({ ...input, ...ctx });

  if (input.saveRecipient && ctx.createdBy === "SENDER" && ctx.senderId) {
    await createRecipient(ctx.senderId, {
      name: input.recipient.name,
      phone: input.recipient.phone,
      preferredParkId:
        input.deliveryMode === "PARK" ? input.destinationParkId : null,
      preferredRoadsidePointId:
        input.deliveryMode === "ROADSIDE"
          ? (input.roadsidePointId ?? null)
          : null,
    }).catch((e: unknown) => {
      if (!(e instanceof RecipientError)) {
        console.error("[booking] saving the recipient", e);
      }
    });
  }

  return { parcel, quote: await snapshotQuote(parcel.id) };
}

/** The price the booking was made at (BOOK-4), as S04 lists it. */
async function snapshotQuote(parcelId: string): Promise<Quote> {
  const p = await db.parcel.findUniqueOrThrow({
    where: { id: parcelId },
    select: {
      sizeClass: true,
      fareKobo: true,
      platformFeeKobo: true,
      insuranceKobo: true,
      totalKobo: true,
      podAmountKobo: true,
    },
  });
  return {
    fareKobo: p.fareKobo,
    platformFeeKobo: p.platformFeeKobo,
    insuranceKobo: p.insuranceKobo,
    totalKobo: p.totalKobo,
    podAmountKobo: p.podAmountKobo,
    lines: [
      {
        label: `Fare · ${SIZE_LABELS[p.sizeClass].name}`,
        amountKobo: p.fareKobo,
      },
      { label: "Service fee", amountKobo: p.platformFeeKobo },
      ...(p.insuranceKobo
        ? [{ label: "Insurance", amountKobo: p.insuranceKobo }]
        : []),
    ],
  };
}

export type DraftReview = {
  id: string;
  parcelCode: string;
  status: ParcelSummary["status"];
  /** Past its 24 hours and still unpaid. */
  expired: boolean;
  originCity: string;
  originName: string;
  destination: { city: string; name: string };
  deliveryMode: "PARK" | "ROADSIDE";
  roadsidePointName: string | null;
  sizeClass: SizeClass;
  recipientName: string;
  recipientPhone: string;
  category: string;
  description: string;
  declaredValueKobo: number;
  podAmountKobo: number;
  dropoffDeadlineHours: number;
  quote: Quote;
};

/**
 * S04: a booking of this sender, made at this park, by its PT- code. Null
 * when there is none (someone else's code looks the same as a wrong one).
 */
export async function draftForReview(
  senderId: string,
  originParkSlug: string,
  parcelCode: string,
): Promise<DraftReview | null> {
  const p = await db.parcel.findFirst({
    where: {
      parcelCode: parcelCode.toUpperCase(),
      senderId,
      originPark: { slug: originParkSlug },
    },
    include: {
      originPark: {
        select: { city: true, name: true, dropoffDeadlineHours: true },
      },
      destinationPark: { select: { city: true, name: true } },
      roadsidePoint: { select: { name: true } },
    },
  });
  if (!p) return null;
  return {
    id: p.id,
    parcelCode: p.parcelCode,
    status: p.status,
    expired:
      p.status === "DRAFT" &&
      !!p.draftExpiresAt &&
      p.draftExpiresAt.getTime() <= Date.now(),
    originCity: p.originPark.city,
    originName: p.originPark.name,
    destination: p.destinationPark,
    deliveryMode: p.deliveryMode,
    roadsidePointName: p.roadsidePoint?.name ?? null,
    sizeClass: p.sizeClass,
    recipientName: p.recipientName,
    recipientPhone: p.recipientPhone,
    category: p.category,
    description: p.description,
    declaredValueKobo: p.declaredValueKobo,
    podAmountKobo: p.podAmountKobo,
    dropoffDeadlineHours: p.originPark.dropoffDeadlineHours,
    quote: await snapshotQuote(p.id),
  };
}

/** Which statuses each S08 tab shows. */
export const PARCEL_TABS: Record<
  "active" | "delivered" | "drafts",
  readonly ParcelStatus[]
> = {
  active: [
    "AWAITING_DROPOFF",
    "RECEIVED_AT_ORIGIN",
    "ASSIGNED",
    "IN_TRANSIT",
    "ARRIVED",
    "UNCLAIMED",
    "DISPUTED",
  ],
  delivered: [
    "DELIVERED_ROADSIDE",
    "COLLECTED",
    "SETTLED",
    "RETURNED",
    "RESOLVED",
    "CANCELLED",
  ],
  drafts: ["DRAFT"],
};

/** Newest first; enough for anyone's phone screen. */
const LIST_LIMIT = 50;

/**
 * S08 my parcels, with vendor totals when the sender is a vendor. The
 * sender's parcels from every park (one account works everywhere).
 * Vendor totals: pay on delivery credited to them this month (ledger), and
 * pay on delivery on parcels still on their way.
 */
export async function listMyParcels(
  userId: string,
  tab: "active" | "delivered" | "drafts",
): Promise<{ parcels: ParcelSummary[]; vendor: VendorTotals | null }> {
  const [rows, vendor] = await Promise.all([
    db.parcel.findMany({
      where: { senderId: userId, status: { in: [...PARCEL_TABS[tab]] } },
      include: summaryInclude,
      orderBy:
        tab === "delivered" ? { updatedAt: "desc" } : { createdAt: "desc" },
      take: LIST_LIMIT,
    }),
    vendorTotals(userId),
  ]);
  return { parcels: rows.map(toParcelSummary), vendor };
}

/** How many parcels each S08 tab holds ("Active · 3"). */
export async function myParcelCounts(
  userId: string,
): Promise<Record<"active" | "delivered" | "drafts", number>> {
  const groups = await db.parcel.groupBy({
    by: ["status"],
    where: { senderId: userId },
    _count: { _all: true },
  });
  const count = (statuses: readonly ParcelStatus[]) =>
    groups
      .filter((g) => statuses.includes(g.status))
      .reduce((t, g) => t + g._count._all, 0);
  return {
    active: count(PARCEL_TABS.active),
    delivered: count(PARCEL_TABS.delivered),
    drafts: count(PARCEL_TABS.drafts),
  };
}

/** Start of the current month in Lagos (UTC+1, no daylight saving). */
function lagosMonthStart(now = new Date()): Date {
  const lagos = new Date(now.getTime() + 60 * 60 * 1000);
  return new Date(
    Date.UTC(lagos.getUTCFullYear(), lagos.getUTCMonth(), 1) - 60 * 60 * 1000,
  );
}

async function vendorTotals(userId: string): Promise<VendorTotals | null> {
  const vendor = await db.vendorProfile.findUnique({
    where: { userId },
    select: { userId: true },
  });
  if (!vendor) return null;
  const [credited, onTheWay] = await Promise.all([
    db.ledgerEntry.aggregate({
      where: {
        account: "VENDOR",
        accountRefId: userId,
        createdAt: { gte: lagosMonthStart() },
      },
      _sum: { amountKobo: true },
    }),
    db.parcel.aggregate({
      where: {
        senderId: userId,
        podAmountKobo: { gt: 0 },
        status: { in: [...PARCEL_TABS.active] },
      },
      _sum: { podAmountKobo: true },
    }),
  ]);
  return {
    collectedThisMonthKobo: Math.max(0, credited._sum.amountKobo ?? 0),
    awaitingCollectionKobo: onTheWay._sum.podAmountKobo ?? 0,
  };
}

/** Route id → size → the sender's total, as quote() works it out. */
export type ParkEstimates = Record<string, Record<SizeClass, Quote>>;

/**
 * S01 quick estimator: the real quote (fare by size + service fee, BOOK-4)
 * for every route and size of a park, so switching destination or size
 * updates the total instantly. Cached with the park (fares change through
 * the park admin, which revalidates the park tag); the service fee lives
 * in settings, so the cache is also short-lived.
 */
export async function parkEstimates(
  slug: string,
  routeIds: string[],
): Promise<ParkEstimates> {
  "use cache";
  cacheLife("minutes");
  cacheTag(parkCacheTag(slug));
  const out: ParkEstimates = {};
  for (const routeId of routeIds) {
    const bySize = {} as Record<SizeClass, Quote>;
    for (const size of SIZE_CLASSES) {
      bySize[size] = await quote({ routeId, size, podKobo: 0 });
    }
    out[routeId] = bySize;
  }
  return out;
}

/**
 * Limits S03 checks before submitting (the server checks them again):
 * the pay-on-delivery cap and the service fee, from settings.
 */
export async function bookingLimits(): Promise<{
  podLimitKobo: number;
  platformFeeKobo: number;
  /** Platform fee on pay on delivery, in basis points (125 = 1.25%). */
  podFeeBps: number;
}> {
  "use cache";
  cacheLife("minutes");
  const settings = await db.settings.findUnique({ where: { id: 1 } });
  return {
    podLimitKobo: settings?.podLimitKobo ?? 20_000_000,
    platformFeeKobo: settings?.platformFeeKobo ?? 15_000,
    podFeeBps: settings?.podFeeBps ?? 125,
  };
}

export type BookedView = {
  id: string;
  parcelCode: string;
  status: ParcelSummary["status"];
  /** The only thing in the booking QR (bookingQr(publicId)). */
  publicId: string;
  originCity: string;
  dropoffDeadline: Date | null;
  recipientName: string;
  destinationName: string;
  deliveryMode: "PARK" | "ROADSIDE";
  roadsidePointName: string | null;
  sizeClass: SizeClass;
  category: string;
  podAmountKobo: number;
  /** The verified shipping payment, when there is one. */
  paid: { amountKobo: number; txnRef: string } | null;
};

/**
 * S07 booked: a booking of this sender, made at this park, by its PT- code,
 * with the shipping payment that paid it. Null when there is none.
 */
export async function bookedParcel(
  senderId: string,
  originParkSlug: string,
  parcelCode: string,
): Promise<BookedView | null> {
  const p = await db.parcel.findFirst({
    where: {
      parcelCode: parcelCode.toUpperCase(),
      senderId,
      originPark: { slug: originParkSlug },
    },
    include: {
      originPark: { select: { city: true } },
      destinationPark: { select: { name: true } },
      roadsidePoint: { select: { name: true } },
      payments: {
        where: { purpose: "SHIPPING", status: "VERIFIED" },
        orderBy: { verifiedAt: "asc" },
        take: 1,
        select: { amountKobo: true, txnRef: true },
      },
    },
  });
  if (!p) return null;
  return {
    id: p.id,
    parcelCode: p.parcelCode,
    status: p.status,
    publicId: p.publicId,
    originCity: p.originPark.city,
    dropoffDeadline: p.dropoffDeadline,
    recipientName: p.recipientName,
    destinationName: p.destinationPark.name,
    deliveryMode: p.deliveryMode,
    roadsidePointName: p.roadsidePoint?.name ?? null,
    sizeClass: p.sizeClass,
    category: p.category,
    podAmountKobo: p.podAmountKobo,
    paid: p.payments[0] ?? null,
  };
}
