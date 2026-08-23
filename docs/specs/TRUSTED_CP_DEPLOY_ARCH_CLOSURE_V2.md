---
spec_id: TRUSTED_CP_DEPLOY_ARCH_CLOSURE_V2
status: proposed
date: 2026-08-23
spec_kind: implementation
authority_level: governing_spec
implementation_authority: none
production_apply_authority: none
scope:
  - trusted control-plane deployment process architecture pinning — pnpm is executed only by the materialized trusted x64 Node interpreter ("$TRUSTED_NODE" /usr/local/bin/pnpm install ...), with node-runtime materialized into the staging root before the harness install step
  - staging-root install with atomic swap into the live trusted root; pnpm never executes against the live tree
  - deploy gates G1-G12 (target platform/arch fail-loud, closure manifest, all-native-addon Mach-O verification, plugin-entry load, staging child boot, RPC initialize, one low-risk turn, deploy lock, clean-source/dirty-ack, immutable rollback artifact, source/closure stamps, install-success-is-not-deploy-success)
  - supplementary deploy invariants (health is not child availability; node-runtime before install; pinned and verified pnpm/corepack identity; backups not hollowed by reuse move; verified LKG never pruned; all gates pass before production swap; automatic rollback on gate failure)
  - backup integrity extensions that remain strictly additive to AGENT_CORE_BACKUP_RETENTION_V1 frozen semantics
governed_by:
  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0
  - AGENT_CORE_BACKUP_RETENTION_V1
external_authorities: []
supersedes: []
superseded_by: null
owners:
  - mayf3
references:
  - docs/investigations/trusted-cp-cross-arch-dependency-closure-v1.md (evidence authority; root-cause chain, sandbox reproductions, deploy archaeology, gate design — committed verbatim alongside this Spec)
  - docs/reports/trusted-control-plane-deployment-hardening-v1.md (current deployment-flow authority of record; supplemented, NOT superseded)
  - docs/specs/AGENT_CORE_BACKUP_RETENTION_V1.md (accepted; backup retention semantics remain fully in force; additively extended here)
  - scripts/trusted-cp-deploy-install.sh (expected future implementation file; unmodified in this authoring round)
  - scripts/agent-core-backup-ops.sh (expected future implementation file; unmodified in this authoring round)
  - scripts/trusted-cp-hardening-v1-verify.mjs (existing verification driver; acceptance-only model override seam referenced by G7)
---

# TRUSTED_CP_DEPLOY_ARCH_CLOSURE_V2 — Trusted CP 跨架构依赖闭包部署收口（staging + 十二门 + 原子换树）

> 状态：**proposed**（authoring round；SPEC ONLY — 本轮不实现、不修改任何脚本、不修改 Harness、不触 production、不 deploy、不 restart）。
> 本 Spec 授权的是**未来**对 trusted CP 部署流程的修复；`implementation_authority = none`、
> `production_apply_authority = none`，接受前不构成任何实现或生产应用许可。
> 作者化基座：`origin/main` = `0a6e060913e12693142fb0759f35f239b2ef429a`（2026-08-23 fetch 复核）。
> Evidence authority：`docs/investigations/trusted-cp-cross-arch-dependency-closure-v1.md`（2026-08-23，
> 逐环实证 + /tmp 沙箱复现 + backup 考古；本 Spec 不复制其调查过程，仅引用结论并冻结裁决）。

---

## 0. Authoring-round output

```text
SPEC_GOVERNANCE_MODE = AUTHOR
SPEC_ID = TRUSTED_CP_DEPLOY_ARCH_CLOSURE_V2
SPEC_KIND = implementation
STATUS = proposed
AUTHORITY_LEVEL = governing_spec
IMPLEMENTATION_AUTHORITY = none
PRODUCTION_APPLY_AUTHORITY = none

SELECTED_ARCHITECTURE_STRATEGY = TRUSTED_X64_NODE_EXPLICITLY_EXECUTES_PNPM
SUPERSEDES = NONE
PARTIAL_SUPERSESSION = NONE

OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE

GATE_COUNT = 12 (G1-G12, frozen; §9 CTR-DEP-001..012)
SUPPLEMENTARY_INVARIANT_COUNT = 6 (CTR-DEP-013..016 + CTR-DEP-017/018 preservation contracts)
CONTRACT_COUNT = 18
CONTRACTS_WITH_ACCEPTANCE = 18
AUTHORING_READY_FOR_REVIEW = YES

AUTHORITY_FORM = LEGAL_CHILD_AUTHORITY (non-conflicting supplement; NOT whole-authority replacement; §3.0)

PRODUCT_CODE_CHANGE = NONE
SCRIPT_CHANGE = NONE
HARNESS_CHANGE = NONE
PRODUCTION_CHANGE = NONE
```

---

## 1. Goal

永久关闭「deploy 时 pnpm 进程架构 ≠ production Node 架构 → optional native binding 被
静默过滤 → 全部 Agent child 在 `initialize` RPC 前退出」这一故障类（调查 §0），并把
trusted CP 部署流程从「install 成功即视为完成、验收靠事后手工步骤」升级为：

1. **架构按构造正确**：install 闭包的解析架构 ≡ 未来运行该闭包的 trusted Node 架构
   （同一物化二进制执行 pnpm）；
2. **child 级证据换树**：任何 production swap 之前，在 staging 树上以真实 seam 证明
   plugin 装载、child boot、RPC initialize、一次 low-risk turn 全绿；
3. **失败可回滚**：backup 为完整不可变回滚件，child 级门失败自动回滚，verified LKG
   永不 prune；
4. **过程可审计**：closure manifest、source stamp、deploy-status 逐门落档。

本 Spec 只授权部署流程（scripts 层）的上述变更；不修改任何 Runtime / Router /
Scheduler / Auth / Broker / Kernel 产品语义。

## 2. Scope and non-goals

### In scope（未来实现允许触碰的面）

- `scripts/trusted-cp-deploy-install.sh`：deploy lock、TARGET 断言、node-runtime 物化
  提前、x64-pnpm 显式调用、closure manifest、stamp 断言、staging root + 原子换树、
  门挂接、deploy-status 落档；
- 新增 `scripts/trusted-cp-deploy-gates.mjs`（或等价单一 gate driver）：G2–G7 门驱动，
  staging / live 复验两用；
- `scripts/agent-core-backup-ops.sh`：**加法**扩展——manifest 边车、不可变标记、
  rollback-verify 挂接；其 PIN / prune / retention 冻结语义不变（CTR-DEP-018）；
- 配套测试：非 root 单测（fixture 模式）+ root 验收 runbook（scratch TRUSTED_ROOT
  fixture，本 Spec accepted 前不触 live 树）。

### Non-goals / frozen boundaries

```text
RUNTIME_CODE_CHANGE = NONE
ROUTER_CHANGE = NONE
SCHEDULER_CHANGE = NONE
AUTH_CHANGE = NONE
BROKER_CHANGE = NONE
KERNEL_CHANGE = NONE
```

明确不在本 Spec 范围内：

- corepack + pnpm 发行件迁入 trusted root（现状位于 uid-502 可写的
  `/usr/local/lib/node_modules`；为**既有**残留风险，本 Spec 仅记录并要求 fail-loud
  身份断言，不授权搬迁——见 OQ-1）；
