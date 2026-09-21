use super::*;
use std::os::unix::fs::MetadataExt;

#[test]
fn bootstrap_lock_device_is_boot_local_while_binding_device_stays_frozen() {
    let t = crate::common::private::temp();
    let roots = crate::fs::FixtureRoots::open(t.path()).unwrap();
    crate::fs::file::write_new(
        &roots.root,
        "bootstrap.lock",
        b"",
        unsafe { libc::geteuid() },
        roots.root.file.metadata().unwrap().gid(),
        0o600,
    )
    .unwrap();
    let inode = roots
        .root
        .open_file("bootstrap.lock", libc::O_RDONLY, 0)
        .unwrap()
        .metadata()
        .unwrap()
        .ino();
    state::lock(&roots.root, 16_777_230, inode, false).unwrap();
    assert_eq!(
        state::lock(&roots.root, 16_777_232, inode, false)
            .unwrap_err()
            .code(),
        "LOGIN_LOCK_BINDING"
    );
}
use crate::{bootstrap::genesis_install::append, error::require};
use serde_json::json;
use std::fs;
fn dir() -> (tempfile::TempDir, Dir) {
    let t = crate::common::private::temp();
    let root = crate::fs::FixtureRoots::open(t.path()).unwrap();
    (t, root.root)
}
fn grant() -> Grant {
    Grant {
        version: 1,
        owner: "mayf3".into(),
        scope: "EXACT_REVIEWER_LOGIN_RECONCILIATION_ONLY".into(),
        manifest_digest: "a".repeat(64),
        helper_digest: "b".repeat(64),
        issued_at: 100,
        expires_at: 200,
    }
}
struct Fixture {
    count: usize,
    before: bool,
    after: bool,
    outcome: Outcome,
}
impl Effects for Fixture {
    fn preflight(&mut self) -> Result<Intent> {
        require(self.before, "PRESTATE_DRIFT")?;
        Ok(Intent {
            manifest_digest: "a".repeat(64),
            original_intent_digest: "c".repeat(64),
            grant_digest: "d".repeat(64),
            parent_pid: 123,
            parent_start: "fixed start".into(),
        })
    }
    fn login(&mut self) -> Result<Outcome> {
        self.count += 1;
        Ok(self.outcome)
    }
    fn postflight(&mut self) -> Result<()> {
        require(self.after, "POSTSTATE_UNKNOWN")
    }
}
fn effects() -> Fixture {
    Fixture {
        count: 0,
        before: true,
        after: true,
        outcome: Outcome::Completed,
    }
}
#[test]
fn exactly_once_success_retains_original_history() {
    let (t, d) = dir();
    append(&d, "login-intent.json", &json!({"old":"unknown"})).unwrap();
    let old = fs::read(t.path().join("login-intent.json")).unwrap();
    let mut e = effects();
    execute(&d, &mut e).unwrap();
    assert!(t.path().join("login-reconciliation-intent.json").exists());
    assert!(t.path().join("login-reconciliation-result.json").exists());
    assert!(execute(&d, &mut e).is_err());
    assert_eq!(e.count, 1);
    assert_eq!(fs::read(t.path().join("login-intent.json")).unwrap(), old);
}
#[test]
fn any_existing_budget_record_blocks_before_spawn() {
    for name in [
        "login-reconciliation-intent.json",
        "login-reconciliation-result.json",
        "login-reconciliation-failure.json",
    ] {
        let (_t, d) = dir();
        append(&d, name, &json!({})).unwrap();
        let mut e = effects();
        assert!(execute(&d, &mut e).is_err());
        assert_eq!(e.count, 0);
    }
}
#[test]
fn failed_timeout_or_unknown_poststate_stays_consumed() {
    for outcome in [Outcome::Failed, Outcome::TimedOut, Outcome::Completed] {
        let (t, d) = dir();
        let mut e = effects();
        e.outcome = outcome;
        e.after = false;
        assert!(execute(&d, &mut e).is_err());
        assert!(t.path().join("login-reconciliation-intent.json").exists());
        assert!(t.path().join("login-reconciliation-failure.json").exists());
        assert!(execute(&d, &mut e).is_err());
        assert_eq!(e.count, 1);
    }
}
#[test]
fn precondition_failure_produces_no_login_intent_or_spawn() {
    let (_t, d) = dir();
    let mut e = effects();
    e.before = false;
    assert!(execute(&d, &mut e).is_err());
    assert_eq!(e.count, 0);
    assert!(d.names().unwrap().is_empty());
}
#[test]
fn grant_scope_identity_binding_and_one_hour_bound_are_exact() {
    let g = grant();
    validate_grant(&g, &"a".repeat(64), &"b".repeat(64), 150).unwrap();
    for mutate in [0, 1, 2, 3, 4, 5, 6, 7] {
        let mut g = grant();
        match mutate {
            0 => g.owner = "someone".into(),
            1 => g.scope = "install".into(),
            2 => g.manifest_digest = "c".repeat(64),
            3 => g.helper_digest = "d".repeat(64),
            4 => g.issued_at = 151,
            5 => g.expires_at = 150,
            6 => g.expires_at = 3701,
            _ => g.version = 2,
        };
        assert!(
            validate_grant(&g, &"a".repeat(64), &"b".repeat(64), 150).is_err(),
            "{mutate}"
        );
    }
}
#[test]
fn malformed_grant_unknown_fields_cannot_be_ignored() {
    let mut v = serde_json::to_value(grant()).unwrap();
    v["retry"] = json!(true);
    assert!(serde_json::from_value::<Grant>(v).is_err());
}
mod safety;

mod faults;
