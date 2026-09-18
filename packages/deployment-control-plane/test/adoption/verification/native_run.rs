use super::*;
use std::cell::Cell;
fn fixture() -> (tempfile::TempDir, Dir, Queue) {
    let tmp = tempfile::tempdir().unwrap();
    let root = Dir::open(&std::fs::canonicalize(tmp.path()).unwrap(), unsafe {
        libc::geteuid()
    })
    .unwrap();
    let q = Queue::open(tmp.path().join("queue.db")).unwrap();
    (tmp, root, q)
}
fn quarantine(tmp: &std::path::Path) -> u64 {
    rusqlite::Connection::open(tmp.join("queue.db"))
        .unwrap()
        .query_row("SELECT value FROM meta WHERE key='quarantine'", [], |r| {
            r.get(0)
        })
        .unwrap()
}
#[test]
fn known_unknown_is_durable_before_unreadable_events_and_cannot_be_replaced() {
    let (tmp, root, q) = fixture();
    let raw = br#"{"runs":[{"job_id":"canary","outcome":"outcome_unknown"}],"next_cursor":null}"#;
    let called = Cell::new(false);
    let error = observe(&root, &q, &"a".repeat(64), "canary", raw, 1000, || {
        called.set(true);
        Err(Error::new("UNREADABLE_EVENTS"))
    })
    .unwrap_err();
    assert_eq!(error.code(), "UNKNOWN_CANARY");
    assert!(
        !called.get(),
        "unrelated event I/O must not precede known unknown retention"
    );
    assert!(unknown(&root).unwrap());
    assert_eq!(quarantine(tmp.path()), 1);
    let retained: Value = read(&root, "unknown.json").unwrap();
    assert_eq!(
        retained["raw_run_readback"],
        serde_json::to_value(raw.as_slice()).unwrap()
    );
    drop(q);
    drop(root);
    let root = Dir::open(&std::fs::canonicalize(tmp.path()).unwrap(), unsafe {
        libc::geteuid()
    })
    .unwrap();
    let q = Queue::open(tmp.path().join("queue.db")).unwrap();
    assert_eq!(quarantine(tmp.path()), 1);
    let success=br#"{"runs":[{"job_id":"canary","outcome":"succeeded","ended_at":"2000-01-01T00:00:00.000Z","occurrence_id":"one"}]}"#;
    assert_eq!(
        observe(
            &root,
            &q,
            &"a".repeat(64),
            "canary",
            success,
            2000,
            || panic!("retained unknown must stop before events")
        )
        .unwrap_err()
        .code(),
        "UNKNOWN_CANARY"
    );
    assert_eq!(read::<Value>(&root, "unknown.json").unwrap(), retained);
}
#[test]
fn malformed_or_wrong_job_observation_cannot_poison_capture_or_read_events() {
    for raw in [
        b"not-json".as_slice(),
        br#"{"runs":[{"job_id":"different","outcome":"outcome_unknown"}]}"#.as_slice(),
    ] {
        let (tmp, root, q) = fixture();
        let called = Cell::new(false);
        assert!(
            observe(&root, &q, &"a".repeat(64), "canary", raw, 1000, || {
                called.set(true);
                Ok(vec![])
            })
            .is_err()
        );
        assert!(!called.get());
        assert!(!unknown(&root).unwrap());
        assert_eq!(quarantine(tmp.path()), 0);
    }
}
#[test]
fn successful_exact_observation_uses_the_fixed_event_reader_once() {
    let (tmp, root, q) = fixture();
    let called = Cell::new(0);
    let raw=br#"{"runs":[{"job_id":"canary","outcome":"succeeded","ended_at":"2000-01-01T00:00:00.000Z","occurrence_id":"one"}],"next_cursor":null}"#;
    let (run, events) = observe(&root, &q, &"a".repeat(64), "canary", raw, 1000, || {
        called.set(called.get() + 1);
        Ok(b"{\"occurrenceId\":\"one\",\"action\":\"router_admission\"}\n".to_vec())
    })
    .unwrap();
    assert_eq!(called.get(), 1);
    assert!(!events.is_empty());
    assert_eq!(run["runs"][0]["endedAt"], 946684800000u64);
    assert_eq!(quarantine(tmp.path()), 0);
}
