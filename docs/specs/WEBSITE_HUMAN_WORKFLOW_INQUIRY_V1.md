---
spec_id: WEBSITE_HUMAN_WORKFLOW_INQUIRY_V1
status: accepted
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
accepted_date: 2026-10-15
accepted_by: mayf3
accepted_at: 2026-10-15T11:02:18Z
accepted_reviewed_spec_commit: cec853e9163dc99de09abaf3bf806755e50c2d23
accepted_reviewed_spec_sha256: 9e13ffe2da20af1df48df1c49f7270bad86baba8081ce8ecb3c17796636bf819
acceptance_source: https://github.com/mayf3/project-progress-desk/pull/7#issuecomment-6190498903
acceptance_hub_commit: a58f65f99f1523a5b08abd6bd8eedc4f2599d7b6
acceptance_authority_basis: >-
  Owner mayf3 explicitly instructed: "确认接受 PR #7（a58f65f）所列四份精确合同及本站计划，按原流程完成最终复核、合并并继续非生产源码实现。新增 Grant、凭据、发布、加载或启用前再给我具体差量确认，其余已授权工作直接推进。"
  The linked Agent-authored comment faithfully records the human quote; it is not
  reviewer acceptance. The exact hub commit lists this reviewed Spec commit/hash
  and its independent ACCEPT recommendation (zero blockers). Final lifecycle-only
  Head still requires independent recheck before authority-branch merge.
scope:
  - website Human workflow-facts inquiry to one server-bound Agent pilot through the original controller and Router
  - request-owned durable authorization, native trace, result, history and events
governed_by:
  - AGENT_CORE_PRODUCT_ARCHITECTURE_V1
  - AGENT_WORKSPACE_SESSION_MODEL_V3
  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V2
external_authorities:
  - repository: mayf3/auth-service
    authority_id: MINIMAL_AUTH_FOUNDATION_V2
    revision: 862eab36677d214b2ce340f49bb141173b51efea
    relation: depends_on
supersedes: []
superseded_by: null
owners:
  - mayf3
authoring_base: 04cd3b066116041a7be9663417775a2ac8dd331c
date: 2026-10-15
revision: r2
---

# WEBSITE_HUMAN_WORKFLOW_INQUIRY_V1

**ACCEPTED / DOCS-ONLY / NOT_IMPLEMENTED.** Owner mayf3 accepted the exact reviewed r2 proposal at `cec853e9163dc99de09abaf3bf806755e50c2d23` (Spec SHA256 `9e13ffe2da20af1df48df1c49f7270bad86baba8081ce8ecb3c17796636bf819`) through the attributable quote and frozen PR7 hub coordinate above. This lifecycle record changes no r2 Contract or Acceptance meaning; the authoring route and §13 output below remain historical r2 authoring coordinates. `implementation_authority: contracts` takes effect only after independent final-Head recheck and authority-branch merge. `production_apply_authority: none` remains binding; new Grant, credentials, publication, loading or enablement require the Owner's later concrete-delta confirmation. No installed capability or live inquiry result is claimed.

## 1. Goal

One authorized website Human can ask the existing Agent selected by one server-fixed, preprovisioned Product Surface Binding about facts, gaps and next steps within that Agent's existing authority; the original controller transports that exact intention and discovers its exact reply. This first slice is `BOUND_AGENT_PILOT`, not automatic Workflow-instance→Owner/assignee resolution. Admission, inbox delivery, execution, reply availability and Workflow business outcome remain distinct facts.

```text
AUTHORITY_ACTION = NEW
PLAN_LEVEL = EXEC_PLAN
ASSURANCE_LEVEL = CONTROLLED
ROUTE_STAGE = AUTHORITY_AUTHORING
AUTHORITY_ACCEPTED_IN_BASE = NO
DOCS_FIRST_REQUIRED = YES
GOAL_OR_TARGET = one reliable request-bound website inquiry
CURRENT_GAP = no accepted website Human bound-pilot admission, transport delegation or durable own-result contract
DONE_WHEN = this bounded candidate is ready for independent exact-head semantic review
EXPANSION_TRIGGER = required change to an accepted closed interface, identity protocol, or business permission
```

## 2. Scope and non-goals

In scope: server-fixed unique authorized Product Surface Binding→exact enabled Agent; Human online preauthorization; one original controller redeeming that intention using its own identity; original Router/native main; durable RID/native-coordinate/result binding; request-owned final-text history/events; default-OFF controls. Existing main is reused. Absent main requires explicit, atomically enforced confirmation. Question text may ask `workflow_facts`; it does not authorize Native Human to read Workflow on the user's behalf, and the Agent only uses its own existing grants.

Out of scope: automatic Workflow-instance→Owner/node/assignee resolution, Workflow transition/action, creating a Workflow or Agent, broader HR recovery, A2A impersonation/inspection grants, arbitrary Agent/Session selection, full-main/archived history, raw journal/tool/reasoning access, credentials in Site queues, second controller/watcher/timer/CLI, retry engine, old UNKNOWN replay/fence clearing, changing ASM/Notification/MCP authorities, or accepting Gateway/Auth/Site-owned behavior here.

## 3. Authority and dependencies

`AGENT_CORE_PRODUCT_ARCHITECTURE_V1` owns Agent/Session/Router boundaries; D-008 (`AGENT_WORKSPACE_SESSION_MODEL_V3` §§18,22) owns Human→selected Agent/main and target-owned execution grants. This Spec creates the independent website request protocol, not a Session engine. Accepted ASM V2 exact receipt/turn mechanisms and exact Principal resolver may be reused only inside their existing contracts; their A2A grants do not authorize this caller.

The Auth V2 pin in frontmatter is a dependency expectation, not authority to register clients or redefine Auth. `docs/contracts/minimal-auth-v2/MINIMAL_AUTH_FOUNDATION_V2.md` incorporates unchanged v1.3.0 modules `claims-and-profiles.md`, `human-session-refresh.md`, and `grants-and-audiences.md`; fixed issuer is `auth-service`, RS256. Current acceptance/exact modules were source-read (OBS-WHI-005) and MUST be rechecked before implementation relies on that pin. New website registration is separately owned by Auth. Public Auth hosting origin `https://auth.mayf3.com` requires its owning accepted hosting authority; this document does not operate hosting.

Gateway `MOBILE_PUBLIC_REMOTE_GATEWAY_V2` at `mayf3/agent-core-remote-gateway@02a2b8e94fada84a7dc1f5847c9d89c78cd2206f` is a constrained external boundary: its exact Android-only routes/header/CORS rules do not admit this website. A separately accepted whole-authority successor, its exact pin and conformance are mandatory before website public exposure. The concurrent V3 proposal is not an accepted dependency. This Spec cannot accept or amend it.

