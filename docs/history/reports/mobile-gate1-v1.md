---
status: historical
as_of: 2026-08-15
superseded_by: ../../guides/integrations.md
public: PUBLIC
---

> HISTORICAL ENGINEERING RECORD
>
> This document describes the system as of 2026-08-15.
> It is **not** current architecture documentation.
>
> Current documentation: [docs/guides/integrations.md](../../guides/integrations.md)
# Mobile Gate 1 — MOBILE_LOCAL_REAL_SLICE_V1

> 状态：已完成（2026-08-15）· Gate 1（`MOBILE_LOCAL_REAL_SLICE_V1`）
> 结论：**PASS**（宿主 vertical slice 全 PASS；Emulator → adb reverse → 真实
> App → 真实 DSH 切片 PASS）
> 关联文档：`docs/investigations/mobile-product-surface.md`（SMALL FOLLOW-UP 的
> 最小 delta 已落地）、`docs/decisions/BINDING_AND_SWITCH_V1.md`（D-004）、
> `agent-core-mobile/docs/MOBILE_PRODUCT_INTEGRATION_V1.md`（冻结基线，§8 Gate 1）
> 验收驱动：`scripts/mobile-gate1-verify.mjs`（真实控制面进程 + 真实 per-agent
> DSH 进程 + 真实模型 turn）+ `agent-core-mobile/integration_test/gate1_slice_test.dart`
>（模拟器内真实 App 两次运行）
> Kernel：**KERNEL_CHANGE = NONE**（deepseek-harness checkout 零新增修改）

## 0. 一句话总结

用现有 Router / Control Plane 的**原有入口**（`ctx.agentRouter` 域操作 +
`route()` 投递路径）搭出一条真实链路：Android Emulator → `adb reverse` →
本机 localhost Product API（thin HTTP adapter）→ Binding → Router → 真实
per-agent DSH 进程 → 模型回复。**没有新建 Surface Registry / Device Registry /
Session registry / history / navigation stack / DSH metadata**；backend 只把
`surfaceId` 当作 Binding 作用域（`mobile:<surfaceId>`），id 由 Android 端首次
生成并持久化、重启复用。

## 1. Gate 1 约束落实情况

| 约束 | 落实 |
|---|---|
| 防扩张：不建 Surface/Device Registry | ✅ surfaceType=mobile 是常量；surfaceId 是 Android 端生成的 stable opaque UUID（`mobile:<surfaceId>` 即 Binding scope） |
| 书签只允许最薄 | ✅ per-(surface, agent) 单槽位 lastActiveSession，存于 Binding 行**之外**（binding-store 文档新增可选 `lastSessions` 表）；规则 = 显式 sessionId > 书签 > main；离开时记录、进入时恢复 |
| 不为书签新建 registry/history/stack/metadata | ✅ 无任何新增存储实体；`lastSessions` 只是 binding-store 同一 JSON 文档里的一个可选 map |
| Product API = 现有能力的薄 adapter | ✅ 4 端点全部转调 `ctx.agentRouter`（resolve/switchAgent/getBinding/route）+ `ctx.agentRegistry.listAgents`；API 层零 policy（见 §4） |
| 最大 API 面 | ✅ 仅 GET current binding / GET agents / POST switch-agent / POST message（+ `/health` 传输探针）；getMessages 未实现（同步 request→response 不构成 blocker） |
| HTTP 只服务 Emulator → adb reverse → localhost | ✅ 绑定 127.0.0.1（PRODUCT_API_HOST 默认）；无 auth/TLS/LAN 硬化 |
| 就近实现，不拆 framework | ✅ bookmark 落在现有 Router/binding-store；HTTP adapter 作为 `@agent-core/product-api` 挂进现有 bundle-integration 组合 |
| KERNEL_CHANGE = NONE | ✅ 见 §7 |

## 2. 实现（最小 delta）

### 2.1 Router / binding-store（`packages/agent-router`）

- `binding-store.js`：新增单槽位书签表 `lastSessions`（`ccId -> agentId ->
  sessionId`），同一原子 JSON 文档，格式版本不变（可选字段，双向兼容）；
  新方法 `getLastSession` / `setLastSession` / `lastSessionsSnapshot`。
