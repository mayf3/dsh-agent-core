# Agent Core on DSH — Docs

> 状态：V1 能力调查已完成并收敛（2026-08-14）。五主题并行调查结论见
> `investigations/`，收敛后的单一事实源是 `CAPABILITY_MATRIX.md`（含冲突裁决），
> 下一步只实施一个 milestone（见文末）。

## Agent Core on DSH 整体定义

**Agent Core on DSH 是 DeepSeek Harness（DSH）之上的一层薄组合，而不是一个独立引擎。**

目标：基于 DSH 替代 OpenClaw 与旧 Agent Core 定位的 Agent 基础设施。原则是
「复用不重写」：所有底层原语（agent/session 事件溯源、tools 瀑布、fs、skill、
AGENTS.md、schedule、jobs、goal、Slots、credentials、JSONL/SQLite 持久化）全部来自
DSH；本项目只补 DSH 没有的**薄集成层**。

V0（已完成）：以 `external.calculator 6×7=42` 跑通最小链路
（`@agent-core/broker` + `@agent-core/router`），证明 agent-loop/session/持久化
等价于旧 Kernel 的 Run/Session 面（见 `reports/bootstrap-v0.md`）。

V1 调查收敛结论（详见 `CAPABILITY_MATRIX.md`）：为替代 OpenClaw，必须自己做的最小
清单是 6 个 BUILD 项 ——

1. **workspace-bootstrap 插件**：per-agent 长期目录创建/播种（AGENTS/SOUL/USER/
   IDENTITY/MEMORY + git init），DSH `workspace` 只是注册表，此层完全缺失；
2. **跨会话 consolidation 插件**：episodic 日志 → curated 长期记忆（DSH 只有会话内
   compaction，记忆存储/检索走 MCP 通道 ADAPT 即可）；
3. **控制面（Router）= 常驻 daemon**：per-agent 进程 spawn + 进程凭据注入 +
   冷启动批量恢复（identity-auth 方案 B 与 always-on daemon 是同一组件）；
4. **jobs 持久化 + cron/日历语义**（当前 jobs 纯内存、schedule 无 cron）；
5. **控制面面板**：agent 运行态 / 全局 jobs / usage / errors / memory 浏览
   （数据面全现成，官方 UI 只缺这些聚合面板）；
6. **Broker 侧 credential→principal 绑定 + flat ACL**（Broker 侧协作，不在本仓库实现）。

其余一律 ADOPT/ADAPT 复用 DSH 原生件；语义召回、OpenClaw widget 网格、通用附件、
动态插件跨 agent 信任等明确 DEFER。四项冲突结论已在 `CAPABILITY_MATRIX.md` §2 裁决
（多 agent 常驻 = per-agent 进程为硬约束；控制面 ≡ daemon；文件记忆为主、MCP 可选；
全局 jobs 面板依赖 jobs 持久化）。

## 文档地图

| 路径 | 内容 |
|---|---|
| `README.md`（本文件） | Agent Core on DSH 整体定义、文档导航、下一步 milestone |
| `CAPABILITY_MATRIX.md` | 能力矩阵：需求 × DSH 原生/社区插件/缺口 × 结论（ADOPT/ADAPT/BUILD/DEFER）+ 冲突裁决 |
| `investigations/identity-auth.md` | 身份与认证调查（BUILD：per-agent 进程 + process credential） |
| `investigations/memory.md` | 记忆调查（ADAPT：MCP 通道；consolidation BUILD） |
| `investigations/workspace-files.md` | 工作区与文件调查（BUILD：workspace-bootstrap） |
| `investigations/dashboard.md` | 仪表盘调查（BUILD：Slots 控制面面板） |
| `investigations/always-on.md` | 常驻与调度调查（ADAPT：原语底座 + daemon/恢复编排层） |
| `decisions/README.md` | 决策记录（含模板） |
| `decisions/AGENT_SESSION_CHANNEL_MODEL_V1.md` | 决策 D-002：Channel/Agent/Session/Binding 模型与前后端 API 契约（含 Android 可直接 mock 的 `AGENT_SESSION_CHANNEL_MODEL_V1.api.json`） |
| `decisions/MEMORY_V1.md` | 决策 D-003：Memory V1 — per-agent file-first 长期记忆（Agent Core memory glue） |
| `decisions/BINDING_AND_SWITCH_V1.md` | 决策 D-004：Router / Binding 域操作与持久化（统一 switchAgent 原语 + Binding owner + 原子 JSON 持久化） |
| `reports/bootstrap-v0.md` | V0 bootstrap 报告（原 V0-REPORT.md，内容完整保留） |
| `reports/memory-v1.md` | Memory V1 实现报告（七问七答、组件、真实验收 PoC 证据、Integration need） |
| `reports/product-integration-v1.md` | Product Integration V1 实现报告：Registry+Workspace+Session+Memory+per-Agent process 第一次真正装进统一 Router/Binding（双 Agent 真实验收证据） |
| `TRUST-BOUNDARY-REPORT.md` | 信任边界/身份伪造调查（identity-auth 的证据基础） |

方法限制说明：本轮调查期间 web_search 后端不可用（无 `DEEPSEEK_API_KEY`），
社区插件检索以本地 DDGS（smart-search）与 DSH checkout 实证代替，各调查文件 §3
均已注明来源与置信度。

## 下一步 implementation milestone（唯一）

**M1：per-agent workspace-bootstrap** —— 写一个 Cordis 插件：agent 创建时按
agentId 创建长期工作目录（`workspace-<agentId>`）、播种 AGENTS.md/SOUL.md/USER.md/
IDENTITY.md（+可选 MEMORY.md）、`git init`、把目录写入 session cwd，并保证播种的
AGENTS.md 在 `agent-instructions` 首次 baseline 渲染前被加载。

理由：它是全部 BUILD 项中唯一自包含、纯 DSH 侧、不触碰 Auth/Broker 的根依赖
（记忆文件要有家、per-agent 隔离要有目录、常驻恢复要有锚点、面板要浏览文件）；
同时解决调查留下的头号挂点开放问题（bootstrap hook 与 AGENTS.md race）。

验收：沿用 V0 验收用例（external.calculator 6×7=42）不变 + 新断言「新 agent 的
session cwd 指向已播种目录、AGENTS.md 进入首轮上下文、MEMORY.md 模型可读写」。

明确不做（本 milestone 之外）：consolidation、控制面/daemon、jobs 持久化、控制面
面板、Broker 侧绑定 —— 全部留待 M1 后的下一个 milestone。

> 更新（2026-08-15）：**Memory V1（分支 feat/agent-memory-v1）已落地** ——
> `packages/agent-memory/`（file-first per-agent 记忆 glue：MEMORY.md + daily
> notes、6 工具、注入、turn/end consolidation + fallback）、`bundle-memory/` +
> `profile-memory/`、`scripts/memory-v1-verify.mjs` 真实验收（ALPHA/BETA 双 agent
> 隔离、跨 session、consolidation、人工编辑）。决策 D-003，报告
> `reports/memory-v1.md`。未触碰 agent-router/agent-registry/agent-session。
