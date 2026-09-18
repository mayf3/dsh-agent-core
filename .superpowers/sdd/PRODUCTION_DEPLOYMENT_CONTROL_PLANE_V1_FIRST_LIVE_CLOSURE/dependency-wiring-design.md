# Bounded first-live dependency wiring design

Author: independent investigator `dcp_census_repair_review`, 2026-09-18. Design only; no implementation or operation authorized by this document. Coordinates: worktree `/Users/yanfenma/workspace/worktrees/production-deployment-control-plane-v1-impl`, HEAD `78daf3699346f6f68264921443d42552d9157dae`; accepted `PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1@39865536ce51005f95a98473e77c2329078512c0`.

## Recommendation

Use two small, explicit bindings: Owner-protected source selection by exact authenticated deployment enrollment, and a signed prior-dependency mapping from original business prerequisite to one exact deployment child. Enroll a **new Broker deployment child** containing that mapping. Keep the existing genesis Broker enrollment, ledger history, package and all six pins unchanged. Do not add registry replacement, label matching, legacy receipt import or caller-selectable recipes.

The new Broker child is a reviewed continuation of the same business deployment obligation, not a second business Goal. Its ID and Watchdog child ID must be fixed by the future exact Owner enrollment packet; example names below are design placeholders, not assigned identities:

- `WATCHDOG_CHILD`: one explicitly enrolled Watchdog deployment/acceptance obligation.
- `BROKER_CHILD_2`: new child of `WORKFLOW_ACTIVE_POOL_DISPOSITION_V1`.
- `BROKER_CHILD_1`: existing `WORKFLOW_ACTIVE_POOL_DISPOSITION_V1_BROKER_DEPLOYMENT`, retained unchanged and Pending/blocked.

New Broker child may keep frozen c9ffe1d only if the separately required exact installed/upstream compatibility checks pass. This design never selects latest main automatically.

## Accepted meaning and route

Suggested later implementation preflight: REUSE / EXEC_PLAN / CONTROLLED; exact accepted authority already authorizes authenticated readiness records, isolated fixed builders, explicit unit/capability dependencies and independent per-Goal acceptance. Implementation permission is separate from controller self-update, signing enrollment/policy, profile activation and production execution.

- CTR-DCP-001: explicit authenticated producer records and provenance, no guessed closure. A signed original-business-to-child binding makes the current intended prerequisite executable without changing its meaning.
- CTR-DCP-004: builder/source/recipe remain trusted policy; the submitter chooses only an already enrolled Goal and permitted source. No source-policy fields enter request API.
- CTR-DCP-010: dependency still names exact current unit, capability, transaction digest and required Goal PASS. No `HistoricalReceipt` fallback or synthetic installation.
- CTR-DCP-014: original required acceptance remains an independent verifier outcome; installation and Goal states remain distinct.
- CTR-DCP-015: immutable transaction/Goal receipts and producer CAS closure remain unchanged; old registry rows are not silently amended or closed.

No normative Spec delta is inherently needed for this routing/binding correction. A different proposal that weakens Watchdog semantic acceptance to installed-byte readback, marks the original business Goal complete from delivery, accepts stale historical receipts as LiveInstallation, adds arbitrary migration scripts, or invents privileged enrollment-update authority would exceed this REUSE design and require re-preflight. No such change is recommended.

Exact original dependency provenance was read and SHA256 verified: attachment `864f5db7-76be-4df2-81a5-285d329a5e2c/pasted-text.txt`, digest `37a8397beb53c9c658272ca7d430484097d558e6ffca5bfda06df98da40c1c66`. It requires Watchdog transaction completely PASS before Broker: admission, W1/W2 heartbeat freshness, runtime health and absence of durable incident-outbox invariant failure, with exact frozen overlay/routing/migration and generation-safe rollback. It does **not** authorize a fabricated full Watchdog business/current-six closure. Existing accepted Watchdog canary/provenance/finalization requirements remain applicable. Mapping binds this prerequisite; it neither adds current-six repair nor deletes semantic gates.

