import type { ParcelStatus, PaymentPurpose } from "@/contracts/enums";

/**
 * What can be paid, how much, and by whom (PAY-1). Pure, so every rule is
 * unit-tested; ./index.ts loads the parcel and applies them. The amount
 * always comes from the server, never from the browser.
 *
 *   SHIPPING  the booking total, only while the parcel is an unexpired DRAFT
 *   TOP_UP    the size top-up set at drop-off (HS-5), while AWAITING_DROPOFF
 *   POD       pay-on-delivery, once, while the parcel is on its way or waiting
 *   STORAGE   storage owed right now (Scope 03 storageDues), at the park
 */

export type PayablePurpose = Exclude<PaymentPurpose, "REFUND" | "INSURANCE">;

export type ParcelForPayment = {
  status: ParcelStatus;
  senderId: string | null;
  createdByUserId: string | null;
  totalKobo: number;
  topUpRequiredKobo: number;
  podAmountKobo: number;
  podPaidAt: Date | null;
  draftExpiresAt: Date | null;
};

export type Payer =
  | { kind: "user"; userId: string }
  | { kind: "recipient_link"; parcelId: string };

/** The amount to charge, or why this payment can't start now. */
export function payableAmount(
  purpose: PayablePurpose,
  parcel: ParcelForPayment,
  storageOwedKobo: number,
  now: Date = new Date(),
): { amountKobo: number } | { problem: string } {
  switch (purpose) {
    case "SHIPPING":
      if (parcel.status !== "DRAFT")
        return { problem: "This booking is already paid or no longer open." };
      if (parcel.draftExpiresAt && parcel.draftExpiresAt <= now)
        return {
          problem: "This booking expired after 24 hours. Book again to pay.",
        };
      return { amountKobo: parcel.totalKobo };
    case "TOP_UP":
      if (parcel.status !== "AWAITING_DROPOFF" || parcel.topUpRequiredKobo <= 0)
        return { problem: "There's no size top-up to pay for this parcel." };
      return { amountKobo: parcel.topUpRequiredKobo };
    case "POD":
      if (parcel.podAmountKobo <= 0)
        return { problem: "Nothing is due on delivery for this parcel." };
      if (parcel.podPaidAt)
        return { problem: "Pay-on-delivery is already paid." };
      if (
        !["ASSIGNED", "IN_TRANSIT", "ARRIVED", "UNCLAIMED"].includes(
          parcel.status,
        )
      )
        return {
          problem: "Pay-on-delivery opens once the parcel is on its way.",
        };
      return { amountKobo: parcel.podAmountKobo };
    case "STORAGE":
      if (!["ARRIVED", "UNCLAIMED"].includes(parcel.status))
        return { problem: "Storage is only paid at the arrival park." };
      if (storageOwedKobo <= 0)
        return { problem: "No storage fees are owed right now." };
      return { amountKobo: storageOwedKobo };
  }
}

/**
 * Who may pay: the sender (or the agent who made a walk-in booking) pays
 * shipping and top-ups; the recipient pays pay-on-delivery and storage with
 * their tracking link, and a signed-in sender may pay those for them too.
 */
export function payerProblem(
  purpose: PayablePurpose,
  payer: Payer,
  parcel: { id: string } & Pick<
    ParcelForPayment,
    "senderId" | "createdByUserId"
  >,
): string | null {
  if (payer.kind === "recipient_link") {
    if (payer.parcelId !== parcel.id) return "This link is for another parcel.";
    return purpose === "POD" || purpose === "STORAGE"
      ? null
      : "Only the sender can pay for this.";
  }
  const isSender = payer.userId === parcel.senderId;
  const isCreator = payer.userId === parcel.createdByUserId;
  if (purpose === "SHIPPING" || purpose === "TOP_UP") {
    return isSender || isCreator ? null : "Only the sender can pay for this.";
  }
  return isSender ? null : "Use the link sent to the recipient to pay this.";
}

/**
 * True when the signed-in sender (or the agent who booked for them) paid,
 * false when the recipient paid through their tracking link. startPayment
 * records payerPhone only for a signed-in payer, so this decides who gets
 * the receipt and whose ledger a refund belongs to.
 */
export function paidBySender(payment: {
  purpose: string;
  payerPhone: string | null;
}): boolean {
  if (payment.purpose === "SHIPPING" || payment.purpose === "TOP_UP") {
    return true;
  }
  return payment.payerPhone !== null;
}

/** Shown on the Interswitch page. */
export function itemName(purpose: PayablePurpose, parcelCode: string): string {
  const what = {
    SHIPPING: "shipping",
    TOP_UP: "size top-up",
    POD: "pay on delivery",
    STORAGE: "storage",
  }[purpose];
  return `ParkTrack ${parcelCode} ${what}`;
}

/** Background re-checks stop this long after checkout (then staff review). */
export const GIVE_UP_HOURS = 24;

/**
 * Next background re-check, backing off with the payment's age (not the
 * number of checks: the status page asks too while the payer waits):
 * every 5 min for Interswitch's 30 minutes, every 15 min to 2 hours, then
 * hourly. Null once the payment is 24 hours old.
 */
export function nextCheckAt(startedAt: Date, now: Date): Date | null {
  const age = now.getTime() - startedAt.getTime();
  if (age >= GIVE_UP_HOURS * 60 * 60 * 1000) return null;
  const step = age < 30 * 60_000 ? 5 : age < 120 * 60_000 ? 15 : 60;
  return new Date(now.getTime() + step * 60_000);
}
