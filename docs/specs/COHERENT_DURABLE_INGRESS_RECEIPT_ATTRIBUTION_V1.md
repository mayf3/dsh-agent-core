---
spec_id: COHERENT_DURABLE_INGRESS_RECEIPT_ATTRIBUTION_V1
status: accepted
spec_kind: narrow_implementation_amendment
authority_level: governing_spec
implementation_authority: contracts
implementation_scope: bounded_nonproduction_only
production_apply_authority: none
date: 2026-09-26
authoring_base_main: bed1936f990f7a2831cf55ac35716b861570f40e
accepted_by: mayf3
accepted_date: 2026-09-26
accepted_reviewed_head: 40a739be19883e1697decdc56e13dd1e081610ab
accepted_reviewed_spec_sha256: aba5b6647a00a8c377109e8759ae2e808cad15b2ec2c30cac3ccb141a677f756
independent_review_result: PASS
independent_review_sha256: f092f62464434414238bf15be1198e61340af50c6d3b50dfe9ac03ca6c5e8094
final_owner_acceptance_record: /Users/yanfenma/workspace/artifacts/DEPLOYMENT_BACKLOG/COHERENT-V5-OWNER-ACCEPTANCE-20260926/ACCEPTANCE.json
final_owner_acceptance_sha256: bee8a6c3d9df6290b30207adf6522e6c2389c4af90226d216e82b1d7f53a0923
amends:
  spec: AGENT_PROCESS_LIFECYCLE_HARDENING_V3
  scope: >-
    Adds one optional write-once authenticated Feishu ingress correlation to the
    C-010 pre-prompt V3 record and one fixed protected readback of that record.
    C-017 through C-019 settlement, fences and native receipt semantics remain.
related_specs:
  - AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V2
  - PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1
  - AGENT_CORE_HARDENING_PROGRAM_V1
related_decisions:
  - AGENT_WORKSPACE_SESSION_MODEL_V3
owner_direction:
  marker: ACCEPT_COHERENT_DURABLE_INGRESS_RECEIPT_ATTRIBUTION_CORRECTED_V5=YES
  proposal_sha256: 55f746d8c4c3d27c79d85bb6bea326c518663277e4957844f93564e1ec40a58e
  proposal_review_sha256: b5a58173cd0fc020e192aeec9d9c504bc646700e535d0d068444a3eb4bf18a16
  owner_acceptance_sha256: 521340febe101dcd6ce2f62a751426e6753630a8fca9872596494dc29495461e
  effect: spec_authoring_and_bounded_nonproduction_implementation_only
supersedes: []
superseded_by: null
---

# Coherent durable Feishu ingress to native receipt attribution V1

This is a **proposed child amendment**. The Owner accepted the direction in the
reviewed corrected V5 proposal, including a fixed Router record read and a
root-owned hash-only DS evidence receipt. That acceptance permits Spec authoring
and bounded nonproduction implementation preparation. This file is not yet an
accepted implementation Spec and grants no production read, DS update, deploy,
smoke, restart or recovery authority.

## 1. Exact problem and authority relation

The current V3 Router record binds `turnExecutionId` to a native prompt receipt,
but it does not durably prove that one Owner-initiated Feishu message with one
authenticated sender produced that execution. `Object.freeze` on a public
`ingressContext` protects mutation, not provenance: published `route` and
`runTurnWithRouteChain` can receive an identically shaped object. The live DS
`ROUTER_DURABLE_SUMMARY` validates an aggregate store but cannot select the exact
record for the assigned Deployment Agent. Raw configuration or logs are neither
a narrow authorized read nor a complete receipt.

This amendment adds only:

1. optional five-leaf `ingressCorrelation`, minted by the private authenticated
   Feishu connector path in the existing V3 record; and
2. fixed-target `ROUTER_INGRESS_RECEIPT_READBACK_V1`, which reads one protected
   V3 store and durably records a redacted, hash-bound result.

The V3 store remains the sole turn authority. Existing C-010 reservation before
prompt bytes, C-017 settle-once, C-018 non-consuming read, C-019 identity,
unknown fence, retention and native `record.messageId` semantics remain intact.
The accepted Lark SDK/PolicyGate and Agent/Session/Binding model are unchanged.
The existing PDC V1 queue, protocol and standing profile authority are not
silently expanded: this fixed Python DS action needs its own later reviewed
DS update and exact production authorization.

