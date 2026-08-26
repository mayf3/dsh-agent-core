---
spec_id: AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_IMPL_V1
status: accepted
accepted_by: mayf3
accepted_date: 2026-08-26
accepted_reviewed_head: a3f787e673276942371bd0b5d8bb5b94d1302595
review_verdict: PASS
review_blocker_count: 0
date: 2026-08-26
type: implementation-authorizing child Spec (SPEC ONLY — 本轮只冻结实现授权边界；不实现、不配置 Credential、不部署)
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
parent_policy_authority:
  AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V1
governed_by:
  - AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V1
  - AGENT_PROCESS_LIFECYCLE_HARDENING_V2
  - SCHEDULER_TIMEOUT_OUTCOME_V2
  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0
external_authorities: []
supersedes: []
superseded_by: null
scope:
  - 授予 AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V1（accepted）所冻结政策的**最小**实现授权
    （父 Spec DEC-012 / CTR-013 委托的「独立 implementation-authorizing authority」）
  - agent-model-overrides.json version 2 loader（routeCatalog + primary + fallbacks[]）
  - MAX_CONFIGURED_ROUTES = 4（父 Spec OWNER_DECISION Q-1 已冻结）
  - 三入口共用统一 route-attempt seam（onIngress / deliver / Scheduler invokeAgent）
  - per-hop PROVEN_NO_ADMISSION gate（父 Spec CTR-004 四类白名单原样执行）
  - STOP_CHAIN 禁止集（父 Spec CTR-005 原样执行）
  - ONE_LOGICAL_TURN（父 Spec CTR-006 原样执行，含 Scheduler V2 outcome envelope 保持）
  - per-attempt bounded evidence journal（父 Spec CTR-008 原样执行）
  - Scheduler 只能继承 Agent chain（父 Spec DEC-013 / CTR-009 原样执行）
  - 不写死 GLM/Luna 顺序（父 Spec DEC-004 原样执行）
  - 父 Spec Q-4（活 process reconciliation）在本 child authority 内的最小冻结
owners:
  - repository-maintainers
references:
  - docs/specs/AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V1.md（accepted @ main 7ab2e6d；
    父 policy authority；本 Spec 是其 DEC-012 / CTR-013 委托的独立 implementation-
    authorizing child authority，不改其任何语义）
  - docs/specs/AGENT_PROCESS_LIFECYCLE_HARDENING_V2.md（accepted；spawn/admission/
    turn / outcome_unknown 语义锚——父 Spec CTR-004/005 引用不重定义，本 Spec 同样只引用）
  - docs/specs/SCHEDULER_TIMEOUT_OUTCOME_V2.md（accepted @ main，已实现；Scheduler V2
    occurrence / outcome envelope / requestId 幂等语义 authority）
  - docs/decisions/SCHEDULER_OCCURRENCE_OUTCOME_V2.md（D-007；accepted Current
    Scheduler Authority）
  - docs/specs/AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0.md（accepted；vendored
    SPEC_GOVERNANCE_V0 §10 为 implementation 记录义务依据）
  - docs/specs/AGENT_CORE_HARDENING_PROGRAM_V1.md（accepted；框架，无冲突）
---

# AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_IMPL_V1 — ordered route chain 的最小实现授权（implementation-authorizing child authority）

> SPEC_STATUS = **accepted**（lifecycle-only acceptance finalize 2026-08-26 ·
> accepted_reviewed_head = `a3f787e673276942371bd0b5d8bb5b94d1302595` ·
> 链路 授权审计 = PASS · BLOCKER_COUNT = 0 · accepted_by = mayf3 ·
> authoring round 2026-08-26；链路 授权执行）。
> 本文件是 `AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V1`（accepted，下称**父 Spec**）的
> **最小 implementation-authorizing child authority**：父 Spec 冻结
> `implementation_authority = none` 并规定「实现须由独立 implementation-authorizing
> authority 在本 Spec accepted 且进入 implementation base 后另行授予
> （governance §10）」——本文件即该 authority。它**不 supersede 任何 Spec**：
> 父 Spec 保持唯一 model-route policy authority；本 Spec 只在其冻结政策内授予
> 有界实现权限，并冻结父 Spec 明确委托给本 authority 的实现轮决策（Q-4）。
>
> 授权生效条件（governance / specs README 冻结）：本 Spec `status: accepted`
> **且** 已存在于 implementation base（进入 main 的 commit）。proposed 阶段
> 不授权任何实现。实现 base 必须是含 Scheduler V2 的最新 main
>（本 Spec 全部实现事实锚定 `7ab2e6d`，见 §4/§5）。
>
> 本轮（authoring round）不实现、不配置 Credential、不部署：不改任何
> packages/ 代码，不写 agent-model-overrides.json，不执行 OAuth，不复制任何
> credential，不发送 Feishu 消息，不重启任何进程，不 merge。
> `production_apply_authority = none`：生产配置写入 / 激活（父 Spec Q-2 zai
> tuple 核实、Q-3 Luna 就绪轮）不在本 Spec 授权内，仍需独立轮次。
>
> **Acceptance finalize（2026-08-26，链路 授权采纳执行）**：mayf3 对 exact
> reviewed head `a3f787e673276942371bd0b5d8bb5b94d1302595`（链路 授权审计 =
> PASS，BLOCKER_COUNT = 0）执行 lifecycle-only acceptance：本文件
> `status: proposed -> accepted`（acceptance provenance 仅记录于 frontmatter、
> 本 header 段落与 §15）。**normative body 逐字不变**（NORMATIVE_BODY_CHANGE =
> NONE——§1–§14 byte-preserved，含 proposed 阶段条件句与 authoring 轮
> Final Output）。`implementation_authority = contracts` 与
> `production_apply_authority = none` 保持不变；按 vendored
> SPEC_GOVERNANCE_V0 §2.1，本文件 merge into main 前不是 active repository
> authority，本 Spec 自身的实现 gate（accepted AND 存在于 implementation
> base）在 merge 后方可满足。事务明细见 §15。

---

## 1. Goal

把父 Spec 已冻结的 ordered configurable route chain 政策转化为**最小、有界、
可评审的实现授权**，一次授权恰好覆盖以下冻结实现范围（Owner 任务指令
2026-08-26 逐项冻结；每项标注其父 Spec 依据，本 Spec 不新增政策语义）：

