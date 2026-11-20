# Scope 06 — Origin counter (agent)

| | |
|---|---|
| Branch | `scope/06-origin` (slices: `s06/slN-name` → PR into `scope/06-origin`; slice branches are deleted once this scope is merged into `main`) |
| Merges after | Scope 05 is merged into `main` and tagged `scope-05-done` |
| Unblocks | 07 (assigned loads for drivers) |
| Design source | Origin agent **A01** counter today, **A02** scan sender QR, **A03** check in (size, write code, photo), **A04** walk-in booking, **A05** walk-in payment + handshake, **A06** assign to driver, **A07** loads |
| PRD | §6.1 steps 1a, 3, 4, 5; BOOK-6, HS-2 … HS-8, DRV-1, DRV-2, DASH-1 (origin half), §6.5 (bigger parcel, no smartphone, refused item) |

## Goal

At the counter, the agent confirms the sender is present (scan their QR, or the sender scans the agent's QR, or an SMS code), checks the parcel, writes `PT-XXXX` on it, takes a photo, and the recipient gets their tracking link **at that moment**. The agent then assigns parcels to a driver and watches until the driver accepts.

## Owned paths

```
src/server/handshake/**   src/server/dropoff/**   src/server/assignment/**
src/app/console/counter/**
src/app/api/handshake/**
src/app/api/parcels/[id]/dropoff/**
src/app/api/parcels/[id]/refuse/**
src/app/api/parcels/assign/**
src/app/api/counter/**                 # today list, loads list, walk-in
src/features/counter/**
```

## Routes (`app.parktrack.ng`, role `agent`, park-scoped)

| Route | Screen |
|---|---|
| `/console/counter` | A01: KPIs (Expected, Checked in, To assign), Scan QR + Walk-in buttons, amber notice when a load is not accepted near departure, Expected / Checked-in lists; bottom tabs Today · Loads · Me |
| `/console/counter/scan` | A02: camera scanner (Volt frame), "Scan their QR" / "Show my QR" toggle, "Type the parcel code instead" |
| `/console/counter/check-in/[publicId]` | A03: booking details, size check (Small/Medium/Large; bigger → top-up request), "Write the code on the parcel" + confirm checkbox, drop-off photo (retake), Refuse this item, Confirm drop-off |
| `/console/counter/walk-in` | A04: sender phone (detects existing account), name, destination, delivery mode, recipient, category, size, declared value, total, Take payment |
| `/console/counter/walk-in/[publicId]` | A05: payment status ("₦1,650 paid by transfer · verified with Interswitch"), handshake tabs Sender scans (agent QR) / SMS code, Continue to check-in |
| `/console/counter/assign` | A06: parcels to assign grouped by destination tab, roadside parcels marked, driver list (On app / No app, departure time), "No roadside parcels" for no-app drivers, Assign N parcels to {driver} |
| `/console/counter/loads` | A07: loads not accepted (Remind, Reassign), on the road, departed today, handed over |

## API

| Method + path | Purpose |
|---|---|
| `GET /api/handshake/:publicId` | agent scans sender QR → full booking for checking (HS-2); 404-equivalent for wrong park/role (HS-8); rate-limited |
| `POST /api/handshake/:publicId/confirm` | `{method: agent_scan | sender_scan | sms_code, code?}`; sender_scan links an agent-created booking to the sender's account (HS-3) |
| `POST /api/handshake/:publicId/sms` | send SMS code to the walk-in sender's phone (HS-4, P1) |
| `POST /api/parcels/:id/dropoff` | `{size, codeWritten: true, photoUrl, corrections?}`; if size increased, requires paid `top_up` first (HS-5); → `transition(AWAITING_DROPOFF → RECEIVED_AT_ORIGIN)` → `notify(handshake_complete)` sends recipient tracking link (HS-7) |
| `POST /api/parcels/:id/refuse` | refused item: log reason, `transition(→ CANCELLED)`, refund via 04 (P1) |
| `POST /api/counter/walk-in` | walk-in booking: finds or creates the sender by phone, then calls `@/server/booking` (05) with `created_by = agent` (BOOK-6). Separate route so 06 never edits 05's `api/parcels/route.ts` |
| `POST /api/parcels/assign` | `{parcelIds, driverId}` → create/reuse open trip for driver+route, `trip_parcels` rows, `transition(→ ASSIGNED)`; reject roadside parcels for no-app drivers (DRV-2); `notify(assigned)` to driver |
| `GET /api/counter/today`, `GET /api/counter/loads` | A01 and A07 lists |
| `POST /api/counter/loads/:tripId/remind`, `…/reassign` | A07 actions (reassign moves parcels back to RECEIVED_AT_ORIGIN) |

## Slices

| Slice | Pri | Work | Check |
|---|---|---|---|
| sl1 | P0 | A01 today view + KPIs + lists (park-scoped) | Bayo sees only Ogbomoso parcels; counts match seed |
| sl2 | P0 | A02 scanner + `GET /api/handshake/:publicId` + manual code entry | Scanning S07's QR on another phone opens A03 in < 2 s; signed-out scan shows nothing (HS-8) |
| sl3 | P0 | A03 check-in: size check, code-written confirm, photo via `PhotoCapture` + 03 uploads, Confirm drop-off → RECEIVED_AT_ORIGIN + recipient link sent | Recipient phone receives tracking link exactly when Confirm is pressed (demo 1:25–2:05) |
| sl4 | P0 | A04/A05 walk-in: booking, payment via 04 (agent opens checkout for transfer/USSD), agent-shows-QR handshake, booking moves to sender account | Walk-in sender scans agent QR and sees the parcel in S08 |
| sl5 | P0 | A06 assign: grouping, driver eligibility (roadside → on-app only), trip creation, ASSIGNED | Assigning a roadside parcel to Sule Bello (no app) is blocked |
| sl6 | P0 | A07 loads: not accepted / on the road / departed / handed over; Remind (notify driver) | Load shows "Not accepted" until 07's Accept load |
| sl7 | P1 | Size top-up flow (HS-5): agent picks bigger size → sender pays difference (₦1,500 Medium→Large) before Confirm is enabled | Confirm disabled until top-up verified |
| sl8 | P1 | SMS code handshake (HS-4); Refuse item with refund (PAY-6); Reassign | No-smartphone walk-in completes with SMS code |
| sl9 | P0 | Wire-up: rebase; real 03/04/05 | Self-booked parcel from 05 goes through scan → check-in → assign |

## Out of scope

Driver accept (07), the "load not accepted" alert to park admin on a schedule (09), offline queue (P1, post-hackathon).

## Definition of done

WORKFLOW §8 (scope PR → `main`), plus: demo steps 1:25–2:35 work on two real phones (sender shows QR, judge as agent scans).
