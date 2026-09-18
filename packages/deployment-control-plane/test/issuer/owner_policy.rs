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
        profile_digest: crate::bootstrap::profile_digest(&profile).unwrap(),
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

fn active_native_selection(version: u32) {
    use crate::{
        bootstrap::{profile_digest, validate_native_binding, LoaderFile, SocketAncestor},
        service::{Caller, Configuration, VerifierBinding},
        transaction::{NativeKind, ServiceEnrollment},
    };
    let (owner, mut e, mut profile, mut native) = fixture_policy();
    profile.host = "a".repeat(64);
    profile.target_runtime = "dsh-system-runtime".into();
    profile.install_root_id = "agent-core-app".into();
    profile.launchd_label = "ai.agent-core.runtime".into();
    profile.standing_authority_revision = "PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1".into();
    profile.build_recipe = "immutable-regular-app-slots-v1".into();
    profile.privileged_apply_profile = "fixed-regular-app-slots-v1".into();
    profile.restart_profile = "runtime-w1-w2-system-v1".into();
    profile.rollback_profile = "journal-exact-preimage-v1".into();
    profile.preflight_policy = "signed-lease-300s-v1".into();
    profile.architecture = "x86_64".into();
    profile.required_review_scopes.push("root-code".into());
    assert!(profile.enabled);
    native.host = profile.host.clone();
    native.profile_digest = profile_digest(&profile).unwrap();
    native.runtime_root = "/Users/fixture/runtime".into();
    native.required_facets = vec![
        "app-slots".into(),
        "node-closure".into(),
        "service-plists".into(),
    ];
    native.loader_files = vec![LoaderFile {
        path: "/usr/local/libexec/agent-core/node-runtime/bin/node".into(),
        sha256: native.node_sha256.clone(),
    }];
    native.services = [
        NativeKind::Runtime,
        NativeKind::WatchdogW1,
        NativeKind::WatchdogW2,
    ]
    .into_iter()
    .map(|kind| ServiceEnrollment {
        kind,
        uid: if kind == NativeKind::WatchdogW2 {
            0
        } else {
            505
        },
        gid: if kind == NativeKind::WatchdogW2 {
            0
        } else {
            601
        },
        plist_sha256: "e".repeat(64),
    })
    .collect();
    let mut catalog = fixture_catalog();
    catalog.profiles.insert("fixture".into(), profile.clone());
    let config = Configuration {
        catalog,
        callers: vec![Caller {
            uid: 502,
            gid: 20,
            profiles: vec!["fixture".into()],
            producers: vec!["producer".into()],
        }],
        producers: vec!["producer".into()],
        verifiers: BTreeMap::from([(
            "verify-1".into(),
            VerifierBinding::ExternalObservation { deadline_ms: 500 },
        )]),
        socket_gid: 602,
        socket_ancestor: Some(SocketAncestor {
            host: profile.host.clone(),
            device: 1,
            inode: 2,
            uid: 0,
            gid: 1,
            mode: 0o775,
            flags: 0,
            acl_none: true,
            memberships: BTreeMap::from([(502, vec![20]), (505, vec![601])]),
            denial_receipt: "b".repeat(64),
        }),
    };
    validate_native_binding(&config, &native, &profile.host, true).unwrap();
    e.payload.target_runtime = profile.target_runtime.clone();
    e.payload.standing_authority_revision = profile.standing_authority_revision.clone();
    e = signed("authority", e.payload);
    let policy = if version == 1 {
        OwnerPolicy::V1(owner.clone())
    } else {
        serde_json::from_value(v2(&owner, &e)).unwrap()
    };
    let selected = policy
        .select(&e, &profile, &native)
        .expect("valid active native binding must select its enrolled source");
    assert_eq!(selected.slots[0].target, "watchdog.js");
    let mut tampered = native.clone();
    tampered.profile_digest = "f".repeat(64);
    assert!(policy.select(&e, &profile, &tampered).is_err());
    assert!(validate_native_binding(&config, &tampered, &profile.host, true).is_err());
    let mut drifted = profile.clone();
    drifted.rollback_profile = "another-rollback".into();
    assert!(policy.select(&e, &drifted, &native).is_err());
    let mut drifted_config = config;
    drifted_config
        .catalog
        .profiles
        .insert("fixture".into(), drifted);
    assert!(validate_native_binding(&drifted_config, &native, &profile.host, true).is_err());
}
#[test]
fn active_native_binding_selects_v1_source_without_profile_hash_drift() {
    active_native_selection(1);
}
#[test]
fn active_native_binding_selects_v2_source_without_profile_hash_drift() {
    active_native_selection(2);
}
