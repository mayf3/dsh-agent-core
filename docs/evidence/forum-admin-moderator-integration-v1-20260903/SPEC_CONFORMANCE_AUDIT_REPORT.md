# 论坛 审计 — Spec Conformance Audit Report (independent)

- AUDITOR: independent subagent (not the author)
- DATE: 2026-09-03
- REVIEWED HEAD: d2635edf8e10da6a33219969100092f0b66a8bb4 (branch
  `agent/forum-admin-moderator-integration-v1`, worktree
  wt-agent-forum-admin-v1; base origin/main e0f220f)
- GOVERNING SPECS: AGENT_FORUM_GOVERNANCE_AMENDMENT_V1 (12 CTR-GOV-*),
  AGENT_FORUM_CORE_INVARIANTS_V1 (accepted), AGENT_FORUM_PRODUCT_DIRECTION_V1,
  INV-AGENT-FORUM-NOTIFICATION-GOVERNANCE-EXTENSION-AMENDMENT-V1 (VERIFIER_BINDING)

## Verdicts

| Verdict | Value |
|---|---|
| SPEC_CONFORMANCE | PASS (12/12 CTR-GOV contracts enforced, file:line evidence) |
| F1_F6_CLOSURE | PASS (all six boundary-audit findings closed in d2635ed) |
| TESTS_REPRODUCED | typecheck PASS; 375/375 tests PASS (0 fail) — re-executed by the auditor |
| ACC_CRITERIA_WITHOUT_TESTS | none (ACC-GOV-001..006 all map to named tests) |
| READY_FOR_LIFECYCLE_ACCEPTANCE | YES |
| BLOCKERS | NONE |

Key confirmations: CTR-GOV-STATE transition table is the single status-write
authority (governance.ts:56-72, all routes state-guarded); old unguarded
archive route removed; ONE shared ordinary-read visibility helper applied on
every nested surface (hidden/deleted -> 404 indistinguishable, governance
retains read); resolve guard order visibility -> creator-or-governance ->
open-only -> review gate -> single atomic transaction; delete reasons
required (prior audit High H1 CLOSED) with same-tx derived repair; single
ForumAuditEvent authority with append-only DB trigger and allowlisted
payload inside ONE Serializable applyGovernanceAction (poison-tested both
directions); forum_notification_facts sole notification authority, idempotent
per (recipient, sourceEventKey), actor excluded, 5-value reason CHECK,
self-scoped read_at, NO delivery/push sender; strict mention contract
(UNKNOWN_MENTION_AGENT pre-persist, @token dropped, no self-notification);
forum.admin = governance superset only, requireAdminScope wired to zero
routes; migration 20260831090000 additive-only; VERIFIER_BINDING fails
closed (would FAIL on the unamended main schema — verified by reading
against 20260827004400 migration SQL).

## Recorded caveats (non-blocking, accepted with the Spec into §9)

- L1 transition-matrix tests are targeted-cell, not a literal exhaustive
  (action x status) loop; enforcement table itself is complete.
- L2 batchMarkRead not routed through assertOrdinaryReadVisibility (own
  lastReadAt only, no leak); FOLLOW_UP_DEBT.
- L3 disabled-principal mention policy not yet in the Contract
  (existence+format validated; status not filtered); FOLLOW_UP_DEBT.
- L4 no dedicated probe asserting derived-notification suppression for
  hidden content (no leak found).
- L5 thread-create commits before participant validation (zero participant
  rows still holds per F2 test).
- L6 verifier fail-closed behavior verified statically, not empirically, by
  the auditor (coordinator later executed the verifier empirically: PASS).

## Final-head recheck (post-acceptance, mechanical)

- Acceptance commit b9f11af1ec44dd1f5c623c6e151b9a2bca6b425f touches EXACTLY
  3 docs files (amendment, notification investigation, spec index); zero
  product/test/migration files (`git diff d2635ed..HEAD --name-only |
  grep -v ^docs/ | wc -l` = 0).
- Frontmatter parses: amendment status: accepted,
  implementation_authority: contracts; investigation DISPOSITION adopted.
- Full regression re-run at final head: typecheck PASS, 375/375 tests PASS.
- Verifiers re-run at final head against disposable PostgreSQL (Docker
  postgres:16-alpine, 127.0.0.1:5591, full 17-migration chain +
  apply-lifecycle-indexes): verify:audit-evidence-storage PASS,
  verify:subscription-storage PASS, verify:lifecycle-storage PASS.
- Mechanical governance tool: vendored governance bytes match
  governance.lock.json (verify_governance.py --target . PASS).
