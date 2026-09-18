use super::*;
#[test]
fn offline_previous_state_cannot_predeclare_successful_login() {
    let mut previous = serde_json::json!({"installation_receipt_sha256":"1".repeat(64),"service_sha256":"2".repeat(64),"issuer_policy_sha256":"3".repeat(64),"registry_sha256":"4".repeat(64),"trust_sha256":"5".repeat(64)});
    serde_json::from_value::<Previous>(previous.clone()).unwrap();
    previous["login_receipt_sha256"] = "6".repeat(64).into();
    assert!(serde_json::from_value::<Previous>(previous).is_err());
}
