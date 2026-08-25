---
spec_id: AGENT_CORE_CHATGPT_SUBSCRIPTION_PROVIDER_V1
status: accepted
amendment: AGENT_CORE_CHATGPT_SUBSCRIPTION_PROVIDER_V1_SPEC_AMENDMENT
accepted_reviewed_head: 42cd524
focused_re_review: PASS
amendment_2: AGENT_CORE_CHATGPT_SUBSCRIPTION_PROVIDER_V1_DSH_RC8_VERSION_ALIGNMENT
amendment_2_status: accepted
amendment_2_accepted_reviewed_head: 72fa87d
amendment_2_review: PASS
amendment_2_required_fixes: NONE
amendment_2_verdict: READY_TO_ACCEPT_RC8_AMENDMENT
---

# Agent Core ChatGPT Subscription Provider V1 — 单 Agent Luna 接入（AMEND）

> 性质：**Spec（SPEC ONLY — 本轮只冻结授权边界，不实现）** · 日期：2026-08-18 ·
> AMEND：2026-08-19 · 仓库：`mayf3/dsh-agent-core`
> 角色：ChatGPT Subscription Provider Spec Agent
>
> SPEC_STATUS = accepted（mechanical acceptance finalize 2026-08-19 ·
> accepted_reviewed_head = 42cd524 · focused_re_review = PASS ·
> REQUIRED_FIXES = NONE · VERDICT = READY_TO_ACCEPT_AND_MERGE_SPEC）
>
> **Amendment 2（2026-08-21，DSH rc.8 version alignment）= accepted
> （mechanical acceptance finalize 2026-08-21 ·
> accepted_reviewed_head = 72fa87d · review = PASS ·
> REQUIRED_FIXES = NONE · VERDICT = READY_TO_ACCEPT_RC8_AMENDMENT）。**
> 基础正文（含 `DSH_VERSION = 0.1.0-rc.5`
> pin）保持历史原样；自本 finalize 起，以文末「Amendment 2」节的
> 冻结 tuple 取代基础正文的 DSH version/commit，其余语义一律不变。
>
> 本轮为 **SPEC_AMENDMENT（FIX round）**：Independent Review on `da8c0de`
> `VERDICT = FIX_REQUIRED`，本文只闭合 Reviewer 的 REQUIRED_FIXES 1–6，
> 不重开已通过项，不 implementation，不执行 OAuth，不修改 production
> provider/model，不复制任何 credential，不 merge。
>
> **已独立源码核实通过、本轮不得重开的冻结项**：
> `TARGET_AGENT = agt_cto-agent`；`TARGET_DSH_HOME = ~/.agent-core/homes/agt_cto-agent`；
> `DSH_VERSION = 0.1.0-rc.5`；`DSH_COMMIT = a12bb03c6861969985f066bfbf0cb7e5dd5ac567`；
> `PLUGIN_VERSION = dsh-codex@0.2.3`；`PROVIDER = openai-codex`；`MODEL = gpt-5.6-luna`；
> `CREDENTIAL_STORE = <DSH_HOME>/.openai-codex-auth.json`（file 0600 / directory 0700）；
> `CREDENTIAL_OWNER = agt_cto-agent`；`SHARES_CODEX_AUTH_FILE = NO`；
> `OAUTH_BOOTSTRAP_MODE = OPERATOR_INTERACTIVE`；`ENABLED_AGENTS = exactly 1`；
> `DEFAULT_MODEL_CHANGED = NO`；`GLOBAL_ENABLEMENT = NO`；
> `KERNEL_CHANGE = NONE`；`SESSION_MODEL_CHANGE = NONE`。
>
> Owner 给定实验事实原样引用（无需重做）：roundtrip PASS、订阅配额 YES、API credits NO、
> restart persistence PASS、`~/.codex/auth.json` unchanged。不在 /tmp 做任何新实验。

---

## 0. 一句话

