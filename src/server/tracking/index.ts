/**
 * Tracking (Scope 07): the sender's parcel page (S09–S11, TRK-1) and the
 * recipient's signed link (R01–R03, RD-1). Replaces the Scope 01 stub;
 * exported names are unchanged. cancelBySender is still the stub until sl9.
 *
 * The recipient never sees the driver's position, only an ETA to their
 * stop (RD-1). Live changes reach open pages through ./live.ts.
 */
import "server-only";
import type {
  ParcelDetail,
  ParcelSummary,
  TimelineEntry,
  TrackingStop,
  TrackingView,
} from "@/contracts/dto";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { formatClock, type OpeningHours } from "@/lib/dates";
import { parcelAwaiting } from "@/mocks/fixtures";
import { stub } from "@/mocks/stub";
import { verifyRecipientLink } from "@/server/auth";
import { storageDues } from "@/server/parcels";
import { summaryInclude, toParcelSummary } from "@/server/parcels/summary";
import {
  isApproaching,
  parcelEta,
  stopTime,
  timelineTitle,
  type JourneyInput,
} from "./journey";

export const STUB = false;

/** Location older than this isn't shown as live (the app was closed). */
const LIVE_FRESH_MINUTES = 10;

const parcelInclude = {
  ...summaryInclude,
  roadsidePoint: {
    select: {
      id: true,
      name: true,
      order: true,
      minutesFromOrigin: true,
      lat: true,
      lng: true,
    },
  },
  sender: {
    select: {
      name: true,
      phone: true,
      vendorProfile: { select: { businessName: true } },
    },
  },
  route: { select: { typicalMinutes: true } },
  destinationPark: {
    select: {
      id: true,
      slug: true,
      name: true,
      city: true,
      counterLocationText: true,
      openingHours: true,
      maxHoldDays: true,
    },
  },
  events: {
    orderBy: { createdAt: "asc" },
    select: {
      type: true,
      toStatus: true,
      createdAt: true,
      photoUrl: true,
      meta: true,
      actor: {
        select: { name: true, park: { select: { name: true } } },
      },
    },
  },
  payments: {
    orderBy: { createdAt: "asc" },
    select: {
      txnRef: true,
      purpose: true,
      amountKobo: true,
      status: true,
      verifiedAt: true,
    },
  },
  tripParcels: {
    orderBy: { assignedAt: "desc" },
    take: 1,
    select: {
      trip: {
        select: {
          status: true,
          acceptedAt: true,
          departedAt: true,
          vehiclePlate: true,
          driver: {
            select: {
              id: true,
              name: true,
              driver: {
                select: {
                  vehicleType: true,
                  usesApp: true,
                  verifiedAt: true,
                },
              },
            },
          },
          locationPoints: {
            orderBy: { recordedAt: "desc" },
            take: 1,
            select: { lat: true, lng: true, recordedAt: true },
          },
        },
      },
    },
  },
} as const satisfies Prisma.ParcelInclude;

type LoadedParcel = Prisma.ParcelGetPayload<{ include: typeof parcelInclude }>;
type LoadedEvent = LoadedParcel["events"][number];

/** Sender's parcel page (S09–S11). Null unless this user sent it. */
export async function parcelDetailFor(
  parcelCode: string,
  userId: string,
): Promise<ParcelDetail | null> {
  const p = await db.parcel.findFirst({
    where: { parcelCode, senderId: userId },
    include: {
      ...parcelInclude,
      ledgerEntries: {
        where: { account: "VENDOR", accountRefId: userId },
        select: { amountKobo: true },
      },
    },
  });
  if (!p || p.status === "DRAFT") return null;
  const now = new Date();
  const trip = p.tripParcels[0]?.trip ?? null;
  const journey = journeyOf(p, now);
  const dues = await storageDues(p.id, now);

  const collected = lastEvent(p, "COLLECTED");
  const point = trip?.locationPoints[0];
  const credited = p.ledgerEntries.reduce((n, e) => n + e.amountKobo, 0);
  const podCollected =
    p.ledgerEntries.length && p.podPaidAt ? p.podAmountKobo : 0;

  return {
    ...toParcelSummary(p),
    etaMinutes: parcelEta(journey)?.minutes ?? null,
    publicId: p.publicId,
    description: p.description,
    declaredValueKobo: p.declaredValueKobo,
    sender: { name: senderNameOf(p), phone: p.sender?.phone },
    recipient: { name: p.recipientName, phone: p.recipientPhone },
    roadsidePoint: p.roadsidePoint,
    driver: trip
      ? {
          userId: trip.driver.id,
          name: trip.driver.name ?? "Your driver",
          vehiclePlate: trip.vehiclePlate,
          vehicleType: trip.driver.driver?.vehicleType,
          usesApp: trip.driver.driver?.usesApp ?? true,
          verified: !!trip.driver.driver?.verifiedAt,
        }
      : null,
    timeline: timelineOf(p),
    payments: p.payments.map((x) => ({
      txnRef: x.txnRef,
      purpose: x.purpose,
      amountKobo: x.amountKobo,
      status: x.status,
      verifiedAt: x.verifiedAt?.toISOString() ?? null,
    })),
    dropoffPhotoUrl: lastEvent(p, "DROPOFF")?.photoUrl ?? null,
    releasePhotoUrl: collected?.photoUrl ?? null,
    collected: collected
      ? {
          at: collected.createdAt.toISOString(),
          by: metaString(collected.meta, "collectorName") ?? p.recipientName,
          kind:
            metaString(collected.meta, "collectorKind") === "DELEGATE"
              ? "DELEGATE"
              : "RECIPIENT",
          releasedBy: releasedBy(collected),
          parkName: p.destinationPark.name,
        }
      : null,
    storageDueKobo: dues.storageKobo,
    freeUntil: dues.freeUntil,
    // The sender sees the bus on a map while the driver shares location
    // (TRK-2); the recipient never does (RD-1).
    live:
      p.status === "IN_TRANSIT" &&
      trip?.status === "IN_TRANSIT" &&
      point &&
      now.getTime() - point.recordedAt.getTime() < LIVE_FRESH_MINUTES * 60_000
        ? {
            lat: point.lat,
            lng: point.lng,
            at: point.recordedAt.toISOString(),
          }
        : null,
    // Before it's on a bus (PRD §9); the cancel action itself is sl9.
    cancellable:
      p.status === "AWAITING_DROPOFF" || p.status === "RECEIVED_AT_ORIGIN",
    settlement:
      p.ledgerEntries.length > 0
        ? {
            podCollectedKobo: podCollected,
            podFeeKobo: Math.max(0, podCollected - credited),
            creditedKobo: credited,
          }
        : null,
  };
}

