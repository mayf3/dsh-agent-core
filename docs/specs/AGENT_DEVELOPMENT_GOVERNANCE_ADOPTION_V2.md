---
spec_id: AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V2
status: accepted
spec_kind: invariant
authority_level: governing_spec
implementation_authority: none
accepted_date: 2026-09-05
accepted_by: mayf3
accepted_at: 2026-09-05T00:21:28Z
accepted_reviewed_spec_commit: 8eed354656e9de249f7dfab3f9b0610132ebb167
acceptance_review_verdict: PASS
acceptance_authority_basis: >-
  Owner-issued Master Goal GOVERNANCE_TRANSITION_CHAIN_CONFORMANCE_RECONCILIATION_V1
  (OWNER_DECISION = FORWARD_RECONCILE_WITHOUT_AUTOMATIC_ROLLBACK) pre-authorized
  the full lifecycle after the upstream v1.0.3 publication (PR #13; independent
  implementation audit ACCEPT comment 5547708677; exact-Head release review
  ACCEPT comment 5547784462), one independent proposed-Head review of this
  candidate (ACCEPT, BLOCKERS = 0, BASE_IMPACT = NONE, comment 5548006704),
  and the non-waivable raw full-graph transition gate executed at this
  acceptance Head. Reviewed content unchanged by lifecycle finalization
  except the two reviewer-authorized SPEC_GAP record corrections and the
  authorized lifecycle fields.
scope:
  - mayf3/dsh-agent-core development governance adoption
  - shared vendored governance integrity and local activation lifecycle
governed_by: []
external_authorities:
  - repository: mayf3/agent-development-governance
    authority_id: AGENT_DEVELOPMENT_GOVERNANCE_V1
    revision: 0d61433339ef563f82307b70120d9fcee168cdab
    relation: constrained_by
supersedes:
  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V1
superseded_by: null
owners:
  - mayf3
---

# Agent Development Governance v1.0.3 Adoption V2

> 状态：**accepted**；独立 proposed-Head 审计（ACCEPT / BLOCKERS = 0，comment
> 5548006704）通过后，由 mayf3 依据 Owner-issued Master Goal
> `GOVERNANCE_TRANSITION_CHAIN_CONFORMANCE_RECONCILIATION_V1` 完成 acceptance。
> reviewed head `8eed354656e9de249f7dfab3f9b0610132ebb167` 的 normative 内容在
> lifecycle finalization 中保持不变（另含两条 reviewer 授权的记录修正）；本 Spec
> 不授权任何产品 implementation。

## 1. Goal

