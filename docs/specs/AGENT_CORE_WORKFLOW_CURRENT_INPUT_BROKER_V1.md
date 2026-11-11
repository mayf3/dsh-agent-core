---
spec_id: AGENT_CORE_WORKFLOW_CURRENT_INPUT_BROKER_V1
status: accepted
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
accepted_by: mayf3-delegated-codex-maintainer
accepted_at: 2026-10-27
accepted_reviewed_head: 92bf0ff2958052c39def7e9b346286de4707ae89
acceptance_record: https://github.com/mayf3/dsh-agent-core/pull/558
independent_review_result: PASS
amendment:
  id: CIB-COMPLETE-BODY-20261027
  status: accepted
  route: AMEND
  base: 4716a9142dbd84fe6aafe0e0dde4fa705481d980
  section: "14"
  contracts: CTR-CIB-006..011
  acceptance: ACC-CIB-004..009
  implementation_allowed: true
  production_apply_authority: none
  note: >-
    Additive complete-body consumer accepted under the existing current-input
    read decision after independent exact-head review. Baseline Contracts and
    acceptance history remain unchanged. Section 14.4 records delegated
    acceptance; final-head review and docs merge precede source implementation.
scope:
  - read-only current Workflow task input capability
governed_by:
  - AGENT_CORE_PRODUCT_ARCHITECTURE_V1
external_authorities:
  - repository: mayf3/svc-workflow
    authority_id: SVC_WORKFLOW_CURRENT_TASK_INPUT_V1
    revision: 52fcb13e63ac7c6696f2c3353ab5a09302cf2014
    relation: interoperates_with
supersedes: []
superseded_by: null
owners:
  - mayf3
---

# Workflow current task input through the generic Broker

## 1. Goal

Make the service-selected input for one current Workflow task directly available to an Agent after long history or compaction, without requiring manual pagination or trusting a stale conversational summary.

## 2. Scope and non-goals

One read-only Broker capability and its default registration, tool guidance, transport/error conformance and isolated verification. No new workflow engine, evidence ledger, monitor, semantic acceptance oracle, privilege, history mutation, or production activation. Existing read and execute tools remain available with unchanged contracts.

## 3. Authority and dependencies

Architecture retains external Workflow ownership and the generic manifest-to-tool bridge. `AGENT_CORE_WORKFLOW_BROKER_ERROR_PRESERVATION_V1` describes the existing declared-error transport family; this Spec does not change its IDs or authorize a history cursor under its excluded scope.

The external service contract is `SVC_WORKFLOW_CURRENT_TASK_INPUT_V1`, owned by `mayf3/svc-workflow`. Its accepted revision is recorded in `external_authorities` following svc-workflow PR #89. Service identity, snapshot, visibility, selection, digest, completeness, stale and body-change behavior remain service-owned. This Spec only binds the consumer protocol; it cannot authorize changes in svc-workflow.

## 4. Current State

`STATE-CIB-001`: at dsh-agent-core `28eee2403e92f3104fce8e153567b395ee187280`, source inspection on 2026-10-27 shows submission history exposes only instance ID and limit; `workflow_my_tasks` provides richer current data but is a worklist, not exact-instance retrieval. Basis OBS-CIB-001 and OBS-CIB-002. Loaded production manifests are not established by this source observation.

## 5. Observations

- `OBS-CIB-001`: source `packages/broker/src/capabilities/workflow.js` at the above revision declares history query `limit` only. Method: read exact Git snapshot.
- `OBS-CIB-002`: public tester trace in `governance-testing-return-loop-observations.json`, SHA-256 `2de46e59cdee6dae95913d7831bc4a663885da710a57f681ef9f063459a8b29a`, observed 2026-10-27, records full correction returned, later compaction and oldest-six reread, followed by stale RETURN reasons.

## 6. Claims and assumptions

`CLM-CIB-001` (SUPPORTED): a limit-only history tool does not provide bounded exact current-input recovery. This does not prove all stale reasoning disappears with a new tool; actual role consumption and independent semantic evaluation remain necessary.

