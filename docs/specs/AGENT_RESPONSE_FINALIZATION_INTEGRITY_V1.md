---
spec_id: AGENT_RESPONSE_FINALIZATION_INTEGRITY_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
scope:
  - assistant final validation and visible failure receipts
  - progress and final separation
  - output-limit truncation visibility and finalization evidence
  - processing reaction convergence
  - caller-wait recovery receipt integration boundary
  - Feishu text reply payload integrity
governed_by:
  - AGENT_PROCESS_LIFECYCLE_HARDENING_V2
  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0
external_authorities: []
supersedes: []
superseded_by: null
owners:
  - mayf3
date: 2026-08-30
repository: mayf3/dsh-agent-core
authoring_base_main: a1815f00ae6e05858d17f50de2fac91255438e74
references:
  - d7a65df:docs/reports/feishu-podcast-agent-reply-investigation-v1.md
  - https://github.com/mayf3/dsh-agent-core/pull/106
---

# AGENT_RESPONSE_FINALIZATION_INTEGRITY_V1 — 回复终态完整性

> 状态：**proposed**。只有独立审计、`status: accepted` 且合入 `main` 后，本文 Contracts 才能授权后续实现。
> 本 PR：**DOCS ONLY**。不写产品代码，不部署、不重启、不修改任何生产状态。

## 0. Authoring result

```text
TASK_NAME = 回复 执行
ROUND = AUTHORITY_AUTHORING
SPEC_ID = AGENT_RESPONSE_FINALIZATION_INTEGRITY_V1
SPEC_STATUS = proposed
IMPLEMENTATION_AUTHORITY_NOW = NONE
IMPLEMENTATION_AUTHORITY_AFTER_ACCEPTANCE_AND_MERGE = contracts
PRODUCTION_APPLY_AUTHORITY = none
PRODUCT_CODE_CHANGE = NONE
PRODUCTION_CHANGE = NONE
READY_FOR_INDEPENDENT_REVIEW = YES
```

`implementation_authority: contracts` 在 Draft、未 accepted 或未合入 `main` 时均不生效。后续 implementation PR 必须从包含本文 accepted 版本的 base 开始，并单独完成 `DEVELOPMENT_PREFLIGHT` 与 `SPEC_COMPLIANCE`。

## 1. Goal

冻结 assistant 回复终态的最小完整性语义：空 final 不得形成空飞书引用壳；progress 不得冒充 final；provider 明确因输出上限终止时必须保留 partial 并显式标注未完成；processing reaction 必须在所有终态收敛；caller timeout 只接入 PR #106 所属 receipt surface，不复制其 recovery coordinator。

```text
EMPTY_FEISHU_PAYLOAD = FORBIDDEN
EMPTY_REPLY_VISIBLE_RECEIPT = EXACTLY_ONCE
PROGRESS_IS_FINAL = NO
SILENT_OUTPUT_LIMIT_TRUNCATION = FORBIDDEN
AUTOMATIC_CONTINUATION = FORBIDDEN
PERMANENT_PROCESSING_REACTION = FORBIDDEN
SECOND_RECOVERY_COORDINATOR = FORBIDDEN
```

## 2. Scope and non-goals

### 2.1 In scope after acceptance and merge

- Runtime/Session final validation以及 Feishu text payload 非空守卫；
- progress、final 与 `NO_FINAL` 终态分离；
- output-limit finish reason 的规范化、最小结构化 finalization evidence 与可见截断标记；
- final success、empty final、caller timeout handoff、child exit、delivery failure、recovery receipt 后的 processing reaction 收敛；
- 对 PR #106 timeout/recovery receipt surface 的单向接线与 dedup；
- 本 Spec §10 的离线单元/集成测试。

### 2.2 Out of scope / forbidden

- 本 authoring PR 的任何产品代码、配置、运行态或生产变更；
- auto-reaper、fence、cancel、signal、recovery coordinator、TurnRecoveryStore 或 caller-wait timeout policy；
- 第二套 timeout/recovery receipt；
- 自动重放原 prompt、自动二次生成、自动续写或标点/半句启发式续写；
- 全局提高 `maxTokens`；
- GLM/Luna、ARM、Scheduler、HR、Workflow；
- 播客内容或其他 Agent 的通用内容策略；
- provider prompt 正文、credential 或 provider raw body 的持久化。

## 3. Authority and dependencies

