//! Only the fixed first-live inventory walker admits package-manager literal names.
use crate::{error::require, Error, Result};
use std::{
    ffi::CString,
    fs::File,
    os::fd::{AsRawFd, FromRawFd},
};
pub(super) fn parts(path: &str) -> Result<Vec<&str>> {
    let parts: Vec<_> = path.split('/').collect();
    require(path.len() <= 242 && parts.len() <= 14, "FIRST_LIVE_PATH")?;
    for p in &parts {
        require(
            !p.is_empty()
                && *p != "."
                && *p != ".."
                && p.len() <= 120
                && p.bytes()
                    .all(|b| b.is_ascii_alphanumeric() || b"._-@+=$".contains(&b)),
            "FIRST_LIVE_PATH",
        )?;
    }
    Ok(parts)
}
pub(super) fn open(parent: &File, name: &str, flags: i32) -> Result<File> {
    require(parts(name)?.len() == 1, "FIRST_LIVE_PATH")?;
    let c = CString::new(name).map_err(|_| Error::new("FIRST_LIVE_PATH"))?;
    // macOS O_SYMLINK opens the link itself; combining O_NOFOLLOW rejects it.
    let nofollow = if flags & libc::O_SYMLINK != 0 {
        0
    } else {
        libc::O_NOFOLLOW
    };
    let fd = unsafe {
        libc::openat(
            parent.as_raw_fd(),
            c.as_ptr(),
            flags | nofollow | libc::O_NONBLOCK | libc::O_CLOEXEC,
        )
    };
    require(fd >= 0, "FIRST_LIVE_FILE")?;
    Ok(unsafe { File::from_raw_fd(fd) })
}
pub(super) fn descendant(root: &File, path: &str, flags: i32) -> Result<File> {
    let parts = parts(path)?;
    let mut file = root.try_clone()?;
    for (i, name) in parts.iter().enumerate() {
        file = open(
            &file,
            name,
            if i + 1 == parts.len() {
                flags
            } else {
                libc::O_RDONLY | libc::O_DIRECTORY
            },
        )?;
    }
    Ok(file)
}
