# RECEIPT-603-REVERIFY — R5 停止收据（打包完成，PR head 指令不受支持）

```text
STATUS = STOPPED_REQUIRED_GATE_FAILURE
TASK_DONE = NO
STAGE_A = COMPLETE_PRESERVED
STAGE_B = SOURCE_VERIFIED / DELIVERY_INCOMPLETE
SPEC_GOVERNANCE_MODE = COMPLIANCE
AUTHORITY_ACTION = REUSE
PLAN_LEVEL = EXEC_PLAN
ASSURANCE_LEVEL = DURABLE
ROUTE_STAGE = IMPLEMENTATION
AUTHORITY_ACCEPTED_IN_BASE = YES
EXECUTION_MANDATE = VALID (Owner R5, BRIEF)
EVALUATED_AT = 2026-11-07T05:12:39.390561+00:00
IMPLEMENTATION_STATE = COMPLETE
VERIFICATION_STATE = SUFFICIENT (unchanged affected source tuple)
CONFORMANCE_RESULT = UNKNOWN (PR head and final delivery incomplete)
IMPLEMENTATION_COMMIT = 87735ecee0e0ebfaa575f889785d7c5037ab9145
IMPLEMENTATION_TREE = d05d1ba63fe2e056e66f838a62811687be2d7925
IMPLEMENTATION_BASE = 1ff1e81cbd74a51761dab46a5fcee532c41fe4ed
R4_CURRENT_BASE_HEAD = bc69bff131c50af7357d39045b6d3084e5fd6fca
VERIFICATION_SNAPSHOT = 0f25ce5270c0964476184af509c5857acbdf1527
VERIFICATION_TREE = 63534a3f954004da8967cd1284df8915d11d5603
DELIVERY_DOCS_COMMIT = f1b1466b2645ec861c80bcb934db410ff544e6ca (LOCAL_ONLY)
DELIVERY_DOCS_TREE = 2f6d479cc93f885005ff743785a6b5a75909c0c0
BRANCH = ac-ctr-s4-reverify
WORKTREE = /private/tmp/h603-reverify
R4_BLOCKER_603-R4-GATE-001 = OWNER_DISPOSED_EXACT_VERBATIM_EXEMPTION
R5_CACHED_DIFF_CHECK = PASS rc0 (5 exact files / 56 coordinates exempt; all other staged checked)
FINAL_DOCS_HEAD_REVIEW = PASS (independent exact-HEAD delta, 0 blocker in packaging scope)
PUSH = SOURCE_PASS / DOCS_NOT_ATTEMPTED
PR_HEAD_UPDATE = FAILED rc1 (unknown flag: --head)
FINAL_PR_HEAD = ac-ctr-s4-runtime-prep @ 815ac7c94b1775eec3aa57f19ca8a3842f592217
FINAL_PR_STATE = OPEN / merged=false
R5_OPEN_BLOCKER = 603-R5-PR-001 / REQUIRED_GATE_FAILURE
EXPANSION_TRIGGERED = YES (required command failed; no scope expansion performed)
MERGE_READY = NO (not authorized)
OPERATION_ALLOWED = NO
PRODUCTION_WRITES = 0
DONE_WHEN_MET = NO
NEXT_ACTION = STOP (no further commit/push/PR write; facts only)
```

R5 只补授权的逐项 whitespace 豁免、证据打包和 PR 回执，不重做 R4 已通过修复或动态门。原始 R4 收据/停止记录逐字节保存在 [prior receipt](docs/evidence/603-reverify/r5/prior-RECEIPT-603-REVERIFY.md) 与 [prior stopped](docs/evidence/603-reverify/r5/prior-STOPPED-603-REVERIFY.md)。[preserved-evidence.json](docs/evidence/603-reverify/r5/preserved-evidence.json) 绑定全部 103 份已有证据 SHA256；R2/R3/R4 原日志和 R4 rc2 均不改写。

本轮 Owner 指定 `gh pr edit 603 --head ac-ctr-s4-reverify`；本机与官方接口的只读预查均未提供此能力，见 [capability review](docs/evidence/603-reverify/r5/pr-capability-review.md)。指定命令已实际执行并返回 rc1：`unknown flag: --head`。按失败即停，未继续 push 或 PR 写入；旧 PR 的正文链接不代表 head 已切换，任务未完成。

## 八门总表

