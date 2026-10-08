# Agent Core Product Architecture V1

> 状态：冻结草案（docs-only）· 日期：2026-08-15  
> Authority amendment：2026-08-18  
> Authority amendment（DRAFT_EXISTING_POLICY）：2026-10-03 · #441 · 见 §7；待审，未接受。
> 基线：`69273a9`（Integration V1 已合并）；契约：`AGENT_SESSION_CHANNEL_MODEL_V1`（D-002）  
> 本文件回答：**最终 Agent Core 到底是什么、每一层归谁负责、哪些边界永不跨越**。
>
> **安全域声明修订：**本文件原先把“one Agent = one DSH process”直接冻结为
> peer-Agent 对抗性安全域。该 claim 已被
> [`AGENT_CORE_HARDENING_PROGRAM_V1`](specs/AGENT_CORE_HARDENING_PROGRAM_V1.md)
> amendment：
>
> ```text
> PEER_AGENT_SECURITY_DOMAIN_CLAIM = SUPERSEDED
> REPLACED_BY = AGENT_CORE_HARDENING_PROGRAM_V1
>
> one Agent = one DSH process
> = runtime / lifecycle / DSH_HOME / Session-owner boundary
> != current adversarial peer-Agent isolation boundary
> ```
>
> 当前同主机、共享运行身份的 Agents 属于 cooperative shared-host trust domain；
> Control Plane、Broker credential 与 service credential 仍必须对 Agent 保密。
> 本文件其余 ownership / thin-layer / DSH-native 边界不受该 amendment 影响。

---

## 0. 一句话总结

**Agent Core 是基于 DeepSeek Harness 的一层薄组织层：把 DSH 的通用 Agent 运行时组织成
一批长期存在的「数字员工」——每个员工有稳定身份、专属 workspace 与 DSH 进程、多个
会话、跨会话记忆、独立进程身份，能调用外部业务能力，也能长出新技能。**

它**不重做** DSH 的任何运行时能力，也不替代 Forum / Workflow / OKR——它只负责
「员工是谁、在哪里办公、正在和谁聊、什么时候上班、怎么安全地访问外部系统」。

类比（帮助理解，不替代定义）：

| 概念 | 人话 |
|---|---|
| Agent | 花名册上的一个员工 |
| Workspace / DSH_HOME | 员工的专属办公桌和抽屉 |
| Session | 员工和不同人谈不同事情留下的谈话记录 |
| Memory | 员工跨所有事情沉淀下来的长期经验 |
| ChannelConversation | 某个聊天软件里的一条会话 |
| Binding | 「这个聊天窗口当前连的是哪位员工」的工牌插槽 |
| Router / Control Plane | 前台 + 调度员 |
| Process | 员工今天上班的工位（一个 Agent = 一个独立工位/进程） |
| Process Credential | 门禁卡（证明我是这位员工） |
| Broker | 公司唯一的对外业务窗口 |
| Plugin Lifecycle | 学会并保留新技能 |

---

## 1. 目标形态与分层

```
Channels / Product UI
  Feishu / WeChat / Mobile / Web
            ↓  只做传输与展示
ChannelConversation + Binding
            ↓  渠道落地入口（幂等 resolve；Binding 表达“当前在聊谁”）
Agent Core Control Plane
  ├─ Agent Registry      = 花名册（这个 Agent 是谁）
  ├─ Session             = 谈话记录管理（这个 Agent 有哪些独立对话）
  ├─ Workspace Bootstrap = 办公桌在哪（agentId → workspace / DSH_HOME）
  ├─ Router / Process Supervisor = 前台/调度员（消息找谁 + 进程何时启动/恢复）
  ├─ Memory              = 跨 Session 的长期经验
  ├─ Plugin Lifecycle    = 新技能（实验 → 验证 → 保留 → 回滚）
  └─ Proactive Runtime   = 没人催也会继续工作（schedule/goal/inbox 之上的薄层）
            ↓
one Agent = one DSH process
  （运行时 / 生命周期 / DSH_HOME / Session-owner 边界；
    当前不是 shared-host peer-Agent 对抗性隔离边界）
            ↓
DSH（Runtime）
  loop / tools / fs / shell / skills / agent-instructions
  subagents / compaction / goal / inbox / session persistence
            ↓
Generic Broker Bridge（统一外部能力入口，进程凭据身份）
            ↓
Forum / Workflow / OKR / 其他外部业务系统
```

