---
spec_id: AGENT_CORE_DEVELOPMENT_EXECUTION_SURFACE_V1
title: Development Execution Surface — shared, backend-abstracted coding-executor capability (development_execute) for any authorized agent, with system-owned execution state, repo/worktree authority, and session-centric trace correlation
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
repo: mayf3/dsh-agent-core
date: 2026-09-24
candidate_base: 2a85d0659157a3bab649239158744d5222d86afe (origin/main)
revision: r1
mandate: >-
  GOAL = DEVELOPMENT_EXECUTION_SURFACE_V1 (Owner mandate 2026-09-24): a generic
  development execution surface reusable by ALL agents, so workflow-assigned
  development agents can run real coding executors inside authorized repos and
  isolated worktrees. ZERO agent-specific product code (no agt_cto-agent /
  研发总监 hardcode, endpoint, execution path, or deployment path). REUSE FIRST.
governed_by:
  - AGENT_CORE_WORKFLOW_AGENT_EXECUTION_V2 (accepted)
  - AGENT_CORE_SESSION_CENTRIC_EXECUTION_TRACEABILITY_V1 (accepted)
  - AGENT_CORE_EXECUTION_HISTORY_QUERY_V1 (accepted)
  - AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V4 (accepted; local multi-op tool precedent)
  - AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1 (accepted)
  - AGENT_CORE_FLEET_SHARED_CODEX_AUTH_ACTIVATION_V1 (accepted)
related_repos:
  - repository: mayf3/svc-workflow
    relation: UNCHANGED (Workflow stays backend-agnostic; no svc change in this Spec)
  - repository: mayf3/agent-forum
    relation: UNCHANGED
---

# AGENT_CORE_DEVELOPMENT_EXECUTION_SURFACE_V1

## 0. Intent and current-state census (reuse-first)

The Workflow execution spine already delivers real Runs to real agent sessions
(Router `deliver` → `@deepseek-ai/dsh` coding-CLI child, cwd = agent workspace,
ownership token, parent-RPC broker tools). What does NOT exist is a GOVERNED way
for such an agent to run a coding executor against an AUTHORIZED repo in an
ISOLATED worktree with SYSTEM-OWNED execution state. This Spec adds exactly
that, as a shared surface, reusing every mechanism that already exists.

Census results frozen at mandate time (evidence in the Goal record):

1. Agent session execution today: Router → dsh CLI child (`DSH_PERMISSION_MODE`,
   per-agent home/workspace) — the agent process is itself a coding harness;
   it has no governed second-executor path.
2. Codex real entry: `codex exec` (codex-cli 0.153.4): `-C <dir>`,
   `-s <read-only|workspace-write|danger-full-access>`, `--json` (JSONL events),
   `-o <file>`, `-c key=value`, `resume <SESSION_ID>`, `--skip-git-repo-check`,
   `--ephemeral`. Auth = ChatGPT-subscription OAuth store pointed at via
   `CODEX_HOME`.
3. ZCode: NO CLI automation entry exists on this machine (`~/.zcode` is desktop
   app config/data only) → **HONEST_GAP**; no fake executable may be invented.
4. Reusable adapters: `codex exec` (primary); `opencode run` (proven by
   six-pack nightly); `qoder -p` (scriptable, vendor-coupled). Precedents:
   agent-six-pack-runtime ProcessAdapter command-template + per-role git
   worktrees (`gitx.py`); dsh-codex (provider plugin, not an executor);
   codex-remote rpc.mjs (app-server protocol, paused).
5. Safe local path for agents today: broker LOCAL capabilities are in-process
   only (self_ops, execution-history); NO broker capability spawns an OS
   process today.
