---
spec_id: AGENT_CORE_LARK_UX_PHASE1_V2_TEST_EVIDENCE_PLANE_AMENDMENT
status: proposed
type: owner-ruling child amendment (spec-only; docs-only)
amends: AGENT_CORE_LARK_UX_PHASE1_V2
parent_status: accepted
supersedes_parent: false
date: 2026-08-22
spec_kind: implementation
authority_level: governing_spec
implementation_authority: none
scope:
  - test evidence environment split for three AGENT_CORE_LARK_UX_PHASE1_V2 protocol-policy gates only
  - mayf3/dsh-agent-core docs/specs authority only
governed_by:
  - AGENT_CORE_LARK_UX_PHASE1_V2
  - AGENT_CORE_LARK_UX_PHASE1_V2_HEADING_NORMALIZATION_AMENDMENT
  - AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V2
  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0
external_authorities: []
supersedes: []
superseded_by: null
owners:
  - mayf3
references:
  - docs/specs/AGENT_CORE_LARK_UX_PHASE1_V2.md
  - docs/specs/AGENT_CORE_LARK_UX_PHASE1_V2_HEADING_NORMALIZATION_AMENDMENT.md
  - docs/specs/AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V2.md
  - docs/specs/AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0.md
---

# AGENT_CORE_LARK_UX_PHASE1_V2 — Test Evidence Plane Owner Ruling

> 性质：**Owner-ruling child amendment / SPEC ONLY（docs-only）** · 日期：2026-08-22
> 仓库：`mayf3/dsh-agent-core`
> Parent authority：`AGENT_CORE_LARK_UX_PHASE1_V2`（accepted，blob
> `91513d140bfeb2747326a465bdc01d72c899c864`）
> 本轮只记录 mandatory gate 的 evidence-plane 裁决；不修改 accepted parent，不实现代码，不跑
> Canary，不修改 SDK/dependency，不 acceptance-finalize，不 merge，不部署。

---

## 0. Machine-readable Ruling

```text
AMENDMENT_ID = AGENT_CORE_LARK_UX_PHASE1_V2_TEST_EVIDENCE_PLANE_AMENDMENT
AMENDMENT_STATUS = proposed
AMENDMENT_RELATION = REPLACES_TEST_EVIDENCE_ENVIRONMENT_FRAGMENTS_ONLY
PARENT_SPEC = AGENT_CORE_LARK_UX_PHASE1_V2
PARENT_SPEC_STATUS = accepted
PARENT_SPEC_BLOB = 91513d140bfeb2747326a465bdc01d72c899c864
SUPERSEDES_PARENT_SPEC = NO
PARENT_SPEC_FILE_MODIFIED = NO
IMPLEMENTATION_AUTHORITY = none

OWNER_RULING = SPLIT_LIVE_UX_AND_PROTOCOL_POLICY_EVIDENCE
MANDATORY_GATES_TOTAL = 20
REAL_DEDICATED_APP_GATES = 17
PINNED_SDK_PROTOCOL_GATES = 3

PINNED_SDK_PROTOCOL_FAULT_HARNESS = REQUIRED
SDK_RUNTIME = ab028f9dbcc09effbdfa4c9885cdcc1f5ecc623f
NEW_SDK_REVISION = NO
DEPENDENCY_CHANGE = NONE
PRODUCT_SEMANTIC_CHANGE = NONE
RUNTIME_BEHAVIOR_CHANGE = NONE
TEST_EVIDENCE_ENVIRONMENT_CHANGE = ONLY_CHANGE
CUSTOM_MARKDOWN_CONVERTER = FORBIDDEN

PRODUCT_CODE_CHANGE = NONE
TEST_EXECUTION = NONE
CANARY = NONE
DEPLOYMENT = NONE
PRODUCTION_STATE_CHANGE = NONE
ACCEPTANCE_FINALIZE = NONE
MERGE = NONE
```

## 1. Goal, scope and non-goals

