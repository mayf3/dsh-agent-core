use super::{genesis_install::GenesisInstallPolicy, genesis_install_io::hash_protected};
use crate::{
    error::require,
    fs::{
        file::sha,
        secure::{validate_platform_file, Dir},
    },
    Error, Result,
};
use std::{
    collections::BTreeMap,
    io::{Read, Seek, SeekFrom},
    path::Path,
    process::{Command, Stdio},
    time::{Duration, Instant},
};

pub(super) const DSCL: &str = "/usr/bin/dscl";
pub(super) const GROUP: &str = "/usr/sbin/dseditgroup";
#[cfg(test)]
pub(crate) static NATIVE_COMMAND_CALLS: std::sync::atomic::AtomicUsize =
    std::sync::atomic::AtomicUsize::new(0);

pub(super) fn tool(policy: &GenesisInstallPolicy, path: &str) -> Result<()> {
    require(matches!(path, DSCL | GROUP), "BOOTSTRAP_TOOL")?;
    let expected = policy
        .platform_tools
        .get(path)
        .ok_or(Error::new("BOOTSTRAP_TOOL_PIN"))?;
    crate::trust::valid_digest(expected)?;
    let path = Path::new(path);
    let root = Dir::open(path.parent().ok_or(Error::new("UNSAFE_PATH"))?, 0)?;
    let mut file = root.open_file(
        path.file_name().unwrap().to_str().unwrap(),
        libc::O_RDONLY,
        0,
    )?;
    validate_platform_file(&file)?;
    let mut bytes = Vec::new();
    (&mut file)
        .take(16 * 1024 * 1024 + 1)
        .read_to_end(&mut bytes)?;
    require(
        bytes.len() <= 16 * 1024 * 1024 && sha(&bytes) == *expected,
        "BOOTSTRAP_TOOL_DRIFT",
    )?;
    file.seek(SeekFrom::Start(0))?;
    validate_platform_file(&file)
}
pub(super) fn command(policy: &GenesisInstallPolicy, path: &str, args: &[&str]) -> Result<String> {
    #[cfg(test)]
    NATIVE_COMMAND_CALLS.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
    require(unsafe { libc::geteuid() } == 0, "ROOT_REQUIRED")?;
    tool(policy, path)?;
    let mut child = Command::new(path)
        .args(args)
        .env_clear()
        .current_dir("/")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()?;
    let stdout = child.stdout.take().ok_or(Error::new("BOOTSTRAP_COMMAND"))?;
    let reader = std::thread::spawn(move || {
        let mut bytes = Vec::new();
        stdout
            .take(4 * 1024 * 1024 + 1)
            .read_to_end(&mut bytes)
            .map(|_| bytes)
    });
    let start = Instant::now();
    let status = loop {
        if let Some(status) = child.try_wait()? {
            break status;
        }
        if start.elapsed() > Duration::from_secs(30) {
            let _ = child.kill();
            let _ = child.wait();
            let _ = reader.join();
            return Err(Error::new("BOOTSTRAP_COMMAND_TIMEOUT"));
        }
        std::thread::sleep(Duration::from_millis(25));
    };
    let bytes = reader
        .join()
        .map_err(|_| Error::new("BOOTSTRAP_COMMAND"))??;
    require(
        status.success() && bytes.len() <= 4 * 1024 * 1024,
        "BOOTSTRAP_COMMAND",
    )?;
    String::from_utf8(bytes).map_err(|_| Error::new("BOOTSTRAP_COMMAND"))
}
pub(super) fn identity_census(policy: &GenesisInstallPolicy) -> Result<String> {
    let users = command(policy, DSCL, &[".", "-list", "/Users", "UniqueID"])?;
    let groups = command(policy, DSCL, &[".", "-list", "/Groups", "PrimaryGroupID"])?;
    // Search-service identities must also be absent, not merely local dscl records.
    let mut passwd: libc::passwd = unsafe { std::mem::zeroed() };
    let mut group: libc::group = unsafe { std::mem::zeroed() };
    let mut buffer = vec![0i8; 65536];
    let mut user_result = std::ptr::null_mut();
    let mut group_result = std::ptr::null_mut();
    for by_name in [false, true] {
        let status = unsafe {
            if by_name {
                libc::getpwnam_r(
                    c"_dcp_review".as_ptr(),
                    &mut passwd,
                    buffer.as_mut_ptr(),
                    buffer.len(),
                    &mut user_result,
                )
            } else {
                libc::getpwuid_r(
                    612,
                    &mut passwd,
                    buffer.as_mut_ptr(),
                    buffer.len(),
                    &mut user_result,
                )
            }
        };
        require(
            status == 0 && user_result.is_null(),
            "BOOTSTRAP_IDENTITY_OCCUPIED",
        )?;
    }
    for (name, gid) in [(c"_dcp_review", 612), (c"_agentdeploy", 602)] {
        for by_name in [false, true] {
            let status = unsafe {
                if by_name {
                    libc::getgrnam_r(
                        name.as_ptr(),
                        &mut group,
                        buffer.as_mut_ptr(),
                        buffer.len(),
                        &mut group_result,
                    )
                } else {
                    libc::getgrgid_r(
                        gid,
                        &mut group,
                        buffer.as_mut_ptr(),
                        buffer.len(),
                        &mut group_result,
                    )
                }
            };
            require(
                status == 0 && group_result.is_null(),
                "BOOTSTRAP_IDENTITY_OCCUPIED",
            )?;
        }
    }
    validate_identities(&users, &groups)
}

