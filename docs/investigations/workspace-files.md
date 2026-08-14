# Workspace-Files Investigation

## 1. Required behavior

对标对象是 OpenClaw 的「长期 Agent 工作目录」设计。OpenClaw 将工作区视为
「agent 的家」——默认 cwd、文件工具的相对路径基准、以及"记忆"的落盘位置。官方
文档（[agent-workspace](https://docs.openclaw.ai/concepts/agent-workspace)、
[personal assistant setup](https://docs.openclaw.ai/start/openclaw)）确认的约定：

- **目录位置**：默认 `~/.openclaw/workspace`；`agents.entries.*.workspace` 支持
  逐 agent 覆盖；非默认 agent 未显式指定时落到 `<state-dir>/workspace-<agentId>`。
  这是 **cwd，不是硬沙箱**（绝对路径仍可越界，除非开 `agents.defaults.sandbox`）；
  开沙箱且 `workspaceAccess != "rw"` 时改在 `~/.openclaw/sandboxes` 下工作。
  与存 config/凭据/session DB 的 `~/.openclaw/` 分离。
- **文件 Map**（onboarding 自动创建）+ 生命周期：
  - `AGENTS.md` —— 操作指令/"怎么行为"，每会话开始加载；`## Tools` 段只做环境
    工具约定的**说明**，不控制工具可用性。
  - `SOUL.md` —— persona/语气/边界，每会话加载；`USER.md` —— 用户偏好/关系
    （可选，独立 4000 字符预算）；`IDENTITY.md` —— name/vibe/emoji。
  - `MEMORY.md` —— 精选长期记忆（可选，**永不自动创建**，只在主/私密会话加载，
    群/共享上下文不注入）。
  - `memory/YYYY-MM-DD.md` —— 每日记忆日志，会话开始时建议读今天+昨天。
  - `BOOTSTRAP.md` —— 仅全新工作区首跑，跑完即删；`BOOT.md` —— 可选启动清单。
- **skills/** —— 工作区级 skill（最高优先级；目录含 `SKILL.md` = YAML frontmatter +
  markdown 正文；优先级梯：workspace > project > personal `~/.agents/skills` >
  managed > bundled > `skills.load.extraDirs`）。
- **canvas/**—— Canvas UI 可选目录。**注意：不存在 `attachments/`、`inbox/` 目录**
  （README 提的 attachments/inbox 是 Discord/WhatsApp 等 channel 媒体与消息轮询
  管线，非工作区文件约定——调查子代理核实过源码）。
- per-agent 运行时状态（sqlite、sessions、credentials）放在 `~/.openclaw/agents/<agentId>/`，
  **不属于**工作区。
- 工作区会被当作私密 git 仓库自动 `git init` 备份；over-budget 的文件只在上下文内
  截断，磁盘不动。

本主题的 required behavior = 让每个 Agent（或 Agent 的会话）拥有一个持久、隔离、
约定文件（AGENTS.md / SOUL / USER / MEMORY / memory 日志 / skills）可加载、可读写、
可备份的长期工作目录，并让模型能感知与该目录相关的操作说明与记忆。

## 2. DSH native capabilities

对 DSH checkout（本机路径以实际为准）的实读结果：

**2.1 `packages/workspace`（workspace 包）—— 关键认知修正**
它是「工作区实体注册表」，**不是** per-agent 目录布局。
- 描述见 `packages/workspace/workspace/package.json:3`「Workspace entity registry」。
- `packages/workspace/workspace/src/index.ts:92-93` `WorkspaceRegistry extends Service`,
  `inject=['storageDomain','sessionPersistence']`——不依赖 fs/agent。
- `create(path, title?)` 用 `fs.realpath` 规范化且**拒绝不存在的目录**
  （`index.ts:158-164`）；`resolveByPath` 也是 realpath 化（`277-283`）。
- 职责是 a) 把某个已存在的目录登记为 workspace 记录 + b) 把 session 头 `cwd`
  与 workspace 路径匹配归组（`attachSession`，`index.ts`；bootstrap 用
  `sessionPersistence.list()` 的 header `id/cwd/createdAt` 归组，`readme:21`）。
- README「What the model sees: Nothing」—— 它不注册任何 tool、不注入 prompt、
  不写 session event（`readme:29-31`），纯 host 侧 UI/分组面。

**2.2 `packages/fs`（filesystem 一刀切 seam）—— 文件 IO 已完备**
- `fs/fs`：`ctx.fs` seam 定义（`fs/fs/src/*`），12 个 primitive：resolve/processPath/
  fileUrl/contains/stat/lstat/readText/streamText/readBytes/listDir/writeText/editText，
  全部原子写 + 可选版本守卫（`fs/fs/README.md:20-37`）。语义近似 fsspec，**只做文本**，
  二进制/非 UTF-8 拒 `FS_NOT_TEXT`；无 delete/rename/move/copy/watch，listDir 单层
  （`README.md:63-64`）。
- `tool-fs`：模型可见 `read/write/edit/read_image`（sch. `docs/tool-catalog.md:599-714`）；
  `tool-fs-search`：模型可见 `glob/grep`，用打包 `@vscode/ripgrep` 经 `ctx.subprocess`
  （`tool-catalog.md:716-774`）；`tool-str-replace-editor`（`tool-catalog.md:529-598`）。
- `fs-observation-policy`：read-before-edit + 版本守卫 write/edit，经 `fs/*` 事件门
  （`fs/fs-observation-policy`，`base/cordis.patch.yml:221-222`）。
- 沙箱封装：`fs-sandbox`（`fs/fs-sandbox`），与 `sandbox-policy` 共享
  workspaceRoot + mode（`capability-seams.md` row `ctx.fs`/`ctx.sandboxPolicy`）。

**2.3 `packages/core/fs`** —— 不存在。核心是 `core/session`（session）、`core/tools`
（工具注册）、`core/agent`/`agent-loop`（Agent 工厂+循环）。文件 IO 的权力在
`packages/fs/*`，`cwd` 是 session header 字段（`core/session/src/types.ts:73,115`）。

**2.4 lscwd / per-agent 边界（关键）**
- per-agent workspace = session header 的 `cwd`。`core/agent-loop/src/index.ts:353`
  `ctx.systemPrompt.variable('cwd', ctx => ctx.agent?.session.header.cwd)`，把
  session 的 cwd 暴露为系统提示变量；配置侧 `Config.agents[].cwd`
  （`index.ts:267-270,356`）在创建会话时 `meta.cwd`（`index.ts:589`）。
- 该 cwd 也是 bash 工具 `workdir` 默认基准（`tool-catalog.md:202`）与 fs `resolve`
  的 `opts.cwd`（`fs/fs/README.md:24`）。
- **没有任何自动创建 per-agent 目录的机制**：workspace registry 要求目录已存在。
- sandbox workspaceRoot 默认 = `process.cwd()`（`base/cordis.patch.yml:176`），
  由部署覆盖。

**2.5 `packages/attachment`** —— durable 附件 seam：`ctx.attachments` 内容寻址、
原子提交图片字节，返回可序列化引用；仅 PNG/JPEG/WebP/GIF（`attachment/attachment/README`
`readme:17-19`）。**不支持通用文件/音频/视频**，「generic files … require separate
lifecycle」（`readme:20`）。模型侧由 `read_image` 暴露（`tool-catalog.md:667`）。

**2.6 `packages/skill`** —— 现成、成熟的 skill 系统：
- `skill/skill` `ctx.skills` 注册表 + per-scope 分层（`skill/README.md:5-9,15-19`）。
- `skill-filesystem`：磁盘发现，扫描 project/custom/user roots，
  `$DSH_AGENTS_HOME`/`~/.agents`，发现目录 bundle + flat markdown skill、解析
  YAML frontmatter（`skill-filesystem/src/index.ts:1-15,37-57,164,247,254`）。
- `tool-skill` 模型可见 `skill`（tool-catalog.md:596-... `dsh-tool-skill`）。
- **skill 载体与 OpenClaw 完全同构**（目录 + SKILL.md + frontmatter），可直接 ADAPT。

**2.7 AGENTS.md —— DSH 原生支持（critical 正面发现）**
`packages/context/agent-instructions`（在 `base/cordis.patch.yml:232-233` 与
web-app 均默认启用）：
- 与 `AGENTS.md` 兼容的 workspace 指令加载：读 `$DSH_HOME/AGENTS.md`，再沿
  project root → `header.cwd` 每层读 `AGENTS.md`/`CLAUDE.md`（+ 默认 overlay
  `AGENTS.local.md`/`CLAUDE.local.md`），逐层 reload、预算 `maxBytes`
  （`base/cordis.patch.yml:236` = 65536），随文件读写变化注入 `user/message`
  （`agent-instructions/README.md:5-13,57-72`）。
- 权威语义：`AGENTS.md` 优先级 > `CLAUDE.md` 内容去重；`<system-reminder>`
  框架注入。这 = OpenClaw `AGENTS.md` 的等价物（且更自动）。
- DSH 自仓库也遵循分目录 AGENTS.md（根 `AGENTS.md` + `packages/schedule/AGENTS.md`
  等），说明分层约定是自用的、agent-instructions 能吃到。

**2.8 shell / sandbox / subprocess / terminal / code-runtime / mcp**
- `shell` `ctx.shell`：bash/pwsh 执行 seam；`tool-bash` 模型可见（tool-catalog.md:176）；
  `shell-env` 注入 `DSH_HOME`/`DSH_SESSION_ID`/`DSH_SESSION_JSONL` 等受管变量
  （`shell/shell-env/README.md:5,20-22`），每 shell 调用重建、进程隔离。
- `sandbox` `ctx.sandbox` + `sandbox-policy`（mode + workspaceRoot）封装 argv；
  `fs-sandbox` 用同 mode 围栏写。`subprocess` seam + local/e2b。
- `terminal` `ctx.terminals` 持久 PTY（owner 隔离）；`code-runtime` 模型代码执行
  seam（Code Mode）；`mcp-client` 把 MCP server 工具桥到 `ctx.tools`
  （`mcp/mcp-client/package.json`）。

**2.9 记忆/长期状态 —— 无 `memory` 包**
- 无 `MEMORY.md`/`SOUL.md`/daily-log 的包；最接近的是 `compaction`（上下文压缩，类比
  "auto-flush"）、`session` append-only event log + JSONL 持久化、`skill-filesystem`。
- 本会话 skill 目录里的 `learning-review`（强制 AGENTS.md/MEMORY.md/SOUL.md 行数上限）
  是**会话级 skill 约定**，证明 DSH 能靠文件+skill+compaction 自己搭 memory workflow，
  但无原生 built-in。

## 3. Existing community plugins

用 DDGS（本地库，`smart-search` skill）搜索社区/生态：

- **OpenClaw 文件/目录设计**（可参考的约定，非"插件"）：
  agent-workspace/memory/skills 三页官方文档权威描述了 2.x 的结构
  （[agent-workspace](https://docs.openclaw.ai/concepts/agent-workspace)、
  [memory](https://docs.openclaw.ai/concepts/memory)、
  [skills](https://docs.openclaw.ai/tools/skills)、
  [AGENTS.default](https://docs.openclaw.ai/reference/AGENTS.default)）。
- **Cordis/Koishi 生态**：`@koishijs/plugin-database-{memory,mongo,mysql,sqlite}`、
  koishi-plugin-redis 等**全是 bot 上下文**的数据库插件；koishi 的 "workspace"
  是 monorepo 开发目录，**没有**非 bot 的通用 file/workspace 插件可复用
  （[koishi plugins](https://koishi.chat/en-US/plugins/)、
  [cordis](https://github.com/cordiverse/cordis)）。
- **DSH 生态**：`dshplugins.com` 列的多为 Web UI 皮肤类；核心 file/workspace 面由
  DSH 自带的 `fs/*`、`workspace`、`attachment`、`skill`、`agent-instructions`
  包覆盖，原生已优于社区。未发现现成的 per-agent 目录 bootstrap / memory-file 插件。

结论：**无现成第三方插件值得直接采用**；OpenClaw 的文件/记忆约定是"ADAPT 的蓝本"，
DSH 原生 `fs/attachment/skill/workspace/agent-instructions` 是复用的基础设施。

## 4. Evidence

- DSH `workspace` 是注册表非目录布局：`packages/workspace/workspace/src/index.ts:92,158-164,277-283`；`README.md:29-31`。
- per-agent cwd：`packages/core/agent-loop/src/index.ts:267-270,353-356,589`；`packages/core/session/src/types.ts:73,115`。
- fs seam：`packages/fs/fs/README.md:20-37,63-64`；tool schemas `docs/tool-catalog.md:599-774`；`base/cordis.patch.yml:221-228`。
- AGENTS.md 原生：`packages/context/agent-instructions/README.md:5,9,57-72`；`base/cordis.patch.yml:232-236`。
- sandbox/shell：`base/cordis.patch.yml:175-191,443-444`；`shell/shell-env/README.md:5,20-22`。
- attachment：`packages/attachment/attachment/README.md:5-7,17-20`。
- skill：`packages/skill/skill/README.md:5-19`；`skill-filesystem/src/index.ts:1-15,37-57,164,247,254`。
- 项目内 V0 对照：`docs/reports/bootstrap-v0.md` D 表（skill/attachment 未用，注明"复用不重写"）。D 表第 109 行把「长期记忆/技能」映射到 `dsh-skill + session-projection`，**未覆盖 per-agent 目录 bootstrap**，是本调查新增的事实。
- OpenClaw 约定：<https://docs.openclaw.ai/concepts/agent-workspace>、<https://docs.openclaw.ai/start/openclaw>、<https://docs.openclaw.ai/tools/skills>、<https://github.com/openclaw/openclaw/blob/main/docs/concepts/agent-workspace.md>。

## 5. Gaps

对照 OpenClaw 的 per-agent workspace，DSH 现状：

| 能力 | 状态 | 说明 |
|---|---|---|
| 文件读写/搜索（read/write/edit/glob/grep） | ✅ 原生 | `fs/*` + `tool-fs` + ripgrep，无缺口 |
| AGENTS.md 自动加载/reload/预算 | ✅ 原生 | `agent-instructions`（base bundle 默认开），且更自动（随 fs 触碰动态注入） |
| per-agent 目录**自动创建与 bootstrap 文件播种** | ❌ 缺失 | DSH 只接受"已存在目录"；无 AGENTS/SOUL/USER/IDENTITY/MEMORY 种子，无 git init |
| per-agent 目录**是否随 profile/preset 隔离** | ⚠️ 半 | 隔离靠 `cwd`（session meta）与 preset 的 `isolate` realm / sandbox root，**无约定目录命名**（无 `workspace-<agentId>` 等价物） |
| MEMORY.md / SOUL.md / USER.md / memory/YYYY-MM-DD.md | ❌ 缺失 | 无原生 memory 文件概念；`compaction`+session 日志是替代，不是"agent 写自己的记忆文件" |
| 每日记忆 log（memory/date.md） | ❌ 缺失 | 无内建；可由 fs+shell+cron 自搭 |
| 附件（attachments/inbox） | ⚠️ 半 | OpenClaw 工作区**本无** attachments/inbox 目录（channel 媒体是另一条管道）；DSH `attachment` seam 收图片、存 `DSH_HOME`，通用文件/音频/视频需扩展 |
| per-agent 运行时状态与工作区分离 | ⚠️ 缺 | OpenClaw 把 sqlite/sessions/credentials 放 `<state>/agents/<id>/` 与 cwd 隔离；DSH 的 cwd 与会话存储天然分离，但无此目录约定 |
| skills/ 目录、precedence 梯 | ✅ 原生 | `skill-filesystem` 磁盘发现 + 分层 + 优先级，与 OpenClaw SKILL.md 同构 |
| 备份/git 管理 workspace | ⚠️ 缺 | 无自动 `git init`，需自己搭 |

真正的 V1 缺口一句话：**DSH 有"文件 IO + AGENTS.md + skill + workspace 实体注册"，
但没有"per-agent 长期目录的创建/播种/命名/记忆文件/记忆 workflow"这一层约定。**

## 6. Options

- **A. 只复用原生，不新增**：靠 `cwd` + `agent-instructions` + `fs` + `skill` 手动约定
  目录。代价：每个 agent 目录要自己建、无种子、无 MEMORY 语义，非"开箱即用"。
- **B. 写一个 workspace bootstrap 插件（BUILD）**：在 agent 创建时（hook
  `agent/pre-step` 或 preset 组合处）按 agentId 自动建 `workspace-<id>/`、播种
  AGENTS.md/SOUL/USER/IDENTITY（可加 MEMORY），把目录路径写入 session `cwd`；
  用 `skill-filesystem` 读 `skills/`；用 `agent-instructions` 自动读 AGENTS.md。
  记忆文件（MEMORY.md/daily）由会话 skill（如学习/回顾流程）用 fs 工具自维护。
- **C. ADAPT OpenClaw 约定**：采纳 AGENTS/SOUL/USER/IDENTITY/MEMORY + memory/daily
  文件 Map 作为 Agent Core 的"工作区文档规范"，映射到 DSH 的
  `skill-filesystem`（skills/）+ `agent-instructions`（AGENTS.md）+ fs tools（其余）。
- **D. 扩 attachment**：给 `attachment` 加通用文件/音频/视频 + inbox 模型（可选，
  非 V1 必需）。

## 7. Recommendation

**主 Recommendation：BUILD** —— 写一个 Agent Core 工作区 bootstrap 插件，补上
"per-agent 长期目录的创建/播种/命名/记忆文件约定"这一层；文件 IO、AGENTS.md、
skill、附件 seam 全部 ADOPT 复用 DSH 原生包，不重写。

子项动词表：
- **BUILD** `workspace-bootstrap` 插件：agent 创建 hook 里按 agentId 建
  `workspace-<id>/`、播种 AGENTS/SOUL/USER/IDENTITY（+可选 MEMORY），把路径写进
  session `cwd`、`git init`。理由：这是 OpenClaw 最核心的一次性缺口，原生无可替代。
- **ADAPT** OpenClaw 的 workspace 文件 Map（AGENTS/SOUL/USER/MEMORY/memory/daily）
  作为磁盘约定文档。理由：约定与 `agent-instructions`/`skill-filesystem` 天然兼容，
  零代码即可对齐。
- **ADOPT** `fs/*`（read/write/edit/glob/grep + observation-policy）、
  `agent-instructions`（AGENTS.md 自动加载）、`skill`/`skill-filesystem`（skills/）为
  基础设施。理由：全部原生、默认在 base bundle，无外部采用价值。
- **ADAPT** `skill-filesystem` 承接 OpenClaw `SKILL.md`/skills/ 前缀约定。
  理由：同构，只需确认 frontmatter 与 precedence 映射。
- **DEFER** 通用附件（attachment 扩非图片）+ inbox 目录模型。理由：V1 只需图片引用；
  通用文件/音频复用 `fs` 即可，inbox 是 channel 语义不属于本主题。
- **DEFER** 每日 memory log 自动化与备份编排。理由：可先用文件 + compaction 手动搭，
  是后续优化。

## 8. Open questions

1. **per-agent 目录所有权与命名**：`workspace-<agentId>` 应放在哪个根（`~/.dsh/workspaces/`
   还是 `$DSH_WORKSPACE_DIR`）？与共享 workspace（多个 agent 同 cwd）如何共存——
   DSH 的 `workspaceEntity` 是"目录→workspace"一对一，若多个 agent 共用一目录，
   bootstrap 播种与 cwd 归属是否要按 agent 再分层？
2. **bootstrap 与 preset 的挂点**：播种应挂在 `agent/pre-step`（首个 eligible 步骤）
   还是 `agent-presets` 组合创建时才做？如何保证播种的 AGENTS.md 在
   `agent-instructions` 首个 baseline 之前被抓到（race）？
3. **记忆 workflow 归谁管**：MEMORY.md/summary 的内存与"压缩"语义是放 session
   compaction 扩展，还是放一个独立的 memory-folder 管理插件？OpenClaw 有
   Honcho/dreaming/compaction 三档，DSH 只该复刻哪一档？
4. **skills/ 的 per-agent 范围**：`skill-filesystem` 目前是全局 + preset 层；
   per-agent 工作区 `skills/` 要作为该 agent 的最高优先级，是否需要在 skill 注册的
   scope/layer 上做 per-cwd 绑定（现有 `ctx.skills.list({cwd})` 已支持按 cwd 过滤，
   但"最近一层胜出"的语义要验证）。
5. **多/共享工作区**：OpenClaw 强烈建议单一 active workspace；Agent Core 是否需要
   DSH `workspaceRegistry` 已经支持的"多 workspace + session 分组"来支撑每个 agent
   若干项目目录？
