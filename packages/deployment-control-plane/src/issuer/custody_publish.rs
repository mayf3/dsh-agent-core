//! Publication mechanics for the single caller-owned custody transition.
use super::*;

pub(super) fn archive(area: &Dir, p: &Prepared, service: &[u8]) -> Result<()> {
    for (name, bytes) in [
        ("old-service.json", p.old_service.as_slice()),
        ("old-trust.json", &p.old_trust),
        ("old-state1.json", &p.old_state1),
        ("fresh-snapshot1.json", &p.fresh_snapshot1),
        ("registry-bridge.json", &p.bridge),
        ("published-service.json", service),
    ] {
        write(area, name, bytes, 0o400)?;
    }
    Ok(())
}
pub(super) fn keys(root: &Dir, area: &Dir, stage: &Dir, expires: u64) -> Result<()> {
    absent(area, "retired-issuer-keys")?;
    root.rename("issuer-keys", area, "retired-issuer-keys")?;
    checkpoint("retired-keys", expires)?;
    absent(root, "issuer-keys")?;
    stage.rename("issuer-keys", root, "issuer-keys")?;
    checkpoint("new-keys", expires)
}
pub(super) fn configuration(
    root: &Dir,
    area: &Dir,
    p: &Prepared,
    service: &Configuration,
    expires: u64,
) -> Result<()> {
    let mut trust = service.catalog.clone();
    trust.profiles.clear();
    for (name, old, bytes, phase) in [
        (
            "local-trust.json",
            &p.old_trust,
            canonical_bytes(&trust)?,
            "trust",
        ),
        (
            "service.json",
            &p.old_service,
            canonical_bytes(service)?,
            "service",
        ),
    ] {
        deadline(expires)?;
        require(raw(root, name, 0o600)? == *old, "CUSTODY_PREIMAGE")?;
        let staging_name = format!("publish-{name}");
        write(area, &staging_name, &bytes, 0o600)?;
        area.rename(&staging_name, root, name)?;
        require(raw(root, name, 0o600)? == bytes, "CUSTODY_READBACK")?;
        checkpoint(phase, expires)?;
    }
    Ok(())
}
