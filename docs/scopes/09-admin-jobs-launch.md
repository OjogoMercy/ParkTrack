# Scope 09 — Admin, jobs & launch

| | |
|---|---|
| Branch | `scope/09-admin-launch` (slices: `scope/09-admin-launch/slN-name` → PR into `scope/09-admin-launch`) |
| Merges after | Scope 08 is merged into `main` and tagged `scope-08-done` |
| Unblocks | the demo (feature freeze) |
| Design source | Park and platform admin **P01** overview, **P02** parcels with detail panel, **P03** ledger and settlement, **P04** agents and drivers, **P05** routes, fares and storage rules, **P06** counter QR poster (A4), **P07** platform admin: parks, payments, health |
| PRD | PARK-1 (admin edit), PARK-4, AUTH-6, DASH-4, DASH-5, DRV-5, BOOK-7, PAY-6 trigger, §6.5 (expiry, unclaimed, storage reminders), DIS-1/DIS-2 (P1), §14 PWA + hosting, §16 demo, §17 feature-freeze tasks |

## Goal

Park admins run their park (routes, fares, storage rules, team, counter poster) and see volumes and money; platform admins see all parks, payments and system health. Scheduled jobs handle time-based rules. Then ship: PWA for agents/drivers, wildcard domain on Vercel, Sentry, demo seed and rehearsal.

**Priority inside this scope:** P03 ledger view, P06 counter poster, P05 settings, deploy and demo seed are **P0** (the demo shows the ledger at 3:55 and needs a printed counter QR). The rest is P1.

## Owned paths

```
src/server/admin/**   src/server/jobs/**   src/server/disputes/**
src/app/console/park/**   src/app/console/platform/**
src/app/api/admin/**   src/app/api/dashboard/**   src/app/api/disputes/**
src/app/api/jobs/**      EXCEPT src/app/api/jobs/requery/** (owned by 04)
src/features/admin/**
PWA (Serwist) setup, manifest, icons; vercel.json; Sentry config files; scripts/**
docs/demo-checklist.md
```

## Routes (`app.parktrack.ng`)

| Route | Screen |
|---|---|
| `/console/park` | P01 overview: greeting, Today/7/30 days, KPIs (parcels today, on the road, waiting in store, park revenue), 14-day chart, Needs attention (load not accepted, missing at tick-off, uncollected 6 days, bookings expiring), live trips table |
| `/console/park/parcels` | P02 table with status filters + search (code, phone) + detail side panel (route, holder, sender, recipient, POD, timeline, drop-off/arrival photos, Event log, Payments tabs) |
| `/console/park/ledger` | P03 month KPIs (park share, driver fare shares, collected for vendors, refunds), entries table, filter, CSV export |
| `/console/park/team` | P04 agents and drivers, invite driver (AUTH-6), On app / No app, verified, trips |
| `/console/park/settings` | P05 routes & fares table (add/edit, roadside points), storage rules (window hours, S/M/L daily rate, max hold days, drop-off deadline hours), park page link + signup count, counter collection QR with Print poster / PNG |
| `/console/park/poster` | P06 A4 printable poster: "Collecting a parcel? Scan here." with the fixed counter QR (PARK-4) |
| `/console/platform` | P07 parks table (subdomain, volume, pay success, status, Add park), payments monitor (verified / duplicate ignored / failed / pending requery), system health (Interswitch latency, WhatsApp, Termii, QStash failures), open disputes |

## Scheduled jobs (QStash → `POST /api/jobs/*`, signature-verified)

| Job | Rule | Pri |
|---|---|---|
| `booking-expiry` | AWAITING_DROPOFF past `dropoff_deadline` (48 h) → CANCELLED + `refund()` (BOOK-7, PAY-6); reminder `dropoff_deadline_near` before | P1 (demo: show only) |
| `draft-expiry` | DRAFT older than 24 h → CANCELLED (S06 "saved for 24 hours") | P1 |
| `load-not-accepted` | ASSIGNED trips 15 min before `scheduled_departure_at` → notify agent + park admin (DRV-5, A07 "alerted at 10:15") | P1 |
| `storage-reminders` | before window ends, then daily (§11) | P1 |
| `unclaimed` | ARRIVED past max hold (7 days) → UNCLAIMED, contact sender | P1 |

## Slices

| Slice | Pri | Work | Check |
|---|---|---|---|
| sl1 | P0 | Console admin shell (sidebar from P01) + role routing for `park_admin` / `platform_admin` | Adewale lands on `/console/park` |
| sl2 | P0 | P03 ledger view from `@/server/ledger` (park-scoped) + CSV | After a demo run, P03 shows vendor, driver, park, platform credits (demo 3:55–4:20) |
| sl3 | P0 | P05 routes/fares/storage settings editing + counter QR token; P06 printable poster | Changing Medium fare changes S01/S03 quote; poster QR opens `/collect/{token}` |
| sl4 | P0 | **Deploy**: Vercel project, `*.parktrack.ng` wildcard with Vercel nameservers, env vars, Supabase prod project, migrations + seed; Sentry | `ogbomoso.parktrack.ng`, `ibadan.parktrack.ng`, `app.parktrack.ng` live over HTTPS |
| sl5 | P0 | PWA (Serwist) for `/console/*` (installable agent/driver app, icons, offline shell only) | "Add to home screen" works on Android Chrome |
| sl6 | P0 | Demo kit: `scripts/seed-demo.ts` (demo users, phones of team + judge slots, fresh parcels), `scripts/reset-demo.ts`, `docs/demo-checklist.md` (phones, sandbox cards, poster printed, backup video, Wi-Fi fallback) | Reset + full demo run twice in a row without manual fixes |
| sl7 | P1 | P01 overview + Needs attention + live trips; P02 parcels table + detail panel | KPIs match DB counts |
| sl8 | P1 | Jobs above, QStash schedules | Each job has a test that moves a seeded parcel correctly |
| sl9 | P1 | P04 team + invites (AUTH-6); P07 platform admin; disputes list/detail (DIS-1, DIS-2) | Invited driver can sign in and appears On app |
| sl10 | P0 | Final wire-up and feature freeze; tag `demo-freeze` | Tag exists; only bug-fix commits after it |

## Out of scope

Real payouts (PAY-7), insurance, analytics beyond P01, Yoruba/Hausa, offline actions.

## Definition of done

WORKFLOW §8 (scope PR → `main`), plus: the PRD §16.3 demo runs end to end on the deployed URLs, on real phones, twice in a row, with a backup video recorded.
