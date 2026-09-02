---
spec_id: AGENT_CORE_WORKFLOW_TRANSITION_CANARY_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: none
production_apply_authority: none
date: 2026-09-01
type: canary execution authority proposal (docs-only authoring round)
scope:
  - mayf3/dsh-agent-core
  - production workflow_transition 单次 canary 执行授权（专用可丢弃 fixture 上 exactly one transition；write-gate 单窗口；独立 seal/audit/Owner 授权链）
governed_by:
  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0
  - AGENT_CORE_WORKFLOW_ASSIGNEE_TRANSITION_CAPABILITY_V1
  - AGENT_CORE_WORKFLOW_TRANSITION_PINNED_HOTFIX_DEPLOYMENT_V1
external_authorities: []
supersedes: []
superseded_by: null
owners:
  - mayf3
---

# AGENT_CORE_WORKFLOW_TRANSITION_CANARY_V1

> **PROPOSED / NOT ACCEPTED（2026-09-01，试跑 授权 authoring 轮）。** 本文件是
> `workflow_execute_canary_v1`（Capability Authority CTR-009）的**执行 Authority
> 提案**，即 Deployment Authority CTR-HD-006 冻结链序中的
> `CANARY_EXECUTION_AUTHORITY` 环。TRACK =
> `WORKFLOW_TRANSITION_CANARY_V1`，与 recovery 轨道（回滚至 frozen preimage
> `04ca8550…` 后按 accepted pinned-hotfix Authority 重新部署 `577c8778…`）
> **互不依赖**：本 Authority 只在执行轮 G0 以 fresh 只读核查接受那条轨道的
> **终态生产事实**，不依赖其 PR、其事务或其验收。本轮 **docs-only**（恰 2 个
> docs 文件）：不 provision fixture、不打开写闸门、不设置 allowlist、不取
> token、不提交任何 transition、不重启服务、不 sudo、不 osascript、不修改
> Grant、不修改产品代码、不代表 Owner 接受或合并本 Authority。在独立
> 「试跑 审计」PASS 且 Owner 完成 acceptance 事务之前，本文件**不授权任何
> 实现、构建或生产动作**（`implementation_authority = none`、
> `production_apply_authority = none`）。**DO NOT MERGE**（等待独立复审；
> 合并仅由 Owner 执行）。

## 1. Goal

为生产 `workflow_transition` 能力建立**唯一 canary 执行 Authority**，冻结
`workflow_execute_canary_v1` 的最小生产验收语义：在**专用、可丢弃测试
Workflow** 上，以**已有合法 `workflow.execute` Grant 的 identity**，经正式
Broker 工具面执行 **exactly one transition（V→V+1 一次，无重试）**，产出完整的
服务端 event / receipt / audit 证据链，并在完成后把 svc-workflow 写闸门与
allowlist 恢复**安全终态**（gate = false，直到 Owner 明令）。

canary 唯一目的 = 以最小、可审计、可丢弃的一次真实写路径执行证明部署面
（Deployment Authority CTR-HD-005 的只读证明面）与写路径（Capability
Authority CTR-001..009）在生产真实可用。它**不是** rollout：一次 canary
通过不授权任何 fleet 写开放、任何新 Grant、任何第二次 transition。

## 2. Scope and non-goals

**In-scope（本 Spec 授权面，全部为 accept 后才生效的治理合同）：**

- G0 只读前置核查合同：部署终态、写闸门安全基线、Grant census、fixture
  存在性（CTR-CA-002）；
- 专用可丢弃 fixture 合同：恰好一个 canary instance、可丢弃标记、永不触碰
  真实业务 Workflow（CTR-CA-003）；
- identity 复用合同：只使用既有合法 Grant 的 identity，零 Grant 变更
  （CTR-CA-004）；
- 单次 transition 语义合同：CTR-009 A/B/C/D 验收流的执行轮形式——恰好一次
  POST、断言 `V+1` / `eventSequence` / 新 node visit、只读 SQL 回执复核、
  任何失败即停不重试（CTR-CA-005）；
- 写闸门单窗口与安全终态合同（CTR-CA-006）；
- 独立 seal / 双审计 / Owner osascript 授权链合同（与 recovery Authority
  同构但**独立 ID**，结构借鉴、语义不复用、artifacts 不共享）（CTR-CA-007）；
- 审计完整性合同（CTR-CA-008）；
- 失败即停与边界不扩大合同（CTR-CA-009）；
- 本轮 authoring 边界（CTR-CA-010）。

**Non-goals：**

- 不实现、不修改任何产品代码（Broker / svc-workflow / auth-service / 本仓库
  任何 package）；
- 不新建、不修改任何 Grant / principal / credential / role（Capability
  Authority DEC-005 / CTR-007 红线整体继承）；
- 不以任何真实业务 Workflow 实例作为 canary 对象，不做 assignment 变更、
  create / cancel / revise / assistance、Definition 管理、任何 Coordinator
  能力、手工 SQL 写（Capability Authority CTR-007 红线整体继承）；
- 不执行 fleet `workflow.execute` rollout，不重复 canary，不自动重试，不
  扩大到分页遍历 / control-instance 深比较 / replay 断言（那是 combined-deploy
  sealed runner 内嵌 canary 程序的扩展面，见 OBS-CA-007 与 ALT-CA-004）；
- 不修改 Governing Authority 本体（GOVERNING_SPEC_UNMODIFIED，CTR-CA-010）；
- 不裁决 recovery 轨道的事务、其 PR（#134 及后继）或其验收；不携带其
  candidate / transaction / seal ID（独立性，CTR-CA-007）。

## 3. Authority and dependencies

**Parent authorities（precedence 顺序）：**

1. `AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0`（治理协议 adoption；vendored
   distribution @ `.agents/`，`governance.lock.json` 校验；SPEC_FORMAT_V0 /
   SPEC_GOVERNANCE_V0 纪律）；
2. `AGENT_CORE_WORKFLOW_ASSIGNEE_TRANSITION_CAPABILITY_V1`（**Capability
   Authority**，accepted / contracts；被验收能力的全部行为合同
   CTR-001..009 的 owner；本 Spec 直接实现其 CTR-009 `workflow_execute_canary_v1`
   验收流的生产执行授权位，继承其 DEC-005 Grant 红线与 CTR-007 写红线）；
3. `AGENT_CORE_WORKFLOW_TRANSITION_PINNED_HOTFIX_DEPLOYMENT_V1`（**Deployment
   Authority**，accepted / contracts / contracts；其 CTR-HD-005 冻结写闸门
   独立性与部署后只读证明面，其 CTR-HD-006 把本 Spec 定位为链中
   `CANARY_EXECUTION_AUTHORITY` 独立事务）。

本 Spec 是**新增（NEW）governing Spec**，`supersedes = []`：不替换任何既有
authority，只承接 Capability Authority CTR-009 明文留空的「后续独立执行轮次，
须 Owner 单独下令」授权位，与 Deployment Authority CTR-HD-006 链序一致。

**结构参考（非 parent authority）**：
`AGENT_CORE_WORKFLOW_TRANSITION_DEPLOYMENT_RECOVERY_V1`（截至本轮为 proposed
Draft PR #134）的 receipt / seal / 双审计 / Owner osascript 授权链**结构**被
借鉴（同构、独立 ID）；其 recovery 语义（R5 事实、23 gate、两分支 selector）
**不被复用、不被依赖、不被 governed_by 引用**——canary 轨道与 recovery 轨道
互不依赖（§1）。

**输入坐标（本轮独立只读复核，见 §5；执行轮 G0 必须 fresh 重证）：**

