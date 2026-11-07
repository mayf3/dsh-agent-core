# STOPPED-1367-READSEP

Status: STOPPED_REQUIRED_GATE_FAILURE (2026-11-07, Asia/Shanghai).

## Coordinates and mandate

- Repository: mayf3/dsh-agent-core. Definition: https://github.com/mayf3/agent-control/issues/1367 (fresh-read body this session).
- Isolated worktree: `/private/tmp/h1367-readsep`. Branch: `fix/diagnostic-read-separation`.
- Source / integration base / current local HEAD: `2d8ce9d0af6a1ffcb3c8d3bdd9364635e9ae8648` (#652 merge).
- Owner mandate: BRIEF-1367-READSEP; failure means stop and write this file; no production writes, no lock redesign, no governance edits, no self-merge.
- Route: REUSE + BRIEF + DURABLE. Accepted WEC V3 CTR-WEC1-001/002/003 and attention section 4 authorize read-only projection; WAE V3 retains locked fresh mutation validation. No load-bearing SPEC_GAP was found in the read-only authority audit.

## Executed RED and unexpected failure

Exact command: `node --test packages/workflow-execution/test/observation-cas/diagnostic-read.test.js`, Node `v26.7.0`, with `READSEP_SOURCE_SHA=2d8ce9d0af6a1ffcb3c8d3bdd9364635e9ae8648`. Dependencies were prelinked and not rebuilt. This is one explicit test file, not a directory argument or all-repository npm test.

The runner rc was 1; 9 tests ran: 1 passed and 8 failed. Four failures are the intended real defect reproduction; four are unexpected test-fixture errors. Therefore rc1 alone is NOT a valid complete RED gate.

Actual reproduction through mounted runtime `workflowExecutionAccess.traces/attention` (no fake snapshot/projection seam):

| Surface / tail | Before SHA-256 | After SHA-256 | mutate / repair / append |
|---|---|---|---|
| traces / invalid JSON | a2ec5d61ca1047c22d783430623cb014cd76371c4d274986a3d06fdcf27b770b | 8f1911794d4af2e2a5cad9b8b60f5b46ee05999f5661dafb8a61b4abdef8fe5c | 1 / 1 / 0 |
| attention / invalid JSON | a2ec5d61ca1047c22d783430623cb014cd76371c4d274986a3d06fdcf27b770b | 8f1911794d4af2e2a5cad9b8b60f5b46ee05999f5661dafb8a61b4abdef8fe5c | 1 / 1 / 0 |
| traces / missing LF | 57cb40eb08666ea4e5efc5b45a6b427e0374d65e487d4e0e2d47be2b7c45ad1e | 8f1911794d4af2e2a5cad9b8b60f5b46ee05999f5661dafb8a61b4abdef8fe5c | 1 / 1 / 1 |
| attention / missing LF | 57cb40eb08666ea4e5efc5b45a6b427e0374d65e487d4e0e2d47be2b7c45ad1e | 8f1911794d4af2e2a5cad9b8b60f5b46ee05999f5661dafb8a61b4abdef8fe5c | 1 / 1 / 1 |

Each call also records exactly one load and one OwnerLock acquisition. Invalid JSON hash change with zero append is consistent with the existing truncate path; complete JSON without LF records the actual newline append. This does not establish deletion of any committed valid record. No HTTP server or production service was started.

Unexpected failures in the newly authored auxiliary tests:

```text
TypeError: workflow-execution: expectedAttemptId must be a ledger-minted wfeat-* id
```

`recordDeliveryFailed` requires `expectedAttemptId` and `expectedGeneration` through `validateObservationIdentity` (`src/ledger-records.js:179-204`). The new fixture omitted these fields at test lines 73, 103 (two tail variants), and 127. These failures happened before the fresh-reader-family, real-mutation-control, and replay-count assertions. This is an authoring error in the new test fixture, not evidence of a new product defect or SPEC_GAP. No correction or rerun was made after detecting it, under the task's stop condition. The non-tail-corruption unchanged-hash control passed.

## Preserved evidence

Raw combined stdout/stderr is complete in `docs/evidence/1367-readsep/RED.txt`; invocation metadata is in `RED.json`. Original output was not edited.

| Artifact | SHA-256 |
|---|---|
| packages/workflow-execution/test/observation-cas/diagnostic-read.test.js | 73224d79e446d156fde159312c22df3b4cc659a82e24df099627725e32bef2e4 |
| docs/evidence/1367-readsep/RED.txt | 47cc96534ef8348a8fe0474668664619e79e9ad4d41508b3e7ffc6b28efa2969 |
| docs/evidence/1367-readsep/RED.json | 7bfe48c9ade7c37223c34ecf1d7a74bf52ee3df49620bd77a634bc703e43b1b3 |
| BRIEF-1367-READSEP.md (original mandate plus preflight record) | 65a83a08f338c1733716e929c104629f33952c21ae505f52021164713ec45f99 |

## Blocker and delivery boundary

```text
schema_version = 2
FINDING = REQUIRED_GATE_FAILURE
SOURCE = Owner task failure-stop condition and required usable RED/GREEN evidence
COUNTEREXAMPLE = 4 auxiliary cases terminate at missing observation-identity validation, before their target assertions
IMPACT = mutation-controls/fresh-family/replay-count baseline incomplete; cannot claim RED suite usable or continue GREEN implementation
MINIMAL_CLOSURE = subsequent authorized continuation may fix only fixture identity inputs, preserve this original result, then rerun baseline before product changes
affected_readiness = IMPLEMENTATION_ALLOWED, PR_DELIVERY_READY
IMPLEMENTATION_ALLOWED = NO (stopped by mandate)
PR_DELIVERY_READY = NO
MERGE_READY = NOT_APPLICABLE (forbidden)
OPERATION_ALLOWED = NO
SPEC_GAPS = 0 observed in bounded authority audit
NEXT_ACTION = STOP
```

Product code, lock architecture, governance, manifests, dependencies, and production remain unchanged. All working changes are untracked Brief/test/evidence/this stop record; no commit, push, PR, merge, deployment or live business acceptance occurred. The failed run used only disposable OS temporary ledger fixtures, cleaned in `finally`. OwnerLock artifact I/O remains outside the intended attempts.jsonl no-repair assertion.

Issue-defined Done When: actual diagnostic write side effect reproduced (four cases); valid complete RED baseline NOT MET; minimal source repair NOT STARTED; explicit incomplete-tail result NOT IMPLEMENTED; same-round replay reduction NOT MEASURED; GREEN/affected suites/broker sample NOT RUN; pushed open PR and final receipt NOT DELIVERED. No partial-implementation or completion claim.

Independent read-only reviewer `/root/authority_audit` confirmed the 9/1/8 counts, four valid hash-change REDs, four missing-identity TypeErrors before mutate, non-tail control pass, complete RED hash above, and empty tracked product/lock/governance diff. Review performed no writes or tests; it inspected the pre-stop-record file inventory.


## R2 continuation stop — 2026-11-07

The current Owner R2 mandate resumed the R1 fixture stop. Only missing fixture observation identities were added before the new RED. R1 original logs and metadata remain byte-identical. Minimal product repair is now present but UNCOMMITTED.

- R2 complete RED: 9 tests, 3 pass, 6 expected contract assertion failures, rc1; no fixture TypeErrors.
- Focused GREEN: original 8 target cases plus non-tail corruption control plus 2 meaningful regressions = 11/11, rc0. Real traces/attention hashes stay unchanged with mutate/repair/append all zero. No-work replay count 6 -> 3.
- Expanded existing workflow suite: 29 explicit files, 316/316, rc0. Inherited stale-quiescence whole-file noise exclusion is unchanged and is not PASS.
- Required integration suite: 5 explicit files, 29 tests, 25 pass, 4 fail, rc1. All four failures are composition shutdown cases stopped by `HTTP_PROXY: runtime_proxy_env_present` at compose.js:94 -> 144, before mounting runtime. Current Node v26.7.0 also differs from the same gate's v25.6.1 pin; this second precondition is a source observation, not an executed failure after proxy removal.

Per failure-stop mandate, no environment correction, test rerun, further product edits, broker sample, structure run, commit, push or PR followed this failure. Only read-only triage and evidence/receipt preservation continued. No production changes or lock-architecture changes occurred.

```text
schema_version = 2
FINDING = REQUIRED_GATE_FAILURE
SOURCE = Owner R2 failure-stop mandate and required affected-suite rc0
COUNTEREXAMPLE = four composition shutdown cases abort before target assertions at inherited HTTP_PROXY preflight
IMPACT = integration acceptance incomplete; commit/push/PR delivery gate unmet
MINIMAL_CLOSURE = subsequent authorized continuation uses isolated proxy-free test child with exact Node v25.6.1, without weakening guards or changing product assertions; rerun integration and remaining broker/structure checks
FROZEN_BLOCKER_UNION = [R2_INTEGRATION_ENV_REQUIRED_GATE_FAILURE]
affected_readiness = IMPLEMENTATION_ALLOWED, PR_DELIVERY_READY
IMPLEMENTATION_ALLOWED = NO
PR_DELIVERY_READY = NO
MERGE_READY = NOT_APPLICABLE (forbidden)
OPERATION_ALLOWED = NO
NEXT_ACTION = STOP
```

Current HEAD/base remains `2d8ce9d0af6a1ffcb3c8d3bdd9364635e9ae8648`, branch `fix/diagnostic-read-separation`, worktree `/private/tmp/h1367-readsep`. Full current source hashes, raw logs and diff: `docs/evidence/1367-readsep/R2-checkpoint.json`. Independent review: `docs/evidence/1367-readsep/R2-REVIEW.md`. Current delivery receipt: `RECEIPT-1367-READSEP.md`.

## R3 failure stop

Candidate whitespace rc2. See R3-diff-check.txt. No branch commit/push/PR after failure. NEXT_ACTION=STOP.

## R3 stop qualification — 2026-11-07T11:18:31.455016+00:00

R3 closes the R2 integration-environment stop: actual Node v25.6.1 with all nine proxy keys absent in the test child; full integration29/29 rc0, broker80/80 rc0, structure candidate0 violations rc0 (28 inherited baseline-debt findings). Product/test source SHA-256 values remain identical to R2. No host settings, product guards, tests or source changed.

The additional whole-candidate `git diff --check 2d8ce9d0af6a1ffcb3c8d3bdd9364635e9ae8648 7ad8f3c03a02d7499be6c5bbebc87848609a52d7` returned rc2 only for 28 trailing-whitespace lines in original RED.txt, R2-RED.txt and standard-context R2-product.diff. This check was broader than the prior tracked-source whitespace check. It is evidence-format TOOLING_DEBT, not a demonstrated product regression; its rc is not relabeled. Under the explicit failure-stop mandate, dependent commit/push/PR remains stopped. Do not clean/delete byte-preserved raw evidence. Minimum continuation: an attributable authorized disposition of whitespace-check scope for original evidence, then finish delivery without rerunning unchanged passing product mechanisms.

PR_DELIVERY_READY=NO; MERGE_READY=NOT_APPLICABLE (forbidden); OPERATION_ALLOWED=NO; NEXT_ACTION=STOP. Current branch HEAD remains `2d8ce9d0af6a1ffcb3c8d3bdd9364635e9ae8648`. Full provenance: R3-structure.json, R3-diff-check.json, R3-REVIEW.md.


## R4 disposition of historical stops — 2026-11-07

Current user explicitly resumes the R3 whitespace-only packaging stop under standing `603-R7-RAW-CLASS-001`. R1/R2/R3 stops above remain historical observations; their raw results are unchanged. No current product blocker is inferred from original test-output or archived diff whitespace. R4 must record a separately scoped actual rc; no rc0 is claimed before execution. Delivery proceeds only through the current Brief's bounded R4 sequence; any new unexpected failure creates a new stop. See current RECEIPT-1367-READSEP.md for latest state.


## R4 new unexpected failure

{
  "argv": [
    "git",
    "diff",
    "--cached",
    "--check",
    "--",
    ".",
    ":(exclude)docs/evidence/**/*.diff",
    ":(exclude)docs/evidence/**/*.stderr",
    ":(exclude)docs/evidence/**/*.stdout",
    ":(exclude)docs/evidence/**/*.log",
    ":(exclude)docs/evidence/1367-readsep/RED.txt",
    ":(exclude)docs/evidence/1367-readsep/R2-RED.txt"
  ],
  "started_at_utc": "2026-11-07T11:24:33.199024+00:00",
  "finished_at_utc": "2026-11-07T11:24:33.216821+00:00",
  "pre": {
    "head": "2d8ce9d0af6a1ffcb3c8d3bdd9364635e9ae8648",
    "branch": "fix/diagnostic-read-separation",
    "worktree": "/private/tmp/h1367-readsep"
  },
  "actual_rc": 2,
  "post_head": "2d8ce9d0af6a1ffcb3c8d3bdd9364635e9ae8648",
  "stdout_sha256": "7e88b9a5bcd765fdb924086233159aea0f0895a0cd069c3248910ff8f5537699",
  "stderr_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
}

NEXT_ACTION=STOP; PR_DELIVERY_READY=NO; dependent writes stopped.


### R4 raw-class scope qualification

The automatic capture wrapper initially treated any nonzero command as an unexpected failure, before evaluating the already authorized class exemption. Actual R4-whitespace rc2 names only R3-diff-check.txt, a byte-preserved raw git-diff-check stdout capture already covered by the user R4/603-R7-RAW-CLASS-001 class authorization. Its exclusion was an implementation omission in the first scoped command. The wrapper stop above is retained as execution history but does not create a new approval requirement or narrow the user mandate. Current mechanical continuation completes the existing class scope, preserves actual rc2 and original hashes, then reruns the scoped gate. Any nonexempt finding or unexpected delivery failure still stops dependent work.


## R4 new unexpected failure

{
  "argv": [
    "git",
    "ls-remote",
    "origin",
    "refs/heads/main",
    "refs/heads/fix/diagnostic-read-separation"
  ],
  "started_at_utc": "2026-11-07T11:26:49.873092+00:00",
  "finished_at_utc": "2026-11-07T11:27:52.255456+00:00",
  "pre": {
    "head": "2d8ce9d0af6a1ffcb3c8d3bdd9364635e9ae8648",
    "branch": "fix/diagnostic-read-separation",
    "worktree": "/private/tmp/h1367-readsep",
    "index_tree": "07ff18450ba8099edf7e655fa8bdc4b500154cac"
  },
  "actual_rc": 128,
  "post_head": "2d8ce9d0af6a1ffcb3c8d3bdd9364635e9ae8648",
  "stdout_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "stderr_sha256": "ac3ee3f85aea23b1d99c328f409e2771ac2a3a2604901fa61f9ef86ad823fd50"
}

NEXT_ACTION=STOP; PR_DELIVERY_READY=NO; dependent writes stopped.


## R4 current stop — genuine remote-preflight failure

schema_version=2; FINDING=REQUIRED_GATE_FAILURE (delivery preflight; no product regression).
SOURCE=current user R4 failure-stop mandate.
COUNTEREXAMPLE=git ls-remote origin main/feature returned rc128/curl18/expected-flush, no valid remote ref list; exact R4-precommit-remote.json/.stderr archived.
IMPACT=commit/push/PR not executed; affected_readiness=[PR_DELIVERY_READY,TASK_DONE]; both NO. Latest remote state UNKNOWN; branch HEAD remains2d8ce9d0af6a1ffcb3c8d3bdd9364635e9ae8648.
MINIMAL_CLOSURE=subsequent authorized continuation may fresh-read refs and finish unchanged candidate delivery; no new product repair or dynamic rerun needed absent invalidating drift.

Corrected class whitespace rc0 and staged candidate independent PASS are preserved at tree07ff18450ba8099edf7e655fa8bdc4b500154cac. No retry/commit/push/PR after this failure. Final root receipt and postfailure captures are local uncommitted archival facts. MERGE_READY=NOT_APPLICABLE (forbidden); PRODUCTION_OPERATION_ALLOWED=NO; NEXT_ACTION=STOP.


## R5 current stop — packaging wrapper index-lock failure

Current user R5 resumed only the R4 network stop: first one-key Git probe, then complete remote preflight, commit/push/open base-main PR, receipt; new failure-stop unchanged. Owner V2 §5 live ruling and unchanged32/32 source/evidence hashes were verified and recorded in the Brief/R5-entry. R4 receipt is preserved byte-for-byte as R4-RECEIPT.md.

One-key `git ls-remote origin refs/heads/main`: rc0. Full `git ls-remote origin refs/heads/main refs/heads/fix/diagnostic-read-separation`: rc0, main=`2d8ce9d0af6a1ffcb3c8d3bdd9364635e9ae8648`, no feature line at2026-11-07T11:33:05.486785+00:00. The concurrent PR-list capture wrapper failed BEFORE `gh pr list` execution: wrapper rc1, nested pre-coordinate `git write-tree` rc128, index.lock File exists. Root mistakenly parallelized wrappers whose metadata precommand writes the same index. Exact recorded tool-output transcription and provenance: docs/evidence/1367-readsep/R5-precommit-pr-list-wrapper.log/.json. This is not a failed remote Git probe or an executed PR query.

Dependent delivery stopped immediately. No wrapper rerun, lock removal, environment/host/source repair, commit, push or PR create followed. Read-only local check at2026-11-07T11:33:46.482061+00:00 found the transient index.lock absent, HEAD unchanged, index equal to the R4 reviewed tree and all32 source/evidence hashes unchanged. Lock absence is observation, not retry permission. PR current state was not queried in R5 and remains UNKNOWN.

schema_version=2; FINDING=REQUIRED_GATE_FAILURE; SOURCE=R5 explicit failure-stop and incomplete required remote/PR preflight; COUNTEREXAMPLE=PR-list wrapper aborted rc1 before gh invocation due to nested index-write lock failure; IMPACT=precommit delivery gate incomplete, no commit/push/PR; MINIMAL_CLOSURE=subsequent authorized continuation uses sequential capture commands or genuinely index-read-only metadata, performs unfinished all-state PR check and fresh required remote check, then delivers unchanged candidate; no new product repair or unchanged dynamic rerun needed. FROZEN_BLOCKER_UNION=[R5_CAPTURE_PRECOMMAND_INDEX_LOCK_FAILURE]; affected_readiness=[PR_DELIVERY_READY,TASK_DONE]; both NO. MERGE_READY=NOT_APPLICABLE (forbidden); PRODUCTION_OPERATION_ALLOWED=NO; NEXT_ACTION=STOP. Only stop-fact archival/receipt writes and independent local readback follow.


## R6 disposition of the historical R5 stop — 2026-11-07

The current user's explicit R6 mandate resumed the wrapper failure for strictly serial delivery. All R1-R5 stops and their actual rc values above remain historical; none is rewritten as PASS. R5's root cause was concurrent capture metadata `git write-tree` calls contending for the same index.lock, before its PR query ran; remote Git reads had succeeded.

R6 reverified the unchanged 47-file staged tree and observed index.lock absent without removal. Direct serial commands committed `ed31db7cfa068ac8128c127382efd98986abff4b`, pushed the branch, created base-main PR #654 and read back matching headRefOid; all rc0. The PR was OPEN and unmerged. Thus R5_CAPTURE_PRECOMMAND_INDEX_LOCK_FAILURE is closed for this bounded delivery by the new mandate and actual successful operations. It does not reopen product work or authorize merge/production. Current completion facts are in RECEIPT-1367-READSEP.md and R6-delivery.json; this file retains the original failure history.
