---
spec_id: AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0
status: proposed
spec_kind: invariant
authority_level: governing_spec
implementation_authority: none
scope:
  - mayf3/dsh-agent-core
governed_by: []
external_authorities:
  - repository: mayf3/agent-development-governance
    authority_id: AGENT_DEVELOPMENT_GOVERNANCE_BOOTSTRAP_V0
    revision: 46f78c3f00d768d99a4c8c2da975b124bce042f9
    relation: constrained_by
supersedes:
  - AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1
superseded_by: null
owners:
  - mayf3
---

# AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0

> 状态：**proposed，等待独立治理采用复审**。  
> 本轮仅初始化 repository development governance。  
> 不修改产品行为、Runtime、Router、Scheduler、Broker、Auth、部署或生产状态。  
> 本 Spec 不授权任何产品 implementation。

## 1. Goal

将 `mayf3/agent-development-governance` 的精确不可变 revision 作为 vendored development grammar / Spec-governance protocol 引入 `dsh-agent-core`，同时保留 `dsh-agent-core` 对 Product Architecture、Current Decisions、Specs、接受动作和代码的全部本地 authority。

目标链路：

```text
shared governance distribution at exact commit
→ vendored bytes in dsh-agent-core
→ proposed lock
→ repository-local authority map
→ independent adoption review
→ explicit local acceptance
→ accepted snapshot merged into main
→ forward-only use
```

## 2. Scope and non-goals

In scope:

- 精确 commit-pinned 的 vendored governance bytes；
- `.agents/governance.lock.json`；
- repository-local authority precedence、review/acceptance actors 和 persistence locations；
- `AGENTS.md` 薄入口；
- `docs/specs/README.md` 本地导航；
- 从下一项 non-mechanical work 开始 forward-only 使用；
- 显式 update / rollback 过程；
- 接受时完整 supersede `AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1`。

Out of scope:

- 产品行为或产品代码修改；
- 修改 PR #11 或任何现有 implementation PR；
- 批量迁移、重写或重编号历史 Specs / Decisions / Contracts；
- 把 legacy partial-supersession prose 自动转换成新 graph；
- 建中央 Spec registry / database；
- 声称尚不存在的 semantic CI、base-branch gate、required branch protection；
- 自动接受治理、Specs 或 implementation；
- 删除既有本地 compatibility templates。

## 3. Authority and dependency

```text
SOURCE_REPOSITORY = mayf3/agent-development-governance
SOURCE_COMMIT = 46f78c3f00d768d99a4c8c2da975b124bce042f9
DISTRIBUTION = development-governance-v0
DISTRIBUTION_VERSION = 0.1.0-draft.1
MANIFEST_SHA256 = 58b5b28bb801538fe62be0ac98a7bc539ff34ec24fa368c48996dd40d8653ba0
ADOPTION_MODE = vendored
LOCAL_ACCEPTANCE_ACTOR = mayf3 or explicitly authorized maintainer
```

上游 `main` 在精确提交 `46f78c3f00d768d99a4c8c2da975b124bce042f9` 已合并经语义复审的 bootstrap，但尚未创建 stable tag；因此本仓库将本次采用明确标记为：

```text
ADOPTION_CLASS = PILOT_DRAFT_DISTRIBUTION
FLOATING_MAIN = FORBIDDEN
UPSTREAM_STABLE_RELEASE_CLAIM = NO
```

外部 repository 只提供 grammar / protocol bytes。它不能接受、修改或 supersede `dsh-agent-core` 的 Product Architecture、Decisions、Specs 或代码。

## 4. Current State

### STATE-ADOPT-001 — Existing local governance

- Subject: `dsh-agent-core` development-governance surface
- As of commit: `fe2c6393915b1dc61c4c3d25b2996d2f258ba484`
- Environment: GitHub repository `mayf3/dsh-agent-core`, authority branch `main`
- Observed at: `2026-08-19T14:35:16Z`
- Projection:
  - `AGENTS.md` 与 `.agents/README.md` 已存在；
  - 当前规则由 accepted `AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1` 提供；
  - `.agents/governance.lock.json` 不存在；
  - vendored protocol、schemas、Skill modes、integrity verifier 不完整；
  - branch protection / required checks 当前未启用；
  - enforcement 是 manual policy。
- Basis: `OBS-ADOPT-002`, `OBS-ADOPT-003`, GitHub branch metadata and repository files.

### STATE-ADOPT-002 — Proposed adoption snapshot

