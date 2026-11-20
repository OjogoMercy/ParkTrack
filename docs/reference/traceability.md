# PRD v1.1 requirement → scope

Every functional requirement in PRD §7, with its priority and the scope that delivers it. P0 = hackathon demo, P1 = first pilot, P2 = later.

## 7.1 Parks, subdomains and accounts

| ID | Pri | Scope | Note |
|---|---|---|---|
| PARK-1 | P0 | 01 (schema + seed), 02 (read API), 09 (admin edit) | |
| PARK-2 | P0 | 02 | middleware + S13 |
| PARK-3 | P0 | 02 | reserved names |
| PARK-4 | P0 | 01 (token), 09 (poster), 08 (scan target) | |
| AUTH-1 | P0 | 02 | OTP via 03 notify |
| AUTH-2 | P0 | 02 | cookie on `.parktrack.ng` |
| AUTH-3 | P0 | 02 (store), 05 (display) | |
| AUTH-4 | P0 | 02 | `requireRole`, `parkScope` |
| AUTH-5 | P0 | 02 (sign/verify), 07/08 (use) | |
| AUTH-6 | P1 | 09 | team + invites |

## 7.2 Booking

| ID | Pri | Scope |
|---|---|---|
| BOOK-1 | P0 | 05 (UI/API), 03 (`createDraft`) |
| BOOK-2 | P0 | 05 |
| BOOK-3 | P0 | 05 |
| BOOK-4 | P0 | 03 (`quote`), 05 (display) |
| BOOK-5 | P0 | 05, 03 (cap) |
| BOOK-6 | P0 | 06 |
| BOOK-7 | P1 | 09 (job), 04 (refund) |
| BOOK-8 | P1 | 03 (rule), 05 (UI) |
| BOOK-9 | P2 | not planned |

## 7.3 Handshake and drop-off

| ID | Pri | Scope |
|---|---|---|
| HS-1 | P0 | 01 (`publicId`), 05 (QR display) |
| HS-2 | P0 | 06 |
| HS-3 | P0 | 06 |
| HS-4 | P1 | 06 |
| HS-5 | P1 | 06, 04 (top-up payment) |
| HS-6 | P0 | 06, 03 (uploads) |
| HS-7 | P0 | 03 (rule), 06 (trigger) |
| HS-8 | P0 | 06, 02 (role guard) |

## 7.4 Assignment and driver

| ID | Pri | Scope |
|---|---|---|
| DRV-1 | P0 | 06 |
| DRV-2 | P0 | 06 |
| DRV-3 | P0 | 07 |
| DRV-4 | P0 | 07 |
| DRV-5 | P1 | 06 (banner), 09 (scheduled alert) |
| DRV-6 | P0 | 07 |
| DRV-7 | P1 (simulated in demo) | 07 |
| DRV-8 | P2 | not planned |

## 7.5 Roadside drop

| ID | Pri | Scope |
|---|---|---|
| RD-1 | P0 | 07 |
| RD-2 | P1 | 07 (simulated in demo) |
| RD-3 | P0 | 07, 04 |
| RD-4 | P0 | 07, 03 (codes) |
| RD-5 | P0 | 07, 03 (`changeDeliveryMode`) |

## 7.6 Arrival and collection

| ID | Pri | Scope |
|---|---|---|
| ARR-1 | P0 | 08 (scan), 07 (manifest creation) |
| ARR-2 | P0 | 08 |
| ARR-3 | P1 | 08 |
| ARR-4 | P0 | 08, 03 (notify) |
| COL-1 | P0 | 08 |
| COL-2 | P0 | 03 |
| COL-3 | P0 | 08, 04 |
| COL-4 | P1 | 03 (lock), 08 (screens), 09 (admin release) |
| COL-5 | P1 | 08 |
| COL-6 | P0 | 03 (`storageDues`), 08 (trigger) |

## 7.7 Tracking

| ID | Pri | Scope |
|---|---|---|
| TRK-1 | P0 | 07 |
| TRK-2 | P1 (simulated in demo) | 07 |
| TRK-3 | P1 | 07 |
| TRK-4 | P0 | 07 |

## 7.8 Payments and settlement

| ID | Pri | Scope |
|---|---|---|
| PAY-1 | P0 | 04 |
| PAY-2 | P0 | 04 |
| PAY-3 | P0 | 04 |
| PAY-4 | P0 | 04 |
| PAY-5 | P0 | 04 (`settleParcel`), 07/08 (call it) |
| PAY-6 | P1 | 04 (refund), 06/07/09 (triggers) |
| PAY-7 | P1 | not planned for hackathon (ledger only) |
| PAY-8 | P0 | 04 |

## 7.9 Notifications, disputes and dashboards

| ID | Pri | Scope |
|---|---|---|
| NOT-1 | P0 | 03 |
| NOT-2 | P1 | 03 |
| DIS-1 | P1 | 08 (automatic on missing), 09 (user-opened) |
| DIS-2 | P1 | 09 |
| DASH-1 | P0 | 06 (origin), 08 (arrival store) |
| DASH-2 | P0 | 07 |
| DASH-3 | P0 | 05 |
| DASH-4 | P1 | 09 |
| DASH-5 | P1 | 09 |

## Non-functional (PRD §15)

| Area | Where |
|---|---|
| Performance (< 300 KB, 3G, scan → details < 2 s) | 01 (budgets in CI), checked in 06/08 |
| Reliability (no lost events, idempotent payments) | 03, 04 |
| Security (OTP, roles, random QR ids, signed links, hashed codes, rate limits) | 01, 02, 03 |
| Tenant separation | 02 (`parkScope`), every staff query |
| Privacy (NDPA, data visibility) | 02, 03, review in every PR |
| Auditability | 03 (`parcel_events`), 04 (ledger) |
| Accessibility (tap targets, simple language) | 01 (primitives) |
| Availability (SMS fallback) | 03 |
