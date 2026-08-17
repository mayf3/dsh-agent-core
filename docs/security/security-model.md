# 安全模型（Security Model）

> status: current · 本页是「Agent Core 安全模型」的唯一 authority。设计推导的完整证据见
> [docs/history/snapshots/TRUST-BOUNDARY-REPORT.md](../history/snapshots/TRUST-BOUNDARY-REPORT.md)（历史调查）。

## 核心结论（仍然成立）

**TRUST_BOUNDARY = 进程边界（per-agent DSH 进程 ↔ Broker/控制面）；进程内的
initiator 只作归因（attribution），不作授权（authorization）。**

为什么必须是 OS 进程：调查证实**同进程内的插件代码可以伪造身份**——host-only 包可
绕过审批、sandbox ctx façade 可 `withInitiator(B)` 以 B 的名义执行工具、node:vm 不是
containment、`$DSH_HOME/.credentials.yaml` 同进程可读。因此：

- 纯模型输入（prompt / tool 参数 / header / 请求体）**不能**提供 principal——
  principal 只能来自 spawn 时注入的进程身份。
- `requireInitiator()/currentInitiator()`（进程内 causal attribution）**既不是
  liveness 证明也不是授权**，永远不能当 wire identity 用。
- Adapter 永不从 tool 参数/header/请求体读取 principal。

## 目标架构（方案 B，已采纳）

1. 控制 = trusted（部署身份运行，进程外于 agent）；每 Agent 一个独立 DSH 进程
   （独立 home / session store / 凭据可见性）。
2. spawn 时注入 per-process credential；Broker 侧维护 credential → principal 绑定 +
   扁平 capability allowlist；拒绝一切客户端自报的 principalId/agentId。
3. 旧 Auth 全部删除（per-Agent client/secret、token exchange、JWT、Grant 机制、
  Principal registry）——不允许为兼容保留。

## 当前实现状态（诚实边界）

| 方案 B 要素 | 状态 |
|---|---|
| per-agent OS 进程隔离（独立 DSH_HOME/workspace/session store） | ✅ merged（agent-router + owner-guard） |
| trusted 控制面 + 子进程 uid/gid 降权（spawn helper） | ✅ merged（见 [trusted-control-plane](trusted-control-plane.md)） |
| Broker credential store（per-agent clientId/clientSecret） | ✅ merged（见 [credentials](credentials.md)） |
| per-process credential token 注入 + credential→principal 绑定的完整攻击测试面 | ⏳ 设计冻结、未完整实现（调查报告 §6 attack suite 待实现后执行） |

## 攻击面规则（写给贡献者）

- 任何新入口（channel / API）都不得让模型可控输入决定 principal。
- A 拿不到 B 的 credential 是硬约束：credential 注入只发生在 spawn 时刻。
- Broker 判定「这是谁」只依据 credential→principal 绑定，不依据请求内容。

相关：[trusted-control-plane](trusted-control-plane.md) · [credentials](credentials.md) ·
[architecture/overview](../architecture/overview.md)。