6. Repo/worktree isolation: NO canonical mechanism exists in this repo
   (sixpack's gitx.py is an external precedent, not a shared authority).
7. Trace spine reusable as-is: `(agentId, sessionId)` anchor, ledger
   coordinates (`workflowInstanceId`, `nodeVisitId`, `requestId`,
   `reconciliationHandle`, `messageId`), read-time correlation (R1–R9, no
   second history ledger), `writeEvidence` appends, `execution_trace_query` /
   `execution_history_audit_query` read capabilities.

REUSE FIRST verdict: new code is limited to (a) a DevelopmentExecution state
ledger for THIS surface, (b) a worktree authority manager, (c) a Codex backend
adapter, (d) the `development_execute` broker manifest + local provider wiring.
Everything else is consumed as-is.

## 1. Architecture boundary (frozen)

```
Feishu → ordinary Agent → Workflow Definition / Instance
      → existing Workflow Agent Execution (unchanged)
      → assigned Agent session (unchanged)
      → development_execute capability (NEW, shared)
      → coding backend adapter (NEW)
      → Codex today; ZCode/future via the same adapter contract
```

Forbidden: Workflow → Codex direct; Workflow → ZCode direct; any product
branch on `agentId`, `role`, or persona (no `agt_cto-agent` / 研发总监
literals anywhere in product code). Workflow Definitions must not contain CLI
commands, shell commands, credential paths, backend names, or backend session
internals. svc-workflow is UNCHANGED by this Spec.

## 2. CTR-DES-001 — `development_execute` capability surface

ONE broker manifest (`id: development_execute`, `toolName: development_execute`),
LOCAL capability (`local: { resource: 'development-execution' }`), following the
self_ops unified-tool precedent. Operations:

- `start`: args `{ repo, baseSha, task, branch? , constraints? }`. System
  derives everything else. Returns `{ executionId, state, worktree, backend }`.
- `status`: args `{ executionId }` → current state record (read-only).
- `continue`: args `{ executionId, instruction }` → resumes/steers a
  WAITING/RUNNING execution via the backend adapter.
- `cancel`: args `{ executionId }` → exactly one terminal disposition
  (`CANCELLED`), idempotent.
- `result`: args `{ executionId }` → terminal receipt (§4); non-terminal
  executions return current state + `terminal: false`.

Authorization: `requiredScopes: ['development.execute']` checked by the
gateway exactly like self_ops (auth-service token for resource
`development-execution`; fail-closed `access_denied`). The caller identity is
the trusted relationship (`callerAgentId`), never an argument. Production
rollout registers the `development-execution` resource + scope in auth-service
(deployment note, §12); test environments mint it from their JWKS authority.

## 3. CTR-DES-002 — system-owned execution identity, state, receipts

State ledger: `<productionRoot>/dev-execution/executions.jsonl`, append-only,
one JSON line per state transition — the same single-surface state-authority
pattern as the workflow attempts ledger. It is NOT a second execution-HISTORY
ledger: it holds only this surface's own execution facts, and history/query
correlation stays read-time (§6).

State vocabulary (aligned with existing process/attempt semantics):
`QUEUED, STARTING, RUNNING, WAITING, SUCCEEDED, FAILED, CANCELLED,
OUTCOME_UNKNOWN`. `SUCCEEDED/FAILED/CANCELLED/OUTCOME_UNKNOWN` are terminal;
exactly one terminal transition per execution.

Execution record (readable via status/result):
`executionId, backend, state, agentId (caller, from trusted context), repo,
worktree, baseSha, branch, startedAt, updatedAt, terminalAt?, candidateSha?,
changedFiles?, testEvidence?, reviewEvidence?, errorClass?, idempotencyKey`.
Workflow coordinates (`workflowInstanceId`, `nodeVisitId`, `agentSessionId`)
are NEVER taken from tool arguments; when present they are derived at READ
TIME from the session journal + run_delivered ledger (§6).

Idempotency: `start` accepts an optional system-side dedupe key; duplicate
`start` with the same (caller, idempotencyKey) returns the ORIGINAL execution
(no second execution). The transport-level trusted-zone Idempotency-Key is not
reused for this (broker local calls do not carry it); the dedupe key is a
manifest argument hashed with the caller identity, and the ledger is the
dedupe authority.

Terminal receipt (result on terminal state): `executionId, backend,
terminalState, repo, worktree, baseSha, candidateSha?, changedFiles[], tests
{ran, passed?, evidenceRefs[]}, startedAt, terminalAt, failureClass?,
evidenceRefs[]`. Evidence rules: candidate SHA only from the backend's own
git output observed by the adapter; tests only from observed executor output;
`OUTCOME_UNKNOWN` when a terminal disposition cannot be proven (crash without
evidence). Forbidden: "process gone ⇒ failed", "no output ⇒ success",
"agent says done ⇒ success".

## 4. CTR-DES-003 — backend adapter contract

Adapter interface (in-process): `start(task, workspace, constraints)`,
`status(executionId)`, `continue(executionId, instruction)`,
`cancel(executionId)`, `result(executionId)`. All backend specifics — process
lifecycle, CLI argv, provider session ids, credentials, stdout/stderr parsing —
live inside the adapter. The surface, manifest, ledger, and callers never see
backend argv.

Codex backend (production-intended, real): adapter spawns the PINNED codex
binary (`codex exec --json -C <worktree> -s workspace-write
--skip-git-repo-check -o <last-message-file> [-c profile overrides] [task]`),
with `CODEX_HOME` pointing at the Operator-provisioned backend credential home.
Pinning: the binary path + minimum version come from system config
(`dev-execution/backend.json`, Operator-managed, same pattern as
agent-model-overrides.json); the adapter refuses to execute an unconfigured or
version-mismatched binary. `continue` uses `codex exec resume <SESSION_ID>`
with the session id the adapter captured from `--json` events. Sandbox:
`workspace-write` — writes confined to the worktree + temp; the adapter never
passes `danger-full-access` or any approval-bypass flag.

ZCode: **HONEST_GAP** — no stable CLI automation entry exists; no adapter is
shipped for it in this revision. The adapter seam accepts future backends
without surface changes.

## 5. CTR-DES-004 — workspace / repository authority

`development_execute` never grants arbitrary machine execution.

- Repo allowlist: `<productionRoot>/dev-execution/repos.json`
  (Operator-managed): `{ repos: [{ name, path (exact local bare/checkout
  path), allowedBranchPrefixes[], maxWorktrees }] }`. `start` refuses any repo
  not in the allowlist (`repo_not_authorized`), any baseSha not reachable in
  that repo (`base_sha_unknown`), and refuses when worktree capacity is
  exhausted.
- Worktree isolation: every execution gets a FRESH git worktree
  `<productionRoot>/dev-execution/worktrees/<executionId>` created from the
  exact `baseSha` in the authorized repo (git worktree add; verified HEAD ==
  baseSha before the backend starts). Writable paths = that worktree only
  (enforced by the codex sandbox). No worktree reuse across executions.
- Governance preserved: the backend may modify the worktree, run
  repo-authorized tests, and create candidate commits. It may NOT touch
  production runtime, production credentials, deployment surfaces, other
  repos/paths, or escalate. Production deployment remains exclusively with the
  Deployment Control Plane / Deployment Agent.

## 6. CTR-DES-005 — session-centric traceability integration

SESSION_CENTRIC_EXECUTION_TRACEABILITY_V1 is reused, not re-implemented:

- The execution record carries the caller anchor `agentId` (trusted context)
  and the execution's own coordinates (`executionId`, `worktree`, `baseSha`,
  `candidateSha`).