| # | 冻结实现范围 | 父 Spec 依据 |
|---|---|---|
| F-1 | `agent-model-overrides.json` **version 2** loader | §2.1/§2.2、CTR-001 |
| F-2 | `routeCatalog` + `primary` + `fallbacks[]` 配置模型 | §2.1、CTR-001、DEC-003 |
| F-3 | `MAX_CONFIGURED_ROUTES = 4` | §2.3、Q-1 OWNER_DECISION（acceptance 已批）、DEC-008 |
| F-4 | 三入口共用**统一 route-attempt seam**：onIngress / deliver / Scheduler invokeAgent | CTR-013(a)、OBS-009 |
| F-5 | **proven-no-admission 才进入下一 Route**（四类白名单 + 逐 attempt 生命周期评估） | CTR-004、CLM-002/EVD-002 |
| F-6 | `outcome_unknown` / post-admission / partial output / tool started / transcript produced / unknown class 等 = **STOP_CHAIN** | CTR-005（九类封闭集全文） |
| F-7 | **ONE_LOGICAL_TURN** 外部语义 | CTR-006、DEC-006 |
| F-8 | per-attempt **bounded evidence** journal + redaction 边界 | CTR-008、DEC-011 |
| F-9 | Scheduler **只能继承 Agent chain**（job/request 禁止内嵌 fallbacks） | DEC-013、CTR-009 |
| F-10 | **不写死 GLM/Luna 顺序**（ROUTE_ORDER_HARDCODED_IN_CODE = FORBIDDEN） | DEC-004、ALT-008 |

本 Spec 新增的唯一规范性内容 = 实现轮绑定决策（§8 DEC-IMPL-004..008：
统一 seam 形态、Q-4 reconciliation、explicit-model strict 落地、journal 落点、
deadline 语义）与实现边界（§9 CTR-IMPL-*）。全部在父 Spec 冻结政策内，
无一改写父 Spec ruling；若实现中发现 Contract 缺口，走 governance §10
stop → report → 独立 docs-only 变更 → 重启实现。

## 2. Scope and non-goals

### 2.1 In scope（= §1 F-1..F-10 的实现授权）

- `packages/production-runtime`：v2 loader（替换 v1 单 override 常量锁定形态）、
  `resolveProcessConfig` 链快照扩展（仍只读、仍只在 process boundary 重读）。
- `packages/agent-router`：统一 route-attempt chain executor（新模块）+ 三个
  入口 call site 接线 + journal 发射 + route-aware process 复用 gate（Q-4）。
- `packages/scheduler-router`：invoker 接线到 Router 发布的统一 seam 表面
  （不改 Scheduler occurrence/store/job model 语义）。
- 上述包的测试（单元 / 注入 / 结构审查级；对照父 Spec §10 ACC 框架 +
  本 Spec §10 增补项）。

### 2.2 Out of scope（明确不授权；实现 PR 触碰即 out-of-spec）

- **生产配置写入 / 激活**：不写生产 root 的 `agent-model-overrides.json`，
  不激活任何 v2 配置（父 Spec Q-2 / Q-3 保持开放并 gate 激活；
  `production_apply_authority = none`）。
- **Credential / provisioning / OAuth**：零授权（父 Spec CTR-010 全文不变；
  禁止复制旧 root secret、禁止 `~/.codex/auth.json`、禁止 OPENAI_API_KEY 路径）。
- **部署 / 重启 / 生产状态**：零授权。
- **父 Spec 文件改动**：`GOVERNING_SPEC_UNMODIFIED`——实现 PR 不得修改
  `AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V1.md`（implementation agent 不得扩张
  自己的 governing Spec）。
- **DSH model-call 层 / dsh-codex / pi-ai / harness**：零改动（父 Spec ALT-007、
  CTR-011）；pin 变更须父 Spec 自身 amendment。
- **dynamic quota router / account pool / load balancing / raw provider error
  文本解析**：FORBIDDEN（父 Spec CTR-013(d)）。
- **job/request 内嵌 fallbacks / job-specific chain**：FORBIDDEN（父 Spec
  DEC-013 / ALT-011）。
- **Scheduler store / occurrence / timeout 语义**：零改动
  （SCHEDULER_TIMEOUT_OUTCOME_V2 已 accepted 且已实现；本 Spec 只要求链执行
  保持其 envelope 语义，见 CTR-IMPL-005）。
- **新 persistent state**（journal 专用 store / 新 authority store）：不授权
  （CTR-IMPL-006 冻结 journal 落点 = 既有结构化 audit/log 表面）。
- **explicit model → route 解析机制**：不授权（DEC-IMPL-005 只冻结 strict 行为）。

## 3. Authority and dependencies

```text
AUTHORITY_FORM          = child implementation-authorizing Spec（不 supersede 任何 Spec）
PARENT_POLICY_AUTHORITY = AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V1（accepted @ main 7ab2e6d）
IMPLEMENTATION_BASE     = 最新 main，≥ 7ab2e6d（必须已含 Scheduler V2：PR #71 merge 32ce1fe）
AUTHORIZATION_GATE      = 本 Spec accepted AND 本 Spec 存在于 implementation base
                          （proposed 阶段 IMPLEMENTATION_ALLOWED_NOW = NO）
```

- 本 Spec 与父 Spec 的分工：父 Spec = **政策**（schema、gate、STOP 集、journal
  字段、pin、隔离、providerEnv 安全契约）；本 Spec = **实现授权与实现轮绑定**
  （谁可以动哪些文件、seam 长什么样、Q-4 怎么解、envelope 怎么保持）。政策
  语义冲突时**以父 Spec 为准**，本 Spec 对应条文自动失效并触发 governance §10
  gap 流程。
- 依赖的 accepted authorities：`AGENT_PROCESS_LIFECYCLE_HARDENING_V2`
  （admission / `outcome_unknown` / watermark 语义——本 Spec 只引用不重定义，
  与父 Spec CTR-004/005 同一锚）；`SCHEDULER_TIMEOUT_OUTCOME_V2` + D-007
  （Scheduler V2 occurrence / envelope / requestId 幂等 / C-001 不折叠
  outcome_unknown / C-004 pre-start vs started / C-025 deadline / D-007 §11.4
  delivery 与 execution outcome 分离）。
- 与 `DSH_PROVIDER_FALLBACK_CHAIN_V1`（proposed，未 merge）无关：层级不同、
  scope 不同（父 Spec ALT-007 已 REJECTED 该层实现链），本 Spec 不依赖它。
- PR #60 处置不变（父 Spec §3.4）：`ABANDONED_UNMERGED_CANDIDATE`，本 Spec
  不携带其任何文件或 lifecycle mutation。

## 4. Current State（只读核实；as of `7ab2e6d` = 最新 main，含 Scheduler V2）

