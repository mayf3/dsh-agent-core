# Code Structure Guardrails V1 — repository-local binding rule

```text
RULE_ID = CODE_STRUCTURE_GUARDRAILS_V1
RULE_KIND = repository-local binding rule (carried by .agents/local/, not a docs/specs governing Spec)
ACTIVATION = merged into main (same activation rule as the rest of .agents/local/README.md)
ENFORCEMENT = machine verifier (scripts/verify-code-structure.mjs) + manual review
BASELINE_COMMIT = d506f81105e8aa05177a01b817ebe11dcc076ba5 (origin/main @ 2026-08-22)
RECORDED_UNDER = owner task mandate 2026-08-22; ratified by PR review/merge (SPEC_ACCEPTANCE_ACTORS)
```

This file is a repository-local extension owned by `mayf3/dsh-agent-core`, in the same
sense as the "Local rules" and "Legacy transition" sections of `.agents/local/README.md`
(SPEC_GOVERNANCE_V0 §2: `.agents/local/README.md` owns repository-specific authority and
exceptions). It is not a governing Spec and carries no `spec_id` lifecycle; it becomes
active repository rule when this exact content is present on `main`, and it is changed
only through a new whole-version file (`..._V2`) or an owner-accepted amendment PR —
never silently rewritten in place.

## 1. Goal

Bound the size and nesting of handwritten code so review stays possible: no file so
large that its diff cannot be reviewed, no directory so wide that its contents cannot
be surveyed, no module tree so deep that ownership is unclear.

## 2. Scope

In scope (handwritten code):

```text
packages/<pkg>/src/**
packages/<pkg>/test/**
scripts/**
examples/** handwritten source / test / executable code
other handwritten source / test / executable code added in the future
  (new handwritten executable code outside these roots MUST either be placed under
  scripts/ or a package, or extend includeRoots in the registry via rule change)
```

Out of scope (never line/directory-counted as handwritten code):

```text
docs/specs/** docs/decisions/** docs/investigations/** docs/evidence/** docs/reports/**
.agents/protocol/** and every file pinned in .agents/governance.lock.json (vendored)
generated files listed in the registry generatedAllowlist
lockfiles, snapshots (*.snap), binary assets, node_modules, git/worktree metadata
```

## 3. Frozen limits (immutable values of V1)

```text
HANDWRITTEN_FILE_WARNING_LINES = 400
HANDWRITTEN_FILE_MAX_LINES = 500
DIRECTORY_WARNING_CHILDREN = 16
DIRECTORY_MAX_CHILDREN = 20
MAX_DIRECTORY_DEPTH_FROM_MODULE_ROOT = 4
LINE_COUNT_MODE = PHYSICAL_LINES_INCLUDING_COMMENTS_AND_BLANKS
DIRECTORY_COUNT_MODE = IMMEDIATE_TRACKED_CHILDREN
DEPTH_ROOT = NEAREST_PACKAGE_OR_MODULE_ROOT (nearest ancestor directory containing
package.json; repository root is the fallback module root)
MAX_STATEMENTS_PER_LINE = 3
BARREL_MAX_LINES = 60
BARREL_MAX_REEXPORTS = 20
```

A change to any frozen value requires a new rule version (`CODE_STRUCTURE_GUARDRAILS_V2`)
with explicit owner acceptance — never an in-place edit of this file.

## 4. File rule

- A handwritten code file with more than `500` physical lines is a violation.
- `401..500` physical lines is a warning (review attention, split encouraged).
- Physical lines include comments and blank lines; the count is the number of
  newline-separated lines (a trailing newline does not add a line).
- A barrel-style `index.*` file (re-export hub: more than `BARREL_MAX_REEXPORTS`
  re-export/import-from lines AND re-export lines are more than half of its
  non-blank lines) with more than `BARREL_MAX_LINES` lines or more than
  `BARREL_MAX_REEXPORTS` re-exports is a violation. A large `index.js` that is
  mostly implementation is governed by the ordinary file rule instead.

## 5. Directory rules

- A directory in scope with more than `DIRECTORY_MAX_CHILDREN` immediate tracked
  children (files plus subdirectories, tracked in git at the reviewed head) is a
  violation; `17..20` children is a warning.
- A code file whose containing directory is deeper than
  `MAX_DIRECTORY_DEPTH_FROM_MODULE_ROOT` levels below its nearest package/module
  root is a violation; depth exactly `4` is a warning.
- Deep nesting is not an accepted way to stay under the children limit: the depth
  limit and the per-level children limit are enforced together.

## 6. Legacy policy (frozen)

```text
NEW_FILE_OVER_500 = HARD_FAIL                 (no registry entry may excuse a new file)
EXISTING_UNTOUCHED_OVER_500 = GRANDFATHERED   (baseline files, untouched: pass)
EXISTING_TOUCHED_OVER_500 = MUST_NOT_GROW     (head physical lines > baseline = violation)
MAJOR_CHANGE_TO_EXISTING_OVER_500 = MUST_SPLIT
MAJOR_CHANGE_THRESHOLD = ADDED_LINES > 100 OR CHANGED_LINES > 20_PERCENT_OF_BASE_FILE
  ADDED_LINES   = lines added by the diff (base..head)
  CHANGED_LINES = lines added + lines deleted by the diff (base..head)
```

- A file at or below 500 baseline lines that crosses above 500 at head is a new
  violation (nothing "grows into" grandfather status).
- Untouched grandfathered files pass without action; they are still listed in the
  registry so the debt is visible and expires.
- Any touch to a listed legacy file requires it to stay within its registry entry;
  growth or a major change is rejected and must arrive as a split (new smaller
  files) instead.

