# Independent adopted-baseline design review

REVIEWER_ID = dcp_first_live_binding_review
AUTHOR_INDEPENDENCE = PASS
REVIEW_KIND = AFFECTED_CONTRACT_DESIGN
INITIAL_DESIGN_COMMIT = 42989f2a4ccb5c6547473fdb15d9926df7638b2f
INITIAL_DESIGN_SHA256 = e13a926c8adc6dcc4473e894c448f76570bf3316057cb684b0d86ffca459aa84
IMPLEMENTATION_BASE = e8f863fdb5d3b95dc45cd202acee5c1c69124551
AUTHORITY_ACTION = REUSE
SPEC_GAPS = 0
CURRENT_DESIGN_VERDICT = PASS
REVIEW_TARGET_HEAD = f88fb71ea79e8795260056758f333e93447460e6
REVIEW_DESIGN_SHA256 = 50575fe39ef19258f230f24d26c7f1449352fd34fb1c6ed5ab84931b0e28e020
OPEN_BLOCKERS = 0
CLOSED_DESIGN_FINDINGS = D-01,D-02,D-03
IMPLEMENTATION_ALLOWED = YES_WITHIN_THIS_REVIEWED_NONPRODUCTION_SCOPE
OPERATION_ALLOWED = NO

Only adopted-baseline design is reviewed. No source, protected state, live endpoint or installed package is changed. This reviewer checked accepted CTR-DCP-002/003/004/008/009/010/011/013/014/015/017/018 and section7 against the source-base queue/admission, receipt/finalization, physical-generation, issuer and late-verification readers. The design file at its exact commit was SHA256 verified before review. Earlier source FLI-01 is closed separately and is not reopened here.

## Authority and design interpretation

REUSE is supported for a truthful first current observation of an already installed target. CTR003 expressly requires zero reinstall/restart when the required artifact and its generation/metadata are proven; CTR017/018 permit one exact separately authorized target-adoption transaction. CTR002 defines target generation as the daemon installation record, distinct from service process generation. Therefore a newly allocated first canonical intent/generation and explicitly typed current-observation receipt with zero mutating attempts can implement those obligations without fabricating historical apply, importing an old unit or weakening LiveInstallation. Applied must remain only an origin-labelled installation projection; the observation's control-plane writes and current steps must be truthfully receipted.

The fixed first-target scope, empty-ownership precondition, exact Owner package, real authenticated source/build/review/coverage, private proof types, strict receipt-kind dispatch and preserved canonical legacy bytes are required boundaries, not optional conveniences. A general receipt importer, historical PASS converter, arbitrary verifier/signing interface, second mutation lane or migration executor is outside this REUSE decision. No new long-lived Product Contract or Spec amendment is identified by this design review.

## D-01 — observation completion must not clear standing activation before canary

Classification: CONTRACT_VIOLATION in the initial design; priority P1. SOURCE: accepted Spec section7 ordering (real harmless canary precedes standing Train enablement), CTR017/018 activation/adoption, CTR014 separate Goal acceptance.

COUNTEREXAMPLE: Initial design lines69–75 publish active Configuration/DaemonActivation while a pending adoption fence blocks startup. Observation step6 at line86 then removes both adoption/executor fences; step7 at line87 only afterwards requests Goal verification, which may remain Pending/Waiting/Fail. A crash/restart after step6 leaves the active configuration/proof with no described durable adoption-startup fence despite no real required canary PASS. The separate statement that launchd jobs remain disabled is an operational setting, not the declared startup enforcement; baseline completion and standing activation must remain distinguishable.

IMPACT: Ordinary controller startup could satisfy the design's stated fence check before the accepted migration ordering's real canary gate. This is not authorization to enable anything now; it is a design defect to close before coding.

MINIMAL_CLOSURE: Keep the operation's durable standing-activation fence after removing only baseline finalization. Permit only exact operation-bound observation verification and closure while it remains. Clear it through a private exact proof after accepted real canary evidence, current-generation Watchdog PASS and fresh complete physical readback, plus the existing target-adoption/Owner operation gates. Ordinary startup/submission/mutation must reject all intermediate states, including after process restart. Reuse one closed-purpose operation record with distinct phases; do not add a generic activation framework.

## D-02 — a current response tuple cannot freshen historical Watchdog evidence

Classification: REQUIRED_GATE_FAILURE in the initial design; priority P1. SOURCE: CTR004 authenticated evidence, CTR010 real semantic prerequisite outcomes, CTR014/015 exact current-generation Goal verification and truthful receipts.

