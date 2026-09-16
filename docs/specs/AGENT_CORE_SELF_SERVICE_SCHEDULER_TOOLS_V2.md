---
spec_id: AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V2
status: superseded
accepted_by: mayf3
accepted_at: 2026-09-03
accepted_reviewed_head: efdd754f0db0b9e7041757ca83246d5695cf83f4
acceptance_review_verdict: PASS
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
scope:
  - broker
  - scheduler
  - production-runtime
  - scheduler-skill
  - scripts/agentcore-cron
  - production-canary
governed_by:
  - AGENT_CORE_PRODUCT_ARCHITECTURE_V1
  - SCHEDULER_OCCURRENCE_OUTCOME_V2
  - SCHEDULER_TIMEOUT_OUTCOME_V2
  - AGENT_CORE_SCHEDULER_RUN_HISTORY_V1
  - AGENT_TRUSTED_FLEET_CUTOVER_V1
external_authorities:
  - repository: mayf3/auth-service
    authority_id: MINIMAL_AUTH_FOUNDATION_V2
    revision: 05fcf4074fe15d7f29ce1ef0f68767fbbebd54de
    relation: constrained_by
supersedes:
  - AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V1
superseded_by: AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V3
amendments:
  - AMENDMENT_3 (2026-09-11, status: accepted, semantic delta NONE, code-structure
    guardrails delta NONE — AMENDMENT_2_STRUCTURE_CLOSURE_RECONCILIATION;
    ACCEPTANCE: Owner exact-head 2026-09-11, accepted_by = mayf3,
    accepted_reviewed_head = a85b22b6128ce61917772306f717b8457d5fdb4c,
    independent_review_result = PASS (exact-head re-review after C0 sync;
    blockers = 0), owner_exact_head_acceptance = YES, SHIP_BLOCKERS = 0,
    implementation continuation ACTIVATED for the frozen structure repair only
    (B5 hard gates), PRODUCTION_APPLY = NO): the
    AMENDMENT_2 exact file closure is mechanically infeasible (frozen member
    extraction lands self-service.js at 639 > 500 (#256 measured; 755 − 147 =
    608 is the deduction floor); the two test files total 990
    lines against 2×500 with harness coupling; the authorized scheduler
    directory registry entries are forbidden by CODE_STRUCTURE_GUARDRAILS_V1
    §6/§7 — post-baseline files/directories cannot be grandfathered, and the
    binding baseline record is LEGACY_DIRECTORY_OVER_20 = scripts/ only).
    AMENDMENT_3 replaces the infeasible closure with the minimum cohesive
    PHYSICAL split proven by a mechanical import/call-site census:
    packages/scheduler/src/self-service/ subdirectory (index/access/schema/
    projections/critical-job-guard, all <= 500, root width -1), history family
    grouped into packages/scheduler/src/history/ (four modules move in;
    src/history.js REWRITTEN IN PLACE as a <=60-line compat barrel so
    scripts/agentcore-cron.mjs (516, post-baseline, ungrandfatherable) and
    product-api/test/scheduler-api.test.js stay UNTOUCHED; src root width
    = 21 - 4 + 2 = 19 <= 20; NO registry exceptions), test/packages/scheduler/test/
    self-service/ subdirectory (self-service.test.js split <= 500 +
    critical-job-guard.test.js renamed-and-absorbing <= 500 + shared harness.js;
    test root 20 <= 20; NO registry exceptions), and a <=60-line compatibility
    barrel at src/self-service.js so compose.js (exactly 500) and
    cross-agent.test.js (522, post-baseline, ungrandfatherable) remain
    UNTOUCHED. ZERO registry changes; every touched file <= 500; no assertion
    deletion; B1/B2 repaired behaviors frozen. See the AMENDMENT_3 section at
    the end of this file (census tables, exact path set, line budgets,
    STRUCTURE_GATE definition). Review record: pending independent semantic
    review.
  - AMENDMENT_2 (2026-09-10, status: accepted, semantic delta NONE —
    AMENDMENT_1_IMPLEMENTATION_CONFORMANCE_AND_STRUCTURE_CLOSURE;
    ACCEPTANCE: Owner exact-head 2026-09-10, accepted_by = mayf3,
    accepted_exact_semantic_head = 6b5a41f721c80a25c8ce0019c263f0c5ad585dd1,
    review_verdict = PASS (independent semantic review + exact-head re-review,
    B7a ten mechanical proofs), SHIP_BLOCKERS = 0,
    implementation authority ACTIVATED for the frozen structure repair only,
    PRODUCTION_APPLY = NO): closes the
    mechanical authority debt created by accepted AMENDMENT_1 against the
    inherited body. (A) CTR-AUTH-001/002 "existence + job.agentId only"
    consumption clauses gain exactly ONE enumerated narrow exception: ordinary
    self disable/remove classification MAY additionally consume the job's
    persisted logicalKey (AMENDMENT_1 guard) — no additional job fields, no
    occurrence/history authority, no disclosure, no new Auth request. (B)
    CTR-AUTH-003 exact implementation closure is re-frozen as
    TOTAL_AUTHORIZED_CHANGED_PATHS = 5 — PRODUCT_AND_TEST_FILES = 4
    (critical-job-guard.js NEW; self-service.js shrunk <= 500;
    critical-job-guard.test.js RENAMED_TO from
    critical-self-disable-guard.test.js; self-service.test.js shrunk <= 500)
    + GOVERNANCE_REGISTRY_FILES = 1 (.agents/structure-registry.json,
    ROLE = GOVERNANCE_ONLY_STRUCTURE_REGISTRATION, PRODUCT_SEMANTIC_AUTHORITY
    = NONE) with the legacy-directory registrations needed for
    verify-code-structure (src approved_max_children = 22;
    test approved_max_children = 21 — TEST_FILE_RENAME = YES). (C) The
    scheduler-cp-disable-forensics.mjs self_service_denied whitelist line is
    recorded under its SEPARATE authority basis
    (SCHEDULER_CONTROL_PLANE_RELIABILITY_V1 read-only forensics tooling) and
    is NOT part of this product implementation closure. PRODUCT_SEMANTIC_DELTA
    = NONE; B1/B2 repaired behaviors (fixed default inventory path,
    unavailable=>fail-closed, locked-current classification) are frozen and
    MUST NOT change. See the AMENDMENT_2 section at the end of this file.
    Review record: pending independent semantic review.
  - AMENDMENT_1 (2026-09-10, status: accepted, semantic delta ADDITIVE-AUTHORIZATION-CONSTRAINT):
    CRITICAL_JOB_SELF_DISABLE_GUARD — a critical Scheduler job (per the frozen desired-state
    critical inventory, matched by stable logicalKey) MUST NOT be disable-able by its ordinary
    owner Agent through the model-facing self-service tool face; such disable attempts
    FAIL_CLOSED with ZERO store mutation. CRITICAL != IMMUTABLE: operator CLI and
    scheduler.manage:any paths keep full disable authority (Owner/operator emergency stop
    preserved). See the AMENDMENT_1 section at the end of this file for the complete frozen
    semantics, the critical-identity contract (read-only consumption of
    scheduler-desired-state.json; NO name/substring/prompt classification; NO new authoritative
    jobs.json fields), the separation from the reliability spec's readiness child-mask, and the
    required failure injections T1–T10. Review record: independent semantic review
    **PASS / BLOCKERS=NONE** (round 1 REVISE→fixed; reviewed head
    caa2328470803b2960990328da2d01995d9f2370); IMPLEMENTATION_BEFORE_ACCEPTANCE = NO.
    ACCEPTANCE (Owner exact-head, 2026-09-10): accepted_by = Owner (mayf3);
    accepted_exact_head = ba4c0a8c340f1fe098c239b64bee132061d5f755;
    SEMANTIC_SHIP_BLOCKERS = 0; targeted_exact_head_recheck = PASS (BLOCKERS=[]);
    frozen: ordinary owner Agent + scheduler.manage:self + critical target (exact persisted
    logicalKey match against scheduler-desired-state.json) + disable OR remove → FAIL_CLOSED
    / ZERO STORE MUTATION; inventory absent ⇒ non-critical unchanged; inventory
    unreadable/invalid/unsupported version ⇒ self-service disable/remove FAIL_CLOSED
    (critical_inventory_unavailable, zero store mutation); CRITICAL != IMMUTABLE (operator CLI
    and authorized scheduler.manage:any/scheduler.admin paths untouched); separation frozen:
    CRITICAL_SELF_DISABLE_GUARD != READINESS_CHILD_MASK != WATCHDOG_AUTO_REPAIR — no watchdog
    auto-enable/repair authority is created by this Amendment; provenance discipline: the
    2026-09-10 recurrence stays UNKNOWN_PENDING_FORENSICS in product authority, a confirmed
    match (DISABLE_OPERATOR_AGENT_ID=agt_hr-agent AND DISABLE_SOURCE=self_service_mutation)
    is recorded ONLY in incident evidence as CURRENT_RECURRENCE_MATCHES_STRUCTURAL_GAP=YES.
    Implementation = separate follow-up PR (authorized post-merge), gated by T1–T10 + T2a/T3a.
owners:
  - mayf3
  - repository-maintainers
---

# AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V2

> Superseded by `AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V3` on 2026-09-13；本文件保留为历史 authority。

> **Accepted whole-Spec successor.** V1 was superseded by V2 through the atomic lifecycle
> transaction. Rejected child-proposal heads `be1d7f2695af62c7fc058dd65102747655c779a6`
> and `8f05a1725d3cb3542738938bbe05288604cd3c08` are review history only and grant no
> authority. V2 independently restates the complete active V1 product authority. Its sole
> product semantic delta is the exact external Scheduler proof mapping and the minimum
> whole-document JobStore load/validation needed to select self versus required external
> authorization;
> authorization may consume only job existence and `job.agentId` from that loaded document.

## 1. Goal

Expose one model-visible Agent Core Scheduler tool named `scheduler`. The tool gives an
Agent a self-scoped control surface for its own Scheduler V2 definitions and occurrence
evidence, while preserving the existing Scheduler engine, JobStore mutation authority,
ownership, audit, occurrence, fence, retry, CLI, and operator-only reconcile semantics.

The tool supports exactly these actions:

```text
create | list | runs | update | enable | disable | remove
```

For a Feishu ingress turn, `delivery_target=current_conversation` is resolved only by the
Parent Runtime from trusted ingress context to the exact persisted destination. The model
never supplies, guesses, or derives the chat identifier.

V2 carries forward the complete accepted V1 product authority, including the original
candidate `4595ed3` provenance, and replaces V1 only through the future atomic transaction in
`CTR-GOV-001`. While proposed, V2 authorizes no implementation. Its exact four-file semantic
delta may be published only after accepted V2 is present in `main`.
The mapping deliberately tightens V1 at one least-privilege edge: `list(all_agents=true)`
remains schema-compatible but unavailable because no accepted global job-definition-read
scope exists. This is normative denial, not a missing implementation or a new scope proposal.

## 2. Scope and non-goals

### In scope

- one Broker LOCAL capability manifest with model-visible `toolName: scheduler`;
- action-discriminated, closed-schema request validation;
- trusted Parent Runtime injection of `callerAgentId` and current Feishu conversation;
- `scheduler.read:self`, `scheduler.manage:self`, and `scheduler.manage:any` enforcement;
- reuse of the existing self-service access layer and Scheduler control operations;
- `create`, `list`, `runs`, `update`, `enable`, `disable`, and `remove`;
- exact create/update result evidence;
- Scheduler-only skill guidance and fail-loud retirement of OpenClaw cron paths;
- post-deployment JobStore/tick hot reload without restarting the active canary Runtime generation;
- one production 15-minute one-shot canary after implementation deployment.

### Non-goals

- changing Scheduler due-time, occurrence, fence, timeout, retry, catch-up, session, or
  delivery execution semantics;
- introducing another Scheduler Runtime, another Feishu WebSocket, or another store;
- exposing `reconcile` to a model or ordinary Agent;
- importing historical OpenClaw jobs;
- allowing a model to provide a caller identity or current chat identifier;
- replacing the operator CLI or granting an Agent shell/store access;
- manually editing any Scheduler store;
- restarting OpenClaw Gateway or using it as an activation mechanism.

## 3. Authority and dependencies

- Accepted V1 blob `b3cebc5d3bd64013d8b605311e2cc12cf52cab7f` is the complete
  product-authority baseline copied into this whole successor. V2 was proposed from exact
  dsh-agent-core base `9e15808f336e7964f5059e871c32f25e6045e622`; future review and
  acceptance MUST bind the final V2 head, not this proposal base or either rejected child head.
- `AGENT_CORE_PRODUCT_ARCHITECTURE_V1` owns the process-external trusted caller
  relationship, Broker/tool boundary, and rule that Agent Core does not recreate the DSH
  tool runtime.
- D-007 `SCHEDULER_OCCURRENCE_OUTCOME_V2` is the current Scheduler authority. Its single
  mutation authority, occurrence evidence, delete semantics, and control operations are
  preserved.
- `SCHEDULER_TIMEOUT_OUTCOME_V2` governs the implemented Scheduler V2 state machine and
  migration/no-catch-up behavior.
- `AGENT_TRUSTED_FLEET_CUTOVER_V1` freezes one active `authsvc` production Runtime and
  forbids a second Runtime writer.
- Accepted `AGENT_CORE_SCHEDULER_RUN_HISTORY_V1` at acceptance commit
  `a2919174338dc19ff16d9554d2f00c025d482410`, current exact blob
  `1f719514dc79a515a49aa592a0bd66961fcaed8a`, freezes in Contract R8 the external Scheduler
  token-scope family `scheduler.read` / `scheduler.audit` / `scheduler.admin`, with
  `scheduler.admin` governing job-definition mutation. R8 also confirms that
  `scheduler.read:self`, `scheduler.manage:self`, and `scheduler.manage:any` are local trusted
  authorization labels, not token scopes. V2 preserves those local predicates. Cross-Agent
  job-definition mutation/control and explicit destination access prove local
  `scheduler.manage:any` only through exact tuple
  `(resource='scheduler', scope='scheduler.admin')`; global or foreign execution-history access
  is separate and requires exact `(resource='scheduler', scope='scheduler.audit')`. Neither
  scope implies the other. No accepted authority defines a global job-definition-read scope;
  therefore `list(all_agents=true)` remains unavailable and fail-closed rather than borrowing
  admin, audit, or a local predicate.
- External `MINIMAL_AUTH_FOUNDATION_V2` at exact auth-service head
  `05fcf4074fe15d7f29ce1ef0f68767fbbebd54de` constrains audience-scoped Machine Grants and
  enforces exact scope grammar `^[a-z][a-z0-9-]*\.[a-z][a-z0-9._-]*$`. That grammar admits the
  accepted R8 wire literals but creates no Scheduler semantic authority. The two `*:self`
  labels remain local-only and cause zero Auth requests. The proof path MUST NOT request wire
  `scheduler.manage:any` or `scheduler.manage-any`, normalize an alias, try multiple spellings,
  or fall back after failure. Exact external success establishes only its named local result;
  it propagates no token, credential, Grant, caller authority, or source-Agent identity.
  Until a separately accepted auth-service CCR registers the audience/scope, its source is
  implemented/deployed, and separately authorized Grants are supplied/applied, production
  `manage:any` and audit availability are **NONE**. This Spec creates no Auth scope, audience,
  Grant, credential, token, registry/database mutation, deployment, or production Auth mutation.
