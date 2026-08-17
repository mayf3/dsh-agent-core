---
spec_id: AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1
status: accepted
amendment: SPEC_EVOLUTION_AND_SIMPLICITY_GOVERNANCE_V1 (2026-08-17) — spec evolution lifecycle / decision-conflict disposition / one primary governing spec / patch-stack limit / simplicity gate / reviewer simplicity duty / current-truth separation (§6–§14)
---

# Agent Repo Knowledge Governance V1

> 性质：**Spec（本轮只设计，不实施）** · 日期：2026-08-16 · Amendment：2026-08-17
> 仓库：`mayf3/dsh-agent-core`
> 角色：Repo Governance / Developer Experience Agent
>
> 本 Spec 与 `SPEC_GOVERNANCE_AND_MERGE_GATE_V1`（Spec as merge authority）**对齐且互补**：
> 那份 Spec 控制「什么是 merge authority gate」，本 Spec 控制「Knowledge 是什么、由谁拥有、
> Agent 在改第一行代码前如何证明自己理解 repository intent」。
>
> 首轮（2026-08-16）只新增 `docs/specs/AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1.md`，不创建
> `AGENTS.md`、不创建 `.agents/**`、不改 `docs/investigations/**`、不改 `docs/decisions/**`、
> 不改任何既有 Spec、不改任何产品代码。
>
> **Amendment（2026-08-17 · SPEC_EVOLUTION_AND_SIMPLICITY_GOVERNANCE_V1）**：在不动摇三权威
> 冻结模型（Investigation / Spec / Decision）与不创建平行治理 Spec 的前提下，冻结 Spec 演化
> 生命周期（同文件演化 / AMEND / SUPERSEDE）、Decision 冲突处置、唯一 Primary Governing Spec、
> Patch Stack 上限、Simplicity Gate、Reviewer simplicity duty、Current Truth 与 Spec History
> 分离（§6–§14）。本轮除本文件整合改写与 `.agents/` 机械指针/模板字段同步外，**不改任何
> 产品 Spec / 产品代码 / runtime**。

---

## 0. North Star

Coding Agent 已被证实在「实现」上非常擅长。现在真正需要保护的是 **repository intent**——让任何
未来进入仓库的 Coding Agent **不依赖人的聊天记忆**，仅凭仓库内 artifact 就能回答八个问题：

1. 这个问题以前有没有研究过？
2. 已经有哪些 evidence？
3. 哪些方案讨论过？
4. 哪些方案被明确拒绝？为什么？
5. 当前 governing decision / Spec 是什么？
6. 当前允许实现什么？
7. 哪些 boundary 明确不能碰？
8. 如果新 evidence 推翻旧方案，应该更新什么，而不是直接改代码？

期望的循环：

```text
Investigate
  → Record evidence
  → Compare alternatives
  → Freeze decision / Spec
  → Implement
  → Review against Spec
  → Preserve outcome
```

Repository = Agent 的**长期组织记忆**。代码说明「改了什么」，artifact 说明「为什么、以及我们放弃了
什么」。

> **Amendment（2026-08-17）补充的保护目标**：在「知道什么 / 坚持什么 / 允许改什么」之外，追加
> 两条——**Current Truth 必须单点可读**（不要求读者自己 merge 历史 artifact 链，§14）与
> **长期模型必须简单**（迁移/兼容复杂度不得压过目标模型，§12）。

---

## 1. CURRENT_REPO_KNOWLEDGE_MODEL（真实调查）

> 以下全部基于读取当前 origin/main（`bfe74915`）worktree，不假定已有结构。

| 问题 | 现状 |
|---|---|
| 当前 Investigation 在哪里？ | `docs/investigations/`（9 篇：identity-auth / memory / workspace-files / dashboard / always-on / scheduler-replacement-audit / openclaw-scheduler-caller-migration / stock-agent-registry-adoption / agent-core-production-resident） |
| 当前 Spec 在哪里？ | **main 上没有 `docs/specs/`**。`docs/specs/SPEC_GOVERNANCE_AND_MERGE_GATE_V1.md` 只存在于未 merge 的 `docs/spec-governance-and-merge-gate-v1` 分支 |
| 当前长期 architecture decision 在哪里？ | `docs/decisions/`（D-001…D-005，`README.md` 索引；生命周期为文件内 `状态: proposed/acceptedsuperseded-by-D-<NNN>`，无 `docs/decisions/Spec` 概念） |
| rejected knowledge 如何保存？ | **没有独立保存机制**。被否的替代方案散落在 `docs/decisions/*` 的「替代方案」段与 `docs/investigations/*` 的结论里；没有统一「为什么拒绝 / 什么会重新打开」记录 |
| 新 Coding Agent 现在从哪里知道这些？ | **只能靠人 handoff**（聊天记忆）或主动读 `docs/README.md`。仓库内**没有 `AGENTS.md`、没有 `.agents/`**（`find` 确认） |
| 是否存在重复 authority？ | **是**。`docs/README.md` 声称 `CAPABILITY_MATRIX.md` 是「收敛单一事实源」，但同时存在 3 个用 `AGENT_CORE_*_V1` 命名的「冻结草案」架构/路线/组件映射文档（且它们**不在** `docs/README.md` 导航里，是导航孤儿），其「当前架构」描述与 roadmap、component map、root README 互相重叠、基线互相落后 |
| 是否大量依赖聊天/人类 handoff？ | **是**。没有 bootstrap，没有 preflight，没有 ownership。每个新 Agent 都要靠人把「该读什么、谁拥有这个问题」再说一遍 |

**结论**：当前知识**可检索但不可发现、不可裁决**——有 reports/investigations/decisions 三堆原始材料，
但没有「谁拥有这个问题」的索引，没有 preflight，没有 rejected 语义，且三份 `AGENT_CORE_*` 冻结草案
存在重复/过期的 current-truth 表述而无人标识它们不是 current。

---

## 2. DEEPSEEK_HARNESS_REFERENCE_MODEL（真实调查）

> 以下基于官方 `deepseek-ai/deepseek-harness` 仓库当前 `.agents/notes/` 结构与原文核查。
> 不机械复制其目录；只提炼可迁移的原则。

官方仓库 `deepseek-ai/deepseek-harness` 当前确实存在 `.agents/notes/` 治理体系，结构如下（真实核查）：

```
.agents/
  notes/
    README.md                      # Agent Notes 的「写入规范 + 生命周期 + 格式」
    AGENTS.md                      # 极小 standing order（指向 README + 触发 supersession 检查）
    proposed/{architecture,feature,process,simplification,testing}/yyyy-mm-dd-title[.zh].md
    implemented/{architecture,bug-fix,feature,process,simplification,testing}/...
    rejected/{feature,simplification}/...
    archived/{architecture,bug-fix,feature,process,simplification,testing}/  (+ manifest.json)
  skills/                          # dsh-archive-agent-notes 等工作流 skill
```

