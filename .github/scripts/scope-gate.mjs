// Branch rules for PRs (docs/WORKFLOW.md §2–§4).
//
// Into main:          contract/*            → always allowed (WORKFLOW §7)
//                     scope/NN-name         → allowed once tag scope-(NN-1)-done exists (01 needs none)
//                     anything else         → blocked
// Into scope/NN-name: sNN/<slice>           → allowed (that scope's own slices)
//                     main                  → allowed (syncing main into the scope)
//                     anything else         → blocked (e.g. a scope 02 slice into scope 01)
// Any other base:     not governed here.
//
// Run in CI by .github/workflows/branch-rules.yml. Locally:
//   BASE_REF=main HEAD_REF=scope/02-identity node .github/scripts/scope-gate.mjs

import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const SCOPE_BRANCH = /^scope\/(\d{2})-[a-z0-9-]+$/;
const SLICE_BRANCH = /^s(\d{2})\/[a-z0-9][a-z0-9-]*$/;

const pad = (n) => String(n).padStart(2, "0");

/**
 * @param {{ base: string, head: string, tags: string[] }} input
 * @returns {{ ok: boolean, message: string }}
 */
export function checkPr({ base, head, tags }) {
  if (base === "main") {
    if (head.startsWith("contract/")) {
      return {
        ok: true,
        message: `Contract change ${head} → main is allowed.`,
      };
    }
    const scope = SCOPE_BRANCH.exec(head);
    if (!scope) {
      return {
        ok: false,
        message: `Only completed scope branches (scope/NN-name) or contract/* branches may merge into main. Got "${head}".`,
      };
    }
    const n = Number(scope[1]);
    if (n <= 1) {
      return {
        ok: true,
        message: `Scope 01 has no predecessor; ${head} → main is allowed.`,
      };
    }
    const needed = `scope-${pad(n - 1)}-done`;
    if (tags.includes(needed)) {
      return {
        ok: true,
        message: `Found tag ${needed}; ${head} → main is allowed.`,
      };
    }
    return {
      ok: false,
      message: `Scope ${pad(n)} can't merge into main until scope ${pad(n - 1)} is merged and tagged "${needed}". After the owner pushes that tag, re-run this check.`,
    };
  }

  const target = SCOPE_BRANCH.exec(base);
  if (target) {
    const nn = target[1];
    if (head === "main") {
      return { ok: true, message: `Syncing main → ${base} is allowed.` };
    }
    const slice = SLICE_BRANCH.exec(head);
    if (slice && slice[1] === nn) {
      return { ok: true, message: `Slice ${head} → ${base} is allowed.` };
    }
    if (slice) {
      return {
        ok: false,
        message: `"${head}" is a slice of scope ${slice[1]}; it can't merge into ${base} (scope ${nn}).`,
      };
    }
    return {
      ok: false,
      message: `Only s${nn}/<slice> branches (or main) may merge into ${base}. Got "${head}". Name slice branches like s${nn}/sl3-short-name.`,
    };
  }

  return { ok: true, message: `Base "${base}" is not governed by scope-gate.` };
}

function remoteTags() {
  const out = execFileSync("git", ["ls-remote", "--tags", "origin"], {
    encoding: "utf8",
  });
  return out
    .split("\n")
    .map((line) => line.split("\t")[1] ?? "")
    .filter((ref) => ref.startsWith("refs/tags/") && !ref.endsWith("^{}"))
    .map((ref) => ref.slice("refs/tags/".length));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const base = process.env.BASE_REF ?? "";
  const head = process.env.HEAD_REF ?? "";
  if (!base || !head) {
    console.error("BASE_REF and HEAD_REF must be set.");
    process.exit(2);
  }
  const result = checkPr({ base, head, tags: remoteTags() });
  console.log(`${result.ok ? "✔" : "✖"} ${result.message}`);
  process.exit(result.ok ? 0 : 1);
}
