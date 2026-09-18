use crate::{Error, Result};
#[derive(Debug, serde::Serialize)]
pub(super) struct Image {
    pub digest: String,
    pub device: u64,
    pub inode: u64,
    pub mode: u32,
    #[serde(skip)]
    pub bytes: Vec<u8>,
}
fn read(file: &mut std::fs::File, uid: u32, login: bool) -> Result<Image> {
    use crate::{
        error::require,
        fs::{file::sha, secure::reject_acl},
    };
    use std::{
        io::{Read, Seek, SeekFrom},
        os::{macos::fs::MetadataExt as _, unix::fs::MetadataExt},
    };
    let before = file.metadata()?;
    require(
        before.is_file()
            && before.nlink() == 1
            && before.uid() == uid
            && before.len() <= 128 * 1024 * 1024
            && (if login {
                before.mode() & 0o7777 == 0o4555 && before.gid() == 0
            } else {
                before.mode() & 0o7022 == 0
            })
            && before.st_flags() & !0x80020 == 0,
        "HOST_IMAGE_UNPROVEN",
    )?;
    reject_acl(file)?;
    let mut bytes = Vec::new();
    file.seek(SeekFrom::Start(0))?;
    file.take(128 * 1024 * 1024 + 1).read_to_end(&mut bytes)?;
    require(bytes.len() as u64 == before.len(), "HOST_IMAGE_CHANGED")?;
    let digest = sha(&bytes);
    let mut again = Vec::new();
    file.seek(SeekFrom::Start(0))?;
    file.take(128 * 1024 * 1024 + 1).read_to_end(&mut again)?;
    let after = file.metadata()?;
    require(
        sha(&again) == digest
            && after.len() == before.len()
            && after.uid() == before.uid()
            && after.gid() == before.gid()
            && after.mode() == before.mode()
            && after.nlink() == before.nlink()
            && after.st_flags() == before.st_flags()
            && after.ctime() == before.ctime()
            && after.ctime_nsec() == before.ctime_nsec()
            && after.mtime() == before.mtime()
            && after.mtime_nsec() == before.mtime_nsec(),
        "HOST_IMAGE_CHANGED",
    )?;
    reject_acl(file)?;
    Ok(Image {
        digest,
        device: before.dev(),
        inode: before.ino(),
        mode: before.mode() & 0o7777,
        bytes,
    })
}
/// The caller supplies only a path from the compiled finite role table or the
/// fixed host transition constants. Dir traverses every ancestor without links.
pub(super) fn protected(path: &str) -> Result<Image> {
    use crate::fs::secure::Dir;
    let path = std::path::Path::new(path);
    let parent = Dir::open(
        path.parent().ok_or_else(|| Error::new("HOST_IMAGE_PATH"))?,
        0,
    )?;
    let name = path
        .file_name()
        .and_then(|s| s.to_str())
        .ok_or_else(|| Error::new("HOST_IMAGE_PATH"))?;
    let mut file = parent.open_file(name, libc::O_RDONLY, 0)?;
    let image = read(&mut file, 0, path == std::path::Path::new("/usr/bin/login"))?;
    use std::os::unix::fs::MetadataExt;
    let current = parent.open_file(name, libc::O_RDONLY, 0)?.metadata()?;
    crate::error::require(
        current.dev() == image.device && current.ino() == image.inode,
        "HOST_IMAGE_CHANGED",
    )?;
    Ok(image)
}
#[cfg(test)]
#[path = "../../../../test/first_live/host/image.rs"]
mod tests;