在现有 per-Agent DSH_HOME / profile / provisioning 机制上，新增**一个最小、静态的
per-Agent model override deployment seam**，使唯一目标 Agent 的 DSH 进程以
`openai-codex / gpt-5.6-luna`（ChatGPT 订阅配额，`dsh-codex@0.2.3` 承载，
安装在目标 Agent 自己的 profile 内）initialize；其余 87 个 Agent 继续走**原封不动的
全局 env route**（`oc-go / deepseek-v4-flash`）；Router 只做机械的静态配置传递，
不做任何动态路由。

---

## 1. 目标 Agent 与当前生产模型事实（Fix 1）

目标由 production 只读证据确定（da8c0de 轮已冻结，不重开）：

| 项 | 值 |
|---|---|
| TARGET_FEISHU_CONVERSATION | `feishu:oc_648db8f3df0ef0249b761ebb0b7a56ab`（group） |
| TARGET_AGENT_ID | `agt_cto-agent`（技术研发总监） |
| TARGET_SESSION | `main` |
| TARGET_PRIMARY_WORKSPACE | `/Users/yanfenma/.openclaw/groups/workspace-oc_648db8f3df0ef0249b761ebb0b7a56ab` |
| TARGET_DSH_HOME | `/Users/yanfenma/.agent-core/homes/agt_cto-agent`（persistent，现有） |

**当前生产有效模型（本 AMEND 修正）**：

```text
CURRENT_EFFECTIVE_PROVIDER = oc-go
CURRENT_EFFECTIVE_MODEL    = deepseek-v4-flash
```

冻结真实配置优先级链（已独立源码核实）：

```text
CONFIG_PRECEDENCE =
  launchd / production-runtime env（ai.agent-core.runtime.plist 全局注入）
  → DSH_AGENT_PROVIDER / DSH_AGENT_MODEL（全局环境变量，对所有 Agent 相同）
  → Router AgentProcess initialize（packages/agent-router/src/process.js ready()）
  → demo-server agentOptions
  → every create / resume
  → session request header
```

明确：`<DSH_HOME>/settings.yaml` 的 `agent-default-model` 在当前
Router → demo-server production path 中**不生效**（Router 总是显式传 env 值），
**不得继续把它作为 Luna 的正式 CONFIG_SEAM**。（原 da8c0de 版把该文件中的
`ollama / qwen3.8:27b…` 误当现网有效值，本 AMEND 删除该表述；settings.yaml 保持
原样不动，本 Spec 不修改它。）

---

## 2. Per-Agent Model Override Seam（Fix 2，冻结）

当前全局环境变量对所有 Agent 注入相同 provider/model，因此**必须**增加一个最小、
静态、per-Agent deployment override seam：

### 2.1 静态部署配置

按现有 production-runtime 静态配置惯例（同
`<productionRoot>/primary-workspaces.json`：deployment-authored、startup 一次性加载、
malformed → startup fail-loud）新增：

```text
PER_AGENT_MODEL_OVERRIDE_SEAM =
  <productionRoot>/agent-model-overrides.json
  （production-runtime bootstrap 启动时加载，与 primary-workspaces.json 同惯例）
```

概念形态（概念示例，字段语义冻结）：

```json
{
  "version": 1,
  "overrides": {
    "agt_cto-agent": {
      "provider": "openai-codex",
      "model": "gpt-5.6-luna",
      "plugin": "dsh-codex",
      "pluginVersion": "0.2.3"
    }
  }
}
```

具体文件名与加载位置遵循现有 production-runtime 配置惯例冻结；**不新建动态
Model Router**，不做任何运行时重载 / 热更新（改配置 = 改文件 + 重启，与
primary-workspaces.json 相同语义）。

### 2.2 解析语义（冻结）

```text
explicit per-Agent override exists → 该 Agent 的 AgentProcess initialize
                                     机械使用该 provider/model（env 对该 Agent 不生效）
no override                        → 保持现有全局 env route
                                     → oc-go / deepseek-v4-flash（一字不改）
```

### 2.3 最小接线（冻结）

