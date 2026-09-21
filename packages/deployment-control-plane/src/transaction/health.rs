//! One monotonic budget covers connect, every partial write and every read.
use crate::{error::require, Error, Result};
use std::{
    io::{Read, Write},
    net::{SocketAddr, TcpStream},
    time::{Duration, Instant},
};
fn remaining(deadline: Instant) -> Result<Duration> {
    deadline
        .checked_duration_since(Instant::now())
        .filter(|d| !d.is_zero())
        .ok_or(Error::new("HEALTH_TIMEOUT"))
}
fn io(error: std::io::Error) -> Error {
    Error::new(
        if matches!(
            error.kind(),
            std::io::ErrorKind::TimedOut | std::io::ErrorKind::WouldBlock
        ) {
            "HEALTH_TIMEOUT"
        } else {
            "HEALTH_FAILED"
        },
    )
}
pub(crate) fn probe(address: SocketAddr, limit: Duration) -> Result<()> {
    let deadline = Instant::now() + limit;
    let mut stream = TcpStream::connect_timeout(&address, remaining(deadline)?).map_err(io)?;
    let mut request = &b"GET /health HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n"[..];
    while !request.is_empty() {
        stream
            .set_write_timeout(Some(remaining(deadline)?))
            .map_err(io)?;
        let n = stream.write(request).map_err(io)?;
        require(n > 0, "HEALTH_FAILED")?;
        request = &request[n..];
    }
    let mut data = Vec::new();
    loop {
        stream
            .set_read_timeout(Some(remaining(deadline)?))
            .map_err(io)?;
        let mut buffer = [0; 4096];
        let n = stream.read(&mut buffer).map_err(io)?;
        remaining(deadline)?;
        if n == 0 {
            break;
        }
        require(data.len() + n <= 65536, "HEALTH_FAILED")?;
        data.extend_from_slice(&buffer[..n]);
    }
    let data = std::str::from_utf8(&data).map_err(|_| Error::new("HEALTH_FAILED"))?;
    require(data.starts_with("HTTP/1.1 200 "), "HEALTH_FAILED")?;
    let body = data
        .split_once("\r\n\r\n")
        .ok_or(Error::new("HEALTH_FAILED"))?
        .1;
    let value: serde_json::Value =
        serde_json::from_str(body).map_err(|_| Error::new("HEALTH_FAILED"))?;
    require(
        value.get("ok") == Some(&serde_json::Value::Bool(true)),
        "HEALTH_FAILED",
    )
}
#[cfg(test)]
#[path = "../../test/common/health.rs"]
mod tests;
