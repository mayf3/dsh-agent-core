use super::*;
use std::os::unix::fs::PermissionsExt;
fn fixture() -> (tempfile::NamedTempFile, std::fs::File) {
    let mut p = tempfile::NamedTempFile::new().unwrap();
    use std::io::Write;
    p.write_all(b"fixed public image").unwrap();
    p.as_file()
        .set_permissions(std::fs::Permissions::from_mode(0o644))
        .unwrap();
    let f = p.reopen().unwrap();
    (p, f)
}
#[test]
fn hashes_exact_descriptor_bytes_without_exposing_them_in_receipt() {
    let (_p, mut f) = fixture();
    let v = read(&mut f, unsafe { libc::geteuid() }, false).unwrap();
    assert_eq!(v.digest, crate::fs::file::sha(b"fixed public image"));
    assert!(!serde_json::to_string(&v)
        .unwrap()
        .contains("fixed public image"));
}
#[test]
fn writable_alias_setid_wrong_owner_and_hardlink_are_refused() {
    let (p, mut f) = fixture();
    let uid = unsafe { libc::geteuid() };
    assert!(read(&mut f, uid.wrapping_add(1), false).is_err());
    for mode in [0o666, 0o4644] {
        f.set_permissions(std::fs::Permissions::from_mode(mode))
            .unwrap();
        assert!(read(&mut f, uid, false).is_err());
    }
    f.set_permissions(std::fs::Permissions::from_mode(0o644))
        .unwrap();
    let sibling = p.path().with_extension("alias");
    std::fs::hard_link(p.path(), &sibling).unwrap();
    let result = read(&mut f, uid, false);
    std::fs::remove_file(sibling).unwrap();
    assert!(result.is_err());
}
