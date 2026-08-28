# Agent Core 生产 ARM64 迁移 — 只读基线调查 + staging / 切换 / 回滚方案 V1

> 实证调查（investigation）· **只调查 + 方案设计，不改 production、不部署、不 restart**。
> 本文件不授予实现权限；实现需另立 accepted Spec。
> 日期：2026-08-28 · 分支：`docs/lark-ux-phase1-v2-spec` · TASK_NAME = 迁移 调查
> **修订 1（同日 · TASK_NAME = 迁移 执行）**：docs-only 原子修订，关闭「迁移 审计」B1–B4 ——
> B1 Mach-O 计数统一为唯一自洽口径（§0/§2.1）；B2 枚举补齐 + 三分类（§1.5/§2.1）；
> B3 broken harness 路径修正（§0 注/§1.4）；B4 G-Arch-3 升级为三码件全树 closed classification +
> Node tarball 结构冻结（§3.2/§3.4）。方案结构（staging / 原子切换 / 回滚 / S0–S10）零改动；
> production 零接触；全部数字为修订轮同条扫描命令实测复跑值。
> 对象：`/usr/local/libexec/agent-core` trusted closure（launchd `system/ai.agent-core.runtime`）
> 从 **x64 Node + Rosetta + x64 native addons** 迁移到 **arm64 Node + arm64 Harness + arm64 native addons**。

## 0. 结论速览（Final 字段）

| 字段 | 值 |
|---|---|
| CURRENT_NODE_ARCH | **x64**（`process.arch` 实证 = `x64`，`darwin x64 v25.6.1`；binary = Mach-O x86_64 non-fat，Homebrew Intel 前缀 bottle） |
| CURRENT_NATIVE_ADDON_ARCHES | 三码件（app+harness+node-runtime）全树 Mach-O 实测共 **31** 个（§2.1 唯一口径，B1）：**27 个 x86_64-only**（.pnpm 内 25 = 23 个平台包二进制 + node-pty darwin-x64 侧 pty.node+spawn-helper；node-runtime 内 2 = bin/node + lib/libnode.141.dylib）+ **2 个 arm64-only**（node-pty darwin-arm64 侧 pty.node+spawn-helper，在场但 x64 runtime 从不加载）+ **2 个 fat universal**（fsevents ×2）。app 闭包 **零** Mach-O（纯 JS）。原「共 25 个 / 22 个 x86_64」作废（漏计 spawn-helper ×2、darwin-arm64 侧 ×2、libnode.141.dylib） |
| ROSETTA_USED | **YES**（硬件 arm64 Apple M5 Pro；trusted node 二进制 x86_64 non-fat → 必经 Rosetta；`oahd` 在运行、`/Library/Apple/usr/share/rosetta/rosetta` 在位。CP 与全部 child 均为 x64 进程） |
| CURRENT_CLOSURE_DIGEST | `5748c1ab088a6ba39826bb99e04e2b9b7d4400b945cb45e0c28b7d4e364e0290`（= 对 app+harness+node-runtime **74470** 文件逐文件 sha256 排序清单再取 sha256；symlink 5693 个单独计数不参与哈希；快照期间树稳定：并发部署已结束、20s 复查 0 变动；**修订轮同配方复跑 = 逐字节同值**，74470/5693 不变） |
| HOLD_UNTIL_GLM_STRICT_STABLE | **YES**（迁移执行继续冻结于 GLM strict 稳定之后；本轮不处理 GLM） |
| PRODUCTION_CHANGE | **NONE**（本轮只读命令：ls/file/lipo/shasum/plutil/launchctl print/node --version/node -e require 探针；产物仅 /tmp 清单 + 本文档） |
| READY_FOR_REVIEW | YES |
| NEXT_TASK | 迁移 审计 |

**同日事故关联（重要）**：今天 2026-08-28 已发生一次**未经 staging 的 arm64 尝试并失败**（§1.4）。
现存 `/usr/local/libexec/agent-core/harness.arm64-broken-20260828-134711`（**位于 live agent-core 根内**，
非 `/usr/local/libexec/` 直属条目——B3 修正）= arm64 closure + dirty 源构建；当时 live node 仍是 x64 →
混合架构 → 正是 `trusted-cp-cross-arch-dependency-closure-v1.md`（2026-08-23，accepted 前置调查）
定性的故障类。**本方案是对该故障类的终结性设计：arm64 Node 与 arm64 closure 必须作为不可分的整体切换。**

## 1. 当前生产基线（独立确认，全部本机实证）

### 1.1 硬件 / 系统

- `uname -m` = `arm64`；CPU = `Apple M5 Pro`；macOS 26.5.2（25F84）。
- Rosetta 2 在位且活动：`pgrep oahd` 命中（pid 327）；`/Library/Apple/usr/share/rosetta/rosetta` 存在。

### 1.2 trusted Node binary / process.arch / 版本

- launchd（`/Library/LaunchDaemons/ai.agent-core.runtime.plist`，state = running）：
  `program = /usr/local/libexec/agent-core/node-runtime/bin/node`，
  args = `node app/scripts/production-runtime.mjs --root /Users/authsvc/.agent-core --catchup 0`，
  WorkingDirectory = `/usr/local/libexec/agent-core/app`，UserName = authsvc，KeepAlive=true，ThrottleInterval=10。
  PATH 首位 = `/usr/local/libexec/agent-core/node-runtime/bin`（launchd 面 arch 无关，切换不需要改 plist）。
