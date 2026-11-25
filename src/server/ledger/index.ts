/**
 * Owned by Scope 04 (docs/scopes/04-payments-ledger.md). Exported names and
 * types are FINAL; callers never change. Real since sl7.
 *
 * The ledger is append-only (a database trigger refuses UPDATE and DELETE on
 * ledger_entries; this module has no update path either). Money moves like
 * this, in signed kobo:
 *   payment verified   HELD +amount                      (holdPayment)
 *   parcel settled     HELD −amount, and the credits      (settleParcel)
 *                      to driver, park, vendor, platform,
 *                      insurer by ./split.ts
 *   refund (sl9)       reversing entries
 */
import "server-only";
import type { EarningsView, LedgerEntryDto, LedgerView } from "@/contracts/dto";
import type { LedgerAccount } from "@/contracts/enums";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { ParcelError, transition } from "@/server/parcels";
import { settlementRows, type SplitPayment } from "./split";

export const STUB = false;

export { SplitError } from "./split";

/** Why settlement couldn't run. */
export class LedgerError extends Error {
  constructor(
    readonly code: "parcel_not_found" | "not_settleable",
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "LedgerError";
  }
}

type Tx = Prisma.TransactionClient;

/**
 * HELD +amount for a verified payment, inside the caller's transaction.
 * Called once per payment by @/server/payments when it becomes verified;
 * a payment that already has its HELD row is left alone.
 */
export async function holdPayment(tx: Tx, paymentId: string): Promise<void> {
  const payment = await tx.payment.findUnique({
    where: { id: paymentId },
    select: { id: true, parcelId: true, amountKobo: true, status: true },
  });
  if (!payment || payment.status !== "VERIFIED") return;
  const held = await tx.ledgerEntry.count({
    where: { paymentId, account: "HELD", amountKobo: { gt: 0 } },
  });
  if (held) return;
  await tx.ledgerEntry.create({
    data: {
      parcelId: payment.parcelId,
      paymentId,
      account: "HELD",
      amountKobo: payment.amountKobo,
      reason: "Payment received",
    },
  });
}

const SETTLEABLE = ["COLLECTED", "DELIVERED_ROADSIDE"] as const;
const SETTLED_PURPOSES = ["SHIPPING", "TOP_UP", "POD", "STORAGE"] as const;

/**
 * Credits vendor, driver, park and platform in one transaction; parcel →
 * SETTLED (PAY-5). Called by Scope 07 on DELIVERED_ROADSIDE and Scope 08 on
 * COLLECTED. Every verified payment of the parcel that hasn't been settled
 * (and isn't waiting for a refund) leaves HELD and is split by the park's
 * shares. Safe to call again: settled payments are skipped, and if the
 * status change failed after the ledger was written, it is retried.
 * Returns the number of credit rows written (P03's five for PT-9X1A).
 * Throws LedgerError (404 parcel_not_found, 409 not_settleable) or
 * SplitError (no driver on record, shipping amount doesn't add up).
 */
