use super::{
    bundle::{read_package, PLIST},
    loader::*,
    prospective::prospective,
};
use crate::{
    error::require,
    fs::{
        file::{sha, snapshot},
        secure::{relative, Dir},
    },
    trust::{digest, valid_digest},
    Result,
};
use serde::Serialize;
use std::{
    collections::{BTreeMap, BTreeSet},
    path::Path,
};
#[derive(Debug, Serialize)]
pub struct Preflight {
    pub integrity_verified: bool,
    pub bootstrap_ready: bool,
    pub activation_allowed: bool,
    pub preparation_digest: Option<String>,
    pub blockers: Vec<String>,
}
/// Integrity is relative to the reviewer's pinned digests; never a self-authenticating build claim.
pub fn verify_bundle(root: &Path, manifest_digest: &str, source_digest: &str) -> Result<Preflight> {
    require(unsafe { libc::geteuid() } != 0, "PREPARATION_REFUSES_ROOT")?;
    let dir = Dir::open(root, unsafe { libc::geteuid() })?;
    let package = read_package(&dir)?;
    valid_digest(manifest_digest)?;
    valid_digest(source_digest)?;
    require(
        digest(&package)? == manifest_digest
            && package.source_digest == source_digest
            && digest(&package.source_files)? == source_digest,
        "PACKAGE_DIGEST",
    )?;
    require(
        package.source_revision.len() == 40
            && package
                .source_revision
                .bytes()
                .all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase()),
        "SOURCE_REVISION",
    )?;
    require(
        !package.source_files.is_empty() && package.source_files.len() <= 4096,
        "SOURCE_BINDING",
    )?;
    for (name, hash) in &package.source_files {
        relative(name)?;
        valid_digest(hash)?;
    }
    let expected = prospective(
        &package.source_revision,
        package.source_files.clone(),
        package.platform_tools.clone(),
    )?;
    let mut fixed = package.clone();
    fixed.payloads.clear();
    require(fixed == expected, "PROSPECTIVE_PROFILE_CONSTRAINT")?;
    let required_tools: BTreeSet<_> = [
        "/bin/launchctl",
        "/usr/bin/install",
        "/usr/bin/plutil",
        "/usr/bin/openssl",
        "/usr/bin/dscl",
        "/usr/sbin/dseditgroup",
    ]
    .into_iter()
    .map(String::from)
    .collect();
    require(
        package
            .platform_tools
            .keys()
            .cloned()
            .collect::<BTreeSet<_>>()
            == required_tools,
        "PLATFORM_TOOLS",
    )?;
    for hash in package.platform_tools.values() {
        valid_digest(hash)?;
    }
    require(
        (2..=65).contains(&package.payloads.len()),
        "LOADER_CLOSURE_LIMIT",
    )?;
    let mut files = BTreeSet::from([
        "manifest.json".to_string(),
        "ai.agent-deployd.plist".to_string(),
    ]);
    let mut runtime = BTreeMap::new();
    let mut controller = BTreeMap::new();
    let mut total = 0u64;
    for item in &package.payloads {
        crate::fs::secure::component(&item.blob)?;
        require(
            item.blob.starts_with("payload-")
                && files.insert(item.blob.clone())
                && item.mode == 0o555,
            "PACKAGE_PAYLOAD",
        )?;
        let image = snapshot(
            &dir.open_file(&item.blob, libc::O_RDONLY, 0)?,
            dir.uid,
            MAX_LOADER_FILE,
        )?;
        total += image.bytes.len() as u64;
        require(
            total <= MAX_LOADER_TOTAL
                && image.bytes.len() as u64 == item.size
                && sha(&image.bytes) == item.sha256,
            "PACKAGE_PAYLOAD_DIGEST",
        )?;
        let target = if item.destination == "/usr/local/libexec/agent-deployd/agent-deployd" {
            &mut controller
        } else {
            &mut runtime
        };
        require(
            target
                .insert(item.destination.clone(), image.bytes)
                .is_none(),
            "LOADER_DUPLICATE",
        )?;
    }
    require(
        dir.names()?.into_iter().collect::<BTreeSet<_>>() == files,
        "UNDECLARED_PACKAGE_FILE",
    )?;
    require(
        snapshot(
            &dir.open_file("ai.agent-deployd.plist", libc::O_RDONLY, 0)?,
            dir.uid,
            16384,
        )?
        .bytes
            == PLIST.as_bytes(),
        "DISABLED_PLIST_REQUIRED",
    )?;
    verify_loader_images(ClosureKind::Controller, &controller)?;
    verify_loader_images(ClosureKind::Runtime, &runtime)?;
    Ok(Preflight {
        integrity_verified: true,
        bootstrap_ready: false,
        activation_allowed: false,
        preparation_digest: None,
        blockers: package.unresolved,
    })
}
/// Re-read a local source checkout against every reviewed file digest without running source.
pub fn verify_sources(root: &Path, checkout: &Path) -> Result<()> {
    require(unsafe { libc::geteuid() } != 0, "PREPARATION_REFUSES_ROOT")?;
    let uid = unsafe { libc::geteuid() };
    let package = read_package(&Dir::open(root, uid)?)?;
    // Source is nonprivileged input, not a privileged executable root. Pin the
    // checkout FD and traverse all descendants without links; do not require
    // the user's home ancestors to lose their harmless deny-delete ACLs.
    use std::os::unix::fs::OpenOptionsExt;
    let file = std::fs::OpenOptions::new()
        .read(true)
        .custom_flags(libc::O_DIRECTORY | libc::O_NOFOLLOW | libc::O_CLOEXEC)
        .open(checkout)?;
    crate::fs::secure::validate(&file, uid, true)?;
    let source = Dir { file, uid };
    for (path, expected) in &package.source_files {
        let parts = relative(path)?;
        let mut dir = Dir {
            file: source.file.try_clone()?,
            uid,
        };
        for part in &parts[..parts.len() - 1] {
            dir = dir.child(part)?;
        }
        let bytes = snapshot(
            &dir.open_file(parts.last().unwrap(), libc::O_RDONLY, 0)?,
            uid,
            MAX_LOADER_FILE,
        )?
        .bytes;
        require(sha(&bytes) == *expected, "SOURCE_DIGEST")?;
    }
    Ok(())
}
