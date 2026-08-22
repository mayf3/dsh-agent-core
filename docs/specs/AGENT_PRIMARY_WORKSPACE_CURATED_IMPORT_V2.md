---
spec_id: AGENT_PRIMARY_WORKSPACE_CURATED_IMPORT_V2
status: proposed
date: 2026-08-22
spec_kind: implementation
authority_level: governing_spec
implementation_authority: none
replaces_on_acceptance: AGENT_PRIMARY_WORKSPACE_IMPORT_V1
scope:
  - whole-authority replacement of Agent primary Workspace import policy
  - one-time curated Workspace import for the exact 86-Agent Trusted Fleet Cutover
  - Build in Public first-canary ordering and import safety boundary
governed_by:
  - AGENT_WORKSPACE_SESSION_MODEL_V2
  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0
external_authorities: []
supersedes: []
superseded_by: null
owners:
  - mayf3
references:
  - docs/specs/AGENT_PRIMARY_WORKSPACE_IMPORT_V1.md (accepted Current Authority while this Spec is proposed)
  - docs/decisions/AGENT_WORKSPACE_SESSION_MODEL_V2.md (accepted)
  - PR #47 AGENT_TRUSTED_FLEET_CUTOVER_V1 at b0feb030f315cf8565974b8ce0c9064b679d3b15 (proposed child planning input; not authority)
---

# AGENT_PRIMARY_WORKSPACE_CURATED_IMPORT_V2 — Trusted Fleet 一次性 curated Workspace import（whole-authority replacement）

> **PROPOSED / DOCS-ONLY / NO IMPLEMENTATION OR PRODUCTION AUTHORITY.**
>
> 本 Spec 是 `AGENT_PRIMARY_WORKSPACE_IMPORT_V1` 的完整、自包含、whole-authority
> replacement 候选。它在 proposed 阶段不覆盖 V1。只有独立审计通过、authorized
> maintainer 执行 §3.2 的原子 acceptance transaction、且 accepted 版本进入 `main`
> 后，V2 才成为 Current Authority。
>
> 本轮只新增本 Spec：不修改 V1、不实现、不读取或写入 production data、不 copy
> Workspace、不 provision home、不 reload/restart Runtime、不修改 Agent Definition、
> 不 accepted、不 merge。

## 0. Authoring result

```text
TASK_NAME = 空间 执行
SPEC_GOVERNANCE_MODE = AUTHOR
SPEC_ID = AGENT_PRIMARY_WORKSPACE_CURATED_IMPORT_V2
STATUS = proposed
IMPLEMENTATION_AUTHORITY = none
WHOLE_AUTHORITY_REPLACEMENT = YES
REPLACES_ON_ACCEPTANCE = AGENT_PRIMARY_WORKSPACE_IMPORT_V1
PARTIAL_SUPERSESSION = NONE
IMPLEMENTATION_ALLOWED = NO
PRODUCTION_APPLY_ALLOWED = NO
READY_FOR_INDEPENDENT_REVIEW = YES
```

## 1. Goal

解除 PR #47 的 workspace authority blocker，同时把授权限制在唯一的 Trusted Fleet
Cutover：将 **exactly 86** 个经批准的历史 Agent 的 Workspace 中通过 allowlist 与安全
检查的 curated 普通文件，导入 Trusted Runtime 为这些 Agent 新建或既有的 trusted
primary Workspace。

本 Spec 完整替换 V1 的 import authority：

```text
V1: existing historical directory -> adopt in place -> zero copy
V2: trusted primary Workspace remains under Trusted Runtime
    + one approved 86-Agent cutover may copy curated safe files only
    + external/legacy directory never becomes active primary Workspace
```

V1 的 one-Agent/one-primary-Workspace、Workspace-local Memory、session cwd 冻结与
fail-loud 原则继续有效；V1 的 legacy-directory adopt-in-place、explicit external
primary path、zero-copy cutover、legacy directory becomes sole active Workspace 等语义
不再是 Current Authority（仅在 V2 被合法 accepted 后）。

