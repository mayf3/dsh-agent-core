---
spec_id: AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V2
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
scope:
  - agent-core-agent-credential-provisioning
governed_by:
  - AGENT_CORE_PRODUCT_ARCHITECTURE_V1
external_authorities:
  - repository: mayf3/auth-service
    authority_id: AUTH_SERVICE_MACHINE_CREDENTIAL_ROTATION_AUTHORITY_V1
    revision: 72c906726ff3d05d2de3a96cdd8fdd271338173c
    relation: constrained_by
supersedes:
  - AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1
superseded_by: null
owners:
  - repository-maintainers
---

# Agent Core Agent Credential Provisioning V2

SPEC_GOVERNANCE_MODE = AUTHOR
AUTHORITY_ACTION = SUPERSEDE
PLAN_LEVEL = EXEC_PLAN
ASSURANCE_LEVEL = CONTROLLED
DOCS_FIRST_REQUIRED = YES
PARTIAL_SUPERSESSION = NONE
NORMATIVE_TBD = NONE

这是完整 standalone whole-authority successor 候选：保留 V1 全文所承载的既有权限、限制和历史，仅加入已审 CTR-SER-001..012 的单既有 Client、独立 operator State E 实施例外，以及该路径唯一 protected pending credential-store 例外。本文件仍 proposed；V1 原文件及其 accepted 活动权限不变。V2 只能由原 DSH qualified actor 对实际 reviewed commit/final accepted head 作接受，并与 V1 superseded/backlink 和 index 原子合入 main 后生效。本稿没有 accepted_by/accepted_at，也不代表实现、部署或生产放行。

当前范围：ENSURE 仍按 D.7 Phase A fail-loud，PR #17 绑定原值不变；其余 Phase B D/F/G、full A–G 与 fleet 自动恢复仍无新增实现许可。CTR-SER 的六源码路径、12 Contracts/6 Acceptance 仅计单 State E 新增差量，绝不替代原 Phase A、普通 matching-store ROTATE 或其他继承范围。credential 恢复、mint、canary 与真实业务结果分账；实际 caller 未绑定，实例仍 NOT_READY_CALLER_BINDING。

来源与逐句合成 mapping 见 [docs acceptance packet](../reports/AGENT_CREDENTIAL_PROVISIONING_V2_DOCS_ACCEPTANCE_PACKET_20261019.md)。继承正文中的适用范围已逐句适配，不以附件优先规则覆盖相反“当前”规则。

## V1 历史沿革（原文保留，不是 V2 接受记录）

以下从“性质”到 Amendment 8 摘要 A8.4 均为 V1 当时的历史记录。“本轮”“当前”“accepted”和 reviewed head/date 均指原 V1 amendment，不赋予 V2 当前 accepted 身份；原 PR #17 的历史冻结值不变。

> 性质：**Spec（SPEC ONLY — 本轮只收敛冻结，不实现）** · 初版：2026-08-17 ·
> Amendment 1（review FIX round）：2026-08-17，base reviewed HEAD `104555f` ·
> Amendment 2（independent re-review FIX_REQUIRED round，3 factual gaps）：2026-08-18，
> base reviewed HEAD `9a408e0` ·
> Amendment 3（Owner Ruling 修订）：2026-08-18，base HEAD `e6aa7ad`，
> ruling = `AGENT_PRINCIPAL_HUMAN_OWNER_RULING_V1` ·
> Amendment 4（Runtime Fact 修正）：2026-08-18，base reviewed HEAD `b33bb5f` ·
> Amendment 5（Final Cleanup，focused review 3 fixes）：2026-08-19，
> base reviewed HEAD `0e9dc65` ·
> Amendment 6（Clean Bootstrap Phase 分段冻结）：2026-08-20，
> base = accepted Spec（acceptance-finalize 文本 @ `5cfb610`，origin/main）·
> Amendment 6 acceptance finalize：2026-08-20——independent review
> `AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1_AMENDMENT_6_SPEC_REVIEW`
> = PASS（reviewed HEAD `5d12851`，REQUIRED_FIXES = NONE，
> READY_FOR_ACCEPTANCE_FINALIZE = YES），Amendment 6 = accepted ·
> Amendment 7（Incident hardening：rotation seam 排他 + proof/test safety）：
> 2026-09-09，base = origin/main（含已接受的 Amendment 6 @ `d83a2ff`）·
> Owner ruling = goal directive `AGENT_CREDENTIAL_DRIFT_BOOT_HOOK_ROOT_
> CAUSE_V1`（SPEC/AUTHORITY 阶段）；evidence =
> `docs/investigations/AGENT_CREDENTIAL_DRIFT_BOOT_HOOK_ROOT_CAUSE_V1.md`
> （本修订曾以 "Amendment 6" 起草于落后本地树（base `5cfb610`），发现与
> origin/main 已接受的 Amendment 6 编号冲突后重编号为 Amendment 7 并重放到
> main 基线；independent semantic review REVISE → blocker union 8 项一次
> 修复 → delta re-review ACCEPT，2 non-blocker 已落；
> **acceptance-finalize：2026-09-09——goal directive 九问复核 review =
> ACCEPT_READY（九问逐条 NO/proven，零 YES/UNPROVEN；Q4/Q5/Q6 以
> `NEEDS(e)` 诚实门控），directive-alignment union（census 精确谓词
> `updated_at > created_at AND rotated_at IS NULL` + 九问应答账本）+
> governing investigation 文件随 PR #223 入库（@ `d3d1363`）→
> AMENDMENT_7 = accepted**）·
> Amendment 8（CONTROLLED_LOOPBACK_HTTP_PROVISIONING_EXCEPTION，provisioning
> transport 的受控 loopback HTTP 例外）：2026-09-09，base = origin/main（含
> accepted Amendment 7）· Owner ruling = CONTINUE_SAME_GOAL union
> DECISION_2_PROVISIONING_TRANSPORT = **OPTION_B**（2026-09-09 交付），
> 同时裁定 OPTION_A（既有 HTTPS seam）不存在——生产 auth-service 无 TLS 面；
> independent bounded review = PASS（0 SHIP_BLOCKER）→ **AMENDMENT_8 = accepted**
> 仓库：`mayf3/dsh-agent-core`
> 角色：Credential Provisioning Spec Agent
>
> 本 Spec 回答「这次允许改变什么」：为「每个正式 Agent 都有自己的身份 + 最小权限
> Broker credential」建立实施授权。它是 `docs/investigations/test-agent-feishu-product-semantics-v1.md`
> （evidence authority，PASS）结论 `FORUM_CREDENTIAL_FAILURE_LAYER =
> BROKER_GATEWAY_CREDENTIAL_RESOLUTION` 的收敛。调查细节不在本 Spec 复制，仅作为
> evidence source 引用；本 Spec 在 main 源码上重新做了 source-level trace（Part A），
> 所有事实均可在 main 代码与已入库报告核实。
>
> 本轮只修改 `docs/specs/AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1.md`
> （原地 Amendment，**不创建平行 Spec**）。**不修改 Auth / Broker / Router / Runtime
> 代码，不创建 credential，不改 agents.json / credential store，不启动 runtime，
> 不 merge。** Kernel: **KERNEL_CHANGE = NONE**。

---

## Amendment 1 摘要（2026-08-17，基于 reviewed HEAD 104555f）

初版冻结了 authority 模型（Part B）、身份四族映射（Part C）、onboarding 语义
（Part D 旧表）、grant 分离（Part E）与 failure 层归属（Part F）。Review 一致确认
`PROVISIONING_GAP_CONFIRMED = YES`、`FAILURE_LAYER = BROKER_GATEWAY_CREDENTIAL_RESOLUTION`、
**ARCHITECTURE_DIRECTION = KEEP**。本轮 amendment 只做实现前细节冻结，**不重新设计
任何已冻结方向**：

1. **Part A.4（新增）**：外部 auth-service 两个正式幂等 provisioning seams 的
   源码级核实（`POST /api/v1/principals` / `POST /api/v1/clients`），以及 legacy
   `machine-admin client create` 非幂等、不得用于 ensure 重试的确认。
2. **Part C.4（新增）**：deterministic `external_ref` 格式冻结（Implementation
   Agent 不得自行决定 identity mapping）。
3. **Part D（重写）**：`ensureAgentCredential(agentId)` 冻结为确定状态机 A–G，
   含 missing-store recovery（状态 E）与 fail-loud split-brain 语义（状态 F）。
4. **Part G（新增）**：trusted credential store 写契约（validate-preserve-atomic）。
5. **Part H（新增）**：raw secret handoff 路径冻死 + 禁止清单 + 已知反模式记录。
6. **Part I（新增）**：rotation 语义（Auth 现实：旧 secret 立即失效，无 grace）。
7. **Part J（新增）**：revocation fail-closed 顺序。
8. **Part E.4（新增）**：grant mutation surface 诚实记录
   （`EXTERNAL_AUTH_DEPENDENCY` / `AUTH_CHANGE_REQUIRED = EXTERNAL_ONLY`）。
9. **Acceptance Criteria（重写）**：L1 credential 自身 / L2 grant negative /
   L3 forum positive（条件验收）三层。
10. **Broker collateral 明确为 `YES_MINIMAL`**（Part F 不变，Scope 收紧表述）。

```text
ARCHITECTURE_DIRECTION = KEEP
Principal authority = Auth
Client authority   = Auth
Trusted store authority = trusted Deployment / CP uid505
Broker  = reader / authorized transport
Router  = 不负责 credential
Child   = 不持 raw secret
Credential existence != service grant
KERNEL_CHANGE = NONE
```

本轮 amendment 不允许（也未）借机提出：IAM platform、Policy Engine、sidecar、
mTLS、TPM、per-Agent OS user、OpenClaw fallback、Router credential manager。

---

## Amendment 2 摘要（2026-08-18，基于 reviewed HEAD 9a408e0，FIX_REQUIRED）

Independent re-review（VERDICT = FIX_REQUIRED，ARCHITECTURE_DIRECTION = KEEP）发现
3 个 factual gaps，本轮**只修这三个**，不动其余冻结：

1. **Fix 1 — 真实 token issuance 路径**（Part A.4 S5 重写 + Part D.5 重写）：
   补清 `AUTH_CONTRACT_MODE` 的真实分派（v1 → v1/direct.ts；v0 / v1_shadow →
   legacy `issueToken` / token-issuance.ts；deployed = **v0**）。冻结 legacy 路径
   `principalType != agent → 401 invalid_client` 且该检查发生在 secret 验证
   **之前**；**删除** Amendment 1 的无条件推理「401 invalid_client ⇒ secret
   invalid」。补齐 v1 结果解释（含 `400 invalid_target`、
   `503 temporarily_unavailable`）；Implementation Agent 不得自行猜测错误含义。
   > **Amendment 4 取代注记**：本条与下文 S5 的「deployed = v0」为错误事实锚点，
   > 已被运行证据取代——**deployed = v1**（见 Amendment 4 摘要 / S5）。legacy
   > 路径分析保留为 hypothetical / compatibility analysis only，
   > `LEGACY_PATH_IS_CURRENT_DEPLOYMENT = NO`。
2. **Fix 2 — principal profile 与业务 token contract 自洽**（Part C.4 修订）：
   源码核实 audience registry：svc-forum / svc-workflow / adc-v2 仅接受 `agent`，
   svc-okr 接受 `user|agent`，svc-auth 仅接受 `service`。Amendment 1 冻结的
   `principal_type='service'` 与业务 audience **不兼容**（legacy 路径直接 401；
   v1 路径 `audience_profile_not_accepted`）。本轮二选一，**选 A**：
   `principal_type='agent'`，并冻结 `agent_id` / `owner_user_id` 的来源与语义
   （既有产品模型：`agent_id` = agent 身份键；`owner_user_id` = deployment
   bootstrap 输入，引用既有真实 admin 属主用户——生产先例为全部 openclaw agent
   principal 共用的 designated admin owner；**禁止为过 token 检查新建 user**）。
   方案 B（保持 service + registry 前置）记入 Alternatives considered 否决。
   > **Amendment 3 取代注记**：本条中 `owner_user_id` 的 designated-admin-owner
   > 冻结已被 `AGENT_PRINCIPAL_HUMAN_OWNER_RULING_V1` 取代——owner 冻结现为
   > **NULL / ABSENT**，复用 designated admin 与新建 user 同遭禁止；
   > `principal_type='agent'` + `agent_id = agt_*` 维持（见 Amendment 3 摘要与 C.4）。
3. **Fix 3 — Acceptance 可达性**（Part E.4 扩充 + Acceptance Criteria 重写）：
   诚实列出**三项**外部前置：(a) 业务 grant/resource 供给（mode-aware 表述）；
   (b) HTTPS rotation seam 缺失；**(c) 新增**——S1/S2 管理面要求 RS256 svc-auth
   token，而 deployed v0 的 `/oauth/token` 对 svc-auth 签 HS256 ⇒ 在 contract
   mode v1 生效（或等价 mint 路径）之前，ensure 的 Auth 侧步骤**不可经 HTTP 执行**。
   L1/L2/L3 全部改为显式 executability 标注；**删除**「L1 必须现在全绿」；
   外部前置未就绪时实现必须 fail-loud `external_prerequisite_missing`。
   > **Amendment 4 取代注记**：本条的 (c)「等 contract mode v1 生效」论证随
   > deployed=v1 的运行证据而失效——mode blocker 不存在；(c) 已重定义
   > （Amendment 5 现名 `BOOTSTRAP_PROVISIONER_CREDENTIAL_READINESS_NOT_
   > ESTABLISHED`，见 E.4）。

以下冻结**保持不变**：deterministic external_ref（C.4 前缀格式）、幂等
principal/client ensure（S1/S2，禁 legacy create / 禁 expected_* claim）、
no duplicate identities（状态机 FORBIDDEN 项）、trusted-store 写契约 G1–G8、
single-writer、secret 仅 HTTPS body → memory → 0600 store、no argv/env/stdout/log
secret、same-client rotation 语义、revocation fail-closed 顺序、credential ≠
grant、ROUTER_CHANGE = NONE、RUNTIME_CHANGE = NONE、KERNEL_CHANGE = NONE。
（Amendment 2 变更的只有：C.4 的 principal profile 参数、D.5 解释表、E.4 外部
依赖清单、Acceptance 分层可达性。）

---

## Amendment 3 摘要（2026-08-18，Owner Ruling 修订，base e6aa7ad）

**Ruling：`AGENT_PRINCIPAL_HUMAN_OWNER_RULING_V1`**（Owner 决定，效力高于本 Spec
任何既有冻结）：

- Agent Core 的 Agent 是**独立机器身份**；`owner_user_id` **不是** Agent Core 产品
  模型的一部分；Agent 不要求 human owner。
- **不得**为了满足当前 Auth contract 人工绑定 designated admin / fake human
  owner（Amendment 2 的「复用 designated admin owner」冻结随之作废）。
- `owner_user_id` 不决定：Agent ownership / Workspace ownership / Domain
  ownership / Binding / lifecycle authority。
- Target model：`principal_type = agent`、`agent_id = agt_*`、
  **`owner_user_id = NULL / absent`**。
- 若当前 auth-service 不允许 agent principal 缺少 `owner_user_id`：
  `AUTH_AGENT_WITHOUT_HUMAN_OWNER_SUPPORT = NAMED_EXTERNAL_PREREQUISITE`——这是
  Auth contract 需要修正的问题，不得在 Agent Core 用假 owner 绕过。未来 Auth 可
  (A) 允许 agent principal 的 owner optional/null，或 (B) 提供真正无 human owner
  的 machine principal 并允许业务 audience 使用；**具体 Auth 实现方案不在本 Spec
  决定**。

本轮只改 principal profile / external prerequisite / acceptance executability
相关文本；不实现 Auth、不设计 IAM、不改 Broker / Router / Kernel。本轮源码
核实的**owner 支持矩阵**（(d) 的精确范围）：

```text
                       ownerless agent principal（ruling target model）
S1 创建（/api/v1/principals）      支持——ownerUserId ?? null，无强制；DB 列可空
  （idempotent.ts:277-292；schema:109 nullable）；digest=(agent, agt_*) 稳定
Legacy 业务 mint（v0/v1_shadow）    支持——L4 只查 principalType==='agent' &&
  agentId，不查 owner（token-issuance.ts:91）
  [Amendment 4 注：legacy 非当前部署路径，此行为 hypothetical / compatibility
   analysis only，不构成 Acceptance 依据]
V1 业务/任何 mint（v1/direct）     不支持——assertPrincipalProfile 要求 agent
  profile 必须有 ownerUserId，否则 401 invalid_client (agent_profile_invalid)，
  且该检查先于 secret 验证（direct.ts:72-78）⇒ (d) 恰好只挡 v1 路径
  [Amendment 4 注：v1/direct 即当前部署路径——(d) 因此是现实阻塞]
Provisioner 自身（svc-auth，service profile）不受 (d) 影响
```

变更清单：C.4 owner 冻结改 NULL/ABSENT + 删除 designated-admin 复用；E.4 外部
前置增至 (a)-(d)；D.5/状态 G 的 401 归因在 v1 下因 profile 成因不可排除而修正；
Acceptance 可达性按 (a)-(d) 重算；Alternatives / Risks 同步；Final Output 更新。
其余全部冻结（含 Amendment 1/2 的 external_ref、ensure 状态机、store 契约、
secret handoff、rotation/revocation、credential ≠ grant）**不变**。

---

## Amendment 4 摘要（2026-08-18，Runtime Fact 修正，base reviewed HEAD b33bb5f）

运行证据确认 **deployed Auth contract mode = v1**（Amendment 2/3 据静态检查推断
的 deployed=v0 是错误事实锚点——plist 未设置只能证明 plist 未设置）。本轮只做
最终事实修正，不改任何已冻结设计（Owner Ruling、(a)/(b)/(d)、external_ref、
状态机 A–G、store G1–G8、secret handoff、rotation/revocation、401 归因规则全部
不变）；**不实现、不 merge**。

**Fix A — deployed mode 事实锚点（S5/S8/D.5/E.4/Acceptance/Risks/Final Output 同步）**：

```text
DEPLOYED_AUTH_CONTRACT_MODE = v1（非 v0、非 v1_shadow）
证据（OBSERVED_AT = 2026-08-18，运行时）：
  1) server.ts initializeAuthContract(env.AUTH_CONTRACT_MODE) 的 stdout banner
     打印 authContract.mode：观测到 "auth contract: v1 | …"
  2) stderr audit：v1.direct.issued > 34,000；v1.shadow = 0；legacy
     token.issued = 0（当前 issuance 全部走 v1/direct）
  3) JWKS Cache-Control max-age=300（v0 分支为 3600）——观测到 300
  4) launchd plist 未设置 AUTH_CONTRACT_MODE 只证明 plist 未设置；effective
     value 由 .env / runtime 初始化取得，且已被 banner 与 audit 行为证明为 v1
  5) generated runtime-contract 的 production_effective=false 是 bundle freeze
     时的陈旧快照，不再作为当前 production effective mode 的 authority
冻结表述：
  CURRENT_DEPLOYED_ISSUANCE_PATH = v1/direct
  LEGACY_V0_OR_V1_SHADOW_PATH    = hypothetical / compatibility analysis only
  LEGACY_PATH_IS_CURRENT_DEPLOYMENT = NO
```

**Fix B — 外部前置 (c) 重定义**（mode blocker 已不存在）：(c) 由「等 v1 mode 生效」
改为 bootstrap provisioner credential 前置（Amendment 4 定名
`BOOTSTRAP_PROVISIONER_CREDENTIAL_NOT_PROVISIONED`，**Amendment 5 更名并收窄为
`BOOTSTRAP_PROVISIONER_CREDENTIAL_READINESS_NOT_ESTABLISHED`**，详见 E.4）：
provisioner 自身的 service principal + machine client + secret + svc-auth
MachineAccessGrant（scope `auth.identity.provision`）的可用性尚未经 operator
out-of-band 建立并验证。运行证据：
audit 中 `resource=svc-auth` mint = 0；近期 audit 流无 principal/client 创建事件
   （仅有的 4 条创建类事件是 2026-07-23 的孤立测试突发，非经生产 HTTP 管理面）⇒
   **尚无证据表明 S1/S2 曾通过生产 HTTP 管理面执行**——这是 bootstrap
   credential 可用性尚未确立（readiness not established）的证据，不是 mode=v0
   的证据（Amendment 5 收窄：亦不据此声称相关 DB 对象物理不存在）。

**Fix C — executability 按 deployed v1 重算**：L1-core 各链 = NEEDS(c)（(d) 不阻塞
S1 ownerless 创建，只阻塞 v1 token mint/profile validation）；v1 下 secret
validity proof = NEEDS(c)+(d)；**L1-recovery 修正为 NEEDS(c)+(b)+(d)**（post-rotate
verification mint 在 deployed v1 下仍先被 (d) 的 agent_profile_invalid 挡住）；
L2 = NEEDS(c)+(d)；L3 = NEEDS(c)+(a)+(d)。legacy 分支保留为 hypothetical
compatibility analysis，不再作为 Acceptance 路径。

**保持不变**：401 归因规则（PROFILE_401_DOES_NOT_TRIGGER_ROTATION = YES 等）、
Owner Ruling（agent + agt_* + owner NULL/ABSENT）、(a)/(b)/(d) 定义、
FAKE_ADMIN_OWNER_FORBIDDEN = YES、全部第五节冻结项（见 Final Output
UNCHANGED_FROZEN_ITEMS）。svc-forum 已有 RS256/JWKS 验证面，**不是**隐藏前置。
本轮不新增 IAM platform / Policy Engine / auto-grant / sidecar / mTLS /
per-Agent OS user / Router credential manager / Auth 实现方案选择。

---

## Amendment 5 摘要（2026-08-19，Final Cleanup，base reviewed HEAD 0e9dc65）

Focused review 的 3 个 required fixes；不改设计方向、Owner Ruling、状态机、
401 规则，不实现、不 merge：

1. **分支历史清理（repo 侧，不在本文件内）**：Spec 分支曾混入两份针对本 Spec
   的 write-capable one-shot workflow helper（apply/run-agent-credential-
   spec-amendment-4.yml，commit eb1b440 / 59d9a4f）——以 b33bb5f 为 base
   cherry-pick 0e9dc65 的 Spec 单文件 delta 重建 clean history；最终
   `git diff --name-only b33bb5f..HEAD` 精确等于本文件，
   `WORKFLOW_FILES_IN_FINAL_DELTA = 0`。