export async function settleParcel(
  parcelId: string,
): Promise<{ entries: number }> {
  const result = await db.$transaction(async (tx) => {
    // One settlement per parcel at a time.
    await tx.$queryRaw`SELECT id FROM parcels WHERE id = ${parcelId} FOR UPDATE`;
    const parcel = await tx.parcel.findUnique({
      where: { id: parcelId },
      include: {
        originPark: { select: { driverShareBps: true } },
        destinationPark: { select: { storageParkShareBps: true } },
      },
    });
    if (!parcel) {
      throw new LedgerError("parcel_not_found", "Parcel not found.", 404);
    }
    if (parcel.status === "SETTLED") return { entries: 0, transition: false };
    if (!(SETTLEABLE as readonly string[]).includes(parcel.status)) {
      throw new LedgerError(
        "not_settleable",
        "Only a collected or delivered parcel can be settled.",
        409,
      );
    }

    const payments = await tx.payment.findMany({
      where: {
        parcelId,
        status: "VERIFIED",
        purpose: { in: [...SETTLED_PURPOSES] },
      },
      orderBy: { createdAt: "asc" },
    });
    const released = new Set(
      (
        await tx.ledgerEntry.findMany({
          where: { parcelId, account: "HELD", amountKobo: { lt: 0 } },
          select: { paymentId: true },
        })
      ).map((e) => e.paymentId),
    );
    const due = payments.filter(
      (p) =>
        !released.has(p.id) &&
        // Flagged for a refund (duplicate, cancelled, ...): sl9 returns it.
        !(p.rawResponse as { needsRefund?: boolean } | null)?.needsRefund,
    );
    if (!due.length) return { entries: 0, transition: true };

    for (const p of due) await holdPayment(tx, p.id);
    const trip = await tx.tripParcel.findFirst({
      where: { parcelId },
      orderBy: { assignedAt: "desc" },
      select: { trip: { select: { driverId: true } } },
    });
    const settings = await tx.settings.findUnique({ where: { id: 1 } });
    const rows = settlementRows(
      due.map((p): SplitPayment => ({
        id: p.id,
        purpose: p.purpose as SplitPayment["purpose"],
        amountKobo: p.amountKobo,
      })),
      parcel,
      trip?.trip.driverId ?? null,
      {
        driverShareBps: parcel.originPark.driverShareBps,
        storageParkShareBps: parcel.destinationPark.storageParkShareBps,
        podFeeBps: settings?.podFeeBps ?? 125,
      },
    );
    await tx.ledgerEntry.createMany({
      data: rows.map((r) => ({ ...r, parcelId })),
    });
    return {
      entries: rows.filter((r) => r.account !== "HELD").length,
      transition: true,
    };
  });

  if (result.transition) {
    try {
      await transition(
        parcelId,
        "SETTLED",
        { actor: "SYSTEM" },
        { eventType: "SETTLED", meta: { entries: result.entries } },
      );
    } catch (e) {
      // Already moved on by a parallel call: the ledger is what matters.
      if (!(e instanceof ParcelError)) throw e;
      const now = await db.parcel.findUnique({
        where: { id: parcelId },
        select: { status: true },
      });
      if (now?.status !== "SETTLED") throw e;
    }
  }
  return { entries: result.entries };
}

/** Sum of an account's entries (one park, driver or vendor with accountRefId). */
export async function balance(
  account: LedgerAccount,
  accountRefId?: string,
): Promise<number> {
  const { _sum } = await db.ledgerEntry.aggregate({
    where: { account, ...(accountRefId ? { accountRefId } : {}) },
    _sum: { amountKobo: true },
  });
  return _sum.amountKobo ?? 0;
}

/** Start of the current month in Lagos (UTC+1, no daylight saving). */
function monthStart(now = new Date()): Date {
  const lagos = new Date(now.getTime() + 60 * 60 * 1000);
  return new Date(
    Date.UTC(lagos.getUTCFullYear(), lagos.getUTCMonth(), 1) - 60 * 60 * 1000,
  );
}

const MAX_ENTRIES = 500;

/**
 * P03 ledger (and the balance D06/S08 show). PARK with a park id: every
 * entry on parcels that start or end at that park, the park's balance and
 * the month's totals. DRIVER / VENDOR / SENDER with an id: that person's
 * entries. PLATFORM (or no id): everything. HELD rows are internal and
 * never listed. Defaults to the month so far.
 */
