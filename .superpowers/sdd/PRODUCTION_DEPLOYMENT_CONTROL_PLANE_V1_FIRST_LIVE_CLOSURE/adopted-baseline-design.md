# First native adopted baseline — bounded design and execution brief

DESIGN_STATUS=READY_FOR_INDEPENDENT_DESIGN_REVIEW
BASE_HEAD=e8f863fdb5d3b95dc45cd202acee5c1c69124551
PARENT_GOAL=PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1
PRIMARY_AUTHORITY=PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1@39865536ce51005f95a98473e77c2329078512c0
AUTHORITY_ACTION=REUSE
ROUTE_STAGE=IMPLEMENTATION_DESIGN
AUTHORITY_ACCEPTED_IN_BASE=YES
IMPLEMENTATION_AUTHORITY=contracts
PLAN_LEVEL=EXEC_PLAN
ASSURANCE_LEVEL=CONTROLLED
EXECUTION_MANDATE=VALID; mayf3 authorized remaining nonproduction work in the same parent Goal; parent delegated this design, with source implementation paused pending independent design review
MUTATION_AUTHORIZATION=VALID; this isolated design file only
IMPLEMENTATION_ALLOWED=NO_UNTIL_DESIGN_REVIEW
OPERATION_ALLOWED=NO
SPEC_GAP_DEPENDENCY=NONE_IDENTIFIED; independent review must verify this classification

## Target, evidence and gap

GOAL_OR_TARGET: establish an honest first native current installation for already-installed, authenticated Watchdog capability; obtain real zero-mutation verification and an exact current-generation prerequisite for the first Broker deployment. No new user Goal or platform.

CURRENT_GAP: native bootstrap authenticates initial files but creates no queue installed baseline. `queue/admission.rs` late coverage requires an Applied unit joined to installed/intents; `physical.rs`, `dependencies.rs`, `issuance.rs` and executor verification assume every installed receipt is a mutating `TransactionReceipt` backed by a finalized apply journal. `check_dependencies` deliberately rejects HistoricalReceipt. Normal apply stops services and rewrites slots even if identical. A fake historical Applied row or redundant install cannot close this gap lawfully.

The independent selection report is `/Users/yanfenma/workspace/worktrees/production-deployment-control-plane-v1-impl/.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_FIRST_LIVE_CLOSURE/watchdog-first-unit-selection.md`, SHA256 `a660997ffa86694ca79fb73cab56e9751b9a5d8e8ac229c0a692c18f433a54a1`. Its exact current observations supersede the earlier temporary missing-app snapshot:

- Parent ordinary readback at 2026-09-18T04:34:07Z shows restored app/Broker files; owning task reports ROLLBACK_FILESYSTEM=PASS. This is not independent protected runtime/lock proof.
- Correct Watchdog slot is `packages/scheduler/src/watchdog/incident-lifecycle.js`; ordinary restored hash `cd0d7b0ca09a78d514f9c28dc240c16271536cd6ccaa2546805b2b569c18b1c1` equals frozen source `c9ffe1d1637db2997689d8b2ef7def4fc1086b17`. No remaining Watchdog install delta was demonstrated.
- Broker has a real selected delta: restored workflow.js `d76791b7ebbacc872343ba8a26d13ce1f4f2315f4ff5a53fc8744f445b1e65ee` versus c9ffe target `2ec3c9d2dc9e5f5bf11cca69ea63ad8888d8cfcc820045e5c0eac1bb11ce7c8d`. The selected diff contains intended currentExecutorType changes and formatting. Full closure/upstream compatibility remains a later exact gate.
- Complete protected current face/metadata, recovery disposition, actual process generation and current Watchdog semantic PASS are not established by those selected-file observations.

The report independently recommends REUSE for authenticated first-adoption observation. It does not select a new Goal ID or grant operation authority. This design changes the earlier dependency design's proposed first Watchdog *install* path only where the new already-installed evidence directly invalidates that path; earlier source-map/child-binding implementation stays unchanged. No historical record is rewritten.

