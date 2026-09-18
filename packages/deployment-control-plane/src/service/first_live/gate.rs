use super::records::*;
use crate::{
    error::require,
    fs::{
        file::{sha, snapshot, write_new},
        secure::Dir,
    },
    trust::{canonical_bytes, digest, valid_digest, valid_id},
    Error, Result,
};
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use std::os::unix::fs::MetadataExt;
#[derive(Debug)]
pub(super) enum Phase {
    Ordinary,
    Readback(Box<Binding>),
    Complete,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Intent {
    version: u32,
    operation_id: String,
    packet_sha256: String,
    grant_sha256: String,
    controller_sha256: String,
}
pub(super) fn raw(root: &Dir, name: &str) -> Result<Vec<u8>> {
    let f = root.open_file(name, libc::O_RDONLY, 0)?;
    require(f.metadata()?.mode() & 0o7777 == 0o400, "ENABLE_RECORD_MODE")?;
    Ok(snapshot(&f, root.uid, 1024 * 1024)?.bytes)
}
pub(super) fn configuration(root: &Dir, name: &str) -> Result<String> {
    let f = root.open_file(name, libc::O_RDONLY, 0)?;
    Ok(sha(&snapshot(&f, root.uid, 32 * 1024 * 1024)?.bytes))
}
pub(super) fn read<T: DeserializeOwned>(root: &Dir, name: &str) -> Result<T> {
    Ok(serde_json::from_value(
        crate::verification::documents::strict_json(&raw(root, name)?)?,
    )?)
}
pub(super) fn optional<T: DeserializeOwned>(root: &Dir, name: &str) -> Result<Option<T>> {
    match read(root, name) {
        Ok(v) => Ok(Some(v)),
        Err(e) if e.code() == "ABSENT" => Ok(None),
        Err(e) => Err(e),
    }
}
pub(super) fn absent(root: &Dir, name: &str) -> Result<()> {
    match root.open_file(name, libc::O_RDONLY, 0) {
        Err(e) if e.code() == "ABSENT" => Ok(()),
        Err(e) => Err(e),
        Ok(_) => Err(Error::new("ENABLE_PRIOR_OR_FAILED")),
    }
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
pub(super) fn core(root: &Dir, configured: Option<&str>, expires_at: u64) -> Result<Binding> {
    let pending: Pending = read(root, "first-live-pending.json")?;
    require(
        configured == Some(pending.operation_id.as_str()),
        "ENABLE_OPERATION_BINDING",
    )?;
    valid_id(&pending.operation_id)?;
    valid_digest(&pending.package_digest)?;
    let area = root.child("first-live-operation")?;
    absent(&area, "failure.json")?;
    let result: Core = read(&area, "result.json")?;
    let intent: Intent = read(&area, "first-live-intent.json")?;
    require(
        result.version == 1
            && intent.version == 1
            && result.state == "STANDING_ADOPTION_COMPLETE_CONTROLLER_DISABLED"
            && result.operation_id == pending.operation_id
            && result.packet_sha256 == pending.package_digest
            && intent.operation_id == result.operation_id
            && intent.packet_sha256 == result.packet_sha256
            && intent.grant_sha256 == result.grant_sha256,
        "ENABLE_CORE_BINDING",
    )?;
    for value in [
        &result.grant_sha256,
        &result.lifecycle_digest,
        &result.host_safety_receipt_digest,
        &result.custody_completion_digest,
        &result.reviewer_login_receipt_digest,
        &result.standing_receipt_digest,
        &intent.controller_sha256,
    ] {
        valid_digest(value)?;
    }
    Ok(Binding {
        operation_id: result.operation_id,
        package_digest: result.packet_sha256,
        grant_digest: result.grant_sha256,
        controller_digest: intent.controller_sha256,
        core_digest: sha(&raw(&area, "result.json")?),
        configuration_digest: configuration(root, "service.json")?,
        activation_digest: configuration(root, "daemon-activation.json")?,
        standing_digest: result.standing_receipt_digest,
        plist_before_digest: sha(crate::bootstrap::DISABLED_CONTROLLER_PLIST.as_bytes()),
        plist_after_digest: sha(&super::native::enabled_plist(
            crate::bootstrap::DISABLED_CONTROLLER_PLIST.as_bytes(),
        )?),
        expires_at,
    })
}
fn complete(area: &Dir, b: &Binding) -> Result<bool> {
    let Some(result) = optional::<Complete>(area, "enable-result.json")? else {
        return Ok(false);
    };
    let readback: Readback = read(area, "daemon-readback.json")?;
    let admission: Admission = read(area, "enable-admission.json")?;
    let ready: Ready = read(area, "daemon-ready.json")?;
    require(
        result.binding == *b
            && readback.binding == *b
            && admission.binding == *b
            && admission.readback_digest == digest(&readback)?
            && result.readback_digest == digest(&readback)?
            && ready.readback == readback
            && ready.admission_digest == digest(&admission)?
            && result.ready_digest == digest(&ready)?,
        "ENABLE_COMPLETION_BINDING",
    )?;
    Ok(true)
}
pub(super) fn startup(root: &Dir, configured: Option<&str>, now: u64) -> Result<Phase> {
    if optional::<Pending>(root, "first-live-pending.json")?.is_none() {
        return Ok(Phase::Ordinary);
    }
    let area = root.child("first-live-operation")?;
    absent(&area, "enable-failure.json")?;
    let b: Binding = read(&area, "enable-intent.json")?;
    require(core(root, configured, b.expires_at)? == b, "ENABLE_BINDING")?;
    if complete(&area, &b)? {
        return Ok(Phase::Complete);
    }
    require(now < b.expires_at, "ENABLE_EXPIRED")?;
    Ok(Phase::Readback(Box::new(b)))
}
pub(super) fn initialization(area: &Dir, current: &Readback) -> Result<()> {
    let admitted: Admission = read(area, "enable-admission.json")?;
    let retained: Readback = read(area, "daemon-readback.json")?;
    require(
        retained == *current
            && admitted.binding == current.binding
            && admitted.readback_digest == digest(current)?,
        "ENABLE_GENERATION_BINDING",
    )
}
pub(super) fn ordinary(root: &Dir, configured: Option<&str>, now: u64) -> Result<()> {
    require(
        matches!(
            startup(root, configured, now)?,
            Phase::Ordinary | Phase::Complete
        ),
        "ENABLE_ADMISSION_PENDING",
    )
}
#[cfg(test)]
#[path = "../../../test/service/first_live/gate.rs"]
mod tests;
