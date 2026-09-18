use super::*;
use crate::{common::*, registry::test_fixture as fixture, transaction::EnrolledFile};
fn fixture_policy() -> (
    SupervisorPolicy,
    Signed<Enrollment>,
    Profile,
    NativeEnrollment,
) {
    let mut profile = fixture_catalog().profiles.remove("fixture").unwrap();
    profile.repo = "mayf3/dsh-agent-core".into();
    let mut e = fixture::enrollment("watchdog-child").payload;
    e.repo = profile.repo.clone();
    let enrollment = signed("authority", e);
    let source: SourcePolicy = serde_json::from_value(serde_json::json!({
        "repo": profile.repo, "branch":"main", "curl_sha256":"c".repeat(64),
        "accepted_contract_path":"docs/specs/watchdog.md", "accepted_contract_sha256":"c".repeat(64),
        "slots":[{"source":"watchdog.js","target":"watchdog.js","executable":false}],
        "additional_review_paths":[], "dependency_closure":["d".repeat(64)]
    })).unwrap();
    let policy = SupervisorPolicy {
        version: 1,
        source,
        codex_sha256: "a".repeat(64),
        review_helper_sha256: "b".repeat(64),
        policy_epoch: 1,
        revoked_sources: vec![],
        revoked_artifacts: vec![],
    };
    let native = NativeEnrollment {
        host: "fixture".into(),
        caller_uids: vec![502],
        lifecycle_denial_digest: "d".repeat(64),
        required_facets: vec![],
        profile_revision: profile.revision.clone(),
        profile_id: "fixture".into(),
        profile_digest: digest(&profile).unwrap(),
        initial_files: vec![
            EnrolledFile {
                path: "watchdog.js".into(),
                sha256: None,
                mutable: true,
                mode: 0o644,
                gid: 20,
            },
            EnrolledFile {
                path: "broker.js".into(),
                sha256: None,
                mutable: true,
                mode: 0o644,
                gid: 20,
            },
        ],
        runtime_root: "/fixture".into(),
        node_sha256: "a".repeat(64),
        loader_files: vec![],
        launchctl_sha256: "b".repeat(64),
        plutil_sha256: "c".repeat(64),
        services: vec![],
    };
    (policy, enrollment, profile, native)
}
fn v2(p: &SupervisorPolicy, e: &Signed<Enrollment>) -> serde_json::Value {
    let mut value = serde_json::to_value(p).unwrap();
    let source = value.as_object_mut().unwrap().remove("source").unwrap();
    value["version"] = 2.into();
    value["sources_by_goal"] = serde_json::json!({e.payload.goal_id.clone(): {
        "enrollment_digest": digest(e).unwrap(), "source": source
    }});
    value
}
#[test]
fn old_owner_canonical_bytes_and_lease_source_binding_are_unchanged() {
    let (p, e, profile, native) = fixture_policy();
    let bytes = canonical_bytes(&p).unwrap();
    let decoded: OwnerPolicy = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(canonical_bytes(&decoded).unwrap(), bytes);
    assert_eq!(decoded.source_digest().unwrap(), digest(&p.source).unwrap());
    assert_eq!(
        decoded
            .issue_digest(
                &e,
                decoded.select(&e, &profile, &native).unwrap(),
                "native-digest"
            )
            .unwrap(),
        digest(&(&p.source, "native-digest")).unwrap()
    );
}
#[test]
fn exact_goal_selection_cannot_fallback_or_change_slots_contract_or_enrollment() {
    let (p, e, profile, native) = fixture_policy();
    let mut value = v2(&p, &e);
    let mut other = e.payload.clone();
    other.goal_id = "broker-child".into();
    let other = signed("authority", other);
    let mut source = serde_json::to_value(&p.source).unwrap();
    source["slots"][0]["source"] = "broker.js".into();
    source["slots"][0]["target"] = "broker.js".into();
    value["sources_by_goal"]["broker-child"] =
        serde_json::json!({"source":source, "enrollment_digest":digest(&other).unwrap()});
    let policy: OwnerPolicy = serde_json::from_value(value.clone()).unwrap();
    assert_eq!(
        policy.select(&e, &profile, &native).unwrap().slots[0].target,
        "watchdog.js"
    );
    assert_eq!(
        policy.select(&other, &profile, &native).unwrap().slots[0].target,
        "broker.js"
    );
    let mut unknown = e.clone();
    unknown.payload.goal_id = "old-broker-child".into();
    assert_eq!(
        policy
            .select(&unknown, &profile, &native)
            .err()
            .unwrap()
            .code(),
        "ISSUER_SOURCE_NOT_ENROLLED"
    );
    let mut changed = e.clone();
    changed.payload.acceptance_revision = "generic-readback".into();
    assert_eq!(
        policy
            .select(&changed, &profile, &native)
            .err()
            .unwrap()
            .code(),
        "ISSUER_ENROLLMENT_BINDING"
    );
    for fault in [
        "authority",
        "repo",
        "slot",
        "executable",
        "immutable",
        "profile",
    ] {
        let mut bad = value.clone();
        let mut n = native.clone();
        match fault {
            "authority" => {
                bad["sources_by_goal"]["watchdog-child"]["source"]["accepted_contract_sha256"] =
                    "f".repeat(64).into()
            }
            "repo" => {
                bad["sources_by_goal"]["watchdog-child"]["source"]["repo"] = "other/repo".into()
            }
            "slot" => {
                bad["sources_by_goal"]["watchdog-child"]["source"]["slots"][0]["target"] =
                    "other.js".into()
            }
            "executable" => {
                bad["sources_by_goal"]["watchdog-child"]["source"]["slots"][0]["executable"] =
                    true.into()
            }
            "immutable" => n.initial_files[0].mutable = false,
            "profile" => n.profile_digest = "f".repeat(64),
            _ => unreachable!(),
        }
        let rejected: OwnerPolicy = serde_json::from_value(bad).unwrap();
        assert!(rejected.select(&e, &profile, &n).is_err(), "{fault}");
    }
    let observed = BTreeMap::from([
        ("watchdog.js".into(), b"watchdog".to_vec()),
        ("broker.js".into(), b"broker".to_vec()),
    ]);
    for (enrollment, expected) in [(&e, "watchdog.js"), (&other, "broker.js")] {
        let selected = policy.select(enrollment, &profile, &native).unwrap();
        let build = crate::issuer::source::build_regular_files(&selected.slots, &observed).unwrap();
        assert_eq!(build.manifest.entries.len(), 1);
        assert_eq!(build.manifest.entries[0].path, expected);
        assert_eq!(build.blobs["blob-0000"], observed[expected]);
    }
    let selected = policy.select(&e, &profile, &native).unwrap();
    let original_digest = policy.issue_digest(&e, selected, "native-digest").unwrap();
    value["sources_by_goal"]["broker-child"]["source"]["dependency_closure"] =
        serde_json::json!(["e".repeat(64)]);
    let changed: OwnerPolicy = serde_json::from_value(value).unwrap();
    assert_ne!(
        original_digest,
        changed
            .issue_digest(
                &e,
                changed.select(&e, &profile, &native).unwrap(),
                "native-digest"
            )
            .unwrap()
    );
}
#[test]
fn source_map_rejects_duplicate_unknown_mixed_and_unbounded_shapes() {
    let (p, e, _, _) = fixture_policy();
    for fault in [
        "mixed",
        "null",
        "empty",
        "oversized",
        "wrong-version",
        "unknown",
    ] {
        let mut value = v2(&p, &e);
        match fault {
            "mixed" => value["source"] = serde_json::to_value(&p.source).unwrap(),
            "null" => value["source"] = serde_json::Value::Null,
            "empty" => value["sources_by_goal"] = serde_json::json!({}),
            "oversized" => {
                let entry = value["sources_by_goal"]["watchdog-child"].clone();
                for i in 0..256 {
                    value["sources_by_goal"][format!("extra-{i}")] = entry.clone();
                }
            }
            "wrong-version" => value["version"] = 1.into(),
            "unknown" => value["arbitrary_recipe"] = true.into(),
            _ => unreachable!(),
        }
        assert!(
            serde_json::from_value::<OwnerPolicy>(value).is_err(),
            "{fault}"
        );
    }
    let value = v2(&p, &e);
    let raw = serde_json::to_string(&value).unwrap();
    let entry = serde_json::to_string(&value["sources_by_goal"]["watchdog-child"]).unwrap();
    let duplicate = raw.replace(
        &format!("\"watchdog-child\":{entry}"),
        &format!("\"watchdog-child\":{entry},\"watchdog-child\":{entry}"),
    );
    assert_ne!(duplicate, raw);
    assert!(serde_json::from_str::<OwnerPolicy>(&duplicate).is_err());
}

#[test]
fn changed_review_custody_cannot_resume_v2_draft_binding() {
    let (p, e, profile, native) = fixture_policy();
    let mut value = v2(&p, &e);
    let original: OwnerPolicy = serde_json::from_value(value.clone()).unwrap();
    let first = original
        .issue_digest(
            &e,
            original.select(&e, &profile, &native).unwrap(),
            "native",
        )
        .unwrap();
    value["review_helper_sha256"] = "f".repeat(64).into();
    value["policy_epoch"] = 2.into();
    let changed: OwnerPolicy = serde_json::from_value(value).unwrap();
    assert_ne!(
        first,
        changed
            .issue_digest(&e, changed.select(&e, &profile, &native).unwrap(), "native")
            .unwrap()
    );
}
