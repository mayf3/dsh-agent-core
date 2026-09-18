use super::{
    files,
    inventory::{self, Tree},
    packet::Packet,
};
use crate::{
    error::require,
    fs::{file::sha, secure::Dir},
    Error, Result,
};
use std::path::Path;
pub(super) const BASE: &str = "/usr/local/libexec/agent-core";
pub(super) fn open_parent(path: &Path) -> Result<Dir> {
    let parent = path.parent().ok_or(Error::new("FIRST_LIVE_PATH"))?;
    match Dir::open(parent, 0) {
        Ok(d) => Ok(d),
        Err(_) => Dir::open(parent, 505),
    }
}
pub(super) fn open(name: &str) -> Result<Dir> {
    require(
        ["app", "harness", "node-runtime"].contains(&name),
        "FIRST_LIVE_TREE",
    )?;
    let root = Dir::open(Path::new(BASE), 0)?;
    Ok(Dir {
        file: root.open_file(name, libc::O_RDONLY | libc::O_DIRECTORY, 0)?,
        uid: 0,
    })
}
pub(super) fn load(packet: &Dir, p: &Packet) -> Result<[Tree; 3]> {
    let mut result = Vec::new();
    for (name, expected) in [
        ("app-inventory.json", &p.lifecycle.app_inventory_sha256),
        (
            "harness-inventory.json",
            &p.lifecycle.harness_inventory_sha256,
        ),
        ("node-inventory.json", &p.lifecycle.node_inventory_sha256),
    ] {
        let raw = files::raw(packet, name)?;
        require(sha(&raw) == *expected, "FIRST_LIVE_INVENTORY_BINDING")?;
        let tree: Tree = serde_json::from_slice(&raw)?;
        inventory::validate(&tree.entries)?;
        result.push(tree);
    }
    let trees: [Tree; 3] = result
        .try_into()
        .map_err(|_| Error::new("FIRST_LIVE_TREE"))?;
    inventory::closed_links(&trees)?;
    Ok(trees)
}
#[derive(Clone, serde::Serialize, serde::Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct Ancestor {
    pub device: u64,
    pub inode: u64,
    pub uid: u32,
    pub gid: u32,
    pub mode: u32,
    pub flags: u32,
}
pub(super) const ANCESTORS: [(&str, u32); 8] = [
    ("/", 0x100000),
    ("/usr", 0x88000),
    ("/usr/local", 0x100000),
    ("/usr/local/libexec", 0),
    ("/usr/local/libexec/agent-core", 0),
    ("/usr/local/libexec/agent-deployd", 0),
    ("/Library", 0x100000),
    ("/Library/LaunchDaemons", 0),
];
pub(super) fn validate_ancestors(
    entries: &std::collections::BTreeMap<String, Ancestor>,
) -> Result<()> {
    require(entries.len() == ANCESTORS.len(), "FIRST_LIVE_ANCESTOR_SET")?;
    for (path, flags) in ANCESTORS {
        let e = entries
            .get(path)
            .ok_or(Error::new("FIRST_LIVE_ANCESTOR_SET"))?;
        require(
            e.device != 0
                && e.inode != 0
                && e.uid == 0
                && e.gid == 0
                && e.mode == 0o755
                && e.flags == flags,
            "FIRST_LIVE_ANCESTOR_PLAN",
        )?;
    }
    Ok(())
}
pub(super) fn ancestors(entries: &std::collections::BTreeMap<String, Ancestor>) -> Result<String> {
    use std::os::unix::fs::MetadataExt;
    validate_ancestors(entries)?;
    for (path, _) in ANCESTORS {
        let dir = Dir::open(Path::new(path), 0)?;
        crate::fs::secure::reject_acl(&dir.file)?;
        let m = dir.file.metadata()?;
        let e = &entries[path];
        require(
            m.is_dir()
                && (
                    m.dev(),
                    m.ino(),
                    m.uid(),
                    m.gid(),
                    m.mode() & 0o7777,
                    std::os::macos::fs::MetadataExt::st_flags(&m),
                ) == (e.device, e.inode, e.uid, e.gid, e.mode, e.flags),
            "FIRST_LIVE_ANCESTOR_DRIFT",
        )?;
    }
    crate::trust::digest(entries)
}
