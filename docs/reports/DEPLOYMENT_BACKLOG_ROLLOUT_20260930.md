# 存量部署 backlog：按 Goal 核对、按依赖逐批上线

日期：2026-09-30。GitHub 基线：`mayf3/dsh-agent-core@51f477394fbab0234eae807bacd0f942ffdc22ed`。

**这是有来源的初始盘点与执行顺序，不是完整现网普查、上线许可或新任务数据库。** 本轮检查了下列 GitHub PR/交接，检索了历史 Library 文档 `DSH_Workflow_ZCode_Handoff_2026-09-29.md`；没有读取当前 Mac 的部署目录、数据库、凭据、活跃任务池或生产端点。源码状态可确认，安装/启用/业务验收一律需 T0 有限回读。历史报告中的数量和 PASS 不直接当作当前状态。

配套：[设计建议](AVAILABILITY_DEPLOYMENT_ROADMAP_20260930.md) · [任务 T0–T7](../superpowers/plans/2026-09-30-availability-and-backlog-rollout.md)。

## 1. 找回的是原 backlog，不是另起一套工程

历史部署工件定位：`/Users/yanfenma/workspace/artifacts/DEPLOYMENT_BACKLOG`。本路径来自既有交接，仅供本地执行者按 Goal 寻找原记录；本轮未读取其文件，也未确认它是完整权威清单。

历史主线包括 Workflow Active Pool V2、Watchdog、Forum Runtime、Development Execution Surface、Execution History、Session-Centric Traceability，以及后来的 WEC、Fixed Operation、Trusted Progress、Domain Owner Assistance、Human Attention。各项“完成”曾混指源码、局部部署、离线验证或业务验收，不能整批标成待重新开发，也不能整批标成可直接发布。

每个原 Goal 保留一个处置：

| 处置 | 下一动作 |
|---|---|
| VERIFY_ONLY | 代码已在实际安装版本，功能也已启用；只补缺少的业务验证，不重装。 |
| INTEGRATE | 候选有独立成果但未进入指定源码基线；核对是否已被替代，必要时集成原 PR。 |
| INSTALL | 当前安装版本缺该源码能力；纳入完整且兼容的发布单元。 |
| ENABLE | 已安装，但配置/身份授权/启动条件未启用；只改变经核准的启用面，不重新部署同一包。 |
| IMPLEMENT | 仍缺实际实现，不能仅凭 proposed Spec 或绿色文档检查视作 deployment-ready。 |
| HISTORY_ONLY | 已被新实现覆盖、历史替代或重复候选；保留引用，不作为一次发布。 |

这些是原交接的处置列，不替代 Workflow 业务状态、DS 的事务状态或 runtime 的执行状态。另列 `source / installed / enabled / business-verified`，不要用一个 DONE 混写四者。

## 2. 按业务 Goal 合并后的初始清单

下表的“已核实”只涵盖 GitHub 状态或注明的历史记录。所有生产列当前均为 **UNVERIFIED_THIS_PR**。接手者检查当前一批及其直接依赖，不以补齐全表为开始发布的前置。

