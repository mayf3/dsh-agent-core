---
spec_id: AGENT_CORE_HR_DISPATCHER_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: none
production_apply_authority: none
date: 2026-08-27
revision: r3（2026-08-27 修订：按 OWNER_RULING = DEDICATED_SYSTEM_AGENT_MODEL
  与跨仓 authority 拆分同步——RUN_AS 身份定性为**专用 system Agent**（有
  Agent definition / 最小运行目录 / 可由 Agent Core Scheduler 执行；不属于
  86 业务 fleet；无飞书 Binding；无 OpenClaw runtime），身份/Client/grant
  治理移交 auth-service Spec，角色授予治理移交 svc-workflow PR #14 终版
  （DUAL_GLOBAL_READER_MODEL：dispatcher 与 HR 主身份各获 GLOBAL_WORKFLOW_
  READER，双方不获 COORDINATOR），§2.3 协调点已解；dispatcher 权限面冻结
  workflow.read + agent.wake，workflow.execute/admin 与一切 scheduler scope
  FORBIDDEN。r2→r3 就地演进，无已发布语义损失。r3.1（2026-08-27
  dependency-DAG sync）：四 Spec 单向依赖链 31 → 14 → 83 → 87 定稿——
  #31 为根节点（去除全部反向 pin），#14 唯一依赖 #31，#83 唯一依赖 #14；
  本 Spec 为链尾，exact-pin 三份上游最终 head（#31 50b5ad3 /
  #14 83e14ca / #83 517ae95，同时修正 #31 / #83 两个 stale pin——
  旧 revision 见本修订 commit message）；姊妹 PR #86 关闭
  （SUPERSEDED_BY_PR_87）。零语义变更，
  纯依赖元数据修订。）
task_name: 调度 执行
task_type: DOCS_ONLY_SPEC_AUTHORING
scope:
  - Part A: 一条冻结的 Scheduler recurring job（workflow-dispatcher-hr-agent-v1，
    RUN_AS = 专用 workflow-dispatcher-hr-agent identity）与其唤醒路径（现有正式
    派发机制的受控暴露）合同
  - Part B: HR 有界 Scheduler 管理能力（五枚 broker local capability 工具，
    managed_by = workflow-dispatcher-hr）合同
  - 实现闭包（accept 后评审路径）：packages/broker、packages/scheduler、
    packages/production-runtime（wiring only）
governed_by:
  - docs/decisions/SCHEDULER_OCCURRENCE_OUTCOME_V2.md（D-007，accepted — Scheduler Current Authority）
  - docs/specs/SCHEDULER_TIMEOUT_OUTCOME_V1.md（accepted）
  - docs/decisions/AGENT_WORKSPACE_SESSION_MODEL_V2.md（D-006，accepted）
  - docs/specs/AGENT_CORE_WORKFLOW_BROKER_ERROR_PRESERVATION_V1.md（accepted
    via PR #68；实现已合入 main e40c140 / PR #82）
  - docs/specs/AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1.md（accepted — 凭据/身份供给）
external_authorities:
  # DAG apex (dependency chain, frozen: auth-service PR #31 -> svc-workflow
  # PR #14 -> dsh-agent-core PR #83 -> THIS Spec PR #87). This Spec is the
  # ONLY one allowed to exact-pin all three upstream final heads; no
  # upstream Spec pins THIS Spec's head (one-way DAG,
  # CIRCULAR_AUTHORITY_PIN_COUNT = 0).
  - repository: mayf3/svc-workflow
    authority_id: SVC_WORKFLOW_GLOBAL_WORKFLOW_READER_V1
    revision: 83e14ca12b5f02644455b06ccdc6a336dc7462ce
    relation: prerequisite_role_grant（proposed；唯一治理面 = 新
      GLOBAL_WORKFLOW_READER 只读角色 + 双授予（HR 主身份 UUID 已冻结；
      专用 dispatcher principal UUID 由 auth identity 建立后 amendment
      回填，回填前不得 role apply）；双方不获 COORDINATOR；受控代码修改
      （无 migration））
  - repository: mayf3/auth-service
    authority_id: AUTH_SERVICE_AGENTCORE_HR_DISPATCHER_IDENTITY_V1
    revision: 50b5ad313536f0f75382c06ebb56c38114b0db4a
    relation: prerequisite_identity（proposed；唯一治理面 = 专用 Principal/
      Client/exact grants（workflow.read + agent.wake；workflow.execute/
      admin 与一切 scheduler scope FORBIDDEN）/secret handoff/rerun NOOP/
      rollback）
  - repository: mayf3/dsh-agent-core（姊妹 Spec，未上 main）
    authority_id: AGENT_CORE_WORKFLOW_GLOBAL_INSTANCES_CAPABILITY_V1
    revision: 517ae95728dde41314ee4c9712530ad9f2b08a79（PR #83 最终 head）
    relation: prerequisite_capability（proposed；broker 只读能力 workflow_global_instances，
      对任意服务端合法调用者（GLOBAL_WORKFLOW_READER 或
      GLOBAL_WORKFLOW_COORDINATOR 凭据持有者）通用，与运行身份无关）
supersedes: []
superseded_by: null
owners:
  - repository-maintainers
---

# AGENT_CORE_HR_DISPATCHER_V1 — 专用 Workflow Dispatcher recurring job + HR 有界 Scheduler 管理能力

> 状态：**proposed**（r3.1——r3 + 2026-08-27 dependency-DAG sync：本 Spec 为
> 四 Spec 单向链 31 → 14 → 83 → 87 的链尾，唯一允许 exact-pin 三份上游最终
> head；无任何上游 Spec 反向 pin 本 Spec）。本 Spec 当前不授予任何实现、合并或 production apply 权限。
> `implementation_authority = none`；`production_apply_authority = none`。
> 本轮 **不创建 job、不修改生产 store、不部署、不授予任何角色/scope、不创建 PR**。
> NEXT_TASK = 调度 审计（independent review）。

## 0. 任务语境与一句话模型

### 0.1 身份模型（OWNER_RULING = DEDICATED_SYSTEM_AGENT_MODEL，冻结）

`agt_workflow-dispatcher-hr-agent` 是一个**专用 system Agent**：

```text
IS  （定性）  专用 system Agent：有 Agent definition；有独立 Auth
              Principal/Client（由 auth-service Spec 治理供给）；有最小
              运行目录（workspace）；无飞书 Binding；无 OpenClaw runtime；
              可由 Agent Core Scheduler 执行（本 Spec Part A 的宿主形态）。
IS-NOT（禁述）不得把它描述成：
              (a) 无 Agent lifecycle 的纯 service identity；
              (b) HR 主会话（agt_hr-agent）的别名；
              (c) 86 个业务 trusted fleet 中的第 87 个业务 Agent。
FLEET_IMPACT   86 业务 fleet roster 与全部 fleet identity byte-unchanged；
              dispatcher 是 fleet 之外的增量 system Agent。
```

权限面（与其他三份 Spec 的 authority 拆分共同冻结）：