COUNTEREXAMPLE: Initial line112 signs a current requested unit/attempt/generation tuple over protected Watchdog evidence plus fresh health. Existing verifyPostdeployEvidence (deployment-postdeploy-finalize.js:181–209) checks source/phase and evidence digests, but its returned accepted receipt does not authenticate a complete current ServiceImage/NativeEnrollment binding; scheduler-postdeploy-finalize.mjs:121–125 accepts an existing same-source receipt without even fresh health checks. After restart/restoration with identical source, an adapter could sign the new current request tuple over that older canary receipt. Controller tuple matching alone would then pass even though the semantic evidence belongs to a prior physical generation.

IMPACT: Genuine old evidence can be misrepresented as current Watchdog acceptance, releasing the Broker dependency incorrectly. This is a missing provenance correlation, not a demand to rerun a non-idempotent unknown canary.

MINIMAL_CLOSURE: Require authenticated contemporaneous correlation of accepted canary occurrence and required semantic evidence with exact complete face/NativeEnrollment and service generation, independently checked against fresh controller readback under the mutex. Missing correlation remains Waiting; it cannot be reconstructed from same source/hash, request fields or a fabricated capture. Port the pure semantic checks/test vectors into a fixed trusted observer, never invoke the existing mutating finalizer as an allegedly read-only check. Add old-evidence/new-request tuple and intervening-restart negative cases.

## Fixed-core implementation boundary

Before code authorization, choose the concrete narrow observer/custody and invocation path. Existing CTR008/fixed native architecture forbids candidate JavaScript/Python/shell as root or generic health. Reusing verifyPostdeployEvidence means its semantics/test vectors, not executing the mutable root script. A fixed native observer in the same reviewed controller, using a scoped protected trusted verifier key and the already held MutationGuard, is a compatible minimal direction. It must not acquire a second ownership mutex, wait for itself, accept arbitrary files/commands/signing payloads, or allow an Agent-authored PASS. Any unprivileged alternative needs a concrete authenticated protected-export and identity boundary before implementation.

## Unchanged necessary safeguards checked

The initial design already requires private observation admission rather than generic transition(Applied), no fabricated stop/start history, bounded protected append-only adoption journal, installed publication hidden behind finalization, readback-driven crash recovery and global quarantine for unknown publication. It preserves R02 unit-local versus global safety classification. It requires origin-aware receipt consumers, old canonical-byte tests and strict unknown-kind rejection. Failed adoption has no authority to roll back preexisting target state. A later real mutation may restore that observed baseline only from its own captured preimage and fresh process proof, preserving origin and invalidating prior-generation semantic PASS. These are appropriate direct consequences of the accepted invariants.

The design regression matrix must be executed later; it is not existing evidence. Full source review and full package checks are warranted for the planned persistent-state change. Current real target/canary/source-compatibility proofs and a separately authorized exact adoption/activation packet remain external gates, not fabricated design facts.

## Design correction recheck at 4898cc6

The design-only correction at 4898cc61bd5464270bf00961f3dd27677f97af29, SHA256 9a11856749dc7156502c74b33d11d400013f188dab1c80b38b3e46af6d119a14, closes D-01 and D-02. It separates durable baseline publication from standing activation, retains the latter until real canary/current Watchdog PASS/fresh readback and exact Owner-authorized conditional completion, and permits only correlated operation-scoped verification/closure in between. It explicitly requires independent contemporaneous face/service/evidence correlation; an old same-source receipt plus a current tuple remains Waiting without genuine capture.

The fixed-core choice is now concrete: in-process Rust watchdog-current-observation-v1, existing protected local-verifier Role::Verifier custody with exact profile/verifier mapping, same already-held MutationGuard, no second lock or self-wait, existing ExternalObservation tuple/CAS validation. The actual fixed canonical Scheduler health URL and audit-token path match the existing reader; JavaScript semantics/test vectors are ported, never executed as root. Periodic W1/W2 observations preserve existing ServiceImage generation semantics. Source/test diff from e8f863f remains empty. No design PASS is granted yet because D-03 below is a further directly reachable first-loop acceptance problem.

## D-03 — B's completed replacement must not strand B's read-only acceptance

Classification: CONTRACT_VIOLATION for the initially promised preserved acceptance path; priority P1. SOURCE: CTR010 exact prerequisite outcomes at admission/preapply and CTR014 later verification of the correctly installed artifact under the mutex with no redeploy; CTR015 exact executed dependency outcomes.

