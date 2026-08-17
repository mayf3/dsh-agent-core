# 架构守则（Frozen Invariants 的 enforcement）

> status: current · 本页是贡献者必须遵守的 frozen 边界清单。原始推导见
> [docs/history/snapshots/](../history/snapshots/)（PRODUCT_ARCHITECTURE / COMPONENT_MAP
> / TRUST-BOUNDARY，历史证据）与 [docs/decisions/](../decisions/)（ADR）。

## 边界（frozen）

1. **one Agent = one DSH process**（进程 = 安全域）。不为复用而合并 Agent 进程。
2. **DSH 是 Runtime**：不建第二个 agent loop / event log / session engine / tool
   系统 / fs / shell / subagent / schedule / goal / inbox 原语。
3. **Session 无映射层**：product sessionId = DSH native sessionId（身份 =
   (agentId, sessionId)）。
4. **workspace-bootstrap 是 agentId→路径的唯一 owner**；Router 不重复路径规则。
5. **Forum / Workflow / OKR 等外部系统只经 Broker bridge 访问**，不内置化。
6. **Channel 只是入口**：不拥有 Agent / Session / Binding 状态。
7. **switchAgent 只改 Binding**；无角色扮演、无历史复制、无切换栈。
8. **initiator ≠ authorization**：principal 只能来自 spawn 时注入的进程身份，
   模型可控输入永远不能决定身份（见 [security-model](../security/security-model.md)）。
9. **不重新长成大 Control Plane / 大 Kernel**：控制面只做组织（谁在哪、何时启动）。

## 禁止出现的组件名

除非未来有新证据证明 DSH/Broker 无法承载，否则不允许出现：

`agent-core-session-runtime` · `agent-core-session` · `agent-core-skill-manager` ·
`agent-core-shell` · `agent-core-forum-plugin` · `agent-core-workflow-plugin`

合法的自建组件命名域：agent-definition / agent-memory / agent-router /
workspace-bootstrap / agent-provisioning / broker / scheduler（现有包清单见
[architecture/overview](../architecture/overview.md)）。

## 违规时的处理

Review 阶段以 `SPEC_COMPLIANCE = FAIL` 打回；已合入的违规由后续 Spec 轮清理——
不静默放行，也不未经 Spec 私自重构。

## 治理入口

改动前必读：[AGENTS.md](../../AGENTS.md) · [`.agents/README.md`](../../.agents/README.md) ·
[development](development.md)。
