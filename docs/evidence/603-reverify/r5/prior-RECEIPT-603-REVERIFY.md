# RECEIPT-603-REVERIFY — R4 停止收据（源码已发布，证据打包未完成）

```text
STATUS = STOPPED_REQUIRED_GATE_FAILURE
TASK_DONE = NO
STAGE_A = COMPLETE_PRESERVED
STAGE_B = INCOMPLETE (dynamic/source gates complete; docs packaging failed)
SPEC_GOVERNANCE_MODE = COMPLIANCE
ENVIRONMENT = local macOS isolated fixtures, existing Node v25.6.1
REVIEW_SCOPE = AFFECTED + frozen full local gate matrix
EVALUATED_AT = 2026-11-07T05:00:43.406377+00:00
AUTHORITY_ACTION = REUSE
PLAN_LEVEL = EXEC_PLAN
ASSURANCE_LEVEL = DURABLE
ROUTE_STAGE = IMPLEMENTATION
AUTHORITY_ACCEPTED_IN_BASE = YES
EXECUTION_MANDATE = VALID (Owner R4, BRIEF)
IMPLEMENTATION_STATE = COMPLETE (selected CTR-S4 delta)
VERIFICATION_STATE = SUFFICIENT (affected source tuple only)
CONFORMANCE_RESULT = UNKNOWN (full delivery incomplete; affected source tuple verified)
IMPLEMENTATION_COMMIT = 87735ecee0e0ebfaa575f889785d7c5037ab9145
IMPLEMENTATION_TREE = d05d1ba63fe2e056e66f838a62811687be2d7925
IMPLEMENTATION_BASE = 1ff1e81cbd74a51761dab46a5fcee532c41fe4ed
CURRENT_BASE_HEAD = bc69bff131c50af7357d39045b6d3084e5fd6fca
VERIFICATION_SNAPSHOT = 0f25ce5270c0964476184af509c5857acbdf1527
VERIFICATION_TREE = 63534a3f954004da8967cd1284df8915d11d5603
DELIVERY_HEAD = NOT_CREATED (docs/evidence commit stopped)
BRANCH = ac-ctr-s4-reverify
WORKTREE = /private/tmp/h603-reverify
EVALUATOR_ID = /root; independent /root/d009_review and /root/gate_review
FROZEN_BLOCKER_UNION = [603-REVIEW-001] (closed, source unchanged)
R3_ENVIRONMENT_BLOCKER = CLOSED (full nine-key clean rerun rc0)
OPEN_BLOCKERS = 1 (603-R4-GATE-001 / REQUIRED_GATE_FAILURE)
PUSH = SOURCE_PASS / DOCS_NOT_ATTEMPTED
PR_UPDATE = PASS (PR603 source pointer updated, still OPEN/unmerged)
MERGE_READY = NO (not authorized; historical PR head unchanged)
OPERATION_ALLOWED = NO
PRODUCTION_WRITES = 0
DONE_WHEN_MET = NO
EXPANSION_TRIGGERED = YES (required gate failure, no scope expansion performed)
NEXT_ACTION = STOP (no auto-fix, no further gates/commit/push/PR writes)
```

R4 保留阶段 A、R2 零写修复和已 PASS 独审，不修改产品/测试/installer 候选字节。使用完整九键清洁环境后，变化门 **40/40 rc0**，R3 原 13 个不同拒绝用例逐一 PASS；全部动态门 **843/843 rc0**，逐门 fail/cancelled/skipped/todo 均为 0。源码已正式提交并 push 至授权分支，远端读回精确源码 SHA；PR603 正文已更新指向新候选，不合并、不强推历史 head。随后最终打包门 `git diff --cached --check` **实际 rc2**：保留原始 `.diff` 的空白上下文行、Git push stderr 的行尾空格被视为 trailing whitespace。按失败即停，未创建 docs/evidence commit、未进行其 final-HEAD review/push/PR完成更新。本文件是停止收据，不能称为全部完成。

## 授权与精确证据绑定

[BRIEF](BRIEF-603-REVERIFY.md) 保存 Owner R2/R3/R4 续行范围和失败即停边界；本轮最终证据打包 required 门失败后即停止，没有自动修复或放宽 guard。阶段 A 的 [18 commits 评估](ASSESSMENT-603-REVERIFY.md) 继续有效。R3 收据、停止记录原字节保存在 [prior receipt](docs/evidence/603-reverify/r4/prior-RECEIPT-603-REVERIFY.md) / [prior stopped](docs/evidence/603-reverify/r4/prior-STOPPED-603-REVERIFY.md)；R2/R1 的更早文件及负向日志继续保留。根 STOPPED 文件只记本轮关闭状态，不抹去历史停止事实。

