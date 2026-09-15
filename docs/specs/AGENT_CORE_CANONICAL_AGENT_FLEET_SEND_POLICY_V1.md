---
spec_id: AGENT_CORE_CANONICAL_AGENT_FLEET_SEND_POLICY_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: contracts
date: 2026-09-15
revision: r3
r1_review: independent review round-1 = REVISE（3 blockers，全机械：
  revoked_at 列不存在 / principal_type 字面量大小写 / re-enable 无 enable surface）；
  blocker union 修于 r2，notes（r5 引用、A.2 指针、per-client 计数、
  repo 侧 registry 漂移、scheduler.audit 禁令保留、未来 scope 冲突边界、
  retire-only-by-roster-removal 纪律）一并吸收
r2_review: independent review round-2 = REVISE（唯一残留 blocker = B2 字面量
  清扫漏 §4 出生护栏与 §9 I1 负例标签；另 2 cosmetic：§2 出集指针应指 §6、
  §8 应枚举 AMENDMENT_2 内容）——全部修于 r3；其余 round-1 blockers/notes
  经 round-2 逐项机械确认 RESOLVED/PRESENT
owner_goal: CANONICAL_AGENT_TO_AGENT_SESSION_SEND_V1
owner_ruling_date: 2026-09-15
owner_rulings:
  - CANONICAL_AGENT_FLEET_POLICY=ACCEPTED_DIRECTION
  - ANY_PRODUCTION_CANONICAL_ACTIVE_ENABLED_AGENT_CAN_SEND=YES
  - PER_AGENT_OWNER_APPROVAL_REQUIRED=NO
  - PER_AGENT_MANUAL_ALLOWLIST_REQUIRED=NO
  - FIXTURE_AGENTS_INCLUDED_IN_PRODUCTION_FLEET=NO（裁定"不再询问"）
  - "§4 根因四字段 ACCEPTED（FIRST_DENY_LAYER=auth-service MachineAccessGrant；
    EXACT_DENY_REASON=machine_grant_missing；CURRENT_DEPLOYED_POLICY=manual
    per-sender grant；CURRENT_EFFECTIVE_SENDERS=2）；deny-layer 调查就此终局"
  - "现有 agt_efficiency-agent / agt_hr-agent grant：不当异常删除，落地时统一 reconcile"
governed_by:
  - AGENT_CORE_AGENT_SESSION_MESSAGING_V1 (accepted r5 — AMENDMENT_1+2 均 accepted，
    messaging semantics, identity model, error taxonomy, reply/reconciliation:
    UNCHANGED, NOT rewritten here)
supersedes:
  - target: AGENT_SESSION_SEND_STANDALONE_DEPLOYMENT_AUTHORITY_V1 (accepted r2)
    scope: CLAUSE_SCOPED — §6 CURRENT_GRANT_STATE（单 tuple 冻结 + fleet-wide grant
      禁令 + "禁止重复插入、fleet-wide grant、target-side grant"指令）自本 Spec 起失效；
    preserved: 该 Spec 其余章节（17-file 部署 face、r2 envelope-fix closure、canary
      记录）保留为已发生部署的历史 authority of record / evidence，不追溯改写；
      §6 尾部"不顺手 scheduler.audit"禁令亦 preserved（无关 hygiene 禁令，方向安全）
amends: []
related:
  - AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1 (membership legs 的既有权威：
    Agent Definition config 存在性 / auth-service client↔principal↔agent_id 绑定唯一权威)
  - AGENT_CORE_EXACT_PRINCIPAL_AGENT_RESOLUTION_V2 (caller 身份精确解析)
  - AGENT_WORKSPACE_SESSION_MODEL_V3 (AGENT_TO_AGENT_MESSAGING_SESSION_SCOPE=TARGET_MAIN)
external_authorities:
  - repository: mayf3/auth-service
    relation: MachineAccessGrant 物理行与 token issuance 的唯一权威；本 Spec 的实现
      需其 companion contract（AUTH_SERVICE_SESSION_SEND_FLEET_GRANT_PROVISIONING_V1，
      实现阶段随 auth-service PR 冻结；先例=AUTH_SERVICE_AGENT_SESSION_SEND_OPERATIONAL_GRANT_V1 / PR #50）
review_status: PENDING_INDEPENDENT_REVIEW
---

# AGENT_CORE_CANONICAL_AGENT_FLEET_SEND_POLICY_V1