- 修改 `AGENT_CORE_BACKUP_RETENTION_V1` 任何冻结语义（retention 计数、pin 模型、
  prune 时机、failure semantics）；超出加法扩展的部分须走该 Spec 自身的 amendment；
- universal / 跨机构建闭包（ALT-002/003 已否）；
- 新部署 service / DB / dashboard / rollback framework 重写；
- G7 turn 触碰生产 binding / Feishu 投递（只允许 acceptance-only model override seam），
  且该回合 MUST NOT 调用任何 tool（no-tool turn，见 CTR-DEP-007）；
- 修改 harness / vendor 源（策略 A 的构造性优点即零 vendor 改动；实现 MUST NOT 引入
  `pnpm-workspace.yaml` / `supportedArchitectures` 类源注入——那是被否决的 ALT-001
  路线）；
- 本轮（authoring round）对上述任何文件（含 Harness）的修改。

## 3. Authority and dependencies

### 3.0 Authority 形式选择（whole-authority replacement vs 合法 child authority）

按治理要求在两种合法形式中**显式选择其一**：

- **whole-authority replacement**：不选。V2 若要整体替换 hardening V1 report，就必须
 完整重述其全部安全语义（TRUSTED_NODE、505/502、审计矩阵……），任何遗漏都等于
  无声删除既有权威义务——这正是 partial supersession 的风险面；且 V2 的目标是
  **加门与换流程**，不是重定义信任边界。
- **合法 child authority（non-conflicting supplement）**：**选定**。V2 是部署流程域内
  的新（NEW）、非冲突 authority：不删除、不收窄、不反转任何既有 authority 的
  normative meaning；与既有 authority 的全部差异为穷举加法（§9 Contracts），并以
  CTR-DEP-017/018 两条 preservation contract 把既有语义钉为对 V2 实现的硬约束。
  `supersedes = []`、无 backlink 改写、PARTIAL_SUPERSESSION = NONE。

### 3.1 当前部署 authority 的识别（本轮前置义务）

对 `docs/specs/`、`docs/reports/`、`docs/investigations/`、`docs/decisions/` 的
authoring-round 检索结论——当前在位的部署流程 authority 有两处：

| Authority | 位置 | 性质 | 本 Spec 与其关系 |
|---|---|---|---|
| `TRUSTED_CONTROL_PLANE_DEPLOYMENT_HARDENING_V1` | `docs/reports/trusted-control-plane-deployment-hardening-v1.md` | 部署流程 + trusted install 安全语义的 authority of record（先于 specs/ 治理落地，grandfathered；install 步骤、TRUSTED_NODE、505/502 边界、symlink 审计、uid-502 攻击矩阵） | **SUPPLEMENTED，NOT SUPERSEDED**（§3.2） |
| `AGENT_CORE_BACKUP_RETENTION_V1` | `docs/specs/AGENT_CORE_BACKUP_RETENTION_V1.md` | accepted Spec；backup retention / pin / prune / failure semantics（其 Expected Implementation Files 即 `scripts/trusted-cp-deploy-install.sh`） | **ADDITIVELY EXTENDED，NOT SUPERSEDED**（§3.3） |

不存在任何已 accepted 的 Spec 拥有「部署期架构闭包校验」这一 scope；本 Spec 为该
scope 的**新**（NEW）authority。

### 3.2 对 hardening V1 report：SUPPLEMENTED_NOT_SUPERSEDED

- V2 **不整体替换**该 report（其安全语义——TRUSTED_NODE 物化与校验、505/502 降权
  模型、spawn helper root:wheel 4755、symlink 审计、uid-502 攻击矩阵、offline +
  frozen-lockfile + copy import——全部继续有效，并由 CTR-DEP-017 作为对本 Spec 实现
  的硬约束），因此按 SPEC_GOVERNANCE_V0 §9.2（whole-authority only，禁止 partial
  supersession）**不设置任何 supersession**：`supersedes = []`。
- V2 与该 report 的全部流程差异**穷举**于 §9 各 Contract（enumerated deltas）：
  install 目标改为 staging root、node-runtime 物化提前、pnpm 显式解释器调用、
  G1–G12 门、deploy lock、stamps、backup 不可强化、原子换树、deploy-status 落档。
  **未穷举之处一律沿用 hardening V1 既有语义**。
- 该 report 位于 `docs/reports/`，不是 `docs/specs/` 生命周期 Spec，无 supersession
  metadata 可写；本节即为书面 authority 关系记录。

### 3.3 对 AGENT_CORE_BACKUP_RETENTION_V1：ADDITIVE_EXTENSION_NOT_SUPERSEDE

- 该 Spec 冻结的 `NORMAL_RETENTION = 3`、`PINNED_MINIMUM = 1`、pin 仅 metadata、
  prune 仅发生在 verified success 之后、failure → PRUNE = NO、backup naming /
  rollback compatibility——**全部原样继续有效**，CTR-DEP-018 强制其 AC-1..AC-11 在
  V2 实现后仍须通过。无任何义务被删除、收窄或反转 → 不构成 supersession。
- **G8 deploy lock 与该 Spec 的 `CONCURRENT_DEPLOY_GUARD = NO`**：该 Spec 明文冻结
  「本 Spec 不允许顺手实现 flock / lock service；若得到新证据证明并发已发生或会由
  现有自动化触发：`NEED_AMENDED/NEW_SPEC = YES`」。V2 即按该出口提供的路径以**新
  Spec**授权 deploy lock，并记录 NEW_EVIDENCE：

  ```text
  NEW_EVIDENCE =
    调查 §5-G8：现状无任何 deploy lock，两个并发 install 会交错 mv/BAK/reuse；
    staging + 原子换树重设计使交错后果从「脏树」升级为「换树竞态」；
    2026-08-22 20:35-20:40 故障窗口证明部署后果可全灭 child。
  ```

- 该 Spec 的 failure semantics（失败不 prune、rollback-used 保持 KEEP）被 V2 的
  自动回滚（CTR-DEP-012/010）**沿用而非改写**：回滚后 prune 禁忌不变。
- **backup 元数据强化为加法**：该 Spec 允许 `source_commit = unknown` 兜底并禁止
  successor 归属；V2 通过 G11 stamps 使 unknown 对 V2 造出的 backup **结构性不可达**
  （CTR-DEP-011），同时保持其禁止归属错配的语义不变——属加法强化，非改写。

### 3.4 治理依赖

- `governed_by`: `AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0`（本 Spec 按
  SPEC_FORMAT_V0 / SPEC_GOVERNANCE_V0 撰写与走生命周期）、
  `AGENT_CORE_BACKUP_RETENTION_V1`（其冻结语义构成本 Spec 实现的上级约束）。
- `external_authorities = []`；无外部仓库 authority 被依赖或被治理。
- 无 lower-authority 覆盖 parent、无 partial supersession、无 Program→child 授权跳跃
  （本 Spec 直接为 implementation kind，不设 child Spec）。

## 4. Current State

