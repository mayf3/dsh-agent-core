---
spec_id: AGENT_CORE_WORKFLOW_ADMIN_AGENT_BOOTSTRAP_OPERATOR_V1
status: proposed
date: 2026-08-29
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
scope:
  - mayf3/dsh-agent-core
  - deployment-prebound, exact-attempt, single-operation local trigger channel for workflow_admin_agent_bootstrap_v1 and agt_workflow-admin-agent; implementation, deployment, audit, execution-window and bootstrap execution are separate tasks
governed_by:
  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0
depends_on:
  - AGENT_CORE_WORKFLOW_ADMIN_AGENT_BOOTSTRAP_V1
  - AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1
external_authorities:
  - repository: mayf3/auth-service
    authority_id: MINIMAL_AUTH_FOUNDATION_V2
    revision: 7110463636693b3c2eced9d97ccb186adf46907d
    relation: depends_on
  - repository: mayf3/auth-service
    authority_id: AUTH_SERVICE_OWNERLESS_AGENT_PRINCIPAL_V1
    revision: 7110463636693b3c2eced9d97ccb186adf46907d
    relation: depends_on
  - repository: mayf3/auth-service
    authority_id: AUTH_SERVICE_AGENTCORE_IDENTITY_RESOLUTION_V1
    revision: 7110463636693b3c2eced9d97ccb186adf46907d
    relation: depends_on
supersedes: []
superseded_by: null
owners:
  - mayf3
type: dedicated-bootstrap-operator-channel-spec
---

# AGENT_CORE_WORKFLOW_ADMIN_AGENT_BOOTSTRAP_OPERATOR_V1 — Trigger 不是 Authority 的单次 Bootstrap Operator

> **PROPOSED / DOCS-ONLY / SPEC ONLY。** Amendment Round 1 原位修订同一 proposed
> Spec 与 Draft PR #100。本轮不实现、不部署、不创建 socket、不打开执行窗口、不执行
> Bootstrap、不写 production runtime / Agent Definition / credential store / attempt
> ledger，不调用 auth-service，不读取或输出 secret，不 accepted、不 Ready、不 merge。
>
> 独立审计结论 `REVISE`（reviewed head
> `d45269bf1e46579249690ba1dc4c8b1ab3b69e44`）指出旧模型错误地把
> `LOCAL_PEERCRED / peer uid 502` 当成授权来源，并让 uid505 private state 取代父
> repository attempt ledger。本 Amendment 完整删除该安全依赖并恢复父 authority：
>
> ```text
> TRIGGER_IS_NOT_AUTHORITY
> CALLER_AUTHORIZATION_MODEL = PREBOUND_EXACT_OPERATION
> REPOSITORY_ATTEMPT_LEDGER = AUTHORITATIVE
> UID505_PRIVATE_OPERATOR_STATE = CRASH_RECOVERY_REPLICA_ONLY
> UDS_PURPOSE = local transport only
> ```

---

## 0. Owner 冻结（实现、部署与执行任务不得重新决定）

```text
EXACT_OPERATION = workflow_admin_agent_bootstrap_v1
EXACT_AGENT_ID = agt_workflow-admin-agent
EXACT_DISPLAY_NAME = 工作流总管
EXACT_PRINCIPAL_EXTERNAL_REF = agentcore:v1:principal:agt_workflow-admin-agent
EXACT_CLIENT_EXTERNAL_REF = agentcore:v1:client:agt_workflow-admin-agent
OPERATOR_RUNTIME_UID = 505
TRIGGER_UID = 502

CALLER_AUTHORIZATION_MODEL = PREBOUND_EXACT_OPERATION
PEER_UID_IS_AUTHORITY = NO
REQUEST_BODY_IS_AUTHORITY = NO
TRIGGER_IS_AUTHORITY = NO
UDS_IS_AUTHORIZATION_SOURCE = NO
UDS_PURPOSE = local transport only

EXECUTION_AUTHORIZATION_SOURCE =
a deployment-time immutable exact-attempt binding installed inside the
uid505-owned trusted closure by a separately accepted and audited deployment task

OTHER_UID502_PROCESS_CAN_CONNECT = YES
OTHER_UID502_PROCESS_CAN_SELECT_OPERATION = NO
OTHER_UID502_PROCESS_CAN_SELECT_AGENT = NO
OTHER_UID502_PROCESS_CAN_CHANGE_REQUEST = NO
EARLY_TRIGGER_BEFORE_EXECUTION_WINDOW = REJECTED
TRIGGER_DURING_OPEN_WINDOW = may only advance the already approved exact attempt

REPOSITORY_ATTEMPT_LEDGER = AUTHORITATIVE
UID505_PRIVATE_OPERATOR_STATE = CRASH_RECOVERY_REPLICA_ONLY
AUTH_SERVICE_NEW_PROVISIONER_CHILD_REQUIRED = NO
MEMORY_ZEROIZATION = BEST_EFFORT
ROLLBACK_TARGET = SAFE_DISABLED_STAGED_IDENTITY
GENERAL_OPERATOR_CAPABILITY = FORBIDDEN
SECRET_CROSSES_UID_BOUNDARY = NO
```

任何 uid502 进程最多触发同一个已经获批的动作。它不能授予动作、选择 subject、改变
参数、扩大权限或取得 secret。若错误进程抢先触发，其最大效果仍只能是推进部署任务已
预绑定的同一 attempt；endpoint 不在 exact execution window 时全部请求拒绝。

## 1. Goal

为父 Spec `AGENT_CORE_WORKFLOW_ADMIN_AGENT_BOOTSTRAP_V1` 的单次「身份 执行」建立一条
local-only trigger transport。真正的执行授权在部署时已经绑定为一个 immutable exact
attempt；trigger 仅提交阶段推进证明。Operator 在 uid505 trusted closure 内执行父 Spec
允许的同一动作：建立 `agt_workflow-admin-agent` 的 disabled identity，零 Grant、零
Binding、零 Root、不可路由、不可运行，并保持后续 Slice 完全独立。

```text
SPEC_DEDUP_CLASSIFICATION = AMEND
DUPLICATE_SPEC_RISK = NONE
PARTIAL_SUPERSESSION = NONE
DOCS_MERGE_DEPLOYS_OPERATOR = NO
BOOTSTRAP_RUNTIME_WRITE_AUTHORIZED_NOW = NO
```

## 2. Scope and non-goals

### 2.1 In scope（仅为后续任务建立 Contract）

- deployment-time exact-attempt binding、有限 `notBefore/expiresAt` window；
- local UDS transport、safe pathname lifecycle、strict framed JSON parser；
- repository ledger acknowledgement 与 uid505 crash-recovery replica；
- canonical Agent Definition writer、auth-service S1/S2、Part G store writer 与父 D.5
  verification 的阶段化编排；
- one-shot、single-instance、mutex、stateVersion CAS、crash/replay/reconciliation；
- non-secret closed success/error responses；
- dedicated auth client 的日志、trace、exception、diagnostic 与 memory handling；
- exact implementation/deployment file closure 与五段任务生命周期。

### 2.2 Explicit non-goals

```text
GENERAL_OPERATOR / ARBITRARY_AGENT / ARBITRARY_OPERATION = FORBIDDEN
SHELL / COMMAND / ARGV / FILE_PATH / GENERIC_FILE_WRITER = FORBIDDEN
TCP / PUBLIC_HTTP / ROOT_HOST_EXEC / SUDO / LAUNCHCTL_ASUSER = FORBIDDEN
DIRECT_DATABASE_WRITE = FORBIDDEN
REQUEST_SUPPLIED_AUTHORITY = FORBIDDEN
PRINCIPAL_UUID_OR_CLIENT_ID_INPUT = FORBIDDEN
GRANT / BINDING / ROOT / ACTIVATION = FORBIDDEN
WORKSPACE / HOME / SCHEDULER / DOMAIN / FEISHU = OUT_OF_SCOPE
AUTH_SERVICE_CODE_OR_AUTHORITY_CHANGE = OUT_OF_SCOPE
OPERATOR_IMPLEMENTATION_OR_DEPLOYMENT_IN_THIS_ROUND = NO
```

Bootstrap 后仍必须是 `{ disabled: true }`、无 Grant、无 Root、无 Binding；本 Spec 不得
顺手完成 V3 后续任何 Slice。

## 3. Authority and dependencies

```text
PRIMARY_PARENT_AUTHORITY = AGENT_CORE_WORKFLOW_ADMIN_AGENT_BOOTSTRAP_V1
PARENT_ACCEPTED_HEAD = bb0db2855470650da531431c35c4b0e2a7ae1157
PARENT_RELATION = child transport/orchestration authority; no parent redefinition

INHERITED_AUTHORITY = AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1
INHERITED_SEAMS = C.4 external_ref; D/D.5/D.7; E.4(c); G store writer; H secret handoff

DSH_MAIN_OBSERVED = 9883c4b012a3cd1a83f028a356eb2760c23a1fda
AUTH_SERVICE_MAIN_OBSERVED = 7110463636693b3c2eced9d97ccb186adf46907d
```

父 Spec 的 repo ledger、outcome_unknown、final receipt、`SAFE_DISABLED_STAGED_IDENTITY`
与 Slice 分离逐字有效。uid505 private state 只复制执行所需的最小非秘密事实用于 crash
recovery；它不接受、更改或替代 repo ledger authority。

## 4. Current State

- `STATE-OP-001` — PR #100 在 Amendment 开始时为 OPEN / Draft / unmerged，head
  `d45269bf1e46579249690ba1dc4c8b1ab3b69e44`；本 Spec 为 proposed。Basis:
  `OBS-OP-001`。
- `STATE-OP-002` — dsh-agent-core main `9883c4b...` 已有 canonical Agent Definition
  writer、agent credential provisioning writer 与 production-runtime composition，但没有本
  Operator package。Basis: `OBS-OP-002`、`OBS-OP-003`。
- `STATE-OP-003` — 本机 trusted root 存在，但专用 run directory 尚不存在；该事实不
  授权创建它。Basis: `OBS-OP-004`。

## 5. Observations

### OBS-OP-001 — PR 与 revision gate

- Subject: mayf3/dsh-agent-core PR #100。
- Source revision: head `d45269bf...`; main `9883c4b...`。
- Method: `git fetch github --prune`; `gh pr view 100`。
- Result: OPEN, Draft, unmerged, mergeable; head 未漂移。
- Provenance: Amendment Round 1 execution record and PR conversation comment
  `WORKFLOW_ADMIN_BOOTSTRAP_OPERATOR_R1_INDEPENDENT_REVIEW`。

