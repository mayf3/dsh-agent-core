# OPEN_SOURCE_DOCS_CONVERGENCE_V1

> 状态：SPEC (PASS) · 日期：2026-08-16
> 基线：`bfe7491`（origin/main, DELIVERY_PIPELINE_INTEGRATION_V0）
> 分支：`docs/open-source-docs-convergence-v1`（独立 worktree，未 merge main）
> 性质：**设计与审计抽象，只设计，不实施**。本任务不创建任何迁移后的文档、不修改
> 任何现有文档、不修改任何代码。唯一新增文件即本 Spec。
>
> 目标仓库：`mayf3/dsh-agent-core` —— 从一个「内部研发过程档案很多、陌生人难以判断
> 哪些文档才是当前事实」的仓库，收敛成一个陌生开发者可以理解、安装、运行、扩展，并能
> 清楚区分「当前产品事实」与「研发历史」的高质量开源仓库。

---

# 0. 摘要（Abstract）

Agent Core 是一个基于 DeepSeek Harness（DSH）的长期性 Agent 控制面（long-lived Agent
control plane），当前仓库的主要内容是**研发过程档案**：大量 V0/V1 报告（`docs/reports/`）、
调查（`docs/investigations/`）、决策（`docs/decisions/`）散落在 `docs/README.md` 的时间轴
追加中。陌生访客无法在不阅读历史报告的前提下判断「Agent Core 现在是什么、怎么跑起来」。

本 Spec 只回答「文档体系应该收敛成什么样、如何分阶段收敛、每个文件去哪、链接如何处理、
公开安全如何判定」，**不实施任何迁移、不修改代码、不重构 Agent Core**。

核心设计原则：

1. **Current Truth ≠ 一个巨型文件**。Current Truth 是一棵小的「当前文档树」，每个主题
   只有一个 authority。
2. **禁止「底部追加更新日期」** 维护 Current Truth。时间演化属于 `decisions/`、`history/`
   与 git history。
3. **历史文档保留但不冒充当前**。历史报告必须有机器可识别的 `status: historical` marker。
4. **先建新房，再搬旧家具**。先让 README + Quick Start + 核心概念成立，再归档历史。
5. **MERGED_CURRENT 与 ACCEPTED_BUT_UNMERGED 必须严格区分**，且设计「Production
   Integration merge 后 Current Docs 一次性刷新」而非继续追加日期备注。

---

# 1. Audience（Part A）

四种读者，每种回答 `FIRST_PAGE`、`SECOND_PAGE`、`SHOULD_NOT_HAVE_TO_READ`。

## A1. 第一次访问 GitHub 的开发者

第一个到访仓库、只想判断「这是什么 / 值不值得看」的人。不关心内部里程碑。

- **FIRST_PAGE =** root `README.md`（第一屏：是什么 / 为什么存在 / 与 DSH 关系 / 成熟度 / 起始动作）。
- **SECOND_PAGE =** `docs/getting-started/quick-start.md` → `docs/concepts/agents.md`。
- **SHOULD_NOT_HAVE_TO_READ =** 任何 `V0`/`V1` report、`docs/investigations/*`、
  `docs/history/**`、`docs/AGENT_CORE_*`.md 冻结草案、`docs/TRUST-BOUNDARY-REPORT.md`。

## A2. 想自己运行 Agent Core 的用户

要安装、配置、部署、加 Agent、跑 scheduler、接入口、排障的人。

- **FIRST_PAGE =** `docs/getting-started/installation.md`。
- **SECOND_PAGE =** `docs/getting-started/quick-start.md` → `docs/guides/deployment.md` →
  `docs/guides/adding-an-agent.md` → `docs/guides/scheduler.md` → `docs/guides/integrations.md` →
  `docs/security/security-model.md`。
- **SHOULD_NOT_HAVE_TO_READ =** `docs/reports/*`、`docs/investigations/*`、`docs/history/**`。

## A3. 想开发插件 / integration 的贡献者

要理解 DSH vs Agent Core 边界、Plugin/Bundle/Profile、Broker 能力、Scheduler seams、
Product ingress seams、Workspace/Memory 扩展点。

- **FIRST_PAGE =** `docs/architecture/overview.md`（尤其 runtime-boundary）。
- **SECOND_PAGE =** `docs/concepts/agents.md` → `docs/guides/plugins.md` →
  `docs/guides/integrations.md` → `docs/contributing/development.md` →
  `docs/reference/configuration.md`。
- **SHOULD_NOT_HAVE_TO_READ =** 全部 `docs/reports/*`、`docs/investigations/*`、`docs/history/**`。

## A4. 架构 / 安全维护者

要看 authority boundaries、process model、trusted control plane、credential model、
architectural decisions、frozen invariants。

- **FIRST_PAGE =** `docs/architecture/overview.md`。
- **SECOND_PAGE =** `docs/architecture/control-plane.md` → `docs/security/security-model.md`
  → `docs/security/trusted-control-plane.md` → `docs/security/credentials.md` →
  `docs/decisions/`（ADR 索引）。
- **SHOULD_NOT_HAVE_TO_READ =** 除非需要追溯设计理由，否则不翻 `docs/history/**`。

> **约束：普通新用户不得被要求先阅读 V0/V1 reports。** 任何 Journey（见 Part J）都不经过
> `reports/`、`investigations/`、`history/`。

---

# 2. Current Docs Diagnosis（Part B）

以下全部基于真实 audit（读取本仓库 worktree，未假定问题）。每条标注当前文档的分类地位。

## 2.1 逐文件核查

### root `README.md` — **V0/bootstrap/calculator 时代的结构（已过时但仍为主入口）**

- 现状：以「V0 bootstrap」「external.calculator 6×7=42」「Release checkpoint PR #1」
  「当前替代结论与下一步」「下一步是 Integration V1」开场；包含一个混合了 install 说明、
  组件清单、架构片段、milestone 的庞大「结构（B）」章节。
- 分类：**已过时但仍担任导航入口**。它把「当前产品事实」与「V0 历史」与「下一步规划」
  混在同一个文件里。它不是 current product docs。
- 证据：`package.json` `description` = `"V0 bootstrap"`，`private: true`，
  `license: "UNLICENSED"`，与 README 一同把仓库描述成内部 bootstrap 阶段。

### `docs/README.md` — **同时承担定义、导航、milestone、日志、rollback history（违反单一职责）**

- 现状：一个文件同时是「整体定义」「文档地图（导航）」「下一步 implementation milestone」
  「更新（2026-08-15…）时间轴追加」。末段有 4 个独立的 `> 更新（2026-08-15）：` 块，其中一个
  是生产 cutover 回滚的详细内部记录（ROLLED_BACK、launchd、`~/.agent-core/scheduler/jobs.json`）。
- 分类：**混合体 / 违反单一 authority**。它是「第二个产品 README」，并要求读它来获知当前状态。
- 它否定了 `CAPABILITY_MATRIX.md` 的「单一事实源」声明（见 2.3）。

### `docs/AGENT_CORE_PRODUCT_ARCHITECTURE_V1.md` — **冻结草案（docs-only）；不代表 current merged**

