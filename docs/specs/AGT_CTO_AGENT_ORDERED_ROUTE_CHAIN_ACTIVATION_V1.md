---
spec_id: AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_ACTIVATION_V1
status: superseded
accepted_by: mayf3
reviewed_head: f4e1e04aa6725f9652cfabe86ef8c044a92e4e6e
review_verdict: PASS
blocker_count: 0
normative_body_change: NONE
amendment_1: AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_ACTIVATION_V1_AMENDMENT_1_GLM_STRICT_STAGING
amendment_1_status: accepted
amendment_1_accepted_by: mayf3
amendment_1_accepted_date: 2026-08-28
amendment_1_reviewed_head: 4e71fd2db78db9f8b80b8636d6c8255d7764d39a
amendment_1_review_verdict: PASS
amendment_1_blocker_count: 0
amendment_1_normative_body_change: NONE
date: 2026-08-27
type: unified activation-authorizing child Spec (SPEC ONLY — 本轮只冻结三阶段授权边界；不实现、不写凭据、不登录 OAuth、不改配置、不部署、不重启)
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts (gated; Phase A = GATE-1 AND GATE-2; Phase B = GATE-1 AND GATE-2 AND GATE-3; §3)
production_apply_authority: contracts (gated; Phase C = GATE-1 AND GATE-2 AND GATE-3 AND GATE-4; GATE-5 = production activation completion criterion; §3)
parent_policy_authority:
  AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V1
governed_by:
  - AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V1
  - AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_IMPL_V1
  - AGENT_PROCESS_LIFECYCLE_HARDENING_V2
  - SCHEDULER_TIMEOUT_OUTCOME_V2
  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0
external_authorities: []
supersedes: []
superseded_by: AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_ACTIVATION_V2
scope:
  - agt_cto-agent Route Chain 激活的统一 child authority：实现补齐（Phase A）+
    凭据准备（Phase B）+ 生产激活（Phase C）一次冻结为三个**有顺序**的阶段，
    不再拆成「凭据授权 / Harness identity / 配置激活」三份文档（Owner 指令
    2026-08-27，原样冻结）
  - Phase A 最小产品改动：v2 loader routeKind 支持（builtin | subscription）；
    canonical identity 加入 routeKind 与 ABSENT 语义；readHarnessIdentity 受信
    source-stamp fallback
  - Phase B 凭据准备：GLM（settings.yaml zai/glm-5.3 + Owner 交付 ZAI_API_KEY）
    与 Luna（dsh-codex@0.2.3 exact 安装 + Owner 亲自交互式 OAuth 全新生成
    .openai-codex-auth.json），文件 0600 / owner uid 502 / no-tool canary
  - Phase C 激活：部署 route-chain 实现到生产 runtime + 写 agent-model-overrides.json
    version 2（仅 agt_cto-agent；primary = glm53；fallbacks = [luna]）+
    controlled restart / new generation + 强制 canary A–D
  - 生效硬依赖 GATE-2 已满足：PR#77（两份 Amendment 1）accepted **且已由 merge
    commit b620907fc6f58292b6ee096c977f0071921d747e 进入 main**（§3 GATE-2）
owners:
  - repository-maintainers
references:
  - docs/specs/AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V1.md（accepted @ main 7ab2e6d；
    父 policy authority；其 Amendment 1 Builtin Route Kind 已于 2026-08-27 在
    PR#77 acceptance finalize（accepted_by = mayf3；reviewed_head 8b76909；
    链路 内建路由审计 = PASS；blocker 0），并已由 merge commit
    b620907fc6f58292b6ee096c977f0071921d747e 进入 main；GATE-2 = SATISFIED）
  - docs/specs/AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_IMPL_V1.md（accepted @ main 4d92e31；
    sibling 实现授权 child；其 Amendment 1（对齐）同样已随 PR#77 进入 main；
    其 §2.2 冻结「生产配置写入 / 激活」「Credential / provisioning / OAuth」
    「部署 / 重启 / 生产状态」零授权并指向独立轮次——本文件即该独立轮次）
  - docs/specs/AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_CREDENTIAL_V1.md（proposed @
    PR#78 Draft/OPEN，从未 accepted、从未进入 main，不是 active authority；
    其「仅凭据授权」拆分形态被 Owner 指令 2026-08-27 否决并并入本统一 authority
    ——处置见 §3.4；其 §4/§5 的 2026-08-27 同日生产观测被本 Spec 引用并已
    独立只读复核一致）
  - docs/runbooks/deploy-scheduler-v2-production-v1.md（生产 overlay 部署纪律
    先例：冻结 path→blob 清单、唯一合法提取源 git show <commit>:<path>、
    禁止从 worktree/dirty/最新 commit 猜测提取、回滚 = 恢复旧 blob——Phase C
    部署沿该纪律形态，不重开该 runbook 任何内容）
  - docs/runbooks/luna-manual-backup-v1.md（网络事实：chatgpt.com 仅经本地代理
    ClashX 127.0.0.1:7890 可达；其 v1 override 机制已废，仅网络事实被引用）
  - docs/specs/AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1.md（accepted；Broker
    credential 族 authority——与 model-provider credential 分族；沿用其 Part H
    secret-handoff 纪律精神）
---

# AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_ACTIVATION_V1 — agt_cto-agent 路由链激活的统一授权（unified activation-authorizing child authority）

> **Amendment 1（2026-08-28，GLM Strict Staging；accepted）**：文末
> 「Amendment 1」节把激活重排为两个 Stage：STAGE_1 = GLM_STRICT（GLM 以
> strict 单路由正式上线：routeKind = builtin / provider = zai / model =
> glm-5.3 / primary = glm53 / fallbacks = []）与 STAGE_2 =
> LUNA_COLD_FALLBACK_DEFERRED（Luna 冷备候选推迟：不阻塞 Stage 1；Owner 再次
> 明确授权前禁止重新安装 / 重新 OAuth / 刷新凭据 / 生产 Luna model call /
> 进入 override fallbacks[]）；显式 supersede 基础正文中「GLM 与 Luna 凭据
> readiness 一起构成 GATE-4 / Phase B 双块前置」与 CTR-ACT-C103 的
> `fallbacks = [luna]` 配置形态等指名条款；Phase A（已执行、GATE-3 = PASS）
> 与 §9.1 全部安全语义、父 Spec / IMPL 全部 ruling 逐字保持。该 Amendment
> 经独立评审 + Owner acceptance finalize 前，基础正文仍是现行权威。基础
> 正文（§1–§14）保持历史原样，不作改写。
> Acceptance finalize 2026-08-28（模型 执行）：accepted_by = mayf3 ·
> reviewed_head = 4e71fd2db78db9f8b80b8636d6c8255d7764d39a ·
> 模型 审计 = PASS · BLOCKER_COUNT = 0 · NORMATIVE_BODY_CHANGE = NONE
> （lifecycle-only；active-authority 语义按 vendored SPEC_GOVERNANCE_V0
> §2.1——on merge into main；PR #94 保持 OPEN / UNMERGED）。

> SPEC_STATUS = **accepted**（acceptance 2026-08-27，accepted_by = mayf3；
> reviewed_head = `f4e1e04aa6725f9652cfabe86ef8c044a92e4e6e`；review_verdict = PASS；
> blocker_count = 0；normative_body_change = NONE；Draft PR 保持 OPEN / unmerged，
> 本轮不实现、不写凭据、不登录 OAuth、不改配置、不部署、不重启）。
> 本文件是 `AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V1`（accepted，下称**父 Spec**）的
> **最小统一激活 child authority**：父 Spec §13 Q-3 冻结「Luna 就绪轮……的独立
> 授权与执行时序：另行 dispatch」，IMPL 子 Spec §2.2 冻结生产配置写入 / 激活 /
> Credential / 部署 / 重启零授权并指向独立轮次——本文件即该被推迟的独立授权，
> 且按 Owner 指令 2026-08-27 以**单一统一 authority**覆盖激活所需的全部三个
> 有顺序阶段（Phase A 实现补齐 / Phase B 凭据准备 / Phase C 激活），不再拆成
> 「凭据授权 / Harness identity / 配置激活」三份文档。它**不 supersede 任何
> Spec**：父 Spec 保持唯一 model-route policy authority；本 Spec 只在家族已
> 显式预留的缝内，授予有界的实现补齐 + 生产操作权限，并冻结执行轮绑定决策。
>
> **逐阶段授权条件（§3 冻结）**：(GATE-1) 本 Spec `status: accepted` 且已进入
> main；(GATE-2) PR #77 两份 Amendment 1 已 accepted 且已由 merge commit
> `b620907fc6f58292b6ee096c977f0071921d747e` 进入 main（**SATISFIED**）；
> (GATE-3) Phase A 独立实现审计 PASS；(GATE-4) Phase B 凭据 readiness PASS；
> (GATE-5) Phase C 强制 canary A–D 全 PASS。`PHASE_A_ALLOWED = GATE-1 AND
> GATE-2`；`PHASE_B_ALLOWED = GATE-1 AND GATE-2 AND GATE-3`；
> `PHASE_C_ALLOWED = GATE-1 AND GATE-2 AND GATE-3 AND GATE-4`。GATE-5 是
> production activation 的最终完成判据，不是启动 Phase A/B/C 的前置条件；
> GATE-5 未完成前不得宣称 `ACTIVATION_COMPLETE`。本 Spec 虽已 accepted，但在进入
> main 前 GATE-1 仍未满足，因此不授权任何操作。
>
> 本轮（authoring round）DOCS ONLY：不改任何 packages/ 代码，不写任何
> Credential，不执行 OAuth，不安装插件，不写 agent-model-overrides.json，不部署
> 产品代码，不重启任何进程，不触碰 production，不 merge。

---

## 1. Goal

把 agt_cto-agent 初始目标链（父 Amendment 1 A1.4：`glm53`（builtin / zai /
glm-5.3）primary + `luna`（subscription / openai-codex / gpt-5.6-luna @
dsh-codex@0.2.3）fallback）从「代码已实现（PR #76）但生产 inert」推进到「生产
激活并经强制 canary 验证」，转化为最小、有界、可评审的**统一授权**。一次授权
恰好覆盖三个**有顺序**的阶段（Owner 任务指令 2026-08-27 逐项冻结；每项标注
依据）：

| # | 阶段 | 冻结授权范围 | 依据 |
|---|---|---|---|
| A-1 | Phase A | v2 loader 支持 `routeKind = builtin \| subscription`（builtin：plugin/pluginVersion 键必须 ABSENT、不构造 subscription provisioning block；subscription：plugin/pluginVersion 必填 + exact pin） | 父 A1.2；IMPL A1 DEC-IMPL-009/011（既有授权，本 Spec 只绑定排序，§3.3） |
| A-2 | Phase A | canonical identity 加入 routeKind 与 ABSENT 语义（七字段） | 父 A1.3；IMPL A1 DEC-IMPL-010（既有授权，同上） |
| A-3 | Phase A | readHarnessIdentity 受信 source-stamp fallback（git 优先；无 .git 读部署生成的 .source-stamp；exact commit + dirty-count；dirty ≠ 0 / 格式异常 / 缺失均 fail-loud；禁止仅凭 package version；禁止复制 .git 到 production） | 本 Spec 新授权（§8 DEC-ACT-004；agent-provisioning 不在 IMPL §2.1 包范围内） |
| B-1 | Phase B | GLM：settings.yaml 增加 zai/glm-5.3；.credentials.yaml 写入 Owner 提供的 ZAI_API_KEY；不输出 key；credential file 0600；owner uid 502；initialize + no-tool canary | 父 A1.4 `zai-api-key-home`；父 CTR-010；pi-ai `envApiKeyAuth(["ZAI_API_KEY"])` |
| B-2 | Phase B | Luna：安装 dsh-codex@0.2.3 exact；Owner 亲自交互式 OAuth；新生成 .openai-codex-auth.json；禁止复制旧 OpenClaw / 旧 root / ~/.codex/auth.json；auth file 0600；owner uid 502；initialize + no-tool canary | 父 Q-3 / A1.4 `luna-oauth-home`；父 CTR-011/CTR-014 |
| C-1 | Phase C | 部署 route-chain 实现（PR #76 文件集 + Phase A 增量）到生产 runtime（冻结 path→blob 纪律）+ 生成 harness `.source-stamp` | 激活硬前置（§6 CLM-ACT-002/003）；部署纪律先例 |
| C-2 | Phase C | 写入 `agent-model-overrides.json` version 2，仅激活 `agt_cto-agent`：primary = glm53、fallbacks = [luna]，tuple 全量按父 A1.4 | 父 §2 / A1.4；任务指令 |
| C-3 | Phase C | controlled restart / new generation | 父 §2.2 静态配置语义；任务指令 |
| C-4 | Phase C | 强制 canary A–D（§9 CTR-ACT-C104） | 任务指令；父 §10 controlled live acceptance |

