---
spec_id: DEFAULT_MODEL_ROUTING_CONFIG_V1
status: accepted
accepted_by: mayf3
accepted_date: 2026-09-14
accepted_reviewed_spec_commit: 90e423a357648d55dd1398741d3a148ed5c7f001
acceptance_authority_basis: >-
  Owner exact-head acceptance 2026-09-14 (PR #284 review thread): the exact
  reviewed bytes at 90e423a are accepted; any later drift voids this
  acceptance. Semantic direction was pre-authorized by the Owner directive of
  the same date (configuration-driven default model routing with canonical
  built-in default GPT Luna; OpenCode Go explicit-route only) plus the
  standing Owner ruling 2026-09-10 (retire the oc-go plan; default Luna
  fleet-wide). Independent proposed-Head review at the implementation stack
  (a38077a) recorded VERDICT = ACCEPT / LOAD_BEARING_GAPS = 0 /
  SPEC_COMPLIANCE = PASS. Per AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1 §2.3 this
  finalization modifies lifecycle/acceptance metadata ONLY; substantive
  content at 90e423a is unchanged.
proposed_date: 2026-09-14
proposed_by: agt_cto-agent (coding agent, DEFAULT_MODEL_ROUTING_CONFIG_V1 goal lane)
semantic_direction_authority: >-
  Owner directive 2026-09-14 (DEFAULT_MODEL_ROUTING_CONFIG_V1 goal order:
  default route must be configuration-driven with canonical built-in default
  GPT Luna; OpenCode Go stays an explicit selectable route only) + standing
  Owner ruling 2026-09-10 (retire the oc-go plan dependency; target = default
  Luna fleet-wide). Per AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1 §2.3 a chat
  directive authorizes DIRECTION and authoring only — exact-bytes acceptance
  is the Owner's act at an exact reviewed head (G2: the accepted Spec must
  exist on the implementation PR base; same-PR self-governing is forbidden).
date: 2026-09-14
type: implementation-spec
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
governed_by:
  - AGENT_CORE_FLEET_SHARED_CODEX_AUTH_V3
  - AGENT_CORE_FLEET_SHARED_CODEX_AUTH_ACTIVATION_V2
  - AGENT_PROCESS_LIFECYCLE_HARDENING_V2
  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0
external_authorities: []
supersedes: []
superseded_by: null
governing_spec_unmodified: YES (this Spec amends the no-config default semantics NORMATIVE side; no existing Spec file bytes are changed)
base_head: c6c3153a72611468444d7ac16fb9fa7ee8e93326
---

# Default Model Routing Config V1 — canonical built-in default = GPT Luna, configuration-driven

> Owner 问题：本地 DSH / Agent Core 启动 Agent 时，OpenCode Go 仍被硬编码为隐式
> default model route。目标语义：
>
> ```text
> explicit per-request / per-session override
>   > explicit agent/profile config
>   > runtime/global config
>   > canonical built-in default = GPT Luna
> ```
>
> OpenCode Go 保留为可选 explicit route/provider，不再是隐式 fallback/default。

## §1 现状事实（fresh origin/main 9627753 census，本 Spec 的 evidence basis）

In-src（非 test、非 scripts）硬编码 `opencode-go` / `deepseek-v4-flash` fallback 全集：

| # | 位置 | 现状 |
|---|---|---|
| H1 | `packages/production-runtime/src/compose.js:227-228` | `opts.globalRoute ?? { provider: env.DSH_AGENT_PROVIDER ?? 'opencode-go', model: env.DSH_AGENT_MODEL ?? 'deepseek-v4-flash' }` — production 组装的 global（env-free）默认 |
| H2 | `packages/agent-router/src/process/agent-process.js:61-62` | `provider ?? env.DSH_AGENT_PROVIDER ?? 'opencode-go'`（model 同构）— 非生产调用面（tests / standalone router）构造默认 |
| H3 | `packages/agent-provisioning/src/index.js:296-303`（MINIMAL_SETTINGS，line 431 写入） | fresh agent home 无 settings source 时写入 `agent-default-model: opencode-go/deepseek-v4-flash`（child 侧默认；Feishu Agent 与 local Agent 创建路径共用 provisionAgentHome） |
| H4 | `packages/demo-server/src/index.js:97-98` | local/demo server 默认 `provider='opencode-go'; model='deepseek-v4-flash'`（initialize params 可覆盖） |

定性结论（对 Owner A–E 问题的裁定）：

- **生产现态的有效默认 = D（launchd plist 全局 env 注入 `DSH_AGENT_PROVIDER=oc-go` /
  `DSH_AGENT_MODEL=deepseek-v4-flash`，explicit runtime config）+ A（同一字面量同时是
  H1/H2/H3/H4 的 source 内置 fallback）**。即：env 存在时走 env；env 缺席时走代码内置
  OpenCode Go。B 不成立（生产 config `agent-model-overrides.json` 从不承载 global
  default，只承载 per-agent chain）；C 不成立（Feishu 路径无独立默认，共用 H1+H3）；
  E 表述不完整（OpenCode Go 不只是 fallback chain 最后一层——它同时是 A，四处独立字面量）。
