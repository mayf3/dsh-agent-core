use super::*;
use crate::fs::FixtureRoots;
use std::os::unix::fs::PermissionsExt;
fn metadata(path: &std::path::Path) -> Vec<u64> {
    use std::os::unix::fs::MetadataExt;
    let m = std::fs::symlink_metadata(path).unwrap();
    vec![
        m.dev(),
        m.ino(),
        m.mode() as u64,
        m.uid() as u64,
        m.gid() as u64,
        m.nlink(),
        m.len(),
        m.mtime() as u64,
        m.mtime_nsec() as u64,
        m.ctime() as u64,
        m.ctime_nsec() as u64,
    ]
}
fn setup() -> (tempfile::TempDir, FixtureRoots, std::path::PathBuf) {
    let t = crate::common::private::temp();
    let r = FixtureRoots::open(t.path()).unwrap();
    let p = t.path().join("queue.db");
    (t, r, p)
}
#[test]
fn missing_database_is_not_created() {
    let (_t, r, p) = setup();
    assert!(Queue::open_existing_readonly(&r.root, &p).is_err());
    assert!(!p.exists());
}
#[test]
fn existing_database_is_read_without_writes_or_schema_repair() {
    let (_t, r, p) = setup();
    drop(Queue::open(&p).unwrap());
    std::fs::set_permissions(&p, std::fs::Permissions::from_mode(0o600)).unwrap();
    let before = std::fs::read(&p).unwrap();
    let before_metadata = metadata(&p);
    let q = Queue::open_existing_readonly(&r.root, &p).unwrap();
    assert_eq!(q.unit_count().unwrap(), 0);
    assert!(q
        .transaction(|tx| {
            tx.execute("INSERT INTO meta VALUES ('forbidden',0)", [])?;
            Ok(())
        })
        .is_err());
    drop(q);
    assert_eq!(before, std::fs::read(&p).unwrap());
    assert_eq!(before_metadata, metadata(&p));
    assert_eq!(r.root.names().unwrap(), vec!["queue.db"]);
}
#[test]
fn incomplete_schema_is_not_migrated() {
    let (_t, r, p) = setup();
    let c = Connection::open(&p).unwrap();
    c.execute_batch("CREATE TABLE marker(value INTEGER);")
        .unwrap();
    drop(c);
    std::fs::set_permissions(&p, std::fs::Permissions::from_mode(0o600)).unwrap();
    let before = std::fs::read(&p).unwrap();
    let q = Queue::open_existing_readonly(&r.root, &p);
    if let Ok(q) = q {
        assert!(q.unit_count().is_err());
    }
    assert_eq!(before, std::fs::read(&p).unwrap());
}
#[test]
fn actual_uncheckpointed_wal_is_refused_and_preserved() {
    let (_t, r, p) = setup();
    let c = Connection::open(&p).unwrap();
    c.execute_batch("PRAGMA journal_mode=WAL; CREATE TABLE marker(value INTEGER); INSERT INTO marker VALUES (9);").unwrap();
    std::fs::set_permissions(&p, std::fs::Permissions::from_mode(0o600)).unwrap();
    let wal = p.with_file_name("queue.db-wal");
    let before = std::fs::read(&wal).unwrap();
    assert!(!before.is_empty());
    assert!(Queue::open_existing_readonly(&r.root, &p).is_err());
    assert_eq!(before, std::fs::read(&wal).unwrap());
}

#[test]
fn readonly_permanent_guard_never_creates_and_excludes_writer() {
    let (t, r, _) = setup();
    assert!(crate::fs::MutationGuard::acquire_readonly(&r.root).is_err());
    assert!(!t.path().join("production.lock").exists());
    drop(r.lock().unwrap());
    let before = std::fs::read(t.path().join("production.lock")).unwrap();
    let held = crate::fs::MutationGuard::acquire_readonly(&r.root).unwrap();
    assert_eq!(r.lock().err().unwrap().code(), "MUTEX_BUSY");
    held.binds(&r.root).unwrap();
    drop(held);
    drop(r.lock().unwrap());
    assert_eq!(
        before,
        std::fs::read(t.path().join("production.lock")).unwrap()
    );
}
#[test]
fn sidecar_appearing_after_open_refuses_subsequent_projection() {
    let (t, r, p) = setup();
    drop(Queue::open(&p).unwrap());
    std::fs::set_permissions(&p, std::fs::Permissions::from_mode(0o600)).unwrap();
    let q = Queue::open_existing_readonly(&r.root, &p).unwrap();
    std::fs::write(t.path().join("queue.db-journal"), b"incomplete").unwrap();
    assert_eq!(
        q.unit_count().unwrap_err().code(),
        "COMPLETION_DATABASE_SIDECAR"
    );
    assert_eq!(
        std::fs::read(t.path().join("queue.db-journal")).unwrap(),
        b"incomplete"
    );
}
#[test]
fn real_deferred_snapshot_excludes_concurrent_commit() {
    let (_t, r, p) = setup();
    drop(Queue::open(&p).unwrap());
    std::fs::set_permissions(&p, std::fs::Permissions::from_mode(0o600)).unwrap();
    let q = Queue::open_existing_readonly(&r.root, &p).unwrap();
    q.transaction(|tx| {
        let before: u64 = tx.query_row("SELECT value FROM meta WHERE key='sequence'", [], |r| {
            r.get(0)
        })?;
        let mut writer = Connection::open(&p)?;
        writer.busy_timeout(std::time::Duration::ZERO)?;
        let write = writer.transaction_with_behavior(TransactionBehavior::Immediate)?;
        write.execute("UPDATE meta SET value=1 WHERE key='sequence'", [])?;
        assert!(write.commit().is_err());
        let after: u64 = tx.query_row("SELECT value FROM meta WHERE key='sequence'", [], |r| {
            r.get(0)
        })?;
        assert_eq!(before, after);
        Ok(())
    })
    .unwrap();
}