```text
dispatcher（专用 system Agent）:
  ALLOWED    workflow.read + agent.wake（按现有正式 Router/agent-wake
             authority，§4 冻结的精确唤醒能力）+ GLOBAL_WORKFLOW_READER
             （只读角色，svc-workflow Spec 治理；DISPATCHER_GLOBAL_
             COORDINATOR = NO）
  FORBIDDEN  workflow.execute / workflow.admin / scheduler.manage（及一切
             scheduler scope——含 scheduler.read；R-A8）
HR 主身份（agt_hr-agent / dc702687-6515-4a2a-91ae-e572a9bbd766）:
  ALLOWED    GLOBAL_WORKFLOW_READER（最终模型：HR 主会话可手工只读查看
             全部 Workflow Domain，经通用工具 workflow_global_instances）
  FORBIDDEN  GLOBAL_WORKFLOW_COORDINATOR；任意 Scheduler 写权
  LATER-ONLY 封闭 managed-set Scheduler 五工具（list / get /
             update_schedule / pause / resume，Part B；scheduler.read +
             scheduler.manage 仅覆盖该有界面）
```

### 0.2 语境

OpenClaw 退役移除了统一 Workflow Dispatcher 的宿主（原
`com.openclaw.workflow-dispatcher` launchd daemon + `unified-dispatcher.py`，
每 30 分钟：扫描 → 为每个待处理实例动态创建 one-shot cron job 触发 assignee）。
生产 dsh-agent-core Scheduler（Scheduler V2，D-007 语义）已部署运行，生产 store
现恰含 1 个 stock canary job（§2.1）。

本 Spec 在 **dsh-agent-core Scheduler（唯一权威调度系统）** 上重建统一
dispatcher，并废弃旧模式的两件事：OpenClaw store 依赖、动态创建 job 触发。

```text
PART A — one recurring job, RUN_AS = dedicated identity
  workflow-dispatcher-hr-agent-v1 (every 30m, created DISABLED)
  → one fresh non-main Session per occurrence（D-006/D-007）
  → 专用 workflow-dispatcher-hr-agent identity 的 turn：
       workflow_global_instances 只读扫描（paginate to exhaustion）
       → 选出 active、non-terminal、需 Agent 处理的实例
       → roster 映射 current_assignee_principal_id → agt_* exact target
       → 经现有正式派发机制（AGENT_ROUTER_DELIVERY_V0 router.deliver）
         唤醒 exact Agent（fresh-session 幂等投递）
       → 回报 wakes / skips

PART B — five bounded tools (broker local capabilities, scope-gated)
  持有面 = 交互式 HR Agent（agt_hr-agent）；dispatcher identity 零 scheduler 写
  scheduler_list_jobs / scheduler_get_job          (scope scheduler.read)
  scheduler_update_schedule / scheduler_pause_job
  / scheduler_resume_job                           (scope scheduler.manage)
  → 只作用于 managed_by = workflow-dispatcher-hr 的 job（V1 冻结清单）
  → 写入仅经 Scheduler control ops（JobStore mutation seam / OwnerLock / lease）
  → 每次 mutation 必有 Receipt + runs.jsonl audit；rerun 幂等

FORBIDDEN（永久）: 恢复或修改 ~/.openclaw/cron/jobs.json；使用 OpenClaw cron；
手工编辑生产 jobs.json；给 HR 主会话（或任何 Agent）任意 Scheduler 写权限
```

## 1. Goal

1. 冻结 **一条 exact recurring job**（Part A）：id、**专用运行身份**、schedule、
   payload、delivery、retry 语义全部 pinned；由 operator/control-plane 创建。
2. 冻结 dispatcher 的 **唤醒路径**：唯一合法 agent→agent 触达 = **现有正式
   唤醒/派发机制**（`agentRouter.deliver`，AGENT_ROUTER_DELIVERY_V0，已 merge）
   经一层受控、scope-gated 的暴露直达；**零新派发语义**；结构性排除旧的
   「动态创建 cron job」模式。
3. 冻结 HR 的 **有界 Scheduler 管理能力**（Part B）：五枚工具、
   `managed_by = workflow-dispatcher-hr` 硬边界、schedule-only 更新、
   Receipt/Audit、幂等；**任意（非有界）Scheduler 写权限对包括 HR 主会话在内的
   一切 Agent 面永久禁止**。
4. 显式声明全部前置依赖（proposed 姊妹 Spec / 外部角色授予 / 专用 identity
   供给）与激活 gate 链，使实现与生产启用各自需要独立的后续授权轮次。

## 2. Authority chain 与前置 Gate 链

### 2.1 依赖事实（2026-08-27）

跨仓依赖 DAG（2026-08-27 sync 冻结，单向不可倒置）：

```text
mayf3/auth-service PR #31（AUTH_SERVICE_AGENTCORE_HR_DISPATCHER_IDENTITY_V1，根）
  → mayf3/svc-workflow PR #14（SVC_WORKFLOW_GLOBAL_WORKFLOW_READER_V1）
    → mayf3/dsh-agent-core PR #83（AGENT_CORE_WORKFLOW_GLOBAL_INSTANCES_CAPABILITY_V1）
      → mayf3/dsh-agent-core PR #87（本 Spec，AGENT_CORE_HR_DISPATCHER_V1，链尾）
```

本 Spec exact-pin 且仅 pin 三份上游最终 head（frontmatter `external_authorities`：
#31 @ 50b5ad313536f0f75382c06ebb56c38114b0db4a、
#14 @ 83e14ca12b5f02644455b06ccdc6a336dc7462ce、
#83 @ 517ae95728dde41314ee4c9712530ad9f2b08a79）；任何上游 Spec 均不 pin
本 Spec 的 head（CIRCULAR_AUTHORITY_PIN_COUNT = 0）。

