/**
 * Owned by Scope 03 (docs/scopes/03-parcel-engine.md). Exported names and
 * types are FINAL; callers never change. Everything here is real:
 * transition / changeDeliveryMode (sl1), createDraft / quote (sl2),
 * collection codes (sl3), storageDues (sl4).
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
import { requireEnv } from "@/lib/env";
import {
  parcelCode as newParcelCode,
  publicToken,
  sixDigitCode,
} from "@/lib/ids";
import { maskPhone, normalizeNgPhone } from "@/lib/phone";
import { hashCode, verifyCode } from "@/lib/sign";
import {
  afterWrongCode,
  CODE_MAX_WRONG,
  CODE_RESEND_SECONDS,
  codeContext,
  codeExpiredReason,
  codeExpiry,
  issueProblem,
} from "./codes";
import {
  buildQuote,
  DRAFT_TTL_HOURS,
  fareFor,
  prohibitedItemIn,
} from "./pricing";
import { notify } from "@/server/notify";
import { ParcelError } from "./errors";
import { actorProblem, eventTypeFor, notificationFor } from "./lifecycle";
import { computeStorageDues } from "./storage";
import { summaryInclude, toParcelSummary } from "./summary";

export const STUB = false;

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
        originPark: { select: { dropoffDeadlineHours: true } },
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
      data: {
        status: to,
        ...sideEffects(from, to, now, parcel.originPark.dropoffDeadlineHours),
      },
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

/**
 * Field changes that go with a move, in the same update as the status.
 * Paying starts the origin park's drop-off deadline (48 h by default).
 */