- 现状：标注「状态：冻结草案（docs-only）· 基线：`69273a9`（Integration V1 已合并）」。
  但 current main 是 `bfe7491`（DELIVERY_PIPELINE_INTEGRATION_V0），**基线已落后**。该文档是
  一份「目标架构」冻结草案（描述 Product Concepts、分层、所有权边界、FROZEN），混有「Phase 3+」
  规划与 OPEN 项。
- 分类：**架构草案 / ACCEPTED_BUT_UNMERGED 级别的目标态**。不是 current merged 事实。
- **导航孤儿**：`docs/README.md` 与 root `README.md` 均未链接到它（三者只互相引用）。

### `docs/AGENT_CORE_COMPONENT_MAP_V1.md` — **冻结草案（docs-only）**

- 现状：ADOPT/ADAPT/BUILD/DEFER 组件矩阵；含「Session V1 实验结论」与「禁止出现的组件名」。
  大量「（已完成）」「（并行开发中）」「Phase N」「OPEN」等混合了已做/未做的事实与规划。
- 分类：**架构草案 / ACCEPTED_BUT_UNMERGED 级别**。有真实当前成分，但也有规划成分；**导航孤儿**。

### `docs/AGENT_CORE_ROADMAP_V1.md` — **路线 / 规划文档**

- 现状：Phase 0–7，标 ✅ 的已完成为「当前事实的里程碑」，其余为规划；末尾明确列出与 D-002 的
  **已知契约冲突**（sessionId 全局唯一/ses_ 前缀 vs (agentId, sessionId) 直通 DSH）。
- 分类：**路线规划 + 已完成里程碑记录**。既不是纯 current docs，也不是纯 history。**导航孤儿**。

### `docs/CAPABILITY_MATRIX.md` — **V1 调查收敛记录（历史证据）**

- 现状：五主题并行调查（identity-auth/memory/workspace-files/dashboard/always-on）的收敛结论
  矩阵。`docs/README.md` 称其为「收敛单一事实源」。
- 分类：**历史（acceptance evidence / 调查收敛）**。它回答「V1 时决定做什么」的历史问题，
  **不是**当前产品架构 authority。当前架构已远超矩阵（Registry/Session/Memory/Router/Scheduler/
  Credential Broker/Delivery 已落地）。

### `docs/TRUST-BOUNDARY-REPORT.md` — **信任边界 / 身份伪造调查报告（历史证据·安全价值高）**

- 现状：V1 身份伪造攻击面调查 + 方案 B（每 Agent 独立进程 + process credential）推导 + 旧 Auth
  删除清单。
- 分类：**历史（security investigation evidence）**。价值高、应保留，但它是「（2026-08 时）
  系统如何」的证据，**不是** current security model 文档。

### `docs/decisions/` — **ADR 索引与决策记录（架构决策**，应该保留并清洗**）**

- 现状：`README.md` 索引 + D-001…D-005。`decisions/README.md` 也用了「追加（2026-08-15…）」
  时间轴反模式（D-005 追加第二轮审计 VERDICT）。D-002 标记 `proposed`，但其 Session.id 语义
  已被 `AGENT_CORE_COMPONENT_MAP_V1.md` 新实验证据覆盖（冲突待 reconciliation）。`README.md`
  含有内部领域细节（141 个 enabled job、飞书群）、`MEMORY_V1.md`/`BINDING_AND_SWITCH_V1.md`/
  `SCHEDULER_V1.md` 为 accepted 决策。
- 分类：**decisions（ADR）**。`*_V1.api.json` 为**机器可读契约**。属应保留的决策记录，需要
  D-002 的 reconciliation 记录，并需要把内部运行证据移出 `decisions/README.md`。

### `docs/reports/`（27 个文件，~4,069 行）— **工程 / 验收证据（history）**

- 现状：无 `reports/README.md` 导航。文件是各种模块的实现/验收报告：`bootstrap-v0`、
  `integration-v1`、`product-integration-v1`、`memory-v1`、`agent-registry-v1`、
  `scheduler-replacement-v1`、`scheduler-router-final-integration-v1`、`scheduler-production-
  cutover-closure-v1`、`trusted-credential-*-integration`、`delivery-pipeline-integration-v0`、
  `stock-agent-registry-adoption-v1` 等。内容混合**真实验收证据（测试计数、分支哈希、seam
  细节、KERNEL_CHANGE = NONE）**。
- 分类：**history（acceptance evidence）**。这些不是 current docs。个别早期报告（如
  `integration-v1.md`、`product-integration-v1.md`）夹带「当前架构」描述，迁移时需注意其
  current-truth 描述会随 Current Docs 建立而成为**被取代**的当前态快照。

### `docs/investigations/`（9 个文件，~1,340 行）— **调查证据（history）**

- 现状：无 README 导航。五主题调查 + scheduler-replacement-audit（真实 OpenClaw job 字段）+
  openclaw-scheduler-caller-migration + stock-agent-registry-adoption + agent-core-production-resident。
- 分类：**history（investigation evidence）**。价值高、应保留，但含大量**内部路径/身份泄漏**
  （见 Part F）。

### 缺失 / 缺口

- **无 `LICENSE`**（`license: "UNLICENSED"`）、**无 `CONTRIBUTING`**、**无 `docs/specs/`**、
  **无 `examples/`**、**无 `.github/`**。这些是 open-source/contributor 路径（A3）的事实缺口，
  本 Spec 只登记为 CONTRIBUTING/TargetIA 的目标，不在本轮实施。
- **Source 注释中的 docs 链接存在断裂**（Part I 证据）：`packages/broker/src/*.js`、
  `packages/scheduler/src/*.js`、`packages/agent-router/src/*.js`、`scripts/*.mjs` 引用
  `docs/architecture.md`、`docs/workspace-bootstrap-v0.md`、`docs/process-model-demo-v0.md`、
  `docs/investigations/broker-capability-parity.md` —— 但**这些文件当前都不存在**（MISSING 核查确认）。

## 2.2 已知怀疑的核查结论

| 怀疑 | 核查结论 |
|---|---|
| 1. 根 README 仍带 V0/bootstrap/calculator 时代结构 | **确认**：以 V0/calculator/PR #1/「下一步 Integration V1」开场 |
| 2. docs/README 同时承担定义、导航、milestone、日志、rollback history | **确认**：一个文件全承担，且用 4 个「更新（2026-08-15）:」块堆时间轴 |
| 3. Roadmap / ADR 有 superseded 事实 | **确认**：ROADMAP 明确 D-002 契约被新实验证据覆盖（待 reconciliation）；D-002 为 proposed 但已被实际实现超越（sessionId 直通） |
| 4. reports / investigations 容易被误认为 current architecture | **确认**：无 history marker、无 reports/investigations 导航说明；`docs/README` 把调查收敛（CAPABILITY_MATRIX）称为「单一事实源」，强化了误认 |
| 5. 缺少陌生用户的完整阅读路径 | **确认**：无 Quick Start、无 Installation、无 Contribution；三个「冻结架构」文档导航孤儿；无 LICENSE/CONTRIBUTING |

