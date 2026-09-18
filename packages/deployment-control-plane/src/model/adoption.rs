use super::*;
use crate::trust::Signable;
#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize, PartialEq, Eq)]
pub enum InstallationOrigin {
    #[default]
    MutationTransaction,
    ObservedExistingInstallation,
}
impl InstallationOrigin {
    pub fn legacy(&self) -> bool {
        *self == Self::MutationTransaction
    }
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct AdoptionRelease {
    pub goal_id: String,
    pub acceptance_revision: String,
    pub source_sha: String,
    pub artifact_sha256: String,
    pub manifest_digest: String,
}
impl AdoptionRelease {
    pub(crate) fn matches(&self, p: &Proposal) -> bool {
        p.goals.len() == 1
            && p.goals[0].payload.goal_id == self.goal_id
            && p.goals[0].payload.coverage.acceptance_revision == self.acceptance_revision
            && p.build.payload.source_sha == self.source_sha
            && p.build.payload.artifact_sha256 == self.artifact_sha256
            && p.build.payload.manifest_digest == self.manifest_digest
    }
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct AdoptionGrant {
    pub version: u32,
    pub operation_id: String,
    pub package_digest: String,
    pub controller_sha256: String,
    pub host: String,
    pub profile_id: String,
    pub profile_digest: String,
    pub enrollment_digest: String,
    pub configuration_digest: String,
    pub issuer_bindings_digest: String,
    pub owner_acceptance_digest: String,
    pub lifecycle_evidence_digest: String,
    pub initial_face_digest: String,
    pub service_generation: String,
    pub release: AdoptionRelease,
    pub canary_plan_digest: String,
    pub observation_policy_digest: String,
    pub issued_at: u64,
    pub expires_at: u64,
}
impl Signable for AdoptionGrant {
    const DOMAIN: &'static str = "FirstTargetAdoption";
    const ROLE: Role = Role::Authority;
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct AdoptedBaselineReceipt {
    pub version: u32,
    pub origin: InstallationOrigin,
    pub operation_id: String,
    pub grant_digest: String,
    pub unit_id: String,
    pub target_runtime: String,
    pub target_generation: u64,
    pub attempt: u32,
    pub artifact_sha256: String,
    pub manifest_digest: String,
    pub source_sha: String,
    pub profile_revision: String,
    pub build_attestation_digest: String,
    pub enrollment_digest: String,
    pub policy_digest: String,
    pub review_digests: Vec<String>,
    pub attachment_digests: Vec<String>,
    pub dependency_receipts: Vec<String>,
    pub caller: String,
    pub complete_face_digest: String,
    pub service_generation: String,
    pub capability: String,
    pub install_count: u32,
    pub restart_count: u32,
    pub step_results: Vec<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct StandingActivationGrant {
    pub version: u32,
    pub adoption_grant_digest: String,
    pub baseline_receipt_digest: String,
    pub canary_plan_digest: String,
    pub owner_acceptance_digest: String,
    pub issued_at: u64,
    pub expires_at: u64,
}
impl Signable for StandingActivationGrant {
    const DOMAIN: &'static str = "FirstTargetStandingActivation";
    const ROLE: Role = Role::Authority;
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct StandingActivationReceipt {
    pub version: u32,
    pub grant_digest: String,
    pub adoption_grant_digest: String,
    pub unit_id: String,
    pub current: CurrentInstallation,
    pub goal_receipt_digest: String,
    pub canary_evidence_digest: String,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct FirstLiveMaterializationReceipt {
    pub version: u32,
    pub package_digest: String,
    pub controller_sha256: String,
    pub configuration_digest: String,
    pub enrollment_digest: String,
    pub issuer_bindings_digest: String,
    pub adoption_grant_digest: String,
    pub owner_acceptance_digest: String,
    pub lifecycle_evidence_digest: String,
}
