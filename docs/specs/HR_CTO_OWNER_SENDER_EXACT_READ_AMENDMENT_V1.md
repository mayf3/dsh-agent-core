---
spec_id: HR_CTO_OWNER_SENDER_EXACT_READ_AMENDMENT_V1
status: proposed
type: child amendment (spec-only; docs-only)
spec_kind: narrow_implementation_amendment
authority_level: governing_spec
implementation_authority: none
production_apply_authority: none
owners: [mayf3]
date: 2026-09-28
authoring_base_main: ac0f0582400870edac40bf32e160d70e9ef286de
amends:
  - COHERENT_DURABLE_INGRESS_RECEIPT_ATTRIBUTION_V1
  - HR_FIXED_ORIGINAL_EXECUTOR_QUALIFICATION_PHASE_V1
parent_status: accepted
supersedes_parent: false
governed_by:
  - COHERENT_DURABLE_INGRESS_RECEIPT_ATTRIBUTION_V1
  - HR_FIXED_ORIGINAL_EXECUTOR_QUALIFICATION_PHASE_V1
  - HR_FIXED_CAUSAL_QUALIFICATION_EVENT_SEAM_V1
  - PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1
external_authorities:
  - /Users/yanfenma/workspace/artifacts/DEPLOYMENT_BACKLOG/HR-CTO-OWNER-SENDER-EXACT-READ-DECISION-20260928-v1/DECISION.md
  - /Users/yanfenma/workspace/artifacts/DEPLOYMENT_BACKLOG/HR-CTO-OWNER-SENDER-READBACK-OWNER-ACCEPTANCE-20260928-v1/ACCEPTANCE.json
supersedes: []
superseded_by: null
scope:
  - one pre-START Owner-authored Feishu identity seed addressed to agt_cto-agent
  - one fixed CTO exact-message hash-only protected read under existing DS custody
  - binding the resulting authenticated sender hash before the existing qualification START
---

# HR CTO Owner sender exact-read child amendment V1

This is a **proposed, docs-only child amendment**. The two accepted parent Specs
remain byte-unchanged and current. It adds one CTO-only identity-binding case to
the accepted coherent ingress mechanism and clarifies QF-C03/C04 ordering. It
does not retarget or generalize the existing efficiency-Agent readback.

The Owner separately accepted one narrow DS update and one protected read in
`ACCEPTANCE.json` SHA-256
`08613548fa1e1966c49a813359ee3bf3dff903c0848035bfa2c42935d6728219`,
bound to `DECISION.md` SHA-256
`41c537addb2692832d1ef47aa1e37def417a499d6d394130f0908b82d3397513`.
That acceptance is conditional on the decision's independent review, exact
preimage/rollback/lock, eligible subject and verified native message ID. Its
`exactNativeMessageId` was `null` at authoring. The acceptance is not an
independent review or lifecycle acceptance of this Spec. This draft grants no
implementation, DS update, live read, startup or recovery authority.

## 1. Amendment relation and frozen boundaries

The coherent parent already defines private authenticated Feishu ingress,
write-once V3 `ingressCorrelation`, and a fixed
`ROUTER_INGRESS_RECEIPT_READBACK_V1` whose Agent is
`agt_efficiency-agent`. That action and its accepted request, validator,
response and receipt contract remain unchanged. Its accepted parent file at
`authoring_base_main` has SHA-256
`2d3b2b88f1caf9587a3e5549b0e99490925178420cfb9767a18979147839c0a8`.

QF-C03/C04 already require legitimate attributable Owner delivery and actual
native/Broker completion during the original separately owned qualification.
This amendment adds a distinct **pre-START identity seed**; it is not one of the
three later completed CTO proof turns. The accepted qualification parent file
at `authoring_base_main` has SHA-256
`2769a869fdc7980a3565c3770e29bb35ffac9a62760587971627b7feac3e2dd1`.
QE-C01, the four existing proof publications, existing HR recovery controls,
and MI-C07 H6 remain unchanged.