## 2.3 当前「权威」的真相

- 当前 `docs/README.md` 声称的唯一事实源是 `CAPABILITY_MATRIX.md`，但该矩阵是**历史调查收敛**，
  已无法代表当前 merged code（当前 main 已远超其范围）。
- Current truth 实际散布在**多个没有单一权威声明的混合文档**里（ROADMAP 已完成 Phase、COMPONENT
  MAP 的已落地项、root README 的组件列表），加上 **ACCEPTED_BUT_UNMERGED**（`feat/production-integration-v1`、
  `feat/trusted-credential-broker-v1`、`feat/scheduler-*`、`feat/self-evolution-plugin-experiment-v1`）
  未在 main 上反映。
- 结论：**当前没有一棵可导航的 Current Docs Tree**，也没有「每个主题一个 authority」的约束。

---

# 3. Target Information Architecture（Part C）

以下目录是目标 IA，**作为实现阶段的目标**。本轮只设计，不创建。优先保持目录简单，
**不新增** `misc/`、`internal/`、`legacy2/`、`current-v2/`、`product-v3/` 等模糊层级。

```
README.md                       # 项目入口（Part G）
docs/
  README.md                     # 仅 current documentation index + source-of-truth map

  getting-started/
    quick-start.md              # 5 分钟跑起来
    installation.md             # 安装 + 前置（DSH checkout、凭据）
  concepts/
    agents.md                   # Agent / Session / Binding 概念（A3/A1 概念面）
    sessions-and-bindings.md    # Session identity + Binding 路由
    workspace-and-memory.md     # per-agent workspace / DSH_HOME / memory 布局
  architecture/
    overview.md                 # 当前整体架构 authority（one Agent = one DSH process）
    runtime-boundary.md         # DSH Runtime vs Agent Core 控制面边界
    control-plane.md            # Registry / Router / Process Supervisor / Ownership
  guides/
    deployment.md               # 部署与运行（依赖 launchd/daemon 形态）
    adding-an-agent.md          # 加一个 Agent
    scheduler.md                # Scheduler 使用 / OpenClaw cron 迁移面
    integrations.md             # Feishu / Broker bridge / external systems
    plugins.md                  # Plugin / Bundle / Profile（贡献者扩展路径）
  security/
    security-model.md           # 安全模型 authority（进程边界 / initiator ≠ authorization）
    trusted-control-plane.md    # trusted control plane / Broker credential 绑定
    credentials.md              # credential 模型（process credential、凭据位置）
  reference/
    configuration.md            # 配置 authority
    cli.md                      # install/run/verify agentcore-cron 等脚本面
    filesystem-layout.md        # filesystem / ~/.dsh / workspace 约定
  contributing/
    development.md              # 本地开发 / 如何运行测试
    testing.md                  # 测试与验收驱动约定
    architecture-rules.md       # 边界守则（frozen invariants 的 enforcement）
  decisions/
    README.md                   # ADR 索引（D-001…D-005；D-002 reconciliation）
    *.md                        # 每决策一件（不追加时间轴）
    *.api.json                  # 机器可读契约（保留原路径不变更契约语义）
  history/
    README.md                   # 历史导航 + public-safety disposition 总表
    reports/                    # （从 docs/reports git mv，KEEP 全部）
    investigations/             # （从 docs/investigations git mv，KEEP 全部）
    *.md                        # 降级后的旧 current docs / AGENT_CORE_* / 冻结草案
  specs/                        # 本 Spec 及后续规格
```

设计决策：

- `history/` 收纳一切 engineering evidence（reports + investigations + 冻结草案/旧 current 快照）。
- 根级别除 `README.md` 与 `docs/` 外**不再放顶层 `*.md`**：`CAPABILITY_MATRIX.md`、
  `TRUST-BOUNDARY-REPORT.md`、三个 `AGENT_CORE_*.md` 全部进入 `docs/history/`（或其中可提升为
  current 的部分单独提炼到 `architecture/` / `security/`，见 Migration Map）。
- `docs/README.md` = **仅 index**，不再重复产品事实。
- `docs/reports` / `docs/investigations` 物理移到 `docs/history/` 下；若某个 topic 需要 current
  概括（例如 Scheduler 使用、Deployment），则属于 `guides/`，而非保留在 reports。

---

# 4. Source-of-Truth Policy（Part D）

## 4.1 文档状态模型（文档功能分类）

每篇文档在迁移后必须带一个 `status` 字段（放入 frontmatter 或首个 `>` 引用块）：

| status | 含义 | 维护规则 |
|---|---|---|
| `current` | 当前产品事实 / 架构 / guide authority | 事实改变时**直接改写**本文档，禁止底部追加日期 |
| `historical` | 工程证据 / 历史报告 / 调查 / 旧 current 快照 | **不删可保留**；必须带 `as_of` 与 `superseded_by` |
| `adr` | 不可变决策记录 | 决策被取代时新增 superseding ADR，不改写旧 ADR 决策正文 |
| `generated_evidence` | 由脚本/验收驱动生成的证据 | 保持原样，标注生成来源 |

## 4.2 实现状态（MERGED vs UNMERGED）

Current docs 必须区分「main 已合入并发布」与「已接受但未合并」的事实，且**不得把未合并的事实
描述成 current**：

- **MERGED_CURRENT** = current origin/main（`bfe7491`）已包含并视为发布的事实。
- **ACCEPTED_BUT_UNMERGED** = 已完成开发/审计、尚未 merge main 的即将落地事实（当前：
  `feat/production-integration-v1` → production-runtime + trusted-control-plane-deployment-hardening；
  `feat/trusted-credential-broker-v1`；`feat/scheduler-*` 各线；`feat/self-evolution-plugin-experiment-v1`）。

Current 文档在「未 merge」时如何处理 ACCEPTED_BUT_UNMERGED：

- Current docs 只描述 MERGED_CURRENT。
- ACCEPTED_BUT_UNMERGED 归属一个显式的待落地清单（如 `docs/specs/` 一张指针表或
  `docs/decisions/` 的处于 proposed→accepted 演进中的 ADR），标记 `merged: false`。
- **任何 current 文档不得把未 merge 的组件描述成「当前已经具备」**。

## 4.3 Production Integration merge 后的一次性刷新（而非继续追加日期）

本 Spec 明确规定：**Current Docs 刷新不是追加一条「更新（2026-xx）」备注，而是成文后直接改写
current authority**。当 `feat/production-integration-v1`（含 production-runtime、
trusted-control-plane）merge 后：

1. 执行一次「Current Truth refresh」：改 `docs/architecture/overview.md`、`docs/security/
   security-model.md`、`docs/security/control-plane.md` 中与 production 形态相关的段落，
   **直接改写**，删除任何「待 merge / 未来」措辞。
2. 从 ACCEPTED_BUT_UNMERGED 清单**移除**已 merge 的项，改标 `merged: true / date`。
3. 被这次 merge 取代的旧 current 快照**降级**进 `docs/history/`，带 `superseded_by`。
4. 不允许出现形式：`更新（2026-xx-xx）：...` 追加在某 current authority 底部。

