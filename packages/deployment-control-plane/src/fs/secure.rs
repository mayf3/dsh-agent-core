use crate::{error::require, Error, Result};
use std::ffi::{CStr, CString};
use std::fs::File;
use std::os::fd::{AsRawFd, FromRawFd};
use std::os::unix::fs::MetadataExt;
use std::path::{Component, Path};

pub(crate) struct Dir {
    pub file: File,
    pub uid: u32,
}
fn cstr(name: &str) -> Result<CString> {
    CString::new(name).map_err(|_| Error::new("UNSAFE_PATH"))
}
pub(crate) fn component(name: &str) -> Result<()> {
    require(
        !name.is_empty()
            && name.len() <= 200
            && name != "."
            && name != ".."
            && name
                .bytes()
                .all(|c| c.is_ascii_alphanumeric() || b"._-@".contains(&c)),
        "UNSAFE_PATH",
    )
}
pub(crate) fn relative(path: &str) -> Result<Vec<&str>> {
    require(path.len() <= 1024, "UNSAFE_PATH")?;
    let parts: Vec<_> = path.split('/').collect();
    require(parts.len() <= 12, "UNSAFE_PATH")?;
    for p in &parts {
        component(p)?;
    }
    Ok(parts)
}
impl Dir {
    pub fn open(path: &Path, uid: u32) -> Result<Self> {
        require(path.is_absolute(), "UNSAFE_PATH")?;
        let root = unsafe {
            libc::open(
                c"/".as_ptr(),
                libc::O_RDONLY | libc::O_DIRECTORY | libc::O_CLOEXEC,
            )
        };
        require(root >= 0, "FILESYSTEM_IO")?;
        let mut dir = Self {
            file: unsafe { File::from_raw_fd(root) },
            uid,
        };
        for part in path.components() {
            match part {
                Component::RootDir => (),
                Component::Normal(p) => {
                    dir = dir.child(p.to_str().ok_or(Error::new("UNSAFE_PATH"))?)?;
                }
                _ => return Err(Error::new("UNSAFE_PATH")),
            }
        }
        require(dir.file.metadata()?.uid() == uid, "UNSAFE_OWNER")?;
        Ok(dir)
    }
    pub fn child(&self, name: &str) -> Result<Self> {
        component(name)?;
        let file = self.open_file(name, libc::O_RDONLY | libc::O_DIRECTORY, 0)?;
        validate(&file, self.uid, true)?;
        Ok(Self {
            file,
            uid: self.uid,
        })
    }
    pub fn mkdir(&self, name: &str) -> Result<Self> {
        component(name)?;
        let n = cstr(name)?;
        let result = unsafe { libc::mkdirat(self.file.as_raw_fd(), n.as_ptr(), 0o700) };
        if result != 0 && std::io::Error::last_os_error().raw_os_error() != Some(libc::EEXIST) {
            return Err(Error::new("FILESYSTEM_IO"));
        }
        self.file.sync_all()?;
        self.child(name)
    }
    pub fn open_file(&self, name: &str, flags: i32, mode: u32) -> Result<File> {
        component(name)?;
        let n = cstr(name)?;
        let fd = unsafe {
            libc::openat(
                self.file.as_raw_fd(),
                n.as_ptr(),
                flags | libc::O_NOFOLLOW | libc::O_CLOEXEC | libc::O_NONBLOCK,
                mode,
            )
        };
        if fd < 0 {
            return Err(Error::new(
                if std::io::Error::last_os_error().raw_os_error() == Some(libc::ENOENT) {
                    "ABSENT"
                } else {
                    "UNSAFE_FILE"
                },
            ));
        }
        Ok(unsafe { File::from_raw_fd(fd) })
    }
    pub fn names(&self) -> Result<Vec<String>> {
        self.names_bounded(8192)
    }
    pub fn names_bounded(&self, limit: usize) -> Result<Vec<String>> {
        // openat(.) creates a distinct directory cursor; dup would share seek state.
        let fd = unsafe {
            libc::openat(
                self.file.as_raw_fd(),
                c".".as_ptr(),
                libc::O_RDONLY | libc::O_DIRECTORY | libc::O_CLOEXEC,
            )
        };
        require(fd >= 0, "FILESYSTEM_IO")?;
        let dp = unsafe { libc::fdopendir(fd) };
        if dp.is_null() {
            unsafe {
                libc::close(fd);
            }
            return Err(Error::new("FILESYSTEM_IO"));
        }
        let mut result = Vec::new();
        loop {
            let entry = unsafe { libc::readdir(dp) };
            if entry.is_null() {
                break;
            }
            let raw = unsafe { CStr::from_ptr((*entry).d_name.as_ptr()) };
            let name = raw.to_string_lossy().into_owned();
            if name != "." && name != ".." {
                result.push(name);
            }
            if result.len() > limit {
                unsafe {
                    libc::closedir(dp);
                }
                return Err(Error::new("SIZE_LIMIT"));
            }
        }
        unsafe {
            libc::closedir(dp);
        }
        result.sort();
        Ok(result)
    }
    pub fn rename(&self, from: &str, to_dir: &Dir, to: &str) -> Result<()> {
        component(from)?;
        component(to)?;
        let from = cstr(from)?;
        let to = cstr(to)?;
        require(
            unsafe {
                libc::renameat(
                    self.file.as_raw_fd(),
                    from.as_ptr(),
                    to_dir.file.as_raw_fd(),
                    to.as_ptr(),
                )
            } == 0,
            "FILESYSTEM_IO",
        )?;
        to_dir.file.sync_all()?;
        self.file.sync_all()?;
        Ok(())
    }
    pub fn unlink(&self, name: &str) -> Result<()> {
        component(name)?;
        require(
            unsafe { libc::unlinkat(self.file.as_raw_fd(), cstr(name)?.as_ptr(), 0) } == 0,
            "FILESYSTEM_IO",
        )?;
        self.file.sync_all()?;
        Ok(())
    }
}
pub(crate) fn validate(file: &File, uid: u32, directory: bool) -> Result<()> {
    let m = file.metadata()?;
    require(
        if directory {
            m.is_dir()
        } else {
            m.is_file() && m.nlink() == 1
        },
        "UNSAFE_TYPE",
    )?;
    require(
        m.uid() == uid || (directory && m.uid() == 0),
        "UNSAFE_OWNER",
    )?;
    require(m.mode() & 0o7022 == 0, "UNSAFE_MODE")?;
    reject_acl(file)?;
    #[cfg(target_os = "macos")]
    if !directory {
        require(
            std::os::macos::fs::MetadataExt::st_flags(&m) == 0,
            "UNSAFE_FLAGS",
        )?;
        read_xattrs(file)?;
    }
    Ok(())
}
#[cfg(target_os = "macos")]
pub(crate) fn reject_acl(file: &File) -> Result<()> {
    unsafe extern "C" {
        fn acl_get_fd_np(fd: i32, kind: i32) -> *mut libc::c_void;
        fn acl_get_entry(acl: *mut libc::c_void, entry: i32, out: *mut *mut libc::c_void) -> i32;
        fn acl_free(ptr: *mut libc::c_void) -> i32;
    }
    let acl = unsafe { acl_get_fd_np(file.as_raw_fd(), 0x100) };
    if acl.is_null() {
        return require(
            std::io::Error::last_os_error().raw_os_error() == Some(libc::ENOENT),
            "ACL_UNREADABLE",
        );
    }
    let mut entry = std::ptr::null_mut();
    let found = unsafe { acl_get_entry(acl, 0, &mut entry) };
    unsafe {
        acl_free(acl);
    }
    require(
        found == -1 && std::io::Error::last_os_error().raw_os_error() == Some(libc::EINVAL),
        "UNSAFE_ACL",
    )
}
#[cfg(not(target_os = "macos"))]
pub(crate) fn reject_acl(_: &File) -> Result<()> {
    Err(Error::new("UNSUPPORTED_PLATFORM"))
}

