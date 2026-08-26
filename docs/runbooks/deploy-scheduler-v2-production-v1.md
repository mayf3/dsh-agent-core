# Scheduler V2 正式部署方案 — DEPLOY_SCHEDULER_V2_PRODUCTION_V1

> TASK_NAME = 调度 正式部署执行（方案轮）· 2026-08-26 · **PLAN ONLY — 本轮不部署**。
> 状态：**DRAFT_PENDING_AUDIT**（下一轮 = 调度 正式部署审计；审计 PASS + owner 批准后方可执行）。
> 目标：把旁路验证通过的 Scheduler V2（DEPLOY_SCHEDULER_V2_QUICK_RESTORE_V1）合入
> authsvc 生产 runtime，解除 FEISHU_DELIVERY_BLOCKED（announce 经生产 cli_a9d7 连接直达股票群）。

## 0. DEVELOPMENT_PREFLIGHT

```text
DEVELOPMENT_PREFLIGHT

Problem = 旁路 runtime 已证 Scheduler V2 执行链 PASS，但 announce 无法送达股票群
         （cli_a9d7 WS 由生产 runtime 独占，一 app 一连接）。正式解 = 把 V2 overlay
         进生产 runtime 本体，用其既有 Feishu 挂载投递。
Governing Spec = SCHEDULER_TIMEOUT_OUTCOME_V2（accepted；PR #71 实现依据）
                + PRODUCTION_RUNTIME_V1（accepted；生产组合/部署面）
                + NOTIFICATION_INGRESS_SERVICE_AUTH_AND_IDEMPOTENCY_V1（accepted；随 overlay 生效，
                  见 §1 行为差异披露）
Spec status = accepted；实现已在 DEPLOY_SOURCE_COMMIT = 4d92e318b210794edf19271dd910dc276b165b30
               （含 32ce1fe PR #71 + 5f24a67 SIGKILL 修复；该 commit 是 origin/main 的祖先，
               main 此后已前移并包含 PR #76 —— 坐标分离见 §1.2/§2.0，PR76_EXCLUDED = YES）

Relevant investigations = SCHEDULER_V2_DEPLOY_TARGET_V1（overlay 方案原始证据，本方案直接继承）
                          DEPLOY_SCHEDULER_V2_QUICK_RESTORE_V1（旁路验证轮：执行链 PASS）
                          STOCK_CUTOVER_PREPARATION_V1（R1 单侧 enabled 纪律）
Relevant decisions = D-007 SCHEDULER_OCCURRENCE_OUTCOME_V2
Previously rejected alternatives = openclaw-job-import 导入（无 per-job filter + C-034 REFUSE）；
                          catch-up/replay（冻结禁止）；生产 app 二次挂载/第二 WS（一 app 一连接）

Frozen boundaries = 不启动第二 Feishu WS；不改 Feishu app（凭据/app_id/连接归属零变化）；
                    不影响聊天；不导入历史 jobs；catchup=false 保留；
                    最终 store 恰含 stock-daily-market-brief-001 一个 job
Need new/amended Spec = NO（纯部署动作，零代码改动；沿用 accepted spec 已实现的代码）
```

## 1. 新鲜基线证据（2026-08-26 晚复核，全部只读）

1. **live 源码子集 = 112/112 文件逐 blob 精确等于 68739d0**。2026-08-25 21:18 的 authsvc
   迁移是**全量重装**（1011 文件 mtime 全新 + 首次带入自含 node_modules/ 与 bundle-*/profile-*），
   但源码内容与 68739d0 installer subset 完全一致——**无任何私改热修**，deploy-target 调查的
   BASE 冻结依然有效。live scheduler/src 无 V2 文件（V1 未升级）。
2. **坐标分离（B3 修订，2026-08-26 fresh fetch）**：`CURRENT_MAIN_AT_REVISION = c52bd1c…`
   （origin/main tip，Merge PR #76 = route-chain 实现）。**本部署刻意不包含 PR #76**：
   `DEPLOY_SOURCE_COMMIT = 4d92e318b210794edf19271dd910dc276b165b30`（PR #74 时代的 main，
   含 Scheduler V2；与 7ab2e6d 在 packages/scripts 上零差异 → 35 文件 overlay 与原调查
   冻结集完全一致）。PR #76 与 overlay 的重叠文件恰两个：
   `packages/production-runtime/src/compose.js`、`packages/scheduler-router/src/index.js`
   —— 二者必须使用 4d92e31 的冻结 blob（见 §2.1/§2.2），**不得**使用 current main blob。