| 依赖 | 状态 | 证据 |
|---|---|---|
| D-007 Scheduler 语义 | **accepted**（Current Authority） | decisions/SCHEDULER_OCCURRENCE_OUTCOME_V2.md |
| Scheduler V2 生产运行 | deployed；**生产 store = `/Users/authsvc/.agent-core/scheduler/jobs.json`**（V2，恰 1 job：stock canary `stock-daily-market-brief-001`） | docs/runbooks/deploy-scheduler-v2-production-v1.md §G3/G4（路径逐字冻结于 runbook）；本会话对 `/Users/authsvc/.agent-core/scheduler/` 直读 = permission denied（生产 505-private 隔离，预期）——本 Spec 一切生产 store 断言以 runbook + 任务冻结路径为准 |
| `agentRouter.deliver`（现有正式派发机制） | **merged**（AGENT_ROUTER_DELIVERY_V0） | packages/agent-router/src/index.js:741；`{requestId, agentId, sessionMode: 'main'\|'fresh', message}`；fresh = (agentId, requestId) 锁内 durable read-or-mint native session；返回 `{accepted, sessionId}` |
| notification-ingress `POST /v1/deliver`（同一机制的 HTTP ingress 形态） | merged | packages/notification-ingress/src/index.js:174 → router.deliver；含 idempotency。本 Spec 的受控暴露优先绑进程内 seam（§4），HTTP 形态不作为 Agent 工具面 |
| broker local capability 先例（scope 门禁 + trusted identity） | merged | packages/broker/src/capabilities/agent-definition.js（agent.definition.write）；gateway.js localHandlers `async (args, {agentId})`——caller 身份来自 Router spawn 关系，永不出自 call payload |
| `workflow_global_instances` broker 能力 | **proposed**（姊妹 Spec，PR #83 @ 517ae95728dde41314ee4c9712530ad9f2b08a79，base main e40c140） | AGENT_CORE_WORKFLOW_GLOBAL_INSTANCES_CAPABILITY_V1；能力对任意服务端合法调用者（READER 或 COORDINATOR 凭据持有者）通用，不绑定特定 principal |
| GLOBAL_WORKFLOW_READER 授予（dispatcher） | **proposed**（外部 svc-workflow PR #14 @ 83e14ca12b5f02644455b06ccdc6a336dc7462ce，DUAL_GLOBAL_READER_MODEL 终版）；授予对象 = 专用 dispatcher principal（UUID 由 auth identity 建立后 amendment 回填，回填前不得 apply）；HR 主身份同获 READER（手工只读查看）；双方不获 COORDINATOR | SVC_WORKFLOW_GLOBAL_WORKFLOW_READER_V1 §1/§6 |
| 专用 system Agent 身份（agt_workflow-dispatcher-hr-agent） | **不存在**（待供给）；Principal/Client/exact grants/secret handoff/rerun NOOP/rollback 由 auth-service Spec 独占治理 | auth-service PR #31 @ 50b5ad313536f0f75382c06ebb56c38114b0db4a（AUTH_SERVICE_AGENTCORE_HR_DISPATCHER_IDENTITY_V1，DAG 根节点——不 pin 任何下游 head）；本 Spec 治理其 Agent definition / 最小运行目录 / scheduler 执行面（G0 本侧部分） |
| agt_hr-agent（交互式 HR 助手）有效 grant 面 | machine_access_grants v1 = {forum.read, forum.write} + v2 = **{workflow.read, workflow.execute}**（auth-service 只读查询，2026-08-27；有效面是 grants 表，非 machine_clients.allowed_scopes 列） | mc_IuBMfCYe9-b522IhSWKBGjyz（active）——HR 主身份不得因此获得 coordinator / 直接扫描 / 任意调度写（§0.1） |

### 2.2 Gate 链（冻结；顺序不可跳跃）

```text
G0a 供给专用身份的 Auth 侧（auth-service Spec 独占治理，独立轮次）：
    Principal + Client + exact grants（workflow.read + agent.wake；
    workflow.execute/admin 与一切 scheduler scope FORBIDDEN）+ secret
    handoff（505-private trusted store，一次性）+ rerun NOOP 语义
    —— 见 AUTH_SERVICE_AGENTCORE_HR_DISPATCHER_IDENTITY_V1
G0b 供给专用身份的 Agent 侧（本 Spec 治理，同一独立轮次内）：
    agent definition 新增 agt_workflow-dispatcher-hr-agent（enabled，非
    default，不绑定任何人类入口/飞书）+ 最小运行目录（workspace）；
    无 OpenClaw runtime
G1  姊妹 Spec AGENT_CORE_WORKFLOW_GLOBAL_INSTANCES_CAPABILITY_V1
    accepted + 实现 merged + 部署于生产 lineage
G2  GLOBAL_WORKFLOW_READER 于 svc-workflow 生产 apply（外部 Spec
    PR #14 @ 83e14ca 独占治理，DUAL_GLOBAL_READER_MODEL 终版）；授予对象 =
    专用 dispatcher principal（其 UUID 已由 auth identity 建立并 amendment
    回填到该 Spec——apply 对 <PENDING> 无效）；HR 主身份的 READER 授予由
    同一外部 Spec 的 grantee-1 路径独立 apply；双方不获 COORDINATOR
G3  本 Spec accepted → §6 实现闭包按 GOVERNING_SPEC_UNMODIFIED 评审合并
    （实现 PR 不得修改本文件）
G4  部署侧 grant 精确形态（auth-service Spec §3 冻结 exact 集；此处仅引用）：
      dispatcher（专用 system Agent）：workflow.read（扫描）+ agent.wake
        （§4 暴露面）；零 scheduler scope（R-A8）
      agt_hr-agent：scheduler.read + scheduler.manage（仅五工具有界面）
    两者互不交叉：dispatcher 零 scheduler 写；HR 零扫描/唤醒
G5  operator 在专用 system Agent workspace 播种 dispatch 规则与 roster
    （§3.5；operator-governed，dispatcher 只读）
G6  operator 经 control-plane 在生产 store
    /Users/authsvc/.agent-core/scheduler/jobs.json 创建 §3.1 的 exact job
    （enabled=false；走 CLI/domain ops 的 mutation seam，绝不手工编辑文件）
    ——本轮不执行；创建本身是独立 operator 轮次
G7  operator 显式 enable（初始激活 = operator 动作，不经由 HR 工具 bootstrap）；
    其后的 pause/resume 才落入 HR 工具面
```

本 Spec 的 accept（G3）不蕴含 G0–G2/G4–G7 任何一项；反之亦然。

### 2.3 外部协调点（r3：已解，记录解法）

r2 存在的张力（外部 Spec 曾把 GLOBAL_WORKFLOW_COORDINATOR 冻结给 agt_hr-agent
principal，与本 Spec 的 RUN_AS=专用身份冲突）已由 OWNER_RULING =
DEDICATED_SYSTEM_AGENT_MODEL 的跨仓 authority 拆分**解决**：

- 授予对象 = 专用 system Agent 的 principal，角色 = GLOBAL_WORKFLOW_READER
  （只读，DUAL_GLOBAL_READER_MODEL 终版；svc-workflow PR #14 @ 83e14ca
  独占冻结；UUID 待 auth identity 建立后 amendment 回填）；
- 身份/Client/grant = auth-service PR #31 @ 50b5ad3 独占冻结；
- HR 主身份（含 legacy 谱系）零角色、零扫描权、零任意调度写（§0.1）。

无遗留协调点；两个外部 Spec 各自独立评审，本 Spec 不修改外部文件。

## 3. Part A — Dispatcher Job（exact definition）

### 3.1 冻结的 Job document

唯一合法创建路径：operator/control-plane 调度器 domain 操作 `createJobOp`
（`packages/scheduler/src/control.js`；`normalizeJob` 保留显式 string id），
或 `agentcore-cron add --store /Users/authsvc/.agent-core/scheduler/jobs.json`
等价 CLI 面（control-only，同 mutation seam），一次性写入以下
**byte-frozen** 定义（`createdAtMs/updatedAtMs/scheduleRevision` 由 store 机制
赋值，不属冻结内容）：

