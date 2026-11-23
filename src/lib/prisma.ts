import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Creates a Prisma client over the pg driver adapter (required in Prisma 7).
 * App code should import `db` from "@/lib/db" instead; this factory exists so
 * scripts (seed, maintenance) can build their own client outside Next.js.
 *
 * Uses the pooled DATABASE_URL (Supabase port 6543). Migrations use
 * DIRECT_URL via prisma.config.ts.
 */
export function createPrismaClient(
  connectionString = process.env.DATABASE_URL,
): PrismaClient {
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and add your Supabase connection strings.",
    );
  }
  // Optional pool size. Set DATABASE_POOL_MAX=1 for the local `prisma dev`
  // database, which accepts one connection at a time. Leave unset for Supabase.
  const max = Number(process.env.DATABASE_POOL_MAX) || undefined;
  const adapter = new PrismaPg({ connectionString, ...(max ? { max } : {}) });
  return new PrismaClient({ adapter });
}
