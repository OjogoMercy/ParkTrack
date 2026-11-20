# Workflow: scope branches, slice PRs and the owner-only merge to main

Repo: **https://github.com/OjogoMercy/ParkTrack** · Owner: **OjogoMercy** (the only person who merges into `main`).

## 1. Words we use

- **Scope**: one piece of the product (01 → 09). Each scope lives on **its own long-lived branch**.
- **Slice**: a small step inside a scope with its own check. Each slice is **one PR into its scope branch**.
- **Contracts**: shared types, zod schemas, the DB schema and the service signatures that Scope 01 freezes. Everyone builds against them (§6).

## 2. Branches

```
main                                   ← owner only; receives one PR per completed scope, in order
├─ scope/01-foundation                 ← receives slice PRs for Scope 01
│   ├─ s01/sl1-scaffold      ← slice branch, PR into scope/01-foundation
│   ├─ s01/sl2-ci
│   └─ …
├─ scope/02-identity
│   ├─ s02/sl3-otp
│   └─ …
├─ scope/03-parcel-engine
├─ scope/04-payments
├─ scope/05-sender
├─ scope/06-origin
├─ scope/07-driver
├─ scope/08-arrival
└─ scope/09-admin-launch
```

| Branch | Who pushes | How work gets in |
|---|---|---|
| `main` | **Nobody pushes directly.** Only the owner merges. | One PR from `scope/NN-*` when that whole scope is complete and the previous scope is already merged |
| `scope/NN-name` | Nobody pushes directly | Slice PRs only, reviewed and merged by that scope's lead |
| `sNN/slX-short-name` (e.g. `s01/sl3-tokens`) | The person doing that slice | Normal commits; open a PR into `scope/NN-name` when the slice check passes. **Kept after the slice PR merges; deleted only once the whole scope is merged into `main`** (§4 step 6) |

Commit messages: `S05/sl3: one-page booking form with live total`.

## 3. Protection rules the owner sets on GitHub

Settings → Rules → Rulesets → **New branch ruleset**. Two rulesets:

**Ruleset A — `main`** (target: default branch)
- Enforcement: Active. Bypass list: **Repository admin** role only (on a personal repo that is just the owner; collaborators get the Write role, not Admin).
- Rules: Restrict updates · Restrict deletions · Block force pushes · Require a pull request before merging · Require status checks `ci` (added by Scope 01 sl2).
- Result: collaborators can open PRs into `main` but **cannot merge them or push to `main`**. Only the owner can merge. The bypass also technically lets the owner push straight to `main`; the team rule is that the owner only merges completed scope PRs.

Note: rulesets are free on public repos; on a private personal repo they need GitHub Pro. If neither applies, use Settings → Branches → classic branch protection on `main` (require PR, require `ci`) and add collaborators with Write while the owner stays the only Admin.

**Ruleset B — `scope/*`** (target: `scope/*`; slice branches use the separate `sNN/` prefix so they are not covered)
- Restrict deletions · Block force pushes.
- Require a pull request before merging: 1 approval (the scope lead).
- Require status checks: `ci`.
- Result: nobody can push straight onto any scope branch; every change arrives as a reviewed slice PR.

**Per-person limits (scope 2 people can't touch scope 1's branch).** GitHub lets you name *which people or teams* may push to or merge into a branch only when the repo belongs to an **organization**. On a personal repo, rulesets apply to everyone with write access. If you need the hard limit:
1. Create a free organization, then Settings → Transfer the repo into it (links and clones keep working through a redirect).
2. Create one team per scope (`scope-01` … `scope-09`) and give them write access.
3. Add one ruleset per scope branch (`scope/02-identity`, …) with "Restrict updates" and that scope's team as the only bypass actor.

Without an organization, Ruleset B still stops direct pushes, and **only the scope lead approves slice PRs** into their branch, so a scope 2 person can open a PR against scope 1 but can't get it merged.

## 4. Order: how "scope 2 can't land before scope 1" works

