---
spec_id: AUTH_SERVICE_MCP_CONVERSATION_PILOT_SUPPLY_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
date: 2026-10-16
scope:
  - mayf3/auth-service
governed_by:
  - MINIMAL_AUTH_FOUNDATION_V2
  - AUTH_SERVICE_DEVELOPMENT_GOVERNANCE_ADOPTION_V2
external_authorities:
  - repository: mayf3/dsh-agent-core
    authority_id: DSH_MCP_NATIVE_CONVERSATION_V1
    revision: 44da63d21987bf7115435f0767e7851b9022836a
    relation: constrained_by
supersedes: []
superseded_by: null
owners:
  - mayf3
---

# AUTH_SERVICE_MCP_CONVERSATION_PILOT_SUPPLY_V1

## 1. Goal

Define bounded registry and secret-safe Auth supply operations for the original #1156
dot-read-mcp conversation pilot: one new SERVICE MachinePrincipal, one dedicated
MachineClient, one exact MachineAccessGrant, and delivery of the original credential
directly to the original MCP service's private file. Replace the v2 packet's abstract
“owning system generates and attests” step with a reviewable future execution
contract. This proposed document implements nothing and grants no production use.

```text
AUTHORING_BASE = 57f459804df1b6526a164016ea3aefa12836286d
AUTHORITY_ACTION = NEW
PLAN_LEVEL = EXEC_PLAN
ASSURANCE_LEVEL = CONTROLLED
ROUTE_STAGE = AUTHORITY_AUTHORING
AUTHORITY_ACCEPTED_IN_BASE = NO
DOCS_FIRST_REQUIRED = YES
IMPLEMENTATION_ALLOWED_NOW = NO
PRODUCTION_APPLY_ALLOWED_NOW = NO
FUTURE_VEHICLE_STATUS = NOT_IMPLEMENTED
```

## 2. Scope and non-goals

In scope after independent review, Owner acceptance and merge: only the closed
source vehicle in CTR-MCS-003, its isolated conformance, one SERVICE caller supply,
closed safe plans/receipts, and original-secret delivery/recovery. Phase A
reconciles only this Audience DB row under the separately accepted CCR; Phase B
supplies only identity/client/grant/credential. They require separate plans, nonces,
approvals, write sets, transactions and receipts. No combined APPLY is offered.

Out of scope: Audience/Scope/bundle source changes, runtime deployment, TLS/CA/ACL changes,
DSH/MCP configuration generation or activation, Binding writes, business calls,
Workflow access, Human/Agent impersonation, canonical-subject enrollment, source
binding/lifecycle tables, management API additions, schema changes, control platform,
credential rotation, broad bootstrap permission, and adoption of existing clients.
No code, test, script, database, secret or operational write is authorized by this
docs-only authoring task. The future implementation must not modify this Spec.

## 3. Authority and dependencies

The current architecture authority is MINIMAL_AUTH_FOUNDATION_V2, including its
exact-incorporated historical V1 provenance. The frozen V1
`docs/contracts/minimal-auth-v1/grants-and-audiences.md` §9 requires versioned,
fixed-source Grant mutation with approval, expected version and same-transaction
audit; it offers no online Grant management API. This child supplies one such
bounded vehicle without changing token issuance or Grant semantics.

`AUTH_SERVICE_AGENT_CORE_MCP_CONVERSATION_AUDIENCE_CCR_V1` is a separate proposed
dependency. Its acceptance and source closure/conformance must be established
before Phase A. Phase A readback and separate coherent runtime load must be
established before Phase B. Proposal
coexistence or a DB row alone is insufficient. This child neither accepts that CCR
nor combines its Audience writes with identity supply. CTR-MCS-011/012 own only
the bounded DB registry machinery; the CCR source closure owns no DB tool.

External product authority: `mayf3/dsh-agent-core`,
`DSH_MCP_NATIVE_CONVERSATION_V1` r3, file at
`44da63d21987bf7115435f0767e7851b9022836a:docs/specs/DSH_MCP_NATIVE_CONVERSATION_V1.md`,
CTR-NC-001/003/009. DSH owns verified-client-to-connector/scope/product-principal
configuration and product authorization. The corresponding accepted thin-client
contract is `mayf3/dot-read-mcp`,
`90cc8eddfc75fa149cc71210181e8f825f59c601:docs/DSH_NATIVE_CONVERSATION_INTEGRATION_V1.md`.
Neither grants Auth supply or production permission.

The accepted local
`AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_SERVICE_CREDENTIAL_GRANT_V1`, at the
authoring base, supplies a bounded plan/apply/verify and secret-delivery precedent.
Its exact caller set and three-file closure cannot be reused or widened for MCP.
Its proposed implementation filenames do not exist at this base.

```text
PRIMARY_PARENT_AUTHORITY = MINIMAL_AUTH_FOUNDATION_V2
IMPLEMENTATION_AUTHORITY = contracts only after acceptance in authority base
PRODUCTION_APPLY_AUTHORITY = none
COMBINED_AUDIENCE_IDENTITY_APPLY_AUTHORITY = none
PARTIAL_SUPERSESSION = NONE
```

## 4. Current State

STATE-MCS-001, observed 2026-10-16: at Auth authoring base, generic SERVICE principal
and client creation code exists, but no MCP supply vehicle or safe first-secret
delivery operation exists. The new Audience CCR and this supply authority are not
accepted. Basis: OBS-MCS-001/002/003.

STATE-MCS-002, bounded prior live snapshot 2026-10-16T00:16Z: v2 safe evidence reports
no conversation Audience/client/product principal, no established original MCP
subject and no dedicated MCP Binding. This is prior scoped absence evidence, not a
fresh production census or authority. APPLY must read current state independently.
Basis: OBS-MCS-004.

