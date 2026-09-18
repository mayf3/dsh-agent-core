//! Fixed ps metadata only: never command arguments, credentials or device output.
use super::*;
use crate::fs::{
    file::sha,
    secure::{validate_platform_file, Dir},
};
use std::{
    collections::BTreeSet,
    io::Read,
    path::Path,
    process::{Command, Stdio},
    time::{Duration, Instant},
};
#[derive(Clone)]
pub(super) struct Row {
    pub pid: u32,
    pub ppid: u32,
    pub uid: u32,
    pub start: String,
    pub command: String,
}
pub(super) fn check(rows: &[Row], own: u32, parent: Option<&Intent>) -> Result<()> {
    let mut seen = BTreeSet::new();
    for row in rows {
        require(seen.insert(row.pid), "LOGIN_PROCESS_DUPLICATE")?;
    }
    let current = rows
        .iter()
        .find(|r| r.pid == own)
        .ok_or(Error::new("LOGIN_PROCESS_MISSING"))?;
    require(
        current.uid == 0 && current.command == HELPER,
        "LOGIN_PROCESS_IDENTITY",
    )?;
    if let Some(intent) = parent {
        let p = rows
            .iter()
            .find(|r| r.pid == intent.parent_pid)
            .ok_or(Error::new("LOGIN_PARENT_MISSING"))?;
        require(
            p.pid != own
                && p.uid == 0
                && p.command == HELPER
                && p.start == intent.parent_start
                && current.ppid == p.pid,
            "LOGIN_PARENT_IDENTITY",
        )?;
    }
    for row in rows {
        require(row.uid != 612, "LOGIN_REVIEW_PROCESS_PRESENT")?;
        let name = Path::new(&row.command).file_name().and_then(|v| v.to_str());
        require(
            name != Some("agent-deploy-bootstrap"),
            "LOGIN_BOOTSTRAP_PROCESS_PRESENT",
        )?;
        if name == Some("agent-deploy-login-reconcile") {
            require(
                row.pid == own || parent.is_some_and(|p| p.parent_pid == row.pid),
                "LOGIN_RECONCILIATION_PROCESS_PRESENT",
            )?;
        }
    }
    Ok(())
}
fn tool(expected: &str) -> Result<()> {
    let dir = Dir::open(Path::new("/bin"), 0)?;
    let mut file = dir.open_file("ps", libc::O_RDONLY, 0)?;
    validate_platform_file(&file)?;
    let mut bytes = Vec::new();
    (&mut file)
        .take(16 * 1024 * 1024 + 1)
        .read_to_end(&mut bytes)?;
    require(
        bytes.len() <= 16 * 1024 * 1024 && sha(&bytes) == expected,
        "LOGIN_PS_DRIFT",
    )?;
    validate_platform_file(&file)
}
pub(super) fn parse(text: &str) -> Result<Vec<Row>> {
    require(text.len() <= 4 * 1024 * 1024, "LOGIN_PROCESS_LIMIT")?;
    let mut rows = Vec::new();
    for line in text.lines() {
        let fields: Vec<_> = line.split_whitespace().collect();
        require(
            fields.len() >= 9 && rows.len() < 32768,
            "LOGIN_PROCESS_FORMAT",
        )?;
        let number = |i: usize| {
            fields[i]
                .parse::<u32>()
                .map_err(|_| Error::new("LOGIN_PROCESS_FORMAT"))
        };
        rows.push(Row {
            pid: number(0)?,
            ppid: number(1)?,
            uid: number(2)?,
            start: fields[3..8].join(" "),
            command: fields[8..].join(" "),
        });
    }
    require(!rows.is_empty(), "LOGIN_PROCESS_EMPTY")?;
    Ok(rows)
}
pub(super) fn census(expected: &str) -> Result<Vec<Row>> {
    tool(expected)?;
    let mut child = Command::new("/bin/ps")
        .args(["-axo", "pid=,ppid=,uid=,lstart=,comm="])
        .env_clear()
        .env("LC_ALL", "C")
        .env("PATH", "/usr/bin:/bin")
        .current_dir("/")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()?;
    let stdout = child.stdout.take().ok_or(Error::new("LOGIN_PS_FAILED"))?;
    let reader = std::thread::spawn(move || {
        let mut b = Vec::new();
        stdout
            .take(4 * 1024 * 1024 + 1)
            .read_to_end(&mut b)
            .map(|_| b)
    });
    let start = Instant::now();
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break Ok(status),
            Ok(None) if start.elapsed() < Duration::from_secs(5) => {
                std::thread::sleep(Duration::from_millis(10))
            }
            _ => {
                let _ = child.kill();
                let _ = child.wait();
                break Err(Error::new("LOGIN_PS_UNKNOWN"));
            }
        }
    };
    let bytes = reader
        .join()
        .map_err(|_| Error::new("LOGIN_PS_UNKNOWN"))??;
    require(status?.success(), "LOGIN_PS_FAILED")?;
    parse(std::str::from_utf8(&bytes).map_err(|_| Error::new("LOGIN_PROCESS_FORMAT"))?)
}
pub(super) fn login() -> Result<Outcome> {
    let mut child = Command::new(HELPER)
        .arg("child")
        .env_clear()
        .current_dir("/")
        .stdin(Stdio::inherit())
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .spawn()?;
    let start = Instant::now();
    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                return Ok(if status.success() {
                    Outcome::Completed
                } else {
                    Outcome::Failed
                })
            }
            Ok(None) if start.elapsed() < Duration::from_secs(600) => {
                std::thread::sleep(Duration::from_millis(50))
            }
            Ok(None) => {
                let _ = child.kill();
                let _ = child.wait();
                return Ok(Outcome::TimedOut);
            }
            Err(_) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(Error::new("LOGIN_CHILD_UNKNOWN"));
            }
        }
    }
}
