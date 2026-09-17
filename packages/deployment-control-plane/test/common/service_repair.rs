use super::{common::*, fixture::*, helpers::*};
use deployment_control_plane::{
    fs::FixtureRoots,
    model::*,
    queue::Queue,
    trust::{canonical_bytes, digest},
};
use serde_json::{json, Value};
use std::{fs, io::Write, os::unix::fs::PermissionsExt, time::Duration};
fn durable(path: &std::path::Path, raw: &[u8]) {
    let mut f = fs::File::create(path).unwrap();
    fs::set_permissions(path, fs::Permissions::from_mode(0o600)).unwrap();
    f.write_all(raw).unwrap();
    f.sync_all().unwrap();
    fs::File::open(path.parent().unwrap())
        .unwrap()
        .sync_all()
        .unwrap();
}
fn actor() -> Actor {
    Actor {
        id: format!("uid-{}", unsafe { libc::geteuid() }),
        allowed_profiles: vec![],
        allowed_producers: vec![],
    }
}
#[test]
fn admitted_temporary_records_resume_after_real_daemon_restart_and_concurrent_submit() {
    for complete in [true, false] {
        let mut d = start();
        let (hash, p) = ready(&d, 1);
        let raw = canonical_bytes(&p).unwrap();
        d.child.kill().unwrap();
        d.child.wait().unwrap();
        let temp = d.temp.path().join(format!("admitted/{hash}.tmp"));
        durable(
            &temp,
            if complete {
                &raw
            } else {
                &raw[..raw.len() / 2]
            },
        );
        d.restart();
        let answers = std::thread::scope(|scope| {
            let jobs: Vec<_> = (0..3)
                .map(|n| {
                    scope.spawn({
                        let d = &d;
                        let hash = &hash;
                        move || submit(d, hash, &format!("simultaneous-{n}"))
                    })
                })
                .collect();
            jobs.into_iter()
                .map(|j| j.join().unwrap())
                .collect::<Vec<_>>()
        });
        for answer in &answers {
            assert!(answer.get("error").is_none(), "{answer}");
            assert_eq!(answer["result"]["unit_id"], answers[0]["result"]["unit_id"]);
        }
        assert_eq!(
            fs::read(d.temp.path().join(format!("admitted/{hash}.json"))).unwrap(),
            raw
        );
        assert!(!temp.exists());
        let q = Queue::open(d.temp.path().join("queue.db")).unwrap();
        assert_eq!(q.unit_count().unwrap(), 1);
    }
}
#[test]
fn closure_temporary_records_resume_after_real_daemon_restart_without_reinstall() {
    for complete in [true, false] {
        let mut d = start();
        let (hash, _) = ready(&d, 1);
        let result = submit(&d, &hash, "closure");
        let id = result["result"]["unit_id"].as_str().unwrap();
        answer_requests(d.temp.path(), &[GoalOutcome::Pass]);
        wait(|| unit_status(&d, id)["result"]["state"] == "Applied");
        let q = Queue::open(d.temp.path().join("queue.db")).unwrap();
        let entry = q.outbox(&actor()).unwrap().remove(0);
        d.child.kill().unwrap();
        d.child.wait().unwrap();
        let final_path = d.temp.path().join(format!("closure/{}.json", entry.id));
        if final_path.exists() {
            fs::remove_file(&final_path).unwrap();
        }
        let temp = d.temp.path().join(format!("closure/{}.tmp", entry.id));
        let raw = canonical_bytes(&entry).unwrap();
        durable(
            &temp,
            if complete {
                &raw
            } else {
                &raw[..raw.len() / 2]
            },
        );
        d.restart();
        wait(|| final_path.exists());
        assert_eq!(fs::read(&final_path).unwrap(), raw);
        assert!(!temp.exists());
        let ack = signed(
            "producer",
            ClosureAcknowledgement {
                outbox_id: entry.id.clone(),
                goal_id: entry.goal_id,
                receipt_digest: entry.receipt_digest,
                previous_revision: 1,
                closed_revision: 2,
            },
        );
        durable(
            &d.temp.path().join(format!("intake/acks/{}.json", entry.id)),
            &serde_json::to_vec(&ack).unwrap(),
        );
        wait(|| q.outbox(&actor()).unwrap().is_empty());
        assert_eq!(q.daemon_status(id).unwrap().mutating_attempts, 1);
    }
}
#[test]
fn partial_temporary_mismatch_is_preserved_and_active_publisher_is_not_repaired() {
    use std::os::fd::AsRawFd;
    let d = start();
    let (hash, p) = ready(&d, 1);
    let temp = d.temp.path().join(format!("admitted/{hash}.tmp"));
    durable(&temp, b"mismatch");
    assert_eq!(submit(&d, &hash, "mismatch")["error"], "IMMUTABLE_DELIVERY");
    assert_eq!(fs::read(&temp).unwrap(), b"mismatch");
    fs::remove_file(&temp).unwrap();
    let raw = canonical_bytes(&p).unwrap();
    durable(&temp, &raw[..8]);
    let lock_path = d.temp.path().join("publication.lock");
    let lock = fs::OpenOptions::new()
        .create(true)
        .truncate(false)
        .read(true)
        .write(true)
        .open(&lock_path)
        .unwrap();
    fs::set_permissions(&lock_path, fs::Permissions::from_mode(0o600)).unwrap();
    assert_eq!(
        unsafe { libc::flock(lock.as_raw_fd(), libc::LOCK_EX | libc::LOCK_NB) },
        0
    );
    assert_eq!(submit(&d, &hash, "busy")["error"], "MAILBOX_BUSY");
    assert_eq!(fs::read(&temp).unwrap(), raw[..8]);
    assert_eq!(unsafe { libc::flock(lock.as_raw_fd(), libc::LOCK_UN) }, 0);
    assert!(submit(&d, &hash, "retry").get("error").is_none());
}
fn request(d: &Daemon, goal: &str, revision: u64) -> Value {
    let mut result = None;
    wait(|| {
        for file in fs::read_dir(d.temp.path().join("requests")).unwrap() {
            let file = file.unwrap().path();
            if file.extension().is_none_or(|s| s != "json") {
                continue;
            }
            let value: Value = serde_json::from_slice(&fs::read(file).unwrap()).unwrap();
            if value["expected"]["goal_id"] == goal && value["expected"]["revision"] == revision {
                result = Some(value);
                return true;
            }
        }
        false
    });
    result.unwrap()
}
fn accept(d: &Daemon, v: &Value) {
    let mut r: GoalReceipt = serde_json::from_value(v["expected"].clone()).unwrap();
    r.outcome = GoalOutcome::Pass;
    r.evidence_digest = "e".repeat(64);
    durable(
        &d.temp
            .path()
            .join(format!("intake/results/{}.json", v["id"].as_str().unwrap())),
        &serde_json::to_vec(&signed("verifier", r)).unwrap(),
    );
}
#[test]
fn newer_late_coverage_survives_completion_of_an_older_verification_claim() {
    let d = start_with(|v| v["verifiers"]["verify-1"]["deadline_ms"] = json!(2000));
    let (hash, p) = ready(&d, 1);
    let initial = submit(&d, &hash, "initial");
    let id = initial["result"]["unit_id"].as_str().unwrap();
    wait(|| unit_status(&d, id)["result"]["state"] == "Applied");
    assert!(send(&mut connect(&d),&json!({"version":1,"request_id":"old-pass","operation":{"op":"retry-verification","unit_id":id}})).get("error").is_none());
    let old = request(&d, "goal-0", 2);
    let mut next = p.clone();
    let mut g = p.goals[0].payload.clone();
    g.goal_id = "goal-1".into();
    g.coverage.goal_id = "goal-1".into();
    next.goals.push(signed("producer", g));
    next.build.payload.goal_coverage = next
        .goals
        .iter()
        .map(|g| g.payload.coverage.clone())
        .collect();
    next.build = signed("builder", next.build.payload);
    let snapshot = signed(
        "producer",
        ProducerSnapshot {
            producer_id: "producer".into(),
            revision: 2,
            previous_revision: 1,
            records: next.goals.clone(),
            watermark: 2,
        },
    );
    durable(
        &d.temp.path().join("intake/snapshots/producer-2.json"),
        &serde_json::to_vec(&snapshot).unwrap(),
    );
    let hash2 = digest(&next).unwrap();
    durable(
        &d.temp.path().join(format!("intake/proposals/{hash2}.json")),
        &serde_json::to_vec(&next).unwrap(),
    );
    let ack = submit(&d, &hash2, "late-goal");
    assert_eq!(ack["result"]["unit_id"], id);
    assert_eq!(ack["result"]["install_required"], false);
    accept(&d, &old);
    let new = request(&d, "goal-1", 1);
    accept(&d, &new);
    let q = Queue::open(d.temp.path().join("queue.db")).unwrap();
    wait(|| q.outbox(&actor()).unwrap().len() == 2);
    assert_eq!(q.daemon_status(id).unwrap().mutating_attempts, 1);
}
#[test]
fn transient_mutex_contention_retains_acknowledged_verification_until_readback() {
    let d = start();
    let (hash, _) = ready(&d, 1);
    let result = submit(&d, &hash, "waiting");
    let id = result["result"]["unit_id"].as_str().unwrap();
    wait(|| unit_status(&d, id)["result"]["state"] == "Applied");
    let roots = FixtureRoots::open(&fs::canonicalize(d.temp.path()).unwrap()).unwrap();
    let guard = roots.lock().unwrap();
    let ack = send(
        &mut connect(&d),
        &json!({"version":1,"request_id":"contended","operation":{"op":"retry-verification","unit_id":id}}),
    );
    assert_eq!(ack["result"]["queued"], true);
    std::thread::sleep(Duration::from_millis(300));
    let db = rusqlite::Connection::open(d.temp.path().join("queue.db")).unwrap();
    assert_eq!(
        db.query_row(
            "SELECT count(*) FROM verification_requests WHERE unit=?",
            [id],
            |r| r.get::<_, u64>(0)
        )
        .unwrap(),
        1
    );
    let generation: u64 = db
        .query_row(
            "SELECT generation FROM verification_requests WHERE unit=?",
            [id],
            |r| r.get(0),
        )
        .unwrap();
    drop(guard);
    accept(&d, &request(&d, "goal-0", 2));
    let q = Queue::open(d.temp.path().join("queue.db")).unwrap();
    wait(|| q.outbox(&actor()).unwrap().len() == 1);
    wait(|| {
        db.query_row(
            "SELECT count(*) FROM verification_requests WHERE unit=?",
            [id],
            |r| r.get::<_, u64>(0),
        )
        .unwrap()
            == 0
    });
    // Removing and recreating the row cannot reuse the completed token (ABA).
    let ack = send(
        &mut connect(&d),
        &json!({"version":1,"request_id":"post-completion","operation":{"op":"retry-verification","unit_id":id}}),
    );
    assert_eq!(ack["result"]["queued"], true);
    assert!(
        db.query_row("SELECT value FROM meta WHERE key='verification'", [], |r| r
            .get::<_, u64>(0))
            .unwrap()
            > generation
    );
    assert_eq!(q.daemon_status(id).unwrap().mutating_attempts, 1);
}

