---
spec_id: AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V1
status: accepted
accepted_reviewed_head: ee13cb224660416c9044203610b93cb8f13873bb
acceptance_audit: PASS
acceptance_audit_blocker_count: 0
owner_decision_max_configured_routes: 4
amendment_1: AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V1_AMENDMENT_1_BUILTIN_ROUTE_KIND
amendment_1_status: proposed（awaiting independent review；Draft PR，未 merge）
date: 2026-08-25
type: implementation-spec (SPEC ONLY — 本轮只冻结授权边界与配置 schema；不实现、不配置、不部署)
spec_kind: implementation
authority_level: governing_spec
implementation_authority: none
production_apply_authority: none
replaces_on_acceptance:
  - AGENT_CORE_CHATGPT_SUBSCRIPTION_PROVIDER_V1
  - AGENT_CORE_CHATGPT_SUBSCRIPTION_TARGET_PROXY_SEAM_V1
supersedes:
  - AGENT_CORE_CHATGPT_SUBSCRIPTION_PROVIDER_V1
  - AGENT_CORE_CHATGPT_SUBSCRIPTION_TARGET_PROXY_SEAM_V1
superseded_by: null
scope:
  - agt_cto-agent 的 model-route 政策：ordered configurable route chain（直接 whole-authority replacement main 上当前 active model-route authority）
  - agent-model-overrides.json version 2 配置 schema：routeCatalog + overrides.<agentId>.model.primary / fallbacks[]
  - ROUTE_ORDER_HARDCODED_IN_CODE = FORBIDDEN：路由顺序的唯一 authority = deployment-owned 配置文件
  - canonical route identity 与 alias fail-loud 去重
  - per-hop 安全转换规则（proven-no-admission 封闭白名单 + STOP_CHAIN 封闭禁止集）
  - turn-start immutable snapshot、turn-local fallback、ONE_LOGICAL_TURN 外部语义
  - 逐 attempt loud evidence journal 与 redaction 边界
governed_by:
  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0
external_authorities: []
owners:
  - repository-maintainers
references:
  - PR #60 / AGT_CTO_AGENT_GLM53_PRIMARY_LUNA_FALLBACK_V1（ABANDONED_UNMERGED_CANDIDATE；从未进入 main、不是 active authority、必须关闭且永不 merge；本 Spec 不 supersede 它）
  - docs/specs/AGENT_CORE_CHATGPT_SUBSCRIPTION_PROVIDER_V1.md（main 上当前 active model-route authority；本 Spec acceptance 时直接 whole-authority replacement；其 Amendment 2 A2.1 harness pin 由本 Spec carry forward）
  - docs/specs/AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0.md（accepted；当前 development-governance authority；vendored SPEC_GOVERNANCE_V0.md §8/§9 为本 Spec 治理形式依据）
  - docs/specs/AGENT_CORE_CHATGPT_SUBSCRIPTION_TARGET_PROXY_SEAM_V1.md（accepted on main；现行 v1 providerEnv seam authority；本 authoring PR 恢复其 current-main bytes，本 Spec acceptance 时 whole-supersede 并完整吸收其安全契约）
  - docs/specs/AGENT_PROCESS_LIFECYCLE_HARDENING_V2.md（accepted；spawn/admission/turn 状态与 outcome_unknown 语义 authority）
  - docs/investigations/LUNA_DSH_RC8_VERSION_ALIGNMENT_V1.md（accepted-on-main investigation；rc.8 + dsh-codex@0.2.3 session create/resume 证据）
---

# AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V1 — CTO Agent 有序可配置路由链（ordered configurable route chain）

> **Amendment 1（2026-08-26，Builtin Route Kind；proposed）**：文末
> 「Amendment 1」节引入 `routeKind = builtin | subscription`（builtin route
> 的 plugin/pluginVersion = ABSENT/FORBIDDEN），显式 supersede 基础正文中
> 「每 route 必填 plugin/pluginVersion」的 schema 条款并关闭 Q-2；其余全部
> 冻结 ruling 原样不变。该 Amendment accepted 前，基础正文仍是现行权威。
> 基础正文（§1–§15）保持历史原样，不作改写。

> SPEC_STATUS = **accepted**（mechanical acceptance finalize 2026-08-25 ·
> accepted_reviewed_head = ee13cb224660416c9044203610b93cb8f13873bb ·
> 链路 审计 = PASS · BLOCKER_COUNT = 0 · OWNER_DECISION Q-1：
> MAX_CONFIGURED_ROUTES = 4 批准冻结）。
> 本文件是 **docs-only whole-authority replacement Spec**：按 vendored
> SPEC_GOVERNANCE_V0.md §9.2，acceptance 时原子 whole-supersede main 上当前
> active model-route authority `AGENT_CORE_CHATGPT_SUBSCRIPTION_PROVIDER_V1` 与
> current v1 providerEnv seam authority
> `AGENT_CORE_CHATGPT_SUBSCRIPTION_TARGET_PROXY_SEAM_V1`。
> PR #60 / `AGT_CTO_AGENT_GLM53_PRIMARY_LUNA_FALLBACK_V1` 从未进入 main，
> 不是 active authority，定性为 `ABANDONED_UNMERGED_CANDIDATE`；本 Spec **不
> supersede PR #60**。PR #60 必须关闭且永不 merge，见 §3.3/§3.4/§12。
>
> 本轮（authoring round）不实现、不配置、不部署：不改任何 packages/ 代码，
> 不写 agent-model-overrides.json，不执行 OAuth，不复制任何 credential，
> 不发送 Feishu 消息，不重启任何进程，不 merge。
> `implementation_authority = none`、`production_apply_authority = none`。
> 实现须由独立 implementation-authorizing authority 在本 Spec accepted 且进入
> implementation base 后另行授予（governance §10）。
>
> **Acceptance finalize（2026-08-25，链路 采纳执行）**：mayf3 对 exact final
> head `ee13cb224660416c9044203610b93cb8f13873bb`（链路 审计 = PASS，
> 0 blockers）执行 §3.3 冻结的原子 acceptance transaction：本文件
> `status: accepted`、`supersedes` 写入两份 main authorities；两份 old
> authority 文件翻为 `superseded` + `superseded_by` backlink；README 索引同步
> （NEW → accepted/current，两份 old → superseded/historical）。历史正文
> （含「acceptance 时…」条件句、§13 Q-1 待决句与 §14 revision-round
> Final Output）保持逐字不变，作为历史记录；Q-1 由本 finalize 以
> OWNER_DECISION 冻结为 MAX_CONFIGURED_ROUTES = 4（后续变更走本 Spec 自身
> amendment）。`implementation_authority = none`、
> `production_apply_authority = none` 保持不变；PR #60 零 lifecycle mutation
> （保持 CLOSED / UNMERGED）。事务明细见 §15。

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

方向性变更（对比 main 上当前 active authority）：
`AGENT_CORE_CHATGPT_SUBSCRIPTION_PROVIDER_V1` 排除 automatic fallback；本 Spec
冻结「route[0] = primary + 零或多个按序 fallback 的有限链，链内容与顺序由
deployment 配置拥有，代码不内嵌任何路由顺序」。这是 accepted main authority
的实质方向改变，故 acceptance 时走 SUPERSEDE（whole-authority replacement），
不走 AMEND（DEC-001 / ALT-001）。PR #60 的单 fallback 文档仅是从未进入 main
的 `ABANDONED_UNMERGED_CANDIDATE`，不参与 authority lineage。重开 main authority
已拒绝的 automatic fallback 方向之 NEW_EVIDENCE = Owner 裁决 2026-08-25 本身。

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
      "credentialReadiness": "<non-empty readiness reference；绝不含 raw credential>",
      "providerEnv": {                 // 整个字段 optional；存在时是 closed object
        "HTTP_PROXY":        "<string>",
        "HTTPS_PROXY":       "<string>",
        "NO_PROXY":          "<string>",
        "NODE_USE_ENV_PROXY": "1"
      }
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
- **routeRef 去重 + canonical alias 去重**：同一 routeRef 重复，或两个不同
  routeRef 规范化后解析为同一 `CANONICAL_ROUTE_IDENTITY`，均为 malformed →
  startup fail-loud。不得通过 alias 绕过 `ATTEMPTED_AT_MOST_ONCE`。
  `CANONICAL_ROUTE_IDENTITY` 至少由以下 tuple 构成：`provider`、`model`、
  `plugin`、`pluginVersion`、`credentialReadiness` reference、canonical
  `providerEnv`。canonicalization 是纯确定性结构规范化，不得丢弃这些字段：
  `providerEnv` 缺省规范化为显式 `ABSENT`；存在时按四个固定键的固定顺序及
  精确 string 值规范化。每个 canonical route 每 turn 最多尝试一次。