- Read-time correlation (no second ledger, no model-supplied facts):
  `development_execute.start` calls are recorded in the caller's session
  journal by the harness; the journal tool-call coordinate + the ledger line
  resolve DevelopmentExecution → Agent Session. When the session's current
  turn originated from a workflow Run, the existing journal ↔ instruction ↔
  `run_delivered` correlation yields `workflowInstanceId` / `nodeVisitId` /
  `agentSessionId` — derived, never agent-asserted. Reverse correlation
  (candidateSha → execution → session → visit → instance) uses the same joins.
- Additive only: `execution_trace_query` MAY gain a DevelopmentExecution
  loader in a later revision; this revision ships the ledger + correlation
  joins without changing the query contract.

## 7. CTR-DES-006 — security and credentials

- The backend credential (ChatGPT-subscription OAuth for Codex) lives only in
  the Operator-provisioned `CODEX_HOME` of the backend adapter. It never
  enters: model prompts, Workflow Definitions, instance input, Forum, ordinary
  receipts, or the repo. No per-agent copy is created by this surface.
- All backend invocation uses the system-selected pinned executable
  (`backend.json`). Tool arguments may NOT carry: binaryPath, credentialPath,
  arbitrary env, shell, sudo, deployment commands — the manifest
  `additionalProperties: false` argument schemas structurally refuse them.
