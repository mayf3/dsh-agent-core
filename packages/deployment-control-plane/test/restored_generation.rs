use super::*;
use deployment_control_plane::fs::{ArtifactEntry, ArtifactManifest};
use deployment_control_plane::trust::digest;
use sha2::{Digest, Sha256};
fn goal_receipt(
    q: &deployment_control_plane::queue::Queue,
    id: &str,
    goal: &str,
    generation: &str,
    revision: u64,
) -> GoalReceipt {
    let attachment = q
        .daemon_attachments(id)
        .unwrap()
        .into_iter()
        .find(|a| a.proposal.goals.iter().any(|g| g.payload.goal_id == goal))
        .unwrap();
    GoalReceipt {
        unit_id: id.into(),
        goal_id: goal.into(),
        acceptance_revision: "accept-1".into(),
        target_generation: 1,
        attempt: 1,
        service_generation: generation.into(),
        attachment_digest: attachment.digest,
        outcome: GoalOutcome::Pass,
        evidence_digest: "e".repeat(64),
        revision,
    }
}
#[test]
fn restored_a_uses_fresh_process_for_late_verification_without_reclosing_original_goal() {
    let (tmp, roots, q, c, a) = prepared();
    let guard = roots.lock().unwrap();
    let mut executor = Executor::fixture(&roots).unwrap();
    let applied = executor
        .apply(
            &guard,
            &q,
            &c,
            &a,
            &signed("authority", policy()),
            1000,
            "caller",
        )
        .unwrap();
    q.record_goal(
        &c,
        &signed(
            "verifier",
            goal_receipt(&q, &a, "goal", &applied.receipt.new_service_generation, 1),
        ),
    )
    .unwrap();
    let original_receipt = executor.finalize(&guard, &q, &a).unwrap();
    let closure = q.outbox(&actor()).unwrap().remove(0);
    q.acknowledge_closure(
        &c,
        &signed(
            "producer",
            ClosureAcknowledgement {
                outbox_id: closure.id,
                goal_id: closure.goal_id,
                receipt_digest: closure.receipt_digest,
                previous_revision: 1,
                closed_revision: 2,
            },
        ),
    )
    .unwrap();
    let manifest = ArtifactManifest {
        version: 1,
        entries: vec![ArtifactEntry {
            path: "main.js".into(),
            blob: "payload".into(),
            size: 8,
            sha256: hex::encode(Sha256::digest(b"B's code")),
            executable: false,
        }],
    };
    let raw = serde_json::to_vec(&manifest).unwrap();
    let hash = hex::encode(Sha256::digest(&raw));
    let stage = tmp.path().join("staging").join(&hash);
    fs::create_dir(&stage).unwrap();
    fs::write(stage.join("manifest.json"), raw).unwrap();
    fs::write(stage.join("payload"), b"B's code").unwrap();
    let mut b = q.daemon_evidence(&a).unwrap();
    b.request_id = "request-b".into();
    b.goals[0].payload.goal_id = "goal-b".into();
    b.goals[0].payload.coverage.goal_id = "goal-b".into();
    b.goals[0].payload.artifact_sha256 = hash.clone();
    b.goals[0] = signed("producer", b.goals[0].payload.clone());
    b.build.payload.artifact_sha256 = hash.clone();
    b.build.payload.manifest_digest = digest(&manifest).unwrap();
    b.build.payload.goal_coverage = vec![b.goals[0].payload.coverage.clone()];
    b.build = signed("builder", b.build.payload);
    b.reviews[0].payload.artifact_sha256 = hash.clone();
    b.reviews[0].payload.manifest_digest = digest(&manifest).unwrap();
    b.reviews[0] = signed("reviewer", b.reviews[0].payload.clone());
    b.desired.payload.artifact_sha256 = hash;
    b.desired.payload.revision = 2;
    b.desired.payload.expected_target_generation = 1;
    b.desired = signed("authority", b.desired.payload);
    register(&q, &c, &b);
    let b = q.submit(&c, &actor(), &b, 1000).unwrap().unit_id;
    executor
        .apply(
            &guard,
            &q,
            &c,
            &b,
            &signed("authority", policy()),
            1000,
            "caller",
        )
        .unwrap();
    executor.rollback(&guard, &q, &b).unwrap();
    assert_eq!(
        fs::read(tmp.path().join("target/main.js")).unwrap(),
        b"new code"
    );
    let current = executor
        .verify_installed(&guard, &q, &c, &a, &signed("authority", policy()), 1000)
        .unwrap();
    assert_ne!(
        current.service_generation,
        applied.receipt.new_service_generation
    );
    assert_eq!(current.transaction_receipt_digest, original_receipt);
    let mut dependent_catalog = c.clone();
    let mut profile = c.profiles["fixture"].clone();
    profile.target_runtime = "dependent-runtime".into();
    profile.install_root_id = "dependent-root".into();
    profile.launchd_label = "dependent.service".into();
    dependent_catalog
        .profiles
        .insert("dependent".into(), profile);
    for key in dependent_catalog.keys.values_mut() {
        key.scopes.push("dependent".into());
    }
    let mut dependent = q.daemon_evidence(&a).unwrap();
    dependent.request_id = "dependent-request".into();
    dependent.deployment_profile = "dependent".into();
    dependent.goals[0].payload.goal_id = "dependent-goal".into();
    dependent.goals[0].payload.coverage.goal_id = "dependent-goal".into();
    dependent.dependencies = vec![Dependency {
        unit_id: a.clone(),
        receipt_digest: original_receipt.clone(),
        capability: "installed-release".into(),
        required_goals: vec!["goal".into()],
        semantics: DependencySemantics::LiveInstallation,
    }];
    dependent.goals[0].payload.dependencies = dependent.dependencies.clone();
    dependent.goals[0] = signed("producer", dependent.goals[0].payload.clone());
    dependent.build.payload.goal_coverage = vec![dependent.goals[0].payload.coverage.clone()];
    dependent.build = signed("builder", dependent.build.payload);
    dependent.desired.payload.target_runtime = "dependent-runtime".into();
    dependent.desired = signed("authority", dependent.desired.payload);
    register(&q, &dependent_catalog, &dependent);
    let mut dependent_actor = actor();
    dependent_actor.allowed_profiles.push("dependent".into());
    let dependent_id = q
        .submit(&dependent_catalog, &dependent_actor, &dependent, 1000)
        .unwrap()
        .unit_id;
    assert_eq!(
        q.revalidate(
            &dependent_catalog,
            &dependent_id,
            &signed("authority", policy()),
            1000
        )
        .unwrap_err()
        .code(),
        "DEPENDENCY_NOT_SATISFIED"
    );
    let mut stale = goal_receipt(&q, &a, "goal", &applied.receipt.new_service_generation, 2);
    assert!(q
        .record_goal(&c, &signed("verifier", stale.clone()))
        .is_err());
    stale.service_generation = current.service_generation.clone();
    q.record_goal(&c, &signed("verifier", stale)).unwrap();
    assert!(
        q.outbox(&actor()).unwrap().is_empty(),
        "already closed goal must not be closed twice"
    );
    q.revalidate(
        &dependent_catalog,
        &dependent_id,
        &signed("authority", policy()),
        1000,
    )
    .unwrap();
    let mut late = q.daemon_evidence(&a).unwrap();
    late.request_id = "late-a".into();
    late.goals[0].payload.goal_id = "late-goal".into();
    late.goals[0].payload.coverage.goal_id = "late-goal".into();
    late.goals[0] = signed("producer", late.goals[0].payload.clone());
    late.build.payload.goal_coverage = vec![late.goals[0].payload.coverage.clone()];
    late.build = signed("builder", late.build.payload);
    register(&q, &c, &late);
    let attached = q.submit(&c, &actor(), &late, 1000).unwrap();
    assert_eq!(attached.unit_id, a);
    assert!(!attached.install_required);
    q.record_goal(
        &c,
        &signed(
            "verifier",
            goal_receipt(&q, &a, "late-goal", &current.service_generation, 1),
        ),
    )
    .unwrap();
    assert_eq!(q.outbox(&actor()).unwrap().len(), 1);

    assert!(q
        .receipt(&actor(), &original_receipt)
        .unwrap()
        .contains(&applied.receipt.new_service_generation));
    assert_eq!(q.daemon_status(&a).unwrap().mutating_attempts, 1);
}
