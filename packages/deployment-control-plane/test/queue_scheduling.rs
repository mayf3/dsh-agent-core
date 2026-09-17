use crate::{common::*, transition};
use deployment_control_plane::{model::*, queue::Queue};
fn second_target(c: &mut Catalog, p: &mut Proposal) {
    let mut profile = c.profiles["fixture"].clone();
    profile.target_runtime = "other-runtime".into();
    profile.install_root_id = "other-root".into();
    c.profiles.insert("other".into(), profile);
    for key in c.keys.values_mut() {
        key.scopes.push("other".into());
    }
    p.deployment_profile = "other".into();
    p.desired.payload.target_runtime = "other-runtime".into();
    p.desired = signed("authority", p.desired.payload.clone());
}
fn all_actor() -> Actor {
    let mut a = actor();
    a.allowed_profiles.push("other".into());
    a
}
#[test]
fn fifo_and_continue_independent_obey_persisted_failure_disposition() {
    for policy in [FailurePolicy::StopTrain, FailurePolicy::ContinueIndependent] {
        let (_dir, q, mut c) = setup();
        c.profiles.get_mut("fixture").unwrap().failure_policy = policy;
        let first = proposal("first", "e", 1, "goal");
        let mut second = proposal("second", "f", 1, "goal-2");
        second_target(&mut c, &mut second);
        register(&q, &c, &first);
        register(&q, &c, &second);
        let a = q.submit(&c, &actor(), &first, 1001).unwrap();
        let b = q.submit(&c, &all_actor(), &second, 1001).unwrap();
        assert_eq!(
            q.next_ready(&c).unwrap().unwrap().unit.deployment_unit_id,
            a.unit_id
        );
        // The phase API itself must not permit callers/executor bugs to skip FIFO.
        assert_eq!(
            q.transition(&b.unit_id, 0, State::Precheck, &"1".repeat(64))
                .unwrap_err()
                .code(),
            "NOT_QUEUE_HEAD"
        );
        transition(&q, &a.unit_id, State::Precheck);
        transition(&q, &a.unit_id, State::Blocked);
        let next = q.next_ready(&c).unwrap();
        assert_eq!(next.is_some(), policy == FailurePolicy::ContinueIndependent);
        if let Some(next) = next {
            assert_eq!(next.unit.deployment_unit_id, b.unit_id);
        }
    }
}
#[test]
fn interrupted_mutation_is_quarantined_across_reopen_and_cannot_claim_safe_retry() {
    let (dir, q, c) = setup();
    let p = proposal("req", "e", 1, "goal");
    register(&q, &c, &p);
    let id = q.submit(&c, &actor(), &p, 1001).unwrap().unit_id;
    transition(&q, &id, State::Precheck);
    transition(&q, &id, State::Applying);
    drop(q);
    let q = Queue::open(dir.path().join("queue.db")).unwrap();
    assert_eq!(q.mark_interrupted().unwrap(), vec![id.clone()]);
    assert_eq!(q.status(&actor(), &id).unwrap().state, State::Recovering);
    assert!(q.next_ready(&c).unwrap().is_none());
    let status = q.status(&actor(), &id).unwrap();
    let proof = signed(
        "recovery",
        RecoveryEvidence {
            unit_id: id.clone(),
            status_revision: status.revision,
            failure_cause_digest: "1".repeat(64),
            remediation_digest: "2".repeat(64),
            restored_preimage_digest: "3".repeat(64),
            service_readback_digest: "4".repeat(64),
            owned_operations_receipt: "5".repeat(64),
            step_dispositions: vec![StepDisposition::Absent("user-says-process-exited".into())],
            issued_at: 1001,
        },
    );
    assert_eq!(
        q.retry(&c, &proof, 1001).unwrap_err().code(),
        "UNKNOWN_OUTCOME"
    );
}
#[test]
fn supersession_inherits_fifo_and_rejects_cycles_without_partial_writes() {
    let (_dir, q, mut c) = setup();
    let first = proposal("first", "e", 1, "goal");
    register(&q, &c, &first);
    let a = q.submit(&c, &actor(), &first, 1001).unwrap();
    let mut independent = proposal("independent", "f", 1, "goal-2");
    second_target(&mut c, &mut independent);
    register(&q, &c, &independent);
    let b = q.submit(&c, &all_actor(), &independent, 1001).unwrap();
    let mut replacement = proposal("replacement", "f", 2, "goal");
    replacement.goals[0].payload.revision = 2;
    replacement.goals[0] = signed("producer", replacement.goals[0].payload.clone());
    q.register_ready(&c, &replacement.goals[0], 1).unwrap();
    replacement.supersedes.push(a.unit_id.clone());
    let a2 = q.submit(&c, &actor(), &replacement, 1001).unwrap();
    assert_eq!(
        q.status(&actor(), &a.unit_id).unwrap().state,
        State::Superseded
    );
    assert_eq!(
        q.next_ready(&c).unwrap().unwrap().unit.deployment_unit_id,
        a2.unit_id
    );
    assert!(
        q.status(&actor(), &a2.unit_id).unwrap().sequence
            < q.status(&all_actor(), &b.unit_id).unwrap().sequence
    );
    let mut cycle = proposal("cycle", "e", 3, "goal");
    cycle.goals[0].payload.revision = 3;
    cycle.goals[0] = signed("producer", cycle.goals[0].payload.clone());
    q.register_ready(&c, &cycle.goals[0], 2).unwrap();
    cycle.supersedes.push(a2.unit_id.clone());
    cycle.dependencies.push(Dependency {
        semantics: DependencySemantics::LiveInstallation,
        unit_id: a2.unit_id,
        receipt_digest: "1".repeat(64),
        capability: "installed".into(),
        required_goals: vec![],
    });
    assert_eq!(
        q.submit(&c, &actor(), &cycle, 1001).unwrap_err().code(),
        "DEPENDENCY_CYCLE"
    );
    assert_eq!(q.unit_count().unwrap(), 3);
    assert_eq!(q.install_intents_for_target("runtime").unwrap(), 2);
}
#[test]
fn dependency_requires_exact_capability_receipt_and_goal_pass() {
    let (_dir, q, mut c) = setup();
    let first = proposal("first", "e", 1, "goal");
    register(&q, &c, &first);
    let a = q.submit(&c, &actor(), &first, 1001).unwrap();
    let receipt = crate::installed(&q, &c, &a.unit_id, 1);
    let mut second = proposal("second", "f", 1, "goal-2");
    second_target(&mut c, &mut second);
    second.dependencies.push(Dependency {
        semantics: DependencySemantics::LiveInstallation,
        unit_id: a.unit_id.clone(),
        receipt_digest: receipt.clone(),
        capability: "installed".into(),
        required_goals: vec!["goal".into()],
    });
    register(&q, &c, &second);
    let b = q.submit(&c, &all_actor(), &second, 1001).unwrap();
    assert_eq!(
        q.next_ready(&c).unwrap().unwrap().unit.deployment_unit_id,
        b.unit_id
    );
    q.cancel_pending(&all_actor(), &b.unit_id, 0).unwrap();
    second.request_id = "bad-capability".into();
    second.desired.payload.revision = 2;
    second.desired.payload.artifact_sha256 = "a".repeat(64);
    second.desired = signed("authority", second.desired.payload.clone());
    second.build.payload.artifact_sha256 = "a".repeat(64);
    second.build = signed("builder", second.build.payload.clone());
    second.reviews[0].payload.artifact_sha256 = "a".repeat(64);
    second.reviews[0] = signed("reviewer", second.reviews[0].payload.clone());
    second.goals[0].payload.artifact_sha256 = "a".repeat(64);
    second.goals[0].payload.revision = 2;
    second.goals[0] = signed("producer", second.goals[0].payload.clone());
    q.register_ready(&c, &second.goals[0], 1).unwrap();
    second.dependencies[0]
        .required_goals
        .push("failed-goal".into());
    q.submit(&c, &all_actor(), &second, 1001).unwrap();
    assert!(q.next_ready(&c).unwrap().is_none());
}
