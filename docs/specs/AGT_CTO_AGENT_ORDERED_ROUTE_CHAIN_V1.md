---
spec_id: AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V1
status: proposed
date: 2026-08-25
type: implementation-spec (SPEC ONLY — 本轮只冻结授权边界与配置 schema；不实现、不配置、不部署)
spec_kind: implementation
authority_level: governing_spec
implementation_authority: none
production_apply_authority: none
replaces_on_acceptance: AGT_CTO_AGENT_GLM53_PRIMARY_LUNA_FALLBACK_V1
supersedes: []
superseded_by: null
scope:
  - agt_cto-agent 的 model-route 政策：ordered configurable route chain（PR #60 accepted-candidate AGT_CTO_AGENT_GLM53_PRIMARY_LUNA_FALLBACK_V1 的 whole-authority replacement；该 candidate 未入 main 且不得合入）
  - agent-model-overrides.json version 2 配置 schema：routeCatalog + overrides.<agentId>.model.primary / fallbacks[]
  - ROUTE_ORDER_HARDCODED_IN_CODE = FORBIDDEN：路由顺序的唯一 authority = deployment-owned 配置文件
  - per-hop 安全转换规则（proven-no-admission 封闭白名单 + STOP_CHAIN 封闭禁止集）
  - turn-start immutable snapshot、turn-local fallback、ONE_LOGICAL_TURN 外部语义
  - 逐 attempt loud evidence journal 与 redaction 边界
governed_by:
  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0
external_authorities: []
owners:
  - repository-maintainers
references:
  - docs/specs/AGT_CTO_AGENT_GLM53_PRIMARY_LUNA_FALLBACK_V1.md（PR #60 分支 accepted candidate、未入 main；本 Spec 的 whole-authority replacement 对象；其自身已 supersede AGENT_CORE_CHATGPT_SUBSCRIPTION_PROVIDER_V1）
  - docs/specs/AGENT_CORE_CHATGPT_SUBSCRIPTION_PROVIDER_V1.md（本 lineage 内已 superseded 的历史 authority；其 Amendment 2 A2.1 harness pin 由本 Spec carry forward）
  - docs/specs/AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0.md（accepted；当前 development-governance authority；vendored SPEC_GOVERNANCE_V0.md §8/§9 为本 Spec 治理形式依据）
  - docs/specs/AGENT_CORE_CHATGPT_SUBSCRIPTION_TARGET_PROXY_SEAM_V1.md（accepted；独立 seam authority——providerEnv 四键 allowlist；本 Spec 不 supersede，acceptance 时仅 metadata repoint）
  - docs/specs/AGENT_PROCESS_LIFECYCLE_HARDENING_V2.md（accepted；spawn/admission/turn 状态与 outcome_unknown 语义 authority）
  - docs/investigations/LUNA_DSH_RC8_VERSION_ALIGNMENT_V1.md（accepted-on-main investigation；rc.8 + dsh-codex@0.2.3 session create/resume 证据）
---

# AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V1 — CTO Agent 有序可配置路由链（ordered configurable route chain）

> SPEC_STATUS = **proposed**（authoring round 2026-08-25；READY_FOR_INDEPENDENT_REVIEW）。
> 本文件是 **docs-only whole-authority replacement Spec**：按 vendored
> SPEC_GOVERNANCE_V0.md §9.2，以整权威取代 PR #60 分支上的 accepted candidate
> `AGT_CTO_AGENT_GLM53_PRIMARY_LUNA_FALLBACK_V1`（其 normative core
> MAX_FALLBACK_ROUTE_ATTEMPTS = 1 / 单一 fallback 与 Owner 2026-08-25 裁决冲突；
> 该 candidate 未入 main，且本 Spec 冻结：**PR #60 不得进入 main**，见 §3.4/§12）。
>
> 本轮（authoring round）不实现、不配置、不部署：不改任何 packages/ 代码，
> 不写 agent-model-overrides.json，不执行 OAuth，不复制任何 credential，
> 不发送 Feishu 消息，不重启任何进程，不 merge。
> `implementation_authority = none`、`production_apply_authority = none`。
> 实现须由独立 implementation-authorizing authority 在本 Spec accepted 且进入
> implementation base 后另行授予（governance §10）。

---

## 1. Goal

为唯一目标 Agent `agt_cto-agent` 冻结新的 model-route 政策：**ordered
configurable route chain**。

Owner 裁决（2026-08-25，冻结）：

```text
ORDERED_CONFIGURABLE_ROUTE_CHAIN = REQUIRED
SINGLE_FALLBACK_ONLY             = REJECTED
ROUTE_ORDER_HARDCODED_IN_CODE    = FORBIDDEN

PRIMARY_ROUTE_FIRST              = YES
MULTIPLE_SEQUENTIAL_FALLBACKS    = ALLOWED
FALLBACKS_EMPTY_MEANS_STRICT     = YES
```

核心原则：**模型路由顺序来自 deployment-owned
`agent-model-overrides.json`，不来自产品代码常量。** 配置模型参照 OpenClaw 的
`model.primary` / `model.fallbacks[]` 形态，适配 Agent Core route descriptor
（§2 冻结 version 2 schema 建议）。

方向性变更（对比被替换 candidate）：candidate 冻结「zai/glm-5.3 主路由 +
单一、有界 Luna 回退（MAX_FALLBACK_ROUTE_ATTEMPTS = 1）」；本 Spec 冻结
「route[0] = primary + 零或多个按序 fallback 的有限链，链内容与顺序由
deployment 配置拥有，代码不内嵌任何路由顺序」。这是 Direction 实质改变，
故走 SUPERSEDE（whole-authority replacement），不走 AMEND（DEC-001 / ALT-001）。
重开 candidate 已冻结方向（其 DEC-003/ALT-003 拒绝多级 chain）的
NEW_EVIDENCE = Owner 裁决 2026-08-25 本身（满足 `.agents/README.md`
standing order 5 的重开条件）。

## 2. Route chain 配置模型（agent-model-overrides.json version 2）

### 2.1 冻结 schema（建议形态，normative）

```jsonc
{
  "version": 2,
  "routeCatalog": {
    "<routeRef>": {
      "provider":            "<non-empty string>",
      "model":               "<non-empty string>",
      "plugin":              "<non-empty string>",
      "pluginVersion":       "<exact version pin string>",
      "credentialReadiness": "<readiness reference — 引用，绝不含 raw credential>",
      "providerEnv":         { /* optional；PROXY_SEAM_V1 四键 allowlist 契约原样适用 */ }
    }
  },
  "overrides": {
    "<agentId>": {
      "model": {
        "primary":   "<routeRef — 必须解析到 routeCatalog>",
        "fallbacks": ["<routeRef>", "..."]   // ordered；[] = strict（无回退）
      }
    }
  }
}
```

### 2.2 语义（冻结）

- `ROUTE_CHAIN` = `[primary] ∪ fallbacks` 按序拼接的 ordered non-empty 数组；
  `route[0]` = primary（总是第一个），`route[1..N]` = ordered fallbacks。
