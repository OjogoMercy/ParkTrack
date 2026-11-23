import "server-only";
import type { SessionUser } from "@/contracts/dto";
import { db } from "@/lib/db";
import { AuthError } from "./errors";

const parkRef = { select: { id: true, slug: true, name: true, city: true } };
const sessionUserInclude = {
  park: parkRef,
  signupPark: parkRef,
  vendorProfile: { select: { userId: true } },
} as const;

type UserWithRefs = NonNullable<
  Awaited<
    ReturnType<
      typeof db.user.findUnique<{
        where: { id: string };
        include: typeof sessionUserInclude;
      }>
    >
  >
>;

function toSessionUser(u: UserWithRefs): SessionUser {
  return {
    id: u.id,
    phone: u.phone,
    name: u.name,
    role: u.role,
    park: u.park,
    signupPark: u.signupPark,
    isVendor: u.vendorProfile !== null,
  };
}

/** The session user for an id from a valid cookie; null if gone or not active. */
export async function loadSessionUser(
  userId: string,
): Promise<SessionUser | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: sessionUserInclude,
  });
  return user && user.status === "ACTIVE" ? toSessionUser(user) : null;
}

/** An agent, driver or admin account that isn't deactivated. */
export async function isStaffPhone(phone: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { phone },
    select: { role: true, status: true },
  });
  return !!user && user.role !== "SENDER" && user.status !== "DEACTIVATED";
}

/**
 * The account for a phone that just proved it owns the number: creates a
 * sender if new, with the park they signed up through (AUTH-3). An existing
 * sender without a signup park gets this one; it never changes after that.
 * Staff invited ahead of time (INVITED) become ACTIVE on first sign-in.
 */
export async function signInUser(
  phone: string,
  signupParkId: string | undefined,
): Promise<{ user: SessionUser; isNew: boolean }> {
  const existing = await db.user.findUnique({
    where: { phone },
    include: sessionUserInclude,
  });

  if (!existing) {
    const created = await db.user.create({
      data: { phone, role: "SENDER", signupParkId: signupParkId ?? null },
      include: sessionUserInclude,
    });
    return { user: toSessionUser(created), isNew: true };
  }

  if (existing.status === "DEACTIVATED") {
    throw new AuthError(
      "account_deactivated",
      "This account has been turned off. Ask your park admin for help.",
      403,
    );
  }

  const setSignupPark =
    existing.role === "SENDER" && !existing.signupParkId && signupParkId;
  if (existing.status === "INVITED" || setSignupPark) {
    const updated = await db.user.update({
      where: { id: existing.id },
      data: {
        status: "ACTIVE",
        ...(setSignupPark ? { signupParkId } : {}),
      },
      include: sessionUserInclude,
    });
    return { user: toSessionUser(updated), isNew: false };
  }
  return { user: toSessionUser(existing), isNew: false };
}
