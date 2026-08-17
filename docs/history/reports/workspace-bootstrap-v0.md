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
# Workspace Bootstrap V0 报告

> 状态：已实现并测试通过（M1 的一部分）。covers `@agent-core/workspace-bootstrap`。

## 1. 目标与范围

### 目标
在 DSH 之上补一层「per-agent 长期目录」机制：把 `agentId` 稳定映射到两个根（工作区 + DSH home），按需（`ensure(agentId)`）**幂等**地创建目录、播种**经过论证**的最小文件集。它只提供**能力**，不在插件自身挂载路径上自动调 `ensure`（那是 Router 的挂点）。

DSH 原生已覆盖的（复用不重写）：`agent-instructions` 自动加载 AGENTS.md（base bundle 默认开）、fs seam、skill-filesystem。本层真正缺失且要 BUILD 的是「目录创建 / 播种 / 命名约定」——DSH `workspace` 包只是目录→实体注册表，拒绝不存在的目录（见 `docs/investigations/workspace-files.md` §2.1、§5）。

### 范围
- `packages/workspace-bootstrap/`：`src/paths.js`（纯函数映射）、`src/index.js`（Cordis 插件壳）、`test/`（node:test）。
- `docs/reports/workspace-bootstrap-v0.md`：本文件。

### 明确不负责（绝对不做）
- 进程生命周期：不 spawn、不接管 owner-guard 的锁逻辑、不做 supervisor。
- 不写 bundle/profile 组合；不改 `packages/router/`、`packages/owner-guard/`、`packages/broker/`、`packages/feishu-connector/`、`bundle/`、`profile/`、`scripts/`、根 `README.md`、`docs/` 下除本报告外任何文件、DSH checkout（只读）。
- 不在 agent 创建时自动播种：插件**只注册 `ctx.workspaceBootstrap` 能力**，播种时机（`agent/pre-step` vs preset 组合）见 §7。
- `git init` 不包含在本轮（进程与编排后续处理），报告中注明。

## 2. 映射与路径设计

### 两条根（刻意分离）
| 根 | 默认 | 可覆盖 env | 语义 |
|---|---|---|---|
| workspace | `~/.dsh/workspaces/<agentId>/` | `DSH_WORKSPACE_DIR` + 配置 `workspaceRoot` | agent 长期 cwd，AGENTS.md 与文件工具的相对基准 |
| DSH home | `~/.dsh/agents/<agentId>/` | `DSH_AGENTS_HOME` + 配置 `agentsHome` | agent 的运行时/技能/凭据 home，镜像 DSH `dshHomePath` 约定 |

优先级（高→低）与 DSH `resolveDshHome` 完全一致：`configured root ?? env ?? default`；空/空白 env 视为未设置（`resolveDshHome` 的空值语义），绝不解析到 cwd。`$DSH_HOME` 本身不作为本层默认——它被开放问题 §6.1 讨论，本轮用 `~/.dsh/agents`（子路径）与全局 `$DSH_HOME` 解耦，避免与 DSH 自身单根语义冲突。