The Site PR7 draft and `DSH_MCP_NATIVE_CONVERSATION_V1` proposal are design inputs only, not governing dependencies. MCP remains a distinct surface and writer. The base's vendored V3 governance/lock is proposed; active accepted adoption V2 controls the docs-first boundary. No accepted authority is amended or partially superseded here.

`GAP-WHI-001` remains LOAD_BEARING only for the deferred `WORKFLOW_INSTANCE` resolution mode: no accepted source-owned Human/object-authorized Workflow/Agent-directory provider was established by the inventory of D-008, ASM V2, exact Principal resolver V2, Mobile history/auth and Auth V2. A website JWT sent to a machine reader, or admin read then frontend filter, is a reachable unauthorized-disclosure counterexample. That mode returns `NOT_SUPPORTED` before protected Workflow/directory reads. Its future minimum closure is an owning-source accepted Human/object read contract with exact pins/ACL proof; no borrowed Agent/MCP credential. This dependency is removed from `BOUND_AGENT_PILOT`: this Spec defines new local Human ACL over exactly one preprovisioned binding and reuses pure Router/Definition reads, not another service's source role. It does not claim the Workflow gap solved.

## 4. Current State

`STATE-WHI-001`: source-only projection at DSH `04cd3b066116041a7be9663417775a2ac8dd331c`, observed 2026-10-15: website inquiry endpoints are absent; existing Mobile and ASM callers have different identity/ownership contracts; pure internal Binding/Definition reads exist. Basis: OBS-WHI-001/002/006 and EVD-WHI-001/004. No production/client/Grant/main/body state is inferred.

`STATE-WHI-002`: Gateway source at `02a2b8e94fada84a7dc1f5847c9d89c78cd2206f`, observed 2026-10-15: accepted V2 strips external Bearer, fixes Android client/audience, rejects CORS/OPTIONS and closes the route list. Basis: OBS-WHI-003/EVD-WHI-002. Runtime registration and installation are UNOBSERVED.

## 5. Observations

- `OBS-WHI-001`: DSH source/base above; local read-only `rg` of `packages/product-api/src`, `packages/production-runtime/src`, `packages/agent-router/src` on 2026-10-15 found no `website-inquiries` route. `packages/product-api/src/index.js:226-245,290` accepts Mobile surface/text and projects reply without request-owned Human authorization. This is a bounded source census, not runtime observation.
- `OBS-WHI-002`: same base/date, direct reads of `AGENT_CORE_AGENT_SESSION_MESSAGING_V2` CTR-004/009/011/012 and `MOBILE_SESSION_HISTORY_V1` CTR-001/010: ASM native messageId anchors an exact turn; caller-owned inspector proves inter_agent source; Mobile history requires Tailnet Node/surface and forbids public activation without independent auth authority. D-008 §§18,22 preserves main/Agent security ownership.
- `OBS-WHI-003`: Gateway source/pin above, local read 2026-10-15, `docs/specs/MOBILE_PUBLIC_REMOTE_GATEWAY_V2.md` CTR-BOUNDARY-001/AUTH-002/HTTP-004/005: five closed business routes, Android identity profile, Authorization stripping and no CORS; new routes require whole-authority supersession.
- `OBS-WHI-004`: authored task/parent instruction on 2026-10-15 supplies explicit proposal defaults and docs-only scope; no credential, private mapping, rejected instance or production log was read. Authority sources remain the accepted documents, not this instruction.
- `OBS-WHI-005`: Auth source `862eab36677d214b2ce340f49bb141173b51efea`, local read-only `git rev-parse HEAD` and direct reads on 2026-10-15 of the V2 authority and incorporated `claims-and-profiles.md`/`grants-and-audiences.md`/`human-session-refresh.md`: V2 status is accepted, whole-replaces V1 with unchanged1.3.0 modules; Human has no scope, sub is Principal UUID, Service direct token is supported, grants are distinct from domain authorization, logout access tokens remain valid until exp. These are repository facts, not runtime registrations.
- `OBS-WHI-006`: DSH same exact base/date, direct source reads: `binding-resolution.js:275-277` implements getBinding as store.get+copy, absent→undefined; Router index exports getBinding/channelConversationId; `agent-definition/src/definition.js:337-344` getAgent is exact ID and returns disabled records, with no Auth Principal/domain field. `session-history/src/index.js:120-139` composes Binding→Definition without creating either; locator/snapshot/ids provide confined canonical-main header parsing/generation digest. `demo-server/src/session-seam.js:218-224` obtains real createUserMessage.id before followup and preserves source:{kind:user}. These are internal mechanisms, not a currently authorized Human endpoint or runtime pilot binding.

## 6. Claims and assumptions

`CLM-WHI-001` (SUPPORTED, EVD-WHI-001): existing native machinery is reusable but neither existing caller contract grants website Human admission/result access. Limit: source and authority coverage, no deployed capability claim. `CLM-WHI-002` (SUPPORTED, EVD-WHI-002): website public exposure needs separately owned Gateway authority. `CLM-WHI-003` (INFERRED, EVD-WHI-003): online Human preauthorization plus request-bound authenticated redemption avoids putting Human bearer in an ordinary queue. `CLM-WHI-004` (SUPPORTED, EVD-WHI-004): one bound-Agent pilot can resolve using local metadata without the deferred Workflow provider. These require implementation/evidence; no runtime binding or delivery guarantee is claimed today.

## 7. Evidence relations

- `EVD-WHI-001`: OBS-WHI-001/002 SUPPORT CLM-WHI-001 and STATE-WHI-001, DSH exact base/source-only/2026-10-15. Sufficient for missing-contract classification; not deployed grants, persistence or business acceptance. Provenance: named source and accepted Contracts in OBS-WHI-001/002.
- `EVD-WHI-002`: OBS-WHI-003 SUPPORTS CLM-WHI-002 and STATE-WHI-002, Gateway exact pin/source-only/2026-10-15. Sufficient for closed boundary; no runtime traffic proof. Provenance: named Gateway Contracts.
- `EVD-WHI-003`: OBS-WHI-001/002/004 SUPPORT CLM-WHI-003 at this authoring base/document context. Sufficient to justify proposed direction, not implementation conformance. All ACC rows below are future test definitions, not executed Evidence.
- `EVD-WHI-004`: OBS-WHI-006 SUPPORTS CLM-WHI-004 and STATE-WHI-001, DSH exact base/source-only/2026-10-15. Sufficient for the bounded internal read/native ID primitives; not proof of active Binding, current permission, new main metadata wrapper or source-custody implementation. Provenance is the exact source named in OBS-WHI-006.

## 8. Decisions

Owner for every proposed Decision is repository owner `mayf3`; none is accepted by this text.

