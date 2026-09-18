use super::*;
use serde::{Deserialize, Serialize};
pub(super) const INTENT: &str = "login-intent.json";
pub(super) const RESULT: &str = "login-result.json";
pub(super) const FAILURE: &str = "login-failure.json";
pub(super) const ORIGINAL_INTENT: &str =
    "3ca4b44d4d3e418ea78df8ad6c0a04b7a650e0006c807ffd9f96441b0d10abc6";
#[derive(Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub(super) struct Intent {
    pub version: u32,
    pub operation_id: String,
    pub package_digest: String,
    pub owner_grant_digest: String,
    pub controller_sha256: String,
    pub custody_completion_sha256: String,
    pub original_intent_digest: String,
    pub parent_pid: u32,
    pub parent_start: String,
    pub expires_at: u64,
}
#[derive(Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub(super) struct AuthMetadata {
    pub device: u64,
    pub inode: u64,
    pub uid: u32,
    pub gid: u32,
    pub mode: u32,
    pub bytes: u64,
}
pub(super) trait Effects {
    fn preflight(&mut self) -> Result<Intent>;
    fn login(&mut self, expires: u64) -> Result<()>;
    fn postflight(&mut self) -> Result<AuthMetadata>;
}

#[derive(Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub(super) struct Receipt {
    pub version: u32,
    pub state: String,
    pub intent: Intent,
    pub intent_sha256: String,
    pub auth: AuthMetadata,
    pub original_provider_outcome: String,
    pub independent_review_pass: bool,
    pub activation_allowed: bool,
}
pub(super) fn raw(area: &Dir, name: &str) -> Result<Vec<u8>> {
    let image =
        crate::fs::file::snapshot(&area.open_file(name, libc::O_RDONLY, 0)?, area.uid, 65536)?;
    crate::error::require(image.mode == 0o400, "FIRST_LIVE_LOGIN_RECORD_MODE")?;
    Ok(image.bytes)
}
pub(super) fn receipt(area: &Dir) -> Result<Receipt> {
    let r: Receipt = serde_json::from_value(crate::verification::documents::strict_json(&raw(
        area, RESULT,
    )?)?)?;
    let intent: Intent = serde_json::from_value(crate::verification::documents::strict_json(
        &raw(area, INTENT)?,
    )?)?;
    validate_intent(&intent)?;
    validate_auth(&r.auth)?;
    crate::error::require(
        r.version == 1
            && r.state == "FIRST_LIVE_REVIEWER_LOGIN_COMPLETE_AUTH_METADATA"
            && r.intent == intent
            && r.intent_sha256 == crate::fs::file::sha(&raw(area, INTENT)?)
            && r.original_provider_outcome == "UNKNOWN_RETAINED"
            && !r.independent_review_pass
            && !r.activation_allowed,
        "FIRST_LIVE_LOGIN_RECEIPT",
    )?;
    Ok(r)
}
fn validate_intent(i: &Intent) -> Result<()> {
    crate::error::require(
        i.version == 1
            && i.operation_id == "first-live-dsh-20260918-01"
            && i.original_intent_digest == ORIGINAL_INTENT
            && i.parent_pid > 1
            && !i.parent_start.is_empty()
            && i.expires_at > 0,
        "FIRST_LIVE_LOGIN_BINDING",
    )?;
    for v in [
        &i.package_digest,
        &i.owner_grant_digest,
        &i.controller_sha256,
        &i.custody_completion_sha256,
    ] {
        crate::trust::valid_digest(v)?;
    }
    Ok(())
}
fn validate_auth(a: &AuthMetadata) -> Result<()> {
    crate::error::require(
        a.device > 0
            && a.inode > 0
            && a.uid == 612
            && a.gid == 612
            && a.mode == 0o600
            && a.bytes > 0,
        "FIRST_LIVE_LOGIN_AUTH_METADATA",
    )
}
pub(super) fn execute(area: &Dir, effects: &mut impl Effects) -> Result<String> {
    use crate::{
        first_live::{files, journal},
        fs::file::sha,
    };
    for name in [INTENT, RESULT, FAILURE] {
        files::absent(area, name)?;
    }
    let intent = effects.preflight()?;
    validate_intent(&intent)?;
    journal::append(area, INTENT, &intent)?;
    #[cfg(test)]
    crate::transaction::fault::point("first-live-login-after-intent");
    let completion = (|| {
        effects.login(intent.expires_at)?;
        let auth = effects.postflight()?;
        validate_auth(&auth)?;
        let r = Receipt {
            version: 1,
            state: "FIRST_LIVE_REVIEWER_LOGIN_COMPLETE_AUTH_METADATA".into(),
            intent: intent.clone(),
            intent_sha256: sha(&raw(area, INTENT)?),
            auth,
            original_provider_outcome: "UNKNOWN_RETAINED".into(),
            independent_review_pass: false,
            activation_allowed: false,
        };
        journal::append(area, RESULT, &r)?;
        receipt(area)?;
        Ok(sha(&raw(area, RESULT)?))
    })();
    if completion.is_err() {
        let _ = journal::append(
            area,
            FAILURE,
            &serde_json::json!({"version":1,"operation_id":intent.operation_id,"custody_completion_sha256":intent.custody_completion_sha256,"state":"OUTCOME_UNKNOWN_LOGIN_CONSUMED","original_provider_outcome":"UNKNOWN_RETAINED","activation_allowed":false}),
        );
        return Err(Error::new("FIRST_LIVE_LOGIN_OUTCOME_UNKNOWN"));
    }
    completion
}
