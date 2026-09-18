//! Root custody; creation is reachable only from separately authorized bootstrap.
use crate::{
    error::require,
    fs::{
        file::{snapshot, write_new},
        secure::Dir,
    },
    model::*,
    trust::{canonical_bytes, signing_bytes, Signable},
    Error, Result,
};
use ed25519_dalek::{Signer, SigningKey};
use std::{collections::BTreeMap, os::unix::fs::MetadataExt, path::Path};

pub const ROOT: &str = "/private/var/db/agent-deployd";
pub const ROLES: [(&str, Role); 6] = [
    ("local-authority", Role::Authority),
    ("local-builder", Role::Builder),
    ("local-reviewer", Role::Reviewer),
    ("local-deployment-registry", Role::Producer),
    ("local-verifier", Role::Verifier),
    ("local-recovery", Role::Recovery),
];

/// Called only by the exact separately authorized, root-installed bootstrap binary.
/// It refuses any existing key, including incomplete prior initialization.
pub fn initialize_native() -> Result<Catalog> {
    require(unsafe { libc::geteuid() } == 0, "ISSUER_REQUIRES_ROOT")?;
    let root = Dir::open(Path::new(ROOT), 0)?;
    initialize(&root, false)
}

fn initialize(root: &Dir, fixture: bool) -> Result<Catalog> {
    initialize_revision(root, fixture, "local-genesis-v1")
}

// Private bootstrap building block. The caller must supply a new protected
// staging directory only after the held first-live operation proves host closure.
// This creates no active catalog, replaces no existing key, and enables nothing.
pub(super) fn initialize_standing_stage(stage: &Dir) -> Result<Catalog> {
    initialize_revision(stage, false, "local-first-standing-v1")
}

#[cfg(test)]
pub(super) fn initialize_standing_fixture(stage: &Dir) -> Result<Catalog> {
    initialize_revision(stage, true, "local-first-standing-v1")
}

fn initialize_revision(root: &Dir, fixture: bool, revision: &str) -> Result<Catalog> {
    let uid = unsafe { libc::geteuid() };
    require(
        if fixture {
            cfg!(test) && uid != 0
        } else {
            uid == 0
        },
        "ISSUER_REQUIRES_ROOT",
    )?;
    require(
        root.uid == uid && root.file.metadata()?.mode() & 0o777 == 0o700,
        "UNSAFE_MODE",
    )?;
    let keys = root.mkdir("issuer-keys")?;
    require(keys.names()?.is_empty(), "CUSTODY_ALREADY_EXISTS")?;
    let mut catalog = Catalog {
        revision: revision.into(),
        keys: BTreeMap::new(),
        profiles: BTreeMap::new(),
    };
    for (issuer, role) in ROLES {
        let mut seed = [0u8; 32];
        require(
            unsafe { libc::getentropy(seed.as_mut_ptr().cast(), seed.len()) } == 0,
            "ENTROPY_FAILURE",
        )?;
        let key = SigningKey::from_bytes(&seed);
        let secret = canonical_bytes(&hex::encode(seed))?;
        seed.fill(0);
        write_new(
            &keys,
            &format!("{issuer}.json"),
            &secret,
            uid,
            keys.file.metadata()?.gid(),
            0o600,
        )?;
        let mut scopes = vec!["dsh-app".into(), "preparation".into()];
        if role == Role::Authority {
            scopes.extend(["bootstrap".into(), "local-deployment-registry".into()]);
        }
        if role == Role::Producer {
            scopes.push(issuer.into());
        }
        catalog.keys.insert(
            issuer.into(),
            TrustedKey {
                public_key: hex::encode(key.verifying_key().as_bytes()),
                role,
                scopes,
            },
        );
    }
    write_new(
        root,
        "local-trust.json",
        &canonical_bytes(&catalog)?,
        uid,
        root.file.metadata()?.gid(),
        0o600,
    )?;
    Ok(catalog)
}

pub(crate) fn load(dir: &Dir, issuer: &str, role: Role, catalog: &Catalog) -> Result<SigningKey> {
    require(
        dir.file.metadata()?.mode() & 0o777 == 0o700,
        "PRIVATE_KEY_MODE",
    )?;
    require(ROLES.contains(&(issuer, role)), "ISSUER_ROLE")?;
    let image = snapshot(
        &dir.open_file(&format!("{issuer}.json"), libc::O_RDONLY, 0)?,
        dir.uid,
        1024,
    )?;
    require(image.mode == 0o600, "PRIVATE_KEY_MODE")?;
    let secret: String = serde_json::from_slice(&image.bytes)?;
    let mut seed: [u8; 32] = hex::decode(secret)
        .map_err(|_| Error::new("ISSUER_KEY"))?
        .try_into()
        .map_err(|_| Error::new("ISSUER_KEY"))?;
    let key = SigningKey::from_bytes(&seed);
    seed.fill(0);
    let expected = catalog
        .keys
        .get(issuer)
        .ok_or(Error::new("UNKNOWN_ISSUER"))?;
    require(
        expected.role == role && expected.public_key == hex::encode(key.verifying_key().as_bytes()),
        "ISSUER_KEY",
    )?;
    Ok(key)
}

// This helper is crate-private, never a request operation. Each producer constructs
// its payload only after acquiring and checking the corresponding observation.
pub(crate) fn sign<T: Signable>(issuer: &str, key: &SigningKey, payload: T) -> Result<Signed<T>> {
    require(ROLES.contains(&(issuer, T::ROLE)), "ISSUER_ROLE")?;
    let signature = hex::encode(key.sign(&signing_bytes(&payload)?).to_bytes());
    Ok(Signed {
        issuer: issuer.into(),
        payload,
        signature,
    })
}

#[cfg(test)]
#[path = "../../test/issuer/custody.rs"]
mod tests;