> 目的：把 `agent.session.send` 从「手工 per-sender MachineAccessGrant allowlist」
> 收敛为「production canonical Agent fleet 的机械派生基线能力」。本 Spec 只替换
> **grant 的分配政策**；`AGENT_CORE_AGENT_SESSION_MESSAGING_V1` r5（AMENDMENT_1+2
> 均 accepted）已 accepted 的
> messaging 语义（身份模型、参数闭包、错误表、reply/reconciliation）**一字不改、不重写**。

## 0. Case 记录与裁定（2026-09-15，Owner，本 Spec 不再询问）

§4 根因调查终局（fresh production evidence， Owner 已接受）：

```text
FIRST_DENY_LAYER        = auth-service MachineAccessGrant（broker gateway LOCAL
                          Auth-grant check 发起，v1.direct issuance 判定）
EXACT_DENY_REASON       = machine_grant_missing（broker 侧包装为 access_denied）
CURRENT_DEPLOYED_POLICY = manual per-sender grant
CURRENT_EFFECTIVE_SENDERS = 2（agt_efficiency-agent、agt_hr-agent）
```

权威方向：

```text
CANONICAL_AGENT_FLEET_POLICY       = ACCEPTED_DIRECTION
PER_AGENT_OWNER_APPROVAL_REQUIRED  = NO
PER_AGENT_MANUAL_ALLOWLIST_REQUIRED = NO
FIXTURE_AGENTS_INCLUDED_IN_PRODUCTION_FLEET = NO
```

被 supersede 的旧约束（原 STANDALONE r2）：`NO_FLEET_PRODUCTION_CHANGE` 之于
**grant 政策**的含义、单 tuple 冻结、fleet-wide grant 禁令。17-file 部署历史不追溯。

## 1. 产品语义（冻结）

```text
agent.session.send = 每一个 production canonical Agent 的 baseline capability
                   = one fleet policy → mechanically materialized entitlement
                   ≠ N 个独立业务授权
                   ≠ 93 条人工 allowlist
```

Send 权限 != Receiver 业务权限（不变式，引用 MESSAGING_V1 §boundaries 原文效力）：

```text
A can send to B ≠ A becomes B ≠ A inherits B permissions
CROSS_AGENT_IMPERSONATION=NO      CROSS_AGENT_GRANT_ESCALATION=NO
CREDENTIAL_LEAK=NO                RECEIVER_IDENTITY_OVERRIDE=NO
FOREIGN_SESSION_ACCESS=NO
```

Sender identity 恒来自 trusted runtime/auth context（MESSAGING_V1 R3），tool args
中的任何身份字段物理不可见（R2 闭包）——本 Spec 零改动。

## 2. PRODUCTION_CANONICAL_FLEET — membership 机械定义（权威源）

集合必须在执行时从 authoritative source 机械解析，**禁止**硬编码 roster、
人工复制名册、display-name 推断、fixture 名字黑名单、legacy alias / UUID 前缀推断。

```text
PRODUCTION_CANONICAL_FLEET ≜ { agent A | G1 ∧ G2 ∧ G3 }

G1  Agent Definition registration：runtime Agent Definition config（agents.json）
    存在 id=A 的条目，且 disabled=false
    （存在性/enabled 权威 = AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1 §A.2 权威表既定）
G2  auth machine principal：存在绑定 agent_id=A 的 MachinePrincipal，
    principal_type='agent'（Prisma enum 小写字面量，取值仅 agent|service；human 是
    User 行、本就不是 machine principal，结构性缺席本集合）且 status='active'
    （绑定唯一权威 = auth-service，cred-provisioning spec A.2 既定）
G3  machine client：该 principal 名下存在 status='active' 的 MachineClient
```

**判定规则：**

```text
agt_* 语法          = 必要条件，NOT 充分条件（永不单独构成 entitlement）
agents.json 单独    = NOT production fleet authority（混有 fixture、无判别字段）
fixture 排除        = 结构性：fixture 从未完成 production identity provisioning
                      （无 G2 principal）⇒ 自动缺席，零名字黑名单
retired/legacy-only = G2/G3 失效（principal/client 非 active）⇒ 自动缺席
新增合法 Agent      = 完成 canonical provisioning（principal+client 诞生）后
                      自然入集，自然获得 send entitlement
disable / retire    = 自然出集（见 §6），禁止任何自动 revive
```

**Fresh census（2026-09-15，机械 join：agents.json × auth principal.created 审计/DB）：**