2. **Part F 措辞修正**：最后一条「deployed legacy 模式」stale 断言改为
   「hypothetical legacy compatibility 模式（非当前部署）」；当前 deployed v1
   的 `scope_denied` 对应 wire 码为 400 invalid_scope，部分非 grant 类配置漂移
   可能表现为 invalid_target。错误分层、责任边界与 Broker collateral 不变。
3. **(c) 事实强度收窄（更名）**：`BOOTSTRAP_PROVISIONER_CREDENTIAL_
   NOT_PROVISIONED` → `BOOTSTRAP_PROVISIONER_CREDENTIAL_READINESS_NOT_
   ESTABLISHED`。现有运行证据只证明「生产 HTTP 使用痕迹不存在 + 完整
   bootstrap bundle 的可用性尚未验证」，**不声称**仅凭 audit 即可证明所有
   out-of-band 对象物理不存在；operator 明确供给并完成可用性验证之前，
   Implementation 必须视 (c) 为未就绪并 fail-loud
   `external_prerequisite_missing(c)`。其余 (c) 约束全部维持（service
   profile、不受 (d) 影响、(a)/(c) 独立、禁绕行清单、无 mode blocker）。
   Executability 不变。

---

## Amendment 6 摘要（2026-08-20，Clean Bootstrap Phase 分段冻结，base accepted Spec @ 5cfb610）

**新证据（NEW_EVIDENCE，owner 交付的 preflight）**：

```text
AGENT_FORUM_WORKFLOW_CREDENTIAL_RECOVERY_PREFLIGHT
OBSERVED_AT = 2026-08-20T06:47+0800
production Agent count = 88
88/88：
  credential store 未配置
  store entry 不存在
  agentcore:v1:principal:<agt_*> 不存在
  agentcore:v1:client:<agt_*> 不存在
BLOCKER_CLASSIFICATION = CLEAN_BOOTSTRAP_CANDIDATE
STATE_F_ENDPOINT_REQUIRED = NO_FOR_CURRENT_88_AGENTS
当前 PR #17 的 State F 实现仍受 READ_ONLY_AUTH_CLIENT_RESOLUTION_SEAM_MISSING
```

结论：当前生产存量 88 个 Agent **全部**是 clean-bootstrap candidate——不存在任何
已存在的 store entry / `agentcore:v1` principal / client 需要 reconciliation。
因此 State D/E/F/G 的 reconciliation 与 State F endpoint 对**当前 88 Agents 均
不需要**；同时 PR #17 的 State F 实现仍被
`READ_ONLY_AUTH_CLIENT_RESOLUTION_SEAM_MISSING`（Auth 侧缺少 read-only client
resolution seam）阻塞。

本轮在**不改变最终 A–G 目标模型**的前提下，冻结分阶段实施：

```text
PHASE_A = CLEAN_BOOTSTRAP_ONLY
PHASE_B = EXISTING_CREDENTIAL_RECONCILIATION
```

- **Phase A（本轮之后唯一实现许可）**：见 D.7.1 冻结的固定顺序——目标 store
  entry **absent** 才（在 (c) 就绪后）走 S1/S2 clean bootstrap；目标 entry
  **exists** 一律 fail-loud `existing_credential_resolution_required`
  （结构化错误，Auth/S1/S2/claim/rotation/store-write 计数全零，D.7.2）。
- **Phase B（无实现许可）**：维持 A–G 目标模型对已有 credential 的
  reconciliation（State D / E / F / G，含状态 E 恢复）；要求 Auth read-only
  resolution seam 就绪，并在 S1/S2 之前、任何 store write 之前 fresh resolve
  `stored.clientId`（D.7.3）。State F endpoint 尚未实现——**不阻塞 Phase A
  merge，也不阻塞当前 clean bootstrap canary**。
- Phase A 的 existing-entry fail-loud 是**分段交付边界**，**不是最终产品状态**
  （任何实现/文档不得把它描述成终态）。

Executability 按 Phase 重算（D.7.4）；PR #17 的授权范围冻结（D.7.5）；不变项
清单逐条维持（D.7.6）。本轮 SPEC ONLY——不实现、不 merge、不改 PR #17 代码；
本 Amendment 经独立 review、accepted 并进入 PR #17 的 implementation base
之前，PR #17 不得以本 Amendment 为依据修改（D.7.5）。

---

## Amendment 7 摘要（2026-09-09，Incident hardening，base origin/main @ d83a2ff）

触发：真实事故 root cause 已机械证明并经 Owner 接受（goal
`AGENT_CREDENTIAL_DRIFT_BOOT_HOOK_ROOT_CAUSE_V1`，evidence =
`docs/investigations/AGENT_CREDENTIAL_DRIFT_BOOT_HOOK_ROOT_CAUSE_V1.md`）。
2026-09-07T12:41:37Z，某 goal 的 P4 proof 脚本（p4-final.sh / p4-rotate.mjs）
以裸 Prisma `machineClient.update({ data: { secretHash } })` 对活跃业务 Agent
（agt_book-deconstructor-agent）的生产 MachineClient 执行缝外轮换：
`SECRET_HASH_CHANGED = YES` / `ROTATED_AT_ADVANCED = NO` /
`CANONICAL_ROTATION_AUDIT = NO` / `CENTRAL_CREDENTIAL_STORE_UPDATED = NO`。
runtime boot 与 agent spawn 均机械排除（`RUNTIME_BOOT_CAUSED_DRIFT = NO` /
`NORMAL_AGENT_SPAWN_CAUSED_DRIFT = NO`；boot 时间吻合纯属巧合）。

本 amendment 只硬化，不重设计：**不建第二套 credential lifecycle authority**，
在既有 Part I rotation 语义之上补齐显式 rotation 契约、机制级排他强制与
proof/test safety，并与 Amendment 6 的 PHASE_A/PHASE_B 分段完全组合。全部为
零代码 docs 修订（本 Spec 单文件）：

1. **Part I（硬化）**：新增 I.1 CREATE/ENSURE/ROTATE 三操作分类与三条
   NO-rotation 不变量；I.2 rotation seam 排他性——机制级要求
   `DIRECT_APP_ROLE_SECRET_UPDATE = IMPOSSIBLE`（仅 rotated_at 同步规则
   **不足以**作为修复），新外部前置 **(e)**；I.3 canonical rotation
   operation contract（ROTATION_OPERATION_ID / PREIMAGE / DB+store 一致 /
   双 verify / receipt）；I.4 bounded rotation transaction（PLAN→APPLY→
   VERIFY→RECEIPT + 部分失败恢复 + 继承 split state 门），把事故修复中已
   验证有效的 bdcred 模式产品化为**唯一支持的 operator rotation seam**；
   I.5 proof/test safety 硬规则
   （`PRODUCTION_PROOF_MAY_ROTATE_ARBITRARY_BUSINESS_AGENT = NO`）。
   **配套注记（与 Amendment 6 组合）**：PHASE_A 的 entry-exists → fail-loud
   行为本就与 I.1 一致；对 PHASE_B 的 State E/G 恢复轮换，自本 amendment 起
   冻结为**独立显式 operator ROTATE**（经 I.3 契约 / I.4 seam），不是 ensure
   的内联组成部分——State E/G 判定树形状不变，变的是 rotation 的执行者与
   契约（见 Part D 的 Amendment 7 注记与 L1-7 重标）。
2. **E.4（新增前置 (e)）**：`SECRET_MUTATION_ENFORCEMENT_SEAM`——secret
   material 列级防直写 + 专用特权 rotation 通道，机制由 auth-service 仓库
   按其自身治理选择（`AUTH_CHANGE_REQUIRED = EXTERNAL_ONLY` 不变）。
3. **Security boundaries（追加两行）**：operator/raw-SQL 直写既有 secret
   material 禁止；production proof 轮换任意业务 Agent 禁止。
4. **Acceptance Criteria（新增 L4 层）**：T1–T12 credential-integrity 验收
   （boot/spawn/ensure 零轮换、直写被拒、canonical rotate 全契约、部分失败
   恢复、幂等重放、p4 形态 fail-before-mutation、fixture proof）。
5. **Runtime/Boot 边界重申（不重设计）**：boot / spawn / broker 对 credential
   只读 + fail-closed 的已证明行为原样冻结；`ensureAgentCredential` 对已存在
   credential 绝不 rotate（PHASE_A fail-loud 与之一致）。
6. **Fleet census 结论接受**：`AFFECTED_PRINCIPAL_COUNT = 1` /
   `BOOK_DECONSTRUCTOR_ISOLATED = YES`（代理 census，incident conclusion）；
   完整 DB metadata census 不是本 amendment 的 drafting/implementation
   blocker，仅在 production preflight 需要时执行一次合并的 bounded
   read-only gate（metadata only，无 secret values）。该 census 的精确
   谓词：`updated_at > created_at AND rotated_at IS NULL`（任一命中行即
   为无 receipt 的缝外 drift 疑似，须以 I.3 receipt 账本反核对账；任何
   执行不得读取 secret bytes/hash 列值）。
7. **Amendment 7 acceptance question ledger（review 逐条作答的冻结基准）**：
   下列九问的 Spec 冻结答案与 enforcement 指针——review 逐条独立作答时，
   任何 `YES / UNPROVEN` 即本 amendment REVISE：

   | # | Question | Frozen answer | Enforced by |
   |---|---|---|---|
   | Q1 | CAN_BOOT_ROTATE_SECRET | **NO** | I.1 / L4-T1 |
   | Q2 | CAN_SPAWN_ROTATE_SECRET | **NO** | I.1 / L4-T2 |
   | Q3 | CAN_ENSURE_ROTATE_SECRET | **NO** | I.1 / L4-T3/T4 |
   | Q4 | CAN_NORMAL_APP_DIRECT_UPDATE_SECRET | **NO** | I.2 `(e)` 列级特权 / L4-T5/T6 |
   | Q5 | CAN_OPERATOR_SCRIPT_DIRECT_UPDATE_SECRET | **NO** | I.2 / L4-T5/T7 |
   | Q6 | CAN_FAKE_ROTATION_BY_UPDATING_HASH_AND_TIMESTAMP | **NO** | I.2 + I.3 receipt 排他 / L4-T7 |
   | Q7 | CAN_PROOF_ROTATE_RANDOM_BUSINESS_AGENT | **NO** | I.5 / L4-T11 |
   | Q8 | CAN_DB_STORE_SPLIT_FAIL_SILENTLY | **NO** | I.4 readback 门 + 继承 split state 门 / L4-T9 |
   | Q9 | CAN_SECRET_CHANGE_EXIST_WITHOUT_ROTATION_RECEIPT | **NO** | I.3 receipt 排他 + I.4 继承门 / L4-T8/T9/T10 |

---

## Amendment 8 摘要（2026-09-09，CONTROLLED_LOOPBACK_HTTP_PROVISIONING_EXCEPTION，base origin/main @ 36697a4）

Owner 裁决（CONTINUE_SAME_GOAL union，DECISION_2 = OPTION_B）：provisioning
management transport 的 "HTTPS only" 安全契约新增一个**极窄受控例外**。本修订
是对父 authority 安全契约的真实变更（非 child 实现内的静默 adapter 降级——
child 中的任何 adapter/降级仍被禁止）。

### A8.1 例外定义（唯一定点）

`createAuthProvisioningClient` 的 origin 校验在既有 HTTPS 要求之外，接受且仅
接受**一个**额外 origin 字符串（逐字节相等，无解析宽松化）：

```text
http://127.0.0.1:4001     # scheme=http · host=literal 127.0.0.1 · port=4001（deployed auth-service 端口）
```

禁止 hostname substitution：`localhost`、任何 DNS 名、`127.0.0.2`、任何其他
端口/主机均不被该例外覆盖（字符串相等校验天然排除）。任何其他非 HTTPS origin
照旧 fail-loud `AUTH_CONFIGURATION_ERROR`。

### A8.2 机械边界条件（全部满足才可用；任一不满足 ⇒ fail-closed）

```text
C1  auth-service 机械验证只监听 loopback（operator context 以 lsof 等机械
    手段验证 :4001 的 LISTEN 地址；若为 0.0.0.0/*/external interface ⇒
    FAIL_CLOSED——当前生产为 *.4001 wildcard，故例外在部署侧 rebind 前保持
    FAIL_CLOSED，activation 属 auth-service 生产包步骤，不在本轮执行）
C2  caller 必须是 accepted trusted control-plane / provisioning operator
    context（root seam operator CLI + root-only 0600 provisioner secret）；
    model child / 任意 Agent 不得持有 provisioner secret
C3  禁止 hostname substitution（A8.1 字符串相等保证）
C4  禁止 redirect（management POST 与 verification mint 的 fetch 一律
    redirect: 'error'）
C5  target 必须 exact pinned origin；caller 不得任意提供 URL（A8.1）
C6  provisioner secret / management token / one-time client secret：
    不进 argv / env / stdout / logs / world-user-readable temp（Part H 不变）
C7  one-time client secret 自 HTTP response body 只进 process memory，
    随即写入 accepted 0600 trusted store（路径不变）
C8  例外仅限同机 provisioning management path；任何非 loopback / remote path
    仍要求 HTTPS（不变）
C9  条件不满足 ⇒ fail-closed（AUTH_CONFIGURATION_ERROR /
    AUTH_TRANSPORT_RESOLUTION_REQUIRED 家族），不自动 fallback
```

### A8.3 最小代码支持与机械测试

- `normalizeOrigin`：在 HTTPS 分支外增加且仅增加 A8.1 的单字符串例外分支；
- management POST 与 verification mint 的 fetch 增加 `redirect: 'error'`（C4）；
- `auth-client.test.js` 新增机械测试：pinned 例外 origin 被接受；
  `http://127.0.0.1:4002` / `http://localhost:4001` / `http://127.0.0.2:4001` /
  其他 http origin 一律拒绝；两类 fetch 的 init 均含 `redirect: 'error'`。

### A8.4 不变项

Part C.4 deterministic external_ref、Part D/D.7 状态机、D.5 mint 解释表、
Part G store 契约、Part H 秘密红线、Phase A fail-loud 全部不变。本修订不建
TLS subsystem、不建 proxy framework、不建 IAM layer；不改 auth-service 部署
（C1 的 rebind 属 auth-service 生产包步骤）。执行者不得在 child spec /
child implementation 中自行覆盖或再解释本边界。

---

## Problem

真人 Feishu Canary 中，Test Agent 调用 `forum_list_threads` 返回 `credential_unavailable`：

```text
forum_list_threads
  → Broker Gateway
  → loadCredentialFor(AGENT_CORE_CREDENTIALS_FILE, agentId)
  → undefined
  → credential_unavailable          （broker/src/gateway.js:147-159，fail-closed）
AUTH_TOKEN_MINT_ATTEMPTED = NO      （失败发生在 /oauth/token 之前）
```

根因是一个 **provisioning gap**：Formal Agent（`agt_*` Agent Definition）已存在，但
对应 Broker credential（auth principal + machine client + trusted-store entry）不存在。
OpenClaw 身份（`stock-agent` principal + `mc_oc_*` clients）存在，但以不同身份键持有，
不在 Agent Core 的 `agt_*` 命名空间下。

本 Spec 冻结 credential provisioning 的 authority 模型、身份映射、deterministic
ensure 状态机、store 写契约、secret handoff、rotation / revocation 语义、grant
分离与 failure semantics，并界定未来 Implementation 的最小 scope。**不建设完整
IAM 平台，不复制 OpenClaw runtime。**

---

## V2 继承规范正文

本节至历史 Acceptance/Final Output 标记前是完整继承的当前规范；仅已明示适配的单 State E operator 例外改变 V1 意义，其余权限与限制保持。

## Part A — 恢复现有 credential architecture（source trace）

### A.1 实际链路（全部 main 源码核实）

```text
DSH per-agent child (502, no credential, no token)
  → parent-RPC 'agent-core/broker'            (agent-router/src/index.js:455-484)
  → Router dispatches with ACTUAL proc.agentId (child 自报身份被忽略/记录)
  → brokerGateway.execute({capabilityId,operation,args}, {agentId})
                                              (broker/src/gateway.js, in-process, 505)
  → loadCredentialFor(credentialsFile, agentId)   (broker/src/credential-store.js:109-113)
  → credential === undefined ⇒ fail-closed credential_unavailable  (gateway.js:156-159)
  → (有 credential 时) requestAccessToken → POST /oauth/token       (broker/src/transport.js:80-124)
  → scoped JWT → pinned downstream (svc-forum 3460 / svc-workflow 8989 / svc-okr 3459)
                                              (broker/src/targets.js)
```

Store 形状（`broker/src/credential-store.js:16`，deployment-owned、0600、505-private、
每次调用重读支持 rotation、损坏 fail-loud）：

```text
{ "version": 1, "credentials": { "<agentId>": { "clientId": "...", "clientSecret": "..." } } }
```

Gateway 只读该 store，**从不注入 child、从不回传模型**；child 侧 Broker 工具是纯
relay（`broker/src/index.js` mode:child），child 无 credential、无 token
（`agent-router/src/process.js:73-89` agentEnv 无任何 credential 注入；V2 验收实测
`CHILD_SECRET_ENV=ABSENT / CHILD_SECRET_FS=ABSENT / A_READ_CREDENTIAL_STORE=DENIED`）。

### A.2 谁创建了什么（Agent Definition vs credential 的两套 authority）

| 面 | Authority / 落点 | 谁写 | 源码证据 |
|---|---|---|---|
| Agent 存在性（id/name/display/default） | `agents.json`（Agent Definition config） | deployment tooling：`adoptAgents` / `writeAgentDefinition` / `createAgentInConfig` / 一次性 `migrate-registry-to-definition.mjs` | `agent-definition/src/config.js:72-184,253-267`；`definition.js:22-26` |
| `agt_*` opaque id 铸造 | `generateAgentId()` = `agt_` + 32 hex | 上述写入路径（deployment/acceptance side） | `agent-definition/src/definition.js:79-92` |
| Auth principal | auth-service（外部，`127.0.0.1:4001`；`machine_principals`） | **无 Agent Core 代码创建** —— 仅 V2 验收人工配对 | `docs/reports/trusted-credential-505-final-acceptance-v2.md` |
| Machine client + secret | auth-service（外部，`machine_clients`） | **无 Agent Core 代码创建** —— 历史 OpenClaw-era 手工注册 | 同上；`docs/investigations/test-agent-feishu-product-semantics-v1.md` §2.3 |
| Trusted-store entry（agentId → clientId/clientSecret） | `AGENT_CORE_CREDENTIALS_FILE`（505 私有，0600） | **无 Agent Core 代码写入** —— 验收/部署手工维护 | `broker/src/credential-store.js`；V2 在 505 zone 手工配对 |
| 业务 grant（scope） | auth-service + downstream scope-guard | auth-service 侧（外部），与本仓库无关 | `capabilities/forum.js`（声明 forum.read/forum.write）；svc-forum scope-guard（外部） |

### A.3 核心回答：为什么创建了 `agt_*` Agent Definition 却没有创建对应 Broker credential？

因为 **Agent 存在性与 Broker credential 是两套完全解耦的 authority，全仓没有任何一条
代码路径在创建 Agent 的同时创建 principal / client / store entry**：

1. Agent Definition config 是 **identity + display only**，且**显式禁止**任何 credential
   字段——`agent-definition/src/config.js:78-84`：*「a persona, workspace, credential
   or runtime field can never sneak in via the writer either」*；`definition.js:26` 明确
   `Principal / credential / grant → Auth`。
2. per-agent home provisioner（`agent-provisioning/src/index.js`）只装 DSH 侧
   settings/credentials(model key)/profile/farm links 与 workspace——**不碰 Broker
   credential**；root 侧 `scripts/production-agent-provision.mjs` 也只 chown home +
   workspace，不写 credential store。
3. production layout（`production-runtime/src/paths.js`）**不含** credential store——
   store 落在 trusted install closure
   （`AGENT_CORE_CREDENTIALS_FILE=/usr/local/libexec/agent-core/config/agent-credentials.json`），
   由 supervision env 注入 compose（`compose.js:154-158`），运行时**只读**。
4. auth-service 是**外部 authority**（本仓库无其源码）；principal/client/grant 的创建
   在本仓库没有对应实现。

⇒ **provisioning gap 是架构性断点，不是某个 bug**：``agt_*`` id 铸造与 credential
supply 之间没有任何 coupling。把 Agent 写进 `agents.json` 从不保证它能调用任何
Broker capability。

### A.4 外部 auth-service 的正式 provisioning seams（Amendment 1 源码核实，2026-08-17）

本轮对当前外部 auth-service 源码（`~/workspace/project/auth-service`）做了重新核实。
以下事实全部为 **source-verified**，是 Part C.4 / Part D 状态机的 seam 依据：

**S1 — 幂等 principal ensure seam（正式、HTTP、幂等）**

```text
POST /api/v1/principals
  → createOrGetPrincipal            (src/lib/oauth/v1/idempotent.ts:107-359;
                                     src/routes/idempotent.ts:48-73)
  → external_ref 幂等：DB-level UNIQUE(machine_principals.external_ref)，
    SELECT→INSERT(P2002)→SELECT 并发安全
  → 响应 {id, principal_type, display_name, status, external_ref, created_at, created}
    201(created=true) / 200(created=false)
  → external_ref 对 Auth 完全 opaque（"Auth does NOT interpret the external_ref"）
  → requestDigest 一致性校验：同 external_ref 携带不同身份 profile → 409
  → 鉴权：v1ManagementAuth —— RS256 token，audience svc-auth，
    scope auth.identity.provision（src/middleware/v1-management-auth.ts）
```

**S2 — 幂等 client ensure seam（正式、HTTP、幂等、secret 一次性）**

```text
POST /api/v1/clients
  → createOrGetClient               (src/lib/oauth/v1/idempotent.ts:373-580;
                                     src/routes/idempotent.ts:77-106)
  → external_ref 幂等（DB UNIQUE(machine_clients.external_ref)）；
    principal 必须存在且 active，否则 404/403
  → clientId = 'mc_' + 24 位随机（auth 侧生成）
  → secret 仅 created=true 时随 HTTPS response body 返回一次
    （routes/idempotent.ts:99-102 "Only return secret on creation (never on reuse/claim)"）
  → 新建 client 固定 allowedResources=[] / allowedScopes=[]——
    "client permissions are managed separately via MachineAccessGrant"
    (idempotent.ts:364-372, 519-527)   ⇒ 见 Part E.4 grant 诚实记录
```

