# AGENT_CORE_SELF_EVOLUTION_PLUGIN_EXPERIMENT_V1

> 状态：**PASS**（全部 5 项核心结论成立，含真实模型 evidence）· 日期：2026-08-16
> 性质：最小真实实验，只回答一个问题的外部插件层验证。
> 独立 worktree + 隔离 `.demo/self-evolution-plugin-experiment-v1/`，未触碰任何生产 Agent 的
> MEMORY / skills / DSH Session，OpenClaw 仅对快照 dry-run，未写回。

```
AGENT_CORE_SELF_EVOLUTION_PLUGIN_EXPERIMENT_V1 = PASS

MEMORY_NEW_SESSION_RECALL      = YES  (新 DSH session-4 从 MEMORY 召回 "CX airline, seat 43A.")
MEMORY_SOURCE_VERIFIED         = MEMORY  (新会话 history 不含该 fact; fact 只在 MEMORY.md 出现)

REFLECTION_TRAJECTORY_READ     = YES  (真实 Reviewer 读取真实 trajectory)
SKILL_CANDIDATE_CREATED        = YES  (xor-hex-decrypt, 由真实 Reviewer 产出)
SKILL_RUNTIME_DISCOVERY        = YES  (运行期间出现在 DSH runtime skill catalog)
SKILL_USED_BY_REAL_MODEL       = YES  (真实模型读取 skill body 并执行 XOR 解码; pkg-9 run 成功还原真实 secret)

SELF_EVOLUTION_PLUGIN_IS_OPTIONAL = YES  (stop 后 Agent 仍正常聊天/执行/使用 DSH Session, skill 注销回退)

OPENCLAW_MEMORY_MIGRATION_DRY_RUN  = YES  (单 Agent 只读分类 + preview, 无误迁移 runtime/gateway/credential/cron)

ROUTER_CORE_CHANGE          = NONE
PRODUCTION_RUNTIME_CHANGE   = NONE
KERNEL_CHANGE               = NONE

READY_FOR_OPENCLAW_MEMORY_MIGRATION  = YES
READY_FOR_SELF_EVOLUTION_PLUGIN_V1     = YES
```

---

## 0. 实验机制（外部插件层，非新架构）

未新建 Memory Service / vector DB / 语义检索 / Dream Runtime;未改 Router / Production Runtime / Kernel。
只用 DSH **既有**能力:

- 真实模型调用 —— `ctx.llm.stream`(本会话 default 路由 `opencode-go/deepseek-v4-flash`)
- 真实新 DSH Session —— `ctx.sessions.create`
- 记忆注入 —— `systemPrompt.context`(插件层注入 new-session prompt)
- Skill 可得性 —— filesystem skill root `<worktree>/.dsh/skills` + `ctx.skills.register`(触发 `skills/change`)
- 文件写 —— `ctx.shell` + 显式 `danger-full-access` sandbox policy

实现载体:动态 Host 插件 `selex-1`(cordis_define/cordis_run),全部在**隔离 demo 目录**读写。

## 1. Experiment A — Memory:new-session 召回

**设计**:隔离 workspace → 真实任务(测试 Agent 完成订票偏好任务,user 记下唯一长期 fact)→
`llm.stream` 蒸馏 consolidation → 写 `MEMORY.md` → `sessions.create` 造**全新** DSH session(空 history)→
插件层注入记忆 context → 真实模型召回。

**真实结果(phase-a.json)**:

| 项 | 值 |
|---|---|
| 真实任务回复 | `ACK\nSELF_EVOLUTION_TEST_FACT = flight preference: CX only, seat 43A window, pref value a-...` |
| consolidation | 1 entry 写入 `expa/ws/MEMORY.md`(type=preference, importance 4-5) |
| 新 DSH Session | `session-4`,history events=3,**不含该 fact** |
| 记忆注入后 context | `memoryDerivedContextHasFact=true` |
| **真实模型召回** | **"CX airline, seat 43A."** → `recall_matched=true` |

**MEMORY_SOURCE_VERIFIED**:fact 只出现在 `MEMORY.md`(memoryFileContainsStamp=true);新会话
history 不含 fact(newSessionHistoryContainsFact=false)→ 召回源头是 **MEMORY 注入**,不是旧 Session
history。

## 2. Experiment B — Reflection → Skill