### OBS-OP-002 — Canonical writers exist on current main

- Subject: `packages/agent-definition/src/config.js` and
  `packages/agent-credential-provisioning/src/{index,auth-client,store-writer}.js`。
- Source revision: dsh-agent-core `9883c4b...`。
- Method: source inventory and read-only inspection。
- Result: `createAgentInConfig` / `writeAgentDefinition` and the credential provisioning
  adapters exist; Operator must call them rather than duplicate their authority。
- Provenance: current-main tree inventory。

### OBS-OP-003 — Production runtime composition and supervision seams

- Subject: `packages/production-runtime/src/compose.js`,
  `scripts/production-runtime-launchd.mjs`, `scripts/trusted-cp-deploy-install.sh`。
- Source revision: dsh-agent-core `9883c4b...`。
- Method: source inspection。
- Result: composition is centralized in `compose.js`; trusted target and launchd env are rendered by
  the named scripts. Any Operator mount/config gate must use those exact seams。
- Provenance: current-main source。

### OBS-OP-004 — Current trusted path coordinates

- Subject: `/usr/local/libexec/agent-core`, its `run` and `config` children, local uid/gid records。
- Environment/observed at: amendment host, 2026-08-29。
- Method: read-only `stat`, `id`, `dscl`。
- Result: trusted root currently `uid=0 gid=0 mode=0755`; `run` absent; `config` currently
  `uid=0 gid=0 mode=0755`; authsvc uid/gid = `505/601`; requester uid/gid = `502/20`。
- Limitation: these are pre-deployment facts, not a claim that the future dedicated directory already
  conforms. Deployment must create and audit the exact closure in `CTR-OP-015`。

### OBS-OP-005 — Node peer UID is not an implementation premise

- Subject: proposed Darwin UDS caller model。
- Source revision: reviewed Spec head `d45269bf...` and independent review record。
- Method: semantic and implementability review。
- Result: multiple Agents share uid502, and the selected Node runtime does not expose a required
  built-in Darwin peer-UID API. Native addon/FFI/helper would enlarge build/sign/deploy closure without
  proving which uid502 Agent was authorized。
- Provenance: PR #100 independent review comment。

### OBS-OP-006 — Darwin peer identity cannot distinguish the authorized Agent

- Subject: all local Agent processes running as uid502 on the single-user host。
- Source revision/environment: amendment host, reviewed model at `d45269bf...`。
- Method: compare the former `peer uid == 502` predicate with the deployment-prebound subject tuple。
- Result: peer UID can at most classify a local account; it cannot identify the exact authorized Agent,
  attempt or operation. It is therefore telemetry/locality evidence only, never authority。
- Provenance: independent review record and Owner Amendment Round 1 ruling。

### OBS-OP-007 — auth-service current main is unchanged from the fixed input

- Subject: mayf3/auth-service github/main。
- Source revision: `7110463636693b3c2eced9d97ccb186adf46907d`。
- Method: `git fetch github --prune; git rev-parse github/main`。
- Result: exact match with the fixed observed revision; no auth-service drift classification is needed in
  this authoring round. Current source exposes loopback HTTP health/S1/S2 but no audited uid505-private
  provisioning UDS or equivalent pre-credential server authentication; the named external transport
  prerequisite is therefore NOT_ESTABLISHED. Runtime compatibility still requires fresh execution-time
  revalidation after that prerequisite exists。
- Provenance: Amendment Round 1 gate output。

### OBS-OP-008 — This work is an in-place amendment, not a duplicate authority

- Subject: dsh-agent-core Specs, PR #100 and its source branch。
- Source revision: PR head `d45269bf...`, main `9883c4b...`。
- Method: exact Spec path/ID and PR branch inspection。
- Result: the same proposed Spec and same Draft PR are amended; no second Operator Spec or PR exists or
  is created. `SPEC_DEDUP_CLASSIFICATION = AMEND`; `DUPLICATE_SPEC_RISK = NONE`。
- Provenance: repository and PR gate outputs。

## 6. Claims and assumptions

### CLM-OP-001 — A trigger can be non-authoritative

- Support state: SUPPORTED
- Supported by evidence: `EVD-OP-001`
- Uncertainty: none; authority fields are absent from the request and immutable in uid505 deployment
  state。

### CLM-OP-002 — Repository ledger authority and private recovery state can coexist

- Support state: SUPPORTED
- Supported by evidence: `EVD-OP-002`
- Uncertainty: crash injection remains future conformance evidence, not authoring evidence。

### CLM-OP-003 — The implementation closure is determinate on current main

- Support state: SUPPORTED
- Supported by evidence: `EVD-OP-003`
- Uncertainty: future main drift is fail-closed under `CTR-OP-018`。

### CLM-OP-004 — The channel grants uid502 no selectable uid505 capability

- Support state: SUPPORTED
- Supported by evidence: `EVD-OP-004`
- Uncertainty: future implementation conformance remains subject to ACC-OP-001/002/003/013; the
  normative construction itself contains no caller-selected subject, operation parameters or path。

## 7. Evidence relations

### EVD-OP-001 — Review finding supports prebound authority

- Source observations: `OBS-OP-001`, `OBS-OP-005`
- Target: `CLM-OP-001`
- Relation: SUPPORTS
- Bound coordinates: PR #100 reviewed head `d45269bf...`
- Strength/sufficiency: sufficient for the selected authorization model
- Limitations: future implementation still needs conformance tests
- Provenance: independent review comment and this amendment

### EVD-OP-002 — Parent authority supports repository-ledger primacy

- Source observations: `OBS-OP-002`
- Target: `CLM-OP-002`
- Relation: SUPPORTS
- Bound coordinates: parent accepted head `bb0db285...`, dsh main `9883c4b...`
- Strength/sufficiency: normative parent authority plus current seams
- Limitations: runtime durability requires later fault-injection evidence
- Provenance: parent Spec and current source

### EVD-OP-003 — Current source inventory supports exact closure

- Source observations: `OBS-OP-002`, `OBS-OP-003`, `OBS-OP-004`
- Target: `CLM-OP-003`
- Relation: SUPPORTS
- Bound coordinates: dsh main `9883c4b...`, amendment host path facts
- Strength/sufficiency: sufficient to freeze file and deployment closure
- Limitations: no claim that files are implemented now
- Provenance: current-main inventory

### EVD-OP-004 — Prebound fields and closed request support non-selectable capability

- Source observations: `OBS-OP-005`, `OBS-OP-006`, `OBS-OP-008`
- Target: `CLM-OP-004`
- Relation: SUPPORTS
- Bound coordinates: Owner Amendment Round 1 ruling and PR #100 in-place amendment
- Strength/sufficiency: constructive at the normative schema boundary
- Limitations: implementation must still satisfy the negative Acceptance matrix
- Provenance: §0, CTR-OP-001/002/003/013 and independent review record

## 8. Decisions

### DEC-OP-001 — UDS remains transport only

- Decision owner: mayf3
- Decision: use a dedicated local UDS at
  `/usr/local/libexec/agent-core/run/workflow-admin-bootstrap-operator-v1/operator.sock`.
  It supplies locality only; it is not an authorization source.
- Rejected alternative: LOCAL_PEERCRED/native helper/FFI as authority; TCP/public HTTP。
- Owner input remaining: none。

### DEC-OP-002 — Authorization is the deployment-time exact-attempt binding

- Decision owner: mayf3
- Decision: endpoint reads all subject and authority fields from immutable uid505-owned deployment
  binding. Peer UID, request body and trigger timing never grant authority. Peer identity MAY be recorded
  as telemetry only and MUST NOT gate correctness。
- Rejected alternative: treating uid502, a process identity, or request-carried UID as Principal。
- Owner input remaining: none。

### DEC-OP-003 — Revision binding separates implementation base and evidence commit

- Decision owner: mayf3
- Decision: `implementationBase` is exact main at authorization; `evidenceCommit` is its descendant in
  one OPEN/DRAFT/unmerged evidence PR and changes only
  `docs/evidence/workflow-admin-agent-bootstrap-v1/**`. Current main must remain exactly
  `implementationBase` throughout the execution window。
- Rejected alternative: `main HEAD == evidenceCommit`。
- Owner input remaining: none。

### DEC-OP-004 — Parent repo ledger stays authoritative

- Decision owner: mayf3
- Decision: requester commits PREPARED ledger; Operator verifies commit/digest; Operator persists
  INTENT, performs one stage, persists RESULT, returns non-secret result, then waits for a new repository
  ledger commit/digest acknowledgement before entering the next stage. Multiple ledger-only phase
  commits are expected and allowed。
- Rejected alternative: uid505 state as authoritative transaction ledger。
- Owner input remaining: none。

### DEC-OP-005 — Provisioner reuse requires fresh zero-write revalidation

- Decision owner: mayf3
- Decision: no new provisioner child. Before implementation/deployment, require the separately accepted
  auth-service uid505-private provisioning UDS transport; unauthenticated loopback HTTP is forbidden.
  Before every Bootstrap side effect, validate active Principal, active Client, correct audience,
  `auth.identity.provision` grant, usable credential and current auth-service compatibility. Failure = STOP
  with zero Definition/S1/S2/store writes。
- Rejected alternative: document-time assertion that live provisioner is active。
- Owner input remaining: none。

### DEC-OP-006 — Private state is a durable CAS recovery replica

- Decision owner: mayf3
- Decision: private state uses explicit phases and monotonically increasing `stateVersion`; one process
  mutex plus persistent CAS prevents double execution. It stores no secret and cannot advance without
  matching repository-ledger acknowledgement。
- Rejected alternative: in-memory-only state or private state replacing repo evidence。
- Owner input remaining: none。

### DEC-OP-007 — Secret handling is bounded and zeroization is best effort

- Decision owner: mayf3
- Decision: dedicated auth client disables body debug and redacts Authorization; state/log/trace/error/
  diagnostic surfaces contain no secret. Prefer overwriteable Buffer; immutable strings receive shortest
  lifetime and reference release only. JavaScript physical zeroization is not claimed。
- Rejected alternative: whole-store digest, response-body logging, guaranteed JS string zeroization。
- Owner input remaining: none。

### DEC-OP-008 — Safety terminal remains parent-defined

- Decision owner: mayf3
- Decision: failure converges to `SAFE_DISABLED_STAGED_IDENTITY`; no Definition delete seam, second
  Client, changed external_ref, Grant, Binding, Root or activation。
- Rejected alternative: inventing rollback deletion or continuing after secret loss。
- Owner input remaining: none。