- `index.js`：
  - `switchAgent`：**离开**时把当前 (agent, session) 写入书签（仅当目标
    Agent ≠ 当前 Agent）；**进入**时 `targetSessionId = explicit ??
    bookmark(surface, target) ?? main`；自切（当前 Agent）无显式 session 为
    no-op（切换器点当前 Agent 不会丢会话）。
  - `onIngress`：channel 化 —— `ingress.channel ?? 'feishu'`，飞书回复只在
    feishu channel 执行；Mobile surface 走同一条 `route()` 路径，生成
    `mobile:<surfaceId>` ChannelConversation。
  - 服务面新增 `channelConversationId(channel, externalId)`（id 格式单一
    所有者），Product API 通过服务调用（sibling 包不互相 import）。
- 单元测试：`router.test.js` 新增 6 项书签用例（恢复/回退 main/自切 no-op/
  per-surface 隔离/重启持久化/id 格式）。

### 2.2 Product API（`packages/product-api`，新包）

thin HTTP adapter（node:http，零框架），127.0.0.1 默认 8787：

| 端点 | 行为 | 底层调用 |
|---|---|---|
| `GET /health` | 传输探针（adb reverse 连通性） | — |
| `GET /v1/binding?surfaceId=` | 当前 Binding；无绑定 404 BINDING_NOT_FOUND | `agentRouter.getBinding` |
| `GET /v1/agents` | 注册 Agent 列表（契约 Agent 形状） | `agentRegistry.listAgents` |
| `POST /v1/switch-agent` `{surfaceId, targetAgentId}` | 更新 Binding；**targetAgentId-only**（wire 无 sessionId，带 sessionId 的请求 400 VALIDATION_ERROR） | `agentRouter.switchAgent` |
| `POST /v1/message` `{surfaceId, text}` | 同步回复 `{reply, agentId, sessionId}` | `agentRouter.route`（channel='mobile'） |

错误信封沿用冻结契约 `{error:{code,message}}`；错误码映射
BINDING_NOT_FOUND/AGENT_NOT_FOUND/VALIDATION_ERROR/INTERNAL_ERROR。挂载：
`bundle-integration/cordis.patch.yml` 新增 `agent-core-product-api` 行
（`inject: ['agentRouter','agentRegistry']` —— loader 并发 apply，依赖注入
是框架钦定顺序机制，demo-server 同款）。单元测试 6 项。

### 2.3 Mobile 端（`agent-core-mobile`）

- `lib/core/http/gate1_api.dart`：共享 thin 传输（4 端点 + 契约错误信封 +
  网络错误 → NETWORK_ERROR；message 用长 turn 超时）。
- `lib/core/http/http_agent_core_client.dart`：真实实现 `AgentCoreClient`
  —— `getBinding` 以 surfaceId 为作用域；`sendMessage` 同步拿回复；Gate 1
  无 getMessages 端点 → 客户端侧会话内镜像（每次 send 追加 user+assistant，
  保证 UI 消息流可见）；会话管理降级功能 → 明确 NOT_IMPLEMENTED。
- `lib/core/http/http_agent_router.dart`：两个冻结 Product operation →
  `POST /v1/switch-agent`（switchAgent 不带 sessionId；switchSession 显式传）。
- `lib/core/surface_identity.dart`（上一轮已冻结）：首次生成 UUID v4 并
  SharedPreferences 持久化，重启复用；`AgentCoreRuntime.channelConversationId`
  在 HTTP 模式 = surfaceId。
- `main.dart`：`--dart-define=AGENT_CORE_BASE_URL=http://127.0.0.1:8787` 切
  HTTP 模式（默认仍 Mock，`flutter test` 全绿）。
- 单元测试：`http_client_test.dart`（进程内假服务器钉住 wire contract，6 项）+
  `config_bootstrap_test.dart` 更新；`flutter analyze` 零问题，63 项单测全过。

## 3. 验收证据（真实链路）

### 3.1 宿主 vertical slice（`node scripts/mobile-gate1-verify.mjs`，真实控制面
进程 + 真实 per-agent DSH + 真实模型 turn；含 Emulator leg）

```text
MOBILE_LOCAL_REAL_SLICE_V1 = PASS   （21 项断言全 PASS：19 宿主 + 2 Emulator）
KERNEL_CHANGE = NONE
```

关键断言（详见 `.demo/mobile-gate1/evidence.md`）：

