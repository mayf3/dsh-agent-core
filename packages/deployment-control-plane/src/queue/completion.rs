//! Existing rollback database only; never initializes, migrates or repairs.
use super::*;
use crate::fs::secure::{validate, Dir};
use std::os::unix::fs::MetadataExt;
pub(super) struct ReadOnly {
    root: Dir,
    path: std::path::PathBuf,
    device: u64,
    inode: u64,
}
impl ReadOnly {
    pub(super) fn check(&self) -> Result<()> {
        for name in ["queue.db-wal", "queue.db-shm", "queue.db-journal"] {
            match self.root.open_file(name, libc::O_RDONLY, 0) {
                Err(e) if e.code() == "ABSENT" => (),
                _ => return Err(Error::new("COMPLETION_DATABASE_SIDECAR")),
            }
        }
        let f = self.root.open_file("queue.db", libc::O_RDONLY, 0)?;
        validate(&f, self.root.uid, false)?;
        let m = f.metadata()?;
        require(
            m.mode() & 0o7777 == 0o600 && (m.dev(), m.ino()) == (self.device, self.inode),
            "COMPLETION_DATABASE_IDENTITY",
        )?;
        let named = std::fs::symlink_metadata(&self.path)?;
        require(
            named.file_type().is_file() && (named.dev(), named.ino()) == (self.device, self.inode),
            "COMPLETION_DATABASE_IDENTITY",
        )
    }
}
impl Queue {
    pub(crate) fn open_existing_readonly(root: &Dir, path: &std::path::Path) -> Result<Self> {
        let f = root.open_file("queue.db", libc::O_RDONLY, 0)?;
        let m = f.metadata()?;
        let read = ReadOnly {
            root: Dir {
                file: root.file.try_clone()?,
                uid: root.uid,
            },
            path: path.to_owned(),
            device: m.dev(),
            inode: m.ino(),
        };
        read.check()?;
        let conn = Connection::open_with_flags(path, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)?;
        conn.busy_timeout(std::time::Duration::from_secs(5))?;
        conn.execute_batch("PRAGMA query_only=ON;")?;
        let mode: String = conn.query_row("PRAGMA journal_mode", [], |r| r.get(0))?;
        require(mode == "delete", "COMPLETION_DATABASE_MODE")?;
        let integrity: String = conn.query_row("PRAGMA quick_check", [], |r| r.get(0))?;
        require(integrity == "ok", "CORRUPT_JOURNAL")?;
        read.check()?;
        Ok(Self {
            connection: Mutex::new(conn),
            read_only: Some(read),
        })
    }
}
#[derive(Clone, Debug, serde::Serialize, PartialEq, Eq)]
pub(crate) struct Projection {
    pub current: Option<CurrentInstallation>,
    pub status: Option<UnitStatus>,
    pub goal: Option<Signed<GoalReceipt>>,
    pub ready: Option<Signed<ReadyRecord>>,
    pub attachment: Option<String>,
    pub outbox: Option<(OutboxEntry, bool)>,
    pub pending: u64,
    pub quarantine: u64,
}
impl Queue {
    pub(crate) fn completion_projection(&self, goal: &str, target: &str) -> Result<Projection> {
        self.transaction(|tx| projection(tx, goal, target))
    }
    pub(crate) fn completion_unchanged(
        &self,
        goal: &str,
        target: &str,
        before: &Projection,
    ) -> Result<()> {
        require(
            self.completion_projection(goal, target)? == *before,
            "COMPLETION_SNAPSHOT_CHANGED",
        )
    }
}
fn projection(tx: &Transaction<'_>, goal: &str, target: &str) -> Result<Projection> {
    let current = super::physical::current(tx, target)?;
    let mut p = Projection {
        current: current.clone(),
        status: None,
        goal: None,
        ready: None,
        attachment: None,
        outbox: None,
        pending: tx.query_row("SELECT count(*) FROM executor_pending", [], |r| r.get(0))?,
        quarantine: tx.query_row("SELECT value FROM meta WHERE key='quarantine'", [], |r| {
            r.get(0)
        })?,
    };
    let Some(current) = current else { return Ok(p) };
    let unit = &current.unit_id;
    p.status = Some(read_status(tx, unit)?);
    let coverage: Option<(String, String)> = tx
        .query_row(
            "SELECT record,attachment FROM coverage WHERE unit=? AND goal=?",
            (unit, goal),
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()?;
    if let Some((record, attachment)) = coverage {
        p.ready = Some(parse(record)?);
        p.attachment = Some(attachment);
    }
    // Select latest first; a dangling latest row must never expose an older PASS.
    let receipt:Option<(String,String,u64)>=tx.query_row(
        "SELECT digest,record,revision FROM goal_receipts WHERE unit=? AND goal=? ORDER BY revision DESC LIMIT 1",
        (unit,goal),|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?))
    ).optional()?;
    if let Some((hash, raw, revision)) = receipt {
        let retained: String = tx.query_row(
            "SELECT record FROM receipts WHERE digest=? AND unit=? AND kind='goal'",
            (&hash, unit),
            |r| r.get(0),
        )?;
        let record: Signed<GoalReceipt> = parse(raw.clone())?;
        require(
            crate::trust::digest(&record)? == hash
                && raw == retained
                && record.payload.revision == revision
                && record.payload.unit_id == *unit
                && record.payload.goal_id == goal,
            "RECEIPT_BINDING",
        )?;
        p.goal = Some(record);
    }
    let mut stmt=tx.prepare("SELECT id,goal,producer,expected_revision,receipt,delivered FROM outbox WHERE unit=? AND goal=?")?;
    let rows = stmt
        .query_map((unit, goal), |r| {
            Ok((
                OutboxEntry {
                    id: r.get(0)?,
                    goal_id: r.get(1)?,
                    producer_id: r.get(2)?,
                    expected_producer_revision: r.get(3)?,
                    receipt_digest: r.get(4)?,
                },
                r.get::<_, u64>(5)?,
            ))
        })?
        .collect::<std::result::Result<Vec<_>, _>>()?;
    require(rows.len() <= 1, "COMPLETION_OUTBOX_AMBIGUOUS")?;
    if let Some((entry, delivered)) = rows.into_iter().next() {
        require(delivered <= 1, "CLOSURE_BINDING")?;
        p.outbox = Some((entry, delivered == 1));
    }
    Ok(p)
}
#[cfg(test)]
#[path = "../../test/completion/database.rs"]
mod tests;
