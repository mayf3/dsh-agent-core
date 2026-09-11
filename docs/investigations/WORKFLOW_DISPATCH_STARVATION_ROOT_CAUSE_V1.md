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

# WORKFLOW_DISPATCH_STARVATION_ROOT_CAUSE_V1 — 真实派发循环根因（一手执行轨迹实证）+ 最小修复契约 v2

> 状态：**proposed（docs-only；`implementation_authority=none`、`production_apply_authority=none`）**。
> 全部 §1 证据取自生产 HR 的真实 cron-run session 轨迹（本会话直读，机器可复核）；
> 修复位置 = **Dispatcher 消费循环（job payload 契约）**，Broker 零改动（#266 B5 教训）。

## 1. 一手证据（生产执行轨迹，2026-09-11 直读）

载体：`/Users/authsvc/.agent-core/homes/agt_hr-agent/sessions/
--Users-yanfenma-.openclaw-groups-workspace-oc_a5e904…--/cron-run-occ~*/session.jsonl`
（145 轮，最新活动 09-11 22:26）。

### E1 真实派发 seam 与解析工具已在线上

- 75/145 轮含真实 `agent_session_send` tool-call（如 fee0c01b=12 次、f8fe9474=10、
  fccfb9cf=9、f3a2be6=7）；115 轮使用 `agent_resolve_principal`。二者均在 HR 工具面。
- 派发消息形态：「统一 Workflow 调度…请处理 workflow_instance_id=…，**nodeVisitId
  尚未从详情接口取得（若需提交请自行读取实例详情）**…仅执行工作，不代 workflow
  transition/审批」。
- `workflow_wake_dispatch_intent` 在全部 145 轮中零使用（#266 B2 再证实：wake 不是
  派发 seam）。

### E2 四个机械断点（合并 = ACTUAL_DISPATCH(业务推进)=0）

1. **WRONG_READ_SURFACE 转嫁给目标**：HR 自身跨域 `workflow_instance_detail` 403
   （09-10：171 次 NO_VISIBILITY），payload 却要求「详情可见」才派发 ⇒ 要么候选被判
   不可派发，要么如实发消息把「nodeVisitId 缺失」转嫁目标 Agent（E1 消息原文）——
   目标从 detail 起步即多一个失败点。
2. **CANONICAL_IDENTITY_RESOLUTION_FAILURE**：send 目标直打 legacy 裸名 agentId
   （如 `agt_writing-style-analyst-agent`——其 principal 61819256 即 §PHASE1 的
   STALE 候选）；目标 Agent 自身 workflow authority 解析失败 ⇒ 收到任务也无法
   transition/提交。 send 成功 ≠ 业务派发成功。
3. **重复派发/无去重**：同一实例跨轮重复 send（fee0c01b 一轮 12 次、f8fe9474 10 次；
   085b41f2、5709a28e 等反复出现）——violates NO_DUPLICATE_SEND / T9。
4. **预算烧尽 + 冻结缺失**：每轮 15+ 次手工分页扫全量 active 实例（800+ 行）+ 文件/
   metrics 记账；最新轮（09-11 22:26, fa5834）**0 次 send、0 份报告（空收尾）**。
   且 loop 契约 = 可变 workspace payload（各轮文本随时间漂移：maxSend 一度=1、
   近期轮 12 次）——**控制流从未冻结、不可审计**。

### E3 现有资产盘点（修复只差接线，不差面）

- due feed `workflow_dispatch_intents`（CTR-DIB-001）7 字段恰含
  **`nodeVisitId`**——正是 E2-1 转嫁给目标的那一个字段；且 server 端按
  nextEligibleAt 过滤=天然去重节流（E2-3 的正解）。
- `agent_resolve_principal`（EXACT_AGENT_PRINCIPAL_RESOLUTION 投影）已在 HR 工具面
  且 115 轮在用——exact identity 的权威原语已存在。
- `agent_session_send` 已被授予且在用——派发 seam 不缺。
- payload 已含（可保留）：cebf4816 永久禁派、测试类入测试队列、accepted/内部错误/
  唤醒失败/结果不明确不得自动重发、metrics 记账脚本。

## 2. 根因结论

**生产 dispatcher 的派发门建立在结构不可满足的「详情可见」上，且无去重、无冻结
契约**：detail 403 ⇒ 候选不可派发或 nodeVisitId 转嫁目标；身份解析失败的目标
照发；同一实例跨轮重复发；轮预算被全量手工分页烧尽。四者叠加 =
`NORMAL_REAL_WORKFLOW progress = 0`。**非 Broker 缺面、非 wake 缺失、非新 Spec
需求——是消费者循环契约缺失。**

## 3. 最小修复契约 v2（冻结；acceptance 后实现 PR 另行）

载体 = **dispatcher 循环契约（cron job payload 文本 + 其验收）**，一次 updateJobOp
operator 变更（critical job，operator 面合法；payload 变更 = 冻结 lineage AMEND，
附 preimage/readback）：

1. **候选源 = due feed**：`workflow_dispatch_intents`（server 过滤 due + 携带
   nodeVisitId）替代全量手工分页扫描；global summary 仅作缺失字段 join
   （execution_class 等）。分页预算 ≤3 页。
2. **派发包完整**：send 消息携带 intent 的 instanceId+nodeVisitId+ownerPrincipal，
   目标零 detail 前置；**删除「详情可见」前置**；detail/历史 403/404 ⇒
   记 visibility_pending + continue（T5）。
3. **exact identity 门**：`agent_resolve_principal(ownerPrincipalId)` 非
   active/歧义/404 ⇒ IDENTITY_BLOCKED skip+record，**不 send**（E2-2 的根治：
   115 轮已在用该工具，只是没把它当 send 门）。
4. **skip-continue + 有界**：单候选任何失败记 exact reason + continue，不终止轮；
   每轮 send ≤ maxSend=3（由 payload 冻结，终用现状 9-12 次）。
5. **去重**：due feed nextEligibleAt 节流 + 已处理 intentId 轮内去重；
   同实例重复 send 禁止（T9）。
6. **保留**：测试类入测试队列（payload 词表）、publishing/外部不可逆 outcome
   未定 ⇒ 仅跳该候选 NO_AUTOMATIC_REPLAY、cebf4816 quarantine、metrics 记账。
7. **TU 矩阵**（对真实循环 + 真实 send seam 的验收）：T1 坏#1→好#2 仍 send；
   T2 全 blocked→0 send+N reasons+轮完成；T3 test 类 skip、business 照发；
   T4 同 intent 跨轮→节流不重发；T5 detail 404 不阻断（包完整仍发）；
   T6 派发后目标自 authority 读 detail/transition；T7 stale principal 无
   fallback；T8 publishing 未定→仅跳该候选；T9 due 节流无重复；T10 >1 页
   后页 valid 不被饿死。

## 4. 上游/read-surface delta

**今日无**：候选源改为 due feed 后，routing 所需字段（含 nodeVisitId）全部已由
accepted 投影供给。若实现期证实缺恰一字段，按 Owner 十条之 6 单独提案。

## 5. Governance

`implementation_authority=none`、`production_apply_authority=none` 直至 Owner
exact-head acceptance。acceptance 后：payload 文本 PR（docs+packet）→ operator
updateJobOp packet（--selftest 先行、preimage/readback）→ dryRun 一轮（0 send 观测）
→ 单候选 canary（maxSend=1）→ 扩大。不待 Scheduler closure；不回 Data Hygiene。
