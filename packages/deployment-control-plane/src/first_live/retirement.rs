use crate::{
    error::require,
    fs::{
        file::{sha, snapshot, write_new},
        secure::Dir,
    },
    Result,
};
use std::{collections::BTreeMap, os::unix::fs::MetadataExt, path::Path};
pub(super) const LEGACY: [&str; 3] = [
    "/usr/local/libexec/lw-pilot-executor",
    "/usr/local/libexec/agent-core/app/scripts/trusted-cp-deploy-install.sh",
    "/usr/local/libexec/agent-core/app/scripts/production-runtime-launchd.mjs",
];
pub(super) const ABSENT: [&str; 2] = [
    "deployment-artifacts/scheduler-watchdog-routing-v1/run-routing-install.mjs",
    "deployment-artifacts/scheduler-watchdog-routing-v1/run-authorized-transaction.sh",
];
#[derive(Clone, Copy)]
pub(super) enum EntryKind {
    Native,
    Shell,
    Javascript,
}
pub(super) fn kind(path: &str) -> Result<EntryKind> {
    match path {
        p if p == LEGACY[0] => Ok(EntryKind::Native),
        p if p == LEGACY[1] => Ok(EntryKind::Shell),
        p if p == LEGACY[2] => Ok(EntryKind::Javascript),
        _ => Err(crate::Error::new("FIRST_LIVE_LEGACY_SET")),
    }
}
pub(super) const SHELL:&[u8]=b"#!/bin/sh\nprintf '%s\\n' 'Legacy deployment entry retired; use agent-deployctl.' >&2\nexit 64\n";
pub(super) const JS:&[u8]=b"process.stderr.write('Legacy deployment entry retired; use agent-deployctl.\\n'); process.exit(64);\n";
pub(super) fn payload(kind: EntryKind, native: &[u8]) -> &[u8] {
    match kind {
        EntryKind::Native => native,
        EntryKind::Shell => SHELL,
        EntryKind::Javascript => JS,
    }
}
pub(super) fn validate_set(expected: &BTreeMap<String, String>) -> Result<()> {
    require(
        expected.len() == LEGACY.len() && LEGACY.iter().all(|p| expected.contains_key(*p)),
        "FIRST_LIVE_LEGACY_SET",
    )?;
    for value in expected.values() {
        crate::trust::valid_digest(value)?;
    }
    Ok(())
}
pub(super) fn apply(
    packet: &Dir,
    history: &Dir,
    expected: &BTreeMap<String, String>,
    native_hash: &str,
    guard: &crate::fs::MutationGuard,
    expires: u64,
) -> Result<BTreeMap<String, String>> {
    guard.binds(&Dir::open(Path::new(crate::issuer::custody::ROOT), 0)?)?;
    require(super::compose::now()? < expires, "FIRST_LIVE_EXPIRED")?;
    validate_set(expected)?;
    let binary = snapshot(
        &packet
            .child("payloads")?
            .open_file(native_hash, libc::O_RDONLY, 0)?,
        0,
        128 * 1024 * 1024,
    )?
    .bytes;
    require(sha(&binary) == native_hash, "FIRST_LIVE_RETIREMENT_BINARY")?;
    let mut output = BTreeMap::new();
    for (i, path) in LEGACY.iter().enumerate() {
        require(super::compose::now()? < expires, "FIRST_LIVE_EXPIRED")?;
        let path = Path::new(path);
        let name = path.file_name().unwrap().to_str().unwrap();
        // Fixed legacy app parents may still be service-owned at this stage; pin opened ancestry.
        let parent = super::native_tree::open_parent(path)?;
        let file = parent.open_file(name, libc::O_RDONLY, 0)?;
        let uid = file.metadata()?.uid();
        let old = snapshot(&file, uid, 16 * 1024 * 1024)?;
        require(
            sha(&old.bytes) == expected[*LEGACY.get(i).unwrap()],
            "FIRST_LIVE_LEGACY_DRIFT",
        )?;
        super::files::publish(history, &format!("legacy-{i}-preimage.json"), &old)?;
        let bytes = payload(kind(LEGACY[i])?, &binary);
        let temp = format!("{name}.dcp-retired");
        super::files::publish(
            history,
            &format!("legacy-{i}-intent.json"),
            &serde_json::json!({"path":LEGACY[i],"preimage":expected[LEGACY[i]],"post_sha256":sha(bytes)}),
        )?;
        require(super::compose::now()? < expires, "FIRST_LIVE_EXPIRED")?;
        write_new(&parent, &temp, bytes, 0, 0, 0o555)?;
        require(
            sha(&snapshot(
                &parent.open_file(name, libc::O_RDONLY, 0)?,
                uid,
                16 * 1024 * 1024,
            )?
            .bytes)
                == expected[*LEGACY.get(i).unwrap()],
            "FIRST_LIVE_LEGACY_DRIFT",
        )?;
        require(super::compose::now()? < expires, "FIRST_LIVE_EXPIRED")?;
        parent.rename(&temp, &parent, name)?;
        let after = snapshot(
            &parent.open_file(name, libc::O_RDONLY, 0)?,
            0,
            16 * 1024 * 1024,
        )?;
        require(after.bytes == bytes, "FIRST_LIVE_LEGACY_READBACK")?;
        require(super::compose::now()? < expires, "FIRST_LIVE_EXPIRED")?;
        super::files::publish(
            history,
            &format!("legacy-{i}-result.json"),
            &serde_json::json!({"path":LEGACY[i],"sha256":sha(bytes),"device":after.device,"inode":after.inode}),
        )?;
        output.insert(LEGACY[i].into(), sha(bytes));
    }
    Ok(output)
}

pub(super) fn absent_sources(
    app: &Dir,
    entries: &BTreeMap<String, super::inventory::Entry>,
) -> Result<serde_json::Value> {
    // The actual frozen tree lacks the first component of BOTH exact paths.
    // A new file, directory, or even dangling symlink at that name is drift.
    require(
        !entries
            .keys()
            .any(|p| p == "deployment-artifacts" || p.starts_with("deployment-artifacts/")),
        "FIRST_LIVE_LEGACY_ABSENCE",
    )?;
    let before = app.file.metadata()?;
    let mut st: libc::stat = unsafe { std::mem::zeroed() };
    let result = unsafe {
        libc::fstatat(
            std::os::fd::AsRawFd::as_raw_fd(&app.file),
            c"deployment-artifacts".as_ptr(),
            &mut st,
            libc::AT_SYMLINK_NOFOLLOW,
        )
    };
    require(
        result == -1 && std::io::Error::last_os_error().raw_os_error() == Some(libc::ENOENT),
        "FIRST_LIVE_LEGACY_ABSENCE",
    )?;
    let after = app.file.metadata()?;
    require(
        before.dev() == after.dev() && before.ino() == after.ino(),
        "FIRST_LIVE_LEGACY_ABSENCE",
    )?;
    Ok(
        serde_json::json!({"app_device":before.dev(),"app_inode":before.ino(),"first_missing":"deployment-artifacts","expected_absent":ABSENT}),
    )
}
