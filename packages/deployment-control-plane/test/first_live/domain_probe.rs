use super::*;
use crate::fs::FixtureRoots;
use std::os::unix::fs::PermissionsExt;
const NAME: &str = "lifecycle-denial-probe.plist";
fn absent() -> Output {
    Output{code:Some(113),stdout:String::new(),stderr:"Bad request.\nCould not find service \"ai.agent-deployd.lifecycle-denial-probe\" in domain for system\n".into()}
}
fn readable() -> Output {
    Output {
        code: Some(0),
        stdout: "/usr/local/libexec/agent-deployd/lifecycle-denial-probe.plist: OK\n".into(),
        stderr: String::new(),
    }
}
fn denied() -> Output {
    Output {
        code: Some(1),
        stdout: String::new(),
        stderr: "Bootstrap failed: 1: Operation not permitted\n".into(),
    }
}
fn ok() -> Output {
    Output {
        code: Some(0),
        stdout: String::new(),
        stderr: String::new(),
    }
}
fn loaded() -> Output {
    Output{code:Some(0),stdout:"system/ai.agent-deployd.lifecycle-denial-probe = {\n\tpath = /usr/local/libexec/agent-deployd/lifecycle-denial-probe.plist\n\tprogram = /usr/bin/true\n\tstate = not running\n\truns = 0\n}\n".into(),stderr:String::new()}
}
fn fixture() -> (tempfile::TempDir, FixtureRoots, Dir) {
    let t = crate::common::private::temp();
    let r = FixtureRoots::open(t.path()).unwrap();
    let p = r.root.mkdir("public").unwrap();
    std::fs::set_permissions(
        t.path().join("public"),
        std::fs::Permissions::from_mode(0o755),
    )
    .unwrap();
    (t, r, p)
}
#[test]
fn readable_exact_probe_explicit_denial_and_absence_close_with_owned_cleanup() {
    let (t, r, p) = fixture();
    let mut calls = Vec::new();
    let proof = sequence(&r.root, &p, "fixture", |action| {
        calls.push(action);
        Ok(match action {
            Action::Before | Action::After => absent(),
            Action::Readable => readable(),
            Action::Bootstrap => denied(),
            _ => panic!("unexpected"),
        })
    })
    .unwrap();
    assert_eq!(
        calls,
        vec![
            Action::Before,
            Action::Readable,
            Action::Bootstrap,
            Action::After
        ]
    );
    assert_eq!(proof.len(), 64);
    assert!(!t.path().join("public").join(NAME).exists());
    assert!(t.path().join("domain-probe-file-result.json").exists());
    assert!(t.path().join("domain-probe-cleanup-result.json").exists());
}
#[test]
fn absent_label_or_unreadable_input_is_not_domain_denial() {
    for wrong in [
        absent(),
        Output {
            code: Some(5),
            stdout: String::new(),
            stderr: "Input/output error".into(),
        },
        Output {
            code: Some(1),
            stdout: String::new(),
            stderr: "Permission denied: No such file".into(),
        },
    ] {
        let (t, r, p) = fixture();
        let mut result = Some(wrong);
        assert!(sequence(&r.root, &p, "fixture", |a| Ok(match a {
            Action::Before | Action::After => absent(),
            Action::Readable => readable(),
            Action::Bootstrap => result.take().unwrap(),
            _ => panic!("unexpected"),
        }))
        .is_err());
        assert!(t.path().join("public").join(NAME).exists());
    }
}
#[test]
fn unreadable_probe_never_reaches_bootstrap() {
    let (t, r, p) = fixture();
    let mut calls = Vec::new();
    assert!(sequence(&r.root, &p, "fixture", |a| {
        calls.push(a);
        Ok(match a {
            Action::Before => absent(),
            Action::Readable => Output {
                code: Some(1),
                stdout: String::new(),
                stderr: "Permission denied".into(),
            },
            _ => panic!("unexpected mutation"),
        })
    })
    .is_err());
    assert_eq!(calls, vec![Action::Before, Action::Readable]);
    assert!(t.path().join("public").join(NAME).exists());
}
#[test]
fn unexpected_exact_loaded_probe_is_cleaned_but_remains_failed() {
    let (t, r, p) = fixture();
    let mut calls = Vec::new();
    assert!(sequence(&r.root, &p, "fixture", |a| {
        calls.push(a);
        Ok(match a {
            Action::Before | Action::Recovered => absent(),
            Action::Readable => readable(),
            Action::Bootstrap | Action::Cleanup => ok(),
            Action::After => loaded(),
        })
    })
    .is_err());
    assert_eq!(
        calls,
        vec![
            Action::Before,
            Action::Readable,
            Action::Bootstrap,
            Action::After,
            Action::Cleanup,
            Action::Recovered
        ]
    );
    assert!(!t.path().join("public").join(NAME).exists());
    assert!(t.path().join("domain-probe-unexpected.json").exists());
}
#[test]
fn unknown_bootstrap_leaves_public_file_and_never_attempts_cleanup() {
    let (t, r, p) = fixture();
    let mut calls = Vec::new();
    assert!(sequence(&r.root, &p, "fixture", |a| {
        calls.push(a);
        match a {
            Action::Before => Ok(absent()),
            Action::Readable => Ok(readable()),
            Action::Bootstrap => Err(Error::new("FIXTURE_UNKNOWN")),
            _ => panic!("blind cleanup"),
        }
    })
    .is_err());
    assert_eq!(
        calls,
        vec![Action::Before, Action::Readable, Action::Bootstrap]
    );
    assert!(t.path().join("public").join(NAME).exists());
}
#[test]
fn ambiguous_loaded_label_cannot_authorize_bootout_or_delete() {
    let (t, r, p) = fixture();
    assert!(sequence(&r.root, &p, "fixture", |a| Ok(match a {
        Action::Before => absent(),
        Action::Readable => readable(),
        Action::Bootstrap => ok(),
        Action::After => {
            let mut x = loaded();
            x.stdout = x.stdout.replace("/usr/bin/true", "/bin/sh");
            x
        }
        _ => panic!("unproven cleanup"),
    }))
    .is_err());
    assert!(t.path().join("public").join(NAME).exists());
}
#[test]
fn existing_foreign_file_or_prior_attempt_cannot_be_reused() {
    let (t, r, p) = fixture();
    std::fs::write(t.path().join("public").join(NAME), b"foreign").unwrap();
    assert!(sequence(&r.root, &p, "fixture", |_| panic!("foreign state")).is_err());
    assert_eq!(
        std::fs::read(t.path().join("public").join(NAME)).unwrap(),
        b"foreign"
    );
}
#[test]
fn post_probe_inode_replacement_is_retained() {
    let (t, r, p) = fixture();
    let path = t.path().join("public").join(NAME);
    assert!(sequence(&r.root, &p, "fixture", |a| Ok(match a {
        Action::Before => absent(),
        Action::Readable => readable(),
        Action::Bootstrap => denied(),
        Action::After => {
            std::fs::rename(&path, path.with_extension("old")).unwrap();
            std::fs::write(&path, b"foreign").unwrap();
            absent()
        }
        _ => panic!("unexpected"),
    }))
    .is_err());
    assert_eq!(std::fs::read(&path).unwrap(), b"foreign");
}