- `DEC-WHI-001`: Human authorizes the exact frozen request online; original controller redeems only that record under separate machine identity. Reject machine bearer as Human authority or queued Human token; separate authorization from transport.
- `DEC-WHI-002`: first resolve only the unique server-fixed authorized original Product Surface Binding. Keep caller Human and Site Owner binding distinct from unprojected Workflow Owner/assignee. Defer automatic Workflow targeting with NOT_SUPPORTED; reject name/email inference, frontend Agent selectors and privilege additions to make lookup pass.
- `DEC-WHI-003`: original Router owns one native admission and main. Independent website request provenance preserves existing ASM origin/interface meanings. Reject bypassing the Router or adding Human kind to ASM's closed sidecar under this Spec.
- `DEC-WHI-004`: durable pre-effect consumption, exact native coordinate and retained request-owned results; uncertainty never authorizes replay. Reject timestamps/last-message/model self-report as reply association.
- `DEC-WHI-005`: request-owned final-text history, bounded authenticated events and explicit expiry; no full conversation import. Reject tool transcript as website context and raw-main read grants.
- `DEC-WHI-006`: freeze the defaults in CTR-001..012 now; actual identities/configuration and controlled rollout remain separately approved. No new business action authority or per-turn sandbox is claimed.

## 9. Contracts

### CTR-WHI-001 — Boundary, configuration and support matrix

All new routes MUST be absent/disabled by default. Missing required configuration yields `503 NOT_PROVISIONED`, never empty success. The server-controlled registry MUST have exactly one entry per enabled pilot Human/scope: `{binding_id,version,enabled,site_project_id,site_owner_id,issuer,auth_subject,human_principal_id,communication_scope_id,pilot_surface:{channel,external_id,expected_agent_id},allowed_operations,transport_client_id,transport_principal_id,exact_web_origin}`. Channel/external_id identify a separately preprovisioned original Router binding, are never browser/model inputs, and MUST NOT reuse an unrelated Mobile/Feishu surface. Allowed operations are only bound resolve/preauthorize/own-read/own-events. No wildcard/list of alternative Agents or Workflow source read grant is created. Values MUST be independently verified through original lawful metadata/roles; auth_subject and human_principal_id both equal verified Auth V2 sub, with no name/manual identity substitution. Ordinary config revisions MUST NOT change scope identity or make an old RID new. No actual UUID/pilot Agent/binding is populated by this proposal; Router binding provision/new Human access configuration require their own concrete approval. “Preprovisioned” is a required runtime precondition, not an assertion that a binding exists or that source capabilities are installed/loaded.

| Surface | Minimum support | Forbidden/default unsupported |
|---|---|---|
| Website Human | empty-input unique bound-Agent resolve; exact online preauthorization; own result/history/events | Workflow-instance resolve; arbitrary Agent/Principal/session inputs; workflow actions; full main |
| Original controller | redeem an existing authorized intention; its bound result/events | authorizing a Human; arbitrary send/resolve; MCP credentials; internal endpoint via public Gateway |
| Native runtime | existing main, exact inbox/turn/final text, request-owned durable projection | new per-request Session, second Router/sender, old UNKNOWN replay |
| Pilot | one explicitly approved Human/Site Owner/Product Surface/Agent binding | unverified runtime values, broader fleet rollout, claiming Workflow automatic targeting |

### CTR-WHI-002 — Human and controller authentication

Human profile MUST use auth-service `public_browser`, authorization_code+PKCE S256, client `project-progress-desk-web-v1`, audience `agent-core-website-human-v1`, no client secret and no invented OAuth scope claim. DSH MUST independently verify original Auth-signed Bearer: `iss=auth-service`, RS256, resolvable kid, exact audience/client, `principal_type=user`, access token use/type/version/iat/nbf/exp/jti and forbidden-claim rules under pinned Human profile (60s skew, nominal TTL900s). Signature/profile failure is 401; valid wrong client or absent current app permission is 403. Trusted context derives Human and Site Owner from the registry; caller headers/body cannot select them. Gateway transport MUST preserve that Bearer only on separately authorized new Human routes; no Gateway-issued identity assertion is accepted.

Controller proposal is separate client `agent-control-website-inquiry-v1`, resource/audience `agent-core-website-transport-v1`, scopes exactly `conversation.intent.redeem conversation.own_result.read conversation.own_events.read`. The actor MUST be the same original queue controller, never an additional Site-specific executor. It supplies a dedicated server-side Basic service credential to the private DSH endpoint. DSH MUST authenticate it afresh for each internal call through fixed `https://auth.mayf3.com/oauth/token`, `grant_type=client_credentials`, fixed resource and the requested operation's one scope; redirects and token/credential/authorization-decision caching are forbidden. Validate successful issuance, verified client/Principal and returned issuer/audience/service profile against the registry. This uses Auth's existing issuance mechanism, not MCP/Notification resource or identity. Invalid credential=401, verified but wrong grant/binding=403, timeout/network/5xx/malformed issuance=503 `AUTH_INCONCLUSIVE`; all precede target/result reads and Router calls. Auth-owned supported registration/Grant configuration and exact runtime identities MUST be established separately; absence keeps this profile disabled.

Every operation MUST check the current application ACL/registry and applicable machine Grant. A disabled Owner/transport binding denies the next call, including cached result reads. Ordinary Human logout does not retroactively cancel an admitted message: offline JWT can remain valid until original exp (nominal ≤900s); no immediate Auth logout detection is claimed. No bearer/Basic secret/minted token may enter queues, business records, URLs, localStorage, comments, logs, Agent environment or model context.

### CTR-WHI-003 — Exact HTTP and closed DTOs

Public candidate prefix is `/v1/website-inquiries`; private controller prefix is `/internal/v1/website-inquiries`. Only these anchored method/path pairs exist; public Gateway MUST NOT expose `/internal`:

| Method/path | Exact input | Success payload |
|---|---|---|
| POST public `/resolve` | exactly `{}` or `{workflow_instance_id}` | `{target_handle,resolution}` for bound pilot; Workflow mode is NOT_SUPPORTED |
| POST public `/authorizations` | `{request_id,target_handle,message,purpose,context_refs,allow_create_main}` | `{request}`; durable preauthorization only, no send |
| GET public `/requests/{rid}` | query `content_cursor?` | `{request,result,body_page}` |
| GET public `/history` | query `limit?,before?,agent_id?,workflow_instance_id?,request_id?` | `{requests,has_more,next_cursor,coverage}` |
| GET public `/events` | query `limit?,cursor?,request_id?` | `{events,has_more,next_cursor,coverage}` |
| POST private `/requests/{rid}/redeem` | `{message,context_refs}` | `{request}`; existing RID only |
| GET private `/requests/{rid}` | query `content_cursor?` | same own-request payload |
| GET private `/events` | query `limit?,cursor?,request_id?` | bound request events only |

