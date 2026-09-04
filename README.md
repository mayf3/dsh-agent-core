# dsh-agent-core

Agent Core on DeepSeek Harness。独立新仓库，不修改、不删除旧
`agent-core`，不经过 OpenClaw / 旧 Agent Core Runtime / 旧 Kernel。

> V1 能力调查与组件基础已完成：整体定义、能力矩阵、组件地图、路线图与下一步
> milestone 见 [`docs/README.md`](docs/README.md)（收敛单一事实源：
> `docs/CAPABILITY_MATRIX.md`）。当前生产链路 = Feishu / Scheduler / Mobile Gate →
> **Router / Control Plane（agent-router）** → per-agent 真实 DSH 进程。

最初（2026-08 V0 版本）曾用 DSH 已有能力搭了一条最小 vertical slice，验收用例是
旧 Agent Core 的 `external.calculator`（multiply 6 × 7 = 42）。该 V0 切片（`@agent-core/router`
一次性驱动 + `bundle/` + `profile/` + 3 个脚本）**已废弃并移入**
[`examples/v0-vertical-slice/`](examples/v0-vertical-slice/README.md)，仅作历史示例保留：
其一次性投递插件不是生产 `agent-router`，生产路径不引用它。

## 历史 V0 链路（已废弃，见示例）

最初的 V0 最小链路（`dsh --profile agent-core` → `@agent-core/broker` +
`@agent-core/router` → `external.calculator 6×7=42`）与其实际输出、插件描述已随整个
V0 切片移入 [`examples/v0-vertical-slice/`](examples/v0-vertical-slice/README.md)，不再维护
在根目录。当前生产链路见 [`docs/README.md`](docs/README.md)。

## 结构（B）

```text
dsh-agent-core/
├── package.json               # 脚本入口（verify:product-integration / scheduler / delivery …）
├── packages/
│   ├── broker/                # @agent-core/broker — capability manifest → DSH tool（child relay / control-plane gateway 双模式）
│   ├── feishu-connector/      # @agent-core/feishu-connector — 纯 channel 层（WS/IngressEvent/ReplyTarget）
│   ├── workspace-bootstrap/   # @agent-core/workspace-bootstrap — agentId → workspace + DSH_HOME（幂等播种 AGENTS.md）
│   ├── agent-definition/     # @agent-core/agent-definition — Agent Definition config（声明式只读 Agent 存在性权威；无运行时写者）
│   ├── agent-memory/          # @agent-core/agent-memory — per-agent file-first 长期记忆（MEMORY.md + memory_* tools）
│   ├── agent-router/          # @agent-core/agent-router — Router / Control Plane（switchAgent 域操作 + Binding 持久化 + per-agent 进程注册表 + broker parent-RPC 分发）
│   ├── product-api/           # @agent-core/product-api — Gate 1 thin Mobile Product API（HTTP adapter，127.0.0.1，供 adb reverse）
│   ├── agent-switch/          # @agent-core/agent-switch — DSH 侧 agent_core_switch_agent adapter（parent-RPC 转发）
│   ├── demo-server/           # @agent-core/demo-server — per-agent JSON-RPC server（persistence resume + parent-RPC passthrough）
│   ├── owner-guard/           # @agent-core/owner-guard — 单 owner 锁（one live process per agent）
│   ├── scheduler/             # @agent-core/scheduler — Scheduler Replacement V1（cron/at/every 持久 job + 注入式 invocation/delivery seam）
│   └── scheduler-router/      # @agent-core/scheduler-router — Scheduler↔Router Final Integration 桥接（真实 invokeAgent + deliver 适配器，只调已有域操作）
├── examples/
│   └── v0-vertical-slice/     # 已废弃 V0 字节切片（@agent-core/router + bundle/ + profile/ + 3 个脚本），仅历史示例；见其 README
├── bundle-demo/               # @agent-core/bundle-demo — process-model demo patch 层
├── bundle-integration/        # @agent-core/bundle-integration — 控制面组合（agent-definition + workspace-bootstrap + feishu + agent-router + broker gateway）
├── bundle-memory/             # @agent-core/bundle-memory — per-agent memory patch 层
├── bundle-agent-switch/       # @agent-core/bundle-agent-switch — per-agent switch adapter patch 层
├── bundle-broker/             # @agent-core/bundle-broker — per-agent broker relay（child 无凭据，capability 工具经 parent-RPC 到控制面 gateway）
├── profile-demo/              # dsh-profile-agent-core-demo — process-model demo profile
├── profile-integration/       # dsh-profile-agent-core-integration — 控制面 profile
├── profile-integration-agent/ # dsh-profile-agent-core-integration-agent — per-agent 组合（demo-server + memory + switch + broker relay）
├── scripts/
│   ├── demo-home.mjs          # 共享 per-agent home 装配（provisionAgentHome + cliBin + profile 表）
│   ├── install-demo-home.mjs  # 安装 demo home（只增不改）
│   ├── install-integration.mjs        # 安装集成控制面 profile（只增不改）
│   ├── integration-v1-verify.mjs      # Integration V1 验收（真实飞书链路）
│   ├── product-integration-v1-verify.mjs # Product Integration V1 验收（A/B 双 Agent、switch、重启、crash resume）
│   ├── scheduler-v1-verify.mjs        # Scheduler V1 验收驱动（59 测试 + 兼容扫描 + 重启证据 + 审计回归）
│   ├── scheduler/                          # Scheduler subsystem verification drivers
│   ├── agentcore-cron.mjs             # openclaw cron add/list/runs 的 Agent Core 提交面（daemon 换用）
│   ├── openclaw-job-import.mjs        # 真实 OpenClaw jobs → V1 store 迁移工具（默认 dry-run + 锁内守卫）
│   ├── mobile-gate1-verify.mjs        # Mobile Gate 1 验收（Emulator → adb reverse → Product API → Router → real DSH）
│   └── trusted-credential-broker-v1-verify.mjs # Trusted Credential Broker 验收（real DSH → relay → 505 gateway → real auth → real downstream）
└── docs/
    ├── README.md              # 整体定义 + 文档导航
    ├── CAPABILITY_MATRIX.md   # 能力矩阵（收敛单一事实源）
    ├── investigations/        # 能力调查（五主题 + scheduler-replacement-audit 字段映射）
    ├── decisions/             # 决策记录（ADR 模板 + D-001…D-005）
    ├── reports/               # bootstrap-v0/…/memory-v1/product-integration-v1/scheduler-replacement-v1
    └── TRUST-BOUNDARY-REPORT.md  # 信任边界与身份伪造调查
```

