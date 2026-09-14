---
spec_id: AGENT_CORE_AGENT_SESSION_MESSAGING_V2_DEPLOYMENT_V1
status: proposed
spec_kind: deployment
authority_level: governing_spec
implementation_authority: none
production_apply_authority: none
date: 2026-09-14
revision: r1
scope:
  - bounded production release of accepted Agent Session Messaging V2
  - trace-coordinate send envelope and exact-turn read-only inspection
  - immutable release and rollback artifacts
supersedes: []
superseded_by: null
related_specs:
  - AGENT_CORE_AGENT_SESSION_MESSAGING_V2
  - AGENT_CORE_AGENT_SESSION_MESSAGING_DEPLOYMENT_V1
governed_by:
  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V2
  - AGENT_PROCESS_LIFECYCLE_HARDENING_V2
owners:
  - mayf3
authoring_authority_basis: >-
  OWNER_DECISION=APPROVE_NARROW_AUTHORITY_DESIGN on 2026-09-14 authorizes
  authority authoring and independent review only. It does not authorize V2
  deployment, restart, Auth or Grant mutation, production inspection, Session
  mutation, credential access, or any other production effect.
accepted_date: null
accepted_by: null
accepted_reviewed_head: null
independent_review_result: null
independent_review_blockers: null
---

# AGENT_CORE_AGENT_SESSION_MESSAGING_V2_DEPLOYMENT_V1

> **PROPOSED / NO EXECUTION AUTHORITY.** This document defines one bounded V2
> release path. Until an independent exact-head review passes and Owner `mayf3`
> explicitly accepts that exact head, it authorizes no artifact build, apply,
> restart, Auth change, Grant change, canary, or production mutation.

## 1. Goal and closed scope

Authorize, only after acceptance and every gate below, one controlled Agent Core
production release of accepted `AGENT_CORE_AGENT_SESSION_MESSAGING_V2`:

```text
agent_session_send accepted
→ {targetAgentId, sessionId, messageId}
→ separately granted agent_session_turn_inspect
→ bounded read-only projection of that caller-owned exact native turn
```

This authority adds no dispatch ledger, retry engine, lease, tombstone,
consumption key, Scheduler change, Workflow Execution change, full Session
browser, arbitrary search, Session/message mutation, or credential surface.

## 2. Exact authority and implementation lineage

The normative product authority is accepted
`AGENT_CORE_AGENT_SESSION_MESSAGING_V2` r4, accepted from reviewed head
`b9893400a98f627aa2ce6411e078d6ef03749288` and present at acceptance commit
`e2dce12cd432ee3593d6efdf76e502934d650fa8`.

The only implementation lineage is:

```text
implementation base = 1e1c96e
implementation commits = 9594bf296b7a5d253464ad1c24ca6770ca393f85
                         435cc464877b5761e84108a052a5685ab547b6de
reviewed implementation head = 435cc464877b5761e84108a052a5685ab547b6de
main merge commit = 49a5d42c053401036550aac84d2427a61832a457
```

The implementation-only diff from `1e1c96e` through `435cc...` is the semantic
source. Full blobs from `435cc...` MUST NOT be copied blindly onto the recovered
production face: several contain unrelated changes already present in its main
base. Release preparation must transplant only the V2 implementation diff for
the 14 production paths in §4, then independently prove semantic equivalence to
the reviewed implementation and absence of unrelated deltas.

## 3. Trusted production preimage

Owner accepted the recovered production V1 face as the trusted preimage:

```text
PRODUCTION_PREIMAGE_RECOVERED = YES
observed_at = 2026-09-14 Asia/Shanghai
runtime_pid = 29293
runtime_fresh = YES
production_health = PASS
V2_DEPLOYED = NO
production_root = /usr/local/libexec/agent-core/app
```

The authoring read-only census for the release paths is frozen below. `sha256`
is content SHA-256; all present entries were regular `root:wheel` mode `0644`.

