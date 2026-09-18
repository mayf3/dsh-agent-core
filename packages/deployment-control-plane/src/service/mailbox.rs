use super::intake::MAX_PROTECTED_RECORD;
use crate::{
    error::require,
    fs::{
        file::snapshot,
        secure::{validate, Dir},
    },
    Error, Result,
};
use std::{
    ffi::CString,
    fs::File,
    io::{Seek, SeekFrom, Write},
    os::{fd::AsRawFd, unix::fs::MetadataExt},
    time::{Duration, Instant},
};

/// One permanent protected lock serializes all cooperating publishers, including
/// socket workers. A temporary record is reconciled only while this lock is owned.
pub(crate) fn initialize(root: &Dir) -> Result<()> {
    // Called only during singleton-owned startup, before any socket/Train workers.
    // The permanent inode exists durably before concurrent publishers can open it.
    let file = root.open_file("publication.lock", libc::O_RDWR | libc::O_CREAT, 0o600)?;
    validate(&file, root.uid, false)?;
    require(file.metadata()?.mode() & 0o777 == 0o600, "UNSAFE_MODE")?;
    file.sync_all()?;
    root.file.sync_all()?;
    Ok(())
}
fn lock(root: &Dir) -> Result<File> {
    let file = root.open_file("publication.lock", libc::O_RDWR, 0)?;
    validate(&file, root.uid, false)?;
    require(file.metadata()?.mode() & 0o777 == 0o600, "UNSAFE_MODE")?;
    let deadline = Instant::now() + Duration::from_millis(200);
    loop {
        if unsafe { libc::flock(file.as_raw_fd(), libc::LOCK_EX | libc::LOCK_NB) } == 0 {
            break;
        }
        require(
            std::io::Error::last_os_error().raw_os_error() == Some(libc::EWOULDBLOCK),
            "FILESYSTEM_IO",
        )?;
        require(Instant::now() < deadline, "MAILBOX_BUSY")?;
        std::thread::sleep(Duration::from_millis(5));
    }
    same_named(root, "publication.lock", &file)?;
    // The inode is permanent. Closing this private CLOEXEC descriptor releases it.
    Ok(file)
}
fn same_named(dir: &Dir, name: &str, file: &File) -> Result<()> {
    let actual = dir.open_file(name, libc::O_RDONLY, 0)?.metadata()?;
    let opened = file.metadata()?;
    require(
        (actual.dev(), actual.ino()) == (opened.dev(), opened.ino()),
        "MAILBOX_REPLACED",
    )
}
fn sync_parent(dir: &Dir) -> Result<()> {
    #[cfg(test)]
    super::mailbox_tests::before_parent_sync()?;
    dir.file.sync_all()?;
    Ok(())
}
fn bytes(dir: &Dir, file: &File) -> Result<Vec<u8>> {
    let image = snapshot(file, dir.uid, MAX_PROTECTED_RECORD)?;
    require(image.mode == 0o600, "UNSAFE_MODE")?;
    Ok(image.bytes)
}
pub(super) fn publish(root: &Dir, area: &str, id: &str, raw: &[u8]) -> Result<()> {
    let _lock = lock(root)?;
    let dir = root.child(area)?;
    let name = format!("{id}.json");
    let temporary = format!("{id}.tmp");
    match dir.open_file(&name, libc::O_RDONLY, 0) {
        Ok(file) => {
            require(bytes(&dir, &file)? == raw, "IMMUTABLE_DELIVERY")?;
            same_named(&dir, &name, &file)?;
            // A visible rename is not durable publication until both flushes succeed.
            file.sync_all()?;
            return sync_parent(&dir);
        }
        Err(e) if e.code() == "ABSENT" => (),
        Err(e) => return Err(e),
    }
    let mut file = match dir.open_file(&temporary, libc::O_RDWR, 0) {
        Ok(file) => file,
        Err(e) if e.code() == "ABSENT" => {
            require(dir.names()?.len() < 8192, "MAILBOX_QUOTA")?;
            dir.open_file(
                &temporary,
                libc::O_RDWR | libc::O_CREAT | libc::O_EXCL,
                0o600,
            )?
        }
        Err(e) => return Err(e),
    };
    let prior = bytes(&dir, &file)?;
    require(raw.starts_with(&prior), "IMMUTABLE_DELIVERY")?;
    same_named(&dir, &temporary, &file)?;
    if prior.len() < raw.len() {
        // The exact private, uncommitted prefix is completed in place. We neither
        // truncate mismatching records nor unlink another publisher's temporary.
        file.seek(SeekFrom::Start(prior.len() as u64))?;
        file.write_all(&raw[prior.len()..])?;
    }
    require(bytes(&dir, &file)? == raw, "IMMUTABLE_DELIVERY")?;
    file.sync_all()?;
    sync_parent(&dir)?;
    same_named(&dir, &temporary, &file)?;
    let from = CString::new(temporary).map_err(|_| Error::new("UNSAFE_PATH"))?;
    let to = CString::new(name).map_err(|_| Error::new("UNSAFE_PATH"))?;
    require(
        unsafe {
            libc::renameat(
                dir.file.as_raw_fd(),
                from.as_ptr(),
                dir.file.as_raw_fd(),
                to.as_ptr(),
            )
        } == 0,
        "FILESYSTEM_IO",
    )?;
    sync_parent(&dir)
}