3. **feishu-connector 68739d0→4d92e31 零 diff**（byte-identical）→ overlay 不触碰 Feishu 代码。
4. **依赖零新增**：V2 新文件 import 仅相对路径 + node 内建 + croner（live node_modules 已有，
   2026-08-25 重装带入）；scheduler package.json 的 export map 变化不影响 runtime（组合走相对
   source import）。
5. **生产 plist**（零改动对象）：`--catchup 0` 在位；env 四个 FEISHU_* 值合法
   （card/false×2/true）；oc-go/deepseek-v4-flash；PRODUCT_API_ENABLED=0；无任何 proxy 变量；
   node-runtime = v25.6.1（满足 assertTargetProxyRuntime 版本门）。
6. **生产 agents.json（待 root 确认）**：其 lineage 前身（旧 yanfenma root）已含 85 agents 且
   **defaultAgentId = agt_stock_agent（股票分析师）** → 预计零 agent-definition 改动（R-5 条件项）。
7. 旁路 runtime 现状：ai.agent-core.scheduler-v2 running（pid 71743）、store 恰 1 canary job、
   执行链冒烟 PASS（SMOKE-OK）；OpenClaw 侧 stock job 已 disable（.bak 在案）。

## 2. PRODUCTION_DEPLOY_PLAN

### 2.0 部署形态（继承 SCHEDULER_V2_DEPLOY_TARGET_V1 §1）

blob-pinned 原子 overlay：**恰 35 文件**（18 REPLACE + 17 CREATE）落到
`/usr/local/libexec/agent-core/app`，plist **零改动**，`launchctl kickstart -k` 重启，
node_modules/bundle-*/profile-* **零触碰**。冻结常量：

```text
LIVE_ROOT      = /usr/local/libexec/agent-core/app
PLIST          = /Library/LaunchDaemons/ai.agent-core.runtime.plist（零改动）
SERVICE_LABEL  = system/ai.agent-core.runtime
HEALTH_URL     = http://127.0.0.1:8790/health
BASE_COMMIT    = 68739d0（112 文件源码子集，2026-08-26 逐 blob 复核 112/112）
CURRENT_MAIN_AT_REVISION = c52bd1c…（fresh fetch 的 origin/main tip，含 PR #76；
                 仅作坐标记录，**不是**提取来源）
DEPLOY_SOURCE_COMMIT     = 4d92e318b210794edf19271dd910dc276b165b30（唯一提取来源；
                 ≠ origin/main tip；刻意不含 PR #76 route-chain 实现，PR76_EXCLUDED = YES）
SOURCE_REPO    = /Users/yanfenma/workspace/project/dsh-agent-core-main（git worktree，
                 与主仓库共享对象库；blob 只能经 git show DEPLOY_SOURCE_COMMIT:<path> 提取）
OWNER/GID      = 保持逐文件现状（temp+rename 保留 uid/gid/mode；新增文件随目录属主约定）
CATCHUP        = 0（plist 既有值，不动）
```

**提取纪律（硬约束）**：全部 35 个部署文件只能经
`git show 4d92e318b210794edf19271dd910dc276b165b30:<path>` 提取。明确禁止：
从 origin/main tip 提取；从当前工作树复制；从 dirty checkout 复制；按文件名或最新提交
猜测 target；顺带部署 PR #76。

### 2.1 冻结 overlay 表（REPLACE 18 —— path → target blob）

