# docs/history — 研发历史档案导航

> status: current（history index）· 本目录是 **发生过什么**（engineering evidence + 旧 current 快照）。
> 它不是当前架构文档。当前文档树见 [docs/README.md](../README.md)。

## 这里有什么 / 不有什么

- `reports/` — 27 份各模块实现/验收报告（原 `docs/reports/`，git mv 保留历史）。
- `snapshots/` — 5 份被 Current Docs 取代的旧「当前态」/ 冻结草案快照
  （CAPABILITY_MATRIX、TRUST-BOUNDARY-REPORT、三个 AGENT_CORE_* 冻结草案）。
- **不在**这里：`docs/investigations/`（Evidence Authority，活跃）、`docs/specs/`
  （Change Authority）、`docs/decisions/`（Long-lived Invariant）—— 三者是活跃
  Knowledge Authority，保持原位（见 [`docs/specs/OPEN_SOURCE_DOCS_CONVERGENCE_V1.md`](../specs/OPEN_SOURCE_DOCS_CONVERGENCE_V1.md) Amendment 1）。

## Historical marker

每份历史文档顶部带机器可识别 frontmatter（Spec §6.1）：

```yaml
---
status: historical
as_of: <YYYY-MM-DD>          # 文档基线/验收日期
superseded_by: <相对路径|空>   # 对应 current authority（若存在）
public: PUBLIC | PUBLIC_AFTER_SANITIZE | INTERNAL_EVIDENCE
---
```

## Public-safety disposition 总表

判定模型（Spec §7 / Amendment 4）：**PRIVACY/HYGIENE ≠ SECRET EXPOSURE**。
本轮 implementation-start 审计 + secret 扫描结论：**SECRET_EXPOSURE_FOUND = NO**
（未发现真实 token / API key / clientSecret / private credential value）。

- **original** = Spec §8 写作时的预判分级（INTERNAL_EVIDENCE = 判含不可 sanitize 的内部证据）。
- **sanitize** = 本轮是否已做 privacy/hygiene 替换（`/Users/<name>`→`<home>`、
  uid/gid→`<uid>`、真实 `oc_*/cli_*/ou_*` id→`<redacted>`、服务用户名→`<svc-user>`、
  内部 launchd label / 端口→`<redacted>`/`<port>`）。
- **final** = sanitize 后的最终判定（Spec §7.2「sanitize 后重新判 PUBLIC」）。
  原 INTERNAL_EVIDENCE 各篇的标识符已全部 redact，且从未含 credential **value**，
  故重新判为 PUBLIC_AFTER_SANITIZE；未 sanitize 的原 PUBLIC 各篇经扫描确认无 hygiene 命中。
- sanitize 前的原文可经 git history 追溯（本仓库为公开仓库，git history 即原始存档）。

