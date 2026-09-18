//! Non-root kernel-temporary fixtures only. Never compiled into an executable.
use super::*;
use crate::{common, service::Configuration};
use sha2::{Digest, Sha256};

pub(crate) fn key(id: &str, epoch: &str) -> SigningKey {
    SigningKey::from_bytes(&Sha256::digest(format!("{epoch}:{id}")).into())
}
pub(crate) fn catalog(epoch: &str) -> Catalog {
    let mut c = common::fixture_catalog();
    c.keys.clear();
    c.revision = if epoch == "old" {
        "local-genesis-v1"
    } else {
        CATALOG_REVISION
    }
    .into();
    let mut profile = c.profiles.remove("fixture").unwrap();
    profile.enabled = false;
    c.profiles.insert("dsh-app".into(), profile);
    for (id, role) in crate::issuer::custody::ROLES {
        let mut scopes = vec!["dsh-app".into(), "preparation".into()];
        if role == Role::Authority {
            scopes.extend(["bootstrap".into(), PRODUCER.into()]);
        }
        if role == Role::Producer {
            scopes.push(PRODUCER.into());
        }
        c.keys.insert(
            id.into(),
            TrustedKey {
                public_key: hex::encode(key(id, epoch).verifying_key().as_bytes()),
                role,
                scopes,
            },
        );
    }
    c
}
pub(crate) fn write(dir: &Dir, name: &str, bytes: &[u8], mode: u32) {
    crate::fs::file::write_new(
        dir,
        name,
        bytes,
        dir.uid,
        dir.file.metadata().unwrap().gid(),
        mode,
    )
    .unwrap();
}
pub(crate) fn install_genesis(roots: &FixtureRoots) -> crate::service::Configuration {
    assert_ne!(unsafe { libc::geteuid() }, 0);
    let c = catalog("old");
    let config = Configuration {
        catalog: c.clone(),
        callers: vec![],
        producers: vec![PRODUCER.into()],
        verifiers: BTreeMap::new(),
        socket_gid: 20,
        first_target_adoption: None,
        socket_ancestor: None,
    };
    write(
        &roots.root,
        "service.json",
        &canonical_bytes(&config).unwrap(),
        0o600,
    );
    let mut trust = c.clone();
    trust.profiles.clear();
    write(
        &roots.root,
        "local-trust.json",
        &canonical_bytes(&trust).unwrap(),
        0o600,
    );
    let registry = Registry::open(
        roots.root.mkdir("registry").unwrap(),
        &c,
        PRODUCER,
        key(PRODUCER, "old"),
        None,
    )
    .unwrap();
    let mut e = super::super::test_fixture::enrollment("goal").payload;
    e.producer_id = PRODUCER.into();
    e.deployment_profile = "dsh-app".into();
    registry
        .enroll(&sign(&key("local-authority", "old"), "local-authority", e).unwrap())
        .unwrap();
    config
}
fn pins(service: &[u8], trust: &[u8], state: &[u8]) -> Pins {
    let c: Configuration = serde_json::from_slice(service).unwrap();
    let l: Signed<storage::Ledger> = serde_json::from_slice(state).unwrap();
    let e = &l.payload.rows.first_key_value().unwrap().1.enrollment;
    Pins {
        service: sha(service),
        trust: sha(trust),
        state1: sha(state),
        catalog: digest(&c.catalog).unwrap(),
        enrollment: digest(e).unwrap(),
        enrollment_payload: digest(&e.payload).unwrap(),
        snapshot_payload: digest(&l.payload.snapshot.payload).unwrap(),
    }
}
pub(crate) fn prepare(
    roots: &FixtureRoots,
    guard: &MutationGuard,
    fresh: &Catalog,
    authority: &SigningKey,
    producer: &SigningKey,
    bindings: Bindings,
) -> Result<Prepared> {
    assert_ne!(unsafe { libc::geteuid() }, 0);
    let root = &roots.root;
    let p = pins(
        &raw(root, "service.json", 0o600)?,
        &raw(root, "local-trust.json", 0o600)?,
        &raw(&root.child("registry")?, STATE1, 0o600)?,
    );
    prepare_impl::prepare_checked(root, guard, fresh, authority, producer, bindings, p)
}
pub(crate) fn append(roots: &FixtureRoots, guard: &MutationGuard, p: &Prepared) -> Result<()> {
    assert_ne!(unsafe { libc::geteuid() }, 0);
    prepare_impl::append_checked(&roots.root, guard, p)
}
pub(crate) fn load(roots: &FixtureRoots, c: &Catalog) -> Result<Registry> {
    load_with_key(roots, c, key(PRODUCER, "fresh"))
}
pub(crate) fn load_with_key(
    roots: &FixtureRoots,
    c: &Catalog,
    producer: SigningKey,
) -> Result<Registry> {
    assert_ne!(unsafe { libc::geteuid() }, 0);
    let d = roots.root.child("custody-transition")?;
    let p = pins(
        &raw(&d, "old-service.json", 0o400)?,
        &raw(&d, "old-trust.json", 0o400)?,
        &raw(&d, "old-state1.json", 0o400)?,
    );
    Registry::open(
        roots.root.child("registry")?,
        c,
        PRODUCER,
        producer,
        read::load_checked(&roots.root, c, &p)?,
    )
}