**S3 — legacy 非幂等路径（禁止用于 ensure 重试）**

```text
machine-admin client create → createClient  (src/lib/oauth/service.ts:241-293)
  → 按 agentId 列查 legacy 'agent' principal（assertLegacyAgentPrincipal，
    service.ts:33-44），每次调用 INSERT 全新 client —— 非幂等
  → 且在创建时直接捆绑 resources/scopes（legacy 语义，与 V1 幂等面相反）
⇒ 正常 ensure 路径必须优先使用 S1/S2 幂等 HTTP seam；
  不得用 machine-admin client create 重试创建 client。
```

**S4 — rotation 现实（决定 Part I / 状态 E·G 的外部依赖）**

```text
rotateClientSecret                (src/lib/oauth/service.ts:295-345)
  → 单 secretHash 覆盖：旧 secret 立即失效，无 dual-secret grace
当前暴露面：仅 machine-admin CLI（machine-admin client rotate，
  src/cli/machine-admin.ts:143-152），且 newSecret 以 JSON 打到 stdout
完整 HTTP route surface 枚举（routes/*.ts）：/oauth/token、human OAuth、
  /api/v1/principals、/api/v1/clients、auth/users/roles/service-registrations
  —— 不存在 rotation HTTP seam
```

**S5 — AUTH_CONTRACT_MODE 分派与两条 issuance 路径（Amendment 2 重写；
Amendment 4 修正 deployed 事实锚点）**

Amendment 1 的 S5 只描述了单一校验顺序，并据此推出「401 invalid_client ⇒ secret
invalid」——该推理在 legacy 路径下**不成立**。真实模型（全部源码核实）：

```text
AUTH_CONTRACT_MODE 分派（src/routes/oauth.ts:134-137；src/config/env.ts:13-22）：
  'v1'        → doIssueV1DirectToken   （src/lib/oauth/v1/direct.ts）
  'v0'        → issueToken             （src/lib/oauth/token-issuance.ts，legacy）
  'v1_shadow' → issueToken（返回值来自 legacy）
                + evaluateV1DirectShadow（仅影子比对，不影响响应）
Deployed mode = 'v1'（Amendment 4 运行证据，OBSERVED_AT = 2026-08-18）：
  - stdout banner（server.ts initializeAuthContract 的 authContract.mode）：
    观测到 "auth contract: v1 | …"
  - stderr audit：v1.direct.issued > 34,000；v1.shadow = 0；legacy
    token.issued = 0
  - JWKS Cache-Control max-age=300（v0 分支为 3600）
  - launchd plist 未设置 AUTH_CONTRACT_MODE 只证明 plist 未设置；effective
    value 由 .env / runtime 初始化取得，且已被 banner 与 audit 行为证明为 v1
  - generated runtime-contract 的 production_effective=false 是 bundle freeze
    时的陈旧快照，不得作为当前 production effective mode 的 authority
冻结（Amendment 4）：
  CURRENT_DEPLOYED_ISSUANCE_PATH  = v1/direct
  LEGACY_V0_OR_V1_SHADOW_PATH     = hypothetical / compatibility analysis only
  LEGACY_PATH_IS_CURRENT_DEPLOYMENT = NO
```

**Legacy 路径（v0 / v1_shadow；token-issuance.ts:44-156；冻结顺序——
**hypothetical / compatibility analysis only，非当前部署路径**）：**

```text
L1  client 不存在                         → 401 invalid_client
L2  client.status = revoked               → 401 invalid_client
L3  principal.status = disabled           → 401 invalid_client
L4  principalType !== 'agent' 或无 agentId → 401 invalid_client
    ★ 该检查发生在 secret 验证之前（token-issuance.ts:91-106）
L5  secret 验证失败                       → 401 invalid_client
L6  resource ∉ client.allowedResources    → 400 invalid_grant（audit error:
    invalid_resource）
L7  scope ⊄ client.allowedScopes          → 400 invalid_scope
```

**Legacy 冻结推论（替代 Amendment 1 的错误推理）：**

```text
LEGACY_401_SEMANTICS：
  401 invalid_client ∈ {client 不存在, revoked, principal disabled,
                        principal profile ≠ agent, secret invalid} —— 同码多因，
  无 ensure 上下文时不得单凭 401 归因 secret。
  任何 400（invalid_grant / invalid_scope）⇒ secret 已在 L5 通过验证 ⇒
  credential 层有效（400 只能来自 L6/L7，均晚于 secret 验证）。
Legacy 的 grant 校验面是 client.allowedResources / allowedScopes（非
MachineAccessGrant）——idempotent 新建 client 二者皆空（S2）。
```

**V1 路径（AUTH_CONTRACT_MODE='v1'；v1/direct.ts:81-126 + v1/errors.ts；★当前
部署路径，CURRENT_DEPLOYED_ISSUANCE_PATH = v1/direct）冻结顺序与
错误分类（status 由 STATUS_BY_CODE 决定，禁止实现自行猜测）：**

```text
V1 顺序：
  1) audience 未注册或未开 machine access → 400 invalid_target
     (audience_not_machine_enabled)
  2) client 不存在 / client 或 principal inactive → 401 invalid_client
  3) profile 畸形（agent 缺 agentId/ownerUserId；service 带 agentId）
     → 401 invalid_client (agent_profile_invalid / service_profile_invalid)
  4) secret 验证失败 → 401 invalid_client (credential_invalid)
  5) audience 不接受该 principalType → 400 invalid_target
     (audience_profile_not_accepted) ★ 晚于 secret ⇒ 出现即证明 secret 有效
  6) 无 MachineAccessGrant → 400 invalid_scope (machine_grant_missing)
  7) audience registry 不匹配 → 503 temporarily_unavailable
     (audience_registry_mismatch:*)
  8) grant 状态畸形（version<1 / scopes 空 / 重复 / 未注册）→ 503
     temporarily_unavailable (machine_grant_state_invalid)
  9) 请求 scope ⊄ grant.scopes → 400 invalid_scope (requested_scope_not_granted)

V1_ERROR_CLASSIFICATION（HTTP status 冻结表，v1/errors.ts STATUS_BY_CODE）：
  invalid_client=401 · invalid_grant=400 · invalid_request=400 ·
  invalid_scope=400 · invalid_target=400 · unsupported_grant_type=400 ·
  unsupported_token_type=400 · temporarily_unavailable=503 · server_error=500
V1 冻结推论：任何 400 / 503 ⇒ secret 已通过验证（步骤 5-9 均晚于步骤 4）；
  401 同 legacy 为多因（见 V1 步骤 2-4），仅当 ensure 上下文排除 2/3 后才可
  归因 secret。
```

**S6 — external_ref namespace 惯例**

生产已有 colon-namespace 先例 `openclaw:agent:ceo-agent`（auth 侧 opaque，
见 auth-service `docs/audits/AGENT_IDENTITY_DEPLOYMENT_RECONCILIATION_V1_REPORT.md:61`）。
Part C.4 冻结的 `agentcore:v1:*` 前缀与该惯例同构（system:version:kind:key），
并多出 version 段为未来演化留位。

**S7 — machine audience registry 的 principal profile 契约（Amendment 2，Fix 2 证据）**

```text
来源：generated/minimal-auth-v1/runtime-contract.json（contract bundle 1.2.0，
frozen；经 getV1AudienceDefinitions() 加载，contract.ts:164）：
  svc-workflow | accepted: agent           | scopes: workflow.read/execute/admin
  svc-okr      | accepted: user | agent    | scopes: okr.read/write
  adc-v2       | accepted: agent           | scopes: adc.read/execute
  svc-auth     | accepted: service         | scopes: auth.identity.provision
  svc-forum    | accepted: agent           | scopes: forum.read/write/moderate/admin
（全部 machine_access_enabled=true）
⇒ 业务 audience（svc-forum / svc-workflow / adc-v2；svc-okr 半数）只接受
  'agent' profile；'service' profile 仅 svc-auth（管理面）接受。
```

**S8 — S1/S2 HTTP seam 的调用前提与运行证据（Amendment 2 引入；Amendment 4 重写）**

```text
S1/S2（/api/v1/principals、/api/v1/clients）由 v1ManagementAuth 保护：
RS256 + kid（workflow keyring）+ aud=svc-auth + scope auth.identity.provision
（src/middleware/v1-management-auth.ts；v1/signer.ts:252-292 强制 alg=RS256）。
Amendment 2 曾论证「deployed v0 只能对 svc-auth 签 HS256 ⇒ S1/S2 不可调用，
等 v1 生效」——该 mode blocker 随 deployed=v1 的运行证据（S5）而不存在：
deployed v1 的 /oauth/token 完全可以为 svc-auth audience 铸 RS256 V1 token。
当前真实缺口（Amendment 4 定位、Amendment 5 收窄事实强度后冻结为外部前置 (c)）：
  BOOTSTRAP_PROVISIONER_CREDENTIAL_READINESS_NOT_ESTABLISHED——调用方所需的
  active service principal + active machine client + usable secret + 对
  svc-auth 的 MachineAccessGrant（scope auth.identity.provision）+ trusted
  deployment/operator 侧交付输入这一**完整 bootstrap bundle 的可用性尚未验证**
  （详见 E.4(c)）。
运行证据（OBSERVED_AT = 2026-08-18，audit）：
  - resource=svc-auth mint = 0（无任何 svc-auth 管理面 token 被铸出）
  - 近期 audit 流无 principal.created / principal.resolved / client.created
    （仅有的 4 条创建类事件为 2026-07-23 的孤立测试突发，非经生产 HTTP 管理面）
  ⇒ 尚无证据表明 S1/S2 曾通过生产 HTTP 管理面执行。
  证据强度（Amendment 5 冻结）：以上只证明「生产 HTTP 使用痕迹不存在 + 完整
  bootstrap bundle 可用性尚未验证」；**不声称**仅凭 audit 即可证明 service
  principal / machine client / MachineAccessGrant 等 out-of-band 对象在物理上
  全部不存在。operator 明确供给并完成可用性验证之前，(c) 一律视为未就绪。
auth-service 自身 conformance 测试是进程内直调 service 层，不构成生产 HTTP 面
已被使用的证据。
⇒ (c) 属 operator out-of-band bootstrap，不是本 Spec 可在 repo 内解决的项（E.4）。
```

---

## Part B — Authority model（冻结）

```text
PRINCIPAL_AUTHORITY        = Auth（外部 auth-service）—— deployment-side ensure；
                             Agent Core 运行时永远不创建 principal
CLIENT_CREDENTIAL_AUTHORITY = Auth（外部 auth-service）—— machine client + secret；
                             provisioning tooling 经 auth-service 既有幂等注册面
                             （Part A.4 S1/S2）创建
TRUSTED_STORE_AUTHORITY    = Deployment / Control Plane（505）—— 唯一写入方按
                             Part G 契约把 <agentId> → {clientId, clientSecret}
                             写进 AGENT_CORE_CREDENTIALS_FILE（0600、505-owned）；
                             写入值直接来自 auth-service 签发结果，永不经 env/argv/child
BROKER_RESOLUTION          = gateway 按 ACTUAL proc.agentId 经 loadCredentialFor 读取
                             （每次调用重读，支持 rotation）
CHILD_RAW_SECRET_ACCESS    = NO —— child 进程从不持有 raw secret 或 token
                             （V2 验收实证：env/fs/ws 均 ABSENT、store 读取 DENIED）
```

优先模型（与既有代码一致，最小设计）：

```text
Agent onboarding / provisioning（deployment-side）
  → creates / ensures Auth principal + machine client      （S1/S2 幂等 seam）
  → secret 直接写入 trusted credential store（505）         （AGENT_CORE_CREDENTIALS_FILE，Part G 契约）
  → formal Agent exists ⇒ credential 可在 trusted store 按 agentId resolve
        │
child Agent               → 永远看不见 raw secret
        │
Broker gateway（505）     → loadCredentialFor(agentId) → client_credentials → scoped JWT
```

冻结边界：**不引入新 Auth 系统、不引入 credential→principal 映射表**（auth-service
仍是 client↔principal↔agent_id 绑定的唯一权威）；**不把 secret 交给 child 进程持有**
（维持 trusted gateway 模型，不退回 Process Identity 的 child-held-credential 方案）。

**Provisioner 自身的 bootstrap（诚实记录，非新设计）**：调用 S1/S2 需要一个持有
`auth.identity.provision` scope（audience `svc-auth`）的 provisioning machine
credential。该 credential 属于**deployment bootstrap 输入**（与 supervision env 同类，
operator 一次性配置），不是本 Spec 建设的对象；它按 Part H 同等约束保管（trusted
505 zone、0600、永不经 env/argv 交付给任何 child）。Agent Core 运行时不需要也不持有它。
Amendment 2 补记（S7/S8）：svc-auth audience 仅接受 `service` profile（provisioner
自身的 principal 即为 service 型，与被 provision 的 agent principal 不同族）。
Amendment 4 修正：deployed mode 已为 v1（S5），RS256 svc-auth mint 的 mode 前提
已满足——provisioner credential 的当前真实缺口是其本身尚未经 operator
out-of-band 建立并验证（外部前置 (c) =
BOOTSTRAP_PROVISIONER_CREDENTIAL_READINESS_NOT_ESTABLISHED，E.4/S8）。Amendment 3
补记维持：provisioner 的 service profile 不含 owner
语义，**不受 (d) 影响**。

---

## Part C — Identity consistency（冻结稳定映射）

以下各身份**不必字符串相等**——显式拒绝「字符串复用即正确」的默认假设：

```text
AGENT_IDENTITY_TO_AUTH_IDENTITY =
  agentId（agt_*）      = Agent Definition 键 = credential store 键
                          （agentId 是 Agent Core 侧 loadCredentialFor 的 ONLY lookup 键）
  clientId（mc_*）      = auth-service 上注册的 OAuth machine client
                          （store entry 的 clientId 字段；auth 侧生成 'mc_'+24 随机）
  principal id（UUID）  = auth-service 中该 client 绑定的 principal 实体
  JWT sub / agent_id    = auth-service 签发时决定 claims（绑定在 client↔principal 上）
```

约束：

- **store key 必须等于 Agent Core 的 agentId**——这是 Broker 侧唯一查找点，must be
  exact string equality（`credential-store.js` `store[agentId]`）。
- `agt_*`、`mc_*`、principal UUID、JWT claims 是**四个身份族**；它们之间的关系由
  **provisioning 时刻一次性建立**并固定（client→principal 绑定在 auth-service；
  agentId→client entry 在 trusted store）。任何 run-time 都不做跨族查找或换算。
- 未来验收可校验「同 logical agent」的存在性，但**不要求**四族字符串相等，也**不**在
  JWT 里塞业务角色（遵循 Frozen architecture：Auth = Principal + Client/Secret +
  audience + coarse scopes；业务角色不进入 JWT）。

### C.4 Deterministic external_ref（冻结 — Implementation Agent 不得自行决定 identity mapping）

重新 ensure 时必须能**确定性找回同一身份**。Auth 侧 S1/S2 的幂等键是 `external_ref`
（opaque、DB-UNIQUE），因此冻结如下**纯函数**（从 agentId 可恢复、deterministic、
stable、unique）：

```text
principalExternalRef(agentId) = "agentcore:v1:principal:" + agentId
clientExternalRef(agentId)    = "agentcore:v1:client:" + agentId

示例（canary agt_fb78…）：
  agentcore:v1:principal:agt_fb78…
  agentcore:v1:client:agt_fb78…
```

冻结细则：

1. **格式固定**为上述字面前缀拼接，不引入 agentId 之外的变量（无 display name、
   无时间戳、无随机段）。
2. **recoverable from agentId**：前缀剥离即得 agentId；反之亦然。
3. 与既有生产 namespace 惯例同构（`openclaw:agent:<name>` → `agentcore:v1:<kind>:<agentId>`，
   见 A.4 S6）；`v1` 段为未来 external_ref 格式演化留位（如出现 `v2`，须新 Spec）。
4. **ensure 调用体冻结**（Part D 状态机的唯一入参面；Amendment 2 修订 profile、
   Amendment 3 按 Ruling 修订 owner）：

```text
POST /api/v1/principals body = {
  external_ref: principalExternalRef(agentId),
  principal_type: "agent",              // Amendment 2 冻结，依据见下
  agent_id: agentId,                    // = Agent Core 的 agt_*（见下）
                                         // owner_user_id：不传（absent）——Ruling 冻结，见下
  display_name: <Agent Definition display name 或 agentId>   // 仅 cosmetic，不参与匹配/digest
}
POST /api/v1/clients body = {
  external_ref: clientExternalRef(agentId),
  principal_id: <S1 返回的 principal id>
}
```

   - **`principal_type` 冻结为 `"agent"`（Amendment 2 Fix 2，替代 Amendment 1 的
     `"service"`）**。依据：S7 registry——业务 audience（svc-forum / svc-workflow /
     adc-v2）只接受 `agent`；legacy 路径 L4 对非 agent profile 直接 401（S5）。
     `service` profile 在两条路径下都**无法铸造业务 token**，会使 canary 的
     forum 目标整体依赖 auth registry 变更（更大的 IAM 面改动，违背最小选择）。
     方案 B（保持 service + registry 前置）记入 Alternatives considered 否决。
     Ruling target model 确认 `principal_type = agent`。
   - **`agent_id` 的来源与语义（冻结）**：取值 = Agent Core Agent Definition 的
     `agt_*` 本身。auth 侧 `machine_principals.agent_id` 列（`@unique`，
     prisma schema:108）语义为「该 machine principal 代表的 agent 身份键」——
     既有用法存 openclaw 业务名（`stock-agent` 等，onboard 脚本先例），
     `agt_` 前缀天然构成独立 namespace，无碰撞。它同时满足 legacy L4 的
     「agent 类型必须非空 agentId」。
   - **`owner_user_id` 冻结为 NULL / absent（Amendment 3，依据
     `AGENT_PRINCIPAL_HUMAN_OWNER_RULING_V1`，替代 Amendment 2 的
     designated-admin-owner 冻结）**：

```text
AGENT_IDENTITY_REQUIRES_HUMAN_OWNER = NO
OWNER_USER_ID = NULL / ABSENT        （ensure 调用体不携带该字段）
FAKE_ADMIN_OWNER_FORBIDDEN  = YES    （新建 user 与「复用 designated admin
                                      绑定为 Agent owner」均禁止）
owner_user_id 不决定：Agent ownership / Workspace ownership / Domain
ownership / Binding / lifecycle authority（Agent Core 产品模型中该概念不存在）
```

     源码核实（Amendment 3 支持矩阵）：S1 创建**允许** ownerless agent principal
     （`ownerUserId ?? null`，无强制；DB 列 nullable；digest=(agent, agt_*) 稳定）；
     legacy 业务 mint **不查 owner**（L4）；**v1 路径 `assertPrincipalProfile`
     要求 agent 必须有 ownerUserId，否则 401 `agent_profile_invalid`（先于
     secret 验证）**⇒ `AUTH_AGENT_WITHOUT_HUMAN_OWNER_SUPPORT =
     NAMED_EXTERNAL_PREREQUISITE`（外部前置 (d)，E.4；Auth 侧解法 A/B 由 Auth
     决定，不在本 Spec）。
   - **digest 稳定性**：requestDigest = `("agent", agentId)`（owner 恒缺省，
     computePrincipalDigest 对缺失段不参与），两个输入全部冻结 ⇒ repeated
     ensure 永不 digest 409。
   - 正常 ensure **不传** `expected_principal_id` / `expected_client_id`（S1/S2 的
     claim 路径是 operator 对既有手工行的恢复工具，不在冻结 ensure 流内）。
   - **`agt_*` / `mc_*` / principal UUID 字符串不相等是正常的**（Part C）；deterministic
     找回靠 external_ref，不靠字符串相等。

---

## Part D — `ensureAgentCredential(agentId)` 冻结状态机（Amendment 1 重写）

V1 **不建设完整 IAM 平台**。`ensureAgentCredential(agentId)` 是 deployment-side
tooling（与 `production-agent-provision.mjs` root seam 同类），幂等、确定性、
**每次运行重读 trusted store**（与 runtime 的 per-call re-read 语义一致）。它按下列
**固定顺序**执行；状态由幂等 seam 的**响应**判定（created 标志 / status 字段），
不做任何自选的预检查顺序。

> **Amendment 6 注记**：以下 STEP 0–2 / 状态 A–G 是**最终目标模型**（target
> semantics，含 Phase B）。实施交付按 **D.7** 冻结的分段顺序执行：Agent
> Definition 读取（状态 A）→ store 文档完整读取与校验 → 目标 entry 判定；
> entry **absent** 才进入（(c) 就绪后的）S1/S2 clean bootstrap（Phase A）；
> entry **exists** 的 D/E/F/G 分类与处置属于 Phase B，ENSURE 仍按 D.7 冻结且无该 Phase B 实施许可。
> 仅 CTR-SER-001..012 的单既有 Client State E 独立 operator 路径是本 V2 新增例外；它不进入 ENSURE。
> 其余 D.7 顺序与行为约束保持，优先于本节 STEP 排列表述。
>
> **Amendment 7 注记（rotation 执行者冻结；与 Amendment 6 组合）**：
> `ensureAgentCredential` **绝不 rotate**。PHASE_A 的 entry-exists →
> fail-loud `existing_credential_resolution_required`（D.7.1/D.7.2）与之一致；
> 对 PHASE_B 的 State E（store entry 缺失而 Auth client 存在）与 State G
> （secret 失效）恢复，其 secret mutation 自 Amendment 7 起冻结为**独立的
> 显式 operator ROTATE**——经 Part I.3 契约与 I.4 seam 执行（前置 (e)
> 未就绪时 fail-loud 降级），**不是 ensure 调用的内联组成部分**。State E/G
> 的判定条件与「SAME clientId、禁建第二 client」约束不变；L1-7 的验收据此
> 重标（见 Acceptance Criteria）。