```json
{
  "id": "workflow-dispatcher-hr-agent-v1",
  "name": "Workflow Dispatcher (HR)",
  "description": "Unified workflow dispatcher on the dedicated workflow-dispatcher-hr-agent identity: global read-only scan + roster-mapped wake via the existing formal dispatch seam. Governing spec AGENT_CORE_HR_DISPATCHER_V1.",
  "agentId": "agt_workflow-dispatcher-hr-agent",
  "enabled": false,
  "schedule": { "kind": "every", "everyMs": 1800000 },
  "payload": {
    "kind": "agentTurn",
    "message": "<FROZEN_DISPATCH_PROMPT见§3.4>",
    "timeoutSeconds": 900
  },
  "delivery": { "mode": "none" },
  "deleteAfterRun": false
}
```

冻结裁定（rationale）：

- `id` = `workflow-dispatcher-hr-agent-v1`（任务冻结；非 UUID；重复 id →
  createJobOp fail loud）。
- `agentId` = `agt_workflow-dispatcher-hr-agent`：**RUN_AS = 专用
  workflow-dispatcher-hr-agent system Agent**（§0.1 DEDICATED_SYSTEM_AGENT_MODEL：
  有 Agent definition 与最小运行目录、可由 Agent Core Scheduler 执行；不属于
  86 业务 fleet；无飞书 Binding、无 OpenClaw runtime；G0a/G0b 供给），
  **不是**交互式 HR 助手 `agt_hr-agent`，也不是无 lifecycle 的纯 service
  identity。理由：(i) 任务指令逐字冻结专用身份；(ii) 职责分离——全局只读
  扫描 + 唤醒权落在非交互 system Agent 上，交互式 HR 主会话（人类聊天面）
  结构性地拿不到这些能力；(iii) 审计单一性——所有 dispatch occurrence 的
  凭据/轨迹归于一个专用身份。
- `schedule` = `every` / 30 分钟（历史 parity：原 launchd daemon 每 30 分钟；
  `anchorMs` 缺席 → 按 D-007 §3.4 以 `createdAtMs` 为 fallback anchor）。
  初始 cadence 低风险：schedule 正是 Part B 中 HR 唯一可改的字段。
- `enabled: false`：**创建即 disabled**。激活是 G7 的独立 operator 动作。
- `timeoutSeconds: 900`：分页全域扫描 + N 次唤醒的宽裕上限；D-007 语义下
  timeout-without-proof = outcome_unknown + 同 Job execution fence，过紧的
  超时会反复 fence 整个 dispatcher，故取宽。
- `delivery.mode = none`：dispatcher 是后台协调者；round 报告落在其 workspace
  与 runs.jsonl evidence，不进聊天渠道（与 LARK UX 冻结的 scheduler 投递
  语义无交集）。
- `retry` **缺席**：`AUTO_RETRY_DEFAULT = NO`（D-007 §7.5）。唤醒具有外部
  副作用（目标 agent turn），非幂等 Job 不自动 retry；下一 natural
  occurrence 30 分钟后自然到来。
- `deleteAfterRun: false`（recurring）。
- `lightContext` / `model` 缺席（不使用；规则文件由 dispatcher 按需 fs 读取）。

**payload.message 与 id/agentId/delivery 一样是冻结合同**：任何变更（含
operator 经 control-plane 的机械能力）= out-of-spec，需本 Spec AMEND；HR 工具面
（Part B）结构性无法触及 payload。

### 3.2 运行身份与 Session 模型（全部继承，零新语义）

- **RUN_AS 身份边界**：occurrence 的 invocation 走既有
  `scheduler-router` `createRouterInvoker`——`assertRunnable` 经
  agent-definition 校验 `agt_workflow-dispatcher-hr-agent` 存在且未 disabled，
  `router.ensureRunning` 拉起/复用其进程。本 Spec 不改 scheduler 引擎、不改
  Router、不引入第二 Agent lifecycle。
- 每次 occurrence = 该专用 Agent 的 **fresh non-main native Session**，同一
  primary Workspace、同一 credential/grants（D-007 §14 / D-006）。跨 round
  连续性只来自 Workspace 文件（roster、规则、MEMORY.md），不来自 session 复用。
- 扫描授权链：occurrence turn 内专用 identity 凭其 machine client
  （Broker-first：trusted store → client_credentials → scope `workflow.read`
  token）调用 `workflow_global_instances`；服务端
  global 只读角色双闸（目标契约：GLOBAL_WORKFLOW_READER OR
  GLOBAL_WORKFLOW_COORDINATOR；部署过渡：仅 COORDINATOR——姊妹 Spec DEC-004
  双码契约）。无角色时端点 403（`global_read_role_required` 或过渡期
  `global_coordinator_required`）——dispatcher 必须 fail-visible 报告，不得
  伪造扫描结果。

### 3.3 职责（duties）与红线

每个 occurrence turn 的职责边界：

1. **只读扫描**：`workflow_global_instances`（GET-only，姊妹 Spec DEC-005），
   以默认过滤（status=active）分页枚举到尽头（成对 cursor，姊妹 Spec DEC-002）。
2. **选择（冻结判据）**：目标实例 = 同时满足
   `active（默认 status 过滤命中）` ∧ `is_terminal = false` ∧
   `current_assignee_principal_id 非空且经 §3.5 roster 精确映射到 fleet
   agent`（= 「需要对应 Agent 处理的实例」的 V1 可判定形态）。其余 skip 并
   记因。
3. **唤醒**：对每个 (instance, mapped agent) 至多一次，**经现有正式唤醒/派发
   机制**（§4）通知 exact Agent。同一 round 内不重复唤醒同一实例；跨 round 由
   requestId 幂等合并（§4.2）。
4. **报告**：round 结束输出 wakes（instanceId → targetAgentId → requestId →
   accepted/sessionId）与 skips（unmapped principal / terminal / 扫描失败
   原因），写入自身 workspace 的 round 记录；evidence 归 runs.jsonl
   （occurrence 级）。

红线（normative；违反 = out-of-spec，审计可见）：

```text
R-A1  不修改 Workflow assignment / 任何 Workflow 写面。
      （结构保证：dispatcher 仅持 workflow.read；transitions/assignment 的写
      端点对其凭据保持服务端拒绝。）
R-A2  不修改 Domain（创建/配置/owner/成员关系一概不触及）。
R-A3  不直接写任何其他 Agent 的 Workspace。唤醒 = 且仅 = 经 §4 机制的消息
      投递（Router-owned admission）；目标 agent 的 turn 在其自己的 workspace
      里工作。
R-A4  不动态创建任意 cron job / scheduler job（旧 unified-dispatcher.py
      trigger_agent 的 one-shot job 模式正式退役；结构性保证：dispatcher
      identity 无任何 scheduler 写 scope，G4；§5 工具面也无 create）。
R-A5  不恢复、不读写、不修改 ~/.openclaw/cron/jobs.json，不使用 OpenClaw cron
      （任务级禁令，永久）。
R-A6  不手工编辑生产 jobs.json——本 Spec 一切 store 写入仅经 control ops /
      CLI 的 JobStore mutation seam（OwnerLock + 锁内重读 + 原子提交）；
      文件级 store 访问权属于 control-plane 与引擎（D-007 §10.4）。
R-A7  不修改 roster 与自身 dispatch 规则文件（operator-governed，§3.5）；
      dispatcher 只读并在 round 报告中提议变更。
R-A8  不持有任何 Scheduler 写权限（含五工具）：dispatcher identity 的
      credential 面只有 workflow.read + agent.wake（G4 冻结）；调度管理是
      HR 助手的有界面（Part B），不是执行者的。
```