一句话：**Current docs 描述「现在是什么」。时间演化属于 `decisions/`、`history/` 和 git history。**

## 4.4 Current Docs Tree ≠ 巨型 CURRENT_STATE.md

不要设计一个几千行的 `CURRENT_STATE.md`。正确形态是**一棵小的 Current Docs Tree + 每个主题
仅一个 authority**：

| 主题 | 唯一 authority |
|---|---|
| 项目入口 | `README.md` |
| 当前整体架构 | `docs/architecture/overview.md` |
| Agent 概念 | `docs/concepts/agents.md` |
| Session / Binding | `docs/concepts/sessions-and-bindings.md` |
| 安全模型 | `docs/security/security-model.md` |
| 当前部署 | `docs/guides/deployment.md` |
| 当前配置 | `docs/reference/configuration.md` |

`docs/README.md` 只做 **current documentation index**（source-of-truth map），不再重复任何
产品事实，也不再是「第二个产品 README」。

---

# 5. README Structure（Part G）

本轮不写 README 正文，只设计其完整结构。README 的作用是让陌生开发者快速理解产品并开始使用，
**不承担研发时间线 / rollout history / rollback history / 每个 acceptance report / 当前在做哪个
milestone**。

第一屏（`README.md` 首屏）必须回答五个问题：

1. **Agent Core 是什么？**
2. **它解决什么问题？**
3. **为什么不是直接只用 DeepSeek Harness？**
4. **它现在能做到什么、成熟到什么程度？**
5. **我下一步该点哪里 / 怎么最快跑起来？**

目标措辞方向（须按当前真实架构确认，本 Spec 不替代实现阶段措辞核查）：

```
DeepSeek Harness (DSH) = Agent Runtime（通用 agent loop / session / tools / fs / skills / persistence）
Agent Core（= 本仓库）= 在 DSH 之上的长期支撑 Agent 控制面（long-lived Agent control plane）
  —— 负责「员工是谁 / 在哪办公 / 正在和谁聊 / 何时上班 / 如何安全访问外部系统」，
     不重做 DSH 的任何 Runtime 能力。
```

> 说明：当前 `AGENT_CORE_PRODUCT_ARCHITECTURE_V1.md` §0 的一句话总结（「薄组织层：把 DSH
> 通用 Agent 运行时组织成长期存在的数字员工……不重做 DSH 运行时」）与「one Agent = one DSH
> process」是与代码语义一致的、可直接作为 README 措辞基线的来源；但 baseline 落后，实现阶段
> 必须重新核查是否仍是 current merged 事实。

README 建议的完整骨架：

```
# dsh-agent-core
一句话（是什么 + 与 DSH 的边界）          ← Q1, Q3
  徽章位（构建/测试状态占位，不实做）

## 它能做什么（成熟度，只列 merged 事实）  ← Q4
  一条实际链路示例（Feishu → Agent Core → per-agent DSH 进程 → 回复）
  明确「已合入 main」与「ACCEPTED_BUT_UNMERGED」的边界（一句话指针）

## 快速开始（Quick Start）                ← Q5
  node scripts/install-profile.mjs
  node scripts/run.mjs "..." / verify.mjs
  指向 docs/getting-started/quick-start.md

## 文档导航（指向 docs/README.md 的 index）
## 为什么不是直接用 DSH（extend 一句，Q3 细节指向 architecture/overview.md）
## 下一步
  README -> docs/getting-started/quick-start.md（读者）
  README -> docs/architecture/overview.md（贡献者）
```

可选第一屏架构图（本 Spec 只给语义，不生成图）：

```
Feishu / Mobile / Scheduler / API
           │
       Agent Core
           │
one Agent = one DSH process
           │
    Tools / Workspace / Memory
```

第一屏**不要出现**大量 `uid505/502`、Broker RPC、`freshSession`、HCR、historical milestones ——
这些属于 `docs/architecture/` 与 `docs/security/`。

---

# 6. Historical Docs Policy（Part E）

默认**保留**研发 evidence：`reports/`、`investigations/`、experiments、acceptance evidence
均不因过时删除。但历史文档**不能冒充 current truth**。仅移到 `docs/history/` 不够，必须加
**机器可识别的 historical marker**。

## 6.1 Historical Marker（统一 frontmatter）

目标：人类、GitHub Search、Coding Agent 搜到历史报告后，都能明显知道它不是 current truth。
为每个进入 `docs/history/` 的文档在其 frontmatter 顶部注入统一块（首个 `>` 引用块亦可，但
frontmatter 更利于机器解析）：

```markdown
---
status: historical
as_of: <YYYY-MM-DD>
superseded_by: <相对路径，可空>
public: <PUBLIC | PUBLIC_AFTER_SANITIZE | INTERNAL_EVIDENCE>
---

> HISTORICAL ENGINEERING RECORD
>
> This document describes the system as of <as_of>.
> It is **not** current architecture documentation.
>
> Current documentation:
> <link to current authority>
```

要求：

- marker 必须出现在文档**顶部**，作为第一条可读内容（README/浏览渲染与 GitHub search 都能
  最先命中）。
- `superseded_by` 指向 current authority（若存在）；没有对应 current authority 时留空并注明。
- `as_of` 取该文档 baseline/验收日期，不得追溯改写。
- `docs/history/README.md` 提供导航 + 一张 index，标明每篇的 public disposition。

## 6.2 历史类别（Migration Map 中复用）

- `HISTORICAL_REPORT` = 各模块验收/实现报告（全部 KEEP）。
- `HISTORICAL_INVESTIGATION` = 各主题调查（全部 KEEP，但 public 分级见 Part F）。
- `OLD_CURRENT_SNAPSHOT` = 被 Current Docs 取代的旧「当前态」文档（`CAPABILITY_MATRIX`、
  `TRUST-BOUNDARY`、root README 旧态、`docs/README` 旧态、`AGENT_CORE_*` 冻结草案等）。
  其中 current-truth 描述被 Current Docs authority 取代，其「目标/规划」「FROZEN」价值保留。
- `HISTORICAL_CONTRACT` = `*_V1.api.json` 等机器可读契约历史版本（保留即存档，不解释为 current）。

---

# 7. Public Safety Policy（Part F）

在「文档功能分类」之外，独立维度 **PUBLIC / PUBLIC_AFTER_SANITIZE / INTERNAL_EVIDENCE**。

## 7.1 审计结论（真实扫描）

以下类别被**确认含内部/本机细节**，不得作为公开 GitHub 文档原样保留到 `docs/history/`：

- `docs/investigations/stock-agent-registry-adoption-v1.md`：含绝对路径
  `/Users/yanfenma/.openclaw/groups/workspace-oc_0480991b97f1e27c96514ac66b4f122c`、真实
  OpenClaw group id `oc_0480…`、`chat:oc_0480…`、launchd daemon 名
  （`com.openclaw.workflow-dispatcher`、HOME=/Users/yanfenma）。
- `docs/investigations/openclaw-scheduler-caller-migration-v1.md`：含 UID 505 `authsvc`、
  `HOME=/Users/yanfenma`、真实 `oc_*` id、launchctl 运行证据。
