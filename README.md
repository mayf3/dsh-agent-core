# dsh-agent-core

Agent Core on DeepSeek Harness — V0 bootstrap。独立新仓库，不修改、不删除旧
`agent-core`，不经过 OpenClaw / 旧 Agent Core Runtime / 旧 Kernel。

> V1 能力调查与组件基础已完成（release checkpoint，PR #1）：整体定义、能力矩阵
> 与下一步 milestone 见 [`docs/README.md`](docs/README.md)（收敛单一事实源：
> `docs/CAPABILITY_MATRIX.md`）。V0 验收链路（`node scripts/verify.mjs`）保持通过。

V0 只做一件事：用 DSH 已有能力搭一条最小可跑链路，vertical slice 是旧 Agent Core
已验收的 `external.calculator` 能力（multiply 6 × 7 = 42）。

## 链路（A）

```text
dsh CLI --profile agent-core
  └─ dsh-base bundle（DSH 共享核心：session / agent-loop / tools / llm / …）
  └─ @agent-core/bundle（本仓库 patch 层）
       ├─ @agent-core/broker  注册模型可见 tool external_calculator（= external.calculator 能力）
       └─ @agent-core/router  创建 Agent → followup(固定输入) → whenIdle() → 输出结果与证据
```

实际输出：

```text
[router] input: Use the external_calculator tool to multiply 6 and 7 ...
[router] agent reply: The external calculator returned: 6 × 7 = 42
[router] evidence: external_calculator -> external.calculator: multiply(6, 7) = 42 (ok: true)
```

## 结构（B）

```text
dsh-agent-core/
├── package.json               # 脚本入口（install:profile / dump-config / run / verify）
├── packages/
│   ├── broker/                # @agent-core/broker — capability manifest → DSH tool（V1 泛化）
│   ├── router/                # @agent-core/router — 固定输入投递 + 结果/证据输出（一次性驱动）
│   ├── feishu-connector/      # @agent-core/feishu-connector — 纯 channel 层（WS/IngressEvent/ReplyTarget）
│   ├── workspace-bootstrap/   # @agent-core/workspace-bootstrap — agentId → workspace + DSH_HOME（幂等播种 AGENTS.md）
│   ├── agent-registry/        # @agent-core/agent-registry — 长期 Agent 身份注册表（原子 JSON 持久化）
│   ├── agent-memory/          # @agent-core/agent-memory — per-agent file-first 长期记忆（MEMORY.md + memory_* tools）
│   ├── agent-router/          # @agent-core/agent-router — Router / Control Plane（switchAgent 域操作 + Binding 持久化 + per-agent 进程注册表）
│   ├── product-api/           # @agent-core/product-api — Gate 1 thin Mobile Product API（HTTP adapter，127.0.0.1，供 adb reverse）
│   ├── agent-switch/          # @agent-core/agent-switch — DSH 侧 agent_core_switch_agent adapter（parent-RPC 转发）
│   ├── demo-server/           # @agent-core/demo-server — per-agent JSON-RPC server（persistence resume + parent-RPC passthrough）
│   ├── owner-guard/           # @agent-core/owner-guard — 单 owner 锁（one live process per agent）
│   └── scheduler/             # @agent-core/scheduler — Scheduler Replacement V1（cron/at/every 持久 job + 注入式 invocation/delivery seam）
├── bundle/                    # @agent-core/bundle — dsh.bundle patch 层（persona + broker/router）
├── bundle-demo/               # @agent-core/bundle-demo — process-model demo patch 层
├── bundle-integration/        # @agent-core/bundle-integration — 控制面组合（registry + workspace-bootstrap + feishu + agent-router）
├── bundle-memory/             # @agent-core/bundle-memory — per-agent memory patch 层
├── bundle-agent-switch/       # @agent-core/bundle-agent-switch — per-agent switch adapter patch 层
├── profile/                   # dsh-profile-agent-core — dsh.profile 清单（V0）
├── profile-demo/              # dsh-profile-agent-core-demo — process-model demo profile
├── profile-integration/       # dsh-profile-agent-core-integration — 控制面 profile
├── profile-integration-agent/ # dsh-profile-agent-core-integration-agent — per-agent 组合（demo-server + memory + switch）
├── scripts/
│   ├── install-profile.mjs    # 把 profile 与 @agent-core/* 装入 Harness home（只增不改）
│   ├── run.mjs                # 解析 DSH checkout + 注入 OPENCODE_GO_API_KEY，跑 dsh CLI
│   ├── verify.mjs             # 断言验收用例证据（multiply(6,7) = 42）
│   ├── process-model-demo.mjs # process-model 演示/基准驱动（100 常驻 fallback 已证明）
│   ├── install-demo-home.mjs  # 安装 demo home（只增不改）
│   ├── demo-home.mjs          # demo home 路径解析
│   ├── install-integration.mjs        # 安装集成控制面 profile（只增不改）
│   ├── integration-v1-verify.mjs      # Integration V1 验收（真实飞书链路）
│   ├── product-integration-v1-verify.mjs # Product Integration V1 验收（A/B 双 Agent、switch、重启、crash resume）
│   ├── scheduler-v1-verify.mjs        # Scheduler V1 验收驱动（59 测试 + 兼容扫描 + 重启证据 + 审计回归）
│   ├── agentcore-cron.mjs             # openclaw cron add/list/runs 的 Agent Core 提交面（daemon 换用）
│   ├── openclaw-job-import.mjs        # 真实 OpenClaw jobs → V1 store 迁移工具（默认 dry-run + 锁内守卫）
│   └── mobile-gate1-verify.mjs        # Mobile Gate 1 验收（Emulator → adb reverse → Product API → Router → real DSH）
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
node scripts/install-profile.mjs   # 1. 安装 profile（symlink 进 ~/.dsh，可重复执行）
node scripts/run.mjs               # 2. 实跑：投递固定输入
node scripts/run.mjs "你的输入"     #    或用 launcher 参数覆盖输入（外部消息通道）
node scripts/verify.mjs            # 3. 断言验收用例
node scripts/run.mjs --dump-config #    查看合成后的配置树
```

