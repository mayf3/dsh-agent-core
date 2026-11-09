# RECEIPT-603-REVERIFY — R6 停止收据（B方案发布前打包门 rc2）

```text
STATUS = STOPPED_REQUIRED_GATE_FAILURE
TASK_DONE = NO
EVALUATED_AT = 2026-11-07T05:19:16.903784+00:00
SPEC_GOVERNANCE_MODE = PREFLIGHT
AUTHORITY_ACTION = REUSE
PLAN_LEVEL = EXEC_PLAN
ASSURANCE_LEVEL = DURABLE
ROUTE_STAGE = OPERATION (nonproduction PR/docs only)
EXECUTION_MANDATE = VALID (user R6 B scheme; BRIEF)
AUTHORITY_ACCEPTED_IN_BASE = YES
IMPLEMENTATION_STATE = COMPLETE_PRESERVED
VERIFICATION_STATE = SUFFICIENT_FOR_UNCHANGED_R4_SOURCE_TUPLE
CONFORMANCE_RESULT = UNKNOWN (R6 delivery incomplete; no product PASS revoked)
IMPLEMENTATION_COMMIT = 87735ecee0e0ebfaa575f889785d7c5037ab9145
IMPLEMENTATION_BASE = 1ff1e81cbd74a51761dab46a5fcee532c41fe4ed
VERIFICATION_SNAPSHOT = 0f25ce5270c0964476184af509c5857acbdf1527
CURRENT_BASE_HEAD = bc69bff131c50af7357d39045b6d3084e5fd6fca
LOCAL_HEAD = f1b1466b2645ec861c80bcb934db410ff544e6ca (R5 docs; unchanged)
REMOTE_INTEGRATION_HEAD = 87735ecee0e0ebfaa575f889785d7c5037ab9145
BRANCH = ac-ctr-s4-reverify
WORKTREE = /private/tmp/h603-reverify
R5_603-R5-PR-001 = OWNER_DISPOSED_B_SCHEME (original rc1 preserved)
R6_CACHED_DIFF_CHECK = FAILED rc2
R6_OPEN_BLOCKER = 603-R6-GATE-001 / REQUIRED_GATE_FAILURE
R6_NEW_COMMIT = NOT_ATTEMPTED
R6_PUSH = NOT_ATTEMPTED
NEW_PR = NOT_CREATED (all-state head query returned [])
NEW_PR_HEAD_SHA_STATE = NOT_APPLICABLE_NO_PR
PR603_COMMENT = NOT_ATTEMPTED
PR603_CLOSE = NOT_ATTEMPTED
FINAL_PR603_HEAD = ac-ctr-s4-runtime-prep @ 815ac7c94b1775eec3aa57f19ca8a3842f592217
FINAL_PR603_STATE = OPEN / mergedAt=null / closedAt=null
MERGE_READY = NO (not authorized)
DEPENDENT_DELIVERY_READY = NO
PRODUCTION_OPERATION_ALLOWED = NO
PRODUCTION_WRITES = 0
EXPANSION_TRIGGERED = YES (new required packaging-gate failure)
DONE_WHEN_MET = NO
NEXT_ACTION = STOP (facts only; no retry/unstage/repair/push/PR write)
```

R6 用户已用 B方案替代 R5 不受支持的 head 切换命令；旧 `603-R5-PR-001` 操作依赖已由该修正消解，不重试 `--head`、不强推、不向旧分支合并。实际完成了持久化授权、证据/远端只读核对、PR 正文草稿及打包准备，尚未执行 B方案的任何远端写操作。原 R5 最终停止事实逐字保存为 [prior receipt](docs/evidence/603-reverify/r6/prior-RECEIPT-603-REVERIFY.md) / [prior stopped](docs/evidence/603-reverify/r6/prior-STOPPED-603-REVERIFY.md)，原始证据哈希见 [initial-state](docs/evidence/603-reverify/r6/initial-state.json)。

## 八门总表

