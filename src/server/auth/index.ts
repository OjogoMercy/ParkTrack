/**
 * Owned by Scope 02 (docs/scopes/02-parks-identity.md). Exported names and
 * types are FINAL; callers never change. Being replaced slice by slice:
 * sendOtp / checkSignInCode are real (sl3); the rest still return fixture
 * data until sl4 (session), sl6 (roles, tenancy) and sl7 (recipient links).
 * STUB stays true until every function here is real.
 */
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
  bayoSession,
  parcelAwaiting,
  toluSession,
  TRACKING_LINK,
} from "@/mocks/fixtures";
import { stub } from "@/mocks/stub";

export const STUB = true;

export { AuthError } from "./errors";

/** Current signed-in user from the session cookie, or null. */
export async function getSession(): Promise<SessionUser | null> {
  return stub(toluSession);
}

/** Throws a 401/403 unless the signed-in user has one of the roles. */
export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  return stub(roles.includes("AGENT") ? bayoSession : toluSession);
}

/** Agent or park admin of this park (tenant separation). */
export async function requireParkStaff(parkId: string): Promise<SessionUser> {
  return stub({
    ...bayoSession,
    park: { ...bayoSession.park!, id: parkId },
  });
}

/** Prisma where-fragment limiting parcels to what this user may see. */
export function parkScope(user: SessionUser): Prisma.ParcelWhereInput {
  if (user.role === "PLATFORM_ADMIN") return {};
  if (user.park) {
    return {
      OR: [{ originParkId: user.park.id }, { destinationParkId: user.park.id }],
    };
  }
  return { senderId: user.id };
}

/**
 * Sends a 6-digit sign-in code (AUTH-1) through @/server/notify. Takes the
 * phone as typed ("0803 555 4471" is fine). Real since Scope 02 sl3: codes
 * are stored hashed in otp_codes; see ./otp.ts for the rules. With
 * NOTIFY_MODE=console (and never in production) the code is also printed to
 * the server log so sign-in works before WhatsApp/SMS are connected.
 *
 * Throws AuthError: invalid_phone, otp_resend_too_soon.
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

async function deliverCode(
  phone: string,
  code: string,
  channel: OtpChannel,
): Promise<void> {
  const env = serverEnv();
  if (env.NOTIFY_MODE === "console" && env.NODE_ENV !== "production") {
    console.info(
      `[otp] sign-in code for ${phone}: ${code} (${channel}, valid 5 min)`,
    );
  }
  await sendCode(phone, code, channel);
}

/** Checks the code, creates the user if new, sets the network-wide session cookie. */
export async function verifyOtp(
  phone: string,
  code: string,
  signupParkId?: string,
): Promise<{ user: SessionUser; isNew: boolean }> {
  void phone;
  void code;
  void signupParkId;
  return stub({ user: toluSession, isNew: false });
}

export async function signOut(): Promise<void> {}

/** Signed recipient tracking link token (AUTH-5). */
export async function signRecipientLink(
  parcelId: string,
  ttlSeconds = 60 * 60 * 24 * 14,
): Promise<string> {
  void parcelId;
  void ttlSeconds;
  return TRACKING_LINK;
}

export async function verifyRecipientLink(
  token: string,
): Promise<{ parcelId: string } | null> {
  return token === TRACKING_LINK ? { parcelId: parcelAwaiting.id } : null;
}
