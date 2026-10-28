---
spec_id: CODE_STRUCTURE_VERIFIER_CONFORMANCE_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
scope:
  - mayf3/dsh-agent-core/scripts/verify-code-structure.mjs
  - mayf3/dsh-agent-core/.agents/structure-registry.json
  - exact base/head structure-gate results for candidate review
governed_by:
  - CODE_STRUCTURE_GUARDRAILS_V2
external_authorities: []
supersedes: []
superseded_by: null
owners: [mayf3]
date: 2026-10-29
---

# CODE_STRUCTURE_VERIFIER_CONFORMANCE_V1

## 1. Goal

Define the machine-readable implementation contract for the structural rules in the proposed repository-local `CODE_STRUCTURE_GUARDRAILS_V2`. This Spec defines verifier coordinates, registry migration, debt reporting, affected-surface gating, and exit behavior. Thresholds and structural policy live only in the V2 rule.

## 2. Scope and non-goals

The implementation covers `scripts/verify-code-structure.mjs`, the V1-to-V2 migration of `.agents/structure-registry.json`, and focused regression tests. It does not change source structures, frozen thresholds, exception caps, generated allowlist membership, runtime behavior, deployment, or production state. It does not authorize any current PR growth to pass.

## 3. Authority and dependencies

The implementation authority is `CODE_STRUCTURE_GUARDRAILS_V2` in `.agents/local/CODE_STRUCTURE_GUARDRAILS_V2.md`; this Spec is subordinate and cannot alter its limits or semantics. Both authorities MUST be accepted and present in the implementation base before code or registry migration begins. The V2 local rule remains the sole source of code size, directory, depth, legacy, and anti-evasion policy.

## 4. Current state

The V1 verifier uses `--base..--head` both for candidate change checks and registry-row eligibility. V1's accepted rule pins a different fixed eligibility baseline, `d506f81105e8aa05177a01b817ebe11dcc076ba5`. The preserved fixed-baseline repair corrects that mismatch but surfaces V1 registry rows that fail the pinned eligibility condition. Current PR573 also has observed file growth in `packages/broker/test/transport.test.js` (912 to 946 lines) and `packages/workflow-execution/src/engine.js` (511 to 525 lines); those are independent hard violations under the retained no-growth rule.

## 5. Observations and evidence

### OBS-CSV-001 — Accepted V1 pins one fixed baseline

- Source revision: authority base `01c1cd0c4a980e1a37878ea5ad05f4d46fb3ba99`
- Source: `.agents/local/CODE_STRUCTURE_GUARDRAILS_V1.md`, header and §§6–7, 11
- Result: baseline `d506f81105e8aa05177a01b817ebe11dcc076ba5`; new files over 500 fail; touched legacy files must not grow; registry eligibility is tied to baseline files.
- Provenance: repository source at the exact authority base.

### OBS-CSV-002 — Fixed-baseline verifier repair exposes later-baseline file rows

- Source revision: preserved fixed-baseline candidate targeting `4fe3d0bb7d759fbd2ea15e46211ece4aed97f6ed`
- Source: `/Users/yanfenma/workspace/artifacts/workflow-unattended-mechanisms-20261027/ART/structure-guard-fixed-baseline-20261029/guard-maintenance-review.md`
- Result: exact gate exits 2 for later-baseline file entries; review records the file counts and absence of accepted authority to reinterpret their free-text reasons.
- Limitation: review is evidence of the candidate and registry conflict, not an acceptance of exceptions.

### OBS-CSV-004 — Three registry directories also use later measurements

- Source revision: V1 baseline `d506f81105e8aa05177a01b817ebe11dcc076ba5` and integration base `01c1cd0c4a980e1a37878ea5ad05f4d46fb3ba99`
- Method: count unique immediate tracked children from `git ls-tree -r --name-only <ref>` at each exact tree.
- Result: `packages/agent-router/test` is 12 at d506 and 24 at main; `packages/production-runtime/test` is 8 and 35; `packages/feishu-connector/test` is 17 and 21. These three registry directories do not qualify at the V1 pinned baseline. `scripts/` is 38 at d506 and 66 at main; it qualifies at the fixed baseline but exceeds its accepted registry cap of 40.
- Limitation: measurements describe these immutable trees; a future implementation must rebind and rerun the counts at its exact base/head.

### OBS-CSV-005 — Existing caps must not be rewritten to current measurements

- Source revision: preserved candidate `4fe3d0bb7d759fbd2ea15e46211ece4aed97f6ed`
- Source: `/Users/yanfenma/workspace/artifacts/workflow-unattended-mechanisms-20261027/ART/structure-v2-design-20261029/analysis.md`
- Result: six current registry file measurements exceed their recorded caps, including three files that qualify at d506 and three later-baseline rows. The V1 verifier compares touched-file growth against the supplied base rather than enforcing all recorded caps as a current-tree ceiling.
- Limitation: this is a verifier/prose interpretation gap; it does not authorize increasing any cap.