R-A6/R-A7 为 normative 红线（agent 具备 shell 能力，物理上非不可绕过）：
执行依赖 prompt 纪律 + runs.jsonl/round 报告审计 + 独立审计轮（NEXT_TASK）。
部署侧可后续加文件系统加固，不在本 Spec 范围。

### 3.4 FROZEN_DISPATCH_PROMPT（payload.message，verbatim）

```text
Workflow dispatch round (workflow-dispatcher-hr-agent-v1).

1. Read your dispatch rules and roster from workflow-dispatch/ in this
   workspace (rules.md, roster.json). They are operator-governed: never
   modify them; propose changes in your round report only.
2. Enumerate active workflow instances via the workflow_global_instances
   tool, paginating to exhaustion (paired cursors). Never fabricate scan
   results; report any error (including 403 global_coordinator_required)
   and stop this round fail-visible.
3. Select instances that are active, non-terminal, and have a current
   assignee. Map current_assignee_principal_id to a fleet agent via
   roster.json (exact UUID match only; no fuzzy matching, no default
   agent). Unmapped or missing assignee = skip with reason.
4. Wake each mapped assignee agent at most once per instance through the
   agent_wake tool with requestId
   "wdhr1:<workflowInstanceId>:<targetAgentId>" and a message naming the
   workflow instance id, title and current node.
5. Boundaries (absolute): never modify workflow assignment or any
   workflow write surface; never modify domains; never write into
   another agent's workspace; never create cron or scheduler jobs; never
   use OpenClaw cron or touch ~/.openclaw; never read or edit the
   scheduler jobs.json file; you hold no scheduler tools at all —
   scheduling of this dispatcher itself is managed by others.
6. End the round with a structured report: woke (instance, agent,
   requestId, accepted), skipped (instance, reason), scan health.
```

（若姊妹 Spec 的工具名或参数名在评审中变更，本 prompt 同步 AMEND——两者是
同一合同的两侧。）

### 3.5 Roster 与目标解析（V1）

- 位置：**专用 identity primary workspace** 的 `workflow-dispatch/roster.json`
  （operator 播种、operator-governed；R-A7：dispatcher 只读，变更走 round
  报告提议 + operator）。
- 形态：`{ "principals": { "<principal-uuid>": "<agt_*>" } }` ——
  `current_assignee_principal_id` → fleet agent 的**精确 UUID 匹配**；
  无模糊匹配、无 default agent、无按名字猜测（同 D-007 §15.5 的
  missing-agent 纪律族）。
- 未映射 principal / 缺失 assignee → 该实例 skip 并记入 round 报告
  （fail-visible，不静默、不猜）。
- principal→agent 的治理化查询能力（如 auth-service principal lookup 的
  broker 化）不在本 Spec；引入时经 AMEND 替换 roster 文件机制。

## 4. 唤醒路径 — 现有正式派发机制的受控暴露（零新派发语义）

### 4.1 机制裁定（冻结）

**现有正式唤醒/派发机制 = `agentRouter.deliver`（AGENT_ROUTER_DELIVERY_V0，
已 merge）**：`{requestId, agentId, sessionMode, message}` → fresh-session
durable read-or-mint → `{accepted, sessionId}`。其 HTTP ingress 形态
（notification-ingress `POST /v1/deliver`）是同一机制的另一个 caller 面，不是
Agent 工具面。

dispatcher turn 需要一个**可调用的工具面**来触达该机制。本 Spec 冻结的暴露 =
一层最薄的 broker local capability（沿 agent.definition.* 先例），**只做转发，
不新增任何 admission/会话/幂等语义**——全部语义（session 选择、read-or-mint、
幂等、workspace 解析）由既有 Router deliver 拥有：

```text
id / toolName = agent_wake
local: { resource: 'agent-wake' }        # local capability：无 http binding，
                                         # gateway 模式经 localHandlers 执行
requiredScopes: ['agent.wake']           # 部署侧 exact-identity 仅授予
                                         # 专用 dispatcher identity（G4）
operation: wake
  args（严格校验，未声明参数 fail-fast invalid_arguments）:
    requestId     string  required   # 幂等键，形态 ^wdhr1:[0-9a-f-]{36}:agt_[a-z0-9-]+$
    targetAgentId string  required   # agt_* fleet agent id（exact）
    message       string  required   # 唤醒消息（含 workflow_instance_id 等）
  result: { accepted: true, sessionId: <native session id> }
declared errors:
  invalid_arguments / unsupported_operation / access_denied /
  unauthenticated / forbidden / agent_not_found / agent_disabled /
  agent_start_failed / internal_error
handler（冻结）: agentRouter.deliver({
  requestId, agentId: targetAgentId, sessionMode: 'fresh', message })
```

### 4.2 语义（冻结，全部继承自现有机制）

- **sessionMode 恒为 'fresh'**，永不 'main'：每次唤醒进入目标 agent 的
  fresh non-main native session（D-006 纪律；main session 不被后台调度污染）。
  暴露层不透出 sessionMode 参数（结构性防 'main'）。
- **幂等（结构性，来自 Router 既有实现）**：`requestId` 是 fresh-session
  mint 的 durable read-or-mint 键——同一 `wdhr1:<instanceId>:<agentId>` 的
  重复投递收敛到**同一个** session，不产生第二个唤醒。跨 round 唤醒同一
  实例+agent 时消息追加进同一 fresh session（per-(instance,agent) 连续线程
  语义；本 Spec 显式接受该连续性，不视为重复副作用）。
- **身份纪律**：caller 身份出自 broker trusted credential seam（gateway
  execute ctx 的 Router-decided agentId），`targetAgentId` 是且仅是投递目标
  参数，永不影响调用者身份/凭据/token subject（同姊妹 Spec CTR-003 族）。
- 授权：scope `agent.wake` 仅授予专用 dispatcher identity；无 grant →
  `access_denied`。暴露层对 Workflow/Scheduler 语义零理解（纯转发）。
- **禁止的替代路径**（不授权经此暴露层或任何 Agent 面达成唤醒之外的触达）：
  shell 直调 notification-ingress HTTP、直接 spawn 其他 agent 进程、经
  Feishu 通道冒充等——均 out-of-spec。

## 5. Part B — HR 有界 Scheduler 管理工具（五枚，合同冻结）

### 5.1 Capability 集与持有面

五枚 **broker local capability**（沿 agent.definition.* 先例；每枚一工具一
operation；id = toolName = 任务冻结名）：

