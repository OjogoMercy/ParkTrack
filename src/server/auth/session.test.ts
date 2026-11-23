import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signToken } from "@/lib/sign";
import {
  createSessionToken,
  needsRefresh,
  readSessionToken,
  SESSION_COOKIE,
  sessionCookieDomain,
  sessionCookieOptions,
} from "./session";

const SECRET = "s".repeat(32);
const DAY = 24 * 60 * 60 * 1000;
const T0 = new Date("2026-11-20T09:00:00Z");

describe("session token", () => {
  afterEach(() => vi.useRealTimers());

  it("round-trips the user id", async () => {
    const token = await createSessionToken("user_1", SECRET);
    expect(await readSessionToken(token, SECRET)).toMatchObject({
      userId: "user_1",
    });
  });

  it("rejects missing, tampered and wrongly signed tokens", async () => {
    const token = await createSessionToken("user_1", SECRET);
    expect(await readSessionToken(undefined, SECRET)).toBeNull();
    expect(
      await readSessionToken(token.slice(0, -2) + "xx", SECRET),
    ).toBeNull();
    expect(await readSessionToken(token, "t".repeat(32))).toBeNull();
  });

  it("rejects a recipient-link token used as a session", async () => {
    const link = await signToken(
      { sub: "user_1" },
      { secret: SECRET, purpose: "recipient_link", expiresIn: "1h" },
    );
    expect(await readSessionToken(link, SECRET)).toBeNull();
  });

  it("expires after 30 days", async () => {
    vi.useFakeTimers({ now: T0 });
    const token = await createSessionToken("user_1", SECRET);
    vi.setSystemTime(T0.getTime() + 29 * DAY);
    expect(await readSessionToken(token, SECRET)).not.toBeNull();
    vi.setSystemTime(T0.getTime() + 31 * DAY);
    expect(await readSessionToken(token, SECRET)).toBeNull();
  });

  it("needs a refresh once it is a day old", () => {
    const claims = { userId: "u", issuedAt: T0.getTime() / 1000 };
    expect(needsRefresh(claims, new Date(T0.getTime() + DAY / 2))).toBe(false);
    expect(needsRefresh(claims, new Date(T0.getTime() + DAY + 1000))).toBe(
      true,
    );
  });
});

describe("session cookie", () => {
  it("is set on the root domain so every subdomain gets it", () => {
    expect(sessionCookieDomain("parktrack.ng")).toBe("parktrack.ng");
    expect(sessionCookieDomain("parktrack.localhost:3000")).toBe(
      "parktrack.localhost",
    );
    // Browsers drop Domain=localhost cookies: fall back to host-only.
    expect(sessionCookieDomain("localhost:3000")).toBeUndefined();
    expect(sessionCookieDomain("127.0.0.1:3000")).toBeUndefined();
  });

  it("is HTTP-only, lax, 30 days, and secure in production", () => {
    expect(sessionCookieOptions("parktrack.ng", "production")).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
      domain: "parktrack.ng",
    });
    expect(sessionCookieOptions("localhost:3000", "development").secure).toBe(
      false,
    );
  });
});

describe("proxy rolling refresh", () => {
  beforeEach(() => {
    vi.stubEnv("AUTH_JWT_SECRET", SECRET);
    vi.stubEnv("ROOT_DOMAIN", "parktrack.localhost:3000");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  async function visit(token: string) {
    const { proxy } = await import("@/proxy");
    const request = new NextRequest(
      "http://ogbomoso.parktrack.localhost:3000/",
      {
        headers: {
          host: "ogbomoso.parktrack.localhost:3000",
          cookie: `${SESSION_COOKIE}=${token}`,
        },
      },
    );
    return proxy(request);
  }

  it("re-issues a day-old cookie on the root domain", async () => {
    vi.useFakeTimers({ now: T0 });
    const token = await createSessionToken("user_1", SECRET);
    vi.setSystemTime(T0.getTime() + 2 * DAY);
    const res = await visit(token);
    const cookie = res.cookies.get(SESSION_COOKIE);
    expect(cookie?.value).toBeTruthy();
    expect(cookie?.value).not.toBe(token);
    expect(cookie).toMatchObject({
      domain: "parktrack.localhost",
      httpOnly: true,
    });
    expect(await readSessionToken(cookie!.value, SECRET)).toMatchObject({
      userId: "user_1",
    });
  });

  it("leaves a fresh or invalid cookie alone", async () => {
    const fresh = await createSessionToken("user_1", SECRET);
    expect((await visit(fresh)).cookies.get(SESSION_COOKIE)).toBeUndefined();
    expect((await visit("junk")).cookies.get(SESSION_COOKIE)).toBeUndefined();
  });
});