任务点名的四个文件**实际存在**（核查确认）：

- `.agents/notes/implemented/process/2026-07-19-require-agent-notes-for-non-trivial-changes.md`
- `.agents/notes/implemented/process/2026-07-05-uniform-agent-note-format.md`
- `.agents/notes/implemented/process/2026-06-20-agent-note-classification.md`
- `.agents/notes/implemented/process/2026-06-11-quality-gates.md`

### 2.1 真实路径的目录形态

- **作用**：Agent Note 是「讨论/决定与代码和普通 docs 无法承载的部分——why、放弃了什么」的
  repository-persistent 设计文档。
- **两个坐标都编码在路径**：`{lifecycle}/{class}/yyyy-mm-dd-title.md`。
  - Lifecycle（顶层目录）= 状态且随状态移动：`proposed/` → `implemented/` →（`rejected/` 或
    `archived/`）。`Status:` 头与所在目录一致。
  - Class（嵌套目录）= 类别，封闭集合：`feature / bug-fix / simplification / architecture / process / testing`。
- **不建中央 INDEX**：官方明确有一套 `2026-07-19-remove-generated-agent-note-index` Note 支持
  「活动树本身即工作清单，不追加 INDEX」。

### 2.2 关键原则（核查自原文）

1. **non-trivial change 必须留长期 rationale**：`require-agent-notes-for-non-trivial-changes` 规定
   每个 non-trivial change 在同一 PR 至少新增/更新一个 Agent Note。更新已有 owner note 即满足。
2. **Problem 与 solution 分离**：每篇 Note 以 `## Problem` 开头，动机可独立于方案而立（"written to
   stand without the solution"）。
3. **alternatives considered 被保存且强制**：每篇必有 `## Alternatives considered`，逐条记录「为什么
   输」。出现前（pre-format）才允许占位注释。
4. **rejected proposal 保存拒绝原因**：rejected Note 冻结提案 + `Status: rejected — <why，一行>`，
   拒绝理由就是读者来找的事实；类如 `## What we give up` 补充代价（构成「什么会重新打开」）。
5. **existing decision owner 优先复用**：`updating the note that already owns the decision satisfies
   the rule`；不制造重复 Note。
6. **mechanical promises → machine gate；semantic judgment → review**：`quality-gates` 规定「每个机械可
   检查的 AGENTS.md promise 都有退出非零的命令，CI 跑穷尽集」；但语义 trivial/non-trivial **不由 CI
   分类**，交给 review。
7. **repository = Agent 的长期组织记忆**：Note 会随代码移动/改名而**更新为当前事实**（facts only），
   会因 supersede 而 consolidate/delete（保留独有 rationale）。

### 2.3 关键差异（不可机械照搬）

- DeepSeek 的 Agent Note **主要是决策记忆**，且在**同一 PR** 内创建首篇 note；而本仓库的
  `SPEC_GOVERNANCE_AND_MERGE_GATE_V1` 声明 Spec **同时是 merge authority**，必须在 Implementation PR
  base 上**已存在 accepted Spec**（G2）。因此本仓库**不能**采用同 PR 自建 governing 的形态。
- DeepSeek 有 `.zh.md` 双语配对 + `archived/` 冻结树 + `scripts/agent-note-tree.ts` 封闭 class 门。
  **本仓库当前没有翻译需求、没有达到需要 frozen archive + manifest 的规模**。任务明确「不机械复制
  DeepSeek 目录」，故这些不采纳。

---

## 3. GAPS（差距分析）

对照 North Star 八个问题 vs 当前模型：

| Gap | 说明 | 本 Spec 的响应 |
|---|---|---|
| G1 无 bootstrap | 无 `AGENTS.md`/`.agents/`，新 Agent 不知道先搜什么 | 设计 `.agents/README.md`（本轮不创建） |
| G2 没有 Spec artifact | main 无 `docs/specs/`；governance Spec 在未 merge 分支 | 承认 `docs/specs/` 为 Spec 唯一 authority（对齐 merge-gate Spec）；本 Spec 是首个实例 |
| G3 rejected 无结构 | 没有存「拒绝 + 为什么 + 什么会重开」 | 冻结 `Rejected Knowledge Policy` |
| G4 重复 authority | 3 份 `AGENT_CORE_*` 冻结草案 + docs/README + CAPABILITY_MATRIX 互相重叠且导航孤儿 | 冻结**文档分类**（§4），确立单 authority 原则；分类与 OPEN_SOURCE_DOCS_CONVERGENCE 兼容 |
| G5 无 ownership | 不回答 WHO OWNS THIS QUESTION | 冻结 `Knowledge Ownership Rule` |
| G6 无 preflight | Agent 不先证明理解即改代码 | 冻结 `DEVELOPMENT_PREFLIGHT` |
| G7 无 review contract | 无「实现是否在 scope 内」的固有检查 | 冻结 `SPEC_COMPLIANCE`（对齐 merge-gate Spec §11） |
| G8 无 NEW_EVIDENCE gate | rejected 可被随口重开 | 冻结 `NEW_EVIDENCE Rule` |

> Amendment（2026-08-17）追加的差距（G9/G10）与响应见 §6–§14：Spec 演化无生命周期规则导致
> patch stack 风险（G9）；Reviewer 无 simplicity duty 导致 migration/recovery 复杂度压过目标
> 模型（G10）。两者都已有仓库内真实案例（§6 / §12 例证）。

---

## 4. Frozen Artifact Model（三个 Artifact）

> 状态不靠目录表达是目标：rejected / superseded / accepted 应是 **artifact 的 metadata（front matter
> status 字段）**，不是为状态建物理目录。目标是减少 Agent 搜索位置；因此本仓库**默认不建
> `docs/rejected/`、`.agents/rejected/`、`graveyard/`**。rejected/superseded 通过 Spec 或 Decision 的
> `status` 字段表达。

冻结三个 Artifact，语义互不混淆：

### A. Investigation — Evidence Authority

- **Authority question**：我们查到了什么？（`What did we find?`）
- **是 Evidence Authority，不是 Implementation Authority**。
- 用于：source investigation、root-cause analysis、benchmark、experiment、architecture exploration、
  external comparison、current-state audit。
- 落位：`docs/investigations/`。
- 最小 contract：

```markdown
## Status          # proposed | accepted-as-evidence | superseded（evidence 本身不 merge gate）
## Problem         # 为什么查
## Evidence        # 查到了什么（含来源/置信度/基线）
## Options considered
## Findings
## Recommendation # 只是建议
## Open questions
## Related         # 相对链接到相关 Spec/Decision/Report
```

