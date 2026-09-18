use super::*;
use crate::{
    first_live::lifecycle::{self, Census, Effects},
    fs::FixtureRoots,
    transaction::NativeKind,
};
use serde_json::{json, Value};
const NODE: &str = "/usr/local/libexec/agent-core/node-runtime/bin/node";
fn native() -> Value {
    json!({"host":"a".repeat(64),"caller_uids":[502],"required_facets":["app-slots","node-closure","service-plists"],"profile_revision":"v1","profile_id":"dsh-app","profile_digest":"b".repeat(64),"initial_files":[{"path":"main.js","sha256":"d".repeat(64),"mutable":true,"mode":384,"gid":601}],"runtime_root":"/Users/fixture/runtime","runtime_startup":"catchup-zero","node_sha256":"e".repeat(64),"loader_files":[{"path":NODE,"sha256":"e".repeat(64)}],"launchctl_sha256":"f".repeat(64),"plutil_sha256":"f".repeat(64),"services":[{"kind":"Runtime","uid":505,"gid":601,"plist_sha256":"e".repeat(64)},{"kind":"WatchdogW1","uid":505,"gid":601,"plist_sha256":"e".repeat(64)},{"kind":"WatchdogW2","uid":0,"gid":0,"plist_sha256":"e".repeat(64)}]})
}
fn configuration() -> Value {
    json!({"catalog":crate::common::catalog(),"callers":[{"uid":502,"gid":20,"profiles":["dsh-app"],"producers":["fixture"]}],"producers":["fixture"],"verifiers":{"watchdog":{"kind":"external-observation","deadline_ms":1000}},"socket_gid":601,"first_target_adoption":"fixture-operation","socket_ancestor":{"host":"a".repeat(64),"device":1,"inode":2,"uid":0,"gid":1,"mode":509,"flags":0,"acl_none":true,"memberships":{"502":[20],"505":[601]}}})
}
struct FixtureEffects {
    fail: bool,
}
impl Effects for FixtureEffects {
    fn census(&mut self) -> Result<Census> {
        Ok(Census {
            host: "fixture-host".into(),
            public_digest: "fixture-public".into(),
            services_digest: "fixture-services".into(),
            inventory_digest: "fixture-inventory".into(),
            legacy_digest: "fixture-legacy".into(),
        })
    }
    fn retire(&mut self) -> Result<String> {
        Ok("fixture-retired".into())
    }
    fn quiesce(&mut self) -> Result<String> {
        Ok("fixture-stopped".into())
    }
    fn isolate(&mut self) -> Result<String> {
        Ok("fixture-isolated".into())
    }
    fn denial(&mut self) -> Result<String> {
        if self.fail {
            Err(crate::Error::new("FIXTURE_DENIAL_FAILED"))
        } else {
            Ok("fixture-denied".into())
        }
    }
    fn restore_availability(&mut self) -> Result<String> {
        Ok("fixture-restored".into())
    }
    fn loaded_denial(&mut self) -> Result<String> {
        Ok("fixture-loaded-denied".into())
    }
    fn verify(&mut self, _: &Census) -> Result<Census> {
        self.census()
    }
}
fn lifecycle() -> (tempfile::TempDir, FixtureRoots, VerifiedLifecycle) {
    let t = crate::common::private::temp();
    let roots = FixtureRoots::open(t.path()).unwrap();
    let life = lifecycle::run(
        &roots.root,
        "fixture-operation",
        &mut FixtureEffects { fail: false },
    )
    .unwrap();
    (t, roots, life)
}
#[test]
fn templates_reject_prefilled_derived_fields_even_valid_historical_digests() {
    for proof in [json!("a".repeat(64)), json!(""), Value::Null] {
        let mut n = native();
        n["lifecycle_denial_digest"] = proof.clone();
        assert!(serde_json::from_value::<NativeEnrollmentTemplate>(n).is_err());
        let mut c = configuration();
        c["socket_ancestor"]["denial_receipt"] = proof;
        assert!(serde_json::from_value::<ConfigurationTemplate>(c).is_err());
    }
}
#[test]
fn templates_reject_unknown_root_and_nested_fields() {
    let mut n = native();
    n["activation"] = json!(true);
    assert!(serde_json::from_value::<NativeEnrollmentTemplate>(n).is_err());
    let mut n = native();
    n["services"][0]["argv"] = json!(["/bin/sh"]);
    assert!(serde_json::from_value::<NativeEnrollmentTemplate>(n).is_err());
    let mut c = configuration();
    c["socket_ancestor"]["path"] = json!("/tmp");
    assert!(serde_json::from_value::<ConfigurationTemplate>(c).is_err());
}
#[test]
fn executed_lifecycle_binds_only_derived_fields_preserving_exact_inputs() {
    let (_t, _roots, life) = lifecycle();
    let n: NativeEnrollmentTemplate = serde_json::from_value(native()).unwrap();
    let bound = n.bind(&life).unwrap();
    bound.validate().unwrap();
    let mut expected = native();
    expected["lifecycle_denial_digest"] = json!(life.digest());
    assert_eq!(serde_json::to_value(bound).unwrap(), expected);
    let c: ConfigurationTemplate = serde_json::from_value(configuration()).unwrap();
    let bound = c.bind(&life).unwrap();
    bound
        .socket_ancestor
        .as_ref()
        .unwrap()
        .validate(&"a".repeat(64), &[502, 505].into())
        .unwrap();
    let mut expected = configuration();
    expected["socket_ancestor"]["denial_receipt"] = json!(life.digest());
    assert_eq!(serde_json::to_value(bound).unwrap(), expected);
}
#[test]
fn failed_lifecycle_cannot_publish_the_proof_needed_by_bind() {
    let t = crate::common::private::temp();
    let roots = FixtureRoots::open(t.path()).unwrap();
    assert!(lifecycle::run(
        &roots.root,
        "fixture-operation",
        &mut FixtureEffects { fail: true }
    )
    .is_err());
    assert!(!t.path().join("lifecycle-proof.json").exists());
}
#[test]
fn invalid_native_profile_still_fails_after_real_fixture_lifecycle() {
    let (_t, _roots, life) = lifecycle();
    let mut n = native();
    n["initial_files"][0]["path"] = json!("../escape");
    let n: NativeEnrollmentTemplate = serde_json::from_value(n).unwrap();
    assert!(n.bind(&life).is_err());
}
#[test]
fn maintenance_retains_exact_fixed_argv_and_all_dependency_bindings() {
    let n: NativeEnrollmentTemplate = serde_json::from_value(native()).unwrap();
    let m = n.maintenance().unwrap();
    m.validate().unwrap();
    assert_eq!(
        m.argv(NativeKind::Runtime),
        vec![
            NODE,
            "/usr/local/libexec/agent-core/app/scripts/production-runtime.mjs",
            "--root",
            "/Users/fixture/runtime",
            "--catchup",
            "0"
        ]
    );
    assert_eq!(
        m.argv(NativeKind::WatchdogW1),
        vec![
            NODE,
            "/usr/local/libexec/agent-core/app/scripts/scheduler-watchdog.mjs",
            "--role",
            "w1"
        ]
    );
    assert_eq!(m.node_sha256, n.node_sha256);
    assert_eq!(m.launchctl_sha256, n.launchctl_sha256);
    assert_eq!(m.plutil_sha256, n.plutil_sha256);
    assert_eq!(
        serde_json::to_value(m.services).unwrap(),
        native()["services"]
    );
    assert_eq!(
        serde_json::to_value(m.loader_files).unwrap(),
        native()["loader_files"]
    );
}
#[test]
fn omitted_legacy_startup_bytes_and_argv_stay_legacy() {
    let mut raw = native();
    raw.as_object_mut().unwrap().remove("runtime_startup");
    let n: NativeEnrollmentTemplate = serde_json::from_value(raw.clone()).unwrap();
    assert_eq!(serde_json::to_value(&n).unwrap(), raw);
    assert_eq!(n.maintenance().unwrap().argv(NativeKind::Runtime).len(), 4);
    let (_t, _roots, life) = lifecycle();
    let mut expected = raw;
    expected["lifecycle_denial_digest"] = json!(life.digest());
    assert_eq!(
        serde_json::to_value(n.bind(&life).unwrap()).unwrap(),
        expected
    );
}
#[test]
fn maintenance_rejects_unbound_platform_closure_service_or_runtime_inputs() {
    let mut cases = Vec::new();
    let mut n = native();
    n["loader_files"] = json!([]);
    cases.push(n);
    let mut n = native();
    n["launchctl_sha256"] = json!("bad");
    cases.push(n);
    let mut n = native();
    n["plutil_sha256"] = json!("bad");
    cases.push(n);
    let mut n = native();
    n["services"][0]["uid"] = json!(0);
    cases.push(n);
    let mut n = native();
    n["services"][2]["uid"] = json!(505);
    cases.push(n);
    let mut n = native();
    n["services"][1]["kind"] = json!("Runtime");
    cases.push(n);
    let mut n = native();
    n["runtime_root"] = json!("/Users/../tmp");
    cases.push(n);
    for n in cases {
        assert!(serde_json::from_value::<NativeEnrollmentTemplate>(n)
            .unwrap()
            .maintenance()
            .is_err());
    }
}

