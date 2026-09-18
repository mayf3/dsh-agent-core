//! Fixed first-live completion observation, never a receipt issuer.
mod join;
use super::{gate, native};
use crate::{
    error::require,
    fs::{file::sha, secure::Dir, ArtifactStore, MutationGuard},
    model::*,
    queue::Queue,
    registry,
    transaction::Executor,
    trust::{canonical_bytes, digest},
    Result,
};
use serde::Serialize;
const ROOT: &str = "/private/var/db/agent-deployd";
const GOAL: &str = "WORKFLOW_ACTIVE_POOL_DISPOSITION_V1_BROKER_DELIVERY_V2";
const SOURCE: &str = "59472b631129d1ea3ca1202cbcbbc0799b083114";
const ARTIFACT: &str = "165b79833a23f480bd5d265b51377005e2e2526ea1c7dc0aee37fab4ad5c06f1";
const TARGET: &str = "dsh-system-runtime";
const PROFILE: &str = "dsh-app";
#[derive(Serialize)]
#[serde(deny_unknown_fields)]
struct Evidence {
    unit_id: String,
    attempt: u32,
    target_generation: u64,
    service_generation: String,
    installation_binding_digest: String,
    native_observation_digest: String,
    goal_receipt_digest: String,
    registry_ledger_digest: String,
    registry_revision: u64,
    registry_row_revision: u64,
    closure_digest: String,
    outbox_id: String,
    delivered: bool,
}
#[derive(Serialize)]
#[serde(deny_unknown_fields)]
struct Output {
    version: u32,
    state: &'static str,
    reason: Option<&'static str>,
    operation_id: String,
    package_digest: String,
    controller_digest: String,
    configuration_digest: String,
    activation_digest: String,
    enable_result_digest: String,
    goal_id: &'static str,
    source_sha: &'static str,
    artifact_sha256: &'static str,
    target_runtime: &'static str,
    deployment_profile: &'static str,
    business_goal_complete: bool,
    evidence: Option<Evidence>,
}
pub(super) fn run() -> Result<()> {
    native::controller()?;
    let root = Dir::open(std::path::Path::new(ROOT), 0)?;
    let guard = MutationGuard::acquire_readonly(&root)?;
    let binding = native::completion_binding(&root)?;
    let intake = crate::service::Intake::open(std::path::Path::new(ROOT), false)?;
    let registry = registry::readonly::observe(&root, &intake.config.catalog, GOAL)?;
    let queue = Queue::open_existing_readonly(&root, &std::path::Path::new(ROOT).join("queue.db"))?;
    let before = queue.completion_projection(GOAL, TARGET)?;
    let mut physical = serde_json::Value::Null;
    if let (Some(status), Some(goal), Some(_)) = (&before.status, &before.goal, &before.ready) {
        if status.state == State::Applied
            && goal.payload.outcome == GoalOutcome::Pass
            && before.pending == 0
            && before.quarantine == 0
        {
            require(
                status.unit.source_sha == SOURCE
                    && status.unit.artifact_sha256 == ARTIFACT
                    && status.unit.target_runtime == TARGET
                    && status.unit.deployment_profile == PROFILE,
                "COMPLETION_FIXED_TUPLE",
            )?;
            ArtifactStore {
                staging: root.child("staging")?,
                sealed: root.child("sealed")?,
            }
            .open_existing(ARTIFACT, &status.unit.manifest_digest)?;
            let profile = intake
                .config
                .catalog
                .profiles
                .get(PROFILE)
                .ok_or(crate::Error::new("PROFILE_NOT_ALLOWED"))?;
            let mut executor = Executor::production(profile)?;
            physical = executor
                .native_observation(&guard, &queue, &status.unit.deployment_unit_id)?
                .0;
        }
    }
    let reason = join::validate(
        &intake.config.catalog,
        &join::Expected {
            goal: GOAL,
            source: SOURCE,
            artifact: ARTIFACT,
            target: TARGET,
            profile: PROFILE,
        },
        &registry.row,
        &before,
        &physical,
    )?;
    queue.completion_unchanged(GOAL, TARGET, &before)?;
    require(
        native::completion_binding(&root)? == binding,
        "COMPLETION_BINDING_CHANGED",
    )?;
    let evidence = if reason.is_none() {
        let current = before
            .current
            .as_ref()
            .ok_or(crate::Error::new("COMPLETION_EVIDENCE"))?;
        let goal = before
            .goal
            .as_ref()
            .ok_or(crate::Error::new("COMPLETION_EVIDENCE"))?;
        let closure = registry
            .row
            .closure
            .as_ref()
            .ok_or(crate::Error::new("COMPLETION_EVIDENCE"))?;
        let (outbox, delivered) = before
            .outbox
            .as_ref()
            .ok_or(crate::Error::new("COMPLETION_EVIDENCE"))?;
        Some(Evidence {
            unit_id: current.unit_id.clone(),
            attempt: current.attempt,
            target_generation: current.target_generation,
            service_generation: current.service_generation.clone(),
            installation_binding_digest: current.binding_digest.clone(),
            native_observation_digest: digest(&physical)?,
            goal_receipt_digest: digest(goal)?,
            registry_ledger_digest: registry.ledger_digest.clone(),
            registry_revision: registry.ledger_revision,
            registry_row_revision: registry.row.revision,
            closure_digest: digest(closure)?,
            outbox_id: outbox.id.clone(),
            delivered: *delivered,
        })
    } else {
        None
    };
    let output = Output {
        version: 1,
        state: if reason.is_none() {
            "COMPLETE"
        } else {
            "PENDING"
        },
        reason,
        operation_id: binding.operation_id,
        package_digest: binding.package_digest,
        controller_digest: binding.controller_digest,
        configuration_digest: binding.configuration_digest,
        activation_digest: binding.activation_digest,
        enable_result_digest: sha(&gate::raw(
            &root.child("first-live-operation")?,
            "enable-result.json",
        )?),
        goal_id: GOAL,
        source_sha: SOURCE,
        artifact_sha256: ARTIFACT,
        target_runtime: TARGET,
        deployment_profile: PROFILE,
        business_goal_complete: false,
        evidence,
    };
    let raw = canonical_bytes(&output)?;
    require(raw.len() <= 65536, "COMPLETION_OUTPUT_LIMIT")?;
    println!(
        "{}",
        std::str::from_utf8(&raw).map_err(|_| crate::Error::new("COMPLETION_OUTPUT"))?
    );
    Ok(())
}

#[cfg(test)]
mod tests {
    #[test]
    fn ordinary_process_cannot_enter_fixed_root_export() {
        assert!(super::run().is_err());
    }
}
