---
spec_id: AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V2
status: proposed
replaces: AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1（proposal @ 9a408e0，从未 merge）
---

# Agent Core Agent Credential Provisioning V2 — 最小 provisioning contract（replacement）

> 性质：**Spec（SPEC ONLY — 本轮只冻结收敛，不实现）** · 初版：2026-08-18 ·
> Amendment 1（FINAL_SCOPE_FIX）：2026-08-18，base reviewed HEAD `457f29f` ·
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
> 本轮（Amendment 1）只原地修改本文件。不实现、不修改 Auth / Broker / Router /
> Runtime 代码，不创建
> credential，不改 agents.json / credential store，不启动 runtime，不 merge。
> **KERNEL_CHANGE = NONE**。

---

## Amendment 1 摘要（FINAL_SCOPE_FIX，2026-08-18，基于 reviewed HEAD 457f29f）

Review 裁决 `CREDENTIAL_PROVISIONING_SIMPLIFICATION = FIX_REQUIRED`：整体简化方向
正确，rotation / revocation / generalized recovery 的删除**接受**。本轮只修 3 项，
原地 Amendment（同一文件，不建平行 Spec），不重新讨论已冻结方向：

1. **FIX 1（birth 触发入 V2）**：birth 自动触发 provisioning 从 FOLLOW_UP 改为
   V2 必须授权的极薄 seam——`BIRTH_PROVISIONING_TRIGGER = REQUIRED`、
   `CHAT_WAITS_FOR_PROVISIONING = NO`（D-006：provisioning 出生时启动、非阻塞）。
   无 daemon；失败修复 = explicit complete rerun。
2. **FIX 2（baseline grants 去 conditional PASS）**：`ensureBaselineGrants(agentId)`
   退出 V2 可实施闭环（formal MachineAccessGrant mutation seam = MISSING）——
   `BASELINE_GRANT_IMPLEMENTATION_STATUS = EXTERNAL_PREREQUISITE_MISSING`，
   移交后续单独最小 Spec（Auth 侧变更）；删除 L3 conditional positive 验收。
3. **FIX 3（store 保留语义）**：无关 entry 的「逐字节不变」改为
   「语义内容不变」（no entry lost / no entry mutated；不要求 JSON 文本字节保留）。

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

external capability provisioning 出生时启动（best-effort，见 §5 调用时机 / §10）
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
  scripts/production-agent-provision.mjs root seam 同类）。两种触发（§5 调用时机）：
  (1) Agent 出生时经极薄 birth → trusted provisioning seam best-effort 触发
      （REQUIRED；owner ≠ Router）；(2) operator / 部署显式完整重跑
      （backfill / 修复）。非 daemon、非 runtime、非 Router、非 scheduler
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

## 5. 最小 flow：`ensureAgentCredential(agentId)`（V2 可实施闭环）

冻结的语义函数（CLI / 脚本入口形态 = 实现自由度，§12）。幂等、确定性、
每次运行重读 trusted store；状态只由 Auth seam **响应**判定（created 标志 /
status 字段），不自选预检查顺序。**V2 可实施闭环到 verify credential 为止**
（baseline grants 见 §8，不在本 flow 内）。

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
                 raw secret 仅 created=true 时返回一次。V2 不自动恢复；
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
                                  READY（grant 缺口按 §8 记录为 external
                                  prerequisite，不触发任何 credential 动作）
         401 invalid_client     → credential 无效 → FAIL_LOUD { code:'credential_invalid' }
                                  （V2 不自动 rotate；修复路径 = FOLLOW_UP rotation Spec）
         网络不可达 / 5xx / malformed → FAIL_LOUD { code:'verification_inconclusive' }
                                  （不得当作 valid 记 NO-OP，也不得当作 invalid 触发动作）

ensureBaselineGrants —— 不在本 flow 内（Amendment 1：退出 V2 可实施闭环，§8）
→ 输出 credential readiness 报告；baseline grants 缺口如实标注
  external prerequisite missing（记录，不是实现步骤）
