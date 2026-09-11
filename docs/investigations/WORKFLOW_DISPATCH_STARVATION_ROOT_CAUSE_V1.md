---
spec_id: WORKFLOW_DISPATCH_STARVATION_ROOT_CAUSE_V1
status: proposed
spec_kind: investigation
authority_level: evidence
implementation_authority: none
production_apply_authority: none
date: 2026-09-11
authority_driver: WORKFLOW_NORMAL_DISPATCH_RECOVERY_V1 (P0 lane, Owner directive 2026-09-11)
scope: []
governed_by:
  - WORKFLOW_NORMAL_DISPATCH_RECOVERY_V1
external_authorities:
  - repository: mayf3/auth-service
    authority_id: AUTH_SERVICE_HR_AGENT_SESSION_SEND_GRANT_V1
    relation: agent_dispatch_seam
  - repository: mayf3/auth-service
    authority_id: AUTH_SERVICE_EXACT_AGENT_PRINCIPAL_RESOLUTION_V1
    relation: identity_resolution
supersedes:
  - AGENT_CORE_WORKFLOW_DISPATCH_INTENT_BROKER_V1_AMENDMENT_1 (PR #266, REVISE_CLOSED B1-B5)
superseded_by: null
owners:
  - repository-maintainers
---

# WORKFLOW_DISPATCH_STARVATION_ROOT_CAUSE_V1 — 真实派发循环的饥饿根因调查 + 最小修复契约

> 状态：**proposed（docs-only；`implementation_authority=none`、`production_apply_authority=none`，
> Owner acceptance 前零实现授权、零生产授权）**。本调查只固化证据与最小修复契约；
> 实现在 Owner exact-head acceptance 后按本契约另行走实现 PR。

## 1. 已机械证实的证据链（本会话可复核来源）

### E1 真实 Agent 派发 seam = `agent_session_send`（非 workflow wake）

- `docs/investigations/HR_DISPATCH_DELIVERY_READINESS_V1.md`（main @35a5b6a）：
  HR 派发 = 解析 canonical Principal → 经 **existing `agent_session_send`** 投递到
  目标 Agent canonical main session；该线 2026-09-06 COMPLETE（HR_DISPATCH_
  DELIVERY_PRODUCTION_READY=YES，Lane C canary fd58881a→agt_blog-agent 实证）。
- `AGENT_CORE_WORKFLOW_DISPATCH_INTENT_BROKER_V1` CTR-DIB-002（accepted）：
  `workflow_wake_dispatch_intent` **只推进 nextEligibleAt，不能启动 Agent、不能
  transition**；对已 due 项 wake≈ALREADY_DURABLE-NO-OP ⇒ PR #266 的 sweep 即使
  实现也不产生 Agent dispatch（Owner B2 成立，已关闭）。
- 结论：**「派发」的机械承载 = HR 消费循环内的 `agent_session_send`**；
  `agent_wake` 是设计态专用 dispatcher（未供给）的合法触达路径，不是现役 seam。

### E2 身份解析权威已存在且 fail-closed

- `AUTH_SERVICE_EXACT_AGENT_PRINCIPAL_RESOLUTION_V1`（accepted）：audience
  `agent-principal-resolution`，scope `auth.agent.resolve`，响应恰
  `{principalId, agentId}`，六错误码（404/409 AMBIGUOUS/MAPPING_MISSING 等）。
- dsh 侧姊妹实现 `AGENT_CORE_EXACT_PRINCIPAL_AGENT_RESOLUTION_V1`（HR_DISPATCH_
  DELIVERY_READINESS LANE_B，已入卷）。**sweep 修复不得新造 identity 面**。

### E3 现役 dispatcher = 过渡 job b115cb96 → 交互式 agt_hr-agent

- 生产 job `b115cb96-8a4f-49be-9baa-519223022b59`（logicalKey
  `agt_hr-agent:hr-workflow-auto-dispatch`，desired-state inventory 唯一 HR 条目）
  每 30 分钟以 **payload.message（Lane A 冻结，digest 8ba9674b…）**：
  `routine: workflow_global_instances(lifecycle=active) then ACTIONABLE_NOW
  filtering and dispatch` 唤醒 **agt_hr-agent**（交互式 HR 主身份）。
- 设计态专用 dispatcher（`AGENT_CORE_HR_DISPATCHER_V1`，branch
  docs/hr-dispatcher-v1-spec / PR #87 PROPOSED）**从未供给**（专用身份/agent_wake
  grant 均未执行）⇒ 生产现实 = 过渡循环。
- 循环的**完整控制流文本在 agt_hr-agent 的 system prompt（authsvc 0700 内）**，
  本会话不可读；其可读投影 = 上述 payload + E1/E2 权威 + §1.4 行为证据。

### E4 饥饿行为证据（轮级，svc DB 可复核）

- 2026-09-10（scheduler-goal 取证，svc workflow_security_audits）：HR 当日
  **171 条 `GetWorkflowInstanceDetail` 全部 403 `NO_VISIBILITY`**（跨 4 域）、
  **0 条 global-list 拒绝**、**0 个 HR-driven workflow transition、0 次派发**。
- 2026-09-09 同构：41 条 detail 拒绝、0 global-list 拒绝（= 连正确读面都没用）。
- 解读：整轮预算被 wrong-read-surface 的 detail 尝试烧尽 ⇒
  **ACTUAL_DISPATCH=0 的直接机制 = 循环把 detail 可见性失败当作候选终态处理，
  轮内无 skip-continue / 无有界放行**。（候选级「首坏即弃」的逐字证据 =
  prompt 文本，待 §1.5 一条只读命令回贴后在 §1.6 引用定版。）

### E1.5 补充（Owner 十条之 3 的回答）

现役 34b90173（游离老派发器）与 b115cb96 的执行体同为 agt_hr-agent turn，其
「Agent dispatch」同样只能经 E1 的 `agent_session_send`（HR 唯一被授予的
agent→agent 投递权威）；**两者都不使用 workflow wake 做 Agent dispatch**。
34b 与 b115 的差异只在 job 配置代际（治理外 vs manifest-pinned），不在 seam。

## 1.5 待一条 Owner 只读命令（候选级控制流定版输入）

```bash
sudo grep -rl -E 'ACTIONABLE_NOW|workflow_global_instances' \
  /Users/authsvc/.agent-core 2>/dev/null | head -5
```
（命中文件即 agt_hr-agent 现役 dispatch prompt 载体；随后 `sudo sed -n '1,200p' <file>`
回贴文本，本调查 §1.6 将逐字引用其「首个候选失败→整轮退出」控制流并冻结修复差异。）

## 2. 最小修复契约（冻结；实现在 acceptance 后另行 PR）

修复位置 = **Dispatcher 消费循环**（HR 派发 turn 的指令契约），Broker 零改动
（B5；两个 DIB passthrough 与 EXACT_RESOLUTION/send 面原样）：

1. **per-candidate failure → record exact reason → continue**：任何单候选上的
   读失败（含 detail/visibility 403/404）、身份解析失败、send 失败，只记该候选
   的 blockingReason，**不得终止整轮**。
2. **bounded scan**：每轮候选数上界（默认 20=一页；实现可配 1..100）；
   每轮 send 成功数上界 maxSend（默认 3）——BOUNDED_WORK_PER_TICK。
3. **exact identity only**：assignee principal → agent 一律走
   E2 的 EXACT_RESOLUTION 权威；404/409/422/disabled ⇒ 该候选
   IDENTITY_BLOCKED continue；**禁 displayName inference / agentId guessing /
   shared credential / run-as-OBO**。
4. **零私有跨域 detail 依赖**：routing 所需 = instanceId + definitionKey +
   currentNodeKey + executionClass + assignee（global 摘要已含全部，
   含 execution_class=BUSINESS/NON_BUSINESS_TEST）；**循环指令删除
   `workflow_instance_detail` 前置**（detail 属目标 Agent 自 authority，T6）。
5. **分类冻结为三规则**（不引入启发式）：`execution_class=NON_BUSINESS_TEST`
   ⇒ skip；`EXTERNAL_SIDE_EFFECT`（publishing 族且上次 outcome 不确定）⇒
   仅跳过该候选不重发；其余默认 REAL_BUSINESS 走派发。
   HUMAN_REQUIRED/QUARANTINED 的权威字段未冻结前**不实现**（B4 教训）。
6. **TU（真实 seam 版 T 矩阵）**：T1 per-candidate blocked→下一个仍被 send；
   T2 全 blocked→0 send、N 条 reason、轮完成；T3 test 类先行→skip、business
   后续照发；T4 跨页重复 instance→恰一次 send；T5 detail 404 不终止轮；
   T6 派发后目标 Agent 以自身 authority 读 detail/执行/transition；T7 stale
   principal 无 fallback continue；T8 publishing outcome 未定→仅跳该候选且
   后续安全候选照发；T9 同一候选下 tick 重现→由 workflow 侧状态（已推进）
   天然不重复派发；T10 候选 >1 页→后页 valid 不被首页坏候选饿死、maxSend 有界。
   ——载体 = HR 派发 turn 的指令契约文本 + 其可执行验收（implementation PR
   依 acceptance 结果落在 prompt-amend packet 或确定性 wrapper， Owner 择）。

## 3. 上游/read-surface delta（Owner 十条之 6 的回答）

**当前不需要**：routing 所需七字段 + execution_class 均已在
`workflow_global_instances` 安全摘要内（机械核对 main @35a5b6a capability
描述与 svc openapi DomainInstanceSummary）。若实现期证实缺恰一个字段，
按十条之 6 单独提最小 class-safe delta，不在本候选内夹带。

## 4. Governance

`implementation_authority=none`、`production_apply_authority=none`，直至 Owner
exact-head acceptance；acceptance 后实现 PR 才可开（且 merge 前置全通道 review
terminal——#263/#266 两教训已录）。本候选 supersede PR #266（B1-B5 全收）。