> **Investigation PASS ≠ permission to implement。** Investigation 可以给 Recommendation，但不授予
> merge authority。真正的实现许可来自 `status: accepted` 的 Spec。

### B. Spec — Implementation / Change Authority

- **Authority question**：这次允许改变什么？（`What may this change?`）
- 是 **Implementation / Change Authority**，与 `SPEC_GOVERNANCE_AND_MERGE_GATE_V1` 对齐。
- 落位：`docs/specs/<SPEC_ID>.md`。
- 生命周期至少：`draft → accepted → rejected | superseded`（superseded 必须带 `superseded_by:`；
  演化 metadata 与准入由 §6–§8 冻结）。
- 至少保存：

```markdown
## Problem
## Decision / Proposal
## Scope
## Non-Goals / Frozen Boundaries
## Alternatives considered
## Acceptance Criteria
## Risks
## Related investigations
```

- rejected Spec 必须保存：
  - `Rejected because`（为什么拒绝，正文写明，不只写 `status: rejected`）
  - `What would reopen this decision`（什么条件会重新打开）
  - 禁止只有 `status: rejected` 却不知道原因。

### C. Decision — Long-Lived Repository Invariant

- **Authority question**：这个 repository 长期坚持什么？（`What does this repository stand on long-term?`）
- **不为 ADR 制造 ADR。** 如果 accepted Spec 已完整保存某 milestone 的 why/alternatives/consequences/
  boundaries，不重复做 Decision。
- Decision 只用于**跨多个 Spec 长期成立的 repository invariant**，例如：
  - one Agent = one DSH process（进程 = 安全域）
  - product Session = DSH native Session（(agentId, sessionId) 复合身份，不建映射层）
  - Kernel / external Harness boundary（不重做 Runtime；Forum/Workflow/OKR 在外部）
- 落位：`docs/decisions/`（**现有目录已适合承担此职责**——已用 D-001…D-005 的 accepted 状态和
  `superseded-by-D-<NNN>` 语义表达 invariant；本 Spec 不改其内容，只规范化它承载的是「长期 invariant」
  而非「每次变更决策」）。
- Decision 的演化同样适用 §7 AMEND / §8 SUPERSEDE 语义与 metadata；**Spec 与 accepted Decision 的
  冲突处置由 §9 冻结**（改变长期 invariant 的唯一顺序 = Evidence → Decision amendment/supersession
  → governing Spec → Implementation）。

> 三个 Artifact 一句话区分：
> - **Investigation** → 我们知道什么？（Evidence）
> - **Decision** → repo 长期坚持什么？（Invariant）
> - **Spec** → 这次允许改变什么？（Merge authority）
> - **Implementation** → 代码实际做了什么？（PR/code）
> - **Git history** → 什么时候发生的？（Version）

---

## 5. Knowledge Ownership Rule（重点）

Coding Agent 开工前不仅要问「有没有相关文档」，还必须问 **WHO OWNS THIS QUESTION?**。

- 若已有 Spec / Decision 拥有该问题：**REUSE / UPDATE / REFERENCE EXISTING OWNER**。
- **不制造** `XXX_V1` → `XXX_V1_FIX` → `XXX_V1_FIX2` → `XXX_FINAL` → `XXX_REAL_FINAL` 序列。
- 一个 accepted Spec **可以授权**：
  - multiple implementation PRs（同一 frozen milestone 的分段交付）
  - same-scope bug fixes
  - acceptance fixes
  - same milestone integration fixes
- **只有出现新的** capability / architecture / boundary / security semantics / material scope expansion，
  才要求 **new / amended / superseding Spec**。（与 `SPEC_GOVERNANCE_AND_MERGE_GATE_V1` §13 Bug Fix
  Policy 与 §14 Granularity 一致。）

判断路径（简化为可执行分支）：

```text
存在 accepted Spec 拥有该 scope？
  是，且 scope 不变      → REUSE（分段/修复挂同一 Spec）
  是，但需澄清/纠正      → AMEND（独立 Spec amendment PR，先于实现 merge）
  是，但方向实质改变     → SUPERSEDE（新 Spec，旧 Spec 标 superseded + replaced_by）
  否，新 capability      → NEW SPEC
```

> Amendment（2026-08-17）：AMEND / SUPERSEDE 的准入条件与形态由 §6–§8 冻结；与 accepted Decision
> 的冲突处置由 §9 冻结；同主题演化链的层数上限由 §11 冻结。`XXX_V1_FIX_FINAL` 文件序列与正文
> 轮次堆叠（§6）同属被禁止形态。

---

## 6. SAME_SPEC_EVOLUTION_RULE（同文件演化 — 正文即当前真相）

适用所有阶段（proposed / review 与 accepted）的正文维护原则：

- Spec 仍处于 proposed / review、尚未成为历史实施依据时，reviewer fix、clarification、validation
  rule、acceptance correction **优先直接改写同一份 Spec 正文**。accepted Spec 的改写经 §7 AMEND /
  §8 SUPERSEDE 轮次进行——改写同样落在整合后的正文（或 standalone 后继文件）里，**而不是在旧正文
  上叠补丁段**。
- **禁止**为了保存草稿过程在正文不断堆叠：

```text
AMENDMENT 1
REVIEW FIX
AMENDMENT 2
FIX REQUIRED ROUND 3
```

- **Git history 已经负责保存草稿演化**（每个评审轮一个 commit）。
- Spec 正文主要回答「**现在决定了什么**」，而不是完整记录每一轮 reviewer 对话。
- 后续裁决推翻正文既有规则时，必须把该段**改写为当前规则**，被推翻的方案移入
  `Alternatives considered`；**不得**用内嵌「本段已作废 / ⚠️ SUPERSEDED」标记把拼装工作留给
  读者。轮次结论可以保留在 `ReviewDisposition` / 最终报告字段——**结果记录 ≠ 规则堆叠**。

真实例证（两种形态）：

- **正例**：`AGENT_CORE_BINDING_WORKSPACE_V1`（accepted）的产品模型收敛直接整合进同一份文件，
  front matter 以 `amendment:` 标注轮次，正文保持单一最终模型。
- **反例（风险形态，本规则生效后不得重现）**：`FEISHU_WORKSPACE_MEMORY_ALIGNMENT_V1`（未 merge
  分支 `docs/feishu-workspace-memory-alignment-v1-spec`）正文先叠加
  `AMENDMENT — Migration Data Safety Closure（Fix 1–3 + Migration Gate）`，再用
  `⚠️ SUPERSEDED（PRODUCT RULING V2）` 内嵌标记部分推翻——读者必须自己 merge「原 proposal +
  amendment + product ruling」三层才能得到 Current Truth。

---

## 7. AMEND_RULE（修订 — 少用）

