# agt-prep-session-messaging-investigation-v1 — Round Report

- goal: PRODUCTION_RND_PARALLEL_PREPARATION_V1, LANE_1 = AGENT_SESSION_MESSAGING (PREPARATION TRACK)
- BASE commit: `840d2f4ad91f8252eb1f163330c041216a0dd9c4` (github/main tip), branch `prep/session-messaging-investigation-v1`
- date: 2026-09-02

## Task

Static investigation of the broker capability pipeline and Session/Run model at BASE; spec-vs-code audit of the local untracked draft `docs/specs/AGENT_CORE_AGENT_SESSION_MESSAGING_V1.md` (r2, proposed, implementation_authority none); authority determination; gap census. No code changes, no test runs, no installs, no network.

## Method

1. Read the draft specimen + related drafts (`AGENT_CORE_AGENT_WAKE_CAPABILITY_V1.md` gap analysis, `AGENT_WORKSPACE_SESSION_MODEL_V3.md`) in the maintainer checkout (read-only).
2. Read BASE code in the dedicated worktree: `packages/broker/src/{index,registry,schema,mapping,relay,transport,gateway,identity}.js`, `capabilities/agent-definition.js`, `packages/agent-router/src/{index,ingress-delivery,parent-rpc-relay}.js`, `process/turn-execution.js`, `process/evidence-buffer.js`, `reconciliation/{query,state-machine,store}.js`, `packages/demo-server/src/{index,session-seam}.js`, `packages/scheduler/src/self-service.js`, `packages/production-runtime/src/compose.js`, accepted decisions V2/V3, `process-delivery.test.js`, `relay.test.js`.
3. Repo-wide grep for `agent_session_send` variants. Every claim recorded with file:line in `docs/investigations/AGENT_SESSION_MESSAGING_PREP_INVESTIGATION_V1.md`; verbatim excerpts in `evidence/session-messaging-code-excerpts.md`.
4. Methodological correction made mid-round: a few greps initially ran with relative paths and hit the maintainer checkout instead of the worktree; all affected evidence points (transport.js `requestAccessToken`, scheduler self-service audit pattern, capabilities dir listing) were re-verified against the worktree with absolute paths before use. The maintainer checkout was never modified.

## Findings summary

- **agent_session_send zero-implementation: CONFIRMED.** Only doc mentions (accepted D-008/V3 at `docs/decisions/AGENT_WORKSPACE_SESSION_MODEL_V3.md:384,981`); zero code hits.
- 24 findings: **0 blockers, 1 major, 5 minor, 18 notes.** Every infrastructure claim the r2 spec makes about current main held up: relay local-capability support already fixed at BASE (`relay.js:153-155` — the WAKE-era relay.js:64/index.js:182 blockers are resolved), reconciliation seams, bounded FIFO busy semantics, receipt semantics, target-owned execution identity, fail-closed grant ordering.
- Major finding F10: the spec's §2.2 decision-alignment gate is stale — accepted D-008 / AGENT_WORKSPACE_SESSION_MODEL_V3 (in BASE, supersedes V2 whole) already freezes `AGENT_TO_AGENT_MESSAGING_SESSION_SCOPE = TARGET_MAIN` and names `agent_session_send`, deferring implementation (V3 §29). Spec needs a docs-only revision (verdict **REVISE — 0 blockers**).
- Minors: MOD-list omission (broker/src/index.js resolver is a closed two-service merge), byte-length/NUL validation must live in the trusted handler (broker schema cannot express it), R8 mapping missing `terminated_without_outcome`, L0/L1 audit surface is new code (scheduler precedent exists), §5 taxonomy missing `transport_failure`/`unsupported_operation`.
- Gap census: 14 gaps — 7 infrastructure (provenance sidecar, wait helper, handler provider, manifest, deliver-source correlation, audit surface, gateway re-validation scope), 3 spec, 1 authority, 3 test.

## Authority / terminal state

- Draft spec is `status: proposed`, `implementation_authority: none`, absent from github/main (local untracked file); accepted D-008 records it as read-only proposed input. Investigation + draft-spec work allowed; **candidate implementation = PAUSED_AUTHORITY, MUST NOT start this round.**

## Deliverables (committed on `prep/session-messaging-investigation-v1`)

1. `docs/investigations/AGENT_SESSION_MESSAGING_PREP_INVESTIGATION_V1.md` — sections A–D, all claims with file:line.
2. `docs/reports/agt-prep-session-messaging-investigation-v1.md` — this report.
3. `evidence/session-messaging-code-excerpts.md` — verbatim code excerpts backing the key findings.

## Boundaries honored

- Wrote only inside the worktree; maintainer checkout read-only (no writes); no git operations beyond local `git add` of the three created files + commit on the prep branch; no push/remote/stash/reset/checkout.
- No launchctl/sudo/osascript; no production services/ports/databases; no contact with `/usr/local/libexec/agent-core` or the workflow-transition goal state root.
- No npm install, no test-suite runs, no network installs; static analysis only (Read/grep/sed).
- `packages/broker/src/capabilities/workflow.js` untouched (not read, not referenced in proposals).

## TASK_STATUS

- INVESTIGATION: **COMPLETE**
- IMPLEMENTATION: **PAUSED_AUTHORITY**
- Blockers: none for this investigation round. Spec verdict REVISE (0 blockers, 1 major — stale §2.2 decision gate vs accepted D-008/V3; docs-only fix).
