use super::*;
use crate::registry::test_fixture as fixture;
use crate::{common::*, fs::FixtureRoots};
use std::os::unix::fs::PermissionsExt;

fn setup_issue() -> (tempfile::TempDir, FixtureRoots, Catalog, Registry, Draft) {
    let temp = private::temp();
    let roots = FixtureRoots::open(temp.path()).unwrap();
    for name in ["issuer-jobs", "staging"] {
        roots.root.mkdir(name).unwrap();
    }
    roots
        .root
        .mkdir("intake")
        .unwrap()
        .mkdir("proposals")
        .unwrap();
    let catalog = fixture_catalog();
    let registry = fixture::open(temp.path(), &catalog);
    registry.enroll(&fixture::enrollment("goal")).unwrap();
    let proposal = proposal("first", "e", 1, "goal");
    let draft = Draft {
        binding: IssueBinding {
            goal_id: "goal".into(),
            source_sha: "a".repeat(40),
            revision: 0,
            profile_digest: digest(&catalog.profiles["fixture"]).unwrap(),
            source_policy_digest: "b".repeat(64),
        },
        proposal,
        canonical_lineage_digest: "c".repeat(64),
        review_job_digest: "d".repeat(64),
        review_evidence_digest: "e".repeat(64),
    };
    (temp, roots, catalog, registry, draft)
}

#[test]
fn partial_protected_publication_resumes_exact_prefix_without_accepting_mismatch() {
    let temp = private::temp();
    let roots = FixtureRoots::open(temp.path()).unwrap();
    std::fs::write(temp.path().join("record.json.partial"), b"abc").unwrap();
    std::fs::set_permissions(
        temp.path().join("record.json.partial"),
        std::fs::Permissions::from_mode(0o600),
    )
    .unwrap();
    immutable(&roots.root, "record.json", b"abcdef").unwrap();
    assert_eq!(
        std::fs::read(temp.path().join("record.json")).unwrap(),
        b"abcdef"
    );
    assert!(!temp.path().join("record.json.partial").exists());
    std::fs::write(temp.path().join("bad.json.partial"), b"wrong").unwrap();
    std::fs::set_permissions(
        temp.path().join("bad.json.partial"),
        std::fs::Permissions::from_mode(0o600),
    )
    .unwrap();
    assert_eq!(
        immutable(&roots.root, "bad.json", b"abcdef")
            .unwrap_err()
            .code(),
        "IMMUTABLE_DELIVERY"
    );
}

#[test]
fn restart_after_each_publication_boundary_renews_without_losing_exact_evidence() {
    for crash in [1, 2, 3] {
        let (_temp, roots, catalog, registry, draft) = setup_issue();
        save(&roots.root, &draft).unwrap();
        assert_eq!(
            publish(
                &roots.root,
                Publication {
                    catalog: &catalog,
                    registry: &registry,
                    actor: &actor()
                },
                &draft,
                draft.proposal.policy.clone(),
                1001,
                Some(crash)
            )
            .unwrap_err()
            .code(),
            "ISSUANCE_INTERRUPTED"
        );
        let resumed = pending(&roots.root, &draft.binding).unwrap().unwrap();
        assert_eq!(resumed.proposal.build, draft.proposal.build);
        assert_eq!(resumed.proposal.reviews, draft.proposal.reviews);
        let mut lease = policy();
        lease.epoch = 2;
        lease.issued_at = 1300;
        lease.expires_at = 1500;
        let id = publish(
            &roots.root,
            Publication {
                catalog: &catalog,
                registry: &registry,
                actor: &actor(),
            },
            &resumed,
            signed("authority", lease),
            1301,
            None,
        )
        .unwrap();
        let published: Proposal = read(
            &roots
                .root
                .child("intake")
                .unwrap()
                .child("proposals")
                .unwrap(),
            &format!("{id}.json"),
        )
        .unwrap();
        assert_ne!(published.request_id, draft.proposal.request_id);
        assert_eq!(registry.get("goal").unwrap().state, DeploymentState::Ready);
        let queue = crate::queue::Queue::open(":memory:").unwrap();
        queue.register_producer(&catalog, "producer").unwrap();
        queue
            .ingest_snapshot(&catalog, &registry.snapshots_after(0, 16).unwrap()[0])
            .unwrap();
        queue
            .ingest_snapshot(&catalog, &registry.snapshots_after(1, 16).unwrap()[0])
            .unwrap();
        queue.submit(&catalog, &actor(), &published, 1301).unwrap();
    }
}