The same provenance explicitly froze c9ffe1d to preserve the then-deployed svc8c78c8e caller-domainId contract, prohibited latest workflow.js and listed exact Broker dependency hashes. That is a historical authorization coordinate, not fresh proof of current upstream or installed state.

## 1. Preserve history; append new authenticated enrollments

Current `Registry::enroll` rejects different content under an existing ID with `ENROLLMENT_IMMUTABLE`; retain it. `registry/storage.rs` verifies each signed history row and hash chain; retain it. Do not rewrite initial-registry.json in the sealed package or resign old ledger snapshots.

Enroll WATCHDOG_CHILD first, then BROKER_CHILD_2 with existing `Registry::enroll` via a separately exact authorized provisioning operation. No generic caller-facing register/update API is required. The exact provisioning packet must bind both signed enrollments, source policy, verifier profile, retained old enrollment digest and semantic continuity evidence. Old Broker remains visible as Pending with its unresolved exact dependency, never falsely Closed. Native source map below excludes it from new issuance; no fake receipt or ledger deletion is necessary. Existing Pending row with no issuer draft does not reserve the target (`issuer/issuance.rs::admit_target` scans actual draft bindings).

Before that operation, prove the old row has no Ready proposal, issuer draft, queued unit or mutation. If it does, stop and use existing cancellation/finalization semantics after exact reconciliation; do not add automatic supersession of unknown work to this design. The new continuation's original_request/evidence should bind both the original request and explicit continuation rationale. No broad enrollment lifecycle/version manager is needed.

## 2. Minimal signed child mapping

Extend only `registry::PriorDependency` with an optional field:

```text
PriorDependency {
  goal_id,                         // original business prerequisite, unchanged
  provenance,                     // original exact dependency request
  deployment_child?: {
    goal_id,                      // exact deployment child, never guessed
    enrollment_digest             // digest of full Signed<Enrollment>
  }
}
```

Use serde `default` plus `skip_serializing_if = Option::is_none`; preserve unknown-field rejection. Explicitly prove old Enrollment canonical bytes/signatures and signed ledger hashes round-trip unchanged when the field is absent. `types.rs` currently uses a simple record macro; write this small type explicitly rather than expanding the macro into a general schema framework.

For new Broker child, keep `goal_id = SCHEDULER_WATCHDOG_ROUTING_AND_STUCK_OCCURRENCE_RECOVERY_V1` and the verified original provenance, and supply the exact WATCHDOG_CHILD signed enrollment digest. The Watchdog child itself binds its accepted authority, contract list, required acceptance revision and verification profile; the digest prevents substitution of a generic delivery-only child later.

Resolve/check mapping from authenticated registry rows, under the existing registry lock/history snapshot before new enrollment/READY acceptance, and again before issuer build:

- child exists, signature/role/scope validate; exact signed digest matches;
- child's `business_goal_id` equals original prerequisite `goal_id`;
- child differs from consumer and business parent; exact repo/target/profile bindings are compatible for this bounded same-target sequence;
- no self-reference/duplicate effective child; reject a dependency cycle before issuance;
- child acceptance authority and verifier binding are the exact independently reviewed Watchdog capability acceptance, not merely an arbitrary matching business label.

Absent mapping keeps existing exact-ID interpretation. **No business-ID search, alias resolution or fallback** is added. Thus BROKER_CHILD_1 remains blocked rather than silently changing semantics.

`registry/validation.rs::ready` must compare ReadyRecord and Proposal dependency `required_goals` against the explicit effective child ID, while preserving signed original prerequisite/provenance in Enrollment. `Registry::activate` must run the child digest/registry checks, not rely solely on issuer behavior. Signature validation and ordinary queue admission remain mandatory.

Change `issuer/coordinator.rs` prerequisite resolution from raw `.map(|p| p.goal_id)` to this bounded authenticated resolution. Resolve before staging/review work. Queue receives exact child IDs; `Dependency` wire type, LiveInstallation semantics, `queue/issuance.rs` current receipt selection and `queue/dependencies.rs` remain unchanged. Actual transaction `capability` and receipt digest are derived from the protected queue, never from the mapping.

