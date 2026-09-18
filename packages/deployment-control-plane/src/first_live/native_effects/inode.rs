//! Finite public-code inode replacement; no old writable capability survives.
use super::super::{
    files,
    inventory::{Entry, Kind, Tree},
    inventory_path,
};
use crate::{
    error::require,
    fs::{
        file::{restore_times, sha, write_new, FileImage},
        secure::{read_xattrs, reject_acl, validate, Dir},
        MutationGuard,
    },
    trust::digest,
    Error, Result,
};
use serde::{Deserialize, Serialize};
use std::{
    collections::BTreeMap,
    ffi::CString,
    fs::File,
    io::{Read, Seek, SeekFrom},
    os::{fd::AsRawFd, unix::fs::MetadataExt},
};
const LIMIT: u64 = 128 * 1024 * 1024;
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Record {
    paths: Vec<String>,
    before: Entry,
    after: Entry,
    backup: String,
    xattrs: BTreeMap<String, Vec<u8>>,
    mtime_seconds: i64,
    mtime_nanos: i64,
}
fn groups(tree: &Tree) -> Result<Vec<Vec<String>>> {
    let mut groups: BTreeMap<(u64, u64), Vec<String>> = BTreeMap::new();
    for (path, e) in &tree.entries {
        inventory_path::parts(path)?;
        if e.kind == Kind::File {
            groups
                .entry((e.device, e.inode))
                .or_default()
                .push(path.clone());
        }
    }
    for paths in groups.values() {
        let e = &tree.entries[&paths[0]];
        require(
            (1..=2).contains(&paths.len()) && paths.len() as u64 == e.links,
            "FIRST_LIVE_OPEN_ALIAS",
        )?;
        for path in paths {
            require(tree.entries[path] == *e, "FIRST_LIVE_ALIAS_DRIFT")?;
        }
    }
    Ok(groups.into_values().collect())
}
fn parent(root: &Dir, path: &str) -> Result<(Dir, String)> {
    validate(&root.file, root.uid, true)?;
    let parts = inventory_path::parts(path)?;
    let mut file = root.file.try_clone()?;
    for name in &parts[..parts.len() - 1] {
        file = inventory_path::open(&file, name, libc::O_RDONLY | libc::O_DIRECTORY)?;
        validate(&file, root.uid, true)?;
    }
    Ok((
        Dir {
            file,
            uid: root.uid,
        },
        parts.last().unwrap().to_string(),
    ))
}
fn read(file: &File, e: &Entry, links: u64) -> Result<FileImage> {
    let before = file.metadata()?;
    require(
        e.kind == Kind::File
            && before.is_file()
            && before.dev() == e.device
            && before.ino() == e.inode
            && before.nlink() == links
            && before.uid() == e.uid
            && before.gid() == e.gid
            && before.mode() & 0o7777 == e.mode
            && std::os::macos::fs::MetadataExt::st_flags(&before) == e.flags
            && e.flags == 0,
        "FIRST_LIVE_COPY_PREIMAGE",
    )?;
    reject_acl(file)?;
    let xattrs = read_xattrs(file)?;
    require(before.len() <= LIMIT, "SIZE_LIMIT")?;
    let mut fd = file;
    fd.seek(SeekFrom::Start(0))?;
    let mut bytes = Vec::new();
    (&mut fd).take(LIMIT + 1).read_to_end(&mut bytes)?;
    let after = file.metadata()?;
    require(
        bytes.len() as u64 == before.len()
            && e.sha256.as_deref() == Some(&sha(&bytes))
            && before.ctime() == after.ctime()
            && before.ctime_nsec() == after.ctime_nsec()
            && before.len() == after.len()
            && before.mtime() == after.mtime()
            && before.mtime_nsec() == after.mtime_nsec()
            && read_xattrs(file)? == xattrs,
        "FIRST_LIVE_COPY_BYTES",
    )?;
    Ok(FileImage {
        bytes,
        uid: e.uid,
        gid: e.gid,
        mode: e.mode,
        device: e.device,
        inode: e.inode,
        xattrs,
        mtime_seconds: after.mtime(),
        mtime_nanos: after.mtime_nsec(),
    })
}
fn observed(file: &File, original: &Entry, links: u64) -> Result<Entry> {
    let m = file.metadata()?;
    let mut e = original.clone();
    e.uid = m.uid();
    e.gid = m.gid();
    e.mode = m.mode() & 0o7777;
    e.device = m.dev();
    e.inode = m.ino();
    e.links = links;
    Ok(e)
}
fn cname(name: &str) -> Result<CString> {
    require(inventory_path::parts(name)?.len() == 1, "FIRST_LIVE_PATH")?;
    CString::new(name).map_err(|_| Error::new("FIRST_LIVE_PATH"))
}
fn rename(dir: &Dir, from: &str, to: &str) -> Result<()> {
    require(
        unsafe {
            libc::renameat(
                dir.file.as_raw_fd(),
                cname(from)?.as_ptr(),
                dir.file.as_raw_fd(),
                cname(to)?.as_ptr(),
            )
        } == 0,
        "FIRST_LIVE_COPY_RENAME",
    )?;
    dir.file.sync_all()?;
    Ok(())
}
type PreparedNames = Vec<(Dir, String, String)>;
fn prepare(
    root: &Dir,
    paths: &[String],
    id: &str,
    image: &FileImage,
    e: &Entry,
    recovery: bool,
) -> Result<(Entry, PreparedNames)> {
    let mut parents = Vec::new();
    for (i, path) in paths.iter().enumerate() {
        let (dir, name) = parent(root, path)?;
        let temp = format!(
            ".dcp-{}-{id}-{i}",
            if recovery { "restore" } else { "copy" }
        );
        files::absent(&dir, &temp)?;
        parents.push((dir, name, temp));
    }
    let (uid, gid, mode) = if recovery {
        (e.uid, e.gid, e.mode)
    } else {
        (root.uid, e.post_gid, e.post_mode)
    };
    let first = &parents[0];
    let file = write_new(&first.0, &first.2, &image.bytes, uid, gid, mode)?;
    restore_times(&file, image)?;
    for (dir, _, temp) in &parents[1..] {
        require(
            unsafe {
                libc::linkat(
                    first.0.file.as_raw_fd(),
                    cname(&first.2)?.as_ptr(),
                    dir.file.as_raw_fd(),
                    cname(temp)?.as_ptr(),
                    0,
                )
            } == 0,
            "FIRST_LIVE_COPY_LINK",
        )?;
        dir.file.sync_all()?;
    }
    file.sync_all()?;
    let after = observed(&file, e, paths.len() as u64)?;
    require(
        (after.device, after.inode) != (e.device, e.inode),
        "FIRST_LIVE_OLD_INODE",
    )?;
    require(
        read(&file, &after, after.links)?.xattrs == image.xattrs,
        "FIRST_LIVE_COPY_XATTR",
    )?;
    Ok((after, parents))
}
fn verify_names(root: &Dir, paths: &[String], after: &Entry, image: &FileImage) -> Result<()> {
    for path in paths {
        let (dir, name) = parent(root, path)?;
        let f = inventory_path::open(&dir.file, &name, libc::O_RDONLY)?;
        let actual = read(&f, after, after.links)?;
        require(
            actual.bytes == image.bytes && actual.xattrs == image.xattrs,
            "FIRST_LIVE_COPY_READBACK",
        )?;
    }
    Ok(())
}
pub(super) fn replace_tree(
    root: &Dir,
    before: &Tree,
    history: &Dir,
    _guard: &MutationGuard,
    expires_at: u64,
) -> Result<Tree> {
    deadline(expires_at)?;
    require(
        root.uid == unsafe { libc::geteuid() } && history.uid == root.uid,
        "FIRST_LIVE_COPY_OWNER",
    )?;
    let mut after = before.clone();
    for paths in groups(before)? {
        deadline(expires_at)?;
        let e = &before.entries[&paths[0]];
        require(e.post_mode & 0o7022 == 0, "FIRST_LIVE_COPY_MODE")?;
        let id = digest(&(&paths, e))?;
        let bin = history.mkdir(&id[..2])?;
        files::absent(&bin, &format!("{id}-intent.json"))?;
        let (dir, name) = parent(root, &paths[0])?;
        let source = inventory_path::open(&dir.file, &name, libc::O_RDONLY)?;
        let image = read(&source, e, e.links)?;
        for path in &paths[1..] {
            let (dir, name) = parent(root, path)?;
            read(
                &inventory_path::open(&dir.file, &name, libc::O_RDONLY)?,
                e,
                e.links,
            )?;
        }
        let backup = format!("{id}-bytes");
        deadline(expires_at)?;
        let archive = write_new(
            &bin,
            &backup,
            &image.bytes,
            root.uid,
            history.file.metadata()?.gid(),
            0o400,
        )?;
        restore_times(&archive, &image)?;
        let archived = observed(&archive, e, 1)?;
        require(
            archived.inode != e.inode && read(&archive, &archived, 1)?.bytes == image.bytes,
            "FIRST_LIVE_COPY_ARCHIVE",
        )?;
        #[cfg(test)]
        crate::transaction::fault::point("inode-after-archive");
        deadline(expires_at)?;
        let (post, parents) = prepare(root, &paths, &id, &image, e, false)?;
        let record = Record {
            paths: paths.clone(),
            before: e.clone(),
            after: post.clone(),
            backup,
            xattrs: image.xattrs.clone(),
            mtime_seconds: image.mtime_seconds,
            mtime_nanos: image.mtime_nanos,
        };
        deadline(expires_at)?;
        files::publish(&bin, &format!("{id}-intent.json"), &record)?;
        #[cfg(test)]
        crate::transaction::fault::point("inode-before-publication");
        for (i, (dir, name, temp)) in parents.iter().enumerate() {
            read(
                &inventory_path::open(&dir.file, name, libc::O_RDONLY)?,
                e,
                e.links - i as u64,
            )?;
            deadline(expires_at)?;
            rename(dir, temp, name)?;
            #[cfg(test)]
            crate::transaction::fault::point(if i == 0 {
                "inode-after-first-publication"
            } else {
                "inode-after-next-publication"
            });
        }
        verify_names(root, &paths, &post, &image)?;
        deadline(expires_at)?;
        files::publish(&bin, &format!("{id}-result.json"), &record)?;
        for path in paths {
            after.entries.insert(path, post.clone());
        }
    }
    Ok(after)
}
pub(super) fn check_space(root: &Dir, regular_bytes: u64, payload_bytes: u64) -> Result<()> {
    let required = regular_bytes
        .checked_mul(3)
        .and_then(|n| n.checked_add(payload_bytes))
        .and_then(|n| n.checked_add(256 * 1024 * 1024))
        .ok_or(Error::new("FIRST_LIVE_SPACE"))?;
    let mut stat: libc::statvfs = unsafe { std::mem::zeroed() };
    require(
        unsafe { libc::fstatvfs(root.file.as_raw_fd(), &mut stat) } == 0,
        "FIRST_LIVE_SPACE",
    )?;
    let available = (stat.f_bavail as u64)
        .checked_mul(stat.f_frsize as u64)
        .ok_or(Error::new("FIRST_LIVE_SPACE"))?;
    require(available >= required, "FIRST_LIVE_SPACE")
}
#[cfg(test)]
#[path = "../../../test/first_live/inode.rs"]
mod tests;

fn deadline(expires_at: u64) -> Result<()> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|_| Error::new("FIRST_LIVE_CLOCK"))?
        .as_secs();
    require(now < expires_at, "FIRST_LIVE_GRANT_EXPIRED")
}

#[path = "inode_recovery.rs"]
mod recovery;
pub(super) use recovery::recover_tree;