- `STATE-001` — 当前 live trusted closure（`/usr/local/libexec/agent-core`，2026-08-23
  14:16 换入的树）为 **GOOD**：darwin-x64 binding 在位，且在 trusted x64 node 下
  `require('node-addon-require-builtin')` 加载成功、
  `requireBuiltin('internal/modules/esm/loader')` 返回对象；但
  `harness/.source-stamp` **缺失** → 下次部署无法 reuse → 全量重装 → 故障窗口随每次
  部署重新武装。Basis：`OBS-007`、调查 §2。
- `STATE-002` — 部署流程现状：install 目标即 live 路径（先 mv 走旧树再原位安装，
  安装期间 launchd 对不存在的路径每 10s 崩溃重启）；pnpm 以裸
  `/usr/local/bin/pnpm`（corepack shim，`#!/usr/bin/env node`）调用，解释器 arch 取
  决于 operator shell PATH；无 deploy lock、无 closure manifest、backup 的
  `source_commit` 恒 unknown、reuse 以 `mv` 掏空 backup；install 成功后仅有
  「Next: verify」尾行提示，验收为独立手工步骤。Basis：`OBS-002`、`OBS-003`、
  `OBS-006`、`OBS-009`、`OBS-010`；坐标 `scripts/trusted-cp-deploy-install.sh`
  @ main `0a6e060`（:125-129 reuse-mv、:145 裸 pnpm、:156 stamp、:173-174 node-runtime
  物化于 install 之后）。
- `STATE-003` — 故障已实际发生一次：2026-08-22 20:35–20:40 窗口，被换下的
  `bak-20260822-203550` 闭包中不存在任何 `node-addon-require-builtin-*` 平台目录
  （非 x64 安装产物），5 分钟后全量重装恢复。Basis：`OBS-007`、调查 §2。
- `STATE-004` — production Node 架构为 darwin-x64（Apple Silicon 主机经 Rosetta 运行
  Homebrew Intel 前缀的 node；live `node-runtime/bin/node -p process.arch` = `x64`，
  17 个历史 backup 中带 node-runtime 者均为 x64）。Basis：`OBS-001`、`OBS-007`。

## 5. Observations

> 完整调查过程、命令输出与沙箱实验记录见
> `docs/investigations/trusted-cp-cross-arch-dependency-closure-v1.md`（evidence
> authority）。此处仅收录 load-bearing 子集，坐标为该调查作者化时的实证坐标；标注
> `@ main 0a6e060` 者为本轮 authoring 复核仍在位。

- `OBS-001` — production trusted Node 为 x64。
  - Subject：`/usr/local/libexec/agent-core/node-runtime/bin/node`
  - Method：`file /usr/local/bin/node`（= `Mach-O 64-bit executable x86_64`，
    `/usr/local/Cellar/node/25.6.1_1`）+ live 树 `-p 'process.arch'` = `x64`
  - Environment：production host（Apple Silicon，Rosetta）
  - Observed at：2026-08-23
  - Provenance：调查 §1.1
- `OBS-002` — `/usr/local/bin/pnpm` 非独立二进制，是 corepack shim。
  - Subject：`/usr/local/bin/pnpm` → symlink `/usr/local/lib/node_modules/corepack/dist/pnpm.js`
  - Result：首行 `#!/usr/bin/env node`；symlink owner = yanfenma:admin（uid 502 可写路径）
  - Observed at：2026-08-23
  - Provenance：调查 §1.2
- `OBS-003` — deploy 期 pnpm 进程 arch 是 operator shell PATH 的函数。
  - Method：`which -a node`（`/opt/homebrew/bin/node`（arm64）在前、
    `/usr/local/bin/node`（x64）在后）；/etc/sudoers 无 `secure_path` Defaults →
    交互 shell PATH 原样进入 root 会话
  - Result：corepack shim 以 env 解析出的 node 运行（交互 zsh 下为 arm64）；corepack
    按 harness `package.json` `packageManager: pnpm@11.7.0` 执行
  - Observed at：2026-08-23
  - Provenance：调查 §1.2；@ main 0a6e060 `scripts/trusted-cp-deploy-install.sh:145`
    仍为裸 `/usr/local/bin/pnpm install ...`
- `OBS-004` — 沙箱复现（/tmp/archtest，2026-08-23，pnpm 11.7.0 offline store）：
  1. arm64-PATH 默认安装 → `.pnpm` 仅出现 `node-addon-require-builtin-darwin-arm64`
     （darwin-x64 被静默过滤）；
  2. `/usr/local/bin/node /usr/local/bin/pnpm install`（x64 node 显式执行）→ 仅
     `darwin-x64` 在位；
  3. arm64 pnpm + `pnpm-workspace.yaml` 注入 `supportedArchitectures
     {os:[darwin], cpu:[x64,arm64]}` → 两平台包都在；
  4. arm64 pnpm + CLI flag `--config.supported-architectures.cpu=x64` → 仅
     darwin-arm64（flag 形式无效）。
  - Provenance：调查 §1.3
- `OBS-005` — 失效 seam：`vendor/loader/src/internal.ts:108-118` 无
  `--expose-internals` 时唯一依赖 `require('node-addon-require-builtin')
  .requireBuiltin(id)` 取 Node internal ESM loader；addon 缺失 → `catch {}` 吞错 →
  `ModuleLoader.fromInternal()`（internal.ts:120）undefined → 插件全灭 → child 在
  `initialize` RPC 前退出。`initialize` + `registeredProviders` seam 现位于
  `packages/agent-router/src/process/agent-process.js:179-186`（@ main 0a6e060 复核）。
  launchd `KeepAlive=true` + `ThrottleInterval=10` → 坏闭包下 CP 每 10s 崩溃重启。
  - Provenance：调查 §1.4
- `OBS-006` — 现有流程无任何门拦截该故障类：install 成功 = tar/pnpm/chown/审计全过，
  无一步在 x64 node 下 load 过任何 native binding 或启动过任何 child；验收
  （`trusted-cp-hardening-v1-verify.mjs` 等）为 install 之后的独立手工步骤；CP ready
  与 ingress `/health`（`packages/production-runtime/src/entry.js`，@ main 0a6e060 :64/:71）
  只证明 CP 组合完成，child 惰性 spawn。
  - Provenance：调查 §1.5
- `OBS-007` — 部署考古（只读 backup 核查）：`bak-20260822-203550` 的 `.pnpm` 无任何
  `node-addon-require-builtin-*` 平台目录（故障窗口实证）；多个 backup 的
  node-runtime 为 none（被 reuse `mv` 掏空，@ main 0a6e060
  `trusted-cp-deploy-install.sh:125-129` 复核仍在）；当前 live 树 GOOD 但
  `harness/.source-stamp` 缺失。
  - Provenance：调查 §2
- `OBS-008` — 受影响面：live closure 内 `.node` 文件 20 个，跨平台过滤敏感包含
  `node-addon-require-builtin-darwin-x64`、`lightningcss-darwin-x64`、
  `@rollup/rollup-darwin-x64`、`@rolldown/binding-darwin-x64`（两版本）、
  `@oxlint/binding-darwin-x64`、`@oxc-resolver/binding-darwin-x64`、
  `@oxc-parser/binding-darwin-x64`、`@koromix/koffi-darwin-x64`、
  `@img/sharp-darwin-x64`；免疫：`fsevents`（fat universal 单文件）、`node-pty`
  （prebuilds 全平台随包自带）。
  - Provenance：调查 §3
