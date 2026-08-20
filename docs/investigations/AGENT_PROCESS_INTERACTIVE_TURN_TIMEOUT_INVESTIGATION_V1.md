# AGENT_PROCESS_INTERACTIVE_TURN_TIMEOUT_INVESTIGATION_V1 — Evidence

- 日期: 2026-08-19 · 性质: READ-ONLY INVESTIGATION（无代码 / 无 production timeout / 无 Scheduler / 无重启 / 无 merge）
- 调查基线: production checkout `/Users/yanfenma/workspace/project/production-dsh-agent-core` @ `93f9acf`（= 运行中代码）；证据根 `/Users/yanfenma/.agent-core`。调查执行时（2026-08-19）main@`053780d` 相对 `93f9acf` 的增量 commit 均 docs-only（packages/ 零差异）；交付时 origin/main 已推进至 `fe2c639`（ChatGPT provider / per-Agent model-override，packages/ 有变更）——已复核：`turn()`/`deliver()` timeout 语义在新 main 逐字不变（`DSH_AGENT_TURN_TIMEOUT ?? '300000'` / `DSH_AGENT_DELIVER_TIMEOUT ?? '30000'`），§2/§3 结论不受影响；新 per-Agent seam 仅覆盖 provider/model，不覆盖 timeout
- 事故入口: Feishu 回复 `[agent-core] delivery failed: turn timeout for session main (agent agt_shopping-list-agent)`

---

## 1. 现场取证

### 1.1 标识

| 项 | 值 | 来源 |
|---|---|---|
| agentId | `agt_shopping-list-agent`（购物清单管家） | agents.json / err.log |
| sessionId | `main`（DSH native session，workspace-bound） | err.log:262-263 |
| Feishu conversation | group `oc_96ba3f8c3476edac2fb64ee89f842f4e` | err.log:261 |
| production runtime PID | 34875，启动 2026-08-18 18:19:47 | `ps` |
| AgentProcess PID | **25059**（`dsh --profile agent-core-production`，deepseek-harness CLI），启动 2026-08-19 09:59:33，**至今存活（调查时已运行 >12h）** | `ps -p 25059` |
| provider / model | `oc-go`（`https://opencode.ai/zen/go/v1`，openai-completions）/ `deepseek-v4-flash`，maxTokens 8192 | 运行进程 env `DSH_AGENT_PROVIDER`/`DSH_AGENT_MODEL` + session `request/header` + home settings.yaml |
| Feishu messageId | **未在任何 durable evidence 中留存**（connector 不落盘 ingress messageId；feishu-executes/reactions.jsonl 止于 07-18）——evidence gap，见 §7 |
| DSH receipt messageId（turn 内 user message id） | turn1 `25393bf6-…`，turn2 `0b2f1ebc-…`，turn3 `bf273c94-…`，turn4 `24f987db-…` | session.jsonl |

证据文件：`~/.agent-core/logs/runtime.err.log`（router 事件流，无 wall-clock 时间戳——evidence gap）、`~/.agent-core/homes/agt_shopping-list-agent/sessions/…/main/session.jsonl`（毫秒时间戳，1792 events）、`ps`。

### 1.2 还原时间线（session.jsonl 毫秒时间戳 + err.log 顺序）

