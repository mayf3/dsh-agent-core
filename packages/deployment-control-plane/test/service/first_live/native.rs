use super::*;
#[test]
fn enable_gate_accepts_both_canonical_disabled_tokens_and_rejects_ambiguity() {
    for value in ["true", "disabled"] {
        assert!(disabled_override(&crate::first_live::process::Output {
            code: Some(0),
            stdout: format!("disabled services = {{\n\"ai.agent-deployd\" => {value}\n}}"),
            stderr: String::new(),
        }));
    }
    for value in ["false", "enabled", "unknown"] {
        assert!(!disabled_override(&crate::first_live::process::Output {
            code: Some(0),
            stdout: format!("disabled services = {{\n\"ai.agent-deployd\" => {value}\n}}"),
            stderr: String::new(),
        }));
    }
    assert!(!disabled_override(&crate::first_live::process::Output {
        code: Some(0),
        stdout: "disabled services = {\n\"ai.agent-deployd\" => disabled\n\"ai.agent-deployd\" => true\n}".into(),
        stderr: String::new(),
    }));
}
#[test]
fn standing_plist_changes_only_three_fixed_boolean_values() {
    let old = crate::bootstrap::DISABLED_CONTROLLER_PLIST.as_bytes();
    let new = enabled_plist(old).unwrap();
    let restored = String::from_utf8(new).unwrap().replace(
        "<key>Disabled</key><false/><key>RunAtLoad</key><true/><key>KeepAlive</key><true/>",
        "<key>Disabled</key><true/><key>RunAtLoad</key><false/><key>KeepAlive</key><false/>",
    );
    assert_eq!(restored.as_bytes(), old);
    let mut altered = old.to_vec();
    altered.push(b' ');
    assert!(enabled_plist(&altered).is_err());
}
