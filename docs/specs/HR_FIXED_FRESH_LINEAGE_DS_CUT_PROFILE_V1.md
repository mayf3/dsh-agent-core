---
spec_id: HR_FIXED_FRESH_LINEAGE_DS_CUT_PROFILE_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
owners: [mayf3]
governed_by: [AGENT_PROCESS_LIFECYCLE_HARDENING_V4, SCHEDULER_CONTROL_PLANE_RELIABILITY_V1]
external_authorities: []
supersedes: []
superseded_by: null
authoring_base_main: 9db8aff18ef501a869a985cdc556c2a5109cfcdc
scope: [fixed HR source inhibition and local cut fact production through existing DS]
---

# Fixed HR fresh-lineage DS cut — subordinate draft, not executable

This profile defines only the fixed DS producer for accepted V4-C027–031.
Canonical authority is main `9db8aff18ef501a869a985cdc556c2a5109cfcdc`, V4 SHA256
`4bf8511905551ffae6d255844e893deb45dcd2844eed28078804b37f394eaf7a`.
V4 now authorizes the independent fresh-lineage admission branch. This profile
closes the separate DS implementation surface required by V4 §14; it does not
rewrite Router admission, allocate caller privileges or expand general deployment.
The old AER recovery/settlement route remains unchanged and is not invoked here.
Historical s256 settlement, CTO qualification and AER's floor-production sequence
are not prerequisites of this independent V4 branch (V4-C031). Its actual durable
all-generation issuance floor, isolation, old-fence preservation and new consumer
startup checks remain mandatory. While proposed, implementation is forbidden;
accepted lifecycle in the implementation base permits only bounded nonproduction
producer/client tests. Production installation/cut still needs Root's exact mandate.

The Owner target is one fresh, unrelated, no-side-effect HR canary received,
started, completed and replied, preferably as the same `agt_hr-agent`. Old
session/turn/execution remains UNKNOWN/fenced and permanently non-replayable.
This draft provides no alternate Agent, old-prompt replay or automatic message.

## Current bounded evidence

Installed public DS source was read without executing it on 2026-09-29:
SHA256 `95dc02f87106ca9e131839e6d9843a65adcff6018bfbf47725e9241b4e80961d`,
root-owned0555, 110226386 bytes. Its request allowlist has no fresh HR cut or
HR admin cut. `HR_SHIM_FIRST_EFFECT_RECEIPT_STATUS_V1` observes a different fixed
shim installation, not HR inhibition, termination or admission. Ordinary
`restart_runtime` waits for a launchd unload at best; it lacks complete old-tool
and holder census/cut-receipt production. `DS_UPDATE` remains fixed P0-maintenance
restricted. None is a callable implementation of this profile.

Scheduler `disableJobOp` uses `mutateDoc` and optional expectedRevision
(scheduleRevision, updatedAtMs); the bridge must require it. It sets enabled=false
and leaves occurrences/fences in place. Scheduler skips disabled future candidates,
but existing invocation already dispatched in `occurrence.js` is not withdrawn by
this change. AbortSignal, timeout, bootout return, PID absence or loaded new code
alone is not proof of old-worker/tool isolation. No protected old-record/process
facts were read for this draft; old ownership and current exact jobs remain unbound.

## Proposed fixed producer contracts

**FLC-DS-01 — Fixed identity and admission.** Proposed action
`HR_FRESH_LINEAGE_CUT_V1` accepts exactly action and operation_id, with that
ID equal to the sole newly sealed package ID. The existing kernel getpeereid
Owner502 boundary remains; caller fields never select Agent, job, path, command,
PID, code, generation or proof. Package default is unbound and rejects before
protected IO. Package binds actual host, service/client/interpreter/consumer hashes,
accepted governing authority, exact old HR lineage (Agent/session/runtime epoch/
generation/execution/handle), its immutable subject digest, fixed jobs/revisions,
all dispatch sources, active app/routes/normal-Agent preimage and compatible rollback.
Historical handle `turn:961534a5-8c94-487d-8e55-d324a54e821a:a2:g1:s256` is only a
subject locator until fresh root readback confirms the full tuple. No historical
cut/update ID is reused; unused status is proved under existing canonical mutex.
No new caller, daemon, root shell, user-path import or secret content is admitted.

