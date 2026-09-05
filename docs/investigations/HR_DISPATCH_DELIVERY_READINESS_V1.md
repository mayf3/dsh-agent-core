# HR dispatch delivery readiness — execution record

Date: 2026-09-05

GOAL_NAME = HR_DISPATCH_DELIVERY_READINESS_V1
GOAL_STATUS = ACTIVE
CURRENT_PHASE = PARALLEL_DISCOVERY_AND_AUTHORITY_CENSUS

## Business objective and terminal boundary

Enable the formal HR orchestration Principal
`bc970ced-710f-4479-9ff0-e295a1c59424` to resolve an exact Workflow AGENT
Principal to its canonical enabled Agent, and deliver one task through existing
`agent_session_send` to that Agent's canonical main session. Completion requires
production-active minimal authorization, fail-closed canonical resolution, and
one harmless composed A2A canary with exactly one delivery and one target run.
Stop at HR_DISPATCH_DELIVERY_PRODUCTION_READY=YES. The complete Workflow loop
belongs to REAL_AUTONOMOUS_WORKFLOW_LOOP_V1.

Task authority: Owner attachment
`/Users/yanfenma/.codex/attachments/3e9844dd-9e6a-4f3d-8bb2-b052a7d7eebd/pasted-text-1.txt`.
This investigation records evidence and execution state; it is not implementation
or semantic acceptance authority.

## Initial fresh facts

- Remote dsh main pinned to `1912d582888455a049838f376759b62f295b341b`.
- Shared checkout is dirty and on an older unrelated branch; preserved.
- Isolated branch: `codex/hr-dispatch-delivery-readiness-v1`.
- Lane A: authorization census running independently.
- Lane B: canonical identity census running independently.
- Lane C: BLOCKED_BY_DEPENDENCY on production-ready A and B.
- HR access_denied is imported attachment evidence, not a newly executed send.
- Visit Activation task `01a07001-26f2-71b3-a6f4-94c37d10cd44` was freshly
  observed active, still preparing source audits/deployment. Its production
  terminal conditions have not been established here.
- PRODUCTION_APPLY_ALLOWED = NO. No production mutation or canary performed.

## Frozen execution boundaries

No new dispatcher, agent_wake, scheduler administration or cross-agent scheduler
mutation, credential impersonation, second identity source, fuzzy/display-name
resolution, automatic send retries, or full Workflow E2E.

Production mutation concurrency is one. This Goal can advance to production only
after fresh evidence of VISIT_ACTIVATION_PRODUCTION_READY=YES,
DISPATCH_INTENT_BROKER_PRODUCTION_READY=YES, and PRODUCTION_RUNTIME_LOCK=IDLE.
Every production transaction needs fresh preimage, minimal mutation, readback,
health, durable receipt, and regression proof. Any new semantic authority needs
an independently reviewed exact-head candidate and required Owner acceptance
before implementation.

## Next actions

Consolidate both fresh censuses, classify the minimal authorization and resolver
deltas against accepted authority, and continue all legal non-production work.
OWNER_ACTION_REQUIRED = NONE at census phase.

## Census consolidation and execution route

PREFLIGHT at dsh base `1912d582888455a049838f376759b62f295b341b` and Auth base
`ae6da9a8b754be16c35553f0dff1d8e36194d88f`:

```text
AUTHORITY_ACTION_A = NEW
AUTHORITY_ACTION_B = NEW
ROUTE_STAGE = AUTHORITY_AUTHORING
AUTHORITY_ACCEPTED_IN_BASE = NO (new HR-specific/read-interface contracts)
PLAN_LEVEL = EXEC_PLAN
ASSURANCE_LEVEL = CONTROLLED
IMPLEMENTATION_ALLOWED = NO
OPERATION_ALLOWED = NO
MUTATION_AUTHORIZATION = VALID (Owner attachment, docs-first bounded candidates)
ISOLATED_WRITE_SURFACE = YES
SPEC_GAP_DEPENDENCY = LOAD_BEARING
NEXT_ACTION = RE_PREFLIGHT (through the minimal authority candidates)
```

