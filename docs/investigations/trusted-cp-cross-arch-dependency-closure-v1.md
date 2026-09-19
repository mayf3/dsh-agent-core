# Trusted CP 跨架构依赖闭包故障 — 根因调查与部署门禁设计 V1

> 实证调查（investigation）· **只调查，不改 production**。本文件不授予实现权限。
> 日期：2026-08-23 · 分支：`docs/lark-ux-phase1-v2-spec`
> 对象：`scripts/trusted-cp-deploy-install.sh`（TRUSTED_CONTROL_PLANE_DEPLOYMENT_HARDENING_V1 家族）
> 与 `/usr/local/libexec/agent-core` trusted closure 的**只读**核查 + `/tmp` 沙箱复现实验。
> 目标：永久关闭「deploy 时 pnpm 进程架构 ≠ production Node 架构 → optional native
> binding 被过滤 → 全部 Agent child initialize 前退出」这一故障类。

## 0. 结论速览

| 项 | 结论 |
|---|---|
| 故障类 | deploy 期架构漂移：pnpm 安装闭包按 **pnpm 进程 arch** 解析 cpu/os 门控 optional deps，与 **production Node arch** 无任何耦合或校验 |
| ROOT CAUSE（机制，全部本机实证） | `/usr/local/bin/pnpm` 是 `#!/usr/bin/env node` 的 corepack shim → 解释器取自 operator shell 的 PATH（sudo 无 secure_path）；交互 zsh 下 PATH 首个 node 是 `/opt/homebrew/bin/node` = **arm64**；production trusted node = `/usr/local/bin/node` Cellar copy = **x64**（Rosetta）。arm64 pnpm 静默过滤 `node-addon-require-builtin-darwin-x64`（lockfile cpu:[x64] 门控） |
| 失效链 | x64 child 内 `vendor/loader/src/internal.ts:116` 唯一依赖该 addon 取 Node internal ESM loader → addon 缺失 → `fromInternal()` undefined → 插件全灭 → child 在 `initialize` RPC 前退出（`packages/agent-router/src/process.js:326` `ready()` 空转） |
| 当前 live 树状态 | **GOOD**（darwin-x64 binding 在位且在 trusted x64 node 下加载成功，internal loader 可取）；但 `harness/.source-stamp` **缺失** → 下次部署必然全量重装 → 故障窗口每次部署重新武装 |
| SELECTED_ARCHITECTURE_STRATEGY | **A：trusted x64 Node 显式执行 pnpm**（`"$TRUSTED_NODE" /usr/local/bin/pnpm install …`，node-runtime 物化提前到 harness 安装之前）+ 闭包 manifest 断言；`supportedArchitectures`（B）作备选被否（需改 vendor 源 / CLI flag 形式实测无效） |
| 门禁 | 12 项设计见 §5（TARGET_ARCH fail-loud / closure manifest / binding load / plugin-entry load / staging child boot / RPC initialize / one low-risk turn / deploy lock / clean-source / immutable rollback / install≠deploy / health≠child） |
| 本轮改动 | **NONE**（纯调查文档；无 packages/、无脚本改动、无 install、无 deploy、无 restart） |

## 1. 根因链（逐环实证）

### 1.1 production Node = x64

- `scripts/trusted-cp-deploy-install.sh:166-174`：node-runtime 从 `/usr/local/bin/node`
  （readlink → Cellar）`cp -RL` 物化进 trusted root。
- 本机实证：`file /usr/local/bin/node` = `Mach-O 64-bit executable x86_64`（Homebrew
  Intel 前缀 `/usr/local/Cellar/node/25.6.1_1`，在 Apple Silicon 上经 Rosetta 运行）。
- live 树实证：`/usr/local/libexec/agent-core/node-runtime/bin/node -p 'process.arch'`
  = **`x64`**（v25.6.1）。全部 17 个历史 backup 中带 node-runtime 者均为 x64。

### 1.2 deploy 期 pnpm 进程 arch 不确定（故障源）

- `trusted-cp-deploy-install.sh:145`：`/usr/local/bin/pnpm install --offline
  --frozen-lockfile --ignore-scripts --config.package-import-method=copy …`。
- 本机实证：`/usr/local/bin/pnpm` **不是独立二进制**，是 symlink →
  `/usr/local/lib/node_modules/corepack/dist/pnpm.js`（corepack shim，
  `#!/usr/bin/env node`，且 symlink owner = yanfenma:admin，uid 502 可写路径）。
