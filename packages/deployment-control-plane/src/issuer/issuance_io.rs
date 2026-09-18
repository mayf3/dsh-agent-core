use crate::{
    error::require,
    fs::{file::snapshot, secure::Dir},
    Result,
};
use std::{
    io::{Seek, SeekFrom, Write},
    os::{fd::AsRawFd, unix::fs::MetadataExt},
};

/// Caller holds issuer.lock. A failed write never claims a final immutable name.
/// A retry may complete only an exact prefix of the same intended bytes.
pub(crate) fn immutable(dir: &Dir, name: &str, raw: &[u8]) -> Result<()> {
    match dir.open_file(name, libc::O_RDONLY, 0) {
        Ok(file) => {
            require(
                snapshot(&file, dir.uid, 64 * 1024 * 1024)?.bytes == raw,
                "IMMUTABLE_DELIVERY",
            )?;
            file.sync_all()?;
            dir.file.sync_all()?;
            return Ok(());
        }
        Err(e) if e.code() == "ABSENT" => (),
        Err(e) => return Err(e),
    }
    let pending = format!("{name}.partial");
    let existing = match dir.open_file(&pending, libc::O_RDONLY, 0) {
        Ok(file) => {
            let image = snapshot(&file, dir.uid, 64 * 1024 * 1024)?;
            require(raw.starts_with(&image.bytes), "IMMUTABLE_DELIVERY")?;
            require(
                image.mode == 0o600 || (image.mode == 0o400 && image.bytes == raw),
                "UNSAFE_MODE",
            )?;
            if image.bytes == raw {
                require(
                    unsafe { libc::fchmod(file.as_raw_fd(), 0o400) } == 0,
                    "UNSAFE_MODE",
                )?;
                file.sync_all()?;
                dir.rename(&pending, dir, name)?;
                return Ok(());
            }
            Some(image)
        }
        Err(e) if e.code() == "ABSENT" => None,
        Err(e) => return Err(e),
    };
    let mut file = if existing.is_some() {
        dir.open_file(&pending, libc::O_RDWR, 0)?
    } else {
        dir.open_file(&pending, libc::O_RDWR | libc::O_CREAT | libc::O_EXCL, 0o600)?
    };
    let prefix = snapshot(&file, dir.uid, 64 * 1024 * 1024)?;
    require(
        prefix.mode == 0o600 && raw.starts_with(&prefix.bytes),
        "IMMUTABLE_DELIVERY",
    )?;
    if let Some(expected) = existing {
        require(
            prefix.device == expected.device
                && prefix.inode == expected.inode
                && prefix.bytes == expected.bytes,
            "INPUT_CHANGED",
        )?;
    }
    file.seek(SeekFrom::End(0))?;
    file.write_all(&raw[prefix.bytes.len()..])?;
    require(
        snapshot(&file, dir.uid, 64 * 1024 * 1024)?.bytes == raw,
        "IMMUTABLE_DELIVERY",
    )?;
    require(
        unsafe { libc::fchmod(file.as_raw_fd(), 0o400) } == 0,
        "UNSAFE_MODE",
    )?;
    require(file.metadata()?.uid() == dir.uid, "UNSAFE_OWNER")?;
    file.sync_all()?;
    dir.rename(&pending, dir, name)
}