### DEC-OP-009 — One-shot lifecycle and execution window

- Decision owner: mayf3
- Decision: deployed endpoint is default disabled/unavailable. Only a separately installed exact binding
  with finite `notBefore/expiresAt` opens the window. Early/late triggers reject. Terminal success rejects
  every new attempt forever; same terminal request may replay its non-secret result。
- Rejected alternative: permanent generic admin endpoint。
- Owner input remaining: none。

### DEC-OP-010 — Five tasks, never an implementation/deployment/execution bundle

- Decision owner: mayf3
- Decision: A implementation; B disabled deployment; C independent deployment audit; D exact-window
  binding; E Bootstrap trigger/execution. No earlier task may perform a later task's action。
- Rejected alternative: deploying Operator and opportunistically bootstrapping the Agent。
- Owner input remaining: none。

## 9. Contracts

### CTR-OP-001 — Closed trigger request; authority fields are absent

One length-prefixed frame contains exactly one JSON object with exactly:

```text
operation
attemptId
phase
evidenceCommit
ledgerDigest
operatorStateVersion
```

`operation` MUST equal `workflow_admin_agent_bootstrap_v1`; it is a consistency discriminator, not
an authority selector. Client MUST NOT send agentId, external_ref, accepted revisions,
implementationBase, command, shell, argv, path, Principal UUID, Client ID, secret, Token, Grant,
Binding, Root or activation input. Framing/UTF-8/JSON/schema failures, including unknown/missing/invalid
`attemptId` or `phase`, close the connection with no response and zero write, because no truthful response
identity exists before validation. Only a fully valid six-field request receives CTR-OP-009 success/error。

### CTR-OP-002 — Trigger is not authority

Operator MUST obtain execution authority only from the deployment binding in `CTR-OP-003`.
`LOCAL_PEERCRED`, peer UID, request-carried UID, uid502 identity and socket mode MUST NOT authorize an
operation. Other uid502 processes may connect, but cannot select or mutate operation/subject/parameters.
Before `notBefore`, after `expiresAt`, with no binding, or after binding revocation, every request rejects
before any Bootstrap side effect. No native addon, FFI or helper is required for peer UID.

### CTR-OP-003 — Immutable exact-attempt binding and exact subject

The uid505-owned binding MUST contain exactly these immutable fields:

```text
bindingVersion (= 1)
bindingGeneration (lowercase UUID)
repository (= mayf3/dsh-agent-core)
operatorImplementationPrNumber (positive integer)
evidencePrNumber (positive integer)
evidenceHeadRepository (= mayf3/dsh-agent-core)
evidenceHeadRef (refs/heads/<safe branch>)
acceptedOperatorSpecRevision
acceptedBootstrapSpecRevision
runtimeConfigDigest
authContractVersion
authContractDigest
implementationBase
attemptId
exactOperation
exactAgentId
principalExternalRef
clientExternalRef
initialEvidenceCommit
initialLedgerDigest
notBefore
expiresAt
```

All revision/base/commit fields are lowercase 40-hex Git object IDs; digest fields are lowercase 64-hex;
PR numbers are positive safe integers; generation/attempt are lowercase UUID; `authContractVersion` is
ASCII `[A-Za-z0-9._-]{1,64}` and `authContractDigest` is lowercase 64-hex; notBefore/expiresAt are
canonical RFC3339 UTC milliseconds with notBefore < expiresAt and a maximum 30-minute window.
`evidenceHeadRef` matches `refs/heads/[A-Za-z0-9._/-]{1,200}` with no `..`, `//`, leading slash after the
prefix or trailing slash. Values for operation/Agent/external_refs are §0 literals. Client cannot override
them. A different attempt, Agent, path, external_ref, revision or operation rejects with zero side effect.
Binding is written
only by task D after task C audit; runtime reads it but never edits authority fields。Exact private paths
and modes are:

```text
PRIVATE_DIR = /usr/local/libexec/agent-core/config/operator/workflow-admin-bootstrap-v1
PRIVATE_DIR_OWNER = uid505:gid601
PRIVATE_DIR_MODE = 0700
RUNTIME_CONFIG_PATH = <PRIVATE_DIR>/runtime-config.json
PROVISIONER_CREDENTIAL_PATH = <PRIVATE_DIR>/provisioner-credential.json
BINDING_PATH = <PRIVATE_DIR>/exact-attempt-binding.json
ACTIVATION_PATH = <PRIVATE_DIR>/window-activation.json
STATE_PATH = <PRIVATE_DIR>/state.json
LOCK_PATH = <PRIVATE_DIR>/operator.lock
RUNTIME_CONFIG_MODE = 0400
PROVISIONER_CREDENTIAL_MODE = 0400
BINDING_MODE = 0400 after durable installation
ACTIVATION_MODE = 0400 after durable installation
STATE_MODE = 0600
LOCK_MODE = 0700 directory lock

PRIVATE_ANCESTORS =
/usr, /usr/local, /usr/local/libexec = uid0:gid0, non-symlink directory,
  not group/other writable
/usr/local/libexec/agent-core = uid0:gid0 mode0755, no inherited ACL, uid502 not writable
/usr/local/libexec/agent-core/config = uid0:gid0 mode0755, no inherited ACL, uid502 not writable
/usr/local/libexec/agent-core/config/operator = uid505:gid601 mode0700, no ACL, uid502 no traverse
<PRIVATE_DIR> = uid505:gid601 mode0700, no ACL, uid502 no traverse
```

Deployment, D1/D2/D3, runtime startup/before-stage and rollback lstat every ancestor and pin dev/inode/type/
owner/mode/ACL inheritance. Node lacks a public openat traversal API, so the accepted equivalent under this
threat model is: pre-walk pins all ancestors, leaf opens use O_NOFOLLOW, post-walk requires every pinned
ancestor dev/inode unchanged, and CTR-OP-010 singleton lock excludes another trusted uid505 Operator.
Root and malicious uid505 are host/trusted-closure controllers outside the defended threat model; any
untrusted-writable ancestor or ambiguity fails closed。

Runtime config is RFC 8785 JCS with exactly:

```text
version = 1
authServiceSocketPath = /usr/local/libexec/auth-service/run/agent-core-bootstrap-v1/auth.sock
agentsConfigPath = /usr/local/libexec/agent-core/config/agents.json
credentialStorePath = /usr/local/libexec/agent-core/config/agent-credentials.json
provisionerCredentialPath = <PROVISIONER_CREDENTIAL_PATH literal>
```

It contains no secret; its exact JCS digest equals binding `runtimeConfigDigest`. The auth socket is an
**external prerequisite**, not created by this repository: auth-service must first accept, merge, implement
and independently audit a child authority whose stable expected ID is
`AUTH_SERVICE_AGENT_CORE_BOOTSTRAP_PROVISIONING_UDS_V1`. That external authority must expose the existing
health/S1/S2/resolution/token semantics over this one uid505-private UDS, with the exact component matrix:
`/usr`, `/usr/local`, `/usr/local/libexec` are uid0:gid0 non-symlink directories not group/other writable;
`/usr/local/libexec/auth-service` is uid0:gid0 mode0755, no inherited ACL and not uid502-writable;
`.../run` and `.../run/agent-core-bootstrap-v1` are uid505:gid601 mode0700, ACL inheritance disabled,
no uid502 traverse/write ACE; `auth.sock` is uid505:gid601 mode0600 with no uid502 ACL. The external
authority must freeze and audit each component, no TCP fallback, safe inode lifecycle and exact current
auth-contract reporting. At observed auth-service main `71104636...`, this authenticated transport is not
established; therefore task B/D/E MUST STOP until the external prerequisite is active and audited.
`AUTH_SERVICE_NEW_PROVISIONER_CHILD_REQUIRED=NO` remains true: this prerequisite authenticates transport
and creates no provisioner Principal/Client/Grant。

Loopback HTTP `127.0.0.1:4001` is explicitly forbidden for provisioner credential/token/S1/S2 traffic:
a different local UID could bind it while auth-service is absent and steal the credential. The dedicated
client uses Node built-in HTTP-over-UDS `socketPath` only, verifies exact socket ancestor owner/mode/dev/inode
before connect and after response, and sends no credential until those checks pass. Inability to satisfy the
external UDS prerequisite is `PROVISIONER_NOT_READY` with zero Bootstrap write, not permission to fall back。

The provisioner file is a separate 0400 uid505:gid601 regular no-symlink file with exactly
`{clientId,clientSecret}` and is never hashed into binding/evidence/output. Task B may install an already-authorized credential input but MUST NOT
create a new Principal/Client/Grant; task C audits only path type/owner/mode/nonzero length and never opens,
reads or logs the secret file. Runtime parses it only inside the fresh revalidation boundary. Missing,
unreadable or malformed credential means revalidation failure and zero Bootstrap write。

Binding JSON is RFC 8785 JCS of exactly the listed fields; its identity is lowercase hex
`SHA-256(exact JCS bytes)`. It is created as generation-specific 0600 temp, validated, fsynced, renamed,
directory-fsynced, then chmod 0400 and re-read/digested. Runtime opens with `O_RDONLY|O_NOFOLLOW`, verifies
regular file/owner/mode/dev/inode before and after read, and pins generation+digest for the process lifetime.
It never replaces binding bytes. Revocation is an atomic replacement of `ACTIVATION_PATH` with closed
`active:false` bytes by task D3; runtime re-reads activation before each stage。

`ACTIVATION_PATH` is exact RFC 8785 JCS with fields
`{version,bindingGeneration,bindingDigest,auditCommentId,auditReviewerId,auditReviewerSessionId,
auditReceiptCommit,auditReceiptDigest,active,activatedAt,revokedAt}`. Types/invariants:

```text
version = 1
bindingGeneration = lowercase UUID equal binding
auditCommentId = positive safe integer
auditReviewerId = ASCII [A-Za-z0-9._:@/-]{1,128}
auditReviewerSessionId = same grammar, equal receipt reviewerSessionId
auditReceiptCommit = lowercase 40-hex
auditReceiptDigest = lowercase 64-hex
bindingDigest = lowercase 64-hex equal binding JCS digest
active = boolean
never activated: active=false, activatedAt=null, revokedAt=null
active window: active=true, activatedAt=canonical RFC3339 UTC milliseconds, revokedAt=null
revoked: active=false, activatedAt=<original activation timestamp>,
  revokedAt=canonical timestamp >= activatedAt
```

