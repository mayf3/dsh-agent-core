# R22 Operator Exact-Generation Recovery

Status: isolated implementation only; production deployment is `NOT_APPLIED`.

## Incident contract

The observed failure is `AGENT_PROCESS_EXITED` followed by `outcome_unknown` and an active recovery fence. The durable recovery record reports `recoveryState=blocked`, `failureReason=registry_cleanup_proof_unavailable`, and `nextSafeAction=operator_exact_generation_recovery`. `assertRecoveryAdmission()` correctly refuses every ordinary spawn while that fence remains active. This design adds the missing narrow operator path; it does not weaken ordinary admission.

## Exact recovery algorithm

`operatorExactGenerationRecovery({agentId, generation}, dependencies)` performs these steps:

1. Validate exactly two parameters: canonical `agentId` and positive integer `generation`. Reject `all`, prefixes, missing generation, extra selectors and operator-supplied fence handles.
2. Read unresolved recovery records and require exactly one record matching both agentId and generation.
3. Read the agent-router registry projection and lifecycle slot. Refuse if a live process owns that generation or the exact generation remains in `REAP`; this is the cleanup-proof guard.
4. Call the reconciliation store's `markFenceCleared(handle)` as the durable CAS mutation. The operator never edits a fence file directly.
5. Emit an audit event for the exact handle/agent/generation and then call the existing `ensureRunning(agentId)` path. Ordinary `assertRecoveryAdmission()` remains active, so any concurrent/new fence still blocks the spawn.
6. Emit a second audit event with the new process PID (or redacted failure). Repeated or ambiguous requests fail closed.

The implementation is `packages/agent-router/src/operator-exact-generation-recovery.js`. It is intentionally dependency-injected so the operator CLI/admin transport can apply its own authentication, authorization and audit sink without giving the model a bypass or allowing fuzzy operations.

## Safety properties

- No assignee or fence reassignment.
- No generation wildcard and no replacement request identity.
- No clearing while a live owner or exact REAP slot exists.
- No direct process spawn: recovery reuses the registry's CAS-protected `ensureRunning`.
- Every refusal, fence clear and spawn result is auditable.
- Production deployment, admin route exposure and operator authorization remain separate release-gated work.

## Isolated verification

`packages/agent-router/test/operator-exact-generation-recovery.test.js` covers:

- active-fence → exact proof → fence clear → targeted spawn;
- generation mismatch refusal before mutation;
- live ownership refusal before mutation;
- fuzzy/extra operator selector rejection.

The tests use in-memory fake registry/store projections and never touch LaunchDaemon, production files, credentials, Feishu or a production workflow.