- 引用完整性：`primary` / `fallbacks[]` 的每个 routeRef 必须存在于
  `routeCatalog`；未解析引用 = malformed → startup fail-loud。
- 每 route 必须精确包含 provider、model、plugin、pluginVersion、
  credentialReadiness；可选包含 `providerEnv`。`providerEnv` **不是 reference**：
  整个字段可缺省；若存在，必须是 closed object，精确包含 `HTTP_PROXY`、
  `HTTPS_PROXY`、`NO_PROXY`、`NODE_USE_ENV_PROXY` 四键，四个值全部为 string，
  且 `NODE_USE_ENV_PROXY` 必须精确等于 `"1"`；缺键、额外键、非 string 或其他
  `NODE_USE_ENV_PROXY` 值均 malformed → startup fail-loud。**raw credential /
  token / secret 绝不进入配置文件**（CTR-010）。
- 静态配置语义（直接延续 main active authorities 的 fail-loud 边界）：startup
  一次性加载；在普通 JSON parse 前必须对 v2 **全文件递归 duplicate JSON key**
  扫描（至少覆盖顶层、`routeCatalog`、每个 route entry / `providerEnv`、
  `overrides`、每个 Agent/model object）；任一重复键 = malformed → startup
  fail-loud。其余 malformed（schema 非法 / 字段缺失 / 引用未解析 / 重复
  route / 超出 hard bound）同样 startup fail-loud，不得静默忽略或回退默认值；
  config change requires
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
  `{agt_cto-agent}`（承接 main active PROVIDER_V1 的 ENABLED_AGENTS = exactly 1
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

诚实边界（由本 Spec 的直接观测冻结）：`LUNA_DIRECT_ROUTE_READY = NO`（OBS-004）——
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
MAIN_ACTIVE_MODEL_ROUTE_AUTHORITY = AGENT_CORE_CHATGPT_SUBSCRIPTION_PROVIDER_V1
CURRENT_PROVIDER_ENV_SEAM_AUTHORITY =
  AGENT_CORE_CHATGPT_SUBSCRIPTION_TARGET_PROXY_SEAM_V1
REPLACES_ON_ACCEPTANCE = [
  AGENT_CORE_CHATGPT_SUBSCRIPTION_PROVIDER_V1,
  AGENT_CORE_CHATGPT_SUBSCRIPTION_TARGET_PROXY_SEAM_V1
]
AUTHORITY_CHANGE_FORM = atomic whole-authority SUPERSEDE of both main authorities

PR60_DISPOSITION = ABANDONED_UNMERGED_CANDIDATE
PR60_ACTIVE_AUTHORITY = NO
PR70_SUPERSEDES_PR60 = NO
```

main 上的 PROVIDER_V1 恰好覆盖 `agt_cto-agent` model-route override 政策，
PROXY_SEAM_V1 覆盖同一文件 v1 `providerEnv` seam；v1 loader 也把合法 override
限制为该 Agent（OBS-002/OBS-006）。v2 同时改变 route schema 与 providerEnv 字段
位置，因此本 Spec acceptance 时原子 whole-supersede 两份 main authorities，不做
partial supersession，也不把未进入 main 的 PR #60 放入 authority lineage。

### 3.2 Related authorities（如实登记）

| Authority / candidate | 关系 |
|---|---|
| `AGENT_CORE_CHATGPT_SUBSCRIPTION_PROVIDER_V1`（accepted on main；current） | main 上当前 active model-route authority；本 Spec acceptance 时直接 whole-authority replacement。 |
| PR #60 / `AGT_CTO_AGENT_GLM53_PRIMARY_LUNA_FALLBACK_V1` | `ABANDONED_UNMERGED_CANDIDATE`；从未进入 main、不是 active authority；必须关闭且永不 merge；本 Spec 不 supersede。PR #70 不携带其文件或任何 lifecycle mutation。 |
| `AGENT_CORE_CHATGPT_SUBSCRIPTION_TARGET_PROXY_SEAM_V1`（accepted on main；current） | 现行 v1 providerEnv seam authority。其 v1 字段位置与 v2 routeCatalog 冲突，因此本 authoring PR 先保持该文件 current-main bytes，未来 acceptance transaction 再由本 Spec whole-supersede；其键集、URL/NO_PROXY grammar、脱敏、继承 env strip、target-only 注入、Node pin、reload/rollback 安全契约全部由 CTR-010/014 吸收。 |
| `AGENT_PROCESS_LIFECYCLE_HARDENING_V2`（accepted） | spawn/admission/turn 语义 authority：`spawn_failed_without_child`、initialize 失败、`not_admitted` envelope、prompt receipt watermark、`outcome_unknown` 均以其冻结语义为准。本 Spec 引用不重定义。 |
| `AGENT_CORE_HARDENING_PROGRAM_V1`（accepted） | hardening program 框架（本 Spec 不在其排程序列内，无冲突）。 |
| `DSH_PROVIDER_FALLBACK_CHAIN_V1`（proposed，未 merge，非 authority） | fleet 级 3-route chain 提案（DSH model-call 层）。层级不同（见 ALT-007）、scope 排除本 Agent、未 accept；本 Spec 不依赖它。 |

### 3.3 替换事务（未来原子 acceptance transaction，冻结形态）

```text
ACCEPTANCE_TRANSACTION（一次性 docs-only；仅对 main authorities 执行）：
  NEW.status = accepted
  NEW.supersedes = [
    AGENT_CORE_CHATGPT_SUBSCRIPTION_PROVIDER_V1,
    AGENT_CORE_CHATGPT_SUBSCRIPTION_TARGET_PROXY_SEAM_V1
  ]
  PROVIDER_V1.status = superseded
  PROVIDER_V1.superseded_by = AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V1
  PROXY_SEAM_V1.status = superseded
  PROXY_SEAM_V1.superseded_by = AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V1

  PR60_LIFECYCLE_MUTATION = NONE
  README_INDEX = NEW 行 → accepted/current；两份 main old authorities →
    superseded/historical