| # | 时刻 (2026-08-19) | 事件 |
|---|---|---|
| 1 | 09:59:33 | router `ensureRunning` spawn PID 25059；ready 770ms；`session main created (0 events)` |
| 2 | 09:59:34.482 | **turn 1 start**（用户消息 1：「…用小红书的Skill去搜一下…先用比价的skill…再用添加购物车的skill添加到购物车」） |
| 3 | 10:04:20.68 | **外部副作用发生**：加购 API 返回 `cartQuantity: 39`（item_1787105060680051000，淘宝文轩在线 ¥60.49）；购物清单知识库同轮更新 |
| 4 | **≈10:04:34.5** | **USER_VISIBLE_TIMEOUT_AT（第 1 次）**：`started+300000ms` deadline 到 → `runTurn` throw `turn timeout for session main` → Feishu 收到 `[agent-core] delivery failed: turn timeout…`（时刻为推导值：turn/start+300s；router 日志无时间戳） |
| 5 | 10:05:20.107 | **turn 1 end（reason: completed）**——超时后 46s 真实完成；最终答案「全部搞定！✅…」**从未送达**（turn() 已 throw，reply 无人再读） |
| 6 | 10:11:14.267 | 用户消息 2「你好像超时了，要不就只做一件事情…」→ **reuse PID 25059** → turn 2 end 10:11:34（20.5s）→ 回复「✅ 比价完成！」送达 |
| 7 | 10:14:29 | 用户消息 3（旗舰店/盗版核实）→ turn 3 end 10:15:11（42.4s）→ 回复送达 |
| 8 | 10:25:36.765 | **turn 4 start**（用户消息「没问题」） |
| 9 | **≈10:30:36.8** | **USER_VISIBLE_TIMEOUT_AT（第 2 次）**：deadline 到 → 第二条 `delivery failed: turn timeout` |
| 10 | 10:31:08.049 | **turn 4 end（reason: completed）**——超时后 32s 完成；最终答案（天猫超市加购 4 种 API 组合均被 `CART_ITEM_MUST_CHOOSE_SKU` 拦截的汇报）**从未送达** |
| 11 | 调查时 | PID 25059 仍存活；无 idle reaper，进程常驻至 router 停止（index.js 仅 teardown 时 `proc.shutdown()`） |

### 1.3 必答字段

```text
USER_VISIBLE_TIMEOUT_AT = 2026-08-19 ≈10:04:34.5 与 ≈10:30:36.8（本地时间；推导自 turn/start+300000ms，router 日志无 wall-clock）
PROMPT_RECEIPT_RECEIVED = YES（两次超时 turn 的 session/prompt receipt 均正常返回；消息入队、模型开跑）
TURN_END_EVENT_RECEIVED = 超时时刻 NO（router 侧 done 未成立）；事后 YES（session.jsonl turn/end completed @10:05:20.107 / 10:31:08.049）
TURN_EVENTUALLY_COMPLETED = YES（两次均为 reason: completed，分别超时后 +46s / +32s）
ASSISTANT_OUTPUT_EVENTUALLY_PRODUCED = YES（两次均有完整最终 assistant 文本；均未送达用户）
TOOL_CALL_OCCURRED = YES（turn1: 40 次 — skill×2/bash×27/read×3/todo_write×3/job_output×4/read_image×1；turn4: 27 次 — bash×24 等）
EXTERNAL_SIDE_EFFECT_OCCURRED_OR_POSSIBLE = YES·已证实（turn1 于 10:04:20 真实加购淘宝购物车 cartQuantity:39 + 写购物清单 KB——早于超时触发；turn4 尝试天猫超市加购被平台拦截，无 mutation）
AGENT_PROCESS_STILL_ALIVE = YES（PID 25059）
```

### 1.4 分类判定

**OUTCOME_CLASSIFICATION = G（turn 真实完成，但 Router 交付层 deadline 先到）叠加 A（工作最终成功）**。
排除：B（provider 卡住——流式/工具全程活跃）、C（tool 挂死——所有 tool 正常返回）、D（receipt 未返——见上）、E（child 退出——child 存活）、F（watermark/关联丢失——session 事件序列完整一致，`messageId` watermark 与 idle 状态本可满足，只是晚于 deadline）。

---

## 2. Timeout Authority 全链路（源码级，不合并为一个数字）

