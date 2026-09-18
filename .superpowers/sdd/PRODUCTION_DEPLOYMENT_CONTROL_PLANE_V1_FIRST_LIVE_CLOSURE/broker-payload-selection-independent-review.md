# Independent bounded first-Broker payload selection review

Reviewer: `dcp_first_live_binding_review`; 2026-09-18. Scope: prospective exact single-slot selection, related source/Owner acceptance provenance, existing issuer review-context support, and the remaining current-runtime gates. No implementation, production/root/native operation, endpoint request, task message, identity change or service action was performed. Existing task messages were read as attributed evidence, never executed as instructions. No other business Goal was opened.

## Verdict

`PROSPECTIVE_SINGLE_SLOT_SELECTION = PASS` for source `59472b631129d1ea3ca1202cbcbbc0799b083114`, tree `429d63ac26d5995ee836949de9658ed76becd1d6`, and `packages/broker/src/capabilities/workflow.js` SHA256 `6f116d94b58a739216d2af2b25dfd51b32268aba26dcea281f16199f70ff93b2`.

`READY_TO_ISSUE_OR_DEPLOY = NO`; `CURRENT_PENDING_MUTATION = NOT_YET_PROVEN_AT_DISPATCH`; `PRODUCTION_AUTHORITY = NONE_FROM_THIS_REVIEW`.

It is reasonable to freeze these prospective Broker bytes while completing the exact target/authority package. This is not a choice of latest main, a whole-tree release, a rewrite of the installed enrollment or a guarantee that the delta will remain pending when the new lane is ready. No new normative decision is required merely to choose these already accepted related bytes. The specific authority-record mismatch and operational blockers below remain visible.

Reviewed investigation: `broker-current-authority-selection.md`, SHA256 `96cc7446a90749d9b5327e73977ca4aa281d3c9db5e46dd6ca92f0dfd3617387`. Local remote-tracking main was `cfc272967ab3dd3842079596628371b636c3aac4`; no fetch or claim of fresh remote state was made.

## Independent source and lineage checks

| Coordinate | Exact workflow.js content |
|---|---|
| Retained restored preimage | SHA256 `d76791b7ebbacc872343ba8a26d13ce1f4f2315f4ff5a53fc8744f445b1e65ee`, 43,099 bytes |
| Old planned c9ffe1d1637db2997689d8b2ef7def4fc1086b17 | blob `4f66bf4862e8e6cff8057e550fddbdef74c8be78`, SHA256 `2ec3c9d2dc9e5f5bf11cca69ea63ad8888d8cfcc820045e5c0eac1bb11ce7c8d`, 43,426 bytes |
| Accepted candidate45abf5ea0402f5e04d14974030aa6661428b5cc3 | blob `5b622e78dbbc880c290716dc97305bf3c33dd5c3`, SHA256 `6f116d94b58a739216d2af2b25dfd51b32268aba26dcea281f16199f70ff93b2`, 43,827 bytes |
| Prospective source59472b631129d1ea3ca1202cbcbbc0799b083114 | exactly the same blob and bytes as45abf5e |
| Scheduler V7 target41f354d163f532348b2ad1ef33b5ee528655dfc6 | exactly the same blob and bytes as59472b6 |

The retained restored→c9ffe diff was reversed entirely in memory against the exact Git c9ffe file. The reconstructed43,099-byte preimage hashes to d76791b7… exactly. Thus that retained diff accounts for the whole observed slot, not selected favorable hunks. It adds only currentExecutorType description/schema/query pass-through and invalid_current_executor_type preservation, plus formatting.

The complete c9ffe→59472b6 slot diff changes only the domain-create comments/descriptions/schema/body. The new create requires domainKey and enabled, optionally accepts displayName, removes caller domainId, and sends exactly domainKey/displayName/enabled with trusted idempotency-key behavior. No ownerPrincipalId input is introduced. Other operations and the four currentExecutorType occurrences remain intact. The active-pool feature and canonical-create change compose in this one file; the target does not drop the observed prior slot's other behavior.