| capability / toolName | operation | scope | 映射 |
|---|---|---|---|
| `scheduler_list_jobs` | `list` | `scheduler.read` | managed-set 投影（只读） |
| `scheduler_get_job` | `get` | `scheduler.read` | managed-set 单查（只读） |
| `scheduler_update_schedule` | `update_schedule` | `scheduler.manage` | `updateJobOp(store, jobId, { schedule })` |
| `scheduler_pause_job` | `pause` | `scheduler.manage` | `disableJobOp(store, jobId)` |
| `scheduler_resume_job` | `resume` | `scheduler.manage` | `enableJobOp(store, jobId)` |

- 读写两档均 `local: { resource: 'scheduler' }`；handler 由 control-plane
  组合层注入（§6），内部**只调用** `packages/scheduler/src/control.js` 既有
  domain ops——即 D-007 §11.1 mutation protocol。工具层不新开任何 store 写路径。
- **持有面裁定（V1）**：`scheduler.read` / `scheduler.manage` 仅授予交互式
  HR Agent `agt_hr-agent`（G4）——「HR 有界管理工具」的操作者。专用
  dispatcher identity **零 scheduler scope**（R-A8）。其他 84 个 fleet Agent
  零授予。
- **任意写红线**：五枚有界工具是 V1 中**唯一**对任何 Agent 开放的 Scheduler
  写面。任何「任意 Scheduler 写权限」（未受 managed-set/schedule-only/工具有
  界约束的写能力——含 HR 主会话经任何路径获得的能力）**不存在于任何授权面**；
  未来若需更宽的 Agent 写面 = 本 Spec AMEND + 独立评审，不得静默扩张。

### 5.2 Managed set（`managed_by = workflow-dispatcher-hr` 的 V1 表达）

```text
MANAGED_BY_LABEL = workflow-dispatcher-hr
MANAGED_JOB_IDS_V1 = [ "workflow-dispatcher-hr-agent-v1" ]
```

- **V1 不给 Job schema 加字段**（D-007 §3 冻结的真子集原样不动）：
  `managed_by = workflow-dispatcher-hr` 是本 Spec 层的 ownership 标签，其 V1
  外延 = 上述冻结清单，由 handler 层共享 guard 强制（任何 jobId ∉ 清单 →
  `job_not_found_or_not_managed`，且**不泄露**非 managed job（如生产 stock
  canary job）的存在性——同 `workflow_instance_not_found_or_not_visible`
  的单码纪律）。
- 清单扩张（新增 managed job）或迁移为 schema 字段 = 本 Spec AMEND；
  V1 内 HR 无 create/delete 工具，清单只能经 operator + AMEND 增长。
- `scheduler_list_jobs` 只返回 managed-set jobs（带 occurrence-derived
  projection 与 fence 状态）；全量 fleet job 列表不出现在 HR 工具面。

### 5.3 各工具合同

**scheduler_list_jobs** — args `{}`；返回
`{ jobs: [<publicJob 投影 + fenceSummary>] }`。仅 managed 集。

**scheduler_get_job** — args `{ jobId }`；返回单个投影。未知/非 managed →
`job_not_found_or_not_managed`。

**scheduler_update_schedule** — args `{ jobId, schedule }`（schedule 必须是
合法 V2 schedule 形态：cron 5-field / at ISO-instant / every 正 everyMs；
非法 → `invalid_arguments` fail-fast）。**patch 只含 `schedule` 一个键**——
工具 schema 不声明其他参数（携带 payload/agentId/retry/enabled 等任何额外
键 → `invalid_arguments`，store 不被触及）。内部
`updateJobOp(store, jobId, { schedule })`：真实 schedule 变更 bump
`scheduleRevision`（D-007 §5.2）；同值更新不 bump（既有 semanticChange
等值判定），仅 `updatedAtMs` 前进。

**scheduler_pause_job** — args `{ jobId }` → `disableJobOp`：阻止未来
occurrence mint；已有 occurrence evidence 与 fence 原样（D-007 §12.3）。

**scheduler_resume_job** — args `{ jobId }` → `enableJobOp`：只恢复**未来**
schedule eligibility；**从不清除 execution fence、从不补跑历史**
（D-007 §12.3 / §8.3）。job 处于 unresolved `outcome_unknown` fence 时，
resume 成功返回但 admission 仍被持有——receipt 的 job 投影必须显式携带
fence 状态（`fenceSummary`），HR 可见「已启用但仍被 fence 持有」。

### 5.4 Mutation 路径、Receipt / Audit（写入必有）

**Mutation 路径（冻结）**：生产 store =
`/Users/authsvc/.agent-core/scheduler/jobs.json`。五工具的一切写入经
handler → control ops → `JobStore.mutateDoc`——**同进程 FIFO mutex →
跨进程 OwnerLock（`<store>.lock`，owner-carrying，超时/失证 fail loud）→
引擎 lease 隔离（`acquireEngineLease`）→ 锁内重读最新 → 单增量 → fsync /
temp-write + atomic rename → 提交成功后才更新 RAM cache**。工具层不持有、
不缓存 store 快照；**手工编辑 jobs.json = 禁止**（R-A6；与 CLI/引擎共用同一
mutation authority，D-007 §10.4）。

每次 mutation 工具调用返回 Receipt（成功信封内）：

```json
{
  "ok": true,
  "result": {
    "job": { "...publicJob 投影...": "", "fenceSummary": "none|fenced:<occurrenceId>" },
    "mutation": {
      "action": "update_schedule | pause | resume",
      "scheduleRevisionBefore": 3, "scheduleRevisionAfter": 4,
      "semanticChange": true
    },
    "receipt": {
      "jobId": "workflow-dispatcher-hr-agent-v1",
      "at": "2026-08-27T12:00:00.000Z",
      "callerAgentId": "agt_hr-agent",
      "callerProvenance": "broker-credential",
      "evidenceStatus": "appended | failed-visible"
    }
  }
}
```

- caller 身份只出自 broker credential seam（gateway ctx agentId），**永不出自
  工具参数**（同 reconcileOccurrence 的 trusted-context 纪律）。
- Audit：每次 mutation 经 `store.appendRunEvent` 追加 runs.jsonl 记录
  `{ action: 'scheduler_tool_mutation', tool, jobId, callerAgentId,
  callerProvenance, mutation, ts }`（既有 append-only / fsync / bounded
  evidence 面，D-007 §10.3）。
- Evidence 纪律继承 D-007 §11.5：audit append 失败**不**虚假改变 authoritative
  state、不回滚 mutation，但必须可观察（receipt `evidenceStatus =
  failed-visible` + log）。

### 5.5 幂等（rerun idempotent）

```text
update_schedule 同值重发   → 无 revision bump、状态收敛；semanticChange=false
pause 已 paused job        → enabledBefore=false/enabledAfter=false，状态收敛
resume 已 enabled job      → 状态收敛；fence 语义不变
resume 被 fence 的 job     → enable 成立但 admission 仍持有（fenceSummary 可见）
同 occurrence/同请求重放   → 不产生第二个 store mutation 语义（时间戳前进无害）
```

