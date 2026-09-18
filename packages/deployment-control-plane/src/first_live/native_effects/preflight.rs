use crate::{error::require, fs::file::sha, Result};
#[cfg(test)]
#[derive(serde::Deserialize)]
#[serde(deny_unknown_fields)]
struct LoginReceipt {
    version: u32,
    manifest_digest: String,
    grant_digest: String,
    original_intent_digest: String,
    state: String,
    original_provider_outcome: String,
    independent_review_pass: bool,
    activation_allowed: bool,
}
#[cfg(test)]
pub(super) fn login(bytes: &[u8], expected: &str) -> Result<()> {
    crate::trust::valid_digest(expected)?;
    require(sha(bytes) == expected, "FIRST_LIVE_LOGIN_BINDING")?;
    let value = crate::verification::documents::strict_json(bytes)?;
    let receipt: LoginReceipt = serde_json::from_value(value)?;
    crate::trust::valid_digest(&receipt.manifest_digest)?;
    crate::trust::valid_digest(&receipt.grant_digest)?;
    require(
        receipt.version == 1
            && receipt.original_intent_digest
                == "3ca4b44d4d3e418ea78df8ad6c0a04b7a650e0006c807ffd9f96441b0d10abc6"
            && receipt.state == "SEPARATE_LOGIN_COMMAND_COMPLETED_SAFE_LOCAL_AUTH_METADATA"
            && receipt.original_provider_outcome == "UNKNOWN_RETAINED"
            && !receipt.independent_review_pass
            && !receipt.activation_allowed,
        "FIRST_LIVE_LOGIN_REQUIRED",
    )
}
#[cfg(test)]
#[path = "../../../test/first_live/native_effects/preflight.rs"]
mod tests;
pub(super) fn original_registry(root: &crate::fs::secure::Dir, expected: &str) -> Result<()> {
    let registry = root.child("registry")?;
    require(
        registry.names_bounded(3)? == ["registry.lock", "state-00000000000000000001.json"],
        "FIRST_LIVE_REGISTRY_HISTORY",
    )?;
    crate::trust::valid_digest(expected)?;
    require(
        sha(&super::super::files::raw(
            &registry,
            "state-00000000000000000001.json",
        )?) == expected,
        "FIRST_LIVE_REGISTRY_BINDING",
    )
}
pub(super) struct Prepared {
    pub root: crate::fs::secure::Dir,
    pub packet_dir: crate::fs::secure::Dir,
    pub packet: super::super::packet::Packet,
    pub grant: super::super::gate::Grant,
}
pub(super) fn prepare() -> Result<Prepared> {
    use super::super::{files, gate, materialize, packet::Packet};
    use crate::fs::{file::snapshot, secure::Dir};
    use std::{os::unix::fs::MetadataExt, path::Path};
    require(unsafe { libc::geteuid() } == 0, "FIRST_LIVE_REQUIRES_ROOT")?;
    super::host::implementation_ready()?;
    let executable = "/usr/local/libexec/agent-deployd/agent-deployd";
    require(
        std::env::current_exe()? == Path::new(executable),
        "FIRST_LIVE_FIXED_EXECUTABLE",
    )?;
    let binary_dir = Dir::open(Path::new("/usr/local/libexec/agent-deployd"), 0)?;
    let binary = binary_dir.open_file("agent-deployd", libc::O_RDONLY, 0)?;
    require(
        binary.metadata()?.mode() & 0o7777 == 0o555,
        "FIRST_LIVE_EXECUTABLE_MODE",
    )?;
    let actual_binary = sha(&snapshot(&binary, 0, 128 * 1024 * 1024)?.bytes);
    let packet_dir = Dir::open(Path::new("/private/var/db/agent-deploy-first-live"), 0)?;
    require(
        packet_dir.file.metadata()?.mode() & 0o7777 == 0o700,
        "FIRST_LIVE_PACKET_MODE",
    )?;
    let packet_raw = files::raw(&packet_dir, "packet.json")?;
    let packet: Packet =
        serde_json::from_value(crate::verification::documents::strict_json(&packet_raw)?)?;
    let grant_file = packet_dir.open_file("owner-grant.json", libc::O_RDONLY, 0)?;
    require(
        grant_file.metadata()?.mode() & 0o7777 == 0o600,
        "FIRST_LIVE_OWNER_GRANT_MODE",
    )?;
    let grant: gate::Grant = serde_json::from_value(crate::verification::documents::strict_json(
        &snapshot(&grant_file, 0, 65536)?.bytes,
    )?)?;
    let mut expected = grant.clone();
    expected.operation_id = packet.operation_id.clone();
    expected.host = crate::bootstrap::observed_host()?;
    expected.packet_sha256 = sha(&packet_raw);
    expected.controller_sha256 = actual_binary;
    expected.source_sha = packet.source_sha.clone();
    expected.review_sha256 = packet.review_sha256.clone();
    gate::validate(&grant, &expected, super::super::compose::now()?)?;
    require(
        packet.host == grant.host && packet.controller_sha256 == grant.controller_sha256,
        "FIRST_LIVE_PACKET_BINDING",
    )?;
    materialize::validate(&packet)?;
    physical_socket(&packet)?;
    let root = Dir::open(Path::new(crate::issuer::custody::ROOT), 0)?;
    require(
        root.file.metadata()?.mode() & 0o7777 == 0o700,
        "FIRST_LIVE_STATE_MODE",
    )?;
    for (name, expected) in [
        ("service.json", &packet.previous.service_sha256),
        ("issuer-policy.json", &packet.previous.issuer_policy_sha256),
        ("local-trust.json", &packet.previous.trust_sha256),
    ] {
        crate::trust::valid_digest(expected)?;
        require(
            sha(&files::raw(&root, name)?) == *expected,
            "FIRST_LIVE_ORIGINAL_BINDING",
        )?;
    }
    original_registry(&root, &packet.previous.registry_sha256)?;
    let attempt = Dir::open(
        Path::new("/private/var/db/agent-deploy-bootstrap/genesis-65559dd-20260918-01"),
        0,
    )?;
    installation(&attempt, &packet.previous.installation_receipt_sha256)?;
    absent_issuer_bindings(&root)?;
    original_unknown(&attempt)?;
    for name in [
        "queue.db",
        "queue.db-wal",
        "queue.db-shm",
        "queue.db-journal",
        "activation.json",
        "daemon-activation.json",
        "first-live-pending.json",
        "first-live-materialization.json",
        "watchdog-observer-policy.json",
        "first-live-operation",
        "adoptions",
        "adoption-authorizations",
    ] {
        files::absent(&root, name)?;
    }
    empty_state(&root)?;
    Ok(Prepared {
        root,
        packet_dir,
        packet,
        grant,
    })
}