STATE-MCS-003: all future commands described below are NOT_IMPLEMENTED. No principal,
client, grant, connector UUID or secret was generated by this authoring work.

## 5. Observations

OBS-MCS-001 — Source inspection at Auth
`57f459804df1b6526a164016ea3aefa12836286d`, 2026-10-16, local read-only:
`src/routes/idempotent.ts` exposes authenticated `POST /api/v1/principals` and
`POST /api/v1/clients`; `src/middleware/v1-management-auth.ts` uses existing
`svc-auth/auth.identity.provision` verification. The principal request accepts
`external_ref`, optional `principal_type` (default service), `display_name` and
optional existing-record claim fields. The client accepts `external_ref` and
`principal_id`, plus optional claim ID. New-client response includes a one-time raw
`secret`; reuse does not. No safe credential-file handoff is present.

OBS-MCS-002 — Same coordinates/method: `src/lib/oauth/v1/idempotent.ts` supports
SERVICE creation and uses unique external refs. New generic clients have empty
legacy allowedResources/allowedScopes. `src/lib/oauth/v1/direct.ts` uses the current
runtime Audience and MachineAccessGrant for V1 authorization, not those legacy
arrays. `src/cli/machine-admin.ts` requires Agent ID/owner for principal creation,
and prints secrets on client creation/rotation. It cannot supply this SERVICE pilot.

OBS-MCS-003 — Same coordinates/method: accepted
`AUTH_SERVICE_CANONICAL_SUBJECT_ENROLLMENT_AND_SOURCE_BINDING_V1` DEC-CSESB-003
prohibits ordinary authentication/authorization/routing reading its temporary
migration source bindings. Its business_subject_id is an enrollment-lineage key,
not an authentication subject. `scripts/canonical-subject-enrollment.ts` cannot
perform PLAN/APPLY/VERIFY without an injected trusted evidence provider; direct
invocation rejects AUTHORITY_NOT_ACCEPTED. No production adapter is supplied by
that CLI. Enrollment creates neither Principal nor Client nor Grant.

OBS-MCS-004 — Input evidence, not current re-execution:
`pilot1156-fixed-v2/packet/evidence/identity-auth-db-safe.json` at
2026-10-16T00:16:10.613Z and `identity-runtime-safe.json` at
2026-10-16T00:16:41.963189Z record non-secret narrow read-only projections. The reader
principal `7711a8ed-c538-488b-b569-dcb1253adad8` and target BIP principal
`d5b3aeb2-e754-49a9-9914-b963521c0985` are Agent identities, not this proposed caller.
The runtime Audience snapshot was 1.12.0 with no conversation entry. These files are
review inputs; fresh exact prestate is a future operation gate.

OBS-MCS-005 — DSH exact source inspection at the external coordinate in §3,
2026-10-16: CTR-NC-001 already assigns a verified client uniquely to original
connector subject, stable communication_scope_id and product principal through
DSH controlled configuration. It does not require Auth CSESB enrollment. CTR-NC-003
requires that scope survive restart and ordinary config revision.

OBS-MCS-006 — Same Auth source coordinates/method: `AuthAudience` already has the
registry projection, status/freezeReady and integer version; `AuthSecurityAudit`
already carries eventType/result/details. Accepted
`AUTH_SERVICE_SVC_FORUM_AUDIENCE_REGISTRY_RECONCILIATION_V1` CTR-RR-004/005 defines
table-lock-before-advisory-before-snapshot, advisory key 813_947_203 and an exact
same-transaction `audience.registry_reconciled` audit. Its svc-forum target does not
authorize MCP rows. The MCP CCR proposes source 1.12.0 to 1.14.0, preserving the
accepted website source reservation 1.13.0 without depending on website rollout.

## 6. Claims and assumptions

CLM-MCS-001 = SUPPORTED by EVD-MCS-001: existing creation primitives can be reused
as references but neither generic HTTP creation nor machine-admin is a complete
safe supply operation. Credential loss after first response cannot be repaired by
blindly repeating creation or rotating under this task.

CLM-MCS-002 = SUPPORTED by EVD-MCS-002: the pilot needs an Auth SERVICE identity and
a DSH/MCP configuration subject, not a new Auth canonical-subject model. Equal UUID
shape would not make these coordinates interchangeable.

CLM-MCS-003 = OPEN_ASSUMPTION: the prior live target/absence snapshot remains current.
It is not an APPLY precondition until freshly verified. Unknown state is REFUSED.

## 7. Evidence relations

EVD-MCS-001: OBS-MCS-001/002 SUPPORTS CLM-MCS-001 at the exact Auth authoring base.
The source defines real input/output fields and one-time-secret behavior, sufficient
to reject a claimed existing secure CLI. It proves no production operation.

EVD-MCS-002: OBS-MCS-003/005 SUPPORTS CLM-MCS-002 at the exact Auth and external DSH
coordinates. The authorities separate migration metadata, Auth identities and
product configuration. It proves no original transport ownership or runtime mapping.

EVD-MCS-003: OBS-MCS-004 SUPPORTS STATE-MCS-002 only at its recorded snapshot. Its
non-secret provenance and narrow denominator are sufficient to motivate a new
dedicated caller, insufficient to select a Human ID or claim fresh absence.

EVD-MCS-004: OBS-MCS-006 SUPPORTS CTR-MCS-011's reuse of existing registry/audit
storage and lock ordering at the exact authoring base. It establishes mechanism
availability and a separate authority need, not production reconciliation success.

## 8. Decisions

All decisions below are proposals for mayf3's acceptance, not decisions already made
by the author.

DEC-MCS-001: supply one independent SERVICE caller; retain the existing reader,
target Agent, Notification and other clients as distinct entities. No existing
credential or identity is adopted. Reason: OBS-MCS-001..004; rejects ALT-MCS-001.

