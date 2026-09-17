mod mutex;
pub(crate) mod secure;
use crate::{error::require, Result};
pub use mutex::MutationGuard;
use secure::Dir;
use std::path::Path;

/// Isolated non-root construction; all targets remain descendants of this root.
pub struct FixtureRoots {
    pub(crate) root: Dir,
}
impl FixtureRoots {
    pub fn open(path: &Path) -> Result<Self> {
        let uid = unsafe { libc::geteuid() };
        require(uid != 0, "FIXTURE_REFUSES_ROOT")?;
        // Kernel-selected per-user temp root; TMPDIR cannot widen fixture authority.
        let mut buffer = [0i8; 4096];
        let length = unsafe {
            libc::confstr(
                libc::_CS_DARWIN_USER_TEMP_DIR,
                buffer.as_mut_ptr(),
                buffer.len(),
            )
        };
        require(
            length > 0 && length <= buffer.len(),
            "FIXTURE_TEMP_UNAVAILABLE",
        )?;
        let physical = unsafe { std::ffi::CStr::from_ptr(buffer.as_ptr()) }
            .to_str()
            .map_err(|_| crate::Error::new("FIXTURE_TEMP_UNAVAILABLE"))?;
        let temp = std::fs::canonicalize(physical)?;
        require(
            path.starts_with(&temp) && path != temp,
            "FIXTURE_OUTSIDE_TEMP",
        )?;
        let root = Dir::open(path, uid)?;
        use std::os::unix::fs::PermissionsExt;
        require(
            root.file.metadata()?.permissions().mode() & 0o777 == 0o700,
            "UNSAFE_MODE",
        )?;
        Ok(Self { root })
    }
    pub fn lock(&self) -> Result<MutationGuard> {
        MutationGuard::acquire(&self.root, true)
    }
}
pub(crate) mod artifact;
pub use artifact::{ArtifactEntry, ArtifactManifest, ArtifactStore, SealedArtifact};
impl FixtureRoots {
    pub fn artifacts(&self) -> Result<ArtifactStore> {
        Ok(ArtifactStore {
            staging: self.root.mkdir("staging")?,
            sealed: self.root.mkdir("sealed")?,
        })
    }
}

pub(crate) mod file;
mod target;
pub use file::FileImage;
pub use target::TargetRoot;
impl FixtureRoots {
    pub fn target(&self) -> Result<TargetRoot> {
        Ok(TargetRoot {
            dir: self.root.mkdir("target")?,
        })
    }
}
