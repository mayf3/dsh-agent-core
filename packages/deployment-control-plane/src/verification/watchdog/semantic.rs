//! Fixed port of deployment-postdeploy-finalize.js semantic checks.
use super::{checks::*, incidents, routing};
use crate::{error::require, Result};
use serde_json::{json, Value};
use std::collections::{BTreeMap, BTreeSet};

pub(super) fn health(h: &Value, source: &str) -> Result<()> {
    require(
        h["complete"] == true && h["unknown"] == 0,
        "WATCHDOG_HEALTH_INCOMPLETE",
    )?;
    let enabled = uint(h, "enabled")?;
    require(
        enabled == uint(h, "healthy")? + uint(h, "degraded")? + uint(h, "blocked")?,
        "WATCHDOG_HEALTH_COUNTS",
    )?;
    uint(h, "generatedAt")?;
    require(
        h["provenance"]["canonicalPair"] == true && h["provenance"]["runtime"] == source,
        "WATCHDOG_HEALTH_PROVENANCE",
    )?;
    for key in ["store", "routing", "incidents"] {
        hex_field(&h["provenance"], key, 64)?;
    }
    unique(array(&h["jobs"])?, "jobId")?;
    array(&h["findings"])?;
    Ok(())
}
pub(super) fn verify(s: &Value) -> Result<&Value> {
    let source = text(s, "sourceSha")?;
    hex_field(s, "sourceSha", 40)?;
    let phase = &s["phaseReceipt"];
    require(
        phase["sourceSha"] == source
            && phase["acceptanceStatus"] == "PENDING_CANONICAL_HEALTH_AND_CANARY"
            && phase["productionAccepted"] == false
            && phase["currentSixAuthorized"] == false,
        "WATCHDOG_PHASE_NOT_PENDING_DEPLOYED_GENERATION",
    )?;
    for name in ["beforeHealth", "afterHealth"] {
        health(&s[name], source)?;
    }
    require(
        s["routingReceipt"]["status"] == "INSTALLED"
            && s["routingReceipt"]["candidateSha256"] == s["routingManifestSha256"],
        "WATCHDOG_ROUTING_RECEIPT",
    )?;
    for prefix in ["before", "after"] {
        let h = &s[format!("{prefix}Health")];
        require(
            h["provenance"]["routing"] == s["routingManifestSha256"]
                && h["provenance"]["store"] == s[format!("{prefix}StoreSha256")]
                && h["provenance"]["incidents"] == s[format!("{prefix}IncidentSha256")],
            "WATCHDOG_API_DOCUMENT_BINDING",
        )?;
    }
    let canary = store_delta(s)?;
    let compiled = isolation(&s["beforeHealth"], &s["afterHealth"])?;
    routing::manifest(&s["routingManifest"])?;
    let mut proofs = Vec::new();
    for prefix in ["before", "after"] {
        let state = &s[format!("{prefix}IncidentState")];
        incidents::validate(state, s.get("incidentMigrationAuthority"))?;
        routing::bindings(
            state,
            &s["routingManifest"],
            &s[format!("{prefix}Store")]["jobs"],
            text(s, "routingManifestSha256")?,
            uint(&s[format!("{prefix}Health")], "generatedAt")?,
        )?;
        proofs.push(incidents::dedupe(state, &compiled)?);
    }
    require(proofs[0] == proofs[1], "WATCHDOG_INCIDENT_ATTEMPT_CHANGED")?;
    Ok(canary)
}
fn successful(row: &Value) -> Result<()> {
    require(
        row["state"] == "succeeded" && row["executionOutcome"] == "succeeded",
        "WATCHDOG_OCCURRENCE_NOT_SUCCESSFUL",
    )?;
    uint(row, "endedAt")?;
    Ok(())
}
fn run(s: &Value, canary: &Value) -> Result<()> {
    let r = &s["runReadback"];
    require(
        !(r.get("runs").is_some() && r.get("occurrences").is_some()),
        "WATCHDOG_AMBIGUOUS_READBACK",
    )?;
    let rows = array(
        r.get("runs")
            .or_else(|| r.get("occurrences"))
            .unwrap_or(&Value::Null),
    )?;
    let mut found = Vec::new();
    for row in rows {
        if alias(row, &["job_id", "jobId"])? == &s["canaryJobId"] {
            found.push(row);
        }
    }
    require(found.len() == 1, "WATCHDOG_CANARY_CARDINALITY")?;
    let row = found[0];
    require(
        alias(row, &["outcome", "state", "executionOutcome"])? == "succeeded"
            && alias(row, &["occurrenceId", "occurrence_id"])? == &canary["occurrenceId"],
        "WATCHDOG_RUN_OCCURRENCE_MISMATCH",
    )?;
    // The adapter supplies normalized numeric timestamps; ambiguous aliases fail closed.
    let end = alias(row, &["endedAt", "ended_at"])?;
    require(
        end.as_u64().is_some() && end == &canary["endedAt"],
        "WATCHDOG_RUN_END_MISMATCH",
    )?;
    let result = &row["result"];
    require(
        result["final_status"] == "PASS"
            && result["counters"]["tool_calls"] == 0
            && result["counters"]["external_effects"] == 0
            && result["notes"] == format!("SCHEDULER_NATIVE_NOOP:{}", text(s, "sourceSha")?),
        "WATCHDOG_CANARY_EFFECTS",
    )?;
    // D02 native observation requires real Scheduler admission as well as the durable result.
    {
        let events = array(&r["events"])?;
        let mut matches = Vec::new();
        for event in events {
            if alias(event, &["occurrenceId", "occurrence_id"])? == &canary["occurrenceId"]
                && event["action"] == "router_admission"
                && event["phase"] == "accepted"
            {
                matches.push(event);
            }
        }
        require(matches.len() == 1, "WATCHDOG_CANARY_ADMISSION_CARDINALITY")?;
        let e = &matches[0]["evidence"];
        require(
            e["executionClass"] == "SCHEDULER_NATIVE_NOOP"
                && e["toolCalls"] == 0
                && e["externalEffects"] == 0
                && e["marker"] == "SCHEDULER_POSTDEPLOY_CANARY_OK"
                && e["sourceSha"] == s["sourceSha"],
            "WATCHDOG_CANARY_ADMISSION",
        )?;
    }
    Ok(())
}
fn store_delta(s: &Value) -> Result<&Value> {
    let b = &s["beforeStore"];
    let a = &s["afterStore"];
    require(
        b["version"] == 3 && a["version"] == 3,
        "WATCHDOG_STORE_VERSION",
    )?;
    let bj = array(&b["jobs"])?;
    let aj = array(&a["jobs"])?;
    unique(bj, "id")?;
    unique(aj, "id")?;
    require(
        !bj.iter().chain(aj).any(|j| j["id"] == s["canaryJobId"]),
        "WATCHDOG_CANARY_NOT_DISPOSABLE",
    )?;
    let stable_jobs = |rows: &[Value]| {
        rows.iter()
            .map(|v| stable(v, "state"))
            .collect::<Result<Vec<_>>>()
    };
    require(
        stable_jobs(bj)? == stable_jobs(aj)?,
        "WATCHDOG_JOB_DEFINITION_CHANGED",
    )?;
    obj(&b["fences"])?;
    obj(&a["fences"])?;
    require(b["fences"] == a["fences"], "WATCHDOG_FENCES_CHANGED")?;
    let bo = array(&b["occurrences"])?;
    let ao = array(&a["occurrences"])?;
    unique(bo, "occurrenceId")?;
    unique(ao, "occurrenceId")?;
    let ids: BTreeSet<_> = bo
        .iter()
        .map(|v| text(v, "occurrenceId"))
        .collect::<Result<_>>()?;
    let retained: Vec<_> = ao
        .iter()
        .filter(|v| ids.contains(v["occurrenceId"].as_str().unwrap_or("")))
        .collect();
    require(
        bo.iter().collect::<Vec<_>>() == retained,
        "WATCHDOG_PREEXISTING_OCCURRENCES_CHANGED",
    )?;
    let appended: Vec<_> = ao
        .iter()
        .filter(|v| !ids.contains(v["occurrenceId"].as_str().unwrap_or("")))
        .collect();
    let mut canaries = Vec::new();
    let mut unrelated = 0;
    for row in appended {
        let job = text(row, "jobId")?;
        let bh = array(&s["beforeHealth"]["jobs"])?
            .iter()
            .find(|v| v["jobId"] == job);
        let ah = array(&s["afterHealth"]["jobs"])?
            .iter()
            .find(|v| v["jobId"] == job);
        let fenced = b["fences"]
            .get(job)
            .map(array)
            .transpose()?
            .is_some_and(|v| !v.is_empty());
        require(
            !fenced
                && !bh.is_some_and(|v| v["state"] == "QUARANTINED_UNKNOWN")
                && !ah.is_some_and(|v| v["state"] == "QUARANTINED_UNKNOWN"),
            "WATCHDOG_FENCE_BYPASS",
        )?;
        successful(row)?;
        if row["jobId"] == s["canaryJobId"] {
            canaries.push(row);
        } else {
            require(
                bj.iter().any(|v| v["id"] == job)
                    && bh.is_some_and(|v| v["classification"] == "healthy")
                    && ah.is_some_and(|v| v["classification"] == "healthy"),
                "WATCHDOG_UNRELATED_JOB_NOT_HEALTHY",
            )?;
            unrelated += 1;
        }
    }
    require(
        canaries.len() == 1 && unrelated > 0,
        "WATCHDOG_CANARY_AND_ISOLATION_REQUIRED",
    )?;
    run(s, canaries[0])?;
    Ok(canaries[0])
}
fn severity(v: &Value) -> u8 {
    match v.as_str() {
        Some("healthy") => 0,
        Some("degraded") => 1,
        Some("blocked") => 2,
        Some("unknown") => 3,
        _ => 4,
    }
}
fn isolation(before: &Value, after: &Value) -> Result<Vec<Value>> {
    let mut compiled = BTreeMap::<String, Value>::new();
    let mut count = 0;
    for b in array(&before["jobs"])? {
        let a = array(&after["jobs"])?
            .iter()
            .find(|v| v["jobId"] == b["jobId"])
            .ok_or(crate::Error::new("WATCHDOG_JOB_DISAPPEARED"))?;
        require(
            severity(&a["classification"]) <= severity(&b["classification"]),
            "WATCHDOG_HEALTH_REGRESSED",
        )?;
        equal_fields(
            b,
            a,
            &[
                "credentialReadiness",
                "currentBlocker",
                "fenceReason",
                "notificationRoute",
            ],
            "WATCHDOG_ADMISSION_CHANGED",
        )?;
        if b["state"] != "QUARANTINED_UNKNOWN" {
            continue;
        }
        count += 1;
        equal_fields(
            b,
            a,
            &[
                "state",
                "currentOccurrence",
                "currentBlocker",
                "blockedSince",
                "fenceReason",
            ],
            "WATCHDOG_QUARANTINE_CHANGED",
        )?;
        let occurrence = text(&b["currentOccurrence"], "occurrenceId")?;
        let root = format!(
            "occurrence|RUN_STUCK_OUTCOME_UNKNOWN|{}|{}",
            text(b, "jobId")?,
            occurrence
        );
        let mut facts = Vec::new();
        let mut symptoms = Vec::new();
        for fact in array(&after["findings"])? {
            if fact["jobId"] != b["jobId"]
                || !["ADMISSION_BLOCKED_UNKNOWN", "EXPECTED_RUN_MISSED"]
                    .contains(&fact["class"].as_str().unwrap_or(""))
            {
                continue;
            }
            let occurrence_fact = fact.get("occurrenceId").or_else(|| fact.get("runId"));
            if occurrence_fact != Some(&b["currentOccurrence"]["occurrenceId"]) {
                continue;
            }
            require(
                fact["class"] != "EXPECTED_RUN_MISSED"
                    || fact["derivedUnderAdmissionBlock"] == true,
                "WATCHDOG_DUPLICATE_INCIDENT_ROOT",
            )?;
            facts.push(fact.clone());
            if !symptoms.contains(&fact["class"]) {
                symptoms.push(fact["class"].clone());
            }
        }
        require(!facts.is_empty(), "WATCHDOG_MISSING_QUARANTINE_FACT")?;
        require(compiled.insert(root.clone(),json!({"rootIdentity":root,"rootCauseClass":"RUN_STUCK_OUTCOME_UNKNOWN","routeClass":"SCHEDULER_CONTROL_PLANE_INCIDENT","facts":facts,"symptoms":symptoms})).is_none(),"WATCHDOG_DUPLICATE_INCIDENT_ROOT")?;
    }
    require(compiled.len() == count, "WATCHDOG_INCIDENT_CARDINALITY")?;
    Ok(compiled.into_values().collect())
}
