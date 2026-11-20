import { createHmac, timingSafeEqual } from "node:crypto";
import { jwtVerify, SignJWT, type JWTPayload } from "jose";

/**
 * Server-side signing helpers.
 *
 * - signToken / verifyToken: HS256 JWTs (jose) for the session cookie and
 *   signed recipient links (Scope 02). Each use has its own `purpose`, so a
 *   link token can never be replayed as a session, and vice versa.
 * - hashCode / verifyCode: keyed hashes for short codes (OTP, collection
 *   codes, SMS handshake codes). Codes are never stored in plain text.
 */

export type TokenPurpose = "session" | "recipient_link" | "agent_handshake";

const ISSUER = "parktrack";
const encoder = new TextEncoder();

function key(secret: string): Uint8Array {
  if (secret.length < 32)
    throw new Error("Signing secret must be at least 32 characters.");
  return encoder.encode(secret);
}

export async function signToken(
  payload: JWTPayload,
  {
    secret,
    purpose,
    expiresIn,
  }: { secret: string; purpose: TokenPurpose; expiresIn: string | number },
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience(purpose)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(key(secret));
}

/** Returns the payload, or null when the token is invalid, expired or for another purpose. */
export async function verifyToken<T extends JWTPayload = JWTPayload>(
  token: string,
  { secret, purpose }: { secret: string; purpose: TokenPurpose },
): Promise<T | null> {
  try {
    const { payload } = await jwtVerify(token, key(secret), {
      issuer: ISSUER,
      audience: purpose,
      algorithms: ["HS256"],
    });
    return payload as T;
  } catch {
    return null;
  }
}

/** Keyed hash of a short code, bound to what it's for (e.g. a parcel id or phone). */
export function hashCode(
  code: string,
  context: string,
  secret: string,
): string {
  return createHmac("sha256", key(secret))
    .update(`${context}:${code}`)
    .digest("hex");
}

/** Constant-time comparison against a stored hash. */
export function verifyCode(
  code: string,
  context: string,
  storedHash: string,
  secret: string,
): boolean {
  const a = Buffer.from(hashCode(code, context, secret), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
