# Owned dispatch status: amendment authoring Brief

This record describes a **proposed docs-only ASM V2 amendment**. It is not an
acceptance act, implementation result, new dispatch authority, or a9 launch
authorization.

## DEVELOPMENT_PREFLIGHT

```text
DATE = 2026-10-27
REPOSITORY = mayf3/dsh-agent-core
BASE = c1cbd7506ca58c0abace216e651e1cceb98e030d
BRANCH = codex/owned-dispatch-status-spec-20261027
WORKTREE = /Users/yanfenma/workspace/worktrees/codex-owned-dispatch-status-spec-20261027
SPEC_GOVERNANCE_MODE = AUTHOR
AUTHORITY_ACTION = AMEND
PRIMARY_AUTHORITY = AGENT_CORE_AGENT_SESSION_MESSAGING_V2 accepted r4
TARGET_AMENDMENT = ASM2-OWNED-DISPATCH-STATUS-20261027
AUTHORITY_OWNERSHIP = resolved: existing owned-dispatch trace read Decisions
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = CONTROLLED
ROUTE_STAGE = AUTHORITY_AUTHORING
AUTHORITY_ACCEPTED_IN_BASE = NO for new amendment; YES for r4 baseline
DOCS_FIRST_REQUIRED = YES
IMPLEMENTATION_ALLOWED = NO
PRODUCTION_APPLY_AUTHORITY = none
PARTIAL_SUPERSESSION = NONE
OPEN_OWNER_DECISIONS = exact-head acceptance after independent review
NORMATIVE_TBD = NONE
```

**Execution mandate:** in the current delegated task, the root coordinator
explicitly directed this author to create an isolated docs-only branch from
`c1cbd750`, amend ASM V2 within its existing owned-trace Decisions, preserve the
accepted baseline, and submit an exact local commit for independent review.
Allowed effects are only this Spec proposal, its Brief and a local docs commit.
Implementation, self-acceptance, push, main merge, production/configuration writes,
model/role messages, and changes to frozen a8 or earlier runs are forbidden.

**Goal/current gap:** ordinary coordination needs to distinguish pending,
completed and failed exact dispatched turns without repeatedly loading visible
tool transcripts. Existing accepted full inspection is authorized and useful,
but has no compact status operation. The current task is done when the additive
proposal, its acceptance mapping and exact docs candidate are reviewable. Any
required change to an existing Contract, new permission, dispatch engine or
authoritative ledger triggers re-preflight; optional hardening does not expand
this task.

## Authority route and unchanged scope

The repository grammar and `.agents/local/README.md` select the AUTHOR route
under accepted `AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V3`. The protocol's AMEND
case covers strictly additive Contract IDs within unchanged scope, owner and
bounded Decision identity. ASM V2 DEC-ASM2-001–004 already own the exact message
coordinate, independent read permission, bounded turn projection and separation
of observation from delivery recovery. Its CTR-ASM2-010–016 and rejected
ALT-ASM2-001–007 constrain the new operation directly.

Accordingly the chosen route is **AMEND in the same Spec**, not a second status
Spec or parallel authority. Changing the old inspector to return less data or
accept a new summary flag would change its closed contract and is rejected here.
Exposing infrastructure-only send reconciliation as a model tool is also rejected:
that is a different question, with different authority and ephemeral correlations.

The added capability uses the existing inspect-own-dispatch scope. No send grant
implies read authority. No permission widening, new Grant, identity inheritance,
durable index, retry or workflow semantic is proposed. Lifecycle V4 C-015/C-016
still govern the separate Router terminal/recovery classifier; fixing its
aborted-as-success bug is a separate REUSE implementation lane. This reader uses
the native exact terminal event and cannot depend on that incorrect label.

## Evidence and minimum design

The following local public-only records are retained under
`/Users/yanfenma/workspace/artifacts/workflow-unattended-mechanisms-20261027/`:

