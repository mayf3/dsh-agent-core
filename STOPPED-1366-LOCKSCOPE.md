# STOPPED-1366-LOCKSCOPE

状态：`STOPPED — PREFLIGHT LOAD_BEARING SPEC_GAP`。
记录时间：2026-11-07 12:26 UTC / 20:26 Asia/Shanghai。
本记录是执行停止与差量诊断，不是新 Product Authority、实现收据或验收 PASS。

## 授权、坐标与实际动作

- 用户授权：`BRIEF-1366-LOCKSCOPE.md` / 本轮 Owner 审查增量③及预授权 V1§1；
  零生产写入，限定锁范围收缩与精确重检，失败或 SPEC_GAP 即停。
- 定义来源：[agent-control #1366 正文](https://github.com/mayf3/agent-control/issues/1366)，
  本轮通过 GitHub connector 实际读取，正文 updated_at=`2026-11-04T23:30:42Z`；
  并读取 [Owner 评论](https://github.com/mayf3/agent-control/issues/1366#issuecomment-6645104786)。
  Issue/评论提供任务方向和执行范围，不替代 accepted governing Contracts。
- 唯一写面：`/private/tmp/h1366-lockscope`，已存在的隔离 worktree，detached HEAD。
- `BASE_HEAD = REVIEW_TARGET_HEAD = CURRENT_BASE_HEAD = 24974c720d634b965943e08bfd0862657b9be0e1`。
  本轮 `git ls-remote origin refs/heads/main refs/heads/fix/lock-scope-reduction` rc0 原文：

  ```text
  24974c720d634b965943e08bfd0862657b9be0e1	refs/heads/main
  ```

  未返回远端交付分支。未 fetch/rebase/switch，未建立本地交付分支。
- #1367 前置已在基线：`24974c72 Merge pull request #654 ... fix/diagnostic-read-separation`。
  不重做该面或 #1358。
- 实测 Node `v26.7.0`；`node_modules` 为既有链接
  `/private/tmp/dsh-ekr-p1-new/node_modules`，目录存在；只验证，未安装或重链。
- 本轮只有只读权威/源码/远端引用核对及本 STOPPED 文件写入。进入时 tracked diff 为空，
  只有用户提供的 Brief 未跟踪。独立子审查 `/root/authority_check` 只读、无测试、无写入。

## 当前路由

```text
schema_version = 2
SPEC_GOVERNANCE_MODE = PREFLIGHT
TARGET_REPOSITORY = mayf3/dsh-agent-core
GOAL_OR_TARGET = 外部 I/O 不占整份 ledger 锁；原子提交前精确重检；保持原一致性/UNKNOWN/单 writer
CURRENT_GAP = 现有 admission 跨远端 await 持锁；accepted 合同明确要求若干远端读取持同一锁
AUTHORITY_ACTION = SUPERSEDE
ROUTE_STAGE = AUTHORITY_AUTHORING
PRIMARY_AUTHORITY = AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V3 / CTR-WEC1-008 @ BASE_HEAD
RELATED_AUTHORITIES = AGENT_CORE_WORKFLOW_STALE_REENTRY_V2 / CTR-SRE-002;
  AGENT_CORE_WORKFLOW_AGENT_EXECUTION_V3; AGENT_CORE_WORKFLOW_RECOVERY_LIVENESS_V1;
  SCHEDULER_OCCURRENCE_OUTCOME_V3; AGENT_DELIVERY_RESILIENCE_D009_ALIGNMENT_V1
AUTHORITY_ACCEPTED_IN_BASE = NO (所需替代锁语义尚未接受；现有 WEC/SRE 合同已接受并在 base)
IMPLEMENTATION_AUTHORITY = contracts (现有合同；不含此次替代时序)
ATOMIC_SPEC_IMPLEMENTATION_PERMITTED = NO (SUPERSEDE docs-first)
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = DURABLE
EXECUTION_MANDATE = VALID (用户范围及停止条件；不创设 Product Contract)
MUTATION_AUTHORIZATION = VALID (本轮仅停止记录；产品改动已停)
ISOLATED_WRITE_SURFACE = YES
CONTROLLED_RUNBOOK_REQUIRED = NO (本轮没有生产操作)
SPEC_GAP_DEPENDENCY = LOAD_BEARING
EVIDENCE_REVIEWABILITY = PASS (静态权威/源码坐标；无执行测试证据)
LIVE_AUTHORITY_GAP = NONE (未检查生产状态，不据此宣称生产合规)
OWNER_DECISION_REQUIRED = YES (先接受有界锁语义后继；本轮不索取或推定批准)
BASE_IMPACT = NONE (本轮远端 main 与 base 相同)
IMPLEMENTATION_ALLOWED = NO
MERGE_READY = NO
OPERATION_ALLOWED = NO
EXPANSION_TRIGGER = 为满足锁外 I/O 目标而替换 accepted 持锁读取义务，已触发
NEXT_ACTION = RE_PREFLIGHT
NEXT_REAL_ACTION = 经另行授权 docs-first 接受下列有界差量，再从含接受的 base 接续实现
```

## SPEC-GAP-1366-LOCKSCOPE-001

`finding_type = SPEC_GAP`；`dependency = LOAD_BEARING`；
`affected_readiness = [IMPLEMENTATION_ALLOWED, MERGE_READY]`，均为 `NO`。

**SOURCE / 直接冲突：**

1. `docs/specs/AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V3.md:222–227`，
   `CTR-WEC1-008`：

   > Before appending `attempt_planned` for EVERY new attempt (generation 1,
   > stale re-entry, and Owner-resume), Core MUST perform a fresh pre-plan read of
   > the exact current activation/visit/assignee and workflow state version while
   > holding the existing ledger admission lock.

   这是所有新 attempt 的明文时序义务，不只是 Owner-resume 的可选路径。
   同一 planned append 须保存原 pre-delivery version，读取失败或不匹配零 mint/零 delivery。
2. 同文件 `259–265`：

   > Core requests evidence with the latest attempt's own ID and durable pre-delivery
   > baseline, under the same admission lock.

   Owner-resume evidence 的 current version 还必须等于新 attempt 的 fresh pre-plan version。
   将该远端请求移到锁外也改变 accepted 含义。
3. `docs/specs/AGENT_CORE_WORKFLOW_STALE_REENTRY_V2.md:179–182`，`CTR-SRE-002`：

   > `workflowStateVersionAtDispatch` is captured by ONE instance-detail read (AS
   > THE TARGET AGENT) immediately after a successful delivery, inside the
   > existing admission completion callback (same locked-mutation discipline as
   > the delivery itself).

   全面移出 delivery/detail await 还影响这项 dispatch-time baseline 的时点与锁纪律。

**权威清单与现行性：** 已读 `.agents/README.md`、`.agents/local/README.md`、governance lock、
Product Architecture、Decision index、D-009 相关当前模型，以及直接相关 WAE V3、WEC V3、
SRE V2、Recovery-liveness V1 条款和 D009 alignment。WEC V3 frontmatter 为
`accepted / implementation_authority: contracts / superseded_by: null`；
`docs/specs/README.md:397` 将其列为 accepted whole successor。
WEC 文件最后提交 `d53dfb23d3385fad000cccfed4f31a45ee57517c`；
SRE V2 最后提交 `caaf016f3ab0a5ed4c8bf244486f6b275dd092c1`，均存在于本 base。
Recovery-liveness V1 `:170` 明确 PRESERVE `CTR-WEC1-008`，`:52–59` 保留既有锁，
其接受的恢复授权并未替换上述 WEC 锁语义。

`.agents/README.md:99,139,150` 将 accepted meaning 的替换路由为 whole-authority
`SUPERSEDE`、docs-first；不能用新稳定 ID 或同 PR Spec+code 绕过这一门。
本轮使用的技能为 [spec-governance](.agents/skills/spec-governance/SKILL.md)，其明文：

> Load-bearing SPEC_GAP -> AMEND/SUPERSEDE/NEW + readiness NO + RE_PREFLIGHT.

并遵守用户 Brief 第3项及失败出口；这不是要求先完成整体锁架构重构。

**COUNTEREXAMPLE / 可达调用链（静态推导，未执行 RED）：**

1. A 的合法新 admission 进入 `ledger-admission.js:85–88` 的 `ledger.mutate`，
   随后 `:124–125` 等待 `prepareLedgerAttemptPlan`。
2. `owner-assistance-resume-engine.js:28–35` 的 resolver/detail 远端 await 未返回；
   Owner-resume 还会在 `:39–43` 等待 evidence 远端请求。
3. `ledger.js:265–277` 用整份 ledger 的 `_queue` 和 `OwnerLock.runExclusive` 包住回调；
   `scheduler/src/store/lock.js:290–297` 直到 `await fn()` 结束才 release。
   不同 visit B 的合法 admission 因而排在同一 FIFO 后面。
4. 仅把 `attemptPolicy` 移出锁，仍保留步骤2的必需锁内读取，不能满足本单外部 I/O 不持整锁的
   完整 DONE_WHEN。在锁内重新进行远端读取以遵守原合同，也恢复同一队头阻塞。
5. 若仅在锁外取得 version V，等待重新取锁期间 Svc 的 visit/assignee/version 已改变而 Core
   本地 ledger 未变，单独比较本地 attempt/generation 不能证明外部前置仍成立。精确重检仍须
   定义可信的外部版本/身份绑定与漂移拒绝；不能宣称本地 CAS 等价于当前明确要求的锁内读取。

**IMPACT：** 全目标实现依赖改变已接受的读取/投递时序。不能把它静默作为 REUSE 内部选择；
也不能通过只修改 policy 的子集便声称 #1366 外部 I/O 已全部锁外。没有任何本轮运行的吞吐、
队头阻塞或 DB 并发测量可报告。

**MINIMAL_CLOSURE / 精确差量：** 在另行授权的 docs-first 权威任务中接受有界锁语义后继，
保持未变的义务完整，明确上述 WEC/SRE 条款允许哪些远端观察/投递在锁外，以及重新取锁后的
原 attempt/request/generation、dispatch/instance/visit/assignee、授权与所需外部版本的精确
提交重检、前置漂移拒绝、Owner permit 单次消费、WAL/完成事件和并发/崩溃处置。
保留 D-009、UNKNOWN、原写前记录、单次 admission 与单 writer；不可将晚读取冒充原 baseline。
外部事实如何可信绑定是该差量须决定的内容，本停止记录不自创其产品协议。
这只处理为本单必需的时序规则，不扩成新 Effects 平台、第二 ledger 或整体锁架构重构。
接受并进入 base 后，实际实现作为新 REUSE 任务重新 PREFLIGHT。

**移除依赖的已有有界路径：** 单独收缩没有固定锁内读取义务的 policy 等局部 await，可能作为
另行明确限定的任务评估，但仍不能满足当前完整目标；本轮没有该范围收窄裁定。
用户已指定 SPEC_GAP 即停，因此不继续这一子集，也不修改 accepted 文档。

## Domain 坐标及未执行面

#1366 正文分别讨论 Core ledger 与 svc-workflow Rust Domain 行锁。
本 repo 的 `packages/scheduler/src/store/lock.js:290–297` 是通用文件 OwnerLock 的
`runExclusive` 实现，不能据此声称已核查或修复 PostgreSQL Domain 排他行锁。
正文给出的 Rust 坐标为 `intents.rs:247–253`、`transition_transaction.rs:150–156`；
本轮未检出/修改 svc-workflow、未连接 DB、未做 Domain 压测或 Owner 替换验收。
Core 已存在独立、充分的停止依赖，未为扩大调查而跨入其他写面。

## DONE_WHEN 对照与停止状态

| 要求 | 本轮结果 |
|---|---|
| RED 隔离队头阻塞实测、基线测试 | `NOT_RUN — PREFLIGHT SPEC_GAP`；只有静态可达链，无测试 rc |
| 最小锁范围修复及精确重检 | `NOT_IMPLEMENTED`；发现 accepted 锁义务即停 |
| GREEN 无关任务并行完成 | `NOT_RUN`，不声称改善 |
| 前置变化拒绝、同 visit 去重、Owner 身份、无新增死锁 | `NOT_RUN`；约束保留，不是验收 PASS |
| 文件展开的受影响既有套件 rc0 | `NOT_RUN`；无 npm test、无目录参数运行、无排除噪声后冒称 PASS |
| 独立受影响实现审查 | 无实现候选；仅独立 PREFLIGHT 交叉核对确认相同缺口 |
| 分支、commit、push、base=main PR | `NOT_CREATED / NOT_RUN — STOP`；未合并 |
| 成功 RECEIPT | 未生成成功收据；本 STOPPED 承接失败出口 |
| 安装启用、生产与业务验收 | `NOT_RUN / UNKNOWN`；零生产写入 |

未改源码、测试、配置、依赖、治理文档或 `.agents/tools`；未改 #1367/#1358，未 rebase，
未对外发送消息/修改 issue，未 commit/push/开 PR/合并。本轮到此停止，下一步不自动起草或接受权威。

## 实测 SHA-256

```text
74a2f14c93493ab25fe1f8a16aeb49c4ed09c0fe5a86c1abe1c970e3cf36b03a  BRIEF-1366-LOCKSCOPE.md
03469e9f53ccf53f23de3a552270a4bb82f1922b6979108fe01083488c3335d4  docs/specs/AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V3.md
c5d39e390026807b9e471a6875f5e0e9d15432f21a3d177733bf422fc751a1e6  docs/specs/AGENT_CORE_WORKFLOW_AGENT_EXECUTION_V3.md
509836b6c6105c7b553e5e28c297c9762ca24b8c6e2aa0f05029ba0efc88728d  docs/specs/AGENT_CORE_WORKFLOW_STALE_REENTRY_V2.md
a939403cbd83bf9636d2f55e439dddcbbfc3eb74c578db8d4e348d513323a481  docs/specs/AGENT_CORE_WORKFLOW_RECOVERY_LIVENESS_V1.md
1c37687e473df7ce977e5cc571f74d9a6dc0470f3aca95a599d4c9066e52321f  docs/decisions/SCHEDULER_OCCURRENCE_OUTCOME_V3.md
d8b07bc5ed280dae767015dbb437e1d52e596d3e84148f448593290beb3ba0ca  docs/specs/AGENT_DELIVERY_RESILIENCE_D009_ALIGNMENT_V1.md
```

## 2026-11-07 — BRIEF-1366-LOCKTIMING-AMEND 作者路线停止追加

记录时间：2026-11-07 12:30 UTC / 20:30 Asia/Shanghai。
本追加承接新的 docs-only 作者任务及其“失败即停追加本文件”授权；不改写上轮记录，
不产生 Product Authority、接受、实现许可或成功交付回执。

### 本轮坐标、核对与实际动作

- 任务来源：`BRIEF-1366-LOCKTIMING-AMEND.md`，SHA-256
  `b62dd2c5f441ea4a026f1a832748f2e28316310452b6e082773a175e0b20c1c6`。
  用户允许起草及 commit/push/PR，要求 AMEND、SPEC_FORMAT_V0、proposed、
  implementation/production authority 均为 none；没有授予 accepted immutability 或
  whole-authority 规则的明确例外，也没有要求本轮改写治理规则。
- 唯一写面仍是 `/private/tmp/h1366-lockscope`，detached HEAD；
  `BASE_HEAD = REVIEW_TARGET_HEAD = CURRENT_BASE_HEAD =
  24974c720d634b965943e08bfd0862657b9be0e1`。
  2026-11-07T12:30:05Z 本轮只读 `git ls-remote origin refs/heads/main
  refs/heads/docs/wec1-008-lock-timing-amend` rc0：main 仍为该 SHA，未返回目标分支。
- 已读入口、shared/local grammar、accepted adoption V3 与 rc.3 lock、Product Architecture、
  Current Decision index / D-009、WEC V3 直接条款、Recovery Liveness V1 的保留范围、
  spec-governance SKILL 及本轮唯一 AUTHOR mode、SPEC_FORMAT_V0。
- 实测 `python3 .agents/tools/verify_governance.py --target . --require-accepted` rc0：
  `vendored governance bytes match governance.lock.json and adoption is accepted`。
  这是分发字节和接受元数据校验，不是提案语义 PASS。
- 独立只读子审查 `/root/route_check` 未参与写作，同样判定 AMEND 不合法、需 SUPERSEDE；
  未写文件、未运行测试、未访问远端。它是本次路线交叉核对，不是未来 Spec 独立审查或接受。

### BLOCKER-1366-AMEND-ROUTE-001

```text
finding_type = BLOCKER
class = REPOSITORY_INVARIANT_VIOLATION
schema_version = 2
SPEC_GOVERNANCE_MODE = AUTHOR
REQUESTED_AUTHORITY_ACTION = AMEND
REQUIRED_AUTHORITY_ACTION = SUPERSEDE
ROUTE_STAGE = AUTHORITY_AUTHORING
PRIMARY_AUTHORITY = AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V3 / CTR-WEC1-008
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = DURABLE
DOCS_FIRST_REQUIRED = YES
affected_readiness = [AUTHORING_READY_FOR_REVIEW, MERGE_READY, IMPLEMENTATION_ALLOWED]
AUTHORING_READY_FOR_REVIEW = NO
MERGE_READY = NO
IMPLEMENTATION_ALLOWED = NO
OPERATION_ALLOWED = NO
NEXT_ACTION = RE_PREFLIGHT
```

**SOURCE：**

- `.agents/protocol/SPEC_FORMAT_V0.md:396–419`：accepted stable normative ID 仅允许
  semantic delta NONE 的编辑；§14.2 的 docs-only AMEND 只能严格添加新 stable ID，
  所有原 Decision、Contract、Acceptance 含义均须不变。
- 同文件 `:430–438`：替换/收窄既有义务、改变 transaction 语义，或使原先失败的实现通过，
  必须走 SUPERSEDE；`:128–135` 规定 whole-Spec lifecycle 与接受时原子 backlink。
- `.agents/local/README.md:39` 明定 accepted long-lived meaning 的变更须走
  whole-authority supersession；`:135–138` 禁止新 partial supersession。
- `.agents/skills/spec-governance/modes/AUTHOR.md:5,7–17,21–22`：
  只为已解析的路线起草 Product Authority；Task/Brief 是输入而非 Product Authority。
  用户 AGENTS.md 同时要求权威冲突时停止依赖工作，不静默选择一方或重写 accepted stable ID。

**COUNTEREXAMPLE：**

WEC V3 `:222–227` 明确每次新 attempt 的 fresh pre-plan read 必须持 existing ledger
admission lock；`:259–265` 明确 evidence request 在同一锁下。设候选 A 释放该锁，完成远端
pre-plan/evidence 读取，再取锁精确验证身份、观察坐标及 generation/revision 均未变后提交。
即使精确重检完全正确，A 仍违反现行“读取期间持锁”的义务；本任务要求的差量则会允许 A。
故差量不是原 Decision 下纯加法，新增 CTR ID 或保持旧文件字节不变都不能消除实际替换关系。
该反例是 authority 文本对照的静态推导，没有运行实现或竞争测试。

**IMPACT：**

指定的 AMEND 路线与指定的 SPEC_FORMAT_V0 无法同时满足。`status: proposed` 与两项
authority: none 只约束提案生效和实现/操作权限，不能使错误的作者路线符合 accepted 格式。
Owner 审查增量③及预授权 V2 §5 在本任务中提供差量升级/提案起草授权，不能据其概述推定
存在“以 AMEND 替换 accepted CTR”例外。Recovery Liveness V1 的具名条款例外不外推到本任务。
因此本轮不能如实生成符合要求的 AMEND 提案、成功 RECEIPT、commit/push 或 PR。

**MINIMAL_CLOSURE：**

明确将作者路线改为 docs-only SUPERSEDE，起草完整 standalone WEC whole-authority
successor；实际行为差量仍仅覆盖 CTR-WEC1-008 的这两类远端读取，其余条款逐项 PRESERVE，
不扩大为 #1366 整体锁架构工作，不触及 CTR-SRE-002 或其他 delivery/completion 持锁段。
原 stable ID 保持历史意义，替代义务使用新的稳定身份；接受事务按格式完成 whole-Spec
lifecycle/backlinks。若坚持 AMEND，必须先有可核对、明确适用于本差量的治理例外或治理变更，
本任务未提供，作者不得自行创设。这里只诊断闭包，不代拟或接受该例外。

两条路线均不得绕过提案→独立审查→Owner 接受→含接受的 base 上 #1366 RE_PREFLIGHT。
此外，当前要求 `implementation_authority: none` 意味着即使将来接受该类文档，也不自动
授权产品实现；后续 RE_PREFLIGHT 必须核对实际 implementation-authorizing Contracts，
不能把接受或本停止记录当作实现授权。

### 交付与未执行面

- 本轮唯一写入是本 STOPPED 追加；追加前文件 SHA-256 为
  `c2acf756bb1d16aff25e565a6d23329856ea850bc988b74af906f5c93371c864`。
- 未生成 `docs/specs/` AMEND、`RECEIPT-1366-AMEND.md` 或负向测试设计；未执行产品测试。
  后续合法提案仍须明确旧锁外结果在前置漂移时拒绝生效、并发 writer 竞争、UNKNOWN/D-009/
  单 writer/其他锁段不变等要求，本停止追加不把这些未完成项标成 PASS。
- Svc 配对面：WEC `:259` 引用 `CTR-SWEC-010`；本轮未检出/访问 svc-workflow store 或
  其当前 accepted 文档，未修改跨仓合同，配对变更/接受需求为 `NOT_ASSESSED`。
  不将 Core admission lock 等同 Svc Domain store 锁，也不推定无需配对接受。
- 未创建或切换分支，未 commit/push/开 PR/接受/合并；未改产品源码、测试、配置、依赖、
  accepted authority 或治理文件，零生产写入。HEAD 与 tracked/staged diff 保持原状。
- `DONE_WHEN = NOT_MET — requested AMEND route conflicts with accepted governance`。
  依用户失败出口到此停止，不擅自改为 SUPERSEDE 继续交付。

## R3 docs-only SUPERSEDE — stopped on staged whitespace check

记录时间：2026-11-07T12:42:51Z / 20:42:51 Asia/Shanghai。

本轮用户已明确把 R2 的 AMEND 路线修正为 docs-only SUPERSEDE；因此 R2 的作者路线冲突
已经解除。本次不是再次停在该权威缺口，也不要求整体锁架构重构。最后明确执行条件仍是
“零源码零生产写入; 失败即停照旧”。标题中的“失败自动继续”未被解释为覆盖这项最终停止条件。

### 实际完成、坐标与独立结论

- 既有 isolated worktree：`/private/tmp/h1366-lockscope`。
- `BASE_HEAD = CURRENT_HEAD = 24974c720d634b965943e08bfd0862657b9be0e1`；
  authoring preflight 和独立复核远端 main 均为此 SHA。
- 已建立本地分支 `docs/wec1-008-lock-timing-supersede`，未 commit/rebase。
- 已起草正式完整后继 `docs/specs/AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V4.md`，
  842 行，SHA-256
  `77b3e31b772e7502e08dc2544961737df8b0ca5001464f7084f87453310fc5a7`。
  `proposed / implementation_authority:none / production_apply_authority:none`。
- 已起草 `RECEIPT-1366-SUPERSEDE.md`；失败时 staged blob 的内容 SHA-256
  `ce5c1a3236f4cf5768783475bc2a14e77648bf6775867cc1da244d67cd5ee4cc`。
  该文件仍标 DELIVERY_PENDING，不冒充交付成功；下述失败由本 STOPPED 承接。
- 仅上述两项新文档已 staged。原 R1/R2 Brief 与本 STOPPED 仍未跟踪；原 tracked
  authority/源码/测试/配置/依赖/.agents 文件均未修改。原 V3 全文 bytes 等于 base。
- schema、13 required sections、10/10 Acceptance coverage、V3 原字节、001..007
  逐字携带、008 恰好两处逆向还原、intent/bounds/data/API/tests/managed delta 携带检查 rc0。
- whole-authority transition（WEC V1→V2→V3 原链及 V4 proposed）rc0；governance integrity
  `--require-accepted` rc0；从 RECEIPT 的完整重现命令抽取执行亦 rc0。
- 未参与起草的 `/root/independent_proposal_review` 只读独立初审：

  ```text
  REVIEW_TARGET = uncommitted V4 artifact
  REVIEW_TARGET_SHA256 = 77b3e31b772e7502e08dc2544961737df8b0ca5001464f7084f87453310fc5a7
  BASE_HEAD = CURRENT_BASE_HEAD = 24974c720d634b965943e08bfd0862657b9be0e1
  AUTHOR_INDEPENDENCE = PASS
  REVIEW_KIND = SPEC
  REVIEW_SCOPE = FULL
  FULL_REVIEW_BASIS = INITIAL_REVIEW
  AUTHORITY_REVIEW = PASS
  PRIMITIVE_BOUNDARY_REVIEW = PASS
  CONTRACT_REVIEW = PASS
  ACCEPTANCE_COVERAGE_REVIEW = PASS
  MANDATE_SCOPE_REVIEW = PASS
  FROZEN_BLOCKER_UNION = []
  SPEC_GAPS = 0
  FOLLOW_UPS = 0
  IMPLEMENTATION_ALLOWED = NO
  MERGE_READY = NO
  OPERATION_ALLOWED = NO
  ```

  PASS 只适用于上述提案 bytes，不是 Owner 接受或产品 conformance。
  `/root/succession_check` 因此前参与可行性措辞建议，仅列作辅助格式/继承交叉检查，
  不算独立语义签核。

### 触发停止的真实失败

最终 staged 检查实际执行：

```text
$ git diff --cached --check
RECEIPT-1366-SUPERSEDE.md:222: new blank line at EOF.
exit_code = 2
```

作者给回执尾部多写了空行，导致此文档格式检查失败。此前非 staged 的 `git diff --check`
rc0 未覆盖新文件，不能当作最终 staged 检查 PASS；已明确区分，不隐瞒本失败。
该失败不是 accepted Product Contract 冲突；停止来源是用户本轮的显式失败出口。

依停止条件，不删除/修复该尾部空行、不重 stage、不 commit/push/创建 PR；只追加本真实停止
记录。独立语义 PASS 仍仅绑定原 Spec hash；并不抵消失败出口，不递归重审未变产品语义。

### 未执行、恢复点与下一最小动作

```text
ABORT_CONDITION_TRIGGERED = YES (staged whitespace check rc2)
DONE_WHEN = NOT_MET
COMMIT = NOT_CREATED
PUSH = NOT_RUN
PR = NOT_CREATED
OWNER_ACCEPTANCE = NOT_PERFORMED
MERGE = NOT_PERFORMED
SOURCE_OR_PRODUCT_TESTS = NOT_RUN
PRODUCTION_WRITE = ZERO
INSTALLATION_OR_BUSINESS_ACCEPTANCE = NOT_RUN / UNKNOWN
```

恢复所需最小动作是处理 RECEIPT 尾部空白、重新检查 staged diff，再保留已通过的 Spec
字节和独立初审，只做最终 HEAD/receipt delta recheck 后依原授权链交付。当前用户明确失败
即停，本轮不继续这些动作。不需重新开展已通过的继承/语义工作，也不需新的产品设计。

## R4 mechanical delivery resume — prior EOF stop resolved

记录时间：`2026-11-07T12:46:39+00:00`。用户明确授权修复编成回执 EOF 空行，并提交原提案、回执与本停止记录，
push 后以 `gh pr create` 创建 base main PR，不合并；继续零源码零生产写入，真实失败即停。
此授权解除 R3 机械停点，不改变 accepted authority，也不重新开展已通过的语义修复。

- 起始 HEAD / 远端 main：`24974c720d634b965943e08bfd0862657b9be0e1`。
- 分支：`docs/wec1-008-lock-timing-supersede`，原 isolated worktree。
- 回执仅删除 EOF 多余 1 个换行；重新 stage 后 `git diff --cached --check` 实测 rc0，输出为空。
- V4 SHA-256 未变：`77b3e31b772e7502e08dc2544961737df8b0ca5001464f7084f87453310fc5a7`。
  复用 R3 独审 PASS 和 10/10 coverage；最终 HEAD 仅做受影响交付 delta 复核。
- 本段前全部历史原字节保留；此前 STOPPED SHA-256：
  `8a2dc673829d7e68b1259dfba1001f5d50ba4df6e4faef509bd0493f22af279d`。
- 下一动作：三文档 commit → 独立 final-HEAD delta recheck → push → PR → 实际交付回执。
  此处尚未声称 commit/push/PR 已成功，最终结果由 `RECEIPT-1366-SUPERSEDE.md` §9 承接。
- R3 的 `ABORT_CONDITION_TRIGGERED = YES` 为历史真实失败；R4 修复检查已通过。
  实现、Owner 接受、merge、安装与业务验收均未执行，生产写入为零。
