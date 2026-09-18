//! Fixed once-only preactivation custody publication; never a request operation.
use super::custody;
use crate::{
    error::require,
    fs::{
        file::{sha, snapshot, write_new},
        secure::Dir,
        MutationGuard,
    },
    model::{Catalog, Role},
    registry::preactivation::{self, Bindings, Completion, Prepared},
    service::Configuration,
    trust::{canonical_bytes, valid_digest},
    Error, Result,
};
use serde::{Deserialize, Serialize};
use std::{os::unix::fs::MetadataExt, path::Path};
#[path = "custody_publish.rs"]
mod publish;

pub(crate) struct Proof {
    old_catalog: Catalog,
    catalog: Catalog,
    service_sha256: String,
    completion_sha256: String,
}
impl Proof {
    pub(crate) fn bind_catalog(&self, template: &Catalog) -> Result<Catalog> {
        require(
            template.revision == self.old_catalog.revision
                && template.keys == self.old_catalog.keys,
            "CUSTODY_TEMPLATE_KEYS",
        )?;
        Ok(Catalog {
            revision: self.catalog.revision.clone(),
            keys: self.catalog.keys.clone(),
            profiles: template.profiles.clone(),
        })
    }
    pub(crate) fn bind_issuers(
        &self,
        template: &[crate::bootstrap::IssuerRequirement],
    ) -> Result<Vec<crate::bootstrap::IssuerRequirement>> {
        validate_issuer_template(template, &self.catalog)?;
        let mut result = Vec::new();
        for input in template {
            let key = &self.catalog.keys[&input.proposed_key_id];
            let mut binding = input.clone();
            binding.public_key = Some(key.public_key.clone());
            binding.custody_receipt = Some(self.completion_sha256.clone());
            result.push(binding);
        }
        Ok(result)
    }
    pub(crate) fn catalog(&self) -> &Catalog {
        &self.catalog
    }
    pub(crate) fn service_sha256(&self) -> &str {
        &self.service_sha256
    }
    pub(crate) fn completion_sha256(&self) -> &str {
        &self.completion_sha256
    }
}

/// Validate proof-free issuer templates before any host or custody effects.
pub(crate) fn validate_issuer_template(
    template: &[crate::bootstrap::IssuerRequirement],
    catalog: &Catalog,
) -> Result<()> {
    require(
        template.len() == custody::ROLES.len(),
        "CUSTODY_ISSUER_TEMPLATE",
    )?;
    let mut ids = std::collections::BTreeSet::new();
    let mut identities = std::collections::BTreeSet::new();
    for input in template {
        let key = catalog
            .keys
            .get(&input.proposed_key_id)
            .ok_or(Error::new("CUSTODY_ISSUER_TEMPLATE"))?;
        let identity = input
            .service_identity
            .as_deref()
            .ok_or(Error::new("CUSTODY_ISSUER_TEMPLATE"))?;
        crate::trust::valid_id(identity)?;
        require(
            input.role == key.role
                && input.scope == key.scopes
                && input.public_key.is_none()
                && input.custody_receipt.is_none()
                && ids.insert(&input.proposed_key_id)
                && identities.insert(identity)
                && !input.source_binding.is_empty()
                && input.source_binding.len() <= 2048,
            "CUSTODY_ISSUER_TEMPLATE",
        )?;
    }
    Ok(())
}

