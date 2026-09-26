# Fixed s256 one-shot orchestration — nonproduction preflight

```text
DEVELOPMENT_PREFLIGHT
SPEC_GOVERNANCE_MODE = PREFLIGHT
TARGET_REPOSITORY = mayf3/dsh-agent-core
REVIEW_TARGET_HEAD = 587efc2c96b582faf8e2d1e5af9632d67c059b43
BASE_HEAD = 587efc2c96b582faf8e2d1e5af9632d67c059b43
CURRENT_BASE_HEAD = ca2f2c4d8802a4a323c8458caa89c52688aeb950 (local origin/main, no fetch)
ROUTE_STAGE = IMPLEMENTATION
AUTHORITY_ACCEPTED_IN_BASE = YES
GOAL_OR_TARGET = assemble one fixed R2 action in disposable nonproduction tests
CURRENT_GAP = canonical DS mutex owner calls inert entry, never producer primitives
AUTHORITY_ACTION = REUSE
PRIMARY_AUTHORITY = accepted fixed-s256 R2 SHA35dbaeb6938c81f3101506efd42d065caf4ea7ad47010a52e5a906bb5c252a7c
RELATED_AUTHORITIES = accepted r4 RQ-002/003 V9/005/007; accepted V2/addendum pinned in same-head HANDOFF
IMPLEMENTATION_AUTHORITY = contracts
ATOMIC_SPEC_IMPLEMENTATION_PERMITTED = NO
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = CONTROLLED
EXECUTION_MANDATE = VALID (parent continuation, nonproduction only)
MUTATION_AUTHORIZATION = VALID
ISOLATED_WRITE_SURFACE = YES
CONTROLLED_RUNBOOK_REQUIRED = NO (no host operation)
SPEC_GAP_DEPENDENCY = NONE for nonproduction orchestration; pre-SEALED UNKNOWN schema boundary retained
EVIDENCE_REVIEWABILITY = PASS
LIVE_AUTHORITY_GAP = DETECTED
OWNER_DECISION_REQUIRED = NO for scoped source/test continuation
EMERGENCY_STATE = NONE
BASE_IMPACT = BOUNDED
IMPLEMENTATION_ALLOWED = YES
MERGE_READY = NO
OPERATION_ALLOWED = NO
EVIDENCE_NEEDED = assembled action RED/GREEN; continuity/UNKNOWN/no-replay negatives; focused dependencies; independent exact-head review
DONE_WHEN = bounded source/test candidate frozen with exact uncovered obligations
EXPANSION_TRIGGER = new host policy/effect, generic API, or new durable receipt semantics required
NEXT_ACTION = CONTINUE
```

Authority and scope were read before code: repository grammar/local/router/PREFLIGHT,
accepted r4 normative body, accepted R2, current587 handoff and independent review,
and `HR-H2-H3-ONE-SHOT-APPLICABILITY-20260926-v1/review/APPLICABILITY-RULING.md`.
The parent explicitly authorizes this nonproduction continuation; Q1/Q2 remain YES.

Minimum plan: add one fixed internal orchestration module under `scripts/hr-s256-one-shot/`
and embed it in the existing pinned DS candidate. Only existing DS TEST_MODE may
reach the internal fixed nonproduction IO seam. Neither the wire grammar nor the
production entry accepts an adapter, path, command, callback or PASS. Tests provide
synthetic OS boundaries; they prove ordering and actual durable component calls,
never installed source closure or host safety. Real production remains
`PROFILE_NOT_BOOTSTRAPPED` before protected reads.

Sequence: fixed preflight → intent → maintained window/source inhibition and
quiescence → complete census → existing archive → authorization → immutable final
bundle commitment → durable one-launch claim → authenticated inherited FD challenge
→ exact startup/consumption readback → terminal disposition. Recheck live continuity
at every mutation/launch boundary. A lost/unknown observation cannot be repaired by
a later positive; no second execution or blind launch replay is allowed. Existing
750ms handoff, immutable receipt layouts and lifecycle methods are reused.

Files/tests: builder dispatch/embedding, one bounded orchestration source, permanent
assembled-action tests and disposable fixed IO fixtures. Execute only affected
Python orchestration/archive/journal/commitment/handoff/lifecycle/candidate suites
plus directly involved disposable consumer tests; structure delta, no closed broad audit.

Known boundary: lifecycle UNKNOWN requires sealed bundle plus authorization. Before
SEALED a failure retains the existing intent and uses only the supported DS terminal/
error journal, per the parent's bounded technical ruling; it cannot fabricate a
sealed proof to make UNKNOWN fit. The actual private canonical FD/window transfer
is retained without asserting durable process ownership or complete host custody.
Live source/holder/preimage/floor/validator and
compatible rollback remain final exact execution-package facts, not test assertions.
No app/config/plist/GUI route change, bootstrap, root/live read or recovery effect.
