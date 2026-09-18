use crate::fs::secure::{relative, Dir};
use crate::fs::{
    file::{snapshot, write_new},
    FixtureRoots,
};
#[test]
fn scoped_name_roundtrip_remains_nofollow_and_single_link() {
    let t = crate::common::private::temp();
    let r = FixtureRoots::open(t.path()).unwrap();
    let package = r.root.mkdir("@scope").unwrap();
    write_new(
        &package,
        "file",
        b"x",
        package.uid,
        unsafe { libc::getgid() },
        0o600,
    )
    .unwrap();
    assert_eq!(
        snapshot(
            &package.open_file("file", libc::O_RDONLY, 0).unwrap(),
            package.uid,
            9
        )
        .unwrap()
        .bytes,
        b"x"
    );
    assert!(relative("@scope/../escape").is_err());
    assert!(relative("@scope/+b").is_err());
    std::os::unix::fs::symlink("@scope", t.path().join("alias")).unwrap();
    assert!(r.root.child("alias").is_err());
    std::fs::hard_link(t.path().join("@scope/file"), t.path().join("alias-file")).unwrap();
    assert!(snapshot(
        &package.open_file("file", libc::O_RDONLY, 0).unwrap(),
        package.uid,
        9
    )
    .is_err());
    let _ = std::mem::size_of::<Dir>();
}

#[test]
fn retirement_closes_root_bridge_first_and_only_three_present_paths() {
    use super::retirement;
    assert_eq!(retirement::LEGACY.len(), 3);
    assert_eq!(
        retirement::LEGACY[0],
        "/usr/local/libexec/lw-pilot-executor"
    );
    assert_eq!(
        retirement::payload(
            retirement::kind(retirement::LEGACY[0]).unwrap(),
            b"native-refusal"
        ),
        b"native-refusal"
    );
    assert_eq!(
        retirement::payload(
            retirement::kind(retirement::LEGACY[1]).unwrap(),
            b"native-refusal"
        ),
        retirement::SHELL
    );
    assert_eq!(
        retirement::payload(
            retirement::kind(retirement::LEGACY[2]).unwrap(),
            b"native-refusal"
        ),
        retirement::JS
    );
}
#[test]
fn exact_absent_retirement_parent_cannot_appear_as_file_directory_or_link() {
    let t = crate::common::private::temp();
    let r = FixtureRoots::open(t.path()).unwrap();
    let entries = std::collections::BTreeMap::new();
    assert!(super::retirement::absent_sources(&r.root, &entries).is_ok());
    let target = t.path().join("deployment-artifacts");
    std::fs::write(&target, b"unexpected").unwrap();
    assert!(super::retirement::absent_sources(&r.root, &entries).is_err());
    std::fs::remove_file(&target).unwrap();
    std::fs::create_dir(&target).unwrap();
    assert!(super::retirement::absent_sources(&r.root, &entries).is_err());
    std::fs::remove_dir(&target).unwrap();
    std::os::unix::fs::symlink("missing", &target).unwrap();
    assert!(super::retirement::absent_sources(&r.root, &entries).is_err());
}

#[test]
fn retirement_present_set_never_substitutes_absent_or_unknown_path() {
    use super::retirement;
    let exact: std::collections::BTreeMap<String, String> = retirement::LEGACY
        .iter()
        .map(|s| (s.to_string(), "a".repeat(64)))
        .collect();
    retirement::validate_set(&exact).unwrap();
    let mut missing = exact.clone();
    missing.remove(retirement::LEGACY[1]);
    assert!(retirement::validate_set(&missing).is_err());
    missing.insert(
        format!(
            "/usr/local/libexec/agent-core/app/{}",
            retirement::ABSENT[0]
        ),
        "a".repeat(64),
    );
    assert!(retirement::validate_set(&missing).is_err());
    assert!(retirement::kind(retirement::ABSENT[0]).is_err());
}
