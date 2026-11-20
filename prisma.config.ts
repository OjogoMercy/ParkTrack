// Prisma 7 configuration. The connection URL lives here, not in schema.prisma.
//
// Supabase gives two connection strings:
//   DATABASE_URL — pooled (port 6543). The running app uses this, through the
//                  pg driver adapter in src/lib/db.ts.
//   DIRECT_URL   — direct/session (port 5432). Prisma CLI uses this for
//                  migrations, because migrations can't run through the pooler.
import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Next.js keeps local secrets in .env.local; fall back to .env.
config({ path: ".env.local", quiet: true });
config({ quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Undefined is fine for `prisma generate` / `validate`, which need no DB.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  },
});
