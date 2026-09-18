//! Shared supported-driver binding: preparation and native startup use this same mapping.
use crate::{
    error::require,
    model::*,
    service::Configuration,
    transaction::{NativeEnrollment, NativeKind},
    trust::{digest, valid_digest},
    Result,
};
use std::collections::BTreeSet;
pub fn profile_digest(profile: &Profile) -> Result<String> {
    let mut inert = profile.clone();
    inert.enabled = false;
    digest(&inert)
}
pub fn validate_native_binding(
    config: &Configuration,
    enrollment: &NativeEnrollment,
    observed_host: &str,
    active: bool,
) -> Result<()> {
    enrollment.validate()?;
    validate_physical_binding(
        ConfigBindingInput {
            catalog: &config.catalog,
            callers: &config.callers,
            producers: &config.producers,
            verifiers: &config.verifiers,
            socket_gid: config.socket_gid,
        },
        NativeBindingInput {
            host: &enrollment.host,
            caller_uids: &enrollment.caller_uids,
            profile_id: &enrollment.profile_id,
            profile_revision: &enrollment.profile_revision,
            profile_digest: &enrollment.profile_digest,
            services: &enrollment.services,
            required_facets: &enrollment.required_facets,
        },
        observed_host,
        active,
    )?;
    let identities = config
        .callers
        .iter()
        .map(|c| c.uid)
        .chain(enrollment.services.iter().map(|s| s.uid))
        .collect();
    config
        .socket_ancestor
        .as_ref()
        .ok_or(crate::Error::new("SOCKET_ANCESTOR_REQUIRED"))?
        .validate(observed_host, &identities)?;
    valid_digest(&enrollment.lifecycle_denial_digest)
}
pub(crate) struct ConfigBindingInput<'a> {
    pub catalog: &'a Catalog,
    pub callers: &'a Vec<crate::service::Caller>,
    pub producers: &'a Vec<String>,
    pub verifiers: &'a std::collections::BTreeMap<String, crate::service::VerifierBinding>,
    pub socket_gid: u32,
}
pub(crate) struct NativeBindingInput<'a> {
    pub host: &'a String,
    pub caller_uids: &'a Vec<u32>,
    pub profile_id: &'a String,
    pub profile_revision: &'a String,
    pub profile_digest: &'a String,
    pub services: &'a Vec<crate::transaction::ServiceEnrollment>,
    pub required_facets: &'a Vec<String>,
}
pub(crate) fn validate_physical_binding(
    config: ConfigBindingInput<'_>,
    enrollment: NativeBindingInput<'_>,
    observed_host: &str,
    active: bool,
) -> Result<()> {
    valid_digest(observed_host)?;
    require(
        config.catalog.profiles.len() == 1,
        "PHYSICAL_TARGET_OVERLAP",
    )?;
    let profile = config
        .catalog
        .profiles
        .get(enrollment.profile_id)
        .ok_or(crate::Error::new("PROFILE_NOT_ALLOWED"))?;
    require(
        profile.enabled == active
            && profile_digest(profile)? == *enrollment.profile_digest
            && profile.revision == *enrollment.profile_revision,
        "PROFILE_NOT_ALLOWED",
    )?;
    require(
        profile.host == observed_host && enrollment.host.as_str() == observed_host,
        "HOST_BINDING",
    )?;
    require(
        profile.repo == "mayf3/dsh-agent-core"
            && profile.target_runtime == "dsh-system-runtime"
            && profile.install_root_id == "agent-core-app"
            && profile.launchd_domain == "system"
            && profile.launchd_label == "ai.agent-core.runtime"
            && profile.build_recipe == "immutable-regular-app-slots-v1"
            && profile.privileged_apply_profile == "fixed-regular-app-slots-v1"
            && profile.restart_profile == "runtime-w1-w2-system-v1"
            && profile.rollback_profile == "journal-exact-preimage-v1"
            && profile.preflight_policy == "signed-lease-300s-v1"
            && profile.standing_authority_revision == "PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1"
            && profile.architecture == "x86_64"
            && profile.required_review_scopes.contains(&"root-code".into()),
        "DRIVER_BINDING",
    )?;
    require(
        !profile.toolchain.is_empty()
            && !profile.toolchain.starts_with("UNRESOLVED")
            && (1..=300).contains(&profile.policy_lease_seconds)
            && (1..=1000).contains(&profile.actor_quota)
            && (1..=10000).contains(&profile.queue_quota),
        "PROFILE_BOUNDS",
    )?;
    require(
        config.callers.len() <= 256
            && config.socket_gid != 0
            && config.socket_gid != 1
            && !config.producers.is_empty()
            && config.producers.len() <= 256,
        "CONFIG_LIMIT",
    )?;
    for caller in config.callers {
        require(
            caller.gid != 1
                && caller.profiles == [enrollment.profile_id.clone()]
                && !caller.producers.is_empty()
                && caller
                    .producers
                    .iter()
                    .all(|p| config.producers.contains(p)),
            "CALLER_BINDING",
        )?;
    }
    for producer in config.producers {
        require(
            config
                .catalog
                .keys
                .get(producer)
                .is_some_and(|k| k.role == Role::Producer && k.scopes.contains(producer)),
            "PRODUCER_BINDING",
        )?;
    }
    require(
        !profile.verification_profiles.is_empty()
            && profile.goal_verifiers.len() == profile.verification_profiles.len()
            && config.verifiers.len() == profile.verification_profiles.len(),
        "VERIFIER_NOT_CONFIGURED",
    )?;
    for verification in &profile.verification_profiles {
        let issuer = profile
            .goal_verifiers
            .get(verification)
            .ok_or(crate::Error::new("VERIFIER_SCOPE"))?;
        require(
            config.catalog.keys.get(issuer).is_some_and(|k| {
                k.role == Role::Verifier && k.scopes.contains(enrollment.profile_id)
            }),
            "VERIFIER_SCOPE",
        )?;
        match config.verifiers.get(verification) {
            Some(crate::service::VerifierBinding::ExternalObservation { deadline_ms }) => {
                require((1..=2000).contains(deadline_ms), "VERIFIER_DEADLINE")?
            }
            Some(crate::service::VerifierBinding::NativeInstalledReadback { issuer: bound }) => {
                require(bound == issuer, "VERIFIER_SCOPE")?
            }
            None => return Err(crate::Error::new("VERIFIER_NOT_CONFIGURED")),
        }
    }
    let callers = config
        .callers
        .iter()
        .map(|c| c.uid)
        .collect::<BTreeSet<_>>();
    require(
        !callers.is_empty()
            && callers.len() == config.callers.len()
            && callers == enrollment.caller_uids.iter().copied().collect()
            && enrollment.caller_uids.len() == callers.len()
            && !callers.contains(&0),
        "CALLER_BINDING",
    )?;
    for service in enrollment.services {
        require(!callers.contains(&service.uid), "CALLER_SERVICE_OVERLAP")?;
        require(
            match service.kind {
                NativeKind::Runtime | NativeKind::WatchdogW1 => {
                    service.uid == 505 && matches!(service.gid, 20 | 601)
                }
                NativeKind::WatchdogW2 => service.uid == 0 && service.gid == 0,
            },
            "SERVICE_IDENTITY",
        )?;
    }
    require(
        *enrollment.required_facets == ["app-slots", "node-closure", "service-plists"],
        "UNSUPPORTED_REQUIRED_FACET",
    )?;
    Ok(())
}
/// No environment/hostname alias can choose which host owns the physical driver.
pub fn observed_host() -> Result<String> {
    let mut uuid = [0u8; 16];
    let timeout = libc::timespec {
        tv_sec: 2,
        tv_nsec: 0,
    };
    require(
        unsafe { libc::gethostuuid(uuid.as_mut_ptr(), &timeout) } == 0,
        "HOST_OBSERVATION",
    )?;
    let hex = hex::encode(uuid);
    let uuid = format!(
        "{}-{}-{}-{}-{}",
        &hex[..8],
        &hex[8..12],
        &hex[12..16],
        &hex[16..20],
        &hex[20..]
    );
    Ok(crate::fs::file::sha(
        format!("agent-deployd-host-v1\0{uuid}").as_bytes(),
    ))
}

pub fn validate_prepared_manifest(
    enrollment: &NativeEnrollment,
    manifest: &crate::fs::ArtifactManifest,
) -> Result<()> {
    require(
        manifest.version == 1 && !manifest.entries.is_empty() && manifest.entries.len() <= 4096,
        "MANIFEST_LIMIT",
    )?;
    let mut paths = BTreeSet::new();
    let mut total = 0u64;
    for entry in &manifest.entries {
        crate::fs::secure::relative(&entry.path)?;
        crate::fs::secure::component(&entry.blob)?;
        valid_digest(&entry.sha256)?;
        total = total
            .checked_add(entry.size)
            .ok_or(crate::Error::new("SIZE_LIMIT"))?;
        require(
            entry.size <= 64 * 1024 * 1024
                && total <= 64 * 1024 * 1024
                && paths.insert(entry.path.to_ascii_lowercase()),
            "MANIFEST_LIMIT",
        )?;
        let slot = enrollment
            .initial_files
            .iter()
            .find(|s| s.path == entry.path)
            .ok_or(crate::Error::new("UNDECLARED_SLOT"))?;
        require(
            slot.mutable && entry.executable == (slot.mode & 0o111 != 0),
            "SLOT_METADATA",
        )?;
    }
    Ok(())
}
