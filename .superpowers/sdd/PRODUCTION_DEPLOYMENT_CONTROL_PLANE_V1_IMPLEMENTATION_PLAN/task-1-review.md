# Task 1 independent review

## Spec compliance

**FAIL — issues found.** Task 1 has six reachable Contract violations in its own queue/provenance surface. **Code quality: NEEDS FIXES.** No implementation acceptance, merge, bootstrap or production authority follows from this review.

- BASE: `950cb218769e10f643cba9befce3d605cfe2c113`.
- HEAD: `2624e16a8a61f298056396f786661b875a9780ed`.
- Worktree: `/Users/yanfenma/workspace/worktrees/production-deployment-control-plane-v1-impl`.
- Authority: accepted `docs/specs/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1.md`, accepted in main `bb5327f`, reviewed semantics `39865536ce51005f95a98473e77c2329078512c0`.
- Review package: `review-task-1-950cb21-2624e16.diff`, complete one-commit change, reviewed in sequential chunks once. The first large output truncated part of the duplicated report/RED narrative, not implementation hunks; the standalone implementer report and final log were independently readable. No changed implementation file was separately reopened for review; line coordinates were located mechanically in the supplied diff.
- Mandate: independent Task 1 review only; no production operations, source/index/ref changes, subagents or full-suite rerun. This report is the sole checkout write.
- Governance: repository bootstrap and local governance read; SDD task-reviewer template applied. No relevant memory facts were used.

## Strengths

- Signatures are domain-separated by record type, role/scope checked against supplied bootstrap catalog and verified with Ed25519 strict verification (`packages/deployment-control-plane/src/trust/verify.rs:10-50`). This is executable verification rather than a caller PASS field.
- Mutations use `BEGIN IMMEDIATE` and commit before return (`packages/deployment-control-plane/src/queue/mod.rs:25-34`); FULL synchronous writes, foreign keys, append-only receipt/journal triggers and immutable descriptor are present (`packages/deployment-control-plane/src/queue/schema.rs:2-35`).
- Signed snapshot completeness and producer/Goal CAS are checked transactionally (`packages/deployment-control-plane/src/queue/producer.rs:35-93`, `:165-198`). Policy observations commit separately from rejected admission, preserving an observed revocation (`packages/deployment-control-plane/src/queue/admission.rs:11`, `:59-72`, `:133-157`).
- The source is split into trust, intake, lifecycle and receipt responsibilities. No new monolithic/barrel implementation was observed; the five-line `src/lib.rs` only declares the public modules/error export. Controller-supplied supplemental Rust count reports 19 files, maximum 303 lines / 7 children / depth 2. The general structure gate's `.rs` omission is not claimed as positive Rust evidence; unrelated baseline directory violations remain FOLLOW_UP_DEBT.

## Frozen blocker union

`FROZEN_BLOCKER_UNION = [DCP-T1-B01, DCP-T1-B02, DCP-T1-B03, DCP-T1-B04, DCP-T1-B05, DCP-T1-B06]`

All six are **Important / Must fix for Task 1**. B01/B02/B04/B05/B06 are P1; B03 is P2. No Critical classification is necessary: physical executor effects were not exercised. Each counterexample below was executed using a temporary focused Rust harness linked to the final-test compiled crate. A passing reproducer means the forbidden behavior occurred, not that the product passed its Contract.

### DCP-T1-B01 — queued supersession discards late Goal attachments

**Class:** CONTRACT_VIOLATION. **Priority:** P1.

**SOURCE:** CTR-DCP-002 late immutable coverage attachment and CTR-DCP-003 preservation of Goal links during supersession (`docs/specs/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1.md:145-146`, `:157-162`).

**COUNTEREXAMPLE:** Submit queued A with Goal G1; submit same-intent/artifact late G2, producing two effective coverage records. Submit reviewed replacement B covering only G1 and superseding A. `create_unit` compares only `old.unit.goal_coverage`, the original descriptor (`packages/deployment-control-plane/src/queue/admission.rs:251-254`), rather than the effective `coverage` rows created at `:44-49`. B is accepted and A becomes SUPERSEDED (`:291-301`); B has one coverage record and G2 is stranded on the terminal A. Executed: `reviewer_supersession_drops_late_goal`.

**IMPACT:** An admitted ready Goal silently loses its scheduled deployment/verification when another Goal replaces the unit, violating immutable attachment and link-preservation semantics. FIFO inheritance does not preserve the lost obligation.

