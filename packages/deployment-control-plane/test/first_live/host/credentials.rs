use super::*;
fn process() -> Identity {
    Identity {
        pid: 42,
        parent_pid: 1,
        birth_seconds: 1,
        birth_micros: 2,
        credentials: Credentials {
            effective_uid: 502,
            real_uid: 502,
            saved_uid: 502,
            effective_gid: 20,
            real_gid: 20,
            saved_gid: 20,
        },
        tty_device: 0,
        process_group: 42,
        session_id: Some(42),
        executable: Some("/fixed/known".into()),
    }
}
#[test]
fn saved_or_real_root_cannot_hide_in_nonroot_selection() {
    for kind in 0..3 {
        let mut p = process();
        match kind {
            0 => p.credentials.saved_uid = 0,
            1 => p.credentials.real_uid = 0,
            _ => p.credentials.effective_uid = 0,
        };
        assert_eq!(stable(&[p.clone()], &[p]).unwrap().len(), 1);
    }
}
#[test]
fn incomplete_missing_path_duplicate_or_empty_census_is_never_clean() {
    assert!(stable(&[], &[]).is_err());
    let mut p = process();
    p.credentials.saved_uid = 0;
    p.executable = None;
    assert!(stable(&[p.clone()], &[p]).is_err());
    let p = process();
    assert!(stable(&[p.clone(), p.clone()], &[p.clone(), p]).is_err());
}
#[test]
fn all_credentials_and_initially_nonroot_selectors_must_remain_stable() {
    let p = process();
    for i in 0..6 {
        let mut q = p.clone();
        match i {
            0 => q.credentials.effective_uid = 0,
            1 => q.credentials.real_uid = 0,
            2 => q.credentials.saved_uid = 0,
            3 => q.credentials.effective_gid = 0,
            4 => q.credentials.real_gid = 0,
            _ => q.credentials.saved_gid = 0,
        };
        assert!(stable(std::slice::from_ref(&p), &[q]).is_err());
    }
    assert!(stable(&[p], &[]).is_err());
}
#[test]
fn missing_saved_field_rejects_before_selector_runs() {
    let mut v = serde_json::to_value(process()).unwrap();
    v["credentials"]
        .as_object_mut()
        .unwrap()
        .remove("saved_uid");
    assert!(serde_json::from_value::<Identity>(v).is_err());
}
#[test]
fn kernel_zero_is_not_a_userspace_missing_path_exception() {
    let mut p = process();
    p.pid = 0;
    p.session_id = None;
    p.parent_pid = 0;
    p.process_group = 0;
    p.tty_device = 0;
    p.executable = None;
    p.birth_seconds = 0;
    p.birth_micros = 0;
    p.credentials = Credentials {
        effective_uid: 0,
        real_uid: 0,
        saved_uid: 0,
        effective_gid: 0,
        real_gid: 0,
        saved_gid: 0,
    };
    assert_eq!(
        stable(std::slice::from_ref(&p), std::slice::from_ref(&p))
            .unwrap()
            .len(),
        1
    );
    for kind in 0..4 {
        let mut q = p.clone();
        match kind {
            0 => q.pid = 1,
            1 => q.credentials.saved_uid = 502,
            2 => q.parent_pid = 1,
            _ => q.executable = Some("/untrusted".into()),
        };
        assert!(stable(std::slice::from_ref(&q), std::slice::from_ref(&q)).is_err());
    }
}