### OBS-CSV-003 — PR573 contains separate candidate growth

- Source revision: PR573 candidate/base coordinates are supplied in the active implementation handoff.
- Result: `transport.test.js` grows 912 to 946 and `workflow-execution/src/engine.js` grows 511 to 525.
- Limitation: these counts are gating inputs to be re-read at exact implementation head; this Spec does not certify a future head.

### EVD-CSV-001 — V2 migration and affected-surface requirements

- Source observations: `OBS-CSV-001` through `OBS-CSV-005`
- Target: `CLM-CSV-001`
- Relation: SUPPORTS
- Sufficiency: sufficient to specify deterministic verifier behavior and known required regression classes.
- Limitation: source conformance and exact PR573 readiness require execution after V2 acceptance.

## 6. Claims and assumptions

- `CLM-CSV-001` — Keeping the fixed baseline and classifying unchanged invalid records as visible debt can allow an unrelated clean candidate increment to pass without legalizing the debt. Support state: INFERRED. Basis: `EVD-CSV-001`. The implementation tests must prove no changed/affected debt takes this route.
- No historical prose or later measurement is authority for a new baseline, exception, or cap.

## 7. Decisions

### DEC-CSV-001 — Report candidate readiness separately from repository debt

The verifier will calculate candidate violations and inherited historical debt as separate result classes. An unrelated candidate may pass its increment gate while the output still reports debt; the output will never call the whole repository clean or globally PASS while debt remains.

### DEC-CSV-002 — Treat V1-to-V2 registry migration as an exact, one-time transformation

V1 rows that qualify at the fixed anchor remain active with all recorded fields and caps unchanged. V1 rows that fail eligibility or exceed their recorded cap move to immutable debt records retaining the exact source row and SHA-256. Migration does not infer authority from free text, remeasure a cap upward, delete an unresolved row, or change a source file.

### DEC-CSV-003 — Affected violations remain hard blockers

A historical finding blocks the candidate when the same file, registry record, immediate-child set, or depth relation is affected. Debt can close only by exact measurable resolution; rename is delete plus add; the new path must pass independently.

## 8. Contracts

### CTR-CSV-001 — Exact comparison coordinates

The CLI MUST accept `--base <ref>` and `--head <ref>`, resolve both once to full commit OIDs, and bind all output to those OIDs and the exact V2 rule version. Missing or unresolvable refs fail closed. Branch movement during a run MUST NOT change coordinates.

### CTR-CSV-002 — Registry validation and migration

The V2 verifier MUST validate JSON shape, schema/rule version, fixed baseline match, unique paths/debt IDs, accepted actors, metric types, expiries, exact record hashes, and supported debt states. Unknown, malformed, missing, expired-active, or hash-mismatched configuration exits 2. V1 schema has `schema_version: 1`, `files`, `directories`, `generated_allowlist`, and `baseline_commit`; V2 changes the schema version/rule version, preserves those keys, and adds `historical_debt`. When base has V1 and head has V2, only the one-time transformation defined in V2 is allowed: retain eligible rows and caps exactly; move fixed-baseline-ineligible or already-over-cap rows into immutable, open debt records; preserve exact source-row values and hash. Canonical JSON recursively sorts object keys, preserves array order, uses UTF-8, and omits insignificant whitespace. This includes the later-baseline file and directory entries evidenced by `OBS-CSV-002` and `OBS-CSV-004`, plus any currently over-cap row evidenced by exact-tree measurement. A second migration or downgrade exits 2.

### CTR-CSV-003 — Candidate delta and baseline debt classification

The verifier MUST evaluate file, directory, depth, registry, and anti-evasion findings at both exact trees. An inherited finding is `BASELINE_DEBT` only if rule identity, path, metric, and required registry/debt record are unchanged from base to head and its surface is unaffected. New, changed, or affected findings are `CANDIDATE_VIOLATION`. A base finding resolved by head MUST appear in `resolved_debt[]` with its exact finding key and resolution evidence. Existing V1 hard limits remain hard failures for the candidate.

### CTR-CSV-004 — Affected-surface closure

The verifier MUST derive file surfaces from all added, modified, deleted, and rename-source/target paths; directory surfaces only from exact changes to an in-scope directory's immediate tracked-child set (a content-only file edit does not affect parent width); and depth surfaces from changed in-scope paths and module-root changes. Changes to the rule, verifier semantics, registry schema, allowlist, or governance lock trigger full deterministic debt-set recomputation. They cannot erase or silently reclassify debt; only exact closure records are allowed.

