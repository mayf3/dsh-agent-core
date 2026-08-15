# MOBILE_GATE1_LOCAL_RUNTIME_V1 — Android Emulator → Router → real Agent → DSH 本地启动收敛

> 状态：**WAIT_T1**（本地 runtime 全链路就绪；Product API 端口等待 T1 合入）
> 分支：`feat/mobile-gate1-local-runtime-v1` · 日期：2026-08-15
> 交付：`scripts/gate1.mjs`（一个脚本，六个子命令）
> 性质：local dev/runtime 辅助任务 — **PRODUCTION_LOGIC_CHANGED = NO**

---

## 0. 最终输出

```text
MOBILE_GATE1_LOCAL_RUNTIME_V1 = WAIT_T1

REQUIRED_PROCESSES =
  - 1 × 控制面 DSH 进程  dsh --profile agent-core-integration
      （组合内：workspace-bootstrap + agent-registry + feishu(disabled) +
        agent-router；Gate 1 用 FEISHU_ENABLED=0 走 mobile 纯入口）
  - N × per-agent DSH 进程（Router.ensureRunning 惰性 spawn，无需手工启动）
  - 0 × Product API 进程（T1 合入后：product-api 插件行随控制面一起 mount；
      若 T1 以独立进程交付，用 PRODUCT_API_START_COMMAND 启动）

REQUIRED_ENV =
  - DSH_HARNESS_ROOT   （默认 ../github/deepseek-harness；worktree 下自动从主 checkout 解析）
  - OPENCODE_GO_API_KEY（来自 ~/.dsh/.credentials.yaml，provision 时自动复制）
  - ~/.dsh/settings.yaml（模型路由 llm-pi-ai / opencode-go，自动复制）
  - PRODUCT_API_PORT   （默认 8787；T1 合入前是占位值）
  - PRODUCT_API_START_COMMAND（可选；T1 若以独立进程交付时使用）
  - GATE1_AGENT_NAME   （可选；默认 "Gate 1 Dev"，registry 为空时注册）

START_COMMAND =
  node scripts/gate1.mjs start

PREFLIGHT_COMMAND =
  node scripts/gate1.mjs preflight        # 全量（含真实控制面 boot + 真实 Agent spawn）
  GATE1_PREFLIGHT_FAST=1 node scripts/gate1.mjs preflight   # 静态检查

ADB_REVERSE_COMMAND =
  node scripts/gate1.mjs adb reverse      # = adb reverse tcp:$PRODUCT_API_PORT tcp:$PRODUCT_API_PORT
  node scripts/gate1.mjs adb list | remove

STOP_COMMAND =
  node scripts/gate1.mjs stop             # 杀控制面进程组 + 移除 adb reverse

T1_INTEGRATION_POINT =
  bundle-integration/cordis.patch.yml 的 product-api 插件行 +
  packages/product-api（另一 Agent 的 Gate 1 Backend Core，尚未合入 main）。
  合入后本脚本零改动：start 自动 mount，preflight/health/smoke 自动探测
  http://127.0.0.1:$PRODUCT_API_PORT/health。

PRODUCTION_LOGIC_CHANGED = NO
```

---

## 1. 本轮做了什么

Gate 1 最终链路：

```text
Android Emulator
  → adb reverse tcp:8787 tcp:8787
  → localhost Product API          （T1，尚未合入 → WAIT_T1）
  → Router / Control Plane          （真实 DSH 进程，profile agent-core-integration）
  → real Agent process              （真实 per-agent DSH 进程，惰性 spawn）
  → real DSH                        （真实模型 turn）
```

本轮交付**一个脚本** `scripts/gate1.mjs`（六个子命令），把「调查现状 → 需要启动什么」收敛成最小命令集：

| 子命令 | 作用 |
|---|---|
| `preflight` | 回答任务要求的全部 readiness 问题（见 §3） |
| `start` | provision 控制面 home + 注册默认 Agent（若 registry 空）+ 后台启动控制面进程（detached 进程组 + pid/log 文件） |
| `health` | 控制面存活 / Product API 端口 / adb reverse 状态 |
| `smoke` | 真实垂直切片：Router → 真实 per-agent DSH 进程 → 真实模型 turn（T1 合入后自动走 HTTP） |
| `stop` | 杀控制面进程组（含 per-agent 子进程）+ 清理 pid + `adb reverse --remove` |
| `adb` | `adb reverse tcp:$PORT tcp:$PORT` / list / remove |