| 门 | 结果与精确范围 | 证据 |
|---|---|---|
| 1. 结构 V3 | R4 source HEAD rc0，0 新违规、28 既有债；installer exact exception 保留 | r4/structure-final-source.command.json / stdout.log；CTR-V3TE-001..004 |
| 2. 变化与接线、installer | R4 40/40 rc0，原 13 项逐一 PASS；installer syntax/blob rc0 | r4/changed-runtime、installer-syntax、installer-binding 原始 command/stdout/stderr |
| 3. Scheduler | R4 480/480 rc0，fail/cancelled/skipped/todo=0 | r4/scheduler 原始 command/stdout/stderr |
| 4. Scheduler-Router | R4 40/40 rc0，同上 | r4/scheduler-router 原始 command/stdout/stderr |
| 5. EKR/B2 | R4 93+31+147+12=283/283 rc0，双 SHA 绑定 snapshot | r4/ekr-observation-cas、ekr-broker、ekr-workflow、ekr-runtime |
| 6. D-009 与源码独审 | R4 独审 PASS，0 blocker；termination-only 保持 UNKNOWN+terminationSettlement | r4/independent-d009-review.md、independent-gate-review.md、independent-source-final-head-review.md |
| 7. 静态/绑定/证据打包 | R4 JS/governance/source binding/working whitespace rc0；R4 cached 原 rc2 保留；R5 精确例外 cached gate 实测 rc0，其余全部 staged 全量过检 | 下方豁免表及 r5/cached-diff-check.command.json；final docs delta review PASS；最终 125-path index tree 与 docs commit tree 相等 |
| 8. 发布与 PR 回读 | 源码 87735ece R4 已 push；R5 docs commit 本地完成+独审 PASS；PR head 指令 rc1 后停止，docs 未 push；只读终态仍旧 head 815ac7c9、OPEN/unmerged | r4/push-source、remote-source-readback、pr-source-update.json；本轮回执另记 |

843 项动态 PASS 来自 R4 真实执行（40+480+40+283），本轮不伪称重跑。其字节绑定、D-009 与 main 影响范围沿用下述原始记录；docs-only 变动不改变这些产品/测试字节。

## 一次性 whitespace 豁免坐标与理由

Owner R5 沿用 #642 同类处置：原始证据字节保真优先。仅下面 5 个精确哈希文件、56 处坐标豁免，不能扩展为目录/后缀/未来日志的通行规则。原始失败 stdout 的 28 处是对同一批豁免字节的逐字回显，显式纳入同源 raw 日志保真范围。

| 路径（docs/evidence/603-reverify/ 下） | 精确行号 | 理由 |
|---|---|---|
| `r2/candidate-working.diff` | 22, 25, 44, 48, 50, 166, 182, 190, 528 | patch 空白上下文行原文为单个 ASCII 空格；修剪会改变 verbatim patch |
| `reviewed-product.diff` | 8, 11, 30, 34, 36, 144 | 复查 patch 空白上下文行原文为单个 ASCII 空格 |
| `stopped-working.diff` | 8, 11, 30, 34, 36, 144, 159, 167, 446 | 停止时 patch 空白上下文行原文为单个 ASCII 空格 |
| `r4/push-source.stderr.log` | 1, 2, 3, 4 | Git remote push stderr 原始行尾空格；原文与既有 command hash 必须一致 |
| `r4/cached-diff-check.stdout.log` | 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46, 48, 50, 52, 54, 56 | R4 失败门 raw stdout 对上述 patch/push 豁免字节逐字回显；同源保真豁免，不改原 rc2 |

每个原始文件 SHA256、理由和行坐标见 [whitespace-exemptions.json](docs/evidence/603-reverify/r5/whitespace-exemptions.json)。执行 [checker](docs/evidence/603-reverify/r5/check-cached-whitespace.py) 先核五个 index blob 的哈希/坐标及 worktree 字节，再核全部 103 份历史原文和源码/权威 staged 零差异，然后仅对上述五条路径添加 exact pathspec exclude，对其余全部 staged 文件运行原 `git diff --cached --check`。不改 raw 日志、不加 `.gitattributes`、不改 Git whitespace 配置、不把旧 rc2 改写为 rc0。[独立打包初审](docs/evidence/603-reverify/r5/independent-packaging-review.md) 复核原始坐标和 38/38 R4 stdout/stderr 哈希；完整 Git 门以实际执行回执为准。

## R4 原有门与证据绑定（保留，不冒充 R5 重跑）

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

上述 R4 原始 `.log`（包括空 stderr）、command.json 及历史 R2/R3 负向原文由本次 docs 打包保留；其完整原文、真实 rc 与既有哈希不变。原始 runner 保留在 r4/gate-runner.py 和 r4/delivery-runner.py。R5 发布状态只以上方现态与后续真实读回为准；R4 cached-diff-check rc2 是历史结果。

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

## R5 打包门实际执行

[cached command](docs/evidence/603-reverify/r5/cached-diff-check.command.json) / [stdout](docs/evidence/603-reverify/r5/cached-diff-check.stdout.log) / [stderr](docs/evidence/603-reverify/r5/cached-diff-check.stderr.log) 记录真实 argv、UTC、rc0 与 SHA256。首次检查的 index tree=`4ad9fa67deea22732344bc297cbb8c72a3cbf2ae`、119 个 staged 文件、5 个精确豁免文件；其余 114 个 staged 文件由 Git 原规则全量检查。证据添加与本收据更新后，commit 前再次对最终 index 全量运行同一精确 checker，避免把早期 index 冒充最终树。

