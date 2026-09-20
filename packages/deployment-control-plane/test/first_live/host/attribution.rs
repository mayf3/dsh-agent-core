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
fn copy_metadata(metadata: &Metadata) -> Metadata {
    Metadata {
        domain_service: metadata.domain_service.clone(),
        path: metadata.path.clone(),
        kind: metadata.kind.clone(),
        program: metadata.program.clone(),
        pid: metadata.pid,
    }
}
#[test]
fn only_current_exact_manifest_program_pid_tuple_can_attribute() {
    let (r, p, m) = inputs();
    join(&r, &p, &m).unwrap();
}
#[test]
fn each_wrong_launch_field_or_kernel_path_refuses() {
    for index in 0..4 {
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

#[test]
fn loginwindow_role_accepts_only_one_validated_instance_of_its_fixed_parent() {
    let (_, mut process, mut metadata) = inputs();
    let role =
        policy::roles("/System/Library/CoreServices/loginwindow.app/Contents/MacOS/loginwindow")
            .unwrap()
            .remove(0);
    process.executable = Some(role.resolved_path.clone());
    metadata.domain_service =
        "system/com.apple.loginwindow.8B78FC26-B458-4419-AF5B-77AD6D2254A8".into();
    metadata.program = role.path.clone();
    metadata.path = role.authorities[0].path.clone();
    metadata.kind = "LaunchDaemon".into();
    join(&role, &process, &metadata).unwrap();
    for target in [
        "system/com.apple.loginwindow",
        "system/com.apple.loginwindow.not-a-uuid",
        "system/com.example.loginwindow.8B78FC26-B458-4419-AF5B-77AD6D2254A8",
    ] {
        metadata.domain_service = target.into();
        assert!(join(&role, &process, &metadata).is_err());
    }
}

#[test]
fn fixed_root_user_launch_agent_requires_exact_target_kind_and_authority() {
    let (_, mut process, mut metadata) = inputs();
    let role = policy::roles("/usr/sbin/distnoted").unwrap().remove(0);
    assert_eq!(role.class, "APPLE_FIXED_ROOT_USER_LAUNCH_AGENT_ROLE");
    assert_eq!(
        role.fixed_launch_target.as_deref(),
        Some("user/0/com.apple.distnoted.xpc.agent")
    );
    process.executable = Some(role.resolved_path.clone());
    metadata.domain_service = role.fixed_launch_target.clone().unwrap();
    metadata.kind = "LaunchAgent".into();
    metadata.path = role.authorities[0].path.clone();
    metadata.program = role.authorities[0].program.clone();
    join(&role, &process, &metadata).unwrap();

    for index in 0..6 {
        let mut wrong = copy_metadata(&metadata);
        match index {
            0 => wrong.domain_service = "gui/0/com.apple.distnoted.xpc.agent".into(),
            1 => wrong.kind = "LaunchDaemon".into(),
            2 => wrong.path = "/tmp/distnoted.plist".into(),
            _ => wrong.program = "/tmp/distnoted".into(),
        }
        assert!(join(&role, &process, &wrong).is_err());
    }
}

#[test]
fn fixed_fork_child_requires_exact_current_launch_parent_and_same_image() {
    let (_, mut child, mut metadata) = inputs();
    let role = policy::roles("/usr/sbin/systemstats").unwrap().remove(0);
    assert_eq!(role.class, "APPLE_FIXED_LAUNCH_DAEMON_FORK_ROLE");
    metadata.domain_service = "system/com.apple.systemstats.analysis".into();
    metadata.path = role.authorities[1].path.clone();
    metadata.program = role.authorities[1].program.clone();
    child.executable = Some(role.resolved_path.clone());
    child.pid = 901;
    child.parent_pid = 900;
    child.process_group = 900;
    let mut parent = child.clone();
    parent.pid = 900;
    parent.parent_pid = 1;
    join_fork_child(&role, &child, &parent, &metadata).unwrap();

    for index in 0..6 {
        let mut wrong_child = child.clone();
        let mut wrong_parent = parent.clone();
        let mut wrong_metadata = copy_metadata(&metadata);
        match index {
            0 => wrong_child.parent_pid = 899,
            1 => wrong_child.executable = Some("/tmp/systemstats".into()),
            2 => {
                wrong_parent.credentials.effective_uid = 501;
                wrong_parent.credentials.real_uid = 501;
                wrong_parent.credentials.saved_uid = 501;
            }
            3 => wrong_metadata.pid = 899,
            4 => wrong_child.process_group = 901,
            _ => wrong_child.credentials.effective_gid = 1,
        }
        assert!(join_fork_child(&role, &wrong_child, &wrong_parent, &wrong_metadata).is_err());
    }
}