- `file node-runtime/bin/node` = **Mach-O 64-bit executable x86_64**（non-fat；`lipo -info` 同）。
- 该 binary 下实跑：`process.platform + process.arch + process.version` = **`darwin x64 v25.6.1`**。
- 来源：Homebrew bottle（INSTALL_RECEIPT：`node@25`，built_as_bottle，Intel 前缀 `/usr/local/Cellar/node/25.6.1_1`），
  由 `scripts/trusted-cp-deploy-install.sh:159-175` `cp -RL` 物化（无 symlink，inode 独立）。
- **本机唯一的 arm64 Node 是 `/opt/homebrew/bin/node` = v26.7.0（版本不符，不可作为默认迁移源）**；
  arm64 v25.6.1 必须按 §3.2 从官方 dist 预置。

### 1.3 Harness commit / 版本

- live harness = `/usr/local/libexec/agent-core/harness`，非 git 树，`package.json` =
  `@deepseek-ai/dsh-root 0.1.0-rc.8`，`packageManager: pnpm@11.7.0`，pnpm-lock.yaml（700,679 B，2026-08-22）。
- **`harness/.source-stamp` 缺失**（reuse 判定失效缺口，前置调查 G9 已记录，至今未修）。
- HARNESS_SRC 仓库 `/Users/yanfenma/workspace/github/deepseek-harness` 当前 HEAD =
  `ce98f683972755a8733fa3c8c1a5582d0d441bbe`，**dirty = 116 个文件**——与今天失败的 arm64 harness
  stamp（`ce98f68…bbe` + `116`，43 字节，格式 = commit+dirtyCount，`trusted-cp-deploy-install.sh:156`）
  完全一致：**今天那次 arm64 closure 是用 dirty 源构建的**。
- app 侧 `app/.source-stamp` 同样缺失（app 来源 commit 本轮无法从树内证明；见 §7 缺口）。

### 1.4 2026-08-28 当日事故考古（文件系统证据重建；生产日志不可读，见 §7）

| 目录（相对 `/usr/local/libexec/`） | 内容 | 平台包 | 关键 stamp | 结论 |
|---|---|---|---|---|
| `agent-core.failed-20260828-071933` | 全树（07:19） | **darwin-arm64 全套**（含 arm64 closure） | harness stamp = `ce98f68…bbe116` | 07:19 一次部署产物被判 FAILED 整树存档 |
| `agent-core.bak-20260828-072422` | 全树（07:24），内含嵌套 `app.bak-schedv2-20260827*` | **darwin-x64 全套** | 无 stamp | 07:24 前的 live x64 closure；71488 文件，与现 live 抽样哈希一致（pnpm-lock/package.json/.pnpm/lock.yaml 三处 sha256 相同、文件数相同） |
| `agent-core.bak-20260828-073447` | 全树**缺 harness**（07:34） | — | — | 07:34 部署的 REUSE 路径把它的 harness `mv` 走（= stamp 匹配的 arm64 那套）→ live 得到 arm64 harness + 新 x64 node-runtime（07:34 mtime；REUSE_NODE 不可能：操作者 PATH node=26.7.0 ≠ 25.6.1） |
| `agent-core/harness.arm64-broken-20260828-134711`（**在 live agent-core 根内**，非 `/usr/local/libexec/` 直属——B3 修正；三码件扫描口径 `find app harness node-runtime` 不含它） | 仅 harness（内容 mtime 07:25） | **darwin-arm64 全套** | stamp = `ce98f68…bbe116` | 13:47:11 把 live 的 arm64 harness 改名存档，并从 bak-072422 **复制**回 x64 harness（live 顶层目录 mtime 13:47、文件 mtime 保留旧值） |
| 现 live（调查时点） | 服务 running（PID 88683，今日 21:09:58 起） | **darwin-x64 全套** | 无 stamp | x64 node + x64 closure，4 个关键 addon 实加载全过（§2.2）——**当前健康** |

重建（标注为重建，非直证）：07:34–13:47 期间 live 处于 **x64 node + arm64 closure 混合架构** 状态；
按前置调查 §1.4 的机制（x64 进程 require 不到 darwin-arm64 的 `node-addon-require-builtin` →
`fromInternal()` undefined → 插件全灭 → child 在 `initialize` RPC 前退出），必然复现"child 永不 ready"。
13:47 的人工回滚恢复了 x64 一致性。**该事故构成本方案的反面教材：禁止再次出现只切一半的状态。**

### 1.5 closure 安装架构（pnpm 面）

- harness closure 由 pnpm 11.7.0 安装（`.pnpm` farm + `--config.package-import-method=copy`，实文件非硬链）。
- `.pnpm` 内**全部 20 个平台包均为 darwin-x64**（§2.1 清单）——安装时 pnpm 进程为 x64（与前置调查
  §1.2 一致：操作者 PATH/构建上下文决定；今天 07:2x 的 arm64 闭包则是 arm64 pnpm 上下文的产物）。
- app/node_modules（52 顶层项，纯 JS：`@larksuiteoapi/node-sdk`、`croner`、axios、ws、protobufjs…）
  **零平台包、零 Mach-O**；`@deepseek-ai` 为指向 harness farm 的 in-trusted-root 符号桥。
