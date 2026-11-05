# EKR B1/B4 receipt — #1374 §3

STATUS = IMPLEMENTING

Repository/worktree: mayf3/dsh-agent-core / `/private/tmp/dsh-ekr-b1b4`.
Branch: `ac-ekr-b1b4`; base/main observed `1e7233c7b3b081fd30c94de75cf5ba348e2cb323`.
Authorization: user contract and original `BRIEF-EKR-B1B4.md` (preserved).

PREFLIGHT: REUSE / BRIEF / DURABLE / IMPLEMENTATION. Implementation allowed;
production operation and merge forbidden. Accepted authority:
`AGENT_CORE_WORKFLOW_RECOVERY_LIVENESS_V1`, CTR-EKRWAE-001/002/003/006/007,
Spec SHA256 `c65d901a0e8fb4b5b633ae97e48c93f93fdac1ddb02e38a44e9baeac93c5f51f`.
Owner acceptance: https://github.com/mayf3/dsh-agent-core/pull/623#issuecomment-6646591408
binds merged PR #623 (`2d550bc8147c877db33886fccb85e00a64353e66`), reviewed semantic
head `aeb645868ce3f98ff54f2b631f34c069d38fb04a`, delivery head
`596360a4b56bebd2b2a45969d14b1e389f9f72a5`. The source file retains its historical
proposed/none metadata; this receipt does not rewrite authority.

Goal: existing poller rediscovers persistent read-only B1/B4 responsibilities.
Gap: terminal unavailable drops out; missing baseline/version-only changes lose
readback responsibility. Preserve #622 CAS, #624 B3, UNKNOWN and admission gates.
Plan: same-ledger responsibility/check projection; existing reconciler consumer;
isolated persistent fault/restart tests; independent review; gates; push/open PR.
RETAIN the existing Scheduler, ledger, formal recovery and all business writers.
MIGRATE only the B1/B4 permanent-skip interpretation, with no parallel ledger.
Late samples remain observation baselines and never authorize stale/Owner-resume.

Done when focused tests, existing scheduling regressions, structure V2 and both
diff checks pass, independently reviewed changes are pushed and a PR references
mayf3/agent-control#1374 B1/B4. No merge. Expansion/abort: authority conflict,
unsafe replay, scope escape or required verification failure => stop and record
`STOPPED-EKR-B1B4.md`.

Tests, final head, PR and runtime/business acceptance are pending/UNKNOWN.
