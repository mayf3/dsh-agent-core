---
spec_id: AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V2
status: proposed
replaces: AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1（proposal @ 9a408e0，从未 merge）
---

# Agent Core Agent Credential Provisioning V2 — 最小 provisioning contract（replacement）

> 性质：**Spec（SPEC ONLY — 本轮只冻结收敛，不实现）** · 日期：2026-08-18 ·
> Base：`origin/main @ 67404bc` · 仓库：`mayf3/dsh-agent-core` ·
> 角色：Credential Provisioning Simplification Spec Agent
>
> **REPLACES**（`EXISTING_SPEC_DISPOSITION = REPLACE_WITH_SMALLER_SPEC`）：
> `AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1`（proposal @ `9a408e0`，分支
> `docs/agent-core-credential-provisioning-v1-spec`，**从未 merge 到 main**）。
> 旧 proposal 整体保留为 history / evidence pointer，**DO_NOT_ACCEPT / DO_NOT_MERGE**，
> 由本 Spec 记录其关闭理由（§9 减法审计；治理依据 AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1
> §「拒绝理由必须保存」）。本 Spec **standalone**：未来 Implementation Agent 只需要
> 本文档 + §15 evidence 引用，**不需要旧 Spec 的 patch-stack archaeology**。
>
> 本轮只新增本文件。不实现、不修改 Auth / Broker / Router / Runtime 代码，不创建
> credential，不改 agents.json / credential store，不启动 runtime，不 merge。
> **KERNEL_CHANGE = NONE**。

---

## 0. 处置理由（为什么是 replacement 而不是继续 amendment）

1. **D-006 已改变产品前提**：credential provisioning 不再是 Agent birth 的 blocking
   transaction，而是非阻塞、可独立 retry 的 external capability readiness
   （`AGENT_BIRTH_BLOCKS_ON_CREDENTIAL = NO`）。旧 proposal 以「完整 onboarding
   生命周期」为框架构建了 recovery / rotation / revocation 机器，其复杂度建立在
   已被替换的前提上。
2. **旧 proposal 的恢复机器当前不可实现**：其状态 E/G 恢复路径依赖的 machine-client
   secret HTTPS rotation seam 在 auth-service 中**不存在**（仅 machine-admin CLI 且
   newSecret 走 stdout，与 secret handoff 红线冲突）。不可实现的恢复语义留在 V1
   只会产生假覆盖。
3. **Simplification Gate**：migration / recovery 逻辑比目标模型本身还复杂
   → `DESIGN_SMELL = YES`。处置：REPLACE_WITH_SMALLER_SPEC。

## 1. Current Real Blocker（唯一要解决的问题）

```text
formal Agent（agt_* Agent Definition）已存在
but
对应的 Auth principal / machine client / trusted credential entry /
baseline grants 可能不存在
⇒ Broker capability fail-closed：
   gateway credential resolution 返回 credential_unavailable（token mint 未到达）
```

Evidence（不复制调查，只引用 + 代码锚点）：

- `docs/investigations/test-agent-feishu-product-semantics-v1.md` §2（PASS）：
  `FORUM_CREDENTIAL_FAILURE_LAYER = BROKER_GATEWAY_CREDENTIAL_RESOLUTION`；
  `AUTH_TOKEN_MINT_ATTEMPTED = NO`。OpenClaw 身份（`stock-agent` principal /
  `mc_oc_*` clients）以不同身份键存在，不在 Agent Core `agt_*` 命名空间下。
- Fail-closed 点（main 源码核实）：
  `packages/broker/src/gateway.js:154-158`（store error / no credential bound →
  `credential_unavailable`）；store 形状
  `packages/broker/src/credential-store.js:13-16`（`{version:1, credentials:{<agentId>:
  {clientId, clientSecret}}}`，0600、505-private、每次调用重读）。
- Gap 是架构性断点：`packages/agent-definition/src/config.js:78-80` 显式禁止
  Agent Definition 携带 credential 字段；全仓没有任何代码路径在创建 Agent 的同时
  创建 principal / client / store entry（调查 §2.2/§2.3）。