Its artifact digest is SHA-256(exact JCS bytes). `active:true` is legal only after the independently
persisted comment and audit receipt report PASS for the exact binding/config digest and reviewer identity.
Revocation atomically replaces only activation with the same generation/audit coordinates and later
`revokedAt`; reactivation of a revoked generation is forbidden. A new binding generation is allowed only
after the old activation is false and no stage is in flight; it requires a fresh D1/D2/D3 transaction and
cannot follow `TERMINAL_SUCCESS`。

All private artifacts use same-directory temp + fsync(file) + atomic rename + fsync(directory), reject
symlinks/non-regular files, and are never readable by uid502. Torn/corrupt/missing/changed artifacts fail
closed. Binding/activation replacement or revocation belongs only to task D; state mutation belongs only
to the runtime CAS in `CTR-OP-010`。

### CTR-OP-004 — Governance and five-task separation

Operator implementation requires this exact accepted Spec in its implementation base. Tasks A–E in
`DEC-OP-010` MUST have separate persisted records. Docs merge performs no deployment; implementation
performs no deployment or Bootstrap; deployment leaves endpoint disabled/unavailable and performs no
Bootstrap; audit performs no mutation; exact-window task installs only binding/window; execution only
triggers the prebound attempt. No root host-exec, sudoers, launchctl-asuser or direct DB bypass is allowed。

### CTR-OP-005 — Correct main/evidence/ledger binding

Before each stage:

```text
current main HEAD == implementationBase
accepted Operator and Bootstrap revisions match binding
evidenceCommit is a descendant of implementationBase
evidenceCommit equals the current head SHA of the bound evidencePrNumber
the PR repository/headRepository/headRef equal the bound values
PR state is OPEN, draft=true and merged=false
evidenceCommit descends from both implementationBase and initialEvidenceCommit
compare status is ahead or identical; force-push/history rewrite is rejected
diff implementationBase..evidenceCommit is only
  docs/evidence/workflow-admin-agent-bootstrap-v1/**
ledger file at evidenceCommit has canonical digest == ledgerDigest
ledger attempt/phase/binding fields match the exact attempt
binding audit comment exists on operatorImplementationPrNumber, author login is mayf3,
  and exact body fields bind auditReviewerId/sessionId, bindingDigest, runtimeConfigDigest,
  authContractVersion/digest, auditReceiptCommit/digest and RESULT=PASS
audit receipt bytes at auditReceiptCommit match digest, PASS and all independence predicates
```

Repository verification uses only Node v25.6.1 built-in `fetch` in `evidence-verifier.js`, with fixed origin
`https://api.github.com`, fixed repository `mayf3/dsh-agent-core`, system CA trust, `redirect:'error'`,
`cache:'no-store'`, 10-second deadline, `Accept: application/vnd.github+json`, and exact REST resources:
`/git/ref/heads/main`, `/pulls/{number}`, `/compare/{base}...{head}`,
`/contents/{fixed-ledger-or-audit-receipt-path}?ref={sha}`, and `/issues/comments/{auditCommentId}`. It sends no credential
(the repository/PR data are public), accepts only HTTPS 2xx JSON with expected GitHub API media type, uses
no local/dev repository and no persisted cache, and treats DNS/TLS/timeout/rate-limit/schema/staleness/
pagination ambiguity as STOPPED. Compare/file lists must be complete; truncation or more than 100 evidence
files is rejected。

`evidenceCommit` need not equal main. Operator checks main immediately before and immediately after each
side effect. If main moves in the check→write interval, the already-started indivisible side effect may
have committed; Operator MUST persist its exact RESULT, set `TERMINAL_STOPPED`, perform no next stage, and
require reconciliation/new binding. It MUST NOT falsely claim the write was prevented or classify drift as
unrelated. Ledger-only phase commits may be multiple。

### CTR-OP-006 — Fresh provisioner gate before all Bootstrap writes

Every execution/resume before its first Bootstrap side effect MUST freshly verify Principal active,
Client active, audience `svc-auth`, grant `auth.identity.provision`, credential usable and auth-service
current compatibility PASS. Compatibility means a fresh HTTP-over-UDS `GET /api/health` through the exact
uid505-private `authServiceSocketPath` (no TCP fallback) returns `ok=true`, `service="auth-service"`, `authContractMode="v1"`, exact bound
`authContractVersion` and `authContractDigest`, and a timestamp within 30 seconds of the Operator monotonic/
wall-clock sample; then the exact provisioner successfully mints the required svc-auth token. Unknown/extra
health fields are ignored, but missing/wrong typed required fields fail. Failure returns closed STOPPED error
and makes zero Definition/S1/S2/store write. The Spec MUST NOT claim current live provisioner readiness in
advance。

### CTR-OP-007 — Repository-acknowledged stage protocol and canonical writers

For every side-effect stage Operator MUST follow exactly:

```text
1 requester commits PREPARED/ack ledger commit
2 operator verifies commit and digest
3 operator CAS-persists private INTENT
4 operator performs exactly one side-effect stage
5 operator atomically CAS-persists RESULT
6 operator returns a non-secret stage result
7 requester updates and commits the same repo ledger
8 operator verifies the new commit/digest before any next stage
```

Side-effect stages use only canonical writers/adapters: disabled Agent Definition via
`packages/agent-definition/src/config.js`; S1/S2/resolution and verification via dedicated adapter built
on `packages/agent-credential-provisioning`; Part G atomic store writer. No stage creates Grant, Binding,
Root, Workspace/Home, enabled Agent, second Client or changed external_ref。

### CTR-OP-008 — Secret, trace, exception, diagnostic and memory boundary

Dedicated auth client MUST disable request/response body debug, redact Authorization headers, prohibit
serialization of auth responses, record only closed metric/span categories, map unhandled errors without
body/path, and never persist retry objects containing secret. Operator state/UDS/repo/test fixtures contain
no real secret. Inspector, heap snapshots and diagnostic reports in this runtime MUST be disabled or
access-controlled; core dumps MUST be disabled or isolated by audited deployment configuration.

```text
MEMORY_ZEROIZATION = BEST_EFFORT
```

Prefer overwriteable Buffer and overwrite it after Part G write. If a library returns immutable string,
keep shortest lifetime, do not copy, write store, release references immediately, and make no physical
zeroization claim。

### CTR-OP-009 — Disjoint closed success and error responses

Success response fields are exactly:

```text
attemptId phase status principalId clientId
credentialLayerVerification businessGrantReadiness evidenceRefs
```

Error response fields are exactly:

```text
attemptId phase status errorCode retryClass evidenceRefs
```

Success and error fields MUST NOT mix. Closed values are:

```text
SUCCESS.status = STAGE_COMMITTED | TERMINAL_SUCCESS
ERROR.status = REJECTED | BUSY | CONFLICT | STOPPED | INCOMPLETE
errorCode = NO_BINDING | WINDOW_NOT_OPEN | WINDOW_EXPIRED | REQUEST_INVALID |
  ATTEMPT_MISMATCH | PHASE_MISMATCH | STATE_VERSION_CONFLICT | BUSY |
  MAIN_DRIFT | REVISION_MISMATCH | EVIDENCE_INVALID | LEDGER_MISMATCH |
  PROVISIONER_NOT_READY | CLIENT_SECRET_UNAVAILABLE | AUTH_OUTCOME_UNKNOWN |
  STORE_WRITE_FAILED | VERIFICATION_FAILED | TERMINAL_REJECTED | INTERNAL_FAILURE
retryClass = NEVER | SAME_REQUEST | AFTER_REBIND | EXACT_CLIENT_ROTATION_REQUIRED
credentialLayerVerification = PASS | FAIL | INCONCLUSIVE
businessGrantReadiness = READY | NOT_READY
principalId = lowercase UUID | null
clientId = "mc_" + exactly 24 ASCII alphanumeric characters | null
evidenceRefs = array length 0..8 of ASCII strings length 1..240, each matching exactly
  git:<lowercase-40-hex>:docs/evidence/workflow-admin-agent-bootstrap-v1/<safe-relative-name>
  or state:<non-negative-safe-integer>
```

`<safe-relative-name>` is one or more segments matching `[A-Za-z0-9._-]+`, with no `..`, empty segment
or leading slash. Empty evidenceRefs is allowed only for a valid request rejected before any durable binding/
state/evidence reference exists (for example NO_BINDING); after PRECHECKED at least one reference is required.
Before `PRINCIPAL_RESOLVED`, both IDs are null; after Principal but before Client,
principalId is non-null and clientId null; after Client both are non-null. Credential/grant fields are
`INCONCLUSIVE`/`NOT_READY` until verification. Responses are strict UTF-8 RFC 8785 JCS in the same
length-prefixed framing and 4096-byte maximum as requests. No whole-store digest, store content, secret, token, stack, errno path, provisioner detail or sensitive
status is returned. Unknown failures map to `INTERNAL_FAILURE` + `NEVER`. `evidenceRefs` contains only
repo commit/path labels and non-secret state-version references。

### CTR-OP-010 — Single instance, mutex, CAS and one-shot replay

Production runtime MUST mount one Operator instance only. Before socket inspection/cleanup/bind, it MUST
acquire the exclusive cross-process directory lock at `LOCK_PATH` using atomic `mkdir(0700)`, then write
exact owner record at `<LOCK_PATH>/owner.json`. Owner bytes are `UTF8(JCS(object))+LF`, file uid505:gid601
mode0600, object keys exactly:

```text
version=1
pid=<positive 32-bit integer>
processStartEpochMs=<positive safe integer>
bindingGeneration=<lowercase UUID>
randomNonce=<64 lowercase hex characters from 32 bytes crypto.randomBytes>
```

The winner creates `owner.json.tmp.<randomNonce>` with `O_CREAT|O_EXCL|O_WRONLY|O_NOFOLLOW` 0600, writes
all bytes, fsyncs file, renames to owner.json, fsyncs LOCK_PATH, then lstat/reopens O_RDONLY|O_NOFOLLOW and
verifies dev/inode/bytes. Missing/malformed/unknown-key/wrong-owner/mode/inode record is BUSY and may be
quarantined only by the separately audited rollback/recovery script, never guessed by runtime. A second
process fails startup BUSY before touching the socket/state. For crash recovery, a contender with a valid
owner record may quarantine a stale lock only after exact owner/mode/no-symlink checks and `kill(pid,0)`
returns ESRCH; it atomically
renames the lock directory to a nonce quarantine, then races to mkdir the canonical lock (only one winner).
PID reuse or ambiguous permission returns BUSY, never stale removal. Quarantine removal occurs only after
the winner holds the canonical lock. Graceful shutdown removes only its matching nonce lock after socket
cleanup。

