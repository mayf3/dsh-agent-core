use super::{common::*, fixture::*, helpers::*};
use deployment_control_plane::{model::*, queue::Queue, trust::digest};
use serde_json::json;
use std::{fs, os::unix::fs::PermissionsExt};
#[test]
fn typed_native_verifier_uses_accepted_key_and_public_receipt_discovery() {
    use sha2::{Digest, Sha256};
    let d = start_with(|v| {
        v["verifiers"]["verify-1"] = json!({"kind":"native-installed-readback","issuer":"verifier"})
    });
    fs::create_dir(d.temp.path().join("verifier-keys")).unwrap();
    let key = d.temp.path().join("verifier-keys/verifier.json");
    fs::write(
        &key,
        serde_json::to_vec(&hex::encode(Sha256::digest(b"verifier"))).unwrap(),
    )
    .unwrap();
    fs::set_permissions(&key, fs::Permissions::from_mode(0o644)).unwrap();
    let (hash, _) = ready(&d, 1);
    let submitted = submit(&d, &hash, "native");
    let id = submitted["result"]["unit_id"].as_str().unwrap();
    std::thread::sleep(std::time::Duration::from_millis(250));
    assert_eq!(
        fs::read(d.temp.path().join("target/main.js")).unwrap(),
        b"old code",
        "private key metadata must block before mutation"
    );
    fs::set_permissions(&key, fs::Permissions::from_mode(0o600)).unwrap();
    wait(|| unit_status(&d, id)["result"]["state"] == "Applied");
    let status = unit_status(&d, id);
    let receipts = status["result"]["receipt_digests"]
        .as_array()
        .expect("discoverable actor-scoped receipts");
    assert_eq!(receipts.len(), 2);
    let values:Vec<_>=receipts.iter().map(|h|send(&mut connect(&d),&json!({"version":1,"request_id":"receipt","operation":{"op":"receipt","digest":h}}))).collect();
    assert_eq!(
        values
            .iter()
            .filter(|v| v["result"]["payload"]["outcome"] == "Pass")
            .count(),
        1
    );
    assert_eq!(
        fs::read_dir(d.temp.path().join("requests"))
            .unwrap()
            .count(),
        0
    );
}
#[test]
fn late_coverage_reuses_exact_original_attachment_and_never_reinstalls() {
    let d = start();
    let (hash, p) = ready(&d, 1);
    let initial = submit(&d, &hash, "initial");
    let id = initial["result"]["unit_id"].as_str().unwrap();
    answer_requests(d.temp.path(), &[GoalOutcome::Pass]);
    wait(|| unit_status(&d, id)["result"]["state"] == "Applied");
    let mut p2 = p.clone();
    let mut added = p2.goals[0].payload.clone();
    added.goal_id = "goal-1".into();
    added.coverage.goal_id = "goal-1".into();
    p2.goals.push(signed("producer", added));
    p2.build.payload.goal_coverage = p2
        .goals
        .iter()
        .map(|r| r.payload.coverage.clone())
        .collect();
    p2.build = signed("builder", p2.build.payload);
    let snapshot = signed(
        "producer",
        ProducerSnapshot {
            producer_id: "producer".into(),
            revision: 2,
            previous_revision: 1,
            records: p2.goals.clone(),
            watermark: 2,
        },
    );
    fs::write(
        d.temp.path().join("intake/snapshots/producer-2.json"),
        serde_json::to_vec(&snapshot).unwrap(),
    )
    .unwrap();
    let hash2 = digest(&p2).unwrap();
    fs::write(
        d.temp.path().join(format!("intake/proposals/{hash2}.json")),
        serde_json::to_vec(&p2).unwrap(),
    )
    .unwrap();
    let late = submit(&d, &hash2, "late");
    assert_eq!(late["result"]["unit_id"], id);
    assert_eq!(late["result"]["install_required"], false);
    answer_requests(d.temp.path(), &[GoalOutcome::Pass, GoalOutcome::Pass]);
    let q = Queue::open(d.temp.path().join("queue.db")).unwrap();
    let actor = Actor {
        id: format!("uid-{}", unsafe { libc::geteuid() }),
        allowed_profiles: vec![],
        allowed_producers: vec![],
    };
    wait(|| q.outbox(&actor).unwrap().len() == 2);
    assert_eq!(q.daemon_status(id).unwrap().mutating_attempts, 1);
    assert_eq!(q.receipt_digests(&actor, id).unwrap().len(), 3);
}
#[test]
fn signed_closure_ack_cannot_close_different_goal_and_redelivery_does_not_install() {
    let d = start();
    let (hash, _) = ready(&d, 1);
    let result = submit(&d, &hash, "ack");
    let id = result["result"]["unit_id"].as_str().unwrap();
    answer_requests(d.temp.path(), &[GoalOutcome::Pass]);
    wait(|| unit_status(&d, id)["result"]["state"] == "Applied");
    let q = Queue::open(d.temp.path().join("queue.db")).unwrap();
    let actor = Actor {
        id: format!("uid-{}", unsafe { libc::geteuid() }),
        allowed_profiles: vec![],
        allowed_producers: vec![],
    };
    let entry = q.outbox(&actor).unwrap().remove(0);
    let mut ack = ClosureAcknowledgement {
        outbox_id: entry.id.clone(),
        goal_id: "other-goal".into(),
        receipt_digest: entry.receipt_digest.clone(),
        previous_revision: 1,
        closed_revision: 2,
    };
    let path = d.temp.path().join(format!("intake/acks/{}.json", entry.id));
    fs::write(
        &path,
        serde_json::to_vec(&signed("producer", ack.clone())).unwrap(),
    )
    .unwrap();
    std::thread::sleep(std::time::Duration::from_millis(200));
    assert_eq!(q.outbox(&actor).unwrap().len(), 1);
    ack.goal_id = entry.goal_id;
    fs::write(path, serde_json::to_vec(&signed("producer", ack)).unwrap()).unwrap();
    wait(|| q.outbox(&actor).unwrap().is_empty());
    assert_eq!(q.daemon_status(id).unwrap().mutating_attempts, 1);
}
#[test]
fn late_multi_goal_proposal_cannot_replace_waiting_goals_original_attachment() {
    let d = start();
    let (_, mut p) = ready(&d, 1);
    p.build.payload.dependency_closure = vec!["9".repeat(64)];
    p.build = signed("builder", p.build.payload);
    let hash = digest(&p).unwrap();
    fs::write(
        d.temp.path().join(format!("intake/proposals/{hash}.json")),
        serde_json::to_vec(&p).unwrap(),
    )
    .unwrap();
    let answer = submit(&d, &hash, "original-waiting");
    let id = answer["result"]["unit_id"].as_str().unwrap();
    wait(|| unit_status(&d, id)["result"]["state"] == "Applied");
    let q = Queue::open(d.temp.path().join("queue.db")).unwrap();
    let original = q.daemon_attachments(id).unwrap()[0].digest.clone();
    let mut p2 = p.clone();
    let mut g = p.goals[0].payload.clone();
    g.goal_id = "goal-1".into();
    g.coverage.goal_id = "goal-1".into();
    p2.goals.push(signed("producer", g));
    p2.build.payload.goal_coverage = p2
        .goals
        .iter()
        .map(|g| g.payload.coverage.clone())
        .collect();
    for n in 0..4096 {
        p2.build.payload.dependency_closure = vec![format!("{n:064x}")];
        p2.build = signed("builder", p2.build.payload);
        if digest(&(id, &p2.goals, &p2.build, &p2.reviews)).unwrap() < original {
            break;
        }
    }
    assert!(
        digest(&(id, &p2.goals, &p2.build, &p2.reviews)).unwrap() < original,
        "original={original}; candidate={}",
        digest(&(id, &p2.goals, &p2.build, &p2.reviews)).unwrap()
    );
    let snapshot = signed(
        "producer",
        ProducerSnapshot {
            producer_id: "producer".into(),
            revision: 2,
            previous_revision: 1,
            records: p2.goals.clone(),
            watermark: 2,
        },
    );
    fs::write(
        d.temp.path().join("intake/snapshots/producer-2.json"),
        serde_json::to_vec(&snapshot).unwrap(),
    )
    .unwrap();
    let hash2 = digest(&p2).unwrap();
    fs::write(
        d.temp.path().join(format!("intake/proposals/{hash2}.json")),
        serde_json::to_vec(&p2).unwrap(),
    )
    .unwrap();
    assert_eq!(submit(&d, &hash2, "multi-late")["result"]["unit_id"], id);
    let mut answered = std::collections::BTreeSet::new();
    wait(|| {
        for path in fs::read_dir(d.temp.path().join("requests")).unwrap() {
            let value: serde_json::Value =
                serde_json::from_slice(&fs::read(path.unwrap().path()).unwrap()).unwrap();
            let mut r: GoalReceipt = serde_json::from_value(value["expected"].clone()).unwrap();
            if r.goal_id == "goal-0" && r.revision == 1 {
                continue;
            }
            if answered.contains(&r.goal_id) {
                continue;
            }
            if r.goal_id == "goal-0" {
                assert_eq!(r.attachment_digest, original);
            }
            answered.insert(r.goal_id.clone());
            r.outcome = GoalOutcome::Pass;
            r.evidence_digest = "e".repeat(64);
            fs::write(
                d.temp.path().join(format!(
                    "intake/results/{}.json",
                    value["id"].as_str().unwrap()
                )),
                serde_json::to_vec(&signed("verifier", r)).unwrap(),
            )
            .unwrap();
        }
        answered.len() == 2
    });
    let actor = Actor {
        id: format!("uid-{}", unsafe { libc::geteuid() }),
        allowed_profiles: vec![],
        allowed_producers: vec![],
    };
    wait(|| q.outbox(&actor).unwrap().len() == 2);
    assert_eq!(q.daemon_status(id).unwrap().mutating_attempts, 1);
}
