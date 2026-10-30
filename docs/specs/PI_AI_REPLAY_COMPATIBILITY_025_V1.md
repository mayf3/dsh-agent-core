---
spec_id: PI_AI_REPLAY_COMPATIBILITY_025_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
scope:
  - Agent Core acceptance of replay-compatible harness and Codex 0.2.5 integration candidates
governed_by:
  - AGENT_CORE_PRODUCT_ARCHITECTURE_V1
external_authorities: []
supersedes: []
superseded_by: null
owners: [mayf3]
date: 2026-10-31
---

# pi-ai replay compatibility for the 0.2.5 integration

## 1. Goal

Make affected Agent Core session histories resume without rewriting or rotating
their durable files. Preserve provider replay metadata and exact unknown-event
rejection. This is a proposed integration Spec, not an accepted authority or repair.

## 2. Scope and non-goals

Scope is Agent Core's acceptance of a harness/Codex 0.2.5 candidate for the two
compatibility defects reported in agent-control#1249. The target source must be
bound and reproduced before selecting a repair. No production deployment,
runtime/plugin restart, real session inspection, session rewrite/rotation,
credential/config mutation, UNKNOWN replay, format v3 or other release is allowed.
Original tags and unrelated 0.2.6 work remain untouched.

## 3. Authority and dependencies

The parent Architecture keeps Agent Core thin and assigns the session engine,
persistence and replay implementation to DSH. This Spec governs only Core's
integration acceptance; it cannot authorize code or supersede policy in
`mayf3/deepseek-harness` or `mayf3/dsh-openai-codex`. External source changes must
satisfy their owning repository's governance and attributable Owner mandate.
No external accepted authority has been established, hence the empty
`external_authorities` list; source commits below are evidence, not authority.

The current local V3 adoption permits bounded NEW/AMEND + ROUTINE/DURABLE atomic
Spec-and-code work. The user's AGENTS instruction for this task is stricter:
no implementation without an accepted Spec. Follow that instruction docs-first.
The implementation agent must not accept or merge its own proposal. Acceptance
by mayf3 or an explicitly delegated maintainer, and merge into the authority base,
must precede a separate implementation change. This proposal does not amend
AGENT_DELIVERY_RESILIENCE_V1 or its explicit exclusion of web-search poisoning.

References: agent-control#1249; dsh-agent-core#548/#550; deepseek-harness PR #4.
These issue/PR records supply requirements and evidence, not Product Authority.

## 4. Current State

`STATE-001`: at Core base `20e60dd72a42a0ef69e0acb8516b15c1893ffb01`, in isolated
source/probe environments observed 2026-10-30T21:56:49Z through 22:02:59Z, the
inspected source accepts wrapped v2. No incident-to-candidate failing conversion,
production-loaded version or fleet recovery is established. Basis: OBS-001,
OBS-002 and CLM-001; provenance is the linked investigation/evidence below.

| Repository | Exact source revision | Meaning |
|---|---|---|
| dsh-agent-core | `20e60dd72a42a0ef69e0acb8516b15c1893ffb01` | Fresh remote main; integration/evidence repository |
| deepseek-harness | `c211b445593fa5639075dc690801a3a3005ca0dd` | Existing exact Codex web-event fix included |
| dsh-codex | `e3e54e206f7c829503c7e6eed378643ba0416792` | Existing v0.2.5; pi-ai adapter lock 0.1.0-rc.7 |

## 5. Observations

`OBS-001`: fixed source reads at the tuple above, captured at
2026-10-30T21:56:49.905946Z, show the harness reader accesses `envelope.response`
and the plugin migrates flat v1 to wrapped v2. It does not transform wrapped v2
into invalid `response.kind`. Method/provenance: eight actual git-show captures
in [source-capture.json](../evidence/pi-ai-replay-1249-20261031/checks/source-capture.json).

`OBS-002`: the public npm rc.7 tarball's computed SHA512 matches registry and
v0.2.5 lock integrity; six public-class synthetic cases return rc0. Valid wrapped
v2 reaches the fake provider with native metadata. Raw flat v1/v2 degrade
explicitly to `dsh-foreign`. Provenance: [publication-probe](../evidence/pi-ai-replay-1249-20261031/publication-probe/probe-results.json)
and its command/integrity receipts. Root and independent reviewer repeated the
bounded observations by 2026-10-30T22:02:59Z. Available peers include two rc.8
packages; no complete plugin/lock closure or persistent restart was exercised.

## 6. Claims and assumptions