Unknown/duplicate fields/query keys, wrong methods, POST query strings, noncanonical/encoded paths and invalid types MUST be rejected before effect. POST requires exact `application/json`; complete framing/size validation precedes upstream or native writes. Request body maximum is 1,048,576 UTF-8 bytes. `request_id`/rid is 1..128 ASCII `[A-Za-z0-9._:-]`, excluding exactly `.` and `..`; it is the only idempotency key. `workflow_instance_id` is canonical UUID; filter `agent_id` matches stored exact grammar `^agt_[A-Za-z0-9_-]+$`, 5..128 chars, and never grants access. Message is 1..65536 UTF-8 bytes, nonblank, no NUL, preserved byte-for-byte. `purpose` is only `workflow_facts`; `allow_create_main` is required boolean. Each `context_refs` item is exactly `{ref_id,version,digest}` from resolution: `ref_id=ctx_whi1_` plus base64url (≤128 chars total), version is an opaque nonempty ≤128-byte string, digest is 64 lowercase SHA256 hex; at most20 refs. Target handles and all cursors are 1..2048 ASCII base64url without padding. `limit` is canonical decimal integer1..100 without leading zero, history default20, events default50. No arbitrary URL/path/ref or client credential/Principal/Session selector is accepted.

New authorization returns201 (same-record repeat200); first consumed redeem returns202 and does not wait for Agent execution/reply; other successful reads/resolve return200. Every handler has an8s total deadline from first request byte; each Auth/dependent read is bounded to≤5s within that total, with no automatic retry. Deadline/cancellation never rolls back a durable reservation, cancels an admitted Agent or authorizes a second redeem. The original runtime continues already-consumed native admission/settlement and GET reports its truth. The separate Gateway proposal's10s Web/15s Nginx ladder is an external expectation, not accepted here.

All successful envelopes MUST add `contract_version='website-human-inquiry-v1'` and `served_at` UTC. Payload objects are closed by CTR-WHI-004 through CTR-WHI-010; unavailable optional facts are null with `field_availability[{field,reason}]`, never fabricated 0/false. Field is an allowlisted DTO field path; reason is only `NOT_PROJECTED|UNAUTHORIZED|NOT_FOUND|NOT_STARTED|SOURCE_UNAVAILABLE|UNSUPPORTED|EXPIRED`. Errors are exactly `{contract_version,error:{class,diagnostic_id,retryable,retry_preconditions}}`; diagnostic_id is a nonsecret opaque reference, retry_preconditions is an array of safe enumerated prerequisites, and contains no body, path, credential or existence clue. Post-auth classes include `VALIDATION_ERROR`400, opaque `NOT_FOUND_OR_NOT_VISIBLE`404, `REQUEST_CONFLICT|BINDING_CHANGED|SESSION_GENERATION_CHANGED|CURSOR_STALE|EVENT_CURSOR_EXPIRED`409, `RESOURCE_LIMIT`413, `RESULT_EXPIRED`410, `NOT_SUPPORTED|NOT_PROVISIONED|AUTH_INCONCLUSIVE|SOURCE_UNAVAILABLE|TRACE_UNRESOLVABLE|EVENT_CONFLICT|RESULT_PERSIST_FAILED|RESULT_UNRECOVERABLE`503. Transport timeout/5xx never implies not-delivered or retry permission. Responses MUST use `Cache-Control:no-store`.

### CTR-WHI-004 — Resolve and trustworthy target/main metadata

Input `{}` selects `BOUND_AGENT_PILOT` only. After Human authentication and current exact registry ACL, DSH MUST derive the configured pilot channel/external_id server-side, ask the original Router's `channelConversationId` for its opaque binding key, and perform exactly one `getBinding` read. It MUST NOT call `resolveChannelConversation`, switchAgent, any channel HTTP endpoint or create a missing binding. Require the read record's exact activeAgentId equals configured expected_agent_id and target main policy; read that ID only via authoritative `Definition.getAgent`, require exact returned ID and disabled!==true, never resolveAgentRef/name fallback/list search. Absent/wrong/multiple pilot config is NOT_PROVISIONED; missing/mismatched binding or Agent is opaque NOT_FOUND_OR_NOT_VISIBLE before Session lookup. Registry ACL authorizes only this own local binding metadata read, not a source service role. Binding/Definition versions are SHA256 of coherent canonical snapshots, not invented source version counters.

`resolution` is exactly `{resolution_mode,workflow_instance_id,definition_id,definition_version,instance_state_version,node_id,node_visit_id,workflow_owner_principal,node_assignee_principal,canonical_agent_id,agent_domain,agent_definition_version,binding_ref,binding_version,binding_source,main_state,main_generation,context_refs,allowed_operations,observed_at,field_availability}`. In the pilot, resolution_mode is `BOUND_AGENT_PILOT`; all eight Workflow/definition/node/Owner/assignee fields are null with NOT_PROJECTED, and context_refs is exactly[]. `binding_source` is `{kind:'router_product_surface_binding',observed_at}`. `agent_domain` is exactly `{kind:'agent_security_domain',agent_id:<same canonical_agent_id>}` under D-008 §22; it is not an Auth domain ID or inferred Principal mapping. Canonical Agent, coherent Binding/Definition digest versions and main metadata are mandatory. UI MUST identify this as a fixed bound Agent pilot and show source/time/full Agent ID/domain/main; it MUST NOT display guessed Workflow Owner/visit or claim Workflow automatic targeting passed.

A narrow new internal main-metadata getter MAY reuse the original session-history locator confinement and header parser, under this Spec's verified bound-Human ACL (not a fake `mobile_tailnet_node` context). It reads only the canonical main header's first complete record, at most1,048,576 bytes, no transcript records; validates exact main/canonical workspace/location with stable read/no symlink escape, and returns only `exists|absent|unavailable` plus the existing `currentMainGenerationDigest(header,SHA256(header record bytes))`. It uses authoritative workspace-bootstrap paths internally, accepts no path or Session selector, starts no process, and does not invoke Mobile history listMessages. Unsupported/corrupt/unstable metadata fails closed, never treated as absent. This is a proposed new local wrapper, not an existing Human API.

Input `{workflow_instance_id}` selects deferred `WORKFLOW_INSTANCE` mode and MUST return503 NOT_SUPPORTED before Workflow/Auth-directory/MCP reads, Router/Definition/Session reads, or admission; the UUID syntax is still validated. A website JWT is not machine-only svc-workflow/Auth directory authorization; no borrowed Agent/MCP/Notification credential, Human OBO assumption, admin read or frontend filter is allowed. GAP-WHI-001 can be closed only by a later independently accepted source-owned Human/object read contract with exact issuer/subject/object/operations/ACL-version proof and denial-before-read evidence. This Spec does not define or activate that provider, accept a workflow-mode target_handle, or change source roles.