- V2 is a whole-Spec successor to accepted V1, not a child amendment. While proposed, V1 is
  the sole current authority and remains byte-unchanged. After explicit Owner `mayf3`
  authority, an authorized actor may prepare one lifecycle-only docs commit that atomically
  sets V2 to `accepted` with `implementation_authority: contracts` and acceptance provenance,
  sets V1 to `superseded` with `superseded_by: AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V2`,
  and preserves `production_apply_authority: none`. Before merge, an independent reviewer
  MUST review that newly prepared exact commit head and return `FINAL_HEAD_RECHECK=PASS`,
  proving the exact lifecycle delta, normative-byte invariants, `SEMANTIC_DELTA=NONE`, and no
  base/main authority drift. Only then may the commit merge. No partial/mixed lifecycle or
  pre-recheck merge is valid.
- Authority is acyclic: accepted V1 -> accepted V2 final head -> future auth-service Scheduler
  Audience CCR -> separately authorized auth source/deploy -> separately authorized Grant ->
  separately authorized local activation/canary. The future auth CCR may depend on accepted
  V2; V2 is constrained by current external grammar but does not depend on that future CCR.

## 4. Current State

### STATE-001 — Baseline main lacked the unified model-visible tool
- Subject: dsh-agent-core Scheduler/Broker/Runtime/CLI baseline.
- As of commit or artifact revision: `e40c1400266b57ae7746ac766e6b281cf1fbb943`.
- Environment: fresh fetched `origin/main` source snapshot.
- Observed at: 2026-08-27.
- State assertion: Scheduler V2, JobStore operations, Broker relay, production Runtime, and CLI existed, but no model-visible unified `scheduler` tool existed.
- Basis: `OBS-001`, `OBS-002`.

### STATE-002 — Candidate baseline exposed six tool manifests
- Subject: candidate `4595ed3b2063206922f1a3cdda048abe4fa871ab`.
- As of commit or artifact revision: `4595ed3b2063206922f1a3cdda048abe4fa871ab`.
- Environment: local candidate worktree.
- Observed at: 2026-08-27.
- State assertion: six operation-specific Scheduler manifests and a co-located proposed Spec existed; unified action dispatch and update were absent.
- Basis: `OBS-003`, `OBS-004`.

### STATE-003 — Pinned skill requires unified Scheduler access
- Subject: user `cron-helper` skill v4.0.0.
- As of commit or artifact revision: SHA-256 `caec00409d0804985cfa06b9047db1ab8b3382f937de6dce32633f0dce12ec8b`, 6613 bytes.
- Environment: `/Users/yanfenma/.agents/skills/cron-helper/SKILL.md`.
- Observed at: 2026-08-27.
- State assertion: the skill requires only unified `scheduler(action=...)` and fails loud when unavailable.
- Basis: `OBS-005`.

### STATE-004 — Router baseline had exact ingress identity but incomplete propagation
- Subject: Router ingress and Parent RPC context path.
- As of commit or artifact revision: `e40c1400266b57ae7746ac766e6b281cf1fbb943`.
- Environment: repository source snapshot.
- Observed at: 2026-08-27.
- State assertion: exact Feishu `chatId` and parent turn-scoped context existed, but only binding ID was propagated.
- Basis: `OBS-006`.

### STATE-005 — Current proof seam conflicts with grammar and accepted Scheduler scope authority
- Subject: Scheduler cross-agent `assertGrant` request versus auth-service scope grammar.
- As of commit or artifact revision: dsh-agent-core `9e15808f336e7964f5059e871c32f25e6045e622`; auth-service `05fcf4074fe15d7f29ce1ef0f68767fbbebd54de`.
- Environment: isolated read-only source worktrees; no runtime/production mutation.
- Observed at: `2026-09-02T21:23:05Z`.
- State assertion: local `scheduler.manage:any` is sent as wire scope and fails the external
  grammar; both `scheduler.manage-any` and R8's `scheduler.admin` satisfy the grammar, but only
  accepted Run History R8 supplies semantic authority and freezes `scheduler.admin` for
  job-definition mutation plus separate `scheduler.audit` for global/foreign history. Neither
  R8 nor another accepted authority defines global job-definition read, so
  `list(all_agents=true)` has no usable external proof and must remain unavailable.
- Basis: `OBS-007`, `OBS-008`, `OBS-010`, `CLM-004`.

## 5. Observations

### OBS-001 — Main contains Scheduler V2 mutation and evidence authority

- Subject: `packages/scheduler` on `mayf3/dsh-agent-core`
- Source revision: `e40c1400266b57ae7746ac766e6b281cf1fbb943`
- Environment: fresh fetched `origin/main`
- Observed at: 2026-08-27
- Method: source inspection of JobStore, control operations, Scheduler and D-007
- Result: create/update/enable/disable/delete use the existing locked mutation authority;
  occurrences and fences share the V2 authority document; deletion retains occurrence
  evidence.
- Provenance: repository source and `docs/decisions/SCHEDULER_OCCURRENCE_OUTCOME_V2.md`

### OBS-002 — Production Runtime already owns the resident Scheduler

- Subject: `packages/production-runtime/src/compose.js`
- Source revision: `e40c1400266b57ae7746ac766e6b281cf1fbb943`
- Environment: repository source
- Observed at: 2026-08-27
- Method: source inspection
- Result: production composition constructs one JobStore and one resident Scheduler over
  the production layout; the Scheduler reloads externally committed mutations on tick.
- Provenance: repository source and production-runtime reports

### OBS-003 — Source candidate exposes six tools

- Subject: `packages/broker/src/capabilities/scheduler.js`
- Source revision: `4595ed3b2063206922f1a3cdda048abe4fa871ab`
- Environment: local candidate worktree
- Observed at: 2026-08-27
- Method: full source read
- Result: six manifests expose six tool names; no unified action discriminator or update
  tool exists.
- Provenance: candidate source

### OBS-004 — Source candidate already has reusable self-service access logic

- Subject: `packages/scheduler/src/self-service.js` and CLI changes
- Source revision: `4595ed3b2063206922f1a3cdda048abe4fa871ab`
- Environment: local candidate worktree
- Observed at: 2026-08-27
- Method: full source read
- Result: candidate reuses existing control operations, applies self/manage-any ownership,
  appends audit evidence, preserves occurrence evidence on delete, and adds CLI update;
  current-conversation resolution and unified model manifest are absent.
- Provenance: candidate source

### OBS-005 — Pinned Scheduler-only skill bytes

- Subject: user skill `cron-helper` v4.0.0
- Source revision: SHA-256
  `caec00409d0804985cfa06b9047db1ab8b3382f937de6dce32633f0dce12ec8b`, 6613 bytes
- Environment: `/Users/yanfenma/.agents/skills/cron-helper/SKILL.md`
- Observed at: 2026-08-27
- Method: load complete content, then `shasum -a 256` and `stat`
- Result: the pinned bytes permit only `scheduler(action=...)`, forbid OpenClaw cron,
  Gateway restart, and manual jobs JSON access, and require exact create evidence.
- Provenance: local immutable content digest recorded above; review must re-hash before use

### OBS-006 — Router has turn-scoped parent state and exact ingress fields

- Subject: Router ingress and parent-RPC path
- Source revision: `e40c1400266b57ae7746ac766e6b281cf1fbb943`
- Environment: repository source
- Observed at: 2026-08-27
- Method: inspect `ingress-delivery.js`, `turn-execution.js`, `parent-rpc-relay.js`, and
  Feishu connector bridge
- Result: Feishu ingress carries exact `chatId`, `conversationId`, and message identity;
  `AgentProcess.activeBindingContext` is set only while one routed turn executes and cleared
  in `finally`; parent RPC already binds the actual Agent process. Current code passes only a
  binding ID, so exact trusted delivery context is an additive implementation requirement.
- Provenance: repository source at the pinned revision

### OBS-007 — Current Scheduler reuses the local predicate as wire scope

- Subject: `packages/scheduler/src/self-service.js` cross-agent proof path
- Source revision: blob `4a236fed3b201ac8c4de59d86cbbc414beee4ba7` at dsh-agent-core `9e15808f336e7964f5059e871c32f25e6045e622`
- Environment: isolated dsh-agent-core source worktree
- Observed at: `2026-09-02T21:23:05Z`
- Method: inspect `MANAGE_ANY_SCOPE`, `SCHEDULER_RESOURCE`, `adminAuthorized`, and `loadScopedJob`
- Result: `assertGrant` receives `(callerAgentId, 'scheduler.manage:any', 'scheduler')`; existing job operations call JobStore whole-document load/validation over `{jobs, occurrences, fences}`, then use job existence and `job.agentId` to decide whether admin proof is required
- Provenance: exact source blob and commit named above

### OBS-008 — Auth-service grammar rejects colon but does not select Scheduler semantics

- Subject: auth-service V1 OAuth scope parser and minimal-auth V1 manifest incorporated by V2 authority
- Source revision: auth-service `05fcf4074fe15d7f29ce1ef0f68767fbbebd54de`; source blob `f97ddf417f367a9e87d1a271d566b1807c12a84d`; manifest blob `983719d905f9609f6662b71ffb303a817ea292db`
- Environment: isolated auth-service read-only source worktree
- Observed at: `2026-09-02T21:23:05Z`
- Method: inspect parser line 3 and manifest `scope_wire_format.item_pattern`; evaluate
  `scheduler.manage:any`, `scheduler.manage-any`, `scheduler.admin`, and `scheduler.audit`
  against `^[a-z][a-z0-9-]*\.[a-z][a-z0-9._-]*$`
- Result: colon-form `scheduler.manage:any` does not match; `scheduler.manage-any`,
  `scheduler.admin`, and `scheduler.audit` all match with namespace/resource `scheduler`, so
  grammar alone cannot choose their domain meaning
- Provenance: `src/lib/oauth/v1/scope.ts` and `contract-bundles/minimal-auth-v1/contract-manifest.json` at the stated revision/blobs

### OBS-009 — Production composition forwards the requested scope

- Subject: production-runtime self-service Scheduler authorization composition
- Source revision: `packages/production-runtime/src/compose.js` blob `c407b064fe846446888109bcc219514a7d15b094` at dsh-agent-core `9e15808f336e7964f5059e871c32f25e6045e622`
- Environment: isolated dsh-agent-core source worktree; no runtime execution
- Observed at: `2026-09-02T21:23:05Z`
- Method: inspect the composed `assertGrant` transport from Scheduler access to auth request
- Result: composition forwards the requested scope and does not hard-code a Scheduler scope
- Provenance: exact composition source blob and commit named above

### OBS-010 — Accepted Run History R8 freezes the external Scheduler scope family

- Subject: accepted `AGENT_CORE_SCHEDULER_RUN_HISTORY_V1` Contract R8
- Source revision: acceptance commit `a2919174338dc19ff16d9554d2f00c025d482410`;
  current exact Spec blob `1f719514dc79a515a49aa592a0bd66961fcaed8a`
- Environment: isolated dsh-agent-core source worktree; no runtime/production mutation
- Observed at: `2026-09-02T22:36:26Z`
- Method: inspect frontmatter scope and R8 permission table plus naming-reconciliation clauses
- Result: R8 freezes external token scopes `scheduler.read`, `scheduler.audit`, and
  `scheduler.admin`; `scheduler.admin` governs job-definition mutation, `scheduler.audit`
  governs global history, and local `scheduler.manage:any` is explicitly not a token scope;
  R8 does not assign any scope to global job-definition read
- Provenance: `docs/specs/AGENT_CORE_SCHEDULER_RUN_HISTORY_V1.md` at the stated acceptance
  commit/blob, frontmatter scope and Contract R8

## 6. Claims and assumptions

### CLM-001 — Candidate code is reusable but not publishable as-is

- Support state: SUPPORTED
- Supported by evidence: `EVD-001`
- Contradicted by evidence: none known
- Uncertainty: implementation must be re-reviewed after rebasing onto accepted `main`

### CLM-002 — Trusted ingress injection is required for current-conversation safety

- Support state: SUPPORTED
- Supported by evidence: `EVD-002`
- Contradicted by evidence: none known
- Uncertainty: exact internal context object shape is an implementation detail, but its
  trust origin and rejection behavior are normative

### CLM-003 — Job definitions hot-reload after implementation activation

- Support state: SUPPORTED
- Supported by evidence: `EVD-003`
- Contradicted by evidence: none known
- Uncertainty: this Claim is only about JobStore mutation reload after a conforming Runtime
  generation is active; it does not claim that Node code or tool registration hot-loads

### CLM-004 — Accepted authority selects mutation/history scopes and leaves global definition read closed

- Support state: SUPPORTED
- Supported by evidence: `EVD-004`
- Contradicted by evidence: none known
- Uncertainty: source evidence is bound to pinned revisions; audience registration, Grants,
  deployment, and runtime authorization remain separately unproved, and no future global
  definition-read scope is inferred or named here

### CLM-005 — Whole-document validation is compatible with narrow authorization consumption

- Support state: SUPPORTED
- Supported by evidence: `EVD-005`
- Contradicted by evidence: none known
- Uncertainty: future tests must prove whole-document validation does not let authorization consume or disclose occurrence/history and that denial causes no mutation or success audit

### CLM-006 — Production composition source needs no proof-scope change

- Support state: SUPPORTED
- Supported by evidence: `EVD-006`
- Contradicted by evidence: none known
- Uncertainty: source inspection covers the pinned base; contradictory implementation evidence requires governance STOP

## 7. Evidence relations

### EVD-001 — Candidate inspection supports bounded reuse

- Source observations: `OBS-003`, `OBS-004`
- Target: `CLM-001`
- Relation: SUPPORTS
- Bound coordinates: candidate `4595ed3`, base `e40c140`
- Strength/sufficiency: strong for code shape and governance split
- Limitations: does not establish accepted authority or production conformance
- Provenance: repository diff and source reads

### EVD-002 — Pinned skill and Router observations support trusted injection

- Source observations: `OBS-005`, `OBS-006`
- Target: `CLM-002`
- Relation: SUPPORTS
- Bound coordinates: repository `e40c140`; skill SHA-256 `caec0040...ec8b`
- Strength/sufficiency: strong for the negative trust boundary and available source fields
- Limitations: implementation and concurrency tests must prove the additive context shape
- Provenance: pinned repository source and pinned skill bytes

### EVD-003 — Existing store reload supports post-create no-restart execution

- Source observations: `OBS-001`, `OBS-002`
- Target: `CLM-003`
- Relation: SUPPORTS
- Bound coordinates: repository `e40c140`
- Strength/sufficiency: strong for JobStore mtime/tick reload; production remains to prove
- Limitations: does not support code/tool hot loading; implementation deployment requires a
  controlled replacement of the production Runtime generation
- Provenance: Scheduler and production composition source

### EVD-004 — Local proof source, grammar, and accepted R8 support exact scope separation

- Source observations: `OBS-007`, `OBS-008`, `OBS-010`
- Target: `CLM-004`
- Relation: SUPPORTS
- Bound coordinates: dsh-agent-core source `9e15808f336e7964f5059e871c32f25e6045e622`;
  accepted Run History commit `a2919174338dc19ff16d9554d2f00c025d482410` / blob
  `1f719514dc79a515a49aa592a0bd66961fcaed8a`; auth-service
  `05fcf4074fe15d7f29ce1ef0f68767fbbebd54de`; observations dated 2026-09-02/03
