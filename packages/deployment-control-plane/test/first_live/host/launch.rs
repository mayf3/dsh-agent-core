use super::*;
fn sample() -> String {
    "system/com.apple.fixed = {\n\tpath = /System/Library/LaunchDaemons/com.apple.fixed.plist\n\ttype = LaunchDaemon\n\tprogram = /usr/libexec/fixed\n\tpid = 42\n\tenvironment = {\n\t\tSECRET = never retain this\n\t\tpid = 900\n\t}\n}\n".into()
}
#[test]
fn retains_only_exact_top_level_public_fields() {
    let p = parse(&sample(), "system/com.apple.fixed").unwrap();
    assert_eq!(p.pid, 42);
    assert_eq!(p.kind, "LaunchDaemon");
    let out = serde_json::to_string(&p).unwrap();
    assert!(!out.contains("SECRET"));
    assert!(!out.contains("900"));
}
#[test]
fn nested_pid_cannot_supply_missing_generation() {
    assert!(parse(
        &sample().replace("\tpid = 42\n", ""),
        "system/com.apple.fixed"
    )
    .is_err());
}
#[test]
fn duplicate_field_wrong_service_or_incomplete_output_is_unknown() {
    for s in [
        sample().replace("\tpid = 42", "\tpid = 42\n\tpid = 43"),
        sample().replace("system/com.apple.fixed", "system/other"),
        sample().trim_end_matches("}\n").into(),
    ] {
        assert!(parse(&s, "system/com.apple.fixed").is_err());
    }
}

#[test]
fn accepts_real_launchctl_blank_group_separators() {
    let raw = sample()
        .replace("\ttype = LaunchDaemon\n", "\ttype = LaunchDaemon\n\n")
        .replace("\tenvironment = {\n", "\n\tenvironment = {\n")
        .replace("\t}\n", "\t}\n\n");
    let parsed = parse(&raw, "system/com.apple.fixed").unwrap();
    assert_eq!(parsed.pid, 42);
}

#[test]
fn rejects_whitespace_or_content_in_place_of_blank_separator() {
    for separator in [" ", "unexpected"] {
        let raw = sample().replace(
            "\ttype = LaunchDaemon\n",
            &format!("\ttype = LaunchDaemon\n{separator}\n"),
        );
        assert!(parse(&raw, "system/com.apple.fixed").is_err());
    }
}
