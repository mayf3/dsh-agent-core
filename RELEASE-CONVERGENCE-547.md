# RELEASE-CONVERGENCE-547 — 生产加载组合与回滚核验（只读）

**核验材料已收敛；生产发布及回滚不放行。** 简报所指 PID `16139` 已不在现场；现役为 PID `22118`。当前磁盘组合应描述为 **`393a0afc` 基础 + `08102a55` 六文件差量（其中 admin 再由 Gap B 覆盖）+ app #1374 三文件 + external Harness #1386 两文件**。不能把整个执行闭包认证为纯 `08102a55`。11 个已定位历史备份均带有拒读当前四条 legacy 记录的旧 reader；本次没有认证出可用的完整回滚组合。

## 1. 坐标、授权、权威与核验范围

- Repository：`mayf3/dsh-agent-core`；隔离 worktree：`/Users/yanfenma/workspace/project/worktrees/ops-release-conv`；branch：`ops/release-convergence`。
- 执行 parent / integration base / 本轮初次远端 main 读回均为 `6ad69d1fa6fa8c7dcfb3b5b61207c7d21a80ecef`。当前报告、收据及后续独立复核的精确交付 Head 由本 PR 的 commit 和交付读回绑定。
- 本次用户指令与完整读取的 [BRIEF-RELEASE-CONVERGENCE.md](BRIEF-RELEASE-CONVERGENCE.md) 授权生产只读、authsvc 属主只读、隔离分析及报告 → commit → push → PR(base main)，不合并。没有生产发布、restart、signal、排空、清 fence、修 store、改权限或发送业务请求权限。
- 已读 `.agents/README.md`、local README、Architecture、Current Decision 索引及 D-008/D-009 相关语义、spec-governance router/PREFLIGHT；直接适用的是 accepted [PLH V4 C-018/C-019/§12.2](docs/specs/AGENT_PROCESS_LIFECYCLE_HARDENING_V4.md)、[Admin Abandonment V1 D6/C1–C5](docs/specs/AGENT_PROCESS_ADMIN_TURN_ABANDONMENT_V1.md)、[HR trusted recovery V2 RQ-003/RQ-006](docs/specs/HR_RESTART_LOST_FENCE_TRUSTED_RECOVERY_SPEC_V2.md)、[Scheduler V3 C-021/C-028/C-033/C-038/C-039/§9](docs/specs/SCHEDULER_TIMEOUT_OUTCOME_V3.md) 及 [DCP V1 CTR-DCP-004/012/013/015](docs/specs/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1.md)。这些 authority 的实施合同及历史操作记录不赋予本次生产 apply 权限；DCP 的 `production_apply_authority: none` 保留。

```text
schema_version = 2
SPEC_GOVERNANCE_MODE = PREFLIGHT
AUTHORITY_ACTION = REUSE
PRIMARY_AUTHORITY = AGENT_PROCESS_LIFECYCLE_HARDENING_V4 @ base 6ad69d1f
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = DURABLE
ROUTE_STAGE = OPERATION                     # 只读调查与文档交付
AUTHORITY_ACCEPTED_IN_BASE = YES
GOAL_OR_TARGET = 五项核验可审查；报告/证据/commit/push/PR，不合并
CURRENT_GAP = 简报PID已过时；组合来源、时间绑定、旧reader与发布者需对账
MUTATION_AUTHORIZATION = VALID               # 仅本隔离文档/证据/Git交付
ISOLATED_WRITE_SURFACE = YES
IMPLEMENTATION_ALLOWED = NO
OPERATION_ALLOWED = NO                      # 生产修改
SPEC_GAP_DEPENDENCY = NONE                   # 不以调查结果改写合同
DONE_WHEN = 本报告与精确证据交付到main为base的PR，保持未合并
EXPANSION_TRIGGER = 需要生产写/提权扩权、不可解释的一致性破坏、真实执行失败
MODEL_DISPOSITION = RETAIN                   # 保留历史材料；只判定回滚资格
```

