---
spec_id: AGT_CTO_AGENT_GLM53_PRIMARY_LUNA_FALLBACK_V1
status: proposed
date: 2026-08-23
type: implementation-spec (SPEC ONLY — 本轮只冻结授权边界；不实现、不配置、不部署)
spec_kind: implementation
authority_level: governing_spec
implementation_authority: none
production_apply_authority: none
replaces_on_acceptance: AGENT_CORE_CHATGPT_SUBSCRIPTION_PROVIDER_V1
supersedes: []
superseded_by: null
scope:
  - agt_cto-agent 的 PRIMARY/FALLBACK model-route 政策（whole-authority replacement of AGENT_CORE_CHATGPT_SUBSCRIPTION_PROVIDER_V1）
  - 单一 fallback 的安全边界（SAFE_FALLBACK = 仅 prompt admission 被证明为假）
  - fallback loud evidence 字段与非静默语义
  - 静态 per-Agent route 配置语义（startup-loaded / fail-loud / controlled restart）
  - Luna fallback 前置条件诚实记录（不含 credential 复制授权）
governed_by:
  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0
external_authorities: []
owners:
  - repository-maintainers
references:
  - docs/specs/AGENT_CORE_CHATGPT_SUBSCRIPTION_PROVIDER_V1.md（accepted；本 Spec 的 whole-authority replacement 对象）
  - docs/specs/AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0.md（accepted；当前 repository development-governance authority；本 Spec governed_by 指向——其 vendored protocol §9.2 即本 Spec 引用的 whole-authority SUPERSEDE 规则；其 supersede 对象 AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1 已为历史 authority）
  - docs/specs/AGENT_CORE_CHATGPT_SUBSCRIPTION_TARGET_PROXY_SEAM_V1.md（accepted；related authority——Luna leg 的 providerEnv seam，本 Spec 不 supersede）
  - docs/specs/AGENT_PROCESS_LIFECYCLE_HARDENING_V2.md（accepted；spawn/admission/turn 状态与 outcome_unknown 语义 authority）
  - docs/investigations/LUNA_DSH_RC8_VERSION_ALIGNMENT_V1.md（accepted-on-main investigation；rc.8 + dsh-codex@0.2.3 session create/resume 证据）
---

# AGT_CTO_AGENT_GLM53_PRIMARY_LUNA_FALLBACK_V1 — CTO Agent GLM-5.3 主路由 + Luna 单一安全回退

> SPEC_STATUS = **proposed**。本文件是 **docs-only whole-authority replacement
> proposal**：在未来原子 acceptance transaction 中整体取代
> `AGENT_CORE_CHATGPT_SUBSCRIPTION_PROVIDER_V1`（accepted）。在该 transaction
> 完成前，旧 Spec 仍是唯一现行 model-routing authority；本 Spec 不授予任何
> implementation / configuration / deployment 权限。
>
> 本轮（authoring round）不实现、不配置、不部署：不改任何 packages/ 代码，
> 不写 agent-model-overrides.json，不执行 OAuth，不复制任何 credential，
> 不发送 Feishu 消息，不重启任何进程，不 merge。

---

## 1. Goal

为唯一目标 Agent `agt_cto-agent` 冻结新的 model-route 政策：

```text
PRIMARY_PROVIDER = zai
PRIMARY_MODEL    = glm-5.3

FALLBACK_PROVIDER = openai-codex
FALLBACK_MODEL    = gpt-5.6-luna
FALLBACK_PLUGIN   = dsh-codex@0.2.3

MAX_FALLBACK_ROUTE_ATTEMPTS = 1
SILENT_FALLBACK = FORBIDDEN
```

方向性变更（对比被替换 Spec）：旧 Spec 冻结「该 Agent 唯一显式路由 =
openai-codex/gpt-5.6-luna，automatic fallback（任何形态）= Non-Goal」；
本 Spec 冻结「zai/glm-5.3 为主路由 + 单一、有界、loud 的 Luna 回退」。
这是 Direction 实质改变，故走 SUPERSEDE（whole-authority replacement），
不走 AMEND（见 DEC-001 / ALT-001）。

## 2. Scope and non-goals

### 2.1 In scope

- `agt_cto-agent` 单个 Agent 的 primary/fallback route 政策。
- SAFE_FALLBACK 边界：仅当 prompt admission 被证明为假（proven false）。
- 回退触发白名单（4 类）与绝对禁止清单（9 类）。
- Loud evidence 字段（5 个必填）。
- 静态配置语义（startup-loaded、malformed fail-loud、config change requires
  controlled restart）。
- Luna fallback 前置条件的诚实记录（LUNA_DIRECT_ROUTE_READY = NO）。

### 2.2 Non-goals（明确不做）

- 任何其他 Agent 的 route 变化（其余全部 Agent 保持现有全局 env route 原样）。
- 多级 fallback chain / 第三路由（fleet 级 3-route chain 属
  DSH_PROVIDER_FALLBACK_CHAIN_V1 提案，未 accept，且其 scope 明确排除本 Agent）。
