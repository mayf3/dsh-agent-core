#[allow(dead_code)]
#[path = "common/mod.rs"]
mod common;
#[path = "transaction_fixture.rs"]
mod fixture;
use super::{journal::Journal, Executor};
use crate::{model::*, trust::digest};
use common::*;
use std::{fs, process::Command};

#[test]
fn preflight_crash_retains_evidence_and_allows_same_intent_retry() {
    let (tmp, roots, q, c, id) = fixture::prepared();
    let original = q.daemon_status(&id).unwrap();
    let status = Command::new(std::env::current_exe().unwrap())
        .args([
            "--exact",
            "transaction::crashes::crash_worker",
            "--nocapture",
        ])
        .env("DCP_TEST_ROOT", fs::canonicalize(tmp.path()).unwrap())
        .env("DCP_TEST_UNIT", &id)
        .env("DCP_TEST_CRASH_EDGE", "1")
        .status()
        .unwrap();
    assert_eq!(status.code(), Some(75));
    let guard = roots.lock().unwrap();
    let mut executor = Executor::fixture(&roots).unwrap();
    executor.recover(&guard, &q).unwrap();
    let blocked = q.daemon_status(&id).unwrap();
    assert_eq!(blocked.state, State::Blocked);
    assert_eq!(
        (blocked.preflight_attempts, blocked.mutating_attempts),
        (1, 0)
    );
    let previous = executor.journals.names().unwrap().remove(0);
    let before = fs::read(
        tmp.path()
            .join("transactions")
            .join(&previous)
            .join("000001.json"),
    )
    .unwrap();
    let proof = signed(
        "recovery",
        RecoveryEvidence {
            unit_id: id.clone(),
            status_revision: blocked.revision,
            failure_cause_digest: digest(&"preflight-crash").unwrap(),
            remediation_digest: digest(&"fresh-no-effect-readback").unwrap(),
            restored_preimage_digest: digest(&fs::read(tmp.path().join("target/main.js")).unwrap())
                .unwrap(),
            service_readback_digest: digest(&executor.service.image().unwrap()).unwrap(),
            owned_operations_receipt: digest(&"no-operation-issued").unwrap(),
            step_dispositions: vec![StepDisposition::Restored("preflight".into())],
            issued_at: 1001,
        },
    );
    q.retry(&c, &proof, 1001).unwrap();
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
    let current = q.daemon_status(&id).unwrap();
    assert_eq!(
        current.unit.deployment_intent_id,
        original.unit.deployment_intent_id
    );
    assert_eq!(
        (current.preflight_attempts, current.mutating_attempts),
        (2, 1)
    );
    assert_eq!(applied.receipt.attempt, 1);
    assert_eq!(executor.journals.names().unwrap().len(), 2);
    assert_eq!(
        fs::read(
            tmp.path()
                .join("transactions")
                .join(previous)
                .join("000001.json")
        )
        .unwrap(),
        before
    );
    executor.rollback(&guard, &q, &id).unwrap();
}

#[test]
fn maximum_admitted_slots_roundtrip_success_and_rollback_journal() {
    let names: Vec<String> = (0..4096).map(|i| format!("slot-{i:04}")).collect();
    let paths: Vec<&str> = names.iter().map(String::as_str).collect();
    let (_tmp, roots, q, c, id) = fixture::prepared_paths(&paths);
    let guard = roots.lock().unwrap();
    let mut executor = Executor::fixture(&roots).unwrap();
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
    let name = executor.journals.names().unwrap().remove(0);
    let installed = Journal::load(&executor.journals, &name).unwrap();
    assert!(installed.events.len() > 8192);
    executor.rollback(&guard, &q, &id).unwrap();
    let restored = Journal::load(&executor.journals, &name).unwrap();
    assert!(restored.events.len() > 20000);
    assert!(restored.terminal());
    for path in paths {
        assert_eq!(
            executor.target.read(path).unwrap().unwrap().bytes,
            b"old code"
        );
    }
    assert_eq!(q.daemon_status(&id).unwrap().state, State::RolledBack);
    println!(
        "4096 admissible slots: {} apply records, {} rollback lifecycle records reloaded",
        installed.events.len(),
        restored.events.len()
    );
}

