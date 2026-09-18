use std::{
    process::Command,
    time::{Duration, Instant},
};

// Local shell fixtures exercise owned anonymous pipes only; no fixture backend
// is exposed in NativeReviewRunner or usable to establish production readiness.
fn fixture(script: &str) -> Command {
    assert_ne!(unsafe { libc::geteuid() }, 0);
    let mut command = Command::new("/bin/sh");
    command.args(["-c", script]).env_clear();
    command
}

#[test]
fn captures_only_child_stdout_and_delivers_all_stdin() {
    let raw = b"root-prepared source packet\n";
    let output = super::super::process::capture(
        fixture("/bin/cat; printf 'diagnostic' >&2"),
        raw,
        Duration::from_secs(2),
        1024,
    )
    .unwrap();
    assert_eq!(output, raw);
}

#[test]
fn failed_child_cannot_supply_a_pass() {
    assert_eq!(
        super::super::process::capture(
            fixture("printf PASS; exit 1"),
            b"",
            Duration::from_secs(2),
            1024
        )
        .unwrap_err()
        .code(),
        "REVIEW_CHILD_FAILED"
    );
}

#[test]
fn output_on_either_pipe_is_bounded() {
    for script in [
        "while :; do printf '0123456789'; done",
        "while :; do printf '0123456789' >&2; done",
    ] {
        assert_eq!(
            super::super::process::capture(fixture(script), b"", Duration::from_secs(2), 100)
                .unwrap_err()
                .code(),
            "REVIEW_OUTPUT_LIMIT"
        );
    }
}

#[test]
fn timeout_is_bounded_even_when_child_never_reads_large_stdin() {
    let start = Instant::now();
    assert_eq!(
        super::super::process::capture(
            fixture("/bin/sleep 30"),
            &vec![b'x'; 256 * 1024],
            Duration::from_millis(30),
            1024
        )
        .unwrap_err()
        .code(),
        "REVIEW_TIMEOUT"
    );
    assert!(start.elapsed() < Duration::from_secs(3));
}
