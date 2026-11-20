import { describe, expect, it } from "vitest";
import {
  PARCEL_STATUSES,
  TRANSITIONS,
  canTransition,
  isFinal,
  nextStates,
  type ParcelStatus,
} from "@/contracts";

// PRD §8 "Can move to", written out independently of the contract table.
const PRD: Record<ParcelStatus, ParcelStatus[]> = {
  DRAFT: ["AWAITING_DROPOFF", "CANCELLED"],
  AWAITING_DROPOFF: ["RECEIVED_AT_ORIGIN", "CANCELLED"],
  RECEIVED_AT_ORIGIN: ["ASSIGNED", "CANCELLED"],
  ASSIGNED: ["IN_TRANSIT", "RECEIVED_AT_ORIGIN"],
  IN_TRANSIT: ["DELIVERED_ROADSIDE", "ARRIVED", "DISPUTED"],
  DELIVERED_ROADSIDE: ["SETTLED", "DISPUTED"],
  ARRIVED: ["COLLECTED", "UNCLAIMED", "DISPUTED"],
  COLLECTED: ["SETTLED", "DISPUTED"],
  SETTLED: [],
  UNCLAIMED: ["COLLECTED", "RETURNED"],
  RETURNED: [],
  // "Previous state, or RESOLVED"
  DISPUTED: [
    "IN_TRANSIT",
    "DELIVERED_ROADSIDE",
    "ARRIVED",
    "COLLECTED",
    "RESOLVED",
  ],
  RESOLVED: [],
  CANCELLED: [],
};

describe("parcel state machine (PRD §8)", () => {
  it("allows exactly the PRD transitions from every state", () => {
    for (const s of PARCEL_STATUSES) {
      expect(nextStates(s).sort(), s).toEqual([...PRD[s]].sort());
    }
  });

  it("forbids everything else", () => {
    for (const from of PARCEL_STATUSES)
      for (const to of PARCEL_STATUSES)
        expect(canTransition(from, to), `${from}→${to}`).toBe(
          PRD[from].includes(to),
        );
  });

  it("final states have no way out", () => {
    for (const s of ["SETTLED", "RETURNED", "RESOLVED", "CANCELLED"] as const) {
      expect(isFinal(s)).toBe(true);
      expect(nextStates(s)).toEqual([]);
    }
    expect(isFinal("IN_TRANSIT")).toBe(false);
  });

  it("checks who may act", () => {
    expect(canTransition("ASSIGNED", "IN_TRANSIT", "DRIVER")).toBe(true);
    expect(canTransition("ASSIGNED", "IN_TRANSIT", "AGENT")).toBe(false);
    expect(canTransition("DRAFT", "AWAITING_DROPOFF", "SYSTEM")).toBe(true);
    expect(canTransition("DRAFT", "AWAITING_DROPOFF", "SENDER")).toBe(false);
    expect(canTransition("IN_TRANSIT", "ARRIVED", "AGENT")).toBe(true);
    expect(canTransition("DISPUTED", "RESOLVED", "PLATFORM_ADMIN")).toBe(true);
    expect(canTransition("DISPUTED", "RESOLVED", "PARK_ADMIN")).toBe(false);
  });

  it("every transition names at least one actor and a reason", () => {
    for (const t of TRANSITIONS) {
      expect(t.by.length, `${t.from}→${t.to}`).toBeGreaterThan(0);
      expect(t.when.length).toBeGreaterThan(5);
    }
  });
});