**FLC-DS-02 — Inhibit without erasure.** Under the existing permanent DS mutation
lock and owned continuous window, persist root intent before effects; capture
fresh exact app/routes/source-control preimages and rollback first. Use the pinned
normal Scheduler control layer with mandatory expectedRevision and assertJob for
the sealed HR job set only; CAS conflict stops, never overwrites concurrent edits.
Read back disabled state durably. No direct JSON/SQLite editing, occurrence delete,
fence clearing or automatic re-enable. This proves future mint inhibition ONLY.
Inventory Dispatcher queues, admitted work, retries, launchd and all applicable
resume sources; require owned inhibition of old-lineage dispatch/resumption at
actual entry/effect boundaries before claiming inhibition complete. If existing
fixed APIs cannot achieve this, stop; do not invent an effect from disableJobOp.
Preserve old occurrence/run/fence evidence. After restart, proof must show disabled
jobs and old-lineage rejection still hold. Record any pre-cut concurrent event as
an actual fact; never backdate inhibition.

**FLC-DS-03 — Local cut, genuine ownership.** Prefer an existing exact owned-worker
stop only if the accepted consumer contract and installed executor prove complete
worker and in-flight local-tool coverage. Otherwise the only candidate mechanism
is one owned shared-Runtime maintenance window: inhibit all applicable launch and
resume sources, exact launchd service closure, owned stop, COMPLETE census of
Runtime descendants, session/workspace holders and tool workers, retained source
inhibition and descriptor/window custody through startup/readback. Match process
birth/executable/ancestry and owned handles; never select/kill by name or recycled
PID. Any unknown source, surviving worker/tool, incomplete census or lost custody
prevents cut success. An epoch/reply filter alone does not isolate a tool that
can still write. If a supported downstream boundary rejects the exact old identity,
record genuine rejection coverage; do not substitute it without accepted contract.
The accepted V4 durable all-generation issuance-floor and pre-start consumer
requirements remain mandatory; old AER qualification/settlement is not consumed.
Previously sent external requests remain UNKNOWN. Require the new canary to be
no-tool/no-side-effect and non-conflicting with outstanding external effects.

**FLC-DS-04 — Fact receipt, never self-admission.** Persist an independent root0,
regular single-link0600 receipt under a fixed root-owned0700 profile namespace
inside the existing DS state root, never caller-selected. The sealed package fixes
its operation directory; no generic reader. State: INTENT -> SOURCES_INHIBITED ->
LOCAL_CUT_PROVEN -> NEW_RUNTIME_OBSERVED -> COMPLETE; any ambiguous effect yields
sticky UNKNOWN. Receipt binds schema, operation, host/authority/producer/consumer
hashes, old tuple+subject digest, exact job CAS before/after and source-inhibition
proofs, owned stop/census/tool-isolation evidence and window continuity, actual
new generation allocated by the genuine runtime, app/routes/rollback identities,
old-record/fence preservation readback and timestamp ordering. A root signature,
file ownership or hash by itself is not causal proof. The consumer may use only
facts admitted by its separately accepted schema; neither DS nor this draft grants
an admission exception. If generation/start proof is unavailable, no COMPLETE.
No receipt reports old business success/settlement or permits old replay.

**FLC-DS-05 — Atomic join, status and failure.** Fixed status action
`HR_FRESH_LINEAGE_CUT_STATUS_V1` has no parameters and projects only this
sealed operation's bounded nonsecret disposition/digests and missing evidence.
It must exist and be verified before START; exact update/bootstrap reconciliation
must also use an already-installed lawful mechanism before installing the adapter.
Existing P0-restricted DS_UPDATE or fixed shim paths are not automatically authority
for this update. Lost ACK uses fixed status, never repeat mutation. Process/daemon
restart, absent/inaccessible receipt, drift or lock loss is UNKNOWN, not no effect.
No partial cut exposes fresh-lineage admission. One attempt consumes its sealed ID.
On ambiguity retain old fences, receipts and source inhibition; no automatic cleanup
or unsafe release. Proven safe rollback restores the captured ordinary-Agent
app/routes/availability, while HR old-lineage inhibition and UNKNOWN/no-replay
remain. Never overwrite newer Scheduler state to undo the cut. A rollback that
cannot preserve these conditions is blocked and explicitly UNKNOWN. Maximum
maintenance deadline and owned substep bounds must be numeric sealed inputs under
the accepted governing stop contract; a timeout cannot prove termination.