- DSH 模型调用层（model-call recovery plugin / `agent/request-error` seam）的
  跨 provider 切换——本 Spec 的 fallback 位于 Agent Core admission 层
  （spawn / initialize / session create-resume / turnQueue admission），
  不在 DSH Agent-loop 内部。
- dynamic quota router、account pool、load balancing、quota 探测。
- Kernel / Binding / Session model / Feishu / Scheduler 变更。
- 复制旧 OAuth secret（见 CTR-008；本 Spec 不授予任何 credential 复制权限）。
- 本轮任何 implementation / configuration / deployment。

## 3. Authority and dependencies

### 3.1 Gate 确认（任务前置判定，冻结）

```text
GATE_QUESTION = AGENT_CORE_CHATGPT_SUBSCRIPTION_PROVIDER_V1 是否仅覆盖 agt_cto-agent？
GATE_ANSWER   = YES

证据：
  a) 旧 Spec §3 冻结 ENABLED_AGENTS = exactly 1 = { agt_cto-agent }，
     GLOBAL_ENABLEMENT = NO，其他 87 Agent「不得有任何变化」（验收硬项）；
  b) 旧 Spec 授权的 override loader（production-runtime model-overrides.js，
     fe2c639 轮源码核实）强制 overrides 至多 1 条且 agentId 必须
     已注册并 = agt_cto-agent——机制层面也不可能覆盖第二个 Agent；
  c) 旧 Spec 的 plugin provisioning / credential ownership / rollback 全部
     TARGET_AGENT = agt_cto-agent 单对象。

结论：whole-authority replacement 可行（无 fleet 级 authority 被丢弃）；
按 governance §9.2 以整权威取代，不做 partial supersede。
```

### 3.2 Related accepted authorities（不 supersede，如实登记）

| Authority | 关系 |
|---|---|
| `AGENT_CORE_CHATGPT_SUBSCRIPTION_TARGET_PROXY_SEAM_V1`（accepted） | Luna leg 的 providerEnv（四键 allowlist、target-only spawn 注入、fail-loud）seam authority。本 Spec 不修改、不 supersede 它；本 Spec 的 fallback leg 结构性依赖它（chatgpt.com 仅经 `127.0.0.1:7890` 可达，见其触发背景）。Owner decision Q-1 已裁决（2026-08-23）：`KEEP_TARGET_PROXY_SEAM_AS_SEPARATE_AUTHORITY`——它保持**独立 accepted authority**（不 absorb、不 supersede、status 不变）；acceptance transaction 仅对其「扩展 PROVIDER_V1 冻结 seam」的基准/依赖 metadata 引用 repoint 到本 Spec；其 providerEnv 四键契约与 normative body **不变**（见 §3.3 / DEC-008 / Q-1 RESOLVED）。 |
| `AGENT_PROCESS_LIFECYCLE_HARDENING_V2`（accepted） | spawn/admission/turn 语义 authority：`spawn_failed_without_child`、initialize 失败、`not_admitted` envelope、prompt receipt watermark、`outcome_unknown` 均以其冻结语义为准。本 Spec 引用不重定义。 |
| `AGENT_CORE_HARDENING_PROGRAM_V1`（accepted） | hardening program 框架（本 Spec 不在其排程序列内，无冲突）。 |
| `DSH_PROVIDER_FALLBACK_CHAIN_V1`（**proposed，未 merge，非 authority**） | fleet 级 3-route chain 提案；其正文明确「agt_cto-agent remains governed by accepted AGENT_CORE_CHATGPT_SUBSCRIPTION_PROVIDER_V1 … no automatic fallback」并排除本 Agent。本 Spec accept 后该句引用将悬空——该提案若继续推进须自行修订引用，属其自身 amendment 责任，不构成本 Spec 的阻塞项。 |

### 3.3 替换事务（未来原子 acceptance transaction，冻结形态）

```text
ACCEPTANCE_TRANSACTION（一次性 docs-only）：
  NEW.status = accepted
  NEW.supersedes = [ AGENT_CORE_CHATGPT_SUBSCRIPTION_PROVIDER_V1 ]
  OLD.status = superseded
  OLD.superseded_by = AGT_CTO_AGENT_GLM53_PRIMARY_LUNA_FALLBACK_V1
  （OLD 历史正文不删改，仅 lifecycle metadata + backlink；
    含 OLD 的 Amendment 1/2 历史一并归档为 historical authority）

  PROXY_SEAM_V1 基准 repoint（owner decision Q-1 已裁决；metadata-only）：
    AGENT_CORE_CHATGPT_SUBSCRIPTION_TARGET_PROXY_SEAM_V1 保持独立 accepted
    authority（不 absorb、不 supersede、status 不变）；
    仅将其「扩展 PROVIDER_V1 冻结 seam」的基准/依赖 metadata 引用从
    AGENT_CORE_CHATGPT_SUBSCRIPTION_PROVIDER_V1 改指
    AGT_CTO_AGENT_GLM53_PRIMARY_LUNA_FALLBACK_V1；
    其 providerEnv 四键契约与 normative body 一字不变。
```