- `fallbacks = []` 表示 strict：链长 1，零回退。
- **route 去重**：同一 routeRef 在一条链内（primary ∪ fallbacks）重复出现 =
  malformed → startup fail-loud（ROUTE_CYCLE / RETURN_TO_PREVIOUS_ROUTE 的
  配置形态在源头即非法）。
- 引用完整性：`primary` / `fallbacks[]` 的每个 routeRef 必须存在于
  `routeCatalog`；未解析引用 = malformed → startup fail-loud。
- 每 route 至少包含：provider、model、plugin、pluginVersion、credential
  readiness reference、providerEnv reference（optional）。**raw credential /
  token / secret 绝不进入配置文件**（CTR-010）。
- 静态配置语义（承接 candidate CTR-006）：startup 一次性加载；malformed
  （schema 非法 / 字段缺失 / 引用未解析 / 重复 route / 超出 hard bound）→
  startup fail-loud，不得静默忽略或回退默认值；config change requires
  controlled restart（无热 reload、无文件 watcher）。
- version 必须 = 2；version ≠ 2（含 version 1 旧文件）→ fail-loud，由
  deployment 显式迁移（docs/runbook 层动作），产品代码不做自动转换、不做
  silent coercion。
- v1 loader 的两条约束由本 authority 取代：「至多一条 override」与
  「override 字段值必须逐字段等于代码常量 `CHATGPT_SUBSCRIPTION_V1`」
  （OBS-006；后者正是 ROUTE_ORDER_HARDCODED_IN_CODE = FORBIDDEN 要消除的
  形态）。v2 下 route 内容与顺序的全部 authority 在配置文件；产品代码只保留
  schema 校验与既有 launchd global env 兜底路由（无 override 时的
  resolved route），不内嵌任何 per-Agent 路由顺序或路由内容常量。
- **激活范围**：本 Spec authority 下 `overrides` 的合法 key 仍恰好为
  `{agt_cto-agent}`（承接 PROVIDER_V1/candidate 的 ENABLED_AGENTS = exactly 1
  与 fleet 隔离，CTR-012）；schema 形态 generic，向其他 Agent 扩展
  overrides 需另行 authority。

### 2.3 Hard bound（冻结存在性；具体数值 = Owner 决策项 Q-1）

```text
链长（1 + fallbacks.length）≤ MAX_CONFIGURED_ROUTES   （明确 hard bound，必须有）
MAX_CONFIGURED_ROUTES ≠ 2（不得写死为 2）
MAX_CONFIGURED_ROUTES > 1 + fallbacks.length 时以实际配置为准

派生（每 turn）：
MAX_ROUTE_ATTEMPTS     = ROUTE_CHAIN.length（≤ MAX_CONFIGURED_ROUTES）
MAX_FALLBACK_ATTEMPTS  = ROUTE_CHAIN.length - 1
```

建议值：`MAX_CONFIGURED_ROUTES = 4`（依据：Owner 裁决给出的最远期配置示例
primary + route-B + route-C + luna 恰为 4；既满足「不得写死为 2」，又保持
有限爆炸半径）。该数值在本 Spec acceptance 时由 Owner 批准冻结；此后变更
须走本 Spec 自身的 amendment（DEC-008 / Q-1）。

### 2.4 初始目标生产配置（policy target；本轮不写入）

```jsonc
{
  "version": 2,
  "routeCatalog": {
    "glm53": { "provider": "zai", "model": "glm-5.3", /* plugin/pluginVersion/
                credentialReadiness：由 Q-2 受控实测轮核实后冻结 */ },
    "luna":  { "provider": "openai-codex", "model": "gpt-5.6-luna",
               "plugin": "dsh-codex", "pluginVersion": "0.2.3", /* … */ }
  },
  "overrides": {
    "agt_cto-agent": { "model": { "primary": "glm53", "fallbacks": ["luna"] } }
  }
}
```

诚实边界（承接 candidate）：`LUNA_DIRECT_ROUTE_READY = NO`（OBS-004）——
在 Luna 就绪轮（Q-3）关闭前，上述配置**不得激活**；zai 路由的
plugin/pluginVersion/credential 注入状态在 authsvc runtime 下未核实（Q-2）。
本 Spec 冻结的是 schema 与政策 authority，不是「现在写这份文件」的授权。

authority 与 schema 必须允许未来 deployment 仅改配置即可表达（无需改代码、
无需新 authority 重新开 seam）：

```jsonc
"fallbacks": ["route-B", "route-C", "luna"]
```

（route-B/route-C 为示意；新 route 的 catalog entry 需其自身的 credential
readiness 与 plugin 事实，属部署/就绪事实，不是本 Spec 的发明。）

## 3. Authority and dependencies

### 3.1 Gate 确认（任务前置判定，冻结）

```text
GATE_QUESTION = AGT_CTO_AGENT_GLM53_PRIMARY_LUNA_FALLBACK_V1（PR #60 accepted
               candidate）是否仅覆盖 agt_cto-agent model-route 政策？
GATE_ANSWER   = YES

证据：
  a) candidate §2/§3 冻结 scope = agt_cto-agent 单 Agent primary/fallback 政策
     （whole-authority replacement of AGENT_CORE_CHATGPT_SUBSCRIPTION_PROVIDER_V1，
     其 §3.1 gate 已证明该权威域恰好且仅覆盖本 Agent）；
  b) candidate CTR-009 fleet 隔离：其余全部 Agent 零变化，不注册任何 fleet
     级机制；
  c) v1 loader 机制层面强制 overrides 至多 1 条且 agentId = agt_cto-agent
     （OBS-006），不可能覆盖第二个 Agent。

结论：whole-authority replacement 可行（无 fleet 级 authority 被丢弃）；
按 governance §9.2 以整权威取代，不做 partial supersede。
```

### 3.2 Related accepted authorities（不 supersede，如实登记）

| Authority | 关系 |
|---|---|
| `AGT_CTO_AGENT_GLM53_PRIMARY_LUNA_FALLBACK_V1`（**PR #60 分支 accepted candidate；未入 main；非 active authority**） | 本 Spec 的 replacement 对象。其 acceptance transaction（2026-08-24，reviewed head `1af5f1b`，blob `b3ca691`）已在 PR #60 分支执行，但按 SPEC_GOVERNANCE_V0 §8.2「accepted value on an unmerged PR branch is not yet active authority」，从未在 main 生效。其 normative body 本轮**一字不改**；处置见 §3.3/§3.4。 |
| `AGENT_CORE_CHATGPT_SUBSCRIPTION_TARGET_PROXY_SEAM_V1`（accepted） | Luna leg 的 providerEnv（四键 allowlist、target-only spawn 注入、fail-loud）seam authority。本 Spec 不修改、不 supersede；v2 catalog 的 `providerEnv` 字段沿用其契约。acceptance transaction 时其 `seam_baseline_repoint` metadata 由 candidate 改指本 Spec（metadata-only，normative body 一字不变；承接 candidate DEC-008/Q-1 裁决形态）。 |
| `AGENT_PROCESS_LIFECYCLE_HARDENING_V2`（accepted） | spawn/admission/turn 语义 authority：`spawn_failed_without_child`、initialize 失败、`not_admitted` envelope、prompt receipt watermark、`outcome_unknown` 均以其冻结语义为准。本 Spec 引用不重定义。 |
| `AGENT_CORE_HARDENING_PROGRAM_V1`（accepted） | hardening program 框架（本 Spec 不在其排程序列内，无冲突）。 |
| `DSH_PROVIDER_FALLBACK_CHAIN_V1`（proposed，未 merge，非 authority） | fleet 级 3-route chain 提案（DSH model-call 层）。层级不同（见 ALT-007）、scope 排除本 Agent、未 accept；本 Spec 不依赖它。 |

