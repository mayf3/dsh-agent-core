mod fixture;
use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
};
const MARKER: &str = "/usr/local/libexec/agent-deployd/enrolled-dsh-runtime";
const PARENT: &str = "/usr/local/libexec/agent-deployd";
const SCRIPTS: [(&str, &str); 4] = [
    ("scripts/trusted-cp-deploy-install.sh", "/bin/bash"),
    (
        "deployment-artifacts/scheduler-watchdog-routing-v1/run-routing-install.mjs",
        "/usr/local/bin/node",
    ),
    (
        "deployment-artifacts/scheduler-watchdog-routing-v1/run-authorized-transaction.sh",
        "/bin/bash",
    ),
    (
        "scripts/production-runtime-launchd.mjs",
        "/usr/local/bin/node",
    ),
];
fn source(path: &str) -> String {
    fs::read_to_string(
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../..")
            .join(path),
    )
    .unwrap()
}
fn relocate(s: &str, parent: &Path) -> String {
    s.replace(MARKER, parent.join("marker").to_str().unwrap())
        .replace(PARENT, parent.to_str().unwrap())
}
fn guard(path: &str, parent: &Path) -> String {
    let s = source(path);
    let block = s
        .split("DCP enrollment guard begin\n")
        .nth(1)
        .unwrap()
        .split("DCP enrollment guard end")
        .next()
        .unwrap();
    // Remove the final comment prefix; execute every actual guard statement.
    let block = block
        .trim_end()
        .trim_end_matches('#')
        .trim_end_matches('/')
        .trim_end_matches('/');
    if path.ends_with(".mjs") {
        format!(
            "import {{lstatSync}} from 'node:fs';\n{}\nconsole.log('LEGACY_REACHED')",
            relocate(block, parent)
        )
    } else {
        format!("{}\necho LEGACY_REACHED", relocate(block, parent))
    }
}
fn invoke(engine: &str, code: &str) -> std::process::Output {
    Command::new(engine)
        .args(if engine.ends_with("node") {
            vec!["--input-type=module", "-e", code]
        } else {
            vec!["-c", code]
        })
        .output()
        .unwrap()
}
#[test]
fn enrolled_legacy_sources_refuse_before_any_effect() {
    let tmp = fixture::temp();
    fs::write(tmp.path().join("marker"), "fixture marker; no authority").unwrap();
    let repo = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .canonicalize()
        .unwrap();
    for (path, engine) in SCRIPTS {
        let fixture = tmp.path().join(path.rsplit('/').next().unwrap());
        let s = relocate(&source(path), tmp.path()).replace(
            "'../../packages/",
            &format!("'{}/packages/", repo.display()),
        );
        fs::write(&fixture, s).unwrap();
        let out = Command::new(engine)
            .arg(&fixture)
            .arg("--apply")
            .output()
            .unwrap();
        assert!(!out.status.success(), "legacy bypass: {path}");
        assert!(
            String::from_utf8_lossy(&out.stderr).contains("agent-deployctl"),
            "{path}: {out:?}"
        );
    }
}
#[test]
fn unreadable_or_caller_owned_parent_denies_but_true_absence_preserves_legacy() {
    use std::os::unix::fs::PermissionsExt;
    let tmp = fixture::temp();
    let parent = tmp.path().join("parent");
    for (path, engine) in SCRIPTS {
        let out = invoke(engine, &guard(path, &parent));
        assert!(out.status.success(), "{path}: {out:?}");
        assert!(String::from_utf8_lossy(&out.stdout).contains("LEGACY_REACHED"));
    }
    fs::create_dir(&parent).unwrap();
    for mode in [0o700, 0o0] {
        fs::set_permissions(&parent, fs::Permissions::from_mode(mode)).unwrap();
        for (path, engine) in SCRIPTS {
            let out = invoke(engine, &guard(path, &parent));
            assert!(!out.status.success(), "unsafe parent allowed: {path}");
            assert!(!String::from_utf8_lossy(&out.stdout).contains("LEGACY_REACHED"));
            assert!(String::from_utf8_lossy(&out.stderr).contains("agent-deployctl"));
        }
    }
    fs::set_permissions(&parent, fs::Permissions::from_mode(0o700)).unwrap();
}
#[test]
fn original_nonroot_lock_selftest_remains_available_before_enrollment() {
    let tmp = fixture::temp();
    let path = tmp.path().join("installer.sh");
    let original = source(SCRIPTS[0].0);
    let stamp = tmp.path().join("stamp-XXXXXX");
    let old_stamp = "mktemp /tmp/trusted-cp-stamp-selftest-XXXXXX";
    assert_eq!(original.matches(old_stamp).count(), 1);
    let private_stamp = format!(
        "mktemp '{}'",
        stamp.to_str().unwrap().replace('\'', "'\\''")
    );
    let copied = original.replace(old_stamp, &private_stamp);
    assert!(!copied.contains(old_stamp));
    assert!(copied.contains(&private_stamp));
    // Only the fixture copy changes; restoring this one literal recovers every source byte.
    assert_eq!(copied.replace(&private_stamp, old_stamp), original);
    fs::write(&path, relocate(&copied, &tmp.path().join("uncreated"))).unwrap();
    let out = Command::new("/bin/bash")
        .arg(path)
        .env("TRUSTED_CP_SELFTEST_LOCK", "1")
        .env("PRODUCTION_DEPLOY_LOCK_DIR", tmp.path().join("lock"))
        .output()
        .unwrap();
    assert!(out.status.success(), "{out:?}");
    assert!(String::from_utf8_lossy(&out.stdout).contains("SELFTEST_LOCK=PASS"));
    // The original cleanup must remove the relocated stamp and lock, leaving only the copy.
    assert_eq!(fs::read_dir(tmp.path()).unwrap().count(), 1);
}
