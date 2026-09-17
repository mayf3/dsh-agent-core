use crate::common::*;
use deployment_control_plane::trust::digest;
#[test]
fn observed_revocation_epoch_survives_rejected_admission_and_reopen() {
    let (dir, q, c) = setup();
    let p = proposal("first", "e", 1, "goal");
    register(&q, &c, &p);
    let id = q.submit(&c, &actor(), &p, 1001).unwrap().unit_id;
    let mut revoked = policy();
    revoked.epoch = 2;
    revoked.revoked_sources.push("a".repeat(40));
    assert_eq!(
        q.revalidate(&c, &id, &signed("authority", revoked), 1001)
            .unwrap_err()
            .code(),
        "REVOKED"
    );
    drop(q);
    let q = deployment_control_plane::queue::Queue::open(dir.path().join("queue.db")).unwrap();
    assert_eq!(
        q.revalidate(&c, &id, &signed("authority", policy()), 1001)
            .unwrap_err()
            .code(),
        "POLICY_REPLAY"
    );
}
#[test]
fn source_inclusion_requires_signed_exact_face_not_release_ancestry() {
    let (_dir, q, c) = setup();
    let mut p = proposal("included", "e", 1, "goal");
    p.goals[0].payload.source_sha = "9".repeat(40);
    p.goals[0].payload.coverage.source_sha = "9".repeat(40);
    p.goals[0] = signed("producer", p.goals[0].payload.clone());
    p.build.payload.goal_coverage = vec![p.goals[0].payload.coverage.clone()];
    p.build = signed("builder", p.build.payload);
    register(&q, &c, &p);
    let id = q.submit(&c, &actor(), &p, 1001).unwrap().unit_id;
    q.revalidate(&c, &id, &p.policy, 1001).unwrap();
    assert_eq!(
        q.revalidate(&c, &id, &p.policy, 1301).unwrap_err().code(),
        "POLICY_EXPIRED"
    );
}
#[test]
fn canonical_unit_id_is_derived_from_descriptor_not_request_id() {
    let (_dir, q, c) = setup();
    let p = proposal("one", "e", 1, "goal");
    register(&q, &c, &p);
    let id = q.submit(&c, &actor(), &p, 1001).unwrap().unit_id;
    let mut descriptor = q.status(&actor(), &id).unwrap().unit;
    descriptor.deployment_unit_id.clear();
    assert_eq!(digest(&descriptor).unwrap(), id);
}
#[test]
fn authority_registry_epoch_is_monotonic_across_profile_scopes() {
    let (_dir, q, mut c) = setup();
    let mut other = c.profiles["fixture"].clone();
    other.target_runtime = "other".into();
    other.install_root_id = "other-root".into();
    c.profiles.insert("other".into(), other);
    c.keys
        .get_mut("authority")
        .unwrap()
        .scopes
        .push("other".into());
    let mut current = policy();
    current.epoch = 2;
    q.observe_policy(&c, "fixture", &signed("authority", current), 1001)
        .unwrap();
    assert_eq!(
        q.observe_policy(&c, "other", &signed("authority", policy()), 1001)
            .unwrap_err()
            .code(),
        "POLICY_REPLAY"
    );
}
#[test]
fn overlapping_enabled_roots_cannot_have_independent_release_owners() {
    let (_dir, q, mut c) = setup();
    let mut overlapping = c.profiles["fixture"].clone();
    overlapping.target_runtime = "different-runtime".into();
    c.profiles.insert("overlap".into(), overlapping);
    let p = proposal("req", "e", 1, "goal");
    register(&q, &c, &p);
    assert_eq!(
        q.submit(&c, &actor(), &p, 1001).unwrap_err().code(),
        "TARGET_ROOT_CONFLICT"
    );
    assert_eq!(q.unit_count().unwrap(), 0);
}
#[test]
fn producer_revision_overflow_rejects_without_panicking() {
    let (_dir, q, c) = setup();
    let snapshot = signed(
        "producer",
        deployment_control_plane::model::ProducerSnapshot {
            producer_id: "producer".into(),
            revision: 0,
            previous_revision: u64::MAX,
            records: vec![],
            watermark: 0,
        },
    );
    assert_eq!(
        q.ingest_snapshot(&c, &snapshot).unwrap_err().code(),
        "WATERMARK_GAP"
    );
}
#[test]
fn superseded_signed_policy_remains_reviewable_by_digest() {
    let (_dir, q, c) = setup();
    let old = signed("authority", policy());
    q.observe_policy(&c, "fixture", &old, 1001).unwrap();
    let mut current = policy();
    current.epoch = 2;
    q.observe_policy(&c, "fixture", &signed("authority", current), 1001)
        .unwrap();
    assert_eq!(q.daemon_policy(&digest(&old).unwrap()).unwrap(), old);
}