- `docs/investigations/scheduler-replacement-audit.md`：真实 141-job 清单字段、`oc_*` 群 id、
  `~/.openclaw/...`。
- `docs/reports/trusted-credential-505-final-acceptance-v2.md`：`/Users/yanfenma/.openclaw/
  credentials/dsh-agent-core/`、`authsvc:authsvc`（uid/gid）。
- `docs/reports/stock-agent-registry-adoption-v1.md`：绝对 workspace 路径、真实 `oc_*`。
- 其余 reports/investigations：以 `~/.agent-core/`、`~/.dsh/`、`~/.openclaw/`、真实群 id、
  内部服务地址、`uid/*` 引用为主的证据文档，均需过 sanitize 或 INTERNAL 判定。

## 7.2 判定规则（只分类，不打印 secret，不修改）

| 级别 | 规则 | 处理建议 |
|---|---|---|
| **PUBLIC** | 不含本机路径、uid/gid、真实 id、凭据位置、内部服务地址、私有 workspace 信息 | 可直接进公开 GitHub `docs/history/` |
| **PUBLIC_AFTER_SANITIZE** | 技术价值高，但含至少一种第 7.1 类信息 | 公开前执行 sanitize：把 `/Users/yanfenma`→`<home>`、`oc_<hex>`→`oc_<redacted>`、UID→`<uid>`、launchd 名→描述化、`~/.openclaw/...`→`~/.agent-core/<redacted>`；sanitize 后重新判 PUBLIC |
| **INTERNAL_EVIDENCE** | 含可落地的真实凭据/内部身份/足以定位内部系统的信息，且 sanitize 会显著损害其证据价值 | **不公开**：留在私有分支/内部归档；在公开 repo 中仅留一条 `INTERNAL_EVIDENCE` 指针（无内容），或整篇不进公开分支 |

公开判定原则：本文档只判断**是否适合作为公开 GitHub 文档**；不打印任何 secret；不修改任何
现有文件；sanitize 是 Future Implementation 的行为。`docs/history/README.md` 必须含
public-safety disposition 总表，让任何浏览者/Agent 一眼知道哪些 history 可公开。

> 安全提示（写入 Spec，指导实现）：INTERNAL_EVIDENCE 判定需 <username+uid+真实群 id+凭据
> 路径+内部服务地址 五元> 任一命中且 sanitize 不充分即 INTERNAL。拿不准时保守判
> PUBLIC_AFTER_SANITIZE 或 INTERNAL，绝不明知带凭据/内部身份却判 PUBLIC。

---

# 8. Migration Map（Part H）

以下为当前全部 docs 的迁移映射。**每行无需逐篇润色**，只给分类、目标动作、authority。用
`history/` 作为 reports/investigations 的落位，keep/replace 规则见 Part I。

默认原则：**HISTORICAL EVIDENCE = KEEP**（不因「过时」删除）；`DELETE_CANDIDATE` 非常保守，
仅用于完全重复/无历史价值/无引用/明确误导，且**本轮不执行删除**。

## 8.1 根级

| 当前路径 | CURRENT_ROLE | TARGET_ROLE | ACTION | TARGET_PATH | STATUS_CLASS | PUBLIC_CLASS | CURRENT_AUTHORITY_IF_SUPERSEDED | LINK_HANDLING |
|---|---|---|---|---|---|---|---|---|
| `README.md` | 混合入口（V0+导航+组件+下一步） | 项目入口（Part G） | **REWRITE** | `README.md`（原路径） | current | PUBLIC | — | 更新内链指向新 IA |
| `docs/README.md` | 定义+导航+milestone+日志 | current documentation index | **REWRITE**（成 index only） | `docs/README.md` | current | PUBLIC | — | 指向新 Current Docs Tree |
| `package.json` | V0 bootstrap 描述 | 身份声明（description/license 开源化） | 建议改（本任务不实施） | 原路径 | current | — | — | — |

## 8.2 docs/ 顶层（旧 current/冻结草案 → 降级或提炼）

| 当前路径 | CURRENT_ROLE | TARGET_ROLE | ACTION | TARGET_PATH | STATUS_CLASS | PUBLIC_CLASS | CURRENT_AUTHORITY_IF_SUPERSEDED | LINK_HANDLING |
|---|---|---|---|---|---|---|---|---|
| `docs/AGENT_CORE_PRODUCT_ARCHITECTURE_V1.md` | 冻结架构草案 | 架构历史快照；若仍有绝对价值可提炼为 `architecture/overview.md` 基线 | **MOVE_TO_HISTORY**（+可提炼） | `docs/history/AGENT_CORE_PRODUCT_ARCHITECTURE_V1.md`（如提炼 → `docs/architecture/overview.md` 直接改写） | historical（superseded_by overview） | PUBLIC_AFTER_SANITIZE | `docs/architecture/overview.md` | 孤儿；建 index 入口 |
| `docs/AGENT_CORE_COMPONENT_MAP_V1.md` | 冻结组件矩阵（ADOPT/ADAPT/BUILD/DEFER） | 组件边界历史快照 | **MOVE_TO_HISTORY** | `docs/history/AGENT_CORE_COMPONENT_MAP_V1.md` | historical | PUBLIC_AFTER_SANITIZE | `docs/architecture/overview.md` / `runtime-boundary.md` | 孤儿；建 index 入口 |
| `docs/AGENT_CORE_ROADMAP_V1.md` | 路线规划+已完成里程碑 | 历史路线（已完成 Phase 可作 history 记录；规划 Phase 但作为 spec 输入） | **MOVE_TO_HISTORY**（+实施时把「已完成 Phase」的里程碑并入 history；纯规划部分不入 current） | `docs/history/AGENT_CORE_ROADMAP_V1.md` | historical | PUBLIC_AFTER_SANITIZE | `docs/architecture/overview.md`（已完成事实）+ current milestone 指针 | 孤儿；建 index 入口 |
| `docs/CAPABILITY_MATRIX.md` | 收敛调查矩阵（自称单一事实源） | 历史调查收敛快照 | **MOVE_TO_HISTORY**（明确其不再代表当前） | `docs/history/CAPABILITY_MATRIX.md` | historical（superseded_by overview） | PUBLIC_AFTER_SANITIZE | `docs/architecture/overview.md` | 更新 docs/README index 指向 |
| `docs/TRUST-BOUNDARY-REPORT.md` | 信任边界/身份伪造调查（方案 B 推导） | 历史安全调查（**提炼** security-model 的 baseline） | **MOVE_TO_HISTORY** + **REWRITE 提炼** → `docs/security/security-model.md` | `docs/history/TRUST-BOUNDARY-REPORT.md` + `docs/security/security-model.md` | historical（+current security） | PUBLIC_AFTER_SANITIZE | `docs/security/security-model.md` | source 注释 + docs/README 链接更新 |

## 8.3 docs/decisions