## V0 vertical slice 插件（C）

最初 V0 vertical slice 只有两个 Cordis 插件（`name` + `inject` + `Config` + `apply` 命名导出）：

- `@agent-core/broker`：把旧 external-harness-v1 的 `external.calculator` 能力
  注册为 DSH 模型可见 tool `external_calculator`。语义 1:1 复刻已验收 fixture：
  add / subtract / multiply / divide，`{ok, result}` / `{ok, error:{code}}`，
  错误码 `invalid_arguments` / `unsupported_operation` / `divide_by_zero`。
- `@agent-core/router`：投递插件。创建 Agent（`ctx.agents.create`，复用
  `dsh-headless` 参考驱动流程）→ `agent.followup(输入)` 送入 inbox →
  `agent.whenIdle()` 等到 turn 关闭 → flush 会话 → 打印最终回复与
  `tool/call`→`tool/result` 持久化证据 → `appExit(0|1)`。输入 = 配置
  `fixedInput`，可被 launcher 第一个参数覆盖。

Release checkpoint 另外已经加入 `feishu-connector`、`workspace-bootstrap`、
`demo-server`、`owner-guard` 等独立组件，详见上面的结构与 `docs/reports/`。

`bundle/` 与 `profile/` 是配置工件（不是插件代码）：patch 层插入 V0 broker/router，
profile 声明 `[dsh-base, @agent-core/bundle]`。未修改 deepseek-harness 与旧
agent-core 任何文件；对 `~/.dsh` 只做新增 symlink。

## 当前替代结论与下一步

详见 [`docs/reports/bootstrap-v0.md`](docs/reports/bootstrap-v0.md)、
[`docs/reports/process-model-demo-v0.md`](docs/reports/process-model-demo-v0.md) 与
[`docs/CAPABILITY_MATRIX.md`](docs/CAPABILITY_MATRIX.md)。当前已证明 DSH 可以承担
Agent Core 的 agent loop / session / tool / persistence 等 Runtime 基础；旧 Kernel / Runtime
保持冻结，不再作为下一步迁移目标。

下一步是 `Integration V1`：把已经验证的组件第一次串成真实链路：

```text
Feishu → Router / Control Plane → workspace-bootstrap → owner-guard
       → per-agent DSH process → resume-aware agent-server → reply
```
