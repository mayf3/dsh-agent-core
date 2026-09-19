mod denial;
mod inode;
mod launchd;
mod node;
mod preflight;
mod service;

mod leaves;

mod commands;

mod driver;

mod domain_probe;

pub(super) fn run() -> crate::Result<()> {
    use super::{
        compose, files, gate, journal, legacy_locks::LegacyLocks, lifecycle, packet::BoundPacket,
    };
    use crate::{
        fs::{file::sha, MutationGuard},
        trust::digest,
    };
    let initial = preflight::prepare()?;
    let guard = MutationGuard::acquire(&initial.root, false)?;
    let prepared = preflight::prepare()?;
    guard.binds(&prepared.root)?;
    let p = &prepared.packet;
    let g = &prepared.grant;
    files::absent(&prepared.root, "first-live-operation")?;
    let area = prepared.root.mkdir("first-live-operation")?;
    let grant_sha = sha(&files::raw(&prepared.packet_dir, "owner-grant.json")?);
    let intent = serde_json::json!({"version":1,"operation_id":p.operation_id,"packet_sha256":g.packet_sha256,"grant_sha256":grant_sha,"controller_sha256":g.controller_sha256});
    journal::append(&area, "first-live-intent.json", &intent)?;
    files::publish(
        &prepared.root,
        "first-live-pending.json",
        &serde_json::json!({"operation_id":p.operation_id,"package_digest":g.packet_sha256}),
    )?;
    let locks = LegacyLocks::acquire(
        &p.operation_id,
        &g.packet_sha256,
        &area,
        &p.lifecycle.legacy_locks,
        &guard,
        super::legacy_locks::SocketNamespace::from_packet(p)?,
    )?;
    let mut effects = driver::NativeEffects::new(
        &prepared.root,
        &prepared.packet_dir,
        &area,
        p,
        g,
        &guard,
        &locks,
    )?;
    let outcome = (|| {
        let life = lifecycle::run(&area, &g.packet_sha256, &mut effects)?;
        let host = effects.finish_host(&life)?;
        let custody = crate::issuer::custody_transition::run(
            &prepared.root,
            &guard,
            crate::registry::preactivation::Bindings {
                operation_id: p.operation_id.clone(),
                package_digest: g.packet_sha256.clone(),
                owner_grant_digest: grant_sha.clone(),
                safe_host_receipt_digest: host.receipt_sha256().into(),
                controller_sha256: g.controller_sha256.clone(),
                installation_receipt_digest: p.previous.installation_receipt_sha256.clone(),
            },
            g.expires_at,
        )?;
        let login = login::run(&prepared.root, &area, p, g, &guard, &custody)?;
        let bound = BoundPacket::new(
            p,
            &life,
            &custody,
            &login,
            super::packet::BindingContext {
                root: &prepared.root,
                area: &area,
                grant: g,
                guard: &guard,
            },
        )?;
        let standing = compose::run(&prepared.root, &area, &bound, g, &guard)?;
        gate::validate(g, g, compose::now()?)?;
        let retirement = effects.final_readback()?;
        let result = serde_json::json!({"version":1,"operation_id":p.operation_id,"packet_sha256":g.packet_sha256,"grant_sha256":grant_sha,"lifecycle_digest":life.digest(),"host_safety_receipt_digest":host.receipt_sha256(),"custody_completion_digest":custody.completion_sha256(),"reviewer_login_receipt_digest":login.receipt_sha256(),"standing_receipt_digest":standing,"state":"STANDING_ADOPTION_COMPLETE_CONTROLLER_DISABLED"});
        Ok::<_, crate::Error>((result, retirement))
    })();
    match outcome {
        Ok((result, retirement)) => {
            drop(effects);
            journal::append(
                &area,
                "legacy-retirement-result.json",
                &serde_json::json!({"binding":g.packet_sha256,"retirement_digest":retirement}),
            )?;
            locks.release_completed(&retirement)?;
            journal::append(&area, "result.json", &result)?;
            println!("FIRST_LIVE {}", digest(&result)?);
            Ok(())
        }
        Err(error) => {
            let availability = match effects.failure_availability() {
                Ok(value) => value,
                Err(e) => {
                    serde_json::json!({"state":"UNKNOWN_OR_UNAVAILABLE_RETAINED","code":e.code(),"automatic_retry":false})
                }
            };
            let _ = journal::append(
                &area,
                "failure.json",
                &serde_json::json!({"version":1,"operation_id":p.operation_id,"packet_sha256":g.packet_sha256,"code":error.code(),"state":"FAILED_OR_UNKNOWN_RETAINED","controller_enabled":false,"replay_allowed":false,"availability":availability}),
            );
            Err(error)
        }
    }
}

