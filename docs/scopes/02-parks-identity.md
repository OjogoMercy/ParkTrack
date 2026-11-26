# Scope 02 — Parks, identity & access

| | |
|---|---|
| Branch | `scope/02-identity` (slices: `s02/slN-name` → PR into `scope/02-identity`; slice branches are deleted once this scope is merged into `main`) |
| Merges after | Scope 01 is merged into `main` and tagged `scope-01-done` |
| Unblocks | all signed-in screens (05–09) |
| Design source | Senderv2 **S02** (sign in), **S13** (park not found), S01/S08 top bar; console sign-in reuses S02 layout |
| PRD | §5, PARK-1 (read side), PARK-2, PARK-3, AUTH-1 … AUTH-5, NFR security/tenant separation |

> **Changed by [Q45](../reference/open-questions.md) (26 Nov 2026): one domain, one account type.** No park subdomains and no `app.` host: everything is on the main domain, with one sign-in for everyone. The routing model, paths and API below describe the current code; S13 and the separate console sign-in are gone.

## Goal

One account per phone, on one domain; parks have pages at `/parks/{slug}`; staff use the console at `/console`; recipients act through signed links with no account; every server query can ask "who is this and which park are they tied to?".

## Owned paths

```
src/proxy.ts                      # Next.js 16 renamed middleware.ts → proxy.ts (Node runtime, export `proxy`)
src/server/auth/**                src/server/parks/**
src/app/page.tsx                  src/app/signin/**                # home (find a park) and the one sign-in
src/app/console/page.tsx          src/app/console/layout.tsx
src/app/api/auth/**               src/app/api/park/**
src/features/identity/**          # park header, park finder, sign-in form, logo, redirects
```

## Routing model (Q45)

| Address | Serves | Who |
|---|---|---|
| `parktrack.ng/` | home: find a park (search by city), sign in | Anyone |
| `parktrack.ng/parks/{slug}` | the park's page (S01; placeholder until Scope 05); unknown or paused parks list the live parks instead | Anyone |
| `parktrack.ng/signin` | one sign-in for everyone (S02); afterwards staff go to their console home, everyone else to `?next=` or `/` | Anyone |
| `parktrack.ng/console/*` | staff console | Agents, drivers, park admins, platform admins |
| `parktrack.ng/{t,collect,pay}/*` | recipient links, counter collection, payment returns | Recipients, payers |
| old `{slug}.parktrack.ng/…` | 308 → `/parks/{slug}` (home) or the same path on the main domain | — |
| old `app.parktrack.ng/…` | 308 → `/console/…` | — |
| reserved or malformed subdomains | 308 → `/` | — |

The proxy only reads the Host header and the session cookie; it never queries the database. The park page checks the park exists inside its own `<Suspense>`.

Console guard: a signed-out visitor to any `/console` path is redirected to `/signin?next=<path>`. `/console` sends signed-in staff to their role's home: agent → `/console/counter`, driver → `/console/driver`, park admin → `/console/park`, platform admin → `/console/platform` (`consoleHome()` in `src/features/identity/redirects.ts`); a `USER` account goes home. There is one AGENT role; agents land on the counter and reach arrivals from there.

## API (contracts in `src/contracts/api.ts`: `AuthOtp`, `AuthVerify`, `AuthSignout`, `GetPark`)

| Method + path | Purpose |
|---|---|
| `POST /api/auth/otp` | `{phone, channel?: "WHATSAPP" \| "SMS"}` → sends a 6-digit code via the `notify` adapter (stub until 03; with `NOTIFY_MODE=console` the code is printed to the server log outside production). Anyone can get a code (one sign-in, Q45). `503 code_not_sent` when no channel delivered it. Limits: 5 codes per phone per hour, 20 requests per IP per hour, 30 s between codes on the same channel (`429 otp_rate_limited` / `rate_limited` / `otp_resend_too_soon`, each with `retryInSeconds` + `Retry-After`) |
| `POST /api/auth/verify` | `{phone, code}` → creates the account if new (role `USER`); staff sign in the same way. Sets the host-only session cookie. Errors: `otp_wrong` (+ `attemptsLeft`), `otp_locked`, `otp_expired`, `otp_missing`, `account_deactivated` |
| `POST /api/auth/signout` | clears the session cookie |
| `GET /api/park?slug=` | the park by slug: name, address, opening hours, open/closed now, routes with fares by size, roadside points, storage rules, counter location. `404 park_not_found` otherwise; `Cache-Control: no-store` |

All errors use the shared `ApiError` shape (`{ error: { code, message, fields? } }`); messages are written for the person using the app.

## Server API for other scopes (`@/server/auth`, `@/server/parks`)

