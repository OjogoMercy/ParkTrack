# Design screen map

> **One domain since [Q45](open-questions.md):** every route below is on `parktrack.ng`. Sender pages that were on `{park}.parktrack.ng` are now on the main domain (the park is picked in the app); console routes keep their `/console/…` paths, now on the main domain too. S13 is replaced by the park list on an unknown `/parks/{slug}`.

Every screen in the 7 ParkTrack UI v2 files, the scope that builds it, and its route. Mobile screens are designed at 390 px; admin screens at desktop width.

Design files live in [`docs/design/`](../design/) (open in a browser): `ParkTrack UI Foundations.html`, `ParkTrack UI Senderv2.html`, `ParkTrack UI recipient.html`, `ParkTrack UI Origin agent.html`, `ParkTrack UI Driver.html`, `ParkTrack UI Arrival agent.html`, `ParkTrack UI park and platform admin.html`. The PRD is [`docs/ParkTrack_PRD_v1.1.pdf`](../ParkTrack_PRD_v1.1.pdf).

## Foundations → guidelines, not a screen (Scope 01)

`ParkTrack UI Foundations.html` is the **rulebook** every screen follows: principles, type scale, colour tokens, radius/spacing, buttons, forms, toggles, lists/timeline/notices. It is **not a screen** in the product and gets no route. Scope 01 turns it into tokens (`src/app/globals.css`) and components (`src/components/ui/`). The screens themselves come from the six role files below.

## Sender (Senderv2) — `parktrack.ng`

| ID | Screen | Scope | Route |
|---|---|---|---|
| S01 | Park home | 05 | `/parks/[slug]` (home `/` lists parks) |
| S02 | Sign in with phone code | 02 | `/signin` |
| S03 | New parcel (one page, interactive) | 05 | `/send` |
| S04 | Review and pay | 05 | `/send/review` |
| S05 | Confirming payment | 04 | `/pay/[ref]` |
| S06 | Payment failed | 04 | `parktrack.ng/pay/[ref]` (failed state) |
| S07 | Booked: show QR at the counter | 05 | `/parcels/booked/[code]` |
| S08 | My parcels (signed in) | 05 | `/parcels` |
| S09 | Parcel: awaiting drop-off | 07 | `/parcels/[code]` |
| S10 | Parcel: in transit with live map | 07 | `/parcels/[code]` |
| S11 | Parcel: collected, proof of delivery | 07 | `/parcels/[code]` |
| S12 | Account and saved recipients | 05 | `/account` |
| S13 | Park not found | 02 | unknown `/parks/[slug]` (lists parks; replaced by Q45) |

## Recipient — host `parktrack.ng`, no account (signed link)

| ID | Screen | Scope | Route |
|---|---|---|---|
| R01 | Roadside: bus approaching, pay dues | 07 | `/t/[link]` |
| R02 | Roadside: paid, handover code | 07 | `/t/[link]` |
| R03 | Ready to collect at the park | 07 | `/t/[link]` |
| R04 | At the counter: pay dues | 08 | `/collect/[parkToken]` |
| R05 | At the counter: read code to agent | 08 | `/collect/[parkToken]` |
| R06 | Collected: receipt | 08 | `/collect/[parkToken]` (done state) |

## Origin agent — `parktrack.ng/console`

| ID | Screen | Scope | Route |
|---|---|---|---|
| — | Sign-in (S02, one for everyone since Q45; staff then go to their role's home, Q29) | 02 | `/signin` |
| A01 | Counter: today | 06 | `/console/counter` |
| A02 | Scan sender QR | 06 | `/console/counter/scan` |
| A03 | Check in: size, write code, photo | 06 | `/console/counter/check-in/[publicId]` |
| A04 | Walk-in booking (agent books) | 06 | `/console/counter/walk-in` |
| A05 | Walk-in: payment and handshake | 06 | `/console/counter/walk-in/[publicId]` |
| A06 | Assign parcels to a driver | 06 | `/console/counter/assign` |
| A07 | Loads: waiting for driver to accept | 06 | `/console/counter/loads` |

## Driver — `parktrack.ng/console`

| ID | Screen | Scope | Route |
|---|---|---|---|
| D01 | Load to accept | 07 | `/console/driver` |
| D02 | Trip in progress | 07 | `/console/driver/trip` |
| D03 | Roadside handover with code | 07 | `/console/driver/handover/[code]` |
| D04 | Mark as missed (sheet) | 07 | sheet on D03 |
| D05 | Manifest QR at arrival | 07 | `/console/driver/manifest` |
| D06 | Earnings | 07 | `/console/driver/earnings` |

## Arrival agent — `parktrack.ng/console`

| ID | Screen | Scope | Route |
|---|---|---|---|
| V01 | Arrival counter: buses arriving | 08 | `/console/arrivals` |
| V02 | Tick off the load | 08 | `/console/arrivals/manifest/[token]` |
| V03 | Parcels in the store | 08 | `/console/arrivals/store` |
| V04 | Release with code | 08 | `/console/arrivals/release/[code]` |
| V05 | Code locked after 5 tries | 08 | `/console/arrivals/locked/[code]` |

## Park admin and platform admin — `parktrack.ng/console`

| ID | Screen | Scope | Route |
|---|---|---|---|
| P01 | Park admin: overview | 09 | `/console/park` |
| P02 | Park admin: parcels with detail panel | 09 | `/console/park/parcels` |
| P03 | Park admin: ledger and settlement | 09 | `/console/park/ledger` |
| P04 | Park admin: agents and drivers | 09 | `/console/park/team` |
| P05 | Park admin: routes, fares and storage rules | 09 | `/console/park/settings` |
| P06 | Counter QR poster (A4) | 09 | `/console/park/poster` |
| P07 | Platform admin: parks and payments | 09 | `/console/platform` |

**Totals:** 44 screens (Foundations is guidelines only). Scope 02: 2 · 04: 2 · 05: 6 · 06: 7 · 07: 12 · 08: 8 · 09: 7.