### 3.3 替换事务（未来原子 acceptance transaction，冻结形态）

```text
ACCEPTANCE_TRANSACTION（一次性 docs-only，在本 replacement lineage 内执行）：
  NEW.status = accepted
  NEW.supersedes = [ AGT_CTO_AGENT_GLM53_PRIMARY_LUNA_FALLBACK_V1 ]
  OLD(candidate).status = superseded
  OLD(candidate).superseded_by = AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V1
  （OLD 历史正文不删改，仅 lifecycle metadata + backlink；
    OLD 自身的 supersedes = [AGENT_CORE_CHATGPT_SUBSCRIPTION_PROVIDER_V1]
    保持不变——lineage 经传递归一：PROVIDER_V1 → candidate → NEW）

  PROXY_SEAM_V1 基准 repoint（metadata-only；承接 OWNER_DECISION_Q1 形态）：
    AGENT_CORE_CHATGPT_SUBSCRIPTION_TARGET_PROXY_SEAM_V1 保持独立 accepted
    authority（不 absorb、不 supersede、status 不变）；
    其 seam_baseline_repoint.to 由 AGT_CTO_AGENT_GLM53_PRIMARY_LUNA_FALLBACK_V1
    改指 AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V1；
    providerEnv 四键契约与 normative body 一字不变。

  README_INDEX = docs/specs/README.md：candidate 行 → superseded（historical，
    never reached main as current authority）；NEW 行 → accepted / current。
```

### 3.4 PR #60 处置（冻结）

```text
PR60_MUST_NOT_MERGE = YES（Owner 裁决 2026-08-25：「不得合入 PR #60 原有
  single-fallback authority」「旧 PR #60 不得进入 main」）
执行序列（冻结于 §12 MIG）：
  1. 本 replacement PR（含 candidate lineage + NEW spec）先行 review/acceptance，
     §3.3 事务在本分支内原子执行（candidate 在合入前已是 superseded）；
  2. replacement PR merge 前，PR #60 以 unmerged 状态关闭（superseded-by 指向
     本 PR；可 reopen，但不得以任何形态 merge）；
  3. main 因此只会收到：PROVIDER_V1（superseded）→ candidate（superseded，
     从未担任 current authority）→ NEW（accepted / current）。
不变量：candidate 的 single-fallback normative meaning 从未在 main 生效，
其进入 main（经本 replacement PR）时 lifecycle 已是 superseded。
```

## 4. Current State（只读核实；2026-08-25 复核）

- `STATE-001` — Production runtime root = `/Users/authsvc/.agent-core`
  （authsvc uid）；本 Agent 正式 DSH_HOME =
  `/Users/authsvc/.agent-core/homes/agt_cto-agent`。Basis: `OBS-003`。
- `STATE-002` — 当前全局 env route = `oc-go / deepseek-v4-flash`
  （launchd `ai.agent-core.runtime.plist`）；`agent-model-overrides.json`
  ABSENT → 本 Agent 当前有效路由 = 全局 env route，无任何 override、无链。
  Basis: `OBS-003`。
- `STATE-003` — 本 Spec 的 route[0]（zai/glm-5.3）是**目标政策**，不是当前
  现值；zai/glm-5.3 曾在旧 root（yanfenma）生产会话真实执行（2026-08-20
  21:58 → 2026-08-21 07:13，14 request/header），authsvc runtime 下未执行、
  catalog tuple 未核实。Basis: candidate STATE-003（继承，历史事实不变）。
- `STATE-004` — Luna 路由未就绪：新 Home 无 OAuth Credential、dsh-codex
  provisioning 未完成（2026-08-25 复核仍成立）。Basis: `OBS-004`。
- `STATE-005` — 旧 root Home 仍保留 OAuth credential（0600，2026-08-25
  复核存在；内容未读取）；本 Spec **不授权复制**。Basis: `OBS-005`。
- `STATE-006` — 代码现状：单 route 配置（v1 schema、≤1 override、字段值
  锁死代码常量）、无 ordered fallback seam、无 attempt journal、
  route 在 AgentProcess 内不可变、resolveProcessConfig 仅在 process
  boundary reload。Basis: `OBS-006`–`OBS-010`。
- `STATE-007` — authority 现状：origin/main（`b3a6d4f`）中
  `AGENT_CORE_CHATGPT_SUBSCRIPTION_PROVIDER_V1` 仍 accepted、candidate 文件
  不存在；candidate 仅存在于 PR #60 分支（head `78212c7`）。Basis: `OBS-002`。

## 5. Observations

- `OBS-001` — candidate 状态。PR #60 分支 head `78212c7`，
  `docs/specs/AGT_CTO_AGENT_GLM53_PRIMARY_LUNA_FALLBACK_V1.md` frontmatter
  `status: accepted`（accepted_reviewed_head `1af5f1b`；blob `b3ca691`；
  acceptance transaction 于 `8798b6e` 执行，2026-08-24）；PR #60 OPEN、
  未 merge。按 vendored SPEC_GOVERNANCE_V0 §8.2，该 accepted value 在
  unmerged PR branch 上**不是 active authority**。
- `OBS-002` — main 侧权威。`origin/main@b3a6d4f`：
  `AGENT_CORE_CHATGPT_SUBSCRIPTION_PROVIDER_V1` frontmatter `status: accepted`
  （含 Amendment 1/2）；`AGT_CTO_AGENT_GLM53_PRIMARY_LUNA_FALLBACK_V1.md`
  不存在于 main（`git cat-file -e` 确认 ABSENT）。
- `OBS-003` — 生产路由现值（只读，2026-08-25）。
  `/Library/LaunchDaemons/ai.agent-core.runtime.plist`：
  `DSH_AGENT_PROVIDER=oc-go` / `DSH_AGENT_MODEL=deepseek-v4-flash`；
  `ls /Users/authsvc/.agent-core/agent-model-overrides.json` = ENOENT。
- `OBS-004` — Luna 就绪反证（只读，2026-08-25）。authsvc Home
  `/Users/authsvc/.agent-core/homes/agt_cto-agent/`：无
  `.openai-codex-auth.json`；`profiles/node_modules` 无 dsh-codex entry。
- `OBS-005` — 旧 credential 仍在（只读，2026-08-25）。
  `/Users/yanfenma/.agent-core/homes/agt_cto-agent/.openai-codex-auth.json`
  存在，mode 0600，2092 bytes，mtime 2026-08-20。内容未读取。
