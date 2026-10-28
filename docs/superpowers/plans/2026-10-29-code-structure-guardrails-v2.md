# Code Structure Guardrails V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the accepted V2 verifier contract so a clean candidate increment can pass with unchanged historical debt explicitly reported, while all new or affected structural violations still fail.

**Architecture:** Keep the fixed d506 eligibility anchor and all thresholds in the accepted local V2 rule. Migrate the existing V1 registry exactly once, preserving accepted caps and moving invalid/over-cap historical rows into immutable debt records. The verifier computes exact base/head findings, affected surfaces, candidate result, and debt as separate outputs.

**Tech Stack:** Node.js, `node:test`, Git tree/diff commands, JSON registry.

**Spec:** `docs/specs/CODE_STRUCTURE_VERIFIER_CONFORMANCE_V1.md`, only after its accepted content and `.agents/local/CODE_STRUCTURE_GUARDRAILS_V2.md` are present in the implementation base.

## Global Constraints

- `BASELINE_COMMIT = d506f81105e8aa05177a01b817ebe11dcc076ba5`.
- `HANDWRITTEN_FILE_WARNING_LINES = 400`; `HANDWRITTEN_FILE_MAX_LINES = 500`.
- `DIRECTORY_WARNING_CHILDREN = 16`; `DIRECTORY_MAX_CHILDREN = 20`.
- `MAX_DIRECTORY_DEPTH_FROM_MODULE_ROOT = 4`.
- `MAX_STATEMENTS_PER_LINE = 3`; `BARREL_MAX_LINES = 60`; `BARREL_MAX_REEXPORTS = 20`.
- `NEW_FILE_OVER_500 = HARD_FAIL`; touched legacy files MUST NOT GROW; major change threshold remains added lines >100 OR changed lines >20% of base file.
- Do not edit a V1 historical cap upward or select a current/later baseline.
- Unchanged unrelated debt may be reported without blocking the candidate, but it is never a valid exception or global PASS.
- `packages/broker/test/transport.test.js` growth 912 -> 946 and `packages/workflow-execution/src/engine.js` growth 511 -> 525 MUST fail until source deltas are split or reduced.
- The authority change itself is docs-first. Do not start this plan until both authorities are accepted and merged in the implementation base.

## Review Focus

- A registry row changes while the rule or candidate changes: tests must show migration hash mismatch and changed debt fail closed.
- An old debt path is deleted or renamed: tests must show the old record stays terminally linked and any oversized successor fails as new.
- A directory's child set changes without changing its ancestor's child set: tests must identify only the directories whose immediate-child sets actually changed; a content-only edit must not affect parent width.
- `package.json` changes the nearest module root: tests must recompute depth for all affected descendants.
- An expired/unknown/malformed debt item is present: tests must show active expiry or unknown state exits 2 and historical expiry never grants an exception.

---

### Task 1: Pin V2 migration and debt behavior in isolated Git fixtures

**Files:**
- Create: `packages/agent-credential-provisioning/test/structure-verifier-v2.test.mjs`
- Read: `.agents/local/CODE_STRUCTURE_GUARDRAILS_V2.md`
- Read: `docs/specs/CODE_STRUCTURE_VERIFIER_CONFORMANCE_V1.md`
- Test: `scripts/verify-code-structure.mjs`

**Interfaces:**
- Consumes the verifier CLI: `node scripts/verify-code-structure.mjs --base <ref> --head <ref> --json`.
- Produces assertions for full OID binding, `candidate_result`, `baseline_debt[]`, and exit codes 0/1/2.

- [ ] Add temp-Git fixture tests for fixed anchor versus moving PR base, exact V1-to-V2 migration, preserved file/directory caps, and canonical source-row hash.
- [ ] Add unchanged unrelated debt case expecting candidate pass plus explicit debt output; add exact affected-file, directory-child-set, and module-depth cases expecting exit 1.
- [ ] Add malformed/unknown state, active expiry, changed/deleted/renamed debt row, and baseline/cap tamper cases expecting exit 2 or the exact documented hard failure.
- [ ] Add V1 threshold regression cases and both PR573 growth shapes expecting candidate failure.
- [ ] Run `node --test --test-reporter=spec packages/agent-credential-provisioning/test/structure-verifier-v2.test.mjs`; confirm the new behavior is red against the current V1 verifier.

### Task 2: Implement exact coordinates, config validation, and V1-to-V2 migration

**Files:**
- Modify: `scripts/verify-code-structure.mjs`
- Modify: `.agents/structure-registry.json`
- Test: `packages/agent-credential-provisioning/test/structure-verifier-v2.test.mjs`

**Interfaces:**
- Keep CLI arguments `--base <ref> --head <ref> [--json]`.
- Resolve each ref once to a full commit OID; include OIDs and `CODE_STRUCTURE_GUARDRAILS_V2` in every report.
- Support exactly one V1-base to V2-head registry transformation; later runs require V2 schema at both refs.

- [ ] Validate the accepted V2 authority, exact fixed baseline, registry schema, IDs, actors, expiry, metrics, and debt hashes; exit 2 for unknown or malformed input.
- [ ] Migrate only from the exact base V1 registry: preserve every valid row and cap; move ineligible/over-cap rows to `OPEN` debt with canonical source row and SHA-256; preserve all other registry values.
- [ ] Reject row addition, deletion, mutation, path substitution, later baseline selection, or cap increase unless the exact V2 closure contract is met; keep terminal resolved debt records.
- [ ] Run the focused test file and verify migration and malformed-input cases pass.

### Task 3: Compute affected surfaces and separate results

**Files:**
- Modify: `scripts/verify-code-structure.mjs`
- Test: `packages/agent-credential-provisioning/test/structure-verifier-v2.test.mjs`

**Interfaces:**
- JSON fields: `schema_version`, `rules_version`, `base_oid`, `head_oid`, `candidate_result`, `baseline_debt[]`, `resolved_debt[]`, `findings[]`, `summary`.
- Text summary names candidate result and debt count; it never labels the whole repository PASS while debt exists.

- [ ] Compute changed file paths with rename detection disabled, exact immediate-child-set deltas for directories, and module-root/depth changes; a content-only edit must not mark parent width as affected.
- [ ] Recompute the full debt set when rules, verifier, registry, allowlist, or governance lock changes; report inherited closures in `resolved_debt[]` and permit only exact recorded registry closures, never disappearance or reclassification by omission.
- [ ] Classify only identical, unaffected inherited findings as `BASELINE_DEBT`; make new or affected findings hard candidate violations.
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
