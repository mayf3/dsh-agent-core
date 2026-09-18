//! Durable, resumable evidence publication. No production mutation occurs here.
use super::coordinator::{immutable, read};
use crate::{
    error::require,
    fs::{
        file::snapshot,
        secure::{validate, Dir},
    },
    model::*,
    registry::{DeploymentState, Registry},
    trust::{canonical_bytes, digest, validate_proposal},
    Error, Result,
};
use serde::{Deserialize, Serialize};

#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct IssueBinding {
    pub goal_id: String,
    pub source_sha: String,
    pub revision: u64,
    pub profile_digest: String,
    pub source_policy_digest: String,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct Draft {
    pub binding: IssueBinding,
    pub proposal: Proposal,
    pub canonical_lineage_digest: String,
    pub review_job_digest: String,
    pub review_evidence_digest: String,
}
pub(crate) fn pending(root: &Dir, binding: &IssueBinding) -> Result<Option<Draft>> {
    let id = digest(binding)?;
    let dir = root.child("issuer-jobs")?;
    let draft_digest: String = match read(&dir, &format!("draft-binding-{id}.json")) {
        Ok(value) => value,
        Err(e) if e.code() == "ABSENT" => return Ok(None),
        Err(e) => return Err(e),
    };
    crate::trust::valid_digest(&draft_digest)?;
    let draft: Draft = read(&dir, &format!("draft-{draft_digest}.json"))?;
    require(
        digest(&draft)? == draft_digest && digest(&draft.binding)? == id,
        "ISSUANCE_BINDING",
    )?;
    Ok(Some(draft))
}
pub(crate) fn save(root: &Dir, draft: &Draft) -> Result<()> {
    reserve(root, 4 * 1024 * 1024 + 256, 3)?;
    let dir = root.child("issuer-jobs")?;
    let binding = digest(&draft.binding)?;
    let content = digest(draft)?;
    if let Some(previous) = pending(root, &draft.binding)? {
        return require(digest(&previous)? == content, "ISSUANCE_BINDING");
    }
    // Unpublished attempts use content-addressed names. A crash before the atomic
    // binding index leaves retained evidence but cannot reserve the binding with
    // variable review bytes. The first complete index is the only authoritative one.
    immutable(
        &dir,
        &format!("draft-{content}.json"),
        &canonical_bytes(draft)?,
    )?;
    let candidate = format!("binding-{binding}-{content}.json");
    immutable(&dir, &candidate, &canonical_bytes(&content)?)?;
    dir.rename(&candidate, &dir, &format!("draft-binding-{binding}.json"))
}

/// Renewal changes only the lease/request identity; exact signed build/review/READY
/// evidence survives a restart. Registry CAS must complete before caller receives it.
pub(crate) struct Publication<'a> {
    pub catalog: &'a Catalog,
    pub registry: &'a Registry,
    pub actor: &'a Actor,
}
pub(crate) fn publish(
    root: &Dir,
    context: Publication<'_>,
    draft: &Draft,
    policy: Signed<Policy>,
    now: u64,
    fault: Option<u8>,
) -> Result<String> {
    let Publication {
        catalog,
        registry,
        actor,
    } = context;
    let mut proposal = draft.proposal.clone();
    proposal.policy = policy;
    proposal.request_id.clear();
    proposal.request_id = digest(&proposal)?;
    validate_proposal(catalog, actor, &proposal, now)?;
    let id = digest(&proposal)?;
    let raw = canonical_bytes(&proposal)?;
    reserve(root, raw.len() as u64 + 4096, 2)?;
    let jobs = root.child("issuer-jobs")?;
    immutable(
        &jobs,
        &format!("publication-{id}.json"),
        &canonical_bytes(&(
            digest(&draft.binding)?,
            &id,
            &draft.review_job_digest,
            &draft.review_evidence_digest,
        ))?,
    )?;
    fail(fault, 1)?;
    immutable(
        &root.child("intake")?.child("proposals")?,
        &format!("{id}.json"),
        &raw,
    )?;
    fail(fault, 2)?;
    let row = registry.get(&draft.binding.goal_id)?;
    if row.state == DeploymentState::Pending {
        require(row.revision == draft.binding.revision, "REGISTRY_CAS")?;
        registry.activate(actor, &proposal, row.revision, now)?;
    } else {
        require(row.ready.as_ref() == proposal.goals.first(), "REGISTRY_CAS")?;
    }
    fail(fault, 3)?;
    Ok(id)
}
fn fail(fault: Option<u8>, point: u8) -> Result<()> {
    require(!cfg!(test) || fault != Some(point), "ISSUANCE_INTERRUPTED")
}

