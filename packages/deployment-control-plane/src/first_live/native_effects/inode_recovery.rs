//! Recovery consumes only newly sealed archives; detached old inodes are untrusted.
use super::*;
use crate::fs::file::snapshot;

fn identity(e: &Entry) -> (u64, u64) {
    (e.device, e.inode)
}
fn read_record(
    bin: &Dir,
    id: &str,
    paths: &[String],
    before: &Entry,
    owner: u32,
) -> Result<Record> {
    let r: Record = files::read(bin, &format!("{id}-intent.json"))?;
    require(
        r.paths == paths
            && r.before == *before
            && r.backup == format!("{id}-bytes")
            && r.after.kind == Kind::File
            && r.after.sha256 == before.sha256
            && r.after.links == paths.len() as u64
            && r.after.uid == owner
            && r.after.gid == before.post_gid
            && r.after.mode == before.post_mode
            && r.after.flags == 0
            && r.after.link.is_none()
            && identity(&r.after) != identity(before),
        "FIRST_LIVE_RECOVERY_RECORD",
    )?;
    Ok(r)
}
fn current(root: &Dir, r: &Record, id: &str) -> Result<(Vec<bool>, u64)> {
    let mut old = Vec::new();
    for (i, path) in r.paths.iter().enumerate() {
        let (dir, name) = parent(root, path)?;
        let m = inventory_path::open(&dir.file, &name, libc::O_RDONLY)?.metadata()?;
        let key = (m.dev(), m.ino());
        require(
            key == identity(&r.before) || key == identity(&r.after),
            "FIRST_LIVE_RECOVERY_DRIFT",
        )?;
        let is_old = key == identity(&r.before);
        let temp = format!(".dcp-copy-{id}-{i}");
        if is_old {
            let file = dir.open_file(&temp, libc::O_RDONLY, 0)?;
            read(&file, &r.after, r.after.links)?;
        } else {
            files::absent(&dir, &temp)?;
        }
        old.push(is_old);
    }
    let old_count = old.iter().filter(|v| **v).count() as u64;
    for (path, is_old) in r.paths.iter().zip(old.iter()) {
        let (dir, name) = parent(root, path)?;
        read(
            &inventory_path::open(&dir.file, &name, libc::O_RDONLY)?,
            if *is_old { &r.before } else { &r.after },
            if *is_old { old_count } else { r.after.links },
        )?;
    }
    Ok((old, old_count))
}
pub(in crate::first_live::native_effects) fn recover_tree(
    root: &Dir,
    before: &Tree,
    history: &Dir,
    _guard: &MutationGuard,
    expires_at: u64,
) -> Result<Tree> {
    require(
        root.uid == unsafe { libc::geteuid() } && history.uid == root.uid,
        "FIRST_LIVE_COPY_OWNER",
    )?;
    deadline(expires_at)?;
    let mut restored = before.clone();
    for paths in groups(before)? {
        deadline(expires_at)?;
        let e = &before.entries[&paths[0]];
        let id = digest(&(&paths, e))?;
        let bin = history.child(&id[..2])?;
        let r = read_record(&bin, &id, &paths, e, root.uid)?;
        files::absent(&bin, &format!("{id}-restore-intent.json"))?;
        let archive = bin.open_file(&r.backup, libc::O_RDONLY, 0)?;
        let image = snapshot(&archive, root.uid, LIMIT)?;
        require(
            image.mode == 0o400
                && e.sha256.as_deref() == Some(&sha(&image.bytes))
                && image.xattrs == r.xattrs
                && image.mtime_seconds == r.mtime_seconds
                && image.mtime_nanos == r.mtime_nanos,
            "FIRST_LIVE_RECOVERY_ARCHIVE",
        )?;
        let (old, old_count) = current(root, &r, &id)?;
        deadline(expires_at)?;
        let (post, parents) = prepare(root, &paths, &id, &image, e, true)?;
        require(
            identity(&post) != identity(&r.after),
            "FIRST_LIVE_OLD_INODE",
        )?;
        files::publish(
            &bin,
            &format!("{id}-restore-intent.json"),
            &serde_json::json!({"original":r,"postimage":post}),
        )?;
        #[cfg(test)]
        crate::transaction::fault::point("inode-recovery-before-publication");
        let mut removed_old = 0;
        let mut removed_new = 0;
        for (i, (dir, name, temp)) in parents.iter().enumerate() {
            deadline(expires_at)?;
            let (expected, links) = if old[i] {
                (&r.before, old_count - removed_old)
            } else {
                (&r.after, r.after.links - removed_new)
            };
            read(
                &inventory_path::open(&dir.file, name, libc::O_RDONLY)?,
                expected,
                links,
            )?;
            rename(dir, temp, name)?;
            if old[i] {
                removed_old += 1;
            } else {
                removed_new += 1;
            }
            #[cfg(test)]
            crate::transaction::fault::point("inode-recovery-after-publication");
        }
        // Only the original operation's precisely bound still-staged new inode
        // names may be removed. No directory sweep or foreign-file deletion.
        for (i, (dir, _, _)) in parents.iter().enumerate() {
            if !old[i] {
                continue;
            }
            deadline(expires_at)?;
            let name = format!(".dcp-copy-{id}-{i}");
            let file = dir.open_file(&name, libc::O_RDONLY, 0)?;
            read(&file, &r.after, r.after.links - removed_new)?;
            require(
                unsafe { libc::unlinkat(dir.file.as_raw_fd(), cname(&name)?.as_ptr(), 0) } == 0,
                "FIRST_LIVE_RECOVERY_CLEANUP",
            )?;
            removed_new += 1;
            dir.file.sync_all()?;
        }
        verify_names(root, &paths, &post, &image)?;
        deadline(expires_at)?;
        files::publish(&bin, &format!("{id}-restore-result.json"), &post)?;
        for path in paths {
            restored.entries.insert(path, post.clone());
        }
    }
    Ok(restored)
}
