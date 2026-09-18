use super::*;
use crate::first_live::native_effects::host::credentials::Credentials;
fn fixture() -> (Identity, ProcessIdentity) {
    let a = Identity {
        pid: 44,
        parent_pid: 1,
        birth_seconds: 9,
        birth_micros: 2,
        credentials: Credentials {
            effective_uid: 505,
            real_uid: 505,
            saved_uid: 0,
            effective_gid: 601,
            real_gid: 601,
            saved_gid: 601,
        },
        tty_device: u32::MAX,
        process_group: 44,
        session_id: Some(44),
        executable: Some("/fixed/node".into()),
    };
    let p = ProcessIdentity {
        pid: 44,
        started_seconds: 9,
        started_micros: 2,
        uid: 505,
        gid: 601,
        executable: "/fixed/node".into(),
    };
    (a, p)
}
#[test]
fn a_service_euid_match_cannot_authorize_retained_root_credentials() {
    let (a, p) = fixture();
    assert!(!service_match(&a, &p));
}
#[test]
fn exact_root_w2_service_generation_is_distinct_from_other_pid() {
    let (mut a, mut p) = fixture();
    a.credentials = Credentials {
        effective_uid: 0,
        real_uid: 0,
        saved_uid: 0,
        effective_gid: 0,
        real_gid: 0,
        saved_gid: 0,
    };
    p.uid = 0;
    p.gid = 0;
    assert!(service_match(&a, &p));
    a.birth_micros += 1;
    assert!(!service_match(&a, &p));
}
