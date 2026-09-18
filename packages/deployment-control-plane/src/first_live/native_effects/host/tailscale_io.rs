//! One exact GET, bounded from connect through FIN. No SO_RCVTIMEO after peer FIN.
use crate::{error::require, Error, Result};
use std::{
    os::{
        fd::{AsRawFd, FromRawFd},
        unix::net::UnixStream,
    },
    time::{Duration, Instant},
};
const REQUEST:&[u8]=b"GET /localapi/v0/status?peers=false HTTP/1.0\r\nHost: local-tailscaled.sock\r\nConnection: close\r\n\r\n";
fn wait(fd: i32, event: i16, deadline: Instant) -> Result<()> {
    loop {
        let remain = deadline
            .checked_duration_since(Instant::now())
            .ok_or_else(|| Error::new("TAILSCALE_STATUS_DEADLINE"))?;
        require(!remain.is_zero(), "TAILSCALE_STATUS_DEADLINE")?;
        let mut p = libc::pollfd {
            fd,
            events: event,
            revents: 0,
        };
        let n = unsafe { libc::poll(&mut p, 1, remain.as_millis().clamp(1, 5000) as i32) };
        if n < 0 && std::io::Error::last_os_error().raw_os_error() == Some(libc::EINTR) {
            continue;
        }
        require(
            n > 0 && p.revents & libc::POLLNVAL == 0,
            "TAILSCALE_STATUS_DEADLINE",
        )?;
        require(Instant::now() < deadline, "TAILSCALE_STATUS_DEADLINE")?;
        return Ok(());
    }
}
fn exchange(stream: &mut UnixStream, deadline: Instant) -> Result<Vec<u8>> {
    stream.set_nonblocking(true)?;
    let fd = stream.as_raw_fd();
    let mut offset = 0;
    while offset < REQUEST.len() {
        wait(fd, libc::POLLOUT, deadline)?;
        let n = unsafe {
            libc::send(
                fd,
                REQUEST[offset..].as_ptr().cast(),
                REQUEST.len() - offset,
                libc::MSG_DONTWAIT,
            )
        };
        if n < 0 && retry() {
            continue;
        }
        require(n > 0, "TAILSCALE_STATUS_IO")?;
        offset += n as usize;
    }
    let mut result = Vec::new();
    let mut buf = [0u8; 8192];
    loop {
        wait(fd, libc::POLLIN, deadline)?;
        let n = unsafe { libc::recv(fd, buf.as_mut_ptr().cast(), buf.len(), libc::MSG_DONTWAIT) };
        if n < 0 && retry() {
            continue;
        }
        require(n >= 0, "TAILSCALE_STATUS_IO")?;
        if n == 0 {
            return Ok(result);
        }
        require(
            result.len() + n as usize <= 1024 * 1024,
            "TAILSCALE_STATUS_LIMIT",
        )?;
        result.extend_from_slice(&buf[..n as usize]);
    }
}
fn retry() -> bool {
    matches!(
        std::io::Error::last_os_error().raw_os_error(),
        Some(libc::EAGAIN | libc::EINTR)
    )
}
fn socket_identity(parent: &crate::fs::secure::Dir) -> Result<(u64, u64)> {
    let mut st: libc::stat = unsafe { std::mem::zeroed() };
    if unsafe {
        libc::fstatat(
            parent.file.as_raw_fd(),
            c"tailscaled.sock".as_ptr(),
            &mut st,
            libc::AT_SYMLINK_NOFOLLOW,
        )
    } != 0
    {
        return Err(Error::new(
            if std::io::Error::last_os_error().raw_os_error() == Some(libc::ENOENT) {
                "TAILSCALE_SOCKET_ABSENT"
            } else {
                "TAILSCALE_SOCKET"
            },
        ));
    }
    require(
        st.st_mode & libc::S_IFMT == libc::S_IFSOCK
            && st.st_uid == 0
            && st.st_gid == 1
            && st.st_mode & 0o7777 == 0o666
            && st.st_nlink == 1,
        "TAILSCALE_SOCKET",
    )?;
    Ok((st.st_dev as u64, st.st_ino))
}
fn peer(stream: &UnixStream, expected: u32) -> Result<()> {
    let (mut uid, mut gid) = (u32::MAX, u32::MAX);
    let fd = stream.as_raw_fd();
    require(
        unsafe { libc::getpeereid(fd, &mut uid, &mut gid) } == 0 && uid == 0 && gid == 0,
        "TAILSCALE_PEER",
    )?;
    let mut pid = 0i32;
    let mut len = std::mem::size_of_val(&pid) as libc::socklen_t;
    // Darwin sys/un.h: SOL_LOCAL=0, LOCAL_PEERPID=2.
    require(
        unsafe { libc::getsockopt(fd, 0, 2, (&mut pid as *mut i32).cast(), &mut len) } == 0
            && len as usize == std::mem::size_of_val(&pid)
            && pid > 0
            && pid as u32 == expected,
        "TAILSCALE_PEER",
    )
}
pub(super) fn read(ctx: &super::Context<'_>, identity: &super::Identity) -> Result<String> {
    ctx.check()?;
    require(unsafe { libc::geteuid() } == 0, "ROOT_REQUIRED")?;
    let p = ctx.packet;
    let ids = p
        .configuration
        .callers
        .iter()
        .map(|c| c.uid)
        .chain(p.native_enrollment.services.iter().map(|s| s.uid))
        .collect();
    let plan = p
        .configuration
        .socket_ancestor
        .as_ref()
        .ok_or_else(|| Error::new("SOCKET_ANCESTOR_REQUIRED"))?;
    let parent = plan.open_preflight(p.configuration.socket_gid, &ids)?;
    let before = socket_identity(&parent)?;
    let deadline = Instant::now() + Duration::from_secs(5);
    let fd = unsafe { libc::socket(libc::AF_UNIX, libc::SOCK_STREAM, 0) };
    require(fd >= 0, "TAILSCALE_SOCKET")?;
    let mut stream = unsafe { UnixStream::from_raw_fd(fd) };
    require(
        unsafe { libc::fcntl(fd, libc::F_SETFD, libc::FD_CLOEXEC) } == 0,
        "TAILSCALE_SOCKET",
    )?;
    stream.set_nonblocking(true)?;
    let no_sigpipe = 1i32;
    require(
        unsafe {
            libc::setsockopt(
                fd,
                libc::SOL_SOCKET,
                libc::SO_NOSIGPIPE,
                (&no_sigpipe as *const i32).cast(),
                4,
            )
        } == 0,
        "TAILSCALE_SOCKET",
    )?;
    let mut address: libc::sockaddr_un = unsafe { std::mem::zeroed() };
    address.sun_family = libc::AF_UNIX as u8;
    address.sun_len = std::mem::size_of_val(&address) as u8;
    for (to, from) in address
        .sun_path
        .iter_mut()
        .zip(b"/private/var/run/tailscaled.sock\0")
    {
        *to = *from as i8;
    }
    let connected = unsafe {
        libc::connect(
            fd,
            (&address as *const libc::sockaddr_un).cast(),
            std::mem::size_of_val(&address) as u32,
        )
    };
    if connected != 0 {
        let errno = std::io::Error::last_os_error().raw_os_error();
        if matches!(errno, Some(libc::ECONNREFUSED | libc::ENOENT)) {
            return Err(Error::new("TAILSCALE_CONNECT_UNAVAILABLE"));
        }
        require(errno == Some(libc::EINPROGRESS), "TAILSCALE_STATUS_IO")?;
        wait(fd, libc::POLLOUT, deadline)?;
        let mut error = 0i32;
        let mut length = 4;
        require(
            unsafe {
                libc::getsockopt(
                    fd,
                    libc::SOL_SOCKET,
                    libc::SO_ERROR,
                    (&mut error as *mut i32).cast(),
                    &mut length,
                )
            } == 0
                && error == 0,
            "TAILSCALE_CONNECT_UNAVAILABLE",
        )?;
    }
    peer(&stream, identity.pid)?;
    require(
        super::super::reader::identity(identity.pid)? == *identity,
        "TAILSCALE_GENERATION",
    )?;
    let raw = exchange(&mut stream, deadline)?;
    peer(&stream, identity.pid)?;
    require(
        socket_identity(&parent)? == before
            && socket_identity(&plan.open_preflight(p.configuration.socket_gid, &ids)?)? == before
            && super::super::reader::identity(identity.pid)? == *identity,
        "TAILSCALE_GENERATION",
    )?;
    ctx.check()?;
    super::status::parse(&raw)
}
#[cfg(test)]
#[path = "../../../../test/first_live/host/tailscale_io.rs"]
mod tests;