While holding this cross-process lock, one in-process global mutex plus durable `stateVersion` CAS is
mandatory. CAS means: read exact state dev/inode/version under lock; compute next version; write/fsync a
versioned temp; re-check canonical dev/inode/version under lock; rename only if unchanged; fsync directory;
re-read/verify. Corrupt/torn/missing-after-start state is STOPPED, not reset:

```text
same attempt + same phase + same digest = resume or terminal replay
same attempt + same phase + different digest = CONFLICT / zero side effect
same attempt + exact next phase + newly acknowledged ledger digest = eligible to advance once
phase skip/regression or next phase without acknowledgement = CONFLICT / zero side effect
concurrent second request = BUSY / zero side effect
new attempt after terminal success = REJECTED / zero side effect
second subject = REJECTED / zero side effect
```

A lost response is replayable from persisted non-secret RESULT. Private state MUST NOT rely only on
memory; a stale stateVersion can never write or advance。

### CTR-OP-011 — Durable state machine and complete crash recovery

Private state is RFC 8785 JCS and has exactly:

```text
version (=1), bindingGeneration, bindingDigest, attemptId, phase, stateVersion,
requestDigest, evidenceCommit, ledgerDigest, intent, result, terminalResponse
```

`intent` is null or exactly `{kind,requestDigest,evidenceCommit,ledgerDigest,startedAt}`; `result` is null
or exactly `{kind,status,principalId,clientId,credentialLayerVerification,businessGrantReadiness,
evidenceRefs,completedAt,errorCode}`. `kind` is `DEFINITION|PRINCIPAL|CLIENT|SECRET_STORE|VERIFICATION`;
digests/commits/IDs/enums/evidenceRefs use CTR-OP-009/016 formats; timestamps are canonical RFC3339 UTC
with millisecond precision; nullable IDs follow CTR-OP-009; `errorCode` is null on success and a closed
CTR-OP-009 value otherwise. `terminalResponse` is null or one exact CTR-OP-009 response object. Unknown
keys reject. State path/mode/durability/no-follow/CAS are fixed by CTR-OP-003/010. Private state phases are
exactly:

```text
PRECHECKED
DEFINITION_INTENT
DEFINITION_COMMITTED
PRINCIPAL_INTENT
PRINCIPAL_RESOLVED
CLIENT_INTENT
CLIENT_RESOLVED
SECRET_STORE_INTENT
SECRET_STORED
VERIFICATION_INTENT
VERIFIED
TERMINAL_SUCCESS
TERMINAL_STOPPED
```

Every transition is intent → side effect → result → response → repo acknowledgement. Normative recovery
matrix:

| Crash/unknown point | Required recovery |
|---|---|
| Definition writer returned/committed before RESULT | read exact Agent entry; exact disabled tuple ⇒ persist `DEFINITION_COMMITTED`; absent ⇒ retry same stage; conflict ⇒ `TERMINAL_STOPPED` |
| S1 outcome_unknown/response lost | resolve exact principalExternalRef; absent ⇒ retry same S1 request digest; exact active match ⇒ `PRINCIPAL_RESOLVED`; conflict/inactive ⇒ STOPPED |
| S2 outcome_unknown/response lost | resolve exact clientExternalRef; absent ⇒ retry same S2 request digest; present and same-attempt secret Buffer still available ⇒ continue; present with secret unavailable ⇒ INCOMPLETE/STOPPED |
| secret acquired, crash before store rename | secret is lost; resolve client present ⇒ INCOMPLETE/STOPPED, never second Client |
| store rename succeeded before RESULT | recovery adapter may call canonical `loadCredentialFor(credentialStorePath, exactAgentId)` for this entry only; require exact clientId, hold returned secret only in CTR-OP-008 bounded memory, run parent D.5, release/overwrite where possible, then persist `SECRET_STORED`; absent/mismatch/corruption ⇒ STOPPED |
| verification response lost | rerun only parent D.5 verification for exact stored client; classify result; no S1/S2/store rewrite |
| UDS response disconnect after RESULT | identical request replays persisted non-secret RESULT; no side effect |
| process crash/restart | acquire cross-process lock, validate binding/activation/state, execute this matrix, then require repo acknowledgement |
| repeated uid502 request | CTR-OP-010 digest/phase/CAS semantics; no caller identity inference |

`Client present + secret unavailable` ⇒ STOP/INCOMPLETE, no second Client/new external_ref, later accepted
exact-Client rotation recovery only. Exact store entry present but state stale ⇒ the internal recovery
adapter may read only that exact entry including its credential for D.5, under CTR-OP-008 lifetime/
redaction rules; no store-read API is exposed and no other entry is enumerated; reconcile same attempt. No recovery path fabricates secret or
advances without repo acknowledgement。

### CTR-OP-012 — Window, terminal and disabled lifecycle

Endpoint before task D is absent or rejects all requests. `notBefore <= now < expiresAt` is required for
non-terminal advancement. Expiry during work stops before the next stage and persists
`TERMINAL_STOPPED`; it never authorizes cleanup writes. After `TERMINAL_SUCCESS`, new attempts are
permanently rejected, while identical terminal replay remains available. No activation or later V3 Slice
is triggered。

### CTR-OP-013 — Capability closure

Implementation MUST expose no operation router, generic RPC, shell, command, argv, arbitrary path,
generic file read/write, credential-store read API, arbitrary Agent/client manipulation, feature flag or
configuration that widens the six-field request or exact binding. Expansion requires a new accepted
authority。

### CTR-OP-014 — Deployment gate and trusted closure

Deployment MUST verify exact accepted revisions, current main, frozen file closure, trusted source stamp,
uid505 runtime, dedicated path ownership/mode/ACL, disabled startup gate, absence of TCP listeners,
Operator singleton, diagnostics/core-dump controls and rollback material. It installs no exact-attempt
binding and opens no window. An independent audit must PASS before task D. Durable non-secret deployment
and state audit must remain available; secret is excluded。

### CTR-OP-015 — UDS path, ACL, inode and lifecycle safety

Path is exactly:

```text
TRUSTED_ROOT = /usr/local/libexec/agent-core
TRUSTED_ROOT_EXPECTED = uid0:gid0 mode0755, no inherited ACL, uid502 not writable
RUN_PARENT = <TRUSTED_ROOT>/run
RUN_PARENT_EXPECTED = uid505:gid601 mode0700, ACL inheritance disabled,
  one explicit uid502 search/traverse ACE only
DIRECTORY = <RUN_PARENT>/workflow-admin-bootstrap-operator-v1
DIRECTORY_EXPECTED = uid505:gid601 mode0700, ACL inheritance disabled,
  one explicit uid502 search/traverse ACE only
SOCKET = <DIRECTORY>/operator.sock
SOCKET_EXPECTED = uid505:gid601 mode0600, no inherited ACL,
  one explicit uid502 minimum connect/write ACE only
FORBIDDEN_UID502_ACL_RIGHTS = add_file, add_subdirectory, delete, delete_child,
  writeattr, writeextattr, writeowner, writesecurity
```

Deployment audits every path component from `/usr` through SOCKET with `lstat`; `/usr`, `/usr/local` and
`/usr/local/libexec` must be root-owned, non-symlink directories and not group/other writable. No inherited
or group-wide grant is allowed. Deployment must prove uid502 can connect but cannot create/unlink/rename;
all other ordinary UIDs cannot traverse/connect. If Darwin ACL/socket behavior cannot enforce this exact
matrix, deployment fails closed and no window opens. Root is host-complete-controller and is not claimed
as a defeated threat。

Runtime acquires CTR-OP-010 cross-process lock before any socket action and uses safe umask `0077`;
`lstat` before bind; symlink/non-socket/regular file/active socket fail closed; stale socket removal only
after exact owner/mode/dev/inode, failed-connect and stale-lock checks. On pinned trusted Node v25.6.1,
post-bind obtains the listening descriptor through the runtime-validated `net.Server._handle.fd`, calls
`fstatSync(fd)`, and requires equality with path `lstat` dev/inode/type. This pinned internal accessor is
permitted only for this check, is tested in task A, and absence/shape drift fails startup before opening the
window; no native addon/FFI/helper fallback is allowed. Shutdown unlinks only when path lstat still matches
the pinned fstat dev/inode and lock nonce; restart/crash cleanup follows the same rules. No TCP listener。

### CTR-OP-016 — Framing, parsing and canonicalization

Transport uses strict UTF-8, unsigned 32-bit network-byte-order length prefix, body length 1..4096 bytes,
one frame per connection and no trailing bytes. Server backlog and `maxConnections` are both 16; at most 8
connections may be in parser work concurrently; overflow connections are immediately destroyed without
response. First byte must arrive within 250 monotonic milliseconds and the complete frame within 2000
monotonic milliseconds from accept; timeout destroys the connection and bounded buffer. Each connection
allocates at most 4100 frame bytes plus fixed parser state. Parsing never acquires the global operation mutex;
only a fully validated request may attempt it. Malformed frame/UTF-8/JSON/schema causes zero write and no
response. Parser MUST reject duplicate JSON keys before object materialization and reject unknown fields. Types, lengths and
charsets are exact: attemptId lowercase UUID; Git SHA lowercase 40-hex; digest lowercase 64-hex;
operatorStateVersion non-negative safe integer; operation literal. Request `phase` is exactly one of:

```text
PRECHECKED | DEFINITION | PRINCIPAL | CLIENT | SECRET_STORE | VERIFICATION | TERMINAL
```

No case folding, aliases or extension values are accepted。

Canonical serialization is RFC 8785 JCS over exactly the six request fields in `CTR-OP-001`; request
digest is lowercase hex `SHA-256(UTF8(JCS(request)))`. Ledger digest is lowercase hex
`SHA-256(exact file bytes at evidenceCommit)`. No locale, whitespace or key-order discretion。

### CTR-OP-017 — Exact implementation file closure

Task A may change only this closure (plus package-manager lock only if deterministically required by adding
the workspace package):