## 4. Current State（只读核实，2026-08-23）

- `STATE-001` — Production runtime root 已于 2026-08-22 feishu cutover 后为
  `/Users/authsvc/.agent-core`（authsvc uid）；本 Agent 的正式 DSH_HOME =
  `/Users/authsvc/.agent-core/homes/agt_cto-agent`。Basis: `OBS-003`、`OBS-004`
  （cto-workspace-mapping investigation 同源事实，本轮直接复核）。
- `STATE-002` — 当前全局 env route = `oc-go / deepseek-v4-flash`
  （launchd `ai.agent-core.runtime.plist` 当前值）；`/Users/authsvc/.agent-core/agent-model-overrides.json`
  ABSENT → 本 Agent 当前有效路由 = 全局 env route，无任何 per-Agent override 生效。
  Basis: `OBS-003`、`OBS-008`。
- `STATE-003` — 本 Spec 的 PRIMARY（zai/glm-5.3）是**目标政策**，不是当前
  全局 env 现值；zai/glm-5.3 已在本 Agent 的旧 root（yanfenma）生产会话中
  真实执行过（精确跨度 2026-08-20 21:58 → 2026-08-21 07:13，14 个
  request/header），但在新 authsvc runtime 下
  尚未执行。Basis: `OBS-006`、`OBS-008`。
- `STATE-004` — Luna 直连路由未就绪：新 authsvc Home 无正式 OAuth Credential、
  dsh-codex provisioning 尚未完成。Basis: `OBS-004`。
- `STATE-005` — 旧 root Home（`/Users/yanfenma/.agent-core/homes/agt_cto-agent`）
  仍保留 OAuth credential（0600）与 dsh-codex@0.2.3；本 Spec **不授权复制**。
  Basis: `OBS-005`。

## 5. Observations

- `OBS-001` — 被替换 Spec 覆盖范围。仓库 `origin/main@344975d`，
  `docs/specs/AGENT_CORE_CHATGPT_SUBSCRIPTION_PROVIDER_V1.md` frontmatter
  `status: accepted`（Amendment 1、Amendment 2 均已 accept；DSH pin 已由
  Amendment 2 对齐 `0.1.0-rc.8 @ 514ab7b`）。正文冻结
  `ENABLED_AGENTS = exactly 1 = { agt_cto-agent }`；§2.4/§3 明确其余 87 Agent
  resolved provider/model 零变化、launchd 全局 env 不动。
- `OBS-002` — Related authority。`AGENT_CORE_CHATGPT_SUBSCRIPTION_TARGET_PROXY_SEAM_V1`
  （`origin/main`，accepted）自述「扩展（不修改、不 supersede）
  AGENT_CORE_CHATGPT_SUBSCRIPTION_PROVIDER_V1 冻结的 agent-model-overrides.json
  seam」，scope 亦为 exactly 单目标 `agt_cto-agent`（四键 providerEnv allowlist）。
- `OBS-003` — 当前生产全局路由。读 `/Library/LaunchDaemons/ai.agent-core.runtime.plist`：
  `DSH_AGENT_PROVIDER=oc-go` / `DSH_AGENT_MODEL=deepseek-v4-flash`；
  `ls /Users/authsvc/.agent-core/agent-model-overrides.json` = ENOENT。
  （只读，2026-08-23。）
- `OBS-004` — 新 authsvc Home Luna 前置条件缺失。`ls -la
  /Users/authsvc/.agent-core/homes/agt_cto-agent/`：无 `.openai-codex-auth.json`；
  `profiles/node_modules` 无 `dsh-codex`（无 codex 相关 entry）。
  （只读，2026-08-23。）
- `OBS-005` — 旧 credential 仍存在。`ls -la
  /Users/yanfenma/.agent-core/homes/agt_cto-agent/.openai-codex-auth.json`
  = 存在，mode 0600，2092 bytes，mtime 2026-08-20。本 Spec 未读取其内容。
- `OBS-006` — **SESSION_CROSS_PROVIDER_RESUME = YES（真实生产证据）**。旧 root
  Home main session
  `/Users/yanfenma/.agent-core/homes/agt_cto-agent/sessions/<dir>/main/session.jsonl`
  同一 session 文件内 request/header provider/model 分布：
  `oc-go/deepseek-v4-flash ×141`、`openai-codex/gpt-5.6-luna ×21`、
  `zai/glm-5.3 ×14`——该 session 先后跨三个 provider 被 resume 并真实产出回复
  （Luna 21 turn 来自旧 Spec §8 controlled live acceptance；zai 14 turn 来自
  精确跨度 2026-08-20 21:58 → 2026-08-21 07:13 的 GLM 恢复轮
  GLM-RESTORED-OK）。补充：accepted investigation
  `LUNA_DSH_RC8_VERSION_ALIGNMENT_V1` 在真实 rc.8 harness + 临时 Home +
  fixture credential 下证明 dsh-codex@0.2.3 的 session create/resume 机制
  （cold restart → resume session main）。**边界声明：以上只证明 session
  resume 机制与跨 provider 连续性，不构成、不得写成 Luna credential 就绪
  证据**（rc.8 轮用的是 fixture JWT，非真 credential；见 OBS-004 反证）。