| # | Authority | owner package/file:line | 当前默认 | 配置来源 | 级别 | deadline 起点 | 超时是否真正取消 | 超时后 process 是否继续 | user-visible |
|---|---|---|---|---|---|---|---|---|---|
| T1 | Feishu WS ingress / 事件接收 | `@larksuite` oapi WS SDK（外部，feishu-connector 装配） | SDK 默认 | SDK | per-event | — | n/a | n/a | 无 |
| T2 | Feishu reply 发送（im HTTP） | feishu-connector/src/index.js `reply()`（经 lark SDK） | repo 未设（SDK/HTTP 默认） | 无 seam | per-reply | 发送时 | 否（HTTP 自身） | n/a | 失败仅 best-effort 吞掉（仅错误回复路径） |
| T3 | product-api HTTP server | product-api/src/index.js:275-276 | `requestTimeout=0`（禁用）/`headersTimeout=120000` | hardcoded | 全局 server | 请求到达 | n/a | n/a | 无（刻意让位 Router turn timeout） |
| T4 | notification-ingress HTTP server | notification-ingress/src/index.js:211-212 | 同 T3 | hardcoded | 全局 server | 请求到达 | n/a | n/a | 无 |
| T5 | **Router 交互 turn deadline（本次事故 authority）** | agent-router/src/process.js:302 `turn()`/`runTurn()` | **300000ms** | `DSH_AGENT_TURN_TIMEOUT` env（**生产未设**，已用 `ps eww 34875` 验证） | 全局（runtime 内所有 Agent 一律同值）· per-turn | `runTurn` 调用即起表（**含 single-flight 排队等待 + prompt receipt 等待**） | **否**——仅本地 throw；不通知 child、不 cancel、不 kill | **是**——child 与 DSH turn 继续跑完；turnQueue 放行下一 turn | Feishu `[agent-core] delivery failed: turn timeout…` |
| T6 | initialize（spawn→ready） | process.js:255 `ready()` | 90000ms | **hardcoded 参数默认**（无 env） | per-spawn | spawn 重试循环 | 否（throw 而已；且 request 无 deadline，活而哑的 child = 永久挂起） | spawn 失败路径 | 经 onIngress catch 的错误回复 |
| T7 | JSON-RPC request deadline | process.js:239 `request()` | 无（除非调用方传） | per-call 参数 | per-call | 调用时 | 仅本地 reject；child 不感知 | 是 | 经调用方 |
| T8 | deliver() admission receipt | process.js:380 | 30000ms | `DSH_AGENT_DELIVER_TIMEOUT` env | 全局 | session/prompt 发出 | 仅 receipt；**turn 本身永不受影响**（设计如此） | 是 | notification-ingress `request session/prompt timed out after 30000ms`（err.log:122 实证） |
| T9 | **turn() 内 prompt receipt** | process.js:316 `request('session/prompt')` **未传 timeout** | **无界** | 无 | per-turn | — | 否 | child 死→pending 永不 reject→**turnQueue 永久 wedged**（PR #11 `AGENT_PROCESS_PENDING_RPC_CAN_HANG_FOREVER = MUST_FIX`） | 无（挂死） |
| T10 | Scheduler run timeout | scheduler/src/scheduler.js:55,507-535 | `AGENT_TURN_SAFETY_TIMEOUT_MS=3600000` 或 `payload.timeoutSeconds*1000` | job payload | per-occurrence | invoke | `controller.abort()` **仅置信号**；scheduler-router 只记 `aborted` flag，不 cancel turn、不 kill | 是 | `cron: job execution timed out` |
| T11 | scheduler-router bridge turn | scheduler-router/src/index.js:107-108 | `request.timeoutMs+30000`，否则 300000 | 派生自 T10 | per-scheduled-run | turn 前 | 否 | 是 | outcome.status=error |
| T12 | Broker capability HTTP | broker/src/transport.js:51,104,451 | `DEFAULT_TIMEOUT_MS=15000`（per-capability `http.timeoutMs` 可覆盖） | transport 配置 | per-request | fetch 时 | **是**（`AbortSignal.timeout` 真 cancel） | n/a | `transport_failure` 返回给 agent |
| T13 | Provider 请求 / 流空闲 | DSH CLI `llm-pi-ai`（**外部 repo** deepseek-harness） | `streamIdleTimeoutMs` 默认 300000；`timeoutMs` 未设 | per-provider settings.yaml（oc-go 块未设任何 timeout） | per-provider | 流空闲计时 | 是（中止模型调用） | agent 收模型错误 | session 内模型错误 |
| T14 | Tool 执行 | DSH CLI / skills（外部） | per-tool | per-tool | per-call | — | 视 tool | n/a | session 内 |
| T15 | graceful shutdown | process.js:395 `shutdown()` | RPC ack 5000ms + 退出等待 30000ms | hardcoded | per-process | shutdown 调用 | **否**——超时仅 resolve `{timeout:true}`，**不升级 SIGKILL**；kill9() 存在但 router 不调用 | **是**（可能残留进程） | 无 |