`target_handle` MUST bind verified Human/scope, resolution_mode, complete resolution/digests, expected main existence/generation and600s expiry. It is not bearer authorization. Only BOUND_AGENT_PILOT handles are issuable/acceptable in this version; a supplied workflow-mode/foreign-mode handle is NOT_SUPPORTED before authorization or redemption. Resolve/history MUST NOT create/switch Binding, start a process or create a Session. The preprovisioned binding selects only the Agent; no arbitrary sessionId. Existing main MUST be resumed by the original Router. `main_state=absent` is allowed only with reliable metadata and explicit allow_create_main=true bound to this request; missing/unavailable metadata denies. Admission MUST atomically recheck the same registry/Binding/Agent/main state under original lifecycle serialization; change rejects before prompt bytes, never silently chooses another main/Agent. Approved creation establishes only that Agent's canonical main.

### CTR-WHI-005 — Canonical preauthorization and stable identity

DSH MUST validate current Human ACL and target before atomically reserving `(verified_human_principal,communication_scope_id,request_id)`. The frozen canonical digest is SHA256 over RFC8785/JCS canonical UTF-8 JSON of exactly `{contract_version,human_principal_id,site_owner_binding_id,site_owner_binding_version,communication_scope_id,request_id,purpose,resolution_binding,message,context_refs,allow_create_main}`. resolution_binding is exactly the CTR-WHI-004 resolution fields excluding observed_at, field_availability and binding_source; its pilot Workflow fields remain null. These server-validated detached binding/context values include mode and every Agent/Binding/main version; message bytes are not normalized. Timestamps, token material, target_handle encoding and transport retries are outside the digest. Store the original full resolution, authorization/digest and controller binding durably before returning; no Router call occurs here. The record expires for new redemption at `min(original JWT exp,authorized_at+600s)` (no skew extension).

Existing RID MUST load its original record before current target resolution. Same subject/scope/RID/digest returns that record only after current read ACL; changed payload/target/purpose/context is409, never migrated to a current Owner/node/main. No Client restart, ordinary config revision, transport switch or newer token creates a fresh namespace. The Site MUST retain RID/digest and original message/context in its private explicit request record before queueing and check its trusted authenticated Owner equals the server-derived Owner binding; DSH must not trust that Site check instead of its own ACL. DSH returns a stable server-generated `authorization_ref=auth_whi1_` plus base64url (≤2048 chars), bound to this record and not a bearer capability. Human token remains only in the authenticated online request path. Original CONTROL command transport carries metadata only per CTR-011; controller obtains original bytes through its durable Site request mapping, never from GitHub message text.

### CTR-WHI-006 — One authenticated redemption and no replay

On redeem, DSH MUST first authenticate the original controller, check its current Grant and exact Site/Owner/preauthorized record, recompute the frozen digest, check unexpired authorization/current ACL/current target binding, then atomically consume `AUTHORIZED→ATTEMPT_STARTED` before native admission. One request admits at most one native message; multiworkers/concurrent POST/restart cannot win twice. The controller cannot authorize, change target or create a missing RID. Repeated same RID requests return the existing state and cannot create a second sender.

The only sender is a new trusted website Human entry on the original Router instance, sharing its native lifecycle/queue/admission primitives and unified session/prompt write fence. It MUST carry a frozen verified Human/request context internally and independently validate at that boundary; no model/body identity assertion. Existing Router.deliver closed controlOpts, ASM messageOrigin kinds/A2A schemas/inspectors, channel ingress/sender shapes and native source:{kind:'user'} remain unchanged. Human MUST NOT be encoded as inter_agent/workflow_execution, fake Feishu/Mobile or a mobile_tailnet_node. This Spec authorizes a separate website entry/optional trusted websiteAdmission carrier only, not addition to an old closed origin/channel union.

That new private carrier is exactly `{namespace:'website-human-inquiry-v1',human_principal_id,communication_scope_id,request_id,payload_digest,site_owner_binding_version}` and is never model input or persisted as invented `data.website_request` native message fields. At the original native seam, after original createUserMessage assigns its real message.id but BEFORE handle.agent.followup may enqueue it, the request-owned durable mapping MUST bind this verified carrier, exact Agent/main generation/native message.id and intended state. Mapping append failure has zero followup. Original native user message/source schema and allocated message ID are unchanged; no alternate message mint or hand-written journal event. Existing real session/prompt receipt still proves inbox acceptance; an allocated mapping alone does not. Original exact reader validates the native user message ID/content against the frozen authorized request, then resolves the turn. This uses original local message construction/queueing, not a new Session engine or external source permission.

`GAP-WHI-002` is a mandatory compatibility trigger: if exact source/installed dependency tests show this separate carrier/mapping cannot share the original fenced admission without widening a closed accepted channel/native-source/method meaning, or cannot persist the real ID before followup using the existing message object, that affected send slice is NO and MUST RE_PREFLIGHT its owning new/whole-authority contract. Neither this proposal nor a passing bound resolve hides that gap. Receipt/mapping loss remains UNKNOWN, never guessed; known delivery is preserved if a later append fails. ATTEMPT_STARTED without definitive zero-byte rejection or real receipt is query-only UNKNOWN. Timeout/lost HTTP response first triggers GET of original RID; no new RID, alternate ingress/main/worker or automatic prompt/tool replay. Ambiguous POST is not retried automatically. Proven rejection stays NOT_DELIVERED; new consent/safety proof for a separately new intention is outside automatic recovery.

### CTR-WHI-007 — Independent truth dimensions and exact reply

`request` is exactly `{request_id,authorization_ref,payload_digest,communication_scope_id,site_owner_binding_id,resolution,purpose,allow_create_main,authorization_expires_at,request_status,delivery_status,execution_status,reply_status,side_effect_status,trace,times,failure,field_availability}`. Trace is `{agent_id,session_id:'main',session_generation,native_user_message_id,native_turn_id,native_assistant_message_id}` with honest null availability. Times is `{submitted_at,authorized_at,attempted_at,inbox_accepted_at,started_at,finished_at,reply_created_at,result_persisted_at}` in UTC; unsupported values are null. `side_effect_status=NOT_ASSESSED|UNKNOWN|OBSERVED` and never defaults to none merely because the purpose is inquiry. Failure is null or `{class,stage,diagnostic_id,recovery_owner,allowed_recovery}`: class uses CTR-WHI-003 errors or `NATIVE_OUTCOME_UNKNOWN|PROVEN_REJECTED|NATIVE_FAILED`; stage is `AUTHORIZATION|REDEEM|ADMISSION|EXECUTION|RESULT_PERSIST|RESULT_READ|TRANSPORT`; recovery_owner is `RUNTIME_OWNER|IDENTITY_OWNER|SITE_CONTROLLER_OWNER`; allowed_recovery contains only `QUERY_ORIGINAL|REPAIR_ORIGINAL_PROJECTION|REAUTHORIZE_UNATTEMPTED|NONE`. No failure field is arbitrary upstream text or permission to replay.

