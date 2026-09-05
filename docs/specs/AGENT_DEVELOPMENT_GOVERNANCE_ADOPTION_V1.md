---
spec_id: AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V1
status: superseded
spec_kind: invariant
authority_level: governing_spec
implementation_authority: none
accepted_date: 2026-09-04
accepted_by: mayf3
accepted_at: 2026-09-04T15:11:51Z
accepted_reviewed_spec_commit: 9b42fc0dfeeede6213a825687e79dda860e404d5
acceptance_review_verdict: PASS
acceptance_authority_basis: >-
  Owner-issued Execution Mandate GOVERNANCE_V1_0_1_CONSUMER_ADOPTION_TO_MAIN_V1
  (OWNER_DECISION = ADOPT_GOVERNANCE_V1_0_1) pre-authorized acceptance after one
  independent proposed-Head review (REVISE, 1 blocker: illegal V2 supersedes edge
  to the never-effective proposed ADOPTION_V2), the minimal amendment
  9b42fc0dfeeede6213a825687e79dda860e404d5 (proposed V2 deleted; this Spec
  amended in place to pin v1.0.1), and ONE exact-Head re-audit (ACCEPT,
  BLOCKERS = 0, BASE_IMPACT = BOUNDED). Reviewed content unchanged by
  lifecycle finalization.
scope:
  - mayf3/dsh-agent-core development governance adoption
  - shared vendored governance integrity and local activation lifecycle
governed_by: []
external_authorities:
  - repository: mayf3/agent-development-governance
    authority_id: AGENT_DEVELOPMENT_GOVERNANCE_V1
    revision: 3de35f8617616dda4c717233899d6a93a634d5d8
    relation: constrained_by
supersedes:
  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0
superseded_by: AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V2
owners:
  - mayf3
---

# Agent Development Governance v1.0.1 Adoption V1

> 状态：**superseded**；由 `AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V2`（Governance v1.0.3 adoption，accepted 2026-09-05）完整取代。历史 normative meaning 保持不变。
> 本 Spec 不授权任何产品 implementation。

## 1. Goal