#[test]
fn fixed_plist_is_valid_and_contains_only_the_inert_contract() {
    let (t, _r, p) = fixture();
    let path = t.path().join("public").join(NAME);
    std::fs::write(&path, PLIST).unwrap();
    let output = std::process::Command::new("/usr/bin/plutil")
        .args(["-lint", path.to_str().unwrap()])
        .output()
        .unwrap();
    assert!(output.status.success());
    assert!(output.stderr.is_empty());
    assert_eq!(
        String::from_utf8(output.stdout).unwrap(),
        format!("{}: OK\n", path.display())
    );
    let output = std::process::Command::new("/usr/bin/plutil")
        .args(["-convert", "json", "-o", "-", path.to_str().unwrap()])
        .output()
        .unwrap();
    assert!(output.status.success());
    assert_eq!(
        serde_json::from_slice::<serde_json::Value>(&output.stdout).unwrap(),
        serde_json::json!({"Label":"ai.agent-deployd.lifecycle-denial-probe","ProgramArguments":["/usr/bin/true"],"UserName":"authsvc","GroupName":"authsvc","RunAtLoad":false,"KeepAlive":false})
    );
    assert_eq!(
        p.file.metadata().unwrap().permissions().mode() & 0o7777,
        0o755
    );
}
#[test]
fn missing_bootstrap_exit_status_is_unknown_before_any_recovery() {
    let (t, r, p) = fixture();
    let mut calls = Vec::new();
    assert!(sequence(&r.root, &p, "fixture", |a| {
        calls.push(a);
        Ok(match a {
            Action::Before => absent(),
            Action::Readable => readable(),
            Action::Bootstrap => Output {
                code: None,
                stdout: String::new(),
                stderr: String::new(),
            },
            _ => panic!("unknown must stop"),
        })
    })
    .is_err());
    assert_eq!(
        calls,
        vec![Action::Before, Action::Readable, Action::Bootstrap]
    );
    assert!(t.path().join("public").join(NAME).exists());
}
#[test]
fn consumed_successful_probe_attempt_cannot_bootstrap_again() {
    let (_t, r, p) = fixture();
    sequence(&r.root, &p, "fixture", |a| {
        Ok(match a {
            Action::Before | Action::After => absent(),
            Action::Readable => readable(),
            Action::Bootstrap => denied(),
            _ => panic!("unexpected"),
        })
    })
    .unwrap();
    let mut calls = Vec::new();
    assert!(sequence(&r.root, &p, "fixture", |a| {
        calls.push(a);
        assert_eq!(a, Action::Before);
        Ok(absent())
    })
    .is_err());
    assert_eq!(calls, vec![Action::Before]);
}
#[test]
fn failed_owned_cleanup_cannot_remove_file_or_become_pass() {
    let (t, r, p) = fixture();
    assert!(sequence(&r.root, &p, "fixture", |a| Ok(match a {
        Action::Before => absent(),
        Action::Readable => readable(),
        Action::Bootstrap => ok(),
        Action::After => loaded(),
        Action::Cleanup => denied(),
        _ => panic!("cleanup failed"),
    }))
    .is_err());
    assert!(t.path().join("public").join(NAME).exists());
    assert!(t.path().join("domain-probe-unexpected.json").exists());
}
