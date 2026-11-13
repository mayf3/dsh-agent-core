# 656367CD-LANDING-PREP — v3 终态归类修复落地准备（三文件：+spawn.js）

**候选构建、Owner RED→GREEN 与合成回归已完成；安装 runbook 已准备、未执行。** 本交付只用于原发布链接续，生产操作 `OPERATION_ALLOWED=NO`。v1 的真实构建失败保留在 [STOPPED](STOPPED-656CD-LANDING.md)，本次凭 Owner v2 续办授权闭合该停点，没有改写失败历史。

**v3 扩展（Owner 2026-11-09 三差量指令第1项）：** 候选由两文件升为**三文件**，补入 Git656 原修复的 `spawn.js` child-exit 结算差量（10 行，C-017 优先级块）。v2 曾显式声明"656 中 child-exit 修复不属本次两文件范围"，该限度如实成立但**不能称终态缺陷完整修复**——同一"超时→aborted 终态→idle 前子进程退出"反例在两文件候选下仍伪造 `late_completed`（RED 已实证，见 §4.1）。v3 用原作者自己的测试文件（自 git 656367cd 逐字节复制）完成 RED→GREEN 与全目录回归，关闭该缺口。既有两文件成果（候选、合成 fixture 证据、runbook 结构）全部保留。

## 1. 授权、坐标与路线