pub(super) fn bindings() -> Bindings {
    Bindings {
        operation_id: "first-live-dsh-20260918-01".into(),
        package_digest: "1".repeat(64),
        owner_grant_digest: "2".repeat(64),
        safe_host_receipt_digest: "3".repeat(64),
        controller_sha256: "4".repeat(64),
        installation_receipt_digest: "5".repeat(64),
    }
}
pub(super) struct Case {
    pub _temp: tempfile::TempDir,
    pub roots: FixtureRoots,
    pub guard: MutationGuard,
    pub fresh: Catalog,
    pub p: Prepared,
}
impl Case {
    pub fn new() -> Self {
        let temp = common::private::temp();
        let roots = FixtureRoots::open(temp.path()).unwrap();
        install_genesis(&roots);
        let guard = roots.lock().unwrap();
        let fresh = catalog("fresh");
        let p = fixture::prepare(
            &roots,
            &guard,
            &fresh,
            &key("local-authority", "fresh"),
            &key(PRODUCER, "fresh"),
            bindings(),
        )
        .unwrap();
        Self {
            _temp: temp,
            roots,
            guard,
            fresh,
            p,
        }
    }
    pub fn archive(&self) -> Dir {
        let d = self.roots.root.mkdir("custody-transition").unwrap();
        for (name, bytes) in [
            ("old-service.json", &self.p.old_service),
            ("old-trust.json", &self.p.old_trust),
            ("old-state1.json", &self.p.old_state1),
            ("fresh-snapshot1.json", &self.p.fresh_snapshot1),
            ("registry-bridge.json", &self.p.bridge),
        ] {
            write(&d, name, bytes, 0o400);
        }
        let mut service: Configuration = serde_json::from_slice(&self.p.old_service).unwrap();
        service.catalog = self.fresh.clone();
        let published = canonical_bytes(&service).unwrap();
        write(&d, "published-service.json", &published, 0o400);
        replace(&self.roots.root, "service.json", &published, 0o600);
        replace(
            &self.roots.root,
            "local-trust.json",
            &canonical_bytes(&self.fresh).unwrap(),
            0o600,
        );
        d
    }
    pub fn complete(&self, d: &Dir) {
        let b = bindings();
        let result = Completion {
            version: VERSION,
            state: STATE.into(),
            operation_id: b.operation_id,
            package_digest: b.package_digest,
            owner_grant_digest: b.owner_grant_digest,
            safe_host_receipt_digest: b.safe_host_receipt_digest,
            controller_sha256: b.controller_sha256,
            installation_receipt_digest: b.installation_receipt_digest,
            bridge_sha256: sha(&self.p.bridge),
            published_service_sha256: sha(&raw(d, "published-service.json", 0o400).unwrap()),
            catalog_revision: CATALOG_REVISION.into(),
            keyset_digest: self.p.keyset_digest.clone(),
        };
        write(d, "result.json", &canonical_bytes(&result).unwrap(), 0o400);
    }
    pub fn publish(&self) -> Dir {
        let d = self.archive();
        fixture::append(&self.roots, &self.guard, &self.p).unwrap();
        self.complete(&d);
        d
    }
}
pub(super) fn replace(dir: &Dir, name: &str, bytes: &[u8], mode: u32) {
    write(dir, "test-replacement.tmp", bytes, mode);
    dir.rename("test-replacement.tmp", dir, name).unwrap();
}

pub(crate) fn validate_pristine(roots: &FixtureRoots, guard: &MutationGuard) -> Result<()> {
    assert_ne!(unsafe { libc::geteuid() }, 0);
    let root = &roots.root;
    let p = pins(
        &raw(root, "service.json", 0o600)?,
        &raw(root, "local-trust.json", 0o600)?,
        &raw(&root.child("registry")?, STATE1, 0o600)?,
    );
    prepare_impl::validate_pristine_checked(root, guard, &p)
}