| Record | SHA-256 | Supported fact and limit |
|---|---|---|
| `a8-hr-turn7-public-metadata-analysis.json` | `169e66c682dc27f68d998770c8e12b0f567c5216e0a5bf4c5fd61720f70c7bb5` | Full inspections were 60,841 / 93,944 / 34,097 bytes. A later 53,408-byte write argument remained incomplete; no actual write is claimed. Input volume causing that behavior remains unproven. |
| `a8-native-terminal-independent-review.json` | `aa8aed3acda722ea7200d1c75d28f265e3ae80ef4f1e90820b114489663671d1` | Exact hard-deadline shutdown, raw aborted/disposed and actual owned exits; process exit zero is not business completion. |

These are one-run observations, not a long-term weak-model reliability result.
The original file hashes/source coordinates and sampling limits are in each
record. No hidden reasoning or credential material is an input to this proposal.

The new `agent_session_dispatch_status`, operation `status`, takes the same three
exact trace coordinates and uses the same canonical ownership reader. Its result
is at most 4,096 UTF-8 bytes, with no body or tool metadata. Native state, times,
typed terminal reason and a last-visible-message sequence reference are enough
for ordinary coordination. A reference does not prove delivery or business PASS.
Full inspection remains explicit when an actual visible original is needed.

The source seams at this base are
`packages/production-runtime/src/agent-session/turn-inspection.js` (authorized
audit eligibility, canonical locator, bounded parser and exact sequence reader)
and `packages/broker/src/capabilities/agent-session-messaging.js` (LOCAL manifest,
scope and relay contract). They are read-only authoring references, not evidence
that the new capability is implemented. A later implementation can factor common
read/selection logic without constructing the full transcript result for status.
Old inspector fixtures must retain byte-equivalent behavior.

The 8 MiB whole-Session source cap remains a real long-running limit: once that
retained source exceeds the accepted bound, even a tiny status response is
unavailable. This proposal bounds returned coordination data; it does not add
retention, archive search, compaction or a persistent status index to bypass the
existing read limit, and does not establish indefinite unattended operation.

## Proposed a9 fixture: remove transcript bookkeeping from the model

This is a prospective task fixture design, not a normative new ledger, a helper
implementation, an autonomous dispatcher, or permission to launch a trial.

**Selected minimum: read existing receipts.** The isolated harness already owns a
Broker public journal and ASM send audit. A small read-only fixture helper can
derive the caller's exact proven-delivery trace coordinates from those existing
typed records, so HR need not rewrite a JSON file containing transcripts. The
helper must be implemented and tested separately before claiming this path is
available. It accepts only the fixed run and trusted fixture caller binding, not
an arbitrary home or actor. It emits at most eight entries and 8,192 UTF-8 bytes
per query, using explicit source record coordinates; an explicit cursor may
continue only that caller's existing journal. A scan cap or partial/unavailable
source yields `INCOMPLETE`/`UNKNOWN`, not a claim of no sends. No broad production
audit access or new model capability is authorized by this fixture suggestion.

Only the exact join of typed call/result correlation, caller, capability and
proven returned target/session/message is eligible. A timeout reply can still
have proven delivery; an unknown mutation cannot acquire a coordinate by text
guessing. The small entry contains caller, target, Session, message and source
call/result record coordinates, the recorded source-call start time (not an
inferred native-turn start), and the literal recorded send-result flag (not a
new outcome classification). **Workflow instance/nodeVisit binding remains
UNKNOWN unless a typed authoritative record proves that relationship.** Do not
parse prose, infer nearest timestamps, carry a current visit backward over an old
send, or select the first plausible target. The helper cannot choose a business
exit, retry, message, or update any state. Existing authoritative workflow reads
remain necessary for current business coordinates and verdicts.