v2-ingress-gate（production-runtime/src/v2-ingress-gate.js）：仅 dedup，无 timeout authority。

---

## 3. 当前配置能力核实（对照运行中 main + 生产 env）

```text
TURN_TIMEOUT_CONFIGURABLE_NOW = YES——唯一 seam 是 production-runtime 进程级 env DSH_AGENT_TURN_TIMEOUT（整数 ms）；
                                生产进程 env 实测（ps eww 34875）未设置 → 生效代码默认 300000（process.js:302）。
CONFIG_SEAM = process env（launcher scripts/production-runtime.mjs 不注入任何 DSH_AGENT_*；继承自启动环境）
CONFIG_PRECEDENCE = 单层：env → hardcoded 默认；无文件配置、无 deployment manifest、无覆盖链
PER_AGENT_OVERRIDE_AVAILABLE = NO——AgentDefinition（agents.json）条目仅 id/name/description/disabled
                              （agt_shopping-list-agent 实测），无 model/provider/timeout 字段；
                              initialize 的 provider/model 也是全局 env（DSH_AGENT_PROVIDER/DSH_AGENT_MODEL）。
                              （交付时附注：origin/main@fe2c639 新增 per-Agent provider/model override seam
                              `<productionRoot>/agent-model-overrides.json`——AGENT_CORE_CHATGPT_SUBSCRIPTION_PROVIDER_V1，
                              ENABLED_AGENTS=1=agt_cto-agent——该 seam 只覆盖 provider/model，
                              四个 timeout 字段仍无任何 per-Agent 面。）
```

相邻能力（对照）：`DSH_AGENT_DELIVER_TIMEOUT`（30s，env，全局）；initialize 90s 与 shutdown 30s/5s 纯 hardcoded，**连 env 都没有**。message/delivery 参数无 timeout 面。Scheduler 的 timeoutSeconds 是 per-Job 的（payload），但只作用于 scheduled occurrence，不作用于交互 turn。

---

## 4. 推荐最小配置模型（不实现）

Owner 判定：**AgentProcess / production deployment configuration**（不属于 Feishu / Binding / Session——本次事故链条里 Feishu connector 无 timeout 参与，Binding/Session 与 deadline 无关）。

- **global defaults**：production deployment env 四个独立字段（延续 env seam，launcher 可控）：
  - `DSH_AGENT_INITIALIZE_TIMEOUT_MS`（现值 90000 hardcoded → 提升 为可配）
  - `DSH_AGENT_PROMPT_RECEIPT_TIMEOUT_MS`（现值 无界 —— T9 —— 必须有界，修复 MUST_FIX 的配置面）
  - `DSH_AGENT_TURN_TIMEOUT_MS`（= 现有 DSH_AGENT_TURN_TIMEOUT 语义，建议改名统一命名族或保留现名）
  - `DSH_AGENT_SHUTDOWN_GRACE_MS`（现值 30000 hardcoded → 可配）