| Function | Use |
|---|---|
| `getSession()` | Current user or null. Reads cookies: call inside `<Suspense>`, never at the top of a layout. Re-checks the account is ACTIVE on every read |
| `requireRole(...roles)` | Throws `AuthError` `signed_out` (401) / `wrong_role` (403) |
| `requireParkStaff(parkId)` | Agent or park admin of that park, else `wrong_role` / `wrong_park` (403). Platform admins use `requireRole("PLATFORM_ADMIN")` |
| `parkScope(user)` | Prisma `where` to AND into every parcel query made for a signed-in person (rules below) |
| `canSeeParcel(user, parcel)` | Same rule for one loaded parcel |
| `signRecipientLink(parcelId, ttlSeconds = 14 days)` / `verifyRecipientLink(token)` / `revokeRecipientLinks(parcelId)` | Recipient links for `/t/[link]` and `/collect` (AUTH-5) |
| `enforceRateLimit(bucket, key, rule)`, `RATE_LIMITS.scan`, `clientIp(headers)` | Rate limits for scan endpoints (06 handshake, 08 collection) |
| `sendOtp`, `verifyOtp`, `sendStaffOtp`, `verifyStaffOtp`, `checkSignInCode`, `signOut` | Sign-in (used by the auth routes) |
| `AuthError` (`.toResponse()`), `invalidInputResponse(zodError)` | Errors for route handlers |
| `getPark(slug)` (cached, for pages), `getParkPublic(slug)` (with open-now, for APIs), `listLiveParks()` | Parks |
| `ParkHeader` (`@/features/identity/park-header`) | S01/S08 top bar; pages pass it to `<MobileShell topBar>`. Shows "Sign in" or the signed-in person's initials (→ `/account`) |

Tenancy (`parkScope` / `canSeeParcel`): platform admin sees every parcel; agent and park admin see parcels leaving from or arriving at their park (a cross-park parcel is visible to both parks); driver sees only parcels loaded on their own trips; sender sees only parcels they sent; staff without a park see nothing.

## Slices

| Slice | Pri | Work | Check |
|---|---|---|---|
| sl1 | P0 | `src/proxy.ts` (Next 16 replaces `middleware.ts`; read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` first): host parsing (prod + `*.localhost`), reserved names, rewrite to `/sites/[park]` or `/console`; park lookup cached; unknown → S13 | `ogbomoso.localhost:3000` shows the park; `ogbomosho.localhost:3000` shows S13 listing both parks; `app.localhost:3000` hits console |
| sl2 | P0 | `GET /api/park` + `currentPark()`; `ParkHeader` component (initials tile, name, subdomain, Sign in) that pages pass to `MobileShell`; client "Open now" badge so park pages stay cached | Header matches S01 top bar |
| sl3 | P0 | OTP: `otp_codes` hashed, **6 digits (decided; S02 shows 6 boxes, not 4)**, 5-min expiry, 5 attempts (taken atomically before comparing), resend timer 30 s, WhatsApp first then "Send by SMS instead"; dev mode logs code to console | Wrong code ×5 locks; resend disabled for 30 s |
| sl4 | P0 | Session: jose-signed HTTP-only cookie (user id only), domain `ROOT_DOMAIN`, 30-day rolling (proxy re-issues once a day); `getSession`, `requireRole`; `signup_park_id` stored on first sign-in (AUTH-3) | Sign in on `ogbomoso.` then open `ibadan.`: still signed in. Locally needs `ROOT_DOMAIN=parktrack.localhost:3000` (Q27) |
| sl5 | P0 | S02 sign-in screen (phone, OTP boxes that submit on the 6th digit, resend, SMS fallback, "Your account works on every ParkTrack park") with `?next=` return (on-site paths only); console sign-in for staff only, routing by role to `/counter` (agents, Q29), `/driver`, `/park`, `/platform`; console guard in the proxy | Each seeded staff user lands on their home; a sender or unknown phone is refused on the console |
| sl6 | P0 | Roles and tenancy: `requireRole`, `requireParkStaff`, `parkScope()`, `canSeeParcel()`; tests proving an Ibadan agent can't read an Ogbomoso-only parcel (cross-park parcels visible to both origin and destination parks) | Tests pass, and the same rules checked with real queries |
| sl7 | P0 | Signed recipient links (AUTH-5): `signRecipientLink` (random `trackingLinkId` stored on the parcel + HMAC signature + expiry, ~50 characters so it fits an SMS; Q28), `verifyRecipientLink`, `revokeRecipientLinks`; used later by `/t/[link]` and `/collect` | Tampered token rejected; expired token rejected; revoked token rejected |
| sl8 | P1 | Rate limits on OTP (5/h per phone from `otp_codes`; 20/h per IP) and an exported helper for scan endpoints used by 06/08 (Q31) | 6th request in window returns 429 |
| sl9 | P0 | Wire-up: merge `main`; header shows the signed-in person; replace `notify` stub calls only if Scope 03 already merged (otherwise stays on stub until 03 lands) | Sign-in works end to end on two subdomains |

## Out of scope

Profile editing and saved recipients (05), staff invites/deactivation (09, AUTH-6), real WhatsApp/SMS delivery (03).

## Definition of done

WORKFLOW §8 (scope PR → `main`), plus: S02 and S13 match the design at 390 px; no route under `/console` renders for a signed-out user.

## Status (Scope 02 built)

All 9 slices are built and merged into `scope/02-identity` (PRs #14–#22).

- Verified on the real Supabase project (migration and seed applied; transaction pooler for the app, session pooler for migrations, Q32): sign-in end to end on two park subdomains and the console with every seeded role, tenancy with real queries, recipient links, rate limits through the real handler. Test data was removed after each check.
- Verified locally: 184 tests, typecheck, lint, format, production build.
- Still on stubs from other scopes: `notify` (03), so codes reach the server log, not phones. Role home pages (`/counter`, `/driver`, `/park`, `/platform`), `/send` and `/account` are 404 until Scopes 05–09 build them.
- Not verified yet: CI on the scope PR to `main`, and sign-in on a real phone over a real domain.