| Purpose | Exact file(s) |
|---|---|
| dedicated package manifest | `packages/workflow-admin-bootstrap-operator/package.json` |
| public composition handle | `packages/workflow-admin-bootstrap-operator/src/index.js` |
| startup/config/binding/window gate | `packages/workflow-admin-bootstrap-operator/src/config.js` |
| UDS path and inode lifecycle | `packages/workflow-admin-bootstrap-operator/src/socket-lifecycle.js` |
| length frame, strict UTF-8/duplicate-key parser/JCS | `packages/workflow-admin-bootstrap-operator/src/protocol.js` |
| durable phases, mutex and stateVersion CAS | `packages/workflow-admin-bootstrap-operator/src/state-machine.js` |
| dedicated redacted auth adapter | `packages/workflow-admin-bootstrap-operator/src/auth-client.js` |
| canonical Definition/store adapters | `packages/workflow-admin-bootstrap-operator/src/writers.js` |
| repo revision/ledger verifier | `packages/workflow-admin-bootstrap-operator/src/evidence-verifier.js` |
| focused unit/integration/fault tests | `packages/workflow-admin-bootstrap-operator/test/{protocol,socket-lifecycle,state-machine,operator}.test.js` |
| production composition mount | `packages/production-runtime/src/compose.js` |
| composition/launchd/start-disabled tests | `packages/production-runtime/test/workflow-admin-bootstrap-operator.test.js` |
| strict launchd env pass-through | `scripts/production-runtime-launchd.mjs` |
| disabled deployment + ACL/state-directory installer | `scripts/workflow-admin-bootstrap-operator-deploy.mjs` |
| independent read-only deployment/binding audit | `scripts/workflow-admin-bootstrap-operator-audit.mjs` |
| D1 inactive binding + D3 activation/revocation | `scripts/workflow-admin-bootstrap-operator-window.mjs` |
| ordered rollback | `scripts/workflow-admin-bootstrap-operator-rollback.mjs` |
| deployment/window/rollback tests | `packages/workflow-admin-bootstrap-operator/test/deployment.test.js` |
| package/workspace truth | no root `package.json` or lockfile change: repository test glob already discovers the package and implementation must use only Node built-ins/current dependencies |
| structure registry | no `.agents/structure-registry.json` change: new files MUST remain under guardrails; adding an exception is a closure violation |
| trusted installer | no `scripts/trusted-cp-deploy-install.sh` change: it already installs the full trusted app closure; task B verifies the new package and four scripts' exact bytes are present |

The only new launchd variable is
`WORKFLOW_ADMIN_BOOTSTRAP_OPERATOR_ENABLED`, strict literal `0|1`, unset = `0`. Task B and D1/D2 keep `0`; only D3 may change it to `1` in the activation transaction for the already
installed and independently audited exact D1 binding, then perform a controlled restart through the existing
launchd unit. The binding path, state path, socket path,
subject and operation are not env-configurable. A `1` value without a valid current binding still rejects
all requests and performs zero Bootstrap side effects。

Implementation Agent MUST NOT choose another location or introduce a native addon/helper. Any required file
outside this table stops task A and requires an in-place Spec amendment/review before implementation。

### CTR-OP-018 — Current-main drift is an unconditional stop

Task D binds the then-current exact main as `implementationBase`. Any change to current main before or
during the window, regardless of apparent relevance, yields `STOPPED`, closes advancement and requires a
new separately audited binding. Operator/runtime MUST NOT make an “unrelated drift” judgment。

### CTR-OP-019 — Repository ledger authority and exact Operator acknowledgement schema

The same ledger at
`docs/evidence/workflow-admin-agent-bootstrap-v1/attempt-ledger.json` remains authoritative. It retains all
parent CTR-WA-010 fields and adds exactly one top-level `operator` object; no parent field is removed or
reinterpreted. The file bytes are exactly `UTF8(RFC8785-JCS(root-object)) + 0x0A`. `operator` is exactly:

```text
{
  schemaVersion: 1,
  bindingGeneration: <lowercase UUID>,
  bindingDigest: <lowercase 64-hex>,
  exactOperation: "workflow_admin_agent_bootstrap_v1",
  nextSequence: <integer 0..6>,
  currentGate: null | {
    sequence: <integer 0..6>,
    phase: PRECHECKED|DEFINITION|PRINCIPAL|CLIENT|SECRET_STORE|VERIFICATION|TERMINAL,
    status: PREPARED,
    expectedOperatorStateVersion: <non-negative safe integer>,
    previousResultDigest: <lowercase 64-hex|null>,
    preparedAt: <canonical RFC3339 UTC milliseconds>
  },
  history: [<zero or more exact acknowledgement records>]
}
```

Each history record is exactly:

```text
{
  sequence: <integer 0..6>,
  phase: <same closed enum>,
  status: RESULT_ACKNOWLEDGED|TERMINAL_ACKNOWLEDGED,
  requestDigest: <lowercase 64-hex>,
  resultDigest: <lowercase 64-hex>,
  operatorStateVersion: <positive safe integer>,
  resultStatus: STAGE_COMMITTED|TERMINAL_SUCCESS|STOPPED|INCOMPLETE,
  acknowledgedAt: <canonical RFC3339 UTC milliseconds>
}
```

History is append-only, sequences start at 0 and increase by exactly one, phases follow the closed order,
stateVersion strictly increases, and `resultDigest = SHA-256(UTF8(JCS(exact CTR-OP-009 response)))`.
A PREPARED gate authorizes only its exact sequence/phase/expected state version; after Operator RESULT,
requester appends the matching acknowledgement and either sets the exact next PREPARED gate or null for a
terminal. Unknown keys, duplicate history sequence, phase skip/regression, digest mismatch, changed prior
history or binding mismatch reject. Initial PREPARED has empty history, nextSequence=0,
phase=PRECHECKED, expectedOperatorStateVersion=0, previousResultDigest=null.

Every PREPARED/acknowledgement is a commit in the same Draft evidence PR; each phase commit diff is confined
to `docs/evidence/workflow-admin-agent-bootstrap-v1/**`. Private state may record only commit/digest/version
replicas. Mismatch, missing acknowledgement or rewritten evidence history stops with zero next-stage side
effect。

### CTR-OP-020 — Install and rollback closure

Task B deployment order is: verify accepted implementation artifact/source stamp → stop runtime → install
trusted app closure including dedicated package → create audited dedicated directory/ACL → install
startup config with Operator disabled and no binding → render/update existing production launchd plist/env
only through `scripts/production-runtime-launchd.mjs` → start runtime → prove socket absent or all requests
rejected → persist non-secret deployment evidence. `scripts/trusted-cp-deploy-install.sh` is the only trusted
app install seam and MUST remain unchanged; if its current behavior cannot install the frozen closure, task A
stops and this Spec must be amended/reviewed before any installer change。

Task D has three mandatory substeps. **D1** re-verifies task-C audit and unchanged main, stops runtime,
atomically installs binding with activation `active:false`, keeps launchd env `0`, restarts disabled and
publishes the exact binding digest. Task A and D1 each first persist an owner-authored ordinary comment on
the bound implementation PR with exact fields
`RECEIPT_KIND=WORKFLOW_ADMIN_BOOTSTRAP_TASK_RECEIPT`, `TASK=A_IMPLEMENTATION|D1_BINDING_PREPARATION`,
`ACTOR_ID=<ASCII identity>`, `SESSION_ID=<ASCII session identity>`, `RESULT=PASS`; no duplicate/extra fields.
Their GitHub comment IDs are the task receipt IDs. **D2** is a fresh independent read-only runtime audit that
runs the exact audit script and fetches both receipts from fixed GitHub API。

Independence is governed honestly as `ENFORCEMENT_LEVEL=MANUAL_POLICY`, matching repository governance:
DSH/GitHub currently exposes no cryptographically issuer-signed per-session identity receipt. Actor/session
strings are provenance coordinates, not security Principals. The authenticated `mayf3` GitHub comment is
the explicit Owner attestation and authority-opening approval that the named D2 reviewer is independent and
that the exact binding audit passed. Runtime verifies that Owner attestation and exact bytes; it MUST NOT
claim cryptographic proof of reviewer independence. A dishonest/compromised repository Owner can already
accept/change authority and is outside this Operator threat model. Governance review rejects missing,
malformed, non-mayf3-authored, duplicate-task or equal identity/session records before Owner attestation. Its only write is a docs-only receipt at
`docs/evidence/workflow-admin-agent-bootstrap-v1/operator-binding-audit.json` in the bound evidence PR.
Receipt bytes are `UTF8(JCS(object))+LF`; object keys are exactly:

```text
schemaVersion=1, receiptId=<lowercase UUID>, bindingDigest=<lowercase 64-hex>,
bindingGeneration=<lowercase UUID>, runtimeConfigDigest=<lowercase 64-hex>,
authContractVersion=<bound ASCII version>, authContractDigest=<bound lowercase 64-hex>,
implementationBase=<lowercase 40-hex>, evidencePrNumber=<positive integer>,
implementationTaskReceiptCommentId=<positive integer>,
implementationActorId=<ASCII identity>, implementationSessionId=<ASCII identity>,
bindingPreparationReceiptCommentId=<positive integer>,
bindingPreparerId=<ASCII identity>, bindingPreparerSessionId=<ASCII identity>,
reviewerId=<ASCII [A-Za-z0-9._:@/-]{1,128}>, reviewerSessionId=<same grammar>,
reviewerDidNotAuthorImplementation=true, reviewerDidNotPrepareBinding=true,
reviewerWillNotActivateWindow=true, result=PASS, reviewedAt=<canonical RFC3339 UTC milliseconds>
```

D2 reviewer/session must differ from task-A implementer identity/session and D1 preparer identity/session as
recorded in their persisted task receipts; equality or a missing receipt fails independence. D2 then persists
this exact block as an ordinary GitHub comment on the bound implementation PR:

```text
WORKFLOW_ADMIN_BOOTSTRAP_BINDING_AUDIT
BINDING_DIGEST = <lowercase-64-hex>
BINDING_GENERATION = <lowercase-uuid>
RUNTIME_CONFIG_DIGEST = <lowercase-64-hex>
AUTH_CONTRACT_VERSION = <bound ASCII version>
AUTH_CONTRACT_DIGEST = <bound lowercase-64-hex>
IMPLEMENTATION_BASE = <lowercase-40-hex>
EVIDENCE_PR = <positive integer>
REVIEWER_ID = <exact receipt reviewerId>
REVIEWER_SESSION_ID = <exact receipt reviewerSessionId>
AUDIT_RECEIPT_COMMIT = <lowercase-40-hex>
AUDIT_RECEIPT_DIGEST = <SHA-256 exact receipt bytes>
RESULT = PASS
RUNTIME_WRITE_PERFORMED = NO
```

The comment author login must be `mayf3`; any additional/changed field, stale receipt, identity mismatch,
failed independence predicate or non-PASS result is invalid. **D3** verifies comment and receipt bytes through
CTR-OP-005, stops runtime, atomically writes activation bound to
the exact digest/comment/reviewer, renders the existing plist with
`WORKFLOW_ADMIN_BOOTSTRAP_OPERATOR_ENABLED=1`, restarts runtime, verifies binding/window/read-only gates
and socket ACL/inode, then declares the window open. No D substep performs a Bootstrap stage. Failure rolls
back env to `0`, writes activation `active:false`, removes only an inactive not-yet-used binding by exact
owner/mode/dev/inode match, and restarts disabled。

