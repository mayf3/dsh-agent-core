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

const READONLY_PROBE_PATH: &str =
    "/private/var/db/agent-deploy-bootstrap/pdc-host-burn-in/agent-deployd";

pub(super) fn run_readonly_probe() -> crate::Result<serde_json::Value> {
    use super::{
        files, inventory,
        legacy_locks::{LegacyLocks, SocketNamespace},
        native_tree, process, retirement,
    };
    use crate::{error::require, fs::MutationGuard, trust::digest};
    use std::path::Path;
    require(unsafe { libc::geteuid() } == 0, "FIRST_LIVE_REQUIRES_ROOT")?;
    require(
        std::env::current_exe()? == Path::new(READONLY_PROBE_PATH),
        "FIRST_LIVE_PROBE_EXECUTABLE",
    )?;
    let executable_digest = host::probe_executable(READONLY_PROBE_PATH)?;
    let prepared = preflight::probe()?;
    let guard = MutationGuard::acquire_readonly(&prepared.root)?;
    let area = prepared.root.child("first-live-operation")?;
    let p = &prepared.packet;
    let g = &prepared.grant;
    let protected_large_file_digest = host::probe_large_file(
        crate::issuer::review::CODEX_PATH,
        &p.codex_sha256,
        512 * 1024 * 1024,
    )?;
    guard.binds(&prepared.root)?;

    let ancestors = native_tree::ancestors(&p.lifecycle.ancestors)?;
    let trees = native_tree::load(&prepared.packet_dir, p)?;
    let mut inventory_digests = Vec::new();
    for (index, name) in ["app", "harness", "node-runtime"].iter().enumerate() {
        inventory_digests.push(inventory::census(
            &native_tree::open(name)?,
            &trees[index],
            false,
            index == 1,
        )?);
    }
    inventory::closed_links(&trees)?;
    let absent = retirement::absent_sources(&native_tree::open("app")?, &trees[0].entries)?;

    let launchctl = p
        .lifecycle
        .tool_sha256
        .get("/bin/launchctl")
        .ok_or(crate::Error::new("FIRST_LIVE_TOOL_SET"))?;
    let disabled = process::run(
        process::Tool::Launchctl,
        launchctl,
        &["print-disabled".into(), "system".into()],
        None,
        5,
    )?;
    let controller = process::run(
        process::Tool::Launchctl,
        launchctl,
        &["print".into(), "system/ai.agent-deployd".into()],
        None,
        5,
    )?;
    require(
        crate::bootstrap::agent_deployd_disabled_override(disabled.code, &disabled.stdout)
            && controller.code == Some(113)
            && controller.stdout.is_empty()
            && controller.stderr.contains("Could not find service"),
        "FIRST_LIVE_CONTROLLER_NOT_DISABLED",
    )?;

    let sudo_pin = p
        .lifecycle
        .tool_sha256
        .get("/usr/bin/sudo")
        .ok_or(crate::Error::new("FIRST_LIVE_TOOL_PIN"))?;
    let sudo_accounts = super::sudo::audit(sudo_pin)?;
    let caller_sudo = process::run(
        process::Tool::Sudo,
        sudo_pin,
        &["-n".into(), "-l".into()],
        Some((502, 20, &p.lifecycle.caller_groups)),
        5,
    )?;
    require(
        commands::sudo(&caller_sudo, &p.lifecycle.effective_sudo_sha256),
        "FIRST_LIVE_PRIVILEGE_DRIFT",
    )?;

    let components = readonly_components(p)?;
    service::validate_group(
        &components,
        &p.lifecycle.loaded_services,
        &p.lifecycle.disabled_services,
    )?;
    let services = crate::transaction::ServiceImage {
        loaded: components
            .iter()
            .find(|c| c.kind == crate::transaction::NativeKind::Runtime)
            .ok_or(crate::Error::new("HOST_SERVICE_GROUP"))?
            .loaded,
        running: components
            .iter()
            .find(|c| c.kind == crate::transaction::NativeKind::Runtime)
            .unwrap()
            .running,
        processes: components
            .iter()
            .filter_map(|c| c.process.clone())
            .collect(),
        generation: digest(&components)?,
        components,
    };
    let context = host::Inputs {
        root: &prepared.root,
        area: &area,
        packet_dir: &prepared.packet_dir,
        packet: p,
        grant: g,
        guard: &guard,
    };
    let host =
        host::Session::readonly_probe(context, &services, READONLY_PROBE_PATH, &executable_digest)?;
    let namespace = SocketNamespace::from_packet(p)?;
    let socket_namespace = namespace.readonly_digest()?;
    let retained_locks = LegacyLocks::readonly_observe(
        &p.operation_id,
        &g.packet_sha256,
        &area,
        &p.lifecycle.legacy_locks,
        SocketNamespace::from_packet(p)?,
    )?;
    let failure: serde_json::Value = files::read(&area, "failure.json")?;
    require(
        failure["state"] == "FAILED_OR_UNKNOWN_RETAINED"
            && failure["controller_enabled"] == false
            && failure["replay_allowed"] == false,
        "FIRST_LIVE_PROBE_RETAINED_STATE",
    )?;
    guard.binds(&prepared.root)?;
    Ok(serde_json::json!({
        "version":1,
        "state":"ALL_KNOWN_FIRST_LIVE_READONLY_HOST_GATES_PASS",
        "production_mutation":false,
        "executable_sha256":executable_digest,
        "packet_sha256":g.packet_sha256,
        "protected_large_file_digest":protected_large_file_digest,
        "ancestors_digest":ancestors,
        "inventory_digest":digest(&inventory_digests)?,
        "legacy_absence_digest":digest(&absent)?,
        "launchctl_digest":digest(&(disabled,controller))?,
        "sudo_policy_digest":digest(&(sudo_accounts,caller_sudo))?,
        "service_generation_digest":services.generation,
        "socket_namespace_digest":socket_namespace,
        "retained_locks_digest":retained_locks,
        "host":host,
        "retained_failure_digest":digest(&failure)?
    }))
}

