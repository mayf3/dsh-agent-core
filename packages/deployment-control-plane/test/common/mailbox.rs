use super::intake::{Configuration, Intake};
use crate::{fs::FixtureRoots, Error, Result};
use std::{cell::Cell, fs, os::unix::fs::PermissionsExt};
#[path = "mod.rs"]
#[allow(dead_code)]
mod common;
thread_local! { static SYNC:Cell<(usize,usize)>=const {Cell::new((0,0))}; }
// Test-only EIO at the directory-fsync call boundary; not a real power-loss claim.
#[allow(dead_code)]
pub(super) fn before_parent_sync() -> Result<()> {
    assert_ne!(unsafe { libc::geteuid() }, 0);
    SYNC.with(|state| {
        let (fail, count) = state.get();
        state.set((fail, count + 1));
        if fail == count + 1 {
            Err(Error::new("INJECTED_DIRECTORY_FSYNC"))
        } else {
            Ok(())
        }
    })
}
fn arm(call: usize) {
    SYNC.with(|s| s.set((call, 0)));
}
fn setup() -> (tempfile::TempDir, Intake) {
    let d = tempfile::tempdir().unwrap();
    fs::set_permissions(d.path(), fs::Permissions::from_mode(0o700)).unwrap();
    let roots = FixtureRoots::open(&fs::canonicalize(d.path()).unwrap()).unwrap();
    for area in ["admitted", "closure"] {
        fs::create_dir(d.path().join(area)).unwrap();
    }
    let intake = Intake {
        root: roots.root,
        config: Configuration {
            catalog: common::fixture_catalog(),
            callers: vec![],
            producers: vec!["producer".into()],
            verifiers: Default::default(),
            socket_gid: unsafe { libc::getegid() },
        },
    };
    super::mailbox::initialize(&intake.root).unwrap();
    (d, intake)
}
#[test]
fn existing_mailbox_record_must_retry_its_failed_directory_flush() {
    for area in ["admitted", "closure"] {
        let (d, intake) = setup();
        let id = "a".repeat(64);
        let body = serde_json::json!({"record":"matching"});
        arm(0);
        intake.publish(area, &id, &body).unwrap();
        let path = d.path().join(format!("{area}/{id}.json"));
        let bytes = fs::read(&path).unwrap();
        arm(1);
        assert_eq!(
            intake.publish(area, &id, &body).unwrap_err().code(),
            "INJECTED_DIRECTORY_FSYNC"
        );
        assert_eq!(fs::read(&path).unwrap(), bytes);
        intake.publish(area, &id, &body).unwrap();
        assert_eq!(SYNC.with(|s| s.get().1), 2);
    }
}
#[test]
fn visible_rename_with_failed_directory_flush_is_reflushed_on_retry() {
    for area in ["admitted", "closure"] {
        let (d, intake) = setup();
        let id = "b".repeat(64);
        let body = serde_json::json!({"record":"new"});
        arm(2);
        assert_eq!(
            intake.publish(area, &id, &body).unwrap_err().code(),
            "INJECTED_DIRECTORY_FSYNC"
        );
        let final_path = d.path().join(format!("{area}/{id}.json"));
        assert!(final_path.exists());
        let before = fs::read(&final_path).unwrap();
        intake.publish(area, &id, &body).unwrap();
        assert_eq!(fs::read(final_path).unwrap(), before);
        assert_eq!(SYNC.with(|s| s.get().1), 3);
    }
}
