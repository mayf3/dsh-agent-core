mod common;
use common::*;
use deployment_control_plane::{model::*, queue::Queue};
fn transition(q: &Queue, id: &str, state: State) {
    let s = q.status(&actor(), id).unwrap();
    if state == State::Applying {
        q.begin_apply(
            &fixture_catalog(),
            id,
            s.revision,
            &signed("authority", policy()),
            1001,
            &"8".repeat(64),
        )
        .unwrap();
    } else {
        q.transition(id, s.revision, state, &"8".repeat(64))
            .unwrap();
    }
}
fn installed(q: &Queue, c: &Catalog, id: &str, generation: u64) -> String {
    for s in [
        State::Precheck,
        State::Applying,
        State::Restarting,
        State::Verifying,
        State::Finalizing,
    ] {
        transition(q, id, s);
    }
    let status = q.status(&actor(), id).unwrap();
    let u = &status.unit;
    let p = proposal("irrelevant", "e", 1, "goal");
    let receipt = TransactionReceipt {
        unit_id: id.into(),
        artifact_sha256: u.artifact_sha256.clone(),
        source_sha: u.source_sha.clone(),
        profile_revision: u.profile_revision.clone(),
        policy_digest: deployment_control_plane::trust::digest(&p.policy).unwrap(),
        review_digests: u.required_reviews.clone(),
        caller: "caller".into(),
        dependency_receipts: vec![],
        preimage_digest: "1".repeat(64),
        postimage_digest: "2".repeat(64),
        old_service_generation: "old".into(),
        new_service_generation: "new".into(),
        target_generation: generation,
        attempt: status.mutating_attempts,
        attachment_digests: vec![
            q.submit(c, &actor(), &q.daemon_evidence(id).unwrap(), 1001)
                .unwrap()
                .attachment_digest,
        ],
        step_results: vec!["readback-pass".into()],
        rollback_digest: None,
        capability: "installed".into(),
    };
    let digest = q.record_transaction(&receipt).unwrap();
    let goal = signed(
        "verifier",
        GoalReceipt {
            attempt: 1,
            service_generation: "new".into(),
            attachment_digest: q
                .submit(c, &actor(), &q.daemon_evidence(id).unwrap(), 1001)
                .unwrap()
                .attachment_digest,
            unit_id: id.into(),
            goal_id: u.covered_goal_ids[0].clone(),
            acceptance_revision: "accept-1".into(),
            target_generation: generation,
            outcome: GoalOutcome::Pass,
            evidence_digest: "3".repeat(64),
            revision: 1,
        },
    );
    q.record_goal(c, &goal).unwrap();
    assert!(!q
        .outbox(&actor())
        .unwrap()
        .iter()
        .any(|entry| entry.goal_id == u.covered_goal_ids[0]));
    transition(q, id, State::Applied);
    digest
}
#[test]
fn concurrent_duplicates_survive_reopen_and_actor_idempotency_conflicts() {
    let (dir, q, c) = setup();
    let p = proposal("request", "e", 1, "goal");
    register(&q, &c, &p);
    let mut workers = vec![];
    for _ in 0..6 {
        let path = dir.path().join("queue.db");
        let c = c.clone();
        let p = p.clone();
        workers.push(std::thread::spawn(move || {
            Queue::open(path)
                .unwrap()
                .submit(&c, &actor(), &p, 1001)
                .unwrap()
        }));
    }
    let results: Vec<_> = workers.into_iter().map(|w| w.join().unwrap()).collect();
    assert!(results.iter().all(|x| x.unit_id == results[0].unit_id));
    assert_eq!(q.unit_count().unwrap(), 1);
    assert_eq!(q.install_intents_for_target("runtime").unwrap(), 1);
    let reopened = Queue::open(dir.path().join("queue.db")).unwrap();
    assert_eq!(reopened.submit(&c, &actor(), &p, 1001).unwrap(), results[0]);
    let mut changed = p;
    changed.supersedes = vec!["different".into()];
    assert_eq!(
        q.submit(&c, &actor(), &changed, 1001).unwrap_err().code(),
        "REQUEST_CONFLICT"
    );
}
#[test]
fn late_goal_attaches_immutable_coverage_without_install_and_outbox_is_scoped() {
    let (_dir, q, c) = setup();
    let p = proposal("first", "e", 1, "goal");
    register(&q, &c, &p);
    let first = q.submit(&c, &actor(), &p, 1001).unwrap();
    installed(&q, &c, &first.unit_id, 1);
    assert_eq!(q.outbox(&actor()).unwrap().len(), 1);
    let late = proposal("late", "e", 1, "late-goal");
    register(&q, &c, &late);
    let attached = q.submit(&c, &actor(), &late, 1001).unwrap();
    assert_eq!(attached.unit_id, first.unit_id);
    assert!(!attached.install_required);
    assert_ne!(attached.attachment_digest, first.attachment_digest);
    assert_eq!(
        q.status(&actor(), &first.unit_id)
            .unwrap()
            .unit
            .covered_goal_ids,
        vec!["goal"]
    );
    let stranger = Actor {
        id: "stranger".into(),
        allowed_producers: vec![],
        allowed_profiles: vec![],
    };
    assert!(q.outbox(&stranger).unwrap().is_empty());
    assert_eq!(
        q.status(&stranger, &first.unit_id).unwrap_err().code(),
        "ACTOR_SCOPE"
    );
}
#[test]
fn a_b_a_allocates_daemon_intents_from_trusted_desired_state() {
    let (_dir, q, c) = setup();
    for (i, artifact) in ["e", "f", "e"].iter().enumerate() {
        let mut p = proposal(
            &format!("req-{i}"),
            artifact,
            i as u64 + 1,
            &format!("goal-{i}"),
        );
        p.desired.payload.expected_target_generation = i as u64;
        p.desired = signed("authority", p.desired.payload);
        register(&q, &c, &p);
        let s = q.submit(&c, &actor(), &p, 1001).unwrap();
        assert!(s.install_required);
        installed(&q, &c, &s.unit_id, i as u64 + 1);
    }
    assert_eq!(q.install_intents_for_target("runtime").unwrap(), 3);
}
#[test]
fn producer_cas_snapshot_watermark_and_pagination_are_persistent() {
    let (_dir, q, c) = setup();
    assert!(
        !q.census(q.census_revision().unwrap(), None, 1)
            .unwrap()
            .exhaustive
    );
    let p = proposal("req", "e", 1, "goal");
    let snapshot = signed(
        "producer",
        ProducerSnapshot {
            producer_id: "producer".into(),
            revision: 1,
            previous_revision: 0,
            records: p.goals.clone(),
            watermark: 1,
        },
    );
    q.ingest_snapshot(&c, &snapshot).unwrap();
    assert_eq!(
        q.ingest_snapshot(&c, &snapshot).unwrap_err().code(),
        "PRODUCER_CAS"
    );
    let rev = q.census_revision().unwrap();
    let page = q.census(rev, None, 1).unwrap();
    assert!(page.exhaustive);
    assert_eq!(page.records.len(), 1);
    assert_eq!(
        q.register_ready(&c, &p.goals[0], 0).unwrap_err().code(),
        "PRODUCER_CAS"
    );
    let mut gap = snapshot.payload;
    gap.previous_revision = 1;
    gap.revision = 3;
    gap.watermark = 4;
    assert_eq!(
        q.ingest_snapshot(&c, &signed("producer", gap))
            .unwrap_err()
            .code(),
        "WATERMARK_GAP"
    );
}
#[test]
fn missing_dependencies_and_reverted_coverage_never_admit() {
    let (_dir, q, c) = setup();
    let mut p = proposal("req", "e", 1, "goal");
    register(&q, &c, &p);
    p.dependencies.push(Dependency {
        semantics: DependencySemantics::LiveInstallation,
        unit_id: "missing".into(),
        receipt_digest: "1".repeat(64),
        capability: "installed".into(),
        required_goals: vec![],
    });
    assert_eq!(
        q.submit(&c, &actor(), &p, 1001).unwrap_err().code(),
        "MISSING_DEPENDENCY"
    );
    p.dependencies.clear();
    p.build.payload.goal_coverage[0].release_face_sha256 = "9".repeat(64);
    p.build = signed("builder", p.build.payload);
    assert_eq!(
        q.submit(&c, &actor(), &p, 1001).unwrap_err().code(),
        "GOAL_COVERAGE"
    );
    assert_eq!(q.unit_count().unwrap(), 0);
}
#[test]
fn retries_are_bounded_and_unknown_cannot_be_reset_by_request_or_claim() {
    let (_dir, q, c) = setup();
    let p = proposal("req", "e", 1, "goal");
    register(&q, &c, &p);
    let unit = q.submit(&c, &actor(), &p, 1001).unwrap().unit_id;
    for attempt in 1..=3 {
        transition(&q, &unit, State::Precheck);
        transition(&q, &unit, State::Blocked);
        let status = q.status(&actor(), &unit).unwrap();
        assert_eq!(status.preflight_attempts, attempt);
        let proof = signed(
            "recovery",
            RecoveryEvidence {
                unit_id: unit.clone(),
                status_revision: status.revision,
                failure_cause_digest: "1".repeat(64),
                remediation_digest: "2".repeat(64),
                restored_preimage_digest: "3".repeat(64),
                service_readback_digest: "4".repeat(64),
                owned_operations_receipt: "5".repeat(64),
                step_dispositions: vec![StepDisposition::Absent("apply".into())],
                issued_at: 1001,
            },
        );
        if attempt < 3 {
            q.retry(&c, &proof, 1001).unwrap();
        } else {
            assert_eq!(
                q.retry(&c, &proof, 1001).unwrap_err().code(),
                "RETRY_BUDGET_EXHAUSTED"
            );
        }
    }
    let mut duplicate = p;
    duplicate.request_id = "try-again".into();
    q.submit(&c, &actor(), &duplicate, 1001).unwrap();
    assert_eq!(q.status(&actor(), &unit).unwrap().preflight_attempts, 3);
    assert!(q.next_ready(&c).unwrap().is_none());
}
#[path = "queue_preimage_negatives.rs"]
mod preimage_negatives;
#[path = "queue_receipts.rs"]
mod receipts;
#[path = "queue_repairs.rs"]
mod repairs;
#[path = "queue_scheduling.rs"]
mod scheduling;
