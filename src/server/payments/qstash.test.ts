import { createHash } from "node:crypto";
import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { verifyQStash } from "./qstash";

const keys = { current: "sig_current_test", next: "sig_next_test" };
const body = "";
const path = "/api/jobs/requery";
const now = new Date("2026-11-25T10:00:00Z");
const t = Math.floor(now.getTime() / 1000);

async function jwt(
  over: Record<string, unknown> = {},
  key = keys.current,
  raw = body,
) {
  return new SignJWT({
    body: createHash("sha256").update(raw).digest("base64url"),
    ...over,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer((over.iss as string) ?? "Upstash")
    .setSubject((over.sub as string) ?? "https://parktrack.ng/api/jobs/requery")
    .setIssuedAt(t)
    .setNotBefore((over.nbf as number) ?? t)
    .setExpirationTime((over.exp as number) ?? t + 300)
    .sign(new TextEncoder().encode(key));
}
const check = (signature: string | null, raw = body, p = path) =>
  verifyQStash({ signature, body: raw, path: p }, keys, now);

describe("QStash signature", () => {
  it("accepts the current or the next key", async () => {
    expect(await check(await jwt())).toBe(true);
    expect(await check(await jwt({}, keys.next))).toBe(true);
    // Padded body hash (older SDKs) is fine too.
    const padded = createHash("sha256").update(body).digest("base64url") + "=";
    expect(await check(await jwt({ body: padded }))).toBe(true);
  });

  it("checks the body hash", async () => {
    const signed = await jwt({}, keys.current, '{"a":1}');
    expect(await check(signed, '{"a":1}')).toBe(true);
    expect(await check(signed, '{"a":2}')).toBe(false);
  });

  it("refuses missing, wrong-key, wrong-issuer, expired, early or other-URL tokens", async () => {
    expect(await check(null)).toBe(false);
    expect(await check("not.a.jwt")).toBe(false);
    expect(await check(await jwt({}, "someone-else"))).toBe(false);
    expect(await check(await jwt({ iss: "Mallory" }))).toBe(false);
    expect(await check(await jwt({ exp: t - 60 }))).toBe(false);
    expect(await check(await jwt({ nbf: t + 60 }))).toBe(false);
    expect(
      await check(await jwt({ sub: "https://parktrack.ng/api/jobs/other" })),
    ).toBe(false);
    expect(
      await verifyQStash({ signature: await jwt(), body, path }, {}, now),
    ).toBe(false);
  });
});
