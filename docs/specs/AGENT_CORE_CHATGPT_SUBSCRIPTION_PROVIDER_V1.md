---
spec_id: AGENT_CORE_CHATGPT_SUBSCRIPTION_PROVIDER_V1
status: proposed
---

# Agent Core ChatGPT Subscription Provider V1 — 单 Agent Luna 接入

> 性质：**Spec（SPEC ONLY — 本轮只冻结授权边界，不实现）** · 日期：2026-08-18
> 仓库：`mayf3/dsh-agent-core`
> 角色：ChatGPT Subscription Provider Spec Agent
>
> Owner Priority Update（2026-08-18）：用户主要手机飞书主入口的可用性是
> **P0_PRODUCT_USABILITY_BLOCKER**。目标是将已验证链路
> **ChatGPT Pro 订阅 → dsh-codex@0.2.3 → openai-codex / gpt-5.6-luna**
> 正式接入用户手机上主要使用的**唯一** Feishu Agent。
>
> 本 Spec 只冻结：integration layer、per-Agent opt-in、plugin/version pin、
> credential ownership、interactive OAuth、failure semantics、rollback、non-goals。
> **不扩大架构**：不新建 model router / credential service / fallback system /
> account pool / quota scheduler。实验事实（owner 已给定，无需重做）：
> `DSH_GPT56_CHATGPT_SUBSCRIPTION_ROUNDTRIP = PASS`、
> `USES_CHATGPT_SUBSCRIPTION_QUOTA = YES`、`USES_OPENAI_API_CREDITS = NO`、
> `MAIN_AGENT_GPT = YES`、`RESTART_PERSISTENCE_TEST = PASS`、
> `~/.codex/auth.json unchanged`、`KERNEL_CHANGE = NONE`。
> 不再在 /tmp 里做任何可行性实验。

---

## 0. 一句话

在**现有** per-Agent DSH_HOME / profile / provisioning 机制上，把唯一目标 Agent
的 per-Agent 默认模型 override 为 `openai-codex / gpt-5.6-luna`（ChatGPT 订阅
配额，插件 `dsh-codex@0.2.3` 承载），OAuth credential 由该 Agent 实体自有并经
operator 交互式登录落盘；其余 87 个 Agent、全局默认模型、Router / Session /
Kernel 语义全部不变。

---

## 1. 目标 Agent（只读证据，禁止按名称猜 ID）

目标由**当前 production 状态只读**确定，证据链：

| 项 | 值 | 证据 |
|---|---|---|
| TARGET_FEISHU_CONVERSATION | `feishu:oc_648db8f3df0ef0249b761ebb0b7a56ab`（group） | production bindings.json |
| TARGET_AGENT_ID | `agt_cto-agent`（技术研发总监） | 同上 binding.activeAgentId；registry agents.json |
| TARGET_SESSION | `main` | 同上 binding.activeSessionId |
| TARGET_PRIMARY_WORKSPACE | `/Users/yanfenma/.openclaw/groups/workspace-oc_648db8f3df0ef0249b761ebb0b7a56ab` | `~/.agent-core/primary-workspaces.json` |
| TARGET_DSH_HOME | `/Users/yanfenma/.agent-core/homes/agt_cto-agent`（persistent，现有） | 现网 live DSH 进程（lsof 实证） |
| CURRENT_PROVIDER / MODEL | `ollama / qwen3.8:27b-mtp-q4_K_M-64k`（本地量化模型） | `<DSH_HOME>/settings.yaml` agent-default-model |

「用户主要手机会话」的裁定依据：OpenClaw gateway 全量入站日志
（2026-06-28 → 2026-08-18 cutover 停机，6076/6084 条来自 owner 本人
`ou_eb5fa3…`）：`oc_648db8` 以 **716 条居全期第一**（1.5× 第二名），近 14 天
仍居前列，且 cutover 后当晚仍在使用——是使用频率最高、持续在用的手机主会话。
该会话当前挂在本地 27B 量化模型上，直接构成 owner 所述 usability blocker。

> 实现期若 owner 明确改指其他会话，仅替换本表 TARGET 三元组，其余语义不变。

