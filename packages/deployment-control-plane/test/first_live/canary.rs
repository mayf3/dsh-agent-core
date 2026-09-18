use super::canary::succeeded;
use serde_json::json;
#[test]
fn cleanup_requires_mechanical_success_not_unknown_or_text_pass() {
    for outcome in ["outcome_unknown", "failed", "succeeded"] {
        assert!(succeeded(
            &json!({"runs":[{"outcome":outcome,"result":{"final_status":"PASS"}}],"events":[]}),
            "source"
        )
        .is_err());
    }
}
