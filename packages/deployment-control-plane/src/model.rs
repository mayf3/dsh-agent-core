use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

macro_rules! record {
    ($name:ident { $($field:ident : $ty:ty),* $(,)? }) => {
        #[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
        #[serde(deny_unknown_fields)]
        pub struct $name { $(pub $field: $ty),* }
    };
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct Signed<T> {
    pub issuer: String,
    pub payload: T,
    pub signature: String,
}
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Role {
    Authority,
    Builder,
    Reviewer,
    Producer,
    Verifier,
    Recovery,
}
record!(TrustedKey { public_key: String, role: Role, scopes: Vec<String> });
record!(Catalog { revision: String, keys: BTreeMap<String, TrustedKey>, profiles: BTreeMap<String, Profile> });
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum FailurePolicy {
    StopTrain,
    ContinueIndependent,
}
record!(Profile {
    revision: String, repo: String, target_runtime: String, host: String,
    launchd_domain: String, launchd_label: String, install_root_id: String,
    standing_authority_revision: String, build_recipe: String, toolchain: String,
    architecture: String, verification_profiles: Vec<String>, goal_verifiers: BTreeMap<String, String>, required_review_scopes: Vec<String>,
    preflight_policy: String, privileged_apply_profile: String, restart_profile: String,
    rollback_profile: String, failure_policy: FailurePolicy, policy_lease_seconds: u64,
    actor_quota: u32, queue_quota: u32, enabled: bool,
});
record!(GoalCoverage {
    goal_id: String,
    acceptance_revision: String,
    source_sha: String,
    release_face_sha256: String,
    verification_profile: String
});
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum DependencySemantics {
    LiveInstallation,
    HistoricalReceipt,
}
record!(Dependency { unit_id: String, receipt_digest: String, capability: String,
    required_goals: Vec<String>, semantics: DependencySemantics });
record!(ReadyRecord { producer_id: String, goal_id: String, revision: u64, repo: String,
    source_sha: String, authority_revisions: Vec<String>, artifact_sha256: String,
    coverage: GoalCoverage, dependencies: Vec<Dependency> });
record!(ProducerSnapshot { producer_id: String, revision: u64, previous_revision: u64,
    records: Vec<Signed<ReadyRecord>>, watermark: u64 });
record!(Policy { epoch: u64, issued_at: u64, expires_at: u64,
    standing_authority_revision: String, revoked_sources: Vec<String>, revoked_artifacts: Vec<String> });
record!(Acceptance { repo: String, source_sha: String, tree_sha: String,
    authority_revision: String, semantic_authors: Vec<String> });
record!(BuildAttestation { repo: String, source_sha: String, tree_sha: String,
    artifact_sha256: String, manifest_digest: String, profile_revision: String,
    recipe: String, toolchain: String, architecture: String, dependency_closure: Vec<String>,
    goal_coverage: Vec<GoalCoverage> });
record!(Review { repo: String, source_sha: String, artifact_sha256: String,
    manifest_digest: String, profile_revision: String, scopes: Vec<String> });
record!(DesiredState {
    target_runtime: String,
    revision: u64,
    expected_target_generation: u64,
    artifact_sha256: String,
    profile_revision: String
});
record!(Proposal { request_id: String, deployment_profile: String,
    goals: Vec<Signed<ReadyRecord>>, acceptance: Signed<Acceptance>, build: Signed<BuildAttestation>,
    reviews: Vec<Signed<Review>>, policy: Signed<Policy>, desired: Signed<DesiredState>,
    dependencies: Vec<Dependency>, supersedes: Vec<String> });
record!(DeploymentUnit { version: u32, deployment_unit_id: String, deployment_profile: String,
    profile_revision: String, target_runtime: String, repo: String, source_sha: String,
    artifact_sha256: String, build_attestation_digest: String, manifest_digest: String,
    deployment_intent_id: u64, desired_state_revision: u64, expected_target_generation: u64,
    covered_goal_ids: Vec<String>, goal_coverage: Vec<GoalCoverage>, dependency_units: Vec<Dependency>,
    required_reviews: Vec<String>, preflight_policy: String, privileged_apply_profile: String,
    restart_profile: String, verification_profiles: Vec<String>, rollback_profile: String,
    standing_authority_revision: String, policy_epoch: u64, receipts: Vec<String> });
record!(Actor { id: String, allowed_producers: Vec<String>, allowed_profiles: Vec<String> });
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum State {
    Queued,
    Precheck,
    Applying,
    Restarting,
    Verifying,
    Finalizing,
    Applied,
    Blocked,
    RollingBack,
    RolledBack,
    Recovering,
    Quarantined,
    Cancelled,
    Superseded,
}
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum GoalOutcome {
    Pending,
    Pass,
    Fail,
    WaitingExternalAcceptance,
    OutcomeUnknown,
}
record!(UnitStatus {
    unit: DeploymentUnit,
    state: State,
    revision: u64,
    sequence: u64,
    preflight_attempts: u32,
    mutating_attempts: u32
});
record!(Submission {
    unit_id: String,
    attachment_digest: String,
    install_required: bool,
    state: State,
    status_revision: u64
});
record!(TransactionReceipt { unit_id: String, artifact_sha256: String, source_sha: String,
    profile_revision: String, policy_digest: String, review_digests: Vec<String>, caller: String,
    dependency_receipts: Vec<String>, preimage_digest: String, postimage_digest: String,
    old_service_generation: String, new_service_generation: String, target_generation: u64,
    attempt: u32, attachment_digests: Vec<String>, step_results: Vec<String>, rollback_digest: Option<String>, capability: String });
record!(GoalReceipt {
    unit_id: String,
    goal_id: String,
    acceptance_revision: String,
    target_generation: u64,
    attempt: u32,
    service_generation: String,
    attachment_digest: String,
    outcome: GoalOutcome,
    evidence_digest: String,
    revision: u64
});
record!(RecoveryEvidence { unit_id: String, status_revision: u64, failure_cause_digest: String,
    remediation_digest: String, restored_preimage_digest: String, service_readback_digest: String,
    owned_operations_receipt: String, step_dispositions: Vec<StepDisposition>, issued_at: u64 });
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum StepDisposition {
    Absent(String),
    Restored(String),
    Idempotent(String),
    Unknown(String),
}
record!(OutboxEntry {
    id: String,
    goal_id: String,
    producer_id: String,
    expected_producer_revision: u64,
    receipt_digest: String
});
record!(CensusPage { revision: u64, records: Vec<Signed<ReadyRecord>>, next_cursor: Option<String>, exhaustive: bool });

record!(ClosureAcknowledgement {
    outbox_id: String,
    goal_id: String,
    receipt_digest: String,
    previous_revision: u64,
    closed_revision: u64
});

record!(CoverageAttachment {
    digest: String,
    proposal: Proposal
});