[环境/六文件哈希](docs/evidence/603-reverify/r4/environment-preflight.json) 和 [源码/accepted authority 坐标](docs/evidence/603-reverify/r4/source-commit-coordinates.json) 记录真实 SHA256/Git blobs。全部 packages/scripts、.agents、accepted Spec/Decisions 与验证 snapshot 在正式源码 commit 中精确相同，actual diff rc0。snapshot 是未引用的验证对象，**不是正式交付分支 HEAD**；843 项执行只绑定其真实产品/测试字节，然后以 exact-byte comparison 重绑到正式源码提交，不冒充在后者重新执行过相同测试。

## 完整九键处置

所有本轮测试、静态机器门均使用下列实际子进程前缀；每项完整 argv、起止 UTC、真实 rc、日志哈希见 command.json。Git 网络 push/readback 保留现有网络环境，命令记录明确区分，不涉及产品 proxy guard。

```sh
env -u HTTP_PROXY -u HTTPS_PROXY -u http_proxy -u https_proxy -u ALL_PROXY -u all_proxy -u NO_PROXY -u no_proxy -u NODE_USE_ENV_PROXY PATH="/usr/local/bin:$PATH" EKR_SOURCE_SHA=0f25ce5270c0964476184af509c5857acbdf1527 EKR_TEST_SOURCE_SHA=0f25ce5270c0964476184af509c5857acbdf1527 <原定门命令>
```

实测九键全部不存在，Node=`v25.6.1`，真实路径 `/usr/local/Cellar/node/25.6.1_1/bin/node`。继承键仅记录 presence，不公开值；无主机环境、依赖、版本守卫或代理守卫修改。`NO_PROXY`/`no_proxy` 本来存在、`NODE_USE_ENV_PROXY` 不存在，也完整显式清除。R2 HTTP_PROXY 拒绝和 R3 NO_PROXY 拒绝原文仍是有效负向机制证据；本次 rc0 才闭合组合门。

## 实际门与完整原文