export async function ledger(filter: {
  account: LedgerAccount;
  accountRefId?: string;
  from?: Date;
  to?: Date;
}): Promise<LedgerView> {
  const from = filter.from ?? monthStart();
  const createdAt = { gte: from, ...(filter.to ? { lte: filter.to } : {}) };
  const scope: Prisma.LedgerEntryWhereInput =
    filter.account === "PARK" && filter.accountRefId
      ? {
          parcel: {
            OR: [
              { originParkId: filter.accountRefId },
              { destinationParkId: filter.accountRefId },
            ],
          },
        }
      : filter.accountRefId
        ? { account: filter.account, accountRefId: filter.accountRefId }
        : filter.account === "PLATFORM"
          ? {}
          : { account: filter.account };
  const where: Prisma.LedgerEntryWhereInput = {
    ...scope,
    createdAt,
    account:
      "account" in scope && scope.account ? scope.account : { not: "HELD" },
  };

  const [rows, sums, bal] = await Promise.all([
    db.ledgerEntry.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: MAX_ENTRIES,
      include: {
        parcel: { select: { parcelCode: true } },
        payment: { select: { txnRef: true } },
      },
    }),
    db.ledgerEntry.groupBy({
      by: ["account"],
      where,
      _sum: { amountKobo: true },
    }),
    filter.accountRefId
      ? balance(filter.account, filter.accountRefId)
      : balance(filter.account),
  ]);
  const total = (account: LedgerAccount) =>
    sums.find((s) => s.account === account)?._sum.amountKobo ?? 0;
  const refunds = rows
    .filter((r) => r.account === "SENDER" && r.amountKobo < 0)
    .reduce((t, r) => t - r.amountKobo, 0);
  const parkShare =
    filter.account === "PARK" && filter.accountRefId
      ? rows
          .filter(
            (r) =>
              r.account === "PARK" && r.accountRefId === filter.accountRefId,
          )
          .reduce((t, r) => t + r.amountKobo, 0)
      : total("PARK");

  const labels = await accountLabels(rows);
  return {
    account: filter.account,
    balanceKobo: bal,
    totals: {
      parkShareKobo: parkShare,
      driverSharesKobo: total("DRIVER"),
      collectedForVendorsKobo: total("VENDOR"),
      refundsKobo: refunds,
    },
    entries: rows.map((r): LedgerEntryDto => ({
      id: r.id,
      at: r.createdAt.toISOString(),
      parcelCode: r.parcel?.parcelCode ?? null,
      account: r.account,
      accountLabel: labels(r.account, r.accountRefId),
      reason: r.reason,
      amountKobo: r.amountKobo,
      paymentRef: r.payment?.txnRef ?? null,
    })),
  };
}

const ACCOUNT_NAME: Record<LedgerAccount, string> = {
  HELD: "Held",
  VENDOR: "Vendor",
  DRIVER: "Driver",
  PARK: "Park",
  PLATFORM: "Platform",
  INSURER: "Insurer",
  SENDER: "Sender",
};

/** "Ogbomoso Motor Park" → "Ogbomoso", "Iwo Road Park" → "Iwo Road". */
export function shortParkName(name: string): string {
  return name.replace(/\s*(motor\s+)?park$/i, "").trim() || name;
}

/** "Vendor · Tolu's Fabrics", "Driver · Ade Lawal", "Park · Ogbomoso". */
async function accountLabels(
  rows: { account: LedgerAccount; accountRefId: string | null }[],
): Promise<(account: LedgerAccount, ref: string | null) => string> {
  const userIds = [
    ...new Set(
      rows
        .filter((r) => r.account !== "PARK" && r.accountRefId)
        .map((r) => r.accountRefId!),
    ),
  ];
  const parkIds = [
    ...new Set(
      rows
        .filter((r) => r.account === "PARK" && r.accountRefId)
        .map((r) => r.accountRefId!),
    ),
  ];
  const [users, parks] = await Promise.all([
    userIds.length
      ? db.user.findMany({
          where: { id: { in: userIds } },
          select: {
            id: true,
            name: true,
            phone: true,
            vendorProfile: { select: { businessName: true } },
          },
        })
      : [],
    parkIds.length
      ? db.park.findMany({
          where: { id: { in: parkIds } },
          select: { id: true, name: true },
        })
      : [],
  ]);
  const names = new Map<string, string>([
    ...users.map((u): [string, string] => [
      u.id,
      u.vendorProfile?.businessName ?? u.name ?? u.phone,
    ]),
    ...parks.map((p): [string, string] => [p.id, shortParkName(p.name)]),
  ]);
  return (account, ref) => {
    const who = ref ? names.get(ref) : undefined;
    return who ? `${ACCOUNT_NAME[account]} · ${who}` : ACCOUNT_NAME[account];
  };
}