## 2. Scope and non-goals

### 2.1 In scope

- 唯一 subject：PR #47 `AGENT_TRUSTED_FLEET_CUTOVER_V1` 所定义并在其未来 accepted
  revision 中显式冻结的 `OLD_ONLY` **86-Agent set**；
- preserve 每个 subject 的 exact `agent_id`；
- trusted home 只走 Trusted Runtime 正式 provisioner；
- historical Workspace 到 trusted primary Workspace 的 manifest-bound curated import；
- secret/token/credential 与 unsafe filesystem object/content 的强制拒绝；
- `agt_build-in-public-agent` first canary；
- dry-run、no-clobber、fail-loud、resumable evidence contracts，由下游 accepted child
  Spec 细化实现，但不得弱化本 Spec。

### 2.2 Non-goals / forbidden

```text
GENERAL_MIGRATION_API                 = FORBIDDEN
ARBITRARY_AGENT_IMPORT                = FORBIDDEN
87TH_OR_LATER_AGENT                   = FORBIDDEN
ADOPT_LEGACY_WORKSPACE_IN_PLACE       = FORBIDDEN
EXTERNAL_PRIMARY_WORKSPACE_PATH       = FORBIDDEN
OLD_HOME_COPY                         = FORBIDDEN
WHOLE_WORKSPACE_COPY                  = FORBIDDEN
BLIND_RECURSIVE_COPY                  = FORBIDDEN
SECRET_TOKEN_CREDENTIAL_COPY          = FORBIDDEN
SYMLINK_OR_HARDLINK_COPY              = FORBIDDEN
UNSAFE_CONTENT_COPY                   = FORBIDDEN
BINDING_RESTORE                       = OUT_OF_SCOPE
AUTH_OR_GRANT_MUTATION                = OUT_OF_SCOPE
RUNTIME_ENABLE_RELOAD_RESTART         = OUT_OF_SCOPE_THIS_ROUND
PRODUCTION_APPLY                      = FORBIDDEN_THIS_ROUND
```

本 Spec 不为其他 fleet、单 Agent convenience import、backup restore、home migration、
OpenClaw compatibility、Workspace Registry、one-Agent/multiple-Workspace、conversation
Workspace 或通用文件搬运提供先例或 API authority。

## 3. Authority and dependencies

### 3.1 Authority map

```text
Repository governance = AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0 (accepted)
Workspace product model = AGENT_WORKSPACE_SESSION_MODEL_V2 (accepted)
Current import authority = AGENT_PRIMARY_WORKSPACE_IMPORT_V1 (accepted)
Replacement candidate = AGENT_PRIMARY_WORKSPACE_CURATED_IMPORT_V2 (this Spec, proposed)
Downstream child = AGENT_TRUSTED_FLEET_CUTOVER_V1 (PR #47, proposed/FIX_REQUIRED)
```

PR #47 是 planning input，不是本 Spec 的上级 authority。它不能自行覆盖 V1。本 Spec
只解决 workspace authority conflict；PR #47 已记录的 external Auth authority blocker
不由本 Spec解决。

### 3.2 Atomic whole-authority acceptance transaction

独立“空间 审计”给出 `SPEC_REVIEW=ACCEPT` 后，authorized maintainer 必须在同一份
**docs-only** acceptance change 中原子完成：

```text
AGENT_PRIMARY_WORKSPACE_CURATED_IMPORT_V2.status: proposed -> accepted
AGENT_PRIMARY_WORKSPACE_CURATED_IMPORT_V2.supersedes:
  [] -> [AGENT_PRIMARY_WORKSPACE_IMPORT_V1]
AGENT_PRIMARY_WORKSPACE_IMPORT_V1.status: accepted -> superseded
AGENT_PRIMARY_WORKSPACE_IMPORT_V1.superseded_by:
  null/absent -> AGENT_PRIMARY_WORKSPACE_CURATED_IMPORT_V2
mutual whole-Spec backlinks = present
docs/specs/README.md = synchronized
```