## 7. Evidence relations

`EVD-CIB-001`: OBS-CIB-001/002 SUPPORT CLM-CIB-001 at the pinned source and historical tester trace. Sufficient for the missing read surface, not proof of deployed remediation or future model behavior. Provenance directory: `/Users/yanfenma/workspace/artifacts/workflow-acceptance-binding-20261027/`.

## 8. Decisions

`DEC-CIB-001`: expose one ordinary manifest-backed GET capability. The service selects and authenticates current facts. Broker forwards declared fields and preserves qualified results; it neither reconstructs a snapshot by looping history nor interprets evidence truth. Decision owner: mayf3/delegated maintainer, acceptance bound in PR.

## 9. Contracts

### CTR-CIB-001 — Wire and scope

Capability ID and tool name MUST be `workflow_current_task_input`, sole operation `read`, required scope `workflow.read`. HTTP target MUST be `svc-workflow`, method GET, path `/internal/v1/workflow-instances/{workflowInstanceId}/current-task-input`. No request body, idempotency key or write operation is permitted. Caller identity MUST use the existing parent-derived Broker identity, never a model-supplied principal.

### CTR-CIB-002 — Exact arguments

`workflowInstanceId` is required. The only optional query parameters are `view`, `expectedNodeVisitId`, `expectedWorkflowStateVersion`, `expectedContextRevisionId`, `submissionIds`, `bodyKind`, `bodyId`, `offset`, `expectedBodySha256`. They MUST retain exact camelCase spelling. `view` is `input|body`; `bodyKind` is `CURRENT_DETAIL|SUBMISSION_PAYLOAD`; coordinates and body IDs are UUID strings, state version is integer >=1, offset is integer >=0. `submissionIds` is the service-defined comma-separated list of at most eight UUIDs; the service validates conditional combinations and membership. The Broker MUST reject undeclared arguments by its existing argument-validation behavior and MUST NOT invent missing coordinates or substitute another instance.

### CTR-CIB-003 — Preserve qualification and errors

Successful JSON MUST be forwarded through the existing generic transport without summarizing, truncating, promoting `INCOMPLETE` to complete, or turning absent/invisible sources into a business defect. Exact current coordinates, source IDs, digest, offsets, selection boundaries and completeness indicators MUST survive transport. Declared service errors MUST include `invalid_current_task_input` (422), `current_task_input_stale` and `current_task_body_changed` (409), `current_task_body_not_found_or_not_visible`, `workflow_instance_not_found_or_not_visible` and `principal_not_found` (404), `restricted_history_not_visible` and `principal_disabled` (403), `internal_consistency_error` (500), and `service_unavailable` (503), preserving HTTP status and sanitized request ID through the existing error envelope. Existing auth/scope errors remain unchanged. Unrecognized service errors retain existing canonical status-class fallback; they MUST NOT become success. No Broker-level automatic retries or fallback to oldest history are introduced.

### CTR-CIB-004 — Usable task guidance

Tool descriptions MUST tell the Agent to read current input for its exact assigned instance before evaluating a Workflow task; use the returned coordinates and precise body descriptors after compaction; treat fixed windows as limited selections rather than all-history completeness. `body` reads require the complete coordinate tuple and expected digest from the descriptor, and following `next_offset` retrieves original bytes. On stale coordinates, reread `input`; on changed body, discard previously assembled chunks and start with a new descriptor. Neither response authorizes workflow transition nor proves semantic evidence correctness. Existing execute/CAS and independent review remain authoritative.

### CTR-CIB-005 — Adoption and unattended claim

Default Broker inventory MUST register the capability once. The paired service must be available before declaring it usable; unavailable deployment MUST remain a capability/environment failure, not a product-verification verdict. A claimed unattended workflow validation MUST show actual governed-role consumption of this capability after a seeded stale opinion/compaction condition and zero per-node external correction. Merely registering the tool, passing mocks or sending dispatch messages is insufficient. Source delivery and production adoption MUST remain distinct.

## 10. Acceptance

