use super::*;
fn enrollment() -> NativeEnrollment {
    serde_json::from_value(serde_json::json!({"host":"host","caller_uids":[502],"lifecycle_denial_digest":"a".repeat(64),"required_facets":[],"profile_revision":"rev","profile_id":"dsh-app","profile_digest":"b".repeat(64),"initial_files":[],"runtime_root":"/Users/authsvc/.agent-core","node_sha256":"c".repeat(64),"loader_files":[],"launchctl_sha256":"d".repeat(64),"plutil_sha256":"e".repeat(64),"services":[]})).unwrap()
}
#[test]
fn observed_catchup_zero_is_bound_exactly_without_arbitrary_arguments() {
    let mut e = enrollment();
    e.runtime_startup = RuntimeStartup::CatchupZero;
    let exact = vec![
        NODE,
        "/usr/local/libexec/agent-core/app/scripts/production-runtime.mjs",
        "--root",
        "/Users/authsvc/.agent-core",
        "--catchup",
        "0",
    ];
    assert_eq!(e.argv(NativeKind::Runtime), exact);
    assert_eq!(
        e.argv(NativeKind::WatchdogW1),
        NativeKind::WatchdogW1.argv(&e.runtime_root)
    );
    let mut wrong = exact.clone();
    wrong[5] = "1";
    assert_ne!(e.argv(NativeKind::Runtime), wrong);
    assert_ne!(
        e.argv(NativeKind::Runtime),
        NativeKind::Runtime.argv(&e.runtime_root)
    );
    let mut value = serde_json::to_value(&e).unwrap();
    value["runtime_startup"] = serde_json::json!(["--catchup", "1"]);
    assert!(serde_json::from_value::<NativeEnrollment>(value.clone()).is_err());
    value["runtime_startup"] = serde_json::json!("arbitrary-command");
    assert!(serde_json::from_value::<NativeEnrollment>(value).is_err());
}
#[test]
fn legacy_enrollment_keeps_exact_canonical_bytes_and_argv() {
    let e = enrollment();
    let raw = serde_json::to_value(&e).unwrap();
    assert!(raw.get("runtime_startup").is_none());
    assert_eq!(
        e.argv(NativeKind::Runtime),
        NativeKind::Runtime.argv(&e.runtime_root)
    );
    let decoded: NativeEnrollment = serde_json::from_value(raw.clone()).unwrap();
    assert_eq!(
        crate::trust::canonical_bytes(&decoded).unwrap(),
        crate::trust::canonical_bytes(&raw).unwrap()
    );
}