## 3. Owner-enrolled source selection, unchanged request API

Keep `FreezeRequest { goal_id, source_sha }` and the existing frozen-source check. Introduce one strict Owner-policy v2 shape with an explicit finite map:

```text
sources_by_goal: {
  WATCHDOG_CHILD: { enrollment_digest, source: SourcePolicy },
  BROKER_CHILD_2: { enrollment_digest, source: SourcePolicy }
}
```

`SourcePolicy` already contains repo/branch/contract path+digest, slots, review paths, tool hash and dependency closure. Reuse it. No recipe from the caller, path template, wildcard, default source, selector callback or business-ID lookup. Both jobs keep the reviewed regular-file copy recipe where applicable. Every entry validates its exact signed enrollment digest, repo, accepted contract and profile/slot bounds; map is nonempty, at most the existing 256 enrollment ceiling, unique keys and bounded serialized bytes. A missing key fails before GitHub requests, staging or Codex review.

Preserve strict decoding of the old v1 single-source Owner policy for the already sealed genesis and cached history. Use narrowly versioned v1/v2 owned-policy decoding, not an unbounded policy framework. V1 serialized field layout must remain byte-identical; v2 has only the map and cannot also declare a conflicting single source. V2 is installed only through separate exact Owner-reviewed activation/self-update, and must not fall back to v1 source for unmatched IDs. Existing genesis installer validation can remain v1-only and its bytes/packages unchanged.

Bind selected policy **and authenticated enrollment/mapping** into `IssueBinding.source_policy_digest`, alongside NativeEnrollment digest; include selected closure in BuildAttestation as now. Existing immutable drafts must not resume under changed selection/mapping. Reject an outstanding draft for the same Goal with a different binding until reconciled; do not create a second artifact simply because a new digest yields a different filename. Preserve existing exact draft resumability. Protected policy changes advance owner policy epoch and invalidate cached leases through current owner digest comparison.

`issuer/policy.rs` also needs a single small source-selection digest helper: v1 hashes the original source exactly; v2 hashes the complete goal-source map. Current `CachedLease.source_digest` directly hashes `owner.source`; replace all such computations consistently while preserving v1 cached signatures/bytes. Full owner digest already binds map content. Queue policy epochs remain global; do not invent per-Goal epoch stores.

## 4. Watchdog acceptance is a separate, real prerequisite

WATCHDOG_CHILD must not use `NativeInstalledReadback` to claim admission/heartbeats/outbox/canary semantics. `service/train.rs:258-285` currently auto-PASSes that binding on installed-byte/process readback only. Configure an explicit Watchdog verification profile using the existing `ExternalObservation` path and a fixed trusted verifier identity, or implement the narrowly required fixed native semantic verifier under accepted Watchdog contracts. Existing observation transport requests readback only; it is not authorization to run a canary. A canary requiring a write remains the exact already authorized canonical operation, never a new model-directed business action.

A genuine queue Watchdog unit must install or verify its accepted exact artifact through the normal transaction, safe-finalize, and obtain a fresh signed GoalReceipt for **that unit/attempt/target generation/service generation**, with evidence binding all required semantic checks. Existing protected postdeploy receipts can be evidence inputs after exact current-generation validation; do not copy them into fabricated historical queue units. The verifier profile, authority/contract references and evidence parser must be reviewed with the enrollment, so merely renaming the generic verifier cannot pass.

Current fixed native apply handles app slots/node closure/service plists, not incident-state metadata migration or routing transaction. Source-map support does not add those powers. If protected reconciliation proves migration/routing already complete and compatible, carry their exact evidence into current acceptance and use the reviewed regular-file delta. If not, the existing owning Watchdog controlled operation must finish those obligations before native enrollment, or a separate explicitly reviewed migration facet is needed. This design does not supply that facet or bypass its gate.