只有当以下条件**全部**成立时，才允许 `amends:` / `amendment:`：

1. 新规则只是**小范围 additive change**；
2. 且**必须与原 artifact 一起阅读**才有意义；
3. 且**核心模型完全没变**（ownership / core entity semantics / authority / long-lived invariant
   均未动——触发清单见 §8）。

- **AMEND 必须少用。** 默认优先级：同文件改写（§6）> AMEND > SUPERSEDE；但一旦触发 §8 任一
  条件，AMEND 被禁止，必须 SUPERSEDE。
- metadata：amendment 轮在 front matter 标注 `amendment: <ROUND_NAME>`（跨 artifact 时用
  `amends: <ARTIFACT>`）；原 artifact 的状态与 authority 不变。
- 「小范围 additive / 核心模型未变」是 semantic judgment，属于 Reviewer（§19 分工）。

---

## 8. SUPERSEDE_RULE（替代 — standalone 后继）

如果发生以下任一改变，**不得伪装成 amendment**，必须 SUPERSEDE：

- **ownership 改变**（谁拥有该问题 / 实体）
- **core entity semantics 改变**（实体语义被重定义）
- **authority 改变**（权威边界 / 授予语义改变）
- **long-lived invariant 改变**（跨 Spec 长期不变量改变）

要求：

- 新 artifact 必须 **standalone**：未来 Agent **只读新的 artifact**，就能理解当前模型。
- metadata 至少支持：

```yaml
# 新 artifact
status: accepted
supersedes:
  - OLD_ARTIFACT

# 被替代方
status: superseded
superseded_by: NEW_ARTIFACT
```

- **新日期不自动拥有更高 authority。** authority 来自 accepted 状态与显式 supersedes 链，不来自
  时间先后；Implementation Agent 不得自行按日期裁决新旧（冲突处置见 §9）。

### 业界参考（参考，不机械复制）

- IETF RFC：`Updates` / `Obsoletes`。
- Kubernetes KEP：`replaces` / `superseded-by` / `status: replaced`。
- Python PEP：`Replaces` / `Superseded-By`。
- Rust RFC：proposal history 与 canonical / current documentation 分离。

共同原则：**历史 proposal 可以很多，但 Current Truth 不能要求读者自己 merge patch stack。**

---

## 9. DECISION_CONFLICT_RULE（Spec ↔ Decision 冲突处置）

- **Spec 不得静默违反 accepted Decision。**
- 每个 non-trivial Spec 必须明确：

```text
RELEVANT_DECISIONS =
DECISION_DISPOSITION =
  <DECISION_ID>: PRESERVE | AMEND | SUPERSEDE
```

- 若要改变长期 invariant，唯一合法顺序：

```text
Evidence（Investigation）
  → Decision amendment / supersession
  → governing Spec
  → Implementation
```

- **不允许 Implementation Agent 自己解释哪个更「新」。** 语义冲突未关闭 = `UNRESOLVED_CONFLICTS`，
  实现许可为 STOP（§10）。

真实代价例证：`MEMORY_V1`（accepted Decision：memory 按 agent 定位于其 workspace，
agentId→workspace 映射唯一 owner）与 `AGENT_CORE_BINDING_WORKSPACE_V1`（accepted Spec：Binding
决定 effective workspace）之间出现语义位移且无显式 disposition，最终需要额外一篇
`FEISHU_WORKSPACE_MEMORY_ALIGNMENT_V1` 才把 memory ownership（WORKSPACE_LOCAL）说清——这是
本规则要前置拦截的形态。

---

## 10. PRIMARY_GOVERNING_SPEC_RULE（唯一主治理 Spec）

每个 Implementation：

```text
PRIMARY_GOVERNING_SPEC = exactly one
```

- 可以有 `RELATED_SPECS`、`RELEVANT_INVESTIGATIONS`、`INHERITED_DECISIONS`，但**实现许可只有
  一个 primary authority**。
- Development Preflight 必须能回答（模板见 §17）：

```text
PRIMARY_GOVERNING_SPEC =
INHERITED_DECISIONS =
RELATED_SPECS =
UNRESOLVED_CONFLICTS = NONE
```

- 若 `UNRESOLVED_CONFLICTS != NONE` → **IMPLEMENTATION = STOP**。

---

## 11. PATCH_STACK_LIMIT（补丁栈上限与 consolidation review）

冻结明确规则：

- 理解某主题的 **Current Truth** 需要组合**超过 2 层** amendment / supersession / clarification
  （即 base artifact 之外还必须顺序阅读 ≥3 件）时，**必须触发 consolidation review**。
- 默认动作：

```text
write a standalone consolidated Decision / Spec
  → supersede 整个 patch stack
```

- 旧 artifact 保留历史价值（superseded 链可追溯），但**不再要求未来 Agent 阅读**。
- 层数计数与「是否已到第 3 层」是 semantic judgment，属于 Reviewer；机械计数 DEFERRED（§19），
  本轮不建 resolver、不建 CI。

---

## 12. SIMPLICITY_GATE（简单性闸门）

所有新 Spec / Reviewer 在进入 Implementation 前必须回答：

```text
LONG_TERM_MODEL =
```

并要求长期模型尽量能在 **10 行以内**讲清楚。然后逐项检查：

1. Migration / compatibility 是否进入了长期 runtime？
2. 一次性旧数据问题能否 **archive / reset / explicit cutover**，而不是建设长期 compatibility？
3. 是否正在为了**没有 production evidence** 的 corner case 建 recovery framework？
4. Migration logic 是否比 target model 本身更复杂？
5. Reviewer 是否考虑过「**直接封存/丢弃旧状态**」这个替代方案？

判定：

```text
若 MIGRATION_COMPLEXITY > TARGET_MODEL_COMPLEXITY
  → 默认 DESIGN_SMELL = YES
  → 必须重新评估，而不是继续补 migration
```

真实例证（本 Gate 的动机）：`FEISHU_WORKSPACE_MEMORY_ALIGNMENT_V1` 的长期模型本只有
`Session.header.cwd → Workspace → Workspace/MEMORY.md` 一条链；reviewer 轮随后引入 provenance
classification、quarantine、pending restore、per-conversation migration archive、cron/p2p/group
历史分类、migration gates、rollback machinery。Product Owner 最终裁决：**old mixed memory =
archive only；new Workspace starts clean**——迁移/恢复框架的复杂度远超目标模型本身。此类成本
必须由本 Gate 在进入 Implementation 前拦截。

---

## 13. REVIEWER_STANDING_ORDER（Reviewer 同时保护 correctness + simplicity）

Reviewer 的职责**不是**「尽可能把所有 corner case 都变成设计」，而是同时保护：

```text
correctness + simplicity
```

- 对每个明显的 compatibility / migration proposal，Reviewer 至少回答：

