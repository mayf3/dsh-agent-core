# Boundary & Authorization Audit — Forum Governance Candidate

- AUDITOR: independent subagent (not the author)
- DATE: 2026-09-03 (audit of head 6f811e3; fixes verified against d2635ed)
- SUBJECT: mayf3/agent-forum branch `agent/forum-admin-moderator-integration-v1`
  - audited head: 6f811e3218c1e6ef84f239affc16e7bc7992fbc9 (base origin/main e0f220f)
  - fix head: d2635ed (closes F1-F6, same worktree)
- TESTS AT 6f811e3: typecheck clean; npm test 363/363 PASS
- TESTS AT d2635ed (post-fix, coordinator-run): typecheck clean; npm test 375/375 PASS; verify:subscription-storage PASS

## Verdicts (at 6f811e3)

| Verdict | Value |
|---|---|
| BOUNDARY_AUDIT | PASS (conditional on F1-F6 fixes) |
| PRIVILEGE_ESCALATION_FOUND | YES (F1, F2) |
| TERMINALITY_ENFORCED | YES |
| NO_SECOND_AUTHORITY | YES |
| SCOPE_FENCE_INTACT | YES |
| SECRET_SCAN | PASS |

## Findings and closure

- F1 (ESC, must-fix): participant role string conferred review-waiver
  authority, self-grantable via POST/PATCH participants (violates accepted
  CTR-AUTHZ-002/003/004). CLOSED at d2635ed: creator-or-governance authority
  for other-principal mutations, closed role/status enums, self-join
  member-only, waive-review authority from JWT governance scope only.
- F2 (DoS amplifier, must-fix): unvalidated participant agentId poisoned the
  notification fan-out FK -> applyGovernanceAction permanent rollback.
  CLOSED: canonical identity resolution against forum_principals BEFORE row
  write on both participant write paths; rows store canonical principal id.
- F3 (leak, must-fix): reactions of hidden/deleted threads readable via
  cross-thread route binding. CLOSED: getReactionsForMessage binds
  messageId->threadId + rejects soft-deleted messages.
- F4 (oracle, minor): reporting a hidden thread distinguished hidden from
  nonexistent. CLOSED: hidden -> 404 indistinguishable.
- F5 (nuance, minor): governance callers could append outcomes/snapshots to
  deleted threads. CLOSED: deleted -> 400 on both POST routes.
- F6 (minor): invalid pagination -> 500/negative take. CLOSED:
  shared parsePagination, 400 on invalid page/limit.

## Route-authz matrix, identity trust, transactions, scope fences, secrets

Full matrix (39 routes) verified at 6f811e3: every GET keeps forum.read plus
the unified visibility guard; every mutation keeps forum.write +
requireForumWriter; every governance-level op requires
requireGovernanceScopes() (forum.moderate OR forum.admin) per-route. Actor
identity always from verified JWT -> ForumPrincipal (CTR-ID-001/002); no
body/query-derived authority; operator env list only restricts. Single
state machine (all 4 status writes guarded; unguarded dead writers removed
in 4cd84c0); single audit model (forum_audit_events, DB append-only trigger,
no ForumAuditLog); single notification model (forum_notification_facts,
CHECK-widened); applyGovernanceAction = one Serializable transaction with
poison tests. Scope fences: no workflow/scheduler/dispatch/external-delivery
code in the diff; admin surface = audit-log query + unread aggregation only.
Secret scan: no secrets in the 48-file diff; audit payload closed allowlist.

## Honest limitations

Static analysis + mock-prisma test suite (no live-Postgres reproduction of
F2's FK rollback; proven from schema FK Restrict + transaction code).
Pre-existing surfaces F1/F3/F4/F5 not introduced by the branch; none were in
the amendment's recorded-drift list, hence reported. Observer UI / CORS
posture out of scope (unchanged). L1 commit-msg gate satisfied via the
disclosed ci-gate-guide.md Q1 emergency seam (same as prior branch commits);
L0 PR gate + L2 instance backfill remain owed at PR time.