## Governing meaning and scope

| Accepted contract | Implementation consequence |
| --- | --- |
| CTR-DCP-002 | Daemon allocates canonical unit/intent and initial target-generation coordinate; preserve immutable source/build/manifest/coverage/review binding. Target generation records daemon ownership, not a past deployment or process PID. |
| CTR-DCP-003 / ACC-DCP-002 | Already-installed required artifact with verified current metadata gets zero install/restart. First adoption must not manufacture a pending reinstall to create a queue row. |
| CTR-DCP-004/008/009 | Retain trusted source/build/independent review, fixed enrolled slots, descriptor-based safe reads and one permanent production mutex. |
| CTR-DCP-010 | Broker needs an exact current installation receipt and real required Goal PASS; historical labels, transport success and byte equality cannot substitute. |
| CTR-DCP-011/013 | Durable interruption handling, unknown quarantine and exact rollback ownership remain mandatory; observation gives no authority to undo a historical deployment. |
| CTR-DCP-014/015 | Installation state differs from semantic acceptance. Current observation has an honest transaction receipt plus independent per-Goal receipt, safe finalization and producer CAS/outbox. No business Goal completion. |
| CTR-DCP-017/018 | One future exact Owner adoption/activation package binds controller, enrollment, identities, complete preimage, legacy retirement, rollback and protected epoch. Current disabled genesis authorization does not cover it. |

Recommended interpretation: CTR015's transaction receipt is a record of the **current observation transaction**, with explicit adoption origin and actual zero effects. It is not a fabricated historical install. The Rust `TransactionReceipt` type/old bytes continue to denote a mutating execution; a separate typed adoption receipt implements the accepted zero-install case. The Applied installation projection means the current installation is proven, not that APPLYING/RESTARTING occurred. A private adoption transition must report that distinction.

No normative change is identified: no weaker acceptance, broader target privilege, historical satisfaction or new rollback power is introduced. Re-PREFLIGHT is required if review finds this explicit observation origin cannot satisfy accepted receipt meaning, or implementation needs unproven provenance, caller-allocated generations, stale semantic evidence, generic import, skipped lifecycle retirement or changed failure semantics. Do not solve such a gap in this design or a test.

## Selected minimal representation

1. Add one internal typed `AdoptedBaselineReceipt`, stored with distinct receipt kind `adopted-baseline` and `origin=observed-existing-installation`. It binds operation/grant/package/preparation/NativeEnrollment digests, exact host/runtime/profile identity, canonical unit/intent/desired record, source/build/manifest/reviews/current policy/dependency digests, real coverage attachments and actor, complete physical face/loader evidence, observed service generation, pre/post observation digests, daemon target generation and capability `installed-release`.
2. Record `mutating_attempt=0`, install count 0, restart count 0, migration/config/routing effects 0. Record concrete read/import/verify/finalize steps; no fabricated stop/start/install events. Pre/post physical face and service generation must match across observation. Root-protected receipt/database/CAS writes are actual control-plane effects and are explicitly recorded, not called globally read-only.
3. The adoption operation is permitted only for the exact first target with no prior target intent, unit, installed or adoption ownership, except resuming its own exact pending record. Expected generation is 0; daemon allocates intent and generation 1 through the same canonical descriptor allocator. Caller request/operation IDs cannot choose/reset intent, generation or attempt. Artifact, source, descriptor and attachments are genuinely built/admitted now from authenticated enrollment/proposal; no historical unit is imported.
4. Use existing Applied installation state only after private verified adoption publication, with explicit origin visible in current-status/receipt readback. Do not run generic `transition(...Applied)` or relax its mutation finalizer. Record an adoption observation event rather than counterfeit Applying/Restarting transitions. Pending publication projects Finalizing and is unusable by dependencies, verification, producer closure or later mutation.
5. Add a small internal installation-receipt reader selected by strict stored kind. It returns validated common coordinates/capability plus typed origin. Existing transaction rows still use the exact old decoder/checks; unknown kinds/ambiguous origins fail closed. No `HistoricalReceipt` satisfaction is added.
6. Preserve legacy signed and journal bytes. `CurrentInstallation` needs an explicit default/omitted legacy origin plus a present adoption origin for new records; retain its existing serialized `transaction_receipt_digest` key solely for old-record compatibility, documenting it as the installation receipt reference when origin is adoption. Every consumer must dispatch by validated origin, never reinterpret adopted bytes as `TransactionReceipt`. Exact legacy canonical fixture tests are mandatory. `RestoredInstallation.previous` preserves this origin.

