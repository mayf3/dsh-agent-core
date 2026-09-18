use super::super::policy::{command, PinnedFile};
use super::*;
use crate::fs::secure::Dir;
use std::{
    fs::File,
    os::unix::fs::{symlink, PermissionsExt},
    path::Path,
};
use std::{process::Command, time::Duration};

#[test]
fn native_entry_refuses_nonroot_before_reading_inputs_or_credentials() {
    crate::common::private::nonroot();
    let runner = NativeReviewRunner::new("a".repeat(64), "b".repeat(64)).unwrap();
    assert_eq!(
        runner
            .run(&job(), Path::new("/does/not/exist"))
            .unwrap_err()
            .code(),
        "REVIEW_ROOT_REQUIRED"
    );
    assert_eq!(
        exec_native_child().unwrap_err().code(),
        "REVIEW_ROOT_REQUIRED"
    );
}

#[test]
fn child_configuration_excludes_inherited_environment_and_execution_tools() {
    let command = command();
    assert_eq!(
        command.get_program(),
        "/usr/local/libexec/agent-deployd/codex"
    );
    assert_eq!(
        command.get_current_dir(),
        Some(Path::new("/private/var/db/agent-deploy-review-workspace"))
    );
    let env: std::collections::BTreeMap<_, _> = command
        .get_envs()
        .map(|(k, v)| (k.to_str().unwrap(), v.unwrap().to_str().unwrap()))
        .collect();
    assert_eq!(env.len(), 4);
    assert_eq!(env["HOME"], "/private/var/db/agent-deploy-review");
    assert_eq!(env["CODEX_HOME"], "/private/var/db/agent-deploy-review");
    assert_eq!(env["PATH"], "");
    let args: Vec<_> = command.get_args().map(|s| s.to_str().unwrap()).collect();
    for required in [
        "--ignore-user-config",
        "--ignore-rules",
        "--ephemeral",
        "read-only",
        "never",
        "gpt-6-astra",
        "features.shell_tool=false",
        "features.unified_exec=false",
        "features.hooks=false",
        "features.plugins=false",
        "features.multi_agent=false",
        "project_doc_max_bytes=0",
        "mcp_servers={}",
    ] {
        assert!(
            args.contains(&required),
            "missing fixed restriction {required}"
        );
    }
    assert_eq!(args.last(), Some(&"-"));
}

fn dir(path: &Path) -> Dir {
    Dir {
        file: File::open(path).unwrap(),
        uid: unsafe { libc::geteuid() },
    }
}

#[test]
fn protected_input_rejects_symlinks_writable_mode_and_changed_bytes() {
    let temp = crate::common::private::temp();
    let path = temp.path().join("input");
    std::fs::write(&path, b"packet").unwrap();
    std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o400)).unwrap();
    let pin = PinnedFile::open(dir(temp.path()), "input", &digest(b"packet"), 32, false).unwrap();
    assert_eq!(pin.bytes, b"packet");
    std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600)).unwrap();
    assert_eq!(
        PinnedFile::open(dir(temp.path()), "input", &digest(b"packet"), 32, false)
            .err()
            .unwrap()
            .code(),
        "REVIEW_WRITABLE_INPUT"
    );
    std::fs::write(&path, b"change").unwrap();
    std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o400)).unwrap();
    assert_eq!(pin.recheck().unwrap_err().code(), "REVIEW_INPUT_DRIFT");
    symlink(&path, temp.path().join("alias")).unwrap();
    assert!(PinnedFile::open(dir(temp.path()), "alias", &digest(b"change"), 32, false).is_err());
}

fn sandboxed_command(path: &Path) -> Command {
    crate::common::private::nonroot();
    let path = std::fs::canonicalize(path).unwrap();
    let profile = format!("(version 1)(allow default)(deny process-fork)(deny process-exec (require-not (literal {})))", serde_json::to_string(path.to_str().unwrap()).unwrap());
    // Test-only Apple launcher avoids fork from a parallel Rust harness.
    let mut command = Command::new("/usr/bin/sandbox-exec");
    command.args(["-p", &profile]).arg(path).env_clear();
    command
}

