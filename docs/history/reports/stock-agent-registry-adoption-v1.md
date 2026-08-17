---
status: historical
as_of: 2026-08-15
superseded_by: ../../concepts/agents.md
public: PUBLIC_AFTER_SANITIZE
---

> HISTORICAL ENGINEERING RECORD
>
> This document describes the system as of 2026-08-15.
> It is **not** current architecture documentation.
>
> Current documentation: [docs/concepts/agents.md](../../concepts/agents.md)

# STOCK_AGENT_REGISTRY_ADOPTION_V1 — real acceptance report

> 任务：`STOCK_AGENT_REGISTRY_ADOPTION_V1` — 真实生产 stock-agent 被 Agent Core Registry
> 正式识别，并由 Resident/Router 旁路拉起真实 DSH 进程。**adoption，不是 cutover。**
> 日期：2026-08-15 · 基线：`origin/main = 6d1cc77` · 分支：`feat/stock-agent-registry-adoption-v1`
> 执行：`scripts/stock-agent-registry-adoption-v1-verify.mjs`（21/21 PASS, exit 0）
> 现场调查：`docs/investigations/stock-agent-registry-adoption-v1.md`

## 1. 做了什么（严格走现有 generic mechanism，零 core 修改）

```
Agent Core Registry  (AgentRegistry.registerAgent → agt_8fea3535…, 身份/展示字段 only)
   → scripts/agent-core-resident.mjs  (main 6d1cc77 原样, 只 load 不注册)
   → agentcore-cron add 一个 canary job  (runtime store, --no-deliver)
   → Scheduler tick → createRouterInvoker
   → Router.ensureRunning(agt_8fea3535…)
   → workspace-bootstrap 通用映射 <runtime>/agents/<agt_id>  (adoption symlink → 真实 workspace)
   → provisionAgentHome → 真实 DSH child (dsh --profile agent-core-demo, DSH_HOME=Agent Core runtime)
   → native session → 真实模型回复固定 canary token
```

- Registry 记录：`{ name: "股票分析师", description: "Production stock analyst agent, adopted from
  OpenClaw production (openclaw id: stock-agent). Identity/display only." }`，id 由 Registry 生成
  （`agt_8fea353504e948169c45b55639bdcaa3`），**无** chatId / role / policy / credential。
- 业务 workspace 复用：`<runtime>/agents/<agt_id>` 为指向
  `<home>/.openclaw/groups/workspace-oc_<redacted>` 的 adoption
  symlink（操作层，非代码）；未拷贝 workspace、未建 stock-agent-v2、未加 Registry 字段。
- DSH_HOME 完全 Agent Core 独立：`<runtime>/homes/agt_8fea3535…`。
- 没有新 Agent Directory、没有新 Provisioning System、没有 stock-specific Registry 字段。

## 2. 验证证据（全部现场采集）

| 证据 | 值 |
|---|---|
| Registry store | `runtime/control/registry.json` — 1 agent, default=`agt_8fea3535…` |
| Resident ready | pid=43822, `defaultAgent=agt_8fea3535…`（registry loaded: 1 agent） |
| Canary job | id `4dc2fa38-…`, at +8s, delivery=null, `--no-deliver` |
| Scheduler 执行 | finished status=ok, 5231ms, sessionId=`agent:agt_8fea3535…:cron:4dc2fa38-…` |
| Router | invocation evidence: routerProcessPid=44145, alive=true |
| 真实 DSH child | `node …/deepseek-harness/apps/cli/lib/bin.js --profile agent-core-demo` (pid 44145) |
| DSH_HOME 隔离 | child env `DSH_HOME=<runtime>/homes/agt_8fea3535…` |
| workspace 匹配 | child cwd realpath = `<home>/.openclaw/groups/workspace-oc_<redacted>` |
| 真实身份加载 | native session 含 `<system-reminder> Instructions from: AGENTS.md` + 真实内容
  「# AGENTS.md - 投资视角的商业分析 …」+ skills reminder（`~/.agents/skills`） |
| 真实模型回复 | assistant/message = `STOCK_AGENT_REGISTRY_ADOPTION_V1_OK`（exact）
  provider=opencode-go, model=deepseek-v4-flash, pi-ai replayState responseId=`bb613470-…`, stopReason=stop |
