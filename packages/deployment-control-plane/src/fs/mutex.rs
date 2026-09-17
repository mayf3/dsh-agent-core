use super::secure::{validate, Dir};
use crate::{error::require, Result};
use std::fs::File;
use std::os::fd::AsRawFd;
use std::os::unix::fs::MetadataExt;

/// Not Clone. Its descriptor remains owned by the outer Train through finalize.
pub struct MutationGuard {
    file: File,
    pub(crate) host_identity: (u64, u64),
}
impl MutationGuard {
    pub(crate) fn acquire(root: &Dir, create: bool) -> Result<Self> {
        let flags = libc::O_RDWR | if create { libc::O_CREAT } else { 0 };
        let file = root.open_file("production.lock", flags, 0o600)?;
        validate(&file, root.uid, false)?;
        let m = file.metadata()?;
        require(m.mode() & 0o777 == 0o600, "UNSAFE_MODE")?;
        require(
            unsafe { libc::flock(file.as_raw_fd(), libc::LOCK_EX | libc::LOCK_NB) } == 0,
            "MUTEX_BUSY",
        )?;
        let current = root
            .open_file("production.lock", libc::O_RDONLY, 0)?
            .metadata()?;
        require(
            m.dev() == current.dev() && m.ino() == current.ino(),
            "MUTEX_REPLACED",
        )?;
        file.sync_all()?;
        root.file.sync_all()?;
        let host = root.file.metadata()?;
        Ok(Self {
            file,
            host_identity: (host.dev(), host.ino()),
        })
    }
    pub(crate) fn binds(&self, root: &Dir) -> Result<()> {
        let m = root.file.metadata()?;
        require(self.host_identity == (m.dev(), m.ino()), "WRONG_MUTEX")
    }
}
impl Drop for MutationGuard {
    fn drop(&mut self) {
        unsafe {
            libc::flock(self.file.as_raw_fd(), libc::LOCK_UN);
        }
    }
}
