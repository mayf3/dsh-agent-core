---
spec_id: AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1
status: accepted
---

# Agent Repo Knowledge Governance V1

> 性质：**Spec（本轮只设计，不实施）** · 日期：2026-08-16
> 仓库：`mayf3/dsh-agent-core`
> 角色：Repo Governance / Developer Experience Agent
>
> 本 Spec 与 `SPEC_GOVERNANCE_AND_MERGE_GATE_V1`（Spec as merge authority）**对齐且互补**：
> 那份 Spec 控制「什么是 merge authority gate」，本 Spec 控制「Knowledge 是什么、由谁拥有、
> Agent 在改第一行代码前如何证明自己理解 repository intent」。
>
> 本轮只新增 `docs/specs/AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1.md`。**不创建 `AGENTS.md`、
> 不创建 `.agents/**`、不改 `docs/investigations/**`、不改 `docs/decisions/**`、不改任何既有
> Spec、不改任何产品代码。**

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
- 生命周期至少：`draft → accepted → rejected | superseded`。
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

---

## 6. Rejected Knowledge Policy

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

## 7. NEW_EVIDENCE Rule

如果相关 proposal 已 `rejected`：Coding Agent **不得**因为「我觉得这个方案更好」就重新实现。

必须显式给出：

```text
NEW_EVIDENCE =
```

解释：什么**新的源码事实、运行结果、外部变化或 constraint**，足以重新打开旧决定？

- 如果有新 evidence → 先走「amended / superseding Spec」评审路径（不直接改代码）。
- 如果没有新 evidence → decision stays closed。

---

## 8. DEVELOPMENT_PREFLIGHT（冻结最小格式）

目标：Coding Agent 改第一行代码前，先证明自己理解 repository intent。**不要做成 50 项 checklist。**

```text
DEVELOPMENT_PREFLIGHT

Problem =
Governing Spec =
Spec status =

Relevant investigations =
Relevant decisions =
Previously rejected alternatives =

Frozen boundaries =

Implementation scope =
Out-of-scope =

New evidence =

Need new/amended Spec = YES / NO
```

要求：Spec status 必须是 `accepted` 才具备实现许可；`Need new/amended Spec = YES` 时**不得开工实现**。

---

## 9. After Implementation / Review Contract

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

## 10. Evidence ≠ Decision ≠ Authority（冻结语义）

禁止混淆：

```text
Investigation recommendation ≠ accepted Spec      （查到的建议不等于实现许可）
Report PASS ≠ implementation authority             （验收通过不等于授予超出该 Spec 的改动权）
Old code behavior ≠ architectural intent           （旧代码行为不等于架构意图，意图在 Decision/Spec）
```

---

## 11. Mechanical vs Semantic（与未来 spec-gate 分工）

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

**明确**：`SPEC_GATE_IMPLEMENTATION = DEFERRED`。本轮不实现 CI；只划分职责边界。

---

## 12. `.agents/README.md` Standing Order（本轮不创建，只设计内容）

应**很短**，是 Agent 操作手册 + 索引，**不复制整个 docs governance**。核心要求 Coding Agent 在
non-trivial implementation 前：

1. **Search** `docs/investigations/`、`docs/decisions/`、`docs/specs/`
2. **Identify** governing accepted Spec、relevant investigations、relevant long-lived decisions、
   rejected/superseded alternatives
3. **Emit** `DEVELOPMENT_PREFLIGHT`（§8）
4. **No accepted Spec → do not implement**（对齐 merge-gate G2）
5. **Existing rejected proposal → do not reopen without NEW_EVIDENCE**（§7）
6. **Spec insufficient → amend / supersede before coding**（§5）
7. **Implementation Agent → cannot expand its own governing Spec**（对齐 merge-gate G2 / B6）

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
这三类无法承载某需求时，才允许提出新的 notes storage**（§15 开放问题保留此出口）。

---

## 13. AGENTS.md Role

- **= 极薄 bootstrap。**
- 作用仅是告诉 Coding Agent：non-trivial development 前必须读取 `.agents/README.md`。
- 不复制整个治理政策。不放 artifact 模型、不放格式、不放 50 项 checklist。

---

## 14. Grandfather Policy

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

---

## 15. Explicit Non-Goals（禁止建设）

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

**Git + repo + GitHub = developer control plane。**（与 `SPEC_GOVERNANCE_AND_MERGE_GATE_V1` §0/§19
一致：不建自定义 governance/approval/db/dashboard/workflow/bot。）本 Spec 同样不引入任何 Agent Core
Runtime / Router / Scheduler / Auth/Broker 变更。

---

## 16. Proposed Minimal Model（结论）

**推荐采纳**：

```text
AGENTS.md                     # 极薄 bootstrap（§13）

.agents/
  README.md                   # Agent-facing protocol / index（§12）
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

---

## 17. README 协调（与 OPEN_SOURCE_DOCS_CONVERGENCE 的关系）

- 本 Spec **不是** docs 收敛轮；不改任何 docs 内容。
- 但它在设计上**必须与 `OPEN_SOURCE_DOCS_CONVERGENCE_V1` 兼容**：`.agents/` 是开发内部 plane，
  open-source 收敛是公开文档 plane，二者不冲突；`docs/specs/` 在两边都作为「当前文档树」下的权威
  子集。任何 action 都要避免在两份 Spec 之间制造重复 authority。

---

## 18. Acceptance Criteria（未来 Implementation 必须满足）

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

---

## 19. Implementation Plan（本轮不实施）

- Phase 1（bootstrap）：极薄 `AGENTS.md` + `.agents/README.md`（standing order）+ 两个 template。
- Phase 2（artifact 落地）：首个 `docs/specs/` 实例收敛（含本 Spec 与 merge-gate Spec 的 accepted 化，
  需对上级治理）。
- Phase 3（dogfood）：用一条真实 Investigation → Spec → Implementation → SPEC_COMPLIANCE 路径验证；
  确认 rejected/what-would-reopen 运作。
- 每个 phase 以「新 Agent 无需 handoff 即可回答八个问题」为验收。

---

## 20. Open Questions

1. `docs/decisions/` 现有 D-* 是否要补 front matter `status` 字段以机器可识别（而非仅文件内
   `状态:` 文本）？——倾向是，但属实现阶段，而且受 docs-convergence/repo-hygiene 分支影响，需协商。
2. 三份 `AGENT_CORE_*` 冻结草案是否要移交 `docs/history/`（对齐 docs-convergence）而非在
   `docs/` 顶层？——由 OPEN_SOURCE_DOCS_CONVERGENCE_V1 决定；本 Spec 记录其与 ownership 的关系。
3. `.agents/README.md` 是否引用 `docs/specs/`（此时只有未 merge 分支上的 Spec）还是等
   `SPEC_GOVERNANCE_AND_MERGE_GATE_V1` merge 后再引？——pending final main。
4. 若未来出现「small repeated pattern / checklist class」由 `scripts/` 或 `.agents/skills/` 承载的
   真实需求，是否新增 notes storage？——当前 NO；需 evidence 才考虑（§12 出口）。

---

## 21. Final Result / 最终报告字段

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