## 2. 已冻结产品前提（D-006 Current Authority，本 Spec 不重新讨论）

```text
AGENT_BIRTH_BLOCKS_ON_CREDENTIAL = NO
AGENT_CHAT_READY = stable agentId + Workspace + AGENTS.md + canonical main/runtime
EXTERNAL_CAPABILITY_READINESS = principal + credential + baseline grants

provisioning failure → DOES_NOT_BLOCK_CHAT
受影响 Broker capability → fail-closed unavailable
later provisioning succeeds → 当前 Agent/main 立即获得能力（无重启、无 main reset）
MAIN_RESET != CAPABILITY_REPAIR
Router ≠ Auth / credential provisioning owner
```

本 Spec 是 D-006 §20 点名的「Auth / Provisioning Spec」：把上述产品前提操作化为
最小 deployment-side provisioning contract。

## 3. Authority 模型（冻结）

```text
PRINCIPAL/CLIENT/GRANT authority = Auth（外部 auth-service）—— deployment-side ensure；
  Agent Core 运行时永远不创建 principal / client / grant
TRUSTED_STORE authority = Deployment / Control Plane（uid505）—— 唯一写入方按 §6 契约
  把 <agentId> → {clientId, clientSecret} 写进 AGENT_CORE_CREDENTIALS_FILE
BROKER = reader / authorized transport（gateway 按 ACTUAL proc.agentId 读取；
  每次调用重读 store ⇒ provisioning 生效不需要重启）
CHILD_RAW_SECRET_ACCESS = NO（V2 验收实证 CHILD_SECRET_ENV/FS=ABSENT、读 store=DENIED）
ROUTER_PROVISIONING_OWNER = NO
PROVISIONING_OWNER = deployment-side trusted tooling（与
  scripts/production-agent-provision.mjs root seam 同类；显式调用，operator/部署触发；
  非 daemon、非 runtime、非 Router、非 scheduler）
```

Provisioner 自身 bootstrap（诚实记录，非新建设计）：调用 Auth ensure seams 需要持有
`auth.identity.provision` scope（audience `svc-auth`）的 provisioning machine
credential，属 **deployment bootstrap 输入**（operator 一次性配置，与 supervision env
同类），按 §7 同等约束保管；Agent Core 运行时不持有。

## 4. 身份映射与 deterministic external_ref（冻结）

四族身份**不要求字符串相等**；运行时零跨族换算：

```text
agentId（agt_*）    = Agent Definition 键 = credential store 唯一查找键
clientId（mc_*）    = auth-service OAuth machine client（store entry 的 clientId）
principal id(UUID)  = auth-service 中该 client 绑定的 principal
JWT claims          = auth 签发时决定（绑定在 client↔principal；业务角色不进 JWT）
```

幂等 ensure 的找回键 = external_ref（auth 侧 opaque、DB-UNIQUE），冻结纯函数：

```text
principalExternalRef(agentId) = "agentcore:v1:principal:" + agentId
clientExternalRef(agentId)    = "agentcore:v1:client:" + agentId
```

（无 agentId 之外的变量；可从 agentId 恢复；与生产既有 `openclaw:agent:<name>`
colon-namespace 惯例同构。Implementation Agent **不得自定 mapping**。）

Ensure 调用体冻结（本 Spec 唯一 Auth 入参面；seam 语义见 §15 auth-service 源码核实）：

```text
POST /api/v1/principals  body = { external_ref: principalExternalRef(agentId),
                                  principal_type: "service",
                                  display_name: <display name 或 agentId> }
POST /api/v1/clients     body = { external_ref: clientExternalRef(agentId),
                                  principal_id: <S1 返回的 principal id> }
```

- `principal_type` 冻结 `"service"`（`"agent"` 需要 human owner 且写入 legacy
  agent_id 命名空间；`"service"` 使 requestDigest 恒定，ensure 永不触发 digest 409）。
- 正常 ensure **不传** `expected_principal_id` / `expected_client_id`（那是 operator
  对既有手工行的 claim 工具，不在 ensure 流内）。
