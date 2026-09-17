#[allow(dead_code)]
#[path = "common/mod.rs"]
mod common;
#[path = "transaction_fixture.rs"]
mod fixture;
use crate::{model::*, transaction::Executor, trust::digest};
use common::*;
use std::{fs, process::Command};

#[test]
fn internal_applied_is_not_public_success_or_dependency_until_finalized() {
    let (tmp, roots, q, mut c, id) = fixture::prepared();
    let status = Command::new(std::env::current_exe().unwrap())
        .args([
            "--exact",
            "transaction::faults::lifecycle_worker",
            "--nocapture",
        ])
        .env("DCP_TEST_ROOT", fs::canonicalize(tmp.path()).unwrap())
        .env("DCP_TEST_UNIT", &id)
        .env("DCP_TEST_MODE", "finalize")
        .env("DCP_ARM_POINT", "queue-Applied")
        .status()
        .unwrap();
    assert_eq!(status.code(), Some(75));
    assert_eq!(q.daemon_status(&id).unwrap().state, State::Applied);
    assert_eq!(q.status(&actor(), &id).unwrap().state, State::Finalizing);
    let original = q.daemon_evidence(&id).unwrap();
    assert_eq!(
        q.submit(&c, &actor(), &original, 1000).unwrap().state,
        State::Finalizing
    );
    assert!(q.outbox(&actor()).unwrap().is_empty());
    let receipt = q.daemon_installed_receipt("runtime").unwrap().unwrap();
    let mut p = original.clone();
    p.request_id = "dependent".into();
    p.deployment_profile = "dependent".into();
    p.goals[0].payload.goal_id = "dependent-goal".into();
    p.goals[0].payload.coverage.goal_id = "dependent-goal".into();
    p.dependencies = vec![Dependency {
        unit_id: id.clone(),
        receipt_digest: digest(&receipt).unwrap(),
        capability: "installed-release".into(),
        required_goals: vec!["goal".into()],
        semantics: DependencySemantics::LiveInstallation,
    }];
    p.goals[0].payload.dependencies = p.dependencies.clone();
    p.goals[0] = signed("producer", p.goals[0].payload.clone());
    p.build.payload.goal_coverage = vec![p.goals[0].payload.coverage.clone()];
    p.build = signed("builder", p.build.payload);
    p.desired.payload.target_runtime = "dependent-runtime".into();
    p.desired.payload.expected_target_generation = 0;
    p.desired = signed("authority", p.desired.payload);
    let mut profile = c.profiles["fixture"].clone();
    profile.target_runtime = "dependent-runtime".into();
    profile.install_root_id = "dependent-root".into();
    profile.launchd_label = "dependent.service".into();
    c.profiles.insert("dependent".into(), profile);
    for key in c.keys.values_mut() {
        key.scopes.push("dependent".into());
    }
    let mut caller = actor();
    caller.allowed_profiles.push("dependent".into());
    register(&q, &c, &p);
    assert_eq!(
        q.submit(&c, &caller, &p, 1000).unwrap_err().code(),
        "DEPENDENCY_NOT_CURRENT"
    );
    assert_eq!(
        q.revalidate(&c, &id, &signed("authority", policy()), 1000)
            .unwrap_err()
            .code(),
        "FINALIZATION_PENDING"
    );
    let goal_digest = q
        .receipt_digests(&actor(), &id)
        .unwrap()
        .into_iter()
        .find(|hash| {
            serde_json::from_str::<Signed<GoalReceipt>>(&q.receipt(&actor(), hash).unwrap()).is_ok()
        })
        .unwrap();
    assert_eq!(
        q.acknowledge_closure(
            &c,
            &signed(
                "producer",
                ClosureAcknowledgement {
                    outbox_id: digest(&(&id, "goal", &goal_digest)).unwrap(),
                    goal_id: "goal".into(),
                    receipt_digest: goal_digest,
                    previous_revision: 1,
                    closed_revision: 2,
                }
            )
        )
        .unwrap_err()
        .code(),
        "FINALIZATION_PENDING"
    );
    p.request_id = "independent".into();
    p.goals[0].payload.goal_id = "independent-goal".into();
    p.goals[0].payload.coverage.goal_id = "independent-goal".into();
    p.dependencies.clear();
    p.goals[0].payload.dependencies.clear();
    p.goals[0] = signed("producer", p.goals[0].payload.clone());
    p.build.payload.goal_coverage = vec![p.goals[0].payload.coverage.clone()];
    p.build = signed("builder", p.build.payload);
    register(&q, &c, &p);
    q.submit(&c, &caller, &p, 1000).unwrap();
    assert!(
        q.next_ready(&c).unwrap().is_none(),
        "pending commit gap released the lane"
    );
    let guard = roots.lock().unwrap();
    let mut executor = Executor::fixture(&roots).unwrap();
    executor.recover(&guard, &q).unwrap();
    assert_eq!(q.status(&actor(), &id).unwrap().state, State::Finalizing);
    assert!(q.outbox(&actor()).unwrap().is_empty());
    assert_eq!(q.daemon_status(&id).unwrap().mutating_attempts, 1);
}
