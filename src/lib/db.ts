import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { createPrismaClient } from "./prisma";

/**
 * The app's single Prisma client. Server-only: importing this from a client
 * component fails the build, so database access can never reach the browser.
 *
 * In development, Next.js hot reload re-evaluates modules; keeping the client
 * on globalThis stops every reload from opening a new connection pool.
 * Created lazily so builds and tests don't need DATABASE_URL until a query runs.
 */
const globalForDb = globalThis as unknown as { __parktrackDb?: PrismaClient };

function getDb(): PrismaClient {
  if (!globalForDb.__parktrackDb) {
    globalForDb.__parktrackDb = createPrismaClient();
  }
  return globalForDb.__parktrackDb;
}

export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getDb();
    const value = Reflect.get(client, prop, client);
    // Bind methods ($transaction, $queryRaw, ...) to the real client.
    return typeof value === "function" ? value.bind(client) : value;
  },
});
