use super::*;
use crate::{
    fs::{file::write_new, FixtureRoots},
    trust::canonical_bytes,
};
use serde_json::json;
fn put(root: &Dir, name: &str, v: &serde_json::Value) {
    write_new(
        root,
        name,
        &canonical_bytes(v).unwrap(),
        root.uid,
        unsafe { libc::getgid() },
        0o400,
    )
    .unwrap();
}
fn fixture() -> (tempfile::TempDir, FixtureRoots) {
    let t = crate::common::private::temp();
    let r = FixtureRoots::open(t.path()).unwrap();
    put(&r.root, "service.json", &json!({"fixture":"configuration"}));
    put(
        &r.root,
        "daemon-activation.json",
        &json!({"fixture":"existing-activation"}),
    );
    (t, r)
}
#[test]
fn no_pending_preserves_the_existing_activation_contract() {
    let (_t, r) = fixture();
    assert!(matches!(
        startup(&r.root, None, 10).unwrap(),
        Phase::Ordinary
    ));
}
#[test]
fn existing_activation_cannot_bypass_missing_final_core_result() {
    let (_t, r) = fixture();
    put(
        &r.root,
        "first-live-pending.json",
        &json!({"operation_id":"first-live", "package_digest":"a".repeat(64)}),
    );
    r.root.mkdir("first-live-operation").unwrap();
    assert!(startup(&r.root, Some("first-live"), 10).is_err());
}
#[test]
fn failed_or_mismatched_final_core_cannot_authorize_startup() {
    for (op, state) in [
        ("first-live", "FAILED_OR_UNKNOWN_RETAINED"),
        ("another", "STANDING_ADOPTION_COMPLETE_CONTROLLER_DISABLED"),
    ] {
        let (_t, r) = fixture();
        put(
            &r.root,
            "first-live-pending.json",
            &json!({"operation_id":"first-live", "package_digest":"a".repeat(64)}),
        );
        let area = r.root.mkdir("first-live-operation").unwrap();
        put(
            &area,
            "result.json",
            &json!({"operation_id":op,"state":state}),
        );
        assert!(startup(&r.root, Some("first-live"), 10).is_err());
    }
}
fn armed(r: &FixtureRoots) -> (Dir, Binding, Readback) {
    let h = "a".repeat(64);
    let op = "first-live";
    put(
        &r.root,
        "first-live-pending.json",
        &json!({"operation_id":op,"package_digest":h}),
    );
    let area = r.root.mkdir("first-live-operation").unwrap();
    put(
        &area,
        "first-live-intent.json",
        &json!({"version":1,"operation_id":op,"packet_sha256":h,"grant_sha256":h,"controller_sha256":h}),
    );
    put(
        &area,
        "result.json",
        &json!({"version":1,"operation_id":op,"packet_sha256":h,"grant_sha256":h,"lifecycle_digest":h,"host_safety_receipt_digest":h,"custody_completion_digest":h,"reviewer_login_receipt_digest":h,"standing_receipt_digest":h,"state":"STANDING_ADOPTION_COMPLETE_CONTROLLER_DISABLED"}),
    );
    let b = core(&r.root, Some(op), 100).unwrap();
    publish(&area, "enable-intent.json", &b).unwrap();
    let mut rb = Readback {
        startup_intent_digest: String::new(),
        binding: b.clone(),
        process: crate::transaction::ProcessIdentity {
            pid: 10,
            started_seconds: 1,
            started_micros: 2,
            uid: 0,
            gid: 0,
            executable: "/usr/local/libexec/agent-deployd/agent-deployd".into(),
        },
        socket_device: 1,
        socket_inode: 2,
    };
    // armed() itself models pre-start, so publication occurs only for tests using the readback.
    rb.startup_intent_digest = crate::trust::digest(&GenerationIntent {
        binding: b.clone(),
        process: rb.process.clone(),
    })
    .unwrap();
    (area, b, rb)
}
#[test]
fn valid_core_is_only_readback_until_actual_completion_and_initial_lease_applies() {
    let (_t, r) = fixture();
    let (_a, _b, _rb) = armed(&r);
    assert!(matches!(
        startup(&r.root, Some("first-live"), 10).unwrap(),
        Phase::Readback(_)
    ));
    assert!(ordinary(&r.root, Some("first-live"), 10).is_err());
    assert!(startup(&r.root, Some("first-live"), 100).is_err());
}
#[test]
fn completed_restart_does_not_inherit_old_lease_or_pid() {
    let (_t, r) = fixture();
    let (a, b, rb) = armed(&r);
    claim_generation(&a, &rb.binding, &rb.process).unwrap();
    publish(&a, "daemon-readback.json", &rb).unwrap();
    let admission = Admission {
        binding: b.clone(),
        readback_digest: crate::trust::digest(&rb).unwrap(),
    };
    publish(&a, "enable-admission.json", &admission).unwrap();
    let ready = Ready {
        admission_digest: crate::trust::digest(&admission).unwrap(),
        readback: rb.clone(),
    };
    publish(&a, "daemon-ready.json", &ready).unwrap();
    publish(
        &a,
        "enable-result.json",
        &Complete {
            binding: b,
            readback_digest: crate::trust::digest(&rb).unwrap(),
            ready_digest: crate::trust::digest(&ready).unwrap(),
        },
    )
    .unwrap();
    assert!(matches!(
        startup(&r.root, Some("first-live"), 1000).unwrap(),
        Phase::Complete
    ));
}
#[test]
fn admission_is_generation_specific_and_never_normal_dispatch_permission() {
    let (_t, r) = fixture();
    let (a, b, mut rb) = armed(&r);
    claim_generation(&a, &rb.binding, &rb.process).unwrap();
    publish(&a, "daemon-readback.json", &rb).unwrap();
    publish(
        &a,
        "enable-admission.json",
        &Admission {
            binding: b,
            readback_digest: crate::trust::digest(&rb).unwrap(),
        },
    )
    .unwrap();
    initialization(&a, &rb).unwrap();
    rb.process.started_micros += 1;
    assert!(initialization(&a, &rb).is_err());
    assert!(ordinary(&r.root, Some("first-live"), 10).is_err());
}
#[test]
fn durable_failure_or_configuration_drift_never_reopens_admission() {
    let (_t, r) = fixture();
    let (a, _, _) = armed(&r);
    put(&a, "enable-failure.json", &json!({"state":"UNKNOWN"}));
    assert!(startup(&r.root, Some("first-live"), 10).is_err());
    let (_t, r) = fixture();
    let (_, _, _) = armed(&r);
    assert!(startup(&r.root, Some("different"), 10).is_err());
}