/**
 * Recipient view through the signed link (R01–R03). Null for invalid,
 * expired or revoked links. Never the driver's position (RD-1).
 */
export async function trackingForLink(
  linkToken: string,
): Promise<TrackingView | null> {
  const link = await verifyRecipientLink(linkToken);
  if (!link) return null;
  const p = await db.parcel.findUnique({
    where: { id: link.parcelId },
    include: parcelInclude,
  });
  if (!p || p.status === "DRAFT") return null;
  return toTrackingView(p, new Date());
}

/** The live-update channel key for a recipient link (see ./live.ts). */
export async function trackingChannelForLink(
  linkToken: string,
): Promise<string | null> {
  const link = await verifyRecipientLink(linkToken);
  if (!link) return null;
  const p = await db.parcel.findUnique({
    where: { id: link.parcelId },
    select: { trackingLinkId: true },
  });
  return p?.trackingLinkId ?? null;
}

async function toTrackingView(
  p: LoadedParcel,
  now: Date,
): Promise<TrackingView> {
  const trip = p.tripParcels[0]?.trip ?? null;
  const journey = journeyOf(p, now);
  const eta = parcelEta(journey);
  const dues = await storageDues(p.id, now);
  const podDue = p.podPaidAt ? 0 : p.podAmountKobo;
  const arrived =
    lastEvent(p, "TICK_OFF", "ARRIVED") ??
    lastEvent(p, "MANIFEST_RECEIVED", "ARRIVED");
  const collected = lastEvent(p, "COLLECTED");
  const startedAt = journey.startedAt;

  const stops: TrackingStop[] = [
    {
      name: p.originPark.city,
      kind: "origin",
      at: startedAt?.toISOString() ?? null,
      isYourStop: false,
      passed: startedAt !== null,
    },
  ];
  if (p.deliveryMode === "ROADSIDE" && p.roadsidePoint) {
    stops.push({
      name: p.roadsidePoint.name,
      kind: "roadside",
      at: stopTime(startedAt, p.roadsidePoint.minutesFromOrigin),
      isYourStop: true,
      passed: ["DELIVERED_ROADSIDE", "SETTLED"].includes(p.status),
    });
  }
  stops.push({
    name: p.destinationPark.city,
    kind: "destination",
    at:
      arrived?.createdAt.toISOString() ??
      stopTime(startedAt, p.route.typicalMinutes),
    isYourStop: p.deliveryMode === "PARK",
    passed: !!arrived || trip?.status === "ARRIVED",
  });

  const rate = arrived
    ? await db.storageRate.findFirst({
        where: {
          parkId: p.destinationParkId,
          sizeClass: p.sizeClass,
          effectiveFrom: { lte: now },
        },
        orderBy: { effectiveFrom: "desc" },
        select: { dailyRateKobo: true },
      })
    : null;

  return {
    parcelCode: p.parcelCode,
    status: p.status,
    deliveryMode: p.deliveryMode,
    senderName: senderNameOf(p),
    sizeClass: p.sizeClass,
    category: p.category,
    sentAt: (lastEvent(p, "DROPOFF")?.createdAt ?? p.createdAt).toISOString(),
    stops,
    eta,
    approaching: isApproaching(journey, eta),
    driver: trip
      ? {
          name: trip.driver.name ?? "Your driver",
          vehiclePlate: trip.vehiclePlate,
          vehicleType: trip.driver.driver?.vehicleType,
        }
      : null,
    dues: {
      podKobo: podDue,
      podPayee: p.podAmountKobo ? senderNameOf(p) : null,
      storageKobo: dues.storageKobo,
      totalKobo: podDue + dues.storageKobo,
      paid: podDue + dues.storageKobo === 0,
    },
    // R02: shown after POD is paid for a roadside handover (sl6).
    handoverCode: null,
    arrival:
      arrived && p.status === "ARRIVED"
        ? {
            parkName: p.destinationPark.name,
            parkSlug: p.destinationPark.slug,
            bay: p.bay,
            arrivedAt: arrived.createdAt.toISOString(),
            // Until the arrival message goes out the free window hasn't
            // started (COL-6); show it from arrival meanwhile.
            freeUntil: dues.freeUntil ?? arrived.createdAt.toISOString(),
            dailyRateKobo: rate?.dailyRateKobo ?? 0,
            maxHoldDays: p.destinationPark.maxHoldDays,
            counterLocationText: p.destinationPark.counterLocationText,
            openingHoursText: hoursText(
              p.destinationPark.openingHours as OpeningHours | null,
            ),
          }
        : null,
    collected: collected
      ? {
          at: collected.createdAt.toISOString(),
          by: metaString(collected.meta, "collectorName") ?? p.recipientName,
          releasedBy: releasedBy(collected),
        }
      : null,
  };
}