---

## 2. Product Concepts — 精确含义与所有权

### Agent（长期实体）

- **定义**：全局唯一的长期实体，代表一位「数字员工」。拥有并独占：workspace、
  DSH_HOME、credential、memory、会话存储、进程身份。
- **生命周期**：预置时自动创建其 `main` session；存在与生命周期不依赖任何 Channel。
- **人话**：花名册上的一个员工——有工号、有办公桌、有自己的抽屉，不管今天有没有人
  来找他聊天，他都存在。
- **所有权**：Agent Core Control Plane（Registry 登记身份，Workspace Bootstrap 给
  办公桌，Process Supervisor 管工位）。

### Session（属于 Agent）

- **定义**：Agent 之下的一条独立对话。**Session identity = (agentId, sessionId)**
  （实验证据，Session V1 PoC 已定案）：DSH SessionId 作用域是 per-Agent DSH_HOME，
  非全局，因此 Agent A/main 与 Agent B/main 可同时存在。`main` 为每个 Agent 的
  保留 SessionId（长期主会话，不可归档/删除）；`normal` 会话用其他 opaque
  sessionId，可新建、归档（软）、删除（硬）、定期清理（保留期=配置）。
- **人话**：员工和不同人谈不同事情的谈话记录——「和论文导师聊论文」一条，「和财务
  对报销」另一条；记录本放在员工自己的抽屉里（per-agent DSH_HOME）。
- **所有权**：Agent 拥有；**Session Runtime 全部由 DSH 原生负责**（identity /
  trajectory persistence / create / resume / process death recovery）。Agent Core
  **不建 Session mapping layer、不建独立 session 包**（product sessionId = DSH
  native sessionId）；Product API milestone 只维护产品元数据（title / kind /
  archived / lastActiveAt）。

### ChannelConversation（渠道侧会话）

- **定义**：某个渠道里的一条会话，`(channel, externalId)` 全局唯一。渠道标识是
  不透明字符串（`feishu` / `wechat` / `android` / `web`），API 不解释其值。
- **人话**：微信里和某人的聊天窗口、飞书里的某个群——窗口本身不决定里面是谁在
  服务。
- **所有权**：控制面登记；**Channel 不拥有它上面的 Agent / Session**。

### Binding（ChannelConversation → 当前 (agent, session)）

- **定义**：每个 ChannelConversation 至多一条；表达「这个窗口当前正在和哪个 Agent
  的哪个 Session 对话」。`switchAgent` 只写 Binding（不创建/移动/复制任何
  Agent/Session，无角色扮演、无切换历史）。
- **人话**：窗口上的工牌插槽——今天这个窗口接的是张三，明天可以插上李四的工牌，
  人没变，只是窗口换了服务对象。
- **所有权**：控制面持有；渠道适配器不保存任何 Agent/Session 状态。

### Workspace（专属目录）

- **定义**：agentId 唯一对应的长期工作目录（`~/.dsh/workspaces/<agentId>`）与
  DSH_HOME（`~/.dsh/agents/<agentId>`）。AGENTS.md 播种、文件工具基准、会话存储
  都落在这里。
- **人话**：办公桌——所有东西固定放这张桌子，换人进来（进程重启）桌子还在。
- **所有权**：**workspace-bootstrap 是 agentId → 路径映射的唯一 owner**；Router 只
  决定什么时候启动进程，不复制映射规则（Integration V1 边界清理已定案）。

### Memory（长期经验）

- **定义**：Agent 跨 Session 的 curated 长期记忆（区别于 DSH session 日志）。
  形式待定（文件记忆 / MCP 记忆 / 混合），但**不是第二套 session history**——
  它是对经历提炼后的产物。
