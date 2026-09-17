use deployment_control_plane::{model::*, trust::*};
use ed25519_dalek::{Signer, SigningKey};
use std::collections::BTreeMap;
pub fn signed<T: Signable>(issuer: &str, payload: T) -> Signed<T> {
    let key = SigningKey::from_bytes(&seed(issuer));
    let signature = hex::encode(key.sign(&signing_bytes(&payload).unwrap()).to_bytes());
    Signed {
        issuer: issuer.into(),
        payload,
        signature,
    }
}
fn seed(issuer: &str) -> [u8; 32] {
    use sha2::{Digest, Sha256};
    Sha256::digest(issuer.as_bytes()).into()
}
pub fn catalog() -> Catalog {
    let mut keys = BTreeMap::new();
    for (issuer, role) in [
        ("authority", Role::Authority),
        ("builder", Role::Builder),
        ("reviewer", Role::Reviewer),
        ("producer", Role::Producer),
        ("verifier", Role::Verifier),
        ("recovery", Role::Recovery),
    ] {
        keys.insert(
            issuer.into(),
            TrustedKey {
                public_key: hex::encode(
                    SigningKey::from_bytes(&seed(issuer))
                        .verifying_key()
                        .as_bytes(),
                ),
                role,
                scopes: vec!["fixture".into(), "producer".into()],
            },
        );
    }
    Catalog {
        revision: "catalog-1".into(),
        keys,
        profiles: BTreeMap::new(),
    }
}
pub fn policy() -> Policy {
    Policy {
        epoch: 1,
        issued_at: 1000,
        expires_at: 1200,
        standing_authority_revision: "authority-1".into(),
        revoked_sources: vec![],
        revoked_artifacts: vec![],
    }
}
pub fn fixture_catalog() -> Catalog {
    let mut c = catalog();
    c.profiles.insert(
        "fixture".into(),
        Profile {
            revision: "profile-1".into(),
            repo: "repo".into(),
            target_runtime: "runtime".into(),
            host: "host".into(),
            launchd_domain: "system".into(),
            launchd_label: "fixture.service".into(),
            install_root_id: "root-1".into(),
            standing_authority_revision: "authority-1".into(),
            build_recipe: "recipe-1".into(),
            toolchain: "rust-1".into(),
            architecture: "arm64".into(),
            verification_profiles: vec!["verify-1".into()],
            goal_verifiers: BTreeMap::from([("verify-1".into(), "verifier".into())]),
            required_review_scopes: vec!["release".into()],
            preflight_policy: "preflight-1".into(),
            privileged_apply_profile: "apply-1".into(),
            restart_profile: "restart-1".into(),
            rollback_profile: "rollback-1".into(),
            failure_policy: FailurePolicy::StopTrain,
            policy_lease_seconds: 300,
            actor_quota: 100,
            queue_quota: 1000,
            enabled: true,
        },
    );
    c
}
pub fn actor() -> Actor {
    Actor {
        id: "caller".into(),
        allowed_producers: vec!["producer".into()],
        allowed_profiles: vec!["fixture".into()],
    }
}
pub fn proposal(request: &str, artifact: &str, revision: u64, goal: &str) -> Proposal {
    let source = "a".repeat(40);
    let coverage = GoalCoverage {
        goal_id: goal.into(),
        acceptance_revision: "accept-1".into(),
        source_sha: source.clone(),
        release_face_sha256: "f".repeat(64),
        verification_profile: "verify-1".into(),
    };
    let ready = ReadyRecord {
        producer_id: "producer".into(),
        goal_id: goal.into(),
        revision: 1,
        repo: "repo".into(),
        source_sha: source.clone(),
        authority_revisions: vec!["authority-1".into()],
        artifact_sha256: artifact.repeat(64),
        coverage: coverage.clone(),
        dependencies: vec![],
    };
    Proposal {
        request_id: request.into(),
        deployment_profile: "fixture".into(),
        goals: vec![signed("producer", ready)],
        acceptance: signed(
            "authority",
            Acceptance {
                repo: "repo".into(),
                source_sha: source.clone(),
                tree_sha: "b".repeat(40),
                authority_revision: "authority-1".into(),
                semantic_authors: vec!["author".into()],
            },
        ),
        build: signed(
            "builder",
            BuildAttestation {
                repo: "repo".into(),
                source_sha: source.clone(),
                tree_sha: "b".repeat(40),
                artifact_sha256: artifact.repeat(64),
                manifest_digest: "c".repeat(64),
                profile_revision: "profile-1".into(),
                recipe: "recipe-1".into(),
                toolchain: "rust-1".into(),
                architecture: "arm64".into(),
                dependency_closure: vec!["d".repeat(64)],
                goal_coverage: vec![coverage],
            },
        ),
        reviews: vec![signed(
            "reviewer",
            Review {
                repo: "repo".into(),
                source_sha: source,
                artifact_sha256: artifact.repeat(64),
                manifest_digest: "c".repeat(64),
                profile_revision: "profile-1".into(),
                scopes: vec!["release".into()],
            },
        )],
        policy: signed("authority", policy()),
        desired: signed(
            "authority",
            DesiredState {
                target_runtime: "runtime".into(),
                revision,
                expected_target_generation: 0,
                artifact_sha256: artifact.repeat(64),
                profile_revision: "profile-1".into(),
            },
        ),
        dependencies: vec![],
        supersedes: vec![],
    }
}
pub fn setup() -> (
    tempfile::TempDir,
    deployment_control_plane::queue::Queue,
    Catalog,
) {
    unsafe extern "C" {
        fn geteuid() -> u32;
    }
    assert_ne!(unsafe { geteuid() }, 0, "fixtures refuse euid 0");
    let dir = tempfile::tempdir().unwrap();
    let q = deployment_control_plane::queue::Queue::open(dir.path().join("queue.db")).unwrap();
    let c = fixture_catalog();
    q.register_producer(&c, "producer").unwrap();
    (dir, q, c)
}
pub fn register(q: &deployment_control_plane::queue::Queue, c: &Catalog, p: &Proposal) {
    for record in &p.goals {
        q.register_ready(c, record, 0).unwrap();
    }
}
