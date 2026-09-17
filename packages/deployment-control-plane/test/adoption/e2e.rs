use std::{fs, path::PathBuf, process::Command};
const MARKER: &str = "/usr/local/libexec/agent-deployd/enrolled-dsh-runtime";
#[test]
fn enrolled_legacy_sources_refuse_before_any_effect() {
    assert_ne!(unsafe { libc::geteuid() }, 0);
    let repo = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..");
    let tmp = tempfile::tempdir().unwrap();
    let marker = tmp.path().join("enrolled");
    fs::write(&marker, "fixture marker; no authority").unwrap();
    for (path, engine) in [
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
    ] {
        let source = fs::read_to_string(repo.join(path)).unwrap();
        assert!(
            source.contains(MARKER),
            "unguarded canonical entrance: {path}"
        );
        // Exact source, only literal fixed marker relocated into private fixture.
        // No production marker path override is added to any shipped source.
        let fixture = tmp.path().join(path.rsplit('/').next().unwrap());
        fs::write(
            &fixture,
            source
                .replace(MARKER, marker.to_str().unwrap())
                .replace(
                    "/usr/local/libexec/agent-deployd'",
                    &format!("{}'", tmp.path().display()),
                )
                .replace(
                    "'../../packages/",
                    &format!("'{}/packages/", repo.canonicalize().unwrap().display()),
                ),
        )
        .unwrap();
        let out = Command::new(engine)
            .arg(fixture)
            .arg("--apply")
            .output()
            .unwrap();
        assert!(!out.status.success(), "legacy bypass: {path}");
        assert!(
            String::from_utf8_lossy(&out.stderr).contains("agent-deployctl"),
            "{path}: {:?}",
            out
        );
    }
}
#[test]
fn ambiguous_marker_lookup_never_enters_legacy_logic() {
    let repo = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..");
    let tmp = tempfile::tempdir().unwrap();
    let denied = tmp.path().join("denied");
    fs::create_dir(&denied).unwrap();
    use std::os::unix::fs::PermissionsExt;
    fs::set_permissions(&denied, fs::Permissions::from_mode(0o0)).unwrap();
    for path in [
        "scripts/trusted-cp-deploy-install.sh",
        "deployment-artifacts/scheduler-watchdog-routing-v1/run-authorized-transaction.sh",
    ] {
        let source = fs::read_to_string(repo.join(path)).unwrap();
        let guard = source
            .lines()
            .find(|l| {
                l.starts_with("if [ -e /usr/local/libexec/agent-deployd/enrolled-dsh-runtime")
            })
            .unwrap();
        let code = format!(
            "{}\necho LEGACY_REACHED",
            guard.replace(MARKER, denied.join("marker").to_str().unwrap())
        );
        let out = Command::new("/bin/bash")
            .args(["-c", &code])
            .output()
            .unwrap();
        assert!(
            !String::from_utf8_lossy(&out.stdout).contains("LEGACY_REACHED"),
            "EACCES bypass: {path}"
        );
    }
    fs::set_permissions(&denied, fs::Permissions::from_mode(0o700)).unwrap();
}

#[test]
fn caller_owned_marker_parent_is_not_prebootstrap_absence() {
    let repo = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..");
    let tmp = tempfile::tempdir().unwrap();
    for path in [
        "scripts/trusted-cp-deploy-install.sh",
        "deployment-artifacts/scheduler-watchdog-routing-v1/run-authorized-transaction.sh",
    ] {
        let source = fs::read_to_string(repo.join(path)).unwrap();
        let guard = source
            .lines()
            .find(|l| {
                l.starts_with("if [ -e /usr/local/libexec/agent-deployd/enrolled-dsh-runtime")
            })
            .unwrap();
        let marker = tmp.path().join("absent-marker");
        let code = format!(
            "{}\necho LEGACY_REACHED",
            guard.replace(MARKER, marker.to_str().unwrap())
        );
        let out = Command::new("/bin/bash")
            .args(["-c", &code])
            .output()
            .unwrap();
        assert!(
            !String::from_utf8_lossy(&out.stdout).contains("LEGACY_REACHED"),
            "unsafe parent bypass: {path}"
        );
    }
}
