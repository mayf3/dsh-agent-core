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