```text
ensureAgentCredential(agentId):

STEP 0（状态 A 前置）  读 Agent Definition（agents.json）。
  A. agentId 不在 Agent Definition 中
     → STRUCTURED_REJECT { code: 'agent_not_found', agentId }
     → 不调用任何 Auth seam；绝不创建 orphan Auth identity（无 principal / client / store entry）
     → 终止。

STEP 1  POST /api/v1/principals（S1，body 见 C.4）
  B. created=true（principal 不存在 → 已创建）
  或 created=false（principal 已被确定性找回 —— 同一 external_ref ⇒ 同一 principal UUID）
     → 两者对后续步骤无差别（幂等面的意义正在于此）。
     → principal.status ≠ 'active' ⇒ FAIL-LOUD { code:'auth_principal_not_active' }
       （归入状态 F 家族：split-brain / 外部状态冲突，绝不静默重建第二个 principal）。

STEP 2  POST /api/v1/clients（S2，body 见 C.4）
  C. created=true（client 不存在 → 已创建）
     → secret 从 HTTPS response body 直接进入 provisioning 进程内存（Part H）
     → 按 Part G 契约写 store entry：credentials[agentId] = { clientId, clientSecret }
     → verification mint（Part D.5）→ 成功即完成。
  D. created=false 且 status='active' 且 store entry 存在且 store.clientId === 响应 client_id
     且 verification mint 证明 secret 有效（200，或任一「secret 已验证」类 400 ——
     见 D.5 mode-aware 解释表）
     → NO-OP（幂等成功）：不 rotate、不重写 store、不缓存 token。
  E. created=false 且 status='active' 且 store entry 缺失
     —— 关键恢复路径。raw secret 在 Auth 侧不可读回（仅存 secretHash；
        secret 只在 created=true 时返回一次，S2）。
     → 必须恢复 SAME principal / SAME client：
       1) rotate 该 existing client 的 secret（SAME clientId，禁建新 client；
          rotation seam 见 Part I —— 当前为外部依赖，Part E.4(b)）
       2) 新 secret 经 HTTPS response body 进入进程内存（Part H）
       3) atomic store write 恢复 entry（Part G）
       4) verification mint
     → FORBIDDEN：创建第二个 client；创建第二个 principal；改用 legacy
       machine-admin client create 重建。
  F. store entry 存在，但 Auth 侧 client missing / revoked / 或 store.clientId ≠
     ensure 所得 client_id（split-brain：本地 entry 指向 Auth 不再承认的身份）
     → FAIL-LOUD { code:'auth_client_missing_or_revoked', detail: 仅含 agentId 与
       store.clientId（不含 secret，Part H）}
     → 冻结的 recovery action（operator 显式执行；tooling 只报告、绝不自动执行）：
        a) de-provision：按 Part G 移除 store entry（该 agent 本地即刻 fail-closed），
           之后重新 ensure 会经 B/C 创建全新身份——旧 client 已 missing/revoked，
           不构成平行身份；或
        b) Auth 侧 out-of-band 处置后（revoked 不可逆则只能 a）重跑 ensure。
     → 不静默创建平行身份。
  G. store entry 存在且与 ensure 所得 client 一致，但 verification mint 返回
     401 invalid_client（在 ensure 上下文排除其余 401 成因后归因 secret 失效，
     见 D.5 —— 401 本身是多因码，不得无条件读作 secret invalid）。
     Amendment 3 约束：Ruling profile（ownerless agent）在 v1 路径下必然触发
     401 agent_profile_invalid（先于 secret，direct.ts:72-78），该成因在 (d)
     就绪前**不可排除** ⇒ v1 路径（★当前部署路径）上 (d) 就绪前 401 一律记为
     (d) 证据 / INCONCLUSIVE，**不得进入状态 G**（不得 rotate）；legacy 路径
     （L4 不查 owner）profile 成因不存在 ⇒ 状态 G 理论可达——但 legacy 为
     hypothetical / compatibility analysis only，非当前部署（Amendment 4），
     不构成对 (d) 的绕行。
     → rotate SAME client（同 E 的 rotation seam）→ 新 secret 进内存 →
       atomic rewrite store（Part G）→ 再次 verification mint。
     → FORBIDDEN：创建第二个 client。
```

### D.5 Verification mint（Amendment 2 重写 — mode-aware 冻结解释表；
Amendment 4 更新 current/hypothetical 标识）

ensure 的 validity 检查 = 一次 `POST /oauth/token`（grant_type=client_credentials，
resource/scope 取自已部署 capability manifests 的任一 HTTP 组合；secret 从 trusted
store 读入进程内存构造 Basic header，Part H）。解释表**按 AUTH_CONTRACT_MODE
分派**（S5；**当前部署 = v1**），**Implementation Agent 不得自行猜测错误含义**：

**Legacy 模式（v0 / v1_shadow；hypothetical / compatibility analysis only，
非当前部署路径——LEGACY_PATH_IS_CURRENT_DEPLOYMENT = NO）：**

```text
HTTP 200 + access_token      → credential 有效（且 resource/scope 均在
                               client.allowedResources/allowedScopes 内）
HTTP 400 invalid_grant       → secret 已通过 L5 验证 ⇒ credential 层有效；
  （resource 不在 allowed    grant/resource 缺失（L6，audit error invalid_resource）
   Resources）                 ——credential 层 PASS；grant 缺口按 Part E 记录
HTTP 400 invalid_scope       → 同上（L7；secret 已验证，scope 缺失）
HTTP 401 invalid_client      → 多因码（L1-L5：client 不存在/revoked/principal
                               disabled/profile ≠ agent/secret 错）。**仅在 ensure
                               上下文内**——ensure 前序步骤已确认 client+principal
                               active 且 profile 按 C.4 冻结为 agent+agt_*（排除
                               L1-L4）——才可归因 secret 失效 → 状态 G。
                               无该上下文（如 Broker runtime 观察）不得如此归因。
网络不可达 / 5xx / malformed  → INCONCLUSIVE：结构化报错退出；不得当作 invalid
                               触发 rotate，也不得当作 valid 记 NO-OP
```

**V1 模式（AUTH_CONTRACT_MODE='v1'；★当前部署路径）：**

```text
HTTP 200 + access_token      → credential 有效
HTTP 400 invalid_target      → 分两种：(i) audience 未注册/未开 machine（步骤 1，
                               在 secret 验证之前——若请求的是已部署 manifest 的
                               合法 audience 则不会发生，发生即工具配置错误）；
                               (ii) audience_profile_not_accepted（步骤 5，在
                               secret 验证之后 ⇒ secret 有效；对 C.4 冻结的
                               agent profile + 业务 audience 不应发生，发生即
                               profile/audience 配置漂移，fail-loud 报告）
HTTP 400 invalid_scope       → secret 已验证（步骤 4 之后）；machine_grant_missing
                               或 requested_scope_not_granted —— credential 层
                               PASS；grant 缺口按 Part E 记录
HTTP 503 temporarily_        → secret 已验证（步骤 4 之后）；auth 侧
     unavailable               audience_registry_mismatch / machine_grant_state_
                               invalid —— credential 层对 secret 不下结论（服务端
                               状态问题），按 INCONCLUSIVE-ish 处理：不 rotate、
                               不记 NO-OP，结构化报告
HTTP 401 invalid_client      → 多因码（client/principal inactive、profile 畸形、
                               secret 错）。ensure 上下文排除前两类后归因 secret
                               失效 → 状态 G
                               ★ Amendment 3：Ruling profile（ownerless agent）
                               在 v1 下**必然**落入本码（agent_profile_invalid，
                               步骤 3，先于 secret）——(d) 就绪前该成因不可排除，
                               401 一律记 (d) 证据 / INCONCLUSIVE，不得触发状态
                               G，不得归因 secret（Amendment 3 支持矩阵）
网络不可达 / 其他 5xx         → INCONCLUSIVE（同上）
```

**共同冻结**：401 永远不得在**无 ensure 上下文**时解读为「secret invalid」
（Amendment 1 的无条件推理已删除，见 S5 LEGACY_401_SEMANTICS）；「secret 有效」
的最小充分证据在两种模式下都是**任一晚于 secret 验证的 400**（legacy：
invalid_grant/invalid_scope；v1：invalid_scope 与步骤 5 的 invalid_target）或 200。
**Amendment 3 补充**：v1 路径 + Ruling profile 下，verification mint 在 (d)
就绪前确定性地止步于步骤 3（agent_profile_invalid 401，先于 secret）——secret
有效性在 v1 路径上**不可证明**（(d) 就绪前无从绕过；legacy 路径的宽容仅为
hypothetical compatibility analysis，非当前部署，不构成绕行依据——Amendment 4）；
该 401 是
外部前置 (d) 的直接证据，不是 credential 失效。

### D.6 Agent 删除 / disable（既有 seam，引用不变）

从 Agent Definition config 移除（先 `disable`）是既有 seam；store entry 移除与
Auth revoke 按 Part J 的 fail-closed 顺序执行。是否保留 Auth principal/client 由
运营商决定（独立于 Agent Core）。

### D.7 分阶段实施冻结（Amendment 6 — Clean Bootstrap Phase）

对 ENSURE 分段实施的 Phase A / Phase B 权威定义。**A–G 目标模型（上文）不变**；ENSURE 的顺序、边界、可达性与授权保持。
本 V2 仅另许可 CTR-SER-001..012 的单既有 Client State E 独立 operator，不能据此解冻其余 Phase B。

**D.7.1 Phase A clean bootstrap 固定顺序（冻结）**

```text
PHASE_A_CLEAN_BOOTSTRAP_ORDER =
  1. read Agent Definition
  2. State A agent_not_found
  3. read and fully validate credential-store document
  4. inspect target agent store entry
  5. only when target entry is absent:
       check prerequisite (c)
       call S1
       call S2
       write returned secret
       verification mint
  6. when target entry exists:
       do not call S1
       do not call S2
       do not rotate
       do not claim
       do not write store
       fail-loud as existing-credential reconciliation unavailable
```

顺序不变量（冻结）：

```text
STORE_READ_AND_FULL_VALIDATION = BEFORE_ANY_AUTH_IDENTITY_MUTATION
CLEAN_BOOTSTRAP_REQUIRES_STORE_ENTRY = ABSENT
S1_S2_WHEN_STORE_ENTRY_ABSENT = ALLOWED_AFTER(c)
S1_S2_WHEN_STORE_ENTRY_EXISTS = FORBIDDEN
AUTH_WRITES_BEFORE_STORE_CLASSIFICATION = 0
```

- store 文档读取与**完整**校验（Part G 同语义：version===1、entry 可 normalize；
  malformed → `CREDENTIALS_STORE_ERROR` 同族 fail-loud，文件不变）发生在**任何
  Auth 身份变更之前**；store 分类完成之前 Auth 写调用的合法数量 = **0**。
- (c) 检查在步骤 5 内部先于 S1/S2；(c) 未就绪 ⇒
  `external_prerequisite_missing(c)`，Auth 调用 = 0（验收 PA1）。

**D.7.2 已有 store entry 的 Phase A 行为（冻结）**

当目标 Agent 已有 store entry 时：

```text
RESULT = existing_credential_resolution_required
         （或同一稳定结构化错误族——错误结构必须稳定、可测，不得随实现轮漂移）
AUTH_CALLS = 0      S1_CALLS = 0      S2_CALLS = 0
CLAIM_CALLS = 0     ROTATION_CALLS = 0
STORE_WRITES = 0
```

Phase A **不得尝试判断**以下任何分类（全部属于 Phase B）：

```text
client missing · revoked · mismatched · secret invalid ·
State D / State E / State F / State G
```

**D.7.3 Phase B（目标模型维持；ENSURE 与其余 Phase B 无实现许可，仅 CTR-SER 单 State E operator 例外）**

```text
PHASE_B_EXISTING_CREDENTIAL_RECONCILIATION =
  requires Auth read-only resolution seam
  requires fresh resolve of stored.clientId
  before S1/S2
  before any store write
```

Phase B 继续覆盖（目标语义 = Part D 状态机原文，不变）：

- State D — existing matching credential
- State E — store missing / Auth client exists（恢复路径维持 Part I 语义）
- State F — split-brain
- State G — secret recovery

State F endpoint 尚未实现（`READ_ONLY_AUTH_CLIENT_RESOLUTION_SEAM_MISSING`）：
**不阻塞 Phase A merge，也不阻塞当前 clean bootstrap canary**。
不得把 Phase A 的 fail-loud 描述成最终产品状态——它只是分段交付边界。

**D.7.4 Executability 重算（冻结）**

```text
PHASE_A_UNIT_ACCEPTANCE = IMPLEMENTABLE_NOW_IN_REPO
PHASE_A_REAL_CLEAN_BOOTSTRAP = NEEDS(c)+(d)
PHASE_A_FORUM_POSITIVE = NEEDS(c)+(d)+(a)
PHASE_A_WORKFLOW_POSITIVE = NEEDS(c)+(d)+(a)
PHASE_B_EXISTING_STORE_RECONCILIATION = BLOCKED_BY_AUTH_READ_ONLY_RESOLUTION
L1_RECOVERY_STATE_E = NEEDS(c)+(b)+(d)（(b) rotation seam 仍缺失；维持既有结论）
FULL_L1_L2_L3_COMPLETE = NO（不得声称完整 L1/L2/L3 已全部完成）
```

（`NEEDS(x)` 语义同 Acceptance Criteria 图例：外部前置 E.4 (a)/(b)/(c)/(d) 未就绪
时对应路径必须 fail-loud `external_prerequisite_missing`。）

**D.7.5 PR #17 授权绑定（冻结）**

```text
PR_17_CURRENT_ALLOWED_SCOPE = PHASE_A_CLEAN_BOOTSTRAP_FOUNDATION
PR_17_MUST_NOT_CLAIM = FULL_A_TO_G_IMPLEMENTATION
PR_17_EXISTING_STORE_PATH = FAIL_LOUD_ZERO_AUTH_CALLS
PR_17_STATE_F_IMPLEMENTATION = DEFER_TO_PHASE_B
```

本 Amendment 通过独立 review、accepted 并进入 PR #17 的 implementation base
后，PR #17 才能按该 Phase A 范围修改并重新审查；在此之前 PR #17 不得以本
Amendment 为依据改动。

V2 当前规则：上述 PR #17 历史绑定和值原样保持。新增实施许可只属于 CTR-SER-001..012 的独立 operator 六路径闭包，不扩 PR #17，不授权 ENSURE 的 Phase B，也不代表运行或生产放行。

**D.7.6 继承不变项（其余保持；仅 CTR-SER-001..012 的 State E operator 及其 Part G/H pending 例外）**

deterministic external_ref（C.4）· `principal_type = agent` · `agent_id = agt_*` ·
`owner_user_id` absent / no fake owner（Owner Ruling）· trusted store G1–G8 ·
secret handoff（Part H）· no duplicate identities · credential ≠ grant（Part E）·
Profile 401 no rotation（D.5 / 401_ATTRIBUTION_RULES）· Broker collateral =
`YES_MINIMAL` · `ROUTER_CHANGE = NONE` / `RUNTIME_CHANGE = NONE` /
`KERNEL_CHANGE = NONE` · prerequisites (a)/(b)/(c)/(d) 的现有含义（E.4）。
**不得增加 OpenClaw credential fallback。**

---

## Part E — Grants（credential ≠ grant，必须分离）

```text
CREDENTIAL_EXISTENCE   = trusted store 存在 <agentId> → {clientId, clientSecret}
SERVICE_GRANT          = auth-service 侧该 client 被授予的 scope
                         （forum.read / forum.write / workflow.* …）
```

冻结：

1. **credential provisioning ≠ 自动授予每一个 capability。** provisioning 只保证
   「有身份、能 mint token」；授予哪些 scopes 是 auth-service / 业务侧决策。
2. Agent 有 credential 但**没有** `forum.read` grant 时，调用必须得到**授权失败**
   （如 `scope_denied` / `access_denied` / `invalid_scope`），**绝不**再得到
   `credential_unavailable`。两个 failure mode 必须可区分（Part F；verification mint
   的 400 invalid_scope 即为最小可区分证据，D.5）。
3. 现网已有先例（`agent-definition/src/access.js`）：LOCAL capability
   `agent.definition.write` 需要 `agent.definition.write` scope——gateway 经
   auth-service 取 token，失败返回 `access_denied`（`gateway.js:163-186`）。HTTP
   capability 的同类分离由 Part F 冻结。

### E.4 Grant mutation surface 诚实记录（Amendment 1 引入，Amendment 2 修订为 mode-aware）

- V1 幂等 client 创建（S2）固定 `allowedResources=[] / allowedScopes=[]`——
  **新建 client 不自动拥有 `forum.read` / `forum.write` / … 任何 grant**。
- 业务权限的载体**随 AUTH_CONTRACT_MODE 分派**（S5）：
  - **v1（★当前部署路径）**：载体为 `MachineAccessGrant`（`(machineClientId,
    audienceId)` 主键 + `scopes[]`，`prisma/schema.prisma:272-284`；direct.ts
    步骤 6-9 校验）。idempotent 新建 client 无任何 grant（S2）。
  - **legacy（v0 / v1_shadow；hypothetical / compatibility analysis only，
    非当前部署——Amendment 4）**：mint 校验 `client.allowedResources` /
    `client.allowedScopes`（token-issuance.ts:122-156）。idempotent 新建 client
    二者皆空；`machine-admin client create` 仅在**创建时**设置（S3），无任何
    对 existing client 的 resources/scopes 更新面。
- **现状（两种模式同判）**：不存在对 existing client 的正式 grant mutation
  HTTP/CLI seam——仅若干一次性脚本直连 DB 操作（如 auth-service
  `scripts/provision-domain-owner-machine-clients.ts:445-469`）。即：

```text
formal existing-client grant mutation seam = 当前缺失 / 不完整
```

- 本 Spec **禁止**因此顺手建设：Auth grant platform、auto-grant、Policy Engine。
  grant 配置是 **named external prerequisite**（外部运营商/外部工具动作）。

```text
AGENT_CORE_AUTH_CODE_CHANGE = NONE
EXTERNAL_AUTH_DEPENDENCY =
  (a) 业务 grant 供给前置：被 provision 的 Agent client 获得 svc-forum /
      svc-workflow 等业务权限所需的 grant mutation/supply seam——当前部署
      （v1）= 对 existing client 的 MachineAccessGrant 正式 mutation seam
      缺失（仅一次性脚本直连 DB）；hypothetical legacy 面 =
      allowedResources/allowedScopes 更新面缺失。（L3 Forum 正向验收的前置）
  (b) machine-client secret 的 HTTPS rotation seam currently missing
      （rotation 仅 machine-admin CLI 且 newSecret 走 stdout——与 Part H 冲突；
       状态 E / G 恢复路径与 Part I 依赖该 seam）
  (c) BOOTSTRAP_PROVISIONER_CREDENTIAL_READINESS_NOT_ESTABLISHED（Amendment 4
      重定义、Amendment 5 更名并收窄事实强度；原「等 contract mode v1 生效」
      论证随 deployed=v1 失效——mode blocker 不存在）。冻结含义：现有运行证据
      （S8）证明**生产 HTTP 管理面使用痕迹不存在**，且**尚未验证以下完整
      bootstrap bundle 当前可用**：active service principal（provisioner 专属、
      独立）+ active machine client + usable client secret + svc-auth audience
      的 MachineAccessGrant（scope = auth.identity.provision）+ trusted
      deployment/operator-side 交付输入。本 Spec **不声称**仅凭 audit 就能证明
      这些 out-of-band 对象在物理上全部不存在；但在 operator 明确供给并完成
      可用性验证之前，Implementation 必须把 (c) 视为**未就绪**并 fail-loud
      `external_prerequisite_missing(c)`。约束：该 credential 只属于 trusted
      deployment/operator zone；Agent Core child 与普通 Agent 永远不持有它；
      provisioner profile 为 service，不受 ownerless-agent 前置 (d) 影响；
      当前无正式 MachineAccessGrant mutation seam ⇒ 初始 bootstrap 须
      operator out-of-band 建立；不得通过直连 DB、CLI stdout、child env、
      argv 或 Agent workspace 绕过。
  (d) AUTH_AGENT_WITHOUT_HUMAN_OWNER_SUPPORT（Amendment 3，依据
      AGENT_PRINCIPAL_HUMAN_OWNER_RULING_V1）：Ruling target model =
      principal_type 'agent' + agent_id agt_* + owner_user_id NULL/ABSENT。
      源码核实支持矩阵——S1 创建 ownerless agent **已允许**；**v1 路径
      （★当前部署）assertPrincipalProfile 要求 agent 必须有 ownerUserId
      （401 agent_profile_invalid，先于 secret）** ⇒ (d) 是现实阻塞。解法
      由 Auth 决定（Ruling 选项 A：owner optional/null；选项 B：真正无 human
      owner 的 machine principal 且业务 audience 可用）——**本 Spec 不决定 Auth
      实现方案，Agent Core 不得用 designated admin / fake owner 绕过**。
      Provisioner 自身（svc-auth / service profile）不受 (d) 影响。
  (e) SECRET_MUTATION_ENFORCEMENT_SEAM（Amendment 7，依据 goal
      AGENT_CREDENTIAL_DRIFT_BOOT_HOOK_ROOT_CAUSE_V1 ruling）：机制级保证
      `DIRECT_APP_ROLE_SECRET_UPDATE = IMPOSSIBLE` 与
      `SECRET_HASH_CHANGE_WITHOUT_ROTATION_AUDIT = IMPOSSIBLE`（Part I.2）——
      普通 application/operator DB identity 对 machine_clients 的
      secret_hash / rotated_at 列无直接 UPDATE 特权，secret material 只能经
      专用特权 rotation 通道（原子产生 hash 替换 + rotated_at 前移 + rotation
      audit）。机制方案由 auth-service 仓库按其自身治理选择与落地（列级权限
      分离 + 特权 rotation 函数为参考实现，不强制实现形式）；本 Spec 只冻结
      可机械验证的性质。就绪前：I.4 operator rotation seam 不得宣称排他性，
      其余 fail-loud 降级行为不变。与 (b) 的区分：(b) = in-process ensure/
      recovery 所需的 HTTPS rotation 面；(e) = DB/工具层的 secret mutation
      强制与 operator 特权通道。二者独立计数，互不替代。**（Amendment 7
      组合边界）**：recovery rotation 既已改为经 I.4 operator seam（APPLY 走
      I.2 特权通道，secret 走 memory/fd/受保护配置），该路径的排他性只门控于
      **(e)**（verify 段另需 (c)/(d)，见 L4-T8/T12）；(b) 仅在/一旦使用
      in-process HTTPS rotation seam 时才成为该 seam 的前置——不得对 (b) 与
      (e) 重复计数。
(a) 与 (c) 的区分（禁止重复计数）：二者可能都使用 MachineAccessGrant 机制，
    但主体、audience、scope、生命周期不同——(a) 的主体是**被 provision 的
    Agent client**（业务 audience svc-forum/svc-workflow…，业务 scope），(c) 的
    主体是 **provisioner 自身的管理面 service credential**（audience svc-auth，
    scope auth.identity.provision）。它们是独立 prerequisites。
AUTH_CHANGE_REQUIRED = EXTERNAL_ONLY
  —— 以上是外部依赖声明，不代表本 Spec 自动授权去改 auth-service；
     Agent Core 仓库/spec 不携带任何 auth-service 代码修改。
在 (a)/(b)/(c)/(d)/(e) 任一未就绪时，依赖它的实现路径必须 fail-loud
`external_prerequisite_missing`（结构化错误，指明 (a)/(b)/(c)/(d)/(e)），不得降级、
不得绕行（禁 legacy create / CLI stdout / **绕开受控 (e)/I.2 通道的直连 DB
裸读写** / **绑定 admin 或 fake
human owner**）。当前部署 v1 下 (d) 未就绪时观察到的 401 agent_profile_invalid
按 (d) 证据归类（D.5 Amendment 3 补充），不触发状态 G。
```

