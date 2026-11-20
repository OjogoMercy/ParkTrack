/**
 * STUB (Scope 01) — owned by Scope 04 (docs/scopes/04-payments-ledger.md).
 * Exported names and types are FINAL. Scope 04 replaces the bodies;
 * callers never change. Until then everything returns fixture data.
 */
import type { EarningsView, LedgerView } from "@/contracts/dto";
import type { LedgerAccount } from "@/contracts/enums";
import { earnings, ledgerView } from "@/mocks/fixtures";
import { stub } from "@/mocks/stub";

export const STUB = true;

/** Credits vendor, driver, park and platform in one transaction; parcel → SETTLED (PAY-5). */
export async function settleParcel(
  parcelId: string,
): Promise<{ entries: number }> {
  void parcelId;
  return stub({ entries: 5 });
}

export async function balance(
  account: LedgerAccount,
  accountRefId?: string,
): Promise<number> {
  void account;
  void accountRefId;
  return stub(ledgerView.balanceKobo);
}

export async function ledger(filter: {
  account: LedgerAccount;
  accountRefId?: string;
  from?: Date;
  to?: Date;
}): Promise<LedgerView> {
  return stub({ ...ledgerView, account: filter.account });
}

export async function driverEarnings(
  driverId: string,
  period: "week" | "month",
): Promise<EarningsView> {
  void driverId;
  void period;
  return stub(earnings);
}