不得出现两个并行 accepted Workspace import authorities。本 authoring PR 不执行该
transaction，也不修改 V1 的任何字节。

### 3.3 Downstream implementation gate

本 Spec 即使 accepted，`implementation_authority` 仍为 `none`。实际 import 只可由
另一个 accepted、`implementation_authority: contracts` 的 bounded child Spec 授权。
PR #47 或其 successor 必须先：

1. 基于本 Spec accepted revision 更新并通过独立 review；
2. 在 accepted 文本或其 acceptance-bound immutable artifact 中列出 exact 86
   `agent_id`，并证明 count = 86；禁止仅依赖 mutable path 或运行时差集扩 scope；
3. 保持 Build in Public first canary 与本 Spec 全部 security Contracts；
4. 分别解决其 external Auth authority blocker；
5. 明确 production approval/runbook gate。

缺一项，`IMPLEMENTATION_ALLOWED=NO`。

## 4. Current State

- `STATE-WS-001` — 在 `main@e0c73a6cce9f13c23085b8a51aaf9581888449ae`，
  `AGENT_PRIMARY_WORKSPACE_IMPORT_V1` 是 accepted Workspace import authority，要求
  adopt-in-place / zero-copy，并禁止 fleet Workspace copying。Basis: `OBS-WS-001`,
  `CLM-WS-001`, `EVD-WS-001`。
- `STATE-WS-002` — PR #47 head
  `b0feb030f315cf8565974b8ce0c9064b679d3b15` 是 Draft/proposed child，记录
  `OLD_ONLY=86`、curated import、Build in Public canary，并因 V1 conflict 标记
  `FIX_REQUIRED`。Basis: `OBS-WS-002`, `CLM-WS-001`, `EVD-WS-002`。
- `STATE-WS-003` — 本 authoring branch 不改变任何 active authority 或 production
  state。Basis: direct Git changed-file boundary and this Spec status.

## 5. Observations

### OBS-WS-001 — V1 freezes adopt-in-place and zero-copy

- Repository/revision: `mayf3/dsh-agent-core@e0c73a6cce9f13c23085b8a51aaf9581888449ae`
- Source: `docs/specs/AGENT_PRIMARY_WORKSPACE_IMPORT_V1.md`
- Method: inspect frontmatter and §§0, 2.4, 6, 9–12
- Result: status accepted; imported historical directory becomes primary Workspace;
  copy/merge/rewrite are forbidden; legacy directory is authoritative.
- Environment: source repository, latest `main` at authoring start
- Observed at: 2026-08-22

### OBS-WS-002 — PR #47 declares the exact conflict and requested bounded shape

- Repository/revision: `mayf3/dsh-agent-core@b0feb030f315cf8565974b8ce0c9064b679d3b15`
- Source: `docs/specs/AGENT_TRUSTED_FLEET_CUTOVER_V1.md` §§1–7, 11
- Method: inspect Draft PR #47 exact head
- Result: proposed child targets 86 `OLD_ONLY` Agents, preserves IDs, forbids legacy home
  and credential copy, defines curated Workspace policy and Build in Public first canary,
  and explicitly blocks on whole-authority replacement of V1.
- Environment: Draft PR branch; not active authority
- Observed at: 2026-08-22

### OBS-WS-003 — Current governance forbids partial supersession

- Repository/revision: `mayf3/dsh-agent-core@e0c73a6cce9f13c23085b8a51aaf9581888449ae`
- Sources: `.agents/local/README.md`, `.agents/protocol/SPEC_FORMAT_V0.md`,
  `.agents/protocol/SPEC_GOVERNANCE_V0.md`
- Method: inspect whole-authority lifecycle and review rules
- Result: accepted long-lived meaning changes require a new standalone replacement and
  atomic forward/backlink transition; proposed authority does not activate.
