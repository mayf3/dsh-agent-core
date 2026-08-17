# 凭据模型（Credentials）

> status: current · 本页只描述凭据的**位置与注入机制**；任何真实 secret value 都不
> 出现在代码、文档或 git history 中。

## 凭据清单（当前 merged 事实）

| 凭据 | 位置 | 用途 |
|---|---|---|
| DSH 模型 API key | `~/.dsh/.credentials.yaml`（`OPENCODE_GO_API_KEY`） | DSH Runtime 调模型 |
| 模型路由配置 | `~/.dsh/settings.yaml` | provider/model 选择 |
| Feishu channel 凭据 | `FEISHU_CREDS_PATH`（默认 `~/.dsh/feishu-creds.json`） | 飞书长连接 + 出站回复 |
| Broker credential store | `AGENT_CORE_CREDENTIALS_FILE`（per-agent `clientId`/`clientSecret`，0600 属主私有） | Broker 侧 per-agent 凭据绑定 |

## 原则

- **凭据在 spawn / 启动时注入**（env 或 0600 文件），不由模型输入携带——见
  [security-model](security-model.md)。
- **credential 路径出现在文档 ≠ secret 泄漏**。真实 secret value（token / API key /
  clientSecret 值）的发现与处置走独立 security incident（STOP + rotate + git-history
  清理评估），不属于文档收敛范围。
- per-agent home 内的凭据可见性由进程隔离保证（独立 DSH_HOME + uid 降权）。
- 生产根（默认 `~/.agent-core`）内的运行证据与备份由 backup retention 策略管理
  （`scripts/agent-core-backup-ops.sh`；governing Spec
  `docs/specs/AGENT_CORE_BACKUP_RETENTION_V1.md`）。

## 检查

`grep` 级别的公开暴露审计模型与结论见
[docs/history/README.md](../history/README.md)（PRIVACY/HYGIENE ≠ SECRET EXPOSURE；
implementation-start 扫描：SECRET_EXPOSURE_FOUND = NO）。

相关：[trusted-control-plane](trusted-control-plane.md) · [deployment](../guides/deployment.md)。