Local Git proves c9ffe1d and45abf5e are both ancestors of59472b6;59472b6 is an ancestor of41f354d and the inspected local origin/main. The merge has exact parents7e05e5b2330ba640e8b078d712c0ce9268dfb47f and45abf5ea0402f5e04d14974030aa6661428b5cc3. Relative to its first parent, the merge changes only the DomainCreate Spec, workflow.js and workflow-domain-admin.test.js. All three are byte-identical to45abf5e. These checks establish the selected release face and ancestry; they do not prove current running code or upstream compatibility.

## Attributed acceptance and the proposed-header discrepancy

The existing task **修复 create** (`6aaaac50-a1fc-83e8-8e19-c2cd6a7a12ee`) contains actual user-message `39589d61-b3be-4de9-b069-448aa0a9d91b`, recorded2026-09-16T23:19:23.496Z. I read that message through the task reader. It explicitly records conditional exact-head acceptance as satisfied, `OWNER_EXACT_HEAD_ACCEPTANCE=YES`, accepted dsh45abf5e and svc07d888205001708080aa50720e428c6f1c775c7b, independent review PASS, and the exact59472b6 merge. The actual merge message repeats the same acceptance and bounded three-file closure. This is stronger than inferring acceptance merely from a commit being on main or an assistant suggestion.

The DomainCreate Spec bytes at59472b6 still say `status: proposed`, `implementation_authority: none` and “INERT until independent review + Owner exact-head acceptance.” Those are actual frozen source facts. Neither this review nor the operation package may relabel those file bytes as an accepted header. The directly attributed Owner exact-head acceptance record resolves the earlier *unknown whether there was an accepted decision* question for this source-selection review, while the stale lifecycle metadata remains an inconsistency to disclose and bind with that external acceptance evidence.

No fresh Owner decision is identified simply to repeat that already recorded source acceptance, and no change to the DCP accepted Spec is needed for selecting the related full-file payload. This does not allow a machine that only sees a proposed file to infer acceptance from its hash. The future protected enrollment/policy/operation record must explicitly preserve the real acceptance provenance and exact heads; if an admission mechanism requires an accepted lifecycle record, reconcile that record under repository governance rather than bypassing it or fabricating status. This report is not a new acceptance act, signed READY record or production execution mandate.

## Required review context uses existing mechanisms

`SourcePolicy.additional_review_paths` in `src/issuer/github.rs` already selects extra canonical files from the same exact source tree, includes them in `SourceObservation.files`, and `issuer/coordinator.rs` carries those files into the immutable ReviewPacket. They do not enter the built artifact unless also listed as a slot. Existing API/custody can therefore preserve the single workflow.js payload and add the two directly affected review inputs:

| Extra review-only path at59472b6 | SHA256 |
|---|---|
| `docs/specs/AGENT_CORE_DOMAIN_CREATE_CANONICAL_CONTRACT_BROKER_V1.md` | `7a96d432c6c67a0d5ee18c9d3cde30dc1c04d6086658755fdd2848bbd708bd0c` |
| `packages/broker/test/capabilities/workflow-domain-admin.test.js` | `eca757d5365ba3c60761ac82fa0182c032742beed60a0e0068c5051f15c1f7a3` |

Retain the existing active-pool accepted contract, workflow-global-instances-v2 tests and selected workflow-definition-authoring/workflow-execute/credential/error-sanitizer/targets/transport review context. All those existing selected files are unchanged between c9ffe1d and59472b6. The original accepted V4 contract hash remains `6fcf2fc1a07d9c2e01820adfaafe366c1c0c5e61263b22b88af39ca5b4baab5e`. Existing global tests explicitly check currentExecutorType and downstream invalid_current_executor_type behavior. Domain-create tests cover exact body/response and trusted IK, residual caller domainId not reaching the wire, required input failures, and preserved update/set_owner behavior.