- `OBS-007` — lifecycle 语义锚点。`AGENT_PROCESS_LIFECYCLE_HARDENING_V2`
  （accepted）冻结：`spawn_failed_without_child` = child 从未创建成功的唯一
  terminal 证据类；initialize 失败 = startup bounded reject（created child
  teardown）；prompt admission envelope 含 `not_admitted`（validation/capacity
  fail 或 proven pre-send zero-byte rejection）；prompt receipt watermark 在
  prompt write 前建立；无法证明 admission 假象时必须 `outcome_unknown`。
- `OBS-008` — 新 root 生产会话现状。authsvc Home main session
  （createdAt 2026-08-22T15:24:15，最近 turn 2026-08-23）全部 41 个
  request/header = `oc-go/deepseek-v4-flash`（无 zai、无 openai-codex turn）。
- `OBS-009` — Fleet fallback 提案状态。`DSH_PROVIDER_FALLBACK_CHAIN_V1` 仅存于
  未 merge 分支（proposed），非 accepted authority；其 scope 明确排除
  agt_cto-agent 与显式 override Agent。

## 6. Claims and assumptions

- `CLM-001`（SUPPORTED）— 被替换 Spec 的 authority 覆盖恰好且仅
  agt_cto-agent，whole-authority replacement 不丢弃任何 fleet 级 authority。
  Basis: `EVD-001`。
- `CLM-002`（SUPPORTED）— 同一 DSH session 跨 provider resume 在本 Agent 的
  真实生产历史上成立（OBS-006 三 provider 计数），因此 primary↔fallback 的
  route 切换不会因 session 连续性而结构性阻塞。Basis: `EVD-002`。
- `CLM-003`（SUPPORTED）— Luna fallback leg 当前不可激活：新 Home 无 credential、
  无 plugin。Basis: `EVD-003`。
- `CLM-004`（OPEN_ASSUMPTION）— zai/glm-5.3 在新 authsvc runtime 下可执行
  （旧 root 已证明真实执行；新 root 未执行、zai credential 注入状态未核实）。
  该假设由未来 implementation/acceptance 轮的受控实测关闭，不阻塞本 Spec
  政策冻结。

## 7. Evidence relations

- `EVD-001` — `OBS-001`、`OBS-002` → SUPPORTS `CLM-001` / Gate 判定
  （§3.1）。强度：accepted-spec 正文 + loader 源码级约束双重。局限：无。
- `EVD-002` — `OBS-006` → SUPPORTS `CLM-002`。强度：真实生产 session 文件
  计数 + accepted investigation 机制证明。局限：不证明新 Home、不证明
  credential 就绪（OBS-004 反向成立）。
- `EVD-003` — `OBS-004`、`OBS-005` → SUPPORTS `CLM-003`。强度：直接文件系统
  观测。局限：未读取任何 credential 内容。

## 8. Decisions

- `DEC-001` — 走 SUPERSEDE（whole-authority replacement），不走 AMEND。
  决策人：repository owner（任务指令）。理由：旧 Spec「no automatic fallback
  （任何形态）」是被 accept 的 normative Decision；本 Spec 引入有界 fallback
  是方向性反转，AMEND 的 strictly-additive 条件不满足。替代方案见 ALT-001。
- `DEC-002` — PRIMARY = zai/glm-5.3（目标政策；当前全局 env 现值为
  oc-go/deepseek-v4-flash，如 STATE-002/003 诚实记录）。
- `DEC-003` — SINGLE FALLBACK = openai-codex/gpt-5.6-luna（dsh-codex@0.2.3
  承载）；MAX_FALLBACK_ROUTE_ATTEMPTS = 1；无第二 fallback、无 chain、
  fallback 失败后 fail-loud 终止（不回到 primary 重试、不循环）。
- `DEC-004` — SAFE_FALLBACK = only when prompt admission is proven false。
  触发白名单封闭为 4 类（CTR-003）；白名单之外一律禁止（CTR-004）。
- `DEC-005` — SILENT_FALLBACK = FORBIDDEN；每次 route 决策必须留下 5 字段
  loud evidence（CTR-005）。
- `DEC-006` — 配置静态化：startup-loaded、malformed fail-loud、config change
  requires controlled restart；不做动态 quota router、不做 account pool /
  load balancing（CTR-006/CTR-007）。