| native session 持久化 | `<runtime>/homes/agt_8fea3535…/sessions/…/session.jsonl` 47.8KB, token present |
| 工作区零写入 | workspace 顶层在窗口期内无变化；无 `.dsh` 目录产生（仅 OpenClaw 自身 .git 活动） |

## 3. OpenClaw 生产零改动（前后 hash / PID 校验）

| 门 | 前 | 后 |
|---|---|---|
| openclaw-gateway PID | 31652 | 31652（未重启） |
| `~/.openclaw/openclaw.json`（含 feishu binding）sha256 | ba203fec8503… | 相同 |
| `~/.openclaw/cron/jobs.json`（scheduler jobs）sha256 | 436934df8a5f… | 相同 |
| `~/.openclaw/agents/stock-agent/agent/models.json` sha256 | accc1aecab55… | 相同 |
| launchd（forum-scheduler/workflow-dispatcher/agent-node/gateway/control-api/auto-repair） | 3 行 | 相同 |

## 4. 输出 gates

```
STOCK_AGENT_REGISTRY_ADOPTION_V1 = PASS
STOCK_AGENT_ID = stock-agent (股票分析师) -> Agent Core agt_8fea353504e948169c45b55639bdcaa3
STOCK_AGENT_IN_REGISTRY = YES
STOCK_AGENT_WORKSPACE = <home>/.openclaw/groups/workspace-oc_<redacted>
STOCK_AGENT_WORKSPACE_MATCH = YES
STOCK_AGENT_REAL_PROCESS = YES
STOCK_AGENT_REAL_DSH_TURN = YES
STOCK_AGENT_NATIVE_SESSION = YES
OPENCLAW_AGENTCORE_PARALLEL_SAFE = WITH_RUNTIME_ISOLATION
OPENCLAW_GATEWAY_CHANGED = NO
FEISHU_BINDING_CHANGED = NO
SCHEDULER_JOBS_CHANGED = NO
CALLER_MIGRATION_CHANGED = NO
AUTH_DEPENDENCY = NONE_FOR_ADOPTION
REGISTRY_CORE_CHANGE = NONE
ROUTER_CORE_CHANGE = NONE
RESIDENT_CORE_CHANGE = NONE
AUTH_CHANGE = NONE
BROKER_CHANGE = NONE
KERNEL_CHANGE = NONE
STOCK_AGENT_READY_FOR_CANARY = YES
```

## 5. 边界与诚实声明

- **adoption 完成，cutover 未做**：scheduler caller migration、Feishu binding switch、stock
  scheduler job migration、OpenClaw stock-agent shutdown 一律未动（下一步才是真实 canary/cutover）。
- **Feishu**：resident 按 main 既有行为挂载了 feishu connector（DSH test-bot 凭证
  `~/.dsh/feishu-creds.json`，与已验收的 agent-core-production-resident-v1 相同）；canary job
  delivery=null，全程零发送。OpenClaw 生产 binding 未触碰。
- **Credential**：未读取/复制/修改任何 credential（openclaw.json 内 apiKey/appSecret/token、
  auth-profiles.json 均未取值；`~/.dsh/.credentials.yaml` 仅被通用 provisioner 复制模型路由，
  属既有机制）。
- **模型**：走 Agent Core 标准路由 opencode-go/deepseek-v4-flash（与本 GUI 同路由），
  非 OpenClaw 的 zai/glm-5.2 primary；「真实模型响应」指真实模型调用，非同一模型。
- **Skills**：DSH 子进程加载 `~/.agents/skills`（DSH user root），不含 `~/.openclaw/skills`
  （OpenClaw 专属技能）；身份面 = 真实 workspace 的 AGENTS.md。技能对等属后续阶段。
- **发现（未修）**：resident 的 feishu recording-seam fallback 缺 `setCallback`，凭证缺失时
  resident 会崩——mainline 潜在缺口，按任务约束不修改（RESIDENT_CORE_CHANGE=NONE），
  建议后续独立任务处理。

## 6. 复现

```bash
cd .worktree/stock-agent-registry-adoption-v1
node scripts/stock-agent-registry-adoption-v1-verify.mjs        # 全量 21 checks
# 证据保留在 .demo/stock-agent-registry-adoption-v1/runtime/ (gitignored)
```