- `OBS-009` — 无 deploy lock：全脚本无 lock/flock 语义；两个并发 install 会交错
  mv/BAK/reuse。
  - Provenance：调查 §5-G8；@ main 0a6e060 grep 复核（无 deploy.lock / flock）
- `OBS-010` — backup `source_commit` 恒 unknown（`scripts/agent-core-backup-ops.sh`，
  @ main 0a6e060 :211 `printf '%s' 'unknown'` 语义仍在）：前任闭包不记录 app commit。
  - Provenance：调查 §1.5、§5-G9
- `OBS-011` — install 实际安装 devDependencies 全集（/tmp 安装日志 2026-08-23 09:15
  显示 vitest/knip/oxlint 等在列；`Done in 59s using pnpm v11.7.0`），闭包安装面远大于
  运行面 → manifest（G2）既是漂移暴露面也是审计面。
  - Provenance：调查 §2

## 6. Claims and assumptions

- `CLM-001` — **SUPPORTED**（`EVD-001`）：deploy 期 pnpm 进程 arch 与 production Node
  arch 无任何耦合或校验，同一脚本不同 operator 会话可产出不同架构闭包；2026-08-22
  故障窗口是该确定性机制的实现，不是随机故障。
- `CLM-002` — **SUPPORTED**（`EVD-002`）：一次非 x64 闭包部署会击穿全部 Agent child
  的 initialize（并连带 sharp / lightningcss 等运行时链路），且 launchd 使 CP 进入
  10s 崩溃循环直至人工回滚。
- `CLM-003` — **SUPPORTED**（`EVD-003`）：install 成功与 CP 组合 health 均不构成
  child availability 证据；该故障类对现有全部检查不可见。
- `CLM-004` — **SUPPORTED**（`EVD-004`）：当前 live 树 GOOD 但 stamp 缺失，下次部署
  必然全量重装，故障窗口随每次部署重新武装。
- `CLM-005` — **SUPPORTED**（`EVD-005`）：现行 backup/reuse 机制不能保证完整回滚件
  （reuse `mv` 掏空 backup；`source_commit` 恒 unknown；无 deploy lock）。
- `CLM-006` — **SUPPORTED**（`EVD-006`）：production 目标架构在可见视野内为
  darwin-x64（live 树 + 17 个历史 backup 一致），`TARGET_ARCH` 冻结为 x64 是对既成
  production 事实的断言而非新架构决策。
- `CLM-007` — **INFERRED**（`EVD-007`）：以 staging 树物化的 trusted x64 node 显式
  执行 pnpm，install arch ≡ runtime arch 按构造成立（执行安装的解释器与换树后运行
  闭包的解释器为同一二进制）。限制：单次沙箱实证（pnpm 11.7.0、offline store），
  但构造性论证不依赖实验次数。

## 7. Evidence relations

- `EVD-001` — `OBS-001`、`OBS-002`、`OBS-003`、`OBS-004` → `CLM-001`
  - Relation：SUPPORTS
  - Bound：production host + /tmp 沙箱，2026-08-23，pnpm 11.7.0
  - Strength：机制在失效侧与通过侧均已实证（调查 §1.4 live 正向验证）
  - Limitations：未穷举全部 20 个 addon 的逐平台过滤行为（G3 全量校验即为此设防）
- `EVD-002` — `OBS-005`、`OBS-008` → `CLM-002`
  - Relation：SUPPORTS
  - Bound：vendor/loader @ 调查基线；launchd 语义 @ `scripts/production-runtime-launchd.mjs`
  - Strength：seam 级源码证明 + 受影响面包查
  - Limitations：child 崩溃的精确退出码未逐版本记录（对裁决无影响）
- `EVD-003` — `OBS-006` → `CLM-003` — SUPPORTS（install/验收/health 三面均无 child
  证据；坐标 @ main 0a6e060 复核）
- `EVD-004` — `OBS-007` → `CLM-004` — SUPPORTS（live 树 GOOD + stamp 缺失同时实证）
- `EVD-005` — `OBS-007`、`OBS-009`、`OBS-010` → `CLM-005` — SUPPORTS
- `EVD-006` — `OBS-001`、`OBS-007` → `CLM-006` — SUPPORTS（live + 17 backup 一致；
  若未来 production 迁 arm64，须以新 Spec 重开 TARGET_ARCH——见 ACC-DEP-001 的
  fail-loud 设计）
- `EVD-007` — `OBS-004`（实验 2） → `CLM-007` — SUPPORTS（with limitations as stated）

## 8. Decisions

- `DEC-001` — **SELECTED_ARCHITECTURE_STRATEGY = trusted x64 Node 显式执行 pnpm。**
  - Decision owner：repository owner（任务冻结）
  - Decision：pnpm 一律以物化的 trusted runtime 显式解释执行：
    `"$TRUSTED_NODE" /usr/local/bin/pnpm install ...`；且 node-runtime 物化提前到
    harness install 之前（二者本无依赖，staging root 内先行物化）。
  - Rejected alternatives：`ALT-001`（supportedArchitectures）、`ALT-002`（universal
    closure）、`ALT-003`（外部构建机）。
  - Reason：架构按构造正确（同一二进制 install 与 runtime）；不改 vendor 源；与
    hardening V1 TRUSTED_NODE 信任模型同向；同时钉住解释器身份与 corepack 版本。
- `DEC-002` — **install 目标改为 staging root，全门后原子换树。**
  - Decision owner：repository owner（任务冻结：不在 live tree 执行 pnpm）
  - Decision：install/门全部在 staging root（如 `/usr/local/libexec/agent-core.next`）
    进行，G1–G7 全绿后一次 `mv` 原子换入 live 路径（旧树整体成为 backup）；消除
    现状「先 mv 走 live 树、安装期间 launchd 10s 崩溃循环」窗口。
  - Rejected alternative：`ALT-004`（原位 install + 仅加门）。
- `DEC-003` — **十二门 G1–G12 冻结为部署门集合；health 不替代 child availability。**
  - Decision owner：repository owner（任务冻结）
  - Decision：见 §9 CTR-DEP-001..013；ALL_GATES_PASS_BEFORE_PRODUCTION_SWAP、
    install success ≠ deployment success、HEALTH_IS_NOT_CHILD_AVAILABILITY 为
    invariant；G7 为 **no-tool** turn（门自身零工具副作用）；deploy lock 为
    **全部署期独占**（install 至终态）；解释器身份链（node+corepack+pnpm）路径与
    版本一并钉住。
- `DEC-004` — **SUPERSEDES = NONE / PARTIAL_SUPERSESSION = NONE。**
  - Decision owner：repository owner（任务冻结：不得 partial supersede）
  - Decision：对 hardening V1 report 为 supplement（§3.2，差异穷举于 Contracts）；
    对 AGENT_CORE_BACKUP_RETENTION_V1 为 additive extension（§3.3，含 G8 的
    NEW_EVIDENCE 记录）。本 Spec `supersedes = []`，不写任何既有 authority 的
    superseded backlink。
