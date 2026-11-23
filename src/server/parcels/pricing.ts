import type { Quote } from "@/contracts/dto";
import type { SizeClass } from "@/contracts/enums";
import { PROHIBITED_ITEMS } from "@/contracts/enums";
import { formatNaira } from "@/lib/money";
import { ParcelError } from "./errors";

/**
 * Booking money and item rules (BOOK-4, BOOK-8). Pure: the caller loads the
 * route and settings. All amounts are integer kobo.
 */

export const SIZE_LABEL: Record<SizeClass, string> = {
  S: "Small",
  M: "Medium",
  L: "Large",
};

/** Hours an unpaid booking is kept before it's cancelled (Q9, S06 copy). */
export const DRAFT_TTL_HOURS = 24;

export function fareFor(
  route: {
    fareSmallKobo: number;
    fareMediumKobo: number;
    fareLargeKobo: number;
  },
  size: SizeClass,
): number {
  return size === "S"
    ? route.fareSmallKobo
    : size === "M"
      ? route.fareMediumKobo
      : route.fareLargeKobo;
}

/**
 * The sender's total, line by line as S03/S04 show it: fare by size plus
 * the platform's service fee. Insurance is off for the hackathon (Q13), so
 * it is always 0 and has no line. Pay-on-delivery isn't part of the total
 * (the recipient pays it); it is checked against the pilot limit and its
 * 1.25% fee comes off the vendor's payout later (Scope 04).
 */
export function buildQuote({
  fareKobo,
  size,
  platformFeeKobo,
  podKobo,
  podLimitKobo,
}: {
  fareKobo: number;
  size: SizeClass;
  platformFeeKobo: number;
  podKobo: number;
  podLimitKobo: number;
}): Quote {
  if (!Number.isInteger(podKobo) || podKobo < 0) {
    throw new ParcelError(
      "invalid_booking",
      "Enter the amount to collect in naira.",
      400,
      { podAmountKobo: "Enter a valid amount" },
    );
  }
  if (podKobo > podLimitKobo) {
    throw new ParcelError(
      "pod_too_high",
      `Pay on delivery is limited to ${formatNaira(podLimitKobo)} per parcel for now.`,
      400,
      { podAmountKobo: `Up to ${formatNaira(podLimitKobo)}` },
    );
  }
  const insuranceKobo = 0;
  return {
    fareKobo,
    platformFeeKobo,
    insuranceKobo,
    totalKobo: fareKobo + platformFeeKobo + insuranceKobo,
    podAmountKobo: podKobo,
    lines: [
      { label: `Fare · ${SIZE_LABEL[size]}`, amountKobo: fareKobo },
      { label: "Service fee", amountKobo: platformFeeKobo },
    ],
  };
}

/**
 * Words that mean a prohibited item (PRD §6.5). Prohibited goods aren't in
 * the category list, so this only catches them typed into the description
 * (e.g. "Other" + "gas cylinder"). Whole words only, to avoid refusing
 * "cashew nuts" or "gunny sacks".
 */
const PROHIBITED_PATTERNS: readonly [
  RegExp,
  (typeof PROHIBITED_ITEMS)[number],
][] = [
  [
    /\b(fire ?arms?|guns?|pistols?|rifles?|ammunition|ammo|bullets?|explosives?|dynamite|grenades?)\b/i,
    "Firearms, ammunition or explosives",
  ],
  [
    // "fuel" alone, not car parts like "fuel pump" or "fuel filter".
    /\b(petrol|diesel|kerosene|gas cylinders?|cooking gas|lpg|flammable)\b|\bfuel\b(?!\s*(pumps?|filters?|tanks?|gauges?|injectors?|lines?|caps?)\b)/i,
    "Fuel, gas cylinders or flammable liquids",
  ],
  [
    /\b(cocaine|heroin|cannabis|marijuana|indian hemp|tramadol|codeine)\b/i,
    "Illegal drugs",
  ],
  [
    /\b(live (animals?|chickens?|goats?|birds?|fowls?|fish|snails?))\b/i,
    "Live animals",
  ],
  // Not "check": check fabric is a common textile.
  [/\b(cash|cheques?|bank notes?)\b/i, "Cash or cheques"],
];

/** The prohibited item a description names, or null. */
export function prohibitedItemIn(description: string): string | null {
  for (const [pattern, item] of PROHIBITED_PATTERNS) {
    if (pattern.test(description)) return item;
  }
  return null;
}
