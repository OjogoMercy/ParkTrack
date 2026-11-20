import { describe, expect, it } from "vitest";
import { checkPr } from "../.github/scripts/scope-gate.mjs";

const ok = (base: string, head: string, tags: string[] = []) =>
  checkPr({ base, head, tags }).ok;

describe("scope-gate: PRs into main", () => {
  it("allows scope 01 with no tags", () => {
    expect(ok("main", "scope/01-foundation")).toBe(true);
  });

  it("blocks scope 02 until scope-01-done exists", () => {
    expect(ok("main", "scope/02-identity")).toBe(false);
    expect(ok("main", "scope/02-identity", ["scope-01-done"])).toBe(true);
  });

  it("needs the immediately previous scope's tag, not an older one", () => {
    expect(
      ok("main", "scope/05-sender", ["scope-01-done", "scope-03-done"]),
    ).toBe(false);
    expect(ok("main", "scope/05-sender", ["scope-04-done"])).toBe(true);
    expect(ok("main", "scope/10-extra", ["scope-09-done"])).toBe(true);
  });

  it("always allows contract/* branches", () => {
    expect(ok("main", "contract/slice-branch-cleanup")).toBe(true);
  });

  it("blocks slice and random branches", () => {
    expect(ok("main", "s01/sl1-scaffold")).toBe(false);
    expect(ok("main", "feature/whatever")).toBe(false);
    expect(ok("main", "scope/2-identity")).toBe(false);
  });

  it("explains what tag is missing", () => {
    const r = checkPr({
      base: "main",
      head: "scope/03-parcel-engine",
      tags: [],
    });
    expect(r.message).toContain("scope-02-done");
  });
});

describe("scope-gate: PRs into a scope branch", () => {
  it("allows that scope's own slices", () => {
    expect(ok("scope/01-foundation", "s01/sl2-ci")).toBe(true);
    expect(ok("scope/02-identity", "s02/sl3-otp")).toBe(true);
  });

  it("blocks another scope's slices", () => {
    expect(ok("scope/01-foundation", "s02/sl3-otp")).toBe(false);
    expect(ok("scope/02-identity", "s01/sl2-ci")).toBe(false);
  });

  it("allows syncing main into the scope", () => {
    expect(ok("scope/04-payments", "main")).toBe(true);
  });

  it("blocks other branch names", () => {
    expect(ok("scope/01-foundation", "scope/01-foundation/sl1")).toBe(false);
    expect(ok("scope/01-foundation", "contract/x")).toBe(false);
    expect(ok("scope/01-foundation", "my-branch")).toBe(false);
  });
});

describe("scope-gate: other bases", () => {
  it("does not govern PRs into other branches", () => {
    expect(ok("s01/sl1-scaffold", "anything")).toBe(true);
  });
});
