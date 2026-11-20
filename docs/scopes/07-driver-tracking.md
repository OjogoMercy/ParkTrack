# Scope 07 — Driver, roadside & tracking

| | |
|---|---|
| Branch | `scope/07-driver` (slices: `s07/slN-name` → PR into `scope/07-driver`; slice branches are deleted once this scope is merged into `main`) |
| Merges after | Scope 06 is merged into `main` and tagged `scope-06-done` |
| Unblocks | 08 (manifests exist; parcels IN_TRANSIT) |
| Design source | Driver **D01** load to accept, **D02** trip in progress, **D03** roadside handover with code, **D04** mark as missed, **D05** manifest QR, **D06** earnings; Senderv2 **S09** awaiting drop-off, **S10** in transit with live map, **S11** collected / proof of delivery; Recipient **R01** bus approaching + pay dues, **R02** paid + handover code, **R03** ready to collect |
| PRD | §6.1 step 6, §6.2 roadside, DRV-3, DRV-4, DRV-6, DRV-7 (simulated), RD-1 … RD-5, TRK-1 … TRK-4, DASH-2, §6.4 (roadside settlement) |

## Goal

The driver never scans. They see the load in route order, tap **Accept load** once (becoming the holder), share location while the app is open (simulated for the demo), hand roadside parcels over by entering the recipient's code (only after any POD is prepaid), mark Missed when needed, and show **one manifest QR** at the arrival park. Senders and recipients follow it all on tracking pages.

## Owned paths

```
src/server/trips/**   src/server/roadside/**   src/server/tracking/**
src/app/console/driver/**
src/app/t/**                                         # recipient tracking link pages
src/app/sites/[park]/(sender)/parcels/[code]/**      # sender parcel detail
src/app/api/driver/**   src/app/api/trips/**   src/app/api/track/**
src/app/api/parcels/[id]/roadside/**
src/app/api/parcels/[id]/cancel/**                   # S09 "Cancel booking · full refund"
src/features/driver/**   src/features/tracking/**    # incl. Leaflet map, ETA, route-stop strip
```

## Routes

| Route | Screen |
|---|---|
| `/console/driver` | D01 load to accept (parcels grouped by stop in route order: roadside stops with Paid/Not paid yet, arrival park list), "When you accept, you become the holder…", Accept load · N parcels |
| `/console/driver/trip` | D02 trip: Sharing location, next stop + ETA, roadside handovers (Ready / Dues unpaid), stop timeline, Manifest QR, Call park; tabs Trip · Earnings · Me |
| `/console/driver/handover/[code]` | D03 keypad for the 6-digit code, Confirm handover (disabled while dues unpaid), "Recipient isn't here" → D04 sheet (Not at the stop / Code didn't match → Mark missed, keep on bus / Keep waiting) |
| `/console/driver/manifest` | D05 manifest QR (token only) for every parcel still on the bus + list |
| `/console/driver/earnings` | D06 week/month total, bars by day, trips with credited amounts (from `@/server/ledger`) |
| `{park}.parktrack.ng/parcels/[code]` | S09 awaiting drop-off (QR, countdown, timeline, cancel), S10 in transit (live map, ETA, driver + plate + Verified, timeline, drop-off photo, POD status), S11 collected (proof of delivery, photos, code verified, released by, money breakdown, receipt, Report issue) |
| `parktrack.ng/t/[link]` | R01 roadside approaching (stop strip, driver, "₦X due before handover … Drivers never take cash", Pay), R02 handover code shown after paying + "Can't make it?", R03 ready to collect (park, arrival time, free pickup until, bay, due on collection, how-to-collect steps, share link for delegate) |

## API

| Method + path | Purpose |
|---|---|
| `GET /api/driver/load` | driver's assigned parcels grouped by stop + manifest token (DRV-3, DRV-6) |
| `POST /api/trips/:id/accept` | all ASSIGNED parcels → IN_TRANSIT; creates `manifests` row per destination park; `notify(load_accepted)` to sender + recipient + origin agent (DRV-4) |
| `POST /api/trips/:id/location` | location point every 30–60 s while app open (DRV-7); **demo:** a "simulate trip" dev control advances along the route polyline |
| `POST /api/trips/:id/simulate` | dev/demo only: plays the route, fires `bus_approaching` at ~20 min from each roadside point (RD-2) |
| `POST /api/parcels/:id/roadside` | `{action: handover, code}` → requires POD paid (RD-3), `verifyCollectionCode(roadside)`, `transition(→ DELIVERED_ROADSIDE)`, `settleParcel` (04), notify; `{action: missed, reason}` → `changeDeliveryMode(park)` (RD-5), notify recipient where to collect + arrival agent |
| `GET /api/track/:link` | `TrackingView` for recipient (signed link, 02) — ETA to drop point, never the exact driver position (RD-1); after arrival: park, bay, driver name + plate (TRK-4); location stops at delivery |
| `GET /api/track/parcel/:code` | signed-in sender's `ParcelDetail` with timeline from `parcel_events` (TRK-1) |
| `POST /api/parcels/:id/cancel` | sender cancels before loading (status AWAITING_DROPOFF / RECEIVED_AT_ORIGIN) → CANCELLED + refund (04) |

## Slices

| Slice | Pri | Work | Check |
|---|---|---|---|
| sl1 | P0 | D01 load view + `GET /api/driver/load`, grouped and ordered by `roadside_points.order` then arrival park | Musa sees 2 roadside + 4 park parcels as in D01 |
| sl2 | P0 | Accept load → IN_TRANSIT + manifests + notifications | A07 (06) flips to "On the road"; sender & recipient get messages |
| sl3 | P0 | Tracking pages: sender `/parcels/[code]` (S09, S10, S11 states) and recipient `/t/[link]` (R01, R03) with Supabase Realtime updates | Timeline updates without reload when the driver accepts |
| sl4 | P0 | Simulated location + Leaflet/OSM map + ETA from route timing (RD-1, TRK-2 simulated, TRK-3 basic) | Map moves the bus on stage; recipient sees ETA, not coordinates (demo 2:05–2:35) |
| sl5 | P0 | D05 manifest QR + D02 trip screen | Manifest QR decodes to a random token only |
| sl6 | P0 | Roadside: R01 pay POD (calls 04 with signed link) → R02 shows code; D03 handover with code → DELIVERED_ROADSIDE → settle | Handover blocked while "Dues unpaid"; correct code delivers and ledger has entries |
| sl7 | P0 | D04 Missed → parcel becomes park collection; recipient told where to collect | Missed parcel appears on the manifest for Iwo Road |
| sl8 | P0 | D06 earnings from ledger | Credited trips match ledger rows |
| sl9 | P1 | Real browser geolocation (`watchPosition` while open), approach alerts from real position, S09 cancel + refund | Phone in a moving car updates ETA |
| sl10 | P0 | Wire-up: rebase; real 03/04/06 | Parcel assigned in 06 is accepted here and tracked end to end |

## Out of scope

Background GPS / native app (DRV-8, P2), manifest scanning & tick-off (08), recipient counter flow R04–R06 (08).

## Open decision

Roadside handover code lifetime: counter codes expire in 10 min, but a roadside code is shown after POD is paid, possibly an hour before the bus arrives (R02). Default: valid until the trip ends or the parcel is Missed. See open-questions Q4.

## Definition of done

WORKFLOW §8 (scope PR → `main`), plus: demo steps 2:05–2:35 and the "quick mention of roadside drop" work on real phones.