| 当前路径 | CURRENT_ROLE | ACTION | STATUS_CLASS | PUBLIC_CLASS | LINK_HANDLING |
|---|---|---|---|---|---|
| `docs/decisions/README.md` | ADR 索引 | **REWRITE**：去掉含内部运行证据的时间轴追加块，保留 ADR 索引 + D-002 reconciliation 记录；`history/` value 另走 `docs/history/` | current/adr-index + historical 追加移出 | PUBLIC | 索引指向 decisions/ |
| `docs/decisions/D-00{1..5}.md` + `AGENT_SESSION_CHANNEL_MODEL_V1.api.json` | 决策/契约 | **KEEP_AS_CURRENT**（adr）；记录 D-002 reconciliation；`api.json` 契约语义**不动**（契约变更 ≠ 文档收敛） | adr | PUBLIC | ADR 交叉链接保持 |
| `docs/decisions/DSH_PLUGIN_ADOPTION_V1.md`（未入 main，untracked） | 未合并决策 | 本轮不处理（ACCEPTED_BUT_UNMERGED 收录，不实施） | — | — | — |

## 8.4 docs/reports（27 件 → docs/history/reports，KEEP 全部）

| 当前路径 | STATUS_CLASS | PUBLIC_CLASS（典型） | ACTION | TARGET_PATH |
|---|---|---|---|---|
| `docs/reports/bootstrap-v0.md` | historical | PUBLIC | MOVE_TO_HISTORY | `docs/history/reports/bootstrap-v0.md` |
| `docs/reports/process-model-demo-v0.md` | historical | PUBLIC | MOVE_TO_HISTORY | `.../history/reports/...` |
| `docs/reports/workspace-bootstrap-v0.md` | historical | PUBLIC | MOVE_TO_HISTORY | 同上 |
| `docs/reports/feishu-connector-v0.md` | historical | PUBLIC | MOVE_TO_HISTORY | 同上 |
| `docs/reports/integration-review.md` | historical | PUBLIC_AFTER_SANITIZE | MOVE_TO_HISTORY | 同上 |
| `docs/reports/integration-v1.md` | historical（夹带旧 current 描述→被取代） | PUBLIC_AFTER_SANITIZE | MOVE_TO_HISTORY | 同上 |
| `docs/reports/product-integration-v1.md` | historical（夹带旧 current 描述） | PUBLIC_AFTER_SANITIZE | MOVE_TO_HISTORY | 同上 |
| `docs/reports/agent-registry-v1.md` | historical | PUBLIC | MOVE_TO_HISTORY | 同上 |
| `docs/reports/agent-session-v1.md` | historical | PUBLIC_AFTER_SANITIZE | MOVE_TO_HISTORY | 同上 |
| `docs/reports/agent-router-delivery-v0.md` | historical | PUBLIC | MOVE_TO_HISTORY | 同上 |
| `docs/reports/broker-v1.md` | historical | PUBLIC | MOVE_TO_HISTORY | 同上 |
| `docs/reports/broker-transport-v1.md` | historical | PUBLIC_AFTER_SANITIZE | MOVE_TO_HISTORY | 同上 |
| `docs/reports/memory-v1.md` | historical | PUBLIC | MOVE_TO_HISTORY | 同上 |
| `docs/reports/scheduler-replacement-v1.md` | historical | PUBLIC_AFTER_SANITIZE | MOVE_TO_HISTORY | 同上 |
| `docs/reports/scheduler-router-final-integration-v1.md` | historical | PUBLIC_AFTER_SANITIZE | MOVE_TO_HISTORY | 同上 |
| `docs/reports/scheduler-production-cutover-closure-v1.md` | historical | INTERNAL_EVIDENCE（rollback/launchd/内部） | MOVE_TO_HISTORY（INTERNAL 判级） | 同上 |
| `docs/reports/scheduler-caller-migration-v1.md` 等其余 | historical | 各判 | MOVE_TO_HISTORY | 同上 |
| `docs/reports/trusted-credential-broker-integration-v1.md` | historical | INTERNAL_EVIDENCE（凭据细节） | MOVE_TO_HISTORY（判级） | 同上 |
| `docs/reports/trusted-credential-505-final-acceptance-v2.md` | historical | INTERNAL_EVIDENCE | MOVE_TO_HISTORY（判级） | 同上 |
| `docs/reports/stock-agent-registry-adoption-v1.md` | historical | INTERNAL_EVIDENCE | MOVE_TO_HISTORY（判级） | 同上 |
| `docs/reports/mobile-gate1-v1.md` | historical | PUBLIC | MOVE_TO_HISTORY | 同上 |
| `docs/reports/delivery-pipeline-integration-v0.md` | historical | PUBLIC | MOVE_TO_HISTORY | 同上 |
| `docs/reports/agent-definition-config-v1.md` | historical | PUBLIC | MOVE_TO_HISTORY | 同上 |
| 其余 27 件未逐一列举 | historical | 逐件判 | 默认 MOVE_TO_HISTORY | — |

## 8.5 docs/investigations（9 件 → docs/history/investigations，KEEP 全部）

| 当前路径 | STATUS_CLASS | PUBLIC_CLASS（典型） | ACTION | TARGET_PATH |
|---|---|---|---|---|
| `docs/investigations/identity-auth.md` | historical | PUBLIC_AFTER_SANITIZE | MOVE_TO_HISTORY | `.../history/investigations/...` |
| `docs/investigations/memory.md` | historical | PUBLIC | MOVE_TO_HISTORY | 同上 |
| `docs/investigations/workspace-files.md` | historical | PUBLIC_AFTER_SANITIZE | MOVE_TO_HISTORY | 同上 |
| `docs/investigations/dashboard.md` | historical | PUBLIC_AFTER_SANITIZE | MOVE_TO_HISTORY | 同上 |
| `docs/investigations/always-on.md` | historical | PUBLIC | MOVE_TO_HISTORY | 同上 |
| `docs/investigations/scheduler-replacement-audit.md` | historical | PUBLIC_AFTER_SANITIZE（141-job/oc_*） | MOVE_TO_HISTORY | 同上 |
| `docs/investigations/openclaw-scheduler-caller-migration-v1.md` | historical | INTERNAL_EVIDENCE（UID/路径/launchd） | MOVE_TO_HISTORY（判级） | 同上 |
| `docs/investigations/stock-agent-registry-adoption-v1.md` | historical | INTERNAL_EVIDENCE | MOVE_TO_HISTORY（判级） | 同上 |
| `docs/investigations/agent-core-production-resident-v1.md` | historical | PUBLIC_AFTER_SANITIZE | MOVE_TO_HISTORY | 同上 |

## 8.6 关于 DELETE_CANDIDATE

默认 KEEP。仅有以下情形可列为 DELETE_CANDIDATE（保守、需实施时逐件复核、且在实施阶段只记录不删除）：

- 完全重复且无独立引用。
- 无任何引用、无历史价值。
- 明确误导且无证据价值。

就当前扫描，**无任何文件落入强 DELETE_CANDIDATE**（全部 reports/investigations 均有证据价值，
root `README.md` 价值在新入口重写而非删除）。DELETE_CANDIDATE 是「未来可能」，本轮不执行。

## 8.7 Source 注释中的 docs 链接（迁移时处理）