### Goal

冻结 Owner 最终裁决：把 parent §13 的二十个 mandatory gates 保持为同一个 acceptance 总量，
其中十七个用户可见/真实服务行为 gate 继续要求 dedicated non-production App 与真实 Feishu client/service，
三个只能验证 SDK protocol policy 的 gate 改由 pinned SDK protocol fault harness 执行。

该 split 只修正**证据环境**，不改变任何产品合同、成功/失败语义、attempt 数、fallback 数、
unknown outcome、mention、Markdown、topic、Router 或 Phase A 行为。

### In scope

- 用新 stable IDs 细化 parent `CTR-TEST-APP-001` 中 permission、format、exhausted-attempt
  必须由 real-app error induction 提供证据的 fragment；
- 替换这三个 gate 对应 Acceptance 的 `Environment` / `Required Evidence` 与执行平面；
- 定义 `PINNED_SDK_PROTOCOL_FAULT_HARNESS` 的真实性边界与禁止项；
- 明确另外十七个 gate 仍必须使用 dedicated App、真实网络/服务与真实 client capture；
- 记录 candidate `6b8ad518643e05dc785cbf7005d0928167e16505` 的 STOP evidence。

### Out of scope

- 不修改 accepted parent 或 heading amendment；
- 不修改产品代码、tests、SDK、SDK revision、dependency、Phase A foundation；
- 不改变 SDK classifier、sender、retry、fallback 或 outcome 实现；
- 不运行 harness、Canary、test App、production canary 或 deployment；
- 不 acceptance-finalize、不 merge；
- 不授权 implementation。

## 2. Authority and lifecycle

```text
SPEC_GOVERNANCE_MODE = AUTHOR
PREFLIGHT_MODE = AMEND
PRIMARY_PARENT_AUTHORITY = AGENT_CORE_LARK_UX_PHASE1_V2
RELATED_ACCEPTED_AUTHORITY =
  AGENT_CORE_LARK_UX_PHASE1_V2_HEADING_NORMALIZATION_AMENDMENT
  AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V2
  AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0
LOCAL_AUTHORITY_BOUNDARY =
  MAY_CHANGE_TEST_EVIDENCE_ENVIRONMENT_FOR_EXACTLY_THREE_PROTOCOL_GATES
  MUST_NOT_CHANGE_PRODUCT_OR_RUNTIME_SEMANTICS
  MUST_NOT_GRANT_IMPLEMENTATION_PERMISSION
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
PARTIAL_SUPERSESSION = NONE
```

Parent 的 Goal、scope、Decision、Contract 与实现 authority 保持原义。本 child 使用新 stable IDs
替换指定 evidence fragments；旧 stable IDs 不删除、不重编号、不复用，也不被赋予新含义。
本文件只有在 independent review、Owner acceptance-finalize 且进入 authority branch 后才产生
normative effect；`proposed` 或未 merge 状态不是 active authority。

Heading normalization child amendment 继续仅把 parent 的 heading trio 替换为
`CTR-MARKDOWN-HEADING-NATIVE-001` / `ACC-MARKDOWN-HEADING-NATIVE-001` /
`TEST-LUX-MD-HEADINGS-NATIVE`，本文件不改变该裁决。

## 3. State, Observations, Claims and Evidence

### OBS-LUXEP-001 — Current authority base is complete

- Subject: parent、heading amendment、Phase A foundation 与 SDK pin。
- Repository/revision: `mayf3/dsh-agent-core` at
  `1c3401a8194a7b6b2ad38031559cbf6c35795f48`.
- Observed at: 2026-08-22.
- Method: fresh `origin/main` worktree；读取 Spec frontmatter/blob、foundation source 与 dependency pin。
- Result: parent accepted blob = `91513d140bfeb2747326a465bdc01d72c899c864`；heading amendment accepted；
  Phase A present；SDK runtime pin = `ab028f9dbcc09effbdfa4c9885cdcc1f5ecc623f`。