```text
REPOSITORY                     = mayf3/dsh-agent-core
AUTHORING_BASE_COMMIT          = 840d2f4ad91f8252eb1f163330c041216a0dd9c4（origin/main）
CAPABILITY_AUTHORITY_ID        = AGENT_CORE_WORKFLOW_ASSIGNEE_TRANSITION_CAPABILITY_V1
DEPLOYMENT_AUTHORITY_ID        = AGENT_CORE_WORKFLOW_TRANSITION_PINNED_HOTFIX_DEPLOYMENT_V1
DEPLOYMENT_AUTHORITY_MERGE     = 1a9b81de19c2bf4af01f62f6189acffc1bb6839d
RELEASE_SOURCE_COMMIT          = f4bc4311225c9e0fd906ce108a5b9ffdbd83a957
EXPECTED_TARGET_GIT_BLOB       = 577c8778cf35810ce7538aff52ab354e0c1dddc6（执行轮生产必须已部署并加载）
FROZEN_PREIMAGE_GIT_BLOB       = 04ca8550fbdaf9b66624dea42701a8a9af7547a8（recovery 轨道的回滚目标，非本轨前置输入）
DEFAULT_CANARY_AGENT_ID        = agt_build-in-public-agent
DEFAULT_CANARY_PRINCIPAL_ID    = d5b3aeb2-e754-49a9-9914-b963521c0985
DEFAULT_CANARY_CLIENT_ID       = mc_ohDTyGYRpBLI4qN_sVU88aob
WRITE_GATE_KEY                 = AUTH_V1_CANARY_WRITE_ENABLED（安全终态 = false）
ALLOWLIST_SUB_KEY              = AUTH_V1_CANARY_ALLOWED_SUB
ALLOWLIST_CLIENT_KEY           = AUTH_V1_CANARY_ALLOWED_CLIENT_ID
WRITE_GATE_SAFE_TERMINAL_STATE = gate false 且两 allowlist key 缺席
CANARY_CONFIG_PATH_CLASS       = /tmp/agent-core-workflow-canary-v1.json（prep runner 冻结产物；或后继 audited runner 的等价新 provenance 路径）
```

**默认 fixture 方案（prep evidence 冻结值；执行轮可按 CTR-CA-003 以等价
专用可丢弃 fixture 替代，替代须进 canary plan 并经双审计）：**

```text
FIXTURE_DOMAIN         = workflow-todo-dogfood（10000000-0000-0000-0000-000000000100，enabled）
FIXTURE_DEFINITION     = personal_quick_item_v1（definition_version 95aacea2-5599-4e74-b576-e2eeb61e27a0，v1 PUBLISHED，仅存于该域）
FIXTURE_ENTRY_NODE     = open（DRAFT，assignee_ref_type=WORKFLOW_CREATOR ⇒ 创建者即 exact assignee）
FIXTURE_TRANSITION     = advance-to-completed（ADVANCE）7493f6ca-6cf0-4ebf-95f8-f565f2b231ec
FIXTURE_PAYLOAD_SHAPE  = submission_schema {"summary": string, required, additionalProperties=false}
FIXTURE_MARKER         = externalReference = workflow_execute_canary_v1（disposable，do-not-process）
OPTIONAL_CONTROL_FIXTURE = externalReference = workflow_execute_canary_v1_control（永不 transition；仅当采用的后继 runner 沿用 prep-v2 形态）
```

## 4. Current State

- `STATE-CA-001` — **专用 canary fixture 尚不存在**：svc-workflow 生产 DB
  只读 census（2026-09-01，本轮）`external_reference LIKE '%canary%'` = 0 行；
  canary principal `d5b3aeb2…` 创建实例数 = 0；被指派 node visit 数 = 0；
  `/tmp/agent-core-workflow-canary-v1.json` 缺席。prep-v2 owner provisioning
  command（`sudo bash /tmp/run-agent-core-workflow-canary-prep-v2.sh`，
  sha256 `f7d39de9…`）从未执行。Basis：`OBS-CA-001`、`OBS-CA-002`、
  `OBS-CA-007`、prep 报告 §0/§6。
- `STATE-CA-002` — **canary identity 存在且 active，Grant 证据充分但本轮
  无法逐行 fresh census**：principal `d5b3aeb2-e754-49a9-9914-b963521c0985`
  （`agt_build-in-public-agent`）经 auth-service 生产 API（127.0.0.1:4001）
  只读查询为 active（2026-09-01，本轮）；其 client `mc_ohDTyGYRpBLI4qN_sVU88aob`
  持有 audience `svc-workflow` 的
  `{workflow.read, workflow.execute}` v2 grant 是 **accepted Capability
  Authority STATE-006 的冻结记录**（2026-08-28）；2026-09-01 生产 auth DB
  aggregate census 记录 185 个 active `workflow.execute` grant / 98 个 active
  principal（recovery Authority OBS-REC-005，PR #134 comment `5486244042`）。
  本轮逐行 fresh census 受阻：auth-service 生产 `.env`（DATABASE_URL 坐标）
  为 0600 authsvc uid 505，非 sudo 会话不可读；compose 默认库
  `agent_dev_center` 无 auth 表；66 库只读探测均无 `machine_access_grants`。
  逐行证明收敛为执行轮义务（G0 非秘密 census + W2 token claims 断言，
  CTR-CA-002/004）。Basis：`OBS-CA-003`、`OBS-CA-004`。
- `STATE-CA-003` — **写闸门当前为 true（中间态，非本轨所有）**：
  `/Users/yanfenma/.local/services/svc-workflow/.env` exact-key 只读读取
  （2026-09-01，本轮）`AUTH_V1_CANARY_WRITE_ENABLED=true`；两 allowlist key
  缺席。该 true 是事件窗口遗留中间态；recovery 轨道（并行推进）负责恢复
  false。本 Authority 的 G0 要求 gate = false（安全基线），此后才允许
  Owner 明令的单窗口打开。Basis：`OBS-CA-005`、recovery Authority
  STATE-REC-003。
- `STATE-CA-004` — **生产当前已加载 target blob（并行轨道进行中，非本轨
  前置事实）**：只读 `git hash-object`（2026-09-01，本轮）live
  `workflow.js` = `577c8778cf35810ce7538aff52ab354e0c1dddc6`（20058 bytes，
  root:wheel 0644，mtime 2026-09-01 07:09）；Broker `/health` `{"ok":true}`；
  svc-workflow `/healthz` `{"status":"ok"}`。recovery 轨道将先回滚
  `04ca8550…` 再按 accepted Deployment Authority 重新部署 `577c8778…`；本轨
  仅在 G0 fresh 核查终态（blob == `577c8778…` + catalog + count 15 +
  health），不依赖其过程。Basis：`OBS-CA-006`。
- `STATE-CA-005` — **canary 执行授权位空缺**：仓库内不存在任何 accepted
  authority 覆盖生产 canary 执行；Capability Authority CTR-009 为 design-only
  且明文「执行轮须 Owner 单独下令」；Deployment Authority CTR-HD-005 冻结
  `CANARY_EXECUTION_AUTHORIZED = NO`，CTR-HD-006 把本授权列为链中独立事务。
  Basis：`OBS-CA-008`、Deployment Authority §9。

**前置核查结论（写入本 PR 正文；执行轮 OWNER 通知义务的依据）：**

