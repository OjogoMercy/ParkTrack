import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed recipient links (AUTH-5): parktrack.ng/t/<token>. Recipients have no
 * account, so the link itself is their proof.
 *
 *   token = <linkId>.<expiry, base36 seconds>.<signature>
 *
 * - linkId is the parcel's random trackingLinkId (128-bit): the token says
 *   nothing about the parcel, and replacing the id revokes every old link.
 * - signature = HMAC-SHA256(LINK_SIGNING_SECRET, purpose + linkId + expiry),
 *   cut to 128 bits. Changing any character of the token breaks it.
 *
 * Not a JWT on purpose: links are sent by SMS, and a JWT (~170 characters)
 * would take a whole SMS by itself. This token is about 50.
 */

const PURPOSE = "recipient_link";
const SIG_BYTES = 16;

function sign(linkId: string, exp: string, secret: string): Buffer {
  if (secret.length < 32)
    throw new Error("Signing secret must be at least 32 characters.");
  return createHmac("sha256", secret)
    .update(`${PURPOSE}:${linkId}.${exp}`)
    .digest()
    .subarray(0, SIG_BYTES);
}

export function createLinkToken(
  linkId: string,
  expiresAt: Date,
  secret: string,
): string {
  if (!/^[A-Za-z0-9_-]+$/.test(linkId)) throw new Error("Bad link id.");
  const exp = Math.floor(expiresAt.getTime() / 1000).toString(36);
  return `${linkId}.${exp}.${sign(linkId, exp, secret).toString("base64url")}`;
}

/** The link id, or null for a malformed, tampered or expired token. */
export function readLinkToken(
  token: string,
  secret: string,
  now: Date = new Date(),
): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [linkId, exp, sig] = parts;
  if (!/^[A-Za-z0-9_-]+$/.test(linkId) || !/^[0-9a-z]+$/.test(exp)) return null;

  const given = Buffer.from(sig, "base64url");
  const wanted = sign(linkId, exp, secret);
  if (given.length !== wanted.length || !timingSafeEqual(given, wanted))
    return null;
  // base64url decoding ignores some trailing bits; insist on the exact text.
  if (given.toString("base64url") !== sig) return null;

  if (parseInt(exp, 36) * 1000 <= now.getTime()) return null;
  return linkId;
}
