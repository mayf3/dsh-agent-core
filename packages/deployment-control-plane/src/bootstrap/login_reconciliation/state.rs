//! Public bytes may be hashed. Private paths are inspected only through metadata.
use super::*;
use crate::fs::{
    file::{sha, snapshot},
    secure::{read_xattrs, validate},
};
use std::{
    fs::File,
    os::{fd::AsRawFd, unix::fs::MetadataExt},
    path::Path,
};

pub(super) fn metadata(file: &File, uid: u32, gid: u32, mode: u32, nonempty: bool) -> Result<()> {
    validate(file, uid, false)?;
    let m = file.metadata()?;
    require(
        m.uid() == uid && m.gid() == gid && m.mode() & 0o7777 == mode && (!nonempty || m.len() > 0),
        "LOGIN_PRIVATE_METADATA",
    )
}
pub(super) fn private_directory(path: &str, uid: u32, gid: u32) -> Result<Dir> {
    let dir = Dir::open(Path::new(path), uid)?;
    let m = dir.file.metadata()?;
    require(
        m.uid() == uid && m.gid() == gid && m.mode() & 0o7777 == 0o700,
        "LOGIN_PRIVATE_DIRECTORY",
    )?;
    require(
        std::os::macos::fs::MetadataExt::st_flags(&m) == 0,
        "UNSAFE_FLAGS",
    )?;
    read_xattrs(&dir.file)?;
    Ok(dir)
}
pub(super) fn pinned(dir: &Dir, name: &str, expected: &str) -> Result<Vec<u8>> {
    let bytes = super::super::genesis_install_io::read(dir, name, 4 * 1024 * 1024)?;
    require(sha(&bytes) == expected, "LOGIN_PUBLIC_DRIFT")?;
    Ok(bytes)
}
pub(super) fn absent(dir: &Dir, name: &str) -> Result<()> {
    match dir.open_file(name, libc::O_RDONLY, 0) {
        Err(e) if e.code() == "ABSENT" => Ok(()),
        _ => Err(Error::new("LOGIN_UNEXPECTED_PRESENT_PATH")),
    }
}
pub(super) fn lock(dir: &Dir, device: u64, inode: u64, acquire: bool) -> Result<File> {
    // The APFS device number is allocated at boot.  Keep the reviewed genesis
    // value in the signed binding, but bind the live lock to the already-opened
    // protected journal directory's volume on this boot.  The durable inode and
    // every other metadata check remain exact.
    require(device == 16_777_230, "LOGIN_LOCK_BINDING")?;
    let current_device = dir.file.metadata()?.dev();
    let file = dir.open_file("bootstrap.lock", libc::O_RDWR, 0)?;
    metadata(&file, dir.uid, dir.file.metadata()?.gid(), 0o600, false)?;
    let m = file.metadata()?;
    require(
        m.dev() == current_device && m.ino() == inode && m.len() == 0,
        "LOGIN_LOCK_REPLACED",
    )?;
    if acquire {
        require(
            unsafe { libc::flock(file.as_raw_fd(), libc::LOCK_EX | libc::LOCK_NB) } == 0,
            "LOGIN_LOCK_BUSY",
        )?;
    }
    let current = dir
        .open_file("bootstrap.lock", libc::O_RDONLY, 0)?
        .metadata()?;
    require(
        current.dev() == current_device && current.ino() == inode,
        "LOGIN_LOCK_REPLACED",
    )?;
    Ok(file)
}
pub(super) fn executable(path: &str, expected: &str) -> Result<()> {
    let path = Path::new(path);
    let dir = Dir::open(path.parent().ok_or(Error::new("UNSAFE_PATH"))?, 0)?;
    let image = snapshot(
        &dir.open_file(
            path.file_name()
                .unwrap()
                .to_str()
                .ok_or(Error::new("UNSAFE_PATH"))?,
            libc::O_RDONLY,
            0,
        )?,
        0,
        128 * 1024 * 1024,
    )?;
    require(
        image.mode == 0o555 && image.gid == 0 && sha(&image.bytes) == expected,
        "LOGIN_EXECUTABLE_DRIFT",
    )?;
    // Reuse the existing single-image Controller parser at its fixed entry key.
    // This admits only sealed Apple loads; any non-system dependency is missing
    // from this singleton closure and is rejected, independent of actual filename.
    super::super::verify_loader_images(
        super::super::ClosureKind::Controller,
        &std::collections::BTreeMap::from([(
            "/usr/local/libexec/agent-deployd/agent-deployd".into(),
            image.bytes,
        )]),
    )
}
pub(super) fn public_state(b: &binding::Binding, dir: &Dir) -> Result<()> {
    let mut expected = vec![
        "owner-authorization.json",
        "preflight.json",
        "login-intent.json",
        "steps",
        GRANT,
    ];
    if dir.names_bounded(32)?.iter().any(|v| v == INTENT) {
        expected.push(INTENT);
    }
    inventory(dir, &expected)?;
    let steps = dir.child("steps")?;
    let prefix = format!("{ATTEMPT}/steps/");
    let steps_expected: Vec<_> = b
        .public
        .keys()
        .filter_map(|p| p.strip_prefix(&prefix))
        .collect();
    inventory(&steps, &steps_expected)?;
    for (path, digest) in &b.public {
        let p = Path::new(path);
        let parent = Dir::open(p.parent().ok_or(Error::new("UNSAFE_PATH"))?, 0)?;
        pinned(
            &parent,
            p.file_name()
                .unwrap()
                .to_str()
                .ok_or(Error::new("UNSAFE_PATH"))?,
            digest,
        )?;
    }
    let receipt: super::super::GenesisInstallReceipt = serde_json::from_slice(
        &super::super::genesis_install_io::read(dir, "steps/installation.json", 65536)?,
    )?;
    require(
        receipt.state == "INSTALLED_DISABLED_PENDING_OWNER_LOGIN"
            && receipt.plan_digest == b.pins.plan_digest
            && !receipt.activation_allowed
            && !receipt.runtime_enrollment_complete,
        "LOGIN_INSTALLATION_NOT_DISABLED",
    )?;
    let config: crate::service::Configuration = super::super::genesis_install_io::protected_record(
        Path::new("/private/var/db/agent-deployd/service.json"),
    )?;
    require(
        !config.catalog.profiles.is_empty() && config.catalog.profiles.values().all(|p| !p.enabled),
        "LOGIN_PROFILE_ENABLED",
    )?;
    let state = private_directory("/private/var/db/agent-deployd", 0, 0)?;
    for name in ["activation.json", "daemon-activation.json"] {
        absent(&state, name)?;
    }
    absent(
        &Dir::open(Path::new("/private/var/run"), 0)?,
        "agent-deployd",
    )?;
    absent(dir, "login-result.json")?;
    for name in [
        "rollback-intent.json",
        "rollback-result.json",
        "failure.json",
    ] {
        absent(dir, name)?;
    }
    let keys = private_directory("/private/var/db/agent-deployd/issuer-keys", 0, 0)?;
    inventory(
        &keys,
        &[
            "local-authority.json",
            "local-builder.json",
            "local-reviewer.json",
            "local-deployment-registry.json",
            "local-verifier.json",
            "local-recovery.json",
        ],
    )?;
    for name in [
        "local-authority.json",
        "local-builder.json",
        "local-reviewer.json",
        "local-deployment-registry.json",
        "local-verifier.json",
        "local-recovery.json",
    ] {
        // Do not use snapshot/read/hash for these private files.
        metadata(&keys.open_file(name, libc::O_RDONLY, 0)?, 0, 0, 0o600, true)?;
    }
    Ok(())
}
pub(super) fn reviewer(auth_required: bool) -> Result<()> {
    use std::ffi::CStr;
    let mut info: libc::passwd = unsafe { std::mem::zeroed() };
    let mut found = std::ptr::null_mut();
    let mut buffer = vec![0u8; 16384];
    let status = unsafe {
        libc::getpwnam_r(
            c"_dcp_review".as_ptr(),
            &mut info,
            buffer.as_mut_ptr() as *mut _,
            buffer.len(),
            &mut found,
        )
    };
    require(
        status == 0
            && !found.is_null()
            && info.pw_uid == 612
            && info.pw_gid == 612
            && !info.pw_dir.is_null(),
        "LOGIN_REVIEW_IDENTITY",
    )?;
    require(
        unsafe { CStr::from_ptr(info.pw_dir) }.to_bytes()
            == crate::issuer::review::REVIEW_HOME.as_bytes(),
        "LOGIN_REVIEW_IDENTITY",
    )?;
    let home = private_directory(crate::issuer::review::REVIEW_HOME, 612, 612)?;
    if auth_required {
        metadata(
            &home.open_file("auth.json", libc::O_RDONLY, 0)?,
            612,
            612,
            0o600,
            true,
        )
    } else {
        absent(&home, "auth.json")
    }
}
pub(super) fn inventory(dir: &Dir, expected: &[&str]) -> Result<()> {
    let mut names: Vec<String> = expected.iter().map(|v| v.to_string()).collect();
    names.sort();
    require(
        dir.names_bounded(64)? == names,
        "LOGIN_UNEXPECTED_JOURNAL_STATE",
    )
}