- Observed at: 2026-08-22

## 6. Claims and assumptions

### CLM-WS-001 — Curated copying cannot be authorized by a child under V1

- Support state: SUPPORTED
- Supported by: `EVD-WS-001`, `EVD-WS-002`
- Contradicted by: none known
- Uncertainty: none for the authority conflict; production inputs remain unverified and
  are intentionally deferred to the bounded child dry-run.

### CLM-WS-002 — A whole-authority replacement can preserve the product model while changing migration mechanics

- Support state: SUPPORTED
- Supported by: `EVD-WS-003`
- Contradicted by: none known
- Uncertainty: implementation details remain child-Spec work; this Spec grants none.

### CLM-WS-003 — Safety requires selection, not copying then cleaning

- Support state: SUPPORTED
- Supported by: `EVD-WS-002`
- Contradicted by: none known
- Uncertainty: exact scanner implementation and media parsing require child review.

Open authority-changing assumptions: **NONE**. The 86 exact identities must be pinned by
an accepted child before implementation; this is a Contract gate, not an assumption that
may be guessed during implementation.

## 7. Evidence relations

### EVD-WS-001 — V1 text supports the current authority projection

- Source: `OBS-WS-001`
- Target: `STATE-WS-001`, `CLM-WS-001`
- Relation: SUPPORTS
- Strength: direct accepted Spec text
- Limitation: does not describe production state

### EVD-WS-002 — PR #47 text supports the blocker and bounded-cutover claims

- Source: `OBS-WS-002`
- Target: `STATE-WS-002`, `CLM-WS-001`, `CLM-WS-003`
- Relation: SUPPORTS
- Strength: exact proposed child head plus direct Owner request
- Limitation: proposed child and Owner-reported counts are not production conformance evidence

### EVD-WS-003 — Governance protocol supports whole-authority replacement

- Source: `OBS-WS-003`
- Target: `CLM-WS-002`
- Relation: SUPPORTS
- Strength: accepted repository governance
- Limitation: semantic review and authorized acceptance remain manual

## 8. Decisions

### DEC-WS-001 — Replace V1 wholly; do not amend or partially override it

- Decision owner: `mayf3`
- Selected direction: new V2 standalone Current Truth with future atomic supersession.
- Rejected: child exception, same-ID semantic rewrite, parallel accepted authorities.
- Reason: curated copy contradicts V1's central adopt-in-place/zero-copy meaning.
- Owner input remaining: NONE.

### DEC-WS-002 — Keep primary Workspace inside Trusted Runtime

- Decision owner: `mayf3`
- Selected direction: trusted primary Workspace is provisioned/owned by Trusted Runtime;
  historical paths are read-only import sources and never become active Workspace paths.
- Rejected: adopt legacy path in place, symlink farm, external path registry.
- Reason: this cutover requires controlled import into Trusted Runtime.
- Owner input remaining: NONE.

### DEC-WS-003 — Authorize only one exact 86-Agent curated import

- Decision owner: `mayf3`
- Selected direction: scope is exactly the accepted child-pinned 86 IDs; no dynamic
  widening and no general migration interface.
- Rejected: arbitrary fleet import, count-only mutable discovery, reusable migration API.
- Reason: Owner authorization is one-time and fleet-bounded.
- Owner input remaining: NONE.

### DEC-WS-004 — Build in Public is the mandatory first canary

- Decision owner: `mayf3`
- Selected direction: `agt_build-in-public-agent` alone must complete prepare/import/
  readiness evidence before any of the remaining 85 may be mutated.
- Rejected: all-at-once, random canary, parallel canaries.
- Reason: explicit Owner ordering.
- Owner input remaining: NONE.

### DEC-WS-005 — Import by positive allowlist and reject unsafe material

- Decision owner: `mayf3`
- Selected direction: only manifest-selected, regular, non-linked, bounded, scanned safe
  content may cross; old home and secret-like material never cross.