enum Mode<'a> {
    Native(std::marker::PhantomData<&'a ()>),
    #[cfg(test)]
    Fixture(&'a crate::fs::FixtureRoots),
}
impl Mode<'_> {
    fn validate(&self, root: &Dir, guard: &MutationGuard) -> Result<()> {
        match self {
            Self::Native(_) => preactivation::validate_pristine(root, guard),
            #[cfg(test)]
            Self::Fixture(roots) => preactivation::fixture::validate_pristine(roots, guard),
        }
    }
    fn generate(&self, stage: &Dir, expires: u64) -> Result<Catalog> {
        deadline(expires)?;
        match self {
            Self::Native(_) => custody::initialize_standing_stage(stage),
            #[cfg(test)]
            Self::Fixture(_) => custody::initialize_standing_fixture(stage),
        }
    }
    fn prepare(
        &self,
        root: &Dir,
        guard: &MutationGuard,
        catalog: &Catalog,
        keys: &Dir,
        b: Bindings,
    ) -> Result<Prepared> {
        let authority = custody::load(keys, "local-authority", Role::Authority, catalog)?;
        let producer = custody::load(keys, "local-deployment-registry", Role::Producer, catalog)?;
        match self {
            Self::Native(_) => {
                preactivation::prepare(root, guard, catalog, &authority, &producer, b)
            }
            #[cfg(test)]
            Self::Fixture(roots) => {
                preactivation::fixture::prepare(roots, guard, catalog, &authority, &producer, b)
            }
        }
    }
    fn append(&self, root: &Dir, guard: &MutationGuard, p: &Prepared) -> Result<()> {
        match self {
            Self::Native(_) => preactivation::append_prepared(root, guard, p),
            #[cfg(test)]
            Self::Fixture(roots) => preactivation::fixture::append(roots, guard, p),
        }
    }
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Pending {
    operation_id: String,
    package_digest: String,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct OperationIntent {
    version: u32,
    operation_id: String,
    packet_sha256: String,
    grant_sha256: String,
    controller_sha256: String,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Host {
    version: u32,
    state: String,
    operation_id: String,
    packet_sha256: String,
    controller_sha256: String,
    lifecycle_digest: String,
    tailscale_digest: String,
    root_roles_digest: String,
}
#[derive(Serialize)]
struct Intent<'a> {
    version: u32,
    state: &'static str,
    bindings: &'a Bindings,
}

pub(crate) fn run(root: &Dir, guard: &MutationGuard, b: Bindings, expires: u64) -> Result<Proof> {
    require(
        unsafe { libc::geteuid() } == 0 && root.uid == 0,
        "ROOT_REQUIRED",
    )?;
    let fixed = Dir::open(Path::new(custody::ROOT), 0)?;
    let a = root.file.metadata()?;
    let f = fixed.file.metadata()?;
    require((a.dev(), a.ino()) == (f.dev(), f.ino()), "CUSTODY_ROOT")?;
    require(
        b.installation_receipt_digest
            == "2d3b0e23b20aaaf3187a40a813e10098c1c0a639a61810f7e82bec7dca62bbb7",
        "CUSTODY_INSTALLATION",
    )?;
    let attempt = Dir::open(
        Path::new("/private/var/db/agent-deploy-bootstrap/genesis-65559dd-20260918-01/steps"),
        0,
    )?;
    let receipt = snapshot(
        &attempt.open_file("installation.json", libc::O_RDONLY, 0)?,
        0,
        1024 * 1024,
    )?;
    require(
        sha(&receipt.bytes) == b.installation_receipt_digest,
        "CUSTODY_INSTALLATION",
    )?;
    perform(
        root,
        guard,
        b,
        expires,
        Mode::Native(std::marker::PhantomData),
    )
}

fn perform(
    root: &Dir,
    guard: &MutationGuard,
    b: Bindings,
    expires: u64,
    mode: Mode<'_>,
) -> Result<Proof> {
    guard.binds(root)?;
    deadline(expires)?;
    require(
        root.file.metadata()?.mode() & 0o7777 == 0o700,
        "UNSAFE_MODE",
    )?;
    validate_host(root, &b)?;
    absent(root, "custody-transition")?;
    mode.validate(root, guard)?;
    let service_raw = raw(root, "service.json", 0o600)?;
    let trust_raw = raw(root, "local-trust.json", 0o600)?;
    let mut service: Configuration = decode(&service_raw)?;
    let old_keys = root.child("issuer-keys")?;
    validate_keys(&old_keys, &service.catalog)?;
    let old_meta = old_keys.file.metadata()?;
    let area = root.mkdir("custody-transition")?;
    write(
        &area,
        "intent.json",
        &canonical_bytes(&Intent {
            version: 1,
            state: "CUSTODY_TRANSITION_CONSUMED",
            bindings: &b,
        })?,
        0o400,
    )?;
    checkpoint("intent", expires)?;
    let staged = area.mkdir("generated")?;
    let fresh = mode.generate(&staged, expires)?;
    checkpoint("generated", expires)?;
    // Existing exact roles/scopes/profiles remain authoritative, only key values change.
    service.catalog.revision = preactivation::CATALOG_REVISION.into();
    for (id, old) in &mut service.catalog.keys {
        old.public_key = fresh
            .keys
            .get(id)
            .ok_or(Error::new("CUSTODY_KEYSET"))?
            .public_key
            .clone();
    }
    let keys = staged.child("issuer-keys")?;
    validate_keys(&keys, &service.catalog)?;
    let p = mode.prepare(root, guard, &service.catalog, &keys, b.clone())?;
    require(
        p.old_service == service_raw && p.old_trust == trust_raw,
        "CUSTODY_PREIMAGE",
    )?;
    let service_bytes = canonical_bytes(&service)?;
    publish::archive(&area, &p, &service_bytes)?;
    checkpoint("archived", expires)?;
    guard.binds(root)?;
    validate_host(root, &b)?;
    mode.validate(root, guard)?;
    let named = root.child("issuer-keys")?;
    let m = named.file.metadata()?;
    require(
        (m.dev(), m.ino()) == (old_meta.dev(), old_meta.ino()),
        "CUSTODY_KEYS_CHANGED",
    )?;
    let old: Configuration = decode(&p.old_service)?;
    validate_keys(&named, &old.catalog)?;
    publish::keys(root, &area, &staged, expires)?;
    publish::configuration(root, &area, &p, &service, expires)?;
    mode.append(root, guard, &p)?;
    checkpoint("state2", expires)?;
    guard.binds(root)?;
    validate_host(root, &b)?;
    validate_keys(&root.child("issuer-keys")?, &service.catalog)?;
    require(
        raw(root, "service.json", 0o600)? == service_bytes,
        "CUSTODY_READBACK",
    )?;
    require(
        raw(
            &root.child("registry")?,
            "state-00000000000000000002.json",
            0o600,
        )? == p.state2,
        "CUSTODY_READBACK",
    )?;
    let result = Completion {
        version: preactivation::VERSION,
        state: preactivation::STATE.into(),
        operation_id: b.operation_id,
        package_digest: b.package_digest,
        owner_grant_digest: b.owner_grant_digest,
        safe_host_receipt_digest: b.safe_host_receipt_digest,
        controller_sha256: b.controller_sha256,
        installation_receipt_digest: b.installation_receipt_digest,
        bridge_sha256: sha(&p.bridge),
        published_service_sha256: sha(&service_bytes),
        catalog_revision: preactivation::CATALOG_REVISION.into(),
        keyset_digest: p.keyset_digest,
    };
    let bytes = canonical_bytes(&result)?;
    checkpoint("before-result", expires)?;
    write(&area, "result.json", &bytes, 0o400)?;
    require(
        raw(&area, "result.json", 0o400)? == bytes,
        "CUSTODY_READBACK",
    )?;
    Ok(Proof {
        old_catalog: old.catalog,
        catalog: service.catalog,
        service_sha256: sha(&service_bytes),
        completion_sha256: sha(&bytes),
    })
}

fn validate_host(root: &Dir, b: &Bindings) -> Result<()> {
    require(
        b.operation_id == "first-live-dsh-20260918-01",
        "CUSTODY_OPERATION",
    )?;
    for s in [
        &b.package_digest,
        &b.owner_grant_digest,
        &b.safe_host_receipt_digest,
        &b.controller_sha256,
        &b.installation_receipt_digest,
    ] {
        valid_digest(s)?;
    }
    let pending: Pending = decode(&raw(root, "first-live-pending.json", 0o400)?)?;
    require(
        pending.operation_id == b.operation_id && pending.package_digest == b.package_digest,
        "CUSTODY_PENDING_BINDING",
    )?;
    let area = root.child("first-live-operation")?;
    require(
        area.file.metadata()?.mode() & 0o7777 == 0o700,
        "UNSAFE_MODE",
    )?;
    let intent: OperationIntent = decode(&raw(&area, "first-live-intent.json", 0o400)?)?;
    require(
        intent.version == 1
            && intent.operation_id == b.operation_id
            && intent.packet_sha256 == b.package_digest
            && intent.grant_sha256 == b.owner_grant_digest
            && intent.controller_sha256 == b.controller_sha256,
        "CUSTODY_OWNER_GRANT_BINDING",
    )?;
    let bytes = raw(&area, "host-safety-result.json", 0o400)?;
    require(
        sha(&bytes) == b.safe_host_receipt_digest,
        "CUSTODY_HOST_DIGEST",
    )?;
    let h: Host = decode(&bytes)?;
    for s in [
        &h.lifecycle_digest,
        &h.tailscale_digest,
        &h.root_roles_digest,
    ] {
        valid_digest(s)?;
    }
    require(
        h.version == 1
            && h.state == "CURRENT_HOST_INGRESS_CLOSED"
            && h.operation_id == b.operation_id
            && h.packet_sha256 == b.package_digest
            && h.controller_sha256 == b.controller_sha256,
        "CUSTODY_HOST_BINDING",
    )
}
fn validate_keys(dir: &Dir, c: &Catalog) -> Result<()> {
    let mut names: Vec<_> = custody::ROLES
        .iter()
        .map(|(id, _)| format!("{id}.json"))
        .collect();
    names.sort();
    require(dir.names()? == names, "CUSTODY_KEY_SHAPE")?;
    for (id, role) in custody::ROLES {
        custody::load(dir, id, role, c)?;
    }
    Ok(())
}
fn decode<T: serde::de::DeserializeOwned>(bytes: &[u8]) -> Result<T> {
    Ok(serde_json::from_value(
        crate::verification::documents::strict_json(bytes)?,
    )?)
}
fn raw(dir: &Dir, name: &str, mode: u32) -> Result<Vec<u8>> {
    let v = snapshot(
        &dir.open_file(name, libc::O_RDONLY, 0)?,
        dir.uid,
        32 * 1024 * 1024,
    )?;
    require(v.mode == mode, "UNSAFE_MODE")?;
    Ok(v.bytes)
}
fn write(dir: &Dir, name: &str, bytes: &[u8], mode: u32) -> Result<()> {
    write_new(dir, name, bytes, dir.uid, dir.file.metadata()?.gid(), mode)?;
    Ok(())
}
fn absent(dir: &Dir, name: &str) -> Result<()> {
    match dir.open_file(name, libc::O_RDONLY, 0) {
        Err(e) if e.code() == "ABSENT" => Ok(()),
        Err(e) => Err(e),
        Ok(_) => Err(Error::new("CUSTODY_ALREADY_EXISTS")),
    }
}
fn deadline(expires: u64) -> Result<()> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|_| Error::new("CLOCK"))?
        .as_secs();
    require(now < expires, "FIRST_LIVE_EXPIRED")
}
fn checkpoint(_name: &str, expires: u64) -> Result<()> {
    deadline(expires)?;
    #[cfg(test)]
    tests::checkpoint(_name)?;
    Ok(())
}
#[cfg(test)]
fn fixture_run(
    roots: &crate::fs::FixtureRoots,
    guard: &MutationGuard,
    b: Bindings,
    expires: u64,
) -> Result<Proof> {
    require(unsafe { libc::geteuid() } != 0, "FIXTURE_REFUSES_ROOT")?;
    perform(&roots.root, guard, b, expires, Mode::Fixture(roots))
}

#[cfg(test)]
#[path = "../../test/issuer/custody_transition.rs"]
mod tests;