本 Spec 新增的唯一规范性内容 = 三阶段的执行轮绑定决策（§8 DEC-ACT-*）与操作
契约（§9 CTR-ACT-*）。全部在父 Spec 与 IMPL 子 Spec 冻结政策内，无一改写其
ruling；执行中发现 Contract 缺口时，走 governance §10 stop → report → 独立
docs-only 变更 → 重启执行。

## 2. Scope and non-goals

### 2.1 In scope（= §1 三阶段；仅 agt_cto-agent 一个 Agent、一个 production Home）

- **Phase A（实现补齐；产品代码 + 测试）**：
  - `packages/production-runtime/src/model-overrides.js`：routeKind 校验族、
    七字段 canonical identity、subscription block 仅 subscription route 构造
    （A-1/A-2；在 IMPL Amendment 1 既有授权内执行，§3.3）；
  - `packages/agent-provisioning/src/index.js`：`readHarnessIdentity`
    source-stamp fallback（A-3；本 Spec 新授权）+ 两者的测试。
- **Phase B（凭据准备；production Home `<HOME>` =
  `/Users/authsvc/.agent-core/homes/agt_cto-agent`）**：
  - GLM：settings.yaml additive zai 块、`.credentials.yaml` 的 `ZAI_API_KEY`
    entry（Owner 亲自交付）、文件 0600 / uid 502、受控 no-tool canary；
  - Luna：`profiles/node_modules` 下 dsh-codex@0.2.3 exact registry 安装 +
    19 项 peerDependencies 预核验 + bundles 原子追加、Owner 亲自交互式 OAuth
    全新生成 `.openai-codex-auth.json`、0600 / uid 502、受控 no-tool canary；
  - Home 目录 mode 唯一冻结为 0755、owner uid 502（见 §8 DEC-ACT-006）；
    HOME_MODE_0700 = OUT_OF_SCOPE / DEFERRED。
- **Phase C（激活；生产 root + runtime）**：
  - 部署 route-chain 实现文件集到生产 runtime 树（冻结 path→blob 清单，唯一
    提取源 = 审计通过的实现 commit；§9 CTR-ACT-C101）；
  - 生成 `/usr/local/libexec/agent-core/harness/.source-stamp`（部署所有，
    exact commit + 诚实 dirtyCount；§9 CTR-ACT-C102）；
  - 写入 `/Users/authsvc/.agent-core/agent-model-overrides.json` version 2
    （仅 `agt_cto-agent`；§9 CTR-ACT-C103）；
  - controlled restart / new generation（§9 CTR-ACT-C105）与强制 canary A–D
    （§9 CTR-ACT-C104）。
- 执行角色冻结：credential 值的输入与 OAuth 登录 = **Owner 亲自**（DEC-ACT-005）；
  机械步骤可由执行 agent 在 Owner 同会话逐步交互中执行（每次一条命令，Owner
  可见可拦）。

### 2.2 Out of scope（明确不授权；执行轮触碰即 out-of-spec）

- **修改其他 Agent**：任何其他 Agent 的 resolved provider/model、child env、
  网络路径零变化（父 CTR-012）；v2 overrides 合法 key 仍恰好 `{agt_cto-agent}`。
- **修改 Scheduler job**：Scheduler store / occurrence / job model 零改动；
  `SCHEDULER_JOB_ROUTE_POLICY = INHERIT_AGENT_CHAIN_ONLY` 原样（父 DEC-013）。
- **修改 Binding / Agent Definition / launchd**：plist 全字节不动；
  `DSH_AGENT_PROVIDER/MODEL`、`DSH_AGENT_CHILD_UID/GID`、`DSH_HARNESS_ROOT`
  等不变；**禁止**把 `ZAI_API_KEY` 或任何 token/secret 写进 launchd env。
- **第二 Feishu consumer**：单一 Feishu WebSocket 保持；不建任何第二出站/
  入站 transport。
- **raw Credential 越过专用 store 边界**：只允许写入 `<HOME>/.credentials.yaml`
  的 `ZAI_API_KEY` 与 `<HOME>/.openai-codex-auth.json`；禁止进入 override、launchd、
  settings.yaml、日志/输出、PR/证据或任何其他非 credential 配置。
- **复制旧 OAuth**（旧 OpenClaw、旧 root、`~/.codex/auth.json`）与复制
  `.git` 到 production：§9 安全边界。
- **per-hop deadline 刷新 / outcome_unknown fallback / 直接把 dsh-codex 当
  ZAI carrier**：父 CTR-005、DEC-IMPL-007、A1.0 EVIDENCE_A1_4 原样禁止。
- **Phase A 范围外产品改动**：`provisionAgentHome` 的 0755/0700 适配
  （DEC-ACT-006 的 deferred 项）、DSH / dsh-codex / pi-ai / harness 任何改动、
  pin 变更——
  均不在 A-1..A-3 清单内，触碰即 out-of-spec（ALT-ACT-009）。
- **父 / IMPL / Amendment 1 Spec 文件改动**：`GOVERNING_SPEC_UNMODIFIED`——
  执行轮不得修改 `AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V1.md`、
  `AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_IMPL_V1.md` 与本文件。
- **共享模板 `profile-production/` 与其他 Agent Home**：零改动。
- **Broker credential 族**（`agent-credentials.json` / auth-service 对象）：
  分族管辖，不碰。

## 3. Authority and dependencies

### 3.1 Gate 确认（任务前置判定，冻结）

```text
AUTHORITY_FORM   = unified activation-authorizing child Spec（不 supersede 任何 Spec）
PARENT_POLICY    = AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V1（accepted @ main 7ab2e6d）
SIBLING_IMPL     = AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_IMPL_V1（accepted @ main 4d92e31）

GATE-1 = 本 Spec accepted AND 已进入 main
GATE-2 = PR #77 两份 Amendment 1 accepted AND 已进入 main = SATISFIED
         （acceptance finalize：417247d，2026-08-27，accepted_by = mayf3，
          reviewed_head 8b76909，链路 内建路由审计 = PASS，blocker 0；
          merge commit = b620907fc6f58292b6ee096c977f0071921d747e）
GATE-3 = Phase A 独立实现审计 PASS（审计对象 = A-1..A-3 + 测试 + SPEC_COMPLIANCE）
GATE-4 = Phase B 凭据 readiness PASS（两 canary + 全部 ACC-ACT B 族）
GATE-5 = Phase C 强制 canary A–D 全 PASS（production activation 最终完成判据）

PHASE_A_ALLOWED = GATE-1 AND GATE-2
PHASE_B_ALLOWED = GATE-1 AND GATE-2 AND GATE-3（阶段有顺序：A 审计通过后才开工 B）
PHASE_C_ALLOWED = GATE-1 AND GATE-2 AND GATE-3 AND GATE-4
GATE_5_ROLE = COMPLETION_CRITERION
ACTIVATION_COMPLETE = GATE-5（GATE-5 未完成前不得宣称 ACTIVATION_COMPLETE；
                              GATE-5 不是启动 Phase A/B/C 的前置条件）

IMPLEMENTATION_ALLOWED_NOW = NO（accepted but unmerged；GATE-1 未满足；GATE-2 已满足）
PRODUCTION_OPERATIONS_ALLOWED_NOW = NO（accepted but unmerged；GATE-1 未满足；GATE-2 已满足）
```

- 与父 Spec 的分工：父 Spec = 路由政策与 schema authority；IMPL 子 Spec = 链
  机制实现授权（已完成，PR #76）；本 Spec = **激活路径**的授权与执行轮绑定
  （实现补齐谁做、凭据怎么就绪、生产怎么激活）。政策语义冲突时以父 Spec 为准，
  本 Spec 对应条文自动失效并触发 governance §10 gap 流程。
- 生效顺序冻结：PR #77 已进入 main，GATE-2 = SATISFIED；**执行**（Phase A
  第一个代码改动）仍必须在 GATE-1 AND GATE-2 同时成立后开始。每个 Phase 开工
  时必须 fresh-fetch 核验 gate 并记录 commit 坐标。
- 与 `DSH_PROVIDER_FALLBACK_CHAIN_V1`（proposed，未 merge）无关：父 Spec
  ALT-007 已拒绝该层实现链；PR #60 处置不变（`ABANDONED_UNMERGED_CANDIDATE`）。

### 3.2 PR #77 依赖（任务给定，冻结）

```text
PR77_ROLE            = 父 + IMPL 两份 Amendment 1 的载体（Builtin Route Kind）
PR77_ACCEPTED        = YES（417247d acceptance finalize 2026-08-27）
PR77_IN_MAIN         = YES
PR77_MERGE_COMMIT    = b620907fc6f58292b6ee096c977f0071921d747e
GATE-2               = SATISFIED
AMENDMENT_EFFECTIVE_ON_MERGE = YES（SPEC_GOVERNANCE_V0 §2.1）
```

理由（机械）：`routeKind = builtin` 的配置语法、`zai-api-key-home` /
`luna-oauth-home` 两个 credentialReadiness reference、七字段 canonical
identity、初始链 tuple（A1.4）全部由 Amendment 1 冻结；这些 authority 已随
PR #77 进入 main，因此 Phase A/Phase C 的该项 schema 依赖已经满足。

### 3.3 与 IMPL 子 Spec Amendment 1 的授权分工（无双重授权）

Phase A 的 A-1/A-2（loader routeKind 校验族、七字段 canonical identity、
subscription block 条件化构造）的**规范授权已经由** IMPL Amendment 1
（DEC-IMPL-009/010/011/012，accepted @ PR #77）**给出**。本 Spec 对 A-1/A-2
**只绑定排序与验收归并**（与 A-3 同一实现轮执行、同一审计 GATE-3 覆盖），不
重复授予——避免同一产品改动的 dual-current 授权。本 Spec 的**新**实现授权
仅 A-3（readHarnessIdentity source-stamp fallback）：`packages/agent-provisioning`
不在 IMPL §2.1 的包范围内（production-runtime / agent-router /
scheduler-router），且该改动是 PR #78 同日实证登记的激活 blocker
（OBS-ACT-003/004）的受控修复。

### 3.4 PR #78 处置（冻结）

```text
PR78_DISPOSITION     = CONSOLIDATED_UNMERGED_CANDIDATE
PR78_ACTIVE_AUTHORITY = NO（proposed；从未 accepted、从未进入 main）
PR78_MUST_CLOSE      = YES（推荐关闭，永不 merge）
PR78_MUST_NOT_MERGE  = YES
ACTIVATION_SUPERSEDES_PR78 = NO（无 authority lineage 可 supersede）
```

PR #78（`AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_CREDENTIAL_V1`，Draft/OPEN，head
3a655a5）是「仅凭据授权」的拆分候选。Owner 指令 2026-08-27（NEW_EVIDENCE，
原样引用）：「创建一份最小、统一的 Route Chain 激活 child authority，不要
再拆成『凭据授权 / Harness identity / 配置激活』三份文档」。本 Spec 把其
授权内容吸收重冻为 Phase B（含其全部安全边界；Home mode 由 DEC-ACT-006
裁决），并
按三阶段统一扩展。PR #78 的 lifecycle 关闭动作不在本轮授权内（本轮零 PR
lifecycle mutation）；其 §4/§5 的 2026-08-27 同日生产观测被本 Spec §4/§5
引用并已独立只读复核一致（见 OBS-ACT-006..008）。

## 4. Current State（只读核实；2026-08-27，base 含 PR #77 merge commit `b620907`）

- `STATE-ACT-001` — main `c52bd1c` 已含 PR #76 链实现（v2 loader、统一
  chain executor、route-gate、journal），但 loader 仍按基础（plugin 必填）
  schema 校验；生产 runtime 部署基线**不含** PR #76（调度部署 runbook：
  PR76_EXCLUDED = YES）。链代码在 main 与生产均 inert（生产 root 无 override
  文件）。Basis: `OBS-ACT-002`、`OBS-ACT-005`。
- `STATE-ACT-002` — PR #77 两份 Amendment 1 已 accepted（417247d，
  2026-08-27），并已由 merge commit `b620907fc6f58292b6ee096c977f0071921d747e`
  进入 main；GATE-2 = SATISFIED。Basis: `OBS-ACT-001`。
- `STATE-ACT-003` — 生产 harness（`/usr/local/libexec/agent-core/harness`）=
  0.1.0-rc.8、authsvc 属主、**无 `.git`**：`readHarnessIdentity()`（git
  rev-parse）在生产不可执行 ⇒ 任何携带 subscription block 的 spawn（激活后
  luna fallback hop）在 `provisionExactProfilePlugin` 的 identity 核验处
  fail-loud（`dsh_commit_mismatch` 族，按父 CTR-011 不属于 fallback 触发类）。
  Basis: `OBS-ACT-003`、`OBS-ACT-004`。
