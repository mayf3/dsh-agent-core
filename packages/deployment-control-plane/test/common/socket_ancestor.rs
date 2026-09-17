use super::*;
use crate::common::private;
use std::{fs, os::unix::fs::PermissionsExt};
#[test]
fn equivalent_private_descriptor_binding_rejects_replacement_mode_and_acl() {
    let temp = private::temp();
    let root = crate::fs::FixtureRoots::open(temp.path()).unwrap();
    fs::create_dir(temp.path().join("run")).unwrap();
    fs::set_permissions(temp.path().join("run"), fs::Permissions::from_mode(0o775)).unwrap();
    let file = root
        .root
        .open_file("run", libc::O_RDONLY | libc::O_DIRECTORY, 0)
        .unwrap();
    let m = file.metadata().unwrap();
    let dir = Dir { file, uid: m.uid() };
    let proof = SocketAncestor {
        host: "a".repeat(64),
        device: m.dev(),
        inode: m.ino(),
        uid: m.uid(),
        gid: m.gid(),
        mode: 0o775,
        flags: 0,
        acl_none: true,
        memberships: Default::default(),
        denial_receipt: "b".repeat(64),
    };
    // Descriptor mechanism only: this synthetic nonroot parent cannot pass production policy.
    assert!(proof.validate(&proof.host, &BTreeSet::new()).is_err());
    check(&dir, &proof).unwrap();
    assert!(
        root.root.child("run").is_err(),
        "generic ancestor policy weakened"
    );
    let mut replaced = proof.clone();
    replaced.inode += 1;
    assert!(check(&dir, &replaced).is_err());
    fs::set_permissions(temp.path().join("run"), fs::Permissions::from_mode(0o777)).unwrap();
    assert!(check(&dir, &proof).is_err());
    fs::set_permissions(temp.path().join("run"), fs::Permissions::from_mode(0o775)).unwrap();
    let status = std::process::Command::new("/bin/chmod")
        .args(["+a", "everyone allow write"])
        .arg(temp.path().join("run"))
        .status()
        .unwrap();
    assert!(status.success());
    assert!(check(&dir, &proof).is_err());
}