```text
CAN_OLD_STATE_BE_ARCHIVED_OR_RESET = YES / NO
```

- 若 **NO**，必须给出**真实 evidence**（生产数据、外部约束、合规要求等），不得以假想的
  corner case 充当。
- Reviewer 对 §12 五问负质询责任；对 §6 正文形态（是否又开始堆轮次块）负监督责任。

---

## 14. CURRENT_TRUTH_MODEL（Current Truth 与 Spec History 分离）

明确吸收 Rust / RFC 类经验（proposal history 与 canonical documentation 分离）：

- **Spec = 为什么 / 允许这次改变什么。**
- **Decision / current docs = 今天系统到底是什么。**

要求：

- **不**要求最终用户或未来 Coding Agent「阅读所有历史 Spec → 自己推导 current architecture」。
- 当一个主题**稳定**后，应有 **standalone Current Decision / Current Docs**（可经 §11
  consolidation review 产生）。
- Current Truth 的可读性验收：单读一件 artifact 即可回答「今天的模型是什么」，无需拼装。

---

## 15. Rejected Knowledge Policy

被认真调查过、未来 Agent 很可能**重新提出的错误方向**：**KEEP**。

至少记录：

```text
Problem
Proposal            # 曾被提出/实现的方向
Evidence            # 调查时的证据与基线
Alternatives considered
Rejected because    # 为什么拒绝（正文，不只 status）
What would reopen this decision   # 什么新证据/约束会重开
Related investigation / replacement # 相对链接
```

**不留**：

- 一句脑暴
- 无 evidence 的随口想法
- 没有未来重复风险的垃圾讨论

**目标不是建立墓地，是防止未来 Agent 重复踩已经理解过的坑。**

已 rejected 的 proposal 由 **owner Decision/Spec** 的 `status: rejected` + 其正文拒绝理由承载，而非新开
物理 `rejected/` 目录。

---

## 16. NEW_EVIDENCE Rule

如果相关 proposal 已 `rejected`：Coding Agent **不得**因为「我觉得这个方案更好」就重新实现。

必须显式给出：

```text
NEW_EVIDENCE =
```

解释：什么**新的源码事实、运行结果、外部变化或 constraint**，足以重新打开旧决定？

- 如果有新 evidence → 先走「amended / superseding Spec」评审路径（不直接改代码）。
- 如果没有新 evidence → decision stays closed。

---

## 17. DEVELOPMENT_PREFLIGHT（冻结最小格式）

目标：Coding Agent 改第一行代码前，先证明自己理解 repository intent。**不要做成 50 项 checklist。**

```text
DEVELOPMENT_PREFLIGHT

Problem =
PRIMARY_GOVERNING_SPEC =
Spec status =

INHERITED_DECISIONS =            # RELEVANT_DECISIONS + DECISION_DISPOSITION（§9）
RELATED_SPECS =
Relevant investigations =
Previously rejected alternatives =

Frozen boundaries =

Implementation scope =
Out-of-scope =

New evidence =

UNRESOLVED_CONFLICTS = NONE | ...
Need new/amended Spec = YES / NO
```

要求：

- Spec status 必须是 `accepted` 才具备实现许可。
- `Need new/amended Spec = YES` 时**不得开工实现**。
- `PRIMARY_GOVERNING_SPEC` 必须恰好一个（§10）。
- `UNRESOLVED_CONFLICTS != NONE` 时**不得开工实现**（IMPLEMENTATION = STOP）。

---

## 18. After Implementation / Review Contract

设计实现后评审的固有字段：

```text
SPEC_COMPLIANCE

Referenced Spec =
Implemented scope =
Acceptance criteria evidence =
Out-of-spec behavior = NONE | ...
Rejected alternative accidentally reintroduced = NO | YES
Frozen boundaries respected = YES | NO
New architectural decision introduced = NO | YES
Knowledge artifacts needing update = NONE | ...

SPEC_COMPLIANCE = PASS / FAIL
```

- 与 `SPEC_GOVERNANCE_AND_MERGE_GATE_V1` §11 对齐（merge condition `SPEC_GATE PASS + SPEC_COMPLIANCE
  PASS + TESTS PASS`）。
- `SPEC_COMPLIANCE = FAIL` 或检测到 `Out-of-spec behavior` 时，Reviewer 明确返回，不得静默放行。

---

## 19. Evidence ≠ Decision ≠ Authority（冻结语义）

禁止混淆：

```text
Investigation recommendation ≠ accepted Spec      （查到的建议不等于实现许可）
Report PASS ≠ implementation authority             （验收通过不等于授予超出该 Spec 的改动权）
Old code behavior ≠ architectural intent           （旧代码行为不等于架构意图，意图在 Decision/Spec）
```

---

## 20. Mechanical vs Semantic（与未来 spec-gate 分工）

**CI / scripts 可检查（机械）**：
- Spec reference 存在
- Spec file 存在
- Spec 存在于 base branch
- status = accepted
- ID 匹配（spec_id == filename == PR reference）
- 必需 metadata 存在
- cross-links 可解析

**CI 不判断（语义，属于 Reviewer）**：
- change 是否 trivial
- architecture 是否合理
- implementation 是否语义超 scope
- rejection 是否应该 reopen
- AMEND 是否「小范围 additive / 核心模型未变」（§7）
- patch stack 是否超过 2 层（§11）

**明确**：`SPEC_GATE_IMPLEMENTATION = DEFERRED`。本轮不实现 CI；只划分职责边界。

---

## 21. `.agents/README.md` Standing Order（本轮不创建，只设计内容）

应**很短**，是 Agent 操作手册 + 索引，**不复制整个 docs governance**。核心要求 Coding Agent 在
non-trivial implementation 前：

1. **Search** `docs/investigations/`、`docs/decisions/`、`docs/specs/`
2. **Identify** governing accepted Spec、relevant investigations、relevant long-lived decisions、
   rejected/superseded alternatives
3. **Emit** `DEVELOPMENT_PREFLIGHT`（§17）
4. **No accepted Spec → do not implement**（对齐 merge-gate G2）
5. **Existing rejected proposal → do not reopen without NEW_EVIDENCE**（§16）
6. **Spec insufficient → amend / supersede before coding**（§5–§8）
7. **Implementation Agent → cannot expand its own governing Spec**（对齐 merge-gate G2 / B6）
8. **UNRESOLVED_CONFLICTS ≠ NONE → do not implement**（§9 / §10）

设计原则：`.agents/` **可以使用，但不能成为第四套 Knowledge Authority**。docs 是 authoritative
repository knowledge；`.agents/` 只是它的 Agent-facing protocol/index。

### 候选最小结构（推荐）