```text
PRIMARY_PARENT_AUTHORITY = AGENT_PROCESS_LIFECYCLE_HARDENING_V2
GOVERNANCE_AUTHORITY = AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0
PR106_STATUS_AT_AUTHORING = proposed / inactive
PR106_OWNED_SURFACE = caller-wait timeout/recovery receipt, dedup, recovery coordination
THIS_SPEC_OWNED_SURFACE = response finalization integrity and reaction convergence
AUTHORITY_CONFLICT = NONE
```

本文是独立、bounded child authority，不 supersede 或改变 `AGENT_PROCESS_LIFECYCLE_HARDENING_V2` 的 `outcome_unknown`、exact fence、late reconciliation 与 no-replay 语义。

PR #106 / `AGENT_TURN_CALLER_WAIT_RECOVERY_V1` 在 authoring 时仍是 proposed，不构成 active authority。本文只冻结兼容边界：若 caller-wait timeout/recovery receipt surface 后续由独立 accepted authority 提供，实现可消费其唯一 receipt reservation/handoff；本文不授权实现该 surface、reaper、fence 或 coordinator。若该 surface 在 implementation base 尚未 active，caller-timeout 接线必须保持未实现/feature-gated，不得在本文名下补建替代品。

## 4. Current State

### STATE-RFI-001 — 空 final 可进入空 Feishu payload

- Subject：DSH Runtime → Feishu text reply finalization path。
- As of artifact：investigation commit `d7a65df`。
- Environment：repository source/session evidence；production 未修改。
- Observed at：2026-08-30。
- Projection：assistant final 为空时缺少 non-empty guard，connector 可发送 `{"text":""}`。
- Basis：`OBS-RFI-001`、`CLM-RFI-001`。

### STATE-RFI-002 — progress-only 与截断缺少明确终态

- Subject：interactive turn finalization and user-visible reply。
- As of artifact：investigation commit `d7a65df`。
- Environment：repository/session evidence；production 未修改。
- Observed at：2026-08-30。
- Projection：已观察到 progress-only 无 final，以及 partial final 无 output-limit 可见标记的故障形态。
- Basis：`OBS-RFI-002`、`OBS-RFI-003`、`CLM-RFI-002`。

## 5. Observations

### OBS-RFI-001 — Empty final produced an empty quoted reply shell

- Subject：Feishu 播客制作人事故 A。
- Repository/source：`mayf3/dsh-agent-core`。
- Commit/artifact：`d7a65df:docs/reports/feishu-podcast-agent-reply-investigation-v1.md`。
- Environment：recorded Session/Runtime/Feishu evidence。
- Observed at：2026-08-30。
- Method：采用已完成调查结论，不重复调查事实。
- Result：Session final 为 0 bytes，outbound 与 Feishu business payload 均为 0 bytes，形成空引用回复壳。
- Provenance：该报告 §0、§3.1。

### OBS-RFI-002 — Progress-only turn ended without final

- Subject：同调查事故 B。
- Commit/artifact：`d7a65df`。
- Environment：recorded Session evidence。
- Observed at：2026-08-30。
- Method：采用既有调查结论。
- Result：三条“我先看”等 progress 后无 terminal final，用户只看到进度且需另行追问。
- Provenance：该报告 §0、§2、§3.2。

### OBS-RFI-003 — Partial assistant text was delivered without truncation notice

- Subject：同调查事故 C。
- Commit/artifact：`d7a65df`。
- Environment：recorded Session/outbound evidence。
- Observed at：2026-08-30。
- Method：采用既有调查结论。
- Result：Session final 与 outbound payload byte-wise 相同，但正文中途结束且无“尚未完成”标记；既有证据未确认 exact provider finish reason。
- Provenance：该报告 §0、§3.3、§6。

### OBS-RFI-004 — PR #106 owns caller-wait recovery semantics

- Subject：`AGENT_TURN_CALLER_WAIT_RECOVERY_V1` proposed authority。
- Commit/artifact：PR #106 head `6ec2bf729a15181ca8ae31743ce1adf17ea567ae`。
- Environment：docs-only candidate authority。
- Observed at：2026-08-30。
- Method：读取其 scope、`CTR-TWR-001`、`CTR-TWR-007`、`CTR-TWR-009` 与 acceptance mapping。
- Result：timeout receipt、late suppression、reaction handoff、dedup 与 recovery coordinator 已由该 candidate 定义；重复实现会产生 authority 与 exactly-once 冲突。
- Provenance：PR #106。

