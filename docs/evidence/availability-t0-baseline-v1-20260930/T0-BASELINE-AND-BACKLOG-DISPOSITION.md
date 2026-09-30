# T0 基线核对与当前一批 backlog 处置（availability rollout 第一轮）

日期：2026-09-30。依据：PR #373 的 T0 任务定义（`docs/superpowers/plans/2026-09-30-availability-and-backlog-rollout.md`）。
配套：[baseline-inventory.json](baseline-inventory.json)。回流浪：`live-restore/t0-backflow-20260930`（base `51f47739`，commit `1dbfb70b`，独立 worktree `/Users/yanfenma/workspace/worktrees/t0-backflow-20260930`）。

## 1. 唯一接手者核对（T0 第一checkbox）

- `mayf3/agent-control` 队列（command bus）open issue 中**没有** availability rollout / T0/T1 / PR #373 接手同目标任务。
- 6 个带 `agent:running` 标签的遗留 receipt（#83/#36/#29/#25/#12/#9，全部 2026-09-29）进程 PID 全部已终止（`ps -p` 逐一确认 gone），属 stale 标签，无同目标活跃 writer。
- 本地 `.worktrees/` 最新活动为 2026-09-26；2026-09-30 本仓提交仅 PR #373 自身三份 docs。
- 结论：本 agent 为唯一接手者；未新建竞争 writer，未动他人分支。

## 2. 当前在跑什么（受影响服务，只读）

| 服务 | 状态 | 加载源 | 与 main 51f47739 关系 |
|---|---|---|---|
| `ai.agent-core.runtime`（用户域 HR+普通 Agent，launchd running pid 1753） | 在跑 | `/Users/yanfenma/workspace/project/production-dsh-agent-core` 工作树 @ `549dace` + **未提交现网补丁**（24 M + ~57 新文件） | 落后 main ~6 周；补丁逐文件三方对比后 5 项未进 main → 已回流 |
| `ai.agent-core.scheduler-v2`（pid 1752） | 在跑 | `dsh-agent-core-main` @ `d6d18787` | 已是 main 祖先；仅一个临时脚本脏，无源码补丁 |
| `ai.agent-deploy-system` / `-shim`（DS/shim） | 注册 | `/usr/local/libexec/agent-deploy-{system,shim}` 安装 python | 安装→仓库映射未建立（T2 输入）；另有 root 域 `ai.agent-deployd` 同注册，实际执行器身份待 T2 证明 |
| authsvc runtime（pid 8971） | 在跑 | 受控根 `/usr/local/libexec/agent-core/app` | **无版本 manifest**——T1 要补的洞；历史 rollback/failed 目录齐备 |

读面边界：仅 launchd 元数据、plist ProgramArguments、git 元数据、目录清单、进程表；未读任何秘密内容，未做全机扫描，未对 HR 做重置或业务探测。

## 3. 现网补丁回流（T0 核心 checkbox）

方法：对生产工作树每个改动/新增文件做 `549dace基线 / live / main` 三方对比；M 文件再以 symbol 级检查（live 补丁新增函数/常量是否已在 main）判定归属。

**已回流（5 项，commit `1dbfb70b`）：**

1. `packages/agent-switch/src/index.js` — switch 工具描述强制先 `agent_definition_read(operation=list)` 解析真实目标，防编造角色/ID（live 独有）。
2. `profile-production/cordis.patch.yml` — 与上配套的 switch prompt 段（live 独有）。
3. `bundle-broker/cordis.patch.yml` — `forumModeratorAgentIds` 白名单配置值；main 代码已有该字段的 schema 校验与注册逻辑，仅缺此现网配置。
4. `packages/product-api/src/history-auth.js` — tailscaled LocalAPI Host header 修复（standalone tailscaled 1.94 拒绝 `Host: localhost`，改发 `local-<socket basename>`；live 独有 drift hunk）。
5. `packages/production-runtime/src/txn-safety.js`（新增）+ `shared-codex-migration-executable.js` — live 的 candidate-r2 加固版（默认只读 gate、事务写集、receipt、守护回滚）；main 为未加固旧版，被 live 取代。

**明确不回流（1 项）：** `self-ops.js` 的 `infrastructure: true` 单行——与 main 已接受测试（self_ops 必须留在 model tool list）冲突，且无来源可归属。已记入 unresolvedDrift：从 main 构建的下一包会让 self_ops 重新出现在模型工具清单（main accepted 语义，低风险）。