```text
AGENTS.md            # 极薄 bootstrap：非 trivial 开发前读 .agents/README.md（不复制治理政策）
.agents/
  README.md          # Agent-facing development protocol + 上述 standing order
  templates/
    development-preflight.md
    spec-compliance.md
```

**不默认创建**：
```text
.agents/notes/proposed/
.agents/notes/implemented/
.agents/notes/rejected/
.agents/notes/archived/
```
因为当前已有 `docs/specs/`、`docs/investigations/`、`docs/decisions/` 三类承载。**只有真实调查证明
这三类无法承载某需求时，才允许提出新的 notes storage**（§29 开放问题保留此出口）。

---

## 22. AGENTS.md Role

- **= 极薄 bootstrap。**
- 作用仅是告诉 Coding Agent：non-trivial development 前必须读取 `.agents/README.md`。
- 不复制整个治理政策。不放 artifact 模型、不放格式、不放 50 项 checklist。

---

## 23. Grandfather Policy

- 不 retroactively 给整个历史代码补 Spec。
- 已存在的进行中工作按既有治理继续，不重写其历史：
  - Production Integration
  - Repo Hygiene
  - Open Source Docs Convergence
  - Self-Evolution Experiment
- 新治理正式生效后**创建的 non-trivial implementation** 才必须遵守。
- Enforcement 起点与 `SPEC_GOVERNANCE_AND_MERGE_GATE_V1` §18 的 `ENFORCEMENT_START_POINT` 保持一致
  （以 spec-gate 落地 + ruleset 保护 main + 明确 activation SHA 为准，本 Spec 本身不定义 enforcement
  起点）。
- Amendment（2026-08-17）：既有 artifact（含已出现堆叠形态的未 merge 分支 Spec）**不追溯重写**；
  §6–§14 只约束生效后的新演化。

---

## 24. Explicit Non-Goals（禁止建设）

禁止建设独立的：
- Workflow Service
- Approval Service
- Governance DB
- Dashboard
- Knowledge Graph
- Memory Service
- Forum integration
- Scheduler integration
- new Auth system
- Runtime governance subsystem
- Kernel changes

Amendment（2026-08-17）追加禁止：
- Spec dependency resolver
- 自动 conflict solver
- CI gate 实现（机械检查 DEFERRED 不变，§20）

**Git + repo + GitHub = developer control plane。**（与 `SPEC_GOVERNANCE_AND_MERGE_GATE_V1` §0/§19
一致：不建自定义 governance/approval/db/dashboard/workflow/bot。）本 Spec 同样不引入任何 Agent Core
Runtime / Router / Scheduler / Auth/Broker 变更。

---

## 25. Proposed Minimal Model（结论）

**推荐采纳**：

```text
AGENTS.md                     # 极薄 bootstrap（§22）

.agents/
  README.md                   # Agent-facing protocol / index（§21）
  templates/
    development-preflight.md
    spec-compliance.md

docs/
  investigations/             # Evidence Authority（原样保留）
  decisions/                  # Long-lived invariant authority（原样保留）
  specs/                      # Spec authority（新；首个实例即本 Spec + merge-gate Spec）
```

**默认：NO NEW KNOWLEDGE SYSTEM。** 不引入第四套 notes storage；`.agents/` 是 protocol/index，不是
repository knowledge database。是否需要在未来新增任何额外目录，**必须给出真实 evidence**（当前调查
没有——三类 already 承载需求的理由成立）。

Amendment（2026-08-17）：治理规则**收敛于本单一治理 Spec**（含 §6–§14 演化与简单性规则），
不创建平行 Governance Spec。

---

## 26. README 协调（与 OPEN_SOURCE_DOCS_CONVERGENCE 的关系）

- 本 Spec **不是** docs 收敛轮；不改任何 docs 内容。
- 但它在设计上**必须与 `OPEN_SOURCE_DOCS_CONVERGENCE_V1` 兼容**：`.agents/` 是开发内部 plane，
  open-source 收敛是公开文档 plane，二者不冲突；`docs/specs/` 在两边都作为「当前文档树」下的权威
  子集。任何 action 都要避免在两份 Spec 之间制造重复 authority。

---

## 27. Acceptance Criteria（未来 Implementation 必须满足）

1. 新 Coding Agent 从仓库内 artifact（AGENTS.md/.agents/README/docs）即可回答 North Star 八个问题，
   **不依赖聊天 handoff**。
2. 三类 Artifact（Investigation / Spec / Decision）语义清晰；Investigation 不授予实现权限。
3. 每个当前 topic 至多一个 owner（Spec / Decision）；不存在 `XXX_V1_FIX_FINAL` 序列。
4. rejected/superseded 采用 **status metadata** 表达，不新增物理 dedicated 目录；但**必须保存拒绝
   原因**（`Rejected because` + `What would reopen`）。
5. Development 前有 `DEVELOPMENT_PREFLIGHT`；无 accepted Spec 或 `Need new/amended Spec = YES` 时无
   实现许可。
6. 实现后生成 `SPEC_COMPLIANCE`；检测到 out-of-spec / reintroduced rejected alternative 时 FAIL。
7. `.agents/` 不成为第四套 Knowledge Authority；`docs/` 保持权威。
8. 机械承诺 → machine gate（deferred）；语义判断 → Reviewer。不新增 CI 分类器。
9. 本 Spec 不引入任何 Runtime / Router / Scheduler / Auth/Broker / Kernel 改动。

Amendment（2026-08-17）追加：

10. Spec 正文不堆叠 AMENDMENT / REVIEW FIX 轮次块；被推翻的规则改写为当前真相，推翻理由进
    `Alternatives considered`（§6）。
11. 触发 ownership / core entity semantics / authority / long-lived invariant 任一改变时必须
    SUPERSEDE，新 artifact standalone，双方 metadata（`supersedes` / `superseded_by`）完整（§8）。
12. non-trivial Spec 显式给出 `RELEVANT_DECISIONS` + `DECISION_DISPOSITION`；不静默违反 accepted
    Decision（§9）。
13. 每个 Implementation 恰好一个 `PRIMARY_GOVERNING_SPEC`；`UNRESOLVED_CONFLICTS ≠ NONE` 时无实现
    许可（§10）。
14. 同主题 Current Truth 链超过 2 层时触发 consolidation review，产出 standalone consolidated
    artifact supersede 整栈（§11）。
15. 新 Spec 进入 Implementation 前回答 `LONG_TERM_MODEL` 与 SIMPLICITY_GATE 五问；
    `MIGRATION_COMPLEXITY > TARGET_MODEL_COMPLEXITY` 时默认 `DESIGN_SMELL = YES`（§12）。

---

## 28. Implementation Plan（本轮不实施）

