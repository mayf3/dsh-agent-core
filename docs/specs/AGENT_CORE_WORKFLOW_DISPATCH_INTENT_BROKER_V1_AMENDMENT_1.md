---
spec_id: AGENT_CORE_WORKFLOW_DISPATCH_INTENT_BROKER_V1_AMENDMENT_1
status: proposed
spec_kind: amendment
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: conditional_controlled_operation
date: 2026-09-11
amends: AGENT_CORE_WORKFLOW_DISPATCH_INTENT_BROKER_V1
authority_driver: WORKFLOW_NORMAL_DISPATCH_RECOVERY_V1 (P0 lane, Owner directive 2026-09-11)
scope:
  - packages/broker
governed_by:
  - AGENT_CORE_WORKFLOW_BROKER_ERROR_PRESERVATION_V1
external_authorities:
  - repository: mayf3/auth-service
    authority_id: AUTH_SERVICE_INTERNAL_IDENTITY_DIRECTORY_V1
    relation: identity_resolution_via_directory_route
supersedes: []
superseded_by: null
owners:
  - repository-maintainers
---

# DISPATCH_INTENT_BROKER AMENDMENT_1 — NORMAL_DISPATCH_SWEEP（抗饥饿有界清扫）

> 状态：**proposed（DRAFT；Owner exact-head acceptance gate）**。Authority driver =
> Owner P0 lane `WORKFLOW_NORMAL_DISPATCH_RECOVERY_V1`（2026-09-11）：真实业务
> Workflow 长期 `ACTUAL_DISPATCH=0`，已证 `POISON_CANDIDATE_STARVATION` /
> `CANONICAL_IDENTITY_RESOLUTION_FAILURE` / `WRONG_READ_SURFACE_DEPENDENCY`。
> 业务不变量（冻结）：**ONE_BAD_CANDIDATE_MUST_NOT_STARVE_HEALTHY_WORK = YES**。

## 1. Amendment scope（对被 amend Spec 的关系）

被 amend Spec（CTR-DIB-001/002/003）的两个 passthrough 能力**零修改**；其
Non-goals（CTR-DIB-004）中「不实现 Scheduler policy（fairness / quota / retry /
mapping / delivery）」由本 Amendment 以**新增独立编排能力**的方式有限开口：
sweep 是对已接受能力的确定性编排（读 due feed → 逐候选分类 → 控制性 wake），
不新建 svc-workflow 授权面、不触 gateway/relay/transport/schema/mapping 框架。

## 2. Contracts

### CTR-A1-001 — `workflow_dispatch_sweep`（新增编排能力，deterministic）

```text
requiredScopes = ['workflow.read']            # wake 语义由既有 CTR-DIB-002 承载
operation sweep:
  args:
    dryRun   : boolean, default TRUE          # true = 只产候选表，零 wake 调用
    limit    : integer 1..100, default 20     # due feed 页大小（透传 CTR-DIB-001）
    maxWake  : integer 1..10,  default 3      # 单轮 wake 成功上限（BOUNDED_WORK_PER_TICK）
result: { type: json }                        # 形状见 CTR-A1-003
```

编排语义（冻结，即 Owner PHASE 2 最小语义的可测形式）——对每个 due intent：

1. **join 全局安全摘要**（既有 `workflow_global_instances`，按 workflowInstanceId
   定位该行）：获得 definitionKey / title / currentNodeKey / executionClass /
   current_assignee。**禁止调用 `workflow_instance_detail`**（WRONG_READ_SURFACE
   移除：PHASE 3 验收 `HR_CROSS_DOMAIN_PRIVATE_DETAIL_READ_REQUIRED = NO`）。
2. **分类（确定性规则，无 LLM 判断），任一命中即 record skip + continue**：
   - `NON_BUSINESS_TEST`：摘要 `execution_class === 'NON_BUSINESS_TEST'`
     （TEST_CANARY_NORMAL_DISPATCH = 0）；
   - `HUMAN_REQUIRED`：实例处于 human-assistance 路径（摘要可见的
     human-required/escalation 态；实现按部署版 DTO 字段机械映射）；
   - `QUARANTINED`：实例/定义带 Owner registry 的 quarantine 标记；
   - `EXTERNAL_SIDE_EFFECT`：publishing/外部副作用族且上次 delivery/execution
     outcome 不确定 ⇒ `NO_AUTOMATIC_REPLAY`（PHASE 5；不得因此阻塞其他候选）；
   - `IDENTITY_BLOCKED`：ownerPrincipalId 经 **auth directory 正式路由**
     （`GET /api/v1/directory/principals/:principal_id/agent`，audience
     `identity-directory` + scope `auth.directory.read`；
     AUTH_SERVICE_INTERNAL_IDENTITY_DIRECTORY_V1 契约：恰
     `{principalId, agentId, principalStatus}`）返回 404/409/422 或
     `principalStatus === 'disabled'` ⇒ 记 exact reason 后 continue。
     **CANONICAL_IDENTITY_FAILS_CLOSED = YES；displayName inference /
     agentId guessing / shared credential / run-as-OBO 一律禁止。**
3. **其余 ⇒ dispatch exactly once**：调既有 `workflow_wake_dispatch_intent`
   （CTR-DIB-002；`wakeApplied=false` 的 durable no-op 记为
   `processed_not_woken`，非失败、不重试、425 原样上抛不重试）。
4. **单候选任何异常（transport/解析/wake 错误）⇒ 记 exact reason + continue，
   不得结束整轮**（SHIP_BLOCKER=POISON_CANDIDATE_STARVATION 的反义即本条）。