- `GATE1_FIRST_MESSAGE_REPLY`：首条消息 → 默认 Agent A/main，真实回复 ALPHA-1；
- `GATE1_SWITCH_TO_B` / `GATE1_MESSAGE_AFTER_SWITCH_ENTERS_B`：POST
  switch-agent（不带 sessionId）→ B/main，下一条消息真实进入 B（BETA-1）；
- `GATE1_ROUTER_SEAM_EXPLICIT_SESSION`：A/work 由 **Router 内部 explicit
  seam**（per-agent DSH 的 `agent_core_switch_agent` 工具带 targetSessionId，
  经 parent-RPC → Router.switchAgent）建立 —— 正式 Product API wire 不携带
  sessionId（审计 FIX 2）；ALPHA-2 真实进入 work 会话；
- **`GATE1_BOOKMARK_RESTORES_LAST_SESSION`：A/work → B → 切回 A 恢复
  A/work（书签优先于 main）** ← 冻结基线 M6 的核心语义，真实模型链路上证明；
- `GATE1_RESUMED_SESSION_ROUTES`：恢复后消息真实进入 work 会话（ALPHA-3）；
- `GATE1_SWITCH_AGENT_CONTRACT_TARGET_ONLY`：wire 携带 sessionId → 400
  VALIDATION_ERROR，Binding 不被触碰（正式 contract 无 sessionId）；
- `GATE1_SURFACE_ISOLATION`：S2 的默认绑定/切换完全不影响 S1（per-surface
  Binding）；
- `GATE1_SELF_SWITCH_NOOP`：切换器点当前 Agent 不丢会话；
- `GATE1_CP_RESTART_*`：控制面重启后 S1 仍 A/work、S2 仍 B（书签随 Binding
  一起持久化）；
- `GATE1_KERNEL_CHANGE_NONE`：deepseek-harness checkout 运行前后零新增修改。

### 3.2 Emulator → adb reverse → 真实 App → 真实 DSH（integration test + 真实重启）

模拟器内运行 `integration_test/gate1_slice_test.dart`（真实 App 代码路径：
surfaceId 生成/复用 → HttpAgentCoreClient/HttpAgentRouter → adb reverse →
本机 Product API → Binding → Router → 真实 per-agent DSH → 模型回复）：

- **Integration test ×2 全 PASS**（`flutter test integration_test -d
  emulator-5554 --dart-define=AGENT_CORE_BASE_URL=http://127.0.0.1:8787`）：
  首条消息 ALPHA-1 真实回复 → switchAgent(B)（不带 sessionId）→ BETA-1 来自
  B → switchAgent(A) 恢复 A → UI 顶部显示当前 Agent。注：`flutter test`
  每次运行会卸载重装 App（工具行为），因此两次运行之间 surfaceId 必然不同
  ——「重启复用」由下面的真实重启序列证明。
- **真实 App 重启复用（实证）**：`flutter build apk --debug
  --dart-define=AGENT_CORE_BASE_URL=http://127.0.0.1:8787` 安装 →
  `am start`（首启生成 surfaceId）→ `am force-stop` → `am start`（重启）：
  两次 `shared_prefs/FlutterSharedPreferences.xml` 中
  `product_surface.surface_id.v1` 完全一致
  （`e445540a-6174-42dc-833b-481054ad4d46`），且后端
  `GET /v1/binding?surfaceId=<同一 id>` 返回
  `mobile:<id>` → A/main —— **Android 端首次生成 UUID 并持久保存、重启
  复用、backend 只消费 surfaceId** 的完整闭环。
- **in-device 原始 HTTP 切片**：模拟器镜像无 curl/wget，验收脚本用 toybox
  netcat 发原始 HTTP（`(printf request; sleep) | nc`）—— `GET /health` 从
  设备内成功（adb reverse 隧道实证），`POST /v1/message` 从设备内拿到真实
  回复（`GATE1_EMULATOR_*` 断言）。

## 4. API 层没有拥有的东西

routing policy（无）、process lifecycle（无 —— 只调 `router.route` /
`ensureRunning` 在 Router 内）、session selection policy（无 ——
switch-agent 只是转调 `Router.switchAgent`，书签/main 决策在 Router）、
workspace / DSH_HOME / credential / memory internals（无 —— 全部在
Router/workspace-bootstrap/agent 进程内）。`packages/product-api/src/index.js`
只 import node:http + schemastery。