**Deferred alternative, not selected for a9:** retain a single-writer
task note of small coordinates supplied at dispatch time, not an authoritative
ledger. Use a task-owned append helper with a closed record of at most 1,024
UTF-8 bytes, a fixed regular-file path, no symlink traversal, serialized
single-writer access, one `O_APPEND` write and checked byte count followed by
`fsync`. It must not accept bodies/transcripts or rewrite the whole file. This is
one-record append isolation against cooperating writers, **not a power-loss or
arbitrary-writer atomicity guarantee**. An incomplete tail, short write or unknown
append outcome is reported explicitly; never truncate/repair/retry silently.
Read authoritative receipts before using a note; the note grants no resend,
completion or workflow permission. A field that cannot be proved is UNKNOWN.
No new dispatch ID, claim, lease, consumption key or runtime recovery state is
created. This fallback is narrower but has model-input limitations; do not call
it a fully automatic binding mechanism.

For a fresh a9, freeze the tested read-only existing-journal helper before the
single HR trigger. Insufficient typed joins remain UNKNOWN and do not silently
activate the deferred append alternative. HR polls the new compact
status for its own known traces, consults original content only for a concrete
review need, and ends each bounded coordination turn while the native goal remains
active. It never treats `available` or completed turn status as a workflow verdict.
There is no model-authored whole-ledger rewrite. Correction budgets in the role
policy remain policy, not runtime enforcement. In particular the per-visit
correction-count binding gap remains UNKNOWN; the helper does not solve it.
No root per-node rescue is allowed
after cutoff. Stage-specific evidence is evaluated only when the existing node
Contract requires it; future deployment/whole-flow proof is not a prerequisite
for an earlier review or merge node.

A9's external verifier, not a model note, must report both workflow terminal
states, actual node submissions/visits, genuine native continuation/peer receipts,
no post-cutoff human steering, bounded status/note bytes, and actual process/tool
termination where required. A stopped or paused run remains incomplete even if
all owned processes exit zero. A9 has not been run by this authoring task.

## Validation mapping and stop boundary

| New Contract | Required acceptance | Authoring status |
|---|---|---|
| CTR-ASM2-018 capability/input/scope | ACC-ASM2-008, 012, 013 | Test definition only |
| CTR-ASM2-019 exact authorized read | ACC-ASM2-009, 011, 013 | Test definition only |
| CTR-ASM2-020 terminal truth | ACC-ASM2-010, 013 | Test definition only |
| CTR-ASM2-021 compact result/reply ref | ACC-ASM2-010, 011, 013 | Test definition only |
| CTR-ASM2-022 errors/non-effects/compatibility | ACC-ASM2-008, 009, 011, 012, 013 | Test definition only |
| CTR-ASM2-023 implementation boundary | ACC-ASM2-012, 013 | Test definition only |

The docs candidate is checked for exact r4 reconstruction after removing only
the proposed frontmatter block and appended §14, unique new IDs, six Contracts
with complete acceptance mapping, grammar integrity and docs-only diff. These
checks cannot establish product conformance. Product tests, integration
callability, a9 and production checks are **NOT_RUN / NOT_AUTHORIZED here**.
Independent review considers only this additive authority delta and its direct
dependencies. A PASS is readiness for the delegated maintainer's acceptance
consideration, not acceptance itself. Stop after providing the clean local
candidate and recorded checks to the root coordinator; do not push or merge.

## Executed authoring checks

On the docs-only working tree, `git diff --check` and
`python3 .agents/tools/verify_governance.py --target .` returned actual exit 0;
the latter reported that vendored governance bytes match `governance.lock.json`.
A Python byte check removed exactly the added `proposed_amendment` frontmatter
block and appended §14 and reconstructed all 56,320 baseline bytes with SHA-256
`6c0e7dda3c9ecac37ceafcce7868c8f10e0b54df59f6551428a3902dcbc924a8`.
It also verified six unique new CTR headings and six unique new ACC headings,
and fresh-hashed the two evidence originals to the values above. These are
authoring checks only; no product test, model call or a9 execution occurred.