### sanitizeAgentId 规则
`agentId` 是外部输入，映射函数在拼路径前先 sanitize，非法输入一律**抛错拒绝**（不静默改写，防 overlong 截断碰撞）：
- 非空字符串；空/纯空白拒绝。
- 长度 ≤ 200（`MAX_AGENT_ID_LENGTH`）。
- 字符仅允许字母/数字/`-`/`_`：拒绝 NUL、`/`、`\`、`.`、空格（这些足以制造 `..`、`.`/`..`、隐藏文件、分隔符注入、Windows 尾随点/空格的静默裁剪）。
- `isAbsolute` 显式防御（分隔符已禁，列出作护栏与未来改动保护）。
结果永远是**单个路径分量**，无法逃出根，且在同一根下不同 agentId 恒不碰撞。

### 幂等语义
`ensure(agentId)` 重复调用：两次解析出相同绝对路径；目录已存在则直接复用；种子文件已存在则**跳过写入**（`flag: 'wx'` 原子，EEXIST 视为成功而非覆盖）。已有同名自定义文件永久保留。

## 3. 逐文件播种论证 / 否决表

播种决策 = 「DSH 原生有消费者」且「本轮 M1 有明确接收方」才播种；其余一律否决（不机械复制 OpenClaw）。git init 明确排除。

| 文件 | 决策 | 论证 |
|---|---|---|
| `workspace/AGENTS.md` | **播种**（默认） | 唯一论证最充分：DSH `agent-instructions` 原生从 header.cwd 链自动加载/动态注入 AGENTS.md。这是「让 agent 的家有指令」的最小必要文件，播种后无需任何额外代码即有消费者读取。内容为纯文本模板（`AGENTS_TEMPLATE`），说明这是长期工作目录、约定、写入者；`agent-instructions` 自己用 `<system-reminder>` 包装，模板内不含它。 |
| `workspace/.gitkeep` | 不播种 | 目录树已由 `mkdir -p` 创建（empty 目录本就存在无需占位）；`.gitkeep` 只在「空目录需被 VCS 跟踪」时才有意义，而本轮 **git init 明确排除**（见下）。将来若加 git init，再引入 `.gitkeep` 或直接 `.gitignore`。 |
| `workspace/BOOTSTRAP.md` | **否决** | OpenClaw 语义是「仅全新工作区首跑、跑完即删」。本轮无"首跑标记/清理"编排消费者；该语义属于后续挂点（Router 播种时按需生成并自删），不由 bootstrap 静态播种。 |
| `workspace/README.md` | **否决** | 无 DSH 原生消费者：agent-instructions 只读 AGENTS.md/CLAUDE.md；README 是给人类浏览的存量信息，可随 agent 自建，不构成最小播种面。 |
| `workspace/SOUL.md` / `USER.md` / `IDENTITY.md` | **否决** | 三者是 OpenClaw persona/边界/关系文件，DSH **原生无消费者**（agent-instructions/skill-filesystem 都不读它们）。本轮无 badge/persona 组合层来消费；机械拷贝只会制造无人读取的存量文件。属于后续 persona/badge 主题的 ADAPT 项，不归 bootstrap 播种。 |
| `workspace/MEMORY.md` | **否决** | MEMORY.md 归属 memory 主题的 **consolidation 层**（episodic 日志→curated 长期记忆，见 `CAPABILITY_MATRIX.md` 清单第 2 项与 `docs/investigations/memory.md`），由 memory/consolidation 插件写入并维护，不由 bootstrap 静态播种（OpenClaw 也「永不自动创建」MEMORY.md）。 |
| `workspace/skills/` | **否决** | DSH `skill-filesystem` 原生扫描 project/custom/user roots，**已含 cwd** 发现磁盘 SKILL.md。per-agent `skills/` 是"该 agent 最高优先级"的会话级绑定问题（`ctx.skills.list({cwd})`），属于开放问题 §6.4，不属本 M1 播种面。 |
| `workspace/memory/YYYY-MM-DD.md` | **否决** | 每日记忆 log 由会话 skill（学习/回顾流程）用 fs 工具自维护，非 bootstrap 播种。 |
| **`git init`** | **不包含**（本轮排除） | OpenClaw 会自动 git init 备份 workspace。M1 里程碑明确「git init 不包含在本轮」，进程与编排（owner-guard/daemon 冷启动）后续处理；本轮只在报告中注明，插件不执行任何 git 操作。 |

**净播种面：`workspace/AGENTS.md` 一个文件。** 该文件存在时有一个明确、自动、默认开启的消费者；其余文件要么无消费者（SOUL/USER/IDENTITY/README/BOOTSTRAP），要么归属别的主题层（MEMORY → consolidation，skills → skill 会话绑定，daily → 学习 skill），要么被 git init 排除拖累（.gitkeep）。

## 4. API 说明

### `src/paths.js`（纯函数，零依赖，独立可测）
- `resolveWorkspace(agentId, configuredWorkspaceRoot?, env?)` → 绝对 workspace 根。
- `resolveDshHome(agentId, configuredAgentsHome?, env?)` → 绝对 agent DSH home。
- `sanitizeAgentId(agentId)` → 校验后的安全单分量，非法即抛 `TypeError`。
- `MAX_AGENT_ID_LENGTH`、`INVALID_AGENT_ID_RE`、env 常量、`expandTilde`。

### `src/index.js`（Cordis 插件壳）
- 命名导出 `name = 'workspace-bootstrap'`、`inject = []`（自包含，零服务依赖）、`Config`（`z.object`）：`workspaceRoot` / `agentsHome`（可为空，用默认值）/ `seedFiles`（默认 `['AGENTS.md']`）。
- `apply(ctx, config)` → `ctx.provide('workspaceBootstrap', …)`，注册 `ensure(agentId, opts?)`、`sanitizeAgentId`、`resolveWorkspace`、`resolveDshHome`。
- `ensure(agentId, { workspaceRoot?, agentsHome?, seedFiles? })`：幂等建目录 + 播种，返回 `{ workspace, dshHome }`。种子相对路径做二次穿越校验，非法即抛。

插件**不在 apply 时自动确保任何 agent 目录**——只提供能力，挂点归 Router（见 §7 下一步）。

## 5. 验证结果

`packages/workspace-bootstrap/` 用 `node --test`（node v25 内置）跑单元测试，全部用 `os.tmpdir()` 临时目录，不污染真实 home。

```
$ node --test        (working dir: packages/workspace-bootstrap)
ℹ tests 13
ℹ pass  13
ℹ fail  0
ℹ cancelled 0  ℹ skipped 0  ℹ todo 0
```

逐项覆盖（对应交付 1–6）：

| # | 需求 | 测试 |
|---|---|---|
| 1 | 映射稳定性 | 映射稳定：同 agentId 两次 `resolveWorkspace`/`resolveDshHome` 一致；`ensure` 两遍返回相同 `{workspace, dshHome}`。 |
| 2 | 幂等 | ensure 双层幂等：第二遍无异常、种子文件内容不变、无重复播种副作用（目录里 AGENTS.md 恰 1 个）。 |
| 3 | 路径安全 | `../evil`、`a/b`、`a\b`、空串、空白、`..`、`.`、`/abs/path`、`a b`、`.hidden`、`trail.`、201 字符超长、null/undefined/number/object 全部被 reject；安全 id 的 resolved workspace 恒等于 `join(root, id)`（不逃逸）。 |
| 4 | 种子文件 | `workspace/AGENTS.md` 存在且内容 == `AGENTS_TEMPLATE`（不以 `<system-reminder>` 开头）；DSH home 目录被创建（空目录）。 |
| 5 | 覆盖策略 | 预放自定义 `AGENTS.md`，`ensure` 后内容原样保留（未覆盖）。 |
| 6 | 环境变量覆盖 | `DSH_WORKSPACE_DIR` / `DSH_AGENTS_HOME` 生效；空白 env 回退默认根（不落到 cwd、不含 custom 串）。 |

## 6. 已知限制与未决问题

### 已知限制
- 仅播种 AGENTS.md；SOUL/USER/IDENTITY/MEMORY/skills/daily 均未播种，相关消费者属于后续主题层（见 §3 否决表）。因此 M1 验收里「MEMORY.md 模型可读写」不在本插件的播种面内——它由 memory/consolidation 层负责文件，本层不产 MEMORY 种子。
- 路径安全基于字符白名单，未做 symlink 的 realpath 解析（`ensure` 递归 mkdir 会跟随既有符号链接）。生产若需防符号链接逃逸，需在 resolve 前对已有祖先 realpath 化（DSH `canonicalizeWatchPath` 思路），本轮未做。
- `workspaceRoot`/`agentsHome` 配置与 env 仅做 `expandTilde`，可接受相对路径经 `resolve` 绝对化；不做多级嵌套归一。
- git init 全覆盖缺失（见 §3 最后一行）。

### 未决问题
- §6.1 **workspace 与 DSH_HOME 的分离粒度**：本层把二者做成两条独立根（workspace 默认 `~/.dsh/workspaces`，agent home 默认 `~/.dsh/agents`）。是否应直接复用 `$DSH_HOME` 单根（即 workspace 挂 `$DSH_HOME/workspaces/<id>`、home 挂 `$DSH_HOME/agents/<id>`）待定——会与 DSH 自身的单根语义/session 持久化目录关系密切，需一次跨主题对齐。
- §6.2 **agentId 命名规范来源**：`sanitizeAgentId` 定义的是「安全字符约束」，但 agentId 的**合法来源/命名规范**（谁来生成、是否复用 DSH session/agent id 格式、是否包含 UUID）未定。当前仅约束字符集；来源由 Router/编排层决定。
- §6.3 钩子 vs preset 挂点、AGENTS.md race：见 §7。
- §6.4 per-agent `skills/` 的 cwd 层绑定与「最近一层胜出」语义需在 skill 注册层验证（继承 `workspace-files.md` §8.4）。

## 7. 下一步（挂点）
按 `docs/investigations/workspace-files.md` §8.2（原开放问题 2）：播种应挂在 `agent/pre-step`（首个 eligible 步骤）**还是** preset 组合创建时？两者权衡：
- `agent/pre-step`：在首轮 turn 开始前 execute，保证**播种的 AGENTS.md 在 `agent-instructions` 首个 baseline 渲染之前**被 agent-instructions reload 机制抓到（最小化 race）。但需要 agentLoop 暴露 pre-step 钩子（host 侧）；
- preset 组合创建：更早、更接近 session 创建，但需确保 agent-instructions 的 reader 在其后重跑，否则首个 baseline 仍是旧的。

推荐：能力侧（本插件）已就绪，实测哪个会话创建路径先执行 `ensure` 即可把 workspace 写入 `session.header.cwd`。**M1 验收增量**：新 agent 的 `session.cwd` 指向已播种目录 + AGENTS.md 进入首轮上下文；Router 在 `agent/pre-step` 调用 `ctx.workspaceBootstrap.ensure(agentId)` 并将结果写入 `meta.cwd`。这是 Router 的挂点职责，不属于本插件。

## 8. 交付物清单
- `packages/workspace-bootstrap/package.json`
- `packages/workspace-bootstrap/src/paths.js`
- `packages/workspace-bootstrap/src/index.js`
- `packages/workspace-bootstrap/test/paths.test.js`
- `packages/workspace-bootstrap/test/ensure.test.js`
- `docs/reports/workspace-bootstrap-v0.md`（本文件）
