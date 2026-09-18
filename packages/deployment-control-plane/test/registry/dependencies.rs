use crate::{common::*, fixture::*};
use deployment_control_plane::{model::*, registry::*, trust::*};

// A business prerequisite must be represented by the exact signed child, never
// by a matching label or by rewriting the original enrollment.
fn mapped(consumer: &str, child: &Signed<Enrollment>) -> Signed<Enrollment> {
    let mut value = serde_json::to_value(enrollment(consumer).payload).unwrap();
    value["prior_dependencies"] = serde_json::json!([{
        "goal_id": child.payload.business_goal_id,
        "provenance": reference("original-dependency"),
        "deployment_child": {"goal_id": child.payload.goal_id,
                             "enrollment_digest": digest(child).unwrap()}
    }]);
    let payload: Enrollment = serde_json::from_value(value).expect("explicit signed child mapping");
    signed("authority", payload)
}
#[test]
fn exact_child_mapping_preserves_parent_and_activates_only_child_dependency() {
    let temp = private::temp();
    let c = fixture_catalog();
    let r = open(temp.path(), &c);
    let child = enrollment("watchdog-child");
    r.enroll(&child).unwrap();
    let consumer = mapped("broker-child", &child);
    r.enroll(&consumer).unwrap();
    let mut p = proposal("mapped", "e", 1, "broker-child");
    let dependency = Dependency {
        unit_id: "unit-watchdog".into(),
        receipt_digest: "a".repeat(64),
        capability: "ready".into(),
        required_goals: vec![child.payload.business_goal_id.clone()],
        semantics: DependencySemantics::LiveInstallation,
    };
    p.dependencies = vec![dependency.clone()];
    p.goals[0].payload.dependencies = vec![dependency];
    p.goals[0] = signed("producer", p.goals[0].payload.clone());
    assert_eq!(
        r.activate(&actor(), &p, 0, 1001).unwrap_err().code(),
        "PRIOR_DEPENDENCY_REQUIRED"
    );
    p.dependencies[0].required_goals = vec!["watchdog-child".into()];
    p.goals[0].payload.dependencies = p.dependencies.clone();
    p.goals[0] = signed("producer", p.goals[0].payload.clone());
    r.activate(&actor(), &p, 0, 1001).unwrap();
    assert_eq!(r.get("broker-child").unwrap().enrollment, consumer);
    assert!(!r.get("broker-child").unwrap().business_goal_complete);
}
#[test]
fn missing_or_altered_child_cannot_enter_registry() {
    let temp = private::temp();
    let c = fixture_catalog();
    let r = open(temp.path(), &c);
    let child = enrollment("watchdog-child");
    let consumer = mapped("broker-child", &child);
    assert!(r.enroll(&consumer).is_err());
    let mut changed = child.payload.clone();
    changed.acceptance_revision = "delivery-only".into();
    r.enroll(&signed("authority", changed)).unwrap();
    assert!(r.enroll(&consumer).is_err());
}