```text
CANARY_PREREQ = MISSING(专用可丢弃测试 Workflow fixture 未 provisioning)
  ├─ fixture 侧：MISSING —— 0 个 canary 标记实例 / canary principal 零创建零指派 /
  │   canary config 缺席 / owner provisioning command 未执行（STATE-CA-001）
  └─ identity 侧：READY_WITH_BASIS —— 默认 identity = agt_build-in-public-agent
      （principal d5b3aeb2…，client mc_ohDTyGYRpBLI4qN_sVU88aob，active）；
      Grant 依据 = accepted STATE-006 冻结记录 + 2026-09-01 aggregate census
      185/98；逐行 fresh census 因凭据边界推迟至 G0/W2（STATE-CA-002）
EXECUTION_ROUND_OWNER_NOTIFICATION = REQUIRED（fixture provisioning 是 Owner
  执行输入；缺口不得以真实业务对象替代 —— CTR-CA-003）
```

## 5. Observations

### OBS-CA-001 — canary config 缺席

- Subject: `/tmp/agent-core-workflow-canary-v1.json`
- Environment: 本机 /tmp（prep-v2 runner 冻结产物路径）
- Observed at: 2026-09-01（authoring 轮）
- Method: `ls /tmp/agent-core-workflow-canary-v1.json`
- Result: `No such file or directory`
- Provenance: 本轮 shell 记录；与 prep 报告 §0 `CANARY_CONFIG = NOT_GENERATED`
  一致

### OBS-CA-002 — svc-workflow 生产 DB 只读 census：无 canary fixture

- Subject: svc-workflow 生产数据库 `workflow_instances` / `workflow_node_visits`
- Environment: 生产（坐标 = svc-workflow `.env` DATABASE_URL，只读；
  `psql -X -A -t -v ON_ERROR_STOP=1`，零写、零秘密输出）
- Observed at: 2026-09-01（authoring 轮）
- Method: 三条只读 SQL——(a)
  `SELECT external_reference FROM workflow_instances WHERE external_reference LIKE '%canary%'`；
  (b) `SELECT count(*) FROM workflow_instances WHERE created_by_principal_id='d5b3aeb2-e754-49a9-9914-b963521c0985'`；
  (c) `SELECT count(*) FROM workflow_node_visits WHERE assignee_principal_id='d5b3aeb2-e754-49a9-9914-b963521c0985'`
- Result: (a) 0 行；(b) 0；(c) 0
- Provenance: 本轮 shell 记录；census SQL 形状沿用 recovery candidate
  `census.py` 的只读投影纪律（非秘密列、排序、fail-closed）

### OBS-CA-003 — canary principal active

- Subject: auth-service 生产 API（127.0.0.1:4001）
- Environment: 生产只读查询（lookup-principal）
- Observed at: 2026-09-01（authoring 轮）
- Method: principal lookup by `agent_id = agt_build-in-public-agent`
- Result: `principal_id = d5b3aeb2-e754-49a9-9914-b963521c0985`；
  `status = active`；display_name `Build in Public 主理人`
- Provenance: 本轮 API 查询记录；与 prep evidence [B] 一致

### OBS-CA-004 — Grant 证据基线与逐行 census 边界

- Subject: audience `svc-workflow` 的 `workflow.execute` grant 供给
- Environment: accepted authority 记录 + 2026-09-01 aggregate census
- Observed at: 2026-08-28（STATE-006）/ 2026-09-01（OBS-REC-005）
- Method: authority 文献核对；本轮补充尝试逐行 fresh census
- Result: accepted Capability Authority STATE-006 冻结
  `agt_build-in-public-agent`（`mc_ohDTyGYRpBLI4qN_sVU88aob`）与
  `agt_hr-agent` 持有 `{workflow.read, workflow.execute}` v2 grant；
  recovery Authority OBS-REC-005 记录 2026-09-01 生产 185 active
  `workflow.execute` grant / 98 active principal、最大 update 时间早于部署窗。
  本轮逐行 census 受阻：auth `.env` 0600 authsvc uid505 不可读（零 sudo）；
  compose 默认库 `agent_dev_center` 无 auth 表；66 库只读探测（svc_wf 可达
  范围内）无 `machine_access_grants`
- Limitation: aggregate 计数不逐行证明默认 identity 当前行仍存在——该缺口
  由 CTR-CA-002 G0 census + CTR-CA-004 W2 token claims 断言在执行轮收敛
- Provenance: Capability Authority §4 STATE-006；recovery Authority §5
  OBS-REC-005（PR #134 comment `5486244042`）；本轮 shell 记录

### OBS-CA-005 — 写闸门 exact-key 现状

- Subject: `/Users/yanfenma/.local/services/svc-workflow/.env` 的
  `AUTH_V1_*` 键
- Environment: 生产 svc-workflow dotenv（owner-readable，exact-key grep，仅
  输出非秘密配置键值）
- Observed at: 2026-09-01（authoring 轮）
- Method: `grep -E "^AUTH_V1_CANARY" <dotenv>`
- Result: `AUTH_V1_CANARY_ENABLED=true`；
  `AUTH_V1_CANARY_WRITE_ENABLED=true`；`AUTH_V1_CANARY_ALLOWED_SUB` 缺席；
  `AUTH_V1_CANARY_ALLOWED_CLIENT_ID` 缺席
- Provenance: 本轮 shell 记录；与 prep evidence [A]、recovery Authority
  STATE-REC-003 一致（true 为事件中间态，recovery 轨道恢复 false）

### OBS-CA-006 — 生产运行时只读姿态

- Subject: live `workflow.js` 与两服务健康
- Environment: 生产（只读）
- Observed at: 2026-09-01（authoring 轮）
- Method: `git hash-object` live 文件；`curl` 127.0.0.1:8790/health 与
  127.0.0.1:8989/healthz
- Result: live blob = `577c8778cf35810ce7538aff52ab354e0c1dddc6`（20058
  bytes，`-rw-r--r-- root wheel`，mtime 2026-09-01 07:09）；
  Broker `{"ok":true,…}`；svc-workflow `{"status":"ok"}`
- Limitation: 并行 recovery/redeploy 轨道进行中，该事实随时间衰减——G0
  必须 fresh 重证（CTR-CA-002）
- Provenance: 本轮 shell 记录

### OBS-CA-007 — prep-v2 证据与 BLOCKER 边界

- Subject: canary-prep-v2 轮交付物与两个 BLOCKER 的归属
- Environment: docs evidence
  `docs/evidence/workflow-execute-canary-prep-v2-20260831/` + 报告
  `docs/reports/agt-core-workflow-execute-canary-prep-v2.md`
- Observed at: 2026-08-31（prep 轮）；本轮复读
- Method: 文献核对
- Result: (a) provisioning runner（sha256
  `f7d39de934088e3d70bd3f710a653f9feef55b011bc68a9e271e7543a92b7438`）
  离线验证通过、owner sudo command 待执行；(b) fixture 设计冻结值见 §3；
  (c) BLOCKER-1（sealed combined-deploy runner 内嵌 canary 程序读错 detail
  结果形状）与 BLOCKER-2（canary 身份对 workflow-todo-dogfood 非
  DOMAIN_OWNER ⇒ 分页 403）**均属 combined-deploy runner 的扩展步**
  （域分页遍历 / control-instance 深比较 / replay），**均不属于 Capability
  Authority CTR-009 的 A/B/C/D 验收流**——SPEC 级 canary 不做分页、不做
  control 深比较、不做 replay，两 BLOCKER 不阻塞本 Authority 的最小语义；
  (d) canary principal 在 workflow-todo-dogfood 为 enabled DOMAIN_MEMBER，
  创建实例即成为 entry 节点 exact assignee（无需 DOMAIN_OWNER）
- Provenance: prep 报告 §1–§6 + production-posture-read-only.txt [C]/[D]/[f]

### OBS-CA-008 — 父 Authority 的授权位冻结

- Subject: Capability Authority CTR-009 与 Deployment Authority
  CTR-HD-005/006
- Environment: origin/main @ `840d2f4`（本轮 authoring base；两文件与各自
  acceptance 坐标一致）