```text
production-runtime 读取静态配置
→ Router ensureRunning / AgentProcess 构造
→ 给目标 Agent 机械传 provider/model（initialize params）
（即 process.js ready() 中 provider/model 的取值来源：
  per-Agent override ?? 全局 env，二者都无才用库默认）
```

分类（必须准确）：

```text
ROUTER_CODE_CHANGE_REQUIRED    = YES_MINIMAL
ROUTER_ROUTING_SEMANTIC_CHANGE = NONE
SESSION_MODEL_CHANGE           = NONE
```

这里**不是**让 Router 根据请求动态选模型，只是让它在创建指定 AgentProcess 时
机械使用已经解析好的静态 Agent 配置。Router 不获得任何模型选择逻辑。

### 2.4 冻结约束

- unknown provider/model（静态配置引用了未注册/不存在的 provider 或 model）→ fail-loud；
- duplicate / invalid Agent config（重复 agentId、字段缺失/非法、JSON 损坏）→
  startup fail-loud（沿用 primary-workspaces.json 的 fail-loud 惯例）；
- V1 语义约束：override entries **至多 1 条**（多条 → fail-loud，防 fleet 静默扩散）；
- no silent fallback（任何解析失败不得回退 env 或默认值继续跑）；
- 其他 87 个 Agent 保持全局 env route 不变；
- **launchd plist 全局 env 保持不变**（`DSH_AGENT_PROVIDER=oc-go` /
  `DSH_AGENT_MODEL=deepseek-v4-flash` 原值原样）。

### 2.5 禁止

dynamic model router / quota scheduler / fallback chain / load balancing /
account pool / Binding-或-Session-based model selection。

---

## 3. Per-Agent Opt-In（冻结，不重开）

```text
ENABLED_AGENTS     = exactly 1 = { agt_cto-agent }
OPT_IN_MECHANISM   = 仅 §2.1 静态配置中该 Agent 的一条 override
GLOBAL_ENABLEMENT  = NO
DEFAULT_MODEL_CHANGED = NO
```

其他 87 个 Agent 的 resolved provider/model 不得有任何变化（验收硬项）。

---

## 4. Credential Ownership & Interactive OAuth（冻结，不重开）

```text
CREDENTIAL_OWNER     = agt_cto-agent（Agent 实体自有）
CREDENTIAL_STORE     = <TARGET_DSH_HOME>/.openai-codex-auth.json
                      （file 0600；所在 directory 0700）
SHARES_CODEX_AUTH_FILE = NO
OAUTH_BOOTSTRAP_MODE = OPERATOR_INTERACTIVE
                       （必须在目标 Agent 的正式持久化 DSH_HOME 中由 operator
                        亲自交互重新登录；一次登录，落盘持久）
```

禁止（硬边界，不重开）：复制 /tmp 实验 credential；读取或修改
`~/.codex/auth.json`（全程 hash/mtime 不变）；使用 `OPENAI_API_KEY` 或任何
OpenAI API credits；token 经 env / argv / prompt / Feishu 消息传递；token 写日志
（日志必须 redact）；refresh token 跨 Agent 复制。不新建 credential service。

---

## 5. dsh-codex Plugin Provisioning（Fix 3，冻结）

当前 `provisionAgentHome` 只 copyOnce profile 文件与既有 farm links，**不安装
外部 npm plugin**。本 Spec 冻结 dsh-codex@0.2.3 进入目标 Agent 正式 DSH_HOME
plugin resolution path 的最薄机制：

```text
PLUGIN_PROVISIONING_SEAM =
  目标 Agent 自己的 <DSH_HOME>/profiles/<profile>/node_modules
  + 该 profile 的 package.json dsh.profile.bundles 追加 dsh-codex 声明
  （= 现有 DSH profile 真正使用的 plugin resolution seam：
    <DSH_HOME>/profiles/node_modules 已承载 @agent-core/* / @deepseek-ai/* bundles）

PLUGIN_INSTALL_SCOPE = TARGET_AGENT_HOME_ONLY
EXACT_VERSION_PIN    = dsh-codex@0.2.3（精确版本，禁止 ^/~ 范围）
```