**MINIMAL_CLOSURE:** Atomically load all effective old coverage attachments when validating replacement; require reviewed replacement coverage and producer bindings for every old Goal, preserve necessary actor/Goal links, and reject the whole supersession if any late Goal is omitted. Add a queued-late-attachment supersession regression; preserve rollback-on-rejection behavior.

### DCP-T1-B02 — transaction receipts are unit-global, breaking valid second attempts and allowing stale finalize

**Class:** CONTRACT_VIOLATION. **Priority:** P1.

**SOURCE:** CTR-DCP-011 permits a proven bounded second mutating attempt while retaining historical attempt receipts (`docs/specs/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1.md:274-283`); CTR-DCP-015 binds receipts to attempts and old/new service generations (`:327-331`).

**COUNTEREXAMPLE:** Attempt 1 reaches FINALIZING and records a transaction receipt, then a known failure causes ROLLING_BACK -> ROLLED_BACK. A valid signed recovery proof requeues it; attempt 2 reaches FINALIZING. The correct attempt-2 receipt has a different attempt/service generation but is rejected as `RECEIPT_IMMUTABLE`, because `record_transaction` selects any transaction receipt by unit, with no attempt key (`packages/deployment-control-plane/src/queue/receipts.rs:63-70`). Worse, after recording the current Goal PASS, `transition(..., Applied, ...)` succeeds: `finalize` picks that same attempt-1 receipt and never compares its attempt against `s.mutating_attempts` (`:165-174`, `:204-205`). Executed: `reviewer_second_attempt_receipt_rejected`; the final unit reports two mutating attempts while its installed transaction receipt says attempt 1.

**IMPACT:** Either a legal second attempt cannot complete, or the installed record and Goal closure can be finalized against an obsolete process/readback receipt. This is a Task 1 durable provenance failure independent of real filesystem implementation.

**MINIMAL_CLOSURE:** Append distinct immutable transaction receipts per attempt; select and validate the active attempt receipt during finalize and dependency publication, including its generation and readback binding. Preserve attempt-1 history. Bind per-Goal evidence to the relevant attempt or an explicit accepted reuse disposition so old attempt outcomes cannot silently substitute. Regression must reject finalize without a current-attempt transaction receipt, then accept the correct appended receipt.

### DCP-T1-B03 — admission freshness is evaluated before committed transport dedupe

**Class:** CONTRACT_VIOLATION. **Priority:** P2.

**SOURCE:** CTR-DCP-002 request-ID transport idempotency (`docs/specs/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1.md:135-138`) and CTR-DCP-007 durable ACK retries (`:210-212`); actor-bound transport dedupe is explicitly part of the Task 1 brief.

**COUNTEREXAMPLE:** Submit a signed valid request at t=1001, losing its ACK; retry exactly the same actor/request/payload at t=1301 after the policy expires. The original durable request exists, but `submit` runs `observe_policy`/`validate_proposal` before looking up `requests` (`packages/deployment-control-plane/src/queue/admission.rs:11-20`) and returns `POLICY_EXPIRED` instead of the committed request/unit result. Updating the payload's policy under that request would then conflict with its stored digest. Executed: `reviewer_expired_duplicate_loses_ack` (one durable unit remains).

**IMPACT:** A caller cannot reliably recover the authoritative ACK after a delayed retry, despite no new admission or mutation being requested. Revocation/epoch advancement creates the analogous loss. Returning the stored original `install_required` without current state also must not be interpreted as renewed execution permission.

**MINIMAL_CLOSURE:** Authenticate actor and check actor/request identity plus payload digest against committed requests before new-admission freshness/readiness checks. A matching retry should return the durable result/current unit state without granting fresh apply authority; a changed payload remains a conflict. Apply/revalidation continues to enforce fresh policy. Add expired/revoked-policy ACK recovery and post-finalize duplicate regressions.

### DCP-T1-B04 — historical installed receipt satisfies a dependency after its runtime was replaced

**Class:** CONTRACT_VIOLATION. **Priority:** P1.

**SOURCE:** CTR-DCP-010 requires exact semantic prerequisites and rejects incompatible target versions (`docs/specs/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1.md:241-246`); CTR-DCP-006 says lost dependency compatibility fails closed (`:196-199`).

