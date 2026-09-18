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
