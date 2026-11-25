/**
 * Settlement split (PAY-5, docs/scopes/04-payments-ledger.md "Ledger
 * rules", decided in Q3/Q7): pure, so the numbers are tested directly.
 * Amounts are integer kobo; shares are basis points (6000 = 60%).
 *
 *   shipping  driver driverShareBps of the fare, park (origin) the rest of
 *             the fare, platform the service fee, insurer the insurance
 *   top-up    extra fare: driver / park like the fare
 *   POD       vendor (the sender) the amount less podFeeBps, platform the fee
 *   storage   park (destination) storageParkShareBps, platform the rest
 *
 * Each payment's money leaves HELD in the same set of rows, so a
 * settlement always sums to zero.
 */
import type { LedgerAccount, PaymentPurpose } from "@/contracts/enums";

export type SplitPayment = {
  id: string;
  purpose: Exclude<PaymentPurpose, "REFUND" | "INSURANCE">;
  amountKobo: number;
};

export type SplitParcel = {
  fareKobo: number;
  platformFeeKobo: number;
  insuranceKobo: number;
  senderId: string | null;
  originParkId: string;
  destinationParkId: string;
};

export type SplitShares = {
  /** Origin park's driver share of the fare. */
  driverShareBps: number;
  /** Destination park's share of storage fees. */
  storageParkShareBps: number;
  /** Platform fee on pay-on-delivery. */
  podFeeBps: number;
};

export type LedgerRow = {
  paymentId: string;
  account: LedgerAccount;
  accountRefId: string | null;
  amountKobo: number;
  reason: string;
};

export class SplitError extends Error {
  constructor(
    readonly code: "no_driver" | "amount_mismatch",
    message: string,
  ) {
    super(message);
    this.name = "SplitError";
  }
}

/** Share of an amount in basis points, rounded to the nearest kobo. */
export function bpsOf(amountKobo: number, bps: number): number {
  return Math.round((amountKobo * bps) / 10_000);
}

/** 125 → "1.25%", 6000 → "60%". */
export function percent(bps: number): string {
  return `${Number((bps / 100).toFixed(2))}%`;
}

/** Credit rows (in P03 order) plus each payment's release from HELD. */
export function settlementRows(
  payments: SplitPayment[],
  parcel: SplitParcel,
  driverId: string | null,
  shares: SplitShares,
): LedgerRow[] {
  const rows: LedgerRow[] = [];
  const fare = (p: SplitPayment, amount: number, label: string) => {
    if (!driverId) {
      throw new SplitError(
        "no_driver",
        "This parcel has no driver on record, so the fare can't be split.",
      );
    }
    const driver = bpsOf(amount, shares.driverShareBps);
    rows.push(
      row(p, "DRIVER", driverId, driver, label),
      row(p, "PARK", parcel.originParkId, amount - driver, label),
    );
  };
  // POD first, then shipping, then the rest: the order P03 shows.
  const order: SplitPayment["purpose"][] = [
    "POD",
    "SHIPPING",
    "TOP_UP",
    "STORAGE",
  ];
  const sorted = [...payments].sort(
    (a, b) => order.indexOf(a.purpose) - order.indexOf(b.purpose),
  );

  for (const p of sorted) {
    switch (p.purpose) {
      case "SHIPPING": {
        const parts =
          parcel.fareKobo + parcel.platformFeeKobo + parcel.insuranceKobo;
        if (parts !== p.amountKobo) {
          throw new SplitError(
            "amount_mismatch",
            `Shipping payment ${p.amountKobo} kobo doesn't match fare + fee + insurance (${parts}).`,
          );
        }
        fare(p, parcel.fareKobo, "Fare share");
        rows.push(
          row(p, "PLATFORM", null, parcel.platformFeeKobo, "Service fee"),
        );
        if (parcel.insuranceKobo > 0) {
          rows.push(row(p, "INSURER", null, parcel.insuranceKobo, "Insurance"));
        }
        break;
      }
      case "TOP_UP":
        fare(p, p.amountKobo, "Fare share · size top-up");
        break;
      case "POD": {
        const fee = bpsOf(p.amountKobo, shares.podFeeBps);
        rows.push(
          row(
            p,
            "VENDOR",
            parcel.senderId,
            p.amountKobo - fee,
            `Pay on delivery, less ${percent(shares.podFeeBps)}`,
          ),
          row(p, "PLATFORM", null, fee, "Pay-on-delivery fee"),
        );
        break;
      }
      case "STORAGE": {
        const park = bpsOf(p.amountKobo, shares.storageParkShareBps);
        rows.push(
          row(p, "PARK", parcel.destinationParkId, park, "Storage"),
          row(p, "PLATFORM", null, p.amountKobo - park, "Storage share"),
        );
        break;
      }
    }
  }
  for (const p of sorted) {
    rows.push(row(p, "HELD", null, -p.amountKobo, "Settled"));
  }
  // Zero-kobo credits (e.g. a free service fee) aren't worth a row.
  return rows.filter((r) => r.amountKobo !== 0);
}

function row(
  p: SplitPayment,
  account: LedgerAccount,
  accountRefId: string | null,
  amountKobo: number,
  reason: string,
): LedgerRow {
  return { paymentId: p.id, account, accountRefId, amountKobo, reason };
}
