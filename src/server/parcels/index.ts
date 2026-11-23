/**
 * Owned by Scope 03 (docs/scopes/03-parcel-engine.md). Exported names and
 * types are FINAL; callers never change. Being replaced slice by slice:
 * transition / changeDeliveryMode (sl1), createDraft / quote (sl2) are
 * real; collection codes (sl3) and storageDues (sl4) still return fixture
 * data. STUB stays true until every function here is real.
 */
import "server-only";
import { after } from "next/server";
import { BookingInput } from "@/contracts/api";
import type { ParcelSummary, Quote } from "@/contracts/dto";
import type {
  CodePurpose,
  CreatedBy,
  ParcelEventType,
  ParcelStatus,
  SizeClass,
} from "@/contracts/enums";
import {
  findTransition,
  type Actor,
  type Transition,
} from "@/contracts/states";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { parcelCode as newParcelCode, publicToken } from "@/lib/ids";
import { normalizeNgPhone } from "@/lib/phone";
import { stub } from "@/mocks/stub";
import {
  buildQuote,
  DRAFT_TTL_HOURS,
  fareFor,
  prohibitedItemIn,
} from "./pricing";
import { notify } from "@/server/notify";
import { ParcelError } from "./errors";
import {
  actorProblem,
  DROPOFF_WINDOW_HOURS,
  eventTypeFor,
  notificationFor,
} from "./lifecycle";
import { summaryInclude, toParcelSummary } from "./summary";

export const STUB = true;

export { ParcelError } from "./errors";

export type ActorRef = { actor: Actor; userId?: string };

export type TransitionDetails = {
  lat?: number;
  lng?: number;
  photoUrl?: string;
  note?: string;
  eventType?: ParcelEventType;
  meta?: Record<string, unknown>;
};

export type DraftInput = BookingInput & {
  senderId: string | null;
  originParkId: string;
  createdBy: CreatedBy;
  createdByUserId: string;
};

/**
 * Creates an unpaid booking (BOOK-1, HS-1), real since Scope 03 sl2.
 *
 * Checks the booking against the contract, refuses prohibited items
 * (BOOK-8), finds the live route from the origin park to the destination,
 * checks a roadside drop point is on that route, and snapshots the quote.
 * Assigns a random `publicId` (the only thing in the booking QR) and a
 * unique `PT-XXXX` code, keeps the draft 24 hours, and records a CREATED
 * event. Saving the recipient to the sender's list is Scope 05's job.
 *
 * Throws ParcelError: invalid_booking / prohibited_item / pod_too_high
 * (400, with fields), route_not_found (404).
 */
export async function createDraft(input: DraftInput): Promise<ParcelSummary> {
  const parsed = BookingInput.safeParse(input);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues)
      fields[issue.path.join(".") || "booking"] ??= issue.message;
    throw new ParcelError(
      "invalid_booking",
      "Check the booking details.",
      400,
      fields,
    );
  }
  const booking = parsed.data;

  const prohibited = prohibitedItemIn(booking.description);
  if (prohibited) {
    throw new ParcelError(
      "prohibited_item",
      `ParkTrack can't carry this: ${prohibited.toLowerCase()}.`,
      400,
      { description: `Not allowed: ${prohibited}` },
    );
  }
  const recipientPhone = normalizeNgPhone(booking.recipient.phone);
  if (!recipientPhone) {
    throw new ParcelError(
      "invalid_booking",
      "Enter the recipient's Nigerian phone number.",
      400,
      { "recipient.phone": "Enter a Nigerian phone number" },
    );
  }

  const route = await liveRoute({
    originParkId: input.originParkId,
    destinationParkId: booking.destinationParkId,
  });
  let roadsidePointId: string | null = null;
  if (booking.deliveryMode === "ROADSIDE") {
    const point = route.roadsidePoints.find(
      (p) => p.id === booking.roadsidePointId,
    );
    if (!point) {
      throw new ParcelError(
        "invalid_booking",
        "Choose a drop point on this route.",
        400,
        { roadsidePointId: "Choose a drop point on the route" },
      );
    }
    roadsidePointId = point.id;
  }

  const q = await quoteForRoute(
    route,
    booking.sizeClass,
    booking.podAmountKobo,
  );
  const now = new Date();

  for (let attempt = 1; ; attempt++) {
    try {
      const created = await db.$transaction(async (tx) => {
        const parcel = await tx.parcel.create({
          data: {
            publicId: publicToken(),
            parcelCode: newParcelCode(),
            senderId: input.senderId,
            originParkId: route.originParkId,
            destinationParkId: route.destinationParkId,
            routeId: route.id,
            deliveryMode: booking.deliveryMode,
            roadsidePointId,
            recipientName: booking.recipient.name,
            recipientPhone,
            category: booking.category,
            description: booking.description,
            declaredValueKobo: booking.declaredValueKobo,
            sizeClass: booking.sizeClass,
            podAmountKobo: q.podAmountKobo,
            insured: false,
            fareKobo: q.fareKobo,
            platformFeeKobo: q.platformFeeKobo,
            insuranceKobo: q.insuranceKobo,
            totalKobo: q.totalKobo,
            status: "DRAFT",
            createdBy: input.createdBy,
            createdByUserId: input.createdByUserId,
            draftExpiresAt: new Date(
              now.getTime() + DRAFT_TTL_HOURS * 60 * 60 * 1000,
            ),
          },
          include: summaryInclude,
        });
        await tx.parcelEvent.create({
          data: {
            parcelId: parcel.id,
            type: "CREATED",
            toStatus: "DRAFT",
            actorId: input.createdByUserId,
            meta: { actor: input.createdBy },
            createdAt: now,
          },
        });
        return parcel;
      });
      return toParcelSummary(created);
    } catch (e) {
      // A PT-XXXX code clash (about 1 in a million per parcel): try another.
      if (isUniqueClash(e) && attempt < 5) continue;
      throw e;
    }
  }
}

