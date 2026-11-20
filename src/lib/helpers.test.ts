import { describe, expect, it } from "vitest";
import {
  ParcelCode,
  PublicToken,
  TxnRef,
  parseQr,
  bookingQr,
} from "@/contracts";
import {
  addHours,
  formatCountdown,
  formatDay,
  formatDayTime,
  formatRelativeDay,
  formatTime,
  formatTimeLeft,
  formatClock,
  openStatus,
} from "./dates";
import { requireEnv, serverEnv } from "./env";
import { parcelCode, publicId, randomInt, sixDigitCode, txnRef } from "./ids";
import {
  formatPhone,
  formatPhoneNational,
  maskPhone,
  normalizeNgPhone,
} from "./phone";
import { hashCode, signToken, verifyCode, verifyToken } from "./sign";

describe("ids", () => {
  it("publicId is a 128-bit url-safe token that fits the contract and QR", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const id = publicId();
      expect(PublicToken.safeParse(id).success).toBe(true);
      expect(id).toHaveLength(22);
      seen.add(id);
    }
    expect(seen.size).toBe(500);
    const id = publicId();
    expect(parseQr(bookingQr(id))).toEqual({ kind: "booking", publicId: id });
  });

  it("parcel codes never contain 0, O, 1 or I", () => {
    for (let i = 0; i < 2000; i++) {
      const c = parcelCode();
      expect(ParcelCode.safeParse(c).success, c).toBe(true);
      expect(c.slice(3)).not.toMatch(/[01OI]/);
    }
  });

  it("txn refs and 6-digit codes match their formats", () => {
    expect(TxnRef.safeParse(txnRef()).success).toBe(true);
    for (let i = 0; i < 500; i++) expect(sixDigitCode()).toMatch(/^\d{6}$/);
  });

  it("randomInt stays in range and rejects bad bounds", () => {
    for (let i = 0; i < 1000; i++) {
      const n = randomInt(7);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(7);
    }
    expect(() => randomInt(0)).toThrow(RangeError);
  });
});

describe("phone", () => {
  it("normalizes what people type to E.164", () => {
    for (const input of [
      "0803 555 4471",
      "08035554471",
      "803-555-4471",
      "2348035554471",
      "+234 803 555 4471",
    ])
      expect(normalizeNgPhone(input), input).toBe("+2348035554471");
    expect(normalizeNgPhone("+2340000000101")).toBe("+2340000000101"); // seed range
  });

  it("rejects non-Nigerian or impossible numbers", () => {
    for (const input of [
      "",
      "12345",
      "+447700900123",
      "0603 555 4471",
      "080355544711",
    ])
      expect(normalizeNgPhone(input), input).toBeNull();
  });

  it("formats and masks like the designs", () => {
    expect(formatPhone("+2348035554471")).toBe("+234 803 555 4471");
    expect(formatPhoneNational("+2348035554471")).toBe("0803 555 4471");
    expect(maskPhone("+2348021189034")).toBe("+234 802 *** 9034");
  });
});

describe("dates (always Lagos time)", () => {
  // 2026-11-22 17:00 UTC = 6:00 PM in Lagos (UTC+1).
  const sat6pm = new Date("2026-11-22T17:00:00Z");

  it("formats like the design copy", () => {
    expect(formatTime(sat6pm)).toBe("6:00 PM");
    expect(formatDay(sat6pm)).toBe("Sun 22 Nov");
    expect(formatDayTime("2026-11-20T15:12:00Z")).toBe("Fri 20 Nov, 4:12 PM");
    expect(formatTime("2026-11-20T23:30:00Z")).toBe("12:30 AM");
  });

  it("counts down deadlines", () => {
    const now = new Date("2026-11-20T19:00:00Z");
    expect(formatTimeLeft(addHours(now, 46), now)).toBe("1 day 22 hours left");
    expect(formatTimeLeft(addHours(now, 18), now)).toBe("18 hours left");
    expect(formatTimeLeft(addHours(now, 0.2), now)).toBe("12 min left");
    expect(formatTimeLeft(addHours(now, -1), now)).toBe("Expired");
    expect(formatCountdown(581)).toBe("9:41");
  });

  it("says Today / Yesterday in Lagos, not UTC", () => {
    const now = new Date("2026-11-20T23:30:00Z"); // 00:30 Sat 21 Nov in Lagos
    expect(formatRelativeDay("2026-11-20T23:10:00Z", now)).toBe("Today");
    expect(formatRelativeDay("2026-11-20T12:00:00Z", now)).toBe("Yesterday");
  });

  it("knows when a park is open", () => {
    const hours = { fri: ["06:00", "19:00"] as [string, string], sat: null };
    expect(openStatus(hours, "2026-11-20T09:00:00Z")).toEqual({
      open: true,
      closesAt: "19:00",
    }); // Fri 10:00
    expect(openStatus(hours, "2026-11-20T18:30:00Z").open).toBe(false); // Fri 19:30
    expect(openStatus(hours, "2026-11-21T10:00:00Z").open).toBe(false); // Sat, closed
    expect(formatClock("19:00")).toBe("7:00 PM");
  });
});

describe("env", () => {
  it("treats empty values from .env.example as unset and applies defaults", () => {
    const env = serverEnv({
      ROOT_DOMAIN: "",
      NOTIFY_MODE: "",
      DATABASE_URL: "",
    });
    expect(env.ROOT_DOMAIN).toBe("localhost:3000");
    expect(env.NOTIFY_MODE).toBe("console");
    expect(env.DATABASE_URL).toBeUndefined();
  });

  it("rejects weak secrets and names missing required keys", () => {
    expect(() => serverEnv({ AUTH_JWT_SECRET: "short" })).toThrow(
      /AUTH_JWT_SECRET/,
    );
    expect(() => requireEnv("ISW_SECRET", {})).toThrow(/Missing ISW_SECRET/);
    expect(requireEnv("ISW_SECRET", { ISW_SECRET: "abc" })).toBe("abc");
  });
});

describe("sign", () => {
  const secret = "x".repeat(40);

  it("round-trips a token for the same purpose only", async () => {
    const t = await signToken(
      { sub: "user_1" },
      { secret, purpose: "session", expiresIn: "1h" },
    );
    expect((await verifyToken(t, { secret, purpose: "session" }))?.sub).toBe(
      "user_1",
    );
    expect(
      await verifyToken(t, { secret, purpose: "recipient_link" }),
    ).toBeNull();
    expect(
      await verifyToken(t, { secret: "y".repeat(40), purpose: "session" }),
    ).toBeNull();
    expect(
      await verifyToken(t.slice(0, -2) + "xx", { secret, purpose: "session" }),
    ).toBeNull();
  });

  it("rejects expired tokens", async () => {
    const t = await signToken(
      { sub: "u" },
      {
        secret,
        purpose: "session",
        expiresIn: Math.floor(Date.now() / 1000) - 10,
      },
    );
    expect(await verifyToken(t, { secret, purpose: "session" })).toBeNull();
  });

  it("hashes codes bound to their context", () => {
    const h = hashCode("482913", "parcel_1", secret);
    expect(h).not.toContain("482913");
    expect(verifyCode("482913", "parcel_1", h, secret)).toBe(true);
    expect(verifyCode("482914", "parcel_1", h, secret)).toBe(false);
    expect(verifyCode("482913", "parcel_2", h, secret)).toBe(false);
  });
});
