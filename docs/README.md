# ParkTrack — Build Plan

> A tracked, paid and fair waybill network for Nigerian motor parks.
> Source of truth: **ParkTrack PRD v1.1 (19 Nov 2026)** → [ParkTrack_PRD_v1.1.pdf](ParkTrack_PRD_v1.1.pdf), and the **ParkTrack UI v2** design files → [design/](design/) (7 HTML exports; open in a browser, each shows every screen for one role side by side).
> Repo: **https://github.com/OjogoMercy/ParkTrack** · Demo: Interswitch Pan-African Discovery Series, LAUTECH, Ogbomoso, **26 Nov 2026**.

The build is split into **9 scopes**. Each scope lives on **its own branch** (`scope/NN-name`). Work inside a scope is done in **slices**, and each slice arrives as **a PR into that scope's branch**. Nobody pushes directly to a scope branch or to `main`. **Only the repo owner merges into `main`**, one completed scope at a time, in order: scope 02 can't land until scope 01 has landed, and so on.

## Read in this order

1. [WORKFLOW.md](WORKFLOW.md): branches, slice PRs, GitHub protection rules, merge order, checklists, how to change a shared contract.
2. Your scope file in [scopes/](scopes/).
3. [reference/screen-map.md](reference/screen-map.md): every design screen → scope → route.
4. [reference/traceability.md](reference/traceability.md): every PRD requirement ID → scope.
5. [reference/open-questions.md](reference/open-questions.md): gaps between the PRD and the designs, with what was decided or the default we build to.

## The 9 scopes

| # | Branch | Scope | What it delivers | Design screens |
|---|---|---|---|---|
| 01 | `scope/01-foundation` | [Foundation & contracts](scopes/01-foundation.md) | Repo, design system, full DB schema + seed, frozen API/type contracts, service stubs, CI | Foundations |
| 02 | `scope/02-identity` | [Parks, identity & access](scopes/02-parks-identity.md) | Subdomain routing, 6-digit phone sign-in, network-wide session, roles, signed recipient links | S02, S13, console sign-in |
| 03 | `scope/03-parcel-engine` | [Parcel engine & notifications](scopes/03-parcel-engine.md) | State machine, event log, fee quote, codes, storage dues, photo upload, WhatsApp/SMS | none (backend) |
| 04 | `scope/04-payments` | [Payments & ledger](scopes/04-payments-ledger.md) | Interswitch Web Checkout, requery, webhook, retries, append-only ledger, settlement with the design's split | S05, S06, receipt |
| 05 | `scope/05-sender` | [Sender app](scopes/05-sender-app.md) | Park home, one-page booking, review & pay, booking QR, my parcels, account & saved recipients | S01, S03, S04, S07, S08, S12 |
| 06 | `scope/06-origin` | [Origin counter](scopes/06-origin-counter.md) | Agent today view, scan/handshake, check-in (code + photo), walk-in, assign to driver, loads | A01–A07 |
| 07 | `scope/07-driver` | [Driver, roadside & tracking](scopes/07-driver-tracking.md) | Accept load, trip, simulated map, roadside handover + missed, manifest QR, earnings, all tracking pages | D01–D06, S09–S11, R01–R03 |
| 08 | `scope/08-arrival` | [Arrival & collection](scopes/08-arrival-collection.md) | Manifest scan, tick-off, store, counter QR collection, collection code, dues, release | V01–V05, R04–R06 |
| 09 | `scope/09-admin-launch` | [Admin, jobs & launch](scopes/09-admin-jobs-launch.md) | Park + platform admin, ledger view, counter poster, scheduled jobs, PWA, deploy, demo prep | P01–P07 |

```
main ◄── 01 ◄── 02 ◄── 03 ◄── 04 ◄── 05 ◄── 06 ◄── 07 ◄── 08 ◄── 09      (owner merges, left to right)
          │
          └─ after 01 merges, branches 02–09 are cut from main and built in parallel
```

**Pace:** no fixed dates. Each scope merges when it is complete. Scope 01 goes first and alone, because every other scope builds on its schema, contracts and design system.

**Why this order.** Each scope only *calls* code from scopes before it, so when scope N merges, everything it calls is already real on `main`. Until then it builds against the **stubs** Scope 01 ships for every shared service (WORKFLOW §5).

## Demo-critical path (never cut)

The 5-minute demo (PRD §16.3): **book on `ogbomoso.parktrack.ng` (05) → pay in Interswitch sandbox with server requery (04) → agent scans booking QR, writes code, takes photo, recipient gets link (06, 03) → assign + driver Accept load + simulated map (06, 07) → manifest scan + tick-off (08) → counter QR, collection code, pay-on-delivery, release (08, 04) → ledger split (09).**
Every slice is marked **P0** (demo) or **P1** (pilot). Do every P0 slice in every scope before any P1 slice anywhere.

## Decisions so far

| Topic | Decision |
|---|---|
| Sign-in code | 6 digits |
| Fare split | As in the designs: driver 60% / park 40% of the fare, platform keeps the ₦150 service fee; storage park 80% / platform 20%; POD fee 1.25% |
| Pace | No fixed dates; a scope merges when complete, in order |
| Branching | One branch per scope, slices as PRs into it, owner-only merges to `main` |

## Suggested split for two people

| Person | Scopes |
|---|---|
| Backend and integrations | 01 (with partner), 03, 04, then server halves of 07 and 08 |
| Frontend, research and pitch | 01 design system, 02 screens, 05, 06, UI halves of 07 and 08 |
| Both | 09 |
