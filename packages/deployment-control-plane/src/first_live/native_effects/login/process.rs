use super::*;
use crate::{bootstrap::reviewer_login::Process, error::require};
use std::{
    collections::BTreeSet,
    os::unix::process::CommandExt,
    path::Path,
    process::{Command, Stdio},
    time::{Duration, Instant},
};
pub(super) const CONTROLLER: &str = "/usr/local/libexec/agent-deployd/agent-deployd";
pub(super) const LIMIT_SECONDS: u64 = 600;
pub(super) fn check(rows: &[Process], own: u32) -> Result<Process> {
    let mut pids = BTreeSet::new();
    let current = rows
        .iter()
        .find(|r| r.pid == own)
        .ok_or(Error::new("FIRST_LIVE_LOGIN_PARENT_MISSING"))?;
    require(
        current.uid == 0
            && current.ppid > 0
            && !current.start.is_empty()
            && current.command == CONTROLLER,
        "FIRST_LIVE_LOGIN_PARENT",
    )?;
    for row in rows {
        require(pids.insert(row.pid), "FIRST_LIVE_LOGIN_DUPLICATE_PID")?;
        require(row.uid != 612, "FIRST_LIVE_LOGIN_REVIEWER_PROCESS")?;
        let name = Path::new(&row.command).file_name().and_then(|s| s.to_str());
        require(
            !matches!(
                name,
                Some("agent-deploy-bootstrap" | "agent-deploy-login-reconcile")
            ) && (name != Some("agent-deployd") || row.pid == own),
            "FIRST_LIVE_LOGIN_OTHER_CONTROLLER",
        )?;
    }
    Ok(current.clone())
}
pub(super) fn login(expires: u64) -> Result<()> {
    let now = crate::first_live::compose::now()?;
    require(
        expires.checked_sub(now).is_some_and(|v| v >= LIMIT_SECONDS),
        "FIRST_LIVE_LOGIN_DEADLINE",
    )?;
    require(
        (0..=2).all(|fd| unsafe { libc::isatty(fd) } == 1),
        "VISIBLE_TERMINAL_REQUIRED",
    )?;
    let max_fd = unsafe { libc::getdtablesize() };
    require(
        max_fd > 3 && max_fd <= 1_048_576,
        "FIRST_LIVE_LOGIN_FD_BOUND",
    )?;
    let mut command = Command::new(crate::issuer::review::CODEX_PATH);
    command
        .args(["login", "--device-auth"])
        .env_clear()
        .env("HOME", crate::issuer::review::REVIEW_HOME)
        .env("CODEX_HOME", crate::issuer::review::REVIEW_HOME)
        .env("PATH", "/usr/bin:/bin")
        .current_dir(crate::issuer::review::REVIEW_HOME)
        .stdin(Stdio::inherit())
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit());
    // Only async-signal-safe syscalls run after fork. Every nonterminal descriptor
    // closes atomically at exec, including any inherited production-lock/key FD.
    // CLOEXEC preserves std's private exec-error pipe until exec succeeds.
    unsafe {
        command.pre_exec(move || {
            seal_inherited_fds(max_fd)?;
            if libc::setgroups(1, [612u32].as_ptr()) != 0
                || libc::setgid(612) != 0
                || libc::setuid(612) != 0
            {
                return Err(std::io::Error::last_os_error());
            }
            let mut groups = [0u32; 1];
            if libc::getuid() != 612
                || libc::geteuid() != 612
                || libc::getgid() != 612
                || libc::getegid() != 612
                || libc::getgroups(1, groups.as_mut_ptr()) != 1
                || groups != [612]
            {
                return Err(std::io::Error::from_raw_os_error(libc::EPERM));
            }
            Ok(())
        });
    }
    let mut child = command.spawn()?;
    let started = Instant::now();
    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                return require(status.success(), "FIRST_LIVE_LOGIN_COMMAND_FAILED")
            }
            Ok(None)
                if started.elapsed() < Duration::from_secs(LIMIT_SECONDS)
                    && crate::first_live::compose::now().is_ok_and(|now| now < expires) =>
            {
                std::thread::sleep(Duration::from_millis(50))
            }
            _ => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(Error::new("FIRST_LIVE_LOGIN_COMMAND_UNKNOWN"));
            }
        }
    }
}

// Called in the fork child immediately before dropping identity and exec.
pub(super) unsafe fn seal_inherited_fds(max_fd: i32) -> std::io::Result<()> {
    for fd in 3..max_fd {
        let flags = libc::fcntl(fd, libc::F_GETFD);
        if flags >= 0 {
            if libc::fcntl(fd, libc::F_SETFD, flags | libc::FD_CLOEXEC) < 0 {
                return Err(std::io::Error::last_os_error());
            }
        } else if std::io::Error::last_os_error().raw_os_error() != Some(libc::EBADF) {
            return Err(std::io::Error::last_os_error());
        }
    }
    Ok(())
}