- 其余 Mach-O：`node-runtime` 内 **2 个**——`bin/node` 与 `lib/libnode.141.dylib`（均 x86_64；
  Homebrew bottle 共享 libnode 结构——B2 补录，原调查漏计后者），以及三码件之外的 setuid helper
  `/usr/local/libexec/dsh-agent-spawn-helper`（**已是 arm64**，root:wheel 4755——迁移免疫项）。
- `harness/native/landlock-run`（源码 + prebuilds.json）与 `harness/python`、`vendor`、`apps`、`home`：
  **零 Mach-O、零 ELF**（全量 file 扫描）——Linux-only 沙箱工具源码，不在 darwin 运行时加载。
- 体积：app 43M · harness 1.5G · node-runtime 80M ·（broken arm64 参考 1.5G）。

### 1.6 launchd / 运行进程

- 服务 `system/ai.agent-core.runtime` running；生产 runtime PID 88683（今日 21:09:58 起，晚于 13:47 回滚）。
- **共享消费者警示**：调度 V2 side rig（PID 71743，yanfenma）使用**同一** trusted
  `node-runtime/bin/node`，其 child（PID 76876）使用**同一** live `harness/apps/cli/lib/bin.js`。
  mobile canary（PID 57064/57788）用 `/usr/local/bin/node` + 独立 harness worktree，与 trusted root 无关。
  → 切换窗口必须协调 side rig（§5.6）；回滚同理。
- child spawn seam：`app/packages/agent-router/src/process/spawn.js`（经
  `DSH_AGENT_SPAWN_HELPER` + uid/gid 502/20 drop）；child exit 的 `{code, signal}` 由
  `process/shutdown.js:53` 记录并落 `<root>/control/runtime-evidence.jsonl`
  （`production-runtime/src/paths.js:94`）；stderr 落 launchd `StandardErrorPath`。

## 2. NATIVE_ADDON_INVENTORY（全量 Mach-O 枚举，不止 node-addon-require-builtin）

### 2.1 live harness `node_modules/.pnpm` 平台包 × Mach-O（23 平台包二进制 x86_64 + 2 fsevents universal + node-pty darwin ×4；.pnpm 共 29）

| 包@版本 | Mach-O 文件 | 实测 arch | 运行时角色 |
|---|---|---|---|
| node-addon-require-builtin-darwin-x64@0.1.4 | prebuilt/darwin-x64-napi-v9.node | x86_64 | **loader 命脉**：internal ESM loader 唯一取径 |
| @img/sharp-darwin-x64@0.35.3 | sharp-darwin-x64-0.35.3.node | x86_64 | attachment/图片链路 |
| @img/sharp-libvips-darwin-x64@1.3.2 | libvips-cpp.8.18.3.dylib | x86_64 | sharp 的 libvips |
| lightningcss-darwin-x64@1.32.0 | lightningcss.darwin-x64.node | x86_64 | css 链路 |
| @koromix/koffi-darwin-x64@3.1.1 | koffi.node | x86_64 | FFI |
| @oxc-parser/binding-darwin-x64@0.133.0 | parser.darwin-x64.node | x86_64 | 解析器 |
| @oxc-resolver/binding-darwin-x64@11.20.0 | resolver.darwin-x64.node | x86_64 | resolver |
| @oxlint/binding-darwin-x64@1.76.0 | oxlint.darwin-x64.node | x86_64 | lint |
| @rolldown/binding-darwin-x64@1.0.3 与 @1.1.1 | rolldown-binding…node ×2 | x86_64 | 构建 |
| @rollup/rollup-darwin-x64@4.62.2 | rollup.darwin-x64.node | x86_64 | 构建 |
| @esbuild/darwin-x64@0.21.5 / 0.25.12 / 0.28.1 | bin/esbuild ×3 | x86_64 | 构建（**二进制，无 .node 后缀**） |
| @openai/codex@0.147.0-darwin-x64 | vendor/x86_64-apple-darwin/bin/{codex, codex-code-mode-host, codex-path/rg, codex-resources/zsh/bin/zsh} ×4 | x86_64 | codex 工具面 |
| @vscode/ripgrep-darwin-x64@1.18.0 | bin/rg | x86_64 | 搜索 |
| @anthropic-ai/claude-agent-sdk-darwin-x64@0.3.220 | claude | x86_64 | SDK 二进制 |
| lefthook-darwin-x64@2.1.9 | bin/lefthook | x86_64 | git hooks |
| jscpd-darwin-x64@5.0.12 | bin/jscpd | x86_64 | 重复度 |
| @oxlint-tsgolint/darwin-x64@7.0.2001 | tsgolint | x86_64 | lint |
| fsevents@2.3.2 / @2.3.3 | fsevents.node ×2 | **fat: x86_64+arm64** | 文件监听（universal，合法） |
| node-pty@1.2.0-beta.15（patched） | prebuilds/darwin-x64/{pty.node, **spawn-helper**} + prebuilds/darwin-arm64/{pty.node, **spawn-helper**}（**Mach-O 共 4**——B2 补录 spawn-helper ×2）；另有 linux-{x64,arm64}/pty.node（ELF ×2）与 win32-{x64,arm64}/{conpty.node, conpty_console_list.node, conpty/conpty.dll, conpty/OpenConsole.exe}（PE ×8）+ pdb ×4（调试数据库，非二进制） | darwin-x64 侧 x86_64 / darwin-arm64 侧 arm64 / 其余 ELF·PE | PTY；包自带全平台 prebuilds，按 `${process.platform}-${process.arch}` 选目录；live x64 仅加载 darwin-x64 侧（darwin-arm64 侧在场但从不被 x64 runtime 加载） |

