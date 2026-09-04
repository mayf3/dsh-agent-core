---
spec_id: AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V2
status: proposed
spec_kind: invariant
authority_level: governing_spec
implementation_authority: none
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
  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V1
superseded_by: null
owners:
  - mayf3
---

# Agent Development Governance v1.0.1 Adoption V2

## 1. Goal

Re-point the local adoption candidate from upstream `development-governance-v0`
release `v1.0.0` (`902842735a69797b54016eeaa88d2f949f5879a9`) to the published
immutable release `v1.0.1` at annotated tag
`a7a60006861d09d502e3e7ea5c1a67c31280c571`, peeling to source commit
`3de35f8617616dda4c717233899d6a93a634d5d8`, by re-vendoring the exact v1.0.1
bytes with the exact upstream vendor tool and recording a NEW proposed
adoption lifecycle event, through this repository's own independent Review and
Owner acceptance. V1 proposed adoption of the v1.0.0 candidate and MUST NOT be
rewritten in place; this proposed V2 is its complete successor.

## 2. Scope and non-goals

In scope: the re-vendored exact manifest-managed shared governance bytes, the
governance lock, the local adoption/supersession lifecycle for the v1.0.1
generation, route validation, and forward-only use.

Out of scope: changes to `AGENTS.md`, `.agents/local/**`, local Product
Direction, Architecture, product Specs, acceptance actor, product code,
runtime, production, permissions, Grants, credentials, Secrets, historical
records, `AGENT_OPERATIONAL_LAYER_V1`, and the upstream repository
`mayf3/agent-development-governance`; this preparation does not accept or
merge itself.

## 3. Authority and dependencies

### DEC-ADOPT-001 — Whole-authority successor of V1

