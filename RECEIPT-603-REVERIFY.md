# RECEIPT-603-REVERIFY — R7 停止收据（PR替代完成，终态包装器失败）

```text
STATUS = STOPPED_REQUIRED_GATE_FAILURE
EVALUATED_AT = 2026-11-07T05:30:14.998939+00:00
CONFORMANCE_RESULT = UNKNOWN (delivery incomplete; unchanged source PASS preserved)
TASK_DONE = NO
SPEC_GOVERNANCE_MODE = PREFLIGHT
AUTHORITY_ACTION = REUSE
PLAN_LEVEL = EXEC_PLAN
ASSURANCE_LEVEL = DURABLE
ROUTE_STAGE = OPERATION (nonproduction PR/docs only)
EXECUTION_MANDATE = VALID (R7 class ruling + R6 B scheme)
AUTHORITY_ACCEPTED_IN_BASE = YES
IMPLEMENTATION_STATE = COMPLETE_PRESERVED
IMPLEMENTATION_COMMIT = 87735ecee0e0ebfaa575f889785d7c5037ab9145
IMPLEMENTATION_BASE = 1ff1e81cbd74a51761dab46a5fcee532c41fe4ed
VERIFICATION_SNAPSHOT = 0f25ce5270c0964476184af509c5857acbdf1527
CURRENT_BASE_HEAD = bc69bff131c50af7357d39045b6d3084e5fd6fca
START_HEAD = f1b1466b2645ec861c80bcb934db410ff544e6ca
BRANCH = ac-ctr-s4-reverify
WORKTREE = /private/tmp/h603-reverify
RULING_ID = 603-R7-RAW-CLASS-001
603-R6-GATE-001 = OWNER_DISPOSED_BY_R7 (rc2 preserved)
R7_PACKAGING_GATE = PASS rc0; prepublication-cached-check and final-index-check
R7_TERMINAL_WRAPPERS = FAILED (3 wrapper rc1; nested git write-tree rc128; target NOT_INVOKED)
R7_OPEN_BLOCKER = 603-R7-GATE-001 / REQUIRED_GATE_FAILURE
DOCS_COMMIT = c87a78b175c5a5da5d661ee2ef8435021bbdceef
DOCS_PUSH_READBACK = MATCH
CURRENT_LOCAL_AND_REMOTE_HEAD = c87a78b175c5a5da5d661ee2ef8435021bbdceef
FINAL_RECEIPT_COMMIT_PUSH = NOT_ATTEMPTED_AFTER_FAILURE
NEW_PR = https://github.com/mayf3/dsh-agent-core/pull/647 ; OPEN / mergedAt=null
NEW_PR_HEAD = ac-ctr-s4-reverify @ c87a78b175c5a5da5d661ee2ef8435021bbdceef
PR603_COMMENT = https://github.com/mayf3/dsh-agent-core/pull/603#issuecomment-6702809150
PR603_CLOSE = CLOSED / mergedAt=null / closedAt=2026-11-07T05:27:57Z
PR603_CLOSE_EVENT = 35415829874
PR603_HISTORICAL_HEAD = 815ac7c94b1775eec3aa57f19ca8a3842f592217 (preserved)
MERGE_READY = NO (not authorized)
PRODUCTION_OPERATION_ALLOWED = NO
PRODUCTION_WRITES = 0
DONE_WHEN_MET = NO
DEPENDENT_FINAL_DELIVERY_READY = NO
EXPANSION_TRIGGERED = YES (new required command failure)
NEXT_ACTION = STOP; FACTS_ONLY; NO_RETRY_REPAIR_COMMIT_PUSH_PR_WRITE
```

## 类豁免裁定与台账环境配方