- `DEC-007` — Luna 前置条件诚实冻结：LUNA_DIRECT_ROUTE_READY = NO；本轮
  authoring 不复制旧 OAuth secret；fallback 激活被 CTR-008 gate 阻塞直至
  前置条件由独立轮次关闭。
- `DEC-008` — PROXY_SEAM_V1 维持独立 accepted authority；本 Spec 的 fallback
  leg 复用其 providerEnv 契约（不重定义、不 supersede）。Owner decision Q-1
  已于 2026-08-23 裁决关闭：`OWNER_DECISION_Q1 =
  KEEP_TARGET_PROXY_SEAM_AS_SEPARATE_AUTHORITY`；
  `TARGET_PROXY_SEAM_DISPOSITION = METADATA_ONLY_REPOINT_TO
  AGT_CTO_AGENT_GLM53_PRIMARY_LUNA_FALLBACK_V1`；`ABSORB_PROXY_SEAM = NO`
  ——acceptance transaction 仅做基准/依赖 metadata repoint，其 providerEnv
  四键契约与 normative body 不变（§3.3；Q-1 RESOLVED）。
- `DEC-009` — 显式 carry forward 被替换 Spec Amendment 2（A2.1 唯一冻结
  tuple）的 DSH Harness pin：`deepseek-harness 0.1.0-rc.8 @
  514ab7b0029141b88c807704764d0d3e1eea1da4`。在新 authority 另行 supersede
  之前保持有效；实现轮**不得静默升级 Harness**（CTR-011 / MIG-002）。

## 9. Contracts

- `CTR-001`（PRIMARY route）— `agt_cto-agent` 的主路由 = `zai / glm-5.3`。
  当 primary 可用时，禁止任何 fallback 路由调用（primary 成功 ⇒ 零 fallback
  事件、零 Luna 调用）。primary 失败且不满足 CTR-003 时 = 结构化 fail-loud，
  带 PRIMARY_FAILURE_CLASS。
- `CTR-002`（SINGLE fallback route）— 唯一 fallback 路由 =
  `openai-codex / gpt-5.6-luna`，由 `dsh-codex@0.2.3` 承载（exact version pin；
  resolved ≠ 0.2.3（含 0.2.4）→ reject / fail-loud，不得静默放行）。
  `MAX_FALLBACK_ROUTE_ATTEMPTS = 1`：一个 turn 生命周期内至多发生一次
  primary→fallback 的 route 切换、至多一次 fallback route 执行尝试；fallback
  失败 = 该 turn fail-loud 终结（禁止第二 fallback、禁止回落 primary 重试、
  禁止 chain restart）。
- `CTR-003`（SAFE_FALLBACK 白名单，封闭集）— fallback **仅当** prompt admission
  被证明为假（proven false）时允许，且触发类封闭为恰好以下 4 类（语义锚定
  AGENT_PROCESS_LIFECYCLE_HARDENING_V2）：
  1. `spawn_failed_without_child` — child 从未创建成功（V2 唯一合法的
     no-child terminal 证据）；
  2. `initialize provider-unavailable` — initialize/startup 阶段判定 provider
     不可用且 process 未达 READY（未发生任何 prompt admission）；
  3. `session create/resume structured rejection` — session 层结构化拒绝
     （structured、机器可分类；非 timeout、非 unknown）；
  4. `turnQueue not_admitted` — turn admission 返回 V2 `not_admitted`
     envelope（validation/capacity fail 或 proven pre-send zero-byte rejection）。
- `CTR-004`（UNSAFE 边界，封闭禁止集）— 以下任一情形**绝对禁止 fallback**
  （存在即 fail-loud / outcome_unknown，绝不切换路由、绝不 replay）：
  1. `outcome_unknown`（任何来源）；
  2. timeout without proven termination（无终止证明的超时——按 V2 语义归
     outcome_unknown 家族）；
  3. prompt receipt 已发生（active turn watermark 已建立——admission 已被
     证明为真，回退=潜在重复执行）；
  4. partial output（任何已物化/已外显的 assistant 输出）；
  5. tool started（任何 tool call 已 emit/materialize/execute）；
  6. message 已进入 transcript；
  7. provider failure 发生于 admission 之后；
  8. side-effect uncertainty（任何可能的外部副作用未被证明为零）。
  白名单（CTR-003）与禁止集（本条）之外的新失败类 = 默认禁止 fallback，
  分类修订须走 Spec amendment。
