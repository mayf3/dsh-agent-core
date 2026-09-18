use super::*;
#[test]
fn loaded_domain_denial_never_accepts_missing_service_generic_io_or_success() {
    for (code, stderr) in [
        (Some(0), "Operation not permitted"),
        (Some(113), "Could not find service"),
        (Some(5), "Bootstrap failed: 5: Input/output error"),
        (Some(1), ""),
        (None, "Operation not permitted"),
    ] {
        assert!(!denied(&Output {
            code,
            stdout: String::new(),
            stderr: stderr.into()
        }));
    }
    assert!(denied(&Output {
        code: Some(1),
        stdout: String::new(),
        stderr: "Boot-out failed: 1: Operation not permitted".into()
    }));
}
#[test]
fn disabled_controller_requires_fresh_unambiguous_disabled_and_unloaded_state() {
    let disabled = Output {
        code: Some(0),
        stdout: "disabled services = {\n\"ai.agent-deployd\" => true\n}".into(),
        stderr: String::new(),
    };
    let absent = Output {
        code: Some(113),
        stdout: String::new(),
        stderr: "Could not find service \"ai.agent-deployd\" in domain for system".into(),
    };
    assert!(off_observation(&disabled, &absent));
    assert!(!off_observation(
        &disabled,
        &Output {
            code: Some(0),
            stdout: "running".into(),
            stderr: String::new()
        }
    ));
    let duplicate = Output {
        code: Some(0),
        stdout: format!("{}\n\"ai.agent-deployd\" => false", disabled.stdout),
        stderr: String::new(),
    };
    assert!(!off_observation(&duplicate, &absent));
}