## 6. Claims and assumptions

### CLM-RFI-001 — Final validation must precede surface delivery

- Support state：SUPPORTED。
- Supported by evidence：`EVD-RFI-001`。
- Contradicted by evidence：none known。
- Uncertainty：具体 module seam 由 implementation base 决定，不改变 parent-owned validation 与 connector defense-in-depth。

### CLM-RFI-002 — Progress and output-limit evidence are not substitutes for a final

- Support state：SUPPORTED。
- Supported by evidence：`EVD-RFI-002`。
- Contradicted by evidence：none known。
- Uncertainty：provider finish reason vocabulary 需要 normalization，但不得持久化 provider raw body。

### CLM-RFI-003 — A second recovery receipt owner would violate dedup

- Support state：SUPPORTED。
- Supported by evidence：`EVD-RFI-003`。
- Contradicted by evidence：none known。
- Uncertainty：PR #106 尚未 active，因此接线只能在其 authority 生效后启用。

## 7. Evidence relations

### EVD-RFI-001 — Empty payload observation supports pre-delivery validation

- Source observations：`OBS-RFI-001`。
- Target：`CLM-RFI-001`。
- Relation：SUPPORTS。
- Bound coordinates：investigation commit `d7a65df`，事故 A。
- Strength/sufficiency：strong for the observed failure class。
- Limitations：不证明 provider 产生空 final 的上游原因。
- Provenance：既有调查报告。

### EVD-RFI-002 — Progress-only and partial-output observations support explicit finalization

- Source observations：`OBS-RFI-002`、`OBS-RFI-003`。
- Target：`CLM-RFI-002`。
- Relation：SUPPORTS。
- Bound coordinates：investigation commit `d7a65df`，事故 B/C。
- Strength/sufficiency：strong for visible-finalization requirements。
- Limitations：事故 C 的 finish reason 未被既有证据确认；本文只在 provider 明确返回 output-limit 等价状态时追加标记。
- Provenance：既有调查报告。

### EVD-RFI-003 — Existing proposed recovery authority supports a single owner

- Source observations：`OBS-RFI-004`。
- Target：`CLM-RFI-003`。
- Relation：SUPPORTS。
- Bound coordinates：PR #106 head `6ec2bf729a15181ca8ae31743ce1adf17ea567ae`。
- Strength/sufficiency：strong for authority boundary, not activation。
- Limitations：PR #106 remains proposed/inactive。
- Provenance：PR #106 Spec。

## 8. Decisions

### DEC-RFI-001 — Parent runtime owns normalized finalization receipts

- Decision owner：mayf3。
- Decision：final 为空/全空白或 turn terminal/child exit 时无 final，由 Runtime 返回稳定终态并由 parent delivery surface 发送一次 normalized visible receipt；connector 另做 non-empty defense-in-depth。
- Rejected alternatives：`ALT-RFI-001`、`ALT-RFI-002`。
- Reason：避免空引用壳、静默结束与 connector-specific policy duplication。
- Owner decision remaining：NONE。

### DEC-RFI-002 — Only explicit provider output-limit status triggers truncation marker

- Decision owner：mayf3。
- Decision：明确 `length` 或等价 output-limit 才追加固定未完成标记；`stop` + 半句只记录 evidence，不启发式续写。
- Rejected alternatives：`ALT-RFI-003`、`ALT-RFI-004`。
- Reason：保留 provider evidence，避免把完整输出误标或制造第二次副作用不明的生成。
- Owner decision remaining：NONE。

### DEC-RFI-003 — Caller timeout remains single-owner

- Decision owner：mayf3。
- Decision：复用 active caller-wait recovery authority 的 receipt/handoff surface；本文不实现第二 coordinator 或 timeout receipt。
- Rejected alternatives：`ALT-RFI-005`。
- Reason：保护 exactly-once 与既有 fence/recovery ownership。
- Owner decision remaining：NONE。

## 9. Contracts

### CTR-RFI-001 — Empty final guard and exactly-once visible receipt

当 Runtime 已观察到 assistant final event，而其 value 为 `null`、空串或全部属于 Unicode `White_Space` property（不先做 normalization）时，Runtime MUST return stable error `AGENT_EMPTY_FINAL_RESPONSE`，MUST persist `terminalReason=EMPTY_FINAL`，MUST NOT 请求 connector 发送空引用回复，且 parent runtime MUST reserve exactly one logical finalization receipt with this byte-exact business payload：