- Provenance: this amendment authoring worktree preflight.

### OBS-LUXEP-002 — Current-main carrier closed B1 and B3 but stopped at B2

- Subject: candidate `6b8ad518643e05dc785cbf7005d0928167e16505`.
- Environment: Node `v25.6.1`; frozen Harness
  `a12bb03c6861969985f066bfbf0cb7e5dd5ac567` (`0.1.0-rc.5`).
- Method: current-main mechanical UX replay, structure verifier, complete frozen build, independent Router run and
  serialized repository run.
- Result: B1 structure PASS (`packages/agent-router/src/index.js` = 870 lines); B3 PASS
  (full repository 650 pass / 0 fail / 0 cancelled / 3 skip); B2 STOP before live mutation.
- Provenance: restricted same-host bundle
  `/Users/yanfenma/.dsh-agent-core/audit-evidence/lark-ux-phase1-v2/pr46-current-main-6b8ad518-20260822T0820Z/`,
  bundle SHA-256 `a03f67976c2f918ea79396c77b84130812d2be6fbee037e54cb144feaa1cacdf`,
  manifest SHA-256 `603b420da88a6d73a5d08f7214770227d49b90aa9cddf2289a59643c1d63ae7e`.

### OBS-LUXEP-003 — Real-service error induction is not a stable fixture

- Subject: permission, format-recovery and exhausted-attempt evidence environments.
- Method: inspect the pinned runtime's real sender/classifier/fallback/retry path and evaluate safe dedicated-App
  induction against actual Feishu service conditions; no production state and no live App state were mutated.
- Result:
  - no safe repeatable dedicated-App operation was established that produces a genuine service response matching
    the pinned `permission_denied` classification;
  - forcing three genuine `rate_limited` or ambiguous `unknown` responses would require unsafe or nondeterministic
    quota/network manipulation;
  - the available real `230002` condition also invalidates the text fallback leg, so it cannot form a safe,
    repeatable successful format-recovery fixture.
- Provenance: OBS-LUXEP-002 bundle `provenance/stop-disposition.json`, `gates/gate-status.json`, and pinned runtime
  source hash inventory.

### CLM-LUXEP-001 — Service error induction is not a stable acceptance fixture

- Support state: SUPPORTED.
- Proposition: `REAL_SERVICE_ERROR_INDUCTION_IS_NOT_A_STABLE_ACCEPTANCE_FIXTURE` for the exact three protocol gates.
- Supported by: EVD-LUXEP-001.
- Limitation: this claim does not apply to the other seventeen gates or to target-revoked behavior.

### EVD-LUXEP-001 — STOP observations support the evidence-plane split

- Source observations: `OBS-LUXEP-002`, `OBS-LUXEP-003`.
- Target: `CLM-LUXEP-001` and `STATE-LUXEP-001`.
- Relation: SUPPORTS.
- Coordinates: parent blob `91513d140bfeb2747326a465bdc01d72c899c864`; candidate
  `6b8ad518643e05dc785cbf7005d0928167e16505`; SDK runtime
  `ab028f9dbcc09effbdfa4c9885cdcc1f5ecc623f`.
- Strength: sufficient to choose a deterministic protocol evidence environment; not conformance evidence for any
  unexecuted gate.
- Limitation: candidate `6b8ad518...` is evidence only and is not implementation authority.

### STATE-LUXEP-001 — Authoring state

At base `1c3401a8...`, parent/heading/Phase A/SDK authority is intact (`OBS-LUXEP-001`); B1 and B3 are
closed on the evidence candidate but three parent evidence environments cannot be safely stabilized through live
service error induction (`EVD-LUXEP-001`). Verification coverage for the twenty amended gates remains `NOT_RUN`
in this docs-only round. Conformance is `UNKNOWN`, not implied by this ruling.

## 4. Decision

### DEC-LUXEP-001 — Split live UX and protocol-policy evidence

