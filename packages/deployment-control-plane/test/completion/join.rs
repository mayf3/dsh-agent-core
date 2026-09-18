use super::*;
use crate::{
    common::*,
    registry::test_fixture as fixture,
    transaction::{test_fixture, Executor},
    trust::digest,
};
struct Case {
    _t: tempfile::TempDir,
    c: Catalog,
    row: DeploymentRecord,
    p: Projection,
    physical: serde_json::Value,
}
fn case() -> Case {
    case_with_delivery(true)
}
fn case_with_delivery(deliver: bool) -> Case {
    let (t, r, q, c, id) = test_fixture::prepared();
    let registry = fixture::open(t.path(), &c);
    registry.enroll(&fixture::enrollment("goal")).unwrap();
    registry
        .activate(&actor(), &q.daemon_evidence(&id).unwrap(), 0, 1001)
        .unwrap();
    let guard = r.lock().unwrap();
    let mut ex = Executor::fixture(&r).unwrap();
    let applied = ex
        .apply(
            &guard,
            &q,
            &c,
            &id,
            &signed("authority", policy()),
            1001,
            "caller",
        )
        .unwrap();
    let receipt = signed(
        "verifier",
        GoalReceipt {
            unit_id: id.clone(),
            goal_id: "goal".into(),
            acceptance_revision: "accept-1".into(),
            target_generation: 1,
            attempt: 1,
            service_generation: applied.receipt.new_service_generation.clone(),
            attachment_digest: applied.receipt.attachment_digests[0].clone(),
            outcome: GoalOutcome::Pass,
            evidence_digest: "d".repeat(64),
            revision: 1,
        },
    );
    q.record_goal(&c, &receipt).unwrap();
    ex.finalize(&guard, &q, &id).unwrap();
    let out = q.outbox(&actor()).unwrap().remove(0);
    let ack = registry
        .close_from_queue(&q, &actor(), &out, &receipt)
        .unwrap();
    if deliver {
        q.acknowledge_closure(&c, &ack).unwrap();
    }
    let p = q.completion_projection("goal", "runtime").unwrap();
    let current = p.current.as_ref().unwrap();
    let physical = serde_json::json!({"service_generation":current.service_generation,"installation_binding_digest":current.binding_digest,"source_sha":p.status.as_ref().unwrap().unit.source_sha,"target_runtime":"runtime"});
    Case {
        _t: t,
        c,
        row: registry.get("goal").unwrap(),
        p,
        physical,
    }
}
fn check(c: &Case) -> Result<Option<&'static str>> {
    let u = &c.p.status.as_ref().unwrap().unit;
    validate(
        &c.c,
        &Expected {
            goal: "goal",
            source: &u.source_sha,
            artifact: &u.artifact_sha256,
            target: "runtime",
            profile: "fixture",
        },
        &c.row,
        &c.p,
        &c.physical,
    )
}
#[test]
fn real_completed_pass_closed_and_delivered_join() {
    assert_eq!(check(&case()).unwrap(), None);
}
#[test]
fn latest_waiting_or_unknown_never_uses_historical_pass() {
    for outcome in [
        GoalOutcome::WaitingExternalAcceptance,
        GoalOutcome::OutcomeUnknown,
    ] {
        let mut c = case();
        let mut receipt = c.p.goal.as_ref().unwrap().payload.clone();
        receipt.outcome = outcome;
        receipt.revision += 1;
        c.p.goal = Some(signed("verifier", receipt));
        if outcome == GoalOutcome::OutcomeUnknown {
            assert!(check(&c).is_err());
        } else {
            assert_ne!(check(&c).unwrap(), None);
        }
    }
}
#[test]
fn closed_but_ack_pending_is_pending() {
    let mut c = case();
    c.p.outbox.as_mut().unwrap().1 = false;
    assert_ne!(check(&c).unwrap(), None);
}
#[test]
fn wrong_physical_generation_and_forged_closure_refuse() {
    let mut c = case();
    c.physical["service_generation"] = serde_json::json!("other");
    assert!(check(&c).is_err());
    let mut c = case();
    c.row.closure.as_mut().unwrap().signature = "00".repeat(64);
    assert!(check(&c).is_err());
}
#[test]
fn wrong_cas_attachment_and_pending_executor_refuse_completion() {
    let mut c = case();
    let mut ack = c.row.closure.as_ref().unwrap().payload.clone();
    ack.closed_revision += 1;
    c.row.closure = Some(signed("producer", ack));
    assert!(check(&c).is_err());
    let mut c = case();
    c.p.attachment = Some("f".repeat(64));
    assert!(check(&c).is_err());
    let mut c = case();
    c.p.pending = 1;
    assert_ne!(check(&c).unwrap(), None);
}
#[test]
fn wrong_fixed_source_or_artifact_refuse() {
    let c = case();
    let u = &c.p.status.as_ref().unwrap().unit;
    assert!(validate(
        &c.c,
        &Expected {
            goal: "goal",
            source: &"0".repeat(40),
            artifact: &u.artifact_sha256,
            target: "runtime",
            profile: "fixture"
        },
        &c.row,
        &c.p,
        &c.physical
    )
    .is_err());
    assert!(validate(
        &c.c,
        &Expected {
            goal: "goal",
            source: &u.source_sha,
            artifact: &"0".repeat(64),
            target: "runtime",
            profile: "fixture"
        },
        &c.row,
        &c.p,
        &c.physical
    )
    .is_err());
    assert_eq!(
        digest(c.p.goal.as_ref().unwrap()).unwrap(),
        c.row.closure.as_ref().unwrap().payload.receipt_digest
    );
}
#[test]
fn dangling_latest_goal_record_cannot_fall_back_to_old_pass() {
    let c = case();
    let db = c._t.path().join("queue.db");
    let conn = rusqlite::Connection::open(&db).unwrap();
    conn.execute_batch("PRAGMA foreign_keys=OFF;").unwrap();
    let old = c.p.goal.as_ref().unwrap();
    let mut newer = old.payload.clone();
    newer.revision += 1;
    newer.outcome = GoalOutcome::WaitingExternalAcceptance;
    let raw = serde_json::to_string(&signed("verifier", newer)).unwrap();
    conn.execute(
        "INSERT INTO goal_receipts VALUES (?,?,?,?,?)",
        (&old.payload.unit_id, "goal", 2, "e".repeat(64), raw),
    )
    .unwrap();
    let q = crate::queue::Queue::open(&db).unwrap();
    assert!(q.completion_projection("goal", "runtime").is_err());
}

#[test]
fn real_ack_race_changes_projection_without_export_mutation() {
    let c = case_with_delivery(false);
    let db = c._t.path().join("queue.db");
    let roots = crate::fs::FixtureRoots::open(c._t.path()).unwrap();
    std::fs::set_permissions(&db, std::os::unix::fs::PermissionsExt::from_mode(0o600)).unwrap();
    let reader = crate::queue::Queue::open_existing_readonly(&roots.root, &db).unwrap();
    let before = reader.completion_projection("goal", "runtime").unwrap();
    assert!(!before.outbox.as_ref().unwrap().1);
    let writer = crate::queue::Queue::open(&db).unwrap();
    writer
        .acknowledge_closure(&c.c, c.row.closure.as_ref().unwrap())
        .unwrap();
    assert_eq!(
        reader
            .completion_unchanged("goal", "runtime", &before)
            .unwrap_err()
            .code(),
        "COMPLETION_SNAPSHOT_CHANGED"
    );
    assert!(
        reader
            .completion_projection("goal", "runtime")
            .unwrap()
            .outbox
            .unwrap()
            .1
    );
}