/**
 * The sender's total for a route and size (BOOK-4), as S03/S04 show it:
 * fare by size + ₦150 service fee; insurance off (Q13); pay-on-delivery
 * checked against the ₦200,000 pilot limit (both from `settings`).
 * Throws ParcelError route_not_found (404) or pod_too_high (400).
 */
export async function quote(args: {
  routeId: string;
  size: SizeClass;
  podKobo: number;
}): Promise<Quote> {
  const route = await liveRoute({ routeId: args.routeId });
  return quoteForRoute(route, args.size, args.podKobo);
}

async function liveRoute(
  where:
    { routeId: string } | { originParkId: string; destinationParkId: string },
) {
  const route = await db.route.findFirst({
    where: {
      ...("routeId" in where
        ? { id: where.routeId }
        : {
            originParkId: where.originParkId,
            destinationParkId: where.destinationParkId,
          }),
      active: true,
      originPark: { status: "LIVE" },
      destinationPark: { status: "LIVE" },
    },
    include: { roadsidePoints: { select: { id: true } } },
  });
  if (!route) {
    throw new ParcelError(
      "route_not_found",
      "This park doesn't send parcels to that destination yet.",
      404,
      { destinationParkId: "Choose another destination" },
    );
  }
  return route;
}

async function quoteForRoute(
  route: Parameters<typeof fareFor>[0],
  size: SizeClass,
  podKobo: number,
): Promise<Quote> {
  const settings = await db.settings.findUnique({ where: { id: 1 } });
  return buildQuote({
    fareKobo: fareFor(route, size),
    size,
    platformFeeKobo: settings?.platformFeeKobo ?? 15_000,
    podKobo,
    podLimitKobo: settings?.podLimitKobo ?? 20_000_000,
  });
}

function isUniqueClash(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: unknown }).code === "P2002"
  );
}

/**
 * The only way a parcel's status changes (real since Scope 03 sl1).
 *
 * 1. Checks the move against src/contracts/states.ts and the actor: the role
 *    must be allowed, a person must act as their own active role, and only
 *    the parcel's sender, a driver carrying it, or staff of the right park
 *    may act (./lifecycle.ts).
 * 2. In one database transaction: updates the status only if it is still
 *    `from` (two agents tapping at once can't both win) and writes the
 *    parcel_events row with actor, time, location, photo and note.
 * 3. After the change is saved, sends the PRD §11 message for the move.
 *    A failed message never undoes the change.
 *
 * Throws ParcelError: parcel_not_found (404), transition_not_allowed (409),
 * actor_not_allowed (403), status_changed (409).
 */