#[test]
fn retained_partial_and_failed_outputs_count_before_any_new_write() {
    let (temp, roots, catalog, registry, draft) = setup_issue();
    let large = std::fs::File::create(temp.path().join("staging/failed-partial")).unwrap();
    large.set_len(MAX_BYTES).unwrap();
    let before = roots.root.child("issuer-jobs").unwrap().names().unwrap();
    assert_eq!(
        save(&roots.root, &draft).unwrap_err().code(),
        "ISSUER_STORAGE_QUOTA"
    );
    assert_eq!(
        publish(
            &roots.root,
            Publication {
                catalog: &catalog,
                registry: &registry,
                actor: &actor()
            },
            &draft,
            draft.proposal.policy.clone(),
            1001,
            None
        )
        .unwrap_err()
        .code(),
        "ISSUER_STORAGE_QUOTA"
    );
    assert_eq!(
        roots.root.child("issuer-jobs").unwrap().names().unwrap(),
        before
    );
}

#[test]
fn interrupted_unpublished_draft_does_not_poison_a_fresh_review() {
    let (temp, roots, _, _, draft) = setup_issue();
    let id = digest(&draft.binding).unwrap();
    // No final binding index or READY was committed. Retain the failed bytes,
    // but they cannot permanently claim the unique binding's publication name.
    let partial = temp
        .path()
        .join("issuer-jobs")
        .join(format!("draft-{id}.json.partial"));
    std::fs::write(&partial, b"incomplete earlier independent review").unwrap();
    std::fs::set_permissions(&partial, std::fs::Permissions::from_mode(0o600)).unwrap();
    save(&roots.root, &draft).unwrap();
    assert_eq!(
        pending(&roots.root, &draft.binding)
            .unwrap()
            .unwrap()
            .review_evidence_digest,
        draft.review_evidence_digest
    );
    assert!(partial.is_file());
}

#[test]
fn two_goals_before_queue_submit_share_only_the_same_artifact() {
    let (_temp, roots, catalog, registry, draft) = setup_issue();
    registry
        .enroll(&fixture::enrollment("second-goal"))
        .unwrap();
    save(&roots.root, &draft).unwrap();
    // Even a draft committed just before a crash/READY CAS is an outstanding
    // target reservation. B must remain PENDING, not be signed into dead READY.
    let target = &draft.proposal.desired.payload.target_runtime;
    assert_eq!(
        admit_target(
            &roots.root,
            &registry,
            "second-goal",
            target,
            &"f".repeat(64)
        )
        .unwrap_err()
        .code(),
        "ISSUER_TARGET_PENDING"
    );
    assert_eq!(
        registry.get("second-goal").unwrap().state,
        DeploymentState::Pending
    );
    admit_target(
        &roots.root,
        &registry,
        "second-goal",
        target,
        &draft.proposal.build.payload.artifact_sha256,
    )
    .unwrap();
    publish(
        &roots.root,
        Publication {
            catalog: &catalog,
            registry: &registry,
            actor: &actor(),
        },
        &draft,
        draft.proposal.policy.clone(),
        1001,
        None,
    )
    .unwrap();
    assert_eq!(
        admit_target(
            &roots.root,
            &registry,
            "second-goal",
            target,
            &"f".repeat(64)
        )
        .unwrap_err()
        .code(),
        "ISSUER_TARGET_PENDING"
    );
}
