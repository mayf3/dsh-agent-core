# Code Structure Guardrails V2 — proposed repository-local binding rule

```text
RULE_ID = CODE_STRUCTURE_GUARDRAILS_V2
RULE_KIND = repository-local binding rule (carried by .agents/local/, not a docs/specs authority)
LIFECYCLE = PROPOSED
EFFECTIVE_RULE = CODE_STRUCTURE_GUARDRAILS_V1 until this exact V2 is accepted and merged into main
SUPERSEDES = CODE_STRUCTURE_GUARDRAILS_V1 (only upon V2 acceptance and merge)
IMPLEMENTATION_CONTRACTS = CODE_STRUCTURE_VERIFIER_CONFORMANCE_V1
ENFORCEMENT = machine verifier (scripts/verify-code-structure.mjs) + manual review
BASELINE_COMMIT = d506f81105e8aa05177a01b817ebe11dcc076ba5 (unchanged from V1)
ACCEPTANCE_ACTORS = mayf3 or an explicitly authorized maintainer recorded in the acceptance PR
REGISTRY_APPROVAL_ACTORS = [mayf3] (a different actor requires an accepted rule change; prose alone cannot extend this list)
```

This is a proposed whole-version successor to the accepted local V1 rule. It has no effect before Owner acceptance and merge. The implementation contracts are defined once in `docs/specs/CODE_STRUCTURE_VERIFIER_CONFORMANCE_V1.md`; this file remains the single authority for structural thresholds and rule semantics.

## 1. Goal and scope

Bound the size and nesting of handwritten code so review stays possible. Apply the same V1 scope, exclusions, counting methods, warning thresholds, hard limits, and anti-evasion controls. V2 adds an honest distinction between the candidate's new/affected violations and unchanged historical debt. Historical debt remains visible and never becomes a valid exception or a repository-wide PASS.

The in-scope and excluded paths are unchanged from V1:

```text
IN_SCOPE = packages/<pkg>/src/**, packages/<pkg>/test/**, scripts/**, examples/**,
           other handwritten source/test/executable code admitted by V1 §2
EXCLUDED = docs/specs/**, docs/decisions/**, docs/investigations/**,
           docs/evidence/**, docs/reports/**, .agents/protocol/**,
           governance-lock-pinned files, generated allowlist, lockfiles,
           snapshots, binary assets, node_modules, git/worktree metadata
```

New handwritten executable code outside current roots MUST be placed under `scripts/` or a package, or requires a separately accepted rule version that changes scope.

## 2. Frozen limits retained from V1

V2 preserves every V1 numerical limit and measurement mode:

```text
HANDWRITTEN_FILE_WARNING_LINES = 400
HANDWRITTEN_FILE_MAX_LINES = 500
DIRECTORY_WARNING_CHILDREN = 16
DIRECTORY_MAX_CHILDREN = 20
MAX_DIRECTORY_DEPTH_FROM_MODULE_ROOT = 4
MAX_STATEMENTS_PER_LINE = 3
BARREL_MAX_LINES = 60
BARREL_MAX_REEXPORTS = 20
LINE_COUNT_MODE = PHYSICAL_LINES_INCLUDING_COMMENTS_AND_BLANKS
DIRECTORY_COUNT_MODE = IMMEDIATE_TRACKED_CHILDREN (files plus directories)
DEPTH_ROOT = NEAREST_PACKAGE_OR_MODULE_ROOT (nearest package.json ancestor; repository root fallback)
```

A line-count, directory-count, depth, or scope change requires a new whole rule version; registry or implementation changes cannot alter these values.

## 3. File and directory requirements retained from V1

