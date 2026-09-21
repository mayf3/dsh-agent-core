use super::*;
#[test]
fn unsealed_local_and_data_paths_are_never_skipped_as_os_loader_closure() {
    for path in [
        "/usr/local/bin/tailscaled",
        "/System/Volumes/Data/usr/local/tool",
        "/System/Library/../Volumes/Data/tool",
    ] {
        assert!(!sealed_entry(path), "{path}");
    }
    for path in [
        "/usr/libexec/logd",
        "/sbin/launchd",
        "/System/Library/CoreServices/powerd.bundle/powerd",
    ] {
        assert!(sealed_entry(path));
    }
}

#[test]
fn fork_role_loader_closure_is_proven_by_the_fork_join() {
    let resolved = "/Library/Developer/CommandLineTools/Library/Frameworks/Python3.framework/Versions/3.9/Resources/Python.app/Contents/MacOS/Python";
    let role = Role {
        path: resolved.to_string(),
        resolved_path: resolved.to_string(),
        class: "APPLE_FIXED_LAUNCH_DAEMON_FORK_ROLE".to_string(),
        authorities: vec![],
        identifier: None,
        executable_sha256: None,
        bundle_path: None,
        bundle_sha256: None,
        artifact_uid: None,
        service_type: None,
        fixed_launch_target: None,
        tty: None,
    };
    let image = image::Image {
        digest: "0".repeat(64),
        device: 0,
        inode: 0,
        mode: 0o555,
        bytes: vec![0u8; 64],
    };
    // fork children: provenance comes from the fork join + Apple signature; the
    // @executable_path-anchored framework image is not loader-scanned
    assert!(closure(&role, &image).unwrap().is_empty());
    // non-fork non-sealed binaries are still loader-scanned (garbage fails format)
    let mut third_party = role.clone();
    third_party.class = "THIRD_PARTY_AUTHORITY_REQUIRED".to_string();
    assert!(closure(&third_party, &image).is_err());
}
