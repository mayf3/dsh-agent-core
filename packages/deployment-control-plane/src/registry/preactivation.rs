//! One separately Owner-authorized preactivation bridge, never a request API.
use super::*;
use crate::fs::{
    file::{sha, snapshot},
    MutationGuard,
};
use serde::{Deserialize, Serialize};
use std::os::unix::fs::MetadataExt;
#[path = "preactivation_prepare.rs"]
mod prepare_impl;
#[path = "preactivation_read.rs"]
mod read;
pub(crate) use prepare_impl::{append_prepared, prepare, validate_pristine, Prepared};
pub(super) use read::{load, ValidatedBridge};
pub(crate) const VERSION: u32 = 1;
pub(crate) const STATE: &str = "CUSTODY_TRANSITION_COMPLETE_ADMISSION_FENCED";
pub(crate) const CATALOG_REVISION: &str = "local-first-standing-v1";
const PRODUCER: &str = "local-deployment-registry";
const STATE1: &str = "state-00000000000000000001.json";
const STATE2: &str = "state-00000000000000000002.json";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub(crate) struct Bindings {
    pub operation_id: String,
    pub package_digest: String,
    pub owner_grant_digest: String,
    pub safe_host_receipt_digest: String,
    pub controller_sha256: String,
    pub installation_receipt_digest: String,
}
impl Bindings {
    fn validate(&self) -> Result<()> {
        require(
            self.operation_id == "first-live-dsh-20260918-01",
            "CUSTODY_OPERATION",
        )?;
        for v in [
            &self.package_digest,
            &self.owner_grant_digest,
            &self.safe_host_receipt_digest,
            &self.controller_sha256,
            &self.installation_receipt_digest,
        ] {
            valid_digest(v)?;
        }
        Ok(())
    }
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub(crate) struct Completion {
    pub version: u32,
    pub state: String,
    pub operation_id: String,
    pub package_digest: String,
    pub owner_grant_digest: String,
    pub safe_host_receipt_digest: String,
    pub controller_sha256: String,
    pub installation_receipt_digest: String,
    pub bridge_sha256: String,
    pub published_service_sha256: String,
    pub catalog_revision: String,
    pub keyset_digest: String,
}
impl Completion {
    fn bindings(&self) -> Bindings {
        Bindings {
            operation_id: self.operation_id.clone(),
            package_digest: self.package_digest.clone(),
            owner_grant_digest: self.owner_grant_digest.clone(),
            safe_host_receipt_digest: self.safe_host_receipt_digest.clone(),
            controller_sha256: self.controller_sha256.clone(),
            installation_receipt_digest: self.installation_receipt_digest.clone(),
        }
    }
}
#[derive(Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
struct Pins {
    service: String,
    trust: String,
    state1: String,
    catalog: String,
    enrollment: String,
    enrollment_payload: String,
    snapshot_payload: String,
}
impl Pins {
    fn native() -> Self {
        Self {
            service: "bd7351e49a0b674917cb5b6cea52522186d2055b7dbacda31b7a1e1bf59c50d2".into(),
            trust: "d7d01af3aa0f80b02529410f03a1c0c12818fd977a21ea40281a45d111916dd4".into(),
            state1: "74e98530ee6689b1ca5c822b4719791a86f3cdd60e2a53ad250f7210af6844f1".into(),
            catalog: "762adce7cac1d37d1119528ea85959ac9adddf515e727209c87754404acfddae".into(),
            enrollment: "e465d33e19d10e0bb41df0e4b0b5d475479a54f825816dff85d5428ca537cf29".into(),
            enrollment_payload: "f8dedad84e805a8886fb85859767159ff6ac720b07b31412cbfdff52e43e8197"
                .into(),
            snapshot_payload: "9aa4ca923479b0ffbbbe90d2fb90d661665dd557e85cff91bd8c3687d47206f6"
                .into(),
        }
    }
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Bridge {
    version: u32,
    bindings: Bindings,
    catalog_revision: String,
    keyset_digest: String,
    original: Pins,
    state2_sha256: String,
    fresh_snapshot1_sha256: String,
}
impl Signable for Bridge {
    const DOMAIN: &'static str = "PreactivationRegistryBridge";
    const ROLE: Role = Role::Producer;
}
fn raw(dir: &Dir, name: &str, mode: u32) -> Result<Vec<u8>> {
    let image = snapshot(
        &dir.open_file(name, libc::O_RDONLY, 0)?,
        dir.uid,
        32 * 1024 * 1024,
    )?;
    require(image.mode == mode, "UNSAFE_MODE")?;
    Ok(image.bytes)
}
fn absent(dir: &Dir, name: &str) -> Result<()> {
    match dir.open_file(name, libc::O_RDONLY, 0) {
        Err(e) if e.code() == "ABSENT" => Ok(()),
        Err(e) => Err(e),
        Ok(_) => Err(Error::new("CUSTODY_ALREADY_EXISTS")),
    }
}
fn native_root(root: &Dir, guard: &MutationGuard) -> Result<()> {
    require(
        unsafe { libc::geteuid() } == 0 && root.uid == 0,
        "ROOT_REQUIRED",
    )?;
    guard.binds(root)?;
    let fixed = Dir::open(Path::new(crate::issuer::custody::ROOT), 0)?;
    let a = root.file.metadata()?;
    let b = fixed.file.metadata()?;
    require((a.dev(), a.ino()) == (b.dev(), b.ino()), "CUSTODY_ROOT")
}
fn sign<T: Signable>(key: &SigningKey, id: &str, payload: T) -> Result<Signed<T>> {
    Ok(Signed {
        issuer: id.into(),
        signature: hex::encode(key.sign(&signing_bytes(&payload)?).to_bytes()),
        payload,
    })
}
fn old_material(
    service: &[u8],
    trust: &[u8],
    ledger: &[u8],
    pins: &Pins,
) -> Result<(Catalog, Signed<storage::Ledger>)> {
    require(
        sha(service) == pins.service && sha(trust) == pins.trust && sha(ledger) == pins.state1,
        "CUSTODY_GENESIS_DIGEST",
    )?;
    let config: crate::service::Configuration = serde_json::from_slice(service)?;
    let trusted: Catalog = serde_json::from_slice(trust)?;
    let c = config.catalog;
    require(
        c.revision == "local-genesis-v1"
            && trusted.revision == c.revision
            && c.keys == trusted.keys
            && c.profiles.values().all(|p| !p.enabled)
            && digest(&c)? == pins.catalog,
        "CUSTODY_OLD_CATALOG",
    )?;
    let state: Signed<storage::Ledger> = serde_json::from_slice(ledger)?;
    verify_signed(&state, &c, PRODUCER)?;
    let l = &state.payload;
    require(
        state.issuer == PRODUCER
            && l.revision == 1
            && l.previous_digest.is_none()
            && l.rows.len() == 1,
        "CUSTODY_GENESIS_STATE",
    )?;
    let (id, row) = l
        .rows
        .first_key_value()
        .ok_or(Error::new("CUSTODY_GENESIS_STATE"))?;
    pending(row)?;
    validation::enrollment(&c, PRODUCER, &row.enrollment)?;
    require(
        id == &row.enrollment.payload.goal_id
            && digest(&row.enrollment)? == pins.enrollment
            && digest(&row.enrollment.payload)? == pins.enrollment_payload,
        "CUSTODY_GENESIS_ENROLLMENT",
    )?;
    verify_signed(&l.snapshot, &c, PRODUCER)?;
    let s = &l.snapshot.payload;
    require(
        l.snapshot.issuer == PRODUCER
            && s.producer_id == PRODUCER
            && s.revision == 1
            && s.previous_revision == 0
            && s.watermark == 1
            && s.records.is_empty()
            && digest(s)? == pins.snapshot_payload,
        "CUSTODY_GENESIS_SNAPSHOT",
    )?;
    Ok((c, state))
}
fn pending(row: &DeploymentRecord) -> Result<()> {
    require(
        row.state == DeploymentState::Pending
            && row.revision == 0
            && !row.business_goal_complete
            && row.ready.is_none()
            && row.proposal_digest.is_none()
            && row.closure.is_none(),
        "CUSTODY_NOT_PRISTINE",
    )
}
fn keyset(old: &Catalog, fresh: &Catalog) -> Result<String> {
    require(
        fresh.revision == CATALOG_REVISION && old.keys.len() == 6 && fresh.keys.len() == 6,
        "CUSTODY_KEYSET",
    )?;
    let old_values: std::collections::BTreeSet<_> =
        old.keys.values().map(|k| &k.public_key).collect();
    let mut new_values = std::collections::BTreeSet::new();
    for (id, role) in crate::issuer::custody::ROLES {
        let a = old.keys.get(id).ok_or(Error::new("CUSTODY_KEYSET"))?;
        let b = fresh.keys.get(id).ok_or(Error::new("CUSTODY_KEYSET"))?;
        require(
            a.role == role
                && b.role == role
                && a.scopes == b.scopes
                && !old_values.contains(&b.public_key)
                && new_values.insert(&b.public_key),
            "CUSTODY_KEYSET",
        )?;
        let bytes: [u8; 32] = hex::decode(&b.public_key)
            .map_err(|_| Error::new("INVALID_KEY"))?
            .try_into()
            .map_err(|_| Error::new("INVALID_KEY"))?;
        ed25519_dalek::VerifyingKey::from_bytes(&bytes).map_err(|_| Error::new("INVALID_KEY"))?;
    }
    digest(&fresh.keys)
}

#[cfg(test)]
#[path = "../../test/registry/preactivation.rs"]
mod tests;

#[cfg(test)]
#[path = "../../test/registry/preactivation_fixture.rs"]
pub(crate) mod fixture;
