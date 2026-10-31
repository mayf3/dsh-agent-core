# #720 business-outcome projection — source preflight

## R2 continuation — 2026-10-31

The R1 checkpoint below is historical. The [Owner's subsequent ruling](https://github.com/mayf3/agent-control/issues/720#issuecomment-6542854437)
explicitly authorizes a proposed Spec, implementation, regression and non-author
review in this same PR. It does not accept the Spec in advance. Acceptance remains
the supervisor's semantic ruling on the independently reviewed commit; a Spec
semantic finding stops dependent work and returns to #720 without author repair.

```text
schema_version = 2
SPEC_GOVERNANCE_MODE = PREFLIGHT
TARGET_REPOSITORY = mayf3/dsh-agent-core
REVIEW_TARGET_HEAD = 324d3265ea791e43d1ac86e80b2e7ca059f7661d (R2 input)
BASE_HEAD = 491faec46877d8078dd5be4a491f8fc047f83c82
CURRENT_BASE_HEAD = 491faec46877d8078dd5be4a491f8fc047f83c82
GOAL_OR_TARGET = independent read-only business result on the existing history reader
CURRENT_GAP = no #720 classifier or acceptance contract/implementation
AUTHORITY_ACTION = NEW
PRIMARY_AUTHORITY = proposed AGENT_CORE_BUSINESS_RESULT_PROJECTION_V1
RELATED_AUTHORITIES = Product Architecture V1; WAE V3 CTR-WAE-010; WEC V3 CTR-WEC1-001/002; Execution History Query V1
ROUTE_STAGE = AUTHORITY_AUTHORING (atomic implementation permitted)
AUTHORITY_ACCEPTED_IN_BASE = NO
IMPLEMENTATION_AUTHORITY = contracts upon acceptance
ATOMIC_SPEC_IMPLEMENTATION_PERMITTED = YES (active V3 local permission + exact Owner ruling)
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = DURABLE
EXECUTION_MANDATE = VALID (Owner R2 task and linked ruling)
MUTATION_AUTHORIZATION = VALID (this PR only, plus requested issue delivery comment)
ISOLATED_WRITE_SURFACE = YES (/tmp/dc-720, dedicated pr-720 checkout, exact parent above)
CONTROLLED_RUNBOOK_REQUIRED = NO (no production operation)
SPEC_GAP_DEPENDENCY = LOAD_BEARING (closed for implementation by the explicitly permitted atomic route; merge awaits acceptance)
EVIDENCE_REVIEWABILITY = PASS (source and isolated reproducible tests)
LIVE_AUTHORITY_GAP = NONE
OWNER_DECISION_REQUIRED = YES (Spec acceptance after non-author review)
EMERGENCY_STATE = NONE
BASE_IMPACT = NONE (fresh origin/main equals R1 integration base)
IMPLEMENTATION_ALLOWED = YES (bounded atomic route)
MERGE_READY = NO
OPERATION_ALLOWED = NO
EVIDENCE_NEEDED = feature RED/GREEN; named baseline comparison; independent Spec+code review
DONE_WHEN = reviewed source+Spec+regressions published in PR #595 and delivery comment in #720; PR open, no merge
EXPANSION_TRIGGER = authority conflict; Spec semantic finding; source outside proposed read allowlist; new privilege/write/execution flow
NEXT_REAL_ACTION = proposed Spec then pure projection and one existing reader/report
NEXT_ACTION = CONTINUE
```

Implementation plan (bounded Brief; no separate control-plane record):

1. Add `docs/specs/AGENT_CORE_BUSINESS_RESULT_PROJECTION_V1.md` as proposed.
   Freeze fields, exact permitted joins, acceptance sufficiency and unknown cases.
2. Write isolated feature regressions first; record their failing execution.
   Add pure read projection under `packages/workflow-execution/src/` and connect
   `packages/execution-history/src/correlate/workflow-root.js` and `report.js`.
   Existing judgment and ledger-only execution projection remain authoritative.
3. Run the same two-package baseline plus feature tests, structure and diff checks.
   Record environment failures and exact baseline names separately from regressions.
4. Commit a reviewable candidate; fresh non-author reviewer checks Spec and code.
   On Spec semantic issue, stop and report to #720. On implementation-only defect,
   repair within the proposed Contracts and obtain affected delta review.
5. Push to the existing PR ref, update its final description and post the requested
   #720 delivery evidence. Leave Spec proposed pending supervisor acceptance and
   leave PR open/unmerged. No install, enablement or business acceptance claim.

## Status and mandate

`DISPOSITION = deferred`; `IMPLEMENTATION_ALLOWED = NO` for the new product projection.
This is an investigation, not an accepted Spec or an implementation delivery.
The requested projection, feature regressions, and original-instance verification remain undone.

The Owner's 2026-10-31 task authorizes branch `ac-task/720-business-projection`,
source work, independent review, a PR and a delivery comment on
[agent-control #720](https://github.com/mayf3/agent-control/issues/720), then stop without merge.
It forbids production writes, changes to judgment/settled semantics, new collectors,
global IDs, database writes, and a second execution flow.
The user-supplied repository bootstrap additionally requires an accepted Spec before
implementation and forbids starting when a new/amended Spec is needed.

## Coordinates and method

- Observed on 2026-10-31; Core integration base:
  `491faec46877d8078dd5be4a491f8fc047f83c82` (fresh `git fetch origin main`).
- Svc source base: `ddf81196225f28bb5ffe0b8e73c8bc747aae736b`
  (`gh api repos/mayf3/svc-workflow/commits/main`, then source reads pinned to that SHA).
- Both differ from the issue's historical `abca6f03` / `2b746b5d` baselines.
- Issue body and comments: `gh issue view 720 --repo mayf3/agent-control`.
- Original checkout was on an unrelated dirty branch; it was not switched or cleaned.
  Investigation and isolated tests use a separate worktree on the requested branch.
- No production data, protected runtime files, credentials, original private sessions,
  or live Workflow instances were read. No production operation was attempted.

## OBS-720-001 — execution settlement already has bounded meaning

[WAE V3 CTR-WAE-010](../specs/AGENT_CORE_WORKFLOW_AGENT_EXECUTION_V3.md#ctr-wae-010--settled-semantics-carried-verbatim--unchanged)
(`:396–418` at the pinned Core base) defines `SETTLED` as attempt closure,
not completion by this attempt. Without exact Run-to-command/receipt linkage,
reports cannot attribute the transition to the Run.
[judgment.js](../../packages/workflow-execution/src/judgment.js) `:67–87`
settles on a changed current visit or the historical-participant visibility invariant.
The documented causes include transition, administrator movement and termination.

[WEC V3](../specs/AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V3.md) `:83–123`
freezes a ledger-only execution trace and execution-state mapping.
[projection.js](../../packages/workflow-execution/src/projection.js) `:23–77`
exposes execution state and attempt coordinates, with no separate business acceptance.
This is consistent with those Contracts; this investigation establishes no bug.

## OBS-720-002 — an existing read consumer and evidence sources exist

`execution_trace_query` / `execution_history_audit_query` already call
[execution-history runtime](../../packages/production-runtime/src/execution-history/runtime.js)
`:90–104`, then `queryExecutionTrace` and
[workflow-root.js](../../packages/execution-history/src/correlate/workflow-root.js) `:17–68`.
The latter reads caller-scoped Svc detail, timeline and submissions;
[report.js](../../packages/execution-history/src/report.js) `:84–123` renders the same result.
This is a possible single existing consumer, subject to an accepted projection Contract.

[Execution History V1](../specs/AGENT_CORE_EXECUTION_HISTORY_QUERY_V1.md)
`:112–121,150–175,179–226` already governs the state-version/event/command bridge,
source gaps, caller credentials, redaction, frozen read boundaries and five dimensions.
It distinguishes accepted, started and business committed. It does not define the
new complete progress/RETURN/cancellation/acceptance classifier required by #720.
Its consumption ban excludes the execution engine; this is not permission to wire
the query core into dispatch or recovery.

Current [rules.js](../../packages/execution-history/src/rules.js) `:147–178`
emits aggregate `BUSINESS_COMMITTED` for non-Assistance events carrying a command ID.
That verdict is not a qualified acceptance verdict. No consumer misreport was reproduced.

## OBS-720-003 — explicit acceptance is supported, with qualifications

At the pinned Svc source:

- [acceptance_binding.rs](https://github.com/mayf3/svc-workflow/blob/ddf81196225f28bb5ffe0b8e73c8bc747aae736b/src/domain/definition/acceptance_binding.rs#L19)
  `:19–34,60–87,227–313` implements the opt-in
  `x-workflow-acceptance-binding-v1` annotation, `/acceptanceCriteria`,
  `/acceptanceReport`, exact Context revision and per-criterion literal `PASS`.
  Lines `4–8` explicitly exclude interpreting evidence meaning or deciding business truth.
- [governance_child.rs](https://github.com/mayf3/svc-workflow/blob/ddf81196225f28bb5ffe0b8e73c8bc747aae736b/src/domain/workflow_instance/governance_child.rs#L30)
  `:30–80` declares `ACCEPTED | NOT_ACCEPTED` for its bounded linked-child contract.
  Its [terminal proof](https://github.com/mayf3/svc-workflow/blob/ddf81196225f28bb5ffe0b8e73c8bc747aae736b/src/store/postgres/workflow_instance_repository/assistance_transaction/governance_child/terminal.rs#L70)
  `:70–99` joins actual event, definition version, transition and submission/digest.
  Core's existing assistance-detail reader can expose the authorized Svc proof.

Neither is a generic assertion that every terminal Workflow is accepted. A new
projection needs to name the supported acceptance Contract and its exact evidence
joins. A terminal label, ADVANCE, agent text, checkpoint, test result or Visit exit
cannot substitute for it. Undeclared or unreadable conditions remain unproven.

## OBS-720-004 — read limitations must remain visible

- [svc-facts.js](../../packages/execution-history/src/loaders/svc-facts.js) `:52–53`
  requests only the first 50 submissions. Incomplete history cannot prove absence.
- Svc [query DTOs](https://github.com/mayf3/svc-workflow/blob/ddf81196225f28bb5ffe0b8e73c8bc747aae736b/src/application/workflow_instance/query_types.rs#L199)
  `:199–273` carry event/command/effect/visit/version/Context/submission coordinates,
  but historical detail omits current Context and outgoing schemas.
- Full definition-version graph reads require existing Domain Owner visibility;
  member input-contract reads do not supply the graph. Missing permission is not
  evidence that the Definition declared no acceptance condition.
- Detail, timeline and submissions are separate requests. No cross-service atomic
  snapshot, read freshness or absence proof was established by this source audit.

## CLM-720-001 / EVD-720-001 — a load-bearing Contract gap remains

`SUPPORT = SUPPORTED` by OBS-720-001/002 and the independent authority audit at the
pinned Core base. Searched owners include WAE V3, WEC V3, Execution History V1,
Owner-obligation Workflows V2, Governance Child Return V2 and Current Input Broker V1.
These provide reusable boundaries and bounded proofs, not the requested generic
outcome enum, evidence sufficiency, conflict/staleness handling and acceptance mapping.
This conclusion concerns source authority only, not runtime availability or business state.

`SPEC_GAP_DEPENDENCY = LOAD_BEARING`; `IMPLEMENTATION_ALLOWED = NO`;
`MERGE_READY = NO` for the requested feature; `NEXT_ACTION = RE_PREFLIGHT`.

- Affected action: implementing and presenting the new business-outcome projection.
- Reachable counterexample: the same legitimate execution `SETTLED` can follow RETURN,
  administrator movement or a declared accepted transition; the execution trace alone
  cannot distinguish the requested business meanings.
- Impact: inventing a replacement enum or treating submission/termination as acceptance
  would establish an unaccepted public Contract or make an unsupported acceptance claim.
- Minimum closure: bind an accepted additive Contract covering result subjects/fields,
  permitted sources and joins, acceptance sufficiency, UNKNOWN/conflict/freshness,
  one existing consumer, and the focused negative/positive acceptance matrix.
- Existing bounded route: keep current readers and judgment unchanged; source audit
  and isolated baseline tests can continue without crossing that dependency.

The current main's [local governance](../../.agents/local/README.md) `:45–75`
permits bounded `AMEND/NEW + ROUTINE/DURABLE` Spec-and-code atomic PRs, with independent
acceptance before merge. Adoption V3 and its accepted lock are present in this base.
However, the explicit user-supplied bootstrap for this task forbids starting when a
new/amended Spec is needed. No override or accepted #720 Contract was available when
this checkpoint was recorded. The two routes must not be silently conflated.

## Baseline evidence

Executed on unchanged Core base above, Node `v26.7.0`, npm `11.19.0`:

```sh
node --test --test-reporter=tap packages/workflow-execution/test/*.test.js packages/execution-history/test/*.test.js
```

- Initial clean-worktree run: exit `1`, 251 pass, 2 file-load failures.
  `packages/execution-history/test/session-traceability.test.js` could not resolve `croner`;
  `packages/workflow-execution/test/runtime-wiring.test.js` could not resolve
  `@deepseek-ai/schemastery`.
- Environment repair only: install `croner@10.0.1` and
  `@deepseek-ai/schemastery@3.18.1` with `--ignore-scripts` into an external temporary
  dependency directory, symlink its `node_modules` into this isolated worktree.
  No package manifest or tracked source was changed.
- Re-run: exit `0`, 330 tests pass, 0 fail/cancel/skip. This includes existing judgment,
  continuation, stale/quiescence, recovery, Owner-resume, query-root, counterexample,
  privacy and consumption-ban suites. It is not the whole repository test suite.
- Raw first-run TAP SHA-256:
  `26598b4a4b1ba550a2088e5cd87015e99924cd10878d228d371b535d8fcaa374`.
- Raw repaired-environment TAP SHA-256:
  `a9aa082ff8de1328f7dac72e2cb8314112ad34b62e5ffa6112f42bd3b955b38e`.
  Local raw logs: `/tmp/ac720-baseline.tap`, `/tmp/ac720-baseline-deps.tap`;
  reviewers can also reproduce the command and dependency setup above.

No #720 product code or new regression tests exist at this checkpoint. Existing
baseline PASS does not establish SOURCE completion, installation, enablement or
business acceptance. `SOURCE = NOT_STARTED`; `INSTALLED = NOT_VERIFIED`;
`ENABLED = NOT_VERIFIED`; `BUSINESS_VERIFIED = NO`.

## Disposition and alternatives

Retain the execution settlement and five-dimension reader. Do not reinterpret
judgment, add a ledger, grant extra read privileges, guess attribution, or drive
retry/recovery from the projection. An independent read-only authority audit and
consumer audit support the findings above; they are not feature acceptance reviews.

Reopen implementation when an accepted #720 Contract is identified, or the Owner
explicitly permits the bounded atomic Spec-and-code route for this task. That route
still requires a proposed Contract and independent semantic review, without
self-acceptance, merge or production effects. Until then, this PR is evidence-only
and must not close #720 as implemented.