```text
roster=93；principal 绑定=89；principal 不在 roster=0；
无 principal 的 4 条 = agt_16cf59bc…（hardening fixture A）、
  agt_f38685f2…（hardening fixture B）、agt_fb7837711…（integration fixture/
  default agent）——三条全部是 UUID 形 fixture——以及 agt_huanhuan-thought-agent
  （真实 agent 但未完成 provisioning；其将来完成 provisioning 即自然入集，by design）
89 条 fleet 成员中 disabled=0
PRODUCTION_CANONICAL_AGENT_COUNT = 89（@2026-09-15；Done When 要求执行时 fresh 重算）
```

## 3. Entitlement 物化（保留行模型，语义改为派生）

auth-service token issuance 架构仍要求 per-client `MachineAccessGrant` 行才签
token——**保留该物理实现**，但行语义变更为：

```text
DERIVED_FROM_FLEET_POLICY = YES
AUTO_PROVISIONED          = YES
AUTO_RECONCILED           = YES
MANUAL_ALLOWLIST_SEMANTICS = NO
```

每个 fleet 成员的**每个 active MachineClient** 恰一行目标态（grant 物理主键 =
`(machine_client_id, audience_id)`；列闭集 = scopes(String[]) / version /
created_at / updated_at，模型上 **没有 revoked_at 列**——行惰性不靠行级撤销位，
由 §6 issuance-time active 校验保证）：

```text
{ machineClientId, audienceId = agent-session-messaging（audience registry 既有行）,
  scopes = ['agent.session.send'], version >= 1 }
```

约束闭集：

```text
本 audience 下 grant scopes ≠ ['agent.session.send'] 的任何超集/子集/异集 = 禁止
本 Spec 不新增/不触碰任何其他 audience / resource / scope
principal_type != 'agent'（即 service；human 非 machine principal）永不 stamped
```

已知边界：grant 物理主键为 `(machine_client_id, audience_id)`——未来任何 authority
若想对同 audience 追加其他 scope（如 registry 中已预留的 inspect 族 scope），与
本节 exact-scope 闭集冲突，必须走本 Spec 的 amendment，本 Spec 不预授权。

## 4. Birth provisioning（新 Agent 自动获得）

- **Surface**：auth-service 幂等 provisioning 通道 `createOrGetClient`
  （`src/lib/oauth/v1/idempotent.ts`）——为 `principal_type='agent'`（Prisma
  小写字面量）的 principal create/claim client 成功后，同一通道流程内 upsert
  §3 目标行（幂等 create-or-get；
  已存在精确行 = no-op、version 不动，语义复用 grant-migration 既有
  version-stable / scope-set-exact 语义）。
- **覆盖要求**：所有 production client 创建面（幂等通道、machine-admin legacy
  create、任何一次性脚本）最终态都必须收敛到 §3 行——以 §5 reconciliation 为
  收敛兜底（AUTO_RECONCILED），birth stamping 保证即时性。
- 新 Agent 完成 canonical provisioning 后**无需任何 Owner 逐 Agent 授权**即可 send。

## 5. Reconciliation / backfill（存量收敛）

auth-service 侧一次性+可重跑脚本（实现阶段命名；要求冻结）：

```text
R1  membership 执行时 fresh 重算（DB × agents.json），禁止缓存名册、
    禁止 CLI 手工传入 agent id 清单
R2  默认 DRY_RUN：输出 plan（ADD / KEEP / NORMALIZE / SKIP-nonfleet 计数）+
    census（PRODUCTION_CANONICAL_AGENT_COUNT、SEND_ENTITLEMENT_MISSING_COUNT；
    后者以 client 为主键 = fleet principal × active client pair 缺精确行的数量，
    多 client 成员按 pair 枚举）
R3  --apply：仅幂等 upsert；零 DELETE（本 policy 不需要删除行——非成员的 deny
    由 issuance-time active check 结构保证；行残留无害且被 R1 判定忽略）
R4  --selftest 离线全绿是交 Owner 执行的前置（repo 铁律）
R5  每次 mutation 落 audit；可重复执行、结果收敛
R6  执行权 = Owner（authsvc/DB 访问墙），Agent 只准备脚本与读回执
```

Existing drift 的处置（Owner 裁定，§3 of goal）：

```text
agt_efficiency-agent / agt_hr-agent 现有精确行 → KEEP（幂等 normalize = no-op）
缺失的 fleet 行 → ADD
fixture / 非成员 → 结构性 SKIP（本来就没有 principal，无行可加）
本 Goal 不顺手处理任何其他 Auth hygiene
```

## 6. Lifecycle revocation（disable/revoke/retire 自动失效）

deny 的结构保证（既有代码路径，冻结为需求）：

