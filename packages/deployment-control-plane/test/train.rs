#[path = "common/mod.rs"]
#[allow(dead_code)]
mod common;
#[path = "common/service.rs"]
#[allow(dead_code)]
mod fixture;
use common::*;
use deployment_control_plane::{model::*, queue::Queue, trust::digest};
use fixture::*;
#[path = "common/train.rs"]
mod helpers;
use helpers::*;
use serde_json::{json, Value};

use std::fs;

#[test]
fn absent_verifier_finalizes_waiting_without_local_success_and_late_pass_closes_once() {
    let d = start();
    let (hash, _) = ready(&d, 1);
    let answer = submit(&d, &hash, "submit-1");
    assert!(answer.get("error").is_none(), "{answer}");
    let id = answer["result"]["unit_id"].as_str().unwrap();
    wait(|| unit_status(&d, id)["result"]["state"] == "Applied");
    let q = Queue::open(d.temp.path().join("queue.db")).unwrap();
    let actor = Actor {
        id: format!("uid-{}", unsafe { libc::geteuid() }),
        allowed_producers: vec!["producer".into()],
        allowed_profiles: vec!["fixture".into()],
    };
    assert!(q.outbox(&actor).unwrap().is_empty());
    let goal = q
        .receipt_digests(&actor, id)
        .unwrap()
        .into_iter()
        .map(|h| q.receipt(&actor, &h).unwrap())
        .find(|s| s.contains("WaitingExternalAcceptance"))
        .expect("durable WAITING");
    let waiting: Signed<GoalReceipt> = serde_json::from_str(&goal).unwrap();
    assert_eq!(waiting.issuer, "daemon-observation");
    let mut pass = waiting.payload;
    pass.outcome = GoalOutcome::Pass;
    pass.revision += 1;
    pass.evidence_digest = "e".repeat(64);
    assert!(q
        .record_goal(
            &fixture_catalog(),
            &Signed {
                issuer: "daemon-observation".into(),
                payload: pass.clone(),
                signature: String::new()
            }
        )
        .is_err());
    // Later authentic response is consumed only after pinned physical readback.
    let retry = json!({"version":1,"request_id":"late-1","operation":{"op":"retry-verification","unit_id":id}});
    assert!(send(&mut connect(&d), &retry).get("error").is_none());
    let mut request = None;
    wait(|| {
        for file in fs::read_dir(d.temp.path().join("requests")).unwrap() {
            let value: Value =
                serde_json::from_slice(&fs::read(file.unwrap().path()).unwrap()).unwrap();
            if value["expected"]["revision"] == 2 {
                request = Some(value);
                return true;
            }
        }
        false
    });
    let request = request.unwrap();
    let mut accepted: GoalReceipt = serde_json::from_value(request["expected"].clone()).unwrap();
    accepted.outcome = GoalOutcome::Pass;
    accepted.evidence_digest = "e".repeat(64);
    fs::write(
        d.temp.path().join(format!(
            "intake/results/{}.json",
            request["id"].as_str().unwrap()
        )),
        serde_json::to_vec(&signed("verifier", accepted)).unwrap(),
    )
    .unwrap();
    wait(|| q.outbox(&actor).unwrap().len() == 1);
    let entry = q.outbox(&actor).unwrap().remove(0);
    let ack = signed(
        "producer",
        ClosureAcknowledgement {
            outbox_id: entry.id.clone(),
            goal_id: entry.goal_id.clone(),
            receipt_digest: entry.receipt_digest.clone(),
            previous_revision: 1,
            closed_revision: 2,
        },
    );
    fs::write(
        d.temp.path().join(format!("intake/acks/{}.json", entry.id)),
        serde_json::to_vec(&ack).unwrap(),
    )
    .unwrap();
    wait(|| q.outbox(&actor).unwrap().is_empty());
    assert_eq!(q.daemon_status(id).unwrap().mutating_attempts, 1);
    assert_eq!(
        fs::read(d.temp.path().join("target/main.js")).unwrap(),
        b"new code"
    );
    assert_eq!(submit(&d, &hash, "submit-1")["result"]["unit_id"], id);
}

