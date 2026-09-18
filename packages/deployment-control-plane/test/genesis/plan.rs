mod support;
use deployment_control_plane::{bootstrap::*, trust::digest};
use serde_json::{json, Value};
use support::*;

#[test]
fn freezes_disabled_future_operations_without_claiming_protected_state() {
    let (plan, pins, artifacts) = fixture();
    let result = verify_genesis_artifacts(&plan, &pins, &artifacts).unwrap();
    assert!(result.plan_ready);
    assert!(result.artifact_integrity_verified);
    assert!(!result.bootstrap_allowed);
    assert!(!result.activation_allowed);
    assert!(!result.protected_poststate_verified);
    assert!(!result.independent_review_result_verified);
    assert_eq!(result.plan_digest, pins.plan_digest);
}

#[test]
fn rejects_unpinned_review_schema_bytes() {
    let (plan, pins, mut artifacts) = fixture();
    artifacts
        .support_files
        .values_mut()
        .next()
        .unwrap()
        .push(b'!');
    assert!(verify_genesis_artifacts(&plan, &pins, &artifacts).is_err());
}

fn reject_change(edit: impl FnOnce(&mut Value)) {
    let (plan, mut pins, artifacts) = fixture();
    let mut value = serde_json::to_value(plan).unwrap();
    edit(&mut value);
    let parsed = serde_json::from_value::<GenesisPlan>(value);
    if let Ok(plan) = parsed {
        // Even a new independent content pin cannot override the fixed contract.
        pins.plan_digest = digest(&plan).unwrap();
        assert!(verify_genesis_artifacts(&plan, &pins, &artifacts).is_err());
    }
}

#[test]
fn rejects_path_substitution_and_parent_components() {
    for path in ["/tmp/keys", "/private/var/db/agent-deployd/../keys"] {
        reject_change(|p| p["paths"]["keys"] = json!(path));
    }
    reject_change(|p| p["roles"][0]["private_key_path"] = json!("/tmp/key"));
}

#[test]
fn rejects_incomplete_reordered_and_unknown_steps() {
    reject_change(|p| {
        p["operations"].as_array_mut().unwrap().remove(2);
    });
    reject_change(|p| p["operations"].as_array_mut().unwrap().swap(0, 10));
    reject_change(|p| p["operations"][2] = json!("ExecuteCallerShell"));
    reject_change(|p| p["operations"][2] = json!("RestartExistingTasks"));
    reject_change(|p| {
        p["abort_conditions"].as_array_mut().unwrap().pop();
    });
    reject_change(|p| {
        p["rollback"].as_array_mut().unwrap().pop();
    });
}

#[test]
fn rejects_shared_privileged_review_or_caller_identities() {
    for uid in [0, 502, 505, 616] {
        reject_change(|p| p["identities"]["reviewer"]["uid"] = json!(uid));
    }
    reject_change(|p| p["identities"]["reviewer"]["gid"] = json!(616));
    reject_change(|p| p["identities"]["reviewer"]["login_shell"] = json!("/bin/zsh"));
}

#[test]
fn rejects_activation_self_signed_owner_and_fixture_keys() {
    reject_change(|p| p["profile_enabled"] = json!(true));
    reject_change(|p| p["activation_requested"] = json!(true));
    reject_change(|p| p["owner_authorization"]["owner"] = json!("agent"));
    reject_change(|p| p["owner_authorization"]["method"] = json!("NewGenesisKeySignature"));
    reject_change(|p| p["roles"][0]["public_key"] = json!("11".repeat(32)));
    reject_change(|p| p["roles"][0]["seed"] = json!("11".repeat(32)));
    reject_change(|p| p["roles"][0]["generation"] = json!("DeterministicSeed"));
    reject_change(|p| p["roles"][1]["key_id"] = json!("local-authority"));
}

#[test]
fn rejects_malformed_refs_and_self_reported_readiness() {
    for reference in ["main", "A".repeat(40).as_str(), "abcd"] {
        reject_change(|p| p["source_revision"] = json!(reference));
    }
    reject_change(|p| p["source_tree"] = json!("latest"));
    reject_change(|p| p["review_pass"] = json!(true));
    reject_change(|p| p["protected_poststate_verified"] = json!(true));
}

#[test]
fn rejects_independent_pin_drift() {
    let (plan, pins, artifacts) = fixture();
    for field in [
        "plan_digest",
        "package_digest",
        "source_digest",
        "review_record_digest",
        "initial_registry_digest",
        "supervisor_policy_digest",
    ] {
        let mut value = serde_json::to_value(&pins).unwrap();
        value[field] = json!("ab".repeat(32));
        let changed = serde_json::from_value(value).unwrap();
        assert!(
            verify_genesis_artifacts(&plan, &changed, &artifacts).is_err(),
            "{field}"
        );
    }
}

#[test]
fn rejects_tampered_missing_and_extra_artifacts() {
    let (plan, pins, original) = fixture();
    for n in 0..8 {
        let mut artifacts = original.clone();
        match n {
            0 => artifacts.package_manifest.push(b'!'),
            1 => artifacts.sources.values_mut().next().unwrap().push(b'!'),
            2 => artifacts
                .executables
                .values_mut()
                .next()
                .unwrap()
                .push(b'!'),
            3 => artifacts.review_record.push(b'!'),
            4 => artifacts.initial_registry.push(b'!'),
            5 => artifacts.supervisor_policy.push(b'!'),
            6 => {
                artifacts.executables.pop_first();
            }
            _ => {
                artifacts
                    .sources
                    .insert("undeclared.rs".into(), b"extra".to_vec());
            }
        }
        assert!(
            verify_genesis_artifacts(&plan, &pins, &artifacts).is_err(),
            "{n}"
        );
    }
}

#[test]
fn review_contents_are_pinned_without_becoming_an_execution_grant() {
    let (mut plan, mut pins, mut artifacts) = fixture();
    artifacts.review_record = br#"{"review":"PASS"}"#.to_vec();
    plan.review_record_digest = hash(&artifacts.review_record);
    // Replacing a report in the candidate must not change the independent review anchor.
    pins.plan_digest = digest(&plan).unwrap();
    assert!(verify_genesis_artifacts(&plan, &pins, &artifacts).is_err());
}