| 门 | 实测结果 | 原文与真实 rc/hash |
|---|---|---|
| `changed-runtime` | **rc0**; 40/40 PASS; fail=0, skipped=0 | [command](docs/evidence/603-reverify/r4/changed-runtime.command.json) / [stdout](docs/evidence/603-reverify/r4/changed-runtime.stdout.log) / [stderr](docs/evidence/603-reverify/r4/changed-runtime.stderr.log) |
| `installer-syntax` | **rc0** | [command](docs/evidence/603-reverify/r4/installer-syntax.command.json) / [stdout](docs/evidence/603-reverify/r4/installer-syntax.stdout.log) / [stderr](docs/evidence/603-reverify/r4/installer-syntax.stderr.log) |
| `installer-binding` | **rc0** | [command](docs/evidence/603-reverify/r4/installer-binding.command.json) / [stdout](docs/evidence/603-reverify/r4/installer-binding.stdout.log) / [stderr](docs/evidence/603-reverify/r4/installer-binding.stderr.log) |
| `scheduler` | **rc0**; 480/480 PASS; fail=0, skipped=0 | [command](docs/evidence/603-reverify/r4/scheduler.command.json) / [stdout](docs/evidence/603-reverify/r4/scheduler.stdout.log) / [stderr](docs/evidence/603-reverify/r4/scheduler.stderr.log) |
| `scheduler-router` | **rc0**; 40/40 PASS; fail=0, skipped=0 | [command](docs/evidence/603-reverify/r4/scheduler-router.command.json) / [stdout](docs/evidence/603-reverify/r4/scheduler-router.stdout.log) / [stderr](docs/evidence/603-reverify/r4/scheduler-router.stderr.log) |
| `ekr-observation-cas` | **rc0**; 93/93 PASS; fail=0, skipped=0 | [command](docs/evidence/603-reverify/r4/ekr-observation-cas.command.json) / [stdout](docs/evidence/603-reverify/r4/ekr-observation-cas.stdout.log) / [stderr](docs/evidence/603-reverify/r4/ekr-observation-cas.stderr.log) |
| `ekr-broker` | **rc0**; 31/31 PASS; fail=0, skipped=0 | [command](docs/evidence/603-reverify/r4/ekr-broker.command.json) / [stdout](docs/evidence/603-reverify/r4/ekr-broker.stdout.log) / [stderr](docs/evidence/603-reverify/r4/ekr-broker.stderr.log) |
| `ekr-workflow` | **rc0**; 147/147 PASS; fail=0, skipped=0 | [command](docs/evidence/603-reverify/r4/ekr-workflow.command.json) / [stdout](docs/evidence/603-reverify/r4/ekr-workflow.stdout.log) / [stderr](docs/evidence/603-reverify/r4/ekr-workflow.stderr.log) |
| `ekr-runtime` | **rc0**; 12/12 PASS; fail=0, skipped=0 | [command](docs/evidence/603-reverify/r4/ekr-runtime.command.json) / [stdout](docs/evidence/603-reverify/r4/ekr-runtime.stdout.log) / [stderr](docs/evidence/603-reverify/r4/ekr-runtime.stderr.log) |
| `source-binding` | **rc0** | [command](docs/evidence/603-reverify/r4/source-binding.command.json) / [stdout](docs/evidence/603-reverify/r4/source-binding.stdout.log) / [stderr](docs/evidence/603-reverify/r4/source-binding.stderr.log) |
| `javascript-syntax` | **rc0** | [command](docs/evidence/603-reverify/r4/javascript-syntax.command.json) / [stdout](docs/evidence/603-reverify/r4/javascript-syntax.stdout.log) / [stderr](docs/evidence/603-reverify/r4/javascript-syntax.stderr.log) |
| `governance` | **rc0** | [command](docs/evidence/603-reverify/r4/governance.command.json) / [stdout](docs/evidence/603-reverify/r4/governance.stdout.log) / [stderr](docs/evidence/603-reverify/r4/governance.stderr.log) |
| `working-diff-check` | **rc0** | [command](docs/evidence/603-reverify/r4/working-diff-check.command.json) / [stdout](docs/evidence/603-reverify/r4/working-diff-check.stdout.log) / [stderr](docs/evidence/603-reverify/r4/working-diff-check.stderr.log) |
| `main-impact-merge-tree` | **rc0** | [command](docs/evidence/603-reverify/r4/main-impact-merge-tree.command.json) / [stdout](docs/evidence/603-reverify/r4/main-impact-merge-tree.stdout.log) / [stderr](docs/evidence/603-reverify/r4/main-impact-merge-tree.stderr.log) |
| `final-source-binding` | **rc0** | [command](docs/evidence/603-reverify/r4/final-source-binding.command.json) / [stdout](docs/evidence/603-reverify/r4/final-source-binding.stdout.log) / [stderr](docs/evidence/603-reverify/r4/final-source-binding.stderr.log) |
| `structure-final-source` | **rc0** | [command](docs/evidence/603-reverify/r4/structure-final-source.command.json) / [stdout](docs/evidence/603-reverify/r4/structure-final-source.stdout.log) / [stderr](docs/evidence/603-reverify/r4/structure-final-source.stderr.log) |
| `push-source` | **rc0** | [command](docs/evidence/603-reverify/r4/push-source.command.json) / [stdout](docs/evidence/603-reverify/r4/push-source.stdout.log) / [stderr](docs/evidence/603-reverify/r4/push-source.stderr.log) |
| `remote-source-readback` | **rc0** | [command](docs/evidence/603-reverify/r4/remote-source-readback.command.json) / [stdout](docs/evidence/603-reverify/r4/remote-source-readback.stdout.log) / [stderr](docs/evidence/603-reverify/r4/remote-source-readback.stderr.log) |
| `cached-diff-check` | **rc2**; REQUIRED_GATE_FAILURE | [command](docs/evidence/603-reverify/r4/cached-diff-check.command.json) / [stdout](docs/evidence/603-reverify/r4/cached-diff-check.stdout.log) / [stderr](docs/evidence/603-reverify/r4/cached-diff-check.stderr.log) |

所有 R4 load-bearing 原始 `.log`（包括空 stderr）、command.json 及历史 R2/R3 负向原文已显式暂存，但本轮 docs/evidence commit 和发布尚未完成；目前这些原文只在本 worktree，不声称远端可读。原始命令 runner 另存 r4/gate-runner.py 和 r4/delivery-runner.py；最终 docs Head、独立 delta review 和远端 readback 均未产生。

`changed-runtime` 原始 summary（完整原文另见上表 stdout）：

```text
ℹ tests 40
ℹ suites 0
ℹ pass 40
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 10616.356
```

`scheduler` 原始 summary（完整原文另见上表 stdout）：

