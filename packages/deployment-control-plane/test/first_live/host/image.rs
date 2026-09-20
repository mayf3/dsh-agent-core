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

#[test]
fn exact_system_asset_owner_is_explicit_and_never_a_global_relaxation() {
    let executable = "/System/Library/AssetsV2/com_apple_MobileAsset_RecoveryOSUpdateBrain/28f9b40aedc0bda53bdc29e31682c998de89e5cb.asset/AssetData/com.apple.NRD.UpdateBrainService.xpc/Contents/MacOS/com.apple.NRD.UpdateBrainService";
    let bundle = "/System/Library/AssetsV2/com_apple_MobileAsset_RecoveryOSUpdateBrain/28f9b40aedc0bda53bdc29e31682c998de89e5cb.asset/AssetData/com.apple.NRD.UpdateBrainService.xpc/Contents/Info.plist";
    assert!(protected(executable).is_err());
    assert!(protected(bundle).is_err());
    assert_eq!(
        protected_owned(executable, 242).unwrap().digest,
        "33d957339e5e274d09751e7726dc0ce13f3eeaef213c0502c107a7ce968d3da0"
    );
    assert_eq!(
        protected_owned(bundle, 242).unwrap().digest,
        "52f3a6e47c8f15f8828bc0bae87d1d5a28413752379ace613e653ebb61fc9f84"
    );
    assert!(protected_owned(executable, 0).is_err());
}

#[test]
fn streaming_digest_accepts_a_file_larger_than_the_command_output_bound() {
    use std::os::unix::fs::PermissionsExt;
    let p = tempfile::NamedTempFile::new().unwrap();
    p.as_file().set_len(129 * 1024 * 1024).unwrap();
    p.as_file()
        .set_permissions(std::fs::Permissions::from_mode(0o600))
        .unwrap();
    let mut expected = sha2::Sha256::new();
    use sha2::Digest as _;
    let zero = vec![0u8; 1024 * 1024];
    for _ in 0..129 {
        expected.update(&zero);
    }
    let expected = hex::encode(expected.finalize());
    let mut f = p.reopen().unwrap();
    assert_eq!(
        stream_digest(
            &mut f,
            unsafe { libc::geteuid() },
            512 * 1024 * 1024,
            &expected,
            || Ok(()),
        )
        .unwrap(),
        expected
    );
}

#[test]
fn streaming_digest_rejects_content_mismatch_and_mid_read_metadata_change() {
    use std::os::unix::fs::PermissionsExt;
    let mut p = tempfile::NamedTempFile::new().unwrap();
    use std::io::Write;
    p.write_all(b"fixed").unwrap();
    p.as_file()
        .set_permissions(std::fs::Permissions::from_mode(0o600))
        .unwrap();
    let mut f = p.reopen().unwrap();
    assert!(stream_digest(
        &mut f,
        unsafe { libc::geteuid() },
        1024,
        &crate::fs::file::sha(b"different"),
        || Ok(()),
    )
    .is_err());

    let changed = p.path().to_path_buf();
    assert!(stream_digest(
        &mut f,
        unsafe { libc::geteuid() },
        1024,
        &crate::fs::file::sha(b"fixed"),
        || {
            std::fs::set_permissions(&changed, std::fs::Permissions::from_mode(0o400))?;
            Ok(())
        },
    )
    .is_err());
}
