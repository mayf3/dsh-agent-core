---
spec_id: AGENT_PROCESS_ADMIN_TURN_ABANDONMENT_V1
status: accepted
date: 2026-09-29
accepted_date: 2026-09-29
accepted_by: mayf3
accepted_at: 2026-09-29T13:35:00Z
accepted_reviewed_base: 0cb14b3706605de01496be857c9e7b325d86a730
accepted_reviewed_spec_commit: 0cb14b3706605de01496be857c9e7b325d86a730
accepted_reviewer_id: zcode-local-independent-spec-reviewer-r1/r2-lane/r3+r3b
acceptance_review_result: ACCEPT (r1 ACCEPT/0; r2-lane ACCEPT/CONFORMANT; r3 REVISE/1 -> fixed -> re-review ACCEPT/0)
semantic_delta_after_review: "ACTIVE_CAP_TOMBSTONE_R2 — C1 declaration-budget sentences, C4 and the §3 32-cap acceptance line amended per Owner semantic ruling 2026-09-29 (PR #371 comment 5893014622, resolving agent-control#86 Finding 1 via Option A); the 2026-09-29T13:35:00Z ACCEPT covers reviewed head 0cb14b37 only and NOT this head; fresh independent review of the ruling-replay semantic content is COMPLETE (PASS / LOAD_BEARING_GAPS=0, recorded in r2_replay_independent_review) and this exact head is NOT accepted-final until Owner acceptance re-approves it; status remains accepted because the lifecycle state machine forbids accepted->proposed regression — the delta is fenced by this field and by review_status until re-acceptance; composition: accepted main content (incl. the D6 r3 amendment, byte-preserved) + ruling delta + strict-YAML quoting of otherwise value-identical fields; the PR-branch's governed_by V0->V2 and external_authorities revision-pin corrections are deliberately NOT carried because validate_spec_transition.py treats governed_by/external_authorities as immutable accepted-authority fields (in-place mutation rejected) — recorded as follow-up debt for a governance-legal amendment vehicle; replayed from PR #371 head fa79c374 onto main 360756e3 (PR #370 then advanced main with broker-implementation-only deltas; this Spec's blob is byte-identical to its 51f47739 state, so the independently reviewed content carries unchanged)"
independent_review_result: ACCEPT (r1, pre-amendment)
independent_reviewer_id: zcode-local-independent-spec-reviewer-r1
independent_reviewed_head: 34f53cd7
independent_review_load_bearing_gaps: 0
independent_review_non_blocking_notes: section-heading normalization at/before acceptance; status enum wording; merge gate must hold until Owner acceptance; refuseUnDrainedExecution registrySnapshot capability hardening (FOLLOW_UP)
amendment_r3_independent_review: "REVISE / LOAD_BEARING_GAPS=1 (reviewer zcode-local-independent-spec-reviewer-r3; gap = marker stamp and decision audit were two separate durable transactions, crash between them left a stamped record without its decision audit and no authorized backfill path) — FIXED: marker + owner-decision audit now land in ONE atomic mutateRecord at both stamp sites (shared stampCandidate bounding helper), plus a D6 semantic negative test (the flag never admits STARTUP/REAP/live). Fix re-review (zcode-local-independent-spec-reviewer-r3b, head 6c5a1953): FIX_REVIEW_RESULT ACCEPT / GAPS_REMAINING=0 — single-mutation semantics verified at both stamp sites, bounding identical to appendAudit, durable validator unaffected, STARTUP negative probe correct. Independent review trail complete: r1 ACCEPT/0, r2 lane ACCEPT/CONFORMANT, r3 REVISE/1 -> fixed -> re-review ACCEPT/0."
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
scope:
  - mayf3/dsh-agent-core
  - "exactly one authenticated administrator turn-abandonment entry for the one
    target Agent agt_hr-agent: an admission-only unblock of NEW requests after
    the Owner-designated CTO explicitly abandons a stuck unresolved turn; the
    old record is never settled, never deleted, never replayed and its business
    result stays UNKNOWN (single bounded contract surface; independent review
    round 1)"
