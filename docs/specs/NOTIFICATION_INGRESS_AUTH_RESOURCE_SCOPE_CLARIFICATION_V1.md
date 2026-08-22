---
spec_id: NOTIFICATION_INGRESS_AUTH_RESOURCE_SCOPE_CLARIFICATION_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
scope:
  - mayf3/dsh-agent-core Notification Ingress OAuth resource and scope literals
governed_by:
  - NOTIFICATION_INGRESS_SERVICE_AUTH_AND_IDEMPOTENCY_V1
  - AGENT_CORE_HARDENING_PROGRAM_V1
external_authorities:
  - repository: mayf3/auth-service
    authority_id: AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_AUDIENCE_CCR_V1
    revision: 159d020b1635cfa7144c8238e9a91d1c6bc268d1
    relation: constrained_by
supersedes: []
superseded_by: null
owners:
  - mayf3
---

# NOTIFICATION_INGRESS_AUTH_RESOURCE_SCOPE_CLARIFICATION_V1

## 1. Goal

以独立 proposed clarification authority 冻结 accepted
`NOTIFICATION_INGRESS_SERVICE_AUTH_AND_IDEMPOTENCY_V1` 中尚未给出精确值的 OAuth resource
与 scope，并精确绑定 auth-service 的 proposed child CCR：

```text
NOTIFICATION_AUTH_SERVICE_REPOSITORY = mayf3/auth-service
NOTIFICATION_AUTH_AUTHORITY_ID = AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_AUDIENCE_CCR_V1
NOTIFICATION_AUTH_AUTHORITY_COMMIT = 159d020b1635cfa7144c8238e9a91d1c6bc268d1
NOTIFICATION_RESOURCE = agent-core-notification-ingress-v1
NOTIFICATION_SCOPE = notification.deliver
```

本轮是 **DOCS / AUTHORITY ONLY**。不修改 accepted Parent normative body，不修改产品代码，
不创建 credential，不写 Grant，不修改数据库或生产环境，不部署、不接受、不合并，也不
开始 Notification implementation。

## 2. Scope and non-goals

### In scope

- 冻结 Parent `C-AUTH-002` 的 exact `resource` 与 exact `scope`；
- 冻结 Parent `C-AUTH-005` 的专属 audience resource literal；
- 取消 operator 对 resource literal 的自由选择；
- pin auth-service authority 的 repository、stable ID 与 exact commit；
- 冻结跨仓库 Audience/Scope/principal profile 的机械一致性。

### Non-goals

本 Clarification 严禁重新讨论或修改：

```text
ALLOWED_CALLERS = [svc-forum, svc-workflow]
AUTH_FLOW = Basic client credential flow
CALLER_PRINCIPAL_ID = verified clientId
VERIFICATION = per-request online token endpoint verification
IDEMPOTENCY_KEY = (callerPrincipalId, requestId)
PAYLOAD_HASH = accepted Parent meaning
RESERVE_BEFORE_ROUTER = YES
OUTCOME_UNKNOWN = accepted Parent meaning
ROUTER_SEMANTICS = unchanged
AGENT_CREDENTIAL_BOUNDARY = unchanged
```

它不是 Notification V2，不改变 Parent 的 status、stable IDs、HTTP behavior、failure mapping、
idempotency state machine、Router contract、Agent isolation、credential presentation、allowlist 或
implementation order。

## 3. Authority and dependencies

```text
REPOSITORY = mayf3/dsh-agent-core
AUTHORITY_BRANCH = main
AUTHORING_BASE = 1c3401a8194a7b6b2ad38031559cbf6c35795f48
LOCAL_PARENT = NOTIFICATION_INGRESS_SERVICE_AUTH_AND_IDEMPOTENCY_V1 (accepted)
PROGRAM_PARENT = AGENT_CORE_HARDENING_PROGRAM_V1 (accepted)
EXTERNAL_AUTHORITY =
  mayf3/auth-service
  AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_AUDIENCE_CCR_V1
  @159d020b1635cfa7144c8238e9a91d1c6bc268d1
EXTERNAL_AUTHORITY_STATUS_AT_PIN = proposed
```

