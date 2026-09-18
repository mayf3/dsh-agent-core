use super::*;
#[test]
fn exact_roles_are_not_historical_pid_or_apple_prefix_allowlists() {
    assert!(roles("/usr/libexec/logd")
        .unwrap()
        .iter()
        .any(|r| r.authorities.iter().any(|a| a.label == "com.apple.logd")));
    for p in [
        "/usr/libexec/unknown",
        "/bin/ps",
        "/usr/local/bin/tailscaled",
        "/tmp/logd",
    ] {
        assert!(roles(p).is_err());
    }
}
#[test]
fn developer_role_binds_resolved_program_and_exact_submitted_job() {
    let r=roles("/Library/Developer/PrivateFrameworks/CoreDevice.framework/Versions/A/Resources/bin/CoreDeviceDDIUpdaterService").unwrap();
    assert_eq!(
        r[0].fixed_launch_target.as_deref(),
        Some("system/com.apple.CoreDevice.CoreDeviceDDIUpdaterService.job")
    );
    assert_eq!(
        r[0].identifier.as_deref(),
        Some("com.apple.CoreDevice.CoreDeviceDDIUpdaterService")
    );
}
#[test]
fn root_login_has_only_two_reviewed_tty_roles() {
    let r = roles("/usr/bin/login").unwrap();
    assert_eq!(r.len(), 2);
    assert_eq!(
        r.iter()
            .map(|r| r.tty.as_deref().unwrap())
            .collect::<std::collections::BTreeSet<_>>(),
        ["ttys000", "ttys017"].into_iter().collect()
    );
}
#[test]
fn all_compiled_kernel_paths_are_absolute_unique_role_inputs() {
    for line in include_str!("../../../src/first_live/native_effects/host/roles.jsonl").lines() {
        let role: Role = serde_json::from_str(line).unwrap();
        assert!(
            role.resolved_path.starts_with('/'),
            "{}",
            role.resolved_path
        );
    }
}