#[test]
fn child_identity_scope_digest_duplicates_and_cycles_fail_closed() {
    for fault in [
        "business",
        "digest",
        "signature",
        "profile",
        "target",
        "repo",
        "self",
        "parent",
        "duplicate",
        "cycle",
    ] {
        let temp = private::temp();
        let mut c = fixture_catalog();
        let mut child = enrollment("watchdog-child");
        if fault == "cycle" {
            child.payload.prior_dependencies = vec![PriorDependency {
                goal_id: "broker-child".into(),
                provenance: reference("reverse"),
                deployment_child: None,
            }];
            child = signed("authority", child.payload);
        }
        if matches!(fault, "profile" | "target" | "repo") {
            let mut profile = c.profiles["fixture"].clone();
            if fault == "target" {
                profile.target_runtime = "other-runtime".into();
            }
            if fault == "repo" {
                profile.repo = "other-repo".into();
            }
            c.profiles.insert("other".into(), profile.clone());
            c.keys
                .get_mut("authority")
                .unwrap()
                .scopes
                .push("other".into());
            child.payload.deployment_profile = "other".into();
            child.payload.target_runtime = profile.target_runtime;
            child.payload.repo = profile.repo;
            child = signed("authority", child.payload);
        }
        let r = open(temp.path(), &c);
        r.enroll(&child).unwrap();
        let mut consumer = mapped("broker-child", &child).payload;
        let dep = &mut consumer.prior_dependencies[0];
        match fault {
            "business" => dep.goal_id = "wrong-business".into(),
            "digest" | "signature" => {
                dep.deployment_child.as_mut().unwrap().enrollment_digest = "0".repeat(64)
            }
            "self" => dep.deployment_child.as_mut().unwrap().goal_id = "broker-child".into(),
            "parent" => {
                dep.deployment_child.as_mut().unwrap().goal_id = consumer.business_goal_id.clone()
            }
            "duplicate" => consumer.prior_dependencies.push(PriorDependency {
                goal_id: "watchdog-child".into(),
                provenance: reference("alias"),
                deployment_child: None,
            }),
            _ => (),
        }
        if fault == "signature" {
            let mut forged = child.clone();
            forged.signature = "0".repeat(128);
            consumer.prior_dependencies[0]
                .deployment_child
                .as_mut()
                .unwrap()
                .enrollment_digest = digest(&forged).unwrap();
        }
        assert!(r.enroll(&signed("authority", consumer)).is_err(), "{fault}");
        assert!(r.get("broker-child").is_err());
        assert!(r.snapshot().unwrap().payload.records.is_empty());
    }
}
#[test]
fn legacy_dependency_signatures_and_ledger_bytes_roundtrip_unchanged() {
    let temp = private::temp();
    let c = fixture_catalog();
    let r = open(temp.path(), &c);
    let mut value = serde_json::to_value(enrollment("old-broker").payload).unwrap();
    value["prior_dependencies"] = serde_json::json!([{"goal_id":"watchdog-business", "provenance":reference("original-dependency")}]);
    let canonical_old = canonical_bytes(&value).unwrap();
    let old: Enrollment = serde_json::from_slice(&canonical_old).unwrap();
    assert_eq!(canonical_bytes(&old).unwrap(), canonical_old);
    let signed_old = signed("authority", old);
    verify_signed(&signed_old, &c, "fixture").unwrap();
    let row = r.enroll(&signed_old).unwrap();
    let path = temp.path().join("registry/state-00000000000000000001.json");
    let raw = std::fs::read(&path).unwrap();
    drop(r);
    let r = open(temp.path(), &c);
    assert_eq!(r.get("old-broker").unwrap(), row);
    assert_eq!(std::fs::read(&path).unwrap(), raw);
    let mut altered = signed_old.payload;
    altered.prior_dependencies.clear();
    assert_eq!(
        r.enroll(&signed("authority", altered)).unwrap_err().code(),
        "ENROLLMENT_IMMUTABLE"
    );
}

#[test]
fn mapped_child_ready_cannot_downgrade_to_historical_dependency() {
    let temp = private::temp();
    let c = fixture_catalog();
    let r = open(temp.path(), &c);
    let child = enrollment("watchdog-child");
    r.enroll(&child).unwrap();
    r.enroll(&mapped("broker-child", &child)).unwrap();
    let mut p = proposal("historical", "e", 1, "broker-child");
    p.dependencies = vec![Dependency {
        unit_id: "old-unit".into(),
        receipt_digest: "a".repeat(64),
        capability: "ready".into(),
        required_goals: vec!["watchdog-child".into()],
        semantics: DependencySemantics::HistoricalReceipt,
    }];
    p.goals[0].payload.dependencies = p.dependencies.clone();
    p.goals[0] = signed("producer", p.goals[0].payload.clone());
    assert_eq!(
        r.activate(&actor(), &p, 0, 1001).unwrap_err().code(),
        "PRIOR_DEPENDENCY_REQUIRED"
    );
}