| path | target blob |
|---|---|
| packages/agent-router/src/process/agent-process.js | 40de76f5f4dc… |
| packages/agent-router/src/process/event-correlation.js | f51370a733ae… |
| packages/agent-router/src/process/index.js | 71fbadc5ab25… |
| packages/agent-router/src/process/turn-execution.js | 1f600942406b… |
| packages/notification-ingress/src/index.js | 4a22305cebcc… |
| packages/production-runtime/src/compose.js | 6916007fc42b… |
| packages/production-runtime/src/paths.js | 55392cee1dac… |
| packages/scheduler-router/package.json | f9642e7e2292… |
| packages/scheduler-router/src/index.js | d9254c658b48… |
| packages/scheduler/package.json | db0838e694f0… |
| packages/scheduler/src/import-openclaw.js | bce4c4dab93a… |
| packages/scheduler/src/index.js | 5cd90dd8cece… |
| packages/scheduler/src/job-model.js | 066ad9c14859… |
| packages/scheduler/src/scheduler.js | 92f7a4dd5373… |
| packages/scheduler/src/seams.js | 1fa3767ea909… |
| packages/scheduler/src/store.js | 622a0befc768… |
| scripts/agent-core-resident.mjs | a44056845c43… |
| scripts/agentcore-cron.mjs | 17003af3f582… |

（前 4 项 = PR66 稳定修复，target blob 与 docs/runbooks/deploy-pr66-stability-fix-v1.md
§1 冻结值逐字一致 —— 独立交叉验证。）

### 2.2 冻结 overlay 表（CREATE 17 —— path → target blob）

| path | target blob |
|---|---|
| packages/notification-ingress/src/auth.js | f11ae4ce1e1d… |
| packages/notification-ingress/src/deliver-handler.js | 909bb07ca56a… |
| packages/notification-ingress/src/idempotency-persistence.js | c47802fd1049… |
| packages/notification-ingress/src/idempotency-record.js | 3f1ea21959a4… |
| packages/notification-ingress/src/idempotency.js | 2e29803ba63f… |
| packages/notification-ingress/src/wire-response.js | 1ee0eafa2b44… |
| packages/production-runtime/src/notification-ingress-runtime.js | 82b047cdd0f3… |
| packages/scheduler/src/control.js | 90007837b6f2… |
| packages/scheduler/src/eligibility.js | 86313158ad94… |
| packages/scheduler/src/lock.js | d681bc583ea0… |
| packages/scheduler/src/occurrence-model.js | 48b6a54569d5… |
| packages/scheduler/src/occurrence.js | 56df35a85d7f… |
| packages/scheduler/src/reconcile.js | 9c89cef22494… |
| packages/scheduler/src/store-migration.js | f8faade6218d… |
| scripts/notification-ingress-service-auth-v1-verify.mjs | ef7850628d9f… |
| scripts/openclaw-job-import.mjs | a33f8a5eed31… |
| scripts/scheduler-v1-verify.mjs | 4a9a8450f94d… |

PRESERVE = 其余 94 个源码文件逐 blob == BASE，外加 node_modules/、bundle-*/、profile-*
全部目录不动。执行轮落位 `BASE_MANIFEST_SHA256 / TARGET_MANIFEST_SHA256`（行格式
`<git-blob-oid>␣␣<path>`，LC_ALL=C 排序，排除安装工件），manifest 不匹配即 fail-closed。

### 2.3 阶段序列（P0→P5；单执行者不变量：任一时刻恰好一侧可执行 02:44 简报）

- **P0 预检**（非特权 A + root B，见 §3 R-1）：live==BASE 复核；plist/env/catchup 复核；
  生产 store raw 只读（预期空 V1，~33B；**禁止用新树 CLI 打开**——V2 任何读路径触发升级）；
  agents.json 含 agt_stock_agent 确认；/Users/authsvc/.dsh/{settings.yaml,.credentials.yaml}
  存在性；workspaces/agt_stock_agent 存在性。
- **P1 overlay + 重启**（root，§3 R-2~R-4）：lock dir → 全量备份 app.bak-<label>-<ts>
  （验证 == BASE）→ staging（git show 逐 blob）→ 18 文件同目录 temp+rename 原子替换（保持
  uid/gid/mode）+ 17 文件同机制创建 → TARGET manifest 验证 → `launchctl kickstart -k
  system/ai.agent-core.runtime` → health 等待。任一步失败 → 强制回滚（§4 R1）。
  首启自动动作：`ensureUpgraded()`（mutation lock 内，空 V1 → v2 + generation 备份 +
  upgrade-v2.json sidecar + store_upgrade 事件；空 store = 零 job 语义变化）。
