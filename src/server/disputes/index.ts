/**
 * STUB (Scope 01) — owned by Scope 09 (docs/scopes/09-admin-jobs-launch.md).
 * Exported names and types are FINAL. Scope 09 replaces the bodies;
 * callers never change. Until then everything returns fixture data.
 */
import type { DisputeDto } from "@/contracts/dto";
import type { DisputeType } from "@/contracts/enums";
import type { ActorRef } from "@/server/parcels";
import { disputeMissing } from "@/mocks/fixtures";
import { stub } from "@/mocks/stub";

export const STUB = true;

/** Opens a dispute; the parcel moves to DISPUTED and remembers its previous state (DIS-1). */
export async function openDispute(
  input: { parcelId: string; type: DisputeType; note: string },
  by: ActorRef,
): Promise<DisputeDto> {
  void by;
  return stub({ ...disputeMissing, type: input.type });
}

/** DIS-2 dispute list for admins. */
export async function listDisputes(filter: {
  parkId?: string;
  status?: DisputeDto["status"];
}): Promise<DisputeDto[]> {
  void filter;
  return stub([disputeMissing]);
}