governed_by:
  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0
external_authorities:
  - repository: mayf3/dsh-agent-core
    authority_id: AGENT_PROCESS_LIFECYCLE_HARDENING_V4
    relation: depends_on
  - repository: mayf3/dsh-agent-core
    authority_id: AGENT_CORE_WORKFLOW_ADMIN_AGENT_BOOTSTRAP_V1
    relation: depends_on
supersedes: []
superseded_by: null
owners:
  - mayf3
type: admin-recovery-entry-contract
review_status: INDEPENDENT_REVIEW_COMPLETE_AWAITING_OWNER_ACCEPTANCE
r2_replay_independent_review: "PASS / LOAD_BEARING_GAPS=0 (reviewer zcode-local-independent-reviewer-20260930; reviewed head 70f746bb5425f375af1a3fa3df9083a9fd4b2d82, reviewed spec blob 800a8c2f; the reviewed semantic content is byte-identical at this head — replay base advanced 51f47739 -> 360756e3 via PR #370 which touched only broker implementation files with zero spec/governance delta; review record mayf3/agent-control#94; Owner re-acceptance still pending)"
acceptance_provenance: Owner directive 2026-09-29 「我要的是尽快恢复」 answering the sole pending acceptance item after the complete review trail; product decisions D1-D5 are the Owner takeover-brief words verbatim, D6 the Owner same-day directive「若仍会被拒绝，就继续解决这个实际缺口…」; recorded by the supervising session on the Owner's behalf with this provenance, nothing self-invented beyond the cited instructions
owner_intent_provenance: "direct Owner instruction 2026-09-29 (HR_RESET_AND_RESUME_V1 takeover brief — 管理员明确放弃当前卡住的旧任务后可以继续执行新任务；旧结果保留 UNKNOWN；不重放旧请求；同一幂等重置不得作用于后来任务；取消/超时/进程重启复用同一条恢复路径; plus direct Owner control directives #70/#72 2026-09-29 — entry bound to the exact canonical CTO machine identity, fail-closed lifecycle evidence gate, smallest-possible authority surface; plus direct Owner takeover-round directive 2026-09-29 — 「若仍会被拒绝，就继续解决这个实际缺口，不要把一个仍不能处理当前故障的版本报告成只等授权上线」, freezing D6: the uncollectable-evidence restart-lost class is resolvable only via the CTO's explicit risk acceptance at the authorized entry, recorded as a decision and never as evidence; plus Owner semantic ruling 2026-09-29 (PR #371 comment 5893014622, resolving agent-control#86 Finding 1 via Option A) — the 32 cap binds ACTIVE/in-flight declaration state only, completed declarations compact to permanent tombstones preserving exact declarationId→agentId binding, idempotent permanent no-op retry, and declaration_conflict on cross-Agent reuse; no broader recovery redesign or production authority granted)"
references:
  - docs/specs/AGENT_CORE_WORKFLOW_ADMIN_AGENT_BOOTSTRAP_V1.md (accepted; OBS-WA-008 records the canonical CTO machine identity agt_cto-agent / principal 4e5a4578-0645-4133-bd35-b80e453dfee9)
  - docs/evidence/workflow-recovery-stage-f-20260822/identity-cto.json (accepted-repo auth-service machine-identity receipt for the same pair)
  - ".agents/local/README.md (accepted local governance: recovery-first; an authorized recovery keeps the outcome_unknown record honest and must prove old worker/tool termination or isolation, or keep the fence)"
  - docs/specs/AGENT_PROCESS_LIFECYCLE_HARDENING_V4.md lineage (reconciliation
    store, settle-once, restart recovery state machine and the C-015
    termination-evidence vocabulary this contract composes onto; V4 is the
    accepted whole-successor that supersedes AGENT_PROCESS_LIFECYCLE_HARDENING_V3
    and carries that lineage bindingly — independent review round citation
    correction, contracts C1–C5 unchanged)
---

