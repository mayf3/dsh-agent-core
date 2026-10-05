---
spec_id: HR_S256_ADMIN_EMERGENCY_RECOVERY_V1
status: accepted
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
owners: [mayf3]
governed_by: [HR_RESTART_LOST_FENCE_TRUSTED_RECOVERY_SPEC_V2, HR_FIXED_CAUSAL_QUALIFICATION_EVENT_SEAM_V2, HR_FIXED_ORIGINAL_EXECUTOR_QUALIFICATION_PHASE_V2, AGENT_PROCESS_LIFECYCLE_HARDENING_V3]
external_authorities: []
supersedes: []
superseded_by: null
scope: [one fixed s256 admin-authenticated emergency recovery profile]
accepted_by: original Deployment Agent under mayf3 standing nonproduction technical delegation
accepted_date: 2026-09-28
accepted_reviewed_head: ac10e9ae2e0cefe6b7acfabf4fe1d90bfa0a3b39
accepted_reviewed_spec_sha256: 01319d7f0ede5f20ad992857b7986c14728b9333ac4ca712b4f9dc6f2a70d688
independent_review_sha256: 7ae15f6c7d598d6aec0de14fdc732b1ace51a2628a8d83d5c367399f94a63d2a
delegated_acceptance_sha256: afd5d4a81525dda96b8b1eef94a6897db426788f2f7b2b275bbb22218a15015c
delegated_acceptance_record: /Users/yanfenma/workspace/artifacts/DEPLOYMENT_BACKLOG/HR-ADMIN-AER-C02-DELEGATED-ACCEPTANCE-20260928-v1/ACCEPTANCE.json
---

# Fixed s256 admin emergency recovery — proposal

This is a separate, docs-first accepted mode for bounded nonproduction
implementation only. It does not change the accepted
R4 V2 whole-host termination class, RQ-007 floor and validator prerequisite,
closed settlement vocabulary, or the CTO-specific QF/OCB qualification path.
Its reviewed delegated technical acceptance permits implementation only after
this lifecycle is in the applicable canonical base. It grants no installation,
stop, protected read, fence clear, new HR prompt or production operation.

## DEVELOPMENT_PREFLIGHT

`REVIEW_TARGET_HEAD` is the proposal branch based on `origin/main`
`861235491cdb216b12346181d26616f383ab4fd0`; the prior clean assessment
head `47e253bb3a7ce4e03bfbf04b29330d306a159aa8` is preserved as
`codex/hr-quick-recovery-baseline`. `GOAL` is one NEW HR request after the old
s256 execution is proven unable to continue, without making a CTO Feishu
message ID, Owner sender hash, or three CTO proof turns prerequisites of this
mode. `CURRENT_GAP`: the accepted fixed QF carrier binds CTO-specific
qualification while no accepted admin-only profile or alternate receipt
eligibility exists. `OBSERVATION`: R4 V2 RQ-001/005/007 requires whole-host
quiescence, actual PROVEN floor, validator-before-producer, and termination-only
settlement; PLH V3 C-005 explicitly allows an already-issued external effect
to remain unknown. `AUTHORITY_ACTION=NEW`, `PLAN_LEVEL=BRIEF`,
`ASSURANCE_LEVEL=CONTROLLED`, `ROUTE_STAGE=AUTHORITY_AUTHORING`,
`SPEC_GAP_DEPENDENCY=LOAD_BEARING`, `IMPLEMENTATION_ALLOWED=NO`,
`OPERATION_ALLOWED=NO`, `NEXT_ACTION=REVIEW`. The prior Owner request is an
execution direction and proposed product decision, not an accepted Spec or a
host-effect mandate.

## Decision and scope

The fixed subject is the existing durable s256 record for `agt_hr-agent` and
its exact epoch, generation, turn execution ID and reconciliation handle.
The admin path uses the existing DS peer-authenticated caller boundary
(`getpeereid`), canonical mutation lock and one privately compiled fixed
package/host/subject binding. Its distinct exact two-field request is
`{"action":"HR_S256_ADMIN_EMERGENCY_CUT_V1","operation_id":"hr-s256-admin-emergency-cut-20260929-6d3b45a0"}`;
the ID must be proven unused and reserved once under the root journal before
effect. The existing MI/R2 action and its pinned ID are never reused or
reinterpreted. No mode, path, Agent, PID, proof, PASS, principal, credential
or executable may be selected by the caller. The package determines this
profile, and default/uninstalled configuration rejects before protected I/O.
This proposal creates no generic recovery action or per-Agent reset.

