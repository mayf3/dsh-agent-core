#[allow(dead_code)]
#[path = "common/mod.rs"]
mod common;
#[path = "transaction_fixture.rs"]
mod fixture;
use super::{
    journal::{Event, Journal},
    Executor,
};
use crate::{
    fs::{ArtifactEntry, ArtifactManifest, FixtureRoots},
    model::*,
    queue::Queue,
    trust::digest,
};
use common::*;
use std::{fs, process::Command};

fn pass(q: &Queue, c: &Catalog, id: &str, generation: &str) {
    let s = q.daemon_status(id).unwrap();
    let a = q.daemon_attachments(id).unwrap().remove(0);
    q.record_goal(
        c,
        &signed(
            "verifier",
            GoalReceipt {
                unit_id: id.into(),
                goal_id: a.proposal.goals[0].payload.goal_id.clone(),
                acceptance_revision: "accept-1".into(),
                target_generation: s.unit.expected_target_generation + 1,
                attempt: s.mutating_attempts,
                service_generation: generation.into(),
                attachment_digest: a.digest,
                outcome: GoalOutcome::Pass,
                evidence_digest: "e".repeat(64),
                revision: 1,
            },
        ),
    )
    .unwrap();
}
fn second(root: &std::path::Path, q: &Queue, c: &Catalog, id: &str) -> String {
    let m = ArtifactManifest {
        version: 1,
        entries: vec![ArtifactEntry {
            path: "main.js".into(),
            blob: "payload".into(),
            size: 8,
            sha256: crate::fs::file::sha(b"B's code"),
            executable: false,
        }],
    };
    let raw = serde_json::to_vec(&m).unwrap();
    let hash = crate::fs::file::sha(&raw);
    let stage = root.join("staging").join(&hash);
    fs::create_dir(&stage).unwrap();
    fs::write(stage.join("manifest.json"), raw).unwrap();
    fs::write(stage.join("payload"), b"B's code").unwrap();
    let mut p = q.daemon_evidence(id).unwrap();
    p.request_id = "request-b".into();
    p.goals[0].payload.goal_id = "goal-b".into();
    p.goals[0].payload.coverage.goal_id = "goal-b".into();
    p.goals[0].payload.artifact_sha256 = hash.clone();
    p.goals[0] = signed("producer", p.goals[0].payload.clone());
    p.build.payload.artifact_sha256 = hash.clone();
    p.build.payload.manifest_digest = digest(&m).unwrap();
    p.build.payload.goal_coverage = vec![p.goals[0].payload.coverage.clone()];
    p.build = signed("builder", p.build.payload);
    p.reviews[0].payload.artifact_sha256 = hash.clone();
    p.reviews[0].payload.manifest_digest = digest(&m).unwrap();
    p.reviews[0] = signed("reviewer", p.reviews[0].payload.clone());
    p.desired.payload.artifact_sha256 = hash;
    p.desired.payload.revision = 2;
    p.desired.payload.expected_target_generation = 1;
    p.desired = signed("authority", p.desired.payload);
    register(q, c, &p);
    q.submit(c, &actor(), &p, 1000).unwrap().unit_id
}
#[test]
fn lifecycle_worker() {
    let Ok(root) = std::env::var("DCP_TEST_ROOT") else {
        return;
    };
    let root = std::path::Path::new(&root);
    let roots = FixtureRoots::open(root).unwrap();
    let q = Queue::open(root.join("queue.db")).unwrap();
    let c = fixture_catalog();
    let guard = roots.lock().unwrap();
    let mut executor = Executor::fixture(&roots).unwrap();
    let mut id = std::env::var("DCP_TEST_UNIT").unwrap();
    let mode = std::env::var("DCP_TEST_MODE").unwrap();
    if mode == "apply-fault" {
        fs::write(root.join("active-unit"), &id).unwrap();
        std::env::set_var(
            "DCP_TEST_FAULT_RECORD",
            std::env::var("DCP_ARM_RECORD").unwrap(),
        );
        assert!(executor
            .apply(
                &guard,
                &q,
                &c,
                &id,
                &signed("authority", policy()),
                1000,
                "caller"
            )
            .is_err());
        return;
    }
    let applied = executor
        .apply(
            &guard,
            &q,
            &c,
            &id,
            &signed("authority", policy()),
            1000,
            "caller",
        )
        .unwrap();
    if mode == "restore" {
        pass(&q, &c, &id, &applied.receipt.new_service_generation);
        executor.finalize(&guard, &q, &id).unwrap();
        let current = q.daemon_current_installation("runtime").unwrap();
        fs::write(
            root.join("previous.json"),
            serde_json::to_vec(&current).unwrap(),
        )
        .unwrap();
        id = second(root, &q, &c, &id);
        executor
            .apply(
                &guard,
                &q,
                &c,
                &id,
                &signed("authority", policy()),
                1000,
                "caller",
            )
            .unwrap();
    } else if mode == "finalize" {
        pass(&q, &c, &id, &applied.receipt.new_service_generation);
    }
    fs::write(root.join("active-unit"), &id).unwrap();
    let first = executor.active.as_ref().unwrap().events.len() + 1;
    for (arm, live) in [
        ("DCP_ARM_EDGE", "DCP_TEST_CRASH_EDGE"),
        ("DCP_ARM_POINT", "DCP_TEST_POINT"),
        ("DCP_ARM_RECORD", "DCP_TEST_FAULT_RECORD"),
    ] {
        if let Ok(value) = std::env::var(arm) {
            std::env::set_var(live, value);
        }
    }
    let result = if mode == "finalize" {
        executor.finalize(&guard, &q, &id).map(|_| ())
    } else {
        executor.rollback(&guard, &q, &id)
    };
    if std::env::var("DCP_TEST_RECORD_FAULT").is_ok() {
        assert!(result.is_err());
        // A failed terminal journal sync must block late verification/delivery before restart too.
        assert!(q.next_ready(&c).unwrap().is_none());
        if mode == "finalize" {
            assert!(
                q.outbox(&actor()).unwrap().is_empty(),
                "failed final sync exposed closure"
            );
        }
    } else {
        result.unwrap();
        let name = executor
            .journals
            .names()
            .unwrap()
            .into_iter()
            .find(|n| n.starts_with(&id))
            .unwrap();
        let journal = Journal::load(&executor.journals, &name).unwrap();
        fs::write(
            root.join("edge-range"),
            format!("{first} {}", journal.events.len()),
        )
        .unwrap();
    }
}
fn worker(root: &std::path::Path, id: &str, mode: &str) -> Command {
    let mut cmd = Command::new(std::env::current_exe().unwrap());
    cmd.args([
        "--exact",
        "transaction::faults::lifecycle_worker",
        "--nocapture",
    ])
    .env("DCP_TEST_ROOT", fs::canonicalize(root).unwrap())
    .env("DCP_TEST_UNIT", id)
    .env("DCP_TEST_MODE", mode);
    cmd
}
fn check_recovery(
    tmp: &tempfile::TempDir,
    roots: &FixtureRoots,
    q: &Queue,
    c: &Catalog,
    mode: &str,
) {
    let id = fs::read_to_string(tmp.path().join("active-unit")).unwrap();
    let guard = roots.lock().unwrap();
    let mut recovered = Executor::fixture(roots).unwrap();
    let before = recovered.target.read("main.js").unwrap();
    let name = recovered
        .journals
        .names()
        .unwrap()
        .into_iter()
        .find(|n| n.starts_with(&id))
        .unwrap();
    let raw = fs::read(
        tmp.path()
            .join("transactions")
            .join(name)
            .join("000001.json"),
    )
    .unwrap();
    if let Ok(record) = serde_json::from_slice::<serde_json::Value>(&raw) {
        if let Event::Preflight { before: images, .. } =
            serde_json::from_value(record["event"].clone()).unwrap()
        {
            if let (Some(observed), Some(preimage)) = (&before, &images[0].1) {
                if observed.bytes == preimage.bytes {
                    assert!(
                        observed.content_matches(preimage),
                        "restored metadata differs from captured preimage"
                    );
                }
            }
        }
    }
    let binding = q.daemon_current_installation("runtime").unwrap();
    let result = recovered.recover(&guard, q);
    assert_eq!(
        recovered.target.read("main.js").unwrap(),
        before,
        "recovery replayed"
    );
    assert_eq!(
        q.daemon_current_installation("runtime").unwrap(),
        binding,
        "recovery rewrote binding"
    );
    let status = q.daemon_status(&id).unwrap();
    assert_eq!(status.preflight_attempts, 1);
    assert!(
        status.mutating_attempts == 1 || (mode == "apply-fault" && status.mutating_attempts == 0)
    );
    assert!(q.next_ready(c).unwrap().is_none());
    if mode == "restore" {
        assert!(binding.is_some());
        assert_eq!(
            q.outbox(&actor()).unwrap().len(),
            1,
            "unrelated finalized A closure was hidden"
        );
        let prior: Option<CurrentInstallation> =
            serde_json::from_slice(&fs::read(tmp.path().join("previous.json")).unwrap()).unwrap();
        assert_eq!(
            binding.as_ref().map(|b| &b.transaction_receipt_digest),
            prior.as_ref().map(|b| &b.transaction_receipt_digest)
        );
        if binding != prior {
            assert_eq!(before.unwrap().bytes, b"new code");
            let name = recovered
                .journals
                .names()
                .unwrap()
                .into_iter()
                .find(|n| n.starts_with(&id))
                .unwrap();
            let mut records: Vec<_> = fs::read_dir(tmp.path().join("transactions").join(name))
                .unwrap()
                .map(|e| e.unwrap().path())
                .collect();
            records.sort();
            let process = records
                .iter()
                .filter_map(|p| {
                    serde_json::from_slice::<serde_json::Value>(&fs::read(p).unwrap()).ok()
                })
                .filter_map(|v| v.pointer("/event/FixtureStarted/process").cloned())
                .last()
                .unwrap();
            let process: super::ProcessIdentity = serde_json::from_value(process).unwrap();
            assert_eq!(
                binding.as_ref().unwrap().service_generation,
                digest(&("fixture", vec![process])).unwrap()
            );
        }
    }
    // Any incomplete journal keeps closure delivery fenced after recovery.
    let incomplete = recovered
        .journals
        .names()
        .unwrap()
        .iter()
        .any(|n| Journal::load(&recovered.journals, n).map_or(true, |j| !j.terminal()));
    if incomplete {
        assert!(
            q.outbox(&actor()).unwrap().iter().all(|entry| entry.goal_id
                != q.daemon_attachments(&id).unwrap()[0].proposal.goals[0]
                    .payload
                    .goal_id),
            "unresolved lifecycle exposed closure"
        );
    }
    println!(
        "{mode}: recovered {:?}, {:?}, attempts {}/{}, physical binding retained, no replay",
        status.state,
        result.as_ref().err().map(|e| e.code()),
        status.preflight_attempts,
        status.mutating_attempts
    );
}
#[test]
fn every_rollback_finalize_and_projection_boundary_is_crash_fenced() {
    for mode in ["rollback", "finalize", "restore"] {
        let (tmp, _roots, _q, _c, id) = fixture::prepared();
        assert!(worker(tmp.path(), &id, mode).status().unwrap().success());
        let range: Vec<usize> = fs::read_to_string(tmp.path().join("edge-range"))
            .unwrap()
            .split_whitespace()
            .map(|s| s.parse().unwrap())
            .collect();
        let points = if mode == "finalize" {
            vec![
                "queue-Finalizing",
                "transaction-receipt",
                "queue-Applied",
                "closure-eligible",
            ]
        } else if mode == "restore" {
            vec![
                "queue-RollingBack",
                "restoration-projection",
                "queue-RolledBack",
            ]
        } else {
            vec!["queue-RollingBack", "queue-RolledBack"]
        };
        let mut cases: Vec<(&str, String)> = (range[0]..=range[1])
            .map(|n| ("DCP_ARM_EDGE", n.to_string()))
            .collect();
        cases.extend(points.into_iter().map(|p| ("DCP_ARM_POINT", p.into())));
        for (key, value) in cases {
            let (tmp, roots, q, c, id) = fixture::prepared();
            assert_eq!(
                worker(tmp.path(), &id, mode)
                    .env(key, &value)
                    .status()
                    .unwrap()
                    .code(),
                Some(75),
                "{mode} {key} {value}"
            );
            check_recovery(&tmp, &roots, &q, &c, mode);
            println!("actual crash {mode}: {key}={value}");
        }
    }
    std::thread::sleep(std::time::Duration::from_secs(3));
}
#[test]
fn failed_sync_and_partial_records_are_retained_and_never_replayed() {
    for mode in ["apply-fault", "rollback", "finalize", "restore"] {
        let range = if mode == "apply-fault" {
            vec![1, 13]
        } else {
            let (tmp, _roots, _q, _c, id) = fixture::prepared();
            assert!(worker(tmp.path(), &id, mode).status().unwrap().success());
            fs::read_to_string(tmp.path().join("edge-range"))
                .unwrap()
                .split_whitespace()
                .map(|s| s.parse().unwrap())
                .collect::<Vec<usize>>()
        };
        for edge in range[0]..=range[1] {
            for fault in ["fsync", "partial"] {
                let (tmp, roots, q, c, id) = fixture::prepared();
                assert!(
                    worker(tmp.path(), &id, mode)
                        .env("DCP_ARM_RECORD", format!("{edge:06}.json"))
                        .env("DCP_TEST_RECORD_FAULT", fault)
                        .status()
                        .unwrap()
                        .success(),
                    "{mode} {edge} {fault}"
                );
                let active = fs::read_to_string(tmp.path().join("active-unit")).unwrap();
                let journal = fs::read_dir(tmp.path().join("transactions"))
                    .unwrap()
                    .map(|e| e.unwrap().path())
                    .find(|p| {
                        p.file_name()
                            .unwrap()
                            .to_str()
                            .unwrap()
                            .starts_with(&active)
                    })
                    .unwrap();
                let raw = fs::read(journal.join(format!("{edge:06}.json"))).unwrap();
                assert_eq!(
                    serde_json::from_slice::<serde_json::Value>(&raw).is_err(),
                    fault == "partial"
                );
                check_recovery(&tmp, &roots, &q, &c, mode);
                assert_eq!(
                    fs::read(journal.join(format!("{edge:06}.json"))).unwrap(),
                    raw
                );
                println!("test-only {fault} injection: retained actual {mode} record {edge}");
            }
        }
    }
}
#[test]
fn owned_timeout_worker() {
    let Ok(root) = std::env::var("DCP_TEST_ROOT") else {
        return;
    };
    let roots = FixtureRoots::open(std::path::Path::new(&root)).unwrap();
    let q = Queue::open(std::path::Path::new(&root).join("queue.db")).unwrap();
    let guard = roots.lock().unwrap();
    let mut executor = Executor::fixture(&roots).unwrap();
    let id = std::env::var("DCP_TEST_UNIT").unwrap();
    let e = executor
        .apply(
            &guard,
            &q,
            &fixture_catalog(),
            &id,
            &signed("authority", policy()),
            1000,
            "caller",
        )
        .err()
        .unwrap();
    assert_eq!(e.code(), "OPERATION_TIMEOUT");
    assert_eq!(q.daemon_status(&id).unwrap().state, State::Quarantined);
    let j = executor.active.as_ref().unwrap();
    let process = j
        .events
        .iter()
        .find_map(|e| match e {
            Event::OperationSpawned { action, kernel, .. } if action == "fixture-timeout" => {
                kernel.clone()
            }
            _ => None,
        })
        .unwrap();
    assert!(
        super::process::identity(process.pid).is_err(),
        "owned timed-out child survived"
    );
    assert!(j.events.iter().any(|e| matches!(e, Event::OperationExit { action, success: false, .. } if action == "fixture-timeout")));
}
#[test]
fn owned_action_timeout_reaches_transaction_quarantine_and_no_replay() {
    let (tmp, roots, q, c, id) = fixture::prepared();
    assert!(Command::new(std::env::current_exe().unwrap())
        .args([
            "--exact",
            "transaction::faults::owned_timeout_worker",
            "--nocapture"
        ])
        .env("DCP_TEST_ROOT", fs::canonicalize(tmp.path()).unwrap())
        .env("DCP_TEST_UNIT", &id)
        .env("DCP_TEST_OWNED_TIMEOUT", "1")
        .status()
        .unwrap()
        .success());
    fs::write(tmp.path().join("active-unit"), id).unwrap();
    check_recovery(&tmp, &roots, &q, &c, "timeout");
}
