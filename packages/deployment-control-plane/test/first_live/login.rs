use super::*;
use crate::{common, fs::FixtureRoots};
use state::*;
struct Fixture {
    events: Vec<&'static str>,
    fail_login: bool,
    fail_post: bool,
}
impl Effects for Fixture {
    fn preflight(&mut self) -> Result<Intent> {
        self.events.push("preflight");
        Ok(Intent {
            version: 1,
            operation_id: "first-live-dsh-20260918-01".into(),
            package_digest: "1".repeat(64),
            owner_grant_digest: "2".repeat(64),
            controller_sha256: "3".repeat(64),
            custody_completion_sha256: "4".repeat(64),
            original_intent_digest: ORIGINAL_INTENT.into(),
            parent_pid: 100,
            parent_start: "fixture-generation".into(),
            expires_at: 1000,
        })
    }
    fn login(&mut self, _expires: u64) -> Result<()> {
        self.events.push("login");
        if self.fail_login {
            Err(Error::new("FIXTURE_TIMEOUT"))
        } else {
            Ok(())
        }
    }
    fn postflight(&mut self) -> Result<AuthMetadata> {
        self.events.push("postflight");
        if self.fail_post {
            Err(Error::new("FIXTURE_RESIDUE"))
        } else {
            Ok(AuthMetadata {
                device: 1,
                inode: 2,
                uid: 612,
                gid: 612,
                mode: 0o600,
                bytes: 10,
            })
        }
    }
}
#[test]
fn fresh_login_once_consumes_intent_and_preserves_unknown_origin() {
    let temp = common::private::temp();
    let roots = FixtureRoots::open(temp.path()).unwrap();
    let area = roots.root.mkdir("first-live-operation").unwrap();
    let mut e = Fixture {
        events: vec![],
        fail_login: false,
        fail_post: false,
    };
    let receipt = execute(&area, &mut e).unwrap();
    assert_eq!(e.events, vec!["preflight", "login", "postflight"]);
    assert_eq!(receipt.len(), 64);
    assert!(execute(&area, &mut e).is_err());
    assert_eq!(e.events.len(), 3);
}

#[test]
fn dedicated_login_census_rejects_residual_reviewer_and_legacy_helpers() {
    let base = format!("100 1 0 Thu Sep 18 12:00:00 2026 {}\n", process::CONTROLLER);
    let mut rows = crate::bootstrap::reviewer_login::parse(&base).unwrap();
    assert_eq!(process::check(&rows, 100).unwrap().pid, 100);
    for (uid, command) in [
        (612, "/usr/local/libexec/agent-deployd/codex"),
        (
            0,
            "/usr/local/libexec/agent-deployd/agent-deploy-login-reconcile",
        ),
        (0, "/usr/local/libexec/agent-deployd/agent-deploy-bootstrap"),
        (0, process::CONTROLLER),
    ] {
        rows.push(crate::bootstrap::reviewer_login::Process {
            pid: 101,
            ppid: 1,
            uid,
            start: "other".into(),
            command: command.into(),
        });
        assert!(process::check(&rows, 100).is_err(), "{command}");
        rows.pop();
    }
    rows[0].uid = 502;
    assert!(process::check(&rows, 100).is_err());
}
#[test]
fn failed_or_unknown_login_never_replenishes_allowance() {
    for (fail_login, fail_post) in [(true, false), (false, true)] {
        let temp = common::private::temp();
        let roots = FixtureRoots::open(temp.path()).unwrap();
        let mut e = Fixture {
            events: vec![],
            fail_login,
            fail_post,
        };
        assert!(execute(&roots.root, &mut e).is_err());
        let old = e.events.clone();
        assert!(execute(&roots.root, &mut e).is_err());
        assert_eq!(e.events, old);
        assert!(roots.root.names().unwrap().contains(&FAILURE.to_string()));
        assert!(!roots.root.names().unwrap().contains(&RESULT.to_string()));
    }
}

#[test]
fn receipt_cannot_upgrade_unknown_or_grant_review_or_activation() {
    for field in [
        "original_provider_outcome",
        "independent_review_pass",
        "activation_allowed",
        "auth",
        "intent",
    ] {
        let t = common::private::temp();
        let r = FixtureRoots::open(t.path()).unwrap();
        let mut e = Fixture {
            events: vec![],
            fail_login: false,
            fail_post: false,
        };
        execute(&r.root, &mut e).unwrap();
        let mut v: serde_json::Value =
            serde_json::from_slice(&raw(&r.root, RESULT).unwrap()).unwrap();
        match field {
            "original_provider_outcome" => v[field] = "PASS".into(),
            "independent_review_pass" | "activation_allowed" => v[field] = true.into(),
            "auth" => v[field]["uid"] = 502.into(),
            _ => v[field]["custody_completion_sha256"] = "a".repeat(64).into(),
        }
        use std::os::unix::fs::PermissionsExt;
        let path = t.path().join(RESULT);
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600)).unwrap();
        std::fs::write(&path, crate::trust::canonical_bytes(&v).unwrap()).unwrap();
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o400)).unwrap();
        assert!(receipt(&r.root).is_err(), "{field}");
    }
}
#[test]
fn native_login_refuses_nonroot_before_fixed_paths_or_login() {
    common::private::nonroot();
    assert_eq!(native::root_required().unwrap_err().code(), "ROOT_REQUIRED");
}
#[path = "login_faults.rs"]
mod faults;

#[test]
fn private_login_readback_binds_root_area_custody_and_auth_inode() {
    let t = common::private::temp();
    let roots = FixtureRoots::open(t.path()).unwrap();
    let area = roots.root.mkdir("first-live-operation").unwrap();
    let mut e = Fixture {
        events: vec![],
        fail_login: false,
        fail_post: false,
    };
    let hash = execute(&area, &mut e).unwrap();
    let receipt = receipt(&area).unwrap();
    let proof = VerifiedLogin {
        receipt_sha256: hash,
        root_identity: identity(&roots.root).unwrap(),
        area_identity: identity(&area).unwrap(),
        receipt,
    };
    let i = &proof.receipt.intent;
    let a = &proof.receipt.auth;
    proof.readback(&roots.root, &area, i, Some(a)).unwrap();
    assert!(proof.readback(&roots.root, &area, i, None).is_err());
    let mut changed = i.clone();
    changed.custody_completion_sha256 = "a".repeat(64);
    assert!(proof
        .readback(&roots.root, &area, &changed, Some(a))
        .is_err());
    changed = i.clone();
    changed.package_digest = "b".repeat(64);
    assert!(proof
        .readback(&roots.root, &area, &changed, Some(a))
        .is_err());
    let mut auth = a.clone();
    auth.inode += 1;
    assert!(proof.readback(&roots.root, &area, i, Some(&auth)).is_err());
    let other = roots.root.mkdir("other").unwrap();
    assert!(proof.readback(&other, &area, i, Some(a)).is_err());
    assert!(proof.readback(&roots.root, &other, i, Some(a)).is_err());
}