- Owner: mayf3.
- Selected direction: `SPLIT_LIVE_UX_AND_PROTOCOL_POLICY_EVIDENCE`.
- Mandatory total: 20.
- Dedicated-App plane: 17 gates.
- Pinned-SDK protocol plane: 3 gates.
- Rejected alternatives:
  - require unsafe/nondeterministic quota or network manipulation;
  - treat an impossible real-service recovery state as a stable fixture;
  - use connector mocks, fake SDK, classifier monkeypatching or fabricated attempts/outcomes;
  - weaken product contracts, change SDK revision, or remove the three mandatory gates.
- Remaining Owner input: none for authoring; independent review and acceptance-finalize remain separate lifecycle
  actions.

## 5. Contract

### CTR-TEST-EVIDENCE-PLANE-001 — Mandatory evidence planes are split without semantic change

Exactly twenty mandatory gates remain required. The following three MUST execute through
`PINNED_SDK_PROTOCOL_FAULT_HARNESS`:

```text
TEST-LUX-SDK-ATTEMPTS-PROTOCOL
TEST-LUX-PERMISSION-PROTOCOL
TEST-LUX-FORMAT-PROTOCOL
```

The other seventeen MUST execute with a dedicated non-production App, real Feishu network/service, and real client
observation where user-visible behavior is required. `TEST-LUX-TARGET-REVOKED` remains on the real dedicated-App
plane. Unit tests alone do not satisfy either plane.

## 6. Evidence-plane inventory

### 6.1 Real dedicated-App plane — 17 gates

```text
TEST-LUX-MD-SURFACE
TEST-LUX-MD-HEADINGS-NATIVE
TEST-LUX-MD-NESTED-LISTS
TEST-LUX-MD-CODE-LANGUAGE
TEST-LUX-MD-LINK-BYTE-STABLE
TEST-LUX-MD-TABLE
TEST-LUX-MD-LONG
TEST-LUX-MD-LONG-WITH-TABLE
TEST-LUX-GROUP-MENTION
TEST-LUX-TOPIC-MENTION
TEST-LUX-MENTION-OUTSIDE-CODE
TEST-LUX-NATIVE-NOTIFICATION
TEST-LUX-TOPIC-CONTINUITY
TEST-LUX-P2P-NO-MENTION
TEST-LUX-IDENTITY
TEST-LUX-RECEIPTS
TEST-LUX-TARGET-REVOKED
```

Required live coverage remains:

- one explicit Markdown-surface gate containing heading, list, quote, bold, italic, inline code, fenced code and link;
- native heading normalization under the accepted heading amendment;
- nested ordered/unordered lists, `python` fence/tag, byte-stable link and native table;
- an in-limit input producing exactly one message;
- `>3500` complete ordered native chunks, including the long-with-table composite gate;
- group/topic mention, mention outside code, native notification and topic continuity;
- P2P no mention, openId identity behavior, plain-text/no-mention receipts;
- real revoked target with one same-chat SDK fallback and no connector resend.

### 6.2 Pinned SDK protocol plane — 3 gates

`PINNED_SDK_PROTOCOL_FAULT_HARNESS` MUST:

1. load SDK runtime `ab028f9dbcc09effbdfa4c9885cdcc1f5ecc623f`;
2. invoke the real SDK sender through the normal connector-owned send entry;
3. execute the real SDK error classifier, logical fallback, retry implementation and terminal outcome classification;
4. inject protocol-faithful canonical Feishu error responses only at the SDK raw transport boundary;
5. preserve an auditable ordered trace of raw-boundary inputs/responses, SDK attempts, logical transitions,
   connector counters and terminal outcome.

It MAY provide a protocol-faithful success response after the real SDK performs the required logical transition.

It MUST NOT use a connector mock as substitute, fake SDK, monkeypatch the SDK classifier, call a fallback helper
directly, fabricate attempt counts, fabricate `OUTCOME_UNKNOWN`, use a production App, or use production credentials.
The harness is test evidence infrastructure, not a second product transport.