function journeyOf(p: LoadedParcel, now: Date): JourneyInput {
  const trip = p.tripParcels[0]?.trip ?? null;
  return {
    status: p.status,
    deliveryMode: p.deliveryMode,
    roadsideMinutes: p.roadsidePoint?.minutesFromOrigin ?? null,
    typicalMinutes: p.route.typicalMinutes,
    startedAt: trip ? (trip.departedAt ?? trip.acceptedAt) : null,
    now,
  };
}

/** A vendor's business name, else the sender's name. */
function senderNameOf(p: LoadedParcel): string {
  return p.sender?.vendorProfile?.businessName ?? toParcelSummary(p).senderName;
}

function lastEvent(
  p: LoadedParcel,
  type: LoadedEvent["type"],
  to?: LoadedEvent["toStatus"],
): LoadedEvent | undefined {
  return p.events.findLast(
    (e) => e.type === type && (to === undefined || e.toStatus === to),
  );
}

function timelineOf(p: LoadedParcel): TimelineEntry[] {
  const trip = p.tripParcels[0]?.trip ?? null;
  const entries: TimelineEntry[] = [];
  for (const e of p.events) {
    const t = timelineTitle(e.type, e.toStatus ?? p.status, {
      originName: p.originPark.name,
      destinationName: p.destinationPark.name,
      roadsidePointName: p.roadsidePoint?.name ?? null,
      recipientName: p.recipientName,
      driverName: trip?.driver.name ?? null,
      actorName: e.actor?.name ?? null,
    });
    if (!t) continue;
    entries.push({
      type: e.type,
      title: t.title,
      sub: t.sub,
      at: e.createdAt.toISOString(),
      photoUrl: e.photoUrl,
    });
  }
  return entries;
}

/** "Funmi A., Ojota Motor Park counter". */
function releasedBy(e: LoadedEvent): string {
  const name = e.actor?.name?.trim();
  if (!name) return "Park counter";
  const [first, ...rest] = name.split(/\s+/);
  const last = rest.at(-1);
  const short = last ? `${first} ${last[0]}.` : first;
  return e.actor?.park ? `${short}, ${e.actor.park.name} counter` : short;
}

function metaString(meta: Prisma.JsonValue, key: string): string | null {
  if (meta && typeof meta === "object" && !Array.isArray(meta)) {
    const v = (meta as Record<string, unknown>)[key];
    return typeof v === "string" && v ? v : null;
  }
  return null;
}

/** "open 6:00 AM to 8:00 PM" from the hours most days share. */
function hoursText(hours: OpeningHours | null): string | null {
  if (!hours) return null;
  const counts = new Map<string, number>();
  for (const v of Object.values(hours)) {
    if (v) counts.set(v.join("-"), (counts.get(v.join("-")) ?? 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!top) return null;
  const [opens, closes] = top.split("-");
  return `open ${formatClock(opens)} to ${formatClock(closes)}`;
}

/** Sender cancels before loading; refunded in full (PRD §9). */
export async function cancelBySender(
  parcelId: string,
  userId: string,
  reason?: string,
): Promise<{ parcel: ParcelSummary; refundStarted: boolean }> {
  void userId;
  void reason;
  return stub({
    parcel: { ...parcelAwaiting, id: parcelId, status: "CANCELLED" },
    refundStarted: true,
  });
}