- `STATE-ACT-004` — production Home 现状：目录 0755（yanfenma/502）；
  settings.yaml（500B, 0600）无 zai 块，`agent-default-model =
  opencode-go/deepseek-v4-flash`；`.credentials.yaml`（172B, 0600，内容未
  读取）；profiles/node_modules 无 dsh-codex；无 `.openai-codex-auth.json`。
  Basis: `OBS-ACT-006`。
- `STATE-ACT-005` — 当前有效路由 = 全局 env route `oc-go/deepseek-v4-flash`
  （launchd `ai.agent-core.runtime`，authsvc(505) 运行，child uid 502）；
  生产 root `agent-model-overrides.json` ABSENT；launchd env 无 ZAI /
  OPENAI / proxy 变量。Basis: `OBS-ACT-005`、`OBS-ACT-007`。
- `STATE-ACT-006` — dsh-codex@0.2.3 的 19 项 peerDependencies 在 production
  Home `profiles/node_modules` 下已全部可解析（symlink 指向生产 harness）。
  Basis: `OBS-ACT-008`（PR #78 OBS-C-007 同日观测）。
- `STATE-ACT-007` — 网络事实：chatgpt.com 后端仅经本地代理（ClashX
  127.0.0.1:7890）可达（旧 root 时代实测；执行轮需现场复核）。Basis:
  `OBS-ACT-008`（PR #78 OBS-C-010 / luna runbook §0/§1）。

## 5. Observations（只读，2026-08-27）

### A. 权威与代码事实（base 含 PR #77 merge commit `b620907`）

- `OBS-ACT-001` — PR #77 已进入 main。`417247d` = AGT_CTO_ROUTE_CHAIN_BUILTIN_
  ROUTE_KIND_AMENDMENT_1_ACCEPTANCE_FINALIZE（两份 Amendment 1 同时 proposed →
  accepted；accepted_by = mayf3；accepted_date = 2026-08-27；reviewed_head =
  `8b76909`；链路 内建路由审计 = PASS；blocker 0；NORMATIVE_BODY_CHANGE = NONE）；
  merge commit = `b620907fc6f58292b6ee096c977f0071921d747e`。两份 Spec frontmatter
  `amendment_1_status: accepted`；PR77_IN_MAIN = YES；GATE-2 = SATISFIED。
- `OBS-ACT-002` — main `c52bd1c` loader 现状（Phase A 对齐对象）。
  `packages/production-runtime/src/model-overrides.js`：`:313-318` routeCatalog
  entry 键集仍含 plugin/pluginVersion 必填；`:321-325` dsh-codex pin 校验；
  `:231-244` `catalogCanonicalIdentity` 六字段（无 routeKind）；
  `:252-273` `makeChainRoute` **无条件**构造 `subscription` block（含
  dshVersion/dshCommit/credentialFile 常量）。
- `OBS-ACT-003` — `packages/agent-provisioning/src/index.js` identity 现状。
  `:82-97` `readHarnessIdentity`：读 harness `package.json` version +
  `spawnSync('git', ['-C', root, 'rev-parse', 'HEAD'])`；git 失败 ⇒
  `dsh_commit_mismatch`（"cannot verify DSH commit"）fail-loud；返回
  `{version, commit}`，无任何 stamp fallback。`:127-` `provisionExactProfilePlugin`：
  `:138` `identity = options.harnessIdentity ?? readHarnessIdentity(...)`，
  `:140-143` version/commit 与 pin 逐字相等校验，位于 installed-check **之前**。
  `:367-` `provisionAgentHome`（Router 内每次 spawn 幂等重跑；其源码注释自证
  「an operator-owned 0755 home remains a fail-loud activation prerequisite」）。
- `OBS-ACT-009` — 部署面。PR #76 实现 = 14 个文件（8 源码 + 6 测试：
  agent-router 的 index/ingress-delivery/process-registry-route-gate/
  process-registry/route-chain、production-runtime 的 compose/model-overrides、
  scheduler-router 的 index + 各测试）；Phase A 增量 = model-overrides.js /
  compose.js（再次修改）+ agent-provisioning/src/index.js（新增修改面）+ 测试。
  生产 runtime 树（/usr/local/libexec/agent-core/app，system/
  ai.agent-core.runtime 服务）当前基线不含 PR #76。

### B. 生产事实（本 authoring 轮独立只读复核，与 PR #78 同日观测一致）

- `OBS-ACT-004` — `ls /usr/local/libexec/agent-core/harness/.git` = ENOENT；
  `package.json` version = 0.1.0-rc.8；owner authsvc。
- `OBS-ACT-005` — `ls /Users/authsvc/.agent-core/agent-model-overrides.json`
  = ENOENT。
- `OBS-ACT-006` — `stat`：`<HOME>` = drwxr-xr-x（0755）yanfenma(502)；
  settings.yaml 与 .credentials.yaml 均 `-rw-------`（0600）yanfenma（500B /
  172B；**内容未读取**）；`profiles/node_modules` 无 dsh-codex entry；
  `.openai-codex-auth.json` ENOENT。
- `OBS-ACT-007` — `plutil -p /Library/LaunchDaemons/ai.agent-core.runtime.plist`：
  UserName = authsvc；`DSH_AGENT_CHILD_UID=502`、`DSH_AGENT_CHILD_GID=20`、
  `DSH_AGENT_PROVIDER=oc-go`、`DSH_AGENT_MODEL=deepseek-v4-flash`、
  `DSH_HARNESS_ROOT=/usr/local/libexec/agent-core/harness`；无任何 ZAI /
  OPENAI / proxy 变量。
- `OBS-ACT-008` — 引用 PR #78 spec 同日（2026-08-27）只读观测（本轮独立
  复核一致的部分已单列为 OBS-ACT-004..007；以下为引用项）：(a) 全部 96 个
  活动 production Home 均 0755(uid 502)，`agt_cto-agent.pre-permrepair-
  20260822-061954`（0700）为 2026-08-22 权限修复存留——Home 0700 在 authsvc
  provisioner 下会令下一次 spawn EACCES fail-loud（PR #78 OBS-C-005/006 源码
  级证明）；(b) dsh-codex@0.2.3 的 19 项 peerDependencies 在 Home
  profiles/node_modules 下 19/19 可解析（PR #78 OBS-C-007）；(c) 旧 root
  settings.yaml 的 zai 块 grammar 先例 `zai: { apiKeyEnv: ZAI_API_KEY,
  models: [{id: glm-5.3}] }`（PR #78 OBS-C-009，仅形态）；(d) chatgpt.com
  仅经 ClashX 127.0.0.1:7890 可达（PR #78 OBS-C-010）。

## 6. Claims and assumptions

- `CLM-ACT-001`（SUPPORTED）— Phase A 的 A-1/A-2 已有授权（IMPL Amendment 1
  已随 PR #77 进入 main），本 Spec 无需也不得重复授予；A-3 是净新授权面。
  Basis: `EVD-ACT-001`。
- `CLM-ACT-002`（SUPPORTED）— Phase A 是 Phase C 的硬前置：(i) 不做 A-1/A-2，
  v2 配置中的 builtin glm53 route 在 main/生产 loader（plugin 必填）下
  malformed fail-loud（OBS-ACT-002）；(ii) 不做 A-3，激活后任何 luna
  subscription spawn 在 readHarnessIdentity 处 fail-loud（STATE-ACT-003）。
  Basis: `EVD-ACT-002`。
- `CLM-ACT-003`（SUPPORTED）— Phase C 内部存在强制顺序：**先部署代码并
  controlled restart，后写 v2 配置**。反向顺序会让现行运行中的 v1 loader 在
  per-spawn re-read（compose.js `:218` resolveRouteChain 每次调用重读）命中
  version ≠ 1 的 v2 文件 ⇒ agt_cto-agent 在配置写入到重启之间的每次 spawn
  fail-loud（目标 Agent 服务中断窗口）。Basis: `EVD-ACT-003`。
- `CLM-ACT-004`（SUPPORTED）— 生产现状对链代码 inert 且 fleet 直通：生产
  无 override 文件（OBS-ACT-005），部署后、配置写入前，全部 Agent（含
  agt_cto-agent）resolved route = global env route，字节等价于现状（PR #76
  passthrough 语义 + 父 CTR-012）。Basis: `EVD-ACT-004`。
- `CLM-ACT-005`（SUPPORTED）— canary A–D 的判定字段已被 PR #76 实现为
  journal 冻结字段集（ROUTE_CHAIN_ID / ATTEMPT_INDEX / ROUTE / FAILURE_CLASS /
  ADMISSION_PROVEN / ATTEMPT_OUTCOME + FINAL_ROUTE / FINAL_OUTCOME /
  TOTAL_ROUTE_ATTEMPTS + PRIMARY_ROUTE / FALLBACK_ACTIVATED /
  FALLBACK_ROUTE），部署后即可机械取证。Basis: `EVD-ACT-005`。
- `CLM-ACT-006`（OPEN_ASSUMPTION，owned）— 生产 harness 树与 pin commit
  `514ab7b…` 的逐字节一致性未经证明：`.source-stamp` 的 dirtyCount 只能由
  执行轮以受控比对（installed tree vs 该 commit 干净 checkout）诚实测定；
  若实测 dirtyCount ≠ 0，luna 路由激活 BLOCKED（fail-loud），处置归 Owner
  （Q-ACT-2 记录）。Basis: OBS-ACT-004 + 父 CTR-011。

## 7. Evidence relations

- `EVD-ACT-001` — `OBS-ACT-001`、`OBS-ACT-002` → SUPPORTS `CLM-ACT-001` /
  §3.3。强度：PR #77 分支 frontmatter + main 源码逐点。局限：无。
- `EVD-ACT-002` — `OBS-ACT-002`、`OBS-ACT-003`、`OBS-ACT-004` → SUPPORTS
  `CLM-ACT-002`。强度：main loader/provisioner 源码 file:line + 生产 stat。
  局限：fail-loud 路径的动态演示属 Phase A 测试与 GATE-3 审计。
- `EVD-ACT-003` — `OBS-ACT-002`（compose.js `:217-221` startup 一次加载 +
  process-boundary re-read 语义）→ SUPPORTS `CLM-ACT-003`。强度：源码语义
  （PR #76 实现 + IMPL OBS-IMPL-005 同口径）。局限：执行轮 runbook 以部署
  实测复核。
- `EVD-ACT-004` — `OBS-ACT-005`、`OBS-ACT-007`、`OBS-ACT-009` → SUPPORTS
  `CLM-ACT-004`。强度：生产只读 + 部署基线记录。局限：部署后健康核验属
  ACC-ACT-C 族。
- `EVD-ACT-005` — PR #76 实现记录（journal 字段集，origin/main 源码）→
  SUPPORTS `CLM-ACT-005`。强度：实现源码。局限：生产 journal 取证属 canary。

## 8. Decisions（执行轮绑定；全部在父 Spec / IMPL 政策内）

- `DEC-ACT-001` — **authority 形态 = 单一统一激活 child Spec，supersedes =
  []，三阶段一次冻结**。决策人：repository owner（任务指令 2026-08-27 原文：
  不要再拆成三份文档）。替代方案 ALT-ACT-001/002。不加改父 Spec 与 IMPL 的
  任何 `*_authority` 字段；GOVERNING_SPEC_UNMODIFIED 对三者同时生效。
- `DEC-ACT-002` — **阶段顺序 = 严格 A → B → C**：PHASE_B_ALLOWED 需 GATE-3
  （Phase A 独立实现审计 PASS）；PHASE_C_ALLOWED 需 GATE-4（凭据 readiness
  PASS）。Phase B 内部 GLM 与 Luna 两块可同轮完成，无强制先后，但两块全部
  PASS 才算 GATE-4。明令：未完成 Phase A/B 即执行 Phase C = FORBIDDEN（任务
  指令原文）。
- `DEC-ACT-003` — **Phase A 实现轮 = 单一 PR 覆盖 A-1/A-2/A-3**：A-1/A-2 按
  IMPL Amendment 1（DEC-IMPL-009/010/011/012）既有授权执行，A-3 按本 Spec
  授权执行；实现 PR 记录义务沿用 CTR-IMPL-010 形态（PRIMARY_GOVERNING_SPEC
  = 本 Spec；RELATED_ACCEPTED_AUTHORITIES = 父 Spec + IMPL（含各自 Amendment
  1）+ V2 lifecycle + Scheduler V2；IMPLEMENTATION_BASE_COMMIT /
  GOVERNING_SPEC_COMMIT_OR_BLOB / IMPLEMENTATION_COMMIT 全记录），实现后输出
  SPEC_COMPLIANCE。实现 base = 已含 PR #77 两份 Amendment 1 的 main（即
  GATE-2 的 in-main 半成立后的最新 main）。