`packages/broker/src/*.js`、`packages/scheduler/src/*.js`、`packages/agent-router/src/process.js`、
`packages/workspace-bootstrap/src/*.js`、`scripts/*.mjs` 大量引用 evidence 路径。目标：

- 指向 `docs/investigations/*` / `docs/reports/*` 的 evidence 链接 → 迁移后指向 `docs/history/**`
  对应路径（keep 语义）。**（注意：`RUNTIME_CODE_CHANGE` 指产品行为，改注释路径不属于产品代码
  变更；但本任务不实施任何修改，仅在 Migration Map 登记 LINK_HANDLING=update-in-source-comments。）**
- 指向已不存在的 `docs/architecture.md`、`docs/workspace-bootstrap-v0.md`、
  `docs/process-model-demo-v0.md`、`docs/investigations/broker-capability-parity.md` → 标记
  `BROKEN_LINK`，转 `docs/history/`（若无对应历史则移除注释引用）。
- `packages/scheduler/fixtures/openclaw-jobs-enabled.json` 中的 `docs/*.md` 为 **运行数据内容**
  （不是文档链接），**不改**。

---

# 9. Link Migration Policy（Part I）

所有旧链接迁移后必须有明确处置（Acceptance 要求）。对每种情形定义：

| 情形 | LINK_HANDLING |
|---|---|
| 保留路径（current docs 不动） | `keep path` |
| 移动 + 重定向/index 指针 | `move + redirect/index pointer`：优先用相对路径更新；对 GitHub 站外旧链，`docs/history/**` 提供 `superseded_by` 指针 + `docs/README.md` / `docs/history/README.md` 建立 index |
| 替换引用 | `replace references`：current 引用 → 新 authority |
| 历史墓碑 | `historical tombstone`：`docs/history/**` 每篇放 frontmatter（status: historical / superseded_by / as_of），链接目标语义被 tombstone 取代 |
| 仅当无有用历史才删 | `delete only when no useful history`（当前无此情形） |

特别处理：

- **README links**：root README 内链全部指向新 Current Docs Tree + `docs/getting-started/quick-start.md`。
- **docs/README links**：作为 index，全部指向 Current Docs Tree + history index；不再指回时间轴。
- **ADR cross-links**：`decisions/README.md` 与各 ADR 保持；D-002 reconciliation 记录维护；
  被取代 ADR 不得被改写为 current（用 superseding ADR 表达）。
- **report → decision links**：reports 内指向 decisions 的相对路径（如 `../decisions/...`）迁移到
  `docs/history/` 后**需重写相对路径**（`../../decisions/...`），由实现阶段统一脚本处理。
- **source comments 中的 docs links**：见 §8.7，迁移后批量重写或移除断裂引用（实现阶段；不属于产品行为变更）。
- **机器可读契约**：`AGENT_SESSION_CHANNEL_MODEL_V1.api.json` 路径保持或注明版本；契约语义变更必须走独立
  契约 revision PR，**不是**文档收敛范围。

实施工具建议：一次性脚本（`node scripts/<link-migration>.mjs`）扫描全部 `.md` 与 source 注释，
产出断链报告 + 按规则重写，dry-run 默认。

---

# 10. User Journeys（Part J）

陌生用户推荐阅读路径（不允许正常 Journey 经过 `reports/`、`investigations/`、`historical
acceptance logs`）。

- **Journey 1 — “我第一次看到 Agent Core”**  
  `README.md` → `docs/getting-started/quick-start.md` → `docs/concepts/agents.md`
  （+ `concepts/sessions-and-bindings.md` 视需要）

- **Journey 2 — “我要部署”**  
  `README.md` → `docs/getting-started/installation.md` → `docs/reference/configuration.md`
  → `docs/guides/deployment.md` → `docs/security/security-model.md`

- **Journey 3 — “我要开发插件”**  
  `docs/architecture/overview.md` → `docs/architecture/runtime-boundary.md` →
  `docs/guides/plugins.md`（Plugin/Bundle/Profile）→ `docs/guides/integrations.md` →
  `docs/contributing/development.md` → `docs/common examples/`（若建）

- **Journey 4 — “我要理解设计为什么这样”**  
  `docs/architecture/overview.md` → `docs/security/security-model.md` →
  `docs/security/trusted-control-plane.md` → `docs/decisions/README.md`（ADR）

---

# 11. Implementation Plan（Part K）

不设计「一次性整理所有文档」的大爆炸迁移。分阶段，先建新房再搬旧家具。**本 Spec 不实施**。

## Phase 1 — 建立 Current Truth（首要）

目标：新用户立刻拥有一条不经过历史 reports 的阅读路径。

- root `README.md` → 重写为新入口（Part G）。
- `docs/README.md` → 重写为 index only。
- `docs/getting-started/quick-start.md` + `docs/architecture/overview.md` →
  current truth 基线（措辞按 MERGED_CURRENT 核查，引用 `AGENT_CORE_PRODUCT_ARCHITECTURE` 已完结事实）。
- `docs/concepts/agents.md` + `sessions-and-bindings.md`（Agent/Session/Binding authority）。
- `docs/security/security-model.md`（来自 TRUST-BOUNDARY 提炼）。
- 验收：陌生用户从 README 到理解架构，不读任何 V0/V1 report（Acceptance 1）。

## Phase 2 — 用户 / 贡献者路径

- `docs/getting-started/installation.md`、`docs/reference/configuration.md`、
  `docs/guides/deployment.md`、`docs/guides/adding-an-agent.md`、`docs/guides/scheduler.md`、
  `docs/guides/integrations.md`、`docs/guides/plugins.md`、`docs/contributing/*`。
- `docs/architecture/runtime-boundary.md` + `control-plane.md`。
- 验收：A2/A3 Journey 成立（Acceptance 9、新的 Quick Start、部署用户不读 evidence）。

## Phase 3 — History Convergence

- `docs/reports/*` → `docs/history/reports/*`、`docs/investigations/*` → `docs/history/investigations/*`
  （`git mv` + marker + `superseded_by` + public marker）。
- `CAPABILITY_MATRIX` / `TRUST-BOUNDARY` / `AGENT_CORE_*` 降级进 `docs/history/`；提炼出的 current
  authority 保留在 `architecture/` / `security/`。
- 旧 current docs 降级、link migration（脚本）、public sanitization。
- `docs/history/` 建 README + public-safety disposition 总表。
- 验收：Acceptance 3/7/10。

## 收尾（不属于本 X-phase，仅登记）

- Production Integration merge 后的一次性 Current Truth refresh（见 §4.3），不本分支执行。

测试/门禁：每阶段以「陌生用户 Journey 可走通 + 无断链」为门禁；Phase 1 与 Phase 2 之间
`git mv docs/*` 之前先确认 README 已可导航。

---

# 12. Acceptance Criteria（Part M）

未来 Implementation 必须满足：