pub(super) fn run_recovery() -> crate::Result<()> {
    use super::{
        compose, files, gate, journal, legacy_locks::LegacyLocks, lifecycle, packet::BoundPacket,
    };
    use crate::{
        error::require,
        fs::{file::sha, MutationGuard},
        trust::digest,
    };
    const PREDECESSOR: &str = "04ffd0d460f4ee1e61667a3ba4dc5b5d4457b2c2ecc033d6869d79b6e29dd174";
    let initial = preflight::prepare()?;
    let guard = MutationGuard::acquire(&initial.root, false)?;
    let prepared = preflight::prepare()?;
    guard.binds(&prepared.root)?;
    let p = &prepared.packet;
    let g = &prepared.grant;
    let predecessor = prepared
        .root
        .child("first-live-operation-p4r14r2-retained")?;
    let expected_names = [
        "failure.json",
        "first-live-intent.json",
        "first-live-maintenance-0-0",
        "initial-service-sudo-intent.json",
        "legacy-0-intent.json",
        "legacy-0-result.json",
        "legacy-1-created.json",
        "legacy-1-intent.json",
        "legacy-1-result.json",
        "legacy-2-created.json",
        "legacy-2-intent.json",
        "legacy-2-result.json",
        "legacy-ancestor-fence-intent.json",
        "legacy-ancestor-fence-result.json",
    ];
    require(
        predecessor.names()? == expected_names,
        "FIRST_LIVE_RECOVERY_HISTORY",
    )?;
    require(
        predecessor
            .child("first-live-maintenance-0-0")?
            .names()?
            .is_empty(),
        "FIRST_LIVE_RECOVERY_HISTORY",
    )?;
    let prior_intent: serde_json::Value = files::read(&predecessor, "first-live-intent.json")?;
    let prior_failure: serde_json::Value = files::read(&predecessor, "failure.json")?;
    require(
        prior_intent["version"] == 1
            && prior_intent["operation_id"] == p.operation_id
            && prior_intent["packet_sha256"] == PREDECESSOR
            && prior_failure
                == serde_json::json!({
                    "availability":{"automatic_retry":false,"code":"HOST_SESSION_MISSING","state":"UNKNOWN_OR_UNAVAILABLE_RETAINED"},
                    "code":"FIRST_LIVE_SERVICE_SUDO_POLICY",
                    "controller_enabled":false,
                    "operation_id":p.operation_id,
                    "packet_sha256":PREDECESSOR,
                    "replay_allowed":false,
                    "state":"FAILED_OR_UNKNOWN_RETAINED",
                    "version":1
                }),
        "FIRST_LIVE_RECOVERY_HISTORY",
    )?;
    let prior_pending: serde_json::Value =
        files::read(&prepared.root, "first-live-pending-p4r14r2-retained.json")?;
    require(
        prior_pending
            == serde_json::json!({"operation_id":p.operation_id,"package_digest":PREDECESSOR}),
        "FIRST_LIVE_RECOVERY_HISTORY",
    )?;
    files::absent(&prepared.root, "first-live-operation")?;
    files::absent(&prepared.root, "first-live-pending.json")?;
    let area = prepared.root.mkdir("first-live-operation")?;
    let grant_sha = sha(&files::raw(&prepared.packet_dir, "owner-grant.json")?);
    let intent = serde_json::json!({"version":1,"operation_id":p.operation_id,"packet_sha256":g.packet_sha256,"grant_sha256":grant_sha,"controller_sha256":g.controller_sha256});
    journal::append(&area, "first-live-intent.json", &intent)?;
    journal::append(
        &area,
        "recovery-intent.json",
        &serde_json::json!({"version":1,"operation_id":p.operation_id,"packet_sha256":g.packet_sha256,"predecessor_packet_sha256":PREDECESSOR,"predecessor":"first-live-operation-p4r14r2-retained"}),
    )?;
    files::publish(
        &prepared.root,
        "first-live-pending.json",
        &serde_json::json!({"operation_id":p.operation_id,"package_digest":g.packet_sha256}),
    )?;
    let locks = LegacyLocks::recover(
        &p.operation_id,
        &g.packet_sha256,
        &predecessor,
        &area,
        &p.lifecycle.legacy_locks,
        &guard,
        super::legacy_locks::SocketNamespace::from_packet(p)?,
    )?;
    let mut effects = driver::NativeEffects::new_recovery(
        &prepared.root,
        &prepared.packet_dir,
        &area,
        p,
        g,
        &guard,
        &locks,
    )?;
    let outcome = (|| {
        let life = lifecycle::run(&area, &g.packet_sha256, &mut effects)?;
        let host = effects.finish_host(&life)?;
        let custody = crate::issuer::custody_transition::run(
            &prepared.root,
            &guard,
            crate::registry::preactivation::Bindings {
                operation_id: p.operation_id.clone(),
                package_digest: g.packet_sha256.clone(),
                owner_grant_digest: grant_sha.clone(),
                safe_host_receipt_digest: host.receipt_sha256().into(),
                controller_sha256: g.controller_sha256.clone(),
                installation_receipt_digest: p.previous.installation_receipt_sha256.clone(),
            },
            g.expires_at,
        )?;
        let login = login::run(&prepared.root, &area, p, g, &guard, &custody)?;
        let bound = BoundPacket::new(
            p,
            &life,
            &custody,
            &login,
            super::packet::BindingContext {
                root: &prepared.root,
                area: &area,
                grant: g,
                guard: &guard,
            },
        )?;
        let standing = compose::run(&prepared.root, &area, &bound, g, &guard)?;
        gate::validate(g, g, compose::now()?)?;
        let retirement = effects.final_readback()?;
        let result = serde_json::json!({"version":1,"operation_id":p.operation_id,"packet_sha256":g.packet_sha256,"grant_sha256":grant_sha,"lifecycle_digest":life.digest(),"host_safety_receipt_digest":host.receipt_sha256(),"custody_completion_digest":custody.completion_sha256(),"reviewer_login_receipt_digest":login.receipt_sha256(),"standing_receipt_digest":standing,"state":"STANDING_ADOPTION_COMPLETE_CONTROLLER_DISABLED"});
        Ok::<_, crate::Error>((result, retirement))
    })();
    match outcome {
        Ok((result, retirement)) => {
            drop(effects);
            journal::append(
                &area,
                "legacy-retirement-result.json",
                &serde_json::json!({"binding":g.packet_sha256,"retirement_digest":retirement}),
            )?;
            locks.release_completed(&retirement)?;
            journal::append(&area, "result.json", &result)?;
            println!("FIRST_LIVE_RECOVERY {}", digest(&result)?);
            Ok(())
        }
        Err(error) => {
            let availability = match effects.failure_availability() {
                Ok(value) => value,
                Err(e) => {
                    serde_json::json!({"state":"UNKNOWN_OR_UNAVAILABLE_RETAINED","code":e.code(),"automatic_retry":false})
                }
            };
            let _ = journal::append(
                &area,
                "failure.json",
                &serde_json::json!({"version":1,"operation_id":p.operation_id,"packet_sha256":g.packet_sha256,"predecessor_packet_sha256":PREDECESSOR,"code":error.code(),"state":"FAILED_OR_UNKNOWN_RETAINED","controller_enabled":false,"replay_allowed":false,"availability":availability}),
            );
            Err(error)
        }
    }
}

mod availability;

mod host;

pub(super) mod login;
