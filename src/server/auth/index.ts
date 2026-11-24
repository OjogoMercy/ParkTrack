/**
 * Owned by Scope 02 (docs/scopes/02-parks-identity.md). Exported names and
 * types are FINAL; callers never change. Everything here is real:
 * sign-in codes (sl3), session (sl4), staff sign-in (sl5), roles and
 * tenancy (sl6), recipient links (sl7), rate limits (sl8).
 */
import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import type { Role } from "@/contracts/enums";
import type { SessionUser } from "@/contracts/dto";
import type { Prisma } from "@/generated/prisma/client";
import { requireEnv, serverEnv } from "@/lib/env";
import { maskPhone, normalizeNgPhone } from "@/lib/phone";
import { sendCode } from "@/server/notify";
import { AuthError } from "./errors";
import { checkOtp, issueOtp, type OtpChannel } from "./otp";
import { prismaOtpStore } from "./otp-store";
import {
  createSessionToken,
  readSessionToken,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "./session";
import { assertParkStaff, parkScope as tenancyScope } from "./tenancy";
import { isStaffPhone, loadSessionUser, signInUser } from "./users";
import { createLinkToken, readLinkToken } from "./recipient-link";
import { db } from "@/lib/db";
import { trackingLinkId } from "@/lib/ids";

export const STUB = false;

export { AuthError, invalidInputResponse } from "./errors";
export {
  clientIp,
  enforceRateLimit,
  RATE_LIMITS,
  type RateLimitRule,
} from "./rate-limit";

/**
 * Current signed-in user from the session cookie, or null. Checks the
 * signature and expiry, then that the account still exists and is ACTIVE,
 * so a deactivated user is signed out on their next request.
 *
 * Reads cookies, so in pages call it inside a <Suspense> boundary, never at
 * the top of a layout (see docs: authentication-with-cache-components).
 * Deduplicated per request.
 */
export const getSession = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const claims = await readSessionToken(token, sessionSecret());
  return claims ? loadSessionUser(claims.userId) : null;
});

/**
 * The signed-in user if they have one of the roles. Throws AuthError
 * signed_out (401) or wrong_role (403).
 */
export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await getSession();
  if (!user) throw new AuthError("signed_out", "Sign in to continue.", 401);
  if (roles.length > 0 && !roles.includes(user.role)) {
    throw new AuthError(
      "wrong_role",
      "Your account can't open this page.",
      403,
    );
  }
  return user;
}

/**
 * The signed-in agent or park admin of this park (tenant separation). Use on
 * every park-staff action that names a park. Throws AuthError signed_out
 * (401), wrong_role (403) or wrong_park (403). Platform admins aren't park
 * staff: platform screens use requireRole("PLATFORM_ADMIN").
 */
export async function requireParkStaff(parkId: string): Promise<SessionUser> {
  const user = await requireRole("AGENT", "PARK_ADMIN");
  assertParkStaff(user, parkId);
  return user;
}

/**
 * Prisma where-fragment limiting parcels to what this user may see. AND it
 * into every parcel query made for a signed-in person, e.g.
 * `db.parcel.findMany({ where: { AND: [parkScope(user), { status }] } })`.
 * Rules in ./tenancy.ts.
 */
export function parkScope(user: SessionUser): Prisma.ParcelWhereInput {
  return tenancyScope(user);
}

export { canSeeParcel, type ParcelTenancy } from "./tenancy";

/**
 * Sends a 6-digit sign-in code (AUTH-1) through @/server/notify. Takes the
 * phone as typed ("0803 555 4471" is fine). Real since Scope 02 sl3: codes
 * are stored hashed in otp_codes; see ./otp.ts for the rules. Sent by
 * @/server/notify sendCode (Scope 03): WhatsApp code template with SMS
 * fallback when NOTIFY_MODE=live; printed to the server log in console mode
 * (blanked in production). `channel` in the result is the one that
 * delivered it.
 *
 * Throws AuthError: invalid_phone, otp_resend_too_soon, otp_rate_limited.
 */
export async function sendOtp(
  phone: string,
  channel: "WHATSAPP" | "SMS" = "WHATSAPP",
): Promise<{
  sent: true;
  channel: "WHATSAPP" | "SMS";
  sentTo: string;
  resendInSeconds: number;
}> {
  const e164 = toE164(phone);
  const result = await issueOtp({
    phone: e164,
    channel,
    store: prismaOtpStore,
    secret: codeSecret(),
    deliver: deliverCode,
  });
  return { sent: true, sentTo: maskPhone(e164), ...result };
}

/**
 * Checks a sign-in code and uses it up. verifyOtp (sl4) calls this before
 * creating the user and the session. Throws AuthError: invalid_phone,
 * otp_missing, otp_expired, otp_wrong, otp_locked.
 */
export async function checkSignInCode(
  phone: string,
  code: string,
): Promise<{ phone: string }> {
  const e164 = toE164(phone);
  await checkOtp({
    phone: e164,
    code,
    store: prismaOtpStore,
    secret: codeSecret(),
  });
  return { phone: e164 };
}

function toE164(phone: string): string {
  const e164 = normalizeNgPhone(phone);
  if (!e164) {
    throw new AuthError(
      "invalid_phone",
      "Enter a Nigerian phone number, e.g. 0803 555 4471.",
      400,
      { fields: { phone: "Enter a Nigerian phone number" } },
    );
  }
  return e164;
}