---

## 2. Integration Layer（冻结）

```text
INTEGRATION_LAYER = DSH plugin layer（per-Agent DSH 进程内 provider 注册）
  dsh-codex@0.2.3 插件在目标 Agent 自己的 DSH 进程内注册 openai-codex provider，
  经 ChatGPT Pro 订阅配额完成模型调用（订阅认证，非 API key 计费）。
  不经过：Router / Broker / product-api / scheduler / kernel 的任何新路径。

CONFIG_SEAM = per-Agent `<DSH_HOME>/settings.yaml` 的 agent-default-model
  （现有 per-home 配置面；目标 Agent 改为 provider=openai-codex / model=gpt-5.6-luna）
  + `llm-pi-ai.providers` 中由插件贡献的 provider 注册。

PROVISIONING_SEAM = 现有 packages/agent-provisioning（provisionAgentHome）
  + 现有 per-Agent profile `profiles/agent-core-production/`
  （package.json bundles + cordis.patch.yml）追加 dsh-codex@0.2.3。
  不新建 provisioning 路径，不新建配置服务。
```

版本冻结（V1 唯一允许的组合）：

```text
DSH_VERSION = 0.1.0-rc.5
DSH_COMMIT  = a12bb03c6861969985f066bfbf0cb7e5dd5ac567   # 现网 checkout 已在此 commit
PLUGIN      = dsh-codex@0.2.3                             # 禁止 0.2.4 及任何其他版本
PROVIDER    = openai-codex
MODEL       = gpt-5.6-luna
```

不升级 DSH。不使用 dsh-codex@0.2.4。

---

## 3. Per-Agent Opt-In（冻结）

```text
ENABLED_AGENTS   = exactly 1 = { agt_cto-agent }
OPT_IN_MECHANISM = 仅该 Agent 的 per-Agent 配置生效（settings.yaml override + profile 行）
GLOBAL_ENABLEMENT = NO       # 不改全局默认、不改 operator ~/.dsh/settings.yaml 模板语义
DEFAULT_MODEL_CHANGED = NO   # 全局/其他 Agent 的 resolved model 一律不变
```

- 其他 87 个 Agent 的 provider/model **不得有任何变化**（验收项 14）。
- 不引入新的 enablement 配置体系；「opt-in」就是该 Agent 自己的 per-home 配置事实。

---

## 4. Credential Ownership & Interactive OAuth（冻结）

```text
CREDENTIAL_OWNER         = Agent 实体（agt_cto-agent）自有，落在其 persistent DSH_HOME 内
CREDENTIAL_LOCATION      = <TARGET_DSH_HOME> 内（插件订阅认证文件；目录内、0600）
OAUTH_BOOTSTRAP_MODE     = OPERATOR_INTERACTIVE
                          # 必须在目标 Agent 的正式持久化 DSH_HOME 中重新登录，
                          # 由 operator 亲自交互完成；一次登录，落盘持久。
```

禁止（全部为硬边界）：

- 复制 /tmp 实验 credential；
- 读取或修改 `~/.codex/auth.json`（实现全程 hash/mtime 不变）；
- 使用 `OPENAI_API_KEY` 或任何 OpenAI API credits（订阅配额唯一）；
- token 经 env / argv / prompt / Feishu 消息传递；
- token 写日志；
- refresh token 跨 Agent 复制（其他 Agent 永远拿不到该 credential）。

现有 `<DSH_HOME>/.credentials.yaml`（env-key 型）对其他 provider 维持原状；
本 Spec 不新建 credential service / secret broker。

---

## 5. Failure Semantics（冻结）

- 插件加载失败 / provider 不可用 / OAuth 过期或无效：目标 Agent 的该 turn
  **fail loud**（错误经现有回复通道如实上抛），**无任何自动 fallback**
  （不回退 ollama、不回退 opencode-go、不换模型、不换账号）。
- 故障影响面 = 仅目标 Agent；其他 Agent、Router、Binding、scheduler 不受影响。
- 恢复 = operator 重新交互式登录（同 §4）或执行 §6 rollback；无自动重试账号池。

