use super::*;
use std::{
    os::fd::{AsRawFd, FromRawFd},
    os::unix::process::CommandExt,
    path::Path,
    process::Command,
};
const WORKER: &str = "first_live::native_effects::login::tests::faults::fault_worker";
const FD_WORKER: &str = "first_live::native_effects::login::tests::faults::fd_worker";
#[test]
fn fault_worker() {
    let Ok(path) = std::env::var("DCP_TEST_FIRST_LOGIN_FIXTURE") else {
        return;
    };
    common::private::nonroot();
    let roots = FixtureRoots::open(Path::new(&path)).unwrap();
    let area = roots.root.child("first-live-operation").unwrap();
    let mut e = Fixture {
        events: vec![],
        fail_login: false,
        fail_post: false,
    };
    assert!(execute(&area, &mut e).is_err());
    let expected = if std::env::var("DCP_TEST_FAULT_RECORD").unwrap() == INTENT {
        vec!["preflight"]
    } else {
        vec!["preflight", "login", "postflight"]
    };
    assert_eq!(e.events, expected);
    assert!(execute(&area, &mut e).is_err());
    assert_eq!(e.events, expected);
}
#[test]
fn intent_and_result_faults_and_crash_survive_reopen_without_replay() {
    for fault in ["partial", "fsync", "crash"] {
        for record in [INTENT, RESULT] {
            if fault == "crash" && record == RESULT {
                continue;
            }
            let t = common::private::temp();
            let roots = FixtureRoots::open(t.path()).unwrap();
            let area = roots.root.mkdir("first-live-operation").unwrap();
            let original = b"original UNKNOWN intent bytes";
            std::fs::write(t.path().join("original-genesis-intent"), original).unwrap();
            let mut c = Command::new(std::env::current_exe().unwrap());
            c.args(["--exact", WORKER, "--nocapture"])
                .env("DCP_TEST_FIRST_LOGIN_FIXTURE", t.path());
            if fault == "crash" {
                c.env("DCP_TEST_POINT", "first-live-login-after-intent");
            } else {
                c.env("DCP_TEST_FAULT_RECORD", record)
                    .env("DCP_TEST_RECORD_FAULT", fault);
            }
            let status = c.status().unwrap();
            if fault == "crash" {
                assert_eq!(status.code(), Some(75));
            } else {
                assert!(status.success());
            }
            drop(area);
            drop(roots);
            let roots = FixtureRoots::open(t.path()).unwrap();
            let area = roots.root.child("first-live-operation").unwrap();
            let mut e = Fixture {
                events: vec![],
                fail_login: false,
                fail_post: false,
            };
            assert!(execute(&area, &mut e).is_err());
            assert!(e.events.is_empty());
            assert_eq!(
                std::fs::read(t.path().join("original-genesis-intent")).unwrap(),
                original
            );
        }
    }
}
#[test]
fn fd_worker() {
    let Ok(fd) = std::env::var("DCP_TEST_FIRST_LOGIN_FD") else {
        return;
    };
    common::private::nonroot();
    let fd: i32 = fd.parse().unwrap();
    assert_eq!(unsafe { libc::fcntl(fd, libc::F_GETFD) }, -1);
    assert_eq!(
        std::io::Error::last_os_error().raw_os_error(),
        Some(libc::EBADF)
    );
}
#[test]
fn login_exec_closes_inherited_descriptor_without_closing_parent_copy() {
    common::private::nonroot();
    let t = common::private::temp();
    let f = std::fs::File::create(t.path().join("private-lock-fixture")).unwrap();
    let fd = unsafe { libc::fcntl(f.as_raw_fd(), libc::F_DUPFD, 256) };
    assert!(fd >= 256);
    let retained = unsafe { std::fs::File::from_raw_fd(fd) };
    assert_eq!(unsafe { libc::fcntl(fd, libc::F_SETFD, 0) }, 0);
    let mut c = Command::new(std::env::current_exe().unwrap());
    c.args(["--exact", FD_WORKER, "--nocapture"])
        .env("DCP_TEST_FIRST_LOGIN_FD", fd.to_string());
    let max = unsafe { libc::getdtablesize() };
    unsafe {
        c.pre_exec(move || process::seal_inherited_fds(max));
    }
    assert!(c.status().unwrap().success());
    assert!(retained.metadata().is_ok());
    assert_eq!(unsafe { libc::fcntl(fd, libc::F_GETFD) }, 0);
}