| 门 | 实际结果、范围 | 证据（docs/evidence/603-reverify/） |
|---|---|---|
| 1. 结构 V3 | R4 source rc0；0 新违规、28 既有债；installer exact exception/1315 行债保留 | `r4/structure-final-source.command.json` 与 stdout/stderr |
| 2. 变化/接线/installer、零写修复 | R4 40/40 rc0；原 13 项全 PASS；installer syntax/blob rc0；V2 缺证据纯读前后文件哈希一致、mutation=0、upgrade=0 | `r4/changed-runtime.*` stdout:90–91；`installer-syntax.*`、`installer-binding.*`；`r2/independent-source-review.md` |
| 3. Scheduler | R4 480/480 rc0 | `r4/scheduler.*` |
| 4. Scheduler-Router | R4 40/40 rc0 | `r4/scheduler-router.*` |
| 5. EKR/B2 | R4 93+31+147+12=283/283 rc0，双 EKR SHA 绑定 snapshot | `r4/ekr-observation-cas.*`、`ekr-broker.*`、`ekr-workflow.*`、`ekr-runtime.*` |
| 6. D-009/源码独审 | R4 PASS、0 blocker；termination-only 保持 UNKNOWN+terminationSettlement，缺证明零 authoritative 写入；本轮只复核证据，不冒充重审产品 | `r4/independent-d009-review.md`、`independent-gate-review.md`、`independent-source-final-head-review.md` |
| 7. 静态/绑定/原文打包 | R4 JS/governance/source binding rc0；R4 cached rc2 保留；R5 精确 5 文件/56 坐标豁免后 rc0。**R6 cached rc2**：新增归档 R5 gh 原始 stderr 的 11 坐标不在豁免内 | `r5/whitespace-exemptions.json`、`final-index-check.command.json`；`r6/prepublication-cached-check.command.json`、`FAILED.json` |
| 8. 发布/PR 生命周期 | R4 source 已 push；R5 docs 仍本地。R6 新 commit/push/create/comment/close 均 NOT_ATTEMPTED；新 PR 不存在，#603仍 OPEN/旧 head/unmerged | `r6/remote-final-readonly.command.json`、`old-pr-final-readonly.command.json`、`new-pr-final-readonly.command.json` |

843/843 动态 PASS = 40+480+40+283；各组 fail/cancelled/skipped/todo=0，均来自 R4 真实执行，本轮未重跑。15 份 R4 门 stdout/stderr 的哈希由独立只读核对匹配；source、package 与验证 snapshot 的产品/测试/权威字节不变，见 [R6 evidence packaging review](docs/evidence/603-reverify/r6/independent-prepublication-review.md)。R5 final-HEAD delta 的 PASS 仍只绑定 `f1b1466b`，不冒称 R6 未提交 staged 候选已通过。

## 18 commits 三分类与实际去留

[阶段 A 逐 commit 评估](ASSESSMENT-603-REVERIFY.md) 未修改：a=1（`67d2bb08` 精确 installer whitelist）；b=12（已取代/抵消/历史保留，包含 `5049c6cd` 死 D-009 增补）；c=5（`8dfd2854` 生命周期部分适配；另四项 native env/history env/retry/diagnostics 范围外不整合、不声称 main 已覆盖）。完整逐 commit 最终实际结果仍可从上述 prior receipt 的“阶段 A 逐 commit 最终处置”检索。旧源 `815ac7c9` 及其 Git 历史不动。

## 零写修复、D-009 和九键处置

R4 V2 缺证据负测实测 before/after SHA256 均为 `10cb327a7c7b62afc2dbbb71e868daece061cd36a9df6e768427017dadf039df`，mutations=0、upgrades=0。纯读 `_readDocRaw()` 不迁移/归一化 V1/V2，返回 UNKNOWN；只有合法 V3、配置开启及 trusted exact evidence 才进入原 planner/writer。当前 D-009 依 accepted #610 alignment，termination-only 保持 `outcome_unknown` 并追加 `terminationSettlement`；缺证明零 authoritative 写入、aggregate fence/默认 OFF/no retry/replay 保留。

R4 所有测试/静态门子进程显式 unset `HTTP_PROXY`、`HTTPS_PROXY`、`http_proxy`、`https_proxy`、`ALL_PROXY`、`all_proxy`、`NO_PROXY`、`no_proxy`、`NODE_USE_ENV_PROXY`，实测九键全不存在；使用既有 `/usr/local/bin/node` v25.6.1，EKR_SOURCE_SHA/EKR_TEST_SOURCE_SHA 均为 `0f25ce5270c0964476184af509c5857acbdf1527`。R6 cached 门也使用完整九键清洁前缀。未改主机环境、依赖或 guard；网络只读使用继承环境，Secret 值不记录。

