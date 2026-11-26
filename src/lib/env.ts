import { z } from "zod";

/**
 * Environment variables, validated with zod.
 *
 * - serverEnv(): every key, validated on first use. Server code only; it
 *   includes secrets. Importing it from a client component would still not
 *   leak values (Next only inlines NEXT_PUBLIC_*), but keep it server-side.
 * - requireEnv(key): for integrations that need a key to work at all
 *   (Interswitch, Termii...). Throws a clear message naming the missing key.
 * - clientEnv: the NEXT_PUBLIC_* values, safe in the browser.
 *
 * Integration keys are optional at startup so each scope can run before the
 * others have credentials. Values marked .default() always have a value.
 */

const secret = z.string().min(32, "must be at least 32 characters");
const optional = z.string().min(1).optional();

const ServerEnv = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    ROOT_DOMAIN: z.string().min(1).default("localhost:3000"),

    DATABASE_URL: optional,
    DIRECT_URL: optional,

    SUPABASE_URL: z.url().optional(),
    SUPABASE_SERVICE_ROLE_KEY: optional,

    AUTH_JWT_SECRET: secret.optional(),
    LINK_SIGNING_SECRET: secret.optional(),

    /** sandbox (default) or live; picks the Interswitch endpoints. */
    ISW_ENVIRONMENT: z.enum(["sandbox", "live"]).default("sandbox"),
    /** API base for the status check; defaults per ISW_ENVIRONMENT. */
    ISW_BASE_URL: z.url().optional(),
    ISW_MERCHANT_CODE: optional,
    ISW_PAY_ITEM_ID: optional,
    ISW_CLIENT_ID: optional,
    ISW_SECRET: optional,
    ISW_WEBHOOK_SECRET: optional,

    /**
     * console = messages go to the server log; live = sent for real. Unset:
     * live in production (so codes are never silently not sent), console
     * otherwise. Setting console in production is allowed (e.g. a preview)
     * but logged loudly on first use.
     */
    NOTIFY_MODE: z.enum(["console", "live"]).optional(),
    TERMII_API_KEY: optional,
    TERMII_SENDER_ID: optional,
    /** Account-specific; shown on the Termii dashboard. */
    TERMII_BASE_URL: z.url().optional(),
    /** "dnd" for transactional messages (reaches DND numbers); needs activating with Termii. */
    TERMII_CHANNEL: z.enum(["dnd", "generic"]).default("dnd"),
    WA_PHONE_NUMBER_ID: optional,
    WA_TOKEN: optional,

    QSTASH_TOKEN: optional,
    QSTASH_CURRENT_SIGNING_KEY: optional,
    QSTASH_NEXT_SIGNING_KEY: optional,

    SENTRY_DSN: z.url().optional(),
  })
  .transform((env) => ({
    ...env,
    NOTIFY_MODE:
      env.NOTIFY_MODE ?? (env.NODE_ENV === "production" ? "live" : "console"),
  }));
export type ServerEnv = z.infer<typeof ServerEnv>;

/** process.env, or a plain object in tests. */
export type EnvSource = Record<string, string | undefined>;

/** Treat empty strings (e.g. "KEY=" copied from .env.example) as unset. */
function readProcessEnv(source: EnvSource): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(source))
    if (v !== undefined && v !== "") out[k] = v;
  return out;
}

let cached: ServerEnv | undefined;

export function serverEnv(source: EnvSource = process.env): ServerEnv {
  if (source === process.env && cached) return cached;
  const parsed = ServerEnv.safeParse(readProcessEnv(source));
  if (!parsed.success) {
    const lines = parsed.error.issues.map(
      (i) => `  ${i.path.join(".")}: ${i.message}`,
    );
    throw new Error(`Invalid environment variables:\n${lines.join("\n")}`);
  }
  if (source === process.env) {
    cached = parsed.data;
    if (
      parsed.data.NODE_ENV === "production" &&
      parsed.data.NOTIFY_MODE === "console"
    ) {
      console.warn(
        "[env] NOTIFY_MODE=console in production: sign-in codes and messages are NOT sent, only logged.",
      );
    }
  }
  return parsed.data;
}

/** Returns a required value or throws "Missing ISW_SECRET: add it to .env.local". */
export function requireEnv<K extends keyof ServerEnv>(
  key: K,
  source: EnvSource = process.env,
): NonNullable<ServerEnv[K]> {
  const value = serverEnv(source)[key];
  if (value === undefined || value === null) {
    throw new Error(
      `Missing ${String(key)}: add it to .env.local (see .env.example).`,
    );
  }
  return value as NonNullable<ServerEnv[K]>;
}

/**
 * Browser-safe values. Each must be read as `process.env.NEXT_PUBLIC_X`
 * literally so Next.js can inline it at build time.
 */
export const clientEnv = {
  ROOT_DOMAIN: process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost:3000",
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || undefined,
  SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || undefined,
} as const;
