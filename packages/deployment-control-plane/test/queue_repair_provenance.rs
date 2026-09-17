use super::*;
#[test]
fn b05_safe_correction_resumes_automatically_only_after_fresh_precheck() {
    let (_dir, q, mut c) = setup();
    let a = proposal("a", "e", 1, "goal");
    register(&q, &c, &a);
    let aid = q.submit(&c, &actor(), &a, 1001).unwrap().unit_id;
    let mut b = proposal("b", "f", 1, "goal-b");
    let ac = other(&mut c, &mut b);
    register(&q, &c, &b);
    let bid = q.submit(&c, &ac, &b, 1001).unwrap().unit_id;
    transition(&q, &aid, State::Precheck);
    transition(&q, &aid, State::Blocked);
    q.retry(&c, &recovery(&q, &aid), 1001).unwrap();
    let rev = q.daemon_status(&aid).unwrap().revision;
    assert_eq!(
        q.cancel_pending(&actor(), &aid, rev).unwrap_err().code(),
        "FAILED_INTENT_PAUSED"
    );
    transition(&q, &aid, State::Precheck);
    let rev = q.daemon_status(&aid).unwrap().revision;
    assert_eq!(
        q.transition(&aid, rev, State::Applying, &"8".repeat(64))
            .unwrap_err()
            .code(),
        "PRECHECK_GATE_REQUIRED"
    );
    let mut blocked = policy();
    blocked.epoch = 2;
    blocked.revoked_artifacts.push("e".repeat(64));
    let blocked = signed("authority", blocked);
    assert_eq!(
        q.begin_apply(&c, &aid, rev, &blocked, 1001, &"8".repeat(64))
            .unwrap_err()
            .code(),
        "REVOKED"
    );
    assert!(q.next_ready(&c).unwrap().is_none());
    assert_eq!(q.daemon_status(&aid).unwrap().mutating_attempts, 0);
    let mut fixed = policy();
    fixed.epoch = 3;
    let fixed = signed("authority", fixed);
    q.begin_apply(&c, &aid, rev, &fixed, 1001, &"8".repeat(64))
        .unwrap();
    for state in [State::Restarting, State::Verifying, State::Finalizing] {
        transition(&q, &aid, state);
    }
    let mut receipt = transaction(&q, &c, &aid);
    receipt.policy_digest = digest(&fixed).unwrap();
    q.record_transaction(&receipt).unwrap();
    q.record_goal(&c, &goal(&q, &c, &aid, 1, 1)).unwrap();
    transition(&q, &aid, State::Applied);
    assert_eq!(
        q.next_ready(&c).unwrap().unwrap().unit.deployment_unit_id,
        bid
    );
}
#[test]
fn b06_transaction_receipt_binds_the_full_effective_attachment_set() {
    let (_dir, q, c) = setup();
    let first = proposal("first", "e", 1, "goal");
    register(&q, &c, &first);
    let ack = q.submit(&c, &actor(), &first, 1001).unwrap();
    let late = proposal("late", "e", 1, "late");
    register(&q, &c, &late);
    let late_ack = q.submit(&c, &actor(), &late, 1001).unwrap();
    let id = &ack.unit_id;
    transition(&q, id, State::Precheck);
    transition(&q, id, State::Applying);
    let deferred = proposal("deferred", "e", 1, "deferred-goal");
    register(&q, &c, &deferred);
    assert_eq!(
        q.submit(&c, &actor(), &deferred, 1001).unwrap_err().code(),
        "ATTACHMENT_DEFERRED"
    );
    for state in [State::Restarting, State::Verifying, State::Finalizing] {
        transition(&q, id, state);
    }
    let mut receipt = transaction(&q, &c, id);
    assert_eq!(
        q.record_transaction(&receipt).unwrap_err().code(),
        "RECEIPT_BINDING"
    );
    let attachments = q.daemon_attachments(id).unwrap();
    receipt.attachment_digests = attachments.iter().map(|x| x.digest.clone()).collect();
    let mut reviews = std::collections::BTreeSet::new();
    for a in &attachments {
        for r in &a.proposal.reviews {
            reviews.insert(digest(r).unwrap());
        }
    }
    receipt.review_digests = reviews.into_iter().collect();
    q.record_transaction(&receipt).unwrap();
    q.record_goal(&c, &goal(&q, &c, id, 1, 1)).unwrap();
    let late_goal = signed(
        "verifier",
        GoalReceipt {
            unit_id: id.clone(),
            goal_id: "late".into(),
            acceptance_revision: "accept-1".into(),
            target_generation: 1,
            attempt: 1,
            service_generation: "new-1".into(),
            attachment_digest: late_ack.attachment_digest,
            outcome: GoalOutcome::Pass,
            evidence_digest: "8".repeat(64),
            revision: 1,
        },
    );
    q.record_goal(&c, &late_goal).unwrap();
    transition(&q, id, State::Applied);
    assert_eq!(q.outbox(&actor()).unwrap().len(), 2);
    assert_eq!(
        q.daemon_status(id).unwrap().unit.covered_goal_ids,
        vec!["goal"]
    );
    q.revalidate(&c, id, &first.policy, 1001).unwrap();
    let after = q.submit(&c, &actor(), &deferred, 1001).unwrap();
    assert!(!after.install_required);
    assert_eq!(q.daemon_attachments(id).unwrap().len(), 3);
}