- `DEC-ACT-004` — **readHarnessIdentity source-stamp fallback 冻结形态**：
  (i) 解析顺序：先 git identity（`git -C <harnessRoot> rev-parse HEAD`）；仅
  当 git 不可用（无 `.git` / rev-parse 失败）时读取 `<harnessRoot>/.source-
  stamp`；git 可用时 stamp 被忽略（优先 git identity）。
  (ii) stamp 文件 = 部署生成的**单一 JSON 对象文件**，位于 harness root，
  键集恰为 `{"commit": <string>, "dirtyCount": <integer>}`：`commit` 必须
  是 40 字符小写 hex；`dirtyCount` 必须是 ≥ 0 的整数；任何额外键、缺键、
  非 JSON、非 string commit、非 hex、非整数 dirtyCount = 格式异常。
  (iii) fail-loud 家族（**不新增失败类**，全部映射到既有
  `dsh_commit_mismatch` code，消息区分来源）：`dirtyCount ≠ 0`（树相对
  commit 不干净 = identity 不精确）；格式异常；git 不可用且 stamp 缺失。
  (iv) commit identity **永不**仅凭 package.json version（version 仍按现行
  语义与 pin 并行校验，`dsh_version_mismatch` 不变）。
  (v) 复制 `.git` 到 production = FORBIDDEN（任务指令原文）；stamp 不是
  `.git` 的替代物之外的新信任面——它由部署进程生成并归部署所有。
  (vi) `provisionExactProfilePlugin` 的调用序与既有 pin 校验语义零变化
  （identity 仍先于 installed-check；mismatch 仍非 fallback 触发类）。
- `DEC-ACT-005` — **key 交付与 OAuth 主体 = Owner 亲自**（承接 PR #78
  DEC-C-001 全文语义）：`ZAI_API_KEY` 明文与 ChatGPT OAuth 登录只能由 Owner
  本人完成/输入；唯一允许的受控 credential store 为 `<HOME>/.credentials.yaml`
  （键恰为 `ZAI_API_KEY`）与 `<HOME>/.openai-codex-auth.json`（Owner 交互式 OAuth
  全新生成），二者均 owner uid 502 / mode 0600。值不经 agent 会话、prompt、
  argv、日志、Feishu、commit、PR、证据，也不写入 override、launchd、
  settings.yaml 或任何其他非 credential 配置；执行 agent 只做写入前后**元数据**
  核验（key 名存在、非空、mode/owner 正确）与行为 canary，**永不读取/回显值
  本身**。OAuth = Owner 交互式执行 dsh-codex login（`DSH_HOME=<HOME>` 下
  production profile），一次性落盘。
- `DEC-ACT-006` — **Home 目录 mode 唯一冻结**：Owner 已裁决
  `HOME_DIRECTORY_MODE = 0755`、`HOME_OWNER_UID = 502`。Phase B/C 全程 Home
  目录保持 0755，不授权 chmod 0700；敏感文件 `settings.yaml`、
  `.credentials.yaml`、`.openai-codex-auth.json` 均为 0600 / uid 502。
  `HOME_MODE_0700 = OUT_OF_SCOPE / DEFERRED`：只有未来完成 cross-UID
  provisioner 适配并取得独立 authority 后，才可重新讨论。本 Spec 不保留 0700
  Owner 选择题。Basis: OBS-ACT-008(a)（0700 会令当前 authsvc provisioner 在
  下一次 spawn EACCES fail-loud）。
- `DEC-ACT-007` — **GLM settings 编辑形态**（承接 PR #78 DEC-C-003）：仅向
  `llm-pi-ai.providers` 追加 zai 块（grammar = OBS-ACT-008(c) 先例：
  `apiKeyEnv: ZAI_API_KEY` + `models: [{id: glm-5.3}]`）；`agent-default-model`
  与其余既有键**逐字节保留**；原子替换（同目录 temp + rename）；编辑前后各
  一份时间戳 `.bak`（settings.yaml 非 secret，允许；`.credentials.yaml`
  **禁止**任何明文备份）；编辑后 0600 / uid 502。
- `DEC-ACT-008` — **probe 隔离**（承接 PR #78 DEC-C-004）：Phase B 两 canary
  = 受控一次性 DSH 进程，yanfenma(502)（child uid）运行、`DSH_HOME=<HOME>`、
  显式指定被测 route（zai/glm-5.3；openai-codex/gpt-5.6-luna）、scratch 工作
  目录；零 Router ingress / Feishu 消息 / Scheduler 任务；选择无在途 CTO
  生产 turn 的窗口；pass 判据 = provider initialize 成功 + 恰好一个 no-tool
  turn 完成（零 tool call）；输出遵守 §9 redaction。Luna probe 前置：出网经
  本地代理（现场复核）；代理 env **仅**设在一次性 probe 进程，不写任何持久
  位置（providerEnv 四值作为 v2 配置内容在 Phase C 写入，见 DEC-ACT-011）。
- `DEC-ACT-009` — **Luna 安装形态**（承接 PR #78 CTR-C-205..207）：operator-
  side 精确安装 `npm install --prefix <HOME>/profiles --no-save
  --no-package-lock --ignore-scripts dsh-codex@0.2.3`（uid 502；registry 类
  受信源，禁旧 root 拷贝）；installed version === "0.2.3" exact fail-loud；
  19 项 peers 预核验全过**后**才向
  `<HOME>/profiles/agent-core-production/package.json` 的 `dsh.profile.bundles`
  原子追加 `"dsh-codex"`（其余字节不变；共享模板零触碰）。
- `DEC-ACT-010` — **Phase C 部署纪律**：route-chain 实现文件集（PR #76 的
  生产服务文件 + Phase A 增量）按冻结 path→blob 清单部署到生产 runtime 树；
  唯一合法提取源 = `git show <audited-commit>:<path>`（GATE-3 审计通过的
  实现合并 commit）；从 worktree / dirty checkout / 最新 commit 猜测提取 =
  FORBIDDEN；回滚 = 恢复部署前 blob（清单逐条记录）。部署清单在执行轮
  runbook 冻结（含测试文件是否随现行生产树形态的裁决）。
- `DEC-ACT-011` — **v2 配置写入形态**：内容 = 父 A1.4 冻结 tuple 全量（§9
  CTR-ACT-C103 逐字给出）；luna 的 providerEnv 四键 closed object 的**形态**
  按父 CTR-010/014，四**值** = 执行轮现场核验的部署事实（代理可达性按
  OBS-ACT-008(d) 现场复核；`NODE_USE_ENV_PROXY = "1"` 固定；URL/NO_PROXY
  grammar 按 CTR-010 校验通过）；文件含零 secret（CTR-010）。文件落生产
  root，owner = authsvc(505)、mode 0644（runtime 启动读取的非 secret 部署
  配置；与生产 root 既有配置文件形态一致，执行轮以届时 root 实际形态复核
  并记录）。
- `DEC-ACT-012` — **激活顺序冻结**：(1) 部署（代码就位，Router 仍运行旧
  代码）；(2) controlled restart（新代码 live；override 文件仍 ABSENT ⇒ 全
  Agent 直通 global env route，字节等价）；(3) restart 后健康核验（runtime
  up、单 Feishu WebSocket、非目标 Agent spawn 正常、agt_cto-agent 以全局
  env route spawn 正常）；(4) 写入 v2 配置；(5) 激活 = 下一次受控 new
  generation（下一真实 turn 由 chain executor 以 process-boundary snapshot
  读取 v2 配置；若届时部署实现的加载语义要求 config-change restart，则再
  一次 controlled restart——父 §2.2「config change requires controlled
  restart」语义优先，**绝不** watcher / 热更新）；(6) canary A–D。反向顺序
  （配置先于代码部署/restart）= FORBIDDEN（CLM-ACT-003）。
- `DEC-ACT-013` — **canary 注入边界**：canary B/C 需要有界、可逆、可清除的
  注入向量（使 glm53 产生白名单类 pre-admission 失败 / outcome_unknown），
  由执行轮在以下边界内选定并全程记录：只作用于 glm53 route 或其 credential
  读取路径；不触碰 luna 凭据；不暴露 secret；不影响其他 Agent；用后恢复并
  复验（ACC-ACT-C9）。canary 的对外可观察面（真实回复 / 失败回执）由
  Owner 亲测；attempt 计数与 STOP_CHAIN 判定以 journal 结构化字段为准——
  技术探针与 Owner 真实验收互不替代（部署 runbook G 门先例语义）。
- `DEC-ACT-014` — **restart 边界**：controlled restart = 对
  system/ai.agent-core.runtime 的受控重启 + agt_cto-agent 的受控 new
  generation；重启窗口由 Owner 选定（尽量无在途 turn：CTO 侧可核验零在途；
  共享 runtime 上其他 Agent 的在途 turn 按既有运维惯例评估并如实记录）；
  restart 不改 launchd plist；重启次数 = 激活所需的最少受控次数（DEC-ACT-012
  的 (2) 与可能的 (5)），无其他重启。

## 9. Contracts（CTR-ACT-*；A = Phase A，B = 凭据，C = Phase C）

### 9.1 安全边界（全阶段适用；违反即 out-of-spec + 事故记录）

```text
RAW_CREDENTIAL_IN_OVERRIDE = FORBIDDEN
RAW_CREDENTIAL_IN_LAUNCHD = FORBIDDEN
RAW_CREDENTIAL_IN_SETTINGS_YAML = FORBIDDEN
RAW_CREDENTIAL_IN_LOGS_OR_OUTPUT = FORBIDDEN
RAW_CREDENTIAL_IN_ANY_NON_CREDENTIAL_CONFIG = FORBIDDEN
唯一受控 credential store（GLM）= $DSH_HOME/.credentials.yaml；键 = ZAI_API_KEY；owner uid 502；mode 0600
唯一受控 credential store（Luna）= $DSH_HOME/.openai-codex-auth.json；owner uid 502；mode 0600；Owner 交互式 OAuth 全新生成
settings.yaml 仅允许模型声明与 apiKeyEnv 引用，不得包含 raw key
raw credential 进入 agent 会话 / prompt / argv / stdout / 日志 / Feishu / PR / 证据 —— 禁止
复制旧 OpenClaw / 旧 root OAuth / ~/.codex/auth.json（含读取后转写）—— 禁止
复制 .git 到 production（含部分复制 / symlink）—— 禁止
.credentials.yaml / .openai-codex-auth.json 的明文备份或第二副本 —— 禁止
读取 credential 值用于“验证”（验证 = 元数据 + 行为 canary）—— 禁止
编辑 settings.yaml 时改动 agent-default-model 或其余既有键 —— 禁止
bundles 注册未过 19/19 peers 预核验即触碰 profile package.json —— 禁止
修改共享模板 profile-production/ / 其他 Agent Home / 其他 Agent —— 禁止
修改 Scheduler job / Binding / Agent Definition / launchd plist —— 禁止
第二 Feishu consumer / 第二出站 transport —— 禁止
per-hop deadline 刷新 / outcome_unknown fallback —— 禁止（父 CTR-005 /
DEC-IMPL-007 原样）
直接把 dsh-codex 当 ZAI carrier（fake carrier）—— 禁止（A1.0 EVIDENCE_A1_4）
未完成 Phase A/B 即执行 Phase C —— 禁止（任务指令原文）
执行任何尚未满足对应阶段 gate 的操作 —— 禁止
修改父 / IMPL / 本 Spec 文件 —— 禁止（GOVERNING_SPEC_UNMODIFIED）
```

### 9.2 Phase A contracts（CTR-ACT-A*）

- `CTR-ACT-A01`（A-1/A-2 绑定，实现按 IMPL A1 授权）— loader 对齐逐字执行
  IMPL Amendment 1 `DEC-IMPL-009/010/011/012` + 父 Amendment 1 `A1.2/A1.3`
  的全部校验语义（routeKind closed enum；builtin plugin/pluginVersion 键
  存在即 malformed；subscription 必填 + exact pin（dsh-codex = 0.2.3）；
  七字段 canonical identity（plugin-or-ABSENT）；builtin processConfig 无
  subscription block；journal 字段集零新增）。验收 = 父 A1.6 ACC-016..019
  归并入本 Spec GATE-3 审计。本 Contract 不重复展开语义——冲突时以两份
  Amendment 1 为准。
- `CTR-ACT-A02`（A-3 readHarnessIdentity fallback）— 按 DEC-ACT-004 冻结
  形态实现：(i) git 优先，git 不可用时读 `<harnessRoot>/.source-stamp`；
  (ii) stamp = 单一 JSON 对象，键集恰 `{commit, dirtyCount}`，commit =
  40 字符小写 hex、dirtyCount = ≥0 整数；(iii) `dirtyCount ≠ 0` / 格式
  异常 / git 与 stamp 双缺 ⇒ 既有 `dsh_commit_mismatch` code fail-loud
  （消息区分 dirty / malformed / missing，不新增失败类、不回显 stamp 原文
  之外的任何值——stamp 本身非 secret，允许记录 commit 与 dirtyCount 数值）；
  (iv) commit identity 永不仅凭 package version；(v) `.git` 复制进
  production = FORBIDDEN；(vi) `provisionExactProfilePlugin` 调用序与 pin
  校验语义零变化。