- `which -a node` = `/opt/homebrew/bin/node`（**arm64**，`file` 实证）在前，
  `/usr/local/bin/node`（x64）在后。macOS sudo 无 `secure_path`（/etc/sudoers 无该
  Defaults），交互 shell 的 PATH 原样进入 root 会话 → `env node` 解析到 arm64。
- corepack 按 harness `package.json:7` 的 `"packageManager": "pnpm@11.7.0"` 运行
  （与 `/tmp/trusted-cp-pnpm-install.log` 尾行 `Done in 59s using pnpm v11.7.0`
  一致）——该 JS 全程跑在 **env 解析出的 node** 里，即 operator 从交互 zsh 触发时
  为 arm64。
- 结论：**pnpm 进程 arch = operator shell PATH 的函数**，同一脚本不同会话可产出
  不同闭包。历史 16 个含 harness 的 backup 均为 darwin-x64-only（说明多数部署
  当时 PATH 解析到 x64 node），Aug 22 晚间窗口出现非 x64 闭包（§2）——这是
  「偶发、依赖操作者环境」的确定性机制，不是随机硬件故障。

### 1.3 pnpm optional native binding 过滤（沙箱复现）

- `pnpm-lock.yaml`：`node-addon-require-builtin@0.1.4` 的 optionalDependencies 含
  7 个平台包，`node-addon-require-builtin-darwin-x64@0.1.4` 标注
  `cpu: [x64] / os: [darwin]`（pnpm-lock.yaml:13560）。pnpm 默认
  `supportedArchitectures` = 仅当前进程平台 → 非 matching 平台包**静默不装**
  （optional dep 解析失败不报错；`--offline` 下缺 tarball 同样静默跳过）。
- **沙箱实验（/tmp/archtest，2026-08-23）**：
  1. arm64-PATH 默认安装 → `.pnpm` 仅出现
     `node-addon-require-builtin-darwin-arm64@0.1.4`，**darwin-x64 被过滤** ✅复现；
  2. `/usr/local/bin/node /usr/local/bin/pnpm install`（x64 node 显式执行）→
     仅 `darwin-x64` ✅（策略 A 证明）；
  3. arm64 pnpm + `pnpm-workspace.yaml` 注入
     `supportedArchitectures: {os:[darwin], cpu:[x64,arm64]}` → **两个平台包都装** ✅
     （策略 B 证明）；
  4. arm64 pnpm + CLI flag `--config.supported-architectures.cpu=x64 …` →
     **仅 darwin-arm64**，flag 形式无效 ❌（B 只能走 workspace 文件改动）。

### 1.4 internal ESM loader 失效 → 插件全灭 → child 初始化前退出

- `vendor/loader/src/internal.ts:108-118`：无 `--expose-internals` 时，取 Node
  internal 模块的**唯一**途径是 `require('node-addon-require-builtin')
  .requireBuiltin(id)`；addon 加载失败被 `catch {}` 吞掉 →
  `ModuleLoader.fromInternal()`（internal.ts:120）返回 undefined → internal ESM
  loader 不可用 → cordis 插件装载机制失效 → **全部插件加载失败**。
- harness 的插件模型意味着 child（DSH CLI，uid 502，经
  `/usr/local/libexec/dsh-agent-spawn-helper` spawn）在插件装载阶段即崩/退，
  永远不会应答 `initialize` RPC（`packages/agent-router/src/process.js:326-347`
  `ready()`：spawn → `request('initialize')` 轮询 registeredProviders，90s 超时）。
- live 树正向验证（当前 GOOD 状态）：x64 trusted node 下
  `require('node-addon-require-builtin')` 加载成功且
  `requireBuiltin('internal/modules/esm/loader')` 返回对象——同一 seam 的
  通过/失败两侧均已实证。
- launchd 面：`scripts/production-runtime-launchd.mjs` `KeepAlive=true` +
  `ThrottleInterval=10` —— 坏闭包下 CP 每 10s 崩溃重启，直到人工回滚。

### 1.5 为什么当前没有任何门拦住它

- install 脚本成功 = 「tar/pnpm/chown/审计」全过，**没有任何一步在 x64 node 下
  load 过任何一个 native binding 或启动过任何一个 child**；
- 验收（`trusted-cp-hardening-v1-verify.mjs`、`production-integration-v1-root-verify.sh`）
  是 install 之后的**独立手工步骤**，与 install 无机器耦合（脚本尾行只是
  `Next: sudo node …`）；
- CP 的 `ready` 证据与 ingress `/health`
  （`packages/production-runtime/src/entry.js:59-67`）只证明 CP 组合完成，child
  是惰性 spawn 的——**health ≠ child availability**；