简报 PID 缺席、探索缺对象/404、可选材料缺席是观察或缺项；不是生产失败，不触发伪造的 STOPPED。所有实际读取均保持只读；没有不可解释的 app 读前后变化。文中 `UNKNOWN` 是核验结论，不是隐含批准。

## 2. 实际加载来源：历史 PID 与现役实例分列

主要现场窗口为 **2026-11-08 17:30:42–17:32:12 UTC**（上海时间 **11 月 9 日 01:30:42–01:32:12**）。原始 argv/rc/时钟、完整 app 文件/链接/模式/时间及 sanitized provenance 见 [process-and-install.json](evidence/release-convergence-547/process-and-install.json)、[app manifest before](evidence/release-convergence-547/app-manifest-before.json)、[after](evidence/release-convergence-547/app-manifest-after.json)、[supplement](evidence/release-convergence-547/supplement.json) 和 [时间比较](evidence/release-convergence-547/time-binding.json)。

| 主张 | 观察 | 认证结论 |
|---|---|---|
| PID 16139 当前加载081字节 | fresh `ps -p 16139` rc=1、stdout/stderr为空；launchd 当前 pid=22118 | **✗ 当前认证不成立：目标PID已过时**；缺席不证明何时/如何退出，也不证明旧工具终止 |
| PID 16139 历史来源/时间 | ITOps native session seq49193，11-08 15:56:07.156Z，记录 authsvc/PPID1、实际 node + app runtime argv、`etime=04:03:54`；无原始 `lstart` | 历史 argv 可追溯；只可推估启动约11:52:13Z，不能当精确lstart。#1386/Gap B安装早于该推估；强加载认证仍 **UNKNOWN** |
| PID 16139 与晚间 #1374 | #1374 三文件15:54:58–15:55:00Z写入，15:56仍是16139；原操作TERM rc0但20s仍活、exit42，收据BLOCKED；后续OBS至16:11仍活 | 同PID下磁盘曾变化；晚间文件哈希不能回填成16139已加载字节。TERM请求不等于退出 |
| 现役 PID 22118 来源 | `ps` 前后均 authsvc/PPID1，**lstart=2026-11-08T16:13:26Z**（上海11-09 00:13:26）；launchd `system/ai.agent-core.runtime` running、runs=5、pid=22118、cwd=app | **✓ argv/launchd/进程启动时间绑定**；该次启动的具体操作人/因果仍UNKNOWN |
| 现役启动与安装时间 | app两遍1703项完全相等：1387普通文件、27链接；全部普通文件mtime和ctime早于16:13:26Z。最新compose.js mtime=15:55:00.077912Z、ctime=15:55:00.123956Z。#1386两JS及抽样Node/包入口均早于启动 | **✓ 本次磁盘与启动的时间相容性核验**；没有采样窗口内app变化。时间相容性是加载来源支持证据，不是内存字节测量或不可变安装证明 |
| 整体纯081制品/内存字节 | provenance仍标081；其旧aggregate/source_tree已注明base-era；外部Harness不在app六文件中；launchd的`AGENT_CORE_DEPLOYED_SHA`仍是393 | **✗ 不能认证纯081整包；内存逐字节认证UNKNOWN**。旧环境label、JSON声明及健康不能替代字节证据 |

现役实际 argv：

```text
/usr/local/libexec/agent-core/node-runtime/bin/node /usr/local/libexec/agent-core/app/scripts/production-runtime.mjs --root /Users/authsvc/.agent-core --catchup 0
```

manifest 坐标指纹 `2004a9271104b4325b321ff98d3d71d23c3a57f931f0257e0ac71e76d58c2e43` 使用收据声明的自定义JSON编码，包含stat，**不是** provenance旧pack digest。app链接不遍历；外部Harness完整依赖闭包与Node动态库闭包本轮未全量认证。没有读取进程内存或注入运行中代码，没有把只读来源核验升级成业务验收。

## 3. overlay 文件与语义差量

