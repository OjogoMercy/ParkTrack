import { signToken, verifyToken } from "@/lib/sign";

/**
 * The session cookie (AUTH-2): a jose-signed token holding only the user id,
 * HTTP-only and host-only: everything is on one domain (decision Q45), so
 * the cookie needs no Domain attribute. Valid 30 days, rolling: src/proxy.ts
 * re-issues it once a day while the person keeps using the app.
 *
 * No "server-only" import: src/proxy.ts uses this too. Nothing here reads
 * request state; callers pass the cookie value in.
 */

export const SESSION_COOKIE = "pt_session";
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
/** Re-issue the cookie when the token is older than this. */
export const SESSION_REFRESH_AFTER_SECONDS = 24 * 60 * 60;

export type SessionClaims = { userId: string; issuedAt: number };

export async function createSessionToken(
  userId: string,
  secret: string,
): Promise<string> {
  return signToken(
    { sub: userId },
    { secret, purpose: "session", expiresIn: SESSION_MAX_AGE_SECONDS + "s" },
  );
}

/** The signed-in user id, or null for a missing, tampered or expired token. */
export async function readSessionToken(
  token: string | undefined,
  secret: string,
): Promise<SessionClaims | null> {
  if (!token) return null;
  const payload = await verifyToken(token, { secret, purpose: "session" });
  if (!payload?.sub || typeof payload.iat !== "number") return null;
  return { userId: payload.sub, issuedAt: payload.iat };
}

export function needsRefresh(
  claims: SessionClaims,
  now: Date = new Date(),
): boolean {
  return now.getTime() / 1000 - claims.issuedAt > SESSION_REFRESH_AFTER_SECONDS;
}

export type SessionCookieOptions = {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/";
  maxAge: number;
};

/**
 * `rootDomain` is unused since the cookie became host-only (Q45); it stays
 * in the signature so callers don't change.
 */
export function sessionCookieOptions(
  _rootDomain: string,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): SessionCookieOptions {
  return {
    httpOnly: true,
    secure: nodeEnv === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}