```

所有 FAIL_LOUD = 结构化错误 + 非零退出 + 零 store 变更（P2a 写入路径除外）+ 零平行
身份。**Retry = 完整重跑**：每个 step 天然收敛（幂等 seam + deterministic
external_ref + validate-preserve store 写），无部分状态恢复机器、无 daemon。

生效语义（对齐 D-006）：store 写入后，Broker **下一次调用**即解析到 credential
（gateway 每次调用重读 store）——当前 Agent/main 立即获得能力，无重启、无 main reset。

调用时机（Amendment 1 冻结——FIX 1）：

```text
BIRTH_PROVISIONING_TRIGGER = REQUIRED
  first eligible human message
  → create Agent
  → establish chat-ready Agent
  → best-effort invoke trusted provisioning seam
    （极薄 birth → trusted provisioning seam；owner ≠ Router；
     本轮不设计具体 coordinator / API / queue）

CHAT_WAITS_FOR_PROVISIONING = NO
  provisioning 失败 → chat continues；
  受影响 Broker capability remains fail-closed unavailable

AUTO_RETRY_DAEMON = NO
  失败后的修复 = explicit complete rerun（operator / 部署显式调用；重跑天然收敛）
  MANUAL/DEPLOY_RETRY = YES
```

## 6. Trusted credential store 写契约（冻结）

红线：provision Agent A 绝不能覆盖 / 破坏 Agent B/C 的 entry。

```text
S1 目标文件 = AGENT_CORE_CREDENTIALS_FILE（绝对路径；所在目录 505-private，
   不得 group/world 可读）
S2 写前读现有 store 文档
S3 按 loadCredentialsStore 同等语义完整校验（version===1、credentials 为 object、
   每个 entry 可 normalize）→ malformed / 任一 entry 损坏 → FAIL_LOUD、
   MUST NOT overwrite、MUST NOT「顺手修复」
S4 所有无关 entry 语义内容保留（no entry lost / no entry mutated；不要求保留
   JSON whitespace / 序列化字节 / object formatting——不得因此引入
   text-preserving JSON machinery）
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

## 8. Baseline grants — 保留要求、外部前置缺失、另行 Spec（Amendment 1 重写）

D-006 冻结「new Agent eventually receives standard baseline grant profile」——该
产品要求保留（本 Spec 不削减 D-006）：

```text
D006_BASELINE_GRANT_REQUIREMENT = PRESERVED
```

但 evidence 已确认 **formal MachineAccessGrant mutation seam = MISSING**（auth
现状：幂等建 client 固定 allowedResources/allowedScopes=[]；业务 grant 载体
MachineAccessGrant 仅一次性脚本直连 DB 可变，无正式 HTTP/CLI 管理面）。因此不把一个
当前不存在的 `ensureBaselineGrants(agentId)` 假装成本 Spec 已可实现的责任——
baseline grants **不属于本 Spec（Credential V2）的实施范围与 acceptance blocker**：

```text
BASELINE_GRANT_IMPLEMENTATION_STATUS = EXTERNAL_PREREQUISITE_MISSING
BASELINE_GRANT_PROVISIONING_SPEC_REQUIRED = YES
  （后续单独最小 Spec：建立 ensure standard baseline grant profile 的
    正式幂等 Auth seam；不在本 Spec 中建设）
AUTH_SIDE_CHANGE_REQUIRED = YES（外部 auth-service 侧变更；
  AUTH_CHANGE_REQUIRED = EXTERNAL_ONLY —— 外部依赖声明，不授权本 repo 改 auth）
```

- 本 Spec 的可实施闭环 = §5 的 verify credential 为止；实现与验收均**不含**
  grants 步骤，不允许通过 mock / manual bearer / fake grant 宣称完成。
- Credential V2 PASS 只证明 **credential identity provisioning works**；不声称
  `ALL_BASELINE_CAPABILITIES_READY`。