- 无 deploy lock、无 REPO_SRC clean 检查、backup 的 `source_commit` 恒为
  unknown（`scripts/agent-core-backup-ops.sh:226`，前任闭包不记录 app commit）。

## 2. 部署考古（只读 backup 核查，/usr/local/libexec/agent-core.bak-*）

| backup（=被换下的树） | node arch | darwin-x64 binding | harness/.source-stamp |
|---|---|---|---|
| 20260816 系列（10 个） | x64 | 在 | 无（stamp 机制引入前/修复前） |
| 20260821-231418 | none* | 在 | **有**（内容=e02d85b1…+dirty） |
| 20260822-095206 | none* | 在 | **有**（内容=f77b5a2f…+dirty） |
| 20260822-203550 | x64 | **缺**（.pnpm 无任何平台包目录） | 无（harness 已被 reuse-mv 走） |
| 20260822-204014 | none | 无法核查（harness 已被 reuse-mv 走） | 无 |
| 20260823-091408 | x64 | 在 | 无 |
| **当前 live（0823 14:16）** | **x64** | **在且可加载** | **缺失** |

\* node=none = 备份时 node-runtime 已被 reuse `mv` 回新树（脚本 1b 的 mv 语义会把
重用件从 backup 里移走，backup 因此不完整——这是 backup 作为「不可变回滚件」的
现存缺陷，见 §5-G10）。

- **故障窗口**：2026-08-22 ~20:35–20:40。`bak-20260822-203550`（live 至 20:35 的树）
  的 `.pnpm` 中不存在任何 `node-addon-require-builtin-*` 平台目录（与 §1.3 机制
  一致的非 x64 安装产物或被破坏的闭包），5 分钟后 20:40 的重装恢复。当前树为
  GOOD。**注意**：当前树 stamp 缺失 → 下次部署无法 reuse → 全量重装 →
  故障窗口随每次部署重新打开。
- pnpm 安装日志 `/tmp/trusted-cp-pnpm-install.log`（0823 09:15）显示安装的是
  devDependencies 全集（vitest/knip/oxlint…），闭包体积与安装面远大于运行面——
  manifest（§5-G2）因此更重要也更能暴露漂移。

## 3. 受影响面：不止一个 addon

live trusted closure 内 `.node` 文件共 **20** 个，跨平台过滤敏感包：
`node-addon-require-builtin-darwin-x64`（本故障）、`lightningcss-darwin-x64`、
`@rollup/rollup-darwin-x64`、`@rolldown/binding-darwin-x64`（两版本）、
`@oxlint/binding-darwin-x64`、`@oxc-resolver/binding-darwin-x64`、
`@oxc-parser/binding-darwin-x64`、`@koromix/koffi-darwin-x64`、
`@img/sharp-darwin-x64`（attachment/图片链路运行时依赖）。**免疫**项：
`fsevents`（fat universal 单文件）、`node-pty`（prebuilds 全平台随包自带，
不受 optional 过滤影响）。→ 任何一次 arm64-pnpm 部署会同时击穿 sharp /
lightningcss 等运行时链路，症状不止 initialize 失败一种。

## 4. 架构策略比较与选择

| 选项 | 机制 | 实证 | 裁决 |
|---|---|---|---|
| **A. trusted x64 Node 执行 pnpm（选定）** | node-runtime 物化**提前**到 harness 安装前（脚本 2b → 2 之前，二者本无依赖）；`"$TRUSTED_ROOT/node-runtime/bin/node" /usr/local/bin/pnpm install …` 显式解释器，绕开 shebang/PATH 不确定性 | 沙箱实验 2 ✅（产物恰为 darwin-x64） | ✅ 架构按构造正确（install arch ≡ runtime arch，同一二进制）；不改 vendor 源；与 TRUSTED_NODE_FIX（commit 33101b2）的信任模型同向 |
| B. pnpm supportedArchitectures | 需在 harness `pnpm-workspace.yaml` 增 `supportedArchitectures`（CLI flag 形式实测**无效**） | 沙箱实验 3/4 | ❌ 作主策略：要改 vendor 源或对 tar copy 注入（闭包≠源、clean-source 门复杂化）；且不钉解释器身份/corepack 版本，只解决 cpu 过滤一个面 |
| C. universal closure（全平台全 arch） | supportedArchitectures 全开 | 未测（无必要） | ❌ 闭包膨胀、仍需 B 的文件改动、掩盖而非消除漂移 |
| D. 独立 x64 构建机/交叉构建 | 异机构建产物搬运 | — | ❌ 新基建，重于问题本身 |

