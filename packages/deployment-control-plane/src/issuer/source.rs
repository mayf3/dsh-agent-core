//! Canonical source and deterministic regular-file build observation.
use crate::{
    error::require,
    fs::{file::sha, secure::relative, ArtifactEntry, ArtifactManifest},
    trust::{canonical_bytes, digest},
    Error, Result,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{BTreeMap, BTreeSet};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SourceSlot {
    pub source: String,
    pub target: String,
    pub executable: bool,
}
pub struct BuiltFiles {
    pub manifest: ArtifactManifest,
    pub artifact_digest: String,
    pub blobs: BTreeMap<String, Vec<u8>>,
}
pub(crate) fn source_sha(s: &str) -> Result<()> {
    require(
        s.len() == 40
            && s.bytes()
                .all(|c| c.is_ascii_digit() || (b'a'..=b'f').contains(&c)),
        "INVALID_SOURCE",
    )
}
pub(crate) fn validate_lineage(source: &str, compare: &Value) -> Result<()> {
    source_sha(source)?;
    require(
        compare["merge_base_commit"]["sha"] == source
            && compare["base_commit"]["sha"] == source
            && matches!(compare["status"].as_str(), Some("ahead" | "identical")),
        "CANONICAL_LINEAGE",
    )
}
pub(crate) fn parse_tree(expected: &str, value: &Value) -> Result<BTreeMap<String, String>> {
    source_sha(expected)?;
    require(
        value["sha"] == expected && value["truncated"] == false,
        "SOURCE_TREE_INCOMPLETE",
    )?;
    let items = value["tree"]
        .as_array()
        .ok_or(Error::new("SOURCE_TREE_INCOMPLETE"))?;
    require(items.len() <= 100_000, "SIZE_LIMIT")?;
    let mut result = BTreeMap::new();
    for item in items {
        let path = item["path"].as_str().ok_or(Error::new("INVALID_RECORD"))?;
        // Tree paths outside the regular release face may contain Git's wider path
        // alphabet. Only selected slots are admitted by strict relative().
        require(!path.is_empty() && path.len() <= 4096, "UNSAFE_PATH")?;
        let mode = item["mode"].as_str().ok_or(Error::new("INVALID_RECORD"))?;
        if mode == "040000" && item["type"] == "tree" {
            continue;
        }
        require(
            matches!(mode, "100644" | "100755") && item["type"] == "blob",
            "SOURCE_NONREGULAR",
        )?;
        let blob = item["sha"].as_str().ok_or(Error::new("INVALID_RECORD"))?;
        source_sha(blob)?;
        require(
            result.insert(path.into(), blob.into()).is_none(),
            "DUPLICATE_SLOT",
        )?;
    }
    Ok(result)
}

/// Pure regular-file copying: no candidate package manager, script or interpreter.
/// Caller input is not provenance; native coordinator supplies canonical observations.
pub fn build_regular_files(
    slots: &[SourceSlot],
    observed: &BTreeMap<String, Vec<u8>>,
) -> Result<BuiltFiles> {
    require(!slots.is_empty() && slots.len() <= 4096, "INVALID_MANIFEST")?;
    let mut entries = Vec::new();
    let mut blobs = BTreeMap::new();
    let mut targets = BTreeSet::new();
    let mut total = 0usize;
    for slot in slots {
        relative(&slot.source)?;
        relative(&slot.target)?;
        require(
            targets.insert(slot.target.to_ascii_lowercase()),
            "DUPLICATE_SLOT",
        )?;
        let bytes = observed
            .get(&slot.source)
            .ok_or(Error::new("SOURCE_SLOT_MISSING"))?;
        total = total
            .checked_add(bytes.len())
            .ok_or(Error::new("SIZE_LIMIT"))?;
        require(total <= 64 * 1024 * 1024, "SIZE_LIMIT")?;
        let blob = format!("blob-{:04}", entries.len());
        entries.push(ArtifactEntry {
            path: slot.target.clone(),
            blob: blob.clone(),
            sha256: sha(bytes),
            size: bytes.len() as u64,
            executable: slot.executable,
        });
        blobs.insert(blob, bytes.clone());
    }
    for target in &targets {
        require(
            !targets
                .iter()
                .any(|other| other != target && other.starts_with(&format!("{target}/"))),
            "DUPLICATE_SLOT",
        )?;
    }
    let manifest = ArtifactManifest {
        version: 1,
        entries,
    };
    let artifact_digest = digest(&manifest)?;
    blobs.insert("manifest.json".into(), canonical_bytes(&manifest)?);
    Ok(BuiltFiles {
        manifest,
        artifact_digest,
        blobs,
    })
}

#[cfg(test)]
#[path = "../../test/issuer/source.rs"]
mod tests;

/// Bind declared frozen build inputs to the authenticated activated target and
/// exact protected issuer executable; callers cannot supply these observations.
pub(crate) fn bound_dependencies(
    declared: &[String],
    enrollment: &str,
    issuer: &str,
) -> Result<Vec<String>> {
    require(!declared.is_empty(), "DEPENDENCY_CLOSURE")?;
    let mut hashes = declared.to_vec();
    hashes.extend([enrollment.into(), issuer.into()]);
    for hash in &hashes {
        crate::trust::valid_digest(hash)?;
    }
    hashes.sort();
    hashes.dedup();
    Ok(hashes)
}