设计原则（对应用户约束）：

- **只启动 Gate 1 真正需要的**：唯一常驻进程是控制面 DSH 进程；Agent 进程由
  Router 惰性 spawn（one Agent = one process 不变式不破）；feishu 用
  `FEISHU_ENABLED=0` 关掉（mobile 入口不需要）；broker / scheduler / memory
  控制面侧一律不启动（memory 在 per-agent 进程内）。
- **优先组合现有脚本**：复用 `scripts/demo-home.mjs`（`provisionAgentHome` /
  `cliBin` / `AGENT_PROFILE_DEFS`）与控制面 boot 模式（来自
  `product-integration-v1-verify.mjs` 的 provisionControlHome + phase 8 真实进程 boot）。
- **不建 supervisor/framework**：一个 pid 文件 + 进程组 kill，无守护/无轮询框架。
- **T1 未合入不发明契约**：只有 `PRODUCT_API_PORT` / `PRODUCT_API_START_COMMAND`
  两个薄环境变量占位，脚本探测 `t1Merged()`（bundle patch 是否含 product-api 行）
  动态决定「WAIT_T1 / 探测端口」。

## 2. 调查结论：Gate 1 真正需要启动什么

| 组件 | 形态 | 是否 Gate 1 需要 | 说明 |
|---|---|---|---|
| Agent Registry | 控制面组合内插件行（`@agent-core/agent-registry`） | ✅ 需要（不单独启动） | 随控制面进程 mount；store 由 `AGENT_REGISTRY_STORE` 指向 runtime |
| Router / Control Plane | 控制面 DSH 进程（`dsh --profile agent-core-integration`） | ✅ **唯一常驻进程** | workspace-bootstrap + registry + router 一个进程内组合 |
| DSH Agent process | per-agent DSH 进程（`dsh --profile agent-core-integration-agent`） | ✅ 需要（惰性） | Router.ensureRunning 首次消息时 spawn + provision，无需手工启动 |
| 模型配置 | `~/.dsh/settings.yaml` + `.credentials.yaml` | ✅ 需要 | provisionAgentHome 自动复制进控制面 home 与每个 agent home |
| Product API | T1（`packages/product-api` + bundle 插件行） | ⏳ WAIT_T1 | 合入后随控制面 mount；当前用占位端口等待 |
| Broker / scheduler / memory 控制面侧 | 其他组件 | ❌ 不启动 | 不在 Gate 1 链路上（memory 在 per-agent 进程内） |
| adb / emulator | 外部工具 | ✅ 辅助 | 只做 `adb reverse`，不做 Android UI |

## 3. preflight 回答清单（实跑结果）

`node scripts/gate1.mjs preflight`（2026-08-15 实跑，runtime 全新初始化）：

```text
PASS  NODE_RUNTIME_READY        — node 25.6.1
PASS  DSH_CLI_READY             — dsh CLI bin resolved（worktree 下自动从主 checkout 解析）
PASS  REGISTRY_STORE_READABLE   — 0 agent(s) at <runtime>/control/registry.json
PASS  ROUTER_RUNTIME_STARTABLE  — control plane mounted（真实 boot smoke，pid …）
PASS  DSH_PROFILE_READY         — control profile agent-core-integration + agent profile agent-core-integration-agent
PASS  AGENT_ENSURERUNNING       — agent agt_… spawned pid=… profile=agent-core-integration-agent（真实 DSH 进程）
WAIT_T1  PRODUCT_API_PORT       — T1 not merged; dev placeholder PRODUCT_API_PORT=8787
PASS  ADB_PRESENT               — Android Debug Bridge version 1.0.41
PASS  EMULATOR_VISIBLE          — emulator-5554
PASS  ADB_REVERSE               — adb reverse tcp:8787 tcp:8787 (mapped)
MOBILE_GATE1_LOCAL_RUNTIME_V1 = WAIT_T1
```

