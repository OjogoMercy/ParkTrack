import { describe, expect, it } from "vitest";
import { PARCEL_STATUSES } from "@/contracts/enums";
import type { ParcelStatus } from "@/contracts/enums";
import { findTransition, TRANSITIONS, type Actor } from "@/contracts/states";
import {
  actorProblem,
  eventTypeFor,
  notificationFor,
  parkSideOf,
  type ActorCheckInput,
} from "./lifecycle";

const ALL_ACTORS: Actor[] = [
  "SENDER",
  "AGENT",
  "DRIVER",
  "PARK_ADMIN",
  "PLATFORM_ADMIN",
  "SYSTEM",
  "RECIPIENT",
];

const ORIGIN = "park_ogb";
const DEST = "park_ibd";
const parcel: ActorCheckInput["parcel"] = {
  originParkId: ORIGIN,
  destinationParkId: DEST,
  senderId: "u_sender",
  driverIds: ["u_driver"],
};

/** The right person for each actor, at the park the move belongs to. */
function rightUser(actor: Actor, from: ParcelStatus, to: ParcelStatus) {
  if (actor === "SYSTEM" || actor === "RECIPIENT") return null;
  const side = parkSideOf({ from, to });
  const parkId = side === "destination" ? DEST : ORIGIN;
  const id =
    actor === "SENDER"
      ? "u_sender"
      : actor === "DRIVER"
        ? "u_driver"
        : `u_${actor}`;
  return { id, role: actor, status: "ACTIVE", parkId };
}

describe("state table: every pair of statuses", () => {
  const pairs = PARCEL_STATUSES.flatMap((from) =>
    PARCEL_STATUSES.map((to) => [from, to] as const),
  );

  it(`covers all ${PARCEL_STATUSES.length}×${PARCEL_STATUSES.length} pairs: only listed moves exist`, () => {
    let allowed = 0;
    for (const [from, to] of pairs) {
      const t = findTransition(from, to);
      const listed = TRANSITIONS.some((x) => x.from === from && x.to === to);
      expect(!!t, `${from} → ${to}`).toBe(listed);
      if (t) allowed++;
    }
    expect(allowed).toBe(TRANSITIONS.length);
  });

  it("each allowed move is accepted for exactly its listed actors", () => {
    for (const t of TRANSITIONS) {
      for (const actor of ALL_ACTORS) {
        const problem = actorProblem({
          transition: t,
          actor,
          user: rightUser(actor, t.from, t.to),
          parcel,
        });
        expect(problem === null, `${t.from} → ${t.to} by ${actor}`).toBe(
          t.by.includes(actor),
        );
      }
    }
  });

  it("final states have no way out", () => {
    for (const s of ["SETTLED", "RETURNED", "RESOLVED", "CANCELLED"] as const) {
      expect(TRANSITIONS.filter((t) => t.from === s)).toEqual([]);
    }
  });
});