DEC-MCS-002: DSH/MCP's original Owner-controlled executor allocates and records one
stable opaque connector UUID under CTR-NC-001, after verifying the unique original
transport. It is configuration provenance, not Auth `sub`, CSESB business_subject_id
or a Human identity. Auth supplies only principal/client/grant facts; rejects
ALT-MCS-002. Stable communication scope is the literal in CTR-MCS-002, not a newly
minted value per attempt.

DEC-MCS-003: use a new local bounded source vehicle; no public management surface or
generalized provisioning platform. Preserve V1 Grant authority and empty legacy
arrays; rejects ALT-MCS-003.

DEC-MCS-004: retain the first raw secret only in approved private escrow/final file,
never model/stdout/logs. DB and filesystem have no common atomic commit. Explicit
fencing and original-secret recovery are required; UNKNOWN is not success and never
permits another mint. Reason: OBS-MCS-001/002; rejects ALT-MCS-004/005.

## 9. Contracts

### CTR-MCS-001 — Separate authority and exact production mandate

This proposal MUST remain docs-first. Future implementation requires this Spec and
the Audience CCR accepted in the authority base, independent affected-contract
review, and fixed source/conformance evidence. Production APPLY additionally
requires an immutable Owner-authorized mandate naming exact environment, original
executor/OS actor, authority and implementation revisions, plan digest, operation
UUID, unpredictable public approval nonce, exact allowed effects, expiry and one
attempt. The original authenticated Owner execution channel must establish the
issuer; caller-authored JSON, admin status, a machine credential or arbitrary
`approval_ref` string alone MUST NOT prove Human authorization. No reusable production
mandate/trust adapter is claimed to exist. The future source must refuse execution
when its attributable mandate cannot be independently checked by that executor.

Audience source/runtime, Phase A DB registry, Phase B Auth supply,
DSH/TLS/config/Binding activation and the first business round trip are separate
gates and receipts. Phase A writes only its Audience row and registry audit under
CTR-MCS-011; Phase B performs zero Audience writes. Both perform zero bundle/runtime/
TLS/Binding/DSH/MCP-enable writes and zero token mint or business requests. Missing
or changed dependency pins MUST fail before secrets or target writes. This Spec
grants no production apply authority.

### CTR-MCS-002 — Fixed caller, scope, target context and generated coordinates

The only new principal/client external ref is
`dot-read-mcp-native-conversation-pilot-v1` in their respective unique tables.
Principal display_name is `dot native conversation pilot v1`; principal_type is
`service`, status active, no Agent ID, no Human owner, no Agent lifecycle/successor
effects. These absent fields use the existing SERVICE storage shape, not a newly
invented wire null convention. New client's status is active, it belongs to that
principal, and its legacy allowedResources/allowedScopes are empty arrays. Exactly
one MachineAccessGrant is created:
`agent-core-mcp-conversation-v1[conversation.access]@1`; no other grants are added.
No existing client's legacy arrays are changed.

The DB/approved owning source generates the principal UUID and internal client UUID;
the supply vehicle generates one public `mc_` client identifier with CSPRNG and one
independent 256-bit secret only on authorized first APPLY. No UUID/client ID is
fabricated by a document/model or requested as manual technical input from the
Owner. All generated public IDs are read back before receipt success. An ID
collision aborts the attempt rather than retrying generation after an unknown effect.

DSH/MCP config authority supplies one stable UUID `connector_subject` and verified
original-transport receipt; no CSESB attestation/source_binding reference is required
or produced. `communication_scope_id` is exactly
`mcp-native-conversation-pilot-v1`. The approved mapping must bind the generated
client/principal and connector subject uniquely. They MUST be distinct from the
reader/target IDs and from each other. Auth records the mapping receipt digest as
external product provenance only; token `sub` remains Auth principal UUID.

Fixed product context, checked by the DSH owner and carried in the safe receipt:

```text
agent_id = agt_build-in-public-agent
target_principal_id = d5b3aeb2-e754-49a9-9914-b963521c0985
domain_id = f9b5682c-1c9c-5ace-a7b1-01b9a3be5965
binding_id = mcp:dot-native-conversation-pilot-v1
routing_version = 1
runtime_root = /Users/authsvc/.agent-core
endpoint = http://127.0.0.1:8788
resource = agent-core-mcp-conversation-v1
scope = conversation.access
```

This context grants Auth no Router or domain write authority. A missing dedicated
Binding keeps DSH disabled; supply MUST NOT create it.

### CTR-MCS-003 — Exact source closure and future command surface

After acceptance, implementation MUST change exactly these three new source files:

```text
scripts/supply-mcp-conversation-pilot-v1.ts
scripts/run-mcp-conversation-pilot-v1-conformance.sh
tests/oauth/supply-mcp-conversation-pilot-v1.test.ts
```

EXTRA_FILE_COUNT MUST equal zero. No package script, route, schema, migration,
generated file, deployment file, existing provisioner or governing Spec is in this
closure. Direct DB writes are confined to the reviewed, fixed-SHA versioned vehicle;
it may reuse existing secret verification and Prisma types without changing them.
The shell runner is isolated conformance only and refuses production coordinates.

The future TypeScript vehicle exposes `registry plan|apply|verify|reconcile`,
`registry-disable plan|apply|verify|reconcile`, and
`supply plan|apply|verify|reconcile|recover-delivery`.
Every one is currently NOT_IMPLEMENTED; these names are a future
interface contract, not an executable runbook. `plan` is default and read-only.
`verify` and `reconcile` are read-only. All three generate zero secrets and perform
zero DB/filesystem writes. Only authorized first `supply apply` may create identity/
grant facts and a secret. Registry modes never read/generate a credential. Supply
`recover-delivery` requires a separate exact recovery mandate,
writes only the original credential bytes and its recovery receipt, generates no
identity/secret and performs zero DB mutation/token/business calls.