**A 的残留风险（如实记录，供 spec 阶段处置）**：
1. corepack shim 与 pnpm@11.7.0 发行件在 uid-502 可写的 `/usr/local/lib/node_modules`
   ——root 正在执行的代码落在 502 可写路径（现状即如此，非 A 引入；后续可将
   corepack+pnpm 物化进 trusted root 收敛）。
2. corepack 首次取 pnpm@11.7.0 需网络（root 的 corepack cache）。对策：部署前
   `corepack prepare` 预热 + 部署环境 COREPACK 网络关闭/断言 cache 在位，
   未命中即 fail-loud（G1 一并断言 `pnpm --version` 输出与 pin 一致）。
3. Rosetta 下 x64 node 性能损耗只发生在 install 期，可忽略。

## 5. 部署门禁设计（12 项；实现归 NEXT_TASK，须先立 accepted Spec）

> 总结构性变更（最小）：install 目标改为 **staging root**
> （如 `/usr/local/libexec/agent-core.next`），G1–G7 全部在 staging 上过门后，
> 一次 `mv` 原子换入 live 路径（旧树 mv 成 backup）。同时消除现状「先 mv 走
> live 树、安装期间 launchd 对着不存在的路径 10s 崩溃循环」的窗口。备份/保留
> 语义沿用 AGENT_CORE_BACKUP_RETENTION_V1（accepted），仅加法扩展。

- **G1 TARGET_PLATFORM / TARGET_ARCH fail-loud**：脚本头冻结
  `TARGET_PLATFORM=darwin` / `TARGET_ARCH=x64`；install 开始即用物化的
  `$TARGET_NODE -p 'process.platform+" "+process.arch'` 断言相等，不等即 exit 2
  并打印两侧值；pnpm 一律经 `$TARGET_NODE` 显式执行（§4-A）；install 日志记录
  `INSTALL_NODE_ARCH=`、`PNPM_VERSION=`（=11.7.0 断言）与 corepack cache 命中断言。
- **G2 dependency closure manifest**：pnpm 完成后扫描
  `harness/node_modules/.pnpm`，生成 `harness/.closure-manifest.json`
  {appCommit, harnessCommit(+dirty), nodeVersion, nodeArch, pnpmVersion,
  平台包清单[name,version,archDir], nativeFiles[pkg,path,machoArch]}；断言每个
  运行时平台包均为 darwin-x64（或 fat universal，`lipo -archs`/`file` 判定），
  出现 arm64-only 运行时绑定 → exit 2。manifest 随闭包留存，并供 G10 写入 backup。
- **G3 x64 native binding load test**：`$TARGET_NODE` 对 staging 闭包逐个
  `require()` 运行时关键原生件——**必须含
  `node-addon-require-builtin` 并断言 `requireBuiltin('internal/modules/esm/loader')`
  返回对象**（本故障的精确 seam），另含 fsevents / node-pty(darwin-x64 prebuilt) /
  @img/sharp / lightningcss。任一加载失败 → exit 2。
- **G4 all required plugin-entry load test**：`DSH_HOME=<scratch>` 下以
  `$TARGET_NODE` headless 启动 staging 闭包的 harness CLI（demo-home.mjs `cliBin()`
  同 seam），断言组合声明的全部插件 entry 装载成功、无任何 plugin-load-failed
  输出（即 `ModuleLoader.fromInternal()` 非 undefined 的端到端证明）。
- **G5 staging child boot**：在 staging 树上经真实 spawn seam（helper + uid 502、
  scratch workspace/home，复用 hardening-v1-verify Phase 2/3 的 .demo runtime 模式）
  `ensureRunning(agent)` 拉起真实 child，断言进程存活、stdio 打开（同时覆盖
  run-4 类 cwd/权限回归，不止 arch）。
- **G6 RPC initialize**：对该 staging child 走完整
  `AgentProcess.ready()`（`process.js:326` 的 initialize +
  registeredProviders 含配置 provider，受 initializeTimeoutMs 约束）——**生产实际
  失败的那一环**，必须在换入 live 前为绿。
- **G7 one low-risk turn**：单个固定短 prompt 的 `session/prompt`，断言完整
  ok-status 回合（child→model→reply）。用既有 acceptance-only model override seam
  （trusted-cp-hardening-v1-verify.mjs:94-106），不触生产 binding/Feishu 投递。
- **G8 deploy lock**：`/usr/local/libexec/.agent-core-deploy.lock`（root 属主，
  mkdir 原子语义或 flock）：记录 pid/时间，重复部署 exit 2；stale 判定 + 显式
  override flag。现状无任何锁，两个并发 install 会交错 mv/BAK/reuse。
