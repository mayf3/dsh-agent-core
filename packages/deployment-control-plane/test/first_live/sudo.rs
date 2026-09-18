use super::*;
#[test]
fn exact_frozen_apple_tuple_only() {
    exact(&FROZEN).unwrap();
    type TupleMutation = Box<dyn Fn(&mut Tuple)>;
    let variants: Vec<TupleMutation> = vec![
        Box::new(|v| v.file = false),
        Box::new(|v| v.uid = 502),
        Box::new(|v| v.gid = 20),
        Box::new(|v| v.mode = 0o5511),
        Box::new(|v| v.mode = 0o4711),
        Box::new(|v| v.mode = 0o755),
        Box::new(|v| v.links = 2),
        Box::new(|v| v.flags = 0),
        Box::new(|v| v.flags |= 2),
        Box::new(|v| v.device += 1),
        Box::new(|v| v.inode += 1),
        Box::new(|v| v.size += 1),
        Box::new(|v| v.mtime += 1),
        Box::new(|v| v.mtime_ns += 1),
        Box::new(|v| v.ctime += 1),
        Box::new(|v| v.ctime_ns += 1),
        Box::new(|v| v.birth += 1),
        Box::new(|v| v.birth_ns += 1),
    ];
    for change in variants {
        let mut v = FROZEN.clone();
        change(&mut v);
        assert!(exact(&v).is_err(), "{v:?}");
    }
}
fn output(uid: u32) -> Output {
    Output {
        code: Some(0),
        stdout: format!(
            "User {} is not allowed to run sudo on MacBook-Pro.\n",
            if uid == 505 { "authsvc" } else { "_dcp_review" }
        ),
        stderr: String::new(),
    }
}
#[test]
fn exact_documented_successful_no_command_listing_required() {
    for uid in [505, 612] {
        no_commands(uid, &output(uid)).unwrap();
    }
    assert!(no_commands(502, &output(505)).is_err());
    assert!(no_commands(505, &output(612)).is_err());
    for code in [None, Some(1), Some(2), Some(127)] {
        let mut o = output(505);
        o.code = code;
        assert!(no_commands(505, &o).is_err());
    }
}
#[test]
fn errors_extra_rules_wrong_host_and_partial_outputs_never_prove_denial() {
    let good = output(505).stdout;
    for text in [
        String::new(),
        good.trim_end().into(),
        good.replace("MacBook-Pro", "another-host"),
        format!("{good}(ALL) NOPASSWD: ALL\n"),
        format!("{good}{good}"),
        "sudo: a password is required\n".into(),
        "User authsvc may run the following commands on MacBook-Pro:\n    (ALL) ALL\n".into(),
    ] {
        let mut o = output(505);
        o.stdout = text;
        assert!(no_commands(505, &o).is_err());
    }
    let mut o = output(505);
    o.stderr = "sudo: parse error\n".into();
    assert!(no_commands(505, &o).is_err());
    let mut o = output(505);
    std::mem::swap(&mut o.stdout, &mut o.stderr);
    assert!(no_commands(505, &o).is_err());
}
#[test]
fn copied_or_generic_setuid_file_cannot_use_fixed_entry_exception() {
    use std::os::unix::fs::PermissionsExt;
    let t = tempfile::tempdir().unwrap();
    let p = t.path().join("sudo");
    std::fs::write(&p, b"not sudo").unwrap();
    std::fs::set_permissions(&p, std::fs::Permissions::from_mode(0o4511)).unwrap();
    let f = File::open(&p).unwrap();
    assert!(metadata(&f).is_err());
    assert!(crate::fs::secure::validate_platform_file(&f).is_err());
}

#[test]
fn policy_audit_cannot_be_invoked_from_submitter_identity() {
    assert_ne!(unsafe { libc::geteuid() }, 0);
    assert!(matches!(audit("unread"),Err(e) if e.code()=="FIRST_LIVE_REQUIRES_ROOT"));
}
