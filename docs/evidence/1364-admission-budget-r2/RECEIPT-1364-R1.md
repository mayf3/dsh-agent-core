# #1364 admission budget delivery receipt

## Scope and route

- Authorization: Owner `owner-20261107-audit-increment-execution` ②A + preauthorization V1 §1, as bound by `BRIEF-1364-ADMISSION-BUDGET.md` and the current user instruction.
- Repository/worktree: `mayf3/dsh-agent-core`, `/private/tmp/h1364-budget`.
- Fixed implementation base: `3c1bcf98bc40a2c34cca24f241c87d1b12cea216`.
- Branch: `fix/admission-budget-fairness`; integration target: `main`; no rebase, merge, production write or dependency rebuild authorized/performed.
- GOAL: a stable failing head cannot consume the new-attempt budget or permanently starve a healthy tail.
- CURRENT_GAP: `created:false/pre_plan_unavailable` currently counts against 25 new attempts on every poll.
- SPEC_GOVERNANCE_MODE=PREFLIGHT; AUTHORITY_ACTION=REUSE; PLAN_LEVEL=BRIEF; ASSURANCE_LEVEL=DURABLE; ROUTE_STAGE=IMPLEMENTATION; AUTHORITY_ACCEPTED_IN_BASE=YES; IMPLEMENTATION_AUTHORITY=contracts.
- PRIMARY_AUTHORITY: accepted `AGENT_CORE_WORKFLOW_AGENT_EXECUTION_V3`, CTR-WAE-001b/002/004; preserve WEC V3, D-009 and the original ledger's UNKNOWN, fresh policy, quiescence and Owner-resume gates.
- SPEC_GAP_DEPENDENCY=NONE for the selected path. Independent read-only authority review found a bounded path that removes the potentially conflicting dependency.
- Bounded means **admission-probe/ledger-call scans**, failed probes, and actual new attempts. Full due-feed discovery still starts cursorless and pages until SHORT/error under CTR-WAE-001b. A total feed-row/page cap would require a docs-first whole successor and is outside this implementation.
- In-memory visited IDs only rotate probe opportunities; they contain no payload, authority, result, persistent cursor or recovery permission. No new timer, worker, store, automatic resolution-blocked recovery or time backoff.
- DONE_WHEN: fixed-base RED, repaired GREEN, bounded tail-opportunity assertions, related existing suites rc0, affected independent review, receipt, pushed branch and open PR against main without merge.
- EXPANSION_TRIGGER: unexpected required-gate failure or LOAD_BEARING semantic gap -> stop, write `STOPPED-1364-BUDGET.md`; no governance edits or hard implementation of a changed Contract.

## Final state: STOPPED

首次修复后定向门禁 rc=1，触发用户「失败即停」。源码与测试保持失败时原样，未继续修复、复测、提交、push 或建 PR。停止详情及最小恢复条件见 [STOPPED-1364-BUDGET.md](STOPPED-1364-BUDGET.md)。Expected baseline RED is authorized reproduction; the later failing post-fix gate is not waived.

## Definition and reproduction

