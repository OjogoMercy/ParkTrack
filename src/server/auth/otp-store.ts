import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import type { OtpStore } from "./otp";

type Client = typeof db | Prisma.TransactionClient;

/** OtpStore over the otp_codes table, on `client` (the db or a transaction). */
function otpStore(client: Client): OtpStore {
  return {
    latest(phone) {
      return client.otpCode.findFirst({
        where: { phone },
        orderBy: { createdAt: "desc" },
      });
    },

    create(row) {
      return client.otpCode.create({ data: row });
    },

    async takeAttempt(id, now, maxAttempts) {
      const { count } = await client.otpCode.updateMany({
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

    async issuedSince(phone, since) {
      const rows = await client.otpCode.findMany({
        where: { phone, createdAt: { gt: since } },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      });
      return rows.map((r) => r.createdAt);
    },

    async consume(id, now) {
      const { count } = await client.otpCode.updateMany({
        where: { id, consumedAt: null },
        data: { consumedAt: now },
      });
      return count === 1;
    },

    async remove(id) {
      await client.otpCode.deleteMany({ where: { id, consumedAt: null } });
    },

    /**
     * A transaction-scoped Postgres advisory lock keyed on the phone: every
     * server instance waits its turn, and the lock ends with the transaction.
     */
    withPhoneLock(phone, fn) {
      return db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(hashtext(${`otp:${phone}`}))) AS l`;
        return fn(otpStore(tx));
      });
    },
  };
}

export const prismaOtpStore: OtpStore = otpStore(db);