- `display_name` 仅 cosmetic，不参与匹配。

## 5. 最小 flow：`ensureAgentCredential(agentId)` + `ensureBaselineGrants(agentId)`

两个冻结的语义函数（CLI / 脚本入口形态 = 实现自由度，§12）。幂等、确定性、
每次运行重读 trusted store；状态只由 Auth seam **响应**判定（created 标志 /
status 字段），不自选预检查顺序。

```text
ensureAgentCredential(agentId):

P0  agentId ∉ Agent Definition（agents.json）
      → STRUCTURED_REJECT { code:'agent_not_found' }
      → 不调用任何 Auth seam；零 Auth / store 副作用（绝不制造 orphan Auth identity）

P1  ensure principal（POST /api/v1/principals）
      → created=true / false 对后续无差别（同 external_ref ⇒ 同 principal UUID）
      → principal.status ≠ 'active'
        → FAIL_LOUD { code:'auth_principal_not_active' }

P2  ensure client（POST /api/v1/clients）
    a. created=true（首次 provision —— 当前 blocker 的主路径）
         → secret 由 HTTPS response body 直接进入 provisioning 进程内存（§7）
         → 按 §6 契约写 store entry：credentials[agentId] = { clientId, clientSecret }
         → verification mint（P2c）→ PASS 即 credential READY
    b. created=false（重跑 / 已有身份）
         → store entry 缺失
             → FAIL_LOUD { code:'store_entry_missing_after_ensure' }
               （conflicting state：Auth 身份存在但本地 secret 不可恢复——
                 raw secret 仅 created=true 时返回一次。V1 不自动恢复；
                 修复路径 = FOLLOW_UP rotation Spec / operator out-of-band，
                 见 §9 / §11）
         → store.clientId ≠ 响应 client_id
             → FAIL_LOUD { code:'identity_split_brain' }
               （绝不静默创建平行身份 / 第二 client / 第二 principal）
         → 一致 → verification mint（P2c）
    c. verification mint = POST /oauth/token（client_credentials；secret 从 store
       读入内存、in-process 构造 Basic header；scope 取自已部署 capability
       manifests 的任一 HTTP 组合）。解释表（依据 auth token endpoint 校验顺序：
       client 查找 → secret 验证 → scope 验证）：
         200 + access_token     → credential 有效 ⇒ credential READY（幂等 NO-OP：
                                  不 rotate、不重写 store、不缓存 token）
         400 invalid_scope      → credential 有效、仅缺该 scope 的 grant ⇒ credential
                                  READY（grant 缺口归 P3 / §8，不触发任何 credential
                                  动作）
         401 invalid_client     → credential 无效 → FAIL_LOUD { code:'credential_invalid' }
                                  （V1 不自动 rotate；修复路径 = FOLLOW_UP rotation Spec）
         网络不可达 / 5xx / malformed → FAIL_LOUD { code:'verification_inconclusive' }
                                  （不得当作 valid 记 NO-OP，也不得当作 invalid 触发动作）

ensureBaselineGrants(agentId)（§8；在 credential READY 之后执行）
→ 输出 per-step readiness 报告（credential / grants 各自状态）
```

所有 FAIL_LOUD = 结构化错误 + 非零退出 + 零 store 变更（P2a 写入路径除外）+ 零平行
身份。**Retry = 完整重跑**：每个 step 天然收敛（幂等 seam + deterministic
external_ref + validate-preserve store 写），无部分状态恢复机器、无 daemon。

生效语义（对齐 D-006）：store 写入后，Broker **下一次调用**即解析到 credential
（gateway 每次调用重读 store）——当前 Agent/main 立即获得能力，无重启、无 main reset。

## 6. Trusted credential store 写契约（冻结）

红线：provision Agent A 绝不能覆盖 / 破坏 Agent B/C 的 entry。