- Rejected: whole-tree copy then delete, denylist-only copy, follow links, overwrite/merge.
- Reason: prevent credentials, runtime state, unsafe objects, and unreviewed bytes entering
  Trusted Runtime.
- Owner input remaining: NONE.

## 9. Contracts

### CTR-WS-001 — Exact subject identity and fleet bound

The only eligible subjects are the exact 86 `agent_id` values pinned by the accepted
Trusted Fleet Cutover child and its acceptance-bound immutable artifact. Every imported
Workspace must preserve the exact `agent_id`. Count other than 86, duplicate/missing ID,
source drift, or a 87th target fails before mutation. No implementation may derive a wider
set from a mutable runtime source.

### CTR-WS-002 — Trusted primary Workspace authority

Each target's active primary Workspace must be a Trusted Runtime Workspace provisioned by
formal trusted seams. A historical/old path is source-only, read-only during planning and
copy, and must never be registered, mounted, symlinked, or adopted as active primary.
One Agent still has exactly one primary Workspace; Memory remains Workspace-local; session
cwd freeze/resume mismatch remains fail-loud.

### CTR-WS-003 — Old home MUST NOT COPY

No file, directory, metadata, settings, profile, session state, cache, runtime state, or
opaque byte from any old/legacy Agent home may be copied. Trusted homes are regenerated
only by the formal Trusted Runtime provisioner. Workspace source and old home are distinct
trust domains; an implementation must prove the source is the approved Workspace source,
not infer that any home subtree is eligible.

### CTR-WS-004 — Curated Workspace allowlist only

A dry-run must create a canonical per-Agent manifest before copy. Only explicitly selected
regular files under a positive policy may appear. The maximum policy surface is:

```text
root files: AGENTS.md, SOUL.md, IDENTITY.md, USER.md, MEMORY.md
subtrees: memory/, docs/, materials/, files/
extensions: .md .txt .csv .json .yaml .yml .pdf .png .jpg .jpeg .webp
```

A child may narrow this list but must not widen it without a new whole-authority Spec.
Directory recursion or a command equivalent to copying the Workspace root is forbidden.
Every copied byte must correspond to one reviewed manifest entry.

### CTR-WS-005 — Secret/token/credential MUST NOT COPY

Credential, secret, token, cookie, auth/session artifact, private key, `.env*`, runtime
control metadata, credential-bearing config, or content classified as secret/sensitive
must never be copied, opened unnecessarily, logged, hashed into reports, or persisted as
evidence. Known denied paths are rejected from metadata before content read. Safety scans
may only return opaque entry IDs and reason codes. Suspected disclosure stops further
copy and emits only an opaque incident reference.

### CTR-WS-006 — Symlink, hardlink, special file, and unsafe content rejection

Source traversal must be fd-relative and non-following. Symlinks, hardlinks
(`st_nlink != 1`), sockets, devices, FIFOs, executables, non-regular files, path escape,
identity races, unknown media, over-limit data, malformed or scanner-rejected content are
ineligible and must not be copied. `lstat`/no-follow open/`fstat` identity must remain
stable. Required-entry rejection blocks that Agent; optional rejected entries remain
excluded and visible only as opaque reason counts.

### CTR-WS-007 — No blind copy, overwrite, or merge

No whole-Workspace copy, recursive blind copy, copy-then-clean, destination overwrite,
content merge, or legacy-to-trusted reconciliation is allowed. Destination writes use
trusted-directory temporary files, restrictive modes, bounded writes, fsync, identity
recheck, and atomic no-clobber publication. Existing byte-equivalent safe content may be
`SKIP`; non-equivalent destination content is `CONFLICT` and remains unchanged.

### CTR-WS-008 — Build in Public first canary

`agt_build-in-public-agent` is the only first mutation subject. Before any of the other 85
may be prepared or defined, the accepted child must provide PASS evidence for its exact
ID preservation, trusted home regeneration, curated Workspace import, safety exclusions,
trusted Workspace readiness, and spawn preflight. Any failure stops fleet progression.