**FLC-DS-06 — Root-only adoption and canary.** Adopt only the complete reviewed
DS producer + accepted Router consumer + exact trusted update/readback closure,
with fresh root binding/unused ID/rollback/mutex facts; never install a partial cut.
After receipt validation and genuine same-Runtime readback showing old lineage
still fenced and only the new lineage admissible, original authenticated Owner
route may send exactly one newly authored no-side-effect HR canary. Record real
received/started/completed/replied correlation. Synthetic tests, health, COMPLETE
cut receipt or a sent message are not business acceptance. HR and unrelated Agent
post-state must be independently read back by Root. Writer performs no live effect.

## Focused acceptance design (not executed implementation tests)

| Case | Contract | Isolated test obligation | Later real Root evidence |
|---|---|---|---|
| FLC-A01 | 01 | Unbound/wrong peer/extra path or PID/wrong subject/used ID reject before IO | Fixed peer, exact package, actual old tuple, unused ID under lock |
| FLC-A02 | 02 | Stale revision rejects with zero write; disabled jobs retain old occurrence/fence; pre-dispatched tool still live is NOT cut | CAS receipt and all dispatch-source inhibition readback |
| FLC-A03 | 03 | PID reuse, unknown holder, live tool, alternate launch, lost FD each rejects; exact complete owned census permits fact only | Actual process/entrypoint/tool coverage and uninterrupted window |
| FLC-A04 | 03,04 | A delayed external effect after local stop remains UNKNOWN; no old business settlement | New canary no-effect/non-conflict binding |
| FLC-A05 | 04,05 | Root ownership without causal chain, wrong epoch/generation/consumer, drift or incomplete receipt rejects | Root receipt bound to genuine generation and unchanged old lineage |
| FLC-A06 | 05 | Disconnect/restart/absent status never replay; missing update-reader blocks before first mutation; rollback cannot re-enable old lineage | Exact install/cut receipts, installed closure, safe rollback and fixed status |
| FLC-A07 | 06 | Partial adapter/consumer cannot enable admission; source fixture never claims canary | One fresh received/started/completed/replied HR result; other Agents restored |

## Exact DS–Router interface and phase order

The fixed incident subject is `agt_hr-agent`, old handle
`turn:961534a5-8c94-487d-8e55-d324a54e821a:a2:g1:s256`. The sole candidate cut ID
is `hr-fresh-lineage-cut-20260929-0d8235e7`; it is RESERVED_NOT_PROVED_UNUSED.
Its associated status action takes no fields besides action. No old ID aliases.
Default compiled binding is absent: requests reject before protected IO. The
sealed package binds complete actual old tuple and every HR-targeted Scheduler
job under canonical store lock; a truncated diagnostic or selected job list is
insufficient. New unknown job/Dispatcher source, revision drift or incomplete
inventory blocks. Do not enumerate by prompt/name matching or modify unrelated jobs.

Schema `HR_FRESH_LINEAGE_CUT_RECEIPT_V1` has only these top-level fields:
`schema, phase, cutOperationId, hostId, authoritySha256, producerSha256,
consumerSha256, oldAgentId, oldTurnHandle, oldRuntimeEpoch, oldProcessGeneration,
oldSessionId, oldRecordSha256, oldFenceRetained, newRuntimeEpoch, newSessionId,
issuanceFloor, sourceProofSha256, localCutProofSha256, preimageSha256,
rollbackSha256, windowId, nonce, sequence, committedAtMs`.
`phase` is `PREPARED_CUT`; oldFenceRetained must be true. Hash fields are exact
64 lowercase hex, subject IDs exact bound nonempty strings, sequence and times
bounded safe integers; no duplicate/unknown keys. Epoch/session are minted once
by the original trusted producer, durably reserved with intent under the existing
lease, never supplied by caller/config/environment. `issuanceFloor` is the
validator-observed durable maximum across all HR issuance, not a guessed next PID.
This receipt contains no prompt, tool arguments, credentials or business output.

