use crate::common::*;
use deployment_control_plane::{
    model::{Catalog, Signed},
    registry::{
        AuthorityBinding, ContractBinding, DeploymentScope, Enrollment, EvidenceReference,
        HistoricalSource, Registry,
    },
};
use sha2::{Digest, Sha256};
pub fn open(path: &std::path::Path, c: &Catalog) -> Registry {
    Registry::open_fixture(path, c, "producer", Sha256::digest(b"producer").into()).unwrap()
}
pub fn enrollment(goal: &str) -> Signed<Enrollment> {
    signed(
        "authority",
        Enrollment {
            goal_id: goal.into(),
            business_goal_id: "original-business-goal".into(),
            origin_uri: "codex://threads/original-task".into(),
            owner: "mayf3".into(),
            producer_id: "producer".into(),
            repo: "repo".into(),
            target_runtime: "runtime".into(),
            deployment_profile: "fixture".into(),
            scope: DeploymentScope::DeploymentOnly,
            scope_description: "Broker one-file deployment obligation".into(),
            acceptance_revision: "accept-1".into(),
            verification_profile: "verify-1".into(),
            standing_authority_revision: "authority-1".into(),
            authority: AuthorityBinding {
                revision: "authority-1".into(),
                semantic_head: "1".repeat(40),
                lifecycle_head: "2".repeat(40),
                source: reference("spec"),
                acceptance: reference("owner-acceptance"),
                contracts: vec![ContractBinding {
                    id: "ACC-001".into(),
                    source: reference("contract"),
                }],
            },
            original_request: reference("original-request"),
            historical_source: Some(HistoricalSource {
                implementation_sha: "a".repeat(40),
                release_sha: "b".repeat(40),
                review: reference("historical-review"),
            }),
            frozen_source_sha: None,
            prior_dependencies: vec![],
        },
    )
}
pub fn reference(name: &str) -> EvidenceReference {
    EvidenceReference {
        uri: format!("repo://{name}"),
        sha256: "c".repeat(64),
    }
}