```

本 authoring/revision PR 保持 `supersedes: []`；只有 mayf3 对 exact final head
acceptance 时，才在一次原子 docs-only transaction 中写入上述 backlink。

### 3.4 PR #60 处置（冻结）

```text
PR60_DISPOSITION = ABANDONED_UNMERGED_CANDIDATE
PR60_MUST_CLOSE = YES
PR60_MUST_NOT_MERGE = YES
PR60_REOPEN_FOR_MERGE = FORBIDDEN
PR70_SUPERSEDES_PR60 = NO
PR70_CARRIES_PR60_LIFECYCLE_CHANGES = NO
```

PR #60 的 single-fallback meaning 从未在 main 生效。关闭 PR #60 是候选分支
处置，不是 supersession transaction；不得把其文件、accepted/superseded 标记、
backlink 或对其他 main authority 的 lifecycle 改写借 PR #70 带入 main。

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
  catalog tuple 未核实。Basis: PR #60 retained historical evidence（非 authority）与 `OBS-012`。
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

- `OBS-001` — PR #60 candidate 状态。PR #60 分支 head `78212c7`，其文档
  frontmatter 在该未合并分支上写有 `status: accepted`；PR #60 从未 merge。
  按 vendored SPEC_GOVERNANCE_V0 §8.2，unmerged PR 上的 accepted-looking value
  **不是 active authority**。Owner 本轮处置：
  `PR60_DISPOSITION = ABANDONED_UNMERGED_CANDIDATE`，必须关闭且永不 merge。
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
- `OBS-011` — lifecycle 语义锚点（直接引用 accepted authority）。
  `AGENT_PROCESS_LIFECYCLE_HARDENING_V2`（accepted）冻结：
  `spawn_failed_without_child` = child 从未创建成功的唯一 terminal 证据类；
  initialize 失败 = startup bounded reject；`not_admitted` envelope
  （validation/capacity fail 或 proven pre-send zero-byte rejection）；
  prompt receipt watermark 在 prompt write 前建立；无法证明 admission
  假象时必须 `outcome_unknown`。
- `OBS-012` — session 跨 provider resume（历史生产证据，仅作 observation，
  不赋予 PR #60 authority）。旧 root main session 同一 session 文件内三个 provider 分布：
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

- `CLM-001`（SUPPORTED）— main 上当前 active authority
  `AGENT_CORE_CHATGPT_SUBSCRIPTION_PROVIDER_V1` 覆盖恰好且仅
  agt_cto-agent model-route 政策；本 Spec acceptance 时直接 whole-authority
  replacement 不丢弃任何 fleet 级 authority。PR #60 不在 authority lineage。
  Basis: `EVD-001`。
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
  当前仍未核实）。由 Q-2 受控实测轮关闭，不阻塞本 Spec 政策冻结。
- `CLM-006`（INFERRED）— turn-local fallback + turn-start snapshot 与
  PREBOUND process 复用模型兼容：跨 provider session resume 已被证明
  （OBS-012），下一 turn 从 primary 开始的 process reconciliation
  （活着的 fallback-route process 如何处置）可在实现轮于本 Spec 冻结政策
  内解决（记为实现轮开放缝，非 Owner 决策）。

## 7. Evidence relations

- `EVD-001` — `OBS-001`、`OBS-002`、`OBS-006` → SUPPORTS
  `CLM-001` / §3.1 Gate。强度：main active Spec + loader 源码约束，并直接证明
  PR #60 未进入 main。局限：无。
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
  replacement Spec）**，replacement 对象是 main 上当前 active
  `AGENT_CORE_CHATGPT_SUBSCRIPTION_PROVIDER_V1`。决策人：repository owner
  （任务指令 2026-08-25）。理由：main authority 排除 automatic fallback，而本
  Spec 引入有序链，属于实质方向反转；vendored SPEC_GOVERNANCE_V0 §9.2 要求
  whole-authority replacement。PR #60 是 `ABANDONED_UNMERGED_CANDIDATE`，
  从未 active，本 Spec 不 supersede 它，也不执行其 lifecycle transaction。
  替代方案见 ALT-001/ALT-002。
- `DEC-002` — PRIMARY_ROUTE_FIRST = YES：route[0] 恒为 primary = 初始目标
  配置 `zai / glm-5.3`；primary 成功 ⇒ 零 fallback 活动（CTR-002）。
- `DEC-003` — ordered chain 模型冻结（§2）：ROUTE_CHAIN = [primary] ∪
  fallbacks ordered；fallbacks=[] = strict；routeRef 重复与 canonical alias
  重复均 fail-loud；每个 canonical route 每 turn ATTEMPTED_AT_MOST_ONCE；禁止
  ROUTE_CYCLE / RETURN_TO_PREVIOUS_ROUTE / CHAIN_RESTART /
  UNBOUNDED_ATTEMPTS；MAX_ROUTE_ATTEMPTS = 链长；MAX_FALLBACK_ATTEMPTS =
  链长 − 1。
- `DEC-004` — ROUTE_ORDER_HARDCODED_IN_CODE = FORBIDDEN：唯一顺序 authority =
  deployment-owned `agent-model-overrides.json` **version 2**；job/request 不得
  内嵌 fallback arrays，产品代码不得内嵌 per-Agent 路由顺序或路由 tuple 常量。
  v1 的 `CHATGPT_SUBSCRIPTION_V1` 值锁定约束由本 Spec 取代；代码中只保留
  schema 校验与无 override 时的 global env 兜底。
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
- `DEC-010` — credential / providerEnv 边界：raw credential 绝不进配置；
  per-route `credentialReadiness` 是 reference；`providerEnv` 不是 reference，
  而是可缺省的四键 closed object（§2.1/CTR-010）。Luna 就绪 = 独立轮
  （provisioning + operator 交互式 OAuth、0600/0700）；禁止复制旧 root
  secret；禁止 `~/.codex/auth.json` 读写；禁止 OPENAI_API_KEY 路径。
- `DEC-011` — carry-forward（直接自 main active authority / accepted seam 吸收，语义不变）：DSH
  harness pin `0.1.0-rc.8 @ 514ab7b…`（实现轮不得静默升级；mismatch =
  fail-loud，**不是** fallback 触发类）；dsh-codex@0.2.3 exact pin；
  SILENT_FALLBACK = FORBIDDEN（泛化为逐 attempt journal，CTR-008）；静态
  配置语义；fleet 隔离；PROXY_SEAM_V1 本轮保持 current-main bytes、acceptance
  时 whole-supersede，并由 CTR-010/014 完整吸收其安全契约；session 跨
  provider resume 诚实边界（机制证明 ≠ credential 就绪）；
  DSH model-call 层排除（ALT-007）。
- `DEC-012` — 本轮 zero implementation：implementation_authority = none；
  实现须由独立 implementation-authorizing authority 在本 Spec accepted 且
  进入 implementation base 后授予，且必须统一三入口（OBS-009）。
- `DEC-013` — `SCHEDULER_JOB_ROUTE_POLICY = INHERIT_AGENT_CHAIN_ONLY`。
  Scheduler job 不得内嵌 `fallbacks` 数组；request/job 级显式 route/model 仍为
  strict 单路由。未来若确需 job-specific chain，必须另立独立 authority；本轮
  不加入该能力。

## 9. Contracts

- `CTR-001`（ROUTE_CHAIN 配置模型）— 唯一顺序 authority 是
  deployment-owned `agent-model-overrides.json` **version 2**（§2.1 schema）：
  routeCatalog（routeRef → provider/model/plugin/pluginVersion/
  credentialReadiness/providerEnv?）+ overrides.`<agentId>`.model.primary
  （routeRef）+ .fallbacks（ordered routeRef array）。校验规则：普通 parse 前
  全文件递归 duplicate-key 扫描，任一层重复 JSON key 均 fail-loud；exact
  schema；引用必须解析；同 routeRef 重复或不同 routeRef 解析为相同
  `CANONICAL_ROUTE_IDENTITY` 均 fail-loud；链长 ≤ MAX_CONFIGURED_ROUTES；
  version ≠ 2 fail-loud；激活范围 = 恰好 `{agt_cto-agent}`。malformed 家族
  一律 startup fail-loud；config change requires controlled restart。
- `CTR-002`（PRIMARY_ROUTE_FIRST）— route[0] = primary（初始目标 =
  zai/glm-5.3）。primary attempt 成功 ⇒ 该 turn 零 fallback 活动（零额外
  route attempt、零 Luna/其他 route 网络调用）。primary 失败且不满足
  CTR-004 gate = 结构化 fail-loud，带 FAILURE_CLASS。
- `CTR-003`（有序遍历、canonical 去重与终止）— attempt 顺序严格为
  route[0] → route[1] → … → route[N-1]（数组序）。
  `CANONICAL_ROUTE_IDENTITY` 至少精确包含 provider、model、plugin、
  pluginVersion、credentialReadiness reference、canonical providerEnv；
  providerEnv 缺省与 present closed object 均有确定性 canonical form。两个不同
  routeRef 若 canonical tuple 相同，配置必须 fail-loud。每个 canonical route
  每 turn **ATTEMPTED_AT_MOST_ONCE**。绝对禁止：ROUTE_CYCLE、
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
  prompt body（redaction 边界，直接冻结为本 Spec 约束）。
- `CTR-009`（显式 override 与 Scheduler 继承）— 请求级**显式** model/route
  选择（如 scheduler invokeAgent 的 request.model，OBS-013；及未来显式
  用户 model 选择 seam）默认 **strict**：不套用 Agent chain（零 fallback）。
  `SCHEDULER_JOB_ROUTE_POLICY = INHERIT_AGENT_CHAIN_ONLY`：未提供显式 route/model
  的 Scheduler job 只继承 Agent chain；job/request schema **禁止内嵌
  `fallbacks` 数组**。job 级显式 primary/model 选择仍是 strict 单路由。未来若
  需要 job-specific chain，必须另立 authority，不得在本 Spec 或 request/job
  payload 中暗增。
- `CTR-010`（credential 与 providerEnv 配置边界）— raw
  credential/token/secret 绝不进入 agent-model-overrides.json（或其他配置）；
  catalog 的 `credentialReadiness` 仅携带 reference。`providerEnv` **不是
  reference**，整个字段 optional；若存在，必须精确包含 `HTTP_PROXY`、
  `HTTPS_PROXY`、`NO_PROXY`、`NODE_USE_ENV_PROXY`，所有值为 string，且
  `NODE_USE_ENV_PROXY = "1"`；禁止额外键；`providerEnv` 内任一 duplicate JSON
  key 必须在 parse 前 fail-loud。任何缺键、额外键、重复键、类型错误或值错误
  均 malformed fail-loud。承接被 whole-supersede seam 的更强值域：四值均为
  **非空** string；`HTTP_PROXY` / `HTTPS_PROXY` 均须为可解析的 `http:` 或
  `https:` URL，host 非空、端口合法，不得含 username/password/userinfo、query、
  fragment 或 credential 形态；`NO_PROXY` 须为非空 comma-separated host-list，
  entry 仅允许 `*`、合法 ASCII hostname/domain、IPv4、IPv6、bracketed IPv6、
  `localhost` 及合法可选端口，禁止空 entry、whitespace、control/newline、quote、
  backtick、`$`、插值或 shell syntax。所有校验错误只允许报告 key name + invalid
  class，禁止回显 URL、NO_PROXY 原值或任何 providerEnv value。
  credentialReadiness 未满足时配置激活 = fail-loud（不静默降级、不静默跳过该
  route）。Luna 边界（由 `OBS-004`/`OBS-005`
  直接冻结）：新 authsvc Home 无正式 OAuth Credential、
  dsh-codex provisioning 未完成（LUNA_DIRECT_ROUTE_READY = NO）；就绪 =
  独立轮完成 provisioning + operator 亲自交互式 OAuth（credential 0600 /
  directory 0700）；本 Spec 不授权复制旧 root `.openai-codex-auth.json`
  （OBS-005）；禁止读取/修改 `~/.codex/auth.json`；禁止 OPENAI_API_KEY /
  API credits 路径；token 不进 env（非目标进程）/argv/prompt/Feishu/日志。
- `CTR-011`（Harness / plugin pin carry-forward）— 直接承接 main active
  PROVIDER_V1 Amendment 2 A2.1：`deepseek-harness 0.1.0-rc.8 @
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
- `CTR-014`（providerEnv 注入 seam whole-authority carry-forward）— 完整吸收
  `AGENT_CORE_CHATGPT_SUBSCRIPTION_TARGET_PROXY_SEAM_V1` 的非 schema 安全契约：
  production-runtime 启动时若继承 env 含任一 `HTTP_PROXY`、`HTTPS_PROXY`、
  `NO_PROXY`、对应 lowercase、`ALL_PROXY`/`all_proxy` 或
  `NODE_USE_ENV_PROXY`（即使空值）则 `AGENT_MODEL_OVERRIDE_INVALID` fail-loud，
  仅报告 key + invalid class；每次 child spawn 先 strip 全集，再仅向当前 canonical
  route 的目标 AgentProcess 注入 providerEnv 四个大写键，non-target child 全部
  absent，runtime 自身永不注入。providerEnv 不进入 initialize/turn/deliver、
  Binding、Session、ChannelConversation、argv、日志或 evidence，且 process
  生命周期内 immutable。`NODE_RUNTIME_VERSION = 25.6.1 exact`；不匹配则 startup
  fail-loud 且不创建 child。reload 只发生在受控 target process restart / 新
  process spawn；不得 watcher、热更新或重启其他 Agent。proxy-only rollback =
  从目标 routeCatalog entry 移除整个 providerEnv 字段并只重启目标 Agent；full
  rollback = 移除整个 override 并只重启目标 Agent，回落届时 global env route；
  两者均不改 launchd、不触碰其他 Agent 或 credential/plugin。禁止通用 per-Agent
  任意 env、全局 proxy、proxy auto-discovery/health switching、DSH/dsh-codex/pi-ai
  改动。controlled live acceptance 仍须分别证明 target HTTP fetch、WebSocket
  CONNECT、dsh-codex auxiliary fetch 经 proxy，non-target proxy keys 全 absent，
  手机飞书 Luna reply、cold restart、rollback 与 final re-enable；单一 curl 或单一
  model roundtrip 不得替代前三项独立证据。