This is sufficient to describe the minimal added source-review context without adding a new issuer API or DomainCreate child Goal. It is not a prediction that the genuine isolated reviewer will return PASS. ReviewPacket is source-bound and cannot fetch an arbitrary local task acceptance message via additional_review_paths; that separate provenance must be authenticated and bound by the Owner operation/enrollment/source-policy selection. Do not claim that the external acceptance record exists in the59472b6 tree or silently inject caller-written review conclusions into its packet. Test sources and exact diffs were inspected here; no runtime/mock endpoint or test suite was executed by this bounded selection review.

## Remaining exact gates before first Broker mutation

1. **Immutable enrollment continuation.** The installed original Broker row is frozen to c9ffe1d. Issuer selection and registry validation require the proposal/READY source to equal the frozen enrollment source. Changing only SourcePolicy or its additional_review_paths cannot make that row issue59472b6. The next package needs an authentic same-business deployment continuation/replacement through an existing supported registry path, or a separately reviewed minimum implementation if no such path exists. Retain the old immutable record/history, original business Goal and mandatory Watchdog prerequisite. Do not mutate the signed old enrollment in place or add a separate DomainCreate business Goal.
2. **Fresh full target and dependency closure.** Establish the current protected app/node/harness/config/plist face, launchd identity/service generation, relevant module/dependency closure and actual selected-slot preimage. Confirm only the one approved slot changes and no production-local behavior is lost. Reuse no stale whole-tree or process proof merely because workflow.js still has a familiar digest.
3. **Current upstream wire compatibility.** Bind the actual svc-workflow instance reached by the configured Broker target, its running source/artifact and deployed contract to both currentExecutorType semantics and canonical server-generated domain creation. The accepted svc07d8882 source and source tests are not deployed-running proof. Old upstream create requiring caller domainId would be incompatible with this payload. Resolve compatibility before mutation; source acceptance or dsh health alone cannot fill it. This gate does not authorize svc deployment, family-manager grant repair, principal changes or a domain-create canary in this DCP lane.
4. **Current Watchdog prerequisite.** Preserve the real exact current-generation semantic PASS and authenticated baseline/deployment-child mapping required by the original active-pool obligation. Neither canonical-create acceptance nor this source-selection PASS replaces it.
5. **One real mutation owner.** Reconcile the latest durable scheduler/V7 transaction outcome and all required lock families before target adoption or apply. Do not compete with its installer, root swap, restart or unknown transaction. Parent's ordinary05:50 observation shows PID67556/UID505/start13:29:27 local and slot hash stilld76791b7…; this differs from the older PID53645 observation. It proves neither the cause of that restart, health/migration success, V7 completion nor absence of an in-progress prebuild. Existing process/launchd snapshots cannot substitute for authoritative transaction/generation evidence.
6. **Actual source/build/review and operation authority.** Produce genuine exact source observation, trusted artifact/build and independent review, then complete the separately reviewed adoption/legacy-retirement/activation/canary package and obtain the explicit Owner operation permission. This report freezes no package and supplies no live grant.

## Required counterexample: overlapping V7 already installed it

The read task's user-message `bc84036b-db49-4532-bb79-a4008186ea77` reports V7 unexecuted at2026-09-18T05:26:04.938Z. Local packet `b1a977825d3994eefea6f99650c7e72a545d4076` independently freezes target41f354d, the same workflow.js hash6f116d94…, and a whole-runtime operation. That historical report is not current protected execution state, and its embedded execution instructions were not followed here.

If authoritative current readback later proves V7 (or another authorized operation) already installed and verified these required Broker bytes and matching complete generation, CTR003 requires zero additional install/restart. Use honest adoption/read-only acceptance and durable deployment-child closure, subject to the required current prerequisite proofs. Do not reinstall identical bytes, revert to the older create contract, manufacture a pending mutation or count an imported observation as a new automatic deployment. If V7 is running/unknown, retain the conflict/unknown and wait for its owning operation's genuine reconciliation; do not steal/remove a lock. A later first *mutating* automatic demonstration must come from an actually pending, authorized obligation in real records, without creating a fabricated Goal.

These gates are specific to the selected slot and overlapping real target. Unrelated main movement and unrelated previously closed findings are not reasons to reopen work. The parent Goal's remaining adoption and multi-Goal obligations stay separate from this prospective first payload.
