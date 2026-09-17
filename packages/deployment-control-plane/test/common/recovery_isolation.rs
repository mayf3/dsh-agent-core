use super::*;
use deployment_control_plane::fs::{ArtifactEntry, ArtifactManifest, FixtureRoots};
use sha2::{Digest, Sha256};
use std::time::{Duration, Instant};

struct Scenario {
    daemon: Daemon,
    a: String,
    b: String,
    recovery: RecoveryEvidence,
    installed: CurrentInstallation,
}
fn scenario() -> Scenario {
    let d = start_with(|c| c["verifiers"]["verify-1"]["deadline_ms"] = json!(2000));
    let (hash, mut p) = ready(&d, 1);
    let a = submit(&d, &hash, "A")["result"]["unit_id"]
        .as_str()
        .unwrap()
        .to_owned();
    wait(|| unit_status(&d, &a)["result"]["state"] == "Applied");
    let q = Queue::open(d.temp.path().join("queue.db")).unwrap();
    let installed = q.daemon_current_installation("runtime").unwrap().unwrap();
    assert_eq!(installed.unit_id, a);
    assert_eq!(
        fs::read(d.temp.path().join("target/main.js")).unwrap(),
        b"new code"
    );
    let previous = p.goals[0].clone();
    let manifest = ArtifactManifest {
        version: 1,
        entries: vec![ArtifactEntry {
            path: "main.js".into(),
            blob: "payload".into(),
            sha256: hex::encode(Sha256::digest(b"later code")),
            size: 10,
            executable: false,
        }],
    };
    let raw = serde_json::to_vec(&manifest).unwrap();
    let artifact = hex::encode(Sha256::digest(&raw));
    p.request_id = "B".into();
    p.goals[0].payload.goal_id = "goal-1".into();
    p.goals[0].payload.coverage.goal_id = "goal-1".into();
    p.goals[0].payload.artifact_sha256 = artifact.clone();
    p.goals[0] = signed("producer", p.goals[0].payload.clone());
    p.build.payload.artifact_sha256 = artifact.clone();
    p.build.payload.manifest_digest = digest(&manifest).unwrap();
    p.build.payload.goal_coverage = vec![p.goals[0].payload.coverage.clone()];
    p.build = signed("builder", p.build.payload);
    p.reviews[0].payload.artifact_sha256 = artifact.clone();
    p.reviews[0].payload.manifest_digest = digest(&manifest).unwrap();
    p.reviews[0] = signed("reviewer", p.reviews[0].payload.clone());
    p.desired.payload.revision = 2;
    p.desired.payload.expected_target_generation = 1;
    p.desired.payload.artifact_sha256 = artifact.clone();
    p.desired = signed("authority", p.desired.payload);
    let snapshot = signed(
        "producer",
        ProducerSnapshot {
            producer_id: "producer".into(),
            revision: 2,
            previous_revision: 1,
            records: vec![previous, p.goals[0].clone()],
            watermark: 2,
        },
    );
    fs::write(
        d.temp.path().join("intake/snapshots/producer-2.json"),
        serde_json::to_vec(&snapshot).unwrap(),
    )
    .unwrap();
    let hash = digest(&p).unwrap();
    fs::write(
        d.temp.path().join(format!("intake/proposals/{hash}.json")),
        serde_json::to_vec(&p).unwrap(),
    )
    .unwrap();
    let answer = submit(&d, &hash, "B");
    assert!(answer.get("error").is_none(), "{answer}");
    let b = answer["result"]["unit_id"].as_str().unwrap().to_owned();
    wait(|| unit_status(&d, &b)["result"]["state"] == "Blocked");
    let stage = d.temp.path().join("staging").join(artifact);
    fs::create_dir(&stage).unwrap();
    fs::write(stage.join("manifest.json"), raw).unwrap();
    fs::write(stage.join("payload"), b"later code").unwrap();
    let mut recovery = None;
    wait(|| {
        for file in fs::read_dir(d.temp.path().join("recovery-requests")).unwrap() {
            let path = file.unwrap().path();
            if path.extension().is_some_and(|e| e == "json") {
                let r: RecoveryEvidence = serde_json::from_slice(&fs::read(path).unwrap()).unwrap();
                if r.unit_id == b {
                    recovery = Some(r);
                    return true;
                }
            }
        }
        false
    });
    let mut recovery = recovery.unwrap();
    recovery.issued_at = 1; // Valid signature and exact physical binding; deliberately expired.
    recovery.remediation_digest = "e".repeat(64);
    let s = Scenario {
        daemon: d,
        a,
        b,
        recovery,
        installed,
    };
    s.publish();
    s
}
impl Scenario {
    fn publish(&self) {
        let file = self.daemon.temp.path().join(format!(
            "intake/recovery/{}-{}.json",
            self.b, self.recovery.status_revision
        ));
        let tmp = file.with_extension("tmp");
        fs::write(
            &tmp,
            serde_json::to_vec(&signed("recovery", self.recovery.clone())).unwrap(),
        )
        .unwrap();
        fs::rename(tmp, file).unwrap();
    }
    fn request_acceptance(&self) {
        let response = send(
            &mut connect(&self.daemon),
            &json!({"version":1,"request_id":"late-A","operation":{"op":"retry-verification","unit_id":self.a}}),
        );
        assert!(response.get("error").is_none(), "{response}");
    }
    fn late_request(&self) -> Option<Value> {
        fs::read_dir(self.daemon.temp.path().join("requests"))
            .unwrap()
            .filter_map(|e| {
                let path = e.unwrap().path();
                if path.extension().is_none_or(|e| e != "json") {
                    return None;
                }
                let v: Value = serde_json::from_slice(&fs::read(path).unwrap()).unwrap();
                (v["expected"]["unit_id"] == self.a && v["expected"]["revision"] == 2).then_some(v)
            })
            .next()
    }
    fn unchanged(&self) {
        let q = Queue::open(self.daemon.temp.path().join("queue.db")).unwrap();
        let b = q.daemon_status(&self.b).unwrap();
        assert_eq!(b.state, State::Blocked);
        assert_eq!((b.preflight_attempts, b.mutating_attempts), (1, 0));
        assert_eq!(b.revision, self.recovery.status_revision);
        assert_eq!(q.daemon_status(&self.a).unwrap().mutating_attempts, 1);
        assert_eq!(
            q.daemon_current_installation("runtime").unwrap().unwrap(),
            self.installed
        );
        assert_eq!(
            fs::read(self.daemon.temp.path().join("target/main.js")).unwrap(),
            b"new code"
        );
        let db = rusqlite::Connection::open(self.daemon.temp.path().join("queue.db")).unwrap();
        assert_eq!(
            db.query_row("SELECT count(*) FROM pauses WHERE unit=?", [&self.b], |r| r
                .get::<_, u64>(0))
                .unwrap(),
            1
        );
        assert_eq!(
            db.query_row("SELECT count(*) FROM executor_pending", [], |r| r
                .get::<_, u64>(0))
                .unwrap(),
            0
        );
    }
}

