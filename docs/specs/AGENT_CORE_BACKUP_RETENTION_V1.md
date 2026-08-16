---
spec_id: AGENT_CORE_BACKUP_RETENTION_V1
status: draft
---

# Agent Core Backup Retention V1

> 性质：**Spec（本轮只收敛冻结，不实施）** · 日期：2026-08-16
> 仓库：`mayf3/dsh-agent-core`
> 角色：Deployment / Ops Spec Agent
>
> 本 Spec 是 `AGENT_CORE_BACKUP_RETENTION_V1_PROPOSAL = PASS`（已冻结）的实施授权收敛，
> 只回答「这次允许实现什么」。调查与 Proposal 细节**不在本 Spec 复制**，仅作为 evidence
> source 引用：`docs/investigations/agent-core-backup-retention-v1-proposal.md`。
>
> 本轮只新增 `docs/specs/AGENT_CORE_BACKUP_RETENTION_V1.md`（并把已冻结 Proposal 入库以便
> 引用）。**不重新调查 backup、不修改部署脚本、不删除任何 backup、不进入 Implementation。**

---

## Problem

当前 trusted Agent Core install（`/usr/local/libexec/agent-core`）的 deployment rollback
backup lifecycle **未定义**：

- 每次 deployment 通过 predeploy `mv` 把完整 previous trusted closure 保存为
  `/usr/local/libexec/agent-core.bak-*`；
- 每份约 `1.5–1.7 GiB`，当前 retention **无界**（全树 grep 无任何 `prune`/`retention`/
  `rm -rf *bak*` 路径，见 Proposal）；
- 部分 `mv` 捕捉到 interrupt/partial install（新 closure 未建成），形成**不可 rollback 的
  「backup」**（如 `211201`，`app/ config/ home/` 全空）；
- rollback 选择纯人工、无 known-good / pinned / deployment-status marker。

这不是一次性 cleanup 问题，而是 **deployment rollback backup lifecycle 未定义**。

## Proposal

冻结如下模型，作为 Implementation 的唯一授权：

### Retention Model

```text
NORMAL_RETENTION = 3
PINNED_MINIMUM   = 1
```

- pinned backup **不**计入 normal retention、**永不**自动 prune。
- Pin 必须且只能是 **metadata / marker**，**禁止复制 backup data**。

### Current Legacy State

当前历史 backup 无可靠 known-good metadata：

```text
CURRENT_HISTORICAL_PIN_SET                   = NONE
AUTO_PRUNE_LEGACY_BACKUPS_BEFORE_FIRST_PIN   = NO
```

- 不允许 Implementation 启用后第一次运行就 `keep newest 3 → delete everything else`。
- 当前 `CURRENT_LAST_KNOWN_GOOD = ACTIVE_RUN8_INSTALL`（Run-8 PASS installed closure）。
- 下一次 deployment 开始时，该 closure 被 predeploy rename 成 backup，从此份起：
  `FIRST_RELIABLE_PIN = that backup`，才建立第一份有可靠 provenance 的 pinned rollback point。

### Metadata Model

描述的是**被备份的 previous installed closure**，不是正在部署的 successor。保持最小：

```text
created_at
source_commit      # previous app commit；不可靠取得时为 unknown
pinned
```

可增加一个极小的 `status` 字段。**禁止**把新 deployment 的 git HEAD 错记为旧 backup 的
source commit。harness commit 若 `.source-stamp` 可可靠读取，可作为独立 metadata 字段。

### Pin Model

不复制数据，采用 Proposal 调查结论中最小形式（或等价 sidecar）：

```text
<backup>/.backup-meta
<backup>/.pinned
```

必须保持现有 `agent-core.bak-YYYYMMDD-HHMMSS` directory naming / rollback compatibility。
**不重写 rollback mechanism。**

### Backup Lifecycle

保持现有基本行为：