```text
S1 目标文件 = AGENT_CORE_CREDENTIALS_FILE（绝对路径；所在目录 505-private，
   不得 group/world 可读）
S2 写前读现有 store 文档
S3 按 loadCredentialsStore 同等语义完整校验（version===1、credentials 为 object、
   每个 entry 可 normalize）→ malformed / 任一 entry 损坏 → FAIL_LOUD、
   MUST NOT overwrite、MUST NOT「顺手修复」
S4 所有无关 entry 原样保留（逐字节不变）
S5 只变更目标 agentId 的 entry；顶层 shape 恒为 { version:1, credentials:{...} }
S6 同目录 private temp file（mode 0600 先于任何 secret 内容写入）→ fsync →
   rename 原子替换 →（SHOULD）fsync 目录；owner = trusted CP（uid505）
S7 单写者 / operator 串行；不建 distributed lock；Agent Core 运行时保持只读
```

明令禁止：in-place 部分写、跨 filesystem rename、temp 落 /tmp、group/world-readable
temp/store、以修复名义覆写 malformed store。

## 7. Secret handoff（冻结）

raw secret 唯一允许路径：

```text
auth-service HTTPS response body
  → trusted provisioning process memory（立即消费，无中间态）
  → credential store writer（§6）
  → uid505-owned 0600 store 文件（唯一持久终点）
```

禁止清单（任何形态，含 debug/diagnostic/audit 路径）：argv / env / stdout / stderr /
任何 log sink（错误 detail 与 audit 行只允许 agentId 与 clientId）/ shell substitution /
`curl -u client:secret`（Basic header 只允许进程内由代码构造）/ child process 传递 /
Agent workspace / agents.json / DSH prompt / Feishu 或任何 IM / OpenClaw
credentialRefs。已知反模式（现状存在、不得复制）：auth CLI `machine-admin client
rotate` 把 newSecret 打到 stdout；本仓库验收脚本曾把 secret 拼进 grep argv。

同 uid 攻击面约束沿用 `same-uid-router-secret-boundary-audit-v1` 硬前提
（同 uid 经 ps 全量可读 env/argv）：credential 永不经 env/argv 交付；store 及交付
文件 505-owned 0600；Router/工具可执行代码面不得 502 可写。

## 8. Baseline grants — 最薄 contract

D-006 冻结「new Agent eventually receives standard baseline grant profile」，
**具体 profile 内容（forum.* / workflow.* / …）不属于本 Spec**。本 Spec 只冻结：

```text
ensureBaselineGrants(agentId)
  前提   : ensureAgentCredential 已 READY（需要 clientId）
  语义   : 幂等确保该 client 拥有 standard baseline grant profile
  实现面 : 外部 auth seam（named external prerequisite）
           —— auth 现状：幂等建 client 固定 allowedResources/allowedScopes=[]，
           业务 grant 载体 MachineAccessGrant 目前无正式 HTTP/CLI mutation seam
           （仅一次性脚本直连 DB）
  缺失时 : FAIL_LOUD { code:'external_prerequisite_missing', step:'baseline_grants' }
           —— 仅此步失败：credential 步骤成果保留（不回滚）、chat 不受影响、
           受影响 capability 维持授权失败（≠ credential_unavailable）、重跑收敛
  禁止   : 本 repo 顺手建设 grant platform / auto-grant / Policy Engine
  AUTH_CHANGE_REQUIRED = EXTERNAL_ONLY（外部依赖声明，不授权本 repo 改 auth-service）
```

credential existence ≠ business grant（两层必须可区分）：verification mint 的
`400 invalid_scope` 即「credential 有效 + grant 缺失」的最小可区分证据（§5 P2c）。

## 9. 减法审计（旧 proposal → 本 Spec）

对旧 proposal（929 行）逐块分类。原则：不因为已经写过就保留；只修「真实跑不起来 /
真实安全漏洞 / 假 PASS 假 FAIL」，其余全部 debt。