任何路径不触发：同 occurrence 二次 admission、fence 清除、历史补跑、
payload/agentId/retry 变更——四者结构性不存在于工具面。

### 5.6 错误表（五枚工具共用 declared codes）

```text
invalid_arguments / unsupported_operation / unauthenticated / forbidden /
access_denied（无对应 scope grant）/ job_not_found_or_not_managed /
validation_error（schedule 非法形态）/ locked_timeout（OwnerLock 超时）/
internal_error
```

fail-closed；不降级、不吞错（error-preservation 纪律族）。

## 6. 实现闭包（G3 accept 后的评审路径；本轮零实现）

```text
NEW   packages/broker/src/capabilities/scheduler.js
        — 五枚 scheduler_* manifests（纯数据）+ schedulerToolsManifests 导出
NEW   packages/broker/src/capabilities/agent-wake.js
        — agentWakeManifest（§4.1：agentRouter.deliver 的薄转发暴露）
MOD   packages/broker/src/index.js
        — DEFAULT_MANIFESTS 追加 6 枚（计数基线以实现时 main 实测为准——
          姊妹 domain/global manifests 落地次序会移动基线，dual-path 纪律）
NEW   packages/scheduler/src/tools.js
        — createSchedulerToolsAccess({ store, managedJobIds })：
          managed-set guard + 五 handler（内部仅调 control ops +
          store.appendRunEvent audit）+ receipt 组装；不触碰引擎/eligibility
NEW   packages/scheduler/test/tools.test.js
        — sandbox store：guard / schedule-only / 同值幂等 / fence 保持 /
          receipt+audit / evidence 失败可见
MOD   packages/production-runtime/src/compose.js
        — wiring only：把 tools handler map 与 agent_wake→router.deliver
          注入 applyBroker 的 local capability dispatch（既有
          localHandlers/localHandlerResolver 缝）；引擎零变更
MOD   packages/broker/test/capabilities.test.js
        — manifest 计数 + scope/args/错误 fixture
```

svc-workflow = **0 改动**。agent-router / scheduler 引擎 / feishu-connector =
**0 改动**。agent definition 配置（G0）、auth-service grants（G4）、生产
store 写入（G6）= 各自独立 operator 轮次。部署（生产 lineage 更新）与
production apply = 独立授权，不在本 Spec。

## 7. 验收条件（fixture 级，G3 评审用）

```text
ACC-001  §3.1 exact document 过 normalizeJob/createJobOp（sandbox store），
         id 保留为 workflow-dispatcher-hr-agent-v1，agentId =
         agt_workflow-dispatcher-hr-agent，enabled=false
ACC-002  managed-set guard：五枚工具对非 managed jobId（含生产 canary id
         形态样本）全部 job_not_found_or_not_managed，store 零变更
ACC-003  update_schedule 仅 schedule：额外键（payload/agentId/retry/enabled）
         → invalid_arguments 且 store 未被触及；真实变更 bump revision、
         同值不 bump
ACC-004  pause/resume 幂等收敛；resume 不清除 fence（sandbox 构造
         unresolved outcome_unknown → enable 后 fenceSummary=fenced 且
         无新 admission）
ACC-005  每次 mutation 附 runs.jsonl audit（caller provenance = 
         broker-credential）；evidence 注入失败 → failed-visible，mutation
         不回滚
ACC-006  scope 门禁：无 scheduler.read/scheduler.manage/agent.wake grant →
         access_denied；caller 身份来自 credential seam，参数不可冒充
ACC-007  agent_wake = 纯转发：fake router 断言恰为
         deliver({requestId, agentId, sessionMode:'fresh', message})，
         无 sessionMode 透出参数；同 requestId 双调用 → 同一 sessionId
         （幂等 mint，Router 既有语义）
ACC-008  六枚 manifest 过 validateManifest；DEFAULT_MANIFESTS 计数 =
         实现时 main 基线 +6；既有 manifest 字节不变
ACC-009  list/get 仅暴露 managed 投影（含 fenceSummary）
```

生产验收（角色授予 403→200、专用 identity 真机 round 完整跑通、生产 store
创建 job）归 G0–G2/G4–G7 各自轮次的独立授权与审计，不由本 Spec 的 fixture
验收替代。

## 8. Alternatives and disposition

```text
ALT-001  恢复 OpenClaw unified-dispatcher.py + launchd + jobs.json / OpenClaw cron
         — REJECTED：任务明令禁止（权威系统 = dsh-agent-core Scheduler；
         OpenClaw 退役中；R-A5）。
ALT-002  旧 trigger_agent 模式：dispatcher 为每次唤醒动态创建 one-shot job
         — REJECTED：任务红线（不动态创建任意 cron job）；亦会在 store 堆积
         定义、绕过 D-007 admission 语义。唤醒直达现有正式派发机制（§4）。
ALT-003  RUN_AS = 复用交互式 agt_hr-agent（本 Spec r1 草案读法）
         — REJECTED by r2 任务修订：RUN_AS 冻结为专用 workflow-dispatcher-hr-
         agent identity；交互式 HR 主会话结构性拿不到扫描/唤醒权，且调度
         「执行者/管理者」分离（R-A8），审计归于单一 service identity。
ALT-004  managed_by 作为新 Job schema 字段
         — DEFERRED：V1 冻结清单外延表达，零 D-007 schema 影响；清单增长时
         再经 AMEND 决定是否落字段。
ALT-005  scheduler 工具经 product-api HTTP 面暴露
         — REJECTED：scheduler 是进程内 local 能力，broker local-capability
         先例（agent.definition.write）正是为此形态而设；product-api 有独立
         auth 演进，引入第二控制面无实证收益。
ALT-006  唤醒投递进目标 agent 的 main session
         — REJECTED：违反 D-006/D-007 fresh non-main 纪律；暴露层结构性
         不透出 sessionMode（§4.2）。
ALT-007  agent 经 shell 调 agentcore-cron / notification-ingress HTTP /
         直接读写 jobs.json
         — REJECTED：无 scope 门禁、无 receipt/audit、绕过 mutation seam；
         R-A6 红线 + 工具面为唯一合法路径。
ALT-008  dispatcher 内嵌 Workflow/Domain 写能力（改 assignment 推动流转）
         — REJECTED：任务红线（不改 assignment / 不改 Domain）；服务端
         assignee-gated 写面保持对其凭据拒绝（外部 Spec §5 同判）。
ALT-009  自建新派发机制（第二 admission/session/幂等逻辑）
         — REJECTED：任务要求现有正式机制；§4 暴露层为零语义转发，
         全部 admission 语义归 AGENT_ROUTER_DELIVERY_V0 既有实现。
```

## 9. 与 D-007 的一致性核对（non-contradiction）