```text
principal.status != active 或 client.status != active
  → v1.direct issuance invalidClient('client_or_principal_inactive')
    （auth-service src/lib/oauth/v1/direct.ts:101）
  → broker grant check 失败 → access_denied
Agent Definition disabled → runtime 不再运行该 Agent（无调用面）；
  作为 RECEIVER → handler target_disabled（既有）
agent.session.send 的 disable/retire 生产流程必须落 principal/client inactive
  （既有行为）；grant 行可残留，但 issuance-time 校验使其惰性
Lifecycle discipline（冻结）：仅从 agents.json 移除条目 **不构成 retire**——
  residual grant 行在该情形下只受手工纪律约束；`DISABLED_RETIRED_AGENT_SEND=DENY`
  只对 deactivate 路径（principal/client inactive）作结构保证
自 send（A→A）= self_send_not_supported（既有，不变）
```

`DISABLED_RETIRED_AGENT_SEND=DENY` 由上述组合保证，无需新增 auth 侧 agents.json
读取（保持 auth 与 runtime config 的层界）。

## 7. Receiver 语义（不变 + 显式 non-goal）

Receiver 维持 MESSAGING_V1 既有判定：`enabled Agent resolves targetAgentId`
（target_not_found / target_disabled / self_send_not_supported），执行用 receiver
自己的 credential/grants（R3，H/I 自动成立）。

**显式 non-goal**：本 Spec 不在 receiver 侧新增 fixture/production-identity 过滤。
fixture agent（runtime 注册且 enabled）作为 receiver 的可达性维持现状——这与
Goal §1/§3 的 DENY 闭集（non-canonical legacy / unknown / disabled / retired /
无 runtime 注册 / HUMAN / SERVICE）一致，且改动它将重写 MESSAGING_V1 已 accepted
的 target 语义（本 Spec 被禁止）。如需 receiver 侧收紧，另立 Spec。

## 8. Delivery / receipt / reply / reconciliation（J — 不变）

全部继承 MESSAGING_V1 r5（AMENDMENT_1：§5.1 两维结果模型、§5.2
failureCode+invocationCorrelation、§5.3 agent_session_send_reconcile；
AMENDMENT_2：post_receipt reason marker、§5.3 conversion row、§7
T_PROCESS_EXIT/AGENT_PROCESS_EXITED cases——outcome_unknown 恒为 reason、
永非 delivery status）。实施依赖注记：reliability 实现（#203）已 merge 入 dsh main，
PRODUCTION_APPLY 仍为 tracked debt——本 Spec 的 production E2E 若在其部署前执行，
outcome/reconcile 断言以当时已部署字节为准，不得虚报。

## 9. Implementation scope 与 repo 拓扑

```text
auth-service（mayf3/auth-service）：
  I1 createOrGetClient 通道 birth-stamp（§4）+ 单测（agent stamp / service
     principal 不 stamp / 幂等重入 no-op / version 稳定）
  I2 reconcile 脚本（§5）+ --selftest
  I3 companion contract spec + PR（external_authorities 先例：PR #50 模式）；
     必须一并冻结 agent-session-messaging audience 行的 repo 侧 registry 来源
     （r1 census 时该行仅存在于 deployed runtime snapshot
     generated/minimal-auth-v1/runtime-contract.json，repo checkout 的
     contract-bundles 尚无该行——contract 须 reconcile 此漂移）
  I4 token issuance / deny 代码路径零改动（issuance 维持行校验 + active 校验）
dsh-agent-core：
  D1 本 governing spec（本 commit，docs-only）
  D2 实现期证据与验收记录（docs/evidence/…）
  D3 broker / production-runtime / agent-router 语义字节零改动
     （capabilities/agent-session-messaging.js 等一律不触碰）
部署：auth-service 重新部署走其既有部署路径（Owner gate）；
     dsh 侧无 runtime 部署件（除非 I1 选择经 provisioning 通道外的面，则另冻结）
```

## 10. Acceptance（全部为生产级，不接受 source/tests-only）

### 10.1 Implementation acceptance（Goal §5，三条全过才算实现完成）

```text
NEW_AGENT_PROVISIONING_PATH=PASS
  （新 provisioning 一个 canonical agent → 无任何手工 grant 步骤 → send token 可签）
EXISTING_FLEET_RECONCILIATION=PASS
  （DRY_RUN census + --apply 后 SEND_ENTITLEMENT_MISSING_COUNT=0；
   重跑收敛、无重复行、非成员零新增行）
DISABLE_REVOKE_PATH=PASS
  （disable 一个成员的 principal/client → send token 被拒
   client_or_principal_inactive。已知事实并冻结：auth-service 当前无 enable
   surface（disable 为单向操作）；re-enable = 显式 Owner 直接操作，不在本 Goal
   scope、不作为本验收项）
```