- **P2 部署验证门 G1–G6**（见 2.4）。
- **P3 canary 迁入生产**（先侧后正，R1 纪律）：
  1. yanfenma（无 root）：旁路 job disable —— `node scripts/agentcore-cron.mjs disable
     stock-daily-market-brief-001 --store ~/.agent-core-scheduler-v2/scheduler/jobs.json`；
  2. root（§3 R-7）：在生产 store 创建恰一个 job（冻结字段与旁路轮一致：cron
     `44 2 * * 1-5` / tz Asia/Shanghai / payload 原文 + timeoutSeconds 1800 /
     announce→`chat:oc_0480991b97f1e27c96514ac66b4f122c` / **显式 id
     stock-daily-market-brief-001**）。CLI `add` 不携带 delivery target → 用等价
     JobStore 锁定 mutate 一次写入（同旁路轮已验证的脚本形态，经 overlay 后的 live 树执行）。
  3. 若 P0 发现 agents.json 缺 agt_stock_agent → 先 R-5；若 workspaces 缺 → 先 R-6。
- **P4 首跑验证（02:44 窗口 + 02:50 核查）**：G7–G8（含 FEISHU_DELIVERY = PASS 判定）。
- **P5 旁路退役**：G8 PASS 后 → `launchctl bootout gui/502/ai.agent-core.scheduler-v2`
  + `mv ~/.agent-core-scheduler-v2 ~/.agent-core-scheduler-v2.bak-<ts>`（存档含冒烟
  occurrence 证据，不迁移不导入）。G8 FAIL → §4 R2 回到旁路。

**部署窗口建议**：job 时刻 02:44 Asia/Shanghai 前的低流量窗口（推荐 00:30–02:15 完成
P1–P3，02:30 前全部就绪）；P1 重启有秒级 WS 重连间隙，避开聊天高峰。若错过当日窗口，
生产首跑顺延至下一个工作日 02:44（旁路侧在退役前保持兜底）。

### 2.4 验证门

| # | 门 | PASS 条件 |
|---|---|---|
| G1 | daemon | state=running、新 pid、参数仍含 `--catchup 0`、env 四个 FEISHU_* 值不变、plist sha 不变 |
| G2 | 日志 | `scheduler loop online`；无 `FEISHU_*_INVALID` / `AUTH` fatal；feishu `bot identity resolved`（同一 open_id = app 未变证明） |
| G3 | store（root raw） | `{version:2,jobs:[],occurrences:[],fences:{}}`；`.v1.<ts>.bak` + `jobs.json.upgrade-v2.json` 在；runs.jsonl 有 `store_upgrade` |
| G4 | CLI（此刻安全） | `agentcore-cron list --store /Users/authsvc/.agent-core/scheduler/jobs.json` = 0 jobs；P3 后 = 恰 1 job enabled |
| G5 | ingress 行为差 | `/health` 200 且含 `authConfigured:false`；匿名 `POST /v1/deliver` → **503 AUTH_NOT_CONFIGURED**（fail-closed 证明，见 §5 披露） |
| G6 | 聊天不回归（§2.5 八项门全 PASS；owner 真实飞书验收 + 技术证据，二者不可互替） | CARD_REPLY / TYPING_REACTION / PR66_LIVE_CHILD_BOOT / PR66_RPC_INITIALIZE / PR66_CHILD_RECREATION / NEXT_PROMPT_ADMISSION = PASS 且 DUPLICATE_CHILD / DUPLICATE_REPLY = NO（完整冻结见 §2.5） |
| G7 | job | nextRunAtMs = 下一个未来 02:44 Asia/Shanghai；创建后、到点前零 occurrence |
| G8 | 首跑 | occurrence `succeeded` + **delivery=delivered** + 股票群可见简报消息（owner 肉眼）；runs.jsonl 事件链（occurrence_reserved→turn_start→router_admission→outcome→delivery） |
| G9 | 保留面 | node_modules/bundle-*/profile-* 逐文件 sha 不变；94 PRESERVE 文件逐 blob == BASE |

### 2.5 G6 聊天回归门（自包含冻结；本节为唯一权威定义，不引用任何外部 runbook 的门名）

**验证对象**：真正部署后的 live app —— `/usr/local/libexec/agent-core/app`（35 文件 overlay
完成 + kickstart 后、由 `system/ai.agent-core.runtime` 实际运行的生产 runtime 及其 DSH
child 进程）。不得以测试 rig、旁路 runtime、旧进程或任何非该 live app 的替换物作为验证对象。
PR66 4 文件（agent-router process 稳定修复）随本 overlay **首次**进入生产，本节即其验收门。