本 Spec 是新的 bounded clarification authority；不 amend、supersede 或重写 accepted Parent。
它只把 Parent 已要求的“本 surface 专属 audience resource”和“固定最小 scope”解析为 exact
literals。外部 authority 仍由 auth-service 拥有；本仓库不能接受、修改或激活它。

在 external authority 独立 review、acceptance 和 merge 前，本 Clarification 即使未来被本地
accept，也不得被解释为 auth-service Audience 已生效或 Notification implementation 已获准。

## 4. Current State

### STATE-NAC-001 — Parent 冻结了机制但未冻结 exact literals

- Subject: `NOTIFICATION_INGRESS_SERVICE_AUTH_AND_IDEMPOTENCY_V1` C-AUTH-002/C-AUTH-005
- As-of commit: `1c3401a8194a7b6b2ad38031559cbf6c35795f48`
- Environment: `mayf3/dsh-agent-core` source repository, `origin/main`
- Observed at: `2026-08-22T09:17:16Z`
- Basis: `OBS-NAC-001`, `EVD-NAC-001`

### STATE-NAC-002 — Exact external authority now exists as a proposed commit

- Subject: auth-service Notification Ingress Audience CCR
- As-of commit: `159d020b1635cfa7144c8238e9a91d1c6bc268d1`
- Environment: `mayf3/auth-service` docs branch; no production state inferred
- Observed at: `2026-08-22T09:17:16Z`
- Basis: `OBS-NAC-002`, `EVD-NAC-002`

## 5. Observations

### OBS-NAC-001 — Parent leaves resource operator-selectable

- Subject: accepted Notification Ingress Spec §§4.2–4.4 and C-AUTH-002/C-AUTH-005
- Source revision: `1c3401a8194a7b6b2ad38031559cbf6c35795f48`
- Environment: clean fresh worktree
- Observed at: `2026-08-22T09:17:16Z`
- Method: direct source inspection
- Result: Parent requires a dedicated resource and minimum Scope, but suggests `urn:agent-core:notification-ingress:v1` and leaves the actual audience literal to operator config; no exact Scope literal is frozen.
- Provenance: `docs/specs/NOTIFICATION_INGRESS_SERVICE_AUTH_AND_IDEMPOTENCY_V1.md`.

### OBS-NAC-002 — Auth authority freezes matching values

- Subject: `AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_AUDIENCE_CCR_V1`
- Source revision: `159d020b1635cfa7144c8238e9a91d1c6bc268d1`
- Environment: `mayf3/auth-service` proposed docs branch
- Observed at: `2026-08-22T09:17:16Z`
- Method: direct source inspection and exact commit pin
- Result: Audience/resource are `agent-core-notification-ingress-v1`, only Scope is `notification.deliver`, and accepted principal profile is service-only machine access with Human/delegated access disabled.
- Provenance: external authority at the pinned commit.

## 6. Claims and assumptions

### CLM-NAC-001 — Exact literals are a bounded clarification

- Support state: SUPPORTED
- Supported by evidence: `EVD-NAC-001`, `EVD-NAC-002`
- Contradicted by evidence: none known
- Uncertainty: none; identity flow, caller set and authorization semantics remain unchanged.

### CLM-NAC-002 — Cross-repo values are mechanically consistent

- Support state: SUPPORTED
- Supported by evidence: `EVD-NAC-002`
- Contradicted by evidence: none known
- Uncertainty: lifecycle remains proposed in both repositories; consistency is source-level, not production effectiveness.

## 7. Evidence relations

### EVD-NAC-001 — Parent source supports the clarification boundary

- Source observations: `OBS-NAC-001`
- Target: `STATE-NAC-001`, `CLM-NAC-001`
- Relation: SUPPORTS
- Bound coordinates: `mayf3/dsh-agent-core@1c3401a8194a7b6b2ad38031559cbf6c35795f48`
- Strength/sufficiency: exact for accepted Parent text
- Limitations: does not activate an external Audience or authorize implementation.
- Provenance: accepted Parent source.

### EVD-NAC-002 — External exact commit supports literal and profile consistency