- `STATE-IMPL-001` — 父 Spec 已 accepted 且已在 main（`7ab2e6d` = PR #70
  merge；accepted_reviewed_head `ee13cb2`；acceptance 时 OWNER_DECISION 已把
  `MAX_CONFIGURED_ROUTES` 冻结为 4）。Basis: `OBS-IMPL-001`。
- `STATE-IMPL-002` — 最新 main 已含 Scheduler V2 实现（PR #71 `32ce1fe` +
  blocker 修复 `5f24a67`）：第三入口 invoker 现承载 V2 语义
  （requestId 幂等 / per-occurrence fresh Session / onStart / started /
  outcome_unknown passthrough），父 Spec OBS-009 / OBS-013 的锚点行号在
  最新 main 已漂移，本 Spec 以 `7ab2e6d` 重锚（§5）。Basis: `OBS-IMPL-002`、
  `OBS-IMPL-003`。
- `STATE-IMPL-003` — 代码现状与父 Spec STATE-006 结论一致（在 `7ab2e6d`
  复核成立）：v1 单 override 常量锁定 loader 仍在（route tuple 值锁死代码常量
  `CHATGPT_SUBSCRIPTION_V1`）；无 ordered fallback seam；无 attempt journal；
  route 在 AgentProcess 内不可变；`resolveProcessConfig` 仅在 process boundary
  重读。Basis: `OBS-IMPL-004`、`OBS-IMPL-005`、`OBS-IMPL-006`、`OBS-IMPL-009`。
- `STATE-IMPL-004` — 三个入口在 `7ab2e6d` 全部收敛到
  `ensureRunning(agentId)` → `proc.turn(...)` / `proc.deliver(...)` 同一
  process-admission 路径；无任何入口自带路由编排。Basis: `OBS-IMPL-002`、
  `OBS-IMPL-006`、`OBS-IMPL-007`。
- `STATE-IMPL-005` — 生产 root（authsvc）`agent-model-overrides.json` 仍
  ABSENT（父 Spec OBS-003 复核成立）；旧 root（yanfenma）存在 v1 legacy 文件
  （Luna + providerEnv），对生产 root 无影响，v2 loader 对它 fail-loud
  （version ≠ 2）符合预期。Basis: `OBS-IMPL-010`。
- `STATE-IMPL-006` — Scheduler invokeAgent 的 `request.model` 当前仅进入
  admission 幂等 fingerprint（scheduler-router/src/index.js:184），从不参与
  route 解析（bridge 未传给 ensureRunning/turn）。Basis: `OBS-IMPL-008`。

## 5. Observations（as of `7ab2e6d`，2026-08-26 复核）

- `OBS-IMPL-001` — 父 Spec accepted 状态。`origin/main`（`7ab2e6d`）中
  `docs/specs/AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V1.md` frontmatter
  `status: accepted`、`supersedes` 含两份旧 authority；PR #70 已 merge。
  复核方法：`git show origin/main:docs/specs/...` frontmatter。
- `OBS-IMPL-002` — 第三入口（Scheduler）@ `7ab2e6d`。
  `packages/scheduler-router/src/index.js:128`
  `const proc = await router.ensureRunning(request.agentId)`；`:134`
  `await proc.turn(request.sessionId, request.message, {...}, turnTimeoutMs)`；
  `:180` `function invokeAgent(request)`；`:96` `createRouterInvoker(router, opts)`。
  V2 语义：`request.requestId`（occurrence idempotencyKey）驱动 in-process
  admission 去重（`:186-198`，fingerprint 冲突 →
  `OCCURRENCE_PAYLOAD_CONFLICT`）；outcome envelope `status:
  'ok' | 'error' | 'outcome_unknown'`，post-dispatch 失败无 exact-turn
  termination proof 一律 `outcome_unknown`（C-001），`started: false` = proven
  pre-start rejection（C-004）；turnTimeoutMs = `request.timeoutMs + 30_000`
  margin（scheduler 的 deadline race 先 settle）。
- `OBS-IMPL-003` — Scheduler V2 seam 契约 @ `7ab2e6d`。
  `packages/scheduler/src/seams.js:24` `INVOKE_CONTRACT`：input 含
  `agentId`、`sessionId`（per-occurrence fresh non-main native Session，C-031）、
  `requestId`（occurrence idempotencyKey，跨全部 admission transport retry 复用，
  C-008/C-023）、`model`（`'string|undefined — opaque model override
  (payload.model; not proven by D-007)'`）、`timeoutMs`（剩余 execution
  deadline，C-025）、`signal`（deadline 到即 abort；观测到 ≠ termination
  proof，C-010）、`onStart`（恰好在本 turn dispatch 时调用一次，C-027）。
- `OBS-IMPL-004` — v1 loader 常量锁定形态仍在 @ `7ab2e6d`。
  `packages/production-runtime/src/model-overrides.js:13`
  `CHATGPT_SUBSCRIPTION_V1` 常量（含 targetAgentId/provider/model/plugin/
  pluginVersion/dshVersion/dshCommit/credentialFile）；`:206`
  `loadAgentModelOverrides`：强制 `{"version":1,"overrides":{...}}`；
  `:226` at most one override；`:230-231` agentId 必须 = 常量 targetAgentId
  （`agt_cto-agent`）；`:243-247` provider/model/plugin/pluginVersion 必须
  **逐字段等于代码常量**。即父 Spec OBS-006 记录的
  ROUTE_ORDER_HARDCODED_IN_CODE 形态在最新 main 原样存在（v2 要移除的对象）。
- `OBS-IMPL-005` — resolveProcessConfig @ `7ab2e6d`。
  `packages/production-runtime/src/compose.js:216` startup 一次
  `loadAgentModelOverrides`；`:217-221` `resolveProcessConfig = (agentId) =>`
  每次调用重读 overrides 文件并返回单个 resolved route object；`:280` 导出。
  行号自父 Spec OBS-007 的 `:274`（@78212c7）漂移至 `:216-221`，语义不变
  （process-start configuration，never per-turn dynamic routing）。
- `OBS-IMPL-006` — registry / process 生命周期 @ `7ab2e6d`。
  `packages/agent-router/src/process-registry.js:259` `ensureRunning(agentId)`
  find-or-start；`:328` startup 阶段 `processConfig =
  resolveProcessConfig(agentId)`（spawn 前一次性解析）；`:68` 每 spawn 分配
  新 generation；slot 状态机 EMPTY/STARTUP/REAP/READY + identity CAS；
  `:478` plugin teardown await 每个 owned process 的 real-exit shutdown。
  推论与父 Spec OBS-008 相同：AgentProcess route 不可变，**route 切换 =
  新 process attempt（新 generation）**。