- `CTR-005`（Loud evidence，非静默）— `SILENT_FALLBACK = FORBIDDEN`。每次
  route 决策（无论是否触发 fallback）必须在 durable、非 surface 的
  evidence/log 中至少记录以下 5 字段：
  ```text
  PRIMARY_ROUTE           （例：zai/glm-5.3）
  PRIMARY_FAILURE_CLASS   （primary 失败类；无失败 = NONE）
  FALLBACK_ACTIVATED      （YES | NO）
  FALLBACK_ROUTE          （激活时 = openai-codex/gpt-5.6-luna；未激活 = NONE）
  ROUTE_ATTEMPT_COUNT     （本 turn 的 route attempt 计数，≤ 2）
  ```
  字段值必须真实（不得为未发生的尝试伪造 primary 失败或 fallback 事件）；
  不得包含 token、credential 值、Authorization header 或 raw secret-bearing
  provider error body。
- `CTR-006`（静态配置语义）— 本 Spec 的 per-Agent route 政策由 deployment
  authored 静态配置承载（沿用 production-runtime 静态配置惯例，如
  primary-workspaces.json / agent-model-overrides.json 家族：startup 一次性
  加载）；malformed（schema 非法 / 字段缺失 / 引用未注册 provider 或 model /
  duplicate entry）→ startup fail-loud，不得静默忽略或回退默认值；config
  change requires controlled restart（无热 reload、无运行时重选路由）。
- `CTR-007`（禁止机制）— 不建 dynamic quota router；不建 account pool；
  不做 load balancing；fallback 决策不得解析 raw provider error message
  文本（只允许稳定结构化失败类）。
- `CTR-008`（Luna 前置条件 gate 与 credential 边界）—
  `LUNA_DIRECT_ROUTE_READY = NO`（诚实冻结）：新 authsvc Home
  （`/Users/authsvc/.agent-core/homes/agt_cto-agent`）尚无正式 OAuth
  Credential，dsh-codex provisioning 尚未完成。在独立就绪轮完成（a）
  dsh-codex@0.2.3 provisioning 到新 Home、（b）operator 在新 Home 亲自交互式
  OAuth 登录（credential file 0600 / directory 0700）之前，fallback 激活被
  阻塞（激活动作本身仍需另行授权）。本 Spec **不授权**复制旧 root Home 的
  `.openai-codex-auth.json`（OBS-005）到新 Home——复制旧 OAuth secret 不是
  authoring 动作、也不是本 Spec 授予的实现动作；禁止读取/修改
  `~/.codex/auth.json`；禁止 `OPENAI_API_KEY` / API credits 路径；
  token 不得进入 env 传递给非目标进程 / argv / prompt / Feishu 消息 / 日志。
- `CTR-009`（Fleet 隔离）— 本 Spec 仅 `agt_cto-agent`。其余全部 Agent 的
  resolved provider/model、child env、网络路径零变化；不注册任何 fleet 级
  fallback 机制；launchd 全局 env 不因本 Spec 改动。
- `CTR-010`（Session 连续性如实声明）— 引用真实调查与生产证据
  （OBS-006 / CLM-002）：`SESSION_CROSS_PROVIDER_RESUME = YES`；但该事实
  **只**证明 session resume 连续性，**不**得在任何 evidence/acceptance 记录
  中被表述为 Luna credential 就绪或 Luna 直连可用（OBS-004 为反证）。
- `CTR-011`（Harness pin carry-forward）— 显式承接被替换 Spec Amendment 2
  （A2.1 唯一冻结 tuple）的 DSH Harness pin，在新 authority 另行 supersede
  前保持有效：
  ```text
  HARNESS_VERSION = 0.1.0-rc.8                          （deepseek-harness）
  HARNESS_COMMIT  = 514ab7b0029141b88c807704764d0d3e1eea1da4
  PLUGIN          = dsh-codex@0.2.3                     （与 CTR-002 一致）
  ```
  实现轮**不得静默升级 Harness**：resolved harness ≠ 上述 tuple 时保持既有
  `dsh_version_mismatch` fail-loud 语义（如实失败，非回退，且**不属于**
  CTR-003 的 fallback 触发类）；变更该 pin 须由本 Spec 自身的后续 amendment
  显式 supersede 并经独立评审（DEC-009）。

## 10. Acceptance（未来实现轮验收框架；本轮不执行）

| # | 项 | 覆盖 |
|---|---|---|
| ACC-001 | resolved provider/model 硬证据：primary 生效时 session request/header = zai/glm-5.3（防 no-op） | CTR-001 |
| ACC-002 | primary 成功 ⇒ 零 fallback 调用、零 Luna 网络活动（proxy 连接计数为证） | CTR-001/002 |
| ACC-003 | 4 类白名单触发逐一注入测试：各自激活唯一一次 fallback，loud evidence 5 字段齐全 | CTR-003/005 |
| ACC-004 | 8 类禁止情形逐一注入测试：零 fallback、fail-loud/outcome_unknown、无 replay | CTR-004 |
| ACC-005 | MAX_FALLBACK_ROUTE_ATTEMPTS=1：fallback 失败 ⇒ turn 终结，无第二切换、无回落重试 | CTR-002 |
| ACC-006 | 静态配置 malformed 家族（schema/missing/unregistered/duplicate）⇒ startup fail-loud；config 变更仅在 controlled restart 后生效 | CTR-006 |
| ACC-007 | 无 dynamic router / account pool / load balancing 代码路径（结构审查） | CTR-007 |
| ACC-008 | Luna 前置条件 gate：credential/plugin 缺失时 fallback 配置不得激活（fail-loud 或显式 blocked 状态，不静默降级） | CTR-008 |
| ACC-009 | 隔离回归：非目标 Agent resolved route/env 字节不变 | CTR-009 |
| ACC-010 | evidence/log 全量扫描：无 token / credential 值 / raw provider error body | CTR-005/008 |
| ACC-011 | `~/.codex/auth.json` hash/mtime 不变；目标进程 env 无 `OPENAI_API_KEY` | CTR-008 |
| ACC-012 | Harness pin 不变量：resolved harness = `0.1.0-rc.8 @ 514ab7b…`（或已由本 Spec 后续 amendment 显式 supersede 并留痕）；实现轮无静默 Harness 升级 | CTR-011 |

