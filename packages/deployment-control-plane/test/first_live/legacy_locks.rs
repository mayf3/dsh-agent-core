use super::*;
use crate::fs::{file::write_new, FixtureRoots};
use std::{os::fd::AsRawFd, process::Command};
const BINDING: &str = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const RETIRED: &str = "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
const NAMES: [&str; 4] = [
    "agent-core-production-mutation.lock",
    "production-deploy.lock",
    "production-transaction.lock",
    "transaction.lock",
];
fn parents(root: &Dir) -> [Dir; 4] {
    std::array::from_fn(|i| root.mkdir(&format!("parent-{i}")).unwrap())
}
fn expected(parents: &[Dir; 4]) -> Expectations {
    Expectations {
        parents: std::array::from_fn(|i| Identity::of(&parents[i].file).unwrap()),
        permanent: PermanentExpectation::AbsentCreate,
    }
}

#[test]
fn exact_legacy_parent_can_be_opened_through_untrusted_ancestor_only_by_bound_inode() {
    use std::os::unix::fs::PermissionsExt;

    let t = crate::common::private::temp();
    let unsafe_ancestor = t.path().join("caller-owned");
    let expected_path = unsafe_ancestor.join("root-owned-parent");
    std::fs::create_dir(&unsafe_ancestor).unwrap();
    std::fs::create_dir(&expected_path).unwrap();
    std::fs::set_permissions(&unsafe_ancestor, std::fs::Permissions::from_mode(0o777)).unwrap();
    std::fs::set_permissions(&expected_path, std::fs::Permissions::from_mode(0o755)).unwrap();

    let expected_file = std::fs::File::open(&expected_path).unwrap();
    let identity = Identity::of(&expected_file).unwrap();
    assert!(Dir::open(&expected_path, identity.uid).is_err());

    let opened = open_bound_parent(&expected_path, &identity).unwrap();
    identity.check(&opened.file).unwrap();

    let original = unsafe_ancestor.join("original");
    std::fs::rename(&expected_path, &original).unwrap();
    identity.check(&opened.file).unwrap();
    std::fs::create_dir(&expected_path).unwrap();
    std::fs::set_permissions(&expected_path, std::fs::Permissions::from_mode(0o755)).unwrap();
    assert!(open_bound_parent(&expected_path, &identity).is_err());

    std::fs::remove_dir(&expected_path).unwrap();
    std::os::unix::fs::symlink(&original, &expected_path).unwrap();
    assert!(open_bound_parent(&expected_path, &identity).is_err());
}
fn success(area: &Dir) {
    super::super::files::publish(
        area,
        "legacy-retirement-result.json",
        &serde_json::json!({"binding":BINDING,"retirement_digest":RETIRED}),
    )
    .unwrap();
}
#[test]
fn real_legacy_mkdir_and_flock_are_excluded_until_owned_release() {
    let t = crate::common::private::temp();
    let roots = FixtureRoots::open(t.path()).unwrap();
    let guard = roots.lock().unwrap();
    let dirs = parents(&roots.root);
    let exp = expected(&dirs);
    let area = roots.root.mkdir("journal").unwrap();
    let locks = LegacyLocks::acquire_at("operation", BINDING, &area, dirs, &exp, &guard).unwrap();
    let dirs = parents(&roots.root);
    let permanent = dirs[0].open_file(NAMES[0], libc::O_RDWR, 0).unwrap();
    let inode = Identity::of(&permanent).unwrap();
    assert_ne!(
        unsafe { libc::flock(permanent.as_raw_fd(), libc::LOCK_EX | libc::LOCK_NB) },
        0
    );
    for i in [1, 2] {
        assert!(std::fs::create_dir(t.path().join(format!("parent-{i}/{}", NAMES[i]))).is_err());
    }
    locks.verify().unwrap();
    success(&area);
    locks.release_completed(RETIRED).unwrap();
    assert_eq!(Identity::of(&permanent).unwrap(), inode);
    assert_eq!(
        Identity::of(&dirs[0].open_file(NAMES[0], libc::O_RDONLY, 0).unwrap()).unwrap(),
        inode
    );
    assert_eq!(
        unsafe { libc::flock(permanent.as_raw_fd(), libc::LOCK_EX | libc::LOCK_NB) },
        0
    );
    for i in [1, 2] {
        assert!(!t.path().join(format!("parent-{i}/{}", NAMES[i])).exists());
    }
    assert!(area
        .names()
        .unwrap()
        .contains(&"legacy-release-result.json".into()));
}
#[test]
fn drop_and_missing_retirement_keep_owned_ephemeral_evidence() {
    for reject_release in [false, true] {
        let t = crate::common::private::temp();
        let roots = FixtureRoots::open(t.path()).unwrap();
        let guard = roots.lock().unwrap();
        let dirs = parents(&roots.root);
        let exp = expected(&dirs);
        let area = roots.root.mkdir("journal").unwrap();
        let locks =
            LegacyLocks::acquire_at("operation", BINDING, &area, dirs, &exp, &guard).unwrap();
        if reject_release {
            assert!(locks.release_completed(RETIRED).is_err());
        } else {
            drop(locks);
        }
        assert!(t
            .path()
            .join("parent-1/production-deploy.lock/holder")
            .exists());
        assert!(t
            .path()
            .join("parent-2/production-transaction.lock/dcp-handover.json")
            .exists());
        assert!(LegacyLocks::acquire_at(
            "operation",
            BINDING,
            &area,
            parents(&roots.root),
            &exp,
            &guard
        )
        .is_err());
    }
}
#[test]
fn foreign_second_directory_stops_after_first_claim_without_cleanup() {
    let t = crate::common::private::temp();
    let roots = FixtureRoots::open(t.path()).unwrap();
    let guard = roots.lock().unwrap();
    let dirs = parents(&roots.root);
    let exp = expected(&dirs);
    let area = roots.root.mkdir("journal").unwrap();
    let foreign = dirs[2].mkdir(NAMES[2]).unwrap();
    write_new(
        &foreign,
        "foreign",
        b"never delete",
        foreign.uid,
        foreign.file.metadata().unwrap().gid(),
        0o600,
    )
    .unwrap();
    assert!(LegacyLocks::acquire_at("operation", BINDING, &area, dirs, &exp, &guard).is_err());
    assert!(t
        .path()
        .join("parent-1/production-deploy.lock/holder")
        .exists());
    assert_eq!(
        std::fs::read(
            t.path()
                .join("parent-2/production-transaction.lock/foreign")
        )
        .unwrap(),
        b"never delete"
    );
    assert!(area
        .names()
        .unwrap()
        .contains(&"legacy-2-intent.json".into()));
}
#[test]
fn fourth_guard_or_parent_mismatch_refuses_before_creation() {
    for fourth in [false, true] {
        let t = crate::common::private::temp();
        let roots = FixtureRoots::open(t.path()).unwrap();
        let guard = roots.lock().unwrap();
        let dirs = parents(&roots.root);
        let mut exp = expected(&dirs);
        let area = roots.root.mkdir("journal").unwrap();
        if fourth {
            dirs[3].mkdir(NAMES[3]).unwrap();
        } else {
            exp.parents[0].inode += 1;
        }
        assert!(LegacyLocks::acquire_at("operation", BINDING, &area, dirs, &exp, &guard).is_err());
        assert!(area.names().unwrap().is_empty());
        assert!(!t
            .path()
            .join("parent-0/agent-core-production-mutation.lock")
            .exists());
    }
}
#[test]
fn changed_holder_or_extra_entry_prevents_any_release() {
    for extra in [false, true] {
        let t = crate::common::private::temp();
        let roots = FixtureRoots::open(t.path()).unwrap();
        let guard = roots.lock().unwrap();
        let dirs = parents(&roots.root);
        let exp = expected(&dirs);
        let area = roots.root.mkdir("journal").unwrap();
        let locks =
            LegacyLocks::acquire_at("operation", BINDING, &area, dirs, &exp, &guard).unwrap();
        let path = t.path().join("parent-2/production-transaction.lock");
        if extra {
            std::fs::write(path.join("foreign"), b"retained").unwrap();
        } else {
            std::fs::write(path.join("dcp-handover.json"), b"changed").unwrap();
        }
        success(&area);
        assert!(locks.release_completed(RETIRED).is_err());
        assert!(t
            .path()
            .join("parent-1/production-deploy.lock/holder")
            .exists());
        assert!(path.exists());
    }
}
#[test]
fn present_permanent_is_bound_and_never_repaired() {
    let t = crate::common::private::temp();
    let roots = FixtureRoots::open(t.path()).unwrap();
    let guard = roots.lock().unwrap();
    let dirs = parents(&roots.root);
    let mut exp = expected(&dirs);
    let area = roots.root.mkdir("journal").unwrap();
    let p = write_new(
        &dirs[0],
        NAMES[0],
        b"",
        dirs[0].uid,
        dirs[0].file.metadata().unwrap().gid(),
        0o600,
    )
    .unwrap();
    let identity = Identity::of(&p).unwrap();
    exp.permanent = PermanentExpectation::Present {
        identity: identity.clone(),
    };
    let locks = LegacyLocks::acquire_at("operation", BINDING, &area, dirs, &exp, &guard).unwrap();
    locks.verify().unwrap();
    success(&area);
    locks.release_completed(RETIRED).unwrap();
    assert_eq!(Identity::of(&p).unwrap(), identity);
}
#[test]
fn crash_worker() {
    let Ok(path) = std::env::var("DCP_LEGACY_FIXTURE") else {
        return;
    };
    let roots = FixtureRoots::open(std::path::Path::new(&path)).unwrap();
    let guard = roots.lock().unwrap();
    let dirs = parents(&roots.root);
    let exp = expected(&dirs);
    let area = roots.root.mkdir("journal").unwrap();
    let locks = LegacyLocks::acquire_at("operation", BINDING, &area, dirs, &exp, &guard).unwrap();
    if std::env::var("DCP_TEST_POINT")
        .unwrap()
        .starts_with("legacy-release-")
    {
        success(&area);
        locks.release_completed(RETIRED).unwrap();
    }
    panic!("fault point not reached");
}
#[test]
fn crashes_never_allow_reacquisition_or_erase_partial_evidence() {
    for point in [
        "legacy-0-intent",
        "legacy-0-created",
        "legacy-1-intent",
        "legacy-1-mkdir",
        "legacy-1-holder",
        "legacy-1-result",
        "legacy-2-mkdir",
        "legacy-2-holder",
    ] {
        let t = crate::common::private::temp();
        let out = Command::new(std::env::current_exe().unwrap())
            .args([
                "--exact",
                "first_live::legacy_locks::tests::crash_worker",
                "--nocapture",
            ])
            .env("DCP_LEGACY_FIXTURE", t.path())
            .env("DCP_TEST_POINT", point)
            .output()
            .unwrap();
        assert_eq!(
            out.status.code(),
            Some(75),
            "{point}: {}",
            String::from_utf8_lossy(&out.stderr)
        );
        let roots = FixtureRoots::open(t.path()).unwrap();
        let guard = roots.lock().unwrap();
        let dirs = parents(&roots.root);
        let exp = expected(&dirs);
        let area = roots.root.child("journal").unwrap();
        let before = area.names().unwrap();
        assert!(LegacyLocks::acquire_at("operation", BINDING, &area, dirs, &exp, &guard).is_err());
        assert_eq!(area.names().unwrap(), before);
    }
}
#[test]
fn production_entry_refuses_nonroot_before_real_path_access() {
    let t = crate::common::private::temp();
    let roots = FixtureRoots::open(t.path()).unwrap();
    let guard = roots.lock().unwrap();
    let dirs = parents(&roots.root);
    let exp = expected(&dirs);
    let area = roots.root.mkdir("journal").unwrap();
    let err = LegacyLocks::acquire(
        "operation",
        BINDING,
        &area,
        &exp,
        &guard,
        SocketNamespace {
            plan: crate::bootstrap::socket::SocketAncestorPlan {
                host: "a".repeat(64),
                device: 1,
                inode: 1,
                uid: 0,
                gid: 1,
                mode: 0o775,
                flags: 0,
                acl_none: true,
                memberships: Default::default(),
            },
            gid: 602,
            identities: Default::default(),
            fixture: None,
        },
    )
    .err()
    .unwrap();
    assert_eq!(err.code(), "ROOT_REQUIRED");
    assert!(area.names().unwrap().is_empty());
}
#[test]
fn occupied_or_replaced_permanent_is_never_modified() {
    for held in [false, true] {
        let t = crate::common::private::temp();
        let roots = FixtureRoots::open(t.path()).unwrap();
        let guard = roots.lock().unwrap();
        let dirs = parents(&roots.root);
        let mut exp = expected(&dirs);
        let area = roots.root.mkdir("journal").unwrap();
        let p = write_new(
            &dirs[0],
            NAMES[0],
            b"unchanged",
            dirs[0].uid,
            dirs[0].file.metadata().unwrap().gid(),
            0o600,
        )
        .unwrap();
        let mut identity = Identity::of(&p).unwrap();
        if held {
            assert_eq!(
                unsafe { libc::flock(p.as_raw_fd(), libc::LOCK_EX | libc::LOCK_NB) },
                0
            );
        } else {
            identity.inode += 1;
        }
        exp.permanent = PermanentExpectation::Present { identity };
        assert!(LegacyLocks::acquire_at("operation", BINDING, &area, dirs, &exp, &guard).is_err());
        assert_eq!(
            std::fs::read(
                t.path()
                    .join("parent-0/agent-core-production-mutation.lock")
            )
            .unwrap(),
            b"unchanged"
        );
        assert!(!t.path().join("parent-1/production-deploy.lock").exists());
    }
}
#[test]
fn replaced_directory_or_new_fourth_guard_refuses_release() {
    for fourth in [false, true] {
        let t = crate::common::private::temp();
        let roots = FixtureRoots::open(t.path()).unwrap();
        let guard = roots.lock().unwrap();
        let dirs = parents(&roots.root);
        let exp = expected(&dirs);
        let area = roots.root.mkdir("journal").unwrap();
        let locks =
            LegacyLocks::acquire_at("operation", BINDING, &area, dirs, &exp, &guard).unwrap();
        if fourth {
            std::fs::create_dir(t.path().join("parent-3/transaction.lock")).unwrap();
        } else {
            let path = t.path().join("parent-1/production-deploy.lock");
            std::fs::rename(&path, t.path().join("parent-1/retained-old")).unwrap();
            std::fs::create_dir(path).unwrap();
        }
        success(&area);
        assert!(locks.release_completed(RETIRED).is_err());
        assert!(t
            .path()
            .join("parent-2/production-transaction.lock/dcp-handover.json")
            .exists());
    }
}
#[test]
fn foreign_symlink_is_not_followed_or_deleted() {
    let t = crate::common::private::temp();
    let roots = FixtureRoots::open(t.path()).unwrap();
    let guard = roots.lock().unwrap();
    let dirs = parents(&roots.root);
    let exp = expected(&dirs);
    let area = roots.root.mkdir("journal").unwrap();
    std::os::unix::fs::symlink(
        "../parent-3",
        t.path().join("parent-1/production-deploy.lock"),
    )
    .unwrap();
    assert!(LegacyLocks::acquire_at("operation", BINDING, &area, dirs, &exp, &guard).is_err());
    assert!(
        std::fs::symlink_metadata(t.path().join("parent-1/production-deploy.lock"))
            .unwrap()
            .is_symlink()
    );
}