## 5. 登记给后续 Gate 的 debt（Gate 1 不解决）

1. **getMessages**：Gate 1 同步回复不构成 blocker，未实现；App 侧用客户端
   镜像。Gate 2+ 需要真实会话历史端点（A6 session metadata 一并）。
2. **session 有效性校验**（switchSession 的 SESSION_NOT_IN_AGENT /
   ARCHIVED_SESSION 事实源）：DSH 惰性创建 session，无 metadata 层；
   investigation §3.2 已登记，属 Product API milestone。
3. **模拟器镜像无 curl/wget**：in-device HTTP 探针改用 toybox netcat 原始
   HTTP（`GATE1_EMULATOR_*` 已 PASS）；App 侧由 integration test 承担。
4. **重命名会话**（契约缺端点）与**流式**（V2 SSE/WS）：不变更。
5. 存量 pre-existing：`agent-memory` 测试因 `@agent-core/workspace-bootstrap`
   模块解析缺口失败（环境问题，非本轮引入）；deepseek-harness checkout 有
   5 条与本 Gate 无关的 pre-existing 修改（cordis-host-runner/subagent）。

## 5.5 Merge audit follow-up（MOBILE_GATE1_MERGE_AUDIT_V1，只修两个已确认问题）

**FIX 1 — Feishu regression（已修复）**。Gate 1 channel 化把 feishu-connector
的 `ingress.channel`（消息子类型 `p2p|group|thread`）误当作 Binding
namespace / 回复判据，导致：(a) `channel === 'feishu'` 永不匹配 → 不回
复；(b) 新建 `p2p:<id>` 等 namespace 行 → 既有 `feishu:<conversationId>`
durable Binding 被孤儿化。修复：`ingressBindingNamespace(ingress)` ——
Feishu 入口（p2p/group/thread/缺省）一律落 `feishu:` namespace；仅 mobile
Product API 入口用 `mobile:`；`feishuReplyOwed(ingress)` 作为回复判据。
回归（`packages/agent-router/test/feishu-regression.test.js`，6 项全 PASS）：
FEISHU_P2P_REPLY / FEISHU_GROUP_REPLY / FEISHU_EXISTING_BINDING_KEY_PRESERVED
/ MOBILE_BINDING_NAMESPACE_UNCHANGED + 纯映射规则两项。

**FIX 2 — 收回 Session HTTP contract（已修复）**。正式 Product API wire 的
`POST /v1/switch-agent` 变为 **targetAgentId-only**（带 sessionId 的请求
400 VALIDATION_ERROR，Binding 不被触碰）；Router 内部 explicit
targetSessionId seam（DSH switch 工具 → parent-RPC → Router.switchAgent）
保留不改，Gate 1 验收改用该 seam 建立非 main 会话以证明书签恢复。App 侧：
`Gate1Api.switchAgent(targetAgentId)` 无 sessionId；`HttpAgentRouter
.switchSession` 恢复 deferred（NOT_IMPLEMENTED），接口抽象保留。
Bookmark 本身未修改：`(surfaceId, agentId) → lastActiveSessionId`。

## 6. 关键产物

- `packages/agent-router/src/binding-store.js`（+`lastSessions` 书签表）
- `packages/agent-router/src/index.js`（书签规则 + channel 化 route + 服务面 id 格式）
- `packages/agent-router/test/feishu-regression.test.js`（audit FIX 1 回归）
- `packages/product-api/`（thin HTTP adapter + 单元测试）
- `bundle-integration/cordis.patch.yml`（挂载 product-api）
- `scripts/mobile-gate1-verify.mjs`（Gate 1 验收驱动）
- `agent-core-mobile/lib/core/http/`（gate1_api + http client/router 真实实现）
- `agent-core-mobile/integration_test/gate1_slice_test.dart`
- 证据：`.demo/mobile-gate1/evidence.md`

## 7. 结论

```text
MOBILE_LOCAL_REAL_SLICE_V1 = PASS
KERNEL_CHANGE             = NONE
```

Gate 2（`MOBILE_LAN_E2E_V1`：Android 真机 → Wi-Fi → Agent Core）**未进入**。