- **G9 clean-source gate**：`REPO_SRC` 与 `HARNESS_SRC` 均要求
  `git status --porcelain` 为空（或显式 DIRTY ack 落档）；把
  `REPO_APP_COMMIT` 写入 `app/.source-stamp`（新增）与 backup 元数据（修复
  backup `source_commit` 恒 unknown 的缺口）；**断言 harness/.source-stamp 已写**
  ——当前 live 树 stamp 缺失说明 reuse 静默失效、每次全量重装，须转为 loud。
- **G10 immutable rollback artifact**：predeploy backup 升格为一等回滚件：
  meta（已有）+ 前任闭包的 closure manifest（由其安装时的 G2 留档，随 backup
  mv 保留）+ manifest sha256 边车；`.backup-meta`/manifest 以 root-only 0444
  （或 `chflags uchg`）防后续部署改写；verified-LKG pin 沿用
  `AGENT_CORE_VERIFIED_PREDECESSOR_LKG=YES` seam，保证 prune 永不删已验证 LKG。
  修复 reuse-mv 掏空 backup 的缺陷：reuse 采用 **copy 而非 mv**（或 mv 后在
  backup 内留 hardlink/copy 门面），backup 必须保持完整可回滚。
- **G11 install success ≠ deploy success**：install exit 0 仅代表「闭包建成 +
  静态审计过」。DEPLOY_SUCCESS 定义为 G1–G7 全绿 → 原子换树 → launchd 切换 →
  对 **live** 树复跑 G6/G7 → 状态落档（TRUSTED_ROOT/config 下 deploy-status
  JSON：各门状态/时间/commit）。任何 child 级门失败：不得 prune、不得宣告成功、
  触发 G10 回滚路径（`--mark-rollback-used` + 恢复 + 回滚后复验 G6/G7）。
  脚本尾部「Next: verify」提示升级为机器门（跳过须 `--no-verify` 显式落档）。
- **G12 health 不得替代 child availability**：`production runtime ready`
  （entry.js:59）与 ingress `/health`（entry.js:67）只证明 CP 组合，child 惰性
  spawn——部署成功的判据必须含至少一个真实 agent 的 **child initialize 完成证据**
  （runtime-evidence.jsonl 的 child-ready 事件 / registry snapshot 显示已初始化
  child）+ 一次 G7 turn。HEALTH_IS_NOT_DEPLOY_SUCCESS = YES 作为 invariant 写入 spec。

## 6. EXPECTED_FILES / EXPECTED_TESTS（供 NEXT_TASK = 发布 执行 立项）

- **EXPECTED_FILES**（届时按 accepted Spec 创建/修改，本轮未动）：
  - `docs/specs/TRUSTED_CP_DEPLOY_ARCH_CLOSURE_V2.md`（governing spec：§4 选型 +
    §5 十二门 + staging/原子换树 + G10/G11/G12 invariant；按
    AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1 走 proposed→accepted）
  - `scripts/trusted-cp-deploy-install.sh`（修改：lock、TARGET 断言、node-runtime
    提前、x64-pnpm 调用、manifest、stamp 断言、staging root + 原子换树、门挂接）
  - `scripts/trusted-cp-deploy-gates.mjs`（新增：G2–G7 门驱动，staging/live 两用）
  - `scripts/agent-core-backup-ops.sh`（加法扩展：manifest 边车 + 不可变标记 +
    rollback-verify 挂接；PIN/prune 冻结语义不变，超范围处走 amendment）
- **EXPECTED_TESTS**：非 root 单测（manifest 解析/arch 规则/lock/stamp 比较，
  仿 `test-agent-core-backup-retention-v1.sh` 的 fixture 模式，用假平台目录与
  stub .node）；root 验收扩展（production-integration 风格 runbook，对 scratch
  TRUSTED_ROOT fixture 跑全门链，不触 live 树直至 spec accepted）。

## 7. 边界声明（本轮）

- 只读核查 `/usr/local/libexec/**`、只读 harness/vendor 源、`/tmp` 沙箱实验
  （已清理 node_modules/配置）。
- 未修改 live Harness、未 restart production、未对 live tree 执行任何
  npm/pnpm install、未 deploy、未改 packages/scripts 任何文件。
- PRODUCT_CODE_CHANGE = NONE · FILE_CHANGE = NONE（除本调查文档）·
  PRODUCTION_CHANGE = NONE · DEPLOY = NONE · MERGE = NONE。