- route chain 机制本身（`agent-model-overrides.json` v3 + `resolveRouteChain`）**不含**任何
  路由内容默认：missing file / 无 override 条目 = legacy passthrough（H1 的 globalRoute），
  与 ROUTE_ORDER_HARDCODED_IN_CODE=FORBIDDEN 一致。本 Spec 不动该机制。
- 现有 tests 全部显式配置（`GLOBAL={provider:'oc-go',...}` fixture、initialize params、
  env 设定），**没有任何 test 断言 H1/H2 的 `'opencode-go'` fallback 字面量**；fixtures 把
  oc-go 当 canonical default 的是 explicit-config 用法，不在本 Spec 修正范围。
- scripts/*.mjs verify drivers 携带各自的 `env ?? 'opencode-go'` 默认（ops tooling，每个
  属于各自 goal 的验证代码）→ §7 残留清单，不在本轮修改。

## §2 Canonical default 路由（复用既有 identifier，零新造）

GPT Luna 的 canonical 路由在系统内已冻结存在（superseded
`AGENT_CORE_CHATGPT_SUBSCRIPTION_PROVIDER_V1` 冻结 `PROVIDER=openai-codex`,
`MODEL=gpt-5.6-luna`；现行 `AGENT_CORE_FLEET_SHARED_CODEX_AUTH_V3` 家族与
`AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V1` §OBS 沿用；route chain fixture/catalog 实际使用）：

```text
CANONICAL_DEFAULT_MODEL_ROUTE_ID = openai-codex/gpt-5.6-luna
CANONICAL_DEFAULT_MODEL_ROUTE    = { provider: 'openai-codex', model: 'gpt-5.6-luna' }
```

built-in default 必须是 **完整可解析 route**：与 routeCatalog subscription 路由同构，
复用 `CHATGPT_SUBSCRIPTION_V1` 冻结身份（`dsh-codex@0.2.3` exact pin + canonical
credentialFile + sourceCommit/artifactSha256/dshVersion/dshCommit），使零配置 Agent 在
provision 时获得 dsh-codex plugin + shared canonical credential 挂载（与 per-agent Luna
override 同一机制，DEC-IMPL-011 语义不变：只有 subscription route 携带 provisioning
block）。canonical credential / plugin artifact 缺席 ⇒ 按既有 boundary **fail loud**
（credential_missing 等），绝不静默回落 oc-go——这与
`AGENT_CORE_CHATGPT_SUBSCRIPTION_PROVIDER_V1` §"no silent fallback" 语义一致。

**DEFAULT_MODEL_CHANGED=NO 的历史冻结边界由本 Spec 显式解除**：该边界属于 superseded
单 Agent 接入帧（ENABLED_AGENTS=exactly 1 时代）；Owner 2026-09-10 裁定
（目标=全部默认 Luna）+ 2026-09-14 directive 构成 NEW_EVIDENCE 与显式 Owner 授权。

## §3 配置优先级（closed；无新增层级）

```text
1. request/session override   （现状已存在：demo-server initialize params.provider/model；
                                 Router turn 级无 per-turn route —— process-start config
                                 语义不变，不为本 Goal 新造层级）
2. agent/profile override     （agent-model-overrides.json overrides.<agentId>.model，
                                 现状最高 spawn-config 层，不变）
3. runtime/global config      （opts.globalRoute [composition config]
                                 > env DSH_AGENT_PROVIDER / DSH_AGENT_MODEL 对）
4. built-in default           （openai-codex/gpt-5.6-luna subscription route，本 Spec 新语义）
```

- Core invariant：**explicit configuration always wins；absence of explicit
  configuration ⇒ GPT Luna。**
- env 部分设置（仅设 PROVIDER 或仅设 MODEL 一个）：env 层视为激活，缺失的姊妹键取
  canonical default 的对应姊妹值（不新增 fail 模式；plist 生产形态永远成对设置）。
- built-in default 是**唯一的** source 内置路由内容：H1/H2/H3/H4 四处字面量全部收敛到
  单一 source of truth（`agent-provisioning` 导出的 frozen 常量），禁止第二处出现
  路由内容字面量。

## §4 实现 delta（最小面）

| 文件 | 改动 |
|---|---|
| `packages/agent-provisioning/src/shared-codex.js` | 新增导出 `CANONICAL_DEFAULT_MODEL_ROUTE` + `CANONICAL_DEFAULT_MODEL_ROUTE_ID`（frozen；单一 source of truth） |
| `packages/production-runtime/src/model-overrides.js` | 导出 `canonicalDefaultGlobalRoute()`（= canonical route + 按 `CHATGPT_SUBSCRIPTION_V1` + env-conditional artifact 字段构造的 subscription block）；`passthroughRoute` / `resolve` 携带 `globalRoute.subscription`（absent 时字节等价旧形态） |
| `packages/production-runtime/src/compose.js` | globalRoute 解析改为三层（opts > env > builtin default），解析出处 source 记入启动日志一行：`global model route: <provider>/<model> (source=composition_config|runtime_env|builtin_default)`；`@param globalRoute` 文档同步（允许携带 subscription） |
| `packages/agent-router/src/process/agent-process.js` | H2 fallback 改引 `CANONICAL_DEFAULT_MODEL_ROUTE`（行为等价替换字面量） |
| `packages/agent-provisioning/src/index.js` | MINIMAL_SETTINGS 的 `agent-default-model` 块改为 canonical route（由常量构造）；保留 `llm-pi-ai.providers.opencode-go` 注册块（OpenCode Go 保持可选 explicit route；provider 注册 ≠ 路由选择）；copy-once 语义不变（既有 home 永不被改写） |
| `packages/demo-server/src/index.js` | H4 默认改引常量（行为等价替换字面量） |

不改动（explicit non-goals）：

- Router / route-chain executor / hop 分类 / STOP_CHAIN / retry-failover 语义 —— 零改动。
- OpenCode Go provider 本体（`env.js` 的 `OPENCODE_GO_API_KEY` credential 读取、
  MINIMAL_SETTINGS 的 provider 注册块）—— 保留为 explicit route 支持。
- Agent identity / workspace / lifecycle / spawn uid 模型 —— 零改动。
- `agent-model-overrides.json` schema（v3）与 loader 校验 —— 零改动（passthrough 仅
  透传 compose 层已构造的 subscription，不新增 schema 键）。
- scripts/*.mjs verify drivers —— §7 残留，不改。
- child 侧 DSH harness（外部 repo）—— 不涉及。

## §5 Observability（沿用既有面，不新建 telemetry）

- compose 启动一行：global route + source（`composition_config` / `runtime_env` /
  `builtin_default`）。
- 既有 `agent model route chain loaded for <agentId>: ...` 行继续承担 agent_config 层可见性。
- 既有 route-chain journal（`global:<provider>/<model>` label / routeRef）继续承担
  per-attempt 路由可见性。

## §6 验收（ACC；全部 focused node --test，生产 node v25.6.1）

- **ACC-D1（零配置）**：compose 无 opts.globalRoute、env 两键删除、无 override 文件 ⇒
  globalRoute = canonical Luna route + subscription block 在位（provision seam 收到
  subscription）+ 日志 `source=builtin_default`。
- **ACC-D2（runtime override）**：env 对设置 ⇒ env 路由生效、无 subscription、
  `source=runtime_env`；opts.globalRoute 与 env 并存 ⇒ opts 胜、
  `source=composition_config`。
- **ACC-D3（agent override / OpenCode Go explicit）**：override 条目 primary 指向
  opencode-go builtin 路由 ⇒ 该 Agent child 得 opencode-go，其余 Agent 得 built-in
  Luna default（explicit agent config 胜，OpenCode Go 保持可选）。
- **ACC-D4（provisioning 默认）**：fresh home（无 settings source）⇒ settings.yaml
  `agent-default-model: openai-codex/gpt-5.6-luna` 且 `providers.opencode-go` 注册块保留。
- **ACC-D5（request override）**：demo-server 无 initialize params ⇒ canonical 默认；
  params.provider/model ⇒ params 胜。
- **ACC-D6（非生产构造面）**：AgentProcess 无 provider/model 且 env 删除 ⇒ canonical
  默认。
- **ACC-D7（回归）**：既有 focused suites 全绿（agent-router / production-runtime /
  agent-provisioning / demo-server；现有 oc-go explicit fixtures 用法不受影响）。

## §7 残留清单（明确不在本轮修复）

- `scripts/*.mjs` verify drivers 的 `env ?? 'opencode-go'` 默认（各自 goal 的 ops
  tooling；如需统一由后续 goal 收敛）。
- `production-integration-v1-acceptance.mjs` / `trusted-cp-hardening-v1-verify.mjs` 的
  acceptance 固定 model 常量（acceptance fixture，非 runtime 默认）。
- 生产 launchd plist 的 `DSH_AGENT_PROVIDER/MODEL` 全局 env：**explicit runtime config，
  本 Spec 生效后生产行为不变**；切默认 Luna 的生产动作 = Owner 移除/改写该 env 对
  （独立 production apply，不在本实现 PR 内）。

## §8 Migration / rollback

- 生产行为在 plist env 存在期间逐字节不变。移除 env 后，下一次受控重启起零配置 Agent
  走 Luna（需要 canonical credential + plugin artifact 在位，缺失即 fail loud）。
- Rollback = 恢复 plist env 对（explicit config 永远胜）或回退二进制。
