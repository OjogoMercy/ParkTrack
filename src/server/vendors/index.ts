/**
 * Owned by Scope 05 (docs/scopes/05-sender-app.md). Exported names and
 * types are FINAL; callers never change. Real since sl2.
 *
 * The signed-in person's profile (S12): who they are, how we message them
 * and, for vendors (senders with a business), the business and payout
 * details. Only the last 4 digits of a payout account are kept until real
 * payouts exist (PAY-7).
 */
import "server-only";
import type { Profile, VendorProfileDto } from "@/contracts/dto";
import type { Language } from "@/contracts/enums";
import { db } from "@/lib/db";
import { loadSessionUser } from "@/server/auth/users";

export const STUB = false;

/** S12 account screen. Throws when the account is gone or deactivated. */
export async function getProfile(userId: string): Promise<Profile> {
  const [session, user] = await Promise.all([
    loadSessionUser(userId),
    db.user.findUnique({
      where: { id: userId },
      select: { language: true, notifyChannel: true, vendorProfile: true },
    }),
  ]);
  if (!session || !user) throw new Error("This account isn't active.");
  const v = user.vendorProfile;
  return {
    ...session,
    language: user.language,
    notifyChannel: user.notifyChannel,
    vendor: v
      ? {
          businessName: v.businessName,
          payoutBank: v.payoutBank,
          payoutAccountName: v.payoutAccountName,
          payoutAccountLast4: v.payoutAccountLast4,
        }
      : null,
  };
}

export async function updateProfile(
  userId: string,
  patch: {
    name?: string;
    language?: Language;
    notifyChannel?: "WHATSAPP" | "SMS";
  },
): Promise<Profile> {
  await db.user.update({
    where: { id: userId },
    data: {
      ...(patch.name !== undefined
        ? { name: patch.name.trim().replace(/\s+/g, " ") }
        : {}),
      ...(patch.language ? { language: patch.language } : {}),
      ...(patch.notifyChannel ? { notifyChannel: patch.notifyChannel } : {}),
    },
  });
  return getProfile(userId);
}

/** Business details (the S12 Business screen arrives in sl7). */
export async function upsertVendorProfile(
  userId: string,
  input: VendorProfileDto,
): Promise<Profile> {
  const data = {
    businessName: input.businessName.trim(),
    payoutBank: input.payoutBank?.trim() || null,
    payoutAccountName: input.payoutAccountName?.trim() || null,
    payoutAccountLast4: input.payoutAccountLast4 || null,
  };
  await db.vendorProfile.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
  return getProfile(userId);
}
