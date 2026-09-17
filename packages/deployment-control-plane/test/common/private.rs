use deployment_control_plane::{fs::FixtureRoots, Error, Result};
use std::{
    os::unix::fs::PermissionsExt,
    path::{Path, PathBuf},
};

// Every effectful fixture test enters through this guard before reading or writing fixtures.
pub fn nonroot() {
    with_uid(unsafe { libc::geteuid() }, || Ok(())).unwrap();
}
fn with_uid<T>(uid: u32, effect: impl FnOnce() -> Result<T>) -> Result<T> {
    if uid == 0 {
        return Err(Error::new("FIXTURE_REFUSES_ROOT"));
    }
    effect()
}
fn kernel_temp() -> Result<PathBuf> {
    FixtureRoots::kernel_temp()
}
fn temp_in(base: &Path) -> Result<tempfile::TempDir> {
    with_uid(unsafe { libc::geteuid() }, || {
        // Reject outside/aliased bases before creating anything; never consult TMPDIR.
        if base != kernel_temp()? {
            return Err(Error::new("FIXTURE_OUTSIDE_TEMP"));
        }
        let d = tempfile::Builder::new()
            .prefix("dcp-fixture-")
            .permissions(std::fs::Permissions::from_mode(0o700))
            .tempdir_in(base)?;
        FixtureRoots::open(d.path())?;
        Ok(d)
    })
}
pub fn temp() -> tempfile::TempDir {
    nonroot();
    temp_in(&kernel_temp().unwrap()).unwrap()
}

#[test]
fn root_refusal_precedes_effect_without_root_execution() {
    let reached = std::cell::Cell::new(false);
    let result = with_uid(0, || {
        reached.set(true);
        Ok(())
    });
    assert_eq!(result.unwrap_err().code(), "FIXTURE_REFUSES_ROOT");
    assert!(!reached.get());
}
#[test]
fn outside_kernel_temp_is_rejected_before_creation() {
    nonroot();
    // No outside directory is created or opened. This is the review counterexample's base.
    assert_eq!(
        temp_in(Path::new("/private/tmp")).unwrap_err().code(),
        "FIXTURE_OUTSIDE_TEMP"
    );
}
#[test]
fn kernel_selected_temp_ignores_caller_tmpdir() {
    let d = temp();
    assert!(d.path().starts_with(kernel_temp().unwrap()));
    FixtureRoots::open(d.path()).unwrap();
}

#[test]
fn hostile_tmpdir_worker() {
    if std::env::var("DCP_PRIVATE_WORKER").is_err() {
        return;
    }
    let fixture = temp();
    assert!(fixture.path().starts_with(kernel_temp().unwrap()));
    assert_eq!(
        std::fs::metadata(fixture.path())
            .unwrap()
            .permissions()
            .mode()
            & 0o777,
        0o700
    );
}
#[test]
fn hostile_tmpdir_is_ignored_before_first_fixture_effect() {
    nonroot();
    let status = std::process::Command::new(std::env::current_exe().unwrap())
        .args(["hostile_tmpdir_worker", "--test-threads=1"])
        .env("DCP_PRIVATE_WORKER", "1")
        .env("TMPDIR", "/private/tmp/dcp-disallowed-fixture-root")
        .output()
        .unwrap();
    assert!(
        status.status.success(),
        "{}",
        String::from_utf8_lossy(&status.stderr)
    );
}
