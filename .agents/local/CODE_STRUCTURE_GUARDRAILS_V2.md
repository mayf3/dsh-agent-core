# Code Structure Guardrails V2 — repository-local binding rule

```text
RULE_ID = CODE_STRUCTURE_GUARDRAILS_V2
RULE_KIND = repository-local binding rule (carried by .agents/local/, not a docs/specs authority)
LIFECYCLE = ACCEPTED
EFFECTIVE_RULE = CODE_STRUCTURE_GUARDRAILS_V2 upon this accepted transaction merging into main
SUPERSEDES = CODE_STRUCTURE_GUARDRAILS_V1 (effective upon merge into main)
IMPLEMENTATION_CONTRACTS = CODE_STRUCTURE_VERIFIER_CONFORMANCE_V1
ENFORCEMENT = machine verifier (scripts/verify-code-structure.mjs) + manual review
BASELINE_COMMIT = d506f81105e8aa05177a01b817ebe11dcc076ba5 (unchanged from V1)
ACCEPTANCE_ACTORS = mayf3 or an explicitly authorized maintainer recorded in the acceptance PR
REGISTRY_APPROVAL_ACTORS = [mayf3] (a different actor requires an accepted rule change; prose alone cannot extend this list)
```

This is the accepted whole-version successor to local V1, under the Owner's explicit maintainer delegation. It becomes effective on merge into main. The implementation contracts are defined once in `docs/specs/CODE_STRUCTURE_VERIFIER_CONFORMANCE_V1.md`; this file remains the single authority for structural thresholds and rule semantics.

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

## 4. Fixed-baseline registry and authority

The only eligibility anchor remains the immutable `BASELINE_COMMIT` above. It is read from the accepted V2 rule and resolved to a full commit OID. The registry MUST name exactly that OID. `--base`, `--head`, a branch name, a PR base, and a current file size MUST NOT replace or advance it.

An active file exception is valid only when the path exists at the fixed baseline and has more than 500 physical lines there, and its well-formed integer `approved_max_lines` exactly equals the measured fixed-baseline line count. A well-formed numeric file cap that differs from that count is invalid exception authority, never an effective ceiling. If its exact row is unchanged and its finding is unaffected, report it as `BASELINE_DEBT`; if the affected path remains over 500 lines, hard-fail it regardless of the stored cap. For example, `packages/agent-credential-provisioning/test/provisioning.test.js` measures 797 lines at d506 while its preserved row cap is 824, so the row is debt and cannot authorize this file. A nonnumeric, boolean, null, or otherwise malformed cap is invalid configuration and exits 2. An active directory exception is valid only when the path exists at the fixed baseline and has more than 20 immediate tracked children there. Its `approved_max_children` remains the exact accepted V1 value and MUST be at least the measured baseline count; V1 permits Owner-reviewed directory caps above that count, so V2 MUST preserve the accepted value and MUST NOT infer it from the reason field. Required `reason`, `approved_by`, `expires_at`, and `split_followup` fields remain mandatory. Expiry MUST be a valid `YYYY-MM-DD` calendar date later than the verifier's UTC date; no unknown or malformed expiry is accepted. `approved_by` MUST be in `REGISTRY_APPROVAL_ACTORS`.

V2 keeps `.agents/structure-registry.json` in its existing V1 format and preserves its bytes during the V2 implementation. The verifier accepts the existing `schema_version: 1` and V1 registry `rules_version` as registry-format identity; its result independently reports `rules_version = CODE_STRUCTURE_GUARDRAILS_V2`. It MUST NOT rewrite registry rows as part of verifier execution, raise caps, change the baseline, or add a persistent debt collection. An active row is valid only under the same fixed-baseline criteria and accepted actor/expiry checks above. Malformed JSON, unknown schema/rules label, duplicate paths, invalid actors or metrics, mismatched baseline, expired active entries, and unavailable refs fail closed (exit 2).

The registry is not immutable forever. Expiry renewal, generated-allowlist housekeeping, and recording a completed split may use the existing separate Owner-reviewed registry-only route; any new exception or cap requires an independently accepted Owner-authorized path and exact fixed-baseline evidence. Such a registry-only change cannot be combined with source changes that rely on it, and it cannot delete, retag, or otherwise hide an unresolved finding. V2 does not add an inline bypass or implement that separate authorization process. In the V2 candidate gate, any registry-row or allowlist delta between `--base` and `--head` fails closed (exit 2); a separately Owner-accepted registry-only change may be consumed after it is present at the exact comparison base. Treat use of that separate route as a nonblocking `FOLLOW_UP` outside the candidate gate; an exit 2 from a registry-delta candidate is configuration failure and MUST NOT be described as PASS. Invalid historic rows remain visible through computed output rather than being rewritten into a new authority schema.

## 5. Candidate-delta gate and historical debt

The verifier evaluates the exact resolved `--base` and `--head` commit OIDs under this rule and derives debt from the two trees plus the fixed eligibility baseline. It produces separate results:

```text
CANDIDATE_DELTA = PASS | FAIL
BASELINE_DEBT = <stable list of inherited unresolved findings>
RESOLVED_BASELINE_DEBT = <stable list of findings resolved by this candidate>
```

