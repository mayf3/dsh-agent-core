# Trusted Control Plane（受信控制面部署模型）

> status: current · 部署脚本面见 [guides/deployment](../guides/deployment.md)。

## 模型

控制面（Router / production-runtime）以**受信部署身份**运行；每个 Agent 子进程以
**普通运行时 uid/gid** 运行（默认单一运行 uid，不是 per-agent OS 用户——Agent 之间的
隔离靠独立 DSH_HOME/workspace + owner-guard，不靠 OS 多用户）。

## 机制（packages/agent-router/src/process.js）

- `DSH_AGENT_CHILD_UID` / `DSH_AGENT_CHILD_GID`：子进程目标 uid/gid；缺省则继承
  父进程身份（legacy 行为）。
- `DSH_AGENT_SPAWN_HELPER`：特权 spawn helper 的**绝对路径**
  （`<helper> <uid> <gid> <node> <program> <args...>`，setuid 后 exec，stdio 继承）。
  helper 源码：`scripts/dsh-agent-spawn-helper.c`（root:wheel 4755 安装）。
- **fail-loud 规则**：父进程既不是 root 也不是目标 uid 又没有 helper 时，直接抛错，
  绝不静默以父身份运行子进程。
- owner-guard：每个 agent home 的单 owner 锁，防双进程。

## 安装面（scripts/，如实描述）

- `trusted-cp-deploy-install.sh` — trusted 节点安装。
- `trusted-cp-hardening-v1-verify.mjs` / `trusted-credential-broker-v1-verify.mjs` —
  部署加固与 credential broker 的 developer verification。

## 边界

trusted CP 的证据细节（uid、目录权限矩阵、验收断言）在
[docs/history/reports/](../history/reports/)（trusted-control-plane-deployment-hardening-v1、
trusted-credential-*）——历史证据，机制以本页与代码为准。

相关：[security-model](security-model.md) · [credentials](credentials.md)。