- Strength/sufficiency: strong and sufficient for the exact local/wire separation, grammar,
  Scheduler semantic mapping, and absence of an accepted global definition-read scope at the
  pinned revisions
- Limitations: does not establish audience registration, Grant, deployment, or production success
- Provenance: exact repository objects in `OBS-007`, `OBS-008`, and `OBS-010`

### EVD-005 — Existing access sequencing supports bounded authorization consumption

- Source observations: `OBS-007`
- Target: `CLM-005`
- Relation: SUPPORTS
- Bound coordinates: dsh-agent-core source blob `4a236fed3b201ac8c4de59d86cbbc414beee4ba7`, observed `2026-09-02T21:23:05Z`
- Strength/sufficiency: strong for showing existing JobStore whole-document load/validation precedes consumption of job existence and `job.agentId` to select the self/admin branch
- Limitations: source inspection does not prove future prohibition on occurrence/history projection/query/filter/return or future non-disclosure/no-success-audit behavior
- Provenance: exact source inspection in `OBS-007`

### EVD-006 — Existing scope forwarding supports test-only composition coverage

- Source observations: `OBS-009`
- Target: `CLM-006`
- Relation: SUPPORTS
- Bound coordinates: dsh-agent-core composition blob `c407b064fe846446888109bcc219514a7d15b094`, observed `2026-09-02T21:23:05Z`
- Strength/sufficiency: strong and sufficient for the pinned composition source shape
- Limitations: does not replace future execution of the composed regression test
- Provenance: exact source inspection in `OBS-009`

## 8. Decisions

### DEC-001 — One model-visible tool

- Decision owner: repository maintainers
- Decision: expose exactly one tool named `scheduler`; select behavior through a required
  `action` enum. Existing internal handlers may remain separate.
- Rejected alternative: expose six or seven operation-specific tool manifests.
- Reason: one stable model surface matches the skill contract and avoids catalog sprawl.

### DEC-002 — Closed schema by action

- Decision owner: repository maintainers
- Decision: the model-facing parameter map advertises only `action` plus documented union
  properties. Because current `defineTool` compiles an implicit-open root, the trusted Broker
  mapping layer authoritatively validates the exact per-action discriminated union with
  `additionalProperties:false` semantics before grant/store access.
- Rejected alternative: one permissive trusted-handler bag of optional fields.
- Reason: action-confused fields, caller identity, and destination spoofing must fail loud.

### DEC-003 — Parent Runtime owns identity and current conversation

- Decision owner: repository maintainers
- Decision: caller Agent and current Feishu conversation are trusted context, not tool
  arguments. `delivery_target=current_conversation` is a symbolic request resolved by the
  Parent Runtime to `{channel:'feishu', to:'chat:<exact chat id>'}`.
- Rejected alternative: model-provided `agentId`, `channel`, `to`, or chat ID.
- Reason: the model is not an identity or ingress authority.

### DEC-004 — Self by default, explicit admin any

- Decision owner: repository maintainers
- Decision: ordinary Agents read/manage only jobs whose `job.agentId` equals trusted
  `callerAgentId`; only an Auth-authorized `scheduler.manage:any` caller may target another
  Agent or another destination.
- Rejected alternative: infer admin from tool arguments or broad local process access.
- Reason: retain least privilege at the Broker boundary.

### DEC-005 — Preserve Scheduler core and operator seams

- Decision owner: repository maintainers
- Decision: all writes reuse the existing JobStore control operations and audit seam;
  reconcile remains operator-only; CLI remains supported.
- Rejected alternative: a second store writer, second Scheduler Runtime, or model reconcile.
- Reason: preserve D-007's single authority and lifecycle semantics.

### DEC-006 — OpenClaw scheduler paths are retired

- Decision owner: repository maintainers
- Decision: model/skill Scheduler operations fail loud unless the unified tool is available.
  OpenClaw cron, OpenClaw cron templates, manual jobs JSON editing, and Gateway restart as
  activation are forbidden.
- Rejected alternative: compatibility fallback to legacy OpenClaw paths.
- Reason: fallback writes the wrong store and can create inert jobs.

### DEC-007 — Governance and production sequence is two-stage

- Decision owner: repository maintainers
- Decision: first merge this docs-only Spec after independent review and maintainer
  acceptance; then publish a separate implementation PR based on accepted `main`; deploy
  only conforming implementation; finally execute the production canary.
- Rejected alternative: use the proposed Spec co-located with candidate code as authority.
- Reason: proposed same-candidate text cannot authorize its own implementation.

### DEC-008 — Separate local authorization name from exact external proof scope

- Decision owner: repository owner `mayf3` / repository maintainers
- Decision: preserve local `scheduler.manage:any`; prove cross-Agent job-definition
  mutation/control and explicit destination access only with `(scheduler, scheduler.admin)`.
  Require separate `(scheduler,
  scheduler.audit)` for global/foreign execution history; neither proof implies the other.
  Preserve both `*:self` labels as local-only. Keep `list(all_agents=true)` schema-compatible
  but unconditionally unavailable until a future separately accepted authority defines its
  exact external proof; admin, audit, and local manage-any MUST NOT authorize it.
- Rejected alternative: rename local policy, request colon or hyphen manage-any wire forms,
  translate/normalize aliases, try multiple spellings, fall back, infer audit from admin, or
  borrow admin/audit for global job-definition read.
- Reason: preserve V1 local semantics while conforming to accepted Run History R8; grammar
  constrains syntax but does not create domain authority.

### DEC-009 — Permit whole-document validation but consume only existence and owner

- Decision owner: repository owner `mayf3` / repository maintainers
- Decision: authorization may call the existing JobStore whole-document load/validation over `{jobs, occurrences, fences}`, but may consume only whether the requested job exists and that job's `job.agentId`. If those fields show that an external proof is required, then before exact proof succeeds the authorization path may not project, query, filter, return, disclose, or use occurrence/history as authorization input. Denial performs no mutation or success audit and returns no persisted content. Authorized self history behavior remains unchanged and makes zero Auth requests.
- Rejected alternative: forbid the existing whole-document validation, consume occurrence/history during authorization, or expose the inspected foreign definition.
- Reason: the current JobStore validates one whole document and ownership is persisted in its job definition; permitting that mechanism does not grant occurrence/history visibility or decision authority.

### DEC-010 — Whole-successor acceptance is atomic

- Decision owner: repository owner `mayf3`
- Decision: keep V1 current and untouched while V2 is proposed. After explicit Owner authority, an authorized actor prepares one atomic lifecycle-only docs commit containing only the exhaustive field/line allowlist in `CTR-GOV-001`; an independent reviewer must return `FINAL_HEAD_RECHECK=PASS` on that new exact head before merge.
- Rejected alternative: child amendment, early V1 mutation, partial supersession, review only of the proposed pre-lifecycle head, or merge before final-head recheck.
- Reason: one complete current authority plus an exhaustive lifecycle/provenance allowlist and post-preparation exact-head verification prevents split authority, stale accepted markers, and behavioral drift.

## 9. Contracts

### CTR-TOOL-001 — Exact model-visible surface

The Broker MUST register exactly one model-visible Scheduler self-service tool named
`scheduler`. It MUST NOT register model-visible tools named `scheduler_create`,
`scheduler_list`, `scheduler_runs`, `scheduler_update`, `scheduler_enable`,
`scheduler_disable`, or `scheduler_remove`. Internal handler names MAY remain unchanged.
`reconcile` MUST NOT be reachable through `scheduler`.

### CTR-TOOL-002 — Action discriminator and exact closed schemas

The manifest MUST declare its model selector name as `action`; the generic Broker MUST keep
`operation` as the default selector for every existing manifest. Registry dispatch MUST
remove `action` from business arguments and map it internally to the selected handler. The
model-facing DSH parameter map MUST expose only the selector plus the union of documented
properties as guidance. Because the current `defineTool` API compiles an implicit open root,
the trusted Broker mapping layer is the authoritative enforcement point: before grant/store
access it MUST enforce the exact object-rooted discriminated union below. Every selected
action object and nested object is closed; unknown properties are violations.

Common leaf definitions are exact:

```text
NonEmptyString = {type:string, minLength:1}
action          = enum(create,list,runs,update,enable,disable,remove)
job_id/name/message/model/target_agent_id = NonEmptyString
schedule_kind   = enum(cron,at,every)
cron_expr       = NonEmptyString (standard five-field expression; six-field rejected)
at               = NonEmptyString parsed by existing parseAtToMs
                       (relative positive duration or ISO instant)
every_ms         = integer minimum 1
timezone          = NonEmptyString accepted by existing Scheduler timezone validation
timeout           = integer minimum 1
light_context/best_effort/delete_after_run/auto_retry/all_agents = boolean
limit             = integer minimum 1 maximum 100
delivery_mode     = enum(announce,none,silent)
delivery_target   = const current_conversation
destination       = object, additionalProperties:false,
                    required:[channel,to], properties:{channel:NonEmptyString,to:NonEmptyString}
```

The seven top-level branches are exact:

```text
create:
  action=const create
  required=[action,name,schedule_kind,message]
  allowed=[action,name,schedule_kind,cron_expr,at,every_ms,timezone,message,
           timeout,light_context,model,delivery_mode,delivery_target,destination,
           best_effort,delete_after_run,auto_retry,target_agent_id]

list:
  action=const list
  required=[action]
  allowed=[action,all_agents]

runs:
  action=const runs
  required=[action]
  allowed=[action,job_id,limit,all_agents]

update:
  action=const update
  required=[action,job_id]
  allowed=[action,job_id,name,schedule_kind,cron_expr,at,every_ms,timezone,message,
           timeout,light_context,model,delivery_mode,delivery_target,destination,
           best_effort,delete_after_run,auto_retry,target_agent_id]
  additional rule: at least one mutable property besides action/job_id is required

enable: action=const enable; required=[action,job_id]; allowed=[action,job_id]
disable: action=const disable; required=[action,job_id]; allowed=[action,job_id]
remove: action=const remove; required=[action,job_id]; allowed=[action,job_id]
```

Conditional closure is exact:

1. `schedule_kind=cron` requires exactly `cron_expr` + `timezone` and forbids `at/every_ms`.
2. `schedule_kind=at` requires exactly `at`, forbids `cron_expr/every_ms/timezone`, and the
   normalized instant MUST be later than the control operation's logical mutation timestamp
   (`nowMs`, persisted as `createdAtMs`/`updatedAtMs` by existing control semantics).
3. `schedule_kind=every` requires exactly `every_ms` and forbids
   `cron_expr/at/timezone`.
4. Create always has `schedule_kind`. Update accepts no schedule leaf unless
   `schedule_kind` is present; when present, rules 1–3 require a complete replacement
   schedule. Update never merges an incomplete schedule.
5. Create defaults `delivery_mode=none`, `auto_retry=false`, and
   `delete_after_run=(schedule_kind==at)`. Update preserves every omitted field.
6. `delivery_mode=announce` requires exactly one of `delivery_target` or `destination`;
   `destination` is admin-only. `delivery_mode=none|silent` forbids
   `delivery_target/destination/best_effort`. Update accepts no delivery leaf unless
   `delivery_mode` is present; when present it replaces the complete delivery object.
7. `target_agent_id` and `destination` invoke the local manage-any path. `all_agents=true`
   follows the action-specific rule in `CTR-AUTH-002`: `list` is unavailable and `runs`
   requires audit. Their presence never asserts authorization.
8. Empty/whitespace-only strings fail `invalid_arguments` after trimming; normalization
   stores trimmed strings. Unknown, cross-action, nested-unknown, identity, chat, session,
   or reconcile fields fail before store read, grant lookup, or mutation.

Forbidden properties include `callerAgentId`, `caller_agent_id`, `agentId`, `agent_id`,
`channel`, `to`, `chatId`, `chat_id`, `ingress`, `session`, `operation`, and `reconcile`.

### CTR-CTX-001 — Trusted caller and invocation context

The Parent Runtime MUST inject a non-empty context derived only from the actual process slot
and active routed turn:

```text
callerAgentId
processGeneration
turnExecutionId
channelNamespace
channelConversationId
feishuChatId
feishuConversationId
feishuMessageId
```

`callerAgentId` and `processGeneration` come from the actual Router-owned process slot.
`turnExecutionId` comes from that slot's active turn execution. The Feishu fields come from
the ingress object passed to that same turn. No child/model parameter can set or override any
context field. Missing trusted caller/process/turn identity MUST fail before store access.
Self authorization compares `job.agentId` only with trusted `callerAgentId`.

The Router MUST install one immutable `activeIngressContext` together with
`activeBindingContext` immediately before prompt write and clear both in the same `finally`.
The process single-flight queue MUST install the queued turn's own context only after the
prior turn clears. Parent Broker RPC reads context directly from that process object; the
child relay transmits no ingress context. Gateway forwards it only to LOCAL handlers.

### CTR-CTX-002 — Trusted current Feishu conversation

When `delivery_target=current_conversation`, the handler MUST require the active trusted
context to belong to the exact tool-calling `(callerAgentId, processGeneration,
turnExecutionId)` and to have `channelNamespace=feishu` plus a valid exact `feishuChatId`.
It MUST resolve only that field to:

```json
{"channel":"feishu","to":"chat:<exact feishuChatId>"}
```

It MUST NOT parse a chat ID from `channelConversationId` or `feishuConversationId` because a
thread conversation ID may contain topic identity. The committed definition MUST persist the
resolved object. Context is valid only for the active turn; after turn completion, process
generation replacement, queued-turn handoff, or cross-Agent call it MUST fail loud. Context
MUST never be cached as “last conversation,” replayed, or accepted from child RPC params.

### CTR-CTX-003 — Other destinations are admin-only

An ordinary Agent MUST use `current_conversation` for announced delivery and MUST NOT specify
`destination` or target another Agent. Explicit other destinations or another
`target_agent_id` require successful `scheduler.manage:any` authorization for the trusted
caller. Denial or Auth uncertainty MUST fail closed.

### CTR-AUTH-001 — Self read and manage scopes

A credentialed ordinary Agent has local entitlements labelled `scheduler.read:self` and
`scheduler.manage:self` only for jobs whose persisted `agentId` equals trusted
`callerAgentId`. These labels are Agent Core authorization outcomes, not Auth token scopes:
ordinary self operations MUST perform zero token requests. `list` and `runs` MUST hide foreign
definitions/evidence. Mutations of a foreign job MUST return a non-leaking denied or
not-found error and MUST NOT mutate or append a success audit record.

To select self versus external authorization for an operation on an existing job, the access
layer MAY call the existing JobStore whole-document load and validation, whose returned
document contains `{jobs, occurrences, fences}`. The authorization decision MAY consume from
that document only (a) whether the requested job exists and (b) that job's `job.agentId`.
If those permitted fields show the requested job is foreign and external proof is required,
then before exact proof succeeds the authorization path MUST NOT project, query, filter,
return, or disclose occurrence/history, and MUST NOT use occurrence/history as authorization
input. Authorized self `runs` behavior remains unchanged and makes zero Auth requests.
Whole-document parsing/validation is permitted but grants no visibility. Denial MUST return
no persisted job/definition/occurrence/history/message/owner content or other public result
and MUST perform no mutation or success audit.

