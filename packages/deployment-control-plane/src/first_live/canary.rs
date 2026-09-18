use crate::{error::require, Error, Result};
use serde_json::Value;
pub(super) fn succeeded(run: &Value, source: &str) -> Result<()> {
    let rows = run["runs"]
        .as_array()
        .ok_or(Error::new("FIRST_LIVE_CANARY_PENDING"))?;
    require(rows.len() == 1, "FIRST_LIVE_CANARY_PENDING")?;
    let r = &rows[0];
    let result = &r["result"];
    require(
        r["outcome"] == "succeeded"
            && r["endedAt"].as_u64().is_some()
            && result["final_status"] == "PASS"
            && result["counters"]["tool_calls"] == 0
            && result["counters"]["external_effects"] == 0
            && result["notes"] == format!("SCHEDULER_NATIVE_NOOP:{source}"),
        "FIRST_LIVE_CANARY_PROOF",
    )?;
    let occurrence = r["occurrence_id"]
        .as_str()
        .ok_or(Error::new("FIRST_LIVE_CANARY_PROOF"))?;
    let events = run["events"]
        .as_array()
        .ok_or(Error::new("FIRST_LIVE_CANARY_PROOF"))?;
    let matching: Vec<_> = events
        .iter()
        .filter(|e| {
            e["occurrenceId"] == occurrence
                && e["action"] == "router_admission"
                && e["phase"] == "accepted"
        })
        .collect();
    require(matching.len() == 1, "FIRST_LIVE_CANARY_PROOF")?;
    let e = &matching[0]["evidence"];
    require(
        e["executionClass"] == "SCHEDULER_NATIVE_NOOP"
            && e["toolCalls"] == 0
            && e["externalEffects"] == 0
            && e["marker"] == "SCHEDULER_POSTDEPLOY_CANARY_OK"
            && e["sourceSha"] == source,
        "FIRST_LIVE_CANARY_PROOF",
    )
}
use super::{
    files, gate,
    packet::BoundPacket,
    process::{self, Tool},
};
use crate::{
    fs::{
        file::{sha, write_new},
        MutationGuard,
    },
    model::*,
    queue::Queue,
    service::Intake,
    transaction::Executor,
    trust::digest,
    verification::{canary_plan, native, native_io as io, run_readback},
};
use std::os::unix::fs::MetadataExt;
fn now_ms() -> Result<u64> {
    super::compose::now_ms()
}
fn raw_write(area: &crate::fs::secure::Dir, name: &str, raw: &[u8]) -> Result<()> {
    write_new(
        area,
        name,
        raw,
        area.uid,
        area.file.metadata()?.gid(),
        0o400,
    )?;
    Ok(())
}
#[expect(
    clippy::too_many_arguments,
    reason = "Fixed in-process operation retains its one physical guard"
)]
pub(super) fn run(
    intake: &Intake,
    q: &Queue,
    executor: &mut Executor,
    guard: &MutationGuard,
    unit: &str,
    g: &Signed<AdoptionGrant>,
    p: &BoundPacket<'_>,
    external: &gate::Grant,
) -> Result<()> {
    let check = || gate::validate(external, external, super::compose::now()?);
    check()?;
    let area = intake
        .root
        .child("adoptions")?
        .child(&digest(g)?)?
        .mkdir("watchdog")?;
    raw_write(&area, "canary-plan.json", p.canary_plan_raw.as_bytes())?;
    let plan = canary_plan::planned(
        &area,
        &g.payload.canary_plan_digest,
        &g.payload.release.source_sha,
    )?;
    let at = run_readback::instant(
        plan["at"]
            .as_str()
            .ok_or(Error::new("FIRST_LIVE_CANARY_PLAN"))?,
    )?;
    let end = plan["notAfter"]
        .as_u64()
        .ok_or(Error::new("FIRST_LIVE_CANARY_PLAN"))?;
    let wait_started = std::time::Instant::now();
    while now_ms()? < at.saturating_sub(240000) {
        check()?;
        require(
            wait_started.elapsed().as_secs() < 1200,
            "FIRST_LIVE_CANARY_WINDOW",
        )?;
        std::thread::sleep(std::time::Duration::from_secs(1));
    }
    require(
        now_ms()? <= at.saturating_sub(60000),
        "FIRST_LIVE_CANARY_WINDOW",
    )?;
    native::begin(
        &intake.root,
        &intake.config.catalog,
        q,
        executor,
        guard,
        unit,
        g,
        now_ms()?,
    )?;
    check()?;
    require(
        now_ms()? <= at.saturating_sub(60000),
        "FIRST_LIVE_CANARY_WINDOW",
    )?;
    let before_store = io::runtime_document("jobs.json", 505, 601)?;
    let before = crate::verification::documents::strict_json(&before_store)?;
    require(
        before["jobs"]
            .as_array()
            .is_some_and(|jobs| jobs.iter().all(|j| j["logicalKey"] != plan["logicalKey"])),
        "FIRST_LIVE_CANARY_PRESENT",
    )?;
    files::publish(
        &area,
        "canary-create-intent.json",
        &serde_json::json!({"grant_digest":digest(g)?,"plan_digest":g.payload.canary_plan_digest}),
    )?;
    let node = p
        .lifecycle
        .node_payloads
        .get("bin/node")
        .ok_or(Error::new("FIRST_LIVE_NODE"))?;
    let args = vec![
        "/usr/local/libexec/agent-core/app/scripts/lib/scheduler-postdeploy-canary-control.mjs"
            .into(),
        "create".into(),
        "--source-sha".into(),
        g.payload.release.source_sha.clone(),
        "--agent".into(),
        "agt_scheduler-postdeploy-canary".into(),
        "--at".into(),
        plan["at"].as_str().unwrap().into(),
    ];
    let output = process::run(
        Tool::Node,
        node,
        &args,
        Some((505, 601, &p.lifecycle.runtime_groups)),
        30,
    )?;
    require(output.code == Some(0), "FIRST_LIVE_CANARY_CREATE_UNKNOWN")?;
    let created = crate::verification::documents::strict_json(output.stdout.as_bytes())?;
    require(
        created["controlOutcome"] == "created",
        "FIRST_LIVE_CANARY_CREATE_UNKNOWN",
    )?;
    let job = created["id"]
        .as_str()
        .ok_or(Error::new("FIRST_LIVE_CANARY_CREATE_UNKNOWN"))?;
    crate::trust::valid_id(job)?;
    let store = io::runtime_document("jobs.json", 505, 601)?;
    let value = crate::verification::documents::strict_json(&store)?;
    let jobs = value["jobs"]
        .as_array()
        .ok_or(Error::new("FIRST_LIVE_CANARY_CREATE_UNKNOWN"))?;
    let exact: Vec<_> = jobs
        .iter()
        .filter(|j| j["id"] == job || j["logicalKey"] == plan["logicalKey"])
        .collect();
    require(
        exact.len() == 1 && exact[0]["id"] == job,
        "FIRST_LIVE_CANARY_CREATE_UNKNOWN",
    )?;
    raw_write(&area, "canary-created-store.json", &store)?;
    let readback = serde_json::json!({"plan_digest":g.payload.canary_plan_digest,"job":exact[0],"store_sha256":sha(&store),"observed_at_ms":now_ms()?});
    files::publish(&area, "canary-creator-readback.json", &readback)?;
    files::publish(
        &area,
        "canary-created.json",
        &serde_json::json!({"plan_digest":g.payload.canary_plan_digest,"canaryJobId":job,"creator_readback_digest":sha(&files::raw(&area,"canary-creator-readback.json")?)}),
    )?;
    require(
        canary_plan::created(&area, &g.payload.canary_plan_digest, &plan)? == job,
        "FIRST_LIVE_CANARY_CREATE_UNKNOWN",
    )?;
    let run = loop {
        check()?;
        require(now_ms()? <= end, "FIRST_LIVE_CANARY_PENDING")?;
        let raw = io::get(Some(job))?;
        let v = crate::verification::documents::strict_json(&raw)?;
        let rows = v["runs"]
            .as_array()
            .ok_or(Error::new("FIRST_LIVE_CANARY_PENDING"))?;
        require(rows.len() <= 1, "FIRST_LIVE_CANARY_AMBIGUOUS")?;
        if let Some(row) = rows.first() {
            require(
                !["outcome_unknown", "failed", "cancelled"]
                    .iter()
                    .any(|s| row["outcome"] == *s),
                "FIRST_LIVE_CANARY_UNKNOWN",
            )?;
            if row["outcome"] == "succeeded" {
                let events = io::runtime_document("runs.jsonl", 505, 601)?;
                let run = run_readback::derive(&raw, &events, job)?;
                succeeded(&run, &g.payload.release.source_sha)?;
                canary_plan::run_within_plan(&plan, &run)?;
                raw_write(&area, "canary-success-runs.json", &raw)?;
                raw_write(&area, "canary-success-events.jsonl", &events)?;
                break run;
            }
        }
        std::thread::sleep(std::time::Duration::from_secs(2));
    };
    check()?;
    let current =
        crate::verification::documents::strict_json(&io::runtime_document("jobs.json", 505, 601)?)?;
    let jobs = current["jobs"]
        .as_array()
        .ok_or(Error::new("FIRST_LIVE_CANARY_CLEANUP"))?;
    let matching: Vec<_> = jobs
        .iter()
        .filter(|j| j["id"] == job || j["logicalKey"] == plan["logicalKey"])
        .collect();
    require(
        matching.len() == 1 && matching[0]["id"] == job,
        "FIRST_LIVE_CANARY_CLEANUP",
    )?;
    let revision = matching[0]["scheduleRevision"]
        .as_u64()
        .filter(|n| *n > 0)
        .ok_or(Error::new("FIRST_LIVE_CANARY_CLEANUP"))?;
    let updated = matching[0]["updatedAtMs"]
        .as_u64()
        .filter(|n| *n > 0)
        .ok_or(Error::new("FIRST_LIVE_CANARY_CLEANUP"))?;
    files::publish(
        &area,
        "canary-cleanup-intent.json",
        &serde_json::json!({"job":job,"revision":revision,"updated_at_ms":updated,"run_digest":digest(&run)?}),
    )?;
    let output = process::run(
        Tool::Node,
        node,
        &[
            "/usr/local/libexec/agent-core/app/scripts/agentcore-cron.mjs".into(),
            "rm".into(),
            job.into(),
            "--expected-schedule-revision".into(),
            revision.to_string(),
            "--expected-updated-at".into(),
            updated.to_string(),
        ],
        Some((505, 601, &p.lifecycle.runtime_groups)),
        30,
    )?;
    require(output.code == Some(0), "FIRST_LIVE_CANARY_CLEANUP_UNKNOWN")?;
    let after = io::runtime_document("jobs.json", 505, 601)?;
    let value = crate::verification::documents::strict_json(&after)?;
    require(
        value["jobs"].as_array().is_some_and(|j| {
            j.iter()
                .all(|j| j["id"] != job && j["logicalKey"] != plan["logicalKey"])
        }),
        "FIRST_LIVE_CANARY_CLEANUP_UNKNOWN",
    )?;
    files::publish(
        &area,
        "canary-cleanup-result.json",
        &serde_json::json!({"job":job,"after_sha256":sha(&after)}),
    )?;
    check()?;
    native::finish(
        &intake.root,
        &intake.config.catalog,
        q,
        executor,
        guard,
        unit,
        g,
        now_ms()?,
    )
}
