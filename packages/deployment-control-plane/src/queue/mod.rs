mod admission;
mod dependencies;
mod executor_finalization;
mod gates;
mod issuance;
mod lifecycle;
mod producer;
mod readback;
mod receipts;
mod schema;
use crate::{error::require, model::*, Error, Result};
use rusqlite::{Connection, OptionalExtension, Transaction, TransactionBehavior};
use std::sync::Mutex;
pub struct Queue {
    connection: Mutex<Connection>,
}
impl Queue {
    /// The daemon must supply a protected path; this library never establishes root ownership.
    pub fn open(path: impl AsRef<std::path::Path>) -> Result<Self> {
        let mut conn = Connection::open(path)?;
        conn.busy_timeout(std::time::Duration::from_secs(5))?;
        conn.execute_batch(schema::SCHEMA)?;
        schema::migrate_verification(&mut conn)?;
        let integrity: String = conn.query_row("PRAGMA quick_check", [], |r| r.get(0))?;
        require(integrity == "ok", "CORRUPT_JOURNAL")?;
        Ok(Self {
            connection: Mutex::new(conn),
        })
    }
    fn transaction<T>(&self, f: impl FnOnce(&Transaction<'_>) -> Result<T>) -> Result<T> {
        let mut conn = self
            .connection
            .lock()
            .map_err(|_| Error::new("STORE_FAILURE"))?;
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let value = f(&tx)?;
        tx.commit()?;
        Ok(value)
    }
    pub fn unit_count(&self) -> Result<u64> {
        self.transaction(|tx| Ok(tx.query_row("SELECT count(*) FROM units", [], |r| r.get(0))?))
    }
    pub fn install_intents_for_target(&self, target: &str) -> Result<u64> {
        self.transaction(|tx| {
            Ok(tx.query_row(
                "SELECT count(*) FROM intents WHERE target=?",
                [target],
                |r| r.get(0),
            )?)
        })
    }
    pub fn status(&self, actor: &Actor, id: &str) -> Result<UnitStatus> {
        self.transaction(|tx| {
            authorize(tx, actor, id)?;
            executor_finalization::projected_status(tx, id)
        })
    }
    /// Daemon-only read. Transport must use actor-scoped status instead.
    pub fn daemon_status(&self, id: &str) -> Result<UnitStatus> {
        self.transaction(|tx| read_status(tx, id))
    }
}
fn json<T: serde::Serialize>(v: &T) -> Result<String> {
    Ok(serde_json::to_string(v)?)
}
fn parse<T: serde::de::DeserializeOwned>(v: String) -> Result<T> {
    Ok(serde_json::from_str(&v)?)
}
fn authorize(tx: &Transaction<'_>, actor: &Actor, id: &str) -> Result<()> {
    require(
        tx.query_row(
            "SELECT 1 FROM actors WHERE unit=? AND actor=?",
            (id, &actor.id),
            |_| Ok(()),
        )
        .optional()?
        .is_some(),
        "ACTOR_SCOPE",
    )
}
fn read_status(tx: &Transaction<'_>, id: &str) -> Result<UnitStatus> {
    let row = tx.query_row("SELECT u.descriptor,u.state,u.revision,u.seq,i.preflight,i.mutations FROM units u JOIN intents i ON i.id=u.intent WHERE u.id=?", [id],
        |r| Ok((r.get::<_,String>(0)?,r.get::<_,String>(1)?,r.get(2)?,r.get(3)?,r.get(4)?,r.get(5)?)))
        .optional()?.ok_or(Error::new("UNKNOWN_UNIT"))?;
    Ok(UnitStatus {
        unit: parse(row.0)?,
        state: parse(row.1)?,
        revision: row.2,
        sequence: row.3,
        preflight_attempts: row.4,
        mutating_attempts: row.5,
    })
}
fn bump(tx: &Transaction<'_>, key: &str) -> Result<u64> {
    tx.execute("UPDATE meta SET value=value+1 WHERE key=?", [key])?;
    Ok(tx.query_row("SELECT value FROM meta WHERE key=?", [key], |r| r.get(0))?)
}

mod executor_recovery;

mod physical;

mod service;
