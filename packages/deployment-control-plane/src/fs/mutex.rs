use super::{
    file::snapshot,
    secure::{validate, Dir},
};
use crate::{error::require, Error, Result};
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
        Self::acquire_mode(root, create, false)
    }
    pub(crate) fn acquire_readonly(root: &Dir) -> Result<Self> {
        Self::acquire_mode(root, false, true)
    }
    fn acquire_mode(root: &Dir, create: bool, readonly: bool) -> Result<Self> {
        let flags = (if readonly {
            libc::O_RDONLY
        } else {
            libc::O_RDWR
        }) | if create { libc::O_CREAT } else { 0 };
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
        if !readonly {
            match root.open_file("runtime-closure-recovery-pending.json", libc::O_RDONLY, 0) {
                Err(error) if error.code() == "ABSENT" => (),
                Err(error) => return Err(error),
                Ok(pending) => {
                    let image = snapshot(&pending, root.uid, 64 * 1024)?;
                    let value = crate::verification::documents::strict_json(&image.bytes)?;
                    require(
                        value["operation_id"]
                            == "pdc-fasttrack-runtime-closure-recovery-20260921-02"
                            && value["state"] == "MUTATION_PENDING"
                            && value["retry_forbidden"] == true
                            && value.as_object().is_some_and(|v| v.len() == 3),
                        "RUNTIME_CLOSURE_PENDING_MALFORMED",
                    )?;
                    return Err(Error::new("RUNTIME_CLOSURE_QUARANTINED"));
                }
            }
        }
        if !readonly {
            file.sync_all()?;
            root.file.sync_all()?;
        }
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn durable_runtime_closure_pending_blocks_mutation_but_not_read_only_join() {
        let temp = tempfile::tempdir_in(crate::fs::FixtureRoots::kernel_temp().unwrap()).unwrap();
        let uid = unsafe { libc::geteuid() };
        let gid = unsafe { libc::getegid() };
        let root = Dir::open(temp.path(), uid).unwrap();
        crate::fs::file::write_new(&root, "production.lock", b"", uid, gid, 0o600).unwrap();
        drop(MutationGuard::acquire(&root, false).unwrap());
        crate::fs::file::write_new(
            &root,
            "runtime-closure-recovery-pending.json",
            br#"{"operation_id":"pdc-fasttrack-runtime-closure-recovery-20260921-02","retry_forbidden":true,"state":"MUTATION_PENDING"}"#,
            uid,
            gid,
            0o400,
        )
        .unwrap();
        assert_eq!(
            MutationGuard::acquire(&root, false).err().unwrap().code(),
            "RUNTIME_CLOSURE_QUARANTINED"
        );
        drop(MutationGuard::acquire_readonly(&root).unwrap());
    }

    #[test]
    fn malformed_runtime_closure_pending_fails_closed() {
        let temp = tempfile::tempdir_in(crate::fs::FixtureRoots::kernel_temp().unwrap()).unwrap();
        let uid = unsafe { libc::geteuid() };
        let gid = unsafe { libc::getegid() };
        let root = Dir::open(temp.path(), uid).unwrap();
        crate::fs::file::write_new(&root, "production.lock", b"", uid, gid, 0o600).unwrap();
        crate::fs::file::write_new(
            &root,
            "runtime-closure-recovery-pending.json",
            br#"{"state":"MUTATION_PENDING"}"#,
            uid,
            gid,
            0o400,
        )
        .unwrap();
        assert_eq!(
            MutationGuard::acquire(&root, false).err().unwrap().code(),
            "RUNTIME_CLOSURE_PENDING_MALFORMED"
        );
    }
}