- `OBS-IMPL-007` — 前两个入口 @ `7ab2e6d`。
  `packages/agent-router/src/index.js:248`
  `feishu.setCallback(ingressDelivery.onIngress)`；`:284`
  `deliver: ingressDelivery.deliver`。
  `packages/agent-router/src/ingress-delivery.js:60` `onIngress`：`:86`
  `ensureRunning(binding.activeAgentId)` → `:87` `await proc.turn(...)`（同步
  等待 turn 完成）；`:178` `deliver({requestId, agentId, sessionMode, message})`：
  `:223` `ensureRunning` → `:232` `await proc.deliver(sessionId, message,
  {cwd, callerCorrelation:{requestId}})`——**异步 admission**：`accepted: true`
  仅表示消息进入正确 DSH Session inbox（session/prompt receipt = inbox
  accept），从不等待 turn；turn 异步继续。
- `OBS-IMPL-008` — `request.model` 现状。`packages/scheduler-router/src/
  index.js:184`：`request.model ?? null` 仅出现在 admission fingerprint 数组；
  `executeAgent` 内 ensureRunning/turn 调用不使用它。即显式 model 在
  implementation base 是 opaque 且路由无效（与 seams.js「not proven by
  D-007」一致）。
- `OBS-IMPL-009` — 零链代码 @ `7ab2e6d`。`grep -rn "ROUTE_CHAIN_ID|
  ATTEMPT_INDEX|ROUTE_ATTEMPT|attemptJournal|route_attempt|routeChain"
  packages/ --include="*.js"` = 0 匹配（父 Spec OBS-010 在最新 main 复核成立）。
- `OBS-IMPL-010` — 配置文件现状（只读，2026-08-26）。
  生产 root `/Users/authsvc/.agent-core/agent-model-overrides.json` = ENOENT
  （父 Spec OBS-003 成立）。旧 root `/Users/yanfenma/.agent-core/
  agent-model-overrides.json` 存在 v1 形态（version 1、Luna override +
  providerEnv 四键）——旧 root 非 production root（父 Spec STATE-001），
  对 v2 loader 是 version ≠ 2 fail-loud 的预期输入，无需迁移动作。
- `OBS-IMPL-011` — 单 turn deadline 现状。Router 侧 per-turn deadline
  （`deadline-config.js`：`turnTimeoutMs` 默认 300000、env
  `DSH_AGENT_TURN_TIMEOUT_MS`，语义锚 V2 lifecycle：watermark established →
  terminal）；Scheduler 侧 per-occurrence persisted execution deadline
  （C-025，`timeoutMs` 传入 + 30s margin）。三入口各自已有**单一** deadline，
  不存在 per-attempt 预算机制。
- `OBS-IMPL-012` — 既有 bounded audit 表面。process-registry 内
  `auditStaleSlot(detail)`（`:57-61`）模式：结构化、有界、非 surface 的
  audit 记录已存在，可作为 CTR-IMPL-006 journal 落点的既有表面参照。

## 6. Claims and assumptions

- `CLM-IMPL-001`（SUPPORTED）— 最新 main 仍无任何链 seam / journal /
  v2 loader（父 Spec CLM-003 在 `7ab2e6d` 复核成立），实现范围 F-1..F-10
  全部是新增代码，不存在需先拆除的半成品。Basis: `EVD-IMPL-001`。
- `CLM-IMPL-002`（SUPPORTED）— 三个入口在 `7ab2e6d` 已收敛到
  `ensureRunning` → `proc.turn` / `proc.deliver`，因此「统一 route-attempt
  seam」可以在该收敛点以**单一 executor + 三处 call site 接线**实现，
  不需要改三入口各自的对外接口契约。Basis: `EVD-IMPL-002`。
- `CLM-IMPL-003`（SUPPORTED）— Scheduler V2 envelope 语义与链执行兼容：
  一次 occurrence = 一次逻辑 turn = **一次**链执行（多 route attempt 是
  occurrence 内部过程）；链在整体上对外产出**恰好一个** outcome envelope
  （成功 / 最后失败类 / outcome_unknown），hop 从不产生独立 outcome，
  `requestId` 幂等语义不因内部多 attempt 改变（chain hop ≠ transport
  retry；admission fingerprint 不变）。Basis: `EVD-IMPL-003`。
- `CLM-IMPL-004`（INFERRED）— Q-4 可在既有 generation / slot 状态机内以
  「route-aware 复用 gate + 新 generation spawn + 既有受控 shutdown」承载
  （DEC-IMPL-004 冻结）；无需改 AgentProcess route 不可变语义，无需新的
  进程管理机制。Basis: `EVD-IMPL-004`（静态推断；动态注入验证属 §10
  ACC-IMPL-004）。
- `CLM-IMPL-005`（OPEN_ASSUMPTION，owned）— zai catalog tuple（Q-2）与
  Luna 就绪（Q-3）仍未关闭，但它们只 gate **配置激活**，不 gate 代码实现
  与单元/注入级验收（loader 校验与链编排可用合成 route 测试）。本 Spec
  显式将其持有为 contract risk：实现完成后、Q-2/Q-3 关闭前，目标 Agent
  在生产保持现状（无 override 文件 = global env route），链代码 inert。
  Basis: 父 Spec §2.4/§13；`OBS-IMPL-010`。

## 7. Evidence relations

- `EVD-IMPL-001` — `OBS-IMPL-004`、`OBS-IMPL-005`、`OBS-IMPL-009` →
  SUPPORTS `CLM-IMPL-001` / `STATE-IMPL-003`。强度：`7ab2e6d` 源码逐点
  file:line + 全量 grep 零匹配。局限：静态审查。
- `EVD-IMPL-002` — `OBS-IMPL-002`、`OBS-IMPL-006`、`OBS-IMPL-007` →
  SUPPORTS `CLM-IMPL-002` / `STATE-IMPL-004`。强度：三入口收敛点逐行核实
  （含 Scheduler V2 重锚）。局限：静态审查；行为等价由 §10 ACC-IMPL-002/
  003 注入测试关闭。
- `EVD-IMPL-003` — `OBS-IMPL-002`、`OBS-IMPL-003` → SUPPORTS `CLM-IMPL-003`。
  强度：SCHEDULER_TIMEOUT_OUTCOME_V2（accepted，已实现）的 seam 契约与
  invoker 源码。局限：envelope 保持的行为证明属 §10 ACC-IMPL-005。