#[test]
fn three_goals_share_one_install_two_close_one_fails_and_mutex_covers_acceptance() {
    let d = start();
    let (hash, _) = ready(&d, 3);
    let answer = submit(&d, &hash, "three");
    let id = answer["result"]["unit_id"].as_str().unwrap().to_string();
    wait(|| {
        fs::read_dir(d.temp.path().join("requests"))
            .unwrap()
            .count()
            > 0
    });
    let roots =
        deployment_control_plane::fs::FixtureRoots::open(&fs::canonicalize(d.temp.path()).unwrap())
            .unwrap();
    assert_eq!(
        roots.lock().err().unwrap().code(),
        "MUTEX_BUSY",
        "guard held during acceptance"
    );
    answer_requests(
        d.temp.path(),
        &[GoalOutcome::Pass, GoalOutcome::Pass, GoalOutcome::Fail],
    );
    wait(|| unit_status(&d, &id)["result"]["state"] == "Applied");
    let _guard = roots.lock().unwrap();
    let q = Queue::open(d.temp.path().join("queue.db")).unwrap();
    let actor = Actor {
        id: format!("uid-{}", unsafe { libc::geteuid() }),
        allowed_producers: vec![],
        allowed_profiles: vec![],
    };
    assert_eq!(q.outbox(&actor).unwrap().len(), 2);
    let receipts = q.receipt_digests(&actor, &id).unwrap();
    assert_eq!(receipts.len(), 4);
    let values: Vec<Value> = receipts
        .iter()
        .map(|r| serde_json::from_str(&q.receipt(&actor, r).unwrap()).unwrap())
        .collect();
    assert_eq!(
        values
            .iter()
            .filter(|v| v["payload"]["outcome"] == "Fail")
            .count(),
        1
    );
    let journals = fs::read_dir(d.temp.path().join("transactions"))
        .unwrap()
        .map(|e| e.unwrap().path())
        .collect::<Vec<_>>();
    assert_eq!(journals.len(), 1);
    let records = fs::read_dir(&journals[0])
        .unwrap()
        .map(|e| String::from_utf8_lossy(&fs::read(e.unwrap().path()).unwrap()).to_string())
        .collect::<Vec<_>>();
    assert_eq!(
        records
            .iter()
            .filter(|r| r.contains("fixture-start") && r.contains("OperationIntent"))
            .count(),
        1
    );
    assert_eq!(q.daemon_status(&id).unwrap().mutating_attempts, 1);
    assert_eq!(submit(&d, &hash, "three")["result"]["unit_id"], id);
}
#[test]
fn unknown_external_canary_is_never_reissued_or_overwritten() {
    let d = start();
    let (hash, _) = ready(&d, 1);
    let answer = submit(&d, &hash, "unknown");
    let id = answer["result"]["unit_id"].as_str().unwrap();
    answer_requests(d.temp.path(), &[GoalOutcome::OutcomeUnknown]);
    wait(|| unit_status(&d, id)["result"]["state"] == "Quarantined");
    let retry = json!({"version":1,"request_id":"retry-unknown","operation":{"op":"retry-verification","unit_id":id}});
    assert_eq!(send(&mut connect(&d), &retry)["error"], "NOT_APPLIED");
    assert_eq!(
        fs::read_dir(d.temp.path().join("requests"))
            .unwrap()
            .count(),
        1
    );
    let q = Queue::open(d.temp.path().join("queue.db")).unwrap();
    assert_eq!(q.daemon_status(id).unwrap().mutating_attempts, 1);
}
#[test]
fn durable_disconnected_ack_reopens_after_intake_disappears() {
    use std::io::Write;
    let mut d = start();
    let (hash, _) = ready(&d, 1);
    let roots =
        deployment_control_plane::fs::FixtureRoots::open(&fs::canonicalize(d.temp.path()).unwrap())
            .unwrap();
    let guard = roots.lock().unwrap();
    let mut stream = connect(&d);
    let raw=serde_json::to_vec(&json!({"version":1,"request_id":"lost-ack","operation":{"op":"submit","proposal_digest":hash}})).unwrap();
    stream.write_all(&(raw.len() as u32).to_be_bytes()).unwrap();
    stream.write_all(&raw).unwrap();
    let q = Queue::open(d.temp.path().join("queue.db")).unwrap();
    wait(|| q.unit_count().unwrap() == 1);
    drop(stream);
    d.child.kill().unwrap();
    d.child.wait().unwrap();
    drop(guard);
    fs::remove_file(d.temp.path().join(format!("intake/proposals/{hash}.json"))).unwrap();
    fs::remove_file(d.temp.path().join("intake/policies/fixture.json")).unwrap();
    d.restart();
    let replay = submit(&d, &hash, "lost-ack");
    assert!(replay.get("error").is_none(), "{replay}");
    assert_eq!(q.unit_count().unwrap(), 1);
    assert_eq!(replay["result"]["state"], "Queued");
    assert_eq!(
        fs::read(d.temp.path().join("target/main.js")).unwrap(),
        b"old code"
    );
}
#[test]
fn killed_daemon_during_verification_reopens_unknown_without_replay() {
    let mut d = start();
    let (hash, _) = ready(&d, 1);
    let answer = submit(&d, &hash, "crash");
    let id = answer["result"]["unit_id"].as_str().unwrap().to_string();
    wait(|| {
        fs::read_dir(d.temp.path().join("requests"))
            .unwrap()
            .count()
            > 0
    });
    d.child.kill().unwrap();
    d.child.wait().unwrap();
    let before = fs::read(d.temp.path().join("target/main.js")).unwrap();
    d.restart();
    wait(|| unit_status(&d, &id)["result"]["state"] == "Quarantined");
    let q = Queue::open(d.temp.path().join("queue.db")).unwrap();
    assert_eq!(q.daemon_status(&id).unwrap().mutating_attempts, 1);
    assert_eq!(
        fs::read(d.temp.path().join("target/main.js")).unwrap(),
        before
    );
    assert_eq!(
        fs::read_dir(d.temp.path().join("requests"))
            .unwrap()
            .count(),
        1
    );
    assert_eq!(submit(&d, &hash, "crash")["result"]["state"], "Quarantined");
}
#[test]
fn authenticated_producer_watermark_and_forged_build_cannot_be_bypassed() {
    let d = start();
    let (hash, mut p) = ready(&d, 1);
    fs::remove_file(d.temp.path().join("intake/snapshots/producer-1.json")).unwrap();
    // The daemon may already have ingested the first snapshot; forge a fresh second Goal.
    p.goals[0].payload.goal_id = "unregistered".into();
    p.goals[0].payload.coverage.goal_id = "unregistered".into();
    p.goals[0] = signed("producer", p.goals[0].payload.clone());
    p.build.payload.goal_coverage = vec![p.goals[0].payload.coverage.clone()];
    p.build = signed("builder", p.build.payload);
    let fresh = digest(&p).unwrap();
    fs::write(
        d.temp.path().join(format!("intake/proposals/{fresh}.json")),
        serde_json::to_vec(&p).unwrap(),
    )
    .unwrap();
    assert_eq!(
        submit(&d, &fresh, "no-ready")["error"],
        "READY_REVISION_MISMATCH"
    );
    p.build.signature = "00".repeat(64);
    let forged = digest(&p).unwrap();
    fs::write(
        d.temp
            .path()
            .join(format!("intake/proposals/{forged}.json")),
        serde_json::to_vec(&p).unwrap(),
    )
    .unwrap();
    assert_eq!(submit(&d, &forged, "forged")["error"], "INVALID_SIGNATURE");
    let _ = hash;
    assert_eq!(
        fs::read(d.temp.path().join("target/main.js")).unwrap(),
        b"old code"
    );
}