- 授权：Owner 2026-11-09 本轮指令及 [BRIEF v2](BRIEF-656367CD-LANDING.md#续办补充v22026-11-09-监管裁定)。目标是现役组合的最小前向修复准备；允许隔离文件写入、commit、push、PR(base main)，禁止合并与任何生产写入。
- Repo/worktree：`mayf3/dsh-agent-core` / `/Users/yanfenma/workspace/project/worktrees/ops-656-landing`；branch `fix/656367cd-landing-prep`。
- 唯一写者：Codex root；独立 QA：`/root/qa`（只读）；只读发布链研究：`/root/runbook_research`。均为本地工程协作，无生产 Agent 派发。
- 开始 HEAD / integration base：`6ad69d1fa6fa8c7dcfb3b5b61207c7d21a80ecef`；本轮 `git ls-remote origin refs/heads/main` 读回相同。最终 commit 坐标与 QA final-Head 核对记入 PR。
- Git656 原修复：`656367cdfa2d8a8c72e63ab16d1932c895396b2b`，已核为 base 祖先。v2 取两份原 blob；**v3 扩展补取第三份 spawn.js 原 blob**（仍不取后续 main transport retry 尾巴）。

```text
schema_version = 2
SPEC_GOVERNANCE_MODE = PREFLIGHT
GOAL_OR_TARGET = prepare exact three-file (event/state/spawn) terminal+idle forward-fix for original release chain (v2 two-file scope extended by Owner 2026-11-09 delta-1)
CURRENT_GAP = v1 build stop; candidate and executed evidence absent at continuation start
AUTHORITY_ACTION = REUSE
PRIMARY_AUTHORITY = AGENT_PROCESS_LIFECYCLE_HARDENING_V4@base r0 C-010,C-014..C-018,§12.2
RELATED_AUTHORITIES = D-009; PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1@base
AUTHORITY_ACCEPTED_IN_BASE = YES
IMPLEMENTATION_AUTHORITY = contracts
ROUTE_STAGE = IMPLEMENTATION
PLAN_LEVEL = EXEC_PLAN
ASSURANCE_LEVEL = DURABLE
MUTATION_AUTHORIZATION = VALID (Owner v2; isolated preparation and Git delivery)
ISOLATED_WRITE_SURFACE = YES
SPEC_GAP_DEPENDENCY = NONE
LIVE_AUTHORITY_GAP = NONE
EVIDENCE_REVIEWABILITY = PASS (local files and Git-tracked raw logs)
IMPLEMENTATION_ALLOWED = YES (preparation only)
MERGE_READY = NO (task prohibits merge)
OPERATION_ALLOWED = NO (production)
DONE_WHEN = candidate + RED/GREEN/regression + independent QA + runbook + commit/push/open PR
EXPANSION_TRIGGER = actual unexpected build/test failure; hash drift; authority conflict;
  need for production mutation or broader source delta
NEXT_ACTION = CONTINUE (Git delivery after final QA)
```

已读 AGENTS、vendored/local grammar、Spec-governance PREFLIGHT、Architecture、Decision index/D-009 和直接相关 accepted Contracts。既有长期语义不变：终止证据不伪造业务成败；UNKNOWN 历史与副作用不确定性保留、不重放。没有新增恢复机制或 Product Spec。

执行阶段：①lstat/前像核验与本地停点修复；②隔离构建；③Owner RED→GREEN/回归；④独立 QA 与未执行 runbook；⑤commit/push/PR，不合并。前四阶段证据如下；第五阶段结果以 PR 精确 Head 为准。

## 2. v1 停点修复及依赖闭包

[v2-preflight.json](docs/evidence/656367cd-landing/v2-preflight.json) 记录本轮 lstat：`node_modules` 是 symlink，字面目标 `/private/tmp/dsh-ekr-p1-new/node_modules` 不存在。仅 `unlink` 该悬空链接，未删除或写入目标。该链接原来被 Git 跟踪，故本 PR 包含其删除；`node_modules/` 原已忽略。没有 npm install。

`build.py` 仅将 `SCRATCH` 从 `node_modules/.cache/656367cd-landing` 改为 `.build-scratch/656367cd-landing`；根 `.gitignore` 新增忽略 scratch。构建成功 rc0，见 [build.log](docs/evidence/656367cd-landing/build.log)、[build-receipt.json](docs/evidence/656367cd-landing/build-receipt.json)。构建不覆盖已有 scratch；复现实验须用独立新 worktree，保留本轮证据。

| 符号/文件 | 安装版事实 | Git656 候选与最小集判断 |
|---|---|---|
| `envelopeCarrier` | state-machine 已导出 | 保留，无新增文件需求 |
| `exactTurnOutcome` | state-machine 未导出 | 换入 Git656 state-machine，仅增10行；只有 completed/error 给出精确结果，其余返回 null |
| `markTransportRetryEvidence` | delivery-resilience.js 不存在 | Git656 event 不导入/调用该符号；不选含额外25行差量的后续 main event，不引入 transport 闭包 |
| `provider-errors.js` | 本轮完整现役副本保留 | 原 event 仅依赖 node:crypto + provider-errors + state-machine；真实候选 import 成功，无顶层 I/O |
| `spawn.js` | v2 保留现役 SHA256 `add4e95e…`（缺陷二值判断）；**v3 已换入 Git656 spawn**（blob `3e9fa7c43885db973e653818fa103ad3aca903ae`，内容 SHA256 `ca97f2c4aa9112e920c21fbff5b60136e9d54de8bbe08d636213428c4fbaa9e9`） | 656 的 child-exit 结算修复：C-017 块改用 `exactTurnOutcome` 三值判定，aborted/非结果终态走 `terminated_without_outcome`（else 分支），不再伪造 `late_completed/late_failed`。base 与 Git656 spawn 逐字节相同（零漂移），故换入仅引入该 10 行修复，无其他改动；依赖闭包 `exactTurnOutcome` 由候选 state-machine 提供 |

## 3. 候选与逐文件 pin

生产替换范围为以下**三项**，公共前缀 `packages/agent-router/src/process/`。event 差量23行 changed（含 import），state 仅新增10行，spawn 差量10行 changed（含 import）；[event diff](docs/evidence/656367cd-landing/event-correlation.js.diff)、[state diff](docs/evidence/656367cd-landing/state-machine.js.diff)、[spawn diff](docs/evidence/656367cd-landing/spawn.js.diff)。

| 文件 | 安装前像 SHA256 | Git656 候选 SHA256 | Git blob |
|---|---|---|---|
| `event-correlation.js` | `47693d4d79af4e0643078e4f178bd341457b8418c07892d1a65d846f07af58bc` | `1e6340b363df6555bd157ec2a8ceaa6d3e08c7fbb045872cedc2e37994e596fa` | `68970de38245b0d595a1d581eaacf41d81f9563e` |
| `state-machine.js` | `6e079adcc807c772e2a360db9c4e4efcd06070397ef196f53f9173ab9b643342` | `53f02f66ce09da9957373e97148a7a498bb07c8ddef50bc1161f5ea9f7e30ad4` | `9310579a21bac2d783edab1b61d18752712d60e7` |
| `spawn.js`（v3） | `add4e95e3318b98f8157c8c2dc3d5e29db219839a2b50484a2f5f3a7a8fc0063` | `ca97f2c4aa9112e920c21fbff5b60136e9d54de8bbe08d636213428c4fbaa9e9` | `3e9fa7c43885db973e653818fa103ad3aca903ae` |

- 可审阅的三文件候选：[candidate/app](docs/evidence/656367cd-landing/candidate/app/packages/agent-router/src/process/event-correlation.js)；三份原像在 [preimage/app](docs/evidence/656367cd-landing/preimage/app/packages/agent-router/src/process/event-correlation.js)；[delta.json](docs/evidence/656367cd-landing/delta.json) 含完整路径与来源。
- 本机完整隔离副本：`/Users/yanfenma/workspace/project/worktrees/ops-656-landing/.build-scratch/656367cd-landing/candidate/app`；安装前像完整隔离副本：`/Users/yanfenma/workspace/project/worktrees/ops-656-landing/.build-scratch/656367cd-landing/installed/app`。完整副本不进 Git，Git 中交付三文件 delta、三文件前像、全 app manifests、脚本及执行原文。
- 全清单各 1,703 项：[installed-manifest.json](docs/evidence/656367cd-landing/installed-manifest.json) SHA256 `28acb0fad8bcf3967511db7687ada324b0ccac7296e7af4d5252dd3dbb376454`；[candidate-manifest.json](docs/evidence/656367cd-landing/candidate-manifest.json) **v3 重生成后 SHA256 `69943b500021ec0aca14bc43765ac58d4c3ff8f55ad7719858b30f759f112889`**（v2 值 `b397e0e4…` 已被取代；[regenerate-candidate-manifest.py](docs/evidence/656367cd-landing/spawn-extension/regenerate-candidate-manifest.py) 附于 PR 供复核，内部断言 candidate vs installed 恰好 3 项差异且等于 delta.json）。[delta.json](docs/evidence/656367cd-landing/delta.json) 现含三项（v3 SHA256 `dc31a1084e049be1f852eba0d9b0e3144166b6897cfbc040cdca3fad7b367945`）。
- 构建及测试各自前后，live app 的 path/kind/mode/size/SHA256/symlink literal 清单相同；候选相对前像恰好三项不同（v3）。它证明所读 app 文件未漂移，不能证明正在运行进程加载了哪些字节，也未核 inode/ACL/xattr。

现役组合复用 [RELEASE-CONVERGENCE-547 固定报告](https://github.com/mayf3/dsh-agent-core/blob/9e5e18efa918df79d84a7c9d739112091fce9e0d/RELEASE-CONVERGENCE-547.md#L3)：393基础 + 081六文件（admin叠Gap B）+ app #1374 + external Harness #1386。此次从 live app 逐字节复制，仅覆盖上述三文件（v3）；现役 app `pack-provenance.json` SHA256 `ca9a0e45149d9b59c4a93600d5a02696d8d416f40922f8e940d11b9c86e642fc` 保留，不冒充该旧 provenance 已描述本候选。新候选 pin 由本交付 manifest/delta 提供。外部 Harness 的**链接字面量**保留；其当前字节/加载状态未在本任务重新认证。

完整副本保留27条原 symlink，其中多条指向生产 @agent-core 或外部 Harness。故**不允许启动该完整副本或沿这些链接跑全 app**；本次只导入 scratch 内真实 event/state/provider-errors 三个模块，逐文件 realpath guard 验证不跨链接。该目录不是可直接安装的 sealed 全量包；原 deploy 链应接入本三文件 delta 及新的可信制品描述。

## 4. Owner RED→GREEN 与回归执行原文

主证据使用现役 Node `/usr/local/libexec/agent-core/node-runtime/bin/node` `v25.6.1`，二进制 SHA256 `c6c9bfa8eb5d0c6799e1fd7e246f5c6036d4863b5d3173625f37d952576ca93b`；[test-receipt.json](docs/evidence/656367cd-landing/test-receipt.json) 时间 `2026-11-09T00:02:03.761257+00:00`。开发 Node v26.7.0 的首轮同样通过，原文保留为 `dev-node-*.log` / `dev-node-test-receipt.json`，未覆盖。

实际主命令：

```sh
python3 docs/evidence/656367cd-landing/verify.py
# wrapper rc=0；内部 RED 预期 rc1，GREEN/regression 均 rc0
```

| 执行 | 真实结果 | 原文 |
|---|---|---|
| RED：安装前像、已 unknown 的 aborted/disposed | Owner规范断言失败1/1，**预期 rc1**；actual late_completed + exact_turn_end_success，expected terminated_without_outcome | [red.log](docs/evidence/656367cd-landing/red.log) |
| GREEN：真实候选模块、全合成执行对象 | 16/16，rc0；aborted/disposed/null 等 direct/late 均 termination-only；completed/error direct/late 保持 | [green.log](docs/evidence/656367cd-landing/green.log) |
| 回归：真实候选模块、全合成对象 | 13/13，rc0；闭包导出、精确匹配、idle顺序、后来turn、stream gap、no-terminal条件、settle-once、其他历史fence | [regression.log](docs/evidence/656367cd-landing/regression.log) |

RED 原文核心（完整 stack/TAP 见日志）：

```text
OWNER_RED_ACTUAL ... "lateOutcome":"late_completed","outcomeEvidence":"exact_turn_end_success" ...
Owner expected termination-only; installed code fabricates success
+ 'late_completed'
- 'terminated_without_outcome'
code: 'ERR_ASSERTION'
# pass 0
# fail 1
```

GREEN 真实观察：

| 输入 | 原本 direct | 原本 unknown/late | outcomeEvidence |
|---|---|---|---|
| `{kind:aborted,reason:{kind:disposed}}` | 先 markOutcomeUnknown，继而 settleLate；原waiter reject outcome_unknown + stable handle | terminated_without_outcome | undefined，无成败证据 |
| `{kind:completed}` | completed / resolve | late_completed | exact_turn_end_success |
| `{kind:error,error:...}` | failed / reject failed；evidence 在durable调用后snapshot | late_failed | exact_turn_end_failure |
| null/缺失/未知kind | markExecutionUnknown 路径；UNKNOWN先于termination-only settlement | terminated_without_outcome | undefined，无成败证据 |

所有上述 terminal+idle 观察的 terminationEvidence 为 `exact_terminal_then_idle`。部分文本保留为输出，未被当作成功证据。无 terminal 的13项回归子集另外核 `exact_started_then_idle` 的限定条件。直接与late的 full rows、waiterStatus 原文均在 green.log。

**证据限度：** fixture 使用内存 Map/合成 store、execution、waiter，不使用真实 store constructor、真实业务数据、子进程或网络。它证明候选函数归类与调用顺序；不证明真实持久化 CAS、历史业务store哈希、Scheduler结果、Runtime/业务验收。no-replay/历史UNKNOWN断言只约束本合成 fixture；未接真实投递/副作用边界，不能升级为真实业务重放计数证明。没有运行 main 新版 AgentProcess 全套，尤其没有将 spawn child-exit 测试当两文件候选 PASS。

### 4.1 v3 扩展：原作者测试套件下的 spawn child-exit 反例 RED→GREEN（真实 AgentProcess）

v2 的证据限度如实声明了 spawn 未覆盖；v3 用**原作者自己的测试文件**（自 git `656367cd` 逐字节复制的 `correlation.test.js` + `late-settlement.test.js`，含真实 AgentProcess + fake child 故障注入 harness `helpers/fake-child.js`）在 base 源码树上补齐。base 已含 656 修复（656 为 base 祖先），故 RED 由"把 spawn.js 换回安装版缺陷副本（`add4e95e…`）"产生；GREEN 为三文件候选组合（spawn=base=Git656 逐字节相同）。每轮跑完源码树均恢复 clean base（`git status` 仅新增证据目录）。执行原文与回执：[spawn-extension/](docs/evidence/656367cd-landing/spawn-extension/SPAWN-EXTENSION-RECEIPT.json)、[red log](docs/evidence/656367cd-landing/spawn-extension/red-2file-candidate.log)、[green log](docs/evidence/656367cd-landing/spawn-extension/green-3file-candidate.log)。

| 执行 | 组合 | Node | 真实结果 |
|---|---|---|---|
| RED | 2文件候选 + 安装版缺陷 spawn + Git656 测试 | 生产 runtime v25.6.1（`c6c9bfa8…`） | **rc=1，9 用例失败**：`EXIT_REASON {aborted/disposed}` 实际 `late_completed`、期望 `terminated_without_outcome`；同族 blocked/max-tokens/interrupted/future-reason/null/undefined/"completed" 及 NON_OUTCOME_CORRELATION 全部同样伪造成功 |
| GREEN | 3文件候选 + Git656 测试 | 生产 runtime v25.6.1 | **rc=0，55/55 全过** |
| GREEN（dev Node 复核） | 同上 | dev v26.7.0 | rc=0，55/55 全过 |
| 回归（全 process-lifecycle 目录，base 测试文件，GREEN 树） | 3文件候选 | 生产 runtime v25.6.1 | 223 用例：218 过 / 4 失败 |
| 基线对照（纯 base 树，同测试） | 无候选 | 生产 runtime v25.6.1 | 223 用例：218 过 / 4 失败 |
| 基线对照（dev Node） | 无候选 | dev v26.7.0 | 223 用例：218 过 / 4 失败 |

三个回归/基线运行的**失败集逐项相同**（`feishu-reply-delivery-result` / `stale-registration-recovery` / `v5-ingress-correlation` 三文件 + `R3: a settled or unknown turnExecutionId proves nothing` 一用例，仅毫秒时长差异）——4 个失败为 base 既有问题，与候选无关，本任务不新增调查（Owner：不新增调查项目）。即：候选相对 base 的行为差 = 0 失败差。

**核心反例指纹（Owner 指定坐标）：** 超时 → caller `outcome_unknown` → `turn/end {kind:aborted,reason:{kind:disposed}}` 终态 → **idle 前子进程退出** → 旧 spawn 在 C-017 块以二值判断伪造 `late_completed`+`exact_turn_end_success`；三文件候选下同一序列输出 `terminated_without_outcome`+`terminationEvidence=child_real_exit`，不伪造成败。

**v3 证据限度：** 源码树组合测试——安装 app 打包体含 27 条指向生产/外部 Harness 的 symlink，不可作为副本启动；本节以真实 AgentProcess 在 base 源码树上执行，文件覆盖与候选逐字节一致。它证明真实 spawn.js `onChildExit` 的结算行为，但仍不等于生产 runtime 进程加载验证；生产级复验仍属 runbook 安装后步骤。生产写入=0。

## 5. 受控安装 runbook（交付、不执行）

### 5.1 原链、授权、前置与排空

执行者为**原受权 deploy/ITOps 链**。目标只含 `/usr/local/libexec/agent-core/app` 上述三文件，命名服务 `system/ai.agent-core.runtime`；不会变更 Node、Harness、Grant、store、route、fence。此文不构成新的 Execution Mandate，不给开发 Agent 生产权限。

部署前必须由原链确认有效 mandate/profile 覆盖新三文件 digest、actor/host/runtime、窗口、attempt/abort、apply/restart/rollback操作类及收据要求；旧081授权不可自动继承。适用源为 [D-RELEASE-PACKAGE-547 §5–6](D-RELEASE-PACKAGE-547.md#5-在途排空清单本任务未执行) 与 [accepted DCP V1 CTR-009/011/012/013](docs/specs/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1.md#ctr-dcp-012--fresh-preimage-apply-and-restart)。若原链无已激活profile/覆盖授权，保持 NO，交回原授权方补齐精确缺项；不新建 sudo cp/kill 安装旁路。

历史坐标：[原发布brief L6](https://github.com/mayf3/dsh-agent-core/blob/9e5e18efa918df79d84a7c9d739112091fce9e0d/BRIEF-RELEASE-CONVERGENCE.md#L6) 转述上海00:12仍有真实broker工作；[固定报告 L44](https://github.com/mayf3/dsh-agent-core/blob/9e5e18efa918df79d84a7c9d739112091fce9e0d/RELEASE-CONVERGENCE-547.md#L44) 记PID22118于00:13:26启动。本任务没有重新读取 broker 原行或运行态排空，不把这些旧观察当本次现场。**当前活跃 agent/turn/occurrence/slot、old generation/tool终止和排空均 UNKNOWN。**

切换窗口依原链顺序逐项签收：

1. 在全局 production mutex 内绑定原 actor、有效窗口、旧native实例和epoch，建立原有admission barrier；mutex覆盖 PRECHECK→FINALIZE。未获锁不动文件。
2. 执行 D547 §5 L111–147 的**纯读** authsvc census（readRestartDrainCensus；不构造store）。保留 sig/hash 前后读回；文件不可读/schema不明/期间变化为 UNKNOWN，不当空集。核 `inflightTurns=[]`、`inflightOccurrences=[]`；历史/旧epoch UNKNOWN 按原门单列且继续fenced，不能放宽原门要求。
3. 用 D547 L155–166 的纯读 native adapter、Scheduler lease 读法绑定 exact Runtime，不固定历史PID；slotSnapshot/既有边界收据覆盖 STARTUP/READY/REAP，不能用health/空registry替代。
4. 原停止路径若依赖 restart-boundary，须有同PID/epoch、quiesce_begin/end、stopResult=stopped、slots/turns/occurrences空、durableEpoch一致、无new lost与旧exact native实例退出证据。能力是否已安装/加载需现场证明。
5. 对已经发出的工具，核终止/隔离或每个实际外部写边界拒绝旧identity的证据；parent barrier/旧PID消失本身不够。证明不可得则不切换。
6. 保留UNKNOWN/fence、fault/registry关系、历史prompt与结果；不清fence、不恢复旧业务snapshot、不重放。任一排空门拒绝、窗口失效或现场身份不明，停止切换并出具原链收据。

可直接复用的只读命令完整原文就在 D547 §5，受权执行前重新 pin 其 reader/module hash。`H547_SOURCE` 是已审纯reader来源，不是候选app；不可沿本候选的 @agent-core/Harness symlink加载运行时。本任务未执行这些 sudo authsvc命令，也未读取 credential。

### 5.2 新鲜前像、替换事务及验证命令

1. 排空/旧代退出已证明后，在同mutex内记录**切换窗口**完整code/config/metadata/service前像与 ABSENT、原目标uid/gid/mode/ACL/xattr、目标type及父目录身份。前像必须仍匹配本三文件 beforeSHA；漂移先停止重新核对，不覆盖。
2. 原链从受信staging/CAS接收已独立审查的三文件delta，重新校验路径、type、source blob、SHA256；不得将scratch整包或候选脚本作为root执行。生产无npm/build；不改旧pack-provenance去伪造整树来源。
3. 由原deploy控制器按既有profile在**目标同文件系统**创建temp，设定已验证metadata，写入/flush；逐slot durable journal记录intent/preimage/phase并fsync，再rename、目录fsync并读回每个SHA。三次rename不具整组原子性；事务一致性依靠已证明停止的旧代、admission barrier、journal与单writer；只在三文件都验证后开放启动。部分失败/进程崩溃按journal只读核对，不能盲重跑copy/restart。
4. 成功路径由原链只重启共享parent一次，绑定新native instance/runtimeEpoch与loaded代际，核已安装digest及health。不能仅看PID/日志活动/配置source SHA就判加载成功；新业务canary只在原授权明确覆盖其identity/input/side-effect时执行，不重发旧UNKNOWN。

下列为原执行链可用的**只读字节校验**，本任务仅交付：

```sh
shasum -a 256 /usr/local/libexec/agent-core/app/packages/agent-router/src/process/event-correlation.js /usr/local/libexec/agent-core/app/packages/agent-router/src/process/state-machine.js /usr/local/libexec/agent-core/app/packages/agent-router/src/process/spawn.js
/usr/local/libexec/agent-core/node-runtime/bin/node --version
shasum -a 256 /usr/local/libexec/agent-core/node-runtime/bin/node
/usr/local/libexec/agent-core/node-runtime/bin/node --check /usr/local/libexec/agent-core/app/packages/agent-router/src/process/event-correlation.js
/usr/local/libexec/agent-core/node-runtime/bin/node --check /usr/local/libexec/agent-core/app/packages/agent-router/src/process/state-machine.js
/usr/local/libexec/agent-core/node-runtime/bin/node --check /usr/local/libexec/agent-core/app/packages/agent-router/src/process/spawn.js
```

切换前三SHA应等§3 before，成功后等after，受权回退后等该窗口的前像；Node本任务不替换，其观察pin见§4。`node --check` 仅语法验证，不能冒充loaded/business PASS。原链另需签收完整未改范围的manifest/metadata、单writer、UNKNOWN无重放、new instance加载绑定及实际获授权验证结果，保存journal/receipt而非仅口头ACK。

### 5.3 回滚与异常

RELEASE-CONVERGENCE-547 已认证的结论为**无可用完整历史回滚组合**，11个旧reader拒读；本修复是前向修复。这里的回滚仅指**本三文件差量集回退到切换窗口捕获的现役前像**，保持393+081+GapB+#1374+#1386其余组成；不回纯393，不使用陈旧业务snapshot，不恢复旧fence/业务账本。

原控制器须先比较当前文件等于本交易已知face、前像路径/metadata/身份与journal一致，再在同mutex/barrier下逐slot以同文件系统temp+rename恢复这三项并读回前像SHA；失败路径单独计数restart与attempt。candidate不变更store schema，但三文件前像是否满足该窗口新增记录的旧reader兼容条件仍由原链现场/隔离核对，不能由本合成测试代签。若不兼容/前像不可验证/出现无关drift，标 `UNSAFE_ROLLBACK` 并 quarantine，保持业务UNKNOWN和no-replay，交原链受权forward-fix。文件恢复不等于副作用撤回或服务恢复。

### 5.4 收据与中止条件

收据至少绑定有效授权/actor/profile、host/install-root、三文件before/after、Node/Harness实际绑定、全局mutex持有期、排空/工具隔离、新旧native instance/epoch、每slot journal、实际restart次数、验证/回退结果及所有UNKNOWN。授权过期、hash/type/metadata漂移、reader拒读、门失败、外部副作用不明、部分写入或恢复结果不明时均停止依赖步骤并由原链隔离；不重置预算、不换requestID重试。

## 6. 独立 QA、范围外与完成边界

独立只读 QA `/root/qa` 已核 v2 最小集、1703项manifest、live/candidate/Git656字节、Owner反例与日志SHA；冻结 blocker union为空。**v3 spawn 扩展的独立 QA 为本节后续步骤**：v3 证据（原作者测试 RED 9 失败→GREEN 55/55、回归/基线失败集相同、manifest 三项差异断言、delta/preimage/候选字节 SHA）已固化为 [SPAWN-EXTENSION-RECEIPT.json](docs/evidence/656367cd-landing/spawn-extension/SPAWN-EXTENSION-RECEIPT.json)，独立复核按原链在本 PR 上补记，未复核前 v3 部分不声称 DONE。完整 runbook/最终Head的QA结论及交付坐标在本PR记录；最终提交前若发现真实失败仍按 brief 停写STOPPED，不因探索空结果停写。

优先二“调用方超时生命周期+迟到结果交付”、优先三“长任务接续”仅依 Owner 本轮/brief 转述登记为后续范围，未实施。Owner 2026-11-09“三优先线”审计**原文坐标 UNKNOWN**：v1检索空结果已复用，本轮只读定向复核仍未定位，已异步请求Owner坐标。当前引用为本brief/用户指令，**不能伪装成已找到原审计**；这是来源待补/探索空结果，不是本轮真实构建或测试失败，不阻断可独立完成的准备/PR；生产授权与排空仍NO/UNKNOWN。

此次生产写入=0；安装/重启/signal/清fence/改store/重放/新业务请求/生产Agent派发=0；真实store constructor=0。生产app只读；未读取credential。`INSTALLED=NOT_ATTEMPTED`、`LOADED=UNKNOWN`、`BUSINESS_VERIFIED=NOT_ATTEMPTED`。合成机制PASS与Git交付不能提升这些状态。
