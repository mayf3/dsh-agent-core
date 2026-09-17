use super::service::ServiceImage;
use crate::{
    error::require,
    fs::{
        file::{snapshot, write_new, FileImage},
        secure::Dir,
    },
    model::TransactionReceipt,
    trust::digest,
    Error, Result,
};
use serde::{Deserialize, Serialize};
use std::os::unix::fs::MetadataExt;

// Three install records + two restore records per slot, plus bounded service/phase records.
pub(crate) const MAX_EVENTS: usize = 5 * crate::fs::artifact::MAX_SLOTS + 256;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) enum Event {
    Preflight {
        unit: String,
        attempt: u32,
        policy: String,
        attachments: Vec<String>,
        before: Vec<(String, Option<FileImage>)>,
        service: ServiceImage,
        installed_before: Option<crate::model::CurrentInstallation>,
    },
    Applying,
    SlotIntent {
        path: String,
        temporary: String,
    },
    Prepared {
        path: String,
        image: FileImage,
    },
    Installed {
        path: String,
        image: FileImage,
    },
    OperationIntent {
        action: String,
        owner: String,
    },
    OperationSpawned {
        action: String,
        process: String,
        kernel: Option<super::process::ProcessIdentity>,
    },
    OperationExit {
        action: String,
        process: String,
        success: bool,
    },
    FixtureStarted {
        process: super::ProcessIdentity,
    },
    FixtureStopped,
    ServiceStopped,
    ServiceStarted {
        image: ServiceImage,
    },
    Verified {
        receipt: TransactionReceipt,
    },
    RollbackIntent {
        path: String,
    },
    Restored {
        path: String,
    },
    RolledBack {
        service: ServiceImage,
    },
    Finalized,
    Quarantined {
        reason: String,
    },
}
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Record {
    sequence: u64,
    previous: String,
    event: Event,
}
pub(crate) struct Journal {
    dir: Dir,
    pub events: Vec<Event>,
    last: String,
}
impl Journal {
    pub fn create(root: &Dir, unit: &str, attempt: u32, preflight: u32) -> Result<Self> {
        let name = format!("{unit}-{attempt}-{preflight}");
        let names = root.names()?;
        require(names.len() < 8192, "JOURNAL_DIRECTORY_LIMIT")?;
        require(!names.contains(&name), "TRANSACTION_EXISTS")?;
        Ok(Self {
            dir: root.mkdir(&name)?,
            events: vec![],
            last: "0".repeat(64),
        })
    }
    pub fn for_receipt(root: &Dir, receipt: &TransactionReceipt) -> Result<Self> {
        let legacy = format!("{}-{}", receipt.unit_id, receipt.attempt);
        let prefix = format!("{legacy}-");
        let expected = digest(receipt)?;
        let mut found = None;
        for name in root
            .names()?
            .into_iter()
            .filter(|n| n.starts_with(&prefix) || n == &legacy)
        {
            let candidate = Self::load(root, &name)?;
            if candidate.events.iter().any(|e| matches!(e, Event::Verified { receipt } if digest(receipt).ok().as_ref() == Some(&expected))) {
                require(found.is_none(), "AMBIGUOUS_TRANSACTION")?;
                found = Some(candidate);
            }
        }
        found.ok_or(Error::new("NO_VERIFIED_RECEIPT"))
    }
    pub fn load(root: &Dir, name: &str) -> Result<Self> {
        let dir = root.child(name)?;
        let mut result = Self {
            dir,
            events: vec![],
            last: "0".repeat(64),
        };
        let names = result.dir.names_bounded(MAX_EVENTS)?;
        require(
            !names.is_empty() && names.len() <= MAX_EVENTS,
            "CORRUPT_JOURNAL",
        )?;
        for (i, name) in names.iter().enumerate() {
            require(name == &format!("{:06}.json", i + 1), "CORRUPT_JOURNAL")?;
            let raw = snapshot(
                &result.dir.open_file(name, libc::O_RDONLY, 0)?,
                root.uid,
                768 * 1024 * 1024,
            )?
            .bytes;
            let record: Record = serde_json::from_slice(&raw)?;
            require(
                record.sequence == (i + 1) as u64 && record.previous == result.last,
                "CORRUPT_JOURNAL",
            )?;
            result.last = digest(&record)?;
            result.events.push(record.event);
        }
        Ok(result)
    }
    pub fn finalized_proof(&self) -> Result<super::VerifiedFinalization> {
        require(
            matches!(self.events.last(), Some(Event::Finalized)),
            "FINALIZATION_PENDING",
        )?;
        let receipt = self
            .events
            .iter()
            .rev()
            .find_map(|e| match e {
                Event::Verified { receipt } => Some(receipt.clone()),
                _ => None,
            })
            .ok_or(Error::new("NO_VERIFIED_RECEIPT"))?;
        self.dir
            .open_file(&format!("{:06}.json", self.events.len()), libc::O_RDONLY, 0)?
            .sync_all()?;
        self.dir.file.sync_all()?;
        Ok(super::VerifiedFinalization(receipt))
    }
    pub fn append(&mut self, event: Event) -> Result<String> {
        require(self.events.len() < MAX_EVENTS, "JOURNAL_LIMIT")?;
        let sequence = self.events.len() as u64 + 1;
        let record = Record {
            sequence,
            previous: self.last.clone(),
            event: event.clone(),
        };
        let hash = digest(&record)?;
        let bytes = serde_json::to_vec(&record)?;
        let gid = self.dir.file.metadata()?.gid();
        #[cfg(test)]
        if self.dir.uid != 0
            && std::env::var("DCP_TEST_DENY_EDGE")
                .ok()
                .and_then(|s| s.parse::<u64>().ok())
                == Some(sequence)
        {
            use std::os::fd::AsRawFd;
            assert_eq!(unsafe { libc::fchmod(self.dir.file.as_raw_fd(), 0o500) }, 0);
        }
        write_new(
            &self.dir,
            &format!("{sequence:06}.json"),
            &bytes,
            self.dir.uid,
            gid,
            0o400,
        )?;
        self.events.push(event);
        self.last = hash.clone();
        #[cfg(test)]
        if self.dir.uid != 0
            && std::env::var("DCP_TEST_CRASH_EDGE")
                .ok()
                .and_then(|s| s.parse::<usize>().ok())
                == Some(self.events.len())
        {
            std::process::exit(75);
        }
        Ok(hash)
    }
    pub fn operations_resolved(&self) -> bool {
        let mut pending = std::collections::BTreeSet::new();
        for e in &self.events {
            match e {
                Event::OperationIntent { action, .. } => {
                    pending.insert(action);
                }
                Event::OperationExit {
                    action,
                    success: true,
                    ..
                } => {
                    pending.remove(action);
                }
                Event::FixtureStarted { .. } => {
                    pending.retain(|s| s.as_str() != "fixture-start");
                }
                Event::FixtureStopped => {
                    pending.retain(|s| s.as_str() != "fixture-stop");
                }
                _ => (),
            }
        }
        pending.is_empty()
    }
    pub fn terminal(&self) -> bool {
        matches!(
            self.events.last(),
            Some(Event::Finalized | Event::RolledBack { .. })
        )
    }
    pub fn identity(&self) -> Result<(&str, u32)> {
        match self.events.first() {
            Some(Event::Preflight { unit, attempt, .. }) => Ok((unit, *attempt)),
            _ => Err(Error::new("CORRUPT_JOURNAL")),
        }
    }
}