V1 边界：**只装目标 home**。禁止修改共享模板 `profile-production/`（不得使未来
所有 Agent 默认获得 dsh-codex）。

Provisioning 必须满足（全部冻结为验收语义）：

- verify / install **exact** `dsh-codex@0.2.3`；
- idempotent，safe to rerun；
- exact version check（安装后核对真实 resolved version）；
- plugin missing → fail-loud；
- version mismatch → fail-loud；`dsh-codex@0.2.4` → **reject**；
- DSH version mismatch（非 `0.1.0-rc.5@a12bb03c`）→ reject；
- restart 后重新验证 plugin loaded（进程证据，非仅文件存在）。

不从 /tmp 实验目录复制插件代码（必须从正式 npm source 安装）。不升级 DSH。

---

## 6. Failure Semantics（Fix 5，冻结）

至少冻结以下失败类别，全部 **fail-loud**：

| # | 失败类别 | 语义 |
|---|---|---|
| 1 | `plugin_missing` | 目标 profile 未解析到 dsh-codex → 拒绝启动该 Agent 进程 |
| 2 | `plugin_version_mismatch` | resolved version ≠ 0.2.3 → 拒绝启动 |
| 3 | `credential_missing` | CREDENTIAL_STORE 不存在/不可读 → 该 turn 失败并如实上抛 |
| 4 | `oauth_expired_or_revoked` | 认证失效 → 该 turn 失败并如实上抛（恢复 = operator 重新交互式登录） |
| 5 | `provider_unavailable` | provider 侧不可达 → 该 turn 失败并如实上抛 |
| 6 | `account_quota_exhausted` | **必须标识为 provider / account-side quota error**，不得误报为 Kernel、Router 或 Agent 故障 |
| 7 | `model_unavailable` | 模型不可用 → 该 turn 失败并如实上抛 |

任一失败：

- fail-loud；影响面 = **仅目标 Agent**；其他 Agent / Router / Binding / scheduler 不受影响；
- **no silent fallback to oc-go**（不回退全局 env route）；
- **no silent success with wrong provider**（绝不以错误 provider 静默成功）；
- 无自动重试账号池 / 无 fallback chain。

**防 no-op 硬验收**：resolved provider/model 与 session log 都是硬验收项——
专门防止「配置写了 Luna、实际仍跑 oc-go」的静默 no-op（见 §8 验收 3/9 与 §7 测试）。

---

## 7. Rollback（Fix 4，冻结，机械可执行）

真实前态 = **全局 env route `oc-go / deepseek-v4-flash`**（launchd 全局注入，全程未动）。

```text
ROLLBACK =
  1) remove / disable agt_cto-agent 的 per-Agent Luna override
     （删除 <productionRoot>/agent-model-overrides.json 中该条目，或整文件）
  2) restart only agt_cto-agent process（完全停止 → 重新启动；
     不重启其他 Agent，不动 production-runtime 全局）
  3) 该 Agent 自然回落到原封不动的全局 env route
     → oc-go / deepseek-v4-flash
  4) 验证 resolved provider/model = oc-go / deepseek-v4-flash
```

- 不修改 launchd 全局 provider/model；
- 不影响其他 Agent；
- OAuth credential **可保留**，不要求删除（便于再启用）；
- 不回滚 DSH 版本（从未升级）。
- （原 da8c0de 版「恢复 Ollama/qwen3.8」表述删除——那不是有效前态。）

---

## 8. Controlled Live Acceptance（实现完成后，在用户主要手机飞书会话执行）

