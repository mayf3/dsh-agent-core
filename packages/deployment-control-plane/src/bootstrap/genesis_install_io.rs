//! Package inputs are data only; every descendant is opened relative to a held directory.
use super::*;
use crate::{
    error::require,
    fs::{
        file::{sha, snapshot},
        secure::{relative, validate, Dir},
    },
    Error, Result,
};
use std::{
    collections::{BTreeMap, BTreeSet},
    fs::OpenOptions,
    os::unix::fs::{MetadataExt, OpenOptionsExt},
    path::Path,
};

pub fn load_genesis_package(
    path: &Path,
    pins: &GenesisPins,
) -> Result<(GenesisPlan, GenesisArtifacts)> {
    let file = OpenOptions::new()
        .read(true)
        .custom_flags(libc::O_DIRECTORY | libc::O_NOFOLLOW | libc::O_CLOEXEC)
        .open(path)?;
    let uid = file.metadata()?.uid();
    let caller = unsafe { libc::geteuid() };
    require(
        if caller == 0 {
            uid == 0 || uid == 502
        } else {
            uid == caller
        },
        "UNSAFE_OWNER",
    )?;
    validate(&file, uid, true)?;
    let root = Dir { file, uid };
    let plan: GenesisPlan = serde_json::from_slice(&read(&root, "plan.json", 4 * 1024 * 1024)?)?;
    validate_genesis_plan(&plan, pins)?;
    let mut expected = BTreeSet::from([
        "plan.json".into(),
        "package.json".into(),
        "review-record".into(),
        "initial-registry.json".into(),
        "supervisor-policy.json".into(),
    ]);
    let mut sources = BTreeMap::new();
    let mut executables = BTreeMap::new();
    let mut support_files = BTreeMap::new();
    for (prefix, hashes, target, limit) in [
        (
            "sources",
            &plan.source_files,
            &mut sources,
            16 * 1024 * 1024,
        ),
        (
            "executables",
            &plan.executables,
            &mut executables,
            512 * 1024 * 1024,
        ),
        (
            "support",
            &plan.support_files,
            &mut support_files,
            1024 * 1024,
        ),
    ] {
        let mut total = 0usize;
        for path in hashes.keys() {
            let suffix = if prefix == "sources" {
                path.as_str()
            } else {
                Path::new(path)
                    .file_name()
                    .and_then(|v| v.to_str())
                    .ok_or(Error::new("UNSAFE_PATH"))?
            };
            let name = format!("{prefix}/{suffix}");
            expected.insert(name.clone());
            let bytes = read(&root, &name, limit)?;
            total = total
                .checked_add(bytes.len())
                .ok_or(Error::new("SIZE_LIMIT"))?;
            require(
                total
                    <= if prefix == "executables" {
                        1024 * 1024 * 1024
                    } else {
                        256 * 1024 * 1024
                    },
                "SIZE_LIMIT",
            )?;
            target.insert(path.clone(), bytes);
        }
    }
    let artifacts = GenesisArtifacts {
        package_manifest: read(&root, "package.json", 4 * 1024 * 1024)?,
        review_record: read(&root, "review-record", 16 * 1024 * 1024)?,
        initial_registry: read(&root, "initial-registry.json", 16 * 1024 * 1024)?,
        supervisor_policy: read(&root, "supervisor-policy.json", 16 * 1024 * 1024)?,
        sources,
        executables,
        support_files,
    };
    inventory(&root, "", &expected, 0)?;
    super::genesis::verify_genesis_artifact_bytes(&plan, pins, &artifacts)?;
    Ok((plan, artifacts))
}
pub(crate) fn read(root: &Dir, path: &str, limit: u64) -> Result<Vec<u8>> {
    let parts = relative(path)?;
    let mut dir = Dir {
        file: root.file.try_clone()?,
        uid: root.uid,
    };
    for part in &parts[..parts.len() - 1] {
        dir = dir.child(part)?;
    }
    Ok(snapshot(
        &dir.open_file(parts.last().unwrap(), libc::O_RDONLY, 0)?,
        root.uid,
        limit,
    )?
    .bytes)
}
fn inventory(root: &Dir, prefix: &str, expected: &BTreeSet<String>, depth: usize) -> Result<()> {
    require(depth <= 12, "SIZE_LIMIT")?;
    for name in root.names_bounded(4096)? {
        let path = format!("{prefix}{name}");
        if expected.contains(&path) {
            continue;
        }
        let child = format!("{path}/");
        require(
            expected.iter().any(|n| n.starts_with(&child)),
            "UNDECLARED_PACKAGE_FILE",
        )?;
        inventory(&root.child(&name)?, &child, expected, depth + 1)?;
    }
    Ok(())
}
pub(crate) fn protected_record<T: serde::de::DeserializeOwned>(path: &Path) -> Result<T> {
    let parent = path.parent().ok_or(Error::new("UNSAFE_PATH"))?;
    let name = path
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or(Error::new("UNSAFE_PATH"))?;
    let dir = Dir::open(parent, 0)?;
    let image = snapshot(&dir.open_file(name, libc::O_RDONLY, 0)?, 0, 4 * 1024 * 1024)?;
    require(
        image.mode == 0o600 && image.gid == 0,
        "BOOTSTRAP_AUTHORIZATION_METADATA",
    )?;
    Ok(serde_json::from_slice(&image.bytes)?)
}
pub(crate) fn hash_protected(path: &str, limit: u64) -> Result<String> {
    let path = Path::new(path);
    let dir = Dir::open(path.parent().ok_or(Error::new("UNSAFE_PATH"))?, 0)?;
    Ok(sha(&read(
        &dir,
        path.file_name()
            .and_then(|n| n.to_str())
            .ok_or(Error::new("UNSAFE_PATH"))?,
        limit,
    )?))
}