| 旧 proposal 块 | 分类 | 处置 |
|---|---|---|
| Part A 全量 source trace（A.1–A.3） | evidence，非 contract | **退出 Spec**：保留 §1 三行锚点 + §15 引用 Investigation |
| Part A.4 S1/S2/S3/S5/S6 auth seam 事实 | REQUIRED_FOR_CURRENT_BLOCKER（幂等 ensure 的依据） | **保留压缩**（§4/§5/§15） |
| Part B authority 模型 | REQUIRED_FOR_CURRENT_BLOCKER | 保留（§3） |
| Part C / C.4 四族身份 + external_ref | REQUIRED_FOR_CURRENT_BLOCKER（幂等找回） | 保留（§4） |
| Part D 状态 A（not found reject） | REQUIRED（fail-loud，防 orphan identity） | 保留（P0） |
| Part D 状态 B/C（ensure principal/client + 写 store） | REQUIRED_FOR_CURRENT_BLOCKER | 保留（P1/P2a） |
| Part D 状态 D（幂等 NO-OP + mint 验证） | REQUIRED（idempotency / verify） | 保留（P2b/P2c） |
| Part D 状态 E（missing-store 自动恢复） | PREMATURE_COMPLEXITY（依赖缺失的 rotation seam，当前不可实现） | **降级为 FAIL_LOUD**（P2b）；自动恢复 = FOLLOW_UP |
| Part D 状态 F（split-brain 检测 + recovery runbook） | 检测 = REAL_SECURITY_REQUIREMENT；recovery = FOLLOW_UP | 检测保留（P2b）；runbook 细节退出 |
| Part D 状态 G（secret invalid 自动 rotate） | PREMATURE_COMPLEXITY（同 E） | **降级为 FAIL_LOUD**（P2c）；修复 = FOLLOW_UP |
| Part D.5 verification mint 解释表 | REQUIRED（verify step；防假 PASS/假 FAIL） | 保留（P2c） |
| Part D.6 Agent 删除/disable 集成 | FOLLOW_UP_DEBT（revocation 范畴） | 退出（§11） |
| Part E credential ≠ grant | REAL_SECURITY_REQUIREMENT | 保留压缩（§8） |
| Part E.4 grant seam 深挖 | REQUIRED（诚实外部依赖声明） | 保留压缩（§8） |
| Part F 三层 failure 语义 + Broker error-classification（YES_MINIMAL） | 层归属 = 保留；Broker 运行时错误码改造 = FOLLOW_UP_DEBT（当前 blocker 修复零 Broker 改动） | 层归属压缩进 §1/§8；Broker 改动退出（§11） |
| Part G store 写契约 | REAL_SECURITY_REQUIREMENT | 保留（§6） |
| Part H secret handoff | REAL_SECURITY_REQUIREMENT | 保留（§7） |
| Part I rotation | FOLLOW_UP_DEBT | **退出 V1**（§11） |
| Part J revocation | FOLLOW_UP_DEBT | **退出 V1**（§11；其「store-entry 移除先行、本地立即 fail-closed」顺序留作 FOLLOW_UP Spec 的出发点） |
| L1-7（same-client 恢复验收） | 依赖 rotation | 退出（对应 AC 改为 FAIL_LOUD 断言，AC6） |

**关键问题回答**：删除 rotation / revocation / generalized recovery framework 后，
当前 credential blocker 是否仍能安全解决？—— **YES**：

1. blocker 是身份**缺失**（fresh provision 主路径 P2a），从不经过 E/F/G；
2. 幂等 seam + deterministic external_ref 使「重试即收敛」，无需恢复机器；
3. 被删除的恢复路径本身依赖缺失的外部 rotation seam，本就不可实现；
4. 冲突状态降级为 FAIL_LOUD（无平行身份、无 store 破坏、Broker 维持 fail-closed、
   chat 不受影响）——安全属性不降级，只是自动修复推迟。

## 10. Failure semantics 与 chat 解耦（D-006 对齐）

```text
CHAT_BLOCKED_BY_CREDENTIAL_FAILURE = NO（provisioning 任何一步失败都不阻塞聊天）
BROKER_FAIL_CLOSED = YES（credential 缺失 ⇒ gateway credential_unavailable，
  token mint 不发生；不伪造、不降级、不 fallback）
RETRY_SUPPORTED = YES（完整重跑收敛；无 daemon、无 interval 约定——重试触发方式
  = operator / 部署显式调用；birth 时自动触发 / 自动重试 coordinator = FOLLOW_UP，
  且 owner 永远不是 Router）
MAIN_RESET_REQUIRED_FOR_REPAIR = NO（store 生效 = 下一次调用；与 main reset 无关）
```

