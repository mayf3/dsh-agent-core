# RECEIPT-603-REVERIFY

```text
STATUS = STOPPED_REQUIRED_REVIEW_FAILURE
TASK_DONE = NO
STAGE_A = COMPLETE_LOCAL_COMMITTED
STAGE_B = INCOMPLETE_UNVERIFIED
HEAD = 91e224bc079f26cef285cba6da0872cb640ed330
BASE_HEAD = 1ff1e81cbd74a51761dab46a5fcee532c41fe4ed
BRANCH = ac-ctr-s4-reverify
WORKTREE = /private/tmp/h603-reverify
SOURCE_PR_HEAD = 815ac7c94b1775eec3aa57f19ca8a3842f592217
FROZEN_BLOCKER_UNION = [603-REVIEW-001]
PRODUCTION_WRITES = 0
PUSH = NOT_ATTEMPTED
PR_UPDATE = NOT_ATTEMPTED
MERGE = NOT_ATTEMPTED
```

本次没有达到“整合+全门 rc0+push”的完成定义。依据用户“失败即停”约束，在独立受影响合同审查失败时停止，未修复失败候选。停止点见 [STOPPED](STOPPED-603-REVERIFY.md)，完整逐 commit 评估、权威与执行依赖见 [阶段 A](ASSESSMENT-603-REVERIFY.md)。不把计划、测试定义或源码审查当作已执行测试。

## 实际动作与候选绑定

阶段 A 在只读核对全部 18 个 parent patches、当前 main 权威和远端 PR 后先落文件。随后创建新分支，实际 commit 输出为：

```text
Switched to a new branch 'ac-ctr-s4-reverify'
[ac-ctr-s4-reverify 91e224bc] docs: assess all 18 PR603 commits before CTR-S4 integration
 2 files changed, 114 insertions(+)
 create mode 100644 ASSESSMENT-603-REVERIFY.md
 create mode 100644 BRIEF-603-REVERIFY.md
```

此 HEAD 仅提交 BRIEF 和阶段 A 评估。阶段 B 的六个源码/测试文件修改均**未提交、未验证、未推送**：

| 文件 | 实际改动 |
|---|---|
| `scripts/trusted-cp-deploy-install.sh` | 只应用 `67d2bb08` whitelist 插入；实际 blob `356899a8ec0726f245790379429f97dfc6ea3bfb`，1315 行；未运行 installer。 |
| `production-runtime/src/scheduler/auto-reconcile-runtime.js` | 迁移 stop/inFlight/configured/锁内 evidence wrapper/receipt drain/period 校验，保留 main writer；其中 loadDoc 规划读取有明确阻断，不能使用。 |
| `production-runtime/src/scheduler/composition-runtime.js` | 返回 loop handle，未验证。 |
| `production-runtime/src/compose.js` | 500 行不增长；关闭列表先 drain loop，未验证。 |
| `production-runtime/test/scheduler/scheduler-invoker-canary.test.js` | 323 行隔离测试候选，未执行；保留原 canary，用当前 Router/JobStore 适配生命周期与 D-009 oracle。 |
| `production-runtime/test/workflow-execution-shutdown.test.js` | 新增 compose timer/read gate 排空测试，279 行，未执行。 |

以上 package 路径均位于 `packages/`。测试编写 agent 已被停止；未继续写产品。实际未提交差异：375 additions / 41 deletions，6 文件。原样快照 [stopped-working.diff](docs/evidence/603-reverify/stopped-working.diff)，SHA256：

```text
97b6ab2023001868f229bf5040f279744a28bd8ac1a35244c4090de388e073cf
```

独审的四个产品文件 diff：[reviewed-product.diff](docs/evidence/603-reverify/reviewed-product.diff)，SHA256：

```text
1c65a0b85be434886c45514b180de860837f5bdd1a0f1147b13d5ba422a42947
```

每文件实测 SHA256、Git blob、行数、base/head/tree、UTC 时间在 [stopped-coordinates.json](docs/evidence/603-reverify/stopped-coordinates.json)。没有声称存在已提交的阶段 B HEAD；准确绑定是上述 HEAD 加工作区 diff。

## 逐 commit 实际处置

