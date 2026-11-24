# Scope 03 — Parcel engine & notifications

| | |
|---|---|
| Branch | `scope/03-parcel-engine` (slices: `s03/slN-name` → PR into `scope/03-parcel-engine`; slice branches are deleted once this scope is merged into `main`) |
| Merges after | Scope 02 is merged into `main` and tagged `scope-02-done` |
| Unblocks | 04 (payment → status), 05–09 (every status change, code, photo, message) |
| Design source | none (backend); copy for messages comes from the design screens and PRD §11 |
| PRD | §8 lifecycle, §9 business rules, §11 notifications, HS-1, HS-6 (photo storage), HS-7 (send-after-handshake rule), COL-2, COL-4 (lock logic), COL-6, BOOK-4 (quote maths), BOOK-8, NOT-1, NOT-2, NFR auditability |

## Goal

One place that owns the rules of a parcel: which status can follow which, who may do it, what gets recorded, what it costs, which codes exist, and who gets told. Feature scopes call these functions; they never update `parcels.status` or send a message themselves.

## Owned paths

```
src/server/parcels/**        # state machine, events, quote, drafts, codes, storage dues
src/server/notify/**         # templates (EN + Pidgin), channels, Termii, WhatsApp, notifications log
src/server/uploads/**        # private Supabase Storage buckets, signed uploads
src/app/api/uploads/**       # POST /api/uploads, GET /api/uploads/view/[...path]
src/features/parcel-engine/**   (dev-only inspector page, optional; not built)
```

## Server API (`@/server/parcels`, `@/server/notify`, `@/server/uploads`)

| Function | Rules (as built) |
|---|---|
| `transition(parcelId, to, {actor, userId?}, {lat,lng,photoUrl,note,eventType,meta})` | Allowed only per `src/contracts/states.ts`. The actor must be allowed by the table, act as their own ACTIVE role, and pass tenancy: the parcel's sender, a driver carrying it, staff of the right park (origin for drop-off/assign/cancel, destination for tick-off/release/returns, either for park admins closing disputes). One DB transaction: status updated only if still `from` (two taps can't both win) + `parcel_events` row. Paying sets `dropoffDeadline` from the origin park's `dropoffDeadlineHours`. After commit, the PRD §11 message for the move (`after()` in a request); `arrived_at_park` sets `arrivalNotifiedAt` (starts the free storage window). Errors: `ParcelError` `parcel_not_found` 404, `transition_not_allowed` 409, `actor_not_allowed` 403, `status_changed` 409 |
| `changeDeliveryMode(parcelId, "PARK", actor)` | Roadside **Missed**: roadside parcel `IN_TRANSIT` only, driver carrying it (or SYSTEM); mode → PARK, event `ROADSIDE_MISSED`, message `roadside_missed` |
| `createDraft(input)` | Validates `BookingInput`; refuses prohibited items typed into the description (whole-word list from PRD §6.5, Q41); normalises the recipient phone; live route between live parks; roadside point must be on the route; snapshots the quote; random `publicId` (QR) + unique `PT-XXXX` (retry on clash); `DRAFT` kept 24 h; `CREATED` event |
| `quote({routeId, size, podKobo})` | Fare by size + `settings.platformFeeKobo` (₦150); insurance 0, no line (Q13); POD not in the sender's total, capped by `settings.podLimitKobo` (₦200,000). Lines: "Fare · Medium", "Service fee". Ogbomoso→Ibadan Medium = ₦2,650 |
| `issueCollectionCode(parcelId, purpose)` | 6 digits, keyed hash bound to parcel + purpose. COUNTER: 10 min, only when ARRIVED/UNCLAIMED. ROADSIDE: no clock, only for a roadside parcel ASSIGNED/IN_TRANSIT (Q4, Q5). Cancels earlier codes; refused within 30 s or when the parcel is locked (Q38). Event `COLLECTION_CODE_ISSUED` (never the code); code goes to the recipient with `collection_started`. Returns masked phone + expiry |
| `verifyCollectionCode(parcelId, code, purpose)` | Right code used once (`code_used` after); wrong codes count per parcel and purpose across reissues; the 5th locks the parcel (`locked = true`, NOTE event, COL-4). Row lock: checks for one parcel run one at a time. Expired counter code / roadside code after the trip or Missed → `code_expired`. Returns `{ok, attemptsLeft, locked}` |
| `storageDues(parcelId, at)` | Free window from `arrivalNotifiedAt` for the destination park's `storageWindowHours` (24); then the park's daily rate for the size (`storage_rates`, latest effective) per **started** day; stops at `maxHoldDays` (7) from the notice and at collection; days already paid (`storagePaidUntil`) not charged again. Computed on read |
| `notify(event, parcelId, extra?)` | PRD §11 matrix (30 templates) in English or Pidgin per person; sender, recipient, driver on the parcel's latest trip, active agents of the origin/destination park, park admins of both. Recipient hears nothing before the drop-off handshake (HS-7). Each person's preferred channel, then the other; every attempt logged in `notifications` (template, channel, status, error; never the text). Never throws |
| `sendCode(phone, code, channel)` | Sign-in and handshake codes; WhatsApp code template or SMS; Pidgin if that phone's account chose it; returns the channel that delivered it |
| `createSignedUpload({kind, parcelId, contentType, sizeBytes})` | Private bucket per kind (`parcel-dropoff`, `parcel-damage`, `parcel-release`, `parcel-collector`), created on first use, JPEG ≤ 500 KB; object `{parcelId}/{random}.jpg`. Returns `uploadUrl` (browser PUTs the JPEG), `path`, and `publicUrl` = `/api/uploads/view/{path}` (Q35) |