| # | 验收项 |
|---|---|
| 1 | TARGET_AGENT 使用正式持久化 DSH_HOME（非 /tmp、非共享 home） |
| 2 | dsh-codex@0.2.3 加载（进程/插件清单证据；restart 后重新验证 plugin loaded） |
| 3 | resolved provider/model = `openai-codex / gpt-5.6-luna`（**硬验收**） |
| 4 | 手机飞书第一条真实消息成功回复 |
| 5 | 完全停止目标 Agent / DSH |
| 6 | 重新启动 |
| 7 | 不重新注入 token |
| 8 | 手机飞书第二条真实消息成功回复 |
| 9 | session log 确认 Main Agent 使用 Luna（**硬验收**，与 #3 共同防 no-op） |
| 10 | `OPENAI_API_KEY` absent（目标 Agent 进程环境） |
| 11 | 不走 api.openai.com API-credit 路径（订阅配额证据） |
| 12 | credential file = 0600、directory = 0700 |
| 13 | `~/.codex/auth.json` hash/mtime unchanged |
| 14 | 其他 Agent provider/model 不变（全局 env route 原值） |

---

## 9. 普通自动化测试范围（Fix 6，冻结）

普通 CI **不做真实 OAuth**，至少覆盖：

1. per-Agent config parsing（§2.1 形态 / duplicate / invalid → fail-loud）；
2. exactly-one-Agent opt-in（>1 override entry → fail-loud）；
3. global env route regression for other Agents（无 override 的 Agent resolved 值不变）；
4. target Agent resolved provider/model = openai-codex / gpt-5.6-luna；
5. plugin exact version pin（0.2.3；0.2.4 → reject）；
6. plugin missing / version mismatch → fail-loud；
7. credential missing → fail-loud；
8. no silent fallback（override 存在但 provider 不可用时绝不回落 oc-go）；
9. log redaction（token 不出现在任何日志输出）；
10. restart config persistence（重启后 override 仍生效且 plugin 仍 loaded）；
11. rollback to global env route（移除 override → 回落 oc-go / deepseek-v4-flash）。

Controlled live acceptance（§8）保持本 Spec 已冻结的真实 OAuth、两条手机飞书消息
与重启验收，不变。

---

## 10. Non-Goals（明确不做）

- automatic fallback（任何形态）；
- 87 Agent 全局切 Luna / 批量 enablement；
- DSH upgrade；
- Router **routing semantic** change（本 Spec 允许的仅是 §2.3 YES_MINIMAL 机械传参）；
- Session/Binding change（Binding、ChannelConversation、switchAgent 语义不动）；
- Kernel change（KERNEL_CHANGE = NONE）；
- dynamic model router / quota scheduler / fallback chain / load balancing /
  account pool / Binding-或-Session-based model selection（一律不建）。

---

## 11. 实现边界与产物约束

- 使用独立 git worktree；不直接修改 main；实现完成后 commit + push 交独立 Review，
  不自行 merge。
- 必须复用主线已有机制：Agent provisioning、persistent DSH_HOME、profile / plugin
  provisioning、production-runtime 静态配置惯例。
- 代码 + 测试（§9）+ 一次性部署动作（plugin 安装 + operator 交互式登录）+
  §8 验收记录；无新服务、无新守护进程。

---

## 12. Final Output（AMEND 轮填写；实现 + 验收后补全）

```text
AGENT_CORE_CHATGPT_SUBSCRIPTION_PROVIDER_V1_SPEC_AMENDMENT = PASS / BLOCKED

BASE_REVIEWED_HEAD = da8c0de
HEAD =

CURRENT_EFFECTIVE_PROVIDER = oc-go
CURRENT_EFFECTIVE_MODEL = deepseek-v4-flash

CONFIG_PRECEDENCE =
PER_AGENT_MODEL_OVERRIDE_SEAM =

ROUTER_CODE_CHANGE_REQUIRED = YES_MINIMAL
ROUTER_ROUTING_SEMANTIC_CHANGE = NONE

PLUGIN_PROVISIONING_SEAM =
PLUGIN_INSTALL_SCOPE = TARGET_AGENT_HOME_ONLY
EXACT_VERSION_PIN =

CREDENTIAL_OWNER = agt_cto-agent
CREDENTIAL_STORE =

DEFAULT_MODEL_CHANGED = NO
ENABLED_AGENTS = 1

FAILURE_SEMANTICS =
ROLLBACK =

AUTOMATIC_TEST_SCOPE =
CONTROLLED_LIVE_ACCEPTANCE =

KERNEL_CHANGE = NONE
SESSION_MODEL_CHANGE = NONE

SPEC_STATUS = accepted
READY_FOR_FOCUSED_RE_REVIEW =
```