pub(super) fn installation(attempt: &crate::fs::secure::Dir, expected: &str) -> Result<()> {
    require(
        sha(&super::super::files::raw(
            &attempt.child("steps")?,
            "installation.json",
        )?) == expected,
        "FIRST_LIVE_INSTALLATION_RECEIPT",
    )
}
pub(super) fn absent_issuer_bindings(root: &crate::fs::secure::Dir) -> Result<()> {
    super::super::files::absent(root, "issuer-bindings.json")
}

pub(super) fn physical_socket(p: &super::super::packet::Packet) -> Result<()> {
    let ids = p
        .configuration
        .callers
        .iter()
        .map(|c| c.uid)
        .chain(p.native_enrollment.services.iter().map(|s| s.uid))
        .collect();
    p.configuration
        .socket_ancestor
        .as_ref()
        .ok_or(crate::Error::new("SOCKET_ANCESTOR_REQUIRED"))?
        .preflight(p.configuration.socket_gid, &ids)?;
    for (uid, expected) in [
        (502, &p.lifecycle.caller_groups),
        (505, &p.lifecycle.runtime_groups),
    ] {
        let actual = crate::bootstrap::socket::groups(uid)?;
        let mut expected = expected.clone();
        expected.sort();
        expected.dedup();
        require(
            actual == expected && !actual.contains(&0) && actual.len() <= 32,
            "FIRST_LIVE_GROUP_DRIFT",
        )?;
    }
    Ok(())
}

pub(super) fn empty_state(root: &crate::fs::secure::Dir) -> Result<()> {
    let intake = root.child("intake")?;
    let names = [
        "acks",
        "policies",
        "proposals",
        "recovery",
        "results",
        "snapshots",
    ];
    require(intake.names_bounded(7)? == names, "FIRST_LIVE_INTAKE_SHAPE")?;
    for name in names {
        require(
            intake.child(name)?.names_bounded(1)?.is_empty(),
            "FIRST_LIVE_EXISTING_STATE",
        )?;
    }
    for name in [
        "issuer-jobs",
        "staging",
        "sealed",
        "transactions",
        "recovery-requests",
        "admitted",
        "requests",
        "closure",
    ] {
        require(
            root.child(name)?.names_bounded(1)?.is_empty(),
            "FIRST_LIVE_EXISTING_STATE",
        )?;
    }
    Ok(())
}

fn original_unknown(attempt: &crate::fs::secure::Dir) -> Result<()> {
    require(
        sha(&super::super::files::raw(attempt, "login-intent.json")?)
            == "3ca4b44d4d3e418ea78df8ad6c0a04b7a650e0006c807ffd9f96441b0d10abc6",
        "FIRST_LIVE_ORIGINAL_LOGIN_INTENT",
    )?;
    for name in [
        "login-result.json",
        "login-reconciliation-intent.json",
        "login-reconciliation-result.json",
        "login-reconciliation-failure.json",
        "rollback-intent.json",
        "rollback-result.json",
        "failure.json",
    ] {
        super::super::files::absent(attempt, name)?;
    }
    Ok(())
}