## 运行

前置：`deepseek-harness` checkout（默认 `../../github/deepseek-harness`，可用
`DSH_HARNESS_ROOT` 覆盖）；模型凭据来自 `~/.dsh/.credentials.yaml` 的
`OPENCODE_GO_API_KEY`（或环境变量），模型路由复用 `~/.dsh/settings.yaml` 的
`llm-pi-ai` / `agent-default-model`（opencode-go）。

```sh
npm run verify:product-integration      # Product Integration V1 真实验收（A/B 双 Agent）
npm run verify:scheduler                # Scheduler V1 验收驱动
npm run verify:scheduler-router-final   # Scheduler↔Router Final Integration 验收
npm run verify:delivery                 # Agent Router Delivery V0 验收（real DSH）
npm test                                # 单元测试（packages/*/test）
```

> V0 vertical slice 的安装 / 运行 / 验收脚本已随示例移入
> [`examples/v0-vertical-slice/`](examples/v0-vertical-slice/README.md)（仅历史复现用，
> 不再挂在根 `package.json` 与 `scripts/`）。

## 现状与下一步

当前生产链路已是 **Integration V1+**：Feishu / Scheduler / Mobile Gate →
**Router / Control Plane（`packages/agent-router`）** → workspace-bootstrap → owner-guard →
per-agent 真实 DSH 进程 → 回复。详见 [`docs/reports/`](docs/reports/)、
[`docs/AGENT_CORE_ROADMAP_V1.md`](docs/AGENT_CORE_ROADMAP_V1.md) 与
[`docs/CAPABILITY_MATRIX.md`](docs/CAPABILITY_MATRIX.md)。旧 Kernel / Runtime 保持冻结，
不再作为迁移目标。