---

## Part F — Failure semantics（责任层冻结）

未来实现至少能区分下列 failure mode；**不一定本次新增全部错误码，但责任层必须明确**：

```text
failure mode       责任层                                  现网 manifestation
────────────────────────────────────────────────────────────────────────────
principal_missing  Auth（外部）                             token mint 时 client 无
                                                           principal 绑定
credential_missing Broker gateway（505）/ trusted store     credential_unavailable
                                                           （现值，Part A）
credential_invalid Auth（外部）—— client_credentials 拒绝    /oauth/token 401
                                                           invalid_client
token_mint_failed  Auth（外部）—— endpoint 不可达/5xx/       transport_failure
                   malformed                                 （现值，transport.js:429-434）
scope_denied       Auth（外部）—— 请求的 scope 不在 grant    transport_failure（现被折叠；
                   内 / 400 invalid_scope                   须能区分出授权语义）
service_denied     downstream service（svc-forum 等）        http_4xx 403/401（scope-guard）
```

冻结的**层归属**（不得跨层归因）：

- **credential 存在性** → 只能由 Broker gateway 的 store lookup 回答（505）。
- **能否 mint** → 只能由 auth-service token endpoint 回答（外部）。
- **能否执行业务** → 只能由 downstream service 的授权回答（外部）。

实现要求（预期 collateral，见 Scope）：容器化 gateway/transport 的 error-classification
时，`credential_missing` 与授权拒绝（`scope_denied`）必须落在互不相同的错误码，
不得用一个泛化 `transport_failure` 同时掩盖两类语义。

> Amendment 2 模式注记（S5/D.5；Amendment 5 修订措辞）：`credential_invalid` 行的
> 「/oauth/token 401 invalid_client」是**多因码**（legacy 下含 profile/状态类成因，
> 且 profile 检查先于 secret 验证）；`scope_denied` 行在 **hypothetical legacy
> compatibility 模式（非当前部署）**下的对应 wire 码含 400 invalid_grant
> （resource 缺失）/ 400 invalid_scope（grant 面为 client.allowedResources/
> allowedScopes）；**当前 deployed v1 模式为 400 invalid_scope**（grant 面为
> MachineAccessGrant），部分非 grant 类配置漂移可能表现为 invalid_target。
> 运行时（非 ensure 上下文）对 401 的一律归类为 `credential_invalid` family 而
> 不下钻归因 secret。

---

## Part G — Trusted credential store 写契约（Amendment 1 冻结）

本 V2 仅对 CTR-SER-001..012 单 State E 路径增加 CTR-SER-005 的同 trusted 目录 protected pending credential-store 原语；下列 G.1..G.8 及既有 trusted CP/owner 资格不被降低，普通 writer 语义不变。

TRUSTED_STORE_AUTHORITY（Part B）的唯一写入契约。**红线：provision Agent A 绝不能
把 Agent B/C 的 credential entry 覆盖掉。**

```text
G.1 目标文件 = AGENT_CORE_CREDENTIALS_FILE（绝对路径，broker 侧同一文件；
    所在目录为 505-private trusted 目录，目录本身不得 group/world 可读）。
G.2 写前读：读现有 store 文档（若存在）。
G.3 校验：按 loadCredentialsStore 同等语义做完整 V1 校验——version===1、
    credentials 为 object、每个 entry 均可 normalize（clientId/clientSecret 非空字符串）。
    malformed / 版本不识别 / 任一 entry 损坏
      → FAIL LOUD（CREDENTIALS_STORE_ERROR 同族结构化错误）
      → MUST NOT overwrite；MUST NOT "顺手修复"。
G.4 保留：所有与目标 agentId 无关的 entry 原样保留（clientId/clientSecret 值
    逐项不变）。
G.5 变更：仅目标 agentId 的 entry（写入 {clientId, clientSecret}，或 revocation 时
    删除）；顶层 shape 恒为 { version: 1, credentials: {...} }。
G.6 写入：在 store 同目录创建 private temp file（同 filesystem ⇒ rename 原子性有保证）；
    temp file 创建时即 mode 0600（O_CREAT|O_EXCL），且必须先有 0600 再写入任何
    secret 内容；owner = trusted CP（进程以 505 运行，或 root 运行后 chown 为
    authsvc:authsvc）。
G.7 提交：fsync(temp) → rename(temp, store)（原子替换）→（SHOULD）fsync(store 目录)。
G.8 并发：deployment-side 单写者 / 串行化（同 trusted 目录内 0600 lock 文件，或
    operator 串行执行）。不建设 distributed lock；Agent Core 运行时保持只读。
```

明令禁止：in-place 部分写；跨 filesystem rename；temp 落 `/tmp`；group/world-readable
temp 或 store；以「修复」名义覆写 malformed store。

---

## Part H — Secret handoff 冻死（Amendment 1）

普通 provisioning / rotation 的 raw secret 路径保持：

```text
auth-service HTTPS response body
  → trusted provisioning process memory（立即消费，不落任何中间态）
  → credential store writer（Part G）
  → uid505-owned 0600 store 文件
```

本 V2 仅为 CTR-SER-001..012 的单 State E 独立 operator 增加已审路径：可信 operator 进程内一次生成 → CTR-SER-005 同 trusted 目录唯一 protected pending credential-store → CTR-SER-008 同 filesystem 原子交付最终 primary。秘密仍只在可信 memory、该 pending 和最终 primary；不把 ordinary journal、备份或公开 artifact 当作合法载体。

普通路径除最终 store 文件外，raw secret **无任何持久化副本**。仅 CTR-SER-005 的唯一 protected pending credential-store 是本 V2 窄例外，终态清理依 CTR-SER-012；不得产生第二副本。其余禁止清单保持（任何形态，包括
debug/diagnostic/audit 路径）：

```text
argv                          —— 禁止
env                           —— 禁止
stdout / stderr               —— 禁止（含结构化 JSON 输出）
log（任何级别、任何 sink）      —— 禁止（错误 detail / audit 行只允许 agentId 与
                                clientId；clientId 非 secret）
shell substitution            —— 禁止
curl -u client:secret         —— 禁止（Basic header 只允许在进程内由代码构造）
child process 传递             —— 禁止（含 spawn 参数、pipe 到子进程）
Agent workspace               —— 禁止
agents.json                   —— 禁止（config.js:78-84 已显式拒绝 credential 字段）
DSH prompt                    —— 禁止
Feishu / 任何 IM              —— 禁止
OpenClaw credentialRefs       —— 禁止
```

**验证 token 时**（ensure 的 verification mint / acceptance）：从 trusted store 读入
进程内存 → in-process 构造 Basic header → POST /oauth/token。**不把 secret 拼 argv。**

已知反模式（存在于现状，**不得复制**；本契约即为其替代）：

- auth CLI `machine-admin client rotate` 把 newSecret JSON 打到 stdout
  （auth-service `src/cli/machine-admin.ts:143-152`）。
- 仓库验收脚本曾把 secret 拼进 grep argv
  （`scripts/trusted-credential-broker-v1-verify.mjs:394`）。
- V2 验收期形状侦察脚本曾打印 secret 前 40 字符前缀
  （`docs/reports/trusted-credential-505-final-acceptance-v2.md` 运维注记）。

同一 uid 攻击面约束沿用 `same-uid-router-secret-boundary-audit-v1` 硬前提（E1/E2
实证同 uid 经 `ps -E` / `ps -o command=` 全量可读 env/argv）：credential 永不经
env/argv 交付；store 及交付文件 505-owned 0600；Router/工具可执行代码面不得 502 可写。

---

## Part I — Rotation 语义（Amendment 1；Amendment 7 硬化）

当前 Auth rotation 事实（源码核实，A.4 S4）：

```text
rotate → 旧 secret 立即失效（单 secretHash 覆盖）→ 无 dual-secret grace
```

既有普通 rotation 冻结流程（State E/G 目标语义保持；本 V2 单 State E 仅依 CTR-SER-001..012 使用同一 canonical Auth seam 及明确的 pending/ABSENT 例外，不进入 ENSURE）：

```text
rotate existing client（SAME clientId —— 由 deterministic ensure/external_ref 找回）
  → 新 secret 经 HTTPS response body 进入进程内存（Part H）
  → atomic RMW store（Part G 契约）
  → verification mint（D.5 解释表）
```

- **接受**：rotate 与 store 更新之间存在很短 failure window——窗口内该 agent 的
  Broker 调用以旧 secret mint → 401 invalid_client → 归入 Part F 的
  `credential_invalid` 语义；store per-call re-read ⇒ 更新后下一调用即恢复，无重启。
- V1 **不建设**：zero-downtime rotation、dual-secret system、rotation orchestration
  service。
- **可以** operator-serialized / maintenance-aware（低峰执行、单写者串行，Part G.8）。
- 外部依赖：HTTPS rotation seam 当前缺失（Part E.4(b)）；在其就绪前，状态 E/G 的
  恢复路径与运维 rotation 只能停留在「外部 prerequisite 未满足」的 fail-loud 报告，
  **不得**退回 CLI-stdout 方式取 secret。
- **（Amendment 7，组合 Amendment 6 分段冻结）**任何需要 secret mutation 的
  恢复/运维轮换是一次 **ROTATE**（I.3 契约、I.4 seam），由 operator 显式执行，
  **不是 ensure 的内联副作用**（Part D Amendment 7 注记；PHASE_A fail-loud
  与之一致）；前置（(e)；in-process 面另计 (b)）未就绪时维持 fail-loud 降级。

### I.1 CREATE / ENSURE / ROTATE 三操作分类（Amendment 7 冻结）

credential lifecycle 只有三种合法操作，任何实现/脚本/runbook 必须能把自己的
行为归入其一；无法归类的 credential 变更即违约：

```text
CREATE   credential 不存在 → 创建一次（新 clientId、新行；secret 只随创建交付一次）
ENSURE   credential 已存在 → NOOP / 返回既有 metadata（不重写 store、不改 secret、
         不建重复行；Phase A 实现对「store 有条目」与「Auth client 存在而无
         store 条目」均为更强 fail-loud existing_credential_resolution_required）
ROTATE   唯一允许修改既有 secret material 的操作 → 必须显式授权（I.2/I.3），
         必须留下 rotation lineage / receipt（I.3）
```

由此冻结三条 NO-rotation 不变量（与已证明的生产行为一致，本轮仅显式化）：

```text
NORMAL_BOOT_ROTATES_CREDENTIAL      = NO
NORMAL_SPAWN_ROTATES_CREDENTIAL     = NO
ENSURE_EXISTING_ROTATES_CREDENTIAL  = NO
SECRET_CHANGE_REQUIRES_EXPLICIT_ROTATION = YES
```

> 归因注记（Amendment 7）：2026-09-07 事故的写手不属于以上任何一类——它是绕过
> lifecycle 的裸写。I.2 的机制级排他就是把「第四类」变为不可能，而不是仅靠
> 本分类的约定力。

### I.2 Rotation seam 排他性与机制级强制（Amendment 7 冻结）

- **仅有「secret_hash 变化 ⇒ rotated_at 必须同步变化」规则不足以作为修复**：
  它只挡住本次事故的具体裸写形态；另一支 raw SQL / Prisma 脚本完全可以同时写
  `secret_hash + rotated_at`，继续绕过 canonical authorization、audit、中央
  store 与 receipt。因此排他性必须落在**机制层**，不落在提醒层。
- 冻结要求（存储层可机械验证）：

```text
DIRECT_APP_ROLE_SECRET_UPDATE = IMPOSSIBLE
    普通 production application / operator 的 DB identity 不得能直接 UPDATE
    既有 MachineClient 的 secret material（secret_hash / rotated_at 列）。
SECRET_HASH_CHANGE_WITHOUT_ROTATION_AUDIT = IMPOSSIBLE
    secret material 的任何变更必须经由唯一 rotation seam 发生，该 seam 原子地
    同时产生 rotated_at 前移与 rotation audit/receipt（I.3）。
```

- **参考机制（auth-service 仓库按其自身治理落地，本 Spec 不携带 Auth 代码）**：
  列级权限分离——应用/operator 角色对 `machine_clients` 的 `secret_hash`/
  `rotated_at` 列无 UPDATE 特权；secret material 只能经由一个专用特权
  rotation 函数/过程变更（函数体原子完成 hash 替换 + rotated_at 前移 +
  rotation audit 行写入），并以 BEFORE UPDATE trigger（hash 变而 rotated_at
  未前移 → EXCEPTION）作为纵深防御。**不为本实现形式强制 stored procedure**；
  任何机械等价方案均可，**但判据是同时满足上述两条冻结性质**
  （`DIRECT_APP_ROLE_SECRET_UPDATE = IMPOSSIBLE` **且**
  `SECRET_HASH_CHANGE_WITHOUT_ROTATION_AUDIT = IMPOSSIBLE`）——只挡住直写
  却允许某角色无审计地同写 hash+rotated_at 的方案不构成等价。
  该机制就绪与否 = 外部前置 **(e)**（E.4）。
- **(e) 未就绪时**：I.4 的 operator rotation seam 不得上线宣称排他性；既有
  fail-loud 降级行为不变；不得以「操作员纪律」替代机制强制。

### I.3 Canonical rotation operation contract（Amendment 7 冻结）

一次合法 rotation 是一个**明确的、可收据化的 operation**：

```text
ROTATION_OPERATION_ID = stable / receipted（重放同一 operation id ⇒ 幂等确定性
                        结果，不产生第二次 secret 变更）
AUTHORIZATION         = PASS（显式 rotation authority，非 ensure/proof 副作用）
TARGET_CLIENT         = exact（精确到唯一 clientId；禁止按 agentId 模糊匹配多行）
PREIMAGE_GENERATION   = MATCH（执行时回读 live hash 指纹 == 冻结 preimage；
                        不匹配 = 零变更中止）
DB_SECRET_HASH        = new
ROTATED_AT            = advanced
UPDATED_AT            = advanced
ROTATION_AUDIT        = written
CENTRAL_CREDENTIAL_STORE = contains matching new credential generation
                           （与 DB 同一 generation，I.4 bounded transaction 保证）
MINT_VERIFY           = PASS（完整验证终态；CTR-SER-011 凭据交付阶段可独立记 NOT_RUN）
REAL_AUTH_CALL_VERIFY = PASS（真实业务调用链验证，非仅 token 端点；CTR-SER-011 的凭据恢复不以此为零效果门，canary 另入场并如实记 NOT_RUN/UNKNOWN）
RECEIPT               = written（含 operation id、preimage/postimage 指纹、
                        双 verify 结果、时间锚；不含 secret bytes）
```

secret bytes 边界沿用 Part H 冻结清单并扩展到 rotation 语境：secret 只允许存在于
trusted rotation process memory 与 protected credential store；**不得进入** chat、
logs、Git、receipt、model-visible text（普通 receipt 只记指纹/长度/generation 标识；本 V2 单 State E public receipt 更受 CTR-SER-004/007 限制，不输出敏感 commitments/raw verifier）。

### I.4 Bounded rotation transaction（Amendment 7 冻结）

DB 与本机 credential store 不是同一事务域，不假设天然 ACID。每次 rotation 必须
是四段 bounded transaction：

```text
PLAN   → 冻结 target（exact clientId）、preimage（live hash 指纹）、
         new generation；生成 ROTATION_OPERATION_ID
APPLY  → 经 I.2 seam 变更 DB（hash+rotated_at+updated_at+audit 原子）；
         store 按 Part G validate-preserve-atomic 换装（普通 rotation 保留 preimage 备份；
         本 V2 单 State E 按 CTR-SER-005/006/008 冻结原 ABSENT 与完整 store，
         以唯一 protected pending 前推，不造旧 secret/额外秘密备份）
VERIFY → post-hash/readback（store 读回 == DB generation）+ MINT_VERIFY +
         REAL_AUTH_CALL_VERIFY
RECEIPT→ 写 I.3 receipt（含失败路径收据）
```

- **部分失败必须可检测且可恢复**：`ROTATION_PARTIAL_FAILURE =
  DETECTABLE_AND_RECOVERABLE`。普通 rotation 的冻结 preimage 与合法 rollback/recovery path 保持：
  DB 已轮换而 store install 失败不得留下长期 split state；按 preimage 回滚 DB 或补交付并记 receipt。
  本 V2 单 State E 仅依 CTR-SER-008..010：正常 crash 只以同 op durable pending 前推；
  仅原活进程仍有真实冻结旧 verifier 且全部 known-failure 条件成立才可一次 canonical compensation。
  crash 丢失旧 verifier、结果 UNKNOWN、可能交付/使用或第三方 generation 变化均不能自动 rollback；
  保留原 op/fence/material，不生成第二 secret 或换 op。
- **继承 split state 门（crash-window 覆盖，Amendment 7）**：普通 rotation 每次 seam 接触
  （PLAN 起始及任何 store 写前）仍先 readback 比对 store/DB generation；mismatch 或无 receipt 更新
  均 fail-loud 拒绝继续 mutate，直至合法显式 reconciliation。不得只在单次 VERIFY 检测。
  本 V2 仅对 CTR-SER-001..012 准入的单 State E 使用明确的 store-entry ABSENT CAS、
  冻结完整 store/DB preimage、同 target retained claims 和原 op receipt/pending 分类（CTR-SER-004..009），
  不伪称缺失 entry 已有 matching generation，不旁路普通 split-state 门；其余 mismatch/UNKNOWN 均保留 fence。
  只读 classification 零效果，显式原 op continuation 与 mint/canary 分开；不得重放 UNKNOWN。
- **不引入 distributed transaction framework**。把 2026-09-08 事故修复中已
  验证有效的 bdcred 模式——preimage 冻结、store 原子换装备份、post-hash
  readback、mint + 真实调用双验证、rollback receipt——**产品化**为唯一支持的
  operator rotation seam（Scope-3 的「最小 helper」即指此物）；ad-hoc 直写
  脚本形态（p4-rotate 式）不再是被允许的替代路径。
- **产品化合规修正（Part H 红线）**：bdcred 原型的 mint 步骤用
  `curl -u client:secret` 把 secret 暴露在进程 argv（`ps` 可见）——产品化
  helper **必须**消除该暴露（secret 经内存/fd/受保护配置交付给 HTTP 客户端，
  禁止 argv/env/stdout/stderr/log），否则不得作为 I.4 seam 上线。原型的其余
  步骤（store 0600 原子换装、指纹化日志、`--noproxy`）为已验证可保留形态。

### I.5 Proof / test safety（Amendment 7 冻结）

事故的第二根因：proof 脚本把真实业务 Agent 当作可破坏的 "unused agent"。

```text
PRODUCTION_PROOF_MAY_ROTATE_ARBITRARY_BUSINESS_AGENT = NO
```

- 需要 credential mutation 的 proof/test **必须**使用 dedicated fixture
  principal / MachineClient 或专门 disposable canary identity。
- **禁止**以下列任一推断为由宣称生产 credential 可破坏：「看起来没人用」、
  「名字像测试」、「当前没有 session/流量」。
- 确需对真实业务 credential 做破坏性 rotation：必须满足 explicit production
  authority、exact target、preimage、rollback、store synchronization、
  post-verify 全套（I.3/I.4），**不得**作为普通 proof 的隐藏副作用。
- 既有违规面处置：p4-final.sh 的破坏性 rotation 段必须在 implementation 阶段
  **删除或改写为 fixture-only + fail-closed guard**，使其不能再次对任意
  production business client 运行（L4-T11 验收）。

---

## Part J — Revocation 语义（Amendment 1）

冻结 **fail-closed 顺序**（顺序本身即安全属性）：

```text
1) remove target store entry（Part G 契约）
   → 本地 Broker 对该 agent 立即 credential_unavailable（无需重启；store 重读）
2) revoke Auth client（外部动作；auth-service revokeClient 为幂等）
```

- 若步骤 (2) 失败：**本地 Agent 仍然 fail-closed**（步骤 (1) 已生效）；记录 pending
  external action；**绝不**把 store entry 恢复回去。
- 不建设 revocation orchestration framework。
- Agent Definition `disable`/remove 是正交的既有 seam（D.6）；三方（Definition /
  store / Auth client）各自独立失效，store-entry 移除永远先行。

---

## Security boundaries（明确禁止）

```text
Forum moderator secret                       —— 禁止
shared system bearer token                   —— 禁止
secret 写入 Agent workspace                  —— 禁止
secret 出现在 DSH prompt                     —— 禁止
hardcoded credential                         —— 禁止
OpenClaw credential fallback                 —— 禁止
human Feishu credential 复用为 Agent credential —— 禁止
Kernel credential store                      —— 禁止（KERNEL_CHANGE = NONE）
secret 经 env / argv / stdout / log / child  —— 禁止（Part H 冻结清单）
operator/raw-SQL/裸 ORM 直写既有 secret material（secret_hash / rotated_at）
                                             —— 禁止（Amendment 7，Part I.2）
production proof 轮换任意业务 Agent 的生产 credential
                                             —— 禁止（Amendment 7，Part I.5）
```