## 11. Explicit non-goals / 禁止建设

```text
ROTATION                = FOLLOW_UP（前置：auth 侧 HTTPS rotation seam——现存
                          machine-admin CLI stdout 方式与 §7 冲突，不得借用）
REVOCATION              = FOLLOW_UP
GENERALIZED_RECOVERY    = FOLLOW_UP（E/G 状态自动恢复、reconciliation）
RECONCILIATION_PLATFORM = NO
PROVISIONING_DAEMON     = NO
IAM_PLATFORM            = NO
POLICY_ENGINE           = NO
ROUTER_CREDENTIAL_MANAGER = NO
Broker 运行时 error-classification 改造 = FOLLOW_UP_DEBT（credential 层与
  授权层的运行时可区分性；provisioning 侧可区分性已由 verification mint 保证）
BROKER_CHANGE           = NONE（本 Spec 的实现零 Broker 改动）
child-held credential / OpenClaw fallback / credential 入 agents.json /
  一卡通字符串复用 / legacy machine-admin create 兜底 / CLI stdout 捕获 secret
                        = 禁止（继承旧 proposal 已论证否决的 alternatives）
KERNEL_CHANGE           = NONE
```

## 12. Scope（未来 Implementation 允许做什么）

在本文档 `status: accepted` 之后：

1. **Deployment-side provisioning tooling**：实现 §5 两个函数（P0–P2 + §6 store
   契约 + §7 handoff + §8 grants contract），经 §4 冻结的幂等 seam 与调用体。
   首要用例 = 既有 `agt_*` canary Agent 的 backfill。
2. **验收驱动**：§13 AC 的可复现断言脚本。
3. 实现自由度（**不上抛 Owner**，由 Implementation Agent 决定并在 PR 说明）：
   CLI/API/脚本入口形态、报告输出格式、temp 文件命名、§6 S7 串行化具体机制
   （lock 文件或 operator 串行）、verification mint 所选 scope 组合。

## 13. Acceptance Criteria

**L1 — credential 自身（必须全绿）：**

- AC1 fresh ensure：agent 存在 → 运行后 Auth principal（deterministic external_ref）
  + machine client + trusted store entry（keyed by agentId）齐备，verification mint
  真实发生（`AUTH_TOKEN_MINT_ATTEMPTED = YES`）。
- AC2 幂等：重复 ensure ≥3 次 → SAME principal id、SAME clientId；Auth 侧无
  agentcore external_ref 之外的重复行；无 orphan。
- AC3 store 契约：0600、505-owned；预置 unrelated entry 后 ensure 另一 agent，
  unrelated entry 逐字节不变；预置 malformed store → FAIL_LOUD 且文件不变。
- AC4 child 隔离：`CHILD_SECRET_ENV=ABSENT / CHILD_SECRET_FS=ABSENT /
  A_READ_CREDENTIAL_STORE=DENIED`（V2 验收同口径）。
- AC5 P0 负例：不存在的 agentId → STRUCTURED_REJECT；Auth 与 store 零新建行。
- AC6 冲突状态负例（FAIL_LOUD 断言）：store entry 缺失但 client 已存在 /
  store.clientId 不一致 / mint 401 → 各自结构化错误码，零平行身份、零 store 变更、
  不尝试自动恢复。
- AC7 生效语义：ensure 前 Broker 调用 = credential_unavailable（chat 正常）；
  ensure 后同一 Agent 下一次调用即成功解析（无重启、无 main reset）。

**L2 — grant 分离：**

- AC8 credential READY 但 baseline grant 未就绪 → 授权失败语义
  （invalid_scope 等）≠ credential_unavailable；grants step 缺外部 seam →
  `external_prerequisite_missing` FAIL_LOUD，credential 成果保留，重跑收敛。

