//! A prospective operation plan. No value in this schema is an achieved custody proof.
use crate::model::Role;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

macro_rules! record {
    ($name:ident { $($field:ident : $ty:ty),* $(,)? }) => {
        #[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
        #[serde(deny_unknown_fields)]
        pub struct $name { $(pub $field: $ty),* }
    };
}
macro_rules! contract_enum {
    ($name:ident { $($variant:ident),* $(,)? }) => {
        #[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
        pub enum $name { $($variant),* }
        impl $name {
            pub const REQUIRED: &'static [Self] = &[$(Self::$variant),*];
        }
    };
}

contract_enum!(GenesisOperation {
    VerifyExternalOwnerAuthorization,
    VerifyExactPackageSourceAndReview,
    CensusRootPreimagesReadOnly,
    CensusSudoersIncludesReadOnly,
    CensusNumericIdentitiesReadOnly,
    CensusExistingServicesReadOnly,
    OpenDurableRollbackJournal,
    CreateIsolatedServiceIdentities,
    InstallProtectedExecutableClosure,
    VerifyProtectedExecutableClosure,
    GenerateSeparateRoleKeys,
    WriteProtectedIssuerCatalog,
    CreateDeploymentRegistry,
    InstallDisabledControllerProfile,
    PerformOwnerReviewerLogin,
    ReadBackDisabledInstallation,
    SealBootstrapPreparationReceipt,
});
contract_enum!(GenesisAbort {
    MissingExternalOwnerAuthorization,
    ExpiredAuthorization,
    SourceOrExecutableDrift,
    ReviewRecordDrift,
    UnexpectedRootPreimage,
    IncompleteSudoersCensus,
    OccupiedNumericIdentity,
    UntrustedPathOrMetadata,
    IncompleteRollbackJournal,
    ExistingTaskMutationRequired,
    UnknownPartialOutcome,
    AnyStepFailure,
});
contract_enum!(GenesisRollback {
    KeepNewControllerDisabled,
    ReconcileJournalWithoutReplay,
    RestoreOnlyExactVerifiedPreimages,
    RetainKeysJournalsAndReceiptsProtected,
    PreserveExistingServicesAndPermanentLocks,
    VerifyRollbackReadback,
});
contract_enum!(GenesisFutureOutput {
    GeneratedPublicKeys,
    ProtectedCustodyReceipt,
    RootPreimageCensus,
    SudoersCensus,
    IdentityReadback,
    ProtectedExecutableReadback,
    DisabledProfileReadback,
    OwnerLoginReceipt,
    BootstrapJournalReceipt,
});
contract_enum!(GenesisReviewScope {
    Injection,
    Traversal,
    SymlinkRace,
    CallerWritableCode,
    ArbitraryPrivilegedOperations,
    EnvironmentInjection,
    ArtifactSubstitution,
    Toctou,
    RollbackEscalation,
    MutexBypass,
    LegacyBypass,
    IssuerCustody,
    ReviewIndependence,
});
contract_enum!(GenesisAuthorizationMethod {
    ExternalExactPackageAuthorization
});
contract_enum!(GenesisAuthorizationScope {
    DisabledInstallationOnly
});
contract_enum!(GenesisKeyGeneration {
    SystemCsprngEd25519
});
contract_enum!(GenesisKeyCustody {
    RootOnlyFile0600Directory0700
});
contract_enum!(GenesisPublicKeyOutput {
    AfterAuthorizedGeneration
});

record!(GenesisOwnerAuthorization {
    owner: String,
    method: GenesisAuthorizationMethod,
    scope: GenesisAuthorizationScope,
    attempt_limit: u32,
    validity_seconds: u64,
});
record!(GenesisServiceIdentity {
    name: String,
    uid: u32,
    gid: u32,
    login_shell: String,
});
record!(GenesisIdentities {
    caller_uid: u32,
    caller_gid: u32,
    socket_gid: u32,
    runtime_uid: u32,
    runtime_gid: u32,
    w1_uid: u32,
    w1_gid: u32,
    w2_uid: u32,
    w2_gid: u32,
    reviewer: GenesisServiceIdentity,
});
record!(GenesisPaths {
    code_root: String,
    state_root: String,
    keys: String,
    registry: String,
    reviewer_home: String,
    reviewer_workspace: String,
    plist: String,
    socket_parent: String,
});
record!(GenesisRoleKey {
    role: Role,
    key_id: String,
    service_identity: String,
    scopes: Vec<String>,
    private_key_path: String,
    generation: GenesisKeyGeneration,
    custody: GenesisKeyCustody,
    public_key_output: GenesisPublicKeyOutput,
});
// The manifest excludes review and plan digests so an independent report can
// pin this exact package without a package/review digest cycle.
record!(GenesisPackageManifest {
    version: u32,
    source_revision: String,
    source_tree: String,
    source_files: BTreeMap<String, String>,
    executables: BTreeMap<String, String>,
    support_files: BTreeMap<String, String>,
    initial_registry_digest: String,
    supervisor_policy_digest: String,
});
record!(GenesisPlan {
    version: u32,
    accepted_authority: String,
    package_digest: String,
    source_revision: String,
    source_tree: String,
    source_files: BTreeMap<String, String>,
    source_digest: String,
    executables: BTreeMap<String, String>,
    support_files: BTreeMap<String, String>,
    review_record_digest: String,
    initial_registry_digest: String,
    supervisor_policy_digest: String,
    profile_enabled: bool,
    activation_requested: bool,
    owner_authorization: GenesisOwnerAuthorization,
    paths: GenesisPaths,
    identities: GenesisIdentities,
    roles: Vec<GenesisRoleKey>,
    operations: Vec<GenesisOperation>,
    abort_conditions: Vec<GenesisAbort>,
    rollback: Vec<GenesisRollback>,
    future_outputs: Vec<GenesisFutureOutput>,
    required_review_scopes: Vec<GenesisReviewScope>,
});
// Anchors must come from a separately authenticated reviewing caller, never copied
// from the candidate by the operation that grants bootstrap authority.
record!(GenesisPins {
    plan_digest: String,
    package_digest: String,
    source_digest: String,
    review_record_digest: String,
    initial_registry_digest: String,
    supervisor_policy_digest: String,
});

#[derive(Debug, Clone)]
pub struct GenesisArtifacts {
    pub package_manifest: Vec<u8>,
    pub sources: BTreeMap<String, Vec<u8>>,
    pub executables: BTreeMap<String, Vec<u8>>,
    pub support_files: BTreeMap<String, Vec<u8>>,
    pub review_record: Vec<u8>,
    pub initial_registry: Vec<u8>,
    pub supervisor_policy: Vec<u8>,
}
/// A checked prospective plan is neither permission nor a protected-state receipt.
#[derive(Debug, Serialize)]
pub struct GenesisReadiness {
    pub plan_ready: bool,
    pub artifact_integrity_verified: bool,
    pub bootstrap_allowed: bool,
    pub activation_allowed: bool,
    pub protected_poststate_verified: bool,
    pub independent_review_result_verified: bool,
    pub plan_digest: String,
}
