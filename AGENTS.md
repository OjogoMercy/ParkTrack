# ParkTrack: notes for AI coding agents

Before writing code, read:

1. `docs/README.md`: the build plan and the 9 scopes
2. `docs/WORKFLOW.md`: branches (`scope/NN-*`, slices `sNN/slX-*`), PR rules, where code goes (§6), contract changes (§7), rules (§10)
3. Your scope file in `docs/scopes/`
4. `docs/reference/open-questions.md`: decided defaults (6-digit codes, fare split 60/40, ...)

Package manager is **npm** (commit `package-lock.json`; never add pnpm/yarn lockfiles). Work only in your scope's folders. Money is integer kobo. Parcel status changes only through `@/server/parcels` `transition()`. QR codes carry random IDs only.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
