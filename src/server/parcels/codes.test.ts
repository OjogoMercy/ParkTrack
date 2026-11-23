import { describe, expect, it } from "vitest";
import {
  afterWrongCode,
  codeContext,
  codeExpiredReason,
  codeExpiry,
  issueProblem,
} from "./codes";

const T0 = new Date("2026-11-22T09:42:00Z");
const atCounter = {
  status: "ARRIVED" as const,
  deliveryMode: "PARK" as const,
  locked: false,
};
const onRoad = {
  status: "IN_TRANSIT" as const,
  deliveryMode: "ROADSIDE" as const,
  locked: false,
};

describe("issuing a code", () => {
  it("counter codes only once the parcel is at the arrival park", () => {
    expect(issueProblem(atCounter, "COUNTER")).toBeNull();
    expect(
      issueProblem({ ...atCounter, status: "UNCLAIMED" }, "COUNTER"),
    ).toBeNull();
    expect(
      issueProblem({ ...atCounter, status: "IN_TRANSIT" }, "COUNTER"),
    ).toMatch(/arrival park/);
    expect(
      issueProblem({ ...atCounter, status: "COLLECTED" }, "COUNTER"),
    ).not.toBeNull();
  });

  it("roadside codes only for a roadside parcel on its way (Q5: from load accepted)", () => {
    expect(issueProblem(onRoad, "ROADSIDE")).toBeNull();
    expect(
      issueProblem({ ...onRoad, status: "ASSIGNED" }, "ROADSIDE"),
    ).toBeNull();
    expect(
      issueProblem({ ...onRoad, deliveryMode: "PARK" }, "ROADSIDE"),
    ).toMatch(/roadside/);
    expect(
      issueProblem({ ...onRoad, status: "DELIVERED_ROADSIDE" }, "ROADSIDE"),
    ).not.toBeNull();
  });

  it("a locked parcel gets no new code", () => {
    expect(issueProblem({ ...atCounter, locked: true }, "COUNTER")).toMatch(
      /locked/,
    );
  });

  it("counter codes last 10 minutes; roadside codes have no clock", () => {
    expect(codeExpiry("COUNTER", T0)).toEqual(new Date("2026-11-22T09:52:00Z"));
    expect(codeExpiry("ROADSIDE", T0)).toBeNull();
  });
});

describe("checking a code", () => {
  const counterCode = { expiresAt: codeExpiry("COUNTER", T0) };

  it("rejects an expired counter code", () => {
    expect(
      codeExpiredReason(
        counterCode,
        atCounter,
        "COUNTER",
        new Date("2026-11-22T09:51:59Z"),
      ),
    ).toBeNull();
    expect(
      codeExpiredReason(
        counterCode,
        atCounter,
        "COUNTER",
        new Date("2026-11-22T09:52:00Z"),
      ),
    ).toMatch(/expired/);
  });

  it("a roadside code ends with the trip or when marked Missed", () => {
    const code = { expiresAt: null };
    expect(codeExpiredReason(code, onRoad, "ROADSIDE", T0)).toBeNull();
    expect(
      codeExpiredReason(
        code,
        { ...onRoad, deliveryMode: "PARK" },
        "ROADSIDE",
        T0,
      ),
    ).toMatch(/ended/);
    expect(
      codeExpiredReason(code, { ...onRoad, status: "ARRIVED" }, "ROADSIDE", T0),
    ).toMatch(/ended/);
  });

  it("locks on the 5th wrong code in total", () => {
    expect(afterWrongCode(0)).toEqual({ attemptsLeft: 4, locked: false });
    expect(afterWrongCode(3)).toEqual({ attemptsLeft: 1, locked: false });
    expect(afterWrongCode(4)).toEqual({ attemptsLeft: 0, locked: true });
  });

  it("binds a code to its parcel and purpose", () => {
    expect(codeContext("p1", "COUNTER")).not.toBe(codeContext("p2", "COUNTER"));
    expect(codeContext("p1", "COUNTER")).not.toBe(
      codeContext("p1", "ROADSIDE"),
    );
  });
});
