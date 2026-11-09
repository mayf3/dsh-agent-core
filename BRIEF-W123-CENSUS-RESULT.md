# BRIEF-W123-CENSUS-RESULT — CTR-W1/W2/W3 实施状态普查

普查日期：2026-11-10（Asia/Shanghai）；记录时间：2026-11-09T23:45:45Z。
仓库：`mayf3/dsh-agent-core`；任务授权：用户要求执行 `BRIEF-W123-CENSUS.md`，只读普查、仅两份文档提交、push/PR(base main) 不合并，或 bundle 交接。
**基线 B = main / origin/main / 初始 HEAD `ab91a232239b9e36eeeb630919c9ef5f93cdc36a`**；本次 `git ls-remote origin refs/heads/main refs/heads/census/w123-implementation` 确认远端 main 同 B、目标远端分支尚不存在。
下文每个源码/权威 `path:line` 坐标均固定在 B，EXISTS 仅表示该快照的源码存在，不表示已部署、运行成功或用户收到消息。

治理路由：`PREFLIGHT / REUSE / BRIEF / DURABLE`（发布普查文档，独立核查）；`ROUTE_STAGE=IMPLEMENTATION` 仅指调查文档交付；`AUTHORITY_ACCEPTED_IN_BASE=YES`；`IMPLEMENTATION_AUTHORITY=contracts`。本任务产品实现/生产操作/合并均未授权且未执行。
`GOAL_OR_TARGET`：五节给出 W1/W2/W3 判定、复用和最小差量；`CURRENT_GAP`：缺 main 实施状态普查。
`EVIDENCE_NEEDED`：固定 B 的 authority、调用链、负面搜索范围和文档 diff；`DONE_WHEN`：仅 brief+本报告提交并 PR，或可验证 bundle；`EXPANSION_TRIGGER`：基线相关变化、未解权威冲突或超出只读范围。
`MUTATION_AUTHORIZATION=VALID`；`ISOLATED_WRITE_SURFACE=YES`：原 worktree 的 Git 元数据只读，提交使用 `/private/tmp/w123-census-delivery.git` 的独立 HEAD/index/ref，parent=B，目标 ref=`census/w123-implementation`，不改其他 checkout。

权威读取：`.agents/README.md`、`.agents/local/README.md`、Product Architecture、Current Decision index、D-008/D-009 相关边界及 `spec-governance` 的 PREFLIGHT 模式。
主合同 `docs/specs/AGENT_DELIVERY_RESILIENCE_V1.md:1-46,290-306,416-436` 为 accepted/contracts（§10 有 acceptance；旧 authoring 段的 proposed 不是当前接受状态）。
现行 reconciliation 父引用以 accepted corrective AMEND `docs/specs/AGENT_DELIVERY_RESILIENCE_D009_ALIGNMENT_V1.md:35-42,96-116` 为准：CTR-W3 适用 D-009 / Timeout V3，入口提示与补投义务保留；D-007 是历史引用。未发现阻断本次普查的未解权威冲突。

## 1. W1 等待上限可配置 — PARTIAL

**已存在 caller bound 和 per-Agent 生命周期配置；缺按 surface/agent class 的专用 caller-wait 配置及入口接线。**

| 观察 | B 上的坐标与结论 |
|---|---|
| 源码默认值 EXISTS | `packages/agent-router/src/deadline-config.js:45-70`：四生命周期字段，`turnTimeoutMs=300000`；新 env `DSH_AGENT_TURN_TIMEOUT_MS`，旧名 `DSH_AGENT_TURN_TIMEOUT` 兼容。不是固定 100000ms。 |
| 静态配置 EXISTS | `packages/agent-router/src/deadline-config.js:145-195,226-258`：per-Agent override > 全局 env > 默认值；载体 `agent-process-overrides.json`。`packages/agent-router/src/index.js:208-227` 校验已知 Agent，`packages/agent-router/src/process-registry.js:374-379` 注入 process。 |
| 当前 caller 预算来源 EXISTS | `packages/agent-router/src/index.js:283-288` 将 `perAgent(agentId).turnTimeoutMs` 提供给 route-chain；`packages/agent-router/src/route-chain.js:309,329` 使用 `deadlineMs ?? resolveTurnDeadlineMs(agentId) ?? 300000`，整条链含 acquire/prepare 消耗。 |
| caller 与 turn 分离机制 EXISTS | `packages/agent-router/src/route-chain.js:398-399` 把剩余预算传给 `turn()` 第四参；`packages/agent-router/src/process/agent-process.js:250-262`、`packages/agent-router/src/process/turn-execution.js:366-386` 等待 `min(turn deadline, caller bound)`，区分 `caller_wait_exceeded` / `turn_deadline_exceeded`。 |
| 入口现状 | `packages/agent-router/src/ingress-delivery.js:104-116` 未选择 surface/class 的 `deadlineMs`；`packages/scheduler-router/src/index.js:212-219` 有 Scheduler 自己的 `request.timeoutMs+30000` / `300000` 预算，不等于通用 surface/class 配置。 |