### CTR-AUTH-002 — Exact admin/audit separation and external prerequisites

The trusted Auth seam MUST enforce this operation matrix; scope names imply no capability
beyond the explicit row:

```text
operation / data                          exact external proof                 local result
----------------------------------------  -----------------------------------  --------------------------
create with target_agent_id/destination  (scheduler, scheduler.admin)         scheduler.manage:any
update with target_agent_id/destination  (scheduler, scheduler.admin)         scheduler.manage:any
foreign update/enable/disable/remove      (scheduler, scheduler.admin)         scheduler.manage:any
list(all_agents=true)                     NONE; stable fail-closed             unavailable
runs(all_agents=true) or foreign runs     (scheduler, scheduler.audit)         history visibility only
self create/list/runs/update/control      none; Auth request count = zero      read:self / manage:self
```

Thus exact `(resource='scheduler', scope='scheduler.admin')` is the only external proof for
cross-Agent job-definition mutation/control or explicit destination access. Its success may
establish only local `scheduler.manage:any`, whose consumption is bounded by the matrix; it
MUST NOT propagate authority or authorize global/foreign execution history. Exact `(resource='scheduler',
scope='scheduler.audit')` is the only external proof for `runs(all_agents=true)` or foreign
execution history; its success MUST NOT establish `scheduler.manage:any`, list foreign job
definitions, select another target/destination, or mutate any job. Possessing or proving one
scope never implies, substitutes for, or triggers a request for the other.

`list(all_agents=true)` remains in the closed request schema for compatibility, but no
accepted global job-definition-read scope exists. It MUST return one stable non-leaking
access-denied result before any store read or content disclosure and MUST make zero Auth
requests, even when the caller independently has exact `scheduler.admin`, exact
`scheduler.audit`, or both. Neither external scope, local `scheduler.manage:any`, a scope-name
inference, nor any fallback may authorize it. Rejection MUST return no persisted definition,
message, owner identity, occurrence, history, or other content and perform no mutation or
success audit. This is V2's intentional least-privilege tightening of V1, not a missing
implementation and not creation or reservation of a new wire scope.

Tool arguments MUST NOT assert a resource, wire scope, Grant, or local predicate. Neither
proof path may request or accept wire `scheduler.manage:any` or `scheduler.manage-any`,
translate or normalize an alias, try multiple spellings, combine alternate spellings, or fall
back after failure. Auth denial, unavailable audience, missing Grant, token failure, malformed
response, wrong-only scope, both wrong spellings, or uncertainty MUST deny the operation
without disclosure, mutation, or success audit. The whole-document load/validation permitted
by `CTR-AUTH-001` remains allowed, but the decision may consume only job existence and
`job.agentId`; on every external-proof branch occurrence/history remain forbidden as
authorization input or pre-proof output. A successful proof MUST NOT propagate the token,
credential, Grant, caller authority, source-Agent identity, or authorization fields into the
job, occurrence, run, session, execution request, or target workspace.

This local implementation MUST support the fail-closed seams and tests with an injected Auth
stub, but MUST NOT claim production admin or audit availability. Each external capability is
blocked until a separate accepted auth-service CCR registers the Scheduler audience and exact
scope, its source is implemented/deployed, and a separately authorized Grant supply is
applied. Ordinary self operations make zero Auth requests, including zero requests for
`scheduler.read:self`, `scheduler.manage:self`, `scheduler.manage:any`, `scheduler.admin`, or
`scheduler.audit`.

### CTR-AUTH-003 — Exact V2 delta implementation closure

After future atomic acceptance, the V2 wire-proof/denial delta MUST change product or test
files only in this closed list:

1. `packages/scheduler/src/self-service.js`;
2. `packages/scheduler/test/self-service.test.js`;
3. `packages/scheduler/test/cross-agent.test.js`;
4. `packages/production-runtime/test/compose-cross-agent-history.test.js`.

The production-runtime entry is test-only. `packages/production-runtime/src/compose.js` and
all other product files MUST remain unchanged. Local messages and policy assertions MUST keep
the colon-form labels; only `assertGrant` and its resulting token requests use exact R8 wire
scopes `scheduler.admin` or `scheduler.audit` according to `CTR-AUTH-002`.
`list(all_agents=true)` makes no `assertGrant` or token request.
If implementation requires a fifth file or production composition source change, work MUST
stop for new/amended accepted authority rather than expand this closure.

### CTR-MUT-001 — Existing control operations only

The access layer MUST reuse existing Scheduler operations:

```text
create -> scheduler_create / createJobOp
list   -> scheduler_list
runs   -> scheduler_runs
update -> updateJobOp
enable -> scheduler_enable / enableJobOp
disable-> scheduler_disable / disableJobOp
remove -> scheduler_remove / deleteJobOp
```

All definition mutations MUST use the production Runtime's existing JobStore and its locked
mutation protocol. No direct whole-file writer may be added. The Scheduler engine,
occurrence state machine, fences, retry, catch-up, fresh-session behavior, and delivery seam
MUST remain unchanged.

### CTR-MUT-002 — Update semantics

`update` MUST preserve `jobId`; normalized schedule/payload/target/retry changes MUST follow
existing `updateJobOp` revision semantics and affect future eligible slots only. A past
one-shot MUST be rejected. Update MUST apply the same ownership and destination rules as
create. No update may clear a fence, replay an occurrence, or invoke reconcile.

### CTR-AUDIT-001 — Mutation audit and append failure

Every handler execution that remains alive after a committed
create/update/enable/disable/remove and reaches the audit step MUST attempt exactly one append
of the existing sanitized self-service mutation evidence with operation, job ID, trusted
operator Agent ID, target Agent ID, timestamp, and before/after definition digests as
applicable. It MUST NOT record message bodies, credentials, secrets, or a model-supplied
identity.

Definition/occurrence authority and `runs.jsonl` are not one transaction (D-007 §11.5). When
the handler remains alive and `appendRunEvent` returns/throws failure after a known definition
commit, the failure MUST NOT roll back or deny the known commit and MUST NOT be reported as an
ordinary clean failure. The handler MUST return the committed projection plus
`auditStatus=append_failed`; production Runtime MUST emit a sanitized operator-visible error
containing operation/job ID but no message/secret. The Agent MUST report the mutation as
committed with incomplete audit and MUST NOT retry it. An audit failure before any definition
commit leaves store state unchanged.

A process death after definition commit but before the audit step provides no guarantee that
an append was attempted. That case is governed by `CTR-FAIL-001`: caller outcome unknown,
possible durable audit gap, operator reconciliation required, and no automatic retry. The
Spec does not fabricate an audit event or claim exactly-one append across process death.

### CTR-FAIL-001 — Mutation retry and unknown outcome

Self-service mutations are not generally idempotent and the relay/gateway MUST perform zero
automatic retries. `MUTATION_AUTORETRY = FORBIDDEN`.

- validation/Auth failures occur before mutation and are safe non-commits;
- a known control-op result is returned exactly once, subject to `CTR-AUDIT-001`;
- if transport/process failure prevents the caller from knowing whether the control op
  committed, the result MUST be `mutation_outcome_unknown`; it MUST NOT claim success or
  failure and MUST NOT automatically issue the mutation again;
- after unknown create/update/enable/disable, the next action is `list` (and `runs` when
  applicable) to observe current state before any user-authorized retry;
- after unknown remove, ordinary self scope may no longer authorize the deleted ID, so the
  Agent MUST stop and escalate to operator evidence rather than retry;
- repeated user-directed create is a new mutation and may create another Job; the Agent MUST
  present observed matches and obtain confirmation before retrying an unknown create.

Fault behavior is frozen as: pre-commit failure = no mutation; handler alive +
post-commit audit append returns failure = known commit with `auditStatus=append_failed` and
one attempted append; process death after commit before audit = caller unknown, zero
guaranteed append, durable audit-gap/operator-reconciliation evidence required; post-audit/
pre-response transport loss = unknown to caller but no automatic retry. Explicit later retry
requires the observation rules above. This Spec introduces no durable idempotency table and
no Scheduler schema change.

### CTR-RESULT-001 — Exact create/update evidence

Successful `create` and `update` MUST return all of:

```text
jobId
name
enabled
normalizedSchedule
timezone
nextRunAt
targetAgentId
exactPersistedDeliveryDestination
autoRetry
deleteAfterRun
```

The result additionally carries mandatory `auditStatus`; the ten fields above remain the
user-required committed evidence and may never be omitted.

Their exact JSON wire schema is:

```text
jobId: NonEmptyString                 # committed job.id
name: NonEmptyString                  # committed job.name
enabled: boolean                      # committed job.enabled
normalizedSchedule:
  oneOf:
    {kind:const cron, expr:NonEmptyString, timezone:NonEmptyString}
    {kind:const at, at:NonEmptyString}        # canonical UTC ISO string
    {kind:const every, everyMs:integer>=1}
  each branch additionalProperties:false
timezone: NonEmptyString | null       # cron persisted tz; null for at/every
nextRunAt: NonEmptyString | null      # canonical UTC ISO from persisted nextRunAtMs;
                                      # null only when committed definition has no eligible next run
targetAgentId: NonEmptyString         # committed job.agentId
exactPersistedDeliveryDestination:
  {channel:NonEmptyString,to:NonEmptyString,additionalProperties:false} | null
                                      # committed announce channel/to; null for none/silent
autoRetry: boolean                    # committed job.retry?.auto === true
deleteAfterRun: boolean               # committed job.deleteAfterRun
auditStatus: enum(appended,append_failed)
                                      # append_failed only under CTR-AUDIT-001 known-commit path
```

The top-level result object has exactly these eleven required properties and
`additionalProperties:false`. It MUST be built from the committed persisted definition, not
only request input. `normalizedSchedule.timezone` is named `timezone` in the cron result
projection even though the persisted schedule leaf is `tz`; no `staggerMs` or `anchorMs` is
exposed by this self-service result. Successful enabled create MUST return a non-null eligible
`nextRunAt`. Update returns the committed projection: `nextRunAt:null` is valid when disabled
or when existing Scheduler eligibility/fence semantics yield no eligible next run (including
an unresolved `outcome_unknown` fence). Update MUST NOT clear that fence and MUST NOT turn a
known committed update into failure merely because the next run is null; Acceptance records
the corresponding store fence/state separately without adding a twelfth wire field.

For an enabled at-job, normalized `nextRunAt` MUST be strictly later than the existing
control operation's logical mutation timestamp (`nowMs`, persisted as
`createdAtMs`/`updatedAtMs`). The handler MUST capture one `nowMs` immediately before calling
the control op, validate against that same value, and pass it into the control op; it MUST NOT
claim or infer the later fsync/rename wall-clock instant. Response transmission latency does
not retroactively change this logical-time invariant. The production canary separately
requires `nextRunAt > createResponseObservedAt` by using a 15-minute lead.
`exactPersistedDeliveryDestination` MUST contain the persisted `{channel,to}` for
announce delivery, or an explicit null/not-requested representation for no delivery. A model
or skill MUST NOT report success as “created/configured” when these fields are absent.

### CTR-RESULT-002 — List, runs and lifecycle evidence

Self `list` MUST make zero Auth requests and return only caller-owned persisted job projections
without message bodies. `list(all_agents=true)` MUST follow the unconditional pre-store denial
in `CTR-AUTH-002` and return no projection. While a Job definition exists, `runs` MUST
authorize through its persisted `job.agentId` and return visible
occurrence evidence including occurrence ID, run ID, state, execution outcome, delivery
status, and relevant fence/late-settlement projection.

Ordinary `runs` remains self-only with zero Auth requests. `runs(all_agents=true)` and any
foreign-job history read require exact `scheduler.audit` under `CTR-AUTH-002`; a
`scheduler.admin` proof alone MUST be denied without history disclosure. Conversely,
`scheduler.audit` does not authorize `list(all_agents=true)` or any job-definition mutation.

`remove` MUST delete only the definition; authoritative occurrence evidence remains retained
under D-007. Because current occurrence records do not carry an immutable Agent owner,
ordinary self-service `runs(job_id=...)` MUST return not-found after definition deletion and
MUST NOT infer authorization from bounded `runs.jsonl`, old request data, name, or chat.
Retained post-delete evidence is operator/audit evidence under existing Scheduler authority;
this Spec does not add a tombstone or change occurrence schema. The production canary's
post-delete evidence check is therefore an independently authorized operator read/query, not
an Agent self-service read.

### CTR-LEGACY-001 — Legacy paths fail loud

Scheduler skill/prompt guidance MUST permit only the `scheduler` tool and MUST explicitly
forbid:

```text
openclaw cron
OpenClaw templates in cron-helper
~/.openclaw/cron/jobs.json
manual editing of any jobs.json
Gateway restart as a Scheduler activation mechanism
```

If `scheduler` is absent or denied, the Agent MUST state that self-service Scheduler is not
safely available and MUST NOT fall back to shell, CLI, curl, direct store access, or legacy
OpenClaw behavior.

### CTR-HOT-001 — Post-deployment Job hot reload without restart

Current Node composition does not hot-load code or tool registrations. A conforming
implementation deployment MAY perform one controlled replacement of the sole `authsvc`
production Runtime generation under the existing deployment/runbook authority; that restart
is deployment, not canary evidence. It MUST NOT overlap two production Runtime writers or
start a second Scheduler Runtime/Feishu WebSocket.

After the conforming Runtime generation and child tool catalog are active, the canary window
begins. From immediately before `scheduler(action=create)` until after occurrence,
delivery, auto-delete, and evidence observation, the production Runtime PID/start time MUST
remain unchanged. The Job committed through the unified tool MUST be observed by that
already-running resident Scheduler on a later mtime/tick reload. Thus
`HOT_RELOAD_WITHOUT_RESTART` means **Job definition reload**, never code/tool hot loading.

### CTR-CANARY-001 — Production one-shot canary

After accepted implementation is deployed, efficiency-agent in the current Feishu group MUST
create exactly one 15-minute `at` Job through:

```text
scheduler(action="create", name="15分钟提醒", schedule_kind="at", at="15m",
  message="⏰ Agent Core Scheduler 自助任务触发成功",
  delivery_mode="announce", delivery_target="current_conversation",
  delete_after_run=true, auto_retry=false)
```

The canary MUST prove: no Runtime restart; production JobStore used; exact trusted chat
persisted; `nextRunAt` strictly future; occurrence created and succeeded; delivery status
`delivered`; message visible in the current group; definition automatically deleted; retained
occurrence evidence; zero Runtime/Agent operational access to the exact legacy path
`/Users/yanfenma/.openclaw/cron/jobs.json`; and unchanged legacy bytes.

The negative-evidence method is frozen:

1. `CANARY_EVIDENCE_OPERATOR` is repository owner `mayf3` or an explicitly delegated
   production operator recorded in the deployment PR/runbook; it is not the Agent/model.
2. Before create, that operator records legacy file existence, size, mtime, inode, and SHA-256
   through a read-only observation, plus production Runtime PID/start time and its current
   descendant PID set.