- `CTR-ACT-A03`（A-3 测试族）— 单元测试至少覆盖：git 可用 ⇒ git identity
  生效（stamp 被忽略）；无 .git + 有效 stamp（dirtyCount = 0）⇒ identity
  = stamp commit；无 .git + stamp `dirtyCount ≠ 0` ⇒ fail-loud；stamp
  格式异常（额外键 / 缺键 / 非 hex / 非整数 / 非 JSON）⇒ fail-loud；无
  .git 且无 stamp ⇒ fail-loud；identity 结果与 dshVersion/dshCommit pin
  联合校验行为不变（mismatch ⇒ fail-loud 且非 hop 触发类）。
- `CTR-ACT-A04`（Phase A 范围钉死）— Phase A 产品改动面 = 恰好
  A-1/A-2/A-3 所涉文件（production-runtime 的 model-overrides.js（及其
  内聚拆分）与 compose 接线、agent-provisioning 的 src/index.js）+ 测试。
  `provisionAgentHome` 0755/0700 适配、DSH/dsh-codex/pi-ai/harness 改动、
  pin 变更、其他包 = FORBIDDEN（ALT-ACT-009）。

### 9.3 Phase B contracts（CTR-ACT-B*；承接 PR #78 CTR-C-1xx/2xx 重冻）

- `CTR-ACT-B01`（settings.yaml zai 声明）— additive 追加 zai provider 块，
  形态 = DEC-ACT-007；只允许模型声明与 `apiKeyEnv: ZAI_API_KEY` 引用，raw key
  = FORBIDDEN；`agent-default-model` 与其余键逐字节不变；原子替换；编辑后
  0600 / uid 502 核验；`.bak` 允许（settings 无 secret）。
- `CTR-ACT-B02`（.credentials.yaml ZAI_API_KEY）— 严格 `CredentialRef →
  string` YAML 顶层映射（harness `@deepseek-ai/dsh-credentials-local` 契约）；
  仅新增 `ZAI_API_KEY` 一个顶层 key，其余 entry / 注释 / 排版原样；Owner
  亲自写入（DEC-ACT-005）；禁止明文备份/副本/截图/回显；写入后核验：key
  名存在且值非空（不输出值）、0600、uid 502。
- `CTR-ACT-B03`（GLM canary）— DEC-ACT-008 隔离语义；pass = initialize
  成功 + 恰好一个 no-tool turn（零 tool call）；fail = fail-loud 结构化
  记录（不含 provider raw error body / key）。
- `CTR-ACT-B04`（dsh-codex 安装 + peers + bundles）— DEC-ACT-009 全文。
- `CTR-ACT-B05`（全新 OAuth）— 仅由 Owner 亲自交互式登录生成
  `<HOME>/.openai-codex-auth.json`；禁止复制/链接/读取旧 OpenClaw OAuth
  物料、旧 root `/Users/yanfenma/.agent-core/homes/agt_cto-agent/
  .openai-codex-auth.json`、`~/.codex/auth.json`（后者全程 hash/mtime 不变
  并作为 ACC 核验）；禁止 `OPENAI_API_KEY` / API credits 路径（父 CTR-014
  原文延续）。
- `CTR-ACT-B06`（OAuth 文件边界）— 登录后核验：regular file、0600、uid 502；
  Home 目录 mode 唯一为 0755；HOME_MODE_0700 = OUT_OF_SCOPE / DEFERRED；token /
  refresh token 永不进入 override、launchd、settings.yaml、其他非 credential
  配置、argv、prompt、Feishu、日志/输出、commit、PR 或证据；日志仅允许文件名、
  大小、mtime、mode、owner 与 hash 指纹。
- `CTR-ACT-B07`（Luna canary）— DEC-ACT-008 隔离语义 + 代理前置；route =
  openai-codex / gpt-5.6-luna；pass 判据同 CTR-ACT-B03。
- `CTR-ACT-B08`（launchd / overrides 不变量）— Phase B 执行前后核验：plist
  全字节不变；`ZAI_API_KEY` / token 不出现在任何 launchd env；生产 root
  `agent-model-overrides.json` 保持 ABSENT（激活前核验）。

### 9.4 Phase C contracts（CTR-ACT-C*）

- `CTR-ACT-C101`（部署）— 按 DEC-ACT-010：冻结 path→blob 清单（route-chain
  家族生产服务文件 + Phase A 增量），唯一提取源 `git show <audited-commit>:
  <path>`；清单与部署前后状态逐条记录；回滚 = 恢复旧 blob；不夹带清单外
  文件。
- `CTR-ACT-C102`（harness .source-stamp 生成）— 部署所有；`commit` = 生产
  harness 对应的 exact commit（预期 = pin `514ab7b0029141b88c807704764d0d3e
  1eea1da4`，以受控比对实测为准）；`dirtyCount` = 诚实测定值（installed
  tree vs 该 commit 干净 checkout 的比对；测定方法与结果记录）。实测
  `dirtyCount ≠ 0` ⇒ luna 路由激活 BLOCKED（fail-loud），处置归 Owner
  （Q-ACT-2）；未经比对写 0 = 伪造证据，FORBIDDEN。stamp 文件 owner/mode
  随 harness 树（authsvc 属主）。
- `CTR-ACT-C103`（v2 配置写入）— 生产 root `/Users/authsvc/.agent-core/
  agent-model-overrides.json`，内容恰为（值逐字冻结；luna providerEnv 四值
  为执行轮现场核验的部署事实，占位以 `<>` 标示）：

```jsonc
{
  "version": 2,
  "routeCatalog": {
    "glm53": {
      "routeKind": "builtin",
      "provider": "zai",
      "model": "glm-5.3",
      "credentialReadiness": "zai-api-key-home"
      // plugin / pluginVersion / providerEnv：ABSENT（builtin；键存在即 malformed）
    },
    "luna": {
      "routeKind": "subscription",
      "provider": "openai-codex",
      "model": "gpt-5.6-luna",
      "plugin": "dsh-codex",
      "pluginVersion": "0.2.3",
      "credentialReadiness": "luna-oauth-home",
      "providerEnv": {
        "HTTP_PROXY": "<现场核验值>",
        "HTTPS_PROXY": "<现场核验值>",
        "NO_PROXY": "<现场核验值，非空 comma-separated host-list>",
        "NODE_USE_ENV_PROXY": "1"
      }
    }
  },
  "overrides": {
    "agt_cto-agent": { "model": { "primary": "glm53", "fallbacks": ["luna"] } }
  }
}
```

  写入前：文件 ABSENT 复核；写入后：以部署实现的 loader 语义核验（或以
  restart 的 startup fail-loud 语义核验）配置合法；文件无 secret 扫描；
  owner/mode 按 DEC-ACT-011。`overrides` 的合法 key 恰为 `{agt_cto-agent}`
  （父 CTR-012）。
- `CTR-ACT-C104`（强制 canary A–D，冻结判据）— 经真实 ingress（Owner 亲测
  飞书端到端）+ journal 结构化取证（CLM-ACT-005 字段）双通道验收：

```text
CANARY-A（GLM primary success）
  glm53 attempts = 1；luna attempts = 0；FINAL_ROUTE = glm53；
  TOTAL_ROUTE_ATTEMPTS = 1；FALLBACK_ACTIVATED = false；
  零 luna 网络活动；Owner 收到恰好一条 glm53 业务回复。

CANARY-B（proven-no-admission fallback）
  glm53 注入白名单类 pre-admission 失败（注入向量按 DEC-ACT-013 边界）：
  glm53 attempts = 1（FAILURE_CLASS ∈ CTR-004 四类白名单；
  ADMISSION_PROVEN = false）；luna attempts = 1；FINAL_ROUTE = luna；
  对外 = 恰好一条 luna 业务回复（ONE_LOGICAL_TURN）。

CANARY-C（outcome_unknown ⇒ STOP_CHAIN）
  glm53 注入 outcome_unknown：luna attempts = 0；STOP_CHAIN；
  turn 以 fail-loud / outcome_unknown 终结；无 replay；
  Owner 观察到失败回执且无第二条回复。

CANARY-D（duplicate protection）
  覆盖 A–C 全部 turn：single logical turn；single transcript；
  single external delivery；onStart / onDispatch exactly once
  （Scheduler 入口的 per-occurrence exactly-one envelope 语义，
  CTR-IMPL-005；Feishu 入口的单回复语义）。
```

  canary 执行后：清除全部注入并复验（ACC-ACT-C9：再跑一次清洁
  CANARY-A 语义 turn，glm53 attempts = 1、FINAL_ROUTE = glm53）。
- `CTR-ACT-C105`（controlled restart / new generation）— 按 DEC-ACT-012 顺序
  与 DEC-ACT-014 边界；restart 后核验：runtime up、单 Feishu WebSocket、
  非目标 Agent resolved route/env 零变化（直通 global env route）、
  agt_cto-agent 链生效（journal ROUTE_CHAIN_ID 出现、链长 2）。

## 10. Acceptance（执行轮验收框架；本 authoring 轮不执行）

| # | 项 | 依据 |
|---|---|---|
| ACC-ACT-01 | GATE-1 AND GATE-2 执行前核验记录（本 Spec 与 PR #77 的 main commit 坐标，fresh-fetch） | §3 |
| ACC-ACT-02 | Phase A A-1/A-2：父 A1.6 ACC-016（routeKind 校验族）/ ACC-017（canonical identity v2）/ ACC-018（初始链 tuple 通过校验）全 PASS | CTR-ACT-A01 |
| ACC-ACT-03 | Phase A A-2：ACC-019（复用 gate 身份 = 七字段 canonical identity；builtin 与 subscription process 互不复用）PASS | CTR-ACT-A01 |
| ACC-ACT-04 | Phase A A-3：CTR-ACT-A03 测试族全 PASS（git 优先 / 有效 stamp / dirty≠0 / 格式异常 / 双缺 / pin 联合校验） | CTR-ACT-A02/A03 |
| ACC-ACT-05 | Phase A 范围钉死：产品改动面 = A-1..A-3 清单内文件（结构审查；provisioner 适配等范围外改动 = 0） | CTR-ACT-A04 |
| ACC-ACT-06 | GATE-3：独立实现审计 PASS（审计对象 = Phase A 实现 + 测试 + SPEC_COMPLIANCE + 实现记录义务 CTR-IMPL-010 形态） | §3/DEC-ACT-003 |
| ACC-ACT-B1 | settings.yaml：zai 块存在且形态正确；`agent-default-model` 与其余键 diff = 零变化；0600/uid502 | CTR-ACT-B01 |
| ACC-ACT-B2 | .credentials.yaml：`ZAI_API_KEY` key 存在、值非空（未输出）；其余 entry 保留；0600/uid502；无第二副本 | CTR-ACT-B02 |
| ACC-ACT-B3 | GLM canary PASS（initialize + 1 no-tool turn 零 tool call；隔离证据：零 Router/Feishu/Scheduler 流量） | CTR-ACT-B03 |
| ACC-ACT-B4 | dsh-codex installed version === 0.2.3 exact；registry 类受信源；19/19 peers 预核验记录；bundles 追加后其余字节不变；仅本 Home | CTR-ACT-B04 |
| ACC-ACT-B5 | `.openai-codex-auth.json` 全新生成（Owner 交互式）；0600/uid502；`~/.codex/auth.json` hash/mtime 不变 | CTR-ACT-B05/B06 |
| ACC-ACT-B6 | Luna canary PASS（同 B3 语义 + 代理前置现场复核记录） | CTR-ACT-B07 |
| ACC-ACT-B7 | launchd plist 字节不变；无 ZAI/token env；生产 root overrides 文件 Phase B 结束时仍 ABSENT | CTR-ACT-B08 |
| ACC-ACT-B8 | GATE-4：凭据 readiness PASS 判定记录（`zai-api-key-home` / `luna-oauth-home` = SATISFIABLE；Home = 0755/uid502；三个敏感文件 = 0600/uid502） | §3/DEC-ACT-006 |
| ACC-ACT-C1 | 部署：冻结 path→blob 清单逐条对账（提取源 = audited commit；无 worktree/dirty 提取；无清单外文件）；回滚面记录 | CTR-ACT-C101 |
| ACC-ACT-C2 | `.source-stamp`：commit 值 + dirtyCount 诚实测定记录（含比对方法）；实测 dirtyCount = 0（或 ≠ 0 时激活 BLOCKED + Owner 处置记录） | CTR-ACT-C102 |
| ACC-ACT-C3 | restart #1 后健康核验：runtime up；单 Feishu WebSocket；非目标 Agent 直通零变化；agt_cto-agent 以全局 env route 正常 spawn | DEC-ACT-012(3) |
| ACC-ACT-C4 | v2 配置：内容 = CTR-ACT-C103 冻结 tuple；loader 校验通过；无 secret 扫描；写入顺序符合 DEC-ACT-012（配置在代码部署+restart 之后） | CTR-ACT-C103 |
| ACC-ACT-C5 | CANARY-A PASS（双通道：Owner 真实回复 + journal 判据） | CTR-ACT-C104 |
| ACC-ACT-C6 | CANARY-B PASS（注入向量记录 + 白名单失败类 + luna 恰一次 + FINAL_ROUTE=luna + 对外单回复） | CTR-ACT-C104 |
| ACC-ACT-C7 | CANARY-C PASS（luna attempts=0 + STOP_CHAIN + 无 replay + Owner 失败回执） | CTR-ACT-C104 |
| ACC-ACT-C8 | CANARY-D PASS（A–C 全 turn：单 logical turn / 单 transcript / 单 external delivery / onStart+onDispatch exactly once） | CTR-ACT-C104 |
| ACC-ACT-C9 | 注入清除 + 清洁复验 turn（glm53 attempts=1、FINAL_ROUTE=glm53）+ 生产终态记录 | CTR-ACT-C104 |
| ACC-ACT-C10 | 隔离回归：非目标 Agent resolved route/env/网络路径零变化；launchd 字节不变；Scheduler store 零改动 | §2.2/CTR-012 |
| ACC-ACT-C11 | redaction 扫描：三阶段全部输出/日志/commit/PR 文本无 secret（key/token/Authorization/provider raw error body） | §9.1 |
| ACC-ACT-C12 | GATE-5：canary A–D 全 PASS 判定 + `ACTIVATION_COMPLETE` 最终验收记录；GATE-5 是完成判据，不是启动 Phase A/B/C 的前置条件 | §3 |