**L3 — 正向（条件验收）：**

- AC9 **only if** baseline grants 经 named external prerequisite 已就绪 → Broker →
  token → `forum_list_threads` 返回业务结果。不接受 fake credential / mock-only
  Broker / manual bearer / OpenClaw fallback。

## 14. Risks

- secret 落 child 可读位置 → §7 唯一路径 + 禁止清单 + AC4。
- provision 覆盖他 Agent entry → §6 validate-preserve-atomic + AC3。
- 冲突状态被静默「修复」出平行身份 → §5 FAIL_LOUD 冻结 + AC6。
- grant 缺失被折叠为 credential 故障 → §8 分离 + AC8。
- 把 FOLLOW_UP 偷渡回 V1（rotation/revocation/daemon）→ §11 明令禁止；
  重开需 NEW_EVIDENCE。

## 15. Related Evidence

- Current Authority：`docs/decisions/AGENT_WORKSPACE_SESSION_MODEL_V2.md`（D-006，
  accepted；§20 非阻塞 provisioning / Router 边界 / baseline profile 留给本 Spec）。
- Governing investigation（PASS）：
  `docs/investigations/test-agent-feishu-product-semantics-v1.md` §2
  （failure layer / OpenClaw 身份 gap / AUTH_TOKEN_MINT_ATTEMPTED = NO）。
- Trusted gateway 验收：`docs/reports/trusted-credential-broker-integration-v1.md`、
  `docs/reports/trusted-credential-505-final-acceptance-v2.md`（505/502 边界、
  CHILD_SECRET_* ABSENT）。
- 信任边界：`docs/investigations/identity-auth.md`、
  `docs/investigations/same-uid-router-secret-boundary-audit-v1.md`（草稿；
  结论已由 V2 验收与 ps 实证支撑）。
- 外部 auth-service 源码核实（2026-08-17 首核于旧 proposal Part A.4；
  **2026-08-18 本轮对 ~/workspace/project/auth-service 复核通过**）：
  `src/routes/idempotent.ts`（S1/S2 幂等 seam；"Auth does not interpret
  external_ref"；secret 仅 created=true 时随 response body 返回一次）、
  `src/lib/oauth/v1/idempotent.ts`（新建 client 固定 allowedResources/
  allowedScopes=[]）、`src/lib/oauth/token-issuance.ts`（401 invalid_client 先于
  400 invalid_scope）、`src/routes/`（无 rotation HTTP seam）、
  `src/lib/oauth/service.ts`（legacy machine-admin create 非幂等——禁止用于 ensure）。
- 被替换的旧 proposal（history/evidence only，DO_NOT_MERGE）：
  分支 `docs/agent-core-credential-provisioning-v1-spec` @ `9a408e0`
  （`AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1`，proposed，从未 merge）。

## 16. SPEC_STATUS

```text
SPEC_STATUS = proposed（本轮 SPEC ONLY，未实施、未 merge）
RUNTIME_CHANGE = NONE · ROUTER_CHANGE = NONE · BROKER_CHANGE = NONE
AUTH_CHANGE = NO_IN_REPO（外部依赖声明见 §8）· PRODUCT_CODE_CHANGE = NONE
KERNEL_CHANGE = NONE
```

---

## Final Output

