use super::*;
use crate::fs::{file::snapshot, FixtureRoots};
use std::os::{
    macos::fs::MetadataExt as MacMetadataExt,
    unix::fs::{MetadataExt, PermissionsExt},
};

fn fixture() -> tempfile::TempDir {
    tempfile::tempdir_in(FixtureRoots::kernel_temp().unwrap()).unwrap()
}
fn compressed(root: &Path, name: &str, bytes: &[u8]) -> std::path::PathBuf {
    let source = root.join("source");
    let target = root.join(name);
    std::fs::write(&source, bytes).unwrap();
    assert!(Command::new("/usr/bin/ditto")
        .arg("--hfsCompression")
        .arg(&source)
        .arg(&target)
        .status()
        .unwrap()
        .success());
    std::fs::set_permissions(&target, std::fs::Permissions::from_mode(0o400)).unwrap();
    assert_eq!(std::fs::metadata(&target).unwrap().st_flags(), 0x20);
    assert_eq!(std::fs::read(&target).unwrap(), bytes);
    std::fs::remove_file(source).unwrap();
    target
}
#[test]
fn compressed_sudoers_census_reads_logical_bytes_but_artifact_rejects() {
    let temp = fixture();
    let bytes = b"# isolated sudoers fixture\n".repeat(8192);
    let target = compressed(temp.path(), "sudoers", &bytes);
    let metadata = std::fs::metadata(&target).unwrap();
    let dir = Dir::open(temp.path(), metadata.uid()).unwrap();
    assert_eq!(
        snapshot(
            &dir.open_file("sudoers", libc::O_RDONLY, 0).unwrap(),
            metadata.uid(),
            4 * 1024 * 1024
        )
        .unwrap_err()
        .code(),
        "UNSAFE_FLAGS"
    );
    let mut found = BTreeMap::new();
    sudoers(
        target.to_str().unwrap(),
        &mut found,
        metadata.uid(),
        metadata.gid(),
    )
    .unwrap();
    assert_eq!(found.get(target.to_str().unwrap()), Some(&sha(&bytes)));
}