# AGENT_PROCESS_ADMIN_TURN_ABANDONMENT_V1 — 管理员放弃卡死 Turn 的准入恢复契约

> **ACCEPTED AUTHORITY 语义增量候选（Owner semantic ruling amendment）/ DOCS-ONLY /
> SPEC ONLY — 本轮不执行任何运行时动作、不改任何实现文件。本 exact head 未被下述
> 验收涵盖；针对本语义增量的 fresh independent review 已完成（PASS /
> LOAD_BEARING_GAPS=0，记录见 frontmatter `r2_replay_independent_review`），在本
> head 获得 Owner 重新验收之前**不是** accepted-final（见 r2 状态）。**
>
> **Owner semantic ruling（2026-09-29，PR #371 comment 5893014622，resolve 独立
> 评审 Finding 1 = Option A，评审记录 mayf3/agent-control#86）**：32 上限只作用于
> **活跃/在途**声明状态，不是生命周期历史总量；声明完成（含空/no-op 完成）即压缩为
> **永久墓碑**——保留精确 `declarationId → agentId` 绑定、幂等重试为永久 no-op 且
> 永不捕获后来任务、跨 Agent 重用 → `declaration_conflict`；已完成声明不占活跃容量，
> 后续合法恢复始终可达。既有 target/identity/evidence/no-replay 边界全部不变；本裁决
> 不授予更广的恢复重设计或生产权限。
>
> **现行 Owner acceptance receipt（2026-09-29T13:35:00Z；仅涵盖 reviewed head
> `0cb14b3706605de01496be857c9e7b325d86a730`，不涵盖本 head）**：reviewed Spec head
> `0cb14b37`（main 接受记录 commit `bab2ddd0`，经 PR #369 merge `51f47739` 交付）；
> review trail r1 ACCEPT/0（`zcode-local-independent-spec-reviewer-r1` @ `34f53cd7`）
> → r2-lane ACCEPT/CONFORMANT（`zcode-local-independent-review-lane-2`；其前次
> 2026-09-29T12:54:00Z receipt 仅涵盖 `cd95aca2`，PR #369 comment 5890713360，评审记录
> mayf3/agent-control#76）→ r3 REVISE/1 → fixed（`6c5a1953`）→ r3b re-review
> ACCEPT/0；acceptance actor `mayf3`；acceptance provenance 见 frontmatter
> `acceptance_provenance`。
>
> **r2 状态（replay onto current main `360756e3`）**：本 head = 已验收 main 内容（含 D6 r3
> 修正，正文字节保留）+ Owner ruling 增量（仅 C1 声明预算句 / C4 / §3 32-上限验收
> 句）+ 严格 YAML 引号加固（scope / `.agents` reference /
> `owner_intent_provenance` / `amendment_r3_independent_review` 四处，字段值
> 逐字节不变）+ 生命周期元数据如实标注（`status` 维持 `accepted`——治理
> lifecycle 状态机禁止 accepted→proposed 回退；delta 由
> `semantic_delta_after_review: ACTIVE_CAP_TOMBSTONE_R2` 显式围栏；针对本语义
> 增量的 fresh independent review 已完成——PASS / LOAD_BEARING_GAPS=0，见
> `r2_replay_independent_review`，且评审对象的语义内容与本 head 逐字节一致：
> base 自 `51f47739` 前进到 `360756e3` 仅经 PR #370 的 broker 实现文件增量，
> 本 Spec blob 未变；本 head 在 Owner 重新验收前不是 accepted-final）。PR 分支曾带的
> `governed_by` V0→V2 与 `external_authorities` revision pins 两项机械修正**本
> head 不携带**：`validate_spec_transition.py` 将二者列为 accepted-authority
> immutable 字段，就地变更被拒（该两项在 PR 分支自身链上同样不通过
> ff68d3f7→abfdaba9 transition 校验），留作后续治理合法修订载体的 FOLLOW_UP
> 债。D1–D6 / C2 / C3 / C5 / N1–N3 / §4 与 C1 的授权、身份、目标钉死、
> closed-shape（含 `acceptUnprovenTerminationRisk?` 严格布尔）部分自
> `0cb14b37` 字节不变。Spec record 仅在 Owner 重新验收且合入 designated
> authority branch `main` 后以本语义成为 active repository authority；一切
> 验收均不授权 deploy/restart/sudo/credential mutation/live CTO recovery call
> （Owner receipt 明示排除），亦不越过 §4 的授权边界。

