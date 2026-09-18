use super::{
    file::{sha, snapshot, write_new, MAX_FILE},
    secure::{component, relative, Dir},
};
use crate::{
    error::require,
    trust::{digest, valid_digest},
    Error, Result,
};
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;
use std::os::unix::fs::MetadataExt;

pub(crate) const MAX_SLOTS: usize = 4096;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct ArtifactEntry {
    pub path: String,
    pub blob: String,
    pub sha256: String,
    pub size: u64,
    pub executable: bool,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct ArtifactManifest {
    pub version: u32,
    pub entries: Vec<ArtifactEntry>,
}
pub struct ArtifactStore {
    pub(crate) staging: Dir,
    pub(crate) sealed: Dir,
}
pub struct SealedArtifact {
    pub(crate) dir: Dir,
    pub(crate) manifest: ArtifactManifest,
    pub(crate) artifact: String,
    pub(crate) manifest_digest: String,
}
impl ArtifactManifest {
    fn validate(&self) -> Result<()> {
        require(
            self.version == 1 && !self.entries.is_empty() && self.entries.len() <= MAX_SLOTS,
            "INVALID_MANIFEST",
        )?;
        let mut paths = BTreeSet::new();
        let mut blobs = BTreeSet::from(["manifest.json".to_string()]);
        let mut total = 0u64;
        for e in &self.entries {
            relative(&e.path)?;
            component(&e.blob)?;
            valid_digest(&e.sha256)?;
            require(
                paths.insert(e.path.to_ascii_lowercase())
                    && blobs.insert(e.blob.to_ascii_lowercase()),
                "DUPLICATE_SLOT",
            )?;
            require(e.size <= MAX_FILE, "SIZE_LIMIT")?;
            total = total.checked_add(e.size).ok_or(Error::new("SIZE_LIMIT"))?;
        }
        require(total <= 64 * 1024 * 1024, "SIZE_LIMIT")?;
        for p in &paths {
            require(
                !paths
                    .iter()
                    .any(|q| q != p && q.starts_with(&format!("{p}/"))),
                "DUPLICATE_SLOT",
            )?;
        }
        Ok(())
    }
}
impl ArtifactStore {
    pub(crate) fn open_existing(
        &self,
        artifact: &str,
        manifest_digest: &str,
    ) -> Result<SealedArtifact> {
        valid_digest(artifact)?;
        valid_digest(manifest_digest)?;
        let existing = self.sealed.child(artifact)?;
        let raw = snapshot(
            &existing.open_file("manifest.json", libc::O_RDONLY, 0)?,
            existing.uid,
            1024 * 1024,
        )?
        .bytes;
        require(sha(&raw) == artifact, "ARTIFACT_MISMATCH")?;
        let manifest: ArtifactManifest = serde_json::from_slice(&raw)?;
        manifest.validate()?;
        require(digest(&manifest)? == manifest_digest, "ARTIFACT_MISMATCH")?;
        let result = SealedArtifact {
            dir: existing,
            manifest,
            artifact: artifact.into(),
            manifest_digest: manifest_digest.into(),
        };
        result.verify()?;
        Ok(result)
    }
    pub fn import(&self, artifact: &str, manifest_digest: &str) -> Result<SealedArtifact> {
        valid_digest(artifact)?;
        valid_digest(manifest_digest)?;
        match self.sealed.child(artifact) {
            Ok(_) => return self.open_existing(artifact, manifest_digest),
            Err(e) if e.code() == "ABSENT" => (),
            Err(e) => return Err(e),
        }
        let source = self.staging.child(artifact)?;
        let manifest_file = source.open_file("manifest.json", libc::O_RDONLY, 0)?;
        let raw = snapshot(&manifest_file, source.uid, 1024 * 1024)?.bytes;
        require(sha(&raw) == artifact, "ARTIFACT_MISMATCH")?;
        let manifest: ArtifactManifest = serde_json::from_slice(&raw)?;
        manifest.validate()?;
        require(digest(&manifest)? == manifest_digest, "ARTIFACT_MISMATCH")?;
        let mut expected = vec!["manifest.json".to_string()];
        expected.extend(manifest.entries.iter().map(|e| e.blob.clone()));
        expected.sort();
        require(source.names()? == expected, "MANIFEST_FILES")?;
        // A deterministic unpublished name makes a crashed intake fail closed.
        let temporary = format!("intake-{artifact}");
        require(
            !self.sealed.names()?.contains(&temporary),
            "INCOMPLETE_INTAKE",
        )?;
        let dest = self.sealed.mkdir(&temporary)?;
        let gid = dest.file.metadata()?.gid();
        write_new(&dest, "manifest.json", &raw, dest.uid, gid, 0o400)?;
        for entry in &manifest.entries {
            let opened = source.open_file(&entry.blob, libc::O_RDONLY, 0)?;
            let bytes = snapshot(&opened, source.uid, MAX_FILE)?.bytes;
            require(
                bytes.len() as u64 == entry.size && sha(&bytes) == entry.sha256,
                "ARTIFACT_MISMATCH",
            )?;
            write_new(&dest, &entry.blob, &bytes, dest.uid, gid, 0o400)?;
            require(
                snapshot(&opened, source.uid, MAX_FILE)?.bytes == bytes,
                "INPUT_CHANGED",
            )?;
        }
        require(
            source.names()? == expected
                && snapshot(&manifest_file, source.uid, 1024 * 1024)?.bytes == raw,
            "INPUT_CHANGED",
        )?;
        dest.file.sync_all()?;
        self.sealed.rename(&temporary, &self.sealed, artifact)?;
        let result = SealedArtifact {
            dir: dest,
            manifest,
            artifact: artifact.into(),
            manifest_digest: manifest_digest.into(),
        };
        result.verify()?;
        Ok(result)
    }
}
impl SealedArtifact {
    pub fn read(&self, path: &str) -> Result<Vec<u8>> {
        let e = self
            .manifest
            .entries
            .iter()
            .find(|e| e.path == path)
            .ok_or(Error::new("UNKNOWN_SLOT"))?;
        let bytes = snapshot(
            &self.dir.open_file(&e.blob, libc::O_RDONLY, 0)?,
            self.dir.uid,
            MAX_FILE,
        )?
        .bytes;
        require(
            bytes.len() as u64 == e.size && sha(&bytes) == e.sha256,
            "ARTIFACT_MISMATCH",
        )?;
        Ok(bytes)
    }
    pub fn verify(&self) -> Result<()> {
        let bytes = snapshot(
            &self.dir.open_file("manifest.json", libc::O_RDONLY, 0)?,
            self.dir.uid,
            1024 * 1024,
        )?
        .bytes;
        require(
            sha(&bytes) == self.artifact && digest(&self.manifest)? == self.manifest_digest,
            "ARTIFACT_MISMATCH",
        )?;
        let mut expected = vec!["manifest.json".to_string()];
        for e in &self.manifest.entries {
            self.read(&e.path)?;
            expected.push(e.blob.clone());
        }
        expected.sort();
        require(self.dir.names()? == expected, "MANIFEST_FILES")
    }
}

#[cfg(test)]
#[path = "../../test/completion/sealed.rs"]
mod completion_tests;
