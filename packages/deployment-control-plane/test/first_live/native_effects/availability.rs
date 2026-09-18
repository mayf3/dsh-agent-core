use super::*;
#[test]
fn known_stop_and_complete_closure_never_allow_a_second_start() {
    assert!(eligible(true, true, false));
    for args in [
        (false, true, false),
        (true, false, false),
        (true, true, true),
    ] {
        assert!(!eligible(args.0, args.1, args.2));
    }
}
#[test]
fn missing_result_and_missing_created_probe_cleanup_remain_unknown() {
    let t = crate::common::private::temp();
    let r = crate::fs::FixtureRoots::open(t.path()).unwrap();
    files::publish(
        &r.root,
        "native-denial-create-intent.json",
        &serde_json::json!({"actual_intent":true}),
    )
    .unwrap();
    assert!(!probes_known(&r.root).unwrap());
    files::publish(&r.root,"native-denial-create-result.json",&serde_json::json!({"total":1,"denied":0,"eacces":0,"eperm":0,"inconclusive":false,"unexpected":true,"errno":0,"failed_index":0,"created":[1,2],"cleaned":false})).unwrap();
    assert!(!probes_known(&r.root).unwrap());
    files::publish(&r.root,"native-denial-create-cleanup.json",&serde_json::json!({"total":1,"denied":0,"eacces":0,"eperm":0,"inconclusive":false,"unexpected":true,"errno":0,"failed_index":0,"created":[1,2],"cleaned":true})).unwrap();
    assert!(probes_known(&r.root).unwrap());
    files::publish(
        &r.root,
        "retired-0-intent.json",
        &serde_json::json!({"actual_intent":true}),
    )
    .unwrap();
    assert!(!probes_known(&r.root).unwrap());
}
#[test]
fn malformed_observation_is_not_a_known_effect_result() {
    let t = crate::common::private::temp();
    let r = crate::fs::FixtureRoots::open(t.path()).unwrap();
    files::publish(
        &r.root,
        "native-denial-write-intent.json",
        &serde_json::json!({"actual_intent":true}),
    )
    .unwrap();
    files::publish(
        &r.root,
        "native-denial-write-result.json",
        &serde_json::json!({"inconclusive":false}),
    )
    .unwrap();
    assert!(!probes_known(&r.root).unwrap());
}