Scope is one first native target adoption path, nonroot fixture counterpart and the directly affected reader/receipt/recovery consumers. No generic `import receipt` socket API, schema selection from caller, public arbitrary signing endpoint, generic registry mutation or installation of another target. Existing child mapping, v1/v2 source-policy selection and queue Dependency wire semantics remain unchanged.

## Real enrollment and issuer sequencing

The existing real obligation is fresh Watchdog capability acceptance required by the original Broker request (provenance digest `37a8397beb53c9c658272ca7d430484097d558e6ffca5bfda06df98da40c1c66`). Any deployment child used here must be explicitly enrolled as the **verification/adoption portion of that existing obligation**, with original business Goal, exact accepted contract revision, actual source and current-verification scope. It must not claim a pending code install or whole-business completion. Final IDs are fixed from that real provenance in the future reviewed packet; this design supplies no fictitious production IDs. No enrollment or queue row is written now.

The future exact Owner package includes the append-only Watchdog verification enrollment and Broker continuation mapping, strict source map, semantic verifier binding and old Broker unchanged prestate. It proves no old Ready/draft/queued mutation conflicts before enrolling a continuation. If actual complete-face evidence identifies a real missing authorized delta instead, use normal reviewed deployment for that delta; do not force baseline adoption to hide it.

Reuse the existing issuer rather than invent preactivation signing authority:

- `prepare_native` is synchronous and can perform source fetch/build/independent review while launchd jobs remain disabled. It requires authentic active service Configuration, NativeEnrollment and signed DaemonActivation; it does not require those services to be running.
- In the future Owner-authorized operation only, reserve an exact protected adoption operation/fence before publishing the package's active configuration/activation receipt. The reviewed controller must reject ordinary startup, submission/execution and closure while that fence is pending. Root can then run the fixed issuer preparation for the exact enrolled verification Goal; do not use sandbox Intake, fake activation, enabled-bit bypass, test trust or a caller-selected source policy.
- Source/build/review work is speculative preparation outside the authoritative observation mutex span, bounded by existing issuer isolation/lock/deadlines. A preparation failure leaves adoption fenced and launchd disabled; no target restart. Exact draft resume rules remain in force. Independent reviewer identity/custody remains real.
- After proposal readiness, the one-shot **same controller executable** acquires the permanent production mutex for authoritative precheck through observation/finalization. There is no second lock or helper-owned production ownership. Pending preparation does not hold this mutex. All trust/policy/proposal/preimage/time bindings are revalidated under this acquisition.
- The final package may start normal services only after the baseline and target-adoption gates are finalized. Enabling configuration in the one-shot operation is a real future Owner-authorized change; it is not claimed to be covered by the current disabled install. No source-only operation calls this path.

The operation fence is a closed-purpose protected row keyed by target and exact operation digest, not a new Goal registry. Normal issuer preparation may read daemon desired coordinates while fenced; normal socket submissions/mutations cannot exploit this allowance. Only the private adoption path may admit the pinned proposal. Tests must prove an enabled config plus unfinished fence cannot start the train.

## Authoritative observation and atomic publication

Under one `MutationGuard` acquisition:

1. Prove exact operation identity/Owner grant/package/current controller/host/enrollment/active config, safe recovery closure and absence of unknown/inflight operations across the host. Check permanent inode ownership. Prove full target lifecycle retirement and caller denial before trusting a stable physical face. If any field differs, stop with evidence; do not refresh the accepted preimage implicitly.
2. Verify signed proposal/READY/desired/current policy/reviews/dependencies with existing gates and exact enrollment. Require first-target emptiness or this exact resume. Allocate the canonical unit/intent and bind immutable attachments in one SQLite transaction, initially adoption-pending with zero attempts. It is not eligible for normal scheduling.
3. Import and seal the trusted artifact using existing descriptor-safe artifact logic (control-plane CAS only); compare every required artifact slot with actual bytes and prescribed metadata, including file types, ACL/link/path constraints. Validate the complete retained native face, configuration/plists/loader closure and real runtime/W1/W2 process identities, not only the c9ffe slot. The existing complete-face bounds and service proof remain mandatory.
4. Write an append-only, bounded adoption journal under a separate fixed root-owned adoption namespace (ordinary mutation recovery must never parse it as apply history). Journal records exact operation/unit/intent, full face evidence, service image, receipt and hash chain. Flush receipt and parent directory; re-read complete face/service and policy before publication. Only this code can produce private `VerifiedAdoptedBaseline`/`VerifiedAdoptionFinalization` proof values.
5. Atomically insert the typed immutable receipt, installed generation and Applied projection while retaining an executor-finalization fence. Queue readers see Finalizing, no dependency satisfaction, no outbox and no late verification until completed. Uniqueness/CAS prevent another operation/unit/generation. No Goal PASS is inserted here.
6. Append/fsync final adoption journal completion, then consume the private proof to remove only the exact adoption/executor fences after a fresh bound readback. Completion verifies stored receipt, immutable unit, artifact and origin. If commit/fsync/result is uncertain, latch the existing global controller uncertainty gate; never retry with a new operation ID.
7. Only now run/observe the real per-Goal verifier under the same guard when immediately available, or release and use the existing late-verification path later under a fresh guard. No indefinite waiting. Revalidate current artifact/complete face/service/policy on every later verification. Installation is proven even when semantics stay Pending/Waiting/Fail; Broker remains blocked.

A schema addition may persist the exact reserved operation and completion disposition; use transactional CAS and a permanent uniqueness/tombstone record so successful or aborted adoption cannot be repeated as a new first adoption. It must not create a caller-writable import queue. Reuse existing executor finalization visibility checks; any adoption-specific pending projection must be checked by every existing reader that currently checks executor_pending.

## Crash, unknown and rollback semantics

| Boundary | Required outcome |
| --- | --- |
| Before reservation | No baseline ownership or target effect. A new exact authorized operation may begin only after fresh precheck. |
| Reserved or issuer-preparing | Durable pending fence; services stay disabled. Resume same operation and exact immutable draft or stop; ordinary scheduling denied. |
| Unit reserved, journal absent/partial | No usable installed record. Bounded reconciliation establishes actual zero target effects, validates chain and current face. Same operation may resume observation; unbound/corrupt evidence remains fenced/quarantined. |
| Durable observed receipt, no queue publication | Resume publication only after revalidating full current face/service/policy under mutex against the exact observation; drift invalidates it. No replacement receipt under a fresh operation. |
| Queue installed/Applied, journal not finalized | Project Finalizing; no Goal pass/export/dependency/closure. Exact recovery either proves and completes the same observation or keeps global uncertainty/quarantine. |
| Journal finalized, fence not removed | Re-read durable journal/DB and current physical state under mutex; only exact private proof can clear that fence. Do not infer current service identity from terminal disk bytes alone. |
| Later physical/service drift | Old dependency and semantic receipt invalid. No automatic carry-forward or baseline re-adoption. Use existing reconciliation/new real deployment rules; unresolved state stays blocked. |
| Unknown external canary | Existing OutcomeUnknown semantics latch quarantine; never issue a replacement PASS or resend. Observation cannot resolve somebody else's unknown business effect. |