**COUNTEREXAMPLE:** Install A on runtime R at generation 1, retaining its `capability="installed"` receipt and Goal PASS. Install unrelated B on R at generation 2. Submit C on another runtime depending on A's exact installed receipt and Goal PASS. C is both selected as ready and passes `revalidate`. `dependencies_satisfied` only checks A's historical APPLIED state, historical receipt capability and historical Goal outcomes (`packages/deployment-control-plane/src/queue/lifecycle.rs:196-233`); B's finalize changes `installed` but not A's APPLIED state (`packages/deployment-control-plane/src/queue/receipts.rs:204-205`). `revalidate` only calls existence/state-oriented `check_dependencies` (`packages/deployment-control-plane/src/queue/admission.rs:109`, `:182-195`). No current-generation match or authenticated compatibility evidence connects B to the requested A capability. Executed: `reviewer_replaced_runtime_still_satisfies_installed_dependency`.

**IMPACT:** C can be admitted/prechecked as requiring a runtime capability that is no longer installed. Exact receipt digest equality proves historical execution, not current dependency compatibility.

**MINIMAL_CLOSURE:** Resolve live installation capabilities against protected current installed generation under the scheduling/apply checks. Reject or block a replaced prerequisite unless explicit trusted compatibility evidence satisfies the dependency. Preserve historical receipts and allow genuinely historical prerequisites only through an explicit semantic distinction, without treating every APPLIED unit as a live installed capability. Add replacement and failed-compatibility negatives at admission and pre-mutation revalidation.

### DCP-T1-B05 — recovery clears STOP before fresh gates; ordinary cancel then skips the failed intent

**Class:** CONTRACT_VIOLATION. **Priority:** P1.

**SOURCE:** CTR-DCP-010 persists STOP until the failed intent has a proven safe disposition AND its corrected unit/replacement passes all gates; unresolved failure cannot be skipped to resume work (`docs/specs/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1.md:250-253`). CTR-DCP-011 requires fresh admission/precheck for retry (`:274-278`).

**COUNTEREXAMPLE:** A's PRECHECK fails into BLOCKED under STOP_TRAIN; B on an independent runtime is queued. Observe a fresh signed policy revoking A's artifact. A legitimate fresh signed physical-remediation receipt is accepted by `retry`, which checks profile enablement/revision but no current admission policy (`packages/deployment-control-plane/src/queue/lifecycle.rs:33-80`), requeues A and deletes its pause immediately (`:85-93`). A still fails `revalidate` with REVOKED. The ordinary authorized `cancel_pending` call then cancels this requeued A (`:20-29`); B becomes schedulable because the failed intent no longer has a pause or failed-state resource row. Executed: `reviewer_retry_cancel_clears_stop_before_fresh_admission`.

**IMPACT:** A normal queue operation bypasses the accepted STOP resume condition. Safe physical remediation is not evidence that the corrected revoked unit passed admission, and cancellation is not a replacement receipt.

**MINIMAL_CLOSURE:** Persist failed-intent pause independently of the temporary Queued state, validate fresh admission/dependency/preimage conditions on corrected work, and clear STOP only at the accepted proven-safe resume boundary. Allow the designated corrected unit to advance without allowing unrelated scheduling or cancel to erase the pause. Add the revoked-recovery/cancel regression and a positive automatic-resume case; do not add per-head Owner approval.

### DCP-T1-B06 — late coverage's required review is neither revalidated nor exposed as evidence

**Class:** CONTRACT_VIOLATION. **Priority:** P1.

**SOURCE:** CTR-DCP-002 requires immutable review/coverage semantics (`docs/specs/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1.md:131-146`), CTR-DCP-003 requires reviewed coverage (`:155-159`), CTR-DCP-004 independently trusted required review (`:166-174`) and CTR-DCP-006 current trust/blocker revalidation (`:192-199`).

**COUNTEREXAMPLE:** Admit original Goal G1 with reviewer K1. Attach G2 with a distinct independently trusted reviewer K2 for the same artifact. Remove K2 from the protected current catalog (a trusted key revocation; no request controls the catalog). Direct validation of G2's saved proposal now returns UNKNOWN_ISSUER, but `Queue::revalidate` succeeds for the effective two-Goal unit: it loads only `units.evidence`, the original proposal (`packages/deployment-control-plane/src/queue/admission.rs:95-109`). The late full proposal was saved to `attachments.evidence` (`:44`) but no read API exposes it: `daemon_coverage` returns only ReadyRecords, and `daemon_evidence` returns only original evidence (`packages/deployment-control-plane/src/queue/readback.rs:18-38`). Executed: `reviewer_late_review_revocation_not_revalidated`.

