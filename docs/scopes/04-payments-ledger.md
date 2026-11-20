# Scope 04 — Payments & ledger (Interswitch)

| | |
|---|---|
| Branch | `scope/04-payments` (slices: `scope/04-payments/slN-name` → PR into `scope/04-payments`) |
| Merges after | Scope 03 is merged into `main` and tagged `scope-03-done` |
| Unblocks | 05 (pay for booking), 06 (walk-in, top-up), 07 (roadside POD), 08 (counter dues), 09 (ledger view, refunds) |
| Design source | Senderv2 **S05** (confirming), **S06** (failed), receipt link; ledger rows in admin **P03**; payments monitor in **P07** |
| PRD | §10 (all), PAY-1 … PAY-5, PAY-8, PAY-6 (P1), §6.4 settlement, NFR reliability |

## Goal

Every naira moves through Interswitch Web Checkout and is **only** trusted after a server-side requery returns response code `00` with the exact kobo amount. Late results arrive by webhook or a scheduled requery and are applied exactly once. Every charge, fee, payout and refund lands in an append-only ledger; settlement credits vendor, driver, park and platform in one transaction.

This is the riskiest integration in the project. **Get one real sandbox payment through end to end in sl2 before building anything else here.**

## Owned paths

```
src/server/payments/**     src/server/ledger/**
src/app/pay/**                         # return/confirming/failed/receipt pages (shared by all payers)
src/app/api/payments/**                # callback, status poll, receipt
src/app/api/webhooks/interswitch/**
src/app/api/parcels/[id]/pay/**        # start checkout for any purpose
src/app/api/ledger/**
src/app/api/jobs/requery/**            # QStash target
src/features/payments/**
```

## API

| Method + path | Purpose |
|---|---|
| `POST /api/parcels/:id/pay` | `{purpose: shipping|top_up|pod|storage, payer: session or signed recipient link}` → computes the amount **server-side** (never from the client), creates `payments` row (`txn_ref` like `ISW-PT-8F3KQ2`, amount in kobo), returns Web Checkout params/URL |
| `GET /api/payments/callback` | Interswitch redirect: ignore redirect values, requery, apply, then send the browser to `/pay/[ref]` |
| `GET /api/payments/:ref/status` | Polled by S05 "Confirming your payment" |
| `POST /api/webhooks/interswitch` | Verify signature/secret, store in `webhook_events` (unique `provider_ref`), requery, apply; duplicates ignored (P07 "Duplicate ignored") |
| `POST /api/jobs/requery` | QStash-signed; requery any payment still pending after 10 min, back-off, stop after N tries |
| `GET /api/ledger/:account` | Balances and entries for vendor / driver / park (park-scoped), used by 07 earnings, 05 vendor totals, 09 ledger |

## Server API (`@/server/payments`, `@/server/ledger`)

`startPayment(parcelId, purpose, payer)`, `applyVerifiedPayment(paymentId)` (idempotent), `refund(parcelId, reason)` (P1), `settleParcel(parcelId)` (called by 07 on DELIVERED_ROADSIDE and 08 on COLLECTED → `SETTLED`), `balances(account)`, `entries(filter)`.

**What a verified payment does, by purpose** (one DB transaction with the ledger entries):

| Purpose | Effect |
|---|---|
| shipping | `transition(DRAFT → AWAITING_DROPOFF)`, set `dropoff_deadline`, notify `booking_paid` (QR + deadline) |
| top_up | mark size top-up paid so 06 can complete drop-off |
| pod | mark POD paid; roadside → `issueCollectionCode(roadside)` (R02 shows the code after paying) |
| storage | mark storage dues paid up to now |

## Ledger rules (decided: follow the split shown in the designs; stored in `settings`/`parks` so it can change later)

| Event | Entries (kobo, signed) |
|---|---|
| Shipping ₦3,150 settled | driver +60% of fare (₦1,800), park +40% of fare (₦1,200), platform +₦150 |
| POD ₦40,000 settled | vendor +₦39,500, platform +1.25% (₦500) |
| Storage ₦600 | park +80% (₦480), platform +20% (₦120) |
| Refund | reverses the shipping entries, `−` amounts |

Before settlement, payments sit in a `held` ledger state; `settleParcel` moves them to account credits. Entries can't be updated or deleted (enforce with a DB trigger or no update path).

## Slices

| Slice | Pri | Work | Check |
|---|---|---|---|
| sl1 | P0 | Interswitch client: env, Web Checkout params (merchant code, pay item id, txn ref, amount kobo, redirect URL, hash if required), requery call | Requery for a known sandbox ref returns parsed `{responseCode, amount}` |
| sl2 | P0 | **Tracer bullet**: `POST /api/parcels/:id/pay` → hosted page → callback → requery → `applyVerifiedPayment` → parcel `AWAITING_DROPOFF` | One real sandbox card payment moves a seeded DRAFT to AWAITING_DROPOFF |
| sl3 | P0 | Strict verification: only `00` **and** exact amount; anything else = failed with reason (S06 "Card declined (51)") | Amount-mismatch test marks failed; `51` shows the decline screen |
| sl4 | P0 | Webhook + `webhook_events` idempotency | Replaying the same webhook 3× creates one ledger set |
| sl5 | P0 | QStash requery job for pending > 10 min with back-off | A payment whose redirect was closed gets verified by the job (PRD §6.5) |
| sl6 | P0 | `/pay/[ref]` pages: S05 confirming (polls status, "Closed the page? We'll send your booking QR by WhatsApp"), S06 failed (amount, ref, reason, Try again, Pay by transfer or USSD), success redirect back to caller (`returnTo`) | Pages match S05/S06 |
| sl7 | P0 | Ledger: entries table helpers, append-only guard, `settleParcel` with the split rules above, `balances` | Settling the P03 example produces exactly the five rows shown in P03 |
| sl8 | P0 | Receipts (PAY-8): `/pay/[ref]/receipt` page + `notify` with receipt link | Receipt shows amount, ref, purpose, time |
| sl9 | P1 | Refunds (PAY-6): `refund()` through Interswitch (or record-only if sandbox lacks it; flag in PR) with reversing entries | Expired booking produces a −₦ refund row |
| sl10 | P0 | Wire-up: rebase; confirm 03 `transition`/`notify` real | Full sandbox payment on deployed preview URL |

## Out of scope

Real bank payouts (PAY-7, post-hackathon), insurance, booking UI (05), dues UI on the recipient side (07/08 call `POST /pay`).

## Definition of done

WORKFLOW §8 (scope PR → `main`), plus: PR body includes the sandbox `txn_ref` of a verified payment, a failed one, and a webhook duplicate.