Historical V1–V4 attribution proposals are provenance only. In particular,
public/frozen `opts.ingressContext`, normalized `senderId` fallback,
Agent-filtered uniqueness, aggregate DS summary, raw store/log read and a
caller-supplied store digest do not satisfy this contract.

## 2. Trusted producer boundary

`feishu.setCallback` SHALL receive a **private**
`onAuthenticatedFeishuIngress` handler reachable only after the existing SDK and
PolicyGate admit the connector event. Public `service.route`, public
`onIngress` and public `runTurnWithRouteChain` SHALL NOT register trusted
provenance, even if their values and object shapes match the private event.

One Router instance owns one private `WeakMap` keyed by the exact fresh `opts`
object that ingress delivery constructs for that private callback. The private
registrar copies exactly these five bounded leaves from the connector event:

```text
channelNamespace = "feishu"
channelConversationId
feishuConversationId
feishuMessageId
feishuSenderOpenId
```

`feishuSenderOpenId` MUST originate from typed raw
`ingress.raw.sender.sender_id.open_id`, be a nonempty `ou_` OpenID, and exactly
equal normalized `ingress.sender.openId`. The raw field, normalized field and
message ID must be nonempty strings under fixed tested UTF-8 byte caps;
`feishuMessageId` is at most 128 UTF-8 bytes, matching the readback selector.
The remaining leaves must have explicit fixed caps at most 256 UTF-8 bytes each
and fit the existing V3 per-record/global byte caps. Missing, malformed,
non-Feishu, wrong-type or mismatched identity rejects the trusted path **before
mint or prompt bytes**. No `union_id`, `user_id`, normalized `senderId`, prompt,
caller correlation, caller-supplied context, prototype field or fallback may
repair missing raw OpenID evidence.

The default AgentProcess receives only a lookup closure at construction. At
mint, `runPromptExecution` obtains `ingressCorrelation` through that closure
using the exact `opts` identity and ignores `opts.ingressContext` as durable
provenance. Route-chain and the bounded process queue retain the same object
identity. If a future clone breaks that identity, correlation is absent or the
trusted ingress fails closed; raw context never becomes a fallback. Ordered
route fallback can mint multiple attempts, each with its own record; downstream
selection treats multiple matching records as ambiguous.

Scheduler, `deliver`, mobile, public Router calls and other prompt producers
continue to mint ordinary records with `ingressCorrelation=null`. Existing
`callerCorrelation` and its index remain independent. No second store, index or
caller-controlled trust marker is introduced.

## 3. Durable record and native receipt

The five-leaf object is written once with the C-010 reservation, before prompt
bytes. V3 validator, serialization, metadata, byte accounting and caps include
it. Older V3 records with no field remain valid and read as `null`; unknown
fields and malformed non-null correlation fail closed. Later mutation cannot
replace the five leaves or relabel the same handle.

The existing native prompt receipt attaches to the same V3 record as
`record.messageId`. It is not derived from the ingress message ID, reply text,
logs or a caller assertion. A null/missing native `record.messageId` is an
explicit absent receipt, never PASS. No new Agent turn is admitted to obtain
cleaner evidence; UNKNOWN and no-replay remain.

## 4. Fixed protected read and hash-only evidence receipt

The proposed action is `ROUTER_INGRESS_RECEIPT_READBACK_V1` on the existing DS
owner-UID/root Unix socket. This is a **new** protected-content read and
root-owned receipt write. It is not installed or authorized for production by
this proposed Spec or the earlier coherent operation mandate.

The strict request contains exactly:

```text
action = ROUTER_INGRESS_RECEIPT_READBACK_V1
operation_id = one fresh exact readback ID, distinct from all four preserved
               coherent production operation IDs
feishu_message_id = nonempty UTF-8 string, at most 128 bytes
```

Unknown keys, caller-selected path/unit/Agent/principal, caller-provided store
digest, raw record query, arbitrary shell and alternate socket peer are denied.
DS computes `request_sha256` from the canonical exact request and
`selector_sha256` from canonical
`{channelNamespace:"feishu",feishuMessageId:<requested ID>}`. The message ID
must come from independent attributable Owner/Feishu platform evidence; it is
a selector, not sender proof.

