use crate::{error::require, Error, Result};
use std::{
    io::{Read, Write},
    os::{fd::AsRawFd, unix::process::CommandExt},
    process::{Child, Command, Stdio},
    time::{Duration, Instant},
};

fn nonblocking(file: &impl AsRawFd) -> Result<()> {
    let fd = file.as_raw_fd();
    let flags = unsafe { libc::fcntl(fd, libc::F_GETFL) };
    require(
        flags >= 0 && unsafe { libc::fcntl(fd, libc::F_SETFL, flags | libc::O_NONBLOCK) } == 0,
        "REVIEW_PIPE",
    )
}

fn drain(file: &mut impl Read, output: &mut Vec<u8>, limit: usize) -> Result<bool> {
    let mut buffer = [0u8; 4096];
    loop {
        match file.read(&mut buffer) {
            Ok(0) => return Ok(true),
            Ok(n) => {
                require(output.len() + n <= limit, "REVIEW_OUTPUT_LIMIT")?;
                output.extend_from_slice(&buffer[..n]);
            }
            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => return Ok(false),
            Err(e) if e.kind() == std::io::ErrorKind::Interrupted => continue,
            Err(_) => return Err(Error::new("REVIEW_PIPE")),
        }
    }
}

fn cancel(child: &mut Child) -> Result<()> {
    // Child owns this process group; terminate inherited-pipe descendants too.
    unsafe {
        libc::kill(-(child.id() as i32), libc::SIGKILL);
    }
    let _ = child.kill();
    let deadline = Instant::now() + Duration::from_secs(1);
    loop {
        match child.try_wait() {
            Ok(Some(_)) => return Ok(()),
            Ok(None) if Instant::now() < deadline => std::thread::sleep(Duration::from_millis(2)),
            _ => return Err(Error::new("REVIEW_CHILD_UNRECONCILED")),
        }
    }
}

pub(super) fn capture(
    mut command: Command,
    input: &[u8],
    timeout: Duration,
    limit: usize,
) -> Result<Vec<u8>> {
    let deadline = Instant::now() + timeout;
    let mut child = command
        .process_group(0)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()?;
    let result = capture_child(&mut child, input, deadline, limit);
    if result.is_err() {
        cancel(&mut child)?;
    }
    result
}

fn capture_child(
    child: &mut Child,
    input: &[u8],
    deadline: Instant,
    limit: usize,
) -> Result<Vec<u8>> {
    let mut stdin = child.stdin.take();
    let mut stdout = child.stdout.take().ok_or(Error::new("REVIEW_PIPE"))?;
    let mut stderr = child.stderr.take().ok_or(Error::new("REVIEW_PIPE"))?;
    nonblocking(stdin.as_ref().ok_or(Error::new("REVIEW_PIPE"))?)?;
    nonblocking(&stdout)?;
    nonblocking(&stderr)?;
    let mut output = Vec::new();
    let mut diagnostics = Vec::new();
    let mut written = 0;
    let mut status = None;
    loop {
        require(Instant::now() < deadline, "REVIEW_TIMEOUT")?;
        if written == input.len() {
            stdin.take();
        }
        if let Some(stdin) = &mut stdin {
            match stdin.write(&input[written..]) {
                Ok(0) => return Err(Error::new("REVIEW_INPUT_INCOMPLETE")),
                Ok(n) => written += n,
                Err(e)
                    if matches!(
                        e.kind(),
                        std::io::ErrorKind::WouldBlock | std::io::ErrorKind::Interrupted
                    ) => {}
                Err(_) => return Err(Error::new("REVIEW_INPUT_INCOMPLETE")),
            }
        }
        let out_eof = drain(&mut stdout, &mut output, limit)?;
        let err_eof = drain(&mut stderr, &mut diagnostics, limit)?;
        if status.is_none() {
            status = child.try_wait()?;
        }
        if let Some(status) = status {
            require(status.success(), "REVIEW_CHILD_FAILED")?;
            require(written == input.len(), "REVIEW_INPUT_INCOMPLETE")?;
            if out_eof && err_eof {
                return Ok(output);
            }
        }
        std::thread::sleep(Duration::from_millis(2));
    }
}
