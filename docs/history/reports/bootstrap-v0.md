---
status: historical
as_of: 2026-08-15
superseded_by:
public: PUBLIC
---

> HISTORICAL ENGINEERING RECORD
>
> This document describes the system as of 2026-08-15.
> It is **not** current architecture documentation.
>
> Current documentation: none for this engineering evidence — see the index at [docs/README.md](../../README.md).
# Agent Core on DSH — V0 调查报告

> 来源：Bootstrap V0 完成后的原始报告（原 `docs/V0-REPORT.md`），整理入
> `docs/reports/` 结构时内容完整保留。V0 只建立最小 DSH-based Agent Core
> 骨架并跑通 vertical slice（external.calculator 6×7=42），不涉及 V1 能力迁移。

本轮目标：不动旧架构，只调查 DeepSeek Harness 的组织方式，并建立最小
DSH-based Agent Core 骨架，跑通一条 vertical slice。输出 A–E。

约束遵守情况：未经过 OpenClaw / 旧 Agent Core Runtime / 旧 Kernel；未修改
`agent-core`、`deepseek-harness` 任何文件；未改 Auth/Broker 业务语义（本 repo
不涉及旧 Auth/Broker）；未复制 Forum/Workflow/OKR 逻辑；未删除旧代码；
发现的 DSH 能力全部直接复用。

---

## A. 实际跑通的最小链路

```text
node scripts/run.mjs
  → dsh CLI --profile agent-core（profile = dsh-base + @agent-core/bundle）
  → @agent-core/router: ctx.agents.create() 创建 Agent（model: opencode-go / deepseek-v4-flash）
  → router: agent.followup(固定输入) 送入 inbox
  → agent-loop: turn 开 → 模型看到 broker 注册的 external_calculator tool
  → 模型调用 tool: {operation:"multiply", a:6, b:7}
  → @agent-core/broker: 按 external-harness-v1 语义计算 → {ok:true, result:42}
  → turn 关闭 → router: whenIdle() 后输出最终回复 + tool/call→tool/result 持久化证据 → exit 0
```

实测输出（2026-08-14，两次运行均通过 `scripts/verify.mjs` 全部断言）：

```text
[router] session: agent-core-2349b114-…
[router] input: Use the external_calculator tool to multiply 6 and 7 …
[router] agent reply: The external calculator returned: 6 × 7 = 42
[router] evidence: external_calculator -> external.calculator: multiply(6, 7) = 42 (ok: true)
RUN_EXIT=0
```

第二条（launcher 参数覆盖输入，验证 Router 的“外部消息”通道）：
`subtract(100, 37) = 63`，同样 exit 0。

验收对齐：旧 capability-host 集成测试的验收用例是 `external.calculator` +
`{operation:"multiply", a:6, b:7}` → `result == 42`；本链路用同一个用例，
证据来自会话日志的 `tool/result` 事件（不信任模型自述）。

## B. 新仓库结构

```text
dsh-agent-core/
├── package.json               # npm scripts：install:profile / dump-config / run / verify
├── README.md
├── docs/V0-REPORT.md          # 本文件
├── packages/
│   ├── broker/                # @agent-core/broker — 能力暴露插件（一个 tool）
│   │   ├── package.json
│   │   └── src/index.js
│   └── router/                # @agent-core/router — 输入投递插件（一次性驱动）
│       ├── package.json
│       └── src/index.js
├── bundle/                    # @agent-core/bundle — dsh.bundle patch 层
│   ├── package.json           #   "dsh": { "bundle": { "patch": "./cordis.patch.yml" } }
│   └── cordis.patch.yml       #   persona + insert broker/router 两行
├── profile/                   # dsh-profile-agent-core — dsh.profile 清单
│   ├── package.json           #   bundles: ["@deepseek-ai/dsh-base", "@agent-core/bundle"]
│   └── cordis.patch.yml       #   用户层（空）
└── scripts/
    ├── install-profile.mjs    # 安装（只新增 symlink）
    ├── run.mjs                # 跑 dsh CLI（注入凭据、定位 DSH checkout）
    └── verify.mjs             # 断言验收用例
```

对 Harness home（`~/.dsh`）只做三处新增：`profiles/agent-core/{package.json,
cordis.patch.yml}` 两个文件 symlink + `profiles/node_modules/@agent-core/{bundle,
router,broker}` 三个包 symlink（走 dsh-app-boot 的 flat fallback 机制，该机制只增
不删）。仓库内另有开发期解析桥 `node_modules/@deepseek-ai → DSH checkout 的
.pnpm/node_modules/@deepseek-ai`（ESM 从源码真实路径解析 peer 依赖所需）。

## C. 为跑通写了哪些插件

只有两个 Cordis 插件（均为命名导出 `name` / `inject` / `Config` / `apply`，
遵循 Loader 契约）：

