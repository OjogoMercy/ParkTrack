import "server-only";
import { db } from "@/lib/db";
import type { OtpStore } from "./otp";

/** OtpStore over the otp_codes table. */
export const prismaOtpStore: OtpStore = {
  latest(phone) {
    return db.otpCode.findFirst({
      where: { phone },
      orderBy: { createdAt: "desc" },
    });
  },

  create(row) {
    return db.otpCode.create({ data: row });
  },

  async takeAttempt(id, now, maxAttempts) {
    const { count } = await db.otpCode.updateMany({
      where: {
        id,
        consumedAt: null,
        expiresAt: { gt: now },
        attempts: { lt: maxAttempts },
      },
      data: { attempts: { increment: 1 } },
    });
    return count === 1;
  },

  async consume(id, now) {
    const { count } = await db.otpCode.updateMany({
      where: { id, consumedAt: null },
      data: { consumedAt: now },
    });
    return count === 1;
  },
};