- `EVD-IMPL-004` — `OBS-IMPL-006`、`OBS-IMPL-012` → SUPPORTS `CLM-IMPL-004`。
  强度：generation/slot 状态机 + teardown 路径源码。局限：机制推断，
  非 spawn/teardown 动态演示（属 ACC-IMPL-004）。

## 8. Decisions

- `DEC-IMPL-001` — authority 形态 = **child implementation-authorizing Spec，
  supersedes = []**。不加改父 Spec `implementation_authority`（父 Spec 冻结
  了独立 authority 形式，DEC-012；且实现轮不得修改 governing Spec）。
  决策人：repository owner（任务指令 2026-08-26）。替代方案 ALT-IMPL-001。
- `DEC-IMPL-002` — implementation base = **最新 main，必须已含 Scheduler V2**
  （≥ `7ab2e6d`；PR #71 已在）。理由：第三入口语义已被 V2 重塑
  （requestId/sessionId/onStart/started/outcome_unknown），在旧 base 上实现
  会锚定过期 seam。授权 gate：本 Spec accepted 且存在于 base。
- `DEC-IMPL-003` — 冻结实现范围 = **恰好 F-1..F-10**（§1 表），逐项绑定父
  Spec ruling，本 Spec 不新增任何政策语义；范围外触碰 = out-of-spec。
- `DEC-IMPL-004` — **Q-4 冻结（本 authority 的核心新增决策；父 Spec Q-4
  显式委托）**：`ROUTE_RECONCILIATION = REUSE_ONLY_IF_ROUTE_IDENTITY_MATCHES`。
  每个 route attempt：现存 READY process **仅当**其 resolved route 身份
  （provider/model/plugin/pluginVersion/providerEnv canonical form）等于本
  attempt 的 snapshot route 时才可复用；不匹配 ⇒ 永不复用，为该 attempt
  spawn 新 generation（route 随 spawn opts 冻结，AgentProcess route 不可变
  语义保持）。被顶替的 mismatched idle process 通过**既有**受控 shutdown
  路径终止（与今日 process 替换同机制，bounded grace、teardown await
  real-exit）；**busy 的 mismatched process 永不强制 kill**——不复用、
  留待其自身 lifecycle 收敛。该规则同时满足「下一 turn 从 primary 重新
  开始、零跨 turn route 粘滞」（父 Spec CTR-007）与 per-turn
  ATTEMPTED_AT_MOST_ONCE（attempt 计数属 turn-local executor 状态，与
  process 复用正交：复用旧 process ≠ 重试旧 route）。
- `DEC-IMPL-005` — **explicit model 落地 = STRICT_CHAIN_MODE**：请求携带
  显式 model（如 scheduler `request.model`）时，chain executor 以 strict
  模式运行该 turn——**恰好一次 route attempt、零 hop**（父 Spec CTR-009
  「不套用 Agent chain（零 fallback）」的机械执行）。本 Spec **不授权**任何
  新的 model → routeCatalog 解析 seam（implementation base 上
  `request.model` 本就 opaque 且路由无效，OBS-IMPL-008；为其发明解析属
  新政策，须另立 authority）。strict 模式在 journal FINAL block 如实记录
  STRICT reason。
- `DEC-IMPL-006` — **journal 落点 = 既有结构化 audit/log 表面**（Router /
  production-runtime 现有非 surface 证据日志流，参照 `auditStaleSlot`
  模式）：每 attempt 一条结构化记录 + turn 终结一条 final block，字段 =
  父 Spec CTR-008 冻结集，redaction 边界不变。**不建新 persistent store**。
  覆盖范围：经统一 seam 的一切 attempt（含无 override Agent 的长度 1 直通，
  字段照记、ROUTE_CHAIN 长 1）——这不改变任何非目标 Agent 的 resolved
  route/env/网络路径（父 Spec CTR-012 隔离口径），只统一证据。
- `DEC-IMPL-007` — **deadline 语义 = 单一逻辑 turn 单一 deadline**：整条链
  共享入口给出的那一个 deadline（onIngress/deliver：Router per-turn
  deadline；invokeAgent：occurrence persisted execution deadline 的
  `timeoutMs` 余额）。**禁止 per-hop 预算刷新 / 链级 deadline 延展**——hop
  消耗同一余额；余额耗尽 ⇒ 该 attempt 归入 timeout-without-proven-
  termination ⇒ STOP_CHAIN（父 Spec CTR-005(2)）。链执行保持在 scheduler
  store lock 之外（V2 冻结：invocation/turn 在 lock 外）。
- `DEC-IMPL-008` — 生产面零授权：`production_apply_authority = none` 保持。
  实现完成 ≠ 配置激活；激活 = 父 Spec Q-2/Q-3 关闭后的独立部署轮
  （写 v2 文件 + controlled restart，走 runbook 与 production approval）。

## 9. Contracts

> 语义性 ruling 全部引用父 Spec Contract 原文（`AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V1#
> CTR-xxx`），此处只冻结**实现形态**。Contract ID 全局身份 =
> `AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_IMPL_V1#CTR-IMPL-xxx`。

- `CTR-IMPL-001`（v2 loader 实现范围）— 在
  `packages/production-runtime/src/model-overrides.js`（或其内聚拆分模块）
  实现父 Spec §2.1/§2.2 全部校验，逐条执行
  `AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V1#CTR-001/CTR-003/CTR-010`：
  version ≠ 2 fail-loud（含 v1 文件，无自动转换）；普通 parse 前全文件递归
  duplicate JSON key 扫描；routeRef 引用完整性；routeRef 重复与
  CANONICAL_ROUTE_IDENTITY 重复 fail-loud；链长 ≤ `MAX_CONFIGURED_ROUTES = 4`；
  providerEnv optional closed-object 四键校验（grammar/脱敏按 CTR-010 全文）；
  激活范围恰好 `{agt_cto-agent}`；startup 一次加载 + malformed fail-loud +
  controlled restart（无 watcher）。移除 v1 的 per-field 常量相等约束
  （OBS-IMPL-004 `:243-247` 形态）与「至多一条 override」约束；
  `CHATGPT_SUBSCRIPTION_V1` 中 harness/dsh-codex pin（dshVersion/dshCommit）
  保留为**配置无关**校验常量（CTR-IMPL-009），route tuple 值不再来自代码。
  无 override 文件 / 无该 Agent entry ⇒ 现状回落 global env route（字节等价）。
