# agt-prep-session-spec-revision-v1

- goal: PRODUCTION_RND_PARALLEL_PREPARATION_V1 — LANE_1 AGENT_SESSION_MESSAGING (PREPARATION TRACK)
- task: revise draft spec `AGENT_CORE_AGENT_SESSION_MESSAGING_V1` r2 → r3 (docs-only)
- worktree: `production-rnd-parallel-preparation-goal-state/worktrees/session-spec-revision-v1`
- branch: `prep/session-spec-revision-v1` @ BASE `840d2f4ad91f8252eb1f163330c041216a0dd9c4` (github/main tip)
- inputs (read-only):
  - r2 draft `/Users/yanfenma/workspace/project/dsh-agent-core/docs/specs/AGENT_CORE_AGENT_SESSION_MESSAGING_V1.md`
  - R1 investigation `reports/2026-09-02-R1/AGENT_SESSION_MESSAGING_PREP_INVESTIGATION_V1.md` + `session-messaging-code-excerpts.md` (branch `prep/session-messaging-investigation-v1` @ 04e0c81)
  - accepted D-008 `docs/decisions/AGENT_WORKSPACE_SESSION_MODEL_V3.md` (this worktree, BASE b2e3eb1 content)
- TASK_STATUS: COMPLETE (docs-only)
- IMPLEMENTATION: PAUSED_AUTHORITY — `implementation_authority: none`, `production_apply_authority: none` unchanged; D-008 §29 (V3:976-999) defers `agent_session_send` implementation to future boundaries
- boundaries honored: writes confined to this worktree; user checkout read-only; no push/remote/stash/reset/checkout; no npm/test/network; `packages/broker/src/capabilities/workflow.js` untouched and the spec proposes no change to it

## Deliverables

1. `docs/specs/AGENT_CORE_AGENT_SESSION_MESSAGING_V1.md` — full standalone r3 spec (new file on this branch; the file does not exist at BASE)
2. `docs/reports/agt-prep-session-spec-revision-v1.md` — this report

## Findings → fixes

