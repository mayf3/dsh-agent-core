use super::*;
use crate::{common::*, trust::digest};
use std::{fs, os::unix::fs::MetadataExt};
pub(super) fn setup() -> (
    tempfile::TempDir,
    crate::fs::FixtureRoots,
    Queue,
    Catalog,
    Proposal,
    Executor,
    Signed<AdoptionGrant>,
) {
    let (tmp, roots, old, c, id) = test_fixture::prepared();
    let proposal = old.daemon_evidence(&id).unwrap();
    drop(old);
    fs::write(tmp.path().join("target/main.js"), b"new code").unwrap();
    let q = Queue::open(tmp.path().join("empty-queue.db")).unwrap();
    q.register_producer(&c, "producer").unwrap();
    register(&q, &c, &proposal);
    let mut executor = Executor::fixture(&roots).unwrap();
    let meta = fs::metadata(tmp.path().join("target/main.js")).unwrap();
    executor.slots = Some(vec![EnrolledFile {
        path: "main.js".into(),
        sha256: Some(crate::fs::file::sha(b"new code")),
        mutable: true,
        mode: 0o644,
        gid: meta.gid(),
    }]);
    let grant = grant_payload(&c, &proposal, &mut executor);
    (
        tmp,
        roots,
        q,
        c,
        proposal,
        executor,
        signed("authority", grant),
    )
}
pub(super) fn grant_payload(
    c: &Catalog,
    proposal: &Proposal,
    executor: &mut Executor,
) -> AdoptionGrant {
    let service = executor.service.image().unwrap();
    AdoptionGrant {
        version: 1,
        operation_id: "first-adoption".into(),
        package_digest: "a".repeat(64),
        controller_sha256: "b".repeat(64),
        host: c.profiles["fixture"].host.clone(),
        profile_id: "fixture".into(),
        profile_digest: crate::bootstrap::profile_digest(&c.profiles["fixture"]).unwrap(),
        enrollment_digest: digest(&executor.slots).unwrap(),
        configuration_digest: "c".repeat(64),
        issuer_bindings_digest: "d".repeat(64),
        owner_acceptance_digest: "e".repeat(64),
        lifecycle_evidence_digest: "f".repeat(64),
        initial_face_digest: digest(&executor.complete_face().unwrap()).unwrap(),
        service_generation: service.generation,
        release: AdoptionRelease {
            goal_id: proposal.goals[0].payload.goal_id.clone(),
            acceptance_revision: proposal.goals[0]
                .payload
                .coverage
                .acceptance_revision
                .clone(),
            source_sha: proposal.build.payload.source_sha.clone(),
            artifact_sha256: proposal.build.payload.artifact_sha256.clone(),
            manifest_digest: proposal.build.payload.manifest_digest.clone(),
        },
        canary_plan_digest: "1".repeat(64),
        observation_policy_digest: "2".repeat(64),
        issued_at: 999,
        expires_at: 1300,
    }
}
#[test]
fn empty_queue_authentic_installed_baseline_has_zero_target_effects() {
    let (tmp, roots, q, c, p, mut e, g) = setup();
    let guard = roots.lock().unwrap();
    let before = e.complete_face().unwrap();
    let service = e.service.image().unwrap();
    let r = e
        .adopt_existing(&guard, &q, &c, &actor(), &p, &g, 1000)
        .unwrap();
    assert_eq!(r.origin, InstallationOrigin::ObservedExistingInstallation);
    assert_eq!((r.attempt, r.install_count, r.restart_count), (0, 0, 0));
    assert_eq!(q.unit_count().unwrap(), 1);
    assert_eq!(e.complete_face().unwrap(), before);
    assert_eq!(e.service.image().unwrap(), service);
    let current = e
        .verify_installed(&guard, &q, &c, &r.unit_id, &p.policy, 1000)
        .unwrap();
    assert_eq!(current.attempt, 0);
    assert_eq!(
        fs::read(tmp.path().join("target/main.js")).unwrap(),
        b"new code"
    );
}
#[test]
fn adopted_baseline_rejects_forged_stale_and_global_unsafe_state() {
    for case in ["forged", "stale", "unsafe"] {
        let (_tmp, roots, q, c, p, mut e, mut g) = setup();
        let guard = roots.lock().unwrap();
        let expected = match case {
            "forged" => {
                g.signature = "0".repeat(128);
                "SIGNATURE_INVALID"
            }
            "stale" => {
                g.payload.expires_at = 999;
                g = signed("authority", g.payload);
                "ADOPTION_EXPIRED"
            }
            _ => {
                q.latch_executor_failure(&"f".repeat(64)).unwrap();
                "UNKNOWN_OUTCOME"
            }
        };
        let err = e
            .adopt_existing(&guard, &q, &c, &actor(), &p, &g, 1000)
            .unwrap_err();
        if case == "forged" {
            assert_ne!(err.code(), "ADOPTION_NOT_IMPLEMENTED");
        } else {
            assert_eq!(err.code(), expected);
        }
        assert_eq!(q.unit_count().unwrap(), 0);
    }
}

