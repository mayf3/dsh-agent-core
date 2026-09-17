use deployment_control_plane::{fs::FixtureRoots, Error, Result};
use std::{
    os::unix::fs::PermissionsExt,
    path::{Path, PathBuf},
};

// Every effectful adoption test enters through this guard before reading or writing fixtures.
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
    let mut buffer = [0i8; 4096];
    let length = unsafe {
        libc::confstr(
            libc::_CS_DARWIN_USER_TEMP_DIR,
            buffer.as_mut_ptr(),
            buffer.len(),
        )
    };
    if length == 0 || length > buffer.len() {
        return Err(Error::new("FIXTURE_TEMP_UNAVAILABLE"));
    }
    let path = unsafe { std::ffi::CStr::from_ptr(buffer.as_ptr()) }
        .to_str()
        .map_err(|_| Error::new("FIXTURE_TEMP_UNAVAILABLE"))?;
    Ok(std::fs::canonicalize(path)?)
}
fn temp_in(base: &Path) -> Result<tempfile::TempDir> {
    with_uid(unsafe { libc::geteuid() }, || {
        // Reject outside/aliased bases before creating anything; never consult TMPDIR.
        if base != kernel_temp()? {
            return Err(Error::new("FIXTURE_OUTSIDE_TEMP"));
        }
        let d = tempfile::Builder::new()
            .prefix("dcp-adoption-")
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