- Observed at: 2026-09-01（authoring 轮）
- Method: `git show origin/main:<spec>` 逐条核对
- Result: CTR-009 = design-only，执行须 Owner 单独下令，默认 canary
  identity = `agt_build-in-public-agent`，任意时刻至多一个 canary identity，
  验收流 G0→A→B→C→D、失败即停、全局 abort = gate false；CTR-HD-005 冻结
  `CANARY_EXECUTION_AUTHORIZED = NO`、`WRITE_GATE_REQUIRED_STATE = false`；
  CTR-HD-006 链把 canary 列为部署审计之后的独立 Owner 授权事务
- Provenance: 本轮 `git show` 记录

## 6. Claims and assumptions

- `CLM-CA-001` — 默认 identity 无需任何 Grant 变更即可执行 canary。
  Support state: SUPPORTED（`EVD-CA-001`）。Uncertainty：当前时点逐行
  grant 行的新鲜度——由 G0 census + W2 token claims 断言收敛（合同风险，
  非假设）。
- `CLM-CA-002` — 不存在任何可被 canary principal 读取的既有实例，专用
  fixture 必须由 owner 执行的 audited provisioning 路径新建；真实业务实例
  永不替代。Support state: SUPPORTED（`EVD-CA-002`）。
- `CLM-CA-003` — Capability Authority CTR-009 的 A/B/C/D 流不要求分页 /
  control-instance / replay，因此 prep 轮记录的 BLOCKER-1/2 不阻塞本
  Authority 的最小 canary 语义。Support state: SUPPORTED（`EVD-CA-003`）。
- `CLM-CA-004` — 写闸门 + allowlist 三层 fail-closed 闸门（Capability
  Authority CTR-009）足以把单窗口有效面收窄到单一 canary identity，且
  终态恢复 false / allowlist 缺席可被只读证明（含无鉴权负向探针 403
  `canary_read_only`）。Support state: SUPPORTED（`EVD-CA-004`；负向探针
  语义在 recovery Authority CTR-REC-005 同一 runtime 上有先例坐标）。
- `ASM-CA-001` — 并行 recovery/redeploy 轨道收敛后，生产满足
  「live blob == `577c8778…` + catalog 含 workflow_transition + count 15 +
  gate false」。Support state: OPEN_ASSUMPTION（本轨不依赖其过程；该假设
  不改变本 Authority 的 Decision/Contract 含义，仅定义 G0 的通过条件——
  不满足即 G0 FAIL = STOPPED，不产生任何生产写）。
- `ASM-CA-002` — svc-workflow 端点合同向后兼容（继承 Capability Authority
  ASM-001 的 stable-codes 纪律；破坏性变更须回 Capability Authority AMEND，
  本 Spec 随之失效或修订）。Support state: OPEN_ASSUMPTION（同上，仅定义
  G0/W 步的判定输入）。

无 OPEN_ASSUMPTION 改变权威或合同含义：两个假设都被 G0 的 fresh 只读核查
收敛为「通过条件」，不满足时 fail-closed 停止，不产生生产行为。

## 7. Evidence relations

- `EVD-CA-001` — Source: `OBS-CA-003`、`OBS-CA-004`。Target:
  `CLM-CA-001` / `STATE-CA-002`。Relation: SUPPORTS。Bound coordinates:
  auth-service 生产 API 2026-09-01；STATE-006 @ 2026-08-28；aggregate
  census @ 2026-09-01。Strength: 强（active principal + accepted 冻结记录 +
  aggregate 供给）。Limitations: 逐行新鲜度（→ G0/W2）。
- `EVD-CA-002` — Source: `OBS-CA-001`、`OBS-CA-002`、`OBS-CA-007`。Target:
  `CLM-CA-002` / `STATE-CA-001`。Relation: SUPPORTS。Bound coordinates:
  生产 svc-workflow DB 2026-09-01。Strength: 强（三向零行 + visibility
  分类事实）。Limitations: 无（append-only 语义下 census 只会漏报存在，
  不会漏报缺席——本结论方向为「缺席」，不受影响）。
- `EVD-CA-003` — Source: `OBS-CA-007`、`OBS-CA-008`。Target: `CLM-CA-003`。
  Relation: SUPPORTS。Bound coordinates: prep evidence 2026-08-31；CTR-009
  text @ origin/main `840d2f4`。Strength: 强（CTR-009 文本不含分页/control/
  replay 步）。Limitations: 若执行轮 plan 自行加回扩展步，须先过双审计且
  不在本 Authority 最小语义内（CTR-CA-009 禁止扩大）。
- `EVD-CA-004` — Source: `OBS-CA-005`、`OBS-CA-008`、recovery Authority
  `CTR-REC-005`（403 `canary_read_only` 负向探针语义）。Target:
  `CLM-CA-004` / `STATE-CA-003`。Relation: SUPPORTS。Bound coordinates:
  dotenv 2026-09-01；canary_guard 源坐标见 Capability Authority CTR-009。
  Strength: 强（闸门机制已被两 accepted authority 与 prep evidence 三方
  记录）。Limitations: 终态证明须执行轮 fresh 产出。

## 8. Decisions

- `DEC-CA-001` — **canary 语义 = CTR-009 A/B/C/D 的最小生产执行**：
  G0 只读前置 → A 读 detail（V + 出口）→ B 恰好一次 `workflow_transition`
  提交 → C 重读 detail → D 只读 SQL 回执复核。**不包含**分页遍历、
  control-instance 深比较、replay 断言（combined-deploy runner 的扩展面，
  携带 BLOCKER-1/2，ALT-CA-004 否决）。Decision owner: mayf3。Reason:
  最小变更面 + 与 Capability Authority 验收流逐字对齐 + 规避已记录的
  扩展面缺陷。
- `DEC-CA-002` — **默认 canary identity = `agt_build-in-public-agent`**
  （CTR-009 默认；principal `d5b3aeb2…`；client
  `mc_ohDTyGYRpBLI4qN_sVU88aob`）；任意时刻至多一个 canary identity；
  **只复用、不新建、不修改**任何 Grant（DEC-005 / CTR-007 红线）。
  Decision owner: mayf3（依 CTR-009 默认值）。Rejected alternative:
  新建专用 canary principal / 借道 `agt_hr-agent`（ALT-CA-002）。
- `DEC-CA-003` — **专用可丢弃 fixture 是唯一 canary 对象**：prep-v2 冻结
  方案（§3 fixture 坐标）为默认；provisioning 只能经 owner 执行的 audited
  runner（prep-v2 形态或具有新 provenance 的后继）；缺口时执行轮显式
  OWNER 通知，**绝不**以真实业务对象替代。Decision owner: mayf3。
  Rejected alternative: 选用既有业务实例（ALT-CA-001）。
- `DEC-CA-004` — **写闸门单窗口 + 安全终态**：闸门只在唯一 sealed
  transaction 内、由 Owner 明令打开（true + allowlist 收窄到恰好 canary
  identity 的 sub 与 client_id）；transition 完成或任何失败后**必须**恢复
  gate = false 且 allowlist key 缺席，并以无鉴权负向探针（403
  `canary_read_only`）+ effective-runtime 只读证明；**任何**路径（含失败、
  信号、崩溃恢复）都不得以 true 终态收场。Decision owner: mayf3。
  Rejected alternative: canary 后保持 true 以便后续 rollout（ALT-CA-005）。