- An in-scope handwritten file over 500 physical lines violates the limit. 401–500 lines is a warning. A trailing newline does not add a line.
- A barrel-style `index.*` file is a re-export hub with more than 20 re-export/import-from lines and re-export lines exceeding half of its non-blank lines. It violates the rule above 60 lines or above 20 re-exports. A large implementation `index.*` file that is mostly implementation uses the ordinary file limit.
- An in-scope directory with more than 20 immediate tracked children violates the limit; 17–20 is a warning.
- A source file more than four levels below its nearest module root violates the depth limit; depth exactly four is a warning. Directory width and depth are jointly enforced.
- `NEW_FILE_OVER_500 = HARD_FAIL`; `EXISTING_UNTOUCHED_OVER_500 = GRANDFATHERED`; `EXISTING_TOUCHED_OVER_500 = MUST_NOT_GROW`; `MAJOR_CHANGE_TO_EXISTING_OVER_500 = MUST_SPLIT`.
- The major-change threshold remains `ADDED_LINES > 100 OR CHANGED_LINES > 20_PERCENT_OF_BASE_FILE`, where changed lines are additions plus deletions in exact `--base..--head`.
- A file at or below 500 lines at comparison base that crosses above 500 at head is a hard violation. Registry rows cannot excuse new or newly oversized files.
- A legacy file edit MUST NOT increase its line count over the exact comparison base. A major edit to a grandfathered file must split. Registry metadata cannot waive either rule.

## 4. Fixed-baseline registry and V1 migration

The only eligibility anchor remains the immutable `BASELINE_COMMIT` above. It is read from the accepted V2 rule and resolved to a full commit OID. The registry MUST name exactly that OID. `--base`, `--head`, a branch name, a PR base, and a current file size MUST NOT replace or advance it.

An active file exception is valid only when the path exists at the fixed baseline and has more than 500 physical lines there. Its `approved_max_lines` remains the exact accepted V1 value, equal to the measured baseline line count. An active directory exception is valid only when the path exists at the fixed baseline and has more than 20 immediate tracked children there. Its `approved_max_children` remains the exact accepted V1 value and MUST be at least the measured baseline count; V1 permits Owner-reviewed directory caps above that count, so V2 MUST preserve the accepted value and MUST NOT infer it from the reason field. For both kinds, the value cannot change in the V1-to-V2 migration. Required `reason`, `approved_by`, `expires_at`, and `split_followup` fields remain mandatory. Expiry MUST be a valid `YYYY-MM-DD` calendar date later than the verifier's UTC date; no unknown or malformed expiry is accepted. `approved_by` MUST be in `REGISTRY_APPROVAL_ACTORS` and active registry changes must already exist in the exact implementation comparison base; prose in the same candidate cannot authorize itself. Expired active entries, malformed records, duplicate paths, invalid actors, invalid metrics, mismatched baseline, or unreadable refs invalidate the registry and fail closed (exit 2).

The V1 registry uses `schema_version: 1`, `files`, `directories`, `generated_allowlist`, and `baseline_commit`. The first V2 migration MAY change `schema_version` to `2`, change `rules_version`, retain the other top-level keys, and add `historical_debt`. The `files` and `directories` arrays then contain only active exceptions; `historical_debt` contains unresolved history that is not an exception.

Partition exact V1 rows as follows:

- A row that is mechanically eligible at the fixed baseline and whose comparison-base metric is within its existing approved cap remains in `files` or `directories`; preserve every original field and cap exactly.
- A row that fails fixed-baseline eligibility, or an otherwise eligible row whose comparison-base metric exceeds its recorded cap, is copied to `historical_debt` and removed from the active exception array. Each debt record MUST retain the source collection (`files` or `directories`), the exact original V1 row, its SHA-256, original path and kind, fixed-baseline measurement, observed comparison-base measurement, and state `OPEN`. Its deterministic ID is `<source-collection>:<lowercase-SHA256-of-canonical-source-row>`; canonical JSON recursively sorts object keys, preserves array order, uses UTF-8, and has no insignificant whitespace.

This includes presently measured later-baseline entries under `packages/broker/src/capabilities/workflow.js`, `packages/production-runtime/src/compose.js`, `scripts/trusted-cp-deploy-install.sh`, `packages/agent-router/test`, `packages/production-runtime/test`, and `packages/feishu-connector/test`, plus any active-cap overrun such as `scripts/`. The verifier MUST derive and report exact status rather than infer authority from registry prose.

