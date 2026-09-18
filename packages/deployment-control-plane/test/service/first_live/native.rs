use super::*;
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