### 10.2 Production E2E（Goal §6，真实生产调用，逐项留证）

```text
A  agt_build-in-public-agent → agt_content-ops-agent        = PASS
B  agt_hr-agent → 任一其他 canonical production Agent        = PASS
C  先前被拒的普通成员（agt_learning-expert）→ canonical receiver = PASS
D  任取另一对 production canonical 成员                       = PASS
E  fixture/test Agent → production receiver                  = DENY
F  canonical sender → nonexistent / disabled / legacy receiver = DENY
```

并证明：

```text
RECEIVER_RUNS_AS_RECEIVER=YES          SENDER_DOES_NOT_GAIN_RECEIVER_GRANTS=YES
CREDENTIAL_LEAK=NO                     DURABLE_RECEIPT=YES
REPLY_ASSOCIATION=PASS
```

### 10.3 Production readback 阶梯（Goal §12；六项全 PASS 才可宣称 DONE）

```text
SOURCE_PRESENT → AUTHORITY_ACCEPTED → DEPLOYED_PRESENT → MODEL_VISIBLE
→ RUNTIME_READY → PRODUCTION_E2E=PASS
```

### 10.4 Done When（Goal §7）

```text
CANONICAL_AGENT_TO_AGENT_SEND=READY
PRODUCTION_CANONICAL_AGENT_COUNT=<执行时 fresh 精确值>
SEND_ENTITLEMENT_MISSING_COUNT=0
MANUAL_SENDER_ALLOWLIST_REQUIRED=NO
NEW_AGENT_AUTOMATIC_SEND_ENTITLEMENT=YES
DISABLED_RETIRED_AGENT_SEND=DENY
BUILD_IN_PUBLIC_E2E=PASS   HR_E2E=PASS   GENERAL_PAIR_E2E=PASS
FIXTURE_E2E=DENY
```

## 11. Boundaries / 停止条件

```text
B1 本 Spec 自身 commit = docs-only；PRODUCTION_CHANGE=NONE；GRANT_CHANGE=NONE
B2 实现不得修改本 Spec（GOVERNING_SPEC_UNMODIFIED）；不得重写 MESSAGING_V1 语义
B3 不做 allowlist 复辟、不建手工豁免通道；任何"单个 Agent 特批 send"= 违反本政策
B4 不顺手处理其他 Auth hygiene（Owner 明示）
B5 merge gate：独立评审（SAFE_TO Materialize 一问一支）→ Owner exact-head
   acceptance → 实现分支 → 10.1 → 生产 → 10.2/10.3/10.4
B6 STOP：membership 权威源结构变化（agents.json schema / principal 模型）使 §2
   join 不可机械执行 → 停止，重出本 Spec 的 amendment，不得带伤实现
B7 主分支前进触碰 §9 引用的 blob（idempotent.ts 通道、direct.ts 校验行号漂移）
   → 实现分支 rebase 时 fresh 复核，语义不变则只更新引用，语义变化则走 B6
```

## 12. Evidence appendix（2026-09-15 fresh，只读取证）

```text
生产 audit：/Users/yanfenma/.openclaw/logs/auth-service.stderr.log [AUDIT] 行
  - v1.direct.issued resource=agent-session-messaging：
      agt_hr-agent（mc_IuBMfCYe9…，dc702687）531 次（2026-09-05T23:58Z 起，持续）
      agt_efficiency-agent（mc_cF81D…，b21ddb23）6 次（canary）
  - v1.direct.failed machine_grant_missing 同 resource：
      mc_rl_DL…=agt_learning-expert（40daa67b）29 次（09-14 15:20Z→09-15 00:40Z）
      mc_-A15c…=agt_ceo-agent（25a6789f，09-15）、
      mc_ohDTy…=agt_build-in-public-agent（d5b3aeb2，09-09）、
      mc_sWqLV…=agt_blog-agent（fd58881a，canonical，09-04）
deployed 面：/usr/local/libexec/agent-core/app/packages/broker/src/capabilities/
  agent-session-messaging.js sha256 da437f2a… == main 逐字节同（DEPLOYED_PRESENT）
identity 反查链：principal.created audit（含 agentId）× agents.json join；
  svc-workflow trusted_fleet_principal_cutover_v1.rs roster 互证
issuance active 校验：auth-service src/lib/oauth/v1/direct.ts:101
birth 通道：auth-service src/lib/oauth/v1/idempotent.ts createOrGetClient:373
  （"client permissions are managed separately via MachineAccessGrant"）
```
