# 配置参考（Configuration）

> status: current · 本页是环境变量 / 可配置项的唯一 authority。原则：配置面保持
> 小；代码是最终事实（本页与代码不一致时以代码为准并改写本页）。

## Runtime / 进程

| 变量 | 作用 | 缺省 |
|---|---|---|
| `DSH_HARNESS_ROOT` | DeepSeek Harness checkout 路径（`cliBin()` 解析 dsh CLI） | `../../github/deepseek-harness` |
| `DSH_HOME` | DSH home 根（per-agent home 由 provisioning 派生） | `~/.dsh` |
| `DSH_AGENT_CHILD_UID` / `DSH_AGENT_CHILD_GID` | Agent 子进程目标 uid/gid（缺省继承父身份） | — |
| `DSH_AGENT_SPAWN_HELPER` | setuid spawn helper 绝对路径（无法直接 setuid 时必需，fail-loud） | — |
| `DSH_AGENT_PROVIDER` / `DSH_AGENT_MODEL` | spawned agent 的模型路由 | `~/.dsh/settings.yaml` |

## 生产组合（production-runtime）

| 变量 | 作用 | 缺省 |
|---|---|---|
| `PRODUCTION_RUNTIME_ROOT` | 持久根 | `~/.agent-core` |
| `FEISHU_CREDS_PATH` | 飞书凭据文件；缺省 channel OFF | — |
| `AGENT_CORE_CREDENTIALS_FILE` | Broker credential store（per-agent clientId/clientSecret） | — |
| `BROKER_AUTH_ORIGIN` | Trusted CP seam | — |

## 端口 / 监听（均 localhost）

| 服务 | 默认 | 说明 |
|---|---|---|
| product-api | `127.0.0.1:8787` | Gate 1 Mobile Product API（host 固定 127.0.0.1，port 可配） |
| notification-ingress | `127.0.0.1:8790` | `POST /v1/deliver` |

## 持久化位置

- Bindings：`<DSH_HOME>/.dsh/bindings/bindings.json`（原子 tmp+rename）。
- Scheduler jobs：`<root>/scheduler/jobs/jobs.json` + `runs.jsonl`。
- Workspace：`~/.dsh/workspaces/<agentId>`（workspace-bootstrap 唯一映射）。
- 运行证据：`<root>/control/runtime-evidence.jsonl`。

完整文件布局见 [filesystem-layout](filesystem-layout.md)；凭据见
[security/credentials](../security/credentials.md)；运行入口见 [cli](cli.md)。
