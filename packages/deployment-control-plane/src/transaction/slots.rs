use super::*;
use crate::{
    error::require,
    fs::{
        file::{sha, FileImage},
        ArtifactManifest,
    },
    Error,
};
impl Executor {
    pub(super) fn validate_slots(&self, manifest: &ArtifactManifest) -> Result<()> {
        if let Some(slots) = &self.slots {
            for entry in &manifest.entries {
                let slot = slots
                    .iter()
                    .find(|s| s.path == entry.path)
                    .ok_or(Error::new("UNDECLARED_SLOT"))?;
                require(
                    slot.mutable && entry.executable == (slot.mode & 0o111 != 0),
                    "SLOT_METADATA",
                )?;
            }
        }
        Ok(())
    }
    pub(super) fn complete_face(&self) -> Result<Vec<(String, Option<FileImage>)>> {
        let mut face = Vec::new();
        let mut total = 0usize;
        if let Some(slots) = &self.slots {
            for slot in slots {
                let image = self.target.read(&slot.path)?;
                if let Some(image) = &image {
                    self.slot_metadata(slot, image)?;
                    total = total
                        .checked_add(image.bytes.len())
                        .ok_or(Error::new("PREIMAGE_SIZE_LIMIT"))?;
                    require(total <= 64 * 1024 * 1024, "PREIMAGE_SIZE_LIMIT")?;
                }
                face.push((slot.path.clone(), image));
            }
        }
        Ok(face)
    }
    pub(super) fn verify_complete_face(&self, journal: &Journal) -> Result<()> {
        let Some(slots) = &self.slots else {
            return Ok(());
        };
        let face = journal
            .events
            .iter()
            .find_map(|e| match e {
                journal::Event::CompleteFace { entries } => Some(entries),
                _ => None,
            })
            .ok_or(Error::new("INCOMPLETE_RELEASE_FACE"))?;
        require(face.len() == slots.len(), "INCOMPLETE_RELEASE_FACE")?;
        for ((path, expected), slot) in face.iter().zip(slots) {
            require(path == &slot.path, "INCOMPLETE_RELEASE_FACE")?;
            let actual = self.target.read(path)?;
            require(
                match (expected, &actual) {
                    (None, None) => true,
                    (Some(a), Some(b)) => a.content_matches(b),
                    _ => false,
                },
                "PREIMAGE_DRIFT",
            )?;
        }
        Ok(())
    }
    pub(super) fn initial_face(&self) -> Result<()> {
        if let Some(slots) = &self.slots {
            for expected in slots {
                let actual = self.target.read(&expected.path)?;
                require(
                    actual.as_ref().map(|f| sha(&f.bytes)) == expected.sha256,
                    "PREIMAGE_DRIFT",
                )?;
                if let Some(actual) = actual {
                    self.slot_metadata(expected, &actual)?;
                }
            }
        }
        Ok(())
    }
    fn slot_metadata(&self, expected: &EnrolledFile, actual: &FileImage) -> Result<()> {
        require(
            actual.uid == self.target.dir.uid
                && actual.gid == expected.gid
                && actual.mode == expected.mode,
            "PREIMAGE_DRIFT",
        )
    }
    pub(super) fn slot_mode_gid(&self, path: &str, executable: bool) -> Result<(u32, u32)> {
        if let Some(slots) = &self.slots {
            let slot = slots
                .iter()
                .find(|s| s.path == path)
                .ok_or(Error::new("UNDECLARED_SLOT"))?;
            Ok((slot.mode, slot.gid))
        } else {
            let parent = self.target.slot(path)?.parent;
            use std::os::unix::fs::MetadataExt;
            Ok((
                if executable { 0o755 } else { 0o644 },
                parent.file.metadata()?.gid(),
            ))
        }
    }
}