## 0. Owner 决策（冻结）

D1. 同一个软件持续可用：同一个 HR（`agt_hr-agent`）、同一个正常使用入口；
恢复不新建 Agent、不改业务身份、不重放旧请求。

D2. 管理员明确放弃当前卡死的旧任务后，该 Agent 必须能继续接受新任务。旧
任务的最终业务结果保持 UNKNOWN——不查清、不恢复、不冒充成功或失败；其
记录由系统永久保存，但不得永久占住该 Agent 的新请求准入。

D3. 授权主体是唯一指定 CTO（研发总监）角色的**当前规范机器身份**：
canonical agentId `agt_cto-agent` + Principal UUID
`4e5a4578-0645-4133-bd35-b80e453dfee9`（accepted OBS-WA-008 + authsvc 机器
身份 receipt；以 authsvc 可信验证结果为准）。身份必须来自既有 authsvc 验证
seam，不接受调用方自填身份字段；`workflow.admin` scope 单独不构成重置权。
只授权这一对身份：历史 OpenClaw 时代 scheduler fixture 里的
`cto-agent` / `3e2439d2-…` 旧对不获授权，不得并存。

D4. 同一重置操作以调用方提供的幂等 `declarationId` 绑定其**原始任务范围**；
重试只完成原始范围，绝不吸收操作完成后才出现的任务；响应丢失时查询或重试
同一 id，不换新 id。

D5. 后续取消、超时、worker 崩溃、controller 重启场景复用同一条恢复路径；
声明与范围跨重启持久。

D6.（Owner 决策，2026-09-29 接管轮）对 restart-lost 类——旧执行的终止观测
**永远无法补采**（owning controller 已丢失：既不会有 parent 退出观测，也
不存在可重放的 exact-generation recovery 主体）——授权入口上的 CTO 显式
声明携带 `acceptUnprovenTerminationRisk: true` 即构成 Owner 对残余风险的
**明确接受**（残余风险 = 旧 worker 终止未证明 + 已派发工具的服务端回声）。
该接受作为**决策**逐记录持久审计（audit kind
`owner_risk_acceptance_unproven_termination`），绝不伪装成终止证据：
`exitObservedAt` / `terminationEvidence` 不动，记录保持 fenced +
outcome_unknown + 不重放，效果仍然只作用于准入。缺省（不带该字段）保持
fail-closed 409。可识别执行（STARTUP / REAP / 活 READY 进程）**不可**经该
通道放行——它们有受控 cancel/shutdown 路径。

## 1. 契约

C1. **入口与授权**。`POST /agent-process/turn-abandonment`（body
`{agentId, declarationId, acceptUnprovenTerminationRisk?}`，closed shape，
可选字段出现时必须严格为布尔 `true`）与
`GET /agent-process/turn-abandonment?agentId=` 挂在既有 product-api HTTP
面，复用既有 `schedulerTokenVerifier`（authsvc RS256/JWKS）seam。每个请求
先过授权门：验证后 principal 必须同时精确匹配 D3 的 Principal UUID 与
agentId；其余一切（未认证、verifier 缺失、其他 workflow.admin 持有者、
UUID/agentId 单边错配、D3 旧身份对）零改动失败（401/403）。目标 `agentId`
钉死为 `agt_hr-agent`，其他目标在任何存储改动前 403。错误信封沿用
product-api 冻结的 `{error:{code,message}}`。声明预算：每个持久 store 内，
32 个不同 `declarationId` 的上限只作用于**活跃/在途**声明（已声明、原始范围
尚未全部盖标）状态，不是生命周期历史总量；声明一经完成（原始范围内全部句柄
已盖标，含捕获即空的 no-op 完成）即压缩为**永久墓碑**——保留精确
`declarationId → agentId` 绑定与完成终态、重试恒为无副作用 no-op（C4）、跨
Agent 重用同一 id → 409 `declaration_conflict`——墓碑不占活跃容量，因此后续
合法恢复不因历史声明数量而不可达。活跃/在途声明达 32 → 新声明 409
`abandonment_capacity_exhausted`（既有 id 的幂等重试永远可用，含墓碑 id）。