#[test]
fn maintenance_rejects_invalid_native_shape_before_lifecycle_effects() {
    for (field, value) in [
        ("profile_id", json!("bad/path")),
        ("profile_revision", json!("")),
        ("profile_digest", json!("bad")),
        ("initial_files", json!([])),
    ] {
        let mut raw = native();
        raw[field] = value;
        let input: NativeEnrollmentTemplate = serde_json::from_value(raw).unwrap();
        assert!(
            input.maintenance().is_err(),
            "pre-effect shape accepted {field}"
        );
    }
    let mut raw = native();
    raw["initial_files"][0]["path"] = json!("../escape");
    assert!(serde_json::from_value::<NativeEnrollmentTemplate>(raw)
        .unwrap()
        .maintenance()
        .is_err());
}
#[test]
fn active_native_image_keeps_full_shape_gate_before_any_native_io() {
    let (_t, roots, life) = lifecycle();
    let input: NativeEnrollmentTemplate = serde_json::from_value(native()).unwrap();
    let mut enrollment = input.bind(&life).unwrap();
    enrollment.profile_id = "bad/path".into();
    let service = crate::transaction::NativeService {
        root: roots.root,
        enrollment,
    };
    assert_eq!(service.image().unwrap_err().code(), "INVALID_ID");
}
