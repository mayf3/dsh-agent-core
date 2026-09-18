//! Exact existing public leaves; denial alone does not establish their existence or identity.
use crate::{
    fs::{
        file::{sha, snapshot},
        secure::Dir,
    },
    Result,
};
use std::{collections::BTreeMap, path::Path};
#[derive(Debug, Clone, serde::Serialize, PartialEq, Eq)]
pub(super) struct Leaf {
    sha256: String,
    device: u64,
    inode: u64,
    uid: u32,
    gid: u32,
    mode: u32,
    size: usize,
    xattrs: BTreeMap<String, Vec<u8>>,
    mtime_seconds: i64,
    mtime_nanos: i64,
}
pub(super) fn capture_one(dir: &Dir, name: &str) -> Result<Leaf> {
    let file = dir.open_file(name, libc::O_RDONLY, 0)?;
    let image = snapshot(&file, dir.uid, 128 * 1024 * 1024)?;
    Ok(Leaf {
        sha256: sha(&image.bytes),
        device: image.device,
        inode: image.inode,
        uid: image.uid,
        gid: image.gid,
        mode: image.mode,
        size: image.bytes.len(),
        xattrs: image.xattrs,
        mtime_seconds: image.mtime_seconds,
        mtime_nanos: image.mtime_nanos,
    })
}
pub(super) fn capture() -> Result<BTreeMap<String, Leaf>> {
    let mut result = BTreeMap::new();
    let mut paths = vec![
        "/private/var/db/agent-deployd/service.json",
        "/private/var/db/agent-deployd/issuer-policy.json",
        "/private/var/db/agent-deployd/local-trust.json",
        "/usr/local/libexec/agent-deployd/agent-deployd",
        "/usr/local/libexec/lw-pilot-executor",
    ];
    for kind in [
        crate::transaction::NativeKind::Runtime,
        crate::transaction::NativeKind::WatchdogW1,
        crate::transaction::NativeKind::WatchdogW2,
    ] {
        paths.push(kind.plist());
    }
    for path in paths {
        let p = Path::new(path);
        let parent = Dir::open(p.parent().unwrap(), 0)?;
        result.insert(
            path.into(),
            capture_one(&parent, p.file_name().unwrap().to_str().unwrap())?,
        );
    }
    Ok(result)
}
#[cfg(test)]
#[path = "../../../test/first_live/native_effects/leaves.rs"]
mod tests;