- **人话**：员工跨所有事情沉淀下来的长期经验（「客户喜欢简洁回复」「这个项目用
  React」），不是某一次谈话的完整录音。
- **所有权**：Agent 拥有；Agent Memory 组件负责 consolidate / recall / 隔离；
  存储通道优先复用 DSH 已支持的 MCP 与文件约定。

### Process（进程身份与生命周期）

- **定义**：一个 Agent = 一个 DSH 进程（per-agent DSH_HOME）。进程是该 Agent 的
  **运行时、生命周期、DSH_HOME 与 Session-owner 边界**：可惰性启动、复用，
  崩溃后自动 respawn + resume。
- **当前信任语义**：共享主机 / 共享运行身份下的 peer Agents 属于 cooperative trust
  domain；当前进程划分不承诺 adversarial peer-Agent isolation。若未来需要 A 无法攻击
  B，必须由独立 `PER_AGENT_SECURITY_DOMAIN_V1` 冻结 per-Agent UID / container / VM /
  sandbox 等额外隔离。
- **人话**：员工上班的工位——一个员工一个工位，工位塌了（进程死了）重新搭一个，
  抽屉里的东西（持久化）原样搬回来；但当前同一办公室里的合作员工不按敌对租户隔离。
- **所有权**：Router / Process Supervisor 管「何时启动/恢复/回收」；进程凭据由
  控制面注入（Phase 3），用于保护 Control Plane / Broker 身份，不等同于 peer-Agent
  文件与主机隔离。

### Plugin / Capability

- **定义**：Agent 可动态获得的能力（DSH Cordis 动态插件 / tool）。Agent Core 提供
  生命周期治理（实验 → 测试/证据 → reviewer → promote → disable/rollback），不
  发明新的运行时。
- **人话**：学会并保留新技能——先练手，确认靠谱后正式上岗，出问题随时停用。
- **所有权**：Agent 进程内执行；当前 peer Agents 属于 cooperative trust domain。
  Control Plane / Broker 仍只相信进程外建立的 caller relationship 与 credential，
  进程内 initiator 只用于归因；Plugin Lifecycle 组件负责治理流程。

---

## 3. 层与职责（谁负责什么）

| 层 | 负责 | 不负责 |
|---|---|---|
| Channels / UI | 传输、展示、渠道原生标识 ↔ ChannelConversation 映射 | 不拥有 Agent/Session；不做业务决策 |
| ChannelConversation + Binding | 表达「这个窗口当前在聊谁」；幂等 resolve 落地 | 不保存 Agent/Session 状态 |
| Agent Registry | 这个 Agent 是谁（身份、展示、存在性） | 不拥有 process/session/memory/workspace 规则 |
| Session | Agent 有哪些会话、生命周期（main 保护、归档/清理） | 不重做对话引擎（用 DSH session） |
| Workspace Bootstrap | agentId → workspace / DSH_HOME 唯一映射 + 幂等创建/播种 | 不决定进程生命周期 |
| Router / Process Supervisor | 消息找谁（Binding 路由）+ 进程何时启动/复用/恢复 | 不拥有 workspace 路径规则；不演化成大 Kernel |
| Memory | 跨 Session 巩固/召回/隔离 | 不成为第二套 session history |
| Plugin Lifecycle | 新技能治理流程 | 不重做工具/插件运行时 |
| Proactive Runtime | schedule/goal/inbox 之上的薄封装与常驻 | 不重做调度原语 |
| DSH | Agent 真正怎么思考：loop/tools/fs/shell/skills/subagents/compaction/persistence | — |
| Broker Bridge | 以进程外建立的真实 Agent 身份安全访问 Forum/Workflow/OKR 等 | 不相信请求体自报身份；不把外部系统变成内部特例 |
| Forum / Workflow / OKR | 外部业务系统 | 不由 Agent Core 重做 |

---

## 4. 冻结的负面边界（永不跨越）

