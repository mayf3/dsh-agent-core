//! Sole exception to generic ancestor mode checks, restricted to the canonical OS socket parent.
use crate::{
    error::require,
    fs::secure::{reject_acl, Dir},
    Result,
};
use serde::{Deserialize, Serialize};
use std::{
    collections::{BTreeMap, BTreeSet},
    os::unix::fs::MetadataExt,
    path::Path,
};
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct SocketAncestor {
    pub host: String,
    pub device: u64,
    pub inode: u64,
    pub uid: u32,
    pub gid: u32,
    pub mode: u32,
    pub flags: u32,
    pub acl_none: bool,
    pub memberships: BTreeMap<u32, Vec<u32>>,
    pub denial_receipt: String,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub(crate) struct SocketAncestorPlan {
    pub host: String,
    pub device: u64,
    pub inode: u64,
    pub uid: u32,
    pub gid: u32,
    pub mode: u32,
    pub flags: u32,
    pub acl_none: bool,
    pub memberships: BTreeMap<u32, Vec<u32>>,
}
impl SocketAncestorPlan {
    pub fn validate(&self, host: &str, identities: &BTreeSet<u32>) -> Result<()> {
        require(
            self.host == host
                && self.uid == 0
                && self.gid == 1
                && self.mode == 0o775
                && self.flags == 0
                && self.acl_none
                && self.device != 0
                && self.inode != 0,
            "SOCKET_ANCESTOR_BINDING",
        )?;
        // Root W2 is explicitly trusted root code; no root-write-denial fiction.
        let required = identities
            .iter()
            .copied()
            .filter(|u| *u != 0)
            .collect::<BTreeSet<_>>();
        require(
            self.memberships.keys().copied().collect::<BTreeSet<_>>() == required,
            "SOCKET_GROUP_CENSUS",
        )?;
        for groups in self.memberships.values() {
            require(
                !groups.is_empty() && groups.len() <= 256 && !groups.contains(&1),
                "SOCKET_ANCESTOR_WRITABLE",
            )?;
        }
        Ok(())
    }
}
impl SocketAncestorPlan {
    pub(crate) fn check_retained_parent(&self, parent: &Dir) -> Result<()> {
        check_physical(parent, self)
    }
    pub(crate) fn bind(&self, denial_receipt: &str) -> Result<SocketAncestor> {
        crate::trust::valid_digest(denial_receipt)?;
        Ok(SocketAncestor {
            host: self.host.clone(),
            device: self.device,
            inode: self.inode,
            uid: self.uid,
            gid: self.gid,
            mode: self.mode,
            flags: self.flags,
            acl_none: self.acl_none,
            memberships: self.memberships.clone(),
            denial_receipt: denial_receipt.into(),
        })
    }
    pub(crate) fn preflight(&self, socket_gid: u32, identities: &BTreeSet<u32>) -> Result<()> {
        self.open_preflight(socket_gid, identities).map(|_| ())
    }
    pub(crate) fn open_preflight(
        &self,
        socket_gid: u32,
        identities: &BTreeSet<u32>,
    ) -> Result<Dir> {
        self.validate(&super::observed_host()?, identities)?;
        let var = Dir::open(Path::new("/private/var"), 0)?;
        let parent = Dir {
            file: var.open_file("run", libc::O_RDONLY | libc::O_DIRECTORY, 0)?,
            uid: 0,
        };
        check_physical(&parent, self)?;
        let child = parent.child("agent-deployd")?;
        require(
            child.file.metadata()?.mode() & 0o7777 == 0o750
                && child.file.metadata()?.gid() == socket_gid,
            "SOCKET_BINDING",
        )?;
        let named = Dir {
            file: var.open_file("run", libc::O_RDONLY | libc::O_DIRECTORY, 0)?,
            uid: 0,
        };
        check_physical(&named, self)?;
        let current = named.child("agent-deployd")?.file.metadata()?;
        let retained = child.file.metadata()?;
        require(
            (current.dev(), current.ino()) == (retained.dev(), retained.ino()),
            "SOCKET_ANCESTOR_REPLACED",
        )?;
        Ok(parent)
    }
}
impl From<&SocketAncestor> for SocketAncestorPlan {
    fn from(p: &SocketAncestor) -> Self {
        Self {
            host: p.host.clone(),
            device: p.device,
            inode: p.inode,
            uid: p.uid,
            gid: p.gid,
            mode: p.mode,
            flags: p.flags,
            acl_none: p.acl_none,
            memberships: p.memberships.clone(),
        }
    }
}
impl SocketAncestor {
    pub fn validate(&self, host: &str, identities: &BTreeSet<u32>) -> Result<()> {
        crate::trust::valid_digest(&self.denial_receipt)?;
        SocketAncestorPlan::from(self).validate(host, identities)
    }
}

pub(crate) fn groups(uid: u32) -> Result<Vec<u32>> {
    let mut pwd: libc::passwd = unsafe { std::mem::zeroed() };
    let mut buffer = vec![0i8; 16384];
    let mut result = std::ptr::null_mut();
    require(
        unsafe {
            libc::getpwuid_r(
                uid,
                &mut pwd,
                buffer.as_mut_ptr(),
                buffer.len(),
                &mut result,
            )
        } == 0
            && !result.is_null(),
        "SOCKET_GROUP_CENSUS",
    )?;
    let mut values = [0u32; 256];
    let mut count = 256;
    require(
        unsafe {
            libc::getgrouplist(
                pwd.pw_name,
                pwd.pw_gid as i32,
                values.as_mut_ptr() as *mut i32,
                &mut count,
            )
        } >= 0
            && count > 0
            && count <= 256,
        "SOCKET_GROUP_CENSUS",
    )?;
    let mut values = values[..count as usize].to_vec();
    values.sort();
    values.dedup();
    Ok(values)
}
pub(crate) struct SocketDirectory {
    parent: Dir,
    pub child: Dir,
    proof: SocketAncestor,
    socket_gid: u32,
}
impl SocketDirectory {
    pub fn open(
        proof: &SocketAncestor,
        socket_gid: u32,
        identities: &BTreeSet<u32>,
    ) -> Result<Self> {
        proof.validate(&super::observed_host()?, identities)?;
        let var = Dir::open(Path::new("/private/var"), 0)?;
        let file = var.open_file("run", libc::O_RDONLY | libc::O_DIRECTORY, 0)?;
        let parent = Dir { file, uid: 0 };
        check(&parent, proof)?;
        let child = parent.child("agent-deployd")?;
        require(
            child.file.metadata()?.mode() & 0o7777 == 0o750
                && child.file.metadata()?.gid() == socket_gid,
            "SOCKET_BINDING",
        )?;
        let result = Self {
            parent,
            child,
            proof: proof.clone(),
            socket_gid,
        };
        result.recheck()?;
        Ok(result)
    }
    pub fn recheck(&self) -> Result<()> {
        check(&self.parent, &self.proof)?;
        let var = Dir::open(Path::new("/private/var"), 0)?;
        let named = Dir {
            file: var.open_file("run", libc::O_RDONLY | libc::O_DIRECTORY, 0)?,
            uid: 0,
        };
        check(&named, &self.proof)?;
        let child = named.child("agent-deployd")?;
        let actual = child.file.metadata()?;
        let retained = self.child.file.metadata()?;
        require(
            (actual.dev(), actual.ino()) == (retained.dev(), retained.ino())
                && actual.mode() & 0o7777 == 0o750
                && actual.gid() == self.socket_gid,
            "SOCKET_ANCESTOR_REPLACED",
        )
    }
}
fn check(dir: &Dir, proof: &SocketAncestor) -> Result<()> {
    check_physical(dir, &SocketAncestorPlan::from(proof))
}
fn check_physical(dir: &Dir, proof: &SocketAncestorPlan) -> Result<()> {
    let m = dir.file.metadata()?;
    require(
        m.is_dir()
            && (m.dev(), m.ino(), m.uid(), m.gid(), m.mode() & 0o7777)
                == (proof.device, proof.inode, proof.uid, proof.gid, proof.mode)
            && std::os::macos::fs::MetadataExt::st_flags(&m) == proof.flags,
        "SOCKET_ANCESTOR_REPLACED",
    )?;
    reject_acl(&dir.file)?;
    for (uid, expected) in &proof.memberships {
        let mut expected = expected.clone();
        expected.sort();
        expected.dedup();
        require(
            groups(*uid)? == expected && !expected.contains(&1),
            "SOCKET_ANCESTOR_WRITABLE",
        )?;
    }
    Ok(())
}

#[cfg(test)]
#[path = "../../test/common/socket_ancestor.rs"]
mod tests;
