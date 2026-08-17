# 部署与运行

> status: current · 本页描述当前（merged main）的部署形态与运行面。当前为**单机
> macOS** 形态；无多机 / HA / 容器化。

## 生产常驻进程（PRODUCTION_RUNTIME_V1）

```bash
node scripts/production-runtime.mjs [--root <dir>] [--tick-ms N] [--concurrency N] [--catchup 0|1]
```

- 一个进程一个职责：让组合好的 Agent Core 保持在线——Scheduler 引擎（消费外部写入
  的 jobs）+ Notification Ingress（`POST /v1/deliver`，localhost:8790）+ Product API
  （localhost:8787）+ Feishu channel。
- 持久根：`PRODUCTION_RUNTIME_ROOT`（默认 `~/.agent-core`）；scheduler jobs 落
  `<root>/scheduler/jobs/jobs.json` + `runs.jsonl`；生命周期/准入证据落
  `<root>/control/runtime-evidence.jsonl`。
- 崩溃恢复 = supervision 的职责（launchd KeepAlive）；进程自身只处理优雅
  SIGTERM/SIGINT，停机期间到期的 at-job 在下次启动补跑（每 job 至多一次）。

## launchd 形态（macOS）

`scripts/production-runtime-launchd.mjs` 生成/管理 KeepAlive 的 launchd 配置。
trusted 节点安装：`scripts/trusted-cp-deploy-install.sh`（uid/gid 降权与 spawn
helper 见 [security/trusted-control-plane](../security/trusted-control-plane.md)）。

## 备份保留

`scripts/agent-core-backup-ops.sh`（governing Spec：
`docs/specs/AGENT_CORE_BACKUP_RETENTION_V1.md`，accepted）。

## 验收脚本（部署后核查）

`production-runtime-v1-verify.mjs`、`trusted-cp-hardening-v1-verify.mjs`、
`trusted-credential-broker-v1-verify.mjs`、`agent-core-production-resident-v1-verify.mjs`
——见 [reference/cli](../reference/cli.md)。

## 配置面

环境变量总表见 [reference/configuration](../reference/configuration.md)；凭据位置见
[security/credentials](../security/credentials.md)。

历史部署证据（hardening 细节、cutover 记录）见
[docs/history/reports/](../history/reports/)（production-runtime-v1、
trusted-control-plane-deployment-hardening-v1 等）——历史，机制以本页与代码为准。