## 10. Acceptance（未来实现轮验收框架；本轮不执行）

| # | 项 | 覆盖 |
|---|---|---|
| ACC-001 | v2 schema 校验族：全文件各层 recursive duplicate JSON key（顶层/routeCatalog/route entry/providerEnv/overrides/agent/model）逐一 ⇒ parse 前 fail-loud；其余 malformed（schema/缺字段/未解析引用/重复 routeRef/canonical alias tuple 重复/providerEnv 缺键、额外键、非 string、NODE_USE_ENV_PROXY≠"1"/超 bound/version≠2/非授权 agentId）逐一 ⇒ startup fail-loud；合法配置 ⇒ startup 加载成功 | CTR-001/003/010 |
| ACC-002 | primary-first：primary 成功 ⇒ 零 fallback 活动（journal TOTAL_ROUTE_ATTEMPTS=1；零 Luna 网络活动） | CTR-002 |
| ACC-003 | 有序遍历：注入 route[0] 白名单失败 ⇒ 恰一次推进 route[1]；注入 route[1] 白名单失败 ⇒ 恰一次推进 route[2]（多跳链）；无跳跃；不同 routeRef 同 canonical tuple 在 startup 拒绝；运行时每 canonical route 每 turn 最多一次 | CTR-003/004 |
| ACC-004 | 四类白名单在**首跳与中间跳**各自注入 ⇒ 各自恰一次推进，journal 字段齐全 | CTR-004 |
| ACC-005 | 九类禁止情形（含 outcome_unknown/unknown class）逐一注入 ⇒ STOP_CHAIN、零后续 route、fail-loud/outcome_unknown、无 replay | CTR-005 |
| ACC-006 | ONE_LOGICAL_TURN：多 attempt 链全程恰好一份业务回复、一份用户 transcript、一次 external delivery、一个 logical occurrence、无重复 tool side effect | CTR-006 |
| ACC-007 | snapshot/turn-local：turn 中途改配置文件对该 turn 零影响；下一 turn 从 primary 重新开始；无跨 turn route 粘滞 | CTR-007 |
| ACC-008 | journal 完整性 + redaction 扫描：逐 attempt 六字段 + final 三字段齐全；全量日志无 raw provider error/token/credential/Authorization/response body/prompt body | CTR-008 |
| ACC-009 | explicit override strict：request.model 显式 ⇒ 零 fallback；Scheduler job 仅继承 Agent chain；job/request 出现 fallbacks 数组 ⇒ schema 拒绝；不存在 job-specific chain | CTR-009 |
| ACC-010 | credential/readiness gate：引用 route 未就绪 ⇒ 配置激活 fail-loud（无静默降级）；providerEnv optional closed-object 正反例全覆盖；配置文件全量扫描无 raw credential | CTR-010 |
| ACC-011 | pin 不变量：resolved dsh-codex = 0.2.3；resolved harness = 0.1.0-rc.8 @ 514ab7b（或已由本 Spec amendment 显式 supersede 并留痕）；mismatch ⇒ fail-loud 且不触发跳 | CTR-011 |
| ACC-012 | 隔离回归：非目标 Agent resolved route/env 字节不变；v2 overrides 拒绝其他 agentId | CTR-012 |
| ACC-013 | 三入口一致：onIngress / deliver / scheduler invokeAgent 各自触发的 turn 受同一链政策与 journal 约束（结构审查 + 注入测试） | CTR-013 |
| ACC-014 | ROUTE_ORDER_HARDCODED_IN_CODE 审查：产品代码无 per-Agent 路由顺序/tuple 常量；改配置（在 bound 与 catalog 内换序/增删 fallback）无需代码变更即可生效（controlled restart 后） | DEC-004 |
| ACC-015 | providerEnv whole-authority carry-forward：继承 proxy 键逐键 startup 拒绝；child strip + target-only 四键注入；URL/NO_PROXY grammar 正反例；Node 25.6.1 exact gate；日志/evidence 脱敏；target-only reload；proxy-only/full rollback；non-target PID/route/env 不变；controlled live 独立 HTTP/WebSocket/auxiliary observers + Feishu/cold-restart/rollback/re-enable | CTR-010/014 |