## 11. Alternatives and disposition

- `ALT-ACT-001` — 拆成「凭据授权 / Harness identity / 配置激活」三份 child
  Spec（PR #78 即第一条线）：**REJECTED**——Owner 指令 2026-08-27（NEW_EVIDENCE，
  原文：「不要再拆成……三份文档」）；三缝同属一次激活事务，拆分增加 gate
  矩阵与 dual-current 风险。
- `ALT-ACT-002` — 复活 / merge PR #78 作为凭据线：**REJECTED / FORBIDDEN**——
  与 ALT-ACT-001 同证；PR #78 处置 = §3.4（CONSOLIDATED_UNMERGED_CANDIDATE，
  推荐关闭、永不 merge；本 Spec 不对其执行 lifecycle mutation）。
- `ALT-ACT-003` — 沿用（复活）superseded `AGENT_CORE_CHATGPT_SUBSCRIPTION_
  PROVIDER_V1`：**REJECTED**——已被父 Spec whole-supersede；no-dual-current。
- `ALT-ACT-004` — agent 代替 Owner 输入 key / 完成 OAuth：**REJECTED**——
  secret 必须经 Owner 亲手（DEC-ACT-005）；agent 会话即 prompt 面。
- `ALT-ACT-005` — 从旧 root 拷贝 dsh-codex node_modules / OAuth 文件：**
  REJECTED / FORBIDDEN**——父 CTR-014 与任务指令双重明禁。
- `ALT-ACT-006` — 复制 `.git` 到生产 harness 以令 readHarnessIdentity 通过：
  **REJECTED / FORBIDDEN**——任务指令明禁；且扩大生产信任面。
- `ALT-ACT-007` — stamp 仅写 package version、或 dirtyCount 恒写 0 不实测：
  **REJECTED / FORBIDDEN**——identity 不精确 / 伪造证据（DEC-ACT-004/C102）。
- `ALT-ACT-008` — 把 zai 同时设为 `agent-default-model`（旧 root 全局主路由
  形态）：**REJECTED**——全局默认路由不在本授权内；激活只经 v2 override 链。
- `ALT-ACT-009` — Phase A 顺带实现 provisioner 0700 适配 / 任何清单外改动：
  **REJECTED / FORBIDDEN**——Phase A 清单冻结（任务指令 + CTR-ACT-A04）；
  0700 适配需独立 authority（DEC-ACT-006；HOME_MODE_0700 = DEFERRED）。
- `ALT-ACT-010` — 配置先于代码部署写入（省一次 restart）：**REJECTED /
  FORBIDDEN**——制造目标 Agent spawn fail-loud 中断窗口（CLM-ACT-003）。
- `ALT-ACT-011` — canary 以单一 curl / 单一 model roundtrip / 测试 rig 替代：
  **REJECTED**——父 CTR-014 尾段与部署 runbook 先例均要求分通道独立证据；
  Owner 真实验收不可被技术探针替代（DEC-ACT-013）。
- `ALT-ACT-012` — per-hop deadline 刷新 / outcome_unknown 时继续 fallback：
  **REJECTED / FORBIDDEN**——父 CTR-005 + DEC-IMPL-007 原样（任务「明确禁止」
  清单原文）。

## 12. Migration, compatibility, and rollback

- `MIG-ACT-001` — 阶段推进即阶段可回退：Phase A 回退 = revert 实现 PR（链
  对齐 + stamp fallback 各自成界）；Phase B 回退 = PR #78 §12 同义（移除
  ZAI_API_KEY entry / zai 块；移除 bundles dsh-codex / 删 plugin 目录 / 删或
  留 OAuth 文件并维持 0600）；均不触碰 launchd / overrides / 其他 Agent。
- `MIG-ACT-002` — Phase C 回退分层（父 ROLLBACK + 部署纪律）：
  proxy-only 回退 = 从 luna catalog entry 移除 providerEnv 字段 + 受控
  new generation；chain 回退 = 移除 override entry（或整文件）+ controlled
  restart ⇒ agt_cto-agent 回落 global env route（现值 oc-go/
  deepseek-v4-flash，届时以实值为准）；代码回退 = 恢复部署前 blob（CTR-ACT-
  C101 清单）。全部回退不改 launchd、不触碰其他 Agent / credential / Scheduler
  store；DSH 版本不回滚。
- `MIG-ACT-003` — v1 → v2 无存量迁移面（生产 root 从无 override 文件；
  父 MIG-004）。
- `MIG-ACT-004` — PR #77 merge 依赖已满足：merge commit =
  `b620907fc6f58292b6ee096c977f0071921d747e`，PR77_IN_MAIN = YES，GATE-2 =
  SATISFIED；每个 Phase 开工前仍须 fresh-fetch 并记录该 main commit 坐标。

## 13. Open questions

Home mode 无 open question：`HOME_DIRECTORY_MODE = 0755`、`HOME_OWNER_UID = 502`；
`HOME_MODE_0700 = OUT_OF_SCOPE / DEFERRED`（DEC-ACT-006）。

- `Q-ACT-2`（执行轮事实项，非本authoring轮可决）— 生产 harness 树相对 pin
  commit `514ab7b…` 的 dirtyCount 实测值：若 ≠ 0，luna 路由激活 BLOCKED
  （fail-loud），处置（树重装 / pin amendment / 放弃 luna）归 Owner 决策；
  本 Spec 不预设答案（CLM-ACT-006 / CTR-ACT-C102）。

## 14. Final Output（acceptance 轮填写）

```text
TASK_NAME = 采纳 执行
TASK_TYPE = 执行
TASK_STATUS = ACCEPTANCE_COMPLETE（accepted；Draft PR 保持 OPEN / unmerged）
PRE_ACCEPTANCE_HEAD = f4e1e04aa6725f9652cfabe86ef8c044a92e4e6e
REVIEW_VERDICT = PASS
BLOCKER_COUNT = 0
NORMATIVE_BODY_CHANGE = NONE

SPEC_ID = AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_ACTIVATION_V1
AUTHORITY_FORM = unified activation-authorizing child Spec（不 supersede 任何 Spec；
  PR #78 CONSOLIDATED_UNMERGED_CANDIDATE，推荐关闭、永不 merge、本 Spec 零
  PR lifecycle mutation）
IMPLEMENTATION_AUTHORITY = contracts（逐阶段 gated；§3）
PRODUCTION_APPLY_AUTHORITY = contracts（逐阶段 gated；§3）

PR77_IN_MAIN = YES
PR77_MERGE_COMMIT = b620907fc6f58292b6ee096c977f0071921d747e
GATE_2 = SATISFIED

GATES =
  GATE-1 本 Spec accepted AND 进入 main
  GATE-2 PR #77 两份 Amendment 1 accepted AND 进入 main = SATISFIED
  GATE-3 Phase A 独立实现审计 PASS
  GATE-4 Phase B 凭据 readiness PASS
  GATE-5 Phase C 强制 canary A–D 全 PASS
PHASE_A_GATE = GATE-1 AND GATE-2
PHASE_B_GATE = GATE-1 AND GATE-2 AND GATE-3
PHASE_C_GATE = GATE-1 AND GATE-2 AND GATE-3 AND GATE-4
GATE_5_ROLE = COMPLETION_CRITERION
ACTIVATION_COMPLETE = FORBIDDEN UNTIL GATE-5 PASS
阶段顺序 = A → B → C 严格；未完成 A/B 即执行 C = FORBIDDEN

PHASE_A_SCOPE（最小产品改动，仅此三项）=
  A-1 v2 loader routeKind = builtin|subscription（builtin plugin 键 ABSENT、
      不构造 subscription block；subscription 必填 + exact pin）
      ——绑定 IMPL Amendment 1 DEC-IMPL-009/011 既有授权
  A-2 canonical identity 七字段（routeKind + plugin-or-ABSENT）
      ——绑定 IMPL Amendment 1 DEC-IMPL-010 既有授权
  A-3 readHarnessIdentity 受信 source-stamp fallback（git 优先；.source-stamp
      = {commit 40-hex, dirtyCount ≥0}；dirty≠0/格式异常/缺失 fail-loud
      （dsh_commit_mismatch 族，不新增失败类）；禁仅凭 package version；
      禁复制 .git 到 production）——本 Spec 新授权

PHASE_B_SCOPE（仅 agt_cto-agent production Home）=
  GLM：settings.yaml +zai/glm-5.3；.credentials.yaml Owner 交付 ZAI_API_KEY；
       不输出 key；credential file 0600；uid 502；initialize + no-tool canary
  Luna：dsh-codex@0.2.3 exact registry 安装 + 19/19 peers + bundles 原子追加；
       Owner 亲自交互式 OAuth 全新 .openai-codex-auth.json；禁复制旧
       OpenClaw/旧 root/~/.codex/auth.json；auth file 0600；uid 502；
       initialize + no-tool canary
  HOME_DIRECTORY_MODE = 0755
  HOME_OWNER_UID = 502
  settings.yaml / .credentials.yaml / .openai-codex-auth.json = 0600 / uid 502
  HOME_MODE_0700 = DEFERRED（OUT_OF_SCOPE；仅未来 cross-UID provisioner 适配 +
       独立 authority 完成后可重新讨论）

PHASE_C_SCOPE（激活）=
  部署 route-chain 实现（冻结 path→blob；唯一提取源 = audited commit）
  生成 harness .source-stamp（commit = 514ab7b…；dirtyCount 诚实实测）
  写 agent-model-overrides.json version 2（仅 agt_cto-agent；
    primary = glm53（builtin/zai/glm-5.3/plugin ABSENT/zai-api-key-home/
      providerEnv ABSENT）；fallbacks = [luna]（subscription/openai-codex/
      gpt-5.6-luna/dsh-codex/0.2.3/luna-oauth-home/providerEnv 四键 closed
      object，值 = 执行轮部署事实））
  顺序冻结：部署 → controlled restart → 健康核验 → 写配置 → new generation
    （反向 = FORBIDDEN）
  controlled restart / new generation

MANDATORY_CANARIES =
  A GLM primary success（glm53 attempts=1；luna attempts=0；finalRoute=glm53）
  B proven-no-admission fallback（glm53 白名单类失败；luna attempts=1；
    finalRoute=luna）
  C outcome_unknown（luna attempts=0；STOP_CHAIN）
  D duplicate protection（single logical turn / transcript / external
    delivery；onStart/onDispatch exactly once）

CREDENTIAL_STORE_EXCEPTION =
  GLM: $DSH_HOME/.credentials.yaml；键 = ZAI_API_KEY；owner uid 502；mode 0600
  Luna: $DSH_HOME/.openai-codex-auth.json；owner uid 502；mode 0600；Owner 交互式
        OAuth 全新生成
RAW_CREDENTIAL_NON_STORE_CONFIG = FORBIDDEN
RAW_CREDENTIAL_IN_OVERRIDE = FORBIDDEN
RAW_CREDENTIAL_IN_LAUNCHD = FORBIDDEN
RAW_CREDENTIAL_IN_SETTINGS_YAML = FORBIDDEN
RAW_CREDENTIAL_IN_LOGS_OR_OUTPUT = FORBIDDEN
settings.yaml = 仅模型声明 + apiKeyEnv 引用，不含 raw key

NOT_AUTHORIZED（全阶段）=
  修改其他 Agent / Scheduler job / Binding / Definition / launchd；第二
  Feishu consumer；raw credential 进入专用 store 之外的任何配置、日志、PR 或
  证据；复制旧 OAuth；复制 .git 到 production；per-hop deadline 刷新；
  outcome_unknown fallback；dsh-codex 作 ZAI carrier；未完成 A/B 即执行 C；
  Phase A 清单外产品改动（含 provisioner 0700 适配）；配置先于代码部署写入

PRODUCT_CODE_CHANGE = NONE
CREDENTIAL_CHANGE = NONE（本轮零执行）
CONFIG_CHANGE = NONE
PRODUCTION_CHANGE = NONE
DEPLOYMENT = NONE
RESTART = NONE
MERGE = NO（Draft PR）
PR78_LIFECYCLE_MUTATION = NONE（处置仅记录于 §3.4）
ACCEPTANCE_FINALIZED = YES

NEXT_TASK = 采纳 审计
```

