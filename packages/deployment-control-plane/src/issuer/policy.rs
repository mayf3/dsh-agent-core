//! One durable current lease. Queue epochs are global, while Owner policy revisions
//! describe configuration changes and must never be reused as renewal counters.
use super::{custody, owner_policy::OwnerPolicy};
use crate::{
    error::require,
    fs::{
        file::{snapshot, write_new},
        secure::{validate, Dir},
    },
    model::*,
    trust::{canonical_bytes, digest, valid_id, validate_policy, verify_signed, Signable},
    Error, Result,
};
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use std::{
    fs::File,
    os::{fd::AsRawFd, unix::fs::MetadataExt},
    path::Path,
    time::{SystemTime, UNIX_EPOCH},
};
const CACHE: &str = "policy-cache.json";
const TEMPORARY: &str = "policy-cache.tmp";
const LIMIT: u64 = 4 * 1024 * 1024;
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct CachedLease {
    version: u32,
    owner: OwnerPolicy,
    owner_digest: String,
    source_digest: String,
    profile_id: String,
    profile: Profile,
    profile_digest: String,
    lease: Signed<Policy>,
    lease_digest: String,
}
impl Signable for CachedLease {
    const DOMAIN: &'static str = "LocalPolicyLeaseCache";
    const ROLE: Role = Role::Authority;
}
pub(crate) fn current_native(
    root: &Dir,
    catalog: &Catalog,
    profile: &str,
) -> Result<Signed<Policy>> {
    require(
        unsafe { libc::geteuid() } == 0 && root.uid == 0,
        "ISSUER_REQUIRES_ROOT",
    )?;
    let fixed = Dir::open(Path::new(custody::ROOT), 0)?;
    let expected = fixed.file.metadata()?;
    let supplied = root.file.metadata()?;
    require(
        (expected.dev(), expected.ino()) == (supplied.dev(), supplied.ino()),
        "POLICY_ROOT_BINDING",
    )?;
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|_| Error::new("CLOCK"))?
        .as_secs();
    current_at(&fixed, catalog, profile, now)
}
fn current_at(root: &Dir, catalog: &Catalog, profile_id: &str, now: u64) -> Result<Signed<Policy>> {
    valid_id(profile_id)?;
    require(
        root.file.metadata()?.mode() & 0o7777 == 0o700,
        "UNSAFE_MODE",
    )?;
    let profile = catalog
        .profiles
        .get(profile_id)
        .ok_or(Error::new("PROFILE_NOT_ALLOWED"))?;
    require(profile.enabled, "PROFILE_NOT_ALLOWED")?;
    let seconds = profile.policy_lease_seconds.min(300);
    require(seconds > 0, "ISSUER_POLICY")?;
    let _lock = lock(root)?;
    // A prior failed write has an unknown commit outcome. Never overwrite it or
    // silently issue another epoch; bounded operator reconciliation is required.
    match root.open_file(TEMPORARY, libc::O_RDONLY, 0) {
        Ok(file) => {
            private_bytes(root, &file)?;
            return Err(Error::new("POLICY_CACHE_PENDING"));
        }
        Err(e) if e.code() == "ABSENT" => (),
        Err(e) => return Err(e),
    }
    let owner: OwnerPolicy = read(root, "issuer-policy.json")?;
    validate_owner(&owner)?;
    let owner_digest = digest(&owner)?;
    let profile_digest = digest(profile)?;
    let previous: Option<Signed<CachedLease>> = match read(root, CACHE) {
        Ok(cache) => Some(cache),
        Err(e) if e.code() == "ABSENT" => None,
        Err(e) => return Err(e),
    };
    if let Some(previous) = &previous {
        validate_cache(previous, catalog)?;
        let cache = &previous.payload;
        require(owner.epoch() >= cache.owner.epoch(), "POLICY_CONFIG_REPLAY")?;
        require(
            owner.epoch() != cache.owner.epoch() || owner_digest == cache.owner_digest,
            "POLICY_EQUIVOCATION",
        )?;
        require(now >= cache.lease.payload.issued_at, "CLOCK_ROLLBACK")?;
        let margin = 10.min(seconds / 2);
        if owner_digest == cache.owner_digest
            && profile_id == cache.profile_id
            && profile_digest == cache.profile_digest
            && cache.lease.payload.expires_at.saturating_sub(now) > margin
        {
            validate_policy(catalog, profile_id, &cache.lease, now)?;
            return Ok(cache.lease.clone());
        }
    }
    let epoch = match &previous {
        Some(cache) => cache
            .payload
            .lease
            .payload
            .epoch
            .checked_add(1)
            .ok_or(Error::new("POLICY_EPOCH_EXHAUSTED"))?
            .max(owner.epoch()),
        None => owner.epoch(),
    };
    let key = custody::load(
        &root.child("issuer-keys")?,
        "local-authority",
        Role::Authority,
        catalog,
    )?;
    let lease = custody::sign(
        "local-authority",
        &key,
        Policy {
            epoch,
            issued_at: now,
            expires_at: now.checked_add(seconds).ok_or(Error::new("CLOCK"))?,
            standing_authority_revision: profile.standing_authority_revision.clone(),
            revoked_sources: owner.revoked_sources().clone(),
            revoked_artifacts: owner.revoked_artifacts().clone(),
        },
    )?;
    validate_policy(catalog, profile_id, &lease, now)?;
    let cached = custody::sign(
        "local-authority",
        &key,
        CachedLease {
            version: 1,
            source_digest: owner.source_digest()?,
            owner_digest: owner_digest.clone(),
            owner,
            profile_id: profile_id.into(),
            profile: profile.clone(),
            profile_digest,
            lease: lease.clone(),
            lease_digest: digest(&lease)?,
        },
    )?;
    let raw = canonical_bytes(&cached)?;
    require(raw.len() as u64 <= LIMIT, "SIZE_LIMIT")?;
    write_new(
        root,
        TEMPORARY,
        &raw,
        root.uid,
        root.file.metadata()?.gid(),
        0o600,
    )?;
    // Owner updates cannot be accidentally covered by an already prepared lease.
    let current_owner: OwnerPolicy = read(root, "issuer-policy.json")?;
    require(
        digest(&current_owner)? == owner_digest,
        "POLICY_SOURCE_CHANGED",
    )?;
    root.rename(TEMPORARY, root, CACHE)?;
    Ok(lease)
}
fn validate_owner(owner: &OwnerPolicy) -> Result<()> {
    owner.validate()
}
fn validate_cache(signed: &Signed<CachedLease>, catalog: &Catalog) -> Result<()> {
    let cache = &signed.payload;
    verify_signed(signed, catalog, &cache.profile_id)?;
    verify_signed(&cache.lease, catalog, &cache.profile_id)?;
    require(
        signed.issuer == "local-authority" && cache.lease.issuer == "local-authority",
        "POLICY_CACHE_ISSUER",
    )?;
    validate_owner(&cache.owner)?;
    let lease = &cache.lease.payload;
    require(
        cache.version == 1
            && lease.epoch > 0
            && cache.owner_digest == digest(&cache.owner)?
            && cache.source_digest == cache.owner.source_digest()?
            && cache.profile_digest == digest(&cache.profile)?
            && cache.lease_digest == digest(&cache.lease)?
            && lease.standing_authority_revision == cache.profile.standing_authority_revision
            && lease.revoked_sources == *cache.owner.revoked_sources()
            && lease.revoked_artifacts == *cache.owner.revoked_artifacts()
            && lease.expires_at > lease.issued_at
            && lease.expires_at - lease.issued_at == cache.profile.policy_lease_seconds.min(300),
        "POLICY_CACHE_BINDING",
    )
}
fn lock(root: &Dir) -> Result<File> {
    let file = root.open_file("policy.lock", libc::O_RDWR, 0)?;
    validate(&file, root.uid, false)?;
    require(file.metadata()?.mode() & 0o7777 == 0o600, "UNSAFE_MODE")?;
    require(
        unsafe { libc::flock(file.as_raw_fd(), libc::LOCK_EX | libc::LOCK_NB) } == 0,
        "POLICY_BUSY",
    )?;
    let named = root
        .open_file("policy.lock", libc::O_RDONLY, 0)?
        .metadata()?;
    let opened = file.metadata()?;
    require(
        (named.dev(), named.ino()) == (opened.dev(), opened.ino()),
        "POLICY_LOCK_REPLACED",
    )?;
    Ok(file)
}
fn private_bytes(root: &Dir, file: &File) -> Result<Vec<u8>> {
    let image = snapshot(file, root.uid, LIMIT)?;
    require(image.mode == 0o600, "UNSAFE_MODE")?;
    crate::service::protocol::depth(&image.bytes, 32)?;
    Ok(image.bytes)
}
fn read<T: DeserializeOwned>(root: &Dir, name: &str) -> Result<T> {
    let file = root.open_file(name, libc::O_RDONLY, 0)?;
    let value = serde_json::from_slice(&private_bytes(root, &file)?)?;
    // Also complete a prior rename whose visible state outlived an fsync error.
    file.sync_all()?;
    root.file.sync_all()?;
    Ok(value)
}
#[cfg(test)]
#[path = "../../test/issuer/policy.rs"]
mod tests;