#[test]
fn simultaneous_targets_use_one_host_mutex_and_distinct_private_targets() {
    let d = start_with(|v| {
        let mut second = v["catalog"]["profiles"]["fixture"].clone();
        second["target_runtime"] = json!("runtime2");
        second["install_root_id"] = json!("root2");
        second["launchd_label"] = json!("fixture.second");
        v["catalog"]["profiles"]["fixture2"] = second;
        for (_, key) in v["catalog"]["keys"].as_object_mut().unwrap() {
            key["scopes"]
                .as_array_mut()
                .unwrap()
                .push(json!("fixture2"));
        }
        v["callers"][0]["profiles"] = json!(["fixture", "fixture2"]);
        v["verifiers"]["verify-1"]["deadline_ms"] = json!(2000);
    });
    for target in ["runtime", "runtime2"] {
        fs::create_dir_all(d.temp.path().join(format!("targets/{target}"))).unwrap();
        fs::write(
            d.temp.path().join(format!("targets/{target}/main.js")),
            b"old code",
        )
        .unwrap();
    }
    let (hash, p) = ready(&d, 1);
    let mut p2 = p.clone();
    p2.deployment_profile = "fixture2".into();
    p2.desired.payload.target_runtime = "runtime2".into();
    p2.desired = signed("authority", p2.desired.payload);
    p2.goals[0].payload.goal_id = "goal-1".into();
    p2.goals[0].payload.coverage.goal_id = "goal-1".into();
    p2.goals[0] = signed("producer", p2.goals[0].payload.clone());
    p2.build.payload.goal_coverage = vec![p2.goals[0].payload.coverage.clone()];
    p2.build = signed("builder", p2.build.payload);
    let p2hash = digest(&p2).unwrap();
    fs::write(
        d.temp
            .path()
            .join(format!("intake/proposals/{p2hash}.json")),
        serde_json::to_vec(&p2).unwrap(),
    )
    .unwrap();
    fs::write(
        d.temp.path().join("intake/policies/fixture2.json"),
        serde_json::to_vec(&p2.policy).unwrap(),
    )
    .unwrap();
    let snapshot = signed(
        "producer",
        ProducerSnapshot {
            producer_id: "producer".into(),
            revision: 2,
            previous_revision: 1,
            records: vec![p.goals[0].clone(), p2.goals[0].clone()],
            watermark: 2,
        },
    );
    fs::write(
        d.temp.path().join("intake/snapshots/producer-2.json"),
        serde_json::to_vec(&snapshot).unwrap(),
    )
    .unwrap();
    let answers = std::thread::scope(|scope| {
        let first = scope.spawn(|| submit(&d, &hash, "first"));
        let second = scope.spawn(|| submit(&d, &p2hash, "second"));
        [first.join().unwrap(), second.join().unwrap()]
    });
    let ids: Vec<_> = answers
        .iter()
        .map(|a| a["result"]["unit_id"].as_str().unwrap().to_string())
        .collect();
    wait(|| {
        fs::read_dir(d.temp.path().join("requests"))
            .unwrap()
            .count()
            > 0
    });
    let roots =
        deployment_control_plane::fs::FixtureRoots::open(&fs::canonicalize(d.temp.path()).unwrap())
            .unwrap();
    assert_eq!(roots.lock().err().unwrap().code(), "MUTEX_BUSY");
    let states: Vec<_> = ids
        .iter()
        .map(|id| unit_status(&d, id)["result"]["state"].clone())
        .collect();
    assert_eq!(states.iter().filter(|s| **s == "Verifying").count(), 1);
    assert_eq!(states.iter().filter(|s| **s == "Queued").count(), 1);
    answer_requests(d.temp.path(), &[GoalOutcome::Pass, GoalOutcome::Pass]);
    wait(|| {
        ids.iter()
            .all(|id| unit_status(&d, id)["result"]["state"] == "Applied")
    });
    for target in ["runtime", "runtime2"] {
        assert_eq!(
            fs::read(d.temp.path().join(format!("targets/{target}/main.js"))).unwrap(),
            b"new code"
        );
    }
    assert_eq!(
        fs::read(d.temp.path().join("target/main.js")).unwrap(),
        b"old code"
    );
}

#[path = "service_cases.rs"]
mod service_cases;

#[path = "common/service_repair.rs"]
mod repair;

#[path = "common/remediation.rs"]
mod remediation_tests;

#[path = "common/recovery_isolation.rs"]
mod recovery_isolation;
