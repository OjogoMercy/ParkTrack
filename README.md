# ParkTrack

A tracked, paid and fair waybill network for Nigerian motor parks. Senders book from their park's own web address, agents and drivers hand parcels over phone to phone, recipients collect with a one-time code, and every naira goes through Interswitch.

**Start here:** [docs/README.md](docs/README.md) (build plan) → [docs/WORKFLOW.md](docs/WORKFLOW.md) (branches, PRs, merge order) → your scope file in [docs/scopes/](docs/scopes/).
PRD: [docs/ParkTrack_PRD_v1.1.pdf](docs/ParkTrack_PRD_v1.1.pdf) · Designs: [docs/design/](docs/design/) (open in a browser; the Foundations file is the design rulebook, not a screen).

## Stack

Next.js 16 (App Router, TypeScript) · Tailwind CSS 4 + shadcn/ui · Prisma 7 on Supabase Postgres · Zod 4 · jose · Supabase Storage + Realtime · Interswitch Web Checkout · Termii SMS + WhatsApp Cloud API · Upstash QStash · Vercel + Sentry · npm · Vitest.

> **Newer than most tutorials and AI training data.** Before writing framework code, read the bundled docs: Next.js in `node_modules/next/dist/docs/`. What matters here:
>
> - Next.js 16: `middleware.ts` is now **`src/proxy.ts`** (Node runtime); **`cacheComponents`** is on (pages are dynamic by default; opt into caching with `"use cache"`).
> - Prisma 7: the connection URL lives in **`prisma.config.ts`**, not the schema; the client needs the **`@prisma/adapter-pg`** driver adapter; the generated client is at `src/generated/prisma` (git-ignored, rebuilt by `npm install`).
> - Prisma is pinned to **7.10.1**. Don't run `npm i prisma@latest`: that tag currently points at an 8.0 release candidate.

## Setup

Requirements: Node 22+ (npm comes with it).

```powershell
npm install
```

```powershell
Copy-Item .env.example .env.local
```

Fill in `.env.local`. To work with the database you need a Supabase project:

- `DATABASE_URL`: Supabase **pooled** connection (port 6543), used by the app.
- `DIRECT_URL`: Supabase **direct** connection (port 5432), used for migrations.

Then create the tables and the reference data (two parks, routes, fares, staff from the designs):

```powershell
npm run db:migrate
```

```powershell
npm run db:seed
```

Run the app:

```powershell
npm run dev
```

It runs at http://localhost:3000. Park subdomains work locally as `http://ogbomoso.localhost:3000` once Scope 02 adds `src/proxy.ts`.

No Supabase yet? `npx prisma dev` starts a local Postgres; put the URL it prints into both `DATABASE_URL` and `DIRECT_URL`.

## Scripts

| Command                                   | What it does                                              |
| ----------------------------------------- | --------------------------------------------------------- |
| `npm run dev`                             | Dev server                                                |
| `npm run build`                           | Production build                                          |
| `npm run typecheck`                       | Generate route types, then `tsc --noEmit`                 |
| `npm run lint`                            | ESLint (Next.js rules + Prettier compatibility)           |
| `npm test`                                | Vitest, once (`npm run test:watch` to keep running)       |
| `npm run format` / `npm run format:check` | Prettier write / check                                    |
| `npm run check`                           | typecheck + lint + test + format check (CI also builds)   |
| `npm run db:migrate`                      | Apply migrations (`prisma migrate deploy`)                |
| `npm run db:migrate:dev`                  | Create a new migration from schema changes (Scope 01/CCR) |
| `npm run db:seed`                         | Idempotent reference seed                                 |
| `npm run db:generate`                     | Regenerate the Prisma client                              |
| `npm run db:studio`                       | Browse the database                                       |

Add packages with `npm install <name>` (or `npm install -D <name>` for dev tools) and commit `package-lock.json` with them. Packages with install scripts must be approved once (`npm install-scripts approve <name>`), which records them under `allowScripts` in `package.json`. Add shadcn components with `npx shadcn@latest add <component>`.

## What Scope 01 gives every other scope

| Need                                     | Use                                                                                    |
| ---------------------------------------- | -------------------------------------------------------------------------------------- |
| Design tokens                            | Tailwind classes from `src/app/globals.css` (`bg-panel`, `text-fg-3`, `rounded-card`…) |
| UI pieces and shells                     | `@/components/ui/*` (buttons, fields, badges, timeline, QR, scanner, photo, shells)    |
| Data shapes and API schemas              | `@/contracts` (`api.*`, `dto.*`, enums, state machine, QR format)                      |
| Database                                 | `db` from `@/lib/db` (server only)                                                     |
| Money, ids, phones, dates, env, tokens   | `@/lib/money`, `ids`, `phone`, `dates`, `env`, `sign`                                  |
| Other scopes' services, before they land | `@/server/<module>`: stubs with the final signatures, returning fixture data           |
| Sample data for screens and tests        | `@/mocks/fixtures`                                                                     |

## Where code goes

Each scope has its own folders; empty ones still hold a `.gitkeep`. The full map is in [docs/WORKFLOW.md §6](docs/WORKFLOW.md). In short:

```
src/contracts/        shared types + zod schemas (Scope 01, frozen)
src/components/ui/    design system + shared widgets (Scope 01)
src/lib/              helpers: db, env, money, ids, phone, dates, signing (Scope 01)
src/mocks/            fixtures and stub helpers (Scope 01)
src/server/<module>/  server logic, one folder per module (owned per scope)
src/features/<area>/  UI components for one scope
src/app/sites/[park]/ park subdomain pages (senders)
src/app/console/      app.parktrack.ng (agents, drivers, admins)
src/app/{t,collect,pay}/  recipient tracking, counter collection, payment returns
src/app/api/          route handlers
prisma/               schema, migrations, seed (Scope 01)
tests/                cross-cutting tests (contracts, fixtures, stubs)
```
