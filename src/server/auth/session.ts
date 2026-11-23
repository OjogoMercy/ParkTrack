import { signToken, verifyToken } from "@/lib/sign";
import { hostnameOf } from "@/server/parks/host";

/**
 * The session cookie (AUTH-2): a jose-signed token holding only the user id,
 * HTTP-only, set on the root domain so one sign-in works on every park
 * subdomain and on app.ROOT_DOMAIN. Valid 30 days, rolling: src/proxy.ts
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

/**
 * Cookie domain for ROOT_DOMAIN: "parktrack.ng" → "parktrack.ng", which
 * browsers also send to every subdomain.
 *
 * Browsers refuse a cookie with a single-label domain ("localhost"), so with
 * ROOT_DOMAIN=localhost:3000 the cookie is host-only: sign-in works, but only
 * on the subdomain where it happened. To test one sign-in across parks
 * locally, use ROOT_DOMAIN=parktrack.localhost:3000 and open
 * ogbomoso.parktrack.localhost:3000 (Chrome resolves *.localhost itself).
 * IP addresses get a host-only cookie too.
 */
export function sessionCookieDomain(rootDomain: string): string | undefined {
  const host = hostnameOf(rootDomain);
  if (!host || !host.includes(".") || /^[\d.]+$/.test(host)) return undefined;
  return host;
}

export type SessionCookieOptions = {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/";
  maxAge: number;
  domain?: string;
};

export function sessionCookieOptions(
  rootDomain: string,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): SessionCookieOptions {
  const domain = sessionCookieDomain(rootDomain);
  return {
    httpOnly: true,
    secure: nodeEnv === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
    ...(domain ? { domain } : {}),
  };
}