child Agent **尽量不能读取 raw Broker credential**（冻结目标：与 V2 验收一致的
`CHILD_SECRET_ENV=ABSENT / CHILD_SECRET_FS=ABSENT / A_READ_CREDENTIAL_STORE=DENIED`）。
同一 uid 攻击面约束沿用 `same-uid-router-secret-boundary-audit-v1` 硬前提：
credential 永不经 env/argv 交付、store 505-owned 0600、不允许 child 写 Router 代码面。

---

## Explicit non-goals（V1 不做）

```text
不处理：Binding workspace / Session cwd / Feishu requireMention / reaction/typing /
cards / Scheduler / Forum feature design / Auth redesign / mTLS / TPM / sidecar /
Policy Engine / Kernel
```

- 不做完整 IAM 平台（role/group/permission 管理、admin UI、审计平台）。
- 不做 IAM platform / Policy Engine / sidecar / mTLS / TPM / per-Agent OS user /
  OpenClaw fallback / Router credential manager（Amendment 1 重申）。
- 不在 JWT 里塞业务角色（Domain Owner、Forum role 等保持外部业务系统治理）。
- 不把 Broker 升级成新 Policy Engine——Broker 维持 authorized transport / capability
  seam（Part F 的 error-classification 除外，`BROKER_CHANGE_REQUIRED = YES_MINIMAL`）。
- 不复制 OpenClaw runtime architecture（其 per-peer workspace / per-agent
  auth-profiles 模型只作参考，不移植）。

## Scope（未来 Implementation 允许做什么）

允许（优先最小实现，deployment/ops 面 + 最小 broker collateral）：

1. **Provisioning tooling（deployment-side）**：实现 Part D 冻结状态机的
   `ensureAgentCredential(agentId)`（A–G + D.5 verification mint），经 S1/S2 幂等
   seam，按 Part G 契约写 store，按 Part H 交付 secret；含 backfill 模式（canary
   第一优先场景）与幂等断言。外部 prerequisite（E.4 (a)/(b)/(c)/(d)）未就绪时，依赖
   它的分支必须 fail-loud 报 `external_prerequisite_missing` 类结构化错误，不得降级。
2. **最小 Broker error-classification**（Part F，`BROKER_CHANGE_REQUIRED = YES_MINIMAL`）：
   只允许把失败分为三层——credential unavailable / invalid client；authorization
   invalid_scope / invalid_resource；downstream transport/service failure。附带
   transport/gateway 测试。**禁止** Broker 创建 credential / auto-grant / IAM
   orchestration / Policy Engine。
3. **Rotation / revocation runbook 或最小 helper**（Part I / Part J 语义；store 更新
   走 Part G，secret 走 Part H）。（Amendment 7：rotation helper 按 I.4
   产品化为唯一支持的 operator rotation seam，遵守 I.3 契约；其排他性宣称
   NEEDS(e)。proof/test 面按 I.5 与 L4-T11/T12 收敛。）
   本 V2 单既有 Client State E 的新增实现权限仅由 CTR-SER-001..012 限定；不得扩成整个 Phase B。
4. **Acceptance driver 的扩展面**：为未来 canary 提供可复现的验收路径（Acceptance
   Criteria 分层）。

> **V2 当前实施范围（继承 Amendment 6 分段）**：ENSURE 的实现许可仍仅 **Phase A clean bootstrap foundation**
> （D.7.1/D.7.2 与 D.7.5 的 PR #17 原绑定）；其余已有 credential reconciliation
> （State D/F/G、full A–G、fleet 自动恢复）仍属 Phase B、无新增实施许可。
> 唯一新增许可是 CTR-SER-001..012 的单既有 Client State E 独立 operator 六路径闭包，
> 不进入 ENSURE、不扩 PR #17；最终 A–G 目标模型与普通 matching-store ROTATE 范围保持。

**本 Spec 本轮不实施以上任何一项**——它只冻结范围，供后续 Implementation（在
`status: accepted` 之后）执行。

## Non-goals / Frozen boundaries（实现时不得越过）

```text
RUNTIME_CHANGE = NONE
ROUTER_CHANGE = NONE        （Router 已按 ACTUAL proc.agentId 分发，身份决策不变；
                              Router 不负责 credential）
AUTH_CHANGE    = NO_IN_REPO （auth-service 是本仓库外 authority；本 Spec 不授权改它；
                              外部依赖见 Part E.4 EXTERNAL_AUTH_DEPENDENCY，
                              AUTH_CHANGE_REQUIRED = EXTERNAL_ONLY）
KERNEL_CHANGE  = NONE
```

- 不引入 child-held-credential；不把 secret 注入 child env/workspace。
- 不新增一卡通映射表 / 新 Auth / 新 principal registry（auth-service 仍是唯一权威）。
- 不自动授予 capability；grant 决策留在 auth-service / 业务侧。
- 不改 Binding / Session / workspace 模型（`AGENT_CORE_BINDING_WORKSPACE_V1` 若被
  accepted，与本 Spec 正交）。
- Implementation Agent **不得自行决定 identity mapping**（Part C.4 已冻结）。

## Alternatives considered

- **child-held credential（Process Identity 方案 B 早期形态）**：否决——`identity-auth.md`
  已论证单进程 + 动态插件下 A 可伪造 B；V2 已冻结 trusted-gateway（505）模型并验收
  PASS。本 Spec 保持 gateway 模型，**不回退**。
- **人力逐条手工配 store entry 作为长期机制**：否决——canary 的
  `credential_unavailable` 正由此产生；V1 需要确定性 provisioning。
- **把 credential 塞进 agents.json（Agent Definition）**：否决——config 显式禁止
  credential 字段（`config.js:78-84`），且该文件不能被 502 child 相关路径持有 secret
  语义；解耦是 frozen architecture。
- **在 Router 运行时自动创建 principal/client（self-provisioning at spawn）**：否决——
  运行时创建需要持有 auth-service 管理员权限，与「child 不可见 secret / 505 只读
  store」冲突；provisioning 必须是 deployment-side。
- **OpenClaw credential 直接 fallback 给 Agent Core agent**：否决——身份键族不同
  （`stock-agent` vs `agt_*`），且违反最小权限与命名空间隔离。
- **一卡通字符串复用（agt_* == clientId == principal id）**：否决——四族身份不要求
  相等（Part C）；强行相等会把 auth-service 的键设计绑死在 Agent Core 内部形状上。
- **（Amendment 1）用 legacy `machine-admin client create` 兜底 ensure/重试**：否决——
  非幂等（每次 INSERT 新 client，A.4 S3），会产生重复 client 与 grant 捆绑的 legacy
  语义；正常 ensure 必须走 S1/S2。
- **（Amendment 1）用 machine-admin CLI stdout 捕获的方式获取 rotate 后的 secret**：
  否决——违反 Part H（child process + stdout 双禁止）；等待正式 rotation seam
  （E.4(b)）。
- **（Amendment 1）store 写入用「重建整个文件」以外的任何部分写 / 跨目录 temp**：
  否决——Part G 冻结 validate-preserve-atomic 契约。
- **（Amendment 2，Fix 2）方案 B：保持 `principal_type='service'` + 等 audience
  registry 支持 service**：否决——源码核实（S7）业务 audience（svc-forum/
  svc-workflow/adc-v2）现契约只接受 `agent`，svc-okr 接受 user|agent；legacy 路径
  对非 agent profile 直接 401（S5 L4）。选 B 意味着 `BUSINESS_AUDIENCE_ACCEPTS_
  SERVICE_PRINCIPAL` 成为 named external prerequisite，且在其完成前 business token
  mint = NOT IMPLEMENTABLE——把 canary 主目标整体押在 auth registry 变更上，属
  更大的 IAM 面改动；方案 A（agent profile）以最小 auth 侧变更满足现契约。
  （Amendment 3 注：方案 A 的 owner 部分 per Ruling 改为 NULL/ABSENT——「零
  auth 侧变更」不再成立于 v1 路径，差额即外部前置 (d)；principal_type='agent'
  维持。）
- **（Amendment 2，Fix 2；Amendment 3 扩围）为过 token 检查绑定 human owner**：
  否决——**新建 fake user 与「复用 designated admin owner 绑定为 Agent owner」
  均禁止**（`AGENT_PRINCIPAL_HUMAN_OWNER_RULING_V1`：owner_user_id 不是 Agent
  Core 产品模型的一部分，Agent 是独立机器身份）。Amendment 2 曾冻结复用
  designated admin owner，Amendment 3 已将其取代为 `owner_user_id = NULL/ABSENT`；
  v1 路径的 owner 要求由外部前置 (d) 解决，不得用 owner 绕过。

## Acceptance Criteria（Amendment 2 重写 — 分层 + 可达性标注）

后续 Implementation（在 accepted Spec 之下）按层验收。**Amendment 2 删除
Amendment 1 的「L1 不依赖任何外部工作、必须全绿」表述**——外部前置
（E.4 (a) grant 供给 / (b) rotation seam / (c) S1/S2 可调用性 /
(d) 无 human owner 支持）尚未存在，
每项验收显式标注当前可达性；外部前置未就绪时对应路径必须 fail-loud
`external_prerequisite_missing`（该 fail-loud 行为本身**是**可验收项）。

**可达性图例（Amendment 4 更新，Amendment 7 增补）**：
`NOW` = 纯 in-repo，实现后即可执行；`NEEDS(c)` = 需 bootstrap provisioner
credential 就绪（E.4(c) =
BOOTSTRAP_PROVISIONER_CREDENTIAL_READINESS_NOT_ESTABLISHED——operator
out-of-band 供给并完成可用性验证后才算就绪；deployed v1 下 RS256 svc-auth
mint 无 mode 障碍）；
`+(b)` = 另需 HTTPS rotation seam；`+(a)` = 另需业务 grant 供给 seam；
`+(d)` = 另需 Auth 支持无 human owner 的 Agent/machine identity；
`+(e)` = 另需 secret-mutation enforcement seam（E.4(e)，Amendment 7）。
**路径注记（Amendment 4）**：当前部署 = v1（CURRENT_DEPLOYED_ISSUANCE_PATH =
v1/direct），(d) 因此是**现实**阻塞（ownerless agent 在 v1 token mint 的
profile validation 即被挡）。legacy 分支仅为 hypothetical compatibility
analysis（LEGACY_PATH_IS_CURRENT_DEPLOYMENT = NO），**不作为 Acceptance 路径**，
亦不得作为对 (d) 的绕行。(d) 不阻塞 S1 ownerless principal 创建与 store 链——
只阻塞 v1 token mint / profile validation 之后的环节。
**（Amendment 6）** 上述各层的 Phase 维度可达性以 **D.7.4** 为准（Phase A /
Phase B 分段交付）；Phase A 专项测试 PA1–PA5 见 L1 之后。

**L1 — Credential V1 自身验收：**

1. `NEEDS(c)` `formal Agent exists → ensure`：Auth principal 存在（deterministic
   external_ref，Part C.4）+ machine client 存在 + trusted store entry 存在
   （keyed by agentId）。
2. `NEEDS(c)` `repeated ensure`（≥3 次，含并发/交错执行）：**SAME** principal id、
   **SAME** clientId；Auth 侧不存在同 agentCore external_ref 之外的重复
   client/principal。
3. `NOW`（store 契约单元级）/ `NEEDS(c)`（端到端）`trusted store`：0600、
   505-owned；G1–G8 契约可对合成 store 单元验证；端到端为**预置 unrelated
   canary entry 后 ensure 另一 agent，unrelated entry 逐字节不变**（Part G 红线）。
4. `NOW`（部署后静态复测）/ `NEEDS(c)`（完整链路）`child` → cannot read raw
   secret：`CHILD_SECRET_ENV=ABSENT / CHILD_SECRET_FS=ABSENT /
   A_READ_CREDENTIAL_STORE=DENIED`（V2 同口径）。
5. `NEEDS(c)` `Broker` → `loadCredentialFor(agentId)` 成功。
6. `NEEDS(c)`（attempt）/ `NEEDS(c)+(d)`（v1 下 secret validity proof）
   `/oauth/token → actually attempted`（`AUTH_TOKEN_MINT_ATTEMPTED = YES`——
   由 Broker 真实调用或 L1 verification mint 证明；区别于 Part A 的 NO）。
   Amendment 4 注：attempt 本身只需 (c)；当前部署 v1 下 (d) 未就绪时结果
   **确定性地**为 401 agent_profile_invalid（(d) 证据，D.5），secret 有效性
   证明因此 NEEDS(c)+(d)——legacy 宽容仅为 hypothetical，不作依据。
7. `NEEDS(c)+(b)+(d)+(e)` **Missing-store recovery（状态 E；Amendment 7 重标）**：
   手工删除目标 store entry、保留 Auth client → ensure →
   **fail-loud `existing_credential_resolution_required` 且 Auth/store 零变更**
   （该 fail-loud 段 `NOW` 可验收；Part D Amendment 7 注记）→
   由 operator 经 I.4 seam 对 SAME client 显式 ROTATE（clientId 不变，禁建新
   client）→ store 恢复 → verification mint 通过 → **no duplicate client**。
   （Amendment 4 注继续成立：recovery 的收尾 verification mint 在当前部署 v1
   下仍会先被 (d) 的 agent_profile_invalid 挡住 ⇒ 没有 (d) 不能宣称 recovery
   验收通过。Amendment 7 注：rotation 段另需 (e)。）
   在 (b)/(d)/(e) 就绪前：该路径必须 fail-loud / 如实归类
   `external_prerequisite_missing(b|d|e)` 且 Auth/store 无任何变更（此降级行为
   `NOW` 可验收）。
8. `NOW` **状态 A 负例**：不存在的 agentId → STRUCTURED_REJECT；Auth 侧与 store
   均无新建行（无 orphan Auth identity）——纯工具侧行为，不触 Auth。
9. `NOW` **store 保护负例**：预置 malformed store → ensure FAIL LOUD 且文件内容
   不变（MUST NOT overwrite）——纯工具侧行为。
10. `NOW` **外部前置降级负例**：(a)/(b)/(c)/(d)/(e) 任一未就绪时，依赖路径
    fail-loud `external_prerequisite_missing` 且不产生部分副作用（无 Auth
    调用、无 store 写入；状态 A/G 类纯本地分支除外）；v1 路径 (d) 未就绪时
    观察到的 401 agent_profile_invalid 必须归类为 (d) 证据（不 rotate、
    不建平行身份、不绑 owner）。

**Phase A 分段验收（Amendment 6 新增 — 5 项明确测试；D.7.1/D.7.2 冻结。
编号独立于 L1 1–10，可达性图例同上）：**

- **PA1** `NOW` **no store entry + (c)=false**：目标 store entry 不存在且 (c)
  未就绪 → `external_prerequisite_missing(c)`；`AUTH_CALLS = 0`。
- **PA2** `NEEDS(c)` **no store entry + (c)=true**：S1/S2 正常调用；
  deterministic identity（C.4 external_ref；repeated ensure SAME principal /
  SAME client，无重复身份）；secret 按契约写 store。verification mint 结果按
  D.5 解释表归类（当前部署 v1 且 (d) 未就绪时 401 agent_profile_invalid =
  (d) 证据，不得据此 rotate）；含 verification mint 成功的**完整** clean
  bootstrap 通过按 D.7.4 = `PHASE_A_REAL_CLEAN_BOOTSTRAP = NEEDS(c)+(d)`。
- **PA3** `NOW` **store entry exists**：`existing_credential_resolution_required`
  （或 D.7.2 冻结的同一稳定错误族）；`S1 = 0 / S2 = 0 / rotate = 0 /
  claim = 0 / store write = 0`；不尝试 client missing / revoked / mismatched /
  secret invalid / State D–G 分类（D.7.2）。
- **PA4** `NOW` **malformed store**：`CREDENTIALS_STORE_ERROR`（同族）；
  `AUTH_CALLS = 0`；store 文件内容不变（G.3，MUST NOT overwrite）。
- **PA5** `NOW` **Agent missing**：`agent_not_found`（状态 A）优先于一切
  store/Auth 步骤（D.7.1 步骤 1–2）；`AUTH_CALLS = 0`。

**L2 — Grant negative（credential ≠ grant）：**

11. `NEEDS(c)+(d)` credential exists + requested grant absent →
    **authorization failure**（当前部署 v1 = 400 invalid_scope
    （machine_grant_missing / requested_scope_not_granted）——D.5），
    **≠** `credential_unavailable`。（零 grant 新 client 的 verification mint
    400 即为最小证据。）
    Amendment 4 注：当前部署 v1 下 (d) 未就绪时 mint 止步于 profile 401
    （(d) 证据），到不了 grant 层 ⇒ grant-negative 信号需要 (d)；legacy 分支
    （不查 owner）仅为 hypothetical compatibility analysis，不作 Acceptance
    路径。
    Broker wire 层的三层错误码区分（Part F）本身 `NOW` 可实现并单元测试
    （构造 transport 响应），端到端信号需 (c)+(d)。

**L3 — Forum positive（条件验收）：**

12. `NEEDS(c)+(a)+(d)` **only if** required grant already exists through a
    **named external prerequisite**（E.4(a)，当前部署 v1 = MachineAccessGrant
    供给记录在案）→ Broker → token → `forum_list_threads` 到达 svc-forum 并
    返回业务结果。当前部署 v1 下 Forum positive 同时要求：bootstrap
    provisioner credential (c) + Agent 的 forum 业务 grant (a) + ownerless
    Agent 可通过 v1 profile validation (d)。
    在 (a)/(d) 就绪前：不得以任何替代手段（见下）伪造绿；svc-forum 已有的
    RS256/JWKS 验证面**不是**前置（已就绪，不得重复列为 prerequisite）。

**L4 — Credential integrity / rotation seam（Amendment 7，T1–T12）：**

13. `NOW` **T1 boot NOOP**：existing credential → normal runtime boot →
    secret hash/generation 逐字节不变（boot 路径零 credential 写——broker
    gateway 只装配 per-call 只读 seam；以 boot 前后 store 指纹断言）。
14. `NOW` **T2 spawn NOOP**：existing credential → Agent spawn（agent-provisioning
    home 供给全链）→ secret hash/generation 不变（child 零 credential 写）。
15. `NOW` **T3 ensure-existing NOOP / fail-loud**：ensure 对已存在 credential
    → NOOP 或 fail-loud `existing_credential_resolution_required`（Part I.1；
    Phase A 的 fail-loud 即此形态），两条路径下 secret hash 均不变。
16. `NOW` **T4 concurrent ensure**：并发/交错 ensure → singleton（同一
    principal + 同一 clientId），零 rotation、零重复行。
17. `NEEDS(e)` **T5 直写拒绝**：以普通 production app/operator DB identity
    执行 raw SQL / 裸 ORM UPDATE 既有 client 的 secret_hash → REJECTED，
    零 secret mutation。
18. `NEEDS(e)` **T6 hash-only 拒绝**：仅改 secretHash（p4-rotate 形态）→
    REJECTED。
19. `NEEDS(e)` **T7 hash+rotated_at 缝外拒绝**：raw 写同时改 secretHash +
    rotatedAt（绕 audit/store/receipt）→ REJECTED（列级特权，非仅 trigger）。
20. `NEEDS(e)+(c)+(d)`（mutation 力学段仅需 `(e)`；verify 段——MINT_VERIFY /
    REAL_AUTH_CALL_VERIFY——另需 `(c)`，且 ownerless agent-profile 的 v1 mint
    先受 (d) profile validation 门控（D.5），跨业务 audience 时另需 `(a)`；
    若以 service-profile fixture 承载 verify 段则 (d)/(a) 不适用——两种承载
    二选一，验收时声明）**T8 canonical rotate 全契约**：
    显式 rotate（I.3 operation）→ secret generation 恰变更一次、rotated_at
    前移、updated_at 前移、rotation audit 存在、receipt 存在、store 同
    generation、MINT_VERIFY + REAL_AUTH_CALL_VERIFY = PASS。
21. `NOW`（helper 单元/沙箱，fixture store + stub DB）/ `NEEDS(e)`（端到端）
    **T9 部分失败恢复**：store install 失败注入 → bounded rollback/recovery
    生效 → 无 DB_NEW_SECRET + STORE_OLD_SECRET split state，receipt 记录
    失败路径；含 I.4 继承 split state 门（无 receipt 的 DB 前移 → 下一 seam
    接触 fail-loud）。
22. `NOW`（helper 单元/沙箱，fixture store + stub DB 的 operation-id 重放）/
    `NEEDS(e)`（端到端）**T10 幂等重放**：同一 ROTATION_OPERATION_ID 重放 →
    确定性幂等结果，无第二次 secret 变更。
23. `NOW` **T11 p4 形态 fail-before-mutation**：对普通业务 Agent 执行
    p4-final 式 proof 轮换 → 在任何 mutation 前 fail-closed
    （PRODUCTION_PROOF_MAY_ROTATE_ARBITRARY_BUSINESS_AGENT = NO 的守卫断言）。
24. `NOW`（fixture principal 的 mutation 段）/ `NEEDS(c)+(d)`（真实 mint 链；
    ownerless fixture 沿用 D.5 归因；以 service-profile fixture 承载则
    (d) 不适用——验收时声明）**T12 fixture proof PASS**：dedicated fixture
    principal / disposable canary identity 上的 proof rotation 全链 PASS
    （I.5 正向路径）。

**不接受**（任何层、任何前置状态下）：fake credential、mock-only Broker、
manual bearer、OpenClaw fallback、legacy machine-admin create 兜底、CLI stdout
取 secret、绕开受控 (e)/I.2 通道的直连 auth DB 裸读写（含 receipt 缺失的
generation 前移）、缝外 secret material 直写（含 proof/test 脚本对业务
Agent 的破坏性 rotation——Amendment 7）。

## Risks

- **provisioning 误把 secret 落进 child 可读位置** → Part H 冻结唯一路径 + 禁止清单；
  写入面为 505-private store、0600、值直接来自 auth-service（沿用 same-uid audit
  硬前提）。
- **provision Agent A 覆盖 Agent B/C entry** → Part G validate-preserve-atomic 契约
  + L1-3 验收。
- **错误码折叠重演（scope_denied 被掩盖为 transport_failure）** → Part F 冻结层归属与
  可区分要求，实现附带测试。
- **自动 grant 滑入 provisioning** → Part E 冻结 credential ≠ grant，实现必须单列；
  E.4 诚实记录 grant seam 缺失，禁止顺手建设 grant platform。
- **运行时退化回 child-held-credential** → Security boundaries + Frozen boundaries
  显式禁止回退。