---

## Amendment 2（2026-08-21）— DSH rc.8 Version Alignment（accepted）

> 出处：`LUNA_DSH_RC8_VERSION_ALIGNMENT_V1`（COMPATIBILITY INVESTIGATION +
> SPEC AMENDMENT ONLY）。AMENDMENT_STATUS = **accepted**（acceptance
> finalize 2026-08-21：accepted_reviewed_head = `72fa87d` ·
> `LUNA_DSH_RC8_VERSION_ALIGNMENT_V1_SPEC_REVIEW = PASS` ·
> REQUIRED_FIXES = NONE · VERDICT = READY_TO_ACCEPT_RC8_AMENDMENT；
> 兼容性证据 22/22 PASS：作者复跑两轮 + 独立 Reviewer 第三轮）。
>
> **Owner Direction（2026-08-21）**：优先对齐当前正式 production DSH
> （`0.1.0-rc.8`）；不为 Luna 长期维护一套单独的 rc.5 Harness；只有
> source-verified 证明当前可用插件与 rc.8 不兼容才 BLOCKED；不得擅自部署双
> Harness。

### A2.1 唯一冻结 tuple（supersede 基础正文的 DSH pin；其余字段不变）

```text
DSH_VERSION   = 0.1.0-rc.8
DSH_COMMIT    = 514ab7b0029141b88c807704764d0d3e1eea1da4
PLUGIN        = dsh-codex@0.2.3   （不变，无升级需求）
```

- 生效条件：本 Amendment 经 independent review PASS 并 acceptance finalize。
- 生效后，`packages/production-runtime/src/model-overrides.js` 的
  `CHATGPT_SUBSCRIPTION_V1.dshVersion/dshCommit` 常量更新为上述值 —— 该代码
  变更属于**后续独立 implementation 轮**（本 Amendment 轮 SPEC ONLY，不改
  产品代码）。在实现落地前，production Luna 激活保持 08-21 观测到的
  `dsh_version_mismatch` fail-loud（如实失败，非回退）。
- 其余全部冻结项**原样不变**：`provider = openai-codex`、
  `model = gpt-5.6-luna`、credential ownership /
  `<DSH_HOME>/.openai-codex-auth.json`（0600/0700）、`SHARES_CODEX_AUTH_FILE =
  NO`、`ENABLED_AGENTS = exactly 1`、no `OPENAI_API_KEY`、no API credits、
  exact plugin pin（`0.2.4` → reject 不变）、provisioning fail-loud 家族
  （§5/§6，仅 pin 值随本节更新）、rollback（§7）一字不改、
  `AGENT_CORE_CHATGPT_SUBSCRIPTION_TARGET_PROXY_SEAM_V1` 不受本 Amendment
  影响（不修改 target proxy Spec）。

### A2.2 兼容性证据（2026-08-21，隔离真实测试，可复现）

驱动：`scripts/luna-dsh-rc8-compat-driver.mjs`（本轮随分支提交）。
方法：真实 rc.8 production harness checkout（只读）+ 临时 DSH_HOME/workspace/
operator HOME + 真实 `dsh-codex@0.2.3` npm artifact（`npm pack`，sha256 与
实现轮冻结 artifact 逐字节一致，且 lib 与生产已安装副本 6/6 文件
byte-identical）+ fixture OAuth credential（假 JWT，claim 形状按
`https://api.openai.com/auth.chatgpt_account_id`）+ 本地 HTTP 代理 observer
（记录 CONNECT，拒绝隧道；全程零真实外网）。两轮执行均
`RESULT=PASS CHECKS=22 FAILED=0`：

