//! Ordered handling of one authenticated exact-job history observation.
use super::*;
pub(super) fn observe(
    area: &Dir,
    q: &Queue,
    grant_digest: &str,
    job: &str,
    raw: &[u8],
    now: u64,
    read_events: impl FnOnce() -> Result<Vec<u8>>,
) -> Result<(Value, Vec<u8>)> {
    if unknown(area)? {
        q.latch_executor_failure(&digest(&(grant_digest, "canary-unknown-retained"))?)?;
        return Err(Error::new("UNKNOWN_CANARY"));
    }
    let body = strict_json(raw)?;
    let runs = body["runs"]
        .as_array()
        .ok_or(Error::new("WATCHDOG_RUN_READBACK"))?;
    require(runs.len() == 1, "WATCHDOG_CANARY_PENDING")?;
    require(runs[0]["job_id"] == job, "WATCHDOG_RUN_IDENTITY")?;
    if runs[0]["outcome"] == "outcome_unknown" {
        let evidence =
            json!({"grant_digest":grant_digest,"raw_run_readback":raw,"observed_at_ms":now});
        save(area, "unknown.json", &evidence)?;
        q.latch_executor_failure(&digest(&evidence)?)?;
        return Err(Error::new("UNKNOWN_CANARY"));
    }
    require(
        runs[0]["outcome"] == "succeeded",
        "WATCHDOG_CANARY_NOT_SUCCEEDED",
    )?;
    // Once authenticated history says UNKNOWN, unrelated event-file failure
    // cannot prevent durable retention or permit a later success substitution.
    let events = read_events()?;
    Ok((
        crate::verification::run_readback::derive(raw, &events, job)?,
        events,
    ))
}
#[cfg(test)]
#[path = "../../test/adoption/verification/native_run.rs"]
mod tests;