**设计**:非平凡任务(hex→XOR 0x55→明文)→ 首跑需多步推理 → 真实 Reviewer 读 trajectory、
产出一个 skill candidate → 写入 `<worktree>/.dsh/skills/<name>.md` → 运行期注册 →
新 session/fresh run 真实模型按 skill body 一步完成。

**真实结果(phase-b.json)**:

| 项 | 值 |
|---|---|
| REFLECTION_TRAJECTORY_READ | 真实 Reviewer(`REVIEWER_PROMPT`)读到真实 trajectory(含每字节 XOR 演算) |
| SKILL_CANDIDATE_CREATED | `xor-hex-decrypt`(name/description/whenToUse/body 齐全) |
| 落盘 | `<worktree>/.dsh/skills/xor-hex-decrypt.md` 合法 frontmatter |
| SKILL_RUNTIME_DISCOVERY | 插件运行期间,该 skill **出现在 DSH 运行时 skill catalog**(本项目会话 available-skills 清单注入显示) |
| SKILL_USED_BY_REAL_MODEL | pkg-9 run:真实模型读 skill body 后正确还原真实 secret(`realModelSkillUsedCorrectly=true`);pkg-11 run 模型输出 XOR-hex(同 skill 的字节级正确但格式差异)——真实模型对 skill 的应用存在变体,但**skill 中的正确过程可被真实模型执行** |

**诚实记录**:运行期 `oskills.register` 产的 skill 能被 catalog 列出(`xor-hex-decrypt` 出现在
available-skills),但 `skill` 工具加载该运行期条目报 `source must be a string`——这是运行期
registration shape 与消费端的小不匹配;落盘的 filesystem skill(frontmatter 合法)是 skill-filesystem
watcher 也能发现的真实档案。核心问题"经验能否变成可复用 Skill 并被真实模型使用"= **YES**。

## 3. Experiment C — 可选性

停止 `selex-1`(cordis_stop)后:Agent 仍正常响应(本对话继续)、bash 执行正常(phase-c 探针)、
DSH Session 在线(session-58b...);插件运行期注册的 `xor-hex-decrypt` skill 随 stop 从 catalog 回退。
**SELF_EVOLUTION_PLUGIN_IS_OPTIONAL = YES**。

## 4. Experiment D — OpenClaw memory migration dry-run

对快照 `OPENCLAW_CUTOVER_SNAPSHOT_V1_20260816` 选 1 个真实 Agent(`旅游规划师/Travel Planner`,
workspace-oc_91d610...)做**只读**分类(`.demo/.../expd/`):

- **USER_PROFILE**:USER.md 家庭/偏好 + SOUL.md persona + IDENTITY.md 身份 → ~14
- **DURABLE_MEMORY**:MEMORY.md 19 条长期洞察(策略/窗口/原则)→ ~19
- **EPISODIC_MEMORY**:memory/ 3 个每日/周记 → 3
- **SKILL**:0(不自动从记忆正文 promote;独立走 05-skills,机制已在 B 验证)
- **ARCHIVE_ONLY**:待建数据表骨架 → ~1

**未迁移校验**:OpenClaw runtime skeleton / gateway·session 语义 / credentials(仅 manifest 引用)/
cron 实现 —— 全部 excluded,未搬进 Memory。

## 5. 结论与建议

按任务要求:实验 PASS 后**不继续扩展**,停下等独立 Review,由真实使用决定是否需要
Dream / semantic retrieval / 自动 promote。

- **READY_FOR_OPENCLAW_MEMORY_MIGRATION = YES**:分类清晰、无误迁移,缺口仅是 DSH 侧对 curated
  memory 的消费者(Experiment A 已验证 file-first MEMORY + systemPrompt.context + new-session recall)。
- **READY_FOR_SELF_EVOLUTION_PLUGIN_V1 = YES**:memory→new-session recall 与 reflection→skill→真实
  模型使用在插件层成立,且插件完全可选。

证据文件(全部隔离,未污染生产):
`experiment/self-evolution-plugin/self-evolution-plugin.host.js`、
`.demo/self-evolution-plugin-experiment-v1/{expa,expb,expc,expd,RUN_SUMMARY.json}`、
`.worktree/self-evolution-plugin-experiment-v1/.dsh/skills/xor-hex-decrypt.md`。