Adopt the exact upstream `development-governance-v0` distribution released as
annotated tag `v1.0.3` (tag object
`008214f673d11dd345fa1d4416036d1c0f25314a`, release
https://github.com/mayf3/agent-development-governance/releases/tag/v1.0.3) at
source commit `0d61433339ef563f82307b70120d9fcee168cdab` as a vendored,
byte-exact development grammar, by whole-authority succession from the
accepted `AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V1` (Governance v1.0.1).

The obligation change that forces this replacement is the upstream v1.0.3
transition-validator fix: the v1.0.1 validator could not express raw
multi-generation whole-authority successor chains or historical frontmatter
records, which forced input normalization to obtain any transition PASS and
contributed to the recorded mandate deviation
(`docs/investigations/GOVERNANCE_V1_0_1_MANDATE_CONFORMANCE_RECONCILIATION_V1`).
After this adoption, the repository's real, raw, unnormalized authority chain

```text
AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1 (superseded)
  -> AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0 (superseded)
  -> AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V1 (accepted until acceptance)
  -> AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V2 (this Spec, proposed until acceptance)
```

MUST validate directly with `validate_spec_transition.py` exit 0 at both the
accepted candidate Head and merged `main`, with no normalization of any kind.

## 2. Scope and non-goals

In scope: the exact 25 manifest-managed upstream bytes, the vendored
governance lock, the proposed successor authority, and the preparation
evidence for this adoption round.

Out of scope (non-goals): product code, runtime, production, permissions,
Grants, Credentials, Secrets, local Product Direction / Architecture /
invariants / product Specs, `AGENTS.md`, `.agents/local/**`, and any
rewriting of this repository's historical governance records.

## 3. Authority and dependencies

### DEC-201 — Whole-authority successor

- Decision: this Spec replaces the whole of
  `AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V1` upon acceptance and supersedes
  only V1. V0 remains `superseded_by: AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V1`;
  the chain to it is expressed by reciprocal backlinks in lifecycle metadata,
  never by a "transitively supersedes" claim. Upon acceptance V1 becomes
  `status: superseded, superseded_by: AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V2`.
- Rejected alternatives: amending V1 in place; a V2 that claims V0 as a
  direct predecessor; a prose-only partial supersession.
- Reason: accepted authority identity and backlinks are immutable history;
  V1 is accepted on `main`, so a direct successor edge is legal.

### DEC-202 — Local acceptance remains authoritative

- Decision: upstream releases never activate anything locally. Only this
  repository's Owner-authorized acceptance transaction activates the
  vendored bytes and the successor lifecycle.
- Rejected alternatives: automatic adoption; consumer acceptance by upstream.
- Reason: consumers remain owners of their local authority map.

## 4. Current State

### STATE-201 — Current authority state at the preparation Base

- Subject: `mayf3/dsh-agent-core` development-governance authority graph.
- As-of revision: consumer Base `aa8fbe5` (current `main`; includes the
  v1.0.1 adoption merge `237d42220582ea74f2d6b5e6819d712ec074377e`).
- Environment: local clean detached worktree `/tmp/dsh-v103-update`.
- Observed at: 2026-09-04T23:54Z.
- Basis / State: `.agents/governance.lock.json` records
  `version=1.0.1`, `adoption.status=accepted`,
  `accepted_by=mayf3`, `accepted_at=2026-09-04T15:11:51Z`;
  `AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V1` is `accepted` and is the only
  current adoption authority; V0 is `superseded_by: V1`; RKGV1 is
  `superseded_by: V0` with its historical minimal frontmatter.

### STATE-202 — The prepared candidate remains proposed

- Subject: this adoption candidate (25 vendored bytes + lock + this Spec).
- As-of revision: candidate branch `governance/adopt-development-governance-v1.0.3`.
- Environment: isolated consumer worktree, no writes outside the adoption surface.
- Observed at: 2026-09-04T23:54:32Z (lock `prepared_at`).
- Basis / State: lock `adoption.status=proposed`, `accepted_by=null`,
  `accepted_at=null`, `prepared_by="ZCode / re-vendor-adoption-preparation-agent"`,
  `prepared_at=2026-09-04T23:54:32Z`; this Spec `status: proposed`;
  PR remains Draft.

### STATE-203 — Required execution evidence is reproducible

- Subject: consumer-side execution evidence for this round.
- As-of revision: candidate tree after `vendor.py --apply`.
- Environment: local Python 3, clean worktree, no production access.
- Observed at: 2026-09-04T23:54Z–23:59Z.
- Basis / State: vendor CLI default dry-run exited 0 with "No files written"
  and a zero-dirty tree before `--apply`; post-apply 25-path matrix matches
  the upstream manifest exactly; `verify_governance.py --target .` exited 0;
  route-validator fixtures exited 0 / 1 / 2; the vendored v1.0.3 transition
  validator exits 0 on the raw proposed-state full graph (Base authority set
  plus proposed V2) and on the raw `main`-vs-`main` self-transition.

## 5. Observations

### OBS-201 — Consumer Base authority state

- Subject: `mayf3/dsh-agent-core` main adoption authority records.
- Source revision: `aa8fbe5`.
- Environment: clean git reads, no mutation.
- Observed at: 2026-09-04T23:54Z.
- Method: `git show` of the three adoption-graph spec frontmatters plus the lock.
- Result: V1 accepted/current (only adoption authority), V0 superseded by V1
  (reciprocal), RKGV1 superseded by V0 (reciprocal), lock accepted v1.0.1.
- Provenance: PR #140 merged at `237d422`; conformance record
  `docs/investigations/GOVERNANCE_V1_0_1_MANDATE_CONFORMANCE_RECONCILIATION_V1`.

### OBS-202 — Upstream release identity

- Subject: `mayf3/agent-development-governance` release v1.0.3.
- Source revision: upstream repository at tag `v1.0.3`.
- Environment: fresh clone `/tmp/adg-recon`.
- Observed at: 2026-09-04T23:53Z.
- Method: `git cat-file -t refs/tags/v1.0.3` (annotated tag), object and
  peel comparison, GitHub release listing.
- Result: annotated tag object `008214f673d11dd345fa1d4416036d1c0f25314a`
  peels to `0d61433339ef563f82307b70120d9fcee168cdab`; GitHub release
  v1.0.3 published as Latest from `docs/releases/V1.0.3.md`; publication was
  gated by an independent implementation audit
  (`ACCEPT`, comment `5547708677`) and an exact-Head release review
  (`ACCEPT`, comment `5547784462`); v1.0.0/v1.0.1/v1.0.2 tags remain untouched.
- Provenance: upstream PR #13 (merged), tags list, release listing.

### OBS-203 — Distribution manifest identity

- Subject: upstream `distribution/manifest.json` at `0d614333`.
- Source revision: `0d61433339ef563f82307b70120d9fcee168cdab`.
- Environment: fresh clone.
- Observed at: 2026-09-04T23:53Z.
- Method: `sha256sum distribution/manifest.json`; manifest field inspection.
- Result: SHA-256
  `f4aa7779623e670a384195ccc40e509fb5600ddfb97363f8b907386fffbceca2`;
  `distribution=development-governance-v0`, `version=1.0.3`, 25 file entries.
- Provenance: recomputed independently; matches the consumer lock field.

### OBS-204 — Candidate bytes and lifecycle

- Subject: consumer candidate `.agents` tree after `vendor.py --apply`.
- Source revision: candidate worktree (uncommitted at execution time).
- Environment: isolated worktree `/tmp/dsh-v103-update`.
- Observed at: 2026-09-04T23:54Z.
- Method: per-entry sha256+size comparison of all 25 manifest paths against
  the upstream checkout and the manifest.
- Result: 25/25 exact, 0 mismatches. Content delta versus the v1.0.1
  vendored set is exactly three files: `.agents/README.md`
  (GRAMMAR_VERSION 1.0.1 -> 1.0.3), `.agents/tools/validate_spec_transition.py`
  (the v1.0.3 fix, blob `dec8944...` -> `7f95666...`), and
  `.agents/governance.lock.json` (v1.0.3 pins, proposed lifecycle). Two
  further files show mode-only changes from the vendor CLI not preserving
  upstream exec bits (`.agents/tools/verify_governance.py`,
  `.agents/tools/validate_governance_route.py`); their content is unchanged
  and the committed mode is restored to `100755` — a known upstream
  tooling-debt artifact, recorded since the v1.0.0 round.
- Provenance: recomputed matrix in this worktree.

### OBS-205 — Actual upstream vendor dry-run and apply

- Subject: upstream `tools/vendor.py` execution against this consumer candidate.
- Source revision: candidate worktree at Base `aa8fbe5` plus lock target v1.0.3.
- Environment: local, isolated worktree, upstream checkout `/tmp/adg-recon`.
- Observed at: 2026-09-04T23:54Z.
- Method: default dry-run first (no `--apply`), then a single `--apply` with
  `--prepared-by "ZCode / re-vendor-adoption-preparation-agent"` and default
  proposed status; no `--allow-dirty-vendored` needed.
- Result: dry-run exited 0 with "No files written" and a zero-dirty tree;
  `--apply` exited 0 ("Governance files and lock written."); the applied
  bytes equal the upstream v1.0.3 tree per OBS-204.
- Provenance: command outputs in this preparation round; no production or
  upstream mutation.

### OBS-206 — Candidate verifier, route, and transition outcomes

- Subject: vendored tools executed on the candidate.
- Source revision: candidate worktree.
- Environment: local Python 3.
- Observed at: 2026-09-04T23:57Z–23:59Z.
- Method: `verify_governance.py --target .` (proposed mode);
  `validate_governance_route.py` with a schema-derived valid record, its
  readiness-violating mutation, and a malformed-JSON input;
  `python3 -m py_compile` on all vendored tools; the raw transition runs
  described in STATE-203.
- Result: verifier exit 0; route fixtures exit 0 / 1 / 2 with targeted
  errors; compile exit 0; raw proposed-state full graph exit 0; raw
  `main`-vs-`main` self-transition exit 0.
- Provenance: recorded in this preparation round; reproducible from the
  candidate tree.

## 6. Claims and assumptions

### CLM-201 — The obligation change requires whole-authority replacement

- Support state: SUPPORTED.
- Supported by evidence: `EVD-201`.
- Contradicted by evidence: none known.
- Uncertainty: local activation remains contingent on independent Review,
  Owner-authorized acceptance, atomic lifecycle closure, and merge.

### CLM-202 — Exact manifest vendoring preserves local authority boundaries

- Support state: SUPPORTED.
- Supported by evidence: `EVD-202`.
- Contradicted by evidence: none known.
- Uncertainty: none affecting normative meaning.

### CLM-203 — The candidate supplies reviewable execution evidence

- Support state: SUPPORTED.
- Supported by evidence: `EVD-203`.
- Contradicted by evidence: none known.
- Uncertainty: author-side executions are supporting only; the binding
  reproduction is the independent reviewer's own.

## 7. Evidence relations

### EVD-201 — Base and upstream facts support whole-authority replacement

- Source observations: OBS-201, OBS-202.
- Target: CLM-201.
- Relation: SUPPORTS.
- Bound coordinates: consumer `aa8fbe5`; upstream tag object `008214f6...`
  peeling to `0d614333...`.
- Strength: direct — an accepted current V1 plus a released upstream fix
  is exactly the whole-authority succession trigger.
- Limitations: none material.
- Provenance: this round's git records.

### EVD-202 — Manifest and candidate comparison support local preservation

- Source observations: OBS-203, OBS-204.
- Target: CLM-202.
- Relation: SUPPORTS.
- Bound coordinates: manifest `f4aa7779...`; 25/25 sha256+size equality.
- Strength: exact byte identity leaves no room for drift.
- Limitations: mode bits are recorded separately (OBS-204).
- Provenance: recomputed matrix.

### EVD-203 — Executed checks support candidate reviewability

- Source observations: OBS-205, OBS-206.
- Target: CLM-203.
- Relation: SUPPORTS.
- Bound coordinates: command classes, exit codes, and timestamps recorded
  in the observations.
- Strength: every check is independently re-executable from the candidate tree.
- Limitations: author-side executions are supporting evidence; the binding
  reproduction is the independent reviewer's own.
- Provenance: this round.

### EVD-204 — Raw graph validation supports the conformance closure goal

- Source observations: OBS-206, STATE-201.
- Target: CLM-201.
- Relation: SUPPORTS.
- Bound coordinates: raw full-graph runs with the v1.0.3 validator exit 0
  on the proposed state and on the `main` self-transition, with zero
  normalization; the v1.0.1 validator exits 1 on the same historical inputs.
- Strength: demonstrates the concrete obligation gap this adoption closes.
- Limitations: accepted-state validation is gated at CTR-205/CTR-206 and
  executes only in the Owner-authorized acceptance transaction.
- Provenance: this round; upstream PR #13 audits.

## 8. Decisions

### DEC-203 — Exact pin

- Decision: the local lock MUST pin source repository
  `mayf3/agent-development-governance`, source commit
  `0d61433339ef563f82307b70120d9fcee168cdab`, version `1.0.3`, distribution
  `development-governance-v0`, and manifest SHA-256
  `f4aa7779623e670a384195ccc40e509fb5600ddfb97363f8b907386fffbceca2`.
  Mutable upstream branches or different commits MUST NOT substitute.
- Rejected alternatives: pinning upstream `main`; re-pinning v1.0.1.
- Reason: exact immutable revision identity (inherited from V1's DEC-003).

### DEC-204 — Proposed preparation only

- Decision: preparation MUST retain V1 as current accepted authority, retain
  all local/product authority, and leave both this Spec and the lock
  proposed. A later Owner-authorized transaction may accept V2, supersede V1
  with reciprocal backlinks, populate acceptance metadata, update the
  navigation index, pass final-Head recheck, and merge into `main`.
- Rejected alternatives: self-acceptance; acceptance during vendoring.
- Reason: preparation stays distinct from local acceptance.

## 9. Contracts

### CTR-201 — Exact release and bytes

The tag, tag object, source commit, manifest identity, 25 managed paths,
hashes, sizes, version, and distribution ID MUST match upstream v1.0.3
exactly.

### CTR-202 — Proposed lifecycle

On this preparation Head, `adoption.status=proposed`, `accepted_by=null`,
and `accepted_at=null`; `AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V1` MUST
remain accepted/current and unchanged in normative content; the Agent MUST
NOT mark the PR Ready, accept, or merge it.

### CTR-203 — Local preservation

`AGENTS.md`, `.agents/local/**`, local Product Direction, Architecture,
invariants, product Specs, acceptance actors, product code, runtime, and
production state MUST remain unchanged. V0 and V1 normative content MUST
remain byte-identical (V1 lifecycle fields change only at acceptance).

### CTR-204 — Three-axis forward route

After activation, every applicable non-trivial task MUST classify Authority,
Plan, and Assurance independently, bind `DONE_WHEN`, and stop unless an
`EXPANSION_TRIGGER` fires. Historical artifacts MUST NOT be bulk rewritten.

### CTR-205 — Independent local activation and the raw transition gate

The preparation Head MUST receive independent exact-Head Review. Only a
later Owner-authorized atomic transaction may accept V2, supersede V1,
accept the lock, update navigation, pass final-Head recheck, and merge.
That transaction and the merged `main` MUST satisfy the non-waivable raw
gate: with the vendored v1.0.3 validator, using the real, complete,
un-normalized authority record set (RKGV1, V0, V1, V2), both the accepted
candidate state and the merged-main state MUST yield
`validate_spec_transition.py` exit 0 with stdout
`Spec transition is a valid whole-authority lifecycle state`. No
"changed-edges-only", "baseline failure", "tooling debt", normalized-fixture,
or manual-review substitute is valid.

### CTR-206 — Supersession chain integrity

At acceptance: V2 `status=accepted`, `supersedes=[V1]`;
V1 `status=superseded`, `superseded_by=AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V2`;
V0 unchanged (`superseded_by=V1`); RKGV1 unchanged; the lock `adoption`
status flips to `accepted` with valid `accepted_by`/`accepted_at` while
`prepared_by`/`prepared_at` are preserved verbatim. Exactly one current
accepted adoption authority (V2) MUST result.

## 10. Acceptance

### ACC-201 — Release identity

- Contracts: `CTR-201`.
- Method: inspect the upstream tag ref/object, peel it to the exact commit,
  recompute the manifest identity, and compare all 25 manifest entries to
  the candidate.
- Environment: clean upstream and consumer checkouts; no production access.
- Required evidence: tag object/peel values, manifest SHA-256, 25-entry
  comparison table.
- Expected result: tag object `008214f673d11dd345fa1d4416036d1c0f25314a`
  peels to `0d61433339ef563f82307b70120d9fcee168cdab`; manifest
  `f4aa7779623e670a384195ccc40e509fb5600ddfb97363f8b907386fffbceca2`;
  25/25 byte-exact.
- Failure condition: any pin or byte mismatch.

### ACC-202 — Lifecycle and preservation

- Contracts: `CTR-202`, `CTR-203`, `CTR-206`.
- Method: compare Base and candidate trees; inspect the lock, V0/V1/V2
  frontmatter, PR state, protected local paths, and the product/runtime
  path set.
- Environment: exact Git object comparison plus a clean detached candidate
  checkout.
- Required evidence: changed-path list confined to the adoption surface;
  lifecycle field values.
- Expected result: proposed lifecycle intact on the preparation Head; V0/V1
  normative content byte-identical; at acceptance the chain closes with
  exactly one current accepted authority.
- Failure condition: any normative-content change, dangling authority,
  parallel current authority, or missing reciprocal backlink.

### ACC-203 — Governance validation

- Contracts: `CTR-201`, `CTR-204`, `CTR-205`.
- Method: run the exact upstream vendor CLI in dry-run mode against the
  exact candidate; run the candidate vendored-byte verifier; compile all
  candidate Python tools; run valid, contradictory, and malformed route
  fixtures; run the raw full-graph transition validator on the proposed
  candidate state, the accepted candidate state, and merged `main`.
- Environment: clean exact consumer/upstream checkouts.
- Required evidence: exit codes for all runs, including the non-waivable
  raw gate results (exit 0 with the exact required stdout in all three
  states).
- Expected result: all checks pass with the recorded outcomes; any raw
  transition failure blocks acceptance, Ready, and merge.
- Failure condition: any gate failure, or any attempt to substitute a
  normalized/partial/manual judgment for the raw gate.

## 11. Alternatives and disposition

Rejected: staying on v1.0.1 with the raw-gate gap recorded as tooling debt
(contradicts the conformance reconciliation record and the Owner's hard
gate); rolling back the merged v1.0.1 adoption (Owner decision is
FORWARD_RECONCILE_WITHOUT_AUTOMATIC_ROLLBACK; the state is valid); amending
V1 in place (accepted meaning is immutable); claiming transitive V0
supersession (the backlink chain already expresses it).

## 12. Migration, compatibility, and rollback

`PRODUCT_CODE_MIGRATION=NONE`, `DATA_MIGRATION=NONE`,
`RUNTIME_MIGRATION=NONE`, `PRODUCTION_MIGRATION=NONE`. Existing product
authorities and local extensions retain meaning. Before acceptance, rollback
is closing the Draft PR. After acceptance, rollback requires a new accepted
successor; accepted V2 meaning is not rewritten.

## 13. Open questions

```text
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
PARTIAL_SUPERSESSION = NONE
```

## Final proposed output

```text
ROUTE_STAGE = AUTHORITY_AUTHORING
AUTHORITY_ACTION = SUPERSEDE
TARGET_SPEC = AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V2 (proposed)
SUPERSEDES = [AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V1]
PRIMARY_ACCEPTED_AUTHORITY_REMAINS = AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V1 (until acceptance)
IMPLEMENTATION_AUTHORITY = none
ATOMIC_ACCEPTANCE =
  V2 accepted; V1 superseded_by=V2; V0 superseded_by=V1 unchanged;
  RKGV1 unchanged; lock accepted; navigation updated; raw full-graph
  transition exit 0 on accepted candidate and merged main.
OWNER_DECISION_REQUIRED = YES
```