```text
本轮未生成有效正文，请重试。系统已记录该问题。
```

Feishu connector MUST independently reject empty/whitespace text payload before API invocation。相同 turn/finalization identity 的 Runtime error、logical receipt 与 transport attempt MUST share one stable dedup identity；MUST NOT 产生 fallback + generic error 两条可见回复。在具备 stable idempotency/dedup 与 confirmed-delivery lookup 的既有 parent outbound adapter 上，healthy delivery MUST converge to exactly one surface-confirmed visible receipt。A confirmed-present result MUST settle without resend；confirmed-absent MAY retry with the same identity；ambiguous/unavailable lookup MUST remain one unresolved logical receipt and MUST NOT blind resend。Exactly-once visible delivery is unsatisfied—not falsely reported complete—until confirmation；transport outage MUST NOT permit a second logical receipt。This bounded ordinary outbound reconciliation belongs to the existing parent outbound adapter and MUST NOT create an Agent-turn recovery coordinator、reaper、fence、scheduler or timeout receipt owner。

### CTR-RFI-002 — Progress/final separation and `NO_FINAL`

Progress messages（包括“我先看看”“我再看看以前的材料”等）MUST be classified as non-final and MUST NOT set turn completed。`NO_FINAL` means no assistant final event was observed before turn terminal、child exit or normal finalization boundary；it is mutually exclusive with `EMPTY_FINAL`, which requires an observed final event with null/blank value。For `NO_FINAL`, Runtime MUST persist `terminalReason=NO_FINAL`、`finalPresent=false`，MUST reserve the same single visible failure payload through the dedup path defined by `CTR-RFI-001`，and MUST NOT claim task completion。Caller-wait timeout has precedence over `NO_FINAL` and is excluded from this fallback path：it MUST use only the active recovery authority's timeout receipt surface。

### CTR-RFI-003 — Output-limit truncation is visible

当 provider explicitly reports `finishReason=length` 或 normalized equivalent output-limit state and partial assistant text is non-empty，Runtime MUST preserve partial text byte-for-byte and append exactly once：

```text
【本次输出达到长度上限，内容尚未完成】
```

The marker MUST be separated from partial text by one `\n\n` unless partial already ends with two newlines。Runtime MUST NOT call the model again, replay the prompt, auto-continue, or describe the result as complete。If partial text is empty/whitespace, `CTR-RFI-001` takes precedence。For `finishReason=stop` with text that appears mid-sentence, Runtime MUST NOT use punctuation or prose heuristics to continue or append the output-limit marker。

### CTR-RFI-004 — Structured finalization evidence

Session/Runtime evidence MUST persist an owned, bounded record containing all fields below for every finalization outcome:

```text
finishReason
terminalReason
assistantTextBytes
outputTokens
assistantMessageCount
toolEventCount
finalPresent
```

Field schema is closed as follows：`finishReason = stop|length|output_limit|tool|error|cancelled|unknown|null`，where `null` means no provider finish reason was available；`terminalReason = FINAL_SUCCESS|OUTPUT_LIMIT|EMPTY_FINAL|NO_FINAL|CALLER_TIMEOUT_HANDOFF|DELIVERY_FAILURE|RECOVERY_RECEIPT`；a child exit without an observed final event is `NO_FINAL`，not a second terminal class；`assistantTextBytes`、`assistantMessageCount` and `toolEventCount` are non-negative integers；`outputTokens` is a non-negative integer or `null` when unavailable；`finalPresent` is boolean。`assistantTextBytes` MUST be UTF-8 byte length of the canonical final business text before surface framing and after any authorized `CTR-RFI-003` marker；it is `0` when no canonical final text exists。`finalPresent` MUST mean a non-empty/非全空白 final after finalization policy，independent of later delivery success。Evidence MUST NOT include prompt正文、credential、provider raw body or unrestricted live objects。

### CTR-RFI-005 — Byte integrity and single terminal delivery

