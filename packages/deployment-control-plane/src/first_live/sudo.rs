//! Exact Apple sudo entry; does not weaken the generic platform tool validator.
use super::process::{self, Output, Tool};
use crate::{error::require, fs::secure::reject_acl, Result};
use serde::Serialize;
use std::{ffi::CStr, fs::File, os::unix::fs::MetadataExt};
#[derive(Clone, Debug, PartialEq, Eq)]
struct Tuple {
    file: bool,
    uid: u32,
    gid: u32,
    mode: u32,
    links: u64,
    flags: u32,
    device: u64,
    inode: u64,
    size: u64,
    mtime: i64,
    mtime_ns: i64,
    ctime: i64,
    ctime_ns: i64,
    birth: i64,
    birth_ns: i64,
}
const FROZEN: Tuple = Tuple {
    file: true,
    uid: 0,
    gid: 0,
    mode: 0o4511,
    links: 1,
    flags: 0x80020,
    device: 16777230,
    inode: 1152921500312572854,
    size: 1575952,
    mtime: 1786589515,
    mtime_ns: 0,
    ctime: 1786589515,
    ctime_ns: 0,
    birth: 1786589515,
    birth_ns: 0,
};
fn exact(v: &Tuple) -> Result<()> {
    require(*v == FROZEN, "FIRST_LIVE_SUDO_METADATA")
}
pub(super) fn metadata(file: &File) -> Result<()> {
    let m = file.metadata()?;
    let v = Tuple {
        file: m.is_file(),
        uid: m.uid(),
        gid: m.gid(),
        mode: m.mode() & 0o7777,
        links: m.nlink(),
        flags: std::os::macos::fs::MetadataExt::st_flags(&m),
        device: m.dev(),
        inode: m.ino(),
        size: m.len(),
        mtime: m.mtime(),
        mtime_ns: m.mtime_nsec(),
        ctime: m.ctime(),
        ctime_ns: m.ctime_nsec(),
        birth: std::os::macos::fs::MetadataExt::st_birthtime(&m),
        birth_ns: std::os::macos::fs::MetadataExt::st_birthtime_nsec(&m),
    };
    exact(&v)?;
    reject_acl(file)
}
fn account(uid: u32) -> Result<(&'static str, u32)> {
    match uid {
        505 => Ok(("authsvc", 601)),
        612 => Ok(("_dcp_review", 612)),
        _ => Err(crate::Error::new("FIRST_LIVE_SUDO_IDENTITY")),
    }
}
fn no_commands(uid: u32, out: &Output) -> Result<()> {
    let (name, _) = account(uid)?;
    // sudo v1.9.17p2 display_privs: successful listing with zero rules is
    // exactly one INFO (stdout) sentence. policy_list exits0 on true, not1.
    require(
        out.code == Some(0)
            && out.stderr.is_empty()
            && out.stdout == format!("User {name} is not allowed to run sudo on MacBook-Pro.\n"),
        "FIRST_LIVE_SERVICE_SUDO_POLICY",
    )
}
fn identity(uid: u32) -> Result<()> {
    let (name, gid) = account(uid)?;
    let mut pwd: libc::passwd = unsafe { std::mem::zeroed() };
    let mut buffer = [0i8; 16384];
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
            && !result.is_null()
            && !pwd.pw_name.is_null(),
        "FIRST_LIVE_SUDO_IDENTITY",
    )?;
    require(
        pwd.pw_uid == uid
            && pwd.pw_gid == gid
            && unsafe { CStr::from_ptr(pwd.pw_name) }.to_bytes() == name.as_bytes(),
        "FIRST_LIVE_SUDO_IDENTITY",
    )?;
    let mut host = [0i8; 256];
    require(
        unsafe { libc::gethostname(host.as_mut_ptr(), host.len()) } == 0,
        "FIRST_LIVE_SUDO_HOST",
    )?;
    let end = host
        .iter()
        .position(|v| *v == 0)
        .ok_or(crate::Error::new("FIRST_LIVE_SUDO_HOST"))?;
    require(
        host[..end]
            .iter()
            .map(|v| *v as u8)
            .eq(b"MacBook-Pro.local".iter().copied()),
        "FIRST_LIVE_SUDO_HOST",
    )
}
#[derive(Serialize)]
pub(super) struct Report {
    uid: u32,
    username: &'static str,
    output: Output,
}
pub(super) fn audit(pin: &str) -> Result<Vec<Report>> {
    require(unsafe { libc::geteuid() } == 0, "FIRST_LIVE_REQUIRES_ROOT")?;
    let mut reports = Vec::new();
    for uid in [505, 612] {
        identity(uid)?;
        let output = process::run(
            Tool::SudoAudit,
            pin,
            &["-n".into(), "-l".into(), "-U".into(), format!("#{uid}")],
            None,
            5,
        )?;
        identity(uid)?;
        no_commands(uid, &output)?;
        reports.push(Report {
            uid,
            username: account(uid)?.0,
            output,
        });
    }
    Ok(reports)
}
#[cfg(test)]
#[path = "../../test/first_live/sudo.rs"]
mod tests;