- Source observations: `OBS-NAC-002`
- Target: `STATE-NAC-002`, `CLM-NAC-001`, `CLM-NAC-002`
- Relation: SUPPORTS
- Bound coordinates: `mayf3/auth-service@159d020b1635cfa7144c8238e9a91d1c6bc268d1`
- Strength/sufficiency: exact for the proposed external authority bytes
- Limitations: proposed external authority is not active until independently reviewed, accepted and merged.
- Provenance: pinned external Spec commit.

## 8. Decisions

### DEC-NAC-001 — Exact resource literal

- Decision owner: mayf3
- Decision: Notification Ingress resource and dedicated audience resource are exactly `agent-core-notification-ingress-v1`.
- Rejected alternative: operator-selected literal, including the Parent's non-binding suggested URN.
- Reason: the verifier request must mechanically match the auth-service Audience registry.

### DEC-NAC-002 — Exact Scope literal

- Decision owner: mayf3
- Decision: the fixed minimum Scope is exactly `notification.deliver`.
- Rejected alternative: wildcard, generic notification Scope, or another Audience's Scope.
- Reason: least privilege and auth-service cross-Audience isolation.

### DEC-NAC-003 — Existing decisions remain closed

- Decision owner: mayf3
- Decision: every Parent ruling listed in §2 remains unchanged; this authority adds literals only.
- Rejected alternative: treat clarification as Notification V2 or reopen auth/idempotency/Router/Agent boundaries.
- Reason: no new evidence or owner request authorizes those changes.

## 9. Contracts

### CTR-NAC-001 — C-AUTH-002 exact parameters

For Parent `C-AUTH-002`, every online token endpoint verification request MUST use:

```text
resource = agent-core-notification-ingress-v1
scope = notification.deliver
```

The implementation MUST NOT source either literal from an operator-selectable semantic value. Config
MAY carry the exact frozen resource only as a validated mirror; any other value is invalid configuration
and MUST fail closed. The existing Basic client-credentials flow, per-request online verification and
management-API prohibition remain unchanged.

### CTR-NAC-002 — C-AUTH-005 exact dedicated audience

For Parent `C-AUTH-005`, the dedicated audience resource is exactly:

```text
agent-core-notification-ingress-v1
```

No alias, URN variant, path, wildcard, trailing slash, query, fragment, case variant, or operator-chosen
literal is permitted. `invalid_target` / `invalid_resource` behavior remains exactly as accepted in the
Parent.

### CTR-NAC-003 — External authority pin

The implementation authority dependency is exactly:

```text
NOTIFICATION_AUTH_SERVICE_REPOSITORY = mayf3/auth-service
NOTIFICATION_AUTH_AUTHORITY_ID = AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_AUDIENCE_CCR_V1
NOTIFICATION_AUTH_AUTHORITY_COMMIT = 159d020b1635cfa7144c8238e9a91d1c6bc268d1
```

A different external commit is not implicitly equivalent. If the auth authority receives any semantic
change, this repository MUST review and pin the new exact revision before implementation.

### CTR-NAC-004 — Cross-repo consistency

The following equalities MUST hold mechanically:

```text
AUTH audience == CORE resource
agent-core-notification-ingress-v1 == agent-core-notification-ingress-v1

AUTH registered scope == CORE exact scope
notification.deliver == notification.deliver

AUTH principal profile == caller client requirement
accepted_principal_types = [service]
machine_access_enabled = true
human_access_enabled = false
delegated_access_enabled = false
svc-forum and svc-workflow = distinct service clients, distinct secrets, no delegation
```

Any mismatch blocks Notification implementation.

### CTR-NAC-005 — No reopened Parent meaning

This Clarification MUST NOT alter allowed callers, Basic credential presentation, verified-clientId
identity, per-request online verification, idempotency key, payloadHash, reserve-before-Router,
outcome_unknown, Router semantics, Agent credential boundary, failure mapping, HTTP contract, or
implementation ordering. Parent stable IDs retain their accepted meaning.

### CTR-NAC-006 — No production effect

Review, acceptance, or merge of this Spec MUST NOT create a credential, apply a Grant, execute an
auth-service migration, modify a database, deploy, or start Notification implementation.

## 10. Acceptance

### ACC-NAC-001 — Exact Parent parameter projection