**IMPACT:** The public core revalidation API can approve a unit whose attached Goal no longer has trusted required review. The next executor cannot independently repair that decision through the supplied evidence APIs; the immutable Unit/transaction reviews also remain only the original review list.

**MINIMAL_CLOSURE:** Revalidate the full effective attachment set with the current protected trust/policy and expose immutable attachment evidence/digests for executor and receipt provenance. Reject affected attached coverage if its required signer/proof is no longer valid. Do not rewrite the original descriptor. Add key-revocation/invalid-late-proof negatives plus successful retrieval of every attachment's exact build/review evidence.

## Verification and limits

- Read the requested brief, implementer report, review request, governing accepted Spec, repository governance, and task-reviewer template. Reviewed every implementation/test hunk from the supplied package. No broader source crawl or Git commands.
- Original final log is accessible and clean: `task-1-evidence/final-tests.log` reports 12 authority + 17 queue tests, 29 passed, zero failures/compiler warnings. These runs demonstrate their asserted cases, not the six combinations above. No original test was rerun.
- Focused checks used only the existing Task 1 final-test compiled crate/fixture source and temporary reviewer harness. No external production code was read. The first temporary harness compilation failed because nested fixture imports expected crate-root names; fixing the temporary harness layout produced a clean compilation. This is reviewer harness setup, not a product warning or failure.
- The first five reproducer tests ran once and all observed their asserted violations; 17 original tests were filtered out. The sixth new test was then compiled and run alone; all other tests were filtered out. No full suite, race detector, repeated loop, production operation, source/index/ref mutation or subagent was used.
- Not verified and not claimed missing Task 1 implementations: filesystem sealing/manifest byte mapping, descriptor-relative path safety, actual ownership/ACL identities, permanent OS mutex, real service/child generation reconciliation, Unix peer credentials, Train implementation, historical importer, production bootstrap/activation and real canary. Generic phase methods are documented privileged internal APIs; their existence alone is not a caller bypass finding.
- Full-disk/fsync, retention and crash-at-every-physical-edge behavior remain downstream integration evidence. `Queue::open` quick-check/SQL error propagation is visible (`packages/deployment-control-plane/src/queue/mod.rs:15-34`), but no full corrupt-store/fault proof is claimed.
- Re-audit should close the six frozen blockers and directly affected semantics/evidence. Optional hardening, unrelated repository baseline debt and unimplemented downstream physical layers must not expand this Task 1 repair scope.

## Assessment

**Spec compliance: FAIL. Task quality: NEEDS FIXES.** Real signatures and transactions provide useful foundations, but stale attempt evidence, dropped attached Goals, and historical dependency acceptance are durable core correctness defects. All six blockers have concrete executed counterexamples and can be repaired within the accepted Task 1 semantics.

## Focused reproducer evidence

The complete temporary harness is embedded below so the observations remain reproducible even if the temporary directory disappears. It reuses the candidate's `test/queue.rs` fixtures but filters all original tests. It was compiled with `rustc --edition=2021 --test focused.rs -L dependency=<package>/target/debug/deps --extern ... -o focused`, using the sole existing rlib for each of `deployment_control_plane`, `ed25519_dalek`, `hex`, `sha2`, `tempfile`, `serde_json`. The first five tests were run as `focused reviewer_ --nocapture`; the added sixth was run as `focused reviewer_late_review_revocation_not_revalidated --exact --nocapture`. The absolute source include should point to the exact reviewed checkout when reproducing elsewhere. These tests assert the observed bugs; implementation regressions must invert the forbidden expectations.

Temporary evidence directory: `/var/folders/jh/5k4x44w12ps1kbrch8__f6b80000gp/T/dcp-task1-review-trrevas7`.

### Executed output, first five

```text

running 5 tests
test reviewer_expired_duplicate_loses_ack ... ok
test reviewer_second_attempt_receipt_rejected ... ok
test reviewer_supersession_drops_late_goal ... ok
test reviewer_retry_cancel_clears_stop_before_fresh_admission ... ok
test reviewer_replaced_runtime_still_satisfies_installed_dependency ... ok

test result: ok. 5 passed; 0 failed; 0 ignored; 0 measured; 17 filtered out; finished in 0.09s

```

### Executed output, sixth

```text

running 1 test
test reviewer_late_review_revocation_not_revalidated ... ok

test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 22 filtered out; finished in 0.02s

```

### Complete focused harness

