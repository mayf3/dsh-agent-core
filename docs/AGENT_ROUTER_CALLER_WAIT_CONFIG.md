# Router caller 等待配置（CTR-W1）

此配置只选择 Router route-chain 的 caller 等待预算，包含 acquire、prepare 和路由尝试的耗时；剩余预算沿现有 `deadlineMs` → `turn()` 第四参传递。它不修改 AgentProcess 的四个生命周期字段，不修改 UNKNOWN、fence 或 reconciliation，也不授权重放原请求。

配置属于 deployment-owned Router plugin config，在 Router apply 时校验并快照；修改后须经部署链重新加载才生效。本次仅交付源码和离线测试，未安装或启用任何配置。

## 配置与优先级

```json
{
  "callerWait": {
    "bySurface": { "feishu": 120000, "mobile": 180000 },
    "byClass": { "slow": 600000 },
    "agentClasses": { "agt_example": "slow" }
  }
}
```

以上仅为示例，`agt_example` 必须换成已注册的精确 Agent id。所有 map 均可省略，等待值必须为正 safe integer（毫秒）；未知字段、surface、Agent、未定义 class 或非法值在 spawn 前 fail-loud。支持的 surface 为现有同步入口 `feishu` / `mobile`，飞书的 p2p/group/thread 共用 `feishu`。

预算优先级：

1. 可信调用方已传的显式 `deadlineMs`（既有内部通道，例如 Scheduler 的 `timeoutMs + 30000`，无 timeout 时为 300000）。
2. 非空部署 env `DSH_AGENT_CALLER_WAIT_TIMEOUT_MS`。
3. `agentClasses[agentId]` 对应的 `byClass[class]`。
4. 当前入口对应的 `bySurface[surface]`。
5. 原有 `deadlineConfig.perAgent(agentId).turnTimeoutMs` 回退。

同步 ingress 会把步骤 2–5 的配置选择结果交给 `deadlineMs`。直接内部 route-chain 调用没有 surface 时仍支持 env/class；已有显式预算保持优先。Delivery V0、native conversation 和 Website inquiry 的 admission 返回/结果查询模型不变，没有为它们新增等待回复的入口。

未配置本功能时保持原行为：原有回退为 per-Agent 静态 `turnTimeoutMs` override > `DSH_AGENT_TURN_TIMEOUT_MS` > 旧名 `DSH_AGENT_TURN_TIMEOUT` > 代码默认 **300000ms**。两种 turn env 的兼容由原解析器处理；它们不是新 caller env 的别名，也不越过 per-Agent 生命周期覆盖。历史 OBS-006 的 100s 不作为当前默认值。此文未读取生产配置，实际生产值 UNKNOWN。

## 可信分类与生命周期边界

class 只来自启动时 Router config 的 Agent id 映射，保留 AgentDefinition 的 identity/display schema。surface 来自现有控制面 adapter namespace：私有认证飞书 callback 固定为 `feishu`；Product API 从自己的配置设置 `mobile`，外部请求仅提供 surfaceId/text。Router 的进程内 `route()` 调用方必须是可信 adapter。消息中的 `surface`、`agentClass`、`deadlineMs`、`callerWait`、text/raw 或转发 opts 不参与选择。

caller 等待与实际 turn 生命周期仍独立：`turn()` 继续取 caller 剩余预算与 turn deadline 的较小值。上调 caller 配置不会延长 turn 自己的静态生命周期；超过 turn deadline 的慢任务仍按原规则返回 UNKNOWN。原四字段默认值、静态覆盖优先级、env 兼容和已运行进程配置不变。
