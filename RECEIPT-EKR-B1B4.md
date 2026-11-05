# EKR B1/B4 receipt — #1374 §3

STATUS = STOPPED_REQUIRED_GATE_FAILURE

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

## Actual candidate and diff

Local candidate head: `eb790bbe94fcefb0a82ed1aca16414bfc0d5be9d`.
Base/current remote main: `1e7233c7b3b081fd30c94de75cf5ba348e2cb323`.
Code delta: 14 files, 608 insertions, 26 deletions (including this initial
receipt). Full exact candidate diff: [implementation.patch](docs/evidence/ekr-b1b4/implementation.patch).
Original Brief SHA256: `9bc07534caf2a98b8d5fb83235d9d792e480d309ab32aae69123c611e75df305`.
The stop receipt and evidence remain uncommitted; no final delivery head exists.

B1 adds same-ledger, identity-bound readback responsibility with durable
nextCheckAtMs and bounded backoff. Legacy unavailable verdicts are rediscovered.
B4 records late current samples independently, retains missing original baselines,
and maps version inequality to recheck rather than progressed. Both feed the
existing startup reconciliation and poller. Original recovery implementation was
moved under `src/recovery/` to preserve the source directory's width limit; its
only code change is a relative import. #622 CAS and #624 B3 paths remain present.

## Executed gates and original output

| Gate / command | Actual result | Original output |
|---|---|---|
| `EKR_SOURCE_SHA=eb790bbe94fcefb0a82ed1aca16414bfc0d5be9d node --test packages/workflow-execution/test/observation-cas/readback.test.js packages/workflow-execution/test/observation-cas/readback-restart.test.js` | rc=0; 11/11 pass | [focused.raw.txt](docs/evidence/ekr-b1b4/focused.raw.txt) |
| `node --test packages/workflow-execution/test/*.test.js packages/workflow-execution/test/*/*.test.js` | rc=1; 231 total, 229 pass, 2 fail | [workflow-regression.raw.txt](docs/evidence/ekr-b1b4/workflow-regression.raw.txt) |
| `npm run test:scheduler` | rc=1; missing `croner`; exact count UNKNOWN | Terminal failure excerpt in [STOPPED](STOPPED-EKR-B1B4.md); full stdout not retained |
| `npm run test:scheduler-router` | NOT_RUN (`&&` short circuit) | No result |
| `node scripts/verify-code-structure.mjs --base 1e7233c7b3b081fd30c94de75cf5ba348e2cb323 --head eb790bbe94fcefb0a82ed1aca16414bfc0d5be9d --json` | rc=0; V2 candidate delta pass, 0 violations, 28 baseline debt; not repository-wide PASS | [structure.raw.txt](docs/evidence/ekr-b1b4/structure.raw.txt) |
| `python3 .agents/tools/verify_governance.py --target . --require-accepted` | rc=0; vendored bytes match, adoption accepted | [governance.raw.txt](docs/evidence/ekr-b1b4/governance.raw.txt) |
| `git diff --check` | rc=0 | No diagnostics |
| `git diff --cached --check -- . ':(exclude)docs/evidence/**'` | rc=0, before semantic commit and after stop readback | No diagnostics; evidence exclusion as instructed |
| Exact base..candidate diff check, same evidence exclusion | rc=0 | No diagnostics |

Focused raw output preserves sourceSha, testName, faultInjection, initialState,
expectedResult, actualResult and rawReceipt for the material scenarios. It records
actual loopback HTTP503, child exit `[0,null]`, existing-poller reads, same original
request/attempt/generation and deliveryCount=1. The late B4 observation does not
fill workflowStateVersionAtDispatch or replace preDeliveryWorkflowStateVersion.
UNKNOWN regression preserves actual isolated Router persistence hashes and an
isolated Scheduler-state fixture; that fixture is not a real Scheduler integration.
The full Scheduler gate failed; no cross-service claim follows from these tests.

Observed readback configuration: production defaults 25 candidates/reads per pass,
30,000 ms initial delay, 300,000 ms maximum; constructor rejects nonfinite or
nonpositive budgets/delays. Focused deterministic tests use 2 candidates, 10/40 ms;
the real process restart test uses 120/480 ms and existing 20 ms poll intervals.

## Integrity and independence

| Evidence | SHA256 |
|---|---|
| focused.raw.txt | `20be2bd246c33d45b2ce543943da20c5aafafa518cf8140e7f10e2492c288050` |
| workflow-regression.raw.txt | `a8c0af3908989c77092a86183437067788325357c130fa2cb1b2396215c783a9` |
| structure.raw.txt | `267a17adf54ea95591c322915587f20e2ad9992186b308744b151fa9114f0982` |
| governance.raw.txt | `c8671db6c5d33b2e2c051a17143acc9bb5736cf8788e72feed4728b5cb32f332` |

Independent reviewer `/root/contract_review` did not author or modify the code.
Review bound to the exact candidate above; preliminary checks confirmed the
acceptance chain, preserved CAS/B3 paths and separate late samples. Final review
was interrupted by required-gate failure; no independent PASS. Remaining review
questions and the authored Buffer assertion defect are retained in
[STOPPED-EKR-B1B4.md](STOPPED-EKR-B1B4.md).

## Delivery and UNKNOWN

PR URL = NOT_CREATED. Push = NOT_RUN. Merge = NOT_RUN.
`MERGE_READY=NO`; code writes stopped at the first observed failure; no dependency
installation, post-failure source repair or rerun. Original source commit retained.
Only stop/receipt/evidence are written afterward under the explicit stop instruction.

Production writes = 0. Window tools unchanged. Installed/loaded revision, production
UNKNOWN inventory, old business outcome, live process/DB/cross-service acceptance,
autonomous business recovery and complete B1/B4 conformance = UNKNOWN / NOT_VERIFIED.
Tests used temporary isolated files and local HTTP; no production ledger or service
was changed. The user-requested delivery is incomplete, with concrete failures and
minimal resumption work recorded rather than silently continuing past the redline.
