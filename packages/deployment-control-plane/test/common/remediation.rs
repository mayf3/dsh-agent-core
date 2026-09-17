use super::*;
use std::{
    os::unix::fs::PermissionsExt,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
fn recovery_request(d: &Daemon, id: &str) -> RecoveryEvidence {
    let mut found = None;
    wait(|| {
        for file in fs::read_dir(d.temp.path().join("recovery-requests")).unwrap() {
            let path = file.unwrap().path();
            if path.extension().is_none_or(|e| e != "json") {
                continue;
            }
            let e: RecoveryEvidence = serde_json::from_slice(&fs::read(path).unwrap()).unwrap();
            if e.unit_id == id {
                found = Some(e);
                return true;
            }
        }
        false
    });
    found.unwrap()
}
fn publish(d: &Daemon, e: &RecoveryEvidence, wrong: bool) {
    publish_as(d, e, wrong, e.status_revision)
}
fn publish_as(d: &Daemon, e: &RecoveryEvidence, wrong: bool, revision: u64) {
    let mut proof = signed("recovery", e.clone());
    if wrong {
        proof.signature = "0".repeat(128);
    }
    let path = d
        .temp
        .path()
        .join(format!("intake/recovery/{}-{}.json", e.unit_id, revision));
    let tmp = path.with_extension("tmp");
    fs::write(&tmp, serde_json::to_vec(&proof).unwrap()).unwrap();
    fs::rename(tmp, path).unwrap();
}
fn fresh(mut e: RecoveryEvidence) -> RecoveryEvidence {
    e.issued_at = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();
    e.remediation_digest = "9".repeat(64);
    e
}
#[test]
fn protected_recovery_mailbox_resumes_preflight_without_daemon_restart() {
    let d = start();
    let (hash, _) = ready(&d, 1);
    fs::set_permissions(
        d.temp.path().join("target/main.js"),
        fs::Permissions::from_mode(0o777),
    )
    .unwrap();
    let answer = submit(&d, &hash, "failed-preflight");
    let id = answer["result"]["unit_id"].as_str().unwrap();
    wait(|| unit_status(&d, id)["result"]["state"] == "Blocked");
    fs::set_permissions(
        d.temp.path().join("target/main.js"),
        fs::Permissions::from_mode(0o644),
    )
    .unwrap();
    let e = fresh(recovery_request(&d, id));
    for case in 0..5 {
        let mut bad = e.clone();
        match case {
            0 => bad.failure_cause_digest = "0".repeat(64),
            1 => bad.issued_at = 1,
            2 => bad.step_dispositions = vec![StepDisposition::Unknown("canary".into())],
            4 => bad.status_revision += 1,
            _ => (),
        }
        publish_as(&d, &bad, case == 3, e.status_revision);
        std::thread::sleep(Duration::from_millis(220));
        assert_eq!(unit_status(&d, id)["result"]["state"], "Blocked");
        assert_eq!(
            fs::read(d.temp.path().join("target/main.js")).unwrap(),
            b"old code"
        );
    }
    publish(&d, &e, false);
    wait(|| unit_status(&d, id)["result"]["state"] == "Applied");
    let state = unit_status(&d, id);
    assert_eq!(state["result"]["preflight_attempts"], 2);
    assert_eq!(state["result"]["mutating_attempts"], 1);
    publish(&d, &e, false);
    std::thread::sleep(Duration::from_millis(200));
    assert_eq!(unit_status(&d, id)["result"]["mutating_attempts"], 1);
}
#[test]
fn protected_recovery_mailbox_resumes_known_rollback() {
    let d = start_with(|c| c["verifiers"]["verify-1"]["deadline_ms"] = json!(2000));
    let (hash, _) = ready(&d, 1);
    let answer = submit(&d, &hash, "failed-verifier");
    let id = answer["result"]["unit_id"].as_str().unwrap();
    let mut request = None;
    wait(|| {
        for entry in fs::read_dir(d.temp.path().join("requests")).unwrap() {
            let path = entry.unwrap().path();
            if path.extension().is_some_and(|e| e == "json") {
                request = Some(serde_json::from_slice::<Value>(&fs::read(path).unwrap()).unwrap());
                return true;
            }
        }
        false
    });
    let request = request.unwrap();
    fs::write(
        d.temp.path().join(format!(
            "intake/results/{}.json",
            request["id"].as_str().unwrap()
        )),
        b"{}",
    )
    .unwrap();
    wait(|| unit_status(&d, id)["result"]["state"] == "RolledBack");
    assert_eq!(
        fs::read(d.temp.path().join("target/main.js")).unwrap(),
        b"old code"
    );
    let e = fresh(recovery_request(&d, id));
    publish(&d, &e, false);
    wait(|| unit_status(&d, id)["result"]["state"] == "Applied");
    assert_eq!(unit_status(&d, id)["result"]["mutating_attempts"], 2);
}

#[test]
fn recovery_mailbox_cannot_reset_exhausted_mutating_budget() {
    let d = start_with(|c| c["verifiers"]["verify-1"]["deadline_ms"] = json!(2000));
    let (hash, _) = ready(&d, 1);
    let answer = submit(&d, &hash, "exhausted");
    let id = answer["result"]["unit_id"].as_str().unwrap();
    let mut prior = None;
    for attempt in 1..=2 {
        let mut request = None;
        wait(|| {
            for entry in fs::read_dir(d.temp.path().join("requests")).unwrap() {
                let path = entry.unwrap().path();
                if path.extension().is_some_and(|e| e == "json") {
                    let candidate: Value =
                        serde_json::from_slice(&fs::read(path).unwrap()).unwrap();
                    if candidate["expected"]["attempt"] == attempt {
                        request = Some(candidate);
                        return true;
                    }
                }
            }
            false
        });
        fs::write(
            d.temp.path().join(format!(
                "intake/results/{}.json",
                request.unwrap()["id"].as_str().unwrap()
            )),
            b"{}",
        )
        .unwrap();
        wait(|| unit_status(&d, id)["result"]["state"] == "RolledBack");
        if attempt == 1 {
            let e = fresh(recovery_request(&d, id));
            publish(&d, &e, false);
            prior = Some(e);
        }
    }
    let status = unit_status(&d, id);
    let mut replay = prior.unwrap();
    replay.status_revision = status["result"]["revision"].as_u64().unwrap();
    publish(&d, &replay, false);
    std::thread::sleep(Duration::from_millis(400));
    assert_eq!(unit_status(&d, id)["result"]["mutating_attempts"], 2);
    assert_eq!(unit_status(&d, id)["result"]["state"], "RolledBack");
    assert_eq!(
        fs::read(d.temp.path().join("target/main.js")).unwrap(),
        b"old code"
    );
}
