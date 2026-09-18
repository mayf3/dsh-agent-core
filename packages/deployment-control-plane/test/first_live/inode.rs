use super::*;
use crate::fs::FixtureRoots;
use std::{
    fs,
    os::unix::fs::{FileExt, MetadataExt},
};

fn entry(path: &std::path::Path, kind: Kind) -> Entry {
    let m = fs::metadata(path).unwrap();
    Entry {
        kind: kind.clone(),
        uid: m.uid(),
        gid: m.gid(),
        mode: m.mode() & 0o7777,
        flags: 0,
        device: m.dev(),
        inode: m.ino(),
        links: m.nlink(),
        sha256: if kind == Kind::File {
            Some(sha(&fs::read(path).unwrap()))
        } else {
            None
        },
        link: None,
        post_gid: m.gid(),
        post_mode: if kind == Kind::File { 0o444 } else { 0o700 },
    }
}
fn setup(pair: bool) -> (tempfile::TempDir, FixtureRoots, Dir, Dir, Tree) {
    let t = crate::common::private::temp();
    let roots = FixtureRoots::open(t.path()).unwrap();
    let target = roots.root.mkdir("target").unwrap();
    let history = roots.root.mkdir("history").unwrap();
    fs::write(t.path().join("target/a"), b"ABCD").unwrap();
    let mut names = vec!["a"];
    if pair {
        fs::hard_link(t.path().join("target/a"), t.path().join("target/b")).unwrap();
        names.push("b");
    }
    let tree = Tree {
        root: entry(&t.path().join("target"), Kind::Directory),
        entries: names
            .into_iter()
            .map(|p| {
                (
                    p.into(),
                    entry(&t.path().join("target").join(p), Kind::File),
                )
            })
            .collect(),
    };
    (t, roots, target, history, tree)
}
#[test]
fn old_writable_fd_cannot_change_new_trusted_file() {
    let (t, roots, target, history, before) = setup(false);
    let old = fs::OpenOptions::new()
        .write(true)
        .open(t.path().join("target/a"))
        .unwrap();
    let guard = roots.lock().unwrap();
    let after = replace_tree(&target, &before, &history, &guard, u64::MAX).unwrap();
    old.write_all_at(b"EVIL", 0).unwrap();
    old.sync_all().unwrap();
    assert_eq!(fs::read(t.path().join("target/a")).unwrap(), b"ABCD");
    assert_ne!(after.entries["a"].inode, before.entries["a"].inode);
    assert_eq!(after.entries["a"].links, 1);
}
#[test]
fn old_shared_mapping_cannot_change_new_trusted_file() {
    let (t, roots, target, history, before) = setup(false);
    let old = fs::OpenOptions::new()
        .read(true)
        .write(true)
        .open(t.path().join("target/a"))
        .unwrap();
    let map = unsafe {
        libc::mmap(
            std::ptr::null_mut(),
            4,
            libc::PROT_READ | libc::PROT_WRITE,
            libc::MAP_SHARED,
            old.as_raw_fd(),
            0,
        )
    };
    assert_ne!(map, libc::MAP_FAILED);
    drop(old);
    let guard = roots.lock().unwrap();
    replace_tree(&target, &before, &history, &guard, u64::MAX).unwrap();
    unsafe {
        std::ptr::copy_nonoverlapping(b"EVIL".as_ptr(), map.cast(), 4);
        assert_eq!(libc::msync(map, 4, libc::MS_SYNC), 0);
        assert_eq!(libc::munmap(map, 4), 0);
    }
    assert_eq!(fs::read(t.path().join("target/a")).unwrap(), b"ABCD");
}
#[test]
fn closed_pair_uses_exactly_two_names_for_one_new_inode() {
    let (t, roots, target, history, before) = setup(true);
    let old = fs::OpenOptions::new()
        .write(true)
        .open(t.path().join("target/a"))
        .unwrap();
    let guard = roots.lock().unwrap();
    let after = replace_tree(&target, &before, &history, &guard, u64::MAX).unwrap();
    old.write_all_at(b"EVIL", 0).unwrap();
    old.sync_all().unwrap();
    for path in ["a", "b"] {
        assert_eq!(
            fs::read(t.path().join("target").join(path)).unwrap(),
            b"ABCD"
        );
        assert_eq!(after.entries[path].links, 2);
    }
    assert_eq!(after.entries["a"].inode, after.entries["b"].inode);
    assert_ne!(after.entries["a"].inode, before.entries["a"].inode);
}
#[test]
fn wrong_digest_is_rejected_before_any_replacement() {
    let (t, roots, target, history, mut before) = setup(false);
    before.entries.get_mut("a").unwrap().sha256 = Some("a".repeat(64));
    let guard = roots.lock().unwrap();
    assert!(replace_tree(&target, &before, &history, &guard, u64::MAX).is_err());
    assert_eq!(fs::read(t.path().join("target/a")).unwrap(), b"ABCD");
}