#[cfg(target_os = "macos")]
pub(crate) fn read_xattrs(file: &File) -> Result<std::collections::BTreeMap<String, Vec<u8>>> {
    let mut names = [0i8; 4096];
    let n = unsafe { libc::flistxattr(file.as_raw_fd(), names.as_mut_ptr(), names.len(), 0) };
    require(n >= 0 && n < names.len() as isize, "UNSAFE_XATTR")?;
    let raw = unsafe { std::slice::from_raw_parts(names.as_ptr() as *const u8, n as usize) };
    let mut result = std::collections::BTreeMap::new();
    for name in raw.split(|b| *b == 0).filter(|s| !s.is_empty()) {
        require(name == b"com.apple.provenance", "UNSAFE_XATTR")?;
        let name = std::str::from_utf8(name).map_err(|_| Error::new("UNSAFE_XATTR"))?;
        let key = cstr(name)?;
        let mut value = vec![0u8; 4096];
        let n = unsafe {
            libc::fgetxattr(
                file.as_raw_fd(),
                key.as_ptr(),
                value.as_mut_ptr() as *mut _,
                value.len(),
                0,
                0,
            )
        };
        require(n >= 0 && n < value.len() as isize, "UNSAFE_XATTR")?;
        value.truncate(n as usize);
        result.insert(name.into(), value);
    }
    Ok(result)
}

/// Only for compiled-in Apple platform executables, never artifact/loader inputs.
pub(crate) fn validate_platform_file(file: &File) -> Result<()> {
    let m = file.metadata()?;
    require(
        m.is_file() && m.nlink() == 1 && m.uid() == 0 && m.gid() == 0 && m.mode() & 0o7022 == 0,
        "UNSAFE_PLATFORM_TOOL",
    )?;
    require(
        std::os::macos::fs::MetadataExt::st_flags(&m) & !0x80020 == 0,
        "UNSAFE_FLAGS",
    )?;
    reject_acl(file)
}
