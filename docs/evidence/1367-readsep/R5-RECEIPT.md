# RECEIPT-1367-READSEP — R5 network PASS, delivery STOPPED

STATUS = STOPPED_AT_PREFLIGHT_CAPTURE_WRAPPER. R5 Git network probe and complete remote ref read both passed rc0. The PR-list capture wrapper then failed before invoking `gh`: wrapper rc1, nested `git write-tree` rc128/index.lock contention. Per current failure-stop, commit/push/PR remain NOT EXECUTED. No production writes. Updated 2026-11-07T11:35:12.044233+00:00.

## Coordinates, mandate and preserved history

Repository `mayf3/dsh-agent-core`; task [agent-control #1367](https://github.com/mayf3/agent-control/issues/1367). Worktree `/private/tmp/h1367-readsep`; branch `fix/diagnostic-read-separation`; HEAD/base `2d8ce9d0af6a1ffcb3c8d3bdd9364635e9ae8648`. Entry index is the unchanged47-file R4 reviewed tree `07ff18450ba8099edf7e655fa8bdc4b500154cac`. R5 task/archival updates are local, unstaged; no replacement committed candidate is claimed.

Current user R5 explicitly authorized retrying the R4 rc128/curl18 transient: single-key Git probe, full remote preflight, commit, ordinary push, base-main PR without merge, completed receipt; new failure stops dependent work. [Brief](BRIEF-1367-READSEP.md) records this mandate. Owner V2 live `rulings[id=owner-20261107-preauth-v2]` canonical SHA-256 `087461a2a7424088b258940393ef4f9ad5939e59d0a1e420dfc57efd2829c006` matches the [selected original/SRA precedent](docs/reports/sra-v1-draft-20261107/owner-selected-records.json). No Product Contract or production permission is created by this operational mandate.

Route remains schema_version=2, REUSE + BRIEF + DURABLE; WEC V3 CTR-WEC1-001/002/003 and §4, WAE V3 CTR-WAE-002/005/006 accepted in base. Source, tests, lock architecture#1366, governance, dependencies, guards, assertions and UNKNOWN/CAS semantics are unchanged in R5. [R4 stopped receipt](docs/evidence/1367-readsep/R4-RECEIPT.md) is preserved byte-for-byte, SHA-256 `0c84a5f2f76b246f64f63e4c7d4ba551a04868adbec5feae33dbbf4ad074a24f`; original REDs, R1–R4 stops and rc results remain readable.

## Evidence reused without dynamic rerun

Six source/test and26 historical evidence hashes match R4 in index/worktree,32/32; independent `/root/r5_audit` initial local read-only review PASS/0 blockers/0 SPEC_GAP. No R5 product test or structure rerun occurred. Exact original commands, runtime coordinates, limitations and raw hashes remain in [R2 receipt](docs/evidence/1367-readsep/R2-RECEIPT.md), [R3 receipt](docs/evidence/1367-readsep/R3-RECEIPT.md), [R4 receipt](docs/evidence/1367-readsep/R4-RECEIPT.md) and checkpoints.

| Gate | Original actual result / preserved boundary |
|---|---|
| Corrected RED | R2:9 tests/3 pass/6 intended assertion failures, rc1; no fixture TypeError |
| Focused GREEN | R2:11/11 rc0; diagnostic attempts.jsonl hashes unchanged, mutate/repair/append0; explicit incomplete tail |
| Shared no-work replay | 6→3; real mutation still revalidates under existing lock/identity/generation/phase gates; busy phases may refresh |
| Existing workflow | R2:316/316 rc0;29 explicit files; inherited stale-quiescence whole-file exclusion stays excluded |
| Integration | R3:29/29 rc0;5 files; actual Node v25.6.1, nine proxy keys unset only in test children |
| Broker | R3:80/80 rc0;7 files |
| Structure | R3:rc0,0 candidate violations,28 inherited debt; unchanged in-scope source and authority dependencies |
| Whitespace | R4 corrected full authored/compiled candidate scope rc0 at tree07ff1845…; R3 raw rc2 and first R4 incomplete-scope rc2 preserved |

Standing raw-capture ruling `603-R7-RAW-CLASS-001` remains referenced by [exact recorded ruling](https://github.com/mayf3/dsh-agent-core/blob/0aa7aa1e1d23beb13567228a503ff5d9218966c7/BRIEF-603-REVERIFY.md#L53-L59), [public reference](https://github.com/mayf3/dsh-agent-core/pull/603#issuecomment-6702809150) and [exact class/path/hash recipe](docs/evidence/1367-readsep/R4-whitespace-scope.json). Original capture bytes are not trimmed/deleted/renamed; all authored/compiled artifacts remain checked. R5 did not reach a new final-candidate whitespace gate; R4 rc0 is not relabeled as a fresh R5 run.

## R5 executed delivery observations

| Step | Actual observation |
|---|---|
| One-key Git probe | `git ls-remote origin refs/heads/main`, rc0; [argv/time/hash metadata](docs/evidence/1367-readsep/R5-network-probe.json), [raw stdout](docs/evidence/1367-readsep/R5-network-probe.stdout) |
| Full remote ref preflight | `git ls-remote origin refs/heads/main refs/heads/fix/diagnostic-read-separation`, rc0; main=base, feature absent at `2026-11-07T11:33:05.486785+00:00`; [metadata](docs/evidence/1367-readsep/R5-precommit-remote.json), [raw stdout](docs/evidence/1367-readsep/R5-precommit-remote.stdout) |
| All-state PR check | NOT EXECUTED: capture wrapper failed before gh; actual wrapper rc1, nested pre-coordinate git write-tree rc128; [exact tool-output transcription](docs/evidence/1367-readsep/R5-precommit-pr-list-wrapper.log), [provenance/rc metadata](docs/evidence/1367-readsep/R5-precommit-pr-list-wrapper.json) |
| Commit / push / PR create | NOT EXECUTED; HEAD/reflog remain at base. No merged/created PR or published feature is claimed |

Root caused the packaging failure by running two wrappers concurrently when both collected index coordinates with `git write-tree`. The failure is local metadata lock contention, distinct from the now-successful Git network/ref reads. No lock removal, retry, helper repair, proxy/host change, source repair or dependent delivery followed. A read-only local check at `2026-11-07T11:33:46.482061+00:00` observed index.lock absent, index SHA-256 `211ee36c1613149a9d694b28ead8393907679200f57486e777e64cc73f0cd55a`, no index delta from R4 tree and no32-file source/evidence hash mismatch. Current PR state is UNKNOWN because no R5 PR query ran; the successful timestamped ref observation is not a timeless remote-state claim.

## Current stop and next authorized boundary

FINDING=REQUIRED_GATE_FAILURE; FROZEN_BLOCKER_UNION=[R5_CAPTURE_PRECOMMAND_INDEX_LOCK_FAILURE]; affected_readiness=[PR_DELIVERY_READY,TASK_DONE], both NO. IMPLEMENTATION_STATE=COMPLETE; unchanged source mechanism verification remains sufficient. DONE_WHEN_MET=NO; NEXT_ACTION=STOP. MERGE_READY=NOT_APPLICABLE (forbidden); PRODUCTION_OPERATION_ALLOWED=NO. Installation, runtime admission and business acceptance remain NOT_AUTHORIZED/NOT_EXECUTED. Independent final-HEAD delivery review is NOT_APPLICABLE because no commit occurred; independent local stopped-fact review is recorded separately.

Minimum subsequent authorized continuation: preserve this failure, use sequential wrappers or genuinely read-only index metadata, finish fresh remote/PR preflight, package only the unchanged source plus task-doc/evidence deltas, then commit→ordinary push→open base-main PR→receipt with remote HEAD and independent final delta readbacks. No repeated source repair/dynamic gates are needed absent invalidating drift. This receipt reports the incomplete R5 outcome and does not authorize continuation by itself.