For this incident's one current attempt, the matching private qualification
operation is `original-router-qualification-20260929-6d3b45a0` and its fixed
service installation is `ds-hr-admin-private-install-20260929-6d3b45a0`.
The earlier `hr-s256-admin-emergency-cut-20260928-v1` and associated offline
package identifiers remain historical evidence; they confer no replay or
alias permission. The three current IDs must each be proved unused at their
own durable boundary before their first effect. This amendment changes only
the incident's exact single-use IDs, not subject, caller, trust boundary,
prerequisites, rollback, or UNKNOWN semantics.

**AER-C01 — Independent admin admission.** The DS must authenticate the
actual existing allowed caller through its kernel peer, then verify the
fixed package, host, current deployed app/entry identity and exact s256
durable preimage under root custody. Missing, wrong, duplicate or previously
UNKNOWN operation identity rejects without effect. A thread label, local
UID assertion, Feishu identity, caller JSON or compiled source hash alone
does not grant admission. CTO message ID, `OWNER_SENDER_SHA`, and CTO turns are
neither requested nor used by this mode. The existing CTO/QF path remains an
optional *separate* source of genuine qualification evidence, not a required
or fabricated admin input.

**AER-C02 — Unchanged forward safety prerequisite.** Before the AER-C03 fixed
HR cut inhibits, stops or restarts any Runtime, the exact final consuming
binary must have an
independently verified actual `ROUTER_RESTART_SAFETY=PROVEN` floor receipt,
the accepted new-kind validator installed in that same binary before any
producer write, and a compatible captured/admitted rollback floor. The
existing closed floor/validator receipts must be read from root custody and
causally validated, not minted from current bytes, timestamps, healthy
status, or an admin claim. The alternate **producer** is the original sealed
root proof executor's fixed admin qualification branch defined by proposed
`HR_FIXED_CAUSAL_QUALIFICATION_EVENT_SEAM_V2` QE2-C02/C03. It first checks
already completed same-final-binary receipt eligibility; otherwise it owns
the original controlled qualification sequence with exactly one reviewed,
tool-free, private native canary turn in each of three startup phases across
two restarts. Those separate qualification-only restarts produce the floor;
each remains subject to QE2-C02/C04's actual final-binary deployment,
validator installation, current app/routes and compatible rollback, root
custody, source inhibition and pre-effect checks. Actual Router durable
issuance, native terminal result,
continuous binary/child/custody and validator ordering must be observed.
Genuinely occurring authenticated non-CTO turns may alternatively qualify,
but their absence is not the primary path or an Owner message-ID task. The
canary ingress is a **new fixed trust boundary** that does not yet exist in
the installed DS/Router. This proposal cannot be executable merely by
setting package pins or accepting these docs; the exact private ingress,
effect denial and readback must be separately implemented and reviewed.
No supplied log, caller PASS, fabricated event or Feishu impersonation can
replace them. The fixed admin cut consumes the unchanged two closed receipts
only after the producer seals a complete eligible chain. Missing capability,
incomplete phase or unbound actual receipt stops before the cut's inhibition
or child effect. Bypassing CTO proof does not waive R4 V2 RQ-007.

**AER-C03 — One whole-host cut, not session reset.** Under the one canonical
root lock, the fixed owner inhibits every applicable Runtime launch/resumption
source, stops the old Runtime tree with exact owned control, and proves a
COMPLETE post-stop host census with zero Runtime-tree members and zero
subject workspace/session holders. It maintains exclusive window/FD custody
and inhibition through one pinned nonce-bound startup, bundle commitment,
consumer settlement, and readback. An observed old worker, unknown source,
lost holder coverage, missing exact ownership, stale window, alternate
startup, duplicate attempt or deadline loss returns sticky UNKNOWN or a
pre-effect zero-effect refusal; it never reopens HR admission. Normal Agents
sharing the Runtime are briefly unavailable during this host cut; the cut
must preserve their installed configuration and restore their admitted
working version after verified completion or a verified safe rollback.

