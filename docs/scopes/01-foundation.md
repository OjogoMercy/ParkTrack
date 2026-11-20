# Scope 01 — Foundation & contracts

| | |
|---|---|
| Branch | `scope/01-foundation` (slices: `s01/slN-name` → PR into `scope/01-foundation`; slice branches are deleted once this scope is merged into `main`) |
| Merges after | nothing: goes first, alone; no other scope branch exists until it merges |
| Unblocks | every other scope |
| Design source | `ParkTrack UI Foundations.html`: the guidelines (tokens and component rules). It is not a screen, so Scope 01 adds no page for it |

## Goal

Give every other scope a repo they can build in **without touching each other**: the app skeleton, the design system, the complete database schema with seed data, frozen contracts (types, zod schemas, the state machine table), **stubbed** service modules with final signatures, and CI that enforces folder ownership and merge order.
No business logic and no feature screens.

## Owned paths

```
package.json, package-lock.json, tsconfig.json, next.config.ts (base), tailwind/postcss config, eslint config,
components.json, .env.example, .gitignore, README.md (root)
.github/**                    # workflows, scopes.json, PR template, CODEOWNERS
prisma/**                     # schema, migrations, seed
src/contracts/**              # frozen types + zod
src/components/ui/**          # design system + shared widgets
src/lib/**                    # db client, env, money, ids, dates, signing helpers
src/mocks/**                  # API fixtures
src/server/*/index.ts         # STUB files only (each later handed to its owning scope)
src/app/layout.tsx, src/app/globals.css, src/app/page.tsx (placeholder)
```

## Stack (from PRD §14)

Next.js App Router + TypeScript · Tailwind + shadcn/ui · Prisma on Supabase Postgres · Zod · Supabase Storage + Realtime · jose (signed cookies/links) · qrcode + html5-qrcode · Leaflet/OSM · Upstash QStash · Termii SMS · WhatsApp Cloud API · Interswitch Web Checkout · Serwist (PWA, added in 09) · Vercel + Sentry. Package manager: **npm** (decided; ships with Node, no extra setup on Windows). Commit `package-lock.json`.

## Slices

