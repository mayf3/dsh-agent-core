---
status: historical
as_of: 2026-08-16
superseded_by:
public: PUBLIC
---

> HISTORICAL ENGINEERING RECORD
>
> This document describes the system as of 2026-08-16.
> It is **not** current architecture documentation.
>
> Current documentation: none for this engineering evidence — see the index at [docs/README.md](../../README.md).
# REPO_HYGIENE_CONVERGENCE_V1 — 执行与收敛报告

> 日期：2026-08-16 · 分支：`chore/repo-hygiene-convergence-v1`（独立 worktree，已 commit + push，未 merge）
> 范围：纯仓库卫生收敛。未触碰 agent-router behavior / Router API / Scheduler behavior /
> Auth/Broker / Agent Definition semantics / Workspace ownership / production-runtime /
> trusted-cp / Kernel（均无变化）。

## 0. 验收摘要

```
REPO_HYGIENE_CONVERGENCE_V1 = PASS

MOVED_TO_EXAMPLES =
  packages/router/                 -> examples/v0-vertical-slice/router/
  bundle/                          -> examples/v0-vertical-slice/bundle/
  profile/                         -> examples/v0-vertical-slice/profile/
  scripts/{install-profile,run,verify}.mjs -> examples/v0-vertical-slice/scripts/
  (以上构成完整 V0 vertical slice，移入历史示例)

DELETED = <无——没有能同时满足三空判定的可删路径；V0 切片整体 MOVE 而非 DELETE>

DOCS_FIXED =
  README.md                        （V0 结构/脚本/链路去顶层化，指向 examples；运行命令改为 npm 验收脚本）
  docs/AGENT_CORE_COMPONENT_MAP_V1.md （§6/§7 registry -> agent-definition；登记 V0 router 已废弃）

STALE_COMMENTS_FIXED =
  packages/notification-ingress/src/index.js        （deliver 已合并，去「未合并/503 pending」陈旧注释，逻辑零改动）
  packages/notification-ingress/test/api.test.js    （同步去陈旧断言注释）
  packages/broker/src/index.js                      （去 `@agent-core/router` 陈旧命名注释）
  scripts/install-integration.mjs                   （指向 V0 installer 的注释改为 examples 路径）

DEFERRED =
  bundle-demo/ 与 profile-demo/ 命名未改（STILL_REFERENCED——见 §2，改名会破坏生产，仅记 debt）
  profile-integration-agent/ / demo-server/ / owner-guard/ 同理维持现状
  docs/AGENT_CORE_PRODUCT_ARCHITECTURE_V1.md 中 "Agent Registry" 措辞（冻结草案，待单独 ADR/架构 PR）

RUNTIME_BEHAVIOR_CHANGE = NONE
ROUTER_CORE_CHANGE = NONE
KERNEL_CHANGE = NONE
```

## 1. 重新验证（不直接相信旧报告）

对报告中的 stale/dead 项，逐项以当前最新 `main`（HEAD `bfe7491`）+ 进行中的
`feat/production-integration-v1` worktree（HEAD `2378d5d`）重新核证：

| 项 | 旧报告断言 | 当前验证 | 结论 |
|---|---|---|---|
| `packages/router`（`@agent-core/router`） | 无生产 caller | ✓ 确认：ACTIVE_RUNTIME_CALLER=NONE / PRODUCTION_IMPORT=NONE / TEST_DEPENDENCY=NONE（见 §3 证据）；仅 V0 切片自引用 | **SAFE_MOVE_TO_EXAMPLES** |
| `bundle-demo` | （疑似 dead） | ✗ **推翻**：被生产 agent-router / resident / demo-home 引用 | **STILL_REFERENCED（DEFER）** |
| `profile-demo` | （疑似 dead） | ✗ **推翻**：生产 `--profile agent-core-demo` 即 `profile-demo` | **STILL_REFERENCED（DEFER）** |
| old integration fixtures | 待清理 | ✓ 现存 fixtures（broker self-assert / feishu / scheduler jobs）全部被生产/测试引用；`.demo/` 为 gitignored 运行时数据 | **STILL_REFERENCED（DEFER）** |
| stale notification-ingress comments | deliver 未合并 | ✗ **推翻**：AGENT_ROUTER_DELIVERY_V0 已合并，`agentRouter.deliver` 已落地；注释陈旧 | **STALE_COMMENTS_FIXED** |
| README / Roadmap / ADR 矛盾 | 存在 | ✓ registry 措辞 vs agent-definition 实现显式矛盾 | **DOC_FIX** |