export async function transition(
  parcelId: string,
  to: ParcelStatus,
  by: ActorRef,
  details: TransitionDetails = {},
): Promise<ParcelSummary> {
  const now = new Date();
  const { summary, from, eventType } = await db.$transaction(async (tx) => {
    const parcel = await tx.parcel.findUnique({
      where: { id: parcelId },
      select: {
        status: true,
        originParkId: true,
        destinationParkId: true,
        senderId: true,
        tripParcels: { select: { trip: { select: { driverId: true } } } },
      },
    });
    if (!parcel) {
      throw new ParcelError("parcel_not_found", "Parcel not found.", 404);
    }
    const from = parcel.status;
    const rule = findTransition(from, to);
    if (!rule) {
      throw new ParcelError(
        "transition_not_allowed",
        from === to
          ? `This parcel is already ${statusText(from)}.`
          : `This parcel is ${statusText(from)}, so it can't be marked ${statusText(to)}.`,
        409,
      );
    }
    const user = by.userId
      ? await tx.user.findUnique({
          where: { id: by.userId },
          select: { id: true, role: true, status: true, parkId: true },
        })
      : null;
    const problem = actorProblem({
      transition: rule,
      actor: by.actor,
      user,
      parcel: {
        ...parcel,
        driverIds: parcel.tripParcels.map((tp) => tp.trip.driverId),
      },
    });
    if (problem) throw new ParcelError("actor_not_allowed", problem, 403);

    const { count } = await tx.parcel.updateMany({
      where: { id: parcelId, status: from },
      data: { status: to, ...sideEffects(from, to, now) },
    });
    if (count !== 1) {
      throw new ParcelError(
        "status_changed",
        "This parcel was just updated by someone else. Refresh and try again.",
        409,
      );
    }
    const eventType = details.eventType ?? eventTypeFor(from, to);
    await tx.parcelEvent.create({
      data: {
        parcelId,
        type: eventType,
        fromStatus: from,
        toStatus: to,
        actorId: user?.id ?? null,
        lat: details.lat ?? null,
        lng: details.lng ?? null,
        photoUrl: details.photoUrl ?? null,
        note: details.note ?? null,
        meta: eventMeta(by, details.meta),
        createdAt: now,
      },
    });
    const updated = await tx.parcel.findUniqueOrThrow({
      where: { id: parcelId },
      include: summaryInclude,
    });
    return { summary: toParcelSummary(updated), from, eventType };
  });

  const message = notificationFor(from, to, eventType);
  if (message) {
    afterResponse(async () => {
      await notify(message, parcelId);
      if (message === "arrived_at_park") {
        // The free storage window starts when the recipient is told (COL-6).
        await db.parcel.updateMany({
          where: { id: parcelId, arrivalNotifiedAt: null },
          data: { arrivalNotifiedAt: new Date() },
        });
      }
    });
  }
  return summary;
}

/**
 * Roadside Missed (RD-5): the parcel stays IN_TRANSIT and goes on to the
 * destination park; delivery mode becomes PARK, a ROADSIDE_MISSED event is
 * recorded and sender, recipient and arrival agents are told. Only the
 * driver carrying it (or the system) can do this.
 */
export async function changeDeliveryMode(
  parcelId: string,
  mode: "PARK",
  by: ActorRef,
): Promise<ParcelSummary> {
  const missed: Pick<Transition, "from" | "to" | "by"> = {
    from: "IN_TRANSIT",
    to: "IN_TRANSIT",
    by: ["DRIVER", "SYSTEM"],
  };
  const summary = await db.$transaction(async (tx) => {
    const parcel = await tx.parcel.findUnique({
      where: { id: parcelId },
      select: {
        status: true,
        deliveryMode: true,
        originParkId: true,
        destinationParkId: true,
        senderId: true,
        tripParcels: { select: { trip: { select: { driverId: true } } } },
      },
    });
    if (!parcel) {
      throw new ParcelError("parcel_not_found", "Parcel not found.", 404);
    }
    if (parcel.status !== "IN_TRANSIT" || parcel.deliveryMode !== "ROADSIDE") {
      throw new ParcelError(
        "transition_not_allowed",
        "Only a roadside parcel on the road can be marked missed.",
        409,
      );
    }
    const user = by.userId
      ? await tx.user.findUnique({
          where: { id: by.userId },
          select: { id: true, role: true, status: true, parkId: true },
        })
      : null;
    const problem = actorProblem({
      transition: missed,
      actor: by.actor,
      user,
      parcel: {
        ...parcel,
        driverIds: parcel.tripParcels.map((tp) => tp.trip.driverId),
      },
    });
    if (problem) throw new ParcelError("actor_not_allowed", problem, 403);

    const { count } = await tx.parcel.updateMany({
      where: { id: parcelId, status: "IN_TRANSIT", deliveryMode: "ROADSIDE" },
      data: { deliveryMode: mode },
    });
    if (count !== 1) {
      throw new ParcelError(
        "status_changed",
        "This parcel was just updated by someone else. Refresh and try again.",
        409,
      );
    }
    await tx.parcelEvent.create({
      data: {
        parcelId,
        type: "ROADSIDE_MISSED",
        fromStatus: "IN_TRANSIT",
        toStatus: "IN_TRANSIT",
        actorId: user?.id ?? null,
        meta: eventMeta(by, { deliveryMode: mode }),
      },
    });
    return toParcelSummary(
      await tx.parcel.findUniqueOrThrow({
        where: { id: parcelId },
        include: summaryInclude,
      }),
    );
  });
  afterResponse(() => notify("roadside_missed", parcelId).then(() => {}));
  return summary;
}