- Phase 1（bootstrap）：极薄 `AGENTS.md` + `.agents/README.md`（standing order）+ 两个 template。
- Phase 2（artifact 落地）：首个 `docs/specs/` 实例收敛（含本 Spec 与 merge-gate Spec 的 accepted 化，
  需对上级治理）。
- Phase 3（dogfood）：用一条真实 Investigation → Spec → Implementation → SPEC_COMPLIANCE 路径验证；
  确认 rejected/what-would-reopen 运作。
- 每个 phase 以「新 Agent 无需 handoff 即可回答八个问题」为验收。
- Phase 4（2026-08-17 Amendment，随本分支完成）：`.agents/` 机械同步——README 与两个 template 的
  § 指针更新、preflight 模板新增 `PRIMARY_GOVERNING_SPEC` / `INHERITED_DECISIONS` /
  `RELATED_SPECS` / `UNRESOLVED_CONFLICTS` 字段（protocol/index 文件，非 Knowledge Authority）。
  CI / 机械层数计数仍 DEFERRED。

---

## 29. Open Questions

1. `docs/decisions/` 现有 D-* 是否要补 front matter `status` 字段以机器可识别（而非仅文件内
   `状态:` 文本）？——倾向是，但属实现阶段，而且受 docs-convergence/repo-hygiene 分支影响，需协商。
2. 三份 `AGENT_CORE_*` 冻结草案是否要移交 `docs/history/`（对齐 docs-convergence）而非在
   `docs/` 顶层？——由 OPEN_SOURCE_DOCS_CONVERGENCE_V1 决定；本 Spec 记录其与 ownership 的关系。
3. `.agents/README.md` 是否引用 `docs/specs/`（此时只有未 merge 分支上的 Spec）还是等
   `SPEC_GOVERNANCE_AND_MERGE_GATE_V1` merge 后再引？——pending final main。
4. 若未来出现「small repeated pattern / checklist class」由 `scripts/` 或 `.agents/skills/` 承载的
   真实需求，是否新增 notes storage？——当前 NO；需 evidence 才考虑（§21 出口）。
5. consolidation review（§11）由谁触发与裁决——Reviewer 还是 Product Owner？——当前按 semantic
   judgment 归 Reviewer，未冻结专门流程。
6. patch stack 层数是否需要机械计数定义（如 `amends`/`supersedes` 链长度）？——DEFERRED，先语义
   判断（§20）。

---

## 30. Final Result / 最终报告字段

### 首轮（2026-08-16）

```text
AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1_SPEC = PASS

BASE_MAIN = bfe74915 (origin/main, DELIVERY_PIPELINE_INTEGRATION_V0)
SPEC_HEAD = docs/agent-repo-knowledge-gov-v1 @ docs/specs/AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1.md

CURRENT_REPO_KNOWLEDGE_MODEL =
    无 AGENTS.md / .agents / .github / docs/specs；
    knowledge 在 docs/{decisions,investigations,reports}；decisions 承载 D-001..D-005 invariant；
    三份 AGENT_CORE_* 冻结草案为导航孤儿且互相重复 current-truth；
    rejected 无独立保存；靠 human handoff 发现知识。

DEEPSEEK_HARNESS_REFERENCE_MODEL =
    官方 .agents/notes/{proposed,implemented,rejected,archived}/{class}/yyyy-mm-dd-title[.zh].md +
    README.md + notes/AGENTS.md；非平凡变更须同 PR Note；Problem/方案分离；Alternatives 强制；
    rejected 状态即拒绝原因；owner 复用；机械 gate + 人工 review。任务点名的 4 个 Note 均真实存在。

GAPS = G1 no-bootstrap / G0 no-spec-on-main / G3 rejected-no-structure / G4 duplicate-authority
       / G5 no-ownership / G6 no-preflight / G7 no-review / G8 no-new-evidence-gate。

PROPOSED_MINIMAL_MODEL = AGENTS.md + .agents/{README,templates/{development-preflight,spec-compliance}}
       + docs/{specs,investigations,decisions}。NO NEW KNOWLEDGE SYSTEM。

ARTIFACT_MODEL = 三个 Artifact 冻结语义：Investigation=Evidence Authority、Spec=Implementation/Change
       (merge) Authority、Decision=Long-lived Invariant Authority。状态用 artifact metadata，不靠目录
       表达（不建 rejected/archived 物理目录）。见 §4。

AGENTS_MD_ROLE = 极薄 bootstrap：non-trivial 前读 .agents/README.md，不复制治理政策。
DOT_AGENTS_ROLE = Agent-facing protocol/index；不是第四套 Knowledge Authority。

INVESTIGATION_CONTRACT = (Status/Problem/Evidence/Options/Findings/Recommendation/Open questions/Related)。
SPEC_CONTRACT = (Problem/Decision/Scope/NonGoals/Alternatives/Acceptance/Risks/Related) + rejected 保存原因。
DECISION_CONTRACT = 仅长期 repository invariant；accepted Spec 已承载时不重复。

REJECTED_KNOWLEDGE_POLICY = 认真调查过的错误方向 KEEP（含 Rejected because / What would reopen / Related）；
       脑暴/无 evidence 不留；不建墓地，用 status metadata 表达。

KNOWLEDGE_OWNERSHIP_RULE = WHO OWNS THIS QUESTION 优先；REUSE/AMEND/SUPERSEDE/NEW 分支；禁 XXX_V1_FIX_FINAL 序列。

PREFLIGHT_MODEL = DEVELOPMENT_PREFLIGHT（Problem/Governing Spec/status/Investigations/Decisions/rejected
       /Frozen boundaries/scope/out-of-scope/New evidence/Need new-or-amended Spec）。
REVIEW_MODEL = SPEC_COMPLIANCE（Implemented scope/Acceptance evidence/Out-of-spec/reintroduced/boundaries/
       new decision/knowledge updates）= PASS/FAIL。

MECHANICAL_GATES_DEFERRED = SPEC_GATE_IMPLEMENTATION = DEFERRED；职责边界已划分，本轮不实现 CI。

FILES_TO_CHANGE_IN_IMPLEMENTATION = AGENTS.md, .agents/README.md, .agents/templates/development-preflight.md,
       .agents/templates/spec-compliance.md（+ 未来首个 accepted Spec 实例）。
FILES_NOT_TO_CHANGE = docs/investigations/**、docs/decisions/**、既有 Spec、product code、README/docs 内容
       （本轮不改任何现有文件）。

GRANDFATHER_POLICY = 不 retroactively 补 Spec；在途 Production Integration / Repo Hygiene / Open Source
       Docs Convergence / Self-Evolution 按既有治理；新治理生效后的 non-trivial 实现才遵守。

OPEN_QUESTIONS = decisions front-matter status / AGENT_CORE_* 归属 / .agents 何时引用 specs / 新 notes
       storage 是否未来需要（当前 NO）。

RUNTIME_CODE_CHANGE = NONE
ROUTER_CHANGE = NONE
PRODUCTION_INTEGRATION_CHANGE = NONE
KERNEL_CHANGE = NONE
```