完整固定blob、candidate/base/rollback实测SHA、mtime/ctime、diff及既有QA安全摘录见 [overlay-findings.json](evidence/release-convergence-547/overlay-findings.json)。根路径为 `/usr/local/libexec/agent-core/app/`；Harness另列。对捕获manifest中全部 **355** 份非node_modules、非provenance普通文件按相同Git路径与393比较：346相等、9差异、0缺Git路径；9差异正好为六文件差量（admin已叠Gap B）和#1374三文件，见 [base-source-comparison.json](evidence/release-convergence-547/base-source-comparison.json)。这是选定源码/配置面的清点，不是完整依赖、可信构建或历史pack认证。

| 组件 / 路径 | live SHA-256 | 来源与实际状态 |
|---|---|---|
| `packages/agent-router/src/reconciliation/admin-abandonment.js` | `95172846f40ec0589f3a10ffcc350e3eda5d05f0e7f396d0c3d3570c14e8e19e` | Gap B `8871f3852acc88408416c0148d1157b48ab054db`；覆盖081原文件，原SHA为62237fb5… |
| 同目录 `durable-file.js` | `db854ee6061c7f8a56d48f686905d667353c9930bfcd64c95464752075542a1c` | 081六文件声明匹配；legacy窄容忍 |
| 同目录 `query.js` | `3725875b5df2d02099b4bb766a92679aa770d946012a10f1a1c325f0a111ae63` | 081声明匹配；recovering查询投影 |
| 同目录 `state-machine.js` | `516abc6eb5176d606b2673ad8b5d50564b7f9fc344261b370809a6d84e16fb3f` | 081声明匹配；清fence前检查可信settlement/termination |
| `packages/scheduler/src/occurrence-model.js` | `accb4e4bb20ed867f9c06c7704dbd70cc6652c27b76bc28a4092611db57f5847` | 081声明匹配；恢复/证据guard |
| `packages/scheduler/src/store.js` | `3e829b1e1bba8b01093811135717773444ff279ad5ffeabc9af7e2415d8cffa3` | 081声明匹配；相关持久状态guard |
| Harness `packages/core/agent/lib/types/inbox.js` | `2d2d01808c45075f4f1a6dfec9fdae75a37699fac86a52d90c7ff692982b2d37` | #1386编译JS，精确等于Shared candidate |
| Harness `packages/core/agent/lib/index.js` | `6faef8d4b5378b68ce54ab139850fd45f41d6d3364ce43010806c5ea2d1fcb80` | #1386编译JS，精确等于Shared candidate |
| `packages/agent-router/src/index.js` | `b9a7f382508dca181b21afc571006a6f10239ded9e8ae8fdcded0f514ad6f889` | 额外#1374 `ac0480a95e8dcfaa345b4cd9fc42bebcafa8c1a1`，live=Git blob=Shared candidate |
| `packages/agent-router/src/process/agent-process.js` | `47c4dfcfc13203283282405df57ecd0b27adf765b2ba218405f9cddb8b60a195` | 同上 |
| `packages/production-runtime/src/compose.js` | `c31db4e1342344c32810076ab0b6d8a58cb1bf94d8a505fc92623771c5746838` | 同上 |

**081已含与overlay形式的区别：** 081是393上的六文件D恢复修正；Gap B不在该六文件原版内，是parent081上的单文件再覆盖；#1374又以Gap B为parent。#1386来自另一个仓库 `mayf3/deepseek-harness` 的源码commit `5603c68c5055afe598576057a42a08edb7c9f2e3`（不是本仓库PR号），通过两份编译JS安装在外部Harness。app的`node_modules/@deepseek-ai/dsh-agent`最终解析至 `/usr/local/libexec/agent-core/harness/packages/core/agent`，默认exports入口为`lib/index.js`。完整TS→已安装JS可信构建发行回执未认证。