#[test]
fn legacy_verification_marker_migrates_and_survives_a_durable_error_disposition() {
    let mut d = start();
    let (hash, _) = ready(&d, 1);
    let result = submit(&d, &hash, "legacy");
    let id = result["result"]["unit_id"].as_str().unwrap();
    wait(|| unit_status(&d, id)["result"]["state"] == "Applied");
    d.child.kill().unwrap();
    d.child.wait().unwrap();
    let db = rusqlite::Connection::open(d.temp.path().join("queue.db")).unwrap();
    db.execute_batch("DROP TABLE verification_requests; CREATE TABLE verification_requests(unit TEXT PRIMARY KEY REFERENCES units(id)); DELETE FROM meta WHERE key='verification';").unwrap();
    db.execute("INSERT INTO verification_requests VALUES (?)", [id])
        .unwrap();
    let policy_path = d.temp.path().join("intake/policies/fixture.json");
    let policy = fs::read(&policy_path).unwrap();
    fs::remove_file(&policy_path).unwrap();
    d.restart();
    // The acknowledged legacy row upgrades additively, then records the exact
    // pre-execution failure instead of silently consuming the verification work.
    wait(|| {
        db.query_row(
            "SELECT last_error FROM verification_requests WHERE unit=?",
            [id],
            |r| r.get::<_, Option<String>>(0),
        )
        .unwrap()
        .as_deref()
            == Some("ABSENT")
    });
    let old_generation: u64 = db
        .query_row(
            "SELECT generation FROM verification_requests WHERE unit=?",
            [id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(old_generation, 1);
    assert_eq!(
        fs::read_dir(d.temp.path().join("requests"))
            .unwrap()
            .count(),
        1
    );
    durable(&policy_path, &policy);
    // Restart must preserve the error disposition; only an explicit fresh
    // acknowledged retry supersedes it with a new monotonic generation.
    d.restart();
    assert_eq!(
        db.query_row(
            "SELECT last_error FROM verification_requests WHERE unit=?",
            [id],
            |r| r.get::<_, String>(0)
        )
        .unwrap(),
        "ABSENT"
    );
    let ack = send(
        &mut connect(&d),
        &json!({"version":1,"request_id":"repair-policy","operation":{"op":"retry-verification","unit_id":id}}),
    );
    assert_eq!(ack["result"]["queued"], true);
    let generation: u64 = db
        .query_row(
            "SELECT generation FROM verification_requests WHERE unit=?",
            [id],
            |r| r.get(0),
        )
        .unwrap();
    assert!(generation > old_generation);
    // FixtureService deliberately does not rediscover a prior daemon's child.
    // After restart it must refuse the stale physical generation, retaining this
    // new generation's disposition instead of manufacturing a readback success.
    wait(|| {
        db.query_row(
            "SELECT last_error FROM verification_requests WHERE unit=?",
            [id],
            |r| r.get::<_, Option<String>>(0),
        )
        .unwrap()
        .as_deref()
            == Some("SERVICE_GENERATION_DRIFT")
    });
    let q = Queue::open(d.temp.path().join("queue.db")).unwrap();
    assert!(q.outbox(&actor()).unwrap().is_empty());
    assert_eq!(
        fs::read_dir(d.temp.path().join("requests"))
            .unwrap()
            .count(),
        1
    );
    assert_eq!(q.daemon_status(id).unwrap().mutating_attempts, 1);
}