- The adapter runs the backend with a scrubbed environment (no broker
  credentials, no AGENT_CORE_CREDENTIALS_FILE, no auth-service secrets).

## 8. CTR-DES-007 — failure and recovery semantics (test matrix)

| Case | Scenario | Required outcome |
|---|---|---|
| A | backend completes | `SUCCEEDED` + receipt with candidateSha/changedFiles |
| B | backend exits non-zero with evidence | `FAILED` + structured failure evidence |
| C | backend exceeds time limit | terminal per classification (timeout ⇒ `FAILED`, failureClass `timeout`) |
| D | backend crash, result unprovable | `OUTCOME_UNKNOWN` — never fabricated success/failure, no auto-retry |
| E | cancel | exactly one terminal disposition `CANCELLED`; idempotent second cancel |
| F | restart of the owning process | status/result re-queryable from the ledger, no chat context needed |
| G | duplicate start (same caller+dedupe key, incl. transport retry) | ONE execution; second call returns the original executionId |

## 9. Explicit non-goals

No agt_cto-agent / 研发总监-specific logic; no Feishu entry changes; no
FEATURE_DEVELOPMENT Definition; no Workflow routing; no auto-merge; no
deployment; no Deployment Control Plane changes; no second workflow engine; no
second execution-history ledger; the model is never the execution-state
authority; no ZCode fabrication.

## 10. Test obligations

- Ledger: state transitions, exactly-one-terminal, restart recovery (F).
- Idempotency: duplicate start single-execution (G), cancel idempotent (E).
- Backend adapter (fake backend binary for hermetic tests): success (A),
  failure evidence (B), timeout classification (C), crash ⇒ OUTCOME_UNKNOWN (D).
- Worktree authority: unauthorized repo refused; wrong baseSha refused;
  worktree created at exact baseSha; capacity refusal; worktree removed only
  per retention, never mid-run by another execution.
- Security: manifest rejects binaryPath/credentialPath/env/shell args;
  adapter env carries no broker/agent credentials; sandbox flag pinned to
  workspace-write.
- Broker: manifest inventory updated; gateway scope fail-closed (no token ⇒
  access_denied).
- Zero-persona sweep: no agentId/role literals in the new packages.

## 11. Dogfood obligation (acceptance evidence)

One isolated, non-production real repo + real Codex E2E: authorized agent
identity → development_execute.start → real `codex exec` modifies code in the
worktree → runs the repo's tests → candidate commit → development_execute.result
with candidateSha + test evidence. Must additionally demonstrate: (1) agent
never sees backend CLI; (2) no workflow/backend coupling; (3) status re-query
after owning-process restart; (4) candidateSha ↔ execution ↔ session
correlation holds; (5) zero production mutation; (6) a SECOND ordinary test
agent identity performs the identical flow with ZERO product-code change —
this is the key acceptance: if only one specific agent works, the Goal FAILS.

## 12. Deployment notes (production rollout, out of scope for merge)

- auth-service: register resource `development-execution` + scope
  `development.execute`; grant to authorized agent principals via the existing
  provisioning authority.
- Operator provisions `dev-execution/repos.json` (allowlist),
  `dev-execution/backend.json` (pinned codex binary + version + CODEX_HOME
  path). CODEX_HOME credential provisioning is an Operator action (ChatGPT
  subscription OAuth); the fleet per-agent-store rule is not violated because
  the backend executor is a single system service, not an agent persona —
  Owner may revisit under the FLEET_SHARED_CODEX_AUTH governance if needed.
- `dev-execution/worktrees/` retention is Operator-managed; this Spec defines
  creation/isolation only.