### CTR-WS-009 — Dry-run, transaction, retry, and unknown outcome

Fleet-wide dry-run validates exact 86 identities, manifests, source identities, destination
conflicts, limits, safety status, and canary ordering before mutation. Apply may consume
only the exact reviewed plan digest. Retry is resumable/no-clobber; completed equivalent
entries are NOOP. Unknown source/destination identity, partial publication, plan drift, or
checkpoint ambiguity stops as `UNKNOWN`/`CONFLICT`; no blind retry or destructive rollback.

### CTR-WS-010 — No general migration surface

Implementation must be a one-time, cutover-bound operator or runbook seam that refuses any
fleet identity outside CTR-WS-001 and becomes unusable/NOOP after success. It must not add
a public API, reusable service method, normal Runtime feature, arbitrary source/target
arguments, or persistent general migration registry.

### CTR-WS-011 — Authority and production gates

This proposed Spec authorizes no implementation or production action. Even after its
acceptance, import requires an accepted implementation-authorizing child, independent
review, exact 86-ID pin, all external authorities, and explicit production run approval.
This authoring PR must change only this Spec file and must stop at Draft PR.

### CTR-WS-012 — Audit minimization

Reports and checkpoints contain only exact Agent IDs where required for authority,
opaque file entry/source IDs, typed reason codes/counts, canonical plan digest, and safe
Definition digests. They must not contain candidate bytes, excerpts, secret-bearing paths,
filenames rejected as sensitive, candidate content hashes, credentials, tokens, or old
home content.

## 10. Acceptance

### ACC-WS-001 — Whole-authority lifecycle

- Contracts: `CTR-WS-011`
- Method: inspect proposed authoring head and future acceptance transaction.
- Expected: authoring changes only this proposed file; acceptance atomically links V2↔V1
  and leaves only V2 accepted/current.
- Failure: V1 edited in authoring PR, parallel accepted authorities, missing backlink, or
  any product/production change.

### ACC-WS-002 — Exact fleet and identity

- Contracts: `CTR-WS-001`, `CTR-WS-010`
- Method: review accepted child plus acceptance-bound immutable 86-ID artifact; test 85,
  86, 87, duplicate, changed, and out-of-set inputs.
- Expected: exact 86 pass planning; every other shape fails before mutation; no general API.
- Failure: count-only mutable expansion, regenerated IDs, or arbitrary subject accepted.

### ACC-WS-003 — Trusted authority and old-home isolation

- Contracts: `CTR-WS-002`, `CTR-WS-003`
- Method: path/source identity tests plus adversarial old-home fixtures.
- Expected: target is formal Trusted Runtime Workspace; old home is never traversed/copied;
  no external primary path or link registration exists.
- Failure: any old-home byte/metadata crosses or legacy path becomes active primary.

### ACC-WS-004 — Curated selection and secret rejection

- Contracts: `CTR-WS-004`, `CTR-WS-005`, `CTR-WS-012`
- Method: positive/negative fixture matrix including allowed docs, `.env`, token/key names,
  embedded secrets, runtime metadata, and disclosure-report inspection.
- Expected: only reviewed allowlisted safe entries copy; denied/suspected material never
  appears in destination or evidence.
- Failure: unmanifested byte, secret-like material, candidate hash/excerpt, or sensitive
  filename/path appears outside scanner memory.

### ACC-WS-005 — Filesystem and content safety

- Contracts: `CTR-WS-006`, `CTR-WS-007`
- Method: adversarial symlink, hardlink, FIFO, socket, device, executable, race, traversal,
  oversized, malformed, unknown-media, destination-conflict, and copy-root tests.
- Expected: every unsafe case rejects/fails closed without overwrite; only bounded regular
  stable safe files publish atomically.
- Failure: following a link, copying special/unsafe content, blind recursion, merge, or
  overwrite.

### ACC-WS-006 — Canary ordering