For a normal non-truncated final, canonical Session final UTF-8 bytes MUST equal Runtime outbound business payload bytes and Feishu text business payload bytes。For output-limit final, the same equality MUST hold after the single authorized marker is appended。Transport envelope、quote metadata and API framing are excluded from this business-payload comparison。One finalization identity MUST produce at most one visible terminal/final business reply；earlier progress messages are not terminal/final replies。Connector rejection, delivery failure or outbound reconciliation MUST NOT create an unkeyed duplicate。

### CTR-RFI-006 — Processing reaction convergence

A processing reaction MUST be cleared or converted through the existing reaction adapter to one of the adapter's explicit terminal outcomes `cleared|failed` after any of: final success, empty final, `NO_FINAL`, caller-timeout receipt handoff, child exit, delivery failure, or recovery receipt。Cleanup MUST execute in a finalization path independent of reply-body validity。A caller-timeout handoff MUST consume the active recovery authority's reaction/receipt signal and MUST NOT reserve another timeout receipt。Reaction API failure MUST record sanitized bounded evidence and hand off only to the existing connector reaction cleanup mechanism using the same stable reaction identity；this Spec authorizes no new worker、scheduler or Agent-turn recovery coordinator。The existing mechanism MUST use bounded attempts and MUST NOT retry forever or leave Runtime state falsely marked processing；an externally unavailable reaction API remains an explicit unresolved cleanup failure rather than a false success claim。

### CTR-RFI-007 — Recovery ownership compatibility

This Spec's implementation MUST NOT add an auto-reaper, cancel/fence state machine, recovery coordinator, TurnRecoveryStore, timeout receipt owner, late-delivery policy or second recovery scheduler。Integration MAY only consume an active authority's stable timeout/recovery receipt identity and handoff state。Duplicate timeout receipt count MUST remain zero across both paths；if no such active surface exists in the implementation base, this integration MUST fail closed/disabled rather than synthesize one。

## 10. Acceptance

### ACC-RFI-001 — Empty final

- Contracts：`CTR-RFI-001`、`CTR-RFI-004`、`CTR-RFI-006`。
- Method：unit + offline Runtime/Feishu integration with an observed final event carrying `""`, ASCII whitespace, representative non-ASCII Unicode `White_Space`, and `null`；transport matrix = confirmed-present、confirmed-absent then same-key retry、ambiguous lookup。
- Expected result：zero connector calls with empty payload；one logical fallback receipt；healthy/confirmed transport converges to exactly one visible fallback；ambiguous transport remains unresolved with zero blind resend；`AGENT_EMPTY_FINAL_RESPONSE` and `terminalReason=EMPTY_FINAL` recorded；reaction reaches `cleared|failed`；evidence fields match the closed schema。
- Failure condition：`{"text":""}`、empty quote shell、second logical receipt、duplicate visible fallback、false delivery-complete claim while unresolved or Runtime state retained as processing。

### ACC-RFI-002 — Progress only, no final

- Contracts：`CTR-RFI-002`、`CTR-RFI-004`、`CTR-RFI-006`。
- Method：emit progress events then terminal/child-exit with no final event；separate case emits a null final event after progress。
- Expected result：progress remains non-final；absent-final case records `terminalReason=NO_FINAL`，null-final case records `terminalReason=EMPTY_FINAL`；each reserves one logical visible failure receipt through the same dedup path；reaction reaches `cleared|failed`。
- Failure condition：classification overlap、progress marked completed、silent end、duplicate receipt or Runtime state retained as processing。

### ACC-RFI-003 — Explicit output limit

- Contracts：`CTR-RFI-003`、`CTR-RFI-004`、`CTR-RFI-005`。
- Method：provider double returns non-empty partial text + `finishReason=length`；separate case returns `stop` + apparent half-sentence。
- Expected result：length case preserves partial and appends marker once；one delivery；zero second generation；stop case records evidence but adds no marker/continuation。
- Failure condition：partial dropped/changed、silent truncation、double marker、auto continuation、heuristic continuation or duplicate reply。

### ACC-RFI-004 — Normal long reply byte equality

- Contracts：`CTR-RFI-004`、`CTR-RFI-005`。
- Method：offline long UTF-8 Markdown final through Session → Runtime → Feishu text adapter。
- Expected result：Session final bytes = outbound payload bytes = Feishu business payload bytes；one reply。
- Failure condition：byte mismatch、silent clipping or duplicate reply。

### ACC-RFI-005 — Delivery failure reaction convergence