- **身份族乱接（误以为字符串相等即绑定）** → Part C 冻结四族映射与 provision-time
  一次性建立，运行时零换算；C.4 冻结 deterministic external_ref，实现不得自定 mapping。
- **恢复路径退化为重复建 client**（状态 E/G）→ Part D 显式 FORBIDDEN 第二 client/
  principal；L1-7 验收 same-client 恢复。
- **外部 prerequisite 缺失被静默绕过**（rotation/grant seam 未就绪时借道 CLI stdout
  或 legacy create）→ Scope-1 要求 fail-loud `external_prerequisite_missing`；
  Alternatives 重申否决。
- **（Amendment 2）401 多因被误读为 secret invalid**（legacy 下 profile 检查先于
  secret 验证）→ S5 LEGACY_401_SEMANTICS + D.5 mode-aware 表冻结；仅在 ensure
  上下文排除其他成因后才可归因 secret；实现不得自行猜测错误含义。
- **（Amendment 2；Amendment 3 改写）owner 相关错误处理**：v1 路径 (d) 未就绪
  时把 401 agent_profile_invalid 误归因 secret invalid（误触发状态 G rotate）或
  反向回退绑定 admin/fake owner → C.4 冻结 OWNER_USER_ID = NULL/ABSENT +
  FAKE_ADMIN_OWNER_FORBIDDEN = YES；D.5/状态 G/E.4/验收 item 10 冻结该 401 归类
  为 (d) 证据；Ruling 禁止以 owner 绕过。
- **（Amendment 2 提出、Amendment 4 修正、Amendment 5 收窄）在 bootstrap
  credential 就绪性未确立时硬跑 ensure**（(c) 未就绪；deployed v1 下 S1/S2 的
  RS256 svc-auth mint 已无 mode 障碍，缺口是完整 bootstrap bundle 的可用性
  未经 operator 供给+验证）→ E.4(c) +
  Acceptance item 10 冻结 fail-loud 降级为可验收行为；禁止直连 DB / in-process
  直调 auth service 层（raw secret 只存在于 HTTPS response body，直连亦不可得）/
  CLI stdout / child env/argv / Agent workspace 绕过。

## Related Evidence

- Governing investigation（PASS）：`docs/investigations/test-agent-feishu-product-semantics-v1.md`
  （`FORUM_CREDENTIAL_FAILURE_LAYER = BROKER_GATEWAY_CREDENTIAL_RESOLUTION`；
  `AUTH_TOKEN_MINT_ATTEMPTED = NO`；OpenClaw 身份 vs Agent Core `agt_*` 身份 gap）。
- Trusted gateway 架构（已验收）：`docs/reports/trusted-credential-broker-integration-v1.md`、
  `docs/reports/trusted-credential-505-final-acceptance-v2.md`（505/502 边界、
  CHILD_SECRET_* ABSENT、store 读取 DENIED）。
- 信任边界调查：`docs/investigations/identity-auth.md`（方案 B 冻结）、
  `docs/investigations/same-uid-router-secret-boundary-audit-v1.md`（env/argv 禁止；
  未跟踪草稿，结论已由 V2 验收与 ps 实证支撑）。
- 外部 auth-service 源码核实（2026-08-17，Part A.4 S1–S6）：
  `src/lib/oauth/v1/idempotent.ts`、`src/routes/idempotent.ts`、
  `src/middleware/v1-management-auth.ts`、`src/lib/oauth/service.ts`、
  `src/lib/oauth/token-issuance.ts`、`src/cli/machine-admin.ts`、
  `prisma/schema.prisma`、`docs/audits/AGENT_IDENTITY_DEPLOYMENT_RECONCILIATION_V1_REPORT.md`。
- Frozen 模型：`docs/decisions/AGENT_SESSION_CHANNEL_MODEL_V1.md`（D-002：Agent 拥有
  credential，principal/credential/grant → Auth——本 Spec 使其可操作化，**不冲突、
  不 disposition**）。
- 治理：`docs/specs/AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1.md`（Spec 生命周期：
  proposed → accepted；本 Spec 当前 `status: accepted`）。
- **（Amendment 7）事故取证（PASS）**：
  `docs/investigations/AGENT_CREDENTIAL_DRIFT_BOOT_HOOK_ROOT_CAUSE_V1.md`
  （root cause = p4-final.sh/p4-rotate.mjs 2026-09-07T12:41:37Z 缝外裸 Prisma
  rotate：hash 变 / rotated_at 不变 / 零审计 / store 不同步；
  `RUNTIME_BOOT_CAUSED_DRIFT = NO`；`AFFECTED_PRINCIPAL_COUNT = 1`；
  `BOOK_DECONSTRUCTOR_ISOLATED = YES`）。修复收据：
  `~/workspace/deployment-artifacts/workflow-directory/bdcred-20260908.sh` +
  `E2E_FINAL_VERIFICATION_20260908.md`（I.4 产品化对象的已验证原型）。
- Phase 分段证据（Amendment 6）：`AGENT_FORUM_WORKFLOW_CREDENTIAL_RECOVERY_
  PREFLIGHT`（OBSERVED_AT 2026-08-20T06:47+0800，owner 交付 preflight；
  production Agent count = 88，88/88 = clean-bootstrap candidate，
  `STATE_F_ENDPOINT_REQUIRED = NO_FOR_CURRENT_88_AGENTS`）——全文记录于
  Amendment 6 摘要。

---

> **V1 历史记录边界**：下段为原 V1 当时的接受/输出记录，日期、reviewed head、PR #17 值及 AM7 COMPOSITION 原文保留；accepted/唯一 Phase A/不新增 Phase 授权不描述 V2 当前 lifecycle 或本 V2 已明示的单 State E 例外。

## Acceptance Record（2026-08-19 acceptance finalize）

```text
ACCEPTANCE_REVIEW   = AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1_FINAL_ACCEPTANCE_REVIEW
REVIEWER_IDENTITY   = ChatGPT GPT-5.6 Pro / Independent Spec Reviewer
REVIEWED_BASE       = b33bb5f551f8bf612a987a52127e50cc6010e147
REVIEWED_SPEC_HEAD  = 610c6b8bb2628c8c4109397ac47a03680914a5ce
REVIEW_VERDICT      = PASS
REQUIRED_FIXES      = NONE
ACCEPTED_AT         = 2026-08-19

ACCEPTANCE_FINALIZE_SEMANTIC_CHANGE = NONE
    （除 frontmatter status: proposed→accepted、本 Acceptance Record、Final Output
      的 SPEC_STATUS 镜像与 READY_TO_IMPLEMENT 状态说明、Related Evidence 的
      status 引用镜像外，正文与 reviewed head 610c6b8 语义完全一致。
      finalize 开始前 reviewed content 已经 sha256 byte-identical 验证：
      270adb5ffdab9510604852f68fb697ef2a28a7bc41e126c589f0821fdd0d794b）
```

---

> **V1 历史记录边界**：下段为原 V1 当时的接受/输出记录，日期、reviewed head、PR #17 值及 AM7 COMPOSITION 原文保留；accepted/唯一 Phase A/不新增 Phase 授权不描述 V2 当前 lifecycle 或本 V2 已明示的单 State E 例外。

## Acceptance Record（2026-08-20 Amendment 6 acceptance finalize）

```text
ACCEPTANCE_REVIEW   = AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1_AMENDMENT_6_SPEC_REVIEW
REVIEWED_BASE       = fe2c6393915b1dc61c4c3d25b2996d2f258ba484
REVIEWED_SPEC_HEAD  = 5d1285195f8c2e3eb88ea606be09671b074f68d4
REVIEW_VERDICT      = PASS
REQUIRED_FIXES      = NONE
READY_FOR_ACCEPTANCE_FINALIZE = YES
IMPLEMENTATION_AUTHORIZED = NO
    （acceptance finalize 本身不授予实现许可；实现许可 = Phase A
      PHASE_A_CLEAN_BOOTSTRAP_FOUNDATION，且仅当本 accepted Amendment 合入
      PR #17 的 implementation base 后经 D.7.5 生效）
ACCEPTED_AT         = 2026-08-20（Amendment 6 生效；D.7.5 剩余条件 =
      merge 进入 PR #17 implementation base）

ACCEPTANCE_FINALIZE_SEMANTIC_CHANGE = NONE
    （本 round 仅 Amendment 6 状态镜像与 acceptance provenance——文头状态行、
      本 Acceptance Record、Final Output 的生效条件与 SPEC_STATUS 镜像；
      reviewed head 5d12851 的全部冻结语义——D.7.1–D.7.6、PA1–PA5、
      Final Output 冻结值——零改动。frontmatter status 保持 accepted：
      本 Spec 为已接受 Spec 的原地 Amendment，authoring 轮未翻回 proposed，
      翻转对象是 Amendment 6 的生效状态，不是整份 Spec 的生命周期状态）
```

---

> **V1 历史记录边界**：下段为原 V1 当时的接受/输出记录，日期、reviewed head、PR #17 值及 AM7 COMPOSITION 原文保留；accepted/唯一 Phase A/不新增 Phase 授权不描述 V2 当前 lifecycle 或本 V2 已明示的单 State E 例外。

## Final Output（Amendment 6 — Clean Bootstrap Phase 分段冻结）

```text
AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1_CLEAN_BOOTSTRAP_PHASE_AMENDMENT = PASS

BASE = accepted Spec（acceptance-finalize 文本 @ 5cfb610，origin/main；
    Amendment 1–5 结论全部保留于各摘要与 git history；Amendment 6 为 in-place
    amendment，不创建平行 Spec）
本 Amendment 生效条件 = 独立 review PASS、accepted 并进入 PR #17 的
    implementation base（D.7.5）——独立 review 已 PASS（2026-08-20，
    AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1_AMENDMENT_6_SPEC_REVIEW，
    reviewed HEAD 5d12851，REQUIRED_FIXES = NONE）、Amendment 6 已 accepted
    （2026-08-20 acceptance finalize，见 Acceptance Record）；在 merge 进入
    PR #17 implementation base 之前，PR #17 仍不得按 Phase A 范围修改

NEW_EVIDENCE_RECORDED =
    AGENT_FORUM_WORKFLOW_CREDENTIAL_RECOVERY_PREFLIGHT（OBSERVED_AT =
    2026-08-20T06:47+0800）：production Agent count = 88；88/88 credential
    store 未配置 / store entry 不存在 / agentcore:v1:principal:<agt_*> 不存在 /
    agentcore:v1:client:<agt_*> 不存在 ⇒ BLOCKER_CLASSIFICATION =
    CLEAN_BOOTSTRAP_CANDIDATE；STATE_F_ENDPOINT_REQUIRED =
    NO_FOR_CURRENT_88_AGENTS；PR #17 的 State F 实现仍受
    READ_ONLY_AUTH_CLIENT_RESOLUTION_SEAM_MISSING。

PHASE_A = CLEAN_BOOTSTRAP_ONLY（唯一实现许可；顺序 D.7.1、existing-entry
    行为 D.7.2）
PHASE_B = EXISTING_CREDENTIAL_RECONCILIATION（无实现许可；最终 A–G 目标模型
    不变，D.7.3）
CLEAN_BOOTSTRAP_ORDER = D.7.1 六步固定顺序（Agent Definition 读取 / 状态 A →
    store 文档完整读取+校验 → 目标 entry 判定 → entry absent：(c)→S1→S2→写
    secret→verification mint；entry exists：fail-loud）
S1_S2_WHEN_STORE_ENTRY_ABSENT = ALLOWED_AFTER(c)
S1_S2_WHEN_STORE_ENTRY_EXISTS = FORBIDDEN
EXISTING_STORE_PHASE_A_RESULT = existing_credential_resolution_required
    （AUTH/S1/S2/CLAIM/ROTATION/STORE_WRITES 计数全零；不尝试 client missing /
    revoked / mismatched / secret invalid / State D–G 分类）

PHASE_A_UNIT_ACCEPTANCE = IMPLEMENTABLE_NOW_IN_REPO
PHASE_A_REAL_CLEAN_BOOTSTRAP = NEEDS(c)+(d)
PHASE_A_FORUM_POSITIVE = NEEDS(c)+(d)+(a)
PHASE_A_WORKFLOW_POSITIVE = NEEDS(c)+(d)+(a)
PHASE_B_EXISTING_STORE_RECONCILIATION = BLOCKED_BY_AUTH_READ_ONLY_RESOLUTION
L1_RECOVERY_STATE_E = NEEDS(c)+(b)+(d)（(b) rotation seam 仍缺失；维持不变）
FULL_L1_L2_L3_COMPLETE = NO（不得声称完整 L1/L2/L3 已全部完成）

PR_17_CURRENT_ALLOWED_SCOPE = PHASE_A_CLEAN_BOOTSTRAP_FOUNDATION
PR_17_MUST_NOT_CLAIM = FULL_A_TO_G_IMPLEMENTATION
PR_17_EXISTING_STORE_PATH = FAIL_LOUD_ZERO_AUTH_CALLS
PR_17_STATE_F_IMPLEMENTATION = DEFER_TO_PHASE_B

PREREQUISITE_C_FINAL_DEFINITION（Amendment 4/5 冻结，不变）=
    BOOTSTRAP_PROVISIONER_CREDENTIAL_READINESS_NOT_ESTABLISHED：现有运行证据
    证明生产 HTTP 管理面使用痕迹不存在（resource=svc-auth mint = 0；近期无
    principal/client 创建事件，仅 2026-07-23 孤立测试突发 4 条 ⇒ S1/S2 无生产
    HTTP 管理面执行证据——这是可用性未确立的证据，不是 mode=v0 的证据），
    且尚未验证完整 bootstrap bundle 当前可用：active service principal +
    active machine client + usable secret + svc-auth MachineAccessGrant
    （scope auth.identity.provision）+ trusted deployment/operator 侧交付输入。
    本 Spec 不声称仅凭 audit 就能证明所有 out-of-band 对象物理不存在；operator
    明确供给并完成可用性验证之前，Implementation 视 (c) 为未就绪并 fail-loud
    external_prerequisite_missing(c)。仅属 trusted deployment/operator zone；
    Agent Core child 与普通 Agent 永不持有；service profile 不受 (d) 影响；
    无正式 grant mutation seam ⇒ 初始 bootstrap 为 operator out-of-band；
    禁止直连 DB / CLI stdout / child env / argv / Agent workspace 绕过。
    (a) vs (c)：(a) = 被 provision 的 Agent client 的业务 grant（svc-forum/
    svc-workflow 等）；(c) = provisioner 自身的管理面 credential（svc-auth +
    auth.identity.provision）。主体/audience/scope/生命周期不同，独立计数。

L1_CORE_EXECUTABILITY（层维度，不变）=
    principal/client ensure chain = NEEDS(c)（(d) 不阻塞 S1 ownerless 创建）；
    trusted-store write / loadCredentialFor chain = NEEDS(c)；token mint
    attempt = NEEDS(c)；纯工具负例与 fail-loud 行为 = NOW。
L1_SECRET_VALIDITY_PROOF = NEEDS(c)+(d)（当前部署 v1 下 (d) 未就绪时
    verification mint 确定性止步于 401 agent_profile_invalid = (d) 证据）
L1_RECOVERY_EXECUTABILITY = NEEDS(c)+(b)+(d)（= L1_RECOVERY_STATE_E，见
    D.7.4；(b) rotation seam 仍缺失；就绪前 fail-loud，降级行为 NOW 可验收）
L2_EXECUTABILITY = NEEDS(c)+(d)（deployed v1 下须先过 ownerless profile
    validation 才能到达 MachineAccessGrant 缺失的 authorization failure 层；
    Broker wire 三层错误码区分本身 NOW 可实现并单元测试）
L3_EXECUTABILITY = NEEDS(c)+(a)+(d)（= PHASE_A_FORUM_POSITIVE /
    PHASE_A_WORKFLOW_POSITIVE 的层维度表述；legacy 分支仅为 hypothetical
    compatibility analysis，不作 Acceptance 路径；svc-forum 已有 RS256/JWKS
    验证面，非 prerequisite）
PHASE 维度可达性 = D.7.4（Phase A / Phase B 分段；层维度结论如上不变）

DEPLOYED_AUTH_CONTRACT_MODE = v1（Amendment 4，不变）
CURRENT_DEPLOYED_ISSUANCE_PATH = v1/direct
LEGACY_V0_OR_V1_SHADOW_PATH = hypothetical / compatibility analysis only
LEGACY_PATH_IS_CURRENT_DEPLOYMENT = NO

401_ATTRIBUTION_RULES（不变，重申）=
    v1 assertPrincipalProfile 先于 secret verification；(d) 未就绪时 ownerless
    Agent 的 401 一律归类 (d) evidence / INCONCLUSIVE；不触发 rotation、不进入
    状态 G、不新建平行 principal/client、不绑定 designated admin 或 fake owner；
    wire 上无法区分 agent_profile_invalid 与 credential_invalid，继续采用规则式
    归因而非响应内省。
    PROFILE_401_PRECEDES_SECRET_VERIFICATION = YES
    PROFILE_401_DOES_NOT_TRIGGER_ROTATION = YES
    FAKE_ADMIN_OWNER_FORBIDDEN = YES

ARCHITECTURE_DIRECTION = KEEP
ROUTER_CHANGE = NONE
RUNTIME_CHANGE = NONE
KERNEL_CHANGE = NONE

UNCHANGED_FROZEN_ITEMS（本轮零改动）=
    Owner Ruling（principal_type=agent + agent_id=agt_* + owner_user_id=
    NULL/ABSENT）· prerequisite (a)/(b)/(c)/(d) 定义 · deterministic
    external_ref（agentcore:v1:principal|client:<agentId>）· S1/S2 幂等 ensure
    （禁 legacy machine-admin create fallback、禁 expected_* claim）· no
    duplicate identities · 状态机 A–G（最终目标模型，Phase B 交付）·
    trusted-store G1–G8 · single writer · secret HTTPS response body →
    process memory → 0600 store（no argv/env/stdout/stderr/log/child/workspace）
    · same-client rotation · revocation fail-closed · credential != grant ·
    Broker collateral = YES_MINIMAL · Router/Runtime/Kernel = NONE ·
    不增加 OpenClaw credential fallback

SPEC_STATUS = accepted（2026-08-19 初版 acceptance finalize；2026-08-20
    Amendment 6 acceptance finalize——independent review PASS @ reviewed HEAD
    5d12851，REQUIRED_FIXES = NONE，Amendment 6 分段交付冻结生效；待 merge
    进入 PR #17 implementation base）
本轮 = SPEC ONLY：IMPLEMENTATION_PERFORMED = NO · MERGE_PERFORMED = NO
```

> **V1 历史记录边界**：下段为原 V1 当时的接受/输出记录，日期、reviewed head、PR #17 值及 AM7 COMPOSITION 原文保留；accepted/唯一 Phase A/不新增 Phase 授权不描述 V2 当前 lifecycle 或本 V2 已明示的单 State E 例外。

### Final Output 追记（Amendment 7 — Incident hardening，2026-09-09）

上节 Final Output 反映 Amendment 6 时的状态；Amendment 7 的增量以本轮摘要与
正文为准，镜像如下：

```text
AMENDMENT_7_SCOPE = incident hardening（docs-only，零代码、零 Auth 仓库变更）
    I.1 CREATE/ENSURE/ROTATE 三操作 + 三条 NO-rotation 不变量
    I.2 rotation seam 排他（机制级 DIRECT_APP_ROLE_SECRET_UPDATE = IMPOSSIBLE；
        仅 rotated_at 同步规则明确不足）
    I.3 canonical rotation operation contract（12 字段 + secret bytes 边界）
    I.4 bounded rotation transaction + 继承 split state 门 + bdcred 模式产品化
        （含 Part H 合规修正：产品化必须消除原型的 argv secret 暴露）
    I.5 proof/test safety（PRODUCTION_PROOF_MAY_ROTATE_ARBITRARY_BUSINESS_AGENT = NO）
    E.4(e) SECRET_MUTATION_ENFORCEMENT_SEAM（AUTH_CHANGE_REQUIRED = EXTERNAL_ONLY 不变）
    D Amendment 7 注记（ensure 绝不 rotate；PHASE_B 的 State E/G 恢复轮换 =
        独立 operator ROTATE 经 I.4 seam；与 Amendment 6 分段组合）
    L4 验收层（AC 13–24，T1–T12）；L1-7 重标
    Security boundaries +2 禁止行；不接受清单扩 2 项
COMPOSITION_WITH_AMENDMENT_6 = PHASE_A fail-loud 行为不变且与 I.1 一致；
    State E/G 判定树形状不变，仅 rotation 执行者/契约改变；不新增 Phase 授权
    （实现许可边界仍由 D.7.5 冻结）
NEW_EXTERNAL_PREREQUISITE = (e)（与 (a)/(b)/(c)/(d) 独立计数；(b)/(e) 边界已注记）
UNCHANGED_FROZEN_ITEMS（Amendment 7 零改动）=
    Owner Ruling (d) 语义 · external_ref · S1/S2 · 状态机 A–G 判定树形状 ·
    D.7 分段冻结（D.7.1–D.7.6）· trusted-store G1–G8 · Part H 冻结清单 ·
    Part J revocation · Broker collateral = YES_MINIMAL ·
    Router/Runtime/Kernel = NONE
AMENDMENT_7_REVIEW_TRAIL = independent semantic review r1 REVISE（3 blocker
    + 5 non-blocker）→ blocker union 一次修复 → delta re-review ACCEPT
    （2 non-blocker 已落：L1-10 枚举扩 (e)、(b)/(e) 边界注记）
SPEC_STATUS = accepted（Amendment 7 为 accepted Spec 的事故硬化 amendment）
本轮 = SPEC ONLY：IMPLEMENTATION_PERFORMED = NO · MERGE_PERFORMED = NO
```


---

## V2 单既有 Client State E 独立 operator 规则

以下 CTR-SER/ACC-SER 由已审 REV3 规范正文加最新用户明确允许的两来源准入修正组成；其余按字节纳入。S01/S02 逐句见 mapping 并另作唯一差量审查；12 Contracts/6 Acceptance 与六路径仅计单 State E 差量，不替代继承范围。本候选仍 proposed；实际接受与运行结果留在 PR/报告证据，不伪造 V2 接受历史。

## 1. 固定基线、资格与实例