### CTR-MCS-004 — Closed request, plan, nonce and CAS admission

All input/output schemas MUST reject unknown keys, duplicate JSON keys, malformed
types, mixed environments and noncanonical digests. The future request contains
exactly the common fields: `schema_version`, `phase` (registry, registry-disable or
supply), `operation_id` (system-generated UUID), `environment`,
`source_commit`, `spec_ref`, `spec_digest`, `audience_authority_ref`,
`audience_authority_digest`, `bundle_digest`, `runtime_digest`,
`runtime_preimage_receipt_ref`, `runtime_preimage_receipt_digest`,
`operator_ref`, `approval_ref`,
`approval_digest`, `approval_nonce`, `created_at`, `expires_at`. Secret, credential,
token, caller-selected target/ref/path and database URL are forbidden fields.
The supply discriminator additionally requires `connector_config_receipt_ref`,
`connector_config_receipt_digest`, `connector_subject` (UUID from that receipt),
`registry_receipt_ref`, `registry_receipt_digest`. Registry/registry-disable instead
require `stop_serving_receipt_ref`, `stop_serving_receipt_digest`; they admit no
connector, generated caller or credential fields. Fixed constants in
CTR-MCS-002/005/011 are source-bound, not overrideable inputs.

For Phase B, PLAN freshly checks the accepted Audience/runtime/DB registry agreement, exact
SERVICE shape, external-ref uniqueness, all target-row/audit absence or exact full
rerun state, original MCP OS uid/gid and destination metadata, escrow/fence status,
and non-target digests. It emits exact request/authority/implementation pins,
`plan_digest`, safe prestate, fixed intended effect, current target classification,
approval nonce, timestamps and expiry. It must not generate proposed identity IDs
or secrets. Absent rows use explicit tagged prestate `{state:"absent"}`, not sentinel
UUIDs or unspecified null semantics.

APPLY holds one protected local operation lock and, using CTR-MCS-011's ordered
table/advisory/snapshot locks, rechecks every precondition under one SERIALIZABLE
DB transaction. It atomically claims the unused approval nonce in
the protected attempt ledger with exclusive creation, fsyncs a non-secret
ATTEMPT_STARTED fence before first secret generation, and binds it to operation,
plan, actor, exact refs and destination preimage. One unresolved attempt for these
fixed external refs blocks all other nonces. No nonce/operation may be reused with
another plan. Destination install uses no-replace compare-and-swap against an exact
absent preimage; DB inserts use unique external refs and exact expected grant
absence/version. Mismatch, expired approval, wrong actor or CAS loss refuses before
secret generation where detectable, otherwise follows CTR-MCS-007. No auto-retry.

### CTR-MCS-005 — Phase B direct secret delivery and protected escrow

The only final credential destination is
`/Users/yanfenma/.config/read-mcp/native-conversation.client.json`, a nonsymlink
regular file, uid 502/gid 20 derived and freshly matched to the original MCP process,
mode 0600. Its closed private JSON fields are exactly `connector_subject`,
`client_id`, `client_secret`; the first two match the eventual safe receipt.
No secret is passed through model/chat, stdout, stderr, log, argv, environment,
shell substitution, request/response evidence or public receipt. Errors are
allowlisted categories and cannot serialize raw exceptions or filesystem contents.

The original approved Auth operator must possess the already-authorized rights to
deliver to the verified MCP owner. The vehicle cannot obtain those rights by
chmod/chown of existing ancestors, new ACLs or credential substitution. Insufficient
rights or unexpected ownership fails before generation; an additional permission
operation is a separate gate.

Approved same-filesystem escrow is fixed at
`/Users/yanfenma/.config/read-mcp/.native-conversation-pilot-v1-escrow`, root:wheel
0700. It is provisioned only by a separately authorized operator if absent; existing
unexpected metadata is REFUSED. Per-operation escrow directories are 0700 and raw
credential files 0600 root:wheel, never evidence artifacts. The protected non-secret
attempt ledger lives inside that root, is 0600 root:wheel, append-preserving, and
retains terminal attempt tombstones. Root here is a bounded OS delivery requirement,
not Human authorization. PLAN verifies it without creating it. An absent escrow
root keeps APPLY blocked until its explicit setup approval/readback exists.

Descriptor/ancestor validation rejects symlinks, hardlinks, swapped inodes, broad
modes and owner drift. First APPLY requires the final destination absent; an
existing partial/wrong file is not adopted. After all gates pass, generate once in
memory, store only its approved scrypt verifier in DB, write/fsync the private
escrow copy, prepare/fsync the same-filesystem final-ready copy with final uid/mode,
and atomically install it without replacement before DB commit. Fsync the parent
directory and verify exact metadata and secret-to-verifier match as a boolean. The
escrow permits recovery of those same original bytes if final delivery is lost;
it is never read back to a model. DSH and MCP native configuration remain disabled
through this entire operation. Escrow deletion requires the retention gate in
CTR-MCS-010, not normal success cleanup.

### CTR-MCS-006 — Phase B DB atomicity, audit and non-target invariance

One SERIALIZABLE transaction creates exactly one principal, one client, one grant
and one existing `GrantChangeAudit` envelope. No new table is added. Audit binds a
unique migration_id derived from the operation UUID, source SHA, accepted Spec
revision/digest, exact plan digest/nonce, attributable operator/approval, reason,
generated client ID, expected grant absence, resulting version 1 and a complete
closed non-secret before/after projection including the created principal/client
facts and external connector receipt digest. All four DB effects commit together;
audit failure rolls all four back. Existing nullable audit columns retain their
current database meaning; public receipts use tagged states.