| 验收项 | 结果 |
|---|---|
| provisionExactProfilePlugin 以候选 pin（rc.8 + 514ab7b…）在真实 harness 上通过；peers 全部从 rc.8 树闭合（含 `@earendil-works/pi-ai@0.82.1`） | PASS |
| plugin module resolves / target profile loads（`dsh.profile.bundles` 追加 dsh-codex） | PASS |
| `openai-codex` provider 注册（`registeredProviders` 含之；`pluginServices.openAICodex = true`） | PASS |
| initialize 成功，route = `openai-codex / gpt-5.6-luna` | PASS |
| 无 credential 时 turn 到达明确 credential boundary（`credential_missing` / `agent/credential`，session `created`） | PASS |
| fixture credential 下 turn 越过 credential 检查、以期望 header 形状发起 chatgpt.com 请求（observer 捕获 `CONNECT chatgpt.com:443` ×N，fetch+WS transport），失败干净归类 provider 侧（非 credential_missing） | PASS |
| 完整退出（exit code 0） | PASS |
| 冷重启后 plugin 仍加载、provider 仍注册、session `main` **resumed**、credential 复用、observer 再次捕获 CONNECT | PASS |

必须确认的不存在项，逐一以负向确认：

```text
API_SHAPE_MISMATCH            = NONE（pi-ai@0.82.1 与 rc.5 轮同版；真实后端
                                 401 透传干净——见 A2.3）
PROFILE_BUNDLE_INCOMPAT       = NONE（profile loads + bundles 追加成功）
PROVIDER_REGISTRATION_MISMATCH= NONE（registerAdapter 服务面在 rc.8 成立）
SESSION_CREATE_RESUME_INCOMPAT= NONE（created + 冷重启 resumed 实测）
CREDENTIAL_STORE_SCHEMA_INCOMPAT = NONE（version/1 + credential 五字段解析、
                                 0600 边界校验按 dsh-codex@0.2.3 原语义）
```

另（调查过程中的额外实测，非验收依赖）：曾以无权限重定向的 fixture token
意外到达真实 chatgpt.com 后端，后端返回可解析的 401
（"Could not parse your authentication token"）并被干净透传 —— 佐证 wire
shape 兼容。最终验收运行已全部收敛到本地 observer（零真实网络、零真实
token）。

### A2.3 已知运维事实（随本 Amendment 记录，不改语义）

1. **Harness 漂移敏感**：pin 校验的是 `DSH_HARNESS_ROOT` checkout 的
   `git rev-parse HEAD`；该 checkout 是活跃开发树（本轮快照时 ahead 13、含
   未跟踪文件）。后续任何 harness 提交都会让 Luna 再次
   `dsh_version_mismatch` fail-loud —— 这是设计内行为；长期解法（为订阅路径
   提供钉死构建）超出本 Amendment，未获授权不建设。
2. **`~/.codex/auth.json` 归因规则（验收方法论）**：该文件由用户自己的
   Codex 客户端独立刷新（2026-08-21 07:05:21 实测发生），与本系统无关
   （Agent Core / dsh-codex 不读取、不写入该文件；订阅 credential 独立存放
   于 `<DSH_HOME>/.openai-codex-auth.json`）。后续验收判定「本轮是否修改了
   该文件」必须使用 **activation window start hash/mtime → window end
   hash/mtime** 对比，不得以数小时前的历史基线归因。

### A2.4 Amendment 2 Final Output

