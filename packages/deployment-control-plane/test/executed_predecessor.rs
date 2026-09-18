use super::*;
use crate::{
    common::*,
    fs::{ArtifactEntry, ArtifactManifest},
    trust::digest,
};
use std::fs;
fn receipt(q: &Queue, id: &str, service: &str, outcome: GoalOutcome) -> Signed<GoalReceipt> {
    let s = q.daemon_status(id).unwrap();
    let g = q.daemon_coverage(id).unwrap().remove(0);
    signed(
        "verifier",
        GoalReceipt {
            unit_id: id.into(),
            goal_id: g.payload.goal_id.clone(),
            acceptance_revision: g.payload.coverage.acceptance_revision,
            target_generation: s.unit.expected_target_generation + 1,
            attempt: s.mutating_attempts,
            service_generation: service.into(),
            attachment_digest: q.daemon_goal_attachment(id, &g.payload.goal_id).unwrap(),
            outcome,
            evidence_digest: "e".repeat(64),
            revision: 1,
        },
    )
}
pub(super) fn successor(
    tmp: &std::path::Path,
    q: &Queue,
    c: &Catalog,
    a: &str,
    hash: &str,
) -> String {
    let m = ArtifactManifest {
        version: 1,
        entries: vec![ArtifactEntry {
            path: "broker.js".into(),
            blob: "payload".into(),
            sha256: crate::fs::file::sha(b"new broker"),
            size: 10,
            executable: false,
        }],
    };
    let raw = serde_json::to_vec(&m).unwrap();
    let artifact = crate::fs::file::sha(&raw);
    let stage = tmp.join("staging").join(&artifact);
    fs::create_dir(&stage).unwrap();
    fs::write(stage.join("manifest.json"), raw).unwrap();
    fs::write(stage.join("payload"), b"new broker").unwrap();
    let mut p = q.daemon_evidence(a).unwrap();
    p.request_id = "successor".into();
    p.dependencies = vec![Dependency {
        unit_id: a.into(),
        receipt_digest: hash.into(),
        capability: "installed-release".into(),
        required_goals: vec!["goal".into()],
        semantics: DependencySemantics::LiveInstallation,
    }];
    let g = &mut p.goals[0].payload;
    g.goal_id = "broker-goal".into();
    g.coverage.goal_id = g.goal_id.clone();
    g.artifact_sha256 = artifact.clone();
    g.dependencies = p.dependencies.clone();
    p.goals[0] = signed("producer", p.goals[0].payload.clone());
    p.build.payload.artifact_sha256 = artifact.clone();
    p.build.payload.manifest_digest = digest(&m).unwrap();
    p.build.payload.goal_coverage = vec![p.goals[0].payload.coverage.clone()];
    p.build = signed("builder", p.build.payload);
    p.reviews[0].payload.artifact_sha256 = artifact.clone();
    p.reviews[0].payload.manifest_digest = digest(&m).unwrap();
    p.reviews[0] = signed("reviewer", p.reviews[0].payload.clone());
    p.desired.payload.artifact_sha256 = artifact;
    p.desired.payload.revision = 2;
    p.desired.payload.expected_target_generation = 1;
    p.desired = signed("authority", p.desired.payload);
    register(q, c, &p);
    q.submit(c, &actor(), &p, 1000).unwrap().unit_id
}
#[test]
fn finalized_successor_with_waiting_acceptance_uses_its_executed_predecessor_without_reinstall() {
    let (tmp, roots, q, c, a) = test_fixture::prepared_paths(&["watchdog.js"]);
    fs::write(tmp.path().join("target/broker.js"), b"old broker").unwrap();
    let guard = roots.lock().unwrap();
    let mut executor = Executor::fixture(&roots).unwrap();
    let policy = signed("authority", policy());
    let applied = executor
        .apply(&guard, &q, &c, &a, &policy, 1000, "caller")
        .unwrap();
    q.record_goal(
        &c,
        &receipt(
            &q,
            &a,
            &applied.receipt.new_service_generation,
            GoalOutcome::Pass,
        ),
    )
    .unwrap();
    let hash = executor.finalize(&guard, &q, &a).unwrap();
    let b = successor(tmp.path(), &q, &c, &a, &hash);
    let applied = executor
        .apply(&guard, &q, &c, &b, &policy, 1000, "caller")
        .unwrap();
    q.record_goal(
        &c,
        &receipt(
            &q,
            &b,
            &applied.receipt.new_service_generation,
            GoalOutcome::WaitingExternalAcceptance,
        ),
    )
    .unwrap();
    executor.finalize(&guard, &q, &b).unwrap();
    assert_eq!(
        q.revalidate(&c, &b, &policy, 1000).unwrap_err().code(),
        "DEPENDENCY_NOT_CURRENT",
        "mutation revalidation must remain strict"
    );
    let before = fs::read(tmp.path().join("target/broker.js")).unwrap();
    let current = executor
        .verify_installed(&guard, &q, &c, &b, &policy, 1000)
        .unwrap();
    let mut passed = receipt(&q, &b, &current.service_generation, GoalOutcome::Pass);
    passed.payload.revision = 2;
    passed = signed("verifier", passed.payload);
    q.record_goal(&c, &passed).unwrap();
    assert_eq!(q.daemon_status(&b).unwrap().mutating_attempts, 1);
    assert_eq!(
        current.service_generation,
        applied.receipt.new_service_generation
    );
    assert_eq!(
        fs::read(tmp.path().join("target/broker.js")).unwrap(),
        before
    );
    assert_eq!(
        fs::read(tmp.path().join("target/watchdog.js")).unwrap(),
        b"new code"
    );
}
fn pair(
    finalize: bool,
) -> (
    tempfile::TempDir,
    FixtureRoots,
    Queue,
    Catalog,
    String,
    Executor,
    Signed<Policy>,
) {
    let (tmp, roots, q, c, a) = test_fixture::prepared_paths(&["watchdog.js"]);
    fs::write(tmp.path().join("target/broker.js"), b"old broker").unwrap();
    let guard = roots.lock().unwrap();
    let mut executor = Executor::fixture(&roots).unwrap();
    let policy = signed("authority", policy());
    let applied = executor
        .apply(&guard, &q, &c, &a, &policy, 1000, "caller")
        .unwrap();
    q.record_goal(
        &c,
        &receipt(
            &q,
            &a,
            &applied.receipt.new_service_generation,
            GoalOutcome::Pass,
        ),
    )
    .unwrap();
    let hash = executor.finalize(&guard, &q, &a).unwrap();
    let b = successor(tmp.path(), &q, &c, &a, &hash);
    let applied = executor
        .apply(&guard, &q, &c, &b, &policy, 1000, "caller")
        .unwrap();
    q.record_goal(
        &c,
        &receipt(
            &q,
            &b,
            &applied.receipt.new_service_generation,
            GoalOutcome::WaitingExternalAcceptance,
        ),
    )
    .unwrap();
    if finalize {
        executor.finalize(&guard, &q, &b).unwrap();
    }
    drop(guard);
    (tmp, roots, q, c, b, executor, policy)
}
fn rewrite_journal(tmp: &std::path::Path, executor: &Executor, q: &Queue, b: &str, kind: &str) {
    let s = q.daemon_status(b).unwrap();
    let r = q
        .daemon_installed_receipt(&s.unit.target_runtime)
        .unwrap()
        .unwrap();
    let j = Journal::for_receipt(&executor.journals, &r).unwrap();
    let mut events = j
        .events
        .into_iter()
        .map(|e| serde_json::to_value(e).unwrap())
        .collect::<Vec<_>>();
    match kind {
        "missing" => {
            events.remove(1);
        }
        "empty-pass" => {
            events[1]["ExecutedPredecessor"]["proof"]["goals"] = serde_json::json!([]);
        }
        "tampered-pass" => {
            events[1]["ExecutedPredecessor"]["proof"]["goals"][0]["signature"] =
                serde_json::json!("0".repeat(128));
        }
        "unfinalized" => {
            events.pop();
        }
        _ => panic!(),
    };
    let path = fs::read_dir(tmp.join("transactions"))
        .unwrap()
        .map(|e| e.unwrap().path())
        .find(|p| p.file_name().unwrap().to_str().unwrap().starts_with(b))
        .unwrap();
    // Test-only storage corruption: rebuild the local hash chain to test the
    // receipt's independently pinned predecessor digest, not just chain syntax.
    for entry in fs::read_dir(&path).unwrap() {
        fs::remove_file(entry.unwrap().path()).unwrap();
    }
    let mut previous = "0".repeat(64);
    for (index, event) in events.into_iter().enumerate() {
        let record = serde_json::json!({"sequence":index+1,"previous":previous,"event":event});
        previous = digest(&record).unwrap();
        fs::write(
            path.join(format!("{:06}.json", index + 1)),
            serde_json::to_vec(&record).unwrap(),
        )
        .unwrap();
    }
}
#[test]
fn late_acceptance_never_reconstructs_missing_or_tampered_predecessor_provenance() {
    for case in [
        "missing",
        "empty-pass",
        "tampered-pass",
        "unfinalized",
        "changed-facet",
        "unknown",
    ] {
        let (tmp, roots, q, c, b, mut executor, policy) = pair(true);
        let guard = roots.lock().unwrap();
        match case {
            "changed-facet" => {
                fs::write(tmp.path().join("target/watchdog.js"), b"changed watchdog").unwrap()
            }
            "unknown" => {
                q.latch_executor_failure(&"f".repeat(64)).unwrap();
            }
            _ => rewrite_journal(tmp.path(), &executor, &q, &b, case),
        }
        assert!(
            executor
                .verify_installed(&guard, &q, &c, &b, &policy, 1000)
                .is_err(),
            "{case}"
        );
        assert!(
            q.revalidate(&c, &b, &policy, 1000).is_err(),
            "{case}: mutation gate"
        );
        assert_eq!(
            fs::read(tmp.path().join("target/broker.js")).unwrap(),
            b"new broker"
        );
        assert_eq!(q.daemon_status(&b).unwrap().mutating_attempts, 1);
    }
}
#[test]
fn unfinalized_or_rolled_back_successor_has_no_read_only_predecessor_waiver() {
    for rollback in [false, true] {
        let (_tmp, roots, q, c, b, mut executor, policy) = pair(false);
        let guard = roots.lock().unwrap();
        if rollback {
            executor
                .rollback_for_failure(&guard, &q, &b, "fixture-known-failure")
                .unwrap();
        }
        assert_eq!(
            executor
                .verify_installed(&guard, &q, &c, &b, &policy, 1000)
                .unwrap_err()
                .code(),
            "NOT_APPLIED"
        );
        if rollback {
            assert!(q.revalidate(&c, &b, &policy, 1000).is_err());
        }
    }
}
