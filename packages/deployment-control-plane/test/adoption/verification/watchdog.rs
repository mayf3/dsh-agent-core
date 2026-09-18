use super::*;
use serde_json::json;
fn fixture() -> (Value, Value) {
    let mut semantic = fixture::semantic_fixture();
    for field in ["admittedAt", "startedAt", "endedAt"] {
        let time = match field {
            "admittedAt" => 21,
            "startedAt" => 22,
            _ => 23,
        };
        semantic["afterStore"]["occurrences"][1][field] = json!(time);
        semantic["runReadback"]["occurrences"][0][field] = json!(time);
    }
    let identity = json!({"native_enrollment_digest":"1".repeat(64),"complete_face_digest":"2".repeat(64),"service_generation":"3".repeat(64),"target_runtime":"scheduler","host_identity":"host-fixture","installation_binding_digest":"4".repeat(64),"source_sha":"a".repeat(40),"routing_digest":"c".repeat(64),"migration_digest":crate::trust::digest(&Value::Null).unwrap()});
    let mut current = identity.clone();
    current["observed_at_ms"] = json!(100);
    current["request_digest"] = json!("6".repeat(64));
    current["health_max_age_ms"] = json!(50);
    current["heartbeat_max_age_ms"] = json!(50);
    let mut fresh = semantic["afterHealth"].clone();
    fresh["generatedAt"] = json!(99);
    let evidence = json!({"semantic":semantic,"capture":{"before":identity,"after":identity,"started_at_ms":9,"completed_at_ms":31,"authorized_from_ms":8,"authorized_until_ms":40,"semantic_digest":crate::trust::digest(&semantic).unwrap(),"canary_job_id":"job-canary","canary_occurrence_id":"occ-canary","outcome":"succeeded"},"fresh_health":fresh,"fresh_store":semantic["afterStore"],"fresh_incident_state":semantic["afterIncidentState"],"heartbeats":{"w1":{"observed_at_ms":99,"last_exit_code":0,"healthy":true},"w2":{"observed_at_ms":98,"last_exit_code":0,"healthy":true}}});
    (evidence, current)
}
fn reseal(e: &mut Value) {
    e["capture"]["semantic_digest"] = json!(crate::trust::digest(&e["semantic"]).unwrap());
}
fn pass(e: &Value, c: &Value) -> bool {
    matches!(evaluate(e, c, 100), Ok(WatchdogVerdict::Pass { .. }))
}
#[test]
fn valid_real_canary_correlated_to_current_generation_passes() {
    let (e, c) = fixture();
    assert!(pass(&e, &c));
}
#[test]
fn historical_pass_without_capture_waits() {
    let (mut e, c) = fixture();
    e.as_object_mut().unwrap().remove("capture");
    assert!(matches!(
        evaluate(&e, &c, 100),
        Ok(WatchdogVerdict::Waiting { .. })
    ));
}
#[test]
fn changed_identity_cannot_pass() {
    for field in [
        "native_enrollment_digest",
        "complete_face_digest",
        "service_generation",
        "host_identity",
        "target_runtime",
        "installation_binding_digest",
        "source_sha",
        "routing_digest",
        "migration_digest",
    ] {
        let (mut e, c) = fixture();
        e["capture"]["before"][field] = json!("wrong");
        assert!(!pass(&e, &c), "{field}");
    }
}
#[test]
fn capture_digest_occurrence_and_time_are_bound() {
    for (field, value) in [
        ("semantic_digest", json!("7".repeat(64))),
        ("canary_occurrence_id", json!("other")),
        ("canary_job_id", json!("other")),
        ("started_at_ms", json!(24)),
        ("completed_at_ms", json!(11)),
        ("authorized_until_ms", json!(10)),
    ] {
        let (mut e, c) = fixture();
        e["capture"][field] = value;
        assert!(!pass(&e, &c), "{field}");
    }
}
#[test]
fn unknown_operation_remains_unknown() {
    let (mut e, c) = fixture();
    e["capture"]["outcome"] = json!("outcome_unknown");
    assert!(matches!(
        evaluate(&e, &c, 100),
        Ok(WatchdogVerdict::Unknown { .. })
    ));
}
#[test]
fn freshness_and_periodic_exit_gate_pass() {
    for path in [
        "/fresh_health/generatedAt",
        "/heartbeats/w1/observed_at_ms",
        "/heartbeats/w2/observed_at_ms",
    ] {
        let (mut e, c) = fixture();
        *e.pointer_mut(path).unwrap() = json!(1);
        assert!(!pass(&e, &c), "{path}");
    }
    let (mut e, c) = fixture();
    e["heartbeats"]["w1"]["last_exit_code"] = json!(1);
    assert!(!pass(&e, &c));
}
#[test]
fn periodic_pid_changes_and_dynamic_store_evolution_are_not_generation_drift() {
    let (mut e, c) = fixture();
    e["heartbeats"]["w1"]["pid"] = json!(991);
    e["heartbeats"]["w2"]["run_count"] = json!(30);
    e["fresh_health"]["provenance"]["store"] = json!("9".repeat(64));
    assert!(pass(&e, &c));
}
#[test]
fn semantic_regression_vectors_fail_closed() {
    for (path, value) in [
        ("/sourceSha", json!("d".repeat(40))),
        ("/afterHealth/complete", json!(false)),
        ("/afterHealth/unknown", json!(1)),
        ("/afterHealth/enabled", json!(99)),
        ("/routingReceipt/candidateSha256", json!("e".repeat(64))),
        ("/afterStore/jobs/0/enabled", json!(false)),
        (
            "/afterHealth/findings/1/derivedUnderAdmissionBlock",
            json!(false),
        ),
        ("/beforeIncidentState/outbox", json!({})),
        ("/beforeIncidentState/incidents", json!({})),
        (
            "/runReadback/occurrences/0/result/counters/external_effects",
            json!(1),
        ),
        ("/runReadback/occurrences/0/occurrenceId", json!("other")),
        ("/afterStore/occurrences/2/jobId", json!("job-quarantined")),
        ("/afterHealth/jobs/1/classification", json!("blocked")),
    ] {
        let (mut e, c) = fixture();
        *e["semantic"].pointer_mut(path).unwrap() = value;
        reseal(&mut e);
        assert!(!pass(&e, &c), "{path}");
    }
}
#[test]
fn unrelated_success_required_and_state_only_evolution_allowed() {
    let (mut e, c) = fixture();
    e["semantic"]["afterStore"]["jobs"][1]["state"] = json!({"nextRunAtMs":200});
    reseal(&mut e);
    assert!(pass(&e, &c));
    e["semantic"]["afterStore"]["occurrences"]
        .as_array_mut()
        .unwrap()
        .pop();
    reseal(&mut e);
    assert!(!pass(&e, &c));
}
#[test]
fn attempted_notification_cannot_be_relabelled_pending() {
    let (mut e, c) = fixture();
    let intent = e["semantic"]["beforeIncidentState"]["outbox"]
        .as_object_mut()
        .unwrap()
        .values_mut()
        .next()
        .unwrap();
    intent["firstDeliveryAttemptAt"] = json!(20);
    reseal(&mut e);
    assert!(!pass(&e, &c));
}
#[test]
fn duplicate_or_ambiguous_readback_is_rejected() {
    let (mut e, c) = fixture();
    let row = e["semantic"]["runReadback"]["occurrences"][0].clone();
    e["semantic"]["runReadback"]["runs"] = json!([row]);
    reseal(&mut e);
    assert!(!pass(&e, &c));
}
#[test]
fn malformed_or_unknown_envelope_fields_fail_closed() {
    let (mut e, mut c) = fixture();
    c["extra"] = json!(true);
    assert!(!pass(&e, &c));
    let (_, c) = fixture();
    e["capture"]["extra"] = json!(true);
    assert!(!pass(&e, &c));
}
#[test]
fn overdue_fact_time_and_duplicate_stable_facts_do_not_mint_notifications() {
    let (mut e, c) = fixture();
    for prefix in ["before", "after"] {
        e["semantic"][format!("{prefix}Health")]["findings"][1]["overdueMs"] =
            json!(if prefix == "before" { 10 } else { 20 });
        let records = e["semantic"][format!("{prefix}IncidentState")]["incidents"]
            .as_object_mut()
            .unwrap();
        let record = records.values_mut().next().unwrap();
        let mut duplicate = record["facts"][1].clone();
        duplicate["overdueMs"] = json!(30);
        record["facts"].as_array_mut().unwrap().push(duplicate);
    }
    reseal(&mut e);
    assert!(pass(&e, &c));
}
#[test]
fn migration_cannot_excuse_missing_outbox_without_exact_authority() {
    let (mut e, c) = fixture();
    e["semantic"]["beforeIncidentState"]["migration"] = json!({"evidenceSha256":"a".repeat(64),"factsSha256":"b".repeat(64),"legacySha256":"c".repeat(64)});
    e["semantic"]["incidentMigrationAuthority"] = json!({"evidenceSha256":"d".repeat(64),"factsSha256":"e".repeat(64),"legacySha256":"f".repeat(64)});
    reseal(&mut e);
    assert!(!pass(&e, &c));
}
#[test]
fn outbox_identity_and_attempt_mutations_cannot_pass() {
    for (field, value) in [
        ("delivery", json!("FAILED")),
        ("payloadRevision", json!(2)),
        ("transitionRevision", json!(2)),
        ("notificationKey", json!("f".repeat(64))),
        ("producer", json!("forged")),
        ("deliveryBindingAt", json!(20)),
    ] {
        let (mut e, c) = fixture();
        e["semantic"]["afterIncidentState"]["outbox"]
            .as_object_mut()
            .unwrap()
            .values_mut()
            .next()
            .unwrap()[field] = value;
        reseal(&mut e);
        assert!(!pass(&e, &c), "{field}");
    }
}
#[test]
fn canary_admission_and_duplicate_store_ids_cannot_pass() {
    let (mut e, c) = fixture();
    e["semantic"]["runReadback"]["events"][0]["evidence"]["toolCalls"] = json!(1);
    reseal(&mut e);
    assert!(!pass(&e, &c));
    let (mut e, c) = fixture();
    let row = e["semantic"]["afterStore"]["occurrences"][1].clone();
    e["semantic"]["afterStore"]["occurrences"]
        .as_array_mut()
        .unwrap()
        .push(row);
    reseal(&mut e);
    assert!(!pass(&e, &c));
}
fn bind_pending(e: &mut Value) {
    for prefix in ["before", "after"] {
        let state = &mut e["semantic"][format!("{prefix}IncidentState")];
        let (key, intent) = state["outbox"]
            .as_object_mut()
            .unwrap()
            .iter_mut()
            .next()
            .unwrap();
        intent["deliveryBindingAt"] = json!(20);
        intent["deliveryBinding"] = json!({"producer":intent["producer"],"providerKey":"PQEYVgjcsUl5XRMZ6a-LQZq-_nui9knrPD2DnklqQ0k","route":{"channel":"feishu","to":"scheduler-ops"},"routeSource":"canonicalOpsTarget","routingSha256":"c".repeat(64),"payload":format!("Scheduler watchdog NEW [{}] RUN_STUCK_OUTCOME_UNKNOWN [notification-key:{key}]",intent["incident"]["rootIdentity"].as_str().unwrap())});
    }
    reseal(e);
}
#[test]
fn existing_bound_pending_delivery_proves_passive_dedupe() {
    let (mut e, c) = fixture();
    bind_pending(&mut e);
    assert!(pass(&e, &c));
}
#[test]
fn delivery_binding_route_payload_time_and_provider_are_exact() {
    for (field, value) in [
        ("providerKey", json!("wrong")),
        ("payload", json!("wrong")),
        ("producer", json!("wrong")),
        ("routeSource", json!("ownerTargets")),
        ("routingSha256", json!("e".repeat(64))),
        ("route", json!({"channel":"feishu","to":"elsewhere"})),
    ] {
        let (mut e, c) = fixture();
        bind_pending(&mut e);
        e["semantic"]["beforeIncidentState"]["outbox"]
            .as_object_mut()
            .unwrap()
            .values_mut()
            .next()
            .unwrap()["deliveryBinding"][field] = value;
        reseal(&mut e);
        assert!(!pass(&e, &c), "{field}");
    }
    let (mut e, c) = fixture();
    bind_pending(&mut e);
    e["semantic"]["beforeIncidentState"]["outbox"]
        .as_object_mut()
        .unwrap()
        .values_mut()
        .next()
        .unwrap()["deliveryBindingAt"] = json!(21);
    reseal(&mut e);
    assert!(!pass(&e, &c));
}
#[test]
fn proved_migration_delivered_without_outbox_is_supported() {
    let (mut e, mut c) = fixture();
    let migration = json!({"evidenceSha256":"a".repeat(64),"factsSha256":"b".repeat(64),"legacySha256":"c".repeat(64)});
    e["semantic"]["incidentMigrationAuthority"] = migration.clone();
    for prefix in ["before", "after"] {
        let state = &mut e["semantic"][format!("{prefix}IncidentState")];
        state["migration"] = migration.clone();
        state["outbox"] = json!({});
        state["incidents"]
            .as_object_mut()
            .unwrap()
            .values_mut()
            .next()
            .unwrap()["alertState"]["delivery"] = json!("DELIVERED");
    }
    c["migration_digest"] = json!(crate::trust::digest(&migration).unwrap());
    e["capture"]["before"]["migration_digest"] = c["migration_digest"].clone();
    e["capture"]["after"]["migration_digest"] = c["migration_digest"].clone();
    e["fresh_incident_state"] = e["semantic"]["afterIncidentState"].clone();
    reseal(&mut e);
    assert!(pass(&e, &c));
}
#[test]
fn contemporaneous_snapshot_must_bracket_real_canary() {
    for (field, at) in [("beforeHealth", 24), ("afterHealth", 22)] {
        let (mut e, c) = fixture();
        e["semantic"][field]["generatedAt"] = json!(at);
        reseal(&mut e);
        assert!(!pass(&e, &c));
    }
}
#[test]
fn missing_fresh_durable_documents_cannot_pass() {
    let (mut e, c) = fixture();
    e.as_object_mut().unwrap().remove("fresh_store");
    e.as_object_mut().unwrap().remove("fresh_incident_state");
    assert!(!pass(&e, &c));
}
#[test]
fn migration_identity_must_describe_actual_authority() {
    let (mut e, mut c) = fixture();
    c["migration_digest"] = json!("9".repeat(64));
    e["capture"]["before"]["migration_digest"] = c["migration_digest"].clone();
    e["capture"]["after"]["migration_digest"] = c["migration_digest"].clone();
    assert!(!pass(&e, &c));
}
#[test]
fn current_durable_state_is_revalidated_without_historical_byte_equality() {
    let (mut e, c) = fixture();
    e["fresh_store"]["jobs"][1]["state"] = json!({"nextRunAtMs":1000});
    assert!(pass(&e, &c));
    e["fresh_incident_state"]["outbox"] = json!({});
    assert!(matches!(
        evaluate(&e, &c, 100),
        Ok(WatchdogVerdict::Fail {
            reason: "WATCHDOG_INCIDENT_MISSING_OUTBOX"
        })
    ));
}
#[test]
fn preexisting_occurrence_and_fence_mutation_is_rejected() {
    for (path, value) in [
        ("/afterStore/occurrences/0/state", json!("succeeded")),
        ("/afterStore/fences", json!({})),
        ("/phaseReceipt/currentSixAuthorized", json!(true)),
        ("/phaseReceipt/productionAccepted", json!(true)),
    ] {
        let (mut e, c) = fixture();
        *e["semantic"].pointer_mut(path).unwrap() = value;
        reseal(&mut e);
        assert!(!pass(&e, &c), "{path}");
    }
}
#[test]
fn fractional_negative_or_future_freshness_fields_are_rejected() {
    for value in [json!(-1), json!(99.5), json!(101), json!("99")] {
        let (mut e, c) = fixture();
        e["heartbeats"]["w2"]["observed_at_ms"] = value;
        assert!(!pass(&e, &c));
    }
}
#[test]
fn native_profile_requires_real_scheduler_admission_evidence() {
    let (mut e, c) = fixture();
    e["semantic"]["runReadback"]["events"] = json!([]);
    reseal(&mut e);
    assert!(!pass(&e, &c));
}
