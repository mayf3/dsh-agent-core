use crate::{common::*, fixture::*};
use deployment_control_plane::{registry::*, trust::*};
#[test]
fn a_prior_owner_freeze_is_not_relaxed_by_canonical_ancestry_or_review() {
    let temp = private::temp();
    let c = fixture_catalog();
    let r = open(temp.path(), &c);
    let mut e = enrollment("goal").payload;
    e.frozen_source_sha = Some("b".repeat(40));
    r.enroll(&signed("authority", e)).unwrap();
    assert_eq!(
        r.activate(&actor(), &proposal("request", "e", 1, "goal"), 0, 1001)
            .unwrap_err()
            .code(),
        "FROZEN_SOURCE_MISMATCH"
    );
}
#[test]
fn enrollment_is_pending_immutable_and_survives_restart() {
    let temp = private::temp();
    let c = fixture_catalog();
    let r = open(temp.path(), &c);
    let e = enrollment("goal");
    let row = r.enroll(&e).unwrap();
    assert_eq!(row.state, DeploymentState::Pending);
    assert_eq!(row.revision, 0);
    assert!(!row.business_goal_complete);
    assert_eq!(
        row.enrollment.payload.business_goal_id,
        "original-business-goal"
    );
    assert!(r.snapshot().unwrap().payload.records.is_empty());
    assert_eq!(r.enroll(&e).unwrap(), row);
    drop(r);
    let r = open(temp.path(), &c);
    assert_eq!(r.get("goal").unwrap(), row);
    let mut changed = e.payload;
    changed.business_goal_id = "another-goal".into();
    assert_eq!(
        r.enroll(&signed("authority", changed)).unwrap_err().code(),
        "ENROLLMENT_IMMUTABLE"
    );
}
#[test]
fn tampered_wrong_role_and_wrong_scope_enrollments_are_rejected() {
    let temp = private::temp();
    let c = fixture_catalog();
    let r = open(temp.path(), &c);
    let mut e = enrollment("goal");
    e.payload.owner = "intruder".into();
    assert_eq!(r.enroll(&e).unwrap_err().code(), "INVALID_SIGNATURE");
    assert_eq!(
        r.enroll(&signed("producer", enrollment("goal").payload))
            .unwrap_err()
            .code(),
        "ISSUER_ROLE"
    );
    let mut e = enrollment("goal").payload;
    e.deployment_profile = "other".into();
    assert_eq!(
        r.enroll(&signed("authority", e)).unwrap_err().code(),
        "ISSUER_SCOPE"
    );
}
#[test]
fn ready_requires_exact_authenticated_proposal_and_cas() {
    let temp = private::temp();
    let c = fixture_catalog();
    let r = open(temp.path(), &c);
    r.enroll(&enrollment("goal")).unwrap();
    let mut fake = proposal("request", "e", 1, "goal");
    fake.reviews[0].signature = "0".repeat(128);
    assert_eq!(
        r.activate(&actor(), &fake, 0, 1001).unwrap_err().code(),
        "INVALID_SIGNATURE"
    );
    assert_eq!(r.get("goal").unwrap().state, DeploymentState::Pending);
    let p = proposal("request", "e", 1, "goal");
    assert_eq!(
        r.activate(&actor(), &p, 1, 1001).unwrap_err().code(),
        "REGISTRY_CAS"
    );
    let ready = r.activate(&actor(), &p, 0, 1001).unwrap();
    assert_eq!(ready.state, DeploymentState::Ready);
    assert_eq!(ready.revision, 1);
    let snapshot = r.snapshot().unwrap();
    verify_signed(&snapshot, &c, "producer").unwrap();
    assert_eq!(snapshot.payload.records, p.goals);
    assert_eq!(snapshot.payload.revision, 2);
    assert_eq!(snapshot.payload.previous_revision, 1);
    assert_eq!(snapshot.payload.watermark, 2);
}
#[test]
fn business_authority_is_distinct_from_deployment_standing_authority() {
    let temp = private::temp();
    let c = fixture_catalog();
    let r = open(temp.path(), &c);
    let mut e = enrollment("goal").payload;
    e.authority.revision = "original-business-spec".into();
    r.enroll(&signed("authority", e.clone())).unwrap();
    let mut p = proposal("request", "e", 1, "goal");
    assert_eq!(
        r.activate(&actor(), &p, 0, 1001).unwrap_err().code(),
        "ENROLLMENT_BINDING"
    );
    p.goals[0]
        .payload
        .authority_revisions
        .push("original-business-spec".into());
    p.goals[0] = signed("producer", p.goals[0].payload.clone());
    r.activate(&actor(), &p, 0, 1001).unwrap();
    e.goal_id = "wrong-standing".into();
    e.standing_authority_revision = "wrong-authority".into();
    assert_eq!(
        r.enroll(&signed("authority", e)).unwrap_err().code(),
        "ENROLLMENT_BINDING"
    );
}