const DAY = 24 * 60 * 60 * 1000;
const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * D06 earnings: the driver's fare shares this week (last 7 days, by day) or
 * this month, the change on the period before, and their trips in the
 * period with what each paid them ("credited" once every parcel on it has
 * settled).
 */
export async function driverEarnings(
  driverId: string,
  period: "week" | "month",
): Promise<EarningsView> {
  const now = new Date();
  // Lagos days: shift by +1 h to bucket, back by −1 h for the boundaries.
  const lagosToday = Math.floor((now.getTime() + 60 * 60 * 1000) / DAY);
  const start =
    period === "week"
      ? new Date((lagosToday - 6) * DAY - 60 * 60 * 1000)
      : monthStart(now);
  const length = now.getTime() - start.getTime();
  const prevStart = new Date(start.getTime() - length);

  const entries = await db.ledgerEntry.findMany({
    where: {
      account: "DRIVER",
      accountRefId: driverId,
      createdAt: { gte: prevStart },
    },
    select: { amountKobo: true, createdAt: true, parcelId: true },
  });
  const inPeriod = entries.filter((e) => e.createdAt >= start);
  const periodKobo = inPeriod.reduce((t, e) => t + e.amountKobo, 0);
  const before = entries
    .filter((e) => e.createdAt < start)
    .reduce((t, e) => t + e.amountKobo, 0);

  const days =
    Math.floor((now.getTime() + 60 * 60 * 1000) / DAY) -
    Math.floor((start.getTime() + 60 * 60 * 1000) / DAY) +
    1;
  const byDay = Array.from({ length: days }, (_, i) => {
    const day = Math.floor((start.getTime() + 60 * 60 * 1000) / DAY) + i;
    const date = new Date(day * DAY);
    return {
      day:
        period === "week"
          ? WEEKDAY[date.getUTCDay()]
          : String(date.getUTCDate()),
      kobo: inPeriod
        .filter(
          (e) =>
            Math.floor((e.createdAt.getTime() + 60 * 60 * 1000) / DAY) === day,
        )
        .reduce((t, e) => t + e.amountKobo, 0),
    };
  });

  const trips = await db.trip.findMany({
    where: { driverId, createdAt: { gte: start } },
    orderBy: { createdAt: "desc" },
    include: {
      originPark: { select: { name: true } },
      destinationPark: { select: { name: true } },
      parcels: { select: { parcel: { select: { id: true, status: true } } } },
    },
  });
  const byParcel = new Map<string, number>();
  for (const e of entries) {
    if (e.parcelId) {
      byParcel.set(e.parcelId, (byParcel.get(e.parcelId) ?? 0) + e.amountKobo);
    }
  }

  return {
    periodKobo: Math.max(0, periodKobo),
    changePct:
      before > 0 ? Math.round(((periodKobo - before) / before) * 100) : null,
    byDay: byDay.map((d) => ({ ...d, kobo: Math.max(0, d.kobo) })),
    trips: trips.map((t) => ({
      tripId: t.id,
      label: `${shortParkName(t.originPark.name)} → ${shortParkName(t.destinationPark.name)}`,
      date: (t.departedAt ?? t.createdAt).toISOString(),
      parcelCount: t.parcels.length,
      kobo: Math.max(
        0,
        t.parcels.reduce((s, tp) => s + (byParcel.get(tp.parcel.id) ?? 0), 0),
      ),
      state:
        t.parcels.length > 0 &&
        t.parcels.every((tp) => tp.parcel.status === "SETTLED")
          ? ("credited" as const)
          : ("in_progress" as const),
    })),
  };
}
