/**
 * Owned by Scope 05 (docs/scopes/05-sender-app.md). Exported names and
 * types are FINAL; callers never change. Being replaced slice by slice:
 * parkEstimates (sl1), bookingLimits (sl3), createBooking and draftForReview
 * (sl4) are real; listMyParcels (sl6) still returns fixture data. STUB stays
 * true until every function is real.
 */
import { cacheLife, cacheTag } from "next/cache";
import type { BookingInput } from "@/contracts/api";
import type { ParcelSummary, Quote, VendorTotals } from "@/contracts/dto";
import { SIZE_CLASSES, SIZE_LABELS, type SizeClass } from "@/contracts/enums";
import { db } from "@/lib/db";
import { myParcels } from "@/mocks/fixtures";
import { stub } from "@/mocks/stub";
import { createDraft, quote } from "@/server/parcels";
import { createRecipient, RecipientError } from "@/server/recipients";
import { parkCacheTag } from "@/server/parks";

export const STUB = true;

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

/** S08 my parcels, with vendor totals when the sender is a vendor. */
export async function listMyParcels(
  userId: string,
  tab: "active" | "delivered" | "drafts",
): Promise<{ parcels: ParcelSummary[]; vendor: VendorTotals | null }> {
  void userId;
  void tab;
  return stub(myParcels);
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
}> {
  "use cache";
  cacheLife("minutes");
  const settings = await db.settings.findUnique({ where: { id: 1 } });
  return {
    podLimitKobo: settings?.podLimitKobo ?? 20_000_000,
    platformFeeKobo: settings?.platformFeeKobo ?? 15_000,
  };
}