- `DEC-005` — **backup 完整性与失败语义。**
  - Decision owner：repository owner（任务冻结）
  - Decision：backup 不得被 reuse move 掏空（reuse 一律 copy）；verified LKG 不得被
    prune；门失败**或 swap/launchd/live 复验失败**均自动回滚 + 回滚后复验 G6/G7；
    失败绝不 prune、绝不宣告成功；backup `source_commit` 自 V2 起不再 unknown
    （从前任闭包自身 stamp/manifest 归属；遗留无 stamp 前任一次性显式落档
    `source_commit_absent_legacy`）。
- `DEC-006` — **本轮无实现许可。** status = proposed、
  implementation_authority = none、production_apply_authority = none；接受（独立
  review + acceptance binding）之前不得改任何脚本、不得触 production。

## 9. Contracts

> 门 ↔ Contract ↔ 调查出处映射：

| Gate（冻结名） | Contract | 调查 §5 |
|---|---|---|
| G1 TARGET_PLATFORM/TARGET_ARCH fail-loud | CTR-DEP-001 | G1 |
| G2 closure-manifest.json | CTR-DEP-002 | G2 |
| G3 全部 native addon Mach-O arch 验证 | CTR-DEP-003 | G2（断言）+ G3（加载） |
| G4 plugin entry load | CTR-DEP-004 | G4 |
| G5 staging child boot | CTR-DEP-005 | G5 |
| G6 RPC initialize | CTR-DEP-006 | G6 |
| G7 one low-risk **no-tool** turn | CTR-DEP-007 | G7 |
| G8 deploy lock | CTR-DEP-008 | G8 |
| G9 clean-source / dirty ack | CTR-DEP-009 | G9 |
| G10 immutable rollback artifact | CTR-DEP-010 | G10 |
| G11 source stamp / closure stamp | CTR-DEP-011 | G9（stamp 部分） |
| G12 install success ≠ deployment success | CTR-DEP-012 | G11 |
| （invariant）health ≠ child availability | CTR-DEP-013 | G12 |
| （invariant）node-runtime 先于 install 物化 | CTR-DEP-014 | §4-A |
| （invariant）pnpm 身份钉住并验证 | CTR-DEP-015 | §4-A 残留风险 2 / G1 |
| （invariant）live 树不跑 pnpm | CTR-DEP-016 | §5 总结构性变更 |
| （preservation）hardening V1 安全语义保持 | CTR-DEP-017 | — |
| （preservation）backup retention V1 语义保持 | CTR-DEP-018 | §5-G10 |

### CTR-DEP-001 — G1：TARGET_PLATFORM / TARGET_ARCH fail-loud

部署脚本 MUST 在头部冻结 `TARGET_PLATFORM = darwin`、`TARGET_ARCH = x64`，并在
install 开始即用 staging root 已物化的 node 断言
`process.platform + " " + process.arch` 与冻结值相等；不相等 MUST 以非零码退出并
打印两侧实际值。pnpm MUST 仅以 `"$TRUSTED_NODE" /usr/local/bin/pnpm …` 形式显式
解释执行；裸 `pnpm` / 依赖 shim shebang `env node` 解析 MUST NOT 出现在部署路径。
install 日志 MUST 记录 `INSTALL_NODE_ARCH=`、`PNPM_VERSION=`（与 pin 11.7.0 断言
相等）与 corepack cache 命中断言。

### CTR-DEP-002 — G2：closure-manifest.json

pnpm 完成后，安装器 MUST 扫描 `harness/node_modules/.pnpm` 生成
`harness/.closure-manifest.json`，至少包含 `{appCommit, harnessCommit(+dirty),
nodeVersion, nodeArch, pnpmVersion, platformPackages[name,version,archDir],
nativeFiles[pkg,path,machoArch]}`；manifest MUST 随闭包留存（closure stamp），并供
G10 写入 backup。

### CTR-DEP-003 — G3：全部 native addon Mach-O arch 验证

staging 闭包内**每一个** native addon（`.node` 文件，全量，非抽样）MUST 经
`file`/`lipo -archs` 判定架构：运行时平台包 MUST 为 darwin-x64 或 fat universal；
出现任何 arm64-only 运行时绑定 MUST 以非零码退出。运行时加载补证（静态 arch 验证
的 runtime 对偶）：在 `$TRUSTED_NODE` 下对运行时关键原生件逐个 `require()`——MUST
包含 `node-addon-require-builtin` 且断言
`requireBuiltin('internal/modules/esm/loader')` 返回对象（本故障的精确 seam），另含
`fsevents`、`node-pty`、`@img/sharp`、`lightningcss`；任一失败 MUST 以非零码退出。

### CTR-DEP-004 — G4：plugin entry load

在 `DSH_HOME = <scratch>` 下以 `$TRUSTED_NODE` headless 启动 staging 闭包的
harness CLI（demo-home.mjs `cliBin()` 同 seam），断言组合声明的**全部**插件 entry
装载成功、无任何 plugin-load-failed 输出（即 `ModuleLoader.fromInternal()` 非
undefined 的端到端证明）。任何插件装载失败 MUST 以非零码退出。

### CTR-DEP-005 — G5：staging child boot

在 staging 树上经真实 spawn seam（`/usr/local/libexec/dsh-agent-spawn-helper` +
uid 502、scratch workspace/home，复用 hardening-v1-verify Phase 2/3 的 .demo
runtime 模式）以 `ensureRunning(agent)` 拉起真实 child；MUST 断言进程存活、stdio
打开（同时覆盖 cwd/权限类回归，不止 arch）。失败 MUST 以非零码退出。

### CTR-DEP-006 — G6：RPC initialize

对 staging child 走完整 `AgentProcess.ready()`（`initialize` RPC +
`registeredProviders` 含配置 provider；受 `initializeTimeoutMs` 约束；
seam @ `packages/agent-router/src/process/agent-process.js`）。**这是生产实际失败的
那一环**，MUST 在换入 live 之前为绿；失败 MUST 以非零码退出。

### CTR-DEP-007 — G7：one low-risk no-tool turn

对 staging child 发起单个固定短 prompt 的 `session/prompt`，MUST 断言完整 ok-status
回合（child → model → reply），且该回合 MUST NOT 调用任何 tool（zero tool
invocations 断言——门本身即最低风险，不产生任何工具副作用）。MUST 使用既有
acceptance-only model override seam（`trusted-cp-hardening-v1-verify.mjs` 的验收模型
切换）；MUST NOT 触碰生产 binding / Feishu 投递。

### CTR-DEP-008 — G8：deploy lock（production 部署独占）

production 部署 MUST 独占持有 `/usr/local/libexec/.agent-core-deploy.lock`（root
属主；mkdir 原子语义或 flock），记录 pid/时间。**独占范围 = 整个部署期**：lock 在
任何 install 步骤前获取，覆盖 gates、原子换树、launchd 切换、live 复验，直到部署
终态（deploy-status 落档或回滚完成）才释放；持有期间任何并发部署 MUST 以非零码
退出。MUST 提供 stale 判定与显式 override flag（使用时 MUST 落档）。
（Authority：§3.3 NEW_EVIDENCE 激活 AGENT_CORE_BACKUP_RETENTION_V1 冻结的
deferred concurrent-deploy guard。）

