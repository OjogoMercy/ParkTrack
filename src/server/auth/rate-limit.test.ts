import { describe, expect, it } from "vitest";
import { AuthError } from "./errors";
import {
  clientIp,
  enforceRateLimit,
  memoryRateLimitStore,
  RATE_LIMITS,
  waitText,
} from "./rate-limit";

const rule = { limit: 5, windowSeconds: 60 };

async function hit(
  store: ReturnType<typeof memoryRateLimitStore>,
  key: string,
  now: number,
) {
  try {
    await enforceRateLimit("scan", key, rule, { store, now });
    return "ok";
  } catch (e) {
    if (e instanceof AuthError) return e;
    throw e;
  }
}

describe("enforceRateLimit", () => {
  it("allows the limit, then the next request in the window gets 429", async () => {
    const store = memoryRateLimitStore();
    for (let i = 0; i < 5; i++)
      expect(await hit(store, "u1", i * 1000)).toBe("ok");
    const sixth = await hit(store, "u1", 5000);
    expect(sixth).toBeInstanceOf(AuthError);
    expect(sixth).toMatchObject({
      code: "rate_limited",
      status: 429,
      details: { retryInSeconds: 55 },
    });
    const res = (sixth as AuthError).toResponse();
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("55");
  });

  it("slides: each old hit frees a slot as it leaves the window", async () => {
    const store = memoryRateLimitStore();
    for (let i = 0; i < 5; i++) await hit(store, "u1", i * 1000);
    expect(await hit(store, "u1", 59_999)).not.toBe("ok");
    expect(await hit(store, "u1", 60_001)).toBe("ok"); // the 0 s hit expired
    expect(await hit(store, "u1", 60_002)).not.toBe("ok");
  });

  it("keeps keys and buckets apart", async () => {
    const store = memoryRateLimitStore();
    for (let i = 0; i < 5; i++) await hit(store, "u1", i);
    expect(await hit(store, "u2", 10)).toBe("ok");
    await expect(
      enforceRateLimit("other-bucket", "u1", rule, { store, now: 10 }),
    ).resolves.toBeUndefined();
  });

  it("forgets idle keys when it gets large", async () => {
    const store = memoryRateLimitStore(3);
    for (let k = 0; k < 10; k++) await hit(store, `k${k}`, 0);
    // Everything from t=0 has left the window; new hits still work.
    for (let k = 0; k < 10; k++)
      expect(await hit(store, `k${k}`, 61_000)).toBe("ok");
  });

  it("has the documented sign-in limit", () => {
    expect(RATE_LIMITS.otpPerIp).toEqual({ limit: 20, windowSeconds: 3600 });
  });
});

describe("clientIp", () => {
  it("prefers x-real-ip, then the first x-forwarded-for entry", () => {
    expect(
      clientIp(
        new Headers({ "x-real-ip": "1.2.3.4", "x-forwarded-for": "9.9.9.9" }),
      ),
    ).toBe("1.2.3.4");
    expect(
      clientIp(new Headers({ "x-forwarded-for": "5.6.7.8, 10.0.0.1" })),
    ).toBe("5.6.7.8");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});

describe("waitText", () => {
  it("reads naturally", () => {
    expect(waitText(20)).toBe("20 seconds");
    expect(waitText(60)).toBe("1 minute");
    expect(waitText(3445)).toBe("58 minutes");
  });
});
