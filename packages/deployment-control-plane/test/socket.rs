use std::{path::PathBuf, process::Command};
fn binary() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("target/debug/agent-deployd")
}
#[test]
fn production_entry_refuses_unprivileged_and_path_overrides() {
    assert_ne!(unsafe { libc::geteuid() }, 0);
    let output = Command::new(binary())
        .output()
        .expect("native daemon must exist");
    assert!(!output.status.success());
    assert!(String::from_utf8_lossy(&output.stderr).contains("PRODUCTION_REQUIRES_ROOT"));
    let output = Command::new(binary())
        .args(["--root", "/tmp"])
        .output()
        .unwrap();
    assert!(!output.status.success());
    assert!(String::from_utf8_lossy(&output.stderr).contains("ARGUMENTS"));
}

#[path = "common/service.rs"]
#[allow(dead_code)]
mod fixture;
use fixture::*;
use serde_json::{json, Value};
use std::{
    io::{Read, Write},
    time::{Duration, Instant},
};
#[test]
fn real_socket_rejects_identity_paths_unknown_fields_and_deep_frames() {
    let d = start();
    let good = send(&mut connect(&d), &status());
    assert_eq!(good["error"], "ACTOR_SCOPE");
    for field in ["uid", "actor", "root", "environment", "command"] {
        let mut v = status();
        v[field] = json!(0);
        assert_eq!(send(&mut connect(&d), &v)["error"], "INVALID_RECORD");
    }
    let mut v = status();
    let mut nested = json!(0);
    for _ in 0..18 {
        nested = json!([nested]);
    }
    v["unknown"] = nested;
    assert_eq!(send(&mut connect(&d), &v)["error"], "NESTING_LIMIT");
    let mut s = connect(&d);
    s.write_all(&65537u32.to_be_bytes()).unwrap();
    let mut len = [0; 4];
    s.read_exact(&mut len).unwrap();
    let mut raw = vec![0; u32::from_be_bytes(len) as usize];
    s.read_exact(&mut raw).unwrap();
    assert_eq!(
        serde_json::from_slice::<Value>(&raw).unwrap()["error"],
        "FRAME_LIMIT"
    );
}
#[test]
fn partial_disconnect_is_bounded_and_does_not_starve_status() {
    let d = start();
    let mut partial = connect(&d);
    partial.write_all(&128u32.to_be_bytes()).unwrap();
    partial.write_all(b"{").unwrap();
    let now = Instant::now();
    assert_eq!(send(&mut connect(&d), &status())["error"], "ACTOR_SCOPE");
    assert!(now.elapsed() < Duration::from_secs(1));
    std::thread::sleep(Duration::from_millis(1300));
    let mut len = [0; 4];
    assert!(partial.read_exact(&mut len).is_ok());
    drop(partial);
    assert_eq!(send(&mut connect(&d), &status())["error"], "ACTOR_SCOPE");
}
#[test]
fn peer_scope_and_connection_quota_are_enforced_by_real_transport() {
    let d = start();
    let mut pending = Vec::new();
    for _ in 0..4 {
        let mut s = connect(&d);
        s.write_all(&128u32.to_be_bytes()).unwrap();
        s.write_all(b"{").unwrap();
        pending.push(s);
    }
    std::thread::sleep(Duration::from_millis(100));
    let mut rejected = connect(&d);
    let mut length = [0; 4];
    rejected.read_exact(&mut length).unwrap();
    let mut raw = vec![0; u32::from_be_bytes(length) as usize];
    rejected.read_exact(&mut raw).unwrap();
    assert_eq!(
        serde_json::from_slice::<Value>(&raw).unwrap()["error"],
        "ACTOR_QUOTA"
    );
    drop(pending);
    std::thread::sleep(Duration::from_millis(100));
    assert_eq!(send(&mut connect(&d), &status())["error"], "ACTOR_SCOPE");
}

#[path = "common/mod.rs"]
#[allow(dead_code)]
mod common;