- `CTR-IMPL-002`（统一 route-attempt seam）— 新增**单一** chain executor
  模块（`packages/agent-router`，建议 `src/route-chain.js`），暴露两个
  变体：`runTurnWithRouteChain(agentId, {sessionId, message, opts, deadline})`
  （同步 turn：onIngress、scheduler invokeAgent）与
  `admitWithRouteChain(agentId, {requestId, sessionMode, message, cwd…})`
  （异步 admission：deliver）。三个入口 call site——
  `ingress-delivery.js`（onIngress `:86-87`、deliver `:223/:232`）与
  `scheduler-router/src/index.js`（`:128/:134`）——以调用该 seam 取代其直接的
  ensureRunning+turn/deliver 组合；**入口本地链逻辑 = FORBIDDEN**。
  scheduler-router 通过 Router 发布表面访问（同今日 `router.ensureRunning`
  的发布方式），不 import executor 内部。无 override Agent 走长度 1 直通，
  对外行为与今日字节等价（resolved route/env/网络路径零变化）。executor
  不得内嵌任何 per-Agent 路由顺序 / 路由 tuple 常量（F-10；父 Spec
  DEC-004）——顺序唯一来源是 turn-start immutable snapshot（父 Spec CTR-007）。
- `CTR-IMPL-003`（per-attempt 生命周期与 hop gate）— executor 对每个
  route attempt 依序执行：route-aware 复用 gate（DEC-IMPL-004）→（需要时）
  新 generation spawn → initialize → session create/resume → admission
  （turnQueue / inbox）。hop 判定**逐字执行**
  `AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V1#CTR-004`：route_i → route_i+1 仅当
  attempt i 同时满足 (a) PROVEN_NO_ADMISSION（按 attempt i 自身生命周期
  评估）与 (b) FAILURE_CLASS ∈ 封闭四类白名单
  {`spawn_failed_without_child`；`initialize provider-unavailable`；`session
  create/resume structured rejection`；`turnQueue not_admitted`}；语义锚
  AGENT_PROCESS_LIFECYCLE_HARDENING_V2，本层不重定义、不新增失败类
  （新类 = 默认禁止切换，STOP_CHAIN；分类修订走父 Spec amendment）。
  deliver 变体补充：`accepted: true`（inbox accept = prompt receipt 建立）
  之后的一切失败均在 admission 之后 ⇒ STOP_CHAIN 域，绝不 hop。
- `CTR-IMPL-004`（STOP_CHAIN 执行）— 逐字执行
  `AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V1#CTR-005` 九类封闭禁止集
  （`outcome_unknown` 任何来源；timeout without proven termination；
  receipt/watermark 已建立；partial output；tool started；transcript
  produced；admission 后 provider failure；side-effect uncertainty；unknown
  failure class）：任一成立 ⇒ `STOP_ROUTE_CHAIN = YES`、
  `NO_FURTHER_FALLBACK = YES`，turn 以 fail-loud / outcome_unknown 终结，
  无 replay。Scheduler 入口同时保持 C-001：不可证明的执行**绝不**折叠为
  ordinary error（outcome envelope `status: 'outcome_unknown'` + 原
  reconciliationHandle 透传）。
- `CTR-IMPL-005`（ONE_LOGICAL_TURN 与 envelope 保持）— 整条链对外一次
  逻辑 turn（父 Spec CTR-006 全文）：单一业务回复、单一用户 transcript、
  无重复 tool side effect、单次 external delivery、单 logical occurrence。
  Scheduler 侧附加冻结：**每 occurrence 恰好一个 outcome envelope**——
  chain 内部多 attempt 不产生额外 outcome、不改写 `requestId` admission
  幂等指纹（hop ≠ transport retry，OBS-IMPL-003 契约不变）、`started`
  语义按 envelope 口径（任一 attempt turn 已 dispatch ⇒ started: true）、
  delivery outcome 与 execution outcome 分离不重写（D-007 §11.4）。
  deadline 单一余额（DEC-IMPL-007）；链执行在 store lock 之外。
- `CTR-IMPL-006`（bounded per-attempt evidence）— 逐字执行
  `AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V1#CTR-008`：每 attempt 记录
  `ROUTE_CHAIN_ID / ATTEMPT_INDEX / ROUTE / FAILURE_CLASS / ADMISSION_PROVEN /
  ATTEMPT_OUTCOME`，turn 终结追加 `FINAL_ROUTE / FINAL_OUTCOME /
  TOTAL_ROUTE_ATTEMPTS`（strict 模式按 DEC-IMPL-005 记录 STRICT reason）；
  落点 = 既有结构化 audit/log 表面（DEC-IMPL-006），**无新 persistent
  store**；禁止记录 raw provider error / token / credential / Authorization /
  response body / prompt body（redaction 边界不变）。字段值必须真实。
- `CTR-IMPL-007`（Scheduler 继承）— 逐字执行
  `AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V1#CTR-009` / DEC-013：
  `SCHEDULER_JOB_ROUTE_POLICY = INHERIT_AGENT_CHAIN_ONLY`——未提供显式
  model 的 job 继承 Agent chain；job/request schema 禁止 `fallbacks` 字段
  （出现即 schema 拒绝，沿用现有 fail-loud 风格）；显式 model ⇒
  STRICT_CHAIN_MODE（DEC-IMPL-005，恰好一次 attempt、零 hop）；不发明
  model→route 解析。未来 job-specific chain 须另立 authority。
- `CTR-IMPL-008`（无硬编码顺序验证）— 实现满足父 Spec ACC-014 的结构
  要求：产品代码无 per-Agent 路由顺序 / 路由 tuple 常量（v1 常量锁定形态
  移除后不得以任何别名回归）；在 bound 与 catalog 内换序 / 增删 fallback
  仅改配置即可表达（controlled restart 后生效）。
- `CTR-IMPL-009`（pin / 隔离 / 边界 carry-forward）— 原样继承并执行：
  `AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V1#CTR-011`（resolved dsh-codex =
  0.2.3 exact、harness 0.1.0-rc.8 @ 514ab7b…；mismatch = fail-loud 且
  **不是** fallback 触发类——不在 CTR-004 白名单内，落入 STOP_CHAIN）；
  `#CTR-012`（fleet 隔离：非目标 Agent resolved route/env/网络路径零变化，
  v2 overrides 拒绝其他 agentId，launchd 全局 env 不动）；
  `#CTR-013(b)(c)(d)`（route 切换 = 新 process attempt；snapshot + journal
  落实；无 dynamic quota router / account pool / load balancing / raw
  provider error 文本解析——决策只允许稳定结构化失败类）；
  `#CTR-010/CTR-014`（credential / providerEnv 全部安全契约，含注入 seam、
  strip、target-only、Node 25.6.1 exact、rollback 语义——实现范围仅限 v2
  catalog 位置的字段校验与注入接线，语义零新增）。