- credential existence ≠ business grant 的两层可区分性仍然冻结（两层必须可区分；
  零 grant 新 client 的 verification mint `400 invalid_scope` = 「credential 有效 +
  grant 缺失」的最小可区分证据，§5 P2c）。
- 禁止在本 Spec 内顺手建设 grant platform / auto-grant / Policy Engine。

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
| Part I rotation | FOLLOW_UP_DEBT | **退出 V2**（不在本 replacement Spec；§11） |
| Part J revocation | FOLLOW_UP_DEBT | **退出 V2**（§11；其「store-entry 移除先行、本地立即 fail-closed」顺序留作 FOLLOW_UP Spec 的出发点） |
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
BIRTH_PROVISIONING_TRIGGER = REQUIRED（出生时 best-effort 触发，§5 调用时机；
  极薄 birth → trusted provisioning seam，owner ≠ Router —— D-006 产品前提，
  不是 FOLLOW_UP）
CHAT_WAITS_FOR_PROVISIONING = NO
RETRY_SUPPORTED = YES（失败修复 = explicit complete rerun：operator / 部署显式
  调用，完整重跑天然收敛；AUTO_RETRY_DAEMON = NO，无 reconcile loop）
MAIN_RESET_REQUIRED_FOR_REPAIR = NO（store 生效 = 下一次调用；与 main reset 无关）
```

## 11. Explicit non-goals / 禁止建设

```text
ROTATION                = FOLLOW_UP（前置：auth 侧 HTTPS rotation seam——现存
                          machine-admin CLI stdout 方式与 §7 冲突，不得借用）
REVOCATION              = FOLLOW_UP
GENERALIZED_RECOVERY    = FOLLOW_UP（E/G 状态自动恢复、reconciliation）
RECONCILIATION_PLATFORM = NO
PROVISIONING_DAEMON     = NO（含 auto-retry / reconcile loop；birth 触发是一次性
                          best-effort invoke，不是 daemon）
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

1. **Deployment-side provisioning tooling**：实现 §5 `ensureAgentCredential(agentId)`
   （P0–P2 + §6 store 契约 + §7 handoff；**不含 baseline grants**，§8），经 §4
   冻结的幂等 seam 与调用体。首要用例 = 既有 `agt_*` canary Agent 的 backfill。
2. **极薄 birth → trusted provisioning seam**（Amendment 1 新增授权——FIX 1）：
   Agent 出生路径 best-effort 调用 provisioning tooling（fire-and-forget、非阻塞、
   失败结构化记录、chat 绝不等待；owner ≠ Router）。本轮不设计 coordinator /
   API / queue / daemon 形态——具体机制为实现自由度，但 Router 不得成为 owner。
3. **验收驱动**：§13 AC 的可复现断言脚本。
4. 实现自由度（**不上抛 Owner**，由 Implementation Agent 决定并在 PR 说明）：
   CLI/API/脚本入口形态、报告输出格式、temp 文件命名、§6 S7 串行化具体机制
   （lock 文件或 operator 串行）、verification mint 所选 scope 组合、birth 触发
   seam 的具体机制（owner ≠ Router 前提下）。

## 13. Acceptance Criteria

**L1 — credential 自身（必须全绿）：**

- AC1 fresh ensure：agent 存在 → 运行后 Auth principal（deterministic external_ref）
  + machine client + trusted store entry（keyed by agentId）齐备，verification mint
  真实发生（`AUTH_TOKEN_MINT_ATTEMPTED = YES`）。
- AC2 幂等：重复 ensure ≥3 次 → SAME principal id、SAME clientId；Auth 侧无
  agentcore external_ref 之外的重复行；无 orphan。
- AC3 store 契约：0600、505-owned；预置 unrelated entry 后 ensure 另一 agent，
  unrelated entry 语义内容不变（no entry lost / no entry mutated；不要求 JSON
  文本字节保留）；预置 malformed store → FAIL_LOUD 且文件不变。
