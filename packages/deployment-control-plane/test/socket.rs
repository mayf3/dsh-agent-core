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
use deployment_control_plane::{model::*, trust};
use fixture::*;
use serde_json::{json, Value};
use std::{
    fs,
    io::{Read, Write},
    path::Path,
    time::{Duration, Instant},
};

fn current_proposal(request: &str) -> Proposal {
    let mut proposal = common::proposal(request, "e", 1, "goal");
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    proposal.policy.payload.issued_at = now - 1;
    proposal.policy.payload.expires_at = now + 299;
    proposal.policy = common::signed("authority", proposal.policy.payload);
    proposal
}

fn prepare_proposal(root: &Path, proposal: &Proposal) -> String {
    let digest = trust::digest(proposal).unwrap();
    fs::write(
        root.join("intake/proposals").join(format!("{digest}.json")),
        serde_json::to_vec(proposal).unwrap(),
    )
    .unwrap();
    let snapshot = common::signed(
        "producer",
        ProducerSnapshot {
            producer_id: "producer".into(),
            revision: 1,
            previous_revision: 0,
            records: proposal.goals.clone(),
            watermark: 1,
        },
    );
    fs::write(
        root.join("intake/snapshots/producer-1.json"),
        serde_json::to_vec(&snapshot).unwrap(),
    )
    .unwrap();
    digest
}

fn submit(d: &Daemon, digest: &str) -> Value {
    send(
        &mut connect(d),
        &json!({
            "version": 1,
            "request_id": format!("m2-{}", &digest[..16]),
            "operation": {"op": "submit", "proposal_digest": digest},
        }),
    )
}

fn assert_no_submission_mutation(d: &Daemon) {
    let db = rusqlite::Connection::open(d.temp.path().join("queue.db")).unwrap();
    for table in ["units", "requests", "coverage", "attachments", "actors"] {
        let count: u64 = db
            .query_row(&format!("SELECT count(*) FROM {table}"), [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(count, 0, "denied submit mutated {table}");
    }
}
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

#[test]
fn m2_real_transport_rejects_unconfigured_kernel_peer() {
    let d = start_with(|config| config["callers"] = json!([]));
    assert_eq!(send(&mut connect(&d), &status())["error"], "CALLER_DENIED");
}

#[test]
fn m2_real_transport_rejects_unauthorized_profile_target() {
    let proposal = current_proposal("unauthorized-target");
    let mut digest = String::new();
    let d = start_prepared(
        |config| config["callers"][0]["profiles"] = json!([]),
        |root| digest = prepare_proposal(root, &proposal),
    );
    assert_eq!(submit(&d, &digest)["error"], "ACTOR_SCOPE");
    assert_no_submission_mutation(&d);
}

#[test]
fn m2_real_transport_rejects_wrong_runtime_target() {
    let mut proposal = current_proposal("wrong-runtime");
    proposal.desired.payload.target_runtime = "wrong-runtime".into();
    proposal.desired = common::signed("authority", proposal.desired.payload);
    let mut digest = String::new();
    let d = start_prepared(|_| {}, |root| digest = prepare_proposal(root, &proposal));
    assert_eq!(submit(&d, &digest)["error"], "PROFILE_MISMATCH");
    assert_no_submission_mutation(&d);
}

#[test]
fn m2_real_transport_rejects_bad_artifact_binding() {
    let mut proposal = current_proposal("bad-artifact");
    proposal.desired.payload.artifact_sha256 = "f".repeat(64);
    proposal.desired = common::signed("authority", proposal.desired.payload);
    let mut digest = String::new();
    let d = start_prepared(|_| {}, |root| digest = prepare_proposal(root, &proposal));
    assert_eq!(submit(&d, &digest)["error"], "ARTIFACT_MISMATCH");
    assert_no_submission_mutation(&d);
}

#[test]
fn m2_real_transport_rejects_stale_preimage() {
    let mut proposal = current_proposal("stale-preimage");
    proposal.desired.payload.expected_target_generation = 1;
    proposal.desired = common::signed("authority", proposal.desired.payload);
    let mut digest = String::new();
    let d = start_prepared(|_| {}, |root| digest = prepare_proposal(root, &proposal));
    assert_eq!(submit(&d, &digest)["error"], "PREIMAGE_MISMATCH");
    assert_no_submission_mutation(&d);
}

#[path = "common/mod.rs"]
#[allow(dead_code)]
mod common;