## Amendment 1（2026-08-28）— GLM Strict Staging（STAGE_1 = GLM_STRICT；STAGE_2 = LUNA_COLD_FALLBACK_DEFERRED；accepted）

> AMENDMENT_STATUS = **accepted**（authoring 2026-08-28，任务「模型 执行」；
> acceptance finalize 2026-08-28，任务「模型 执行」：
> accepted_by = mayf3 · reviewed_head = 4e71fd2db78db9f8b80b8636d6c8255d7764d39a ·
> review_verdict = PASS · blocker_count = 0 · normative_body_change = NONE
> （lifecycle-only 状态翻转与 provenance 记录；A1.0–A1.7 normative 内容
> 逐字保留）；Draft PR，不 merge、不改产品代码、不写配置、不配置
> Credential、不触碰 production）。
> **Amendment 形式依据**：`.agents/README.md` standing order 6（「scope 需要
> 澄清/纠正但方向未变，走 AMEND」）+ accepted-Spec in-place amendment 先例
> （父 Spec / IMPL Amendment 1 Builtin Route Kind，PR#77：基础正文逐字保留，
> Amendment 节显式 supersede 特定条款，独立评审 + acceptance finalize 后生效）。
> **方向未变**：三阶段（A→B→C）激活路径、gate 链结构、§9.1 全部安全语义、
> 父 Spec / IMPL ruling 逐字保持；本 Amendment 只把 Phase B/C 的激活目标从
> 「GLM + Luna 双路由一次激活」重排为「GLM strict 单路由先上线（Stage 1）+
> Luna 冷备推迟（Stage 2）」，因此不走 whole-authority SUPERSEDE，也**不新建
> 第二套 Route Chain Spec**（Owner 指令 2026-08-28 明令禁止）。
> **生效条件**：本 Amendment 经 independent review PASS 并由 mayf3 acceptance
> finalize（于本节记录 provenance）后、且随 PR 进入 main 时生效。生效前，
> 基础正文的 GLM+Luna 双前置语义仍是现行权威。GLM_STRICT 生产激活在本
> Amendment 生效前 = NOT AUTHORIZED。

### A1.0 Owner 新裁决与任务给定坐标（2026-08-28，原样冻结，无需重做）

```text
OWNER_RULING_S1_1  STAGE_1 = GLM_STRICT：GLM 以 strict 单路由模式正式上线
OWNER_RULING_S1_2  STAGE_1 冻结配置：routeKind = builtin；provider = zai；
                   model = glm-5.3；primary = glm53；fallbacks = []
OWNER_RULING_S1_3  STAGE_2 = LUNA_COLD_FALLBACK_DEFERRED：Luna 保持冷备候选，
                   不阻塞 GLM strict 激活
OWNER_RULING_S1_4  Luna 本轮禁绝：不重新安装、不重新 OAuth、不刷新凭据、
                   不做生产 Luna model call、不进入 Stage-1 override
OWNER_RULING_S1_5  以后只有 Owner 再次明确授权，才允许把 Luna 加入 fallbacks[]
TASK_GIVEN         GATE-3 = PASS（Phase A 独立实现审计）；
                   PHASE_A_AUDITED_HEAD = a708fc39fef7f9f5e6352af3de7facce27236342
                   （分支 impl/route-chain-activation-phase-a-v1；本 authoring
                    轮只读记录坐标，不改其内容）
AMENDMENT_FORM     最小原位 amendment；不得新建第二套 Route Chain Spec
```

作者侧只读核实（2026-08-28，base = fresh-fetched origin/main `ab34372`）：

- 本 Spec 自 merge commit `9cb17a1` 进入 main 后在 main 上字节未变
  （`git diff 9cb17a1 origin/main -- <本文件>` 为空）；GATE-1 / GATE-2 保持
  SATISFIED。
- strict 空链是已实现语义：main `ab34372`
  `packages/production-runtime/src/model-overrides.js` 头部注释冻结
  「ROUTE_CHAIN = [primary, ...fallbacks] (ordered, ≤ MAX_CONFIGURED_ROUTES;
  [] = strict)」；override 校验要求 `model.{primary, fallbacks}` 键集精确、
  `fallbacks` 为 array（空数组合法）、chain 内每个 routeRef 必须命中
  routeCatalog——因此 Stage-1 配置只需 glm53 一个 catalog entry，luna entry
  不写入即不存在未就绪 route。
- Phase A 审计头 `a708fc3` = 分支 `impl/route-chain-activation-phase-a-v1`
  本地与 origin 远端 head（fresh-fetch 核验，无 drift）；其
  AUDIT_BLOCKER_FIX 提交（测试文件机械拆分）自证审计闭环。

### A1.1 被 supersede 的基础正文条款（精确清单，其余逐字保持）

本 Amendment 显式 supersede 基础正文以下条款中「GLM 与 Luna 一起作为生产
激活前置 / 双路由一次激活」的语义，且仅此语义：

| 基础正文位置 | 原语义 | Amendment 后语义 |
|---|---|---|
| §1 表 B-2 行 + §2.1 Phase B 的 Luna 半边 | Luna 安装 + OAuth + canary 属 Phase B 授权范围 | 移出 Stage-1 授权面：LUNA = DEFERRED（A1.5）；GLM 半边（B-1）不变 |
| §3.1 GATE-4（「Phase B 凭据 readiness PASS（两 canary + 全部 ACC-ACT B 族）」） | GLM + Luna 双块全 PASS 才算 GATE-4 | Stage-1 GATE-4 = GLM（zai-api-key-home）readiness 半边 PASS（A1.3）；Luna 半边转 Stage-2 前置 |
| §3.1 PHASE_C_ALLOWED 引用的 GATE-4 | 同上 | 引用 Stage-1 GATE-4（A1.3） |
| DEC-ACT-002「两块全部 PASS 才算 GATE-4」 | 同 §3.1 | 同上 |
| CTR-ACT-C103 冻结 JSONC（routeCatalog 两 entry + `fallbacks: ["luna"]`） | Stage 概念不存在；一次写入双路由链 | Stage-1 写入形态 = A1.2 冻结 JSONC（仅 glm53 entry；`fallbacks: []`）；C103 原两 entry 形态保留为 Stage-2 目标形态；其余写入边界（无 secret / owner / mode / 时序）原文不变 |
| CTR-ACT-C104 CANARY-B / CANARY-C 判据 | B = 注入后 fallback 到 luna；C 以 luna attempts 计数表达 STOP_CHAIN | Stage-1 判据 = A1.4 重定义（无 fallback 路径的 fail-loud 终结；STOP_CHAIN 语义不变）；原 B/C luna 判据保留为 Stage-2 canary 集 |
| ACC-ACT-B4/B5/B6 作为 GATE-4 组成 + ACC-ACT-B8 双 readiness 判定 | Luna readiness 属 Phase B 验收 | 转为 Stage-2 前置（冻结形态不变）；Stage-1 GATE-4 判定 = ACC-ACT-B1/B2/B3/B7 + B8 的 GLM 相关项（A1.3） |
| §13 Q-ACT-2 处置时点 | dirtyCount ≠ 0 ⇒ luna 路由激活 BLOCKED（当轮 Phase C 处置） | 移至 Stage-2 依赖面（Stage-1 无 luna route，不构成 Stage-1 阻塞）；CTR-ACT-C102 stamp 诚实测定义务原文不变 |

明确**不在** supersede 范围（逐字保持，不得借本 Amendment 重开）：

- **Phase A 全部**：A-1/A-2/A-3、CTR-ACT-A01..A04、ACC-ACT-01..06——已按
  基础正文执行完毕（impl 分支 `a708fc3`）且 GATE-3 = PASS（A1.0 任务给定）；
  本 Amendment 不要求任何 Phase A 代码回退或修改（strict 空链与
  subscription 均为其已实现并测试的能力面）。
- §9.1 安全边界全文（raw credential 五重禁止、credential store 边界、
  复制禁止、launchd / Scheduler / Binding / 第二 Feishu consumer 禁改、
  per-hop deadline 刷新与 outcome_unknown fallback 禁止、dsh-codex 冒充
  ZAI carrier 禁止、GOVERNING_SPEC_UNMODIFIED）。
- 父 Spec 与 IMPL（含各自 Amendment 1）全部 ruling：
  MAX_CONFIGURED_ROUTES = 4、proven-no-admission 封闭白名单、STOP_CHAIN
  封闭禁止集、ONE_LOGICAL_TURN、ROUTE_ORDER_HARDCODED_IN_CODE = FORBIDDEN、
  SCHEDULER_JOB_ROUTE_POLICY = INHERIT_AGENT_CHAIN_ONLY、harness /
  dsh-codex pin。
- DEC-ACT-005（Owner 亲手交付 key / OAuth）、DEC-ACT-006（Home 0755 / uid
  502）、DEC-ACT-007..011（GLM settings 编辑形态、probe 隔离、Phase C 部署
  纪律、v2 配置写入形态）、DEC-ACT-012 激活顺序（部署 → controlled
  restart → 健康核验 → 写配置 → new generation；反向 FORBIDDEN）、
  DEC-ACT-013 注入边界、DEC-ACT-014 restart 边界；CTR-ACT-B01/B02/B03/
  B08、CTR-ACT-C101/C102/C105；§3.4 PR #78 处置；MIG-ACT-001..004。

### A1.2 Stage 划分与 Stage-1 冻结配置（supersede CTR-ACT-C103 形态）

```text
STAGE_1 = GLM_STRICT
GLM_STAGE_1_ROUTE =
  routeKind = builtin
  provider  = zai
  model     = glm-5.3
  primary   = glm53
  fallbacks = []
STAGE_2 = LUNA_COLD_FALLBACK_DEFERRED（A1.5）
```

Stage-1 写入生产 root `/Users/authsvc/.agent-core/agent-model-overrides.json`
的内容恰为（值逐字冻结；相对 CTR-ACT-C103 仅删去 luna entry 与 fallback
元素，其余写入边界——无 secret、owner/mode 按 DEC-ACT-011、时序按
DEC-ACT-012——原文不变）：

```jsonc
{
  "version": 2,
  "routeCatalog": {
    "glm53": {
      "routeKind": "builtin",
      "provider": "zai",
      "model": "glm-5.3",
      "credentialReadiness": "zai-api-key-home"
      // plugin / pluginVersion / providerEnv：ABSENT（builtin；键存在即 malformed）
    }
  },
  "overrides": {
    "agt_cto-agent": { "model": { "primary": "glm53", "fallbacks": [] } }
  }
}
```

- `fallbacks: []` = loader 已实现并注释冻结的 strict 语义（A1.0 核实）；
  `overrides` 合法 key 仍恰为 `{agt_cto-agent}`（父 CTR-012）。
- Stage-1 routeCatalog **不含** luna entry：Stage-1 override 不引用 luna，
  未激活 route 不进 Stage-1 配置（loader 要求 chain 内 routeRef 全部命中
  catalog；未引用的 entry 无需存在）；luna tuple 冻结值（父 A1.4 /
  CTR-ACT-C103 原 JSONC）保留为 Stage-2 目标形态，本 Amendment 不改其任何
  字段值。
- chain 长度 1 ≤ MAX_CONFIGURED_ROUTES = 4（父 OWNER_DECISION 不变）。

### A1.3 GATE-4 重定义（Stage-1）与 gate 链