- **#1386**：冷重放首次成功splice前，仅跳过 `inserted=[]` 且精确 `invalid inbox splice` 的失效纯删除事件；携带输入或成功锚定后的坏事件仍拒绝。两文件mtime为11-08 **11:35:22.738619Z / 11:35:22.773610Z**。既有30/30 QA是原坐标记录，本轮未重跑，不等于所有现役客户端已加载。
- **Gap B**：legacy-cleared UNKNOWN仍被识别为待隔离记录；只有同时存在abandonment marker和`owner_risk_acceptance_unproven_termination`审计，才跳过其新请求准入阻断。三条pre-D6 marker不借此豁免；继续扫描后续记录。mtime为 **11:51:58.936026Z**。原QA22/22的PASS仅覆盖HR g70释放路径，另外三条pre-D6记录明确不在释放范围。
- **#1374**：增加process fatal-evidence sink及router/production-runtime接线。三文件实际mtime为 **15:54:58.066247Z、15:54:59.737529Z、15:55:00.077912Z**。虽原发布收据为BLOCKED，磁盘写入已发生；本报告只清点，不重做安装或替其补验收。

provenance文件SHA为`ca9a0e45149d9b59c4a93600d5a02696d8d416f40922f8e940d11b9c86e642fc`，mtime07:23:33.415591Z：六声明5匹配、admin过期，且不覆盖#1386/#1374。本次没有改这个生产JSON来消除差异。

## 4. 当前持久状态及 D-STORE 窄容忍复用边界

[本轮保护文件摘要](evidence/release-convergence-547/protected-summary.json) 在authsvc进程中解析JSON，仅输出白名单元数据，不输出prompt/answer/credential。每个文件读取期间stat稳定；**不是跨文件atomic snapshot**。本轮没有调用真实store构造器：startup recovery/epoch bookkeeping可能持久化，不能指向生产路径。

| 当前对象（17:30:42Z观察） | 结果 |
|---|---|
| `control/turn-recovery-v3.json` | version=3；8,560,032B；SHA `82ed245c5cce9ed60479d9576ae20a1feabd7031e0002b271f1e01f8000be317`；5339 records（5333 settled、6 blocked） |
| 当前epoch / epoch集合 | `91832879-e22d-4700-89ad-55291839ded7`；256 epochs；当前epoch和五目标epoch在集合内；补读确认所有record引用epoch均在集合内 |
| abandonment registry | version=3，18 declarations（补读）；SHA `f18bca66e5ddf19897e6e1299ae42614daf30e218347e298021ccae67b5926e4` |
| faults sidecar | 首读617B，SHA `ae23d8877938f20ca60d66f751ad5730d74856e0f1508d2e7ac3d69b8114e6bf`；补读17:32:12Z已变为SHA `ed2090b5bb460708992d2caa2bec4ee8ef6300f8c9eab69d5f3df5ca8ccb5c03`，顶层4个generation key。各次单读稳定，跨观察确有变化，不能称整体状态冻结 |
| `scheduler/jobs.json` | version=3；SHA `3af8b23bb518ca3a071d4de5777ecfd48ae3d32ca6064eb052957b3cf9c807d6`；59 jobs、5622 occurrences、10 fences，recordSchemaVersion同时有2/3 |

五个原目标仍保留 `initialOutcome=outcome_unknown, queryState=pending, state=blocked, failureReason=runtime_restart_ownership_unavailable`；`exitObservedAt/terminationEvidence/settlementResult`均null。下表是**字段事实 + 已安装源码的静态投影**，不是调用现役admission方法的结果：

| Agent / 原handle尾部 | fence / marker / D6审计 | 当前Gap B对这条记录的含义 |
|---|---|---|
| stock `a32:g9:s16` | active / 无 / 无 | 普通阻断；不使用legacy例外 |
| needs-radar `a11:g23:s76` | cleared / 有 / 无 | legacy隔离继续 |
| lobster `a54:g23:s43` | cleared / 有 / 无 | legacy隔离继续 |
| dev-engineer `a40:g84:s397` | cleared / 有 / 无 | legacy隔离继续；caller correlation仍缺 |
| HR `a2:g70:s3581` | cleared / 有 / 有 | 此记录满足Gap B的D6准入豁免；UNKNOWN及无终止证据事实不变 |

完整handle、epoch、generation见上述摘要及 [supplement](evidence/release-convergence-547/supplement.json)。五条中的静态阻断贡献为4条；不能把旧QA的5/5继续阻断平移到当前组合，也不能由HR这一条豁免推断整Agent无其他阻断或业务已恢复。总blocked=6，不把五目标当成全体。

