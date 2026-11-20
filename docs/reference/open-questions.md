# Open questions, gaps and conflicts

Found while reading PRD v1.1 against the UI v2 designs. Each has a **default we build to** so nobody is blocked. Change a default only by editing this file in a `contract/*` PR (WORKFLOW §7).

| # | Topic | What we found | Default until decided | Affects |
|---|---|---|---|---|
| Q1 | Repo `PRD.md` | The `PRD.md` at the repo root is the PRD for "Leash" (a USDC vault on Arc), not ParkTrack | Delete or replace it before Scope 01 | all |
| Q2 | OTP length | S02 copy says "We send a 6-digit code" but shows 4 boxes | **Decided:** 6 digits (the S02 screen gets 6 boxes) | 02 |
| Q3 | Fare split | PRD says "fare shares" with no ratio; P03 shows a ₦3,000 fare split driver ₦1,800 / park ₦1,200 | **Decided:** follow the split in the designs: driver 60% / park 40% of the fare, platform keeps the ₦150 service fee; stored per park so it can change later | 04 |
| Q4 | Roadside code lifetime | PRD: codes valid 10 min (COL-2). R02 shows the roadside code right after paying POD, ~1 h before the bus arrives | Counter codes: 10 min. Roadside codes: valid until the trip ends or the parcel is marked Missed; still 5-attempt lock | 03, 07 |
| Q5 | Roadside parcel with no POD | When does a recipient with nothing to pay get their roadside code? | Issued at `load_accepted`, sent with the arrival estimate | 03, 07 |
| Q6 | Storage rate | PRD: daily rate per size class; designs mostly say "₦300 a day" | Per size class in `storage_rates`, seeded ₦300 for S/M/L | 01, 03 |
| Q7 | Storage split | PRD: "park majority, platform small share"; P03 shows ₦480 / ₦120 | Park 80% / platform 20% | 04 |
| Q8 | Platform & POD fees | PRD ranges ₦100–200 and 1–1.5% | ₦150 per parcel; POD fee 1.25% (from S11/P03) | 01, 04 |
| Q9 | Draft expiry | S06 says "your booking is saved for 24 hours"; PRD has no DRAFT expiry | DRAFT auto-cancels after 24 h | 03, 09 |
| Q10 | Departure time | A01/A07 show "Departs 10:30 AM", "admin alerted at 10:15"; PRD `trips` has no scheduled departure | Add `trips.scheduled_departure_at`, set by the agent at assignment | 01, 06, 09 |
| Q11 | Agent QR handshake | HS-3 needs an agent-side QR; schema has nowhere to store it | `handshakes.agent_qr_token` (random, single use, 10 min) | 01, 06 |
| Q12 | Copy bug | P01 "3 bookings expire in 6h · Unpaid drop-offs refund automatically" — these are **paid** bookings not yet dropped off | Fix copy to "Paid bookings not dropped off refund automatically" | 09 |
| Q13 | Insurance | PRD BOOK-4 includes insurance; §16.2 puts insurance out of scope | Hide insurance in the hackathon build; keep the `insured` column | 03, 05 |
| Q14 | Interswitch split/payout | PRD §22.2 open question | Ledger-only splits for the demo; ask Interswitch on site | 04 |
| Q15 | Refund API | Sandbox may not support refunds | If unsupported, record refund as ledger reversal + "refund pending" status and say so in the PR | 04 |
| Q16 | Recipient at the counter without the link | R04 shows "Collecting as +234 802 *** 9034". How does the recipient prove the phone if they scan the poster without the link? | Counter page asks for phone, sends OTP (02) to that phone, then lists parcels for that phone at this park | 08 |
| Q17 | Prisma vs Supabase client | PRD says Prisma; Realtime needs Supabase client | Prisma for all reads/writes; Supabase JS only for Realtime subscriptions and Storage | 01 |
| Q18 | Design files location | Designs lived outside the repo | **Resolved:** copied into `docs/design/` (≈9 MB) with the PRD PDF in `docs/`. Treat them as read-only; a new design version replaces the file in a `contract/*` PR | all |
| Q19 | Merge cadence | Fixed target dates per scope | **Decided:** no fixed dates. Each scope merges when it is complete, in order. P0 slices still come before P1 slices | all |
| Q20 | Git remote | The local repo pointed at `zayn-tech-info/leash` | **Resolved:** `origin` is now `github.com/OjogoMercy/ParkTrack`; the old URL is kept as remote `leash` | all |
| Q21 | Per-person push limits | GitHub only lets you say *which people* may push to a branch on repos owned by an **organization**. On a personal repo every collaborator with write access can push wherever branch rules allow | Use rulesets that block direct pushes everywhere (PRs only) and only let the owner merge to `main`. For hard per-person limits on scope branches, move the repo into a free GitHub organization with one team per scope (see WORKFLOW §3) | all |
| Q22 | Package manager | Scope 01 first used pnpm; on Windows it needed a corepack workaround (no admin rights) | **Decided:** npm. It ships with Node; commit `package-lock.json`; no pnpm or yarn lockfiles | all |