Routes: `POST /api/uploads` (agents / park admins of the right park: origin for drop-off photos, arrival park for the rest; 503 `uploads_unavailable` when Storage isn't set up) and `GET /api/uploads/view/{bucket}/{parcel}/{file}.jpg` (redirect to a 1-minute Storage link for anyone allowed to see the parcel, or the recipient with `?t=<tracking token>`; 404 otherwise).

## Notification matrix (PRD §11)

booking_paid · dropoff_deadline_near · handshake_complete (recipient tracking link — **only** from here, HS-7) · assigned · load_accepted · bus_approaching · delivered_roadside · roadside_missed · arrived_at_park · storage_reminder · collection_started (code) · collected · missing_at_tickoff · payment_receipt. `transition()` sends the status-change ones; the others (deadline near, bus approaching, storage reminder, collection code, roadside missed, receipt) are sent by the code that causes them. Links: sender → `{park}.parktrack.ng/parcels/{code}` (booking page for paid/deadline), recipient → `parktrack.ng/t/{token}`, driver → `app.…/driver`, agents → `app.…/counter` or `app.…/arrivals`, park admin → `app.…/park`.

## Channels and settings

| Setting | Meaning |
|---|---|
| `NOTIFY_MODE` | `console` (default): messages printed to the server log, logged as CONSOLE; 6-digit codes blanked in production. `live`: WhatsApp / SMS |
| `TERMII_API_KEY`, `TERMII_SENDER_ID`, `TERMII_BASE_URL`, `TERMII_CHANNEL` | Termii SMS (Q37). The base URL is account-specific (dashboard). Channel `dnd` (default) reaches Do-Not-Disturb numbers; Termii activates it per account |
| `WA_PHONE_NUMBER_ID`, `WA_TOKEN` | WhatsApp Cloud API, Graph v27.0, system-user token (Q36) |
| `SUPABASE_URL` (or `NEXT_PUBLIC_SUPABASE_URL`), `SUPABASE_SECRET_KEY` (or legacy `SUPABASE_SERVICE_ROLE_KEY`) | Server-only Storage client for photos |

WhatsApp templates to create in WhatsApp Manager (Q36):

| Name | Category | Language | Body |
|---|---|---|---|
| `parktrack_update` | Utility | English | `Update from ParkTrack: {{1}} Thanks for using ParkTrack.` ({{1}} = the SMS text without "ParkTrack: ") |
| `parktrack_code` | Authentication | English | Meta's fixed code text + security recommendation, **no** expiry line, Copy code button |

## Slices

| Slice | Pri | Work | Check |
|---|---|---|---|
| sl1 | P0 | `transition()` + `parcel_events`: transition table enforcement, role and tenancy checks, transaction, event row with actor/time/location; `changeDeliveryMode` | Every allowed transition accepted for exactly its actors, every other pair rejected; full parcel life on a real DB |
| sl2 | P0 | `createDraft()` + `quote()` with seeded fares and settings | Ogbomoso→Ibadan Medium = ₦2,500 + ₦150 = ₦2,650 (matches S04) |
| sl3 | P0 | Collection codes: issue / verify / lock / void-on-reissue, hashed | 5 wrong attempts lock; expired code rejected; reissue voids the old code; 6 parallel guesses count 5 |
| sl4 | P0 | `storageDues()` | Arrived-notified 2:10 PM, collected next day 3:00 PM → ₦300 (Medium); within window → ₦0 |
| sl5 | P0 | Notify core: template registry for the §11 matrix, `notifications` log, console channel | Every event renders a message with the parcel code and the right link |
| sl6 | P0 | Termii SMS adapter (account base URL, `dnd`, SMS-safe text) | A real SMS reaches a test phone (pending sender ID) |
| sl7 | P0 | WhatsApp Cloud API adapter with the two templates; automatic SMS fallback on any error | Failure falls back to SMS and logs both attempts |
| sl8 | P0 | Uploads: private buckets, signed upload URLs, 500 KB, view route with access checks | Photo lands in Storage; only allowed people can open it (pending secret key) |
| sl9 | P1 | Pidgin versions of every message; language from the profile | Pidgin message sent when profile language is Pidgin |
| sl10 | P0 | Wire-up: merge `main`; Scope 02 sign-in codes go through real `notify` (one log line, real channel reported) | Code arrives by WhatsApp or SMS (pending credentials) |

## Out of scope

Payment verification (04), any screen, scheduled reminders themselves (09 calls `notify` on a schedule), delivery-status webhooks from WhatsApp/Termii.

## Definition of done

WORKFLOW §8 (scope PR → `main`), plus: grep shows no `status:` writes to `parcels` outside `src/server/parcels/`.

## Status (Scope 03 built)

All 10 slices are built (PRs #26–#33 plus sl10 and sl9).

- `parcels`, `notify` and `uploads` are real (`STUB = false`); nothing outside `src/server/parcels/` writes a parcel's status.
- Verified on the local Prisma Postgres, because `parcel_events` is append-only and test parcels with history can't be removed from Supabase (Q44): full parcel life with refusals, drafts and quotes, collection codes including parallel guesses, storage dues, all messages for one parcel, Pidgin delivery.
- Verified against Supabase: upload and view access rules over HTTP (no photos stored); Termii key and base URL accepted by the read-only balance endpoint.
- Verified locally: 316 tests, typecheck, lint, format, production build.
- Not verified yet: a real SMS (Termii sender ID pending), a real WhatsApp message (Meta details and approved templates pending), a real photo upload (`SUPABASE_SECRET_KEY` pending), and the Pidgin wording by a native speaker.
