//! Pure fixed observer. The protected reader authenticates custody, raw-document
//! hashes, capture provenance and age policy before calling this function.
//! Neither a caller tuple nor file mtime can authenticate a capture here.
use crate::{error::require, Result};
use serde_json::{json, Value};
mod checks;
mod incidents;
mod routing;
mod semantic;
use checks::*;

#[derive(Debug, PartialEq, Eq)]
pub(crate) enum WatchdogVerdict {
    Pass { evidence_digest: String },
    Waiting { reason: &'static str },
    Fail { reason: &'static str },
    Unknown { reason: &'static str },
}
const IDENTITY: &[&str] = &[
    "native_enrollment_digest",
    "complete_face_digest",
    "service_generation",
    "target_runtime",
    "host_identity",
    "installation_binding_digest",
    "source_sha",
    "routing_digest",
    "migration_digest",
];

pub(crate) fn evaluate(evidence: &Value, current: &Value, now_ms: u64) -> Result<WatchdogVerdict> {
    if evidence.get("capture").is_none() || evidence["capture"].is_null() {
        return Ok(WatchdogVerdict::Waiting {
            reason: "WATCHDOG_CONTEMPORANEOUS_CAPTURE_REQUIRED",
        });
    }
    if evidence["capture"]["outcome"] == "outcome_unknown" {
        return Ok(WatchdogVerdict::Unknown {
            reason: "WATCHDOG_CANARY_OUTCOME_UNKNOWN",
        });
    }
    if let Err(error) = verify(evidence, current, now_ms) {
        return Ok(WatchdogVerdict::Fail {
            reason: error.code(),
        });
    }
    Ok(WatchdogVerdict::Pass {
        evidence_digest: crate::trust::digest(
            &json!({"profile":"watchdog-current-observation-v1","evidence":evidence,"current":current,"now_ms":now_ms}),
        )?,
    })
}
fn verify(e: &Value, c: &Value, now: u64) -> Result<()> {
    keys(
        e,
        &[
            "capture",
            "semantic",
            "fresh_health",
            "fresh_store",
            "fresh_incident_state",
            "heartbeats",
        ],
        &[],
    )?;
    let mut fields = IDENTITY.to_vec();
    fields.extend([
        "observed_at_ms",
        "request_digest",
        "health_max_age_ms",
        "heartbeat_max_age_ms",
    ]);
    keys(c, &fields, &[])?;
    identity(c)?;
    hex_field(c, "request_digest", 64)?;
    require(
        uint(c, "observed_at_ms")? == now,
        "WATCHDOG_CURRENT_OBSERVATION_NOT_CURRENT",
    )?;
    let capture = &e["capture"];
    keys(
        capture,
        &[
            "before",
            "after",
            "started_at_ms",
            "completed_at_ms",
            "authorized_from_ms",
            "authorized_until_ms",
            "semantic_digest",
            "canary_job_id",
            "canary_occurrence_id",
            "outcome",
        ],
        &[],
    )?;
    require(
        capture["outcome"] == "succeeded",
        "WATCHDOG_CANARY_NOT_SUCCEEDED",
    )?;
    for endpoint in ["before", "after"] {
        keys(&capture[endpoint], IDENTITY, &[])?;
        identity(&capture[endpoint])?;
        for field in IDENTITY {
            require(
                capture[endpoint][*field] == c[*field],
                "WATCHDOG_CAPTURE_GENERATION_MISMATCH",
            )?;
        }
    }
    let start = uint(capture, "started_at_ms")?;
    let end = uint(capture, "completed_at_ms")?;
    require(
        uint(capture, "authorized_from_ms")? <= start
            && start <= end
            && end <= uint(capture, "authorized_until_ms")?
            && end <= now,
        "WATCHDOG_CAPTURE_INTERVAL_INVALID",
    )?;
    hex_field(capture, "semantic_digest", 64)?;
    require(
        capture["semantic_digest"] == crate::trust::digest(&e["semantic"])?,
        "WATCHDOG_CAPTURE_EVIDENCE_MISMATCH",
    )?;
    let s = &e["semantic"];
    require(
        s["sourceSha"] == c["source_sha"] && s["routingManifestSha256"] == c["routing_digest"],
        "WATCHDOG_CURRENT_PROVENANCE_MISMATCH",
    )?;
    require(
        c["migration_digest"]
            == crate::trust::digest(s.get("incidentMigrationAuthority").unwrap_or(&Value::Null))?,
        "WATCHDOG_MIGRATION_IDENTITY_MISMATCH",
    )?;
    let occurrence = semantic::verify(s)?;
    require(
        capture["canary_job_id"] == s["canaryJobId"]
            && capture["canary_occurrence_id"] == occurrence["occurrenceId"],
        "WATCHDOG_CAPTURE_OCCURRENCE_MISMATCH",
    )?;
    require(
        start <= uint(occurrence, "admittedAt")?
            && uint(occurrence, "admittedAt")? <= uint(occurrence, "startedAt")?
            && uint(occurrence, "startedAt")? <= uint(occurrence, "endedAt")?
            && uint(occurrence, "endedAt")? <= end,
        "WATCHDOG_CAPTURE_OCCURRENCE_TIME_MISMATCH",
    )?;
    require(
        start <= uint(&s["beforeHealth"], "generatedAt")?
            && uint(&s["beforeHealth"], "generatedAt")? <= uint(occurrence, "admittedAt")?
            && uint(occurrence, "endedAt")? <= uint(&s["afterHealth"], "generatedAt")?
            && uint(&s["afterHealth"], "generatedAt")? <= end,
        "WATCHDOG_HEALTH_CAPTURE_TIME_MISMATCH",
    )?;
    semantic::health(&e["fresh_health"], text(c, "source_sha")?)?;
    require(
        e["fresh_health"]["provenance"]["routing"] == c["routing_digest"],
        "WATCHDOG_FRESH_ROUTING_MISMATCH",
    )?;
    fresh(
        uint(&e["fresh_health"], "generatedAt")?,
        now,
        uint(c, "health_max_age_ms")?,
    )?;
    require(e["fresh_store"]["version"] == 3, "WATCHDOG_STORE_VERSION")?;
    unique(array(&e["fresh_store"]["jobs"])?, "id")?;
    unique(array(&e["fresh_store"]["occurrences"])?, "occurrenceId")?;
    obj(&e["fresh_store"]["fences"])?;
    incidents::validate(
        &e["fresh_incident_state"],
        s.get("incidentMigrationAuthority"),
    )?;
    routing::bindings(
        &e["fresh_incident_state"],
        &s["routingManifest"],
        &e["fresh_store"]["jobs"],
        text(c, "routing_digest")?,
        uint(&e["fresh_health"], "generatedAt")?,
    )?;
    keys(&e["heartbeats"], &["w1", "w2"], &[])?;
    for name in ["w1", "w2"] {
        let heartbeat = &e["heartbeats"][name];
        keys(
            heartbeat,
            &["observed_at_ms", "last_exit_code", "healthy"],
            &["pid", "run_count"],
        )?;
        for optional in ["pid", "run_count"] {
            if heartbeat.get(optional).is_some() {
                uint(heartbeat, optional)?;
            }
        }
        require(
            heartbeat["last_exit_code"] == 0 && heartbeat["healthy"] == true,
            "WATCHDOG_PERIODIC_UNHEALTHY",
        )?;
        fresh(
            uint(heartbeat, "observed_at_ms")?,
            now,
            uint(c, "heartbeat_max_age_ms")?,
        )?;
    }
    Ok(())
}
fn identity(v: &Value) -> Result<()> {
    for key in IDENTITY {
        text(v, key)?;
    }
    for key in [
        "native_enrollment_digest",
        "complete_face_digest",
        "service_generation",
        "installation_binding_digest",
        "routing_digest",
        "migration_digest",
    ] {
        hex_field(v, key, 64)?;
    }
    hex_field(v, "source_sha", 40)
}
fn fresh(at: u64, now: u64, age: u64) -> Result<()> {
    require(
        age > 0 && at <= now && now - at <= age,
        "WATCHDOG_STALE_OBSERVATION",
    )
}
#[cfg(test)]
pub(crate) mod fixture;
#[cfg(test)]
#[path = "../../test/adoption/verification/watchdog.rs"]
mod tests;

/// Reuse the fixed accepted health predicates for the finite lifecycle availability join.
pub(crate) fn canonical_health(value: &serde_json::Value, source: &str) -> crate::Result<()> {
    semantic::health(value, source)
}