The fixed postrestore HR carrier is currently `OWNER_SENDER_SHA=None` and
`executableNow=false`. Its missing identity input cannot be supplied by its
own observer, because that observer runs only after START. The seed resolves
only that ordering cycle; it grants no H2/H3/H4/H5/H6 credit.

## 2. Contracts

**OCB-C01 — One independently identified Owner seed.** The sole eligible
selector is the native Feishu message ID of the new human Owner-authored
message sent through official Feishu to `agt_cto-agent` **before** qualification
START. The Owner's attributable statement identifies the exact seed text as
`HR recovery identity seed 2026-09-28` and binds the supplied deep-link
digest in the acceptance record. An official Feishu UI or platform receipt
must independently resolve that link to the exact native message ID and verify
the target and seed; the opaque link token, its digest, message text, timestamp,
nickname, chat ID, caller assertion, other-Agent message or an inferred ID is
not the selector. Authorship is the Owner's attributable statement joined to
that exact official message; the ID alone does not prove who typed it. If this
join is unavailable or ambiguous, no DS update/read or START follows. The
native ID is frozen in the separately reviewed one-off operation packet, not
written into this Spec; the raw deep-link token is never copied into the
packet, receipt or logs.

**OCB-C02 — Fixed CTO DS action and request.** A distinct
`HR_CTO_OWNER_SENDER_HASH_READBACK_V1` action may be added only to the existing
persistent UID502 Deployment System, admitted through its existing
`getpeereid` caller and root receipt custody. The strict request contains
exactly `action`, one frozen fresh `operation_id`, and the independently
verified `feishu_message_id` (nonempty UTF-8, at most 128 bytes). The ID is
different from coherent deployment IDs, the efficiency readback IDs, the HR
qualification ID and the HR recovery ID. No caller-selected Agent, store path,
principal, UID, executable, command, credential, digest, socket peer or fallback
sudo is accepted. There is no generic DS query or second store interface.
The authenticated Feishu producer, V3 record schema/validator, Router,
connector and existing efficiency-Agent action are not changed by this
amendment.

**OCB-C03 — Exact authenticated record and fail-closed read.** The fixed
protected V3 store is opened and completely validated through the existing
same-descriptor, no-follow, bounded parser/metadata/digest/ancestor checks,
with store access as Runtime uid505 under DS custody. The action scans the
bounded complete record set for the exact authenticated Feishu namespace and
stored message ID, proves global uniqueness before the fixed
`agentId=agt_cto-agent` check, and requires the write-once authenticated
`ingressCorrelation.feishuSenderOpenId` and same-record native
`record.messageId`. Zero/multiple matches, another Agent, absent/malformed
correlation or native receipt, parser uncertainty, path/metadata/content drift
or loss of DS custody fail without an accepted sender binding. Validation may
inspect the complete store internally; only the selected CTO record may be
projected. No other Agent or old HR s256 record is projected, summarized or
logged. The read never mutates the store, fence, old execution or runtime.

**OCB-C04 — Hash-only root receipt and Owner binding.** The only selected
record data published to the fixed caller are `sender_openid_sha256` from the
stored authenticated sender OpenId, `feishu_message_id_sha256` from the stored
Feishu message ID, and `native_receipt_sha256` from the same record's native
prompt receipt `record.messageId`. Each digest is lowercase hexadecimal
SHA-256 of the exact stored UTF-8 string. DS
checks the stored message ID against the verified request before hashing it.
Its root-owned bounded INTENT/terminal receipt binds a SHA-256 commitment to
the canonical exact request, fixed action/Agent, one-use operation ID and those
three digests; selector/receipt integrity hashes may exist as root-held receipt
metadata, not as additional record projections. No raw OpenId, raw message ID
in a response/receipt/log, link token, message content, credential, store body,
turn content or arbitrary record field leaves the protected boundary. Only
after the exact official-ID/Owner-statement join and independently reviewed
terminal receipt may the returned sender digest become `OWNER_SENDER_SHA` in
the existing fixed HR carrier before START. A digest alone is not Owner proof.