| 插件 | 职责 | 实现要点 |
|---|---|---|
| `@agent-core/broker` | 暴露旧 `external.calculator` 能力 | `ctx.tools.register(defineTool({name:'external_calculator', …}))`；语义 1:1 复刻已验收 fixture：operation ∈ {add,subtract,multiply,divide}，成功 `{ok:true,result}`，失败 `{ok:false,error:{code}}`（`invalid_arguments`/`unsupported_operation`/`divide_by_zero`）；tool 名用下划线是因为 DSH tool 名要走 provider function-name 语法（旧 wire id `external.calculator` 保留在描述与常量中） |
| `@agent-core/router` | 把输入送进指定 Agent 并等到结果 | 复用 `dsh-headless` 参考驱动流程：`ctx.agents.create()`（`installModelSelection` 冻结默认模型）→ `agent.followup(createUserMessage(...))` → `agent.whenIdle()` → `sessions.flush()` → 汇总 `assistant/message` 与 `tool/call`/`tool/result` 证据 → `appExit(0/1)`；输入 = `Config.fixedInput`，可被 launcher 第一个参数覆盖 |

配置工件（非插件）：`bundle/cordis.patch.yml`（插入上述两行 + persona）、
`profile/package.json`（bundle 清单）。没有写任何新的 harness/loop/llm/session
逻辑——全部来自 dsh-base。

## D. 旧 Agent Core 中哪些模块看起来已可由 DSH 替代

依据旧 `agent-core` README（Core Boundary / M1 架构）与源码目录对照 DSH
[architecture.md] 与已实测链路。结论：**Kernel 的六个所有权面全部有现成等价物**。

| 旧 Agent Core 模块（Rust Kernel） | DSH 等价能力 | 备注 |
|---|---|---|
| run lifecycle + agent loop（`src/runtime/` tool_loop 等） | `dsh-agent-loop` + `ctx.agents`（turn/step 机、inbox、`agent/*` 事件） | 本链路已实测 `create/followup/whenIdle` |
| append-only event log（Journal） | `dsh-session` 的 `SessionEvent` 追加日志 + `session/event` | “model-visible ⟺ logged” 不变量 |
| SQLite session/run/ingress/journal 持久化 | `dsh-session-persistence-jsonl` + `dsh-session-query-sqlite` | 本链路已实测 `sessions.flush` |
| model provider 接口（OpenAI-compatible） | `dsh-llm` 适配器 seam + `dsh-llm-deepseek` / `dsh-llm-pi-ai` | 本链路用 pi-ai opencode-go 实跑 |
| invocation intent 审批与 adapter 派发（`src/gateway/` policy/tool_call） | `tools/pre-execute` 瀑布 + `dsh-user-approval`/`dsh-permission-presets` + `ctx.llm` 路由 | 语义未动：仍由部署层策略决定 |
| audit 记录与 health 信号 | 会话日志 + `dsh-session-telemetry-otel` + `agent/*`/`tools/result` 事件 | 本链路证据即来自日志 |
| external harness 能力宿主（capability-host、`external.calculator`） | capability seam（Service Definition/Provider/Consumer）+ 本 repo `broker` 插件 | 本轮 vertical slice 就是它 |
| 外部消息送入（Feishu connector → Kernel `/v1/ingress`） | `ctx.agents` inbox（`followup`/`inject`）+ `dsh-sdk-jsonrpc-server`（`session/prompt`，按 sessionId 寻址、自动 create） | 本链路实测 in-process 通道；SDK server 是现成的 out-of-process 通道 |
| 多 agent / workflow / 编排（外部编排边界） | `dsh-subagent` / `dsh-workflow` / `dsh-preset`（per-session 组合） | 未在 V0 使用，按“复用不重写”原则登记 |
| 长期记忆 / 技能 | `dsh-skill` + `dsh-session-projection` | 未在 V0 使用 |

不在替代清单内（按约束不迁移）：Forum / Workflow 业务 / OKR 逻辑、Auth/Broker
业务语义、旧 Connector 的 Feishu 认证与渲染。

## E. 下一步只推荐一个迁移目标

**旧 Kernel 的 Run/Session 面 → DSH 的 agent/session 组合**（即 D 表第一、二、
三行打包迁移）：把旧 `agent-core` 的“一次 run = 一个 session/agent + 事件日志 +
持久化”语义，等价映射到 `ctx.agents.create()` + `followup` + `whenIdle` +
JSONL 持久化（本轮 router 已演示 90% 的形态）。

理由：它是旧系统唯一“不可绕过”的核心所有权面，且本链路已证明 DSH 同语义
实现可跑通；迁移它之后，Feishu connector 只需把 `/v1/ingress` 换成
`ctx.agents` 或 SDK server（现成），capability-host 只需把 artifact 换成 broker
tool（本轮已演示），其余模块（审批、编排、技能）自然落在 DSH 扩展点上，不需要
单独排期。

不建议下一轮同时迁移多个面：先让“run 面”以同一验收用例（external.calculator
6×7=42）在 DSH 上连续稳定运行，再动 connector 与 capability-host。

[architecture.md]: https://github.com/deepseek-ai/deepseek-harness/blob/main/docs/architecture.md
