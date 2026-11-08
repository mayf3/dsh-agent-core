# P1P2-BINDING-1351 — 接受前置绑定调查

调查日期：2026-11-08；证据封存开始：2026-11-08T12:03:19Z。
性质：**只读 Investigation，不是 Product Authority、接受事务、实现或生产验收。**

## 1. 结论与接受门状态

| 项目 | 实测结论 | 接受前置状态 |
| --- | --- | --- |
| P1：Core 删除/离册 | 已查 Core、Python controller、Remote Gateway、旧 Core 副本没有专用逐 Agent remove/delete/retire callable。Core 有整表替换、强制迁移、安装器 seed/restore，且已安装 hardening verifier 能直接删除整份可信 agents.json 后重建，详见 §4 全清单；不能将“无 remove RPC”说成“无离册能力”。 | **PARTIALLY_BOUND**：真实可执行写删面和部署目标已绑定；issue 历史删除实际走哪条链仍 UNKNOWN。若要 Core 专用逐 Agent 删除边界，它是尚待合法决定/实现的部件。 |
| P1：OpenClaw | 安装包有真实 `agents.delete`、CLI delete 及配置同效路径（§5），写 `openclaw.json.agents.list`，并非已证实写 Core `agents.json`。 | 安装能力 **BOUND**；当前 loaded gateway、配置 override 和与 issue 历史删除的关联 **UNKNOWN**，不作为 Core 替身。 |
| P2：既有 NOT_IN_REGISTRY | 全 Core、指定候选仓、整个部署 app（含 node_modules）、生产日志/状态与 HR primary 脚本未找到该 marker 的可执行产生者。已排除 Scheduler W1/W2、HR 档案一致性和 HR read projection；它们无 Workflow role holdings 扩展点。 | **NOT_LOCATED**：真实 owner repo/commit/symbol/invocation/report/role 扩展点仍 UNKNOWN。所查候选实现不承担此职责；不能从空搜索证明全环境不存在。 |

调查按要求交付实际发现和负结果；**不将文档/PR 交付冒称 P1/P2 接受门闭合**。
没有证据将 #1351 的“已有 watchdog 能标 NOT_IN_REGISTRY”绑定到版本化 producer，
也没有执行历史删除或巡检来制造结果。若实际没有该部件，后续应在 owning authority 中
明确实现归属与调用面；本调查不自行增设检查器或给提案标 accepted。

## 2. 授权、坐标与方法

用户直接授权消费根 `BRIEF-1351-P1P2-BINDING.md` 与 `STOPPED-1351-GATES.md`：
只读调查 P1/P2，允许 `sudo -u authsvc` 只读探查；零生产写入；探索空结果不算失败；
完成定义为本文件 → commit → push → base-main PR，不合并。原件未改，实测 SHA256：

```text
814efe7411c28864ec190fa10075ebc1439cdcb5b5621050117b2d80d589cb1a  BRIEF-1351-P1P2-BINDING.md
8b48a8c8e6c3c9248975a3ecee4ccf5fa92bdcd61e75b3067879a9a5e3aca3f4  STOPPED-1351-GATES.md
```

- 仓库 `mayf3/dsh-agent-core`；worktree `/Users/yanfenma/workspace/project/worktrees/h1351-gates`。
- 开始时为 `docs/1351-gates-spec` / `d9b3114ba49cb677afff7a895a09ac5df65d2b33`，
  不是旧 STOPPED 中的 `fix/1351-ghost-holdings-gates`。旧记录是索引，不冒称当前坐标。
- 为避免把既有提案混入本调查 PR，在 tracked/staged diff 均为空后，从远端 main 的固定
  `1d3cef866f2bac545a4aa62ca53f5b0e178dd2a1` 创建 `docs/1351-p1p2-binding`。
  原六个未跟踪 Brief/STOPPED 保留，不添加到本提交；相邻 checkout/ref 未改。
- `git ls-remote origin` 实际输出：

```text
d9b3114ba49cb677afff7a895a09ac5df65d2b33 refs/heads/docs/1351-gates-spec
1d3cef866f2bac545a4aa62ca53f5b0e178dd2a1 refs/heads/main
```