C2. **执行冲突门（管理员声明 ≠ 退出证据）**。任何存储改动之前，入口必须
确认目标 Agent 没有未证明终止的执行：
- 生命周期槽 STARTUP → 409 `startup_in_progress`；
- 生命周期槽 REAP → 409 `reaping_in_progress`；
- READY 且进程存活 → 409 `live_execution_present`（错误信息指名既有受控
  cancel/shutdown 路径）；
- 槽 EMPTY（包括 controller 重启后内存登记为空）时，若该 Agent 存在未放弃、
  fence 未清除的 stuck unknown fence 且**没有**持久退出/终止证据（记录无
  `exitObservedAt` 且无 `terminationEvidence`——即重启后
  `runtime_restart_ownership_unavailable` 的 restart-lost 类），→ 409
  `restart_lost_termination_evidence_unavailable`，错误信息指名既有受控
  restart-quiescence 证明 / exact-generation recovery 证据路径，并提示 D6
  的显式接受通道。**EMPTY 不是 drained**；
  - **D6 通道**：同一 CTO 权限下，请求携带
    `acceptUnprovenTerminationRisk: true` 时，该类放行；每个被盖标记录的
    审计追加 `owner_risk_acceptance_unproven_termination`（决策留痕，非
    证据伪造——`exitObservedAt`/`terminationEvidence` 不动，记录保持
    fenced + outcome_unknown + 不重放）。可识别执行（STARTUP/REAP/活
    READY）不经此通道放行；标志非严格 `true` → 400 零改动；证据查询能力
    缺失时该通道同样不可用（503，绝不默认放行）；
- 生命周期槽快照或退出证据查询能力缺失 → 503
  `liveness_verification_unavailable`，绝不默认放行。
持久 `child_real_exit` 证据（或受控 quiescence 证明结算）存在、或不存在
stuck fence 时，声明允许进行——合格场景必须真实可达成功，不允许恢复入口
只会拒绝。

C3. **效果只作用于准入；诚实记录**。通过门后，声明把该 Agent 当前符合准入
阻断投影（`initialOutcome=outcome_unknown`、fence 未清除、无放弃标记；含已
结算但 registry-cleanup 未完成而 fence 仍 active 的
`terminated_without_outcome` 记录）的全部句柄捕获为**原始范围**，先于任何
记录标记持久登记，然后逐条盖放弃标记。范围登记为双载体：声明 scope
registry 持久化在恢复 store 旁边的**独立 sibling 文件**（旧二进制从不读写
该文件，回滚/再升级不会搁浅未盖标范围；原子 temp+fsync+rename+目录 fsync，
闭合校验形状，畸形即整载失败关闭）；per-record 放弃标记随每条记录经受一切
持久往返。sibling 文件整体缺失时（pre-registry 时代），范围从 per-record
标记重建。放弃标记的唯一效果是 `admissionBlockerForAgent` 不再把这些记录
当作新请求准入闸；历史 fence 查询（`activeFenceForAgent`）不变且继续可查。
旧记录永不 settle（由声明）、永不删除、永不改写业务结果；caller correlation
保留——同 correlation 不能二次 mint（不重放）；迟到证据仍然只结算原句柄
并保留放弃标记。声明自身从不发送任何消息；新请求仍走用户正常入口。

