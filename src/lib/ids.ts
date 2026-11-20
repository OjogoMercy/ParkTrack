import { PARCEL_CODE_ALPHABET } from "@/contracts/primitives";

/**
 * Random identifiers. Uses Web Crypto (globalThis.crypto), available in
 * Node 22+, browsers and edge runtimes. Never Math.random for anything a
 * person could guess to reach someone else's parcel.
 */

function randomBytes(n: number): Uint8Array {
  const bytes = new Uint8Array(n);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

function base64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Uniform random integer in [0, max) without modulo bias. */
export function randomInt(max: number): number {
  if (!Number.isInteger(max) || max <= 0 || max > 2 ** 32) {
    throw new RangeError("max must be an integer in (0, 2^32]");
  }
  const limit = Math.floor(2 ** 32 / max) * max;
  const buf = new Uint32Array(1);
  while (true) {
    globalThis.crypto.getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % max;
  }
}

/**
 * 128-bit url-safe token (22 chars). Used for the booking QR (publicId),
 * manifest tokens, park counter tokens, agent handshake tokens and
 * tracking link ids.
 */
export function publicToken(): string {
  return base64url(randomBytes(16));
}
export const publicId = publicToken;
export const manifestToken = publicToken;
export const parkCounterToken = publicToken;
export const agentQrToken = publicToken;
export const trackingLinkId = publicToken;

/**
 * Short code written on the parcel: "PT-" + 4 characters from an alphabet
 * without 0/O/1/I (32^4 ≈ 1M codes). Not secret; uniqueness is enforced by
 * the database, so callers retry on a unique-constraint clash.
 */
export function parcelCode(): string {
  let s = "PT-";
  for (let i = 0; i < 4; i++)
    s += PARCEL_CODE_ALPHABET[randomInt(PARCEL_CODE_ALPHABET.length)];
  return s;
}

/** Interswitch transaction reference: "ISW-PT-" + 8 chars, e.g. ISW-PT-8F3KQ2XA. */
export function txnRef(): string {
  let s = "ISW-PT-";
  for (let i = 0; i < 8; i++)
    s += PARCEL_CODE_ALPHABET[randomInt(PARCEL_CODE_ALPHABET.length)];
  return s;
}

/** 6-digit numeric code (OTP, collection code, SMS handshake), leading zeros kept. */
export function sixDigitCode(): string {
  return String(randomInt(1_000_000)).padStart(6, "0");
}