100s 的来源是合同历史 `OBS-006`（`docs/specs/AGENT_DELIVERY_RESILIENCE_V1.md:119-125`），不能当作当前 main 的固定默认或本次实测生产值。配置源码注释中的旧生产值也不是新鲜运行证据；**当前生产 env、override、实际 caller 等待值均 UNKNOWN**。
`hardDeadlineAt` 由 turn 生命周期值生成（`packages/agent-router/src/process/turn-execution.js:259-268`），不能把它等同任一入口的 caller bound。

缺口：surface/agent class 的可信分类、caller-wait 配置选择器、入口到现有预算参数的接线、默认值及优先级配置文档。
实现约束：`docs/specs/AGENT_PROCESS_LIFECYCLE_HARDENING_V4.md:850-920` 保留四字段静态所有权，禁止渠道/Binding/Session 动态覆盖和任意 per-message override；W1 不能实现为动态改写 `turnTimeoutMs` 或增加第五个 AgentProcess 生命周期 timeout。
负面查证范围：Router、production-runtime、Feishu、Product API、scheduler-router 的相关配置及入口调用链；未读取生产配置或启动进程。

## 2. W2 late 回复补投 — PARTIAL

**exact late 成功结算、输出查询和通道基础存在；缺符合 CTR-W2 的向原入口一次自动补投、标记及不可投递处置链。**

| 已存在机制 | B 上的坐标、覆盖与限制 |
|---|---|
| exact late 成功 EXISTS | `packages/agent-router/src/process/event-correlation.js:191-210`：unknown 后 exact success 写 `late_completed` / `exact_turn_end_success` 和 final output，完成 execution、释放 fence；这里没有向入口发回复。 |
| settle-once / 通知 EXISTS | `packages/agent-router/src/reconciliation/state-machine.js:287-319,327-379`：首次结算获胜，后续重复/冲突审计；结算后通知监听器。结算一次不等于外部补投一次。 |
| 查询/订阅 EXISTS | `packages/agent-router/src/reconciliation/query.js:160-187,232-236`，Router 导出 `packages/agent-router/src/index.js:394-417`：`getTurnReconciliation`、`readFinalAssistantOutput`、`onTurnReconciled`。 |
| 有界内存正文 EXISTS | `packages/agent-router/src/process/evidence-buffer.js:26`、`packages/agent-router/src/process/turn-execution.js:89-119`：最多 1 MiB 的 UTF-8 安全尾部，可截断，不能无条件当完整答案。 |
| durable turn-recovery EXISTS | `packages/agent-router/src/reconciliation/durable-file.js:302-321` 明确落盘 `finalAssistantOutput:null`，仅保留 sha256/originalBytes/truncated；**不证明重启后可取回复正文**。 |
| 原入口关联/投递 EXISTS | `packages/agent-router/src/ingress-authenticated.js:35-59`、`packages/agent-router/src/reconciliation/ingress-correlation.js:4-31` 有认证关联；正常回复调用 `packages/agent-router/src/ingress-delivery.js:148-152`；Connector 的目标解析/发送见 `packages/feishu-connector/src/core.js:294-354`、`packages/feishu-connector/src/index.js:304-316`。 |
| CTR-R5 基础 EXISTS | `packages/agent-router/src/reconciliation/delivery-failures.js:6,17-59`：四类结构化分类、计数、分窗告警；`packages/agent-router/src/process/delivery-resilience.js:103-112` 在 transport catch 计数，unsafe/unknown 直接 throw，不进入 dead-letter。缺 late 补投失败调用点。 |
| 可检索 dead-letter EXISTS | `packages/agent-router/src/reconciliation/delivery-failures.js:67-95`：durable 文件和 exact-id getter；`packages/agent-router/src/route-chain.js:472-473` → Router `packages/agent-router/src/index.js:326-327` 导出 `getDeliveryDeadLetter(id)`。当前留存的是入站 message/路由/ingress 摘要，`retry_exhausted_no_replay`，不是 late 回复及其补投回执。 |

