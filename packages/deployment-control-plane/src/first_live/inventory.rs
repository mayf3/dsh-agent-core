//! Closed tree metadata transitions. Caller paths are never accepted by native entry.
use crate::{
    error::require,
    fs::{
        file::sha,
        secure::{read_xattrs, reject_acl, Dir},
    },
    trust::digest,
    Error, Result,
};
use serde::{Deserialize, Serialize};
use std::{
    collections::BTreeMap,
    fs::File,
    io::Read,
    os::{fd::AsRawFd, unix::fs::MetadataExt},
};
#[derive(Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub(super) enum Kind {
    File,
    Directory,
    Link,
}
#[derive(Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub(super) struct Entry {
    pub kind: Kind,
    pub uid: u32,
    pub gid: u32,
    pub mode: u32,
    pub flags: u32,
    pub device: u64,
    pub inode: u64,
    pub links: u64,
    pub sha256: Option<String>,
    pub link: Option<String>,
    pub post_gid: u32,
    pub post_mode: u32,
}
pub(super) fn validate(entries: &BTreeMap<String, Entry>) -> Result<()> {
    require(
        !entries.is_empty() && entries.len() <= 100000,
        "FIRST_LIVE_INVENTORY",
    )?;
    for (path, e) in entries {
        super::inventory_path::parts(path)?;
        require(
            e.mode & !0o777 == 0 && e.post_mode & 0o7022 == 0 && e.flags == 0,
            "FIRST_LIVE_METADATA",
        )?;
        require(
            e.device > 0
                && e.inode > 0
                && [0, 502, 505].contains(&e.uid)
                && [0, 20, 601].contains(&e.post_gid),
            "FIRST_LIVE_METADATA",
        )?;
        match e.kind {
            Kind::File => {
                require(e.link.is_none(), "FIRST_LIVE_INVENTORY")?;
                crate::trust::valid_digest(
                    e.sha256
                        .as_deref()
                        .ok_or(Error::new("FIRST_LIVE_INVENTORY"))?,
                )?;
            }
            Kind::Directory => require(
                e.link.is_none() && e.sha256.is_none() && e.post_mode & 0o500 == 0o500,
                "FIRST_LIVE_INVENTORY",
            )?,
            Kind::Link => {
                require(
                    e.sha256.is_none() && e.post_mode == 0o555,
                    "FIRST_LIVE_LINK",
                )?;
                let link = e.link.as_deref().ok_or(Error::new("FIRST_LIVE_LINK"))?;
                require(
                    !link.is_empty() && link.len() <= 4096 && !link.contains('\0'),
                    "FIRST_LIVE_LINK",
                )?;
                if link.starts_with('/') {
                    require(
                        link.starts_with("/usr/local/libexec/agent-core/"),
                        "FIRST_LIVE_LINK",
                    )?;
                }
            }
        }
    }
    Ok(())
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct Tree {
    pub root: Entry,
    #[serde(deserialize_with = "unique")]
    pub entries: BTreeMap<String, Entry>,
}
fn check(file: &File, e: &Entry, post: bool) -> Result<()> {
    let m = file.metadata()?;
    require(
        m.uid() == if post { 0 } else { e.uid }
            && m.gid() == if post { e.post_gid } else { e.gid }
            && m.mode() & 0o7777
                == if post && e.kind != Kind::Link {
                    e.post_mode
                } else {
                    e.mode
                },
        "FIRST_LIVE_METADATA_DRIFT",
    )?;
    require(
        m.dev() == e.device
            && m.ino() == e.inode
            && std::os::macos::fs::MetadataExt::st_flags(&m) == e.flags,
        "FIRST_LIVE_IDENTITY_DRIFT",
    )?;
    require(
        match e.kind {
            Kind::File => m.is_file() && m.nlink() == e.links,
            Kind::Directory => m.is_dir(),
            Kind::Link => m.file_type().is_symlink() && m.nlink() == 1 && e.links == 1,
        },
        "FIRST_LIVE_TYPE",
    )?;
    reject_acl(file)?;
    read_xattrs(file)?;
    if let Some(expected) = &e.sha256 {
        use std::io::{Seek, SeekFrom};
        let mut f = file;
        let mut bytes = Vec::new();
        require(m.len() <= 128 * 1024 * 1024, "SIZE_LIMIT")?;
        f.seek(SeekFrom::Start(0))?;
        (&mut f)
            .take(128 * 1024 * 1024 + 1)
            .read_to_end(&mut bytes)?;
        require(
            sha(&bytes) == *expected
                && file.metadata()?.ctime() == m.ctime()
                && file.metadata()?.ctime_nsec() == m.ctime_nsec(),
            "FIRST_LIVE_BYTES_DRIFT",
        )?;
    }
    Ok(())
}
fn walk(
    dir: &Dir,
    prefix: &str,
    tree: &Tree,
    post: bool,
    visit: &mut impl FnMut(&str, &File) -> Result<()>,
) -> Result<()> {
    for name in dir.names_bounded(100000)? {
        let path = if prefix.is_empty() {
            name.clone()
        } else {
            format!("{prefix}/{name}")
        };
        let entry = tree
            .entries
            .get(&path)
            .ok_or(Error::new("FIRST_LIVE_UNLISTED_ENTRY"))?;
        let flags = if entry.kind == Kind::Link {
            libc::O_SYMLINK
        } else {
            libc::O_RDONLY
        };
        let file = super::inventory_path::open(&dir.file, &name, flags)?;
        check(&file, entry, post)?;
        if entry.kind == Kind::Link {
            let mut buf = vec![0u8; 4096];
            let c = std::ffi::CString::new(name.as_bytes())
                .map_err(|_| Error::new("FIRST_LIVE_LINK"))?;
            let n = unsafe {
                libc::readlinkat(
                    dir.file.as_raw_fd(),
                    c.as_ptr(),
                    buf.as_mut_ptr().cast(),
                    buf.len(),
                )
            };
            require(n >= 0 && (n as usize) < buf.len(), "FIRST_LIVE_LINK")?;
            require(
                entry.link.as_deref() == std::str::from_utf8(&buf[..n as usize]).ok(),
                "FIRST_LIVE_LINK_DRIFT",
            )?;
        }
        if entry.kind == Kind::Directory {
            walk(
                &Dir {
                    file: file.try_clone()?,
                    uid: dir.uid,
                },
                &path,
                tree,
                post,
                visit,
            )?;
        }
        visit(&path, &file)?;
    }
    Ok(())
}
fn aliases(
    tree: &Tree,
    harness: bool,
) -> Result<std::collections::BTreeMap<(u64, u64), Vec<String>>> {
    let mut groups: std::collections::BTreeMap<(u64, u64), Vec<String>> =
        std::collections::BTreeMap::new();
    for (path, e) in &tree.entries {
        if e.kind == Kind::File {
            groups
                .entry((e.device, e.inode))
                .or_default()
                .push(path.clone());
        }
    }
    let mut pairs = 0;
    for paths in groups.values() {
        let e = &tree.entries[&paths[0]];
        require(
            paths.len() as u64 == e.links && (e.links == 1 || harness && e.links == 2),
            "FIRST_LIVE_OPEN_ALIAS",
        )?;
        if e.links == 2 {
            pairs += 1;
            for path in paths {
                require(tree.entries[path] == *e, "FIRST_LIVE_ALIAS_DRIFT")?;
            }
        }
    }
    require(pairs <= 3, "FIRST_LIVE_OPEN_ALIAS")?;
    Ok(groups)
}
pub(super) fn census(root: &Dir, tree: &Tree, post: bool, harness: bool) -> Result<String> {
    validate(&tree.entries)?;
    validate(&BTreeMap::from([("root".into(), tree.root.clone())]))?;
    require(tree.root.kind == Kind::Directory, "FIRST_LIVE_ROOT_TYPE")?;
    aliases(tree, harness)?;
    check(&root.file, &tree.root, post)?;
    let mut count = 0;
    walk(root, "", tree, post, &mut |_, _| {
        count += 1;
        Ok(())
    })?;
    require(count == tree.entries.len(), "FIRST_LIVE_MISSING_ENTRY")?;
    digest(tree)
}
pub(super) fn protect_directories(
    root: &Dir,
    tree: &Tree,
    harness: bool,
    journal: &Dir,
    expires: u64,
) -> Result<Tree> {
    census(root, tree, false, harness)?;
    let mut after = tree.clone();
    after.root = metadata(root, &root.file, "root", &tree.root, journal, expires)?;
    let mut paths: Vec<_> = tree
        .entries
        .iter()
        .filter(|(_, e)| e.kind != Kind::File)
        .map(|(p, _)| p.clone())
        .collect();
    paths.sort_by_key(|p| p.split('/').count());
    for path in paths {
        let e = &tree.entries[&path];
        let flags = if e.kind == Kind::Link {
            libc::O_SYMLINK
        } else {
            libc::O_RDONLY | libc::O_DIRECTORY
        };
        let file = super::inventory_path::descendant(&root.file, &path, flags)?;
        let updated = metadata(root, &file, &path, e, journal, expires)?;
        check(
            &super::inventory_path::descendant(&root.file, &path, flags)?,
            &updated,
            false,
        )?;
        after.entries.insert(path, updated);
    }
    census(root, &after, false, harness)?;
    Ok(after)
}
fn metadata(
    root: &Dir,
    file: &File,
    path: &str,
    e: &Entry,
    journal: &Dir,
    expires: u64,
) -> Result<Entry> {
    require(super::compose::now()? < expires, "FIRST_LIVE_EXPIRED")?;
    check(file, e, false)?;
    let id = digest(&(path, e.device, e.inode))?;
    let bin = journal.mkdir(&id[..2])?;
    super::files::publish(
        &bin,
        &format!("{id}-intent.json"),
        &serde_json::json!({"path":path,"before":e}),
    )?;
    require(super::compose::now()? < expires, "FIRST_LIVE_EXPIRED")?;
    // Native root.uid is exactly zero; only private fixture roots use their owner.
    require(
        unsafe { libc::fchown(file.as_raw_fd(), root.uid, e.post_gid) } == 0,
        "FIRST_LIVE_METADATA_WRITE",
    )?;
    if e.kind == Kind::Directory {
        require(
            unsafe { libc::fchmod(file.as_raw_fd(), e.post_mode as libc::mode_t) } == 0,
            "FIRST_LIVE_METADATA_WRITE",
        )?;
        file.sync_all()?;
    }
    let mut after = e.clone();
    after.uid = root.uid;
    after.gid = e.post_gid;
    if e.kind == Kind::Directory {
        after.mode = e.post_mode;
    }
    check(file, &after, false)?;
    root.file.sync_all()?;
    require(super::compose::now()? < expires, "FIRST_LIVE_EXPIRED")?;
    super::files::publish(&bin, &format!("{id}-result.json"), &after)?;
    Ok(after)
}

fn unique<'de, D: serde::Deserializer<'de>>(
    d: D,
) -> std::result::Result<BTreeMap<String, Entry>, D::Error> {
    struct Entries;
    impl<'de> serde::de::Visitor<'de> for Entries {
        type Value = BTreeMap<String, Entry>;
        fn expecting(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
            f.write_str("unique bounded fixed-inventory paths")
        }
        fn visit_map<M: serde::de::MapAccess<'de>>(
            self,
            mut map: M,
        ) -> std::result::Result<Self::Value, M::Error> {
            let mut rows = BTreeMap::new();
            while let Some((k, v)) = map.next_entry::<String, Entry>()? {
                if rows.len() >= 100000 || rows.insert(k, v).is_some() {
                    return Err(serde::de::Error::custom("FIRST_LIVE_INVENTORY"));
                }
            }
            Ok(rows)
        }
    }
    d.deserialize_map(Entries)
}

#[path = "native_effects/link_graph.rs"]
mod link_graph;
pub(super) use link_graph::closed_links;

pub(super) use link_graph::recorded_negative_edges;