Rollback order is: close/omit window binding → stop runtime → restore prior trusted app closure and prior
plist/env → remove socket only with inode-match rule → preserve private non-secret audit state and repo
ledger → restart prior runtime → verify no listener. Rollback never deletes parent evidence or performs
Bootstrap。

## 10. Acceptance

Every Acceptance below requires an executed result bound to implementation commit and environment; test
names alone are not evidence. Every item includes a negative case and an explicit failure condition。

### ACC-OP-001 — Closed trigger schema
- Contracts: `CTR-OP-001`, `CTR-OP-003`
- Method/environment: parser/operator unit and integration matrix。
- Expected result: only six exact fields accepted; subject/authority come only from binding。
- Required evidence: matrix plus zero-writer/auth-call counters。
- Failure condition: request can choose Agent/external_ref/path/authority, or malformed input writes/receives a fabricated attempt response。
- Negative case: add `agentId`/`path`/secret, omit or malform attemptId/phase, duplicate a key, or send invalid UTF-8 ⇒ close with no response and zero write。

### ACC-OP-002 — Trigger is not authority
- Contracts: `CTR-OP-002`
- Method/environment: multi-process same-uid502 test and code audit with no peercred/native dependency。
- Expected result: wrong uid502 process can at most advance the same prebound attempt; early/late/no-binding rejects。
- Required evidence: two uid502 processes, prebound-state comparison, 16/8 connection-limit and slowloris timing results, native dependency inventory。
- Failure condition: peer UID/process/request grants authority, partial frames exhaust service beyond bounds, parser holds operation mutex, or native helper is required。
- Negative case: second uid502 tries different operation/Agent while 16 slow partial connections fill backlog ⇒ no authority change, bounded closes/timeouts, approved full frame remains processable after capacity frees。

### ACC-OP-003 — Exact subject from binding
- Contracts: `CTR-OP-003`, `CTR-OP-013`
- Method/environment: binding corruption and interface-surface tests。
- Expected result: only exact literals exist; no widening surface。
- Required evidence: binding/activation validator matrices and JCS vectors, every-private-ancestor pre/post dev/inode/ACL walk, owner/mode/no-follow/fsync fault tests and exported-interface inventory。
- Failure condition: caller selects subject/path, private ancestor symlink/replacement is missed, feature flag widens operation, or malformed activation timestamp/reviewer/receipt, leaf replacement, torn write, permission drift or unaudited generation is accepted。
- Negative case: symlink `config/operator`, replace ancestor between pre/post walk, use active=false with invalid timestamps, or binding digest without matching receipt/comment/activation ⇒ startup/window fails closed。

### ACC-OP-004 — Five-task governance boundary
- Contracts: `CTR-OP-004`
- Method/environment: PR/task record review。
- Expected result: A–E records separate; B has no binding/window/Bootstrap; this PR docs-only。
- Required evidence: diffs and task receipts。
- Failure condition: implementation/deployment performs Bootstrap or this PR changes code/runtime。
- Negative case: deployment test creates Agent identity ⇒ acceptance fails。

### ACC-OP-005 — Main/evidence binding
- Contracts: `CTR-OP-005`, `CTR-OP-018`
- Method/environment: Git fixture matrix and live read-only preflight。
- Expected result: descendant evidence, path-only diff, digest match; any main drift STOPPED。
- Required evidence: PR identity/head-ref, audit-comment, ancestry/diff/digest outputs, pre/post-main checks and writer counters。
- Failure condition: `main==evidenceCommit` required, PR/repository/ref spoof or force-push accepted, unrelated drift continues, truncated API data is trusted, or wrong path accepted。
- Negative case: (a) same commit exposed from a different PR/head repo, (b) force-push removing initialEvidenceCommit, or (c) advance main inside check→write interval ⇒ exact current stage is reconciled and `TERMINAL_STOPPED` before any next stage。

### ACC-OP-006 — Provisioner revalidation
- Contracts: `CTR-OP-006`
- Method/environment: fault matrix for missing/external-unaudited UDS, TCP listener takeover/forged health, socket ancestor/inode drift, inactive Principal/Client, wrong audience, missing grant, bad credential, incompatible auth revision。
- Expected result: no provisioner secret/token is sent until private UDS checks pass; every failure STOPPED with zero Definition/S1/S2/store call and no TCP fallback。
- Required evidence: malicious uid502 listener capture showing zero received credential bytes, UDS path/inode trace, call counters and closed responses。
- Failure condition: any credential goes to loopback TCP/unauthenticated server, failed revalidation still writes, or Spec assumes live readiness。
- Negative case: legitimate auth UDS absent while uid502 serves forged expected health on 127.0.0.1:4001 ⇒ Operator never connects/sends and performs zero write。

### ACC-OP-007 — Repository-acknowledged canonical stages
- Contracts: `CTR-OP-007`, `CTR-OP-019`
- Method/environment: integration test with fake Git evidence service and canonical writer spies。
- Expected result: exactly one stage per acknowledged ledger commit; canonical writers only。
- Required evidence: parent+operator exact ledger JCS vectors, ordered trace, append-only history/commit/digest chain, writer identity/counters。
- Failure condition: unknown Operator ledger key/status, changed prior history, phase skip/regression, stateVersion/request/result digest mismatch, next stage before acknowledgement, or private state replaces ledger。
- Negative case: omit ack, alter an old history record, duplicate sequence, set PREPARED for skipped phase or wrong expected stateVersion ⇒ next stage zero calls。

### ACC-OP-008 — Secret/error/diagnostic boundary
- Contracts: `CTR-OP-008`
- Method/environment: code review, fault injection, output/log/trace/state/core/diagnostic scans。
- Expected result: no real secret outside uid505 memory/store; Buffer overwrite where possible; best-effort claim only。
- Required evidence: scan output, runtime diagnostic configuration, exact-entry post-rename recovery trace and review record。
- Failure condition: secret/body/header enters trace/error/report, recovery enumerates/exposes another entry, exact-entry secret outlives D.5, or guaranteed JS zeroization is claimed。
- Negative case: auth client throws a secret-bearing body or post-rename recovery loads exact credential then D.5 fails ⇒ fixed closed error, no body/stack/secret leak and memory reference released。

### ACC-OP-009 — Disjoint response/error schemas
- Contracts: `CTR-OP-009`
- Method/environment: exact-key schema tests for every status/error enum。
- Expected result: closed disjoint sets; no whole-store digest; unknown error maps INTERNAL_FAILURE。
- Required evidence: sanitized samples, every enum/cross-field/nullability/JCS vector, pre-validation no-response capture and exact-key assertions。
- Failure condition: malformed request receives fabricated attempt/phase, success/error fields mix, empty evidenceRefs appears after PRECHECKED, or store digest/content crosses UID。
- Negative case: invalid attemptId/phase ⇒ no response; valid NO_BINDING ⇒ closed error with truthful empty evidenceRefs; adapter errno/stack/store digest ⇒ omitted/mapped。

### ACC-OP-010 — Mutex/CAS/concurrency/terminal replay
- Contracts: `CTR-OP-010`
- Method/environment: simultaneous connections, stale CAS, restart and replay tests。
- Expected result: one side effect; second BUSY; stale state CONFLICT; terminal replay byte-equivalent non-secret result。
- Required evidence: owner.json JCS/nonce/mode/fsync vectors, barrier-controlled two-process trace, lock quarantine/PID-reuse matrix, state no-follow/inode/fsync/CAS faults and writer counts。
- Failure condition: malformed/missing owner record is runtime-quarantined, nonce is weak/nonmatching, double execution, in-memory-only state, two processes clean/bind concurrently, stale/torn state resets, or second attempt succeeds。
- Negative case: missing owner.json, wrong mode, unknown key, PID reuse, bad nonce, or simultaneous stale cleanup + same-phase requests ⇒ BUSY/manual audited recovery or one valid owner and exactly one stage write。

### ACC-OP-011 — Crash recovery matrix
- Contracts: `CTR-OP-011`
- Method/environment: kill/fault injection at every intent/side-effect/result boundary。
- Expected result: each listed crash reconciles same attempt or STOPPED safely; no second Client/external_ref。
- Required evidence: full matrix, post-state, repo acknowledgement and auth call counts。
- Failure condition: any crash path is undefined, duplicates identity, fabricates/leaks secret, reads more than the exact store entry, or skips ack。
- Negative case: Client exists but secret lost ⇒ INCOMPLETE and zero S2 retry/new Client; store rename succeeded/state stale ⇒ exact-entry-only read + D.5, no enumeration/leak。

### ACC-OP-012 — Window and terminal lifecycle
- Contracts: `CTR-OP-012`
- Method/environment: fake clock boundary tests and post-success attempts。
- Expected result: early/expired rejects; expiry stops before next stage; new post-success attempt rejected; replay works。
- Required evidence: clock/state trace and zero-write assertions。
- Failure condition: early trigger writes, expired window continues or second attempt succeeds。
- Negative case: trigger at `expiresAt` ⇒ rejected/zero side effect。

### ACC-OP-013 — No generic privileged API
- Contracts: `CTR-OP-013`
- Method/environment: exported-route/config/code audit and fuzzed unknown operations。
- Expected result: no router/exec/path/store-read/widening switch。
- Required evidence: reachable API inventory and fuzz results。
- Failure condition: any arbitrary operation or read/write primitive is reachable。
- Negative case: operation `anything_else` ⇒ closed rejection。

### ACC-OP-014 — Deployment audit boundary
- Contracts: `CTR-OP-014`, `CTR-OP-020`
- Method/environment: clean-host deployment rehearsal and independent audit。
- Expected result: disabled/no-binding deployment, trusted source stamp, audited rollback, no Bootstrap。
- Required evidence: installation/rollback transcript, hashes, private-ancestor walks, plist/env diff, D1 digest, D2 receipt commit/bytes/digest + exact comment/API verification + task identity receipts, D3 activation bytes and listener checks。
- Failure condition: window opens before exact independent binding audit, D2 reviewer/session equals implementer or preparer, independence predicate false, receipt/comment author/body/digest differs, deployment creates identity or rollback deletes evidence。
- Negative case: task-C audit exists but D2 is same-author/self-review, stale/mismatched receipt or wrong digest ⇒ D3 activation and task E forbidden。

