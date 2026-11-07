# RECEIPT-603-REVERIFY — R7 续行收据

```text
STATUS = PACKAGING_PASSED_DELIVERY_PENDING
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
R7_PACKAGING_GATE = PASS rc0; prepublication-cached-check.command.json
NEW_PR = NOT_CREATED
PR603_COMMENT = NOT_ATTEMPTED
PR603_CLOSE = NOT_ATTEMPTED
MERGE_READY = NO (not authorized)
PRODUCTION_OPERATION_ALLOWED = NO
PRODUCTION_WRITES = 0
DONE_WHEN_MET = NO
NEXT_ACTION = DOCS_COMMIT_PUSH_THEN_CREATE_PR; STOP_ON_FAILURE
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
| 8 发布/PR 生命周期 | R4 source 已 push；R7 docs commit/push/create/comment/close 待执行，#603 预读 OPEN/unmerged | `r7/*preflight.command.json` |

843/843 动态 PASS=40+480+40+283，fail/cancelled/skipped/todo 均为0。复用 R4 真执行，本轮未重跑；[R7 独立证据复核](docs/evidence/603-reverify/r7/independent-evidence-review.md) 验证15组门/30个 stdout-stderr SHA256，产品/测试/authority 相对 snapshot 无差异。source、package 与验证 snapshot 产品字节相同。新 PR 独立产品审查由监管另派，本次不代替该审查。

## 阶段 A 与保留的边界

[18 commits 完整逐项评估](ASSESSMENT-603-REVERIFY.md)：a=1（67d2bb08 精确 installer whitelist）；b=12（已取代/抵消/历史，包含5049c6cd死D-009增补）；c=5（8dfd2854仅生命周期适配，另四项 native env/history env/retry/diagnostics 范围外不整合、不声称 main 已覆盖）。旧源815ac7c9及其 Git 历史保留，逐项最终处置沿 prior receipt 链可核查。

R4 V2 缺证据负测 before/after SHA256 均为 `10cb327a7c7b62afc2dbbb71e868daece061cd36a9df6e768427017dadf039df`，mutations=0、upgrades=0；纯读 `_readDocRaw()` 不迁移/归一化 V1/V2。D-009 accepted #610 alignment：termination-only 保持 outcome_unknown+terminationSettlement，缺证明零 authoritative 写入；aggregate fence/default OFF/no retry/replay 保留。

九键子进程配方：`HTTP_PROXY`、`HTTPS_PROXY`、`http_proxy`、`https_proxy`、`ALL_PROXY`、`all_proxy`、`NO_PROXY`、`no_proxy`、`NODE_USE_ENV_PROXY` 全部显式 unset；R4 实测全不存在，Node v25.6.1，双 EKR SHA=0f25ce5270c0964476184af509c5857acbdf1527。R7 打包门沿完整九键前缀；网络操作继承网络环境，Secret 值不记录。未改主机/依赖/guard。

main bc69bff1 的相关影响已有独立静态审查及 merge-tree 文本兼容 rc0，未执行 bc69bff1+603 合并树动态门；843 PASS 仅绑定原 base/source 元组。四项范围外 carryover、28项结构债未闭合；未跑无关全仓 npm test、installer、部署、启用或业务请求。源码/本地机制 PASS 不等于生产或业务验收。

## R7 实际进展

已持久化 R7 授权与配方、保存R6根收据原文、核对唯一写面、预读 main/两分支 SHA 无漂移，#603 OPEN/旧 head/unmerged，新 head 的 all-state PR list=[]。原始160文件快照及旧证据哈希保留；仅继续 B方案。新正文草稿仅在打包/推送实证满足后发布，不把草稿当远端结果。

R7 类豁免门已真实执行 rc0，stdout/stderr 均为空（SHA256 均为 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`）；精确 argv、UTC、HEAD 与 index tree 绑定见 command/binding。commit、push、PR 创建/旧 PR 处置尚未执行；待独立候选复核后续行。

独立 [prepublication delta review](docs/evidence/603-reverify/r7/independent-prepublication-review.md) PASS/0 blocker，覆盖原始保真、类排除范围及待发布正文；已知收尾更新后执行最终 index 检查，精确提交复核随后进行。