/** Field changes that go with a move, in the same update as the status. */
function sideEffects(
  from: ParcelStatus,
  to: ParcelStatus,
  now: Date,
): Prisma.ParcelUpdateManyMutationInput {
  if (from === "DRAFT" && to === "AWAITING_DROPOFF") {
    return {
      draftExpiresAt: null,
      dropoffDeadline: new Date(
        now.getTime() + DROPOFF_WINDOW_HOURS * 60 * 60 * 1000,
      ),
    };
  }
  return {};
}

/** Who acted, recorded on the event (actorId covers signed-in people). */
function eventMeta(
  by: ActorRef,
  meta: Record<string, unknown> | undefined,
): Prisma.InputJsonValue {
  return { ...(meta ?? {}), actor: by.actor } as Prisma.InputJsonValue;
}

function statusText(s: ParcelStatus): string {
  return STATUS_TEXT[s];
}

/** Status in words, for error messages ("This parcel is already …"). */
const STATUS_TEXT: Record<ParcelStatus, string> = {
  DRAFT: "not paid yet",
  AWAITING_DROPOFF: "waiting for drop-off",
  RECEIVED_AT_ORIGIN: "at the origin park",
  ASSIGNED: "assigned to a driver",
  IN_TRANSIT: "on the road",
  DELIVERED_ROADSIDE: "delivered at the roadside",
  ARRIVED: "at the arrival park",
  COLLECTED: "collected",
  SETTLED: "settled",
  UNCLAIMED: "unclaimed",
  RETURNED: "returned",
  DISPUTED: "under dispute",
  RESOLVED: "resolved",
  CANCELLED: "cancelled",
};

/**
 * Runs `work` after the response is sent when called during a request
 * (next/server `after`), otherwise right away in the background (scripts,
 * jobs, tests). Errors are logged, never thrown: messages must not undo a
 * saved change.
 */
function afterResponse(work: () => Promise<void>): void {
  const run = () =>
    work().catch((e: unknown) => {
      console.error("[parcels] after-commit work failed", e);
    });
  try {
    after(run);
  } catch {
    void run();
  }
}

/** 6-digit code, stored hashed; counter codes expire in 10 minutes. */
export async function issueCollectionCode(
  parcelId: string,
  purpose: CodePurpose,
): Promise<{ sentTo: string; expiresAt: string | null }> {
  void parcelId;
  return stub({
    sentTo: "+234 000 *** 0201",
    expiresAt: purpose === "COUNTER" ? "2026-11-22T09:52:00+00:00" : null,
  });
}

/** Counts attempts and locks after 5 wrong codes (COL-4). */
export async function verifyCollectionCode(
  parcelId: string,
  code: string,
  purpose: CodePurpose,
): Promise<{ ok: boolean; attemptsLeft: number; locked: boolean }> {
  void parcelId;
  void purpose;
  return stub({
    ok: code === "482913" || code === "715204",
    attemptsLeft: 5,
    locked: false,
  });
}

/** Storage owed: 0 inside the free window (from the arrival notice), then daily rate (COL-6). */
export async function storageDues(
  parcelId: string,
  at: Date = new Date(),
): Promise<{
  storageKobo: number;
  freeUntil: string | null;
  daysCharged: number;
}> {
  void parcelId;
  void at;
  return stub({
    storageKobo: 0,
    freeUntil: "2026-11-23T13:10:00+00:00",
    daysCharged: 0,
  });
}
