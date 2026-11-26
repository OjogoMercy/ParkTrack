import { describe, expect, it } from "vitest";
import type { SessionUser } from "@/contracts/dto";
import type { Prisma } from "@/generated/prisma/client";
import { AuthError } from "./errors";
import {
  assertParkStaff,
  canSeeParcel,
  parkScope,
  type ParcelTenancy,
} from "./tenancy";

const OGB = {
  id: "park_ogb",
  slug: "ogbomoso",
  name: "Ogbomoso",
  city: "Ogbomoso",
};
const IBD = {
  id: "park_ibd",
  slug: "ibadan",
  name: "Iwo Road",
  city: "Ibadan",
};
const ILR = "park_ilorin"; // a third park

function user(
  id: string,
  role: SessionUser["role"],
  park: SessionUser["park"] = null,
): SessionUser {
  return {
    id,
    phone: "+2340000000000",
    name: id,
    role,
    park,
    signupPark: null,
    isVendor: false,
  };
}

const users = {
  ogbomosoAgent: user("u_ogb_agent", "AGENT", OGB),
  ibadanAgent: user("u_ibd_agent", "AGENT", IBD),
  ogbomosoAdmin: user("u_ogb_admin", "PARK_ADMIN", OGB),
  ibadanAdmin: user("u_ibd_admin", "PARK_ADMIN", IBD),
  musaDriver: user("u_musa", "DRIVER", OGB),
  otherDriver: user("u_other_driver", "DRIVER", OGB),
  tolu: user("u_tolu", "USER"),
  ada: user("u_ada", "USER"),
  platform: user("u_platform", "PLATFORM_ADMIN"),
  agentWithoutPark: user("u_broken", "AGENT", null),
};

const parcels: Record<string, ParcelTenancy> = {
  // Ogbomoso → Ibadan, sent by Tolu, on Musa's bus.
  crossPark: {
    originParkId: OGB.id,
    destinationParkId: IBD.id,
    senderId: "u_tolu",
    driverIds: ["u_musa"],
  },
  // Ogbomoso → Ilorin: doesn't touch Ibadan at all.
  ogbomosoOnly: {
    originParkId: OGB.id,
    destinationParkId: ILR,
    senderId: "u_ada",
    driverIds: [],
  },
  // Ilorin → Ibadan walk-in (no sender account).
  ibadanInbound: {
    originParkId: ILR,
    destinationParkId: IBD.id,
    senderId: null,
    driverIds: ["u_other_driver"],
  },
};

const expected: Record<keyof typeof users, (keyof typeof parcels)[]> = {
  ogbomosoAgent: ["crossPark", "ogbomosoOnly"],
  ibadanAgent: ["crossPark", "ibadanInbound"],
  ogbomosoAdmin: ["crossPark", "ogbomosoOnly"],
  ibadanAdmin: ["crossPark", "ibadanInbound"],
  musaDriver: ["crossPark"],
  otherDriver: ["ibadanInbound"],
  tolu: ["crossPark"],
  ada: ["ogbomosoOnly"],
  platform: ["crossPark", "ogbomosoOnly", "ibadanInbound"],
  agentWithoutPark: [],
};

/**
 * Applies the subset of Prisma's ParcelWhereInput that parkScope produces to
 * an in-memory parcel, so the tests prove the query and canSeeParcel agree.
 * Fails loudly on anything it doesn't understand.
 */
function matches(where: Prisma.ParcelWhereInput, p: ParcelTenancy): boolean {
  return Object.entries(where).every(([key, value]) => {
    switch (key) {
      case "OR":
        return (value as Prisma.ParcelWhereInput[]).some((w) => matches(w, p));
      case "originParkId":
        return p.originParkId === value;
      case "destinationParkId":
        return p.destinationParkId === value;
      case "senderId":
        return p.senderId === value;
      case "id":
        return (value as { in: string[] }).in.length > 0; // only NOTHING uses id
      case "tripParcels": {
        const driverId = (value as { some: { trip: { driverId: string } } })
          .some.trip.driverId;
        return p.driverIds.includes(driverId);
      }
      default:
        throw new Error(`test evaluator doesn't know "${key}"`);
    }
  });
}

describe("tenancy", () => {
  for (const [who, u] of Object.entries(users)) {
    it(`${who} sees exactly ${expected[who as keyof typeof users].join(", ") || "nothing"}`, () => {
      const viaCheck = Object.keys(parcels).filter((k) =>
        canSeeParcel(u, parcels[k]),
      );
      const viaQuery = Object.keys(parcels).filter((k) =>
        matches(parkScope(u), parcels[k]),
      );
      expect(viaCheck).toEqual(expected[who as keyof typeof users]);
      expect(viaQuery).toEqual(viaCheck);
    });
  }

  it("an Ibadan agent can't read an Ogbomoso-only parcel", () => {
    expect(canSeeParcel(users.ibadanAgent, parcels.ogbomosoOnly)).toBe(false);
    expect(matches(parkScope(users.ibadanAgent), parcels.ogbomosoOnly)).toBe(
      false,
    );
  });

  it("a cross-park parcel is visible to both parks", () => {
    expect(canSeeParcel(users.ogbomosoAgent, parcels.crossPark)).toBe(true);
    expect(canSeeParcel(users.ibadanAgent, parcels.crossPark)).toBe(true);
  });

  it("a walk-in parcel with no sender isn't visible to every sender", () => {
    expect(canSeeParcel(users.tolu, parcels.ibadanInbound)).toBe(false);
  });
});

describe("assertParkStaff", () => {
  const codeOf = (fn: () => void) => {
    try {
      fn();
      return "ok";
    } catch (e) {
      return e instanceof AuthError ? e.code : String(e);
    }
  };

  it("lets an agent or park admin act for their own park only", () => {
    expect(codeOf(() => assertParkStaff(users.ogbomosoAgent, OGB.id))).toBe(
      "ok",
    );
    expect(codeOf(() => assertParkStaff(users.ogbomosoAdmin, OGB.id))).toBe(
      "ok",
    );
    expect(codeOf(() => assertParkStaff(users.ibadanAgent, OGB.id))).toBe(
      "wrong_park",
    );
    expect(codeOf(() => assertParkStaff(users.agentWithoutPark, OGB.id))).toBe(
      "wrong_park",
    );
  });

  it("refuses drivers, senders and platform admins", () => {
    for (const u of [users.musaDriver, users.tolu, users.platform]) {
      expect(codeOf(() => assertParkStaff(u, OGB.id))).toBe("wrong_role");
    }
  });
});