**OCB-C05 — One-use admission and installation.** The original DS writer must
prepare the fixed action and one exact DS update for independent changed-surface
source and operation review. Before effect, freeze the final source/artifact,
operation IDs and eligible subject; freshly prove the existing DS version,
caller, protected-store/parser pins, exact current preimage, rollback and
production lock/custody. Preserve the previous DS version and all unrelated
actions/permissions. Reserve a root-held INTENT before the protected read;
COMPLETE/FAIL/UNKNOWN consumes the read ID, and crash or uncertain result never
permits replay or a guessed new ID. A second read under any ID needs a new
Owner decision; a failed/UNKNOWN DS update also consumes its own operation ID.
A failed/UNKNOWN update or read leaves the
HR fence and old operation unchanged and cannot authorize START. The DS update
does not restart Agent runtime or mutate the V3 store.

**OCB-C06 — Qualification and H6 separation.** The seed is identity-only,
regardless of whether it elicited a CTO reply. QF-C03/C04 still require three
separate legitimate Owner-authored CTO messages **after** START with actual
same-Agent native/Broker turn completion under the original proof executor.
Those turns use the authenticated sender digest bound by OCB-C04 and the
existing causal/floor/validator requirements. The later H6 requires one
genuinely NEW HR request after recovery and remains a separate acceptance
condition. Neither the seed nor those proof turns settle or replay the old
s256 `outcome_unknown` execution, clear a fence, or establish business outcome.

## 3. Rejected substitutions and acceptance

The accepted coherent parent already rejects public/frozen ingress context,
normalized sender fallback, aggregate summary, raw store/log read and
caller-supplied digest. This amendment additionally rejects reusing the
efficiency-Agent action for CTO, treating a Feishu deep-link token as a native
message ID, an in-window seed that depends on START, sender inference from
nickname/chat ID, and any sender hash taken from a different Agent or record.
No rejected alternative is reopened.

| Case | Required evidence | Reject when |
|---|---|---|
| OCB-A01 | Attributable Owner statement, independently resolved native Feishu ID, exact CTO target and pre-START seed; no token copied to the packet | missing/ambiguous ID, wrong message/target, token or nickname used as ID/identity |
| OCB-A02 | Fixed request/peer/one-use ID and unchanged efficiency readback; unknown-key and caller/path/Agent injection negatives | generic query, retargeted existing action or changed caller admitted |
| OCB-A03 | Same-fd full-store validation, global duplicate and wrong-Agent negatives, authenticated OpenId and same-record native receipt | wrong/absent/duplicate record, path/store drift or another record projected |
| OCB-A04 | Exact three selected-record digests in bounded root receipt and no raw/protected output; INTENT-before-read and crash-cut tests | raw content leak, request ID hashed as stored ID, absent receipt promoted or ID replayed |
| OCB-A05 | Confined sequence: seed binding precedes START; three later turns and H6 remain disjoint; old s256/fence unchanged | seed credited as proof/H6, synthetic turn completion, old execution replay or premature recovery |

Tests and fixtures are future nonproduction implementation evidence only. They
are not an official Feishu identity receipt, current DS preimage, live store
readback, production authorization or qualification proof.

## 4. Lifecycle and review gate

Only this child Spec and its index entry are authored here. Both accepted
parents remain byte-identical; there is no whole-Spec supersession. An
independent reviewer must examine the exact final head and Spec SHA-256 against
the two accepted parents, the Owner decision/acceptance hashes, the fixed
DS/Runtime trust boundary, the seed/proof/H6 separation and the absence of any
raw link token or source/production change. A separate explicit lifecycle
acceptance and docs-first merge must precede implementation. Even after that
merge, the Owner's one-off external acceptance and every OCB-C01/C05 gate are
required before any DS update or protected read. No step in this draft proves
the native message ID or authorizes HR startup or recovery.