- `OBS-006` — 单 route 配置 + 代码常量锁定。
  `packages/production-runtime/src/model-overrides.js:206`
  `loadAgentModelOverrides`：v1 schema 强制 `{"version":1,"overrides":{...}}`
  （:220-223）；「V1 allows at most one override」（:226）；agentId 必须
  registered 且 = `CHATGPT_SUBSCRIPTION_V1.targetAgentId`（:229-232）；
  override 的 provider/model/plugin/pluginVersion 必须**逐字段等于代码常量**
  `CHATGPT_SUBSCRIPTION_V1`（:243-247，常量定义 :11-19）。即：当前路由
  内容（更不用说顺序）的 authority 部分位于产品代码——正是
  ROUTE_ORDER_HARDCODED_IN_CODE = FORBIDDEN 要改变的形态。无 chain、无
  fallbacks 数组、无 routeCatalog。
- `OBS-007` — resolveProcessConfig 单路由、process boundary reload。
  `packages/production-runtime/src/compose.js:274`：每次调用重读
  overrides 文件并返回**单个** frozen `{provider, model, …}`；注释冻结
  「Router calls this only after it has established that no live process can
  be reused and immediately before provisioning/spawn … process-start
  configuration, never per-turn dynamic routing」。
- `OBS-008` — AgentProcess route 不可变。`packages/agent-router/src/
  process-registry.js:328`：startup 阶段一次性 `resolveProcessConfig(agentId)`；
  provider/model 作为 spawn opts 传入 `processFactory`（:352-357 一带）；
  活跃 process 无任何 re-resolve 路径。推论：**route 切换 = 新 process
  attempt（新 generation）**，链回退在机制上必须以新 process attempt 承载。
- `OBS-009` — 三个入口。`packages/agent-router/src/index.js:248`
  （`feishu.setCallback(ingressDelivery.onIngress)`）、`index.js:284`
  （`deliver: ingressDelivery.deliver`）、`packages/scheduler-router/src/
  index.js:95-104`（`invokeAgent(request)` → `router.ensureRunning`）。
  三者最终都汇入 process admission 路径；链政策必须对三入口统一生效
  （实现轮硬约束，CTR-013）。
- `OBS-010` — 无 attempt journal。在 packages/ 全量 grep
  `ROUTE_CHAIN_ID|ATTEMPT_INDEX|ROUTE_ATTEMPT|attemptJournal|route_attempt`
  = 零匹配（2026-08-25，@78212c7）。
- `OBS-011` — lifecycle 语义锚点（继承 candidate OBS-007，authority 未变）。
  `AGENT_PROCESS_LIFECYCLE_HARDENING_V2`（accepted）冻结：
  `spawn_failed_without_child` = child 从未创建成功的唯一 terminal 证据类；
  initialize 失败 = startup bounded reject；`not_admitted` envelope
  （validation/capacity fail 或 proven pre-send zero-byte rejection）；
  prompt receipt watermark 在 prompt write 前建立；无法证明 admission
  假象时必须 `outcome_unknown`。
- `OBS-012` — session 跨 provider resume（继承 candidate OBS-006，历史生产
  证据不变）。旧 root main session 同一 session 文件内三个 provider 分布：
  `oc-go ×141`、`openai-codex/gpt-5.6-luna ×21`、`zai/glm-5.3 ×14`；
  accepted investigation `LUNA_DSH_RC8_VERSION_ALIGNMENT_V1` 证明
  dsh-codex@0.2.3 session create/resume 机制。边界：只证明 resume 机制与
  连续性，**不构成 Luna credential 就绪证据**（OBS-004 反证）。
- `OBS-013` — scheduler 请求可携带显式 model。
  `packages/scheduler/src/seams.js:6` seam 契约：
  `invokeAgent({agentId, sessionId, message, model?, lightContext?, …})` —
  显式 model 选择入口已存在（为 CTR-009 的 explicit-override-strict 提供
  机制锚点）。

## 6. Claims and assumptions

- `CLM-001`（SUPPORTED）— candidate 的 authority 覆盖恰好且仅
  agt_cto-agent model-route 政策，whole-authority replacement 不丢弃任何
  fleet 级 authority。Basis: `EVD-001`。
- `CLM-002`（SUPPORTED）— 四类 admission-preceding 失败白名单在链上
  **每一跳**均适用，前提是 gate 按逐 attempt 评估：每一跳都是一次全新的
  process attempt，完整重放 spawn → initialize → session create/resume →
  turnQueue admission 生命周期，因此四类失败在任一跳上都发生在该 attempt
  的 prompt admission 之前；且由归纳（每前一跳均通过同一 gate）链上不存在
  任何已建立的 receipt/watermark、partial output、tool side effect 或
  transcript 条目。Basis: `EVD-002`。
- `CLM-003`（SUPPORTED）— 当前实现无链 seam：单 route 配置、route 不可变、
  无 journal、三入口未统一；实现轮需要新增 config schema、per-turn snapshot、
  attempt 编排与 journal、process-attempt 切换——全部属未来
  implementation-authorizing authority 的范围。Basis: `EVD-003`。
- `CLM-004`（SUPPORTED）— Luna 路由当前不可激活（新 Home 无 credential、
  无 plugin）。Basis: `EVD-004`。
- `CLM-005`（OPEN_ASSUMPTION）— zai/glm-5.3 在 authsvc runtime 下可执行且
  其 catalog tuple（plugin/pluginVersion/credential 注入）可核实（继承
  candidate CLM-004）。由 Q-2 受控实测轮关闭，不阻塞本 Spec 政策冻结。
- `CLM-006`（INFERRED）— turn-local fallback + turn-start snapshot 与
  PREBOUND process 复用模型兼容：跨 provider session resume 已被证明
  （OBS-012），下一 turn 从 primary 开始的 process reconciliation
  （活着的 fallback-route process 如何处置）可在实现轮于本 Spec 冻结政策
  内解决（记为实现轮开放缝，非 Owner 决策）。

## 7. Evidence relations

- `EVD-001` — `OBS-001`、`OBS-002` + candidate §3.1 gate → SUPPORTS
  `CLM-001` / §3.1 Gate。强度：accepted-spec 正文 + loader 源码约束。
  局限：无。
- `EVD-002` — `OBS-008`、`OBS-011` → SUPPORTS `CLM-002`。强度：accepted
  lifecycle authority 语义 + registry 源码（每 attempt 新 generation）。
  局限：机制证明，非注入测试（属未来实现轮 ACC）。
- `EVD-003` — `OBS-006`、`OBS-007`、`OBS-008`、`OBS-009`、`OBS-010` →
  SUPPORTS `CLM-003`。强度：源码逐点核实（file:line）。局限：静态审查，
  无运行动态。
- `EVD-004` — `OBS-004`、`OBS-005` → SUPPORTS `CLM-004`。强度：直接文件
  系统观测。局限：未读取任何 credential 内容。

## 8. Decisions