C4. **幂等与范围绑定**。已知 `declarationId` 的重试只补齐原始范围内尚未盖标
的记录（部分写入/崩溃恢复），返回值区分新放弃（`abandonedHandles`）与补齐
（`completedHandles`）；把已知 `declarationId` 重绑到其他 Agent → 409
`declaration_conflict`。声明完成压缩为永久墓碑（C1）后：对墓碑 id 的重试是
**永久无副作用 no-op**——返回完成终态、永不复活捕获，操作完成后才出现的
unknown 永不被旧 id 吸收，须由新的显式声明处置；且因墓碑不占活跃容量（C1），
这类后续显式声明不因历史声明数量而被 409 `abandonment_capacity_exhausted`。
把墓碑 id 重绑到其他 Agent 同样 → 409 `declaration_conflict`。同一
declarationId 的重试是字节级幂等补齐，不重复副作用。

C5. **重启持久**。声明、范围与放弃标记跨 controller 重启存活；重启后无需
重新声明即可继续通过正常入口接受新请求。

## 2. 非目标

N1. 不重建完整 PDC 或全生命周期规范；不修改、不替代 fresh-lineage V4 受控
路径——证据**可补采**的旧执行（parent 退出观测、受控 quiescence 证明、
exact-generation recovery 均可达）仍须从该受控路径取得证据后才能被放弃；
D6 通道**只**适用于观测无法补采的 restart-lost 类，且其放行依据是 Owner
决策留痕而非任何终止证据。
N2. 不提供伪造退出证据、绕过身份校验或删除账本的路径；管理员声明不充当
终止证明。
N3. 不扩大到 `agt_hr-agent` 以外目标，不泛化为通用 RBAC 管理面，不新建
第二套恢复队列/账本。

## 3. 验收义务（conformance 最低集）

- 合法 CTO 经真实 HTTP 入口完成范围内重置；未认证 / 非 CTO 主体 /
  单边身份错配 / 目标越界均零改动拒绝（401/403/400）。
- EMPTY 且无退出证据拒绝（含重启后登记为空类，零改动）；带持久
  `child_real_exit` 证据或无 stuck fence 时真实成功；能力缺失 503。
- D6 通道：restart-lost 类缺省 409；携带严格布尔
  `acceptUnprovenTerminationRisk: true` 时真实成功且逐记录留下
  `owner_risk_acceptance_unproven_termination` 决策审计（退出/终止证据字段
  保持为空、记录保持 fenced + UNKNOWN）；非布尔值 400 零改动；retry 仍受
  原始范围绑定约束，不吸收后来任务。
- 同 `declarationId` 重试不作用于后来任务；部分失败与重启后同一操作续作；
  32 上限只计活跃/在途声明且真实；声明完成（含 no-op）即压缩为永久墓碑并
  释放活跃容量，墓碑重试为永久 no-op 且不吸收后来任务，跨 Agent 重用墓碑
  id → 409 `declaration_conflict`。
- controller crash 后：旧 worker 真实退出、旧记录保留 UNKNOWN + fenced +
  放弃标记、不重放（旧 prompt 仅一次）、无关 Agent 不受影响、同一 HR 同一
  入口完成新请求；迟到结果只结算原句柄。
- 实现面：`packages/product-api/src/agent-process-admin-routes.js`（挂载于
  `packages/product-api/src/index.js`）、
  `packages/agent-router/src/reconciliation/admin-abandonment.js`、
  `packages/agent-router/src/reconciliation/durable-file.js`（sibling
  registry）、`packages/agent-router/src/ingress-delivery.js`
  （`abandonPendingTurns`）。证据面：
  `packages/agent-router/test/process-lifecycle/admin-abandonment.test.js`、
  `packages/product-api/test/admin-turn-abandonment-api.test.js`、
  `scripts/availability-recovery/recovery.acceptance.test.mjs`。

## 4. implementation_authority: contracts

本 Spec 获 Owner 验收后，§1 契约即为该入口实现、测试与运维调用的充分授权
范围；契约外行为变化需要新的 AUTHORITY_ACTION。验收前的合并/部署/生产调用
不获本 Spec 授权。
