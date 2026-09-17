use super::secure::{validate, Dir};
use crate::{error::require, Result};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs::File;
use std::io::{Read, Seek, SeekFrom, Write};
use std::os::fd::AsRawFd;
use std::os::unix::fs::MetadataExt;

pub(crate) const MAX_FILE: u64 = 64 * 1024 * 1024;
pub fn sha(bytes: &[u8]) -> String {
    hex::encode(Sha256::digest(bytes))
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct FileImage {
    pub bytes: Vec<u8>,
    pub uid: u32,
    pub gid: u32,
    pub mode: u32,
    pub device: u64,
    pub inode: u64,
    pub xattrs: std::collections::BTreeMap<String, Vec<u8>>,
    pub mtime_seconds: i64,
    pub mtime_nanos: i64,
}
impl FileImage {
    pub(crate) fn content_matches(&self, other: &Self) -> bool {
        self.bytes == other.bytes
            && self.uid == other.uid
            && self.gid == other.gid
            && self.mode == other.mode
            && self.xattrs == other.xattrs
            && self.mtime_seconds == other.mtime_seconds
            && self.mtime_nanos == other.mtime_nanos
    }
}
pub(crate) fn snapshot(mut file: &File, uid: u32, limit: u64) -> Result<FileImage> {
    validate(file, uid, false)?;
    let before = file.metadata()?;
    require(before.len() <= limit, "SIZE_LIMIT")?;
    file.seek(SeekFrom::Start(0))?;
    let mut bytes = Vec::new();
    (&mut file).take(limit + 1).read_to_end(&mut bytes)?;
    require(bytes.len() as u64 == before.len(), "INPUT_CHANGED")?;
    file.seek(SeekFrom::Start(0))?;
    let mut second = Vec::new();
    (&mut file).take(limit + 1).read_to_end(&mut second)?;
    let after = file.metadata()?;
    require(
        bytes == second
            && before.len() == after.len()
            && before.mtime() == after.mtime()
            && before.mtime_nsec() == after.mtime_nsec()
            && before.ctime() == after.ctime()
            && before.ctime_nsec() == after.ctime_nsec(),
        "INPUT_CHANGED",
    )?;
    validate(file, uid, false)?;
    Ok(FileImage {
        bytes,
        uid: after.uid(),
        gid: after.gid(),
        mode: after.mode() & 0o7777,
        device: after.dev(),
        inode: after.ino(),
        xattrs: super::secure::read_xattrs(file)?,
        mtime_seconds: after.mtime(),
        mtime_nanos: after.mtime_nsec(),
    })
}
pub(crate) fn write_new(
    dir: &Dir,
    name: &str,
    bytes: &[u8],
    uid: u32,
    gid: u32,
    mode: u32,
) -> Result<File> {
    let mut file = dir.open_file(name, libc::O_RDWR | libc::O_CREAT | libc::O_EXCL, 0o600)?;
    file.write_all(bytes)?;
    let current = file.metadata()?;
    if current.uid() != uid || current.gid() != gid {
        require(
            unsafe { libc::fchown(file.as_raw_fd(), uid, gid) } == 0,
            "UNSAFE_OWNER",
        )?;
    }
    require(
        unsafe { libc::fchmod(file.as_raw_fd(), mode as libc::mode_t) } == 0,
        "UNSAFE_MODE",
    )?;
    validate(&file, uid, false)?;
    #[cfg(test)]
    crate::transaction::fault::before_sync(&file, name)?;
    file.sync_all()?;
    dir.file.sync_all()?;
    Ok(file)
}

pub(crate) fn restore_times(file: &File, image: &FileImage) -> Result<()> {
    let current = super::secure::read_xattrs(file)?;
    for (key, value) in &image.xattrs {
        if current.get(key) == Some(value) {
            continue;
        }
        let key =
            std::ffi::CString::new(key.as_str()).map_err(|_| crate::Error::new("UNSAFE_XATTR"))?;
        require(
            unsafe {
                libc::fsetxattr(
                    file.as_raw_fd(),
                    key.as_ptr(),
                    value.as_ptr() as *const _,
                    value.len(),
                    0,
                    0,
                )
            } == 0,
            "UNSAFE_XATTR",
        )?;
    }
    require(
        super::secure::read_xattrs(file)? == image.xattrs,
        "UNSAFE_XATTR",
    )?;
    let times = [
        libc::timespec {
            tv_sec: 0,
            tv_nsec: libc::UTIME_OMIT,
        },
        libc::timespec {
            tv_sec: image.mtime_seconds,
            tv_nsec: image.mtime_nanos,
        },
    ];
    require(
        unsafe { libc::futimens(file.as_raw_fd(), times.as_ptr()) } == 0,
        "FILESYSTEM_IO",
    )?;
    file.sync_all()?;
    Ok(())
}
