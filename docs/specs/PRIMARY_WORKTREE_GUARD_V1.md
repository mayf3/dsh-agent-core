---
spec_id: PRIMARY_WORKTREE_GUARD_V1
status: proposed
---

# Primary Worktree Guard V1

> 性质：**Spec（本轮只冻结 Spec，不实施）** · 日期：2026-08-17
> 仓库：`mayf3/dsh-agent-core` · 分支：`docs/primary-worktree-guard-v1-spec`
> BASE_MAIN = `f7f8a59`（本轮 `origin/main` HEAD）
> 本 Spec 是 `PRIMARY_WORKTREE_GUARD_INVESTIGATION_V1` 的收敛。该 Investigation **尚未 merge
> 入 repo**，其冻结 evidence 见 §2.1（本 Spec 不复制调查过程，只引用结论）。
>
> **SPEC ONLY**：本轮只新增本 Spec 文件。**不创建 guard 脚本、不修改任何模板 / `.agents/`
> 文件、不迁移当前 dirty primary、不 stash / reset / clean 任何未提交工作、不 merge。**
>
> 现场约束：primary worktree（`/Users/yanfenma/workspace/project/dsh-agent-core`）本轮被另一
> Implementation Agent 占用（branch = `feat/agent-core-binding-workspace-v1`，worktree DIRTY）。
> 本 Spec 在独立 linked worktree（基于 `origin/main`）中撰写，未触碰 primary 任何状态。

---

## 0. North Star

只解决一个问题：

> **多 Agent 并行开发时，Implementation Agent 不能再直接占用 primary/root worktree。**

长期冻结的目标形态：

```text
PRIMARY WORKTREE
  = main-only
  = inspect / Merge Owner workspace

IMPLEMENTATION
  = linked worktree only
```

不建设 Git 平台。不建设 daemon / proxy / branch manager / database / permission service。
本 Spec 只冻结一条 repository-enforced development invariant + 一个极小 guard 脚本的实现授权。

---

## 1. Problem

当前仓库多 Agent 并行开发已成为常态（`git worktree list` 显示 20+ linked worktrees），但
primary worktree 没有任何 policy 保护：

- primary 当前不在 `main`（在 `feat/agent-core-binding-workspace-v1`）；
- primary 当前存在**未提交 implementation**（worktree DIRTY）；
- existing worktree policy = **NONE**（没有任何文档规定 implementation 应在哪里进行）；
- existing machine guard = **NONE**（没有任何脚本 / 检查阻止 agent 在 primary switch branch
  或直接修改产品代码）。

后果：任何一个 Agent 在 primary `git switch` 或留下 dirty working tree，都会阻塞：

- 其它 Agent 的 inspect（`git status` / `git log` 读到的是 feature branch 状态而非 `main`）；
- Owner / Merge workflow（primary 无法执行 ff / merge / push `main`）。

这不是一次性脏状态问题，而是 **worktree usage policy 未定义** —— 需要一条 invariant +
一个最小 guard，而不是人工提醒。

---

## 2. Evidence

### 2.1 Frozen investigation evidence（`PRIMARY_WORKTREE_GUARD_INVESTIGATION_V1`，尚未入库）

以下为该 Investigation 的冻结结论，作为本 Spec 的 evidence input：

```text
- primary 当前不是 main
- primary 当前存在未提交 implementation
- existing worktree policy = NONE
- existing machine guard = NONE
- git worktree lock != branch switch lock
  （lock 只保护 prune / move / remove，不阻止 git switch / checkout）
- reliable primary detection:
    gitDir    = git rev-parse --path-format=absolute --git-dir
    commonDir = git rev-parse --path-format=absolute --git-common-dir
    equal     → primary
    different → linked
  已在 primary / linked / 子目录 / 仓库外 linked worktree 实测成立
```

### 2.2 本轮 live 复核（2026-08-17，spec author 在独立 linked worktree 中执行）

