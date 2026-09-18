//! Public history observation; no signing key, create, sync or delivery.
use super::*;
use std::{
    fs::File,
    os::{fd::AsRawFd, unix::fs::MetadataExt},
};
pub(crate) struct Observation {
    pub row: DeploymentRecord,
    pub ledger_digest: String,
    pub ledger_revision: u64,
    _lock: File,
}
pub(crate) fn observe(root: &Dir, catalog: &Catalog, goal: &str) -> Result<Observation> {
    let bridge = preactivation::load(root, catalog)?;
    read(
        &root.child("registry")?,
        catalog,
        "local-deployment-registry",
        goal,
        bridge.as_ref(),
    )
}
fn read(
    root: &Dir,
    catalog: &Catalog,
    producer: &str,
    goal: &str,
    bridge: Option<&preactivation::ValidatedBridge>,
) -> Result<Observation> {
    let lock = root.open_file("registry.lock", libc::O_RDONLY, 0)?;
    crate::fs::secure::validate(&lock, root.uid, false)?;
    require(
        root.file.metadata()?.mode() & 0o7777 == 0o700 && lock.metadata()?.mode() & 0o7777 == 0o600,
        "UNSAFE_MODE",
    )?;
    require(
        unsafe { libc::flock(lock.as_raw_fd(), libc::LOCK_EX | libc::LOCK_NB) } == 0,
        "REGISTRY_BUSY",
    )?;
    let named = root
        .open_file("registry.lock", libc::O_RDONLY, 0)?
        .metadata()?;
    let held = lock.metadata()?;
    require(
        (named.dev(), named.ino()) == (held.dev(), held.ino()),
        "REGISTRY_REPLACED",
    )?;
    require(
        !root.names()?.iter().any(|n| n == "pending.tmp"),
        "REGISTRY_INCOMPLETE",
    )?;
    let history = storage::read_history(root, catalog, producer, bridge, false)?;
    let last = history.last().ok_or(Error::new("REGISTRY_EMPTY"))?;
    let row = last
        .payload
        .rows
        .get(goal)
        .ok_or(Error::new("UNKNOWN_ENROLLMENT"))?
        .clone();
    if let Some(ack) = &row.closure {
        verify_signed(ack, catalog, producer)?;
        require(ack.issuer == producer, "CLOSURE_BINDING")?;
    }
    Ok(Observation {
        row,
        ledger_digest: digest(last)?,
        ledger_revision: last.payload.revision,
        _lock: lock,
    })
}
#[cfg(test)]
#[path = "../../test/completion/registry.rs"]
mod tests;
