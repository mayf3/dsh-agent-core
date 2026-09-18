use super::*;
use crate::fs::{file::sha, secure::Dir};
use std::os::{
    fd::AsRawFd,
    unix::fs::{symlink, PermissionsExt},
};
fn fixture() -> (tempfile::TempDir, Dir) {
    let t = tempfile::tempdir().unwrap();
    let dir = Dir {
        file: std::fs::File::open(t.path()).unwrap(),
        uid: unsafe { libc::getuid() },
    };
    (t, dir)
}
fn file(t: &tempfile::TempDir, data: &[u8]) {
    std::fs::write(t.path().join("tailscaled"), data).unwrap();
    std::fs::set_permissions(
        t.path().join("tailscaled"),
        std::fs::Permissions::from_mode(0o555),
    )
    .unwrap();
}
#[test]
fn fixed_old_leaf_checks_current_bytes_and_exact_metadata() {
    let (t, d) = fixture();
    file(&t, b"reviewed");
    let uid = unsafe { libc::getuid() };
    let gid = unsafe { libc::getgid() };
    old_leaf(&d, uid, gid, 8, &sha(b"reviewed")).unwrap();
    assert!(old_leaf(&d, uid, gid, 8, &sha(b"changed!")).is_err());
    assert!(old_leaf(&d, uid + 1, gid, 8, &sha(b"reviewed")).is_err());
    assert!(old_leaf(&d, uid, gid + 1, 8, &sha(b"reviewed")).is_err());
    assert!(old_leaf(&d, uid, gid, 9, &sha(b"reviewed")).is_err());
    std::fs::set_permissions(
        t.path().join("tailscaled"),
        std::fs::Permissions::from_mode(0o755),
    )
    .unwrap();
    assert!(old_leaf(&d, uid, gid, 8, &sha(b"reviewed")).is_err());
}
#[test]
fn old_leaf_refuses_alias_fifo_and_directory_without_content_reads() {
    let uid = unsafe { libc::getuid() };
    let gid = unsafe { libc::getgid() };
    for kind in ["symlink", "hardlink", "fifo", "directory"] {
        let (t, d) = fixture();
        match kind {
            "symlink" => {
                symlink("/private/var/root/never-read", t.path().join("tailscaled")).unwrap()
            }
            "hardlink" => {
                file(&t, b"reviewed");
                std::fs::hard_link(t.path().join("tailscaled"), t.path().join("alias")).unwrap();
            }
            "fifo" => assert_eq!(
                unsafe { libc::mkfifoat(d.file.as_raw_fd(), c"tailscaled".as_ptr(), 0o555) },
                0
            ),
            _ => std::fs::create_dir(t.path().join("tailscaled")).unwrap(),
        }
        assert!(
            old_leaf(&d, uid, gid, 8, &sha(b"reviewed")).is_err(),
            "{kind}"
        );
    }
}