COUNTEREXAMPLE: The planned Watchdog adopted baseline A is Applied/current and has genuine semantic PASS. Broker B on the same target consumes LiveInstallation(A), applies successfully and safe-finalizes while its own Goal is WaitingExternalAcceptance. Installed then points to B. Existing Executor::verify_installed (transaction/recovery.rs:295) calls q.revalidate; queue/gates.rs:29–34 unconditionally rechecks A as current before branching for Applied B. queue/admission.rs::check_dependencies and dependencies::is_current require installed to still point at A, so B's normal later read-only acceptance fails DEPENDENCY_NOT_CURRENT because B itself legitimately replaced A. The initial end-to-end design only required B install, which would miss this stranded late-acceptance path. This is directly the proposed first-target Watchdog-to-Broker sequence, not unrelated future multi-resource work.

IMPACT: Even a valid current finalized B cannot reach its real late acceptance through the ordinary controller path. Reinstalling or pretending A remains installed would violate the governing boundaries.

MINIMAL_CLOSURE: Preserve current A plus real exact semantic PASS as mandatory at B's authoritative preapply. The executor must durably pin the exact validated dependency outcomes under the guard before B effects (A installation/adoption receipt and required signed GoalReceipt hashes/revisions/attempt/target/service coordinates). Only current finalized B's later read-only acceptance may consume a private proof tying those outcomes to B's owned direct same-target replacement, journal/receipt/installed-before and preserved required A facet/current complete face. Absent/corrupt proof must not be reconstructed retroactively. Ordinary issuer/admission/mutation/retry still requires current prerequisites; cross-target dependencies remain current. No HistoricalReceipt fallback, broad waiver, stale PASS carry-forward or general dependency-policy framework is authorized. Add positive B Waiting-to-late-PASS with zero additional install and negative missing/tampered executed prerequisite proof, stale/failed/unfinalized/rolled-back/unknown B, changed required facet and new mutation/retry with stale A.

The parent confirms this temporal boundary under the current mandate; the author independently traced the same source path. It implements the accepted distinction between an executed precondition and later read-only acceptance of the result, without changing dependency wire meaning for deployment. Exact revised design review is still required before source work.

## Final exact-design disposition

DESIGN_REVIEW = PASS
FINAL_DESIGN_COMMIT = f88fb71ea79e8795260056758f333e93447460e6
FINAL_DESIGN_SHA256 = 50575fe39ef19258f230f24d26c7f1449352fd34fb1c6ed5ab84931b0e28e020
IMPLEMENTATION_BASE = e8f863fdb5d3b95dc45cd202acee5c1c69124551
FINAL_OPEN_BLOCKERS = 0
LOAD_BEARING_SPEC_GAPS = 0

The final design's exact bytes were independently obtained with git show and hashed; the working copy matched. A package-scoped diff from e8f863f through f88fb71 returned empty/exit0, so this verdict reviews design only and no baseline implementation has been smuggled into the change.

D-03 is closed at design level by the new Direct same-target predecessor section: genuine current A prerequisite checks remain mandatory for every mutation; B's exact signed prerequisite outcomes are captured and flushed in its own journal before effects; only a private read-only acceptance path for safely finalized currently installed B may consume that evidence. It requires direct same-target replacement, immutable execution/installed-before identity, retained required A facet and fresh complete B physical/service proof. Other dependencies stay current; absent historical proof is not reconstructed. The proposed positive and negative tests explicitly cover the previously stranded Waiting-to-late-PASS path and prohibit using this proof for issuer/mutation/retry or historical satisfaction. This is the necessary temporal distinction between an authenticated executed precondition and later verification of its installed result under CTR014, not a LiveInstallation downgrade.

D-01/D-02 and the fixed observer boundary remain closed in the final bytes as reviewed above. The design stays inside one first dsh target, truthful zero-target-mutation adoption, one native controller/permanent mutex, real source/build/independent review and a separately authorized exact Owner operation. The new record/reader/fence components are justified by current first-adoption and acceptance failures. No general goal registry, receipt import, arbitrary observer, multi-target extension or additional migration capability is included; those would trigger re-PREFLIGHT rather than this PASS.

The implementation mandate already authorizes bounded nonproduction work; this review identifies no new Owner decision or Spec amendment prerequisite. Implementation must start with the stated failing regressions, preserve exact legacy canonical bytes, test crashes/unknowns and rollback to observed origin, and obtain fresh independent affected-source review and full package validation after the cross-cutting change. In particular, private proof constructors and all startup/receipt/dependency/closure/recovery consumers must be reviewed as actual code, not accepted merely because this document names them.

No operation permission follows. Complete protected target/legacy census, actual trusted reviewer availability, real generation-correlated Watchdog/canary evidence, exact source compatibility and the future Owner-authorized package remain necessary before standing activation or first Broker deployment. A nonproduction test PASS cannot substitute for any of those observations. Parent Goal completion and broader unadopted targets are not asserted.