```text
current trusted closure
  → predeploy backup
  → install new closure
  → launch/restart
  → required health verification
```

prune 只能发生在 `verification success → deployment success declared → prune NORMAL backups`。

### Failure Semantics

```text
deployment fails        → PRUNE = NO
health verification fails → PRUNE = NO
rollback backup is used   → KEEP
prune operation partially fails
  → loud warning
  → healthy deployment remains successful
  → retry on future deployment
```

> 一次失败 deployment 绝不能降低 rollback capacity。

### Concurrent Deployment Policy

```text
CONCURRENT_DEPLOY_GUARD = NO
```

V1 明确假设 deployments 是 operator-serialized。concurrent deployment =
`UNSUPPORTED / FOLLOW_UP_DEBT`。本 Spec 不允许顺手实现 flock / lock service。若
Implementation 得到新证据证明并发已发生或会由现有自动化触发：`NEED_AMENDED/NEW_SPEC = YES`，
停止扩大 scope。

## Scope

允许实现（优先 **shell / filesystem**）：

- deployment backup metadata；
- pin 语义；
- normal retention；
- post-verification prune；
- minimal ops visibility。

## Non-Goals and Frozen Boundaries

```
RUNTIME_CODE_CHANGE = NONE
ROUTER_CHANGE = NONE
SCHEDULER_CHANGE = NONE
PRODUCT_SEMANTICS_CHANGE = NONE
KERNEL_CHANGE = NONE
```

明确不在本 Spec 范围内：

- deployment service / DB / dashboard / rollback framework rewrite；
- flock / lock service / concurrent-deploy guard；
- 当前 13 个历史 backup 的删除（含 `211201`）：`DELETE = OUT_OF_SCOPE`；
  仅当 **first reliable pinned LKG established** 后，由独立 operator cleanup task 处理；
- 把新 backup 的 git HEAD 归属为旧 backup 的 source commit；
- 首次运行即 prune legacy。

## Alternatives considered

- **全局 retention 服务 / DB 账本**：否决。本轮只需要 shell/filesystem 的最小 retention，
  不需要新增 service / DB（见 Scope）。
- **`keep newest 3 → delete everything else` 一次到位**：否决。因当前历史 backup 无
  known-good marker（`211201` 为 broken capture），首次无条件 prune 会摧毁唯一可恢复点。
- **复制 data 做 pin**：否决。pin 只允许 metadata / marker，禁止复制 1.5–1.7 GiB 数据。
- **给新 deployment 的 successor 写 metadata**：否决。metadata 必须描述 previous closure，
  不能把新 git HEAD 归属到旧 backup。
- **顺手实现 flock / lock service 防并发**：否决。V1 假设 operator-serialized，
  concurrent deploy 明确列为 FOLLOW_UP_DEBT，不扩大 scope。

## Acceptance Criteria

后续 Implementation 至少证明：

1. 第一次 deployment 能把当前 verified LKG backup 标为 pinned。
2. pinned 不复制数据。
3. pinned backup 永不进入 normal prune。
4. verified success 后 normal backups 最多保留最新 3 个。
5. failure path 不 prune。
6. health failure 不 prune。
7. prune failure loud but does not fail healthy deployment。
8. 现有 backup directory naming / rollback compatibility 保留。
9. legacy 13 backups 在第一 reliable pin 建立前不会自动 prune。
10. metadata 不错误归属 successor commit。
11. 不修改 Runtime / Router / Scheduler / Kernel / product semantics。

## Risks

- **prune 在错误时机触发**破坏 rollback 能力 → 以 strict failure semantics（PRUNE=NO on
  fail / health-fail，KEEP on rollback）与「prune 仅发生在 verified success 之后」为硬约束。
- **legacy 误删**（broken backup 与可用 LKG 无法区分）→ 明确 `AUTO_PRUNE_LEGACY_BEFORE_FIRST_PIN = NO` + `DELETE = OUT_OF_SCOPE`。
- **metadata 归属错误**误导人工 rollback → 冻结 `source_commit = unknown` 兜底、禁止 successor
  归属。
