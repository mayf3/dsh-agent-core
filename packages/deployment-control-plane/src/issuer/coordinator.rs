use super::issuance::{self, Draft, IssueBinding};
pub(crate) use super::issuance_io::immutable;
use super::{
    custody::{load, sign, ROOT},
    github::{self, SourcePolicy},
    review::{NativeReviewRunner, ReviewJob, ReviewPacket, ReviewSourceFile},
    source,
};
use crate::{
    error::require,
    fs::{
        file::snapshot,
        secure::{validate, Dir},
    },
    model::*,
    queue::Queue,
    registry::Registry,
    service::Intake,
    trust::{canonical_bytes, digest, valid_id},
    Error, Result,
};
use serde::{Deserialize, Serialize};
use std::{
    os::{fd::AsRawFd, unix::fs::MetadataExt},
    path::Path,
    time::{SystemTime, UNIX_EPOCH},
};
#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct FreezeRequest {
    pub goal_id: String,
    pub source_sha: String,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SupervisorPolicy {
    pub version: u32,
    pub source: SourcePolicy,
    pub codex_sha256: String,
    pub review_helper_sha256: String,
    pub policy_epoch: u64,
    pub revoked_sources: Vec<String>,
    pub revoked_artifacts: Vec<String>,
}

/// Fixed producer operation, not a root deployment operation. It may publish a
/// reviewed proposal; the existing controller still performs every admission gate.
pub fn prepare_native(goal: &str, source_sha: &str) -> Result<String> {
    require(unsafe { libc::geteuid() } == 0, "ISSUER_REQUIRES_ROOT")?;
    valid_id(goal)?;
    source::source_sha(source_sha)?;
    let root_path = Path::new(ROOT);
    let intake = Intake::open(root_path, false)?;
    let root = &intake.root;
    let lock = root.open_file("issuer.lock", libc::O_RDWR, 0)?;
    validate(&lock, 0, false)?;
    require(lock.metadata()?.mode() & 0o777 == 0o600, "UNSAFE_MODE")?;
    require(
        unsafe { libc::flock(lock.as_raw_fd(), libc::LOCK_EX | libc::LOCK_NB) } == 0,
        "ISSUER_BUSY",
    )?;
    let keys = root.child("issuer-keys")?;
    let registry = Registry::open_native(&intake.config.catalog)?;
    let record = registry.get(goal)?;
    require(
        record
            .enrollment
            .payload
            .frozen_source_sha
            .as_ref()
            .is_none_or(|sha| sha == source_sha),
        "FROZEN_SOURCE_MISMATCH",
    )?;
    require(
        record.state != crate::registry::DeploymentState::Closed,
        "DEPLOYMENT_ALREADY_CLOSED",
    )?;
    let enrollment = &record.enrollment.payload;
    let catalog = &intake.config.catalog;
    let profile = catalog
        .profiles
        .get(&enrollment.deployment_profile)
        .ok_or(Error::new("PROFILE_NOT_ALLOWED"))?;
    require(profile.enabled, "PROFILE_NOT_ALLOWED")?;
    let policy: super::owner_policy::OwnerPolicy = read(root, "issuer-policy.json")?;
    policy.validate()?;
    require(
        !policy.revoked_sources().iter().any(|s| s == source_sha),
        "REVOKED",
    )?;
    // Intake already authenticated this exact enrollment under the protected
    // activation proof. Bind its retained faces/loader identity into every build.
    let native_enrollment: crate::transaction::NativeEnrollment = read(root, "activation.json")?;
    let enrollment_digest = digest(&native_enrollment)?;
    policy.validate_registry(&registry, catalog, &native_enrollment)?;
    let selected = policy.select(&record.enrollment, profile, &native_enrollment)?;
    let prerequisites = registry.resolved_dependencies(goal)?;
    let dependency_closure = source::bound_dependencies(
        &selected.dependency_closure,
        &enrollment_digest,
        policy.helper(),
    )?;
    let actor = intake.actor(502, 20)?;
    let binding = IssueBinding {
        goal_id: goal.into(),
        source_sha: source_sha.into(),
        revision: if record.state == crate::registry::DeploymentState::Ready {
            record
                .revision
                .checked_sub(1)
                .ok_or(Error::new("REGISTRY_CAS"))?
        } else {
            record.revision
        },
        profile_digest: digest(profile)?,
        source_policy_digest: policy.issue_digest(
            &record.enrollment,
            selected,
            &enrollment_digest,
        )?,
    };
    if let Some(draft) = issuance::pending(root, &binding)? {
        issuance::verify_draft_artifact(root, &draft)?;
        let lease = current_policy(root, catalog, &enrollment.deployment_profile)?;
        return issuance::publish(
            root,
            issuance::Publication {
                catalog,
                registry: &registry,
                actor: &actor,
            },
            &draft,
            lease,
            now()?,
            None,
        );
    }
    require(
        record.state == crate::registry::DeploymentState::Pending,
        "REGISTRY_INCOMPLETE",
    )?;
    // Only the daemon's protected, initialized database may supply generation and
    // prerequisite facts. Absence is not a new empty production queue.
    let db = root.open_file("queue.db", libc::O_RDONLY, 0)?;
    validate(&db, 0, false)?;
    let queue = Queue::open(root_path.join("queue.db"))?;
    let dependencies = queue.issuer_dependencies(&prerequisites)?;
    let observed = github::observe(selected, source_sha)?;
    let built = source::build_regular_files(&selected.slots, &observed.files)?;
    require(
        !policy.revoked_artifacts().contains(&built.artifact_digest),
        "REVOKED",
    )?;
    issuance::admit_target(
        root,
        &registry,
        goal,
        &profile.target_runtime,
        &built.artifact_digest,
    )?;
    let packet = ReviewPacket {
        repo: profile.repo.clone(),
        source_sha: observed.source_sha.clone(),
        tree_sha: observed.tree_sha.clone(),
        profile: profile.clone(),
        manifest: built.manifest.clone(),
        accepted_contract: ReviewSourceFile {
            path: selected.accepted_contract_path.clone(),
            content: String::from_utf8(observed.contract)
                .map_err(|_| Error::new("REVIEW_BINARY_SOURCE"))?,
        },
        files: observed
            .files
            .iter()
            .map(|(path, bytes)| {
                Ok(ReviewSourceFile {
                    path: path.clone(),
                    content: String::from_utf8(bytes.clone())
                        .map_err(|_| Error::new("REVIEW_BINARY_SOURCE"))?,
                })
            })
            .collect::<Result<Vec<_>>>()?,
    };
    let packet_bytes = canonical_bytes(&packet)?;
    require(packet_bytes.len() <= 4 * 1024 * 1024, "SIZE_LIMIT")?;
    // Reserve the complete worst-case publication before the first staging write.
    // Count failed jobs/partial files as retained data rather than hiding them.
    let artifact_bytes: u64 = built.blobs.values().map(|b| b.len() as u64).sum();
    issuance::reserve(
        root,
        artifact_bytes + packet_bytes.len() as u64 + 8 * 1024 * 1024 + 4096,
        built.blobs.len() + 8,
    )?;
    let staging = root.child("staging")?.mkdir(&built.artifact_digest)?;
    for (name, bytes) in &built.blobs {
        immutable(&staging, name, bytes)?;
    }
    let input_digest = crate::fs::file::sha(&packet_bytes);
    let job = ReviewJob {
        repo: profile.repo.clone(),
        source_sha: observed.source_sha.clone(),
        tree_sha: observed.tree_sha.clone(),
        artifact_sha256: built.artifact_digest.clone(),
        manifest_digest: digest(&built.manifest)?,
        profile_revision: profile.revision.clone(),
        profile_digest: digest(profile)?,
        scopes: profile.required_review_scopes.clone(),
        semantic_authors: vec!["mayf3".into(), "uid-502".into()],
        semantic_author_uids: vec![502],
        input_digest,
    };
    let jobs = root.child("issuer-jobs")?;
    let job_id = digest(&job)?;
    immutable(&jobs, &format!("{job_id}.json"), &packet_bytes)?;
    let reviewed = NativeReviewRunner::new(policy.codex().to_owned(), policy.helper().to_owned())?
        .run(
            &job,
            &root_path.join("issuer-jobs").join(format!("{job_id}.json")),
        )?;
    let authority = load(&keys, "local-authority", Role::Authority, catalog)?;
    let builder = load(&keys, "local-builder", Role::Builder, catalog)?;
    let reviewer = load(&keys, "local-reviewer", Role::Reviewer, catalog)?;
    let producer = load(&keys, "local-deployment-registry", Role::Producer, catalog)?;
    let coverage = GoalCoverage {
        goal_id: goal.into(),
        acceptance_revision: enrollment.acceptance_revision.clone(),
        source_sha: source_sha.into(),
        release_face_sha256: digest(&built.manifest)?,
        verification_profile: enrollment.verification_profile.clone(),
    };
    let ready = sign(
        "local-deployment-registry",
        &producer,
        ReadyRecord {
            producer_id: "local-deployment-registry".into(),
            goal_id: goal.into(),
            revision: record.revision + 1,
            repo: profile.repo.clone(),
            source_sha: source_sha.into(),
            authority_revisions: vec![
                profile.standing_authority_revision.clone(),
                enrollment.authority.revision.clone(),
            ],
            artifact_sha256: built.artifact_digest.clone(),
            coverage: coverage.clone(),
            dependencies: dependencies.clone(),
        },
    )?;
    let proposal = Proposal {
        request_id: digest(&(goal, source_sha, &job_id))?,
        deployment_profile: enrollment.deployment_profile.clone(),
        goals: vec![ready],
        acceptance: sign(
            "local-authority",
            &authority,
            Acceptance {
                repo: profile.repo.clone(),
                source_sha: source_sha.into(),
                tree_sha: observed.tree_sha.clone(),
                authority_revision: profile.standing_authority_revision.clone(),
                semantic_authors: job.semantic_authors.clone(),
            },
        )?,
        build: sign(
            "local-builder",
            &builder,
            BuildAttestation {
                repo: profile.repo.clone(),
                source_sha: source_sha.into(),
                tree_sha: observed.tree_sha,
                artifact_sha256: built.artifact_digest.clone(),
                manifest_digest: digest(&built.manifest)?,
                profile_revision: profile.revision.clone(),
                recipe: profile.build_recipe.clone(),
                toolchain: profile.toolchain.clone(),
                architecture: profile.architecture.clone(),
                dependency_closure,
                goal_coverage: vec![coverage],
            },
        )?,
        reviews: vec![sign(
            "local-reviewer",
            &reviewer,
            reviewed.review().clone(),
        )?],
        policy: current_policy(root, catalog, &enrollment.deployment_profile)?,
        desired: sign(
            "local-authority",
            &authority,
            queue.issuer_desired(profile, &built.artifact_digest)?,
        )?,
        dependencies,
        supersedes: vec![],
    };
    let draft = Draft {
        binding,
        proposal,
        canonical_lineage_digest: observed.canonical_lineage_digest,
        review_job_digest: reviewed.job_digest().into(),
        review_evidence_digest: reviewed.evidence_digest().into(),
    };
    issuance::save(root, &draft)?;
    let lease = current_policy(root, catalog, &enrollment.deployment_profile)?;
    issuance::publish(
        root,
        issuance::Publication {
            catalog,
            registry: &registry,
            actor: &actor,
        },
        &draft,
        lease,
        now()?,
        None,
    )
}

/// Renews only the current protected Owner policy. No caller assertions or lease
/// timestamps are accepted, and revocations are reread before each issuance.
pub(crate) fn current_policy(
    root: &Dir,
    catalog: &Catalog,
    profile_id: &str,
) -> Result<Signed<Policy>> {
    super::policy::current_native(root, catalog, profile_id)
}

pub(crate) fn read<T: serde::de::DeserializeOwned>(dir: &Dir, name: &str) -> Result<T> {
    let raw = snapshot(
        &dir.open_file(name, libc::O_RDONLY, 0)?,
        dir.uid,
        4 * 1024 * 1024,
    )?
    .bytes;
    crate::service::protocol::depth(&raw, 32)?;
    Ok(serde_json::from_slice(&raw)?)
}
fn now() -> Result<u64> {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|t| t.as_secs())
        .map_err(|_| Error::new("CLOCK"))
}
#[cfg(test)]
#[path = "../../test/issuer/coordinator.rs"]
mod tests;
