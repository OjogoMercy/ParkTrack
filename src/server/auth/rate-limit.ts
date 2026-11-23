import { AuthError } from "./errors";

/**
 * Sliding-window rate limits for abuse-prone endpoints: sign-in code requests
 * per IP, and the scan endpoints of Scopes 06 and 08 (handshake, collection).
 *
 *   await enforceRateLimit("handshake-scan", user.id, RATE_LIMITS.scan);
 *
 * Throws AuthError "rate_limited" (429, retryInSeconds + Retry-After) once
 * the limit is reached; every call counts as one hit.
 *
 * Storage: in memory, per server instance, behind RateLimitStore. That is
 * enough for one server and a first line of defence on serverless. For a
 * hard limit across instances, add a rate_limit_hits table (contract PR,
 * WORKFLOW §7) and a store over it; callers don't change.
 *
 * Per-phone sign-in limits don't use this: they count otp_codes rows, so
 * they hold across instances already (./otp.ts).
 */

export type RateLimitRule = { limit: number; windowSeconds: number };

export const RATE_LIMITS = {
  /** Sign-in code requests from one IP address (docs: 20/h per IP). */
  otpPerIp: { limit: 20, windowSeconds: 60 * 60 },
  /** Default for scan endpoints (06 handshake, 08 collection), per user. */
  scan: { limit: 60, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitResult =
  { ok: true; remaining: number } | { ok: false; retryInSeconds: number };

export interface RateLimitStore {
  /** Records a hit unless the key is at its limit. */
  consume(key: string, rule: RateLimitRule, now: number): RateLimitResult;
}

/** Timestamps of recent hits per key, pruned as they leave the window. */
export function memoryRateLimitStore(maxKeys = 50_000): RateLimitStore {
  const hits = new Map<string, number[]>();

  function sweep(now: number, windowMs: number) {
    for (const [key, times] of hits) {
      if (times.length === 0 || times[times.length - 1] <= now - windowMs)
        hits.delete(key);
    }
  }

  return {
    consume(key, { limit, windowSeconds }, now) {
      const windowMs = windowSeconds * 1000;
      const recent = (hits.get(key) ?? []).filter((t) => t > now - windowMs);
      if (recent.length >= limit) {
        hits.set(key, recent);
        return {
          ok: false,
          retryInSeconds: Math.max(
            1,
            Math.ceil((recent[0] + windowMs - now) / 1000),
          ),
        };
      }
      recent.push(now);
      hits.set(key, recent);
      if (hits.size > maxKeys) sweep(now, windowMs);
      return { ok: true, remaining: limit - recent.length };
    },
  };
}

const globalStore = globalThis as unknown as {
  __parktrackRateLimits?: RateLimitStore;
};

function defaultStore(): RateLimitStore {
  globalStore.__parktrackRateLimits ??= memoryRateLimitStore();
  return globalStore.__parktrackRateLimits;
}

/** Counts one hit for `bucket` + `key`; throws AuthError rate_limited when over. */
export async function enforceRateLimit(
  bucket: string,
  key: string,
  rule: RateLimitRule,
  {
    store = defaultStore(),
    now = Date.now(),
  }: { store?: RateLimitStore; now?: number } = {},
): Promise<void> {
  const result = store.consume(`${bucket}:${key}`, rule, now);
  if (!result.ok) {
    throw new AuthError(
      "rate_limited",
      `Too many tries. Wait ${waitText(result.retryInSeconds)} and try again.`,
      429,
      { retryInSeconds: result.retryInSeconds },
    );
  }
}

/**
 * The caller's IP for rate limiting. On Vercel x-real-ip is set by the
 * platform; elsewhere the first x-forwarded-for entry. "unknown" groups
 * requests without either (e.g. local dev) into one bucket.
 */
export function clientIp(headers: Headers): string {
  return (
    headers.get("x-real-ip")?.trim() ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export function waitText(seconds: number): string {
  if (seconds < 60) return `${seconds} seconds`;
  const minutes = Math.ceil(seconds / 60);
  return minutes === 1 ? "1 minute" : `${minutes} minutes`;
}
