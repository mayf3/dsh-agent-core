use super::*;
use crate::fs::{file::snapshot, secure::validate};
use serde::{Deserialize, Serialize};
use std::{
    fs::File,
    io::{Seek, SeekFrom, Write},
    os::{fd::AsRawFd, unix::fs::MetadataExt},
};
const MAX_LEDGER: usize = 4096;
const MAX_RECORD: u64 = 32 * 1024 * 1024;
#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct Ledger {
    pub revision: u64,
    pub previous_digest: Option<String>,
    pub rows: BTreeMap<String, DeploymentRecord>,
    pub snapshot: Signed<ProducerSnapshot>,
}
impl Signable for Ledger {
    const DOMAIN: &'static str = "DeploymentRegistryLedger";
    const ROLE: Role = Role::Producer;
}
pub(super) fn initialize(root: &Dir) -> Result<()> {
    require(
        root.file.metadata()?.mode() & 0o7777 == 0o700,
        "UNSAFE_MODE",
    )?;
    let file = root.open_file("registry.lock", libc::O_RDWR | libc::O_CREAT, 0o600)?;
    validate(&file, root.uid, false)?;
    require(file.metadata()?.mode() & 0o7777 == 0o600, "UNSAFE_MODE")?;
    file.sync_all()?;
    root.file.sync_all()?;
    Ok(())
}
pub(super) fn lock(root: &Dir) -> Result<File> {
    let file = root.open_file("registry.lock", libc::O_RDWR, 0)?;
    validate(&file, root.uid, false)?;
    require(file.metadata()?.mode() & 0o7777 == 0o600, "UNSAFE_MODE")?;
    require(
        unsafe { libc::flock(file.as_raw_fd(), libc::LOCK_EX | libc::LOCK_NB) } == 0,
        "REGISTRY_BUSY",
    )?;
    let named = root
        .open_file("registry.lock", libc::O_RDONLY, 0)?
        .metadata()?;
    let opened = file.metadata()?;
    require(
        (named.dev(), named.ino()) == (opened.dev(), opened.ino()),
        "REGISTRY_REPLACED",
    )?;
    Ok(file)
}
fn bytes(root: &Dir, file: &File) -> Result<Vec<u8>> {
    let image = snapshot(file, root.uid, MAX_RECORD)?;
    require(image.mode == 0o600, "UNSAFE_MODE")?;
    Ok(image.bytes)
}
impl Registry {
    pub(super) fn history(&self) -> Result<Vec<Signed<Ledger>>> {
        let names = self.root.names_bounded(MAX_LEDGER + 2)?;
        let mut history: Vec<Signed<Ledger>> = Vec::new();
        for name in names {
            if name == "registry.lock" || name == "pending.tmp" {
                continue;
            }
            let revision = history.len() as u64 + 1;
            require(
                name == format!("state-{revision:020}.json"),
                "REGISTRY_HISTORY_GAP",
            )?;
            let file = self.root.open_file(&name, libc::O_RDONLY, 0)?;
            let raw = bytes(&self.root, &file)?;
            let ledger: Signed<Ledger> = serde_json::from_slice(&raw)?;
            let catalog = if let Some(b) = &self.bridge {
                b.catalog(revision, &raw, &self.catalog)?
            } else {
                &self.catalog
            };
            verify_signed(&ledger, catalog, &self.producer)?;
            let s = &ledger.payload;
            let previous = history.last().map(digest).transpose()?;
            require(
                ledger.issuer == self.producer
                    && s.revision == revision
                    && s.previous_digest == previous,
                "REGISTRY_HISTORY_BINDING",
            )?;
            verify_signed(&s.snapshot, catalog, &self.producer)?;
            require(
                s.snapshot.issuer == self.producer
                    && s.snapshot.payload.producer_id == self.producer
                    && s.snapshot.payload.revision == revision
                    && s.snapshot.payload.previous_revision == revision - 1
                    && s.snapshot.payload.watermark == revision,
                "REGISTRY_HISTORY_BINDING",
            )?;
            for (id, row) in &s.rows {
                validation::enrollment(catalog, &self.producer, &row.enrollment)?;
                require(
                    id == &row.enrollment.payload.goal_id && !row.business_goal_complete,
                    "REGISTRY_HISTORY_BINDING",
                )?;
                if let Some(ready) = &row.ready {
                    verify_signed(ready, catalog, &self.producer)?;
                }
            }
            require(
                s.snapshot.payload.records == records(&s.rows),
                "REGISTRY_HISTORY_BINDING",
            )?;
            if revision == 2 {
                if let Some(b) = &self.bridge {
                    b.carry(s)?;
                }
            }
            // Retried acknowledgement must finish durability after a visible rename
            // whose fsync may previously have failed. Visibility alone is not commit.
            #[cfg(test)]
            super::durability::before_history_sync()?;
            file.sync_all()?;
            history.push(ledger);
        }
        require(
            self.bridge.is_none() || history.len() >= 2,
            "CUSTODY_INCOMPLETE",
        )?;
        self.root.file.sync_all()?;
        Ok(history)
    }
    pub(super) fn commit(
        &self,
        history: &[Signed<Ledger>],
        rows: BTreeMap<String, DeploymentRecord>,
    ) -> Result<()> {
        require(history.len() < MAX_LEDGER, "REGISTRY_QUOTA")?;
        let revision = history.len() as u64 + 1;
        let snapshot = self.sign(ProducerSnapshot {
            producer_id: self.producer.clone(),
            revision,
            previous_revision: revision - 1,
            records: records(&rows),
            watermark: revision,
        })?;
        let ledger = self.sign(Ledger {
            revision,
            previous_digest: history.last().map(digest).transpose()?,
            rows,
            snapshot,
        })?;
        let raw = canonical_bytes(&ledger)?;
        require(raw.len() <= MAX_RECORD as usize, "SIZE_LIMIT")?;
        publish(&self.root, &format!("state-{revision:020}.json"), &raw)
    }
}
fn records(rows: &BTreeMap<String, DeploymentRecord>) -> Vec<Signed<ReadyRecord>> {
    rows.values().filter_map(|row| row.ready.clone()).collect()
}
// Called while the permanent registry lock is held. An interrupted exact prefix can
// resume; a different operation cannot overwrite ambiguous uncommitted bytes.
pub(super) fn publish(root: &Dir, name: &str, raw: &[u8]) -> Result<()> {
    let mut file = match root.open_file("pending.tmp", libc::O_RDWR, 0) {
        Ok(file) => file,
        Err(e) if e.code() == "ABSENT" => root.open_file(
            "pending.tmp",
            libc::O_RDWR | libc::O_CREAT | libc::O_EXCL,
            0o600,
        )?,
        Err(e) => return Err(e),
    };
    let prefix = bytes(root, &file)?;
    require(raw.starts_with(&prefix), "REGISTRY_PENDING_CONFLICT")?;
    file.seek(SeekFrom::Start(prefix.len() as u64))?;
    file.write_all(&raw[prefix.len()..])?;
    require(bytes(root, &file)? == raw, "INPUT_CHANGED")?;
    file.sync_all()?;
    root.file.sync_all()?;
    root.rename("pending.tmp", root, name)
}
