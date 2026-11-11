# STOPPED-1377-B2 — PREFLIGHT / LOAD_BEARING SPEC_GAP

日期：2026-11-07（Asia/Shanghai）。目标：`mayf3/dsh-agent-core`。
本文件是停止记录，不是 Product Authority、实现收据或验收 PASS。

## 坐标与授权

- 唯一写面：`/private/tmp/h1377-b2`。
- `BASE_HEAD = REVIEW_TARGET_HEAD = 3c1bcf98bc40a2c34cca24f241c87d1b12cea216`。
- 本轮 `git ls-remote origin refs/heads/main` 返回同一 SHA；没有更新本地 base、rebase 或切换其他 worktree。
- 进入时为 detached HEAD；仅预置 `BRIEF-1377-B2.md` 未跟踪，tracked diff 为空。
- 用户执行授权：BRIEF-1377-B2 / 常设授权 #1 + 预授权 V1 §1；交付 PR 禁自合并、零生产写入、失败及 load-bearing SPEC_GAP 即停。
- `node_modules` 原链接为 `/private/tmp/dsh-ekr-p1-new/node_modules`，目录可达；Node 实测 `v26.7.0`。未创建、安装或修改依赖。
- #623 merge `2d550bc8147c877db33886fccb85e00a64353e66` 在本 HEAD 祖先链中；恢复规范 frontmatter 为 `accepted` / `implementation_authority: contracts` / `production_apply_authority: none`。

## 冻结的 DONE_WHEN（停止前的验收目标，均不表示已完成）