监管用户 R7（2026-11-07）一次性通用裁定，全仓后续交付适用，坐标 [Brief R7](BRIEF-603-REVERIFY.md#r7-通用监管裁定与续行授权2026-11-07)，稳定记录 ID `603-R7-RAW-CLASS-001`。verbatim 机器原始捕获件的固有空白属于内容，字节保真优先：

```sh
git diff --cached --check -- . ':(exclude)docs/evidence/**/*.diff' ':(exclude)docs/evidence/**/*.stderr' ':(exclude)docs/evidence/**/*.stdout' ':(exclude)docs/evidence/**/*.log'
```

仅上述原始件按类豁免；收据、`.md`、`.json`、`.mjs`、脚本等编成件仍全量过检。已同步 [阶段 A 台账环境配方](ASSESSMENT-603-REVERIFY.md#交付台账环境配方r7-通用裁定) 与 [机器配方](docs/evidence/603-reverify/r7/environment-recipe.json)。不修改历史 R4/R5/R6 rc、原始日志、旧豁免或 .gitattributes。R6 收据/停点原文见 [prior receipt](docs/evidence/603-reverify/r7/prior-RECEIPT-603-REVERIFY.md) / [prior stop](docs/evidence/603-reverify/r7/prior-STOPPED-603-REVERIFY.md)，初始 160 文件哈希见 [initial-state](docs/evidence/603-reverify/r7/initial-state.json)。

## 八门总表

| 门 | 实际结果、范围 | 证据（docs/evidence/603-reverify/） |
|---|---|---|
| 1 结构 V3 | R4 source rc0；0 新违规、28 既有债；installer exact exception/1315 行债保留 | `r4/structure-final-source.command.json` 与 stdout/stderr |
| 2 变化/接线/installer、零写修复 | R4 40/40 rc0；原 13 项全 PASS；installer syntax/blob rc0；缺证据纯读哈希一致、mutation=0、upgrade=0 | `r4/changed-runtime.*` stdout:90–91；`installer-syntax.*`、`installer-binding.*`；`r2/independent-source-review.md` |
| 3 Scheduler | R4 480/480 rc0 | `r4/scheduler.*` |
| 4 Scheduler-Router | R4 40/40 rc0 | `r4/scheduler-router.*` |
| 5 EKR/B2 | R4 93+31+147+12=283/283 rc0，双 EKR SHA 绑定 snapshot | `r4/ekr-observation-cas.*`、`ekr-broker.*`、`ekr-workflow.*`、`ekr-runtime.*` |
| 6 D-009/源码独审 | R4 PASS、0 blocker；termination-only UNKNOWN+terminationSettlement；缺证明零 authoritative 写入 | `r4/independent-d009-review.md`、`independent-gate-review.md`、`independent-source-final-head-review.md` |
| 7 静态/绑定/原文打包 | R4 JS/governance/source binding rc0；R4/R6 cached rc2 与 R5 exact 豁免 rc0 保留；R7 类豁免门 rc0（2026-11-07T05:24:45.036841+00:00） | `r7/environment-recipe.json`；`r7/prepublication-cached-check.command.json`、`prepublication-check-binding.json` |
| 8 发布/PR 生命周期 | R4 source 已 push；R7 docs c87a78b1 已 commit/push，#647 OPEN，#603 评论+close 完成且 CLOSED/unmerged；终态包装器失败，最终收据仅本地未发布 | `r7/docs-commit.*`、`push-docs.*`、`new-pr-create.*`、`old-pr-comment*`、`old-pr-close*`、`postfailure-*-readonly.command.json`、`FAILED.json` |

843/843 动态 PASS=40+480+40+283，fail/cancelled/skipped/todo 均为0。复用 R4 真执行，本轮未重跑；[R7 独立证据复核](docs/evidence/603-reverify/r7/independent-evidence-review.md) 验证15组门/30个 stdout-stderr SHA256，产品/测试/authority 相对 snapshot 无差异。source、package 与验证 snapshot 产品字节相同。新 PR 独立产品审查由监管另派，本次不代替该审查。

## 阶段 A 与保留的边界

[18 commits 完整逐项评估](ASSESSMENT-603-REVERIFY.md)：a=1（67d2bb08 精确 installer whitelist）；b=12（已取代/抵消/历史，包含5049c6cd死D-009增补）；c=5（8dfd2854仅生命周期适配，另四项 native env/history env/retry/diagnostics 范围外不整合、不声称 main 已覆盖）。旧源815ac7c9及其 Git 历史保留，逐项最终处置沿 prior receipt 链可核查。

R4 V2 缺证据负测 before/after SHA256 均为 `10cb327a7c7b62afc2dbbb71e868daece061cd36a9df6e768427017dadf039df`，mutations=0、upgrades=0；纯读 `_readDocRaw()` 不迁移/归一化 V1/V2。D-009 accepted #610 alignment：termination-only 保持 outcome_unknown+terminationSettlement，缺证明零 authoritative 写入；aggregate fence/default OFF/no retry/replay 保留。

九键子进程配方：`HTTP_PROXY`、`HTTPS_PROXY`、`http_proxy`、`https_proxy`、`ALL_PROXY`、`all_proxy`、`NO_PROXY`、`no_proxy`、`NODE_USE_ENV_PROXY` 全部显式 unset；R4 实测全不存在，Node v25.6.1，双 EKR SHA=0f25ce5270c0964476184af509c5857acbdf1527。R7 打包门沿完整九键前缀；网络操作继承网络环境，Secret 值不记录。未改主机/依赖/guard。

main bc69bff1 的相关影响已有独立静态审查及 merge-tree 文本兼容 rc0，未执行 bc69bff1+603 合并树动态门；843 PASS 仅绑定原 base/source 元组。四项范围外 carryover、28项结构债未闭合；未跑无关全仓 npm test、installer、部署、启用或业务请求。源码/本地机制 PASS 不等于生产或业务验收。

## R7 进展与停止前快照

已持久化 R7 授权与配方、保存R6根收据原文、核对唯一写面、预读 main/两分支 SHA 无漂移，#603 OPEN/旧 head/unmerged，新 head 的 all-state PR list=[]。原始160文件快照及旧证据哈希保留；仅继续 B方案。新正文草稿仅在打包/推送实证满足后发布，不把草稿当远端结果。

R7 类豁免门已真实执行 rc0，stdout/stderr 均为空（SHA256 均为 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`）；精确 argv、UTC、HEAD 与 index tree 绑定见 command/binding。以上是门通过时的历史快照；其后的实际动作与停止事实以下节为准。

独立 [prepublication delta review](docs/evidence/603-reverify/r7/independent-prepublication-review.md) PASS/0 blocker，覆盖原始保真、类排除范围及待发布正文；已知收尾更新后执行最终 index 检查，精确提交复核随后进行。

## R7 实际动作与远端终态

1. 类豁免 prepublication 门 rc0，独立候选review PASS；final-index-check rc0。docs commit `c87a78b175c5a5da5d661ee2ef8435021bbdceef`，tree=`8835f604c7ce7a1ab23a78f2607d1e4db3008f6e`，精确等于受检index；53个变更文件仅为四根任务文档和docs/evidence。独立 [docs final-HEAD review](docs/evidence/603-reverify/r7/independent-docs-head-review.md) PASS/0 blocker。随后普通FF push rc0，SHA真读回一致，main/旧head未变。
2. `gh pr create` rc0，新 PR [#647](https://github.com/mayf3/dsh-agent-core/pull/647) OPEN、base main、head c87a78b1，正文与预备文件精确读回匹配（忽略末尾换行差异），包含阶段A/八门/supersedes声明。未合并，新产品独审仍监管另派。
3. #603 [评论6702809150](https://github.com/mayf3/dsh-agent-core/pull/603#issuecomment-6702809150) 已发布，created_at=2026-11-07T05:27:40Z；API读回id与body一致，含新链接、评估/收据、依据及可重开声明。`gh pr close 603` rc0；关闭event id35415829874、actor mayf3、2026-11-07T05:27:57Z。未删分支、未改旧head。
4. 随后终态收据捕获包装器失败，按失败即停停止后续commit/push/PR写。仅作 [postfailure old/new PR](docs/evidence/603-reverify/r7/postfailure-old-pr-readonly.command.json) / [new](docs/evidence/603-reverify/r7/postfailure-new-pr-readonly.command.json) / [remote](docs/evidence/603-reverify/r7/postfailure-remote-readonly.command.json) 事实只读核对：#603 CLOSED/unmerged/旧head815ac7c9，#647 OPEN/unmerged/c87a78b1；main=bc69bff1，整合远端=c87a78b1，全部真实rc0。

## 当前唯一阻塞 603-R7-GATE-001

- CLASS=`REQUIRED_GATE_FAILURE`，schema_version=2；SOURCE=R7失败即停、Brief承继R6任一新命令失败停止边界。
- COUNTEREXAMPLE：主agent给通用capture-command.py添加`git write-tree`作为index_tree元数据后，错误地并行四个终读回wrapper，共用本worktree index。`old-pr-final-readback`、`new-pr-final-readback`、`remote-lifecycle-readback` 在metadata `check_output`发生index.lock冲突，nested git rc128、wrapper rc1。异常位于record.write_text及subprocess.run(target)之前，**三个目标readback均NOT_INVOKED**；没有伪造目标命令rc或command.json。`old-pr-close-event`同批wrapper实际成功rc0，仅用于事实。
- 失败证据：[FAILED.json](docs/evidence/603-reverify/r7/FAILED.json)与三个`*.wrapper-tool-output.log`，每份工具返回combined UTF8输出SHA256=`283d34cbcea92e4c390b989d5610740c38e052e81a4bf557a34de8d5269c6479`。该证据是工具返回合并文本的逐字转录；原生stdout/stderr分流未被包装器捕获，保持UNKNOWN。未将转录冒称原生分流。
- IMPACT / affected_readiness：`[FINAL_RECEIPT_PUBLISHED,TASK_DONE]=NO`。R7 whitespace rc0、原843/source/D009/结构PASS、已发布c87a78b1及已完成两PR生命周期事实均保留。不是产品机制失败。
- MINIMAL_CLOSURE：监管授权续行后，限于串行或不写共享index的包装器收尾与最终收据归档/提交/推送；无需重建PR、重复评论/close、重做source或动态门。本轮不自动修复、不重试wrapper、不删锁、不再commit/push。锁自然消失已只读记录，不等于批准恢复交付。

## 发布边界与可续行坐标

Git已发布的最后提交为c87a78b1，内含R7裁定、台账配方、prepublication门与发布前收据；其后的commit/push/create/comment/close/只读终态证据及本完成停止收据均为本地未提交事实，不冒称已在远端。终态补证预留目录`/private/tmp/h603-r7-terminal-20261107T052615Z`仅有准备脚本，最终receipt commit/push未执行。后续沿现有#647与c87a78b1接续即可，零生产写入，不合并。

独立 [停止事实终审](docs/evidence/603-reverify/r7/independent-stop-review.md) PASS仅证明本停止记录准确，不代表交付完成；OPEN_BLOCKERS=1，NEW_BLOCKERS=0，NEXT_ACTION=STOP。三份新增失败`.log`按现有ignore规则留在本地，后续获授权归档时需纳入精确文件清单，当前不stage。