| 原能力/Goal | 已核实源码或历史线索 | 接手时的实际工作 | 建议波次 |
|---|---|---|---|
| 当前 HR 与普通 Agent 可用基线 | [dsh #369](https://github.com/mayf3/dsh-agent-core/pull/369) 已合并 `51f47739`；用户报告随后有现场补丁和真实 HR 回复 | T0 只读确认已安装差异、必要配置和恢复记录；回流未进 main 的有效源码；不要重置已经可用的 HR | W0 |
| Session-Centric Traceability / MY_SESSIONS | [#318](https://github.com/mayf3/dsh-agent-core/pull/318) 实现已合并 `4a4b7f40`；[#319](https://github.com/mayf3/dsh-agent-core/pull/319) 只是授权文档 | 先验 self session / own runs；确认是否已经部署。全局查询权限不得混入 self 查询 | W1 |
| Execution History Query / reconciliation visibility | [#309](https://github.com/mayf3/dsh-agent-core/pull/309) 已合并 `02d3a0bb`；PR 记录 Phase B 现场验收待执行 | 先验证已有读面；审计查询按已授 scope。**此 PR 另含 WPA-1 archive-on-rotate 写入变化**，不能把整包称为零写入 | W1；写入差异随对应受控发布 |
| Workflow Node Session History / Trusted Progress / Fixed Operation | 9/29 历史交接称已在 canonical main，有离线测试记录 | 用现有包/原 handoff 找到实际提交和装载映射，不重写这三个底座。只读历史先用；Fixed Operation 的执行启用另验范围 | W1 / W4 |
| Human Attention / Stuck View | [dsh #367](https://github.com/mayf3/dsh-agent-core/pull/367) 已并入本基线；[workflow-todo #2](https://github.com/mayf3/workflow-todo/pull/2) 仍 OPEN，消费已有 #1 读面 | 集成原 consumer PR；对缺失/401/403/404/503 明示不可用，但 svc assistance 仍可见；只按精确业务键合并证据 | W1 |
| WEC 基础闭环 / Forum canonical thread | [基础部署包](https://github.com/mayf3/svc-workflow/blob/main/docs/deployment/WORKFLOW_EXECUTION_CONTROL_V1_DEPLOYMENT_PACKAGE.md) 已有固定顺序与旧验收记录 | 核对实际 schema、forum 唯一线程、dsh 路由/验证器、svc outbox。需要安装时先 provider 后 producer | W2 |
| Domain Owner Assistance | [dsh #351](https://github.com/mayf3/dsh-agent-core/pull/351)、[svc #68](https://github.com/mayf3/svc-workflow/pull/68) 与 [dsh #354](https://github.com/mayf3/dsh-agent-core/pull/354) 交接已合并 | 复用原 handoff；将真实已合并修复纳入新 source pin；历史 E2E 27/27、22/22 不能代替生产验收 | W3 |
| Opaque lastAttemptId wire 修复 | [svc #69](https://github.com/mayf3/svc-workflow/pull/69) 已合并 `48e09dc1`；永久 HTTP 回归已在 `tests/36_execution_control_v1.rs` | 纳入 W3 的 svc 制品并验证 wire；**不再新建“临时回归转永久测试”任务** | W3 的既有修复 |
| RETURN-limit 错误原样透传 | [dsh #370](https://github.com/mayf3/dsh-agent-core/pull/370) 仍 OPEN，已接受规范在 main，候选为实现/测试 | 原 PR 增量复核/集成；确认具体 `return_policy_exhausted` 穿过 Broker，未知错误仍按现有机制拒绝 | W3 |
| Workflow Active Pool V2 / 旧 GLOBAL_ACTIVE 修复 | 9/29 交接及历史任务指出这条线存在；本轮未取得完整现网清单或最新精确 pool 状态 | 找原 Goal/原 runbook；确认已迁移部分，不依据旧数量重新批量创建 visit、派发所有工作或重放 UNKNOWN | W4；只选一个合法低风险实例 |
| Scheduler Watchdog / stuck occurrence recovery | [dsh #300](https://github.com/mayf3/dsh-agent-core/pull/300) phase2 已合并；旧记录中的 W1/W2/Scheduler 状态并不等于当前验收 | 先验证当前 routing/incident/state 读面与服务身份；再用一个隔离样本验证重试和恢复，不开启全 fleet catch-up | W1 读面 / W4 恢复 |
| Forum Runtime / Development Execution Surface | 历史 backlog 名称与已完成声明可定位；WEC 基础包只证明其中明确列出的部分 | 查原交接与相应仓库当前代码；不能把 Forum 的投影通过推断成整个 DES 或 Forum Runtime 都已部署 | W2 / W4，依实际依赖 |
| Self operations / Agent-session-send reliability | [#279](https://github.com/mayf3/dsh-agent-core/pull/279) 是 rollout 提案（引用已合并 #278）；[#203](https://github.com/mayf3/dsh-agent-core/pull/203) 仍 OPEN | 先比对已安装/已合并实现，防止用旧候选覆盖新 runtime。read-only self 面先验；mutation、消息投递另做最小案例 | W1 / W4 |
| 身份/生命周期残留修复 | [dsh #265](https://github.com/mayf3/dsh-agent-core/pull/265)、[#268](https://github.com/mayf3/dsh-agent-core/pull/268)、[#317](https://github.com/mayf3/dsh-agent-core/pull/317) 仍 OPEN；部分 PR 声称现场已有修复 | 先做 source/live parity；已经在现网的正确修复回流，不重复改凭据或再 provision 主体；具体 drain bug 若仍存在进入 W0/T2 | W0 / 对应服务波次 |
| 治理短路径采用 | 中央 #21 已合并；[dsh #364](https://github.com/mayf3/dsh-agent-core/pull/364) 仍 Draft/proposed | 继续原采用 PR，适配当前 base、完成必要接受；不是 runtime 防重复的实现，也不是所有业务上线前置 | 并行非生产 |
| 两阶段维护、后续协作与移动端 | [#360](https://github.com/mayf3/dsh-agent-core/pull/360)；[svc #60](https://github.com/mayf3/svc-workflow/pull/60)；[dsh #124](https://github.com/mayf3/dsh-agent-core/pull/124) 均仍有提案/未实现边界 | 保留已有分析；分别确认需求/授权/实现。不为一个普通发布先完成所有未来平台 | W5 |

其他具体候选不丢掉：`svc-workflow#50/#51/#62/#67`、`dsh-agent-core#196/#232/#293/#297/#361/#371`、`svc-workflow#36/#38/#41/#53` 均作为相应原 Goal 的待核引用。其中旧 schema-version 常量、旧索引生成稿、早期 lock wrapper、旧恢复测试/规范尤其可能已被覆盖；先做语义与实际使用者比较，不把 OPEN 当作“必须合并”，也不未经授权批量关闭它们。

## 3. 最短可用路线：W0 → W1，然后按需 W2/W3

### W0 — 保住刚恢复的服务，建立下一包的基线

**前提：**当前用户已报告恢复；没有正在发生的新故障需要立即止损。若实际仍坏，恢复受影响服务优先，不为本盘点扩大停机。

**动作：**执行计划 T0/T1，确认 actual release/Node/harness/非秘密配置/状态格式，回流实际有效补丁，得到可重复构建的制品。T2 的既有部署路径只验证此次实际需要的动作。

**结果：**一份能重建的当前可用基线；明示哪些 Goal 已安装，哪些只在 main。已有可用版本无需为“证明部署器能用”再安装一次。未知现场差异只阻止覆盖该服务的操作，不阻止独立查询工具开发与使用。

### W1 — 先让已完成的只读能力真正可用

**候选：**MY_SESSIONS / own runs、Execution History、Workflow Node Session History、Human Attention、Watchdog/self_ops 的已具备读面。

**顺序：**
1. 检查已有后台是否真的加载；已加载则 VERIFY_ONLY，没加载才加入 W0 之后的受审制品。
2. self 查询不依赖全局 audit 授权；全局查询只给已有批准主体与对应权限，不能为了读面授予全能 admin。
3. `workflow-todo#2` 是消费端，可与生产基线整理并行。只消费已有 API，缺少 dsh attention 时显式降级而不是隐藏 svc 数据。
4. 对当前有权限的真实对象做只读验收，确认 exact session/visit 关联、边界、来源与缺失原因；读业务索引不意味着允许读取所有对话正文。

**成功：**用户能看到当前执行、卡在哪里和需要谁处理；不创建 Workflow、不触发 HR 重置、不重新部署已经正确装载的相同制品。WPA-1 等底层写入变化单独核对，不因上层界面只读就漏验。

### W2 — WEC 基础还没完成时，先补基础；已经完成就跳过

**必须复用的原顺序：**

```text
Forum 数据/迁移与唯一 canonical thread
    → dsh trace/kick consumer + 正常验证器/配置
    → svc-workflow migration 0027 + 相匹配二进制
    → 经核准的最小启用与基础验收
```

这是基础包的 provider-before-producer 顺序，不能和 W3 的增量顺序混用。源码 main 已更高或某 schema 已应用，不重放旧迁移；实际版本、迁移历史和 `/readyz` 决定需要什么。历史 `/version` 文本常量不是 schema 权威。

**两个需要针对当前候选闭合的事实：**
- 原基础包的 Forum 迁移会保留最早 canonical thread、解除重复 thread 的 context 绑定；这是实际数据修改，不能因为 Forum 是投影就当成无风险读操作。只在适用授权、备份和当前数据验证下执行，不机械复制旧 DDL。
- 原基础包称“旧 svc 二进制可带着 0027 回退”，但 [svc #67](https://github.com/mayf3/svc-workflow/pull/67) 记录了 `/readyz` 版本不匹配的反例。先验证实际旧/新二进制和 schema 的兼容性。该 PR 的 empty-only 恢复条件不是普通下迁移许可；有新写入或结果未知时不执行其特殊 SQL。

**成功：**一个低风险真实 Workflow 的 canonical thread 恰一条、traces 可查、push 与 poll 不双派；一般 Agent 仍可执行。未配置 poller 时只能报告安装完成/功能 dormant，不能报告自动执行闭环完成。

### W3 — Domain Owner Assistance，复用已完成跨仓成果

**依据：**[原 Owner Assistance handoff](../evidence/wec-owner-assistance-deploy-handoff-v1-20260929/HANDOFF.md)。其中旧源码 pin 是历史已审内容，不是让执行者降级当前生产。更新 pin 时只复核被改变的相应功能与依赖。

在 **WEC 基础已验证存在** 后：

```text
核对实际 migration head（已应用则不重复）
    → svc 增量 migration 0028
    → svc 制品包含 #68 + #69
    → dsh 制品包含 #351，及经合并的 #370 错误透传
    → 核对已有 poller WHO 和最小授权，按既有机制启用
    → attempt-limit / RETURN-limit → OWNER_PENDING
       → 唯一 Owner wake → resolve / 显式 escalate_to_human
```

`POLLER_WHO_OWNER_DECISION` 是**原交接中的待决定项**，本轮检索没有证实其当前是否已经解决。部署前先读既有 Owner/Auth 决定；已经选定就复用，不能再问一遍。未选定也不自行把 HR/效率管家当 poller。重置权限的 CTO 选择不是自动指定 WEC poller。

只有实际代码/配置证明 dormant 才能“先装不启用”。主分支包含新代码不代表可以安全地关闭它；有无法分离的行为时，仅暂停相关发布单元或采用适配版本，不声称只装读面却偷偷启动写入流。

**回退硬事实：**旧 svc 消费循环会把不认识的 `OWNER_ASSISTANCE_WAKE` 标为 delivered，造成静默丢通知。存在待投递 wake 时不能直接回退到这种消费者，也不能清空/假标 delivered 来造零积压。选能保留、重试该 outbox 的兼容版本或受控暂停消费者；业务状态保持完整。0028 增量 schema 在行仍存在时留向前兼容，代码回退不等于撤销 migration。

**成功：**两个限制入口均先到 OWNER_PENDING；Owner 收一次通知；重复传送不会双执行；非 Owner 不得处理；解决后恢复合法调度；只有明确升级才到 HUMAN_REQUIRED。早期基础包“直接 HUMAN_REQUIRED”的旧描述不适用于该已修订分支。

### W4 — 一次放开一个自动执行/恢复场景

在 W2/W3 所需依赖通过后，按实际业务价值依次选择：一个合法 Active Pool 实例、一个 Watchdog 卡住恢复场景、一个 Fixed Operation、一个 self_ops 允许变更、一个 domain membership 操作。

它们不是一个强制大包；不依赖 Owner Assistance 的操作，不为 W3 未启用而停。每项在原业务 Goal 中执行明确的输入、目标、权限、失败处置和结果核对。

不能依据旧 `GLOBAL_ACTIVE` 数量批量唤醒全部工作，不能为抹平旧积压重放 UNKNOWN，也不把测试任务继续留在业务队列。Forum/Workflow 状态仍由其原 owner 控制；HR 不成为所有人工处理的唯一入口。

**成功：**所选业务案例真实完成并记录来源、执行和结果；误差局部处理。验证一项就关闭一项原 backlog，不继续扩展到未选场景。

### W5 — 未来增强，不让它们挡住已有能力

稳定接入层、事务存储迁移、完整两阶段维护、协作模型和移动端会话历史，分别按其必要性执行。它们不是 W1–W4 的普遍前置。若某一发布确实依赖其中一项，只说明那个明确依赖和最小增量，不宣布整个 backlog 冻结。

## 4. “一个包”与“一项功能”必须分开计数

源码包含相同、兼容的一组 Goal，可以由一个完整制品覆盖、一次重启安装，然后逐 Goal 验收。不得为每个 PR 重新重启同一个 Runtime。

但是一个代码库的新 main 也不能直接代表所有功能都该同时启用。发布时明确：`included / dormant / enabled / verified`。未有已实现的开关或兼容层，不声称可隔离启用。不同安装根或独立 UI 可分批，但遵守现有主机事务互斥。

已经安装同一正确制品时，剩余权限配置/业务验证不再触发重复部署。一个验收失败只影响实际相关功能；基础设施或跨功能安全回归按既有回退纪律处理。

## 5. 在原交接上补最小执行记录

每个当前批次只需要补以下信息，不复制日志、不建立新数据库：

```text
goal_id / original_pr_or_handoff
source_candidate / source_inclusion_evidence
installed_revision_and_observed_at (unverified allowed)
disposition: VERIFY_ONLY | INTEGRATE | INSTALL | ENABLE | IMPLEMENT | HISTORY_ONLY
wave / direct_dependencies / exact_next_action
runtime_identity / compatibility_and_rollback / authority_reference
verification_command_or_case / actual_result / limitation
actual_executor / queue_ack / started_receipt / final_receipt
```

没有生产观察就写 unverified。没有 executor/接收回执就写未接手，不能写“等 lane 自动完成”。统计 backlog 减少按业务 Goal 的实际结果，而不是合并 PR 数或减少 OPEN issue 数。

## 6. 第一位接手 Agent 的执行指令

读取本文件与 T0/T1。先只接一项 **“当前稳定版回流 + 完整发布包”**，保留已恢复服务，不重新执行 HR reset。使用现有 Supervisor Skill、原工作项目和独立工作树；已有同目标作者则先确认交接，不另开第二 writer。

第一轮必须给出实际代码差异/构建测试，或某个具体无法取得的现网事实及仅受它影响的发布单元。没有阻塞时，不停在“已完成盘点”；继续完成 T1 的实际包和缺依赖失败回归。用户将自行派发，此 PR 不自动启动任务。

随后选择 W1 中一个已有后台的 self 查询或 Human Attention 消费端作为最早交付。需要替换生产包时，先用 T2 验证该条已有受控发布路径；不等待所有 T2 增强和 T3–T7 完成。源码与权限就绪后通过已有授权执行，缺失授权一次列明版本、目标、影响、回退、待批准动作；不能以方案 PR 自我授予生产或数据迁移权限。

每个后续波次只在开始时 fresh-read 当前代码、实际安装和相关依赖。不要把旧 pin 降级到生产，不把历史测试当本轮执行，也不把已完成的永久回归再交给另一个 Agent 开发。
