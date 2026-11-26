import { z } from "zod";

/**
 * Primitive value schemas shared by every contract: ids, money, phones,
 * codes, dates. FROZEN after Scope 01 (additive changes only).
 */

/** Database row id (cuid). */
export const Id = z.string().min(1).max(64);
export type Id = z.infer<typeof Id>;

/**
 * Money in kobo (₦1 = 100 kobo): a safe integer, never a float. Signed, for
 * ledger entries. Field names carry the unit: every money field ends in "Kobo".
 */
export const Kobo = z
  .number()
  .int()
  .refine(Number.isSafeInteger, "Amount is too large");
export type Kobo = z.infer<typeof Kobo>;
/** Non-negative kobo (prices, fees, POD amounts). */
export const KoboAmount = Kobo.refine(
  (n) => n >= 0,
  "Amount can't be negative",
);
export type KoboAmount = z.infer<typeof KoboAmount>;

/** Nigerian phone in E.164: +234 followed by 10 digits. */
export const Phone = z
  .string()
  .regex(/^\+234\d{10}$/, "Enter a Nigerian phone number, e.g. +2348035554471");
export type Phone = z.infer<typeof Phone>;

/** Phone as typed by a person: "0803 555 4471", "8035554471", "+234 803…". */
export const PhoneInput = z.string().trim().min(10).max(20);

/** Masked for display to people who shouldn't see the full number: +234 802 *** 9034 */
export const MaskedPhone = z.string();

/** Short code written on the parcel: PT- + 4 chars, no 0/O/1/I (HS-6). */
export const PARCEL_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ParcelCode = z
  .string()
  .regex(/^PT-[A-HJ-NP-Z2-9]{4}$/, "Parcel codes look like PT-7K3Q");
export type ParcelCode = z.infer<typeof ParcelCode>;

/** Random, url-safe, non-guessable token (publicId, manifest token, QR tokens). */
export const PublicToken = z.string().regex(/^[A-Za-z0-9_-]{16,64}$/);
export type PublicToken = z.infer<typeof PublicToken>;

/** 6-digit code: sign-in OTP, collection code, SMS handshake code. */
export const SixDigitCode = z
  .string()
  .regex(/^\d{6}$/, "Enter the 6-digit code");
export type SixDigitCode = z.infer<typeof SixDigitCode>;

/** Interswitch transaction reference we generate, e.g. ISW-PT-8F3KQ2. */
export const TxnRef = z.string().regex(/^ISW-[A-Z0-9-]{4,40}$/);
export type TxnRef = z.infer<typeof TxnRef>;

/** Park short name in its page address, parktrack.ng/parks/{slug} (Q45). Reserved names are rejected (PARK-3). */
export const RESERVED_SLUGS = ["www", "app", "admin", "api"] as const;
export const ParkSlug = z
  .string()
  .regex(/^[a-z][a-z0-9-]{1,30}[a-z0-9]$/)
  .refine((s) => !(RESERVED_SLUGS as readonly string[]).includes(s), {
    message: "This name is reserved",
  });
export type ParkSlug = z.infer<typeof ParkSlug>;

/** ISO-8601 timestamp string (all dates cross the wire as strings). */
export const IsoDateTime = z.iso.datetime({ offset: true });
export type IsoDateTime = z.infer<typeof IsoDateTime>;

export const LatLng = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type LatLng = z.infer<typeof LatLng>;

/** Bay or shelf at the arrival park, e.g. "C4". */
export const Bay = z.string().trim().min(1).max(8);

/** Standard error body for every API route. */
export const ApiError = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    fields: z.record(z.string(), z.string()).optional(),
  }),
});
export type ApiError = z.infer<typeof ApiError>;

export const Ok = z.object({ ok: z.literal(true) });
export type Ok = z.infer<typeof Ok>;