- `ACC-CIB-001` maps CTR-CIB-001/002: executed manifest-to-HTTP request test binds the exact path/query/scope; unknown or spoofed identity arguments do not become trusted caller data. Required evidence: candidate SHA, command/exit, observed request. Failure: alternate endpoint, extra write, wrong parameter or caller ownership.
- `ACC-CIB-002` maps CTR-CIB-002/003: executed real generic transport tests cover input, a multi-byte bounded body chunk, stale/body-changed 409, masked 404, restricted 403 and invariant 500. Required evidence: exact payload/status/error assertions. Failure: lost coordinates/digest/qualification, mutated originals, normalized success or hidden error.
- `ACC-CIB-003` maps CTR-CIB-004/005: actual isolated role trial reads a long-history task using the returned current-input/body coordinates, encounters corrected RETURN evidence, and completes or formally escalates on the true remaining gate without per-node root advice. Required evidence: source/service/model pins, initial task, public tool calls and receipt readbacks, intervention counter, real terminal state. Failure: old-opinion resurrection without source reconciliation, absent read, scripted preselected verdict, root per-node rescue or completion inferred from activity.

## 11. Alternatives and disposition

- History cursor only: deferred. It removes a tooling omission but still requires the model to assemble a current snapshot across pages.
- Existing `workflow_my_tasks`: retained for discovery; it cannot guarantee one target survives list limits.
- Another supervisor or evidence ledger: rejected; existing service facts and governance roles already own these responsibilities.

## 12. Migration, compatibility and rollback

Additive source capability. Existing endpoints and write semantics remain unchanged. A deployment plan must pair the accepted service surface and Broker manifest; source merge grants no production activation. Rollback removes only new capability registration and retains all workflow facts and historical receipts. An unsupported server yields an explicit failure, never a silent fallback claiming equivalent evidence.

## 13. Open questions

No open owner decisions or normative placeholders remain. The service contract was accepted and merged in svc-workflow PR #89; its exact revision is pinned above. Independent review and delegated acceptance are recorded in PR #558. Implementation requires this accepted authority to be merged into main.


## 14. Accepted amendment: bounded verified complete-body read

**Amendment status:** `CIB-COMPLETE-BODY-20261027` is **accepted** by the
delegated maintainer act in §14.4; docs merge remains required before implementation.
The top-level accepted status and §§1–13 describe the unchanged baseline.
This section adds a separately named read capability; it does not change the
one transparent HTTP capability governed by DEC-CIB-001/CTR-CIB-001–005.
Neither its closed arguments nor its input/body bytes/errors are replaced.
The bounded Decision remains service-owned exact current-input retrieval through
Broker manifests and handlers; no service business rule moves into Agent Core.

### 14.1 Evidence, decision and boundaries

`OBS-CIB-003`: isolated unattended trial `trial-20261027-a9` on 2026-10-27 used
Agent Core `7a2ba8f36f38a8bb86777d98434e6074a31ea815` and svc-workflow
`4eabe824cc4a36bd4c8ac6584adb0aa5a56cd266`. Its public Broker journal has 536
records. Tester call20/result21 received only 2,084 of 50,033 bytes of Submission
`16c727bc-d5c1-4c41-a125-1ee4e2804fe9`, digest
`0e8ab53977b1048ae10313ecc7554ee69eefb898bb3eed69e69f9a0e8ee3b74f`.
Later callers received OMITTED descriptors for that same original. There is no
subsequent body-view request for it. Complete current-detail/currentCorrection
and historical RETURN reads are different originals and do not discharge this
missing read. The frozen task already required full originals and whole-body
hash verification. A9 completed its structural workflow/native goals, but that
fact does not establish complete business-evidence acceptance.

`OBS-CIB-004`: the same public records contain a successfully assembled 64,579-byte
CURRENT_DETAIL for security, digest
`6e1d75adf879a1eaa6cab940feda01fd9e41162a8030f51dd827fb45eaa3693b`.
Its continuation records include 8,190-byte multibyte chunks and an 8,192-byte
chunk. The accepted svc CTR-CTI-004 allows at most 8,192 content bytes per body
response and 65,536 serialized response bytes. Source read at the above svc
commit confirms `body.chunk(offset, 8192)`. Its body total is not a service-wide
65,536-byte limit: that limit applies to one response, not the complete original.

