---
spec_id: HR_FIXED_CAUSAL_QUALIFICATION_EVENT_SEAM_V2
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
owners: [mayf3]
governed_by: [HR_RESTART_LOST_FENCE_TRUSTED_RECOVERY_SPEC_V2, HR_FIXED_S256_MAINTENANCE_INSTALLATION_V1]
external_authorities: []
supersedes: [HR_FIXED_CAUSAL_QUALIFICATION_EVENT_SEAM_V1]
superseded_by: null
scope: [fixed original separate proof-executor private causal qualification completion seam]
---

# Fixed original-executor causal qualification — whole-authority successor proposal

This is the complete successor for the accepted V1 receipt-eligibility decision.
V1 remains accepted until independent whole-authority review and one atomic
Owner-accepted lifecycle transaction. This document has no current code or
production authority. It preserves V1's original CTO-qualified branch and
adds exactly one CTO-free admin branch under the **same original separate
root-authenticated proof executor**. Its primary proof-turn source is a new,
fixed, tool-free private qualification canary ingress; already occurring
authenticated turns are an alternate source. This ingress is a NEW trust
boundary requiring separate independent review and Owner acceptance of this
whole successor before implementation. It does not change R4 V2 RQ-007/V10,
the closed `floor-proven.json` four-field and `validator-installed.json`
three-field representations, the four-input publisher, validator-before-HR
producer ordering, or the later whole-host s256 cut. A sender hash, message
ID, thread label, euid, timestamp or source snapshot cannot certify proof.

## DEVELOPMENT_PREFLIGHT

`BASE_HEAD=861235491cdb216b12346181d26616f383ab4fd0`.
`GOAL` is a second fixed private causal proof source not dependent on CTO
Feishu identity/turns or unpredictable third-party traffic. `CURRENT_GAP` is
V1 QE-C01 and its implemented QF/OCB procedure's CTO-bound selector; no
current DS-to-Router authenticated, tool-free turn ingress exists.
`AUTHORITY_ACTION=SUPERSEDE`,
`PLAN_LEVEL=BRIEF`, `ASSURANCE_LEVEL=CONTROLLED`,
`ROUTE_STAGE=AUTHORITY_AUTHORING`, `SPEC_GAP_DEPENDENCY=LOAD_BEARING`,
`IMPLEMENTATION_ALLOWED=NO`, `OPERATION_ALLOWED=NO`, `NEXT_ACTION=REVIEW`.
The Owner's new mode direction is not itself a completed causal receipt.

## Contracts

**QE2-C01 — Preserved original branch.** V1 QE-C01 remains a complete
eligible path: the original separate proof executor (original Deployment
Agent thread `01a0ad06-249f-7632-809b-961b93c3b113`) under its sealed fixed
root entry/kernel namespace/OFD custody executes and directly observes the
original OWNER_RUNBOOK procedure (SHA-256
`d8cfc5a3925c29ee843258a8077f57f4d8223f44bf697bbd24edba011753911e`,
§① trusted deployment and §② completed proof) for the exact final consuming
whole-app binary. It verifies trusted deployment/validator installation,
store and floor, real same-Agent generations across two controlled restarts
with strictly monotonic issuance/no overlap, attributable completed native
turns and required health, and continuously unchanged binary identity.
Only then does it seal the existing two closed receipts once with actual
observed times. Missing/ambiguous/changed events or binary, incomplete
procedure, or uncertain order yields UNKNOWN/no seal. The accepted CTO
QF/OCB binding remains valid for this original branch and is not weakened.

**QE2-C02 — Fixed CTO-free original-executor branch.** The *same* original
root-authenticated sealed executor may select only a separately reviewed,
compiled admin-qualification package, never a caller-supplied mode/path/Agent
or public DS request. No CTO message ID, CTO sender OpenId/hash, CTO turn,
other-Agent identity supplied by the caller, or new credential/grant is an
input. Before any new qualification restart the executor first readbacks
existing root-custodied floor/validator receipts; it may consume them only
if their original sealed producer chain already proves **every C01 predicate
for this exact final binary**. A receipt from a different binary, incomplete
procedure or unknown source is ineligible.