### CTR-DEP-009 — G9：clean-source / dirty ack

install 开始前 `REPO_SRC` 与 `HARNESS_SRC` MUST 各自 `git status --porcelain` 为空，
或携带显式落档的 DIRTY ack；否则 MUST 以非零码退出。

### CTR-DEP-010 — G10：immutable rollback artifact

predeploy backup MUST 为一等完整回滚件：既有 meta + 前任闭包的 closure manifest
（由其安装时的 G2 留档，随 backup 保留；第一代 V2 部署的前任无 manifest 时 MUST
显式落档 manifest_absent）+ manifest sha256 边车；`.backup-meta`/manifest MUST 以
root-only 0444（或 `chflags uchg`）防后续部署改写。reuse MUST 采用 **copy 而非
mv**（或 mv 后在 backup 内留等效完整 copy 门面）——backup MUST 在任何 reuse 之后
保持完整可回滚。verified-LKG pin 沿用
`AGENT_CORE_VERIFIED_PREDECESSOR_LKG = YES` seam，prune MUST NOT 删除已验证 LKG。

### CTR-DEP-011 — G11：source stamp / closure stamp（source_commit 不再 unknown）

安装器 MUST 把 `REPO_APP_COMMIT` 写入 `app/.source-stamp`（新增）与 backup 元数据。
backup 元数据的 `source_commit` 自本 Spec 实现起 **MUST NOT 再为 unknown**：MUST 从
**前任闭包自身**的 `app/.source-stamp` / closure manifest 读取归属（保持
backup-retention V1 禁止把新部署 HEAD 归属为旧 backup commit 的语义）。唯一允许的
非 commit 值：首次 V2 部署面对无 stamp 遗留前任时的一次性显式落档标记
`source_commit_absent_legacy`（loud、可审计、MUST NOT 在任何后续部署复现——G11
保证此后每个闭包都带 stamp）。安装完成时 MUST 断言
`harness/.source-stamp` 已写——stamp 缺失导致的静默 reuse 失效（当前 live 树状态）
MUST 转为 loud failure，MUST NOT 静默全量重装。

### CTR-DEP-012 — G12：install success ≠ deployment success

install 退出码 0 仅代表「闭包建成 + 静态审计过」，MUST NOT 被当作部署成功。
`DEPLOY_SUCCESS` 定义为：G1–G7 全绿 → 原子换树 → launchd 切换 → 对 **live** 树复跑
G6/G7 绿 → 状态落档（TRUSTED_ROOT/config 下 deploy-status JSON：各门状态/时间/
commit）。**自动回滚触发面**（任一即触发，MUST NOT prune、MUST NOT 宣告成功、MUST
执行 G10 回滚路径——`--mark-rollback-used` + 恢复 + 回滚后复验 G6/G7）：
1. 任何 child 级门失败（G4–G7）；
2. **原子换树（swap）失败**；
3. launchd 切换失败；
4. 对 live 树复跑的 G6/G7 失败。
脚本尾部「Next: verify」提示 MUST 升级为机器门；跳过 MUST 经显式 `--no-verify`
落档。

### CTR-DEP-013 — health 不替代 child availability

CP 组合就绪证据（`production runtime ready` 与 ingress `/health`）MUST NOT 替代
child availability 证据。部署成功判据 MUST 包含至少一个真实 agent 的 child
initialize 完成证据（runtime-evidence.jsonl 的 child-ready 事件 / registry snapshot
显示已初始化 child）+ 一次 G7 turn。`HEALTH_IS_NOT_DEPLOY_SUCCESS = YES`。

### CTR-DEP-014 — node-runtime 先于 install 物化

node-runtime MUST 在 harness pnpm install 步骤**之前**物化进 staging root（顺序
重排；二者本无依赖），且 pnpm 的解释器 MUST 就是该物化 runtime（与 CTR-DEP-001
共同构成 install arch ≡ runtime arch 的构造性保证）。

### CTR-DEP-015 — 解释器身份链钉住并验证（node + corepack + pnpm）

部署 MUST 固定并验证整条解释器身份链的**路径与版本**：

- **node**：源路径钉住为 `/usr/local/bin/node`（readlink → Cellar 真实目录，按
  hardening V1 语义 `cp -RL` 物化，非 symlink、非 hardlink）；物化后 MUST 记录
  `NODE_VERSION`（install 日志 + closure manifest），且 G1 arch 断言、pnpm 解释执行、
  G3 加载断言所用的 MUST 是**同一**物化二进制；版本读取失败或与源 runtime 不一致
  MUST fail-loud；
- **corepack/pnpm**：断言 `/usr/local/bin/pnpm` shim 解析路径符合预期（corepack
  shim，非独立二进制）；断言 `pnpm --version` 输出 == harness `packageManager` pin
  （11.7.0）；部署前 `corepack prepare` 预热 + 断言 corepack cache 在位（未命中
  MUST fail-loud，不静默走网络）。

已知残留风险（记录、本轮不授权修复）：corepack+pnpm 发行件位于 uid-502 可写路径
（见 OQ-1）。

### CTR-DEP-016 — live 树不执行 pnpm

pnpm MUST 仅对 staging root 执行；live trusted root MUST NEVER 成为 pnpm install
的目标；production swap MUST 为原子 `mv`（换树语义，非原地变更）。

### CTR-DEP-017 — hardening V1 安全语义保持（preservation contract）

本 Spec 的实现 MUST 保持 TRUSTED_CONTROL_PLANE_DEPLOYMENT_HARDENING_V1 的全部安全
语义：TRUSTED_NODE 真实拷贝物化与校验（非 symlink、非 Cellar hardlink、零
symlink）、505 parent / 502 child 降权模型、spawn helper root:wheel 4755、trusted
树 symlink 逃逸审计、uid-502 写/替换/重定向攻击矩阵全 DENIED、
`--offline --frozen-lockfile --ignore-scripts --config.package-import-method=copy`
安装标志、代码内无 dev-repo 路径引用审计。除 §3.2 穷举的流程 delta 外的一切
install 语义 MUST 沿用该 report。实现后该 report 的验收字段 MUST 仍可复跑为 PASS。

### CTR-DEP-018 — backup retention V1 语义保持（preservation contract）

AGENT_CORE_BACKUP_RETENTION_V1 的全部冻结语义 MUST 原样继续有效：
`NORMAL_RETENTION = 3`、`PINNED_MINIMUM = 1`、pinned 不计数且永不自动 prune、pin 仅
metadata/marker（禁止复制 data）、prune 仅发生在 verification success → deployment
success declared 之后、deploy-fail / health-fail / rollback-used 的 PRUNE = NO /
KEEP 语义、`agent-core.bak-YYYYMMDD-HHMMSS` naming / rollback compatibility、legacy
backups 首个 reliable pin 建立前不自动 prune。其 AC-1..AC-11 在 V2 实现后 MUST 仍
通过。

## 10. Acceptance

> 实现环境两级：非 root 单测（fixture 模式，仿
> `test-agent-core-backup-retention-v1.sh`：假平台目录 + stub `.node`）；root 验收
> runbook（production-integration 风格，对 **scratch TRUSTED_ROOT fixture** 跑全门
> 链）。本 Spec accepted 前 MUST NOT 对 live 树执行任何门。

