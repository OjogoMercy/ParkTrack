import { sixDigitCode } from "@/lib/ids";
import { hashCode, verifyCode } from "@/lib/sign";
import { AuthError } from "./errors";
import { waitText } from "./rate-limit";

/**
 * Sign-in codes (AUTH-1), decided in docs/reference/open-questions.md:
 * 6 digits, valid 5 minutes, 5 tries, a new code at most every 30 seconds.
 *
 * Codes are stored only as a keyed hash bound to the phone number. Only the
 * newest code for a phone counts, so asking for a new code cancels the old one.
 *
 * The rules live here as plain functions over an OtpStore so they can be
 * tested without a database; ./otp-store.ts is the Prisma implementation.
 */

export const OTP_TTL_SECONDS = 5 * 60;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_SECONDS = 30;
/** At most this many codes per phone per hour (docs: 5/h per phone). */
export const OTP_MAX_PER_HOUR = 5;

export type OtpChannel = "WHATSAPP" | "SMS";

export type OtpRow = {
  id: string;
  phone: string;
  codeHash: string;
  attempts: number;
  /** The table's NotificationChannel (also allows CONSOLE). */
  channel: string;
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
};

export interface OtpStore {
  /** Newest code issued for this phone, used or not. */
  latest(phone: string): Promise<OtpRow | null>;
  create(row: {
    phone: string;
    codeHash: string;
    channel: OtpChannel;
    expiresAt: Date;
  }): Promise<OtpRow>;
  /**
   * Atomically uses up one try: succeeds only while the code is unused,
   * unexpired and has tries left. Taking the try before comparing the code
   * stops parallel guesses from getting more than OTP_MAX_ATTEMPTS.
   */
  takeAttempt(id: string, now: Date, maxAttempts: number): Promise<boolean>;
  /** Marks the code used. False if something else used it first. */
  consume(id: string, now: Date): Promise<boolean>;
  /** When codes were issued for this phone since `since`, oldest first. */
  issuedSince(phone: string, since: Date): Promise<Date[]>;
  /** Removes a code that was never delivered (it mustn't count or work). */
  discard(id: string): Promise<void>;
}

export type IssueOtpInput = {
  phone: string; // E.164
  channel: OtpChannel;
  store: OtpStore;
  secret: string;
  /**
   * Sends the code; may return the channel that actually delivered it, or
   * false when nothing was delivered (WhatsApp and SMS both failed).
   */
  deliver: (
    phone: string,
    code: string,
    channel: OtpChannel,
  ) => Promise<OtpChannel | false | void>;
  now?: Date;
};

/**
 * Creates and sends a new code. Within 30 seconds of the last code only a
 * switch of channel is allowed ("Send by SMS instead"); repeating the same
 * channel is refused with the seconds left to wait. At most 5 codes per
 * phone per hour, whatever the channel (otp_rate_limited); counted from the
 * stored codes, so the limit holds on every server.
 */
export async function issueOtp({
  phone,
  channel,
  store,
  secret,
  deliver,
  now = new Date(),
}: IssueOtpInput): Promise<{ channel: OtpChannel; resendInSeconds: number }> {
  const last = await store.latest(phone);
  if (last && !last.consumedAt) {
    const waited = (now.getTime() - last.createdAt.getTime()) / 1000;
    const wait = Math.ceil(OTP_RESEND_SECONDS - waited);
    if (wait > 0 && last.channel === channel) {
      throw new AuthError(
        "otp_resend_too_soon",
        `Wait ${wait} seconds before asking for another code.`,
        429,
        { retryInSeconds: wait },
      );
    }
  }

  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const recent = await store.issuedSince(phone, hourAgo);
  if (recent.length >= OTP_MAX_PER_HOUR) {
    const retry = Math.max(
      1,
      Math.ceil((recent[0].getTime() + 60 * 60 * 1000 - now.getTime()) / 1000),
    );
    throw new AuthError(
      "otp_rate_limited",
      `Too many codes for this number. Try again in ${waitText(retry)}.`,
      429,
      { retryInSeconds: retry },
    );
  }

  const code = sixDigitCode();
  const row = await store.create({
    phone,
    codeHash: hashCode(code, phone, secret),
    channel,
    expiresAt: new Date(now.getTime() + OTP_TTL_SECONDS * 1000),
  });
  // The channel that actually delivered it (SMS if WhatsApp fell back).
  const delivered = await deliver(phone, code, channel);
  if (delivered === false) {
    // Nothing reached the phone: don't make them wait for it, and don't let
    // it count towards the 5 codes an hour.
    await store.discard(row.id);
    throw new AuthError(
      "otp_send_failed",
      "We couldn’t send your code just now. Try again in a minute, or ask for it by SMS.",
      503,
    );
  }
  return { channel: delivered ?? channel, resendInSeconds: OTP_RESEND_SECONDS };
}

export type CheckOtpInput = {
  phone: string; // E.164
  code: string;
  store: OtpStore;
  secret: string;
  now?: Date;
};

/**
 * Checks a code against the newest one for the phone and uses it up on
 * success. Throws AuthError: otp_missing, otp_expired, otp_locked, or
 * otp_wrong (with attemptsLeft).
 */
export async function checkOtp({
  phone,
  code,
  store,
  secret,
  now = new Date(),
}: CheckOtpInput): Promise<void> {
  const row = await store.latest(phone);
  if (!row || row.consumedAt) {
    throw new AuthError("otp_missing", "Ask for a sign-in code first.", 400);
  }
  if (row.expiresAt <= now) {
    throw new AuthError(
      "otp_expired",
      "This code has expired. Ask for a new one.",
      400,
    );
  }
  if (!(await store.takeAttempt(row.id, now, OTP_MAX_ATTEMPTS))) {
    throw locked();
  }

  if (!verifyCode(code, phone, row.codeHash, secret)) {
    const attemptsLeft = OTP_MAX_ATTEMPTS - (row.attempts + 1);
    if (attemptsLeft <= 0) throw locked();
    throw new AuthError(
      "otp_wrong",
      `That code isn't right. ${attemptsLeft} ${attemptsLeft === 1 ? "try" : "tries"} left.`,
      400,
      { attemptsLeft },
    );
  }

  if (!(await store.consume(row.id, now))) {
    throw new AuthError("otp_missing", "Ask for a sign-in code first.", 400);
  }
}

function locked() {
  return new AuthError(
    "otp_locked",
    "Too many wrong tries. Ask for a new code.",
    429,
  );
}
