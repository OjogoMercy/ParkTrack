# Scope 02 — Parks, identity & access

| | |
|---|---|
| Branch | `scope/02-identity` (slices: `s02/slN-name` → PR into `scope/02-identity`; slice branches are deleted once this scope is merged into `main`) |
| Merges after | Scope 01 is merged into `main` and tagged `scope-01-done` |
| Unblocks | all signed-in screens (05–09) |
| Design source | Senderv2 **S02** (sign in), **S13** (park not found); console sign-in reuses S02 layout |
| PRD | §5, PARK-1 (read side), PARK-2, PARK-3, AUTH-1 … AUTH-5, NFR security/tenant separation |

## Goal

One network-wide account that works on every park subdomain; each park's pages resolve from the host; staff land on `app.parktrack.ng`; recipients act through signed links with no account; every server query can ask "who is this and which park are they tied to?".

## Owned paths

```
src/middleware.ts
src/server/auth/**            src/server/parks/**
src/app/sites/[park]/layout.tsx   src/app/sites/[park]/not-found.tsx   src/app/sites/[park]/signin/**
src/app/console/layout.tsx        src/app/console/signin/**
src/app/not-found-park/**         # unknown-subdomain page (S13)
src/app/api/auth/**               src/app/api/park/**
src/features/identity/**
```

## Routing model

| Host | Rewritten to | Who |
|---|---|---|
| `{slug}.parktrack.ng` / `{slug}.localhost:3000` | `/sites/{slug}/…` | Senders (public park page + booking) |
| `app.parktrack.ng` / `app.localhost:3000` | `/console/…` | Agents, drivers, park admins, platform admins |
| `parktrack.ng` / `localhost:3000` | `/` (marketing/placeholder) plus shared public paths `/t/*`, `/collect/*`, `/pay/*` | Recipients, payment returns |
| unknown slug | S13 "There's no park at this address" listing live parks | Anyone |
| reserved: `www`, `app`, `admin`, `api` | never treated as a park | — |

## API (contracts in `src/contracts/api/auth.ts`, `park.ts`)

| Method + path | Purpose |
|---|---|
| `POST /api/auth/otp` | `{phone, channel?: "whatsapp"|"sms"}` → sends 6-digit code via `notify` adapter (stub until 03), rate-limited (5/h per phone, 20/h per IP) |
| `POST /api/auth/verify` | `{phone, code}` → creates user if new (role `sender`, `signup_park_id` = current park), sets session cookie on `.ROOT_DOMAIN` |
| `POST /api/auth/signout` | clears cookie |
| `GET /api/park` | park from host: name, logo, address, opening hours, open/closed now, routes with fares by size, roadside points, storage rules, counter location |

## Server API for other scopes (`@/server/auth`, `@/server/parks`)

`getSession()`, `requireRole(...roles)`, `requireParkStaff(parkId)` (agent/park admin of that park), `currentPark()` (from host), `signRecipientLink(parcelId, purpose, ttl)` / `verifyRecipientLink(token)`, `parkScope(user)` → Prisma `where` fragment so every park-staff query is tenant-filtered.

## Slices

| Slice | Pri | Work | Check |
|---|---|---|---|
| sl1 | P0 | Middleware: host parsing (prod + `*.localhost`), reserved names, rewrite to `/sites/[park]` or `/console`; park lookup cached; unknown → S13 | `ogbomoso.localhost:3000` shows park layout; `ogbomosho.localhost:3000` shows S13 listing both parks; `app.localhost:3000` hits console |
| sl2 | P0 | `GET /api/park` + `currentPark()`; `sites/[park]/layout.tsx` with park header (initials avatar, name, subdomain, Sign in link) | Header matches S01 top bar |
| sl3 | P0 | OTP: `otp_codes` hashed, **6 digits (decided; S02 shows 6 boxes, not 4)**, 5-min expiry, 5 attempts, resend timer 30 s, WhatsApp first then "Send by SMS instead"; dev mode logs code to console | Wrong code ×5 locks; resend disabled for 30 s |
| sl4 | P0 | Session: jose-signed HTTP-only cookie, domain `.ROOT_DOMAIN`, 30-day rolling; `getSession`, `requireRole`; `signup_park_id` stored on first sign-in (AUTH-3) | Sign in on `ogbomoso.` then open `ibadan.`: still signed in; profile shows "Joined through Ogbomoso Motor Park" |
| sl5 | P0 | S02 sign-in screen (phone, OTP boxes, resend, SMS fallback, "Your account works on every ParkTrack park") with `?next=` return; console sign-in page for staff routes by role to `/console/counter`, `/console/arrivals`, `/console/driver`, `/console/park`, `/console/platform` | Each seeded staff user lands on their home |
| sl6 | P0 | Roles and tenancy: `requireRole`, `requireParkStaff`, `parkScope()`; unit tests proving an Ibadan agent can't read an Ogbomoso-only parcel (cross-park parcels visible to both origin and destination parks) | Tests pass |
| sl7 | P0 | Signed recipient links (AUTH-5): `signRecipientLink` (opaque id stored on parcel + jose signature, expiry), `verifyRecipientLink`; used later by `/t/[link]` and `/collect` | Tampered token rejected; expired token rejected |
| sl8 | P1 | Rate limits on OTP and (exported helper) for scan endpoints used by 06/08 | 6th request in window returns 429 |
| sl9 | P0 | Wire-up: rebase on `main`; replace `notify` stub calls only if Scope 03 already merged (otherwise stays on stub until 03 lands) | Sign-in works end to end on two subdomains |

## Out of scope

Profile editing and saved recipients (05), staff invites/deactivation (09, AUTH-6), real WhatsApp/SMS delivery (03).

## Definition of done

WORKFLOW §8 (scope PR → `main`), plus: S02 and S13 match the design at 390 px; no route under `/console` renders for a signed-out user.