### ACC-OP-015 — Socket path race and ACL matrix
- Contracts: `CTR-OP-015`
- Method/environment: deployment host users, symlink/regular/active/stale socket, inode replacement, crash/restart tests。
- Expected result: uid502 connect only; no create/unlink/rename; other ordinary UID denied; all race checks fail closed; no TCP。
- Required evidence: every-ancestor `lstat`/ACL/inheritance snapshot, two-process lock trace, pinned Node fd/fstat proof and attack matrix。
- Failure condition: ancestor symlink/writable/inherited ACL is ignored, internal fd accessor unavailable yet startup continues, symlink/stale/inode race accepted, group-wide access, uid502 directory write, or other UID connects。
- Negative case: inherited ACE on RUN_PARENT, competing runtime during stale cleanup, or socket inode replacement before shutdown ⇒ startup/cleanup fails closed and replacement is not unlinked。

### ACC-OP-016 — Strict framing, duplicate keys and JCS
- Contracts: `CTR-OP-016`
- Method/environment: byte-level parser corpus and RFC 8785 vectors。
- Expected result: strict UTF-8, max 4096, duplicate/unknown rejection, stable digest exact bytes。
- Required evidence: corpus/JCS results, first-byte/full-frame monotonic deadline tests, 16/8 capacity and fixed-buffer measurements, no-operation-mutex parser trace。
- Failure condition: duplicate key last-wins, malformed UTF-8 accepted, canonical digest varies, partial frame exceeds time/memory/concurrency bound, or parser blocks operation mutex。
- Negative case: duplicate attemptId, 4097-byte frame, no first byte for 250ms, or drip frame beyond 2000ms ⇒ no response, bounded close, zero write。

### ACC-OP-017 — File closure rejects wrong implementation
- Contracts: `CTR-OP-017`
- Method/environment: implementation PR exact-path diff and structure verification。
- Expected result: all required modules/tests/mount/deploy/audit/window/rollback scripts present only at table paths; no native artifact/helper, root package, lockfile, structure exception or trusted-installer change。
- Required evidence: name-status diff, structure output, script dry-run tests and dependency inventory。
- Failure condition: implementation or deployment uses manual/unspecified tooling, chooses unspecified placement, omits closure component or adds native helper。
- Negative case: parser embedded ad hoc in `compose.js`, ACL installed by an untracked shell command, or binding written outside the exact window script ⇒ fail。

### ACC-OP-018 — Parent ledger remains authoritative
- Contracts: `CTR-OP-019`
- Method/environment: mutate private state without repo ack and rewrite evidence history tests。
- Expected result: no advancement; mismatch STOPPED; phase commits path-confined。
- Required evidence: repo/private version trace and Git path diffs。
- Failure condition: private state alone authorizes advancement or non-evidence file enters phase commit。
- Negative case: valid private RESULT + stale repo ledger ⇒ next stage zero writes。

### ACC-OP-019 — Install/rollback exact order
- Contracts: `CTR-OP-020`
- Method/environment: deployment rehearsal with ordered event recording。
- Expected result: install and rollback follow exact sequence; prior runtime restored without Bootstrap/evidence deletion。
- Required evidence: ordered transcript, artifact hashes and post-rollback listener/state checks。
- Failure condition: launch before disabled config, remove socket without inode check, or delete ledger/state audit。
- Negative case: failed post-start check ⇒ rollback before any task-D binding exists。

### ACC-OP-020 — Safe staged identity terminal
- Contracts: `CTR-OP-007`, `CTR-OP-011`, `CTR-OP-012`
- Method/environment: end-to-end fault matrix with production-shaped fixtures。
- Expected result: any partial identity remains absent-or-disabled, non-routable/non-runnable, default unchanged, no Grant/Binding/Root/activation。
- Required evidence: exact before/after Definition/store/auth/route snapshots without secret。
- Failure condition: enabled/routable identity, permission Slice, second Client or external_ref change。
- Negative case: failure after Definition write ⇒ disabled entry only, no later Slice action。

### Coverage and mechanical integrity

```text
CONTRACT_COUNT = 20
CONTRACTS_WITH_ACCEPTANCE = 20
ACCEPTANCE_COUNT = 20
DUPLICATE_CONTRACT_IDS = 0
DUPLICATE_ACCEPTANCE_IDS = 0
DANGLING_CONTRACT_REFERENCES = 0
UNCOVERED_CONTRACTS = 0
DECLARATION_ONLY_EDGES = 0
COVERAGE_TABLE_ONLY_EDGES = 0
ACCEPTANCE_WITHOUT_FAILURE_CONDITION = 0
ACCEPTANCE_WITHOUT_NEGATIVE_CASE = 0
```

Direct coverage: CTR-OP-001→ACC-OP-001; 002→002; 003→001/003; 004→004;
005→005; 006→006; 007→007/020; 008→008; 009→009; 010→010; 011→011/020;
012→012/020; 013→003/013; 014→014; 015→015; 016→016; 017→017; 018→005;
019→007/018; 020→014/019。

Blocker coverage:

| Independent-review blocker | Contract | Acceptance |
|---|---|---|
| parent repo ledger replaced by private state | CTR-OP-007/019 | ACC-OP-007/018 |
| peer UID treated as authority / nonexistent Node API | CTR-OP-002 | ACC-OP-002 |
| socket symlink/stale/inode/race | CTR-OP-015 | ACC-OP-015 |
| other uid502 process triggers first | CTR-OP-002/003/012 | ACC-OP-002/012 |
| main/evidence contradiction and later main drift | CTR-OP-005/018 | ACC-OP-005 |
| duplicate JSON keys | CTR-OP-016 | ACC-OP-016 |
| canonicalization undefined | CTR-OP-016 | ACC-OP-016 |
| response/error conflict and whole-store digest | CTR-OP-009 | ACC-OP-009 |
| crash recovery incomplete | CTR-OP-011 | ACC-OP-011 |
| concurrent double execution / second terminal attempt | CTR-OP-010/012 | ACC-OP-010/012 |
| secret in trace/exception/report; JS zeroization overclaim | CTR-OP-008 | ACC-OP-008 |
| implementation/deployment closure missing or bundled Bootstrap | CTR-OP-004/014/017/020 | ACC-OP-004/014/017/019 |
| caller selects Agent/path | CTR-OP-001/003/013 | ACC-OP-001/003/013 |
| provisioner failure still writes | CTR-OP-006 | ACC-OP-006 |

## 11. Alternatives and disposition

- **LOCAL_PEERCRED as authority** — rejected: uid502 is shared and Node peer UID is not a portable
  built-in premise; native closure is unnecessary. Peer UID may be telemetry only。
- **Per-trigger secret/mTLS** — rejected: new secret channel is unnecessary when authority is prebound。
- **TCP/public HTTP** — rejected: widens transport; locality-only UDS is sufficient。
- **Generic privileged broker/shell/file writer** — rejected: caller could select action/path。
- **uid505 private state as ledger authority** — rejected: redefines parent Spec。
- **`main HEAD == evidenceCommit`** — rejected: evidence lives on a Draft PR descendant。
- **One implementation+deployment+execution task** — rejected: removes independent audit and may
  bootstrap during installation。

## 12. Migration, compatibility, and rollback

### A. Operator implementation task

Writes only `CTR-OP-017` closure and tests; no deployment, binding, window or Bootstrap。

### B. Operator deployment task

May start only after `AUTH_SERVICE_AGENT_CORE_BOOTSTRAP_PROVISIONING_UDS_V1` is accepted, merged,
implemented and audited. It installs trusted closure and disabled startup configuration; endpoint absent or
rejects all requests; no binding/window/Bootstrap。

### C. Deployment audit

Independent read-only verification of artifact hashes, source stamp, singleton, path/ACL, diagnostics,
listener absence, disabled behavior and rollback readiness。

### D. Exact execution-window task

D1 installs one immutable inactive uid505 binding; D2 independently audits its exact digest and persists
the closed GitHub comment; D3 verifies that receipt, writes the separate activation artifact, enables the
existing mount and opens the finite window. No D substep performs Bootstrap side effects。
### E. Bootstrap execution

uid502 sends only trigger/advance frames for the prebound attempt. Repo ledger acknowledgements gate each
stage. It cannot activate or provision later Slices。

Rollback follows `CTR-OP-020`; parent `SAFE_DISABLED_STAGED_IDENTITY` remains the only Bootstrap failure
terminal. No authority is silently superseded。

## 13. Open questions

```text
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
PARTIAL_SUPERSESSION = NONE
DUPLICATE_SPEC_RISK = NONE
AUTHORING_READY_FOR_REVIEW = YES
```

Non-normative future work: independent full review; Owner acceptance; merge; auth-service separately owns
and must establish the named authenticated provisioning-UDS prerequisite; only then A→B→C→D→E may pass
their gates; later exact-Client rotation authority if secret loss occurs; later activation/Grant/Root/
Binding Slices。

## 14. Final Output

```text
AMENDMENT_ROUND = 1
AMENDMENT_CLASS = TRIGGER_NOT_AUTHORITY_AND_OPERATOR_CLOSURE
CALLER_AUTHORIZATION_MODEL = PREBOUND_EXACT_OPERATION
PEER_UID_SECURITY_DEPENDENCY = REMOVED
REPOSITORY_LEDGER_AUTHORITY = PRESERVED
MAIN_EVIDENCE_BINDING = CORRECTED
SOCKET_SECURITY = CLOSED_BY_CONTRACT_AND_DEPLOYMENT_AUDIT
REQUEST_RESPONSE_SCHEMA = CLOSED
CRASH_AND_CONCURRENCY_RECOVERY = CLOSED
MEMORY_ZEROIZATION = BEST_EFFORT
IMPLEMENTATION_AND_DEPLOYMENT_CLOSURE = FROZEN
AUTH_SERVICE_AUTHENTICATED_TRANSPORT_PREREQUISITE = NOT_ESTABLISHED
DEPLOYMENT_ALLOWED_NOW = NO
SPEC_STATUS = proposed
FRESH_FULL_REVIEW_REQUIRED = YES
INDEPENDENT_REVIEW_RESULT = PENDING
READY_TO_MARK_ACCEPTED = NO
RUNTIME_WRITE_AUTHORIZED_NOW = NO
PRODUCT_CODE_CHANGED_IN_THIS_ROUND = NO
SECRET_READ_OR_EXPOSED = NO
NEXT_TASK_NAME = 通道 审计
NEXT_TASK_AGENT = 全新的本地审计 Agent
```