- **optional per-Agent override**：AgentDefinition 增加可选 `timeouts: { initializeTimeoutMs?, promptReceiptTimeoutMs?, turnTimeoutMs?, shutdownGraceMs? }`，precedence = per-Agent > global env > code default。需要 Spec 授权（AgentDefinition 结构变更）。

不合并成一个 timeoutMs：四者生命周期起点与语义完全不同（spawn-retry 循环 / 单条 RPC receipt / 整 turn watermark+idle / 进程退出等待），源码证据见 §2 T6/T9/T5/T15。

V1 禁止项（已遵守）：infinite timeout、per-message 任意 timeout、dynamic timeout scheduler、Feishu special-case——均不引入。

---

## 5. 失败语义（建议分类，供 child Spec 冻结）

```text
initialize_timeout       — ready() 90s 内模型路由未注册（且 T9 修复前存在无界挂起变体）
prompt_receipt_timeout   — session/prompt receipt 超期（T8 的 30s 属此类；T9 修复后 turn 内也有界）
turn_deadline_exceeded   — runTurn watermark+idle 未在 deadline 内成立 ← 本次事故两次
provider_timeout         — 模型/流层错误（外部 T13，DSH session 内可见）
tool_timeout             — 工具层超时（外部 T14）
child_exited             — AgentProcess exit/error（应触发 pending cleanup + 队列释放，PR #11 MUST_FIX）
shutdown_timeout         — graceful 退出超时（T15；且应升级 kill 判定，非本调查范围）
```

对 `turn_deadline_exceeded` 的强制语义：

```text
TIMEOUT_OUTCOME = outcome_unknown   — deadline 到期只证明「等待方放弃」，不证明执行终止（本次：两次均在
                                   +46s/+32s 后 completed；禁止在无终止证据时宣称 failed）
```

禁止：自动重发同一用户消息（当前代码也未重发——正确，保持）；宣称任务已失败且无副作用（本次加购已真实发生）；直接复用可能仍在运行的半死 process（当前 reuse 语义需配套：single-flight 已保证下一 turn 排队等待上一 turn 结束，见 process.js:302-309 注释，风险受控但 outcome 语义仍缺）。

---

## 6. PR #11 对齐

PR #11（`agent/security-reliability-hardening-plan-v1`，docs-only）已冻结 hardening program（`AGENT_CORE_HARDENING_PROGRAM_V1.md`）及两个 child：
`AGENT_PROCESS_LIFECYCLE_HARDENING_V1`（§4.1）与 `SCHEDULER_TIMEOUT_OUTCOME_V1`（§4.3）。

判定：

```text
AGENTPROCESS_CHILD_SPEC_CHANGE_REQUIRED = YES（scope 级）
SCHEDULER_CHILD_SPEC_CHANGE_REQUIRED = NO（本次为人工 main turn，非 scheduled occurrence；T10/T11 语义已被 Scheduler child 覆盖）
```

- 本次结论归属 **AGENT_PROCESS_LIFECYCLE_HARDENING_V1 child Spec**：§4.1 现有最小范围（process state / shared startup promise / pending RPC cleanup / initialize·prompt receipt·parent-RPC deadline / stdin failure / event watermark / turnQueue 不 wedged / shutdown 终态 / evidence buffer 有界）**已覆盖 T6/T9/T15 的修复面**，但 **交互 turn deadline（T5）的配置模型（§4）与 turn_deadline_exceeded → outcome_unknown 语义（§5）未显式入 scope**。建议：在该 child Spec authoring 时把 §4/§5 本调查结论并入其最小范围（或作为其 amendment）——不是新 Spec。
- 不新建跨 AgentProcess/Scheduler 的 Timeout Framework（两 child 各自冻结自己的面；交互 turn 与 scheduled occurrence 的 timeout 语义天然不同入口）。
- 本调查为 evidence authority，不授予任何实现权限。

## 7. Evidence gaps（顺带记录，不属本次 scope）