Migration MUST NOT delete or rewrite V1 rows, infer authority from `reason` text, raise a recorded cap to current size, select a later baseline, or make a previously invalid row eligible. A row that cannot be parsed or tied byte-for-byte to the V1 registry is not debt; it is invalid configuration and fails closed. Migration is a one-time V1-to-V2 transformation validated by the implementation Spec. After migration, a schema downgrade or a second migration is invalid.

No new file or directory exception may be created from candidate-tree state. A future exception addition is allowed only for a path independently shown to violate the same fixed baseline, in a separate owner-accepted registry-only change already present in the implementation comparison base. It cannot be combined with the source change that relies on it. It cannot authorize growth above its exact fixed-baseline cap. Expiry renewal, generated-allowlist additions, and closure of a split exception likewise must be accepted into the comparison base before dependent code relies on them. The V1-to-V2 migration is the sole migration exception and MUST match the exact partition above.

## 5. Candidate-delta gate and historical debt

The verifier evaluates exact resolved `--base` and `--head` commit OIDs under this rule and produces two independent results:

```text
CANDIDATE_DELTA = PASS | FAIL
BASELINE_DEBT = <stable list of inherited unresolved findings>
RESOLVED_BASELINE_DEBT = <stable list of findings resolved by this candidate>
```

A historical finding is `BASELINE_DEBT` only when the same rule/path/key and measured violation are present at both comparison base and head, the underlying registry/debt record is unchanged, and the finding is not on an affected surface. During the single V1-to-V2 migration, “unchanged” means the exact canonical V1 row and hash from base are preserved once in the corresponding active or debt record at head; after migration, the canonical V2 record must match at base and head. Debt is never called an exception, conformance, or repository-wide PASS. A clean candidate may exit 0 while debt remains, but output MUST say `CANDIDATE_DELTA_PASS_WITH_BASELINE_DEBT` and enumerate debt. It MUST NOT emit an undifferentiated `PASS`.

New findings, changed findings, or inherited debt on an affected surface are candidate violations. Malformed, unknown, missing-unresolved, expired-active, or authority-invalid registry data is configuration failure (exit 2), not debt. An arbitrary registry mutation cannot hide a finding by deleting its row, changing its path, changing its kind, changing its baseline, or moving it to an unrecognized collection. The only permitted debt-record mutation after migration is the exact `OPEN` to `RESOLVED` transition with the machine-verifiable closure evidence below; the original debt ID/hash and terminal record remain present.

A debt record can close only with machine-verifiable resolution: the exact file is absent or at/below 500 lines; the exact directory is absent or at/below 20 children; or the affected depth/other finding is no longer present at head. Keep a terminal `RESOLVED` record with the original debt ID/hash, resolution head, exact observed metric, and any successor path. Never delete the audit record. Any inherited structural finding that resolves in the candidate but has no registry debt row MUST appear in `RESOLVED_BASELINE_DEBT[]` with its base finding key, exact resolution head, and metric/path evidence. A renamed path is treated as delete plus add: the old record closes only if the old path is gone, while the new path independently passes all rules; a new >500 file or over-limit directory still hard-fails.

Expired historical debt remains visible as `EXPIRED_DEBT`; expiry never renews, deletes, or legalizes it. If an active exception expires, the registry is invalid (exit 2). Missing dates, unknown states, unavailable commit objects, mismatched hashes, malformed JSON, or an unknown schema/version are fail-closed conditions; they cannot be downgraded to debt or warning.

## 6. Affected-surface definition

Compute the affected set mechanically from exact tree and diff data, with renames disabled:

