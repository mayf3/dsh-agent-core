# RECEIPT-1367-READSEP — R4 delivery in progress

STATUS = R4_PACKAGING; source implementation and prior required mechanism gates pass. Commit/push/PR are pending and are not yet claimed. Historical [R3 receipt](docs/evidence/1367-readsep/R3-RECEIPT.md) is preserved byte-for-byte; original R1/R2/R3 failure records remain readable. Updated 2026-11-07T11:24:04.665988+00:00.

## Coordinates, scope and authority

Repository `mayf3/dsh-agent-core`; task [agent-control #1367](https://github.com/mayf3/agent-control/issues/1367). Worktree `/private/tmp/h1367-readsep`, branch `fix/diagnostic-read-separation`, implementation/integration base `2d8ce9d0af6a1ffcb3c8d3bdd9364635e9ae8648`. Fresh remote main equals base; feature branch and matching all-state PR are absent at R4 entry.

`schema_version=2`; `REUSE + BRIEF + DURABLE`; affected COMPLIANCE; accepted-in-base WEC V3 CTR-WEC1-001/002/003 and section4, WAE V3 CTR-WAE-002/005/006. No Product Contract, lock architecture #1366, dependency, guard, assertion, governance or UNKNOWN/CAS semantics change in R4. Current user R4 authorizes packaging, ordinary branch push and open base-main PR only. No merge or production effects.

## Standing raw-capture class exemption

Ruling **603-R7-RAW-CLASS-001**, applicable to all later deliveries in this repository: [exact recorded ruling](https://github.com/mayf3/dsh-agent-core/blob/0aa7aa1e1d23beb13567228a503ff5d9218966c7/BRIEF-603-REVERIFY.md#L53-L59); [#603 public reference](https://github.com/mayf3/dsh-agent-core/pull/603#issuecomment-6702809150). Current user R4 explicitly applies the verbatim class to this delivery. Raw `.diff/.stderr/.stdout/.log` captures preserve significant whitespace; the two original Node `.txt` captures qualify by content/provenance. Authored/compiled files remain fully checked.

| Historical offending path | Ruling reason / preserved SHA-256 |
|---|---|
| `docs/evidence/1367-readsep/RED.txt` | Original failed Node stdout/stderr; `47cc96534ef8348a8fe0474668664619e79e9ad4d41508b3e7ffc6b28efa2969` |
| `docs/evidence/1367-readsep/R2-RED.txt` | Corrected RED original stdout/stderr; `981b034021468d252c36f12663b6bdd5663c42a20529e4d6db0306fcb33af0d2` |
| `docs/evidence/1367-readsep/R2-product.diff` | Verbatim git diff context; `7184d5194c6ed379edb42f2625e6cc0ffbe628bd7bc58e916b204ae3af576248` |
| `docs/evidence/1367-readsep/R3-diff-check.txt` | Original git diff-check stdout echoes raw whitespace; `9eb1b4f5b50905443001a59903b4a4b72f1257679a2aade7704b8b5d79935f26` |

[Exact pathspec, coordinates and class reasons](docs/evidence/1367-readsep/R4-whitespace-scope.json). No original bytes are trimmed, deleted or renamed; no .gitattributes added. The historical unscoped R3 result remains **rc2**. R4 is a separate scoped execution. JSON/Markdown/source/tests and `R2-RED-test.js.txt` are included in the full check.

## Executed evidence and reuse

[Independent R4 impact review](docs/evidence/1367-readsep/R4-REVIEW.md) verifies six source/test and26 historical evidence hashes (32/32) and all suite-bound hashes. No dynamic gate was rerun in R4; original environment coordinates remain attached.

| Gate / obligation | Actual observation and disposition |
|---|---|
| Corrected defect RED | R2:9 tests,3 pass,6 intended assertion failures, rc1; no fixture TypeError. R1:9/1/8 remains historical. [R2 raw](docs/evidence/1367-readsep/R2-RED.txt) |
| Focused GREEN | R2:11/11 rc0; mounted traces/attention file hashes unchanged, mutate/repair/append0; explicit incomplete-tail result. [Raw](docs/evidence/1367-readsep/R2-GREEN.txt) |
| Replay reduction | No-work6->3, actual mutations still revalidate under existing OwnerLock/fresh identity/generation/phase gates. Busy phases may refresh; no universal replay or production-throughput claim. |
| Existing workflow | R2:316/316 rc0;29 explicit files; inherited stale-quiescence whole-file exclusion stays excluded, never PASS. [Raw](docs/evidence/1367-readsep/R2-workflow.txt) |
| Integration/runtime/product-api | R3:29/29 rc0;5 explicit files, all four former environment-blocked assertions execute. [Raw](docs/evidence/1367-readsep/R3-integration.txt) |
| Broker surfaces | R3:80/80 rc0;7 explicit files. [Raw](docs/evidence/1367-readsep/R3-broker.txt) |
| Structure | R3:rc0; candidate violations0, inherited debt28. Candidate `7ad8f3c03a02d7499be6c5bbebc87848609a52d7`, tree `e78993cd999117e492a11a438a42160dd55314cf`; source/tests unchanged. R4 docs delta gets independent scope/impact and final-HEAD check. [Raw JSON](docs/evidence/1367-readsep/R3-structure.txt) |
| R4 scoped whitespace | **Corrected class scope rc0**, empty stdout/stderr; exact argv/time/index-tree in [metadata](docs/evidence/1367-readsep/R4-whitespace-corrected.json). Historical R3 rc2 and first R4 incomplete-scope rc2 remain preserved. |
| Commit / push / open base-main PR | Pending actual execution. No merge authorized. |

R3 child used actual Node v25.6.1 `/usr/local/Cellar/node/25.6.1_1/bin/node`, x64; all nine proxy keys explicitly unset, parent/host unchanged. R2 GREEN/workflow evidence stays at original Node v26.7.0 coordinates. [Environment](docs/evidence/1367-readsep/R3-environment.txt), [R3 checkpoint and all original hashes](docs/evidence/1367-readsep/R3-checkpoint.json), [detailed R2 receipt](docs/evidence/1367-readsep/R2-RECEIPT.md).

## Delivery boundary

IMPLEMENTATION_STATE=COMPLETE; VERIFICATION_STATE=SUFFICIENT for unchanged bounded source; PR_DELIVERY_READY awaits independent final candidate review; DONE_WHEN_MET=NO until pushed PR/receipt verified. MERGE_READY=NOT_APPLICABLE (forbidden); PRODUCTION_OPERATION_ALLOWED=NO; production install/runtime admission/business acceptance=NOT_AUTHORIZED/NOT_EXECUTED. Historical stops are superseded only for the R4 actions explicitly authorized in the Brief. Any new unexpected failure stops dependent work.


Initial R4 capture wrapper recorded STOPPED at R4-whitespace rc2. This was an incomplete class-scope implementation; the precise disposition and corrected rc0 follow below. No nonexempt artifact was reported.


R4 scope qualification: the first scoped attempt returned rc2 only because R3-diff-check.txt (original verbatim stdout) was omitted from exclusions. [Initial actual result](docs/evidence/1367-readsep/R4-whitespace.json) remains rc2. The automatic wrapper stop statement above was made before evaluating this preauthorized class; see STOPPED raw-class qualification. Current user R4 already authorizes this capture class, so the corrected scope continues mechanically without a new exemption or product change. A nonexempt finding or unexpected delivery failure still stops work.