#[test]
fn r02_expired_unit_recovery_does_not_starve_current_acceptance() {
    let s = scenario();
    complete_acceptance(&s);
}

fn complete_acceptance(s: &Scenario) {
    s.unchanged();
    s.request_acceptance();
    let mut request = None;
    wait(|| {
        request = s.late_request();
        request.is_some()
    });
    let request = request.unwrap();
    let mut receipt: GoalReceipt = serde_json::from_value(request["expected"].clone()).unwrap();
    receipt.outcome = GoalOutcome::Pass;
    receipt.evidence_digest = "f".repeat(64);
    fs::write(
        s.daemon.temp.path().join(format!(
            "intake/results/{}.json",
            request["id"].as_str().unwrap()
        )),
        serde_json::to_vec(&signed("verifier", receipt)).unwrap(),
    )
    .unwrap();
    let db = rusqlite::Connection::open(s.daemon.temp.path().join("queue.db")).unwrap();
    wait(|| {
        db.query_row("SELECT count(*) FROM outbox WHERE unit=?", [&s.a], |r| {
            r.get::<_, u64>(0)
        })
        .unwrap()
            == 1
    });
    s.unchanged();
}

#[test]
fn r02_incomplete_unit_recovery_metadata_does_not_starve_current_acceptance() {
    let s = scenario();
    fs::write(
        s.daemon.temp.path().join(format!(
            "intake/recovery/{}-{}.json",
            s.b, s.recovery.status_revision
        )),
        b"{}",
    )
    .unwrap();
    complete_acceptance(&s);
}

#[test]
fn r02_mismatched_unit_recovery_does_not_starve_current_acceptance() {
    let mut s = scenario();
    s.recovery.service_readback_digest = "0".repeat(64);
    s.publish();
    complete_acceptance(&s);
}

#[test]
fn r02_global_quarantine_still_blocks_current_acceptance() {
    let s = scenario();
    let roots = FixtureRoots::open(s.daemon.temp.path()).unwrap();
    let mut guard = None;
    wait(|| {
        guard = roots.lock().ok();
        guard.is_some()
    });
    let db = rusqlite::Connection::open(s.daemon.temp.path().join("queue.db")).unwrap();
    db.execute("UPDATE meta SET value=1 WHERE key='quarantine'", [])
        .unwrap();
    s.request_acceptance();
    drop(guard);
    assert_no_acceptance(&s);
}

#[test]
fn r02_unknown_shared_transaction_still_blocks_current_acceptance() {
    let s = scenario();
    let roots = FixtureRoots::open(s.daemon.temp.path()).unwrap();
    let mut guard = None;
    wait(|| {
        guard = roots.lock().ok();
        guard.is_some()
    });
    // An unbound partial transaction in the protected journal is global uncertainty.
    fs::create_dir(s.daemon.temp.path().join("transactions/unbound-r02")).unwrap();
    s.request_acceptance();
    drop(guard);
    assert_no_acceptance(&s);
}

#[test]
fn r02_rejection_store_failure_still_blocks_current_acceptance() {
    let s = scenario();
    let db = rusqlite::Connection::open(s.daemon.temp.path().join("queue.db")).unwrap();
    db.execute_batch("CREATE TRIGGER reject_receipt_storage BEFORE INSERT ON receipts BEGIN SELECT RAISE(ABORT,'injected storage failure'); END;").unwrap();
    s.request_acceptance();
    assert_no_acceptance(&s);
}

fn assert_no_acceptance(s: &Scenario) {
    let deadline = Instant::now() + Duration::from_millis(700);
    while Instant::now() < deadline {
        assert!(
            s.late_request().is_none(),
            "global unknown must not reach verifier"
        );
        std::thread::sleep(Duration::from_millis(25));
    }
    let db = rusqlite::Connection::open(s.daemon.temp.path().join("queue.db")).unwrap();
    assert_eq!(
        db.query_row("SELECT count(*) FROM outbox WHERE unit=?", [&s.a], |r| r
            .get::<_, u64>(0))
            .unwrap(),
        0
    );
    s.unchanged();
}