（真实 OAuth、真实 Luna 网络回退、真实手机飞书端到端演练属 controlled live
acceptance，须在本 Spec accepted、Q-2/Q-3 关闭后另行安排，本轮不冻结为
立即可执行项。）

## 11. Alternatives and disposition

- `ALT-001` — AMEND main active authority：**REJECTED**——
  `AGENT_CORE_CHATGPT_SUBSCRIPTION_PROVIDER_V1` 排除 automatic fallback，而
  ordered chain 是方向反转，必须 whole-authority SUPERSEDE。
- `ALT-002` — supersede PR #60：**REJECTED**——PR #60 从未进入 main，不是
  active authority；其正确处置是 `ABANDONED_UNMERGED_CANDIDATE`、关闭且永不
  merge，不得伪造 authority lineage。
- `ALT-003` — 先 merge PR #60 再在 main 上 supersede：**REJECTED**——违反
  Owner 裁决；会使 single-fallback candidate 错误成为 active authority。
- `ALT-004` — 维持单一 fallback（candidate 现状）：**REJECTED**——Owner
  裁决 2026-08-25：SINGLE_FALLBACK_ONLY = REJECTED（NEW_EVIDENCE 重开）。
- `ALT-005` — 将 PR #60 lifecycle mutation 携入 PR #70：**FORBIDDEN**——
  current-main 才是 active authority 状态；PR #70 必须恢复这些文件为
  current-main bytes。
- `ALT-006` — acceptance 时直接 supersede main active PROVIDER_V1：
  **SELECTED**——这是唯一真实 authority lineage；PR #60 不参与。
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
  静默 fallback / 复制旧 OAuth secret「顺手」就绪：**REJECTED**——承接既有
  credential 与 CTR-010 边界。
- `ALT-011` — Scheduler job/request 内嵌 fallbacks 数组：**REJECTED /
  FORBIDDEN**——破坏 `agent-model-overrides.json` version 2 的唯一顺序 authority；
  未来 job-specific chain 必须另立 authority。
- `ALT-012` — 仅按 routeRef 去重：**REJECTED**——alias 可让同一 canonical
  provider route 在一 turn 重试；必须按 canonical tuple fail-loud。

## 12. Migration, compatibility, and rollback

- `MIG-001` — 替换事务 = §3.3：acceptance 时 NEW 同时 whole-supersede main
  active `AGENT_CORE_CHATGPT_SUBSCRIPTION_PROVIDER_V1` 与 current
  `AGENT_CORE_CHATGPT_SUBSCRIPTION_TARGET_PROXY_SEAM_V1`，原子写入双方 backlink；
  PR #60 无任何 lifecycle mutation。
- `MIG-002` — PR 序列（冻结）：(1) PR #70 review → mayf3 对 exact final head
  acceptance 时执行 §3.3 → final-head recheck；(2) PR #60 关闭为
  `ABANDONED_UNMERGED_CANDIDATE` 且永不 merge；(3) 后续是否 merge PR #70 不在
  本轮授权内。本轮仅普通 fast-forward 更新 PR #70，不 merge。
- `MIG-003` — Carry-over（直接从 main active authority 与独立 seam authority
  吸收）：harness pin（CTR-011）；dsh-codex exact pin；credential ownership /
  OAuth operator-interactive / 0600-0700 / 不共享 `~/.codex/auth.json`
  （CTR-010）；其他 Agent 零变化（CTR-012）；SILENT_FALLBACK = FORBIDDEN
  （泛化为 CTR-008）；no silent success with wrong provider；PROXY_SEAM_V1
  本轮 bytes 不变、acceptance 时 whole-supersede，其完整安全契约由
  CTR-010/014 接管；session 跨 provider resume 诚实边界（CTR-006）。
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
  implementation 轮前置。
- `Q-3` — Luna 就绪轮（provisioning + operator 交互式 OAuth 到新 Home）
  的独立授权与执行时序：另行 dispatch。
- `Q-4`（实现轮开放缝，非 Owner 决策）— turn-local fallback 与活 process
  的 reconciliation 机制（下一 turn 从 primary 开始时，上一 turn 的
  fallback-route 活 process 如何处置），由 implementation-authorizing
  authority 在 CTR-007 政策内冻结。

## 14. Final Output（revision 轮填写）