（真实 OAuth、真实 Luna 网络回退、真实手机飞书端到端 fallback 演练属
controlled live acceptance，须在本 Spec accepted 且 CTR-008 前置条件关闭后
另行安排，本轮不冻结为立即可执行项。）

## 11. Alternatives and disposition

- `ALT-001` — AMEND 旧 Spec 增加 fallback：**REJECTED**——旧 Spec 的
  「automatic fallback（任何形态）= Non-Goal / no silent fallback」是已 accept
  的 normative 方向；引入 fallback 是方向反转，违反 AMEND strictly-additive
  条件（DEC-001）。
- `ALT-002` — 维持 Luna 唯一路由不回退（旧 Spec 现状）：**REJECTED**（owner
  direction 2026-08-23：GLM 主路由 + Luna 单一安全回退）。
- `ALT-003` — 为本 Agent 引入 fleet 提案的 3-route chain
  （zai→luna→opencode-go）：**REJECTED**——owner 冻结 SINGLE FALLBACK，
  MAX_FALLBACK_ROUTE_ATTEMPTS = 1；且该提案未 accept、层级不同（DSH
  model-call 层）、scope 明确排除本 Agent。
- `ALT-004` — 在 DSH model-call 层（`agent/request-error` seam）实现本 Agent
  的 provider 切换：**REJECTED**——本 Spec 的安全边界锚定 Agent Core
  admission 层（spawn/initialize/session/turnQueue）；model-call 层切换发生在
  admission 之后，天然落入 CTR-004 禁止域。
- `ALT-005` — 静默 fallback（用户无感知切换）：**REJECTED**——
  SILENT_FALLBACK = FORBIDDEN（DEC-005/CTR-005）。
- `ALT-006` — 复制旧 root OAuth credential 到新 Home 以「顺手」完成就绪：
  **REJECTED**——credential 复制需独立授权与 operator 交互式重登录
  （CTR-008；OBS-005）。
- `ALT-007` — partial supersede（只替换旧 Spec 的路由条款、保留其余）：
  **REJECTED**——governance §9.2 禁止 partial supersession；本 Spec 以整权威
  取代并吸收仍需要的 carry-over 裁决（plugin pin、credential ownership、
  fail-loud 家族、fleet 隔离）。

## 12. Migration, compatibility, and rollback

- `MIG-001` — 替换事务 = §3.3 原子 docs-only transaction；实现轮开始前本
  Spec 必须 accepted 且进入 implementation base（governance §10）。
- `MIG-002` — Carry-over（自旧 Spec 权威域吸收，语义不变）：dsh-codex exact
  version pin 与 fail-loud 家族（CTR-002）；Amendment 2 的 DSH Harness pin
  `0.1.0-rc.8 @ 514ab7b…`（CTR-011，另行 supersede 前有效、实现轮不得静默
  升级）；credential ownership / OAuth
  operator-interactive / 0600-0700 / 不共享 `~/.codex/auth.json`（CTR-008）；
  其他 Agent 零变化（CTR-009）；no silent success with wrong provider
  （CTR-005 的一般化）。旧 Spec 的 oc-go rollback 目标陈述随 supersede 失效，
  由本条 ROLLBACK 取代。
- `ROLLBACK` — 移除本 Spec 的 per-Agent route 配置 + controlled restart ⇒
  该 Agent 回落当前全局 env route（现值 oc-go/deepseek-v4-flash，
  STATE-002；若全局 env 届时已变，以届时全局 env 为准并如实记录）。
  credential 可保留不删；不影响其他 Agent；不回滚 DSH 版本。

## 13. Open questions