3. Before create, the operator starts whole-host macOS filesystem tracing with
   `sudo fs_usage -w -f filesystem` (not PID-filtered), records trace PID/start marker, and
   verifies it remains alive. The window ends only after occurrence/delivery/auto-delete and
   operator evidence observation. Non-zero tracer exit, missing start/end marker, truncation,
   or capture gap invalidates the canary.
4. The retained raw trace MUST contain zero event whose path equals or is beneath
   `/Users/yanfenma/.openclaw/cron/`; this covers Runtime, descendants, Agent children, and all
   other host processes rather than relying on an incomplete PID list.
5. After the window, the operator repeats existence/size/mtime/inode/SHA-256. Exact equality
   proves unchanged bytes/metadata; the whole-host trace separately proves zero accesses in
   the bounded window.
6. The raw trace is retained outside Git with SHA-256, byte count, start/end wall times,
   Runtime/descendant snapshots, command, exit status, and operator identity recorded in the
   production evidence report. No legacy bytes/path observation feeds Scheduler behavior or
   becomes visible to the Agent.

### CTR-OPS-001 — Reconcile and CLI boundaries

Reconcile MUST remain Owner/operator-only and absent from the unified tool. The existing CLI
MUST remain control-only and continue to use JobStore control operations. The Agent-facing
skill MUST NOT call the CLI.

### CTR-GOV-001 — Spec/implementation split

While V2 is proposed it has no implementation authority, V1 remains accepted/current, and
V1 MUST NOT be modified. Only after explicit Owner `mayf3` authority, an authorized actor MAY
prepare one atomic lifecycle-only docs commit. That commit's permitted changes are the
following exhaustive allowlist; everything not listed is forbidden:

1. V2 frontmatter: `status: proposed -> accepted`;
2. V2 frontmatter: `implementation_authority: none -> contracts`;
3. V2 frontmatter: insert only `accepted_by: mayf3`, exact `accepted_at`,
   `accepted_reviewed_head` naming the independently reviewed proposed-content head, and
   `acceptance_review_verdict: PASS` consistent with that reviewer identity/outcome;
4. V1 frontmatter: `status: accepted -> superseded`;
5. V1 frontmatter: `superseded_by: null -> AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V2`;
6. V2 introductory blockquote lifecycle sentence only, exact two-line replacement:

   ```text
   FROM: > **Proposed whole-Spec successor.** V1 remains accepted/current and byte-unchanged while V2
         > is proposed.
   TO:   > **Accepted whole-Spec successor.** V1 was superseded by V2 through the atomic lifecycle
         > transaction.
   ```
7. V2 frozen summary: `STATUS = proposed -> accepted`;
8. V2 frozen summary: `IMPLEMENTATION_AUTHORITY = none -> contracts`;
9. V2 frozen summary: `INDEPENDENT_REVIEW = PENDING -> PASS`;
10. V2 frozen summary: `READY_TO_MARK_ACCEPTED = NO -> YES`; and
11. V2 frozen summary: `ACCEPTED_REVIEWED_HEAD = NONE -> <exact reviewed proposed head>`.

The README row is lifecycle-neutral and MUST NOT change in this transaction. V2 MUST retain
`production_apply_authority: none`; V1's existing production-apply meaning MUST remain none
without a new field. V1 normative body MUST remain byte-identical. All non-allowlisted V2
normative-body bytes, including every Decision, Contract, and Acceptance behavior, MUST remain
byte-identical to the reviewed proposed content. Every other use of `proposed`, `accepted`,
or future-tense acceptance language in Goal/authority/Decision/Contract/Acceptance/migration
text is historical or conditional governance meaning, not a lifecycle marker, and is
therefore explicitly non-allowlisted and byte-frozen.

Before that prepared commit may merge, an independent reviewer MUST review its new exact
head and return `FINAL_HEAD_RECHECK=PASS`. The recheck MUST prove all of:

1. every changed byte is inside an exact allowlist item and every required item is present;
2. every non-allowlisted V2 normative-body byte is identical to reviewed proposed content;
3. V1 normative body and all frontmatter except `status`/`superseded_by` are identical to the
   accepted preimage;
4. each new lifecycle/provenance value agrees with explicit Owner authority, V2
   accepted/contracts frontmatter, and the named reviewer identity/outcome;
5. `SEMANTIC_DELTA=NONE`, meaning Scheduler Contract/behavior semantics did not change; this
   does not prohibit the enumerated lifecycle/provenance synchronizations; and
6. the proposed review base and current `main` introduce no authority drift affecting V2.

Any failure, ambiguity, main/base drift, or post-recheck byte change invalidates the gate and
requires a new exact-head recheck. Only the exact head that passed may merge. That merge MUST
precede the four-file delta implementation PR. The implementation PR MUST NOT modify either
governing Spec. Acceptance authorizes no auth-service, Grant, credential, registry/database,
deployment, or production action.

## 10. Acceptance

### ACC-TOOL-001 — Single manifest and closed union

- Contracts: `CTR-TOOL-001`, `CTR-TOOL-002`, `CTR-OPS-001`
- Method: Broker manifest/unit tests and child tool-catalog integration test
- Environment: clean implementation worktree
- Required evidence: exact implementation commit, test command/output, registered tool names,
  generated schema with selector `action`
- Expected result: only `scheduler`; existing non-Scheduler tools retain selector `operation`;
  seven actions route correctly; every unknown/cross-action/nested-unknown/conditional-invalid
  field and `reconcile` fails before store read, grant call, or mutation
- Failure condition: any legacy Scheduler tool is model-visible, any existing capability's
  selector changes, or any permissive field passes

### ACC-CTX-001 — Trusted identity and conversation

- Contracts: `CTR-CTX-001`, `CTR-CTX-002`, `CTR-CTX-003`
- Method: integration tests with trusted Feishu, missing/non-chat context, forged relay/chat
  fields, process-generation replacement, two conversations queued for one Agent, concurrent
  calls from two Agents, stale context replay, explicit destination, self and admin stubs
- Environment: Parent Runtime/Broker test composition
- Required evidence: executed tests, active-turn IDs/context lifecycle trace, and persisted job
  projection
- Expected result: only the exact tool-calling turn's injected `feishuChatId` persists; prior,
  queued, cross-Agent, forged, or missing context fails; thread conversation ID is never parsed
  as chat ID; explicit other destination works only with manage:any
- Failure condition: any model/child-supplied or wrong-turn identity/chat value affects
  ownership or destination

### ACC-AUTH-001 — Self/admin/audit authorization matrix

- Contracts: `CTR-AUTH-001`, `CTR-AUTH-002`
- Method: unit/integration operation matrix across two Agents with independent exact admin and
  audit proofs, admin-only/audit-only/both-scope `list(all_agents=true)` callers, wrong-scope/
  cross-scope/dual-spelling inputs, proof denial/error/malformed/unavailable cases, and
  assert-fail-if-called self and global-list cases
- Environment: isolated JobStore with real control operations
- Required evidence: store before/after, handler results, and per-action Auth token-request
  call records for create/list/runs/update/enable/disable/remove self/admin/audit/negative cases;
  instrumented JobStore/read ledger proving whole-document load/validation and an
  authorization-consumption ledger limited to job existence plus `job.agentId`; occurrence/
  history projection/query/filter/return ledger; mutation/audit ledger
- Expected result: every ordinary self action has Auth request count exactly zero; each foreign
  explicit target/destination create/update and foreign update/enable/disable/remove requests
  exactly `(scheduler, scheduler.admin)` once; only exact
  admin success establishes local `scheduler.manage:any`, consumed only for the matrix row;
  `runs(all_agents=true)` and foreign runs request exactly `(scheduler, scheduler.audit)` once;
  admin alone reveals no foreign/global history and audit alone grants no foreign mutation;
  self `list` makes zero Auth requests and returns only caller-owned definitions;
  `list(all_agents=true)` always makes zero Auth requests and zero store reads and returns the
  same access-denied result with no persisted content or owner identity when the caller has
  admin, audit, both, neither, or local manage-any; authorization for existing-job operations
  may load/validate `{jobs, occurrences, fences}`
  but consumes only requested-job existence and `job.agentId`; on every external-proof branch,
  before proof it performs zero occurrence/history projection/query/filter/return and does
  not use them as decision input; authorized self history remains unchanged with zero Auth;
  denial returns no persisted content and makes no mutation/success audit; production admin
  and audit stay denied until their external audience/scope/deployment/Grant gates pass
- Failure condition: any Auth token request during an ordinary self action, admin-to-audit or
  audit-to-admin implication, any successful or data-dependent `list(all_agents=true)`, any
  Auth request/store read/content or owner disclosure on that path, ordinary cross-Agent
  visibility/mutation/success audit, a test
  that treats permitted whole-document load/validation itself as forbidden, authorization
  consumption beyond existence/`job.agentId`, any
  external-proof pre-success occurrence/history projection/query/filter/return or decision use,
  `scheduler.manage:any`/`scheduler.manage-any` wire request, alias/normalization/multiple
  spelling/fallback, wrong or multiple proof requests, tool-asserted authority, authority or
  credential propagation, or claim of production admin/audit availability without
  accepted/deployed external authority

### ACC-AUTH-002 — Exact four-file delta and composed proof

- Contracts: `CTR-AUTH-003`
- Method: accepted-base-to-head diff census plus focused Scheduler tests and composed production-runtime cross-agent history test with local OAuth capture
- Environment: isolated implementation worktree under repository-pinned Node with proxy variables unset; disposable stores; no production service
- Required evidence: exact changed-file list, executed commands/results, captured OAuth body and count, execution payload authority-key scan, and HistoryStore queries
- Expected result: only the four named files change; production compose source is unchanged;
  captured OAuth bodies use `scheduler.admin` for cross-Agent mutation/control/destination and
  `scheduler.audit` only for global/foreign history; local labels remain colon-form; admin and
  audit are mutually non-implying; `list(all_agents=true)` produces no OAuth request and is
  denied before store read even with admin, audit, or both; target identity, no source Grant/credential/authority
  propagation, exactly once/no replay, and linked job/occurrence/run/session/target/
  correlation/parent/terminal truth remain proved
- Failure condition: fifth file, production compose source edit, wrong/alternate/combined
  scope, `scheduler.manage:any` or `scheduler.manage-any` wire value, alias/normalization/
  retry/fallback, admin/audit implication, any authorized/data-bearing global definition list,
  authority leakage, replay, identity mismatch, or
  missing/broken history linkage

### ACC-MUT-001 — Mutation, update, audit and results

- Contracts: `CTR-MUT-001`, `CTR-MUT-002`, `CTR-AUDIT-001`, `CTR-FAIL-001`,
  `CTR-RESULT-001`, `CTR-RESULT-002`
- Method: real Scheduler package tests using a temporary V2 store plus fault injection before
  commit, post-commit/pre-audit, post-audit/pre-response, and relay transport loss for every
  mutation action
- Environment: isolated filesystem
- Required evidence: normalized persisted definitions, audit lines/runtime error record,
  occurrence records, revision values, exact result envelopes, fenced enabled-update store
  projection proving `nextRunAt:null` without fence clearing, control-op/automatic-retry call
  counts, and operator post-delete evidence query
- Expected result: all writes use one control op; automatic mutation retry count is zero;
  update preserves ID/future revision semantics and unresolved fences; create/update return
  every committed field; enabled create has non-null next run while fenced enabled update may
  return explicit null; live-handler audit failure returns known commit +
  `auditStatus=append_failed`; process death
  post-commit/pre-audit returns caller-unknown with zero guaranteed append and a detectable
  operator reconciliation gap; response loss returns unknown; remove retains operator evidence
  while ordinary post-delete runs returns not-found
- Failure condition: direct store write, automatic retry, false success/failure on unknown,
  missing result field, leaked message, replay/fence change, inferred post-delete ownership,
  or deleted occurrence evidence

### ACC-LEGACY-001 — Retired paths

- Contracts: `CTR-LEGACY-001`
- Method: inspect active skill plus negative behavior test with unified tool absent
- Environment: efficiency-agent skill/runtime fixture
- Required evidence: active skill revision, tool-choice trace, repository/skill scan limited to
  active operational instructions
- Expected result: only Scheduler tool path; fail-loud without it; no active OpenClaw template
- Failure condition: shell/CLI/OpenClaw/jobs JSON/Gateway fallback is offered or executed

### ACC-HOT-001 — Production no-restart canary

- Contracts: `CTR-HOT-001`, `CTR-CANARY-001`
- Method: deployment provenance plus current-group one-shot canary and post-run evidence query
- Environment: production Runtime and `/Users/authsvc/.agent-core/scheduler/jobs.json`
- Required evidence: deployment generation/provenance; then Runtime PID/start-time captured
  immediately before create and after canary completion; registered tool catalog; create
  response; committed definition projection; occurrence/delivery evidence; current-group
  message observation; post-run list plus operator occurrence query; whole-host raw `fs_usage`
  trace with command/operator/start-end markers/exit status/byte count/SHA-256 and zero legacy
  path events; Runtime/descendant PID snapshots; exact operator before/after legacy
  existence/size/mtime/inode/SHA-256 equality; evidence-report retention coordinates
- Expected result:

```text
RUNTIME_RESTARTED = NO
PRODUCTION_STORE_USED = YES
EXACT_CHAT_ID_PERSISTED = YES
OCCURRENCE_CREATED = YES
OCCURRENCE_SUCCEEDED = YES
DELIVERY = delivered
CURRENT_GROUP_VISIBLE = PASS
JOB_AUTO_DELETED = YES
OCCURRENCE_EVIDENCE_RETAINED = YES
OPENCLAW_STORE_UNCHANGED = YES
```

- Failure condition: any line differs; evidence is missing; another Runtime overlaps; tracer
  is late, filtered, truncated, exits non-zero, or has a capture gap; any legacy path event
  appears; or before/after legacy metadata/hash differs

### ACC-GOV-001 — Two-stage publication

- Contracts: `CTR-GOV-001`
- Method: after explicit Owner authority, inspect authorized-actor provenance, the prepared lifecycle-only commit, independent review of that commit's exact head, base/main comparison, git/PR ancestry, and prohibited-effect audit
- Environment: GitHub repository
- Required evidence: reviewed proposed V2 head and normative-body digest; explicit Owner instruction; authorized actor identity; prepared atomic docs commit/head; byte/field diff mapped one-to-one to all 11 allowlist items; non-allowlisted V2 byte comparison; V1 accepted-preimage comparison; exact new frontmatter/footer/banner values and reviewer identity/outcome; current-main authority diff; independent reviewer result containing `FINAL_HEAD_RECHECK=PASS` and behavioral `SEMANTIC_DELTA=NONE`; merge commit; later separate four-file implementation ancestry; zero-effect evidence
- Expected result: V1 remains current/unchanged while V2 is proposed; the authorized actor then prepares exactly one lifecycle commit whose changes are all and only the exhaustive allowlist; every non-allowlisted V2 normative byte and the V1 normative body are identical; every new value matches Owner authority, accepted/contracts frontmatter, and review provenance; `SEMANTIC_DELTA=NONE` confirms no Contract/behavior change while permitting the listed lifecycle/provenance synchronization; base/main have no authority drift; only the unchanged exact head with final recheck PASS merges; production authority stays none
- Failure condition: current-round V1 lifecycle edit; preparation without explicit Owner authority or by an unauthorized actor; missing or extra allowlist delta; non-allowlisted V2 normative drift; V1 body or frontmatter drift beyond `status`/`superseded_by`; inconsistent lifecycle/provenance value; missing/failed/stale `FINAL_HEAD_RECHECK`; Contract/behavior semantic delta; base/main authority drift; post-recheck head change; README change in the transaction; merge before PASS; implementation before accepted V2 reaches main; Spec edit in implementation; or any auth/Grant/credential/registry/database/deploy effect