- Contracts：`CTR-RFI-001`、`CTR-RFI-005`、`CTR-RFI-006`。
- Method：inject delivery rejection/ambiguous result and reaction cleanup failure into the existing outbound/reaction adapters；assert bounded same-identity attempts and absence of any new worker/scheduler/coordinator。
- Expected result：one logical terminal receipt、no unkeyed duplicate；reaction reaches `cleared|failed` or remains an explicitly recorded unresolved external-API cleanup failure while Runtime is no longer marked processing；sanitized bounded evidence retained；no forever retry。
- Failure condition：Runtime policy permanently remains processing、blind duplicate、new reconciliation worker/scheduler/coordinator or raw provider/credential evidence。

### ACC-RFI-006 — PR #106 timeout receipt wiring

- Contracts：`CTR-RFI-002`、`CTR-RFI-006`、`CTR-RFI-007`。
- Method：two-branch integration。Active branch exposes one stable caller-timeout receipt/handoff identity；inactive branch exposes no active authority/surface。Both branches apply a source/dependency assertion rejecting any new coordinator/reaper/fence/store/timeout-receipt owner。
- Expected result：active branch consumes the existing identity，reserves/delivers at most one timeout receipt，emits zero additional fallback receipt and converges reaction handoff；inactive branch keeps integration disabled/fail-closed，emits no synthesized timeout/fallback receipt and creates no recovery component。
- Failure condition：two timeout receipts、empty-final fallback after timeout、synthetic receipt in inactive branch、second recovery coordinator/reaper/fence/store or unkeyed timeout delivery。

### Contract coverage

| Contract | Acceptance | Covered |
|---|---|---|
| `CTR-RFI-001` | `ACC-RFI-001`, `ACC-RFI-005` | YES |
| `CTR-RFI-002` | `ACC-RFI-002`, `ACC-RFI-006` | YES |
| `CTR-RFI-003` | `ACC-RFI-003` | YES |
| `CTR-RFI-004` | `ACC-RFI-001`..`ACC-RFI-004` | YES |
| `CTR-RFI-005` | `ACC-RFI-003`..`ACC-RFI-005` | YES |
| `CTR-RFI-006` | `ACC-RFI-001`, `ACC-RFI-002`, `ACC-RFI-005`, `ACC-RFI-006` | YES |
| `CTR-RFI-007` | `ACC-RFI-006` | YES |

## 11. Alternatives and disposition

### ALT-RFI-001 — Send empty Feishu payload

- Disposition：rejected。
- Reason：形成用户可见空引用壳，违反 visible receipt。
- What would reopen：NONE。

### ALT-RFI-002 — Treat progress as completion

- Disposition：rejected。
- Reason：progress 只表达进行中，不能证明任务完成或 final 存在。
- What would reopen：需要新的 independently reviewed product semantics；不在 V1 内重开。

### ALT-RFI-003 — Infer truncation from punctuation

- Disposition：rejected。
- Reason：会误判合法文风，不能替代 provider finish evidence。
- What would reopen：provider-independent deterministic terminal proof with new evidence and new authority。

### ALT-RFI-004 — Automatically continue generation

- Disposition：rejected。
- Reason：可能重复工具/外部副作用，并改变 one-turn delivery semantics。
- What would reopen：独立 replay/idempotency authority；本 Spec 不提供。

### ALT-RFI-005 — Implement another timeout recovery coordinator

- Disposition：rejected。
- Reason：与 PR #106 authority boundary 冲突并制造 duplicate receipt/recovery races。
- What would reopen：只有既有 recovery authority 被正式 supersede 的 whole-authority change。

## 12. Migration, compatibility, and rollback

```text
MIGRATION = no data migration in authoring; implementation may add backward-compatible bounded finalization evidence
COMPATIBILITY = normal non-empty finals preserve byte-identical business payload; timeout path remains single-owner
ROLLBACK = stop new finalization policy only through a separately reviewed code rollback; do not delete unresolved delivery/reaction evidence
EMERGENCY_CONTAINMENT = connector empty-payload rejection may fail closed; production action requires separate authority
PRODUCTION_APPLY = NONE
```

Existing non-empty normal replies remain compatible。This Spec does not authorize historical-message resend, production replay, runtime restart or reaction mutation。

## 13. Open questions

```text
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
PARTIAL_SUPERSESSION = NONE
READY_TO_MARK_ACCEPTED = NO
NEXT_REQUIRED_ROUND = 回复 审计
```