`CLM-CIB-002` (SUPPORTED): truthful per-page reads plus model instructions do not
ensure complete consumption. A deterministic bounded consumer can remove the
manual offset/assembly/hash loop for an exact original. This claim concerns
retrieval integrity, not comprehension or business-verdict correctness.

`EVD-CIB-002`: OBS-CIB-003/004 SUPPORT CLM-CIB-002. Originals are in
`/Users/yanfenma/workspace/artifacts/workflow-unattended-mechanisms-20261027/`:
`a9-gap-minimum-repair-assessment.json` SHA-256
`8411ab4811075326ad196a60e468671712b4d2145816689cceb9511159332d49`, and
`e2e-runs/trial-20261027-a9/independent-business-audit.json` SHA-256
`b2233d9eda85f9a8384564bf5e5008870a35355ce7ec2b35347531d6a43a3c01`.
The latter pins public record lines, role helpers, original digests and candidate
identities. The former independently recounts the missing continuation and
records the frozen task. Neither is conformance Evidence for this unimplemented
proposal; neither proves long-term model reliability.

`DEC-CIB-002` (**accepted**): add a manifest-backed LOCAL handler that composes
existing generic authorized HTTP **body reads** for one exact original. It
starts at byte zero, buffers only bounded memory, validates every page, and
returns the complete verified text or one failure. Existing service selection,
auth/visibility, immutable facts and CAS remain authoritative. This is a third
bounded consumption aid alongside current-input retrieval and compact owned
dispatch observation; prior scoped mechanism Evidence remains valid where
unchanged and is not relabeled a complete business PASS.

No new identity, OAuth client, credential store, HTTP client, filesystem store,
evidence ledger, receipt authority, dispatch engine, automatic retry, source
supersession rule, semantic verdict or workflow mutation is created. The caller
still selects exact required originals from authoritative current input or
explicit same-instance references; this operation does not decide the required
business evidence set. It does not force `workflow_execute` to depend on a read.

### CTR-CIB-006 — Separate closed capability and exact request

Register capability/tool `workflow_current_task_body_complete` once, with the
sole operation `read` and required scope `workflow.read`. It is a LOCAL
manifest-plus-handler capability using the existing trusted Broker call path,
not a new public HTTP endpoint. The argument object has exactly these required
fields and rejects additional properties before credential or network work:

```text
workflowInstanceId: UUID
expectedDefinitionVersionId: UUID
expectedNodeVisitId: UUID
expectedWorkflowStateVersion: safe integer >= 1
expectedContextRevisionId: UUID
bodyKind: CURRENT_DETAIL | SUBMISSION_PAYLOAD
bodyId: UUID
expectedBodySha256: lowercase hex string of exactly 64 characters
```

UUID equality uses parsed UUID identity, as in svc CTR-CTI-001. Normalize the
validated expected UUIDs to canonical lower-case form for comparison; do not
infer, repair or choose a different ID. `CURRENT_DETAIL` requires bodyId equal
to expectedNodeVisitId. There is no caller-controlled offset, limit, timeout,
retry, origin, token, Principal, agent, Session or permission override. The
caller obtains the binding and digest from existing authoritative reads; a
well-formed guessed ID/digest grants no access. Submission membership and full
visibility are still decided by the service on every page.

### CTR-CIB-007 — Reuse transport and identity without alternate authority

The handler MUST use the existing generic HTTP transport, parent-derived caller
identity/credential seam, target binding and scope rules. It MUST NOT acquire
credentials through a different path or implement its own fetch/OAuth client.
Each page is the existing current-task-input GET with `view=body`, the requested
instance, bodyKind/bodyId/expectedBodySha256, the expected visit/state/Context
triple and the internally computed offset. expectedDefinitionVersionId is
checked against every returned binding; it is not an undeclared service query.
No input/history discovery, new service route, write or fallback is allowed.

