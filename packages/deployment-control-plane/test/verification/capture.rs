use super::*;
#[test]
fn unknown_capture_marker_survives_reopen_and_cannot_be_overwritten() {
    let temp = tempfile::tempdir().unwrap();
    let path = std::fs::canonicalize(temp.path()).unwrap();
    let root = Dir::open(&path, unsafe { libc::geteuid() }).unwrap();
    assert!(!unknown(&root).unwrap());
    save(
        &root,
        "unknown.json",
        &serde_json::json!({"outcome":"outcome_unknown"}),
    )
    .unwrap();
    assert!(unknown(&root).unwrap());
    assert!(save(
        &root,
        "unknown.json",
        &serde_json::json!({"outcome":"succeeded"})
    )
    .is_err());
    drop(root);
    assert!(unknown(&Dir::open(&path, unsafe { libc::geteuid() }).unwrap()).unwrap());
}
#[test]
fn capture_records_bind_exact_original_raw_bytes_without_replacement() {
    let temp = tempfile::tempdir().unwrap();
    let path = std::fs::canonicalize(temp.path()).unwrap();
    let root = Dir::open(&path, unsafe { libc::geteuid() }).unwrap();
    let value = json!({"before":{"service_generation":"one"},"documents":{"raw":" exact bytes "}});
    save(&root, "before.json", &value).unwrap();
    save(&root, "before.json", &value).unwrap();
    let actual: Value = read(&root, "before.json").unwrap();
    assert_eq!(actual, value);
    assert_eq!(
        save(
            &root,
            "before.json",
            &json!({"before":{"service_generation":"new"}})
        )
        .unwrap_err()
        .code(),
        "WATCHDOG_CAPTURE_IMMUTABLE"
    );
}
