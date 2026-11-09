---
spec_id: AGENT_CORE_GHOST_HOLDINGS_PROTECTION_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: none
production_apply_authority: none
authority_action: NEW
repository: mayf3/dsh-agent-core
date: 2026-11-08
authoring_base: 1d3cef866f2bac545a4aa62ca53f5b0e178dd2a1
scope:
  - Core agent removal holdings gate and read-only ghost holdings inspection
  - Core retirement workflow orchestration and required Svc companion acceptance
governed_by:
  - AGENT_CORE_PRODUCT_ARCHITECTURE_V1
  - AGENT_WORKSPACE_SESSION_MODEL_V3
  - AGENT_CORE_STANDING_OPERATIONAL_DELEGATION_V1
external_authorities:
  - repository: mayf3/svc-workflow
    authority_id: SVC_WORKFLOW_PRINCIPAL_SUCCESSOR_MIGRATION_V1
    revision: b5096782f666ad22aa3508fdbf9562278a977c0f
    relation: constrained_by
  - repository: mayf3/svc-workflow
    authority_id: SVC_WORKFLOW_CANONICAL_IDENTITY_RECONCILIATION_V2
    revision: b5096782f666ad22aa3508fdbf9562278a977c0f
    relation: constrained_by
supersedes: []
superseded_by: null
owners: [mayf3]
---

# AGENT_CORE_GHOST_HOLDINGS_PROTECTION_V1

本文件是四道闸的 **proposed/none** 提案。没有接受事务，没有实施、部署或生产操作许可。
Core 接受不代替 Svc 配套正式接受；当前缺件及接受前置见 §3、§13。

## 1. Goal

