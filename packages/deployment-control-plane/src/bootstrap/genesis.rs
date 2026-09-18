//! Nonprivileged integrity verification of future genesis operations. This path
//! never signs, generates keys, installs, logs in, runs a child, or observes root state.
use super::{genesis_policy::*, genesis_types::*};
use crate::{
    error::require,
    fs::{file::sha, secure::relative},
    trust::{digest, valid_digest},
    Result,
};
use std::collections::{BTreeMap, BTreeSet};

/// Pure structural validation is reusable by a separately authorized future runner.
/// A matching digest says which bytes were reviewed, not who reviewed them or PASS.
pub fn validate_genesis_plan(plan: &GenesisPlan, pins: &GenesisPins) -> Result<()> {
    for hash in [
        &pins.plan_digest,
        &pins.package_digest,
        &pins.source_digest,
        &pins.review_record_digest,
        &pins.initial_registry_digest,
        &pins.supervisor_policy_digest,
        &plan.package_digest,
        &plan.source_digest,
        &plan.review_record_digest,
        &plan.initial_registry_digest,
        &plan.supervisor_policy_digest,
    ] {
        valid_digest(hash)?;
    }
    require(
        digest(plan)? == pins.plan_digest
            && plan.package_digest == pins.package_digest
            && plan.source_digest == pins.source_digest
            && plan.review_record_digest == pins.review_record_digest
            && plan.initial_registry_digest == pins.initial_registry_digest
            && plan.supervisor_policy_digest == pins.supervisor_policy_digest,
        "GENESIS_INDEPENDENT_PIN",
    )?;
    require(
        plan.version == 1 && plan.accepted_authority == GENESIS_AUTHORITY,
        "GENESIS_AUTHORITY",
    )?;
    for reference in [&plan.source_revision, &plan.source_tree] {
        require(
            reference.len() == 40
                && reference
                    .bytes()
                    .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b)),
            "GENESIS_SOURCE_REFERENCE",
        )?;
    }
    require(
        !plan.source_files.is_empty() && plan.source_files.len() <= 4096,
        "GENESIS_SOURCE_CLOSURE",
    )?;
    for (path, hash) in &plan.source_files {
        relative(path)?;
        valid_digest(hash)?;
    }
    require(
        digest(&plan.source_files)? == plan.source_digest,
        "GENESIS_SOURCE_DIGEST",
    )?;
    require(
        plan.executables
            .keys()
            .map(String::as_str)
            .collect::<BTreeSet<_>>()
            == GENESIS_EXECUTABLES.iter().copied().collect(),
        "GENESIS_EXECUTABLE_CLOSURE",
    )?;
    for hash in plan.executables.values() {
        valid_digest(hash)?;
    }
    require(
        plan.support_files
            .keys()
            .map(String::as_str)
            .collect::<BTreeSet<_>>()
            == GENESIS_SUPPORT_FILES.iter().copied().collect(),
        "GENESIS_SUPPORT_CLOSURE",
    )?;
    for hash in plan.support_files.values() {
        valid_digest(hash)?;
    }
    require(
        !plan.profile_enabled && !plan.activation_requested,
        "GENESIS_MUST_REMAIN_DISABLED",
    )?;
    require(plan.paths == genesis_paths(), "GENESIS_FIXED_PATHS")?;
    require(
        plan.identities == genesis_identities(),
        "GENESIS_ISOLATED_IDENTITIES",
    )?;
    require(plan.roles == genesis_roles(), "GENESIS_ROLE_CUSTODY")?;
    let owner = &plan.owner_authorization;
    require(
        owner.owner == "mayf3"
            && owner.attempt_limit == 1
            && (1..=3600).contains(&owner.validity_seconds),
        "GENESIS_EXTERNAL_OWNER_REQUIRED",
    )?;
    require(
        plan.operations == GenesisOperation::REQUIRED,
        "GENESIS_OPERATIONS",
    )?;
    require(
        plan.abort_conditions == GenesisAbort::REQUIRED,
        "GENESIS_ABORT_CONDITIONS",
    )?;
    require(
        plan.rollback == GenesisRollback::REQUIRED,
        "GENESIS_ROLLBACK",
    )?;
    require(
        plan.future_outputs == GenesisFutureOutput::REQUIRED,
        "GENESIS_FUTURE_OUTPUTS",
    )?;
    require(
        plan.required_review_scopes == GenesisReviewScope::REQUIRED,
        "GENESIS_REVIEW_SCOPES",
    )
}

