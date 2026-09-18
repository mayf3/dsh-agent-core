use super::*;
use crate::first_live::native_effects::host::{credentials::Credentials, policy};
fn inputs() -> (Role, Identity, Metadata) {
    let role = policy::roles("/usr/libexec/logd").unwrap().remove(0);
    let process = Identity {
        pid: 900,
        parent_pid: 1,
        birth_seconds: 5,
        birth_micros: 1,
        credentials: Credentials {
            effective_uid: 0,
            real_uid: 0,
            saved_uid: 0,
            effective_gid: 0,
            real_gid: 0,
            saved_gid: 0,
        },
        tty_device: u32::MAX,
        process_group: 900,
        session_id: Some(42),
        executable: Some(role.resolved_path.clone()),
    };
    let metadata = Metadata {
        domain_service: "system/com.apple.logd".into(),
        path: role.authorities[0].path.clone(),
        kind: "LaunchDaemon".into(),
        program: role.path.clone(),
        pid: 900,
    };
    (role, process, metadata)
}
#[test]
fn only_current_exact_manifest_program_pid_tuple_can_attribute() {
    let (r, p, m) = inputs();
    join(&r, &p, &m).unwrap();
}
#[test]
fn each_wrong_launch_field_or_kernel_path_refuses() {
    for index in 0..6 {
        let (r, mut p, mut m) = inputs();
        match index {
            0 => m.pid += 1,
            1 => m.program = "/tmp/logd".into(),
            2 => m.path = "/tmp/manifest".into(),
            3 => m.domain_service = "system/unknown".into(),
            4 => m.kind = "Submitted".into(),
            _ => p.executable = Some("/tmp/logd".into()),
        };
        assert!(join(&r, &p, &m).is_err());
    }
}
#[test]
fn fixed_submitted_role_requires_its_actual_job_not_guessed_identifier() {
    let (r, mut p, mut m) = inputs();
    drop(r);
    let role=policy::roles("/Library/Developer/PrivateFrameworks/CoreDevice.framework/Versions/A/Resources/bin/CoreDeviceDDIUpdaterService").unwrap().remove(0);
    p.executable = Some(role.resolved_path.clone());
    m.domain_service = role.fixed_launch_target.clone().unwrap();
    m.program = role.path.clone();
    m.kind = "Submitted".into();
    m.path = "(submitted by CoreDeviceServi.123)".into();
    join(&role, &p, &m).unwrap();
    m.domain_service = "system/com.apple.CoreDevice.CoreDeviceDDIUpdaterService".into();
    assert!(join(&role, &p, &m).is_err());
}
#[test]
fn xpc_domain_is_fixed_by_bundle_service_type_and_current_pid() {
    let (_, mut p, mut m) = inputs();
    let role=policy::roles("/System/Library/Frameworks/Security.framework/Versions/A/XPCServices/authd.xpc/Contents/MacOS/authd").unwrap().remove(0);
    p.executable = Some(role.resolved_path.clone());
    m.domain_service = "system/com.apple.authd".into();
    m.program = role.path.clone();
    m.kind = "XPCService".into();
    m.path =
        "/System/Library/Frameworks/Security.framework/Versions/A/XPCServices/authd.xpc".into();
    join(&role, &p, &m).unwrap();
    m.domain_service = "pid/900/com.apple.authd".into();
    assert!(join(&role, &p, &m).is_err());
}