```text
AGENT_CORE_CREDENTIAL_PROVISIONING_SIMPLIFICATION = PASS

CURRENT_REAL_BLOCKER =
  formal Agent（agt_*）存在，但 Auth principal / machine client / trusted
  credential entry / baseline grants 缺失 ⇒ Broker capability fail-closed
  （credential_unavailable @ gateway credential resolution，token mint 未到达）

MINIMUM_REQUIRED_FLOW =
  ensureAgentCredential(agentId)：
    P0 Agent Definition 校验（not found → STRUCTURED_REJECT，零副作用）
    → P1 ensurePrincipal（POST /api/v1/principals，幂等）
    → P2 ensureClient（POST /api/v1/clients，幂等；secret HTTPS-body→内存）
       → store write（validate-preserve-atomic，0600/505）
       → verification mint（200/400=READY，401/冲突=FAIL_LOUD）
  → ensureBaselineGrants(agentId)（最薄 contract；外部 seam；缺失=FAIL_LOUD per-step）
  → per-step readiness 报告；重跑即收敛

EXISTING_SPEC_DISPOSITION = REPLACE_WITH_SMALLER_SPEC
  （旧 proposal @ 9a408e0 从未 merge；整体保留为 history/evidence pointer，
   DO_NOT_ACCEPT / DO_NOT_MERGE；本 Spec standalone，零 patch-stack archaeology）

KEEP =
  authority 模型（Auth=principal/client/grant 权威；store=deployment/505；
    Broker=reader；child 无 raw secret；Router 无涉）
  四族身份映射 + deterministic external_ref（agentcore:v1:principal|client:<agentId>）
  幂等 ensure 调用体（principal_type=service；不传 expected_*）
  trusted store 写契约（validate-preserve-atomic + 0600/505 + 单写者）
  secret handoff 唯一路径 + 禁止清单
  credential ≠ grant（两层可区分；invalid_scope=最小证据）
  verification mint 解释表（防假 PASS/假 FAIL）
  FAIL_LOUD on corrupt/conflicting state（无平行身份、不覆写 store）
  非阻塞语义（chat 不阻塞 / Broker fail-closed / 重跑收敛 / 无 main reset 耦合）

REMOVE_FROM_V1 =
  rotation（旧 Part I）
  revocation（旧 Part J）
  状态 E/G 自动恢复（missing-store / secret-invalid 的 rotation 修复路径）
  状态 F recovery runbook 细节（检测保留，恢复降级 FAIL_LOUD）
  旧 Part D.6 Agent 删除/disable 集成
  旧 Part A 全量 source trace（保留三行锚点 + Investigation 引用）
  Broker 运行时 error-classification 改造（BROKER_CHANGE：YES_MINIMAL → NONE）
  L1-7 same-client 恢复验收（改为 AC6 FAIL_LOUD 断言）

FOLLOW_UP_DEBT =
  rotation Spec（外部前置：auth HTTPS rotation seam；CLI stdout 方式禁用）
  revocation Spec（store-entry 移除先行、本地立即 fail-closed 的顺序值得继承）
  E/G 状态自动恢复 / generalized recovery / reconciliation
  baseline grant mutation seam（外部 auth 侧）
  birth 时自动触发 provisioning 的 trusted coordinator seam（owner ≠ Router）
  Broker 运行时 credential/授权/transport 三层错误码可区分性

REJECTED_PLATFORMS = RECONCILIATION_PLATFORM / PROVISIONING_DAEMON / IAM_PLATFORM /
  POLICY_ENGINE / ROUTER_CREDENTIAL_MANAGER —— 全部 NO（无当前 production evidence
  证明其中任何一项是 blocker）

关键问题（删除 rotation/revocation/generalized recovery 后 blocker 是否仍安全解决）
  = YES（blocker=身份缺失主路径；幂等重试即收敛；被删恢复路径本依赖缺失的外部
    seam 不可实现；冲突状态降级 FAIL_LOUD 不降级安全属性）

CHAT_BLOCKED_BY_CREDENTIAL_FAILURE = NO
BROKER_FAIL_CLOSED = YES
RETRY_SUPPORTED = YES
MAIN_RESET_REQUIRED_FOR_REPAIR = NO

ROUTER_PROVISIONING_OWNER = NO
KERNEL_CHANGE = NONE

NEW_SPEC_PATH = docs/specs/AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V2.md
  （本 Spec；status: proposed；BASE = origin/main @ 67404bc）

OWNER_DECISIONS_STILL_REQUIRED = NONE
  （CLI/API 形态、重试方式、temp/lock 实现等均为 §12 实现自由度，不上抛）

SPEC_ONLY = YES（IMPLEMENTATION = NONE / PRODUCT_CODE_CHANGE = NONE /
  KERNEL_CHANGE = NONE；commit + push，不 merge）
```