const MAX_BYTES: u64 = 512 * 1024 * 1024;
const MAX_FILES: usize = 8192;
/// Caller holds issuer.lock. Count every retained byte, including failed/partial
/// records, before the first write. Never garbage-collect pinned evidence to pass.
pub(crate) fn reserve(root: &Dir, add_bytes: u64, add_files: usize) -> Result<()> {
    let mut bytes = 0u64;
    let mut files = 0usize;
    for name in ["staging", "issuer-jobs"] {
        census(&root.child(name)?, 0, &mut bytes, &mut files)?;
    }
    census(
        &root.child("intake")?.child("proposals")?,
        0,
        &mut bytes,
        &mut files,
    )?;
    require(
        bytes.checked_add(add_bytes).is_some_and(|n| n <= MAX_BYTES)
            && files.checked_add(add_files).is_some_and(|n| n <= MAX_FILES),
        "ISSUER_STORAGE_QUOTA",
    )
}
fn census(dir: &Dir, depth: usize, bytes: &mut u64, files: &mut usize) -> Result<()> {
    require(depth <= 2, "ISSUER_STORAGE_QUOTA")?;
    for name in dir.names_bounded(MAX_FILES)? {
        let file = dir.open_file(&name, libc::O_RDONLY, 0)?;
        let meta = file.metadata()?;
        validate(&file, dir.uid, meta.is_dir())?;
        *files = files
            .checked_add(1)
            .ok_or(Error::new("ISSUER_STORAGE_QUOTA"))?;
        require(*files <= MAX_FILES, "ISSUER_STORAGE_QUOTA")?;
        if meta.is_dir() {
            census(&Dir { file, uid: dir.uid }, depth + 1, bytes, files)?;
        } else {
            *bytes = bytes
                .checked_add(meta.len())
                .ok_or(Error::new("ISSUER_STORAGE_QUOTA"))?;
            require(*bytes <= MAX_BYTES, "ISSUER_STORAGE_QUOTA")?;
        }
    }
    Ok(())
}

pub(crate) fn verify_draft_artifact(root: &Dir, draft: &Draft) -> Result<()> {
    let b = &draft.proposal.build.payload;
    let stage = root.child("staging")?.child(&b.artifact_sha256)?;
    let manifest: crate::fs::ArtifactManifest = read(&stage, "manifest.json")?;
    require(
        digest(&manifest)? == b.manifest_digest
            && crate::fs::file::sha(&canonical_bytes(&manifest)?) == b.artifact_sha256,
        "ARTIFACT_MISMATCH",
    )?;
    for entry in &manifest.entries {
        let raw = snapshot(
            &stage.open_file(&entry.blob, libc::O_RDONLY, 0)?,
            stage.uid,
            64 * 1024 * 1024,
        )?
        .bytes;
        require(
            raw.len() as u64 == entry.size && crate::fs::file::sha(&raw) == entry.sha256,
            "ARTIFACT_MISMATCH",
        )?;
    }
    Ok(())
}

#[cfg(test)]
#[path = "../../test/issuer/issuance.rs"]
mod tests;

/// Serialized issuance cannot reserve conflicting artifacts for the same target.
pub(crate) fn admit_target(
    root: &Dir,
    registry: &Registry,
    goal: &str,
    target: &str,
    artifact: &str,
) -> Result<()> {
    let jobs = root.child("issuer-jobs")?;
    for name in jobs.names_bounded(MAX_FILES)? {
        if !name.starts_with("draft-binding-") || !name.ends_with(".json") {
            continue;
        }
        let hash: String = read(&jobs, &name)?;
        crate::trust::valid_digest(&hash)?;
        let draft: Draft = read(&jobs, &format!("draft-{hash}.json"))?;
        require(digest(&draft)? == hash, "ISSUANCE_BINDING")?;
        if draft.binding.goal_id == goal || draft.proposal.desired.payload.target_runtime != target
        {
            continue;
        }
        let row = registry.get(&draft.binding.goal_id)?;
        require(
            row.state == DeploymentState::Closed
                || draft.proposal.build.payload.artifact_sha256 == artifact,
            "ISSUER_TARGET_PENDING",
        )?;
    }
    Ok(())
}