- `ROUTER_RUNTIME_STARTABLE` 是**真实控制面进程 boot smoke**（不是静态检查）：
  启动 `dsh --profile agent-core-integration`，等待 `binding store loaded` +
  `router idle`，并额外等待 1.5s 确认插件树没有在 router idle 之后才报错
  （feishu 依赖缺失这类迟到错误不会误报 PASS——实测发现并修复的坑，见 §5）。
- `AGENT_ENSURERUNNING` 也是**真实 spawn**：in-process Router（与
  product-integration-v1-verify 同款 fakeCtx 组装）对默认 Agent 执行
  `ensureRunning`，断言进程存活 + profile 落盘。
- 控制面已在运行时，preflight 直接引用运行中实例（不再二次 boot，避免 owner-guard 冲突）。

## 4. 最短复现命令（Gate 1）

```sh
# 0. 前置（一次性）：DSH checkout 存在（默认 ../github/deepseek-harness），
#    ~/.dsh/settings.yaml + ~/.dsh/.credentials.yaml 已有模型凭据；adb 已装；
#    模拟器已启动（adb devices 能看到 emulator-*）。

# 1. readiness（含真实控制面 boot 与真实 Agent spawn）
node scripts/gate1.mjs preflight

# 2. 启动整条链路（唯一常驻进程）
node scripts/gate1.mjs start

# 3. adb reverse（把模拟器 localhost 映射到 Mac localhost 的 Product API 端口）
node scripts/gate1.mjs adb reverse

# 4. 状态
node scripts/gate1.mjs health

# 5. 垂直切片冒烟（真实 Agent 进程 + 真实模型；需先 stop，让 smoke 独占 stores）
node scripts/gate1.mjs stop
node scripts/gate1.mjs smoke

# 6. 收尾
node scripts/gate1.mjs stop
```

T1 合入后，`start` 的控制面会自带 Product API HTTP 服务，`smoke` 自动切换为
`POST /v1/message` 的 HTTP 冒烟；命令不变。

## 5. 实测发现与修复（本轮脚本内）

1. **worktree 下的 DSH_HARNESS_ROOT 解析**：`demo-home.mjs` 的默认 sibling 路径
   在 worktree（`.worktree/<name>/`）下会指向错误位置；`gate1.mjs` 启动时若
   env 未设 `DSH_HARNESS_ROOT`，自动从主 checkout 解析并回填 env（主 checkout
   优先，env 覆盖始终优先）。
2. **控制面插件树迟到失败误报 PASS**：首次实测时控制面先打印
   `binding store loaded` + `router idle`，随后插件树才因
   `@larksuiteoapi/node-sdk` 缺失而整体失败——旧 boot smoke 在 router idle
   即判定 PASS，是假阳性。修复：PASS 判定前额外等待 1.5s 并检查进程存活 +
   `plugin tree failed to load` 关键字；`start` 同样处理。
3. **feishu-connector 依赖在干净 worktree 缺失**：控制面组合包含
   feishu-connector 行（即使 FEISHU_ENABLED=0 模块 import 仍发生），其
   `@larksuiteoapi/node-sdk` 依赖在 gitignored node_modules 里，全新 worktree
   没有。修复：`provisionControlHome` 先确保该依赖可解析——优先 symlink 主
   checkout 已安装的副本，否则 `npm install --no-save`（两者都不行才 fail）。
   这是本地开发辅助，不改任何生产实现。
4. **controlEnv 完整注入**：`DSH_WORKSPACE_DIR` / `DSH_AGENTS_HOME` /
   `DSH_MEMORY_WORKSPACE_ROOT` 指向 runtime 内目录，使 per-agent workspace /
   home / memory 全部落在自包含 runtime 下，不污染 `~/.dsh`。

## 6. 明确不做 / 未改动

- **未修改**：Product API 生产实现（另一 Agent 的 in-flight 工作，未合入）、
  Router / Binding 语义、bookmark 语义、Agent process 语义、DSH runtime、
  `bundle-integration/cordis.patch.yml`、任何 `packages/*` 源码。
- **未建立**：Docker 平台、systemd/launchd supervisor、LAN/TLS/auth/公网、
  Router redesign、配置系统、Android UI。
- Gate 1 最终链路中唯一未就绪项 = Product API 端口（T1），故最终判定
  **WAIT_T1**；其余全部 PASS，且都已用真实进程验证。