1. **Scope 01 goes first, alone.** Every other scope needs its schema, contracts and design system. No other scope branch is created until `scope/01-foundation` is merged into `main`.
2. When Scope 01 merges, the owner tags it and creates the other branches from `main`:
   ```powershell
   git tag scope-01-done; git push origin scope-01-done
   ```
   ```powershell
   foreach ($b in "02-identity","03-parcel-engine","04-payments","05-sender","06-origin","07-driver","08-arrival","09-admin-launch") { git push origin "main:refs/heads/scope/$b" }
   ```
3. **Scopes 02–09 build at the same time**, each on its own branch, against Scope 01's stubs (§5).
4. **Merges into `main` happen strictly in order** 02 → 03 → … → 09. The owner merges scope N only when:
   - scope N−1 is merged and tagged `scope-(N-1)-done`, and
   - every P0 slice in scope N's file is merged into its branch and its PR checklist (§7) is ticked.
   Optional safety net: Scope 01's CI can add a `scope-gate` check that fails a `scope/NN-*` → `main` PR while the tag `scope-(NN-1)-done` is missing.
5. After each merge into `main`, every scope lead still building merges `main` into their scope branch (via a PR) the same day, so later scopes always sit on top of the real code.
6. **Branch cleanup, only after the scope is in `main`.** Slice branches are kept while their scope is in progress, so you can still look back at each slice. Once scope NN is merged into `main` and tagged, the owner deletes that scope's slice branches in one go (example for scope 01):
   ```powershell
   git ls-remote --heads origin "refs/heads/s01/*" | ForEach-Object { git push origin --delete ($_ -split "\s+")[1] }
   ```
   The slice PRs, their reviews and commits stay visible on GitHub under Pull requests → Closed. Leave "Automatically delete head branches" **off** in Settings → General, otherwise GitHub deletes each slice branch the moment its PR merges. The `scope/NN-*` branch itself can be deleted at the same time if you want; the `scope-NN-done` tag marks where it was.

**Pace:** no fixed dates. A scope merges when it is complete. P0 slices come before P1 slices everywhere.

## 5. Building in parallel: stub-first contracts

Scope 01 creates every shared service module as a **stub** with its final exported signature, for example `src/server/payments/index.ts` exporting `startPayment()`, `applyVerifiedPayment()`, `settleParcel()`. Stubs return realistic fixture data so callers work end to end on day one.

- Downstream scopes import from the **real path** (`@/server/payments`), never from a mock path.
- The owning scope **replaces the internals** of its stub but keeps every exported name and type. When it merges, callers become real with no change on their side.
- UI can also use the API fixtures in `src/mocks/`.
- Each scope's **last slice is "wire-up"**: merge `main` in, drop any temporary fixture use, run the flow against the services that have merged by then.

## 6. Where code goes (prevents merge conflicts)

Branches keep people apart while they work; folders keep the **merges into `main`** clean. Put your code in your scope's folders so that when nine branches land one after another, they don't collide. This is a convention, checked in review, not a CI block.

| Path | Scope |
|---|---|
| `prisma/**`, `src/contracts/**`, `src/components/ui/**`, `src/lib/**`, `src/mocks/**`, `.github/**`, root config | 01 |
| `src/proxy.ts`, `src/server/{auth,parks}/**`, `src/app/sites/[park]/{layout,not-found,signin}*`, `src/app/console/{layout,signin}*`, `src/app/api/{auth,park}/**`, `src/features/identity/**` | 02 |
| `src/server/{parcels,notify,uploads}/**`, `src/app/api/uploads/**`, `src/features/parcel-engine/**` | 03 |
| `src/server/{payments,ledger}/**`, `src/app/pay/**`, `src/app/api/{payments,webhooks,ledger}/**`, `src/app/api/parcels/[id]/pay/**`, `src/app/api/jobs/requery/**`, `src/features/payments/**` | 04 |
| `src/server/{booking,recipients,vendors}/**`, `src/app/sites/[park]/(sender)/**` *except* `parcels/[code]/**`, `src/app/api/parcels/route.ts`, `src/app/api/{me,quote}/**`, `src/features/sender/**` | 05 |
| `src/server/{handshake,dropoff,assignment}/**`, `src/app/console/counter/**`, `src/app/api/{handshake,counter}/**`, `src/app/api/parcels/[id]/{dropoff,refuse}/**`, `src/app/api/parcels/assign/**`, `src/features/counter/**` | 06 |
| `src/server/{trips,roadside,tracking}/**`, `src/app/console/driver/**`, `src/app/t/**`, `src/app/sites/[park]/(sender)/parcels/[code]/**`, `src/app/api/{driver,trips,track}/**`, `src/app/api/parcels/[id]/{roadside,cancel}/**`, `src/features/{driver,tracking}/**` | 07 |
| `src/server/{arrival,collection}/**`, `src/app/console/arrivals/**`, `src/app/collect/**`, `src/app/api/{manifests,collect,arrivals}/**`, `src/app/api/parcels/[id]/{release,admin-release}/**`, `src/features/{arrival,collection}/**` | 08 |
| `src/server/{admin,jobs,disputes}/**`, `src/app/console/{park,platform}/**`, `src/app/api/{admin,disputes,dashboard}/**`, `src/app/api/jobs/**` *except* `requery/**`, `src/features/admin/**`, PWA + deploy config, `scripts/**`, `docs/demo-checklist.md` | 09 |