pub(super) fn identity_readback(policy: &GenesisInstallPolicy, caller: &str) -> Result<()> {
    let raw = command(
        policy,
        DSCL,
        &[
            ".",
            "-read",
            "/Users/_dcp_review",
            "UniqueID",
            "PrimaryGroupID",
            "UserShell",
            "NFSHomeDirectory",
        ],
    )?;
    let values: BTreeMap<_, _> = raw
        .lines()
        .filter_map(|line| line.split_once(": "))
        .collect();
    require(
        values
            == BTreeMap::from([
                ("UniqueID", "612"),
                ("PrimaryGroupID", "612"),
                ("UserShell", "/usr/bin/false"),
                ("NFSHomeDirectory", "/private/var/db/agent-deploy-review"),
            ]),
        "BOOTSTRAP_IDENTITY_READBACK",
    )?;
    for (name, gid) in [("_dcp_review", "612"), ("_agentdeploy", "602")] {
        let raw = command(
            policy,
            DSCL,
            &[".", "-read", &format!("/Groups/{name}"), "PrimaryGroupID"],
        )?;
        require(
            raw.trim() == format!("PrimaryGroupID: {gid}"),
            "BOOTSTRAP_IDENTITY_READBACK",
        )?;
    }
    let raw = command(
        policy,
        DSCL,
        &[".", "-read", "/Groups/_agentdeploy", "GroupMembership"],
    )?;
    require(
        raw.trim() == format!("GroupMembership: {caller}"),
        "BOOTSTRAP_IDENTITY_READBACK",
    )
}
pub(crate) fn validate_identities(users: &str, groups: &str) -> Result<String> {
    let mut caller = None;
    for (kind, text) in [("user", users), ("group", groups)] {
        for line in text.lines().filter(|line| !line.trim().is_empty()) {
            let fields: Vec<_> = line.split_whitespace().collect();
            require(fields.len() == 2, "BOOTSTRAP_IDENTITY_CENSUS")?;
            let id = fields[1]
                .parse::<i64>()
                .map_err(|_| Error::new("BOOTSTRAP_IDENTITY_CENSUS"))?;
            require(
                fields[0] != "_dcp_review"
                    && fields[0] != "_agentdeploy"
                    && id != 612
                    && !(kind == "group" && id == 602),
                "BOOTSTRAP_IDENTITY_OCCUPIED",
            )?;
            if kind == "user" && id == 502 {
                require(
                    caller.is_none() && !fields[0].starts_with('-'),
                    "BOOTSTRAP_CALLER_IDENTITY",
                )?;
                crate::fs::secure::component(fields[0])?;
                caller = Some(fields[0].to_string());
            }
        }
    }
    caller.ok_or(Error::new("BOOTSTRAP_CALLER_IDENTITY"))
}
pub(crate) fn sudoers_census() -> Result<BTreeMap<String, String>> {
    let mut found = BTreeMap::new();
    sudoers("/private/etc/sudoers", &mut found, 0, 0)?;
    Ok(found)
}
fn sudoers(path: &str, found: &mut BTreeMap<String, String>, uid: u32, gid: u32) -> Result<()> {
    let path = if let Some(suffix) = path.strip_prefix("/etc/") {
        format!("/private/etc/{suffix}")
    } else {
        path.to_string()
    };
    require(
        found.len() < 256 && !found.contains_key(&path),
        "BOOTSTRAP_SUDOERS_CENSUS",
    )?;
    let p = Path::new(&path);
    let dir = Dir::open(p.parent().ok_or(Error::new("UNSAFE_PATH"))?, uid)?;
    let raw = read_sudoers(
        &dir,
        p.file_name()
            .and_then(|n| n.to_str())
            .ok_or(Error::new("UNSAFE_PATH"))?,
        gid,
        4 * 1024 * 1024,
    )?;
    found.insert(path, sha(&raw));
    let text = std::str::from_utf8(&raw).map_err(|_| Error::new("BOOTSTRAP_SUDOERS_CENSUS"))?;
    for line in text.lines() {
        let line = line.trim();
        if !(line.starts_with("#include") || line.starts_with("@include")) {
            continue;
        }
        let parts: Vec<_> = line.split_whitespace().collect();
        require(
            parts.len() == 2 && parts[1].starts_with('/') && !parts[1].contains(['"', '\\']),
            "BOOTSTRAP_SUDOERS_CENSUS",
        )?;
        match parts[0] {
            "#include" | "@include" => sudoers(parts[1], found, uid, gid)?,
            "#includedir" | "@includedir" => {
                let directory = parts[1].replacen(
                    "/etc/",
                    "/private/etc/",
                    usize::from(parts[1].starts_with("/etc/")),
                );
                let dir = Dir::open(Path::new(&directory), uid)?;
                for name in dir.names_bounded(256)? {
                    sudoers(&format!("{directory}/{name}"), found, uid, gid)?;
                }
            }
            _ => return Err(Error::new("BOOTSTRAP_SUDOERS_CENSUS")),
        }
    }
    Ok(())
}
// Existing OS configuration is censused, never admitted as an installable artifact.
// The kernel exposes decompressed logical bytes and interprets compression backing
// attributes hidden from the default xattr view. Visible xattrs retain the same
// strict whitelist as artifact inputs, including byte-for-byte stability checks.
fn read_sudoers(dir: &Dir, name: &str, gid: u32, limit: u64) -> Result<Vec<u8>> {
    use crate::fs::secure::{read_xattrs, reject_acl};
    use std::os::{macos::fs::MetadataExt as _, unix::fs::MetadataExt as _};
    let mut file = dir.open_file(name, libc::O_RDONLY, 0)?;
    let check = |file: &std::fs::File, m: &std::fs::Metadata| -> Result<()> {
        require(m.is_file() && m.nlink() == 1, "UNSAFE_TYPE")?;
        require(m.uid() == dir.uid && m.gid() == gid, "UNSAFE_OWNER")?;
        require(m.mode() & 0o7022 == 0, "UNSAFE_MODE")?;
        require(m.st_flags() & !libc::UF_COMPRESSED == 0, "UNSAFE_FLAGS")?;
        reject_acl(file)
    };
    let before = file.metadata()?;
    check(&file, &before)?;
    let xattrs = read_xattrs(&file)?;
    require(before.len() <= limit, "SIZE_LIMIT")?;
    let bounded = limit.checked_add(1).ok_or(Error::new("SIZE_LIMIT"))?;
    let mut bytes = Vec::new();
    (&mut file).take(bounded).read_to_end(&mut bytes)?;
    require(bytes.len() as u64 <= limit, "SIZE_LIMIT")?;
    require(bytes.len() as u64 == before.len(), "INPUT_CHANGED")?;
    file.seek(SeekFrom::Start(0))?;
    let mut second = Vec::new();
    (&mut file).take(bounded).read_to_end(&mut second)?;
    require(second.len() as u64 <= limit, "SIZE_LIMIT")?;
    let after = file.metadata()?;
    check(&file, &after)?;
    require(
        bytes == second
            && before.dev() == after.dev()
            && before.ino() == after.ino()
            && before.mode() == after.mode()
            && before.uid() == after.uid()
            && before.gid() == after.gid()
            && before.nlink() == after.nlink()
            && before.len() == after.len()
            && before.st_flags() == after.st_flags()
            && before.mtime() == after.mtime()
            && before.mtime_nsec() == after.mtime_nsec()
            && before.ctime() == after.ctime()
            && before.ctime_nsec() == after.ctime_nsec()
            && xattrs == read_xattrs(&file)?,
        "INPUT_CHANGED",
    )?;
    Ok(bytes)
}
pub(super) fn service_census() -> Result<BTreeMap<String, String>> {
    let dir = Dir::open(Path::new("/Library/LaunchDaemons"), 0)?;
    let mut values = BTreeMap::new();
    for name in dir.names_bounded(512)? {
        if name == "ai.agent-deployd.plist" {
            continue;
        }
        if name.ends_with(".plist") {
            let path = format!("/Library/LaunchDaemons/{name}");
            values.insert(path.clone(), hash_protected(&path, 1024 * 1024)?);
        }
    }
    Ok(values)
}

#[cfg(test)]
#[path = "genesis_census_tests.rs"]
mod tests;