（`.pnpm` 平台包目录之外：harness 内零 Mach-O；app 闭包：零 Mach-O。node-runtime 另有 **2 个**
Mach-O——`bin/node` + `lib/libnode.141.dylib`，均 x86_64（B2 补录，原调查漏计 dylib）。）

#### 唯一冻结口径（B1；修订轮同条命令复跑实测，2026-08-28）

```bash
cd /usr/local/libexec/agent-core && \
  find app harness node-runtime -type f -print0 | xargs -0 file | grep 'Mach-O' \
  | sed 's/ (for architecture [^)]*)//' | cut -d: -f1 | sort -u    # 唯一文件清单（实测 = 31 行）
# 逐文件 arch：lipo -archs <file>（输出 ∈ {x86_64} / {arm64} / {x86_64 arm64}）
```

- **按位置合计**：.pnpm 内 **29** = 23 平台包二进制（x86_64-only：10 个 `.node` binding 文件
  【rolldown 双版本 ×2】+ esbuild×3 + codex 系×4 + rg + claude + lefthook + jscpd + tsgolint
  + libvips dylib）+ node-pty darwin ×4（darwin-x64 侧 2 个 x86_64 + darwin-arm64 侧 2 个 arm64）
  + fsevents ×2（universal）；node-runtime **2**（bin/node + libnode.141.dylib）；app **0**。
- **按 arch 分类合计**：x86_64-only **27** + arm64-only **2** + universal **2** = **31 = 位置合计 =
  分类合计**（`MACHO_CLASSIFICATION_SUM = MACHO_TOTAL = 31`）。
- **「总 Mach-O = 35」口径作废**：35 是 `file | grep Mach-O` 的**原始匹配行数**，非文件数——每个
  fat 二进制除主行外还输出 2 行 `(for architecture …)` 架构切片描述行（2 个 fsevents → 恰 +4 行），
  31 唯一文件 + 4 切片行 = 35。**不存在额外 4 个文件**；修订轮已实测复现
  （RAW_MATCHING_LINES = 35 / UNIQUE_MACHO_FILES = 31，切片行恰 4 行）。原「22 个 x86_64」为原表格
  自身枚举（23 项）的计数笔误，一并作废。

#### 三分类（B2 冻结；live 视角）

1. **当前 live x64 实际加载/执行的 x86_64-only 文件（27）**：.pnpm 23 平台包二进制 +
   node-pty darwin-x64 侧 {pty.node, spawn-helper}（`process.arch = x64` 目录选择）+
   node-runtime {bin/node, lib/libnode.141.dylib}。§2.2 已证 4 个关键件实载；其余为按需加载 /
   子进程执行的合法 x64 运行面（arm64 进程一律不可加载）。
2. **多平台 prebuild「允许在场、但不得被 x64 runtime 加载」**：node-pty darwin-arm64 侧
   {pty.node, spawn-helper}（arm64-only；live 在场、从不加载）+ linux/win32 成员（ELF/PE，非
   Mach-O，darwin 上不可加载的惰性载荷）。对称地：staging（arm64）中 node-pty darwin-x64 侧同样
   允许在场、但必须机械证明从不被 arm64 runtime 加载（§3.4 G-Arch-3 ③）。当日 arm64 产物实证：
   多平台 prebuild 载荷在 arm64 pnpm 安装中同样全套在场（含 darwin-x64 侧），且其 `.pnpm` 内
   darwin-x64 平台包目录数 = 0。
3. **universal 文件（2）**：fsevents ×2（fat x86_64+arm64），任一 arch runtime 均可合法加载，
   迁移前后皆合法。

### 2.2 live x64 closure 加载实证（trusted x64 node，直连 .pnpm 路径 require）

- `node-addon-require-builtin` → `requireBuiltin('internal/modules/esm/loader')` 返回 object：**OK**
- `sharp`（@0.35.3）：**OK**；`fsevents`（@2.3.3，fat）：**OK**；`node-pty`（patched，spawn 函数）：**OK**
- 结论：当前 live 树处于 GOOD 态（与 08-23 调查 §1.4 的正向验证一致，今日复验仍成立）。

### 2.3 arm64 对应面（实证参考源：`/usr/local/libexec/agent-core.failed-20260828-071933` 与 `/usr/local/libexec/agent-core/harness.arm64-broken-20260828-134711`）

上述平台包存在一一对应的 `*-darwin-arm64` 版本且已被 pnpm 成功解析安装（今日 arm64 closure 全套在位：
sharp/koffi/oxc×3/oxlint/rolldown×2/rollup/lightningcss/node-addon-require-builtin + esbuild×3 + codex×4 +
rg + claude + lefthook + jscpd + tsgolint + sharp-libvips dylib）。
**arm64 侧依赖可得性已被当日产物证明**——缺的不是包，是"arm64 Node 与 arm64 closure 同时到位 + 门禁"。

## 3. ARM_STAGING_PLAN（完全独立 staging root；本轮仅设计，不执行）

### 3.0 总原则