#[test]
fn seatbelt_allows_initial_executable_but_denies_candidate_execution() {
    let mut command = sandboxed_command(Path::new("/bin/echo"));
    command.arg("allowed");
    // Echo is a fixed system fixture with no authentication or untrusted input.
    // Preserve its exit/signal and diagnostic on failure for OS-policy diagnosis.
    let child = command
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .unwrap();
    let output = child.wait_with_output().unwrap();
    assert!(
        output.status.success(),
        "fixed echo status={} stderr={}",
        output.status,
        String::from_utf8_lossy(&output.stderr)
    );
    assert_eq!(output.stdout, b"allowed\n");
    let mut command = sandboxed_command(Path::new("/bin/sh"));
    command.args(["-c", "/bin/echo forbidden"]);
    assert_eq!(
        super::super::process::capture(command, b"", Duration::from_secs(2), 4096)
            .unwrap_err()
            .code(),
        "REVIEW_CHILD_FAILED"
    );
}

// Explicitly opt-in: checks the installed user's CLI --help under the process
// sandbox only. It never authenticates, calls a model, or claims the root binding.
#[test]
#[ignore = "read-only local CLI compatibility probe; not native readiness"]
fn local_codex_help_starts_under_same_execution_restriction() {
    let executable = std::env::var("DCP_REVIEW_CLI_PROBE").expect("explicit local CLI probe path");
    let mut command = sandboxed_command(Path::new(&executable));
    command.args(["exec", "--help"]);
    let output =
        super::super::process::capture(command, b"", Duration::from_secs(5), 64 * 1024).unwrap();
    assert!(std::str::from_utf8(&output)
        .unwrap()
        .contains("--ignore-user-config"));
}

#[test]
#[ignore = "explicitly authorized model transport smoke; never an attestation"]
fn local_codex_model_transport_smoke_is_not_attestation() {
    let executable = std::env::var("DCP_REVIEW_CLI_PROBE").expect("explicit CLI path");
    let auth_home =
        std::env::var("DCP_REVIEW_AUTH_HOME").expect("existing CLI auth home; no credential copy");
    let user_home = std::env::var("HOME").unwrap();
    let temp = crate::common::private::temp();
    let schema = temp.path().join("schema.json");
    std::fs::write(&schema, REVIEW_SCHEMA_JSON).unwrap();
    let template = command();
    let mut command = sandboxed_command(Path::new(&executable));
    command
        .env("HOME", user_home)
        .env("CODEX_HOME", auth_home)
        .env("PATH", "")
        .env("LANG", "C.UTF-8")
        .current_dir(temp.path());
    for arg in template.get_args() {
        command.arg(if arg == REVIEW_SCHEMA_PATH {
            schema.as_os_str()
        } else {
            arg
        });
    }
    let packet = json!({"transport_smoke_only":true,"job_digest":"1".repeat(64),"input_digest":"2".repeat(64),
        "frozen_job":{"repo":"transport-fixture","scopes":["empty-function-source-inspection"]},
        "untrusted_source_packet":{"accepted_contract":{"path":"fixture-contract.txt","content":"Nonproduction transport fixture. The sole source contract requires an empty main function, with no operations. This does not authorize signing or deployment."},
        "files":[{"path":"main.rs","content":"fn main() {}"}]}});
    let output = super::super::process::capture(
        command,
        &serde_json::to_vec(&packet).unwrap(),
        Duration::from_secs(90),
        64 * 1024,
    )
    .unwrap();
    let response: super::super::ReviewResponse = serde_json::from_slice(&output).unwrap();
    assert_eq!(response.job_digest, "1".repeat(64));
    assert_eq!(response.input_digest, "2".repeat(64));
    assert_eq!(response.reviewer, "local-reviewer");
    assert!(matches!(response.verdict.as_str(), "PASS" | "FAIL"));
    eprintln!("DCP_REVIEW_TRANSPORT_SMOKE child_exit=0 bound_response=true model=gpt-6-astra verdict={} response_sha256={} native_uid_tested=false signed_attestation=false", response.verdict, digest(&output));
}