八项判定（全 PASS 才算 G6 = PASS）：

```text
1. CARD_REPLY            = PASS   真实 bound 群内一条真实消息获得 card 渲染回复
                                    （owner 在既有绑定群发送；回复为 card 模式渲染）
2. TYPING_REACTION       = PASS   该消息处理期间 Typing reaction 出现，结束后被清除
3. PR66_LIVE_CHILD_BOOT  = PASS   部署后 live app 的 agent child 进程真实启动：
                                    runtime 日志/证据出现 child spawn 与 registry ready
                                    （对象 = 生产 daemon 的子进程，非测试 harness）
4. PR66_RPC_INITIALIZE   = PASS   child 经 RPC initialize 正常完成（initialize 序列
                                    到达 ready，无 fail/timeout）
5. PR66_CHILD_RECREATION = PASS   终止既有 child（kill）后，下一次消息 admission 自动
                                    respawn 并正常服务；必须记录并证明 旧 PID ≠ 新 PID
                                    （两个 PID 数值均落证据）
6. NEXT_PROMPT_ADMISSION = PASS   child recreation 之后的一次「下一 prompt」必须是
                                    一次低风险、无工具副作用的真实 admission（例如
                                    问候类消息），被正常接受并回复
7. DUPLICATE_CHILD       = NO     全程同一 agent 无重复 child 进程（任一时刻该 agent
                                    恰一个存活 PID；无并行双 child）
8. DUPLICATE_REPLY       = NO     单条真实消息恰好一条回复（无重复/双发消息）
```

证据位置：`/Users/authsvc/.agent-core/logs/runtime.log`、
`/Users/authsvc/.agent-core/control/runtime-evidence.jsonl`（child spawn/ready/PID）、
owner 的飞书客户端截图（card 回复 + reaction + 无重复消息）。

**边界（不可互替）**：3/4/5/7 可由技术探针（日志/PID 比对）取证；但 1/2/6/8 属于
**Owner 的真实飞书聊天验收**——技术探针不能冒充 Owner 的真实聊天验收；反之 owner 观感
也不能替代 PID/RPC 的机械取证。G6 = PASS 需要两侧证据同时在场。


## 3. ROOT_REQUIREMENTS（uid 0 一次介入清单；脚本内绝不 sudo）

```text
R-1 只读预检（P0）
    a. sudo cat /Users/authsvc/.agent-core/scheduler/jobs.json   # 预期 {"version":1,"jobs":[]} ~33B
       sudo ls -la /Users/authsvc/.agent-core/scheduler/         # 无 .lock/.engine.lock/upgrade 残留
       —— 只允许 raw cat/jq/python；非空 jobs → STOP + OWNER_DECISION
    b. sudo python3 -c '读 agents.json' 确认含 agt_stock_agent（预期 lineage 一致，零改动）
    c. sudo ls /Users/authsvc/.dsh/settings.yaml /Users/authsvc/.dsh/.credentials.yaml  # agent home 源
    d. sudo ls /Users/authsvc/.agent-core/workspaces/            # agt_stock_agent 是否已有 workspace
    e. sudo ls -ln /usr/local/libexec/agent-core/app/packages/scheduler/src/index.js   # 记录 uid:gid（505:601）

R-2 全量备份（P1）
    sudo cp -Rp app app.bak-schedv2-<ts>（或 ditto）；逐文件 manifest 复核 == BASE

R-3 overlay 写入（P1，35 文件）
    git -C /Users/yanfenma/workspace/project/dsh-agent-core-main \
      show 4d92e318b210794edf19271dd910dc276b165b30:<path> 逐 blob 提取（唯一合法来源；
      禁止从 origin/main tip / 当前工作树 / dirty checkout 提取，禁止按文件名或最新提交
      猜 target，禁止顺带部署 PR #76 —— PR76_EXCLUDED = YES）
    → staging → 同目录 temp+rename（18 替换保持 uid/gid/mode；17 创建）→ TARGET manifest 复核

R-4 重启（P1）
    sudo launchctl kickstart -k system/ai.agent-core.runtime && health 等待

R-5（条件项，仅当 R-1b 未命中）agents.json 合入 agt_stock_agent（备份先行，原子写）

R-6（条件项，仅当 R-1d 未命中）workspace 快照落位
    sudo cp -Rp /Users/yanfenma/.agent-core-scheduler-v2/workspaces/agt_stock_agent \
                 /Users/authsvc/.agent-core/workspaces/agt_stock_agent
    sudo chown -R <505:601> …（数值以 R-1e 为准）

R-7 生产 job 创建（P3；root 经 overlay 后的 live 树执行，显式 --store，env 无 proxy）
    node --input-type=module 脚本：JobStore('/Users/authsvc/.agent-core/scheduler/jobs.json')
    .mutate(normalizeJob({id:'stock-daily-market-brief-001', …冻结字段…}))（与旁路轮同形）

R-8 验证读取（G3/G8）+ 回滚执行（§4；含 rm 17 个 CREATE 文件、备份恢复、kickstart）
```

