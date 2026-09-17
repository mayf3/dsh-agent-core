//! Complete non-system Mach-O closure: no rpath, environment or Homebrew resolution.
use crate::{error::require, Error, Result};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};
pub const MAX_LOADER_FILE: u64 = 128 * 1024 * 1024;
pub const MAX_LOADER_TOTAL: u64 = 512 * 1024 * 1024;
#[derive(Clone, Copy)]
pub enum ClosureKind {
    Controller,
    Runtime,
}
impl ClosureKind {
    fn root(self) -> &'static str {
        match self {
            Self::Controller => "/usr/local/libexec/agent-deployd/",
            Self::Runtime => "/usr/local/libexec/agent-core/node-runtime/",
        }
    }
    fn entry(self) -> &'static str {
        match self {
            Self::Controller => "/usr/local/libexec/agent-deployd/agent-deployd",
            Self::Runtime => "/usr/local/libexec/agent-core/node-runtime/bin/node",
        }
    }
    fn cpu(self) -> u32 {
        match self {
            Self::Runtime => 0x01000007, // Preserve observed Node x86_64 ABI.
            Self::Controller if cfg!(target_arch = "aarch64") => 0x0100000c,
            Self::Controller => 0x01000007,
        }
    }
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct LoaderFile {
    pub path: String,
    pub sha256: String,
}
fn word(b: &[u8], n: usize) -> Result<u32> {
    Ok(u32::from_le_bytes(
        b.get(n..n + 4)
            .ok_or(Error::new("LOADER_FORMAT"))?
            .try_into()
            .unwrap(),
    ))
}
fn name(command: &[u8]) -> Result<&str> {
    let offset = word(command, 8)? as usize;
    require(offset >= 12 && offset < command.len(), "LOADER_FORMAT")?;
    let value = &command[offset..];
    let end = value
        .iter()
        .position(|c| *c == 0)
        .ok_or(Error::new("LOADER_FORMAT"))?;
    std::str::from_utf8(&value[..end]).map_err(|_| Error::new("LOADER_FORMAT"))
}
fn canonical(path: &str) -> bool {
    path.starts_with('/')
        && path[1..].split('/').all(|p| {
            !p.is_empty()
                && p != "."
                && p != ".."
                && p.bytes()
                    .all(|b| b.is_ascii_alphanumeric() || b"._-+".contains(&b))
        })
}
fn platform(path: &str) -> bool {
    // Apple's sealed system/shared-cache namespace is a platform trust boundary.
    canonical(path)
        && (path.starts_with("/usr/lib/") || path.starts_with("/System/Library/Frameworks/"))
}
fn loads(bytes: &[u8], cpu: u32) -> Result<Vec<String>> {
    require(
        bytes.len() >= 32 && word(bytes, 0)? == 0xfeedfacf && word(bytes, 4)? == cpu,
        "LOADER_ARCHITECTURE",
    )?;
    let count = word(bytes, 16)? as usize;
    let size = word(bytes, 20)? as usize;
    require(
        count <= 4096 && size <= 4 * 1024 * 1024 && size <= bytes.len() - 32,
        "LOADER_FORMAT",
    )?;
    let mut offset = 32;
    let mut result = Vec::new();
    for _ in 0..count {
        let command = word(bytes, offset)?;
        let length = word(bytes, offset + 4)? as usize;
        require(
            length >= 8 && length.is_multiple_of(8) && length <= 32 + size - offset,
            "LOADER_FORMAT",
        )?;
        let data = &bytes[offset..offset + length];
        match command {
            12 | 0x80000018 | 0x8000001f | 0x80000023 | 0x20 => result.push(name(data)?.into()),
            0x0e => require(name(data)? == "/usr/lib/dyld", "LOADER_INTERPRETER")?,
            0x8000001c | 0x27 => return Err(Error::new("LOADER_DYNAMIC_SEARCH")),
            // Mach-O metadata commands; no code/path execution semantics.
            1 | 2 | 3 | 4 | 5 | 0xb | 0xd | 0x19 | 0x1b | 0x1d | 0x1e | 0x21 | 0x22
            | 0x80000022 | 0x24 | 0x25 | 0x26 | 0x28 | 0x80000028 | 0x29 | 0x2a | 0x2b | 0x2c
            | 0x2d | 0x2e | 0x2f | 0x30 | 0x31 | 0x32 | 0x80000033 | 0x80000034 | 0x36 => (),
            _ => return Err(Error::new("LOADER_COMMAND_UNSUPPORTED")),
        }
        offset += length;
    }
    require(offset == 32 + size, "LOADER_FORMAT")?;
    Ok(result)
}
pub fn verify_loader_images(kind: ClosureKind, images: &BTreeMap<String, Vec<u8>>) -> Result<()> {
    require(
        !images.is_empty() && images.len() <= 64,
        "LOADER_CLOSURE_LIMIT",
    )?;
    let mut total = 0u64;
    for (path, bytes) in images {
        require(
            canonical(path) && path.starts_with(kind.root()),
            "LOADER_PATH",
        )?;
        total += bytes.len() as u64;
        require(
            bytes.len() as u64 <= MAX_LOADER_FILE && total <= MAX_LOADER_TOTAL,
            "LOADER_CLOSURE_LIMIT",
        )?;
    }
    let mut visited = BTreeSet::new();
    let mut pending = vec![kind.entry().to_string()];
    while let Some(path) = pending.pop() {
        if !visited.insert(path.clone()) {
            continue;
        }
        let bytes = images
            .get(&path)
            .ok_or(Error::new("LOADER_CLOSURE_MISSING"))?;
        for load in loads(bytes, kind.cpu())? {
            if platform(&load) {
                continue;
            }
            require(
                canonical(&load) && load.starts_with(kind.root()),
                "LOADER_UNPROTECTED_DEPENDENCY",
            )?;
            pending.push(load);
        }
    }
    require(visited.len() == images.len(), "LOADER_UNREACHABLE_ENTRY")
}
pub(crate) fn installed(files: &[LoaderFile]) -> Result<()> {
    use crate::fs::{
        file::{sha, snapshot},
        secure::Dir,
    };
    use std::path::Path;
    require(
        !files.is_empty() && files.len() <= 64,
        "LOADER_CLOSURE_MISSING",
    )?;
    let mut images = BTreeMap::new();
    let mut total = 0;
    for file in files {
        require(
            canonical(&file.path) && file.path.starts_with(ClosureKind::Runtime.root()),
            "LOADER_PATH",
        )?;
        crate::trust::valid_digest(&file.sha256)?;
        let path = Path::new(&file.path);
        let dir = Dir::open(path.parent().unwrap(), 0)?;
        let image = snapshot(
            &dir.open_file(
                path.file_name().unwrap().to_str().unwrap(),
                libc::O_RDONLY,
                0,
            )?,
            0,
            MAX_LOADER_FILE,
        )?;
        total += image.bytes.len() as u64;
        require(
            total <= MAX_LOADER_TOTAL && sha(&image.bytes) == file.sha256,
            "SERVICE_DEPENDENCY_DRIFT",
        )?;
        require(
            images.insert(file.path.clone(), image.bytes).is_none(),
            "LOADER_DUPLICATE",
        )?;
    }
    verify_loader_images(ClosureKind::Runtime, &images)
}
/// Fixed Apple platform utility; callers cannot select a command/path.
pub fn verify_platform_launchctl(expected: &str) -> Result<()> {
    platform_tool(false, expected)
}
pub(crate) fn platform_tool(plutil: bool, expected: &str) -> Result<()> {
    use crate::fs::{
        file::sha,
        secure::{validate_platform_file, Dir},
    };
    use std::io::{Read, Seek, SeekFrom};
    use std::os::unix::fs::MetadataExt;
    crate::trust::valid_digest(expected)?;
    let dir = Dir::open(
        std::path::Path::new(if plutil { "/usr/bin" } else { "/bin" }),
        0,
    )?;
    let mut file = dir.open_file(
        if plutil { "plutil" } else { "launchctl" },
        libc::O_RDONLY,
        0,
    )?;
    validate_platform_file(&file)?;
    let before = file.metadata()?;
    require(before.len() <= 4 * 1024 * 1024, "SIZE_LIMIT")?;
    for _ in 0..2 {
        let mut bytes = Vec::new();
        file.seek(SeekFrom::Start(0))?;
        (&mut file)
            .take(4 * 1024 * 1024 + 1)
            .read_to_end(&mut bytes)?;
        require(
            bytes.len() as u64 == before.len() && sha(&bytes) == expected,
            "SERVICE_DEPENDENCY_DRIFT",
        )?;
    }
    validate_platform_file(&file)?;
    let after = file.metadata()?;
    require(
        before.ctime() == after.ctime() && before.ctime_nsec() == after.ctime_nsec(),
        "INPUT_CHANGED",
    )
}
