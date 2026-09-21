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

#[test]
fn current_boot_root_roles_have_exact_reviewed_authorities() {
    for (path, class) in [
        ("/usr/libexec/peakpowermanagerd", "OS_LAUNCH_DAEMON_STATIC_CANDIDATE"),
        ("/System/Library/PrivateFrameworks/SkyLight.framework/Versions/A/Resources/WindowServer", "OS_LAUNCH_DAEMON_STATIC_CANDIDATE"),
        ("/System/Library/CoreServices/loginwindow.app/Contents/MacOS/loginwindow", "APPLE_FIXED_INSTANCE_LAUNCH_ROLE"),
        ("/usr/libexec/secinitd", "OS_LAUNCH_DAEMON_STATIC_CANDIDATE"),
        ("/System/Library/Frameworks/ColorSync.framework/Versions/A/XPCServices/com.apple.ColorSyncXPCAgent.xpc/Contents/MacOS/com.apple.ColorSyncXPCAgent", "APPLE_FIXED_XPC_ROLE"),
        ("/System/Library/PrivateFrameworks/AppleDeviceQuerySupport.framework/Versions/A/XPCServices/AppleDeviceQueryService.xpc/Contents/MacOS/AppleDeviceQueryService", "APPLE_FIXED_XPC_ROLE"),
        ("/System/Library/PrivateFrameworks/SystemAdministration.framework/XPCServices/writeconfig.xpc/Contents/MacOS/writeconfig", "APPLE_FIXED_XPC_ROLE"),
        ("/System/Library/PrivateFrameworks/AppleNeuralEngine.framework/XPCServices/ANECompilerService.xpc/Contents/MacOS/ANECompilerService", "APPLE_FIXED_XPC_ROLE"),
        ("/usr/libexec/endpointsecurityd", "OS_LAUNCH_DAEMON_STATIC_CANDIDATE"),
        ("/System/Library/PrivateFrameworks/CoreDuetContext.framework/Versions/A/Resources/contextstored", "OS_LAUNCH_DAEMON_STATIC_CANDIDATE"),
        ("/System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/CarbonCore.framework/Versions/A/Support/coreservicesd", "OS_LAUNCH_DAEMON_STATIC_CANDIDATE"),
        ("/System/Library/PrivateFrameworks/SystemMigration.framework/Versions/A/Resources/systemmigrationd", "OS_LAUNCH_DAEMON_STATIC_CANDIDATE"),
        ("/System/Library/PrivateFrameworks/PackageKit.framework/Versions/A/Resources/installd", "OS_LAUNCH_DAEMON_STATIC_CANDIDATE"),
        ("/System/Library/PrivateFrameworks/PackageKit.framework/Versions/A/Resources/system_installd", "OS_LAUNCH_DAEMON_STATIC_CANDIDATE"),
        ("/System/Library/PrivateFrameworks/BackgroundTaskManagement.framework/Versions/A/Resources/backgroundtaskmanagementd", "OS_LAUNCH_DAEMON_STATIC_CANDIDATE"),
        ("/System/Library/PrivateFrameworks/AssetCacheServicesExtensions.framework/Versions/A/XPCServices/AssetCacheTetheratorService.xpc/Contents/MacOS/AssetCacheTetheratorService", "OS_LAUNCH_DAEMON_STATIC_CANDIDATE"),
        ("/System/Library/PrivateFrameworks/FindMyMac.framework/Versions/A/Resources/FindMyMacd", "OS_LAUNCH_DAEMON_STATIC_CANDIDATE"),
        ("/System/Library/CoreServices/uncd", "OS_LAUNCH_DAEMON_STATIC_CANDIDATE"),
        ("/Library/Developer/CommandLineTools/Library/Frameworks/Python3.framework/Versions/3.9/Resources/Python.app/Contents/MacOS/Python", "APPLE_FIXED_LAUNCH_DAEMON_FORK_ROLE"),
    ] {
        let found = roles(path).unwrap_or_else(|_| panic!("missing current role: {path}"));
        assert_eq!(found.len(), 1, "ambiguous current role: {path}");
        assert_eq!(found[0].class, class, "wrong class: {path}");
        if class == "APPLE_FIXED_XPC_ROLE" {
            assert!(found[0].authorities.is_empty(), "unexpected plist: {path}");
            assert!(found[0].identifier.is_some(), "missing identifier: {path}");
            assert!(found[0].executable_sha256.is_some(), "missing image digest: {path}");
            assert!(found[0].bundle_path.is_some(), "missing bundle authority: {path}");
            assert!(found[0].bundle_sha256.is_some(), "missing bundle digest: {path}");
            assert!(found[0].service_type.is_some(), "missing service type: {path}");
        } else {
            assert!(!found[0].authorities.is_empty(), "missing launch authority: {path}");
        }
    }
    assert!(roles("/usr/libexec/current-boot-lookalike").is_err());
}

#[test]
fn nonroot_owned_system_asset_is_bound_to_one_exact_role() {
    let path = "/System/Library/AssetsV2/com_apple_MobileAsset_RecoveryOSUpdateBrain/28f9b40aedc0bda53bdc29e31682c998de89e5cb.asset/AssetData/com.apple.NRD.UpdateBrainService.xpc/Contents/MacOS/com.apple.NRD.UpdateBrainService";
    let role = roles(path).unwrap().remove(0);
    assert_eq!(role.artifact_uid, Some(242));
    for line in include_str!("../../../src/first_live/native_effects/host/roles.jsonl").lines() {
        let other: Role = serde_json::from_str(line).unwrap();
        if other.resolved_path != path {
            assert_eq!(
                other.artifact_uid, None,
                "unexpected owner override: {}",
                other.resolved_path
            );
        }
    }
}

#[test]
fn sealed_system_authority_hardlinks_are_two_exact_policy_entries() {
    let mut linked = std::collections::BTreeSet::new();
    for line in include_str!("../../../src/first_live/native_effects/host/roles.jsonl").lines() {
        let role: Role = serde_json::from_str(line).unwrap();
        for authority in role.authorities {
            if authority.nlink.is_some() {
                assert_eq!(authority.nlink, Some(2));
                linked.insert(authority.path);
            }
        }
    }
    assert_eq!(
        linked,
        [
            "/System/Library/LaunchDaemons/com.apple.coreservices.sharedfilelistd.plist"
                .to_string(),
            "/System/Library/LaunchDaemons/com.apple.powerd.plist".to_string(),
        ]
        .into_iter()
        .collect()
    );
}
