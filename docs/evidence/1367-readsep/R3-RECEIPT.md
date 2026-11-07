# RECEIPT-1367-READSEP — R3 validation complete, delivery stopped

`STATUS = STOPPED_AT_ADDITIONAL_EVIDENCE_WHITESPACE_CHECK / UNCOMMITTED_SOURCE`. R3's required integration, broker and structure checks pass. An additional whole-candidate whitespace check returned rc2 on byte-preserved historical evidence; Owner's failure-stop prevents commit/push/PR. No delivery, merge or production acceptance is claimed. Updated 2026-11-07T11:18:31.455016+00:00.

## Coordinates and authority

- Repository `mayf3/dsh-agent-core`; task [agent-control #1367](https://github.com/mayf3/agent-control/issues/1367), using the persisted issue definition plus current Owner R3 mandate.
- Worktree `/private/tmp/h1367-readsep`; branch `fix/diagnostic-read-separation`; current HEAD and integration base `2d8ce9d0af6a1ffcb3c8d3bdd9364635e9ae8648`. Remote main was fresh-read at R3 entry and matched this base; feature branch was absent then. No subsequent remote write occurred.
- Route `schema_version=2`, `REUSE + BRIEF + DURABLE`, COMPLIANCE affected scope. Accepted WEC V3 CTR-WEC1-001/002/003 and section4; WAE V3 CTR-WAE-002/005/006. Both accepted authorities exist in base. Source Contract meaning, lock architecture #1366, governance, manifests, dependencies, mutation identity/generation/phase CAS and UNKNOWN fences are unchanged.
- R1/R2 historical stops and raw logs remain intact. [R2 receipt](docs/evidence/1367-readsep/R2-RECEIPT.md), [R2 checkpoint](docs/evidence/1367-readsep/R2-checkpoint.json), [current stop record](STOPPED-1367-READSEP.md).

## R3 environment disposition and executed results

Tests used an isolated child with this exact prefix (each key unset, not set to an empty string):

```sh
env -u HTTP_PROXY -u HTTPS_PROXY -u http_proxy -u https_proxy -u ALL_PROXY -u all_proxy -u NO_PROXY -u no_proxy -u NODE_USE_ENV_PROXY PATH=/usr/local/bin:$PATH node --test <explicit files>
```

Actual `node --version`: **v25.6.1**. Resolved executable `/usr/local/Cellar/node/25.6.1_1/bin/node`, arch x64, `proxyKeysPresent=[]`. [Environment observation](docs/evidence/1367-readsep/R3-environment.txt). Parent proxy settings were unchanged. No runtime guards/assertions were edited, dependencies rebuilt, or production service started. Full command arrays and file hashes are recorded with each observation.

| Required result | Executed evidence |
|---|---|
| Integration/runtime/product-api: all four former failures covered | Five explicit files, **29/29, rc0**, zero skipped/cancelled. [Raw stdout/stderr](docs/evidence/1367-readsep/R3-integration.txt), [metadata](docs/evidence/1367-readsep/R3-integration.json). All four composition/shutdown assertions now execute and pass. |
| Broker related surfaces | Seven explicit assistance read/action/request/current-review and workflow-execution capability files, **80/80, rc0**, zero skipped/cancelled. [Raw](docs/evidence/1367-readsep/R3-broker.txt), [metadata/file list](docs/evidence/1367-readsep/R3-broker.json). |
| Structure | **rc0**, `CANDIDATE_DELTA_PASS_WITH_BASELINE_DEBT`, candidate violations0, inherited debt28. [Complete raw JSON](docs/evidence/1367-readsep/R3-structure.txt), [invocation](docs/evidence/1367-readsep/R3-structure.json). Exact base `2d8ce9d0af6a1ffcb3c8d3bdd9364635e9ae8648`, candidate `7ad8f3c03a02d7499be6c5bbebc87848609a52d7`, tree `e78993cd999117e492a11a438a42160dd55314cf`. Alternate-index unreferenced commit-tree object; actual branch HEAD never moved. Evidence/receipt changes after this snapshot have NOT received a final-HEAD gate. |
| Independent affected-delta review | PASS for unchanged product semantics, prior evidence reuse, environment and required R3 observations. [R3 review](docs/evidence/1367-readsep/R3-REVIEW.md). No final delivery HEAD exists. |

Integration original summary:

```text
ℹ tests 29
ℹ suites 0
ℹ pass 29
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

Actual integration rc0 is recorded in R3-integration.json.

Broker original summary:

```text
ℹ tests 80
ℹ suites 0
ℹ pass 80
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

Actual broker rc0 is recorded in R3-broker.json.

## Reused RED/GREEN and implementation evidence

Independent impact check matched all six R2 source/test hashes and all 13 historical evidence hashes. No product edits in R3; prior evidence is reused at its original Node v26.7.0 coordinates, not claimed as newly executed under Node25.

- R1 raw RED:9 tests/1 pass/8 fail, including four fixture errors; preserved as historical failure, never relabeled. [Original raw](docs/evidence/1367-readsep/RED.txt).
- Corrected R2 RED:9 tests/3 pass/6 intended assertion failures, rc1, no fixture TypeError. [Raw](docs/evidence/1367-readsep/R2-RED.txt), [exact corrected fixture](docs/evidence/1367-readsep/R2-RED-test.js.txt).
- R2 focused GREEN:11/11 rc0. [Raw](docs/evidence/1367-readsep/R2-GREEN.txt), [hashes/metadata](docs/evidence/1367-readsep/R2-GREEN.json). Original summary:

```text
ℹ tests 11
ℹ suites 0
ℹ pass 11
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

- Real mounted traces/attention retain attempts.jsonl hashes: invalid JSON `a2ec5d61ca1047c22d783430623cb014cd76371c4d274986a3d06fdcf27b770b`; missing LF `57cb40eb08666ea4e5efc5b45a6b427e0374d65e487d4e0e2d47be2b7c45ad1e`. Each call: mutate0/repair0/append0/load1/lock1. OwnerLock artifact I/O is outside this event-file assertion.
- No-work reconciliation full replays measured6->3 with mutate0/repair0/append0. Busy phases may conditionally refresh; no production throughput or universal replay-count claim.
- Existing workflow suite:29 explicit files,316/316 rc0. [Raw](docs/evidence/1367-readsep/R2-workflow.txt), [command/file list](docs/evidence/1367-readsep/R2-workflow.json). Inherited whole-file `stale-quiescence.test.js` exclusion stays excluded and is not PASS.
- Complete source/test delta and coordinates: [R2-product.diff](docs/evidence/1367-readsep/R2-product.diff), SHA256 `7184d5194c6ed379edb42f2625e6cc0ffbe628bd7bc58e916b204ae3af576248`; [detailed R2 change table](docs/evidence/1367-readsep/R2-RECEIPT.md). Pure readers use FIFO+OwnerLock+load without repair; actual mutation retains locked fresh replay with repair. Engine shares candidates with refresh after actual phase changes.

## New stop and Done When

After the required structure gate passed, an additional `git diff --check <base> <exact candidate>` returned **rc2**. [Original output](docs/evidence/1367-readsep/R3-diff-check.txt), [metadata](docs/evidence/1367-readsep/R3-diff-check.json). It reports28 trailing-whitespace lines only in original RED.txt, R2-RED.txt and standard-context R2-product.diff; no product/test source is named. This whole-tree check is broader than R2's tracked-source check. It is evidence-format/tooling debt, not a demonstrated product regression or a Spec gap. The rc is preserved. No evidence bytes were cleaned or deleted.

| Issue/Brief obligation | Current disposition |
|---|---|
| Valid defect RED and unchanged product assertions | COMPLETE in R2; original failed R1 evidence retained. |
| True read-only diagnostics, explicit incomplete-tail result, real mutation repair retained | IMPLEMENTED + focused evidence PASS; source hashes unchanged. |
| Reduce repeated same-round full replay | MEASURED no-work6->3; busy-phase conditional refresh covered. |
| Existing workflow/integration affected suites |316/316 reused +29/29 freshly executed; all rc0. |
| Broker + structure |80/80 and candidate-delta structure rc0; inherited debt explicit. |
| Commit -> push -> base-main PR without merge |NOT EXECUTED after new failure-stop; no commit/remote feature branch/PR created by this run. |
| Final-HEAD review/readback |NOT APPLICABLE: branch HEAD has not moved; delivery unfinished. |
| Production install/runtime admission/business acceptance |NOT AUTHORIZED / NOT EXECUTED. |

`R2_INTEGRATION_ENV_REQUIRED_GATE_FAILURE` is closed by R3-integration rc0. `MANDATE_FAILURE_STOP_ACTIVE=YES` for the additional whitespace result; `PR_DELIVERY_READY=NO`; `MERGE_READY=NOT_APPLICABLE (forbidden)`; `OPERATION_ALLOWED=NO`; `DONE_WHEN_MET=NO`; `NEXT_ACTION=STOP`. The minimal continuation is an attributable authorized disposition of whitespace-check scope for byte-preserved evidence, then finish the unchanged candidate's final review/commit/push/open PR. Do not rerun unchanged passed product mechanisms solely because a receipt changes.

[Current hashes and checkpoint](docs/evidence/1367-readsep/R3-checkpoint.json) bind all retained R3 evidence and the receipt.