#[test]
fn baseline_publication_keeps_standing_mutation_fenced() {
    let (_tmp, roots, q, c, p, mut e, g) = setup();
    let guard = roots.lock().unwrap();
    let r = e
        .adopt_existing(&guard, &q, &c, &actor(), &p, &g, 1000)
        .unwrap();
    assert_eq!(
        q.require_standing_activation().unwrap_err().code(),
        "ADOPTION_PENDING"
    );
    assert!(q.next_ready(&c).unwrap().is_none());
    assert_eq!(
        q.submit(&c, &actor(), &p, 1000).unwrap_err().code(),
        "ADOPTION_PENDING"
    );
    assert_eq!(q.install_intents_for_target(&r.target_runtime).unwrap(), 1);
    assert_eq!(
        e.adopt_existing(&guard, &q, &c, &actor(), &p, &g, 1000)
            .unwrap(),
        r
    );
    assert_eq!(q.unit_count().unwrap(), 1);
}
#[test]
fn baseline_rejects_release_face_and_generation_substitution_without_target_effects() {
    for case in ["release", "face", "service", "proposal"] {
        let (tmp, roots, q, c, mut p, mut e, mut g) = setup();
        let guard = roots.lock().unwrap();
        let before = e.complete_face().unwrap();
        match case {
            "release" => {
                g.payload.release.artifact_sha256 = "a".repeat(64);
                g = signed("authority", g.payload);
            }
            "face" => {
                g.payload.initial_face_digest = "a".repeat(64);
                g = signed("authority", g.payload);
            }
            "service" => {
                g.payload.service_generation = "other".into();
                g = signed("authority", g.payload);
            }
            _ => {
                e.adopt_existing(&guard, &q, &c, &actor(), &p, &g, 1000)
                    .unwrap();
                p.request_id = "new-request".into();
            }
        }
        assert!(
            e.adopt_existing(&guard, &q, &c, &actor(), &p, &g, 1000)
                .is_err(),
            "{case}"
        );
        assert_eq!(e.complete_face().unwrap(), before);
        assert_eq!(
            fs::read(tmp.path().join("target/main.js")).unwrap(),
            b"new code"
        );
        assert!(q.daemon_recovery_candidates().unwrap().is_empty());
    }
}
#[test]
fn legacy_current_installation_canonical_bytes_remain_unchanged() {
    let raw = serde_json::json!({"unit_id":"a","target_generation":1,"attempt":1,"transaction_receipt_digest":"b","service_generation":"c","binding_digest":"d"});
    let parsed: CurrentInstallation = serde_json::from_value(raw.clone()).unwrap();
    assert_eq!(parsed.origin, InstallationOrigin::MutationTransaction);
    assert_eq!(
        crate::trust::canonical_bytes(&parsed).unwrap(),
        crate::trust::canonical_bytes(&raw).unwrap()
    );
}

#[test]
fn configured_first_adoption_blocks_startup_even_before_reservation() {
    let (_tmp, _roots, q, _c, _p, _e, _g) = setup();
    assert_eq!(
        q.require_configured_activation(Some("first-adoption"))
            .unwrap_err()
            .code(),
        "ADOPTION_REQUIRED"
    );
    q.require_configured_activation(None).unwrap();
}