- AC4 child 隔离：`CHILD_SECRET_ENV=ABSENT / CHILD_SECRET_FS=ABSENT /
  A_READ_CREDENTIAL_STORE=DENIED`（V2 验收同口径）。
- AC5 P0 负例：不存在的 agentId → STRUCTURED_REJECT；Auth 与 store 零新建行。
- AC6 冲突状态负例（FAIL_LOUD 断言）：store entry 缺失但 client 已存在 /
  store.clientId 不一致 / mint 401 → 各自结构化错误码，零平行身份、零 store 变更、
  不尝试自动恢复。
- AC7 生效语义：ensure 前 Broker 调用 = credential_unavailable（chat 正常）；
  ensure 后同一 Agent 下一次调用即成功解析（无重启、无 main reset）。

- AC8 birth 触发非阻塞（Amendment 1——FIX 1）：新 Agent 出生（first eligible
  human message）→ best-effort 触发 trusted provisioning seam；
  `CHAT_WAITS_FOR_PROVISIONING = NO`（provisioning 失败 / 未完成时 chat 正常
  进行、受影响 capability 维持 fail-closed unavailable）；无 daemon。

**L2 — grant 分离（诚实边界；Amendment 1 起不构成 conditional PASS）：**

- AC9 credential READY 但 baseline grant 未就绪（V2 provisioning 后的零 grant
  client 即自然状态）→ 授权失败语义（invalid_scope 等）≠ credential_unavailable。
  **本 Spec 验收到此为止**：不设 grants conditional positive AC；不以 mock /
  manual bearer / fake grant 宣称完成；Credential V2 PASS 只证明 credential
  identity provisioning works，不声称 `ALL_BASELINE_CAPABILITIES_READY`（§8）。

不接受（全局）：fake credential / mock-only Broker / manual bearer /
OpenClaw fallback / fake grant。

## 14. Risks

- secret 落 child 可读位置 → §7 唯一路径 + 禁止清单 + AC4。
- provision 覆盖他 Agent entry → §6 validate-preserve-atomic + AC3。
- 冲突状态被静默「修复」出平行身份 → §5 FAIL_LOUD 冻结 + AC6。
- grant 缺失被折叠为 credential 故障、或被 mock/fake 成就绪 → §8 分离与诚实
  边界 + AC9。
- birth 触发演化为阻塞 chat 或 daemon → §5 调用时机 / §10 / §11 冻结 + AC8。
- 把 FOLLOW_UP 偷渡回 V2（rotation / revocation / daemon / grant platform）→
  §11 明令禁止；重开需 NEW_EVIDENCE。

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
AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V2 —— Amendment 1（FINAL_SCOPE_FIX）

CREDENTIAL_PROVISIONING_V2_FINAL_SCOPE_FIX = PASS

BIRTH_PROVISIONING_TRIGGER = REQUIRED
  （first eligible human message → create Agent → establish chat-ready Agent →
    best-effort invoke trusted provisioning seam；极薄 seam，owner ≠ Router，
    本轮不设计 coordinator/API/queue；D-006 产品前提，不是 FOLLOW_UP）
CHAT_WAITS_FOR_PROVISIONING = NO
AUTO_RETRY_DAEMON = NO · MANUAL/DEPLOY_RETRY = YES（explicit complete rerun，
  重跑天然收敛）

CREDENTIAL_IMPLEMENTATION_SCOPE =
  Agent exists → ensure principal → ensure machine client → persist trusted
  credential → verify credential（V2 可实施闭环到此为止）
BASELINE_GRANT_IMPLEMENTATION_STATUS = EXTERNAL_PREREQUISITE_MISSING
  （formal MachineAccessGrant mutation seam = MISSING，evidence 已确认）
BASELINE_GRANT_PROVISIONING_SPEC_REQUIRED = YES
AUTH_SIDE_CHANGE_REQUIRED = YES
  （后续单独最小 Spec 建立 ensure standard baseline grant profile 的正式幂等
    Auth seam；不在 Credential V2 中建设；D006_BASELINE_GRANT_REQUIREMENT =
    PRESERVED——要求保留，实现移交）