#[test]
fn empty_queue_is_not_a_completed_first_adoption() {
    let (t, _r) = fixture();
    let q = crate::queue::Queue::open(t.path().join("queue.db")).unwrap();
    assert!(q
        .verify_first_live_startup("first-live", &"a".repeat(64))
        .is_err());
}

#[test]
fn well_formed_failed_or_cross_operation_core_cannot_use_existing_enable_intent() {
    for failed in [false, true] {
        let (t, r) = fixture();
        let (_a, _b, _rb) = armed(&r);
        let path = t.path().join("first-live-operation/result.json");
        let mut v: serde_json::Value =
            serde_json::from_slice(&std::fs::read(&path).unwrap()).unwrap();
        if failed {
            v["state"] = json!("FAILED_OR_UNKNOWN_RETAINED")
        } else {
            v["operation_id"] = json!("other-operation")
        }
        std::fs::set_permissions(&path, std::os::unix::fs::PermissionsExt::from_mode(0o600))
            .unwrap();
        std::fs::write(&path, serde_json::to_vec(&v).unwrap()).unwrap();
        std::fs::set_permissions(&path, std::os::unix::fs::PermissionsExt::from_mode(0o400))
            .unwrap();
        assert!(startup(&r.root, Some("first-live"), 10).is_err());
    }
}

#[test]
fn startup_crash_prefix_child() {
    let Some(path) = std::env::var_os("DCP_ENABLE_STARTUP_FIXTURE") else {
        return;
    };
    let roots = FixtureRoots::open(std::path::Path::new(&path)).unwrap();
    let area = roots.root.child("first-live-operation").unwrap();
    let b: Binding = read(&area, "enable-intent.json").unwrap();
    let process = crate::transaction::first_live_process_identity(std::process::id()).unwrap();
    claim_generation(&area, &b, &process).unwrap();
    // Actual private listener side effect, then no readback/Drop cleanup.
    let _listener =
        std::os::unix::net::UnixListener::bind(std::path::Path::new(&path).join("c.sock")).unwrap();
    std::process::exit(73);
}
#[test]
fn death_after_private_listener_bind_cannot_authorize_replacement_generation() {
    use std::os::unix::fs::MetadataExt;
    let (t, r) = fixture();
    let (a, b, _) = armed(&r);
    let status = std::process::Command::new(std::env::current_exe().unwrap())
        .args([
            "--exact",
            "service::first_live::gate::tests::startup_crash_prefix_child",
            "--nocapture",
        ])
        .env("DCP_ENABLE_STARTUP_FIXTURE", t.path())
        .status()
        .unwrap();
    assert_eq!(status.code(), Some(73));
    let before = std::fs::symlink_metadata(t.path().join("c.sock"))
        .unwrap()
        .ino();
    assert!(optional::<Readback>(&a, "daemon-readback.json")
        .unwrap()
        .is_none());
    let replacement = crate::transaction::first_live_process_identity(std::process::id()).unwrap();
    assert!(
        claim_generation(&a, &b, &replacement).is_err(),
        "crash prefix did not consume generation before real socket effect"
    );
    assert_eq!(
        std::fs::symlink_metadata(t.path().join("c.sock"))
            .unwrap()
            .ino(),
        before
    );
}
