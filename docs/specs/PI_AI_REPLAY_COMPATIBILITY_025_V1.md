---
spec_id: PI_AI_REPLAY_COMPATIBILITY_025_V1
status: proposed
date: 2026-10-31
type: implementation-spec
implementation_authority: none-until-accepted-and-merged
references:
  - mayf3/agent-control#1249
  - mayf3/dsh-agent-core#548
  - mayf3/dsh-agent-core#550
  - mayf3/deepseek-harness#4
---

# pi-ai replay compatibility for the 0.2.5 integration

This is a proposed implementation authority, not an accepted Spec or a repair.
The implementation agent must not accept or merge this document itself. Under
`.agents/README.md`, acceptance and merge must precede product implementation in
a separate change. This document does not amend the unrelated delivery-resilience
Spec, whose exclusion of web-search poisoning remains intact.

## Intent and pinned source evidence

Make existing affected session histories resume without rewriting or rotating
their durable files. Preserve provider replay metadata and exact unknown-event
rejection. Limit release coordination to the requested Codex 0.2.5 integration.

The inspected source tuple is:

| Repository | Commit | Meaning |
|---|---|---|
| dsh-agent-core | `20e60dd72a42a0ef69e0acb8516b15c1893ffb01` | Fresh remote main; delivery/evidence repository |
| deepseek-harness | `c211b445593fa5639075dc690801a3a3005ca0dd` | Includes the existing exact Codex web-event fix |
| dsh-codex | `e3e54e206f7c829503c7e6eed378643ba0416792` | Existing `v0.2.5`; lock pins pi-ai adapter `0.1.0-rc.7` |

The current git reader accepts wrapped v2. Codex 0.2.5 already converts flat v1
to wrapped v2 in memory. The incident's claimed wrapped-v2 to flat-v2 transition
is not established by these sources. Production-loaded bytes remain UNKNOWN.
The public npm adapter tarball was independently verified against its lock
integrity and accepts wrapped v2 in the bounded synthetic probe. That probe
uses available development peers and does not bind a full 0.2.5 runtime closure.
A production read is not required or authorized by this Spec.

## Contracts

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

## Alternatives and boundaries

The proposed approach is narrow read-time normalization at the reproducing
provider-owned conversion/reader, reusing the existing current envelope and
validation. Durable one-time migration is unnecessary if read compatibility is
proven and would add a fleet writer. Generic projection-layer coercion would
affect other adapters and conceal invalid metadata. Neither alternative is
selected. This selection is an author proposal pending acceptance.

No production deployment, runtime/plugin restart, real session inspection,
session rewrite/rotation, migration script execution, credential/config change,
UNKNOWN replay, format v3, or release outside the 0.2.5 integration is authorized.
No new global session-tolerance policy is introduced. Source preparation and
production acceptance remain separate.

## Acceptance evidence

| Criterion | Required evidence |
|---|---|
| ACC-001 | Source/publication tuple plus a synthetic end-to-end RED showing the exact failing conversion, or an explicit already-compatible/mismatch result with no repair claim |
| ACC-002 | Identical old/new replay fixtures GREEN after the minimal fix; response IDs, all signature types, redaction and provider/model fidelity retained; input bytes unchanged |
| ACC-003 | Invalid-state negative cases retain existing rejection/diagnostic policy; unknown non-ignorable events still reject |
| ACC-004 | Existing five Codex web-event reload tests reused at the candidate head; fresh-loader restart/sequence/no-duplication fixture passes |
| ACC-005 | All affected existing package-suite outputs, named baseline failures, and non-author exact-head review receipt |
| ACC-006 | Commit/hash-bound 0.2.5 integration note and conditional self-healing statement, with production status UNKNOWN/unverified |

The fleet statement may say: after the exact tested reader and event registry are
installed in the runtime that owns the sessions, valid historical records in the
tested formats need no manual migration or rotation for these two defects. The
reported 1,940 files are incident evidence, not a newly verified inventory. Other
corruption, unrelated defects, installation and actual fleet recovery are not
proved by synthetic source tests. Until ACC-001 through ACC-005 are satisfied,
even this conditional self-healing claim must remain unproven.

## Acceptance status

`SPEC_STATUS=proposed`, `IMPLEMENTATION_ALLOWED=NO`, `MERGE_READY=NO`,
`OPERATION_ALLOWED=NO`. Non-author proposal review is not Owner acceptance and
does not authorize implementation. Resume after the governing Spec is accepted
and merged at a fixed commit; preserve all existing passed source evidence.