- `DEC-001` — AUTHORITY_CHANGE_FORM = **SUPERSEDE（新 whole-authority
  replacement Spec）**，不走 AMEND、不做 accepted-candidate withdrawal。
  决策人：repository owner（任务指令 2026-08-25，二选一中选取）。理由：
  (a) vendored SPEC_GOVERNANCE_V0 §9.1：AMEND 仅限 proposed 阶段自由修改 /
  editorial-only / strictly-additive——candidate 已 accepted 且本变更为方向
  反转（单一回退 → 有序链），不满足任一条件；(b) 协议 lifecycle
  （§8：proposed | accepted | superseded）**不存在 accepted → proposed 的
  撤回转换**，forward-only（AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0
  DEC-ADOPT-004 同向），withdrawal 无治理依据且会使已绑定的 review/
  acceptance 记录失真；(c) §9.2 whole-authority SUPERSEDE 是协议内最清晰、
  可审计的合法形式。替代方案见 ALT-001/ALT-002。
- `DEC-002` — PRIMARY_ROUTE_FIRST = YES：route[0] 恒为 primary = 初始目标
  配置 `zai / glm-5.3`；primary 成功 ⇒ 零 fallback 活动（CTR-002）。
- `DEC-003` — ordered chain 模型冻结（§2）：ROUTE_CHAIN = [primary] ∪
  fallbacks ordered；fallbacks=[] = strict；route 去重；每 route 每 turn
  ATTEMPTED_AT_MOST_ONCE；禁止 ROUTE_CYCLE / RETURN_TO_PREVIOUS_ROUTE /
  CHAIN_RESTART / UNBOUNDED_ATTEMPTS；MAX_ROUTE_ATTEMPTS = 链长；
  MAX_FALLBACK_ATTEMPTS = 链长 − 1。
- `DEC-004` — ROUTE_ORDER_HARDCODED_IN_CODE = FORBIDDEN：路由顺序（与
  per-Agent 路由内容）的唯一 authority = deployment-owned
  agent-model-overrides.json（v2）；产品代码不得内嵌 per-Agent 路由顺序或
  路由 tuple 常量（v1 的 `CHATGPT_SUBSCRIPTION_V1` 值锁定约束由本 Spec
  取代；代码中保留的只有 schema 校验与无 override 时的 global env 兜底）。
  配置模型参照 OpenClaw `model.primary`/`model.fallbacks[]` 形态。
- `DEC-005` — per-hop fallback gate = PROVEN_NO_ADMISSION + 封闭白名单
  （CTR-004，四类经逐跳重审适用，CLM-002）；STOP_CHAIN 禁止集冻结
  （CTR-005）。语义锚定 AGENT_PROCESS_LIFECYCLE_HARDENING_V2，不重定义。
- `DEC-006` — ONE_LOGICAL_TURN 外部语义（CTR-006）：整条链对外一次逻辑
  turn——单业务回复、单用户 transcript、无重复 tool side effect、单次
  external delivery、单 logical occurrence；每次 route 切换前必须证明前一
  attempt 无 admission。
- `DEC-007` — turn-start immutable snapshot + turn-local fallback（CTR-007）：
  turn 开始时对 deployment 配置形成 immutable chain snapshot；fallback
  进度是 turn-local 状态；下一 turn 一律从 primary 重新开始（显式
  override 除外，CTR-009）。活 process 与新 turn primary 的 reconciliation
  是实现轮缝（CLM-006），政策不变。
- `DEC-008` — hard bound 冻结存在性、数值待 Owner：MAX_CONFIGURED_ROUTES
  必须明确、不得 = 2；建议 4（Owner 示例链长；acceptance 时批准）。
  Owner 决策项 Q-1。
- `DEC-009` — Luna 成员资格 + 不发明 provider：初始目标配置 = zai primary +
  Luna 唯一 fallback（`openai-codex/gpt-5.6-luna` @ `dsh-codex@0.2.3`
  exact pin）；authority/schema 允许未来仅改配置加入 route-B/route-C 等
  新 catalog entry（其 readiness 事实另行核实），本 Spec 不发明任何具体
  第三/第四 provider 的 tuple。
- `DEC-010` — credential 边界（承接 candidate CTR-008，泛化到每 route）：
  raw credential 绝不进配置；per-route credentialReadiness 引用；Luna 就绪
  = 独立轮（provisioning + operator 交互式 OAuth、0600/0700）；禁止复制旧
  root secret；禁止 `~/.codex/auth.json` 读写；禁止 OPENAI_API_KEY 路径。
- `DEC-011` — carry-forward（自 candidate 权威域吸收，语义不变）：DSH
  harness pin `0.1.0-rc.8 @ 514ab7b…`（实现轮不得静默升级；mismatch =
  fail-loud，**不是** fallback 触发类）；dsh-codex@0.2.3 exact pin；
  SILENT_FALLBACK = FORBIDDEN（泛化为逐 attempt journal，CTR-008）；静态
  配置语义；fleet 隔离；PROXY_SEAM_V1 独立 authority + metadata-only repoint；
  session 跨 provider resume 诚实边界（机制证明 ≠ credential 就绪）；
  DSH model-call 层排除（ALT-007）。
- `DEC-012` — 本轮 zero implementation：implementation_authority = none；
  实现须由独立 implementation-authorizing authority 在本 Spec accepted 且
  进入 implementation base 后授予，且必须统一三入口（OBS-009）。

## 9. Contracts

- `CTR-001`（ROUTE_CHAIN 配置模型）— 链由 deployment-owned
  `agent-model-overrides.json` **version 2** 承载（§2.1 schema）：
  routeCatalog（routeRef → provider/model/plugin/pluginVersion/
  credentialReadiness/providerEnv?）+ overrides.`<agentId>`.model.primary
  （routeRef）+ .fallbacks（ordered routeRef array）。校验规则：exact schema；
  引用必须解析；链内 routeRef 去重；链长 ≤ MAX_CONFIGURED_ROUTES；
  version ≠ 2 fail-loud；激活范围 = 恰好 `{agt_cto-agent}`。malformed 家族
  一律 startup fail-loud；config change requires controlled restart。
- `CTR-002`（PRIMARY_ROUTE_FIRST）— route[0] = primary（初始目标 =
  zai/glm-5.3）。primary attempt 成功 ⇒ 该 turn 零 fallback 活动（零额外
  route attempt、零 Luna/其他 route 网络调用）。primary 失败且不满足
  CTR-004 gate = 结构化 fail-loud，带 FAILURE_CLASS。
- `CTR-003`（有序遍历与终止）— attempt 顺序严格为 route[0] → route[1] →
  … → route[N-1]（数组序）。每个 configured route 每 turn
  **ATTEMPTED_AT_MOST_ONCE**。绝对禁止：ROUTE_CYCLE、
  RETURN_TO_PREVIOUS_ROUTE、CHAIN_RESTART、UNBOUNDED_ATTEMPTS。链内任一
  attempt 成功 ⇒ 链终止于该 route；最后 route 失败 ⇒ 该 turn fail-loud
  终结（FINAL_OUTCOME 携带最后失败类）。派生上界：
  MAX_ROUTE_ATTEMPTS = 链长 ≤ MAX_CONFIGURED_ROUTES（≠2，Q-1 待批）；
  MAX_FALLBACK_ATTEMPTS = 链长 − 1。