A finding is `BASELINE_DEBT` only when the same rule/path/key and measured violation exist at both comparison base and head, the corresponding V1 registry row is identical, and the finding is not on an affected surface. Fixed-baseline ineligibility, a well-formed numeric file cap that differs from the fixed-baseline measurement, and a comparison-base metric over an unchanged recorded cap are computed from the existing registry row; none makes that row an authorized exception or effective ceiling. Malformed or nonnumeric cap values remain configuration failures (exit 2). Unchanged debt may be reported without blocking an unrelated candidate increment, but is never called an exception, conformance, or repository-wide PASS. A clean candidate may exit 0 while debt remains only when output says `CANDIDATE_DELTA_PASS_WITH_BASELINE_DEBT` and enumerates the debt. It MUST NOT emit an undifferentiated `PASS`.

New findings, changed findings, or inherited debt on an affected surface are candidate violations. Malformed, unknown, missing, expired-active, or authority-invalid registry data is configuration failure (exit 2), not debt. Any registry row, baseline, schema/rules label, or allowlist change between base and head fails closed in the V2 candidate gate; omission or path/kind substitution cannot hide a finding. The separate Owner-reviewed registry-only route above remains available and must not be combined with dependent source changes. No persistent debt record is written. Debt identity is deterministically derived for output from the original registry collection, exact row content, path, rule key, and measured finding; the output binds it to the exact base/head OIDs.

When a base finding no longer exists at head, emit it in `RESOLVED_BASELINE_DEBT[]` with its stable base finding key, exact `head_oid`, observed head metric/path state, and any successor path. This is computed output only and MUST NOT be written back into the registry or used as a self-referential input. A renamed path is treated as delete plus add: the old finding resolves only if its old path is gone or no longer violates the applicable rule; the new path is checked independently. Any new >500 file or over-limit directory still hard-fails.

Expired active exceptions invalidate the registry (exit 2); malformed or unknown expiry is never debt or a warning. Unknown registry versions, unavailable commits, or insufficient evidence for deterministic classification fail closed. No debt classification may be inferred from registry prose.

## 6. Affected-surface definition

Compute the affected set mechanically from exact tree and diff data, with renames disabled:

- **File surface:** every added, modified, deleted, or rename-source/rename-target in-scope path; classification or generated-allowlist changes.
- **Directory surface:** exactly each in-scope directory whose set of immediate tracked children changes between base and head. An add/delete/rename changes the child sets of its containing directories and any containing directories whose immediate child directory itself is added/removed; a content-only edit does not affect its parent directory's width finding. A nested descendant edit that leaves an ancestor's immediate-child set unchanged does not affect that ancestor.
- **Depth surface:** every added/moved/deleted in-scope file whose depth changes, plus all in-scope descendants of a `package.json` change that changes nearest module-root selection.
- **Registry/config surface:** changes to the guardrail, registry, generated allowlist, governance lock, include/exclude classification, or verifier semantics require full base/head debt-set recomputation. Any registry-row or allowlist delta within the candidate fails closed; an accepted housekeeping change may be used only when already present at the exact comparison base. No config change can silently erase or reclassify computed debt.

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

The machine-facing interface, output schema, exit statuses, computed debt identity, and acceptance mappings are specified by `CODE_STRUCTURE_VERIFIER_CONFORMANCE_V1`. That Spec does not define or copy thresholds; this rule does.

A V1 runner cannot claim V2 conformance. Any consumer MUST treat output carrying `rules_version = CODE_STRUCTURE_GUARDRAILS_V1` as `V1_LEGACY_UNQUALIFIED`; it is not evidence of V2 candidate readiness. A V2 runner MUST reject an unaccepted V2 authority or a V1-only output as V2 evidence. V2 implementation starts only in a new task whose base contains accepted V2 and the accepted implementation Spec. The implementation PR must use V2 logic to validate exact candidate delta against the unchanged V1-format registry; the V2 verifier and registry-preserving code change land in the same implementation PR without a registry migration. No self-acceptance or implicit activation is permitted.

V1 remains active until the successor is accepted and merged. On that same authority transaction, V1 receives a `superseded_by` backlink to V2 and is retained unchanged otherwise. Registry housekeeping cannot supersede this rule or change a frozen limit. Acceptance actors are the Owner or an explicitly authorized maintainer recorded in the acceptance PR.

## 9. Acceptance and stops

Acceptance requires an independent exact-revision review of the complete V2, its implementation Spec, lifecycle backlinks, and computed-debt/anti-evasion semantics. The implementation Spec acceptance mapping requires proof that:

- all V1 thresholds and anti-evasion checks remain in force;
- only unchanged, unrelated debt is non-blocking and it is never represented as legal or globally passing;
- invalid or modified registry data and affected debt fail closed;
- registry bytes and all valid caps remain unchanged; fixed-baseline-ineligible rows, well-formed numeric file-cap mismatches, and over-cap rows are derived as visible debt without prose inference or re-baselining;
- file, directory, depth, delete, rename, expiry, unknown-schema, and registry-mutation cases are deterministic;
- current PR573 growth in `packages/broker/test/transport.test.js` (912 -> 946) and `packages/workflow-execution/src/engine.js` (511 -> 525) remains a hard failure until decomposed or reduced.

V2 changes no source, registry, PR, runtime, service, or production state by itself. Acceptance authorizes only the Contracts in the companion implementation Spec.
