use super::*;
use std::{path::Path, process::Command};
#[test]
fn fault_worker() {
    let Ok(path) = std::env::var("DCP_TEST_LOGIN_FIXTURE") else {
        return;
    };
    crate::common::private::nonroot();
    let root = crate::fs::FixtureRoots::open(Path::new(&path)).unwrap();
    let mut effects = effects();
    assert!(execute(&root.root, &mut effects).is_err());
    let expected = if std::env::var("DCP_TEST_FAULT_RECORD").unwrap() == INTENT {
        0
    } else {
        1
    };
    assert_eq!(effects.count, expected);
    assert!(execute(&root.root, &mut effects).is_err());
    assert_eq!(effects.count, expected);
}
#[test]
fn intent_and_result_partial_or_fsync_failure_cannot_replay() {
    for record in [INTENT, RESULT] {
        for fault in ["partial", "fsync"] {
            let (t, d) = dir();
            append(&d, "login-intent.json", &json!({"old":"unknown"})).unwrap();
            let old = fs::read(t.path().join("login-intent.json")).unwrap();
            let status = Command::new(std::env::current_exe().unwrap())
                .args([
                    "--exact",
                    "bootstrap::login_reconciliation::tests::faults::fault_worker",
                    "--nocapture",
                ])
                .env("DCP_TEST_LOGIN_FIXTURE", t.path())
                .env("DCP_TEST_FAULT_RECORD", record)
                .env("DCP_TEST_RECORD_FAULT", fault)
                .status()
                .unwrap();
            assert!(status.success());
            assert_eq!(fs::read(t.path().join("login-intent.json")).unwrap(), old);
            let mut effects = effects();
            assert!(execute(&d, &mut effects).is_err());
            assert_eq!(effects.count, 0);
        }
    }
}
#[test]
fn crash_after_flushed_intent_consumes_allowance_without_login() {
    let (t, d) = dir();
    append(&d, "login-intent.json", &json!({"old":"unknown"})).unwrap();
    let status = Command::new(std::env::current_exe().unwrap())
        .args([
            "--exact",
            "bootstrap::login_reconciliation::tests::faults::fault_worker",
            "--nocapture",
        ])
        .env("DCP_TEST_LOGIN_FIXTURE", t.path())
        .env("DCP_TEST_POINT", "login-after-intent")
        .status()
        .unwrap();
    assert_eq!(status.code(), Some(75));
    assert!(t.path().join(INTENT).exists());
    assert!(!t.path().join(RESULT).exists());
    let mut effects = effects();
    assert!(execute(&d, &mut effects).is_err());
    assert_eq!(effects.count, 0);
}
