use super::*;
fn args(env: &[&[u8]]) -> Vec<u8> {
    let mut b = 1i32.to_ne_bytes().to_vec();
    b.extend_from_slice(b"/fixed/program\0\0program\0");
    for e in env {
        b.extend_from_slice(e);
        b.push(0);
    }
    b.push(0);
    b
}
#[test]
fn current_environment_accepts_unrelated_values_without_interpreting_arguments() {
    assert!(arguments(&args(&[
        b"PATH=/fixture",
        b"SECRET=DYLD_INSERT_LIBRARIES=not-a-key"
    ]))
    .is_ok());
}
#[test]
fn every_loader_namespace_is_refused_even_empty() {
    for name in [
        "DYLD_INSERT_LIBRARIES",
        "DYLD_LIBRARY_PATH",
        "__XPC_DYLD_FRAMEWORK_PATH",
        "LD_PRELOAD",
        "LD_LIBRARY_PATH",
    ] {
        assert!(arguments(&args(&[format!("{name}=").as_bytes()])).is_err());
    }
}
#[test]
fn malformed_or_truncated_arguments_are_not_empty_environment_proof() {
    for b in [vec![], args(&[b"MALFORMED"]), args(&[b"A=1", b"A=2"])] {
        assert!(arguments(&b).is_err());
    }
    let mut b = args(&[b"A=1"]);
    b.truncate(b.len() - 2);
    assert!(arguments(&b).is_err());
}
#[test]
fn absent_domain_environment_block_is_empty_namespace_and_loader_keys_are_rejected() {
    assert!(domain("system = {\n\tenvironment = {\n\t\tPATH => /fixture\n\t}\n}\n").is_ok());
    assert!(domain("system = {\n}\n").is_ok());
    assert!(
        domain("system = {\n\tenvironment = {\n\t\tDYLD_INSERT_LIBRARIES => x\n\t}\n}\n").is_err()
    );
    assert!(domain("system = {\n\tenvironment = {\n\t\tA => b\n").is_err());
}