Required first-live ordering: recover complete target -> prove migration/routing preconditions -> separately provision reviewed controller/policy/enrollments/verifier -> issue WATCHDOG_CHILD -> transaction + semantic PASS + safe finalization + actual producer closure -> issue BROKER_CHILD_2 -> exact current dependency recheck -> Broker transaction/readback. Existing target draft exclusion makes Watchdog producer closure relevant before next-artifact Broker issuance. Do not manufacture `Closed` to skip it.

## Exact code/data review surfaces

- `src/registry/types.rs`: optional signed child mapping; canonical legacy compatibility.
- `src/registry/validation.rs`, `src/registry/mod.rs`: exact child binding validation, effective required Goal, locked snapshot use at enrollment/activate. Keep storage history/closure immutable.
- `src/issuer/coordinator.rs`: owned-policy shape/selection, mapping resolution, selected source use for observe/build/review, digest binding; no request expansion.
- `src/issuer/policy.rs`: v1/v2 owner validation, source-selection digest and lease/cache comparison.
- `src/issuer/issuance.rs`: exact incompatible-draft detection needed for policy binding changes; existing immutable publication/target exclusion retained.
- New non-genesis preparation data: two signed enrollment candidates, source selections, Watchdog verifier configuration and exact continuity evidence. Do not mutate sealed `deployment-artifacts/control-plane-genesis-v1` inputs to retrofit the old package.
- Existing `service/train.rs`/verifier configuration interfaces: verify correct external-profile dispatch and trusted receipt binding; do not broaden native-installed verifier. Actual Watchdog verifier evidence implementation is a bounded dependent task if unavailable.
- No queue schema migration, Dependency type change, new registry state, generic importer, new socket request fields, arbitrary root execution or historical receipt rewriting.

## Failure and test matrix for later implementation

1. Legacy fixture: canonical bytes/signatures of original Enrollment, ledger and v1 Owner/cache remain identical; exact genesis package loads unchanged. Existing immutable enrollment replacement still fails.
2. Enrollment binding: wrong signature/digest, wrong business parent, nonexistent child, different target/repo/profile, self/cycle/duplicate effective child reject; no staging/network/review work. Mapping omitted retains old behavior.
3. Policy source selection: Watchdog request builds only Watchdog slots; Broker only Broker slot; unknown/old excluded Goal, altered signed enrollment, authority mismatch, duplicate map key, mixed v1/v2 fields or oversized map reject. Caller cannot supply slots/recipe/contract path.
4. Draft/cache: selected source or mapping change invalidates reuse; conflicting outstanding draft fails closed. Identical resume reuses exact artifact/review. Legacy cache validates; map/epoch change cannot reuse old lease.
5. Dependency truth: old business receipt cannot stand in for mapped child; arbitrary child/generic verifier PASS rejected by binding/config. Pending/FAIL/WaitingExternalAcceptance/OutcomeUnknown, unfinished executor, wrong attempt, wrong generation, service drift, missing transaction, superseded unit or another currently installed unit all block Broker.
6. Semantic scope: installed-byte PASS alone never satisfies WATCHDOG_CHILD; missing admission/outbox/canary evidence stays pending/fails per accepted classification. No business Goal completion flag becomes true. No current-six mutations or legacy receipt import.
7. End-to-end nonroot fixture: actual Watchdog unit -> semantic signed child PASS -> safe finalize/outbox acknowledgement -> new Broker issuance contains exact Watchdog unit/digest/capability/child. Broker cannot issue earlier. Original Broker row and complete history remain identical; only new cumulative ledger states append.
8. Drift: advance physical same-target generation between Watchdog completion and Broker admission/apply; reject stale LiveInstallation. Preserve queue/mutex rechecks and normal recovery behavior.

Run these focused tests and affected registry/issuer/queue/train suites plus format/strict Clippy/release checks after implementation; no suite was executed for this design-only work.

## Stop boundary and limits

This file is reviewable design, not implementation or activation authority. Exact IDs/digests for new enrollments must come from the eventual reviewed packet, not these placeholders. Read-only installed-face evidence currently shows selected files absent; actual owning migration/recovery closure remains an external gate, not a reason to defer nonproduction design. No claim of current Watchdog readiness, production safety or successful automatic deployment is made.
