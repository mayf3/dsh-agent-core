use crate::{
    error::require,
    fs::{
        file::{sha, snapshot},
        secure::{validate_platform_file, Dir},
    },
    Error, Result,
};
use serde::Serialize;
use std::{
    io::Read,
    os::unix::process::CommandExt,
    path::Path,
    process::{Command, Stdio},
    time::{Duration, Instant},
};
#[derive(Clone, Copy)]
pub(super) enum Tool {
    Launchctl,
    Sudo,
    SudoAudit,
    Node,
    Retired,
    Sh,
    RetiredNode,
    Plutil,
}
impl Tool {
    pub(super) fn path(self) -> &'static str {
        match self {
            Self::Launchctl => "/bin/launchctl",
            Self::Sudo | Self::SudoAudit => "/usr/bin/sudo",
            Self::Node | Self::RetiredNode => "/usr/local/libexec/agent-core/node-runtime/bin/node",
            Self::Retired => "/usr/local/libexec/lw-pilot-executor",
            Self::Sh => "/bin/sh",
            Self::Plutil => "/usr/bin/plutil",
        }
    }
}
#[derive(Serialize)]
pub(super) struct Output {
    pub code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
}
pub(super) fn pinned(tool: Tool, expected: &str) -> Result<()> {
    let path = Path::new(tool.path());
    let dir = Dir::open(path.parent().unwrap(), 0)?;
    let mut file = dir.open_file(
        path.file_name().unwrap().to_str().unwrap(),
        libc::O_RDONLY,
        0,
    )?;
    let apple = matches!(
        tool,
        Tool::Launchctl | Tool::Sudo | Tool::SudoAudit | Tool::Sh | Tool::Plutil
    );
    let validate = |file: &std::fs::File| {
        if matches!(tool, Tool::Sudo | Tool::SudoAudit) {
            super::sudo::metadata(file)
        } else {
            validate_platform_file(file)
        }
    };
    let bytes = if apple {
        validate(&file)?;
        let mut b = Vec::new();
        (&mut file).take(32 * 1024 * 1024 + 1).read_to_end(&mut b)?;
        require(b.len() <= 32 * 1024 * 1024, "SIZE_LIMIT")?;
        validate(&file)?;
        b
    } else {
        snapshot(&file, 0, 128 * 1024 * 1024)?.bytes
    };
    require(sha(&bytes) == expected, "FIRST_LIVE_TOOL_DRIFT")
}
pub(super) fn run(
    tool: Tool,
    pin: &str,
    args: &[String],
    identity: Option<(u32, u32, &[u32])>,
    timeout: u64,
) -> Result<Output> {
    require(unsafe { libc::geteuid() } == 0, "FIRST_LIVE_REQUIRES_ROOT")?;
    pinned(tool, pin)?;
    validate_identity(tool, identity)?;
    validate_arguments(tool, args)?;
    let mut command = Command::new(tool.path());
    command
        .args(args)
        .env_clear()
        .env("PATH", "/usr/bin:/bin")
        .env("LC_ALL", "C")
        .current_dir("/")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if let Some((uid, gid, groups)) = identity {
        if uid == 505 {
            command
                .env("HOME", "/Users/authsvc")
                .env(
                    "AGENTCORE_EXPECTED_STORE",
                    "/Users/authsvc/.agent-core/scheduler/jobs.json",
                )
                .current_dir("/Users/authsvc");
        }
        let groups = groups.to_vec();
        unsafe {
            command.pre_exec(move || {
                // Only async-signal-safe syscalls after fork; Command owns its stdio descriptors.
                if libc::setgroups(groups.len() as i32, groups.as_ptr()) != 0
                    || libc::setgid(gid) != 0
                    || libc::setuid(uid) != 0
                    || libc::geteuid() != uid
                    || libc::getuid() != uid
                    || libc::getegid() != gid
                    || libc::getgid() != gid
                {
                    return Err(std::io::Error::last_os_error());
                }
                Ok(())
            });
        }
    }
    collect(command, Duration::from_secs(timeout))
}
// The only production caller supplies a fixed pinned tool, fixed arguments and
// closed identity. This is not a general command sandbox: the reviewed tool
// closure must not daemonize or deliberately escape its new process group.
fn collect(mut command: Command, timeout: Duration) -> Result<Output> {
    require(
        !timeout.is_zero() && timeout <= Duration::from_secs(60),
        "FIRST_LIVE_CHILD_DEADLINE",
    )?;
    let deadline = Instant::now() + timeout;
    let mut child = command.process_group(0).spawn()?;
    let mut reaped = false;
    let result = capture(&mut child, deadline, &mut reaped);
    if result.is_err() && !reaped {
        // Until wait reaps our child, its PID cannot be reused. Only this owned
        // group is signalled; never kill a group after reaping its leader.
        unsafe {
            libc::kill(-(child.id() as i32), libc::SIGKILL);
        }
        let _ = child.kill();
        let limit = Instant::now() + Duration::from_millis(250);
        while Instant::now() < limit {
            match child.try_wait() {
                Ok(Some(_)) => break,
                Ok(None) => std::thread::sleep(Duration::from_millis(2)),
                Err(_) => break,
            }
        }
        // Cleanup is not evidence of completion. The outer durable intent
        // remains consumed/unknown, including if a direct child is unreaped.
    }
    result
}
fn nonblocking(stream: &impl std::os::fd::AsRawFd) -> Result<()> {
    let fd = stream.as_raw_fd();
    let flags = unsafe { libc::fcntl(fd, libc::F_GETFL) };
    require(
        flags >= 0 && unsafe { libc::fcntl(fd, libc::F_SETFL, flags | libc::O_NONBLOCK) } == 0,
        "FIRST_LIVE_CHILD_UNKNOWN",
    )
}
fn drain(stream: &mut impl Read, bytes: &mut Vec<u8>, limit: usize) -> Result<bool> {
    let mut buffer = [0u8; 8192];
    // Bound each drain as well as total bytes, so continuous output cannot
    // starve the other stream, child status or wall-clock deadline.
    for _ in 0..8 {
        match stream.read(&mut buffer) {
            Ok(0) => return Ok(true),
            Ok(n) => {
                require(bytes.len() + n <= limit, "FIRST_LIVE_CHILD_LIMIT")?;
                bytes.extend_from_slice(&buffer[..n]);
            }
            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => return Ok(false),
            Err(e) if e.kind() == std::io::ErrorKind::Interrupted => (),
            Err(_) => return Err(Error::new("FIRST_LIVE_CHILD_UNKNOWN")),
        }
    }
    Ok(false)
}
fn capture(
    child: &mut std::process::Child,
    deadline: Instant,
    reaped: &mut bool,
) -> Result<Output> {
    let mut stdout = child
        .stdout
        .take()
        .ok_or(Error::new("FIRST_LIVE_CHILD_UNKNOWN"))?;
    let mut stderr = child
        .stderr
        .take()
        .ok_or(Error::new("FIRST_LIVE_CHILD_UNKNOWN"))?;
    nonblocking(&stdout)?;
    nonblocking(&stderr)?;
    let mut out = Vec::new();
    let mut err = Vec::new();
    let mut status = None;
    loop {
        require(Instant::now() < deadline, "FIRST_LIVE_CHILD_UNKNOWN")?;
        let out_eof = drain(&mut stdout, &mut out, 1024 * 1024 - err.len())?;
        let err_eof = drain(&mut stderr, &mut err, 1024 * 1024 - out.len())?;
        if status.is_none() {
            status = child
                .try_wait()
                .map_err(|_| Error::new("FIRST_LIVE_CHILD_UNKNOWN"))?;
            *reaped = status.is_some();
        }
        if let Some(status) = status {
            require(status.code().is_some(), "FIRST_LIVE_CHILD_UNKNOWN")?;
            // Zero-byte output alone is not closure: a child can close streams
            // and remain alive after the leader exits. Inconclusive census fails.
            let exists = unsafe { libc::kill(-(child.id() as i32), 0) };
            require(
                exists == -1 && std::io::Error::last_os_error().raw_os_error() == Some(libc::ESRCH),
                "FIRST_LIVE_CHILD_UNKNOWN",
            )?;
            if out_eof && err_eof {
                return Ok(Output {
                    code: status.code(),
                    stdout: String::from_utf8(out)
                        .map_err(|_| Error::new("FIRST_LIVE_CHILD_UNKNOWN"))?,
                    stderr: String::from_utf8(err)
                        .map_err(|_| Error::new("FIRST_LIVE_CHILD_UNKNOWN"))?,
                });
            }
        }
        std::thread::sleep(Duration::from_millis(2));
    }
}
fn validate_identity(tool: Tool, identity: Option<(u32, u32, &[u32])>) -> Result<()> {
    match identity {
        None => require(
            matches!(tool, Tool::Launchctl | Tool::SudoAudit),
            "FIRST_LIVE_IDENTITY",
        ),
        Some((uid, gid, groups)) => {
            require(!matches!(tool, Tool::SudoAudit), "FIRST_LIVE_IDENTITY")?;
            let expected = if matches!(tool, Tool::Node) {
                (505, 601)
            } else {
                (502, 20)
            };
            require(
                (uid, gid) == expected && groups.len() <= 32 && !groups.contains(&0),
                "FIRST_LIVE_IDENTITY",
            )
        }
    }
}