```text
request_status   = AUTHORIZED|AUTHORIZATION_EXPIRED|ATTEMPT_STARTED|INBOX_ACCEPTED|REJECTED|UNKNOWN
delivery_status  = NOT_ATTEMPTED|NOT_DELIVERED|DELIVERED|UNKNOWN
execution_status = NOT_STARTED|RUNNING|COMPLETED|FAILED|UNKNOWN
reply_status     = PENDING|AVAILABLE|NO_OUTPUT|TRUNCATED|UNAVAILABLE|UNRECOVERABLE|EXPIRED|UNKNOWN
```

Known receipt/terminal/business facts MUST survive an unknown reply or lost result. Exact association MUST use one durable native inbox insertion and user/message with the same messageId, its unique subsequent turn/start without competing insertion/start, and only matching native turn events through turn/end; ambiguity fails `TRACE_UNRESOLVABLE`. No terminal is RUNNING, not completed. Only `turn/end.reason.kind=completed` plus complete readable final assistant projection can become AVAILABLE; failed/running text is not a final reply. Use the last qualifying final assistant/message of that turn, not chunks, wall-clock proximity or last observed chat. Missing reply/assistant ID is explicit; a projected `reply_to` is labeled `relation_source=exact_native_turn_projection`, never falsely native.

An inquiry grants no extra target capability and performs no Workflow action itself. Target keeps its own Agent credential/Principal/grants. This contract does not sandbox those existing grants or guarantee no side effects; action submission/transition tools remain absent from this website protocol. A reply alone never proves a Workflow node changed; business outcome requires its independent authorized source read.

### CTR-WHI-008 — Durable results, source custody and bounded retention

Before admission, the original runtime MUST register its existing turn reconciliation observer and prove the source owner can retain/re-read exact final body or a controlled artifact until request-owned result commit. Lack of this mechanism/proof disables send. After final output, runtime MUST automatically persist the request-owned allowlisted result/body and an event atomically before declaring reply AVAILABLE; no export job or new task is needed. Duplicate callbacks reuse the same transition/event ID; a same ID with changed content/native coordinate is quarantined as `EVENT_CONFLICT`, never overwrites a later terminal.

After restart/observer loss, the original exact reader MAY reconstruct only that request's original native coordinate/result, within existing reader caps (one artifact,10,000 records,8,388,608 bytes,1,048,576 bytes/record). No arbitrary artifact search or new admission. Reply-before-commit crash/reset/rotation MUST remain recoverable from retained source; source loss is `RESULT_UNRECOVERABLE`, preserves known execution/reply facts and makes recovery acceptance FAIL. Persistence failure is `RESULT_PERSIST_FAILED`; only the original result projection can be repaired, never prompt replay. Hash/byte count without readable authorized body/ref is not AVAILABLE.

Terminal readable result body/ref MUST remain readable for30 days from result commit across process restart/main reset; expiry reports `RESULT_EXPIRED`, not empty success. Events retain7 days from commit; expired cursor reports `EVENT_CURSOR_EXPIRED` with current coverage. Request/digest/tombstone and UNKNOWN records MUST NOT be automatically removed. Maximum10,000 request/tombstone records per communication_scope_id; capacity exhaustion rejects new RID with `RESOURCE_LIMIT` before admission, preserving old records. Explicit lifecycle deletion/decommission is outside this Spec. Pending/UNKNOWN source custody cannot expire under the terminal-body rule.

### CTR-WHI-009 — Final-text privacy and content pages

`result` is null or exactly `{projection_id,reply_to,relation_source,native_parent_id,content_bytes,projection_sha256,redacted,truncated,expires_at,artifact_refs,field_availability}`. `projection_id` uses `reply_whi1_` namespace; `native_parent_id` is null unless truly present in source. `body_page` is null or exactly `{content,content_cursor,next_cursor,has_more,complete,projection_sha256}`. Body pages are at most6144 UTF-8 bytes, split only on codepoint boundaries, deterministically cover one immutable projection, and preserve concatenated projected bytes/hash. One full response is ≤1,048,576 bytes. Complete paged content/ref can be AVAILABLE; partial/truncated/unreadable content cannot be advertised complete.

Only the request's own user text, task-limited completed final assistant text and authorized artifact metadata/controlled refs may be returned. Artifacts are `{ref_id,media_type,size_bytes,sha256}`, maximum20, no raw path/arbitrary export/automatic download. Redaction is explicit and hash binds returned bytes, not native source bytes. System/developer/reasoning, tool arguments/results/transcript, environment, credentials, configuration, unrelated turns/messages and raw journals MUST NOT be projected. Errors and logs follow the same boundary. Native coordinate possession grants no read authority. All logs MUST use only diagnostic/request digests, route class, state/error enum, status and latency; no raw Human/Owner/Agent/native IDs, text, cursor, token, path or upstream error body.

### CTR-WHI-010 — History, events and current ACL

History MUST cover only records this Owner explicitly submitted through this website boundary; earlier main history is not imported. Each history item is the CTR-WHI-007 request shell plus result metadata, not adjacent transcript. Coverage is exactly `{scope:'website_request_owned',start_at,end_at,source_high_water,complete,gaps}`; gaps are safe enum+request projection reference. There is no10/20-record retention cap. Request ordering uses persistent per-scope request_seq; events use persistent per-scope monotonic seq, never timestamps. Pilot history with workflow_instance_id filter returns NOT_SUPPORTED with zero Workflow reads; unprojected Workflow fields are not guessed/indexed from message text. Exact Agent/RID filters stay own-record filters, not routing authority.

An event is exactly `{event_id,seq,request_id,kind,trace,occurred_at,persisted_at,result_projection_id}`; kind is `AUTHORIZED|ATTEMPT_STARTED|INBOX_ACCEPTED|EXECUTION_CHANGED|REPLY_PERSISTED|FAILURE|RESULT_EXPIRED`. `event_id=evt_whi1_` plus stable transition digest; historical event content is immutable. Events discover persisted facts; GET is never delivery authorization. Same event replay is idempotent; coordinate/content conflict is isolated. Ordinary append does not invalidate existing IDs/cursors.

