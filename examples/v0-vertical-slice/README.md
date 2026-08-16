# V0 Vertical Slice — deprecated example

> 状态：**DEPRECATED（V0 已完成的字节切片，仅作历史示例保留）** · 移动：REPO_HYGIENE_CONVERGENCE_V1
> 从顶层 `packages/router` + `bundle/` + `profile/` + `scripts/{install-profile,run,verify}.mjs` 移入 `examples/v0-vertical-slice/`。

这是 Agent Core 最初的 **V0 vertical slice**：用 DSH 已具备的能力搭一条最小可跑链路，
验收用例是旧 Agent Core 的 `external.calculator`（multiply 6 × 7 = 42）。

- `router/` —— `@agent-core/router`，一次性的固定输入投递插件（`ctx.agents.create` →
  `followup` → `whenIdle` → 汇总证据 → `appExit`）。**注意：这不是生产 `agent-router`
  （`@agent-core/agent-router`）；生产路由/进程监管完全由 `packages/agent-router` 承担。**
- `bundle/` —— V0 patch 层，把 `@agent-core/broker` + `@agent-core/router` 挂进 `dsh-base`
  之上的 `agent-core` profile。
- `profile/` —— `dsh-profile-agent-core`，V0 profile（仅在 `--profile agent-core` 下使用，
  生产/profile 组合均不引用）。
- `scripts/` —— 本示例自洽的安装 / 运行 / 验收驱动。

## 为什么保留为示例而非删除

`@agent-core/router`（V0 一次性驱动）经过核实：

- ACTIVE_RUNTIME_CALLER = NONE（没有任何生产/profile 组合加载 `--profile agent-core`）
- PRODUCTION_IMPORT = NONE（无生产包 import `@agent-core/router` / `packages/router`）
- TEST_DEPENDENCY = NONE（无测试引用）

三个判定均为空，因此该 V0 切片是**无生产 caller 的已废弃示例**，按卫生收敛规则
`SAFE_MOVE_TO_EXAMPLES` 从顶层移入本目录，保留历史与复现路径。

## 运行（仅复现 V0 历史验收，不参与生产）

前置：`deepseek-harness` checkout（默认 `../../github/deepseek-harness` 相对本仓库）；
模型凭据来自 `~/.dsh/.credentials.yaml` 的 `OPENCODE_GO_API_KEY`（或环境变量）。

```sh
node examples/v0-vertical-slice/scripts/install-profile.mjs  # 1. 安装 profile（symlink 进 ~/.dsh）
node examples/v0-vertical-slice/scripts/run.mjs              # 2. 实跑：投递固定输入（multiply 6 × 7）
node examples/v0-vertical-slice/scripts/verify.mjs           # 3. 断言验收用例
```

历史验收报告：`docs/reports/bootstrap-v0.md`、`docs/reports/process-model-demo-v0.md`。