引用 [D-STORE-QA-547 v5](D-STORE-QA-547.md) 的精确窄结论：固定reader `95a8e1cb512fc99dc018209d837250dd51b4d08f`、快照SHA`ce231b88d6a5cca631ad074523aa493e328846cdc66587075733d35d22a0a243`，真实scratch constructor及141/141断言通过；4 legacy+1 ordinary可识别且当时5/5持续阻断；4/4有correlation者原入口no-replay、dev-engineer缺correlation；四legacy各7邻值共28负例拒绝。原始 [stdout](docs/evidence/h547-store-diag/qa-v5.stdout.json) SHA `c5380e46323ecd4eff82fd60c8672a4d9a8debc551c0e63778a5bdec0f9879f5`。这是复用旧证据，不是本轮测试计数。

epoch上限256不能通过手工删epoch、复用旧runtimeEpoch或strip字段规避。v5真实scratch native行为保留所有被引用epoch，同时换出一个无记录历史epoch并仍维持256；本轮未执行该行为。并且**现役Router `reconciliation/store.js` SHA `1c38068b26142d454c99cf1d670bfd3693dda2e32a084f68942109385defd0e3` 会消费 faults sidecar；v5固定95的该文件SHA `9c5fa22a8fb62f1064a4362918f217fd9fa4ad83acd35d1d3a137e60c27ac410` 不消费它**。因此v5 PASS不能认证当前完整store/sidecars/整机启动。

补读原摘要误按嵌套faults格式计算出0；已保留 [原件](evidence/release-convergence-547/supplement-original.json)，并在supplement中以已保留顶层key派生纠正为4，没有为纠正统计重读/改写生产。不得引用原0作为现场计数。

## 5. 回滚组合矩阵与不可用清单

PLH V4 §12.2要求：所有durable unresolved已settled，或回滚runtime能读且执行V3 fence；忽略unresolved fence的downgrade禁止。Scheduler V3 C-038/§9进一步要求，version3/任何V3 evidence一经提交不得回V2，只能V3-aware forward fix。当前仍有6条blocked且jobs为v3，不能以恢复旧snapshot/删sidecar/改fence获取旧reader的LOAD_OK。

精确reader与备份逐成员表见 [rollback-findings.json](evidence/release-convergence-547/rollback-findings.json)。以下“拒载”是**当前字段事实 + 固定旧源码不可避免拒绝分支**，不是本轮新执行旧constructor；“NOT_READY”表示未认证，不伪装成已证明兼容或已证明全局不可能。

| 回滚组合 | 当前turn store / epoch | sidecar、功能与当前jobs | 回滚资格 |
|---|---|---|---|
| 纯393 / 恢复Shared六文件前像 | 理解V3及256cap，但四legacy被旧交叉字段不变量拒读 | 不必等整机启动即可否定加载可用性；完整历史393闭包也未认证 | **不可用（拒载）** |
| ce1d13c1备份 ×6 | 八份选定reader文件均等exact393，四legacy同样拒读 | 全pack完整性未全核 | **6个均不可用（拒载）** |
| f917aeba备份 ×2 | 同上 | 同上 | **2个均不可用（拒载）** |
| 23fb91a6备份 ×3 | 同上 | 同上 | **3个均不可用（拒载）** |
| 393重构基础 + 四95 Router D文件（#673候选） | 窄tuple源码可解码；完整当前constructor未跑 | 会回退两份081 Scheduler修正并移除Gap B；精确当前jobs/sidecars/功能矩阵缺 | **NOT_READY，不可列可用回滚** |
| 081 + #1386，撤Gap B（#1374另行固定） | 窄容忍保留；非纯393拒载问题 | HR原D6记录重新准入隔离；解析成功不等于原可用性恢复；当前sidecars/窗口新记录完整加载未证 | **NOT_READY，有明确功能回退** |
| 081 + Gap B，撤#1386（#1374另行固定） | app reader不因这两Harness文件改变 | 恢复已知冷重放坏纯删除拒绝路径；真实Session兼容/恢复未核，前像在位不是可用性回执 | **NOT_READY** |
| 当前组合393+081+Gap B+app#1374+Harness#1386 | 当前磁盘/现役进程时间相容；窄容忍源码保留 | 服务运行观察不等于能重装的可信immutable包；完整当前副本加载/回滚启动未执行 | **现役观察；不是回滚认证** |
| 完整固定95 source reader | 旧v5快照真实PASS；当前完整加载UNKNOWN | faults消费差异、app/Node/Harness准入及原业务语义不能从source PASS推出 | **NOT_READY** |
| 任意忽略V3/fence的旧版或Scheduler V2 | 与已持久V3/fence合同不兼容 | V3 evidence后禁止降级；未定位具体额外实物，不冒充全局清单 | **禁止类** |