**关键更正**：报告将 `bundle-demo`/`profile-demo` 视为可清理的 dead 项是**错误的**。二者
是生产 per-agent 组合的核心：`packages/agent-router/src/process.js` 默认 `DEFAULT_PROFILE =
'agent-core-demo'`，`scripts/agent-core-resident.mjs` `AGENT_PROFILE='agent-core-demo'`，
`scripts/demo-home.mjs` `AGENT_PROFILE_DEFS['agent-core-demo']`（`repoDir: 'profile-demo'`
+ `farmLinks: { 'bundle-demo': ... }`），且 production-integration 的
`profile-production`、`packages/agent-provisioning`、`trusted-cp-hardening-v1-verify.mjs`
同样引用。任一删除/改名都会破坏生产进程 spawn。→ 只记 debt，不做（避免架构改动与生产回归）。

## 2. STILL_REFERENCED / DEFERRED 明细（不删，记 debt）

- `bundle-demo/`、`profile-demo/`：生产 per-agent profile（命名含 "demo" 有误导，但为生产依赖）。
- `profile-integration-agent/`、`packages/demo-server/`、`packages/owner-guard/`：同上生产依赖。
- `docs/AGENT_CORE_PRODUCT_ARCHITECTURE_V1.md` 的 "Agent Registry" 措辞：registry 已被
  agent-definition 取代（组件地图已同步），但该架构稿为冻结草案，修订应走独立文档 PR。
- `.demo/`：gitignored 运行时数据（非 track），不在收敛范围。
- 根 `node_modules/@agent-core/router` 等本地 symlink：gitignored 生成物，非 track。

## 3. `packages/router` 三空判定证据（SAFE_MOVE_TO_EXAMPLES）

- **ACTIVE_RUNTIME_CALLER = NONE**：唯一挂载 `@agent-core/router` 的 `bundle/cordis.patch.yml`
  （V0 bundle）仅被 V0 `profile/`（`--profile agent-core`）消费；生产 profile
  （agent-core-demo / integration / integration-agent / memory）均不加载 V0 bundle。
  `grep --profile agent-core` 仅命中 `scripts/run.mjs`（已移入示例）与历史文档。
- **PRODUCTION_IMPORT = NONE**：`grep -rn "@agent-core/router\|packages/router" packages scripts`
  在 production packages（agent-router / broker / scheduler / notification-ingress 等）无代码 import；
  唯一命中为 broker 的**命名规范注释**（已改为中性措辞）。
- **TEST_DEPENDENCY = NONE**：`grep @agent-core/router packages/*/test` —— 空。

三空判定成立，且其所属 V0 垂直切片整体自洽无外部引用 → 按 `SAFE_MOVE_TO_EXAMPLES`
将整个 V0 slice（router + bundle + profile + 3 脚本）移入 `examples/v0-vertical-slice/`，
保留版本历史（`git mv`），新增示例 README 说明 DEPRECATED 状态与复现路径。

## 4. 影响与回归

- 单元测试：`npm test` → **312 pass / 0 fail / 1 skip（skip 为既有），exit 0**。
- 移动的 V0 示例脚本已完成语法检查（`node --check`）与路径解析复核。
- 生产路径（agent-router / resident / scheduler / broker / notification-ingress 接口与逻辑）
  零改动；仅注释/DOC 变化。
- 不修改 production-integration worktree，不触碰其分支文件。