## 11. Alternatives and disposition

- `ALT-001` — Keep six model-visible tools. Rejected by `DEC-001`: conflicts with the one-tool
  skill and expands model catalog surface.
- `ALT-002` — Let the model provide exact Feishu chat ID. Rejected by `DEC-003`: model text is
  not trusted ingress context.
- `ALT-003` — Use “last channel” implicit state. Rejected: destination is ambiguous and not
  exact persisted evidence.
- `ALT-004` — Grant every Agent `manage:any`. Rejected by `DEC-004`: violates self ownership.
- `ALT-005` — Directly edit production `jobs.json`. Rejected by D-007 and `DEC-005`: bypasses
  mutation authority.
- `ALT-006` — Fall back to OpenClaw cron or restart Gateway. Rejected by `DEC-006`: retired
  wrong-store path and false activation.
- `ALT-007` — Claim that copying Node files hot-loads a running parent. Rejected by
  `CTR-HOT-001`: current composition has no code/tool HMR. Deployment uses one controlled
  generation replacement; the no-restart proof begins immediately before Job creation.
- `ALT-008` — Treat candidate `4595ed3` as self-authorizing. Rejected by `DEC-007` and local
  governance.
- `ALT-009` — Use grammar-valid `scheduler.manage-any` as wire authority. Rejected by
  `DEC-008`: auth grammar supplies shape only, while accepted Run History R8 freezes
  `scheduler.admin` for job-definition mutation.
- `ALT-010` — Let admin imply audit, audit imply admin, or request both opportunistically.
  Rejected by `DEC-008` and `CTR-AUTH-002`: definition control and execution history are
  distinct least-privilege capabilities.
- `ALT-011` — Let admin, audit, both, or local manage-any authorize
  `list(all_agents=true)`. Rejected by `DEC-008`: no accepted authority defines global
  job-definition read, and a scope name cannot create or imply that capability.

## 12. Migration, compatibility, and rollback

1. Preserve candidate `4595ed3` as implementation input; do not force-push it away before the
   accepted implementation replacement is durably published.
2. Keep V2 proposed/none and V1 accepted/current/untouched until explicit Owner authority.
   Then an authorized actor prepares one lifecycle-only docs commit containing all and only
   the 11 `CTR-GOV-001` allowlist items; the lifecycle-neutral README does not change. Before
   merge, an independent reviewer rechecks that new exact head and must return
   `FINAL_HEAD_RECHECK=PASS`, proving non-allowlisted byte identity, new-value consistency,
   behavioral `SEMANTIC_DELTA=NONE`, and no base/main authority drift. Only that unchanged
   passing head may merge and become active in `main`.
3. Rebase/port the original candidate product and tests onto that accepted main as required
   by the unchanged V1 authority. Implement the V2 proof delta only in the exact four files
   named by `CTR-AUTH-003`; production composition source and `packages/scheduler/src/store.js`
   remain unchanged. Continue using existing whole-document JobStore load/validation, while
   authorization consumes only requested-job existence and `job.agentId`; every external-proof
   branch performs no pre-proof occurrence/history projection/query/filter/return or decision
   use, while authorized self list/history retain zero-Auth behavior. Cross-Agent mutation,
   control, and explicit destination rows use only `scheduler.admin`; global/foreign history
   rows use only `scheduler.audit`; neither implies the other. Preserve the `all_agents`
   schema field for list compatibility, but reject `list(all_agents=true)` before store read
   with no Auth request until future separately accepted authority defines an exact scope.
4. Keep existing internal access handlers and CLI when conforming; no Scheduler core rewrite.
5. Deploy with the existing trusted production procedure and controlled replacement of the
   sole Runtime generation; never overlap a second resident engine or Feishu connection.
   Capture the new generation/PID, then begin the no-restart Job hot-reload canary window.
6. Rollback of tool activation disables/removes the Agent-facing manifest/control surface;
   it MUST NOT delete Jobs/occurrences, mutate Scheduler core, touch OpenClaw store, or restart
   Gateway. A canary Job may be removed only through the unified tool/control operation.
7. No historical OpenClaw job import or compatibility fallback is part of this migration.
8. V2 proof-delta rollback restores the exact four-file accepted preimage and MUST NOT add
   a manage-any wire alias, normalization, alternate spelling, scope implication, or dual-scope
   fallback. Auth registration rollback, Grant revocation, and runtime
   rollback remain separate Owner-authorized operations; local rollback MUST NOT claim those
   external states changed.

## 13. Open questions

```text
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
PARTIAL_SUPERSESSION = NONE
```

Implementation may select internal JavaScript property names only; the trusted context
fields, lifetime/binding, action schemas, deployment generation boundary, and Job hot-reload
semantics above are normative and may not be weakened.

---

```text
SPEC_GOVERNANCE_MODE = AUTHOR
SPEC_ID = AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V2
SPEC_KIND = implementation
STATUS = accepted
AUTHORITY_LEVEL = governing_spec
IMPLEMENTATION_AUTHORITY = contracts
PRODUCTION_APPLY_AUTHORITY = none
PRIMARY_PARENT_AUTHORITY = AGENT_CORE_PRODUCT_ARCHITECTURE_V1
ACCEPTED_SCOPE_AUTHORITY = AGENT_CORE_SCHEDULER_RUN_HISTORY_V1@a2919174338dc19ff16d9554d2f00c025d482410#blob-1f719514dc79a515a49aa592a0bd66961fcaed8a:R8
EXTERNAL_AUTHORITIES = mayf3/auth-service#MINIMAL_AUTH_FOUNDATION_V2@05fcf4074fe15d7f29ce1ef0f68767fbbebd54de (constrained_by)
SUPERSEDES = AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V1
LOCAL_PREDICATES = scheduler.read:self | scheduler.manage:self | scheduler.manage:any
CROSS_AGENT_MUTATION_DESTINATION_PROOF = resource:scheduler + scope:scheduler.admin
GLOBAL_FOREIGN_HISTORY_PROOF = resource:scheduler + scope:scheduler.audit
GLOBAL_JOB_DEFINITION_LIST = UNAVAILABLE_NO_ACCEPTED_SCOPE
LIST_ALL_AGENTS_AUTH_REQUESTS = ZERO
LIST_ALL_AGENTS_STORE_READS = ZERO
ADMIN_IMPLIES_AUDIT = NO
AUDIT_IMPLIES_ADMIN = NO
WIRE_MANAGE_ANY_FORMS = FORBIDDEN
LIFECYCLE_ACTOR_REQUIREMENT = OWNER_AUTHORIZED_ACTOR_ONLY
ACCEPTANCE_COMMIT_REQUIREMENT = SINGLE_LIFECYCLE_ONLY_DOCS_COMMIT
ACCEPTANCE_DELTA_ALLOWLIST_ITEMS = 11
PREMERGE_FINAL_HEAD_RECHECK_REQUIREMENT = PASS_ON_ACCEPTANCE_COMMIT_EXACT_HEAD
FINAL_HEAD_RECHECK_EVIDENCE = EXTERNAL_PR_EVIDENCE_REQUIRED_BEFORE_MERGE
ACCEPTANCE_SEMANTIC_DELTA_REQUIREMENT = NONE_FOR_CONTRACT_AND_BEHAVIOR
BASE_MAIN_AUTHORITY_DRIFT_REQUIREMENT = NONE
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
PARTIAL_SUPERSESSION = NONE
CONTRACT_COUNT = 19
CONTRACTS_WITH_ACCEPTANCE = 19
AUTHORING_READY_FOR_REVIEW = COMPLETED
INDEPENDENT_REVIEW = PASS
READY_TO_MARK_ACCEPTED = YES
ACCEPTED_REVIEWED_HEAD = efdd754f0db0b9e7041757ca83246d5695cf83f4
```

---

## AMENDMENT_1 — CRITICAL_JOB_SELF_DISABLE_GUARD (2026-09-10, status: accepted)

> **状态**：`accepted`（2026-09-10，Owner EXACT-HEAD ACCEPTANCE：accepted_exact_head =
> ba4c0a8c340f1fe098c239b64bee132061d5f755；SEMANTIC_SHIP_BLOCKERS = 0；semantic review PASS
> + targeted exact-head recheck PASS）。本 Amendment 只回答一个语义问题并冻结其答案；
> 实现为 merge 后的独立授权 PR（T1–T10 + T2a/T3a 门控）；PRODUCTION_APPLY = NO。

### A1. The one semantic question

> 一个被 Owner 明确纳入 critical desired-state inventory 的 Scheduler job，拥有该 job 的
> 普通 Agent 是否可以通过 model-facing self-service Scheduler tool 把它 disable？

**Owner 产品答案（冻结）**：**NO**。

### A2. Frozen minimal semantics

```text
ordinary owner Agent
+ scheduler.manage:self
+ critical job（per critical inventory, exact identity）
+ action=disable
→ FAIL_CLOSED（stable denial, no content disclosure）
→ ZERO STORE MUTATION
```

- 本 guard 是 **authorization 约束**，不是 readiness/mask 语义：它与
  SCHEDULER_CONTROL_PLANE_RELIABILITY_V1 AMENDMENT_1（readiness child-mask——错误/未就绪
  runtime 不得使 mutation capability 显得可用）正交且保持分离；两者最终可在同一次
  Scheduler production closure 部署，但 authority 与测试分别可审计。
- **CRITICAL != IMMUTABLE**：以下路径的 disable 权限保持完全不变——
  1. operator CLI（canonical `agentcore-cron disable`，Owner/生产控制面）；
  2. 持 exact `(resource='scheduler', scope='scheduler.admin')` 的
     `scheduler.manage:any` 外部证明路径（CTR-AUTH-002 矩阵既有行）。
  即：Owner/operator 紧急停止能力必须保留。
- 除 disable 外，critical job 对其 owner Agent 的其余 self 操作（create/list/runs/
  update/enable）语义不变；remove 对 critical job 同受本 guard 约束（disable 的
  变体绕过 = remove-then-recreate 同被禁止）；guard 与 A3(b) 的 fail-closed
  措辞对 disable/remove 统一适用，remove 覆盖由 A4 测试面（T2a/T3a）断言。
- 不改变 occurrence、retry、run、watchdog、alert 的任何语义；不回流、不重开
  PR #222 / #242 / #248。

### A3. Critical identity contract（F：禁止按 name 猜）

判定一个 job 是否 critical，**唯一授权源** = 现有 reliability authority 已冻结的
critical desired-state inventory：

- 文件：`/usr/local/libexec/agent-core/config/scheduler-desired-state.json`
  （`version: 1`，由 SCHEDULER_CONTROL_PLANE_RELIABILITY_V1 §5.4 冻结的
  as-found 基线；2026-09-10 机械 census：`0644 root:wheel` world-readable、
  `_frozenAt: 2026-09-08T12:49:58.745Z`、恰 2 条 critical jobs，均以稳定
  `logicalKey` 键定——`agt_daily-thought-agent:daily-raw-distilled-summary-check`
  与 `agt_hr-agent:hr-workflow-auto-dispatch`）。
- **匹配规则**：目标 job 的 persisted `logicalKey`（store 内 §5.1 唯一标识）与
  inventory 中任一 `logicalKey` **精确相等** ⇒ critical。**禁止** job.name、
  display name、substring、agent prompt 或任何启发式分类。
- **absent ⇒ not critical**：不在 inventory 中的 job，其 self-service disable
  行为与现行 accepted V2 完全一致（T1）。
- **read-only**：mutation-time 消费只读该文件，零写入、零缓存权威化；
  **NO new authoritative fields in jobs.json**——critical 分类不落 store。
- **机械 census 结论**：该 inventory **适合作 mutation-time authorization source**
  （stable logicalKey 精确身份 / world-readable 于 runtime 用户 / schema 冻结 /
  与 watchdog desired-state 检查同源——单一只读真相源）。已识别的 gap 如实记录：
  (a) inventory 为 **frozen as-found 基线**——新增 critical job 需 operator 更新该
  manifest（流程要求，非机械缺陷）；未经 operator 登记的新 critical job 在登记前
  不受本 guard 保护（诚实边界，watchdog 的 §5.4 检查同此边界）；
  (b) **unreadable/invalid ⇒ FAIL_CLOSED**：mutation 时清单不可读/不可解析/版本
  不符 ⇒ 该次 self-service disable/remove **拒绝**（stable denial reason
  `critical_inventory_unavailable`），因为不可验证的 critical 分类不得放行任何
  self-service disable/remove；operator CLI 路径不受影响（紧急停止保留）。此为
  A3 的定义性裁定，交由 independent semantic review 裁决。

### A4. Required failure injections（acceptance 后实现的最低测试面，源自 Owner 冻结清单）

| # | 注入 | 断言 |
|---|------|------|
| T1 | self-owned **non-critical** job disable | 行为与现行 accepted V2 完全一致（不变） |
| T2 | self-owned **critical** job disable | denied + **zero store mutation** |
| T2a | self-owned **critical** job remove（bypass 变体） | denied + **zero store mutation**；remove-then-recreate 路径同被阻断 |
| T3 | replay 被拒的 disable | 仍 denied + zero mutation（幂等拒绝） |
| T3a | replay 被拒的 critical remove | 仍 denied + zero mutation（幂等拒绝） |
| T4 | 经替代 job 标识（id 前缀/别名/大小写等）规避 | 无法绕过——identity 仅认 persisted logicalKey 精确匹配 |
| T5 | foreign Agent disable（任意 job） | 既有 ownership 规则拒绝不变 |
| T6 | operator CLI disable critical job | **允许**（紧急停止保留） |
| T7 | `scheduler.manage:any`（exact admin proof）disable critical job | **允许**（既有语义保持） |
| T8 | missing/ambiguous critical classification（清单缺失/损坏/版本不符） | 按 A3 FAIL_CLOSED |
| T9 | 被拒 mutation 落 durable attribution/evidence（who/which job/reason），零 payload/credential 泄露 | 遵循既有 sanitized audit discipline（拒绝归因 ≠ 违反 job/definition 状态的 ZERO store mutation）；具体通道形态在实现 acceptance 时冻结 |
| T10 | enable/list/runs 全量回归 | 零回归 |

### A5. Acceptance criteria（independent semantic review 必答）

```text
ONE_SEMANTIC_QUESTION_ANSWERED     = YES？（A1 冻结答案 = NO）
CRITICAL_NEVER_IMMUTABLE           = YES？（A2 operator/manage:any 两路保留）
IDENTITY_BY_EXACT_LOGICAL_KEY_ONLY = YES？（A3 零 name 猜测）
INVENTORY_READ_ONLY_NO_STORE_FIELD = YES？（零 jobs.json 新权威字段）
FAIL_CLOSED_ON_UNVERIFIABLE        = YES？（A3(b) 定义裁定成立）
CHILD_MASK_SEPARATION_PRESERVED    = YES？（A2 与 readiness mask 正交分治）
T1-T10_COVER_MINIMAL_TEST_SURFACE  = YES？
NO_OTHER_SEMANTICS_TOUCHED         = YES？（occurrence/retry/run/watchdog/alert 零触碰）
STANDING_BEHAVIOR_UNCHANGED_PRE_ACCEPTANCE = YES？
```