- Contracts: `CTR-NAC-001`, `CTR-NAC-002`
- Method: machine-extract resource/scope literals from this Spec and compare with the Parent clarification mapping.
- Expected result: exact resource and Scope equality; no alternate operator literal.
- Failure condition: mismatch, alias, placeholder, or operator-selectable semantic value.

### ACC-NAC-002 — External pin and source equality

- Contracts: `CTR-NAC-003`, `CTR-NAC-004`
- Method: read the auth-service Spec at the exact pinned commit and machine-compare Audience, Scope and principal profile.
- Required evidence: repository, stable ID, exact commit, extracted values.
- Expected result: all three cross-repo checks are `MATCH`.
- Failure condition: missing commit, wrong authority, lifecycle ambiguity, or value mismatch.

### ACC-NAC-003 — Existing decision closure

- Contracts: `CTR-NAC-005`
- Method: diff audit proving the accepted Parent file is byte-unchanged and this Spec contains no competing auth/idempotency/Router/Agent contract.
- Expected result: `REOPENED_EXISTING_DECISIONS = NONE`.
- Failure condition: Parent edit or semantic reopening.

### ACC-NAC-004 — Docs/authority-only boundary

- Contracts: `CTR-NAC-006`
- Method: changed-path audit and operational declaration review.
- Expected result: only this proposed docs file changes; no product, DB, credential, Grant, deployment, merge or implementation action.
- Failure condition: any prohibited action occurs.

## 11. Alternatives and disposition

### ALT-NAC-001 — Keep operator-selected resource

- Disposition: rejected
- Reason: cannot mechanically match a single auth-service Audience authority.

### ALT-NAC-002 — Rewrite accepted Parent C-AUTH text

- Disposition: rejected
- Reason: accepted normative stable meaning is immutable; this task requires a narrow child clarification.

### ALT-NAC-003 — Reopen Notification authentication or idempotency

- Disposition: rejected
- Reason: explicitly outside owner scope and unsupported by new evidence.

## 12. Migration, compatibility, and rollback

```text
MIGRATION_THIS_ROUND = NONE
COMPATIBILITY = Parent behavior unchanged; only exact resource/scope literals added
ROLLBACK_THIS_ROUND = close/revise proposed PR; no runtime state exists
PRODUCT_CODE_CHANGE = NONE
DATABASE_CHANGE = NONE
PRODUCTION_CHANGE = NONE
CREDENTIAL_CREATED = NO
GRANT_APPLIED = NO
```

Future Notification implementation remains subject to every Parent dependency gate plus accepted and
merged external/local authority at exact reviewed revisions.

## 13. Open questions

```text
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
PARTIAL_SUPERSESSION = NONE
REOPENED_EXISTING_DECISIONS = NONE
READY_FOR_INDEPENDENT_REVIEW = YES
```

## 14. Frozen summary

```text
CORE_CLARIFICATION_ID = NOTIFICATION_INGRESS_AUTH_RESOURCE_SCOPE_CLARIFICATION_V1
STATUS = proposed
NOTIFICATION_AUTH_SERVICE_REPOSITORY = mayf3/auth-service
NOTIFICATION_AUTH_AUTHORITY_ID = AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_AUDIENCE_CCR_V1
NOTIFICATION_AUTH_AUTHORITY_COMMIT = 159d020b1635cfa7144c8238e9a91d1c6bc268d1
NOTIFICATION_RESOURCE = agent-core-notification-ingress-v1
NOTIFICATION_SCOPE = notification.deliver
CROSS_REPO_RESOURCE_MATCH = YES
CROSS_REPO_SCOPE_MATCH = YES
CROSS_REPO_PRINCIPAL_PROFILE_MATCH = YES
NORMATIVE_DELTA = exact C-AUTH-002 resource/scope and C-AUTH-005 resource literal only
REOPENED_EXISTING_DECISIONS = NONE
PRODUCT_CODE_CHANGE = NONE
DATABASE_CHANGE = NONE
PRODUCTION_CHANGE = NONE
CREDENTIAL_CREATED = NO
GRANT_APPLIED = NO
MERGE_PERFORMED = NO
```