| 场景 | gitDir == commonDir? | 判定 |
|---|---|---|
| primary root（`/Users/yanfenma/workspace/project/dsh-agent-core`） | equal（两者均为 `<primary>/.git`） | PRIMARY |
| primary 子目录（`packages/`） | equal | PRIMARY |
| 仓库外 linked worktree root（`dsh-agent-core-wt-pwguard`，基于 `origin/main` 新建） | different（gitDir = `<primary>/.git/worktrees/...`） | LINKED |
| 该 linked worktree 子目录（`docs/specs/`） | different | LINKED |

`git worktree list --porcelain` 输出与上表判定一致（可作诊断交叉验证）。

---

## 3. Policy Model

### 3.1 Primary Worktree Invariant

```text
PRIMARY_WORKTREE_INVARIANT =
  primary（root）worktree 的正常稳定态必须 branch = main；
  primary 是 inspect / Merge Owner workspace，不是 implementation workspace。
```

**允许**（read-only inspect + Merge Owner 操作）：

```text
PRIMARY_ALLOWED_OPERATIONS =
  git status / git show / git diff / git log
  grep / source inspection
  git fetch
  Merge Owner: ff / merge / push main
```

**禁止**普通 Agent 为了查看其它 branch 在 primary 执行：

```text
PRIMARY_FORBIDDEN_OPERATIONS =
  git switch <branch>
  git checkout <branch>
```

**Spec / Reviewer 如需查看某个 branch 的内容**，用 ref-only 操作：

```text
REVIEW_MODEL =
  git show <ref>:<path>
  git diff <ref1>..<ref2>
  或创建自己的 linked worktree
  （review 全程不要求 checkout primary）
```

**不把 test / build 默认视为 primary read-only 操作**——test / build 会写 artifact /
修改 working tree，属于 implementation activity，必须在 linked worktree 执行。

### 3.2 Implementation Worktree Invariant

```text
IMPLEMENTATION_WORKTREE_INVARIANT =
  所有 implementation MUST use linked worktree。
```

如果 development preflight（guard）检测到：

```text
current worktree = primary 且 mode = implementation
  → FAIL（non-zero exit）
  → 提示创建 linked worktree
```

**不允许** Implementation Agent 自行：

- 在 primary 建 feature branch；
- 把 primary switch 到 feature branch；
- 在 primary 直接修改产品代码。

### 3.3 Merge Owner Model

```text
MERGE_OWNER_MODEL =
  只有 Owner / Merge workflow 在 primary 执行 ff / merge / push main；
  普通 Agent（Implementation / Spec / Reviewer）不是 Merge Owner，
  不在 primary 做任何 branch 切换或写入。
```

---

## 4. Primary Detection（唯一主判据，冻结）

```text
PRIMARY_DETECTION =
  gitDir    = git rev-parse --path-format=absolute --git-dir
  commonDir = git rev-parse --path-format=absolute --git-common-dir

  gitDir == commonDir  → PRIMARY
  gitDir != commonDir  → LINKED
```

冻结约束：

- **唯一主判据**就是上述 git-dir vs common-dir 比较（对 git 输出的字面绝对路径做相等比较；
  `--path-format=absolute` 保证不做相对路径拼接）。
- **不根据**以下线索猜测：`.worktree/` 路径、branch name、`pwd` 字符串。
- 允许用 `git worktree list --porcelain` 做**诊断 / 交叉验证**，但**不建设第二套 authority**——
  guard 的判定逻辑只依赖 §4 主判据，porcelain 输出至多进 diagnostic message。

---

## 5. Guard Implementation Authority（minimal，V1 全部实现授权）

V1 **最多**授权修改以下 4 个文件：

```text
scripts/assert-development-worktree.mjs     （新建）
.agents/templates/development-preflight.md  （极小 additive 修改，见 §5.2）
.agents/README.md                           （极小 additive 修改，见 §5.2）
AGENTS.md                                   （极小 additive 修改，见 §5.2）
```

### 5.1 GUARD_SCRIPT 行为冻结