1. **Agent Core 不重做 DSH Runtime**：不写第二套 agent loop / event log / llm 路由 /
   session engine。
2. **Agent Core 不重做 Tool / Skill 系统**：工具注册、skill 发现与加载全部吃 DSH
   （tools / skill-filesystem / tool-fs / tool-bash…）。
3. **Agent Core 不重做 fs / shell / subagent**：文件、命令执行、子 agent 全部来自
   DSH。
4. **Agent Core 不重做 Session Engine**：session 事件日志、持久化、resume、
   compaction 全部来自 DSH。
5. **Agent Core 不重做 schedule / goal / inbox 底层原语**：只在其上做薄层
   （常驻、恢复编排、jobs 持久化）。
6. **Agent Core 不把 Forum / Workflow / OKR 变成内部产品特例**：它们在外面，经
   Generic Broker Bridge 统一接入，不写专用 adapter。
7. **Channel 不拥有 Agent / Session 状态**：适配器只做映射 + dispatch。
8. **Router 不拥有 workspace 路径规则**：映射唯一归 workspace-bootstrap。
9. **Registry 不拥有 process / session / memory**：Registry 只登记身份，其余各归其主。
10. **Memory 不成为第二套 Session history**：curated 产物 ≠ 原始日志。
11. **一切外部可解决的问题尽量留在 DSH / plugin / Broker / userspace**：不重新长成
    一个「大 Control Plane」。Router 只做「消息给谁 + 进程何时启动」。

---

## 5. FROZEN（本文件冻结）vs OPEN（暂不冻结）

### FROZEN — 可以冻结的决策

- **所有权边界**：Agent 拥有 workspace / DSH_HOME / credential / memory；Session
  属于 Agent；Channel ≠ Agent ≠ Session；Binding 只表达当前归属。
- **one Agent = one DSH process 是 runtime owner boundary**：每个 Agent 独占其
  DSH process / DSH_HOME / native Session owner；Control Plane 从真实 proc
  relationship 决定 Broker caller identity。原“当前进程即 peer-Agent 对抗性安全域”
  claim 已 superseded；当前 shared-host Agents 是 cooperative trust domain。
- **workspace-bootstrap 是 agentId → workspace/DSH_HOME 映射的唯一 owner**。
- **DSH 是 Runtime**：loop/tools/fs/shell/skills/subagents/compaction/persistence
  全部来自 DSH，Agent Core 不重做。
- **Agent Core product sessionId = DSH native sessionId（YES，实验已定案）**：
  Session identity = (agentId, sessionId)（DSH SessionId 作用域 = per-Agent
  DSH_HOME）；`main` 是每个 Agent 的保留 SessionId；**不建 Session mapping layer、
  不建独立 session 包**；DSH 原生负责 session identity / trajectory persistence /
  create / resume / 崩溃恢复；Agent Core 只在 Product API milestone 维护产品
  metadata（title / kind / archived / lastActiveAt）。
- **Forum / Workflow / OKR 在外部**，不是 Agent Core 内部模块。
- **Broker 是统一外部能力入口**：capability manifest → DSH tool 的通用桥，
  Forum/Workflow/OKR 只提供 manifest + handler，不写专用 adapter。
- **Channel 是入口不是状态所有者**：适配器零 Agent/Session 状态。

### OPEN — 暂不冻结（未经实验不冻结实现细节）

- Memory consolidation 的精确触发时机（compaction 前 / turn 尾 / 定时）。
- process credential 形态：bearer / mTLS / 其他（Phase 3 决定）。
- Proactive 最终采用哪些社区插件（schedule/cron/jobs 的选型）。
- jobs persistence 的具体实现（复用 session 事件 vs 独立 store）。
- daemon 托管：launchd / systemd / 其他。
- Artifact 最终实现（如何展示产物/日志）。
- Dashboard UI 方案（数据面现成，UI 形态未定）。
- 归档保留期默认值、流式消息是否 V2 必做（契约自身开放问题）。
- adversarial peer-Agent isolation 的具体机制（per-Agent UID / container / VM /
  sandbox），仅在 `PER_AGENT_SECURITY_DOMAIN_V1` 触发后冻结。