`CLM-001` — SUPPORTED by EVD-001: the observed tuple contradicts a universal
claim that valid wrapped v2 necessarily fails in this reader. It does not refute
the historical incident or identify its deployed reader.

`CLM-002` — OPEN_ASSUMPTION: the incident's 1,940 files all contain valid supported
records and have no other recovery blockers. This is not an acceptance premise;
no fleet claim may depend on it. No real session read is authorized to resolve it.

## 7. Evidence relations

`EVD-001`: sources OBS-001/OBS-002 SUPPORT CLM-001 and STATE-001 at the source
commits, public tarball and synthetic environment above. Sufficient only for
these conversion observations; insufficient for the incident's loaded version,
full dependency closure, restart persistence or actual fleet recovery. Provenance:
[fixed investigation](../investigations/PI_AI_REPLAY_1249_SOURCE_BINDING_20261031.md)
and the committed evidence manifest. No conformance to future accepted Contracts
is implied by these observations.

## 8. Decisions

`DEC-001` — Proposal for mayf3's acceptance: normalize known historical records
at the reproducing provider-owned read/restore conversion, retaining the current
in-memory envelope and validation. Do not invent a new disk format or durable
fleet migration. If no candidate failure reproduces, deliver the mismatch rather
than a redundant repair. Alternatives ALT-001/ALT-002 explain this selection.

`DEC-002` — Proposal for mayf3's acceptance: reuse harness PR #4's exact event
registration and unknown-event rejection. Do not redo its passed source repair.
Source acceptance, release installation and business acceptance remain distinct.

## 9. Contracts

**CTR-001 — Bind the target before editing.** Record exact candidate harness and
plugin source commits, published dependency integrity, and reader behavior using
only synthetic records. Identify the first function that changes a valid replay
envelope and demonstrate the resulting invalid `response.kind`. A test that is
already green is evidence of compatibility, not a RED reproduction. If no such
conversion exists in the candidate, report the incident-to-candidate mismatch;
do not manufacture a failing transformation or add a redundant repair.

**CTR-002 — Preserve known historical replay fidelity.** For the exact candidate
that reproduces CTR-001, the smallest provider-owned read/restore normalization
must accept the incident's valid wrapped v2 and flat v2 records and the source's
documented flat v1 record. Normalize only recognized versions and kinds to the
candidate's existing in-memory envelope. The current inspected candidate uses
wrapped v2; this Spec does not mandate a flat disk representation. Preserve block
alignment, response/model identity, signatures and redaction metadata. Do not
mutate input records or write migration results to the durable session log.

**CTR-003 — Preserve validation.** Wrong kind, unknown version, malformed fields,
provider/model mismatch and block mismatch must never become trusted native
pi-ai replay. Keep the existing reader validation and explicit diagnostic/fallback
policy; do not add a catch-all that suppresses arbitrary errors. In the inspected
harness, `readReplayState` rejects invalid state and `toPiAssistant` explicitly
degrades only `INVALID_REPLAY_STATE` to provider-neutral history. This proposal
does not replace that existing behavior with whole-turn rejection. Any request
to change that policy requires a separate accepted amendment.

**CTR-004 — Reuse the existing telemetry fix.** Carry the exact registration of
`web/openai-codex-search-llm-request` from harness PR #4 into the candidate; do not
reimplement its passed fix. Existing unmarked events must load through that
registration. Unknown non-ignorable semantic events must still reject loading;
no wildcard `web/*` ignore. Resolve duplicate TypeScript module declarations only
if mechanically required to type-check the 0.2.5 candidate. Do not change unrelated
search behavior or transport retries.

**CTR-005 — Prove restart behavior.** Use the existing Vitest framework and
synthetic JSONL sessions to prove a fresh loader can restore historical messages,
reach a fake model-call boundary, and preserve event order/sequence and business
message count. Repeated restart/loading must not duplicate messages. Record
empty child HOME/DSH_HOME paths, command argv, rc, stdout and stderr; do not use
real identities, credentials, sessions or model endpoints.

**CTR-006 — Evidence and release limits.** Record RED before implementation and
GREEN on the identical tests after the minimal change, plus all existing relevant
package suites and any named baseline failures. Review the exact source head
with a non-author, using `SPEC_GOVERNANCE_MODE=REVIEW` and
`REVIEW_KIND=AFFECTED_CONTRACT`. Product `SPEC_GATE` remains FAIL until this Spec
is accepted and merged. Do not modify an accepted governing Spec in its own
implementation change. Keep original tags and existing 0.2.6 work untouched;
identify any 0.2.5 integration candidate by its exact commit and artifact hash.


## 10. Acceptance