#[test]
fn expired_grant_stops_before_archiving_or_replacing() {
    let (t, roots, target, history, before) = setup(false);
    let guard = roots.lock().unwrap();
    assert!(replace_tree(&target, &before, &history, &guard, 0).is_err());
    assert!(history.names().unwrap().is_empty());
    assert_eq!(
        fs::metadata(t.path().join("target/a")).unwrap().ino(),
        before.entries["a"].inode
    );
}

#[test]
fn rollback_uses_sealed_bytes_and_another_new_inode() {
    let (t, roots, target, history, before) = setup(false);
    let old = fs::OpenOptions::new()
        .write(true)
        .open(t.path().join("target/a"))
        .unwrap();
    let guard = roots.lock().unwrap();
    let post = replace_tree(&target, &before, &history, &guard, u64::MAX).unwrap();
    old.write_all_at(b"EVIL", 0).unwrap();
    old.sync_all().unwrap();
    let restored = recover_tree(&target, &before, &history, &guard, u64::MAX).unwrap();
    let actual = fs::metadata(t.path().join("target/a")).unwrap();
    assert_eq!(fs::read(t.path().join("target/a")).unwrap(), b"ABCD");
    assert_eq!(actual.mode() & 0o7777, before.entries["a"].mode);
    assert_ne!(actual.ino(), before.entries["a"].inode);
    assert_ne!(actual.ino(), post.entries["a"].inode);
    assert_eq!(actual.ino(), restored.entries["a"].inode);
}
#[test]
fn rollback_does_not_overwrite_unrelated_current_inode() {
    let (t, roots, target, history, before) = setup(false);
    let guard = roots.lock().unwrap();
    replace_tree(&target, &before, &history, &guard, u64::MAX).unwrap();
    fs::write(t.path().join("target/unrelated"), b"ABCD").unwrap();
    fs::rename(t.path().join("target/unrelated"), t.path().join("target/a")).unwrap();
    let inode = fs::metadata(t.path().join("target/a")).unwrap().ino();
    assert!(recover_tree(&target, &before, &history, &guard, u64::MAX).is_err());
    assert_eq!(
        fs::metadata(t.path().join("target/a")).unwrap().ino(),
        inode
    );
}