```text
Job schema            仅用 D-007 §3 真子集字段；零新增字段 ✔
every/anchor          anchorMs 缺席 → createdAtMs fallback（§3.4）✔
timeout               outcome_unknown + 同 Job fence 语义原样继承 ✔
session               fresh non-main per occurrence（D-006）✔
retry                 缺席 = AUTO_RETRY_DEFAULT NO ✔
store/jobs.json       精确 commitments 不动；路径 = 生产冻结路径；一切写入经
                      mutation seam（OwnerLock/lease/原子提交）✔（R-A6）
mutation authority    工具 → control ops → JobStore.mutateDoc 单一权威 ✔
enable/disable        只影响未来 eligibility；不清 fence、不补跑 ✔
CLI/控制面            agentcore-cron / domain ops 语义不动（仅新增工具层）✔
Scheduler 无关性      引擎对 Workflow/HR/派发零感知；dispatch 逻辑全在
                      agent turn + broker capability 层 ✔
restart/catch-up      原生重启策略原样；新 job 无迁移历史，NO_CATCH_UP N/A ✔
```

## 10. 本轮边界（不做清单）

```text
PRODUCT_CODE_CHANGE      = NONE（零 packages/ 文件改动；仅本 Spec 文件）
AGENT_PROVISIONED        = NO（专用 identity 未创建；G0 独立轮次）
JOB_CREATED              = NO
PRODUCTION_STORE_CHANGE  = NONE（生产 jobs.json 未读未写——直读亦被
                            文件系统拒绝，本 Spec 依赖 runbook + 任务冻结路径）
DEPLOY / RESTART         = NONE
ROLE_GRANT / SCOPE_GRANT = NONE
OPENCLAW_TOUCHED         = NONE
PRODUCTION_APPLY         = NONE
D-007 / D-005 / 其他 Spec 文件 = 未修改（GOVERNING_SPEC_UNMODIFIED）
```

## 11. Final Output

```text
TASK_NAME = 调度 执行
TASK_TYPE = DOCS_ONLY_SPEC_AUTHORING
SPEC_ID = AGENT_CORE_HR_DISPATCHER_V1
SPEC_STATUS = proposed（r3.1，DUAL_GLOBAL_READER_MODEL 终版同步 +
  dependency-DAG sync：链尾节点）
DELIVERABLE = docs/specs/AGENT_CORE_HR_DISPATCHER_V1.md（单文件，就地修订）
SPEC_PR = OPENED（docs/hr-dispatcher-scheduler-v1-spec，Draft；r3 按
  DUAL_GLOBAL_READER_MODEL 终版与跨仓 authority 拆分同步）

AUTHORITY_SYSTEM = dsh-agent-core Scheduler（D-007）
OPENCLAW_RESTORED_OR_MODIFIED = NO（R-A5 永久禁令：~/.openclaw/cron/jobs.json
  与 OpenClaw cron 全部禁用）
PRODUCTION_STORE_PATH = /Users/authsvc/.agent-core/scheduler/jobs.json（冻结）
MANUAL_JOBS_JSON_EDIT = FORBIDDEN（一切写入经 JobStore mutation seam /
  OwnerLock / lease；R-A6）

PART_A_JOB_ID = workflow-dispatcher-hr-agent-v1
PART_A_RUN_AS = 专用 workflow-dispatcher-hr-agent system Agent
  （agt_workflow-dispatcher-hr-agent，G0 供给；≠ 交互式 agt_hr-agent）
PART_A_JOB_FROZEN = YES（id/agentId/schedule/payload.message/timeout/delivery/
  retry/deleteAfterRun/enabled=false 全 pinned，§3.1）
PART_A_CREATED_THIS_ROUND = NO
PART_A_SCAN_CAPABILITY = workflow_global_instances（read-only，姊妹 Spec）
PART_A_SELECTION = active ∧ non-terminal ∧ assignee 经 roster 精确映射
PART_A_WAKE_MECHANISM = 现有正式派发机制（AGENT_ROUTER_DELIVERY_V0
  agentRouter.deliver，fresh-session 幂等）经 §4 薄暴露；零新派发语义
PART_A_DYNAMIC_JOB_CREATION = FORBIDDEN
PART_A_ASSIGNMENT_CHANGE = FORBIDDEN（R-A1）
PART_A_DOMAIN_CHANGE = FORBIDDEN（R-A2）
PART_A_OTHER_WORKSPACE_WRITE = FORBIDDEN（R-A3）

PART_B_TOOLS = scheduler_list_jobs, scheduler_get_job,
  scheduler_update_schedule, scheduler_pause_job, scheduler_resume_job
  （恰五枚，任务冻结名）
PART_B_HOLDER = agt_hr-agent（交互式 HR 助手；exact-identity scopes）
PART_B_DISPATCHER_SCHEDULER_WRITE = NONE（R-A8：执行者零调度写权）
PART_B_HR_MAIN_SESSION_ARBITRARY_SCHEDULER_WRITE = FORBIDDEN
  （五有界工具是唯一 Agent-facing Scheduler 写面，V1 无任何任意写授权）
PART_B_MANAGED_BY_LABEL = workflow-dispatcher-hr
PART_B_MANAGED_SET = ["workflow-dispatcher-hr-agent-v1"]（V1 冻结清单）
PART_B_UPDATE_FIELDS = schedule ONLY（payload/agentId/retry 不可改）
PART_B_CREATE_DELETE_AUTHORIZED = NO（V1）
PART_B_MUTATION_PATH = control ops → JobStore mutation seam（OwnerLock /
  engine lease / 锁内重读 / 原子提交，D-007 §11.1）
PART_B_RECEIPT_AUDIT = MANDATORY（receipt + runs.jsonl audit，caller 出自
  credential seam）
PART_B_RERUN_IDEMPOTENT = YES（§5.5）

PREREQUISITE_GATES = G0a/G0b, G1..G7（§2.2；§2.3 协调点已解——最终
  DUAL_GLOBAL_READER_MODEL：dispatcher 获 GLOBAL_WORKFLOW_READER（UUID
  回填后 apply），HR 主身份同获 READER；双方不获 COORDINATOR）
DEPENDENCY_GRAPH = 31 -> 14 -> 83 -> 87（单向；本 Spec = 链尾）
IDENTITY_SPEC_HEAD   = mayf3/auth-service PR #31 @
  50b5ad313536f0f75382c06ebb56c38114b0db4a（根节点，零外部 pin）
GLOBAL_READER_SPEC_HEAD = mayf3/svc-workflow PR #14 @
  83e14ca12b5f02644455b06ccdc6a336dc7462ce（唯一依赖 = PR #31）
GLOBAL_TOOL_SPEC_HEAD = mayf3/dsh-agent-core PR #83 @
  517ae95728dde41314ee4c9712530ad9f2b08a79（唯一依赖 = PR #14）
SCHEDULER_SPEC_HEAD  = 本 Spec（PR #87 最终 head = 本修订 commit）
PR_86_DISPOSITION    = SUPERSEDED_BY_PR_87（姊妹分支 docs/hr-dispatcher-v1-spec
  关闭，不合并）
CIRCULAR_AUTHORITY_PIN_COUNT = 0
PRODUCTION_CHANGE = NONE
PRODUCTION_APPLY = NONE
PRODUCT_CODE_CHANGE = NONE
READY_FOR_INDEPENDENT_REVIEW = YES
NEXT_TASK = 调度 审计
```