- Subject: governance adoption branch
- As of base commit: `fe2c6393915b1dc61c4c3d25b2996d2f258ba484`
- Environment: branch `agent/adopt-development-governance-v0`
- Observed at: `2026-08-19T14:35:16Z`
- Projection:
  - distribution files are intended to match the exact manifest byte-for-byte；
  - local `AGENTS.md`, `.agents/local/README.md`, `docs/specs/README.md` are repository-owned；
  - lock status remains `proposed`；
  - no acceptance metadata is populated；
  - no product file is in scope。
- Basis: `OBS-ADOPT-001`, `OBS-ADOPT-004`.

## 5. Observations

### OBS-ADOPT-001 — Exact upstream identity

- Subject: governance source
- Source revision: `46f78c3f00d768d99a4c8c2da975b124bce042f9`
- Environment: GitHub immutable commit and contents API
- Observed at: `2026-08-19T14:35:16Z`
- Method: inspect upstream `main`, exact commit metadata, `VERSION`, and `distribution/manifest.json`
- Result:
  - merge commit = `46f78c3f00d768d99a4c8c2da975b124bce042f9`;
  - distribution version = `0.1.0-draft.1`;
  - bootstrap semantic review = accepted;
  - stable tag = not created;
  - manifest lists 17 distributed files.
- Provenance:
  - upstream branch metadata;
  - `VERSION`;
  - `distribution/manifest.json`.

### OBS-ADOPT-002 — Existing consumer bootstrap is local-only

- Subject: current `dsh-agent-core` governance files
- Source revision: `fe2c6393915b1dc61c4c3d25b2996d2f258ba484`
- Environment: `main`
- Observed at: `2026-08-19T14:35:16Z`
- Method: inspect recursive repository tree and active bootstrap files
- Result:
  - local `AGENTS.md`, `.agents/README.md`, and two helper templates exist;
  - no governance lock, vendored protocol, schemas, mode files, or integrity verifier;
  - `docs/specs/README.md` is absent.
- Provenance: repository tree and file reads at `fe2c6393915b1dc61c4c3d25b2996d2f258ba484`.

### OBS-ADOPT-003 — Actual enforcement maturity

- Subject: repository governance enforcement
- Source revision: `fe2c6393915b1dc61c4c3d25b2996d2f258ba484`
- Environment: GitHub branch settings and repository files
- Observed at: `2026-08-19T14:35:16Z`
- Method: inspect `main` protection metadata and workflows
- Result:

```text
ENFORCEMENT_LEVEL = MANUAL_POLICY
BRANCH_PROTECTION = NOT_ENABLED
REQUIRED_STATUS_CHECKS = NONE
SEMANTIC_SPEC_VERIFIER = NOT_IMPLEMENTED
BASE_BRANCH_GATE = NOT_IMPLEMENTED
```

- Provenance: GitHub `main` branch protection metadata and repository tree.

### OBS-ADOPT-004 — Proposed lock identity

- Subject: `.agents/governance.lock.json`
- Source revision: `46f78c3f00d768d99a4c8c2da975b124bce042f9`
- Consumer base: `fe2c6393915b1dc61c4c3d25b2996d2f258ba484`
- Observed at: `2026-08-19T14:35:16Z`
- Method: construct the lock from the exact upstream manifest using the upstream vendor lock schema
- Result:
  - `source_commit` is exact 40-hex;
  - manifest SHA-256 = `58b5b28bb801538fe62be0ac98a7bc539ff34ec24fa368c48996dd40d8653ba0`;
  - 17 locked file entries equal the manifest path/size/SHA-256 entries;
  - adoption state = `proposed`;
  - `accepted_by = null`, `accepted_at = null`.
- Provenance: proposed lock and upstream manifest.

## 6. Claims and Evidence

### CLM-ADOPT-001 — Exact vendoring prevents silent upstream drift

- Support state: SUPPORTED
- Supported by evidence: `EVD-ADOPT-001`
- Uncertainty: semantic correctness still requires independent local review.

### CLM-ADOPT-002 — Forward-only adoption is compatible with current repository state

- Support state: INFERRED
- Supported by evidence: `EVD-ADOPT-002`
- Uncertainty: legacy artifacts contain prose-level partial supersession; they are preserved as history and must be reconciled only when next touched.

### EVD-ADOPT-001 — Source and lock identity

- Source observations: `OBS-ADOPT-001`, `OBS-ADOPT-004`
- Target: `CLM-ADOPT-001`
- Relation: SUPPORTS
- Bound coordinates: source `46f78c3f00d768d99a4c8c2da975b124bce042f9`, consumer base `fe2c6393915b1dc61c4c3d25b2996d2f258ba484`, observed `2026-08-19T14:35:16Z`
- Strength/sufficiency: sufficient for exact source/manifest/lock identity
- Limitations: does not itself accept the governance or prove local semantic fit
- Provenance: upstream commit, manifest, proposed lock, final vendored integrity verification.

