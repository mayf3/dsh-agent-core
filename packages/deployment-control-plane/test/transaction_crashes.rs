use super::test_fixture as fixture;
use crate::common;
use crate::{fs::FixtureRoots, model::State, queue::Queue, transaction::Executor};
use common::*;
use std::{fs, process::Command};

#[test]
fn crash_worker() {
    let Ok(root) = std::env::var("DCP_TEST_ROOT") else {
        return;
    };
    let roots = FixtureRoots::open(std::path::Path::new(&root)).unwrap();
    let q = Queue::open(std::path::Path::new(&root).join("queue.db")).unwrap();
    let id = std::env::var("DCP_TEST_UNIT").unwrap();
    let guard = roots.lock().unwrap();
    let mut executor = Executor::fixture(&roots).unwrap();
    executor
        .apply(
            &guard,
            &q,
            &fixture_catalog(),
            &id,
            &signed("authority", policy()),
            1000,
            "caller",
        )
        .unwrap();
}
#[test]
fn real_process_exit_at_every_apply_journal_edge_never_replays() {
    // Determine the actual successful path's edge count from its durable journal.
    let (_baseline, roots, q, c, id) = fixture::prepared();
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
    let edges = executor.active.as_ref().unwrap().events.len();
    drop(executor);
    drop(guard);
    for edge in 1..=edges {
        let (tmp, roots, q, _c, id) = fixture::prepared();
        let path = fs::canonicalize(tmp.path()).unwrap();
        let status = Command::new(std::env::current_exe().unwrap())
            .args([
                "--exact",
                "transaction::crashes::crash_worker",
                "--nocapture",
            ])
            .env("DCP_TEST_ROOT", &path)
            .env("DCP_TEST_UNIT", &id)
            .env("DCP_TEST_CRASH_EDGE", edge.to_string())
            .status()
            .unwrap();
        assert_eq!(status.code(), Some(75), "edge {edge}");
        let guard = roots.lock().unwrap();
        let bytes = fs::read(path.join("target/main.js")).unwrap();
        assert!(bytes == b"old code" || bytes == b"new code");
        let mut recovered = Executor::fixture(&roots).unwrap();
        recovered.recover(&guard, &q).unwrap();
        let state = q.daemon_status(&id).unwrap().state;
        assert!(
            matches!(
                state,
                State::Quarantined | State::Recovering | State::Blocked | State::RolledBack
            ),
            "edge {edge}: {state:?}"
        );
        assert_eq!(
            fs::read(path.join("target/main.js")).unwrap(),
            bytes,
            "edge {edge} replayed"
        );
        println!("durable edge {edge}/{edges}: process exit 75, OS lock reacquired, {state:?}, no replay");
    }
    // Crash-test fixture services have a two-second natural lifetime, never production labels.
    std::thread::sleep(std::time::Duration::from_secs(3));
}

#[test]
fn fully_observed_prewrite_crash_settles_without_replay() {
    let (tmp, roots, q, c, id) = fixture::prepared();
    let path = fs::canonicalize(tmp.path()).unwrap();
    let status = Command::new(std::env::current_exe().unwrap())
        .args(["--exact", "transaction::crashes::crash_worker"])
        .env("DCP_TEST_ROOT", &path)
        .env("DCP_TEST_UNIT", &id)
        .env("DCP_TEST_CRASH_EDGE", "1")
        .status()
        .unwrap();
    assert_eq!(status.code(), Some(75));
    let guard = roots.lock().unwrap();
    let mut recovered = Executor::fixture(&roots).unwrap();
    recovered.recover(&guard, &q).unwrap();
    assert_eq!(q.daemon_status(&id).unwrap().state, State::Blocked);
    assert_eq!(fs::read(path.join("target/main.js")).unwrap(), b"old code");
    assert!(
        q.next_ready(&c).unwrap().is_none(),
        "STOP remains until signed remediation"
    );
}

#[test]
fn actual_directory_write_denial_at_each_edge_blocks_unreceipted_mutation() {
    use std::os::unix::fs::PermissionsExt;
    for edge in 1..=13 {
        let (tmp, roots, q, c, id) = fixture::prepared();
        let path = fs::canonicalize(tmp.path()).unwrap();
        let output = Command::new(std::env::current_exe().unwrap())
            .args(["--exact", "transaction::crashes::crash_worker"])
            .env("DCP_TEST_ROOT", &path)
            .env("DCP_TEST_UNIT", &id)
            .env("DCP_TEST_DENY_EDGE", edge.to_string())
            .output()
            .unwrap();
        assert!(!output.status.success(), "edge {edge}");
        let journals = path.join("transactions");
        for entry in fs::read_dir(&journals).unwrap() {
            fs::set_permissions(entry.unwrap().path(), fs::Permissions::from_mode(0o700)).unwrap();
        }
        let guard = roots.lock().unwrap();
        let before = fs::read(path.join("target/main.js")).unwrap();
        let mut recovered = Executor::fixture(&roots).unwrap();
        let _result = recovered.recover(&guard, &q);
        assert_eq!(
            fs::read(path.join("target/main.js")).unwrap(),
            before,
            "edge {edge} replayed"
        );
        assert!(
            q.next_ready(&c).unwrap().is_none(),
            "edge {edge} lost STOP/quarantine"
        );
        println!("durable edge {edge}/13: real directory EACCES, no recovery replay, lane blocked");
    }
}