The vehicle computes canonical ordered, length-delimited non-target principal,
client, grant and audit digests before mutation, precommit and VERIFY; all must
match. Secret hashes may contribute to a digest in memory, but no hash/raw verifier
is emitted. All existing principals/clients/grants, legacy arrays, identity
attestations, lifecycle/source bindings and unrelated audit rows have zero writes.
Audience rows, generated snapshots and runtime source are read-only preconditions.

Filesystem installation and DB commit are explicitly not one atomic transaction.
No report may call the combined operation atomic or committed until both the
authoritative DB readback and credential-file verification pass.

### CTR-MCS-007 — Phase B unknown outcome, no replay and original-secret recovery

The durable fence records append-only stages ATTEMPT_STARTED, ESCROW_DURABLE,
DESTINATION_DURABLE, COMMIT_REQUESTED and the observed terminal/reconciliation
outcome; stage records contain only coordinates/digests/booleans, never secret bytes
or secret hashes. A process restart, broken connection, timeout or commit exception
cannot infer no commit. It returns OUTCOME_UNKNOWN, preserves escrow/final files and
the fence, blocks another APPLY and performs no issuance/rotation/automatic retry.

READ-ONLY RECONCILE binds the same operation/nonce/plan and checks the authoritative
DB audit/rows plus destination and escrow. It classifies:

- EXACT_COMMITTED: exact four DB facts and audit, correct file/metadata/verifier
  match and non-target invariants; an attributable safe receipt may be regenerated,
  without mint/write or another APPLY.
- COMMITTED_DELIVERY_INCOMPLETE: DB commit proven but final file absent/mismatched;
  keep disabled and fence. A recovery mandate may authorize installing the same
  original escrow bytes only when escrow ownership/inode/digest/verifier checks
  and exact destination CAS preimage pass. Wrong existing file is not overwritten.
- PROVEN_NOT_COMMITTED: authoritative stable read proves no matching audit or any
  target row and the transaction cannot still commit. Under a separate exact
  cleanup mandate only this attempt's staged/final credential files may be removed
  after inode/CAS verification; preserve the non-secret fence/tombstone. No new
  secret is generated by cleanup. This Spec grants no second supply attempt.
- SECRET_LOST: committed verifier exists but neither approved private copy matches;
  retain disabled/fence, report failure and require separately governed incident
  recovery. Rotation or a replacement client/secret is not compensation here.
- Any ambiguous, partial, unavailable or conflicting state remains
  OUTCOME_UNKNOWN/REFUSED; never infer absence from query failure or an empty page.

Recover-delivery changes no DB fact, identity, nonce or secret and needs fresh
expiry/attempt-bound Owner approval. It stages/fsyncs and CAS-installs only the
proven original credential, then independently verifies. Failure stays fenced.
The fence is never deleted/cleared to make the operation runnable. Terminal failure
is not success; later supply/repair requires a new mandate and re-PREFLIGHT outside
this operation, not a hidden retry.

### CTR-MCS-008 — Phase B exact rerun and safe machine-readable receipts

Only the complete exact target DB state, exact audit, accepted runtime/Audience
pins, connector receipt, final destination metadata/verifier match and non-target
digests classify EXACT_RERUN_NOOP. Partial, duplicate, ambiguous, wrong type/binding,
wrong ref, revoked, broadened, missing-secret or changed-file state is REFUSED.
Exact rerun generates zero secrets, performs zero DB/file writes and does not
rotate, repair or reinstall. UNKNOWN uses RECONCILE, not rerun APPLY.

Every public JSON output has `additionalProperties:false`. A success receipt has
exactly: `schema_version`, `phase` (supply), `result` (COMMITTED or EXACT_RERUN_NOOP), `operation_id`,
`environment`, `operator_ref`, `approval_ref`, `approval_digest`, `approval_nonce`,
`source_commit`, `spec_ref`, `spec_digest`, `plan_digest`, `prestate_digest`,
`poststate_digest`, `audit_id`, `principal_id`, `principal_type` (service),
`principal_external_ref`, `client_row_id`, `client_id`, `client_external_ref`,
`resource`, `scope`, `grant_version` (1), `connector_subject`,
`connector_config_receipt_ref`, `connector_config_receipt_digest`,
`communication_scope_id`, `product_context` (exact CTR-MCS-002 fields),
`credential_delivery` (fixed path, uid/gid/mode, regular/nonsymlink booleans,
`secret_matches_verifier:true`; no bytes/hash), `effect_counts`
(principal/client/grant/audit first-apply 1/1/1/1; NOOP 0/0/0/0),
`non_target_digest_before`, `non_target_digest_after`, `committed_at`, `verified_at`.
UUIDs and dates use their actual schema types; pins are measured lowercase SHA256
or 40-hex Git SHA. No CSESB ref, guessed UUID, placeholder UUID or secret is allowed.

Failure output has exactly `schema_version`, `result` (REFUSED, ROLLED_BACK,
OUTCOME_UNKNOWN, SECRET_LOST or ROLLBACK_INCOMPLETE), `operation_id`, `environment`,
`stage`, `error_class`, `residual_coordinates`, `retryable:false`, `fence_preserved`,
`observed_at`. Missing unknown coordinates are omitted inside a closed tagged
projection, never filled with fabricated values. No raw error or private file
content is serialized. ROLLED_BACK is allowed only after DB rollback and exact
filesystem prestate restoration are both proven; otherwise use UNKNOWN/incomplete.

### CTR-MCS-009 — Verification and production boundary

VERIFY rechecks the exact generated IDs/unique external refs/type/status/binding,
single exact grant, empty new-client legacy arrays, same-transaction audit,
destination identity/metadata/verifier boolean, runtime/Audience pins and non-target
digests in a consistent read snapshot plus bounded filesystem observation. It emits
timestamps and that non-atomic observation limitation. It reads secrets only inside
the owning process for comparison, generates none and prints none. A health check,
JWKS response, source tests or package does not prove credential acceptance.