[PR preflight](docs/evidence/603-reverify/r5/pr-preflight.json) 确认 head=`ac-ctr-s4-runtime-prep` / `815ac7c94b1775eec3aa57f19ca8a3842f592217`，state=`open`、merged=false。[remote preflight command](docs/evidence/603-reverify/r5/remote-preflight.command.json) / [stdout](docs/evidence/603-reverify/r5/remote-preflight.stdout.log) 实测 rc0，整合分支=`87735ecee0e0ebfaa575f889785d7c5037ab9145`、旧分支=`815ac7c94b1775eec3aa57f19ca8a3842f592217`、main=`bc69bff131c50af7357d39045b6d3084e5fd6fca`。这是操作前读回，不是 PR head 已改变或 docs 已发布的证据。

## R5 最终实际回执与停止边界

1. 最终暂存检查实际 **rc0**：125 个 staged 文件，5 个精确豁免，其他 120 个 staged 文件全量过 Git 原 whitespace 规则。`final-index-check.command.json` / stdout / stderr 保存原文；checked index tree=`2f6d479cc93f885005ff743785a6b5a75909c0c0`，与随后 docs commit tree 精确相同。
2. docs commit 实际 **rc0**：`f1b1466b2645ec861c80bcb934db410ff544e6ca`，parent=`87735ecee0e0ebfaa575f889785d7c5037ab9145`。该 commit 包含 R4 全证据、R5 豁免与打包门、当时如实 PR_PENDING 的收据；[commit readback](docs/evidence/603-reverify/r5/docs-commit-readback.json) 记录 SHA/tree。独立 [final-HEAD delta review](docs/evidence/603-reverify/r5/independent-final-head-review.md) PASS、0 blocker/Spec gap（打包范围）；103 份历史原文哈希全部匹配，无产品/测试/权威变化。
3. Owner 指定 `gh pr edit 603 --head ac-ctr-s4-reverify` 实际 **rc1**，stderr 首行 `unknown flag: --head`。完整 [command](docs/evidence/603-reverify/r5/pr-head-edit.command.json) / [stdout](docs/evidence/603-reverify/r5/pr-head-edit.stdout.log) / [stderr](docs/evidence/603-reverify/r5/pr-head-edit.stderr.log) 已原样保存，stderr SHA256=`a4e28b07a297c1b81e133e4578fced34747ced89694b8606c8bafa6314533ebd`；R5 [FAILED.json](docs/evidence/603-reverify/r5/FAILED.json) 保留停止点。没有网络 PR edit 成功证明。
4. 失败后未再 commit、push 或写 PR。只读 [PR final readback](docs/evidence/603-reverify/r5/pr-final-readback.json) 确认 head=`ac-ctr-s4-runtime-prep` / `815ac7c94b1775eec3aa57f19ca8a3842f592217`，state=`open`、merged=false；[remote final readback](docs/evidence/603-reverify/r5/remote-final-readback.stdout.log) 实际 rc0，整合分支仍=`87735ece`、旧分支仍=`815ac7c9`、main仍=`bc69bff1`。这是停止后的只读核对，不是继续交付或 docs 已 push。
5. 本次停止收据、STOPPED 以及 final-index/commit/独审/PR失败与终读回 appendices 均为 **docs commit 之后的本地事实记录，尚未提交、尚未发布**。不冒称这些后产生文件已在 `f1b1466b` 内或远端可读。根收据包含八门总表、56 处豁免坐标与真实 PR 回执；`TASK_DONE=NO`。

### 当前唯一阻塞 603-R5-PR-001

- CLASS：REQUIRED_GATE_FAILURE；当前记录 schema_version=2。
- SOURCE：Owner R5 第③步要求把 PR603 head 指向整合分支，以及“失败即停”。
- COUNTEREXAMPLE：本机 gh 2.100.0 执行指定命令 rc1；本机 help、官方 CLI/REST/GraphQL 更新接口及已连接工具均无更换现有 PR head 分支参数，见 capability review。没有把 --base、update-branch 当作等价替代。
- IMPACT / affected_readiness：[PR_HEAD_POINTS_TO_INTEGRATION, DOCS_DELIVERY_PUBLISHED, TASK_DONE] = NO。R4 源码/843 项动态门、R5 精确豁免门、docs 本地 commit 和打包独审的 PASS 不撤销。
- MINIMAL_CLOSURE：Owner 调整不受平台支持的第③步交付方式并另行续行；本轮不擅自新建/关闭 PR、不强推或覆盖旧 head、不改 base 来冒充 head。保留本地 docs commit 和所有原始回执，后续可沿用打包 PASS。

## R5 当前边界

不合并、不关闭或强推历史分支、不部署、不启用、不运行 installer、不重放 UNKNOWN。指定 PR head 操作若失败，立即停止后续 push/PR 写入，只补事实收据；不得以正文链接、新 PR 或其他未授权远端操作冒充 head 已变更。