- `DEC-CA-005` — **独立 seal / 双审计 / Owner osascript 授权链，与 recovery
  同构但独立 ID**：采用两 manifest 层（Layer-1 transaction inputs → `D1` →
  五文件 authorization envelope → Layer-2 content manifest → `D2` → detached
  `CANDIDATE_SEAL.json` → 外部 `candidateSealSha256`）的同一图形状与构造
  顺序；seal schema 名为专用 `AGENT_CORE_CANARY_CANDIDATE_SEAL_V1`；
  candidate / transaction / attempt / receipt 全部使用独立新 ID 与专用路径
  class，**零复用** recovery 或 deployment 的 candidate、seal、receipt、
  root stage 与事务授权。Decision owner: mayf3。Rejected alternative:
  复用 recovery 事务 ID / artifacts（ALT-CA-006）。
- `DEC-CA-006` — **失败即停、零自动重试、边界不扩大**：任一 gate / 断言 /
  审计 / 授权步失败或 UNKNOWN ⇒ STOP（恢复安全终态后通知 OWNER）；
  禁止第二次 transition、第二次授权对话框、自动 CAS 重试、扩大 scope。
  Decision owner: mayf3。
- `DEC-CA-007` — **Authority 形式 = 新增 governing Spec + 标准 lifecycle
  flip 事务**（与 Deployment Authority §15 同构）：提案态
  `proposed / none / none`；独立「试跑 审计」PASS 后由 Owner 以 ONE
  commit / ONE file 的 lifecycle-only 事务翻转
  `implementation_authority: none → contracts` 与
  `production_apply_authority: none → contracts` 并写入 acceptance record。
  不发明 schema 未定义的 frontmatter 字段。Decision owner: mayf3。

## 9. Contracts

### CTR-CA-001 — Authority 唯一性、lifecycle 与角色独立性

本 Spec 是 `workflow_execute_canary_v1` 生产执行的**唯一** canary Authority
（Deployment Authority CTR-HD-006 链的 `CANARY_EXECUTION_AUTHORITY` 环）。
提案态（本文件）不授权任何实现、构建、provisioning 或生产动作。激活只有
一条受控路径：独立「试跑 审计」对完整 reviewed head 给出 PASS verdict →
Owner（mayf3 或 PR 内显式授权 maintainer）执行 ONE commit / ONE file 的
lifecycle-only acceptance 事务（`status: proposed → accepted`、
`implementation_authority: none → contracts`、
`production_apply_authority: none → contracts` + acceptance record）→
merge to main → 从 exact accepted main commit 重读。激活后角色 MUST 互异：

```text
Canary Authority Author（本轮）
Canary Authority Reviewer（试跑 审计）
Canary Build Agent（fixture provisioning 后继 runner / canary candidate 构建）
Canary Transaction Reviewer（same-seal 双审计之一）
Production Boundary Reviewer（same-seal 双审计之二）
Release Gate Reviewer（第三个独立 reviewer，发布外部 Gate record）
Root Transaction Executor（sealed root 事务执行体，经 Owner osascript 授权）
Post-Canary Runtime Reviewer / Post-Canary Boundary Reviewer（事后独立审计）
```

一次会话 MUST NOT 兼任不相容角色。任何 candidate 字节变化使双审计与 Gate
授权全部失效（须重建新 candidate）。

### CTR-CA-002 — G0 只读前置核查（全部 PASS 才继续；任一 FAIL/UNKNOWN = STOPPED，零生产写）

执行轮在**任何**授权对话框、fixture 写或 gate 变更之前，MUST 以 fresh 只读
方式证明以下全部条件并持久化证据（沿 recovery candidate `census.py` 的只读
投影纪律：非秘密列、排序、digest、fail-closed）：

1. Broker `/health` PASS；svc-workflow `/healthz` PASS；
2. live `workflow.js` Git blob == `577c8778cf35810ce7538aff52ab354e0c1dddc6`
   （regular、非 symlink、精确路径；preimage/target 身份均用完整 40-hex，
   禁短前缀）；
3. capability catalog 含 `workflow_transition`；operation 恰为 `submit`；
   `requiredScopes` 恰为 `["workflow.execute"]`；shipped manifest count = 15；
   model-facing 参数不含 `principalId` / `agentId` / `actor` / `assignee` /
   `idempotencyKey`（Deployment Authority CTR-HD-005 证明面复用）；
4. `AUTH_V1_CANARY_WRITE_ENABLED = false`（安全基线；非 false ⇒ STOPPED，
   交 recovery/部署轨道裁决，本轨不修改）且两 allowlist key 缺席；
5. 非秘密 grant census（machine_access_grants 活跃投影，含默认 canary
   identity 的逐行 `workflow.execute` 行）完成记录；canary principal
   `status = active`；若默认 identity 行缺失 ⇒ STOPPED + OWNER 通知
   （**不得**临时新建 Grant 或改用其他 identity 替代，除非 Owner 明令并
   走 Owner decision 记录）；
6. 专用 canary fixture 存在且冻结（canary config 存在；instance 处于
   entry 节点、非终态、visibility = full、exact assignee == canary
   principal、目标出口 transition_id 与 submission schema 与冻结值一致；
   `expectedWorkflowStateVersion` 取服务端当前值）；fixture 缺席 ⇒
   **STOPPED + 显式 OWNER 通知**（CANARY_PREREQ = MISSING 路径），绝不以
   真实业务对象替代；
7. 执行计划（canary plan）已按 CTR-CA-007 封印并过双审计与 Gate。

G0 全程零生产写、零 token、零授权对话框。

### CTR-CA-003 — 专用可丢弃 fixture 合同

canary 对象 MUST 是恰好一个专用可丢弃测试 Workflow instance：

- 携带 disposable 标记（默认 `externalReference =
  workflow_execute_canary_v1`，title 含 `CANARY … disposable fixture (do
  not process)` 类显式标记）；
- 由默认 fixture 方案（§3 冻结坐标）或经双审计的等价专用可丢弃替代构成
  ——替代必须仍满足：非业务 domain fixture / 入口节点创建者即 exact
  assignee / 单出口 ADVANCE 至 TERMINAL / 可满足 submission schema；
- provisioning 只能经 owner 执行的 audited provisioning runner（prep-v2
  runner `f7d39de9…` 或具有新 provenance 的后继；后继 MUST 保留 prep-v2
  的守卫形态：root-only phrase 交互、幂等 marker + external_reference 双
  通道、allowlist 缺席守卫、零 transition、零 reload、config 自校验）；
  runner MUST NOT 由本 Authority 的 authoring/review 轮执行；
- 可选 control fixture（`…_control`）若被后继 runner 一并创建，MUST 永不
  transition，且不计入单次 transition 预算；
- 本 Authority 禁止触碰任何真实业务 Workflow instance（读侧对照允许且仅
  允许只读）；禁止 create / cancel / revise / assistance / assignment 变更 /
  Definition 管理 / Coordinator 能力 / 手工 SQL 写（CTR-007 继承）。

### CTR-CA-004 — identity 复用合同（零 Grant 变更）

canary MUST 且只能以默认 canary identity（或 Owner 明令记录的替代既有
`workflow.execute` grant identity）执行，identity 只经 credential seam（token
`sub`）：

- 全程 MUST NOT 新建 / 修改 / 删除任何 grant、principal、client、credential、
  role（DEC-005 / CTR-007 / CTR-HD-005 `GRANT_ROLLOUT_AUTHORIZED = NO`）；
- token 获取后 MUST 断言 claims：`sub == d5b3aeb2-e754-49a9-9914-b963521c0985`、
  `client_id == mc_ohDTyGYRpBLI4qN_sVU88aob`、scopes 含
  `workflow.execute`（audience `svc-workflow`）——断言失败即 STOP；
- 任意时刻至多一个 canary identity（CTR-009）；
- 模型参数面保持 identity-neutral（CTR-002）：不得出现 / 透出任何 actor /
  principalId / assignee / onBehalfOf 字段；Idempotency-Key 只由 trusted
  Broker seam 生成（CTR-004 / DEC-003），执行面 MUST NOT 注入。