DSH base/main = 33ebceb9c80df668c27ad61d162ed9afa0c08da8。
V1 path = docs/specs/AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1.md。
V1 blob = a335484c25da539d6552ff1b896abe2177fba821。
除本文明确替换/增加的意义外，完整 V1 normative body 按该 blob 精确继承；无部分 supersession。
原 clause 坐标：State E 931–939/966–976；I.3 1530–1555；I.4 1557–1593；Scope3/phase 注记 1689–1703；D.7.5 1176–1182；AM7 composition 2190–2203。

Auth external authority = mayf3/auth-service main 72c906726ff3d05d2de3a96cdd8fdd271338173c；
AUTH_SERVICE_MACHINE_CREDENTIAL_ROTATION_AUTHORITY_V1，CTR-MCRA-001/002/005（270–354），字节同 accepted base a5579b51139953505c25e1db58776af2ae693136。不改变 Auth authority、DB schema、权限或 function。

DSH 接受资格来自同一 DSH main 的 .agents/local/README.md：
“SPEC_ACCEPTANCE_ACTORS = repository owner mayf3, or an explicitly authorized maintainer recorded in the PR”；
“Review recommendation does not itself perform acceptance”。
Auth #92 委托不自动授予 DSH 接受资格。本次用户已授权实际失败 caller 的凭据恢复及最小 canary 效果，无需再索同一效果批准；该任务不是 Product Authority acceptance 或 native Human 身份证明。本稿不引入 pilot LA。原协调路由真实 qualified DSH 接受人，本文作者不自接受。

实例只能绑定以下两类之一的一条真实失败 invocation，本次仍只恢复其中一个经证明的既有 active identity：
1. 原 ZCode 本次 agent_session_send / credential_unavailable 历史失败的可信安全投影；或
2. 由既有绑定 runtime / 已存在 capability 产生的一次新受控纯只读 session/identity/status 实际调用，证明 effective caller，且实际结果确为 credential_unavailable。
第二类必须按实际加载代码和该调用路径证明无 mint/token acquisition、send、身份/Session 创建、env/权限变动及 audit/ACK 等状态写效果；不得只凭能力名为只读即推定。不得创建新 Agent/Client/Session/runtime/tunnel，不冒认它是原 ZCode caller 或全部 caller；只有随后同一 identity 的精确 DB 映射证明成立才可合并两者证据。
两类安全投影均须有 {toolName=实际已装入口名称, failureCode=credential_unavailable, invocationTime, toolCallId或recordId, callerAgentId或可连接的sourceSessionId/child-generation/PID, projection来源}；第一类 toolName 固定为 agent_session_send。
不得输出 prompt/body/token。多 caller 必须来自真实记录逐项映射；本次一次只能选其一，不能从默认 Agent、名字或 Client 列表猜选。当前投影未到，故实例不 ready；设计不以未填事实冒充可执行。

## 2. 受限源码闭包

仅允许以下六个路径，实际实现另走原 source lane、exact base/head 与独立 affected-contract review：
1. scripts/agent-credential-rotate.mjs：在同一官方 CLI 增加 recover-missing-store、纯只读同 op reconcile 分类、原 op 显式 continue-delivery，以及分别记录的 mint/canary 验证阶段；正常 rotate/gate/receipts 行为不改。
2. packages/agent-credential-provisioning/src/state-e-recovery.js：新增本状态机；不修改普通 ENSURE/ROTATE 的 classifier。
3. packages/agent-credential-provisioning/src/store-writer.js：新增受锁、prepare/commit/abort pending-add 内部原语；复用既有 metadata/serialization 规则，原 add/replace 语义不改。
4. packages/agent-credential-provisioning/src/state-e-auth-channel.js：新增本次 operator 的 in-process Auth adapter；只调用既有 canonical function/只读查询，复用固定现役 Auth 安装的既有 Prisma driver，不安装依赖。
5. packages/agent-credential-provisioning/test/state-e-recovery.test.js：新增隔离状态机/文件故障测试。
6. packages/agent-credential-provisioning/test/state-e-recovery-postgres.test.js：新增隔离真实 PostgreSQL seam/CAS/receipt/crash 测试。

不修改 Auth repo、Runtime、Router、Broker、Grant、Agent Definition、依赖/lockfile或 accepted 文本；不新增 HTTP API、daemon、通用批准平台或第二 CLI。每文件遵守现有结构限制。既有 shared checkout 与 credential-seam-wiring@d6fc32f4e05ef1c9e6b11e6c9c26cd2ed1999d68 仅是 source reference，不是 writer custody 证明；原 owning actor 协调实际隔离写面，不新增并行 writer。

## 3. 拟议 Contracts

### CTR-SER-001：仅独立 operator State E

仅为已证明 active、既有 SAME Principal/SAME Client 的 missing-store 恢复提供本次实施许可。ENSURE 仍 Phase A fail-loud；PR #17、其余 Phase B D/F/G/full A–G、fleet 自动恢复均不解冻。禁止新 Principal/Client、identity adoption、scope/Grant/owner/legacy-array 变更。
resource 固定 agent-session-messaging，scope 固定 agent.session.send，来自 base 的 agentSessionMessagingManifest；不得为通过验证增加权限。

### CTR-SER-002：可信绑定与入场

选定 qualifying invocation→经可信既有 runtime/child-generation 与实际加载入口冻结的 effective caller→Agent Definition→唯一 Auth Client/Principal 必须闭合。Auth 仅以原应用角色精确读该绑定及 active/current-generation 事实，既有身份不唯一/不活动/不同命名空间未经证明均拒绝。运行时默认 Agent、root传入AgentID或历史示例不是证明；loaded source/runtime或child generation 未绑定不能从静态代码推定实际 caller。
凭据恢复执行前固定真实 recovery_operation_id（UUID）、actor、原用户任务引用、accepted authority/source pins、目标 tuple、store路径/对象/owner、Auth安装/角色及一次 attempt；这些恢复事实缺失才零效果拒绝，没有“任选一个 Agent”的分支。canary实例另在CTR-SER-011入场；尚无已存在受控main不阻挡已合法准入的凭据恢复，只使canary NOT_RUN。
四种身份不得混用：failed_invocation_id是原失败toolCallId/recordId；recovery_operation_id只标本次凭据恢复；compensation_receipt_id固定为<recovery_operation_id>:rollback；新的canary invocationCorrelation及其返回requestId只标本次测试调用。原失败ID/旧UNKNOWN不能被当作恢复或新canary ID。

### CTR-SER-003：原 custody、sole writer 与秘密输入

adapter/DSN接收进程必须同时具有两项既有资格：原Auth应用角色的合法custody，以及该trusted store既有写资格；这是必须证明的权限交集。FD持有、uid502、driver可读或本DSH差量均不授予任一资格。没有现成权限交集则实例NOT_READY，不能由本稿转交Auth秘密或新增sudo/DB角色/ACL，也不通过chmod/chown/迁移使其准入。
执行计划绑定实际Auth安装根、driver解析路径/版本/公共源码或包字节pin、Node executable pin、原Auth custodian/adapter/store-writer的OS身份与进程generation、数据库current_user/session_user及原已授role。接收DSN前仅证明既有Auth/store权限交集及固定OS身份、进程generation、安装、driver、executable pins；随后仅用原合法custody提供的DSN建立连接，先执行必要的只读数据库身份核验。current_user/session_user与既有角色不吻合即close，禁止target query及任何效果；不授新转交资格。目录须满足原Part G的trusted private ownership/0700、无symlink ancestor；文件0600、regular、nlink1，FD/path/inode前后相同。当前uid502 store与default Agent仍不构成资格证明。
原store锁持续覆盖PREPARE→DB分类→delivery或stopped terminal；本op O_EXCL claim及同target旧claim发现按CTR-SER-004执行，均fsync文件与父目录。claim只防本恢复协议换UUID逃逸，不宣称排除普通/外部writer；它们仍依既有store锁、全快照CAS及DB generation CAS发现漂移。

DSN由原 Auth custody留在可信进程内部，或经仅原 parent继承的 protected FD交付；CLI argv仅非secret pin路径、operation UUID、FD号。新 mode不得复用 --db-url 传DSN，也不得经 env、临时公开文件、日志或receipt传DSN。closed FD只传递数据，不传递资格；在前述接收前的既有权限交集及固定OS身份/安装/driver/executable pins已成立后才可接收，连接后的数据库身份核验按前段顺序执行。禁任意module/command/callback路径、NODE_OPTIONS/DYLD注入；原应用角色不吻合即close，禁止target query及任何效果。此窄FD/driver入口属于上列CLI/adapter闭包；不授Auth转交权，也不构成批准或Human来源证明。

### CTR-SER-004：一次生成与私有 journal

claim→PLAN→PREPARED→DB_CALL_INTENT→DB_COMMITTED→STORE_INSTALLED→VERIFIED→TERMINAL 采用 append+fsync journal；字段闭合，记录opaque目标/plan/阶段、原DB backend generation和private commitments，不记录raw secret、DSN、raw DB verifier/hash。public receipt连这些敏感commitments也不输出，只给阶段/结果/布尔证明/合法非秘密坐标。
生成secret前必须在同一既有store锁内，按该store固定basename的.state-e-<UUID>.claim.json集合发现所有保留claim，并核对其store身份、exact Client及journal终态；不得只检查本次UUID。任一同store+Client旧claim未闭合，或匹配命名空间旧claim损坏、未被完整发现/无法分类，均阻断不同UUID新op，只允许原op只读分类。发现超出实现固定资源上限同样fail-closed，不跳过旧claim；terminal claims保留作为后续发现依据。不同UUID不能清除旧fence。
一次op最多生成一个256-bit新secret。claim后crash、stage缺失或UNKNOWN都不得再生成secret/换operation；已知零效果失败可封存该op，但不自动新尝试。父task/chat/JSON不替代qualified Spec acceptance或真实操作custody。

### CTR-SER-005：明确的 pending credential-store 例外

这是对 Part G/H 的窄拟议增加，不能假称当前临时文件已获许可：
唯一 pending 路径为同一 trusted store目录中
<store-basename>.state-e-<operation-uuid>.pending.json；
private journal/claim分别为同前缀 .journal.jsonl / .claim.json，均0600。basename与UUID来自固定PLAN，禁止任意路径。pending是唯一额外的 protected credential material，不是普通journal、日志或公开artifact。

在锁内验证整个原 V1 store、目标entry ABSENT与原对象身份；构造保留全部非目标entry的candidate V1文档，仅加入该existing Client的新secret。pending按O_CREAT|O_EXCL|NOFOLLOW创建，先0600/owner验证再写secret，fsync→父目录fsync；拒symlink/hardlink/冲突文件。持久化PREPARED及pending dev/ino/私有完整性承诺后才允许DB调用。不可借现有普通temp或backup名称猜测是本stage。
secret只在可信进程memory、该pending credential-store、最终primary store存在；pending不得复制到evidence/普通journal。真实crash可保留它用于原op forward delivery，终态才按CTR-SER-012清理。原primary在delivery前保持原文档；不保存额外含secret的公开preimage。

### CTR-SER-006：冻结 preimage 与双 CAS

PLAN在可信进程中读取exact Client UUID及真实DB verifier，冻结其generation commitment；raw旧verifier只在该活进程memory保留，不持久化普通journal。必须证明target store entry ABSENT，同时私有绑定整个原store对象/字节commitment，保留非目标。
APPLY必须把冻结的expected preimage传给rotate_machine_client_secret；禁止到APPLY时重新读任意live generation并将其当作原expected值。DB行锁内CAS/receipt由既有Auth function负责。store commit再次检查目标ABSENT和原store完整快照未漂移；任何差异拒绝覆盖。普通writer/外部DB漂移不因本地锁而被假定排除。

### CTR-SER-007：一次 canonical DB APPLY

本次生成值只经既有SECURITY DEFINER function更换；同事务receipt、rotated_at/updated_at按Auth合同前移。普通DML与SET ROLE旁路禁止。
DB_CALL_INTENT先durable，原DB backend PID/start generation一并记录；同一原operation仅一次初始DB请求。超时/断连不等于失败，不重新调用function来“查状态”。只读查询原operation receipt、exact Client当前generation及必要的该原backend存活布尔值；不读取其他业务行/Grant或SQL正文。

### CTR-SER-008：只在 DB 已证后交付

必须同时证明原op receipt绑定exact Client/expected→本candidate generation，且当前DB仍验证该pending secret；才可在持锁、原store ABSENT+快照CAS通过后将pending同FS atomic rename至primary，fsync父目录，再验证primary inode/custody和secret↔DB linkage。不允许复制secret到第二待交付文件。
若primary已由本op同一frozen stage安装且DB吻合，则只补只读事实/terminal，不第二次交付。别的entry或generation出现是CONFLICT，不覆盖、不接管。

### CTR-SER-009：原 op reconcile 与 UNKNOWN

只读reconcile/classification仅读原op claim/journal、冻结pending或已安装primary身份、原DB receipt/current generation，返回分类；不写DB、不安装/rename、不mint、不send、不生成secret、不换op。
原合法任务和claim预先涵盖的显式continue-delivery是另一个原op阶段，不借reconcile名义暗含效果：fresh分类、同target claim与重新持有原store锁均吻合后，最多完成该原op的一次forward delivery和本地credential↔DB linkage读回；不mint、不send。此原授权内续交付不新增逐阶段Owner确认。mint/canary另按CTR-SER-011分别入场与记录。
原DB receipt不存在只有在原DB请求已被证明终止、不会late commit且一致快照仍为冻结旧generation时，才可分类ZERO_DB_EFFECT。原backend状态不可判/receipt或文件不一致则UNKNOWN或CONFLICT，保留fence与private material。
分类为DB_COMMITTED_PENDING且pending完整、primary仍原ABSENT时，才可显式进入原op continue-delivery。分类为STORE_INSTALLED_MATCH时，continuation只完成本地linkage证明与CREDENTIAL_DELIVERED阶段收据；两者都不隐含mint/canary或泛称verify。当前DB不再是本generation时不得使用旧receipt继续。任何stage缺失/替换/损坏、unexpected raw record、部分journal行或不明rename结果均不得自动rollback、覆盖或重新轮换。

### CTR-SER-010：严格限定 compensation

仅原活进程仍保有真实冻结旧verifier、原初始DB commit已证、当前DB仍是本candidate、primary确定仍原ABSENT且快照未动、pending custody完整，并且delivery发生已知失败时，才可选择既有Auth function进行一次compensation。
compensation ID在PLAN预先固定为<operation>:rollback，属于原op，不是新的任意尝试；CAS期待本candidate generation，new verifier使用memory中的真实旧值，不猜造/逆推旧secret。保留全部audit/receipt，不回拨时间戳；只恢复旧verifier的功能值与原store ABSENT，结果标ROLLED_BACK，绝不报恢复成功。
crash丢失旧verifier、DB结果UNKNOWN、可能已交付/已使用new credential、canary UNKNOWN或第三方generation变化时，禁止自动compensation。若pending custody丢失且不能forward，封存CUSTODY_LOSS/UNKNOWN并由原actor处理；不得用第二secret把证据抹平。正常crash恢复优先依durable pending前推，不依赖并不存在的旧secret。

### CTR-SER-011：恢复验证与 canary分账

凭据恢复阶段先只在trusted memory证明primary与exact Client当前generation一致并封存其独立RESTORED/CREDENTIAL_DELIVERED结果；mint_result与canary_result可仍为NOT_RUN。缺测试main或readback入口不倒置为凭据恢复零效果门。
之后的MINT_VERIFY阶段仅请求固定resource/scope；token不输出/持久化。权限不足不增加Grant，不把invalid_scope当需再次rotate，分别记录credential linkage与mint结果。
canary阶段另须绑定预先已存在、获本次受控测试授权的canonical main、原caller的实际加载工具schema/source pin及既有receipt/reply读取入口，才经现有agent_session_send发送一次固定无secret marker；不得新建Session/identity或发送业务正文。不能证明既有main则canary NOT_RUN，不让产品自动建立main。
关联字段使用既有链路：child/runtime为这次新canary产生invocationCorrelation，原agent_session_send返回的requestId以及已证明的sessionId/messageId按实际返回形态保留；四ID关系依CTR-SER-002分离，不自造requestId。首选读取原send结果中的receipt/对应reply；需要reconcile时只用实际已加载且原caller已获授权的agent_session_send_reconcile及其原invocationCorrelation/已知requestId绑定，服从该已装schema，不发明新API/参数或新增scope。若无合法现成读回入口，结果保持UNKNOWN并保全关联，不补造接口、不重发。
canary timeout/UNKNOWN只沿同invocation已授权读取，绝不自动resend、rollback或再次rotate。credential恢复、mint授权、canary replied、业务验收分别记录；health或token端点不能代真实call。无需runtime restart。

### CTR-SER-012：终态与有限清理

成功终态需DB receipt/current linkage、primary custody、store-preserve证明与验证分层结果齐全。失败终态需准确标明是否DB改变/交付/请求UNKNOWN、原op下一合法只读入口。
pending一旦rename即成为primary，不能再按temp删除。仅原op已durable terminal、无在途请求/consumer持有该stage，且目标inode仍为本op原对象时，方可unlink未交付pending并fsync目录。UNKNOWN、CUSTODY_LOSS或需reconcile时保留material与fence；never wildcard清理/覆盖旧store/receipt/业务source。该规则不要求B7两业务完成，也不授予B7/daemonDB/production runtime其它权限。

## 4. 必测逐故障矩阵

F01 凭据恢复所需绑定/权限交集/目标active/可信store失败：拒绝且DB/store零效果；仅缺测试main或canary读回入口时不阻断已合法恢复，canary分别NOT_RUN或UNKNOWN。
F02 同UUID冲突，或同store+Client旧claim在crash后未终态而尝试different UUID，或旧claim损坏/无法完整分类：阻断新op，只读原op分类；不新secret/op。
F03 pending创建/权限/内容/fsync失败：DB未调用；封存零效果失败；仅按终态inode规则清理。
F04 PREPARED后、DB_CALL_INTENT前crash：DB未dispatch可证才零效果封存；不重新generate。
F05 DB返回明确CAS拒绝/事务rollback：零DB效果；primary原ABSENT；封存失败，不自动重试。
F06 DB超时/断连/commit响应丢失：保留fence；只读原receipt/current/backend。无receipt但原请求未证结束仍UNKNOWN；禁止APPLY重发。
F07 DB成功后、rename前crash：只读classification零写/mint/send；receipt+current+frozen pending+primary原ABSENT全吻合后才显式原op continue-delivery一次+本地linkage；无第二DB更改。
F08 当前DB被另一generation取代：CONFLICT；不能凭旧receipt安装、rollback或rotate。
F09 rename明确失败且满足CTR010全部事实：可一次canonical compensation；否则保留stage走原op分类。
F10 rename/目录fsync结果不明：只读冻结inode与primary/pending。只有确证原op已安装才续verify；不猜“没装”而rollback。
F11 rename成功、terminal前crash：classification确认primary同stage+DB吻合后，continuation只补本地linkage/CREDENTIAL_DELIVERED收据；mint/canary保持独立阶段，不第二secret/第二交付。
F12 pending/primary被替换、硬链/symlink、journal截断或stage丢失：CONFLICT/CUSTODY_LOSS/UNKNOWN，保全；绝不伪造preimage或自动补物。
F13 mint/真实call明确失败：记录各层结果；已交付credential保持可审，不以verify失败触发新rotate/自动rollback。
F14 canary UNKNOWN/回复超时：只同invocation读回；不重发、不自动rollback、不把恢复链路称业务成功。
F15 compensation响应丢失：只读<op>:rollback receipt/current/primary；保持fence；不第二compensation。
F16 并发store entry出现或任一非目标entry变化：ABSENT/全快照CAS拒绝；不得覆盖。
F17 argv/env/stdout/stderr/receipt/model/evidence泄DSN、secret、raw DB hash/verifier：验收失败；不得发布/运行该carrier。
F18 原普通matching-store ROTATE、ENSURE PhaseA和PartG/H既有负例回归：语义不变；不扩大PhaseB。

## 5. Acceptance（反向覆盖完整）

ACC-SER-001覆盖001/002：独立文本/原failure投影/精确绑定审查；环境为固定base/head及单实例材料；证据为qualified actor、closed tuple和零身份/Grant delta；缺actualcaller则INSTANCE_NOT_READY，任意默认身份/扩权判FAIL。
ACC-SER-002覆盖003/004/005：隔离真实OS文件/FD实验，执行F01–04/F12/F17；证明接收进程既有Auth/store双资格、固定安装/driver/identity pins与secret sentinel零暴露；加入differentUUID同target旧claim在crash后仍阻断、损坏/无法分类旧claim阻断测试。普通journal含secret、未durable stage先DB、仅持FD就获资格或可替换FD/path均FAIL。
ACC-SER-003覆盖006/007：disposable已迁移PG+真实canonical function，F05/06/08及stale PLAN/foreign target/ordinary role bypass；证据为事务receipt/代次相等布尔、一次调用计数、零scope/identity delta；live值替换冻结CAS或缝外DML判FAIL。
ACC-SER-004覆盖008/009/010：真实child kill点与文件/DB故障注入，F07–12/F15/16；分别计数证明只读classification的DB写/install/mint/send全0，显式原op continuation最多一次delivery+本地linkage且mint/send全0，known rollback或fenced UNKNOWN按原事实成立；仅stub/布尔fixture不能充当durable/crash PASS。第二secret、UNKNOWN重发、classification暗含效果或错误rollback均FAIL。
ACC-SER-005覆盖011：隔离token/capability协议正反例与一次后续受控既有main实例，执行F13/14；分别证明credential已合法恢复而缺main时canary NOT_RUN、只读分类/续交付不触发mint/send、后续mint与canary分别入场。冻结实际加载schema中的invocationCorrelation、返回requestId/已证明sessionId/messageId及原receipt/reply或既有reconcile入口，验证四ID分离；无合法读回入口则UNKNOWN禁重发。缺main反向阻断凭据恢复、发明reconcile API/参数/scope、token/health代真实call或重发UNKNOWN均FAIL。
ACC-SER-006覆盖012及全部不变边界：独立exact source closure/Secret/cleanup review，F17/18；证据为六路径diff、完整新carrier build、受影响测试和删除/保留receipt。旧未变检查不重跑；新的source/故障组合须实际执行。无实际live结果不得称恢复完成。

CONTRACT_COUNT = 12
CONTRACTS_WITH_ACCEPTANCE = 12
OPEN_PRODUCT_DECISIONS = NONE in this proposed design