## 7. Protocol Acceptance and gates

### ACC-PERMISSION-PROTOCOL-001 — Permission denial does not degrade

- Contract: `CTR-TEST-EVIDENCE-PLANE-001`, preserving `CTR-PERMISSION-ERROR-001` unchanged.
- Method: feed a canonical permission-denied Feishu service response at the raw transport boundary while invoking
  the real SDK sender through the connector entry.
- Environment: `PINNED_SDK_PROTOCOL_FAULT_HARNESS` with the exact reviewed runtime.
- Required evidence: raw-boundary response, real SDK terminal classification, endpoint/`replyTo` trace, fallback
  transitions and connector retry/replay counters.
- Expected result: `permission_denied`; fail-loud; `replyTo` not removed; no top-level fallback; no format fallback;
  connector retry `0`; connector replay `0`.
- Failure condition: masking, wrong classification, any degradation/fallback, connector resend or fake SDK path.

### ACC-FORMAT-PROTOCOL-001 — Real SDK performs one logical text fallback

- Contract: `CTR-TEST-EVIDENCE-PLANE-001`, preserving `CTR-FORMAT-FALLBACK-001` and
  `CTR-TRANSPORT-RETRY-001` unchanged.
- Method: first raw-boundary leg returns canonical `format_error`; the protocol harness may return success on the
  second transport leg, but MUST NOT invoke or emulate fallback itself.
- Environment: `PINNED_SDK_PROTOCOL_FAULT_HARNESS` with the exact reviewed runtime.
- Required evidence: original Markdown input, SDK-emitted plain-text second leg, answer/mention comparison, one
  logical transition, SDK transport trace and connector counters.
- Expected result: real SDK automatically performs Markdown → exactly one logical plain-text fallback; same Agent
  answer; mentions preserved; logical fallback count `1`; connector fallback/retry/replay `0`.
- Failure condition: helper/direct fallback, altered answer/mentions, zero or multiple logical fallback,
  connector-owned transition, or success injected anywhere except the allowed raw transport boundary.

### ACC-SDK-ATTEMPTS-PROTOCOL-001 — Retry exhaustion remains truthful

- Contract: `CTR-TEST-EVIDENCE-PLANE-001`, preserving `CTR-TRANSPORT-RETRY-001` and
  `CTR-TRANSPORT-RETRY-002` unchanged.
- Method: independently inject canonical `rate_limited` and canonical ambiguous `unknown` responses through the
  raw boundary for every attempt while invoking the real SDK sender/retry pipeline.
- Environment: `PINNED_SDK_PROTOCOL_FAULT_HARNESS` with the exact reviewed runtime.
- Required evidence: ordered raw-boundary trace, actual SDK retry timings/attempts, connector counters, terminal
  class and replay audit for each independent leg.
- Expected result per leg: SDK attempts exactly `3`; connector attempts `0`; automatic replay `0`; terminal
  fail-loud `YES`. Unknown additionally requires `OUTCOME_UNKNOWN = YES` and
  `VISIBLE_EXACTLY_ONCE = NOT_CLAIMED`.
- Failure condition: manually synthesized count/outcome, wrong count, connector attempt/replay, swallowed terminal
  error or visible exactly-once claim.

### Protocol stable test IDs

```text
TEST-LUX-PERMISSION-PROTOCOL -> ACC-PERMISSION-PROTOCOL-001
TEST-LUX-FORMAT-PROTOCOL -> ACC-FORMAT-PROTOCOL-001
TEST-LUX-SDK-ATTEMPTS-PROTOCOL -> ACC-SDK-ATTEMPTS-PROTOCOL-001
```

All three protocol gates and all seventeen live gates MUST pass before any production canary.

## 8. Explicit replacement map