For this capability only, trusted internal transport execution controls MUST
apply a shared cancellation/deadline, bounded response-body reading, and zero
HTTP retries. These controls are not model arguments and MUST default to the
old behavior for other capabilities. In particular the generic transport's
existing GET-on-401 refresh/reissue MUST be disabled for these pages: the first
401 fails the complete-body operation. An ordinary initial token acquisition or
use of the existing token cache is retained; a denied/failed token request is
not retried. Do not add business-specific branches to generic transport.

Every page is separately service-authorized. The operation is not one database
transaction or a lease over current state; consistency is established by the
exact returned binding, body metadata and whole-body digest. It does not promise
that the binding remains current after the final response. Later mutations
retain their existing fresh-read, actor and CAS requirements.

### CTR-CIB-008 — Validate each page and preserve original bytes

Start offset at zero; do not reuse an inline prefix supplied by the model or a
previous call. After each successful HTTP response, accept only the svc
CTR-CTI-005 body shape: `view="body"`, the five-field Binding, and the
CTR-CTI-004 Body descriptor. Required keys, types, enums and integer ranges must
be valid; extra keys in these closed objects are a protocol error. Reject an
array/null/non-JSON response, malformed UTF-8 or a JSON text value with unpaired
surrogates; never substitute replacement characters.

For every page, including the first and last, verify:

- Binding instance/definition/visit/state/Context equals the validated request.
- kind/id/sha256 equals the requested body; encoding is `utf-8`, serialization is
  `JCS`; total_bytes is a safe nonnegative integer within CTR-CIB-010 and stays
  equal to the first page's total. The expected digest never changes.
- offset equals the next internally expected byte position. The UTF-8 byte length
  of text is at most 8,192, and offset + length is at most total_bytes.
- If the sum equals total_bytes, status is COMPLETE and next_offset is null.
  Otherwise status is TRUNCATED, length is positive and next_offset equals that
  exact sum. No repeated/skipped/backward offset or overlap is permitted in this
  fresh sequential operation. It never sorts or repairs pages.

OMITTED offset0/text empty/next0 is legal in the old **input** view and remains
unchanged. It is not a body page proving progress and is not accepted as a
nonterminal page here. Each next request uses exactly the validated next_offset;
no retry, speculative parallel fetch, automatic descriptor refresh or restart
occurs after any failure or drift. Concatenate the returned UTF-8 bytes exactly;
do not parse/reformat/recanonicalize, summarize or reconstruct the original.

### CTR-CIB-009 — Complete original result, not a metadata substitute

Only after contiguous bytes from zero through total_bytes have been collected,
compute SHA-256 over those exact bytes and compare the requested digest. On
mismatch return the local digest error with no partial original. Successful
`result` is exactly:

```text
{
  view: "complete_body",
  binding: Binding,
  body: {
    kind: CURRENT_DETAIL | SUBMISSION_PAYLOAD, id: canonical UUID,
    sha256: requested lowercase SHA256, encoding: "utf-8", serialization: "JCS",
    total_bytes: integer, offset: 0, text: complete original UTF-8 string,
    next_offset: null, content_status: "COMPLETE"
  },
  verification: {sha256_verified: true, page_count: integer in 1..32}
}
```

Binding uses the existing five snake_case fields and canonical UUID strings.
The text is mandatory and must encode exactly the verified bytes. A digest,
path, reference, excerpt, byte count, hash of a summary, or terminal suffix is
not a successful result. This capability creates no artifact file or durable
read-receipt store. Existing request/audit facilities may record actual calls;
they do not become new evidence sufficiency or mutation authority.

### CTR-CIB-010 — Fixed resource limits and whole-operation failure

The fixed limits are:

| Resource | Limit |
|---|---:|
| Complete original UTF-8 bytes | 131,072 |
| Sequential body HTTP responses/attempts | 32 |
| One decoded HTTP entity body before JSON parsing | 65,536 bytes |
| Cumulative decoded HTTP entity bytes, including an error response | 2,097,152 |
| Monotonic operation deadline, including credential/token/HTTP/read work | 30,000 ms |
| Compact UTF-8 JSON of complete Broker success object, including `{ok,result}` | 1,048,576 bytes |
| Compact UTF-8 JSON of complete Broker failure object | 4,096 bytes |

