/**
 * STUB (Scope 01) — owned by Scope 05 (docs/scopes/05-sender-app.md).
 * Exported names and types are FINAL. Scope 05 replaces the bodies;
 * callers never change. Until then everything returns fixture data.
 */
import type { Profile, VendorProfileDto } from "@/contracts/dto";
import type { Language } from "@/contracts/enums";
import { toluProfile } from "@/mocks/fixtures";
import { stub } from "@/mocks/stub";

export const STUB = true;

/** S12 account screen. */
export async function getProfile(userId: string): Promise<Profile> {
  void userId;
  return stub(toluProfile);
}

export async function updateProfile(
  userId: string,
  patch: {
    name?: string;
    language?: Language;
    notifyChannel?: "WHATSAPP" | "SMS";
  },
): Promise<Profile> {
  void userId;
  return stub({ ...toluProfile, ...patch });
}

export async function upsertVendorProfile(
  userId: string,
  input: VendorProfileDto,
): Promise<Profile> {
  void userId;
  return stub({ ...toluProfile, isVendor: true, vendor: input });
}
