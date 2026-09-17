mod common;
use common::*;
use deployment_control_plane::{model::*, trust::*};
#[test]
fn forged_or_changed_signed_payload_is_rejected() {
    let catalog = catalog();
    let mut record = signed("authority", policy());
    verify_signed(&record, &catalog, "fixture").unwrap();
    record.payload.epoch = 9;
    assert_eq!(
        verify_signed(&record, &catalog, "fixture")
            .unwrap_err()
            .code(),
        "INVALID_SIGNATURE"
    );
    record.signature = "00".repeat(64);
    assert_eq!(
        verify_signed(&record, &catalog, "fixture")
            .unwrap_err()
            .code(),
        "INVALID_SIGNATURE"
    );
}
#[test]
fn key_role_and_scope_are_enforced() {
    assert_eq!(
        verify_signed(&signed("builder", policy()), &catalog(), "fixture")
            .unwrap_err()
            .code(),
        "ISSUER_ROLE"
    );
    assert_eq!(
        verify_signed(&signed("authority", policy()), &catalog(), "unknown")
            .unwrap_err()
            .code(),
        "ISSUER_SCOPE"
    );
}
#[test]
fn caller_fields_cannot_inject_paths_or_commands() {
    let mut value = serde_json::to_value(signed("authority", policy())).unwrap();
    value["payload"]["command"] = "rm".into();
    assert!(serde_json::from_value::<Signed<Policy>>(value).is_err());
}
#[test]
fn admission_rejects_untrusted_release_bindings_without_inserting() {
    let (_dir, q, c) = setup();
    let base = proposal("request", "e", 1, "goal");
    register(&q, &c, &base);
    let mut cases = Vec::new();
    let mut p = base.clone();
    p.acceptance
        .payload
        .semantic_authors
        .push("reviewer".into());
    p.acceptance = signed("authority", p.acceptance.payload);
    cases.push((p, "SELF_REVIEW"));
    let mut p = base.clone();
    p.policy.payload.expires_at = 999;
    p.policy = signed("authority", p.policy.payload);
    cases.push((p, "POLICY_EXPIRED"));
    let mut p = base.clone();
    p.build.payload.artifact_sha256 = "9".repeat(64);
    p.build = signed("builder", p.build.payload);
    cases.push((p, "ARTIFACT_MISMATCH"));
    let mut p = base.clone();
    p.build.payload.source_sha = "9".repeat(40);
    p.build = signed("builder", p.build.payload);
    cases.push((p, "SOURCE_MISMATCH"));
    let mut p = base.clone();
    p.build.payload.profile_revision = "profile-other".into();
    p.build = signed("builder", p.build.payload);
    cases.push((p, "PROFILE_MISMATCH"));
    let mut p = base.clone();
    p.build.payload.goal_coverage.clear();
    p.build = signed("builder", p.build.payload);
    cases.push((p, "GOAL_COVERAGE"));
    let mut p = base.clone();
    p.deployment_profile = "../../etc".into();
    cases.push((p, "INVALID_ID"));
    for (p, code) in cases {
        assert_eq!(q.submit(&c, &actor(), &p, 1001).unwrap_err().code(), code);
        assert_eq!(q.unit_count().unwrap(), 0);
    }
}
#[test]
fn authenticated_policy_epoch_cannot_roll_back_or_equivocate() {
    let (_dir, q, c) = setup();
    let mut p = proposal("new", "e", 1, "goal");
    register(&q, &c, &p);
    p.policy.payload.epoch = 9;
    p.policy = signed("authority", p.policy.payload);
    q.submit(&c, &actor(), &p, 1001).unwrap();
    p.request_id = "replay".into();
    p.policy = signed("authority", policy());
    assert_eq!(
        q.submit(&c, &actor(), &p, 1001).unwrap_err().code(),
        "POLICY_REPLAY"
    );
    p.policy.payload.epoch = 9;
    p.policy.payload.expires_at = 1201;
    p.policy = signed("authority", p.policy.payload);
    assert_eq!(
        q.submit(&c, &actor(), &p, 1001).unwrap_err().code(),
        "POLICY_EQUIVOCATION"
    );
}
#[path = "authority_freshness.rs"]
mod freshness;
