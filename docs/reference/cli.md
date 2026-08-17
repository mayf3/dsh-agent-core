# 脚本面（CLI / Scripts）

> status: current · 如实描述仓库现有脚本；**不构成产品安装器**（产品 Quick Start
> 尚缺失，见 [getting-started/quick-start](../getting-started/quick-start.md)）。

## npm scripts（根 package.json）

| 命令 | 作用 |
|---|---|
| `npm test` | 全包单测（`node --test packages/*/test/*.test.js`） |
| `npm run install:integration` | 控制面 profile 装入 DSH home（symlink，additive） |
| `npm run verify:product-integration` | Integration V1 端到端验收 |
| `npm run test:scheduler` / `verify:scheduler` | Scheduler 单测 / 验收 |
| `npm run test:scheduler-router` / `verify:scheduler-router-final` | Scheduler↔Router 集成 |
| `npm run verify:delivery` | Router 出站投递验收 |
| `npm run import:openclaw-jobs` | OpenClaw job 导入 |

## scripts/ 下的主要 .mjs / .sh（按用途）

**developer verification（验收驱动）**：`integration-v1-verify` ·
`product-integration-v1-verify` · `scheduler-v1-verify` ·
`scheduler-router-final-v1-verify` · `agent-router-delivery-v0-verify` ·
`memory-v1-verify` · `agent-definition-access-v1-verify` · `mobile-gate1-verify` ·
`production-runtime-v1-verify` · `agent-core-production-resident-v1-verify` ·
`trusted-cp-hardening-v1-verify` · `trusted-credential-broker-v1-verify` ·
`production-integration-v1-acceptance` · `scheduler-caller-migration-v1-verify` ·
`stock-agent-registry-adoption-v1-verify` · `trusted-credential-505-final-v2-run` ·
`test-agent-core-backup-retention-v1.sh` · `production-integration-v1-root-verify.sh`

**运行 / 运维**：`production-runtime.mjs`（常驻组合入口）·
`production-runtime-launchd.mjs`（launchd 配置）· `agentcore-cron.mjs`
（scheduler CLI：add/list/runs，纯控制面）· `openclaw-job-import.mjs` ·
`agent-core-backup-ops.sh` · `agent-core-resident.mjs` ·
`production-agent-provision.mjs` · `rollback-callers-to-openclaw-v1.sh` ·
`trusted-cp-deploy-install.sh` · `setup-feishu-creds.mjs`

**一次性迁移 / 历史 PoC**：`migrate-registry-to-definition.mjs` ·
`install-demo-home.mjs` · `demo-home.mjs` · `process-model-demo.mjs` ·
`agent-session-v1-poc.mjs` · `dsh-agent-spawn-helper.c`（setuid helper 源码）

> V0 时代的 `install-profile.mjs` / `run.mjs` / `verify.mjs` 已随 V0 切片移入
> `examples/v0-vertical-slice/scripts/`（废弃，不得复活）。
