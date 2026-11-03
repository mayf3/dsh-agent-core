---
spec_id: AGENT_CORE_ADMISSION_RUNTIME_RELIABILITY_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
scope:
  - mayf3/dsh-agent-core
  - optional history bind resilience and managed admission directory convergence for issue 554
governed_by:
  - AGENT_CORE_PRODUCT_ARCHITECTURE_V1
  - AGENT_CORE_INTERNAL_AGENT_DIRECTORY_V1
  - PRODUCT_API_AUTHENTICATION_V1
external_authorities: []
supersedes: []
superseded_by: null
owners: [mayf3]
---

# AGENT_CORE_ADMISSION_RUNTIME_RELIABILITY_V1

## 1. Goal 与当前效力

消除可选 history bind 故障拖死 admission 的事故类别，并让 Workflow admission
摆脱 gui 域、源码 checkout 辅 runtime 的单点生命周期依赖。终态复用当前受管
production runtime 上的既有 IAD，不另造目录服务、身份模型或发布控制器。

本稿是 #554 r4 的 **proposed implementation-authorizing Spec**：
`implementation_authority: contracts` 仅在独立语义审阅、Owner/明确授权 maintainer
绑定 exact reviewed/final head 接受且进入实现 base 后生效。当前不允许实现、merge、
部署、重启、切换 env 或删除 aux；本稿本身永远不是生产操作 mandate。

```text
SPEC_GOVERNANCE_MODE = AUTHOR
AUTHORITY_ACTION = NEW
AUTHORITY_OWNERSHIP = resolved
ROUTE_STAGE = AUTHORITY_AUTHORING
AUTHORITY_ACCEPTED_IN_BASE = NO
PLAN_LEVEL = EXEC_PLAN
ASSURANCE_LEVEL = CONTROLLED
DOCS_FIRST_REQUIRED = YES
IMPLEMENTATION_READY = NO
PRODUCTION_READY = NO
SPEC_ACCEPTANCE = PENDING
```

## 2. Scope 与非目标

- Scope A：保留 PR #555 已接受并合入的 async bind containment；补齐
  `e9a61dee` 的 bounded-retry/专用测试余项及其必要的 shutdown 边界。
- Scope B：冻结终态承载、明确到仓的迁移责任、aux 退出 admission 的边界；
  给出可由后续实现和独立生产 mandate 验收的条件。
- 不改 IAD wire/auth/snapshot/deadline/no-cache/no-retry，不改变 Workflow 业务授权、
  Principal/Grant、history Tailnet identity/activation 或已有错误码。
- 不承诺所有生产故障零停机或全局 HA；本目标针对 **aux 生命周期单点依赖**。
  production runtime 自身的停机和 Auth/JWKS 故障仍按既有 authority fail-closed。
- 不复活关闭的 B7 发布线，不新增 watcher/watchdog、映射库、影子 registry、
  directory 专用 SERVICE/Client 或第二生产 writer；不在此治理其他 aux 业务退役、
  Scheduler UNKNOWN 清理或历史工件 watchdog 的全局移除。

## 3. Authority、授权输入与版本边界

所有仓内 authority/源码引用以 Core base
`f767e8d6608cdb0917aad2d471ba0454d0966a0f` 为观察坐标：

| 约束来源 | 本稿关系 |
|---|---|
| [Product Architecture](../AGENT_CORE_PRODUCT_ARCHITECTURE_V1.md) | 保留 Core Registry/Definition ownership、薄层和外部 Workflow 业务边界 |
| [IAD V1](AGENT_CORE_INTERNAL_AGENT_DIRECTORY_V1.md) CTR-IAD-001..006 | 保留 production server 上 exact directory、generic internal caller、权威同步 snapshot、fresh/no-store/no-auto-retry、独立 release/rollback |
| [Product API Authentication V1](PRODUCT_API_AUTHENTICATION_V1.md) CTR-PA-001/009/010 | Product API loopback-only；history-only Tailnet listener/default-off/activation/restart-only generation 不变 |
| [Production Deployment Control Plane V1](PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1.md) | accepted source framework 的 artifact/profile/mutex 边界；production_apply_authority 仍为 none，不证明已安装可调用 |
| [Delivery Resilience V1](AGENT_DELIVERY_RESILIENCE_V1.md) | 其明确排除的 #554 admission 拓扑由本稿单独处理，不扩展 delivery retry |
| [仓库本地治理](../../.agents/local/README.md) | docs-first、独立审阅、可归属 mandate、唯一 writer；治理流程输入不提升为 Product Contract |