---

## 6. Rollback（冻结，机械可执行）

```text
ROLLBACK =
  1) disable 目标 Agent Luna override：
     <DSH_HOME>/settings.yaml agent-default-model
       恢复为 provider=ollama / model=qwen3.8:27b-mtp-q4_K_M-64k（§1 现值）
  2) 重启目标 Agent 进程（完全停止 → 重新启动）
  3) 验证 resolved provider/model 回到 ollama / qwen3.8:27b-mtp-q4_K_M-64k
```

- **不删除** OAuth credential（保留在目标 DSH_HOME 内，便于再启用）。
- **不影响**其他 Agent。
- 不回滚 DSH 版本（从未升级）。

---

## 7. Controlled Live Acceptance（实现完成后，在用户主要手机飞书会话执行）

| # | 验收项 |
|---|---|
| 1 | TARGET_AGENT 使用正式持久化 DSH_HOME（非 /tmp、非共享 home） |
| 2 | dsh-codex@0.2.3 加载（插件清单/进程证据） |
| 3 | resolved provider/model = `openai-codex / gpt-5.6-luna` |
| 4 | 手机飞书第一条真实消息成功回复 |
| 5 | 完全停止目标 Agent / DSH |
| 6 | 重新启动 |
| 7 | 不重新注入 token |
| 8 | 手机飞书第二条真实消息成功回复 |
| 9 | session log 确认 Main Agent 使用 Luna |
| 10 | `OPENAI_API_KEY` absent（目标 Agent 进程环境） |
| 11 | 不走 api.openai.com API-credit 路径（订阅配额证据） |
| 12 | credential file 权限 = 0600 |
| 13 | `~/.codex/auth.json` hash/mtime unchanged |
| 14 | 其他 Agent provider/model 不变 |

---

## 8. Non-Goals（明确不做）

- automatic fallback（任何形态）；
- 87 Agent 全局切 Luna / 批量 enablement；
- DSH upgrade；
- Router semantic change；
- Session/Binding change（Binding、ChannelConversation、switchAgent 语义不动）；
- Kernel change（KERNEL_CHANGE = NONE）；
- model router / credential service / fallback system / account pool / quota scheduler
  （owner 禁止清单，一律不建）。

---

## 9. 实现边界与产物约束

- 使用独立 git worktree；不直接修改 main；实现完成后 commit + push 交独立 Review，
  不自行 merge。
- 必须复用主线已有机制：Agent provisioning、persistent DSH_HOME、profile / plugin
  provisioning、per-Agent deployment config。
- 代码 + 测试 + 一次性部署动作（operator 交互式登录）+ §7 验收记录；无新服务。

---

## 10. Final Output（实现 + 验收后填写）

```text
MAINLINE_GPT_SUBSCRIPTION_INTEGRATION = PASS / SPEC_REQUIRED / BLOCKED

TARGET_AGENT_ID =
TARGET_DSH_HOME =

INTEGRATION_LAYER =
CONFIG_SEAM =
PROVISIONING_SEAM =

DSH_VERSION = 0.1.0-rc.5
PLUGIN_VERSION = 0.2.3
PROVIDER = openai-codex
MODEL = gpt-5.6-luna

DEFAULT_MODEL_CHANGED = NO
ENABLED_AGENTS = 1

FIRST_MOBILE_FEISHU_REQUEST =
RESTART_PERSISTENCE =
SECOND_MOBILE_FEISHU_REQUEST =
ROLLBACK_TEST =
OTHER_AGENTS_REGRESSION =

USES_CHATGPT_SUBSCRIPTION_QUOTA = YES
USES_OPENAI_API_CREDITS = NO
OPENAI_API_KEY_PRESENT = NO

KERNEL_CHANGE = NONE
ROUTER_SEMANTIC_CHANGE = NONE
SESSION_MODEL_CHANGE = NONE

READY_FOR_CONTROLLED_USE =
READY_AS_GLOBAL_DEFAULT = NO
```

---

## ReviewDisposition

（预留：Independent Spec Review 结论与 FIX 记录。）