| Commit | 分类 | 本轮实际结果 |
|---|---|---|
| `bd8f74c4` | c | native env seam 范围外，未移植；main 尚缺，不声称覆盖。 |
| `09c7e8b4` | c | history env seam 范围外，未移植；main 尚缺。 |
| `c0ec3c27` | b | 与 revert 净零，未移植。 |
| `c50484b5` | b | main 已覆盖，未重复修改。 |
| `4114c55e` | b | 抵消 TEMP 诊断，未移植。 |
| `f9e02f87` | b | main 已覆盖 containment，未重复修改。 |
| `e9a61dee` | c | history retry 需另案清理timer/close，非CTR依赖，未移植。 |
| `1921f879` | c | 诊断转发需安全适配且范围外，未移植。 |
| `5049c6cd` | b | 被裁定取代的 D-009 failed 增补，未引入。 |
| `67d2bb08` | a | 精确 whitelist 补丁已在工作区；因停止未提交/验证。 |
| `32f12a07` | b | 历史证据保留 source Git 对象；未复制 PASS。 |
| `792127d5` | b | 复用 main 当前零写政策；未另建旧watchdog政策。 |
| `06fc0737` | b | 历史 attribution，不复制为当前证据。 |
| `8dfd2854` | c | 仅生命周期意图适配到当前 helper；候选审查失败，未提交。旧failed writer/decoder/eligibility未移植。 |
| `3b61dd1b` | b | 历史日志/pin-stop，不复制为当前证据。 |
| `4c24a9d5` | b | 旧 decoder pin 未引入；snapshot 未修改。 |
| `e8b086e8` | b | 旧733行registry条目未引入；registry未修改。 |
| `815ac7c9` | b | failed接受元数据、旧packet均未移植；本收据独立记录未完成状态。 |

## 审查与所有门的真实状态

[独立审查原文](docs/evidence/603-reverify/independent-review.md)：`/root/audit_gates`、AUTHOR_INDEPENDENCE=PASS、CONTRACT_REVIEW=FAIL、603-REVIEW-001。反例通过源码调用链确认，**尚未动态执行**。临时“V3正常输入即可排除”判断被撤回。具体缺陷是本次候选 loadDoc 的自动迁移副效应，不是 D-009 的 authority conflict，也不是 main 三态 writer 的改动。

| 门 | 实际结果 / rc |
|---|---|
| 独立 affected-Contract 源码审查 | FAIL；非命令执行，没有 shell rc |
| 结构 V3 + adapted verifier | NOT_RUN；rc=NOT_APPLICABLE |
| 新增/变化测试、compose/shutdown | NOT_RUN；rc=NOT_APPLICABLE |
| Scheduler 全套 | NOT_RUN；rc=NOT_APPLICABLE |
| Scheduler-Router 全套 | NOT_RUN；rc=NOT_APPLICABLE |
| EKR/B2 指定完整回归面 | NOT_RUN；rc=NOT_APPLICABLE |
| D-009 动态符合性 / termination-only→failed 零路径验证 | NOT_RUN；rc=NOT_APPLICABLE。静态只确认当前 Scheduler 源码未改及旧failed模型未移植，不冒称动态符合性PASS。 |
| syntax/governance/whitespace gates | NOT_RUN；rc=NOT_APPLICABLE |
| 故障反例运行 | NOT_RUN；rc=NOT_APPLICABLE |

因此没有全门 rc0 原文；未运行的门不伪造 rc。日志仅保存实际源码观察、diff 和独审。读文件、git diff/hash/status 等检查不冒充产品门。

停止后 `git ls-remote` 的实际 stdout（read-only rc=0）仍为：

```text
815ac7c94b1775eec3aa57f19ca8a3842f592217	refs/heads/ac-ctr-s4-runtime-prep
1ff1e81cbd74a51761dab46a5fcee532c41fe4ed	refs/heads/main
```

目标 `refs/heads/ac-ctr-s4-reverify` 无返回项，尚未创建远端分支。PR603 未更新，旧head保持原值。

## 未覆盖面与续行边界

全部动态测试/结构门/打包与部署/启用/业务验收未覆盖。legacy read 的反例未执行；不据源码推导实际生产状态。四项非 CTR carryover（两类 env seam、history retry、structured diagnostic）仍未整合。旧结构债、installer拆分责任、旧runtime基线问题均未修复，不引用旧PASS证明本次候选。

后续需有续行授权才修复 603-REVIEW-001；最小方案见 STOPPED，不需要重做已完成阶段 A，也不需要重新裁决已明确作废的 D-009 failed 增补。当前工作区是可审查的失败候选和恢复点，不能部署或合并。
