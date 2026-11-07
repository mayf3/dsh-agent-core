# RECEIPT-1367-READSEP — R6 serial PR delivery

STATUS = SOURCE_PR_DELIVERED_RECEIPT_COMPLETE. PR [#654](https://github.com/mayf3/dsh-agent-core/pull/654) is OPEN against main, with no merge. Commit, ordinary push, PR creation and first PR readback all returned rc0. This completed receipt and preserved R4/R5 history use the already-authorized receipt-only publication protocol; terminal sidecars record its final review/push/readback outcome. Zero production writes.

## Exact coordinates and authorization

- Repository: mayf3/dsh-agent-core. Task: [agent-control #1367](https://github.com/mayf3/agent-control/issues/1367).
- Isolated worktree: `/private/tmp/h1367-readsep`; branch: `fix/diagnostic-read-separation`.
- Integration base: `2d8ce9d0af6a1ffcb3c8d3bdd9364635e9ae8648`; fresh remote main and PR baseRefOid both matched it. The stale local main ref was not the integration baseline.
- Source commit: `ed31db7cfa068ac8128c127382efd98986abff4b`; parent: the exact integration base. Its 47-file tree is `07ff18450ba8099edf7e655fa8bdc4b500154cac`, identical to the independently reviewed R4 staged candidate.
- First PR readback: baseRefName=main; headRefName=fix/diagnostic-read-separation; headRefOid=`ed31db7cfa068ac8128c127382efd98986abff4b`; state=OPEN; mergedAt=null; mergeCommit=null.

Current user R6 explicitly resumed the R5 wrapper stop for `commit -> push -> gh pr create(base main) -> headRefOid readback -> receipt`, strictly serially, with failure-stop unchanged. [Brief](BRIEF-1367-READSEP.md) records the exact continuation and existing receipt-only completion protocol. Route remains schema_version=2, REUSE + BRIEF + DURABLE under accepted-in-base WEC V3 CTR-WEC1-001/002/003 and section 4, plus WAE V3 CTR-WAE-002/005/006. No Product Contract, production permission or merge permission is created by this mandate.

## R5 root cause and R6 serial handling

R5 single-key and full remote ref checks both returned rc0; main was unchanged. Its PR-list evidence wrapper failed before invoking gh: wrapper rc1, nested pre-coordinate `git write-tree` rc128, index.lock already exists. Root had launched wrappers concurrently while both wrote index metadata. This was local evidence-packaging contention; it was not a failed network probe or an executed PR query. [Original wrapper transcript](docs/evidence/1367-readsep/R5-precommit-pr-list-wrapper.log) and [metadata](docs/evidence/1367-readsep/R5-precommit-pr-list-wrapper.json) retain the actual failure.

R6 uses direct serial commands and waits for every process to finish before invoking the next Git/gh command. No parallel wrapper, concurrent task Git process, lock removal, host/proxy change or product repair occurred. Entry read-only checks observed index.lock absent and the exact 47-file reviewed staged tree. Existing source/test assertions, dependency/governance/lock architecture and UNKNOWN/CAS semantics remain unchanged.

The complete R5 receipt is preserved byte-for-byte as [R5-RECEIPT.md](docs/evidence/1367-readsep/R5-RECEIPT.md), SHA-256 `36468a6ae3cf2b4d17ce714e0125d11b1de6c25252b454569592b514a52b57b8`. [R4 receipt](docs/evidence/1367-readsep/R4-RECEIPT.md) SHA-256 remains `0c84a5f2f76b246f64f63e4c7d4ba551a04868adbec5feae33dbbf4ad074a24f`. R1-R5 stops, original captures and failed rc values remain historical evidence.

## Evidence reused at the unchanged source tree

No R6 product tests or structure rerun occurred. Independent [R4 candidate review](docs/evidence/1367-readsep/R4-CANDIDATE-REVIEW.md) bound the exact tree now committed; [R5 stopped-fact review](docs/evidence/1367-readsep/R5-STOP-REVIEW.md) confirmed six source/test and 26 historical evidence hashes unchanged. Exact original commands, runtime coordinates, raw results and limitations remain in the [R2 receipt](docs/evidence/1367-readsep/R2-RECEIPT.md), [R3 receipt](docs/evidence/1367-readsep/R3-RECEIPT.md), R4/R5 receipts and checkpoints.

| Gate | Original actual result and boundary |
|---|---|
| Corrected RED | R2: 9 tests / 3 pass / 6 intended assertion failures, rc1; fixture TypeErrors resolved |
| Focused GREEN | R2: 11/11 rc0; diagnostic attempts.jsonl hashes unchanged; mutate/repair/append=0; explicit incomplete tail |
| Shared no-work replay | 6 -> 3; actual mutation retains locked fresh identity/generation/phase validation; busy phases may refresh |
| Existing workflow | R2: 316/316 rc0, 29 explicit files; inherited stale-quiescence whole-file exclusion retained |
| Integration | R3: 29/29 rc0, 5 files; Node v25.6.1; nine proxy keys unset only in test children |
| Broker | R3: 80/80 rc0, 7 files |
| Structure | R3: rc0, 0 candidate violations, 28 inherited debt findings |
| Whitespace | Corrected R4 authored/compiled scope rc0 at the unchanged source tree; historical raw rc2 preserved |

Standing ruling `603-R7-RAW-CLASS-001` exempts original verbatim captures only; [exact scope, paths, hashes and command](docs/evidence/1367-readsep/R4-whitespace-scope.json). No capture was trimmed, deleted or renamed and no .gitattributes was added. All authored/compiled artifacts remain checked. Receipt/history-only deltas require the bounded final check; no repeated dynamic suite is implied by a new documentation commit.

## Executed R6 delivery observations

[Actual command results](docs/evidence/1367-readsep/R6-delivery.json) preserve invocation text, rc, output and tool coordinates. [Published PR body](docs/evidence/1367-readsep/R6-PR-BODY.md) describes the final bounded change and original validation.

| Step | Actual result |
|---|---|
| Fresh remote refs | rc0; main=integration base; no feature ref before first push |
| Commit prepared staged tree | rc0; 47 files, 5492 insertions, 44 deletions; source commit and tree above |
| Ordinary push | rc0; new feature branch published and upstream set |
| gh pr create | rc0; PR https://github.com/mayf3/dsh-agent-core/pull/654, base main |
| gh pr view | rc0; headRefOid exactly matches source commit; OPEN; no merge |

## Issue-defined Done When and completion boundary

Actual diagnostic write side effects were reproduced through mounted traces/attention, then removed on the fresh-reader path with unchanged event-file hashes and explicit incomplete-tail qualification. Shared candidate selection reduces the measured same-round no-work replay count from 6 to 3. Actual mutations retain locked fresh revalidation. Required affected suites, broker samples and prior independent source review passed at the unchanged product candidate. A pushed, open base-main PR now exists. Lock architecture #1366 remains separate; this task does not claim to eliminate every replay or OwnerLock artifact write.

IMPLEMENTATION_STATE=COMPLETE; SOURCE_PR_DELIVERY=COMPLETE; RECEIPT=COMPLETE; MERGE_READY=NOT_APPLICABLE (forbidden); PRODUCTION_OPERATION_ALLOWED=NO. Installation, runtime admission and business acceptance remain NOT_AUTHORIZED/NOT_EXECUTED. The final receipt/history commit coordinates, independent final-HEAD receipt-delta review and exact remote/PR readbacks are terminal sidecar observations in `docs/evidence/1367-readsep/R6-FINAL-REVIEW.md` and `R6-final-readback.json`, avoiding a self-referential commit hash. The sidecars' actual results must be read directly; this receipt does not preclaim their execution or success.


## R7 — B654-001 P2 regression repair (2026-11-07)

Current disposition: **SOURCE_FIX_VERIFIED; B654-001 CLOSED by independent affected-delta review**.
This section continues and qualifies the historical R6 completion above: the
independent post-R6 review found a concrete P2 regression, and the current user's
R7 task explicitly authorizes its bounded repair, full reruns and ordinary push
on `fix/diagnostic-read-separation` to update existing PR #654. Route remains
schema_version=2, REUSE + BRIEF + DURABLE under the same accepted-in-base WEC/WAE
Contracts. Entry HEAD is `84b1e612aa31f4caa5a0de0ca39e3abca545bcef`;
integration/current remote main remains `2d8ce9d0af6a1ffcb3c8d3bdd9364635e9ae8648`.

### Repair and unchanged assertions

The mounted inspector previously spread a missing trace (`null`) into an object
when the tail was incomplete. That bypassed the route's existing null→404 branch
and returned malformed 200. The one-line product delta checks `result !== null`
before attaching `ledgerRead`. Unknown instance/nodeVisit retain the existing
404/not_found error; known traces and attention retain explicit incomplete-tail
qualification. No route, projection, ledger, mutation, lock, CAS or UNKNOWN logic
was changed by R7. #1366 remains separate.

New `diagnostic-missing-trace.test.js` exercises the real mounted ledger and route,
using only isolated temporary fixtures and rejecting external operations. It adds
all four reviewer counterexamples (invalid_json/missing_newline × unknown instance/
unknown visit), the same strict status404 and not_found assertions, two healthy
controls, event-byte hash preservation, and mutation/repair/append prohibitions.
The new test bytes are identical in RED and GREEN; the original diagnostic11,
shutdown assertions and affected suite files remain unchanged.

The original reviewer receipt remains read-only at
`/private/tmp/h654-review/RECEIPT-654-REVIEW.md`; its SHA and retained-file hashes
are in [R7 checkpoint](docs/evidence/1367-readsep/r7/checkpoint.json).
[Independent semantic review](docs/evidence/1367-readsep/r7/SEMANTIC-REVIEW.md)
records PASS, Blockers=0 and SPEC_GAP=0 against the actual source/test hashes.

### Fresh executed matrix and raw output

Every row below is a fresh R7 execution, not reused R6 evidence. The original
four failing assertions first reproduced exactly as `200 !== 404`; RED rc1 is the
mandated reproduction. All subsequent gates returned actual rc0 with zero skips.

| Gate | Actual result | Complete raw stdout/stderr | Expanded argv, runtime, hashes and actual rc |
|---|---|---|---|
| Regression RED | 6 tests / 2 pass / 4 fail; rc1 | [RED.txt](docs/evidence/1367-readsep/r7/RED.txt) | [RED.json](docs/evidence/1367-readsep/r7/RED.json) |
| Regression GREEN | 6 tests / 6 pass / 0 fail; rc0 | [regression.txt](docs/evidence/1367-readsep/r7/regression.txt) | [regression.json](docs/evidence/1367-readsep/r7/regression.json) |
| Original target8 | 8 tests / 8 pass / 0 fail; rc0 | [target8.txt](docs/evidence/1367-readsep/r7/target8.txt) | [target8.json](docs/evidence/1367-readsep/r7/target8.json) |
| Original diagnostic11 | 11 tests / 11 pass / 0 fail; rc0 | [diagnostic11.txt](docs/evidence/1367-readsep/r7/diagnostic11.txt) | [diagnostic11.json](docs/evidence/1367-readsep/r7/diagnostic11.json) |
| Complete observation-cas (original104 + new6) | 110 tests / 110 pass / 0 fail; rc0 | [observation-cas.txt](docs/evidence/1367-readsep/r7/observation-cas.txt) | [observation-cas.json](docs/evidence/1367-readsep/r7/observation-cas.json) |
| Affected workflow29 files | 316 tests / 316 pass / 0 fail; rc0 | [workflow.txt](docs/evidence/1367-readsep/r7/workflow.txt) | [workflow.json](docs/evidence/1367-readsep/r7/workflow.json) |
| Affected integration5 files | 29 tests / 29 pass / 0 fail; rc0 | [integration.txt](docs/evidence/1367-readsep/r7/integration.txt) | [integration.json](docs/evidence/1367-readsep/r7/integration.json) |
| Broker7 files | 80 tests / 80 pass / 0 fail; rc0 | [broker.txt](docs/evidence/1367-readsep/r7/broker.txt) | [broker.json](docs/evidence/1367-readsep/r7/broker.json) |
| Shutdown/API2 files | 12 tests / 12 pass / 0 fail; rc0 | [shutdown-api.txt](docs/evidence/1367-readsep/r7/shutdown-api.txt) | [shutdown-api.json](docs/evidence/1367-readsep/r7/shutdown-api.json) |

`run.py` preserves explicit file lists, timestamps, actual executable/version,
source/test SHA256 and raw SHA256. Nine proxy keys are removed only from each
test child: HTTP_PROXY, HTTPS_PROXY, http_proxy, https_proxy, ALL_PROXY, all_proxy,
NO_PROXY, no_proxy, NODE_USE_ENV_PROXY. Node v26.7.0 arm64 runs RED/GREEN/8/11/CAS/
workflow/shutdown-API; the R3 integration/broker recipe uses actual Node v25.6.1
x64. Host settings and dependencies are unchanged. The full observation-cas13-file
run is 110/110, comprising every original104 case plus the new6. Workflow uses the
same29 explicit files; historical stale-quiescence whole-file exclusion remains
excluded and is not represented as PASS. Full-repository npm test remains outside
the applicable gate.

The existing structure verifier returned rc0, zero candidate violations and
28 inherited debt findings at the [unreferenced exact candidate snapshot](docs/evidence/1367-readsep/r7/structure-coordinate.json).
[Raw structure result](docs/evidence/1367-readsep/r7/structure.stdout) and
[metadata](docs/evidence/1367-readsep/r7/structure.json) retain its accepted V3
lifecycle result. Local README's older runner-qualification description is an
unrelated documented drift; no governance or runner adaptation occurred.
Whitespace uses the existing standing raw-capture class, with exact new raw paths
and hashes in [scope](docs/evidence/1367-readsep/r7/whitespace-scope.json); no old
capture or historical failed rc was edited.

### Delivery evidence boundary

Fresh [remote preflight](docs/evidence/1367-readsep/r7/precommit-remote.stdout)
returned rc0, with main and feature matching the entry coordinates. Connected
[PR readback](docs/evidence/1367-readsep/r7/entry-pr.json) confirms existing PR654
OPEN/unmerged at R6 head; its initial connector parameter-schema rejection was
before service execution, then the required repository_full_name argument was
corrected and the actual read succeeded. This setup rejection is preserved; it
is not a product RED or a failed executed test/remote command.

The authorized next steps are strictly serial commit→independent final-Head
recheck→ordinary push→fresh remote/PR head equality readback. Their actual results
and final commit coordinates belong in local terminal sidecars
`docs/evidence/1367-readsep/r7/FINAL-REVIEW.md` and `final-readback.json` under the
existing R4/R6 no-self-reference receipt protocol. This committed section does
not preclaim those later actions; read the terminal sidecars for their actual
outcomes. New unexpected required gate/delivery failures still stop dependent
work and are recorded in STOPPED-1367-READSEP.md.

Zero production writes; no merge, deployment, runtime admission or business
acceptance. Only the existing branch/PR source delivery is authorized.
