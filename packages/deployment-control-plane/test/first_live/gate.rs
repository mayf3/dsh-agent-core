use super::gate::*;
fn grant() -> Grant {
    Grant {
        version: 1,
        owner: "mayf3".into(),
        scope: "EXACT_DSH_FIRST_LIVE_ONLY".into(),
        operation_id: "exact-test-operation".into(),
        host: "a".repeat(64),
        packet_sha256: "b".repeat(64),
        controller_sha256: "c".repeat(64),
        source_sha: "d".repeat(40),
        review_sha256: "e".repeat(64),
        issued_at: 100,
        expires_at: 200,
        temporary_supply_hold: true,
    }
}
#[test]
fn rejects_expired_future_and_overlong_external_permission() {
    let g = grant();
    assert!(validate(&g, &g, 200).is_err());
    assert!(validate(&g, &g, 99).is_err());
    let mut changed = g.clone();
    changed.expires_at = 100 + 86401;
    assert!(validate(&changed, &changed, 101).is_err());
}
#[test]
fn requires_exact_owner_operation_binary_packet_and_review() {
    let g = grant();
    for field in 0..9 {
        let mut bad = g.clone();
        match field {
            0 => bad.version = 2,
            1 => bad.owner = "other".into(),
            2 => bad.operation_id = "other".into(),
            3 => bad.host = "f".repeat(64),
            4 => bad.packet_sha256 = "f".repeat(64),
            5 => bad.controller_sha256 = "f".repeat(64),
            6 => bad.source_sha = "f".repeat(40),
            7 => bad.review_sha256 = "f".repeat(64),
            _ => bad.temporary_supply_hold = false,
        }
        assert!(validate(&bad, &g, 150).is_err(), "field {field}");
    }
}
#[test]
fn valid_exact_permission_is_accepted() {
    let g = grant();
    validate(&g, &g, 150).unwrap();
}

#[test]
fn another_owner_scope_is_not_first_live_permission() {
    let mut g = grant();
    g.scope = "LOGIN_ONLY".into();
    assert!(validate(&g, &g, 150).is_err());
}
#[test]
fn public_first_live_entry_refuses_nonroot_before_any_effect() {
    crate::common::private::nonroot();
    assert_eq!(
        super::run_first_live().unwrap_err().code(),
        "FIRST_LIVE_REQUIRES_ROOT"
    );
}