任一 = NO/UNPROVEN ⇒ AMENDMENT = REVISE。

### A6. 与既有 artifact 的关系

- 本文件（AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V2，accepted）：唯一 authority home
  ——被改变的是 **self-service mutation authorization**，故以本 spec 的 AMENDMENT
  落位，不新造平行 Scheduler authority。
- SCHEDULER_CONTROL_PLANE_RELIABILITY_V1（accepted）：critical inventory 的冻结出处
  （§5.4 desired-state）与 §5.3 readiness child-mask（其 AMENDMENT_1，正交保留）。
- 背景：历史已存在 Agent 经 self-service 工具面停用其 critical Scheduler job 的
  **已证实复发实例**（2026-09-09：b115cb96 critical 派发器被其属主 Agent 经工具面
  disable，disable 事件带 before/afterDigest 署名取证）；2026-09-10 当前 recurrence
  的 actor/source 仍 **UNKNOWN_PENDING_FORENSICS**，待 Owner read-only disable
  forensics 定性（若定性为 `DISABLE_OPERATOR_AGENT_ID=agt_hr-agent` 且
  `DISABLE_SOURCE=self_service_mutation`，该结论记录于 **incident evidence**，记作
  `CURRENT_RECURRENCE_MATCHES_STRUCTURAL_GAP = YES`，不冻结进本产品 authority）。
  本 Amendment 关闭的是**已经成立的产品权限缺口**；在本次 provenance 确认前，
  不得声称其必然关闭本次事故根因。现场处置（forensics/reconcile/enable）由既有
  authority 与 operator 流程承载，不在本 Amendment 范围内。

---

## AMENDMENT_2 — AMENDMENT_1_IMPLEMENTATION_CONFORMANCE_AND_STRUCTURE_CLOSURE (2026-09-10, status: accepted)

> **状态**：`accepted`（2026-09-10，Owner EXACT-HEAD ACCEPTANCE：accepted_exact_semantic_head =
> 6b5a41f721c80a25c8ce0019c263f0c5ad585dd1；PRODUCT_SEMANTIC_DELTA = NONE；SHIP_BLOCKERS = 0）。
> 实现授权已激活（仅限 B2 冻结的结构 repair，独立 PR，B5 硬门全检）；PRODUCTION_APPLY = NO。
> 起因：AMENDMENT_1（critical self-disable guard）的已接受产品语义要求消费
> persisted job.logicalKey 并在 self-service 面落 guard，而 inherited V2 正文
> 仍保留 (i) "authorization 只消费 job existence + job.agentId"（CTR-AUTH-001/002）
> 与 (ii) CTR-AUTH-003 exact four-file implementation closure（第五文件 ⇒ STOP）。
> 同时 #251/#253 的实现使 oversized legacy self-service.js / self-service.test.js
> 继续增长，触发 repository structure verifier（CODE_STRUCTURE_GUARDRAILS_V1）
> 的 UNREGISTERED_LEGACY_TOUCHED。本 Amendment 只关闭这组机械一致性债务；
> 不改变任何产品语义（A1–A6 of AMENDMENT_1 与 B1/B2 repaired behaviors 全部冻结）。

### B1. Authorization consumption — 唯一窄例外（closure of LOGICALKEY_CONSUMPTION_CONFLICT）

在 CTR-AUTH-001/002 的 "the decision may consume only job existence and
`job.agentId`" 之上，**加入且仅加入**以下枚举例外：

```text
ordinary self disable/remove classification
MAY additionally consume the job's persisted job.logicalKey
（AMENDMENT_1 critical guard 的唯一判定输入）
```

除此以外一律不变：NO additional job fields；occurrence/history 仍禁止作为
authorization 输入或 pre-proof 输出；denial 仍零内容泄露；self 操作的
Auth request count 仍为 **zero**（logicalKey 来自已加载的 store 文档，不是
Auth 查询）；`manage:any`/`audit` 外部证明行零改动。

### B2. Implementation closure — TOTAL_AUTHORIZED_CHANGED_PATHS = 5（closure of FILE_CLOSURE_CONFLICT）

先做最小结构设计（成员清单如下），据此冻结**本 repair 的 exact changed-path
closure**。两个不同概念不得混淆：

```text
PRODUCT_AND_TEST_FILES   = 4   （产品/测试 artifact；AMENDMENT_1 guard 面的实现与测试）
GOVERNANCE_REGISTRY_FILES = 1   （纯结构登记，GOVERNANCE_ONLY_STRUCTURE_REGISTRATION；
                                 PRODUCT_SEMANTIC_AUTHORITY = NONE）
TOTAL_AUTHORIZED_CHANGED_PATHS = 5
```

Exact authorized paths（**全 diff 即此五路径，不得更多**）：

```text
1. packages/scheduler/src/critical-job-guard.js          PRODUCT（NEW guard module）
2. packages/scheduler/src/self-service.js                PRODUCT（收缩 ≤500）
3. packages/scheduler/test/critical-job-guard.test.js    PRODUCT/TEST（RENAMED_TO，见下）
4. packages/scheduler/test/self-service.test.js          PRODUCT/TEST（收缩 ≤500）
5. .agents/structure-registry.json                       GOVERNANCE_ONLY_STRUCTURE_REGISTRATION
```

PRODUCT_AND_TEST_FILES 成员（mechanical split design）：

| 文件 | 状态 | 结构上限 | 成员（mechanical split design） |
|---|---|---|---|
| `packages/scheduler/src/critical-job-guard.js` | **NEW** | ≤400 行（warning 线内） | `CRITICAL_GUARD_REASONS` / `DEFAULT_CRITICAL_INVENTORY_PATH` / `parseCriticalInventory` / `evaluateCriticalJobGuard` / `createCriticalJobGuard({store, criticalInventoryPath, readInventoryFile, onAuditFailure})` → `{ guardFor(operation, allowAny, captureCurrent)→assertFn, appendDenialAudit }`（guard + inventory load + denial evidence + locked-current assert 组合，AMENDMENT_1 的 authorization & evidence seam） |
| `packages/scheduler/src/self-service.js` | 收缩 | ≤500（structure baseline） | 移除上述成员（改为 import）；保留 schema/handler/projection/mutation-failure 面 |
| `packages/scheduler/test/critical-job-guard.test.js` | **RENAMED_TO** | ≤500 | `OLD_PATH = packages/scheduler/test/critical-self-disable-guard.test.js`；`DISPOSITION = RENAMED_TO packages/scheduler/test/critical-job-guard.test.js`——同一测试 artifact 的结构迁移（并补 R 面），不是新增第五个 product/test artifact |
| `packages/scheduler/test/self-service.test.js` | 收缩 | ≤500 | 移除 guard 专属测试（文件由 620 行收缩；rig 注入 fixture inventory 保留） |

GOVERNANCE_REGISTRY_FILES 登记授权（repair PR 中同步执行；registry 修改
**不得扩任何产品语义**）：

```text
packages/scheduler/src：21 + NEW critical-job-guard.js = 22
  → registry directories 条目 approved_max_children = 22
packages/scheduler/test：21 − 1（OLD_PATH 删除）+ 1（RENAMED_TO 加入）= 21
  → registry directories 条目 approved_max_children = 21
  （TEST_FILE_RENAME = YES；TEST_DIRECTORY_FINAL_CHILDREN = 21；
   不为两目录统一填 22）
reason = "AMENDMENT_2 structure closure; legacy directory over
DIRECTORY_MAX_CHILDREN(20) at baseline"
```

- 两个 legacy 收缩文件落地后 ≤500 ⇒ 自动退出 over-max 集合，无需 files 注册。
- 冻结的 split 原则：guard 逻辑隔离、guard 测试隔离、不为"少改一个文件"
  把 legacy 文件压成难维护的一团。

### B3. forensics delta 分立（FORENSICS_AUTHORITY_NOT_SMUGGLED）

`scripts/scheduler-cp-disable-forensics.mjs` 的 `self_service_denied`
EVENT_FIELDS 白名单一行**不属于**本产品 implementation closure。其 authority
basis 单独记录为：**SCHEDULER_CONTROL_PLANE_RELIABILITY_V1**（accepted；该
只读 disable-forensics 工具由该 goal 的实现链 **PR #222** 交付并迭代——
PR 分支 commits 94135d0/afc8c46/14efa85/fc5f53a，mainline 等价
6339f15/10dac1c/315031b/911767a——新证据类的渲染白名单属同一工具的取证面
维护）。AMENDMENT_2 不吸收、不扩产品 authority。

### B4. 冻结不变式（AMENDMENT_2 不得改变的行为）

```text
DEFAULT_CRITICAL_INVENTORY_PATH = /usr/local/libexec/agent-core/config/scheduler-desired-state.json
missing / unreadable / malformed / unsupported ⇒ critical_inventory_unavailable ⇒ self disable/remove denied
critical decision logicalKey == locked current job logicalKey == job version actually mutated
不恢复 unconfigured ⇒ inert；不恢复锁外 classification
watchdog 零触碰；NEW_MUTATION_SURFACE = NO；PRODUCTION_APPLY = NO
```

### B5. Acceptance 后的实现 repair 硬门（结构 repair PR 的 merge 前检查）

```text
focused behavioral tests（含 R1–R10 与 TOCTOU old-bug proof）
scheduler full suite
forensics selftest（经 B3 授权的范围内）
verify-code-structure：STRUCTURE_GATE = PASS（定义见 B6）
git diff --check
merge 前 fresh check：CODE_REVIEW = COMPLETED / SECURITY_REVIEW = COMPLETED /
  INLINE_UNRESOLVED_P1_PLUS = 0 / INDEPENDENT_AUDIT = PASS /
  STRUCTURE_GATE = PASS / TESTS = PASS / HEAD_UNCHANGED_SINCE_REVIEW = YES
```

### B6. STRUCTURE_GATE = PASS 的精确定义

`verify-code-structure` 对全仓为 repo 级扫描，而 **BASE_MAIN 自身即存在
与本 Goal 无关的存量违规**（`scripts/` 目录 53 children 超其注册上限 40；
scheduler 两目录在登记前为 UNREGISTERED_LEGACY_DIRECTORY）。因此冻结：

```text
STRUCTURE_GATE = PASS ⇔
  (a) repair PR 触碰的任何路径不产生 FILE/TOUCHED 类违规
      （四个 closure 文件全部 ≤ 各自上限）；
  (b) 违规集合相对 BASE_MAIN 的 delta 为空
      （不新增任何类；经 B2 登记的 scheduler 两目录违规清除）；
  (c) 存量 scripts/ 目录超限为已登记 repo 债务、不在本 Goal 触碰面内，
      明确 out of scope。
```

### B7. Acceptance criteria（independent semantic review 必答）

```text
PRODUCT_SEMANTIC_DELTA = NONE？
AMENDMENT_1_BEHAVIOR_PRESERVED = YES？（B4 全项冻结）
LOGICALKEY_CONSUMPTION_CONFLICT_CLOSED = YES？（B1 例外唯一且窄）
FILE_CLOSURE_CONFLICT_CLOSED = YES？（B2 清单冻结 + registry 授权）
STRUCTURE_SPLIT_AUTHORIZED = YES？（成员清单可机械执行）
FORENSICS_AUTHORITY_NOT_SMUGGLED = YES？（B3 分立记录）
STRUCTURE_GATE_DEFINITION_MECHANICAL = YES？（B6 可判定）
SHIP_BLOCKERS = 0？
```

任一 = NO/UNPROVEN ⇒ AMENDMENT = REVISE。

### B7a. Exact-head re-review 附加机械证明（本轮 MECHANICAL_REVISE 后的一次 re-review 必答）

```text
AUTHORIZED_CHANGED_PATHS_EXACT = YES（diff 恰为 B2 冻结的 TOTAL_AUTHORIZED_CHANGED_PATHS 集合，无更多）
PRODUCT_TEST_PATHS = 4
GOVERNANCE_REGISTRY_PATHS = 1
TOTAL_AUTHORIZED_PATHS = 5
SRC_CHILDREN_FINAL = 22
TEST_CHILDREN_FINAL = 21
REGISTRY_DOES_NOT_OVERAUTHORIZE_TEST_DIR = YES（test 登记 21 非 22）
OLD_GUARD_TEST_RENAMED_NOT_DUPLICATED = YES
PRODUCT_SEMANTIC_DELTA = NONE
SHIP_BLOCKERS = 0
```

### B8. Lifecycle

```text
accepted（Owner exact-head 2026-09-10 @ 6b5a41f）→ IMPLEMENTATION_REFACTOR 解除：
独立结构 repair PR（DRAFT while review running；B5 硬门全检后才 ready/merge）
```

acceptance 前 IMPLEMENTATION_REFACTOR = HOLD。

---

## AMENDMENT_3 — AMENDMENT_2_STRUCTURE_CLOSURE_RECONCILIATION (2026-09-10, status: accepted 2026-09-11)

> **状态**：`accepted`（2026-09-11，Owner EXACT-HEAD ACCEPTANCE：
> accepted_reviewed_head = a85b22b6128ce61917772306f717b8457d5fdb4c；
> INDEPENDENT_EXACT_HEAD_REVIEW = PASS；SHIP_BLOCKERS = 0）。
> 实现延续已激活（仅限 C2 冻结的结构 repair，独立 PR，B5 硬门全检）；
> PRODUCTION_APPLY = NO。本 Amendment 取代 AMENDMENT_2 B2
> 的 exact file closure（该 closure 被机械证明不可行，见 C1）并移除对被禁止的
> scheduler registry 例外的依赖；其余 AMENDMENT_2 内容（B1 consumption 例外、
> B3 forensics 分立、B4 冻结不变式）原样有效。

### C0. 机械 census（byte/line 级，2026-09-10 实测 @ origin/main b1fb7c0）

