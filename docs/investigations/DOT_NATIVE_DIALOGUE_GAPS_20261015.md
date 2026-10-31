# dot 原生对话缺口核查 — 2026-10-15

本记录只有证据权威。授权来源是 Owner 本轮任务；没有生产变更、消息重发、凭据读取或权限修改。DSH 源码坐标固定为 `04cd3b066116041a7be9663417775a2ac8dd331c`，MCP 已审源码为 `485262fc3535523060c1b3a9deaede3baa826a7d`。原 cwd 位于较旧 `goal/workflow-assignee-admission-guard-v1`；其未纳管文档不作为 current main authority。

| Observation | 方法与精确来源 | 结果与限制 |
|---|---|---|
| OBS-001 | GET [EP49 原回填](https://github.com/mayf3/agent-control/issues/1135#issuecomment-6181641021)，comment `created_at=2026-10-15T00:37:09Z` | Owner 记录 send `00:12:36Z`、原消息 `om_x100b6235e98444a8cef1bf4c786d547`，BIP 卡 `om_x100b6235e2fbaca4cf2419034bc731c` 在08:13；无 parent_id，仅同群后续与内容对应。两实例终态/取消归档仍是 Owner 报告，独立权威复核 UNKNOWN。 |
| OBS-002 | 经现有 MCP 调用 `health` / `get_message_result({})`，2026-10-15T01:03:33.797Z / 01:03:36.996Z | 运行版0.2.0；结果工具真实返回 NOT_PROVISIONED。未调用 send。不能把发现描述或历史飞书成功当成原生 MCP 往返。 |
| OBS-003 | `packages/product-api/src/index.js:214-249`、`packages/agent-router/src/index.js:344-390` | Product API 的 surface send 无 client request_id 或结果补取。Router 的 deliver/route、getTurnReconciliation、readFinalAssistantOutput、resolveCallerCorrelation、onTurnReconciled 可复用；这不是新 caller 的授权。 |
| OBS-004 | `packages/agent-router/src/parent-rpc-relay.js:26-73`、`packages/broker/src/gateway.js:264-370`、`packages/production-runtime/src/agent-session-messaging.js:182-195` | ASM 由真实 spawned AgentProcess/source turn 派生 caller。外部 MCP 不能伪造 Agent/source turn，也不能借用 Agent credential。 |
| OBS-005 | `packages/notification-ingress/src/idempotency.js:202-237`、`deliver-handler.js:150-176`、`index.js:10-15` | 已有 principal+requestId+payload hash、先reserve后Router、409冲突、duplicate结果和boot UNKNOWN机制；入口 caller 仅svc-forum/svc-workflow。其 outcome不保回复正文或exact messageId。 |
| OBS-006 | `packages/agent-router/src/reconciliation/store.js:280-289`、`durable-file.js:298-308` | correlation重复会拒第二mint、零prompt；不等同客户端幂等原结果读回。durable reconciliation仅保存输出hash/bytes/truncated，正文为null，不能据此承诺重启后答案可读。 |
| OBS-007 | `docs/specs/MOBILE_SESSION_HISTORY_V1.md:597-622,738-758,1082-1106`，`packages/session-history/src/index.js:109-177` | 正式HTTP历史仅获准mobile node的当前Binding/main、before页、部分文本；只投影completed最后assistant，旧main/fresh/archive和interrupted正文不是该授权面。 |
| OBS-008 | accepted `AGENT_CORE_EXECUTION_HISTORY_QUERY_V1.md:168-175` 对照 `packages/execution-history/src/boundary.js:78-100`、`index.js:42-55`、`report.js:31-38`；纯内存probe，无文件/会话访问 | cursor仅v1/afterOrder；第一页B/C取B，源新增更早A后旧cursor第二页再次B。不能直接复用它承诺活跃历史跨页冻结和无重复漏页。未验证生产加载。 |

CLM-001（SUPPORTED）：新 caller 身份、请求归属/幂等、human request→exact native reply、正文补取及增量范围是负载相关合同缺口。EVD-001 = OBS-003..008 SUPPORTS CLM-001，坐标如表；证据足以支持 docs-first，不能支持任何新 grant 或生产启用。

EP49 的24分33秒是 reported send 到 GitHub 导出评论的时间差，不是 BIP 处理耗时。回复只有分钟精度、dot08:39是近似值，发送到接收/回复到dot的精确时延均未测。accepted EH R7 禁止用时间邻近或文本相似充当 exact correlation。

最小关闭路径：新增受鉴权的 Product Surface 对话 facade，复用 Router 与原持久 reservation 模式，保留现有 ASM/Notification/Mobile 合同；MCP只作连接器适配，DSH journal仍为内容权威。先接受新产品合同，再实现；实际身份/grant/加载及dot往返另行授权。当前无可直接复用且已授权的外部 native send/read入口，缩减为调用旧无鉴权surface或Notification/A2A均不能避开身份缺口。