**其余全部判定 main 已包含/已被演进取代**：9 个 M 文件与 main 完全一致、9 个 M 文件补丁语义经 symbol 检查已在 main、57 个 untracked 文件与 main 逐字节一致、其余 DRIFT 文件均为 main 超集方向（如 `promptFenceError`、`job_disposition`、expectedRevision 文档改进）。

## 4. 当前一批 backlog 处置

只覆盖当前一批（W0 基线 + W1 读面）及直接依赖；全表见 PR #373，不在本报告重复。

| Goal | source | installed | enabled | business-verified | disposition | 依据 / 下一动作 |
|---|---|---|---|---|---|---|
| HR + 普通 Agent 可用基线 | 549dace+patches | yes (pid 1753) | yes | **user-reported only** | **VERIFY_ONLY**（保活，不重置不探测） | 补一次经授权的低风险业务读验证；回流分支已备好下一包源 |
| MY_SESSIONS / Session Traceability（#318 已合并 main） | main `4a4b7f40` | **no**（生产 549dace 无此源） | — | no | **INSTALL** | 纳入 T1 下一包（回流分支已基于 main，天然包含） |
| Execution History 读面（#309 已合并 main） | main `02d3a0bb` | **no** | — | no | **INSTALL** | 同上；WPA-1 archive-on-rotate 写入差异随包单独核对，不称零写入 |
| Human Attention / Stuck View（#367 已并入 main） | main | **no** | — | no | **INSTALL** | 同上；`workflow-todo#2` 消费端为 **INTEGRATE**（仍 OPEN，消费已有 #1 读面） |
| Workflow Node Session History / Trusted Progress / Fixed Operation | 9/29 handoff 称在 canonical main | **no**（同上，生产源落后） | Fixed Operation 执行未启用 | no | **INSTALL**（底座不重写）+ Fixed Operation 执行面 **ENABLE 待范围** | 用现包交付，不重写 |
| Watchdog/self_ops 已具备读面 | main | **no** | — | no | **INSTALL**（读面）| self-ops 单行 drift 见 §3，行为差异已声明 |
| WEC 基础 / Owner Assistance / RETURN-limit（#370） | main / OPEN | unverified | unverified | no | 本轮 **未核对**（W2/W3 批次，依赖本包先落） | 下一轮 fresh-read，不提前 |
| 治理短路径采用（#364） | Draft | — | — | — | 并行非生产，不占本窗口 | 继续 #364 原则 |

关键修正 vs 原盘点：W1 三件（MY_SESSIONS / Execution History / Human Attention）在原 backlog 中部分标 VERIFY_ONLY（"已安装正确则只补验证"）——**实际核对结果是生产源 549dace 不含这些 main 能力，处置从 VERIFY_ONLY 修正为 INSTALL（随下一包）**。这正是 T0"不能拿历史 PASS 当现场证据"的价值。

## 5. 回流分支测试结果（实际执行）

toolchain：受控 node `v25.6.1`（`/usr/local/libexec/agent-core/node-runtime`，与生产 runtime 同款）+ 清空代理 env（compose 的 fail-closed 代理断言要求）。

| 套件 | 结果 |
|---|---|
| `packages/broker/test/*.test.js` + `capabilities/` | **489/489 pass** |
| `packages/production-runtime/test/*.test.js` | **157/157 pass** |
| `packages/product-api/test/*.test.js` | 93/97（4 fail = voice-transcription 真实 TTS 引擎用例，headless 设计性失败） |
| `agent-switch/test/switch.test.js` | 9/10（1 fail 为预存环境差异：harness dsh-tools schema 形状 vs 测试期望，**未修改的 main 基线同样失败**，非回流引入） |

环境差异排查记录（供后续不再重查）：本机 shell 代理变量触发 `compose.js` 代理 fail-closed；本机默认 node v26.7.0 ≠ `TARGET_PROXY_NODE_VERSION v25.6.1`；harness/pnpm 作用域包链接不全导致 ERR_MODULE_NOT_FOUND。均与回流补丁无关，基线复现一致。

## 6. 局限与遗留

- 生产 checkout git 对象陈旧，无法解析 `51f47739`——回流以主仓对象完成，不影响结论。
- DS/shim 安装版↔源码映射未建立（T2 输入）；`ai.agent-deployd`（root）与 DS/shim 的实际分工未证明。
- 受控根 `app/` 无 manifest——T1 的 release-package 工具正是补此洞。
- 用户报告的 HR 恢复未由本 agent 复测（按计划约束）；`business-verified` 列保持 user-reported。
- production-dsh-agent-core 现场目录**未做任何修改**（只读核对），服务零影响。
