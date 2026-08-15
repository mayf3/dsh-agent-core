# SCHEDULER_ROUTER_FINAL_INTEGRATION_V1 — 验收报告

> Scheduler Replacement V1 已 CLOSED（`docs/reports/scheduler-replacement-v1.md`），
> 本报告是它承诺的 Final Integration：把 Scheduler 的注入式 seam 接到**已有**
> Router 域操作上，做真实（real DSH process / real model / real Feishu send）
> 端到端验收，并关闭 TIMEOUT_ABORT 审计的 end-to-end 悬置项。
>
> 独立 worktree：`.worktree/scheduler-router-final-v1`，基于 `origin/main`
> （4465dcb，Scheduler Replacement V1 merge 后的最新 main）。
> 分支：`feat/scheduler-router-final-integration-v1`。

## 最终结论

```
SCHEDULER_ROUTER_FINAL_INTEGRATION_V1 = PASS
INVOKE_AGENT_REAL_CHAIN  = PASS
DELIVER_REAL_CHAIN       = PASS
ABORT_SIGNAL_E2E         = DEFERRED_WITH_EVIDENCE
ROUTER_CHANGE            = NONE
SCHEDULER_CORE_CHANGE    = NONE
CREDENTIAL_DEPENDENCY    = NONE（仅本地飞书 channel 凭据；未触碰 Broker/Auth/Trusted Credential Boundary）
KERNEL_CHANGE            = NONE
```

验收驱动：`node scripts/scheduler-router-final-v1-verify.mjs` → **16/16 checks PASS**。

## 链路（真实接线）

```text
Scheduler.invokeAgent(request)          @agent-core/scheduler（V1 核心未动）
  → createRouterInvoker(router)         @agent-core/scheduler-router（本 PR 新增桥接，~40 行）
      → router.ensureRunning(agentId)   已有 agentRouter 服务域操作（find-or-start）
      → AgentProcess.turn(sessionId, msg)  per-agent DSH 进程（dsh --profile agent-core-demo）
      → demo-server session/prompt        DSH 原生 Session（create/resume）
      → 真实模型回合（opencode-go / deepseek-v4-flash）
  → outcome envelope → 状态机落盘（jobs.json + runs.jsonl）

deliver({job, result, text})            Scheduler 投递缝
  → createFeishuDeliver(feishu)         @agent-core/scheduler-router（新增适配器，~40 行）
      → feishu.reply(ReplyTarget, text)  **已有 outbound seam**（feishu-connector 唯一出站发送；
                                         与 Router.onIngress 回复路径同一条缝）
```

**约束落实**：
- 不修改 `packages/scheduler/**` 核心（SCHEDULER_CORE_CHANGE = NONE）；
- 不修改 `packages/agent-router/**`（ROUTER_CHANGE = NONE）——桥接只调用 Router
  **已发布**的 public/domain 操作（`agentRouter.ensureRunning` + `AgentProcess.turn`），
  不在 Router 里塞任何 Scheduler 特判；
- 不建设第二套 outbound——deliver 适配器只调用已有 `feishu.reply` 缝；
- 不使用 Broker / Auth / Kernel 任何能力（fixture Agent 用最小 `agent-core-demo`
  profile，控制面组合与 bundle-integration 同构但无 broker 行）；
- 不解决 credential（Trusted Credential Boundary 由另一 Agent 调查）；
- 无 Scheduler V2 / 新 Router / 新 Session layer / cancel framework。

## INVOKE_AGENT_REAL_CHAIN = PASS（真实验收证据）

fixture Agent（注册名 "Scheduler Router Fixture"，无 Broker/Auth 依赖）+ 两个
one-shot `at` job（delivery none）经真实调度触发：

```
PASS  SCHEDULED_OCCURRENCE    — 两个 at job 到期触发；runs.jsonl 出现 started+finished(status ok)
PASS  CORRECT_AGENT_ID        — run event agentId=agt_d067e0…（= 注册的 fixture id）
PASS  NATIVE_SESSION_ID       — sessionId=agent:agt_d067e0…:cron:<jobId>（Scheduler 默认会话约定）
PASS  REAL_DSH_PROCESS        — pid=72679, alive=true（Router 拉起真实 dsh 子进程）
PASS  NATIVE_SESSION_PERSISTED— <home>/sessions/…/agent~003A…~003Acron~003A<jobId>/session.jsonl
PASS  REAL_MODEL_RESPONSE     — reply="SCHEDULER_ROUTER_OK"（真实模型回合，非 fake）
PASS  RUN_OUTCOME_PERSISTED   — job1（deleteAfterRun）成功后原子删除；
                                job2 保留且 lastRunStatus=ok / lastRunAtMs / lastDeliveryStatus=not-requested
```

Router 日志证据（真实进程）：

```
[router] agent agt_d067e0… ready pid=72679 (1172ms)
[router] agent agt_d067e0…: session agent:agt_d067e0…:cron:3e0251ae… created (0 events)
```

## DELIVER_REAL_CHAIN = PASS（deliver() 应接哪个已有 outbound seam — 已调查并真实验证）

