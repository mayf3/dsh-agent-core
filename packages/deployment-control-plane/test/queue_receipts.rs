use crate::{common::*, installed, transition};
use deployment_control_plane::{model::*, queue::Queue};
#[test]
fn outbox_closure_is_signed_idempotent_and_never_reinstalls() {
    let (dir, q, c) = setup();
    let p = proposal("req", "e", 1, "goal");
    register(&q, &c, &p);
    let id = q.submit(&c, &actor(), &p, 1001).unwrap().unit_id;
    installed(&q, &c, &id, 1);
    let entry = q.outbox(&actor()).unwrap().remove(0);
    drop(q);
    let q = Queue::open(dir.path().join("queue.db")).unwrap();
    assert_eq!(q.outbox(&actor()).unwrap(), vec![entry.clone()]);
    let ack = signed(
        "producer",
        ClosureAcknowledgement {
            outbox_id: entry.id.clone(),
            goal_id: entry.goal_id.clone(),
            receipt_digest: entry.receipt_digest.clone(),
            previous_revision: entry.expected_producer_revision,
            closed_revision: entry.expected_producer_revision + 1,
        },
    );
    let mut forged = ack.clone();
    forged.payload.closed_revision = 8;
    assert_eq!(
        q.acknowledge_closure(&c, &forged).unwrap_err().code(),
        "INVALID_SIGNATURE"
    );
    q.acknowledge_closure(&c, &ack).unwrap();
    q.acknowledge_closure(&c, &ack).unwrap();
    assert!(q.outbox(&actor()).unwrap().is_empty());
    assert_eq!(q.status(&actor(), &id).unwrap().mutating_attempts, 1);
}
#[test]
fn late_goal_uses_accepted_verifier_and_receipt_is_generation_bound() {
    let (_dir, q, c) = setup();
    let p = proposal("req", "e", 1, "goal");
    register(&q, &c, &p);
    let id = q.submit(&c, &actor(), &p, 1001).unwrap().unit_id;
    installed(&q, &c, &id, 1);
    let late = proposal("late", "e", 1, "late");
    register(&q, &c, &late);
    q.submit(&c, &actor(), &late, 1001).unwrap();
    let receipt = GoalReceipt {
        attempt: 1,
        service_generation: "new".into(),
        attachment_digest: q
            .submit(&c, &actor(), &late, 1001)
            .unwrap()
            .attachment_digest,
        unit_id: id.clone(),
        goal_id: "late".into(),
        acceptance_revision: "accept-1".into(),
        target_generation: 1,
        outcome: GoalOutcome::Pass,
        evidence_digest: "1".repeat(64),
        revision: 1,
    };
    assert_eq!(
        q.record_goal(&c, &signed("producer", receipt.clone()))
            .unwrap_err()
            .code(),
        "ISSUER_ROLE"
    );
    let hash = q
        .record_goal(&c, &signed("verifier", receipt.clone()))
        .unwrap();
    assert!(q.receipt(&actor(), &hash).unwrap().contains("late"));
    assert_eq!(q.outbox(&actor()).unwrap().len(), 2);
    assert_eq!(q.status(&actor(), &id).unwrap().mutating_attempts, 1);
}
#[test]
fn unknown_goal_blocks_finalize_and_has_no_automatic_verification_retry() {
    let (_dir, q, c) = setup();
    let p = proposal("req", "e", 1, "goal");
    register(&q, &c, &p);
    let id = q.submit(&c, &actor(), &p, 1001).unwrap().unit_id;
    for state in [
        State::Precheck,
        State::Applying,
        State::Restarting,
        State::Verifying,
    ] {
        transition(&q, &id, state);
    }
    let mut r = GoalReceipt {
        attempt: 1,
        service_generation: "new".into(),
        attachment_digest: q.submit(&c, &actor(), &p, 1001).unwrap().attachment_digest,
        unit_id: id.clone(),
        goal_id: "goal".into(),
        acceptance_revision: "accept-1".into(),
        target_generation: 1,
        outcome: GoalOutcome::OutcomeUnknown,
        evidence_digest: "1".repeat(64),
        revision: 1,
    };
    q.record_goal(&c, &signed("verifier", r.clone())).unwrap();
    r.revision = 2;
    r.outcome = GoalOutcome::Pass;
    assert_eq!(
        q.record_goal(&c, &signed("verifier", r))
            .unwrap_err()
            .code(),
        "UNKNOWN_CANARY"
    );
    assert!(q.next_ready(&c).unwrap().is_none());
    assert!(q.outbox(&actor()).unwrap().is_empty());
}
#[test]
fn two_mutating_attempts_survive_new_request_and_same_artifact_revision_cannot_reset_budget() {
    let (_dir, q, c) = setup();
    let p = proposal("req", "e", 1, "goal");
    register(&q, &c, &p);
    let id = q.submit(&c, &actor(), &p, 1001).unwrap().unit_id;
    for attempt in 1..=2 {
        for state in [
            State::Precheck,
            State::Applying,
            State::RollingBack,
            State::RolledBack,
        ] {
            transition(&q, &id, state);
        }
        let status = q.status(&actor(), &id).unwrap();
        assert_eq!(status.mutating_attempts, attempt);
        let e = signed(
            "recovery",
            RecoveryEvidence {
                unit_id: id.clone(),
                status_revision: status.revision,
                failure_cause_digest: "1".repeat(64),
                remediation_digest: "2".repeat(64),
                restored_preimage_digest: "3".repeat(64),
                service_readback_digest: "4".repeat(64),
                owned_operations_receipt: "5".repeat(64),
                step_dispositions: vec![StepDisposition::Restored("apply".into())],
                issued_at: 1001,
            },
        );
        if attempt == 1 {
            q.retry(&c, &e, 1001).unwrap();
        } else {
            assert_eq!(
                q.retry(&c, &e, 1001).unwrap_err().code(),
                "RETRY_BUDGET_EXHAUSTED"
            );
        }
    }
    let mut another = p.clone();
    another.request_id = "new-request".into();
    q.submit(&c, &actor(), &another, 1001).unwrap();
    another.request_id = "new-revision".into();
    another.desired.payload.revision = 2;
    another.desired = signed("authority", another.desired.payload);
    assert_eq!(
        q.submit(&c, &actor(), &another, 1001).unwrap_err().code(),
        "UNCHANGED_DESIRED_STATE"
    );
    assert_eq!(q.status(&actor(), &id).unwrap().mutating_attempts, 2);
}
#[test]
fn queue_quota_rejects_new_work_and_wrong_revision_cannot_move_state() {
    let (_dir, q, mut c) = setup();
    c.profiles.get_mut("fixture").unwrap().queue_quota = 1;
    let p = proposal("req", "e", 1, "goal");
    register(&q, &c, &p);
    let id = q.submit(&c, &actor(), &p, 1001).unwrap().unit_id;
    assert_eq!(
        q.transition(&id, 9, State::Precheck, &"1".repeat(64))
            .unwrap_err()
            .code(),
        "REVISION_CAS"
    );
    let second = proposal("other", "f", 2, "other-goal");
    register(&q, &c, &second);
    assert_eq!(
        q.submit(&c, &actor(), &second, 1001).unwrap_err().code(),
        "QUEUE_QUOTA"
    );
    assert_eq!(q.install_intents_for_target("runtime").unwrap(), 1);
}
#[test]
fn transport_request_rate_limit_is_persisted_even_when_units_collapse() {
    let (dir, q, mut c) = setup();
    c.profiles.get_mut("fixture").unwrap().actor_quota = 2;
    let mut p = proposal("one", "e", 1, "goal");
    register(&q, &c, &p);
    q.submit(&c, &actor(), &p, 1001).unwrap();
    p.request_id = "two".into();
    q.submit(&c, &actor(), &p, 1001).unwrap();
    drop(q);
    let q = Queue::open(dir.path().join("queue.db")).unwrap();
    p.request_id = "three".into();
    assert_eq!(
        q.submit(&c, &actor(), &p, 1001).unwrap_err().code(),
        "ACTOR_RATE_LIMIT"
    );
    p.request_id = "one".into();
    q.submit(&c, &actor(), &p, 1001).unwrap();
}
#[test]
fn signed_recovery_proof_is_retained_as_an_immutable_receipt() {
    let (_dir, q, c) = setup();
    let p = proposal("req", "e", 1, "goal");
    register(&q, &c, &p);
    let id = q.submit(&c, &actor(), &p, 1001).unwrap().unit_id;
    transition(&q, &id, State::Precheck);
    transition(&q, &id, State::Blocked);
    let state = q.status(&actor(), &id).unwrap();
    let proof = signed(
        "recovery",
        RecoveryEvidence {
            unit_id: id.clone(),
            status_revision: state.revision,
            failure_cause_digest: "1".repeat(64),
            remediation_digest: "2".repeat(64),
            restored_preimage_digest: "3".repeat(64),
            service_readback_digest: "4".repeat(64),
            owned_operations_receipt: "5".repeat(64),
            step_dispositions: vec![StepDisposition::Absent("apply".into())],
            issued_at: 1001,
        },
    );
    let hash = deployment_control_plane::trust::digest(&proof).unwrap();
    q.retry(&c, &proof, 1001).unwrap();
    let raw = q.receipt(&actor(), &hash).unwrap();
    let retained: Signed<RecoveryEvidence> = serde_json::from_str(&raw).unwrap();
    assert_eq!(retained, proof);
}