1. **一个 staging root，三不可**：不复用任何 x64 node_modules / 不在生产目录 install / 不让构建上下文
   的 arch 依赖操作者 shell PATH。
2. **arch 按构造正确**（继承前置调查选型 A）：pnpm 一律由 **staging arm64 Node 显式执行**
   （`$STAGING_NODE <pnpm-entry> install …`），install arch ≡ runtime arch。
3. staging 期间 production 全程不动（launchd 服务照常跑 x64；S10 门哈希证明零接触）。

### 3.1 staging root 布局（与 live 同卷，供 §5 原子切换）

```
/usr/local/libexec/agent-core.arm64-staging/     # 属主 authsvc:authsvc，0755/0644
  node-runtime/        # arm64 v25.6.1（§3.2），实文件、无 symlink（同 live 物化纪律）
  pnpm-dist/           # pnpm 11.7.0 发行件（sha256 pin；禁用 /usr/local/bin/pnpm shim）
  harness/             # 源 tar 拷贝（同 live 排除项）+ ARM64 pnpm install 产物 + .source-stamp
  app/                 # app closure 拷贝（纯 JS，arch 无关）+ @deepseek-ai 桥
  config/  home/       # 仅 staging 自用测试态（test agent/test creds/scratch root），绝不指向生产
  .cache/              # staging 自用 pnpm cache（预置 arm64 平台 tarball 或受控在线）
  .closure-manifest.json  .app-source-stamp     # 机械 provenance（修 G9 缺口）
```

- 生产态物理位置不动：生产 Store/Binding/Credential 在 `/Users/authsvc/.agent-core`（--root）与
  trusted `config/`（agents.json / agent-credentials.json），staging 一律不引用（§4 S10 守门）。

### 3.2 arm64 Node 精确版本（authority 冻结）

- **默认 = v25.6.1（与现 x64 完全同版本，变量只剩 arch）**：
  `https://nodejs.org/dist/v25.6.1/node-v25.6.1-darwin-arm64.tar.gz`
  sha256 = `a80cb252d170a4730f78f5950cf19a46106f156e5886e5c1cc8c5602aea60243`（本轮从官方 SHASUMS256.txt
  实取，2026-08-28；**修订轮对下载件复验 = 同值**）。
- **结构冻结（B4，修订轮对 pin tarball 实测，非猜测）**：全 tar 列表 **零 `.dylib` 条目** ⇒
  **`UNEXPECTED_LIBNODE_DYLIB = ABSENT`**；抽取实测 `bin/node` = Mach-O arm64（non-fat，
  `lipo -archs` = arm64）；`bin/npm` / `bin/npx` 为指向 `../lib/node_modules/npm/bin/*-cli.js` 的
  **symlink**（`cp -RL` 物化后即实文件，「断言无 symlink」纪律不变）。**与 live 的结构差异冻结**：
  官方 tarball 无共享 libnode（静态链接进 `bin/node`）——staging node-runtime 期望 Mach-O 集合 =
  **恰 {bin/node} 1 个**；live x64 node-runtime 是 Homebrew bottle 结构 = 2 个（bin/node +
  lib/libnode.141.dylib）。staging 物化后 node-runtime 内出现 bin/node 以外的任何 Mach-O（含任何
  dylib）→ 按未知类 STOP（§3.4 G-Arch-3 ⑤）。
- 备选（需 authority 显式批准并重 pin sha256，默认**禁止**）：本机 `/opt/homebrew` v26.7.0 arm64——
  版本跳变会把"纯 arch 迁移"混入"版本升级"两个变量，违反单变量原则。
- 物化纪律：tar 展开 → 仅取 `node-v25.6.1-darwin-arm64/` 树 `cp -RL` 进 `node-runtime/` → 断言
  无 symlink、`file bin/node` = arm64、`--version` = v25.6.1、`-p process.arch` = arm64
  （arm64 进程不可能运行于 Rosetta——Rosetta 仅翻译 x86_64，架构即原生证明）。

### 3.3 构建步骤（每步 fail-loud）

1. **前置断言（G-Arch-0）**：`$STAGING_NODE -p 'process.platform+" "+process.arch'` = `darwin arm64`，
   否则 exit 2 并打印两侧值；`PNPM_VERSION` 断言 = 11.7.0（staging pnpm-dist）。
2. **源冻结**：HARNESS_SRC 与 REPO_SRC 均 `git status --porcelain` 干净（或 DIRTY 显式落档 ack，
   但**默认拒绝 dirty**——当日事故的 arm64 closure 即 dirty=116 产物）；记录 harness commit 到
   `harness/.source-stamp`（commit+dirtyCount 单行格式）、app commit 到 `.app-source-stamp`。
3. **harness closure**：tar 拷源（排除 node_modules/.git/dist 等，同 live 脚本语义）→
   `cd staging/harness && $STAGING_NODE $STAGING_ROOT/pnpm-dist/pnpm.js install --frozen-lockfile
   --ignore-scripts --config.package-import-method=copy --cache-dir $STAGING_ROOT/.cache`
   （离线 cache 预置 arm64 平台 tarball 为默认；受控在线为显式备选并留安装日志）。
4. **app closure**：沿用现脚本 §3 语义拷贝（纯 JS）+ `@deepseek-ai` in-root 桥 + 第三方 deps 实拷。
5. **机械 arch 证明（G-Arch-1..3，§3.4）** 全过后才允许进入 §4 门禁。

