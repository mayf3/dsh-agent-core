---
spec_id: PRODUCTION_442_OPTIONAL_ADAPTER_EFFECT_BOUNDARY_V2
status: accepted
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
intended_implementation_authority_on_acceptance: contracts
authority_action: AMEND
date: 2026-11-04
repository: mayf3/dsh-agent-core
authoring_base: 97fa15a138e4aafe7d566fc3c3d387c3594e87ba
scope:
  - Startup-scoped optional capability effect boundaries and scheduler/WEC readiness classification for Product 442
governed_by:
  - AGENT_CORE_PRODUCT_ARCHITECTURE_V1
  - SCHEDULER_OCCURRENCE_OUTCOME_V3
  - SCHEDULER_TIMEOUT_OUTCOME_V3
external_authorities: []
supersedes: []
amends:
  - AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V2
  - SCHEDULER_WATCHDOG_ROUTING_AND_STUCK_OCCURRENCE_RECOVERY_V1
amended_clauses:
  - authority: AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V2
    clauses: [section 9 readiness-rejection consequence]
    effect: Optional channel failure closes its ingress and effects; gate-before-live order is preserved
  - authority: SCHEDULER_WATCHDOG_ROUTING_AND_STUCK_OCCURRENCE_RECOVERY_V1
    clauses: [CTR-READY-001, CTR-HEALTH-001, DEC-004]
    effect: Separate execution-safety startup refusal from diagnostic-only incompleteness; complete retains full diagnostic meaning
reaffirms:
  - AGENT_CORE_SCHEDULER_RUN_HISTORY_V1 R-H1
replaces_proposed_text:
  authority: PRODUCTION_442_OPTIONAL_ADAPTER_STARTUP_ADMISSION_V1
  coordinate: https://github.com/mayf3/dsh-agent-core/issues/441#issuecomment-5979798642
  effect: Replaces only an unaccepted comment proposal, not accepted Product Authority
superseded_by: null
owners: [mayf3]
owner_rulings:
  - https://github.com/mayf3/dsh-agent-core/issues/441#issuecomment-6622749231
semantic_source:
  url: https://github.com/mayf3/dsh-agent-core/issues/441#issuecomment-5981626118
  sha256_utf8_no_added_trailing_newline: 4be014c2d673688221056881246bd4dfd85e6194dd9d6c99cbd72e9991f89e0f
product: https://github.com/mayf3/dsh-agent-core/issues/442
references:
  - docs/specs/AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V2.md
  - docs/specs/SCHEDULER_WATCHDOG_ROUTING_AND_STUCK_OCCURRENCE_RECOVERY_V1.md
  - docs/specs/AGENT_CORE_SCHEDULER_RUN_HISTORY_V1.md
  - docs/decisions/SCHEDULER_OCCURRENCE_OUTCOME_V3.md
  - docs/specs/SCHEDULER_TIMEOUT_OUTCOME_V3.md
  - docs/specs/AGENT_DELIVERY_RESILIENCE_D009_ALIGNMENT_V1.md
---

# PRODUCTION_442_OPTIONAL_ADAPTER_EFFECT_BOUNDARY_V2

## A. Goal, scope and authoring route

