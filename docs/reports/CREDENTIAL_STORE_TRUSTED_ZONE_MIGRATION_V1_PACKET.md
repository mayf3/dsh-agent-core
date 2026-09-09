# CREDENTIAL_STORE_TRUSTED_ZONE_MIGRATION_V1 — Deployment Packet

> status: **READY_FOR_PRODUCTION_PACKET** · PRODUCTION_APPLY = **HOLD** ·
> **PRODUCTION_OPERATION_AUTHORIZED = NO**（等 union acceptance；
> 不得先迁生产 store 再证明）
> governing parent authority: `AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1`
> Part G（trusted store 契约——本包是其**部署 conformance**，零语义变更）
> authorization context: Owner ruling union DECISION_3（2026-09-09）：
> MIGRATION_REQUIRED_FOR_CANONICAL_ONBOARDING = YES；logical consumer path
> 不变（root-controlled stable relative symlink）；真实权威文件入 0700/0600
> authsvc 私区；Broker read-through；provisioning/rotation 写真实路径。
> 性质：dsh-agent-core 的 **credential 基础设施部署 conformance**，不是
> Workbench-specific migration。

## 1. pre/post state（exact）

```text
PRE:  /usr/local/libexec/agent-core/config/agent-credentials.json  普通文件 0600 authsvc(505:601)
      父目录 config/ 0755 root:wheel
POST: /usr/local/libexec/agent-core/credential-store/                       0700 authsvc:authsvc
      /usr/local/libexec/agent-core/credential-store/agent-credentials.json 0600 authsvc:authsvc（真实权威文件）
      /usr/local/libexec/agent-core/config/agent-credentials.json → 相对符号链接
        ../credential-store/agent-credentials.json（root-controlled stable link）
```

## 2. consumer compatibility（逐面核实）

| 消费面 | 语义 | 迁移后 |
|---|---|---|
| Broker gateway（authsvc runtime） | 每次调用 `readFileSync(pinned)` 重读 | **不变**：readFileSync 跟随符号链接；per-call reread 语义保留（rotation 即时生效） |
| launchd plist `AGENT_CORE_CREDENTIALS_FILE` | pinned 路径 env 绑定 | **不变**（链接对 env 透明） |
| pinned executor（inspect/real-use 的 `-f`/sha 检查） | 跟随符号链接 | **不变** |
| provisioning 库（ensure/store-writer） | lstat 拒 symlink、要求 0700 trusted 父目录 | 面向**真实路径**（迁移后 Part G 全合规） |
| rotation seam（replaceCredentialForAgent + `.bak` preimage） | 同上 lstat 语义 | 面向**真实路径**；`.bak` 与真实文件同私区 |

## 3. 状态机与 crash 边界（`scripts/credential-store-trusted-zone-lib.mjs`）

```text
FRESH（pinned=file 0600）      → preimage+receipt（apply 起始即写，crash 可归类）
                               → zone 0700 建立并核验 → 原子 rename（属主/模式保持）
                               → temp+rename 建相对符号链接（broker 面永无空窗）
                               → 双面验证（read-through 字节相等 + V1 shape +
                                 entryCount + 0700/0600/属主）
MOVED_NO_LINK（rename 后 symlink 前崩溃）→ 有 receipt ⇒ resume 补链接；
                                          无 receipt ⇒ BLOCKED（generation 不可证）
MIGRATED                        → rerun noop
DANGLING_SYMLINK / DUPLICATE_FILES / 外来 symlink → BLOCKED_REQUIRES_RECONCILIATION
链接父目录门                    = root 属主 + 非 group/world writable
                                 （authsvc 不可替换符号链接——迁移评审项）
```

## 4. GENERATION-SAFE ROLLBACK（owner 裁决 CRITICAL_ROLLBACK_CORRECTION 原文实现）

```text
CASE A  当前 zone 文件 sha == receipt.postimageSha256（迁移后零 credential 变更）
        → 机械恢复原布局（当前字节原路回 pinned，摘除 zone 文件）
CASE B  generation 已前进（create/rotate/...）→ 搬迁【当前权威字节】回
        canonical 旧位置；绝不以 stale preimage 覆盖
不可证  receipt 缺失/损坏、zone 文件缺失、布局不识别
        → ROLLBACK = BLOCKED_REQUIRES_RECONCILIATION（目录布局恢复永不压过
          credential state）
技术保证：回滚经 temp-file+rename 原子替换，broker 读面全程连续可读
```

## 5. 验证

fixture 状态机自测 10/10（fresh/rerun/S2-crash-resume/无 receipt BLOCKED/
dangling BLOCKED/duplicate BLOCKED/CASE A/CASE B/无 receipt 回滚 BLOCKED/
父目录门+非 root 门+uid 不匹配门）；含 no-secret-output 断言（结果对象不含
任何 credential 值）。生产 pre-state 已实证：pinned=file 0600 505:601、
14045 bytes、未迁移（--status 输出，2026-09-09）。

## 6. 已知边界（不阻塞，记录）

- 现有 88-Agent credential availability 的最终确认在 apply 的双面验证内
  （entryCount + read-through 字节断言）；production 执行后需附一次
  `--status` + executor `inspect-runtime` 回执。
- fleet 88 Agent 的既有授权面（grants）不受影响（本包只动 store 布局，
  不触 auth DB）。
- auth-service rebind loopback（AMENDMENT_8 C1）属独立生产步骤，与本包无关。

## 7. 执行门

union acceptance（exact digest/head）之前：不执行 --apply/--rollback 于生产
路径；生产执行序列（届时）：`--status` → `--apply` → `--status` +
`inspect-runtime` 回执 → 88-Agent 抽样 mint 验证。回滚序列：`--rollback`
（CASE 判定自动）。