```text
AGENT_CORE_CHATGPT_SUBSCRIPTION_PROVIDER_V1_DSH_RC8_VERSION_ALIGNMENT = PASS

BASE_SPEC_STATUS       = accepted（历史正文不动）
AMENDMENT_2_STATUS     = accepted
ACCEPTED_REVIEWED_HEAD = 72fa87d
REVIEW                  = PASS
REQUIRED_FIXES           = NONE
VERDICT                  = READY_TO_ACCEPT_RC8_AMENDMENT
SEMANTIC_CHANGE          = NONE

DSH_VERSION   = 0.1.0-rc.8
DSH_COMMIT    = 514ab7b0029141b88c807704764d0d3e1eea1da4
PLUGIN        = dsh-codex@0.2.3（unchanged）

DSH_CODEX_0_2_3_COMPATIBLE = YES（22/22 PASS：作者复跑两轮 + 独立 Reviewer 第三轮）
PROVISIONING_FAIL_LOUD     = UNCHANGED（仅 pin 值更新）
RESTART_ACCEPTANCE         = PASS（冷重启 resume 实测）
ROLLBACK                   = UNCHANGED（§7 原样）

PRODUCTION_CHANGE = NONE · OAUTH_PERFORMED = NO · CREDENTIAL_CHANGED = NO
KERNEL_CHANGE = NONE · PRODUCT_CODE_CHANGE = NONE · MERGE = NO
```

---

## ReviewDisposition

- **Round 1（da8c0de）**：Independent Review `VERDICT = FIX_REQUIRED`。
  REQUIRED_FIXES：① 修正当前生产模型事实（effective = oc-go / deepseek-v4-flash；
  settings.yaml 在 Router→demo-server path 不生效，不得作 CONFIG_SEAM）；
  ② 冻结最小 per-Agent model override seam（静态部署配置 + 最小接线 + 准确分类
  YES_MINIMAL/NONE/NONE）；③ 补全 dsh-codex provisioning（target-home-only、
  exact pin、idempotent、fail-loud 家族）；④ 修正 Rollback（回落全局 env route，
  删 Ollama 表述）；⑤ 补全 Failure semantics（7 类 + quota 归因 + 防 no-op 硬验收）；
  ⑥ 冻结普通自动化测试范围。本 AMEND 已全部闭合；已通过项（目标 Agent、版本、
  credential ownership 等）未重开。
- **Round 2（42cd524）**：focused re-review = **PASS**。
  `REVIEWED_HEAD = 42cd524` · `REVIEW_RESULT = PASS` · `REQUIRED_FIXES = NONE` ·
  `VERDICT = READY_TO_ACCEPT_AND_MERGE_SPEC`。Round 1 的 6 项 FIX 确认闭合。
  Reviewer 3 条 **non-blocking note** 仅保留为 implementation notes（非 normative，
  不扩大、不修改本 Spec 契约）：
  1. 实际 plugin 安装路径使用 `<DSH_HOME>/profiles/node_modules`；
  2. override 引用未注册 agentId → implementation startup fail-loud；
  3. 非目标 Agent 保持现有全局 env / hardcoded fallback 行为。
- **Acceptance finalize（2026-08-19）**：text-only 状态翻转
  `proposed → accepted`（frontmatter + 文头镜像 + §12 镜像 + 本 provenance）。
  SEMANTIC_CHANGE = NONE；冻结语义原样（见文头清单）。
- **Round 3**：（预留 implementation / merge 轮。）
- **Round 4（2026-08-21，Amendment 2 proposed）**：DSH rc.8 version
  alignment —— 基础 pin（0.1.0-rc.5@a12bb03c…）被生产 harness 漂移
  （0.1.0-rc.8）打破；按 Owner Direction 对齐 rc.8 + dsh-codex@0.2.3 不变，
  依据隔离真实兼容测试（22/22 PASS，见 Amendment 2 节）。AMENDMENT_2_STATUS
  = **proposed — waiting independent review**；未 acceptance finalize，
  未实现，未改 production。
- **Round 5（2026-08-21，Amendment 2 acceptance finalize）**：Independent
  Review on `72fa87d` = **PASS**；`REQUIRED_FIXES = NONE`；`VERDICT =
  READY_TO_ACCEPT_RC8_AMENDMENT`。本轮仅机械翻转 Amendment 2 状态并镜像
  acceptance provenance；`SEMANTIC_CHANGE = NONE`，未 implementation，未改
  production，未 OAuth，未修改 credential，未 merge。
