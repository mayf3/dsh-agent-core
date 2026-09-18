//! Independent review: only output captured from the fixed native child is signable.
use crate::{
    error::require,
    fs::file::sha,
    model::Review,
    trust::{digest, valid_digest, valid_id},
    Error, Result,
};
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;

pub const REVIEWER_ID: &str = "local-reviewer";
pub const REVIEW_UID: u32 = 612;
pub const REVIEW_GID: u32 = 612;
pub const REVIEW_MODEL: &str = "gpt-6-astra";
const MAX_INPUT_BYTES: usize = 4 * 1024 * 1024;
const MAX_OUTPUT_BYTES: usize = 64 * 1024;
mod policy;
mod process;

pub const CODEX_PATH: &str = "/usr/local/libexec/agent-deployd/codex";
pub const REVIEW_HELPER_PATH: &str = "/usr/local/libexec/agent-deployd/agent-deploy-issuer";
pub const REVIEW_HOME: &str = "/private/var/db/agent-deploy-review";
pub const REVIEW_WORKSPACE: &str = "/private/var/db/agent-deploy-review-workspace";
pub const REVIEW_SCHEMA_PATH: &str = "/usr/local/libexec/agent-deployd/review-output-schema.json";
pub const REVIEW_SCHEMA_JSON: &str = r#"{"type":"object","additionalProperties":false,"required":["job_digest","input_digest","reviewer","verdict","findings"],"properties":{"job_digest":{"type":"string"},"input_digest":{"type":"string"},"reviewer":{"type":"string","enum":["local-reviewer"]},"verdict":{"type":"string","enum":["PASS","FAIL"]},"findings":{"type":"array","items":{"type":"string"}}}}"#;

pub struct NativeReviewRunner {
    codex_sha256: String,
    review_helper_sha256: String,
}
impl NativeReviewRunner {
    pub fn new(codex_sha256: String, review_helper_sha256: String) -> Result<Self> {
        valid_digest(&codex_sha256)?;
        valid_digest(&review_helper_sha256)?;
        Ok(Self {
            codex_sha256,
            review_helper_sha256,
        })
    }
    pub fn run(&self, job: &ReviewJob, input_path: &std::path::Path) -> Result<VerifiedReview> {
        require(
            unsafe { libc::geteuid() } == 0 && unsafe { libc::getuid() } == 0,
            "REVIEW_ROOT_REQUIRED",
        )?;
        validate_job(job)?;
        policy::prerequisites()?;
        let binary = policy::PinnedFile::at_path(
            std::path::Path::new(CODEX_PATH),
            &self.codex_sha256,
            512 * 1024 * 1024,
            true,
        )?;
        let schema = policy::PinnedFile::at_path(
            std::path::Path::new(REVIEW_SCHEMA_PATH),
            &sha(REVIEW_SCHEMA_JSON.as_bytes()),
            8192,
            false,
        )?;
        let helper = policy::PinnedFile::at_path(
            std::path::Path::new(REVIEW_HELPER_PATH),
            &self.review_helper_sha256,
            512 * 1024 * 1024,
            true,
        )?;
        let input =
            policy::PinnedFile::at_path(input_path, &job.input_digest, MAX_INPUT_BYTES, false)?;
        let packet = verify_packet(job, &input.bytes)?;
        let envelope = serde_json::to_vec(&serde_json::json!({
            "job_digest": digest(job)?, "input_digest": job.input_digest,
            "frozen_job": job, "untrusted_source_packet": packet,
        }))?;
        let output = process::capture(
            policy::launcher(),
            &envelope,
            std::time::Duration::from_secs(600),
            MAX_OUTPUT_BYTES,
        )?;
        // A complete child result is insufficient if any protected face changed.
        binary.recheck()?;
        helper.recheck()?;
        schema.recheck()?;
        input.recheck()?;
        policy::prerequisites()?;
        parse_result(job, &output)
    }
}