The entity byte limits apply while consuming the response stream, not only
after unbounded `response.json()`/`text()` buffering. Decode response entity
UTF-8 strictly before JSON parsing; malformed wire bytes must not be replaced. The per-body cap is checked
on the first descriptor before further pages. Check every count/byte/deadline
before issuing another request and before publishing success. At the deadline
abort in-flight HTTP/response consumption, publish failure, issue no further
page, and suppress late results. Token/credential wait must not allow a late
request after deadline. No mutable caller option may raise these limits.

131,072 bytes covers both observed 50,033/64,579-byte originals. The 8,192-byte
page ceiling and 65,536-byte entity ceiling match svc CTR-CTI-004. The larger
success ceiling allows JSON escaping of a complete bounded original; it does
not widen any service page. The page/time limits may still reject a slow or
malformed source within the body-size limit; such rejection is explicit, never
partial success. These limits are a product boundary, not a reliability claim.

Local failures are declared as `current_task_body_protocol_error` (shape,
metadata, binding or pagination violation), `current_task_body_digest_mismatch`,
`current_task_body_limit_exceeded` and `current_task_body_deadline_exceeded`.
Invalid requests retain `invalid_arguments`. Auth/identity/transport failures
and service errors use the existing CIB error family and canonical mapping,
including their status and sanitized downstream request ID where present;
never classify them as business failure or empty complete input. Existing
undeclared-code fallback remains unchanged. No raw body/partial bytes, path,
credential, attacker-supplied argument or error is echoed in a failure detail.
Details for this capability are fixed bounded text; request IDs retain the
existing validated transport source and cannot exceed 128 UTF-8 bytes.

Any denial, malformed page, binding/body drift, digest mismatch, exhausted
budget, parse/read error or cancellation fails the **whole** operation. Discard
the assembly; return no partial-success envelope or continuation token. Failure
normalization also covers mapping/relay/trusted-gateway pre-handler paths for
this new capability. Preserve the original transparent capability's success
bytes, declared errors, auth seam and retry behavior exactly.

### CTR-CIB-011 — Guidance, non-effects and honest acceptance

Default inventory/relay/gateway/tool mapping MUST expose this new capability
once under the existing parent-derived actor. The tool description must say:
first obtain an authoritative current descriptor, then supply its exact full
binding and body identity/digest to get that original; separately fetch every
required distinct original. Failure does not authorize transition or automatic
retry. Received-and-hash-verified bytes do not prove that the Agent understood
them, that evidence is sufficient, or that a business verdict is correct.

No workflow Event/Submission/Receipt, success audit, Context revision, dispatch,
process activation, scheduler action or other business mutation is permitted.
The service's existing denial audit and Broker's existing audit remain allowed.
No fallback to the old tool silently claims equivalent complete-body semantics.
An old server/unsupported surface fails visibly. Rollback removes only this new
registration/handler; old supported reads and historical facts remain intact.

A claimed unattended repair must show actual role use on the exact required
originals, independent full-byte/digest verification and the existing stage's
business evaluation after cutoff, not just helper tests or graph advancement.
Typed required-original references and program-generated measured digests may
be used in the isolated task fixture through its existing Context/Submission
and ordinary schema; they are not a new authority ledger or an automatic truth
oracle. This Spec does not add a mandatory read-to-ADVANCE gate, change ACB,
force future-stage evidence on earlier nodes, or authorize production adoption.

### 14.2 Acceptance for the additive amendment

All six cases bind exact Spec/candidate/service revisions, environment,
request/result originals and actual command exits. Definitions below are not
executed Evidence. Use isolated services/databases and synthetic identities;
no production credentials, old instance writes or production deployment.

#### ACC-CIB-004 — Closed identity-neutral request and real call path

