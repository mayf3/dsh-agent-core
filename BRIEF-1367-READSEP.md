# BRIEF-1367-READSEP — fresh snapshot 真只读+修复写分离（审查增量③ Core 第二优先）

授权: Owner 审查增量③(顺序: #1364已合→#1367→#1366)+预授权V1§1。零生产写入。
定义来源: agent-control issue **#1367**(父#1363 D04)正文。
停止条件: 失败即停写STOPPED-1367-READSEP.md; SPEC_GAP同前例停。

## 环境配方
node_modules已预链(只验证); Node v26.7.0文件展开运行器(目录参数陷阱); 全仓npm test结构性不可用作门; 噪声: stale-quiescence版本敏感断言不计门。

## 矩阵实证坐标(base含#652)
- 部分交付 f31ba0ea(#624): inspectFresh 仅覆盖部分 reconciliation。
- 缺口: `packages/workflow-execution/src/ledger.js:157-194,258-265,432-464,475-491`+`engine.js:215,227,283,294`: traces/attention 仍经 snapshotFresh→mutate→repairTornTail; 同轮多次 Fresh。
- 结构性单点声明: 本线不动锁架构(#1366是独立后续), 只做读取路径分离。

## 任务(Owner指令: "不得为修一个只读接口先要求完成整个锁架构重构")
1. 复现: traces/attention 路径经 mutate+repairTornTail 的实际写副作用测试(RED: 只读调用产生写/repair)。
2. 最小修复: 诊断类读取(traces/attention/inspectFresh覆盖面)改为真只读路径——不落 mutate/repairTornTail; 修复写只保留在真实 mutation 路径; 不改锁语义(#1366范围)。
3. 测试: 只读调用零写入断言(文件哈希不变)+RED基线+受影响既有套件rc0(文件展开)+broker相关面抽测。
4. 交付: 分支fix/diagnostic-read-separation→push开PR(base main)不合并→RECEIPT-1367-READSEP.md(RED/GREEN原文+diff坐标+DONE_WHEN对照issue定义+部分交付边界如实——本单验收含"减少同轮重复全量回放", 如修复自然覆盖则一并核验, 否则如实列剩余)。
红线: 失败即停; 不动锁架构(#1366); 不动治理文档; PR禁自合并。

## PREFLIGHT (2026-11-07)

```text
schema_version = 2
SPEC_GOVERNANCE_MODE = PREFLIGHT
TARGET_REPOSITORY = mayf3/dsh-agent-core
BASE_HEAD = CURRENT_BASE_HEAD = 2d8ce9d0af6a1ffcb3c8d3bdd9364635e9ae8648
ISOLATED_WRITE_SURFACE = /private/tmp/h1367-readsep @ fix/diagnostic-read-separation
GOAL_OR_TARGET = diagnostics read current ledger without event-file repair; share reconciliation candidate replay
CURRENT_GAP = snapshotFresh/list*Fresh enter mutate+repair; four candidate replays per pass
AUTHORITY_ACTION = REUSE
PRIMARY_AUTHORITY = AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V3 CTR-WEC1-001/002/003 and section 4
RELATED_AUTHORITIES = AGENT_CORE_WORKFLOW_AGENT_EXECUTION_V3 CTR-WAE-002/005/006; STALE_REENTRY_V2; RECOVERY_LIVENESS_V1
IMPLEMENTATION_AUTHORITY = contracts
ROUTE_STAGE = IMPLEMENTATION
AUTHORITY_ACCEPTED_IN_BASE = YES
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = DURABLE
EXECUTION_MANDATE = MUTATION_AUTHORIZATION = VALID (Owner task plus issue 1367)
SPEC_GAP_DEPENDENCY = NONE
EVIDENCE_REVIEWABILITY = PASS
LIVE_AUTHORITY_GAP = NONE
IMPLEMENTATION_ALLOWED = YES
MERGE_READY = NOT_APPLICABLE (forbidden)
OPERATION_ALLOWED = NO
DONE_WHEN = RED reproduction; GREEN hash/no-repair and explicit incomplete-tail evidence; fewer shared-candidate replays with locked mutation revalidation; affected suites and broker sample rc0; independent review; pushed open base-main PR; receipt
EXPANSION_TRIGGER = required gate failure or load-bearing SPEC_GAP => STOPPED-1367-READSEP.md; lock redesign/governance/production effects forbidden
NEXT_ACTION = CONTINUE
```

The expected pre-fix RED is the mandated defect reproduction, not a failed GREEN gate. Any unexpected failure stops further product writes. OwnerLock acquisition/artifact I/O is retained; zero-write assertions cover attempts.jsonl (no mutate/repair/truncate/append/seal), not lock artifacts. Diagnostic qualification is not a new workflow state. Existing public fresh-reader shapes remain; diagnostic responses gain incomplete-tail qualification only when needed. Candidate snapshots do not authorize commits: existing locked fresh identity/phase/generation gates remain authoritative. Planned Owner-resume continuation may require a conditional second selection after actual continuation. Existing later recovery/readback/correlation inspections retain their exclusion intervals.

## R2 continuation (2026-11-07)

Owner's current R2 task explicitly resumes the R1 fixture failure: add the missing identity fields to four fixtures without changing product assertions, establish the complete RED, implement task 2, run GREEN and expanded affected-file suites, then commit/push/open a base-main PR without merge and deliver the receipt. R1 STOPPED and RED artifacts remain unchanged historical evidence. This continuation closes only the R1 mandate stop; any new unexpected failure stops dependent work again.

Coordinates remain base/HEAD `2d8ce9d0af6a1ffcb3c8d3bdd9364635e9ae8648`, isolated worktree `/private/tmp/h1367-readsep`, branch `fix/diagnostic-read-separation`. Route remains `schema_version: 2`, `REUSE + BRIEF + DURABLE`, `IMPLEMENTATION_ALLOWED=YES` under this continuation, `MERGE_READY=NOT_APPLICABLE`, `OPERATION_ALLOWED=NO`. Accepted authority and task scope are unchanged. No governance, dependency, lock implementation, or production mutation is authorized.

R2 execution outcome: STOPPED at required integration rc1 (25/29 pass; four inherited HTTP_PROXY preflight failures). Focused GREEN11/11 and workflow316/316 pass. Current IMPLEMENTATION_ALLOWED=NO and PR_DELIVERY_READY=NO under failure-stop; no broker/structure/commit/push/PR. See RECEIPT-1367-READSEP.md and appended R2 STOPPED record.

## R3 continuation (2026-11-07)

Owner R3 explicitly resumes only the R2 environment stop. Reuse unchanged source/test hashes and prior GREEN11/11, no-work replay6->3 and workflow316/316 evidence. Rerun the five integration files covering all four failures with all nine recognized proxy keys unset in the test child and PATH preferring /usr/local/bin Node v25.6.1; record actual version and raw rc. Then execute assistance read/action/current-review and four workflow-execution broker samples, the structure gate, independent affected/final-Head readback, commit/push/open base-main PR without merging, and finish the receipt.

Route remains REUSE + BRIEF + DURABLE, schema_version=2, accepted authority/base unchanged. R3 lifts the prior task stop for these authorized actions only. No product/guard/assertion/dependency/governance/lock-architecture changes; no host proxy setting changes; no production effects. Any new unexpected failure stops dependent work and is recorded in STOPPED-1367-READSEP.md. Source implementation is already complete; PR_DELIVERY_READY remains NO until required gates and review pass. MERGE_READY=NOT_APPLICABLE (forbidden); OPERATION_ALLOWED=NO.

R3 execution clarification: the whole-candidate whitespace check was an additional check chosen by the agent after the Owner-required structure gate passed. It was not requested as an extra Owner gate. Its actual rc2 on original evidence triggered the existing general failure-stop mandate; see the current receipt.


## R4 mechanical delivery continuation — 2026-11-07

Issuer: current user (regulator/Owner). This explicitly resumes the R3 packaging stop. Apply standing ruling `603-R7-RAW-CLASS-001` (#603 R7), applicable to all subsequent repository deliveries: verbatim machine captures preserve content whitespace; compiled/authored artifacts remain fully checked. Current user explicitly applies the class to the original `.txt` test captures as well as archived `.diff`. Exact affected raw paths, hashes, provenance and scoped command are recorded in `docs/evidence/1367-readsep/R4-whitespace-scope.json`. Do not trim/rename/delete originals, rewrite historical rc2, add .gitattributes, change product semantics or governance.

Authorized sequence: rerun whitespace with class exemptions -> commit on `fix/diagnostic-read-separation` -> ordinary push -> `gh pr create --base main` without merge -> finish this receipt. R3 integration29/29, broker80/80, structure rc0 and earlier unchanged passing mechanisms are reused with independent hash/impact verification. No production effects, main writes, forced push, lock redesign, dependency/host setting changes. Any new unexpected required-gate or delivery failure stops dependent actions and is appended to STOPPED. A receipt-only second commit may persist actual first commit/push/PR observations; final commit/push readbacks are terminal sidecar evidence, avoiding self-referential hashes.

Route remains `schema_version=2`, `REUSE + BRIEF + DURABLE`, affected COMPLIANCE, accepted authority in base=YES. Current gap is packaging/delivery only; PR_DELIVERY_READY awaits scoped rc0 and independent candidate check. MERGE_READY=NOT_APPLICABLE (forbidden); PRODUCTION_OPERATION_ALLOWED=NO. DONE_WHEN=published branch and open base-main PR with completed receipt, exact remote HEAD readback and independent final-head delta check. Stop when met.

R4 scope implementation correction: first scoped check accidentally omitted the original R3-diff-check.txt stdout capture, and returned rc2 exclusively there. Current R4 class authorization already covers this verbatim capture. Preserve the failed attempt; apply the complete existing class by adding its exact exclusion coordinate. This is no new exemption, no raw-byte edit and no product repair. The failure-stop remains controlling for every nonexempt finding or unexpected delivery failure.
