use super::fixture::*;
use crate::common;
use common::*;
use deployment_control_plane::{
    fs::{ArtifactEntry, ArtifactManifest},
    model::*,
    trust::digest,
};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    fs,
    time::{Duration, Instant},
};
pub fn wait(mut check: impl FnMut() -> bool) {
    let begin = Instant::now();
    while !check() {
        assert!(begin.elapsed() < Duration::from_secs(12), "timed out");
        std::thread::sleep(Duration::from_millis(150));
    }
}

pub fn ready(d: &Daemon, goals: usize) -> (String, Proposal) {
    let manifest = ArtifactManifest {
        version: 1,
        entries: vec![ArtifactEntry {
            path: "main.js".into(),
            blob: "payload".into(),
            sha256: hex::encode(Sha256::digest(b"new code")),
            size: 8,
            executable: false,
        }],
    };
    let raw = serde_json::to_vec(&manifest).unwrap();
    let artifact = hex::encode(Sha256::digest(&raw));
    fs::write(d.temp.path().join("target/main.js"), b"old code").unwrap();
    let stage = d.temp.path().join("staging").join(&artifact);
    fs::create_dir_all(&stage).unwrap();
    fs::write(stage.join("manifest.json"), raw).unwrap();
    fs::write(stage.join("payload"), b"new code").unwrap();
    let mut p = proposal("prepared", "a", 1, "goal-0");
    p.goals.clear();
    p.build.payload.goal_coverage.clear();
    for i in 0..goals {
        let mut r = proposal("prepared", "a", 1, &format!("goal-{i}"))
            .goals
            .remove(0)
            .payload;
        r.artifact_sha256 = artifact.clone();
        p.build.payload.goal_coverage.push(r.coverage.clone());
        p.goals.push(signed("producer", r));
    }
    p.build.payload.artifact_sha256 = artifact.clone();
    p.build.payload.manifest_digest = digest(&manifest).unwrap();
    p.build = signed("builder", p.build.payload);
    p.reviews[0].payload.artifact_sha256 = artifact.clone();
    p.reviews[0].payload.manifest_digest = digest(&manifest).unwrap();
    p.reviews[0] = signed("reviewer", p.reviews[0].payload.clone());
    p.desired.payload.artifact_sha256 = artifact;
    p.desired = signed("authority", p.desired.payload);
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    p.policy.payload.issued_at = now;
    p.policy.payload.expires_at = now + 200;
    p.policy = signed("authority", p.policy.payload);
    let snapshot = signed(
        "producer",
        ProducerSnapshot {
            producer_id: "producer".into(),
            revision: 1,
            previous_revision: 0,
            records: p.goals.clone(),
            watermark: 1,
        },
    );
    fs::write(
        d.temp.path().join("intake/snapshots/producer-1.json"),
        serde_json::to_vec(&snapshot).unwrap(),
    )
    .unwrap();
    fs::write(
        d.temp.path().join("intake/policies/fixture.json"),
        serde_json::to_vec(&p.policy).unwrap(),
    )
    .unwrap();
    let hash = digest(&p).unwrap();
    fs::write(
        d.temp.path().join(format!("intake/proposals/{hash}.json")),
        serde_json::to_vec(&p).unwrap(),
    )
    .unwrap();
    (hash, p)
}

pub fn submit(d: &Daemon, hash: &str, request: &str) -> Value {
    send(
        &mut connect(d),
        &json!({"version":1,"request_id":request,"operation":{"op":"submit","proposal_digest":hash}}),
    )
}

pub fn unit_status(d: &Daemon, id: &str) -> Value {
    send(
        &mut connect(d),
        &json!({"version":1,"request_id":"read","operation":{"op":"status","unit_id":id}}),
    )
}

pub fn answer_requests(root: &std::path::Path, outcomes: &[GoalOutcome]) {
    let begin = Instant::now();
    let mut answered = std::collections::BTreeSet::new();
    while answered.len() < outcomes.len() {
        assert!(begin.elapsed() < Duration::from_secs(10));
        for file in fs::read_dir(root.join("requests")).unwrap() {
            let file = file.unwrap().path();
            if file.extension().is_none_or(|e| e != "json") {
                continue;
            }
            let raw = fs::read(&file).unwrap();
            let value: Value = serde_json::from_slice(&raw).unwrap();
            let id = value["id"].as_str().unwrap();
            if answered.contains(id) {
                continue;
            }
            let mut receipt: GoalReceipt =
                serde_json::from_value(value["expected"].clone()).unwrap();
            let index: usize = receipt.goal_id.rsplit('-').next().unwrap().parse().unwrap();
            receipt.outcome = outcomes[index];
            receipt.evidence_digest = "e".repeat(64);
            let result = root.join(format!("intake/results/{id}.json"));
            let tmp = result.with_extension("tmp");
            fs::write(
                &tmp,
                serde_json::to_vec(&signed("verifier", receipt)).unwrap(),
            )
            .unwrap();
            fs::rename(tmp, result).unwrap();
            answered.insert(id.to_string());
        }
        std::thread::sleep(Duration::from_millis(5));
    }
}