/// The fixed issuer's `review-child` entry runs in a fresh process and forwards
/// only the daemon-owned anonymous pipes to the reviewer after dropping identity.
pub fn exec_native_child() -> Result<()> {
    policy::exec_native_child()
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct ReviewJob {
    pub repo: String,
    pub source_sha: String,
    pub tree_sha: String,
    pub artifact_sha256: String,
    pub manifest_digest: String,
    pub profile_revision: String,
    pub profile_digest: String,
    pub scopes: Vec<String>,
    pub semantic_authors: Vec<String>,
    pub semantic_author_uids: Vec<u32>,
    pub input_digest: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct ReviewSourceFile {
    pub path: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct ReviewPacket {
    pub repo: String,
    pub source_sha: String,
    pub tree_sha: String,
    pub profile: crate::model::Profile,
    pub manifest: crate::fs::ArtifactManifest,
    pub accepted_contract: ReviewSourceFile,
    pub files: Vec<ReviewSourceFile>,
}

#[derive(Debug)]
pub struct VerifiedReview {
    review: Review,
    job_digest: String,
    evidence_digest: String,
}
impl VerifiedReview {
    pub fn review(&self) -> &Review {
        &self.review
    }
    pub fn job_digest(&self) -> &str {
        &self.job_digest
    }
    pub fn evidence_digest(&self) -> &str {
        &self.evidence_digest
    }
}

fn validate_job(job: &ReviewJob) -> Result<()> {
    crate::fs::secure::relative(&job.repo)?;
    for value in [&job.source_sha, &job.tree_sha] {
        require(
            value.len() == 40
                && value
                    .bytes()
                    .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b)),
            "REVIEW_SOURCE",
        )?;
    }
    for value in [
        &job.artifact_sha256,
        &job.manifest_digest,
        &job.profile_digest,
        &job.input_digest,
    ] {
        valid_digest(value)?;
    }
    valid_id(&job.profile_revision)?;
    require(
        !job.scopes.is_empty()
            && job.scopes.len() <= 64
            && job.scopes.iter().collect::<BTreeSet<_>>().len() == job.scopes.len(),
        "REVIEW_SCOPES",
    )?;
    for scope in &job.scopes {
        valid_id(scope)?;
    }
    require(
        !job.semantic_authors.is_empty()
            && job.semantic_authors.len() <= 256
            && !job.semantic_author_uids.is_empty()
            && job.semantic_author_uids.len() <= 256,
        "REVIEW_AUTHORS_MISSING",
    )?;
    for author in &job.semantic_authors {
        valid_id(author)?;
    }
    require(
        !job.semantic_authors.iter().any(|a| a == REVIEWER_ID)
            && !job
                .semantic_author_uids
                .iter()
                .any(|uid| *uid == 0 || *uid == REVIEW_UID),
        "SELF_REVIEW",
    )
}
fn verify_packet(job: &ReviewJob, bytes: &[u8]) -> Result<ReviewPacket> {
    validate_job(job)?;
    require(
        !bytes.is_empty() && bytes.len() <= MAX_INPUT_BYTES,
        "REVIEW_INPUT_LIMIT",
    )?;
    require(sha(bytes) == job.input_digest, "REVIEW_INPUT_DRIFT")?;
    let packet: ReviewPacket =
        serde_json::from_slice(bytes).map_err(|_| Error::new("REVIEW_INPUT_INVALID"))?;
    require(
        packet.repo == job.repo
            && packet.source_sha == job.source_sha
            && packet.tree_sha == job.tree_sha
            && packet.profile.repo == job.repo
            && packet.profile.revision == job.profile_revision
            && packet.profile.required_review_scopes == job.scopes
            && digest(&packet.profile)? == job.profile_digest
            && digest(&packet.manifest)? == job.manifest_digest,
        "REVIEW_INPUT_BINDING",
    )?;
    require(
        !packet.files.is_empty()
            && packet.files.len() <= 4096
            && !packet.accepted_contract.content.trim().is_empty(),
        "REVIEW_INPUT_INCOMPLETE",
    )?;
    let mut paths = BTreeSet::new();
    for source in std::iter::once(&packet.accepted_contract).chain(&packet.files) {
        crate::fs::secure::relative(&source.path).map_err(|_| Error::new("REVIEW_SOURCE_PATH"))?;
        require(
            paths.insert(source.path.to_ascii_lowercase()),
            "REVIEW_SOURCE_PATH",
        )?;
    }
    Ok(packet)
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ReviewResponse {
    job_digest: String,
    input_digest: String,
    reviewer: String,
    verdict: String,
    findings: Vec<String>,
}

// Deliberately private: an untrusted caller cannot turn supplied PASS bytes into
// the type accepted by the issuer. Only the native child capture calls this path.
fn parse_result(job: &ReviewJob, bytes: &[u8]) -> Result<VerifiedReview> {
    validate_job(job)?;
    require(bytes.len() <= MAX_OUTPUT_BYTES, "REVIEW_OUTPUT_LIMIT")?;
    let response: ReviewResponse =
        serde_json::from_slice(bytes).map_err(|_| Error::new("REVIEW_OUTPUT_INVALID"))?;
    let job_digest = digest(job)?;
    require(
        response.job_digest == job_digest
            && response.input_digest == job.input_digest
            && response.reviewer == REVIEWER_ID,
        "REVIEW_BINDING",
    )?;
    require(
        response.verdict == "PASS" && response.findings.is_empty(),
        "REVIEW_NOT_PASS",
    )?;
    Ok(VerifiedReview {
        review: Review {
            repo: job.repo.clone(),
            source_sha: job.source_sha.clone(),
            artifact_sha256: job.artifact_sha256.clone(),
            manifest_digest: job.manifest_digest.clone(),
            profile_revision: job.profile_revision.clone(),
            scopes: job.scopes.clone(),
        },
        job_digest,
        evidence_digest: sha(bytes),
    })
}

#[cfg(test)]
#[path = "../../test/issuer_review/mod.rs"]
mod tests;