#[test]
fn release_crashes_preserve_intent_and_never_authorize_replay() {
    for point in [
        "legacy-release-intent",
        "legacy-release-2-holder",
        "legacy-release-2-directory",
        "legacy-release-1-holder",
        "legacy-release-1-directory",
    ] {
        let t = crate::common::private::temp();
        let out = Command::new(std::env::current_exe().unwrap())
            .args([
                "--exact",
                "first_live::legacy_locks::tests::crash_worker",
                "--nocapture",
            ])
            .env("DCP_LEGACY_FIXTURE", t.path())
            .env("DCP_TEST_POINT", point)
            .output()
            .unwrap();
        assert_eq!(
            out.status.code(),
            Some(75),
            "{point}: {}",
            String::from_utf8_lossy(&out.stderr)
        );
        let roots = FixtureRoots::open(t.path()).unwrap();
        let guard = roots.lock().unwrap();
        let dirs = parents(&roots.root);
        let exp = expected(&dirs);
        let area = roots.root.child("journal").unwrap();
        assert!(area
            .names()
            .unwrap()
            .contains(&"legacy-release-intent.json".into()));
        assert!(!area
            .names()
            .unwrap()
            .contains(&"legacy-release-result.json".into()));
        let permanent =
            Identity::of(&dirs[0].open_file(NAMES[0], libc::O_RDONLY, 0).unwrap()).unwrap();
        assert!(LegacyLocks::acquire_at("operation", BINDING, &area, dirs, &exp, &guard).is_err());
        assert_eq!(
            Identity::of(
                &parents(&roots.root)[0]
                    .open_file(NAMES[0], libc::O_RDONLY, 0)
                    .unwrap()
            )
            .unwrap(),
            permanent
        );
    }
}
#[test]
fn mismatched_retirement_cannot_release_owned_locks() {
    let t = crate::common::private::temp();
    let roots = FixtureRoots::open(t.path()).unwrap();
    let guard = roots.lock().unwrap();
    let dirs = parents(&roots.root);
    let exp = expected(&dirs);
    let area = roots.root.mkdir("journal").unwrap();
    let locks = LegacyLocks::acquire_at("operation", BINDING, &area, dirs, &exp, &guard).unwrap();
    success(&area);
    assert!(locks.release_completed(BINDING).is_err());
    assert!(t
        .path()
        .join("parent-1/production-deploy.lock/holder")
        .exists());
    assert!(!area
        .names()
        .unwrap()
        .contains(&"legacy-release-intent.json".into()));
}
#[test]
fn holder_cannot_match_fixed_old_parent_inheritance_pattern() {
    let t = crate::common::private::temp();
    let roots = FixtureRoots::open(t.path()).unwrap();
    let guard = roots.lock().unwrap();
    let dirs = parents(&roots.root);
    let exp = expected(&dirs);
    let area = roots.root.mkdir("journal").unwrap();
    let locks = LegacyLocks::acquire_at(
        "run-authorized-transaction.sh",
        BINDING,
        &area,
        dirs,
        &exp,
        &guard,
    )
    .unwrap();
    let output = Command::new("/usr/bin/grep")
        .args(["-q", "run-authorized-transaction.sh"])
        .arg(t.path().join("parent-1/production-deploy.lock/holder"))
        .status()
        .unwrap();
    assert_eq!(output.code(), Some(1));
    drop(locks);
}
