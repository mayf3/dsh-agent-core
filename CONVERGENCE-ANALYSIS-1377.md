# #1377 观察责任收敛分析（R2）

本文件是非规范性 Investigation / 测试设计，不接受新合同、不授权实现或生产操作。核查时间：2026-11-07，UTC。所有 RED/GREEN 均为设计及源码推导，**本轮没有执行产品测试**。

结论：#644 已交付 blocked 自动恢复和拒绝后的持久只读观察，不能重做。其消费者已能有限识别 (a) 实例终态及 (b) 原 visit 不再 current，但始终返回 `REFUSAL_RESPONSIBILITY_PENDING`，尚无持久关闭或可靠交接。(a)/(b) 若需在原 ledger 持久关闭 **B2 terminal recovery_refused** 观察责任，需要 accepted 语义差量；不能挪用仅对 B1/B4 开放的终态追加例外。(c) 的合法交接目标已被合同覆盖，但现自动消费者未接通；复用合法 assignee Assistance 与新增系统 producer/reason 必须分开判定。

## 1. 坐标、授权与证据范围

| 对象 | 本轮只读核验坐标 / 结果 |
|---|---|
| 任务工作面 / 精确父提交 | `/private/tmp/h1377-b2`；R2 初始 detached `3c1bcf98bc40a2c34cca24f241c87d1b12cea216`，只有原 Brief / R1 STOPPED 两个 untracked，无 tracked diff |
| 文档分支 | `docs/1377-convergence-analysis`，从上述精确父提交创建；只准本报告及回执写入 |
| 任务来源 | 用户 R2 续派及保留的 `BRIEF-1377-CONVERGENCE-ANALYSIS.md`；[agent-control#1377](https://github.com/mayf3/agent-control/issues/1377) OPEN，最新监管拆分评论 `6701777981`（2026-11-07T03:41:06Z） |
| #644 已交付面 S | [core PR#644](https://github.com/mayf3/dsh-agent-core/pull/644) MERGED，head `8f68a94668764f957043640fa1eb23740a760a29`，source `d3d4410c9184ca5d1c05607c5d47c3ca024b66c8`，merge `4f7df01bcf087075c114901a96a7a54573110f61`，mergedAt `2026-11-07T03:41:02Z` |
| 当前 main 快照 M | `git ls-remote origin refs/heads/main` = `55f442c74414dc723306a6d8e0cdba73d78eb8da`；未切换工作面、未 fetch/reset/rebase |
| 固定父提交与 S 的区别 | `3c1bcf98` 是 #644 的 base，**不含 #644**。本文 S 代码通过 `git show` 读取，不能把它说成当前 checkout 内容 |
| S → M 影响核查 | `git diff 4f7df01..55f442c -- packages/workflow-execution packages/production-runtime/src/workflow-execution-runtime.js` 为空；以下 S 消费链同样适用于 M |
| 合同快照 A | 下列五份合同/Decision 在父提交与 M 内容相同。行号以父提交文件为准；后续实现必须重绑当时 main |

读取顺序：AGENTS → `.agents/README.md` → `.agents/local/README.md` → Product Architecture / Decisions / 直接 Specs → spec-governance router + **PREFLIGHT**。另只读核对 M 的 local governance、accepted rc.3 lock 和 Adoption V3 §14：父提交 lock 的 `proposed` 不能被说成当前 main 的激活状态。M 中无关的治理/SRA 变化不被本任务接管或用来取得操作权限。

LIVENESS 的 accepted frontmatter、末尾 acceptance alignment note 及 [#623 接受更正](https://github.com/mayf3/dsh-agent-core/pull/623#issuecomment-6677721343) 相互核对：原接受评论字面量未展开，已明确绑定 merge `2d550bc8147c877db33886fccb85e00a64353e66`，#631 对齐状态。正文中保留的 authoring-time pending 占位按该显式更正理解，不将历史占位当成当前未接受，也不自行改写它。

```text
schema_version = 2
SPEC_GOVERNANCE_MODE = PREFLIGHT
TARGET_REPOSITORY = mayf3/dsh-agent-core
BASE_HEAD = 3c1bcf98bc40a2c34cca24f241c87d1b12cea216
CURRENT_BASE_HEAD = 55f442c74414dc723306a6d8e0cdba73d78eb8da
ROUTE_STAGE = AUTHORITY_AUTHORING (investigation only; no authority delta authored)
AUTHORITY_ACTION = REUSE (analysis/delivery mandate only)
PRIMARY_AUTHORITY = existing local governance + A inventory below
AUTHORITY_ACCEPTED_IN_BASE = YES (five relevant product authorities)
IMPLEMENTATION_AUTHORITY = not_applicable (this document)
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = DURABLE (published analysis; independent document check)
MUTATION_AUTHORIZATION = VALID (user: two documents, new branch, push, PR base main)
ISOLATED_WRITE_SURFACE = YES
ATOMIC_SPEC_IMPLEMENTATION_PERMITTED = NO (not invoked by this mandate)
CONTROLLED_RUNBOOK_REQUIRED = NO (no runtime/production operation)
SPEC_GAP_DEPENDENCY = NON_LOAD_BEARING (for analysis); LOAD_BEARING for future B2 terminal writes
EVIDENCE_REVIEWABILITY = PASS (pinned Git sources and linked task/PR records)
IMPLEMENTATION_ALLOWED = NO
MERGE_READY = NO (explicit no-merge mandate)
OPERATION_ALLOWED = NO
DONE_WHEN = report + receipt committed/pushed, base-main PR open, no merge
EXPANSION_TRIGGER = workface mismatch, required delivery gate failure, authority conflict affecting conclusions, source-write requirement
NEXT_ACTION = CONTINUE (documentation only; future semantics must RE_PREFLIGHT)
```

## 2. 合同覆盖坐标：必须区分三个对象

1. **旧 attempt 历史**：原 identity/generation、WAL、terminal verdict、原事件字节保留。
2. **旧业务 outcome / 外部效果**：仍 UNKNOWN；停止证明、实例终态、观察关闭均不冒充旧 Run 成功或失败。
3. **后续观察责任**：可以有持久下次触发、可信关闭事实或合法可靠交接；其具体写权限受责任类别及终态例外限制。

| A 文件 / 条款 / 行号 | 当前有效含义及本任务边界 |
|---|---|
| `docs/specs/AGENT_CORE_WORKFLOW_RECOVERY_LIVENESS_V1.md`，CTR-EKRWAE-001，175–187 | exact instance/visit/dispatch/owner、attempt/request/generation；processGeneration 与 runtime epoch 分开；UNKNOWN、停止证明、无 replay |
| 同上 CTR-002，189–199 | B1 临时读失败持久责任及 next-check，既有 Scheduler/reconciler 自动再读，重启再发现；有限失败不能丢责任 |
| 同上 CTR-003，201–216 | 同 ledger、锁/fresh replay、来源及交接/关闭证据；**207 的 terminal append 例外限 B1/B4**；215 保留其他 terminal append 禁止；可靠送达且有后续消费者/答复验证/再触发才可交接 |
| 同上 CTR-004，218–239 | B2 同 attempt、共享 recoverAttempt 安全 gate；224–233 全部正面零投递/停止/identity gate；221 明确 ordinary planned 不适用；238 terminal no-op、world drift 按旧 refusal 保留事实并可靠交接 |
| 同上 CTR-005，241–256 | 既有可信自动消费者、持久 next-check/重建、accepted rule + exact trigger + fresh gate；人工 authorityRef 不绕安全门；无新 timer/queue/service |
| 同上 CTR-006，258–274 | B4 缺基线/同 visit version-only 不退出观察；可信 moved visit/visibility invariant 可关责任，不归因旧 Run；晚采样不替代原 baseline |
| 同上 CTR-007，276–285；ACC-EKRWAE-002..008，296–306 | 长期无安全证据/真实决策 → 既有 Owner/Assistance；需接收方、送达证明、答复验证/再唤醒，失败保留原触发；Pending/通知ACK/耗尽次数不算交接 |
| `docs/specs/AGENT_CORE_WORKFLOW_AGENT_EXECUTION_V3.md`，CTR-WAE-006/007，323–361；010，396–418 | Workflow moved fact 与 target Agent visibility invariant；`SETTLED` 仅为本 visit 处理责任闭合，不代表旧 Run 是完成者。LIVENESS §8 明示的既有 clause succession 生效，其余保留 |
| 同上 CTR-WAE-008，363–371；012，484–545 | 普通 Assistance 由 target Agent 自身 Principal 打开；ledger append-only/terminal-refusing 与 WAL；不能把 B1/B4 例外扩给 B2 |
| `docs/specs/AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V3.md`，CTR-WEC1-002，101–123；004，133–150；005，152–169 | UNKNOWN 不自动变 eligible；HUMAN_REQUIRED 只能来自权威 Svc 的显式 Domain Owner escalation；005 是 attempt-limit Assistance，不是任意长期无证据 producer |
| 同上 CTR-WEC1-008，204–283；既有 Assistance read/action 边界，342–346 | ordinary authenticated current assignee / execution_policy 两种 ingress；Owner resolve 的正面 settled、原 pre-delivery baseline、exact case/sequence gate；不能用交接或人工答复放行 UNKNOWN |
| `docs/decisions/SCHEDULER_OCCURRENCE_OUTCOME_V3.md`，D-009，48–54、544–600 | exact business outcome、exact termination-only、无可信证据三分。termination-only 保留业务 UNKNOWN；无证据不写 settlement/fence；本 Decision 自身无 implementation authority |
| `docs/specs/AGENT_DELIVERY_RESILIENCE_D009_ALIGNMENT_V1.md`，CTR-527D2-001..004，110–161 | ordered evidence gate、history/aggregate fence/no replay、默认 OFF。无证据只允许既有健康/责任记录，不允许 authoritative reconciliation 写入 |

**(a) 实例终结**：可信 exact Workflow 实例终态是业务世界事实；它不是旧 worker/tool 已停止的 exact termination proof。B1/B4 已有 CTR-003/006 与 ACC-EKRWAE-007 的 terminal-business-result 正对照；B2 refusal 观察可读该事实，但当前没有 terminal 持久闭合例外。

**(b) 原 visit 结束/迁移**：WAE-007/010 + LIVENESS-006 已给 moved/current-visit 或 visibility invariant 的合法含义。版本增长/下降、assistance-only bump、名称或时间都不单独证明迁移。关闭的是原 visit 的处理责任，不自动建新 attempt、移交执行身份或把 Owner replacement 当自动 Visit handoff。

**(c) 长期无安全证据需决策**：现行形态是既有 Owner/Assistance 可靠升级，必要时由 Domain Owner 显式 HUMAN_REQUIRED；不是自动认定业务结果、自动 resume 或“超过次数即移交”。没有安全坐标时仍保留原责任和下次触发。合规人工决策只决定其权限内事项，后续动作重新走原 gate。

## 3. #644 真实消费者盘点（S = M）

以下路径除特别标注外，`src/*` 与 `test/*` 相对于 `packages/workflow-execution/`，行号绑定 S。真实源码连接存在不等于本轮运行证明。

```text
packages/production-runtime/src/scheduler/health-runtime.js:137–142
  → workflowExecution.start()
packages/production-runtime/src/workflow-execution-runtime.js:169–235,459–466
  → 持久 ExecutionLedger(layout.workflowExecutionDir) + config + engine.start()
src/engine.js:450–460 → startup reconcile / interval tick:399–405
  → pollOnce/_pollOnceImpl:311–318 → reconcileOnce:213–308
  → summary.recoveries = await reconcileBlocked():305
src/recovery/automatic.js:19–33
  → ACTIVE/resolution_blocked 到期项 → 同一 recoverAttempt
  → terminal refused 项 → refusals.reconcile()
```

| 层 / 坐标 | 真实职责、消费结果、重启与权限 |
|---|---|
| `src/engine.js:426–435`；`src/recovery/operation.js:49–112,122–204` | 唯一 recovery 工厂/闭包自动 capability；共享 FIFO/OwnerLock/fresh replay 和 fresh world/Router/WAL 零投递门；通过后原 identity 授权 → WAL → 首次 deliver；普通 planned 未纳入 |
| `src/recovery/automatic.js:19–33,36–64` | finite positive budget/delay；original identity/revision 到期恢复；在 ACTIVE 且 world drift refusal 前先持久 `refusalSchedule`。不是终态后补写 |
| `src/recovery/automatic-ledger.js:7–17,20–58`；`src/ledger-events.js:165–167` | `recovery_checked` 的 exact identity/revision 验证、append/projection/replay；保存 nextCheckAt、failures、rule、UNKNOWN、refusal cadence |
| `src/ledger.js:227–237,260–267`；`src/ledger-records.js:234–259` | 同一 attempts.jsonl，append+fsync，既有 mutation FIFO/OwnerLock/fresh replay 与 scope-bound record ports；不建第二 ledger |
| `src/recovery/refusal.js:11–22,50–82` | NEEDS_REVIEW/recovery_refused + schedule 才归此消费者；持久 anchor/interval 决定到期 slot；fresh replay/锁内核对 original identity/revision；`served` Map 仅节流公平，重启从持久 schedule 再发现 |
| 同文件 `25–47,77–80` | 原 Principal resolver → target Agent exact instance detail → 只读世界观察；始终返回 Pending + UNKNOWN。无 record-port append、closure、recover/deliver 或可靠 handoff |
| `src/engine.js:305,389,399–405` | Pending 放入返回 summary；自动 tick 只检查 poll `ok`。源码检索该 outcome 无后续闭环消费者 |
| `packages/production-runtime/src/workflow/capability-runtime.js:42–56`；`src/projection.js:69–123`；`src/attention.js:24–38,73–86` | trace/attention 读 snapshot；refused 仍是 OUTCOME_UNKNOWN；不输出 recovery cadence，不是责任接收者 |
| `packages/execution-history/src/loaders/attempts-ledger.js:15–58` | 可读原始 recovery_checked 审计 record；不是后续责任消费者 |
| `src/forum-projection.js:36–68,203–207` | 没有 recovery_checked/refused 对应消息 case；不能将 forum 展示或 ACK 当 handoff |
| `src/terminal-attempt-operations.js:10–12,25–33,41–64` | attempt-limit/stale-confirmed Assistance producer；没有长期无证据专用触发，不消费本 Pending |

`recoveryCheck.consumer='workflow_execution_due_poller'` 只是记录；实际路由由以上代码完成。`refusalSchedule.consumer/ruleRef` 被校验，anchor/interval 被真实 poller 使用；字符串本身不等于注册了接收方。

### (a)/(b) 现有识别力

| 分支 | 已有识别（`src/recovery/refusal.js:35–40` + `src/judgment.js:67–87`） | 尚缺 / 不能推断 |
|---|---|---|
| a | exact `workflow_instance_id` 后，先要 settle helper 可判，再把 `is_terminal===true` 标 `instance_terminal` | terminal flag 但 full 无合法 current visit 仍 unavailable；404/gone/PID 消失不算终结。识别后仍 Pending，无持久终点 |
| b | full 合法 current visit ID 与原 ID 不同；或 target Agent `historical_participant` 的不可变 assignee visibility invariant | 不凭任意身份/名字猜迁移；缺 visibility/visit、same-visit version-only 不足。识别后仍 Pending |

B1/B4 的 `src/recovery/readback.js:32–74` 已能持久关闭 a/b；但 `readback-ledger.js:8–15,28` 要求 **delivered**，B2 refused 不在该集合。其 `65–71` 会按窄例外投影 SETTLED，不能直接挪作 B2 terminal 零变更路径。

对合法完整终态日志，#644 refusal 消费无 terminal event append / attempt projection 改动；不要将此扩大成损坏 store 的任何物理字节也不变：其 `mutateWithRecord` 仍经 ledger.mutate 的既有 torn-tail repair。本轮没有实际损坏/恢复测试。

### c 可复用入口与缺口

| 现有入口（代码同父提交） | 合法条件 / 不能扩张的边界 |
|---|---|
| `packages/broker/src/capabilities/workflow/assistance.js:282–349`，`workflow_assistance_request.open` | scope workflow.execute、authenticated current assignee、current visit、fresh CAS、可信幂等键；308–312 拒绝非 assignee / closed 实例。WAE-008、WEC-008 已授权此形态；poller 不得冒充 assignee |
| 同文件 `67–107,110–139`，owner_inbox/detail / Owner actions | 已有 authorized read/action、显式 resolve/escalate；须实证接收消费、送达/答复与重唤醒，不以返回 ok 或 case id 单独证明闭环 |
| `packages/broker/src/capabilities/workflow/dispatch.js:179–225`，`workflow_execution_escalation.create` | workflow.execute + enabled GLOBAL_SCHEDULER_READ；当前 visit/非 closed；reason 只允许 ATTEMPTS_EXHAUSTED / STALE_LOOP_EXHAUSTED。长期无证据不等于这两个事实；不杜撰新 reason |

LIVENESS-007 已定可靠交接义务，不授予第三个 reason、新 caller 身份、非 current visit 的写权限或 B2 terminal append。若事实和身份允许，可复用普通合法 Assistance；若始终缺安全坐标，这条具体入口也不可调用，须保留责任并走有明示授权的治理决策路径，不假定 proposed [core#643](https://github.com/mayf3/dsh-agent-core/pull/643) 已生效（读取时 OPEN，head `7b5d79c3961625aaade6f3b383b18b2968e82f6c`，implementation_authority none）。

## 4. 三分支验收设计（NOT_RUN）

统一夹具与 oracle：

- 使用 test-only 独立持久目录与真实 ExecutionLedger/Router receipt store；涉及 Svc 声明时使用测试专有 DB 和真实 command/receipt/效果 witness。Scheduler 仅 JSON fixture 时明确标 PARTIAL。
- 经正式 production-runtime mount/start（集成层）及现有 `engine.start()`（进程故障层）；自动主线不由测试直接调用 recoverAttempt、消费者 helper 或发送“继续”。入场用正式 due-feed/admission 链形成原 attempt。
- 每例记录 sourceSha、testName、faultInjection、initialState、expected/actual、rawReceipt、rc、原 identity、attempt/request/generation、processGeneration/runtime epoch、状态/事件/效果计数及 hash。原业务 delivery/transition/effect 与 Assistance wake 分开计数。
- 在责任登记前、append+fsync 后、读回后而提交前设精确 IPC/barrier，并真实终止/重启 child process，重开同目录。重启后仅恢复依赖和启动系统，清除测试内存，不能依赖存活 timer/Map。
- 完整旧事件前缀、原 terminal verdict、UNKNOWN 与 protected Router/Scheduler history/fence 不变；未来获准的新责任元数据另验唯一 append。旧观察跨合法新代提交时必须 CAS 拒绝，不能改新代。
- 终点需可读回的权威关闭事实，或 exact 接收方 + 合法送达证据 + 持久后续消费者 + 答复验证/重新触发。周期日志、Pending、NEEDS_REVIEW、通知入队/ACK、计数耗尽均失败。健康项不能被失败项饿死。

| 设计 ID / 分支 | 场景和故障序列 | RED 定义（待执行） | GREEN 预期（待合法实现） |
|---|---|---|---|
| T1377-A / a | 正式入口形成 #644 blocked → world-drift refusal + durable schedule；停控制器；原 Workflow 经合法业务命令终结；重启到期读取。另测 full/current 与可证明历史可见性，及 terminal flag 缺必要字段负例 | **S/M 的 B2** 虽识别 terminal 仍 Pending，没有持久 closure/handoff；重启后照旧观察即暴露缺口。不能以父提交未含 #644 代替此 RED | 在 accepted B2 责任协议下仅关观察责任或可靠交接，保留旧 terminal/UNKNOWN/identity，无新业务 delivery；再次重启不复活已关闭责任。不得把 Workflow 终态当 worker termination |
| T1377-B / b | 同类独立种子，实例非终态，权威 current visit 已变；另测 target Agent historical_participant。加 same-visit version++/--/assistance-only、错误 instance/identity、缺 visit/visibility、旧观察跨合法新代负对照 | S/M 已识别 moved/visibility fact，却仍无持久终点；以 count/log/ACK 判过会假绿 | accepted 协议消费 exact moved fact，关闭原 visit 观察或可靠交接；不把旧 Run 记为完成者，不自动 handoff execution 或生成新代。负例保持责任及 protected state；旧观察不改新代 |
| T1377-C / c | 持续 503 / resolver 暂失 / stale epoch / 冲突证据，区分临时失败与真实决策需求；先交接失败、仅 ACK、接收后响应丢失，逐个重启；再以合法接收路径取得 durable case/receipt/consumer；测试权限内真实答复与重新触发 | S/M 只有有限只读重试和 Pending，无本类可靠交接链；禁止借 attempt-limit reason 造通过。无合法 producer 时测拒绝和责任保留，不伪造正例 | 若复用既有合法 assignee 路径，证明其全部前置和答复验证；若新增 system producer/terminal metadata，先接受对应 Core/Svc 差量。送达失败/ACK-only 原责任仍在；成功交接后接收者重启可发现；答复不自动放行 UNKNOWN，后继动作重新过 gate |

所有分支均加默认 OFF、停用后重启、有限正预算、依赖恢复、公平性、无可信证据零 authoritative reconciliation、单 admission、WAL/丢 ACK 回归。若实际协议没有允许的新元数据写权限，GREEN 只作为需求待接受，不能先写测试制造权限。

**B1/B4 正对照**：现有 delivered readback 已可处理 a/b；不声称 current main 的这些场景必 RED。用既有正常关闭做 GREEN 对照；若需验证测试敏感性，设计明确只破坏消费者/closure 判别的定向变异 RED，并记录变异及真实失败，不能把它冒称原 main 缺陷。

### #1383 纵向验收复用面

[agent-control#1383](https://github.com/mayf3/agent-control/issues/1383) 读取时 OPEN、无评论，只负责纵验；产品修复仍归 #1375/#1376/#1377。它的主线是**真实业务提交 → 第一次结果读 503 → 控制器重启 → 自动原结果读回 → 业务效果仍为 1**。本任务不代为派发或实现。

| 现有夹具 / 坐标 | 可复用 | 不足 / 必补 |
|---|---|---|
| `test/observation-cas/readback-restart.test.js:13–80`；`readback-process.js:9–56`（父提交已有） | B1 503、B4 缺基线、真实 file ledger/child restart、engine.start 与 moved visit | 既有 seed 有直接 admission/reconcile；Router/due 注入，非真实 Svc DB；纵验须补正式入场及实际业务命令 |
| `readback.test.js:107–189` | protected Router/Scheduler fixture hash、旧代/revision CAS、公平预算负例 | JSON Scheduler fixture 不是完整 Scheduler；叶子 CAS 不是跨服务 E2E |
| S 的 `blocked-recovery-restart.test.js:26–166,178起`；`blocked-recovery-process.js:27–43,106–127` | loopback HTTP、真实 Router receipt/file ledger、多进程、持锁 IPC barrier + SIGKILL、WAL/ACK-loss、start/restart、refusal bytes | 原测试证明的是首次 admission/责任保留，不等于业务效果恰一次；manual race 支线不能成为自动主线推进器 |
| S 的 `blocked-recovery.test.js:368–420`；`packages/workflow-execution/test/runtime-wiring.test.js:138–208` | 真实 engine 的 production mount/config 接线、既有 restart 装配 | broker/resolver/router/child 假件须逐一标出；须补完整 mount/start/restart 链才能声称该层通过 |

a/b 复用 #1383 主场景的环境、原命令收据、效果计数和故障窗口，分别检验恢复读取后的 terminal/moved 事实；c 是持续 unavailable 的独立决策/交接分支，不冒充已完成业务。旧代交错使用独立合法新代种子，不能篡改已完成业务造新代。父提交无 #644 的 RED 只能说明旧自动恢复缺口，**#644 后责任收敛 RED 必须在 S/M 或标明的有效变异上执行**。

真正 Svc DB/业务提交/效果 witness 未参与时最多 SOURCE/PARTIAL；所有本轮实际运行结果为 NOT_RUN，live business / unattended 为 UNKNOWN。公平性假设显式为依赖最终恢复、持续调度与有限正预算，不扩张成永久无人值守保证。

## 5. 合同差量三值判定与最小接受路径

三值以**具体需求及对象**判，不把“已有识别”误当“已有持久闭环”。

| 分支 / 具体需求 | 三值判定 | 依据 / 最小后续路线 |
|---|---|---|
| a/b：可信事实阻止 B2 再 admission；既有 delivered B1/B4 closure | 合同已覆盖 | CTR-001/003/004/006、WAE-007/010；已有代码能力与实际运行另行验证 |
| a：B2 terminal refusal 在同 ledger 持久关闭观察 | **需 accepted 语义变更** | CTR-003 终态例外不含 B2，004 terminal no-op；只读识别不足以授权追加 |
| b：同一 B2 terminal 责任因 moved/visibility fact 持久关闭 | **需 accepted 语义变更** | WAE 事实/关闭含义已定，但 B2 终态追加权限仍缺；不改变旧 Run outcome/作者 |
| c：在既有合法 assignee/Owner Assistance 前置下可靠交接 | **实现缺口**（交接目标合同已覆盖） | CTR-007 + WAE-008/WEC-008；现 poller 无闭环消费者。没有 current assignee/visit 事实时该入口不可调用；本判定不是自动 poller 写许可 |
| c：新增非 assignee 的系统 producer、新 reason / 权限 / closed-visit 处置，或 B2 terminal handoff/答复/next-trigger append | **需 accepted 语义变更** | 不能将无证据改名 attempt-limit；不能借007覆盖具体身份/协议或003窄例外。新增跨服务 producer 需 Core/Svc 对应接受 |

未来 load-bearing gap 的精确诊断（不是本轮实施授权）：

- **受影响动作**：对已 terminal recovery_refused 的 B2 责任追加观察、a/b closure、c handoff/答复/下次触发，或启动新系统 Assistance producer。
- **已查 authority**：§2 的五份 A、local precedence/whole-successor 规则、既有普通 Assistance / execution_policy 合同入口；未以 proposed #643 或代码替代权威。
- **可达反例**：#644 ACTIVE 先持久 refusalSchedule → 旧 terminal refusal → target detail 得到可信 terminal/moved → 每轮 Pending；若直接挪 B1/B4 recordReadback，会越过类别/delivered/terminal gate。c 若无 current assignee 身份只能拒绝，普通 Assistance 也不能作为假成功。
- **影响**：当前只读消费者可继续履行观察，但持久终点/可靠转移未完成；未来依赖新写权限的实现 readiness=NO，NEXT_ACTION=RE_PREFLIGHT。无关已有 blocked 恢复和本 docs delivery 不受阻。
- **移除依赖的现有路径**：事实和身份足够时使用现有授权 Owner/assignee 路径作合法交接，B2 terminal ledger 零追加；必须实证持久接收责任及后续消费，不以单次通知替代。若不能满足这些前置，继续原观察，不能宣称闭环。

**最小语义差量**：在同一既有 ledger、原 exact identity、锁内 fresh replay/CAS 下，为 B2 terminal recovery_refused 的**后续责任元数据**增加有界例外：允许记录只读观察、可信 a/b 关闭，或已合法可靠送达的 c 交接/答复/下次触发；必须可重放、幂等、重启不复活，失败不丢责任。保留旧 terminal verdict、事件字节、WAL、generation、UNKNOWN；禁止 un-terminal、admission、delivery_started/run_delivered、business/termination settlement、Router/Scheduler fence/occurrence/nextRun 写入。具体字段不是本分析接受的 wire contract。

**接受顺序**：本任务不启动变更。未来先按当时 main 重新 PREFLIGHT → docs-first **whole-authority successor**（完整保留 LIVENESS V1 当前有效正文、明确窄差量/依赖 crosswalk、原子 lifecycle/backlinks）。不得改同 stable ID 或复用 V1 §3 的旧任务专属 partial-supersession 例外；若跨到 WAE 或其他 accepted authority 的有效意义，也须纳入相应 whole-authority successor 事务，不能在 Review 中暗改。新增系统 producer 时，明确 Core/Svc 所有权、合法 caller/reason、接收关闭/答复责任及失败路径，完成对应接受；可复用普通 Assistance 时不无故扩大权限。独立语义 review → mayf3/明确授权 maintainer 绑定 reviewed/final heads 接受 → 合入 main → 含接受的后续 base 另走 REUSE 实现。**D-009 / alignment 无需修改**；生产启用另有正式授权。

## 6. engine.js 冲突预检与 #1364 顺序

[agent-control#1364](https://github.com/mayf3/agent-control/issues/1364) OPEN。现有 writer `/private/tmp/h1364-budget` 只读实测：branch `fix/admission-budget-fairness`，HEAD 同 `3c1bcf98`，tracked dirty 为 engine.js / ledger-admission.js / continuation.test.js，224 additions / 8 deletions；无对应 PR。其 STOPPED 记录 `2026-11-07T08:10:33Z` 定向门 6/7、rc1、未 commit/push；这是**该 writer 的记录**，不是本轮复跑或本任务门失败。未接管、复制或修改其文件。

| 对象 | 实际改动 / 未来冲突坐标 |
|---|---|
| #1364 未提交 engine | 当前 dirty 文件16/55 import/init createAdmissionBudget；86/131 admitDueIntent 回调计数；324/370–392 `_pollOnceImpl` 三预算/rotation。配套 ledger-admission.js:7–57；重启 rotation 不持久 |
| #1364 dirty engine SHA-256 | `9b11830dc968ae83b7a2d6f5e3a93105ce4bd479ebb0ab4b187eabe331273ef1`；未来必须 fresh-read，不将此快照当完成候选 |
| #644 已合并 engine | S:305 reconcileBlocked 调度；426–427 恢复工厂注入 clock/config。与 #1364 主要不同文本 hunk，但同 engine 轮询生命周期 |
| a/b 未来责任实现 | 很可能触 `recovery/refusal.js`、`automatic.js`、同 ledger event/reducer/record 层；若复用既有 reconcileBlocked 注入可不增 engine 逻辑，但仅为设计判断。新增依赖/summary/调度则触 engine:213–308/426–435 |
| c 未来可靠交接 | 可能需接既有 Assistance adapter/terminal operations、责任事件与答复消费；如需 factory 注入、reconcileOnce 次序、预算或 startup/drain，会触 engine:305–318/399–466；不得靠另起 timer 避冲突 |

未执行合并模拟，不声称无文本冲突；共享 budget、公平性、single-flight、startup catchup、stop drain 和返回 summary 还有语义整合面。

**顺序**：保留已合并 #644 → 由 #1364 原 writer 合法续派、完成其失败门及交付 → 未来 #1377 获接受后的实现从含其合法交付的基线接续，再核 engine/ledger 调度及受影响回归。当前分析无需等待 #1364，也不派第二个 engine writer。#1364 的未提交代码不能被当成已合并依赖。

模型处置：RETAIN 旧 attempt/WAL/UNKNOWN、唯一 ledger、既有 poller/recoverAttempt；RETAIN 不同 delivered 责任的 B1/B4 readback；未来 accepted closed/handoff 后 MIGRATE 原 poller 的观察资格并验证 normal/fallback/restart 不复活；当前不 RETIRE 未完责任，不加永久映射或新 queue/store。历史审计永不删除。

## 7. 本轮结果边界

完成的是固定坐标的合同/源码消费者分析、三分支测试设计、差量判断及冲突预检。没有新增产品 Spec、测试或源码，没有执行自动恢复、业务投递、Assistance 请求、生产读取/写入或部署；没有把 #644 历史测试 PASS 当成本轮重跑。

交付动作和文档 hash 见 `RECEIPT-1377-CONVERGENCE-ANALYSIS.md`；最终 commit/push/PR 精确坐标由 PR 元数据及交付读回绑定，避免提交文件自引用自身 commit。