旧 `durable-file.js` SHA `44120e2bc94c7b6941029ecf08eadde49dec4356bb7e9fb71d64849699fd5d26` 的相关不变量在211/213/217行拒绝 `pending+cleared`、`cleared+非settled`、`blocked+非active`。当前四legacy全部命中；stock普通active blocker不是该例外对象。历史 [D发布准备报告](D-RELEASE-PACKAGE-547.md) 与 `/Users/Shared/r129d-rollback-20261108/DEPLOY-RECEIPT.md` §7还记录exact393对原形store的 `LOAD_FAIL: durable recovery record state invariants are invalid`。同回执的LOAD_OK来自**改过四条fence的另一副本**，不得作为原形回滚证据，也不属于本次允许方案。

已定位、逐一不具备当前加载可用性的11个目录（前缀 `/usr/local/libexec/agent-core.bak-`）：

| 后缀 | provenance source family | 当前四legacy |
|---|---|---|
| `20261105-062306`、`20261105-063009`、`20261105-063639` | `ce1d13c1e8585759c6a5f194fb5553d990574b5b` | 均拒读 |
| `20261105-064520`、`20261105-065323`、`20261105-065951` | 同上 | 均拒读 |
| `20261105-073646`、`20261105-075119` | `f917aeba0a676992b64bec3b0a902627524d7f09` | 均拒读 |
| `20261106-075814`、`20261106-080439`、`20261106-081212` | `23fb91a690b0a7182ae3ae4bc388c4e3679d4cc9` | 均拒读 |

不可用清单还包括纯393六文件恢复、改写四fence的durable-restore方案、覆盖当前业务状态的陈旧snapshot、忽略V3 unresolved fences的旧reader。上述是命名路径和默认backup族的有界清点，**不是全主机备份不存在证明**。Shared #1386双文件、Gap B单文件及#1374三文件前像分别在位，完整SHA见overlay-findings；不能把这些零散前像拼称为已经认证的历史完整pack。

## 6. 真实发布者及授权记录

[publisher-findings.json](evidence/release-convergence-547/publisher-findings.json) 持久保存命名来源全文/捕获前缀SHA、native event行/seq/byte offset/原行SHA及安全摘要，不提交生产会话正文。原始ITOps记录属于历史证据，本任务没有重放其中命令。

| 组件 | 可证操作链 / install时间（UTC） | 授权依据的实际记录 | 仍为UNKNOWN |
|---|---|---|---|
| 081六文件 | `agt_itops-agent` native session + local DEPLOY-RECEIPT + November ledger第2–3行；06:54:57–58（上海14:54:57–58） | Dispatch `9e9e7185-7810-4184-ab15-fb235ce564ef`；GO `0a3dd333-ee2b-42c8-9d04-7452012f4de8`；closeout `9a9950cb-f5f3-49ba-9c90-6a7400a253cc`；记录声称Owner Watch3授权 | 人类操作者；原Owner批准真实性/可信发行者身份 |
| #1386 | 同一ITOps会话tool/call seq46328→result46329，11:35:22.644–11:35:23.125；返回candidate=live两SHA | 收到Dispatch `9b3192a4-641a-46e6-9ccd-25dfb2c28e21`、GO `50821506-a050-471b-81a5-3885e08d55d4`，source.kind=user，声称先前授权 | 真实人类、原批准真实性；所查四行ledger/命名目录未见独立完整deploy receipt |
| Gap B | ITOps seq47534→47535，11:51:58.755–11:51:59.226；candidate=live admin SHA | 收到Dispatch `32039f01-0e68-46f8-835d-2146fd3cf213`，source.kind=user | 真实人类/原批准真实性/独立完整deploy receipt；TERM9036原调用缺成功结果，不能冒充重启完成 |
| 额外#1374 | ITOps seq48732→48733，15:54:56.763–15:55:00.351；三SHA匹配；ledger第4行BLOCKED | Dispatch `4ba18fe7-6110-4e81-81bb-4241b53d6bb9`，source.kind=user | 真实人类/原批准真实性；后续PID22118启动的因果和执行人 |

