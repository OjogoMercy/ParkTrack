# Scope 03 — Parcel engine & notifications

| | |
|---|---|
| Branch | `scope/03-parcel-engine` (slices: `scope/03-parcel-engine/slN-name` → PR into `scope/03-parcel-engine`) |
| Merges after | Scope 02 is merged into `main` and tagged `scope-02-done` |
| Unblocks | 04 (payment → status), 05–09 (every status change, code, photo, message) |
| Design source | none (backend); copy for messages comes from the design screens and PRD §11 |
| PRD | §8 lifecycle, §9 business rules, §11 notifications, HS-1, HS-6 (photo storage), HS-7 (send-after-handshake rule), COL-2, COL-4 (lock logic), COL-6, BOOK-4 (quote maths), NOT-1, NFR auditability |

## Goal

One place that owns the rules of a parcel: which status can follow which, who may do it, what gets recorded, what it costs, which codes exist, and who gets told. Feature scopes call these functions; they never update `parcels.status` or send a message themselves.

## Owned paths

```
src/server/parcels/**        # state machine, events, quote, codes, storage dues
src/server/notify/**         # templates, channel adapters, notifications log
src/server/uploads/**        # Supabase Storage signed uploads
src/app/api/uploads/**
src/features/parcel-engine/**   (dev-only inspector page, optional)
```

## Server API (`@/server/parcels`, `@/server/notify`, `@/server/uploads`)

| Function | Rules |
|---|---|
| `createDraft(input, actor)` | Validates against `src/contracts`; blocks prohibited categories (BOOK-8); assigns `publicId` + unique `parcelCode` (`PT-XXXX`); status `DRAFT`; `draft_expires_at` = now + 24 h |
| `quote({routeId, size, insured, podKobo})` | fare by size + platform fee (₦150) (+ insurance, disabled for hackathon); POD ≤ ₦200,000; returns line items exactly as S03/S04 show them |
| `transition(parcelId, to, actor, {lat,lng,photoUrl,note,meta})` | Allowed only per `src/contracts/states.ts`; role check per transition; one DB transaction: update status + insert `parcel_events` row; fires the matching notification(s) after commit |
| `changeDeliveryMode(parcelId, "park", actor)` | Used by roadside **Missed**: stays `IN_TRANSIT`, mode → park, event `roadside_missed` |
| `issueCollectionCode(parcelId, purpose)` | 6 digits, stored hashed; `counter` codes expire after 10 min (re-request allowed, old code voided); `roadside` codes valid until the trip ends (see open questions); sends to recipient phone (WhatsApp + SMS) |
| `verifyCollectionCode(parcelId, code, purpose)` | Counts attempts; locks parcel after 5 wrong (`locked = true`, COL-4); returns remaining attempts |
| `storageDues(parcelId, at)` | 0 inside the free window (starts at the **arrival notification time**, not arrival); then daily rate by size per started day; capped at max-hold; computed on read (no accrual job needed) |
| `notify(event, parcelId, extra?)` | Looks up the PRD §11 matrix, renders template, sends WhatsApp → falls back to Termii SMS; logs to `notifications`; `NOTIFY_MODE=console` prints instead of sending |
| `uploads.createSignedUpload(kind, parcelId)` | Supabase Storage signed URL for `dropoff`, `arrival_damage`, `release`, `collector`; returns final public-ish URL stored on the event |

## Notification matrix to implement (PRD §11)

booking_paid · dropoff_deadline_near · handshake_complete (recipient tracking link — **only** here, HS-7) · assigned · load_accepted · bus_approaching · delivered_roadside · roadside_missed · arrived_at_park · storage_reminder · collection_started (code) · collected · missing_at_tickoff. English first; Pidgin is P1 (NOT-2).

## Slices

| Slice | Pri | Work | Check |
|---|---|---|---|
| sl1 | P0 | `transition()` + `parcel_events`: transition table enforcement, role checks, transaction, event row with actor/time/location | Unit test runs every allowed transition and rejects every other pair |
| sl2 | P0 | `createDraft()` + `quote()` with seeded fares and settings | Ogbomoso→Ibadan Medium = ₦2,500 + ₦150 = ₦2,650 (matches S04) |
| sl3 | P0 | Collection codes: issue / verify / lock / void-on-reissue, hashed | 5 wrong attempts lock; expired code rejected; reissue voids the old code |
| sl4 | P0 | `storageDues()` | Arrived-notified 2:10 PM, collected next day 3:00 PM → ₦300 (Medium) ; within window → ₦0 (matches R03/R04/V03) |
| sl5 | P0 | Notify core: template registry for the §11 matrix, `notifications` log, console channel | Every event renders a message containing the parcel code and correct link |
| sl6 | P0 | Termii SMS adapter (sender ID) | A real SMS reaches a test phone |
| sl7 | P0 | WhatsApp Cloud API adapter with approved templates; automatic SMS fallback on error/unapproved | Failure path falls back to SMS and logs both attempts |
| sl8 | P0 | Uploads: signed upload URLs, bucket per kind, size limit 500 KB, URL saved on event | Photo from `PhotoCapture` lands in Storage and the event has its URL |
| sl9 | P1 | Pidgin template variants; language from user profile | Pidgin message sent when profile language is Pidgin |
| sl10 | P0 | Wire-up: rebase; replace any remaining stub internals; Scope 02 OTP now sends through real `notify` | OTP arrives by WhatsApp or SMS |

## Out of scope

Payment verification (04), any screen, scheduled reminders themselves (09 calls `notify` on a schedule).

## Definition of done

WORKFLOW §8 (scope PR → `main`), plus: grep shows no `status:` writes to `parcels` outside `src/server/parcels/`.