- Contracts: CTR-CIB-006, CTR-CIB-007, CTR-CIB-010, CTR-CIB-011.
- Method/environment: manifest→Broker invoke→relay/trusted gateway→existing
  generic HTTP transport with instrumented synthetic authorization/service.
- Required evidence: exact request query/scope, actual credential/HTTP counts,
  unknown-field/partial binding/invalid UUID/state/hash/actor-override negatives,
  direct gateway and mapped tool envelopes.
- Expected result: one registration, trusted caller only, no HTTP for invalid
  arguments; authorized body pages use only the existing endpoint and arguments.
- Failure condition: identity override, separate HTTP/auth client, undeclared
  query, invalid request reaches transport, pre-handler content leak or >4,096-byte
  error, or a descriptor is accepted as a complete original.

#### ACC-CIB-005 — Real complete originals and exact Unicode bytes

- Contracts: CTR-CIB-007, CTR-CIB-008, CTR-CIB-009, CTR-CIB-011.
- Method/environment: actual paired svc HTTP + new isolated PostgreSQL fixture;
  old input descriptors include TRUNCATED and legal zero-byte OMITTED. Read the
  exact 50,033-byte corrected Submission and 64,579-byte CURRENT_DETAIL fixture
  shapes (their new run-specific identities/digests must be recorded), plus
  ASCII/emoji/multibyte/JSON-escaped content and a one-page original.
- Required evidence: observed old descriptors, all actual page requests/results,
  final full text, byte counts, independent SHA and exact binding/identity join.
- Expected result: complete original from offset zero with no duplicate calls;
  UTF-8 bytes equal service originals, digest and page_count match. Another
  currentCorrection/RETURN body cannot substitute for the required Submission.
- Failure condition: missing/truncated returned text, altered canonical bytes,
  wrong source, omitted original, metadata-only success or false business PASS.

#### ACC-CIB-006 — Fail closed on drift, corruption and malformed pages

- Contracts: CTR-CIB-008, CTR-CIB-009, CTR-CIB-010.
- Method/environment: instrumented real generic transport with controlled
  downstream page responses; real svc stale/body-change/visibility cases.
- Required evidence: same triple but changed detail digest; changed definition,
  instance, visit, Context, total, kind/id/hash; missing/extra keys; invalid UTF-8,
  unpaired surrogate, wrong offset/length/next/status, repeated/overlapping/gapped
  pages; final digest mismatch, empty nonterminal or OMITTED body page.
- Expected result: every case returns one declared failure, no original bytes,
  no subsequent page and no restart; actual service 409/403/masked404 preserved.
- Failure condition: partial success, repaired/fuzzy identity, automatic refresh,
  cross-snapshot assembly or hidden loss of qualification.

#### ACC-CIB-007 — Actual resource bounds, cancellation and no retry

- Contracts: CTR-CIB-007, CTR-CIB-009, CTR-CIB-010.
- Method/environment: fake-clock unit coverage plus streaming HTTP fault fixture
  through the same generic transport; no provider/model call is needed.
- Required evidence: size/output/entity/cumulative/page exact-boundary and +1
  cases; chunked oversized entity stopped before unbounded buffering; tiny
  positive chunks exceeding32 pages; delayed credential/token/header/body,
  401, service/transport error, cancellation and late response.
- Expected result: within-limit valid body succeeds; all over-limit/deadline
  cases fail without partial text or further request. A401 produces exactly one
  body GET, no token-refresh/reissue; deadline covers all work and aborts pending
  HTTP. Old transparent HTTP capability retains its existing retry semantics.
- Failure condition: caller-raised limit, unbounded response buffering, retry,
  >32 attempts, late success, non-fixed leaked error, or cap applied only after
  allocating an unbounded response.

#### ACC-CIB-008 — Existing mechanisms and zero business effects

- Contracts: CTR-CIB-007, CTR-CIB-010, CTR-CIB-011.
- Method/environment: affected old current-input/input/body and generic transport
  conformance tests plus paired isolated service before/after fact counts.
