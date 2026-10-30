---
spec_id: AGENT_DELIVERY_RESILIENCE_V1
status: accepted
date: 2026-10-29
accepted_date: 2026-10-30
accepted_reviewed_head: 8cf2c23a
independent_spec_review: AGENT_DELIVERY_RESILIENCE_V1_SPEC_REVIEW_R1R2R3
independent_spec_review_result: PASS (R1 REVISE 3 load-bearing gaps -> fixed 14e2b41b; R2 REVISE 1 gap -> fixed 8cf2c23a; R3 mechanical re-verification PASS, final-head binding 8cf2c23a; OPEN-1 anchor pinned at R1)
required_fixes: NONE
review_verdict: READY_TO_ACCEPT_AND_MERGE
acceptance_mode: owner-delegated in-session (mayf3 authorization 2026-10-30 "那你自己推进"; executor ZCode operator; receipts in this commit + agent-control#1332)
amendments:
  - AMENDMENT_1 (2026-10-30, status: accepted pending focused re-review): CTR-S2 frozen
    mapping gains the fifth negative line — lateOutcome=terminated_without_outcome
    -> failed (evaluated AFTER exact_turn_end_failure, BEFORE the ambiguous fallback).
    Rationale: the original text transcribed the owner-validated fence-janitor policy
    incompletely; janitor decide() contains exactly this line, and the shape is reachable
    in production via restart-quiescence startup recovery (startup-recovery.js writes
    lateOutcome=terminated_without_outcome with terminationEvidence=restart_quiescence_proven).
    Without the line those occurrences divert to humans (safe, but breaks the ACC-S2
    equivalence claim with the 44-decision ledger). Divergence found by independent
    implementation review of PR #588; amendment restores spec/code/ledger consistency.
type: implementation-spec (behavior + invariants; implementation in bounded follow-up PRs under this spec)
scope:
  - Router delivery resilience: child turn-transport readiness probing, respawn, bounded retry, dead-letter semantics, delivery-failure observability
  - Harness child provider-transport lifecycle across turn/idle cycles (wedge class root-cause obligation)
  - Caller wait bound configurability and late-outcome delivery (outcome_unknown / late_completed user-visible semantics)
  - Scheduler fence auto-reconcile policy (evidence-gated) as a policy layer over SCHEDULER_TIMEOUT_OUTCOME_V1 / SCHEDULER_CONTROL_PLANE_RELIABILITY_V1
  - Retirement of the two external stopgap daemons deployed 2026-10-29
out_of_scope:
  - svc-workflow-side identity/admission semantics (mayf3/svc-workflow#82/#83 govern those)
  - Codex web-search session-poisoning defect family (mayf3/dsh-agent-core#550)
  - Admission single-point dependency (mayf3/dsh-agent-core#554; this spec composes with its fix, does not replace it)
references:
  - mayf3/agent-control#1332 (evidence authority: incident timeline, deterministic reproduction, stopgap deployment records, owner authorization 2026-10-29)
  - docs/specs/SCHEDULER_TIMEOUT_OUTCOME_V1.md (accepted; D-007 occurrence outcome authority — unknown never terminal)
  - docs/specs/SCHEDULER_CONTROL_PLANE_RELIABILITY_V1.md (accepted; single mutation semantics + reconciliation + operator CLI)
  - docs/decisions/SCHEDULER_OCCURRENCE_OUTCOME_V2.md (D-007)
  - cron-helper SKILL.md v4.1.0（运维技能，位于 operator 主目录 ~/.agents/skills/cron-helper/，
    非 repo accepted 权威；self_ops reconcile 安全规则原文，见 DEC-004 锚点核查）
implementation_authority: contracts
parent_authorities:
  - SCHEDULER_TIMEOUT_OUTCOME_V1 (accepted @3776b19)
  - SCHEDULER_CONTROL_PLANE_RELIABILITY_V1 (accepted @0b0176a)
  - D-007 SCHEDULER_OCCURRENCE_OUTCOME_V2
---

# AGENT_DELIVERY_RESILIENCE_V1 — 交付韧性：子进程传输生命周期、router 健康探测与调度 fence 自动清算

> 状态：**proposed**（AUTHOR mode，2026-10-29）。本 PR 只提交 Spec 文本，不含任何实现。
> 证据权威：mayf3/agent-control#1332（含 2026-10-29 全天事故时间线、确定性复验、两份 stopgap 部署记录与 Owner 授权）。

---

## 0. Authoring Result

```text
AGENT_DELIVERY_RESILIENCE_V1_SPEC = PASS
NEEDS_OWNER_DECISION = NO (DEC-004 已由 Owner 2026-10-29 会话裁决；review 可推翻)
SPEC_STATUS = proposed
READY_FOR_INDEPENDENT_SPEC_REVIEW = YES
IMPLEMENTATION_ALLOWED = NO (until accepted at exact head)
OPEN_OWNER_DECISIONS = NONE（OPEN-1 已于 review R1 钉死，见 §6）
PARTIAL_SUPERSESSION = NONE (对 SCHEDULER_TIMEOUT_OUTCOME_V1 / CONTROL_PLANE_RELIABILITY_V1 为纯政策层叠加，见 DEC-004 §7)
CONTRACT_COUNT = 18
CONTRACTS_WITH_ACCEPTANCE = 18 contracts, all covered by 13 ACC entries
```

---

## 1. Goal

消除 2026-10 月爆发的「投递韧性」缺陷类，使任何单次子进程传输故障不造成用户消息丢失、不造成调度任务无限期停摆，并以运行时内建机制替代 2026-10-29 部署的两个外部 stopgap 守护。

非目标：不改变 admission 语义（#554 另行治理）、不触碰 websearch 毒化（#550）、不修改 identity 收敛计划（#83）。

---

## 2. State（OBS / CLM / EVD）

### 2.1 Observations

```text
OBS-001 subject=生产 runtime (authsvc, port 8788)
  source=/Users/authsvc/.agent-core/logs/runtime.err.log（全量 92437 行）
  observed_at=2026-10-29 17:40~18:00 CST；method=逐行解析 tsWallMs
  result=stop:post_admission_failure 共 220 行；按天分布：10-01 起 2 条/日低水位，
         10-12/13 跳升（20/22 条），10-19 起 10~30 条/日持续；agent 归因：
         hr-agent 10-21~10-27 每日 8~30 条占绝对多数；shopping-list-agent 10-24 起出现
  provenance=agent-control#1332 正文

OBS-002 subject=agt_shopping-list-agent 群投递
  observed_at=2026-10-29 15:21:48 CST
  result=fresh spawn pid=83349 (1347ms) 后立即群投递 → attemptOutcome=stop:post_admission_failure，
         attempt 与 final 间隔 3ms（连接级即时失败）；同 pid 15:32:42 经 Product API 探测 turn 成功
  provenance=agent-control#1332 实验表

OBS-003 subject=同 pid 再现
  observed_at=2026-10-29 15:48:45 CST
  result=pid 83349（无新 spawn，日志 92304→92320 之间无 ready 行）群投递再次
         stop:post_admission_failure（3ms）；16:04 kill 83349 → 新 pid 2305 probe 成功（ok3）；
         5s 后 probe 失败 → 「一代进程 ≈ 一轮可服务 turn」确定性复现两代（83349、2305）
  provenance=agent-control#1332 实验表 + issue comment 6491424895

OBS-004 subject=子进程 socket 状态
  observed_at=2026-10-29 15:57 / 17:0x CST；method=sudo lsof -p <pid>
  result=卡死 pid（83349）TCP+UNIX socket 计数为 0；但随后对全部 11 个 idle harness 子进程
         采样（含持续健康的 daily-thought pid 24710）socket 计数同为 0
  provenance=agent-control#1332 comment 6491424895

OBS-005 subject=v2 看门狗 kill-loop
  observed_at=2026-10-29 17:21~17:24 CST
  result=「10 分钟失败窗口」策略导致 36745、37783 均在 49s 龄被杀，其中一次正值用户
         turn 处理中 → 用户可见错误「generation 28 exited (SIGKILL) without an exact
         parsed outcome」；该 turn 以 stop:outcome_unknown 收场
  provenance=agent-control#1332 comment 6491424895 / 6492873267；turn-recovery-v3.json
         gen28 s246 记录（initialSource=child_exit_without_parsed_outcome）

OBS-006 subject=18:43 用户消息 turn
  observed_at=2026-10-29 18:42:16~18:43:56 CST；source=turn-recovery-v3.json gen29 s256
  result=turn 正常启动（admitted、prompt_writeAttempted）→ caller 等待上限到达
         （hardDeadline = createdAt+100s）→ initialOutcome=outcome_unknown
         (caller_wait_exceeded) → coordinator reap (graceful_shutdown, exact_generation_reap)
         → settlement=late_completed，outcomeEvidence=exact_turn_end_success——
         turn 实际跑完且成功，回复因调用方已离开而丢弃
  provenance=turn-recovery-v3.json + agent-control#1332

OBS-007 subject=调度器 fence 积压
  observed_at=2026-10-29 19:19 CST；source=/Users/authsvc/.agent-core/scheduler/jobs.json
  result=43 条 state=outcome_unknown 未决 occurrence；19 个 job 挂 fence；最老 admittedAt
         2026-08 初；每 tick policy skip 静默失效。fence 语义=rebuildFences(occurrences)：
         state=outcome_unknown 且无 lateSettlement/terminationSettlement 即 fence
  provenance=packages/scheduler/src/occurrence-model.js:58-62,365-381

OBS-008 subject=证据化结算有效性
  observed_at=2026-10-29 19:20 CST
  result=按证据规则经官方 agentcore-cron reconcile 结算 41+3=44 条（succeeded：exact_turn_end_success；
         failed：exact_turn_end_failure / child_real_exit / 无登记记录）→ 0 错误，fences 19→0
  provenance=fence-janitor.log + operator-receipts.jsonl；agent-control#1332 comment 6521433613

OBS-009 subject=router 投递实现
  observed_at=2026-10-29；source=packages/agent-router/src/process/*（main @e9699aee）
  result=router↔子进程为 newline-delimited JSON-RPC stdio 通道；无传输健康探测/重生逻辑；
         失败路径 attemptIndex=0、fallbackActivated=false，turn 一次性丢弃
  provenance=agent-control#1332；route-chain 日志字段
```

### 2.2 Claims

```text
CLM-001 卡死（wedge）是子进程内部 provider 传输失效：一轮 turn + idle 之后，后续 turn 的
  provider 调用连接级失败；确切内部机制（harness provider 层 / dsh-codex 插件 / codex
  app-server 生命周期）尚未定位。 support=INFERRED（OBS-002/003/005 支持「存在于子进程内」；
  内部机制 OPEN，故 CTR-H2 规定根因调查为实现义务）

CLM-002 router 以 pid 存活近似可投递性：无传输级健康探测；传输死亡后持续复用直至外部干预。
  support=SUPPORTED（OBS-003/005、OBS-009 源码阅读）

CLM-003 caller 等待上限（观测样本 100s）对慢 turn（大会话 replay、联网检索类内容）偏短，
  产生「回复已生成但被静默丢弃」的用户可见故障形态。 support=SUPPORTED（OBS-006）

CLM-004 调度 fence 的保守设计（outcome_unknown → fence → HUMAN_REQUIRED）在无处置节拍时
  积压为长期静默失效；证据化结算可安全解锁且经官方通道可审计。 support=SUPPORTED
  （OBS-007/008）

CLM-006 方法学：子进程 socket 存在性不能判别卡死状态（idle 健康与卡死子进程计数相同），
    故健康/就绪判据的应用层信号要求规范化为 CTR-R1（此处仅作方法学判断）。 support=SUPPORTED（OBS-004）

CLM-005 外部 stopgap（transport-watchdog v3、fence-janitor）为错误层级的补救：依据日志文本
  推断进程状态并 kill（watchdog），或以外部脚本承载本应内建的清算政策（janitor）。
  其自身缺陷已在 2026-10-29 造成两次用户可见事故（v1 永久跳过、v2 kill-loop）。
  support=SUPPORTED（OBS-004/005；agent-control#1332 comment 序列）
```

### 2.3 State projection

```text
STATE-001 生产交付链（2026-10-29 晚，main @e9699aee + 生产部署 + 两个外部守护）：
  - 投递层：存在一代进程 ≈ 一轮可服务 turn 的卡死类（CLM-001），router 无健康探测（CLM-002），
    消息静默丢失由外部看门狗兜底（CLM-005）；
  - 回复层：>100s 的 turn 成功后回复被丢弃（CLM-003）；
  - 调度层：fence 积压已清零（OBS-008），自动清算由外部脚本承载（CLM-005）。
  坐标：deployed runtime=authsvc 8788；source=main @e9699aee；观测时间=2026-10-29 CST。
```

### 2.4 Evidence relations

```text
EVD-001 source_observations=[OBS-001] target=CLM-001 relation=SUPPORTS
        strength=分布形态与 turn 频率强相关（hr 定时任务密度 ↔ 失败密度）；limits=非机制证明
EVD-002 source_observations=[OBS-002,OBS-003] target=CLM-001 relation=SUPPORTS
        strength=确定性复现两代进程；limits=内部机制未定位
EVD-003 source_observations=[OBS-004] target=CLM-006 relation=SUPPORTS
        strength=健康与卡死子进程 socket 计数相同（均为 0），直接支持方法学判断；
        对 CTR-R1 构成硬约束：探测 MUST 用应用层信号，不得用 socket 存在性
EVD-004 source_observations=[OBS-006] target=CLM-003 relation=SUPPORTS strength=完整登记链
EVD-005 source_observations=[OBS-007,OBS-008] target=CLM-004 relation=SUPPORTS strength=全量清账 0 错误
EVD-006 source_observations=[OBS-005] target=CLM-005 relation=SUPPORTS strength=同日两次事故
```

---

## 3. Decisions

```text
DEC-001 owner=mayf3（2026-10-29 会话授权，agent-control#1332）
  selected=router 内建传输健康探测 + 死亡重生 + 有界退避重试 + 死信语义（CTR-R1..R5）
  rejected=维持外部日志扫描看门狗——错误层级、依赖日志格式、v1/v2 已两次事故（EVD-006）
  rejected=仅退避重试不重生——卡死类进程重试必败（OBS-003 同 pid 3ms 即时失败）

DEC-002 owner=mayf3（同上）
  selected=harness 侧以「可服务性」为生命周期义务：保持 provider 传输跨 idle 可用、
    或下一 turn 时确定性重建，无法重建则必须退出让 router 重生（CTR-H1..H3）；
    且 wedge 内部机制根因调查为实现前置义务（CTR-H2）
  rejected=只修 router 不修 harness——把每条消息变成一次重生 + 大会话全量 replay，
    首响劣化不可接受

DEC-003 owner=mayf3（同上）
  selected=caller 等待上限按 surface/agent class 可配置 + 超时后 late settlement 的回复
    可送达时补投一次、否则死信可检索 + 群侧明示（CTR-W1..W3）
  rejected=维持静默丢弃——18:43 案例（OBS-006）回复已生成却被丢弃，为用户直接投诉点

DEC-004 owner=mayf3（同上）
  selected=调度器内建证据门控 auto-reconcile 政策（CTR-S1..S5），取代外部 fence-janitor。
    政策对 SCHEDULER_TIMEOUT_OUTCOME_V1 为政策层叠加：occurrence 仍走 D-007 结算
    通道（unknown never terminal 不被触碰——本政策结算的是「带证据的确定性结局」，
    不是把 unknown 定为终态）
  rejected=维持全量 HUMAN_REQUIRED——2026-08 起积压 19 fence/43 unknown 已证明
    无人节拍即静默失效（OBS-007）
  amendment_anchor=已于 review R1 钉死（结论见 §6 OPEN-1）：无需对任何 repo 权威做
    amendment，政策层经父权威自身让渡条款合法叠加。

DEC-005 owner=mayf3（同上）
  selected=两个外部守护按 CTR-X1/X2 于对应 Contracts 生产验证后同版本退役，
    过渡期内并行运行
  rejected=立即下线——根因未落地前撤走兜底等于恢复静默丢消息
```

---

## 4. Contracts

### 4.1 Router delivery resilience

```text
CTR-R1 首轮投递就绪探测
  router 对新 spawn / 重生 child 的第一次 turn 投递前，MUST 通过应用层探测确认
  turn-transport 可服务（成功握手或等价就绪信号），MUST NOT 以 pid 存活或
  socket 存在性作为判据（EVD-003 否定后者）。
  Negative：child 永不就绪 → 探测超时 → 走 CTR-R2 重生路径，不得投递失败一次了事。

CTR-R2 传输死亡重生 + 有界重试
  admission 后发生连接级投递失败（refused/reset/超时类）时，router MUST 重生 child
  并以指数退避重试（≥2 次），全程对调用方单次请求语义不变。
  Negative：重试次数耗尽才允许失败外露；禁止 attemptIndex=0 即弃。

CTR-R3 死信与重发语义
  重试耗尽后：(a) 该消息 MUST 落入可检索 dead-letter 记录；(b) 入口侧（如飞书群）
  失败提示 MUST 明确携带「请重发」语义；(c) 禁止静默丢弃。
  （现行为违反本条：群内提示无重发语义、无死信。）

CTR-R4 坏进程不复用
  传输探测失败或投递连接级失败的 child generation，在通过新一轮探测前 MUST NOT
  被后续投递复用；router MUST 以重生替代复用。

CTR-R5 交付失败可观测
  每次投递失败 MUST 归类为结构化类别（transport_death | caller_bound_exceeded |
  child_exit_without_outcome | other）并进入可告警计数（与 #1257 投递阻塞告警同层）；
  类别 MUST 可从日志/指标独立复算（不得只存在于日志正文散文中）。
```

### 4.2 Harness provider-transport lifecycle

```text
CTR-H1 idle 后可服务性
  harness child 完成一轮 turn 进入 idle 后，其 provider transport MUST 保持对下一轮
  turn 可用，或在下轮 turn 时确定性重建并在探测窗口（CTR-R1）内就绪；无法就绪的
  child MUST 主动退出（使 router 重生），MUST NOT 以僵死状态驻留。

CTR-H2 根因调查义务
  wedge 内部机制（CLM-001 标注 OPEN 的部分：harness provider 层 / dsh-codex 插件 /
  codex app-server 三层中 idle 后传输死亡的确切层次）MUST 在 CTR-H1 标记 satisfied 前产出书面调查记录
  （docs/investigations/，含复现最小化与定位结论）；无记录不得声明 H1 完成。

CTR-H3 多轮回归面
  MUST 存在自动化回归：同一 child 连续 ≥3 轮 turn（含 idle 间隔）全部成功；
  以及「child 拒绝服务 → router 重生 → 调用方单次请求语义不变」的注入测试。
```

### 4.3 Caller wait bound 与 late outcome

```text
CTR-W1 等待上限可配置
  caller 等待上限 MUST 按 surface/agent class 可配置（默认值保持现行为并在配置文档
  记录）；观测样本默认 100s（OBS-006）。

CTR-W2 late 回复补投
  turn 在 caller 上限后 settle 且 outcomeEvidence=exact_turn_end_success 时：
  (a) 目的地仍可接受（如飞书原话题）→ MUST 补投一次回复，并附「（补投）」标记；
  (b) 不可投递 → MUST 落入可检索记录并触发 CTR-R5 计数；静默丢弃 MUST NOT 是唯一路径。

CTR-W3 outcome_unknown 的入口可见性
  任何 stop:outcome_unknown MUST：(a) 走既有 reconciliation（D-007：unknown never
  terminal）；(b) 向入口 surface 通知「该轮结果未证实，稍后随结算补投或请重发」，
  与 CTR-W2 的结算钩子衔接。
```

### 4.4 Scheduler fence auto-reconcile（政策层）

```text
CTR-S1 内建政策通道
  scheduler MUST 提供内建、操作者可配置的 fence auto-reconcile 政策；其结算 MUST
  经与操作者 CLI 完全相同的 settlement 路径（CONTROL_PLANE_RELIABILITY_V1 的单变更
  语义），产出同等 durable receipt。

CTR-S2 政策门（冻结）
  仅 recurring 任务（schedule.kind != 'at'）可自动处置；一次性任务恒 HUMAN_REQUIRED。
  证据→决定映射（互斥、穷举、其余一律不动作）：
    outcomeEvidence=exact_turn_end_success            -> succeeded（不重跑）
    outcomeEvidence=exact_turn_end_failure            -> failed（下个 slot 重跑）
    lateOutcome=terminated_without_outcome（AMENDMENT_1：先于含糊兜底评估；该形态由
      restart-quiescence 启动恢复写入且无 outcomeEvidence，重跑安全）-> failed（下个 slot 重跑）
    terminationEvidence=child_real_exit，或权威 turn 登记册（turn-recovery registry，从属于
      D-007 的 durable occurrence authority 及其保留语义）中无该 occurrence 记录 -> failed（下个 slot 重跑）
    其他一切                                          -> 不动作，留人工

CTR-S3 审计身份
  自动动作的 receipt actor MUST 为机器身份（如 system:fence-auto-reconcile），与人类
  操作者可区分；动作 MUST 追加至有界历史日志。

CTR-S4 默认关闭
  政策 MUST 默认 OFF；启用为显式 owner/操作者配置动作。外部 fence-janitor 现行政策
  必须可被 CTR-S2 精确表达（作为政策等价性验收）。

CTR-S5 与 D-007 的相容性
  auto-reconcile 仅按 CTR-S2 的证据形态结算 occurrence；MUST NOT 在无冻结证据形态时
  将任何 unknown 置为终态（unknown never terminal 不被本政策削弱）。
```

### 4.5 Stopgap retirement

```text
CTR-X1 transport-watchdog 退役
  CTR-R1..R5 取得生产验证证据（ACC-R 组）的同版本内，外部
  /Library/LaunchDaemons/ai.agent-core-transport-watchdog 守护与脚本 MUST 被移除；
  此前过渡期内两者并行，watchdog 的每次动作 MUST 继续留痕于其历史日志。

CTR-X2 fence-janitor 退役
  CTR-S1..S5 实现且政策启用（含政策等价性与 ACC-S3 不变量验收）后，外部
  /usr/local/libexec/agent-core/scripts/fence-janitor.py 与其守护 MUST 被移除。
```

---

## 5. Acceptance mapping

```text
ACC-R1 CTR-R1,R4  单测：注入「永不就绪 child」→ 首轮投递不发生、走重生；注入「就绪后
       拒服务 child」→ 复用被拒。证据：PR 内测试 + 生产日志无同 pid 二次连接级失败
ACC-R2 CTR-R2    单测：连接级失败注入 → ≥2 次退避重试且每次针对重生 child；调用方单次
       请求语义不变（最终成功或最终失败，无中间态外泄）
ACC-R3 CTR-R3    单测：重试耗尽 → dead-letter 记录存在 + 入口提示含重发语义；生产证据：
       无静默丢失（每条失败消息可在死信或补投中找到）
ACC-R4 CTR-R5    观测：四类计数可从指标复算；告警阈值生效（注入演练）
ACC-H1 CTR-H1,H3 单测：≥3 连续轮（含 idle 间隔）全成功；僵尸注入 → child 自退出
ACC-H2 CTR-H2    文档：docs/investigations/ 根因记录（定位 + 最小复现 + 修复映射）
ACC-W1 CTR-W1    配置：per-class 覆盖生效（慢类 agent 上调后 100s 边界案例不再超时）
ACC-W2 CTR-W2,W3 生产证据：复放 18:43 形态（人为制造 >100s turn）→ 回复补投或死信可检索
       + 入口通知；沉默丢弃零发生（连续 7 天生产观测）
ACC-S1 CTR-S1,S3 单测：政策结算走 CLI 同路径、receipt actor=机器身份、历史日志追加
ACC-S2 CTR-S2,S4 政策等价性：以 fence-janitor 2026-10-29 全量台账（44 决策）回放新政策，
       决策逐条一致（含 AMENDMENT_1 第五行）；`at` 任务与含糊证据恒不动作；默认 OFF
ACC-S3 CTR-S5    单测：无冻结证据形态的 unknown 不可被政策置为终态
ACC-X1 CTR-X1    发布清单：watchdog 卸载命令执行 + 其历史日志归档至 docs/evidence/
ACC-X2 CTR-X2    发布清单：janitor 卸载命令执行 + 台账归档至 docs/evidence/
```

---

## 6. Authority & lifecycle pass

```text
PARENT_PRECEDENCE = OK（D-007 / CONTROL_PLANE_RELIABILITY_V1 / TIMEOUT_OUTCOME_V1
  全部保留；本 spec 为 router/harness 交付韧性的创始权威 + scheduler 政策层）
EXTERNAL_OWNERSHIP = OK（svc-workflow 语义归其仓库 spec；#550/#554 不被本 spec 触碰）
PARTIAL_SUPERSESSION = NONE（DEC-004 为政策叠加；对现行 HUMAN_REQUIRED 规则为显式
  amendment，锚点见 OPEN-1，钉死前实现不得修改该原文）
BACKLINKS = agent-control#1332（证据权威）⇄ 本 spec
ID_REUSE = NONE（CTR-/OBS-/CLM-/EVD-/ACC- 均为本 spec 首发编号）
PROGRAM_TO_CHILD_LEAP = NONE（实现授权仅 contracts，逐 PR 落地）

OPEN-1（已于 review R1 钉死，2026-10-30）：DEC-004 amendment anchor 核查结论——
  「termination-only fence 处置」原文位于 operator 主目录运维技能
  （~/.agents/skills/cron-helper/SKILL.md v4.1.0，规则行 242/语义行 171-180），
  非 repo accepted 权威；repo 规范层依据为 SCHEDULER_TIMEOUT_OUTCOME_V1 C-003 与
  D-007 §8.3 的显式政策让渡条款 + CONTROL_PLANE_RELIABILITY_V1 单变更/reconcile 语义。
  结论：DEC-004 无需对任何 repo 权威做 amendment，政策层经父权威自身让渡条款合法叠加；
  与 PARTIAL_SUPERSESSION=NONE 相容。实现无需修改任何既有权威文本。
```

## 7. Syntax pass

frontmatter 字段集与仓内 accepted 先例（SCHEDULER_TIMEOUT_OUTCOME_V1 /
SCHEDULER_CONTROL_PLANE_RELIABILITY_V1）一致（spec_id/status/date/type/scope/
out_of_scope/references/implementation_authority/parent_authorities + review 记录位）；
未采用 SPEC_FORMAT_V0 全字段集（spec_kind/authority_level/governed_by/owners/
supersedes 等——该协议文本为本工作区 vendored 参考，非本 repo 树内文件）。编号原语
OBS/CLM/EVD/STATE/DEC/CTR/ACC 均带稳定 ID；无编号重排/复用。syntax pass ≠ semantic
acceptance。

---

## 8. Implementation PR 边界（本 spec 之下）

```text
PR-A router：CTR-R1..R5（含 CTR-R5 观测面）
PR-B harness：CTR-H1..H3（前置：CTR-H2 调查记录合入）
PR-C caller bound：CTR-W1..W3
PR-D scheduler：CTR-S1..S5（政策默认 OFF；启用配置单列）
PR-E retirement：CTR-X1..X2（生产验证后执行并归档证据）
```

---

## 10. Acceptance record

```text
ACCEPTANCE_DATE = 2026-10-30
ACCEPTED_HEAD = 8cf2c23a（final-head binding；此后任何语义变动需新评审）
REVIEW_TRAIL = R1 REVISE/3（G1 计数 14→18、G2 X2 前置补 S5、G3 §0 矛盾）
             → R2 REVISE/1（G-3 声称已修未落文——r2 修复 8cf2c23a 落文并经复核）
             → R3 PASS（机械复核，diff 4 hunks 零回归）
ACCEPTANCE_MODE = owner-delegated in-session（授权语：「那你自己推进」，2026-10-30）
IMPLEMENTATION = 按 §8 PR-A..PR-E 逐 PR 启用；IMPLEMENTATION_ALLOWED 由本 acceptance 解锁
STOPGAP_STATUS = transport-watchdog v3 与 fence-janitor 继续在岗至 CTR-X1/X2 退役条件达成
```
