use super::*;
#[test]
fn login_file_presence_or_failed_state_never_authorizes_first_live() {
    for bytes in [
        b"{}".as_slice(),
        br#"{"state":"OUTCOME_UNKNOWN_RECONCILIATION_CONSUMED"}"#.as_slice(),
    ] {
        assert!(login(bytes, &crate::fs::file::sha(bytes)).is_err());
    }
}
#[test]
fn login_requires_actual_exact_successful_public_receipt() {
    let receipt = serde_json::json!({"version":1,"manifest_digest":"a".repeat(64),"grant_digest":"b".repeat(64),"original_intent_digest":"3ca4b44d4d3e418ea78df8ad6c0a04b7a650e0006c807ffd9f96441b0d10abc6","state":"SEPARATE_LOGIN_COMMAND_COMPLETED_SAFE_LOCAL_AUTH_METADATA","original_provider_outcome":"UNKNOWN_RETAINED","independent_review_pass":false,"activation_allowed":false});
    let bytes = serde_json::to_vec(&receipt).unwrap();
    login(&bytes, &crate::fs::file::sha(&bytes)).unwrap();
    assert!(login(&bytes, &"0".repeat(64)).is_err());
}
#[test]
fn original_registry_rejects_extra_history_or_unmatched_bytes() {
    use crate::fs::{file::write_new, FixtureRoots};
    use std::os::unix::fs::MetadataExt;
    let t = crate::common::private::temp();
    let r = FixtureRoots::open(t.path()).unwrap();
    let d = r.root.mkdir("registry").unwrap();
    let gid = d.file.metadata().unwrap().gid();
    for name in ["registry.lock", "state-00000000000000000001.json"] {
        write_new(&d, name, b"original", d.uid, gid, 0o600).unwrap();
    }
    original_registry(&r.root, &crate::fs::file::sha(b"original")).unwrap();
    assert!(original_registry(&r.root, &"0".repeat(64)).is_err());
    write_new(&d, "pending.tmp", b"unknown", d.uid, gid, 0o600).unwrap();
    assert!(original_registry(&r.root, &crate::fs::file::sha(b"original")).is_err());
}

#[test]
fn installation_receipt_comes_from_original_steps_and_bindings_must_be_absent() {
    use crate::fs::{file::write_new, FixtureRoots};
    use std::os::unix::fs::MetadataExt;
    let t = crate::common::private::temp();
    let r = FixtureRoots::open(t.path()).unwrap();
    let gid = r.root.file.metadata().unwrap().gid();
    let steps = r.root.mkdir("steps").unwrap();
    write_new(
        &steps,
        "installation.json",
        b"actual",
        steps.uid,
        gid,
        0o400,
    )
    .unwrap();
    installation(&r.root, &sha(b"actual")).unwrap();
    assert!(installation(&r.root, &sha(b"wrong")).is_err());
    absent_issuer_bindings(&r.root).unwrap();
    write_new(
        &r.root,
        "issuer-bindings.json",
        b"{}",
        r.root.uid,
        gid,
        0o400,
    )
    .unwrap();
    assert!(absent_issuer_bindings(&r.root).is_err());
}

#[test]
fn genesis_intake_subdirectories_are_exact_empty_containers_not_prior_work() {
    let t = crate::common::private::temp();
    let r = crate::fs::FixtureRoots::open(t.path()).unwrap();
    for name in [
        "issuer-jobs",
        "intake",
        "staging",
        "sealed",
        "transactions",
        "recovery-requests",
        "admitted",
        "requests",
        "closure",
    ] {
        r.root.mkdir(name).unwrap();
    }
    let intake = r.root.child("intake").unwrap();
    for name in [
        "proposals",
        "snapshots",
        "policies",
        "results",
        "acks",
        "recovery",
    ] {
        intake.mkdir(name).unwrap();
    }
    empty_state(&r.root).unwrap();
    intake.mkdir("unexpected").unwrap();
    assert!(empty_state(&r.root).is_err());
}