| Path | Preimage | SHA-256 | Bytes |
|---|---|---|---:|
| `packages/agent-router/src/ingress-delivery.js` | PRESENT | `427cd842613c0ddbef4e5d491dbbf7854acb398a93e52c3d4350c134d1fd8d53` | 20690 |
| `packages/agent-router/src/parent-rpc-relay.js` | PRESENT | `ed183a770e6d6688241cbb92ce61bb7e9190662948c1ff9c49ee8a14dd9d8eca` | 6574 |
| `packages/broker/src/capabilities/agent-session-messaging.js` | PRESENT | `da437f2a2f198b971d6bf8415d964cd7ef8531f7b4998b4bef6ec968228a5d9b` | 5444 |
| `packages/broker/src/capabilities/agent-session-reconcile.js` | ABSENT | — | — |
| `packages/broker/src/registry.js` | PRESENT | `31d94430bdd821d23e7795c3ccf31f0c9137ca4fe2ece40c4675c5f89830d133` | 10265 |
| `packages/broker/src/relay.js` | PRESENT | `4c06ec96918250c1b59e61fdb09e91543782880efe45586a3d4edf2814ce5033` | 18180 |
| `packages/broker/src/schema.js` | PRESENT | `18c390be9ad03c7d43449a44d4a8791c8fcbd57fa311b24f9a1c589d802e710c` | 22296 |
| `packages/production-runtime/src/agent-session-messaging-audit.js` | PRESENT | `c1eda9c5b86a90e702f3e61f3ec86506b6f4be21070fb810b22267863af12c42` | 5144 |
| `packages/production-runtime/src/agent-session-messaging.js` | PRESENT | `dc2cbf8fba860335cd151cdf658b203a24ac7822506ab1128d96722856b24b94` | 14237 |
| `packages/production-runtime/src/agent-session/audit.js` | ABSENT | — | — |
| `packages/production-runtime/src/agent-session/projection-redaction.js` | ABSENT | — | — |
| `packages/production-runtime/src/agent-session/runtime.js` | ABSENT | — | — |
| `packages/production-runtime/src/agent-session/turn-inspection.js` | ABSENT | — | — |
| `packages/production-runtime/src/compose.js` | PRESENT | `1bdcec7d4d418aa18e9dbc88c3183f2d2bfde5010872463b72794a08172be2e2` | 24234 |

This census is authoring evidence, not an apply-time assumption. Every value and
the health/generation must be freshly re-read under the production mutation lock.
Any drift stops before mutation and requires a new reviewed release candidate;
this authority does not overwrite drift.

## 4. Exact release closure

The production closure is exactly the 14 paths in §3. Thirteen final paths are
present: eight existing files are replaced and five absent paths are created.
The legacy
`packages/production-runtime/src/agent-session-messaging-audit.js` is absent in
the V2 face. No test fixture, documentation, unrelated package, config, data,
Session JSONL, audit JSONL, credential, launch definition, or environment file
is part of the release.

Release preparation MUST:

1. start from a byte-for-byte copy of the §3 preimage face in an isolated root;
2. apply only the 14-path product-source delta from `1e1c96e..435cc...`;
3. reject any hunk that cannot be mapped mechanically or whose adaptation adds
   behavior not required by accepted V2;
4. produce an ordered immutable manifest of path, existence, SHA-256, bytes,
   type, owner, group, mode, and source-hunk provenance;
5. prove the resulting semantic diff contains only V2 send trace return,
   retained caller-owned coordinate evidence, infrastructure-hidden reconcile,
   exact-turn inspector, projection/redaction, and composition wiring;
6. independently review the exact manifest and every resulting release byte.

The implementation patch SHA-256 for the ordered 14-path binary Git diff is
`868c2f32d06b43c81a60e92ce4b83c6430996ddb3badc756ca530893b965ea28`.
That hash proves lineage, not deployability. The generated release artifact must
receive its own exact hash and review before apply.

## 5. Auth and Grant prerequisites

Before staging Agent Core, Auth must have separately accepted, implemented, and
deployed the exact scope `agent.session.inspect_own_dispatch` on resource
`agent-session-messaging`. Before a positive inspection canary, the exact HR
canonical machine client must have a separately accepted and applied Grant for
that scope. Existing `agent.session.send` authority remains independent and is
not replaced or inferred.

The Agent Core gateway must derive caller identity from its trusted process and
verified token context. No model-supplied caller identity, coordinate possession,
target identity, or Session contents grants access.

## 6. Immutable artifact, apply, and rollback

Before production mutation, an authorized operator must create root-owned,
non-secret release and rollback artifacts. The rollback manifest exactly
reproduces every §3 present byte and metadata and deletes only the five paths
whose preimage is `ABSENT`. It restores the legacy audit module and old compose
face. It never alters Session files, message/history records, audit records,
credentials, grants, or data.

