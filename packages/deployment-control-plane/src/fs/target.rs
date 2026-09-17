use super::{
    file::{restore_times, snapshot, write_new, FileImage, MAX_FILE},
    secure::{relative, Dir},
};
use crate::{error::require, Error, Result};
use std::os::unix::fs::MetadataExt;

pub struct TargetRoot {
    pub(crate) dir: Dir,
}
pub(crate) struct Slot {
    pub parent: Dir,
    pub name: String,
}
impl TargetRoot {
    pub(crate) fn slot(&self, path: &str) -> Result<Slot> {
        let parts = relative(path)?;
        let mut parent = Dir {
            file: self.dir.file.try_clone()?,
            uid: self.dir.uid,
        };
        // Parent creation requires its own reviewed directory metadata journal.
        // V1 refuses missing parents instead of writing before the apply gate.
        for part in &parts[..parts.len() - 1] {
            parent = parent.child(part)?;
        }
        Ok(Slot {
            parent,
            name: parts[parts.len() - 1].into(),
        })
    }
    pub fn read(&self, path: &str) -> Result<Option<FileImage>> {
        self.slot(path)?.read()
    }
}
impl Slot {
    pub fn read(&self) -> Result<Option<FileImage>> {
        match self.parent.open_file(&self.name, libc::O_RDONLY, 0) {
            Ok(file) => Ok(Some(snapshot(&file, self.parent.uid, MAX_FILE)?)),
            Err(e) if e.code() == "ABSENT" => Ok(None),
            Err(e) => Err(e),
        }
    }
    pub fn prepare(&self, temporary: &str, bytes: &[u8], mode: u32) -> Result<FileImage> {
        let gid = self.parent.file.metadata()?.gid();
        let file = write_new(&self.parent, temporary, bytes, self.parent.uid, gid, mode)?;
        snapshot(&file, self.parent.uid, MAX_FILE)
    }
    pub fn replace(&self, temporary: &str, expected: &Option<FileImage>) -> Result<FileImage> {
        require(self.read()? == *expected, "PREIMAGE_DRIFT")?;
        self.parent.rename(temporary, &self.parent, &self.name)?;
        self.read()?.ok_or(Error::new("POSTIMAGE_ABSENT"))
    }
    pub fn restore(
        &self,
        temporary: &str,
        expected: &FileImage,
        before: &Option<FileImage>,
    ) -> Result<()> {
        require(self.read()?.as_ref() == Some(expected), "UNSAFE_ROLLBACK")?;
        match before {
            None => self.parent.unlink(&self.name)?,
            Some(image) => {
                let restored_file = write_new(
                    &self.parent,
                    temporary,
                    &image.bytes,
                    image.uid,
                    image.gid,
                    image.mode,
                )?;
                restore_times(&restored_file, image)?;
                require(self.read()?.as_ref() == Some(expected), "UNSAFE_ROLLBACK")?;
                self.parent.rename(temporary, &self.parent, &self.name)?;
                let restored = self.read()?.ok_or(Error::new("UNSAFE_ROLLBACK"))?;
                require(image.content_matches(&restored), "UNSAFE_ROLLBACK")?;
            }
        }
        Ok(())
    }
}
