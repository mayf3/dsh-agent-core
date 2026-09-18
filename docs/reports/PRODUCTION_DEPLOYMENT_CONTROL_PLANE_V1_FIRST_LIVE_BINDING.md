# First-live dependency and source binding implementation

This is nonproduction preparation inside the existing parent Goal. It does not claim Watchdog readiness, a production deployment, a new enrollment or parent-Goal completion.

## Coordinates and authority

- Base: `78daf3699346f6f68264921443d42552d9157dae`.
- Worktree: `/Users/yanfenma/workspace/worktrees/dcp-first-live-binding`, branch `codex/dcp-first-live-binding`.
- Governing accepted semantics: `PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1@39865536ce51005f95a98473e77c2329078512c0`, CTR-DCP-001/004/010/014/015.
- Route: REUSE / EXEC_PLAN / CONTROLLED, implementation only under mayf3's standing nonproduction mandate. No accepted authority text changed.
- Source commit and final verification results are recorded in the accompanying implementation evidence report after execution.

## Concrete gap closed

The original Broker enrollment names an original Watchdog business prerequisite, while valid deployment receipts belong to deployment children. The previous issuer also had only a single Owner source recipe. A later exact provisioning operation can now bind a new Broker deployment child to one explicitly signed Watchdog child and choose the correct separately enrolled source for each. The existing Broker row, v1 genesis inputs and package remain unchanged. No real child IDs, signed enrollments, keys or sources were fabricated by this change.

`PriorDependency.deployment_child` optionally pins an exact child ID and full Signed<Enrollment> digest while retaining the original business prerequisite and provenance. Registry enrollment and READY activation check that digest against authenticated ledger rows, business parent, same repo/target/profile/producer/standing authority, duplicate effective dependencies and cycles. The issuer repeats locked resolution before source observation or build. A mapped dependency must carry LiveInstallation semantics; there is no HistoricalReceipt fallback. Omitted mappings retain exact-ID legacy interpretation and canonical bytes. Existing enrollment immutability and append-only history remain intact.

A private strictly versioned Owner-policy decoder accepts the existing v1 shape or a v2 finite `sources_by_goal` map (1–256 exact keys). It rejects duplicate/unknown keys, mixed shapes, null source fields and unbounded records. Source selection pins the entire signed enrollment, accepted source digest, repo, protected activation profile and mutable/executable file slots. Missing entries cannot use a default source. The unchanged caller request remains only `{goal_id, source_sha}`. Selected source observations, fixed regular-file builds and dependency closure use this selection.

V2 draft bindings cover the complete Owner policy, selected source, authenticated enrollment/mapping and NativeEnrollment digest. A changed binding cannot claim a second content-addressed draft for the same Goal. Exact legacy v1 drafts retain their old digest formula only when no child mapping exists: immutable enrollment prevents later semantic replacement under that Goal ID. V1 cache owner bytes and source digest remain unchanged; v2 source digest covers the complete source map. Existing global Owner epoch/equivocation and lease rules remain in force.

## Verification scope and evidence

Evidence lives in `.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_FIRST_LIVE_CLOSURE/` in this isolated branch. RED observations cover absent mapping, absent v2 decoding, changed-binding draft escape, changed review-custody draft binding and historical dependency downgrade. Focused tests exercise wrong signature/digest/business/target/repo/profile, missing/self/cyclic/duplicate children, old canonical enrollment/ledger/Owner serialization, unknown/mixed/duplicate/oversized source maps, selected build slots, profile/authority/slot bounds, lease invalidation and exact draft resume.

The nonroot end-to-end fixture performs a real fixture executor transaction, keeps Pending/Fail/WaitingExternalAcceptance and pending finalization from satisfying the dependency, accepts an explicitly fixture-signed PASS only after safe finalize, delivers producer closure, and activates the mapped Broker READY record with the exact child unit/dependency. The business ID itself cannot substitute. This is transport/state-machine evidence, **not** a real Watchdog semantic observation. Existing queue/transaction/current-generation safeguards were not changed.

An initial test-harness attempt to send PASS after OutcomeUnknown correctly received UNKNOWN_CANARY. That output is retained; the harness was corrected to respect the existing nonreplay boundary, without changing production behavior. Final full-suite evidence is authoritative over earlier development logs.

## Remaining real first-live gates

1. Reconcile the owning runtime recovery and obtain a complete current target preimage; this implementation does not restore or mutate the app.
2. Fix and review actual Watchdog/Broker child IDs and full signed enrollments, original prerequisite provenance, v2 source map and native target/profile slots. Prove the existing Broker row has no Ready proposal, draft, queued unit or unresolved mutation before excluding it from new issuance. Existing history is retained.
3. Bind a genuine trusted Watchdog semantic verifier and accepted evidence contract (for example the existing ExternalObservation path). The full signed child digest pins its authority/contracts/acceptance revision/catalog verifier, but Registry alone has no Configuration::VerifierBinding and cannot certify admission, heartbeats, outbox invariants or canary outcomes. A generic NativeInstalledReadback must not be selected for this prerequisite. No semantic verifier or new canary authority was created here.
4. Complete missing accepted Watchdog migration/routing/canary obligations through their owning authorized operation before normal regular-file deployment, or obtain a separately reviewed exact facet. No migration power was added.
5. Review and authorize exact controller/policy/enrollment provisioning and activation. Old v1 software cannot consume new v2 policy/mapped rows; source/data downgrade after provisioning requires exact reconciliation, not a blind binary rollback. Nothing new has been installed by this implementation.
6. Obtain a genuine current safe-finalized Watchdog unit plus independent semantic PASS and producer closure; then issue and deploy the applicable Broker source with current dependency/generation checks. Frozen c9ffe1d applicability still requires fresh upstream/accepted-authority/installed-face comparison; latest main was not selected automatically.

No queue wire/schema, LiveInstallation implementation, transaction/mutex/artifact trust, genesis template/package, root service, sudoers, production endpoint, business completion state or existing runtime was changed. Independent affected-surface review remains a parent delivery gate; this author does not self-assert its PASS.