With no eligible receipts, the original executor runs the same fixed trusted
deployment, validator-install and two controlled-restart proof procedure for
the exact final whole-app binary. In each of its three bounded owned startup
phases, its primary turn source is exactly one fixed qualification canary for
`agt_efficiency-agent`. The executor invokes a private Router ingress only
through the existing authenticated root-entry/owned-child FD and nonce
context, bound to the sealed package, current host, exact deployed binary,
phase, runtime generation and deadline. The new private entry is a one-use
`qualifyFixedTurn`-equivalent callsite, not a new public DS action or a
caller-facing Router service. The Router independently verifies that live
capability before minting a fresh durable turn/handle in its real
store. It preserves the existing global durable-store readiness/validator,
mint-capacity and fixed Agent's active-fence checks before any mint or
prompt write: an invalid store or fenced `agt_efficiency-agent` is UNKNOWN/no
seal, never a privileged bypass to obtain a turn. The fixed canary
text/target/session are compiled in the reviewed
package; no caller supplies a prompt, message ID, Agent, route or recipient.
This is not `deliver` with caller text, a Feishu send/reply, an Owner turn,
an HR s256 turn, or a reusable admin messaging API.

The canary must be **tool-free by enforcement in the same final binary**:
before admission the Router and child tool registry install a fixed empty
turn-scoped capability set, and the parent Broker relay, Feishu outbound,
shell/process and alternate-route boundaries independently reject this
turn's effects. There is no different proof-only binary/profile or hidden
permission-mode escape. Prompt instructions, a caller-asserted empty tool
list or a post-hoc zero-call counter are insufficient. If any tool path
cannot be denied before prompt write, no canary starts. The owned child must
execute the actual native turn; the Router must read back its genuine durable
issuance/unique handle, native prompt receipt ID, terminal reply/result,
absence of tool/Broker/outbound effects, and exact
generation/child/nonce binding through the authenticated private return and
protected store descriptor. A mere accepted/queued turn, model text, health
response, fabricated receipt or process exit is not completion. The original
executor observes these events itself under continuous FD/window custody;
it cannot accept an event list or PASS from HR, the caller or a supplied log.
Any missing enforcement hook or observation method leaves this branch
UNKNOWN/no seal. This paragraph defines a **new fixed trust boundary**, not
a claim that the current Router/DS source already implements it.

Alternatively, in each phase the executor may observe one naturally
arriving, genuinely authenticated ordinary Feishu turn of that same fixed
Agent through the real no-follow protected store descriptor and actual
native/Broker reply completion. It may not send, impersonate or ask for a
message ID. The branch choice is fixed before the first startup and cannot
mix canary and passive turns. For either choice, exactly one fresh completed
turn per phase must begin after its owned startup, bind the exact runtime
epoch and child, and show unique issuance and no later ambiguity. Across
two owned restarts all three generations and max-issued sequences strictly
increase without overlap. The observer retains only bounded metadata and
hashes, never bodies, sender OpenIds or private payload. If a phase has no
qualifying completed turn before its original deadline, it is UNKNOWN/no
seal; no automatic replay, extension or fallback after an uncertain effect.
Passive traffic is an alternate evidence source, **not** the autonomous
recovery mechanism. Source snapshots, timestamps, health and point-in-time
store floors cannot replace real completed turns.

**QE2-C03 — One receipt eligibility and causal order.** Either C01 or C02
must run under original root entry and actual kernel-held custody. The
executor binds the same final whole-app digest from deployment through
each restart/turn and receipt readback, proves validator installation from
that deployment before any HR new-kind producer, and validates the floor's
actual durable range invariants. It seals only the existing closed
`floor-proven.json` and `validator-installed.json` bytes once after all
observations; the root-held causal journal identifies which reviewed fixed
branch produced them without adding a public field or protected output.
The later four-input publisher validates the unchanged shape, source and
digest. A missing branch identity, mixed canary/passive/CTO evidence,
changed binary, reused old receipt, duplicate seal or unbound event is
UNKNOWN/no seal. A new HR emergency operation cannot self-certify its own
forward prerequisite.

**QE2-C04 — Availability and rollback boundary.** Existing eligible same-
binary receipts may avoid a new qualification restart. Otherwise the two
controlled restarts temporarily interrupt ordinary Agents sharing the
Runtime; the subsequent HR whole-host cut is a separate maintenance window.
The executor must schedule that finite interruption against the current
ordinary-Agent service/rollback plan, not claim that canaries preserve their
sessions through a restart. The fixed canary can make qualification progress
without waiting for an external message; it cannot eliminate the required
owned restarts or turn an unsafe maintenance window into permission to stop.
Before each effect Root must bind current app/routes, compatible rollback,
fixed source inhibition and custody. On a pre-effect failure, no restart or
receipt write occurs. After an uncertain effect, retain truthful current
state and bounded custody; no automatic retry/release or PROVEN seal. An
affirmatively safe rollback restores exact captured ordinary-Agent app and
routes with readback. The admin branch never clears HR's old fence, settles
s256, sends a business message, or claims H2–H6 completion.

