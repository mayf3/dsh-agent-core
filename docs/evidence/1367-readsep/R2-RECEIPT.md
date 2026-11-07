# RECEIPT-1367-READSEP — R2 partial delivery, stopped at required integration gate

`STATUS = STOPPED_REQUIRED_GATE_FAILURE / UNCOMMITTED_SOURCE`. This receipt does not claim completed delivery. The Owner's R2 continuation repaired R1's fixture identity omission and authorized the bounded implementation; the new required integration failure then activated the same failure-stop rule. No commit, push, PR, merge, deployment or production/business acceptance occurred.

## Coordinates and authority

- Repository: `mayf3/dsh-agent-core`; task definition: [agent-control #1367](https://github.com/mayf3/agent-control/issues/1367), as read and recorded in the R1 Brief/stop handoff. This R2 uses that retained definition and the current user mandate; it did not refetch the issue.
- Worktree: `/private/tmp/h1367-readsep`; branch: `fix/diagnostic-read-separation`.
- Parent/local HEAD/base: `2d8ce9d0af6a1ffcb3c8d3bdd9364635e9ae8648`. Fresh remote `main` readback at 2026-11-07T11:09:50Z matched the same SHA; no remote feature branch was returned. [Checkpoint](docs/evidence/1367-readsep/R2-checkpoint.json).
- Route: `schema_version=2`, `REUSE + BRIEF + DURABLE`. Accepted WEC V3 CTR-WEC1-001/002/003 and section 4 govern pure/read-only diagnostic projections; WAE V3 CTR-WAE-002/005/006 preserve locked mutation validation and torn-tail-tolerant replay. No new Spec or governance edit. Production apply remains none.
- R1 historical stop is retained in [STOPPED-1367-READSEP.md](STOPPED-1367-READSEP.md); R2 continuation and current stop are explicitly appended. R1 raw RED and JSON remain byte-identical, verified SHA-256 below.

## R1 and corrected R2 RED

R1's complete raw [RED.txt](docs/evidence/1367-readsep/RED.txt) and [RED.json](docs/evidence/1367-readsep/RED.json) are preserved: 9 tests, 1 pass, 8 fail; four true hash-change reproductions and four missing-identity fixture failures. Those fixture failures are not relabeled as valid RED.

R2 adds only `identity(fx.writer.get(VISIT))` to the four logical fixture calls (one call is parameterized over two tails); product assertions in the original nine tests are unchanged. Fixture helper imports gain identity. Exact corrected pre-product fixture bytes were reconstructed from the later test file and matched the hash recorded at RED execution, then archived as [R2-RED-test.js.txt](docs/evidence/1367-readsep/R2-RED-test.js.txt).

Exact command for both R2 RED and focused GREEN:

```text
node --test packages/workflow-execution/test/observation-cas/diagnostic-read.test.js
```

[Complete R2 RED raw output](docs/evidence/1367-readsep/R2-RED.txt), [invocation metadata](docs/evidence/1367-readsep/R2-RED.json). Actual rc1; six intended contract assertions fail; no TypeError or other fixture exception. Original summary:

```text
ℹ tests 9
ℹ suites 0
ℹ pass 3
ℹ fail 6
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

Four real runtime traces/attention calls enter mutate=1, repair=1, load=1, lock=1. Invalid JSON truncation changes SHA `a2ec5d61...770b` to `8f191179...e5c`; complete JSON without LF appends LF and changes SHA `57cb40eb...ad1e` to that same repaired hash (append=1). Two real mutation controls and the non-tail-corruption control pass. Fresh-reader qualification and replay-count assertions produce the other two intended failures. No-work reconciliation observation, verbatim:

```text
{"source":"2d8ce9d0af6a1ffcb3c8d3bdd9364635e9ae8648","calls":{"mutate":4,"repair":4,"load":6,"lock":6,"append":0},"examined":0}
```

## Minimal repair and diff coordinates

[Complete source/test diff](docs/evidence/1367-readsep/R2-product.diff), SHA-256 `7184d5194c6ed379edb42f2625e6cc0ffbe628bd7bc58e916b204ae3af576248`. Five tracked files change (59 insertions, 44 deletions) plus the new 168-line diagnostic test. Source line counts: ledger 481, engine 496, terminal operations 92; these measurements do not substitute for the unexecuted structure gate.

| File/current coordinate | Change and preserved boundary |
|---|---|
| `packages/workflow-execution/src/ledger.js:160` | Return current-read tail qualification; invalid JSON tail is skipped, complete no-LF record remains replayable. |
| `packages/workflow-execution/src/ledger.js:425,437,451,463,478` | ACTIVE/stale/run-ended/snapshot Fresh readers use existing FIFO + OwnerLock + load() without repair; inspectFresh passes metadata as its second callback argument. Readback Fresh already delegates to inspectFresh and remains there. |
| `packages/workflow-execution/src/ledger.js:265` | Existing mutate FIFO/OwnerLock/fresh replay with repairTornTail:true is unchanged; truncation/sealing remains on mutation path. |
| `packages/production-runtime/src/workflow/capability-runtime.js:42` | Mounted traces/attention use inspectFresh; append ledgerRead only for incomplete tails. Healthy diagnostic shapes stay unchanged. |
| `packages/workflow-execution/src/terminal-attempt-operations.js:4,15` | Shared pure stale/run-ended selectors retain thresholds and Owner-resume exclusions, with no parallel policy implementation. |
| `packages/workflow-execution/src/engine.js:218,231,289,303` | Share candidate replay; refresh after phases that may have changed it, including Owner continuation and same-pass terminalization. Mutation identity/generation/phase CAS is unchanged. Later recovery/readback/Router-correlation exclusion intervals remain independent. |
| `packages/workflow-execution/test/observation-cas/diagnostic-read.test.js:73,103,127` | Four logical identity fixture corrections; original product assertions unchanged. |
| `packages/workflow-execution/test/observation-cas/diagnostic-read.test.js:142,156` | Two additional regressions prove same-pass ACTIVE-to-terminal stale processing, current-read metadata reset, and healthy response shape. |
| `packages/workflow-execution/test/shutdown-contract.test.js:189` | Intercept snapshotFresh instead of retired engine listActiveFresh call; all shutdown assertions unchanged. |

No lock implementation, lock architecture #1366, production path, governance file, package manifest, dependency, or business-state operation was changed. Zero event-file writes means attempts.jsonl bytes/hash: existing OwnerLock artifact I/O and constructor directory fsync remain outside this assertion.

## Executed GREEN and affected suites

[Focused GREEN raw output](docs/evidence/1367-readsep/R2-GREEN.txt), [metadata and exact tested hashes](docs/evidence/1367-readsep/R2-GREEN.json): **11/11, rc0**. This is the original eight target cases plus non-tail-corruption control plus two additional regressions. Original summary:

```text
ℹ tests 11
ℹ suites 0
ℹ pass 11
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

All four mounted traces/attention calls report `{mutate:0,repair:0,load:1,lock:1,append:0}`. Exact before/after hashes:

| Tail / both surfaces | Before SHA-256 = after SHA-256 |
|---|---|
| invalid_json | `a2ec5d61ca1047c22d783430623cb014cd76371c4d274986a3d06fdcf27b770b` |
| missing_newline | `57cb40eb08666ea4e5efc5b45a6b427e0374d65e487d4e0e2d47be2b7c45ad1e` |

No-work reconciliation observation, verbatim:

```text
{"source":"2d8ce9d0af6a1ffcb3c8d3bdd9364635e9ae8648+R2-working-diff","calls":{"mutate":0,"repair":0,"load":3,"lock":3,"append":0},"examined":0}
```

The measured reduction is 6 -> 3 for this no-work pass, with zero mutations/repairs. Busy passes may conditionally refresh; no universal replay-count or throughput claim.

| Required gate | Executed result / exact evidence |
|---|---|
| Existing workflow-execution tests | 29 explicit expanded files, **316/316, rc0**, [raw](docs/evidence/1367-readsep/R2-workflow.txt), [full command/file list/hashes](docs/evidence/1367-readsep/R2-workflow.json). Includes engine, ledger, Owner-resume, stale/CAS/restart, shutdown and recovery suites. |
| Exclusions | New diagnostic test executed separately above; inherited `stale-quiescence.test.js` whole-file version-sensitive noise exclusion remains outside the gate and is NOT PASS. |
| Integration / runtime / product-api | 5 explicit files, **29 tests / 25 pass / 4 fail, rc1**, [complete raw](docs/evidence/1367-readsep/R2-integration.txt), [full command/file list/hashes](docs/evidence/1367-readsep/R2-integration.json). |
| Broker sample | NOT RUN after failure-stop. Planned assistance read/action/current-review and four workflow-execution capability files remain unexecuted. Gateway behavior exercised by passing integration tests does not substitute for this pending sample. |
| Structure verifier / final commit gate | NOT RUN after failure-stop. Existing main contains the V3-aware runner; stale README pending-verifier wording is not an authority blocker. No candidate structure PASS claimed. |
| Diff whitespace | `git diff --check` rc0, [empty raw output](docs/evidence/1367-readsep/R2-diff-check.txt); source hashes/checkpoint record result. |

All test commands supplied explicit .test.js files, not directories. Node v26.7.0; prelinked dependencies were preserved and not rebuilt. Full-repository npm test was not used. Tests used disposable local fixtures and loopback product-api listeners, not production runtime or service activation.

## New failure and current stop

The four failed integration cases are composition drain ordering; workflowExecution rejection drain; scheduler rejection drain; and owned-worker shutdown rejection. Each exits at the unchanged compose preflight before its target runtime/shutdown assertions:

```text
Error: production-runtime: invalid agent model overrides: HTTP_PROXY: runtime_proxy_env_present
code: 'AGENT_MODEL_OVERRIDE_INVALID'
compose.js:94 -> compose.js:144
```

Source inspection and secret-free environment-name inventory confirm the inherited proxy precondition; the same preflight also requires exact Node v25.6.1. Current v26.7.0 would not satisfy that next check. This is an observed guard/precondition mismatch, not a proven new product regression. No baseline rerun, environment change, proxy removal, Node replacement or gate bypass was attempted after failure. Only read-only triage and evidence/receipt preservation followed.

[Independent affected-contract review and failure triage](docs/evidence/1367-readsep/R2-REVIEW.md) by `/root/authority_review`: initial semantic review PASS, no Spec gaps; current blocker is `R2_INTEGRATION_ENV_REQUIRED_GATE_FAILURE`. Reviewer did not author the semantic delta, edit files or execute tests. Exact source hashes and review coordinates are retained.

```text
schema_version = 2
FINDING = REQUIRED_GATE_FAILURE
SOURCE = Owner R2 failure-stop mandate and required affected-suite rc0
COUNTEREXAMPLE = four composition shutdown cases abort at inherited HTTP_PROXY preflight
IMPACT = required integration gate unmet; delivery cannot proceed
MINIMAL_CLOSURE = subsequent authorized continuation uses an isolated test child satisfying existing proxy and exact Node gates, reruns integration and remaining broker/structure checks without weakening guards/assertions
FROZEN_BLOCKER_UNION = [R2_INTEGRATION_ENV_REQUIRED_GATE_FAILURE]
affected_readiness = IMPLEMENTATION_ALLOWED, PR_DELIVERY_READY
IMPLEMENTATION_ALLOWED = NO
PR_DELIVERY_READY = NO
MERGE_READY = NOT_APPLICABLE (forbidden)
OPERATION_ALLOWED = NO
NEXT_ACTION = STOP
```

## Done When / partial boundary

| Issue/Brief obligation | Actual disposition |
|---|---|
| Repair four fixtures without weakened product assertions | DONE, corrected complete RED establishes all eight relevant target cases; raw original R1 retained. |
| True read-only diagnostics and explicit incomplete-tail qualification | IMPLEMENTED, focused real-runtime GREEN; source remains uncommitted. |
| Retain repair only on real mutation path / no #1366 redesign | Bounded changed reader paths pass; original mutation repair controls pass; lock source unchanged. |
| Reduce repeated full replay in same round | MEASURED for no-work pass, 6 -> 3; conditional refresh retains busy-phase correctness; no production performance claim. |
| Required affected suites all rc0 | PARTIAL: workflow316/316; integration25/29 with4fail, gate NOT MET. |
| Broker sample + structure + final-HEAD independent readback | NOT RUN / NOT COMPLETE after stop. |
| Commit -> push -> base-main PR, no merge | NOT DELIVERED; HEAD unchanged, all current changes uncommitted; no remote feature branch/PR created. |
| Production installation / runtime admission / business acceptance | NOT AUTHORIZED / NOT EXECUTED. |

## Measured hashes

| Artifact | SHA-256 |
|---|---|
| `docs/evidence/1367-readsep/RED.txt` | `47cc96534ef8348a8fe0474668664619e79e9ad4d41508b3e7ffc6b28efa2969` |
| `docs/evidence/1367-readsep/RED.json` | `7bfe48c9ade7c37223c34ecf1d7a74bf52ee3df49620bd77a634bc703e43b1b3` |
| `docs/evidence/1367-readsep/R2-RED.txt` | `981b034021468d252c36f12663b6bdd5663c42a20529e4d6db0306fcb33af0d2` |
| `docs/evidence/1367-readsep/R2-RED.json` | `5a8b81d70071acf006ae6799fde597092ee19c3afe220236820aae8a5cc81317` |
| `docs/evidence/1367-readsep/R2-GREEN.txt` | `72f31722195b7c0297a80e2398d7ee565519305cb566c363ae10cb0bf123ce4a` |
| `docs/evidence/1367-readsep/R2-GREEN.json` | `52baaf5fd98d0691473b48fcddd4e2cd1b55d9b347ee355d8021ba6a5036042b` |
| `docs/evidence/1367-readsep/R2-workflow.txt` | `ebb945300d4fb68aa222eb1ae627409909925c453ade079bb1822f239b495561` |
| `docs/evidence/1367-readsep/R2-workflow.json` | `2dd135fdd048067caa54ab84688740b923b08fdddd088ec5dd942e7f5488363a` |
| `docs/evidence/1367-readsep/R2-integration.txt` | `fc16bd94076991110df74545aabe2aa5fd8550496c635a98ee417463c99e8a67` |
| `docs/evidence/1367-readsep/R2-integration.json` | `ae661daf169cdfff933e6d7caae6e167713416a205b79650e0af1f6d63024035` |
| `docs/evidence/1367-readsep/R2-product.diff` | `7184d5194c6ed379edb42f2625e6cc0ffbe628bd7bc58e916b204ae3af576248` |

All six current source/test SHA-256 values and evidence coordinates: [R2-checkpoint.json](docs/evidence/1367-readsep/R2-checkpoint.json).