**原则：冻结 ownership，不提前冻结未经实验的实现细节。**

---

## 6. 与既有文档的关系

- 本文件是 `AGENT_SESSION_CHANNEL_MODEL_V1`（D-002）的**产品架构侧**展开：契约定
  义实体与 API，本文件定义分层、职责与边界。
- 依赖 `CAPABILITY_MATRIX.md`（能力结论）、`TRUST-BOUNDARY-REPORT.md`（若要求
  adversarial peer-Agent isolation 时的调查证据与方案 B）、`investigations/*`
  （五主题证据）、`reports/*`（已验收事实）。
- peer-Agent security-domain claim 的 current authority 是
  `docs/specs/AGENT_CORE_HARDENING_PROGRAM_V1.md`；冲突时以该 Program 为准。
- 其他冲突处理见 `docs/AGENT_CORE_ROADMAP_V1.md` §8（如有）。

## 7. Authority amendment — #441 prevention consolidation（待审）

本节为一个 docs-only candidate，不改变本文件或任何 Spec 的 acceptance metadata，
不授权实现、安装或部署。按 `specs/AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1.md` §5/§11
由 Reviewer 评审、经既有 AMEND / acceptance 路径接受后才成为政策；冲突不得靠本草案覆盖 accepted authority。

- **R1 · responsibility / dependency**：agent-control 拥有离线 coding execution；Core 拥有
  physical runtime / admission / effect fences；svc-workflow 拥有 logical workflow；Auth 拥有
  identity；Forum 拥有 projections；现有 DS/release 拥有部署。通用 Router/Scheduler 不依赖
  incident/deployment 实现或 offline executor（含传递 boot/pack 依赖）；静态纯数据组合、
  普通 HR Jobs、合法 maintenance 入口不能仅因名称被禁。Registry 登记不替代 Auth 身份权威。
  正常 import/pack/composition 不得构造/解析 Codex backend、创建离线 worktree/ledger 或 spawn/kill/recover 离线 child。
- **R2 · one fact, one writer**：binding / state-field 变更逐项列出唯一 writable owner、
  readers/projections 和真实 mutation unit；logical Workflow ≠ physical attempt，
  desired protection policy ≠ actual Job state；business-fact authority ≠ optional
  execution projection。field-level owner 本身不构成写安全：现有 whole-body publisher
  （如 agent-control `product_linkage.py` `write_product_body` 整体回写 Issue body）可抹掉
  并发的 SOURCE/BUSINESS_VERIFIED 编辑，或用过期业务 body 恢复旧 ACTIVE_EXECUTION；
  reread + field owner 单独不是架构收敛。在既有 controller/command-bus admission 与
  receipt 已保安全处，优先移除冗余 writable execution mirror；不为满足措辞新增
  whole-body metadata publisher；#397/#382/#386 successor 与 Watch/supervisor/CLI
  迁移仍是具体、未接受的后续工作。mutation helper 对实际将修改的 body 重验 exact expected
  binding；旧 terminal receipt 不得释放后续 claim/command。GitHub 重读不是 atomic CAS；
  缺失/不可读 age、不可用读取、UNKNOWN identity 或未确认 termination 均不能证明
  abandonment。协议变更给直接消费者 migration / rollback，不得新增 wrapper 隐藏旧写路径。
  release 历史 receipt 按既有契约保留解析后的语义值（可见消费者比较
  source/artifact/migration/verification 值），不主张原始字节格式不变；字节一致要求只针对
  exact current receipt：安装必须 materialize pinned Git objects 或拒绝 dirty bytes，
  记录 commit/blob 存在不证明字节一致。