直接读回的定义来源：[agent-control #1364](https://github.com/mayf3/agent-control/issues/1364)，父 #1363 D01。原文：

> 稳定顺序前 25 条预检失败：三轮 poll 均 25 尝试/0 准入/第 26 条永不到达。对照组 24 异常+第 25 正常：正常项可到达。

This is isolated real-module execution over synthetic external I/O, not evidence of production backlog or production recovery. The engine and ExecutionLedger are real; each run uses a fresh temporary ledger, cleaned afterward. Invalid policy returns undefined, producing the real `created:false/pre_plan_unavailable` path. No real Router or production endpoint is called.

环境：Node `v26.7.0`，zsh，cwd `/private/tmp/h1364-budget`；`node_modules -> /private/tmp/dsh-ekr-p1-new/node_modules` 且目标目录存在，仅验证，未重建。GitHub CLI 只读 issue 查询曾返回 `Post "https://api.github.com/graphql": EOF`，随后通过可用 GitHub 只读 connector 成功读取 #1364/#1376 正文与评论；未以该传输错误推断代码结果。

在固定 base 的产品源码未修改时，先加入两项定向测试并执行：

```text
node --test --test-name-pattern='#1364' packages/workflow-execution/test/continuation.test.js
#1364 observations [{"round":1,"probes":25,"failures":25,"attempts":0,"deliveries":0},{"round":2,"probes":25,"failures":25,"attempts":0,"deliveries":0},{"round":3,"probes":25,"failures":25,"attempts":0,"deliveries":0}]
✖ #1364 RED/GREEN: 25 stable pre-plan failures cannot starve the healthy 26th intent for three polls
✔ #1364 control: 24 stable pre-plan failures leave the healthy 25th reachable
ℹ tests 2
ℹ pass 1
ℹ fail 1
AssertionError [ERR_ASSERTION]: healthy tail must receive exactly one opportunity within three polls
0 !== 1
BASELINE_RC=1
```

完整原文：[in-tree-red.tap](/private/tmp/h1364-budget-evidence/in-tree-red.tap)，SHA-256 `44962c6576efbf44bb731748dad3e897f199a8f983e133249b3c2d2a1b8975d0`。更早的同构独立复现脚本：[baseline.test.mjs](/private/tmp/h1364-budget-evidence/baseline.test.mjs)，SHA-256 `df68b256fa708019d2c5bd4d5f7b97c7dc44d7d69a13c1c49c333f1186ecd560`；该脚本也实际返回 rc=1。

## Candidate diff coordinates (not accepted as passing)

| File | Candidate lines | Change |
|---|---|---|
| `packages/workflow-execution/src/ledger-admission.js` | 7–58 | Process-local probe-cycle visited IDs and three separate budgets; default admission scans S=50, failed probes F=25, actual new attempts A=25. No persistent cursor, payload queue or new runner. Completed discovery commits the cycle; errors commit no rotation. |
| `packages/workflow-execution/src/engine.js` | 16,55,86,131 | Attach budget; actual creation count comes from returned ledger `created`, before action classification. |
| `packages/workflow-execution/src/engine.js` | 324,370–392 | Apply separate probe/failure/mint accounting; unreturned ledger outcome halts further probes, preserves UNKNOWN, and discovery continues to SHORT. |
| `packages/workflow-execution/test/continuation.test.js` | 27–186 | Real-engine/ledger RED/GREEN, control, 250-head cross-page rotation, scan cap, minted delivery failure, post-mint unknown and incomplete-discovery checks. One recovery-fixture assertion currently fails. |

Existing ledger fence, write-ahead, resolver, recovery, Owner-resume and quiescence logic is unchanged. New attempted implementation is only a candidate, not verified conformance. Physical lines: engine 487, ledger-admission 153, continuation test 446; no new package file/directory or governance exception was introduced. `git diff --check` returned rc0 before the failing gate; code-structure verifier was not run and is not claimed PASS.

## Post-fix execution: failed, stop triggered

```text
node --test --test-name-pattern='#1364' packages/workflow-execution/test/continuation.test.js
#1364 observations [{"round":1,"probes":25,"failures":25,"attempts":0,"deliveries":0},{"round":2,"probes":1,"failures":0,"attempts":1,"deliveries":1},{"round":3,"probes":25,"failures":25,"attempts":1,"deliveries":1}]
✔ #1364 RED/GREEN: 25 stable pre-plan failures cannot starve the healthy 26th intent for three polls
✔ #1364 control: 24 stable pre-plan failures leave the healthy 25th reachable
✖ #1364 bounded rotation passes 250 abnormal heads across pages and returns to repaired heads
✔ #1364 scan cap also bounds already-attempted ledger probes; refusals are not new attempts
✔ #1364 minted delivery failures still consume the actual new-attempt budget
✔ #1364 unknown post-mint exception halts probes but preserves exhaustive discovery and the fence
✔ #1364 incomplete discovery commits no probe rotation; the next sweep retries from page one
ℹ tests 7
ℹ suites 0
ℹ pass 6
ℹ fail 1
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
AssertionError [ERR_ASSERTION]: already admitted tail is never delivered again
2 !== 3
actual: 2
expected: 3
GREEN_RC=1
```

完整原文：[green.tap](/private/tmp/h1364-budget-evidence/green.tap)，SHA-256 `800feb4afa8686e4336615bad2a075d244b4839e243469719a23c3f302ec7c65`。源代码推断为 fixture policy 与 bad Set 的恢复状态不一致，坐标与限制见停止记录；没有为验证该推断而继续测试。

既有相关套件：**未运行，rc UNKNOWN**。结构门与独立实现/最终候选审查：**未完成**。全仓 npm test 未作为门执行；stale-quiescence 版本敏感噪声未用于豁免本次失败。执行过的命令均显式指定 `.test.js` 文件，未向 Node v26 传目录。

## Independent review and authority disposition

Independent local reviewer `/root/authority_check` did not author source/test changes and performed read-only authority routing and failure triage. It independently confirmed that exhaustive cursorless discovery plus bounded probe rotation is not demonstrably forbidden by the accepted clauses, while a total feed-page/row cap would conflict. It also independently confirmed the fixture-inconsistency explanation from source; runtime confirmation of that explanation remains unexecuted. This is not an independent implementation PASS or acceptance.

## DONE_WHEN comparison

| Required outcome | Actual result |
|---|---|
| Real fixed-base failing baseline + control | DONE: baseline rc1, 25 bad heads × 3 polls, 0 healthy opportunity; 24-head control PASS. |
| Separate bounded scan/failure/new-admission budgets | Candidate implemented; overall verification FAILED, not DONE. |
| Healthy tail obtains bounded opportunity | Original 26th-item regression PASS after repair; 250-head case passed tail-opportunity assertions within 11 polls, then failed its recovered-head assertion. Overall case FAIL. |
| Post-fix GREEN and existing related suites rc0 | NOT DONE: 6/7 targeted tests pass, rc1; existing suites not run. |
| Respect accepted authority / UNKNOWN | Selected REUSE path preserves full feed discovery; no accepted semantic edits. Candidate still needs independent implementation review. |
| Push `fix/admission-budget-fairness`, open PR base main, no merge | NOT DONE: local branch only, no commit/push/PR/merge, due to STOP. |
| Receipt and failure stop record | DONE: this receipt and `STOPPED-1364-BUDGET.md`. |

Final readiness: `IMPLEMENTATION_ALLOWED=NO` for continuation under the triggered task stop; `MERGE_READY=NO`; `OPERATION_ALLOWED=NO`. NEXT_ACTION=STOP. New user continuation instruction is required to resume the stopped work. Production writes=0; dependency rebuild=0; rebase=0; governance/`.agents/tools` changes=0.

## Exact stopped candidate

HEAD is still the fixed base. Uncommitted tracked delta: 224 additions / 8 deletions across 3 files; binary diff SHA-256 `32b2867dcd7494e9f00b9251a7a6a2da5e78d28e0fe45274e9547484bc4a6508`.

```text
9b11830dc968ae83b7a2d6f5e3a93105ce4bd479ebb0ab4b187eabe331273ef1  packages/workflow-execution/src/engine.js
d28bfea85dcec82c4bfa03beb86e0db123618e73c834eff8b4a40f37dd6f11ed  packages/workflow-execution/src/ledger-admission.js
41830c052f0e0c00ad03eed9ea714f1c75ac25905a89d1ba1a0c481f69b47619  packages/workflow-execution/test/continuation.test.js
```