Separately authorized live client_credentials acceptance uses the delivered file
inside the original executor, trusted HTTPS and exact resource/scope; only safe
status/shape booleans and public pins are recorded. Positive, bad-secret, revoked,
wrong-resource/profile/scope, TLS failure and DSH zero-target-read/admission controls
remain separate integration gates. This supply source conformance MUST NOT perform
those live requests or claim them passed.

### CTR-MCS-010 — Retention, withdrawal and compatibility

Normal stop-send is DSH's controlled operation removing send while retaining
resolve/result, MCP enablement, TLS and this credential/grant. It preserves all
request/result/source/ACK/UNKNOWN/tombstone data. Revoking the whole client/grant
also blocks result authentication and is full disable, never normal stop-send.

Successful supply does not authorize deleting escrow. A separate retention mandate
may remove only this operation's raw escrow after proven commit, exact final-file
verification, safe receipt preservation and completion of the agreed rollback/
recovery retention window. Preserve all non-secret attempt fences and audit rows.
Never delete business records, clear fences, restore wider grants by rolling back
old migrations, or rotate/remint to conceal a secret-loss failure. Later full revoke
uses a new approved forward Grant/client operation with fresh audit and prestate;
this supply vehicle exposes no revoke mode. Other callers and all existing APIs,
token profiles, audiences and grants retain their independent accepted contracts.

### CTR-MCS-011 — Phase A bounded Audience registry reconciliation

Phase A has only two lawful first-write effects in one SERIALIZABLE transaction:
INSERT exactly one `AuthAudience` row keyed `agent-core-mcp-conversation-v1`, and
INSERT exactly one existing `AuthSecurityAudit`. The row's resourceService,
scopeNamespace, acceptedPrincipalTypes, registeredScopes and three access flags,
status and freezeReady equal the accepted MCP CCR CTR-MCC-001 exactly; row version
is 1. `notes` is source metadata, not an invented DB column. Generated timestamps
are read back. No Principal/Client/Grant, other Audience or credential is touched.

The only classifications are ABSENT_APPLY, EXACT_RERUN_NOOP or REFUSED. ABSENT_APPLY
requires authoritative target absence and zero matching operation audit. NOOP
requires the complete exact row/version, exactly one exact audit and all dependency/
non-target pins. A matching row with missing audit, a row of another version/status,
duplicate/mismatched audit, unknown state, or a present partial row is REFUSED;
never adopt, update, reactivate, repair, backfill or delete it. Unique PK insertion
is the absent-preimage CAS. The tool does not widen an existing registry row.

The original Auth release Owner must stop token serving through its existing
supervision/release lane before `registry apply` or `registry-disable apply`, hold
that exclusive mutation window through DB readback plus source/runtime alignment,
and supply a fresh attributable stop-serving receipt. The receipt binds exact
service/supervisor identity, old source/generated bytes, old loaded-source pins,
port4001/no-serving evidence, drain status, time, attempt and rollback preimage.
No health success or on-disk file alone proves loaded state. The tool checks those
fresh protected receipts and refused/unknown liveness means zero writes. It neither
stops/starts services nor creates a supervisor, daemon, shared lock service or
runtime API. Only the original release owner may perform load/resume afterward.

Both registry and supply transactions use the existing reconciliation-family
PostgreSQL advisory key `813_947_203` deliberately as one shared writer mutex,
in addition to the same protected local nonce/fence lane. This mutex does not
magically fence unrelated writers. Inside SERIALIZABLE, acquire related table
locks in fixed lexical table-name order before advisory SELECT or data snapshot:
`auth_audiences`, `auth_security_audits`, `grant_change_audits`,
`machine_access_grants`, `machine_clients`, `machine_principals`. Use write-conflict
locks on actual write tables and read-conflict locks on the others; table locks
must block uncooperative row writers for every read/write predicate. Establish the
data snapshot only after all locks are held. A lock timeout/serialization failure
aborts once with no automatic retry. Advisory-first snapshotting is forbidden.

Same-transaction registry audit uses eventType `audience.registry_reconciled`,
result `success`, and a closed details object: operation_id, migration_id,
source_git_commit, spec_ref/spec_digest, audience_authority_ref/digest,
operator_ref, approval_ref/digest, approval_nonce, phase, plan_digest,
stop_serving_receipt_ref/digest, bundle/runtime digests, reason, complete tagged
before/after row projections, non_target_digest_before/precommit. No secret or
database connection value is present. Audit failure or exact reselect mismatch
rolls back the row and audit together. Same operation+nonce with another digest
conflicts; a DB connection failure never proves absence.

Phase A public plan/receipt is a closed discriminated object containing the common
CTR-MCS-004 coordinates plus `phase`, `result`, `plan_digest`, `prestate_digest`,
`poststate_digest`, exact Audience before/after projection, `audit_id` on proven
commit only, stop-serving receipt reference/digest, non-target digests,
`effect_counts:{audience:1,audit:1,principal:0,client:0,grant:0,credential:0}`
(all zero for NOOP), committed/verified timestamps and
`runtime_alignment` (stopped_pending_load or verified_aligned). It contains no
generated caller ID or credential field. OUTCOME_UNKNOWN retains the nonce/fence
and permits only read-only same-operation reconciliation against exact row+audit;
no blind INSERT retry. Reconciled success proves DB effect, not resumed service.

Separate, forward `registry-disable` is the only registry rollback mutation. Under
its own approved plan/nonce, stopped-service window and exact active-row@1 CAS,
set status disabled, freezeReady false, version2, preserve every other field and
all caller/grant/history facts, and insert exactly one same-transaction
`audience.registry_disabled` audit with complete tagged before/after. Exact
disabled@2 plus matching disable audit is zero-write NOOP; all other states refuse.
No DELETE, source-file rewrite, grant revoke or re-enable is offered. A disabled
retained row cannot be silently reactivated by `registry apply`; reactivation needs
separate governing authority. Disabling is full native authentication disable and
blocks result authentication, never routine stop-send.

