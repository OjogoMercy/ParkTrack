import { describe, expect, it, vi } from "vitest";
import { AuthError } from "./errors";
import {
  checkOtp,
  issueOtp,
  OTP_MAX_ATTEMPTS,
  type OtpChannel,
  type OtpRow,
  type OtpStore,
} from "./otp";

const SECRET = "x".repeat(32);
const PHONE = "+2348035554471";
const T0 = new Date("2026-11-20T09:00:00Z");
const at = (seconds: number) => new Date(T0.getTime() + seconds * 1000);

/** In-memory OtpStore with the same conditional updates as the Prisma one. */
function memoryStore(): OtpStore & { rows: OtpRow[] } {
  const rows: OtpRow[] = [];
  return {
    rows,
    async latest(phone) {
      // A copy, like a database read: later updates don't change it.
      const last = rows.filter((r) => r.phone === phone).at(-1);
      return last ? { ...last } : null;
    },
    async create(row) {
      const created: OtpRow = {
        ...row,
        id: String(rows.length + 1),
        attempts: 0,
        consumedAt: null,
        createdAt: currentNow,
      };
      rows.push(created);
      return created;
    },
    async takeAttempt(id, now, max) {
      const r = rows.find((x) => x.id === id);
      if (!r || r.consumedAt || r.expiresAt <= now || r.attempts >= max)
        return false;
      r.attempts += 1;
      return true;
    },
    async consume(id, now) {
      const r = rows.find((x) => x.id === id);
      if (!r || r.consumedAt) return false;
      r.consumedAt = now;
      return true;
    },
    async issuedSince(phone, since) {
      return rows
        .filter((r) => r.phone === phone && r.createdAt > since)
        .map((r) => r.createdAt);
    },
  };
}
let currentNow = T0;

/** Issues a code at `seconds` and returns the plain code that was "sent". */
async function send(
  store: OtpStore,
  seconds: number,
  channel: OtpChannel = "WHATSAPP",
) {
  currentNow = at(seconds);
  const deliver = vi.fn(async () => {});
  const result = await issueOtp({
    phone: PHONE,
    channel,
    store,
    secret: SECRET,
    deliver,
    now: at(seconds),
  });
  const code = (deliver.mock.calls[0] as unknown[])[1] as string;
  return { result, code };
}

async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
    return undefined;
  } catch (e) {
    if (e instanceof AuthError) return e.code;
    throw e;
  }
}

const check = (store: OtpStore, code: string, seconds: number) =>
  checkOtp({ phone: PHONE, code, store, secret: SECRET, now: at(seconds) });

describe("issueOtp", () => {
  it("sends a 6-digit code and stores only its hash", async () => {
    const store = memoryStore();
    const { result, code } = await send(store, 0);
    expect(code).toMatch(/^\d{6}$/);
    expect(result).toEqual({ channel: "WHATSAPP", resendInSeconds: 30 });
    expect(store.rows[0].codeHash).not.toContain(code);
    expect(store.rows[0].expiresAt).toEqual(at(300));
  });

  it("refuses another code on the same channel within 30 s", async () => {
    const store = memoryStore();
    await send(store, 0);
    const err = await send(store, 10).catch((e: AuthError) => e);
    expect(err).toBeInstanceOf(AuthError);
    expect(err).toMatchObject({
      code: "otp_resend_too_soon",
      status: 429,
      details: { retryInSeconds: 20 },
    });
    await expect(send(store, 30)).resolves.toBeDefined();
  });

  it("allows 5 codes per phone per hour; the 6th gets 429", async () => {
    const store = memoryStore();
    for (const s of [0, 31, 62, 93, 124]) await send(store, s);
    const err = await send(store, 155).catch((e: AuthError) => e);
    expect(err).toMatchObject({
      code: "otp_rate_limited",
      status: 429,
      details: { retryInSeconds: 3600 - 155 },
    });
    // Switching channel doesn't get around it.
    expect(await codeOf(send(store, 156, "SMS"))).toBe("otp_rate_limited");
    // An hour after the first code, one more is allowed.
    await expect(send(store, 3601)).resolves.toBeDefined();
  });

  it("allows switching to SMS straight away", async () => {
    const store = memoryStore();
    await send(store, 0, "WHATSAPP");
    const { result } = await send(store, 5, "SMS");
    expect(result.channel).toBe("SMS");
  });
});

describe("checkOtp", () => {
  it("accepts the right code once", async () => {
    const store = memoryStore();
    const { code } = await send(store, 0);
    await expect(check(store, code, 60)).resolves.toBeUndefined();
    expect(await codeOf(check(store, code, 61))).toBe("otp_missing");
  });

  it("locks after 5 wrong tries, even if the right code comes next", async () => {
    const store = memoryStore();
    const { code } = await send(store, 0);
    const wrong = code === "000000" ? "111111" : "000000";
    for (let i = 1; i < OTP_MAX_ATTEMPTS; i++) {
      const err = await check(store, wrong, i).catch((e: AuthError) => e);
      expect(err).toMatchObject({
        code: "otp_wrong",
        details: { attemptsLeft: OTP_MAX_ATTEMPTS - i },
      });
    }
    expect(await codeOf(check(store, wrong, 5))).toBe("otp_locked");
    expect(await codeOf(check(store, code, 6))).toBe("otp_locked");
  });

  it("rejects an expired code", async () => {
    const store = memoryStore();
    const { code } = await send(store, 0);
    expect(await codeOf(check(store, code, 300))).toBe("otp_expired");
  });

  it("only the newest code counts", async () => {
    const store = memoryStore();
    const first = await send(store, 0);
    const second = await send(store, 31);
    if (first.code !== second.code) {
      expect(await codeOf(check(store, first.code, 40))).toBe("otp_wrong");
    }
    await expect(check(store, second.code, 41)).resolves.toBeUndefined();
  });

  it("says to ask for a code when none was sent", async () => {
    expect(await codeOf(check(memoryStore(), "123456", 0))).toBe("otp_missing");
  });

  it("a code for one phone doesn't work for another", async () => {
    const store = memoryStore();
    const { code } = await send(store, 0);
    // Same hash, different phone: rows for other phones aren't even looked at,
    // and the hash is bound to the phone, so copying it across fails too.
    store.rows.push({ ...store.rows[0], id: "x", phone: "+2348021189034" });
    const other = checkOtp({
      phone: "+2348021189034",
      code,
      store,
      secret: SECRET,
      now: at(10),
    });
    expect(await codeOf(other)).toBe("otp_wrong");
  });
});