### 3.4 机械证明（"必须机械证明"的落地）

- **G-Arch-1 process.arch**：staging node 实跑 `-p process.arch` = `arm64`（记录进 manifest）。
- **G-Arch-2 Node binary**：`lipo -info staging/node-runtime/bin/node` = arm64（非 fat 或含 arm64）。
- **G-Arch-3 三码件全树 closed classification（B4 升级；不再只扫 `.pnpm` 平台目录）**：对 staging
  `{node-runtime, harness, app}` 三码件**全树**用 §2.1 冻结的同条扫描命令枚举**每一个** Mach-O
  文件，逐文件 `lipo -archs` 后按**封闭五分类**裁决——每个文件必须落入且仅落入一类，未归类项
  不得通过：
  ① **arm64-only → 允许**；② **universal 且含 arm64 slice → 允许**（fsevents）；
  ③ **node-pty 多平台 prebuild 成员 → 允许在场**，但 runtime 选择路径必须**机械证明只加载 arm64
  版本**——`process.dlopen` 钩子先记录实载 `.node` 路径再 `require('node-pty')`，断言记录集合 ⊆
  `prebuilds/darwin-arm64/` 且全树零 `prebuilds/darwin-x64/` 路径加载（spawn-helper 由 node-pty
  从同一 `${process.platform}-${process.arch}` 目录解析，S3 真实 PTY spawn 为执行面复证）；
  ④ **x86_64-only（③ 的 node-pty 成员之外）→ 禁止**（exit 2 并全量列出违规路径）；
  ⑤ **unknown / 不可分类**（`lipo` 失败、arch 集不在上述任何一类）→ **禁止**。
  辅助 fail-loud 断言保留：staging `.pnpm` 内 darwin-x64-only 平台包目录数 = 0（出现即 exit 2
  并列出；当日 arm64 产物已实证 = 0）。node-runtime 期望 Mach-O 集合 = **恰 {bin/node}**（§3.2
  `UNEXPECTED_LIBNODE_DYLIB = ABSENT` 的树内投影；多出任何 Mach-O → ⑤ STOP）。
  **汇总裁决冻结四字段**（全绿才允许进入 §4 门禁，写入 closure-manifest）：
  `NODE_PROCESS_ARCH = arm64`（G-Arch-1）· `NODE_BINARY_ARCH = arm64`（G-Arch-2）·
  `LOADED_NATIVE_ADDON_ARCH = arm64`（③ 的 dlopen 记录 + G-Arch-4 实载）·
  `NODE_ARCH == ADDON_ARCH`（前三者一致方成立）。
- **G-Arch-4 加载证明**：staging node 直连 .pnpm 路径 require 四关键件
  （node-addon-require-builtin + requireBuiltin seam / sharp / fsevents / node-pty），任一失败 exit 2；
  其中 node-pty 的实载路径必须命中 darwin-arm64 侧（与 G-Arch-3 ③ 同一断言）。
- **产物**：`staging/.closure-manifest.json`（nodeVersion/nodeArch/pnpmVersion/harnessCommit/appCommit/
  平台包清单[name,version,archDir]/nativeFiles[path,machoArch]/生成时间），作为切换与回滚的输入。

## 4. REQUIRED_GATES（staging 验收十门 + 横切门）

| # | 门 | 通过判据（机械） | 失败动作 |
|---|---|---|---|
| S0 | 架构一致性（横切前置） | §3.4 G-Arch-1..4 全绿 + closure-manifest 落盘 | STOP（不得进入 S1） |
| S1 | Harness loader boot | staging node 起 harness CLI headless（`DSH_HOME=<scratch>`），internal ESM loader 可用（ModuleLoader.fromInternal 非 undefined 的端到端证据），无 plugin-load-failed | STOP |
| S2 | 全部 plugin load | profile `agent-core-production` 组合声明的全部插件 entry 装载成功、零失败输出 | STOP |
| S3 | Agent RPC initialize | 经真实 spawn seam（setuid helper + uid 502 + scratch workspace/home）拉起 child，`AgentProcess.ready()` 完整 initialize + registeredProviders 含配置 provider（受 initializeTimeoutMs 约束）；child stderr/exit(code,signal) 落 evidence | STOP |
| S4 | session create | staging root 上 fresh 非 main session 创建成功 | STOP |
| S5 | 普通飞书无工具回复 | staging runtime + **测试飞书应用凭据**（绝不指向生产 creds/binding）完成一次无工具 prompt → 测试会话收到回复 | STOP + OWNER_DECISION |
| S6 | scheduler 工具 list/create | staging scheduler store 上 list + create 成功（store 在 scratch root） | STOP |
| S7 | 一次短 scheduler canary | staging root 一个近时 occurrence 触发一次投递（测试目标），随后删除/停用该 job | STOP |
| S8 | GLM strict no-tool probe | acceptance-only model override seam（沿用 trusted-cp-hardening-v1-verify.mjs:94-106 模式），strict 无工具回合 ok-status | STOP |
| S9 | duplicate child = NO | 两次顺序 prompt 后同一 agent 恰一个 child PID（无第二个 child 进程） | STOP |
| S10 | production Store/Binding/Credential 零修改 | 全程前后对 `config/agents.json`、`config/agent-credentials.json`、`/Users/authsvc/.agent-core/{bindings,scheduler,control}` 做 sha256 + mtime 快照比对，零差异（需 root 读，执行轮落档） | STOP + 立即调查 |

