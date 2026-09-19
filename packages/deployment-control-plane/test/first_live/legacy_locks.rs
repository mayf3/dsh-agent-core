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
        ancestor_fence: AncestorFenceExpectation {
            identity: Identity::of(&parents[1].file).unwrap(),
            flags: 0,
            acl_none: true,
        },
        parents: std::array::from_fn(|i| Identity::of(&parents[i].file).unwrap()),
        permanent: PermanentExpectation::AbsentCreate,
    }
}
fn success(area: &Dir) {
    super::super::files::publish(
        area,
        "legacy-retirement-result.json",
        &serde_json::json!({"binding":BINDING,"retirement_digest":RETIRED}),
    )
    .unwrap();
}

// SF_NOUNLINK is root-only. This fixture maps the same narrow set/clear contract
// onto the owner-settable immutable bit so pathname operations exercise the macOS
// kernel while production code remains bound to fchflags(fd, SF_NOUNLINK).
struct FixtureFenceFlags;
impl FenceFlags for FixtureFenceFlags {
    fn flags(file: &File) -> Result<u32> {
        use std::os::macos::fs::MetadataExt;
        Ok(if file.metadata()?.st_flags() & libc::UF_IMMUTABLE != 0 {
            LEGACY_ANCESTOR_FLAG
        } else {
            0
        })
    }
    fn set(file: &File, flags: u32) -> Result<()> {
        let flags = if flags & LEGACY_ANCESTOR_FLAG != 0 {
            libc::UF_IMMUTABLE
        } else {
            0
        };
        require(
            unsafe { libc::fchflags(file.as_raw_fd(), flags) } == 0,
            "FIXTURE_FLAG",
        )
    }
}
fn fixture_fence(
    root: &Dir,
    area: &Dir,
) -> (
    PathBuf,
    AncestorFenceExpectation,
    AncestorFence<FixtureFenceFlags>,
) {
    let ancestor = root.mkdir("agent-core").unwrap();
    ancestor.mkdir(LEGACY_LOCK_CHILD).unwrap();
    let path = fd_path(&ancestor).unwrap();
    let expected = AncestorFenceExpectation {
        identity: Identity::of(&ancestor.file).unwrap(),
        flags: 0,
        acl_none: true,
    };
    let fence = AncestorFence::<FixtureFenceFlags>::acquire(
        "operation",
        BINDING,
        area,
        &expected,
        &path,
        || root.child("agent-core"),
    )
    .unwrap();
    (path, expected, fence)
}

#[test]
fn nounlink_fence_closes_ancestor_rename_and_preserves_lock_child_operations() {
    assert_eq!(LEGACY_ANCESTOR_FLAG, 0x0010_0000);
    let t = crate::common::private::temp();
    let roots = FixtureRoots::open(t.path()).unwrap();
    let area = roots.root.mkdir("journal").unwrap();
    let before = roots.root.mkdir("agent-core").unwrap();
    before.mkdir(LEGACY_LOCK_CHILD).unwrap();
    roots
        .root
        .rename("agent-core", &roots.root, "moved")
        .unwrap();
    roots
        .root
        .rename("moved", &roots.root, "agent-core")
        .unwrap();
    std::fs::remove_dir_all(t.path().join("agent-core")).unwrap();

    let (path, expected, fence) = fixture_fence(&roots.root, &area);
    assert!(std::fs::rename(t.path().join("agent-core"), t.path().join("moved")).is_err());
    assert!(std::fs::remove_dir_all(t.path().join("agent-core")).is_err());
    assert_eq!(
        Identity::of(&roots.root.child("agent-core").unwrap().file).unwrap(),
        expected.identity
    );
    let lock_parent = fence
        .lock_parent_at(
            &expected_identity(
                &roots
                    .root
                    .child("agent-core")
                    .unwrap()
                    .child(LEGACY_LOCK_CHILD)
                    .unwrap(),
            ),
            &path,
            || roots.root.child("agent-core"),
        )
        .unwrap();
    let child = write_new(
        &lock_parent,
        "fixture.lock",
        b"held",
        lock_parent.uid,
        lock_parent.file.metadata().unwrap().gid(),
        0o600,
    )
    .unwrap();
    drop(child);
    lock_parent.unlink("fixture.lock").unwrap();
    fence
        .clear(&area, &path, || roots.root.child("agent-core"))
        .unwrap();
    roots
        .root
        .rename("agent-core", &roots.root, "moved")
        .unwrap();
}

fn expected_identity(dir: &Dir) -> Identity {
    Identity::of(&dir.file).unwrap()
}

