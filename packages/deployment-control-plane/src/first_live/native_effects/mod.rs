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

mod availability;

mod host;

pub(super) mod login;