#[cfg(test)]
#[path = "../../test/first_live/process.rs"]
mod tests;

fn validate_arguments(tool: Tool, args: &[String]) -> Result<()> {
    if matches!(tool, Tool::SudoAudit) {
        require(
            args.len() == 4
                && args[..3] == ["-n", "-l", "-U"]
                && ["#505", "#612"].contains(&args[3].as_str()),
            "FIRST_LIVE_SUDO_AUDIT_ARGUMENTS",
        )?;
    }
    if matches!(tool, Tool::Sudo) {
        require(args == ["-n", "-l"], "FIRST_LIVE_SUDO_ARGUMENTS")?;
    }
    if matches!(tool, Tool::Plutil) {
        require(
            args == [
                "-lint",
                "/usr/local/libexec/agent-deployd/lifecycle-denial-probe.plist",
            ],
            "FIRST_LIVE_PROBE_READBACK_ARGUMENTS",
        )?;
    }
    if matches!(tool, Tool::RetiredNode) {
        require(args.len()==1 && [
            "/usr/local/libexec/agent-core/app/scripts/production-runtime-launchd.mjs",
            "/usr/local/libexec/agent-core/app/deployment-artifacts/scheduler-watchdog-routing-v1/run-routing-install.mjs",
        ].contains(&args[0].as_str()),"FIRST_LIVE_RETIRED_NODE_ARGUMENTS")?;
    }
    Ok(())
}