- 门执行环境：手动进程 + env 覆盖（FEISHU_CREDS_PATH 等指向测试值），不经 launchd，不触生产 root。
- 每门落 evidence：命令、stdout/stderr、判定值、时间戳 → `docs/evidence/arm64-migration-staging-<date>/`。

## 5. ATOMIC_SWITCH_PLAN（同卷原子切换；仅设计）

### 5.0 前置（全部满足才允许切换）

- §4 S0–S10 全绿 + evidence 归档；closure-manifest（staging arm64 版）与 live x64 版都已在手；
  OWNER 显式 GO（切换是 production 变更，超出本调查轮）。

### 5.1 切换单元 = 三码件整体（Node + Harness + app closure）

- **切换粒度 = `{node-runtime, harness, app}` 三目录作为一个不可分单元**；`config/`、`home/`、`.cache/`
  与 `/Users/authsvc/.agent-core`（生产 root state）**原地不动**——码与态分离，回滚不碰状态。
- 脚本以 `set -e` 顺序执行三出三入共 6 个同卷 `rename`，中途任一步失败自动反向回滚已执行的 rename，
  **不提供任何"只切 node / 只切 harness / 只切 app"的入口或 flag**（结构性禁止）。

### 5.2 切换序列（维护窗口内）

```
1. launchctl bootout system/ai.agent-core.runtime        # 服务停（KeepAlive 不再拉起）
2. BAK=/usr/local/libexec/agent-core.bak-arm64-mig-<ts>; mkdir "$BAK"
3. mv agent-core/{app,harness,node-runtime} "$BAK"/      # x64 三码件整体让位（完整保留 = 回滚件）
4. mv agent-core.arm64-staging/{app,harness,node-runtime} agent-core/   # arm64 三码件整体入位
5. 立即架构断言：node lipo=arm64；抽样 addon=arm64；closure-manifest 在位（防混合态留存）
6. launchctl bootstrap + kickstart                        # arm64 服务起
7. 切换后 live 门（§5.3）
```

### 5.3 切换后 live 验收（live 树复跑）

- 服务 state=running、runtime 日志出现正常 boot 序列；
- 一个真实 agent 的 **child initialize 完成**（runtime-evidence.jsonl child-ready）；
- 一次真实低风险回合（生产飞书链路一次普通回复）+ duplicate child = NO；
- live 树复跑架构断言（node arm64 + closure arm64 全 Mach-O 抽样/全量）。
- 全部通过 → 部署状态 JSON 落档（各门状态/时间/commit/sha）；任一失败 → §6 回滚。

### 5.4 部署前后 closure manifest

- 切换前：live x64 树全量 manifest（本调查已产出方法与当前 digest，执行轮按同法再生成即时值）；
  切换后：arm64 live 树全量 manifest；两份 + 各自 sha256 存 `docs/evidence/arm64-migration-<date>/`。

### 5.5 child 证据受控落盘

- launchd `StandardOut/ErrorPath`（runtime.log / runtime.err.log）+ `<root>/control/runtime-evidence.jsonl`
  （child-ready / exit {code,signal}）+ 切换脚本自身 tee 全量 transcript → evidence 目录；
  回滚时同样采集（受控证据 = 三源齐备：CP 日志、evidence jsonl、切换 transcript）。

### 5.6 共享消费者协调（警示义务，不在本轮处理）

- 调度 V2 side rig（71743/76876 模式）指向同一 trusted node-runtime 与 harness 路径：切换窗口内其新
  spawn 会得到 arm64；若 side rig 尚需 x64，须由其 owner 在窗口前停用或改指独立路径。
  Luna / Route Chain / HR Dispatcher / Workflow 按任务边界不在本轮范围，仅此记录路径耦合事实。

## 6. ROLLBACK_PLAN（整体回滚 x64；仅设计）

- **触发**：§5.3 任一 live 门失败，或 OWNER 判定回滚；ARM 任一门失败 → 完整回滚，不存在部分回滚。
- **序列**（与 §5.2 严格对称）：
```
1. launchctl bootout
2. mv agent-core/{app,harness,node-runtime} → agent-core.arm64-failed-<ts>/   # 存档（evidence）
3. mv "$BAK"/{app,harness,node-runtime} → agent-core/                          # x64 三码件整体复位
4. 架构断言：node x64 + closure x64（抽样 lipo）——证明无混合架构残留
5. launchctl bootstrap；x64 live 门复跑（child initialize + 一次低风险回合 + duplicate child = NO）
6. 生产态未动核验：S10 同法快照比对（config/ 与 --root state 在两版间从未被移动）
```
- **x64 closure 完整保留**：`$BAK` 三码件是全量回滚件（不是被掏空的 reuse 源；吸取 G10 教训，
  任何 reuse 一律 copy 不 mv）；保留至 OWNER 显式释放，按 AGENT_CORE_BACKUP_RETENTION_V1（accepted）
  语义打 pin/meta，prune 永不触碰已验证 LKG。
- **不留混合架构**：双向都以后置架构断言收口（arm64 切换后 / x64 回滚后）；断言失败视同回滚失败，
  停机上报而非带病运行。
- 回滚全程 transcript + 三源 child 证据同样归档 evidence 目录。