| Slice | Pri | Work | Check |
|---|---|---|---|
| sl1 | P0 | Next.js + TS + Tailwind + shadcn init; folder layout from WORKFLOW §6 (empty `index.ts`/`.gitkeep` per owned folder); `.env.example` with every key: `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `AUTH_JWT_SECRET`, `LINK_SIGNING_SECRET`, `ROOT_DOMAIN` (`parktrack.ng` / `localhost:3000`), `ISW_MERCHANT_CODE`, `ISW_PAY_ITEM_ID`, `ISW_CLIENT_ID`, `ISW_SECRET`, `ISW_BASE_URL`, `ISW_WEBHOOK_SECRET`, `TERMII_API_KEY`, `TERMII_SENDER_ID`, `WA_PHONE_NUMBER_ID`, `WA_TOKEN`, `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`, `SENTRY_DSN`, `NOTIFY_MODE` (`console`/`live`) | `npm run dev` boots; `npm run build` passes; no secret committed |
| sl2 | P0 | **CI and branch rules**: `.github/workflows/ci.yml` running on PRs into `main` and `scope/*` (typecheck, lint, test, build) as the `ci` check; optional `scope-gate` job that fails a `scope/NN-*` → `main` PR while tag `scope-(NN-1)-done` is missing (`contract/*` exempt); `pull_request_template.md`; owner applies Rulesets A and B from WORKFLOW §3 | A direct push to `main` or `scope/01-foundation` is rejected; a slice PR runs `ci`; a collaborator can't merge into `main` |
| sl3 | P0 | **Design tokens** from Foundations into Tailwind theme + CSS vars: zinc neutrals (`--fg #09090B`, `--fg-2 #52525B`, `--fg-3 #6B6B74`, `--bg #FAFAFA`, `--panel #FFF`, `--sunken #F4F4F5`, `--line #E8E8EB`, `--line-strong #D4D4D8`, `--hover #EFEFF1`), Volt accent (`#D4F86A`, ink `#1A2E05`, soft `#F4FDD6`), status colours (blue moving, amber action, green done, red problem, each with `-bg`/`-fg`), radii **6/8/12/16 only**, 4 px spacing grid, shadows; Geist + Geist Mono via `next/font`; type scale (Title 20/28 600 −2%, Heading 17/24 600, Body 15/22, Secondary 13/18, Caption 12/16 500, Amount 28/34 600 tabular, Code mono 15 600) | Computed styles in the browser match the Foundations values (fonts, sizes, colours, only the four radii). No page is committed for this |
| sl4 | P0 | **UI primitives** in `src/components/ui/`: Button (primary ink, secondary, ghost, danger; Volt only for scanner/brand), Input with label-above/hint-below at 44 px, PhoneInput (+234), OTPInput (6 boxes), SegmentedControl, Chip/ChipGroup, Toggle/Switch, Select, StatusBadge (dot + label for every parcel status), ListRow, Card, Notice (amber/blue/red/green), Timeline (done/current/upcoming nodes), BottomTabs, Sheet, Money (`₦` + tabular), Code (mono), Avatar initials, KPI tile, DataTable (admin), Sidebar shell (admin) | Each primitive checked in a **local-only** preview route (`src/app/dev-preview/`, git-excluded, never committed); status badge readable in greyscale |
| sl5 | P0 | **Shared widgets**: `QRCodeView` (qrcode), `QRScanner` (html5-qrcode, camera permission + "type the code instead" fallback), `PhotoCapture` (camera input, client-side compression to ≤200 KB, returns a Blob; upload is Scope 03), `MobileShell` (390 px app frame with top bar + bottom tabs), `ConsoleShell` (admin sidebar layout from P01) | Scanner reads a QR from a second phone on `localhost` over HTTPS tunnel; photo compresses a 4 MB image under 200 KB |
| sl6 | P0 | **Prisma schema** for every PRD §12 entity **plus the additions below**; first migration; Prisma client in `src/lib/db.ts` | `prisma migrate dev` creates all tables on Supabase |
| sl7 | P0 | **Seed** (`prisma/seed.ts`, idempotent): parks `ogbomoso` (Ogbomoso Motor Park) and `ibadan` (Iwo Road Park), route Ogbomoso → Ibadan (1h 30m; S ₦1,500 / M ₦2,500 / L ₦4,000) with roadside point **Owode junction, Oyo**, the reverse route, storage ₦300/day all sizes, window 24 h, max hold 7 days, drop-off deadline 48 h; users from the designs: sender/vendor Tolu Adeyemi (Tolu's Fabrics), recipients Kemi Bakare & Dayo Alabi as saved recipients, origin agent Bayo Kareem, arrival agent Funmi Adebayo, drivers Musa Ibrahim (OYO 482 KJ, on app) & Sule Bello (no app), park admin Adewale Ojo, one platform admin | Running seed twice changes nothing; counts match |
| sl8 | P0 | **Contracts** in `src/contracts/`: `enums.ts` (roles, parcel status, delivery mode, size class, payment purpose/status, ledger account, event type, notification event, dispute type), `states.ts` (the allowed-transition table from PRD §8, exported as data), `money.ts` types (`Kobo` branded int), `api/*.ts` zod request/response for **every** route in PRD §13 + the extra routes listed in scopes 04–09, `dto.ts` (ParcelSummary, ParcelDetail, TrackingView, DriverLoad, Manifest, StoreItem, LedgerEntry, ParkPublic) | Types compile; every API route in the scope files has a schema |
| sl9 | P0 | **Lib helpers** in `src/lib/`: `env.ts` (zod-validated env, server/client split), `money.ts` (`toKobo`, `formatNaira`, no floats), `ids.ts` (`publicId()` 128-bit url-safe random, `parcelCode()` → `PT-XXXX` from an unambiguous alphabet without 0/O/1/I, `manifestToken()`, `parkCounterToken()`), `dates.ts` (Africa/Lagos formatting, "1 day 22 hours left"), `sign.ts` (jose sign/verify helpers used by 02) | Unit tests for every helper; `parcelCode()` never emits `0 O 1 I` |
| sl10 | P0 | **Service stubs** (`src/server/<module>/index.ts`) with final exported signatures and fixture/in-memory behaviour, one per module listed in WORKFLOW §6: `auth`, `parks`, `parcels` (`createDraft`, `transition`, `quote`, `issueCollectionCode`, `verifyCollectionCode`, `storageDues`), `notify` (`notify(event, parcelId, extra)`), `uploads`, `payments` (`startPayment`, `handleCallback`, `handleWebhook`, `requery`), `ledger` (`settleParcel`, `balances`, `entries`), `booking`, `recipients`, `vendors`, `handshake`, `dropoff`, `assignment`, `trips`, `roadside`, `tracking`, `arrival`, `collection`, `admin`, `jobs`, `disputes` | A throwaway script calls every stub and gets typed fixture data |
| sl11 | P0 | **API fixtures** in `src/mocks/` (one per DTO, built from the design copy: PT-7K3Q, PT-4M8C, Musa Ibrahim, Bay C4, ₦2,650 etc.) | Fixtures type-check against `src/contracts` |
| sl12 | P0 | `docs/` stays as is; root `README.md` with setup steps (env, `npm install`, `prisma migrate`, seed, `ogbomoso.localhost:3000`) | Fresh clone reaches the dev server by following the README |

## Schema additions decided here (gaps in PRD §12)

These come from the designs; all are additive and already reflected in [open-questions.md](../reference/open-questions.md).

| Table | Add | Why |
|---|---|---|
| `parks` | `opening_hours` (exists), `counter_location_text`, `driver_share_bps` (default 6000), `storage_park_share_bps` (default 8000) | Ledger in P03 shows fare split driver ₦1,800 / park ₦1,200 of ₦3,000, storage ₦480 / ₦120 |
| platform settings (`settings` table, single row) | `platform_fee_kobo` (15000), `pod_fee_bps` (125), `pod_limit_kobo` (20,000,000) | ₦150 service fee and 1.25% POD fee in designs; ₦200,000 POD cap (PRD §9) |
| `roadside_points` (new table instead of JSON) | `id, route_id, name, lat, lng, order, minutes_from_origin` | Driver stop list, ETA and recipient "Owode junction" screens |
| `trips` | `scheduled_departure_at`, `vehicle_plate`, `status`, `origin_park_id`, `destination_park_id` | A01/A07 "Departs 10:30 AM", "alerted at 10:15" |
| `handshakes` | `agent_qr_token`, `sms_code_hash`, `sms_attempts` | Agent-shows-QR and SMS-code handshake paths |
| `collection_codes` | `purpose` (`roadside`/`counter`), `sent_to_phone`, `collector_kind` (`recipient`/`delegate`), `collector_photo_url` | Roadside code (R02) vs counter code (R05); delegate release (V04) |
| `parcels` | `tracking_link_id`, `bay`, `damaged`, `locked`, `refused_reason`, `draft_expires_at` | R03/V03 bay; V05 locked; S06 "booking saved for 24 hours" |
| `payments` | `payer_phone`, `checkout_url`, `requery_count`, `next_requery_at` | P07 payments monitor "Pending requery · next check 10:40" |
| `otp_codes` (new) | `phone, code_hash, attempts, expires_at, channel` | Phone sign-in (AUTH-1) |
| `staff_invites` (new, P1) | `park_id, phone, role, status` | P04 "Invited · Pending" |

## Out of scope

Feature screens, real Interswitch/Termii/WhatsApp calls, `src/proxy.ts` (subdomain routing), auth logic, PWA.

## Definition of done

WORKFLOW §8 (scope PR → `main`), plus: every other scope can start immediately by importing `@/contracts`, `@/components/ui` and `@/server/<module>` without creating anything outside its own folders.