### CTR-CSV-005 — Non-lossy debt and anti-evasion

An unresolved debt record MUST remain byte-bound and visible. Deleting, renaming, rekeying, expiring, or moving it to an unknown schema cannot remove it. A closure requires exact head evidence that the path is absent or within the applicable structural limit, plus a retained terminal record containing original debt identity, resolution head, metric, and optional successor path. A renamed successor is checked as a new path; any new over-limit path fails.

### CTR-CSV-006 — CLI result schema and exit status

For `--json`, stdout MUST contain `schema_version`, `rules_version`, full `base_oid`, full `head_oid`, `candidate_result`, `baseline_debt[]`, `resolved_debt[]`, `findings[]`, and a stable summary. Text output MUST identify the candidate result and debt count/paths separately. It MUST NOT emit undifferentiated `PASS` while debt remains.

- Exit `0`: candidate delta passes; output may contain `BASELINE_DEBT` and MUST identify `CANDIDATE_DELTA_PASS_WITH_BASELINE_DEBT` when nonzero debt remains.
- Exit `1`: one or more candidate structural violations.
- Exit `2`: invalid arguments, refs, rule, registry, schema, expiry, unknown state, or evidence required for deterministic classification is unavailable.

A V1 runner/output is `V1_LEGACY_UNQUALIFIED`; it cannot satisfy or claim V2 conformance. `npm run verify:structure` may point to a V2 runner only after the V2 implementation is merged.

## 9. Acceptance

### ACC-CSV-001 — Fixed baseline and migration integrity

- Contracts: `CTR-CSV-001`, `CTR-CSV-002`
- Method: focused tests for moving comparison refs, V1-to-V2 exact migration, preserved file/directory caps, fixed-baseline file and directory eligibility (including the 38-child `scripts/` baseline with its existing cap unchanged), invalid-row debt identity, malformed schema, baseline mismatch, unknown state, expired active entry, and duplicate IDs.
- Required result: fixed anchor remains d506; no current-size re-baseline or cap increase is possible; invalid inputs exit 2.

### ACC-CSV-002 — Debt and affected surface behavior

- Contracts: `CTR-CSV-003`, `CTR-CSV-004`, `CTR-CSV-005`
- Method: base/head fixtures for unchanged unrelated file debt, touched debt, changed directory children, changed module depth, delete, rename, path alias, registry mutation, debt closure, and new >500 files.
- Required result: only exact unchanged unrelated debt is non-blocking; affected/new violations fail; closure preserves terminal lineage.

### ACC-CSV-003 — Existing limits and PR573 hard failures

- Contracts: `CTR-CSV-003`, `CTR-CSV-006`
- Method: regression cases for all V1 limits, no-growth, major-change split threshold, directories, depth, statement density, barrels, generated claims, fixtures, plus PR573's exact `transport.test.js` and `workflow-execution/src/engine.js` growth.
- Required result: every V1 limit retains its result; 912->946 and 511->525 fail until the source deltas are split/reduced; no exception or debt record can waive them.

### ACC-CSV-004 — Output qualification

- Contracts: `CTR-CSV-001`, `CTR-CSV-006`
- Method: snapshot JSON/text output at a full-OID base/head pair with at least one unchanged debt item and one candidate violation.
- Required result: exact coordinates, rules version, candidate result, and debt paths are stable; no global PASS is reported while debt remains.

## 10. Alternatives and disposition

- **Per-entry baseline authority:** rejected for this scope. It adds an authorization/provenance model and can make today's accumulated file size the newly accepted baseline.
- **Delete all invalid rows or refactor all historical debt before PR573:** valid remediation but expands the immediate gate repair to multiple unrelated source and directory structures.
- **Candidate-delta gate plus visible debt:** selected. It keeps the fixed baseline, blocks changes on affected debt, and lets only a clean unrelated increment pass with debt still explicit.

## 11. Migration and rollback

The first implementation task after acceptance migrates the V1 registry exactly as DEC-CSV-002 specifies and implements the V2 verifier in the same isolated implementation change. Tests must run the V2 verifier from candidate head against the exact V1 base and V2 head. Reverting the implementation returns to V1 only when the V1 registry schema is restored exactly; a partial downgrade is exit 2. This Spec authorizes no migration before its accepted content is present in the implementation base.

## 12. Open questions

```text
OPEN_OWNER_DECISIONS = NONE (within the owner-selected route; acceptance remains pending)
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE for this proposed contract
```

Acceptance of this proposed Spec or V2 rule is not claimed here. The affected PR573 growth remains a separate source blocker and must not be waived by the authority transaction.
