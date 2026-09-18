use super::*;

pub(crate) struct ValidatedBridge {
    old: Catalog,
    original: Signed<storage::Ledger>,
    pins: Pins,
    state2_sha256: String,
    pub snapshot1: Signed<ProducerSnapshot>,
}
impl ValidatedBridge {
    pub(crate) fn catalog<'a>(
        &'a self,
        revision: u64,
        bytes: &[u8],
        active: &'a Catalog,
    ) -> Result<&'a Catalog> {
        if revision == 1 {
            require(sha(bytes) == self.pins.state1, "CUSTODY_GENESIS_DIGEST")?;
            Ok(&self.old)
        } else {
            if revision == 2 {
                require(sha(bytes) == self.state2_sha256, "CUSTODY_STATE2_DIGEST")?;
            }
            Ok(active)
        }
    }
    pub(crate) fn carry(&self, state2: &storage::Ledger) -> Result<()> {
        let rows = &self.original.payload.rows;
        require(
            state2.rows.len() == 1 && state2.rows.keys().eq(rows.keys()),
            "CUSTODY_CARRY",
        )?;
        for (id, row) in &state2.rows {
            pending(row)?;
            require(
                row.enrollment.issuer == "local-authority"
                    && row.enrollment.payload == rows[id].enrollment.payload,
                "CUSTODY_CARRY",
            )?;
        }
        Ok(())
    }
}
pub(crate) fn load(root: &Dir, active: &Catalog) -> Result<Option<ValidatedBridge>> {
    load_checked(root, active, &Pins::native())
}
pub(crate) fn load_checked(
    root: &Dir,
    active: &Catalog,
    pins: &Pins,
) -> Result<Option<ValidatedBridge>> {
    let area = match root.child("custody-transition") {
        Ok(d) => d,
        Err(e) if e.code() == "ABSENT" => {
            require(
                active.revision != CATALOG_REVISION,
                "CUSTODY_BRIDGE_REQUIRED",
            )?;
            return Ok(None);
        }
        Err(e) => return Err(e),
    };
    require(
        area.file.metadata()?.mode() & 0o7777 == 0o700,
        "UNSAFE_MODE",
    )?;
    let result: Completion = serde_json::from_slice(&raw(&area, "result.json", 0o400)?)?;
    result.bindings().validate()?;
    require(
        result.version == VERSION
            && result.state == STATE
            && result.catalog_revision == CATALOG_REVISION,
        "CUSTODY_COMPLETION",
    )?;
    let bridge_raw = raw(&area, "registry-bridge.json", 0o400)?;
    require(
        sha(&bridge_raw) == result.bridge_sha256,
        "CUSTODY_BRIDGE_DIGEST",
    )?;
    let bridge: Signed<Bridge> = serde_json::from_slice(&bridge_raw)?;
    verify_signed(&bridge, active, PRODUCER)?;
    let b = bridge.payload;
    require(
        bridge.issuer == PRODUCER
            && b.version == VERSION
            && b.bindings == result.bindings()
            && b.catalog_revision == result.catalog_revision
            && b.keyset_digest == result.keyset_digest
            && b.original == *pins,
        "CUSTODY_BRIDGE_BINDING",
    )?;
    let (old, original) = old_material(
        &raw(&area, "old-service.json", 0o400)?,
        &raw(&area, "old-trust.json", 0o400)?,
        &raw(&area, "old-state1.json", 0o400)?,
        pins,
    )?;
    require(
        keyset(&old, active)? == result.keyset_digest,
        "CUSTODY_KEYSET",
    )?;
    let published = raw(&area, "published-service.json", 0o400)?;
    require(
        sha(&published) == result.published_service_sha256,
        "CUSTODY_SERVICE_DIGEST",
    )?;
    let configuration: crate::service::Configuration = serde_json::from_slice(&published)?;
    require(
        configuration.catalog.revision == CATALOG_REVISION
            && configuration.catalog.keys == active.keys
            && configuration.catalog.profiles == old.profiles,
        "CUSTODY_KEYSET",
    )?;
    let trust: Catalog = serde_json::from_slice(&raw(root, "local-trust.json", 0o600)?)?;
    require(
        trust.revision == CATALOG_REVISION && trust.keys == active.keys,
        "CUSTODY_KEYSET",
    )?;
    let current: crate::service::Configuration =
        serde_json::from_slice(&raw(root, "service.json", 0o600)?)?;
    require(current.catalog == *active, "CUSTODY_CURRENT_CATALOG")?;
    let raw_snapshot = raw(&area, "fresh-snapshot1.json", 0o400)?;
    require(
        sha(&raw_snapshot) == b.fresh_snapshot1_sha256,
        "CUSTODY_SNAPSHOT_DIGEST",
    )?;
    let snapshot1: Signed<ProducerSnapshot> = serde_json::from_slice(&raw_snapshot)?;
    verify_signed(&snapshot1, active, PRODUCER)?;
    require(
        snapshot1.issuer == PRODUCER && snapshot1.payload == original.payload.snapshot.payload,
        "CUSTODY_SNAPSHOT_BINDING",
    )?;
    Ok(Some(ValidatedBridge {
        old,
        original,
        pins: pins.clone(),
        state2_sha256: b.state2_sha256,
        snapshot1,
    }))
}