1. 陌生用户从 README 到成功理解架构，不需要阅读任何 V0/V1 report。
2. 每个 current topic 只有一个明确 authority（§4.4 map）。
3. 历史报告不会被导航或机器检索轻易误认为 current architecture（frontmatter historical marker）。
4. README 不再把已完成 milestone 描述成「下一步」。
5. Current docs 与当前 merged（main）代码语义一致（措辞不含 ACCEPTED_BUT_UNMERGED 成「当前」）。
6. ACCEPTED_BUT_UNMERGED 能被追踪，但不被提前描述成 merged/current（§4.2）。
7. 所有旧链接都有明确 migration handling（§9）。
8. 新用户有明确 Quick Start。
9. 普通部署用户不需要阅读 engineering evidence。
10. 开源前 historical/evidence docs 有明确 public-safety disposition（§7 / `docs/history/README.md`）。
11. README 不承担工程时间线。
12. `docs/README.md` 只承担导航和 source-of-truth index，不成为第二个产品 README。

---

# 13. Non-Goals / Explicit Prohibitions（Part L）

**明确禁止**：

- 逐篇重写所有 reports。
- 逐篇把旧 ADR 改得像 current。
- 为了兼容旧链接保留多个 current truth（一个主题一个 authority）。
- 把研发 milestones 搬进 README。
- 把所有内部 runbook 直接公开为用户指南（需 public 分级）。
- 因为文件名有 V0/V1 就自动删除。
- 为 docs convergence 修改产品代码（`RUNTIME_CODE_CHANGE = NONE`）。
- 重新设计 Agent Core architecture（`AGENT_DEFINITION_CHANGE = NONE`、
  `PRODUCTION_INTEGRATION_CHANGE = NONE`、`KERNEL_CHANGE = NONE`）。

原则重申：**History 可以不漂亮。Current Docs 必须干净。**

> 注：修改 source 注释中的 docs 链接路径（§8.7/§9）属于**文档链接维护**，不属于产品行为变更，
> 但本任务（convergence 设计轮）不实施任何此类修改。

---

# 14. Open Questions

1. **D-002 Session.id 契约 reconciliation**：`(agentId, sessionId)` 直通 DSH 与 D-002 的
   「全局唯一 / ses_ 前缀」冲突已登记。Current Docs（`concepts/sessions-and-bindings.md`）应以
   哪个为准？——建议以当前 merged 代码语义（直通 DSH）为 current，D-002 更新走独立 ADR 修订。
2. **`docs/reports/product-integration-v1.md` / `integration-v1.md` 的历史 current-truth 快照**
   是否需要在 Current Docs 中重建等价说明？——建议 current authority 独立重述，历史报告只留证据。
3. **`one Agent = one DSH process` 是否是当前 merged 全量事实**？——`AGENT_CORE_PRODUCT_ARCHITECTURE`
   以此为主张，但 baseline 落后；需在 Phase 1 措辞核查中确认为 MERGED_CURRENT（当前 main 的
   product-integration 已落地该形态，倾向 yes）。
4. **launchd/daemon 部署形态**属 Open 项：Current Docs 的 `deployment.md` 应描述「当前可行最小部署」
   （含 ACCEPTED_BUT_UNMERGED 的 trusted control plane）还是等 merge？——建议 current 只描述 merged。
5. **`docs/common examples/`（候选 `examples/`）**是否纳入 TargetIA？——本 Spec 未强制；实施时可加。

---

# 15. 结论 / 最终报告字段

```
OPEN_SOURCE_DOCS_CONVERGENCE_V1_SPEC = PASS

BASE_MAIN = bfe7491 (origin/main, DELIVERY_PIPELINE_INTEGRATION_V0)
SPEC_HEAD = docs/open-source-docs-convergence-v1 @ 独立 worktree（未 merge main）

CURRENT_DOCS_DIAGNOSIS =
    根 README 为 V0/bootstrap/calculator 时代结构；
    docs/README 一身四职 + 4 个追加时间轴块；
    三个冻结架构 doc（AGENT_CORE_*）为导航孤儿且 baseline 落后；
    CAPABILITY_MATRIX 自称单一事实源但实为历史调查收敛；
    reports(27)/investigations(9) 无 history marker 易误认 current，
    且含 /Users/...、UID、oc_*、launchd、凭据路径等内部信息；
    无 LICENSE/CONTRIBUTING/specs/examples；
    source 注释存在 docs/ 断链（architecture.md 等 4 处 MISSING）。

TARGET_INFORMATION_ARCHITECTURE =
    根 README（入口）+ docs/{README,getting-started/concepts/architecture/guides/
    security/reference/contributing/decisions/history/specs}；单 authority per topic。
    见 §3。

SOURCE_OF_TRUTH_MODEL =
    status(current|historical|adr|generated_evidence) × merged(MERGED_CURRENT|
    ACCEPTED_BUT_UNMERGED)；Current Docs Tree 而非巨型文件；Production merge 后
    一次性刷新 current authority，禁止底部追加日期。见 §4。

README_STRUCTURE =
    五问首屏（是什么/解决什么/为何不直接用 DSH/成熟度/怎么跑）+
    DSH=Runtime vs Agent Core=控制面 边界 + 简单架构图 + 指向 quick-start。
    不做时间线。见 §5。

MIGRATION_SCOPE =
    仅新增 docs/specs/OPEN_SOURCE_DOCS_CONVERGENCE_V1.md；不实施/不修改任何现有
    文档与代码；reports/investigations 默认 KEEP 进 docs/history/。见 §8。

HISTORICAL_DOC_POLICY =
    默认保留；docs/history/ + frontmatter(status:historical/as_of/superseded_by/public)
    + 顶部 HISTORICAL ENGINEERING RECORD；不冒充 current。见 §6。

PUBLIC_SAFETY_POLICY =
    new PUBLIC/PUBLIC_AFTER_SANITIZE/INTERNAL_EVIDENCE 维度；审计确认 reports/
    investigations 含本机路径/uid/真实 id/凭据；只分类不打印不修改。见 §7。

USER_JOURNEYS =
    J1 首看 / J2 部署 / J3 开发插件 / J4 理解设计；均不经过 reports/investigations/
    history。见 §10。

LINK_MIGRATION_POLICY =
    keep path / move+redirect / replace / historical tombstone / delete-only-if-no-value；
    覆盖 README、docs/README、ADR cross-link、report→decision、source 注释 docs 链接、
    机器可读契约。见 §9。

ACCEPTANCE_CRITERIA =
    12 条（见 §12），核心：无 report 阅读路径、单 authority、历史不可冒充、README
    不承担时间线、ACCEPTED_BUT_UNMERGED 可追踪、旧链有处置、public-safety disposition。

OPEN_QUESTIONS =
    见 §14（D-002 reconciliation、product-integration 快照、one-process fact 核查、
    deployment 形态、examples/ 是否纳入）。

IMPLEMENTATION_PLAN =
    Phase 1 Current Truth → Phase 2 用户/贡献者路径 → Phase 3 History Convergence；
    先建新房再搬旧家具；本 Spec 不实施。见 §11。

RUNTIME_CODE_CHANGE = NONE
ROUTER_CHANGE = NONE
PRODUCTION_INTEGRATION_CHANGE = NONE
KERNEL_CHANGE = NONE
```
