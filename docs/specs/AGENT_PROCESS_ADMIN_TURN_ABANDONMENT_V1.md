---
spec_id: AGENT_PROCESS_ADMIN_TURN_ABANDONMENT_V1
status: draft
date: 2026-09-29
accepted_date: null
accepted_by: null
accepted_at: null
accepted_reviewed_base: null
accepted_reviewed_spec_commit: null
accepted_reviewer_id: null
acceptance_review_result: null
semantic_delta_after_review: null
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
scope:
  - mayf3/dsh-agent-core
  - exactly one authenticated administrator turn-abandonment entry for the one
    target Agent agt_hr-agent: an admission-only unblock of NEW requests after
    the Owner-designated CTO explicitly abandons a stuck unresolved turn; the
    old record is never settled, never deleted, never replayed and its business
    result stays UNKNOWN (single bounded contract surface; independent review
    round 1)
governed_by:
  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0
external_authorities:
  - repository: mayf3/dsh-agent-core
    authority_id: AGENT_PROCESS_LIFECYCLE_HARDENING_V3
    relation: depends_on
  - repository: mayf3/dsh-agent-core
    authority_id: AGENT_CORE_WORKFLOW_ADMIN_AGENT_BOOTSTRAP_V1
    relation: depends_on
supersedes: []
superseded_by: null
owners:
  - mayf3