```text
GUARD_SCRIPT = scripts/assert-development-worktree.mjs
```

只负责三件事：

1. detect primary / linked（§4 主判据）；
2. implementation mode 且当前在 primary → non-zero exit；
3. useful error message。

行为表：

```text
mode:
  V1 唯一 mode = implementation（default；无需子命令即可直接当 implementation 检查用）

判定与退出码:
  cwd 不在任何 git repository（git rev-parse 失败） → exit 2  ENV_ERROR（"not inside a git repository"）
  PRIMARY  + mode=implementation                     → exit 1  GUARD_FAIL
  LINKED   + mode=implementation                     → exit 0  PASS

GUARD_FAIL message 必须包含:
  当前判定（PRIMARY）+ 一句 remediation，
  例：git worktree add -b <branch> <path> origin/main
  （示例 path 不要求位于 .worktree/，见 AC5）
```

**明确不建设**：

```text
daemon
Git proxy
branch manager
database
permission service
```

**只读保证**：guard 只调用 `git rev-parse`（`--git-dir` / `--git-common-dir`，均带
`--path-format=absolute`）；`git worktree list --porcelain` 至多用于 diagnostic 输出。
guard 不执行任何写操作（见 AC9）。

### 5.2 PREFLIGHT_INTEGRATION

- `.agents/templates/development-preflight.md`：**additive** 增加一个字段
  `Worktree = PRIMARY / LINKED`（值来自 guard 输出），并在模板约束里注明
  「implementation 时 Worktree = PRIMARY → preflight FAIL，先创建 linked worktree」。
  保持精简，不把模板扩成 checklist（对齐 `AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1` §8 精神）。
- `.agents/README.md` Standing Order：增加一步（或并入现有 step 3）——implementation 前
  运行 guard；implementation in primary → 不得开工。
- `AGENTS.md`（bootstrap）：增加一行指向该要求，不复制政策正文。

以上 3 处文档修改限于本节描述的最小 additive 内容；超出此范围的改写不属于本 Spec 授权
（如与 `AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1` 的 artifact 语义发生冲突，走 AMEND 路径而不是
静默改语义）。

---

## 6. Important Limitation（诚实声明）

```text
preflight guard ≠ OS security boundary
```

- guard 的目标是 **repository-enforced development invariant**（开发纪律的可执行化），
  **不是**抵抗恶意同 UID 用户。
- 同 UID 的 Agent 技术上仍可直接 `git switch`、绕过 guard 不运行它、或直接编辑文件——
  V1 不试图阻止这些，靠 review / SPEC_COMPLIANCE 流程发现违规。
- 不引入任何 OS-level enforcement（见 §11 out of scope）。

---

## 7. `git worktree lock` = NOT A SOLUTION（冻结）

```text
GIT_WORKTREE_LOCK = NOT_A_SOLUTION
```

明确冻结：**不得**把 `git worktree lock` 当作 branch switch guard 使用。原因：它保护的是

```text
prune / move / remove
```

而**不阻止**：

```text
git switch / git checkout
```

因此它无法实现本 Spec 的目标（阻止 primary 被 switch 到 feature branch）。实现中禁止引入。

---

## 8. Filesystem immutable flag

```text
FILESYSTEM_INDEX_IMMUTABLE (chflags uchg .git/index) = REJECT
```

原因：会破坏正常 Merge Owner 操作（merge / ff 需要写 index）。

```text
FILESYSTEM_HEAD_IMMUTABLE (chflags uchg .git/HEAD) = DEFER
```

DEFER 理由（冻结）：

1. 不是 portability-friendly 的 repo policy（`chflags` 是 macOS 语义）；
2. 同 UID 可解除（`chflags nouchg`），防不了 §6 声明的非目标里的行为主体；
3. recovery 成本更高（忘了解除会把 primary 锁死在错误分支）；
4. 当前 primary 尚未恢复 `main`，此刻上锁会把违规状态固化。