- 若未来真实证据表明并发 deployment 会发生 → 需 amended/new Spec（见 Concurrent Deployment Policy），
  不得在本 Spec 内顺手实现。

## Expected Implementation Files

根据 Proposal 已调查出的真实代码，明确列出预计允许修改的 deployment / verification script：

```text
scripts/trusted-cp-deploy-install.sh
```

以及确有必要的 deployment verification / operator helper。若一个小 helper 能明显降低
shell 重复可以提议；**不为了「代码漂亮」增加新的 package/service**。本 Spec 不新增
deployment service / DB / dashboard。

## Related Evidence

- `AGENT_CORE_BACKUP_RETENTION_V1_PROPOSAL = PASS`（Investigation evidence）：
  `docs/investigations/agent-core-backup-retention-v1-proposal.md`。
- 本 Spec **不复制**完整 13-backup inventory / 705 行调查过程，均以 Proposal 为 source。

---

## Final Output

```text
AGENT_CORE_BACKUP_RETENTION_V1_SPEC = PASS

BASE_MAIN = da7ac27b766c4fd993aa548532350b4686644b68
SPEC_HEAD = docs/agent-core-backup-retention-v1-spec @ 57540c5

PROBLEM  = deployment rollback backup lifecycle is undefined (无界 retention, ~1.5-1.7GiB/份,
           blind mv 捕捉到 partial install 破坏 rollback, 无 known-good/pin marker)
SCOPE    = backup metadata · pin 语义 · normal retention · post-verification prune ·
           minimal ops visibility (shell/filesystem 优先)
RETENTION_MODEL = NORMAL_RETENTION=3 · PINNED_MINIMUM=1 · pinned 不计数且永不自动 prune
PIN_MODEL = metadata/marker only, 不复制 data · <backup>/.backup-meta | <backup>/.pinned
            (或等价 sidecar) · 保留 agent-core.bak-YYYYMMDD-HHMMSS naming/rollback compat
METADATA_MODEL = created_at · source_commit(=unknown if 不可靠) · pinned (+极小 status)
FAILURE_SEMANTICS = deploy-fail→NO prune · health-fail→NO prune · rollback-used→KEEP ·
                    prune partial-fail→loud warning, deployment stays successful, 下次重试
PRUNE_TRIGGER = verification success → deployment success declared → prune NORMAL backups;
                (禁止 prune-before-install / prune-before-health-verification)
LEGACY_BACKUP_POLICY = CURRENT_HISTORICAL_PIN_SET=NONE ·
                       AUTO_PRUNE_LEGACY_BACKUPS_BEFORE_FIRST_PIN=NO ·
                       DELETE legacy 13 (含 211201) = OUT_OF_SCOPE ·
                       FIRST_RELIABLE_PIN 后独立 operator cleanup
CONCURRENT_DEPLOY_POLICY = CONCURRENT_DEPLOY_GUARD=NO · operator-serialized 假设 ·
                           concurrent=UNSUPPORTED/FOLLOW_UP_DEBT · 不实现 flock/lock
ACCEPTANCE_CRITERIA = AC-1..AC-11 (见上文 Acceptance Criteria)
EXPECTED_IMPLEMENTATION_FILES = scripts/trusted-cp-deploy-install.sh
                                (+ deployment verification/operator helper, 仅在减少 shell 重复时)

RELATED_INVESTIGATION = AGENT_CORE_BACKUP_RETENTION_V1_PROPOSAL = PASS
                        (docs/investigations/agent-core-backup-retention-v1-proposal.md)

RUNTIME_CODE_CHANGE = NONE
ROUTER_CHANGE = NONE
PRODUCT_SEMANTICS_CHANGE = NONE
KERNEL_CHANGE = NONE
```