### CTR-MCS-012 — Exact source/runtime versions and two-phase release gates

The authoring source baseline is 1.12.0 at
`57f459804df1b6526a164016ea3aefa12836286d`; source registry SHA256 is
`4cbb725bb56f1fd817e8bb2a3fd7b91d1211b5be7e7fd38654947de6a98e86e4`,
manifest SHA256 is
`b2097f32becd48e740054018719abc18c1229aeae4d58813de8fc990c7f10c27`.
The v2 prior live snapshot records runtimeDigest
`131105f186688f6020aa3bae56f551ca1762b2a2cd31c29d07e97e7a4244e212` and
sourceBundleDigest
`b499ac82cfecc34ed181161f1e642c0497f3f780b8c4e7b91af307a55ffb6a80`.
These are evidence pins to compare, not default authority to overwrite drift.
The separate MCP source candidate is 1.14.0, preserving website's accepted 1.13.0
reservation without loading/implementing website entries or waiting for website
rollout. Future source Base/version movement follows CCR CTR-MCC-004's fresh
reservation/review rule; no 1.14.0 artifact or digest is invented here.

Before Phase A, the original executor must bind measured old installed+loaded
source/runtime tuple and restorable preimage, accepted CCR/supply revisions,
reviewed MCP candidate commit/tree, validated source bundle/generated runtime
digest and exact one-entry delta. An absent or changed pin requires re-PREFLIGHT.
The Phase A tool validates the candidate entry against that frozen artifact,
not a model-authored copy or the still-old serving process.

The original Auth owner then stops serving, runs approved Phase A, reads back the
exact row/audit, loads the reviewed candidate via its separate release mandate and
verifies the actual loaded runtime registry against the DB before resuming serving.
DB-committed-but-old/stopped-runtime is `stopped_pending_load`, not live readiness.
Load failure/unknown outcome retains the service stopped, records exact state and
does not retry/restart/rewrite DB implicitly. Returning to old source requires the
separately approved forward disabled-row operation and exact source restore before
resuming old serving. Source/DB switches are not a common transaction.

Phase B must receive the Phase A exact DB receipt and an independent actual-loaded
candidate/runtime+DB agreement receipt. It cannot infer either from source merge,
health or version label. Phase B then executes its own single nonce/plan/mandate and
identity/credential effects; it never repeats Phase A or edits its row. DSH/MCP
remain disabled until their own TLS/Binding/config/authentication gates. Registry
and supply runtime checks may read protected non-secret metadata but expose no
management API, DB URL or token. The three-file closure must contain all bounded
logic and isolated tests; if secure delivery/locking/recovery needs another source
file or unavailable OS primitive, implementation stops and re-PREFLIGHTs rather
than silently adding it.

## 10. Acceptance

All evidence binds exact accepted authority, source commit/tree, isolated runtime,
DB fixture, OS identities, time and executed outputs. NOT_RUN is not PASS. No
production DB or original transport is touched by source conformance.

| Acceptance | Contracts | Method / environment | Required evidence and expected result | Failure condition |
|---|---|---|---|---|
| ACC-MCS-001 | 001,003 | Independent docs/source closure review at exact base/head | accepted dependency/mandate gates; three files only; command availability honestly NOT_IMPLEMENTED before implementation | proposed authority executes; extra file/schema/API; unapproved audience or any business effect |
| ACC-MCS-002 | 002,004,006 | Isolated PostgreSQL + filesystem fixture; first supply | exactly one generated SERVICE principal/client/grant/audit, stable connector/scope from owning fixture receipt; absent tagged prestate and exact audit/version; zero existing-row writes | reader/target adopted; CSESB auth subject; wrong/extra grant; legacy-array mutation; made-up IDs |
| ACC-MCS-003 | 001,004 | Isolated negative matrix and concurrent processes | reject self-asserted approval, wrong issuer/actor/environment, stale plan/preimage, changed dependency, nonce replay, second nonce during unresolved fence, CAS collision; zero mint/target writes where preconditions fail | JSON/admin/credential accepted as human approval; duplicate apply or secret generation |
| ACC-MCS-004 | 003,005,008 | Isolated real-UID private-file tests and captured stdout/stderr/log/error streams | plan/verify/reconcile/NOOP generate zero secrets; first apply creates one 256-bit value only in process/private escrow/final file; proper0700/0600 ownership; secret-to-verifier boolean; streams contain zero secret/verifier; no production coordinates | raw/encoded credential disclosure; wrong uid/mode; symlink/hardlink/inode swap accepted; harness touches production |
| ACC-MCS-005 | 005,006,007 | Isolated fault injection at each fsync, file install, DB write, audit, commit-request/result and process kill; real PostgreSQL | DB four-row unit rolls back together; filesystem is explicitly separate; durable fence/escrow survives; authoritative reconcile yields exact state; no second mint or fence deletion | false combined atomicity; orphan secret reported success; guessed rollback/commit; new credential on uncertainty |
| ACC-MCS-006 | 005,007,008 | Isolated restart with committed+missing destination, escrow corruption/loss, no-commit proof and unauthorized recovery | original-secret recovery requires new exact mandate and CAS; no DB/secret generation; SECRET_LOST stays disabled/fenced; cleanup only after authoritative no-commit; exact rerun zero writes | rotate/client replacement; overwrite foreign file; query failure becomes absence; cleanup erases fence |
| ACC-MCS-007 | 004,006,008,009 | Isolated full target/non-target corpus, repeat and drift tests | complete exact rerun NOOP; partial/audit/file/type/status/ref/scope mismatch REFUSED; canonical before/precommit/after non-target equality; closed safe schemas and all coordinates real | partial adopted/repaired; unrelated write; null/UUID invention; secret hash in receipt; invalid output key accepted |
| ACC-MCS-008 | 001,009,010 | Contract review plus isolated DSH/MCP fixtures; live receipt review only under later mandate | supply leaves product disabled; normal stop removes send only and original result remains authorized; full revoke distinct; receipt says live checks NOT_RUN until exact POST evidence exists; escrow retention gate enforced | fixture/health treated live acceptance; result disabled by routine stop; source/supply deemed deployment; uncontrolled escrow deletion |
| ACC-MCS-009 | 001,003,004,011 | Isolated real PostgreSQL, table/advisory contention and audit faults; absent/exact/partial registry corpus | INSERT+same-txn audit exactly1/1; exact NOOP0/0; all caller/grant/other-audience effects0; locks before snapshot, stale/CAS/nonce conflict refused; commit uncertainty fenced | adopted row/no audit; audit failure commits; advisory-first stale snapshot; second insert on UNKNOWN; token/secret generated |
| ACC-MCS-010 | 010,011,012 | Isolated supervisor/loaded-runtime fixtures and source1.12→MCP1.14→disabled rollback with fault injection | stopped original issuer required; old/candidate hashes measured; pending-load explicit; website1.13 unmodified/independent; active@1→disabled@2 retained with new audit; Phase B requires real alignment receipt | mixed state called ready; health substituted loaded pin; automatic resume, website prerequisite, deletion/reactivation or silent version repair |