Every row runs in isolated, synthetic nonproduction test identities. Record exact
source/Spec revisions, environment, command argv, rc, stdout and stderr. All six
Contracts have explicit reverse mappings below; observed compatibility without a
repair does not satisfy the original task's RED-to-GREEN completion definition.

| Acceptance / Contracts | Method / required evidence | Expected result / failure condition |
|---|---|---|
| ACC-001 / CTR-001 | Bind source/publication tuple and trace a synthetic existing-history request | Exact failing conversion RED, or explicit already-compatible mismatch with no repair claim; fabricated RED or unbound target fails |
| ACC-002 / CTR-002 | Identical historical/current records before/after minimal repair in existing Vitest | Native response IDs, signatures, redaction and identity retained; source bytes unchanged; metadata loss/input mutation fails |
| ACC-003 / CTR-003 | Wrong-kind/version/fields/provider/model/block negative matrix | Existing reader rejection and explicit fallback policy retained; invalid native trust or blanket catch fails |
| ACC-004 / CTR-004, CTR-005 | Reuse five Codex event tests and add fresh-loader JSONL/fake-provider restart case at candidate head | Exact event loads, unknown non-ignorable rejects, ordering/sequence/idempotency preserved; lost/duplicated business message or skipped unknown fails |
| ACC-005 / CTR-006 | Affected package suites and independent exact-head affected-Contract review | All actual failures named and no load-bearing source blocker; missing evidence or author-only review fails |
| ACC-006 / CTR-006 | Commit/hash-bound 0.2.5 integration note and scoped self-healing statement | Conditional coverage limited to tested valid formats; unsupported fleet/install/runtime claim fails |

## 11. Alternatives and disposition

`ALT-001` — Durable one-time migration: not selected. Read compatibility, once
proved, avoids introducing a fleet writer; no migration script is required by
this proposal. `ALT-002` — Generic projection coercion/wildcard event ignoring:
not selected because it affects other adapters and can hide invalid metadata.
DEC-001/DEC-002 remain proposals until independently reviewed and accepted.

## 12. Migration, compatibility, and rollback

Use read-time normalization only, preserve input and durable records, and retain
the current envelope. Existing valid historical records are a supported read
surface (RETAIN), not a second executable session model. No path is retired and
no convergence completion is claimed. Rollback here means discarding the isolated
source candidate; any production release/rollback needs its own authorized path.

After ACC-001 through ACC-005 pass, a conditional statement may say: once the
exact tested reader/registry is installed in the session-owning runtime, valid
records in the tested formats need no manual migration or rotation for these
two defects. The incident count 1,940 is not a newly verified inventory. Other
corruption, unrelated defects, installation and actual fleet recovery are not
proved by synthetic tests. This conditional self-healing statement is currently
UNPROVEN and no actual recovery is claimed.

## 13. Open questions

The incident's exact 023rb harness source/package revision and failing conversion
remain UNKNOWN; resolving them is required by CTR-001 before any repair claim.
Acceptance belongs to mayf3 or an explicitly delegated maintainer; this proposal
has not been accepted. External source implementation authority remains unproven
and must be established in the owning repository before that code changes.
These gaps may not be bypassed by local tests or a review recommendation.

```text
SPEC_GOVERNANCE_MODE = AUTHOR
AUTHORITY_ACTION = NEW
SPEC_ID = PI_AI_REPLAY_COMPATIBILITY_025_V1
STATUS = proposed
IMPLEMENTATION_AUTHORITY = contracts (effective only after acceptance/merge)
PRIMARY_PARENT_AUTHORITY = AGENT_CORE_PRODUCT_ARCHITECTURE_V1
EXTERNAL_AUTHORITIES = NONE_ESTABLISHED
PLAN_LEVEL = EXEC_PLAN for later cross-component implementation; BRIEF for this proposal
ASSURANCE_LEVEL = DURABLE
DOCS_FIRST_REQUIRED = YES (explicit task AGENTS instruction)
OPEN_OWNER_DECISIONS = accept Core integration Contracts; establish external source authority
NORMATIVE_TBD = NONE; unresolved source identity is an explicit execution gate
PARTIAL_SUPERSESSION = NONE
CONTRACT_COUNT = 6
CONTRACTS_WITH_ACCEPTANCE = 6
AUTHORING_READY_FOR_REVIEW = YES
SPEC_ACCEPTANCE_READY = NO pending owner/source-authority questions
IMPLEMENTATION_ALLOWED = NO
MERGE_READY = NO
OPERATION_ALLOWED = NO
NEXT_ACTION = REVIEW
```
