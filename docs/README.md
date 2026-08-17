# docs/ — 文档索引（index only）

> status: current · 本页**只做导航与 source-of-truth map**，不重复任何产品事实
> （事实在各主题页内，事实改变时直接改写对应页面）。项目入口是
> [根 README](../README.md)。

## 当前文档树（Current Truth）

| 主题 | Authority 页 |
|---|---|
| 上手 / 安装 | [getting-started/quick-start](getting-started/quick-start.md)（现状页：Quick Start 缺失中）· [installation](getting-started/installation.md) |
| Agent / Session / Workspace | [concepts/agents](concepts/agents.md) · [sessions-and-bindings](concepts/sessions-and-bindings.md) · [workspace-and-memory](concepts/workspace-and-memory.md) |
| 架构 | [architecture/overview](architecture/overview.md) · [runtime-boundary](architecture/runtime-boundary.md) · [control-plane](architecture/control-plane.md) |
| 指南 | [guides/deployment](guides/deployment.md) · [adding-an-agent](guides/adding-an-agent.md) · [scheduler](guides/scheduler.md) · [integrations](guides/integrations.md) · [plugins](guides/plugins.md) |
| 安全 | [security/security-model](security/security-model.md) · [trusted-control-plane](security/trusted-control-plane.md) · [credentials](security/credentials.md) |
| 参考 | [reference/configuration](reference/configuration.md) · [cli](reference/cli.md) · [filesystem-layout](reference/filesystem-layout.md) |
| 贡献 | [contributing/development](contributing/development.md) · [testing](contributing/testing.md) · [architecture-rules](contributing/architecture-rules.md) |

每个主题只有一个 authority；current 页**直接改写**，禁止底部追加「更新（日期）」。

## 知识权威（Knowledge Authorities，活跃）

| 目录 | 角色 |
|---|---|
| [specs/](specs/) | **Change / Implementation Authority** —— 这次允许改变什么（唯一 merge/implementation authority） |
| [investigations/](investigations/) | **Evidence Authority** —— 我们查到了什么（12 件，原地保留） |
| [decisions/](decisions/README.md) | **Long-lived Invariant / Current Decision** —— repo 长期坚持什么（ADR 索引见 decisions/README.md，不在此写死范围；Current Authority = D-006 Agent/Workspace/Session V2 产品模型） |

治理协议（改动前必读）：[AGENTS.md](../AGENTS.md) →
[.agents/README.md](../.agents/README.md)。

## 研发历史（发生过什么）

[history/](history/README.md) — 27 份实现/验收报告 + 5 份旧 current 快照，全部带
机器可识别 historical marker（status / as_of / superseded_by / public disposition）。
**历史文档不代表当前架构。**