避免 Agent 离册后仍持有 Workflow 当前实例责任或 enabled 角色，形成无人能接管的幽灵
holdings。对齐 [#1351](https://github.com/mayf3/agent-control/issues/1351) 的三条验收：
持有实例时删除被拦截；巡检列出幽灵 holdings；新设幽灵 owner 被拒。
四道闸分别负责删除预防、只读检测、角色写入预防和正常过户流程。

## 2. Scope and non-goals

区分三个动作，不能用一个状态或一个 API 混称：

| 处置 | 含义 | GC 门禁 |
|---|---|---|
| 紧急停权 | disable，保留身份、holdings 和已有 fence/恢复事实 | 不参与；Svc 不可用或 holdings 非空也不能成为新增 disable 阻断理由 |
| 交接 | 实例责任、域/全局角色按合法路径过户到明确对口角色的实际主体 | 可独立进行；交接成功不等于离册 |
| 退役 | 过户完成，并通过删除前复查后离册/归档身份 | 只在最终删除/离册边界执行 |

“不拦 disable”不取消其原有鉴权、默认 Agent 等既有约束，不增设通用 enable 接口，
不承诺停权自动终止旧 worker/已派发外部效果。恢复仍须原有合法入口和安全前置。
本提案不删除 Auth Principal、历史记录、Workspace、Session、credential 或业务数据；
身份归档若使其退出可用在册目录，同样按离册门禁处理，不能借改名绕过。
不新增身份映射库、生产控制器、调度器、workflow 语言、通用任意改派 API 或模型特权工具。
不改变 Scheduler D-009、WEC/PPR 的 UNKNOWN/no-replay/fence 或 managed Owner replacement 语义。

## 3. Authority and dependencies

### 3.1 来源、归属与逐条路由

用户授权以根目录 `BRIEF-1351-SPEC-AUTHOR.md` 为准，限 docs-first、commit/push/PR(base main)，
不合并、零生产写入。其[固定副本和定位记录](../reports/ghost-holdings-1351/AUTHORING.md)保留
来源 hash；issue 正文和收敛评论是任务/产品输入，不把它们当成已经 accepted 的四闸合同。
常设委托 `CTR-SOD-003` 原 §3C 提供受托接受路线，自身 `implementation_authority: none`。
每次仍须非作者独审、接受者真实权限、reviewed HEAD 和最终接受事务；本作者不自我接受。

| 条款 | 直接相关既有权威/记录 | Core 路由与理由 | Svc 配套处置 |
|---|---|---|---|
| C1 | Architecture 的身份归属；Exact Principal Resolution V2 `CTR-EPAR-003/005`；Bootstrap V1 `OBS-WA-011` | **NEW**：新增删除前 holdings 决策；既有精确只读/admission 不决定删除许可；没有旧删除合同被替换 | 正式决定 holdings 查询覆盖/权限/一致性，不能拿普通 my_tasks 可见子集证明全量为空 |
| C2 | Architecture 的 Core 身份、Svc 业务分工；STOPPED 定位表的检查器缺件 | **NEW**：新增跨实例/role 的只读检测义务；不是 Scheduler W1/W2 AMEND | 正式决定全量读取、分页完整性及角色维度；不由 Core 获得隐式枚举权限 |
| C3 | Svc `IDENTITY_PROVISIONING_API_V0` §5–6、本地 Principal exists+enabled；`SVC_WORKFLOW_COORDINATOR_CONTROL_PLANE_V1` `CTR-CP-003/DEC-CP-007` | **NEW（Core 配对约束）**：Core 不拥有 Svc 角色写入；本文件只规定期望配套及不开闸条件 | registry 拒绝会收窄旧通过集合并改变失败语义，须按 Svc 自身入口对 owning authority 作完整 **SUPERSEDE**、原子回链；不得同 ID 偷改或称 additive AMEND |
| C4 | Definition Authoring V4 的四操作；Assignee Transition Capability V3 的既有写入口；Owner Workflows V2 §8；Svc successor/reconciliation 限制 | **NEW**：新增离职流程决策；authoring/execute 能力 **REUSE**，不扩大它们的操作集合 | 每项实例/role 过户绑定合法既有命令；无命令的泛化过户不是本 Core NEW 隐式授权 |

未找到一个 Goal、scope、ownership 和 accepted Decisions 都保持不变、且已经蕴含四闸的
可 AMEND authority；因此本 Core 选 NEW、`supersedes: []`。旧 stable IDs、正文和回链不改。
若绑定真实删除/检查器后发现既有 accepted 规则与本提案冲突，停止该依赖、RE_PREFLIGHT，
不能用本 NEW 绕过原规则。Svc 的完整继任由其 owning repo 决定，不在 Core 伪造继任 ID。

### 3.2 Paired acceptance 和接受前置

复用本 base 的 WEC V5 `CTR-WEC5-013`、§3/§12 与 PPR V2 的 paired 模式：
本地 authority 可正式接受，但新增跨服务行为仍须对应仓库配套 accepted Contracts 进入
各自实施 base。WEC5/PPR2 当前 accepted/contracts 的事实不意味着本四闸已接受。
本提案采用更早的绑定门：以下 P1–P4 未闭合时，本候选也不得标 accepted。

| 前置 | 必须持久绑定的事实 | 当前状态 / 责任 |
|---|---|---|
| P1 删除入口 | 真实 owner repo、源码 commit/path/symbol、外层 callable→最终 mutation 的 invocation、全部同效删除/离册路径；精确目标/鉴权/并发边界 | **PARTIALLY_BOUND**；已查环境未找到 Core 专用逐 Agent 删除 callable；Core 已绑定整表替换/强制迁移/安装 seed/restore、hardening verifier 整册删除后重建。OpenClaw `agents.delete` 安装能力 **BOUND**，写 `openclaw.json.agents.list` 而非 Core `agents.json`；当前 loaded/配置 override 及历史删除链 **UNKNOWN**。责任仍归实际 gateway/registry owner |
| P2 检查器 | 既有 NOT_IN_REGISTRY 检查器 owner repo、commit/path/symbol、invocation、现有报告面、role 扩展点 | **NOT_LOCATED**；全仓、指定候选仓、部署 app（含 node_modules）及生产日志/状态排查未找到可执行产生者；Scheduler W1/W2、HR 档案一致性及 HR read projection 候选已排除。真实 owner/入口/报告面/role 扩展点仍 **UNKNOWN**；不将所查范围的负证据当成全环境不存在证明 |
| P3 Svc 配套 | 真实 authority ID、Contract IDs、精确文档 hash、独审 reviewed HEAD、合法接受者及权限来源、最终接受事务/head、main SHA、各实施 base 包含关系 | REQUIRED/UNKNOWN；Svc 合法责任链。覆盖 holdings 全量读、全角色/owner 写点、身份解析/错误/时间界限、并发与过户合法性；Core 不代签 |
| P4 本地接受 | 非作者 affected-Contract review、接受者真实身份权限、精确 reviewed/final HEAD；`none→contracts` 的另次明确 docs-only 事务和 main 激活 | NOT_EXECUTED；§3C 原责任链。PR 创建或审查 PASS 均不自动接受 |

P3 必须把线性化承诺与观察时点分开。单次 Core 活性读不是跨库锁或 lease；Core 文件锁
也不是 Svc Domain/assignment 锁。配套须说明从 holdings 空读到最终离册之间，新增实例
assignment、role 写入和 registry 变更如何被已有合法序列化/复核边界约束，并提供两种
提交顺序的反例测试。未证明删除不会穿过新持有责任的窗口，删除保持拒绝，不以“刚查过”放行。
若需要新协议/权限或改变 accepted semantics，先在 owning repo docs-first 处理；本提案
不指定虚构的分布式事务、不宣称已经解决并发。

## 4. Current State

`STATE-GHP-001` — subject=四闸 authoring 工作面；as_of_commit=
`1d3cef866f2bac545a4aa62ca53f5b0e178dd2a1`；environment=隔离 worktree
`/Users/yanfenma/workspace/project/worktrees/h1351-gates`、`docs/1351-gates-spec`；
observed_at=`2026-11-08T10:51:53Z`；basis=`OBS-GHP-001/002/003`、`EVD-GHP-001/002`。
前次停在 authority authoring；本轮只交 proposed 文档。远端 main 同上述 base；没有任何生产观察。

## 5. Observations

- `OBS-GHP-001` — subject=前次 surface 定位；source=固定副本 `STOPPED-1351-GATES.md`，
  revision/hash 见 AUTHORING；environment=前次本地 source-only，observed_at=`2026-11-08T08:50:05Z`；
  method=复用定位表，未重新探索产品代码；result=Core Agent Definition composition 已绑定、
  无 remove seam 绑定，检查器 owner 未绑定，Svc 四处角色写入入口已列明；provenance=该记录。
- `OBS-GHP-002` — subject=直接相关权威；source=Core authoring base 及 Svc 固定 Git 对象
  `b5096782f666ad22aa3508fdbf9562278a977c0f`；environment=本地文档/Git 只读，
  recorded_at=`2026-11-08T10:56:00.191244+00:00`（文档证据封存，逐项读取时钟未另采集）；
  method=精确文档阅读；result=WEC5/PPR2 有配对闸，
  Svc provisioning 只要求本地 enabled，普通任意 Principal reassignment 未获授权，
  managed Owner replacement 不自动交接；provenance=§3 authority crosswalk/固定 Git 对象。
- `OBS-GHP-003` — subject=任务输入；source=Brief、issue #1351 和评论 `6716360936`；
  environment=本地文件及 GitHub 只读，recorded_at=`2026-11-08T10:56:00.191244+00:00`
  （副本封存，API 每次读取时钟未另采集，不冒称精确检索时刻）；
  method=完整读取简报与定位表、读取 issue/评论；result=删除门禁不拦 disable，
  交接/退役分开，三条验收不变；provenance=同目录证据副本及 GitHub 固定评论链接。

## 6. Claims and assumptions

- `CLM-GHP-001` — Support state=`SUPPORTED`；四闸不是既有 exact resolver 或本地 enabled
  检查的 in-contract bug fix。Supported by=`EVD-GHP-001`；contradicted by=none known；
  uncertainty=只覆盖已指向的权威，不断言未知删除/检查器不存在。
- `CLM-GHP-002` — Support state=`SUPPORTED`；可在不实施、不接受 Svc 的前提下提交 Core
  提案，把缺件设为关闭的接受/实施闸。Supported by=`EVD-GHP-002`；contradicted by=none known；
  uncertainty=所有 runtime/callable/生产业务结果未验证。
- 无用名称/前缀猜身份的假设；P1–P3 的未知均显式保留，不作为成功输入。

## 7. Evidence relations

| Evidence | Source → Target / relation | Coordinates, sufficiency, limitations / provenance |
|---|---|---|
| EVD-GHP-001 | OBS-GHP-001/002 → CLM-GHP-001、STATE-GHP-001 / SUPPORTS | STOPPED hash、Core base、Svc 固定对象、§3 crosswalk；足以路由，不证明现网漏洞/部署或完整源码入口；AUTHORING 及输入副本 |
| EVD-GHP-002 | OBS-GHP-002/003 → CLM-GHP-002 / SUPPORTS | 相同 Core base 的治理/§3C、WEC5/PPR2，Brief/issue 副本；足以 docs-first authoring，不是独审、接受、产品验收或生产授权 |

## 8. Decisions

以下均为 **PROPOSED**，decision owner=Core/Svc 各自合法接受链（§3C），不是已完成接受：

- `DEC-GHP-001`：删除前查询真实全量 holdings，非空或不确定均不离册；disable 不经此门。
- `DEC-GHP-002`：检查器从全量持有责任的 Principal 集合反查 registry，覆盖实例和 role，
  只报告、不自动修复。
- `DEC-GHP-003`：Svc 在启用/新增/替换角色目标时独立作 agent registry 活性校验；
  本地 enabled 镜像不代替 Core truth，人类 Principal 不套 agent registry 规则。
- `DEC-GHP-004`：交接/退役复用真实 workflow authoring，逐项合法过户、读回，空 holdings
  后才请求离册；不从 authoring 能力推导任意实例改派权限。
- `DEC-GHP-005`：按 P1–P4、paired 正式接受及各实施 base 激活，不添加第二控制面。

## 9. Contracts

以下 MUST/MUST NOT 是拟议长期义务；仅在另次合法接受及权限激活后生效。

### CTR-GHP-001 — C1 删除/离册门禁，disable 例外

GC 门禁定义的是新的 Core 逐 Agent 删除边界；本次排查未找到既有专用逐 Agent 删除 callable。

真实删除/离册 callable MUST 在最终 mutation 前，以精确 Agent ID 和 Auth 所属 canonical
Principal 关系查询 Svc holdings。不得用 display name、旧别名、ID 前缀或本地复制表猜映射。
Auth owns Principal/type/status，Core Agent Definition owns Agent 存在及 enabled；复用现有
精确解析权威的语义，但不得把只接受 enabled Agent 的 resolver 直接套为 disabled subject
的 holdings 查询：disabled subject 的 canonical 关系也必须可证明，否则拒绝离册。

holdings MUST 至少包含：(a) 当前 assignee 为该 Principal 的非终态、未取消实例及实际
current visit；(b) 所有 enabled domain/global role binding（不只 DOMAIN_OWNER）。
不得因 Domain/Principal 已 disabled、普通 my_tasks 不可见或 role 不是 owner 而漏计债务。
历史 visit、已终态/已取消实例和 disabled role 不计当前 holdings，但审计历史必须保留。
Svc 配套须绑定精确生命周期谓词；缺 current visit/未知状态/不完整分页不可当零。

任一 holding 存在 MUST 拒绝删除，返回可归因的阻断及在原读权限内的 holdings 引用，
不自动转移/取消/改身份。只有经授权、覆盖完整且在 P3 一致性边界内的空结果可放行；
原鉴权仍独立适用。查询超时/不可用、映射歧义、权限不足、未知响应、cursor 不完整或
registry/CAS 漂移 MUST 保留身份并拒绝，不能 fail-open、静默降级或换身份重试。
逻辑拒绝分类为 `HOLDINGS_PRESENT`、`HOLDINGS_UNVERIFIABLE`、`SUBJECT_IDENTITY_UNVERIFIABLE`、
`SUBJECT_CHANGED`；它们不是伪称已存在的 wire error codes，实际 HTTP/Broker 映射须 P3 接受。

disable principal/Agent Definition MUST 不调用此 GC 门、不以 holdings 查询成功/为空为前置。
GC MUST NOT 清已有 holdings、fence、UNKNOWN 或历史；同效离册入口必须同样受控。

### CTR-GHP-002 — C2 新建 Core 侧 holdings 巡检

新建 Core 侧 holdings 巡检；本次实测排查未找到 `NOT_IN_REGISTRY` 标记的可执行产生者，
部署状态与候选已排除清单见 [P1P2-BINDING-1351.md](https://github.com/mayf3/dsh-agent-core/blob/6d88289c8eaa0405e16c375a0ab0ad5a64dcc2bf/P1P2-BINDING-1351.md) §6–7。
该巡检 MUST 从 Svc 全量 Principal/当前实例 assignee/enabled domain+global role
读取构建候选集合，再按精确 canonical 关系与 Core 在册目录比对，不能只遍历在册 Agent，
也不能只用 caller 的 worklist、只查实例或只查 owner。合法 human Principal 不属于 agent
registry 检查对象；类型/映射未知须报告 unresolved，不能默认为 human 或把它当无 holding。

对 authoritative missing Agent MUST 报 `NOT_IN_REGISTRY` 并列出该 Principal 的实例、
current visit、domain/global role、binding ID、enabled、读取坐标/时间和完整性。
在册 disabled 的 Agent MUST 与“不在册”分开列为 `IN_REGISTRY_DISABLED`，保留其 holdings，
不能改成可执行或直接离册。有效在册 enabled Agent 不报幽灵。
registry/Svc 查询失败或分页/映射缺失 MUST 报 `INSPECTION_INCOMPLETE` 和受影响覆盖范围；
不得给全量 clean/PASS 或把未知改成 missing。完整扫描无幽灵是合法空结果，不是失败。

检查器 MUST 只通过已有合法读权限和报告面观测；不自动改派、enable/disable、删除、唤醒
或清 fence。不扩大一般模型读权限，不在报告泄露 credential/Secret；完整 holdings 仅供
已有相应权限的接管者，其他可见面按现有脱敏规则输出引用。

### CTR-GHP-003 — C3 Svc 角色目标活性，跨服务一致性

此项是 Svc 配套必须正式承接的义务，Core 本文不能授权其写实现。Svc MUST 覆盖
`upsert_role_binding`、`replace_domain_owner`、`establish_domain_owner`、global role upsert，
以及任何可新建/恢复 enabled binding 或产生新 owner 的同效入口，不能只修 HTTP handler。
目标为 agent Principal 且将新生效角色时，MUST 同时满足原有本地存在/enabled、类型与
domain/role/鉴权规则，以及权威 canonical Agent 在 Core 目录精确存在且 enabled。
本地 `principals.enabled=true`、模型自报 agentId、缓存成功或旧 directory 快照均不足。
目标为 human Principal 时沿原 human 规则，不以缺 Agent registry 项误拒绝。

Svc MUST 在写入执行的有界校验时段作独立可信读取，核身份/目标一致且在提交前检测
本地目标和 Domain/role 前态漂移；新的 timeout、结果 freshness、retry/错误映射和 P3
跨服务并发义务须其配套固定。一次活性读仅证明该时点，不承诺随后 disable 与 Svc commit
线性化，也不授新 lease。其前后变化必须能被 C2 检出；C1 的最终离册另须满足 P3 的强门。

authoritative missing → `TARGET_NOT_IN_REGISTRY`，在册 disabled → `TARGET_DISABLED`，
解析/目录不可用或结果不明 → `TARGET_LIVENESS_UNVERIFIABLE`，均 MUST 零角色业务写入，
不得先 disable 原 owner 再发现新 owner 不合格。保留原有单 owner、Domain 事务、CAS、
幂等和审计语义；同 key 的历史成功 receipt replay 仍返回原事实，不据今日状态重写历史。
上述为逻辑分类，正式 wire 状态/代码/DTO 必须由 Svc 配套接受，Core 不覆盖旧错误合同。

只减少权限的 binding disable/revoke、Principal 停权不受新增目标活性前置阻断；
owner replacement 校验的是接收目标，不要求已 disabled/离册的 source 重新 enabled。
Svc target 验证失败保留旧业务前态；不能借失败“修复”旧 Principal、授 Grant 或冒充 source。

### CTR-GHP-004 — C4 离职过户 runbook 与真实 workflow

标准流程 MUST 使用既有 Definition Authoring V4 的 definition→draft→graph→publish 和
既有 `workflow_execute.create_instance` 创建可读回的真实实例；优先 HR 域，使用该域
现有合法 authoring actor。不得发明另一套 workflow 图语言或以 Markdown/ACK 代替实例。
发布/创建自身仍受现有 scope、Domain Owner、trusted actor、幂等/CAS 及 managed 门约束。

实例流程 MUST 表达如下步骤和失败出口；本提案只定义载体，不运行这些步骤：

1. 固定交接/退役模式、source 精确身份、操作者和范围；读取完整 holdings，逐项绑定
   对口角色、domain/global scope 及经现行权威解析的实际接收 Principal，不按显示名猜人。
   source 已离册/disabled 不要求恢复其权限；由原有合法接管 actor 操作。
2. 每项活跃实例责任 MUST 绑定适用的合法过户命令、前态/版本/receipts 和接收目标；
   每项 enabled role MUST 绑定对应合法 role/owner replacement 操作及读回，保持单 owner。
   缺对口角色、接收者不活跃、无合法命令、鉴权/并发冲突时持久记录未完项，停止依赖步骤。
3. 全部命令逐项读回实际责任和旧 enabled 角色处置。交接模式到此可完成，保留 source 在册；
   退役模式 MUST 再读完整 holdings，只有空且 C1/P3 最终门满足才请求离册并读回结果。
   未过户完成、回包未知、仅 enqueue/ACK、只更新展示或只停权都不得标退役完成。
4. 任一步骤未知外部效果 MUST 先按原命令/receipt 读回，不换 key/body 重放、不自动补偿、
   不删审计/UNKNOWN/fence。恢复从实际未完项接续；失败不把已发生的过户伪称回滚。

Svc 现有 successor migration 仅特定 OLD/NEW 的一次离线授权，MUST NOT 泛化为本流程的
任意实例改派。canonical reconciliation 的 successor/park 也只引用独立合法事务。
managed NodeVisit Owner replacement MUST 继续按 Owner Workflows V2 §8 STOP/
`OWNER_CHANGED_UNSUPPORTED`，不得把该停止解释成新 owner 自动继承执行或新预算。
缺合法转移路径时保留 unresolved/park 和可见责任、零离册；需要新业务转移政策时交 Svc
原责任链先 docs-first，不由本流程创建新 endpoint、管理员 override、身份或 Grant。

### CTR-GHP-005 — 配套、权限与激活边界

P1–P4 MUST 闭合后才能正式接受本候选。接受事务 MUST 绑定独审所审精确语义、真实
接受者权限、最终 head/hash 和 lifecycle；拟议 `none→contracts` 必须明确列入该事务，
不得从 `status: accepted` 推导实现权。仍为 none 时即使合 main 也不授权源码实现。
Core/Svc/实际另仓检查器的对应 accepted/contracts 进入各自实施 base，且 P3 的一致性、
授权读面与所有写点/过户路径具备受审闭环之前，四闸新增实现/启用 MUST 保持关闭。
Svc 配套的未决 wire/protocol 不能用 chat、测试或 Core 本文填补。

后续实施以新任务 RE_PREFLIGHT，按已接受合同 REUSE；生产 apply 另走现有 Controlled
mandate/runbook/独立读回，不因源码、测试、文档接受、合 main 或 health 成功而获得许可。
本次作者 MUST 只交文档、commit、push、base-main PR；不接受、不合并、不写生产。

## 10. Acceptance

以下均为**未来验收定义**，非已执行产品测试。除文档/治理检查外当前全部 `NOT_EXECUTED`。
每项 Required evidence 通用包含 Core/Svc/检查器 exact authority+implementation refs、
配置/输入/环境/时点、真实调用入口、输出及 rc、调用数、持久前后态/receipt 与权限证明，
由非作者可复核；不以 mock helper、计划、ACK 或原 issue 生产故事代替正式入口实测。

| Acceptance | Contracts | Method | Environment | Required evidence（另加通用字段） | Expected result / Failure condition |
|---|---|---|---|---|---|
| ACC-GHP-001 删除被拦截（issue 1） | CTR-GHP-001/005 | 真实删除 callable：仅实例、仅域 role、仅 global role、仅历史/disabled role、完整空集合；enabled/disabled source | 未来隔离 Core+Svc 持久集成 | P1 invocation、全量结果、前后 registry/holding/历史 hashes、原鉴权负控 | 任一当前 holding 均拒绝；完整空集才可按原权限删除。漏维度、用 my_tasks 子集或造 helper 即失败 |
| ACC-GHP-002 disable 与失败/并发 | CTR-GHP-001/003/005 | holdings 非空及 Svc 故障下 disable；分页缺页、错身份、超时/丢回包、空读后 role/assignment 新增、registry 变更，两提交顺序 | 未来隔离真实写边界并发 fixture | disable 零 GC 请求、新旧 mutation 次数、序列化/复核记录、目标 CAS 和未知读回 | GC 不新增 disable 阻断；不能证明空/一致性即零离册；竞态留下幽灵或 UNKNOWN 重放即失败 |
| ACC-GHP-003 幽灵清单（issue 2） | CTR-GHP-002/005 | P2 检查器全扫描：仅实例/仅 role 幽灵、域+global、disabled、human、未知类型、多页、零幽灵和查询失败 | 未来隔离检查器+Core/Svc 读面 | owner/commit/invocation、报告及覆盖清单/分页证据、零 mutation 计数、读权限负控 | 精确 NOT_IN_REGISTRY holdings 清单；disabled 单列，human 不误报，未知不报 clean；漏 role、搜索空命中即报失败或自动修复均失败 |
| ACC-GHP-004 拒绝幽灵 owner（issue 3） | CTR-GHP-003/005 | 全部 owner 建立/替换、domain/global upsert/重新启用入口：local enabled+registry missing/disabled、映射歧义、不可用、合法 agent/human、disabled source 转给合法 target | 未来 Svc 正式 provisioning/application/repository 集成+Core 权威目录 | 全写点覆盖表、wire 错误映射、旧新 owner/role/receipt 事务读回、幂等/单 owner 负控 | 新幽灵/disabled/不可验证 agent target 零角色业务写；旧 owner 保留；合法路径/disable 不被误拦。只测 handler/伪造 enabled 镜像即失败 |
| ACC-GHP-005 真实交接/退役流程 | CTR-GHP-004/001/003 | 按现有 authoring 四操作创建并发布隔离 HR workflow、创建真实实例，执行交接模式和退役模式的所有成功/停止分支 | 未来有合法命令的隔离工作流+持久 Svc | published version、graph、实例/visit、每项角色→实际主体/命令/receipt/读回、最终 holdings 与目录 | 交接保留身份，退役先过户后离册；无合法转移路径则显式未完+零离册；文档代实例/任意 reassignment/伪造完成即失败 |
| ACC-GHP-006 UNKNOWN 与兼容 | CTR-GHP-001..005 | 过户中断/同 key 读回/receipt replay、managed Owner replacement、旧 Core/Svc/检查器不支持、回退 | 未来隔离 paired 集成 | 原 history/UNKNOWN/fence/预算 hashes、原错误/幂等读回、停止责任和未启用证据 | 保留原事实/责任/STOP，配套缺失不开新面；不重放、不扩权、不重写历史；未知变零/成功或旧 binary fail-open 即失败 |
| ACC-GHP-007 文档及接受门 | CTR-GHP-001..005 | 固定候选非作者语义审查、frontmatter/schema/生命周期/反向覆盖、P1–P4 独立核验 | 本次本地 docs；未来正式接受事务 | source hashes、完整 diff、实际 reviewer/head、P1/P2 绑定、Svc accepted ID/Contracts/hash/main/base、接受者权限与最终事务 | 本轮 proposed/none/production-none；可交提案，不能报 accepted/实施 PASS。缺一前置仍标 accepted/已配对即失败 |

反向覆盖：001→ACC-001/002/005/006/007；002→003/006/007；003→002/004/005/006/007；
004→005/006/007；005→001..007。5/5 Contracts 均有 Acceptance 定义，不代表 5/5 已通过。

## 11. Alternatives and disposition

- `ALT-GHP-001 REJECT`：把 disable 当删除并检查空 holdings；阻断紧急停权，违反三处置输入。
- `ALT-GHP-002 REJECT`：仅改本地 enabled 或在旧 Svc ID 下补 registry 拒绝；隐藏跨服务新语义。
- `ALT-GHP-003 REJECT`：把 Scheduler watchdog/猜想的 gateway 名称当实际实现；不能绑定真实路径。
- `ALT-GHP-004 REJECT`：独立脚本直接改表/任意改派/克隆一次 migration；越过业务和权限边界。
- `ALT-GHP-005 RETAIN`：现有 Core Definition、Auth canonical identity、Svc 业务/receipt、
  原 authoring/execute、UNKNOWN 和 managed STOP。没有被退休执行模型，不需要永久映射或 fallback。
- `ALT-GHP-006 REJECT`：查询异常当空，或扫描无幽灵当失败；把不确定和有效空结果混淆。

## 12. Migration, compatibility, and rollback

本 PR 只新增提案和来源/路由记录，不改 accepted authority、指针、产品代码、行为测试、
schema、部署或生产状态。原 root 简报/STOPPED 保留；不重做已完成的 surface 探索。
历史幽灵是后续按合法流程处置的债务，不自动删除、不永久 grandfather、不伪造已接管。
旧版本未资格则新面不启用；回退保留所有真实过户/receipt、旧身份 tombstone 和未完项。
回退不能自动恢复已退役旧权限、重放 UNKNOWN 或抹去已发生的跨服务效果。

## 13. Open questions

P1/P2 真实 owner/源码/调用链，P3 Svc owning successor 与 wire/一致性/过户合同尚未绑定。
这些是本提案明确的接受缺件，不是探索失败，也不要求 Owner 重复裁决已决定的三处置。
原责任链按 §3C 补齐；若发现实质改变业务归属/新特权/不可逆风险，则按原 §7 只升级差量。
本次交付到 PR 停止，不跨过这些前置。

```text
schema_version = 2
SPEC_GOVERNANCE_MODE = AUTHOR
AUTHORITY_ACTION = NEW
SPEC_ID = AGENT_CORE_GHOST_HOLDINGS_PROTECTION_V1
STATUS = proposed
PRIMARY_PARENT_AUTHORITY = AGENT_CORE_PRODUCT_ARCHITECTURE_V1
EXTERNAL_AUTHORITIES = fixed Svc restrictions in frontmatter; new paired authority REQUIRED/UNKNOWN
PLAN_LEVEL = EXEC_PLAN
ASSURANCE_LEVEL = CONTROLLED
ROUTE_STAGE = AUTHORITY_AUTHORING
AUTHORITY_ACCEPTED_IN_BASE = NO
DOCS_FIRST_REQUIRED = YES
IMPLEMENTATION_AUTHORITY = none
ACCEPTED_TARGET_IMPLEMENTATION_AUTHORITY = contracts only by separate lawful transaction
IMPLEMENTATION_ALLOWED = NO
MERGE_READY = NO (formal acceptance prerequisites incomplete)
OPERATION_ALLOWED = NO
OPEN_OWNER_DECISIONS = NONE_REQUIRED_FOR_THIS_PROPOSAL (delegated acceptance remains separate)
NORMATIVE_TBD = Svc owning paired protocol/wire/consistency and lawful transfer coverage (P3)
UNRESOLVED_AUTHORITY_CONFLICT = NONE_KNOWN_IN_THIS_CORE_PROPOSAL; dependent Svc changes gated
PARTIAL_SUPERSESSION = NONE
CONTRACT_COUNT = 5
CONTRACTS_WITH_ACCEPTANCE = 5
AUTHORING_READY_FOR_REVIEW = YES (proposal; not ready for acceptance)
READY_TO_MARK_ACCEPTED = NO
EVIDENCE_NEEDED = nonauthor exact-head review; P1-P4; future actual-entrypoint acceptance
DONE_WHEN = proposed docs + route/prerequisite record + checks + commit/push + base-main PR; no merge
EXPANSION_TRIGGER = accepted-authority conflict or request for code/production/new privilege
NEXT_REAL_ACTION = independent proposal review, then authorized docs delivery; P1-P4 before acceptance
```