## 7. 证据缺口与边界

1. **生产日志不可读**：`/Users/authsvc/.agent-core/logs/` 属主 authsvc，本轮无 sudo——
   当日事故（§1.4）的 runtime.err.log 直证缺失，时间线为文件系统重建（目录名/时间戳/stamp/架构抽样）。
   审计轮应以 root 读取日志补直证。
2. **live app 来源 commit 无法从树内证明**（app/.source-stamp 缺失，G9 缺口在 app 侧同样未修）。
3. **harness 源当前 dirty=116**：任何重建（含 arm64 staging 构建）必须先冻结干净源。
4. **前置调查的 EXPECTED_FILES 未落地**：`TRUSTED_CP_DEPLOY_ARCH_CLOSURE_V2` Spec 未创建——
   本方案的 S0–S10/切换/回滚设计可作该 Spec 的 arm64 迁移章节输入；实现轮必须先立 accepted Spec。
   修订轮（迁移 执行）按审计裁定**不创建、不实现**该 Spec，仅将其保留为未来执行轮的强制前置条件。
5. **本轮边界**：未部署、未 restart、未修改 production 任何文件、未在 live 树 install、未动
   Luna / Route Chain / HR Dispatcher / Workflow；写入仅本文档与 /tmp 清单（易失）。
   digest 复现方法：`cd /usr/local/libexec/agent-core && find app harness node-runtime -type f -print0 |
   xargs -0 shasum -a 256 | LC_ALL=C sort | shasum -a 256`（symlinks：`find … -type l | wc -l` = 5693）。
   **修订轮（迁移 执行）边界**：仅重跑只读命令（§2.1 全树 Mach-O 枚举 + lipo 分类 / 官方 tarball
   下载至 /tmp 校验 sha256 与结构 / closure digest 配方复跑——与冻结值逐字节一致）；除本文档外
   零写入（全部清单产物在 /tmp，易失）。

## 8. Final

TASK_NAME = 迁移 执行（修订 1：关闭「迁移 审计」B1–B4；原调查 TASK_NAME = 迁移 调查）

MACHO_TOTAL = 31（三码件全树唯一文件口径，§2.1：.pnpm 29 + node-runtime 2 + app 0）
MACHO_CLASSIFICATION_SUM = 31（x86_64-only 27 + arm64-only 2 + universal 2；与位置合计自洽。
旧口径全部作废：「25 / 22」为漏计，「35」为 fat 架构切片行数非文件数——不存在额外 4 个文件）
UNEXPECTED_LIBNODE_DYLIB = ABSENT（官方 node-v25.6.1-darwin-arm64.tar.gz 全列表零 .dylib，sha256
复验 = pin 值，bin/node 实测 arm64 non-fat；staging node-runtime 期望 Mach-O 集合 = 恰 {bin/node}）
NODE_PROCESS_ARCH = arm64（§3.4 门内冻结判据，G-Arch-1）
NODE_BINARY_ARCH = arm64（§3.4 门内冻结判据，G-Arch-2）
LOADED_NATIVE_ADDON_ARCH = arm64（§3.4 门内冻结判据，G-Arch-3 ③ dlopen 记录 + G-Arch-4 实载）
NODE_ARCH == ADDON_ARCH（§3.4 汇总裁决，上述三者一致方成立）

ARM_STAGING_PLAN = §3（独立 staging root /usr/local/libexec/agent-core.arm64-staging；arm64 Node v25.6.1
官方 tarball sha256 pin；pnpm 经 staging arm64 Node 显式执行；机械证明 G-Arch-1..4）
—— 修订 1 未改方案结构：ARM_STAGING_PLAN_CHANGED = NO（仅 §3.2 结构冻结与 §3.4 G-Arch-3/4 判据强化）
NATIVE_ADDON_INVENTORY = §2（31 Mach-O：.pnpm 29 = 23 平台包 x86_64-only + node-pty darwin ×4
（darwin-x64 侧 2 x86_64 + darwin-arm64 侧 2 arm64）+ fsevents 2 universal；node-runtime 2
（bin/node + libnode.141.dylib）；app 零 addon；spawn helper 已 arm64（三码件之外）；
harness .pnpm 之外零 Mach-O）
ATOMIC_SWITCH_PLAN = §5（三码件 {node-runtime, harness, app} 同卷 6-rename 不可分整体切换；config/state
原地不动；切换后 live 门 + 前后 closure manifest）—— 修订 1 未改：ATOMIC_SWITCH_CHANGED = NO
ROLLBACK_PLAN = §6（对称反向 6-rename；x64 closure 完整保留为回滚件；双向架构断言禁止混合态；
三源 child 证据归档）—— 修订 1 未改：ROLLBACK_CHANGED = NO
REQUIRED_GATES = §4 S0–S10（S0 架构一致性 / S1 loader boot / S2 全插件 / S3 RPC initialize / S4 session
create / S5 飞书无工具回复（测试应用）/ S6 scheduler list+create / S7 短 canary / S8 GLM strict no-tool /
S9 duplicate child = NO / S10 生产 Store/Binding/Credential 零修改）—— 修订 1 未改

HOLD_UNTIL_GLM_STRICT_STABLE = YES（继续冻结；本轮不处理 GLM）
PRODUCTION_CHANGE = NONE
READY_FOR_REVIEW = YES
NEXT_TASK = 迁移 审计
