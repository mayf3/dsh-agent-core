---
spec_id: AGENT_CORE_BUSINESS_RESULT_PROJECTION_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
scope:
  - read-only workflow business result projection in existing execution history
governed_by:
  - AGENT_CORE_PRODUCT_ARCHITECTURE_V1
  - AGENT_CORE_WORKFLOW_AGENT_EXECUTION_V3
  - AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V3
  - AGENT_CORE_EXECUTION_HISTORY_QUERY_V1
external_authorities:
  - repository: mayf3/svc-workflow
    authority_id: SVC_WORKFLOW_ACCEPTANCE_CONTEXT_BINDING_V2
    revision: ddf81196225f28bb5ffe0b8e73c8bc747aae736b
    relation: constrained_by
supersedes: []
superseded_by: null
owners: [mayf3]
---

# AGENT_CORE_BUSINESS_RESULT_PROJECTION_V1

## Goal, authority and route

Expose independently evidenced business movement and declared acceptance alongside
execution facts in the existing `execution_trace_query` /
`execution_history_audit_query`, root `workflow_instance`, including its human
report. This is an enhancement: no actual consumer misreport has been established.

This additive proposal preserves WAE V3 CTR-WAE-010, WEC V3 CTR-WEC1-001/002 and
Execution History Query V1 §§3–5. It replaces no accepted meaning. The
[Owner ruling](https://github.com/mayf3/agent-control/issues/720#issuecomment-6542854437)
allows this proposed Spec and implementation in PR #595 under the active local
`NEW + BRIEF + DURABLE` atomic route. Only the supervisor's post-review semantic
ruling accepts it, bound to reviewed and final heads. The author cannot accept it.
If non-author review identifies a Spec semantic problem, stop dependent work and
return to #720 for a new ruling; do not repair the Spec autonomously.

## Observations and evidence

OBS-BRP-001: at Core `491faec46877d8078dd5be4a491f8fc047f83c82`, source inspection
on 2026-10-31 shows `projection.js` is ledger-only and WAE settlement means attempt
closure, not transition authorship or acceptance. The existing workflow history
root reads caller-scoped detail, timeline and submissions. Full provenance is in
the [R1 investigation](../investigations/WORKFLOW_BUSINESS_PROJECTION_720_PREFLIGHT_V1.md).

OBS-BRP-002: at Svc `ddf81196225f28bb5ffe0b8e73c8bc747aae736b`,
`src/application/workflow_instance/query_types.rs` exposes native event, visit,
version, Context and submission coordinates. `src/domain/definition/acceptance_binding.rs`
and accepted Acceptance Context Binding V2 define opt-in schema annotation
`x-workflow-acceptance-binding-v1`, exact Context revision and criterion PASS sets.
The full published definition version is available only within existing caller
visibility. A submission payload alone does not prove opt-in or acceptance.

CLM-BRP-001 (SUPPORTED): execution closure and business result need separate
fields. EVD-BRP-001 relates OBS-BRP-001/002 to this claim at the two exact source
coordinates: the same legitimate settled attempt may follow RETURN, cancellation,
administrator movement or a declared acceptance. Source evidence suffices for
design and fixture conformance, not original-instance or production acceptance.

## Decisions and Contracts

### CTR-BRP-001 — Pure projection and single consumer

The classifier MUST be a pure function over explicit already-read inputs, without
I/O, clock reads, mutation or persistent state. The existing history root is its
only new consumer. The history adapter MAY use the existing caller-credential GET
for the exact published definition version to verify an acceptance annotation
(`GET /internal/v1/definition-versions/{versionId}/input-contract` for native
definition identity, then `GET /internal/v1/domains/{domainId}/definitions/{definitionId}/versions/{versionId}`);
it MUST NOT add grants, impersonate an Owner, scan for other instances or fetch
private sessions to fill a gap. A denied/unavailable read remains unproven.

No collector, global ID, database/ledger/index write, timer, retry, dispatch,
workflow command or second execution flow is introduced. The existing history
reader's pre-existing rebuildable session index is unchanged; this projection
adds no write and does not alter that reader's accepted behavior. The execution
engine MUST NOT import the history query core or consume this result.

### CTR-BRP-002 — Additive, independent fields

Only workflow-root results add `summary.workflowResult`:

```text
{ workflowInstanceId,
  execution: [{nodeVisitId, attemptId, generation, executionState,
               attemptClosure: SETTLED | UNRESOLVED, visitLeft: true | false | null}],
  businessOutcome: {state: UNKNOWN | FORWARD | RETURNED | CANCELLED | TERMINATED,
                    workflowStateVersion: integer | null, evidence: object | null,
                    acceptance: {state: ACCEPTED | UNPROVEN, evidence: object | null},
                    gaps: string[]},
  observations: [{source, observedAtMs, workflowStateVersion?}],
  consistency: NON_ATOMIC }
```

Execution states come from the existing per-generation execution-history read
projection, unchanged. `attemptClosure=SETTLED` only for `SETTLED` or
`STALE_NO_PROGRESS`; this is attempt closure, not proof that all external execution
has terminated. `visitLeft` compares that visit with a readable full detail's exact
current visit; otherwise null. Neither field proves a business outcome.

Preserve original `executionState`, judgment, `progressed`, fiveDimensions,
`BUSINESS_COMMITTED`, fences, quiescence and recovery semantics. Do not attribute
a transition to a Run without existing exact command/receipt linkage. Human report
MUST present execution closure and business movement/acceptance separately.

### CTR-BRP-003 — Native joins and conservative current outcome

Detail MUST identify the requested instance and a positive state version. Only
native Svc events for that same instance are eligible. Require unique positive
event sequence, event ID, command ID and consecutive old/new state versions.
Select by native event sequence, never wall-clock or model text. Exact duplicates
may collapse; contradictory duplicates, invalid coordinates, incomplete timeline,
denied detail or a highest observed event version different from detail MUST
yield `UNKNOWN` with visible gaps. Do not fall back to an older successful event.

At the detail's exact state version, supported transition events are
`WORKFLOW_TRANSITION_COMMITTED` and
`WORKFLOW_CONTEXT_REVISED_AND_TRANSITION_COMMITTED`. Their native effects map
`ADVANCE → FORWARD`, `RETURN → RETURNED`, `TERMINATE → TERMINATED` only with
source/target node and visit, transition and Context coordinates present and
consistent between event fields and event_data. `WORKFLOW_INSTANCE_CANCELLED`
maps to `CANCELLED`. Other latest events, including Assistance, wake, Context-only,
archive and administrator movement, remain `UNKNOWN`. Terminal flags, Visit exit,
state-version growth, Agent text, checkpoint and tests alone prove no business
movement or acceptance. Evidence retains native instance/event/sequence/command,
old/new version and available transition/visit/Context/submission coordinates.

### CTR-BRP-004 — Opt-in acceptance, not business truth

`acceptance.state=ACCEPTED` means a committed terminal ADVANCE satisfies the
existing **structural Acceptance Context Binding V2** proof; it does not certify
the meaning, quality, external delivery or truth of submitted evidence.

Require all of: readable exact published definition version matching detail;
exact transition ID/from/to/effect joined to the event; terminal target node;
that model-3 TASK's primary ADVANCE transition's root submission schema opts in
with exactly `x-workflow-acceptance-binding-v1: {contextCatalogPointer:
"/acceptanceCriteria", submissionReportPointer: "/acceptanceReport"}`;
one matching immutable submission with exact instance/source visit/transition/
effect/Context ID and payload digest matching event_data; readable same-instance
current Context with that exact Context revision; nonempty unique criterion IDs
from `acceptanceCriteria` (1–128 exact `{id,description}` objects, IDs matching
`[A-Za-z0-9][A-Za-z0-9_-]{0,63}`, nonblank descriptions at most 4096 UTF-8 bytes);
`acceptanceReport.contextRevisionId` exact canonical UUID equality;
unique report result IDs equal the criterion set, all verdicts literal `PASS`.

Every absent, contradictory, denied, incomplete or stale prerequisite yields
`UNPROVEN` and a reason, never automatic success or an invented negative verdict.
No declared annotation cannot be inferred from terminal names or payload keys.
The first 50 submissions may establish a positively matched immutable proof but
cannot establish absence; pagination/truncation remains visible. Never output
criterion text, payloads or private session content in this derived evidence.

### CTR-BRP-005 — Read boundaries and repeatability

Record observation time for every consulted Svc source and the detail state
version; retain native versions/times in referenced evidence. Declare
`consistency=NON_ATOMIC`; do not claim a cross-service atomic snapshot or present
freshness beyond the observations. Same explicit inputs MUST yield identical
outputs without changing inputs. Timeline pagination MUST honor deployed
`nextCursor` (legacy `next_cursor` also readable); malformed/repeated cursor,
cap, missing page or source failure MUST remain incomplete, never a completeness
proof. Projection is computed over the complete read set before display paging.
The existing source-generation token additionally binds consulted Svc content and
read-status revisions, excluding observation wall-clock times. A changed proof
creates a new report boundary even when row counts and local files are unchanged;
no persisted snapshot or second state store is created.

## Acceptance

All source tests run in isolated temporary roots, with fake caller-scoped GETs
using the pinned DTO shapes. Required evidence is executed RED then GREEN and
the existing two-package regression command at exact candidate/environment.

| Acceptance | Contracts | Expected result and rejecting counterexample |
|---|---|---|
| ACC-BRP-001 | 001,002,003 | Same settled attempt + RETURN/cancel/admin versus terminal ADVANCE gives separate execution and movement fields; no automatic acceptance |
| ACC-BRP-002 | 003,004 | Exact opt-in terminal proof accepted structurally; absent annotation, missing join/digest, stale Context, duplicate/missing/non-PASS criterion stay unproven |
| ACC-BRP-003 | 003,005 | Assistance/version-only, stale/late/conflicting events, denied or truncated sources remain UNKNOWN or UNPROVEN; no older-success fallback |
| ACC-BRP-004 | 001,005 | Deep-frozen inputs/repeat reads equal; transport sees only permitted caller GETs; no product source write; execution consumption ban passes |
| ACC-BRP-005 | 002,005 | Existing structured/report reader exposes same projection across output pages, with source observations and explicit NON_ATOMIC; baseline suites remain green |

Failures of any expected field, evidence join, privacy boundary or unchanged
judgment/fence rule fail the corresponding acceptance. Fixture GREEN is source
conformance only. Original blog/EP49 comparison and a second real instance remain
separate read-only business validation under existing authorization; unavailable
instance coordinates/access remain explicit, never replaced with mock acceptance.

## Alternatives, compatibility, rollback and stop

Rejected: redefine settled; infer acceptance from terminal/ADVANCE/text; add an
acceptance ledger or execution loop; bypass visibility to read definitions.
Retain the existing ledger-only execution projection and five dimensions as
distinct supported responsibilities. This additive field has no migration or
backfill. Rollback removes the field and reader-only code; authoritative evidence
is untouched. No production apply authority, install, enablement or live business
verification follows from this source PR.

Done when proposed Spec, code, named regressions and independent Spec+implementation
review are available in PR #595 with #720 delivery evidence. PR remains open;
acceptance and merge remain separate. Authority conflict or Spec semantic finding
stops dependent work; scope/privilege/write expansion requires a new ruling.
