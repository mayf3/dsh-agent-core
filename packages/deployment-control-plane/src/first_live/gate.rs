use crate::{
    error::require,
    trust::{valid_digest, valid_id},
    Result,
};
use serde::{Deserialize, Serialize};
#[derive(Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub(super) struct Grant {
    pub version: u32,
    pub owner: String,
    pub scope: String,
    pub operation_id: String,
    pub host: String,
    pub packet_sha256: String,
    pub controller_sha256: String,
    pub source_sha: String,
    pub review_sha256: String,
    pub issued_at: u64,
    pub expires_at: u64,
    pub temporary_supply_hold: bool,
}
pub(super) fn validate(g: &Grant, expected: &Grant, now: u64) -> Result<()> {
    require(
        g == expected
            && g.version == 1
            && g.owner == "mayf3"
            && g.scope == "EXACT_DSH_FIRST_LIVE_ONLY"
            && g.temporary_supply_hold,
        "FIRST_LIVE_BINDING",
    )?;
    valid_id(&g.operation_id)?;
    for value in [
        &g.host,
        &g.packet_sha256,
        &g.controller_sha256,
        &g.review_sha256,
    ] {
        valid_digest(value)?;
    }
    require(
        g.source_sha.len() == 40
            && g.source_sha
                .bytes()
                .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b)),
        "FIRST_LIVE_SOURCE",
    )?;
    require(
        g.issued_at <= now
            && now < g.expires_at
            && g.expires_at
                .checked_sub(g.issued_at)
                .is_some_and(|n| n > 0 && n <= 86400),
        "FIRST_LIVE_EXPIRED",
    )
}
