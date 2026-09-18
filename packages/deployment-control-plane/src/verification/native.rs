//! Fixed Watchdog capture/observer. Root custody does not replace semantics.
use super::{
    documents::{strict_capture, strict_json, verified_semantic},
    native_io as io,
    watchdog::{self, WatchdogVerdict},
};
use crate::{
    error::require,
    fs::{
        file::{sha, snapshot, write_new},
        secure::Dir,
        MutationGuard,
    },
    model::*,
    queue::Queue,
    transaction::Executor,
    trust::{canonical_bytes, digest, verify_signed, Signable},
    Error, Result,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{collections::BTreeMap, os::unix::fs::MetadataExt};
pub(crate) const PROFILE: &str = "watchdog-current-observation-v1";
#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct ObservationPolicy {
    pub version: u32,
    pub profile_id: String,
    pub enrollment_digest: String,
    pub runtime_uid: u32,
    pub runtime_gid: u32,
    pub incident_gid: u32,
    pub health_max_age_ms: u64,
    pub heartbeat_max_age_ms: u64,
}
impl Signable for ObservationPolicy {
    const DOMAIN: &'static str = "WatchdogObservationPolicy";
    const ROLE: Role = Role::Authority;
}
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Before {
    grant_digest: String,
    policy_digest: String,
    identity: Value,
    started_at_ms: u64,
    plan: Value,
    documents: BTreeMap<String, Vec<u8>>,
}
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Captured {
    grant_digest: String,
    policy_digest: String,
    capture: Value,
    semantic: Value,
    documents: BTreeMap<String, Vec<u8>>,
    raw_run_readback: Vec<u8>,
    raw_run_events: Vec<u8>,
}
pub(crate) struct VerifiedCanary {
    grant_digest: String,
    pub(crate) evidence_digest: String,
    pub(crate) current: CurrentInstallation,
}
impl VerifiedCanary {
    pub(crate) fn grant_digest(&self) -> &str {
        &self.grant_digest
    }
}
fn read<T: serde::de::DeserializeOwned>(root: &Dir, name: &str) -> Result<T> {
    let raw = snapshot(
        &root.open_file(name, libc::O_RDONLY, 0)?,
        root.uid,
        64 * 1024 * 1024,
    )?
    .bytes;
    Ok(serde_json::from_value(strict_capture(&raw)?)?)
}
fn save<T: Serialize>(root: &Dir, name: &str, v: &T) -> Result<()> {
    let bytes = canonical_bytes(v)?;
    require(bytes.len() <= 64 * 1024 * 1024, "WATCHDOG_CAPTURE_SIZE")?;
    match root.open_file(name, libc::O_RDONLY, 0) {
        Ok(file) => require(
            snapshot(&file, root.uid, 64 * 1024 * 1024)?.bytes == bytes,
            "WATCHDOG_CAPTURE_IMMUTABLE",
        ),
        Err(e) if e.code() == "ABSENT" => {
            write_new(
                root,
                name,
                &bytes,
                root.uid,
                root.file.metadata()?.gid(),
                0o400,
            )?;
            Ok(())
        }
        Err(e) => Err(e),
    }
}
fn policy(
    root: &Dir,
    c: &Catalog,
    g: &Signed<AdoptionGrant>,
    executor: &Executor,
) -> Result<ObservationPolicy> {
    let p: Signed<ObservationPolicy> = read(root, "watchdog-observer-policy.json")?;
    verify_signed(&p, c, &g.payload.profile_id)?;
    require(
        digest(&p)? == g.payload.observation_policy_digest
            && p.payload.version == 1
            && p.payload.profile_id == g.payload.profile_id
            && p.payload.enrollment_digest == g.payload.enrollment_digest,
        "WATCHDOG_POLICY_BINDING",
    )?;
    require(
        executor.native_runtime_identity()? == (p.payload.runtime_uid, p.payload.runtime_gid)
            && p.payload.incident_gid != p.payload.runtime_gid,
        "WATCHDOG_POLICY_IDENTITY",
    )?;
    require(
        [p.payload.health_max_age_ms, p.payload.heartbeat_max_age_ms]
            .into_iter()
            .all(|n| n > 0 && n <= 86400000),
        "WATCHDOG_AGE_POLICY",
    )?;
    Ok(p.payload)
}
fn directory(root: &Dir, g: &Signed<AdoptionGrant>) -> Result<Dir> {
    root.child("adoptions")?
        .child(&digest(g)?)?
        .mkdir("watchdog")
}
fn now_ms() -> Result<u64> {
    u64::try_from(
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(|_| Error::new("CLOCK"))?
            .as_millis(),
    )
    .map_err(|_| Error::new("CLOCK"))
}
fn unknown(area: &Dir) -> Result<bool> {
    match area.open_file("unknown.json", libc::O_RDONLY, 0) {
        Ok(file) => {
            snapshot(&file, area.uid, 4 * 1024 * 1024)?;
            Ok(true)
        }
        Err(e) if e.code() == "ABSENT" => Ok(false),
        Err(e) => Err(e),
    }
}
fn authorized(g: &Signed<AdoptionGrant>, now: u64) -> Result<()> {
    require(
        g.payload.issued_at.saturating_mul(1000) <= now
            && now < g.payload.expires_at.saturating_mul(1000),
        "ADOPTION_EXPIRED",
    )
}
fn add_identity(mut identity: Value, routing: &[u8], migration: &Value) -> Result<Value> {
    identity["routing_digest"] = json!(sha(routing));
    identity["migration_digest"] = json!(digest(migration)?);
    Ok(identity)
}
fn migration() -> Result<Vec<u8>> {
    let raw = io::control("incident-migration-receipt.json")?;
    let receipt = strict_json(&raw)?;
    canonical_bytes(
        &json!({"legacySha256":receipt["legacySha256"],"evidenceSha256":receipt["evidenceSha256"],"factsSha256":receipt["factsSha256"]}),
    )
}
fn phase_documents(p: &ObservationPolicy) -> Result<BTreeMap<String, Vec<u8>>> {
    let mut docs = BTreeMap::new();
    docs.insert(
        "phaseReceipt".into(),
        io::control("deployment-phase-receipt.json")?,
    );
    let control = Dir::open(std::path::Path::new(io::CONTROL), 0)?;
    docs.insert(
        "routingReceipt".into(),
        io::document(
            &control.child("rollback")?,
            "routing-install-receipt.json",
            0,
            0o600,
        )?,
    );
    docs.insert("routingManifest".into(), io::routing(p.runtime_gid)?);
    docs.insert("incidentMigrationAuthority".into(), migration()?);
    Ok(docs)
}
#[expect(
    clippy::too_many_arguments,
    reason = "One fixed operation binds the existing physical guard and authenticated grant"
)]
pub(crate) fn begin(
    root: &Dir,
    c: &Catalog,
    q: &Queue,
    executor: &mut Executor,
    guard: &MutationGuard,
    id: &str,
    g: &Signed<AdoptionGrant>,
    now: u64,
) -> Result<()> {
    authorized(g, now)?;
    let p = policy(root, c, g, executor)?;
    let area = directory(root, g)?;
    // Never replace a previous capture attempt or reinterpret a missing result.
    if area.open_file("before.json", libc::O_RDONLY, 0).is_ok() {
        return Err(Error::new("WATCHDOG_CAPTURE_ALREADY_STARTED"));
    }
    let (identity, _) = executor.native_observation(guard, q, id)?;
    let mut documents = phase_documents(&p)?;
    let plan = super::canary_plan::planned(
        &area,
        &g.payload.canary_plan_digest,
        &g.payload.release.source_sha,
    )?;
    let (health, store, incident) = io::fresh(p.runtime_uid, p.runtime_gid, p.incident_gid)?;
    require(
        strict_json(&store)?["jobs"].as_array().is_some_and(|jobs| {
            jobs.iter()
                .all(|job| job["logicalKey"] != plan["logicalKey"])
        }),
        "WATCHDOG_CANARY_ALREADY_PRESENT",
    )?;
    documents.insert("beforeHealth".into(), health);
    documents.insert("beforeStore".into(), store);
    documents.insert("beforeIncidentState".into(), incident);
    let identity = add_identity(
        identity,
        &documents["routingManifest"],
        &strict_json(&documents["incidentMigrationAuthority"])?,
    )?;
    let (after, _) = executor.native_observation(guard, q, id)?;
    for key in [
        "native_enrollment_digest",
        "complete_face_digest",
        "service_generation",
        "target_runtime",
        "host_identity",
        "installation_binding_digest",
        "source_sha",
    ] {
        require(
            identity[key] == after[key],
            "WATCHDOG_CAPTURE_GENERATION_MISMATCH",
        )?;
    }
    save(
        &area,
        "before.json",
        &Before {
            grant_digest: digest(g)?,
            policy_digest: digest(&p)?,
            identity,
            started_at_ms: now,
            plan,
            documents,
        },
    )
}
#[expect(
    clippy::too_many_arguments,
    reason = "Exact capture joins the held guard, queue and signed operation"
)]
pub(crate) fn finish(
    root: &Dir,
    c: &Catalog,
    q: &Queue,
    executor: &mut Executor,
    guard: &MutationGuard,
    id: &str,
    g: &Signed<AdoptionGrant>,
    now: u64,
) -> Result<()> {
    authorized(g, now)?;
    let p = policy(root, c, g, executor)?;
    let area = directory(root, g)?;
    if unknown(&area)? {
        q.latch_executor_failure(&digest(&(digest(g)?, "canary-unknown-retained"))?)?;
        return Err(Error::new("UNKNOWN_CANARY"));
    }
    let before: Before = read(&area, "before.json")?;
    require(
        before.grant_digest == digest(g)? && before.policy_digest == digest(&p)?,
        "WATCHDOG_CAPTURE_BINDING",
    )?;
    let plan = super::canary_plan::planned(
        &area,
        &g.payload.canary_plan_digest,
        &g.payload.release.source_sha,
    )?;
    require(before.plan == plan, "WATCHDOG_CANARY_PLAN")?;
    let job = super::canary_plan::created(&area, &g.payload.canary_plan_digest, &plan)?;
    let mut docs = before.documents;
    let current_docs = phase_documents(&p)?;
    for (key, raw) in &current_docs {
        require(docs.get(key) == Some(raw), "WATCHDOG_STATIC_EVIDENCE_DRIFT")?;
    }
    let (health, store, incident) = io::fresh(p.runtime_uid, p.runtime_gid, p.incident_gid)?;
    docs.insert("afterHealth".into(), health);
    docs.insert("afterStore".into(), store);
    docs.insert("afterIncidentState".into(), incident);
    let raw_run_readback = io::get(Some(&job))?;
    let (run, raw_run_events) = run::observe(
        &area,
        q,
        &digest(g)?,
        &job,
        &raw_run_readback,
        now_ms()?,
        || io::runtime_document("runs.jsonl", p.runtime_uid, p.runtime_gid),
    )?;
    super::canary_plan::run_within_plan(&plan, &run)?;
    docs.insert("runReadback".into(), canonical_bytes(&run)?);
    let semantic = semantic(&docs, &g.payload.release.source_sha, &job)?;
    let (identity, _) = executor.native_observation(guard, q, id)?;
    let identity = add_identity(
        identity,
        &docs["routingManifest"],
        &strict_json(&docs["incidentMigrationAuthority"])?,
    )?;
    let occurrence = run["runs"]
        .as_array()
        .and_then(|a| a.first())
        .and_then(|r| r.get("occurrence_id").or(r.get("occurrenceId")))
        .and_then(Value::as_str)
        .ok_or(Error::new("WATCHDOG_RUN_IDENTITY"))?;
    let now = now_ms()?;
    authorized(g, now)?;
    let captured = Captured {
        grant_digest: digest(g)?,
        policy_digest: digest(&p)?,
        capture: json!({"before":before.identity,"after":identity,"started_at_ms":before.started_at_ms,"completed_at_ms":now,"authorized_from_ms":g.payload.issued_at*1000,"authorized_until_ms":g.payload.expires_at*1000,"semantic_digest":digest(&semantic)?,"canary_job_id":job,"canary_occurrence_id":occurrence,"outcome":"succeeded"}),
        semantic,
        documents: docs,
        raw_run_readback,
        raw_run_events,
    };
    // The pure semantic proof still decides success. This record claims only the
    // exact observed candidate interval; no Goal receipt is published here.
    save(&area, "captured.json", &captured)
}
fn semantic(docs: &BTreeMap<String, Vec<u8>>, source: &str, job: &str) -> Result<Value> {
    let mut value = serde_json::Map::new();
    let mut hashes = serde_json::Map::new();
    for (name, raw) in docs {
        value.insert(name.clone(), strict_json(raw)?);
        hashes.insert(name.clone(), json!(sha(raw)));
    }
    value.insert("documentSha256".into(), Value::Object(hashes));
    value.insert("sourceSha".into(), json!(source));
    value.insert("canaryJobId".into(), json!(job));
    for (key, doc) in [
        ("beforeStoreSha256", "beforeStore"),
        ("afterStoreSha256", "afterStore"),
        ("beforeIncidentSha256", "beforeIncidentState"),
        ("afterIncidentSha256", "afterIncidentState"),
        ("routingManifestSha256", "routingManifest"),
    ] {
        value.insert(key.into(), json!(sha(&docs[doc])));
    }
    verified_semantic(docs, &Value::Object(value))
}
#[expect(
    clippy::too_many_arguments,
    reason = "Observer consumes the same caller-owned physical guard and exact receipt coordinates"
)]
pub(crate) fn observe(
    root: &Dir,
    c: &Catalog,
    q: &Queue,
    executor: &mut Executor,
    guard: &MutationGuard,
    id: &str,
    g: &Signed<AdoptionGrant>,
    request: &str,
    now: u64,
) -> Result<(WatchdogVerdict, Option<VerifiedCanary>)> {
    let p = policy(root, c, g, executor)?;
    let area = directory(root, g)?;
    if unknown(&area)? {
        return Ok((
            WatchdogVerdict::Unknown {
                reason: "WATCHDOG_CANARY_OUTCOME_UNKNOWN",
            },
            None,
        ));
    }
    let captured: Captured = match read(&area, "captured.json") {
        Ok(c) => c,
        Err(e) if e.code() == "ABSENT" => {
            return Ok((
                WatchdogVerdict::Waiting {
                    reason: "WATCHDOG_CONTEMPORANEOUS_CAPTURE_REQUIRED",
                },
                None,
            ))
        }
        Err(e) => return Err(e),
    };
    require(
        captured.grant_digest == digest(g)? && captured.policy_digest == digest(&p)?,
        "WATCHDOG_CAPTURE_BINDING",
    )?;
    let s = verified_semantic(&captured.documents, &captured.semantic)?;
    let job = s["canaryJobId"]
        .as_str()
        .ok_or(Error::new("WATCHDOG_JOB_ID"))?;
    require(
        super::run_readback::derive(&captured.raw_run_readback, &captured.raw_run_events, job)?
            == s["runReadback"],
        "WATCHDOG_RUN_DERIVATION",
    )?;
    let (identity, service) = executor.native_observation(guard, q, id)?;
    let routing = io::routing(p.runtime_gid)?;
    let migration = strict_json(&migration()?)?;
    let mut current = add_identity(identity, &routing, &migration)?;
    current["observed_at_ms"] = json!(now);
    current["request_digest"] = json!(request);
    current["health_max_age_ms"] = json!(p.health_max_age_ms);
    current["heartbeat_max_age_ms"] = json!(p.heartbeat_max_age_ms);
    let (health, store, incidents) = io::fresh(p.runtime_uid, p.runtime_gid, p.incident_gid)?;
    let evidence = json!({"capture":captured.capture,"semantic":s,"fresh_health":strict_json(&health)?,"fresh_store":strict_json(&store)?,"fresh_incident_state":strict_json(&incidents)?,"heartbeats":io::heartbeats(p.runtime_uid,p.incident_gid,&service.components)?});
    let now = now_ms()?;
    current["observed_at_ms"] = json!(now);
    let verdict = watchdog::evaluate(&evidence, &current, now)?;
    let (after, _) = executor.native_observation(guard, q, id)?;
    for key in [
        "native_enrollment_digest",
        "complete_face_digest",
        "service_generation",
        "target_runtime",
        "host_identity",
        "installation_binding_digest",
        "source_sha",
    ] {
        require(
            current[key] == after[key],
            "WATCHDOG_CAPTURE_GENERATION_MISMATCH",
        )?;
    }
    let proof = if let WatchdogVerdict::Pass { evidence_digest } = &verdict {
        Some(VerifiedCanary {
            grant_digest: digest(g)?,
            evidence_digest: evidence_digest.clone(),
            current: q
                .daemon_current_installation(
                    current["target_runtime"]
                        .as_str()
                        .ok_or(Error::new("WATCHDOG_CURRENT_IDENTITY"))?,
                )?
                .ok_or(Error::new("INSTALLED_GENERATION_CHANGED"))?,
        })
    } else {
        None
    };
    Ok((verdict, proof))
}

#[cfg(test)]
impl VerifiedCanary {
    pub(crate) fn fixture(current: CurrentInstallation, grant_digest: String) -> Self {
        Self {
            current,
            grant_digest,
            evidence_digest: "e".repeat(64),
        }
    }
}

#[cfg(test)]
#[path = "../../test/adoption/verification/capture.rs"]
mod tests;

#[path = "native_run.rs"]
mod run;
