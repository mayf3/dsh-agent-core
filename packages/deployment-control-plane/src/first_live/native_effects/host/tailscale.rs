//! Fixed one-time Tailscale same-byte path transition, never a service manager.
use super::{context::Context, credentials::Identity};
#[path = "tailscale_io.rs"]
mod io;
#[path = "tailscale_native.rs"]
mod native;
#[path = "tailscale_state.rs"]
mod state;
#[path = "tailscale_status.rs"]
mod status;
use crate::Result;
pub(super) const LABEL: &str = "system/com.tailscale.tailscaled";
pub(super) const PLIST: &str = "com.tailscale.tailscaled.plist";
pub(super) const OLD: &str = "/usr/local/Cellar/tailscale/1.94.2/bin/tailscaled";
pub(super) const NEW: &str = "/usr/local/libexec/tailscale-sealed/tailscaled";
pub(super) const OLD_PLIST: &str =
    "d8b2ca94c6fe9d417f7541c882d87b95a4bdea8a5a6a4e80484e7e9a7e11ffdf";
pub(super) const NEW_PLIST: &str =
    "ec12e0c62acf5cd44984fdf8474dca8fafc098842c2a9f8c3f62bfb03caa19f8";
pub(super) const PAYLOAD: &str = "5d9c03785aa534b0bd42071f1b7632474ae932e876dcaa7fd3866f685010d8da";
fn old_leaf(
    dir: &crate::fs::secure::Dir,
    uid: u32,
    gid: u32,
    size: u64,
    digest: &str,
) -> Result<()> {
    use crate::{
        error::require,
        fs::file::{sha, snapshot},
    };
    use std::os::{fd::AsRawFd, unix::fs::MetadataExt};
    let stat = || -> Result<libc::stat> {
        let mut s: libc::stat = unsafe { std::mem::zeroed() };
        require(
            unsafe {
                libc::fstatat(
                    dir.file.as_raw_fd(),
                    c"tailscaled".as_ptr(),
                    &mut s,
                    libc::AT_SYMLINK_NOFOLLOW,
                )
            } == 0
                && s.st_mode & libc::S_IFMT == libc::S_IFREG
                && s.st_uid == uid
                && s.st_gid == gid
                && s.st_mode & 0o7777 == 0o555
                && s.st_nlink == 1
                && s.st_size == size as i64
                && s.st_flags == 0,
            "TAILSCALE_OLD_PREIMAGE",
        )?;
        Ok(s)
    };
    // Reject symlinks, hardlinks, foreign owners, devices and special files
    // before reading bytes with privilege. The one leaf name is compiled.
    let before = stat()?;
    let file = dir.open_file("tailscaled", libc::O_RDONLY, 0)?;
    let m = file.metadata()?;
    require(
        (
            m.dev(),
            m.ino(),
            m.uid(),
            m.gid(),
            m.mode() & 0o7777,
            m.nlink(),
            m.len(),
        ) == (
            before.st_dev as u64,
            before.st_ino,
            uid,
            gid,
            0o555,
            1,
            size,
        ),
        "TAILSCALE_OLD_PREIMAGE",
    )?;
    let value = snapshot(&file, uid, size)?;
    let after = stat()?;
    require(
        sha(&value.bytes) == digest
            && (after.st_dev, after.st_ino) == (before.st_dev, before.st_ino),
        "TAILSCALE_OLD_PREIMAGE",
    )
}
fn old_preimage() -> Result<()> {
    use crate::{
        error::require,
        fs::secure::{reject_acl, Dir},
    };
    use std::{
        os::{macos::fs::MetadataExt as MacMetadataExt, unix::fs::MetadataExt},
        path::Path,
    };
    fn chain() -> Result<Vec<Dir>> {
        let mut dirs = vec![Dir::open(Path::new("/usr/local"), 0)?];
        for (name, mode) in [
            ("Cellar", 0o775),
            ("tailscale", 0o755),
            ("1.94.2", 0o755),
            ("bin", 0o755),
        ] {
            let f = dirs
                .last()
                .unwrap()
                .open_file(name, libc::O_RDONLY | libc::O_DIRECTORY, 0)?;
            let m = f.metadata()?;
            require(
                m.is_dir()
                    && m.uid() == 502
                    && m.gid() == 80
                    && m.mode() & 0o7777 == mode
                    && m.st_flags() == 0,
                "TAILSCALE_OLD_PARENT",
            )?;
            reject_acl(&f)?;
            dirs.push(Dir { file: f, uid: 502 });
        }
        Ok(dirs)
    }
    let before = chain()?;
    old_leaf(before.last().unwrap(), 502, 80, 23331104, PAYLOAD)?;
    let after = chain()?;
    for (old, new) in before.iter().zip(after.iter()) {
        let a = old.file.metadata()?;
        let b = new.file.metadata()?;
        require(
            (a.dev(), a.ino()) == (b.dev(), b.ino()),
            "TAILSCALE_OLD_PARENT",
        )?;
    }
    old_leaf(after.last().unwrap(), 502, 80, 23331104, PAYLOAD)
}
#[cfg(test)]
#[path = "../../../../test/first_live/host/tailscale_preimage.rs"]
mod preimage_tests;
pub(super) struct Tailscale {
    original: Identity,
    status: String,
    state_directory: (u64, u64),
    transition: state::Transition,
    failed: std::cell::Cell<bool>,
}
pub(super) fn prepare(ctx: &Context<'_>) -> Result<Tailscale> {
    native::prepare(ctx)
}
impl Tailscale {
    pub(super) fn transition_identity(&self) -> &Identity {
        &self.original
    }
    pub(super) fn sealed_identity(&self) -> Option<&Identity> {
        if self.failed.get() {
            None
        } else {
            self.transition.sealed.as_ref().map(|v| &v.0)
        }
    }
    pub(super) fn is_closed(&self) -> bool {
        !self.failed.get() && self.transition.sealed.is_some()
    }
    pub(super) fn switch(&mut self, ctx: &Context<'_>) -> Result<()> {
        let mut effects = native::Native {
            ctx,
            old: &self.original,
            status: &self.status,
            state_directory: self.state_directory,
        };
        let result = self.transition.run(&mut effects);
        if result.is_err() {
            self.failed.set(true);
        }
        result
    }
    pub(super) fn verify(&self, ctx: &Context<'_>) -> Result<String> {
        crate::error::require(!self.failed.get(), "TAILSCALE_PROOF_INVALIDATED")?;
        let result = native::verify(self, ctx);
        if result.is_err() {
            self.failed.set(true);
        }
        result
    }
}
