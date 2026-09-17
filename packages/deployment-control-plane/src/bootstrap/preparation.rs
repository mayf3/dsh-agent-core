//! Inert preparation receipts. Trust comes from a separately pinned reviewer's keyset,
//! never the proposed Configuration. No issuer transport or private custody is invented.
use crate::{
    error::require,
    model::*,
    service::Configuration,
    transaction::NativeEnrollment,
    trust::{digest, verify_signed, Signable},
    Result,
};
use serde::{Deserialize, Serialize};
use std::{collections::BTreeSet, path::Path};
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
pub enum Requirement {
    HostEnrollment,
    IssuerCustody,
    SourceAcceptance,
    SourceBuild,
    IndependentReview,
    ReleaseFace,
    LegacyLifecycle,
    NativeClosure,
    OperationRollback,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PreparationStatement {
    pub requirement: Requirement,
    pub package_digest: String,
    pub configuration_digest: String,
    pub enrollment_digest: String,
    pub source_digest: String,
    pub subject_digest: String,
    pub issued_at: u64,
    pub expires_at: u64,
}
macro_rules! proof {
    ($name:ident,$role:ident) => {
        #[derive(Debug, Clone, Serialize, Deserialize)]
        #[serde(deny_unknown_fields)]
        pub struct $name {
            pub statement: PreparationStatement,
        }
        impl Signable for $name {
            const DOMAIN: &'static str = stringify!($name);
            const ROLE: Role = Role::$role;
        }
    };
}
proof!(AuthorityPreparation, Authority);
proof!(BuildPreparation, Builder);
proof!(ReviewPreparation, Reviewer);
proof!(RecoveryPreparation, Recovery);
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", content = "record", deny_unknown_fields)]
pub enum PreparationProof {
    Authority(Signed<AuthorityPreparation>),
    Build(Signed<BuildPreparation>),
    Review(Signed<ReviewPreparation>),
    Recovery(Signed<RecoveryPreparation>),
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ResolvedPreparation {
    pub configuration: Configuration,
    pub enrollment: NativeEnrollment,
    pub issuer_bindings: Vec<super::IssuerRequirement>,
    pub release_manifest: crate::fs::ArtifactManifest,
    pub release_source_sha: String,
    pub release_tree_sha: String,
    pub semantic_authors: Vec<String>,
    pub operation_plan_digest: String,
    pub rollback_plan_digest: String,
    pub proofs: Vec<PreparationProof>,
}
impl PreparationProof {
    fn check<'a>(&'a self, trust: &Catalog) -> Result<(&'a str, &'a PreparationStatement)> {
        Ok(match self {
            Self::Authority(p) => {
                verify_signed(p, trust, "preparation")?;
                (&p.issuer, &p.payload.statement)
            }
            Self::Build(p) => {
                verify_signed(p, trust, "preparation")?;
                (&p.issuer, &p.payload.statement)
            }
            Self::Review(p) => {
                verify_signed(p, trust, "preparation")?;
                (&p.issuer, &p.payload.statement)
            }
            Self::Recovery(p) => {
                verify_signed(p, trust, "preparation")?;
                (&p.issuer, &p.payload.statement)
            }
        })
    }
    fn role_matches(&self, r: Requirement) -> bool {
        matches!(
            (self, r),
            (
                Self::Authority(_),
                Requirement::HostEnrollment
                    | Requirement::IssuerCustody
                    | Requirement::SourceAcceptance
                    | Requirement::ReleaseFace
                    | Requirement::LegacyLifecycle
            ) | (Self::Build(_), Requirement::SourceBuild)
                | (
                    Self::Review(_),
                    Requirement::IndependentReview | Requirement::NativeClosure
                )
                | (Self::Recovery(_), Requirement::OperationRollback)
        )
    }
}
/// Caller supplies an independently pinned keyset digest, rather than trusting keys in input.
#[expect(
    clippy::too_many_arguments,
    reason = "Independent integrity, trust and observed-time coordinates stay explicit"
)]
pub fn verify_resolved(
    root: &Path,
    package_digest: &str,
    source_digest: &str,
    input: &ResolvedPreparation,
    trust: &Catalog,
    trusted_keyset_digest: &str,
    observed_host: &str,
    now: u64,
) -> Result<super::Preflight> {
    let integrity = super::verify_bundle(root, package_digest, source_digest)?;
    require(integrity.integrity_verified, "PACKAGE_DIGEST")?;
    let dir = crate::fs::secure::Dir::open(root, unsafe { libc::geteuid() })?;
    let package = super::bundle::read_package(&dir)?;
    require(
        package.platform_tools.get("/bin/launchctl") == Some(&input.enrollment.launchctl_sha256)
            && package.platform_tools.get("/usr/bin/plutil")
                == Some(&input.enrollment.plutil_sha256),
        "PREPARATION_TOOL_BINDING",
    )?;
    let runtime = package
        .payloads
        .iter()
        .filter(|p| {
            p.destination
                .starts_with("/usr/local/libexec/agent-core/node-runtime/")
        })
        .map(|p| (&p.destination, &p.sha256))
        .collect::<std::collections::BTreeMap<_, _>>();
    require(
        input.enrollment.loader_files.len() == runtime.len()
            && input
                .enrollment
                .loader_files
                .iter()
                .all(|f| runtime.get(&f.path) == Some(&&f.sha256)),
        "PREPARATION_LOADER_BINDING",
    )?;
    validate_resolved(
        input,
        trust,
        trusted_keyset_digest,
        package_digest,
        source_digest,
        observed_host,
        now,
    )?;
    Ok(super::Preflight {
        integrity_verified: true,
        bootstrap_ready: true,
        activation_allowed: false,
        preparation_digest: Some(digest(input)?),
        blockers: vec![],
    })
}
pub fn preparation_subject(
    input: &ResolvedPreparation,
    requirement: Requirement,
) -> Result<String> {
    Ok(match requirement {
        Requirement::HostEnrollment => digest(&(
            &input.configuration.socket_ancestor,
            &input.enrollment.host,
            &input.enrollment.services,
        ))?,
        Requirement::IssuerCustody => digest(&input.issuer_bindings)?,
        Requirement::SourceAcceptance
        | Requirement::SourceBuild
        | Requirement::IndependentReview
        | Requirement::NativeClosure => digest(&(
            requirement,
            &input.release_source_sha,
            &input.release_tree_sha,
            &input.semantic_authors,
            &input.release_manifest,
            &input.enrollment.loader_files,
        ))?,
        Requirement::ReleaseFace => digest(&(
            &input.release_manifest,
            &input.enrollment.initial_files,
            &input.enrollment.required_facets,
        ))?,
        Requirement::LegacyLifecycle => input.enrollment.lifecycle_denial_digest.clone(),
        Requirement::OperationRollback => {
            digest(&(&input.operation_plan_digest, &input.rollback_plan_digest))?
        }
    })
}
// Pure entry shares validation with package verification and can use explicit synthetic fixture anchors.
pub fn validate_resolved(
    input: &ResolvedPreparation,
    trust: &Catalog,
    keyset_digest: &str,
    package_digest: &str,
    source_digest: &str,
    host: &str,
    now: u64,
) -> Result<()> {
    require(digest(trust)? == keyset_digest, "PREPARATION_TRUST_ANCHOR")?;
    for hash in [
        keyset_digest,
        package_digest,
        source_digest,
        &input.operation_plan_digest,
        &input.rollback_plan_digest,
    ] {
        crate::trust::valid_digest(hash)?;
    }
    for sha in [&input.release_source_sha, &input.release_tree_sha] {
        require(
            sha.len() == 40
                && sha
                    .bytes()
                    .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b)),
            "SOURCE_BINDING",
        )?;
    }
    require(
        !input.semantic_authors.is_empty() && input.semantic_authors.len() <= 256,
        "REVIEW_INDEPENDENCE",
    )?;
    for author in &input.semantic_authors {
        crate::trust::valid_id(author)?;
    }
    super::validate_native_binding(&input.configuration, &input.enrollment, host, false)?;
    require(
        input.issuer_bindings.len() == 6 && input.proofs.len() == 9,
        "PREPARATION_INCOMPLETE",
    )?;
    let mut roles = BTreeSet::new();
    let mut keys = BTreeSet::new();
    let mut services = BTreeSet::new();
    for binding in &input.issuer_bindings {
        let key = input
            .configuration
            .catalog
            .keys
            .get(&binding.proposed_key_id)
            .ok_or(crate::Error::new("ISSUER_BINDING"))?;
        require(
            key.role == binding.role
                && key.scopes == binding.scope
                && binding.public_key.as_ref() == Some(&key.public_key)
                && roles.insert(format!("{:?}", binding.role))
                && keys.insert(&key.public_key),
            "ISSUER_BINDING",
        )?;
        crate::trust::valid_digest(&key.public_key)?;
        let public: [u8; 32] = hex::decode(&key.public_key)
            .map_err(|_| crate::Error::new("INVALID_KEY"))?
            .try_into()
            .map_err(|_| crate::Error::new("INVALID_KEY"))?;
        let public = ed25519_dalek::VerifyingKey::from_bytes(&public)
            .map_err(|_| crate::Error::new("INVALID_KEY"))?;
        require(
            !public.is_weak() && key.scopes.contains(&input.enrollment.profile_id),
            "ISSUER_BINDING",
        )?;
        if key.role == Role::Authority {
            require(key.scopes.contains(&"bootstrap".into()), "ISSUER_SCOPE")?;
        }
        let identity = binding
            .service_identity
            .as_ref()
            .ok_or(crate::Error::new("ISSUER_CUSTODY"))?;
        crate::trust::valid_id(identity)?;
        require(
            services.insert(identity)
                && !binding.source_binding.is_empty()
                && binding.source_binding.len() <= 2048,
            "ISSUER_CUSTODY",
        )?;
        crate::trust::valid_digest(
            binding
                .custody_receipt
                .as_deref()
                .ok_or(crate::Error::new("ISSUER_CUSTODY"))?,
        )?;
    }
    require(
        input.configuration.catalog.keys.len() == 6,
        "ISSUER_BINDING",
    )?;
    super::validate_prepared_manifest(&input.enrollment, &input.release_manifest)?;
    let configuration = digest(&input.configuration)?;
    let enrollment = digest(&input.enrollment)?;
    let mut requirements = BTreeSet::new();
    for proof in &input.proofs {
        let (issuer, statement) = proof.check(trust)?;
        if matches!(proof, PreparationProof::Review(_)) {
            require(
                !input.semantic_authors.iter().any(|a| a == issuer),
                "REVIEW_INDEPENDENCE",
            )?;
            let reviewer = &trust.keys[issuer].public_key;
            require(
                !trust
                    .keys
                    .values()
                    .any(|k| k.role != Role::Reviewer && &k.public_key == reviewer),
                "REVIEW_INDEPENDENCE",
            )?;
        }
        require(
            proof.role_matches(statement.requirement) && requirements.insert(statement.requirement),
            "PREPARATION_SCOPE",
        )?;
        require(
            statement.package_digest == package_digest
                && statement.source_digest == source_digest
                && statement.configuration_digest == configuration
                && statement.enrollment_digest == enrollment
                && statement.subject_digest == preparation_subject(input, statement.requirement)?,
            "PREPARATION_BINDING",
        )?;
        require(
            statement.issued_at <= now
                && statement.expires_at > now
                && statement.expires_at > statement.issued_at
                && statement.expires_at - statement.issued_at <= 86400,
            "PREPARATION_EXPIRED",
        )?;
    }
    require(requirements.len() == 9, "PREPARATION_INCOMPLETE")
}
