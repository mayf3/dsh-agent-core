use super::*;
#[test]
fn exact_missing_optional_job_is_absence_not_positive_role_proof() {
    let out = process::Output {
        code: Some(113),
        stdout: String::new(),
        stderr: "Could not find service \"com.apple.fixed\" in domain for system\n".into(),
    };
    assert!(from_output(out, "system/com.apple.fixed")
        .unwrap()
        .is_none());
}
#[test]
fn exact_loaded_but_not_running_job_is_not_positive_role_proof() {
    let out = process::Output {
        code: Some(0),
        stdout: "system/com.apple.fixed = {\n\tpath = /System/Library/LaunchDaemons/com.apple.fixed.plist\n\ttype = LaunchDaemon\n\tstate = not running\n\tprogram = /usr/libexec/fixed\n}\n".into(),
        stderr: String::new(),
    };
    assert!(from_output(out, "system/com.apple.fixed")
        .unwrap()
        .is_none());
}
#[test]
fn permission_truncation_wrong_label_or_unknown_status_is_never_absence() {
    for (code, text) in [
        (Some(1), "Operation not permitted"),
        (None, "Could not find service \"com.apple.fixed\""),
        (Some(113), "Could not find service \"other\""),
        (Some(113), "Permission denied"),
    ] {
        let out = process::Output {
            code,
            stdout: String::new(),
            stderr: text.into(),
        };
        assert!(from_output(out, "system/com.apple.fixed").is_err());
    }
}