spec 结论判定：无必须由人类先裁决的重大冲突（与 `SPEC_GOVERNANCE_AND_MERGE_GATE_V1`、`OPEN_SOURCE
DOCS_CONVERGENCE_V1` 均对齐）→ **AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1_SPEC = PASS**。

### Amendment 轮（2026-08-17 · SPEC_EVOLUTION_AND_SIMPLICITY_GOVERNANCE_V1）

```text
SPEC_EVOLUTION_AND_SIMPLICITY_GOVERNANCE_V1 = PASS

BASE_MAIN = ad4f7ec（origin/main，AGENT_CORE_BINDING_WORKSPACE_V1_REAL_BOOT_FIX）
AMEND_HEAD = docs/spec-evolution-governance-v1 @ docs/specs/AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1.md

SAME_SPEC_EVOLUTION_RULE =
    草稿/评审轮的 reviewer fix、clarification、validation rule、acceptance correction 优先直接
    改写同一份 Spec 正文；禁止正文堆叠 AMENDMENT/REVIEW FIX 轮次块；草稿演化由 Git history
    保存；正文只回答「现在决定了什么」；被推翻的规则必须改写为当前真相，不得内嵌「本段已
    作废」标记留给读者拼装（§6）。

AMEND_RULE =
    仅当（小范围 additive change）∧（必须与原 artifact 合读）∧（核心模型完全没变）三条件全部
    成立才允许 amends:/amendment:；AMEND 必须少用；触发 §8 任一条件时 AMEND 被禁止（§7）。

SUPERSEDE_RULE =
    ownership / core entity semantics / authority / long-lived invariant 任一改变必须 SUPERSEDE，
    不得伪装成 amendment；新 artifact standalone（只读新 artifact 即理解当前模型）；metadata：
    新 status:accepted + supersedes:，旧 status:superseded + superseded_by:；新日期不自动拥有
    更高 authority（§8）。

DECISION_CONFLICT_RULE =
    Spec 不得静默违反 accepted Decision；non-trivial Spec 必须显式 RELEVANT_DECISIONS +
    DECISION_DISPOSITION(PRESERVE/AMEND/SUPERSEDE)；改长期 invariant 的唯一顺序 =
    Evidence → Decision amendment/supersession → governing Spec → Implementation；
    Implementation Agent 不得自行解释哪个更「新」（§9）。

PRIMARY_GOVERNING_SPEC_RULE =
    每个 Implementation 恰好一个 primary authority；RELATED_SPECS / RELEVANT_INVESTIGATIONS /
    INHERITED_DECISIONS 只作 context；Preflight 必须回答 PRIMARY_GOVERNING_SPEC /
    INHERITED_DECISIONS / RELATED_SPECS / UNRESOLVED_CONFLICTS；
    UNRESOLVED_CONFLICTS != NONE → IMPLEMENTATION = STOP（§10）。

PATCH_STACK_LIMIT =
    理解 Current Truth 需要 base 之外超过 2 层 amendment/supersession/clarification 时必须触发
    consolidation review；默认动作 = 写 standalone consolidated Decision/Spec supersede 整栈；
    旧 artifact 保留历史价值但不再要求未来 Agent 阅读（§11）。

SIMPLICITY_GATE =
    进入 Implementation 前必须回答 LONG_TERM_MODEL（尽量 ≤10 行）并过五问：migration 是否进
    长期 runtime / 一次性旧数据能否 archive-reset-explicit-cutover / 是否为无 production
    evidence 的 corner case 建 recovery framework / migration 是否比 target model 复杂 /
    是否考虑过直接封存旧状态；MIGRATION_COMPLEXITY > TARGET_MODEL_COMPLEXITY → 默认
    DESIGN_SMELL = YES，必须重新评估而非继续补 migration（§12）。Reviewer 对每个明显
    compatibility/migration proposal 至少回答 CAN_OLD_STATE_BE_ARCHIVED_OR_RESET = YES/NO，
    NO 必须给真实 evidence（§13）。

CURRENT_TRUTH_MODEL =
    Spec = 为什么/允许这次改变什么；Decision/current docs = 今天系统到底是什么；不要求读者
    阅读所有历史 Spec 自行推导 current architecture；主题稳定后必须有 standalone Current
    Decision/Current Docs（§14）。业界参考（IETF Updates/Obsoletes、KEP replaces/superseded-by、
    PEP Replaces/Superseded-By、Rust RFC proposal-history/canonical 分离）只参考、不机械复制。

REAL_EVIDENCE =
    patch stack：FEISHU_WORKSPACE_MEMORY_ALIGNMENT_V1（未 merge 分支）正文堆叠 AMENDMENT
    Fix1–3 + Migration Gate，再内嵌 ⚠️ SUPERSEDED（PRODUCT RULING V2）部分推翻，读者需自行
    merge 三层。reviewer-induced complexity：同 Spec 引入 provenance classification / quarantine /
    pending restore / per-conversation migration archive / cron-p2p-group 历史分类 / migration
    gates / rollback machinery，最终产品裁决 = old mixed memory ARCHIVE_ONLY + new Workspace
    clean start。decision-spec 缝：MEMORY_V1(decision) ↔ AGENT_CORE_BINDING_WORKSPACE_V1(spec)
    语义位移无显式 disposition，需第三篇 Spec 收敛。

UNRESOLVED_QUESTIONS =
    consolidation review 的触发者/节奏（Reviewer vs Product Owner）；patch-stack 层数机械计数
    定义（DEFERRED）。见 §29 Q5/Q6。

FILES_CHANGED = docs/specs/AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1.md（整合改写，§6–§14 新增，
       旧 §6–§21 顺移为 §15–§30）+ .agents/README.md、.agents/templates/development-preflight.md、
       .agents/templates/spec-compliance.md（仅机械 § 指针与 preflight 字段同步，非 Knowledge
       Authority）。
FILES_NOT_TO_CHANGE = 任何产品 Spec（含 FEISHU_WORKSPACE_MEMORY_ALIGNMENT_V1）、Credential
       Provisioning、Primary Worktree Guard、docs/investigations/**、docs/decisions/**、产品代码。

PRODUCT_CODE_CHANGE = NONE
RUNTIME_CHANGE = NONE
ROUTER_CHANGE = NONE
KERNEL_CHANGE = NONE
```

Amendment 结论判定：不创建平行治理 Spec、不动三权威冻结模型、不动任何产品 Spec / runtime，
无必须由人类先裁决的重大冲突 → **SPEC_EVOLUTION_AND_SIMPLICITY_GOVERNANCE_V1 = PASS**。