非 root 部分（yanfenma 可独立完成）：P0 模式 A、旁路 disable/enable、P5 退役、G1/G2/G4/G5/G7
读取、旁路侧一切操作。

## 4. ROLLBACK_PLAN（分级；全部机械 ≤10 分钟）

```text
R1 代码回滚（P1/P2 失败或 G1/G2/G6 FAIL —— 最重）
   1. sudo launchctl bootout…无需：直接从已验证备份恢复恰 35 文件：
      18 REPLACE ← app.bak-schedv2-<ts> 原位复制（uid/gid/mode 随备份）；17 CREATE ← rm
   2. 重验 BASE manifest（112/112）
   3. sudo launchctl kickstart -k system/ai.agent-core.runtime + health
   4. store 无需强制恢复：V1 代码 _loadFresh 不校验 version 字段（读 data.jobs 数组），
      读到 v2 空 store（jobs:[]）正常 boot；可选更严格 = 从 generation 备份恢复 v1 字节
      （occurrences/fences 空 + 无 V2-era mutation → rollbackToV1 条件满足；library API 无 CLI，
      owner 一次性脚本）。P3 未执行时生产 store 本就零 job，无损失。
   5. 旁路侧若已 disable → 立即 re-enable（yanfenma）：02:44 简报回到旁路（交付仍 blocked，
      与 cutover 前等价）

R2 job 级回滚（P3 后、G8 FAIL 或 owner 撤回）
   1. root：node agentcore-cron.mjs disable stock-daily-market-brief-001 --store <生产 store>
      （disable 保证据；彻底移除用 rm）
   2. yanfenma：旁路 job re-enable → 单执行者回到旁路
   3. 代码面不动（V2 runtime 本身已验证无害；零 job 时 admission 永不发生）

R3 聊天回归（G6 FAIL → 并入 R1）
   Feishu app/凭据/plist 全程未动 → R1 恢复代码即恢复行为；无第二恢复项

R4 store 损坏（极端：G3 形状异常）
   STOP + OWNER_DECISION；generation 备份 .v1.<ts>.bak 在案，逐字节恢复 + kickstart

回滚顺序总则：先停新路径（R2 job disable）→ 再回代码（R1）→ 再恢复旧路径（旁路 enable）；
任一时刻恰好一侧可执行。OpenClaw 侧保持 disabled（其返回是独立的 owner 决策，不在本方案）。
```

## 5. 行为差异披露（审计要点）

1. **8790 ingress 版本切换**：V0 thin 匿名 → PR63 service-auth 版。`/health` 仍 200（body 增
   `authConfigured:false`）；匿名 deliver 由「可接受」变 **503 fail-closed**。现存调用者 = 0
   （pr66 调查 line 68 + 本轮无新调用方）；`FORUM/WORKFLOW_NOTIFICATION_CUTOVER` 维持 BLOCKED。
2. **PR66 4 文件首次上线**：agent-router process 稳定修复随本 overlay 首次进入生产；
   验收门 = §2.5 八项门（自包含冻结，无外部门名引用）。
3. **重启间隙**：kickstart 引起秒级 WS 重连，窗口选低流量时段；Feishu app/凭据零变化
   （G2 的 open_id 比对为证）。
4. **生产 store 唯一持久变化**：空 V1→v2 升级产物 + 恰 1 个 job 的写入。不导入任何历史
   job/occurrence（旁路冒烟证据留在旁路存档，不迁移）。

