/**
 * STUB (Scope 01) — owned by Scope 02 (docs/scopes/02-parks-identity.md).
 * Exported names and types are FINAL. Scope 02 replaces the bodies;
 * callers never change. Until then everything returns fixture data.
 */
import type { Role } from "@/contracts/enums";
import type { SessionUser } from "@/contracts/dto";
import type { Prisma } from "@/generated/prisma/client";
import {
  bayoSession,
  parcelAwaiting,
  toluSession,
  TRACKING_LINK,
} from "@/mocks/fixtures";
import { stub } from "@/mocks/stub";

export const STUB = true;

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

/** Sends a 6-digit sign-in code (AUTH-1) through @/server/notify. */
export async function sendOtp(
  phone: string,
  channel: "WHATSAPP" | "SMS" = "WHATSAPP",
): Promise<{
  sent: true;
  channel: "WHATSAPP" | "SMS";
  sentTo: string;
  resendInSeconds: number;
}> {
  return stub({ sent: true, channel, sentTo: phone, resendInSeconds: 30 });
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