本稿为 NEW：此前没有独立冻结 post-B7 aux 退出和 admission 承载收敛的 bounded
Decision；不修改 IAD accepted CTR-IAD-001..006 或 history activation 的既有含义，
因此 `supersedes: []`，不执行 partial supersession。IAD 文内 #525
CTR-IAD-007/008 在本 base 明标 proposed；本稿不会通过复述源码把它们标成 accepted，
也不修写 IAD 的历史状态文字。若后续必须改变 accepted 意义，应另走 whole-authority
SUPERSEDE，本稿不能充当豁免。

设计授权输入：

- [#554 c6595519762](https://github.com/mayf3/dsh-agent-core/issues/554#issuecomment-6595519762)
  持久化 Owner “按 agent 侧专业建议办”与 Scope A 余项收尾。
- r3/r4 任务补正明确解释为**设计权已授给工程侧**：本稿负责推荐三项具体设计，
  不要求先行推荐方案原文。r4 同时允许自行修正 r3 的 CLI 参数笔误。
  本轮将该解释随本稿/PR 持久化，替代 r2 的“须定位先行文档”任务前提。
- 这些输入授权 authoring，推荐设计仍待本稿 exact-head 接受；不是对本文全部
  Contracts 的预先接受，也不是生产权限。
- svc-workflow 和 agent-control 的职责见 CTR-ARR-005；本稿约束 Core 的交付与终态
  接受，**不单方面授权其他仓源码或生产操作**。各仓须以自己的 active authority
  和明确 mandate 接续。没有新增直接 external-authority pin；IAD 原有 Auth dependency
  原样保留，不复制或重定其规范。

## 4. 已修 / 未修与 Evidence

### OBS-ARR-001 — source 范围核查

- Source：Core Git objects、当前源码；environment：独立 clone，非生产；
  observed：2026-11-03；method：exact object/ancestry/diff/path read。
- Range：`fa4510beb6b01e5c40000a2ae36a62c526759e76` →
  `ce1d13c1e8585759c6a5f194fb5553d990574b5b` → 上述 base。
  fresh fetch/remote main 与 base 一致。

| 子问题 | fa4510be | ce1d13c1 / 本 base | 判定 |
|---|---|---|---|
| history async bind containment | 无 server error handler | 有；handler 在 listen 前 | 已修，`0ffb21754500551923be73ba88b6382474fb6b0b` 经 PR #555 / merge `3c651a6ea4cab45d9c8520f6ecc92f9478312eab` |
| bounded retry / 专用 bind-resilience tests | 无 | 无 | `e9a61deea1a01790d11a665e3e2fb5186ab6c5fc` 非 ce1/main ancestor；余项待集成 |
| exact IAD route 与 production composition | 已有 | 已有 | 不新增重复目录路由 |
| #525 missing-JWKS composition guard / health observations | 无该增量 | 已集成 | `0e440f83` → `893d6f37` → PR #604 / merge ce1d13c1；不等于 CTR-IAD-007/008 接受或终态迁移 |

可复核源码：
[history-listener.js](../../packages/product-api/src/history-listener.js) 的 server error/listen；
[Product API mount](../../packages/product-api/src/index.js) 的 history 异步 mount/disposal；
[workflow-admission.js](../../packages/product-api/src/workflow-admission.js) 的 exact route；
[compose.js](../../packages/production-runtime/src/compose.js) 的 Definition/handler/Product API；
[product-api-admission.js](../../packages/production-runtime/src/identity/product-api-admission.js)
的 composition seam。history blob 从 `9abdd61fc14c0d556352a57a8baff19673d72dc2`
变为 `e5e372276bdc4bc61e097466479b82d122976a64`；后者在 ce1/base 相同。

### OBS-ARR-002 — 已通过历史修复与余项的证据边界

[PR #555 证据](https://github.com/mayf3/dsh-agent-core/pull/555#issuecomment-6370558723)
及 [Scope A source closure](https://github.com/mayf3/dsh-agent-core/issues/554#issuecomment-6370660745)
记录 exact `0ffb2175` 的 RED/GREEN、differential regression、独立 review 与 source merge。
这是历史结果，本轮没有重新执行其测试或生产 canary。历史 aux 安装/业务成功只证明当时
partial-aux tuple，不证明当前生产。

直接读取 e9a61dee 的 diff 可见：初次失败后最多 30 次、60 秒间隔、unref timer 的
重试草图，以及不可路由 bind/loopback bind 两个测试；没有完整验证 retry exhaustion、
取消 timer 或 admission 连续性。因此它是可复用起点，不是可直接宣布本稿全部 Acceptance
通过的证据，也不得使已接受 containment 重新变成未修。

### OBS-ARR-003 — 设计输入与机制边界

Source：#554 正文及截至本轮的全部 12 条评论、c6595519762、r3/r4 task，
2026-11-03 read；以及 pinned-base 机制源码/历史 runbook（第 9 节）。
历史 issue 的 8787→8788 代表当时部署观察；本 base Product API 默认 8787、
optional history 默认 8788。默认值或历史端口不能识别当前生产 server 角色。

### STATE-ARR-001 与 Claims

- 本 base：containment SOURCE_MERGED；retry/test remainder NOT_IN_MAIN；
  directory source PRESENT；Scope B installed/loaded/consumer/business = UNKNOWN。
- 本轮无生产读取、无测试/服务启动。未见当前工件、loaded env、controller slot、
  consumer wiring 或 live business receipt；不把未知写成“尚不存在”。
- CLM-ARR-001，SUPPORTED：真实 source 增量是余项集成，不是重新修 containment/
  新增 IAD；依据 EVD-ARR-001。
- CLM-ARR-002，INFERRED design rationale：受管同一权威 Definition 的生产承载加
  aux admission retirement 能消除已描述的 gui/checkout 故障耦合；依据 EVD-ARR-002。
  这是待接受设计判断，未证明现网已达到。
- CLM-ARR-003，SUPPORTED：工程侧有提出三项推荐的 authoring 授权；
  不等于 Spec 已接受；依据 EVD-ARR-003。

| Evidence ID | Source → target / relation | 坐标、充分性与限制 |
|---|---|---|
| EVD-ARR-001 | OBS-ARR-001/002 → CLM-ARR-001、STATE-ARR-001 / SUPPORTS | 上述 Git range/base 与 PR receipt；足够划分 source 已修/余项，不支持当前安装/业务 |
| EVD-ARR-002 | OBS-ARR-003、IAD 001/003/005 → CLM-ARR-002 / SUPPORTS rationale | base + issue 历史；支持设计动机，runtime 可用性/迁移尚无执行证据 |
| EVD-ARR-003 | OBS-ARR-003 → CLM-ARR-003 / SUPPORTS | c6595519762 + 本轮 r3/r4 authoring mandate；仅足够进入 AUTHOR，acceptance/production 权限仍无 |

## 5. 三项推荐设计

三项 Decision 的 decision owner 为 Core Owner/授权 maintainer；engineering 在本稿中
选择推荐，接受前不生效。没有等待补写的规范选择；具体生产坐标属于未来操作 preflight。

### DEC-ARR-001 — 终态承载

选择：**当前受管 production runtime 的既有 loopback Product API/IAD**，由当前
受信发布控制器持有其 artifact/generation/lifecycle；读取该 runtime 的权威 Definition。
history 保持独立 optional listener，不能成为目录的启动/重试/ready 前置。

理由：复用已存在且 accepted 的 IAD 认证/观察和 Core ownership，去除 gui/checkout
耦合，不增加权威数据副本。这里“受管”要求实际可绑定工件与 loaded generation；
进程名字或端口不构成证明。

| 备选 | 取舍 |
|---|---|
| 保留 gui aux 为长期主路或 hot fallback | 拒绝：保留本次要消除的生命周期与 checkout 依赖 |
| 新建独立 directory daemon/registry mirror | 拒绝：增加独立模型、snapshot 一致性和运维面，本目标不需要 |
| managed production runtime 上既有 IAD | 推荐：最小机制复用，仍以安全 fail-closed 承受其自身停机 |

### DEC-ARR-002 — 迁移责任明确到仓

选择 Core producer/既有 DS release authority、svc-workflow consumer、agent-control
跨仓协调的分工（CTR-ARR-005），在 #554 同一业务 lineage 留下 producer→consumer→retirement
证据。生产只允许当前有效授权面的一位 writer，不沿用旧 #525/B7 的已关闭授权。

理由：Core 不能把 consumer env“默认为外部已切”，svc-workflow 不能凭 /health 选目录，
controller 不能用工件安装代替业务证明。

| 备选 | 取舍 |
|---|---|
| Core 单仓宣布业务迁移完成 | 拒绝：不拥有 Workflow 业务配置与 commit 判断 |
| 复活旧 B7 或另起独立发布平台 | 拒绝：旧授权不可转用，产生并行 writer |
| 三仓各自 authority、同一受控交接 | 推荐：责任可审计，接受与执行权限保持分离 |

### DEC-ARR-003 — aux 的退出边界

选择：aux 的 **admission directory 承载角色 MIGRATE → RETIRE**；终态所有受影响
consumer 的 normal/fallback/restart/recovery 都不能依赖或重建此角色。aux 上经独立
authority 支持的其他职责 RETAIN，不默认停整进程或删历史。

允许切换前的显式 TEMPORARY_BRIDGE：只服务经盘点确认的真实旧 consumer，绑定一个
受控切换任务及其结束条件。完成终态接受即退出；任务中止时保留 interim/blocked 状态，
由现有操作责任方处置，不能因超时自动删除，也不能无期限默认为终态。

| 备选 | 取舍 |
|---|---|
| aux 永久备用/请求失败时自动回切 | 拒绝：复活单点依赖，可能读取另一世代 Definition |
| 无盘点即 shutdown/delete 整个 aux | 拒绝：可能破坏独立职责或尚未迁移 consumer |
| 角色级迁移、负向证明、保留历史与独立职责 | 推荐：退出可验证，范围足够且有界 |

## 6. Contracts

以下 MUST/MUST NOT 只在本 Spec 被接受后成为新 obligations。

### CTR-ARR-001 — 保留 optional containment 与安全边界

history 同步 mount/listen 失败、异步 bind error、后续 serve error MUST 被该 optional
surface contained，不得成为 uncaught exception 或触发 runtime/admission 的退出、
重启或 gate 失败。未绑定时 history 不可用；不得由“listening”日志冒充成功。
已有 server error handler 语义保留。实现只补真实余项，不重开 PR #555 closure。

history 的 default-off、Tailnet-only history activation、WhoIs/profile immutable
generation 与 Product API loopback-only 约束 MUST 保持；本稿不自动启用 history、
改 host 为 loopback/wildcard、修改权限、绕过 identity readiness 或重启配置 generation。

### CTR-ARR-002 — 有界 bind retry、恢复与 teardown

启用并满足既有 history activation 的 mount，初次 listen 失败后只对
`EADDRNOTAVAIL/EADDRINUSE/EACCES` 这些 **尚未成功绑定的 bind error** 重试：
固定 60,000 ms 间隔，最多 30 次追加 listen（初次 + 30，最多 31 次）。
EACCES 仅可等配置外部恢复，绝不 chmod、提权、改端口或改 identity。

每 mount 同时最多一个 in-flight listen、一个 pending timer，timer MUST unref；成功 listening 后取消 pending
retry、停止该 bind budget；非 allowlist/耗尽进入 history-unavailable，保持 runtime/
admission 存活。成功绑定后的 serve error 只 contained/log，不借此重开 bind budget、
热换 generation 或重启其他 surface。新 mount 的 budget 只能随其合法生命周期重建。

close/dispose MUST 先标记已停止、清除 timer，再关闭 server；幂等、未绑定可终止。
生产 Product API 的 ctx.effect teardown MUST 进入同一停止/取消边界，不能仅修公开
listener.close() 而仍由现有直接 server.close() 路径绕过；异步 mount 完成与 disposal
交错时也不能留下活动 listener/timer。
已排队 callback 必须复核 mount 未停止且未 listening；同步 listen throw 也 contained，
不得逃逸 timer。日志失败不改变 containment，日志不得泄露 token/profile/credentials。
恢复 bind 仍用本 mount 原 host/port/auth generation，不自动重试 directory/业务请求。

### CTR-ARR-003 — 受管权威 producer

终态 IAD MUST 只从当前受管 production runtime 的已审 artifact/loaded generation
对外供受影响 consumer 使用，读取既有权威 Agent Definition；不得依赖 gui aux、
开发 checkout 的文件或进程，或新增持久 mirror/缓存真值。

沿用 exact `GET /v1/directory/agents/:agentId`、IAD caller/auth/error/1s deadline/
no-store/no-auto-retry 全部语义；不得改用 mobile `/v1/agents`、history listener、
display-name/prefix 猜测或非权威 healthy response。无需新增同功能 route。

### CTR-ARR-004 — 端点绑定与 release eligibility

交接 MUST 绑定角色、实际 origin/port、runtime unit、artifact/source hash、loaded
generation、Definition 来源、IAD verifier 配置来源与 consumer 的 base URL；
这是既有 release record 的必要证据，不引入新持久协议/身份。不得记录 Secret 值。

角色识别 MUST 包含正确受签 caller 的 exact directory 请求及 malformed/unauthorized/
disabled/missing target 负向结果；`/health`=200、端口名、PID、boot marker、
IAD health.ready 均不充分。Product API 保持 loopback-only；本稿不授权跨主机公网暴露，
若实际 consumer 无法在既有允许网络下到达，应停在迁移前，另行处理 authority gap。
“8788”仅当证据证明它是正确 IAD server 时才是可选配置值。

### CTR-ARR-005 — 仓库责任与权限

| 仓库/角色 | 必须提供的交接内容 | 不得代行 |
|---|---|---|
| mayf3/dsh-agent-core | producer/retry/tests、rebuildable artifact closure、权威目录及 history 隔离证据 | svc-workflow 业务授权、未经 mandate 的生产写入 |
| mayf3/svc-workflow | 自有 active authority 下核对 admission consumer；准备/应用其 WORKFLOW_ADMISSION_CORE_BASE_URL 切换、fresh observation/commit fail-closed 测试及业务结果 | 新 lookup identity、用 Core health 替代业务验收 |
| mayf3/dsh-agent-core 的既有 DS/release authority 对应操作者 | 在当前有效生产 authority 下绑定唯一 writer、preimage/rollback、drain/canary、apply 与 receipt/readback；未来 mandate 必须 fresh-verify 其 installed callable path | 把 source framework 当已安装控制器、旧 B7/#525 授权复活或另建发布 writer |
| mayf3/agent-control | 跨仓任务/证据交接，绑定上述实际 release owner 和 svc-workflow consumer owner | 不因协调而取得部署/业务权限，不把 Spec 当操作批准 |
| Auth owning repository | 沿用 IAD 的既有 caller issuance/verification 权限；如需自仓变更，走该仓 authority | 本稿不授权新 per-consumer directory Principal/Client/Grant |

当前 controller 的 installed callable path 未在本轮查证，状态 UNKNOWN；不得假定存在。
上述责任是 Core 接受跨仓交接的条件，不授予其他仓实现权。后续执行须记录具体有效
操作者与 task/slot、exact owning accepted heads；责任未绑定时生产阶段不 ready，
无需再悬置本文三项设计决定。

### CTR-ARR-006 — 分阶段 consumer 切换与 bridge

迁移 MUST 依次完成：(1) 冻结受影响 consumer 的 normal/fallback/startup/recovery
配置及真实调用方；(2) producer 工件/隔离 gate；(3) 当前 mandate 下 producer
loaded proof；(4) svc-workflow 单一生效 endpoint 切换与自有业务 canary；
(5) aux admission role 退出及恢复路径负向验收。每阶段持久化 exact tuple，不跳步。

桥接仅限第 4 步前盘点到的旧 consumer；记录 consumer/责任仓/起始 tuple、切换任务、
退出条件“所有已盘点 consumer 切换并通过第 5 步”及任务 abort 责任。不得新添 bridge
consumer、在一个 admission command 内向两端竞速/多数表决或自动 fallback。task 到期/
abort 不能冒充迁移完成；保留已知 interim truth，交回当前 release owner。

仅替换 endpoint 不改变原 caller、actor/assignee 校验、事务边界、每 command freshness
或 target exact identity。未知覆盖记 UNKNOWN，不把未盘点当零 consumer。

### CTR-ARR-007 — aux 角色退役与恢复收敛

宣布终态前 MUST 证明所有盘点 consumer 的正常调用、fallback、进程重启、controller
恢复及 rollback 配置不会访问/启动 aux admission directory。aux 停止或其历史地址
拒绝连接时，正确 managed producer 上允许/拒绝行为不变，aux 请求数为零。

retirement 只移除 admission executable eligibility；保留审计/历史 receipts，其他职责
逐项 RETAIN/MIGRATE/RETIRE。不得凭此关闭/删除未经授权的 aux 数据或独立服务。
终态之后 recovery/rollback 只能使用仍符合本拓扑的 last-good managed generation；
需要回到 aux 的 incident containment 必须有独立、显式、临时 Owner 授权，并使终态
conformance 退回不满足，不能伪称普通 rollback。

### CTR-ARR-008 — 复用 release/drain/fresh-child 机制

未来发布 MUST 使用当前有效的既有受信 release 路径、bounded reviewed artifact、
共享 mutation slot 和 preimage/rollback/readback。不得 whole-latest-main 部署或重建
第二 installer。需要 planned runtime restart 时复用现有 restart-drain census/
refusal；busy/unavailable/unknown 不得强制越过，也不得为 canary 发起未授权业务。

assembled candidate 的 closure-resolution 与 fresh-child boot gate按其适用 release
authority 运行；本稿不扩大其 allowlist 或把历史 PASS 复制到新 tuple。其 PASS 之外
仍需 producer runtime/IAD 和 consumer 证据。工件切换不得先 retire 仍被 live boot/
spawn 依赖的 last-good artifact 再留下不可恢复空窗；由既有 controller 证明连续可用，
不以新增 watchdog 代替受控交接。

### CTR-ARR-009 — 故障、回滚和 UNKNOWN

producer 不可达、配置/认证失败或权威查询错误时受影响 admission MUST 按既有 owning
语义 fail-closed，不把 transport error 改成 exists:false/业务允许，不读旧 positive
cache，不自动切 aux。目录自身 401/403/409/500/504 和 consumer 的既有业务错误映射
由原 authority 决定，本稿不重定义。

预切换 gate 失败不切 consumer；切换后失败按 exact preimage/兼容性和当前 mandate
回滚。退役完成前可在该次明确 bridge 范围内恢复冻结的旧 tuple，但应标明
MIGRATION_INCOMPLETE；退役后受 CTR-ARR-007 限制。不得修改或重放历史
outcome_unknown、清 fence、用 termination 冒充业务成功，或为了验证创建未授权业务。

### CTR-ARR-010 — 证据与完成声明

每个结果 MUST 分列 source integrated、artifact packaged、installed、loaded、
producer callable、consumer switched、aux role retired、business verified，
并绑定 authority/head/artifact/environment/time/method/actor/原始 receipt。
未执行或不可见为 UNKNOWN/NOT_EXECUTED；测试定义和本稿 Acceptance 表不是执行证据。

Scope A merged containment 的既有 PASS 保留；新余项用受影响 tests/review，不要求无理由
重跑旧 lifecycle。#554 保持开放，直到 Scope A 余项 source closure 与 Scope B 全部终态
及业务 acceptance 有合格证据；docs PR、独立 authoring review 或 source merge 都不能关单。

## 7. Acceptance（定义，尚未执行）

每项结果须绑定后续 candidate SHA、owning accepted Spec revision、环境与执行时间。
本稿交付仅检查定义完整性，不宣称这些运行验收通过。

| Acceptance / Contracts | Method | Environment / inputs | Required evidence | Expected result | Failure condition |
|---|---|---|---|---|---|
| ACC-ARR-001 / CTR-ARR-001 | child-process fault injection + auth boundary regression | isolated temp home；history disabled、合法 enabled 后 sync listen throw / async EADDRNOTAVAIL / serve error | child exit/liveness、signed IAD request transcript、route/side-effect spies、existing history auth cases | runtime与目录保持存活/原有允许拒绝；history unavailable 不扩权限 | uncaught exit、history failure带走目录、default-on/host/auth改变、日志虚报绑定 |
| ACC-ARR-002 / CTR-ARR-002 | deterministic server/fake-clock 生命周期 tests + disposable bind smoke | no production addresses；三 allowlist code、nonallowlist、30 retries exhaustion、恢复、生产ctx.effect/mount-dispose/timer race、throwing log sink | listen timestamps/counts、pending timer/unref/真实teardown observation、signed IAD continuity、专用 bind-resilience suite | 初次+最多30、每次60s、单 timer；成功/实际dispose 后零新 listen；原 generation；loopback fixture 正常 | 无限/多重retry、reset budget、公开close通过但生产dispose后复活、同步throw逃逸、仅检查error handler而无行为证明 |
| ACC-ARR-003 / CTR-ARR-003 | producer composition + snapshot/auth differential fixtures | assembled candidate temp deployment，aux absent、checkout inaccessible；exact/invalid/disabled/missing/ambiguous/timeout targets | IAD regression results、Definition来源/工件 closure、文件/网络依赖 spies | IAD 001..006 不变，managed Definition 唯一，no history/aux dependency | 新route/副本、mobile projection代替、stale positive、认证或deadline改变 |
| ACC-ARR-004 / CTR-ARR-004 | role-binding probe and negative substitution tests | isolated candidate，再由独立 future mandate 在实际目标 readback；wrong port/history/health-only impostor | signed exact route transcripts、unit/artifact/loaded/consumer配置角色表，secret-sanitized | 正确角色可证；假端点即使health=200也拒绝；loopback约束保留 | 单凭8788/health/PID ready、缺tuple、Secret披露、越权跨主机暴露 |
| ACC-ARR-005 / CTR-ARR-005 | cross-repo handoff/permission audit | Core/Svc/controller 各自 exact accepted head 和现行 task；不接受旧B7 mandate | producer/consumer/controller responsibility 与唯一writer/slot/授权、review记录 | 每仓有其实际交接与权限；Core不替Svc宣布业务成功 | 缺责任仓、第二writer、旧授权复活、本文被当生产mandate |
| ACC-ARR-006 / CTR-ARR-006 | staged integration + bridge negative fixtures | disposable Core/Svc pair；旧consumer、单一新endpoint、failover与partial-phase faults | phase receipts、全部已盘点调用/配置来源及call counts、command-window观察和业务结果 | 顺序受控、无dual endpoint、abort仍interim、fresh/actor/事务不变 | 跳步、未盘点当零、bridge无限期/新consumer、race/fallback或freshness回退 |
| ACC-ARR-007 / CTR-ARR-007 | retirement and restart/recovery/rollback fault matrix | isolated pair/controller recovery fixture；aux endpoint拒绝连接，停止其角色；其他角色sentinel；未来受控目标只按mandate | normal/fallback/restart/recovery/rollback每行trace与零aux调用、角色处置表 | managed允许/拒绝正确；aux不被访问/复活；其他职责与历史保留 | restart恢复aux、隐式fallback、删独立职责、仅grep配置无执行负向证明 |
| ACC-ARR-008 / CTR-ARR-008 | existing closure/fresh-child + drain refusal + artifact handoff checks | assembled disposable release；drained/busy/census unavailable、bad closure、artifact切换中止 | 当前gate结果/receipts、候选与loaded绑定、last-good可恢复性、原store无写spy | bad closure/refused drain阻断apply；合格boot只证明其边界；live依赖无retire空窗 | 强制restart/放宽gate、最新main整树、fresh-child PASS冒充IAD/业务、丢last-good |
| ACC-ARR-009 / CTR-ARR-009 | transport/JWKS/snapshot故障及rollback tests | isolated producer/consumer，pre/post-retirement两种状态；UNKNOWN sentinel records | denied admission/零commit、原错误映射、精确rollback与protected-record hash/调用trace（fixture） | fail-closed，无cache/aux/replay；rollback状态诚实区分 | transport变允许/exists:false、旧UNKNOWN重放/清fence、退役后无授权回aux |
| ACC-ARR-010 / CTR-ARR-010 | evidence/release truth audit | source PR + future受控操作/业务receipts | 逐阶段tuple与qualified Evidence关系；缺项显式UNKNOWN；#554回填 | 仅已实测阶段可PASS，完整source/终态/业务才提请关单 | docs/source/health/历史aux成功被宣称当前业务完成或未执行写PASS |

### 双向覆盖

| Contract | Acceptance |
|---|---|
| CTR-ARR-001 | ACC-ARR-001 |
| CTR-ARR-002 | ACC-ARR-002 |
| CTR-ARR-003 | ACC-ARR-003 |
| CTR-ARR-004 | ACC-ARR-004 |
| CTR-ARR-005 | ACC-ARR-005 |
| CTR-ARR-006 | ACC-ARR-006 |
| CTR-ARR-007 | ACC-ARR-007 |
| CTR-ARR-008 | ACC-ARR-008 |
| CTR-ARR-009 | ACC-ARR-009 |
| CTR-ARR-010 | ACC-ARR-010 |

## 8. 后续实现 / 迁移次序

本节是依赖次序，不是可执行生产 runbook：

1. 本 Spec 独立 semantic review、exact-head Owner acceptance、进入 main。
2. Core 新任务 REUSE preflight；在 isolated surface 复用 e9a61dee 的适用字节并补足
   teardown/cadence/exhaustion/admission continuity，不 blind cherry-pick 或重写已过修复；
   固定实际 changed-file closure，按 guardrails 拆分、focused tests 和独立 affected review。
3. Core producer artifact 在 disposable 环境通过相应 Acceptance；svc-workflow 在自己
   accepted authority 下准备 consumer 集成。新跨仓语义若超出现有 authority，先在该仓
   docs-first 接受；不能在 Core PR 中偷授权限。
4. 当前 controller/release owner 创建独立、一次范围有效的 mandate/runbook，fresh-read
   实际拓扑、工件、loaded env、actor、slot、preimage/rollback；绑定具体 origin/port。
   本稿的设计不因这些未采集的 live 坐标而留有 normative TBD。
5. 依 CTR-ARR-006 顺序 apply/readback/canary/role retirement；失败停止受影响阶段，
   保留原记录。满足全部证据后向 #554 回填终态，提请有权者关单。
   当前只有第 1 步的 proposed 文档，后续全部 NOT_EXECUTED。

## 9. restart-drain / fresh-child 引用兼容性

本 base 没有发现以这两个机制名命名的独立 active governing Spec；以下是具体机制/
历史 evidence，不能伪称它们是新生产授权：

- [C11-R3 frozen runbook](../../deployment-artifacts/c11r3-restart-safe-v1/RUNBOOK.md)
  仅对历史 `04bae91c` exact packet 生效。复用的是
  [scheduler-cp-admission](../../scripts/scheduler-cp-admission.mjs)
  及其调用的现有 drain/refusal 机制；不重用历史批准、restart次数或紧急 override。
- [fresh-child boot canary](../../scripts/lib/trusted-cp-fresh-child-boot-canary.mjs)
  在 throwaway home 下验证 assembled candidate child/plugin closure；
  [closure-resolution gate](../../scripts/lib/trusted-cp-closure-resolution-gate.mjs)
  和 [runtime app graph gate](../../scripts/lib/trusted-cp-runtime-app-graph-gate.mjs)
  有各自边界。历史
  [operation package](../evidence/shared-codex-auth-deployment-root-refreeze-v2-20261002/OPERATION_PACKAGE_V2.md)
  只作为 gate 来源和局限证据。
- fresh child boot/closure 不证明 production-runtime directory handler ready、
  当前 JWKS/caller可用、consumer 已切换、business admission 成功或 aux 已退出。
  CTR-ARR-004/006/007 的证据必须另有对应执行；本轮未运行上述工具。

## 10. Authoring 结束边界

```text
STATUS = proposed
IMPLEMENTATION_AUTHORITY = contracts (effective only after acceptance in base)
PRIMARY_PARENT_AUTHORITY = AGENT_CORE_PRODUCT_ARCHITECTURE_V1
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
PARTIAL_SUPERSESSION = NONE
CONTRACT_COUNT = 10
CONTRACTS_WITH_ACCEPTANCE = 10
AUTHORING_READY_FOR_REVIEW = YES
READY_TO_MARK_ACCEPTED = NO
NEXT_ACTION = REVIEW
```

仍待：独立 exact-head Spec acceptance；之后的实现/release/consumer/终态业务验证。
本稿、PR open 或 #554 回填均不跨越这些边界。