本文件将 [V2 全文](https://github.com/mayf3/dsh-agent-core/issues/441#issuecomment-5981626118)
及 [Owner ACCEPT](https://github.com/mayf3/dsh-agent-core/issues/441#issuecomment-6622749231)
落为 #442 的 docs-first 接受载体，关闭 B442-01 的文档差额。目标行为是 optional
capability 失败只关闭该能力的 ingress/effects；diagnostic-only incomplete 保持诚实诊断，
scheduler/workflow engines 仍启动；execution-safety authority 不可信仍在任何 engine 启动前拒绝。

本文件的语义载荷为附录中 **V2 §1–9 的逐字原文**，下文新 CTR/ACC ID 仅定位这些义务，
不增删其含义。V2 的历史元数据、§7/§10 的执行状态和 §11 的待接受措辞保留用于溯源；
当前接受状态以 B 节为准。附录的源码行号、测试行号及 PR #451 lineage 是其
2026-10-04 坐标，不能冒充本次 base 的实现或回归证据。

```text
SPEC_GOVERNANCE_MODE = AUTHOR
GOAL_OR_TARGET = Faithful docs/specs carrier and B442-01 authority reconciliation for #442
CURRENT_GAP = Owner text accepted; exact docs carrier/base activation not yet bound
AUTHORITY_ACTION = AMEND
PRIMARY_AUTHORITY = LARK V2 section 9 + watchdog CTR-READY-001/CTR-HEALTH-001/DEC-004
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = DURABLE
ROUTE_STAGE = AUTHORITY_AUTHORING
AUTHORITY_ACCEPTED_IN_BASE = NO (this new carrier)
DOCS_FIRST_REQUIRED = YES
EVIDENCE_NEEDED = Exact comment hashes, conflict crosswalk, semantic review, docs-only diff, remote PR readback
DONE_WHEN = Docs-only carrier and receipt pushed, PR referencing #442 open, no merge
EXPANSION_TRIGGER = Any V2 semantic deviation, new authority conflict, source or production effect
NEXT_REAL_ACTION = Independent review, then publish the docs-only PR for supervising acceptance
```

通常治理对 accepted failure semantics 的更改要求 whole-authority successor，AMEND
只允许不改变既有 accepted ID 原义的加法。本次按用户明确合同、Owner ACCEPT 与
[#610](https://github.com/mayf3/dsh-agent-core/pull/610) /
[#611](https://github.com/mayf3/dsh-agent-core/pull/611) 的既有流程，公开采用
**本任务特定的纠偏 AMEND**；不将它伪称为零语义加法，也不形成一般治理例外。
`supersedes: []` 表示没有整份 accepted Spec 的 lifecycle 替代。
`amends` / `amended_clauses` 才是本次局部变更的精确关系；两份旧 Spec 本体和其余
合同保留。V2 对未接受 V1 评论提案的替换另列于 `replaces_proposed_text`，
不把 proposed V1 伪记为被整份 supersede 的 accepted 权威。

## B. Acceptance record and #442 lifecycle

### B.1 Owner decision — recorded, not re-requested

来源作者 mayf3；created_at = updated_at = `2026-11-04T04:42:14Z`。
以下逐字保存 ACCEPT 评论 body；SHA-256 按 UTF-8、无额外末尾换行计算：
`710a46fa99118dad998f52d6116cac3bdebcce5b8079f24927c30023316bf4d0`。

<!-- OWNER-ACCEPT-BODY-BEGIN -->
## Owner 裁定（2026-11-04，会话内"全按建议"，监管代记）

**ACCEPT：PRODUCTION_442_OPTIONAL_ADAPTER_EFFECT_BOUNDARY_V2**（exact head `e9699aee`，#442 相关候选）。

按 #442 生命周期块生效：ROUTE_STAGE 从 AUTHORITY_AUTHORING 推进，IMPLEMENTATION_ALLOWED=NO 解除；
后续实现按既有 accepted authority + W2 波次推进，PROD_AUTH 仍 HOLD_POST_MERGE_REVIEW。
细节如实现中发现与本裁定冲突，走 AMEND 路由回本单，不静默偏离。
<!-- OWNER-ACCEPT-BODY-END -->

语义来源评论作者 mayf3；created_at = updated_at = `2026-10-04T15:31:25Z`；
坐标为 [#441 / 5981626118](https://github.com/mayf3/dsh-agent-core/issues/441#issuecomment-5981626118)。
其 body 共 111 行、19228 UTF-8 bytes，SHA-256 为
`4be014c2d673688221056881246bd4dfd85e6194dd9d6c99cbd72e9991f89e0f`；
附录逐字保存，不把本载体新增 frontmatter/接受记录的哈希冒充为该原文哈希。
来源标记之间最后一个换行仅分隔结束标记，不属于原始评论 body。

### B.2 Supervising acceptance/merge receipt — pending

```text
OWNER_TEXT_ACCEPTED = YES
OWNER_ACCEPT_COMMENT = mayf3/dsh-agent-core#441 / 6622749231
OWNER_ACCEPT_SHA256 = 710a46fa99118dad998f52d6116cac3bdebcce5b8079f24927c30023316bf4d0
V2_COMMENT = mayf3/dsh-agent-core#441 / 5981626118
V2_BODY_SHA256 = 4be014c2d673688221056881246bd4dfd85e6194dd9d6c99cbd72e9991f89e0f
OWNER_REFERENCED_HEAD = e9699aee6beb1d6811e3a77f0cb4c08088241348
OWNER_REFERENCED_HEAD_CARRIES_V2 = NO
CARRIER_STATUS = proposed
IMPLEMENTATION_AUTHORITY = none
INTENDED_IMPLEMENTATION_AUTHORITY_ON_ACCEPTANCE = contracts
SUPERVISING_REVIEWED_SEMANTIC_HEAD = UNKNOWN (to be bound by supervising receipt)
SUPERVISING_REVIEWED_DOCUMENT_SHA256 = UNKNOWN (to be bound by supervising receipt)
DOCS_DELIVERY_HEAD = UNKNOWN (final remote ref to be bound by supervising receipt)
CARRIER_PR = UNKNOWN (to be bound by supervising receipt)
CARRIER_MERGE_COMMIT = UNKNOWN
FINAL_ACCEPTED_HEAD = UNKNOWN
ACCEPTED_BY_RECORDING_ACTOR = UNKNOWN (authorized supervising acceptance record pending)
ACCEPTANCE_BASIS = Owner ACCEPT above; faithful carrier binding and integration pending
PROD_AUTH = HOLD_POST_MERGE_REVIEW
```

`e9699aee` 实测仅修改
`docs/investigations/WORKFLOW_ASSIGNEE_ADMISSION_GUARD_TEST_CLASSIFICATION_DESIGN_V1.md`，
树中没有 V2；不能把它声明为已验证的 V2 字节载体。本次明确的新载体及评论哈希
可供监管纠正该绑定；完成状态仍待监管回执，不回写或伪造旧 ACCEPT。

监管验收后，按本次交办代行接受合并，并绑定独立 reviewed semantic head、文档
SHA-256、最终 delivery head、PR/merge commit 和 accepted head；载体所记录的语义接受
追溯到上述 Owner ACCEPT，无需 Owner 重复 ACCEPT。随后才将本载体元数据改为
accepted/contracts，并令实现以包含该 accepted 记录的新 main 为 base 按 REUSE 接续。
本提交和 push/开 PR 本身不执行这些接受/合并动作。

[#442 Owner 回执 6622749713](https://github.com/mayf3/dsh-agent-core/issues/442#issuecomment-6622749713)
确认 Owner 层面的 implementation hold 已解除，W2 推进，生产 HOLD 保留；
旧 issue 正文 WAITING_OWNER/IMPLEMENTATION_ALLOWED=NO 只作旧投影，不否定该裁定。
但 V2 §11 的 docs/specs 先落盘和既有 accepted-base 条件仍须落实；本 authoring 任务
不据 Owner 门解除而越过当前 B442-01 的载体/base 差额。

#442 的 V2 源码实现、§7 回归、真实 entry/pack 依赖追踪和源码交付仍是后续工作；
PR #451 历史结构修复的 PASS 不证明 V2 已实现。SOURCE、INSTALLED、ENABLED、
BUSINESS_VERIFIED 保持各自证据边界。本任务不改 issue lifecycle、不合并、不安装、
不启用、不部署、不重启、不触碰生产 store/fence、不 replay UNKNOWN。

## C. B442-01 conflict crosswalk

来源为 `/private/tmp/dsh-442-impl/STOPPED-442.md`，SHA-256
`580c627b0b389972cc2562c46c3f656dab130895d9a710020fda2060ffce973e`。
V2 行号按原评论 body 的 splitlines() 从 1 开始；旧 main 行号固定于
`55d306a997c02fa57e41b815cc31362c66f9ee18`。本载体 authoring base 为其后代
`97fa15a138e4aafe7d566fc3c3d387c3594e87ba`；下列三份 affected Spec 和
health-runtime 在两坐标的字节相同，故不重推旧行号。

| 旧合同 / B442-01 坐标与原义 | V2 语义及 AMEND / 保留关系 | 接受锚点 |
|---|---|---|
| V2:11：amends_upon_acceptance 指向 LARK V2 §9 和 watchdog 三条款；main 尚无接受载体 | 本新稳定 ID 明示 AMEND 两份权威的指定范围，R-H1 只 reaffirm；无整份旧 Spec supersession | [V2:11](https://github.com/mayf3/dsh-agent-core/issues/441#issuecomment-5981626118)、[ACCEPT](https://github.com/mayf3/dsh-agent-core/issues/441#issuecomment-6622749231) |
| LARK V2 §9:517 起及其承接的 readiness failure consequence；V2:56 CORE-5 | 只更改 OPTIONAL failure 的后果：channel UNAVAILABLE、自己的 ingress/effects 关闭、无关 base 继续；显式 REQUIRED 在同 checkpoint 拒绝。gate wired → ready → live 顺序、identity/ingress safety 保留；其他 §9 AC 不改 | [V2 §2–5](https://github.com/mayf3/dsh-agent-core/issues/441#issuecomment-5981626118)、[ACCEPT](https://github.com/mayf3/dsh-agent-core/issues/441#issuecomment-6622749231) |
| V2:51/58 允许 diagnostic-only incomplete 启动，与 watchdog CTR-HEALTH-001:561–574（573 行：token 不可信时 complete=false、affected UNKNOWN、fails startup readiness）冲突 | AMEND 只拆开启动拒绝输入：execution-safety authority 不可信或 REQUIRED_BLOCKED 仍拒绝；history/routing/incidents/credentials generations 仅诊断不全时 engines start。complete 仍表示 full diagnostic census，censusError、UNKNOWN、T33、token/coherence/provenance 断言保留，不能硬写 true | [V2:51/58](https://github.com/mayf3/dsh-agent-core/issues/441#issuecomment-5981626118)、[ACCEPT](https://github.com/mayf3/dsh-agent-core/issues/441#issuecomment-6622749231) |
| watchdog CTR-READY-001:621–630 将 credential/routing readiness 及 global source/provenance ambiguity 绑定 startup refusal | AMEND startup scope；canonical jobs/occurrence/fence 和执行安全 provenance 不可信仍在任何 engine 前拒绝。只诊断源不完整不拒绝 engines，per-job notification-route 不就绪仍拒绝相关发送，不放开相关不安全 effect | [V2 §1/4/5/8](https://github.com/mayf3/dsh-agent-core/issues/441#issuecomment-5981626118)、[ACCEPT](https://github.com/mayf3/dsh-agent-core/issues/441#issuecomment-6622749231) |
| watchdog DEC-004:312–317：one pure complete projector serves startup/watchdog/API/read tools | 仍共用一个 canonical pure projector；complete 的诊断含义不弱化，只让 startup 消费 authority-vs-diagnostic 分类，避免再以诊断 complete 单独决定启动；不另建 projector/gate 平台 | [V2 §4–6](https://github.com/mayf3/dsh-agent-core/issues/441#issuecomment-5981626118)、[ACCEPT](https://github.com/mayf3/dsh-agent-core/issues/441#issuecomment-6622749231) |
| watchdog:3/20/45 仍为 accepted/contracts/superseded_by:null | 本 PR 保留该原文；接受本特定纠偏 AMEND 后只按表内范围作有效解释，其余合同/验收及整份 authority 身份继续有效，不伪造 whole-authority 事务 | [V2:11/110](https://github.com/mayf3/dsh-agent-core/issues/441#issuecomment-5981626118)、[ACCEPT](https://github.com/mayf3/dsh-agent-core/issues/441#issuecomment-6622749231) |
| health-runtime.js:137–149：readinessRequired===true 时 health.complete!==true 抛 SCHEDULER_HEALTH_INCOMPLETE | 仅为 B442-01 的现有调用路径证据；后续实现按 V2 §6/§7 更改 guard 的分类输入，本 docs PR 不改源码。未启用 guard 的 overlay 或生产现状均不能由此推定 | [V2:58/§6](https://github.com/mayf3/dsh-agent-core/issues/441#issuecomment-5981626118)、[ACCEPT](https://github.com/mayf3/dsh-agent-core/issues/441#issuecomment-6622749231) |
| V2:110：docs/specs record 先进入 accepted base，再沿 PR #451 lineage 实现 §6/§7 | 本 PR 交付接受载体，监管补精确 head/hash 和接受合并记录；不能把 Owner 裁定或开 PR 本身当成 main 已落盘 | [V2:110](https://github.com/mayf3/dsh-agent-core/issues/441#issuecomment-5981626118)、[ACCEPT](https://github.com/mayf3/dsh-agent-core/issues/441#issuecomment-6622749231) |
| ACCEPT 中 e9699aee 的 Git 内容未包含 V2；STOPPED 精确 head 绑定差额 | 保留原 ACCEPT 和实测错配，不声称旧 SHA 承载 V2；以原评论精确哈希及本载体 reviewed/final head 由监管补作绑定 | [ACCEPT](https://github.com/mayf3/dsh-agent-core/issues/441#issuecomment-6622749231)、[V2](https://github.com/mayf3/dsh-agent-core/issues/441#issuecomment-5981626118) |

未在表内变更的 watchdog route validation、受影响发送的 fail-closed、secret-safe
readback、access control、effect fence、UNKNOWN 与 reconciliation、durability/rollback
义务继续有效。诊断完整性不足不等于相关 effect 具有安全 authority；不能按 source 名称
把真实承担执行安全的资料一律降级。

## D. Contract identities and acceptance mapping

以下新 ID 对应附录原义。所有行为验收均 **NOT_RUN**；文档校验/独审仅证明载体忠实，
不证明实现。每行的 required evidence 均须绑定实际 implementation head、环境、命令、
输出和结果；compiler/tool failure、旧 BAD 复现或其他 head 的 PASS 均不算 GOOD。

| Contract | 载荷与义务（精确来源） | Acceptance / method / environment | Required evidence / expected result / failure condition |
|---|---|---|---|
| CTR-442-001 | V2 §1–4、§5 CORE-5：OPTIONAL 默认，configured/enabled≠REQUIRED；既有启动序列的 OFF/UNAVAILABLE/LIVE/REQUIRED_BLOCKED；initial REQUIRED set 仅 feishu_channel；own ingress/effect 关闭且 honest unavailable/not_delivered | ACC-442-001：V2 §7 5a–5e/P0；existing hermetic composition/Feishu entrypoints、SDK/credential/ready fakes | 代码/cause、零 live ingress、无关 base 存活、delivery not_delivered、REQUIRED 拒绝及 default-empty 正控输出；任一故障扩大全局或伪造 LIVE/success 即失败；P0 保留不重做 |
| CTR-442-002 | V2 §4、§5 CORE-1、§6/§8：diagnostic incomplete 可启动，execution-safety authority 不可信仍在任何 engine 前拒绝；complete、censusError、UNKNOWN/T33 和 canonical projector 原义不变 | ACC-442-002：V2 §7 1a/1b；existing health-runtime/watchdog tests、hermetic source/provenance/fence fakes | diagnostic false+engines start+无关 safe effect；authority-invalid 两 engine 零启动正控原样保留；route 缺失相关发送拒绝；假 complete、漏 UNKNOWN、authority-invalid 启动或诊断独自阻断 engines 即失败 |
| CTR-442-003 | V2 §5 CORE-2/3/4、§6：独立 history mount failure 局部 UNAVAILABLE；disabled ingress 零 store I/O；enabled corrupt store 零 serve/delivery 且原字节不变；ready log capability scoped | ACC-442-003：V2 §7 2/3a/3b/4；existing history/notification-ingress test entrypoints、real-entry disabled seam、isolated corrupt-store fixtures | warn/code、访问计数零、bytes before/after、真实 entry shutdown/停止输出；history gate admission、触碰 disabled store、损坏字节、虚构 URL 或 entry TypeError 即失败 |
| CTR-442-004 | V2 §8/§9：identity/auth/fences/reserve-before-effect/no UNKNOWN replay/idempotency/target/single-writer/rollback/gate order 全保留；无新 runtime loop/platform/durable state/migration | ACC-442-004：V2 §7 preserve rows/P0 与 §8/§9 affected-invariant review；isolated source/test environment，真实 SDK/production 另列 NOT_RUN | 现有安全断言保留、changed-surface+direct-consumer review、无新持久格式/后台重评估；削弱安全义务、UNKNOWN replay 或无证据宣称安装/业务成功即失败 |
| CTR-442-005 | V2 §11 及 B 节的已发生 Owner 接受：先忠实 docs 载体/精确接受绑定进入 base，再后续 source；PROD_AUTH HOLD 不变 | ACC-442-005：exact-head 独立语义审查、原评论 hash/附录字节校验、schema/transition、docs-only diff、本表核对；repository+read-only GitHub | reviewed/final head、spec hash、监管接受/合并回执；起草交付只标 carrier proposed/none；不实来源、语义漂移、越过 base 或伪造接受/生产权限即失败 |

## E. Observations, limitations and next boundary

`OBS-442DOCS-001`：2026-11-04 对 exact authoring base 和 STOPPED 的固定 base
只读比对，复核 C 表条款与当前 guard；观察代码不作为解释合同的 authority。
`OBS-442DOCS-002`：通过 GitHub connector 与 gh API 实测 B 节两条 body 的身份、
时间、长度和 SHA-256；评论在本次读取时未编辑。
`EVD-442DOCS-001`：这些原文及 STOPPED 对照支持 B442-01 的存在和本载体对
CTR-442-001–005 的忠实映射。充分性仅限文档输入/来源，不证明运行时或新源码 conformance。

本提交只写 docs/；现有 accepted 文档保留字节。未实现/未运行 V2 §7，真实 SDK、
credential/handshake/network、entry/pack/launchd、steady-state 与未枚举消费者仍为
原 V2 §10 所列 NOT_RUN/UNKNOWN。监管载体激活、源码可合并性和实时生产状态均 UNKNOWN。
本交付不关闭 #442 的实现、发布或业务验收。

## Appendix — exact V2 source comment

以下标记之间为 5981626118 的完整原始 body。历史 NOT ACCEPTED/NO authority 字样
描述其发布当时状态，不撤销后来 Owner ACCEPT；V2 §1–9 语义按 A/B 节承接。

<!-- V2-SOURCE-BODY-BEGIN -->
SPEC_CANDIDATE_RECORDED — PROPOSED / NOT ACCEPTED (2026-10-04). This comment is an authority candidate only: it carries NO implementation authority, is NOT accepted by its posting, releases NO hold, and authorizes NO source, release, or production action. The command that produced it likewise grants no implementation authority and does not accept this candidate.

```text
spec_id = PRODUCTION_442_OPTIONAL_ADAPTER_EFFECT_BOUNDARY_V2
status = proposed (candidate; NOT accepted)
supersedes_text = PRODUCTION_442_OPTIONAL_ADAPTER_STARTUP_ADMISSION_V1 (#441 comment 5979798642 — itself remains PROPOSED / NOT ACCEPTED; V1 only recorded the merged behavior as-is and is insufficient under Owner amendment 5980986928)
recorded_on = #441 per #442 boundary 「新增规范只记在 #441」
fresh_read_basis = #442 incl. BLAST_RADIUS_AUDIT_20261004 (CORE-1..5); #441 incl. Owner amendment 5980986928 + GOV-1/DEP-1 audit block; #386 incl. BLAST_RADIUS_AUDIT_20261004; Draft PR #451 exact head 7a55ab27 (DRAFT, unmerged); merged PR #448 = c9ea10d0; current main = 7eb107fb — the exact SHA the CORE enumeration pinned, so all cited lines are current-main lines
governed_by = AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1 (lifecycle/acceptance); AGENT_CORE_PRODUCT_ARCHITECTURE_V1
basis = #441 proposed minimal requirement §3 可选启动/参数化 (closed unconfigured adapter must not block the unrelated base path; missing credentials only disables the optional capability; missing safety policy still fails closed), as sharpened by Owner amendment 5980986928
amends_upon_acceptance = AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V2 §9 (consequence of readiness rejection — scope only, gate order unchanged); SCHEDULER_WATCHDOG_ROUTING_AND_STUCK_OCCURRENCE_RECOVERY_V1 CTR-READY-001/CTR-HEALTH-001/DEC-004 (startup-readiness census scope: occurrence/fence authority stays; routing/credential/diagnostic completeness demoted to observable degradation); reaffirms AGENT_CORE_SCHEDULER_RUN_HISTORY_V1 R-H1 (history never gates admission)
```

## 0. Why V2 exists — the Owner decision boundary it encodes

Owner amendment 5980986928 explicitly rejected advancing V1 as "only waiting for a routine yes": repeatedly amplifying a LOCAL capability/config/evidence failure into a whole-runtime, whole-Product, whole-release-lane, or all-work STOP is a material availability defect. V1's defect was that it recorded exactly that amplifying behavior as the proposed law. V2 therefore changes the recorded target behavior:

- **configured/enabled is NOT REQUIRED.** No config presence, enabled flag, or code default upgrades a capability to REQUIRED.
- An optional capability's config / SDK / credential / handshake / history / diagnostic failure closes exactly that capability's ingress and effects and reports honest `unavailable` / `not_delivered` — never fabricated success, never silent drop, never hidden error, never a deleted safety check.
- Whole-runtime readiness refusal is justified ONLY by (a) an explicit deployment REQUIRED declaration for that capability, or (b) actual unavailability of a shared core execution-safety invariant.

## 1. Exact terms

- **Capability**: a compose-time mountable unit with its own ingress/effects. In scope here: `feishu_channel`, `scheduler_history`, `notification_ingress`; health secondary sources (`history`, `routing`, `incidents`, `credentials` generations) are diagnostic census inputs, not capabilities.
- **OPTIONAL (default)**: absence or failure never blocks unrelated composition, engines, or capabilities.
- **REQUIRED**: declared so only by the deployment contract (§3); only then may its failure refuse the corresponding global readiness.
- **Execution-safety authority (never optional, never demoted)**: the canonical jobs/occurrence/fence census, identity, authorization, effect fences, reserve-before-effect, no-UNKNOWN-replay, idempotency, target identity, production single-writer, rollback viability, gate-before-live ordering. Untrusted authority refuses exactly the operations that depend on it; for the scheduler/WEC start gate specifically it refuses engine start before any engine starts (existing accepted wired-start contract, preserved verbatim).
- **Capability boundary**: the narrowest set of that capability's ingress+effects that becomes unusable when it fails.

## 2. Capability states and transitions (startup-scoped; NO new runtime state machine)

States are evaluated once, inside the existing `composeProductionRuntime` / start sequence. There is no steady-state re-evaluation loop, watcher, or retry engine:

- `OFF` — not configured. Zero strict config parsing, zero store I/O, zero SDK/credential/handshake work. Delivery requests resolve honest `not_delivered` (existing fallback seam, compose.js:412–416).
- `UNAVAILABLE` — configured/enabled but failed capability admission: invalid config value, unloadable SDK/module graph, invalid identity credentials, failed handshake/ready, unreadable store/dir. Outcome: loud machine-coded warn/error with cause preserved (existing codes: `FEISHU_UX_SWITCH_INVALID`, `FEISHU_PROCESSING_REACTION_INVALID`, `FEISHU_REPLY_RENDER_MODE_INVALID`, `FEISHU_CONNECTOR_UNAVAILABLE`, `CORRUPT_STORE`), the capability's ingress+effects closed, honest `unavailable`/`not_delivered` at each dependent effect — and unrelated composition proceeds.
- `LIVE` — enabled + config valid + SDK loaded + identity valid + (channel) gate wired → ready → live, in the existing order.
- `REQUIRED_BLOCKED` — the deployment contract declares the capability REQUIRED and it is not `LIVE` at its readiness checkpoint: the existing readiness refusal fires (fail loud, composition/ready rejected) with the capability's own machine code.

Transitions: `OFF`→`UNAVAILABLE`/`LIVE` only via explicit configuration change plus process restart. A `LIVE` capability never silently downgrades mid-run — steady-state failures keep the existing per-effect failure semantics. `UNAVAILABLE` never re-enters `LIVE` without restart. No transition fabricates evidence, writes to a store it could not read, or replays UNKNOWN.

## 3. REQUIRED-vs-OPTIONAL declaration source/default

- **Source**: the existing deployment supervision environment, read once by the existing entry/compose — one new parse point: `AGENT_CORE_REQUIRED_CAPABILITIES` (comma-separated capability names; initially only `feishu_channel` is declarable).
- **Default**: empty ⇒ every capability OPTIONAL. Absence of a declaration IS the OPTIONAL declaration. Configured ≠ enabled ≠ REQUIRED.
- **Effect**: a listed capability not `LIVE` at its readiness checkpoint becomes `REQUIRED_BLOCKED` and refuses that readiness. This is the ONLY code path from a capability failure to a global readiness refusal; it is an explicit deployment decision, replayable in config and visible in logs.

## 4. Minimal effect / admission / readiness scope

- **Effect scope**: an unavailable capability closes exactly its own boundary — `feishu_channel`: no Feishu send/reaction/render, no ingress listener, never live; `notification_ingress`: no HTTP serve, zero delivery, durable bytes untouched; `scheduler_history`: no history writes/reads, warn observable.
- **Admission scope**: job admission and execution never depend on any optional capability (R-H1 reaffirmed and generalized: no optional capability gates admission). Delivery-requesting jobs still admit and execute under an unavailable channel; their delivery result is honest `not_delivered` via the existing fallback.
- **Readiness scope**: the scheduler/WEC start gate refuses ONLY on (a) untrusted execution-safety authority — jobs store unreadable, occurrence/fence authority-invalid, fence-projection invalid, exactly today's wired-start baseline — or (b) `REQUIRED_BLOCKED`. Diagnostic-only incompleteness (history/routing/incidents/credentials generations untrusted) keeps `complete=false` + `censusError` honest (every T33 never-false-green assertion unchanged) and per-job notification-route readiness degrades (unrouted job-failure sends refuse delivery) — but scheduler and workflow engines start.

## 5. Mapping to CORE-1..5 (fresh-read at main 7eb107fb)

| ID | Current surface (exact) | V2 disposition |
|---|---|---|
| CORE-5 | compose.js:298–331 enabled branch — strict switch parse (:303–307) and connector import (:310–317, `FEISHU_CONNECTOR_UNAVAILABLE`) each throw out of composition; :360–369 `await feishu.ready()` (:367) — comment: "readiness rejection fails runtime composition loud" | enabled-channel admission failures ⇒ channel `UNAVAILABLE` (codes + cause preserved), delivery fallback active, Broker/API/Scheduler/Workflow compose and start. Gate wiring → ready → live ORDER unchanged (gate-before-live preserved; an unavailable channel is never live, so there is no un-gated ingress). Amends ONLY the §9 consequence of readiness rejection. Explicit REQUIRED declaration ⇒ `REQUIRED_BLOCKED` refusal at the same checkpoint. |
| CORE-1 | health-runtime.js:40–49 five-source census; :137–148 `createSchedulerRuntimeStarter` + `assertSchedulerStartupReady` ⇒ `SCHEDULER_HEALTH_INCOMPLETE`; watchdog/health.js:178 `complete` requires ALL generations + authority + provenance + fence projection | split the gate's refusal input: refuse start iff execution-safety authority is untrusted (jobs/occurrence/fence) or `REQUIRED_BLOCKED`; diagnostic-only incompleteness proceeds with honest `complete=false`. `complete` itself is NOT weakened — it keeps meaning "full diagnostic census". The authority-invalid wired-start refusal baseline (health-runtime.test.js:148–168) stays green verbatim. |
| CORE-2 | history-runtime.js:9–15 + compose.js:424–429 — `ensureLoaded()` on `layout.historyDir` (EEXIST/EACCES) aborts the whole composition | mount failure ⇒ `scheduler_history` `UNAVAILABLE` (warn observable), `schedulerHistory` provided as an unavailable marker; health history source honestly incomplete; R-H1 untouched; scope note: this is the independent run-history store (events.jsonl + projections), NOT the watchdog runs.jsonl and NOT jobs.json — those authorities are untouched. |
| CORE-3 | notification-ingress/src/index.js:128–139 — `storeFile` required and `NotificationIdempotencyStore` constructed/read/scanned BEFORE the :190–194 disabled branch; a corrupt store throws `CORRUPT_STORE` and kills startup even when disabled | `disabled` ⇒ zero store I/O: return `{enabled:false, deliverReady, storeReady:false}` before any store requirement/construction. `enabled` + corrupt store ⇒ ingress `UNAVAILABLE` at the existing production-runtime mount wrapper (notification-ingress-runtime.js:12): no listener, zero delivery, original bytes preserved (never repaired/truncated); the package's own fail-closed contract (it refuses to serve) is unchanged — only the blast radius is scoped. |
| CORE-4 | entry.js:82 — `runtime.notificationIngress.address().port` in the ready log; disabled/unavailable ingress returns no `address()` ⇒ TypeError exits the process AFTER a successful compose | ready log is capability-scoped: the ingress line prints only for a `LIVE` ingress; no fabricated listen URL. A real entry with a disabled/unavailable ingress starts, registers shutdown, and stops cleanly. |

## 6. Smallest affected source delta on the PR #451 lineage (rebase target 7a55ab27)

Seven paths, all inside the already-enumerated packages; no new package, module, component, or platform; one new env parse. To be implemented ONLY after acceptance:

1. `packages/production-runtime/src/feishu-env.js` — the moved admission seam's throw outcomes become capability-scoped `UNAVAILABLE` recordings (codes/cause preserved); add `resolveRequiredCapabilities()` (default empty).
2. `packages/production-runtime/src/compose.js` — `UNAVAILABLE` channel reuses the existing not-delivered deliver fallback and records capability status in the compose result; REQUIRED check at the existing checkpoint; history-mount and notification-ingress-mount try/catch scoping.
3. `packages/production-runtime/src/notification-ingress-runtime.js` — wrap the existing mount: `CORRUPT_STORE`/mount failure ⇒ ingress `UNAVAILABLE` marker.
4. `packages/notification-ingress/src/index.js` — move the storeFile requirement + store construction inside the enabled branch; disabled ⇒ zero store I/O.
5. `packages/production-runtime/src/scheduler/history-runtime.js` — `ensureLoaded()` failure ⇒ unavailable marker (no composition throw).
6. `packages/production-runtime/src/scheduler/health-runtime.js` + `packages/scheduler/src/watchdog/health.js` — expose an authority-vs-diagnostic classification derived from existing data (new field alongside `complete`; `complete` and the census untouched); `assertSchedulerStartupReady` consumes it.
7. `packages/production-runtime/src/entry.js` — capability-scoped ready log (CORE-4); shutdown registration unchanged.

## 7. BAD/GOOD regression matrix (same-PR tests at existing entry points; ALL rows NOT_RUN — no code exists yet)

| ID | BAD (current main 7eb107fb / PR451 head) | GOOD (V2) | Test surface |
|---|---|---|---|
| 5a | enabled channel + unloadable SDK ⇒ `FEISHU_CONNECTOR_UNAVAILABLE` throws; Broker/API/Scheduler/Workflow never compose | channel `UNAVAILABLE`, loud code + cause, base composes; delivery jobs honest `not_delivered` | amend `feishu-missing-impl-startup.test.js:68` (configured case) + new base-survives assertion |
| 5b | enabled + invalid UX switch ⇒ `FEISHU_UX_SWITCH_INVALID` kills composition | channel `UNAVAILABLE` + warn code; base starts | amend `feishu-ux-switches.test.js` enabled-invalid case |
| 5c | enabled + malformed credentials/identity ⇒ mount throws loud; composition dies | channel `UNAVAILABLE`; identity never faked; `not_delivered` | extend enabled-invalid-identity case to capability scope |
| 5d | `ready()` rejection ⇒ composition dies | gate still wired first; channel simply never live; runtime continues | amend `feishu-readiness.test.js:7` — gate-order assertions preserved verbatim, failure scope changed |
| 5e | (no mechanism today) | explicit `AGENT_CORE_REQUIRED_CAPABILITIES=feishu_channel` + unavailable channel ⇒ readiness refuses loud | new REQUIRED parse + refusal test (positive + default-empty) |
| 1a | routing manifest unreadable ⇒ `complete=false` ⇒ `SCHEDULER_HEALTH_INCOMPLETE` ⇒ scheduler+WEC never start | `complete=false` honest (T33 kept); engines start; unrouted job-failure sends refuse delivery | amend `health-runtime.test.js:136–139` + :170–182 wiring baselines; add "diagnostics incomplete, unrelated safe effect executes" counterexample |
| 1b | authority-invalid occurrence/fence census ⇒ start refused before any engine | UNCHANGED (execution-safety authority) | keep `health-runtime.test.js:148–168` green verbatim (this is the preserve regression) |
| 2 | historyDir EEXIST/EACCES at mount ⇒ composition dies | history `UNAVAILABLE` warn; R-H1 intact; jobs/runs authorities untouched; health honestly incomplete | new mount-failure counterexample at existing history-runtime test entry |
| 3a | disabled ingress still constructs/reads/scans store; corrupt store kills startup | disabled ⇒ zero store I/O, `storeReady=false`, no listener | new disabled+corrupt-store zero-access test (existing `notification-ingress/test/api.test.js` entry) |
| 3b | enabled + corrupt store ⇒ `CORRUPT_STORE` kills whole startup | ingress `UNAVAILABLE`: no serve, zero delivery, bytes untouched, loud code; rest of runtime starts | new enabled-corrupt-store capability-scope test |
| 4 | real entry + disabled ingress ⇒ ready-log TypeError at entry.js:82 ⇒ process exits | capability-scoped ready log; process stays up, registers shutdown, stops cleanly | new real-entry-disabled scenario at the existing entry test seam |
| P0 | channel-OFF invalid env / missing SDK blocking base startup | already fixed and merged (PR #448) — RESOLVED_SOURCE, not redone | `feishu-optional-adapter-startup.test.js` + OFF cases of the missing-impl suite stay green |

## 8. Preserved invariants (explicit non-negotiables)

Identity, authorization, effect fences, reserve-before-effect, no UNKNOWN replay, idempotency, target identity, production single-writer, rollback viability, gate-before-live ordering; enabled-channel mount config, V2 ingress gate and honest not-delivered offline semantics; `complete` never hard-written true; `CORRUPT_STORE` never auto-repairs or truncates; the authority-invalid wired-start refusal; no new watcher / scheduler / plugin loader / platform / database / state machine / gate (the REQUIRED set is one env parse at the existing composition point).

## 9. Migration / rollback compatibility

No stored-format change, no new durable state, no migration: the default-empty REQUIRED declaration means a deployed V2 differs from the PR #448-generation preimage only by strictly widening start eligibility (fewer global refusals), and every GOOD case's BAD twin remains a safe fail-closed outcome after rollback to the existing preimage. Declaring REQUIRED deliberately restores loud refusal semantics. The existing release path's rollback contract, disk-budget and retention rules are unaffected; SOURCE ≠ INSTALLED ≠ ENABLED ≠ BUSINESS_VERIFIED remain distinct.

## 10. What remains NOT_RUN / UNKNOWN (honest)

- Every §7 row is NOT_RUN: this candidate has no code; tests land only in a source PR under accepted authority. No compiler/tool failure is or will be counted as PASS.
- Real Feishu SDK/credential/handshake/network behavior: NOT_RUN (no credentials read; hermetic fakes and loader hooks only).
- Production entry/pack/launchd behavior: NOT_RUN; no install/enable/deploy occurred — INSTALLED=no / ENABLED=no / BUSINESS_VERIFIED=no stay truthful.
- Steady-state (post-start) degradation of routing/credentials under the live watchdog loop: NOT_RUN — this candidate scopes startup admission only; steady-state keeps existing per-effect semantics.
- Cross-package consumers of `schedulerHealth.complete` outside the enumerated production-runtime/scheduler surfaces: NOT censused (bounded per command; no whole-repository audit repeated).

## 11. Acceptance actor/route + authority boundary

- Existing route, unchanged: Owner mayf3 (SPEC_ACCEPTANCE_ACTORS) accepts, amends, or rejects this exact text per AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1 (ACCEPT instruction binding a reviewed spec commit + SHA-256). On acceptance, the §-metadata amendments (LARK §9 consequence; SCHEDULER_WATCHDOG readiness scope; R-H1 reaffirmation) land through the existing successor/amendment path as the docs/specs record — and only then may a source PR implement §6 with §7 regressions on the PR #451 lineage.
- Until acceptance: V1 remains NOT ACCEPTED; PR #451 stays DRAFT; #442 SOURCE_ACCEPTED=no and its PROD_AUTH hold stand. Nothing here authorizes implementation, merge, install, enable, deploy, restart, release attachment, or replay of UNKNOWN. This command grants no implementation authority and does not accept the candidate. Products #449/#371 are untouched; no Product/platform/gate/watcher/scheduler/database/state machine is created by this comment.

<!-- V2-SOURCE-BODY-END -->