History before is exclusive keyset paging against a frozen high-water, with ascending returned request_seq. Event cursor advances from an exclusive seq against a captured high-water; while has_more is true that ceiling stays frozen. After draining it, next_cursor is a tail cursor at the last seq that captures a new high-water on its next use, so later persisted events are discoverable. Cursors MUST be server-authenticated and bind Human/Owner/scope, direction/query fingerprint, projection version, high-water and exact position; they confer no permission. Every page/result/body read rechecks current ACL, including private controller's exact bound requests. Malformed cursor=400; wrong owner/scope/query/corrupt/stale snapshot=409 CURSOR_STALE with no data; retained-event window expiry=409 EVENT_CURSOR_EXPIRED. Same snapshot pages have no duplicates/gaps; server never silently offsets/remaps into another generation. Controller has no arbitrary history endpoint.

### CTR-WHI-011 — Site transport integration and compatibility

The original controller MAY add exactly one default-OFF hook in its existing authenticated pull loop, no new loop/timer/daemon/writer/SOURCE CLI or Site-specific executor. Site pullhook maps an intention into the original CONTROL command queue (`agent:queued`); only a new finite `agent_inquiry` action handler on that same queue actor may call internal native redeem. That action is a proposal and does not exist at the observed base; its owning controller contract/review/tests/acceptance are prerequisites, not capabilities created by this DSH document.

The proposed GitHub command body is exactly `{action:'agent_inquiry',scope:'website_human_inquiry',request_id,payload_digest,authorization_ref,task_kind:'CONTROL',source_ref:'website_human_inquiry_v1',product_issue:null,autostart:false}`. No message/reply/token/target/session/cwd/engine is placed on GitHub. `source_ref` is a fixed namespace, never an arbitrary URL/path or target selector. Original controller durably binds command identity to the private original Site request's RID/digest/authorization_ref, fetches its unchanged body/context through the existing authenticated Site channel, then verifies that tuple against native preauthorization. Missing/conflicting mapping fails closed; it does not search GitHub, guess a request or fall back to another executor. Callback carries the same bound request/results privately to Site; GitHub receives only bounded non-body status metadata.

Site saves explicit intentions/results under its existing Owner authentication; machine pickup does not execute or create Human authority. DSH returns only the server-bound Site/Owner request to that controller. Each new Site body/result/history response MUST revalidate current native application ACL through the legitimate Human own-read path; cached controller callbacks are not reusable read permits. If revalidation is unavailable, no new cached body is disclosed. Already rendered content is not claimed remotely erased. Site indicates coverage, source/result times, arrival/sync time, stale/disconnected state and unavailable fields. Site can only claim “replied” from the CTR-WHI-007/CTR-WHI-008 receipt, never from controller liveness/queue claim/HTTP200.

Reuse the original15s page refresh with one bounded incremental read; browsers can throttle and no reply latency bound is promised. Reply arrival MUST preserve selected details, input node/draft/focus; unread/read markers use stable request/result IDs without body. Reopening loads cursor/original RID; history GET creates no request. Preserve original HR snapshots, filters, comments, links and old details; chat and HR acceptance remain independent. This DSH document states integration expectations and cannot accept or publish Site code.

### CTR-WHI-012 — Activation, stop, rollback and staged proof

Implementation requires this exact Spec accepted in its implementation base and independent affected-contract review; public exposure additionally requires separately accepted/implemented Gateway successor and Auth-owned exact registration. Public web origin/exact redirect, runtime Human/controller UUIDs, pilot target/Binding/roles, server registry, secret references and source-custody proof MUST be recorded and verified before enabling. This proposal configures none. Grant/publication/install/gate/message operations require separate concrete authorization, controlled preimage/runbook/rollback/readback and receipts; acceptance is not production permission.

Stop new preauthorization/redemption first while preserving authorized read/result settlement for already inbox-accepted records; then stop the inquiry hook after in-flight accounting. Current read permission still applies. Preserve native messages, history/tombstones/UNKNOWN and all unrelated runtime/HR work. Rollback removes only reviewed website exposure/config/source delta and never clears fences, cancels another Agent, replaces the original controller or resends. Frontend rollback does not revoke Client/Grant. Maintain model disposition: existing Android/MCP/Notification/ASM=RETAIN distinct supported contracts; old unenabled Codex-start bridge=RETAIN disabled, never fallback; new website facade=request-owned supported surface, not a migration alias.

## 10. Acceptance

Every row requires exact Spec/implementation/config hashes, command/request, environment, UTC timestamp, sanitized result and negative-control counts. Fixture tests, installed readiness and actual first inquiry are separate evidence subjects; all are NOT_RUN here. Runtime secret values are excluded. Methods below are required definitions, not claimed execution.