describe("who may act", () => {
  const dropoff = findTransition("AWAITING_DROPOFF", "RECEIVED_AT_ORIGIN")!;
  const tickOff = findTransition("IN_TRANSIT", "ARRIVED")!;
  const accept = findTransition("ASSIGNED", "IN_TRANSIT")!;
  const cancel = findTransition("AWAITING_DROPOFF", "CANCELLED")!;
  const reopen = findTransition("DISPUTED", "ARRIVED")!;
  const agent = (parkId: string) => ({
    id: "u_agent",
    role: "AGENT",
    status: "ACTIVE",
    parkId,
  });

  it("origin agents take drop-offs; arrival agents tick off", () => {
    expect(
      actorProblem({
        transition: dropoff,
        actor: "AGENT",
        user: agent(ORIGIN),
        parcel,
      }),
    ).toBeNull();
    expect(
      actorProblem({
        transition: dropoff,
        actor: "AGENT",
        user: agent(DEST),
        parcel,
      }),
    ).toMatch(/another park/);
    expect(
      actorProblem({
        transition: tickOff,
        actor: "AGENT",
        user: agent(DEST),
        parcel,
      }),
    ).toBeNull();
    expect(
      actorProblem({
        transition: tickOff,
        actor: "AGENT",
        user: agent(ORIGIN),
        parcel,
      }),
    ).toMatch(/another park/);
    expect(
      actorProblem({
        transition: tickOff,
        actor: "AGENT",
        user: agent("park_other"),
        parcel,
      }),
    ).toMatch(/another park/);
  });

  it("a park admin of either park can close a dispute", () => {
    for (const parkId of [ORIGIN, DEST]) {
      const admin = {
        id: "u_admin",
        role: "PARK_ADMIN",
        status: "ACTIVE",
        parkId,
      };
      expect(
        actorProblem({
          transition: reopen,
          actor: "PARK_ADMIN",
          user: admin,
          parcel,
        }),
      ).toBeNull();
    }
  });

  it("only the driver carrying it accepts the load", () => {
    const other = {
      id: "u_other_driver",
      role: "DRIVER",
      status: "ACTIVE",
      parkId: ORIGIN,
    };
    expect(
      actorProblem({
        transition: accept,
        actor: "DRIVER",
        user: other,
        parcel,
      }),
    ).toMatch(/isn't on your load/);
  });

  it("only the parcel's own sender can cancel it", () => {
    const stranger = {
      id: "u_stranger",
      role: "SENDER",
      status: "ACTIVE",
      parkId: null,
    };
    expect(
      actorProblem({
        transition: cancel,
        actor: "SENDER",
        user: stranger,
        parcel,
      }),
    ).toMatch(/Only the sender/);
  });

  it("people must act as their own active role", () => {
    const sender = {
      id: "u_sender",
      role: "SENDER",
      status: "ACTIVE",
      parkId: null,
    };
    // A sender claiming to be an agent:
    expect(
      actorProblem({
        transition: dropoff,
        actor: "AGENT",
        user: sender,
        parcel,
      }),
    ).not.toBeNull();
    // A deactivated agent:
    expect(
      actorProblem({
        transition: dropoff,
        actor: "AGENT",
        user: { ...agent(ORIGIN), status: "DEACTIVATED" },
        parcel,
      }),
    ).not.toBeNull();
    // A role actor with no user at all:
    expect(
      actorProblem({ transition: dropoff, actor: "AGENT", user: null, parcel }),
    ).not.toBeNull();
  });
});

describe("events and messages", () => {
  it("every allowed move has a specific event type", () => {
    for (const t of TRANSITIONS) {
      expect(eventTypeFor(t.from, t.to), `${t.from} → ${t.to}`).not.toBe(
        "NOTE",
      );
    }
    expect(eventTypeFor("ASSIGNED", "RECEIVED_AT_ORIGIN")).toBe("UNASSIGN");
    expect(eventTypeFor("DISPUTED", "ARRIVED")).toBe("RESOLVED");
  });

  it("sends the PRD §11 message for each status change", () => {
    const n = (from: ParcelStatus, to: ParcelStatus) =>
      notificationFor(from, to, eventTypeFor(from, to));
    expect(n("DRAFT", "AWAITING_DROPOFF")).toBe("booking_paid");
    expect(n("AWAITING_DROPOFF", "RECEIVED_AT_ORIGIN")).toBe(
      "handshake_complete",
    );
    expect(n("RECEIVED_AT_ORIGIN", "ASSIGNED")).toBe("assigned");
    expect(n("ASSIGNED", "IN_TRANSIT")).toBe("load_accepted");
    expect(n("IN_TRANSIT", "DELIVERED_ROADSIDE")).toBe("delivered_roadside");
    expect(n("IN_TRANSIT", "ARRIVED")).toBe("arrived_at_park");
    expect(n("ARRIVED", "COLLECTED")).toBe("collected");
    expect(n("UNCLAIMED", "COLLECTED")).toBe("collected");
    expect(notificationFor("IN_TRANSIT", "DISPUTED", "MISSING")).toBe(
      "missing_at_tickoff",
    );
    expect(n("IN_TRANSIT", "DISPUTED")).toBeNull(); // an ordinary dispute
    expect(n("COLLECTED", "SETTLED")).toBeNull();
  });

  it("the recipient hears nothing before the drop-off handshake (HS-7)", () => {
    for (const t of TRANSITIONS.filter(
      (t) =>
        ["DRAFT", "AWAITING_DROPOFF"].includes(t.from) &&
        t.to !== "RECEIVED_AT_ORIGIN",
    )) {
      const m = notificationFor(t.from, t.to, eventTypeFor(t.from, t.to));
      expect(m === null || m === "booking_paid", `${t.from} → ${t.to}`).toBe(
        true,
      );
    }
  });
});