- router/connector 事件流无 wall-clock 时间戳（err.log），USER_VISIBLE_TIMEOUT_AT 只能推导。
- Feishu messageId 不落任何 durable evidence（feishu-executes/reactions.jsonl 机制未覆盖 ingress/reply 主路径）。
- `journal.db` 为 0 字节死文件；kernel.sqlite 表无本事故路由记录。

---

## Final

```text
AGENT_PROCESS_INTERACTIVE_TURN_TIMEOUT_INVESTIGATION_V1 = PASS

INCIDENT_AGENT = agt_shopping-list-agent
INCIDENT_SESSION = main

ROOT_CAUSE = Router 交互 turn deadline 为全局固定 300000ms（DSH_AGENT_TURN_TIMEOUT 未设，代码默认，全局无 per-Agent 面）；
             两次真实 turn 分别用时 5m46s / 5m32s 超过 deadline；deadline 到期仅本地 throw——不取消 child、不通知 DSH、
             无人再读最终 reply。分类 G(+A)：turn 真实完成，交付层先放弃；非 provider/tool/watermark/child-exit 故障。
TURN_EVENTUALLY_COMPLETED = YES（turn1 @10:05:20.107 / turn4 @10:31:08.049，均 reason: completed；答案均未送达）
OUTCOME_CLASSIFICATION = turn_deadline_exceeded → outcome_unknown（事后证实 completed + 外部副作用已发生）

CURRENT_PROVIDER = oc-go（https://opencode.ai/zen/go/v1）
CURRENT_MODEL = deepseek-v4-flash（maxTokens 8192）

CURRENT_TIMEOUT_CHAIN = Feishu WS(T1,SDK) → router turn deadline(T5,300s,事故点) ⊃ prompt receipt(T9,无界) →
                        DSH provider stream idle(T13,300s,外部) / tool(T14,外部)；旁路：deliver receipt(T8,30s)、
                        scheduler(T10 3600s/T11 +30s)、broker(T12 15s,true cancel)、HTTP servers(T3/T4 禁用)
CURRENT_EFFECTIVE_TURN_TIMEOUT_MS = 300000（默认；生产 env 未设，ps eww 34875 验证）

TURN_TIMEOUT_CONFIGURABLE_NOW = YES（仅全局 env DSH_AGENT_TURN_TIMEOUT）
PER_AGENT_TIMEOUT_OVERRIDE_AVAILABLE = NO

RECOMMENDED_CONFIG_OWNER = AgentProcess / production deployment configuration（非 Feishu/Binding/Session）
RECOMMENDED_TIMEOUT_FIELDS = initializeTimeoutMs / promptReceiptTimeoutMs / turnTimeoutMs / shutdownGraceMs
                            （global env defaults + optional per-Agent override；不合并单值）

TRUE_CANCELLATION_AVAILABLE = NO（throw-only；不 cancel 不 kill）
PROCESS_CONTINUES_AFTER_TIMEOUT = YES（PID 25059 至今存活；两 turn 均在超时后跑完）

AGENTPROCESS_CHILD_SPEC_CHANGE_REQUIRED = YES（AGENT_PROCESS_LIFECYCLE_HARDENING_V1 并入 T5 配置模型 + outcome_unknown 语义）
SCHEDULER_CHILD_SPEC_CHANGE_REQUIRED = NO

IMMEDIATE_SAFE_WORKAROUND = 提升 runtime 进程 env DSH_AGENT_TURN_TIMEOUT（如 900000）后重启 production-runtime——
                            属 production 变更，需 owner 决策；本轮不动。运行面无其他即时风险（无重发、无 half-dead 复用乱序）。

PRODUCTION_CHANGE = NONE
KERNEL_CHANGE = NONE

NEXT_SMALLEST_ACTION = 在 PR #11 的 AGENT_PROCESS_LIFECYCLE_HARDENING_V1 child Spec 中冻结 §4 配置模型与
                       §5 turn_deadline_exceeded→outcome_unknown 语义（docs-only，先于任何实现）。
```