DS reuses the fixed `ROUTER_DURABLE_SUMMARY` safe path traversal, `O_NOFOLLOW`,
owner/group/mode/size checks, pinned validator/parser bytes and same-fd bounded
pre/post digest. It verifies the fixed path and ancestors again after the read.
It parses and validates the complete V3 store on that same descriptor. It scans
**all** bounded records (existing global cap 8192) for exact Feishu namespace
and message ID before comparing the fixed `agentId=agt_efficiency-agent`.
Zero matches, two or more matches including across Agents, wrong Agent,
malformed input, metadata drift or store digest drift produce no accepted
selected handle. No Router store or service mutation occurs.

For one globally unique matching fixed-Agent record, the redacted projection
contains only the exact `turnExecutionId`, record state, Agent ID, Session ID,
SHA-256 of stored ingress message ID, SHA-256 of the authenticated raw sender
OpenID, `native_prompt_receipt_present`, and, only when present,
`native_receipt_sha256=SHA256(UTF-8 exact record.messageId)`. DS first compares
the stored ingress message ID with the request; it never hashes a request value
as if it were a stored value. The bounded response is at most 1024 bytes and
contains no full Feishu ID, raw sender, prompt, output or store body.

Under the existing DS receipt-root serialization, DS reserves the fresh
readback ID with a hash-only INTENT **before** the protected query. INTENT binds
`operation_id`, action, `request_sha256` and DS-computed `selector_sha256`.
DS then atomically publishes one terminal COMPLETE/FAIL receipt containing
verified `store_sha256`, result/projection SHA and terminal state. The exact
redacted response is bound to that root-owned receipt. Full message/sender IDs
and prompt contents never enter the receipt or DS logs. Duplicate IDs and a
crash/UNKNOWN after INTENT remain consumed; no replay, second terminal receipt
or guessed fresh ID is permitted. Semantic projection may be repeated only
under a separately frozen fresh ID and otherwise unchanged verified store.

The assigned Deployment Agent durably binds the canonical request SHA and
returned DS receipt SHA, then compares the selector digest to independent
Owner/Feishu message evidence, the sender digest to independent authenticated
Owner binding, and the native receipt digest to the exact selected V3 record.
A caller assertion, aggregate count, health 200 or redacted response alone
cannot establish message, sender, turn or receipt attribution.

## 5. Acceptance and stop conditions

Focused RED→GREEN tests and affected regressions must prove:

- forged frozen public context, lookalike Symbol/boolean/prototype key and
  cloned `opts` never yield durable trusted correlation;
- the admitted private SDK/PolicyGate callback stores the exact five leaves
  before prompt bytes, including queue delay and ordered fallback cases;
- missing/raw non-OpenID sender, normalized fallback, mismatched sender or
  malformed message ID fails before mint/prompt; legacy V3 records remain valid;
- same-fd metadata/digest/path drift, symlinks and malformed store fail closed;
- global duplicate detection precedes the fixed-Agent check; zero, wrong-Agent
  and multiple matches produce no accepted handle;
- native receipt digest uses only `record.messageId`, and absent receipt never
  becomes a synthetic receipt;
- unauthorized socket peers, extra request fields, raw-output leaks,
  duplicate/crash-cut readback IDs and receipt digest relabeling fail closed;
- `ROUTER_DURABLE_SUMMARY`, V3 store/fence, DS deploy/capture/admit/rollback
  and existing Lark ingress behavior retain their accepted contracts.

An independent affected-surface security review must inspect the exact
producer, V3 store/validator, fixed DS parser/action/client and receipt bytes.
Only an accepted/merged amendment can become implementation authority. Actual
production use additionally needs a reviewed digest-bound DS_UPDATE, current
protected-store/parser pins, exact authorized socket peer and executor, fresh
readback ID, fresh live/rollback/lock binding, separate production operation
authority, and one attributable real Owner smoke. UNKNOWN stops without replay.

The accepted coherent composition, four frozen deployment operation IDs,
frozen package, rollback and per-Goal business acceptance are unchanged. This
amendment neither grants Mobile Session History deployment credit nor turns a
Router byte overlap into controlled restart or HR recovery proof.
