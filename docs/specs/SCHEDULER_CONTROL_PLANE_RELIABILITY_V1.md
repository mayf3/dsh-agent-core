---
spec_id: SCHEDULER_CONTROL_PLANE_RELIABILITY_V1
status: proposed
date: 2026-09-07
type: implementation-spec (behavior + invariants; implementation in bounded follow-up PRs under this spec)
scope:
  - Scheduler mutation identity (logical job key) and idempotent create/update/delete semantics
  - Mutation outcome state machine with automatic reconciliation (unknown never terminal)
  - Capability readiness gate for scheduler mutation tool exposure
  - Single mutation semantics across broker capability + operator CLI (multi-entry, one semantics)
  - Production operator CLI byte pinning (anti-drift)
  - Desired-state manifest + run-health watchdog + independent Owner alerting + watchdog self-liveness
references:
  - docs/investigations/SCHEDULER_CONTROL_PLANE_RELIABILITY_V1_ROOT_CAUSE_AND_DESIGN.md (evidence authority for this spec)
  - docs/decisions/SCHEDULER_V1.md (D-005, single store mutation authority)
  - docs/decisions/SCHEDULER_OCCURRENCE_OUTCOME_V2.md (D-007, occurrence authority)
  - docs/evidence/daily-summary-scheduler-recovery-v1-20260907/ (incident model)
  - CORE_RUNTIME_SCHEDULER_TOOL_SURFACE_VALIDATION_V1 (double transport envelope — CLOSED, PR #167, production-verified 2026-09-05; explicitly NOT reopened)
owner_rulings: 2026-09-07 (three semantic corrections absorbed in §2; no open owner decisions)
implementation_authority: none until status: accepted
---

# SCHEDULER_CONTROL_PLANE_RELIABILITY_V1 — 唯一控制面语义、幂等身份、outcome 状态机与独立看护

## 0. Authoring Result

```text
SPEC_STATUS                       = proposed（本文）
NEEDS_OWNER_DECISION              = NO（三项 semantic ruling 已由 Owner 2026-09-07 给定）
READY_FOR_INDEPENDENT_SPEC_REVIEW = YES
IMPLEMENTATION_ALLOWED            = NO（until status: accepted）
PRODUCTION_APPLY_ALLOWED          = NO（P0 持有 PRODUCTION_MUTATION_CONCURRENCY=1；全部 apply slot-gated）
```

## 1. Goal 与非目标

Goal：使生产 Scheduler 满足 `SCHEDULED_TASK_FAILURE_CAN_BE_SILENT = NO`，即——

1. 生产 mutation 汇聚到**唯一的一套 authoritative mutation semantics**（多入口允许，多语义禁止）；
2. 不具备 credential/readiness 的 runtime 不得把 scheduler mutation capability 表现为正常可用；
3. 一切 mutation 收敛为确定 post-state（APPLIED / NOT_APPLIED / STILL_UNKNOWN_WITH_ALERT）；
4. critical jobs 的 desired state 与 live state 被独立核对；missed run / failed run / runtime unhealthy 被检测；
5. 每一类 critical Scheduler 失败（含 watchdog 自身失败）都有 Owner 可见的主动告警。

非目标（ANTI-CHURN）：不重构 Scheduler 引擎；不改 occurrence/run 语义（D-007 原样）；不重开
PR #167 double-envelope（已判别、已修、生产已验）；不建监控"框架"；不做 job 批量迁移。

## 2. Owner Semantic Rulings（2026-09-07，normative）

1. **幂等禁止以 job name 为锚**。必须使用 caller 提供的、持久化的 LOGICAL_JOB_KEY；
   name/display name 不得作为唯一幂等依据；outcome_unknown 后不得做模糊/name matching 判定。
2. **单一控制面 = 单一 mutation semantics，不是单入口**。broker capability 与 operator CLI
   双入口保留，但必须 same store / same operation implementation / same lock / same validation /
   same logical-key & idempotency semantics / same reconciliation semantics / same occurrence-run
   model。`/usr/local/bin/agentcore-cron` 指向 stale dev worktree 字节（7a4e4864 ≠ live/main
   b476038a）由 FOLLOW_UP_DEBT **升级为 SHIP_BLOCKER（SB4）**。
3. **Watchdog 自身失败必须主动可发现**。"心跳缺失留在 Owner daily view" 不构成告警闭环；
   需要第二层独立 liveness observation（§5.7）。若 census 证明无现有 primitive 可满足，允许
   最窄新增 seam——本 spec 走该路径（census 见 §5.7.1）。

## 3. Definitions（normative）

```text
AUTHORITATIVE_STORE        = /Users/authsvc/.agent-core/scheduler/jobs.json（V2 doc）+ runs.jsonl
AUTHORITATIVE_RUNTIME      = launchd system domain ai.agent-core.runtime（authsvc；live app tree
                             /usr/local/libexec/agent-core/app）
AUTHORITATIVE_CREDENTIAL   = AGENT_CORE_CREDENTIALS_FILE（system 域 plist 注入）+ BROKER_AUTH_ORIGIN
MUTATION_SEMANTICS         = JobStore.mutateDoc 锁 + control.js operation 实现
                             （createJobOp/updateJobOp/…）+ validation + logical-key 语义
                             + reconciliation 语义 + occurrence/run model（D-007）
LOGICAL_JOB_KEY            = caller/owner 显式提供的稳定逻辑键；持久化在 job.logicalKey；
                             格式不规定（例 <owner-or-domain>:<key> 仅为概念说明）；在 live jobs
                             集合内唯一；是幂等、reconcile read-back 与 desired-state 清单的 join key
DESIRED_SEMANTICS_PROJECTION = job 的规范化语义投影，用于 same-key 比对：
                             {agentId, schedule(normalized), payload, delivery, sessionTarget,
                              timeoutSeconds, model}（logicalKey 与 name 不参与比对）
MUTATION_IDENTITY（update/delete） = 目标 job.id + expectedRevision{scheduleRevision, updatedAtMs}
CAPABILITY_READY（per runtime）    = AGENT_CORE_CREDENTIALS_FILE 已配置 ∧ caller credential entry 存在
WATCHDOG_W1                = scheduler desired-state/run-health 看护（launchd system 域，authsvc）
WATCHDOG_W2                = W1 的独立 liveness observer（launchd system 域，root；§5.7）
```

## 4. R1 — 单一 mutation semantics（MULTIPLE_ENTRYPOINTS=ALLOWED / MULTIPLE_MUTATION_SEMANTICS=FORBIDDEN）

4.1 `PRODUCTION_SCHEDULER_MUTATION_AUTHORITIES = 1` 的判定层是 **mutation semantics + store**，
不是入口数量。以下双入口保留，且**必须**继续满足全同（same …）：

| 入口 | 身份 | 必须共享 |
|---|---|---|
| broker capability `scheduler`（create/list/runs/enable/disable/remove/update） | trusted Router context | R2–R4 全部语义 + 同一 control.js op 实现 + 同一 mutateDoc 锁 + 同一 store |
| operator `agentcore-cron` CLI | effective OS user（canonical=authsvc） | 同上 |

4.2 **CLI 操作符面字节钉死（SB4）**：`/usr/local/bin/agentcore-cron` 不得解析进任何开发
worktree。生产安装必须绑定 frozen/pinned artifact——机械实现 = symlink/copy 指向
AUTHORITATIVE_RUNTIME 的 live app 树内 CLI（installer subset 是唯一 canonical 生产树），
部署 packet 记录 shasum 并在 preflight 复验。CLI 在**每次 mutation** 输出 resolved store path。

4.3 CLI store 守卫：resolved store ≠ AUTHORITATIVE_STORE（如非 authsvc $HOME）时，mutation
子命令 fail-loud（除非显式 `--store`，且输出必须回显实际目标）。禁止任何对
`~/.agent-core-scheduler-v2`、用户域 store 的"顺手"写入路径成为默认。

4.4 CLI 与 broker 的 mutation 语义一致性是**验收门**：
`CLI_MUTATION_SEMANTICS_MATCH_BROKER = PASS`（测试 §7-16/17 证明两个入口 resolve 到同一
op 实现与同一 logical-key 行为）。

## 5. Requirements

### 5.1 R2 — Logical idempotency identity（SB2a）

1. Job schema **最小扩展**：新增可选持久化字段 `logicalKey: string`（非空、格式不规定）。
   normalizeJob 校验类型；createJobOp 在 `mutateDoc` 内强制唯一性：
   `latest.jobs.some(j => j.logicalKey === input.logicalKey)` 命中即进入比对分支（5.1.2）。
2. **Create contract**（broker 与 CLI 同语义）：
   - 同 logicalKey ∧ DESIRED_SEMANTICS_PROJECTION 逐字段相等 → **ALREADY_APPLIED/EXISTING**
     （返回既有 jobId 与投影，零写入）；
   - 同 logicalKey ∧ 投影任一字段不等 → **CONFLICT**（fail closed，结构化错误
     `logical_key_conflict` 附 existing jobId 与差异字段名——不回显 message 全文，防噪音与泄漏）；
   - 新 logicalKey → CREATE。
3. `logicalKey` 对 broker create 为**必填**参数（缺省 → `invalid_arguments`）；对 CLI create 为
   必填 flag `--logical-key`。存量 22 jobs 的 key 回填（建议 `<agent>:<name>` 由 Owner 评审）
   属 production packet 的 slot-gated 一次性步骤；回填前，带 key 的 create 对无 key 旧 job
   **不做**任何 name 相似度兜底（ruling 1）。
4. **Update/delete identity**：目标 = `job.id`；调用方可附 `expectedRevision`
   `{scheduleRevision, updatedAtMs}`；mutateDoc 回调内 compare-before-write，不匹配 →
   结构化错误 `stale_target_conflict`，**零写入**。防止 stale reader 静默覆盖新状态。
5. **Read-back**：canonical read-back 按 logicalKey 精确匹配（list/read 路径暴露
   `logical_key` 过滤）；禁止 fuzzy/name 推断。

### 5.2 R3 — Mutation outcome 状态机（SB2b）

```
REQUEST → mutation identity established（create=logicalKey；update/delete=jobId[+expectedRevision]）
        → execute（mutateDoc 原子提交）
        → response
response OK                    → APPLIED（deterministic success/existing）
response 丢失/超时/传输不确定   → UNKNOWN → 自动 reconcile（不重放请求）：
        按 mutation identity 对 canonical store 只读 read-back
        ├─ 命中且投影匹配      → APPLIED（附真实 jobId）
        ├─ 未命中              → NOT_APPLIED（caller 可用同一 identity 有界重试；框架不自动重放）
        └─ read-back 自身失败  → STILL_UNKNOWN → 禁止重试 + Owner 告警（§5.6）+ reconciliation
                                  evidence 落盘（requestId/identity/时间/错误层）
```

不变式：

```text
RAW_MUTATION_OUTCOME_UNKNOWN_AS_TERMINAL_STATE = FORBIDDEN
BLIND_CREATE_RETRY                             = FORBIDDEN
DUPLICATE_CREATE_AFTER_RESPONSE_LOSS           = MECHANICALLY_PREVENTED（唯一性在 mutateDoc 锁内强制，
                                                 双入口同语义，重试即使发生也收敛为 ALREADY_APPLIED）
```

CLI 面：exit 0 ⇔ APPLIED、exit≠0 ⇔ NOT_APPLIED（store 原子 rename 保证）；CLI 增加
`reconcile --logical-key <k>`（只读 read-back）。broker 面：unknown 捕获后由 self-service
层自动执行上述 reconcile 再应答（对 Agent 透明）。

### 5.3 R4 — Capability readiness gate（SB1）

1. readiness 由 **parent** 单方判定：`CAPABILITY_READY`（§3）。判定结果经既有 child↔parent
   rpc 通道下发（availability mask 挂在既有会话建立/能力发现应答上，零新框架）；child broker
   plugin 注册 tool 前按 mask 过滤 ⇒ 未就绪 runtime 中 scheduler mutation tool **不呈现**。
2. mask 不可达/漂移的兜底：调用在 **mutation transport 之前**失败，返回显式
   `capability_unavailable`（deterministic、Agent 可理解；≠ credential_unavailable 的身份层，
   ≠ mutation_outcome_unknown）。禁止落入通用 ambiguous 渲染。
3. **启动不变式**：`CREDENTIAL_REQUIRED_FOR_MUTATION = YES`；`CREDENTIAL_PRESENT = NO` ⇒
   `MUTATION_TOOL_READY = NO`。
4. **禁止**以复制 credential 到 user-domain runtime 的方式解决（不造第二授权路径）。

### 5.4 R5 — Desired-state manifest（SB3a）

1. 文件：`/usr/local/libexec/agent-core/config/scheduler-desired-state.json`（deployment 拥有，
   只读消费；与 canonical store **不同文件、不同目录、不同 ownership** = 不同 failure surface；
   禁止把 expected state 存进 jobs.json 或 store 目录）。
2. Schema（本阶段定义 schema/ownership；实际 critical inventory 在 production preflight 冻结）：

```json
{ "version": 1,
  "jobs": [ { "logicalKey": "…",            // 与 job.logicalKey 精确 join，禁止 name join
              "expectedEnabled": true,
              "expectedSchedule": { "kind": "cron", "expr": "…", "tz": "Asia/Shanghai" },
              "expectedAgentId": "agt_…",
              "runPolicy": { "graceMinutes": 30, "maxConsecutiveFailures": 2 } } ] }
```

3. 检测类：`JOB_MISSING / JOB_DUPLICATED（同 logicalKey>1，正常应被 5.1 不变式阻止；若出现
   即为不变式破坏信号）/ JOB_DISABLED / SCHEDULE_DRIFT / TIMEZONE_DRIFT / TARGET_AGENT_DRIFT`。
4. Watchdog 对 store **只读**；永不直接 mutate jobs.json。

### 5.5 R6 — Run reliability 检测（SB3b）

基于 occurrence/run ledger（D-007）+ runs.jsonl + runtime 健康面，至少覆盖：
`EXPECTED_RUN_MISSED（nominal 过 grace 无 run）/ RUN_FAILED / RUN_STUCK（runningAtMs>2h 或
started 无 finished）/ CONSECUTIVE_FAILURE / SCHEDULER_RUNTIME_UNHEALTHY（launchd state、
GET 127.0.0.1:8790/health、control/runtime-evidence.jsonl 心跳三取其证）`。

### 5.6 R7 — Watchdog W1 + Owner alerting（SB3c）

1. W1 = launchd **system 域**定时任务（authsvc，独立 label，StartInterval≤300s）。
2. 评估 §5.4/§5.5 全部检测类 + `credential_unavailable`（W1 自身 credential/readiness 探测）。
3. 告警通道：Feishu `im.message.create` 直连 API（复用既有 feishu 凭据文件，只读；不复制、
   不落日志字节）；发送失败 → 落盘 alert 文件 + 非零退出码（launchd 可见）。
4. 每轮追加 watchdog-evidence.jsonl（判定、告警结果、desired-state manifest sha256）。

### 5.7 SB5 — Watchdog 自身失败必须主动可发现

5.7.1 **Census（2026-09-07 实测）**：现有 host 监督原语 = launchd（KeepAlive/重启，无告警）；
`com.mayf3.sixpack-watchdog`（sixpack-forge nightly 专用）、`com.svc-workflow-monitor`
（svc-workflow 服务专用）、`com.openclaw.auto-repair`（legacy openclaw）——均为单一服务
monitor，无通用 liveness+Owner 告警 primitive；OpenClaw cron 已退役；n8n 等为休眠退役候选。
**结论：无现成 primitive 可满足 ⇒ 按 ruling 3 走最窄新增 seam。**

5.7.2 **W2 = 第二观察者**：launchd system 域定时任务，**root** 身份、独立 label、独立
KeepAlive——与 W1 不同 uid/label/domain-粒度 ⇒ W1 死亡不连带 W2。职责仅一项：读 W1
heartbeat 文件（mtime freshness），超过 grace（≥2×W1 周期）→ 经同一 Feishu 直连 seam 告警
`SCHEDULER_WATCHDOG_FAILURE`。root 可读 authsvc 0600 凭据文件（只读，字节零外泄）。

5.7.3 **对称互检**：W1 亦检查 W2 heartbeat；W2 失联 → W1 告警。⇒ 单点死亡（任一）必被对方
主动发现；双方同死 = launchd/pid1 级故障（机器级，超出本 Goal，诚实记录为 residual）。

5.7.4 `launchd KeepAlive` 自动重启 = **恢复机制**，不满足告警要求；告警与重启并存、互不替代。

### 5.8 安全不变式

`NO_SECRET_BROADENING`（W1/W2/CLI 只读凭据、零复制、零日志字节）；`NO_PRODUCTION_STORE_
SPLIT_BRAIN`（§4.3 守卫 + §5.1 唯一性 + S5/S6 store 零接触）。

## 6. Acceptance Criteria（Spec review 必须逐条回答）

```text
CAN_WRONG_RUNTIME_APPEAR_MUTATION_READY  = NO   （§5.3：mask 过滤/显式 unavailable，先于 transport）
CAN_UNKNOWN_CREATE_CAUSE_DUPLICATE       = NO   （§5.1 唯一性 + §5.2 收敛；TEST-A/B/D 证明）
CAN_PRODUCTION_CLI_DRIFT_SILENTLY        = NO   （§4.2 钉死 + TEST-F 部署门）
CAN_CRITICAL_JOB_DISAPPEAR_SILENTLY      = NO   （§5.4 JOB_MISSING + §5.6 告警）
CAN_JOB_MISS_EXECUTION_SILENTLY          = NO   （EXPECTED_RUN_MISSED）
CAN_RUN_FAIL_SILENTLY                    = NO   （RUN_FAILED/CONSECUTIVE）
CAN_SCHEDULER_RUNTIME_DIE_SILENTLY       = NO   （SCHEDULER_RUNTIME_UNHEALTHY，TEST-H）
CAN_WATCHDOG_DIE_SILENTLY                = NO   （§5.7 W2/互检，TEST-G）
```

任一 = YES / UNPROVEN ⇒ SPEC = REVISE，不得进入 production-ready declaration。

## 7. Test Plan（原 10 项 + Required Failure Injection A–H）

原 10 项（调查文档 §7，保持）：1 readiness 不可用不呈现；2 canonical create/list/update；
3 commit 后响应丢失→reconcile 恰一；4 同逻辑重试 singleton；5 missing 检测；6 disabled/drift
检测；7 missed run 检测；8 failed run 告警；9 watchdog 独立失败域；10 非 canonical store 不成
为目标。

新增 **Required Failure Injection**：

| # | 注入 | 断言 |
|---|---|---|
| A | create commit 成功 → 响应故意丢弃 → reconcile 同 logicalKey | 恰一 job；APPLIED |
| B | commit 前请求丢弃 → reconcile → NOT_APPLIED → 同 identity 重试 | 恰一 job |
| C | 同 logicalKey + 冲突 payload | CONFLICT；零非预期写入 |
| D | stale expectedRevision update | `stale_target_conflict`；新状态保留 |
| E | user-domain runtime 无 credential | mutation capability 在 scheduler mutation 之前不可用/不呈现 |
| F | 生产 CLI 字节漂移于 frozen artifact | 部署/readiness 门 FAIL（CLI_BYTES_MATCH_EXPECTED、CLI_STORE_TARGET=CANONICAL） |
| G | watchdog 进程停止 | W2 独立检测 → Owner 告警 |
| H | Scheduler 停止而 W1 存活 | W1 告警（与 G **分别**证明） |

## 8. Rollout（全部 slot-gated：P0 释放 + fresh census 后执行）

1. 实现轮（非生产，可立即）：schema/op/readiness/watchdog/CLI 代码 + §7 全部测试 + isolation
   fixtures。
2. Production deployment packet：CLI 钉死替换（§4.2，shasum 入 packet）、desired-state 冻结
   （Owner 评审 critical inventory + 存量 logicalKey 回填）、W1/W2 launchd 安装、readiness
   mask 部署。含 rollback packet（恢复原 CLI symlink 字节、卸载 W1/W2、mask 回退 =
   现状行为、schema 新字段对旧代码无消费方——向后兼容证明入 packet）。
3. 验收 = §6 八问全 NO 机械证明 + §7 十八项 PASS + 独立 audit ACCEPT。

## 9. Classification

```text
SB1 = credential readiness / capability exposure gate（§5.3）
SB2 = stable logical idempotency + outcome reconciliation（§5.1/§5.2）
SB3 = desired-state + run-health watchdog + Owner alerting（§5.4–5.6）
SB4 = production operator CLI byte drift（§4.2——由 FOLLOW_UP 升级）
SB5 = watchdog self-failure detection（§5.7——census 后以最窄 seam 关闭：W2+互检）
MF  = name→logicalKey 迁移辅助、CLI store-path 守卫细节、reconcile CLI 子命令
FOLLOW_UP_DEBT = 用户域/scheduler-v2 store 退役裁决；20 字段扁平 schema 可用性；G4 异常形状计数
```
