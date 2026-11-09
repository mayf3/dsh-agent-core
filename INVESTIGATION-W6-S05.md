# W6-S05 — pause 继承与 source-stamp 只读调查

2026-11-06；关联 [#605](https://github.com/mayf3/dsh-agent-core/issues/605)、[V2申请](EXECUTION-MANDATE-W6-V2.md)、[S04 R1 §5](RECEIPT-W6-S04.md#5-w6-s05-只读事实记录)。结果：**INVESTIGATION_COMPLETE / EXECUTION_STOPPED_UNKNOWN**。没有实现修复、生产读写、stage_00、authority JSON或动态consumer测试。

本轮授权源为用户合同（本地原文 `BRIEF-S05-MANDATE-FINAL.md`）。写面 `/private/tmp/dsh-fleet-window-tools`、branch `chore/fleet-window-tools`、文档parent `703fcac8b1feb5d80ee91ab71a78a4686f149240`。`PREFLIGHT / REUSE / BRIEF / ROUTINE`，只准备操作文档；不新建或改变长期Contract。future operation为CONTROLLED，当前 `IMPLEMENTATION_ALLOWED=NO / OPERATION_ALLOWED=NO`。S04 R2已通过的门直接引用，不重跑。

## 1. 固定坐标与准确的问题拆分

A=`75ece578301b014a23b987568d1eb8af96795300`（main已合并冻结app）；H=`13ecda5c759263c7ce7ab93b678f862f65513f34`。生产fork对象通过 `/Users/yanfenma/workspace/project/production-dsh-agent-core` 的只读 `git show` 获取；不checkout该仓、不把其HEAD等同loaded生产。

“26813473 writer 对 main reader”实际涉及两个责任，不能误归同一种JSON兼容问题：

| 责任 | writer / reader | 精确差异 |
|---|---|---|
| admission pause | fork `26813473b825a6bd9f9bd05e878fd05ae29a9467`，`packages/workflow-execution/src/admission-control.js:14–37` | 写 `{paused:boolean,reason:string或null,updatedAtMs:number}`；构造只读一次；A完全没有此file/control reader，不存在可列出的main期望JSON格式 |
| harness source provenance | fork JSON修复 `4fc07f95e2ca14610b8e0a9633af60b148741aac` 未进入A；A仍legacy writer、A provisioning已JSON reader | A输出无分隔 `<40hex commit><十进制dirtyCount>`；reader需要单JSON对象、exact keys `{commit,dirtyCount}`，两者不可相读 |

旧pause control在constructor `this.state=this.#load()`后只读缓存；缺文件、坏JSON、IO错误均open。pause/resume经临时文件+rename原子发布；直接写盘并不刷新已运行实例缓存。普通engine checkpoints在268 `engine.js:119–120,372–375`；显式 `recoverAttempt` 在480–489无该control；已过checkpoint的inflight不被取消或排空。

A packages/scripts对 `AdmissionPauseControl|admission-control.json|pauseAdmission|resumeAdmission` 无命中（S04 R1原文预期no-match）；A engine无检查点；A workflow capability/API routes无pause/resume。故保留旧`paused:true`、改JSON字段、手工touch文件均不能使A继承暂停。未对live文件状态作断言。

## 2. 可实现的最小窗口边界与 STOP-UNKNOWN

**建议沿已有显式停机阶段，不引入新的launchd/system策略。** 在未来获批一次窗口中，stage05完成exact旧runtime exit、旧workers及已派发tool sender的真实副作用边界终止/隔离证明后，保持`system/ai.agent-core.runtime`不loaded；连续到stage09完成、stage10 bootstrap之前不bootstrap/kickstart，fresh-read无新runtime/worker/8788/8790 owner。不加launchd disable override/profile、不改env/plist、不创建持久pause协议。

这只证明**停机区间该runtime无新准入**；bootout发出至exit证明前仍不能这样声称；已提交远端effect不会因此取消，业务仍UNKNOWN。stage04只读quiet既不是全入口暂停，也不准结算造clean。依据为现行executor已有bootout/bootstrap边界、local recovery规则、D-009精确正证据和Lifecycle实际写/投递边界要求。

A bootstrap后的可达反例：

- `packages/production-runtime/src/compose.js:374–386` 挂Product API及notification ingress；454接Scheduler starter。
- `scheduler/health-runtime.js:137–142` 调用 `scheduler.start({autoStart:true,catchup})`，继而 `workflowExecution.start()`。
- `workflow-execution-runtime.js:192–193,458–465` 按poller agent配置启用定时poll。生产真实配置当前UNKNOWN；不能因为隔离空env未配置就假定生产不会poll。

因此，bootstrap之后再调用stop有竞态；launchd保持停止可以阻止runtime执行，也就不能同时完成其运行中health验收。不存在本轮零代码、冻结tuple不变即可证明“暂停跨重启继承且正常运行验收”的已证入口。

最小申请处置：V2把**stage10 bootstrap作为结束停机containment、恢复既有自然准入的显式释放点**提交Owner。Owner接受的是一次窗口的释放边界，仍须原各Agent/job fences和旧tool隔离门；不能称pause继承成功。若Owner要求stage11/12 verify/hr_observe期间继续零新业务准入，**STOP-UNKNOWN before bootstrap**，保持依赖动作停止；另行在accepted Contract内准备源码修复/新冻结组合或有真实全入口证明的已有containment，本轮不实现、不另造Spec。

Model convergence处置：旧pause文件/历史证据RETAIN；不并行加第二套持久pause/launchd桥。窗口停机是一次操作阶段，不是永久TEMPORARY_BRIDGE产品模型。实际运行消费者迁移/旧pause执行路径退出只有在真实consumer/接受实现明确后才能另作MIGRATE/RETIRE，本轮不宣告完成。

## 3. source-stamp 精确兼容表与最小处置

以下行号属于**A stock源码**；窗口安装器W在R3供应块之后偏移+21，切勿混用（hash见V2 §1）。

| 固定源码 | 格式/行为 |
|---|---|
| A `scripts/lib/trusted-source-git-stamp.sh:3,36–49` | `printf '%s%s' "$HEAD_SHA" "$DIRTY_COUNT"`，无分隔/无JSON/无末尾换行；从Git实读，不应手填 |
| A `scripts/trusted-cp-deploy-install.sh:603,831` | 取原始stamp并写harness/.source-stamp；780–781按原文reuse比较 |
| A `scripts/agent-core-backup-ops.sh:262–270` | 取前40字符作为commit，JSON不兼容 |
| A `packages/agent-provisioning/src/index.js:85–120,138–146` | Git不可用时JSON.parse；必须为单object非array/null，exact keys commit/dirtyCount；commit40位小写hex；dirtyCount整数≥0且最终必须0；失败 `dsh_commit_mismatch`，不静默fallback |
| fork4fc installer604–606,784–785,836与backup266–275 | 构造/比较/写JSON；backup同时处理JSON和历史wire；还包含npm platform/arch/pnpm force变化，不可整包夹带为stamp修复 |

同一clean H身份的示意（**推导示例，不是本轮运行writer输出**）：legacy为 `13ecda5c759263c7ce7ab93b678f862f65513f340`（40位commit+0）；reader要求 `{"commit":"13ecda5c759263c7ce7ab93b678f862f65513f34","dirtyCount":0}`。前者JSON解析拒绝；后者不能通过legacy原文reuse/backup解析链。

最小处置：保留真实stamp和原文件/收据，受影响无.git provisioning消费者 `NOT_READY/UNKNOWN`；不手填JSON、不伪造dirtyCount、不运行安装器凑失败、不更换冻结SHA。stamp为部署provenance，不因S04冷历史兼容通过而自动正确。若本窗必需路径实际不使用该reader，可仅以真实调用/配置证据排除该依赖；**当前没有该证据**。若为必要handshake/final provenance门，STOP相关consumer及依赖bootstrap；在独立后续源码任务中复用accepted provenance义务，统一writer/reader/reuse/backup真实消费者并验证后再冻结，避免永久双解析fallback堆叠。

## 4. 权效恢复与工具坐标的额外 load-bearing 观察

V2 §3已分别列W:1150–1218全部固定路径和1226–1239安装树metadata、R2两棵树。现行helper只保存完整trusted tree和两棵R2外树，其他生产根metadata/link不存在同等原生preimage；W:1220才标记§5b，部分失败可能已写metadata但flag未true。**全权效可恢复当前不能PASS**。未来逐路径前后态/恢复验证坐标在V2明确，未伪称已生成；缺证据停在bootout前，不扩大R2回滚业务内容。

工具协调：S01 `99b0fa84` 已做pin修订，保留通过证据、不重做其修复；但A的executor/helper_core仍钉旧f6a1f77a，而99b工具树不含A的03b/06a/anarrowed完整阶段。两种源码面都不能凭单一文件名当可执行最终bundle。当前只读 `git diff --name-only A 99b -- scripts/fleet-window`可复核。受审、完整、输入匹配的既有bundle坐标尚UNKNOWN；本轮不合并/拼装源码，更不从此启动stage00。此为具体组合交付门，不推翻既有单项selftest结果。

## 5. Governing依据与证据限制

| 依据（A内固定版本） | 本次适用结论 |
|---|---|
| D-009 `SCHEDULER_OCCURRENCE_OUTCOME_V3.md:534–600` | exact正向termination证据，UNKNOWN与termination分离，仅本occurrence贡献；PID absence不代替完整证明 |
| 同文640–694、accepted `SCHEDULER_TIMEOUT_OUTCOME_V3` | 单document版本2→3；v2读写v3 fail-loud；提交v3 evidence后禁止降级/旧业务快照覆盖 |
| accepted `AGENT_DELIVERY_RESILIENCE_D009_ALIGNMENT_V1.md:118–150` | exact/trust/coherence三态；缺证据零权威reconciliation写；其他UNKNOWN的aggregate贡献保留 |
| `AGENT_PROCESS_LIFECYCLE_HARDENING_V4.md:103–114` 与local recovery规则 | 真实prompt/tool/write/delivery边界终止或隔离；health/PID/epoch文本不足。V4 exactHR cut有专属适用范围，本窗不调用该cut或扩大授权，只沿用相同被local独立重申的终止要求 |

本轮事实来自固定对象源码、S04原收据、本机冻结输入hash及两名独立只读助手；未动态执行pause/provisioning/install/runtime，未读生产受保护JSON，未触生产端口/launchd。S04观察SHA `6bf9c9bec248e08567920fb464581b64c7ac51b64007b20698e06b7750d2a526`保持历史引用。pause writer文件hash `4c4fb663e5b394102f1b88f7967cb56dc7be519239ff7cc895a09a0a5267463f`；A writer `64c2bb1b2be9464e10406685243f9661090795d7c2246cf2b35a08585bc4e847`；A provisioning `ba397d8cb92d56f11158400256097379edbea69271a6ac5fee471b56127eb0cf`（S04固定源码证据）。静态结论SUPPORTED；窗口方案INFERRED且未执行；实际loaded consumer/旧tools/remote效果/owner释放时点均UNKNOWN。

调查已完成，S05未全解除。最小下一动作由相关owner提供既有tool bundle/实际consumer依赖证据及明确准入释放边界；在这些门闭合前继续保留STOP，零生产尝试。无新Observation不递归重跑已通过S04。