#[test]
fn extra_alias_symlink_and_metadata_drift_refuse_target_mutation() {
    for scenario in ["alias", "symlink", "mode"] {
        let (t, roots, target, history, before) = setup(false);
        let a = t.path().join("target/a");
        match scenario {
            "alias" => fs::hard_link(&a, t.path().join("outside")).unwrap(),
            "symlink" => {
                fs::rename(&a, t.path().join("outside")).unwrap();
                std::os::unix::fs::symlink("../outside", &a).unwrap();
            }
            _ => {
                use std::os::unix::fs::PermissionsExt;
                fs::set_permissions(&a, fs::Permissions::from_mode(0o600)).unwrap();
            }
        }
        let expected = fs::symlink_metadata(&a).unwrap().ino();
        let guard = roots.lock().unwrap();
        assert!(replace_tree(&target, &before, &history, &guard, u64::MAX).is_err());
        assert_eq!(fs::symlink_metadata(&a).unwrap().ino(), expected);
        assert_eq!(fs::read(&a).unwrap(), b"ABCD");
    }
}
#[test]
fn corrupt_archive_or_expired_recovery_preserves_current_postimage() {
    for corrupt in [true, false] {
        let (t, roots, target, history, before) = setup(false);
        let guard = roots.lock().unwrap();
        let post = replace_tree(&target, &before, &history, &guard, u64::MAX).unwrap();
        if corrupt {
            use std::os::unix::fs::PermissionsExt;
            let id = digest(&(vec!["a"], &before.entries["a"])).unwrap();
            let archive = t.path().join(format!("history/{}/{id}-bytes", &id[..2]));
            fs::set_permissions(&archive, fs::Permissions::from_mode(0o600)).unwrap();
            fs::write(&archive, b"EVIL").unwrap();
            fs::set_permissions(&archive, fs::Permissions::from_mode(0o400)).unwrap();
        }
        assert!(recover_tree(
            &target,
            &before,
            &history,
            &guard,
            if corrupt { u64::MAX } else { 0 }
        )
        .is_err());
        assert_eq!(fs::read(t.path().join("target/a")).unwrap(), b"ABCD");
        assert_eq!(
            fs::metadata(t.path().join("target/a")).unwrap().ino(),
            post.entries["a"].inode
        );
    }
}
#[test]
fn disk_budget_overflow_and_insufficient_space_fail_closed() {
    let (_t, _roots, target, _history, _before) = setup(false);
    assert!(check_space(&target, u64::MAX, 0).is_err());
    assert!(check_space(&target, u64::MAX / 4, 0).is_err());
    check_space(&target, 4, 0).unwrap();
}
fn crash(t: &tempfile::TempDir, before: &Tree, point: &str, recovery: bool) {
    fs::write(
        t.path().join("before.json"),
        serde_json::to_vec(before).unwrap(),
    )
    .unwrap();
    let status = std::process::Command::new(std::env::current_exe().unwrap())
        .args([
            "--exact",
            "first_live::native_effects::inode::tests::inode_crash_worker",
            "--nocapture",
        ])
        .env("DCP_INODE_WORKER", t.path())
        .env("DCP_INODE_RECOVERY", if recovery { "yes" } else { "no" })
        .env("DCP_TEST_POINT", point)
        .status()
        .unwrap();
    assert_eq!(status.code(), Some(75), "{point}");
}
#[test]
fn inode_crash_worker() {
    let Some(path) = std::env::var_os("DCP_INODE_WORKER") else {
        return;
    };
    assert_ne!(unsafe { libc::geteuid() }, 0);
    let path = std::path::PathBuf::from(path);
    let roots = FixtureRoots::open(&path).unwrap();
    let before: Tree =
        serde_json::from_slice(&fs::read(path.join("before.json")).unwrap()).unwrap();
    let target = roots.root.child("target").unwrap();
    let history = roots.root.child("history").unwrap();
    let guard = roots.lock().unwrap();
    if std::env::var("DCP_INODE_RECOVERY").as_deref() == Ok("yes") {
        recover_tree(&target, &before, &history, &guard, u64::MAX).unwrap();
    } else {
        replace_tree(&target, &before, &history, &guard, u64::MAX).unwrap();
    }
    panic!("fault point was not reached");
}
#[test]
fn real_pair_crash_windows_never_replay_or_invent_completion() {
    for point in [
        "inode-after-archive",
        "inode-before-publication",
        "inode-after-first-publication",
        "inode-after-next-publication",
    ] {
        let (t, roots, target, history, before) = setup(true);
        let held_old = fs::File::open(t.path().join("target/a")).unwrap();
        crash(&t, &before, point, false);
        let guard = roots.lock().unwrap();
        let id = digest(&(vec!["a", "b"], &before.entries["a"])).unwrap();
        let bin = history.child(&id[..2]).unwrap();
        files::absent(&bin, &format!("{id}-result.json")).unwrap();
        assert!(replace_tree(&target, &before, &history, &guard, u64::MAX).is_err());
        if point == "inode-after-archive" {
            // No durable target intent: preserve the archive and fail closed.
            assert!(recover_tree(&target, &before, &history, &guard, u64::MAX).is_err());
            assert_eq!(
                fs::metadata(t.path().join("target/a")).unwrap().ino(),
                before.entries["a"].inode
            );
        } else {
            let restored = recover_tree(&target, &before, &history, &guard, u64::MAX).unwrap();
            assert_eq!(restored.entries["a"].inode, restored.entries["b"].inode);
            assert_ne!(
                restored.entries["a"].inode,
                held_old.metadata().unwrap().ino()
            );
            for name in ["a", "b"] {
                let p = t.path().join("target").join(name);
                assert_eq!(fs::read(&p).unwrap(), b"ABCD");
                assert_eq!(fs::metadata(&p).unwrap().nlink(), 2);
            }
            assert_eq!(target.names().unwrap().len(), 2);
        }
    }
}
#[test]
fn recovery_crash_retains_unknown_and_cannot_be_replayed() {
    for point in [
        "inode-recovery-before-publication",
        "inode-recovery-after-publication",
    ] {
        let (t, roots, target, history, before) = setup(true);
        {
            let guard = roots.lock().unwrap();
            replace_tree(&target, &before, &history, &guard, u64::MAX).unwrap();
        }
        crash(&t, &before, point, true);
        let id = digest(&(vec!["a", "b"], &before.entries["a"])).unwrap();
        let bin = history.child(&id[..2]).unwrap();
        files::absent(&bin, &format!("{id}-restore-result.json")).unwrap();
        let inode = fs::metadata(t.path().join("target/a")).unwrap().ino();
        let guard = roots.lock().unwrap();
        assert!(recover_tree(&target, &before, &history, &guard, u64::MAX).is_err());
        assert_eq!(
            fs::metadata(t.path().join("target/a")).unwrap().ino(),
            inode
        );
    }
}

#[test]
fn trusted_owner_write_modes_are_allowed_but_other_writers_are_rejected() {
    for mode in [0o644, 0o755, 0o664, 0o646, 0o4644] {
        let (t, roots, target, history, mut before) = setup(false);
        before.entries.get_mut("a").unwrap().post_mode = mode;
        let guard = roots.lock().unwrap();
        let result = replace_tree(&target, &before, &history, &guard, u64::MAX);
        if [0o644, 0o755].contains(&mode) {
            assert!(result.is_ok(), "trusted owner mode {mode:o} was rejected");
            assert_eq!(
                fs::metadata(t.path().join("target/a")).unwrap().mode() & 0o7777,
                mode
            );
        } else {
            assert!(result.is_err(), "untrusted mode {mode:o} was allowed");
            assert_eq!(
                fs::metadata(t.path().join("target/a")).unwrap().ino(),
                before.entries["a"].inode
            );
        }
    }
}