- Contracts: `CTR-WS-008`
- Method: fault injection at each Build in Public readiness stage and mutation-order trace.
- Expected: no remaining Agent mutation before all canary gates PASS; failure stops fleet.
- Failure: any of remaining 85 mutates first/in parallel or after failed canary.

### ACC-WS-007 — Dry-run and recovery

- Contracts: `CTR-WS-009`
- Method: plan drift, source swap, crash-before/after publish, rerun, unknown checkpoint,
  and destination change tests.
- Expected: reviewed-plan-only apply, NOOP equivalence, fail-loud unknown/conflict, no blind
  retry or destructive rollback.
- Failure: stale plan applies, unknown state advances, or pre-existing content is removed.

### Contract coverage

| Contract | Acceptance |
|---|---|
| CTR-WS-001 | ACC-WS-002 |
| CTR-WS-002 | ACC-WS-003 |
| CTR-WS-003 | ACC-WS-003 |
| CTR-WS-004 | ACC-WS-004 |
| CTR-WS-005 | ACC-WS-004 |
| CTR-WS-006 | ACC-WS-005 |
| CTR-WS-007 | ACC-WS-005 |
| CTR-WS-008 | ACC-WS-006 |
| CTR-WS-009 | ACC-WS-007 |
| CTR-WS-010 | ACC-WS-002 |
| CTR-WS-011 | ACC-WS-001 |
| CTR-WS-012 | ACC-WS-004 |

## 11. Alternatives and disposition

| Alternative | Disposition | Reason |
|---|---|---|
| Keep V1 and let PR #47 add an exception | REJECTED | forbidden partial supersession; direct contradiction |
| Adopt old Workspace in place | REJECTED | fails Trusted Runtime import objective |
| Copy entire Workspace then scrub | REJECTED | secrets/unsafe bytes cross trust boundary before filtering |
| Copy old Agent home | REJECTED | home contains runtime/control/credential state; formal reprovision only |
| Symlink trusted Workspace to old path | REJECTED | external authority and link/race hazards |
| Generic migration API | REJECTED | Owner authorization is one exact fleet cutover only |
| All 86 in parallel | REJECTED | violates Build in Public first-canary gate |
| Keep both V1 and V2 accepted | REJECTED | ambiguous Current Authority |

Previously rejected per-conversation Workspace, one-Agent/multiple-Workspace, Router product
special case, and Kernel change remain closed; no new evidence reopens them.

## 12. Migration, compatibility, and rollback

### 12.1 Authority migration

Before acceptance, V1 remains active and no curated copy is authorized. Acceptance uses
§3.2 only. If review fails, abandon or revise this proposed file; V1 remains untouched.

### 12.2 Runtime compatibility

Default/new Agents continue to use Trusted Runtime-derived primary Workspaces. V2 adds no
normal runtime import behavior. Historical external paths are never runtime authority.
Session cwd R1/R2/R3 and one-Agent/one-primary-Workspace remain unchanged.

### 12.3 Data migration and rollback

Data migration is entirely downstream and not executed here. A future operator must use
forward recovery/no-clobber. Rollback must never delete pre-existing trusted state, restore
old home bytes, reactivate the old Runtime, or re-adopt legacy Workspace paths. If authority
acceptance itself must be reversed, use a new whole-authority superseding Spec; do not
silently flip V1 back to accepted.

## 13. Open questions

```text
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
IMPLEMENTATION_TBD = child Spec only; cannot weaken this authority
EXTERNAL_AUTH_BLOCKER = remains owned by PR #47 / external authority work
```

## 14. Stop condition

```text
DOCS_ONLY = YES
FILES_CHANGED = docs/specs/AGENT_PRIMARY_WORKSPACE_CURATED_IMPORT_V2.md only
IMPLEMENTATION = NONE
PRODUCTION_APPLY = NONE
V1_MUTATION = NONE
ACCEPTANCE = NONE
MERGE = NONE
NEXT_ACTOR = independent “空间 审计”
```