- **R3 · optional startup / parameterization**：未配置 adapter 关闭；移除 incident 材料、替换
  test Agent ID/root 后其余 runtime 仍能启动。缺 credential 只关闭对应 optional capability；
  缺 security policy 仍对其操作 fail-closed。OWNER_ASSISTANCE_WAKE 的既有 outbox 消费独立于
  optional Forum 配置/失败。普通 cron/every/at 对任意 test Agent 同语义，无隐藏 HR 分支；
  Workflow dispatch 的 recovering/unknown/undefined/failed evidence 应 defer，不 mint/deliver；真实缺依赖反例优先于静态计数。
- **R4 · retirement / effects**：default-off ≠ retired；生产配置不得复活 retired writer。
  history read/list/replay 在 backend 配置缺失或畸形、无 writable storage 时仍无 backend 构造/解析、
  mkdir/worktree、spawn/kill/recovery/write；writer 方法在任何 effect 前拒绝。test-only 实现限于
  hermetic tooling、离开正常 boot/pack graph；accepted legacy tests 在合法 successor 出现前保留。
- **R5 · incident exit**：例外的窄 scope、owner、剩余 safety obligations、移除条件和 rollback
  dependency 写在同一个 incident Issue/runbook；不得用定时自动过期删除 active fences；
  条件满足后转 DELETE/MOVE 并给正常 import/pack 的删除证据；已修复的危险权限不得借
  cleanup 泛化。这里不新建 incident ledger 或执行入口。
- **R6 · review / proof**：跨职责 review 覆盖 changed surface 及直接 caller/consumer/dependency
  closure；先判断 Spec 是否允许了错误架构，再判断实现是否符合 Spec。每轮汇总一个 material
  blocker union → 一次集中修复 → 一次 recheck，新增反例保留可追溯证据。
  not-run / missing-tool / ordinary compiler failure 不得记 PASS，先过滤工具/编译错误再报
  PASS 同此禁止；source/test PASS ≠ installed / enabled / business verified；release 端点按
  精确预期状态判定：readiness=200、带有效 token 的 auth=200、无 token 的 auth guard=401，
  偏离该端点的精确预期才算失败，不得把 guard 的 401 预期误写为失败。禁止 constant PASS、
  skipped 假指标或无消费者的 obsolete gate claim；历史结果不冒充当前验证；未实际触发的
  检查（如 nested/复选 workflow）明确标 NOT_RUNNING，不冒充更大覆盖面。
  file-line/barrel/import-count 只帮助 reviewability；拆文件不证明架构改善，禁止为指标 re-export/wrapper。
  普通开发 PR 不承担创建真实业务 Workflow instance 的跨层义务；真实业务验收仅在对应授权范围执行。
  supervisor typed required facts / fail-closed 及 #394 event → action → closure liveness 原样保留，
  不缩短或删除 mandatory event policy strings。

证据边界：下列是 Owner 提供的 2026-10-03 Issue 摘要，未联网复核，不是本候选的测试结果。
C1/C2：#439（normal composition 与 effect-free history；CTR-DEC-001/002、22 legacy tests）、
PR #443（OPEN、未合并：production wrapper 只读 executions.jsonl + writer 文件迁 test/helpers
+ effect-free history 回归提案；结果以该 PR 自身证据为准，本候选未运行）、
#435 F2（disabled ≠ removed）；C3：#407/#442（audit comment 5962699533）；C4：#434/#408
（Agent/root、WORKFLOW_EXECUTION_POLLER_AGENT_ID；#438 移除固定 import，报告的 main 为 daa4c82d）；
C5：#440（product_linkage.py exact binding / #382 age）及 #408（>3600000ms 同 visit/version，
audit comment 5962699309）；C6：#407/#440（receipt 历史=语义值保留、current=pinned bytes）。
这些源修复归 ChatGPT Work，不得以本节或相邻旧测试声称已修复。基线事实：冻结评审基线 =
main 51e14105（现 main d1e42f21 的祖先；本候选已 rebase 到 d1e42f21）；
`packages/development-execution` 在该基线的 git tree 中存在（src×5 + test×2，无 package.json；
现 main 已补 package.json），"absent" 只是起草 workspace 头 e9699aee（非 main 祖先）的局部
事实，不描述 main 的 import/source graph。