function sideEffects(
  from: ParcelStatus,
  to: ParcelStatus,
  now: Date,
  dropoffDeadlineHours: number,
): Prisma.ParcelUpdateManyMutationInput {
  if (from === "DRAFT" && to === "AWAITING_DROPOFF") {
    return {
      draftExpiresAt: null,
      dropoffDeadline: new Date(
        now.getTime() + dropoffDeadlineHours * 60 * 60 * 1000,
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

/**
 * Sends the recipient a new 6-digit collection code (COL-1, COL-2), real
 * since Scope 03 sl3. Counter codes last 10 minutes; roadside codes last
 * until the trip ends (Q4). Any earlier code for the same purpose is
 * cancelled. The code is stored only as a hash and never logged in
 * events; it goes to the recipient's phone with the collection_started
 * message. Rules in ./codes.ts.
 *
 * Throws ParcelError: parcel_not_found (404), code_not_allowed (409: wrong
 * stage, or the parcel is locked), code_resend_too_soon (429).
 */
export async function issueCollectionCode(
  parcelId: string,
  purpose: CodePurpose,
): Promise<{ sentTo: string; expiresAt: string | null }> {
  const now = new Date();
  const code = sixDigitCode();
  const result = await db.$transaction(async (tx) => {
    await lockParcelRow(tx, parcelId);
    const parcel = await tx.parcel.findUnique({
      where: { id: parcelId },
      select: {
        status: true,
        deliveryMode: true,
        locked: true,
        recipientPhone: true,
      },
    });
    if (!parcel) {
      throw new ParcelError("parcel_not_found", "Parcel not found.", 404);
    }
    const problem = issueProblem(parcel, purpose);
    if (problem) throw new ParcelError("code_not_allowed", problem, 409);

    const last = await tx.collectionCode.findFirst({
      where: { parcelId, purpose },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    const wait = last
      ? Math.ceil(
          CODE_RESEND_SECONDS -
            (now.getTime() - last.createdAt.getTime()) / 1000,
        )
      : 0;
    if (wait > 0) {
      throw new ParcelError(
        "code_resend_too_soon",
        `A code was just sent. Wait ${wait} seconds before asking again.`,
        429,
      );
    }

    await tx.collectionCode.updateMany({
      where: { parcelId, purpose, usedAt: null, voidedAt: null },
      data: { voidedAt: now },
    });
    const expiresAt = codeExpiry(purpose, now);
    await tx.collectionCode.create({
      data: {
        parcelId,
        purpose,
        codeHash: hashCode(code, codeContext(parcelId, purpose), codeSecret()),
        sentToPhone: parcel.recipientPhone,
        expiresAt,
        createdAt: now,
      },
    });
    await tx.parcelEvent.create({
      data: {
        parcelId,
        type: "COLLECTION_CODE_ISSUED",
        fromStatus: parcel.status,
        toStatus: parcel.status,
        meta: { purpose, expiresAt: expiresAt?.toISOString() ?? null },
        createdAt: now,
      },
    });
    return {
      sentTo: maskPhone(parcel.recipientPhone),
      expiresAt: expiresAt?.toISOString() ?? null,
    };
  });

  afterResponse(() =>
    notify("collection_started", parcelId, {
      code,
      purpose,
      ...(result.expiresAt ? { expiresAt: result.expiresAt } : {}),
    }).then(() => {}),
  );
  return result;
}

/**
 * Checks a collection code (COL-4), real since Scope 03 sl3. A right code
 * is used up; a wrong one counts against the parcel, and the 5th wrong code
 * (across every code sent for that purpose) locks the parcel. Checks for
 * one parcel run one at a time, so parallel guesses can't beat the limit.
 *
 * Returns { ok, attemptsLeft, locked }. Throws ParcelError:
 * parcel_not_found (404), code_missing / code_used / code_expired (409).
 */
export async function verifyCollectionCode(
  parcelId: string,
  code: string,
  purpose: CodePurpose,
): Promise<{ ok: boolean; attemptsLeft: number; locked: boolean }> {
  const now = new Date();
  return db.$transaction(async (tx) => {
    await lockParcelRow(tx, parcelId);
    const parcel = await tx.parcel.findUnique({
      where: { id: parcelId },
      select: { status: true, deliveryMode: true, locked: true },
    });
    if (!parcel) {
      throw new ParcelError("parcel_not_found", "Parcel not found.", 404);
    }
    if (parcel.locked) return { ok: false, attemptsLeft: 0, locked: true };

    const active = await tx.collectionCode.findFirst({
      where: { parcelId, purpose, usedAt: null, voidedAt: null },
      orderBy: { createdAt: "desc" },
    });
    if (!active) {
      const latest = await tx.collectionCode.findFirst({
        where: { parcelId, purpose },
        orderBy: { createdAt: "desc" },
        select: { usedAt: true },
      });
      throw latest?.usedAt
        ? new ParcelError(
            "code_used",
            "This code was already used. Ask for a new one if needed.",
            409,
          )
        : new ParcelError(
            "code_missing",
            "No code has been sent for this parcel. Ask for a new one.",
            409,
          );
    }
    const expired = codeExpiredReason(active, parcel, purpose, now);
    if (expired) throw new ParcelError("code_expired", expired, 409);

    const { _sum } = await tx.collectionCode.aggregate({
      where: { parcelId, purpose },
      _sum: { attempts: true },
    });
    const wrongBefore = _sum.attempts ?? 0;

    const right =
      /^\d{6}$/.test(code) &&
      verifyCode(
        code,
        codeContext(parcelId, purpose),
        active.codeHash,
        codeSecret(),
      );
    if (right) {
      await tx.collectionCode.update({
        where: { id: active.id },
        data: { usedAt: now },
      });
      return {
        ok: true,
        attemptsLeft: Math.max(0, CODE_MAX_WRONG - wrongBefore),
        locked: false,
      };
    }

    // `attempts` counts wrong codes only.
    await tx.collectionCode.update({
      where: { id: active.id },
      data: { attempts: { increment: 1 } },
    });
    const outcome = afterWrongCode(wrongBefore);
    if (outcome.locked) {
      await tx.parcel.update({
        where: { id: parcelId },
        data: { locked: true },
      });
      await tx.parcelEvent.create({
        data: {
          parcelId,
          type: "NOTE",
          fromStatus: parcel.status,
          toStatus: parcel.status,
          note: `Locked after ${CODE_MAX_WRONG} wrong collection codes`,
          meta: { purpose, locked: true },
          createdAt: now,
        },
      });
    }
    return { ok: false, ...outcome };
  });
}

/**
 * Takes a row lock on the parcel for the rest of the transaction, so code
 * issues and checks for one parcel happen one at a time.
 */
async function lockParcelRow(
  tx: Prisma.TransactionClient,
  parcelId: string,
): Promise<void> {
  await tx.$queryRaw`SELECT id FROM parcels WHERE id = ${parcelId} FOR UPDATE`;
}

function codeSecret(): string {
  return requireEnv("AUTH_JWT_SECRET");
}

/**
 * Storage owed at the arrival park at time `at` (COL-6), real since Scope 03
 * sl4: nothing inside the free window, which starts when the recipient is
 * told the parcel arrived; then the destination park's daily rate for the
 * parcel's size per started day, up to the maximum hold, stopping at
 * collection and leaving out days already paid. Rules in ./storage.ts.
 *
 * Returns { storageKobo, freeUntil (null until the arrival notice),
 * daysCharged }. Throws ParcelError parcel_not_found (404).
 */
export async function storageDues(
  parcelId: string,
  at: Date = new Date(),
): Promise<{
  storageKobo: number;
  freeUntil: string | null;
  daysCharged: number;
}> {
  const parcel = await db.parcel.findUnique({
    where: { id: parcelId },
    select: {
      sizeClass: true,
      destinationParkId: true,
      arrivalNotifiedAt: true,
      storagePaidUntil: true,
      destinationPark: {
        select: { storageWindowHours: true, maxHoldDays: true },
      },
      events: {
        where: { type: "COLLECTED" },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { createdAt: true },
      },
    },
  });
  if (!parcel) {
    throw new ParcelError("parcel_not_found", "Parcel not found.", 404);
  }
  const rate = await db.storageRate.findFirst({
    where: {
      parkId: parcel.destinationParkId,
      sizeClass: parcel.sizeClass,
      effectiveFrom: { lte: at },
    },
    orderBy: { effectiveFrom: "desc" },
    select: { dailyRateKobo: true },
  });
  return computeStorageDues({
    notifiedAt: parcel.arrivalNotifiedAt,
    windowHours: parcel.destinationPark.storageWindowHours,
    maxHoldDays: parcel.destinationPark.maxHoldDays,
    dailyRateKobo: rate?.dailyRateKobo ?? 0,
    paidUntil: parcel.storagePaidUntil,
    collectedAt: parcel.events[0]?.createdAt ?? null,
    at,
  });
}