Ordered protocol, under the same owned maintenance window:
1. Fresh preflight/capture/rollback, durable one-use intent, genuine source
   inhibition and complete old local worker/tool isolation; persist proofs.
2. Seal PREPARED_CUT after those proofs and old fence readback, before new
   Runtime business readiness. It proves local cut facts, not canary success.
3. The original trusted startup channel delivers the exact receipt to the
   accepted Router consumer behind a closed barrier. The consumer must validate
   root custody, package/host/old tuple, proof digests and expected nonce/window;
   arbitrary JSON/ENV/argv is not a bearer credential. The installed transport
   must be jointly reviewed with the consumer; if no protected fixed channel
   exists, the candidate cannot be installed, and no generic read API is added.
4. The new owned Runtime binds the reserved epoch/session and allocates process
   generation strictly greater than issuanceFloor. Router writer owns the durable
   cut plus exact Feishu activeSessionId joint commit and prompt/tool checks.
   Receipt consumption never settles/clears the old record. No admission opens
   until that joined commit is verified; no ordinary Agent traffic is proof.
5. DS observes authenticated startup/consumer acknowledgement bound to receipt
   digest, nonce, actual runtime identity and generation; records separate
   `HR_FRESH_LINEAGE_CUT_RESULT_V1` with disposition COMPLETE or UNKNOWN,
   preparedReceiptSha256, runtimeAckSha256, oldFenceRetained, operation ID and
   original preimage/rollback linkage. The PREPARED receipt remains immutable.
   New startup does not depend on its own COMPLETE result. Root independently
   reads actual readiness and retained old state before the one new canary.

Private producer proofs/intent/results are root0/single-link0600 in the sealed
fixed DS state namespace `/private/var/db/agent-deploy-system/hr-fresh-lineage/`.
No caller selects a subpath. Any root-to-runtime delivery projection must preserve
this authenticated binding without permission repair or revealing raw protected
records; its exact closure is an installation prerequisite, not an inferred grant.
The job is service-owned and queryable; client disconnect never releases the
window or cancels/repeats effects. Existing DS lease is acquired once by the owner,
not held twice across an inner action. Stop/start each have 60s bounded owned
command budget; overall maintenance window 300s. Deadline or owner loss is sticky
UNKNOWN and cannot open admission or permit an unproved rollback.

## Adoption boundary and implementation mandate

Accepted profile implementation is confined to a fixed DS adapter, its fixed
Scheduler-control helper and client packet, receipt validation/serialization,
hermetic process/host fixtures and exact source composition. Router, ingress,
Broker and Binding consumer code belongs to the separate original Router writer.
No source change in this profile grants a live process stop or service update.
The Owner's present direction plus independently reviewed technical acceptance
must be recorded under the true authorized maintainer identity, not a fabricated
Owner SHA signature. Acceptance changes lifecycle only, then merges into the
implementation base before product edits.

Existing DS_UPDATE and FIXED_DS_SCRIPT_UPDATE_V1 are P0-pinned, not installation
routes for this profile. Existing shim INSTALL_DEPLOYMENT_SYSTEM has a fixed
four-piece transport and old receipt/status path, but lacks expected-live-preimage
CAS and automatic failure restore. Root must bind a separately reviewed exact
installation transaction with live preimage, serialized lock, retained rollback,
actual authorization and independent lost-response reconciliation before install.
Do not reuse that technical transport naked or amend its privileges implicitly.
No partial producer/consumer package is installable. A source-tested producer may
remain non-installable until exact consumer/update closure and fresh facts are
bound; this is not business recovery. Old operations/fences stay permanently held
as recorded, never erased or replayed.
