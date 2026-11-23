import { describe, expect, it } from "vitest";
import { publicToken } from "@/lib/ids";
import { createLinkToken, readLinkToken } from "./recipient-link";

const SECRET = "l".repeat(32);
const T0 = new Date("2026-11-20T09:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const in14Days = new Date(T0.getTime() + 14 * DAY);

describe("recipient link token", () => {
  const linkId = publicToken();
  const token = createLinkToken(linkId, in14Days, SECRET);

  it("is short enough for an SMS and holds only the random link id", () => {
    expect(token.length).toBeLessThan(60);
    expect(token.startsWith(`${linkId}.`)).toBe(true);
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[0-9a-z]+\.[A-Za-z0-9_-]+$/);
  });

  it("reads back the link id until it expires", () => {
    expect(readLinkToken(token, SECRET, T0)).toBe(linkId);
    expect(
      readLinkToken(token, SECRET, new Date(in14Days.getTime() - 1000)),
    ).toBe(linkId);
    expect(readLinkToken(token, SECRET, in14Days)).toBeNull();
  });

  it("rejects any changed character", () => {
    for (let i = 0; i < token.length; i++) {
      if (token[i] === ".") continue;
      const c = token[i] === "A" ? "B" : "A";
      const tampered = token.slice(0, i) + c + token.slice(i + 1);
      expect(readLinkToken(tampered, SECRET, T0), `position ${i}`).toBeNull();
    }
  });

  it("rejects a later expiry pasted onto an old signature", () => {
    const [id, , sig] = token.split(".");
    const longer = Math.floor((T0.getTime() + 365 * DAY) / 1000).toString(36);
    expect(readLinkToken(`${id}.${longer}.${sig}`, SECRET, T0)).toBeNull();
  });

  it("rejects another parcel's id with this signature", () => {
    const [, exp, sig] = token.split(".");
    expect(
      readLinkToken(`${publicToken()}.${exp}.${sig}`, SECRET, T0),
    ).toBeNull();
  });

  it("rejects tokens signed with another secret, and junk", () => {
    const other = createLinkToken(linkId, in14Days, "m".repeat(32));
    expect(readLinkToken(other, SECRET, T0)).toBeNull();
    for (const junk of [
      "",
      "abc",
      "a.b",
      "a.b.c.d",
      "../../etc",
      `${linkId}..`,
    ]) {
      expect(readLinkToken(junk, SECRET, T0), junk).toBeNull();
    }
  });
});