```text
TASK_NAME = 链路 修订执行
TASK_STATUS = REVISION_COMPLETE（proposed；READY_FOR_INDEPENDENT_REVIEW）

SPEC_ID = AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V1
REVISION_BASE = 4c2336c68181284e99f87f127aa176a8fa8b0d16（PR #70 expected head）
REPLACES_ON_ACCEPTANCE = [
  AGENT_CORE_CHATGPT_SUBSCRIPTION_PROVIDER_V1,
  AGENT_CORE_CHATGPT_SUBSCRIPTION_TARGET_PROXY_SEAM_V1
]
MAIN_ACTIVE_MODEL_ROUTE_AUTHORITY_REPLACED_DIRECTLY = YES
PROXY_SEAM_V1_SAFETY_CONTRACTS = FULLY_ABSORBED_BY_CTR_010_AND_CTR_014
PR60_DISPOSITION = ABANDONED_UNMERGED_CANDIDATE
PR60_ACTIVE_AUTHORITY = NO
PR70_SUPERSEDES_PR60 = NO
PR60_MUST_CLOSE = YES
PR60_MUST_NOT_MERGE = YES
PR60_LIFECYCLE_STATE_IN_PR70 = CURRENT_MAIN_RESTORED

ORDERED_CONFIGURABLE_ROUTE_CHAIN = REQUIRED
SINGLE_FALLBACK_ONLY = REJECTED
ROUTE_ORDER_HARDCODED_IN_CODE = FORBIDDEN
ROUTE_ORDER_AUTHORITY = agent-model-overrides.json version 2 ONLY
SCHEDULER_JOB_ROUTE_POLICY = INHERIT_AGENT_CHAIN_ONLY
JOB_OR_REQUEST_EMBEDDED_FALLBACKS = FORBIDDEN
FUTURE_JOB_SPECIFIC_CHAIN = SEPARATE_AUTHORITY_REQUIRED

ROUTE_CHAIN = [primary] ∪ fallbacks（ordered、finite、config-owned）
FALLBACKS_EMPTY = STRICT
TURN_SNAPSHOT = IMMUTABLE_AT_TURN_START
OUTCOME_UNKNOWN = STOP_CHAIN
ONE_LOGICAL_TURN = REQUIRED

CANONICAL_ROUTE_IDENTITY = provider + model + plugin + pluginVersion +
  credentialReadiness reference + canonical providerEnv
ROUTE_REF_DUPLICATE = FAIL_LOUD
CANONICAL_ALIAS_DUPLICATE = FAIL_LOUD
CANONICAL_ROUTE_ATTEMPT_LIMIT = ONCE_PER_TURN

PROVIDER_ENV = OPTIONAL_CLOSED_OBJECT
PROVIDER_ENV_KEYS = HTTP_PROXY + HTTPS_PROXY + NO_PROXY + NODE_USE_ENV_PROXY
PROVIDER_ENV_VALUE_TYPES = ALL_STRING
NODE_USE_ENV_PROXY = "1"
PROVIDER_ENV_EXTRA_KEYS = FORBIDDEN
PROVIDER_ENV_IS_REFERENCE = NO
RAW_CREDENTIAL_IN_CONFIG = FORBIDDEN

MAX_CONFIGURED_ROUTES = 4（PROPOSED；acceptance 时由 mayf3 明确确认）
MAX_ROUTE_ATTEMPTS = ROUTE_CHAIN.length（≤ MAX_CONFIGURED_ROUTES）
MAX_FALLBACK_ATTEMPTS = ROUTE_CHAIN.length - 1

SAFE_HOP_GATE = PROVEN_NO_ADMISSION + 封闭四类白名单
LOUD_JOURNAL = REQUIRED
SPEC_STATUS = proposed
implementation_authority = none
production_apply_authority = none

PRODUCT_CODE_CHANGE = NONE
CREDENTIAL_CHANGE = NONE
PRODUCTION_CHANGE = NONE
DEPLOYMENT = NONE
MERGE = NO
PR_UPDATE = ORDINARY_FAST_FORWARD_ONLY

NEXT_TASK = 链路 审计
```

---

## 15. Final Output — Acceptance finalize（2026-08-25；链路 采纳执行轮填写）

```text
TASK_NAME = 链路 采纳执行
TASK_STATUS = ACCEPTANCE_TRANSACTION_COMPLETE（§3.3 已原子执行）

SPEC_ID = AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V1
accepted_reviewed_head = ee13cb224660416c9044203610b93cb8f13873bb
ACCEPTANCE_AUDIT = PASS
ACCEPTANCE_AUDIT_BLOCKER_COUNT = 0

OWNER_DECISION_Q1 = MAX_CONFIGURED_ROUTES = 4（acceptance 时批准冻结；
  后续变更走本 Spec 自身 amendment，DEC-008 / Q-1）

TRANSACTION（= §3.3 冻结形态，一次性 docs-only，原子单 commit）：
  NEW.status = accepted
  NEW.supersedes = [AGENT_CORE_CHATGPT_SUBSCRIPTION_PROVIDER_V1,
                    AGENT_CORE_CHATGPT_SUBSCRIPTION_TARGET_PROXY_SEAM_V1]
  PROVIDER_V1.status = superseded；superseded_by = 本 Spec
  PROXY_SEAM_V1.status = superseded；superseded_by = 本 Spec
  PR60_LIFECYCLE_MUTATION = NONE
  README_INDEX = NEW -> accepted/current；两份 main old authorities ->
    superseded/historical

CURRENT_MAIN_AT_TRANSACTION = b2965583892a7c6acd2c1c00ed3bda280da7c435
  （fresh fetch 2026-08-25；merge-tree current-base = CLEAN，exit 0，
  事务前核验）
PR60_STATE = CLOSED / UNMERGED（保持；ABANDONED_UNMERGED_CANDIDATE；
  PR70_SUPERSEDES_PR60 = NO）

implementation_authority = none（保持；实现须由独立
  implementation-authorizing authority 另行授予）
production_apply_authority = none（保持）

PRODUCT_CODE_CHANGE = NONE
CREDENTIAL_CHANGE = NONE
PRODUCTION_CHANGE = NONE
DEPLOYMENT = NONE
MERGE = NO（PR #70 保持 OPEN；是否 merge 不在本轮授权内，MIG-002）
PR_UPDATE = ORDINARY_FAST_FORWARD_ONLY（普通提交追加于 ee13cb2 之上，分支 ref 快进更新）

NEXT_TASK = 链路 采纳审计
```

---

## Amendment 1（2026-08-26）— Builtin Route Kind（routeKind = builtin | subscription）

> AMENDMENT_STATUS = **proposed**（authoring 2026-08-26，任务「链路 内建路由修订」；
> awaiting independent review；Draft PR，不 merge、不改产品代码、不写配置、
> 不配置 Credential、不触碰 production）。
> **Amendment 形式依据**：`.agents/README.md` standing order 6（「scope 需要
> 澄清/纠正但方向未变，走 AMEND」）+ 本 Spec 自身冻结的变更路径（DEC-008
> 「后续变更走本 Spec 自身 amendment」、CTR-004「分类修订须走本 Spec
> amendment」）+ accepted-Spec in-place amendment 先例
> （`AGENT_CORE_CHATGPT_SUBSCRIPTION_PROVIDER_V1` Amendment 2：基础正文逐字
> 保留，Amendment 节显式 supersede 特定冻结值，独立评审 + acceptance
> finalize 后生效）。**方向未变**：ordered configurable route chain、
> config-owned 顺序、全部 gate/STOP/journal/隔离 ruling 逐字保持；本
> Amendment 只修正 route schema 的 plugin 必填条款并关闭 Q-2，因此不走
> whole-authority SUPERSEDE（ALT-A1-001）。
> **生效条件**：本 Amendment 经 independent review PASS 并由 mayf3 acceptance
> finalize（Amendment 节内记录 provenance）。生效前，基础正文的
> plugin-必填 schema 仍是现行权威，实现按其执行。

### A1.0 新证据与冲突陈述（Owner 给定事实，原样引用，无需重做）

```text
EVIDENCE_A1_1  zai/glm-5.3 已在生产同款环境受控探针 PASS（NEW_EVIDENCE，
               关闭基础正文 Q-2 / CLM-005 的 zai tuple 待核实项）
EVIDENCE_A1_2  ZAI 是 Harness 内建 provider（无 plugin 承载需求）
EVIDENCE_A1_3  不存在真实 dsh-zai npm 插件
EVIDENCE_A1_4  不得使用 dsh-codex 作为虚假 carrier plugin（fake plugin tuple
               = 伪造配置事实，违反本 Spec「字段值必须真实」边界）
```

作者侧只读核实（2026-08-26，production-same harness checkout，均只读）：

- Harness 的 pi-ai adapter（`@deepseek-ai/dsh-llm-pi-ai`，内嵌
  `@earendil-works/pi-ai@0.82.1`）`dist/providers/zai.js` 存在且经
  `dist/providers/all.js` 的 `builtinProviders()` 注册（`zaiProvider()`）；
  其 auth 方法为 `apiKey: envApiKeyAuth("Z.AI API key", ["ZAI_API_KEY"])`
  ——即 ZAI 以 API-key 内建 provider 形态随 harness 携带，**不经任何
  dsh plugin 安装/解析路径**（对照：Luna 的 `openai-codex` OAuth 形态必须
  由 `dsh-codex@0.2.3` plugin 承载）。
- vendored pi-ai catalog 数据（`data/zai.json`）当前列出 glm-4.5-air /
  glm-4.7 / glm-5-turbo / glm-5.1 / glm-5.2 / glm-5v-turbo；glm-5.3 不在
  auto-generated catalog 内——pi-ai 的 catalog 机制允许条目级 model 声明
  覆盖/扩展，且 zai/glm-5.3 已有生产执行记录（基础正文 STATE-003）与本
  Amendment EVIDENCE_A1_1 的受控探针 PASS。此差异不构成本 Amendment 的
  阻塞项，如实登记。
