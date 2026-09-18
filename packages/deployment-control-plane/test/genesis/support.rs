use deployment_control_plane::{bootstrap::*, trust::digest};
use serde_json::json;
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;

pub fn hash(bytes: &[u8]) -> String {
    hex::encode(Sha256::digest(bytes))
}

pub fn fixture() -> (GenesisPlan, GenesisPins, GenesisArtifacts) {
    let sources: BTreeMap<String, Vec<u8>> = BTreeMap::from([
        (
            "packages/deployment-control-plane/src/main.rs".into(),
            b"reviewed source".to_vec(),
        ),
        (
            "packages/deployment-control-plane/Cargo.lock".into(),
            b"locked dependencies".to_vec(),
        ),
    ]);
    let source_files: BTreeMap<String, String> =
        sources.iter().map(|(k, v)| (k.clone(), hash(v))).collect();
    let executables = [
        "agent-deployd",
        "agent-deploy-issuer",
        "agent-deploy-bootstrap",
        "codex",
    ]
    .into_iter()
    .map(|name| {
        (
            format!("/usr/local/libexec/agent-deployd/{name}"),
            name.as_bytes().to_vec(),
        )
    })
    .collect::<BTreeMap<_, _>>();
    let executable_hashes: BTreeMap<_, _> = executables
        .iter()
        .map(|(k, v)| (k.clone(), hash(v)))
        .collect();
    let review_record = b"independently pinned review artifact, no runtime claim".to_vec();
    let support_files = BTreeMap::from([(
        "/usr/local/libexec/agent-deployd/review-output-schema.json".to_string(),
        br#"{"type":"object"}"#.to_vec(),
    )]);
    let support_hashes: BTreeMap<_, _> = support_files
        .iter()
        .map(|(k, v)| (k.clone(), hash(v)))
        .collect();
    let initial_registry = b"exact original Goal enrollment, pending".to_vec();
    let supervisor_policy = b"fixed issuer supervisor policy".to_vec();
    let package_manifest = serde_json::to_vec(&json!({
        "version": 1,
        "source_revision": "12".repeat(20), "source_tree": "34".repeat(20),
        "source_files": source_files, "executables": executable_hashes,
        "support_files": support_hashes,
        "initial_registry_digest": hash(&initial_registry),
        "supervisor_policy_digest": hash(&supervisor_policy)
    }))
    .unwrap();
    let roles: Vec<_> = [
        (
            "AUTHORITY",
            "local-authority",
            "authority",
            vec![
                "dsh-app",
                "preparation",
                "bootstrap",
                "local-deployment-registry",
            ],
        ),
        (
            "BUILDER",
            "local-builder",
            "builder",
            vec!["dsh-app", "preparation"],
        ),
        (
            "REVIEWER",
            "local-reviewer",
            "reviewer",
            vec!["dsh-app", "preparation"],
        ),
        (
            "PRODUCER",
            "local-deployment-registry",
            "producer",
            vec!["dsh-app", "preparation", "local-deployment-registry"],
        ),
        (
            "VERIFIER",
            "local-verifier",
            "verifier",
            vec!["dsh-app", "preparation"],
        ),
        (
            "RECOVERY",
            "local-recovery",
            "recovery",
            vec!["dsh-app", "preparation"],
        ),
    ]
    .into_iter()
    .map(|(role, key_id, identity, scopes)| {
        json!({
            "role": role, "key_id": key_id,
            "service_identity": format!("dcp://local-issuer/{identity}"),
            "scopes": scopes,
            "private_key_path": format!("/private/var/db/agent-deployd/issuer-keys/{key_id}.json"),
            "generation": "SystemCsprngEd25519", "custody": "RootOnlyFile0600Directory0700",
            "public_key_output": "AfterAuthorizedGeneration"
        })
    })
    .collect();
    let plan: GenesisPlan = serde_json::from_value(json!({
        "version": 1,
        "accepted_authority": "39865536ce51005f95a98473e77c2329078512c0",
        "package_digest": hash(&package_manifest),
        "source_revision": "12".repeat(20), "source_tree": "34".repeat(20),
        "source_files": source_files, "source_digest": digest(&source_files).unwrap(),
        "executables": executable_hashes,
        "support_files": support_hashes,
        "review_record_digest": hash(&review_record),
        "initial_registry_digest": hash(&initial_registry),
        "supervisor_policy_digest": hash(&supervisor_policy),
        "profile_enabled": false, "activation_requested": false,
        "owner_authorization": {"owner": "mayf3", "method": "ExternalExactPackageAuthorization",
            "scope": "DisabledInstallationOnly", "attempt_limit": 1, "validity_seconds": 3600},
        "paths": {"code_root": "/usr/local/libexec/agent-deployd",
            "state_root": "/private/var/db/agent-deployd",
            "keys": "/private/var/db/agent-deployd/issuer-keys",
            "registry": "/private/var/db/agent-deployd/registry",
            "reviewer_home": "/private/var/db/agent-deploy-review",
            "reviewer_workspace": "/private/var/db/agent-deploy-review-workspace",
            "plist": "/Library/LaunchDaemons/ai.agent-deployd.plist",
            "socket_parent": "/private/var/run/agent-deployd"},
        "identities": {"caller_uid": 502, "caller_gid": 20, "socket_gid": 602,
            "runtime_uid": 505, "runtime_gid": 601, "w1_uid": 505, "w1_gid": 601,
            "w2_uid": 0, "w2_gid": 0,
            "reviewer": {"name": "_dcp_review", "uid": 612, "gid": 612, "login_shell": "/usr/bin/false"}},
        "roles": roles,
        "operations": ["VerifyExternalOwnerAuthorization", "VerifyExactPackageSourceAndReview",
            "CensusRootPreimagesReadOnly", "CensusSudoersIncludesReadOnly", "CensusNumericIdentitiesReadOnly",
            "CensusExistingServicesReadOnly", "OpenDurableRollbackJournal", "CreateIsolatedServiceIdentities",
            "InstallProtectedExecutableClosure", "VerifyProtectedExecutableClosure", "GenerateSeparateRoleKeys",
            "WriteProtectedIssuerCatalog", "CreateDeploymentRegistry", "InstallDisabledControllerProfile",
            "PerformOwnerReviewerLogin", "ReadBackDisabledInstallation", "SealBootstrapPreparationReceipt"],
        "abort_conditions": ["MissingExternalOwnerAuthorization", "ExpiredAuthorization", "SourceOrExecutableDrift",
            "ReviewRecordDrift", "UnexpectedRootPreimage", "IncompleteSudoersCensus", "OccupiedNumericIdentity",
            "UntrustedPathOrMetadata", "IncompleteRollbackJournal", "ExistingTaskMutationRequired",
            "UnknownPartialOutcome", "AnyStepFailure"],
        "rollback": ["KeepNewControllerDisabled", "ReconcileJournalWithoutReplay",
            "RestoreOnlyExactVerifiedPreimages", "RetainKeysJournalsAndReceiptsProtected",
            "PreserveExistingServicesAndPermanentLocks", "VerifyRollbackReadback"],
        "future_outputs": ["GeneratedPublicKeys", "ProtectedCustodyReceipt", "RootPreimageCensus",
            "SudoersCensus", "IdentityReadback", "ProtectedExecutableReadback", "DisabledProfileReadback",
            "OwnerLoginReceipt", "BootstrapJournalReceipt"],
        "required_review_scopes": ["Injection", "Traversal", "SymlinkRace", "CallerWritableCode",
            "ArbitraryPrivilegedOperations", "EnvironmentInjection", "ArtifactSubstitution", "Toctou",
            "RollbackEscalation", "MutexBypass", "LegacyBypass", "IssuerCustody", "ReviewIndependence"]
    })).unwrap();
    let pins = GenesisPins {
        plan_digest: digest(&plan).unwrap(),
        package_digest: plan.package_digest.clone(),
        source_digest: plan.source_digest.clone(),
        review_record_digest: plan.review_record_digest.clone(),
        initial_registry_digest: plan.initial_registry_digest.clone(),
        supervisor_policy_digest: plan.supervisor_policy_digest.clone(),
    };
    let artifacts = GenesisArtifacts {
        package_manifest,
        sources,
        executables,
        support_files,
        review_record,
        initial_registry,
        supervisor_policy,
    };
    (plan, pins, artifacts)
}
