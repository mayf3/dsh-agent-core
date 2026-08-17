# 入口与集成（Integrations）

> status: current · 本页是「消息/调用如何进入 Agent Core、如何出去」的集成面总览。

## 入站 channel

| 入口 | 形态 | 说明 |
|---|---|---|
| Feishu / Lark | WebSocket 长连接（`packages/feishu-connector`） | 入站事件归一化为 `IngressEvent`，出站统一 `ReplyTarget`；零 Agent/Session 状态 |
| Notification Ingress | `POST /v1/deliver`，localhost:8790（`packages/notification-ingress`） | 薄 HTTP adapter → `agentRouter.deliver({requestId, agentId, sessionMode, message})` → `{accepted, sessionId}` |
| Mobile Product API | HTTP，localhost:8787（`packages/product-api`，Gate 1） | 供 adb reverse 的移动面：current binding / agents / switch-agent / message |

所有入口最终汇到 Router 的同一套域面（resolveChannelConversation /
switchAgent / turn / deliver），入口协议不进入核心路由规则（switch 的产品语义
按 D-006 限定 Surface scope：仅可切换 Surface（Mobile）允许，Feishu 固定——见
[concepts/sessions-and-bindings](../concepts/sessions-and-bindings.md)）。

## 出站 / 外部系统

- **Broker bridge**（`packages/broker`）：capability manifests → model-facing DSH
  tools（gateway / registry / mapping / relay / transport / identity /
  credential）。外部系统（Forum / Workflow / OKR 等）只经 Broker 访问，
  不内置插件化。
- **Feishu 出站**：ReplyTarget / deliver seam（scheduler-router 的 announce 走同一
  出站面）。

## 移动端形态（Gate 1，如实）

Product API 只绑定 `127.0.0.1`（`host` 固定，默认 port 8787），设计给 adb reverse
的本地移动客户端；无公开 App / 公网暴露。

## 验收

`mobile-gate1-verify.mjs`、`agent-router-delivery-v0-verify.mjs`
（`npm run verify:delivery`）、`integration-v1-verify.mjs`。

各入口的研发/验收历史见 [docs/history/reports/](../history/reports/)
（feishu-connector-v0、broker-*、mobile-gate1-v1、delivery-pipeline-integration-v0 等）。