- `CTR-IMPL-010`（实现 PR 义务）— 实现 PR 必须按 vendored
  SPEC_GOVERNANCE_V0 §10 记录：
  `PRIMARY_GOVERNING_SPEC = AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_IMPL_V1`、
  `RELATED_ACCEPTED_AUTHORITIES`（父 Spec + V2 lifecycle + Scheduler V2）、
  `IMPLEMENTATION_BASE_COMMIT`、`GOVERNING_SPEC_COMMIT_OR_BLOB`、
  `SPEC_PRESENT_IN_BASE = YES`、`SPEC_STATUS_IN_BASE = accepted`、
  `IMPLEMENTATION_COMMIT`；实现不得修改本 Spec 与父 Spec 的 normative
  meaning；实现后输出 `SPEC_COMPLIANCE`（`.agents/templates/`）。Contract
  缺口 ⇒ stop → report → 独立 docs-only 变更 → 重启实现（governance §10）。

## 10. Acceptance（实现轮验收框架；本轮不执行）

父 Spec §10 ACC-001..ACC-015 全部原样适用（其授权的验收框架由本 Spec
激活为可执行项），另增补以下实现轮绑定项：

| # | 项 | 覆盖 |
|---|---|---|
| ACC-IMPL-001 | 三入口统一结构证明：三个入口 call site 均调用唯一 chain executor；grep/结构审查无入口本地链逻辑；无 override Agent 经 seam 直通且行为与 base 字节等价 | CTR-IMPL-002 |
| ACC-IMPL-002 | deliver 变体：admission 失败四类注入 ⇒ hop；`accepted: true` 后注入失败 ⇒ STOP_CHAIN、零 hop、无 replay | CTR-IMPL-003 |
| ACC-IMPL-003 | Scheduler V2 envelope 保持：多 attempt 链对外恰好一个 outcome envelope；outcome_unknown passthrough（C-001）；`started` 口径正确；requestId 指纹不因 hop 改变；chain 在 store lock 外（结构审查） | CTR-IMPL-005 |
| ACC-IMPL-004 | Q-4 reconciliation 注入：READY process route 匹配 ⇒ 复用（零新 generation）；不匹配 ⇒ 新 generation spawn 且 mismatched idle process 走既有受控 shutdown；busy mismatched 不被 kill、仅不复用；下一 turn 从 primary 开始、零粘滞 | DEC-IMPL-004 |
| ACC-IMPL-005 | strict 模式：request.model 显式 ⇒ 恰一次 attempt、零 hop、journal 记录 STRICT reason；无新 model→route 解析路径（结构审查） | DEC-IMPL-005 |
| ACC-IMPL-006 | deadline 单余额：注入 route[0] 白名单失败 + 余额不足 ⇒ 不 hop，按 timeout-without-proven-termination 归入 STOP_CHAIN；无任何 per-hop 预算刷新代码路径 | DEC-IMPL-007 |
| ACC-IMPL-007 | journal 落点：每 attempt 六字段 + final 三字段经既有 audit/log 表面结构化输出；无新 persistent store；全量日志 redaction 扫描（父 ACC-008 同口径） | CTR-IMPL-006 |
| ACC-IMPL-008 | pin 与隔离回归：resolved dsh-codex/harness pin fail-loud 且不触发 hop（父 ACC-011 同口径）；非目标 Agent 直通行为零变化 | CTR-IMPL-009 |

（真实 OAuth、真实 Luna 网络回退、真实手机飞书端到端演练 = controlled live
acceptance，仍须父 Spec Q-2/Q-3 关闭后另行安排；与父 Spec §10 尾注一致，
本 Spec 不将其冻结为立即可执行项。）

## 11. Alternatives and disposition

- `ALT-IMPL-001` — 直接 amend 父 Spec 把 `implementation_authority: none →
  contracts`：**REJECTED**——父 Spec DEC-012/CTR-013 冻结了「独立
  implementation-authorizing authority」形式，且实现轮不得修改自己的
  governing Spec（governance / standing order 7）。
- `ALT-IMPL-002` — 本 Spec 一并授权生产配置写入与激活：**REJECTED**——
  Q-2/Q-3 未关闭（CLM-IMPL-005 owned risk）；任务指令明确 DOCS ONLY、
  不配置 Credential、不部署；`production_apply_authority = none`。
- `ALT-IMPL-003` — 三入口各自实现链逻辑（仅共享工具函数）：**REJECTED /
  FORBIDDEN**——父 Spec CTR-013(a) 与任务冻结项 F-4 要求统一 seam；
  分叉实现必然产生入口间政策漂移。
- `ALT-IMPL-004` — 在 Scheduler 或 DSH model-call 层编排链：**REJECTED**——
  父 Spec ALT-007 已拒绝 model-call 层；Scheduler 层编排破坏
  INHERIT_AGENT_CHAIN_ONLY 与三入口统一（链政策属 Router admission 层）。
- `ALT-IMPL-005` — Q-4 留给实现 PR 自行决定：**REJECTED**——父 Spec Q-4
  明确「由 implementation-authorizing authority 在 CTR-007 政策内冻结」；
  留白即授权缺口（governance §5.7 / §10 gap 流程）。
- `ALT-IMPL-006` — 新建 journal 专用 durable store：**REJECTED**——
  父 Spec CTR-008 只要求 durable 非 surface 证据记录；既有 audit/log 表面
  足够；新 persistent state 需另行 authority（对齐「明确禁止建设」精神）。
- `ALT-IMPL-007` — per-hop deadline 刷新（每 route attempt 重置超时余额）：
  **REJECTED**——突破入口单一 deadline 语义（Router per-turn / Scheduler
  C-025 occurrence deadline），延长 wall-clock 爆炸半径；父 Spec 未授权
  任何 deadline 延展。
- `ALT-IMPL-008` — 为 `request.model` 发明显式 route 解析：**REJECTED**——
  implementation base 上该字段 opaque（OBS-IMPL-008；seams.js「not proven by
  D-007」）；解析语义属新政策，须另立 authority（父 Spec CTR-009 只要求
  strict）。

## 12. Migration, compatibility, and rollback

- `MIG-IMPL-001` — 代码先行、配置后行：实现合并后链代码 **inert**
  （生产 root 无 v2 文件 ⇒ 所有 Agent 直通现状 global env route，
  OBS-IMPL-010）。激活 = Q-2/Q-3 关闭后的独立部署轮：写 v2 文件 +
  controlled restart（父 Spec §2.2 静态配置语义）。