- **File surface:** every added, modified, deleted, or rename-source/rename-target in-scope path; classification or generated-allowlist changes; and any path whose exception/debt record changes.
- **Directory surface:** exactly each in-scope directory whose set of immediate tracked children changes between base and head. An add/delete/rename changes the child sets of its containing directories and any containing directories whose immediate child directory itself is added/removed; a content-only edit does not affect its parent directory's width finding. A nested descendant edit that leaves an ancestor's immediate-child set unchanged does not affect that ancestor.
- **Depth surface:** every added/moved/deleted in-scope file whose depth changes, plus all in-scope descendants of a `package.json` change that changes nearest module-root selection.
- **Registry/config surface:** changes to the guardrail, registry, generated allowlist, governance lock, include/exclude classification, or verifier semantics require full base/head debt-set recomputation. They do not silently erase debt. The exact debt set must be stable except for a verifiable closure recorded above.

Any finding on an affected file, directory, or depth surface MUST pass its V1 rule in the candidate or be resolved in the same candidate. This includes a file that previously relied on a V1-invalid registry row. Touching it while it remains over 500 lines hard-fails; it must be split or reduced to the limit. Unchanged debt on unrelated surfaces is reported but does not block that candidate increment.

## 7. Anti-evasion rules retained from V1

- Packing more than three statements on an added line remains a violation; pre-existing dense lines remain informational.
- Barrel inflation remains a violation.
- Duplicating the same logic into several small files to evade review limits remains forbidden. Exact-content duplicates remain a warning signal; normalized near-duplicate detection remains a future direction and is not upgraded by V2.
- Deep-directory evasion remains blocked by joint depth and child-count limits.
- A file declaring `@generated`, `auto-generated`, `code generated`, or `do not edit` in its first lines without exact generated-allowlist membership remains a violation; allowlist edits require an accepted registry actor and separate review.
- A fixture-named file containing test-runner constructs (`node:test`, `describe`, `it`, `test`, or `assert`) remains test code; fixture hiding is a violation.
- A path move, rename, extension change, generated claim, registry rewrite, or excluded-root move MUST NOT turn an affected violation into unreported debt.

## 8. Verifier and authority lifecycle

The machine-facing interface, output schema, exit statuses, V1-to-V2 registry migration validation, stable debt identity, and acceptance mappings are specified by `CODE_STRUCTURE_VERIFIER_CONFORMANCE_V1`. That Spec does not define or copy thresholds; this rule does.

A V1 runner cannot claim V2 conformance. Any consumer MUST treat output carrying `rules_version = CODE_STRUCTURE_GUARDRAILS_V1` as `V1_LEGACY_UNQUALIFIED`; it is not evidence of V2 candidate readiness. A V2 runner MUST reject an unaccepted V2 authority or a V1-only output as V2 evidence. V2 implementation starts only in a new task whose base contains accepted V2 and the accepted implementation Spec. The implementation PR must use V2 logic to validate its V1-to-V2 registry migration and exact candidate delta. No self-acceptance or implicit activation is permitted.

V1 remains active until the successor is accepted and merged. On that same authority transaction, V1 receives a `superseded_by` backlink to V2 and is retained unchanged otherwise. Registry housekeeping cannot supersede this rule or change a frozen limit. Acceptance actors are the Owner or an explicitly authorized maintainer recorded in the acceptance PR.

## 9. Acceptance and stops

Acceptance requires an independent exact-revision review of the complete V2, its implementation Spec, lifecycle backlinks, and migration/anti-evasion semantics. The implementation Spec acceptance mapping requires proof that:

- all V1 thresholds and anti-evasion checks remain in force;
- only unchanged, unrelated debt is non-blocking and it is never represented as legal or globally passing;
- invalid or modified registry data and affected debt fail closed;
- migration preserves every valid cap exactly and moves invalid rows to immutable debt records without prose inference or re-baselining;
- file, directory, depth, delete, rename, expiry, unknown, and schema-transition cases are deterministic;
- current PR573 growth in `packages/broker/test/transport.test.js` (912 -> 946) and `packages/workflow-execution/src/engine.js` (511 -> 525) remains a hard failure until decomposed or reduced.

V2 changes no source, registry, PR, runtime, service, or production state by itself. Acceptance authorizes only the Contracts in the companion implementation Spec.