## Acceptance mapping

| Case | Contracts | Method/environment | Required evidence and failure condition |
|---|---|---|---|
| QE2-A01 | C01,C03 | Existing original fixed CTO fixture, hermetic | V1 positive and missing/changed-event negatives remain byte/behavior equivalent; no CTO shortcut or changed receipt fields. |
| QE2-A02 | C02,C03 | Confined fake-OS original root carrier and fixed private Router/child ingress | Wrong peer/FD/nonce/package/host/Agent/child/binary/phase, caller text or ID/PASS, reused handle, fake completion, missing tool-denial hook or attempted tool/Broker/Feishu effect rejects before seal. No host dispatch. |
| QE2-A03 | C02,C03 | Three actual-module synthetic native canary turns across two owned synthetic restarts | Only three unique durable-issued, terminal, tool-free same-Agent turns with strict issuance/order and continuous exact binary permit unchanged floor4/validator3 seal; missing/late/ambiguous completion, effect attempt, timeout or overlap is UNKNOWN/no seal. Fixtures are never host proof. |
| QE2-A04 | C02,C04 | Root receipt reuse/readback plus passive-turn alternate | Existing complete same-binary proof may be consumed without restart. Passive authentic turns can qualify only if all three arrive and finish within bounds; zero traffic does not block the fixed canary path. No Owner message ID or manual test action is requested. |
| QE2-A05 | C03,C04 | Confined qualification→R4 consumer join | Validator before producer, floor before HR stop, compatible rollback and later whole-host cut remain mandatory; qualification alone never clears s256 or admits an HR turn. |
| QE2-A06 | C02,C04 | Current-source negative and fixed private ingress conformance | Generic `deliver` inbox acceptance, caller `messageOrigin`, Feishu ingress, model-only no-tool instruction, or a root/euid label cannot qualify; only the new owned-FD canary path with enforced zero tool/Broker/outbound capability, actual durable/native completion and same-final-binary readback may seal. Missing implementation remains NONEXECUTABLE. |
| QE2-A07 | C02,C03 | Fixed admission and store negatives | Invalid global durable store, insufficient mint capacity or active fence on fixed `agt_efficiency-agent` reject before prompt write; no special canary bypass, minted handle, receipt or HR fence change. |

## Exact current interface gap

The present Router `ingress-delivery.js` `deliver(req, controlOpts)` accepts
caller `message`/`agentId` and returns when a session inbox accepts the
message, before turn completion. Its `onAuthenticatedFeishuIngress` requires
a real Feishu raw sender/message; neither can serve as a root-owned native
canary or be relabeled as one. `agent-process.js` `turn` and
`turn-execution.js` can yield real `status:'completed'`, durable handle and
prompt `messageId`, but no current private admission ties that call to the
root-owned qualification phase. The production process profile contains
Broker, memory and switch tools, and `agentEnv` sets
`DSH_PERMISSION_MODE:'danger-full-access'`; `parent-rpc-relay.js` can forward
a child's Broker capability call to the gateway. Fixed prompt text alone
therefore does not prove zero external effects. The accepted gated startup context
authenticates a qualification child before Router import, but supplies no
private turn-admission/terminal-result query. The missing minimum source
join is one FD-authenticated, phase-bound, fixed-target Router ingress from
that owned child plus enforceable tool/Broker/outbound denial and durable
native completion readback to the same original root executor. It may be
implemented only after this new trust boundary is accepted; adding a
`messageOrigin` value to the public `deliver` API, accepting a callback
Boolean or treating inbox acceptance as completion is outside this contract.

## Lifecycle and evidence limit

The V1 root actor, original runbook, closed receipts, four-output publisher,
protected store validator and original CTO path are preserved. The new
fixed admin branch requires reviewed source at the original root driver,
private Router ingress, child tool/Broker effect-denial boundary and native
durable readback; the current generic `deliver` and CTO-hardcoded
`observation.mjs` cannot implement it by relabeling. The accepted
`ROUTER_INGRESS_RECEIPT_READBACK_V1` remains an optional passive read-only
corroboration, not canary admission. Installed entry/deployment/selector
pins, current final binary, floor, validator, rollback, host custody and
actual qualification are unbound. Thus this proposal is not an executable
package or a production operation. No source or host effect is authorized.