### EVD-ADOPT-002 — Local inventory and forward-only boundary

- Source observations: `OBS-ADOPT-002`, `OBS-ADOPT-003`
- Target: `CLM-ADOPT-002`, `STATE-ADOPT-001`
- Relation: SUPPORTS
- Bound coordinates: consumer `fe2c6393915b1dc61c4c3d25b2996d2f258ba484`, observed `2026-08-19T14:35:16Z`
- Strength/sufficiency: sufficient to bound current local governance and actual enforcement
- Limitations: future repository changes require a new evaluation
- Provenance: repository files and branch settings.

## 7. Decisions

### DEC-ADOPT-001 — Adopt an exact pilot revision

- Decision owner: `mayf3`
- Decision: prepare and review the exact source commit `46f78c3f00d768d99a4c8c2da975b124bce042f9` as a vendored pilot adoption.
- Rejected alternatives:
  - floating `main` / `latest`;
  - Git submodule requiring initialization;
  - runtime fetch;
  - manually copying a subset without a lock.
- Reason: exact local bytes, ordinary Git review, explicit update diffs, and no silent upstream mutation.
- Owner input remaining: NONE.

### DEC-ADOPT-002 — Preserve local product authority

- Decision owner: `mayf3`
- Decision: Product Architecture, standalone Current Decisions, accepted local Specs, and local acceptance actors remain authoritative for `dsh-agent-core`.
- Rejected alternative: upstream governance repository remotely becoming product authority.
- Reason: cross-repository authority boundary.
- Owner input remaining: NONE.

### DEC-ADOPT-003 — Replace the old local governance authority atomically

- Decision owner: `mayf3`
- Decision: on acceptance, `AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0` fully supersedes `AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1`.
- Reason: both artifacts own the same repository development-governance question; parallel accepted authorities would conflict.
- Transition:

```text
new adoption Spec: proposed -> accepted
old governance Spec: accepted -> superseded
old.superseded_by = AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0
new.supersedes = [AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1]
lock.adoption.status: proposed -> accepted
lock.accepted_by / accepted_at = authorized finalization metadata
docs/specs/README.md = transition reflected
```

- Owner input remaining: NONE.

### DEC-ADOPT-004 — Forward-only transition

- Decision owner: `mayf3`
- Decision: no bulk history rewrite. Existing artifacts are reconciled only when governing, cited by new work, or conflicting.
- Legacy partial supersession: historical record only; new partial supersession is forbidden.
- Owner input remaining: NONE.

## 8. Contracts

### CTR-ADOPT-001 — Exact revision

The repository MUST vendor the distribution from `46f78c3f00d768d99a4c8c2da975b124bce042f9` and MUST record that commit in `.agents/governance.lock.json`. Floating references MUST NOT activate governance.

### CTR-ADOPT-002 — Manifest-bound bytes

Every path declared by the upstream manifest MUST match its recorded size and SHA-256. Governance updates MUST replace the lock and vendored bytes together.

### CTR-ADOPT-003 — Truthful proposed state

The authoring snapshot MUST remain:

```text
adoption.status = proposed
accepted_by = null
accepted_at = null
```

Preparation MUST NOT fabricate acceptance.

### CTR-ADOPT-004 — Complete local authority map

`.agents/local/README.md` MUST identify authority precedence, acceptance actors, mechanical/emergency actors, persistence locations, legacy transition, and actual enforcement maturity.

### CTR-ADOPT-005 — Whole-authority supersession

Acceptance MUST atomically supersede `AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1`; the old and new governance authorities MUST NOT remain parallel accepted Current Authorities.

### CTR-ADOPT-006 — Forward-only operation

Historical documents MUST NOT be bulk rewritten. New non-mechanical work MUST use the adopted grammar after activation; legacy conflicts are reconciled when touched.

### CTR-ADOPT-007 — Honest enforcement

The repository MUST NOT claim semantic CI, a deterministic base-branch gate, required branch protection, or automatic acceptance until those mechanisms are actually implemented and active.

### CTR-ADOPT-008 — No product implementation authority

This adoption Spec and PR MUST NOT authorize or include product behavior changes.

## 9. Acceptance

### ACC-ADOPT-001 — Source and lock identity

- Contracts: `CTR-ADOPT-001`, `CTR-ADOPT-002`
- Method: compare upstream commit, manifest digest, lock entries, and vendored file bytes
- Required evidence: manifest, lock, final diff, `verify_governance.py` result
- Expected result: all 17 distributed files match; no floating source
- Failure: any digest/path/size/commit mismatch

