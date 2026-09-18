//! Only two fixed Authority enrollments; genuine issuer/verifier roles stay separate.
use super::{
    files,
    packet::{BoundPacket, Packet},
};
use crate::{
    error::require,
    fs::secure::Dir,
    issuer::{custody, owner_policy::OwnerPolicy},
    model::*,
    registry::{DeploymentChild, DeploymentState, Registry},
    service::{Activation, Intake},
    transaction::Executor,
    trust::{canonical_bytes, digest},
    verification::native::ObservationPolicy,
    Result,
};
use std::collections::BTreeMap;
pub(super) const WATCHDOG: &str = "DCP_DSH_WATCHDOG_ACCEPTANCE_V1";
pub(super) const BROKER: &str = "WORKFLOW_ACTIVE_POOL_DISPOSITION_V1_BROKER_DELIVERY_V2";
pub(super) fn validate(p: &Packet) -> Result<()> {
    p.canary_plan.validate()?;
    super::retirement::validate_set(&p.lifecycle.legacy_sha256)?;
    require(
        p.lifecycle.node_payloads.get("bin/node") == Some(&p.native_enrollment.node_sha256)
            && p.lifecycle.tool_sha256.get("/bin/launchctl")
                == Some(&p.native_enrollment.launchctl_sha256),
        "FIRST_LIVE_TOOL_BINDING",
    )?;
    require(
        p.version == 1 && p.configuration.first_target_adoption.as_deref() == Some(&p.operation_id),
        "FIRST_LIVE_FENCE",
    )?;
    require(
        p.configuration.catalog.profiles.len() == 1
            && p.configuration.catalog.profiles.contains_key("dsh-app"),
        "FIRST_LIVE_PROFILE",
    )?;
    require(
        p.watchdog.goal_id == WATCHDOG
            && p.broker.goal_id == BROKER
            && p.watchdog.business_goal_id
                == "SCHEDULER_WATCHDOG_ROUTING_AND_STUCK_OCCURRENCE_RECOVERY_V1"
            && p.watchdog.frozen_source_sha.as_deref()
                == Some("d602b592fad345fb1c9adebe2bc6611a6f5cfdc2")
            && p.broker.frozen_source_sha.as_deref()
                == Some("59472b631129d1ea3ca1202cbcbbc0799b083114"),
        "FIRST_LIVE_GOALS",
    )?;
    for enrollment in [&p.watchdog, &p.broker] {
        require(
            enrollment.owner == "mayf3"
                && enrollment.producer_id == "local-deployment-registry"
                && enrollment.deployment_profile == "dsh-app",
            "FIRST_LIVE_ENROLLMENT",
        )?;
    }
    require(
        p.broker.prior_dependencies.len() == 1
            && p.broker.prior_dependencies[0].goal_id == p.watchdog.business_goal_id
            && p.broker.prior_dependencies[0].deployment_child.is_none(),
        "FIRST_LIVE_DEPENDENCY",
    )?;
    p.watchdog_source.validate()?;
    p.broker_source.validate()?;
    require(
        p.release.goal_id == WATCHDOG
            && p.release.source_sha == p.watchdog.frozen_source_sha.clone().unwrap()
            && p.health_max_age_ms > 0
            && p.heartbeat_max_age_ms > 0,
        "FIRST_LIVE_RELEASE",
    )?;
    p.native_enrollment.maintenance()?;
    let c = &p.configuration;
    let e = &p.native_enrollment;
    crate::bootstrap::validate_physical_binding(
        crate::bootstrap::ConfigBindingInput {
            catalog: &c.catalog,
            callers: &c.callers,
            producers: &c.producers,
            verifiers: &c.verifiers,
            socket_gid: c.socket_gid,
        },
        crate::bootstrap::NativeBindingInput {
            host: &e.host,
            caller_uids: &e.caller_uids,
            profile_id: &e.profile_id,
            profile_revision: &e.profile_revision,
            profile_digest: &e.profile_digest,
            services: &e.services,
            required_facets: &e.required_facets,
        },
        &p.host,
        true,
    )?;
    let ids = c
        .callers
        .iter()
        .map(|v| v.uid)
        .chain(e.services.iter().map(|v| v.uid))
        .collect();
    c.socket_ancestor
        .as_ref()
        .ok_or(crate::Error::new("SOCKET_ANCESTOR_REQUIRED"))?
        .validate(&p.host, &ids)
}
pub(super) fn publish_configuration(root: &Dir, history: &Dir, p: &BoundPacket<'_>) -> Result<()> {
    validate(p)?;
    let trust: Catalog = files::read(root, "local-trust.json")?;
    require(
        digest(&trust.keys)? == digest(&p.configuration.catalog.keys)?,
        "FIRST_LIVE_KEYS",
    )?;
    files::absent(root, "activation.json")?;
    files::absent(root, "daemon-activation.json")?;
    // Pending fence is durable before native enrollment or any usable activation proof.
    files::replace(
        root,
        history,
        "service.json",
        &p.previous.service_sha256,
        &p.configuration,
    )?;
    files::publish(root, "activation.json", &p.native_enrollment)
}
pub(super) fn publish(
    root: &Dir,
    history: &Dir,
    p: &BoundPacket<'_>,
    executor: &mut Executor,
    guard: &crate::fs::MutationGuard,
    external: &super::gate::Grant,
    now: u64,
) -> Result<Signed<AdoptionGrant>> {
    guard.binds(root)?;
    validate(p)?;
    super::gate::validate(external, external, now)?;
    let package = &external.packet_sha256;
    let expires = external.expires_at;
    let c = &p.configuration.catalog;
    let key = custody::load(
        &root.child("issuer-keys")?,
        "local-authority",
        Role::Authority,
        c,
    )?;
    let registry = Registry::open_local_root(root, c)?;
    archive_registry(root, history, &p.previous.registry_sha256)?;
    let watchdog = custody::sign("local-authority", &key, p.watchdog.clone())?;
    let wd = registry.enroll(&watchdog)?;
    let mut broker = p.broker.clone();
    broker.prior_dependencies[0].deployment_child = Some(DeploymentChild {
        goal_id: WATCHDOG.into(),
        enrollment_digest: digest(&watchdog)?,
    });
    let broker = custody::sign("local-authority", &key, broker)?;
    let br = registry.enroll(&broker)?;
    for r in [&wd, &br] {
        require(
            r.state == DeploymentState::Pending
                && !r.business_goal_complete
                && r.ready.is_none()
                && r.proposal_digest.is_none()
                && r.closure.is_none(),
            "FIRST_LIVE_PENDING",
        )?;
    }
    let mut sources = BTreeMap::new();
    sources.insert(
        WATCHDOG,
        serde_json::json!({"enrollment_digest":digest(&watchdog)?,"source":p.watchdog_source}),
    );
    sources.insert(
        BROKER,
        serde_json::json!({"enrollment_digest":digest(&broker)?,"source":p.broker_source}),
    );
    let policy: OwnerPolicy = serde_json::from_value(
        serde_json::json!({"version":2,"sources_by_goal":sources,"codex_sha256":p.codex_sha256,"review_helper_sha256":p.review_helper_sha256,"policy_epoch":p.policy_epoch,"revoked_sources":[],"revoked_artifacts":[]}),
    )?;
    policy.validate()?;
    files::replace(
        root,
        history,
        "issuer-policy.json",
        &p.previous.issuer_policy_sha256,
        &policy,
    )?;
    let observed = executor.initial_native_observation(guard)?;
    let runtime = p
        .native_enrollment
        .services
        .iter()
        .find(|s| s.kind == crate::transaction::NativeKind::Runtime)
        .ok_or(crate::Error::new("SERVICE_IDENTITY"))?;
    let observer = custody::sign(
        "local-authority",
        &key,
        ObservationPolicy {
            version: 1,
            profile_id: "dsh-app".into(),
            enrollment_digest: observed.enrollment_digest.clone(),
            runtime_uid: runtime.uid,
            runtime_gid: runtime.gid,
            incident_gid: 20,
            health_max_age_ms: p.health_max_age_ms,
            heartbeat_max_age_ms: p.heartbeat_max_age_ms,
        },
    )?;
    let grant = custody::sign(
        "local-authority",
        &key,
        AdoptionGrant {
            version: 1,
            operation_id: p.operation_id.clone(),
            package_digest: package.clone(),
            controller_sha256: p.controller_sha256.clone(),
            host: p.host.clone(),
            profile_id: "dsh-app".into(),
            profile_digest: crate::bootstrap::profile_digest(&c.profiles["dsh-app"])?,
            enrollment_digest: observed.enrollment_digest,
            configuration_digest: digest(&p.configuration)?,
            issuer_bindings_digest: digest(&p.issuer_bindings)?,
            owner_acceptance_digest: p.owner_acceptance_digest.clone(),
            lifecycle_evidence_digest: p.native_enrollment.lifecycle_denial_digest.clone(),
            initial_face_digest: observed.complete_face_digest,
            service_generation: observed.service_generation,
            release: p.release.clone(),
            canary_plan_digest: crate::fs::file::sha(p.canary_plan_raw.as_bytes()),
            observation_policy_digest: digest(&observer)?,
            issued_at: now,
            expires_at: expires,
        },
    )?;
    files::publish(root, "issuer-bindings.json", &p.issuer_bindings)?;
    files::publish(root, "watchdog-observer-policy.json", &observer)?;
    files::publish(
        &root.mkdir("adoption-authorizations")?,
        &format!("{}.json", digest(&grant)?),
        &grant,
    )?;
    let activation = custody::sign(
        "local-authority",
        &key,
        Activation {
            epoch: p.policy_epoch,
            configuration_digest: grant.payload.configuration_digest.clone(),
            enrollment_digest: grant.payload.enrollment_digest.clone(),
            owner_acceptance_digest: p.owner_acceptance_digest.clone(),
            issuer_bindings_digest: grant.payload.issuer_bindings_digest.clone(),
        },
    )?;
    files::publish(root, "daemon-activation.json", &activation)?;
    let receipt = FirstLiveMaterializationReceipt {
        version: 1,
        package_digest: package.clone(),
        controller_sha256: p.controller_sha256.clone(),
        configuration_digest: grant.payload.configuration_digest.clone(),
        enrollment_digest: grant.payload.enrollment_digest.clone(),
        issuer_bindings_digest: grant.payload.issuer_bindings_digest.clone(),
        adoption_grant_digest: digest(&grant)?,
        owner_acceptance_digest: p.owner_acceptance_digest.clone(),
        lifecycle_evidence_digest: p.native_enrollment.lifecycle_denial_digest.clone(),
    };
    files::publish(root, "first-live-materialization.json", &receipt)?;
    require(
        canonical_bytes(&files::read::<FirstLiveMaterializationReceipt>(
            root,
            "first-live-materialization.json",
        )?)? == canonical_bytes(&receipt)?,
        "FIRST_LIVE_READBACK",
    )?;
    require(
        crate::fs::file::sha(&files::raw(
            &root.child("registry")?,
            "state-00000000000000000001.json",
        )?) == p.previous.registry_sha256,
        "FIRST_LIVE_ORIGINAL_REGISTRY_CHANGED",
    )?;
    Ok(grant)
}
pub(super) fn standing(
    intake: &Intake,
    q: &crate::queue::Queue,
    executor: &mut Executor,
    guard: &crate::fs::MutationGuard,
    g: &Signed<AdoptionGrant>,
    now: u64,
    expires: u64,
) -> Result<String> {
    let inputs = crate::service::adoption::activation_inputs(intake, q, executor, guard, g)?;
    let key = custody::load(
        &intake.root.child("issuer-keys")?,
        "local-authority",
        Role::Authority,
        &intake.config.catalog,
    )?;
    let activation = custody::sign(
        "local-authority",
        &key,
        StandingActivationGrant {
            version: 1,
            adoption_grant_digest: digest(g)?,
            baseline_receipt_digest: inputs.baseline_receipt_digest,
            canary_plan_digest: g.payload.canary_plan_digest.clone(),
            owner_acceptance_digest: g.payload.owner_acceptance_digest.clone(),
            issued_at: now,
            expires_at: expires,
        },
    )?;
    files::publish(
        &intake.root.child("adoption-authorizations")?,
        &format!("{}.json", digest(&activation)?),
        &activation,
    )?;
    let goal = q
        .daemon_goal(&inputs.current.unit_id, WATCHDOG)?
        .ok_or(crate::Error::new("ACTIVATION_CANARY"))?;
    executor.complete_adoption_activation(
        guard,
        q,
        &intake.config.catalog,
        g,
        &activation,
        inputs.canary,
        &goal,
        now,
    )
}
pub(super) fn archive_registry(root: &Dir, history: &Dir, expected: &str) -> Result<()> {
    use std::os::unix::fs::MetadataExt;
    let raw = files::raw(&root.child("registry")?, "state-00000000000000000001.json")?;
    require(
        crate::fs::file::sha(&raw) == expected,
        "FIRST_LIVE_REGISTRY_BINDING",
    )?;
    crate::fs::file::write_new(
        history,
        "registry-before-materialization.json",
        &raw,
        history.uid,
        history.file.metadata()?.gid(),
        0o400,
    )?;
    Ok(())
}
