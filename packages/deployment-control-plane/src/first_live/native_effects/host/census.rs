use super::credentials::Identity;
use crate::transaction::ProcessIdentity;
fn service_match(actual: &Identity, expected: &ProcessIdentity) -> bool {
    actual.pid == expected.pid
        && actual.birth_seconds == expected.started_seconds
        && actual.birth_micros == expected.started_micros
        && actual.executable.as_deref() == Some(expected.executable.as_str())
        && actual.credentials.effective_uid == expected.uid
        && actual.credentials.effective_gid == expected.gid
        && actual.credentials.real_uid == expected.uid
        && actual.credentials.saved_uid == expected.uid
        && actual.credentials.real_gid == expected.gid
        && actual.credentials.saved_gid == expected.gid
}
#[cfg(test)]
#[path = "../../../../test/first_live/host/census.rs"]
mod tests;

use super::{context::Context, credentials, inspect, owned::Owned, policy, reader};
use crate::{error::require, Error, Result};
pub(super) fn prove(
    ctx: &Context<'_>,
    phase: &str,
    services: &crate::transaction::ServiceImage,
    tail: &Identity,
    owned: &Owned,
) -> Result<String> {
    ctx.check()?;
    owned.verify(ctx)?;
    let expected_services = crate::trust::digest(&services.components)?;
    require(
        crate::trust::digest(&crate::transaction::first_live_components(
            &ctx.packet.native_enrollment.maintenance()?,
        )?)? == expected_services,
        "HOST_SERVICE_DRIFT",
    )?;
    let before = reader::snapshot()?;
    let selected = credentials::stable(&before, &before)?;
    let mut observations = Vec::new();
    let mut tail_count = 0;
    for identity in &selected {
        ctx.check()?;
        let observation = if identity.pid == 0 {
            serde_json::json!({"role":"KERNEL_PSEUDO_PROCESS","identity":identity})
        } else if owned.contains(identity) {
            serde_json::json!({"role":"EXACT_OWNED_OPERATOR_LINEAGE","identity":identity,"controller_sha256":ctx.grant.controller_sha256})
        } else if identity == tail {
            tail_count += 1;
            serde_json::json!({"role":"EXACT_TAILSCALE_PHASE_GENERATION","identity":identity})
        } else if services
            .processes
            .iter()
            .any(|p| service_match(identity, p))
        {
            serde_json::json!({"role":"EXACT_SELECTED_DSH_SERVICE_GENERATION","identity":identity,"components_digest":expected_services})
        } else {
            let path = identity
                .executable
                .as_deref()
                .ok_or_else(|| Error::new("HOST_ROLE_UNKNOWN"))?;
            let candidates = policy::roles(path)?;
            let role = if path == "/usr/bin/login" {
                use std::os::unix::fs::MetadataExt;
                let mut matches = Vec::new();
                for candidate in &candidates {
                    let tty = candidate
                        .tty
                        .as_deref()
                        .ok_or_else(|| Error::new("HOST_LOGIN_ROLE"))?;
                    match std::fs::symlink_metadata(format!("/dev/{tty}")) {
                        Ok(metadata) if metadata.rdev() == identity.tty_device as u64 => {
                            matches.push(candidate)
                        }
                        Ok(_) => (),
                        Err(e) if e.kind() == std::io::ErrorKind::NotFound => (),
                        Err(e) => return Err(e.into()),
                    }
                }
                require(matches.len() == 1, "HOST_LOGIN_ROLE")?;
                matches[0]
            } else {
                require(candidates.len() == 1, "HOST_ROLE_AMBIGUOUS")?;
                &candidates[0]
            };
            serde_json::to_value(inspect::prove(ctx, role, identity)?)?
        };
        observations.push(observation);
    }
    require(tail_count == 1, "HOST_TAILSCALE_GENERATION")?;
    owned.verify(ctx)?;
    let after = reader::snapshot()?;
    credentials::stable(&before, &after)?;
    require(
        crate::trust::digest(&crate::transaction::first_live_components(
            &ctx.packet.native_enrollment.maintenance()?,
        )?)? == expected_services,
        "HOST_SERVICE_DRIFT",
    )?;
    ctx.check()?;
    let proof = serde_json::json!({"version":1,"operation_id":ctx.packet.operation_id,"packet_sha256":ctx.grant.packet_sha256,"controller_sha256":ctx.grant.controller_sha256,"phase":phase,"all_pid_count":before.len(),"selector_digest":crate::trust::digest(&before)?,"roles":observations});
    crate::first_live::files::publish(ctx.area, &format!("host-roles-{phase}.json"), &proof)?;
    crate::trust::digest(&proof)
}
