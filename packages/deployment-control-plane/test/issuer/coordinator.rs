use super::*;
#[test]
fn native_issuer_refuses_unprivileged_callers() {
    assert_eq!(
        prepare_native("broker-delivery", &"a".repeat(40))
            .err()
            .unwrap()
            .code(),
        "ISSUER_REQUIRES_ROOT"
    );
}
#[test]
fn no_caller_pass_or_signer_can_be_deserialized() {
    let raw = r#"{"goal_id":"broker-delivery","source_sha":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","pass":true,"issuer":"local-reviewer"}"#;
    assert!(serde_json::from_str::<FreezeRequest>(raw).is_err());
}