| 文档 | as_of | superseded_by | original | sanitize | final |
|---|---|---|---|---|---|
| [reports/agent-core-production-resident-v1.md](reports/agent-core-production-resident-v1.md) | 2026-08-15 | — | JUDGED_AT_IMPL | no | PUBLIC |
| [reports/agent-definition-config-v1.md](reports/agent-definition-config-v1.md) | 2026-08-16 | `../../concepts/agents.md` | PUBLIC | YES | PUBLIC_AFTER_SANITIZE |
| [reports/agent-registry-v1.md](reports/agent-registry-v1.md) | 2026-08-15 | `../../concepts/agents.md` | PUBLIC | no | PUBLIC |
| [reports/agent-router-delivery-v0.md](reports/agent-router-delivery-v0.md) | 2026-08-16 | — | PUBLIC | no | PUBLIC |
| [reports/agent-session-v1.md](reports/agent-session-v1.md) | 2026-08-15 | `../../concepts/agents.md` | PUBLIC_AFTER_SANITIZE | no | PUBLIC |
| [reports/bootstrap-v0.md](reports/bootstrap-v0.md) | 2026-08-15 | — | PUBLIC | no | PUBLIC |
| [reports/broker-transport-v1.md](reports/broker-transport-v1.md) | 2026-08-15 | `../../guides/integrations.md` | PUBLIC_AFTER_SANITIZE | no | PUBLIC |
| [reports/broker-v1.md](reports/broker-v1.md) | 2026-08-15 | `../../guides/integrations.md` | PUBLIC | no | PUBLIC |
| [reports/delivery-pipeline-integration-v0.md](reports/delivery-pipeline-integration-v0.md) | 2026-08-16 | `../../guides/integrations.md` | PUBLIC | no | PUBLIC |
| [reports/feishu-connector-v0.md](reports/feishu-connector-v0.md) | 2026-08-15 | `../../guides/integrations.md` | PUBLIC | YES | PUBLIC_AFTER_SANITIZE |
| [reports/integration-review.md](reports/integration-review.md) | 2026-08-15 | — | PUBLIC_AFTER_SANITIZE | no | PUBLIC |
| [reports/integration-v1.md](reports/integration-v1.md) | 2026-08-15 | — | PUBLIC_AFTER_SANITIZE | YES | PUBLIC_AFTER_SANITIZE |
| [reports/memory-v1.md](reports/memory-v1.md) | 2026-08-15 | `../../concepts/workspace-and-memory.md` | PUBLIC | no | PUBLIC |
| [reports/mobile-gate1-v1.md](reports/mobile-gate1-v1.md) | 2026-08-15 | `../../guides/integrations.md` | PUBLIC | no | PUBLIC |
| [reports/openclaw-scheduler-caller-migration-v1.md](reports/openclaw-scheduler-caller-migration-v1.md) | 2026-08-15 | `../../guides/scheduler.md` | JUDGED_AT_IMPL | YES | PUBLIC_AFTER_SANITIZE |
| [reports/process-model-demo-v0.md](reports/process-model-demo-v0.md) | 2026-08-15 | — | PUBLIC | no | PUBLIC |
| [reports/product-integration-v1.md](reports/product-integration-v1.md) | 2026-08-15 | — | PUBLIC_AFTER_SANITIZE | no | PUBLIC |
| [reports/production-runtime-v1.md](reports/production-runtime-v1.md) | 2026-08-16 | `../../guides/deployment.md` | JUDGED_AT_IMPL | YES | PUBLIC_AFTER_SANITIZE |
| [reports/repo-hygiene-convergence-v1.md](reports/repo-hygiene-convergence-v1.md) | 2026-08-16 | — | JUDGED_AT_IMPL | no | PUBLIC |
| [reports/scheduler-production-cutover-closure-v1.md](reports/scheduler-production-cutover-closure-v1.md) | 2026-08-15 | `../../guides/scheduler.md` | INTERNAL_EVIDENCE | YES | PUBLIC_AFTER_SANITIZE |
| [reports/scheduler-replacement-v1.md](reports/scheduler-replacement-v1.md) | 2026-08-15 | `../../guides/scheduler.md` | PUBLIC_AFTER_SANITIZE | no | PUBLIC |
| [reports/scheduler-router-final-integration-v1.md](reports/scheduler-router-final-integration-v1.md) | 2026-08-15 | `../../guides/scheduler.md` | PUBLIC_AFTER_SANITIZE | YES | PUBLIC_AFTER_SANITIZE |
| [reports/stock-agent-registry-adoption-v1.md](reports/stock-agent-registry-adoption-v1.md) | 2026-08-15 | `../../concepts/agents.md` | INTERNAL_EVIDENCE | YES | PUBLIC_AFTER_SANITIZE |
| [reports/trusted-control-plane-deployment-hardening-v1.md](reports/trusted-control-plane-deployment-hardening-v1.md) | 2026-08-16 | `../../guides/deployment.md` | JUDGED_AT_IMPL | YES | PUBLIC_AFTER_SANITIZE |
| [reports/trusted-credential-505-final-acceptance-v2.md](reports/trusted-credential-505-final-acceptance-v2.md) | 2026-08-15 | `../../security/credentials.md` | INTERNAL_EVIDENCE | YES | PUBLIC_AFTER_SANITIZE |
| [reports/trusted-credential-broker-integration-v1.md](reports/trusted-credential-broker-integration-v1.md) | 2026-08-15 | `../../security/credentials.md` | INTERNAL_EVIDENCE | YES | PUBLIC_AFTER_SANITIZE |
| [reports/workspace-bootstrap-v0.md](reports/workspace-bootstrap-v0.md) | 2026-08-15 | — | PUBLIC | no | PUBLIC |
| [snapshots/AGENT_CORE_COMPONENT_MAP_V1.md](snapshots/AGENT_CORE_COMPONENT_MAP_V1.md) | 2026-08-15 | `../../architecture/overview.md` | PUBLIC_AFTER_SANITIZE | no | PUBLIC |
| [snapshots/AGENT_CORE_PRODUCT_ARCHITECTURE_V1.md](snapshots/AGENT_CORE_PRODUCT_ARCHITECTURE_V1.md) | 2026-08-15 | `../../architecture/overview.md` | PUBLIC_AFTER_SANITIZE | no | PUBLIC |
| [snapshots/AGENT_CORE_ROADMAP_V1.md](snapshots/AGENT_CORE_ROADMAP_V1.md) | 2026-08-15 | `../../architecture/overview.md` | PUBLIC_AFTER_SANITIZE | no | PUBLIC |
| [snapshots/CAPABILITY_MATRIX.md](snapshots/CAPABILITY_MATRIX.md) | 2026-08-15 | `../../architecture/overview.md` | PUBLIC_AFTER_SANITIZE | no | PUBLIC |
| [snapshots/TRUST-BOUNDARY-REPORT.md](snapshots/TRUST-BOUNDARY-REPORT.md) | 2026-08-15 | `../../security/security-model.md` | PUBLIC_AFTER_SANITIZE | no | PUBLIC |

同轮 sanitize 也应用于仍留在原位的
`docs/investigations/`（5 件含 hygiene 命中：
openclaw-scheduler-caller-migration-v1、stock-agent-registry-adoption-v1、
test-agent-feishu-product-semantics-v1、agent-core-backup-retention-v1-proposal、
openclaw-lark-transport-reuse-v1）。investigations 不在本目录、不迁移，仅做公开性分级。

## 已知未 sanitize 的例外（frozen，非本目录）

- `docs/specs/*.md` — Spec 是冻结 authority，本轮 implementation 无权修改
  （GOVERNING_SPEC_UNMODIFIED）；其中 OPEN_SOURCE_DOCS_CONVERGENCE_V1 §7 的示例引用
  含 `/Users/<name>` 字样，属引述证据，留待 Project Owner 决定是否以 Spec amendment 处理。
- `docs/decisions/AGENT_SESSION_CHANNEL_MODEL_V1.api.json` — 机器可读契约，Spec §8.3
  冻结「契约语义不动」；如需 redact 须走独立契约 revision。