```text
CURRENT_LINES:
  packages/scheduler/src/self-service.js               = 755
  packages/scheduler/test/self-service.test.js         = 620
  packages/scheduler/test/critical-self-disable-guard.test.js = 370
  packages/scheduler/src immediate children            = 21 （> 20，未登记且
                                                          CODE_STRUCTURE_GUARDRAILS_V1
                                                          §6/§7 禁止 post-baseline 登记）
  packages/scheduler/test immediate children           = 21 （> 20，同上）

REGISTRY 基线事实（.agents/structure-registry.json，baseline_commit d506f81）：
  LEGACY_DIRECTORY_OVER_20 = scripts/ only；
  self-service.js 在 baseline 不存在（0 lines）⇒ POST_BASELINE_FILE_GRANDFATHERED = NO；
  scheduler/src、scheduler/test 在 baseline 均 <= 20 ⇒ POST_BASELINE_DIRECTORY_
  GRANDFATHERED = NO。AMENDMENT_2 授权的 src=22/test=21 registry 条目违反
  §6/§7，由本 Amendment 撤销（B5），最终实现不得依赖任何 scheduler registry 例外。

IMPORT/CALL-SITE CENSUS（谁 import src/self-service.js）：
  packages/production-runtime/src/compose.js        = 500（恰在上限，触碰即险）
  packages/scheduler/test/cross-agent.test.js       = 522（post-baseline、
                                                       未登记、不可 grandfather ⇒
                                                       任何触碰即违规 ⇒ 必须零触碰）
  packages/broker/test/scheduler-reliability.test.js = 459
  packages/scheduler/test/self-service.test.js       = 620（本 Amendment 内拆分/迁移）
  packages/scheduler/test/critical-job-guard.test.js = 370（本 Amendment 内更名/迁移）
  ⇒ 兼容 shim（B2）使前三个 importer 零触碰。

IMPORT/CALL-SITE CENSUS（history 家族，宽度收缩的承载面）：
  src 内部 importer：occurrence.js(499)、history-projection.js(208)、
    index.js(49)、history-storage.js(143)、history.js(451, 自身)
  test importer：scheduler-history.test.js(134)、history-durability.test.js(107)、
    history.test.js(484)
  包外 importer：scripts/agentcore-cron.mjs(516, post-baseline 不可
    grandfather)、packages/product-api/test/scheduler-api.test.js(366)
  ⇒ 全部 <= 500（除 agentcore-cron.mjs 516——经 src/history.js 兼容 barrel
    零触碰处置，见 C2/C2a）。
  occurrence 家族（15 importers）因改写面过大被否决；store/ 因 importer 面过
  大被否决。history/ 迁入 = 四模块（history-model/history-projection/
  history-sink/history-storage）；src/history.js 与 src/self-service.js 同为
  原位兼容 barrel（REMOVED=NO）。src 根 = 21 − 4 + 2 = 19 ≤ 20（与 C2/
  FINAL_IMMEDIATE_CHILD_COUNT 一致）。
```

### C1. AMENDMENT_2 closure 不可行的精确算术（MECHANICAL_LINE_ARITHMETIC 输入）

```text
self-service.js = 755；冻结成员清单移动量 = 147（critical-job-guard.js 实测）
755 − 147 = 608 > 500（608 为纯扣减下限；#256 分支实测 639 含 access glue 与
  保留的 schema/projection 面调整）
进一步移动非冻结成员（wire-proof 24 + appendAudit 22 + expectedRevision 22 +
  validationFailure 10 + mutationFailure 26 + definitionDigest 13 + err/nonEmpty/
  trustedCaller 22 ≈ 139）→ ~470-500 临界，但扩成员 = 偏离 AMENDMENT_2 冻结清单
  （Owner 已拒绝该路径的临场自扩）
tests：620 + 370 = 990 vs 2×500 = 1000 ⇒ 名义余量 10 行，而 harness 耦合
  （被迁移测试依赖 self-service rig/trusted）使任何整簇迁移都需要 glue ≥15 行
  ⇒ 双 ≤500 不可同时成立（#256 实测：拆分后 self-service.test.js 仍 620，
  critical-job-guard.test.js 370）
```

### C2. NEW_EXACT_AUTHORIZED_PATHS（取代 AMENDMENT_2 B2 的 exact file closure）

OLD_AUTHORIZED_PATHS（被取代）：AMENDMENT_2 B2 表所列 TOTAL_AUTHORIZED_CHANGED_
PATHS = 5 记账（其中 registry 条目按 B5 撤销；self-service.js/self-service.test.js
的 ≤500 目标按 C1 由本 Amendment 的物理拆分实现）。

RENAMES：
```text
packages/scheduler/test/critical-self-disable-guard.test.js
  → packages/scheduler/test/self-service/critical-job-guard.test.js
```

NEW_FILES：
```text
packages/scheduler/src/self-service/index.js        （公共面 barrel，≤30）
packages/scheduler/src/self-service/access.js       （factory+handlers+wire
  proofs+mutation audit+ownership 组合，≤500）
packages/scheduler/src/self-service/schema.js       （expectedRevision/schedule/
  payload/delivery/mutation-failure，≤250）
packages/scheduler/src/self-service/projections.js  （digest/public/occurrence/
  normalized/committed 投影，≤150）
packages/scheduler/src/history/                     （history-model.js /
  history-projection.js / history-sink.js / history-storage.js / history.js
  五模块迁入——history.js 内容体迁为 history/history.js，原路径 src/history.js
  原位改写为 ≤60 行兼容 barrel（REWRITTEN_IN_PLACE，REMOVED=NO），使
  agentcore-cron.mjs（516，post-baseline 不可 grandfather）与
  product-api/test/scheduler-api.test.js 零触碰；
  HISTORY_LOGIC_SEMANTICS = BYTE/SEMANTICALLY UNCHANGED EXACT except relative
  import-specifier rewrites（完整 outbound import census 与改写映射见 C2a）；
  每文件 ≤500 维持现状）
packages/scheduler/test/self-service/harness.js     （共享 trusted/双 rig
  fixture，≤150）
```

DISPOSITIONS：
```text
packages/scheduler/src/self-service.js
  DISPOSITION = REWRITTEN_IN_PLACE_TO_COMPAT_BARREL（REMOVED = NO；FINAL_LINES ≤ 60，
  BARREL_MAX_LINES=60/REEXPORTS=20 合规）
packages/scheduler/test/critical-self-disable-guard.test.js
  DISPOSITION = RENAMED_TO packages/scheduler/test/self-service/critical-job-guard.test.js
```

FINAL_LINE_COUNT_BUDGET_PER_FILE（预算上限；实现实测不得超）：

```text
src/self-service/index.js                 ≤ 30
src/self-service/access.js                ≤ 500
src/self-service/schema.js                ≤ 250
src/self-service/projections.js           ≤ 150
src/self-service/critical-job-guard.js    ≤ 400（实测 147）
src/self-service.js（compat barrel）      ≤ 60（BARREL 规则）
src/history/*（5 文件，verbatim 迁移）     = 现状 451/202/208/143/31
test/self-service/self-service.test.js    ≤ 500
test/self-service/critical-job-guard.test.js ≤ 500
test/self-service/harness.js              ≤ 150
```

FINAL_IMMEDIATE_CHILD_COUNT：
```text
src 根 = 21 − 4×history 模块(迁入 history/：history-model/history-projection/
            history-sink/history-storage) + 1×history/ 目录
            + 1×self-service/ 目录 + 0（src/history.js 与 src/self-service.js
              双 barrel 均原位保留）
        = 21 − 4 + 2 = 19 ≤ 20
test 根 = 21 − 2×(RENAME 一减一增) + 1×self-service/ 目录 = 20 ≤ 20
src/self-service/ 子目录 immediate children = 5（index/access/schema/
  projections/critical-job-guard）；test/self-service/ = 3（均 ≤20）
```

C2a. 迁入文件的 outbound import census（五文件全量，逐条分类）：

| 迁入文件 | 相对导入 | 分类 | 迁入后 specifier |
|---|---|---|---|
| history/history.js（原 src/history.js 迁入） | `./lock.js` | ROOT_SIBLING | `../lock.js` |
| history.js | `./history-model.js`（×2 处） | HISTORY_FAMILY_INTERNAL | `./history-model.js`（不变） |
| history.js | `./history-projection.js` | HISTORY_FAMILY_INTERNAL | 不变 |
| history.js | `./history-storage.js` | HISTORY_FAMILY_INTERNAL | 不变 |
| history/history-projection.js（迁入） | `./occurrence-model.js` | ROOT_SIBLING | `../occurrence-model.js` |
| history-projection.js | `./history-model.js` | HISTORY_FAMILY_INTERNAL | 不变 |
| history-storage.js | `./history-model.js` | HISTORY_FAMILY_INTERNAL | 不变 |
| history-storage.js | `./history-projection.js` | HISTORY_FAMILY_INTERNAL | 不变 |
| history-model.js / history-sink.js | （无相对导入） | — | 无改写 |

```text
ROOT_SIBLING_REWRITES = 恰 2 处（history.js→../lock.js、
  history-projection.js→../occurrence-model.js）；其余全为
  HISTORY_FAMILY_INTERNAL（同目录共迁，路径不变）。
HISTORY_LOGIC_SEMANTICS = BYTE/SEMANTICALLY UNCHANGED EXCEPT 上表 exact
  relative import-specifier rewrites；history 五文件禁止任何 functional code edit。
```

IMPORT_REWRITE_SURFACE（exact，两类合计，全部为纯路径改写）：

```text
(i) 迁入文件内部的 ROOT_SIBLING 改写：恰 2 处（C2a 表）
(ii) 外部 importer 的路径改写：
  src：occurrence.js（./history-sink.js → ./history/history-sink.js；
    ≤499 保持）；
    self-service 子目录内部互引（./schema.js 等）
  test：self-service.test.js 与 critical-job-guard.test.js（../src/self-service.js
    → ../../src/self-service.js 兼容 barrel 或 ../index.js；harness 共享导入）
UNTOUCHED（双 barrel 保证零触碰）：compose.js（恰 500）、cross-agent.test.js
  （522）、scheduler-reliability.test.js（459）、index.js（./history.js barrel
  路径不变）、scheduler-history.test.js、history-durability.test.js、
  history.test.js（../src/history.js barrel 路径不变）、
  scripts/agentcore-cron.mjs（516，post-baseline 不可 grandfather——
  src/history.js barrel 使其零触碰）、product-api/test/scheduler-api.test.js
UNDECLARED_IMPORT_REWRITE = 0（(i)+(ii) 即完整闭包；agentcore-cron.mjs 与
  product-api 测试两处 history.js importer 的零触碰处置冻结于 frontmatter
  acceptance 记录与本节（src/history.js 兼容 barrel），C2a 表为迁入文件内部
  census）
```

TEST_MOVE_MAP（迁入 test/self-service/critical-job-guard.test.js 的簇，断言
一删不减，仅 harness 改绑；TEST_MOVE_SOURCE_LINES = 147，为审查实测精确值）：
```text
'ownership is rechecked inside the locked control mutation (TOCTOU fails closed)'
'locked update preserves concurrently changed omitted fields and audits the
 exact preimage'
'live post-rename fault returns known committed projection and attempts one
 audit append'
'pre-commit failure is known clean; uncertain commit failure is outcome-unknown
 with zero retry'
'audit append failure returns known committed result, logs sanitized
 coordinates, and does not retry'
'mutation audit is one sanitized append per committed mutation'
（六簇合计 = 147 源行，self-service.test.js 行 431-577 区间实测）
```

TEST_LINE_ALLOCATION（exact budget proof；行数贡献为机械 census 实测值）：

```text
SOURCE_TEST_LINES_MOVED = 147

HELPERS_MOVED_TO_HARNESS（迁入 test/self-service/harness.js，自两测试文件
  吸收去重；行贡献为机械 census 实测）：
  trusted（unified superset：self-service 版 15 行为基准，guard 版 9 行被吸收）= 15
  rig（self-service 变体）      = 31
  rig（critical-guard 变体，签名不同，双变体并存） = 28
  createAtArgs                = 13
  storedDefinitionDigest      = 5
  assertExactCommittedResult  = 16
  inventoryFile（自 critical-job-guard.test.js 吸收） = 9
  criticalManifest（自 critical-job-guard.test.js 吸收） = 2
  imports/小节注释             ≈ 8
  HARNESS 合计 ≈ 127 ≤ HARNESS_FINAL_BUDGET(150) ✓

预算法不等式（MAX_AUTHORIZED_GLUE = 6 行/文件 = import 与改绑行）：
  self-service.test.js：
    620 − 147（迁出簇） − 80（helpers 迁出：15+31+13+5+16） + 2（glue） = 395 ≤ 500 ✓
  critical-job-guard.test.js：
    370 − 48（本地 helpers 被吸收：rig 28 + trusted 9 + inventoryFile 9
      + criticalManifest 2） + 147（迁入簇） + 6（glue） = 475 ≤ 500 ✓
  harness.js：≈ 127 ≤ 150 ✓
  断言一删不减：两不等式均在「迁入簇 147 行逐字保留（仅 rig/trusted 调用改绑
  到共享 harness）」前提下成立；无需发明新测试簇、无需删除断言。
```

### C3. 兼容 barrel（UNTOUCHED 承诺的机制）

`src/self-service.js` 保留为 ≤60 行 barrel（`export { createSelfServiceSchedulerAccess }
from './self-service/index.js'` 及现被外部引用的具名导出）。compose.js（恰 500）、
cross-agent.test.js（522，post-baseline 不可 grandfather）、scheduler-reliability
.test.js（459）因此**零触碰**。barrel 为 B2 表的 `src/self-service.js` 行
（≤60，BARREL 规则合规），不承载任何逻辑。

### C4. 行为冻结（与 AMENDMENT_2 B4 同一清单，逐字有效）

固定默认 inventory 路径 / unavailable ⇒ fail-closed / locked-current 分类 /
不恢复 unconfigured-inert 与锁外分类 / WATCHDOG_AUTO_REPAIR=NO / 零新 mutation
面 / guard 内聚（critical-job-guard.js 仅承载 AMENDMENT_1 授权的 guard 责任，
不吸收非 guard 成员）/ 断言一删不减（TEST_MOVE_MAP 仅改绑定）/ B1/B2 repaired
behaviors 全保持 / PRODUCTION_APPLY = NO。

### C5. STRUCTURE_GATE = PASS（机械定义，取代 AMENDMENT_2 B6）

```text
STRUCTURE_GATE = PASS ⇔
  (a) 触碰/新增/更名路径全部 ≤ 各自 B2 预算（上表）；
  (b) verify-code-structure 违规集合相对 BASE_MAIN 的 delta：scheduler src/test
      两目录类清除（根宽 19/20 无需登记），无任何新增类；
      存量 scripts/ 超限（实测 59 > 注册 40）= BASE_MAIN 已登记债务、不在触碰
      面内，out of scope（与 AMENDMENT_2 B6(c) 同一裁定）；
  (c) registry：零 scheduler 相关条目、零无关归一化（\u00a7 类转义保持原样）。
```

### C6. Acceptance criteria（independent review 必答）

```text
PRODUCT_SEMANTIC_DELTA = NONE
CODE_STRUCTURE_GUARDRAILS_V1_PRESERVED = YES
POST_BASELINE_FILE_GRANDFATHERED = NO
POST_BASELINE_DIRECTORY_GRANDFATHERED = NO
ALL_NEW_FILES_LE_500 = YES
ALL_TOUCHED_FILES_LE_500 = YES
SRC_IMMEDIATE_CHILDREN_LE_20 = YES（实测 19；+1 = src/history.js 兼容 barrel
  原位保留，见 C2/B5）
TEST_IMMEDIATE_CHILDREN_LE_20 = YES（实测 20）
CRITICAL_GUARD_COHESION_PRESERVED = YES
TEST_ASSERTION_COVERAGE_REDUCED = NO
EXACT_PATH_CLOSURE = YES
MECHANICAL_LINE_ARITHMETIC = CLOSED
NEW_PRODUCT_AUTHORITY = NO
SHIP_BLOCKERS = 0
```

任一 = NO/UNPROVEN ⇒ AMENDMENT = REVISE。

### C7. Lifecycle

```text
accepted（Owner exact-head 2026-09-11 @ a85b22b）→ IMPLEMENTATION_CONTINUATION
解除：结构 repair 在 C2 冻结授权路径上执行（独立 PR，DRAFT while review
running；B5 硬门 + 扩展 merge 纪律全检）。
PR #256 保持 DRAFT（WIP evidence，REVIEW/MERGE HOLD）。
