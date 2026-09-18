//! Fixed authenticated Scheduler read surface; never a configurable URL/command.
use crate::{
    error::require,
    fs::{
        file::{sha, snapshot},
        secure::Dir,
    },
    Error, Result,
};
use serde_json::Value;
use std::{
    io::{Read, Write},
    net::{SocketAddr, TcpStream},
    os::unix::fs::MetadataExt,
    path::Path,
    time::{Duration, Instant},
};
pub(super) const CONTROL:&str="/private/var/db/agent-core/deployments/SCHEDULER_WATCHDOG_ROUTING_AND_STUCK_OCCURRENCE_RECOVERY_V1";
pub(super) fn document(dir: &Dir, name: &str, gid: u32, mode: u32) -> Result<Vec<u8>> {
    let file = dir.open_file(name, libc::O_RDONLY, 0)?;
    let image = snapshot(&file, dir.uid, 4 * 1024 * 1024)?;
    require(
        image.gid == gid && image.mode == mode,
        "WATCHDOG_DOCUMENT_METADATA",
    )?;
    Ok(image.bytes)
}
pub(super) fn control(name: &str) -> Result<Vec<u8>> {
    document(&Dir::open(Path::new(CONTROL), 0)?, name, 0, 0o600)
}
fn remaining(end: Instant) -> Result<Duration> {
    end.checked_duration_since(Instant::now())
        .filter(|v| !v.is_zero())
        .ok_or(Error::new("WATCHDOG_READ_TIMEOUT"))
}
pub(crate) fn get(job: Option<&str>) -> Result<Vec<u8>> {
    let root = Dir::open(Path::new(CONTROL), 0)?.child("credentials")?;
    let raw = document(&root, "scheduler-audit.token", 0, 0o600)?;
    let token = std::str::from_utf8(&raw)
        .map_err(|_| Error::new("WATCHDOG_CREDENTIAL"))?
        .trim();
    require(
        !token.is_empty() && token.bytes().all(|b| b.is_ascii_graphic()),
        "WATCHDOG_CREDENTIAL",
    )?;
    let path = match job {
        None => "/scheduler/health".to_string(),
        Some(job) => {
            require(!job.is_empty() && job.len() <= 256, "WATCHDOG_JOB_ID")?;
            let encoded = job
                .bytes()
                .map(|b| {
                    if b.is_ascii_alphanumeric() || b"-._~".contains(&b) {
                        (b as char).to_string()
                    } else {
                        format!("%{b:02X}")
                    }
                })
                .collect::<String>();
            format!("/scheduler/runs?job_id={encoded}&limit=2")
        }
    };
    let end = Instant::now() + Duration::from_secs(5);
    let address: SocketAddr = "127.0.0.1:8787".parse().unwrap();
    let mut stream = TcpStream::connect_timeout(&address, remaining(end)?)?;
    let request=format!("GET {path} HTTP/1.1\r\nHost: 127.0.0.1:8787\r\nAuthorization: Bearer {token}\r\nConnection: close\r\n\r\n");
    let mut pending = request.as_bytes();
    while !pending.is_empty() {
        stream.set_write_timeout(Some(remaining(end)?))?;
        let count = stream.write(pending)?;
        require(count > 0, "WATCHDOG_HTTP")?;
        pending = &pending[count..];
    }
    let mut response = Vec::new();
    loop {
        stream.set_read_timeout(Some(remaining(end)?))?;
        let mut block = [0; 4096];
        let count = stream.read(&mut block)?;
        remaining(end)?;
        if count == 0 {
            break;
        }
        require(response.len() + count <= 4 * 1024 * 1024, "SIZE_LIMIT")?;
        response.extend_from_slice(&block[..count]);
    }
    decode_response(&response)
}
fn decode_response(raw: &[u8]) -> Result<Vec<u8>> {
    let split = raw
        .windows(4)
        .position(|v| v == b"\r\n\r\n")
        .ok_or(Error::new("WATCHDOG_HTTP"))?;
    require(split <= 16384, "WATCHDOG_HTTP")?;
    let header = std::str::from_utf8(&raw[..split]).map_err(|_| Error::new("WATCHDOG_HTTP"))?;
    let mut lines = header.split("\r\n");
    require(
        lines.next().is_some_and(|s| s.starts_with("HTTP/1.1 200 ")),
        "WATCHDOG_HTTP",
    )?;
    let mut length = None;
    for line in lines {
        let (name, value) = line.split_once(':').ok_or(Error::new("WATCHDOG_HTTP"))?;
        require(
            !name.eq_ignore_ascii_case("transfer-encoding"),
            "WATCHDOG_HTTP",
        )?;
        if name.eq_ignore_ascii_case("content-length") {
            require(length.is_none(), "WATCHDOG_HTTP")?;
            length = value.trim().parse::<usize>().ok();
            require(length.is_some(), "WATCHDOG_HTTP")?;
        }
    }
    let body = &raw[split + 4..];
    require(length == Some(body.len()), "WATCHDOG_HTTP")?;
    super::documents::strict_json(body)?;
    Ok(body.to_vec())
}
pub(crate) fn runtime_document(name: &str, uid: u32, gid: u32) -> Result<Vec<u8>> {
    require(
        matches!(name, "jobs.json" | "runs.jsonl"),
        "WATCHDOG_DOCUMENT",
    )?;
    document(
        &Dir::open(Path::new("/Users/authsvc/.agent-core/scheduler"), uid)?,
        name,
        gid,
        0o600,
    )
}
pub(super) fn incidents(uid: u32, gid: u32) -> Result<Vec<u8>> {
    document(&incident_dir(uid, gid)?, "incidents.json", gid, 0o600)
}
fn incident_dir(uid: u32, gid: u32) -> Result<Dir> {
    let dir = Dir::open(
        Path::new("/Users/authsvc/.agent-core/control/scheduler-watchdog"),
        uid,
    )?;
    require(
        dir.file.metadata()?.gid() == gid && dir.file.metadata()?.mode() & 0o777 == 0o700,
        "WATCHDOG_DOCUMENT_METADATA",
    )?;
    Ok(dir)
}
pub(super) fn routing(gid: u32) -> Result<Vec<u8>> {
    document(
        &Dir::open(Path::new("/usr/local/libexec/agent-core/config"), 0)?,
        "scheduler-routing.json",
        gid,
        0o640,
    )
}
pub(super) fn heartbeats(
    uid: u32,
    gid: u32,
    components: &[crate::transaction::ComponentImage],
) -> Result<Value> {
    let mut result = serde_json::Map::new();
    for (role, kind, owner) in [
        ("w1", crate::transaction::NativeKind::WatchdogW1, uid),
        ("w2", crate::transaction::NativeKind::WatchdogW2, 0),
    ] {
        let dir = incident_dir(uid, gid)?;
        let image = snapshot(
            &dir.open_file(&format!("{role}.heartbeat"), libc::O_RDONLY, 0)?,
            owner,
            4096,
        )?;
        let v = super::documents::strict_json(&image.bytes)?;
        require(v["role"] == role, "WATCHDOG_HEARTBEAT_IDENTITY")?;
        let c = components
            .iter()
            .find(|c| c.kind == kind)
            .ok_or(Error::new("WATCHDOG_SERVICE_IDENTITY"))?;
        require(
            c.loaded && !c.disabled && c.last_exit == Some(0),
            "WATCHDOG_PERIODIC_UNHEALTHY",
        )?;
        result.insert(role.into(),serde_json::json!({"observed_at_ms":v["ts"],"last_exit_code":0,"healthy":true,"run_count":c.runs}));
    }
    Ok(Value::Object(result))
}
pub(super) fn fresh(uid: u32, gid: u32, incident_gid: u32) -> Result<(Vec<u8>, Vec<u8>, Vec<u8>)> {
    let health = get(None)?;
    let store = runtime_document("jobs.json", uid, gid)?;
    let incidents = incidents(uid, incident_gid)?;
    let h = super::documents::strict_json(&health)?;
    require(
        h["provenance"]["store"] == sha(&store) && h["provenance"]["incidents"] == sha(&incidents),
        "WATCHDOG_CURRENT_DOCUMENT_RACE",
    )?;
    Ok((health, store, incidents))
}
#[cfg(test)]
#[path = "../../test/adoption/verification/native_io.rs"]
mod tests;