- `ACC-DEP-001` — G1 arch fail-loud
  - Contracts：CTR-DEP-001 · Method：注入 arch 不符的（stub）node / 伪造
    `process.arch` 输出的 fixture · Env：单测 + scratch root 验收
  - Expected：非零退出、输出含两侧实际值；未发生任何 staging→live 换树
  - Failure condition：arch 不符时仍继续安装或退出码为 0
- `ACC-DEP-002` — manifest 生成与留存
  - Contracts：CTR-DEP-002 · Method：对安装产物校验 manifest 字段齐全且留在闭包内
  - Expected：字段齐全（含全部平台包与 nativeFiles）；Failure：缺字段 / 未留存
- `ACC-DEP-003` — 全量 Mach-O 验证 + seam 加载
  - Contracts：CTR-DEP-003 · Method：fixture 注入 arm64-only `.node`（单测）；
    scratch root 上真实 x64 闭包过静态 + 加载断言（含
    `requireBuiltin('internal/modules/esm/loader')` 返回对象）
  - Expected：arm64-only 运行时绑定被拒（非零）；x64 闭包全绿
  - Failure：任何 arm64-only 运行时绑定通过门，或 seam 加载失败被放行
- `ACC-DEP-004` — 插件全装载
  - Contracts：CTR-DEP-004 · Method：scratch DSH_HOME headless boot；故意移除一个
    平台包作负例
  - Expected：全部 entry 装载、零 plugin-load-failed；负例非零退出
- `ACC-DEP-005` — staging child boot
  - Contracts：CTR-DEP-005 · Method：真实 spawn seam（helper + uid 502 + scratch
    home）
  - Expected：child 存活、stdio 打开；Failure：child 未起或 stdio 关闭仍过门
- `ACC-DEP-006` — RPC initialize
  - Contracts：CTR-DEP-006 · Method：对 staging child 完整 ready()；
    `initializeTimeoutMs` 内断言 registeredProviders 含配置 provider
  - Expected：绿；Failure：超时 / provider 缺失仍过门
- `ACC-DEP-007` — one low-risk no-tool turn
  - Contracts：CTR-DEP-007 · Method：固定短 prompt 经 acceptance-only model
    override seam；回合事件流断言 zero tool invocations
  - Expected：完整 ok-status 回合 + 零 tool 调用；零生产 binding / Feishu 触碰
    （审计为空）
- `ACC-DEP-008` — deploy lock（独占）
  - Contracts：CTR-DEP-008 · Method：模拟锁被持（第二实例并发）；核对 lock 覆盖
    install→gates→swap→live 复验全程、终态后才释放
  - Expected：第二实例非零退出；独占范围与释放时机正确；stale 路径可判定；
    override 使用留痕
- `ACC-DEP-009` — clean-source / dirty ack
  - Contracts：CTR-DEP-009 · Method：dirty fixture 无 ack → 拒；带 ack → 过且落档
- `ACC-DEP-010` — backup 不可变 + reuse 不掏空 + LKG 不被 prune
  - Contracts：CTR-DEP-010 · Method：fixture 上执行 reuse 后核对 backup 内容完整；
    核对 manifest 边车 + 0444/uchg；prune 模拟下 verified-LKG 存活
  - Expected：reuse 后 backup 完整；不可变标记在位；LKG 存活
  - Failure：reuse 后 backup 缺件 / LKG 被 prune / meta 可被后续部署改写
- `ACC-DEP-011` — stamps loud + source_commit 非 unknown
  - Contracts：CTR-DEP-011 · Method：正常安装后核对 `app/.source-stamp` 与
    `harness/.source-stamp`；构造 stamp 缺失负例；核对 backup 元数据
    `source_commit` 取自前任自身 stamp/manifest
  - Expected：stamp 在位且归属正确（前任 commit，非新 HEAD）；缺失负例 loud 失败；
    routine `source_commit = unknown` 被拒绝；唯一合法非 commit 值为一次性
    `source_commit_absent_legacy`（且不复现）
- `ACC-DEP-012` — install ≠ deploy + 自动回滚（含 swap 失败）
  - Contracts：CTR-DEP-012 · Method：scratch root 分别注入 child 级门失败（如 G6
    失败）与 swap 阶段失败（mv/launchd/live 复验负例）
  - Expected：任一触发面均无成功宣告、无 prune、回滚执行、回滚后 G6/G7 复验绿、
    deploy-status JSON 记录逐门结果；「Next: verify」跳过必须 `--no-verify` 留痕
- `ACC-DEP-013` — health ≠ child availability（负例）
  - Contracts：CTR-DEP-013 · Method：health 端点 up 而 child 未初始化的 fixture
  - Expected：部署 MUST NOT 可宣告成功；成功判据必须索要 child-ready 证据 + turn
- `ACC-DEP-014` — node-runtime 先行物化
  - Contracts：CTR-DEP-014 · Method：检查安装步骤顺序与 pnpm 解释器路径
  - Expected：node-runtime 在 pnpm 步骤前存在于 staging root；pnpm 由该 node 执行
- `ACC-DEP-015` — 解释器身份链断言
  - Contracts：CTR-DEP-015 · Method：node 版本/源路径不一致、pnpm 版本不匹配、
    corepack cache 缺失负例
  - Expected：均 fail-loud；正例记录 INSTALL_NODE_ARCH / NODE_VERSION /
    PNPM_VERSION，且 G1/G3/解释执行使用同一物化 node 二进制
- `ACC-DEP-016` — live 树零 pnpm
  - Contracts：CTR-DEP-016 · Method：审计部署脚本与日志——pnpm 目标路径仅 staging
  - Expected：无任何以 live root 为目标的 pnpm 调用；换树为原子 mv
- `ACC-DEP-017` — hardening V1 语义保持
  - Contracts：CTR-DEP-017 · Method：实现后复跑 hardening verify 驱动（root 验收）
  - Expected：V1 验收字段（TRUSTED_NODE 边界、505/502、攻击矩阵、restart、broker
    smoke）PASS
- `ACC-DEP-018` — backup retention V1 语义保持
  - Contracts：CTR-DEP-018 · Method：复跑 backup-retention V1 测试（AC-1..AC-11）
  - Expected：全绿；Failure：任何 V1 冻结语义回归

## 11. Alternatives and disposition

- `ALT-001` — **B：pnpm `supportedArchitectures`**（workspace 文件注入）。
  Rejected because：CLI flag 形式实测无效（OBS-004-4）；有效形式需改 harness
  vendor 源或对 tar 拷贝注入（闭包 ≠ 源、clean-source 门复杂化）；且不钉解释器
  身份 / corepack 版本，只解决 cpu 过滤一个面。What would reopen：harness 上游原生
  提供跨 arch 闭包钉扎且解释器身份问题已有独立解。
- `ALT-002` — **C：universal closure（全平台全 arch）**。Rejected because：闭包
  膨胀、仍需 ALT-001 的文件改动、掩盖而非消除漂移。
- `ALT-003` — **D：独立 x64 构建机 / 交叉构建**。Rejected because：新基建重于问题
  本身。
