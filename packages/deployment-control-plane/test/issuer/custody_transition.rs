use super::*;
use crate::{
    common,
    fs::{
        file::{sha, snapshot, write_new},
        FixtureRoots,
    },
    issuer::custody,
    registry::preactivation::fixture,
    trust::{canonical_bytes, digest},
};
use std::os::unix::fs::MetadataExt;

const OP: &str = "first-live-dsh-20260918-01";
const STATE1: &str = "state-00000000000000000001.json";
fn write(dir: &Dir, name: &str, bytes: &[u8], mode: u32) {
    write_new(
        dir,
        name,
        bytes,
        dir.uid,
        dir.file.metadata().unwrap().gid(),
        mode,
    )
    .unwrap();
}
fn raw(dir: &Dir, name: &str) -> Vec<u8> {
    snapshot(
        &dir.open_file(name, libc::O_RDONLY, 0).unwrap(),
        dir.uid,
        32 * 1024 * 1024,
    )
    .unwrap()
    .bytes
}
struct Case {
    _temp: tempfile::TempDir,
    roots: FixtureRoots,
    guard: MutationGuard,
    bindings: Bindings,
    old: Catalog,
}
impl Case {
    fn new() -> Self {
        let temp = common::private::temp();
        let roots = FixtureRoots::open(temp.path()).unwrap();
        let old = fixture::install_genesis(&roots).catalog;
        let keys = roots.root.mkdir("issuer-keys").unwrap();
        for (id, _) in custody::ROLES {
            write(
                &keys,
                &format!("{id}.json"),
                &canonical_bytes(&hex::encode(fixture::key(id, "old").to_bytes())).unwrap(),
                0o600,
            );
        }
        let b = Bindings {
            operation_id: OP.into(),
            package_digest: "1".repeat(64),
            owner_grant_digest: "2".repeat(64),
            safe_host_receipt_digest: String::new(),
            controller_sha256: "4".repeat(64),
            installation_receipt_digest: "5".repeat(64),
        };
        write(
            &roots.root,
            "first-live-pending.json",
            &canonical_bytes(
                &serde_json::json!({"operation_id":OP,"package_digest":b.package_digest}),
            )
            .unwrap(),
            0o400,
        );
        let area = roots.root.mkdir("first-live-operation").unwrap();
        write(&area,"first-live-intent.json",&canonical_bytes(&serde_json::json!({"version":1,"operation_id":OP,"packet_sha256":b.package_digest,"grant_sha256":b.owner_grant_digest,"controller_sha256":b.controller_sha256})).unwrap(),0o400);
        let host = canonical_bytes(&serde_json::json!({"version":1,"state":"CURRENT_HOST_INGRESS_CLOSED","operation_id":OP,"packet_sha256":b.package_digest,"controller_sha256":b.controller_sha256,"lifecycle_digest":"6".repeat(64),"tailscale_digest":"7".repeat(64),"root_roles_digest":"8".repeat(64)})).unwrap();
        write(&area, "host-safety-result.json", &host, 0o400);
        let bindings = Bindings {
            safe_host_receipt_digest: sha(&host),
            ..b
        };
        let guard = roots.lock().unwrap();
        Self {
            _temp: temp,
            roots,
            guard,
            bindings,
            old,
        }
    }
    fn run(&self) -> Result<Proof> {
        fixture_run(
            &self.roots,
            &self.guard,
            self.bindings.clone(),
            now() + 1200,
        )
    }
}
fn now() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs()
}
pub(super) fn checkpoint(phase: &str) -> crate::Result<()> {
    crate::error::require(
        FAIL_PHASE.get() != Some(phase),
        "INJECTED_CUSTODY_INTERRUPTION",
    )
}
thread_local! { static FAIL_PHASE: std::cell::Cell<Option<&'static str>> = const {std::cell::Cell::new(None)}; }

#[test]
fn every_interrupted_publication_is_fenced_and_never_generates_again() {
    for phase in [
        "intent",
        "generated",
        "archived",
        "retired-keys",
        "new-keys",
        "trust",
        "service",
        "state2",
        "before-result",
    ] {
        let c = Case::new();
        FAIL_PHASE.set(Some(phase));
        let result = c.run();
        FAIL_PHASE.set(None);
        assert!(
            result.is_err(),
            "injected {phase} must interrupt publication"
        );
        let area = c.roots.root.child("custody-transition").unwrap();
        assert!(
            area.open_file("result.json", libc::O_RDONLY, 0).is_err(),
            "{phase}"
        );
        let intent = raw(&area, "intent.json");
        let state1 = raw(&c.roots.root.child("registry").unwrap(), STATE1);
        assert!(
            c.run().is_err(),
            "{phase} cannot be resumed with a new key set"
        );
        assert_eq!(raw(&area, "intent.json"), intent);
        assert_eq!(
            raw(&c.roots.root.child("registry").unwrap(), STATE1),
            state1
        );
        assert!(c
            .roots
            .root
            .open_file("daemon-activation.json", libc::O_RDONLY, 0)
            .is_err());
    }
}

#[test]
fn host_proof_pending_fence_deadline_and_actual_mutex_precede_entropy() {
    for variant in 0..7 {
        let mut c = Case::new();
        let root = &c.roots.root;
        let before = raw(root, "local-trust.json");
        let area = root.child("first-live-operation").unwrap();
        match variant {
            0 => area.unlink("host-safety-result.json").unwrap(),
            1 => c.bindings.safe_host_receipt_digest = "9".repeat(64),
            2 => c.bindings.operation_id = "another-attempt".into(),
            3 => c.bindings.package_digest = "9".repeat(64),
            4 => c.bindings.controller_sha256 = "9".repeat(64),
            5 => root.unlink("first-live-pending.json").unwrap(),
            _ => (),
        }
        let result = if variant == 6 {
            fixture_run(&c.roots, &c.guard, c.bindings.clone(), 0)
        } else {
            c.run()
        };
        assert!(result.is_err(), "variant {variant}");
        assert!(root.child("custody-transition").is_err());
        assert_eq!(raw(root, "local-trust.json"), before);
    }
    let c = Case::new();
    let other = Case::new();
    assert!(fixture_run(&c.roots, &other.guard, c.bindings.clone(), now() + 1200).is_err());
    assert!(run(&c.roots.root, &c.guard, c.bindings.clone(), now() + 1200).is_err());
    assert!(c.roots.root.child("custody-transition").is_err());
}

#[test]
fn truthful_host_hash_cannot_replace_completed_host_semantics() {
    for field in [
        "state",
        "lifecycle_digest",
        "tailscale_digest",
        "root_roles_digest",
    ] {
        let mut c = Case::new();
        let area = c.roots.root.child("first-live-operation").unwrap();
        let mut h: serde_json::Value =
            serde_json::from_slice(&raw(&area, "host-safety-result.json")).unwrap();
        h[field] = "INCOMPLETE".into();
        let bytes = canonical_bytes(&h).unwrap();
        area.unlink("host-safety-result.json").unwrap();
        write(&area, "host-safety-result.json", &bytes, 0o400);
        c.bindings.safe_host_receipt_digest = sha(&bytes);
        assert!(c.run().is_err());
        assert!(c.roots.root.child("custody-transition").is_err());
    }
}

#[test]
fn richer_history_and_missing_permanent_lock_stop_before_entropy() {
    for variant in 0..4 {
        let c = Case::new();
        let root = &c.roots.root;
        match variant {
            0 => write(root, "queue.db", b"occupied", 0o600),
            1 => write(
                &root.child("registry").unwrap(),
                "pending.tmp",
                b"occupied",
                0o600,
            ),
            2 => root
                .child("registry")
                .unwrap()
                .unlink("registry.lock")
                .unwrap(),
            _ => write(
                &root.child("issuer-keys").unwrap(),
                "extra.json",
                b"occupied",
                0o600,
            ),
        }
        assert!(c.run().is_err());
        assert!(root.child("custody-transition").is_err());
        if variant == 2 {
            assert!(root
                .child("registry")
                .unwrap()
                .open_file("registry.lock", libc::O_RDONLY, 0)
                .is_err());
        }
    }
}

#[test]
fn a_different_owner_grant_cannot_borrow_this_host_receipt() {
    let mut c = Case::new();
    c.bindings.owner_grant_digest = "9".repeat(64);
    assert!(c.run().is_err());
    assert!(c.roots.root.child("custody-transition").is_err());
}

#[test]
fn expired_key_retirement_does_not_rename_the_active_key_directory() {
    let c = Case::new();
    let root = &c.roots.root;
    let area = root.mkdir("custody-transition").unwrap();
    let stage = area.mkdir("generated").unwrap();
    Mode::Fixture(&c.roots)
        .generate(&stage, now() + 1200)
        .unwrap();
    let old = root
        .child("issuer-keys")
        .unwrap()
        .file
        .metadata()
        .unwrap()
        .ino();
    assert!(publish::keys(root, &area, &stage, 0).is_err());
    assert_eq!(
        root.child("issuer-keys")
            .unwrap()
            .file
            .metadata()
            .unwrap()
            .ino(),
        old
    );
    assert!(area.child("retired-issuer-keys").is_err());
}

#[test]
fn expired_entropy_entry_cannot_create_any_staged_key() {
    let c = Case::new();
    let stage = c
        .roots
        .root
        .mkdir("custody-transition")
        .unwrap()
        .mkdir("generated")
        .unwrap();
    assert!(Mode::Fixture(&c.roots).generate(&stage, 0).is_err());
    assert!(stage.names().unwrap().is_empty());
}

#[test]
fn real_record_io_failures_consume_transition_and_leave_admission_fenced() {
    for record in [
        "intent.json",
        "local-authority.json",
        "publish-local-trust.json",
        "publish-service.json",
        "result.json",
    ] {
        for fault in ["partial", "fsync"] {
            let c = Case::new();
            write(
                &c.roots.root,
                "fixture-bindings.json",
                &canonical_bytes(&c.bindings).unwrap(),
                0o600,
            );
            drop(c.guard);
            let output = std::process::Command::new(std::env::current_exe().unwrap())
                .args([
                    "--exact",
                    "issuer::custody_transition::tests::record_fault_child",
                    "--ignored",
                    "--test-threads=1",
                ])
                .env("DCP_CUSTODY_FIXTURE", c._temp.path())
                .env("DCP_TEST_FAULT_RECORD", record)
                .env("DCP_TEST_RECORD_FAULT", fault)
                .output()
                .unwrap();
            assert_eq!(
                output.status.code(),
                Some(77),
                "{record}:{fault}: {}",
                String::from_utf8_lossy(&output.stderr)
            );
            let guard = c.roots.lock().unwrap();
            let area = c.roots.root.child("custody-transition").unwrap();
            assert!(area.open_file("intent.json", libc::O_RDONLY, 0).is_ok());
            assert!(c
                .roots
                .root
                .open_file("first-live-pending.json", libc::O_RDONLY, 0)
                .is_ok());
            assert!(c
                .roots
                .root
                .open_file("daemon-activation.json", libc::O_RDONLY, 0)
                .is_err());
            let original = raw(&c.roots.root.child("registry").unwrap(), STATE1);
            assert!(fixture_run(&c.roots, &guard, c.bindings.clone(), now() + 1200).is_err());
            assert_eq!(
                raw(&c.roots.root.child("registry").unwrap(), STATE1),
                original
            );
        }
    }
}

#[test]
#[ignore = "private non-root subprocess only"]
fn record_fault_child() {
    let path = std::env::var_os("DCP_CUSTODY_FIXTURE").expect("private fixture required");
    let roots = FixtureRoots::open(std::path::Path::new(&path)).unwrap();
    let b: Bindings = serde_json::from_slice(&raw(&roots.root, "fixture-bindings.json")).unwrap();
    let guard = roots.lock().unwrap();
    let result = fixture_run(&roots, &guard, b, now() + 1200);
    std::process::exit(if result.is_err() { 77 } else { 78 });
}

#[test]
fn real_entropy_transition_preserves_original_history_and_retires_all_six_keys() {
    let c = Case::new();
    let root = &c.roots.root;
    let registry = root.child("registry").unwrap();
    let old_state = raw(&registry, STATE1);
    let inode = registry
        .open_file(STATE1, libc::O_RDONLY, 0)
        .unwrap()
        .metadata()
        .unwrap()
        .ino();
    let old_dir = root.child("issuer-keys").unwrap();
    let old_inode = old_dir.file.metadata().unwrap().ino();
    let result = c.run().unwrap();
    assert_eq!(result.catalog.revision, "local-first-standing-v1");
    assert_eq!(result.catalog.profiles, c.old.profiles);
    assert_eq!(raw(&registry, STATE1), old_state);
    assert_eq!(
        registry
            .open_file(STATE1, libc::O_RDONLY, 0)
            .unwrap()
            .metadata()
            .unwrap()
            .ino(),
        inode
    );
    let area = root.child("custody-transition").unwrap();
    let retired = area.child("retired-issuer-keys").unwrap();
    assert_eq!(retired.file.metadata().unwrap().ino(), old_inode);
    let fresh = root.child("issuer-keys").unwrap();
    for (id, role) in custody::ROLES {
        assert_eq!(
            raw(&retired, &format!("{id}.json")),
            raw(&old_dir, &format!("{id}.json"))
        );
        assert_ne!(
            result.catalog.keys[id].public_key,
            c.old.keys[id].public_key
        );
        custody::load(&fresh, id, role, &result.catalog).unwrap();
        assert!(custody::load(&retired, id, role, &result.catalog).is_err());
    }
    assert_eq!(result.service_sha256, sha(&raw(root, "service.json")));
    assert_eq!(result.completion_sha256, sha(&raw(&area, "result.json")));
    let key = custody::load(
        &fresh,
        "local-deployment-registry",
        crate::model::Role::Producer,
        &result.catalog,
    )
    .unwrap();
    let loaded = fixture::load_with_key(&c.roots, &result.catalog, key).unwrap();
    let snapshots = loaded.snapshots_after(0, 8).unwrap();
    assert_eq!(
        snapshots
            .iter()
            .map(|s| s.payload.revision)
            .collect::<Vec<_>>(),
        vec![1, 2]
    );
    assert_eq!(
        digest(&result.catalog.keys).unwrap(),
        serde_json::from_slice::<serde_json::Value>(&raw(&area, "result.json")).unwrap()
            ["keyset_digest"]
    );
    assert!(c.run().is_err());
    assert!(root
        .open_file("daemon-activation.json", libc::O_RDONLY, 0)
        .is_err());
}

#[path = "custody_binding.rs"]
mod binding_tests;