Adopt the exact upstream `development-governance-v0` distribution released as
annotated tag `v1.0.1` (tag object
`a7a60006861d09d502e3e7ea5c1a67c31280c571`, release
https://github.com/mayf3/agent-development-governance/releases/tag/v1.0.1) at
source commit `3de35f8617616dda4c717233899d6a93a634d5d8`, through this
repository's own independent Review and Owner acceptance. After activation,
future applicable work independently classifies Authority, Plan, and
Assurance, and stops when `DONE_WHEN` is met unless an `EXPANSION_TRIGGER`
fires.

## 2. Scope and non-goals

In scope: exact manifest-managed shared governance bytes, the governance lock,
local adoption/supersession lifecycle, route validation, and forward-only use.

Out of scope: changes to `AGENTS.md`, `.agents/local/**`, local Product Direction,
Architecture, product Specs, acceptance actor, product code, runtime, production,
permissions, Grants, credentials, Secrets, historical records, or
`AGENT_OPERATIONAL_LAYER_V1`; this preparation does not accept or merge itself.

## 3. Authority and dependencies

### DEC-ADOPT-001 — Whole-authority successor

The accepted/current `AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0` owns local
adoption today. Governance v1.0.1 changes long-lived routing obligations
(Authority/Plan/Assurance, Execution Mandates, isolated writes, route stages,
load-bearing gaps, and stop controls), so V0 MUST NOT be rewritten in place.
This proposed V1 is its complete successor.

### DEC-ADOPT-002 — Local acceptance remains authoritative

Upstream release status does not activate local authority. The consumer owns
independent Review, Owner acceptance, atomic lifecycle transition, and merge.
`.agents/local/**` remains higher-precedence repository-local extension.

## 4. Current State

### STATE-ADOPT-001 — V0 is current at the preparation Base

- Subject: local development-governance adoption authority and governance lock
  in `mayf3/dsh-agent-core`.
- As-of revision: consumer Base
  `840d2f4ad91f8252eb1f163330c041216a0dd9c4`.
- Environment: GitHub repository object tree for the designated `main`
  authority branch; runtime and production state are not evaluated.
- Observed at: `2026-09-01T23:16:14Z`.
- Basis: `OBS-ADOPT-001`, `EVD-ADOPT-001`.
- State: `AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0` is accepted/current and
  `.agents/governance.lock.json` pins
  `0.1.0-draft.1@46f78c3f00d768d99a4c8c2da975b124bce042f9`.

### STATE-ADOPT-002 — The prepared candidate remains proposed

- Subject: Governance v1.0.0 adoption candidate in PR #140.
- As-of revision:
  `669d6f40bcfe37d0e299f5b1bea3957d0f5ca785`.
- Environment: clean detached consumer checkout on GitHub Actions Ubuntu
  runner; repository object state only, with no runtime or production mutation.
- Observed at: `2026-09-02T21:06:49Z`.
- Basis: `OBS-ADOPT-004`, `OBS-ADOPT-005`, `OBS-ADOPT-006`,
  `EVD-ADOPT-004`.
- State: the 25 exact v1.0.0 managed files and a proposed lock are present;
  V1 is proposed, V0 remains current, and no local adoption is active.
- Amendment: 2026-09-04 (REVISE round 1) — this proposed candidate was amended
  in place to pin upstream `v1.0.1`
  (`3de35f8617616dda4c717233899d6a93a634d5d8`, annotated tag
  `a7a60006861d09d502e3e7ea5c1a67c31280c571`), and the drafted proposed
  `AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V2` successor was removed before any
  acceptance. Proposed Specs amend in place, so no supersession event
  occurred; V0 remains accepted/current and this Spec stays `proposed`. The
  `2026-09-02` records above and in §5–§7 describe the earlier v1.0.0
  generation of this same candidate and are retained as history; the
  re-vendored lock (`.agents/governance.lock.json`, manifest SHA-256
  `c84f6557c7c9de404ebce81440d31d2febbc239dc16c0d0e504f94179c774eaf`) binds
  the `v1.0.1` bytes, and independent exact-Head Review MUST re-verify the
  re-pinned release identity before acceptance.

### STATE-ADOPT-003 — Required execution evidence is reproducible

- Subject: vendor dry-run, vendored-byte verifier, Python entrypoint
  compilation, and route-validator fixtures for the PR #140 candidate.
- As-of revision: consumer candidate
  `669d6f40bcfe37d0e299f5b1bea3957d0f5ca785`; upstream source
  `902842735a69797b54016eeaa88d2f949f5879a9`.
- Environment: GitHub-hosted Ubuntu 24.04 runner, Python 3.12.3.
- Observed at: `2026-09-02T21:06:49Z`.
- Basis: `OBS-ADOPT-005`, `OBS-ADOPT-006`, `EVD-ADOPT-005`.
- State: the actual upstream vendor dry-run and candidate validators completed
  with their required `0 / 1 / 2` outcomes; this is execution evidence for a
  later independent Review, not an acceptance decision.

## 5. Observations

### OBS-ADOPT-001 — Consumer Base authority state

- Subject: V0 adoption Spec, governance lock, `AGENTS.md`, and
  `.agents/local/**` in `mayf3/dsh-agent-core`.
- Source revision:
  `840d2f4ad91f8252eb1f163330c041216a0dd9c4`.
- Environment: GitHub repository object tree; no runtime or production access.
- Observed at: `2026-09-01T23:16:14Z`.
- Method: read the Base commit, governing Spec frontmatter, lock metadata, and
  local-governance blobs.
- Result: V0 and its lock are accepted/current; local extensions exist as
  separate repository-owned authority.
- Provenance:
  `docs/reports/AGENT_DEVELOPMENT_GOVERNANCE_V1_ADOPTION_PREPARATION.md`
  §1 and §5, with the exact Base and preserved blob matrix.

### OBS-ADOPT-002 — Upstream release identity

- Subject: upstream ref `refs/tags/v1.0.0`, annotated tag object, and peeled
  target in `mayf3/agent-development-governance`.
- Source revision: tag object
  `bb98937d176890088da736fa4a45f48279f19d50`.
- Environment: GitHub Git object API and exact upstream source checkout.
- Observed at: `2026-09-02T21:06:49Z`.
- Method: inspect the tag ref/object and check out its peeled target.
- Result: `v1.0.0` is annotated and resolves exactly to
  `902842735a69797b54016eeaa88d2f949f5879a9`; the tag object is unsigned.
- Provenance: upstream tag ref/object plus GitHub Actions run `33683264969`,
  job `100424581220`.

### OBS-ADOPT-003 — Distribution manifest identity

- Subject: upstream `VERSION` and `distribution/manifest.json`.
- Source revision:
  `902842735a69797b54016eeaa88d2f949f5879a9`.
- Environment: exact clean upstream checkout and GitHub Git object API.
- Observed at: `2026-09-02T21:06:49Z`.
- Method: read `VERSION`, parse the manifest, and verify its Git object,
  SHA-256, distribution, version, and file count.
- Result: version=`1.0.0`, distribution=`development-governance-v0`,
  managed files=25, manifest Git blob=
  `d4e37f492653260aa24878af1a9208f53122db5d`, manifest SHA-256=
  `c1fa620da4a16e4073d617e49eb5080487f2a117e3bab6502fd223afee0f06e0`.
- Provenance: upstream `VERSION`, manifest object, and preparation report §2.

### OBS-ADOPT-004 — Candidate bytes and lifecycle

- Subject: PR #140 candidate governance tree and local adoption metadata.
- Source revision:
  `669d6f40bcfe37d0e299f5b1bea3957d0f5ca785`.
- Environment: GitHub repository object tree and clean detached checkout.
- Observed at: `2026-09-02T21:06:49Z`.
- Method: compare all manifest-managed paths and the lock to the upstream
  source; compare protected local and product paths to the Base.
- Result: 25/25 managed bytes match; the lock is proposed with null acceptance
  metadata; V0, `AGENTS.md`, `.agents/local/**`, product, runtime, and
  production paths are unchanged.
- Provenance: preparation report §4–§7 and GitHub Actions run `33683264969`.

### OBS-ADOPT-005 — Actual upstream vendor dry-run

- Subject: exact upstream `tools/vendor.py` operating on the exact consumer
  candidate.
- Source revision: upstream
  `902842735a69797b54016eeaa88d2f949f5879a9`; consumer
  `669d6f40bcfe37d0e299f5b1bea3957d0f5ca785`.
- Environment: GitHub-hosted Ubuntu 24.04 runner, Python 3.12.3.
- Observed at: `2026-09-02T21:06:49Z`.
- Method: run `python3 upstream/tools/vendor.py --target consumer
  --source-commit 902842735a69797b54016eeaa88d2f949f5879a9
  --prepared-by "PR140 execution evidence"
  --prepared-at "2026-09-02T21:15:00Z" --adoption-status proposed`
  without `--apply`, then inspect the consumer worktree.
- Result: exit 0; 26 operations were planned (25 managed files plus the lock);
  no file was written and the consumer checkout remained clean.
- Provenance: GitHub Actions run `33683264969`, job `100424581220`, artifact
  `9867075055`, receipt `pr140-adoption-execution-receipt.txt`.

### OBS-ADOPT-006 — Candidate verifier and route outcomes

- Subject: exact vendored verifier, transition validator compilation, and
  Governance V1 route validator in the consumer candidate.
- Source revision:
  `669d6f40bcfe37d0e299f5b1bea3957d0f5ca785`.
- Environment: GitHub-hosted Ubuntu 24.04 runner, Python 3.12.3.
- Observed at: `2026-09-02T21:06:49Z`.
- Method: execute `verify_governance.py --target consumer`, compile all three
  Python tools, and run valid, contradictory, and malformed route fixtures.
- Result: governance verifier exit 0; Python compile exit 0; valid route exit
  0; contradictory `SUPERSEDE + implementation_allowed=YES` exit 1;
  malformed JSON exit 2.
- Provenance: GitHub Actions run `33683264969`, job `100424581220`, artifact
  `9867075055`, fixture and receipt files.

## 6. Claims and assumptions

### CLM-ADOPT-001 — The obligation change requires whole-authority replacement

- Support state: SUPPORTED.
- Supported by evidence: `EVD-ADOPT-001`.
- Contradicted by evidence: none known.
- Uncertainty: local activation remains contingent on independent Review,
  Owner acceptance, atomic lifecycle closure, and merge.

### CLM-ADOPT-002 — Exact manifest vendoring preserves local authority boundaries

- Support state: SUPPORTED.
- Supported by evidence: `EVD-ADOPT-002`.
- Contradicted by evidence: none known.
- Uncertainty: the conclusion applies to the pinned distribution and exact
  consumer candidate only.

### CLM-ADOPT-003 — The candidate supplies reviewable execution evidence

- Support state: SUPPORTED.
- Supported by evidence: `EVD-ADOPT-003`.
- Contradicted by evidence: none known.
- Uncertainty: the CI execution is author-side evidence; it does not replace
  the required independent exact-Head Review or final accepted-Head recheck.

Open assumptions affecting normative meaning: none.

## 7. Evidence relations

### EVD-ADOPT-001 — Base and upstream facts support whole-authority replacement

- Source observations: `OBS-ADOPT-001`, `OBS-ADOPT-002`,
  `OBS-ADOPT-003`.
- Target: `CLM-ADOPT-001`.
- Relation: SUPPORTS.
- Bound coordinates: consumer Base
  `840d2f4ad91f8252eb1f163330c041216a0dd9c4`; upstream tag object
  `bb98937d176890088da736fa4a45f48279f19d50`; upstream source
  `902842735a69797b54016eeaa88d2f949f5879a9`.
- Strength/sufficiency: sufficient to classify `AUTHORITY_ACTION=SUPERSEDE`
  because V1 changes long-lived routing obligations.
- Limitations: does not perform or authorize local acceptance.
- Provenance: preparation report §1–§2, Base object reads, and upstream tag
  object reads.

### EVD-ADOPT-002 — Manifest and candidate comparison support local preservation

- Source observations: `OBS-ADOPT-003`, `OBS-ADOPT-004`,
  `OBS-ADOPT-005`.
- Target: `CLM-ADOPT-002`.
- Relation: SUPPORTS.
- Bound coordinates: upstream source
  `902842735a69797b54016eeaa88d2f949f5879a9`; consumer Base
  `840d2f4ad91f8252eb1f163330c041216a0dd9c4`; prepared candidate
  `669d6f40bcfe37d0e299f5b1bea3957d0f5ca785`.
- Strength/sufficiency: strong for the 25 managed paths, lock fields, and
  protected local/product path set.
- Limitations: vendor dry-run proves planning and no-write behavior; candidate
  byte identity is established separately by object/hash comparison.
- Provenance: preparation report §3–§7 and GitHub Actions run `33683264969`.

### EVD-ADOPT-003 — Executed checks support candidate reviewability

- Source observations: `OBS-ADOPT-004`, `OBS-ADOPT-005`,
  `OBS-ADOPT-006`.
- Target: `CLM-ADOPT-003`.
- Relation: SUPPORTS.
- Bound coordinates: consumer candidate
  `669d6f40bcfe37d0e299f5b1bea3957d0f5ca785`; upstream source
  `902842735a69797b54016eeaa88d2f949f5879a9`; GitHub Actions run
  `33683264969`, job `100424581220`.
- Strength/sufficiency: sufficient author-side executed evidence for an
  independent Reviewer to reproduce and evaluate the adoption candidate.
- Limitations: does not constitute independent Review or local acceptance.
- Provenance: successful run logs and artifact `9867075055`, plus the persisted
  preparation report.

### EVD-ADOPT-004 — Candidate object and execution observations support proposed state

- Source observations: `OBS-ADOPT-004`, `OBS-ADOPT-005`,
  `OBS-ADOPT-006`.
- Target: `STATE-ADOPT-002`.
- Relation: SUPPORTS.
- Bound coordinates: consumer candidate
  `669d6f40bcfe37d0e299f5b1bea3957d0f5ca785`; consumer Base
  `840d2f4ad91f8252eb1f163330c041216a0dd9c4`.
- Strength/sufficiency: sufficient to establish that the prepared candidate is
  proposed, byte-exact for managed files, and non-mutating outside its scope.
- Limitations: the resulting amendment Head must receive a new exact-Head
  review; this relation does not predict future Base movement.
- Provenance: candidate/Base object comparison and GitHub Actions run
  `33683264969`.

### EVD-ADOPT-005 — Execution receipt supports reproducibility state

- Source observations: `OBS-ADOPT-005`, `OBS-ADOPT-006`.
- Target: `STATE-ADOPT-003`.
- Relation: SUPPORTS.
- Bound coordinates: consumer candidate
  `669d6f40bcfe37d0e299f5b1bea3957d0f5ca785`; upstream source
  `902842735a69797b54016eeaa88d2f949f5879a9`; Ubuntu 24.04,
  Python 3.12.3, observed `2026-09-02T21:06:49Z`.
- Strength/sufficiency: strong for the recorded commands, outputs, exit codes,
  and no-write dry-run property.
- Limitations: the amendment changes only this proposed Spec and its
  preparation report; an independent Reviewer must bind the resulting exact
  Head and re-evaluate Base impact.
- Provenance: GitHub Actions run `33683264969`, job `100424581220`, artifact
  `9867075055`.

## 8. Decisions

### DEC-ADOPT-003 — Exact pin

The local lock MUST pin source repository `mayf3/agent-development-governance`,
source commit `3de35f8617616dda4c717233899d6a93a634d5d8`, version `1.0.1`, and
compatibility distribution ID `development-governance-v0`. Mutable upstream
branches or a different commit MUST NOT substitute.

### DEC-ADOPT-004 — Proposed preparation only

Preparation MUST retain V0 as current, retain all local/product authority, and
leave both the new Spec and lock proposed. A later transaction may accept V1,
supersede V0 with reciprocal backlinks, populate acceptance metadata, update
the index, pass final-Head recheck, and merge into `main`.

## 9. Contracts

### CTR-ADOPT-001 — Exact release and bytes

The tag, source commit, manifest identity, 25 managed paths, hashes, sizes,
version, and distribution ID MUST match upstream v1.0.1 exactly.

### CTR-ADOPT-002 — Proposed lifecycle

On this preparation Head, `adoption.status=proposed`, `accepted_by=null`, and
`accepted_at=null`; V0 MUST remain accepted/current and unchanged. The Agent
MUST NOT mark the PR ready, accept, or merge it.

### CTR-ADOPT-003 — Local preservation

`AGENTS.md`, `.agents/local/**`, local Product Direction, Architecture,
invariants, product Specs, acceptance actors, product code, runtime, and
production state MUST remain unchanged.

### CTR-ADOPT-004 — Three-axis forward route

After activation, every applicable non-trivial task MUST classify Authority,
Plan, and Assurance independently, bind `DONE_WHEN`, and stop unless an
`EXPANSION_TRIGGER` fires. Every mutation requires attributable authorization
and an isolated write surface. Historical artifacts MUST NOT be bulk rewritten.

### CTR-ADOPT-005 — Independent local activation

The preparation Head MUST receive independent exact-Head Review. Only a later
Owner-authorized atomic transaction may accept V1, supersede V0, accept the
lock, update navigation, pass final-Head recheck, and merge.

## 10. Acceptance

### ACC-ADOPT-001 — Release identity

- Contracts: `CTR-ADOPT-001`.
- Method: inspect the upstream tag ref/object, peel it to the exact commit,
  inspect `VERSION`, recompute the manifest identity, and compare all 25
  manifest entries to the candidate.
- Environment: clean upstream and consumer checkouts on a Linux runner with
  Git and Python 3; GitHub Git object API for annotated-tag identity.
- Required evidence: exact tag ref/type/object, peeled commit, `VERSION`,
  manifest Git blob and SHA-256, and a 25-path size/hash/byte matrix.
- Expected result: annotated tag object
  `a7a60006861d09d502e3e7ea5c1a67c31280c571` peels to
  `3de35f8617616dda4c717233899d6a93a634d5d8`; distribution/version are
  `development-governance-v0`/`1.0.1`; all 25 candidate files match.
- Failure condition: any lightweight, different, missing, or unverifiable tag,
  path, hash, size, pin, version, or distribution ID fails acceptance.

### ACC-ADOPT-002 — Lifecycle and preservation

- Contracts: `CTR-ADOPT-002`, `CTR-ADOPT-003`, `CTR-ADOPT-005`.
- Method: compare Base and candidate trees; inspect the lock, V0/V1
  frontmatter, PR state, protected local paths, and product/runtime path set.
- Environment: exact Git object comparison plus a clean detached candidate
  checkout; no production or runtime access is required.
- Required evidence: Base/candidate coordinates, changed-file list, lock
  metadata, V0/V1 lifecycle fields, PR Draft state, and blob/path comparison
  for `AGENTS.md`, `.agents/local/**`, local authorities, and product/runtime
  paths.
- Expected result: V1 and lock remain proposed with null acceptance metadata;
  V0 remains accepted/current and unchanged; PR remains Draft/unmerged; every
  protected local, product, runtime, and production path has zero delta.
- Failure condition: premature acceptance, supersession, Ready state, merge,
  or any unauthorized local, product, runtime, production, permission,
  credential, Secret, or GitHub-setting change fails acceptance.

### ACC-ADOPT-003 — Governance validation

- Contracts: `CTR-ADOPT-001`, `CTR-ADOPT-004`.
- Method: run the exact upstream vendor CLI in dry-run mode against the exact
  candidate; run the candidate vendored-byte verifier; compile all candidate
  Python tools; run valid, contradictory, and malformed route fixtures.
- Environment: clean exact consumer/upstream checkouts on GitHub-hosted Ubuntu
  24.04 with Python 3.12.3, or an independently reproduced equivalent
  environment with the same bound revisions.
- Required evidence: commands, runner and Python versions, execution time,
  consumer/upstream Head SHAs, complete operation plan, no-write worktree
  check, verifier output, fixture inputs, stdout/stderr, and exit codes.
- Expected result: vendor dry-run exits 0 with 26 planned operations and no
  writes; governance verifier and Python compilation exit 0; valid route exits
  0; contradictory route exits 1; malformed JSON exits 2.
- Failure condition: a write during dry-run, an unexpected path, byte/lock
  mismatch, compile failure, false pass/fail, wrong exit code, unavailable
  provenance, or evidence not bound to the candidate fails acceptance.

## 11. Alternatives and disposition

Rejected: in-place V0 rewrite; pinning upstream `main`; renaming the
compatibility distribution ID; auto-accepting during vendoring; bulk historical
rewrite.

## 12. Migration, compatibility, and rollback

`PRODUCT_CODE_MIGRATION=NONE`, `DATA_MIGRATION=NONE`,
`RUNTIME_MIGRATION=NONE`, `PRODUCTION_MIGRATION=NONE`.
Existing product authorities and local extensions retain meaning. Before
acceptance, rollback is closing the Draft PR. After acceptance, rollback
requires a new accepted successor; accepted V1 meaning is not rewritten.

## 13. Open questions

```text
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
PARTIAL_SUPERSESSION = NONE
```

## Final proposed output

```text
AUTHORITY_ACTION = SUPERSEDE
PLAN_LEVEL = EXEC_PLAN
ASSURANCE_LEVEL = DURABLE
ROUTE_STAGE = AUTHORITY_AUTHORING
AUTHORITY_ACCEPTED_IN_BASE = NO
ADOPTION_STATUS = proposed
IMPLEMENTATION_AUTHORITY = none
PRODUCT_CODE_CHANGE = NONE
RUNTIME_OR_PRODUCTION_CHANGE = NONE
READY_FOR_INDEPENDENT_REVIEW = YES
READY_FOR_OWNER_ACCEPTANCE = NO
```
