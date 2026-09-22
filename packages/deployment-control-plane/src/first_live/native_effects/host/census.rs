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
fn observe(
    ctx: &Context<'_>,
    phase: &str,
    services: &crate::transaction::ServiceImage,
    tail: &Identity,
    owned: &Owned,
    readonly: bool,
) -> Result<serde_json::Value> {
    ctx.check()?;
    owned.verify(ctx)?;
    let expected_services = crate::trust::digest(&services.components)?;
    let current = || {
        if readonly {
            super::super::readonly_components(ctx.packet)
        } else {
            crate::transaction::first_live_components(&ctx.packet.native_enrollment.maintenance()?)
        }
    };
    require(
        crate::trust::digest(&current()?)? == expected_services,
        "HOST_SERVICE_DRIFT",
    )?;
    let before = reader::snapshot()?;
    let selected = credentials::stable(&before, &before)?;
    let mut observations = Vec::new();
    let mut retired = Vec::new();
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
                .ok_or_else(|| {
                    Error::new("HOST_ROLE_UNKNOWN").context(format!("pid {}", identity.pid))
                })?;
            let candidates =
                policy::roles(path).map_err(|e| e.context(path.to_string()))?;
            // Owned by the dynamic-login fallback below; otherwise unused.
            let mut dynamic_login: Option<policy::Role> = None;
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
                match matches.len() {
                    1 => matches[0],
                    // tmux churns the owner's pty names faster than a frozen
                    // table can pin them.  A login on an unpinned tty is
                    // still the owner's session when the controlling device
                    // is a pty OWNED BY THE GRANT OWNER (502): bind by
                    // device identity and ownership, not by name.  The
                    // credential set (real uid 502 through setuid root) and
                    // the device match are still enforced by login() below.
                    0 if !candidates.is_empty() => {
                        use std::os::unix::fs::{FileTypeExt, MetadataExt};
                        let owned_tty = std::fs::read_dir("/dev")
                            .map_err(Error::from)?
                            .filter_map(|e| e.ok())
                            .find(|e| {
                                e.file_name().to_str().is_some_and(|n| n.starts_with("ttys"))
                                    && std::fs::symlink_metadata(e.path()).is_ok_and(|m| {
                                        m.file_type().is_char_device()
                                            && m.rdev() == identity.tty_device as u64
                                            && m.uid() == 502
                                    })
                            })
                            .map(|e| e.file_name().to_string_lossy().into_owned())
                            .ok_or_else(|| Error::new("HOST_LOGIN_ROLE"))?;
                        let mut r = candidates[0].clone();
                        r.tty = Some(owned_tty);
                        dynamic_login = Some(r);
                        dynamic_login.as_ref().unwrap()
                    }
                    _ => return Err(Error::new("HOST_LOGIN_ROLE")),
                }
            } else {
                require(candidates.len() == 1, "HOST_ROLE_AMBIGUOUS")?;
                &candidates[0]
            };
            match inspect::prove(ctx, role, identity)? {
                Some(observation) => serde_json::to_value(observation)?,
                None => {
                    retired.push(identity.pid);
                    serde_json::json!({"role":"APPLE_FIXED_XPC_ROLE_RETIRED_TRANSIENT","identity":identity})
                }
            }
        };
        observations.push(observation);
    }
    require(tail_count == 1, "HOST_TAILSCALE_GENERATION")?;
    owned.verify(ctx)?;
    let after = reader::snapshot()?;
    // Retired transient XPC observations died with evidence recorded above; any
    // other pid-set difference between the snapshots is drift and fails closed.
    let survivors: Vec<Identity> = before
        .iter()
        .filter(|p| !retired.contains(&p.pid))
        .cloned()
        .collect();
    credentials::stable(&survivors, &after)?;
    require(
        crate::trust::digest(&current()?)? == expected_services,
        "HOST_SERVICE_DRIFT",
    )?;
    ctx.check()?;
    Ok(
        serde_json::json!({"version":1,"operation_id":ctx.packet.operation_id,"packet_sha256":ctx.grant.packet_sha256,"controller_sha256":ctx.grant.controller_sha256,"phase":phase,"all_pid_count":before.len(),"selector_digest":crate::trust::digest(&before)?,"roles":observations}),
    )
}
pub(super) fn prove(
    ctx: &Context<'_>,
    phase: &str,
    services: &crate::transaction::ServiceImage,
    tail: &Identity,
    owned: &Owned,
) -> Result<String> {
    let proof = observe(ctx, phase, services, tail, owned, false)?;
    crate::first_live::files::publish(ctx.area, &format!("host-roles-{phase}.json"), &proof)?;
    crate::trust::digest(&proof)
}
pub(super) fn probe(
    ctx: &Context<'_>,
    services: &crate::transaction::ServiceImage,
    tail: &Identity,
    owned: &Owned,
) -> Result<String> {
    crate::trust::digest(&observe(
        ctx,
        "readonly-burn-in",
        services,
        tail,
        owned,
        true,
    )?)
}