### CTR-CA-005 — 单次 transition 语义（V→V+1 一次，无重试）

按 CTR-009 A/B/C/D 执行，且加冻结：

- **A**：经 `workflow_instance_detail` 只读取得 `workflow_state_version = V`、
  当前节点出口 transition（`executable_for_actor` 仅 advisory，DEC-002）、
  `submission_schema`；冻结 `(instanceId, transitionDefinitionId, V,
  submissionPayload)`；
- **B**：恰好一次 `workflow_transition` 调用（恰好一个服务端 POST，一个
  trusted Idempotency-Key）。断言响应：`ok = true`、
  `workflowStateVersion == V + 1`、`eventSequence` 存在且非空、
  `currentNodeVisitId != sourceNodeVisitId`；
- **C**：重读 `workflow_instance_detail`：version == V+1、current node 为
  出口目标节点、新 node visit 与响应一致；
- **D**：只读 SQL 复核（只读账号 / 只读事务、零写）：`workflow_command_receipts`
  恰好一行新 receipt（command_type = transition、principal_id == canary
  principal、receipt_status 成功态）；`workflow_command_attempt_audits` 对应
  attempt 行；`workflow_events` 恰好一行新 event（`actor_principal_id` ==
  canary principal、`old_workflow_state_version == V`、
  `new_workflow_state_version == V + 1`、`transition_effect` 与 from/to node
  与冻结 transition 一致）；`workflow_submissions` 新行 + 新 terminal node
  visit（字段映射 = Capability Authority OBS-009）；
- **no retry**：任何失败（含 `workflow_state_version_conflict`、
  `idempotency_conflict`、`command_still_processing` 425、transport 失败、
  断言失败）MUST NOT 触发第二次 POST、第二个 idempotency key、自动 CAS
  重读重提（DEC-004 纪律在 canary 语境加强为绝对禁止——canary 不修复，
  只停止）；服务端同 key exact-replay 若因 transport 层 401 重试发生，
  属 CTR-004 既有语义，MUST 在回执中如实记录 replay 态且仍只算一次
  服务端 execute；
- canary 完成或失败后，fixture 停留其自然状态（成功 ⇒ entry→terminal
  TERMINAL 完成，自包含；不做反向 transition、不做清理写）。

### CTR-CA-006 — 写闸门单窗口与安全终态

```text
G0 基线         AUTH_V1_CANARY_WRITE_ENABLED = false；allowlist 缺席
窗口内（唯一）   gate = true 且 AUTH_V1_CANARY_ALLOWED_SUB = <canary sub>
                且 AUTH_V1_CANARY_ALLOWED_CLIENT_ID = <canary client_id>
                （恰好单一 identity 收窄；其余持 grant 者 fail-closed）
窗口内容        恰好 CTR-CA-005 B 步的一次 transition POST
终态（必达）    gate = false 且两 allowlist key 缺席
```

- 窗口开 / 关、allowlist 设 / 清只能在唯一 sealed root transaction 内按
  封印顺序执行；dotenv 编辑遵守 recovery Authority CTR-REC-005 同型的机械
  纪律（fresh same-directory sibling、唯一精确值替换、全文件 digest 校验、
  uid/gid/mode/ACL/xattr 保存、fsync + 原子 rename + 目录 fsync、svc-workflow
  精确 controller 重启证明、旧 PID 退出 / 新 PID 唯一、health PASS、
  effective gate 只读复核）；
- 终态证明 MUST 包含一次无鉴权、无重试、无重定向的负向探针（transitions
  路由 POST，2 秒上限）：passing = HTTP 403 且 JSON code
  `canary_read_only`，且 DB 零 delta；
- 任何路径（B 步失败、断言失败、信号、崩溃、授权取消）都 MUST 收敛到
  gate = false / allowlist 缺席；**绝不允许**以 true 或 allowlist 残留收场
  （含失败回滚路径）；一旦恢复 false，MUST NOT 为「补做」再打开（重开 =
  新的 Owner 明令 + 新的事务与审计）。

### CTR-CA-007 — 独立 seal / 双审计 / Owner osascript 授权链（与 recovery 同构、独立 ID）

执行载体 MUST 是一个新 sealed canary candidate，采用 recovery Authority
CTR-REC-007 冻结的同一图形状与构造顺序（Layer-1 members → canonical
`TRANSACTION_INPUT_MANIFEST` → `D1` → 五文件 authorization envelope
（`AUTH_REQUEST.json` / `AUTH_LAUNCH.applescript` + `.sha256` /
`ROOT_BOOTSTRAP.sh` + `.sha256`）→ canonical `CANDIDATE_CONTENT_MANIFEST`
→ `D2` → detached `CANDIDATE_SEAL.json` → 外部 `candidateSealSha256`），
并满足其 canonical 序列化 / 路径 / 类型 / digest 无环规则，但**专用化**：

- seal `schema` = `AGENT_CORE_CANARY_CANDIDATE_SEAL_V1`；seal 固定坐标绑
  本 Spec ID、accepted Spec commit、canary track ID、fixture / identity /
  gate / allowlist / config 冻结值、canary plan 与回执路径；
- candidate / transaction / authorization attempt / root transaction /
  receipt 使用独立新 ID 与专用路径 class（如
  `/Users/yanfenma/workspace/deployment-artifacts/<canary-candidate-id>/`、
  `/var/root/agent-core-transactions/<canary-transaction-id>/`、
  `/usr/local/libexec/agent-core/.deploy-receipts/workflow-transition-canary-v1/<transaction-id>/`）；
  MUST NOT 复用、引用或依赖 recovery / deployment 的任何 candidate、seal、
  receipt、root stage 或其授权记录；
- 用户侧 candidate root 0700、非 /tmp；root stage root-owned 0700；特权
  执行零 /tmp 解释 / 展开 / 执行（CTR-HD-009 纪律继承）；
- 双审计（Canary Transaction Reviewer + Production Boundary Reviewer）对
  同一 `(D1, D2, candidateSealSha256)` 独立复核：branch/断言全集、fixture
  冻结、identity/claims 断言、gate 窗口顺序、信号 / 部分写 / 崩溃窗口、
  回执、清理、排除面、seal-to-script 同一性；任一 REVISE ⇒ 拒绝该
  candidate、重建新 candidate；
- 第三个独立 Release Gate Reviewer 重算三值并持久发布外部 Gate record
  （绑定两审计身份与 verdict、`OWNER_GATE=ACCEPT`、
  `READY_FOR_OWNER_EXECUTION=YES`）；
- Owner 授权 = 恰好一次 crash-safe `/usr/bin/osascript` native
  authorization dialog（recovery Authority CTR-REC-013 同型纪律：
  预 spawn `REQUESTED_NOT_YET_TERMINAL` attempt record 持久化、唯一 attempt
  ID、invocation count = 1、取消 = `AUTHORIZATION_NOT_GRANTED` 零生产写、
  UNKNOWN = 通知 OWNER 并停止、崩溃后永不二次弹窗直至同事务 reconcile、
  密码材料零接触 chat/stdin/env/file/args/日志）；root bootstrap 从固定
  外部 Gate record 取 `candidateSealSha256` 并逐层重验 Gate → seal → D2 →
  envelope → D1 → payload 后才执行事务；
- root-owned 非秘密终态 receipt（绑定 transaction ID、accepted Spec
  commit、D1/D2/外部 seal digest、gate 向量、断言向量、census、PID、
  health、终态 gate=false + allowlist 缺席证明、canary outcome）；stdout
  永不作为权威终态。