依据本地 Brief、[agent-control #1377 正文](https://github.com/mayf3/agent-control/issues/1377)及其唯一评论 [6645089851](https://github.com/mayf3/agent-control/issues/1377#issuecomment-6645089851)，本轮经 GitHub connector 读取：

1. 由现有正式自动入口发现 eligible `resolution_blocked`，经共享 `recoverAttempt` fresh gate、可信自动授权、同 ledger 持久下一触发，在依赖恢复及调度进程重启后无需人工继续；不另建恢复引擎。
2. #1377 的 ordinary `planned` 正向续接要求须有接受合同覆盖；可信写前记录、原 request 接收事实、精确旧执行/工具停止或不存在证明共同成立才可能续接原身份。不能仅把它作为拒绝负例，便声称完成 blocked/planned 全范围。
3. 故障矩阵区分 planned 已落盘未发送、delivery_started 后发送前、已接纳但 ACK 丢失；实际持久存储与真实进程/loopback 故障验证，已接纳/UNKNOWN 零二次投递。历史加载中撤权或目标变化拒绝；恢复后可再次读，重开存储后自动发现。
4. 原 attempt/request/generation/visit 身份、UNKNOWN、零 replay、零 fence 写、默认 OFF 保持；含旧代际、冲突、缺证据、无授权与并发自动/人工拒绝用例；Owner-resume 和主路径不回归。
5. 新针对性测试、observation-cas 全套、broker owner-obligation 6 条须实测 rc0 且保留原文；Docker/compose 未执行面明示 SKIP。独立受影响合同审查完成，RECEIPT 绑定实际 HEAD、调用链、变更与限制。
6. 仅在上述门通过后建立/交付 `feat/b2-auto-recovery`，push 并开 base=main PR；不合并。源码、安装启用、跨服务业务与无人值守结果分别报告。

## 权威库存及确定结论

已读 `.agents/README.md`、`.agents/local/README.md`、Product Architecture、Current Decision index、D-009 相关条款、`spec-governance` 的 PREFLIGHT 模式，以及直接相关 accepted Specs。检索了 `docs/specs/` 与 `docs/decisions/` 中 planned/recovery 条款；未发现本任务所需 ordinary planned 正向恢复的另一有效授权。

| 来源（本 HEAD 文件行号） | 对本次的有效约束 |
| --- | --- |
| `docs/specs/AGENT_CORE_WORKFLOW_RECOVERY_LIVENESS_V1.md:56–59` | 仅用既有 Scheduler/reconciler、ledger、正式入口；不扩展 B3 planned 恢复。 |
| 同文件 §8，159–166 | 明确接续 WAE 的 blocked 禁自动调用解释；因此不能继续以 WAE 旧禁 poll 条款阻挡已经授权的 B2。 |
| 同文件 CTR-EKRWAE-004，220–239 | 仅原 resolution_blocked（含合法历史 resolve_failed 投影），明确“不是普通 planned 恢复”；WAL、fresh Router 次级门、原执行/工具正面停止或不存在证据及 fresh world gate 全部保留。 |
| 同文件 CTR-EKRWAE-005，243–255 | B2 blocked 自动消费者、持久 next-check、重启重建和可信规则授权已有合同；人工 authorityRef 路径保留，无授权零写。 |
| 同文件 ACC-EKRWAE-005，299 | 历史 planned-only 是拒绝负例，并非新的正向恢复许可。 |
| `docs/specs/AGENT_CORE_WORKFLOW_AGENT_EXECUTION_V3.md:448–454` | 无 resolve_failed 证据的历史 planned-only 保持不可恢复，走原 delivery_unverified / NEEDS_REVIEW。 |
| D-009 §8.4/8.5，574–600；D009_ALIGNMENT CTR-527D2-002/003 | 可信业务结果、可信 exact termination-only、无可信证据三分；无证据不改 UNKNOWN、settlement 或 fence；终止不等于零业务副作用。 |

## SPEC_GAP-1377-B2-001

```text
FINDING_TYPE = SPEC_GAP
SPEC_GAP_DEPENDENCY = LOAD_BEARING
SOURCE = #1377 ordinary planned 正向续接要求，对照 accepted CTR-EKRWAE-004 与 §2
AUTHORITY_ACTION = SUPERSEDE (若保留普通 planned 正向恢复目标，需改变明确排除它的既有含义)
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = CONTROLLED (所缺决策涉及恢复授权/准入语义；本次不执行操作)
ROUTE_STAGE = AUTHORITY_AUTHORING (后继路线；本任务未授权起草/修改 governing Spec)
AUTHORITY_ACCEPTED_IN_BASE = NO (ordinary planned 所需后继合同；现有 B2 blocked 合同为 YES)
IMPLEMENTATION_ALLOWED = NO (当前完整 blocked/planned 交付范围)
MERGE_READY = NO
OPERATION_ALLOWED = NO
affected_readiness = [implementation, merge, operation]
NEXT_ACTION = RE_PREFLIGHT
```

**受影响动作：** 自动消费者对 ordinary planned 进行首次正向 admission，并宣称完成 #1377 的 blocked/planned 最小交付。

**缺失的长期决策：** accepted B2 明确仅接纳 resolution_blocked；它没有为普通 planned 决定可恢复证据类别、可信自动授权及崩溃边界。执行授权、issue、一次 authorityRef 或测试都不能改写这一排除。

**可达反例（源码推演，未执行故障实验）：** `attempt_planned` 已持久化，进程在解析失败事实和 `delivery_started` 写入前退出。重启时只留下 ordinary planned；#1377 要求在可信证据满足后续接，而 CTR-EKRWAE-004:221 明确排除普通 planned。裸 Router `never_existed`、无接收记录或 PID 消失均不能补出 PROVEN_ZERO；历史 planned-only 也不能重标为 resolution_blocked。

**影响：** 若扩展 gate 接纳该状态，就是超出现有 accepted Contract；若把它只测成负例而仍报告 #1377 完成，就是缩减 DONE_WHEN。不能由实现者静默择一。

**最小关闭：**

1. Owner 明确将本次范围/DONE_WHEN 收窄为 B2 resolution_blocked，并将 ordinary planned 正向恢复拆出。这样现有 B2 触发和 gate 可在新预检中走 REUSE；planned、delivery-domain 继续作为零 admission 负例，本单不得声称全量关闭 #1377。
2. 若保留普通 planned 正向续接要求，先 docs-first 接受覆盖它的恢复合同：精确 eligible 状态及来源、自动/人工授权、WAL/原 request 接收与停止证明、UNKNOWN/重启/并发/失败去向，再从含接受的 base 重新 PREFLIGHT。仅补 authorityRef 不足以关闭。

**已有有界路径：** B2 resolution_blocked 自身有合法自动触发权威，可在上述明确拆分后实施；它不能满足当前整个 #1377 planned 正向要求。用户规定发现 load-bearing gap 即停，本轮不继续这一子集。

## 代码观察与独立交叉核对

- `packages/production-runtime/src/workflow-execution-runtime.js:321–323` 已将真实 `router.resolveCallerCorrelation({requestId})` 接给正式恢复操作；`:456` 公开内部 `recoverAttempt`，当前无自动消费者。
- `packages/workflow-execution/src/engine.js:227–230` 对 resolution_blocked skip；普通 Owner-resume planned 是既有独立特例，不能借此扩大 ordinary planned。
- `packages/workflow-execution/src/recovery/operation.js:107–145` 当前有 authorityRef gate、phase gate、fresh Router 次级拒绝门；`:117–121` 对普通 planned 返回 `RECOVERY_INAPPLICABLE / not_pre_admission_blocked`。代码仅证明现状，不创建权限。
- 独立只读子审查 `/root/authority_audit` 得出同一结论；明确 B2 自动触发已合法，未发现需另外停写的 Router 入口封闭问题。它未写文件、未执行测试或生产操作。这是 PREFLIGHT 交叉核对，不是候选实现的独立验收 PASS。

## 执行结果与未交付面

- 在 PREFLIGHT 阶段停止，未改源码、测试、配置、治理文档或 `.agents/tools`；未写任何生产状态。
- 未建立交付分支、commit、push、PR 或合并；HEAD 保持上述 base。没有实现可供声称交付。
- 未运行针对性测试、observation-cas、broker 6 条或全仓测试：`NOT_RUN — PREFLIGHT LOAD_BEARING SPEC_GAP`，无测试 rc/PASS 可报告。Brief 给定 47/6 条基线仅为用户提供的历史信息，本轮未重跑，不作本轮证据。
- Docker/compose/跨服务业务/故障注入：`NOT_RUN — PREFLIGHT STOP`，不是 PASS 或 Docker 不可用结论。安装启用与业务效果：`UNKNOWN`。
- 只读路径探索曾查询两个不存在的猜测路径（`recovery/gates.js`、`ledger/projection.js`；后者所在查询 rc2）；不作为规范或测试证据。所引恢复实现是实际存在的 `recovery/operation.js`。
- 不生成成功交付性质的 `RECEIPT-1377-B2.md`；本 STOPPED 文件承接用户要求的失败出口。

## 实测 SHA-256

```text
a939403cbd83bf9636d2f55e439dddcbbfc3eb74c578db8d4e348d513323a481  docs/specs/AGENT_CORE_WORKFLOW_RECOVERY_LIVENESS_V1.md
c5d39e390026807b9e471a6875f5e0e9d15432f21a3d177733bf422fc751a1e6  docs/specs/AGENT_CORE_WORKFLOW_AGENT_EXECUTION_V3.md
1c37687e473df7ce977e5cc571f74d9a6dc0470f3aca95a599d4c9066e52321f  docs/decisions/SCHEDULER_OCCURRENCE_OUTCOME_V3.md
d8b07bc5ed280dae767015dbb437e1d52e596d3e84148f448593290beb3ba0ca  docs/specs/AGENT_DELIVERY_RESILIENCE_D009_ALIGNMENT_V1.md
73bf627490986e1a2ad30c123721dc0f5a3bcd54dabafde56aed136452023e73  BRIEF-1377-B2.md
```

## R2 续派：仅 blocked；本轮读取失败停止

日期：2026-11-07（Asia/Shanghai）。本节承接用户明确裁定的最小关闭选项 a：
**拆分，仅交付 blocked 自动恢复**。前文完整 blocked/planned 范围的停止结论属于历史；
`SPEC_GAP-1377-B2-001` 的 ordinary planned 依赖已从本次范围移除，不再作为 blocked
实施阻碍。ordinary planned 正向续接仍须 docs-first 另立合同，本次不得声称关闭该面。

### 本轮坐标与限定 DONE_WHEN

- 唯一写面仍为 `/private/tmp/h1377-b2`；进入本轮时 detached HEAD，
  `BASE_HEAD = 3c1bcf98bc40a2c34cca24f241c87d1b12cea216`，tracked diff 为空。
- 本轮只读 `git ls-remote origin refs/heads/main refs/heads/feat/b2-auto-recovery`
  rc0：main 为同一完整 SHA，未返回远端交付分支；本地同名分支查询亦为空。
- `node_modules` 原链接实测仍为 `/private/tmp/dsh-ekr-p1-new/node_modules`，目录可达，
  Node 实测 `v26.7.0`；未创建、安装或修改依赖。
- 执行授权为用户 R2 续派及原 Brief，零生产写入、单 worktree、不 rebase、push 开 PR
  不合并、失败即停；Product Authority 仍以 base 中 accepted Contracts 为准。
- 路由目标为 `REUSE / BRIEF / DURABLE / IMPLEMENTATION`：
  `CTR-EKRWAE-001/004/005/007` 的 blocked 消费者，不新建产品恢复权限。

冻结的 blocked-only DONE_WHEN（本轮均未验收完成）：

1. 既有 poll/reconcile 自动发现 eligible resolution_blocked，复用同一正式 recoverAttempt、
   FIFO/OwnerLock/fresh replay gate；同 ledger 持久 next-check、可信自动规则授权与精确
   trigger/attempt/request/generation 审计；依赖恢复及调度进程重启后无需人工继续。
2. 保留原身份、UNKNOWN、WAL、fresh Router 次级拒绝门、原执行和工具从未启动或合法停止
   证明及 world gate；并发自动/人工至多一次首次 admission，默认 OFF 不变。
3. 复用 observation-cas 真实进程/loopback 模式验证 blocked 后恢复、重启再发现、WAL 后
   崩溃及已接纳 ACK 丢失零二次投递；ordinary planned 仅为拒绝负例，不算正向交付。
4. 新针对性测试、文件展开的 observation-cas 全套、broker owner-obligation 6 条实测 rc0
   原文入收据；独立受影响合同审查通过；Docker/compose 未执行面如实标记。
5. 成功收据绑定实际 HEAD、调用链、变更和未交付面；交付 feat/b2-auto-recovery、push、
   base=main PR，不合并；源码、安装启用、跨服务业务及无人值守结果分别报告。

### 实际失败与停止动作

本轮停止原因是执行者读取错误，**不是新的 Product Authority 缺口**。

- 根执行者在读取现有 ledger 后误将 projection 拼到 recovery 子目录，批命令返回 rc1。
  原文错误：

  ```text
  cat: packages/workflow-execution/src/recovery/projection.js: No such file or directory
  exit_code: 1
  ```

  实际存在的模块为 `packages/workflow-execution/src/projection.js`。
- 并行只读审查 `/root/blocked_review` 也报告误读不存在的
  `packages/workflow-execution/src/readback/index.js`，批命令 rc1；该审查自行停止，
  不能记为独立候选验收 PASS。真实 readback 模块为
  `src/recovery/readback.js` 和 `src/recovery/readback-ledger.js`。
- 根执行者收到并行失败前，读取错误后仍进行了只读定位和现有源码读取；这是本轮实际
  过程，不能记为失败后立即停止。识别此问题后停止工作，仅追加本失败出口。

本轮实际写入仅本 STOPPED 续记；BRIEF 原文、源码、测试、配置、治理文档和
`.agents/tools` 均未修改。未创建交付分支、commit、push、PR 或 merge。

针对性测试 / observation-cas / broker 6 条：`NOT_RUN — R2 READ COMMAND FAILURE`，
无测试 rc0 可报告。Docker/compose/真实进程故障场景：`NOT_RUN`，不是 PASS，亦非
Docker 不可用结论。未生成成功性质的 RECEIPT；安装启用、业务结果与无人值守结果仍
`UNKNOWN`。

**未交付面：planned 半**（明确出圈，待 docs-first 合同另立）；本次范围内的 blocked
实现、自动消费者和真实进程验收也尚未交付，不能以已关闭原范围缺口冒充实现完成。

## R3 停止：必要独立合同审查 REVISE（2026-11-07）

R3 已完成 blocked-only PREFLIGHT、实现候选和隔离验收，停在**独立审查门**，不是只读路径错误或新的权威缺口。

- worktree：`/private/tmp/h1377-b2`；branch：`feat/b2-auto-recovery`。
- base：`3c1bcf98bc40a2c34cca24f241c87d1b12cea216`。
- 已提交/已测试/已审源码：`77b9644b2a6ff70cb6af2cf00bb134502a0eef8b`；测试后无源码 diff。
- 新针对性 **33/33 rc0**（含 5 个真实进程场景）；原 observation-cas **47/47 rc0**；broker **31/31 rc0**（其中要求的 owner-obligation-attempt 6 条全部通过）；受影响回归 **135/135 rc0**。
- 结构门 rc0：`CANDIDATE_DELTA_PASS_WITH_BASELINE_DEBT`，候选违规 0、既有 debt 28；不声称全仓无债务。
- 独立 reviewer `/root/blocked_scope_advice`：`REVISE`，冻结 blocker union `[B2-R3-REV-001]`，`SPEC_GAPS=0`。

**具体失败：** 自动 world drift 会记录 `recovery_refused` 并进入终态；自动消费者只选 ACTIVE/resolution_blocked，既有 readback 需要 delivered，Forum 也跳过该 refusal。持久 next-check 成了无消费者元数据，未形成 accepted `CTR-EKRWAE-004/007` 所需责任延续/可靠交接。已有测试只验证此分支零投递，不能证明拒绝后的责任闭环。

**最小关闭：** 在同一 accepted 合同内完成终态 refusal 的实际持久消费者/合法可靠交接，覆盖拒绝后重启、交接失败保留责任和合法答复/重新触发；保留 E3 终态 no-op、UNKNOWN、原身份、零二次 admission。不能假造 Assistance case 或冒用次数耗尽原因，不需另造 Spec。

收到该必要审查门失败后，根立即停止实现、修复、追加测试和 PR 交付，仅保存审查原文、实际日志、哈希、checkpoint 与本停止记录。**未 push、未开 PR、未 merge、零生产写入**；不进行本轮修复/重审循环。

完整失败收据：[RECEIPT-1377-B2.md](RECEIPT-1377-B2.md)。审查原文：[REVIEW-1377-B2-R3.md](docs/evidence/1377-b2-r3/REVIEW-1377-B2-R3.md)。原始执行证据：[docs/evidence/1377-b2-r3/](docs/evidence/1377-b2-r3/)。这些 R3 运行日志及停止收据保存在本 worktree，未在失败后另行提交或远端发布。

planned 半继续明确未交付（CTR-EKRWAE-004 排除）；本次 blocked-only 也因上述唯一审查 blocker 未完成，不能声称关闭 #1377。


## R4 停止：必要测试门 rc1（2026-11-07）

用户仅授权修复 B2-R3-REV-001；候选选择 accepted CTR-EKRWAE-003:203–205 /
004:238–239 / 005:243–255 / 007:278–285 的原自动责任保留方案：ACTIVE时同ledger持久
cadence，refusal后原poller只读消费，终态零追加；无新权限/传输面/第二账本。

实际branch HEAD仍 `77b9644b2a6ff70cb6af2cf00bb134502a0eef8b`；测试候选为无引用review commit object
`2419593722d4846ab6eda915e440af0c477c7e1e`，不是分支交付commit。四个源文件、三个测试文件及文档差量
均保留工作树。7语法检查和whitespace rc0；针对性46条 **44 pass / 2 fail / rc1**。
两失败为原真实进程 after-wal 与 Router acceptance/ACK-lost restart，均因 actual.errors
出现 duplicate reconciled 被terminal guard拒绝。新增13条（含refusal SIGKILL+两次重启）
通过，不能代替整门PASS。没有对照重跑，根因未定，不冒称旧环境噪声。

验收脚本在失败处退出。47/31/135、结构门及正式独立审查 **NOT_RUN**；停止修复、测试、
交付commit、push和PR，未merge、零生产写入。失败后仅只读提取日志和保存STOPPED/
RECEIPT/checkpoint/哈希；未修源码或测试、未重跑。R3原证据不变，原R3收据字节归档
`docs/evidence/1377-b2-r3/RECEIPT-1377-B2-R3.md`，原STOPPED历史原文保留。

完整失败收据：[RECEIPT-1377-B2.md](RECEIPT-1377-B2.md)。原文日志与可恢复patch：
`docs/evidence/1377-b2-r4/`。原审查blocker未正式验收闭合；planned半及生产面继续未交付。


## R5 处置：源码与隔离验收闭合（2026-11-07）

用户 R5 授权单一回归精修。原 phase CAS 前移至终态守卫之前，旧 ACTIVE 观察在写边界
返回 attempt_changed；明确终态追加仍 fail-loud。R4 义务仍在拒绝前持久登记，终态消费
零状态/事件变更，不追加 reconciled。R3/R4 历史原文不改。

实际源码 HEAD：`d3d4410c9184ca5d1c05607c5d47c3ca024b66c8`；测试/独立审查候选
`ba16e0529a7ac68683d076416106140fdd018009`，整个 packages 树相同。
针对性46、observation-cas全93（原47+33+新13）、broker31、回归135、额外ledger12均rc0；
结构rc0（候选违规0、历史debt28）。独立受影响审查PASS，B2-R3-REV-001与R5回归已在
该源码候选闭合。最终文档HEAD复核及push/base-main PR readback随交付PR持久绑定；不合并。

当前证据：[RECEIPT-1377-B2.md](RECEIPT-1377-B2.md) 和 docs/evidence/1377-b2-r5/。
旧停止状态为历史，不再表示R5测试或合同审查失败。planned-positive及生产/业务面仍排除，
安装启用/真实Svc DB/跨服务业务/全流程无人值守NOT_RUN/UNKNOWN，零生产写入。