function codeSecret(): string {
  return requireEnv("AUTH_JWT_SECRET");
}

/**
 * Sends the code through @/server/notify (Scope 03): WhatsApp code template
 * or SMS with fallback in live mode, the server log in console mode (codes
 * blanked in production). Returns the channel that delivered it.
 */
async function deliverCode(
  phone: string,
  code: string,
  channel: OtpChannel,
): Promise<OtpChannel> {
  return (await sendCode(phone, code, channel)).channel;
}

/**
 * Checks the code, creates the user if new (a sender tied to signupParkId,
 * AUTH-3), and sets the network-wide session cookie. Call from a Route
 * Handler or Server Action (cookies can only be set there). Throws
 * AuthError: the checkSignInCode errors, or account_deactivated.
 */
export async function verifyOtp(
  phone: string,
  code: string,
  signupParkId?: string,
): Promise<{ user: SessionUser; isNew: boolean }> {
  const { phone: e164 } = await checkSignInCode(phone, code);
  const result = await signInUser(e164, signupParkId);
  await setSessionCookie(result.user.id);
  return result;
}

/**
 * Console sign-in (app.ROOT_DOMAIN): like sendOtp, but only for staff
 * (agents, drivers, park and platform admins). Unknown phones and senders
 * get not_staff and no code is sent, so the console never creates accounts.
 */
export async function sendStaffOtp(
  phone: string,
  channel: "WHATSAPP" | "SMS" = "WHATSAPP",
): ReturnType<typeof sendOtp> {
  if (!(await isStaffPhone(toE164(phone)))) throw notStaff();
  return sendOtp(phone, channel);
}

/** Console sign-in: checks the code and signs in an existing staff member. */
export async function verifyStaffOtp(
  phone: string,
  code: string,
): Promise<{ user: SessionUser; isNew: false }> {
  const e164 = toE164(phone);
  if (!(await isStaffPhone(e164))) throw notStaff();
  await checkSignInCode(e164, code);
  const { user } = await signInUser(e164, undefined);
  await setSessionCookie(user.id);
  return { user, isNew: false };
}

function notStaff() {
  return new AuthError(
    "not_staff",
    "This number isn't on a ParkTrack staff account. Senders sign in on their park's page. If you work at a park, ask your park admin to add you.",
    403,
  );
}

async function setSessionCookie(userId: string): Promise<void> {
  const token = await createSessionToken(userId, sessionSecret());
  (await cookies()).set(SESSION_COOKIE, token, cookieOptions());
}

/** Clears the session cookie on the root domain (every subdomain). */
export async function signOut(): Promise<void> {
  // Same domain and path as when it was set, or the browser keeps it.
  (await cookies()).set(SESSION_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
}

function sessionSecret(): string {
  return requireEnv("AUTH_JWT_SECRET");
}

function cookieOptions() {
  const env = serverEnv();
  return sessionCookieOptions(env.ROOT_DOMAIN, env.NODE_ENV);
}

/**
 * Signed recipient tracking link token (AUTH-5), for parktrack.ng/t/<token>
 * and /collect. Valid 14 days by default. The token holds the parcel's random
 * trackingLinkId (created here on first use), never the parcel id. Throws if
 * the parcel doesn't exist. Format and signature: ./recipient-link.ts.
 */
export async function signRecipientLink(
  parcelId: string,
  ttlSeconds = 60 * 60 * 24 * 14,
): Promise<string> {
  const linkId = await ensureTrackingLinkId(parcelId);
  return createLinkToken(
    linkId,
    new Date(Date.now() + ttlSeconds * 1000),
    linkSecret(),
  );
}

/**
 * The parcel behind a recipient link, or null when the token is malformed,
 * tampered with, expired, or was revoked by revokeRecipientLinks().
 */
export async function verifyRecipientLink(
  token: string,
): Promise<{ parcelId: string } | null> {
  const linkId = readLinkToken(token, linkSecret());
  if (!linkId) return null;
  const parcel = await db.parcel.findUnique({
    where: { trackingLinkId: linkId },
    select: { id: true },
  });
  return parcel ? { parcelId: parcel.id } : null;
}

/**
 * Cancels every link sent for this parcel (e.g. the recipient's phone was
 * corrected and the old number shouldn't keep access). The next
 * signRecipientLink() makes a new one.
 */
export async function revokeRecipientLinks(parcelId: string): Promise<void> {
  await db.parcel.update({
    where: { id: parcelId },
    data: { trackingLinkId: trackingLinkId() },
  });
}

async function ensureTrackingLinkId(parcelId: string): Promise<string> {
  const parcel = await db.parcel.findUnique({
    where: { id: parcelId },
    select: { trackingLinkId: true },
  });
  if (!parcel) throw new Error(`Parcel ${parcelId} not found.`);
  if (parcel.trackingLinkId) return parcel.trackingLinkId;
  // Only set it if still empty, so two links made at once share one id.
  await db.parcel.updateMany({
    where: { id: parcelId, trackingLinkId: null },
    data: { trackingLinkId: trackingLinkId() },
  });
  const updated = await db.parcel.findUniqueOrThrow({
    where: { id: parcelId },
    select: { trackingLinkId: true },
  });
  return updated.trackingLinkId!;
}

function linkSecret(): string {
  return requireEnv("LINK_SIGNING_SECRET");
}
