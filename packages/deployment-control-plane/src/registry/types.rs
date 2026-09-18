use crate::{model::*, trust::Signable};
use serde::{Deserialize, Serialize};
macro_rules! record {
    ($name:ident { $($field:ident : $ty:ty),* $(,)? }) => {
        #[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
        #[serde(deny_unknown_fields)]
        pub struct $name { $(pub $field: $ty),* }
    };
}
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum DeploymentScope {
    DeploymentOnly,
}
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum DeploymentState {
    Pending,
    Ready,
    Closed,
}
record!(EvidenceReference {
    uri: String,
    sha256: String
});
record!(ContractBinding {
    id: String,
    source: EvidenceReference
});
record!(AuthorityBinding { revision: String, semantic_head: String, lifecycle_head: String,
    source: EvidenceReference, acceptance: EvidenceReference, contracts: Vec<ContractBinding> });
record!(HistoricalSource {
    implementation_sha: String,
    release_sha: String,
    review: EvidenceReference
});
record!(PriorDependency {
    goal_id: String,
    provenance: EvidenceReference
});
record!(Enrollment { goal_id: String, business_goal_id: String, origin_uri: String, owner: String,
    producer_id: String, repo: String, target_runtime: String, deployment_profile: String,
    scope: DeploymentScope, scope_description: String, acceptance_revision: String,
    verification_profile: String, standing_authority_revision: String, authority: AuthorityBinding, original_request: EvidenceReference,
    historical_source: Option<HistoricalSource>, frozen_source_sha: Option<String>, prior_dependencies: Vec<PriorDependency> });
impl Signable for Enrollment {
    const DOMAIN: &'static str = "DeploymentEnrollment";
    const ROLE: Role = Role::Authority;
}
record!(DeploymentRecord { enrollment: Signed<Enrollment>, state: DeploymentState, revision: u64,
    business_goal_complete: bool, ready: Option<Signed<ReadyRecord>>, proposal_digest: Option<String>,
    closure: Option<Signed<ClosureAcknowledgement>> });