- `Q-1`（**RESOLVED**，2026-08-23 owner 裁决，acceptance 前已关闭）—
  acceptance transaction 时
  `AGENT_CORE_CHATGPT_SUBSCRIPTION_TARGET_PROXY_SEAM_V1` 的「扩展
  PROVIDER_V1 seam」基准如何 repoint 到本 Spec：裁决为
  `OWNER_DECISION_Q1 = KEEP_TARGET_PROXY_SEAM_AS_SEPARATE_AUTHORITY`；
  `TARGET_PROXY_SEAM_DISPOSITION = METADATA_ONLY_REPOINT_TO
  AGT_CTO_AGENT_GLM53_PRIMARY_LUNA_FALLBACK_V1`；`ABSORB_PROXY_SEAM = NO`。
  执行形态冻结于 §3.3（仅基准/依赖 metadata repoint；其 providerEnv 四键
  契约与 normative body 不变）。无遗留 open 项。
- `Q-2` — zai/glm-5.3 在新 authsvc runtime 的受控实测（CLM-004）与 zai
  credential 注入状态核实：implementation 轮前置。
- `Q-3` — Luna 就绪轮（provisioning + operator 交互 OAuth 到新 Home）的独立
  授权与执行时序：另行 dispatch。

## 14. Final Output（authoring 轮填写；2026-08-23 revision 轮更新为下述终态）

```text
TASK_NAME = 回退 修订
TASK_STATUS = REVISION_COMPLETE（proposed；READY_FOR_FOCUSED_REVIEW）

SPEC_ID = AGT_CTO_AGENT_GLM53_PRIMARY_LUNA_FALLBACK_V1
SPEC_COMMIT = <revision 轮 commit sha，push 后回填于 PR>
GATE_ANSWER = YES（AGENT_CORE_CHATGPT_SUBSCRIPTION_PROVIDER_V1 仅覆盖 agt_cto-agent）
REPLACES = AGENT_CORE_CHATGPT_SUBSCRIPTION_PROVIDER_V1（whole authority；事务见 §3.3）
GOVERNED_BY = AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0（repoint 自已 superseded
  的 AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1）

OWNER_DECISION_Q1_CLOSED = YES
  OWNER_DECISION_Q1 = KEEP_TARGET_PROXY_SEAM_AS_SEPARATE_AUTHORITY
  TARGET_PROXY_SEAM_DISPOSITION = METADATA_ONLY_REPOINT_TO
    AGT_CTO_AGENT_GLM53_PRIMARY_LUNA_FALLBACK_V1
  ABSORB_PROXY_SEAM = NO
PROXY_SEAM_REPOINT_MODE = METADATA_ONLY（基准/依赖 metadata repoint；
  providerEnv 四键契约与 normative body 不变——§3.2/§3.3/DEC-008/Q-1 RESOLVED）

HARNESS_PIN_CARRIED_FORWARD = YES
  HARNESS = deepseek-harness 0.1.0-rc.8 @
    514ab7b0029141b88c807704764d0d3e1eea1da4（旧 Provider V1 Amendment 2
    A2.1 tuple 原文承接；另行 supersede 前保持有效；实现轮不得静默升级
    ——DEC-009/CTR-011/MIG-002/ACC-012）

PRIMARY_ROUTE = zai / glm-5.3
FALLBACK_ROUTE = openai-codex / gpt-5.6-luna（dsh-codex@0.2.3）
MAX_FALLBACK_ROUTE_ATTEMPTS = 1
SILENT_FALLBACK = FORBIDDEN
NORMATIVE_PRIMARY_FALLBACK_CHANGE = NONE（revision 轮零核心语义变更）

SAFE_FALLBACK_BOUNDARY = only when prompt admission is proven false
  （spawn_failed_without_child / initialize provider-unavailable /
   session create-resume structured rejection / turnQueue not_admitted）
UNSAFE_FALLBACK_BOUNDARY = outcome_unknown / timeout without proven termination /
  prompt receipt 已发生 / partial output / tool started / message 已进入
  transcript / provider failure after admission / side-effect uncertainty
  （及白名单外一切失败类）

LOUD_EVIDENCE_FIELDS = PRIMARY_ROUTE · PRIMARY_FAILURE_CLASS ·
  FALLBACK_ACTIVATED · FALLBACK_ROUTE · ROUTE_ATTEMPT_COUNT

LUNA_DIRECT_ROUTE_READY = NO（新 authsvc Home 无正式 OAuth Credential；
  dsh-codex provisioning 未完成；不复制旧 OAuth secret）
SESSION_CROSS_PROVIDER_RESUME = YES（真实生产证据；≠ Luna credential ready；
  zai 14 turn 精确跨度 2026-08-20 21:58 → 2026-08-21 07:13）

STATIC_CONFIG = startup-loaded · malformed fail-loud · change requires
  controlled restart · no dynamic quota router · no account pool /
  load balancing

SPEC_STATUS = proposed
implementation_authority = none
production_apply_authority = none

PRODUCT_CODE_CHANGE = NONE
CREDENTIAL_CHANGE = NONE
PRODUCTION_CHANGE = NONE
DEPLOYMENT = NONE
MERGE = NONE

NEXT_TASK = 回退 审计
```