fn ordinary(root: &Path, name: &str, bytes: &[u8]) -> std::path::PathBuf {
    let target = root.join(name);
    if target.exists() {
        std::fs::set_permissions(&target, std::fs::Permissions::from_mode(0o600)).unwrap();
    }
    std::fs::write(&target, bytes).unwrap();
    std::fs::set_permissions(&target, std::fs::Permissions::from_mode(0o400)).unwrap();
    target
}
fn census(path: &Path) -> Result<BTreeMap<String, String>> {
    let mut found = BTreeMap::new();
    sudoers(
        path.to_str().unwrap(),
        &mut found,
        unsafe { libc::geteuid() },
        unsafe { libc::getegid() },
    )?;
    Ok(found)
}
#[test]
fn census_rejects_links_writable_metadata_flags_xattrs_acl_and_wrong_owner() {
    use std::os::fd::AsRawFd;
    let temp = fixture();
    let target = ordinary(temp.path(), "sudoers", b"# fixture\n");
    assert!(census(&target).is_ok());
    let link = temp.path().join("symlink");
    std::os::unix::fs::symlink(&target, &link).unwrap();
    assert_eq!(census(&link).unwrap_err().code(), "UNSAFE_FILE");
    let hard = temp.path().join("hardlink");
    std::fs::hard_link(&target, &hard).unwrap();
    assert_eq!(census(&target).unwrap_err().code(), "UNSAFE_TYPE");
    std::fs::remove_file(hard).unwrap();
    for mode in [0o420, 0o402, 0o4400] {
        std::fs::set_permissions(&target, std::fs::Permissions::from_mode(mode)).unwrap();
        assert_eq!(census(&target).unwrap_err().code(), "UNSAFE_MODE");
    }
    std::fs::set_permissions(&target, std::fs::Permissions::from_mode(0o400)).unwrap();
    std::fs::set_permissions(&target, std::fs::Permissions::from_mode(0o600)).unwrap();
    let file = std::fs::File::open(&target).unwrap();
    assert_eq!(
        unsafe { libc::fchflags(file.as_raw_fd(), libc::UF_NODUMP) },
        0
    );
    assert_eq!(census(&target).unwrap_err().code(), "UNSAFE_FLAGS");
    assert_eq!(unsafe { libc::fchflags(file.as_raw_fd(), 0) }, 0);
    assert_eq!(
        unsafe {
            libc::fsetxattr(
                file.as_raw_fd(),
                c"user.census-test".as_ptr(),
                b"x".as_ptr().cast(),
                1,
                0,
                0,
            )
        },
        0
    );
    assert_eq!(census(&target).unwrap_err().code(), "UNSAFE_XATTR");
    assert_eq!(
        unsafe { libc::fremovexattr(file.as_raw_fd(), c"user.census-test".as_ptr(), 0) },
        0
    );
    let uid = file.metadata().unwrap().uid();
    let gid = file.metadata().unwrap().gid();
    let dir = Dir::open(temp.path(), uid).unwrap();
    assert_eq!(
        read_sudoers(&dir, "sudoers", gid + 1, 1024)
            .unwrap_err()
            .code(),
        "UNSAFE_OWNER"
    );
    let wrong = Dir {
        file: dir.file.try_clone().unwrap(),
        uid: uid + 1,
    };
    assert_eq!(
        read_sudoers(&wrong, "sudoers", gid, 1024)
            .unwrap_err()
            .code(),
        "UNSAFE_OWNER"
    );
    assert!(Command::new("/bin/chmod")
        .args(["+a", "everyone allow read"])
        .arg(&target)
        .status()
        .unwrap()
        .success());
    assert_eq!(census(&target).unwrap_err().code(), "UNSAFE_ACL");
    assert!(Command::new("/bin/chmod")
        .arg("-N")
        .arg(&target)
        .status()
        .unwrap()
        .success());
}
#[test]
fn census_compressed_size_limit_is_logical_size() {
    let temp = fixture();
    let bytes = b"# compressible fixture\n".repeat(8192);
    let target = compressed(temp.path(), "sudoers", &bytes);
    let m = std::fs::metadata(&target).unwrap();
    let dir = Dir::open(temp.path(), m.uid()).unwrap();
    assert_eq!(
        read_sudoers(&dir, "sudoers", m.gid(), bytes.len() as u64 - 1)
            .unwrap_err()
            .code(),
        "SIZE_LIMIT"
    );
    assert_eq!(
        read_sudoers(&dir, "sudoers", m.gid(), bytes.len() as u64).unwrap(),
        bytes
    );
}
#[test]
fn census_compressed_include_graph_and_fail_closed_parser() {
    let temp = fixture();
    let include = compressed(
        temp.path(),
        "included",
        &b"# included fixture\n".repeat(8192),
    );
    let top = ordinary(
        temp.path(),
        "sudoers",
        format!("@include {}\n", include.display()).as_bytes(),
    );
    assert_eq!(census(&top).unwrap().len(), 2);
    let sub = temp.path().join("includes");
    std::fs::create_dir(&sub).unwrap();
    std::fs::set_permissions(&sub, std::fs::Permissions::from_mode(0o700)).unwrap();
    compressed(&sub, "entry", &b"# directory entry\n".repeat(8192));
    for directive in [
        format!("#includedir {}\n", sub.display()),
        format!("@includedir {}\n", sub.display()),
    ] {
        ordinary(temp.path(), "sudoers", directive.as_bytes());
        assert_eq!(census(&top).unwrap().len(), 2);
    }
    for directive in [
        format!("@include {}\n", top.display()),
        "@include relative\n".into(),
        "@include /x extra\n".into(),
        "@include \"/x\"\n".into(),
        "@includeunknown /x\n".into(),
    ] {
        ordinary(temp.path(), "sudoers", directive.as_bytes());
        assert_eq!(census(&top).unwrap_err().code(), "BOOTSTRAP_SUDOERS_CENSUS");
    }
    let mut found = (0..256)
        .map(|n| (format!("fixture-{n}"), String::new()))
        .collect();
    assert_eq!(
        sudoers(
            top.to_str().unwrap(),
            &mut found,
            unsafe { libc::geteuid() },
            unsafe { libc::getegid() }
        )
        .unwrap_err()
        .code(),
        "BOOTSTRAP_SUDOERS_CENSUS"
    );
}