native工具调用+结果能归因到所记录生产Agent会话；fileowner=authsvc、git author、运行UID、`source.kind=user`均不能推出实名人类，也不能独立验证原Owner授权。`/Users/Shared/r129d-rollback-20261108/DEPLOY-RECEIPT.md` SHA为`e24948c9c4bb1b4de24b496d92c057bace0f7bb2ef3c8d7c92b2bfd1cfdfb2c2`；本地ledger捕获SHA为`5cc875397a630a84f89873dd7ef273e053461e34d29a12cc4e00d429149b44b3`。未把这些非签名本地材料当成DCP受信发行签收。

## 7. 发布收敛核验表、缺项与交付边界

| 五项 / 收敛条件 | 核验状态 | 实际结论 / 缺项 |
|---|---|---|
| ① PID16139实际加载字节 | **✗ / UNKNOWN** | PID已过时；历史argv/etime存在，无原始lstart，且运行期间#1374改盘。不能认证它加载当前全包 |
| ① 现役加载来源补充 | **✓ 有限时间绑定** | PID22118 lstart与app/选定external mtime+ctime相容；内存字节/完整可信制品仍UNKNOWN |
| ② #1386 + Gap B overlay | **✓ 清点完成** | 命名文件精确匹配candidate/source；六声明5匹配、admin过期；额外#1374三文件已列入；未改生产provenance |
| ③ 回滚组合 | **✗ 无认证可用组合** | 11备份+纯393确定旧reader拒载；其余组合NOT_READY；旧QA/source兼容不等于完整当前状态/重装/启动可用 |
| ④ 真实发布者 | **部分可归因，UNKNOWN保留** | 实际生产Agent工具链已定位；人类/原Owner批准真实性/部分正式回执/22118启动因果仍缺 |
| ⑤ 发布收敛材料 | **✓ 本报告及证据** | 交付为docs/evidence PR，不合并；不是生产收敛PASS或新发布批准 |

下一受权发布链仍须补：可重装且可信发行绑定的完整app/Node/Harness组合及digest；精确选定组合对最新store/registry/faults/jobs和切换窗口新形状的合法隔离加载、fence/no-replay及功能矩阵；可用回滚完整闭包与readback；实际Publisher/Owner授权链及当前runtime启动回执。不得为补本报告重复重启、发布、清fence、重放旧UNKNOWN或覆盖store。这些缺项属于后续受权操作，当前可运行服务保持运行。

本轮生产写入=0、sudo生产写=0、restart/deploy/signal=0、权限更改=0、业务请求/重放=0、真实store constructor执行=0；authsvc只读由Python标准库读取命名JSON并脱敏，app/Harness/Git对象静态读。活跃runtime自身对faults的变化不归因于本操作者。没有执行安装器、JobStore、cron控制命令、recovery脚本或生产app模块。

校验包括：vendored governance完整性与accepted lock、JSON/脚本语法、报告链接、manifest前后相等及差量/时间/哈希交叉核对、`git diff --check`和独立报告复核。检查/复核精确结果见本PR的 [validation](evidence/release-convergence-547/validation.json)、[independent-review](evidence/release-convergence-547/independent-review.md) 及后续最终delta读回；不把文档校验叫产品测试PASS。
