//! Current loader namespace only. Never retain argv, environment values, or their hashes.
use super::{context::Context, reader};
use crate::{error::require, Error, Result};
use std::collections::BTreeSet;
const LIMIT: usize = 1024 * 1024;
struct Sensitive(Vec<u8>);
impl Drop for Sensitive {
    fn drop(&mut self) {
        for byte in &mut self.0 {
            unsafe { std::ptr::write_volatile(byte, 0) };
        }
    }
}
fn key(name: &[u8]) -> Result<()> {
    require(
        !name.is_empty() && name.iter().all(|b| b.is_ascii_alphanumeric() || *b == b'_'),
        "HOST_ENVIRONMENT_SHAPE",
    )?;
    require(
        !name.starts_with(b"DYLD_")
            && !name.starts_with(b"__XPC_DYLD_")
            && name != b"LD_PRELOAD"
            && name != b"LD_LIBRARY_PATH",
        "HOST_LOADER_ENVIRONMENT",
    )
}
fn nul<'a>(bytes: &'a [u8], cursor: &mut usize) -> Result<&'a [u8]> {
    let end = bytes
        .get(*cursor..)
        .and_then(|b| b.iter().position(|c| *c == 0))
        .ok_or_else(|| Error::new("HOST_ENVIRONMENT_SHAPE"))?
        + *cursor;
    let value = &bytes[*cursor..end];
    *cursor = end + 1;
    Ok(value)
}
fn arguments(bytes: &[u8]) -> Result<()> {
    require(
        bytes.len() >= 8 && bytes.len() < LIMIT,
        "HOST_ENVIRONMENT_SHAPE",
    )?;
    let argc = i32::from_ne_bytes(bytes[..4].try_into().unwrap());
    require((1..=4096).contains(&argc), "HOST_ENVIRONMENT_SHAPE")?;
    let mut cursor = 4;
    require(
        !nul(bytes, &mut cursor)?.is_empty(),
        "HOST_ENVIRONMENT_SHAPE",
    )?;
    while bytes.get(cursor) == Some(&0) {
        cursor += 1;
    }
    for _ in 0..argc {
        nul(bytes, &mut cursor)?;
    }
    let mut seen = BTreeSet::new();
    while cursor < bytes.len() {
        let entry = nul(bytes, &mut cursor)?;
        if entry.is_empty() {
            return require(
                bytes[cursor..].iter().all(|b| *b == 0),
                "HOST_ENVIRONMENT_SHAPE",
            );
        }
        let split = entry
            .iter()
            .position(|b| *b == b'=')
            .ok_or_else(|| Error::new("HOST_ENVIRONMENT_SHAPE"))?;
        let name = &entry[..split];
        key(name)?;
        require(
            seen.len() < 4096 && seen.insert(name),
            "HOST_ENVIRONMENT_SHAPE",
        )?;
    }
    Err(Error::new("HOST_ENVIRONMENT_SHAPE"))
}
fn domain(raw: &str) -> Result<()> {
    require(
        raw.len() < LIMIT && !raw.contains('\0'),
        "HOST_ENVIRONMENT_SHAPE",
    )?;
    let lines: Vec<_> = raw.lines().collect();
    require(
        lines.first() == Some(&"system = {") && lines.last() == Some(&"}"),
        "HOST_ENVIRONMENT_SHAPE",
    )?;
    let mut blocks = BTreeSet::new();
    let mut inside = false;
    let mut names = BTreeSet::new();
    let mut depth = 1usize;
    for line in &lines[1..lines.len() - 1] {
        let tabs = line.bytes().take_while(|byte| *byte == b'\t').count();
        let field = &line[tabs..];
        let normalized = field.trim_start_matches(|value: char| value.is_ascii_whitespace());
        if (normalized.starts_with("environment") || normalized.starts_with("default environment"))
            && normalized != field
        {
            return Err(Error::new("HOST_ENVIRONMENT_SHAPE"));
        }
        if field == "}" {
            require(depth > 1 && tabs + 1 == depth, "HOST_ENVIRONMENT_SHAPE")?;
            depth -= 1;
            if inside {
                require(tabs == 1, "HOST_ENVIRONMENT_SHAPE")?;
                inside = false;
            }
            continue;
        }
        if field.ends_with(" = {") {
            require(tabs == depth, "HOST_ENVIRONMENT_SHAPE")?;
            depth = depth
                .checked_add(1)
                .ok_or_else(|| Error::new("HOST_ENVIRONMENT_SHAPE"))?;
        }
        if inside {
            require(tabs == depth, "HOST_ENVIRONMENT_SHAPE")?;
            let (name, _) = field
                .split_once(" => ")
                .ok_or_else(|| Error::new("HOST_ENVIRONMENT_SHAPE"))?;
            key(name.as_bytes())?;
            require(names.insert(name), "HOST_ENVIRONMENT_SHAPE")?;
        } else if matches!(field, "environment = {" | "default environment = {") {
            require(depth == 2 && blocks.insert(field), "HOST_ENVIRONMENT_SHAPE")?;
            inside = true;
            names.clear();
        } else if field.starts_with("environment") || field.starts_with("default environment") {
            return Err(Error::new("HOST_ENVIRONMENT_SHAPE"));
        }
    }
    require(!inside && depth == 1, "HOST_ENVIRONMENT_SHAPE")
}
pub(super) fn running(pid: u32) -> Result<String> {
    require(
        unsafe { libc::geteuid() } == 0 && pid > 0 && pid <= i32::MAX as u32,
        "HOST_ENVIRONMENT_IDENTITY",
    )?;
    let before = reader::identity(pid)?;
    let mut raw = Sensitive(vec![0; LIMIT]);
    let mut length = raw.0.len();
    let mut mib = [libc::CTL_KERN, libc::KERN_PROCARGS2, pid as i32];
    let status = unsafe {
        libc::sysctl(
            mib.as_mut_ptr(),
            3,
            raw.0.as_mut_ptr().cast(),
            &mut length,
            std::ptr::null_mut(),
            0,
        )
    };
    require(status == 0 && length < LIMIT, "HOST_ENVIRONMENT_UNREADABLE")?;
    arguments(&raw.0[..length])?;
    require(reader::identity(pid)? == before, "HOST_ENVIRONMENT_DRIFT")?;
    crate::trust::digest(&serde_json::json!({"identity":before,"loader_namespace":"absent-v1"}))
}
pub(super) fn global(ctx: &Context<'_>) -> Result<String> {
    use crate::first_live::process::{self, Tool};
    ctx.check()?;
    let out = process::run(
        Tool::Launchctl,
        &ctx.packet.native_enrollment.launchctl_sha256,
        &["print".into(), "system".into()],
        None,
        5,
    )?;
    let stdout = Sensitive(out.stdout.into_bytes());
    let stderr = Sensitive(out.stderr.into_bytes());
    require(
        out.code == Some(0) && stderr.0.is_empty(),
        "HOST_ENVIRONMENT_UNREADABLE",
    )?;
    domain(std::str::from_utf8(&stdout.0).map_err(|_| Error::new("HOST_ENVIRONMENT_SHAPE"))?)?;
    ctx.check()?;
    crate::trust::digest(
        &serde_json::json!({"operation_id":ctx.packet.operation_id,"launchctl":ctx.packet.native_enrollment.launchctl_sha256,"system_loader_namespace":"absent-v1"}),
    )
}
#[cfg(test)]
#[path = "../../../../test/first_live/host/environment.rs"]
mod tests;