| Finding | Spec section | What changed in r3 |
|---|---|---|
| F10 (major) | frontmatter; §2.2; §10 | `related_decisions` now cites `AGENT_WORKSPACE_SESSION_MODEL_V3 (D-008, accepted 2026-09-01; supersedes AGENT_WORKSPACE_SESSION_MODEL_V2 whole)` instead of V2. §2.2 rewritten: the whole-authority alignment has been EXECUTED at BASE — cites V3 line anchors for `AGENT_TO_AGENT_MESSAGING_SESSION_SCOPE = TARGET_MAIN` (V3:366), one send = one new Run/Turn, not one new Session (V3:371-372, 387), `agent_session_send` naming (V3:384-388), §29 implementation deferral (V3:976-999, esp. 981), V2 whole-supersession (V3:14-15), and r2 recorded as read-only proposed input (V3:19-22). Gate flips to `DECISION_ALIGNMENT_REQUIRED = NO` with implementation still forbidden before spec acceptance (`IMPLEMENTATION_AUTHORITY = NONE`). §10 review-gate item 1 changed from "author the Decision transition" to "verify the recorded D-008/V3 alignment matches this contract"; final-fields block adds `GOVERNING_DECISION` / `DECISION_ALIGNMENT_REQUIRED = NO`. §8 intro sentence no longer conditions on a future Decision-alignment authority. |
| F9 (minor) | §4 R1; §8 | R1 states the BASE execute-time resolver is a closed two-service merge (`packages/broker/src/index.js:272-275`: `agentDefinitionAccess` + `selfServiceSchedulerAccess` only) and that serving `agentSessionMessagingAccess` requires a small generalization edit to that closure; §8 MOD list adds the `packages/broker/src/index.js` localHandlerResolver edit under `packages/broker`, alongside the relay-reuse statement, and notes it is the only predicted broker source change besides the manifest. |
| F12 (minor) | §4 R2 | New explicit paragraph: the 1..65536 UTF-8 byte bound and NUL-forbidden rule are enforced by the trusted `agent_session_send` handler as first-action authoritative validation; broker structural validation cannot express them (`mapping.js:99-106` supports `minLength` UTF-16 units + `nonBlank` only — no `maxLength`, byte-length, or NUL check). Manifest-level bounds are defense-in-depth only. |
| F19 (minor) | §4 R8; §7 | R8 closed mapping adds `available + terminalState = terminated_without_outcome → outcome_unknown` and `no_output + terminalState = terminated_without_outcome → outcome_unknown`, with rationale (real `LATE_OUTCOMES` member at `state-machine.js:13`; r2 table had no row; outcome_unknown family per r2's proven-vs-unknown convention; retained text never returned as success). §7 mandatory-case list adds `terminated_without_outcome` to the never-a-success list plus an ordering-coverage case. |
| F22 (minor) | §4 R12; §8 | R12 opens with an explicit statement that the L0/L1 audit surface is NEW code (no durable capability-audit append surface at BASE), citing the scheduler precedent (`self-service.js:235` appendAudit; `compose.js:440-450` sanitized `onAuditFailure` wiring) with "pattern reused, store not". §8 production-runtime list marks the audit surface NEW with the same citations. |
| F23 (minor) | §5; §4 R12; §7; §8 | §5 adds `transport_failure` and `unsupported_operation` to the required error classes. Decision: added to the taxonomy (declared in the manifest error table), NOT remapped, with stated rationale — `transport_failure` (grant-check transport outage, `gateway.js:246-248`) must not misreport as `access_denied` or hide as `internal_error`; `unsupported_operation` (missing handler, `gateway.js:171-174`) must not fail closed to `invalid_arguments` via the undeclared-code downgrade (`mapping.js:146-153`). R12 clarifies the coarse audit `result` enum stays closed: `denied` = authorization-class failures, `failed` = all other terminal classes. §7 adds a distinct-emission mandatory case; §8 requires the manifest error table to declare both codes. |
| F8/G8 (note, non-mandatory) | §8 | Adds local-manifest relay-path test coverage to predicted scope (BASE `relay.test.js` is http-only; the local relay path `relay.js:153-155` is present but untested). |

## Intentionally NOT changed (and why)

- `spec_id`, `status: proposed`, `spec_kind`, `authority_level`, `implementation_authority: none`, `production_apply_authority: none`, `owners`, `governed_by`, `supersedes: []`, `superseded_by: null` — the revision is docs-only preparation; authority fields change only in a separate authority round.
- `related_specs` wake entry with its existing disposition note (`Draft PR #130; close as obsolete`) — preserved verbatim per task instruction; §2.1 CLOSE disposition unchanged.
- Core contract semantics: timeout=0 inbox-receipt return; timeout>0 replied only on exact target Run full success; outcome taxonomy non-conflation (proven vs unknown); no auto-replay; no auto ping-pong; no arbitrary sessionId/sessionKey; target-agent-own Principal/credential/Grant; R1-R11 identity/authorization/isolation contracts; §3 current-main findings; §6 non-goals; §9 reused/retired research — R1 confirmed all of these against BASE (F1-F8, F11, F13-F18, F20-F21, F24 all CONFIRMED), so no correction was required.
- §3 evidence line citations left as r2 wrote them — R1 re-verified the underlying flows as CONFIRMED at BASE; re-citation churn would add no accuracy.
- R12 L1 evidence schema (field list and coarse `result` enum) not grown for F23 — the exact class stays model-visible; only a clarifying sentence maps coarse buckets, avoiding a contract-surface change the finding does not require.
- Delegation semantics untouched: §2.2 explicitly scopes this Spec to Messaging only; V3 §12 per-task non-main Delegation is out of scope.
- `packages/broker/src/capabilities/workflow.js`: read-only at BASE; the spec proposes no change to it (nowhere referenced in §8 scope).

## Reconciliation notes

- Nothing in r2 proved unreconcilable. All six mandatory fixes applied; one note-level accuracy item (F8/G8 relay test coverage) folded into §8 as a predicted-scope line.
- F19 mapping choice: `outcome_unknown` for `terminated_without_outcome` in both `available` and `no_output` output states, per the task's r2-semantics ruling (outcome_unknown family) and r2's own convention that terminal states without a proven completed outcome never surface as success or as `target_run_failed`.

## Verification performed (static only)

- BASE anchors re-read from this worktree at 840d2f4: `gateway.js:171-174` (unsupported_operation), `gateway.js:246-248` (transport_failure), `mapping.js:99-106` (minLength/nonBlank only), `mapping.js:146-153` (undeclared-code fail-closed), `state-machine.js:13` (LATE_OUTCOMES incl. terminated_without_outcome), `broker/src/index.js:272-275` (two-service merge), `relay.js:150-175` (local manifests relayed), `self-service.js:235` (appendAudit), `compose.js:433-452` (provider + onAuditFailure pattern).
- V3 anchors re-read: frontmatter lines 3, 14-15, 19-22; freeze block 363-376; primitive naming 381-388; §12 395-405; §29 976-999.