## 6. 禁止项

```text
SECOND_FEISHU_WS    = FORBIDDEN（旁路 runtime 从未挂载 feishu；生产仅既有单连接）
FEISHU_APP_CHANGE   = FORBIDDEN（凭据文件/app_id/plist env 零触碰）
OPENCLAW_IMPORT     = FORBIDDEN（openclaw-job-import 任何形态；overlay 仅为更新文件在盘）
CATCHUP/REPLAY      = FORBIDDEN（--catchup 0 保留 + 零 occurrence + retry 缺省 NO）
HISTORICAL_JOBS     = FORBIDDEN（生产 store 终态恰 1 job）
PLIST_CHANGE        = FORBIDDEN（sha 前后一致为 G1 门）
EXTRACT_FROM_MAIN_TIP = FORBIDDEN（唯一合法来源 = git show 4d92e318b210794edf19271dd910dc276b165b30:<path>）
EXTRACT_FROM_WORKTREE = FORBIDDEN（含 dirty checkout / 按文件名或最新提交猜 target）
PR76_SCOPE_CREEP    = FORBIDDEN（PR76_EXCLUDED = YES；重叠文件 compose.js /
                      scheduler-router/src/index.js 用 4d92e31 冻结 blob，非 current main blob）
PROD_STORE_MANUAL   = FORBIDDEN（部署前只用 raw cat 读；部署后只经 JobStore 锁定 mutate 写）
SUDO_INSIDE_SCRIPT  = NO · SECRET_OUTPUT = NO · SKIP_AUDIT = FORBIDDEN（审计轮先行）
```

## 7. 边界与下一步

```text
本轮 PRODUCT_CODE_CHANGE = NONE · PRODUCTION_CHANGE = NONE · MERGE = NO · DEPLOY = NO
修订轮（调度 正式部署方案修订，DOCS ONLY）关闭三个审计 blocker：
  B1 idempotency.js blob 2e29803ba63d → 2e29803ba63f，全 35 项机械重验
     OVERLAY_BLOB_MATCH = 35/35（git rev-parse DEPLOY_SOURCE_COMMIT:<path> 逐项对拍）
  B2 G6 收敛为 §2.5 自包含八项门，删除一切对外部 runbook 门名的引用
  B3 坐标分离：CURRENT_MAIN_AT_REVISION = c52bd1c…（含 PR #76）≠
     DEPLOY_SOURCE_COMMIT = 4d92e318b210794edf19271dd910dc276b165b30（唯一提取来源）
PR76_EXCLUDED = YES（PR #76 route-chain 实现刻意不入产；与其重叠的 overlay 文件恰两个：
  packages/production-runtime/src/compose.js、packages/scheduler-router/src/index.js
  —— 二者部署用 4d92e31 冻结 blob：6916007fc42b… / d9254c658b48…，非 current main blob）
新增物 = 本方案文档（docs/runbooks/deploy-scheduler-v2-production-v1.md）
NEXT_TASK = 调度 正式部署复审（对修订后 §1/§2 冻结表逐 blob 复核 + §2.5 G6 完备性 +
            §3 提取纪律 + §4 回滚完备性；复审 PASS + owner 批准后进入执行轮）
```

证据锚点：`git diff --name-status 68739d0 4d92e318b210794edf19271dd910dc276b165b30 -- packages/
scripts/`（35 文件）+ `git rev-parse 4d92e318b210794edf19271dd910dc276b165b30:<path>` 逐项
（OVERLAY_BLOB_MATCH = 35/35）；`git rev-parse origin/main` = c52bd1c…（含 PR #76 的当前
main，仅坐标记录）；live 112/112 blob 匹配（本轮 python 复核）；
`/Library/LaunchDaemons/ai.agent-core.runtime.plist`（零改动对象）；
docs/investigations/scheduler-v2-deploy-target-v1.md；docs/runbooks/
deploy-pr66-stability-fix-v1.md §1（4 blob 交叉验证，仅 blob 表引用，无门名依赖）；
docs/runbooks/deploy-scheduler-v2-quick-restore-v1.md（旁路验证 + 执行链 PASS）；
packages/scheduler/src/*（store-migration.js 空 store 路径、occurrence.js delivery 语义、
schedule.js 严格未来时刻）。
