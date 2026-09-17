use std::{path::PathBuf, process::Command};
fn binary() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("target/debug/agent-deployd")
}
#[path = "mod.rs"]
#[allow(dead_code)]
mod common;
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
    let temp = tempfile::tempdir().unwrap();
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
        "requests",
        "closure",
        "target",
    ] {
        fs::create_dir(temp.path().join(dir)).unwrap();
    }
    let child = Command::new(binary())
        .arg("--sandbox")
        .current_dir(temp.path())
        .stdout(Stdio::null())
        .spawn()
        .expect("native daemon must exist");
    let d = Daemon { child, temp };
    let start = Instant::now();
    while !d.temp.path().join("control.sock").exists() {
        assert!(
            start.elapsed() < Duration::from_secs(5),
            "daemon did not listen"
        );
        std::thread::sleep(Duration::from_millis(10));
    }
    d
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
            if UnixStream::connect(self.temp.path().join("control.sock")).is_ok() {
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
