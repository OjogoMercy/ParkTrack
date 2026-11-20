# ParkTrack

A tracked, paid and fair waybill network for Nigerian motor parks. Senders book from their park's own web address, agents and drivers hand parcels over phone to phone, recipients collect with a one-time code, and every naira goes through Interswitch.

**Start here:** [docs/README.md](docs/README.md) (build plan) → [docs/WORKFLOW.md](docs/WORKFLOW.md) (branches, PRs, merge order) → your scope file in [docs/scopes/](docs/scopes/).
PRD: [docs/ParkTrack_PRD_v1.1.pdf](docs/ParkTrack_PRD_v1.1.pdf) · Designs: [docs/design/](docs/design/) (open in a browser).

## Stack

Next.js 16 (App Router, TypeScript) · Tailwind CSS 4 + shadcn/ui · Prisma on Supabase Postgres · Zod · Supabase Storage + Realtime · Interswitch Web Checkout · Termii SMS + WhatsApp Cloud API · Upstash QStash · Vercel + Sentry · pnpm · Vitest.

> **Next.js 16 is newer than most tutorials and AI training data.** Before writing Next.js code, read the matching guide in `node_modules/next/dist/docs/`. Two changes that matter here: `middleware.ts` is now **`proxy.ts`**, and **`cacheComponents`** is on (pages are dynamic by default; opt into caching with `"use cache"`).

## Setup

Requirements: Node 22+ and pnpm (via corepack).

```powershell
corepack enable pnpm
```

If that fails with a permissions error on Windows, install the pnpm shim into your user folder instead:

```powershell
corepack enable pnpm --install-directory "$env:APPDATA\npm"
```

Then:

```powershell
pnpm install
```

```powershell
Copy-Item .env.example .env.local
```

Fill in `.env.local` (at minimum `DATABASE_URL` and `DIRECT_URL` once Scope 01 sl6 lands), then:

```powershell
pnpm dev
```

The app runs at http://localhost:3000. Park subdomains work locally as `http://ogbomoso.localhost:3000` once Scope 02 adds `src/proxy.ts`.

## Scripts

| Command                             | What it does                                                      |
| ----------------------------------- | ----------------------------------------------------------------- |
| `pnpm dev`                          | Dev server                                                        |
| `pnpm build`                        | Production build                                                  |
| `pnpm typecheck`                    | Generate route types, then `tsc --noEmit`                         |
| `pnpm lint`                         | ESLint (Next.js rules + Prettier compatibility)                   |
| `pnpm test`                         | Vitest, once                                                      |
| `pnpm format` / `pnpm format:check` | Prettier write / check                                            |
| `pnpm check`                        | typecheck + lint + test + format check (what CI runs, plus build) |

## Where code goes

Each scope has its own folders (placeholders are already in place). The full map is in [docs/WORKFLOW.md §6](docs/WORKFLOW.md). In short:

```
src/contracts/        shared types + zod schemas (Scope 01, frozen)
src/components/ui/    design system + shared widgets (Scope 01)
src/lib/              helpers: env, money, ids, dates, signing (Scope 01)
src/mocks/            fixtures for every API response (Scope 01)
src/server/<module>/  server logic, one folder per module (owned per scope)
src/features/<area>/  UI components for one scope
src/app/sites/[park]/ park subdomain pages (senders)
src/app/console/      app.parktrack.ng (agents, drivers, admins)
src/app/{t,collect,pay}/  recipient tracking, counter collection, payment returns
src/app/api/          route handlers
prisma/               schema, migrations, seed (Scope 01)
```