本报告 Core 源码坐标均可绑定上述 main；开始时的 d9b3114 是仅文档提案提交，
不是新产品源码或生效权威。提案在 [PR #674](https://github.com/mayf3/dsh-agent-core/pull/674)，
其 `AGENT_CORE_GHOST_HOLDINGS_PROTECTION_V1` §3.2 P1/P2 是调查目标而非授权来源；
原文 hash `d77f357282aacb2f08a153efcb8af8114244b333929569613735ced01c3b7747`。
issue 输入由 GitHub connector 只读重读：
[mayf3/agent-control#1351](https://github.com/mayf3/agent-control/issues/1351)。

已读入口 `.agents/README.md`、`.agents/local/README.md`、Product Architecture、
Current Decision index、常设委托 V1、Bootstrap V1 的无 remove seam 观察，
及 `spec-governance/SKILL.md` 和唯一选定 `modes/PREFLIGHT.md`。
本次只持久记录事实，不改变 D-008/D-009、UNKNOWN、fence 或已接受合同。

```text
SPEC_GOVERNANCE_MODE = PREFLIGHT
ROUTE_SCHEMA_VERSION = 2
GOAL_OR_TARGET = P1/P2 evidence investigation and unmerged documentation PR
CURRENT_GAP = exact removal and marker producer bindings unresolved
AUTHORITY_ACTION = REUSE  # 调查/记录，零 Product Contract delta
PRIMARY_AUTHORITY = existing repository governance and ownership boundaries
PLAN_LEVEL = EXEC_PLAN
ASSURANCE_LEVEL = DURABLE  # 唯一写入为隔离文档/PR；不执行受控删除
ROUTE_STAGE = AUTHORITY_AUTHORING  # 为提案准备证据，不接受或改写提案
AUTHORITY_ACCEPTED_IN_BASE = YES  # 指既有治理；不指四闸提案
IMPLEMENTATION_AUTHORITY = not_applicable
MUTATION_AUTHORIZATION = VALID  # 用户明确授权本调查文档和 PR
ISOLATED_WRITE_SURFACE = YES
SPEC_GAP_DEPENDENCY = NON_LOAD_BEARING  # 不阻断记录未知；仍阻断后续接受/实现
IMPLEMENTATION_ALLOWED = NO
MERGE_READY = NO
OPERATION_ALLOWED = NO  # 产品/生产 mutation；只读静态探查已授权
DONE_WHEN = this report committed, pushed, open PR against main, no merge
EXPANSION_TRIGGER = required evidence inaccessible or ownership conflict; stop dependent claim
NEXT_ACTION = CONTINUE
```

执行阶段：并行 source census → authsvc 部署/状态只读核对 → 合并证据及独立复核 → 文档交付。
未因候选目录不存在或权限拒绝停止其他已授权调查；不为消除 UNKNOWN 升级 root、chmod、
重启、执行 CLI/API、改配置或重放。不存在需要执行删除才能取得的“必需测试输入”。
局部不可得证据按 §8 保留 UNKNOWN，不伪造全局不存在证明。

## 3. 来源和责任链索引

| 面 | owner/source revision | 责任与证据边界 |
| --- | --- | --- |
| Core | `mayf3/dsh-agent-core@1d3cef866f2bac545a4aa62ca53f5b0e178dd2a1` | Architecture §2/§3 将身份登记归 Control Plane；local README `Acceptance and review actors` 为 mayf3 或 PR 中明确授权 maintainer；独审与正式接受分开。 |
| Python controller | `mayf3/agent-control@6e8ec850966a13ab48ddc04befd932c760a2349c`；路径 `/Users/yanfenma/workspace/project/agent-control-ac-1106` | remote 证明 repo 来源；未找到进一步 CODEOWNERS/受托角色证明，细分接受权 UNKNOWN。不因 controller 名称推断拥有 Registry。 |
| Remote Gateway | `mayf3/agent-core-remote-gateway@376d7306c44305bfcf23da0213a8f975b8d289b8`；同名 workspace 子目录 | local README:32 `SPEC_ACCEPTANCE_ACTORS = mayf3 (repository owner)`；:55–57 明示不拥有 Agents、不读写 backend store。 |
| 旧 watchdog Core 副本 | `bb5327f622a0333f1e11d945319e024a3731f05a`；`watchdog-lark-v3-bb5327f-staging` | origin `/private/tmp/watchdog-lark-v3-bb5327f-source`；clean；Core 文件相同，不是独立 owning repo。Git safe.directory 仅命令参数，无全局配置修改。 |
| Svc | `mayf3/svc-workflow` 固定本地 `origin/main` 对象 `b5096782f666ad22aa3508fdbf9562278a977c0f` | checkout `88ff8145eb0842b4ce759117caf4b05f9012ebdc` 较旧；固定对象不冒称已在线刷新远端 main。业务 roles 由 Svc 责任链拥有；Core 不代接受。 |
| HR read projection | `mayf3/dot-read-mcp@46cbba8aa11d8e6431b8d65ec2c12f1197f75a1c` | 工作副本 dirty，以下只引用 `git show <SHA>:src/server.mjs`，不将工作副本行号绑定该 SHA。 |
| OpenClaw | `openclaw/openclaw`；安装包 `2026.3.13`；build 声明 commit `4d3264e825e8a1c39467fdcd1a50884cef34ae29` | 无安装目录 `.git`；build 声明与实测 dist hash 分开。未取得 upstream maintainer delegation；具体接受者 UNKNOWN，Core 常设委托不能代签。 |
| 主机配置/脚本 | 见 §6 authsvc 及 §7 HR hashes | 文件属主/可读性是 OS 事实，不等于源码或产品接受权限。未版本化脚本不编造 repo/commit。 |

采集者：主调查 `/root` 负责 Brief/authority、部署、状态、整合；只读并行调查
`/root/p1_sources`、`/root/p2_sources`、`/root/openclaw_paths` 分别负责源码入口、
producer census、OpenClaw 安装包。所有引用为读取结果/静态 invocation，**未调用 mutation**。
下列行号为固定源码或安装文件的 1-based 行；代码块是相关原文摘录，省略处不宣称连续全文。
代码块中的省略注释、`...` 及行号注释为本报告标记，不冒称源码逐字注释；完整内容由路径/hash 复核。
候选工作副本状态：Python controller 只有既有未跟踪 `__pycache__/`、`tests/__pycache__/`；
Remote Gateway 与旧 watchdog 副本 clean；dot-read-mcp dirty 已单独处理。

## 4. P1 — Core 及候选管理层

### 4.1 现有 gateway callable 只提供四操作

```text
production-runtime/src/compose.js:215 applyDefinition(ctx,{configFile:layout.agentsConfig})
→ agent-definition/src/index.js:101–103 provide('agentDefinitionAccess', handlers)
→ production-runtime/src/broker-composition.js:25,32–33 mountBrokerGateway / resolveLocalHandlers
→ broker/src/capabilities/agent-definition.js:70–137 agent_definition_write
→ broker/src/gateway.js:259–267 closed operation lookup; :345–382 credential/Auth scopes
→ agent-definition/src/access.js:117::disable → :120::disableAgentInConfig
→ config.js:327 disabled:true → :329 writeAgentDefinition → :105 writeFile → :106 rename
→ access.js:121 refresh()/definition.reload()
```

上面包路径均以 `packages/` 为前缀。capability 原文：

```js
// packages/broker/src/capabilities/agent-definition.js:80
requiredScopes: ['agent.definition.write'],
// operations :90 / :103 / :117 / :128
// create / update / disable / set_default

// packages/broker/src/gateway.js:259–267
const localHandler = isLocal ? localHandlerFor(localHandlersNow, manifest, operation) : undefined
if (isLocal && (typeof operation !== 'string' || localHandler === undefined)) {
  // ...
  // unsupported_operation: operation not served by the gateway
```

`config.js:303–307` 原文明确 disable 保留身份：

```text
Disable an existing agent. A disabled agent keeps its stable identity
(getAgent/listAgents still show it) but is no longer routable and can
never be the default.
```

所以 disable 不绑定为删除；create/adopt 追加、update 仅 display、set_default 不移除条目。
Auth per-credential grant 负责现存 capability 权限，不能推出不存在的 remove 权限，
更不能推出部署 writer 调用许可。没有新增通用 enable、删除接口或无调用方 helper。

### 4.2 全部已定位的 Core 同效离册写面

范围是本固定 Core 版本、旧副本和已读部署；任意 OS 编辑器/外部未见脚本不可能由源码 census 穷尽。

| ID / 外层入口 | invocation → 最终 mutation | 目标、鉴权、并发及归属 |
| --- | --- | --- |
| C1 部署模块全文替换 | ES module caller → `config.js:72::writeAgentDefinition(configFile,input)` → :90–101 仅从输入重建 → :105 writeFile(tmp) → :106 rename(tmp,configFile) | caller 指定路径；无应用身份/holdings/CAS/文件锁；OS 权限；固定 `${configFile}.tmp`。省略旧 id 可同效离册。Core owner，非现成 remove RPC。 |
| C2 强制迁移 | `node scripts/migrate-registry-to-definition.mjs --from <old-store> --to <definition> --force` → :51 main → :75 convertRegistryStore → :76 writeAgentDefinition → C1 | :53/54 指定 from/to；:55 force；:61–64 仅已有目标且无 force 拒绝。source 缺条目可覆盖丢失目标条目。静态 invocation 未执行。 |
| C3 installer seed/restore | `scripts/trusted-cp-deploy-install.sh` → :708 mv TRUSTED_ROOT 到 BAK → :742 建新 root → 配置阶段 :1097–1110 → 有备份 :1107 cp BAK/config/agents.json；否则 :1110 写空 agents 数组 | 正常 reinstall 意图保留定义；是整文件写面，非专用删除。受 installer 原 admission/部署授权约束，本调查不授予运行许可；该局部写句未作 holdings/CAS 比较。 |
| C4 hardening verifier 直接删除/重建 | `scripts/trusted-cp-hardening-v1-verify.mjs:771 main()` → :578 main → :616 attackMatrix → :619 cleanupTrustedControlPlanes → :620 seedTrustedConfig → :230 rmSync(AGENTS_CONFIG) → :237 adoptAgents(A/B) → config.js:182 → C1 | root-only guard :46–49；TRUSTED_ROOT :51 和 AGENTS_CONFIG :64 硬编码真实可信 config，非隔离副本；另有 config 不存在时 attackMatrix :139–147 空 seed。部署 app 同文件存在且与 main 字节一致。未执行。 |
| C5 raw file / backup replacement | 文件写者对 authoritative agents.json 整体编辑、替换、复制或恢复 | OS 写者类别，不是另造的产品 callable。实际生产目标和 uid 见 §6；未发现完整外部写者清单，不能报为零。 |
| C6 fixture runtime 整树删除 | 下表验收脚本 main → rmSync(ROOT/runtime) → 后续 seed/provision | 默认是 fixture，但多数 env 可改目标；没有执行，不声称路径不可指向生产。所有权仍为 Core，不能用 verify 名称豁免文件删除盘点。 |

C1 原文（`packages/agent-definition/src/config.js:90–106` 摘录）：

```js
const agents = []
const seen = new Set()
for (const entry of input.agents) {
  let record = normalizeAgentEntry(entry, 'agent')
  // duplicate id validation ...
  agents.push(record)
}
const defaultAgentId = input.defaultAgentId ?? null
const doc = normalizeDefinition({ version: CONFIG_VERSION, defaultAgentId, agents }, { source: configFile })
await mkdir(dirname(configFile), { recursive: true })
const tmp = `${configFile}.tmp`
try {
  await writeFile(tmp, serializeDefinition(doc), { encoding: 'utf8' })
  await rename(tmp, configFile)
```

C2 原文（迁移脚本 :61–76 摘录）：

```js
if (existsSync(to) && !force) {
  console.error(`[migrate] target Agent Definition config already exists: ${to} (pass --force to overwrite; the old store is no longer an authority)`)
  process.exit(1)
}
// ...
const converted = convertRegistryStore(store)
await writeAgentDefinition(to, converted)
```

C4 不能因文件名含 verify 就归为隔离 fixture。源码 usage :32–34 为
`sudo node scripts/trusted-cp-hardening-v1-verify.mjs`，root guard :46–49；其 fixture Agent
写入的是实际 `/usr/local/libexec/agent-core/config/agents.json`，并同时清理其他可信状态。
下列是该安装脚本的逐行原文（§6 逐文件 hash 绑定；仅读取）：

```js
const TRUSTED_ROOT = '/usr/local/libexec/agent-core'
```

`TRUSTED_CONFIG=join(TRUSTED_ROOT,'config')` 在 :57，AGENTS_CONFIG 在 :64。
`seedTrustedConfig` :228–240 原文：

```js
async function seedTrustedConfig() {
  console.log('\n[phase 2] seeding the 505-private trusted config')
  rmSync(AGENTS_CONFIG, { force: true })
  rmSync(BINDINGS_STORE, { force: true })
  rmSync(CREDENTIALS_STORE, { force: true })
  // Agent A/B are hardening acceptance fixtures created through the formal
  // Agent Definition authoring path (AGENT_DEFINITION_CONFIG_V1): the
  // declarative config is the SINGLE Agent existence authority — the
  // hardened deployment never maintains a second Agent list.
  const adopted = await adoptAgents({ configFile: AGENTS_CONFIG, agents: [
    { name: AGENT_A_NAME, description: 'hardening acceptance fixture A' },
    { name: AGENT_B_NAME, description: 'hardening acceptance fixture B' },
  ] })
```

外层 main :580–585 先确认可信 harness/app/home/config 目录存在；:616 记录 attackOk，
但 :619–620 前没有以 attackOk=false 短路。`cleanupTrustedControlPlanes:81–89` 还会扫描
可信 harness 进程并 kill -9，然后才 :620 seed。**本调查绝未运行这一链。**
另外，hardening :157/:165–169 的 as502 攻击矩阵对真实 agents.json 追加 canary-pwned，
installer :1296 对同路径 echo pwned 覆盖，均意在验证拒绝；若权限失效则可破坏配置。
它们不是隔离路径，也不是已发生删除的证据，作为真实文件写尝试一起列入。

补齐所有非测试目录 `writeAgentDefinition` 直接调用点，并分类保留集合 helper，避免把 fixture 冒充生产删除：

- `config.js:182/265/299/329/357`：adopt/create/update/disable/set_default；保留条目集合。
- `scripts/canonical-onboarding-lib.mjs:53::ensureDefinition` → :69 `[...doc.agents,entry]`
  → :73 writer：append，非删除。
- `scripts/agent-router-delivery-v0-verify.mjs:202::main` → :221 writer；:59 默认
  `.demo/agent-router-delivery-v0/runtime`，环境变量 `DSH_DELIVERY_V0_RUNTIME` 可改路径；验收夹具。
- `scripts/scheduler-run-history-e2e-v1.mjs:135` mkdtemp → :141 writer；隔离夹具。
- `scripts/availability-recovery/release-startup-closure.mjs:56::seedRoot` → :58 writer；
  runFull :266–268 / selftest :290–292 使用独立临时目录。
- `packages/**/test/**` writer 均为测试 fixture；未执行。
- 原始 fixture writer `scripts/feishu-phase-a-final-canary.mjs:243`、
  `scripts/fleet-window/anarrowed/candidate-state.mjs:50`（后者 flag wx）另行分类，非生产删除入口。
- `scripts/production-agent-provision.mjs:63` 只读定义遍历 provision，不写 Definition。
- installer :1139 `rm -f "$PROD_ROOT/agents.json"` 后 :1140 重链可信 config；
  删除的是链接/入口，不是逐 Agent 删除。
- 当前与旧副本均没有 `packages/agent-registry` Git tree；Broker capability registry、
  process/lifecycle Map.delete、Session/cron 删除均不是身份离册。
- `scripts/agent-core-backup-ops.sh` 主线 CLI :839–877 无 restore 命令；只列 backup metadata、
  pin/unpin、prune、budget、cleanup-exact。cleanup-exact :779–805 只允许 managed-predeploy
  的 `${root}.bak-<id>` 且非 pinned，删除旧备份，不改 live；不能编成活跃 Registry restore。
  部署版 helper 与本 main 不同，实测 hash
  `39cbaa232a24fd2f51450b18b398f9e2036cbc0146db9bc5c462414732230c14`，
  与 production source 08102a55 对象一致；其 CLI :844–880 同样无 restore。
- installer :138/:1274 仅打印 operator `rm -rf root && mv BAK root` rollback recipe，
  属 C5 operator 类别，未执行。`production-runtime-launchd.mjs --uninstall:304–307`
  只 bootout/删 plist，明确保留 persistent state，不离册；
  `scripts/lib/deployment-reuse/transaction-recovery.mjs` :11/:265/:289–296 只恢复 app/harness/node-runtime
  和 model overrides，不写 agents.json。demo-home/provisioning 也不是另一个 Registry writer。

C6 的完整已定位入口（路径相对 `scripts/`；均为静态链，未执行）：

| 外层脚本 | runtime 目标选择坐标 | 最终整树 rmSync 坐标 |
| --- | --- | --- |
| production-runtime-v1-verify.mjs | :55 DSH_PRT_RUNTIME | :242 |
| agent-core-production-resident-v1-verify.mjs | :41 DSH_ACPR_RUNTIME | :150 |
| agent-definition-access-v1-verify.mjs | :53 DSH_ADAV_RUNTIME | :150 |
| agent-router-delivery-v0-verify.mjs | :59 DSH_DELIVERY_V0_RUNTIME | :212 |
| product-integration-v1-verify.mjs | :52 DSH_PRODUCT_INTEGRATION_RUNTIME | :263 |
| mobile-gate1-verify.mjs | :51 DSH_MOBILE_GATE1_RUNTIME | :269 |
| stock-agent-registry-adoption-v1-verify.mjs | :55 DSH_SAV_RUNTIME | :238 |
| scheduler/scheduler-router-final-v1-verify.mjs | :84 DSH_SRF_RUNTIME | :190 |
| trusted-credential-broker-v1-verify.mjs | :59 DSH_TCB_RUNTIME | :273 |
| trusted-credential-505-final-v2-run.mjs | :39 固定 .demo/trusted-credential-505-v2 | :412 |

这些脚本的默认 fixture 定位不能作为不可越界保证；若要运行，须另核实际目标和操作授权。
本报告不把它们冒充当前正在运行的业务删除 API，也不把生产 hardening C4 混入本类。

旧副本和 main 的 `config.js` / `access.js` 相同，SHA256 分别为
`fa33f6ff4cb905e558be661f29e7b7b82099427982430c2e86c9ccf914ff366c`、
`0cf284aa9c61f3dba1edf861c0929e13c857831e9a13a4d678f003ee5606f210`。

### 4.3 Python controller / Remote Gateway 排除原文

Python `README.md:3–10` 说明是轮询 agent:queued issue、启动 Codex/ZCode 的开发任务控制器，
外层 `python3 controller.py`。`controller.py:1650::handle_issue` 的 action 分派 :1665–1677：

```python
action = cfg.get("action", "start")
if action in {"start", "continue"}:
    start_execution(...)
# ...
elif action == "status":
    status_action(...)
elif action == "stop":
    stop_action(...)
else:
    raise ValueError("action must be start, continue, status, or stop")
```

stop 是开发进程控制，未见身份删除。Remote Gateway `src/route-policy.mjs:3–10` 全 route 表：

```js
const ROUTES = new Map([
  ['/health', new Set(['GET'])],
  ['/v1/binding', new Set(['GET'])],
  ['/v1/agents', new Set(['GET'])],
  ['/v1/switch-agent', new Set(['POST'])],
  ['/v1/message', new Set(['POST'])],
  ['/v1/voice/transcription', new Set(['POST'])],
])
```

`src/server.mjs:31::createGateway` → :54 createServer → :71 websiteRoute/enforceRoute
→ :109 token validation → :122 proxy → `src/proxy.mjs:6::proxyRequest` → :22 http.request。
`route-policy:36–41` 未列路径 404、未列方法 405；额外 website policy :29–55 不含 Agent 删除。
它的 local README:55–57 原文：

```text
The Gateway does not own Agents, Bindings, Sessions, Workspaces, or DSH lifecycle.
Those remain owned by the private backend.
The Gateway does not read or write the `dsh-agent-core` store directly.
```

两仓分别执行 `git grep -n -i -E 'delete.?agent|remove.?agent|deregister|agents\.json' HEAD`
（Python 限 `*.py`，Gateway 限 `src/*`），均 stdout 空、rc=1。更宽 registry 搜索中的
artifact/task registry 不承担 Agent 身份删除，未用名字推定。

## 5. P1 — OpenClaw 已安装删除及同效路径

安装根 `/usr/local/lib/node_modules/openclaw`；包原文：

```json
{"name":"openclaw","version":"2026.3.13","repository":{"type":"git","url":"git+https://github.com/openclaw/openclaw.git"},"gitHead":null,"bin":{"openclaw":"openclaw.mjs"}}
```

`dist/build-info.json` 声明 commit `4d3264e825e8a1c39467fdcd1a50884cef34ae29`、
builtAt `2026-08-10T06:43:42.977Z`。没有 Git 对象核对证明，以安装 hash 绑定本次读到的代码。
下列路径均相对安装根；G=`dist/gateway-cli-ImzOm-jh.js`，
A=`dist/auth-profiles-DBa6wi1M.js`，仅为本节路径缩写，不是新模型。

### 5.1 真正删除 callable 与最终 mutation

```text
Gateway WS request G:23046
→ handleGatewayRequest :16831 → authorizeGatewayMethod :16786
→ coreGatewayHandlers/agentsHandlers :16828 → agents.delete :9717
→ dist/agents.config-C7Buc7mN.js:87::pruneAgentConfig
→ G:9737 writeConfigFile → A:14267 wrapper → :13995 config IO → :14135–14149 write/rename
```

G 的 source region 指向 `src/gateway/server-methods/agents.ts`。:9717–9741 逐行原文：

```js
	"agents.delete": async ({ params, respond }) => {
		if (!validateAgentsDeleteParams(params)) {
			respondInvalidMethodParams(respond, "agents.delete", validateAgentsDeleteParams.errors);
			return;
		}
		const cfg = loadConfig();
		const agentId = normalizeAgentId(String(params.agentId ?? ""));
		if (agentId === "main") {
			respond(false, void 0, errorShape(ErrorCodes.INVALID_REQUEST, `"${DEFAULT_AGENT_ID}" cannot be deleted`));
			return;
		}
		if (!isConfiguredAgent(cfg, agentId)) {
			respondAgentNotFound(respond, agentId);
			return;
		}
		const deleteFiles = typeof params.deleteFiles === "boolean" ? params.deleteFiles : true;
		const workspaceDir = resolveAgentWorkspaceDir(cfg, agentId);
		const agentDir = resolveAgentDir(cfg, agentId);
		const sessionsDir = resolveSessionTranscriptsDirForAgent(agentId);
		const result = pruneAgentConfig(cfg, agentId);
		await writeConfigFile(result.config);
		if (deleteFiles) await Promise.all([
			moveToTrashBestEffort(workspaceDir),
			moveToTrashBestEffort(agentDir),
			moveToTrashBestEffort(sessionsDir)
```

`deleteFiles=false` 仍移除注册成员；本调查未执行任一分支。CLI 另一路：

```text
/usr/local/bin/openclaw symlink → openclaw.mjs → dist/entry.js → command registry
→ dist/register.agent-CR-VkRg3.js:263 agents.command("delete <id>")
→ dist/agents-pYDkrcbT.js:535::agentsDeleteCommand
→ :573 pruneAgentConfig → :574 writeConfigFile → 同一 config IO
```

CLI :550–579 检查 configured id；非交互且无 force 输出
`Non-interactive session. Re-run with --force.`；交互需确认，随后写 config/清理目录。
source region 为 `src/commands/agents.commands.delete.ts`。

真正移除成员的原文 `dist/agents.config-C7Buc7mN.js:87–98`：

```js
function pruneAgentConfig(cfg, agentId) {
	const id = normalizeAgentId(agentId);
	const nextAgentsList = listAgentEntries(cfg).filter((entry) => normalizeAgentId(entry.id) !== id);
	const nextAgents = nextAgentsList.length > 0 ? nextAgentsList : void 0;
	const bindings = cfg.bindings ?? [];
	const filteredBindings = bindings.filter((binding) => normalizeAgentId(binding.agentId) !== id);
	const allow = cfg.tools?.agentToAgent?.allow ?? [];
	const filteredAllow = allow.filter((entry) => entry !== id);
	const nextAgentsConfig = cfg.agents ? {
		...cfg.agents,
		list: nextAgents
	} : nextAgents ? { list: nextAgents } : void 0;
```

最终持久化原文 A:14135–14147（mode 384 = 0600）：

```js
		const tmp = path.join(dir, `${path.basename(configPath)}.${process.pid}.${crypto.randomUUID()}.tmp`);
		try {
			await deps.fs.promises.writeFile(tmp, json, {
				encoding: "utf-8",
				mode: 384
			});
			if (deps.fs.existsSync(configPath)) await maintainConfigBackups(configPath, deps.fs.promises);
			try {
				await deps.fs.promises.rename(tmp, configPath);
			} catch (err) {
				const code = err.code;
				if (code === "EPERM" || code === "EEXIST") {
					await deps.fs.promises.copyFile(tmp, configPath);
```

### 5.2 安装包范围内同效 callable 全清单

| 面 | 精确坐标 / invocation | 区别 |
| --- | --- | --- |
| agents.delete RPC | §5.1 | main 保护；可同时清 workspace/state。 |
| agents delete CLI | §5.1 | 本地 OS 路径，有确认/force，非 Gateway scope 调用。 |
| config.set RPC | G:11942–11948 → parse/validate → writeConfigFile | 整份配置可省略已有 Agent，绕过 prune 函数。 |
| config.apply RPC | G:12025–12034 → parse/validate → write → restart scheduling | 整表替换；有 base hash 前置。本调查未触发 restart。 |
| config.patch RPC | G:11955–11992 → applyMergePatch → validate → write/restart scheduling | null 可删除 key/父对象；id-keyed array 合并，不能把少给 agents.list 元素当作逐项删除。 |
| config set CLI | `dist/config-cli-Btygza8p.js:328–336` → setAtPath → write | 可替换 agents.list/父对象。 |
| config unset CLI | 同文件 :343–344 → :241–252 runConfigUnset → unsetAtPath → write | 可去掉 list 或元素。 |
| /config set | A:115444 handler → :115533–115543 → validate/write | commands.config enable + authorized sender/owner；内部 gateway 另需 admin。 |
| /config unset | 同 handler → :115514–115527 | 同上。 |
| reset CLI | `dist/register.maintenance-vGwgwdXf.js:440` → :164 resetCommand → :224 cleanup plan → :230–241 removePath(configPath)；full :254–262 removeStateAndLinkedPaths/workspace | config/config+creds+sessions/full 均可移除配置；非交互须 yes+scope，交互需确认；dry-run 不删。 |
| uninstall CLI 的 state 范围 | 同文件 :450 → :335 uninstallCommand → :277–283 scope selection → :403–409 removeStateAndLinkedPaths | `--state`/`--all` 或交互 state 选择可删配置；仅 service/app/workspace 范围不等价。 |
| onboard --reset / 交互 reset | `dist/register.onboard-DlZ4vfiU.js:54` → `dist/onboard-DJmBz58w.js:523/545–563` → A:147464 handleReset；交互 `dist/onboarding-Br91BtN8.js:92–130` → 同 helper | 移入 trash 的 CONFIG_PATH；非交互有 acceptRisk 前置；与 reset CLI 的 fs.rm 不同，失败只报告 manual delete，不假称成功。 |
| gateway dev reset | G:24628–24630 的 dev/reset flags → :24444 runGatewayCommand$1 → :24468 ensureDevGatewayConfig → :24070–24097 | reset 必须 devMode（opts.dev 或 OPENCLAW_PROFILE=dev，:24445–24450）；:24072 handleReset(full)，:24076 重写仅 dev 成员配置；真实目标随 config/env 决定，不声称当前生产调用。 |

A:6575–6587 `applyMergePatch` 原文：

```js
if (value === null) {
  delete result[key];
  continue;
}
if (options.mergeObjectArraysById && Array.isArray(result[key]) && Array.isArray(value)) {
  const mergedArray = mergeObjectArraysById(result[key], value, options);
```

A:6548–6550 注释说明有效 id 项按 id merge/append，无 id 项 append；不误报数组省略即删除。
维护 CLI 的最终 mutation 是 `dist/cleanup-utils-BMm3OQGr.js:37::removePath`；
:29–35 拒空、filesystem root 和 home；:48–53 dry-run 返回；:55–59 原文：

```js
	try {
		await fs.rm(resolved, {
			recursive: true,
			force: true
		});
```

同文件 :67–79 先删 stateDir；配置不在 stateDir 内时另删 configPath。
reset 的非交互 yes/scope 门在 maintenance :165–176、交互确认 :215–221；
uninstall 对应 :337–347/:390–396。它们是本地 OS 写路径，不走 Gateway grants，
没有 Svc holdings/CAS。onboard 的 A:147464–147469 原文：

```js
async function handleReset(scope, workspaceDir, runtime) {
	await moveToTrash(CONFIG_PATH, runtime);
	if (scope === "config") return;
	await moveToTrash(path.join(CONFIG_DIR, "credentials"), runtime);
	await moveToTrash(resolveSessionTranscriptsDirForAgent(), runtime);
	if (scope === "full") await moveToTrash(workspaceDir, runtime);
```

`moveToTrash` 在 A:147450–147462 → :147458
`runCommandWithTimeout(["trash", pathname], { timeoutMs: 5e3 })`；这只是源码路径，未调用。
gateway dev reset 的 G:24070–24076 逐行原文另列，以区别没有删除的普通启动：

```js
async function ensureDevGatewayConfig(opts) {
	const workspace = resolveDevWorkspaceDir();
	if (opts.reset) await handleReset("full", workspace, defaultRuntime);
	const configPath = createConfigIO().configPath;
	const configExists = fs.existsSync(configPath);
	if (!opts.reset && configExists) return;
	await writeConfigFile({
```

后续 :24076–24097 写入 dev 配置。普通 setup/configure/无 reset onboarding 保留 agents.list；
`dist/doctor-config-flow-B1ZAprT7.js:2198–2201/2350–2372` 从原 config clone，
:54–77 stripUnknownConfigKeys 只删 schema 不识别字段，未见移除合法 Agent 成员的分支；
`dist/prompt-select-styled-B9juIisz.js:2519–2524` 最终写入。
A:5880 的 legacy routing.agents 删除伴随 :5892 迁移到 agents.list，不把搬字段当离册。
这一轮补做了 configPath/CONFIG_PATH/CONFIG_DIR/stateDir 上的 rm/unlink/removePath/
moveToTrash、所有 handleReset caller、agents.list 赋值/prune/filter 反查；没有只围绕
writeConfigFile 枚举而漏掉直接删文件的维护入口。
可执行 bundle 副本也已盘点，不将其视为独立注册表：

- `dist/gateway-cli-B640UJM4.js:9715` 同名 RPC，:9734–9735 prune/write；
  `dist/program-context-CHNCenSz.js:60` 动态加载它。
- `dist/register.agent-DsxT3mFe.js:635` delete command，:673–674 prune/write；
  program-context :431 加载。对应 `dist/agents.config-DwnEuX6Y.js:87`。
- `dist/register.subclis-Cl0okSFT.js:68` 加载 G；
  `dist/command-registry-DkWVGiij.js:125` 加载 register.agent-CR。
- 配置 CLI 副本 `dist/config-cli-l0lKyG-o.js:242–253/329/344`，command-registry :54 加载。
- 维护副本 `dist/register.maintenance-B20t22t1.js:161/332`，program-context :397 加载；
  maintenance-vGwg 由 command-registry :91 加载。
- onboard 副本 register.onboard-CNvluKXA :53 → onboard-BcOqUVXH :523/563 →
  reply-CTX8C1WW :136169；交互副本 onboarding-If0aaJtX :129；路径均在 dist/。

执行鉴权原文 G:16786–16798 摘录：

```js
const roleRaw = client.connect.role ?? "operator";
const role = parseGatewayRole(roleRaw);
// reject invalid role / unauthorized method ...
const scopes = client.connect.scopes ?? [];
if (role === "node") return null;
if (scopes.includes("operator.admin")) return null;
const scopeAuth = authorizeOperatorScopesForMethod(method, scopes);
```

A:60296–60300 把 agents.create/update/delete 列入 ADMIN_SCOPE；:60322–60326 将 `config.`
列为 admin prefix；/config owner/admin 控制在 :115448–115468。并发机制只证明所读
config hash/原子写局部机制，**没有证明与 Svc holdings 库的序列化或删除门禁**。

### 5.3 注册表和 owner 边界

`dist/agent-scope-CZIF93u7.js:438–441` 从 `cfg.agents?.list` 取列表；:443–454 列表空时
保留 DEFAULT_AGENT_ID fallback。移除显式成员不等于 OpenClaw 没有 main。
`dist/paths-jtwudEDq.js:127–134` 默认 `~/.openclaw/openclaw.json`，可由
OPENCLAW_CONFIG_PATH / CLAWDBOT_CONFIG_PATH / OPENCLAW_STATE_DIR 影响。

authsvc 只读解析输出（只输出结构/count，未输出 credential）：

```text
CONFIG /Users/yanfenma/.openclaw/openclaw.json
agents_type dict agents_keys ['defaults', 'list'] list_count 88
```

该文件 uid=505(authsvc)、gid=601、0600；包 package.json uid=502、gid=80、0644。
它们不证明谁可接受 upstream 代码。`/usr/local/openclaw-monitors/gateway-control-api.js`
及该目录 js/sh/py 的删除/配置/registry 反查无匹配，rc=1。
两份 gateway plist 对普通用户和 authsvc 均 Permission denied（§8），当前 loaded binding
UNKNOWN；不能由本安装源码认定历史 incident 就用了这条路径。

## 6. authsvc 部署绑定与生产 watchdog 状态

实际只读执行身份：

```text
$ sudo -n -u authsvc /usr/bin/id
uid=505(authsvc) gid=601(authsvc) groups=601(authsvc),599(oc-canary),12(everyone),61(localaccounts),100(_lpoperator)
```

runtime plist 只投影非 Secret 字段的读取结果：

```text
Label=ai.agent-core.runtime; UserName=authsvc
ProgramArguments=[/usr/local/libexec/agent-core/node-runtime/bin/node,
 /usr/local/libexec/agent-core/app/scripts/production-runtime.mjs,
 --root,/Users/authsvc/.agent-core,--catchup,0]
WorkingDirectory=/usr/local/libexec/agent-core/app
stdout=/Users/authsvc/.agent-core/logs/runtime.log
stderr=/Users/authsvc/.agent-core/logs/runtime.err.log
```

这证明配置的 invocation，不宣称已证明 PID/loaded code 或业务执行成功。
部署 `compose.js:231–234` 原文：

```js
if (!existsSync(layout.agentsConfig)) {
  throw Object.assign(new Error(`production-runtime: agent definition config missing: ${layout.agentsConfig} (provision the runtime first — the runtime never writes it)`), { code: 'CONFIG_MISSING' })
}
const definition = applyDefinition(ctx, { configFile: layout.agentsConfig })
```

精确路径/权限原文：

```text
/Users/authsvc/.agent-core/agents.json symlink=True
realpath=/usr/local/libexec/agent-core/config/agents.json
authsvc:authsvc drwx------ /usr/local/libexec/agent-core/config
authsvc:authsvc -rw------- /usr/local/libexec/agent-core/config/agents.json
root:authsvc lrwxr-xr-x /Users/authsvc/.agent-core/agents.json
```

部署 app 无 `.git`。`pack-provenance.json` 声明 source_head/label=`08102a550cf2f5e14646c6858786d7fe7a50c61d`，
并注明 packed_app_tree_sha256 和 source_tree_sha 是 overlay 前值，不能拿旧值认证整个当前树。
初次在本 worktree 读取该对象 rc=128；随后在声明 source repo
`/Users/yanfenma/workspace/project/production-dsh-agent-core` 用 `git show 08102a55:<path>`
取得对象，对部署实际 bytes 比较，以下三项均 git rc=0、matches=true：

| 部署相对 app 路径 | 实测 SHA256 | 对固定 Git 对象的关系 |
| --- | --- | --- |
| packages/agent-definition/src/config.js | fa33f6ff4cb905e558be661f29e7b7b82099427982430c2e86c9ccf914ff366c | 等于 08102a55 和本报告 main 的该文件。 |
| packages/production-runtime/src/compose.js | 04287bd404bf6b45d6026a82443ec2b94b944d7502a7e7766af295f8125a1cce | 等于 08102a55；与本报告 main 不同，故部署行号另列。 |
| packages/scheduler/src/watchdog/index.js | b84914b558438a94e588db073601df0f548219fd5ccdf2cfb7eec4da6af56dfe | 等于 08102a55 和本报告 main。 |
| scripts/trusted-cp-hardening-v1-verify.mjs | 8cadebcb4b4e4381b15447bc7da806d0271487c7a672968e06b65cdbc30ea9f8 | 部署读取 rc=0；与本报告 main bytes 相同；真实整册删除/重建入口。 |

另部署 access.js 实测 `0cf284aa9c61f3dba1edf861c0929e13c857831e9a13a4d678f003ee5606f210`，
与本报告 main bytes 相同。source repo 读取时 HEAD 为 `e30029e9df19f55ac797d852f70c334ae215111f`；
未将其可移动 HEAD 当部署版本。**以上是逐文件绑定，非整个包/运行进程认证。**

| 点名候选 | plist 配置 invocation / 报告面 | 实测安装状况 |
| --- | --- | --- |
| Scheduler W1 | 每300s，authsvc → app/scripts/scheduler-watchdog.mjs --role w1；store=/Users/authsvc/.agent-core/scheduler/jobs.json；state=/Users/authsvc/.agent-core/control/scheduler-watchdog；log=scheduler-watchdog-w1.log/err.log | runner 文件当前不存在，detector package 存在；不修复、不重启。 |
| Scheduler W2 | 每900s，root → 同 runner --role w2；stdout=/usr/local/var/scheduler-watchdog/w2.log | 只读 plist，不以 root 执行；同 runner 不存在。 |
| transport-watchdog | 每30s → /usr/local/libexec/agent-core/scripts/transport-watchdog.sh；报告面 authsvc logs/transport-watchdog.* | 该 scripts 目录和目标脚本不存在；不凭残留日志判断当前能力。 |
| fence-janitor | 每900s → /usr/local/libexec/agent-core/scripts/fence-janitor.py；报告面 authsvc logs/fence-janitor.* | 同上，不存在。 |
| artifacts-watchdog | 每120s → /usr/local/libexec/agent-core/scripts/artifacts-watchdog.sh | 同上；此名也不证明 Workflow ghost 检查。 |

只读 W1 stderr 尾部原文（文件在增长，行号仅本次读取时点）：

```text
108284:Error: Cannot find module '/usr/local/libexec/agent-core/app/scripts/scheduler-watchdog.mjs'
108292:  code: 'MODULE_NOT_FOUND',
```

真正存在的 state 目录是 `/Users/authsvc/.agent-core/control/scheduler-watchdog`，含
incidents.json、scheduler-watchdog-evidence.jsonl、alert-state.json、w1/w2.heartbeat 等。
`/Users/authsvc/.agent-core/watchdog-state` 和 `/Users/yanfenma/.agent-core/watchdog-state`
均不存在；没有因目录名猜错停止，而是按 plist 指向改查真实目录。

## 7. P2 — producer、invocation、报告面与 role 扩展点

### 7.1 精确 marker census 及负证据

以 `rg -uuu -l` / `--hidden --no-ignore` 搜
`NOT_IN_REGISTRY|not_in_registry|NotInRegistry`，再以版本化 git grep 和职责反查复核。
`-l` 先取文件名，避免输出配置/凭据内容；没有提取或提交 Secret。

| 搜索面 | 实际结果 | 证明力 |
| --- | --- | --- |
| Core 全仓（含 ignored/hidden，排 Git 内部对象） | 只命中本任务 Brief/issue/提案/调查及 worker 日志，未命中产品 producer。 | 日志/issue 复述不是 producer；起始提案 HEAD 与 main 的产品源码相同。 |
| Core 版本化 packages/scripts，排测试，宽变体 NOT_IN_REGISTRY/not.in.registry/notInRegistry/holdings/ghost | 只有 feishu-connector index.js:341 ghost reaction 注释、processing-reaction.js:21 GHOST_REACTION 注释。 | 与 Workflow holdings 无关。 |
| Python controller、Remote Gateway、旧 Core、Svc、hr-recovery-executor | exact marker 无命中；Svc 固定 b509678 对象 src/scripts 宽搜同样 rc=1。 | executor 是 workspace 根 shell 文件，非 repo；不编造 owner。 |
| **/usr/local/libexec/agent-core/app 全目录，含 node_modules**，authsvc | stdout 空、stderr 空、rc=1。 | 该实际部署快照中未找到字面 producer；不是全环境不存在证明。 |
| 同 app 同义职责反查 ghost/幽灵/不在册 | 只命中 Feishu source 及 mime-db 数据；domain_role_bindings/DOMAIN_OWNER/holdings 命中7个 Broker capability/registry 文件。 | 读过职责，不是所需 checker。 |
| authsvc logs、control/scheduler-watchdog、scheduler、workspaces/agt_hr-agent、workspaces/agt_job-watch-agent | 每个定向扫描 stdout/stderr 均空、各 rc=1。 | 缺省 HR/求职 workspace 各仅 AGENTS.md，不把求职 Agent 当系统 watchdog。 |
| /usr/local/var/scheduler-watchdog、可信 config 目录 | rc=1，未命中；前者含 w2/evidence/reconciliation 文件。 | 未见 marker。config 仅文件名搜索，无 Secret 输出。 |
| yanfenma .agent-core（排 sessions/control）、.openclaw/workspace | 各 rc=1、无错误。 | 静态候选负证据。 |
| 真正 HR/healthcheck primary 和 zcode-assist/tools | 各 exact-marker rc=1、无错误。 | primary 由生产映射读取，非目录名猜测。 |
| workspace/project 广域（排 git/node_modules/target/log/dist/cache） | 任务材料外仅 boke venv pooch 测试同名常量；最终 rc=2，有无关权限错误。 | 不当成完整全局 census，错误见 §8。 |

部署 full grep 实际 invocation（仅搜索，不启动产品）：

```text
sudo -n -u authsvc /opt/homebrew/Caskroom/codex/0.164.0/codex-path/rg \
  -l --hidden --no-ignore 'NOT_IN_REGISTRY|not_in_registry|NotInRegistry' \
  /usr/local/libexec/agent-core/app
stdout=""; stderr=""; rc=1
```

早期误用了 `/usr/bin/rg`，返回 `sudo: /usr/bin/rg: command not found`；随后用
`command -v rg` 得到上面的实际路径并重跑。该命令错误和探索空结果均不是产品测试失败。

### 7.2 Scheduler 实际产生什么

固定 main `scripts/scheduler-watchdog.mjs:329::runW1` 调用 evaluateDesiredState、
createSchedulerHealthRuntime.read、evaluateReconciliationEvidence、evaluateCredentialProvider，
→ :408 processIncidentNotifications；:425 runW2 看 W1 heartbeat；:492 主入口原文：

```js
const outcome = ROLE === 'w1' ? await runW1(nowMs) : await runW2(nowMs)
```

报告面 :68–75 是 incidents.json、scheduler-watchdog-evidence.jsonl、local-ops.jsonl
及 Feishu 通知。detector `packages/scheduler/src/watchdog/index.js:143–153` 原文：

```js
export function evaluateRunHealth(doc, { nowMs, opts = {}, runtimeHealth = {}, desired } = {}) {
  // ...
  const jobs = Array.isArray(doc?.jobs) ? doc.jobs : []
  const occurrences = Array.isArray(doc?.occurrences) ? doc.occurrences : []
```

它报告 JOB_MISSING、JOB_DISABLED、TARGET_AGENT_DRIFT、EXPECTED_RUN_MISSED 等 Scheduler
状态。`--role` 是 W1/W2 运行角色，**不是 Workflow domain/global role**，没有所需 holdings
读取/扩展点。source runner SHA256 `6ab88171142a386664aa9b9a230fff83a9e01f09c1467e32c661a1aea6a9e522`；
detector hash 见 §6。owner 为 Core；routing/recovery Spec frontmatter owners=mayf3/repository-maintainers；
接受权仍按 local governance，未由本调查授予修改或部署许可。

### 7.3 HR 真实 primary、脚本与 read projection

生产 `/Users/authsvc/.agent-core/primary-workspaces.json` 只读精确映射：

```text
agt_hr-agent → /Users/yanfenma/.openclaw/groups/workspace-oc_a5e904510bbf4b983d6cd97b9f7bbb74
agt_healthcheck-agent → /Users/yanfenma/.openclaw/groups/workspace-oc_2a1431dbcd1f4f16323b8d3063f26918
```

HR `scripts/daily_check_report.py:62::build_report` 原文摘录：

```python
openclaw_config = load_json(OPENCLAW_CONFIG)  # :63
employees = load_json(EMPLOYEES_FILE)        # :64
openclaw_agents = {agent["id"]: agent for agent in openclaw_config["agents"]["list"]}  # :66
# ...
added_agents = sorted(set(openclaw_agents) - set(employees_agents))    # :79
removed_agents = sorted(set(employees_agents) - set(openclaw_agents))  # :80
```

:93–99 报 employees 有而 OpenClaw 无；:343–345 issue_count 只有档案/路由/workspace/group；
:365–372 main 写 reports/daily-check-YYYYMMDD.md。此“缺员”检查不是 Svc 全 principals
和活跃实例/roles holdings join，无 marker，无 role 扩展点。
`scripts/check_workspace_consistency.sh:7–11/40` 只定位 OpenClaw/groups/report 并扫 workspace
目录/群绑定；`audit_forum_permissions.py` 查 Forum 权限，也不是本题 checker。

两脚本实测 SHA256：

```text
be76e07d35a9607fdc29047d2471238781277c93bd5e2040688d4f6561719951  scripts/daily_check_report.py
e6c71726e3d57e8c6842151f055b8af33a03c6e02b13e3e4f1b18e896aa2e5f7  scripts/check_workspace_consistency.sh
```

外层 invocation 只在 Core 历史 fixture
`packages/scheduler/fixtures/openclaw-jobs-enabled.json:2164` 的每日员工档案同步 prompt 中看到；
**历史 prompt 不证明当前 job 正执行**。所在 `.openclaw` Git HEAD
`245795ce0731a46629181fe5239b6c2c889e9463` 下两路径 `git ls-files` 为空，故它们的
owner repo/commit 和合法接受责任链仍 UNKNOWN；仅能绑定 path/hash、HR primary 归属。
未执行脚本（会写报告）。HR 的 definition/workflow JSON 对 ghost/holdings/registry/
domain_role/global_role/离职/退役反查 rc=1；assignee 宽搜只见历史 dispatch snapshots。

另一 HR 链的真实坐标：`agent-control/hr_readonly.py:279::read_facts` → :293 `_rpc`：

```python
result = _rpc(secret, 2, "tools/call", {
  "name": "hr_get_latest_dispatch_result", "arguments": {"limit": 20}})
```

版本化 `dot-read-mcp@46cbba8:src/server.mjs:159–187` 注册该 tool；:228–230 GET
`/internal/v1/dispatch-intents`；:243–246 GET `/internal/v1/workflow-instances/global`
并设 lifecycle=active，按 instance ID join。没有 Registry/全 principals/role bindings join。
`hr_readonly.py` 与其 HEAD 一致，hash
`82eb5de9f09f07f97e43afd84345da9c46dfd0d54b2084a3a11651369e1f2dcb`。
dot-read-mcp dirty 工作副本的 :431–640 不是该 SHA 的行号，已排除，未混用。

因此 P2 要求的真实 **producer、调用、报告面、role 扩展点和其 owner 接受链均未绑定**；
上面只给出各排除候选实际具有的链和报告面，不将其替代为目标。

## 8. 局部不可得、证明限度及后续责任

- `/Library/LaunchDaemons/com.openclaw.gateway.plist`、
  `/Users/yanfenma/Library/LaunchAgents/ai.openclaw.gateway.plist`：普通用户与 authsvc 读均
  `[Errno 13] Permission denied`；分别 stat 为 root 0600、authsvc 0600。没有改权限或升级 root。
  因而 OpenClaw 当前 gateway 的 loaded bundle/config override 关联 UNKNOWN。
- 广域 authsvc 扫 home/.openclaw 时有大量 OS permission denied；后续按 plist/primary
  精确改查可读对象。生产历史 backups、部分 cto/stock workspace 和 `/usr/local/var/agent-core`
  self-healing 历史物件也有权限错误；不拿不完整扫描断言零结果。没有读取其 Secret 内容。
- workspace 广域 rc=2 涉及无关 auth-service .env 及历史 recovery-backups 权限；
  未知脚本、远端未在本机的 repo/分支、已删除临时脚本、受限目录、历史人工/模型输出
  不被“全仓 grep”证明穷尽。未检索 Secret 内容或把 issue 复述当生成代码。
- 某个函数源码存在、包安装存在、plist 有配置、日志曾有输出、当前 PID 已加载、历史事件确实
  通过该函数，是不同事实；本调查只绑定读到的前几项，不越级。

| 未闭合项 | 责任链 | 最小下一事实/实现件（本次不执行） |
| --- | --- | --- |
| #1351 历史实际删除 callable | incident/原 gateway registry 操作的真实 owner；Core、OpenClaw 各按 owning repo | 提供当次操作 receipt/调用源/config 路径与版本；对照 §4/§5 确认同一 registry。若 Core 无专用边界，须明确新增实现件及所有 replacement 写面的处置。 |
| NOT_IN_REGISTRY producer | 该报告原出具者/运行脚本 owner；身份尚 UNKNOWN，不指定 Scheduler 或 HR 代领 | 提供原报告样例、生成命令/script/job path、版本/接受链；若确无实现，明确 Core/另仓 owning authority 的新 checker，不伪称已有扩展点。 |
| Workflow role 数据和完整读权限 | Svc 合法责任链 | P3 的 accepted companion、全量 roles/assignment 读与并发合同；本报告未关闭 P3。 |
| 接受与后续实现 | Core/Svc/真实 checker 各自有权接受者及非作者 reviewer | P1/P2 未闭合状态进入下一次 RE_PREFLIGHT；P4 接受事务未执行。不能仅凭此报告、PR 或文件属主开放实施/生产。 |

这不是要求重复 Owner 业务裁决，而是记录实际部件/运行证据缺口。本调查可以交付；
依赖这些 UNKNOWN 的正式接受和四闸实现继续关闭。没有声称全主机存在性已判否，
也没有以“探索空结果”为失败而写一份替代本交付的 STOPPED。

## 9. 可复核 hash 与交付检查

OpenClaw 安装文件 SHA256（相对 `/usr/local/lib/node_modules/openclaw`）：

```text
e0713291c4e873fefa7ea1ebc0f69bc0b555eec1fc55f9ab24e2fa21455242d3  package.json
e0693116be526ebf94eee398274c29ca241146398b2380d69c328660cfd740c6  dist/build-info.json
285ceb12a436e070c9cf99434bdd0e223104157f66d4536563cd1c2ac94474ab  dist/gateway-cli-ImzOm-jh.js
266ee1f535100bcae47835ee90fbc09c1cf0154b62ae94a3ef0c315e906d1764  dist/gateway-cli-B640UJM4.js
2b59f3895dd5029660095e1ed6454eb81ea85a29366ee4a65961799795652fb1  dist/agents-pYDkrcbT.js
e8c7fed11f61553e3045f75870e06e7aba4f0b797e581c5f74ae6dcaa5f3fd74  dist/register.agent-CR-VkRg3.js
a6420356ef4871e1fa8a07e494794e66a50f05dc0651d28cd13166e9744c84e2  dist/register.agent-DsxT3mFe.js
dbdf3ab7b22843e940f7c1c600e14488234e551c94ad0d8a210f91284ecb3b68  dist/agents.config-C7Buc7mN.js
bffd17ca154c95cb41381ccb8ffd70b1a39d5187a175061d585d252542cd4b3f  dist/agents.config-DwnEuX6Y.js
cbf750def00ab1d181abb53c6c0a18701f14bdd8c34412c9ee7bb44168e12a51  dist/auth-profiles-DBa6wi1M.js
777238217ccce4b9ddc8a1b406e622586f202fc54e4e434ca1302f157aebf190  dist/config-cli-Btygza8p.js
4828405aeb4ed8ba91b6cf4eacc22d9fbf2186e619a4fc315875db8d57249da9  dist/agent-scope-CZIF93u7.js
185b4b4404e0433bfc08f340612ab36fff1e0777fb875b6b4e18ddb34be66c57  dist/paths-jtwudEDq.js
b40c009bff99c7bb5eb825bb382ca9a755cce78600d025dd53da0e1694ec55d7  dist/register.maintenance-vGwgwdXf.js
18793a87141dc2b39708a24e62aa30815da6f82d7aae47d8f4bea952f2144253  dist/register.maintenance-B20t22t1.js
4bc1d2f7eae9cc3e89ca0f2d914fbc2b767ddc49c4ef3492eb11d50c89cef30a  dist/cleanup-utils-BMm3OQGr.js
bf9594943b2e334f672b62aa1adfbd878ec0d15f6328a5c6a3f23ff5081f27aa  dist/register.onboard-DlZ4vfiU.js
97ceadbd2114e096f5da50d346b642d711a6c0e18518abd78ab3da62677d7636  dist/onboard-DJmBz58w.js
5ced735f19e7cf3de6fd9eb793065d5dd72541410d7567c5392bac9bf07a032f  dist/onboarding-Br91BtN8.js
1f5319794c3a8b24445fe8f54078b41732246c2e29b8d56e69a3493d509f671d  dist/register.onboard-CNvluKXA.js
ac0e4a36150d2d2c4d084a05e7596dcb2cf96b15c9517629981fb779e315ad59  dist/onboard-BcOqUVXH.js
22b9afc8d261f6179c307e53f1c910f317fa5a15b82e3c6aeaf0653179505245  dist/reply-CTX8C1WW.js
3e4fcb30e7938f88ca22e1d863aac21def9ce6a7793dc471a9dd800a88aab7da  dist/onboarding-If0aaJtX.js
1c70e649c3a335a408f4ca0047fedd02b2fc64722b38cf005f13843d0ca02d8c  dist/config-cli-l0lKyG-o.js
057e19ce8f35d7c1230115295b2dd002e7ad99760fcfdaecc615a7195e86df5a  dist/doctor-config-flow-B1ZAprT7.js
9d2d76c11083814dde56eea8f337225784c0c1b01bd21ae83fbfe5a813e64a7c  dist/prompt-select-styled-B9juIisz.js
```

部署来源文件 SHA256：

```text
ca9a0e45149d9b59c4a93600d5a02696d8d416f40922f8e940d11b9c86e642fc  app/pack-provenance.json
0e2908a0672bff8afe1436e439141228a9a53096a95fbd46076df3970fe0a3c9  /Library/LaunchDaemons/ai.agent-core.runtime.plist
26eec717e32fe667e8468cd3779247e012ecfa7d4f44e861748a9d86377cf1ab  /Library/LaunchDaemons/ai.agent-core.scheduler-watchdog-w1.plist
d867170319b18a38db057c9769b6b97ff1c37358587be7753302190928bf1b7f  /Library/LaunchDaemons/ai.agent-core.scheduler-watchdog-w2.plist
c8d4e30e02f96572073c331cd03d711a5185cc76552dc096bbbbea631bab4d44  /Library/LaunchDaemons/ai.agent-core-transport-watchdog.plist
cd778d5279b74e640b3b5d99e933da1789eccd0077b5304849007c353fd5465e  /Library/LaunchDaemons/ai.agent-core-fence-janitor.plist
```

交付仅此 Markdown，文档校验/独立证据复核结果及 commit/PR 精确坐标记录在本次 PR；
不以自引用 commit hash 写入正文。不运行产品测试或有副作用脚本；三条业务验收
NOT_EXECUTED。生产 API 调用 0，生产写入 0，merge 0。
