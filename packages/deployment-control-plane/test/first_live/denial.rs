use super::*;
use crate::fs::{file::write_new, FixtureRoots};
use std::os::unix::fs::{MetadataExt, PermissionsExt};
fn targets(root: &Dir, path: &std::path::Path) -> Targets {
    let m = root.file.metadata().unwrap();
    Targets {
        parents: vec![Parent {
            held: None,
            path: CString::new(path.to_str().unwrap()).unwrap(),
            device: m.dev(),
            inode: m.ino(),
        }],
        files: vec![Target {
            parent: 0,
            name: CString::new("protected").unwrap(),
        }],
    }
}
fn context<'a>(root: &'a Dir, guard: &'a MutationGuard) -> Context<'a> {
    let f = write_new(
        root,
        "proof",
        b"fixture",
        root.uid,
        root.file.metadata().unwrap().gid(),
        0o400,
    )
    .unwrap();
    Context {
        journal: root,
        _guard: guard,
        stamps: [stamp(&f).unwrap(), stamp(&f).unwrap()],
        proof: [f.try_clone().unwrap(), f],
        groups: vec![],
        uid: unsafe { libc::geteuid() },
        gid: unsafe { libc::getegid() },
    }
}
#[test]
fn real_readonly_file_proves_write_denial_without_changing_bytes() {
    let t = crate::common::private::temp();
    let roots = FixtureRoots::open(t.path()).unwrap();
    let g = roots.lock().unwrap();
    let c = context(&roots.root, &g);
    let p = roots.root.mkdir("parent").unwrap();
    write_new(
        &p,
        "protected",
        b"retain",
        p.uid,
        p.file.metadata().unwrap().gid(),
        0o400,
    )
    .unwrap();
    let set = targets(&p, &t.path().join("parent"));
    let r = run(Class::Write, &set, &[], &c).unwrap();
    assert_eq!(r.denied, 1);
    assert!(!r.unexpected);
    assert_eq!(r.eacces + r.eperm, 1);
    assert_eq!(
        std::fs::read(t.path().join("parent/protected")).unwrap(),
        b"retain"
    );
}
#[test]
fn missing_file_is_inconclusive_not_denied() {
    let t = crate::common::private::temp();
    let roots = FixtureRoots::open(t.path()).unwrap();
    let g = roots.lock().unwrap();
    let c = context(&roots.root, &g);
    let set = targets(&roots.root, t.path());
    let r = run(Class::Write, &set, &[], &c).unwrap();
    assert_eq!(r.errno, libc::ENOENT);
    assert_eq!(r.denied, 0);
    assert!(finish(Class::Write, &set, &c, r).is_err());
}
#[test]
fn writable_file_is_failed_denial_with_zero_writes() {
    let t = crate::common::private::temp();
    let roots = FixtureRoots::open(t.path()).unwrap();
    let g = roots.lock().unwrap();
    let c = context(&roots.root, &g);
    write_new(
        &roots.root,
        "protected",
        b"same",
        roots.root.uid,
        roots.root.file.metadata().unwrap().gid(),
        0o600,
    )
    .unwrap();
    let set = targets(&roots.root, t.path());
    let r = run(Class::Write, &set, &[], &c).unwrap();
    assert!(r.unexpected);
    assert!(finish(Class::Write, &set, &c, r).is_err());
    assert_eq!(std::fs::read(t.path().join("protected")).unwrap(), b"same");
}
#[test]
fn actual_ancestor_permission_denial_leaves_no_probe() {
    let t = crate::common::private::temp();
    let roots = FixtureRoots::open(t.path()).unwrap();
    let g = roots.lock().unwrap();
    let c = context(&roots.root, &g);
    let p = roots.root.mkdir("parent").unwrap();
    let set = targets(&p, &t.path().join("parent"));
    std::fs::set_permissions(
        t.path().join("parent"),
        std::fs::Permissions::from_mode(0o500),
    )
    .unwrap();
    let r = run(Class::Create, &set, &[], &c).unwrap();
    assert_eq!(r.denied, 1);
    assert!(p.names().unwrap().is_empty());
    std::fs::set_permissions(
        t.path().join("parent"),
        std::fs::Permissions::from_mode(0o700),
    )
    .unwrap();
}
#[test]
fn unexpected_created_empty_inode_is_recorded_then_exactly_cleaned() {
    let t = crate::common::private::temp();
    let roots = FixtureRoots::open(t.path()).unwrap();
    let g = roots.lock().unwrap();
    let c = context(&roots.root, &g);
    let p = roots.root.mkdir("parent").unwrap();
    let set = targets(&p, &t.path().join("parent"));
    let r = run(Class::Create, &set, &[], &c).unwrap();
    assert!(r.unexpected);
    assert!(r.created.is_some());
    assert_eq!(p.names().unwrap(), vec![".agent-deployd-denial-probe"]);
    assert!(finish(Class::Create, &set, &c, r).is_err());
    assert!(p.names().unwrap().is_empty());
    assert!(roots
        .root
        .names()
        .unwrap()
        .contains(&"native-denial-create-result.json".into()));
}
#[test]
fn foreign_or_changed_probe_never_deleted() {
    for replaced in [false, true] {
        let t = crate::common::private::temp();
        let roots = FixtureRoots::open(t.path()).unwrap();
        let g = roots.lock().unwrap();
        let c = context(&roots.root, &g);
        let p = roots.root.mkdir("parent").unwrap();
        let set = targets(&p, &t.path().join("parent"));
        let name = t.path().join("parent/.agent-deployd-denial-probe");
        if !replaced {
            std::fs::write(&name, b"foreign").unwrap();
        }
        let r = run(Class::Create, &set, &[], &c).unwrap();
        if replaced {
            std::fs::remove_file(&name).unwrap();
            std::fs::write(&name, b"foreign").unwrap();
        }
        assert!(finish(Class::Create, &set, &c, r).is_err());
        assert_eq!(std::fs::read(&name).unwrap(), b"foreign");
    }
}
#[test]
fn same_uid_signal_zero_is_not_permission_denial() {
    let t = crate::common::private::temp();
    let roots = FixtureRoots::open(t.path()).unwrap();
    let g = roots.lock().unwrap();
    let c = context(&roots.root, &g);
    let set = targets(&roots.root, t.path());
    let r = run(Class::Signal, &set, &[std::process::id()], &c).unwrap();
    assert!(r.unexpected);
    assert_eq!(r.denied, 0);
    assert!(finish(Class::Signal, &set, &c, r).is_err());
}
#[test]
fn absent_process_never_counts_as_signal_denial() {
    let t = crate::common::private::temp();
    let roots = FixtureRoots::open(t.path()).unwrap();
    let g = roots.lock().unwrap();
    let c = context(&roots.root, &g);
    let set = targets(&roots.root, t.path());
    let pid = unsafe { libc::fork() };
    assert!(pid >= 0);
    if pid == 0 {
        unsafe { libc::_exit(0) }
    };
    unsafe { libc::waitpid(pid, std::ptr::null_mut(), 0) };
    let r = run(Class::Signal, &set, &[pid as u32], &c).unwrap();
    assert_eq!(r.errno, libc::ESRCH);
    assert_eq!(r.denied, 0);
}
#[test]
fn bounded_wait_kills_and_reaps_owned_child() {
    assert_ne!(unsafe { libc::geteuid() }, 0);
    let pid = unsafe { libc::fork() };
    assert!(pid >= 0);
    if pid == 0 {
        unsafe {
            libc::pause();
            libc::_exit(0)
        }
    };
    let result = reap(pid, Duration::from_millis(20));
    let after = unsafe { libc::waitpid(pid, std::ptr::null_mut(), libc::WNOHANG) };
    if after == 0 {
        unsafe {
            libc::kill(pid, libc::SIGKILL);
            libc::waitpid(pid, std::ptr::null_mut(), 0);
        }
    }
    assert!(result.is_err());
    assert_eq!(after, -1);
}
#[test]
fn parent_identity_drift_is_not_permission_denial() {
    let t = crate::common::private::temp();
    let roots = FixtureRoots::open(t.path()).unwrap();
    let g = roots.lock().unwrap();
    let c = context(&roots.root, &g);
    let mut set = targets(&roots.root, t.path());
    set.parents[0].inode += 1;
    let r = run(Class::Write, &set, &[], &c).unwrap();
    assert_eq!(r.denied, 0);
    assert!(finish(Class::Write, &set, &c, r).is_err());
}
#[test]
fn actual_observation_is_durable_before_later_identity_gate_or_cleanup() {
    let t = crate::common::private::temp();
    let roots = FixtureRoots::open(t.path()).unwrap();
    let g = roots.lock().unwrap();
    let c = context(&roots.root, &g);
    let set = targets(&roots.root, t.path());
    let r = run(Class::Signal, &set, &[std::process::id()], &c).unwrap();
    assert!(r.unexpected);
    assert!(roots
        .root
        .names()
        .unwrap()
        .contains(&"native-denial-signal-result.json".into()));
}
#[test]
fn stale_context_refuses_before_intent_and_any_probe() {
    let t = crate::common::private::temp();
    let roots = FixtureRoots::open(t.path()).unwrap();
    let g = roots.lock().unwrap();
    let c = context(&roots.root, &g);
    let set = targets(&roots.root, t.path());
    std::fs::set_permissions(
        t.path().join("proof"),
        std::fs::Permissions::from_mode(0o600),
    )
    .unwrap();
    std::fs::write(t.path().join("proof"), b"changed").unwrap();
    assert_eq!(
        run(Class::Create, &set, &[], &c).unwrap_err().code(),
        "DENIAL_CONTEXT_DRIFT"
    );
    assert!(!t.path().join(".agent-deployd-denial-probe").exists());
    assert!(!roots
        .root
        .names()
        .unwrap()
        .contains(&"native-denial-create-intent.json".into()));
}
#[test]
fn production_context_refuses_nonroot_without_real_file_access() {
    let t = crate::common::private::temp();
    let roots = FixtureRoots::open(t.path()).unwrap();
    let g = roots.lock().unwrap();
    assert_eq!(
        Context::new(&roots.root, "digest", "digest", &[20], &g)
            .err()
            .unwrap()
            .code(),
        "ROOT_REQUIRED"
    );
}
#[test]
fn reaper_does_not_signal_a_process_owned_by_another_parent() {
    assert_ne!(unsafe { libc::geteuid() }, 0);
    let sentinel = unsafe { libc::fork() };
    assert!(sentinel >= 0);
    if sentinel == 0 {
        unsafe {
            libc::pause();
            libc::_exit(0)
        }
    };
    let helper = unsafe { libc::fork() };
    assert!(helper >= 0);
    if helper == 0 {
        let _ = reap(sentinel, Duration::from_millis(10));
        unsafe { libc::_exit(0) }
    };
    unsafe { libc::waitpid(helper, std::ptr::null_mut(), 0) };
    let status = unsafe { libc::waitpid(sentinel, std::ptr::null_mut(), libc::WNOHANG) };
    if status == 0 {
        unsafe {
            libc::kill(sentinel, libc::SIGKILL);
            libc::waitpid(sentinel, std::ptr::null_mut(), 0);
        }
    }
    assert_eq!(status, 0, "nonchild was signaled by the bounded reaper");
}

#[test]
fn held_readonly_parent_probes_exact_leaf_even_when_parent_cannot_be_opened() {
    let t = crate::common::private::temp();
    let roots = FixtureRoots::open(t.path()).unwrap();
    let g = roots.lock().unwrap();
    let c = context(&roots.root, &g);
    let p = roots.root.mkdir("parent").unwrap();
    write_new(
        &p,
        "protected",
        b"unchanged",
        p.uid,
        p.file.metadata().unwrap().gid(),
        0o400,
    )
    .unwrap();
    let mut set = targets(&p, &t.path().join("parent"));
    set.parents[0].held = Some(p.file.try_clone().unwrap());
    std::fs::set_permissions(
        t.path().join("parent"),
        std::fs::Permissions::from_mode(0o000),
    )
    .unwrap();
    let result = run(Class::Write, &set, &[], &c);
    std::fs::set_permissions(
        t.path().join("parent"),
        std::fs::Permissions::from_mode(0o700),
    )
    .unwrap();
    let r = result.unwrap();
    assert_eq!(r.denied, 1);
    assert!(!r.inconclusive);
}