**AER-C04 — Old effect boundary and old record.** This cut proves that the
old Runtime execution cannot issue a *new* tool or reply effect after the
verified cut. It does not claim that an external request already sent before
the cut did not, or will not, commit. Preserve the old s256 business outcome
and any such external side-effect outcome as UNKNOWN; never replay the old
prompt, tool call, reply or failed admission. The Router consumer may settle
only exact termination as `terminated_without_outcome` with accepted
`restart_quiescence_proven` evidence and retains the original durable record.
If a specific unresolved old external operation could conflict with the
proposed NEW HR request, block that conflicting operation until the target
system supplies an attributable terminal/idempotency readback or the new
request is demonstrably non-conflicting. An epoch-only/reply-only guard or
gateway receive check cannot cancel an already-dispatched remote effect.

**AER-C05 — Readback before one new HR admission.** The original startup
consumer validates the exact root bundle and durable preimage before business
admission. H4 requires the exact durable settlement receipt. H5 requires both
fence state and admission status from the same authenticated owned Runtime,
not a health check or caller PASS. Only after those readbacks and the C04
conflict check may one genuinely NEW HR request be admitted through ordinary
authenticated ingress; no previously rejected request is auto-admitted.
Success requires its attributable native/Broker completion; sending or
queuing is not completion. Unrelated Agents retain their original
configuration, route topology, credentials and admission policy.

**AER-C06 — UNKNOWN and rollback.** A durable root intent precedes any effect;
one attempt consumes its fresh ID. Pre-effect rejection changes no app,
routes, store or fence. After any ambiguous effect, retain the actual child,
source, lock and window custody with truthful UNKNOWN; do not automatically
release, retry, clear the fence, reissue the nonce or claim normal service
restored. A verified compatible rollback restores exactly the freshly
captured pre-cut app/routes and ordinary-Agent service, with post-rollback
readback; it cannot erase or replay an unknown old external effect. Production
execution still needs a separately bound exact Owner mandate/current host
facts and the original controlled operator.

## Acceptance mapping

| Case | Contracts | Nonproduction method | Required result / failure condition |
|---|---|---|---|
| AER-A01 | C01,C02 | Fixed DS private-entry fixture: peer, package, host, subject, proof and rollback variants | Only exact authenticated caller and real-equivalent receipt inputs reach preflight; old R2 action/ID, wrong peer/Agent/turn, missing floor or validator, used/UNKNOWN admin ID, caller PASS reject before protected mutation. |
| AER-A02 | C03,C04 | Hermetic old process, holder, launch-source and late Broker/Feishu-effect fixture | Nonzero/unknown census or lost window forbids startup and writes zero settlement; old external effect remains UNKNOWN without replay. A synthetic remote effect released after local cut never becomes evidence of no effect. |
| AER-A03 | C03,C05 | Confined one-window startup/consumer/owned-Runtime join | Exact termination-only settlement and H4/H5 readback precede one NEW HR admission; duplicate launch/old reply/old tool/old rejected request cannot re-enter. |
| AER-A04 | C04,C05 | Conflict-specific synthetic downstream readback matrix | Unresolved conflicting old operation blocks that effect in the new request; attributable terminal/non-conflict may admit one new request. Missing readback never becomes negative proof. |
| AER-A05 | C03,C06 | Fault injection before/after intent, stop, census, launch and readback | Before-effect refusal is zero-effect; post-effect UNKNOWN retains custody and blocks retry/release; verified rollback restores exact prior normal-Agent app/routes only. |

## Review and operation boundary

The existing R4 V2 consumer and fixed nonproduction collector/maintenance
code may be reused only after this authority is accepted; no source edit is
authorized by this proposal. Independent review must decide whether C02's
new private canary trust boundary, authentic floor/validator production and
C04's conflict-specific downstream readback are sufficient for the desired
incident. A positive synthetic
fixture cannot prove a current host prerequisite, that normal Agents have
been restored, an old external effect's outcome, or one completed NEW HR
request. Until then this mode is `NONEXECUTABLE`.