### CTR-CA-008 — 审计完整性（服务端 receipt 是权威证据）

- canary 的每次服务端交互（成功 / 确定性失败 / replay）由 svc-workflow
  command receipt + attempt audit + submission / node visit / event 流水
  承载（Capability Authority OBS-009 字段映射）；Broker 侧零新审计存储
  （CTR-006）；
- canary 回执 / 报告 MUST 完整映射：caller principal（receipts.principal_id
  + events.actor_principal_id）、instance、transition（request_hash 覆盖 +
  transition_effect + from/to node）、before/after version（V / V+1）、
  result（receipt_status + response digest）、eventSequence、新 node visit、
  Idempotency-Key 前缀形态（不落 key 值本体）；
- 事后只读 SQL 审计（Post-Canary Reviewer）独立重算 D 步断言；
- 证据 MUST 非秘密：不得记录 clientSecret、token、dotenv 内容、credential
  材料、秘密列 / 秘密 hash 列。

### CTR-CA-009 — 失败即停与边界不扩大

- 任一 gate / 断言 / 审计 / 授权 / 运行时步骤失败、超时、输出截断、解析
  失败、权限拒绝或 UNKNOWN ⇒ 立即 STOP：先恢复安全终态（CTR-CA-006），
  再持久化非秘密失败证据并显式 OWNER 通知；
- MUST NOT：自动重试任何步骤、发起第二次 transition POST、第二次授权
  对话框、第二次 gate 窗口；扩大 fixture / identity / domain / scope；
  触碰真实业务对象；修改 Grant / principal / credential / role / product
  code；执行 create / cancel / revise / assistance / assignment / Definition
  管理 / Coordinator 动作；手工 SQL 写；在 canary 名义下做 fleet rollout；
- 「canary PASS」的表述面 MUST 限于：一次 transition 在专用 fixture 上
  成功且证据完整；MUST NOT 表述为 rollout 完成 / 写能力对 fleet 开放；
- 后续任何工作（第二次 canary、扩大 identity、Grant rollout、能力修正）
  = 新的独立 authority / Owner 事务。

### CTR-CA-010 — Authoring 边界与文件不可修改性

本轮（试跑 授权）MUST docs-only：恰 2 个 docs 文件（本文件 +
`docs/specs/README.md` 索引行）+ Draft PR；零产品代码、零 fixture、零
provisioning、零 token、零 gate / allowlist 变更、零 Grant 变更、零
sudo / osascript、零生产写（本轮生产访问全部只读：DB census、API 查询、
dotenv exact-key 读、live blob hash、health 探测）；零 secret 值与
credential digest；PR 正文 MUST 声明 docs-only 与 CANARY_PREREQ 结论。
后续执行轮 MUST NOT 修改本文件或两父 Authority 文件
（GOVERNING_SPEC_UNMODIFIED）；对本文件的任何变更只能走独立评审的
AMEND / SUPERSEDE docs-only 事务。

## 10. Acceptance

> ACC-CA-002..010 为 accept 后各执行轮的验收映射（runtime/manual evidence
> 型，原因：所验证的 Contract 约束未来 canary 执行轮，authoring 轮无法产生
> 其证据；每项绑定 CTR-HD-006 链中确定的角色）。

- `ACC-CA-001` — 本 Spec 自身（本轮）：docs-only authoring PR，恰 2 个
  docs 文件；base = origin/main `840d2f4…`；governance verifier（vendored
  bytes == lock）、structure verifier（vs origin/main）、frontmatter schema
  校验、Contract↔Acceptance 双向覆盖、`git diff --check`、docs-only scope、
  secret scan 全部 PASS。Contracts: `CTR-CA-010`。Method: 本轮验证 battery。
  Failure: 任一 verifier 非 PASS 或 diff 含非 docs 路径。
- `ACC-CA-002` — G0 全量 fresh 只读核查：七项条件逐一 PASS 并持久化（含
  默认 identity 逐行 grant 行与 fixture 冻结值）；任一 FAIL/UNKNOWN ⇒
  STOPPED 零生产写。Contracts: `CTR-CA-002`。Method: 执行轮 G0 输出 +
  Post-Canary 复核。Failure: 条件缺失仍继续，或 G0 期间发生任何写。
- `ACC-CA-003` — fixture 专用性与可丢弃性：恰好一个 canary instance 带
  disposable 标记；provisioning 幂等重跑零新实例；无任何业务 instance 被
  写。Contracts: `CTR-CA-003`。Method: provisioning 回执 + 前后 DB census。
  Failure: 出现第二个 canary instance、标记缺失或任何业务行 delta。
- `ACC-CA-004` — identity 复用零 Grant delta：前后非秘密 grant census
  byte-identical；token claims 断言（sub / client_id / scope）PASS；参数面
  identity-neutral。Contracts: `CTR-CA-004`。Method: census digest + claims
  解码记录。Failure: grant/principal/credential 任何 delta 或 claims 不符。
- `ACC-CA-005` — 单次语义：恰好一个服务端 POST / 一个 key；B/C/D 断言全
  PASS（V+1、eventSequence、node visit 变更、D 步 SQL 行存在且映射正确）；
  失败注入（CAS conflict / 425 / transport 断连 / 断言失败）演练均零二次
  POST。Contracts: `CTR-CA-005`。Method: 事务回执 + 只读 SQL 独立重算 +
  离线失败矩阵。Failure: 第二次 POST、任何断言缺失或失败后继续。
- `ACC-CA-006` — 闸门窗口与终态：窗口前 false/缺席 → 窗口内 true+单一
  allowlist → 终态 false/缺席，全程有序留痕；负向探针 403
  `canary_read_only`；失败路径（含注入）均收敛 false。Contracts:
  `CTR-CA-006`。Method: dotenv 全文件 digest 前后比对 + 探针 + census。
  Failure: 任一时刻窗口外为 true、终态残留 allowlist、或探针非 403。
- `ACC-CA-007` — seal/审计/授权链独立性与完整性：两 same-seal 审计 + Gate
  record + 恰好一次 osascript attempt 全部对同一 `(D1,D2,seal)` 成立；
  独立 ID 与专用路径 class；无 recovery/deployment artifact 复用；崩溃/
  取消演练零二次弹窗。Contracts: `CTR-CA-007`。Method: 独立重构 D1/D2/
  seal + attempt/census 记录审计。Failure: ID/artifact 复用、seal 漂移、
  二次弹窗、post-Gate 生成特权输入。
- `ACC-CA-008` — 审计完整性回执映射：receipt/event/attempt/submission/
  visit 字段映射齐全且非秘密；独立只读重算一致。Contracts: `CTR-CA-008`。
  Method: Post-Canary SQL 审计。Failure: 字段缺失、映射错误或出现秘密。
- `ACC-CA-009` — 失败即停：失败矩阵（G0 FAIL / B 失败 / C 断言失败 / D
  不一致 / 授权取消 / 授权 UNKNOWN）全部产生 STOPPED + 安全终态 + OWNER
  通知，零重试零扩大。Contracts: `CTR-CA-009`。Method: 离线注入 + 执行轮
  记录。Failure: 任何自动重试、scope 扩大或以 true 收场。
- `ACC-CA-010` — 文件不可修改性：执行轮 diff 不含本文件与两父 Authority
  文件。Contracts: `CTR-CA-010`。Method: 各轮 `git diff --name-only` 核对。
  Failure: 任一 authority 文件出现在执行轮 diff。
