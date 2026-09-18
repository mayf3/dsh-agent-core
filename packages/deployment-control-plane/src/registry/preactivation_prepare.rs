use super::*;

pub(crate) struct Prepared {
    pub old_service: Vec<u8>,
    pub old_trust: Vec<u8>,
    pub old_state1: Vec<u8>,
    pub fresh_snapshot1: Vec<u8>,
    pub state2: Vec<u8>,
    pub bridge: Vec<u8>,
    pub keyset_digest: String,
    root_identity: (u64, u64),
    catalog: Catalog,
    pins: Pins,
}
/// Material only; the Owner-bound orchestration owns custody/config publication.
pub(crate) fn prepare(
    root: &Dir,
    guard: &MutationGuard,
    fresh: &Catalog,
    authority: &SigningKey,
    producer: &SigningKey,
    bindings: Bindings,
) -> Result<Prepared> {
    native_root(root, guard)?;
    prepare_checked(
        root,
        guard,
        fresh,
        authority,
        producer,
        bindings,
        Pins::native(),
    )
}
pub(super) fn prepare_checked(
    root: &Dir,
    guard: &MutationGuard,
    fresh: &Catalog,
    authority: &SigningKey,
    producer: &SigningKey,
    bindings: Bindings,
    pins: Pins,
) -> Result<Prepared> {
    guard.binds(root)?;
    bindings.validate()?;
    pristine(root)?;
    let registry = root.child("registry")?;
    let _lock = storage::lock(&registry)?;
    original_only(&registry)?;
    let old_service = raw(root, "service.json", 0o600)?;
    let old_trust = raw(root, "local-trust.json", 0o600)?;
    let old_state1 = raw(&registry, STATE1, 0o600)?;
    let (old, state1) = old_material(&old_service, &old_trust, &old_state1, &pins)?;
    require(fresh.profiles == old.profiles, "CUSTODY_DISABLED_PROFILES")?;
    let keyset_digest = keyset(&old, fresh)?;
    for (id, k) in [("local-authority", authority), (PRODUCER, producer)] {
        require(
            fresh.keys[id].public_key == hex::encode(k.verifying_key().as_bytes()),
            "ISSUER_KEY_MISMATCH",
        )?;
    }
    let fresh_snapshot1 = canonical_bytes(&sign(
        producer,
        PRODUCER,
        state1.payload.snapshot.payload.clone(),
    )?)?;
    let mut rows = state1.payload.rows.clone();
    for row in rows.values_mut() {
        row.enrollment = sign(authority, "local-authority", row.enrollment.payload.clone())?;
        validation::enrollment(fresh, PRODUCER, &row.enrollment)?;
    }
    let state2 = canonical_bytes(&sign(
        producer,
        PRODUCER,
        storage::Ledger {
            revision: 2,
            previous_digest: Some(digest(&state1)?),
            rows,
            snapshot: sign(
                producer,
                PRODUCER,
                ProducerSnapshot {
                    producer_id: PRODUCER.into(),
                    revision: 2,
                    previous_revision: 1,
                    records: vec![],
                    watermark: 2,
                },
            )?,
        },
    )?)?;
    let bridge = canonical_bytes(&sign(
        producer,
        PRODUCER,
        Bridge {
            version: VERSION,
            bindings,
            catalog_revision: CATALOG_REVISION.into(),
            keyset_digest: keyset_digest.clone(),
            original: pins.clone(),
            state2_sha256: sha(&state2),
            fresh_snapshot1_sha256: sha(&fresh_snapshot1),
        },
    )?)?;
    let m = root.file.metadata()?;
    Ok(Prepared {
        old_service,
        old_trust,
        old_state1,
        fresh_snapshot1,
        state2,
        bridge,
        keyset_digest,
        root_identity: (m.dev(), m.ino()),
        catalog: fresh.clone(),
        pins,
    })
}
fn original_only(registry: &Dir) -> Result<()> {
    require(
        registry.names()? == vec!["registry.lock".to_string(), STATE1.to_string()],
        "CUSTODY_REGISTRY_NOT_PRISTINE",
    )
}
fn pristine(root: &Dir) -> Result<()> {
    for name in [
        "queue.db",
        "queue.db-wal",
        "queue.db-shm",
        "queue.db-journal",
        "activation.json",
        "daemon-activation.json",
        "issuer-bindings.json",
        "adoption-authorizations",
    ] {
        absent(root, name)?;
    }
    for name in [
        "transactions",
        "issuer-jobs",
        "staging",
        "sealed",
        "targets",
        "admitted",
        "requests",
        "closure",
        "recovery-requests",
    ] {
        match root.child(name) {
            Ok(d) => require(d.names()?.is_empty(), "CUSTODY_NOT_PRISTINE")?,
            Err(e) if e.code() == "ABSENT" => (),
            Err(e) => return Err(e),
        }
    }
    match root.child("intake") {
        Ok(d) => {
            for name in d.names()? {
                require(d.child(&name)?.names()?.is_empty(), "CUSTODY_NOT_PRISTINE")?;
            }
        }
        Err(e) if e.code() == "ABSENT" => (),
        Err(e) => return Err(e),
    }
    match root.child("custody-transition") {
        Ok(d) => absent(&d, "result.json")?,
        Err(e) if e.code() == "ABSENT" => (),
        Err(e) => return Err(e),
    }
    Ok(())
}
/// No key/config switch. Refuses retries, richer history and ambiguous publication.
pub(crate) fn append_prepared(root: &Dir, guard: &MutationGuard, p: &Prepared) -> Result<()> {
    native_root(root, guard)?;
    append_checked(root, guard, p)
}
pub(super) fn append_checked(root: &Dir, guard: &MutationGuard, p: &Prepared) -> Result<()> {
    guard.binds(root)?;
    pristine(root)?;
    let m = root.file.metadata()?;
    require((m.dev(), m.ino()) == p.root_identity, "CUSTODY_ROOT")?;
    let registry = root.child("registry")?;
    let _lock = storage::lock(&registry)?;
    original_only(&registry)?;
    require(
        raw(&registry, STATE1, 0o600)? == p.old_state1,
        "CUSTODY_GENESIS_DIGEST",
    )?;
    match root.child("custody-transition") {
        Ok(d) => absent(&d, "result.json")?,
        Err(e) if e.code() == "ABSENT" => (),
        Err(e) => return Err(e),
    }
    let b: Signed<Bridge> = serde_json::from_slice(&p.bridge)?;
    verify_signed(&b, &p.catalog, PRODUCER)?;
    require(
        b.issuer == PRODUCER
            && b.payload.original == p.pins
            && sha(&p.state2) == b.payload.state2_sha256
            && sha(&p.fresh_snapshot1) == b.payload.fresh_snapshot1_sha256,
        "CUSTODY_BRIDGE_BINDING",
    )?;
    // Revalidated under the original permanent lock; no prefix-resume here.
    storage::publish(&registry, STATE2, &p.state2)
}

/// Read-only pre-entropy check, repeated by prepare before issuing any material.
pub(crate) fn validate_pristine(root: &Dir, guard: &MutationGuard) -> Result<()> {
    native_root(root, guard)?;
    validate_pristine_checked(root, guard, &Pins::native())
}
pub(super) fn validate_pristine_checked(
    root: &Dir,
    guard: &MutationGuard,
    pins: &Pins,
) -> Result<()> {
    guard.binds(root)?;
    pristine(root)?;
    let registry = root.child("registry")?;
    let _lock = storage::lock(&registry)?;
    original_only(&registry)?;
    old_material(
        &raw(root, "service.json", 0o600)?,
        &raw(root, "local-trust.json", 0o600)?,
        &raw(&registry, STATE1, 0o600)?,
        pins,
    )?;
    Ok(())
}