```text
ℹ tests 480
ℹ suites 0
ℹ pass 480
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 24153.680166
```

`scheduler-router` 原始 summary（完整原文另见上表 stdout）：

```text
ℹ tests 40
ℹ suites 0
ℹ pass 40
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2185.139959
```

`ekr-observation-cas` 原始 summary（完整原文另见上表 stdout）：

```text
ℹ tests 93
ℹ suites 0
ℹ pass 93
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 13254.059583
```

`ekr-broker` 原始 summary（完整原文另见上表 stdout）：

```text
ℹ tests 31
ℹ suites 0
ℹ pass 31
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1573.245041
```

`ekr-workflow` 原始 summary（完整原文另见上表 stdout）：

```text
ℹ tests 147
ℹ suites 0
ℹ pass 147
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 12209.991
```

`ekr-runtime` 原始 summary（完整原文另见上表 stdout）：

```text
ℹ tests 12
ℹ suites 0
ℹ pass 12
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 206.5485
```

## D-009 符合性与证据关系

[独立 D-009 静态复核](docs/evidence/603-reverify/r4/independent-d009-review.md) fresh 核对受影响全部自动/self/operator/Router readback 写入入口：未发现 termination-only→failed 写入路径；该结果是语义审查 PASS，**没有伪造 shell rc**。动态 rc0 来源于完整 Scheduler、Scheduler-Router 和 changed-runtime 原文，包含 termination-only、迟到 outcome、aggregate fence、missing/stale/untrusted/conflicting evidence、one-shot/default OFF/no replay 等用例。

| EVD | 受影响 accepted obligation | Evidence / 结论（精确源码 tuple） |
|---|---|---|
| EVD-R4-001 | Alignment CTR-527D2-001，current D-009 precedence | authority blobs 对 base/source/current main 相同；旧 failed 增补未移植；静态独审 PASS |
| EVD-R4-002 | Alignment CTR-527D2-002/003；Timeout C-039 | Scheduler480 + Router40 + changed40 rc0；exact business failure 与 termination-only writer 分离，UNKNOWN+terminationSettlement、迟到业务追加与唯一 writer 保留 |
| EVD-R4-003 | Alignment CTR-527D2-004、CTR-S4；Timeout C-043 | default OFF/one-shot/缺证据零写；V2 before=after SHA256 `10cb327a7c7b62afc2dbbb71e868daece061cd36a9df6e768427017dadf039df`，mutations=0、upgrades=0，malformed/OFF/stop 用例 PASS |
| EVD-R4-004 | V3 CTR-V3TE-001..004 | 正式 source HEAD structure rc0/exact tuple；0 新违规、28 既有债、resolved=0；1315 行 installer 债和单 token 例外保留，非 debt closure |
| EVD-R4-005 | 直接依赖 B2/EKR 本地机制回归 | 原定 EKR/B2 四组283/283 rc0，双 SHA diagnostic 均精确绑定；不声称完整无人值守生产业务执行 |

[独立门证据复核](docs/evidence/603-reverify/r4/independent-gate-review.md) 重算日志 SHA256、逐一核对九键和完整矩阵；[正式源码 exact-HEAD 复核](docs/evidence/603-reverify/r4/independent-source-final-head-review.md) PASS，0 blocker / 0 Spec gap，无新语义。R2 structure 已通过且字节未变；本轮另在正式源码 HEAD 新跑 structure rc0，原文见表。

## main 前移的影响与未覆盖面

main 从 `1ff1e81c` 前移至 `bc69bff1`（#646），涉及相关 Store/validator/Router reconciliation。独立 [main impact review](docs/evidence/603-reverify/r4/main-impact-review.md) 确认 `_readDocRaw()` 默认仍 strict/pure-read，新历史兼容投影不成为 writer，未发现本 source 分支交付 blocker。`merge-tree` 仅只读文本兼容 rc0；**没有 rebase/合并，也未运行 bc69bff1+603 合并树的动态门**。所有 VERIFIED 仅属本收据原 implementation-base/source 字节元组；后续 merge/integration 须另绑定实际 tree。

四项非 CTR carryover 未整合；28 项结构债（含 `DEBT-V3TE-INSTALLER-1315`）未关闭。未运行无关全仓 npm test、installer、部署、启用或生产业务请求。没有 UNKNOWN 重放、清生产 fence、改变 writer 或安装状态。源码与本地机制 PASS 不等于生产/业务验收。

## 阶段 A 逐 commit 最终处置

