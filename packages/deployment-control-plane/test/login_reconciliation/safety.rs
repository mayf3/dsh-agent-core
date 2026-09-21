use super::*;
use crate::fs::file::{sha, write_new};
use std::os::{
    fd::AsRawFd,
    unix::fs::{MetadataExt, PermissionsExt},
};
#[test]
fn public_hash_drift_is_rejected() {
    let (_t, d) = dir();
    append(&d, "old.json", &json!({"immutable":true})).unwrap();
    assert!(state::pinned(&d, "old.json", &"0".repeat(64)).is_err());
}
#[test]
fn private_metadata_is_checked_without_reading_contents() {
    let (t, d) = dir();
    let f = write_new(
        &d,
        "credential",
        b"fixture-only",
        d.uid,
        unsafe { libc::getegid() },
        0o600,
    )
    .unwrap();
    state::metadata(&f, d.uid, unsafe { libc::getegid() }, 0o600, true).unwrap();
    for mode in [0o644, 0o666, 0o700] {
        fs::set_permissions(
            t.path().join("credential"),
            fs::Permissions::from_mode(mode),
        )
        .unwrap();
        assert!(state::metadata(&f, d.uid, unsafe { libc::getegid() }, 0o600, true).is_err());
    }
    fs::set_permissions(
        t.path().join("credential"),
        fs::Permissions::from_mode(0o600),
    )
    .unwrap();
    fs::hard_link(t.path().join("credential"), t.path().join("alias")).unwrap();
    assert!(state::metadata(&f, d.uid, unsafe { libc::getegid() }, 0o600, true).is_err());
}
#[test]
fn empty_auth_and_wrong_identity_do_not_complete() {
    let (_t, d) = dir();
    let f = write_new(&d, "auth", b"", d.uid, unsafe { libc::getegid() }, 0o600).unwrap();
    assert!(state::metadata(&f, d.uid, unsafe { libc::getegid() }, 0o600, true).is_err());
    assert!(state::metadata(&f, d.uid + 1, unsafe { libc::getegid() }, 0o600, false).is_err());
}
#[test]
fn existing_lock_identity_and_real_nonblocking_exclusion_are_required() {
    let (_t, d) = dir();
    let f = write_new(
        &d,
        "bootstrap.lock",
        b"",
        d.uid,
        unsafe { libc::getegid() },
        0o600,
    )
    .unwrap();
    let m = f.metadata().unwrap();
    assert!(state::lock(&d, 16_777_230, m.ino() + 1, true).is_err());
    let held = state::lock(&d, 16_777_230, m.ino(), true).unwrap();
    assert_ne!(
        unsafe { libc::flock(f.as_raw_fd(), libc::LOCK_EX | libc::LOCK_NB) },
        0
    );
    assert!(state::lock(&d, 16_777_230, m.ino(), true).is_err());
    drop(held);
    assert_eq!(
        unsafe { libc::flock(f.as_raw_fd(), libc::LOCK_EX | libc::LOCK_NB) },
        0
    );
}
#[test]
fn missing_lock_is_not_created() {
    let (_t, d) = dir();
    assert!(state::lock(&d, 1, 1, true).is_err());
    assert!(d.names().unwrap().is_empty());
}
fn row(pid: u32, ppid: u32, uid: u32, command: &str) -> process::Row {
    process::Row {
        pid,
        ppid,
        uid,
        start: "Fri Sep 18 12:00:00 2026".into(),
        command: command.into(),
    }
}
#[test]
fn foreign_reviewer_bootstrap_and_helper_processes_block() {
    let own = row(42, 1, 0, HELPER);
    process::check(std::slice::from_ref(&own), 42, None).unwrap();
    for other in [
        row(2, 1, 612, "/some/codex"),
        row(
            3,
            1,
            0,
            "/usr/local/libexec/agent-deployd/agent-deploy-bootstrap",
        ),
        row(4, 1, 0, HELPER),
    ] {
        assert!(process::check(&[own.clone(), other], 42, None).is_err());
    }
}
#[test]
fn child_requires_exact_live_parent_identity_and_start() {
    let parent = row(42, 1, 0, HELPER);
    let own = row(43, 42, 0, HELPER);
    let mut intent = Intent {
        manifest_digest: "a".repeat(64),
        original_intent_digest: "c".repeat(64),
        grant_digest: "d".repeat(64),
        parent_pid: 42,
        parent_start: parent.start.clone(),
    };
    process::check(&[parent.clone(), own.clone()], 43, Some(&intent)).unwrap();
    intent.parent_start = "other generation".into();
    assert!(process::check(&[parent.clone(), own.clone()], 43, Some(&intent)).is_err());
    intent.parent_start = parent.start;
    let wrong = row(43, 99, 0, HELPER);
    assert!(process::check(&[row(42, 1, 0, HELPER), wrong], 43, Some(&intent)).is_err());
}
#[test]
fn public_read_preserves_bytes_and_denies_symlink() {
    let (t, d) = dir();
    let bytes = b"public receipt";
    write_new(
        &d,
        "public",
        bytes,
        d.uid,
        unsafe { libc::getegid() },
        0o600,
    )
    .unwrap();
    assert_eq!(state::pinned(&d, "public", &sha(bytes)).unwrap(), bytes);
    std::os::unix::fs::symlink(t.path().join("public"), t.path().join("link")).unwrap();
    assert!(state::pinned(&d, "link", &sha(bytes)).is_err());
}
#[test]
fn unexpected_attempt_state_cannot_be_ignored() {
    let (_t, d) = dir();
    append(&d, "unexpected-operation.json", &json!({})).unwrap();
    assert!(state::inventory(&d, &[]).is_err());
}
#[test]
fn fixed_entry_refuses_nonroot_before_any_native_effect() {
    crate::common::private::nonroot();
    assert_eq!(
        login_reconciliation("run").unwrap_err().code(),
        "ROOT_REQUIRED"
    );
    assert_eq!(
        login_reconciliation("child").unwrap_err().code(),
        "ROOT_REQUIRED"
    );
    assert_eq!(
        login_reconciliation("some/path").unwrap_err().code(),
        "USAGE"
    );
}
#[test]
fn process_metadata_parser_preserves_start_identity_without_arguments() {
    let rows=process::parse("42 1 0 Fri Sep 18 12:00:00 2026 /usr/local/libexec/agent-deployd/agent-deploy-login-reconcile\n").unwrap();
    assert_eq!(rows[0].start, "Fri Sep 18 12:00:00 2026");
    process::check(&rows, 42, None).unwrap();
    for bad in [
        "",
        "not a process",
        "42 1 x Fri Sep 18 12:00:00 2026 command",
    ] {
        assert!(process::parse(bad).is_err());
    }
}
#[test]
fn activation_presence_and_symlink_are_never_absence() {
    let (t, d) = dir();
    state::absent(&d, "activation.json").unwrap();
    append(&d, "activation.json", &json!({})).unwrap();
    assert!(state::absent(&d, "activation.json").is_err());
    std::os::unix::fs::symlink(
        t.path().join("missing"),
        t.path().join("daemon-activation.json"),
    )
    .unwrap();
    assert!(state::absent(&d, "daemon-activation.json").is_err());
}
