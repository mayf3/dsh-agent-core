# #525 / PR #535 integration evidence — 2026-11-02

Execution mandate: the user relayed Owner's 2026-11-02 ruling "#525 接受" and
authorized conflict repair, review, tests, push/open PR and #525 backfill. The
mandate forbids merge, deploy and production writes. It accepts the P1/P4/P5
direction; P2/P3 remain deferred. This is a source preparation receipt, not a
production result or an independent human GitHub approval.

## Coordinates and bounded route

- Original PR535 source: c9e3467580bbc3a8ca9988e94ae403704f9b07f1.
- Integration main: 26178b4f459cdc2737724f6614b5e2bc9bdc77b0 (fresh remote read).
- Tested code: d0aedb647056d9457bc185320bc0de873eae2961.
- Isolated worktree: /tmp/dsh-525-accept, branch fix/525-admission-main-20261102;
  Root is its only writer. Original ac-task/1228 remains untouched.
- Route: AMEND + BRIEF + DURABLE, source IMPLEMENTATION under accepted V3's
  local atomic permission. Existing IAD-001..006 text is unchanged. Proposed
  additive IAD-007/008 requires explicit acceptance before merge; this receipt
  does not activate the proposed IDs or grant production operation.
- Plan: reconcile compose imports/mount order; independent complete diff review;
  affected tests and base/candidate named comparison; publish open-only and stop.
- Expansion/abort: semantic failure, authority conflict or scope growth stops
  dependent work. No repair of unrelated baseline failures is included.

## What changed and why

The sole Git content conflict was compose.js. Resolution keeps main's scheduler,
identity and workflow module extraction and WebsiteInquiry mounting, while the
JWKS configuration check remains immediately after Definition load and before
resource acquisition. The Product API request router keeps WebsiteInquiry before
health/conversation/admission. The original PR's failure-kind preservation and
frozen directory responses remain. Runbook readiness wording now matches the
request-driven verifier observation and makes no active-probe/full-chain claim.

The two new admission files use existing identity subdirectories to avoid growing
over-limit top-level directories under active structure V2. main's compose tests
had grown to519 lines; the old PR added9. Two unchanged test bodies were extracted
to identity/compose-service-graph.test.js, reducing compose.test.js to468 lines.
No test was renamed, removed or weakened. Structure gate at exact tested code:
CANDIDATE_DELTA_PASS_WITH_BASELINE_DEBT; rc0, candidate violations0,
baseline debt31, resolved debt1. This is not repository-wide structural conformance.
Governance integrity --require-accepted and diff --check passed.

## #118 interaction

The matching reference is **mayf3/svc-workflow#118**, not Core#118 (Luna evidence).
Svc implementation8f5303e65c90c66ae89fa08755c377e975ef071b merged as
b32c0d1a82abeafbf993c5638bbc9f55e436d9a1; accepted source/Spec coordinate is
3dab10f166596be4dc3397ee5dab273df1e60244. WPE CTR-001 requires fresh actual
local principals.enabled inside the owned first-execution write transaction.
That check remains consumer-owned and distinct from Core's authenticated, exact
AgentDefinition exists/enabled observation. This Core diff neither edits Svc nor
uses ready as a substitute for enabled. Existing Core ingress/forward/reverse
resolution enabled gates are byte-identical to main. Svc's previously passed
isolated Postgres evidence is reused as historical evidence, not claimed rerun.

## Executed validation and limits

- Focused affected suites: **84/84 PASS**, rc0, skip0 (focused.txt).
  Includes product-api api/scheduler-api/scheduler-auth/workflow-admission;
  production compose/admission/service-graph/directory-session-send and
  scheduler history-auth/verifier-parity. Pinned Node25.6.1.
- Full two-package comparison, actual ARM64 Node25.6.1, independent identical
  dependencies, concurrency1: base618 tests =603 pass +10 fail +5 skip;
  candidate628 =613 pass +10 fail +5 skip, both rc1.
- Failure-name multiset difference = empty. Existing executed test-name losses
  = empty. Exactly10 expected PR tests added and passing (comparison.json).
  This does **not** mean full packages are green, or that every defined test
  executed. The voice-transcription process timed out then aborted with a native
  Napi error; unexecuted post-abort coverage is not certified. Five existing
  conditional skips remain skips.
- Ten common failures: one voice/native failure; two fleet-send entitlement
  assertions; stale installer trap assertion; pinned migration fixture missing
  occurrence-model.js; four routing parent-metadata failures; stale Session
  Trace fixed-blob assertion. Their raw errors and names are preserved. These
  failures are reproducible on base and are not repaired or waived here.
- Earlier runs are retained: first run lacked real dsh-tools and used temporary
  HOME; next run exposed x64/native and concurrent test-created symlink races.
  Corrected environment uses real published dependencies, official hash-checked
  ARM64 Node and separate dependency copies, without code stubs or test filtering.
- No target package uses Postgres. No database cluster, service deployment,
  production config, identity, credential, fence or business state was changed.

Reproduce: use environment.json's actual dependencies and the official Node
archive whose checksum is retained. In separate clean base/candidate checkouts,
run each summary.json's argv with its allowlisted env and separate writable
TMPDIR/dependency copies. Do not run multiple suites against shared node_modules:
existing tests create/remove local package symlinks. Raw local runner and all
attempts remain at /tmp/dsh-525-evidence; its SHA256 is in environment.json.

## Readiness

SOURCE_SEMANTIC_REVIEW = PASS; SEMANTIC_BLOCKERS =0.
FOCUSED_TESTS = PASS; NAMED_REGRESSION_DIFF = EMPTY.
FULL_PACKAGE_ALL_GREEN = NO; MERGE_READY = NO.
Outstanding: user-required full-package all-green gate and explicit acceptance
of proposed IAD-007/008. Open-only source publication is authorized; this record
does not waive either gate. No merge, deployment, installation, enablement or
business acceptance is claimed. Regulator retains the merge action.