- `CTR-004`（per-hop 安全转换 gate，封闭白名单）— route_i → route_i+1 仅当
  **同时**满足：(a) attempt i 的 prompt admission 被证明为假
  （PROVEN_NO_ADMISSION，按 attempt i 自身生命周期评估）；(b) attempt i 的
  FAILURE_CLASS 属于封闭四类（语义锚定 V2，经逐跳重审适用——CLM-002/
  EVD-002）：
  1. `spawn_failed_without_child`；
  2. `initialize provider-unavailable`（process 未达 READY，未发生任何
     prompt admission）；
  3. `session create/resume structured rejection`（structured、机器可分类；
     非 timeout、非 unknown）；
  4. `turnQueue not_admitted`（V2 not_admitted envelope：validation/capacity
     fail 或 proven pre-send zero-byte rejection）。
  白名单与禁止集之外的新失败类 = 默认禁止切换，分类修订须走本 Spec
  amendment。
- `CTR-005`（STOP_CHAIN 禁止集，封闭）— 以下任一情形成立：
  **STOP_ROUTE_CHAIN = YES；NO_FURTHER_FALLBACK = YES**（存在即该 turn
  fail-loud / outcome_unknown 终结，绝不切换路由、绝不 replay）：
  1. `outcome_unknown`（任何来源）；
  2. timeout without proven termination（V2 语义归 outcome_unknown 家族）；
  3. prompt receipt / watermark 已建立（该 attempt admission 已被证明为真，
     切换 = 潜在重复执行）；
  4. partial output（任何已物化/已外显的 assistant 输出）；
  5. tool started（任何 tool call 已 emit/materialize/execute）；
  6. transcript produced（任何消息已进入 transcript）；
  7. admission 后 provider failure；
  8. side-effect uncertainty（任何可能的外部副作用未被证明为零）；
  9. unknown failure class（不可机器分类）。
- `CTR-006`（ONE_LOGICAL_TURN）— 整条链对外 = 一次逻辑 turn。禁止产生：
  多份业务回复、多条用户 transcript、多次 tool side effect、多次
  external delivery、多个 logical occurrence。每次 route 切换前必须已有
  attempt i 的 no-admission 证明（CTR-004）；session 身份跨 route attempt
  保持单一（跨 provider resume 机制证据 OBS-012；机制证明 ≠ credential
  就绪）。
- `CTR-007`（turn-start snapshot / turn-local fallback）— turn 开始时从
  deployment 配置形成 immutable ROUTE_CHAIN snapshot（链内容、顺序、bound
  该 turn 内不变；配置文件的后续修改只影响 controlled restart 之后的
  turn）。fallback 进度为 turn-local：下一 turn 一律从 snapshot 的
  primary 重新开始。活 process（上一 turn 的 fallback route）与新 turn
  primary 的 reconciliation 由实现轮在「下一 turn 从 primary 开始」政策内
  解决，不得引入跨 turn 的 route 粘滞。
- `CTR-008`（loud 逐 attempt journal；SILENT_FALLBACK = FORBIDDEN）— 每次
  route attempt（无论是否触发后续跳）必须在 durable、非 surface 的
  evidence/log 中记录：
  ```text
  ROUTE_CHAIN_ID      （本 turn 链快照的稳定标识）
  ATTEMPT_INDEX       （0-based；对应 ROUTE_CHAIN[ATTEMPT_INDEX]）
  ROUTE               （provider/model 的 routeRef 形态）
  FAILURE_CLASS       （本 attempt 失败类；成功 = NONE）
  ADMISSION_PROVEN    （本 attempt admission 证明状态）
  ATTEMPT_OUTCOME     （成功 / 结构化失败类 / stop 类）
  ```
  turn 终结时追加 final block：
  ```text
  FINAL_ROUTE            （成功 route；全败 = NONE）
  FINAL_OUTCOME          （SUCCESS / 最后失败类 / STOP 类）
  TOTAL_ROUTE_ATTEMPTS   （≤ MAX_ROUTE_ATTEMPTS）
  ```
  字段值必须真实（不得伪造未发生的 attempt 或失败）。**禁止记录**：raw
  provider error、token、credential、Authorization、response body、
  prompt body（redaction 边界，承接 candidate CTR-005/CTR-007 一般化）。
- `CTR-009`（显式 override 与 Scheduler 继承）— 请求级**显式** model/route
  选择（如 scheduler invokeAgent 的 request.model，OBS-013；及未来显式
  用户 model 选择 seam）默认 **strict**：不套用 Agent chain（零 fallback）。
  Scheduler job 二选一：(a) 继承 Agent 的 chain；(b) 显式提供自己的
  fallbacks（routeRef 必须解析到同一 routeCatalog、同样受去重/bound/
  白名单约束）。job 级显式 primary 选择遵循本条 strict 默认，除非 job
  同时显式提供 fallbacks。
- `CTR-010`（credential 与配置边界）— raw credential/token/secret 绝不进入
  agent-model-overrides.json（或其他配置）；catalog 仅携带
  credentialReadiness **引用**。引用的 route 就绪 gate 未满足时其配置激活
  = fail-loud（不静默降级、不静默跳过该 route）。Luna 边界（承接
  candidate CTR-008 全文）：新 authsvc Home 无正式 OAuth Credential、
  dsh-codex provisioning 未完成（LUNA_DIRECT_ROUTE_READY = NO）；就绪 =
  独立轮完成 provisioning + operator 亲自交互式 OAuth（credential 0600 /
  directory 0700）；本 Spec 不授权复制旧 root `.openai-codex-auth.json`
  （OBS-005）；禁止读取/修改 `~/.codex/auth.json`；禁止 OPENAI_API_KEY /
  API credits 路径；token 不进 env（非目标进程）/argv/prompt/Feishu/日志。
- `CTR-011`（Harness / plugin pin carry-forward）— 承接 candidate CTR-011
  （溯源 PROVIDER_V1 Amendment 2 A2.1）：`deepseek-harness 0.1.0-rc.8 @
  514ab7b0029141b88c807704764d0d3e1eea1da4`；dsh-codex **@0.2.3 exact**
  （resolved ≠ 0.2.3 含 0.2.4 → reject/fail-loud，不静默放行）。实现轮
  不得静默升级 Harness；resolved mismatch 保持 `dsh_version_mismatch`
  fail-loud 语义（**不属于** CTR-004 白名单）。变更 pin 须本 Spec 自身
  amendment 显式 supersede 并经独立评审。
- `CTR-012`（Fleet 隔离）— 本 Spec 仅 `agt_cto-agent`。其余全部 Agent 的
  resolved provider/model、child env、网络路径零变化；不注册任何 fleet 级
  fallback 机制；launchd 全局 env 不因本 Spec 改动；v2 overrides 的合法
  key 在本 authority 下恰好为 `{agt_cto-agent}`。