| Acceptance | Contracts | Method / Environment | Required evidence | Expected result / Failure condition |
|---|---|---|---|---|
| ACC-WHI-001 | CTR-WHI-001, CTR-WHI-002, CTR-WHI-012 | isolated Auth/ACL/registry→real route fixture; approved auth staging | valid/invalid JWT, wrong client/aud, machine fresh issuance/Grant revoke, missing config; read/Router counters | exact profile; next binding/Grant revocation denied; no human scope;401/403/503 precede protected reads; fail on bearer-as-Human/credential leak/disabled traffic |
| ACC-WHI-002 | CTR-WHI-003, CTR-WHI-004 | bound Human ACL→original Router Binding/Definition/header metadata fixture; separate unsupported Workflow-mode negative | empty-input unique pilot binding; wrong/absent/disabled targets; metadata confinement; binding/main interleavings; workflow-input read counters | bound pilot resolves only exact Agent/domain with Workflow null/NOT_PROJECTED; {} does not call Workflow/Auth-directory/MCP; {workflow_instance_id} returns NOT_SUPPORTED with all target/source reads0; fail on source-role borrow, fake Mobile identity, name fallback, hidden binding/main creation or claimed Workflow targeting |
| ACC-WHI-003 | CTR-WHI-005, CTR-WHI-006 | original fenced native seam fixture with durable mapping before followup; concurrent redeems, restart and HTTP loss at each boundary | RID/digest/real allocated ID mapping, unchanged old channel/source/ASM closed-shape tests, native message/followup counts | same RID at most one native message; mapping failure followup0; allocated ID is not receipt; changed content409; crash UNKNOWN/query-only; fail on second mint/admission, invented native field, old closed-contract expansion (GAP-WHI-002) or guessed delivery |
| ACC-WHI-004 | CTR-WHI-006, CTR-WHI-007 | two request fixture with reversed completion, duplicate/corrupt journal/terminal sequences | native user→turn→terminal chain and preserved dimensions | exact association; only completed complete final reply AVAILABLE; delivery stays DELIVERED when reply unavailable; fail on temporal matching or running/failed final text accepted |
| ACC-WHI-005 | CTR-WHI-008, CTR-WHI-009, CTR-WHI-010 | source-owner custody fixture: reply→commit crashes, callback loss, main reset/rotation/restart, failure/expiry/capacity | retained-source proof, reconstructed same projection bytes/hash, atomic event/result receipt | original result readable30d; recovery only original coordinate; UNRECOVERABLE marks test FAIL;7d event expiry explicit;10,000 tombstones reject new keys; fail on replay, lost required body or evicted UNKNOWN |
| ACC-WHI-006 | CTR-WHI-003, CTR-WHI-009, CTR-WHI-010 | >20 authorized synthetic request history, event/content pages, wrong Owner/filter/cursor and multibyte boundaries | stable seq/high-water/IDs, concatenated body hash, secret sentinels in adjacent/internal events | no gaps/duplicates,6144B pages/1MiB response, current ACL every page, no unrelated/tool/path/secret output; fail on recent-page retention or native-ID guessing permission |
| ACC-WHI-007 | CTR-WHI-007, CTR-WHI-011, CTR-WHI-012 | installed Site/controller fixture then separately authorized one real BOUND_AGENT_PILOT inquiry | original controller hash; approved Human/unique original Binding/Agent/domain/main; full stage IDs/times and exact final reply | one real bound-pilot request discovered by original loop; no new rights/second sender; Workflow fields stay NOT_PROJECTED and automatic Workflow targeting remains NOT_SUPPORTED/NOT_ACCEPTED; fail if fixture/package/health/Agent answer is called Workflow resolution or business completion |
| ACC-WHI-008 | CTR-WHI-010, CTR-WHI-011, CTR-WHI-012 | browser fixture plus separately authorized real browser offline/hidden-tag/non-Owner checks, stop/rollback rehearsal | selection/draft/focus/read-state and history>20; original HR regression; in-flight/read receipts | disconnected stale UI, reopen queries same RID; disable blocks new send while lawful results settle; fail on focus loss, deleted evidence or revoked read leakage; unavailable real scenarios remain NOT_RUN |

Coverage: CTR-WHI-001..012 each maps to ≥1 ACC above; every ACC Contract reference resolves. A wrong classifier that treats a machine claim as Human consent, final text as completed reply, or lost response as resend permission must fail ACC-001/004/003 respectively.

## 11. Alternatives and disposition

`ALT-WHI-001` rejected: controller machine bearer authorizes Human messages; violates identity separation. `ALT-WHI-002` rejected: Human token in normal queue/comments/browser storage; creates secret/impersonation exposure. `ALT-WHI-003` rejected: direct localhost `/v1/message`, spoofed A2A or alternate writer; lacks this durable Human boundary. `ALT-WHI-004` rejected: reuse Android OAuth client/CORS or MCP/Notification Grant; different supported subjects. `ALT-WHI-005` rejected: full-main/tool history or time-based reply guess; excessive/private ambiguous projection. `ALT-WHI-006` rejected: source lost→new RID resend; repeats uncertain effects. Request-owned metadata/results are product requirements for disconnect recovery, not a release-only ledger or second Session engine.

## 12. Migration, compatibility, and rollback

No migration/import/replay of old requests, private mains or denied Workflow instances. Old adapter records missing messageId retain their already-known delivery/execution/business evidence with `TRACE_UNAVAILABLE`/`REPLY_LINK_UNAVAILABLE`; no retrofit send and no wholesale UNKNOWN rewrite. Existing public message ID namespaces (`msg_sh1_*`, ASM native IDs) remain distinct from website projections. Retain original Site v276 as a proposed frontend rollback reference pending live version/preimage verification; no claim it is still deployed. Apply CTR-012 for actual controlled rollback, preserving durable records and independent read authority.

## 13. Open questions and authoring exit

Normative bound-pilot defaults are frozen above; Owner may accept/reject them after review. r2 deliberately removes automatic Workflow targeting from the minimum live slice rather than widening any source permission. GAP-WHI-001 stays load-bearing for that deferred mode only; it is NOT_SUPPORTED and cannot be counted in pilot acceptance. It does not block independently useful BOUND_AGENT_PILOT authoring. GAP-WHI-002 is an explicit compatibility stop if real implementation cannot preserve the old closed interfaces/source at the original admission boundary; no source/installed compatibility proof is claimed by a docs-only candidate.

Operational values are deliberately unprovisioned, not normative TBD: exact Client/Principal UUIDs, Site account/Human binding, exact origin/redirect, the one pilot Product Surface/Agent/Binding, credential references and deployment preimage. Pilot Agent security domain comes from D-008 plus that canonical Agent, not a guessed Auth domain. No reading of secrets/private mappings/rejected objects is authorized to fill runtime values. Auth/Gateway/Site acceptance and controlled rollout are separate; dependent gates stay OFF. First reliable conversation does not assert Workflow source access or require a new Workflow/Human platform; future automatic Workflow resolution returns through its separate owning-source contract.

```text
SPEC_GOVERNANCE_MODE = AUTHOR
AUTHORITY_ACTION = NEW
SPEC_ID = WEBSITE_HUMAN_WORKFLOW_INQUIRY_V1
STATUS = proposed
IMPLEMENTATION_AUTHORITY = contracts (effective only after accepted in base)
PRIMARY_PARENT_AUTHORITY = AGENT_CORE_PRODUCT_ARCHITECTURE_V1
EXTERNAL_AUTHORITIES = MINIMAL_AUTH_FOUNDATION_V2 @ 862eab36677d214b2ce340f49bb141173b51efea (dependency expectation)
PLAN_LEVEL = EXEC_PLAN
ASSURANCE_LEVEL = CONTROLLED
DOCS_FIRST_REQUIRED = YES
OPEN_OWNER_DECISIONS = NONE (specific proposal awaits independent review/Owner acceptance)
NORMATIVE_TBD = NONE
PARTIAL_SUPERSESSION = NONE
CONTRACT_COUNT = 12
CONTRACTS_WITH_ACCEPTANCE = 12
SPEC_GAP_DEPENDENCY = NON_LOAD_BEARING for bound pilot (GAP-WHI-001 deferred mode only)
AUTHORING_READY_FOR_REVIEW = YES (BOUND_AGENT_PILOT scope only)
IMPLEMENTATION_READY = NO
PUBLIC_INTEGRATION_READY = NO
PRODUCTION_READY = NO
WORKFLOW_AUTOMATIC_TARGETING_READY = NO (NOT_SUPPORTED; GAP-WHI-001)
NEXT_ACTION = REVIEW (exact r2 bound-pilot candidate; no production or Workflow authority acceptance)
```