A failed observation did not own the preexisting target installation. It must never call the mutation rollback routine, stop/start services, restore old target bytes or undo accepted routing/migration. Operational rollback of configuration/legacy retirement belongs to the separately authorized package, with exact compare-and-restore and preserved evidence; it is not an adoption receipt power.

A later genuine Broker mutation may have this baseline as `installed_before`. Its own normal preimage journal then owns only that mutation's changes. On rollback, existing bytes/metadata restoration and a **fresh** service readback must prove the baseline; `RestoredInstallation` retains adoption origin and immutable baseline receipt while recording the restoring mutation's identity. Target generation remains the baseline generation and service generation changes; the old Watchdog Goal PASS cannot silently survive that change. Reverification is required. No synthetic baseline apply journal is created to make normal rollback code happy.

Global uncertainty covers mutex, controller integrity, durable publication authority and unknown owned operation outcome. An unrelated unit-local stale recovery record remains local per the already-closed R02 behavior; no blanket recovery bypass or reopening of unrelated findings. Adoption itself is first ownership and therefore requires a globally safe transaction lane.

## Watchdog verification and exact Broker dependency

Use the current ExternalObservation protocol and accepted trusted verifier identity. Its fixed adapter reads authenticated current Watchdog evidence and signs only the real request tuple (unit, enrolled verification Goal, attachment, acceptance revision, attempt 0, target generation, physical service generation, next receipt revision). Evidence digest includes protected receipt identities and hashes plus fresh canonical health/provenance observation. The controller retains verifier scope/signature and current-generation checks.

Reuse the existing `verifyPostdeployEvidence` semantic checks where applicable. Required evidence includes accepted phase/routing/migration, Scheduler admission, fresh W1/W2 heartbeat, runtime health, durable outbox invariant, real authorized side-effect-free canary/store isolation/dedupe/finalization and exact source/overlay provenance. `scheduler-postdeploy-finalize.mjs` returning 0 for an existing matching source receipt before health checks is not fresh proof. That command otherwise mutates canary/receipt state; the observation adapter must not invoke it as an allegedly read-only verifier. Missing canonical canary acceptance is completed only through the existing owning authorized operation, then observed; Pending is honest until then. No test signer or `NativeInstalledReadback` can certify these semantics.

After signed PASS and safe finalization, existing outbox/producer CAS closes only the verification/deployment child. `business_goal_complete` remains false. This also releases the issuer's real same-target draft reservation through actual registry closure, not a forged Closed row. Broker source preparation then resolves the mapped child using the common installed-receipt reader. The Dependency stays `LiveInstallation`, capability stays `installed-release`, and receipt digest names the genuine typed adoption transaction. Queue issuer, admission and immediately-before-apply gates require current unit/generation, no pending finalization/unknown, current physical service generation and the exact required child PASS. Replacing the installed target or restarting it invalidates that prerequisite until fresh proof.

## Bounded implementation plan and tests

Independent design review precedes source. No source may be implemented solely because this file exists. After parent authorizes implementation of the reviewed REUSE design:

1. Add failing fixture regressions proving an empty native-equivalent queue cannot verify an already-installed exact artifact without an install; rejected forged/stale/global-unsafe cases alongside the desired zero-write path. Capture RED before changing implementation.
2. Add typed adoption receipt/origin and strict common installation reader with legacy canonical fixtures. Add bounded operation reservation/publication and private proof gates. Extend only affected current-installation, dependency/issuer, goal/closure and rollback readers.
3. Implement fixed one-shot adoption observation and hash-chained journal with explicit recovery. Reuse existing artifact, native complete-face, service, mutex, policy and lineage validators. Keep code modules below active limits; no generic adapter framework.
4. Add narrowly required Watchdog ExternalObservation evidence adapter tests and fixed binding. Do not claim real semantic acceptance from fixtures. Prepare data candidates independently from the current sealed genesis and current installed files.
5. Run focused tests, relevant full queue/issuer/registry/transaction/service/bootstrap suites, full package suite, fmt, strict all-target Clippy, locked release and structure check. This cross-cutting persistent-state change justifies a fresh complete suite. Independently review origin/trust/mutex/crash/finalization/rollback/acceptance plus exact first-live chain; unrelated eight closed findings are not reopened without impact.
6. After source/review pass, prepare one exact future package for source update, complete target census/protection and legacy retirement, real policy/enrollments/verifier, adoption and activation plus first Broker run. Report actual task impact and bounded rollback; Owner authorizes that concrete package once. Implementation readiness does not grant operation permission.