5. **终止条件**：候选集耗尽 OR wake 成功数达 `maxWake`。
6. **去重**：单轮内按 exact `dispatchIntentId`（跨页重复处理恰一次）；跨轮由
   server 端 intent durable 状态 + wake durable no-op 保证不重复派发
   （PHASE 6；`DUPLICATE_DISPATCH = 0`）。

### CTR-A1-002 — identity resolution seam（目录只读客户端注入）

- Broker 经注入的 directory client 调 AUTH_SERVICE_INTERNAL_IDENTITY_DIRECTORY_V1
  正式路由；client 的机器授权（audience `identity-directory` + scope
  `auth.directory.read`）为 **production provisioning 项**（apply-day），
  单测以 stub client 注入。
- 目录不可达/超时/非 200 ⇒ 该候选 `IDENTITY_BLOCKED(reason=directory_unavailable)`
  continue；**绝不退化为 displayName/agentId 推断**。

### CTR-A1-003 — sweep 结果形状（时间戳绑定候选表）

```json
{
  "ok": true,
  "result": {
    "censusAt": "<ISO>",
    "dryRun": true,
    "counters": { "candidates": 0, "woken": 0, "processedNotWoken": 0,
                  "skipped": { "NON_BUSINESS_TEST": 0, "HUMAN_REQUIRED": 0,
                                "QUARANTINED": 0, "EXTERNAL_SIDE_EFFECT": 0,
                                "IDENTITY_BLOCKED": 0 }, "errors": 0 },
    "candidates": [ { "instanceId": "...", "domainId": "...", "definitionKey": "...",
                      "currentNodeKey": "...", "executionClass": "...",
                      "assigneePrincipalId": "...", "canonicalAgentResolution": "...",
                      "candidateClass": "REAL_BUSINESS|NON_BUSINESS_TEST|HUMAN_REQUIRED|IDENTITY_BLOCKED|EXTERNAL_SIDE_EFFECT|QUARANTINED",
                      "dispatchEligibility": "WOKEN|PROCESSED_NOT_WOKEN|SKIPPED|DRY_RUN",
                      "blockingReason": "..." } ]
  }
}
```

## 3. Required tests（T1–T10 → broker 单测，stub transport + stub directory）

| T | 场景 | 断言 |
|---|---|---|
| T1 | #1 identity-blocked，#2 valid | #2 wake 恰一次；#1 记 IDENTITY_BLOCKED |
| T2 | 7 个全 identity-blocked | 0 wake；7 条 exact skip reason；轮完成非 abort |
| T3 | test 候选先于 business | test skip（NON_BUSINESS_TEST）；business wake |
| T4 | 跨页 duplicate intent | 恰处理一次；无重复 wake |
| T5 | summary 足够、detail 面不触 | 断言零 `workflow_instance_detail` 调用；仍 wake |
| T6 | wake 后目标 agent 自 authority 读 detail | 非本能力职责：断言 sweep 未代读 detail（责任分离） |
| T7 | invalid/stale principal | 无 displayName fallback；continue 下一个 |
| T8 | publishing outcome 未定 | NO_AUTOMATIC_REPLAY skip；后续安全候选仍被处理 |
| T9 | 同一 eligible 下一 tick 重现 | server durable no-op ⇒ processedNotWoken；无重复 wake |
| T10 | 候选 > 1 页 | 后页 valid 候选不被首页坏候选饿死；maxWake 有界 |

## 4. Acceptance

| ACC | Owning contract | Method / expected |
|---|---|---|
| ACC-A1-001 | CTR-A1-001 | T1–T10 全绿；sweep 单候选异常不终止整轮（注入错误断言 continue） |
| ACC-A1-002 | CTR-A1-002 | 目录 stub：active/ disabled/ 404/ 409 /超时 五分支分类正确；无 fallback 路径（代码审查 + 测试断言） |
| ACC-A1-003 | CTR-A1-003 | dryRun=true 零 wake wire 调用（spy 断言）；结果形状恰为候选表 |
| ACC-A1-004 | fences | 机械 diff：packages/broker 增量面 + 测试 + inventory 计数；既有 passthrough 清单零改动 |

## 5. Production apply gating（CONCURRENCY=ONE）

`READY_FOR_PRODUCTION_APPLY` 需同时：(a) 本 Amendment Owner exact-head acceptance；
(b) 实现 PR 全通道 review terminal + audit PASS；(c) directory 机器授权
（identity-directory/auth.directory.read）production provisioning 完成；
(d) Owner 侧 fresh census 佐证候选分布；(e) Scheduler production slot 释放
（PRODUCTION_MUTATION_CONCURRENCY=ONE）。Canary 顺序：dryRun census → 选一个
安全 REAL_BUSINESS → `dryRun=false, maxWake=1` 受控派发 → 目标 Agent 自 authority
读 detail → 恰一次 progression → readback ⇒ `NORMAL_NEW_WORKFLOW_DISPATCH=PASS`
后才允许扩大。**不恢复大规模 WORKFLOW_DATA_HYGIENE_V1 stock cleanup 作为前置。**

## 6. Out of scope / FOLLOW_UP_DEBT

- svc-workflow 侧任何改动（summary 若缺 routing 必需字段，另走最小 class-safe
  extension 提案，本 Amendment 不开 arbitrary detail）。
- HR LLM 冻结 prompt 的 re-anchor（PHASE 3 的 HR 侧行为修正）归
  AUTH_SERVICE_AGENTCORE_HR_DISPATCHER_IDENTITY_V1 线，不与本 capability 混合。
- 公平性/配额/优先级策略（fairness/quota beyond maxWake）= FOLLOW_UP_DEBT。
