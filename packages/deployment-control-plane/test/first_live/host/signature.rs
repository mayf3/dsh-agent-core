use super::*;
#[test]
fn actual_platform_signature_checks_without_executing_platform_binary() {
    assert_ne!(unsafe { libc::geteuid() }, 0);
    static_apple("/usr/bin/true", None).unwrap();
    assert!(static_apple("/usr/bin/true", Some("com.example.wrong.identity")).is_err());
}

#[test]
fn current_xprotect_resource_envelope_keeps_exact_apple_code_identity() {
    for (path, identifier) in [
        (
            "/Library/Apple/System/Library/CoreServices/XProtect.app/Contents/XPCServices/XProtectPluginService.xpc/Contents/MacOS/XProtectPluginService",
            "com.apple.XprotectFramework.PluginService",
        ),
        (
            "/Library/Apple/System/Library/CoreServices/XProtect.app/Contents/MacOS/XProtect",
            "com.apple.XProtectFramework.XProtect",
        ),
    ] {
        static_apple(path, Some(identifier)).unwrap();
        assert!(static_apple(path, Some("com.example.wrong.identity")).is_err());
    }
}
#[test]
fn nonexistent_or_untrusted_path_never_yields_signature_proof() {
    assert!(static_apple("/nonexistent-dcp-signature-fixture", None).is_err());
    assert!(static_apple("/usr/bin/true", Some("x\" or anchor apple")).is_err());
}
#[test]
fn running_signature_is_bound_to_exact_owned_fixture_generation_and_image() {
    use std::process::{Command, Stdio};
    assert_ne!(unsafe { libc::geteuid() }, 0);
    let mut child = Command::new("/bin/sleep")
        .arg("10")
        .env_clear()
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .unwrap();
    let pid = child.id();
    let result = running_apple(pid, "/bin/sleep", None);
    let mismatch = running_apple(pid, "/usr/bin/true", None);
    child.kill().unwrap();
    child.wait().unwrap();
    assert!(result.is_ok(), "{result:?}");
    assert!(mismatch.is_err());
    assert!(running_apple(pid, "/bin/sleep", None).is_err());
}
#[test]
fn apple_signature_alone_is_not_the_fixed_docker_role() {
    use std::process::{Command, Stdio};
    let mut child = Command::new("/bin/sleep")
        .arg("10")
        .env_clear()
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .unwrap();
    let result = running_docker(child.id(), "/bin/sleep");
    child.kill().unwrap();
    child.wait().unwrap();
    assert!(result.is_err());
}
