# Independent source review — agent-control#1257

Reviewer: nonauthor `authority_audit` agent. Reviewed 2026-10-31T08:12:11.290435+00:00.

Base: `0386b34a3d1054c71cbe51a2310fdff4d55c992b`. Frozen reviewed source: `38b705a6b2cdd62969bef18b31e69ab974bbc261`. Tracked worktree clean. Governing Specs and Decisions are unchanged.

**SOURCE_REVIEW = PASS. OPEN_BLOCKERS = NONE.** This is exact-source approval within the authorized source/candidate scope. Full comparison, structure verification and the later evidence-only delta remain separate gates.

## Scope and authority

- R1 reuses accepted lifecycle C020–C025 and DCP CTR-DCP-012. It attempts all owned teardown, waits existing real-exit authority, propagates errors, and refuses replacement without the native producer capability, fresh successful stop pair, empty slots, drained durable census, no new unresolved lost handles and native old-instance exit inside the existing unload budget. Boundary receipts never become termination evidence.
- R2 reuses C015–C019 to construct a new candidate and receipt from proof already durable. No original-store write, worker signal, service action, replay or business-outcome upgrade. Full deployed-loader/authority validation runs before and after; unrelated document values and retained outcome/digest survive.
- R3 reuses CTR-R5's existing four-category feed. Startup/fence observations use `other` plus bounded reason metadata, count a failed request once, and add no external destination or Scheduler policy.

## Frozen blocker union and independent verification

| Item | Disposition | Independent evidence |
|---|---|---|
| B1 unrelated Scheduler correlations rejected by singleton recovery | CLOSED | Original two-correlated-record repro now succeeds; source unchanged |
| B3 proof accepted after shared unload deadline | CLOSED | Original 35 ms read / 5 ms budget now refuses |
| B4 native identity broken by Chinese locale | CLOSED | Actual own-child native identity succeeds in C and zh_CN.UTF-8 |
| Producer support floor and identity | CLOSED | Missing/version/instance mismatches refuse before stop |
| Expected owner/file custody | CLOSED | Wrong owner, group/world-writable and hardlinked capability files refuse |
| Capability advertised before stop handlers | CLOSED | SIGTERM and SIGINT are installed before ready evidence emits |
| Workflow-drain admission race | EXISTING BASE BEHAVIOR | Identical Base and candidate probes accept new ingress during parked workflow drain; no global policy expansion requested |

Independent `r2-extra-final.tap`: **4/4 PASS**. Independent `r1-floor-final.tap`: **7/7 PASS**. Original correlation, deadline, signal-order and locale counterexamples were rerun on the frozen source and closed. The reviewer also read implementer R1 **77/77** and relocated R2 **16/16** result artifacts; their hashes are in the JSON receipt. These are distinct from the pending full-suite comparison.

## Limits and remaining gates

- No zero-initial-UNKNOWN claim: the existing workflow drain race can produce new settled termination-only UNKNOWN history. The new restart gate refuses new unresolved lost fences.
- Existing external unload time can expire before a longer worker grace. That must refuse replacement; the PR changes no ExitTimeOut policy.
- An old deployed producer without the new capability is refused before mutation. Producer-first rollout is separate.
- R2 output is a candidate, not live recovery. Its loader hash pins the schema module; its sibling Store/imports must already belong to the trusted deployment described by the runbook.
- Actual 502/505 resource acceptance, production installation, runtime admission, live fence recovery and business acceptance are **NOT_EXECUTED**. No merge or production authority is granted.
- Parent still must bind full same-environment comparison and structure result, then request bounded review of the final evidence-only commit. Existing full-suite debt must remain explicit.

`INDEPENDENT_REVIEW.json` contains all 30 changed-file SHA-256 values, independent artifact hashes, exact tests and the structured gate status. Reviewer changed no task source files.
