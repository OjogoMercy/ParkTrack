# Scope 08 — Arrival & collection

| | |
|---|---|
| Branch | `scope/08-arrival` (slices: `s08/slN-name` → PR into `scope/08-arrival`; slice branches are deleted once this scope is merged into `main`) |
| Merges after | Scope 07 is merged into `main` and tagged `scope-07-done` |
| Unblocks | 09 (store data, settled parcels for ledger view) |
| Design source | Arrival agent **V01** buses arriving, **V02** tick off the load, **V03** parcels in the store, **V04** release with code, **V05** code locked after 5 tries; Recipient **R04** at the counter: pay dues, **R05** read code to agent, **R06** collected receipt |
| PRD | §6.3, ARR-1 … ARR-4, COL-1 … COL-6, DASH-1 (arrival half), §6.4 (park settlement), §6.5 (missing at arrival, damaged, wrong code, delegate) |

## Goal

At the destination park the arrival agent scans the driver's manifest QR **once**, ticks off each parcel with its bay (flagging anything missing while the driver is still there), and the recipient is notified, which starts the free window. At the counter the recipient scans the park's fixed QR, pays any dues on their own phone, gets a 6-digit code, reads it to the agent, and the parcel is released and settled.

## Owned paths

```
src/server/arrival/**   src/server/collection/**
src/app/console/arrivals/**
src/app/collect/**                          # recipient counter flow (opened by scanning the counter poster)
src/app/api/manifests/**   src/app/api/collect/**
src/app/api/parcels/[id]/release/**
src/app/api/parcels/[id]/admin-release/**
src/app/api/arrivals/**                     # arriving buses, store list
src/features/arrival/**   src/features/collection/**
```

## Routes

| Route | Screen |
|---|---|
| `/console/arrivals` | V01: Scan manifest QR (Volt), arriving buses with ETA and parcel counts, store summary (Held, Fees due, Over 5 days); tabs Arrivals · Store · Me |
| `/console/arrivals/manifest/[token]` | V02: "3 of 4 ticked off · 1 flagged", per-parcel row with code, size, recipient, bay picker, Not on bus, Mark damaged (photo), "opens a dispute with {driver} as last holder. Ask him to wait.", Finish · notify N recipients |
| `/console/arrivals/store` | V03: filters All / Fees due / Over 5 days; rows bay, recipient, code, free hours left / Day N · ₦X / Locked / last day |
| `/console/arrivals/release/[code]` | V04: dues status (verified with Interswitch), code sent to phone + valid until, 6-digit entry with attempts left, collector (recipient / someone else + name), release photo next to drop-off photo, Release parcel |
| `/console/arrivals/locked/[code]` | V05: locked after 5 wrong codes, attempt log, Request admin release, Call recipient |
| `parktrack.ng/collect/[parkToken]` | R04: "Collecting as +234 802 *** 9034" (phone from recipient link or OTP), parcels waiting at this park, dues breakdown (POD · vendor, storage within window ₦0), Pay ₦X; R05 code (expires in 9:41, also by SMS, Get a new code); R06 collected receipt + "Sending something back? Book from home at {park}.parktrack.ng" |

## API

| Method + path | Purpose |
|---|---|
| `GET /api/arrivals` | arriving trips (ETA from 07 tracking), store counts |
| `GET /api/manifests/:token` | arrival agent scans once → parcel list (ARR-1); marks `scanned_by/at` |
| `POST /api/manifests/:token/tick` | `{parcelId, bay}` → `transition(IN_TRANSIT → ARRIVED)` + `notify(arrived_at_park)` (starts free window, ARR-4, COL-6); `{parcelId, missing: true}` → `transition(→ DISPUTED)` + auto dispute naming driver (§6.5) + `notify(missing_at_tickoff)`; `{parcelId, damaged: true, photoUrl}` (ARR-3, P1) |
| `GET /api/arrivals/store` | store list with `storageDues()` per parcel |
| `GET /api/collect/:parkToken` | recipient identified by signed link (from R03 "share this link") or phone OTP; lists their ARRIVED parcels at this park with dues |
| `POST /api/collect/:parkToken/code` | when dues are zero/paid: `issueCollectionCode(counter)` → SMS/WhatsApp (COL-1, COL-2); "Get a new code" reissues |
| (payment) | dues paid through 04 `POST /api/parcels/:id/pay {purpose: pod|storage}` |
| `POST /api/parcels/:id/release` | `{code, collector: {kind, name}, photoUrl}` → all dues verified (COL-3) → `verifyCollectionCode` (lock after 5, COL-4) → `transition(ARRIVED → COLLECTED)` → `settleParcel` (04) → `notify(collected)` |
| `POST /api/parcels/:id/admin-release` (P1) | park admin + recipient ID photo after lock |

## Slices

| Slice | Pri | Work | Check |
|---|---|---|---|
| sl1 | P0 | V01 arrivals list + scanner entry | Musa's bus listed with "4 parcels" after 07 accept |
| sl2 | P0 | Manifest scan + V02 tick-off with bay, Finish notifies recipients | Ticking PT-7K3Q → ARRIVED; recipient gets "Ready to collect" with deadline (demo 2:35–3:15) |
| sl3 | P0 | Not on bus → DISPUTED + auto dispute + driver/park admin notified | Unticked parcel can't be finished silently |
| sl4 | P0 | V03 store with live storage dues | "18h free" / "Day 3 · ₦600" match `storageDues()` |
| sl5 | P0 | Recipient counter flow R04 → pay dues via 04 → R05 code → R06 receipt | Recipient on own phone pays ₦25,000 sandbox and sees the code |
| sl6 | P0 | V04 release: code entry, collector, release photo, COLLECTED → SETTLED with ledger split | Correct code releases; ledger rows match P03 (demo 3:15–3:55) |
| sl7 | P0 | 5 wrong codes → V05 locked screen | 5th wrong attempt locks and shows log |
| sl8 | P1 | Delegate collection (someone else: name + photo, COL-5), damaged at tick-off with photo (ARR-3), admin-assisted release (COL-4) | Delegate name and photo stored on the code row |
| sl9 | P0 | Wire-up: rebase; real 03/04/07 | Full park-collection path from booking to SETTLED works |

## Out of scope

Disputes workflow screens (DIS-1/DIS-2, P1, 09), counter QR poster generation (09), unclaimed-after-7-days job (09).

## Definition of done

WORKFLOW §8 (scope PR → `main`), plus: the collection segment of the demo works with two real phones and a real sandbox POD payment.