- `MIG-IMPL-002` — v1 → v2：无自动转换（父 Spec MIG-004）；旧 root v1
  legacy 文件与生产无关；生产无存量迁移面。
- `MIG-IMPL-003` — Scheduler V2 兼容：occurrence store / job model / CLI
  零 schema 变化；唯一接线点 = invoker 调用 Router 发布 seam 表面。
- `ROLLBACK-IMPL` — 代码回滚 = revert 实现 PR（链代码自成模块 + 三 call
  site 接线，回滚面有界）；配置回滚 = 移除 override + controlled restart
  （回落 global env route，父 Spec ROLLBACK 同义）。两者均不触碰 credential、
  launchd、其他 Agent、Scheduler store。DSH 版本不回滚。

## 13. Open questions

Not applicable（无阻塞实现授权的 open question）。父 Spec Q-2/Q-3 保持
开放但只 gate 配置激活（CLM-IMPL-005 已 owned），不属本 Spec 待决项；
父 Spec Q-1 已由 acceptance 冻结（MAX_CONFIGURED_ROUTES = 4）；父 Spec
Q-4 由本 Spec DEC-IMPL-004 关闭。

## 14. Final Output（authoring 轮填写）

```text
TASK_NAME = 链路 授权执行
TASK_STATUS = AUTHORING_COMPLETE（proposed；READY_FOR_INDEPENDENT_REVIEW）

SPEC_ID = AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_IMPL_V1
AUTHORITY_FORM = MINIMAL_IMPLEMENTATION_AUTHORIZING_CHILD_SPEC
PARENT_POLICY_AUTHORITY = AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V1（accepted @ main 7ab2e6d）
SUPERSEDES = []（child authority；不改父 Spec 任何语义）
AUTHORIZATION_GATE = 本 Spec accepted AND 存在于 implementation base（≥ 7ab2e6d，含 Scheduler V2）

FROZEN_IMPLEMENTATION_SCOPE =
  F-1  agent-model-overrides.json version 2 loader
  F-2  routeCatalog + primary + fallbacks[]
  F-3  MAX_CONFIGURED_ROUTES = 4（父 Spec Q-1 OWNER_DECISION 已冻结）
  F-4  三入口共用统一 route-attempt seam（onIngress / deliver / invokeAgent）
  F-5  proven-no-admission 才进入下一 Route（父 CTR-004 四类白名单逐字执行）
  F-6  STOP_CHAIN 封闭禁止集（父 CTR-005 逐字执行）
  F-7  ONE_LOGICAL_TURN（父 CTR-006 逐字执行 + Scheduler V2 envelope 保持）
  F-8  per-attempt bounded evidence journal（父 CTR-008 逐字执行；既有 audit 表面）
  F-9  Scheduler 只能继承 Agent chain（父 DEC-013/CTR-009 逐字执行）
  F-10 不写死 GLM/Luna 顺序（父 DEC-004 逐字执行）

NEW_IMPL_ROUND_BINDINGS =
  DEC-IMPL-004 Q-4 = REUSE_ONLY_IF_ROUTE_IDENTITY_MATCHES（不匹配 ⇒ 新
    generation；mismatched idle ⇒ 既有受控 shutdown；busy 不 kill 仅不复用）
  DEC-IMPL-005 request.model ⇒ STRICT_CHAIN_MODE（恰一次 attempt、零 hop；
    不发明 model→route 解析）
  DEC-IMPL-006 journal 落点 = 既有结构化 audit/log 表面；无新 persistent store
  DEC-IMPL-007 单一逻辑 turn 单一 deadline 余额；禁止 per-hop 刷新
  DEC-IMPL-002 implementation base = 最新 main（≥ 7ab2e6d，含 Scheduler V2）

implementation_authority = contracts（生效于本 Spec accepted 且进入 base 后）
production_apply_authority = none（Q-2/Q-3 只 gate 配置激活，保持开放）

PRODUCT_CODE_CHANGE = NONE
CREDENTIAL_CHANGE = NONE
PRODUCTION_CHANGE = NONE
DEPLOYMENT = NONE
MERGE = NO
PR60_LIFECYCLE_MUTATION = NONE

NEXT_TASK = 链路 授权审计
```

---

## 15. Final Output — Acceptance finalize（2026-08-26；链路 授权采纳执行轮填写）

```text
TASK_NAME = 链路 授权采纳执行
TASK_STATUS = ACCEPTANCE_TRANSACTION_COMPLETE（lifecycle-only）

SPEC_ID = AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_IMPL_V1
accepted_reviewed_head = a3f787e673276942371bd0b5d8bb5b94d1302595
accepted_by = mayf3
review_verdict = PASS
review_blocker_count = 0
READY_FOR_ACCEPTANCE = YES（链路 授权审计轮结论）

TRANSACTION（lifecycle-only，单 docs-only commit，normative body 零改动）：
  status = proposed -> accepted（provenance 仅 frontmatter + header 段落 + 本节）
  implementation_authority = contracts（保持；按本 Spec 自身 gate 生效：
    accepted AND 存在于含 Scheduler V2 的 implementation base——
    per SPEC_GOVERNANCE_V0 §2.1，merge into main 前不是 active authority）
  production_apply_authority = none（保持）

PRE_ACCEPTANCE_HEAD = 786e7acfe2c5d90408f057e4294090d4804dbf8c
  （acceptance commit 前的分支 head：普通 merge current main
    a1347c20d84490f4a99eb9a27ba3bd3e71d552c5 进入分支——no rebase /
    no squash / no force-push；merge 仅带入 .agents/structure-registry.json
    机械清理，与两份 docs 文件零冲突；PR #74 head 漂移核对 = NONE，
    fresh-fetch 后 head 恰为 accepted_reviewed_head）

SEMANTIC_CHANGE_FROM_REVIEWED_HEAD = NONE（§1–§14 历史正文逐字保留）

VALIDATION（merge 后 tree 实测执行）：git diff --check PASS；
  python3 .agents/tools/verify_governance.py --target . PASS；
  npm run verify:structure exit 0（零 error；WARNING 均为 base 预存）

PR_LIFECYCLE = PR #74 CLOSED -> reopened -> 保持 OPEN（MERGE = NO；
  merge 决策不在本轮授权内）

PRODUCT_CODE_CHANGE = NONE
CREDENTIAL_CHANGE = NONE
PRODUCTION_CHANGE = NONE
DEPLOYMENT = NONE
MERGE = NO

NEXT_TASK = 链路 授权采纳审计
```
