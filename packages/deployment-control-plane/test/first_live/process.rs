use super::*;
use std::fs;

fn command(script: &str) -> Command {
    assert_ne!(unsafe { libc::geteuid() }, 0);
    let mut c = Command::new("/bin/sh");
    c.args(["-c", script])
        .env_clear()
        .env("PATH", "/usr/bin:/bin")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .process_group(0);
    c
}
fn residual(script: &str) -> (Result<Output>, Duration) {
    let t = tempfile::tempdir().unwrap();
    let pid_file = t.path().join("owned-child");
    let mut c = command(script);
    c.env("DCP_FIXTURE_PID", &pid_file);
    let start = Instant::now();
    let result = collect(c, Duration::from_millis(100));
    let elapsed = start.elapsed();
    if let Ok(s) = fs::read_to_string(pid_file) {
        let pid = s.trim().parse::<i32>().unwrap();
        // This PID is a live bounded sleep created by this private fixture only.
        unsafe {
            libc::kill(pid, libc::SIGKILL);
        }
    }
    (result, elapsed)
}
#[test]
fn inherited_pipe_does_not_hide_residual_or_wait_beyond_deadline() {
    let (result, elapsed) =
        residual("/bin/sleep 2 & printf '%s' $! > \"$DCP_FIXTURE_PID\"; exit 0");
    assert!(result.is_err(), "leader exit is not descendant closure");
    assert!(
        elapsed < Duration::from_millis(700),
        "pipe wait: {elapsed:?}"
    );
}
#[test]
fn closed_pipe_residual_does_not_allow_success() {
    let (result, _) = residual(
        "/bin/sleep 2 </dev/null >/dev/null 2>&1 & printf '%s' $! > \"$DCP_FIXTURE_PID\"; exit 0",
    );
    assert!(result.is_err(), "closed streams are not process closure");
}
#[test]
fn signal_termination_is_unknown_not_observed_exit_code() {
    let result = collect(command("kill -TERM $$"), Duration::from_millis(500));
    assert!(result.is_err());
}
#[test]
fn finite_nonzero_exit_preserves_both_diagnostic_streams() {
    let result = collect(
        command("printf good; printf denied >&2; exit 17"),
        Duration::from_secs(1),
    )
    .unwrap();
    assert_eq!(result.code, Some(17));
    assert_eq!(result.stdout, "good");
    assert_eq!(result.stderr, "denied");
}
#[test]
fn direct_timeout_returns_unknown_within_bounded_cleanup() {
    let started = Instant::now();
    let result = collect(command("exec /bin/sleep 2"), Duration::from_millis(100));
    assert!(matches!(result, Err(e) if e.code() == "FIRST_LIVE_CHILD_UNKNOWN"));
    assert!(started.elapsed() < Duration::from_millis(700));
}

#[test]
fn scripts_and_unprivileged_probes_cannot_run_as_root_or_cross_identities() {
    for tool in [Tool::Sudo, Tool::Retired, Tool::Sh, Tool::Node] {
        assert!(validate_identity(tool, None).is_err());
    }
    assert!(validate_identity(Tool::Launchctl, Some((502, 0, &[20]))).is_err());
    assert!(validate_identity(Tool::Node, Some((502, 20, &[20]))).is_err());
    assert!(validate_identity(Tool::Sh, Some((505, 601, &[601]))).is_err());
    assert!(validate_identity(Tool::Launchctl, Some((502, 20, &[0, 20]))).is_err());
    validate_identity(Tool::Node, Some((505, 601, &[601]))).unwrap();
    validate_identity(Tool::Sh, Some((502, 20, &[20]))).unwrap();
    validate_identity(Tool::Launchctl, None).unwrap();
}

#[test]
fn output_limit_and_invalid_utf8_cannot_be_accepted() {
    let huge = collect(command("printf '%1049600s' x"), Duration::from_secs(2));
    assert!(matches!(huge, Err(e) if e.code() == "FIRST_LIVE_CHILD_LIMIT"));
    let bytes = collect(command("printf '\\377'"), Duration::from_secs(1));
    assert!(matches!(bytes, Err(e) if e.code() == "FIRST_LIVE_CHILD_UNKNOWN"));
}
#[test]
fn real_timeout_leaves_consumed_unknown_journal_and_no_success_record() {
    use super::super::journal::{self, Step};
    let temp = crate::common::private::temp();
    let roots = crate::fs::FixtureRoots::open(temp.path()).unwrap();
    let result = journal::execute(&roots.root, Step::CanaryCreate, "bound-operation", || {
        collect(command("exec /bin/sleep 2"), Duration::from_millis(100))
    });
    assert!(result.is_err());
    let names = roots.root.names().unwrap();
    assert!(names.contains(&"canary-create-intent.json".into()));
    assert!(names.contains(&"canary-create-failure.json".into()));
    assert!(!names.contains(&"canary-create-result.json".into()));
    let failure: serde_json::Value =
        serde_json::from_slice(&fs::read(temp.path().join("canary-create-failure.json")).unwrap())
            .unwrap();
    assert_eq!(failure["outcome"], "unknown-retained");
    let mut invoked = false;
    let retry = journal::execute(&roots.root, Step::CanaryCreate, "bound-operation", || {
        invoked = true;
        Ok(())
    });
    assert!(retry.is_err());
    assert!(!invoked);
}
#[test]
fn production_runner_rejects_nonroot_before_touching_fixed_tools() {
    assert_ne!(unsafe { libc::geteuid() }, 0);
    assert!(
        matches!(run(Tool::Launchctl, "not-a-digest", &[], None, 5), Err(e) if e.code() == "FIRST_LIVE_REQUIRES_ROOT")
    );
}

#[test]
fn stdout_and_stderr_share_the_frozen_one_mib_budget() {
    let result = collect(
        command("printf '%524289s' x; printf '%524289s' y >&2"),
        Duration::from_secs(2),
    );
    assert!(matches!(result, Err(e) if e.code() == "FIRST_LIVE_CHILD_LIMIT"));
}

#[test]
fn caller_node_can_only_enter_the_two_retired_constant_stubs() {
    for args in [
        vec!["-e".into(), "process.exit()".into()],
        vec!["/tmp/arbitrary.mjs".into()],
        vec![],
        vec![
            "/usr/local/libexec/agent-core/app/scripts/production-runtime-launchd.mjs".into(),
            "extra".into(),
        ],
    ] {
        assert!(validate_arguments(Tool::RetiredNode, &args).is_err());
    }
    for path in ["/usr/local/libexec/agent-core/app/scripts/production-runtime-launchd.mjs","/usr/local/libexec/agent-core/app/deployment-artifacts/scheduler-watchdog-routing-v1/run-routing-install.mjs"] {
        validate_arguments(Tool::RetiredNode,&[path.into()]).unwrap();
    }
    validate_identity(Tool::RetiredNode, Some((502, 20, &[20]))).unwrap();
    assert!(validate_identity(Tool::RetiredNode, None).is_err());
    assert!(validate_identity(Tool::RetiredNode, Some((505, 601, &[601]))).is_err());
}