Required regression matrix:

- Authentic source/build/review/proposal + matching complete enrolled target -> initial canonical generation once, honest adoption origin, attempts/install/stop/start/restart/migration counters all zero; regular target files/PIDs unchanged. Only protected control-plane evidence/CAS/DB changes occur.
- Missing/expired/forged Owner grant, wrong package/host/profile/enrollment, false independent review, wrong artifact/retained face/metadata/loader, wrong source provenance, disabled ordinary intake or unknown receipt kind -> no usable baseline.
- Public submit/transition/receipt fields cannot synthesize private adoption proof or bypass a pending fence; enabled config while preparing cannot start ordinary train.
- Repeated same exact operation is idempotent; altered operation, request ID, desired revision or restored DB cannot allocate another first baseline/reset budgets. Existing queue ownership always rejects first adoption.
- Fault after each durable boundary and fresh-process reopen -> exact same usable baseline once or fenced uncertainty, never dependency/outbox before finalization. Corrupt/truncated/swapped/duplicated journal and replaced mutex inode fail closed.
- Semantic Pending/Fail/Waiting/Unknown never yields Broker dependency; installed-byte success alone insufficient. Genuine verifier PASS is exact to attempt-zero/unit/attachment/current service generation, and only real producer CAS closes deployment scope.
- Same-target physical or service-generation drift between adoption, semantic response, issuer, admission and apply rejects stale proof. Goal/unit B local stale recovery cannot block unrelated healthy acceptance; global unsafe does.
- Later real B apply failure -> restore genuine adopted A bytes/metadata, preserve typed origin/target generation, fresh physical generation and no stale A PASS carry-forward. Failed observation itself invokes zero rollback lifecycle operations.
- Existing positive mutation receipts, complete old journal/canonical bytes, normal late attachment, A→B→A, recovery/unknown/canary rules and v1/v2 issuance retain behavior. HistoricalReceipt remains rejected.
- End-to-end nonroot chain: real current observation -> semantic verifier waiting -> correct signed PASS -> finalized receipt/outbox/CAS -> Broker proposal with exact current adoption dependency -> one genuine Broker install; no Watchdog reinstall or invented historical attempt.

DONE_WHEN for this design: independent affected-contract design review passes; source interfaces, truthful receipt/state model, gate/order/crash matrix and future exact Owner boundary are explicit. This document does not satisfy implementation or operational readiness.

EXPANSION_TRIGGER: unproven source/complete face, genuinely missing authority meaning, unsupported required migration, new target/privilege, generic history import or need to weaken an existing gate. Stop that dependent path and re-PREFLIGHT; retain completed bounded work. NEXT_REAL_ACTION: parent arranges independent design review at this exact document, then authorizes only the reviewed nonproduction implementation. Protected target census and actual semantic proof remain coordinates to obtain for the future operation packet, never fabricated in tests.

## Separate correction already delivered

FLI-01 active issuer profile digest repair is source commit `e8f863fdb5d3b95dc45cd202acee5c1c69124551`, independently rereviewed PASS at tree `b48cf247ab48b1ee77d1600af9cb80036592fe8b`. It uses bootstrap normalization, preserving all other profile bindings. That repair and its focused/release evidence are separate from this not-yet-implemented adoption design. Current exact installed genesis package is unchanged.