| Parent evidence fragment | Child replacement | Replacement scope only |
|---|---|---|
| `CTR-TEST-APP-001` requirement that permission/format/exhausted attempts use real-app induction | `CTR-TEST-EVIDENCE-PLANE-001` | evidence environment for exactly three gates |
| `ACC-SDK-ATTEMPTS-EXHAUSTED` Environment / Required Evidence | `ACC-SDK-ATTEMPTS-PROTOCOL-001` | pinned SDK protocol harness |
| `ACC-PERMISSION-ERROR-001` Environment / Required Evidence | `ACC-PERMISSION-PROTOCOL-001` | pinned SDK protocol harness |
| `ACC-FORMAT-FALLBACK-001` Environment / Required Evidence | `ACC-FORMAT-PROTOCOL-001` | pinned SDK protocol harness |
| `TEST-LUX-SDK-ATTEMPTS-EXHAUSTED` execution plane | `TEST-LUX-SDK-ATTEMPTS-PROTOCOL` | protocol gate; same mandatory obligation |
| `TEST-LUX-PERMISSION` execution plane | `TEST-LUX-PERMISSION-PROTOCOL` | protocol gate; same mandatory obligation |
| `TEST-LUX-FORMAT` execution plane | `TEST-LUX-FORMAT-PROTOCOL` | protocol gate; same mandatory obligation |

The parent items remain immutable historical IDs. On this child becoming active, the new items provide the normative
execution environment for only those mapped fragments. All expected product results and failure conditions remain
unchanged.

## 9. Explicitly unchanged authority

```text
UNCHANGED_PARENT_CONTRACTS =
  CTR-PERMISSION-ERROR-001
  CTR-FORMAT-FALLBACK-001
  CTR-TRANSPORT-RETRY-001
  CTR-TRANSPORT-RETRY-002
  CTR-TARGET-REVOKED-001
  CTR-TARGET-REVOKED-002
  ALL_MARKDOWN_CONTRACTS
  ALL_MENTION_CONTRACTS
  ALL_TOPIC_CONTRACTS
  ALL_ROUTER_CONTRACTS
  CTR-PHASE-A-PRECONDITION-001
  CTR-BOUNDARY-001
  CTR-ROLLBACK-001

TEST_LUX_TARGET_REVOKED = REAL_DEDICATED_APP_REQUIRED
CUSTOM_MARKDOWN_CONVERTER = FORBIDDEN
NEW_SDK_REVISION = NO
DEPENDENCY_CHANGE = NONE
PRODUCT_SEMANTIC_CHANGE = NONE
RUNTIME_BEHAVIOR_CHANGE = NONE
```

The split does not convert the seventeen live gates into protocol tests and does not convert the three protocol
gates into optional/unit-only checks. It changes only which qualified environment supplies mandatory evidence.

## 10. Contract coverage and review gate

| Child Contract | Acceptance coverage | Covered |
|---|---|---|
| `CTR-TEST-EVIDENCE-PLANE-001` | `ACC-PERMISSION-PROTOCOL-001`, `ACC-FORMAT-PROTOCOL-001`, `ACC-SDK-ATTEMPTS-PROTOCOL-001`, plus the unchanged seventeen parent live Acceptances | YES |

```text
CONTRACT_COUNT = 1
CONTRACTS_WITH_ACCEPTANCE = 1
MANDATORY_GATE_COUNT = 20
REAL_DEDICATED_APP_GATE_COUNT = 17
PINNED_SDK_PROTOCOL_GATE_COUNT = 3
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
PARTIAL_SUPERSESSION = NONE
AUTHORING_READY_FOR_REVIEW = YES
IMPLEMENTATION_AUTHORIZED_BY_THIS_CHILD = NO
```

Independent review MUST verify the exact proposed head, stable-ID uniqueness, replacement-map narrowness, parent
blob identity, heading-amendment compatibility, `17 + 3 = 20`, SDK pin identity, and that no product Contract or
runtime behavior changed. Acceptance-finalize and merge are separate future Owner actions.