**Route-segment rule:** under `src/app/api/parcels/` the dynamic segment is always named `[id]` (Next.js forbids two different slug names at one level). Lookups by short code live under each scope's own prefix (for example `/api/track/parcel/[code]`).

Shared UI pieces (QR display, QR scanner, photo capture, OTP input, status badge, timeline, bottom tabs) are built once in Scope 01 under `src/components/ui/`.

## 7. Changing a contract after Scope 01 has merged

1. Prefer an additive change inside your own scope's folders.
2. If a shared contract must change (`prisma/schema.prisma`, `src/contracts/**`, `src/components/ui/**`, `docs/design/**`, the PRD), open a small PR from `contract/<short-name>` **straight to `main`**. Additive only (new optional field, new enum value at the end, new type). The owner merges it out of order, since it blocks nobody; every scope then merges `main` into its branch.

## 8. Definition of done

**Slice PR → scope branch** (scope lead approves):
- [ ] The slice's check in the scope file passes (say how you checked it).
- [ ] `ci` green (typecheck, lint, test, build).
- [ ] Code sits in the scope's folders (§6).

**Scope PR → `main`** (owner merges):
- [ ] Previous scope is merged and tagged.
- [ ] Every **P0** slice is merged into the scope branch; P1 slices are done or listed as "not done".
- [ ] `main` was merged into the scope branch and the flow still works.
- [ ] No contract changed outside §7.
- [ ] Money is integer kobo everywhere; formatted only with `formatNaira()`.
- [ ] Every parcel status change goes through the Scope 03 `transition()` service.
- [ ] No secret in the client bundle or in Git; new env keys are in `.env.example`.
- [ ] Screens checked against `docs/design/` at 390 px (1280 px for admin).
- [ ] PR body lists what was verified for real (Interswitch sandbox, real SMS, real DB) vs what still runs on a stub.
- [ ] After merge, the owner tags `scope-NN-done`, pushes the tag, and deletes that scope's `sNN/*` slice branches (§4 step 6).

## 9. PR templates

Scope 01 commits `.github/pull_request_template.md`:

```
## Scope NN — <name>  ·  slice slX (or "full scope → main")
### What changed
### Check (from the scope file) and how it was verified
### Verified for real / still on stubs
### Contract changes: none | link
### Screens (390 px before/after)
```

## 10. Rules for everyone (and every AI coding agent)

1. Read `docs/README.md`, this file and your scope file before writing code. The PRD is `docs/ParkTrack_PRD_v1.1.pdf`; screens are in `docs/design/`.
2. Work only on your scope's branch, in your scope's folders. If you need something elsewhere, write it in the PR body and stop.
3. Never trust Interswitch redirect values; payments are verified only by server requery (response `00` and exact kobo amount).
4. QR codes carry only random IDs. Never put names, phones or amounts in a QR or a URL query string.
5. Recipient phone and pay-on-delivery amounts are visible only to the roles in PRD §9 "Data visibility". Every staff query is park-scoped.
6. Codes (collection, OTP, SMS handshake) are 6 digits, stored hashed, expire, and are rate-limited.
7. Anything unclear: check `reference/open-questions.md`; if it's not there, ask, don't guess.