- `CTR-013`（实现边界与三入口统一）— 本 Spec 不授予实现权限。实现轮
  （独立 implementation-authorizing authority）必须：(a) 在 onIngress、
  deliver、scheduler invokeAgent 三个入口统一执行同一链政策（OBS-009）；
  (b) 以新 process attempt 承载 route 切换（OBS-008；AgentProcess 内 route
  不可变语义保持）；(c) 落实 CTR-007 snapshot 与 CTR-008 journal；
  (d) 不引入 dynamic quota router / account pool / load balancing /
  raw provider error 文本解析（决策只允许稳定结构化失败类）。

## 10. Acceptance（未来实现轮验收框架；本轮不执行）

| # | 项 | 覆盖 |
|---|---|---|
| ACC-001 | v2 schema 校验族：malformed（schema/缺字段/未解析引用/重复 route/超 bound/version≠2/非授权 agentId）逐一 ⇒ startup fail-loud；合法配置 ⇒ startup 加载成功 | CTR-001 |
| ACC-002 | primary-first：primary 成功 ⇒ 零 fallback 活动（journal TOTAL_ROUTE_ATTEMPTS=1；零 Luna 网络活动） | CTR-002 |
| ACC-003 | 有序遍历：注入 route[0] 白名单失败 ⇒ 恰一次推进 route[1]；注入 route[1] 白名单失败 ⇒ 恰一次推进 route[2]（多跳链）；无跳跃、无重复 attempt | CTR-003/004 |
| ACC-004 | 四类白名单在**首跳与中间跳**各自注入 ⇒ 各自恰一次推进，journal 字段齐全 | CTR-004 |
| ACC-005 | 九类禁止情形（含 outcome_unknown/unknown class）逐一注入 ⇒ STOP_CHAIN、零后续 route、fail-loud/outcome_unknown、无 replay | CTR-005 |
| ACC-006 | ONE_LOGICAL_TURN：多 attempt 链全程恰好一份业务回复、一份用户 transcript、一次 external delivery、一个 logical occurrence、无重复 tool side effect | CTR-006 |
| ACC-007 | snapshot/turn-local：turn 中途改配置文件对该 turn 零影响；下一 turn 从 primary 重新开始；无跨 turn route 粘滞 | CTR-007 |
| ACC-008 | journal 完整性 + redaction 扫描：逐 attempt 六字段 + final 三字段齐全；全量日志无 raw provider error/token/credential/Authorization/response body/prompt body | CTR-008 |
| ACC-009 | explicit override strict：request.model 显式 ⇒ 零 fallback；scheduler job 继承与显式 fallbacks 两形态各自正确 | CTR-009 |
| ACC-010 | credential/readiness gate：引用 route 未就绪 ⇒ 配置激活 fail-loud（无静默降级）；配置文件全量扫描无 raw credential | CTR-010 |
| ACC-011 | pin 不变量：resolved dsh-codex = 0.2.3；resolved harness = 0.1.0-rc.8 @ 514ab7b（或已由本 Spec amendment 显式 supersede 并留痕）；mismatch ⇒ fail-loud 且不触发跳 | CTR-011 |
| ACC-012 | 隔离回归：非目标 Agent resolved route/env 字节不变；v2 overrides 拒绝其他 agentId | CTR-012 |
| ACC-013 | 三入口一致：onIngress / deliver / scheduler invokeAgent 各自触发的 turn 受同一链政策与 journal 约束（结构审查 + 注入测试） | CTR-013 |
| ACC-014 | ROUTE_ORDER_HARDCODED_IN_CODE 审查：产品代码无 per-Agent 路由顺序/tuple 常量；改配置（在 bound 与 catalog 内换序/增删 fallback）无需代码变更即可生效（controlled restart 后） | DEC-004 |

（真实 OAuth、真实 Luna 网络回退、真实手机飞书端到端演练属 controlled live
acceptance，须在本 Spec accepted、Q-2/Q-3 关闭后另行安排，本轮不冻结为
立即可执行项。）

## 11. Alternatives and disposition

- `ALT-001` — AMEND candidate（accepted Spec 上直接改）：**REJECTED**——
  SPEC_GOVERNANCE_V0 §9.1：accepted 后仅 editorial-only / strictly-additive；
  单一回退 → 有序链是方向反转。
- `ALT-002` — accepted-candidate withdrawal（accepted → proposed 后重新
  review/acceptance）：**REJECTED**——协议 lifecycle 无 accepted → proposed
  转换（forward-only）；执行将伪造已绑定的 review/acceptance 记录。
- `ALT-003` — 先 merge PR #60 再在 main 上 supersede：**REJECTED**——违反
  Owner 裁决「旧 PR #60 不得进入 main」；会使 single-fallback 权威在
  main 短暂 active，留下多余一次 authority transaction。
- `ALT-004` — 维持单一 fallback（candidate 现状）：**REJECTED**——Owner
  裁决 2026-08-25：SINGLE_FALLBACK_ONLY = REJECTED（NEW_EVIDENCE 重开）。
- `ALT-005` — 静默改写 accepted candidate normative body：**FORBIDDEN**——
  任务明令禁止 + §8.2 accepted 语义不可变。
- `ALT-006` — 基于 main 新建 PR 直接 supersede PROVIDER_V1、绕过 candidate：
  **REJECTED**——candidate 在本 lineage 内持有已执行的 acceptance
  transaction；绕过将造成对 PROVIDER_V1 的双重 supersession 声明与无协议
  依据的 acceptance 处置（等效 withdrawal），审计性更差。
- `ALT-007` — 在 DSH model-call 层（`agent/request-error` seam /
  DSH_PROVIDER_FALLBACK_CHAIN_V1）实现链：**REJECTED**——安全边界锚定
  Agent Core admission 层；model-call 层切换发生在 admission 之后，天然落入
  CTR-005 禁止域；该提案未 accept、scope 排除本 Agent。
- `ALT-008` — 代码常量内嵌链（如硬编码 [zai, luna]）：**REJECTED /
  FORBIDDEN**——ROUTE_ORDER_HARDCODED_IN_CODE = FORBIDDEN；v1 已存在的
  常量锁定形态（OBS-006）正是被取代对象。
- `ALT-009` — 无界链 / cycle / 回退后返回 / chain restart：**REJECTED**——
  Owner 禁令（CTR-003）。
- `ALT-010` — dynamic quota router / account pool / load balancing /
  静默 fallback / 复制旧 OAuth secret「顺手」就绪：**REJECTED**——承接
  candidate ALT-005/006 与 CTR-010 边界。

## 12. Migration, compatibility, and rollback

- `MIG-001` — 替换事务 = §3.3 冻结形态，在本 replacement lineage 内原子
  执行（candidate 在任何 merge 之前已是 superseded）。
- `MIG-002` — PR 序列（冻结）：(1) 本 replacement PR review → acceptance
  （§3.3 事务执行）→ final-head recheck；(2) merge 前 PR #60 以 unmerged
  状态关闭（superseded-by 指向本 PR；不得以任何形态 merge）；(3) merge
  本 PR——main 收到完整 lineage：PROVIDER_V1（superseded）→ candidate
  （superseded，从未 current）→ NEW（accepted / current）。