- 冲突坐实（current main `c52bd1c`，PR #76 实现已合并）：
  `packages/production-runtime/src/model-overrides.js:313-318` 强制每个
  routeCatalog entry 精确包含 `credentialReadiness/model/plugin/
  pluginVersion/provider`（plugin/pluginVersion 必填），`:230-243`
  `catalogCanonicalIdentity` 六字段 canonical form 含 plugin/pluginVersion。
  在该 schema 下，初始目标链的 glm53 route **不可合法表达**——要么填入
  不存在的 dsh-zai 插件（伪造），要么挪用 dsh-codex 作 fake carrier
  （EVIDENCE_A1_4 禁止）。这是 accepted authority 与新证据之间的
  contract gap，按 governance §10 走本 docs-only 修订。

### A1.1 被 supersede 的基础正文条款（精确清单，其余逐字保持）

本 Amendment 显式 supersede 基础正文以下条款中「plugin/pluginVersion 对
每 route 必填」的语义，且仅此语义：

| 基础正文位置 | 原语义 | Amendment 后语义 |
|---|---|---|
| §2.1 schema（route entry 字段表） | plugin/pluginVersion 为每 route 必填 non-empty string | 由 A1.2 routeKind 条件化字段集取代 |
| §2.2「每 route 必须精确包含 provider、model、plugin、pluginVersion、credentialReadiness」 | 五字段一律必填 | 由 A1.2 取代（routeKind + provider + model + credentialReadiness 恒必填；plugin/pluginVersion 按 routeKind） |
| §2.2 / CTR-003 `CANONICAL_ROUTE_IDENTITY` 六字段 tuple | provider/model/plugin/pluginVersion/credentialReadiness/canonical providerEnv | 由 A1.3 七字段 tuple 取代（增 routeKind；plugin/pluginVersion 规范化为 or-ABSENT） |
| CTR-001 routeCatalog 字段列举 | 同 §2.1 | 同 A1.2 |
| §2.4 初始目标配置中 glm53 的 plugin/pluginVersion/credentialReadiness「由 Q-2 核实后冻结」 | 开放待决 | 由 A1.4 冻结关闭（Q-2 CLOSED） |
| §13 Q-2 / §6 CLM-005 | OPEN（zai tuple 待核实） | CLOSED（EVIDENCE_A1_1..A1_4 + A1.4 冻结 tuple） |

明确**不在** supersede 范围（逐字保持，不得借本 Amendment 重开）：
§1 全部 Owner 裁决；§2.2 其余校验语义（routeRef 去重、引用完整性、
duplicate-key 扫描、version=2、激活范围恰好 `{agt_cto-agent}`、静态配置
fail-loud / controlled restart）；§2.3 hard bound 与
`MAX_CONFIGURED_ROUTES = 4`（OWNER_DECISION 已冻结）；§2.4 的
`fallbacks: ["route-B","route-C","luna"]` 可表达性；§3 authority lineage
（supersedes 两份旧 authority、PR #60 处置全量保持）；§4/§5 历史
observations；CTR-002/004/005/006/007/008/009/010/012/013/014 全文；
CTR-011（harness pin `0.1.0-rc.8 @ 514ab7b…` 与 dsh-codex@0.2.3 exact
pin——其适用范围由 A1.5 明确为 subscription route，pin 值本身不变）；
DEC-001..013（除 DEC-009 中「Luna 唯一 fallback + dsh-codex@0.2.3 承载」
保持不变外，无任何重开）；§10 ACC 框架（增补见 A1.6）；§11 ALT 全部
 disposition；§12 MIG/ROLLBACK。

### A1.2 修订 schema：routeKind（冻结）

`routeCatalog.<routeRef>` 的合法字段集由 routeKind 决定（closed enum，
其余任何 routeKind 值 = malformed → startup fail-loud）：

```jsonc
{
  "version": 2,
  "routeCatalog": {
    "<routeRef>": {
      "routeKind":          "builtin" | "subscription",   // 必填，closed enum
      // —— 恒必填（两种 routeKind 相同）——
      "provider":            "<non-empty string>",
      "model":               "<non-empty string>",
      "credentialReadiness": "<non-empty readiness reference；绝不含 raw credential>",
      // —— optional（两种 routeKind 相同；语义不变，CTR-010/CTR-014 全文保持）——
      "providerEnv": { /* 四键 closed object，整个字段可缺省 */ },
      // —— 仅 subscription route 必填 ——
      "plugin":              "<non-empty string>",         // builtin: ABSENT（FORBIDDEN）
      "pluginVersion":       "<exact version pin string>"  // builtin: ABSENT（FORBIDDEN）
    }
  },
  "overrides": { /* 不变：primary + fallbacks[] */ }
}
```

校验规则（冻结，全部 startup fail-loud）：

- `routeKind` 缺失 / 非 string / 非 `builtin`|`subscription` → malformed；
- **builtin route**：`plugin` 或 `pluginVersion` 键**存在**（无论值为何，
  含 null/空串）→ malformed（ABSENT 是唯一合法形态；FORBIDDEN）；
- **subscription route**：`plugin` 或 `pluginVersion` 缺失 / 空 / 非
  string → malformed；`pluginVersion` 必须是 exact pin（沿用基础正文
  语义：禁 `^`/`~` 范围；命名 dsh-codex 的 route 必须精确 `0.2.3`，
  CTR-011 不变）；
- 其余全部校验（exact keys、duplicate-key 扫描、引用完整性、去重、
  链长 bound、version、激活范围、providerEnv grammar/redaction）逐字
  按基础正文执行；
- `overrides`/`primary`/`fallbacks[]`/`ROUTE_CHAIN` 语义零变化。

### A1.3 CANONICAL_ROUTE_IDENTITY（七字段，取代六字段）

```text
CANONICAL_ROUTE_IDENTITY =
  routeKind + provider + model + plugin-or-ABSENT + pluginVersion-or-ABSENT
  + credentialReadiness reference + canonical providerEnv
```

- `routeKind` 参与 canonical tuple（builtin 与 subscription 永不视为同一
  route，即便 provider/model 等其余字段相同）；
- builtin route 的 plugin/pluginVersion 规范化为显式 `ABSENT`；
  subscription route 保持精确 string 值——与基础正文 providerEnv 缺省
  规范化为 `ABSENT` 同一确定性原则，纯结构规范化，不丢字段；
- 两个不同 routeRef 解析为相同 canonical tuple → startup fail-loud；
  每 canonical route 每 turn ATTEMPTED_AT_MOST_ONCE——全部不变。

### A1.4 初始链冻结 tuple（Q-2 关闭；Q-3 保持开放）

```jsonc
{
  "version": 2,
  "routeCatalog": {
    "glm53": {
      "routeKind": "builtin",
      "provider": "zai",
      "model": "glm-5.3",
      "plugin": /* ABSENT — FORBIDDEN on builtin */,
      "pluginVersion": /* ABSENT — FORBIDDEN on builtin */,
      "credentialReadiness": "zai-api-key-home",
      "providerEnv": /* ABSENT */
    },
    "luna": {
      "routeKind": "subscription",
      "provider": "openai-codex",
      "model": "gpt-5.6-luna",
      "plugin": "dsh-codex",
      "pluginVersion": "0.2.3",
      "credentialReadiness": "luna-oauth-home",
      "providerEnv": { /* 四键 closed object；具体值属部署事实，见下行 */ }
    }
  },
  "overrides": {
    "agt_cto-agent": { "model": { "primary": "glm53", "fallbacks": ["luna"] } }
  }
}
```

- glm53（builtin）：`credentialReadiness = zai-api-key-home` 冻结为
  readiness reference（API-key 形态，对应 pi-ai `ZAI_API_KEY` env auth
  seam；raw key 绝不进配置，CTR-010 不变）；`providerEnv = ABSENT`。