## 7. Exception registry

Machine registry: `.agents/structure-registry.json`, validated by the verifier.

File entries — required fields:

```text
path
approved_max_lines   (= baseline physical lines; the ceiling, growth beyond it fails)
reason
approved_by          (must be mayf3, or a maintainer recorded as acceptance actor)
expires_at           (YYYY-MM-DD; a passed date invalidates the whole registry = exit 2)
split_followup       (how/when the file gets split)
```

Directory entries — same fields with `approved_max_children` instead of
`approved_max_lines`.

Registry validity rules (exit code 2 on breach):

- required fields present and parseable; `approved_by` is an accepted actor;
- `expires_at` is a valid future date;
- every file entry must reference a file that exists at the baseline commit with
  more than 500 physical lines (a file that only exists on a feature branch — for
  example a PR branch — can never be grandfathered);
- every directory entry must reference a directory that exceeds 20 children at the
  baseline commit;
- no duplicate paths; `rules_version` must equal `RULE_ID`.

PR #42 hard rule: the four PR #42 files (`packages/agent-router/src/process.js`,
`packages/agent-router/src/index.js`,
`packages/agent-router/src/reconciliation-store.js`,
`packages/agent-router/test/process-lifecycle.test.js`) must NOT be given any
registry exception for their PR #42 state. The two files that exist at baseline
(`process.js` 578 lines, `index.js` 870 lines) are ordinary grandfathered baseline
entries whose ceiling is their baseline line count; PR #42's rewritten versions
(1773 / 1259 lines) exceed those ceilings and fail MUST_NOT_GROW / MUST_SPLIT. The
two files that exist only on the PR branch (619 / 917 lines) are new files over 500
and fail NEW_FILE_OVER_500; they cannot be registered at all.

## 8. Anti-evasion rules

- `MAX_STATEMENTS_PER_LINE = 3`: packing multiple unrelated statements on one line
  to defeat the line count is a violation. The verifier flags any line with more
  than 3 statements when the line is added by the reviewed diff, and reports
  (informational) pre-existing dense lines in the JSON output.
- Barrel inflation: hiding implementation mass in a re-export hub is a violation
  (§4 barrel limits).
- Copy-split: duplicating the same logic into several small files defeats the intent.
  The verifier reports exact-content duplicates as a warning today; hardening
  direction (recorded, future rule version): normalized near-duplicate detection
  (token-sequence similarity across in-scope files) upgraded to violation.
- Deep-directory evasion: prevented by the joint depth + children limits (§5).
- Fake "generated" claims: a newly added file that declares itself generated
  (`@generated` / `DO NOT EDIT` banner in its first lines) without being listed in
  the registry `generatedAllowlist` is a violation; the allowlist requires owner
  approval like any registry change.
- Test logic hidden in fixtures: a fixture-named file that contains test-runner
  constructs (node:test / describe / test / assert usage) is classified as test
  code and subject to the same limits; adding such a fixture is a violation.

## 9. Machine verifier

```bash
node scripts/verify-code-structure.mjs --base <ref> --head <ref> [--json]
npm run verify:structure   # --base origin/main --head HEAD
```

Checks: `FILE_LINE_LIMIT`, `DIRECTORY_CHILD_LIMIT`, `DIRECTORY_DEPTH_LIMIT`,
`EXCEPTION_REGISTRY`, `NO_NEW_LEGACY_VIOLATION`.

Exit codes:

```text
0 = PASS (warnings allowed)
1 = STRUCTURE_VIOLATION
2 = INVALID_CONFIGURATION_OR_REGISTRY (bad refs/args, missing/malformed/expired registry)
```

Every finding carries: `path`, `physicalLines`, `directChildren`, `depth`,
`classification`, `rule`, `baselineValue`, `headValue`, `exception`.

## 10. Baseline record (measured at BASELINE_COMMIT, 2026-08-22)

```text
FILES_OVER_500 = 21          (structure investigation expected 22; delta = PR #42-only
                              new file packages/agent-router/src/reconciliation-store.js
                              619 lines, which does not exist on main)
FILES_401_TO_500 = 12        (matches expectation)
LEGACY_DIRECTORY_OVER_20 = scripts/ with 38 immediate tracked children
                             (expected 37; measured 38 — all 38 are handwritten scripts)
LEGACY_DIRECTORY_OVER_20 registry ceiling = 39 (38 baseline + this rule's own verifier
  script scripts/verify-code-structure.mjs, owner-mandated placement; no further growth)
MAX_DEPTH_OBSERVED = 3       (no depth violations at baseline)
BARRELS_OVER_LIMIT = 0
```

All 21 over-500 files and the `scripts/` directory are recorded in
`.agents/structure-registry.json` with `approved_by: mayf3`, `expires_at: 2027-08-22`,
and per-file `split_followup`. Entries were recorded mechanically under the owner
task mandate; they are ratified (or rejected) through this rule's PR review by an
accepted actor, and expire after one year unless renewed by a rule change.

## 11. Rule lifecycle

- This rule binds code changes merged after it becomes active on `main`.
- Forward-only: the baseline registry records existing debt; it does not license
  new debt (`NO_BULK_HISTORY_REWRITE = YES`).
- Changing any frozen value or scope requires a new whole-version rule file
  (`CODE_STRUCTURE_GUARDRAILS_V2`) superseding this one, accepted by
  `SPEC_ACCEPTANCE_ACTORS`; registry housekeeping (expiry renewal, adding a
  generatedAllowlist entry, listing a newly split file) is an owner-reviewed PR
  that does not change frozen values.
