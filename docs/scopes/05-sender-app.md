# Scope 05 — Sender app (booking)

| | |
|---|---|
| Branch | `scope/05-sender` (slices: `scope/05-sender/slN-name` → PR into `scope/05-sender`) |
| Merges after | Scope 04 is merged into `main` and tagged `scope-04-done` |
| Unblocks | 06 (there are self-booked parcels to scan) |
| Design source | Senderv2 **S01** park home, **S03** new parcel (one page), **S04** review and pay, **S07** booked QR, **S08** my parcels, **S12** account & saved recipients |
| PRD | §5.2, §6.1 steps 1–2, BOOK-1 … BOOK-5, BOOK-8 (P1), HS-1 (display), DASH-3, AUTH-3 (display) |

## Goal

A sender opens their park's subdomain, sees routes and fares, books a parcel on **one page** with their own details prefilled and a saved recipient picked from chips, pays through Interswitch, and gets a booking QR + write-on code + drop-off deadline. Vendors see what they've collected on delivery.

## Owned paths

```
src/server/booking/**   src/server/recipients/**   src/server/vendors/**
src/app/sites/[park]/(sender)/**        EXCEPT  src/app/sites/[park]/(sender)/parcels/[code]/**  (owned by 07)
src/app/api/parcels/route.ts            # POST create booking, GET my parcels
src/app/api/me/**                       # profile, saved recipients, vendor profile
src/features/sender/**
```

## Routes

| Route (on `{park}.parktrack.ng`) | Screen |
|---|---|
| `/` | S01 park home: open/closed, "Send a parcel from {park}", quick estimator (destination + size → total), routes list with "from ₦", Good-to-know block (48 h drop-off, 24 h free storage then ₦300/day, one-time code, Interswitch) |
| `/send` | S03 one page: sending-as (prefilled, Edit), destination park, delivery segmented control (Collect at park / Roadside drop + drop point select), recipient chips (saved + New person) with name/phone, item category, short description, size cards with prices, declared value, POD toggle + amount (≤ ₦200,000), live total "Fare ₦X + ₦150 fee", Review |
| `/send/review` | S04 summary + "After paying, bring the parcel … within 48 hours" + Pay ₦X → `POST /api/parcels/:id/pay` (04) |
| `/parcels/booked/[code]` | S07 booked: paid amount, QR (`publicId` only), `PT-7K3Q` write-on code, drop-off deadline, recipient/park, POD, receipt link, "Kemi gets her tracking link the moment the agent checks your parcel in" |
| `/parcels` | S08 my parcels: vendor strip (Collected for you · month, Awaiting collection), tabs Active / Delivered / Drafts, rows with status badge; links to `/parcels/[code]` (07) |
| `/account` | S12 profile (name, phone, Edit), Business (vendor toggle, business name, payout bank/account), saved recipients (add/edit/remove), preferences (notifications WhatsApp/SMS, language), Sign out, "Joined through {park}" |

Signed-out users can browse `/`; `/send` and beyond redirect to `/signin?next=` (02).

## API

| Method + path | Purpose |
|---|---|
| `POST /api/parcels` | create DRAFT via `createDraft` (03) with fee quote; sender from session; origin park from host |
| `GET /api/parcels?tab=active|delivered|drafts` | sender's parcels (`ParcelSummary[]`) + vendor totals from `@/server/ledger` |
| `GET/PATCH /api/me` | profile, language, notification channel |
| `GET/POST/PATCH/DELETE /api/me/recipients` | saved recipients |
| `PUT /api/me/vendor` | business name, payout bank, account name |
| `GET /api/quote` | live total for S01 estimator and S03 (wraps `quote()`) |

## Slices

| Slice | Pri | Work | Check |
|---|---|---|---|
| sl1 | P0 | S01 park home from `GET /api/park` + quick estimator | Ogbomoso page shows 3 routes with "from" prices; Medium to Ibadan shows ₦2,650 |
| sl2 | P0 | Saved recipients + profile API; S12 account screen | Add Kemi, she appears as a chip in S03 |
| sl3 | P0 | S03 one-page booking with live total, both delivery modes, roadside point list from route, validation with contract zod (phone, POD cap) | Switching size/mode updates total instantly; POD > ₦200,000 blocked |
| sl4 | P0 | `POST /api/parcels` + S04 review; Pay calls 04 and returns to S07 on success / S06 on failure | Real sandbox payment lands on S07 |
| sl5 | P0 | S07 booked screen with QR + code + deadline | QR decodes to the `publicId` only, nothing else |
| sl6 | P0 | S08 my parcels with tabs, badges, vendor totals | Seeded parcels appear in the right tabs with design badges |
| sl7 | P1 | Vendor profile fields + business toggle | Vendor strip only shows for vendors |
| sl8 | P1 | Prohibited categories blocked in the category list (BOOK-8); Drafts tab "Pay now" resumes payment within 24 h | Prohibited category cannot be submitted |
| sl9 | P0 | Wire-up: rebase on `main`; run book → pay against real 03/04 | Fresh user books and pays on `ogbomoso.localhost` |

## Out of scope

Parcel detail/tracking pages S09–S11 (07), cancel booking + refund action (button lives in 07's S09; refund logic 04/09), bulk booking (BOOK-9, P2), insurance.

## Definition of done

WORKFLOW §8 (scope PR → `main`), plus: demo step "0:40–1:25" (vendor books with details prefilled and pays live) works on a phone.