type: admin-recovery-entry-contract
review_status: PENDING_INDEPENDENT_REVIEW
owner_intent_provenance: direct Owner instruction 2026-09-29 (HR_RESET_AND_RESUME_V1 takeover brief — 管理员明确放弃当前卡住的旧任务后可以继续执行新任务；旧结果保留 UNKNOWN；不重放旧请求；同一幂等重置不得作用于后来任务；取消/超时/进程重启复用同一条恢复路径; plus direct Owner control directives #70/#72 2026-09-29 — entry bound to the exact canonical CTO machine identity, fail-closed lifecycle evidence gate, smallest-possible authority surface)
references:
  - docs/specs/AGENT_CORE_WORKFLOW_ADMIN_AGENT_BOOTSTRAP_V1.md (accepted; OBS-WA-008 records the canonical CTO machine identity agt_cto-agent / principal 4e5a4578-0645-4133-bd35-b80e453dfee9)
  - docs/evidence/workflow-recovery-stage-f-20260822/identity-cto.json (accepted-repo auth-service machine-identity receipt for the same pair)
  - .agents/local/README.md (accepted local governance: recovery-first; an authorized recovery keeps the outcome_unknown record honest and must prove old worker/tool termination or isolation, or keep the fence)
  - docs/specs/AGENT_PROCESS_LIFECYCLE_HARDENING_V3.md lineage (reconciliation store, settle-once, restart recovery state machine this contract composes onto)
---

# AGENT_PROCESS_ADMIN_TURN_ABANDONMENT_V1 — 管理员放弃卡死 Turn 的准入恢复契约

## 0. Owner 决策（冻结）

D1. 同一个软件持续可用：同一个 HR（`agt_hr-agent`）、同一个正常使用入口；
恢复不新建 Agent、不改业务身份、不重放旧请求。

D2. 管理员明确放弃当前卡死的旧任务后，该 Agent 必须能继续接受新任务。旧
任务的最终业务结果保持 UNKNOWN——不查清、不恢复、不冒充成功或失败；其
记录由系统永久保存，但不得永久占住该 Agent 的新请求准入。

D3. 授权主体是唯一指定 CTO（研发总监）角色的**当前规范机器身份**：
canonical agentId `agt_cto-agent` + Principal UUID
`4e5a4578-0645-4133-bd35-b80e453dfee9`（accepted OBS-WA-008 + authsvc 机器
身份 receipt；以 authsvc 可信验证结果为准）。身份必须来自既有 authsvc 验证
seam，不接受调用方自填身份字段；`workflow.admin` scope 单独不构成重置权。
只授权这一对身份：历史 OpenClaw 时代 scheduler fixture 里的
`cto-agent` / `3e2439d2-…` 旧对不获授权，不得并存。

D4. 同一重置操作以调用方提供的幂等 `declarationId` 绑定其**原始任务范围**；
重试只完成原始范围，绝不吸收操作完成后才出现的任务；响应丢失时查询或重试
同一 id，不换新 id。

D5. 后续取消、超时、worker 崩溃、controller 重启场景复用同一条恢复路径；
声明与范围跨重启持久。

## 1. 契约

C1. **入口与授权**。`POST /agent-process/turn-abandonment`（body
`{agentId, declarationId}`，closed shape）与
`GET /agent-process/turn-abandonment?agentId=` 挂在既有 product-api HTTP
面，复用既有 `schedulerTokenVerifier`（authsvc RS256/JWKS）seam。每个请求
先过授权门：验证后 principal 必须同时精确匹配 D3 的 Principal UUID 与
agentId；其余一切（未认证、verifier 缺失、其他 workflow.admin 持有者、
UUID/agentId 单边错配、D3 旧身份对）零改动失败（401/403）。目标 `agentId`
钉死为 `agt_hr-agent`，其他目标在任何存储改动前 403。错误信封沿用
product-api 冻结的 `{error:{code,message}}`。声明预算：每个持久 store 最多
32 个不同 `declarationId`，不回收；耗尽 → 409
`abandonment_capacity_exhausted`（既有 id 的幂等重试永远可用）。

C2. **执行冲突门（管理员声明 ≠ 退出证据）**。任何存储改动之前，入口必须
确认目标 Agent 没有未证明终止的执行：
- 生命周期槽 STARTUP → 409 `startup_in_progress`；
- 生命周期槽 REAP → 409 `reaping_in_progress`；
- READY 且进程存活 → 409 `live_execution_present`（错误信息指名既有受控
  cancel/shutdown 路径）；
- 槽 EMPTY（包括 controller 重启后内存登记为空）时，若该 Agent 存在未放弃、
  fence 未清除的 stuck unknown fence 且**没有**持久退出/终止证据（记录无
  `exitObservedAt` 且无 `terminationEvidence`——即重启后
  `runtime_restart_ownership_unavailable` 的 restart-lost 类），→ 409
  `restart_lost_termination_evidence_unavailable`，错误信息指名既有受控
  restart-quiescence 证明 / exact-generation recovery 证据路径。**EMPTY
  不是 drained**；
- 生命周期槽快照或退出证据查询能力缺失 → 503
  `liveness_verification_unavailable`，绝不默认放行。
持久 `child_real_exit` 证据（或受控 quiescence 证明结算）存在、或不存在
stuck fence 时，声明允许进行——合格场景必须真实可达成功，不允许恢复入口
只会拒绝。

C3. **效果只作用于准入；诚实记录**。通过门后，声明把该 Agent 当前符合准入
阻断投影（`initialOutcome=outcome_unknown`、fence 未清除、无放弃标记；含已
结算但 registry-cleanup 未完成而 fence 仍 active 的
`terminated_without_outcome` 记录）的全部句柄捕获为**原始范围**，先于任何
记录标记持久登记，然后逐条盖放弃标记。范围登记为双载体：声明 scope
registry 持久化在恢复 store 旁边的**独立 sibling 文件**（旧二进制从不读写
该文件，回滚/再升级不会搁浅未盖标范围；原子 temp+fsync+rename+目录 fsync，
闭合校验形状，畸形即整载失败关闭）；per-record 放弃标记随每条记录经受一切
持久往返。sibling 文件整体缺失时（pre-registry 时代），范围从 per-record
标记重建。放弃标记的唯一效果是 `admissionBlockerForAgent` 不再把这些记录
当作新请求准入闸；历史 fence 查询（`activeFenceForAgent`）不变且继续可查。
旧记录永不 settle（由声明）、永不删除、永不改写业务结果；caller correlation
保留——同 correlation 不能二次 mint（不重放）；迟到证据仍然只结算原句柄
并保留放弃标记。声明自身从不发送任何消息；新请求仍走用户正常入口。

C4. **幂等与范围绑定**。已知 `declarationId` 的重试只补齐原始范围内尚未盖标
的记录（部分写入/崩溃恢复），返回值区分新放弃（`abandonedHandles`）与补齐
（`completedHandles`）；把已知 `declarationId` 重绑到其他 Agent → 409
`declaration_conflict`。操作完成后才出现的 unknown 永不被旧 id 吸收，须由
新的显式声明处置。同一 declarationId 的重试是字节级幂等补齐，不重复副作用。

C5. **重启持久**。声明、范围与放弃标记跨 controller 重启存活；重启后无需
重新声明即可继续通过正常入口接受新请求。

## 2. 非目标

N1. 不重建完整 PDC 或全生命周期规范；不修改、不替代 fresh-lineage V4 受控
路径——本入口不能豁免它的证据义务：termination unproven 的旧执行仍须从该
受控路径（restart-quiescence 证明 / exact-generation recovery）取得证据后
才能被放弃。
N2. 不提供伪造退出证据、绕过身份校验或删除账本的路径；管理员声明不充当
终止证明。
N3. 不扩大到 `agt_hr-agent` 以外目标，不泛化为通用 RBAC 管理面，不新建
第二套恢复队列/账本。

## 3. 验收义务（conformance 最低集）

- 合法 CTO 经真实 HTTP 入口完成范围内重置；未认证 / 非 CTO 主体 /
  单边身份错配 / 目标越界均零改动拒绝（401/403/400）。
- EMPTY 且无退出证据拒绝（含重启后登记为空类，零改动）；带持久
  `child_real_exit` 证据或无 stuck fence 时真实成功；能力缺失 503。
- 同 `declarationId` 重试不作用于后来任务；部分失败与重启后同一操作续作；
  32 上限真实且不回收。
- controller crash 后：旧 worker 真实退出、旧记录保留 UNKNOWN + fenced +
  放弃标记、不重放（旧 prompt 仅一次）、无关 Agent 不受影响、同一 HR 同一
  入口完成新请求；迟到结果只结算原句柄。
- 实现面：`packages/product-api/src/agent-process-admin-routes.js`（挂载于
  `packages/product-api/src/index.js`）、
  `packages/agent-router/src/reconciliation/admin-abandonment.js`、
  `packages/agent-router/src/reconciliation/durable-file.js`（sibling
  registry）、`packages/agent-router/src/ingress-delivery.js`
  （`abandonPendingTurns`）。证据面：
  `packages/agent-router/test/process-lifecycle/admin-abandonment.test.js`、
  `packages/product-api/test/admin-turn-abandonment-api.test.js`、
  `scripts/availability-recovery/recovery.acceptance.test.mjs`。

## 4. implementation_authority: contracts

本 Spec 获 Owner 验收后，§1 契约即为该入口实现、测试与运维调用的充分授权
范围；契约外行为变化需要新的 AUTHORITY_ACTION。验收前的合并/部署/生产调用
不获本 Spec 授权。
