use crate::{
    error::require,
    fs::{
        file::{sha, snapshot, write_new},
        secure::Dir,
    },
    trust::canonical_bytes,
    Error, Result,
};
use serde::{de::DeserializeOwned, Serialize};
use std::os::unix::fs::MetadataExt;
pub(super) fn absent(root: &Dir, name: &str) -> Result<()> {
    match root.open_file(name, libc::O_RDONLY, 0) {
        Err(e) if e.code() == "ABSENT" => Ok(()),
        Err(e) => Err(e),
        Ok(_) => Err(Error::new("FIRST_LIVE_PRIOR_STATE")),
    }
}
pub(super) fn raw(root: &Dir, name: &str) -> Result<Vec<u8>> {
    Ok(snapshot(
        &root.open_file(name, libc::O_RDONLY, 0)?,
        root.uid,
        64 * 1024 * 1024,
    )?
    .bytes)
}
pub(super) fn read<T: DeserializeOwned>(root: &Dir, name: &str) -> Result<T> {
    Ok(serde_json::from_value(
        crate::verification::documents::strict_json(&raw(root, name)?)?,
    )?)
}
pub(super) fn publish<T: Serialize>(root: &Dir, name: &str, value: &T) -> Result<()> {
    write_new(
        root,
        name,
        &canonical_bytes(value)?,
        root.uid,
        root.file.metadata()?.gid(),
        0o400,
    )?;
    Ok(())
}
pub(super) fn replace<T: Serialize>(
    root: &Dir,
    history: &Dir,
    name: &str,
    expected: &str,
    value: &T,
) -> Result<()> {
    let previous = raw(root, name)?;
    require(sha(&previous) == expected, "FIRST_LIVE_PREIMAGE")?;
    write_new(
        history,
        name,
        &previous,
        history.uid,
        history.file.metadata()?.gid(),
        0o400,
    )?;
    let temp = format!("{name}.first-live");
    write_new(
        root,
        &temp,
        &canonical_bytes(value)?,
        root.uid,
        root.file.metadata()?.gid(),
        0o600,
    )?;
    require(sha(&raw(root, name)?) == expected, "FIRST_LIVE_PREIMAGE")?;
    root.rename(&temp, root, name)
}