/// Rehash every frozen artifact against independently supplied anchors. The review
/// record is intentionally opaque: matching it does not authenticate a reviewer or
/// infer PASS. That external review and exact Owner authorization are separate gates.
pub fn verify_genesis_artifacts(
    plan: &GenesisPlan,
    pins: &GenesisPins,
    artifacts: &GenesisArtifacts,
) -> Result<GenesisReadiness> {
    require(unsafe { libc::geteuid() } != 0, "PREPARATION_REFUSES_ROOT")?;
    verify_genesis_artifact_bytes(plan, pins, artifacts)
}
pub(crate) fn verify_genesis_artifact_bytes(
    plan: &GenesisPlan,
    pins: &GenesisPins,
    artifacts: &GenesisArtifacts,
) -> Result<GenesisReadiness> {
    validate_genesis_plan(plan, pins)?;
    for (bytes, hash) in [
        (&artifacts.package_manifest, &plan.package_digest),
        (&artifacts.review_record, &plan.review_record_digest),
        (&artifacts.initial_registry, &plan.initial_registry_digest),
        (&artifacts.supervisor_policy, &plan.supervisor_policy_digest),
    ] {
        require(
            !bytes.is_empty() && bytes.len() <= 16 * 1024 * 1024 && sha(bytes) == *hash,
            "GENESIS_ARTIFACT_DIGEST",
        )?;
    }
    crate::service::protocol::depth(&artifacts.package_manifest, 8)?;
    let package: GenesisPackageManifest = serde_json::from_slice(&artifacts.package_manifest)?;
    require(
        package
            == GenesisPackageManifest {
                version: 1,
                source_revision: plan.source_revision.clone(),
                source_tree: plan.source_tree.clone(),
                source_files: plan.source_files.clone(),
                executables: plan.executables.clone(),
                support_files: plan.support_files.clone(),
                initial_registry_digest: plan.initial_registry_digest.clone(),
                supervisor_policy_digest: plan.supervisor_policy_digest.clone(),
            },
        "GENESIS_PACKAGE_BINDING",
    )?;
    verify_files(
        &artifacts.sources,
        &plan.source_files,
        16 * 1024 * 1024,
        256 * 1024 * 1024,
    )?;
    verify_files(
        &artifacts.executables,
        &plan.executables,
        512 * 1024 * 1024,
        1024 * 1024 * 1024,
    )?;
    verify_files(
        &artifacts.support_files,
        &plan.support_files,
        1024 * 1024,
        1024 * 1024,
    )?;
    Ok(GenesisReadiness {
        plan_ready: true,
        artifact_integrity_verified: true,
        bootstrap_allowed: false,
        activation_allowed: false,
        protected_poststate_verified: false,
        independent_review_result_verified: false,
        plan_digest: pins.plan_digest.clone(),
    })
}

fn verify_files(
    actual: &BTreeMap<String, Vec<u8>>,
    expected: &BTreeMap<String, String>,
    file_limit: usize,
    total_limit: usize,
) -> Result<()> {
    require(actual.len() == expected.len(), "GENESIS_ARTIFACT_INVENTORY")?;
    let mut total = 0usize;
    for (path, bytes) in actual {
        total = total
            .checked_add(bytes.len())
            .ok_or(crate::Error::new("GENESIS_ARTIFACT_LIMIT"))?;
        require(
            bytes.len() <= file_limit && total <= total_limit,
            "GENESIS_ARTIFACT_LIMIT",
        )?;
        require(
            expected.get(path) == Some(&sha(bytes)),
            "GENESIS_ARTIFACT_DIGEST",
        )?;
    }
    Ok(())
}
