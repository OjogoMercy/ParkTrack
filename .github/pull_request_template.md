<!--
Title: "S0N/slX: short description" for a slice PR, or "Scope 0N — <name>" for a scope PR into main.
Slice PRs go from sNN/slX-name into scope/NN-name. Scope PRs go from scope/NN-name into main (owner merges).
See docs/WORKFLOW.md.
-->

## Scope NN — <name> · slice slX (or "full scope → main")

### What changed

-

### Check (from the scope file) and how it was verified

- [ ] Slice check: …
- [ ] `npm run check` passes (typecheck, lint, test, format)
- [ ] `npm run build` passes

### Verified for real / still on stubs

- Real:
- Stubs / fixtures:

### Contract changes

none <!-- or link to the contract/* PR -->

### Screens (390 px before/after)

<!-- screenshots, or "no UI change" -->

### Scope PR into main only

- [ ] Previous scope is merged and tagged `scope-(NN-1)-done`
- [ ] Every P0 slice is merged; P1 slices done or listed as not done
- [ ] `main` merged into this scope branch and the flow still works
- [ ] Money in kobo, status changes via `transition()`, no secrets in client or Git