## R6 本次实际动作及失败原文

1. 新增 R6 Brief 授权、[preflight](docs/evidence/603-reverify/r6/preflight.json)、143 文件初始哈希快照（包含根文档及所有已有 evidence），保存 R5 根收据/停止记录原文。核对 R5 进程已退出，唯一写面仍是本 worktree。
2. 独立只读证据/正文打包检查 PASS；[新 PR 正文草稿](docs/evidence/603-reverify/r6/new-pr-body.md) 含精确 supersedes 声明、18 commits 分类、八门及原坐标限制。草稿“docs 已发布”是成功 push 后发布的条件句，**当前没有发布，不能把该草稿当实际远端事实**。
3. 暂存 R5 收尾附录与 8 份原始日志、R6 文档。全量 cached 门仍只豁免原 5 个 exact 文件/56 坐标；**新纳入的 `r5/pr-head-edit.stderr.log` 未被豁免**。
4. [R6 cached command](docs/evidence/603-reverify/r6/prepublication-cached-check.command.json) 实测 rc2，输出逐字 base64+UTF-8 保存，SHA256：stdout=`4c5dd611274cf9e34bb343725473ea3ba38a2b9988ad995d201c6acc20e7c825`，stderr=`e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`；[FAILED.json](docs/evidence/603-reverify/r6/FAILED.json) 与 command 记录一致。原 R5 stderr SHA256=`a4e28b07a297c1b81e133e4578fced34747ced89694b8606c8bafa6314533ebd`，与旧 command/staged blob 均相同，未修剪。失败坐标为 **63,66,69,72,75,78,81,84,87,90 行**（每行为两个 ASCII 空格后换行），及 **101 行 EOF 空行**。
5. 立即停止，不重跑、不修剪 raw、不扩豁免、不加 .gitattributes、不撤出 staged 文件来绕过失败、不 commit/push、不创建/评论/关闭 PR。只补事实收据及只读终态。失败后的新记录为本地未提交事实，不冒称在 `f1b1466b` 或远端 `87735ece` 内。

## 当前唯一阻塞 603-R6-GATE-001

- `CLASS=REQUIRED_GATE_FAILURE`，`schema_version=2`。
- SOURCE：R6“其余保持/失败即停”、R5 exact verbatim 豁免范围（仅 5 文件/56 坐标）与其余 staged 全量 whitespace 门。
- COUNTEREXAMPLE：R5 gh help 原始 stderr 的新增归档文件有上述 11 处 whitespace，既不在原豁免范围，也不能在未授权时修剪原文；R6 checker 真实 rc2。
- IMPACT / affected_readiness：`[R6_DOCS_DELIVERY_PUBLISHED, NEW_PR_CREATED, PR603_SUPERSEDED_CLOSED, TASK_DONE]=NO`。只影响新打包/交付，不撤销原 source 843/843 与 D-009/结构门 PASS。
- MINIMAL_CLOSURE：监管对该新增原始 stderr 的精确归档/豁免方式作后续处置并续行；沿用 B方案与现有分支/已通过证据。未自动修复或重试，未请求额外产品 Spec。

## 真读回与未覆盖面

失败后只读终读回：整合分支=`87735ecee0e0ebfaa575f889785d7c5037ab9145`；旧分支=`815ac7c94b1775eec3aa57f19ca8a3842f592217`；main=`bc69bff131c50af7357d39045b6d3084e5fd6fca`。#603 URL=https://github.com/mayf3/dsh-agent-core/pull/603，OPEN、mergedAt=null、closedAt=null、head 仍旧分支；新 head 的 all-state PR 查询为 `[]`。因此没有新 PR URL/SHA/state，也没有 #603 评论或关闭坐标可报告；未虚构回执。

main 从原 base 前移到 bc69bff1 的相关影响只有独立静态审查/merge-tree 文本兼容 rc0，未执行 bc69bff1+603 合并树动态门。四项非 CTR carryover、28 项结构债仍未闭合；未跑无关全仓 npm test、installer、部署、启用或生产业务。独立产品审查由监管另派，未写 GitHub review、未合并。零生产写入；源码/本地机制 PASS 不等于安装、运行时或业务验收。
