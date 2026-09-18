//! Fixed immutable inputs from the separately authorized one-canary operator.
use super::{documents::strict_json, run_readback::instant};
use crate::{
    error::require,
    fs::{
        file::{sha, snapshot},
        secure::Dir,
    },
    trust::valid_id,
    Error, Result,
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::os::unix::fs::MetadataExt;
#[derive(Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct Plan {
    status: String,
    source_sha: String,
    canary_agent_id: String,
    logical_key: String,
    at: String,
    not_after: u64,
    canary_job_id: Option<String>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Created {
    plan_digest: String,
    #[serde(rename = "canaryJobId")]
    job: String,
    creator_readback_digest: String,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct CreatorReadback {
    plan_digest: String,
    job: Value,
    store_sha256: String,
    observed_at_ms: u64,
}
fn raw(area: &Dir, name: &str) -> Result<Vec<u8>> {
    let f = area.open_file(name, libc::O_RDONLY, 0)?;
    require(
        f.metadata()?.mode() & 0o777 == 0o400,
        "WATCHDOG_CANARY_CUSTODY",
    )?;
    Ok(snapshot(&f, area.uid, 4 * 1024 * 1024)?.bytes)
}
pub(crate) fn planned(area: &Dir, expected: &str, source: &str) -> Result<Value> {
    let bytes = raw(area, "canary-plan.json")?;
    require(sha(&bytes) == expected, "WATCHDOG_CANARY_PLAN")?;
    let v = strict_json(&bytes)?;
    let p: Plan = serde_json::from_value(v.clone())?;
    require(
        p.status == "PLANNED"
            && p.source_sha == source
            && p.canary_agent_id == "agt_scheduler-postdeploy-canary"
            && p.logical_key == format!("scheduler-postdeploy:{source}")
            && p.canary_job_id.is_none()
            && v.get("canaryJobId") == Some(&Value::Null)
            && p.not_after == instant(&p.at)?.saturating_add(180000),
        "WATCHDOG_CANARY_PLAN",
    )?;
    Ok(v)
}
pub(crate) fn created(area: &Dir, expected: &str, plan: &Value) -> Result<String> {
    let c: Created = serde_json::from_value(strict_json(&raw(area, "canary-created.json")?)?)?;
    let bytes = raw(area, "canary-creator-readback.json")?;
    require(
        c.plan_digest == expected && c.creator_readback_digest == sha(&bytes),
        "WATCHDOG_CANARY_CREATION",
    )?;
    let r: CreatorReadback = serde_json::from_value(strict_json(&bytes)?)?;
    let store = raw(area, "canary-created-store.json")?;
    require(
        r.plan_digest == expected && r.store_sha256 == sha(&store),
        "WATCHDOG_CANARY_CREATION",
    )?;
    valid_id(&c.job)?;
    let store = strict_json(&store)?;
    let jobs = store["jobs"]
        .as_array()
        .ok_or(Error::new("WATCHDOG_CANARY_CREATION"))?;
    let matching: Vec<_> = jobs
        .iter()
        .filter(|j| j["id"] == c.job || j["logicalKey"] == plan["logicalKey"])
        .collect();
    require(
        store["version"] == 3
            && matching.len() == 1
            && matching[0] == &r.job
            && r.job["id"] == c.job,
        "WATCHDOG_CANARY_CREATION",
    )?;
    let j = &r.job;
    require(
        j["agentId"] == plan["canaryAgentId"]
            && j["logicalKey"] == plan["logicalKey"]
            && j["name"] == "scheduler-postdeploy-side-effect-free-canary"
            && j["schedule"] == json!({"kind":"at","at":plan["at"]})
            && j["payload"]
                == json!({"kind":"agentTurn","message":format!("SCHEDULER_POSTDEPLOY_CANARY:{}",plan["sourceSha"].as_str().ok_or(Error::new("WATCHDOG_CANARY_PLAN"))?),"timeoutSeconds":120})
            && j["retry"]["auto"] == false
            && j["delivery"]["mode"] == "none"
            && j["deleteAfterRun"] == false
            && j["enabled"] == true,
        "WATCHDOG_CANARY_DEFINITION",
    )?;
    let at = instant(
        plan["at"]
            .as_str()
            .ok_or(Error::new("WATCHDOG_CANARY_PLAN"))?,
    )?;
    require(
        r.observed_at_ms >= at.saturating_sub(240000)
            && r.observed_at_ms <= at.saturating_sub(30000),
        "WATCHDOG_CANARY_CREATION_WINDOW",
    )?;
    Ok(c.job)
}
pub(crate) fn run_within_plan(plan: &Value, run: &Value) -> Result<()> {
    let at = instant(
        plan["at"]
            .as_str()
            .ok_or(Error::new("WATCHDOG_CANARY_PLAN"))?,
    )?;
    let end = run["runs"][0]["endedAt"]
        .as_u64()
        .ok_or(Error::new("WATCHDOG_RUN_TIME"))?;
    require(
        end >= at && Some(end) <= plan["notAfter"].as_u64(),
        "WATCHDOG_CANARY_WINDOW",
    )
}
#[cfg(test)]
#[path = "../../test/adoption/verification/canary_plan.rs"]
mod tests;