PR **#590**（merge `0386b34a3d1054c71cbe51a2310fdff4d55c992b`，B 的祖先）覆盖冷 resume/传输问题：`packages/agent-router/src/process/delivery-readiness.js:13-57` 的应用层 prepare，`packages/agent-router/src/process/delivery-resilience.js:64-79,81-131` 的坏代际隔离、退出证明、原始+两次重试（250/500ms）、耗尽死信/重发提示。它没有补齐 CTR-W2 的 late 回复桥；unknown 不得借传输重试路径重放。

现有 late 消费者也有局部覆盖，不能漏计或混称补投：

- Product API `packages/product-api/src/conversation/service.js:90-133` 订阅结算、读取原 request 的 native source、持久化可查询结果，明确 never resends；属于 pull 结果恢复。
- ASM `packages/production-runtime/src/agent-session-reply-wait.js:42-71,101-108,128-134` 在等待窗口内能返回 late completed，timeout 后 dispose listener，没有外部补投。
- Website inquiry `packages/production-runtime/src/agent-session/website-inquiry/native.js:16-25,44-50` 结算自己的 pending inquiry；不是通用飞书补投消费者。

缺口：按原 handle/目的地关联的一次补投消费者、`（补投）` 标记、可达性/失败处置、可检索 late 回复或不可用原因及投递结果、CTR-R5 接线；处理截断/无正文/重启与通知竞态，不把 settlement audit 当外部发送去重回执。
负面查证范围：`packages` 非测试 JS/MJS/TS 的 `补投|late.?reply|redeliver|late.?deliver` 和 `onTurnReconciled(`，逐读相关消费者及 ingress 回复分支；没有发现上述端到端实现。当前真实目的地可达性与已安装版本 UNKNOWN。

## 3. W3 outcome_unknown 入口可见性 — PARTIAL

**unknown 的 reconciliation/fence 和机器返回已存在；缺规定的人类提示及与 W2 的入口衔接。**

| 观察 | B 上的坐标与覆盖 |
|---|---|
| unknown 登记/恢复 EXISTS | `packages/agent-router/src/process/event-correlation.js:270-285` 登记 unknown、安装 fence、尝试已有证据并安排恢复；`packages/agent-router/src/reconciliation/state-machine.js:204-230` 保存 `pending_unknown` / `await_late_evidence` / active fence。 |
| 精确查询与钩子 EXISTS | `packages/agent-router/src/reconciliation/query.js:160-187,223-236`、`packages/agent-router/src/index.js:389-417` 提供查询、caller 三元组关联、结算订阅。 |
| Feishu 部分提示 EXISTS | `packages/agent-router/src/ingress-delivery.js:117-133,186-207` 保留 unknown 错误，但仅 best-effort 回复 `[agent-core] delivery failed: ...`；caller 超时英文来自 `packages/agent-router/src/process/turn-execution.js:373-384`。不是合同要求的结果未证实/稍后补投或请重发提示。 |
| Product API 机器可见 EXISTS | `packages/product-api/src/index.js:110-118,384-390` 返回 outcome_unknown、handle、deadline、evidence；native conversation 的 `packages/product-api/src/conversation/native-proof.js:25-38` 保存 unknown，`packages/product-api/src/conversation/service.js:125-133` 刷新原请求结果。未证明外部客户端实际显示人类提示。 |
| Scheduler 钩子 EXISTS | `packages/scheduler/src/scheduler.js:80-90,258-263` 在 tick 准入前做 readback；`packages/scheduler/src/occurrence.js:350-429` 分开结算 exact business outcome 与 termination-only；`packages/scheduler-router/src/index.js:252-305` 保留 unknown/exact handle。它们结算 occurrence，不能代替聊天回复。 |

现行权威：`docs/decisions/README.md:18-35,58-61` 已记录 D-009 取代 D-007；accepted `AGENT_DELIVERY_RESILIENCE_D009_ALIGNMENT_V1` 的 `:99-100,110-116` 显式修正 CTR-W3 引用、保留通知义务。源码的当前挂载也引用此修订（`packages/production-runtime/src/scheduler/composition-runtime.js:37-44`）。不照搬旧 termination-only→failed，不把 unknown 当成功、失败或重试授权。

缺口：各入口向用户明确通知“该轮结果未证实，稍后随结算补投或请重发”，保存/复用同一 turn 与原目的地关联，接到 W2 消费者；仍由现有 reconciliation 处理原 turn，不重放旧请求。Product API 既有 `query_original_request_only` / `retryable=false` 约束须保留（`packages/product-api/src/conversation/protocol.js:9-14`），不得统一改成自动重发。
负面查证范围：Router、Feishu、Product API、production-runtime、notification-ingress、scheduler、scheduler-router 的 unknown、reconciliation、通知文案和订阅消费者。没有将未读取的外部 UI/客户端或生产配置判为完成或缺失。