只有**未来有真实 evidence** 证明 repository guard 仍频繁被绕过，才**单独**重新评估
（届时需 NEW_EVIDENCE 重开，不是本 Spec 的一部分）。

---

## 9. Current Violation Migration（本轮明确不做）

本 Spec **不允许** Implementation（guard 实现轮）处理当前 dirty primary。

当前 primary 上的 `feat/agent-core-binding-workspace-v1` 必须先由**它自己的
Implementation Agent**完成：

```text
完成当前工作 → commit → push → worktree clean
```

之后 **Owner / Merge workflow** 才可以：

```text
primary → main
primary ff origin/main
```

后续 feature work 再创建 linked worktree。

```text
CURRENT_DIRTY_PRIMARY_HANDLING =
  Guard Implementation 不得 stash / reset / clean / copy / move
  其它 Agent 的当前未提交工作。
```

（本 Spec 轮同样遵守：本轮未触碰 primary 任何 git state。）

---

## 10. Acceptance Criteria

```text
AC1  在 primary 调 implementation guard → FAIL（exit 1，含 remediation message）
AC2  在 linked worktree 调 implementation guard → PASS（exit 0）
AC3  从 primary 子目录执行 → 仍识别 PRIMARY（判定不依赖仓库根 cwd）
AC4  从仓库外 linked worktree 的子目录执行 → 仍识别 LINKED
AC5  linked worktree 不要求位于 .worktree/（任意路径成立，含仓库外兄弟目录）
AC6  Reviewer 使用 git show <ref>:<path> / git diff <ref1>..<ref2>
     → 不要求 checkout primary（REVIEW_MODEL 落地，review 流程不依赖 primary switch）
AC7  git worktree lock → 不被作为 switch guard（§7 冻结 NOT_A_SOLUTION，
     实现中不出现该机制）
AC8  primary stable state → branch == main
     （验收时机：§9 迁移完成后；检查 git rev-parse --abbrev-ref HEAD == main。
      该 AC 依赖 binding implementation 轮先完成，不是 guard 实现轮的阻塞项）
AC9  guard 不修改 git state / branch / index / working tree
     （纯只读；实现轮以 strace 级别审查受限不现实，至少冻结：脚本只调用 §5.1 列出的
      git rev-parse（与可选 porcelain 诊断），且测试断言运行前后
      git status --porcelain 与 HEAD 不变）
```

---

## 11. Out of Scope

```text
filesystem permissions redesign
OS user isolation
custom SCM
Git daemon / proxy
global hooks infrastructure
CI platform
auto branch creation service
current Binding implementation migration
Runtime / Router / Broker / Auth / Scheduler
Kernel
```

---

## 12. Final Output（冻结）

