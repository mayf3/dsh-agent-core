use super::*;
use crate::verification::watchdog::fixture;
use serde_json::json;
const NAMES: &[&str] = &[
    "phaseReceipt",
    "routingReceipt",
    "beforeHealth",
    "afterHealth",
    "beforeStore",
    "afterStore",
    "beforeIncidentState",
    "afterIncidentState",
    "routingManifest",
    "runReadback",
];
fn records() -> (BTreeMap<String, Vec<u8>>, Value) {
    let mut bundle = fixture::semantic_fixture();
    let documents: BTreeMap<_, _> = NAMES
        .iter()
        .map(|key| (key.to_string(), serde_json::to_vec(&bundle[*key]).unwrap()))
        .collect();
    bundle["documentSha256"] = json!(documents
        .iter()
        .map(|(key, raw)| (key, crate::fs::file::sha(raw)))
        .collect::<BTreeMap<_, _>>());
    for (field, name) in [
        ("beforeStoreSha256", "beforeStore"),
        ("afterStoreSha256", "afterStore"),
        ("beforeIncidentSha256", "beforeIncidentState"),
        ("afterIncidentSha256", "afterIncidentState"),
        ("routingManifestSha256", "routingManifest"),
    ] {
        bundle[field] = bundle["documentSha256"][name].clone();
    }
    (documents, bundle)
}
#[test]
fn duplicate_keys_are_rejected_recursively_and_after_unescaping() {
    for bytes in [
        br#"{"a":1,"a":2}"#.as_slice(),
        br#"{"a":{"b":1,"b":1}}"#,
        br#"[{"a":1,"\u0061":2}]"#,
    ] {
        assert!(strict_json(bytes).is_err());
    }
}
#[test]
fn raw_hash_mismatch_is_rejected() {
    let (mut docs, bundle) = records();
    docs.get_mut("beforeStore").unwrap().push(b' ');
    assert!(verified_semantic(&docs, &bundle).is_err());
}
#[test]
fn substituted_semantic_body_is_rejected_even_with_valid_raw_hash() {
    let (docs, mut bundle) = records();
    bundle["beforeStore"]["version"] = json!(99);
    assert!(verified_semantic(&docs, &bundle).is_err());
}
#[test]
fn frozen_postdeploy_document_fixture_round_trips_exactly() {
    let (docs, bundle) = records();
    assert_eq!(verified_semantic(&docs, &bundle).unwrap(), bundle);
}
#[test]
fn valid_json_and_repeated_names_in_distinct_objects_are_accepted() {
    assert_eq!(
        strict_json(br#"{"a":[{"x":1},{"x":2}],"b":true,"c":null,"d":-3.25}"#).unwrap(),
        json!({"a":[{"x":1},{"x":2}],"b":true,"c":null,"d":-3.25})
    );
}
#[test]
fn trailing_data_invalid_utf8_and_malformed_json_fail_closed() {
    for bytes in [b"{} {}".as_slice(), b"{", b"", b"\xff", b"{\"x\":NaN}"] {
        assert!(strict_json(bytes).is_err());
    }
}
#[test]
fn missing_extra_documents_and_claims_fail_closed() {
    let (docs, bundle) = records();
    let mut missing = docs.clone();
    missing.remove("phaseReceipt");
    assert!(verified_semantic(&missing, &bundle).is_err());
    let mut extra = docs.clone();
    extra.insert("arbitraryPath".into(), b"{}".to_vec());
    assert!(verified_semantic(&extra, &bundle).is_err());
    let mut claimed = bundle.clone();
    claimed["documentSha256"]["extra"] = json!("0".repeat(64));
    assert!(verified_semantic(&docs, &claimed).is_err());
}
#[test]
fn original_raw_hash_aliases_must_agree_with_the_exact_map() {
    let (docs, mut bundle) = records();
    bundle["beforeStoreSha256"] = json!("0".repeat(64));
    assert!(verified_semantic(&docs, &bundle).is_err());
}
#[test]
fn depth_and_document_size_are_bounded() {
    let deep = format!("{}0{}", "[".repeat(65), "]".repeat(65));
    assert!(strict_json(deep.as_bytes()).is_err());
    let huge = format!("\"{}\"", "a".repeat(4 * 1024 * 1024));
    assert!(strict_json(huge.as_bytes()).is_err());
}
#[test]
fn empty_containers_also_count_toward_depth_limit() {
    let deep = format!("{}{}", "[".repeat(65), "]".repeat(65));
    assert!(strict_json(deep.as_bytes()).is_err());
    let boundary = format!("{}{}", "[".repeat(64), "]".repeat(64));
    assert!(strict_json(boundary.as_bytes()).is_ok());
}
#[test]
fn duplicate_raw_body_is_rejected_even_when_claimed_hash_is_correct() {
    let (mut docs, mut bundle) = records();
    let body = String::from_utf8(docs["beforeStore"].clone())
        .unwrap()
        .replacen("\"version\":3", "\"version\":3,\"version\":3", 1);
    docs.insert("beforeStore".into(), body.into_bytes());
    bundle["documentSha256"]["beforeStore"] = json!(crate::fs::file::sha(&docs["beforeStore"]));
    bundle["beforeStoreSha256"] = bundle["documentSha256"]["beforeStore"].clone();
    assert!(verified_semantic(&docs, &bundle).is_err());
}
#[test]
fn optional_migration_document_has_exact_presence_body_and_hash_binding() {
    let (mut docs, mut bundle) = records();
    bundle["incidentMigrationAuthority"] = json!({"evidenceSha256":"a".repeat(64),"factsSha256":"b".repeat(64),"legacySha256":"c".repeat(64)});
    assert!(verified_semantic(&docs, &bundle).is_err());
    let bytes = serde_json::to_vec(&bundle["incidentMigrationAuthority"]).unwrap();
    bundle["documentSha256"]["incidentMigrationAuthority"] = json!(crate::fs::file::sha(&bytes));
    docs.insert("incidentMigrationAuthority".into(), bytes);
    assert_eq!(verified_semantic(&docs, &bundle).unwrap(), bundle);
}
#[test]
fn aggregate_capture_uses_its_own_closed_bound_without_widening_documents() {
    let bytes =
        serde_json::to_vec(&serde_json::json!({"raw_documents":"x".repeat(4*1024*1024)})).unwrap();
    assert!(strict_json(&bytes).is_err());
    assert!(strict_capture(&bytes).is_ok());
    assert!(strict_capture(br#"{"x":1,"x":2}"#).is_err());
}