V1 is the proposed adoption authority for the v1.0.0 candidate on this same
preparation Head. Its release identity, evidence, and exact-pin contracts are
bound to `v1.0.0@902842735a69797b54016eeaa88d2f949f5879a9` and MUST NOT be
reworded to describe a different release. Upstream published `v1.0.1` as an
immutable successor release ("fix proposed-successor transitions in
`validate_spec_transition`"), so the candidate generation changed. Following
the forward-only adoption pattern, V1 remains untouched and this proposed V2
is its complete successor.

### DEC-ADOPT-002 — Local acceptance remains authoritative

Upstream release status does not activate local authority. The consumer owns
independent Review, Owner acceptance, atomic lifecycle transition, and merge.
`.agents/local/**` remains higher-precedence repository-local extension. The
re-vendor preparation itself MUST start a NEW proposed lifecycle event
(`adoption.status=proposed`, null acceptance metadata); it MUST NOT inherit or
carry forward any accepted state from the older draft generation recorded in
the pre-existing lock on this branch's history.

## 4. Current State

### STATE-ADOPT-001 — The candidate generation moved from v1.0.0 to v1.0.1

- Subject: governance adoption candidate in PR #140.
- As-of revision: consumer candidate at the v1.0.1 re-vendor Head; upstream
  source `3de35f8617616dda4c717233899d6a93a634d5d8`.
- Environment: local exact consumer/upstream checkouts; repository object
  state only, with no runtime or production mutation.
- Observed at: `2026-09-04T00:13:24Z` (dry-run) and `2026-09-04T00:13:38Z`
  (apply).
- Basis: `OBS-ADOPT-002`, `OBS-ADOPT-003`, `OBS-ADOPT-004`, `OBS-ADOPT-005`.
- State: upstream published immutable `v1.0.1`; the PR candidate is re-pinned
  to it with a newly proposed lock; V1 remains proposed and untouched.

### STATE-ADOPT-002 — The prepared candidate remains proposed

- Subject: Governance v1.0.1 adoption candidate in PR #140.
- As-of revision: consumer candidate Head at the v1.0.1 re-vendor (the PR
  Head after the re-vendor commit; bound in the PR description).
- Environment: exact consumer checkout.
- Observed at: `2026-09-04T00:13:38Z`.
- Basis: `OBS-ADOPT-004`, `OBS-ADOPT-005`, `OBS-ADOPT-006`, `EVD-ADOPT-004`.
- State: the 25 exact v1.0.1 managed files and a proposed lock are present;
  V2 is proposed, V1 remains proposed (superseded candidate proposal), V0
  remains accepted/current on `main`, and no local adoption is active.

### STATE-ADOPT-003 — Required execution evidence is recorded and reproducible

- Subject: vendor dry-run, vendored-byte verifier, Python entrypoint
  compilation, and governance verifier outcomes for the re-vendor.
- As-of revision: upstream source `3de35f8617616dda4c717233899d6a93a634d5d8`;
  consumer candidate at the v1.0.1 re-vendor Head on top of merge
  `a1605a76c104ccc67ed4999a1646ce913ce64d67`.
- Environment: macOS 26.6.2 (arm64), Python 3.14.7; execution logs preserved
  out-of-tree and key receipts reproduced in the PR description.
- Observed at: `2026-09-04T00:17:35Z`.
- Basis: `OBS-ADOPT-005`, `OBS-ADOPT-006`, `OBS-ADOPT-007`, `EVD-ADOPT-005`.
- State: the actual upstream vendor dry-run, apply, byte verification, and
  candidate validators completed with their required outcomes; this is
  execution evidence for a later independent Review, not an acceptance
  decision.

## 5. Observations

### OBS-ADOPT-001 — Consumer branch state at re-vendor start

- Subject: branch `governance/adopt-development-governance-v1.0.0` Head,
  lock, `AGENTS.md`, and `.agents/local/**` in `mayf3/dsh-agent-core`.
- Source revision: `8847d470190152872ec5e062b7e34a6b893e1287`.
- Environment: fresh clone of the consumer repository.
- Observed at: `2026-09-04T00:09:00Z` (approximately; pre-change baseline).
- Method: read the Head commit, lock metadata, and SHA-256 of `AGENTS.md` and
  every file under `.agents/local/**`.
- Result: Head matched the PR #140 head `8847d470190152872ec5e062b7e34a6b893e1287`;
  the lock pinned `1.0.0@902842735a69797b54016eeaa88d2f949f5879a9` with
  `adoption.status=proposed` (the V1 preparation); `AGENTS.md` and
  `.agents/local/**` (2 files) were recorded as the protected baseline.

### OBS-ADOPT-002 — Upstream release identity

- Subject: upstream ref `refs/tags/v1.0.1`, annotated tag object, and peeled
  target in `mayf3/agent-development-governance`.
- Source revision: tag object `a7a60006861d09d502e3e7ea5c1a67c31280c571`.
- Environment: fresh exact upstream clone, Git object reads.
- Observed at: `2026-09-04T00:09:00Z` (approximately).
- Method: fetch tags, inspect the tag ref/object type, and check out its
  peeled target.
- Result: `v1.0.1` is an annotated tag (type `tag`, unsigned) with message
  "Agent Development Governance v1.0.1 — fix proposed-successor transitions
  in validate_spec_transition" and resolves exactly to
  `3de35f8617616dda4c717233899d6a93a634d5d8`; upstream `VERSION` = `1.0.1`.
- Provenance: upstream tag ref/object reads.

### OBS-ADOPT-003 — Distribution manifest identity

- Subject: upstream `VERSION` and `distribution/manifest.json` at
  `3de35f8617616dda4c717233899d6a93a634d5d8`.
- Source revision: `3de35f8617616dda4c717233899d6a93a634d5d8`.
- Environment: exact clean upstream checkout.
- Observed at: `2026-09-04T00:13:00Z` (approximately).
- Method: read `VERSION`, parse the manifest, and verify its Git blob,
  SHA-256, distribution, version, and file count.
- Result: version=`1.0.1`, distribution=`development-governance-v0`,
  managed files=25, manifest Git blob=
  `8f36d7e1da0feaa016a474a65e467a280b8ad69d`, manifest SHA-256=
  `c84f6557c7c9de404ebce81440d31d2febbc239dc16c0d0e504f94179c774eaf`.
- Provenance: upstream `VERSION` and manifest object reads.

### OBS-ADOPT-004 — Candidate bytes and lifecycle

- Subject: PR #140 candidate governance tree and local adoption metadata
  after the re-vendor.
- Source revision: consumer candidate at the v1.0.1 re-vendor Head.
- Environment: exact consumer checkout and hash comparison against the exact
  upstream checkout.
- Observed at: `2026-09-04T00:14:00Z` (approximately).
- Method: compare all 25 manifest-managed paths (SHA-256 and size) and the
  lock to the upstream source; verify byte identity to the upstream checkout;
  compare protected local and product paths to the pre-change baseline.
- Result: 25/25 managed bytes match upstream exactly (0 mismatches);
  upstream `tools/verify_vendor.py` exit 0 ("vendored governance bytes match
  governance.lock.json"); the lock is version `1.0.1` with
  `adoption.status=proposed`, `accepted_by=null`, `accepted_at=null`;
  `AGENTS.md`, `.agents/local/**`, and all product paths are unchanged.
- Provenance: byte verification log and upstream verifier output reproduced
  in the PR description.

### OBS-ADOPT-005 — Actual upstream vendor dry-run and apply

- Subject: exact upstream `tools/vendor.py` operating on the exact consumer
  candidate.
- Source revision: upstream `3de35f8617616dda4c717233899d6a93a634d5d8`;
  consumer candidate at merge `a1605a76c104ccc67ed4999a1646ce913ce64d67`.
- Environment: macOS 26.6.2 (arm64), Python 3.14.7.
- Observed at: `2026-09-04T00:13:24Z` (dry-run) and `2026-09-04T00:13:38Z`
  (apply).
- Method: run `python3 upstream/tools/vendor.py --target consumer
  --source-commit 3de35f8617616dda4c717233899d6a93a634d5d8 --prepared-by
  "ZCode / re-vendor-adoption-preparation-agent" --adoption-status proposed`
  without `--apply`, inspect the plan, then re-run with `--apply`.
- Result: dry-run exit 0; 26 operations planned (25 managed files plus the
  lock), all under `.agents/**`; no `AGENTS.md`, `.agents/local/**`, docs, or
  product path in the plan; no file written during dry-run. Apply exit 0
  ("Governance files and lock written.").
- Provenance: dry-run and apply logs reproduced in the PR description.

### OBS-ADOPT-006 — Candidate verifier and compile outcomes

- Subject: exact vendored verifier and Python entrypoint compilation in the
  consumer candidate.
- Source revision: consumer candidate at the v1.0.1 re-vendor Head.
- Environment: macOS 26.6.2 (arm64), Python 3.14.7.
- Observed at: `2026-09-04T00:17:35Z`.
- Method: run `python3 -m py_compile .agents/tools/*.py`;
  `verify_governance.py --target .` (plain); `verify_governance.py --target .
  --require-accepted`.
- Result: compile exit 0; plain verifier exit 0; `--require-accepted` exit 1
  with "adoption is not accepted" — the expected fail-closed outcome while
  the adoption remains proposed.
- Provenance: sanity log reproduced in the PR description.

### OBS-ADOPT-007 — Base refresh merge

- Subject: `origin/main` movement during preparation.
- Source revision: merge-base `840d2f4ad91f8252eb1f163330c041216a0dd9c4`;
  `origin/main` at `af91b246bd86c3c525716580492b62e369a8a5a8`.
- Environment: exact consumer clone.
- Observed at: `2026-09-04T00:11:00Z` (approximately).
- Method: compare merge-base to `origin/main`, diff changed paths, and merge
  `origin/main` into the branch with a normal (non-force) merge commit.
- Result: `origin/main` had advanced 4 commits; changed paths touched
  `.agents/structure-registry.json` (outside the managed manifest set) plus
  product and docs paths, with zero overlap with the 25 managed files; the
  merge completed without conflict as commit
  `a1605a76c104ccc67ed4999a1646ce913ce64d67`.
- Provenance: merge commit object.

## 6. Claims and assumptions

### CLM-ADOPT-001 — The upstream release change requires a successor adoption Spec

- Support state: SUPPORTED.
- Supported by evidence: `EVD-ADOPT-001`.
- Contradicted by evidence: none known.
- Uncertainty: local activation remains contingent on independent Review,
  Owner acceptance, atomic lifecycle closure, and merge.

### CLM-ADOPT-002 — Exact manifest re-vendoring preserves local authority boundaries

- Support state: SUPPORTED.
- Supported by evidence: `EVD-ADOPT-002`.
- Contradicted by evidence: none known.
- Uncertainty: the conclusion applies to the pinned distribution and exact
  consumer candidate only.

### CLM-ADOPT-003 — The candidate supplies reviewable execution evidence

- Support state: SUPPORTED.
- Supported by evidence: `EVD-ADOPT-003`.
- Contradicted by evidence: none known.
- Uncertainty: the re-vendor execution is author-side evidence in a local
  environment; it does not replace the required independent exact-Head Review
  or final accepted-Head recheck.

Open assumptions affecting normative meaning: none.

## 7. Evidence relations

### EVD-ADOPT-001 — Upstream release facts support succession

- Source observations: `OBS-ADOPT-002`, `OBS-ADOPT-003`, `OBS-ADOPT-007`.
- Target: `CLM-ADOPT-001`.
- Relation: SUPPORTS.
- Bound coordinates: upstream tag object
  `a7a60006861d09d502e3e7ea5c1a67c31280c571`; upstream source
  `3de35f8617616dda4c717233899d6a93a634d5d8`; superseded candidate pin
  `902842735a69797b54016eeaa88d2f949f5879a9`.
- Strength/sufficiency: sufficient to classify the candidate-generation
  change and the need for a whole-authority successor of V1 rather than an
  in-place V1 rewrite.
- Limitations: does not perform or authorize local acceptance.
- Provenance: upstream tag/object reads and the merge commit.

### EVD-ADOPT-002 — Manifest and candidate comparison support local preservation

- Source observations: `OBS-ADOPT-003`, `OBS-ADOPT-004`, `OBS-ADOPT-005`.
- Target: `CLM-ADOPT-002`.
- Relation: SUPPORTS.
- Bound coordinates: upstream source `3de35f8617616dda4c717233899d6a93a634d5d8`;
  consumer candidate at the v1.0.1 re-vendor Head; pre-change Head
  `8847d470190152872ec5e062b7e34a6b893e1287`.
- Strength/sufficiency: strong for the 25 managed paths, lock fields, and
  protected local/product path set.
- Limitations: dry-run proves planning and no-write behavior; candidate byte
  identity is established separately by object/hash comparison.
- Provenance: byte verification and dry-run/apply logs.

### EVD-ADOPT-003 — Executed checks support candidate reviewability

- Source observations: `OBS-ADOPT-004`, `OBS-ADOPT-005`, `OBS-ADOPT-006`.
- Target: `CLM-ADOPT-003`.
- Relation: SUPPORTS.
- Bound coordinates: consumer candidate at the v1.0.1 re-vendor Head;
  upstream source `3de35f8617616dda4c717233899d6a93a634d5d8`.
- Strength/sufficiency: sufficient author-side executed evidence for an
  independent Reviewer to reproduce and evaluate the adoption candidate.
- Limitations: does not constitute independent Review or local acceptance.
- Provenance: sanity and byte-verification logs.

### EVD-ADOPT-004 — Candidate object and execution observations support proposed state

- Source observations: `OBS-ADOPT-004`, `OBS-ADOPT-005`, `OBS-ADOPT-006`.
- Target: `STATE-ADOPT-002`.
- Relation: SUPPORTS.
- Bound coordinates: consumer candidate at the v1.0.1 re-vendor Head;
  pre-change Head `8847d470190152872ec5e062b7e34a6b893e1287`.
- Strength/sufficiency: sufficient to establish that the prepared candidate
  is proposed, byte-exact for managed files, and non-mutating outside its
  scope.
- Limitations: the resulting Head must receive a new exact-Head review; this
  relation does not predict future Base movement.
- Provenance: candidate/baseline hash comparison and validator outputs.

### EVD-ADOPT-005 — Execution receipts support reproducibility state

- Source observations: `OBS-ADOPT-005`, `OBS-ADOPT-006`.
- Target: `STATE-ADOPT-003`.
- Relation: SUPPORTS.
- Bound coordinates: consumer candidate at the v1.0.1 re-vendor Head;
  upstream source `3de35f8617616dda4c717233899d6a93a634d5d8`; macOS 26.6.2
  (arm64), Python 3.14.7, observed `2026-09-04T00:13:24Z`–
  `2026-09-04T00:17:35Z`.
- Strength/sufficiency: strong for the recorded commands, outputs, and exit
  codes; the dry-run no-write property is established by the unchanged
  worktree.
- Limitations: execution occurred in a local environment, not a CI runner;
  an independent Reviewer must reproduce with the same bound revisions and
  bind the resulting exact Head.
- Provenance: dry-run, apply, byte-verification, and sanity logs.

## 8. Decisions

### DEC-ADOPT-003 — Exact pin

The local lock MUST pin source repository `mayf3/agent-development-governance`,
source commit `3de35f8617616dda4c717233899d6a93a634d5d8`, version `1.0.1`,
compatibility distribution ID `development-governance-v0`, and distribution
manifest SHA-256 `c84f6557c7c9de404ebce81440d31d2febbc239dc16c0d0e504f94179c774eaf`.
Mutable upstream branches or a different commit MUST NOT substitute.

### DEC-ADOPT-004 — New proposed lifecycle event

Because the prior lifecycle state on this branch described the v1.0.0
candidate, the v1.0.1 re-vendor MUST record a NEW proposed adoption event:
`adoption.status=proposed`, `prepared_by="ZCode /
re-vendor-adoption-preparation-agent"`, `prepared_at=2026-09-04T00:13:38Z`,
`accepted_by=null`, `accepted_at=null`. Any accepted state MUST NOT be
inherited from a prior generation.

### DEC-ADOPT-005 — Proposed preparation only

Preparation MUST retain V0 as current, leave V1 untouched as the superseded
candidate proposal, retain all local/product authority, and leave both the
new Spec and lock proposed. A later transaction may accept V2, supersede V1
(and transitively V0) with reciprocal backlinks, populate acceptance
metadata, update the index, pass final-Head recheck, and merge into `main`.

## 9. Contracts

### CTR-ADOPT-001 — Exact release and bytes

The tag, annotated tag object, source commit, manifest identity, 25 managed
paths, hashes, sizes, version, and distribution ID MUST match upstream v1.0.1
exactly.

### CTR-ADOPT-002 — Proposed lifecycle

On this preparation Head, `adoption.status=proposed`, `accepted_by=null`, and
`accepted_at=null`; V0 MUST remain accepted/current and unchanged; V1 MUST
remain byte-unchanged. The Agent MUST NOT mark the PR ready, accept, or merge
it.

### CTR-ADOPT-003 — Local preservation

`AGENTS.md`, `.agents/local/**`, local Product Direction, Architecture,
invariants, product Specs (other than this successor Spec file), acceptance
actors, product code, runtime, and production state MUST remain unchanged.

### CTR-ADOPT-004 — Three-axis forward route

After activation, every applicable non-trivial task MUST classify Authority,
Plan, and Assurance independently, bind `DONE_WHEN`, and stop unless an
`EXPANSION_TRIGGER` fires. Every mutation requires attributable authorization
and an isolated write surface. Historical artifacts MUST NOT be bulk rewritten.

### CTR-ADOPT-005 — Independent local activation

The preparation Head MUST receive independent exact-Head Review. Only a later
Owner-authorized atomic transaction may accept V2, supersede V1 and V0,
accept the lock, update navigation, pass final-Head recheck, and merge.

## 10. Acceptance

### ACC-ADOPT-001 — Release identity

- Contracts: `CTR-ADOPT-001`.
- Method: inspect the upstream tag ref/object, peel it to the exact commit,
  inspect `VERSION`, recompute the manifest identity, and compare all 25
  manifest entries to the candidate.
- Environment: clean upstream and consumer checkouts with Git and Python 3.
- Required evidence: exact tag ref/type/object, peeled commit, `VERSION`,
  manifest Git blob and SHA-256, and a 25-path size/hash/byte matrix.
- Expected result: annotated tag object
  `a7a60006861d09d502e3e7ea5c1a67c31280c571` peels to
  `3de35f8617616dda4c717233899d6a93a634d5d8`; distribution/version are
  `development-governance-v0`/`1.0.1`; all 25 candidate files match.
- Failure condition: any lightweight, different, missing, or unverifiable
  tag, path, hash, size, pin, version, or distribution ID fails acceptance.

### ACC-ADOPT-002 — Lifecycle and preservation

- Contracts: `CTR-ADOPT-002`, `CTR-ADOPT-003`, `CTR-ADOPT-005`.
- Method: compare the pre-change and candidate trees; inspect the lock, V0/V1
  frontmatter, PR state, protected local paths, and product/runtime path set.
- Environment: exact Git object comparison plus a clean detached candidate
  checkout; no production or runtime access is required.
- Required evidence: pre-change/candidate coordinates, changed-file list,
  lock metadata, V0/V1 lifecycle fields, PR Draft state, and blob/path
  comparison for `AGENTS.md`, `.agents/local/**`, local authorities, and
  product/runtime paths.
- Expected result: V2 and the lock remain proposed with null acceptance
  metadata; V0 remains accepted/current and unchanged; V1 remains
  byte-unchanged; PR remains Draft/unmerged; every protected local, product,
  runtime, and production path has zero delta apart from the sanctioned
  `origin/main` merge.
- Failure condition: premature acceptance, supersession, Ready state, merge,
  or any unauthorized local, product, runtime, production, permission,
  credential, Secret, or GitHub-setting change fails acceptance.

### ACC-ADOPT-003 — Governance validation

- Contracts: `CTR-ADOPT-001`, `CTR-ADOPT-004`.
- Method: run the exact upstream vendor CLI in dry-run mode against the exact
  candidate; run the candidate vendored-byte verifier; compile all candidate
  Python tools; run the plain and `--require-accepted` verifier modes.
- Environment: clean exact consumer/upstream checkouts with Git and Python 3,
  or an independently reproduced equivalent environment with the same bound
  revisions.
- Required evidence: commands, environment and Python versions, execution
  time, consumer/upstream Head SHAs, complete operation plan, no-write
  worktree check, verifier outputs, and exit codes.
- Expected result: vendor dry-run exits 0 with 26 planned operations and no
  writes; apply exits 0; 25/25 byte comparison shows 0 mismatches;
  `tools/verify_vendor.py` exits 0; Python compilation exits 0; plain
  `verify_governance.py` exits 0; `--require-accepted` exits 1 with
  "adoption is not accepted" while the lock remains proposed.
- Failure condition: a write during dry-run, an unexpected path, byte/lock
  mismatch, compile failure, false pass/fail, wrong exit code, unavailable
  provenance, or evidence not bound to the candidate fails acceptance.

## 11. Alternatives and disposition

Rejected: in-place V1 rewrite (V1's identity and evidence are bound to the
v1.0.0 candidate); omitting a successor Spec and leaving V1 contradicting the
shipped lock; pinning upstream `main`; renaming the compatibility distribution
ID; auto-accepting during vendoring; inheriting accepted state from the prior
generation; bulk historical rewrite.

## 12. Migration, compatibility, and rollback

`PRODUCT_CODE_MIGRATION=NONE`, `DATA_MIGRATION=NONE`,
`RUNTIME_MIGRATION=NONE`, `PRODUCTION_MIGRATION=NONE`.
Existing product authorities and local extensions retain meaning. Before
acceptance, rollback is reverting the re-vendor commit(s) on the Draft PR.
After acceptance, rollback requires a new accepted successor; accepted V2
meaning is not rewritten.

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
