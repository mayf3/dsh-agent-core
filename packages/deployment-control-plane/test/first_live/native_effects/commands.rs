use super::*;
#[test]
fn exact_refusal_never_accepts_generic_failure_or_extra_output() {
    let mut v = Output {
        code: Some(64),
        stdout: String::new(),
        stderr: "Legacy deployment entry retired; use agent-deployctl.\n".into(),
    };
    assert!(refusal(&v));
    v.code = Some(1);
    assert!(!refusal(&v));
    v.code = Some(64);
    v.stdout = "extra".into();
    assert!(!refusal(&v));
}
#[test]
fn effective_privilege_requires_exact_reviewed_stdout_and_normal_success() {
    let mut v = Output {
        code: Some(0),
        stdout: "fixed public privileges".into(),
        stderr: String::new(),
    };
    let hash = sha(v.stdout.as_bytes());
    assert!(sudo(&v, &hash));
    v.stdout.push_str(" new privilege");
    assert!(!sudo(&v, &hash));
    v.stdout = "fixed public privileges".into();
    v.code = None;
    assert!(!sudo(&v, &hash));
}
