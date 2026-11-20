import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Guards sl1's "no secrets committed" rule: .env.example lists keys only.
const lines = readFileSync(join(process.cwd(), ".env.example"), "utf8")
  .split(/\r?\n/)
  .filter((l) => l.trim() && !l.trim().startsWith("#"));

const entries = lines.map((l) => {
  const i = l.indexOf("=");
  return [l.slice(0, i).trim(), l.slice(i + 1).trim()] as const;
});

// Keys that may carry a non-secret default value.
const allowedDefaults: Record<string, string> = {
  ROOT_DOMAIN: "localhost:3000",
  NEXT_PUBLIC_ROOT_DOMAIN: "localhost:3000",
  NOTIFY_MODE: "console",
};

describe(".env.example", () => {
  it("has only KEY=value lines with upper-case keys", () => {
    for (const [key] of entries) expect(key).toMatch(/^[A-Z][A-Z0-9_]*$/);
  });

  it("leaves every secret empty", () => {
    for (const [key, value] of entries) {
      if (key in allowedDefaults) expect(value).toBe(allowedDefaults[key]);
      else expect(value, `${key} must be empty in .env.example`).toBe("");
    }
  });

  it("lists the keys every scope depends on", () => {
    const keys = new Set(entries.map(([k]) => k));
    for (const k of [
      "DATABASE_URL",
      "DIRECT_URL",
      "AUTH_JWT_SECRET",
      "LINK_SIGNING_SECRET",
      "ISW_MERCHANT_CODE",
      "TERMII_API_KEY",
      "QSTASH_TOKEN",
      "ROOT_DOMAIN",
    ])
      expect(keys.has(k), k).toBe(true);
  });
});