Canonical source FOUND: Auth MachinePrincipal UUID / agentId / principalType /
status. Agent Core provisioning already supplies exact agent_id to Auth. The
existing Auth resolution contract is external_ref -> Principal, excludes status,
and uses provisioning authorization. It cannot be used unchanged as the required
exact UUID -> enabled Agent read surface. No second identity database is needed.

The existing operational send Grant authority restricts its tuple to the named
efficiency Principal/client. HR needs a separate minimal authority; copying a
successful sender's unrelated scheduler grants is forbidden.

The exact current HR authorization rejection remains OPEN: protected production
DB/config could not be read without native privilege. No secret was printed or
password requested. `access_denied` alone does not distinguish token acquisition
failure from the grant decision. Candidate runbooks must collect sanitized exact
decision evidence and bind the current HR client before any apply.

Agent Core's existing generic Agent reference resolution has display-name
fallback. The new UUID flow must use exact Agent ID checks, including at final
delivery admission, so disappearance of a resolved Agent cannot redirect to a
different Agent with a matching display name.

## Bounded phase plan

1. Author A: independent HR-only Grant authority, preserving existing ASM scope,
   audience, credential and operation contracts; bind live tuple before apply.
2. Author B: Auth-owned exact UUID read contract and Agent Core-owned minimal
   exposure, enabled Agent validation and exact final delivery identity.
3. Independent review of frozen candidate heads; freeze the complete blocker
   union, fix once, and perform one re-audit. Persist review records.
4. Batch only required exact-head Owner acceptance after review PASS/zero
   blockers. No implementation before accepted authority is in each base.
5. Implement the accepted minimum, focused negative cases and conformance review;
   prepare exact deployment closure and controlled transaction evidence.
6. Revalidate Visit/Dispatch production-ready and runtime idle dependency before
   serial production apply. Native privileged steps remain Owner-only.
7. Execute the one authorized harmless canary only after A+B production-ready;
   ambiguous delivery is outcome_unknown, never retried. Persist final handoff.

Stop/expansion controls: no full autonomous Workflow loop; no additional framework
or optional hardening. New implementation work is permitted only by accepted
contracts. An unresolved Owner/dependency lane does not stop another legal lane.

## Authority review round (2026-09-05 evening)

Three frozen candidates received independent read-only exact-head review; all
three verdicts are ACCEPT with BLOCKERS = 0 and MERGE_READY = YES:

- LANE_A: AUTH_SERVICE_HR_AGENT_SESSION_SEND_GRANT_V1, reviewed spec head
  `9b3b4bdb0016ec40bab2419bbf15dc886f40476f` (round-1 reason blocker closed at
  this head; single post-union re-audit PASS). Branch
  `codex/hr-session-send-grant-v1`; review record commit `0007f34` at
  docs/audits/AUTH_SERVICE_HR_AGENT_SESSION_SEND_GRANT_V1_INDEPENDENT_REVIEW.md.
  3 FOLLOW_UPS (procedural audit-uniqueness probe; pre-existing revokedAt
  mapping debt already recorded; census receipt should note the non-selected
  agt_hr-agent identity's absence). None blocking.
- LANE_B auth: AUTH_SERVICE_EXACT_AGENT_PRINCIPAL_RESOLUTION_V1, head
  `0359575dd1481aa5e6c294a495fbaabce97e40bf` on base ae6da9a == github/main.
  Branch `codex/principal-agent-resolution-authority-v1`; review record commit
  `77750cd`. DOWNSTREAM_PIN_CONSISTENCY = PASS: the dsh child can pin route,
  audience `agent-principal-resolution`, scope `auth.agent.resolve`, response
  `{principalId, agentId}` and the six error codes unchanged. 3 SPEC_GAPs
  (response envelope key convention; apply must also materialize audience row +
  grant_change_audits row — "one tuple" is grant-tuple-scoped; novel
  `production_apply_authority` value) — all resolvable at implementation
  preflight, none blocking.
- LANE_B dsh: AGENT_CORE_EXACT_PRINCIPAL_AGENT_RESOLUTION_V1, head
  `f3b11d78f4e38aa9f60caa0d9b3c5ce7dc6abfa2` on base 1912d58 == origin/main.
  Branch `codex/principal-agent-resolution-authority-v1`; review record commit
  `2f6fd7e`. UPSTREAM_PIN_CONSISTENCY = PASS one-for-one. 1 SPEC_GAP
  (`credential_missing` naming vs broker's `credential_unavailable`) + 1
  TOOLING_DEBT (500-line structure ceiling leaves no headroom in legacy files;
  new capability code must go into new focused files). None blocking.

Companion mechanical fix on the goal worktree branch
`codex/hr-dispatch-delivery-readiness-v1`: commit `5f776e6` restores the RPC
transport envelope in the ASM integration fixture (the 5 pre-existing failures
were fixture drift, not product regression). Verified post-commit:
scripts/verify-code-structure.mjs PASS (base 1912d58, head 5f776e6); the ASM
integration suite reports 8/8 PASS when run with production node
/usr/local/bin/node (v25.6.1) and proxy environment variables unset
(compose.js fail-closes on proxy env and requires the pinned node version).
Scheduler regression 29 items reported PASS earlier the same day.

BLOCKER_UNION across all three candidates = [] (empty). No repair round and no
re-audit is required. AUTHORITY_HEADS are frozen exactly as reviewed; the dsh
candidate's depends_on pin (auth 0359575) matches the actual reviewed auth
head.

NEXT = one batched Owner exact-head acceptance gate over the three reviewed
heads (Lane A auth spec; Lane B auth spec; Lane B dsh spec), then acceptance
transactions + merges, then implementation preflight. Implementation and
production remain disallowed before acceptance; PRODUCTION_APPLY_ALLOWED = NO
(Visit Activation dispatch still owns the shared mutation slot).
OWNER_ACTION_REQUIRED = exact-head acceptance of the three reviewed candidates
(batched single gate).

## Owner acceptance and implementation round (2026-09-05 night)

Owner BATCHED EXACT-HEAD ACCEPTANCE = YES for all three semantic heads
(9b3b4bd / 0359575 / f3b11d7); review-record commits explicitly not
substituted. Lifecycle executed:

- AUTH_SERVICE_HR_AGENT_SESSION_SEND_GRANT_V1: accepted at auth tx d77ea94
  (implementation_authority none->contracts per its section 3;
  production_apply_authority stays none), merged via PR #54.
- AUTH_SERVICE_EXACT_AGENT_PRINCIPAL_RESOLUTION_V1: accepted at auth tx
  b5eef6c (production_apply_authority conditional_controlled_operation
  ratified per review SPEC_GAP-3), merged via PR #55; auth main bb5b6f2
  contains both reviewed semantic heads and both transactions.
- AGENT_CORE_EXACT_PRINCIPAL_AGENT_RESOLUTION_V1: accepted at dsh tx 30d230a
  on merged-main branch (merge keeps f3b11d7 reachable); external_authorities
  pin re-pinned 0359575 -> b5eef6c per spec section 1 + review FOLLOW_UP
  (byte-identical Auth contracts = no semantic movement, no re-preflight);
  merged via PR #172; dsh main 51dafbe.
- Gates at acceptance: auth validate_spec_transition exit 0 (with documented
  single-element legacy superseded_by equivalence normalization applied
  identically to both sides — 5 pre-list-discipline records), verify_governance
  exit 0 + --require-accepted exit 0; dsh transition delta proof (base,base)
  vs (base,+record) shows ZERO new errors (pre-existing raw-graph
  non-conformance at main documented and untouched); verify_governance exit 0;
  dsh structure gate PASS.

IMPLEMENTATION (DEVELOPMENT_PREFLIGHT emitted; all three authorities accepted;
implementation_authority=contracts):

- Lane B dsh branch codex/principal-agent-resolution-impl-v1 (base 51dafbe):
  broker manifest agent_resolve_principal + registration; trusted composed
  provider (fixed Auth origin, redirect rejection, bounded 5s deadline, closed
  two-field validation, local exact-ID + enabled Definition check after Auth,
  no retry/cache/writes, caller token via trusted seam, never surfaced);
  CTR-EPAR-005 A2A ingress exact-ID admission guard (inter_agent origin only;
  display-name TOCTOU family closed; non-A2A resolution unchanged); tests
  3+12+5; message-origin harness gains resolveAgentById seam. Commits dd175ae,
  c3503c5 (cherry-pick of the ASM fixture transport-envelope repair 5f776e6 —
  the 5 parent_rpc_ambiguous failures were the same pre-existing fixture
  drift), 4438806 (A/B-proven regression fix: unconfigured auth origin now
  fails closed per call instead of throwing at composition — compose.test.js
  was 11/11 at main, 9 failures + hang with the constructor throw).
  Evidence: broker 282/282; agent-router 309/310 (1 pre-existing
  feishu-regression TRUSTED_INGRESS failure, reproduced identically at main
  via detach A/B = NOT MY REGRESSION); provider 12/12; ASM integration 8/8;
  compose 11/11; structure gate PASS. Runs require production node
  /usr/local/bin/node (v25.6.1) with proxy env unset.
- Lane B auth branch codex/principal-resolution-impl-v1 (base bb5b6f2):
  implementation subagent produced 23 files +2503/-18 with docs/ byte-identical
  (GOVERNING_SPEC_UNMODIFIED verified): additive CCR entry +
  1.7.0->1.8.0 additive minor across all linked surfaces per the wake
  CTR-AW-005 recipe; dedicated resolver/middleware/route
  (GET /v1/agent-principals/:principal_id/agent, {error: CODE} envelope per
  review SPEC_GAP-1); grant supply vehicle plan/apply/verify with
  audience-row + grant + grant_change_audits same-tx materialization (review
  SPEC_GAP-2 closure) gated behind an explicit env, refusing before any DB
  connection; fixtures positive 1 + negative 15. MINIMAL_AUTH_V1_BUNDLE_VALID
  =true; tsc clean; focused tests 37/37 after a harness ordering fix
  (JWT_SECRET default moved to module top, commit 566f916 — bare tsx --test
  previously failed 6 route-server tests on the late assignment).
- Lane A auth branch codex/hr-send-grant-impl-v1: operational
  plan/census-apply-verify-rollback vehicle + focused disposable tests in
  progress (offline; production gated by shared slot + native privilege).

PRODUCTION_APPLY_ALLOWED = NO (unchanged; Visit Activation owns the slot).
BLOCKER_UNION = [] so far at implementation-audit time (audits next).

## Implementation audit round (2026-09-05 night)

ONE independent cross-repo implementation audit (agent_a62b06ae, read-only)
covered all three branches: DSH_VERDICT = PASS, AUTH_LANE_B_VERDICT = PASS,
AUTH_LANE_A_VERDICT = PASS, BLOCKER_UNION = [] (frozen, empty — no repair
round). All gates rerun by the auditor green (dsh structure PASS + focused
37/37; auth bundle valid + tsc clean + 37/37 + 23/23). Two MECHANICAL_FIXES
applied in-candidate and rechecked: explicit client-row select projections in
both grant vehicles (secretHash never fetched) + a rollback-identity runbook
note. FINAL_HEADS: dsh 4438806 (auditor rerun = recheck), auth Lane B cc0f2ec,
auth Lane A bcb5c26. Durable record:
docs/audits/HR_DISPATCH_DELIVERY_IMPLEMENTATION_AUDIT_V1.md (goal worktree).

HR_AGENT_DELIVERY_IMPLEMENTATION_READY = YES (source-side). Remaining are
separately gated operational rounds: isolated-DB conformance execution,
production read-only census, CTR-HRG-004 token proof, runbook rehearsal
(ACC-EAPR-007), Lane C composed canary — each behind the shared production
mutation slot release (VISIT_ACTIVATION_PRODUCTION_READY=YES +
DISPATCH_INTENT_BROKER_PRODUCTION_READY=YES + PRODUCTION_RUNTIME_LOCK=IDLE)
and native Owner authorization where privileged.
OWNER_ACTION_REQUIRED = NONE at this stage.