**调查结论**：当前唯一出站缝是 feishu-connector 的
`feishu.reply(ReplyTarget, text)`（`im.message.reply` / `im.message.create`；
ReplyTarget 由 `buildReplyTarget(...).directChat(chatId)` 构造）——与
Router.onIngress 回复路径用的是同一条缝。Scheduler 的 `delivery.{channel,to}`
保持 opaque，适配器（`createFeishuDeliver`）是唯一读它的地方，把
`chat:oc_…` 映射为 directChat ReplyTarget 后调用 `feishu.reply`。没有第二套 outbound。

**真实发送证据**（announce job，`{mode:'announce', channel:'feishu', to:'chat:oc_92332c45c1cac2ef89857abfee8ed762'}`，
即本仓库既有测试群）：

```
PASS  DELIVER_SEAM_WIRED           — job3 finished delivered=true deliveryStatus=delivered
PASS  DELIVER_EXISTING_OUTBOUND_SEAM — feishu.reply create -> chatId=oc_92332c45… messageId=om_x100b68ca44cab8a0c2e58b9b11cd7c4 code=0
PASS  DELIVER_REAL_CHAIN           — 真实飞书发送成功（im.message.create，om_x100b68ca44cab8a0c2e58b9b11cd7c4）
```

> 期间测试群收到了一条外部 canary 消息（另一 Agent 的同群验收），Router 走真实链路
> 处理并回复 —— 顺带再次验证了已有 inbound→outbound 链。若环境无飞书凭据，驱动会
> 退化为 recording seam 并如实报告 `DELIVER_REAL_CHAIN = WAIT`（不把 WAIT 当失败）。

## ABORT_SIGNAL_E2E = DEFERRED_WITH_EVIDENCE

Scheduler 预留的 AbortSignal（TIMEOUT_ABORT 审计）沿真实 Router invocation 验证：

- **信号确实到达桥接层并被观察到**：`ABORT_SIGNAL_REACHES_INVOKER — signal.aborted
  observed true at the bridge`（timeoutSeconds=1 的 job 在真实回合中途触发 abort）。
- **Router 当前没有 cancellation seam（证据）**：
  1. 代码证据：`AgentProcess.turn()` 签名无 signal 参数（`packages/agent-router/src/process.js`），
     超时只是放弃等待；demo-server JSON-RPC METHODS 集只有
     initialize/session/prompt/shutdown/rpc.response，**无 cancel 方法**
     （`packages/demo-server/src/index.js`）；
  2. 运行证据：abort 后子进程未被取消——孤儿回合继续工作，
     `status@abort=running → idle`，events 106 → 2012，
     孤儿回合最终以 status=ok 自然结束（其结果被 Scheduler 忽略，因为超时已先落库为 error）。
- 因此按任务口径：`TIMEOUT_ABORT_END_TO_END = DEFERRED_WITH_EVIDENCE`，
  **不建设 cancel framework**（未来 DSH/demo-server 出现真实取消缝时，桥接层加一行
  观察即可，Scheduler 核心与 Router 仍无需改动）。

## 变更清单

新增（全部在独立 worktree / 新分支上）：

| 文件 | 内容 |
|---|---|
| `packages/scheduler-router/` | 新包 `@agent-core/scheduler-router`：`createRouterInvoker(router, {registry})` + `createFeishuDeliver(feishu)` + `chatIdFromDeliveryTo`；零外部依赖（只调用传入服务的 public 方法） |
| `packages/scheduler-router/test/bridge.test.js` | 9 个单元测试（fake router/feishu 钉死 seam 契约，不 spawn 进程） |
| `scripts/scheduler-router-final-v1-verify.mjs` | 真实验收驱动（fixture Agent + 真实调度 + 真实进程/模型/飞书发送 + abort 证据） |
| `docs/reports/scheduler-router-final-integration-v1.md` | 本报告 |
| `package.json` | 补两根真实运行时依赖（`@deepseek-ai/schemastery`、`@larksuiteoapi/node-sdk`，此前靠手工拷贝 node_modules；与 croner 同款先例） |

未变更：`packages/scheduler/**`（核心）、`packages/agent-router/**`、`packages/demo-server/**`、
`packages/feishu-connector/**`、broker、bundle-*、profile-*、Kernel。

## 复现

```bash
cd .worktree/scheduler-router-final-v1
npm install                       # croner + schemastery + larksuite SDK（node_modules 未入库）
node scripts/scheduler-router-final-v1-verify.mjs
# 环境变量：DSH_SRF_FEISHU=0 关闭真实飞书；DSH_SRF_TEST_CHAT 换测试群；DSH_HARNESS_ROOT 显式指定 harness
```

## 遗留（明确不在本 PR）

- **daemon 切换**：把 `Scheduler({invoker: routerInvoker, deliver: feishuDeliver})`
  实例化进 Control Plane 常驻进程 + `agentcore-cron` 装 launchd —— Scheduler V1 §9
  的 INTEGRATION NEED 中已列为独立步骤，本 PR 只交付接线与验收（约 10 行，桥接包已就绪）。
- **deliver 适配器归属**：Scheduler V1 §6 曾说 Feishu Connector 提供适配器；本 PR 以
  桥接包形式交付并真实验证。若后续希望适配器住进 feishu-connector，是纯搬移，无行为变化。
- **cancel seam**：等 DSH/demo-server 出现真实取消缝后，把 signal 接到 turn 上
  （届时 `TIMEOUT_ABORT_END_TO_END` 可从 DEFERRED 转 PASS，仍不需要 cancel framework）。