### ACC-ADOPT-002 — Proposed/accepted separation

- Contracts: `CTR-ADOPT-003`
- Method: inspect authoring lock and final acceptance transition
- Expected result: authoring metadata remains proposed/null; acceptance fields appear only after authorized action
- Failure: preparation claims acceptance

### ACC-ADOPT-003 — Local authority completeness

- Contracts: `CTR-ADOPT-004`, `CTR-ADOPT-007`
- Method: review `.agents/local/README.md` against current repository authorities and GitHub settings
- Expected result: authority and actual enforcement are explicit
- Failure: missing actor/location or inflated enforcement claim

### ACC-ADOPT-004 — Atomic local supersession

- Contracts: `CTR-ADOPT-005`
- Method: inspect final accepted head
- Expected result: new Spec accepted, old Spec superseded with backlink, accepted lock finalized, index synchronized
- Failure: two parallel accepted governance authorities or incomplete backlinks

### ACC-ADOPT-005 — Forward-only and product isolation

- Contracts: `CTR-ADOPT-006`, `CTR-ADOPT-008`
- Method: inspect changed-file set
- Expected result: only governance/adoption files; no product implementation or bulk history rewrite
- Failure: product behavior, Runtime, deployment, production-state, or unrelated historical rewrite

### Contract coverage

| Contract | Acceptance | Covered |
|---|---|---|
| `CTR-ADOPT-001` | `ACC-ADOPT-001` | YES |
| `CTR-ADOPT-002` | `ACC-ADOPT-001` | YES |
| `CTR-ADOPT-003` | `ACC-ADOPT-002` | YES |
| `CTR-ADOPT-004` | `ACC-ADOPT-003` | YES |
| `CTR-ADOPT-005` | `ACC-ADOPT-004` | YES |
| `CTR-ADOPT-006` | `ACC-ADOPT-005` | YES |
| `CTR-ADOPT-007` | `ACC-ADOPT-003` | YES |
| `CTR-ADOPT-008` | `ACC-ADOPT-005` | YES |

## 10. Alternatives and disposition

### Floating upstream branch

- Disposition: REJECTED
- Reason: later upstream commits could silently change local rules.
- Reopen condition: NONE in V0.

### Git submodule

- Disposition: REJECTED
- Reason: Agents may not initialize it; accepted governance may be absent from implementation bases.
- Reopen condition: reliable repository-wide submodule bootstrap evidence.

### Keep only the old local `.agents/README.md`

- Disposition: REJECTED
- Reason: no exact upstream identity, lock, schemas, mode files, verifier, or explicit update protocol.
- Reopen condition: a new accepted local governance authority proves equivalent guarantees.

### Bulk-normalize all historical Specs

- Disposition: REJECTED
- Reason: large semantic risk and no need for forward-only activation.
- Reopen condition: bounded migration Spec with evidence and independent review.

## 11. Migration, compatibility, rollback

```text
MIGRATION = forward-only
HISTORICAL_REWRITE = none
LEGACY_LOCAL_HELPERS = preserved as non-authoritative compatibility files
ROLLBACK = revert the complete adoption/update commit
UPSTREAM_UPDATE = separate docs-only reviewed adoption update
```

No upstream movement changes this repository until a new local update is accepted and merged.

## 12. Review and acceptance sequence

```text
1. author proposed vendored snapshot + local authority + this Spec
2. verify exact file/lock integrity
3. independent reviewer reviews exact candidate head
4. authorized maintainer finalizes:
   - adoption Spec accepted
   - old governance Spec superseded + backlink
   - lock accepted metadata
   - index synchronized
5. independent final-head recheck
6. merge accepted head into main
```

Any semantic delta after review invalidates the review.

## 13. Open questions and Final Output

```text
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE_AFTER_ATOMIC_ACCEPTANCE
PARTIAL_SUPERSESSION = NONE
READY_TO_MARK_ACCEPTED = NO
READY_FOR_INDEPENDENT_ADOPTION_REVIEW = YES

SPEC_ID = AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0
SPEC_STATUS = proposed
IMPLEMENTATION_AUTHORITY = none
SOURCE_COMMIT = 46f78c3f00d768d99a4c8c2da975b124bce042f9
DISTRIBUTION_VERSION = 0.1.0-draft.1
ADOPTION_STATUS = proposed
PRODUCT_CODE_CHANGE = NONE
RUNTIME_CHANGE = NONE
DEPLOYMENT_CHANGE = NONE
PRODUCTION_STATE_CHANGE = NONE
```
