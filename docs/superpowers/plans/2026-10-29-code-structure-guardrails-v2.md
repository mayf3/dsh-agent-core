# Code Structure Guardrails V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the accepted V2 verifier contract so a clean candidate increment can pass with unchanged historical debt explicitly reported, while all new or affected structural violations still fail.

**Architecture:** Keep the fixed d506 eligibility anchor and all thresholds in the accepted local V2 rule. Preserve the existing V1-format registry bytes. Derive `BASELINE_DEBT` and resolved-debt output from the exact comparison base/head plus fixed baseline; persist no debt ledger, migration, or tombstone.

**Tech Stack:** Node.js, `node:test`, Git tree/diff commands, existing JSON registry.

**Spec:** `docs/specs/CODE_STRUCTURE_VERIFIER_CONFORMANCE_V1.md`, only after its accepted content and `.agents/local/CODE_STRUCTURE_GUARDRAILS_V2.md` are present in the implementation base.

## Global Constraints

- `BASELINE_COMMIT = d506f81105e8aa05177a01b817ebe11dcc076ba5`.
- `HANDWRITTEN_FILE_WARNING_LINES = 400`; `HANDWRITTEN_FILE_MAX_LINES = 500`.
- `DIRECTORY_WARNING_CHILDREN = 16`; `DIRECTORY_MAX_CHILDREN = 20`.
- `MAX_DIRECTORY_DEPTH_FROM_MODULE_ROOT = 4`.
- `MAX_STATEMENTS_PER_LINE = 3`; `BARREL_MAX_LINES = 60`; `BARREL_MAX_REEXPORTS = 20`.
- `NEW_FILE_OVER_500 = HARD_FAIL`; touched legacy files MUST NOT GROW; major change threshold remains added lines >100 OR changed lines >20% of base file.
- Preserve registry schema, rows, baseline, allowlist, and caps exactly. The registry's V1 rules label identifies its format; verifier output reports V2 rule semantics.
- Any registry row/allowlist delta between exact base/head fails closed. An accepted registry-only change may be consumed only after it is already present at comparison base.
- Unchanged unrelated debt may be reported without blocking the candidate, but it is never a valid exception or global PASS.
- `packages/broker/test/transport.test.js` growth 912 -> 946 and `packages/workflow-execution/src/engine.js` growth 511 -> 525 MUST fail until source deltas are split or reduced.
- Do not start this plan until both authorities are accepted and merged in the implementation base.

## Review Focus

- Fixed eligibility anchor is evaluated independently from moving comparison base/head.
- Identical invalid-eligibility or over-cap findings remain visible debt only when the corresponding registry row is unchanged and the surface is unaffected.
- Any affected file/depth, changed directory immediate-child set, config mutation, or registry-row delta blocks or fails closed.
- A resolved finding is emitted from base/head evidence without writing a self-referential head OID into registry state.
- A content-only edit does not affect directory width; child add/remove/rename does.
- Expired, unknown, or malformed active configuration fails closed.

---

### Task 1: Pin V2 debt behavior in isolated Git fixtures

**Files:**
- Create: `packages/agent-credential-provisioning/test/structure-verifier-v2.test.mjs`
- Read: `.agents/local/CODE_STRUCTURE_GUARDRAILS_V2.md`
- Read: `docs/specs/CODE_STRUCTURE_VERIFIER_CONFORMANCE_V1.md`
- Test: `scripts/verify-code-structure.mjs`

**Interfaces:**
- Consumes the verifier CLI: `node scripts/verify-code-structure.mjs --base <ref> --head <ref> --json`.
- Asserts full OID binding, `candidate_result`, `baseline_debt[]`, `resolved_debt[]`, and exits 0/1/2.

- [ ] Add temp-Git fixture tests for moving PR refs versus fixed anchor and byte-identical V1 registry input.
- [ ] Add unchanged unrelated debt expecting candidate pass plus visible debt; add affected file, changed child-set, and module-depth cases expecting exit 1.
- [ ] Add registry-row/allowlist mutation, malformed/unknown schema, invalid baseline, invalid actor/metric, and expired active entry cases expecting exit 2.
- [ ] Add delete/rename resolution cases that assert deterministic output includes the base finding key and exact head OID without registry writes.
- [ ] Add V1 threshold regression cases and both PR573 growth shapes expecting candidate failure.
- [ ] Run `node --test --test-reporter=spec packages/agent-credential-provisioning/test/structure-verifier-v2.test.mjs`; confirm the new behavior is red against the current V1 verifier.

### Task 2: Implement exact coordinates and config validation

**Files:**
- Modify: `scripts/verify-code-structure.mjs`
- Test: `packages/agent-credential-provisioning/test/structure-verifier-v2.test.mjs`

**Interfaces:**
- Keep CLI arguments `--base <ref> --head <ref> [--json]`.
- Resolve each ref once to a full commit OID; include OIDs and `CODE_STRUCTURE_GUARDRAILS_V2` in every report.
- Read the existing V1-format registry at both trees and require byte-identical registry/allowlist rows for candidate comparison.

- [ ] Validate accepted V2 authority, exact fixed baseline, existing registry fields/schema/format label, unique paths, actors, expiry, and metrics; exit 2 for unknown or malformed input.
- [ ] Derive fixed-baseline eligibility and cap findings from unchanged registry rows without editing the registry or creating durable debt state.
- [ ] Reject candidate registry/allowlist mutation, deletion, path substitution, later baseline selection, or cap increase; allow separately accepted housekeeping only when already at exact base.
- [ ] Run the focused test file and verify malformed-input cases fail closed.

### Task 3: Compute affected surfaces and separate results

**Files:**
- Modify: `scripts/verify-code-structure.mjs`
- Test: `packages/agent-credential-provisioning/test/structure-verifier-v2.test.mjs`

**Interfaces:**
- JSON fields: `schema_version`, `rules_version`, `base_oid`, `head_oid`, `candidate_result`, `baseline_debt[]`, `resolved_debt[]`, `findings[]`, `summary`.
- Text summary names candidate result and debt count; it never labels the whole repository PASS while debt exists.

- [ ] Compute file changes with rename detection disabled, exact immediate-child-set deltas for directories, and module-root/depth changes; content-only edits do not mark parent width affected.
- [ ] Recompute debt when rules, verifier semantics, registry, allowlist, or governance lock changes; fail closed for candidate-side registry/allowlist changes.
- [ ] Classify only identical, unaffected inherited findings as `BASELINE_DEBT`; emit resolved findings with exact base key/head OID and evidence; make new or affected findings hard candidate violations.
- [ ] Preserve all V1 line, directory, depth, barrel, statement-density, generated-claim, and test-fixture checks; keep comparison-base growth checks exact.
- [ ] Run focused tests and verify the two PR573 growth examples still exit 1.

### Task 4: Verify the exact implementation head and hand off

**Files:**
- Modify: `docs/reports/` implementation conformance record (existing task record)
- Read: final implementation diff and accepted authority revisions

**Interfaces:**
- Use the exact merged authority OID as implementation base and exact candidate OID as head.

- [ ] Run focused verifier tests and the repository's established structure command against the pinned integration base and exact head.
- [ ] Record candidate result, every remaining `BASELINE_DEBT` item, exact OIDs, commands, exit codes, and test counts separately.
- [ ] Confirm `transport.test.js` and `workflow-execution/src/engine.js` were split/reduced before claiming candidate PASS; otherwise report their hard failures and stop.
- [ ] Obtain independent affected-surface review before PR merge; do not treat a candidate PASS with debt as global conformance.