## 4. 复用清单与精确补缺

以下均为 B 上 EXISTS 的现有组件；保留各自职责，不另建平行 turn/reconciliation 模型。

| 复用对象 / 坐标 | 直接复用部分 | 必须补的差量 |
|---|---|---|
| 配置解析 `packages/agent-router/src/deadline-config.js:145-195,226-258`；预算参数 `packages/agent-router/src/route-chain.js:309,329,398-399` | 静态优先级/校验方法、已有 caller bound 参数通道 | surface/class caller 选择与文档；四生命周期字段不改义。 |
| 认证关联 `packages/agent-router/src/ingress-authenticated.js:35-59`；`packages/agent-router/src/reconciliation/ingress-correlation.js:4-31` | 可信原 turn/入口坐标 | 关联到一次 late delivery 的目的地和处理状态，不接受模型自报目的地。 |
| reconciliation `packages/agent-router/src/reconciliation/state-machine.js:287-379`、`packages/agent-router/src/reconciliation/query.js:160-187,232-236` | exact evidence、settle-once、查询/订阅 | W2/W3 消费者与防重复发送状态；不能把 store 结算一次当发送一次。 |
| Feishu `packages/agent-router/src/ingress-delivery.js:148-152`、`packages/feishu-connector/src/core.js:294-354` | 原消息/话题定位、现有回复通道 | W3 专用提示、W2 标记及一次发送、不可接受目标的分支和回执。 |
| dead-letter / counters `packages/agent-router/src/reconciliation/delivery-failures.js:26-97`；Router API `packages/agent-router/src/index.js:326-327` | durable 文件、exact-id 查询、四类计数和告警 | late 回复/不可用原因与投递处置可检索，补投失败接入同层计数；不只留入站 prompt。 |
| native 原请求查询 `packages/product-api/src/conversation/service.js:90-133`；输出读取 `packages/agent-router/src/reconciliation/query.js:172-187` | 已有 request-bound 结果恢复及内存正文读取 | 明确可用性/截断/retention 限制；保持 pull 语义与正文保密边界，不另造 session history。 |

## 5. 结论与交付边界

| 合同 | 判定 | 最小差量一句话 | 已有合同内路径 |
|---|---|---|---|
| CTR-W1 | PARTIAL | 在 Router caller-wait 层按可信 surface/agent class 选配置，接入现有 caller budget 通道并记录默认/优先级。 | 有：RESILIENCE §4.3 CTR-W1 / ACC-W1；保留生命周期四字段约束。 |
| CTR-W2 | PARTIAL | 将 exact late success 接到原入口的一次 `（补投）`，不可投递则留可检索处置并计 CTR-R5，处理正文不可用/截断与恢复边界。 | 有：CTR-W2、CTR-R5、§8 PR-C；不改变 UNKNOWN、无重放、正文保密约束。 |
| CTR-W3 | PARTIAL | 沿用 reconciliation，在入口明确结果未证实/稍后补投或请重发并接至 W2，保留各 API 原请求查询约束。 | 有：CTR-W3 + D009_ALIGNMENT CTR-527D2-001；不需另造 Spec。 |

合同坐标：`docs/specs/AGENT_DELIVERY_RESILIENCE_V1.md:290-306,367-369,416-436`；现行引用修订 `docs/specs/AGENT_DELIVERY_RESILIENCE_D009_ALIGNMENT_V1.md:110-116`。这些是后续合同内 source implementation 的路径判断，**本次没有实施代码、启用配置、生产补投、reconcile、部署或合并**。
后续实现若拟改动四生命周期字段所有权、UNKNOWN/重放、正文保密等 accepted 含义，须另行 re-PREFLIGHT，不能借本普查报告授权。

方法与验证：仅 `rg`/逐行源码读取、固定 B 的 Git history 和远端 ref 读取；不以测试定义或历史 receipt 当本次执行结果。没有运行产品测试或外部产品请求（Git 远端 ref 读取除外），生产写入=0；实际运行、安装版本、用户收到回复均 UNKNOWN。
交付只允许 `BRIEF-W123-CENSUS.md` 与本文件；写后执行 `wc -l`、坐标存在性/行号核验、独立报告核查、`git diff --check` 与两文件范围检查，再 commit/push/PR(base main)，禁止 merge。网络推送失败则以 `/tmp/transfer-w123.bundle` 交接，记录 prerequisite B 并验证 bundle。
