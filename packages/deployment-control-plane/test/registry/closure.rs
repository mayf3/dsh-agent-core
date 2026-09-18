use crate::{common::*, fixture::*, transaction_fixture};
use deployment_control_plane::{model::*, registry::*, transaction::Executor, trust::*};
#[test]
fn finalized_pass_closes_only_deployment_and_replays_after_restart() {
    let (temp, roots, q, c, id) = transaction_fixture::prepared();
    let r = open(temp.path(), &c);
    r.enroll(&enrollment("goal")).unwrap();
    r.activate(&actor(), &q.daemon_evidence(&id).unwrap(), 0, 1001)
        .unwrap();
    let guard = roots.lock().unwrap();
    let mut executor = Executor::fixture(&roots).unwrap();
    let applied = executor
        .apply(
            &guard,
            &q,
            &c,
            &id,
            &signed("authority", policy()),
            1001,
            "caller",
        )
        .unwrap();
    let receipt = signed(
        "verifier",
        GoalReceipt {
            unit_id: id.clone(),
            goal_id: "goal".into(),
            acceptance_revision: "accept-1".into(),
            target_generation: 1,
            attempt: 1,
            service_generation: applied.receipt.new_service_generation.clone(),
            attachment_digest: applied.receipt.attachment_digests[0].clone(),
            outcome: GoalOutcome::Pass,
            evidence_digest: "d".repeat(64),
            revision: 1,
        },
    );
    let hash = q.record_goal(&c, &receipt).unwrap();
    let entry = OutboxEntry {
        id: digest(&(&id, "goal", &hash)).unwrap(),
        goal_id: "goal".into(),
        producer_id: "producer".into(),
        expected_producer_revision: 1,
        receipt_digest: hash,
    };
    assert_eq!(
        r.close_from_queue(&q, &actor(), &entry, &receipt)
            .unwrap_err()
            .code(),
        "SAFE_FINALIZATION_REQUIRED"
    );
    assert_eq!(r.get("goal").unwrap().state, DeploymentState::Ready);
    executor.finalize(&guard, &q, &id).unwrap();
    assert_eq!(q.outbox(&actor()).unwrap(), vec![entry.clone()]);
    let ack = r.close_from_queue(&q, &actor(), &entry, &receipt).unwrap();
    verify_signed(&ack, &c, "producer").unwrap();
    assert_eq!(ack.payload.previous_revision, 1);
    assert_eq!(ack.payload.closed_revision, 2);
    q.acknowledge_closure(&c, &ack).unwrap();
    drop(r);
    let r = open(temp.path(), &c);
    assert_eq!(
        r.close_from_queue(&q, &actor(), &entry, &receipt).unwrap(),
        ack
    );
    let closed = r.get("goal").unwrap();
    assert_eq!(closed.state, DeploymentState::Closed);
    assert!(!closed.business_goal_complete);
    assert_eq!(
        closed.enrollment.payload.business_goal_id,
        "original-business-goal"
    );
    assert_eq!(r.snapshot().unwrap().payload.records.len(), 1);
    assert_eq!(q.status(&actor(), &id).unwrap().mutating_attempts, 1);
}
#[test]
fn forged_mismatched_and_waiting_receipts_never_close() {
    let (temp, q, c) = setup();
    let r = open(temp.path(), &c);
    r.enroll(&enrollment("goal")).unwrap();
    let p = proposal("request", "e", 1, "goal");
    r.activate(&actor(), &p, 0, 1001).unwrap();
    let good = GoalReceipt {
        unit_id: "f".repeat(64),
        goal_id: "goal".into(),
        acceptance_revision: "accept-1".into(),
        target_generation: 1,
        attempt: 1,
        service_generation: "new".into(),
        attachment_digest: "a".repeat(64),
        outcome: GoalOutcome::Pass,
        evidence_digest: "b".repeat(64),
        revision: 1,
    };
    let entry_for = |s: &Signed<GoalReceipt>| OutboxEntry {
        id: "e".repeat(64),
        goal_id: "goal".into(),
        producer_id: "producer".into(),
        expected_producer_revision: 1,
        receipt_digest: digest(s).unwrap(),
    };
    let wrong = signed("producer", good.clone());
    assert_eq!(
        r.close_from_queue(&q, &actor(), &entry_for(&wrong), &wrong)
            .unwrap_err()
            .code(),
        "ISSUER_ROLE"
    );
    for outcome in [
        GoalOutcome::WaitingExternalAcceptance,
        GoalOutcome::OutcomeUnknown,
        GoalOutcome::Fail,
    ] {
        let mut v = good.clone();
        v.outcome = outcome;
        let s = signed("verifier", v);
        assert_eq!(
            r.close_from_queue(&q, &actor(), &entry_for(&s), &s)
                .unwrap_err()
                .code(),
            "DEPLOYMENT_PASS_REQUIRED"
        );
    }
    let mut v = good.clone();
    v.goal_id = "other".into();
    let wrong = signed("verifier", v);
    assert_eq!(
        r.close_from_queue(&q, &actor(), &entry_for(&wrong), &wrong)
            .unwrap_err()
            .code(),
        "CLOSURE_BINDING"
    );
    let good = signed("verifier", good);
    let mut entry = entry_for(&good);
    entry.expected_producer_revision = 2;
    assert_eq!(
        r.close_from_queue(&q, &actor(), &entry, &good)
            .unwrap_err()
            .code(),
        "REGISTRY_CAS"
    );
    let mut forged = good.clone();
    forged.payload.evidence_digest = "c".repeat(64);
    assert_eq!(
        r.close_from_queue(&q, &actor(), &entry_for(&forged), &forged)
            .unwrap_err()
            .code(),
        "INVALID_SIGNATURE"
    );
    assert_eq!(
        r.close_from_queue(&q, &actor(), &entry_for(&good), &good)
            .unwrap_err()
            .code(),
        "SAFE_FINALIZATION_REQUIRED"
    );
    assert_eq!(r.get("goal").unwrap().state, DeploymentState::Ready);
}
#[test]
fn trusted_verifier_with_wrong_profile_assignment_cannot_close() {
    use ed25519_dalek::SigningKey;
    use sha2::{Digest, Sha256};
    let temp = private::temp();
    let mut c = fixture_catalog();
    c.keys.insert(
        "other-verifier".into(),
        TrustedKey {
            public_key: hex::encode(
                SigningKey::from_bytes(&Sha256::digest(b"other-verifier").into())
                    .verifying_key()
                    .as_bytes(),
            ),
            role: Role::Verifier,
            scopes: vec!["fixture".into()],
        },
    );
    let r = open(temp.path(), &c);
    r.enroll(&enrollment("goal")).unwrap();
    let p = proposal("request", "e", 1, "goal");
    r.activate(&actor(), &p, 0, 1001).unwrap();
    let q = deployment_control_plane::queue::Queue::open(temp.path().join("queue.db")).unwrap();
    let s = signed(
        "other-verifier",
        GoalReceipt {
            unit_id: "a".repeat(64),
            goal_id: "goal".into(),
            acceptance_revision: "accept-1".into(),
            target_generation: 1,
            attempt: 1,
            service_generation: "new".into(),
            attachment_digest: "b".repeat(64),
            outcome: GoalOutcome::Pass,
            evidence_digest: "c".repeat(64),
            revision: 1,
        },
    );
    let entry = OutboxEntry {
        id: "d".repeat(64),
        goal_id: "goal".into(),
        producer_id: "producer".into(),
        expected_producer_revision: 1,
        receipt_digest: digest(&s).unwrap(),
    };
    assert_eq!(
        r.close_from_queue(&q, &actor(), &entry, &s)
            .unwrap_err()
            .code(),
        "VERIFIER_SCOPE"
    );
    assert_eq!(r.get("goal").unwrap().state, DeploymentState::Ready);
}