- luna（subscription）：plugin/pluginVersion 沿用基础正文冻结值
  （dsh-codex / 0.2.3 exact）；`providerEnv` 为四键 closed object 的
  **形态**在此冻结（键集与 grammar 按 CTR-010/CTR-014 全文）；四值的
  具体内容属部署事实，与 Luna credential 就绪（Q-3，provisioning +
  operator 交互式 OAuth）同属独立部署轮，**本 Amendment 不写入任何
  配置、不授权激活**（`production_apply_authority = none` 不变）。
- `MAX_CONFIGURED_ROUTES = 4`、链形态 primary + fallbacks[]、
  `fallbacks: []` = strict——全部不变。

### A1.5 plugin pin 的适用范围（明确，不改值）

- `dsh-codex@0.2.3` exact pin（CTR-011）：只对 `routeKind = subscription`
  且 `plugin = dsh-codex` 的 route 生效；builtin route 无 plugin 字段，
  自然无 plugin pin 校验。
- Harness pin（`deepseek-harness 0.1.0-rc.8 @ 514ab7b…`，CTR-011）：
  Agent 进程级不变量，与 routeKind 无关，逐字保持；mismatch = fail-loud
  且**不是** fallback 触发类（不在 CTR-004 白名单）——不变。
- 禁止事项（冻结为 Amendment 级 ALT，见 A1.7）：为 builtin route 伪造
  dsh-zai 插件条目；用 dsh-codex 作 builtin route 的 fake carrier；
  在 builtin route 上填任何 plugin/pluginVersion 值。

### A1.6 实现影响与排序（本轮 DOCS ONLY）

- current main（`c52bd1c`）的 v2 loader 仍按基础正文 plugin-必填 schema
  校验（`model-overrides.js:313-325`）；本 Amendment 生效后，实现需要
  一轮**后续 implementation round**（在子权威
  `AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_IMPL_V1`（含其 Amendment 1）授权内）
  把 loader 校验、canonical identity 与 processConfig.subscription 构造
  对齐 A1.2/A1.3（builtin route 不构造 subscription block）。本 Amendment
  轮不改任何产品代码。
- 生产现状不受影响：生产 root 无 override 文件（OBS-003 / OBS-IMPL-010），
  链代码 inert；本 Amendment 不写配置、不重启、不部署。
- 验收增补（在 §10 ACC 框架上追加，编号接续）：
  - `ACC-016` routeKind 校验族：缺 routeKind / 非法枚举值 / builtin 携带
    plugin 或 pluginVersion（含 null/空值）⇒ startup fail-loud；subscription
    缺 plugin/pluginVersion ⇒ fail-loud；合法 builtin route 加载成功且
    resolved processConfig 无 subscription block；
  - `ACC-017` canonical identity v2：builtin 与 subscription 即便
    provider/model 相同也不坍缩为同一 canonical route；builtin 的
    plugin/pluginVersion 规范化为 ABSENT 参与 alias 去重；
  - `ACC-018` 初始链 tuple：A1.4 的 glm53/luna 配置通过校验；dsh-codex
    pin 校验只作用于 luna（subscription）route；
  - `ACC-019` 复用 gate 身份：DEC-IMPL-004 的 route 身份 =
    A1.3 canonical identity（routeKind 参与；builtin process 不与
    subscription process 互相复用）。

### A1.7 Alternatives（Amendment 级）

- `ALT-A1-001` whole-authority SUPERSEDE 另立 V2 Spec：**REJECTED**——
  方向未变，仅 schema 纠错；整权威替换会把 15 条 ACC / 14 条 CTR /
  13 条 DEC 全部重开重冻，违反「不得重开其他已冻结决策」与最窄合法
  形式要求。
- `ALT-A1-002` 保留 plugin 必填、为 zai 造 dsh-zai 假插件：**REJECTED /
  FORBIDDEN**——不存在真实 dsh-zai npm 插件（EVIDENCE_A1_3），伪造
  插件 tuple 违反字段真实性。
- `ALT-A1-003` 保留 plugin 必填、glm53 填 dsh-codex 作 carrier：
  **REJECTED / FORBIDDEN**——fake carrier（EVIDENCE_A1_4）；dsh-codex
  是 openai-codex OAuth 的承载插件，与 zai API-key 路径无关，会把
  plugin pin / provisioning / credential 语义错误耦合到 builtin route。
- `ALT-A1-004` 把 ZAI 做成需要插件的自定义 provider：**REJECTED**——
  ZAI 已是 harness 内建 provider（A1.0 核实），另造承载层 = 无依据的
  新机制。
- `ALT-A1-005` 借本 Amendment 调整链顺序 / bound / gate / Scheduler
  政策：**FORBIDDEN**——超出本 Amendment 范围（A1.1 清单外一律不动）。

### A1.8 Final Output（Amendment 1 authoring 轮填写）

```text
TASK_NAME = 链路 内建路由修订
TASK_STATUS = AUTHORING_COMPLETE（proposed；READY_FOR_INDEPENDENT_REVIEW）

SPEC_ID = AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V1
AMENDMENT_ID = AMENDMENT_1_BUILTIN_ROUTE_KIND
AMENDMENT_STATUS = proposed（awaiting independent review；Draft PR 不 merge）
AMENDMENT_FORM = IN_PLACE_APPENDED_AMENDMENT（基础正文 §1–§15 逐字保留）

NEW_EVIDENCE =
  zai/glm-5.3 生产同款环境受控探针 PASS
  ZAI = Harness 内建 provider（pi-ai builtinProviders；apiKey/ZAI_API_KEY）
  无真实 dsh-zai npm 插件
  dsh-codex fake carrier = FORBIDDEN

ROUTE_KIND = builtin | subscription（closed enum）
BUILTIN_PLUGIN_FIELDS = ABSENT / FORBIDDEN
SUBSCRIPTION_PLUGIN_FIELDS = REQUIRED + EXACT_PIN
CANONICAL_ROUTE_IDENTITY = routeKind + provider + model +
  plugin-or-ABSENT + pluginVersion-or-ABSENT + credentialReadiness +
  canonical providerEnv

INITIAL_CHAIN（policy target；本轮不写入）=
  glm53: builtin / zai / glm-5.3 / plugin ABSENT / pluginVersion ABSENT /
         zai-api-key-home / providerEnv ABSENT
  luna:  subscription / openai-codex / gpt-5.6-luna / dsh-codex / 0.2.3 /
         luna-oauth-home / providerEnv 四键 closed object（值属部署轮）

PRESERVED（不重开）=
  MAX_CONFIGURED_ROUTES = 4；primary + fallbacks[]；STOP_CHAIN（九类封闭集）；
  ONE_LOGICAL_TURN；SCHEDULER_JOB_ROUTE_POLICY = INHERIT_AGENT_CHAIN_ONLY；
  ROUTE_ORDER_HARDCODED_IN_CODE = FORBIDDEN；四类 hop 白名单（CTR-004）；
  journal/redaction（CTR-008）；credential/providerEnv 契约（CTR-010/014）；
  harness pin 0.1.0-rc.8 @ 514ab7b + dsh-codex@0.2.3 exact（值不变，范围
  = subscription route）；fleet 隔离（CTR-012）；authority lineage 与
  PR #60 处置

Q_2_STATUS = CLOSED（本 Amendment A1.4）
Q_3_STATUS = OPEN（Luna 就绪轮，独立部署轮，不 gate 本 Amendment）
IMPLEMENTATION_DELTA = 后续 implementation round（子权威 + 其 Amendment 1
  授权内；本轮零代码改动）

PRODUCT_CODE_CHANGE = NONE
CREDENTIAL_CHANGE = NONE
PRODUCTION_CHANGE = NONE
DEPLOYMENT = NONE
MERGE = NO（Draft PR）

NEXT_TASK = 链路 内建路由审计
```