Apply is one serialized transaction under the production mutation lock:

```text
fresh authority/lineage/Auth/Grant/preimage/readiness gates
→ immutable release and rollback artifacts verified
→ replace/create/delete exactly the 14-path face
→ fsync files and directories
→ restart Agent Core parent exactly once
→ prove fresh parent/children, catalog, scope headers, and health
→ run one bounded production canary
→ stop
```

Every final release path must be a non-symlink regular `root:wheel` `0644` file.
No partial face or mixed V1/V2 runtime may remain. A known failure after any file
mutation requires complete rollback, one restart, and fresh baseline health.
An unknown apply/restart outcome requires read-only classification before any
further action; no blind retry is permitted.

## 7. Readiness and canary boundary

Pre-apply gates require:

- exact accepted authority heads and reviewed artifact hashes;
- current production face equals the fresh preimage manifest;
- isolated boot/import rehearsal against the production dependency closure;
- all accepted V2 focused tests and exact-turn fixture tests PASS;
- zero extra path and secret scan PASS;
- Auth registry readback and exact HR Grant readback PASS;
- rollback rehearsal, including legacy audit restoration and five-path removal,
  returns the exact V1 face and health.

The single real canary may use one new harmless HR-to-enabled-target send. It
must receive `{targetAgentId, sessionId, messageId}`, then invoke read-only
inspection with that exact coordinate. Evidence must prove the expected native
turn, messages, tool calls/results, final response, bounded foreign/wrong-turn
denials, resource caps, zero adjacent-turn exposure, and zero content mutation.

The canary MUST NOT resend the historical Workflow
`1a25ed0d-dce6-461c-9c84-b76b352165ec`, trigger a Workflow transition, create a
Scheduler job, use private/credential content, retry an unknown outcome, or
inspect an unrelated coordinate. It performs one send and bounded reads only.

## 8. Failure, safety, and evidence

Any authority, lineage, artifact, metadata, Auth, Grant, readiness, health,
catalog, identity, exact-turn, redaction, bound, adjacent-history, or mutation
check failure stops. If production files changed, rollback runs as §6. Auth and
Grant rollback remain owned by their separate authority and must not be
improvised here.

Evidence records only non-secret hashes, IDs, timestamps, process generations,
closed result envelopes, counts, and sanitized diagnostics. Tokens, credential
values, raw unrelated history, environment dumps, or full Session files must not
enter receipts.

## 9. Acceptance and lifecycle gate

Independent review of this proposed exact head must verify:

```text
EXACT_V2_LINEAGE = PASS
V1_PREIMAGE_AND_EQUAL_FACE_ROLLBACK = PASS
UNRELATED_MAIN_DELTA_EXCLUDED = PASS
EXACT_14_PATH_CLOSURE = PASS
AUTH_AND_GRANT_ARE_SEPARATE_PREREQUISITES = PASS
HEALTH_AND_READINESS_GATE = PASS
ONE_SEND_READ_ONLY_CANARY_BOUNDARY = PASS
NO_SESSION_OR_HISTORY_MUTATION = PASS
NO_SCOPE_EXPANSION = PASS
```

Review PASS makes this document Owner-accept-ready only. On explicit Owner
acceptance of that exact reviewed head, one lifecycle-only commit may change:

1. `status: proposed -> accepted`;
2. `implementation_authority: none -> contracts`;
3. `production_apply_authority: none -> contracts`;
4. the null acceptance/review frontmatter fields to exact accepted values;
5. the proposal banner to an accepted banner that adds no semantic authority;
6. this Spec's README lifecycle/authority cells only.

All other bytes are frozen. A fresh independent final-head recheck must confirm
the exhaustive delta and `SEMANTIC_DELTA=NONE` before merge. Acceptance enables
only the gated path in this document; it is not evidence that any gate passed or
that production changed.

## 10. Alternatives and disposition

- Deploy full `435cc...` blobs: rejected because they carry unrelated base-main
  changes relative to the recovered production face.
- Deploy all of `49a5d...` main: rejected as an unrelated release expansion.
- Modify production Sessions or history for compatibility: forbidden.
- Add a ledger, retry engine, browser, Scheduler, or Workflow behavior: rejected.

## 11. Open questions and current result

```text
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
PRODUCTION_MUTATION_THIS_ROUND = NONE
V2_DEPLOYED = NO
READY_FOR_INDEPENDENT_REVIEW = YES
```