- `MIG-003` — Carry-over（自 candidate 权威域吸收，语义不变）：harness
  pin（CTR-011）；dsh-codex exact pin；credential ownership / OAuth
  operator-interactive / 0600-0700 / 不共享 `~/.codex/auth.json`
  （CTR-010）；其他 Agent 零变化（CTR-012）；SILENT_FALLBACK = FORBIDDEN
  （泛化为 CTR-008）；no silent success with wrong provider；PROXY_SEAM_V1
  独立 authority + metadata-only repoint（§3.3）；session 跨 provider
  resume 诚实边界（CTR-006）。
- `MIG-004` — v1 → v2 配置迁移 = deployment-authored 显式重写（无自动
  转换）；当前生产无 override 文件（OBS-003），实际迁移面 = 未来首次
  写入 v2 文件，无存量 v1 数据需要转换。
- `ROLLBACK` — 移除本 Spec 的 per-Agent route 配置 + controlled restart ⇒
  该 Agent 回落当前全局 env route（现值 oc-go/deepseek-v4-flash，OBS-003；
  若届时已变，以届时值为准并如实记录）。credential 可保留不删；不影响
  其他 Agent；不回滚 DSH 版本。

## 13. Open questions

- `Q-1`（OWNER_DECISION_REQUIRED）— MAX_CONFIGURED_ROUTES 具体数值。
  约束：必须明确、≠ 2；建议 **4**（Owner 示例链 primary + route-B +
  route-C + luna 的长度；acceptance 时批准冻结，后续变更走本 Spec
  amendment）。
- `Q-2` — zai/glm-5.3 在 authsvc runtime 的受控实测（CLM-005）与 zai
  catalog tuple（plugin/pluginVersion/credential 注入状态）核实：
  implementation 轮前置（继承 candidate Q-2）。
- `Q-3` — Luna 就绪轮（provisioning + operator 交互式 OAuth 到新 Home）
  的独立授权与执行时序：另行 dispatch（继承 candidate Q-3）。
- `Q-4`（实现轮开放缝，非 Owner 决策）— turn-local fallback 与活 process
  的 reconciliation 机制（下一 turn 从 primary 开始时，上一 turn 的
  fallback-route 活 process 如何处置），由 implementation-authorizing
  authority 在 CTR-007 政策内冻结。

## 14. Final Output（authoring 轮填写）

```text
TASK_NAME = 链路 执行
TASK_STATUS = AUTHORING_COMPLETE（proposed；READY_FOR_INDEPENDENT_REVIEW）

SPEC_ID = AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V1
SPEC_BASE = 78212c71196ecf156a247123f2373a74c427d16d（PR #60 head；
  replacement PR 分支 docs/agt-cto-ordered-route-chain-v1）
AUTHORITY_CHANGE_FORM = SUPERSEDE（新 whole-authority replacement Spec；
  vendored SPEC_GOVERNANCE_V0 §9.2。AMEND 不适用 §9.1；accepted→proposed
  withdrawal 无协议转换，REJECTED）
CURRENT_CANDIDATE_DISPOSITION = PR60_MUST_NOT_MERGE；candidate 保持 accepted
  状态与字节不变直至本 Spec acceptance 时按 §3.3 原子事务 superseded——
  其 normative single-fallback meaning 从不在 main 生效；PR #60 在本
  replacement PR merge 前以 unmerged 状态关闭（MIG-002）

OWNER_RULING_2026_08_25 =
  ORDERED_CONFIGURABLE_ROUTE_CHAIN = REQUIRED
  SINGLE_FALLBACK_ONLY = REJECTED
  ROUTE_ORDER_HARDCODED_IN_CODE = FORBIDDEN

ORDERED_FALLBACK_CHAIN = REQUIRED（ROUTE_CHAIN = [primary] ∪ fallbacks，
  ordered、finite、config-owned）
PRIMARY_ROUTE = zai / glm-5.3（route[0]，初始目标配置）
LUNA_ROUTE = openai-codex / gpt-5.6-luna（dsh-codex@0.2.3；初始目标配置中
  fallbacks[0]；authority/schema 允许未来仅改配置调整其位置/前后追加 route）
MAX_CONFIGURED_ROUTES = OWNER_DECISION_REQUIRED（Q-1；建议 4；≠ 2）
MAX_ROUTE_ATTEMPTS = ROUTE_CHAIN.length（≤ MAX_CONFIGURED_ROUTES）
MAX_FALLBACK_ATTEMPTS = ROUTE_CHAIN.length - 1

ROUTE_ORDER_OWNER_DECISION_REQUIRED = NO（顺序 authority = deployment 配置；
  初始目标配置由 Owner 裁决给出：zai primary + luna fallback）
UNRESOLVED_ROUTE_SLOTS = NONE（未来 slot 变化 = 配置变更，无需新 authority）

CONFIG_SCHEMA = agent-model-overrides.json version 2
  （routeCatalog + overrides.<agentId>.model.primary + .fallbacks[]；
  fallbacks=[] = strict；route 去重；raw credential 禁入）
TURN_SNAPSHOT = turn 开始时 immutable；fallback turn-local，下一 turn 从
  primary 重新开始；explicit user model override 默认 strict；Scheduler job
  继承 Agent chain 或显式自带 fallbacks

OUTCOME_UNKNOWN_FALLBACK = FORBIDDEN（CTR-005 STOP_CHAIN 封闭禁止集）
ONE_LOGICAL_TURN = REQUIRED（单回复/单 transcript/无重复 tool side effect/
  单 external delivery/单 logical occurrence）
MULTIPLE_INTERNAL_ATTEMPTS = ALLOWED（ROUTE_ATTEMPTS，每 route 每 turn 至多
  一次，每次切换前须证明前一 attempt 无 admission）

SAFE_HOP_GATE = PROVEN_NO_ADMISSION + 封闭四类白名单（逐跳重审适用：
  spawn_failed_without_child / initialize provider-unavailable / session
  create-resume structured rejection / turnQueue not_admitted）
LOUD_JOURNAL = ROUTE_CHAIN_ID · ATTEMPT_INDEX · ROUTE · FAILURE_CLASS ·
  ADMISSION_PROVEN · ATTEMPT_OUTCOME（逐 attempt）+ FINAL_ROUTE ·
  FINAL_OUTCOME · TOTAL_ROUTE_ATTEMPTS（终局）；禁录 raw provider error /
  token / credential / Authorization / response body / prompt body

IMPLEMENTATION_FACTS_RECORDED = YES（单 route config model-overrides.js:206；
  route tuple 锁死代码常量 :243-247；resolveProcessConfig compose.js:274 仅
  process boundary；process-registry.js:328 单次 resolve，AgentProcess route
  不可变，route 切换 = 新 process attempt；三入口 index.js:248 onIngress /
  index.js:284 deliver / scheduler-router index.js:95 invokeAgent；无 attempt
  journal）

SPEC_STATUS = proposed
implementation_authority = none
production_apply_authority = none

PRODUCT_CODE_CHANGE = NONE
CREDENTIAL_CHANGE = NONE
PRODUCTION_CHANGE = NONE
DEPLOYMENT = NONE
MERGE = NO（PR #60 保持不得合入；本 replacement PR 亦不 merge）

NEXT_TASK = 链路 审计
```
