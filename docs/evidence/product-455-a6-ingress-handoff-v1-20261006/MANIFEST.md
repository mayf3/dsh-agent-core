# PRODUCT_455_A6_INGRESS_HANDOFF_V1 — acceptance packet

```text
PRODUCT = mayf3/dsh-agent-core#455 ([PRODUCT A6] Stable ingress / bounded runtime handoff)
EXECUTION = agent-control#457
CLAIM_TOKEN = a6-stable-ingress-r255
SCHEDULER_ROUND = cap-20261005T231643Z-255
EXECUTION_SESSION = sess_4208616d-82a9-47c6-b01e-ab954089c55f
BASE = origin/main 556ea5b4 (Merge PR #485) — branch product-455-a6-ingress-handoff-20261006
DATE = 2026-10-06
ACCEPTANCE_MODE = TEST_IDENTITY
PROD_AUTH = NONE
PRODUCTION_MUTATION = NO
```

## WHY THIS BASE (deviation from EXECUTION_HEAD e9699aee, declared)

The round-255 claim recorded EXECUTION_HEAD = e9699aee (the launcher's
worktree base, the `goal/workflow-assignee-admission-guard-v1` lineage, ~1478
commits behind product main). Fresh-read of CURRENT MAIN (standing instruction)
showed the ingress capabilities this Product concerns are MERGED on main under
accepted specs (`NOTIFICATION_INGRESS_SERVICE_AUTH_AND_IDEMPOTENCY_V1`,
restart-boundary C11-R3, `TurnReconciliationStore`). Program #382 forbids
reimplementing merged capability "merely because production is stale"; building
A6 on the stale lineage would have forced exactly that. The merged-PR
convention (PR #485 merged 2026-10-06) is main-based branches. The changed
surface below therefore does not and cannot overlap the active writers:

- Product #465 / agent-control#454: surface = `docs/evidence/product-465-*`
  (verified: branch ac-task/454 @ 268d2bf6 — evidence-only, committed+pushed).
- Product #470 / agent-control#456: VERIFY_ONLY scheduler due-slot census;
  worktree ac-456 clean at e9699aee, nothing pushed at edit time (re-checked
  immediately before edits).
- CONFLICT_CHECK = CLEAN (disjoint files AND disjoint worktrees).

## DEVELOPMENT_PREFLIGHT

```text
Problem =
  A6 DONE_WHEN: ingress/runtime handoff explicitly mapped, bounded,
  restart-safe, independently verifiable — no new platform, not a W1/read-only
  prerequisite. Current main has every mechanism piecewise; the compose-level
  SEAM (authenticated deliver durably reserved + parked in flight, crossing
  the controlled stop, next boot on the same root reusing it idempotently with
  zero re-admission) was pinned nowhere, and no single explicit map existed.
Governing Spec =
  NOTIFICATION_INGRESS_SERVICE_AUTH_AND_IDEMPOTENCY_V1; HR_RESTART_LOST_FENCE_
  TRUSTED_RECOVERY_SPEC_V2; AGENT_PROCESS_LIFECYCLE_HARDENING_V4;
  AGENT_WORKSPACE_SESSION_V2_CORE_ALIGNMENT_SPEC;
  AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V2;
  SCHEDULER_CONTROL_PLANE_RELIABILITY_V1 (all status: accepted on this tree)
Spec status = accepted (all cited)
Relevant investigations =
  docs/reports/AVAILABILITY_DEPLOYMENT_ROADMAP_20260930.md (§3, §12);
  docs/investigations/ingress-runtime-handoff-map-v1.md (authored by this lane)
Relevant decisions =
  ACC-030 (scheduler V1 stuck path removed — respected, not referenced);
  no decision modified
Previously rejected alternatives =
  none reopened; no new platform/queue/watcher/database introduced
Frozen boundaries =
  Router semantics unchanged; V2 gate untouched; dedup authority stays in the
  SDK pipeline (V2 spec); no production deploy/restart/sudo/credentials/config/
  store mutation; no Remote Desktop; no UNKNOWN replay; A6 not a read-only
  delivery prerequisite
Implementation scope =
  ONE new test file (compose-level restart-handoff pin, RED-proven) + ONE
  investigation map doc + this packet. ZERO source change.
Out-of-scope =
  durable Feishu dedup (needs V2 AMEND — not started), production
  install/enable/verify, svc-workflow, PR merging
New evidence =
  main's compose-level restart coverage disables the ingress
  (restart-boundary.test.js:106) and the HTTP graceful-stop test has no
  in-flight delivery (compose.test.js 'graceful stop closes the HTTP
  surfaces'); idempotency crash windows W1-W4 run plugin-standalone with a
  stub router. The seam is unpinned.
Need new/amended Spec = NO
```

## CHANGED_FILES (complete)

| File | Kind | Bytes |
|---|---|---|
| `packages/production-runtime/test/ingress-restart-handoff.test.js` | NEW test (zero source change) | see artifact-identity.txt |
| `docs/investigations/ingress-runtime-handoff-map-v1.md` | NEW evidence map | see artifact-identity.txt |
| `docs/evidence/product-455-a6-ingress-handoff-v1-20261006/*` | NEW acceptance packet | this directory |

`git diff origin/main` (tracked files) = EMPTY. Zero source change — reviewer-
confirmed (`ZERO_SOURCE_CHANGE_CONFIRMED = YES`).

## RED → GREEN (RED-first discipline)

Final state is test-only, so RED is proven by temporary MUTATION of the source
under test (applied, run, REVERTED; final tree pristine):

| Mutation | Broken guarantee | Result |
|---|---|---|
| M1 `notification-ingress-runtime.js`: storeFile decoupled from `layout.notificationIdempotencyStore` | persistent handoff wiring (C-WIRE) | 0 pass / 2 fail — `red-m1-store-path-decoupled.log` |
| M2 `compose.js`: `writeBoundary('quiesce_begin')` dropped | boundary evidence (C11-R3) | 1 pass / 1 fail (receipt test) — `red-m2-quiesce-begin-dropped.log` |
| reverted, pristine | — | 2 pass / 0 fail, 10/10 consecutive deterministic runs — `green-focused-test.log` |

## TESTS (2026-10-06, /usr/local/bin/node v25.6.1 = repo-pinned TARGET_PROXY_NODE_VERSION)

| Suite | Result | Log |
|---|---|---|
| new ingress-restart-handoff.test.js | 2/2 pass; 10/10 consecutive runs | green-focused-test.log |
| packages/production-runtime (incl. new file) | 176 tests: 175 pass / 0 fail / 1 skip | regression-production-runtime.log |
| packages/notification-ingress | 61 tests: 60 pass / 0 fail / 1 skip | regression-notification-ingress.log |
| packages/scheduler | 399 pass / 0 fail | regression-scheduler.log |
| packages/agent-router | 484 tests: 477 pass / 5 fail — ALL 5 reproduce on PRISTINE origin/main (broker-rpc seam x2, luna-credential-chain real-child/credential x3); environment seams, unrelated to this lane | regression-agent-router.log |

Worktree-local env note: running main's test graph required `npm install` plus
machine-local `@deepseek-ai/dsh-tools` / `@larksuite/channel` artifacts linked
into worktree node_modules (untracked). No repo file outside the CHANGED_FILES
list was modified.

## REVIEW (one independent changed-surface review — fresh-eyes agent, full source verification)

```text
REVIEW_VERDICT = PASS
BLOCKING_ISSUES = NONE
ZERO_SOURCE_CHANGE_CONFIRMED = YES
TEST_PASSES_3X = YES
```

Reviewer independently verified against source: C-IDM-004 reserve-before-router
(deliver-handler.js:155/170); boot sweep + `restart_unresolved` +
`boot_unresolved_sweep` (idempotency.js:132-147,311-327); terminal replay shape
{200, accepted:false, outcome_unknown, duplicate:true} with zero Router calls
(wire-response.js:96-105, deliver-handler.js:162); quiesce receipt order +
census shape (compose.js:632-672, restart-boundary.js:43-75); disposer
semantics (notification-ingress/src/index.js:205-209); unref'd deadline timer
(no hang); no writes outside throwaway roots; gap claim honest (no pre-existing
coverage of this seam); suites coexist (full production-runtime glob run
including the new file, no interference).

Non-blocking reviewer notes → disposition:
1. map doc STUCK_RUN_MS claim wrong (removed per ACC-030) → FIXED in map doc.
2. map doc runningAtMs claim not reproducible (occurrence ledger decides) → FIXED.
3. AGENT_PROCESS_LIFECYCLE_HARDENING_V3 is superseded; V4 accepted → FIXED (V4 cited).
4. restart_lost qualifier ("only when the epoch was never durably observed") → FIXED.
5. test 2's post-settle re-assertion is tautological-but-harmless → KEPT AS
   REVIEWED (test bytes identical to the reviewed surface; noted here).
6. §3 referenced the packet before it existed → resolved by this packet.

## DONE_WHEN mapping (TEST_IDENTITY scope)

| DONE_WHEN clause | Evidence |
|---|---|
| explicitly mapped | docs/investigations/ingress-runtime-handoff-map-v1.md |
| bounded | pinned: deadline (default 300000ms, unref'd), bounded drain, closed ingress surface at stop, quiesce receipts |
| restart-safe | pinned: reservation survives boundary; boot sweep → outcome_unknown(restart_unresolved); idempotent replay, zero re-admission |
| independently verifiable | standalone `node --test` file, no network beyond 127.0.0.1, no ~/.agent-core touch, deterministic 10/10 |
| no new platform | zero source change; reuses existing runtime/ingress mechanisms only |
| not a read-only-delivery prerequisite | nothing added in front of any read surface |

## EXACT REMAINING BOUNDARY (frozen; not claimed done)

- BUSINESS_VERIFIED = no. Production enablement/verification of any ingress
  surface (real Feishu entry, real authenticated caller, real restart) remains
  gated by standing production rules (PROD_AUTH, serialized DS surface,
  canary + rollback contract, disk-budget gate).
- Durable Feishu-side dedup ledger intentionally NOT built — dedup authority is
  frozen inside the SDK safety pipeline by AGENT_CORE_LARK_CHANNEL_SDK_
  INTEGRATION_V2; changing it requires a spec AMEND.
- Next bounded action for #455 if promoted again: carry this packet + branch
  into an Owner review/merge decision (PR opening left to the scheduler; no
  merge performed here).

## VERDICT

See VERDICT.txt. SOURCE=merged (main already contains the capability);
INSTALLED/ENABLED unchanged by this lane (non-production);
ACCEPTANCE(TEST_IDENTITY)=PASS; PRODUCTION_MUTATION=NO.

## REVIEW_FIX r262 (SAME PR #487, REVIEW_FIX_ONLY — claim `a6-pr487-review-fix-r262`, agent-control#460)

Exact-head independent review `5422747406` (Codex, at `af9733e1`) reported a two-item
blocker union. Both findings were re-verified against exact-head bytes BEFORE editing and
both are technically valid; this section fixes the whole union. The review's third finding
(test-directory ceiling, comment 4190610898) is NOT part of the verified blocker union →
FOLLOW_UP_DEBT, not implemented this round.

### P1 — the seven cited test logs were hashed but not committed (evidence provenance)

Verified at `af9733e1`: the tree tracked ZERO `.log` files; the seven logs below existed only
as untracked files in the preserved execution worktree `ac-457` (clean at `af9733e1`), blocked
from tracking by the global `.gitignore:3` `*.log` rule. Disposition: RECOVERED from the
preserved worktree — all seven recovered copies hashed byte-exact against the r255
`artifact-identity.txt` values BEFORE any edit — then sanitized with the single mechanical
rule

```text
/Users/yanfenma  →  <LOCAL_HOME>
```

(local-username worktree paths leaked into stack-trace file URLs in red-m1, red-m2 and
regression-agent-router; scanned: no secrets, credentials, private runtime data, production
dumps, or personal data otherwise present — Feishu `oc_*`/`ou_*` strings in the logs are
synthetic test fixtures). Logs with zero `/Users/` occurrences are byte-identical to their
r255 captures. Both hash generations are recorded in `artifact-identity.txt`:
`R255_CAPTURED_SHA256` (original bytes = the reviewed r255 surface) and the committed
sanitized bytes now retrievable at these repo paths. Logs are force-added
(`git add -f`) past the global `*.log` ignore; `.gitignore` itself is intentionally NOT
modified (shared file, outside the blocker union).

Additionally committed: the r262 round's own logs (`r262-*.log` below), produced in a fresh
detached worktree at `af9733e1` (`pr-487-review-fix`, node_modules shared read-only with
ac-457); the preserved ac-457 worktree and its untracked originals are untouched.

### P2 — negative duplicate-replay path awaited `post()` unbounded

Verified at `af9733e1`: `ingress-restart-handoff.test.js:216` awaited the replay POST with no
bound; on a regression that re-admits the replay into the Router, `GatedProc.deliver()` parks
until teardown and the response resolves only under the ingress default 300000 ms Router
deadline (`packages/notification-ingress/src/auth.js:63`
`DEFAULT_ROUTER_DEADLINE_MS = 300000`). Disposition: smallest deterministic TEST-ONLY bound —
the replay `post()` is raced against a 5000 ms unref'd timer that releases the gate and
resolves `{boundExceeded: true}`; a leading assertion fails promptly with the
unexpected-admission diagnostic. Zero production/source behavior change.

RED proof of the failure-bound mechanism — same applied-then-reverted source mutation on
`packages/notification-ingress/src/deliver-handler.js:162` (terminal duplicate branch
disabled → replay re-admits; reverted afterwards, tree pristine):

| Variant | Result |
|---|---|
| HEAD test (unbounded) + mutation | STALL — still parked at the 45 s kill bound (`r262-red-stall-observation-unbounded-mutation.log`); would resolve only under the 300000 ms deadline |
| r262 test (bounded) + same mutation | FAIL at ~6 s wall-clock: "replay was not answered from the durable outcome within 5000ms — unexpected Router re-admission parked the response" (`r262-red-replay-bound-mutation.log`) |
| mutation reverted, pristine | 2/2 pass, deterministic ×3 (`r262-green-focused-test.log`) |

### r262 TESTS (2026-10-06, /usr/local/bin/node v25.6.1, detached worktree pr-487-review-fix)

| Suite | Result | Log |
|---|---|---|
| focused ingress-restart-handoff.test.js (r262 bytes) | 2/2 pass, ×3 consecutive | `r262-green-focused-test.log` |
| packages/production-runtime (incl. r262 test file) | 176 tests: 175 pass / 0 fail / 1 skip — identical to the r255 baseline | `r262-regression-production-runtime.log` |

The r255 notification-ingress / scheduler / agent-router suite logs are committed unchanged:
the r262 delta is the test-only bound in the production-runtime suite (re-run green above);
the notification-ingress source was mutation-touched only under RED and reverted (drift check
below). Their r255 logs remain load-bearing for this packet and are now in-repo retrievable.

### r262 drift + conflict re-check

- `git diff af9733e1` (tracked) = exactly `packages/production-runtime/test/ingress-restart-handoff.test.js` (test-only bound) + `docs/evidence/product-455-a6-ingress-handoff-v1-20261006/*` (provenance). Zero source/behavior drift.
- Product #456 / agent-control#458 surface = `packages/scheduler/*` (worktree ac-458) — zero file intersection with this delta.
- B7/Core414 ownership records agent-control#417/#424 = deployment/DS observation surfaces (B7 artifacts at `e4c033d4`) — zero file intersection with this delta.
- FOLLOW_UP_DEBT (not this round): review `5422747406` comment `4190610898` — `packages/production-runtime/test` direct-child count vs its registered ceiling; needs a placement decision as a separate bounded action.