```text
GATE-4_STAGE_1 = GLM credential readiness PASS
  = zai-api-key-home SATISFIABLE（CTR-ACT-B01 settings.yaml zai 块 +
    CTR-ACT-B02 .credentials.yaml ZAI_API_KEY，Owner 亲手交付）
  AND GLM canary PASS（CTR-ACT-B03，DEC-ACT-008 隔离语义）
  AND CTR-ACT-B08 不变量（launchd 字节不变；无 ZAI/token env；
    生产 root overrides 文件激活写入前保持 ABSENT）
  验收 = ACC-ACT-B1 / B2 / B3 / B7 + B8 的 GLM 相关判定
LUNA_READINESS_STAGE_1 = NOT_REQUIRED（DEFERRED；ACC-ACT-B4/B5/B6 转为
  Stage-2 前置，冻结形态不变、本轮不执行）
PHASE_B_ALLOWED = GATE-1 AND GATE-2 AND GATE-3（不变）
  —— Stage-1 的 Phase B 授权面收窄为 GLM 半边（B-1 / CTR-ACT-B01..B03 + B08）
PHASE_C_ALLOWED_STAGE_1 = GATE-1 AND GATE-2 AND GATE-3 AND GATE-4_STAGE_1
GATE-5 = Stage-1 强制 canary 集（A1.4）全 PASS = STAGE_1_COMPLETE 判据
GATE_5_ROLE = COMPLETION_CRITERION（不变；GATE-5 未完成前不得宣称
  STAGE_1_COMPLETE / ACTIVATION_COMPLETE）
```

GATE-1 / GATE-2 / GATE-3 定义与 SATISFIED 状态不变（GATE-3 = PASS，任务
给定坐标见 A1.0）。Phase C 的部署面（CTR-ACT-C101 冻结 path→blob 清单——
含 Phase A 增量文件集——与 CTR-ACT-C102 `.source-stamp` 诚实生成）原文
不变：部署内容 = 已审计实现（含 readHarnessIdentity fallback 能力）；Stage-1
配置不引用任何 subscription route 不影响其部署合法性；Q-ACT-2 的
dirtyCount ≠ 0 处置仅对 Stage-2 有约束力（A1.1 表末行）。

### A1.4 Stage-1 强制 canary 集（supersede CTR-ACT-C104 的 B/C 判据；A/D 不变）

双通道验收（Owner 真实飞书端到端 + journal 结构化取证，互不替代）与
DEC-ACT-013 注入边界、ACC-ACT-C9 注入清除 + 清洁复验，原文不变：

```text
CANARY-A（GLM primary success）——不变
  glm53 attempts = 1；FINAL_ROUTE = glm53；TOTAL_ROUTE_ATTEMPTS = 1；
  FALLBACK_ACTIVATED = false；零 luna 网络活动（Stage 1 配置结构性不存在
  luna route）；Owner 收到恰好一条 glm53 业务回复。

CANARY-B-S1（proven-no-admission ⇒ strict 模式 fail-loud 终结）
  glm53 注入白名单类 pre-admission 失败（FAILURE_CLASS ∈ CTR-004 四类
  白名单；ADMISSION_PROVEN = false；注入向量按 DEC-ACT-013 边界，仅作用
  于 glm53）：glm53 attempts = 1；TOTAL_ROUTE_ATTEMPTS = 1；
  FALLBACK_ACTIVATED = false；FINAL_OUTCOME = failed（fail-loud）；
  对外 = 恰好一条失败回执、无第二条业务回复（ONE_LOGICAL_TURN）。
  hop 语义本身不变：proven-no-admission 仍是唯一可 hop 转换类；Stage 1
  因 fallbacks = [] 无可跳目标，链在 primary 失败后即终结。

CANARY-C（outcome_unknown ⇒ STOP_CHAIN）——语义不变
  glm53 注入 outcome_unknown：glm53 attempts = 1；STOP_CHAIN；turn 以
  fail-loud / outcome_unknown 终结；无 replay；Owner 观察到失败回执且无
  第二条回复。

CANARY-D（duplicate protection）——不变
  覆盖 A–C 全部 turn：single logical turn；single transcript；single
  external delivery；onStart / onDispatch exactly once。
```

基础正文 CANARY-B / CANARY-C 的 luna 判据（fallback 到 luna 的
proven-no-admission hop / luna attempts 计数）保留为 **Stage-2 canary 集**
的组成（Stage-2 轮连同 luna readiness 一起按 A1.5 授权条件重新执行）。

### A1.5 LUNA_COLD_FALLBACK_DEFERRED 冻结边界（Stage-2 授权前全程有效）

```text
LUNA_STATUS = DEFERRED（冷备候选；不阻塞 Stage-1 任何 gate / phase）
LUNA_REINSTALL_OR_UPGRADE = FORBIDDEN（不安装 / 不升级 dsh-codex）
LUNA_RE_OAUTH = FORBIDDEN
LUNA_CREDENTIAL_REFRESH = FORBIDDEN（不刷新任何凭据）
LUNA_OAUTH_DELETE_OR_COPY = FORBIDDEN（现有 OAuth 物料不删除、不复制；
  生产 Home 现无 .openai-codex-auth.json（STATE-ACT-004），保持 ABSENT
  即为合规）
LUNA_PRODUCTION_MODEL_CALL = FORBIDDEN（含 canary / probe / 任何路径的
  生产 Luna model call）
LUNA_IN_STAGE1_OVERRIDE = FORBIDDEN（Stage-1 fallbacks 恒 = []）
LUNA_JOIN_FALLBACKS_REQUIRES =
  OWNER_EXPLICIT_NEW_AUTHORIZATION（Owner 再次明确授权）
  AND 本 Spec 后续 amendment（或后继 authority）按 governance 评审生效
  AND Stage-2 readiness：ACC-ACT-B4/B5/B6 全 PASS（冻结形态 = 基础正文
    CTR-ACT-B04..B07 原文）
  AND Q-ACT-2 dirtyCount 处置完成（= 0，或 ≠ 0 时 Owner 裁决的处置落地）
  AND Stage-2 专属 canary 集全 PASS（含基础正文 CANARY-B/C 的 luna 判据）
```

基础正文 Phase B 的 Luna 半边（B-2 / CTR-ACT-B04..B07）与 DEC-ACT-009 全部
条文不被删除、不改写——其地位从「Stage-1 授权面」移为「Stage-2 冻结形
态」；在上述条件全部满足前，执行其中任何一项 = out-of-spec。

### A1.6 安全语义全量保持（逐字重申，无一项放松）

- `outcome_unknown = STOP_CHAIN`（父 CTR-005 / DEC-IMPL-007 原样）。
- `proven-no-admission` 白名单 = 唯一可 hop 转换类（Stage 1 因空
  fallbacks 结构性无 hop；语义不因 Stage 划分改变）。
- `ONE_LOGICAL_TURN` 外部语义（无论链内 attempts 几何，对外恰好一次交付
  或一条失败回执）。
- `MAX_CONFIGURED_ROUTES = 4`（父 OWNER_DECISION 冻结值不变）。
- `SCHEDULER_JOB_ROUTE_POLICY = INHERIT_AGENT_CHAIN_ONLY`（Scheduler 只继承
  Agent chain；本 Amendment 不开 Scheduler 独立路由面）。
- 路由顺序唯一 authority = 部署拥有的配置文件
  （`ROUTE_ORDER_HARDCODED_IN_CODE = FORBIDDEN`）。
- raw credential 不进 override / launchd / settings / 日志 / 输出 / PR /
  证据（§9.1 全文不变；Stage-1 唯一涉及凭据 = ZAI_API_KEY，仍走
  `<HOME>/.credentials.yaml` 受控 store）。
- 不允许 dsh-codex 冒充 ZAI carrier（fake carrier 禁止，原样）。

### A1.7 Final Output（Amendment authoring 轮填写）

```text
TASK_NAME = 模型 执行
TASK_TYPE = 执行
TASK_STATUS = AMENDMENT_AUTHORED（proposed；Draft PR 保持 OPEN / unmerged）

SPEC_ID = AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_ACTIVATION_V1
AMENDMENT_ID = AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_ACTIVATION_V1_AMENDMENT_1_GLM_STRICT_STAGING
AMENDMENT_STATUS = proposed（awaiting independent review；不 acceptance、
  不 merge、不 production apply）

STAGE_1 = GLM_STRICT（routeKind = builtin；provider = zai；model =
  glm-5.3；primary = glm53；fallbacks = []）
STAGE_2 = LUNA_COLD_FALLBACK_DEFERRED
GLM_STRICT_AUTHORIZED_AFTER_ACCEPTANCE = YES（本 Amendment 经独立评审 +
  Owner acceptance finalize 并进入 main 后，Phase B 的 GLM 半边与 Phase C
  的 Stage-1 形态方可在其 gate 链下开工；此前 NOT AUTHORIZED）
LUNA_DEFERRED = YES（A1.5 全部边界生效）
LUNA_CREDENTIAL_TOUCHED = NO
LUNA_OAUTH_TOUCHED = NO
PRODUCTION_CHANGE = NONE

BASE_BODY_PRESERVED = YES（§1–§14 + 基础 frontmatter 历史原样；本
  Amendment = frontmatter amendment_1 字段 + 文首 blockquote + 文末追加节，
  纯增量）
SECOND_ROUTE_CHAIN_SPEC_CREATED = NO
SAFETY_SEMANTICS_PRESERVED = YES（A1.6 八项）
PHASE_A_UNCHANGED = YES（a708fc3 / GATE-3 = PASS，不回退不改写）

PRODUCT_CODE_CHANGE = NONE
CREDENTIAL_CHANGE = NONE
CONFIG_CHANGE = NONE
PRODUCTION_CHANGE = NONE
DEPLOYMENT = NONE
RESTART = NONE
MERGE = NO（Draft PR）
NEXT_TASK = 模型 审计
```

### A1.8 Final Output — Amendment 1 Acceptance finalize（2026-08-28；模型 执行轮填写）

```text
TASK_NAME = 模型 执行
TASK_STATUS = ACCEPTANCE_TRANSACTION_COMPLETE（lifecycle-only）

SPEC_ID = AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_ACTIVATION_V1
AMENDMENT_ID = AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_ACTIVATION_V1_AMENDMENT_1_GLM_STRICT_STAGING
amendment_1_status = proposed -> accepted
accepted_by = mayf3
accepted_date = 2026-08-28
reviewed_head = 4e71fd2db78db9f8b80b8636d6c8255d7764d39a
review_verdict = PASS
blocker_count = 0
READY_FOR_ACCEPTANCE = YES（模型 审计轮结论，任务给定）
normative_body_change = NONE

TRANSACTION（lifecycle-only；Amendment 节 normative 内容零改动——
A1.0–A1.7 与基础正文 §1–§14 逐字保留，含 proposed 阶段条件句与
authoring 轮 Final Output）：
  status mirrors = frontmatter amendment_1_* + 文头镜像 + Amendment 节
  标题与 AMENDMENT_STATUS + 本节 provenance + docs/specs/README.md 状态镜像
  pre-acceptance step = 新 main（1f40896，含 PR #95 Phase A 已审计闭包）
    以普通 merge commit 机械带入本分支（无 rebase / squash / force-push；
   带入前后 Amendment 文件与 README 字节不变，diff = 空）

PRESERVED（逐字保持，本轮零改动）：
  STAGE_1 = GLM_STRICT（routeKind = builtin；provider = zai；model =
    glm-5.3；primary = glm53；fallbacks = []）
  STAGE_2 = LUNA_COLD_FALLBACK_DEFERRED（不阻塞 Stage 1；重新 OAuth /
    删除-复制-刷新 OAuth / 安装-升级 dsh-codex / 生产 Luna model call /
    加入 Stage-1 override 全部 FORBIDDEN；加入 fallbacks[] 仅凭 Owner
    再次明确授权）
  Phase A 全部（a708fc3 / GATE-3 = PASS，已随 PR #95 进入 main）
  §9.1 安全边界全文；父 / IMPL 全部 ruling（MAX_CONFIGURED_ROUTES = 4、
    STOP_CHAIN、proven-no-admission 白名单、ONE_LOGICAL_TURN、
    INHERIT_AGENT_CHAIN_ONLY、ROUTE_ORDER_HARDCODED_IN_CODE = FORBIDDEN、
    raw credential 边界、dsh-codex fake carrier 禁止）

PR_LIFECYCLE = PR #94 保持 OPEN（Draft；MERGE = NO；merge 决策不在本轮
  授权内，等待独立采纳审计）

PRODUCT_CODE_CHANGE = NONE
CREDENTIAL_CHANGE = NONE
CONFIG_CHANGE = NONE
PRODUCTION_CHANGE = NONE
DEPLOYMENT = NONE
RESTART = NONE
MERGE = NO

NEXT_TASK = 采纳 审计
```