#[test]
fn retained_fence_rejects_replacement_and_requires_exact_reviewed_recovery() {
    let t = crate::common::private::temp();
    let roots = FixtureRoots::open(t.path()).unwrap();
    let area = roots.root.mkdir("journal").unwrap();
    let (path, expected, fence) = fixture_fence(&roots.root, &area);
    assert!(std::fs::rename(t.path().join("agent-core"), t.path().join("old-agent-core")).is_err());
    assert_eq!(
        Identity::of(&roots.root.child("agent-core").unwrap().file).unwrap(),
        expected.identity
    );
    drop(fence); // Simulated crash: there is deliberately no Drop cleanup.
    let exact = retained_fence_requires_review::<FixtureFenceFlags>(
        "operation",
        BINDING,
        &area,
        &expected,
        &path,
        || roots.root.child("agent-core"),
    )
    .unwrap_err();
    assert_eq!(exact.code(), "LEGACY_FENCE_RECOVERY_REQUIRED");
    assert_eq!(
        retained_fence_requires_review::<FixtureFenceFlags>(
            "wrong-operation",
            BINDING,
            &area,
            &expected,
            &path,
            || roots.root.child("agent-core"),
        )
        .unwrap_err()
        .code(),
        "LEGACY_FENCE_JOURNAL"
    );
    let held = roots.root.child("agent-core").unwrap();
    FixtureFenceFlags::set(&held.file, 0).unwrap();
}

#[test]
fn fence_crash_worker() {
    let Ok(path) = std::env::var("DCP_FENCE_FIXTURE") else {
        return;
    };
    let roots = FixtureRoots::open(std::path::Path::new(&path)).unwrap();
    let area = roots.root.child("journal").unwrap();
    let ancestor = roots.root.child("agent-core").unwrap();
    let expected_path = fd_path(&ancestor).unwrap();
    let expected = AncestorFenceExpectation {
        identity: Identity::of(&ancestor.file).unwrap(),
        flags: 0,
        acl_none: true,
    };
    let _fence = AncestorFence::<FixtureFenceFlags>::acquire(
        "operation",
        BINDING,
        &area,
        &expected,
        &expected_path,
        || roots.root.child("agent-core"),
    )
    .unwrap();
    panic!("fault point not reached");
}

#[test]
fn crash_after_flag_effect_retains_exact_fence_for_reviewed_recovery_only() {
    let t = crate::common::private::temp();
    let roots = FixtureRoots::open(t.path()).unwrap();
    roots.root.mkdir("journal").unwrap();
    let ancestor = roots.root.mkdir("agent-core").unwrap();
    ancestor.mkdir(LEGACY_LOCK_CHILD).unwrap();
    let expected_path = fd_path(&ancestor).unwrap();
    let expected = AncestorFenceExpectation {
        identity: Identity::of(&ancestor.file).unwrap(),
        flags: 0,
        acl_none: true,
    };
    drop(ancestor);
    drop(roots);
    let out = Command::new(std::env::current_exe().unwrap())
        .args([
            "--exact",
            "first_live::legacy_locks::tests::fence_crash_worker",
            "--nocapture",
        ])
        .env("DCP_FENCE_FIXTURE", t.path())
        .env("DCP_TEST_POINT", "legacy-ancestor-fence-effect")
        .output()
        .unwrap();
    assert_eq!(out.status.code(), Some(75));
    let roots = FixtureRoots::open(t.path()).unwrap();
    let area = roots.root.child("journal").unwrap();
    assert_eq!(
        area.names().unwrap(),
        vec!["legacy-ancestor-fence-intent.json".to_string()]
    );
    assert_eq!(
        retained_fence_requires_review::<FixtureFenceFlags>(
            "operation",
            BINDING,
            &area,
            &expected,
            &expected_path,
            || roots.root.child("agent-core"),
        )
        .unwrap_err()
        .code(),
        "LEGACY_FENCE_RECOVERY_REQUIRED"
    );
    let held = roots.root.child("agent-core").unwrap();
    FixtureFenceFlags::set(&held.file, 0).unwrap();
}

#[test]
fn fence_clear_rejects_wrong_operation_inode_flag_and_prior_clear_phase() {
    for drift in ["operation", "inode", "flag", "phase"] {
        let t = crate::common::private::temp();
        let roots = FixtureRoots::open(t.path()).unwrap();
        let area = roots.root.mkdir("journal").unwrap();
        let (path, _expected, mut fence) = fixture_fence(&roots.root, &area);
        match drift {
            "operation" => fence.operation_id = "wrong".into(),
            "inode" => fence.expected.identity.inode += 1,
            "flag" => FixtureFenceFlags::set(&fence.dir.file, 0).unwrap(),
            "phase" => super::super::files::publish(
                &area,
                "legacy-ancestor-fence-clear-intent.json",
                &serde_json::json!({"foreign":true}),
            )
            .unwrap(),
            _ => unreachable!(),
        }
        assert!(fence
            .clear(&area, &path, || roots.root.child("agent-core"))
            .is_err());
        let held = roots.root.child("agent-core").unwrap();
        if FixtureFenceFlags::flags(&held.file).unwrap() == LEGACY_ANCESTOR_FLAG {
            FixtureFenceFlags::set(&held.file, 0).unwrap();
        }
    }
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