fn signed_retry(q: &crate::queue::Queue, c: &Catalog, id: &str, executor: &mut Executor) {
    let status = q.daemon_status(id).unwrap();
    let proof = signed(
        "recovery",
        RecoveryEvidence {
            unit_id: id.into(),
            status_revision: status.revision,
            failure_cause_digest: digest(&(id, status.preflight_attempts, "observed-failure"))
                .unwrap(),
            remediation_digest: digest(&(id, status.revision, "fresh-readback")).unwrap(),
            restored_preimage_digest: digest(&executor.target.read("main.js").unwrap()).unwrap(),
            service_readback_digest: digest(&executor.service.image().unwrap()).unwrap(),
            owned_operations_receipt: digest(&(status.revision, "all-operations-resolved"))
                .unwrap(),
            step_dispositions: vec![StepDisposition::Restored("executor".into())],
            issued_at: 1001,
        },
    );
    q.retry(c, &proof, 1001).unwrap();
}
fn third_preflight_after_retained_history(prior_mutation: bool) {
    let (tmp, roots, q, c, id) = fixture::prepared();
    let original = q.daemon_status(&id).unwrap().unit;
    let mut retained = std::collections::BTreeMap::new();
    if prior_mutation {
        let guard = roots.lock().unwrap();
        let mut executor = Executor::fixture(&roots).unwrap();
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
        executor.rollback(&guard, &q, &id).unwrap();
        signed_retry(&q, &c, &id, &mut executor);
    }
    for ordinal in (if prior_mutation { 2 } else { 1 })..=2 {
        let status = Command::new(std::env::current_exe().unwrap())
            .args([
                "--exact",
                "transaction::crashes::crash_worker",
                "--nocapture",
            ])
            .env("DCP_TEST_ROOT", fs::canonicalize(tmp.path()).unwrap())
            .env("DCP_TEST_UNIT", &id)
            .env("DCP_TEST_CRASH_EDGE", "1")
            .status()
            .unwrap();
        assert_eq!(status.code(), Some(75));
        let guard = roots.lock().unwrap();
        let mut executor = Executor::fixture(&roots).unwrap();
        executor.recover(&guard, &q).unwrap();
        let current = q.daemon_status(&id).unwrap();
        assert_eq!(
            current.state,
            if prior_mutation {
                State::RolledBack
            } else {
                State::Blocked
            }
        );
        assert_eq!(current.preflight_attempts, ordinal);
        assert_eq!(current.mutating_attempts, u32::from(prior_mutation));
        assert_eq!(current.unit, original);
        assert_eq!(
            executor.target.read("main.js").unwrap().unwrap().bytes,
            b"old code"
        );
        for name in executor.journals.names().unwrap() {
            let dir = tmp.path().join("transactions").join(&name);
            let mut files: Vec<_> = fs::read_dir(dir)
                .unwrap()
                .map(|e| e.unwrap().path())
                .collect();
            files.sort();
            let bytes: Vec<_> = files.iter().map(|p| fs::read(p).unwrap()).collect();
            if let Some(previous) = retained.insert(name, bytes.clone()) {
                assert_eq!(previous, bytes);
            }
        }
        assert_eq!(retained.len(), ordinal as usize);
        signed_retry(&q, &c, &id, &mut executor);
        println!(
            "retained-history recovery: preflight {ordinal}, mutations {}, fresh signed retry",
            current.mutating_attempts
        );
    }
    let guard = roots.lock().unwrap();
    let mut executor = Executor::fixture(&roots).unwrap();
    assert_eq!(
        executor.target.read("main.js").unwrap().unwrap().bytes,
        b"old code"
    );
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
    let current = q.daemon_status(&id).unwrap();
    assert_eq!(current.unit, original);
    assert_eq!(
        (current.preflight_attempts, current.mutating_attempts),
        (3, 1 + u32::from(prior_mutation))
    );
    assert_eq!(applied.receipt.attempt, current.mutating_attempts);
    assert_eq!(executor.journals.names().unwrap().len(), 3);
    for (name, previous) in retained {
        let mut files: Vec<_> = fs::read_dir(tmp.path().join("transactions").join(name))
            .unwrap()
            .map(|e| e.unwrap().path())
            .collect();
        files.sort();
        assert_eq!(
            files
                .iter()
                .map(|p| fs::read(p).unwrap())
                .collect::<Vec<_>>(),
            previous
        );
    }
    executor.rollback(&guard, &q, &id).unwrap();
}
#[test]
fn two_preflight_crashes_preserve_history_and_allow_third_legal_preflight() {
    third_preflight_after_retained_history(false);
}
#[test]
fn prior_rolled_back_mutation_cannot_quarantine_current_no_effect_preflight() {
    third_preflight_after_retained_history(true);
}