CONDITIONAL_PASS_REMAINING = NONE
  （L3 conditional positive 已删除；Credential V2 PASS 只证明 credential
    identity provisioning works，不声称 ALL_BASELINE_CAPABILITIES_READY；
    不允许 mock/manual bearer/fake grant 宣称完成）

STORE_UNRELATED_ENTRY_INVARIANT = SEMANTIC_CONTENT_UNCHANGED
  （no entry lost / no entry mutated / malformed store fail-loud / atomic
    replace / correct permissions；不要求 JSON whitespace/序列化字节保留，
    不引入 text-preserving JSON machinery）

ROTATION_IN_V2 = NO
REVOCATION_IN_V2 = NO
GENERALIZED_RECOVERY_IN_V2 = NO
PROVISIONING_DAEMON = NO
ROUTER_PROVISIONING_OWNER = NO
KERNEL_CHANGE = NONE

OWNER_DECISIONS_STILL_REQUIRED = NONE
  （birth seam 具体机制、CLI 形态、temp/lock 实现等均为 §12 实现自由度）

—— 经 Amendment 1 更新后的 standing verdicts ——

CREDENTIAL_PROVISIONING_SIMPLIFICATION = FIX_APPLIED
  （原 FIX_REQUIRED 三项已修：birth 触发入 V2 / grants 去 conditional PASS /
    store 无关 entry 改语义不变；rotation/revocation/generalized recovery
    删除维持接受）

CURRENT_REAL_BLOCKER = formal Agent 存在但 principal / machine client /
  trusted credential entry 缺失 ⇒ Broker capability fail-closed（§1，不变）
MINIMUM_REQUIRED_FLOW = ensureAgentCredential(agentId)：P0 Definition 校验 →
  P1 ensurePrincipal → P2 ensureClient + store write + verification mint；
  birth best-effort 触发 + 显式重跑收敛；baseline grants 移交后续 Spec
EXISTING_SPEC_DISPOSITION = REPLACE_WITH_SMALLER_SPEC（不变；旧 proposal @
  9a408e0 保留为 history/evidence，DO_NOT_MERGE）
KEEP = authority 模型 / 四族身份 + deterministic external_ref / 幂等 ensure
  调用体 / store 写契约（语义保留版）/ secret handoff / credential≠grant /
  verification mint 解释表 / FAIL_LOUD / 非阻塞语义
REMOVE_FROM_V2 = rotation / revocation / generalized recovery / Broker 运行时
  error-classification 改造（§9，不变）+ ensureBaselineGrants 退出 V2 实施闭环
  （Amendment 1，移入后续 grants Spec）
FOLLOW_UP_DEBT = rotation Spec / revocation Spec / generalized recovery /
  baseline grant provisioning Spec（正式幂等 Auth seam；AUTH_SIDE_CHANGE）/
  Broker 运行时三层错误码可区分性
REJECTED_PLATFORMS = RECONCILIATION_PLATFORM / PROVISIONING_DAEMON / IAM_PLATFORM /
  POLICY_ENGINE / ROUTER_CREDENTIAL_MANAGER —— 全部 NO（无当前 production
  evidence 证明其中任何一项是 blocker）

CHAT_BLOCKED_BY_CREDENTIAL_FAILURE = NO
BROKER_FAIL_CLOSED = YES
RETRY_SUPPORTED = YES
MAIN_RESET_REQUIRED_FOR_REPAIR = NO

NEW_SPEC_PATH = docs/specs/AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V2.md
  （本文件原地 Amendment 1；status: proposed；BASE = origin/main @ 67404bc；
    reviewed base HEAD 457f29f）

SPEC_ONLY = YES（IMPLEMENTATION = NONE / PRODUCT_CODE_CHANGE = NONE /
  KERNEL_CHANGE = NONE；commit + push，不 merge）
```