- `ALT-004` — **保持原位 install、仅加门**。Rejected because：门将跑在 live 树上，
  且不消除安装期间 launchd 对缺失路径的 10s 崩溃循环窗口。
- `ALT-005` — **维持事后手工验收（status quo「Next: verify」）**。Rejected
  because：与 install 无机器耦合；2026-08-22 故障窗口证明手工步骤不可靠地拦截该
  类故障。
- `ALT-006` — **本轮一并把 corepack+pnpm 物化进 trusted root**。Deferred（非否决）：
  缩小 uid-502 可写路径暴露面值得做，但超出本轮冻结范围；CTR-DEP-015 先以身份
  断言 + fail-loud 收敛，搬迁留给未来 amendment（OQ-1）。

## 12. Migration, compatibility, and rollback

- **首次 V2 部署**：当前 live 树 stamp 缺失（STATE-001）→ reuse 必然失败 → 全量
  重装属预期行为，但 MUST 由 CTR-DEP-011 转为 loud（记录 reuse_failed 而非静默）。
- **第一代 backup 的 manifest/stamp 缺席**：现任前任闭包安装时无 G2/G11；其 backup
  按 CTR-DEP-010 显式落档 manifest_absent，`source_commit` 按 CTR-DEP-011 一次性
  落档 `source_commit_absent_legacy`；manifest 边车与真实 stamp 自首个 V2 安装的
  闭包开始存在并随后续 backup 链积累。
- **兼容性**：backup 目录命名与 rollback 机制不变（backup-retention V1）；launchd
  模型不变（KeepAlive 语义不动，换树消除崩溃窗口而非改 launchd）；hardening V1
  验收驱动继续可用（ACC-DEP-017）。
- **回滚**：child 级门失败自动回滚（CTR-DEP-012）+ 人工回滚路径沿用既有 bak 目录；
  回滚后 MUST 复验 G6/G7；失败/回滚后 prune 禁忌不变（backup-retention V1）。
- **操作面迁移**：原「install 后手工 verify」步骤被机器门取代；跳过须显式
  `--no-verify` 落档。
- **Emergency**：生产事故的紧急 containment 仍按 SPEC_GOVERNANCE_V0 §14 走
  emergency 记录；durable 修复回本 Spec 流程。

## 13. Open questions

（均为 non-normative follow-up，不改变本 Spec 的 Decision / Contract 含义）

- `OQ-1` — corepack + pnpm 发行件迁入 trusted root（消除 uid-502 可写路径上的
  root 执行代码）：留待未来 amendment（ALT-006）。
- `OQ-2` — install 面收窄（当前实装 devDependencies 全集，OBS-011）：是否改用
  prod-only 安装属实现期优化议题，MUST NOT 以削弱任何门为代价；安装集合的任何
  改变须经实现 review（manifest 将如实暴露安装面）。
- `OQ-3` — staging root 的磁盘开销（部署期间额外一份全闭包，~1.5–1.7 GiB 量级）：
  运维注意项，不构成 Contract。

---

## Final Output

```text
TRUSTED_CP_DEPLOY_ARCH_CLOSURE_V2_SPEC_AUTHORING = PASS

BASE_MAIN = 0a6e060913e12693142fb0759f35f239b2ef429a (origin/main, 2026-08-23 fetch)
SPEC_HEAD = docs/trusted-cp-deploy-arch-closure-v2-spec @ <SPEC_COMMIT>
SPEC_STATUS = proposed
IMPLEMENTATION_AUTHORITY = none
PRODUCTION_APPLY_AUTHORITY = none

AUTHORITY_RELATION =
  TRUSTED_CONTROL_PLANE_DEPLOYMENT_HARDENING_V1 (docs/reports/...-v1.md):
    SUPPLEMENTED_NOT_SUPERSEDED — 全部安全语义保持（CTR-DEP-017），流程差异穷举于
    Contracts，未穷举处沿用 V1；supersedes = []。
  AGENT_CORE_BACKUP_RETENTION_V1 (accepted spec):
    ADDITIVELY_EXTENDED_NOT_SUPERSEDED — retention/pin/prune/failure 冻结语义原样
    有效（CTR-DEP-018）；G8 deploy lock 经该 Spec 自身 NEW_EVIDENCE 出口激活
    （NEW_EVIDENCE 已落档 §3.3）。
  docs/investigations/trusted-cp-cross-arch-dependency-closure-v1.md:
    evidence authority（不授予实现权限；本 Spec 为其 §6 EXPECTED_FILES 的 governing
    spec 交付）。
  PARTIAL_SUPERSESSION = NONE。

SELECTED_ARCHITECTURE_STRATEGY = TRUSTED_X64_NODE_EXPLICITLY_EXECUTES_PNPM
  ("$TRUSTED_NODE" /usr/local/bin/pnpm install ...; node-runtime 物化先于 install)
GATES_FROZEN = G1..G12 (CTR-DEP-001..012) + 6 invariant/preservation contracts
  (CTR-DEP-013..018)
SUPPLEMENTARY_RULINGS_FROZEN =
  HEALTH_IS_NOT_CHILD_AVAILABILITY / NODE_RUNTIME_BEFORE_INSTALL /
  INTERPRETER_IDENTITY_PINNED_NODE_COREPACK_PNPM (路径+版本) /
  BACKUP_NOT_HOLLOWED_BY_REUSE_MOVE / VERIFIED_LKG_NEVER_PRUNED /
  ALL_GATES_PASS_BEFORE_PRODUCTION_SWAP / EXCLUSIVE_DEPLOY_LOCK (全部署期) /
  AUTO_ROLLBACK_ON_GATE_OR_SWAP_FAILURE / SOURCE_COMMIT_NEVER_UNKNOWN /
  NO_PNPM_IN_LIVE_TREE / G7_NO_TOOL_TURN

EXPECTED_FUTURE_IMPLEMENTATION_FILES =
  scripts/trusted-cp-deploy-install.sh (modify) · scripts/trusted-cp-deploy-gates.mjs
  (new) · scripts/agent-core-backup-ops.sh (additive only)
EXPECTED_TESTS = 非 root 单测（fixture 模式）+ root scratch-TRUSTED_ROOT 验收 runbook
  （accepted 前不触 live 树）

NEXT_LIFECYCLE_STEP = independent REVIEW（SPEC_REVIEW = ACCEPT | REVISE）→ acceptance
  binding by mayf3 → 仅当 accepted 后，NEXT_TASK（发布 执行 的实现轮）方可开工。

本轮 authoring：
PRODUCT_CODE_CHANGE = NONE
SCRIPT_CHANGE = NONE
HARNESS_CHANGE = NONE
PRODUCTION_CHANGE = NONE
DEPLOY = NONE · RESTART = NONE · INSTALL = NONE · MERGE = NONE
新增文件 = docs/specs/TRUSTED_CP_DEPLOY_ARCH_CLOSURE_V2.md +
  docs/investigations/trusted-cp-cross-arch-dependency-closure-v1.md（evidence
  companion，逐字入库，sha256 64250bb08c70ba783d03f1362e62c2b03117412ea3c61d224a918fffed869cc0）
```