| 源commit | 分类 | R4 最终实际结果 |
|---|---|---|
| `bd8f74c4` | c 范围外 | native env seam未整合，不声称main已覆盖 |
| `09c7e8b4` | c 范围外 | history env seam未整合 |
| `c0ec3c27` | b | TEMP diagnostic与revert净零，不整合 |
| `c50484b5` | b | main已覆盖moderator清理，不重复修改 |
| `4114c55e` | b | 精确revert，无独立残余 |
| `f9e02f87` | b | main已覆盖bind containment，不重复修改 |
| `e9a61dee` | c 范围外 | history retry及close/timer适配另案，未整合 |
| `1921f879` | c 范围外 | structured diagnostic安全适配另案，未整合 |
| `5049c6cd` | b | 作废D-009 failed增补未引入 |
| `67d2bb08` | a | 精确whitelist已在候选，blob=356899a8ec0726f245790379429f97dfc6ea3bfb、mode100644、1315行；结构门命中exact exception；未运行installer |
| `32f12a07` | b | 历史日志保留source Git对象，不复制旧PASS |
| `792127d5` | b | 复用main当前UNKNOWN/零写政策，不重建旧watchdog policy |
| `06fc0737` | b | 旧attribution仅历史保留 |
| `8dfd2854` | c 部分保留 | 生命周期/动态OFF/单inFlight/period/receipt drain在当前helper落地；R4 完整变化门40/40 rc0；本轮已验证组合接线、stop/drain、动态OFF、单inFlight和receipt排空 |
| `3b61dd1b` | b | 旧r3/pin-stop日志仅历史保留 |
| `4c24a9d5` | b | 旧decoder pin未引入；snapshot不改 |
| `e8b086e8` | b | 旧733行registry条目未引入；registry不改 |
| `815ac7c9` | b | 旧failed接受元数据/packet不移植；本收据独立如实记录 |

## 交付事实与停止

- `push-source` actual rc0，远端 `refs/heads/ac-ctr-s4-reverify` 精确读回源码 `87735ecee0e0ebfaa575f889785d7c5037ab9145`，原文见表。
- [PR source update readback](docs/evidence/603-reverify/r4/pr-source-update.json) 确认正文指向新分支、OPEN、merged=false。GitHub 无法改现有 PR head，故历史 PR diff 仍是 `ac-ctr-s4-runtime-prep`，不是本轮新候选 diff；没有创建第二 PR、关闭旧 PR 或强推旧 head。
- 完成收据/原始日志的 docs commit、最终 docs Head 复核及其 push/PR完成状态更新均 NOT_ATTEMPTED。PR已更新的source pointer原文仍包含“原始日志随documentation commit发布中”，失败后未继续改PR；该表述不是发布完成证明。
- 按末尾“失败即停照旧”停止，不修剪/规范化原始证据、不增加whitespace例外或绕过门；不合并、零生产写入。


## 最终失败事实与最小续行边界

`603-R4-GATE-001`：REQUIRED_GATE_FAILURE。

- SOURCE：Owner 要求全门 rc0、失败即停；阶段 A 已包含 whitespace/exact diff 交付检查。
- COUNTEREXAMPLE：R4 `cached-diff-check` 实际 rc2；stdout SHA256=`1869434ca6810f4bd274f05eaa49a40623f38132017eb9b31e38f61de4862e33`，stderr为空；完整 findings 未改写。
- 原文位置：`r2/candidate-working.diff`、`reviewed-product.diff`、`stopped-working.diff` 的 patch 空白上下文行（原文单空格）；`r4/push-source.stderr.log` 的 Git remote 原始行尾空格。不是本轮产品源码 whitespace 失败或动态产品回归。
- IMPACT / affected_readiness：[DOCS_DELIVERY_COMPLETE, TASK_DONE, FINAL_DOCS_PUSH_READY] = NO。源码提交、843项动态门、source结构及先前source push/PR更新均是已发生事实，不撤销、不冒充完整交付。
- MINIMAL_CLOSURE：后续明确续行处置证据原文与whitespace门范围，保留原字节和hash；本轮不裁定例外、不改raw日志、不新增.gitattributes、不重跑/忽略失败门。然后才能完成docs提交、最终delta及push/PR完成回读。

主agent在同一编排cell收到rc2后，其预先排入的下一步仅暂存了失败原文并冗余执行了一次相同diff-check（仍rc2）；无后续产品修改、测试、commit、push或PR写入。该多余复查不闭合失败；之后只补事实收据和只读审查。所有候选、暂存面和失败原文保留在当前worktree。