### Contract coverage

| Contract | Acceptance | Evidence class | Covered |
|---|---|---|---|
| CTR-MCS-001 | ACC-MCS-001,003,008 | independent review + isolated execution | YES |
| CTR-MCS-002 | ACC-MCS-002 | isolated DB/OS execution | YES |
| CTR-MCS-003 | ACC-MCS-001,004 | source closure review + isolated execution | YES |
| CTR-MCS-004 | ACC-MCS-002,003,007 | isolated DB/concurrency execution | YES |
| CTR-MCS-005 | ACC-MCS-004,005,006 | real-UID/filesystem fault execution | YES |
| CTR-MCS-006 | ACC-MCS-002,005,007 | real PostgreSQL/audit/digest execution | YES |
| CTR-MCS-007 | ACC-MCS-005,006 | kill/restart/commit uncertainty execution | YES |
| CTR-MCS-008 | ACC-MCS-004,006,007 | schema/secret/replay/drift execution | YES |
| CTR-MCS-009 | ACC-MCS-007,008 | isolated verification + later live evidence review | YES |
| CTR-MCS-010 | ACC-MCS-008 | contract review + isolated product fixture | YES |
| CTR-MCS-011 | ACC-MCS-009,010 | real PostgreSQL/concurrency/rollback execution | YES |
| CTR-MCS-012 | ACC-MCS-001,010 | source/runtime/lifecycle fault execution | YES |

Coverage is a defined test obligation, not a claim that tests have run.

## 11. Alternatives and disposition

ALT-MCS-001 REJECTED: borrow reader7711, BIP d5b3, Notification credential or select
a Human by admin/display name. They are distinct identities; no caller authority.

ALT-MCS-002 REJECTED: use CSESB business_subject/source-binding as a permanent MCP
authentication/routing identity. It violates DEC-CSESB-003 and adds an unnecessary
identity model. DSH's existing controlled configuration mapping owns this fact.

ALT-MCS-003 REJECTED: call machine-admin, capture generic API secret output, widen
legacy arrays or mutate Grant ad hoc. Those lack this bounded secure handoff,
exact authority/prestate/audit and recovery contract.

ALT-MCS-004 REJECTED: call filesystem+DB one transaction or auto-retry after commit
timeout. Separate persistence boundaries permit an ambiguous outcome.

ALT-MCS-005 REJECTED: rotate/remint/recreate on lost first secret, print it for
manual copying, delete the fence or treat partial supply as NOOP. Preserve original
effect and evidence; separately govern any incident repair.

Reopening an alternative requires exact new evidence plus an owning authority
route; implementation preference alone does not reopen it.

## 12. Migration, compatibility, and rollback

Model disposition: RETAIN existing generic provisioning and other callers for
their distinct responsibilities; RETAIN Auth principal/client/grant roots; use
DSH's already-owned stable product mapping; no legacy identity bridge or global
migration is introduced. No CSESB enrollment/source/lifecycle mutation occurs.

No production artifact is changed by this proposal. Future first supply has an
absent destination preimage; it neither adopts nor rewrites an existing private
credential. Before proven DB commit, exact rollback may remove only files created
by that attempt under CAS and restore proven absence; uncertain commit preserves
both private recovery material and fence. After proven commit, no “rollback” mints
another credential or deletes audits. Use the separately mandated recovery/full
disable boundaries in CTR-MCS-007/010. Product request/result retention remains DSH
authority and is unaffected by source rollback.

## 13. Open questions

```text
OPEN_OWNER_DECISIONS = Owner acceptance of this proposed bounded supply contract
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
PARTIAL_SUPERSESSION = NONE
READY_TO_MARK_ACCEPTED = NO
IMPLEMENTED = NO
PRODUCTION_APPLIED = NO
LIVE_CREDENTIAL_ACCEPTANCE = NOT_RUN
```

Runtime values still require attributable operation evidence, not manual technical
placeholders: original-transport config receipt/stable connector UUID, exact active
Audience/source/runtime pins, OS permission/escrow setup readback, authenticated
operator and single-attempt mandate. Absence of any keeps operation blocked. An
accepted Spec does not itself create these values, grant OS permission or perform
the #1156 round trip. The author is not the acceptance actor.
