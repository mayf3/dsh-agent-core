use std::{path::PathBuf, process::Command};
fn binary() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("target/debug/agent-deployd")
}
use crate::common;
use serde_json::{json, Value};
use std::{
    fs,
    io::{Read, Write},
    os::unix::{fs::PermissionsExt, net::UnixStream},
    process::{Child, Stdio},
    time::{Duration, Instant},
};
pub struct Daemon {
    pub child: Child,
    pub temp: tempfile::TempDir,
}
impl Drop for Daemon {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}
pub fn start() -> Daemon {
    start_with(|_| {})
}
pub fn start_with(edit: impl FnOnce(&mut Value)) -> Daemon {
    start_prepared(edit, |_| {})
}
pub fn start_prepared(
    edit: impl FnOnce(&mut Value),
    prepare: impl FnOnce(&std::path::Path),
) -> Daemon {
    let temp = common::private::temp();
    fs::set_permissions(temp.path(), fs::Permissions::from_mode(0o700)).unwrap();
    let mut config = json!({"catalog": common::fixture_catalog(),
        "callers":[{"uid":unsafe{libc::geteuid()},"gid":unsafe{libc::getegid()},"profiles":["fixture"],"producers":["producer"]}],
        "producers":["producer"], "verifiers":{"verify-1":{"kind":"external-observation","deadline_ms":500}}, "socket_gid":unsafe{libc::getegid()}});
    edit(&mut config);
    fs::write(
        temp.path().join("service.json"),
        serde_json::to_vec(&config).unwrap(),
    )
    .unwrap();
    for dir in [
        "intake",
        "intake/proposals",
        "intake/snapshots",
        "intake/policies",
        "intake/results",
        "intake/acks",
        "intake/recovery",
        "recovery-requests",
        "requests",
        "closure",
        "target",
    ] {
        fs::create_dir(temp.path().join(dir)).unwrap();
    }
    prepare(temp.path());
    let child = Command::new(binary())
        .arg("--sandbox")
        .current_dir(temp.path())
        .stdout(Stdio::null())
        .spawn()
        .expect("native daemon must exist");
    let mut d = Daemon { child, temp };
    let deadline = Instant::now() + Duration::from_secs(5);
    loop {
        assert!(
            d.child.try_wait().unwrap().is_none(),
            "daemon exited before becoming ready"
        );
        if probe_ready(&d.temp.path().join("control.sock")) {
            break;
        }
        assert!(Instant::now() < deadline, "daemon did not become ready");
        std::thread::sleep(Duration::from_millis(20));
    }
    d
}
fn probe_ready(path: &std::path::Path) -> bool {
    let Ok(mut stream) = UnixStream::connect(path) else {
        return false;
    };
    let timeout = Some(Duration::from_millis(200));
    if stream.set_read_timeout(timeout).is_err() || stream.set_write_timeout(timeout).is_err() {
        return false;
    }
    let raw = serde_json::to_vec(&status()).unwrap();
    let mut frame = Vec::with_capacity(raw.len() + 4);
    frame.extend_from_slice(&(raw.len() as u32).to_be_bytes());
    frame.extend_from_slice(&raw);
    // An unconfigured caller can receive CALLER_DENIED before the server reads its frame.
    let _ = stream.write_all(&frame);
    let mut len = [0; 4];
    if stream.read_exact(&mut len).is_err() {
        return false;
    }
    let length = u32::from_be_bytes(len) as usize;
    if length == 0 || length > 8 * 1024 * 1024 {
        return false;
    }
    let mut response = vec![0; length];
    stream.read_exact(&mut response).is_ok()
        && serde_json::from_slice::<Value>(&response)
            .map(|value| value.is_object())
            .unwrap_or(false)
}
pub fn connect(d: &Daemon) -> UnixStream {
    let s = UnixStream::connect(d.temp.path().join("control.sock")).unwrap();
    s.set_read_timeout(Some(Duration::from_secs(3))).unwrap();
    s
}
pub fn send(s: &mut UnixStream, v: &Value) -> Value {
    let raw = serde_json::to_vec(v).unwrap();
    s.write_all(&(raw.len() as u32).to_be_bytes()).unwrap();
    s.write_all(&raw).unwrap();
    let mut len = [0; 4];
    s.read_exact(&mut len).unwrap();
    let mut result = vec![0; u32::from_be_bytes(len) as usize];
    s.read_exact(&mut result).unwrap();
    serde_json::from_slice(&result).unwrap()
}
pub fn status() -> Value {
    json!({"version":1,"request_id":"r1","operation":{"op":"status","unit_id":"a".repeat(64)}})
}

impl Daemon {
    pub fn restart(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
        self.child = Command::new(binary())
            .arg("--sandbox")
            .current_dir(self.temp.path())
            .stdout(Stdio::null())
            .spawn()
            .unwrap();
        let deadline = Instant::now() + Duration::from_secs(5);
        loop {
            assert!(
                self.child.try_wait().unwrap().is_none(),
                "daemon exited during recovery"
            );
            if probe_ready(&self.temp.path().join("control.sock")) {
                break;
            }
            assert!(
                Instant::now() < deadline,
                "daemon recovery did not become ready"
            );
            std::thread::sleep(Duration::from_millis(20));
        }
    }
}