```text
PRIMARY_WORKTREE_GUARD_V1_SPEC = PASS

PRODUCT_PROBLEM =
  多 Agent 并行开发时，Implementation Agent 直接占用 primary/root worktree
  （switch branch + dirty working tree），阻塞 inspect 与 Merge workflow；
  existing worktree policy = NONE，existing machine guard = NONE。

PRIMARY_WORKTREE_INVARIANT =
  primary 正常稳定态 branch = main；primary 是 inspect / Merge Owner workspace；
  允许 git status / show / diff / log / grep / fetch；Merge Owner 可 ff / merge / push main；
  普通 Agent 禁止在 primary git switch / checkout；test / build 不视为 primary read-only。

IMPLEMENTATION_WORKTREE_INVARIANT =
  所有 implementation MUST use linked worktree；
  preflight 检测 implementation in primary → FAIL 并提示创建 linked worktree；
  不允许在 primary 建 feature branch / switch / 直接改产品代码。

PRIMARY_DETECTION =
  git rev-parse --path-format=absolute --git-dir vs --git-common-dir；
  equal → PRIMARY，different → LINKED（唯一主判据；
  不按 .worktree/ 路径 / branch name / pwd 猜测；
  git worktree list --porcelain 仅诊断交叉验证，不建第二套 authority）。

PRIMARY_ALLOWED_OPERATIONS =
  git status / git show / git diff / git log / grep / source inspection / git fetch；
  Merge Owner: ff / merge / push main。
PRIMARY_FORBIDDEN_OPERATIONS =
  git switch <branch> / git checkout <branch>（普通 Agent，在 primary）。

REVIEW_MODEL =
  Reviewer 用 git show <ref>:<path> / git diff <ref1>..<ref2> 或自建 linked worktree；
  不 checkout primary。
MERGE_OWNER_MODEL =
  只有 Owner / Merge workflow 在 primary ff / merge / push main。

GUARD_SCRIPT =
  scripts/assert-development-worktree.mjs：detect primary/linked +
  implementation in primary → non-zero exit + useful error message；
  exit 0 = PASS，1 = GUARD_FAIL，2 = ENV_ERROR；只读，只调 git rev-parse（+可选 porcelain 诊断）。
PREFLIGHT_INTEGRATION =
  development-preflight 模板新增 Worktree = PRIMARY/LINKED 字段（additive）；
  .agents/README.md Standing Order 增加运行 guard 一步；AGENTS.md 加一行指引。

GIT_WORKTREE_LOCK = NOT_A_SOLUTION（只保护 prune/move/remove，不阻止 switch/checkout）
FILESYSTEM_HEAD_IMMUTABLE = DEFER（chflags uchg .git/index = REJECT）

CURRENT_DIRTY_PRIMARY_HANDLING =
  本 Spec 及 guard 实现均不处理；由 binding implementation agent 先
  commit → push → clean，之后 Owner/Merge 把 primary 恢复 main 并 ff；
  guard 实现不得 stash/reset/clean/copy/move 其它 Agent 的未提交工作。

IMPLEMENTATION_SCOPE =
  最多 4 文件：scripts/assert-development-worktree.mjs（新）、
  .agents/templates/development-preflight.md、.agents/README.md、AGENTS.md（后三者为极小 additive）。
OUT_OF_SCOPE =
  §11 全列表（filesystem permissions / OS isolation / custom SCM / daemon / proxy /
  global hooks / CI / auto branch service / 当前 binding 迁移 / Runtime / Router /
  Broker / Auth / Scheduler / Kernel）。

AC1 = 在 primary 调 implementation guard → FAIL（exit 1 + remediation）
AC2 = 在 linked worktree 调 implementation guard → PASS（exit 0）
AC3 = 从 primary 子目录执行 → 仍识别 PRIMARY
AC4 = 从仓库外 linked worktree 子目录执行 → 仍识别 LINKED
AC5 = linked worktree 不要求位于 .worktree/
AC6 = Reviewer 用 git show/diff → 不要求 checkout primary
AC7 = git worktree lock 不被作为 switch guard
AC8 = primary stable state → branch == main（§9 迁移完成后验收）
AC9 = guard 不修改 git state / branch / index / working tree

ARCHITECTURE_CHANGE = NONE
KERNEL_CHANGE = NONE

SPEC_STATUS = proposed
READY_FOR_INDEPENDENT_SPEC_REVIEW = YES
```

---

## 13. Related

- `PRIMARY_WORKTREE_GUARD_INVESTIGATION_V1`（evidence source；尚未入库，冻结结论见 §2.1）
- `docs/specs/AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1.md`（status: accepted）
  —— `.agents/` / `DEVELOPMENT_PREFLIGHT` 的 governing authority（§8 模板、Standing Order）
- `AGENTS.md`、`.agents/README.md`、`.agents/templates/development-preflight.md`
  （本 Spec 授权的 3 个 additive 文档落点）
- `docs/specs/AGENT_CORE_BINDING_WORKSPACE_V1.md`（status: accepted）
  —— 当前占用 primary 的 implementation 的 governing Spec（§9 迁移前置）
- `git worktree` / `git rev-parse --path-format=absolute` 文档（detection authority 依据）