- `ACC-CA-011` — Authority 形式合法、lifecycle 受控与角色独立：frontmatter
  通过 vendored schema；提案态字段 = proposed / none / none；激活严格走
  「试跑 审计 PASS → Owner ONE commit / ONE file lifecycle-only acceptance
  事务 → merge → exact accepted main 重读」单一路径；八个角色互不同源
  （含双审计 + Gate + Owner 相互独立）；candidate 字节变化使审计与 Gate
  授权失效。Contracts: `CTR-CA-001`。Method: PR/merge 拓扑、acceptance
  record、角色矩阵与 seal 图时间线核对。Failure: 未审计即 flip、角色复用、
  或出现任何未经 §15 事务的「已授权」声称。

## 11. Alternatives and disposition

- `ALT-CA-001` — 以既有真实业务 Workflow instance 做 canary 对象：**否决**
  （DEC-CA-003）——污染真实业务状态，违反 CTR-007 写红线与「绝不污染真实
  业务 Workflow」的 track 冻结语义。
- `ALT-CA-002` — 新建专用 canary principal / 为其他 Agent 临时授
  `workflow.execute`：**否决**（DEC-CA-002）——违反 DEC-005 / CTR-005
  （CTR-HD-005）Grant 红线；默认 identity 已有合法 grant，零变更可用。
- `ALT-CA-003` — 多次 transition / 自动重试增强置信：**否决**（DEC-CA-006
  / CTR-CA-005）——第二次写即 scope 扩大；服务端幂等与审计已提供单次证据
  足够性；重试掩盖「是否已生效」可见性（DEC-004 纪律）。
- `ALT-CA-004` — 直接沿用 combined-deploy sealed runner 的内嵌 canary
  程序（含分页 / control 深比较 / replay）：**否决**（DEC-CA-001）——携带
  已记录 BLOCKER-1（detail 形状错配）与 BLOCKER-2（DOMAIN_OWNER 分页 403）；
  且其扩展步超出 CTR-009 A/B/C/D 最小验收语义。
- `ALT-CA-005` — canary 后保持 gate = true 便于后续 rollout：**否决**
  （DEC-CA-004）——违反 CTR-HD-005 `WRITE_GATE_REQUIRED_STATE = false` 与
  本 track「gate 保持 false 直到 Owner 明令」冻结语义。
- `ALT-CA-006` — 复用 recovery 事务 / candidate / seal / receipt：**否决**
  （DEC-CA-005）——两轨道互不依赖；复用即把 canary 授权耦合到 recovery
  验收状态，且旧对象不可作为执行授权（CTR-REC-002 同理）。
- `ALT-CA-007` — 在 Capability Authority 上做 amendment 直接授予 canary
  执行权：**否决**（DEC-CA-007，同 ALT-HD-003 先例）——canary 执行是独立
  生产义务（NEW）；执行轮不可修改其 governing spec。

## 12. Migration, compatibility, and rollback

Not applicable（对本 Spec 自身：docs-only 新增，无数据 / 存储 / 部署迁移）。
执行轮的 containment / rollback 语义由 Contracts 承载：写闸门与 allowlist
的安全终态恢复 = CTR-CA-006；fixture 自然终态（TERMINAL）不做反向写 =
CTR-CA-005；失败即停 = CTR-CA-009。**唯一不可回滚物 = 那一次 transition
本身**：它是本 Authority 的目的与证据（在专用可丢弃 fixture 上），其存在
即预期终态，不需要也不允许撤销（撤销 = 第二次写，见 CTR-CA-009）；生产
Broker 文件与 svc-workflow 配置的回滚面属 Deployment / Recovery Authority
管辖，本 Authority 零触碰。

## 13. Open questions

```text
OPEN_OWNER_DECISIONS = NONE（接受/拒绝本 Authority 本身即是 Owner 的单一决策点；
  fixture provisioning command 的执行是 Owner 执行输入，已作为 G0 前置与
  OWNER 通知义务冻结进 CTR-CA-002/003，不构成遗留待决项）
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
PARTIAL_SUPERSESSION = NONE
```

非规范性后续（不改变 Decision / Contract 含义）：(a) BLOCKER-1 / BLOCKER-2
的修复归属 combined-deploy runner 轨道，与本 Authority 无关；(b) fleet
Grant rollout 节奏 = Capability Authority OQ-001，独立治理；(c) 若 Owner
要求第二次 canary 或扩大 identity，须新 authority。

## 14. Authoring result（2026-09-01，试跑 授权）

```text
SPEC_GOVERNANCE_MODE        = AUTHOR
SPEC_ID                     = AGENT_CORE_WORKFLOW_TRANSITION_CANARY_V1
SPEC_KIND                   = implementation
STATUS                      = proposed
AUTHORITY_LEVEL             = governing_spec
IMPLEMENTATION_AUTHORITY    = none
PRODUCTION_APPLY_AUTHORITY  = none
PRIMARY_PARENT_AUTHORITIES  = CAPABILITY + DEPLOYMENT（precedence 见 §3）
TRACK                       = WORKFLOW_TRANSITION_CANARY_V1（与 recovery 无关）
CONTRACT_COUNT              = 10
CONTRACTS_WITH_ACCEPTANCE   = 10
AUTHORING_READY_FOR_REVIEW  = YES
AUTHORITY_FORM              = NEW governing Spec（标准 lifecycle flip 事务；
                              零新造 frontmatter 语法）
FRONTMATTER_VALID           = YES（对 vendored spec-frontmatter schema 校验）
CANARY_PREREQ               = MISSING(dedicated disposable fixture 未
                              provisioning)；identity 侧 READY_WITH_BASIS
                              （见 §4 前置核查结论）
```

本轮边界：独立 clean worktree @ origin/main `840d2f4`（主 checkout WIP 原样
未动）；零生产写（生产访问全只读：svc-workflow DB 三向 census、auth API
principal 查询、dotenv exact-key 读、live blob hash、双服务 health、/tmp
config 缺席检查）；零 sudo / osascript；零 Grant / gate / allowlist /
fixture / token / transition 接触；不 merge、不代表 Owner 接受。

## 15. Authority activation（acceptance gate transaction 方案）

单一受控激活路径（与 Deployment Authority §15 / Capability Authority
§17 AMEND-3 同构）：

1. **本轮（authoring）**：docs-only Draft PR；lifecycle 零授权
   （proposed / none / none）。
2. **审计 gate**：独立「试跑 审计」轮（与 authoring 不同源）对完整
   reviewed head 给出 PASS verdict（binding：reviewed head pin、前置核查
   复核、fixture/identity 冻结值确认、CTR/ACC 双向覆盖、frontmatter
   schema、与两父 Authority 无冲突）。
3. **acceptance 事务**：Owner（mayf3 或 PR 内显式授权 maintainer）以
   ONE commit / ONE file 的 lifecycle-only 事务翻转 `status → accepted`、
   `implementation_authority → contracts`、
   `production_apply_authority → contracts` 并写入 acceptance record
   （reviewed head / verdict / 时间 / SEMANTIC_DELTA_AFTER_REVIEW = NONE）；
   reviewed semantics 逐字节保留；merge to main。
4. **激活后执行序（每环独立角色，CTR-CA-001）**：OWNER fixture
   provisioning command（若 fixture 仍缺席）→ Canary Build Agent（canary
   plan + sealed candidate）→ 双 same-seal 审计 → Release Gate → Owner
   osascript 单次授权 → sealed root transaction（G0 fresh → gate 窗口 →
   A/B/C/D → 终态恢复 → receipt）→ Post-Canary 双审计。
5. **失败语义**：审计 REVISE / Owner 拒绝 ⇒ 回 proposed 修订或按
   SPEC_GOVERNANCE_V0 §8.4 记录 rejected disposition；执行失败 ⇒
   CTR-CA-009 停止 + OWNER 通知；任何状态本轮与执行失败都不产生超出
   CTR-CA-005 单次 transition 的生产变化。