```rust
#![allow(dead_code)]
include!("/Users/yanfenma/workspace/worktrees/production-deployment-control-plane-v1-impl/packages/deployment-control-plane/test/queue.rs");
fn recover(q: &Queue,c: &Catalog,id: &str) {
 let s=q.daemon_status(id).unwrap();
 q.retry(c,&signed("recovery",RecoveryEvidence {unit_id:id.into(),status_revision:s.revision,failure_cause_digest:"1".repeat(64),remediation_digest:"2".repeat(64),restored_preimage_digest:"3".repeat(64),service_readback_digest:"4".repeat(64),owned_operations_receipt:"5".repeat(64),step_dispositions:vec![StepDisposition::Restored("apply".into())],issued_at:1001}),1001).unwrap();
}
fn tx_receipt(q: &Queue,id: &str)->TransactionReceipt {
 let s=q.daemon_status(id).unwrap(); let u=s.unit;
 TransactionReceipt {unit_id:id.into(),artifact_sha256:u.artifact_sha256,source_sha:u.source_sha,profile_revision:u.profile_revision,policy_digest:deployment_control_plane::trust::digest(&signed("authority",policy())).unwrap(),review_digests:u.required_reviews,caller:"caller".into(),dependency_receipts:vec![],preimage_digest:"1".repeat(64),postimage_digest:"2".repeat(64),old_service_generation:"old".into(),new_service_generation:format!("new-{}",s.mutating_attempts),target_generation:u.expected_target_generation+1,attempt:s.mutating_attempts,step_results:vec!["readback-pass".into()],rollback_digest:None,capability:"installed".into()}
}
fn other(c: &mut Catalog,p: &mut Proposal)->Actor {
 let mut profile=c.profiles["fixture"].clone();profile.target_runtime="other".into();profile.install_root_id="other-root".into();c.profiles.insert("other".into(),profile);
 for key in c.keys.values_mut(){key.scopes.push("other".into());}
 p.deployment_profile="other".into();p.desired.payload.target_runtime="other".into();p.desired=signed("authority",p.desired.payload.clone());let mut a=actor();a.allowed_profiles.push("other".into());a
}
#[test] fn reviewer_expired_duplicate_loses_ack(){
 let (_dir,q,c)=setup();let p=proposal("req","e",1,"goal");register(&q,&c,&p);q.submit(&c,&actor(),&p,1001).unwrap();
 assert_eq!(q.submit(&c,&actor(),&p,1301).unwrap_err().code(),"POLICY_EXPIRED");assert_eq!(q.unit_count().unwrap(),1);
}
#[test] fn reviewer_supersession_drops_late_goal(){
 let (_dir,q,c)=setup();let p=proposal("req","e",1,"goal");register(&q,&c,&p);let id=q.submit(&c,&actor(),&p,1001).unwrap().unit_id;
 let late=proposal("late","e",1,"late");register(&q,&c,&late);q.submit(&c,&actor(),&late,1001).unwrap();assert_eq!(q.daemon_coverage(&id).unwrap().len(),2);
 let mut r=proposal("replacement","f",2,"goal");r.goals[0].payload.revision=2;r.goals[0]=signed("producer",r.goals[0].payload.clone());q.register_ready(&c,&r.goals[0],1).unwrap();r.supersedes.push(id.clone());let replacement=q.submit(&c,&actor(),&r,1001).unwrap();
 assert_eq!(q.daemon_status(&id).unwrap().state,State::Superseded);assert_eq!(q.daemon_coverage(&replacement.unit_id).unwrap().len(),1);assert!(q.daemon_coverage(&replacement.unit_id).unwrap().iter().all(|g|g.payload.goal_id!="late"));
}
#[test] fn reviewer_second_attempt_receipt_rejected(){
 let (_dir,q,c)=setup();let p=proposal("req","e",1,"goal");register(&q,&c,&p);let id=q.submit(&c,&actor(),&p,1001).unwrap().unit_id;
 for s in [State::Precheck,State::Applying,State::Restarting,State::Verifying,State::Finalizing]{transition(&q,&id,s);}
 q.record_transaction(&tx_receipt(&q,&id)).unwrap();transition(&q,&id,State::RollingBack);transition(&q,&id,State::RolledBack);recover(&q,&c,&id);
 for s in [State::Precheck,State::Applying,State::Restarting,State::Verifying,State::Finalizing]{transition(&q,&id,s);}
 assert_eq!(q.record_transaction(&tx_receipt(&q,&id)).unwrap_err().code(),"RECEIPT_IMMUTABLE");
 let goal=signed("verifier",GoalReceipt{unit_id:id.clone(),goal_id:"goal".into(),acceptance_revision:"accept-1".into(),target_generation:1,outcome:GoalOutcome::Pass,evidence_digest:"9".repeat(64),revision:1});q.record_goal(&c,&goal).unwrap();transition(&q,&id,State::Applied);
 let digests=q.receipt_digests(&actor(),&id).unwrap();let transaction=digests.into_iter().filter_map(|d|serde_json::from_str::<TransactionReceipt>(&q.receipt(&actor(),&d).unwrap()).ok()).next().unwrap();assert_eq!(transaction.attempt,1);assert_eq!(q.daemon_status(&id).unwrap().mutating_attempts,2);
}
#[test] fn reviewer_replaced_runtime_still_satisfies_installed_dependency(){
 let (_dir,q,mut c)=setup();let a=proposal("a","e",1,"goal-a");register(&q,&c,&a);let aid=q.submit(&c,&actor(),&a,1001).unwrap().unit_id;let receipt=installed(&q,&c,&aid,1);
 let mut b=proposal("b","f",2,"goal-b");b.desired.payload.expected_target_generation=1;b.desired=signed("authority",b.desired.payload);register(&q,&c,&b);let bid=q.submit(&c,&actor(),&b,1001).unwrap().unit_id;installed(&q,&c,&bid,2);
 let mut dep=proposal("dependent","a",1,"goal-d");let ac=other(&mut c,&mut dep);dep.dependencies.push(Dependency{unit_id:aid,receipt_digest:receipt,capability:"installed".into(),required_goals:vec!["goal-a".into()]});register(&q,&c,&dep);let did=q.submit(&c,&ac,&dep,1001).unwrap().unit_id;
 assert_eq!(q.next_ready(&c).unwrap().unwrap().unit.deployment_unit_id,did);q.revalidate(&c,&did,&dep.policy,1001).unwrap();
}
#[test] fn reviewer_retry_cancel_clears_stop_before_fresh_admission(){
 let (_dir,q,mut c)=setup();let a=proposal("a","e",1,"goal-a");register(&q,&c,&a);let aid=q.submit(&c,&actor(),&a,1001).unwrap().unit_id;
 let mut b=proposal("b","f",1,"goal-b");let ac=other(&mut c,&mut b);register(&q,&c,&b);let bid=q.submit(&c,&ac,&b,1001).unwrap().unit_id;
 transition(&q,&aid,State::Precheck);transition(&q,&aid,State::Blocked);assert!(q.next_ready(&c).unwrap().is_none());
 let mut revoked=policy();revoked.epoch=2;revoked.revoked_artifacts.push("e".repeat(64));let revoked=signed("authority",revoked);q.observe_policy(&c,"fixture",&revoked,1001).unwrap();recover(&q,&c,&aid);
 assert_eq!(q.revalidate(&c,&aid,&revoked,1001).unwrap_err().code(),"REVOKED");let s=q.daemon_status(&aid).unwrap();q.cancel_pending(&actor(),&aid,s.revision).unwrap();
 assert_eq!(q.next_ready(&c).unwrap().unwrap().unit.deployment_unit_id,bid);
}

#[test] fn reviewer_late_review_revocation_not_revalidated(){
 use sha2::{Digest,Sha256};
 let (_dir,q,mut c)=setup();let mut k=c.keys["reviewer"].clone();let seed:[u8;32]=Sha256::digest(b"late-reviewer").into();k.public_key=hex::encode(ed25519_dalek::SigningKey::from_bytes(&seed).verifying_key().as_bytes());c.keys.insert("late-reviewer".into(),k);
 let a=proposal("a","e",1,"goal-a");register(&q,&c,&a);let id=q.submit(&c,&actor(),&a,1001).unwrap().unit_id;
 let mut late=proposal("late","e",1,"late");late.reviews[0]=signed("late-reviewer",late.reviews[0].payload.clone());register(&q,&c,&late);q.submit(&c,&actor(),&late,1001).unwrap();
 c.keys.remove("late-reviewer");c.revision="catalog-2".into();
 assert_eq!(deployment_control_plane::trust::validate_proposal(&c,&actor(),&late,1001).unwrap_err().code(),"UNKNOWN_ISSUER");
 q.revalidate(&c,&id,&a.policy,1001).unwrap();assert_eq!(q.daemon_coverage(&id).unwrap().len(),2);
 assert_eq!(q.daemon_evidence(&id).unwrap().reviews[0].issuer,"reviewer");
}
```
