use crate::{common::*, installed, transition};
use deployment_control_plane::{model::*, queue::Queue, trust::digest};
fn recovery(q: &Queue, id: &str) -> Signed<RecoveryEvidence> {
    signed(
        "recovery",
        RecoveryEvidence {
            unit_id: id.into(),
            status_revision: q.daemon_status(id).unwrap().revision,
            failure_cause_digest: "1".repeat(64),
            remediation_digest: "2".repeat(64),
            restored_preimage_digest: "3".repeat(64),
            service_readback_digest: "4".repeat(64),
            owned_operations_receipt: "5".repeat(64),
            step_dispositions: vec![StepDisposition::Restored("apply".into())],
            issued_at: 1001,
        },
    )
}
fn transaction(q: &Queue, c: &Catalog, id: &str) -> TransactionReceipt {
    let s = q.daemon_status(id).unwrap();
    let u = s.unit;
    let proposal = q.daemon_evidence(id).unwrap();
    let attached = q
        .submit(c, &actor(), &proposal, 1001)
        .unwrap()
        .attachment_digest;
    TransactionReceipt {
        unit_id: id.into(),
        artifact_sha256: u.artifact_sha256,
        source_sha: u.source_sha,
        profile_revision: u.profile_revision,
        policy_digest: digest(&proposal.policy).unwrap(),
        review_digests: u.required_reviews,
        caller: "caller".into(),
        dependency_receipts: vec![],
        preimage_digest: "1".repeat(64),
        postimage_digest: "2".repeat(64),
        old_service_generation: "old".into(),
        new_service_generation: format!("new-{}", s.mutating_attempts),
        target_generation: u.expected_target_generation + 1,
        attempt: s.mutating_attempts,
        attachment_digests: vec![attached],
        step_results: vec!["readback-pass".into()],
        rollback_digest: None,
        capability: "installed".into(),
    }
}
fn goal(q: &Queue, c: &Catalog, id: &str, attempt: u32, revision: u64) -> Signed<GoalReceipt> {
    let p = q.daemon_evidence(id).unwrap();
    signed(
        "verifier",
        GoalReceipt {
            unit_id: id.into(),
            goal_id: "goal".into(),
            acceptance_revision: "accept-1".into(),
            target_generation: 1,
            attempt,
            service_generation: format!("new-{attempt}"),
            attachment_digest: q.submit(c, &actor(), &p, 1001).unwrap().attachment_digest,
            outcome: GoalOutcome::Pass,
            evidence_digest: "9".repeat(64),
            revision,
        },
    )
}
fn other(c: &mut Catalog, p: &mut Proposal) -> Actor {
    let mut profile = c.profiles["fixture"].clone();
    profile.target_runtime = "other".into();
    profile.install_root_id = "other-root".into();
    c.profiles.insert("other".into(), profile);
    for key in c.keys.values_mut() {
        key.scopes.push("other".into());
    }
    p.deployment_profile = "other".into();
    p.desired.payload.target_runtime = "other".into();
    p.desired = signed("authority", p.desired.payload.clone());
    let mut a = actor();
    a.allowed_profiles.push("other".into());
    a
}
#[test]
fn b01_supersession_preserves_all_late_goal_and_actor_links() {
    let (_dir, q, c) = setup();
    let p = proposal("req", "e", 1, "goal");
    register(&q, &c, &p);
    let id = q.submit(&c, &actor(), &p, 1001).unwrap().unit_id;
    let late = proposal("late", "e", 1, "late");
    let mut late_actor = actor();
    late_actor.id = "late-caller".into();
    register(&q, &c, &late);
    q.submit(&c, &late_actor, &late, 1001).unwrap();
    let mut r = proposal("replacement", "f", 2, "goal");
    r.goals[0].payload.revision = 2;
    r.goals[0] = signed("producer", r.goals[0].payload.clone());
    q.register_ready(&c, &r.goals[0], 1).unwrap();
    r.supersedes.push(id.clone());
    assert_eq!(
        q.submit(&c, &actor(), &r, 1001).unwrap_err().code(),
        "SUPERSESSION_COVERAGE"
    );
    assert_eq!(q.daemon_status(&id).unwrap().state, State::Queued);
    assert_eq!(q.unit_count().unwrap(), 1);
    let mut late_ready = late.goals[0].payload.clone();
    late_ready.revision = 2;
    late_ready.artifact_sha256 = "f".repeat(64);
    let late_ready = signed("producer", late_ready);
    q.register_ready(&c, &late_ready, 1).unwrap();
    r.build
        .payload
        .goal_coverage
        .push(late_ready.payload.coverage.clone());
    r.build = signed("builder", r.build.payload);
    r.goals.push(late_ready);
    let replacement = q.submit(&c, &actor(), &r, 1001).unwrap();
    assert_eq!(q.daemon_coverage(&replacement.unit_id).unwrap().len(), 2);
    q.status(&late_actor, &replacement.unit_id).unwrap();
}
#[test]
fn b02_current_attempt_needs_its_own_transaction_and_goal_readback_receipts() {
    let (_dir, q, c) = setup();
    let p = proposal("req", "e", 1, "goal");
    register(&q, &c, &p);
    let id = q.submit(&c, &actor(), &p, 1001).unwrap().unit_id;
    for s in [
        State::Precheck,
        State::Applying,
        State::Restarting,
        State::Verifying,
        State::Finalizing,
    ] {
        transition(&q, &id, s);
    }
    let first = transaction(&q, &c, &id);
    let first_digest = q.record_transaction(&first).unwrap();
    q.record_goal(&c, &goal(&q, &c, &id, 1, 1)).unwrap();
    transition(&q, &id, State::RollingBack);
    transition(&q, &id, State::RolledBack);
    q.retry(&c, &recovery(&q, &id), 1001).unwrap();
    for s in [
        State::Precheck,
        State::Applying,
        State::Restarting,
        State::Verifying,
        State::Finalizing,
    ] {
        transition(&q, &id, s);
    }
    let revision = q.daemon_status(&id).unwrap().revision;
    assert_eq!(
        q.transition(&id, revision, State::Applied, &"1".repeat(64))
            .unwrap_err()
            .code(),
        "TRANSACTION_RECEIPT_REQUIRED"
    );
    let second = transaction(&q, &c, &id);
    let second_digest = q.record_transaction(&second).unwrap();
    assert_ne!(first_digest, second_digest);
    assert_eq!(
        q.transition(&id, revision, State::Applied, &"1".repeat(64))
            .unwrap_err()
            .code(),
        "GOAL_ATTEMPT_MISMATCH"
    );
    let mut wrong = goal(&q, &c, &id, 2, 2);
    wrong.payload.service_generation = "new-1".into();
    wrong = signed("verifier", wrong.payload);
    assert_eq!(
        q.record_goal(&c, &wrong).unwrap_err().code(),
        "GOAL_READBACK_MISMATCH"
    );
    q.record_goal(&c, &goal(&q, &c, &id, 2, 2)).unwrap();
    transition(&q, &id, State::Applied);
    assert_eq!(
        serde_json::from_str::<TransactionReceipt>(&q.receipt(&actor(), &first_digest).unwrap())
            .unwrap()
            .attempt,
        1
    );
    let outbox = q.outbox(&actor()).unwrap();
    let closed: Signed<GoalReceipt> =
        serde_json::from_str(&q.receipt(&actor(), &outbox[0].receipt_digest).unwrap()).unwrap();
    assert_eq!(closed.payload.attempt, 2);
}
#[test]
fn b03_committed_ack_survives_expired_revoked_policy_and_reports_finalized_state() {
    let (_dir, q, c) = setup();
    let p = proposal("req", "e", 1, "goal");
    register(&q, &c, &p);
    let first = q.submit(&c, &actor(), &p, 1001).unwrap();
    assert_eq!(
        q.submit(&c, &actor(), &p, 1301).unwrap().unit_id,
        first.unit_id
    );
    installed(&q, &c, &first.unit_id, 1);
    let mut revoked = policy();
    revoked.epoch = 2;
    revoked.revoked_artifacts.push("e".repeat(64));
    q.observe_policy(&c, "fixture", &signed("authority", revoked), 1001)
        .unwrap();
    let ack = q.submit(&c, &actor(), &p, 1301).unwrap();
    assert_eq!(ack.unit_id, first.unit_id);
    assert!(!ack.install_required);
    assert_eq!(ack.state, State::Applied);
    assert_eq!(
        ack.status_revision,
        q.daemon_status(&first.unit_id).unwrap().revision
    );
    let mut changed = p;
    changed.policy.payload.epoch = 2;
    assert_eq!(
        q.submit(&c, &actor(), &changed, 1301).unwrap_err().code(),
        "REQUEST_CONFLICT"
    );
}
#[test]
fn b04_replaced_runtime_cannot_satisfy_live_installation_dependency() {
    let (_dir, q, mut c) = setup();
    let a = proposal("a", "e", 1, "goal-a");
    register(&q, &c, &a);
    let aid = q.submit(&c, &actor(), &a, 1001).unwrap().unit_id;
    let receipt = installed(&q, &c, &aid, 1);
    let mut b = proposal("b", "f", 2, "goal-b");
    b.desired.payload.expected_target_generation = 1;
    b.desired = signed("authority", b.desired.payload);
    register(&q, &c, &b);
    let bid = q.submit(&c, &actor(), &b, 1001).unwrap().unit_id;
    let mut dep = proposal("dependent", "a", 1, "goal-d");
    let ac = other(&mut c, &mut dep);
    dep.dependencies.push(Dependency {
        unit_id: aid,
        receipt_digest: receipt,
        capability: "installed".into(),
        required_goals: vec!["goal-a".into()],
        semantics: DependencySemantics::LiveInstallation,
    });
    register(&q, &c, &dep);
    let did = q.submit(&c, &ac, &dep, 1001).unwrap().unit_id;
    installed(&q, &c, &bid, 2);
    assert!(q.next_ready(&c).unwrap().is_none());
    assert_eq!(
        q.revalidate(&c, &did, &dep.policy, 1001)
            .unwrap_err()
            .code(),
        "DEPENDENCY_NOT_CURRENT"
    );
    dep.request_id = "new-dependent-request".into();
    assert_eq!(
        q.submit(&c, &ac, &dep, 1001).unwrap_err().code(),
        "DEPENDENCY_NOT_CURRENT"
    );
    dep.request_id = "relabeled-history".into();
    dep.dependencies[0].semantics = DependencySemantics::HistoricalReceipt;
    assert_eq!(
        q.submit(&c, &ac, &dep, 1001).unwrap_err().code(),
        "UNSUPPORTED_DEPENDENCY_SEMANTICS"
    );
}
#[test]
fn b05_revoked_recovery_and_cancel_cannot_clear_stop() {
    let (_dir, q, mut c) = setup();
    let a = proposal("a", "e", 1, "goal-a");
    register(&q, &c, &a);
    let aid = q.submit(&c, &actor(), &a, 1001).unwrap().unit_id;
    let mut b = proposal("b", "f", 1, "goal-b");
    let ac = other(&mut c, &mut b);
    register(&q, &c, &b);
    q.submit(&c, &ac, &b, 1001).unwrap();
    transition(&q, &aid, State::Precheck);
    transition(&q, &aid, State::Blocked);
    let mut revoked = policy();
    revoked.epoch = 2;
    revoked.revoked_artifacts.push("e".repeat(64));
    q.observe_policy(&c, "fixture", &signed("authority", revoked), 1001)
        .unwrap();
    assert_eq!(
        q.retry(&c, &recovery(&q, &aid), 1001).unwrap_err().code(),
        "REVOKED"
    );
    assert!(q.next_ready(&c).unwrap().is_none());
    let mut fixed = policy();
    fixed.epoch = 3;
    let fixed = signed("authority", fixed);
    q.observe_policy(&c, "fixture", &fixed, 1001).unwrap();
    q.retry(&c, &recovery(&q, &aid), 1001).unwrap();
    let revision = q.daemon_status(&aid).unwrap().revision;
    assert_eq!(
        q.cancel_pending(&actor(), &aid, revision)
            .unwrap_err()
            .code(),
        "FAILED_INTENT_PAUSED"
    );
    assert_eq!(
        q.next_ready(&c).unwrap().unwrap().unit.deployment_unit_id,
        aid
    );
}
#[test]
fn b06_every_attachment_review_is_exposed_and_currently_revalidated() {
    use sha2::{Digest, Sha256};
    let (_dir, q, mut c) = setup();
    let mut key = c.keys["reviewer"].clone();
    let seed: [u8; 32] = Sha256::digest(b"late-reviewer").into();
    key.public_key = hex::encode(
        ed25519_dalek::SigningKey::from_bytes(&seed)
            .verifying_key()
            .as_bytes(),
    );
    c.keys.insert("late-reviewer".into(), key);
    let a = proposal("a", "e", 1, "goal-a");
    register(&q, &c, &a);
    let id = q.submit(&c, &actor(), &a, 1001).unwrap().unit_id;
    let mut late = proposal("late", "e", 1, "late");
    late.reviews[0] = signed("late-reviewer", late.reviews[0].payload.clone());
    register(&q, &c, &late);
    let attachment = q
        .submit(&c, &actor(), &late, 1001)
        .unwrap()
        .attachment_digest;
    c.keys.remove("late-reviewer");
    c.revision = "catalog-2".into();
    assert_eq!(
        q.revalidate(&c, &id, &a.policy, 1001).unwrap_err().code(),
        "UNKNOWN_ISSUER"
    );
    let effective = q.daemon_attachments(&id).unwrap();
    assert_eq!(effective.len(), 2);
    assert_eq!(
        effective
            .iter()
            .find(|x| x.digest == attachment)
            .unwrap()
            .proposal,
        late
    );
}

#[path = "queue_repair_provenance.rs"]
mod provenance;
