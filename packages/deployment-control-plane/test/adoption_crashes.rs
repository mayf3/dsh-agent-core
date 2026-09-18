use super::*;
use crate::{common::*, trust::digest};
use std::{fs, process::Command};
#[test]
fn adoption_crash_worker() {
    let Ok(path) = std::env::var("DCP_ADOPTION_TEST_ROOT") else {
        return;
    };
    let root = std::path::Path::new(&path);
    let roots = FixtureRoots::open(root).unwrap();
    let q = Queue::open(root.join("empty-queue.db")).unwrap();
    let p: Proposal =
        serde_json::from_slice(&fs::read(root.join("test-proposal.json")).unwrap()).unwrap();
    let g: Signed<AdoptionGrant> =
        serde_json::from_slice(&fs::read(root.join("test-grant.json")).unwrap()).unwrap();
    let slots = serde_json::from_slice(&fs::read(root.join("test-slots.json")).unwrap()).unwrap();
    let mut e = Executor::fixture(&roots).unwrap();
    e.slots = slots;
    let guard = roots.lock().unwrap();
    e.adopt_existing(&guard, &q, &fixture_catalog(), &actor(), &p, &g, 1000)
        .unwrap();
}
#[test]
fn first_adoption_crash_edges_reconcile_same_operation_without_install_or_restart() {
    for edge in [
        "adoption-reserved",
        "adoption-unit-admitted",
        "adoption-observed",
        "adoption-published",
        "adoption-finalized",
    ] {
        let (tmp, roots, q, c, p, mut e, g) = super::adopted_baseline_tests::setup();
        let before = e.complete_face().unwrap();
        let service = e.service.image().unwrap();
        for (name, bytes) in [
            ("test-proposal.json", serde_json::to_vec(&p).unwrap()),
            ("test-grant.json", serde_json::to_vec(&g).unwrap()),
            ("test-slots.json", serde_json::to_vec(&e.slots).unwrap()),
        ] {
            fs::write(tmp.path().join(name), bytes).unwrap();
        }
        let status = Command::new(std::env::current_exe().unwrap())
            .args([
                "--exact",
                "transaction::adoption_crash_tests::adoption_crash_worker",
            ])
            .env("DCP_ADOPTION_TEST_ROOT", tmp.path())
            .env("DCP_TEST_POINT", edge)
            .status()
            .unwrap();
        assert_eq!(status.code(), Some(75), "{edge}");
        assert!(q.require_standing_activation().is_err());
        assert!(q.next_ready(&c).unwrap().is_none());
        let guard = roots.lock().unwrap();
        let r = e
            .adopt_existing(&guard, &q, &c, &actor(), &p, &g, 1000)
            .unwrap();
        assert_eq!(q.unit_count().unwrap(), 1);
        assert_eq!(r.attempt, 0);
        assert_eq!(e.complete_face().unwrap(), before);
        assert_eq!(e.service.image().unwrap(), service);
        assert!(q.require_standing_activation().is_err());
        let current = e
            .verify_installed(&guard, &q, &c, &r.unit_id, &p.policy, 1000)
            .unwrap();
        assert_eq!(current.transaction_receipt_digest, digest(&r).unwrap());
    }
}