pub(super) fn readonly_components(
    p: &super::packet::Packet,
) -> crate::Result<Vec<crate::transaction::ComponentImage>> {
    use crate::error::require;
    let pin = p
        .lifecycle
        .tool_sha256
        .get("/bin/launchctl")
        .ok_or(crate::Error::new("FIRST_LIVE_TOOL_SET"))?;
    require(
        pin == &p.native_enrollment.launchctl_sha256,
        "FIRST_LIVE_TOOL_SET",
    )?;
    crate::bootstrap::verify_platform_launchctl(pin)?;
    let input = p.native_enrollment.maintenance()?;
    let run = |args: Vec<String>| -> crate::Result<(i32, String)> {
        let output = crate::first_live::process::run(
            crate::first_live::process::Tool::Launchctl,
            pin,
            &args,
            None,
            5,
        )?;
        let code = output
            .code
            .ok_or(crate::Error::new("SERVICE_READBACK_INVALID"))?;
        require(
            output.stdout.is_empty() || output.stderr.is_empty(),
            "SERVICE_READBACK_INVALID",
        )?;
        Ok((
            code,
            if output.stdout.is_empty() {
                output.stderr
            } else {
                output.stdout
            },
        ))
    };
    readonly_components_from(&input, run)
}

fn readonly_components_from(
    input: &crate::transaction::NativeMaintenanceInput,
    mut run: impl FnMut(Vec<String>) -> crate::Result<(i32, String)>,
) -> crate::Result<Vec<crate::transaction::ComponentImage>> {
    use crate::{error::require, transaction::NativeKind};
    input.validate()?;
    let mut result = Vec::new();
    for enrollment in &input.services {
        let (disabled_code, disabled_text) = run(vec!["print-disabled".into(), "system".into()])?;
        require(
            disabled_code == 0 && disabled_text.contains("disabled services = {"),
            "SERVICE_DISABLED_UNPROVEN",
        )?;
        let name = enrollment.kind.label().strip_prefix("system/").unwrap();
        let prefix = format!("\"{name}\" => ");
        let found: Vec<_> = disabled_text
            .lines()
            .map(str::trim)
            .filter_map(|line| line.strip_prefix(&prefix))
            .collect();
        require(found.len() <= 1, "SERVICE_DISABLED_UNPROVEN")?;
        let disabled = match found.first().copied() {
            None | Some("false") => false,
            Some("true") => true,
            _ => return Err(crate::Error::new("SERVICE_DISABLED_UNPROVEN")),
        };
        let (code, text) = run(vec!["print".into(), enrollment.kind.label().into()])?;
        if code == 113 && text.contains("Could not find service") {
            result.push(crate::transaction::ComponentImage {
                kind: enrollment.kind,
                loaded: false,
                disabled,
                running: false,
                process: None,
                runs: 0,
                last_exit: None,
            });
            continue;
        }
        require(code == 0, "SERVICE_UNAVAILABLE")?;
        let fields = crate::transaction::parse_launchd(&text)?;
        require(
            fields.get("program").map(String::as_str) == Some(crate::transaction::FIRST_LIVE_NODE)
                && fields.get("path").map(String::as_str) == Some(enrollment.kind.plist()),
            "SERVICE_IDENTITY",
        )?;
        let running = fields.get("state").map(String::as_str) == Some("running");
        require(
            running || fields.get("state").map(String::as_str) == Some("not running"),
            "SERVICE_STATE_UNPROVEN",
        )?;
        let process = if running {
            let pid = fields
                .get("pid")
                .and_then(|value| value.parse().ok())
                .ok_or(crate::Error::new("SERVICE_IDENTITY"))?;
            let identity = crate::transaction::first_live_process_identity(pid)?;
            require(
                identity.uid == enrollment.uid
                    && identity.gid == enrollment.gid
                    && identity.executable == crate::transaction::FIRST_LIVE_NODE
                    && crate::transaction::first_live_process_argv(pid)?
                        == input.argv(enrollment.kind),
                "SERVICE_IDENTITY",
            )?;
            Some(identity)
        } else {
            require(!fields.contains_key("pid"), "SERVICE_IDENTITY")?;
            None
        };
        let runs = fields
            .get("runs")
            .and_then(|value| value.parse().ok())
            .ok_or(crate::Error::new("SERVICE_READBACK_INCOMPLETE"))?;
        let last_exit = fields
            .get("last exit code")
            .and_then(|value| value.parse().ok());
        result.push(crate::transaction::ComponentImage {
            kind: enrollment.kind,
            loaded: true,
            disabled,
            running,
            process,
            runs,
            last_exit,
        });
    }
    require(
        result
            .iter()
            .map(|component| component.kind)
            .collect::<Vec<_>>()
            == vec![
                NativeKind::Runtime,
                NativeKind::WatchdogW1,
                NativeKind::WatchdogW2,
            ],
        "FIRST_LIVE_SERVICE_GROUP",
    )?;
    Ok(result)
}

#[cfg(test)]
#[path = "../../../test/first_live/native_effects/readonly_probe.rs"]
mod readonly_probe_tests;

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
