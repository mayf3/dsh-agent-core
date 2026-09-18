use crate::{error::require, Result};
#[derive(Clone, serde::Serialize, serde::Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct CanaryPlanTemplate {
    pub version: u32,
    pub source_sha: String,
    pub canary_agent_id: String,
    pub logical_key: String,
    pub at_delay_seconds: u64,
    pub not_after_delay_seconds: u64,
}
impl CanaryPlanTemplate {
    pub(super) fn validate(&self) -> Result<()> {
        require(
            self.version == 1
                && self.source_sha == "d602b592fad345fb1c9adebe2bc6611a6f5cfdc2"
                && self.canary_agent_id == "agt_scheduler-postdeploy-canary"
                && self.logical_key == format!("scheduler-postdeploy:{}", self.source_sha)
                && self.at_delay_seconds == 1200
                && self.not_after_delay_seconds == 1380,
            "FIRST_LIVE_CANARY_TEMPLATE",
        )
    }
}
fn plan_at(template: &CanaryPlanTemplate, t0: u64, expires: u64) -> Result<String> {
    template.validate()?;
    let at = t0.checked_add(1200).ok_or(crate::Error::new("CLOCK"))?;
    let end = t0.checked_add(1380).ok_or(crate::Error::new("CLOCK"))?;
    require(expires > end, "FIRST_LIVE_CANARY_LIFETIME")?;
    let seconds: libc::time_t = at.try_into().map_err(|_| crate::Error::new("CLOCK"))?;
    let mut time: libc::tm = unsafe { std::mem::zeroed() };
    require(
        !unsafe { libc::gmtime_r(&seconds, &mut time) }.is_null(),
        "CLOCK",
    )?;
    let at = format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}.000Z",
        time.tm_year + 1900,
        time.tm_mon + 1,
        time.tm_mday,
        time.tm_hour,
        time.tm_min,
        time.tm_sec
    );
    let raw = crate::trust::canonical_bytes(
        &serde_json::json!({"status":"PLANNED","sourceSha":template.source_sha,"canaryAgentId":template.canary_agent_id,"logicalKey":template.logical_key,"at":at,"notAfter":end.checked_mul(1000).ok_or(crate::Error::new("CLOCK"))?,"canaryJobId":null}),
    )?;
    String::from_utf8(raw).map_err(|_| crate::Error::new("ENCODING"))
}
#[cfg(test)]
#[path = "../../test/first_live/canary_timing.rs"]
mod tests;

pub(super) fn freeze(
    area: &crate::fs::secure::Dir,
    template: &CanaryPlanTemplate,
    life: &super::lifecycle::VerifiedLifecycle,
    expires: u64,
) -> Result<String> {
    use std::os::unix::fs::MetadataExt;
    for name in ["canary-plan-intent.json", "canary-plan.json"] {
        super::files::absent(area, name)?;
    }
    let t0 = super::compose::now()?;
    let raw = plan_at(template, t0, expires)?;
    super::journal::append(
        area,
        "canary-plan-intent.json",
        &serde_json::json!({"t0":t0,"lifecycle_digest":life.digest(),"raw_sha256":crate::fs::file::sha(raw.as_bytes())}),
    )?;
    crate::fs::file::write_new(
        area,
        "canary-plan.json",
        raw.as_bytes(),
        area.uid,
        area.file.metadata()?.gid(),
        0o400,
    )?;
    require(
        super::files::raw(area, "canary-plan.json")? == raw.as_bytes(),
        "FIRST_LIVE_CANARY_READBACK",
    )?;
    Ok(raw)
}
