import type { SessionUser } from "@/contracts/dto";
import type { Prisma } from "@/generated/prisma/client";
import { AuthError } from "./errors";

/**
 * Tenant separation (PRD NFR security): which parcels each person may see.
 *
 *   PLATFORM_ADMIN       every parcel
 *   AGENT, PARK_ADMIN    parcels leaving from or arriving at their park, so a
 *                        cross-park parcel is visible to both parks, and an
 *                        Ibadan agent never sees a parcel that doesn't touch
 *                        Ibadan
 *   DRIVER               only parcels loaded on their own trips
 *   USER                 only parcels they sent
 *
 * Staff without a park (a broken account) see nothing: the rules fail closed.
 *
 * parkScope() is the Prisma `where` for lists and lookups; canSeeParcel() is
 * the same rule for one parcel already loaded. Keep the two in step; the
 * tests check them against each other.
 */

/**
 * Throws AuthError unless the user is an agent or park admin of this park.
 * requireParkStaff() = requireRole("AGENT", "PARK_ADMIN") + this check.
 */
export function assertParkStaff(user: SessionUser, parkId: string): void {
  if (user.role !== "AGENT" && user.role !== "PARK_ADMIN") {
    throw new AuthError(
      "wrong_role",
      "Your account can't open this page.",
      403,
    );
  }
  if (!user.park || user.park.id !== parkId) {
    throw new AuthError(
      "wrong_park",
      "This belongs to another park. You can only see your own park's work.",
      403,
    );
  }
}

/** Matches no rows. */
const NOTHING: Prisma.ParcelWhereInput = { id: { in: [] } };

export function parkScope(user: SessionUser): Prisma.ParcelWhereInput {
  switch (user.role) {
    case "PLATFORM_ADMIN":
      return {};
    case "AGENT":
    case "PARK_ADMIN":
      if (!user.park) return NOTHING;
      return {
        OR: [
          { originParkId: user.park.id },
          { destinationParkId: user.park.id },
        ],
      };
    case "DRIVER":
      return { tripParcels: { some: { trip: { driverId: user.id } } } };
    case "USER":
      return { senderId: user.id };
    default:
      return NOTHING;
  }
}

export type ParcelTenancy = {
  originParkId: string;
  destinationParkId: string;
  senderId: string | null;
  /** Drivers of the trips this parcel is (or was) loaded on. */
  driverIds: string[];
};

export function canSeeParcel(
  user: SessionUser,
  parcel: ParcelTenancy,
): boolean {
  switch (user.role) {
    case "PLATFORM_ADMIN":
      return true;
    case "AGENT":
    case "PARK_ADMIN":
      return (
        !!user.park &&
        (parcel.originParkId === user.park.id ||
          parcel.destinationParkId === user.park.id)
      );
    case "DRIVER":
      return parcel.driverIds.includes(user.id);
    case "USER":
      return parcel.senderId !== null && parcel.senderId === user.id;
    default:
      return false;
  }
}