- Required evidence: exact old argument/response/error compatibility assertions,
  unchanged caller/scopes, grants and service paths, business count diff, retained
  denial-audit behavior, old-server failure and rollback inventory check.
- Expected result: old reads byte-compatible; no new auth path/privilege,
  workflow facts, files, task/ledger, dispatch or production effects. The new
  caller cannot bypass server visibility. Unaffected native/compact-status
  evidence is impact-rebound, not rerun merely for a new commit.
- Failure condition: old public-contract change, business write or side-effect,
  alternate ledger, changed server selection, or reused Evidence represented
  as new runtime execution.

#### ACC-CIB-009 — Unattended use with truthful completion boundary

- Contracts: CTR-CIB-009, CTR-CIB-011; existing ACC-CIB-003 remains unchanged.
- Method/environment: fresh isolated governed-role trial with frozen required
  exact originals, seeded obsolete RETURN, distinct correction bodies and the
  existing native continuation/compact-status mechanisms. One initial trigger;
  no per-node root correction. Preserve the old a9 record.
- Required evidence: exact body tool requests/results/full SHA for each required
  source, role semantic evaluation and real stage receipts, program-generated
  deployment digest records checked against actual task-owned bytes, intervention
  counter and true terminal/process exit facts.
- Expected result: complete originals consumed through the new tool, no different
  body substituted, no digest transcription corruption, truthful completion or
  formal escalation on an actual remaining stage gate. Full retrieval alone is
  never reported as semantic QA PASS or long-term reliability.
- Failure condition: missing required original, scripted verdict, wrong measured
  digest, root-supplied post-cutoff repair, future deployment gate on an early node,
  or graph/native completion used to conceal an unmet business evidence item.

### 14.3 Alternatives, lifecycle and stop

- More repeated prompt instructions: rejected as the primary correction; the
  frozen task already contained them. Necessary tool guidance remains.
- Replacing the old transparent read with this loop: rejected; it changes a
  closed accepted protocol. Retain both distinct supported responsibilities.
- Returning only a file/ref/hash: rejected for this slice; full text is required,
  and no new filesystem authority or store is necessary.
- Service-side new endpoint or read-to-transition proof ledger: deferred; the
  existing service already supplies exact authorized digest-bound pages. Strong
  bypass-proof workflow read enforcement is a different unaccepted product
  requirement and is not smuggled into this read capability.
- General Workflow adapter, semantic evidence engine or automatic retry:
  rejected; service facts and existing governance remain their owners.

Implementation is forbidden until this additive amendment is independently
reviewed, accepted by mayf3 or an explicitly delegated maintainer at the exact
reviewed head, lifecycle-final-head checked and merged into the authority base.
The author cannot accept it. Acceptance, source implementation, isolated
verification, broader business closure and production adoption are separate.
Stop this authoring task at the clean reviewable docs commit and its checks.

### 14.4 Delegated maintainer acceptance act — 2026-10-27

The root maintainer records **ACCEPTED** for the exact additive Contracts and
Acceptance definitions independently reviewed at
`66ec1202717a221cf74d0571fc1cf0387fbbe099`. The proposed Spec SHA-256 was
`ba1afec92fa625a2aa010d12e92d16fc67bb342e6346e5261cbf865005e299e2`.
Independent non-author review `independent-review-66ec1202.json`
(SHA-256 `aa8cb1abe39f02051716e16ce163c7ffd0c6ca518f76c36e8b7c4ab4488a842e`)
returned PASS with no blocking findings.

Acceptance actor: root coding maintainer under the user's explicit continuing
delegation “接受，全权交给你定就行” and instruction to implement and validate
unattended Workflow completion. This is the delegated maintainer's act, not a
claim that the user separately reviewed this text or that the author self-accepted.
The exact reviewed bounded read capability is accepted; production apply remains
**none**. No CTR-CIB-006–011 or ACC-CIB-004–009 text changes in this lifecycle act.
The independent final-head lifecycle delta check and docs merge receipt are
required before source implementation. Retrieval, business evaluation, autonomous
full acceptance, and production adoption remain separate claims.
