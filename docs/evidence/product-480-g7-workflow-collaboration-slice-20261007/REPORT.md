# PRODUCT_480_G7_WORKFLOW_COLLABORATION_SLICE_V1 — REPORT

Product: mayf3/dsh-agent-core#480 (`[PRODUCT G7] Workflow collaboration`,
DISPOSITION=IMPLEMENT, WAVE=W5, ACTIVE_EXECUTION=agent-control#501,
EXECUTION_CLAIM=g7-workflow-collaboration-r330).
Program / scheduling authorities fresh-read before edits: #480 (this Product,
round-330 promotion claim), #386 (CONTINUOUS_BACKLOG_DELIVERY_V1),
agent-control#501 (this command), Epic #381 (index-only, G7 → #480).
Lane: ONE bounded NON-PRODUCTION source/proposal reconciliation + smallest
implementation/test/review slice. PRODUCTION_MUTATION = NO.
PROD_AUTH = NONE.

## SCOPE_CONFLICT_CHECK (performed before any edit, per command)

- **Local controller truth** (`chatgpt-local-controller state.json`, fresh
  read 2026-10-06T21:19Z): exactly ONE running task = task 501 (this session,
  sess_1c472afb-580e-406c-9388-92d0004fcd89, cwd ac-501). Task 499
  (Product #479 / agent-control#499) = stopped/terminal at
  2026-10-06T21:18:44Z; while alive it wrote ONLY
  `packages/product-api/test/history-mount-e2e.test.js` +
  `docs/evidence/product-479-g6-mobile-session-history-slice-20261007/**` in
  worktree `ac-499` on branch `product-479/g6-mobile-session-history-slice` —
  disjoint from every file this slice touches. #479's writer is protected:
  its worktree/branch/evidence/PR lane were not read-modified beyond read-only
  conflict census.
- **GitHub truth**: #479 QUEUE_STATE=RUNNING binding agent-control#499
  (protected writer); #480 promotion claim verified
  (SCHEDULER_ROUND = cap-20261006T204148Z-330, CLAIM_TOKEN =
  g7-workflow-collaboration-r330, EXECUTION_HEAD e9699aee = this lane's
  reserved lineage). svc-workflow: proposal PR #60 untouched since
  2026-09-15 (three weeks cold; not an active writer); no open svc-workflow
  PR is a collaboration implementation; no collaboration branch exists in
  either repo. agent-control open commands #424/#417 (deployment/DS) own no
  source files in this slice's surface.
- **Verdict: CONFLICT-DISJOINT** — exact changed-file/worktree/branch/PR
  scope of this slice (below) shares zero overlap with any live or terminal
  writer's reservations. No UNKNOWN ownership remained at first edit.

## Worktree / branch

Worktree `ac-501` (reserved agent-control workspace for task 501). The
reserved branch `ac-task/501` sits on the diverged
`goal/workflow-assignee-admission-guard-v1` lineage (e9699aee, NOT an
ancestor of main — the same condition #479's report documented); all G7
authorities (broker workflow family, error-preservation Spec,
execution-class companion, proposal contract) live on main, so the slice is
authored from canonical `origin/main` = `d1e42f21`. Branch:
`product-480/g7-workflow-collaboration-slice`. `ac-task/501` left untouched.

## Reconciliation result (proposal → current architecture)

The "existing Workflow collaboration proposal" =
`SVC_WORKFLOW_INSTANCE_COLLABORATION_V1` (mayf3/svc-workflow branch
`docs/instance-collaboration-authority-v1` @183c85c, PR #60 "docs(authority):
WORKFLOW_INSTANCE_COLLABORATION_V1 candidate — AUTHORITY_GATE=PENDING"),
carrying three documents: PRODUCT_BOUNDARY_V9 (proposed) + ARCHITECTURE_V0_4_2
(proposed) + the implementation Spec (proposed, `implementation_authority:
none`). Independent review record inside PR #60: PASS at final head 183c85c,
fit for the ONE Owner exact-head acceptance.

Fresh drift census since the proposal's base `ed99fa0` (2026-09-15):

1. **svc-workflow main (7c533cf)**: (a) a COMPETING whole-successor
   architecture candidate `SVC_WORKFLOW_ARCHITECTURE_V0_4_3` now exists with an
   explicit "Concurrent Architecture candidate gate" — exactly one acceptance
   order vs the collaboration candidate's V0_4_2 is lawful; silent partial
   composition is forbidden; (b) the HTTP contract bundle drifted
   (errors.json/openapi/dto/error.rs all changed since base) — CTR-12's
   "number chosen at implementation time" re-basing will land on a newer
   bundle; (c) ZERO collaboration code/routes on main (grep-verified).
   → svc-workflow-side implementation is **authority-blocked three ways**:
   repo-local governance ("no implementation without an accepted
   implementation-authorizing Spec in the PR base"), PR #60's own acceptance
   packet (`IMPLEMENTATION_ALLOWED=NO`; "implementation follows under the
   accepted spec"), and the V0_4_3 concurrent gate. This slice therefore does
   NOT touch svc-workflow.
2. **dsh-agent-core main (d1e42f21)**: the broker workflow family matured
   far past the four read manifests — `workflow_execute` (the single
   instance-execution write entry, four frozen ops), `workflow_assistance`
   (read/action/request split-family template), accepted
   DOMAIN_INSTANCES_BROKER_V1 (allOrNone cursor mechanism), accepted
   BROKER_ERROR_PRESERVATION_V1 (error tables + verbatim passthrough +
   declared-codes-only + no-retry), accepted EXECUTION_CLASS_BROKER_V1
   (companion declaration precedent), RETURN_POLICY_EXHAUSTED_DECLARER_V1
   (the merged riding precedent: implementation authored against a PROPOSED
   governing Spec, merge-gated on its acceptance, Spec accepted 2026-09-29).
   ZERO collaboration capability anywhere (grep-verified).

**CURRENT_GAP (deterministic):** agents have no broker path to the
collaboration feed/append the proposal defines; when svc-workflow lands the
side-band post-acceptance, Agent Sessions would still be unable to use it.
The smallest coherent missing read/write collaboration path implied by the
proposal (CTR-10 routes + CTR-13 consuming surface) is exactly two thin
broker manifests — read (`workflow.read`) + append (`workflow.execute`,
trusted Idempotency-Key) — requiring no new service, DB, scheduler, watcher,
auth authority, control plane or parallel backend.

## DEVELOPMENT_PREFLIGHT

Emitted before first code change (full text in the PR description). Key
values: Governing Spec = NEW candidate `AGENT_CORE_WORKFLOW_COLLABORATION_BROKER_V1`
authored docs-first in this slice (PROPOSED; implementation rides it per
merged-main precedent 7655a817 and the ERROR_PRESERVATION_V1 preserved-WIP
header model; NOT authorized for merge until Owner acceptance flips
`implementation_authority` to contracts). Reused accepted authorities:
BROKER_ERROR_PRESERVATION_V1, DOMAIN_INSTANCES_BROKER_V1,
ASSIGNEE_TRANSITION_CAPABILITY_V1 (§25 non-interference — collaboration
append is deliberately NOT a workflow_execute op), EXECUTION_CLASS_BROKER_V1.
Previously rejected alternatives not reopened (Context-reuse /
Assistance-reuse models rejected by Owner ruling ACCEPT_WITH_SIMPLIFICATION
2026-09-15; 'context-entries' naming forbidden). Need new/amended Spec = YES
→ candidate authored in-slice; PR carries AUTHORITY_GATE=PENDING; NOT merged
by this lane.

## CHANGED_FILES (exact)

- NEW `packages/broker/src/capabilities/workflow-collaboration.js` — two
  pure-data manifests (`workflow_collaboration_read` op `feed`;
  `workflow_collaboration_append` op `append_entry`) + family array.
- `packages/broker/src/capabilities/manifests.js` — +1 re-export line.
- `packages/broker/src/index.js` — +1 import name, +1 DEFAULT_MANIFESTS
  spread line.
- NEW `packages/broker/test/workflow-collaboration-capability.test.js` —
  focused RED-first battery (13 tests).
- NEW `docs/specs/AGENT_CORE_WORKFLOW_COLLABORATION_BROKER_V1.md` —
  governing Spec candidate (docs-first; GOVERNING_SPEC of the riding WIP).
- NEW `docs/evidence/product-480-g7-workflow-collaboration-slice-20261007/`
  (this REPORT + RED/GREEN/mutation/regression logs — force-added past the
  global `*.log` gitignore per repo precedent, so the evidence chain is in
  the PR).
- NO change: packages/broker existing manifests, svc-workflow (entirely
  untouched), product-api, scheduler, production-runtime, docs/decisions,
  profiles, scripts.

## TESTS

1. **RED** (`red-module-absent.log`): `Cannot find module
   .../capabilities/workflow-collaboration.js` — 0 pass / 1 fail before any
   implementation existed.
2. **GREEN** (`green-focused-collab.log`): focused battery PASS (13/13 at
   r1; 14/14 at r2 after the review-added non-interference guard test) —
   scope-split freeze (workflow.read vs workflow.execute), CTR-10 route/body/
   query/wire freeze (incl. allOrNone keyset triple, limit 1..100 with
   `invalid_pagination`, IK on append only, no-Kind/no-author/no-observed-*
   model fields), proposal §3 error-table declarations (both NEW declarer
   codes), DEFAULT surface registration exactly-once, feed forwarding +
   verbatim envelope, absent-cursor/limit non-forwarding, half-cursor + limit
   bounds fail-closed with ZERO downstream requests, trusted IK (model-supplied
   key ignored), optional-reference key omission (request-hash identity),
   missing-body fail-closed locally, verbatim error passthrough ×7 codes with
   requestId and no-retry, 404 not-visible family, undeclared-code
   fail-closed to `http_4xx` (no wildcard).
   Invocation note: machine's pnpm store is dead (primary checkout's
   `@deepseek-ai/dsh-tools` symlink dangles; verified in primary too), so
   runs used an UNCOMMITTED local resolution hook mapping `@deepseek-ai/*` to
   the deepseek-harness source tree; hook lives in /tmp, changes no tested
   code, and the broker full suite is green under it (below). Healthy
   environments reproduce with plain `node --test`.
3. **Mutation bite** (`red-mutation-ik-removed.log`): removing
   `idempotencyKey: true` from the append manifest fails exactly the freeze +
   IK-behavior tests (2 fail), source restored via in-place revert;
   post-revert GREEN re-confirmed 13/13.
4. **Regression set** (`regression-broker-full.log`): the FULL broker test
   suite `node --test 'packages/broker/test/*.test.js'
   'packages/broker/test/*/*.test.js'` = **517/517 PASS, exit 0** — includes
   the pre-existing index.js-importing suites (agent-directory, self-ops-v3,
   workflow-assistance-request, agent-session-messaging) which are otherwise
   unrunnable on this machine pending a pnpm-store repair.

## SPEC_COMPLIANCE (vs the governing candidate at its own head)

- SPEC_GATE = PENDING (candidate is PROPOSED; merge authorization is exactly
  the Owner acceptance of AGENT_CORE_WORKFLOW_COLLABORATION_BROKER_V1).
- SPEC_COMPLIANCE = PASS for the riding WIP against the candidate's frozen
  R1–R4 (capability split, frozen parameter surface, server-side authority,
  error-preservation discipline, zero workflow_execute interference).
- GOVERNING_SPEC_UNMODIFIED = n/a (the governing Spec is itself new in this
  PR and is NOT self-accepted; its semantics were not edited after the
  implementation was frozen — both committed together).

## REVIEW

One independent exact-head changed-surface review at head `b67ed87d`:
verdict **REVISE** — 1 blocker + 1 major + 4 minors, all repaired in the
follow-up commit on this same PR branch:

- **B1 (blocker, repaired)**: the index.js wiring had REPLACED the
  `...okrManifests,` spread line instead of inserting — silently dropping
  `okr_read` from DEFAULT_MANIFESTS (runtime-verified by the reviewer: 54
  manifests, okr_read absent; escaped the suite because no existing test pins
  okr registration). Repair: restored `...okrManifests,`; the delta is now a
  pure 1-line insertion (55 manifests; okr_read/collab counts pinned by a NEW
  non-interference guard test).
- **M1 (major, repaired)**: the four cited evidence logs were gitignored
  (`*.log`) and absent from the commit; force-added past the global gitignore
  per repo precedent (7a70b95d).
- **m1**: CTR-4's 404 `current_visit_not_found` noted in spec R4 as an
  intentionally undeclared code (structurally unreachable; fails closed).
- **m2**: closed both manifests' argument schemas (`additionalProperties:
  false`) for local fail-fast parity with the strictest family member;
  freeze test pins it.
- **m3**: acknowledged, no change (local length validation is an explicit
  R2 freeze; svc owns the declared 422 invalid_input).
- **m4**: this section's forward reference removed; verdict recorded.

Delta re-review at the amended head: see PR description for the final
verdict line.

## PR

ONE PR to `mayf3/dsh-agent-core` from `product-480/g7-workflow-collaboration-slice`,
title `[PRODUCT #480 / G7] Workflow collaboration broker capability —
NON-PRODUCTION candidate (spec PROPOSED + riding WIP, AUTHORITY_GATE=PENDING,
do not merge without merge gates)`. NOT merged by this lane.

## NEXT_GATE

1. Independent semantic review verdict on the PR (SPEC_RECOMMENDATION).
2. Owner exact-head acceptance of AGENT_CORE_WORKFLOW_COLLABORATION_BROKER_V1
   (flips implementation_authority to contracts; riding WIP becomes mergeable).
3. svc-workflow side remains Owner-gated separately: PR #60 acceptance
   (modulo the V0_4_3 concurrent-candidate gate), then the service-side
   implementation/deployment round — prerequisite for any installed/enabled/
   business-verified state of Product #480's DONE_WHEN.

## REMAINING_ACCEPTANCE (NOT executed in this command)

- All svc-workflow-side CTR-1..13 implementation, migration, contract-bundle
  digest, integration/e2e scenarios (§4.1 handoff, M1–M10) — separate
  authority-gated round in mayf3/svc-workflow.
- Product #480 DONE_WHEN install/enable/business-verification — requires
  PROD_AUTH; explicitly out of this slice.

PRODUCTION_MUTATION = NO.
