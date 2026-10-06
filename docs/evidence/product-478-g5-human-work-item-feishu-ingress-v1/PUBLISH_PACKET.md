# PUBLISH_PACKET — Product #478 (G5) NON-PRODUCTION implementation lane

Claim: `g5-feishu-human-work-item-r316` · Execution: agent-control#492 ·
Product: mayf3/dsh-agent-core#478 (Program #382, Goal #386, Epic #381/G5)

## EXACT_HEAD

- Branch: `product-478-g5-human-work-item-feishu-ingress` (from
  `origin/main` @ `d1e42f21`)
- Head: `7ced6f58` — three commits on main:
  `919ee8ba` (authoring: seams + RED-first 34-test matrix) →
  `322bff68` (independent-review fixes: 2 load-bearing gaps + minors) →
  `7ced6f58` (lane evidence completion: matrix / review record / spec
  candidate outline / this packet)
- Changed surface vs main: 7 code/doc files, +~1600/−0 —
  - `packages/production-runtime/src/human-work-item-ingress.js` (NEW seam)
  - `packages/production-runtime/test/human-work-item-ingress.test.js` (NEW 34-test matrix)
  - `packages/agent-router/src/index.js` (+10: additive `routeAuthenticated`)
  - `packages/production-runtime/src/compose.js` (+36: env-gated wiring block + imports)
  - `docs/evidence/product-478-g5-human-work-item-feishu-ingress-v1/*` (5 docs)

## PR_OR_PACKET

PR (DRAFT, NOT merged): mayf3/dsh-agent-core —
branch `product-478-g5-human-work-item-feishu-ingress` → `main`.
Merge is Owner-gated on the spec path (see SPEC_CANDIDATE_OUTLINE.md →
docs/specs/AGENT_CORE_HUMAN_WORK_ITEM_INGRESS_V1.md acceptance, merge-gate
G2). This lane performs NO merge, NO install/restart/deploy, NO production
mutation of any kind.

## TESTS

See RED_GREEN_TESTS.md. Lane suite 34/34 GREEN; focused regressions show
zero new failures vs pristine origin/main (side-by-side verified);
compose-level suites are blocked by the pre-existing
TARGET_PROXY_NODE_VERSION=v25.6.1 pin in this Node v26.7.0 environment
(fails identically without this branch).

## REVIEW

Independent changed-surface review r1: REVISE / LOAD_BEARING_GAPS=2 → both
repaired and pinned (reply-target `.replyTo` contract; fall-through outcome
propagation), 4/5 minors fixed, audit-rotation minor deferred with a
promotion gate note. Full record: INDEPENDENT_REVIEW.md.

## REMAINING_DONE_WHEN (what stands between this branch and Product #478 closure)

1. Spec path: promote SPEC_CANDIDATE_OUTLINE → accepted
   AGENT_CORE_HUMAN_WORK_ITEM_INGRESS_V1 (independent design review + Owner
   acceptance); only then may the PR merge (GOVERNING_SPEC_UNMODIFIED holds —
   this branch touches no accepted Spec).
2. Executor identity provisioning: create the allowlisted executor
   principal + MachineClient + `workflow.read`/`workflow.execute` grants via
   the EXISTING provisioning surfaces (AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1
   / workflow-admin bootstrap) and bind its credential entry in the 505
   store; author the principals allowlist (test identity first:
   humanPrincipalId = 8902db0d-… per PROJECTION_V0).
3. Production hardening on the seam before enablement: audit JSONL size
   cap/rotation; principals-file reload story (restart-bounded today).
4. Human-actor contract (optional, separate spec path): auth-service +
   svc-workflow change to let the canonical HUMAN principal be the workflow
   actor (today: agent-only verifier gate + agent|service MachinePrincipal
   enum). Until then the actor is the executor principal by frozen design.
5. TEST_IDENTITY acceptance run (non-production runtime + canary workflow
   instance), then Owner-gated enablement and real-Feishu business
   verification (BUSINESS_VERIFIED) — out of this lane.

## PRODUCTION_MUTATION

NO. No deploy/restart/install/sudo/credential mutation/data-store write;
no merge; no Remote Desktop; no UNKNOWN replay; no process cleanup.
