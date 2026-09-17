use deployment_control_plane::fs::{FixtureRoots, MutationGuard};
use std::fs;
use std::os::unix::fs::PermissionsExt;

#[test]
fn fixture_retains_directory_and_rejects_symlink_root() {
    let tmp = tempfile::tempdir().unwrap();
    let path = fs::canonicalize(tmp.path()).unwrap();
    fs::set_permissions(
        &path,
        <std::fs::Permissions as std::os::unix::fs::PermissionsExt>::from_mode(0o700),
    )
    .unwrap();
    let roots = FixtureRoots::open(&path).unwrap();
    let guard = roots.lock().unwrap();
    assert!(
        roots.lock().is_err(),
        "the same process cannot bypass the OS mutex"
    );
    drop(guard);
    assert!(roots.lock().is_ok());
    let alias = path.join("alias");
    std::os::unix::fs::symlink(&path, &alias).unwrap();
    assert!(FixtureRoots::open(&alias).is_err());
}

#[test]
fn fixture_rejects_writable_or_acl_root() {
    let tmp = tempfile::tempdir().unwrap();
    let path = fs::canonicalize(tmp.path()).unwrap();
    fs::set_permissions(
        &path,
        <std::fs::Permissions as std::os::unix::fs::PermissionsExt>::from_mode(0o700),
    )
    .unwrap();
    fs::set_permissions(&path, fs::Permissions::from_mode(0o777)).unwrap();
    assert!(FixtureRoots::open(&path).is_err());
}

#[test]
fn lock_type_is_owned_not_a_string() {
    fn assert_send<T: Send>() {}
    assert_send::<MutationGuard>();
}

use deployment_control_plane::fs::{ArtifactEntry, ArtifactManifest};
use deployment_control_plane::trust::digest;
use sha2::{Digest, Sha256};
fn bundle(path: &std::path::Path, entries: Vec<ArtifactEntry>) -> (String, String) {
    let manifest = ArtifactManifest {
        version: 1,
        entries,
    };
    let bytes = serde_json::to_vec(&manifest).unwrap();
    let artifact = hex::encode(Sha256::digest(&bytes));
    let folder = path.join("staging").join(&artifact);
    fs::create_dir_all(&folder).unwrap();
    fs::write(folder.join("manifest.json"), bytes).unwrap();
    for e in &manifest.entries {
        fs::write(folder.join(&e.blob), b"new code").unwrap();
    }
    (artifact, digest(&manifest).unwrap())
}
fn entry(path: &str) -> ArtifactEntry {
    ArtifactEntry {
        path: path.into(),
        blob: "payload".into(),
        sha256: hex::encode(Sha256::digest(b"new code")),
        size: 8,
        executable: false,
    }
}
#[test]
fn real_bundle_seals_and_rehashes_exact_opened_bytes() {
    let tmp = tempfile::tempdir().unwrap();
    let path = fs::canonicalize(tmp.path()).unwrap();
    fs::set_permissions(
        &path,
        <std::fs::Permissions as std::os::unix::fs::PermissionsExt>::from_mode(0o700),
    )
    .unwrap();
    let roots = FixtureRoots::open(&path).unwrap();
    let store = roots.artifacts().unwrap();
    let (a, m) = bundle(&path, vec![entry("main.js")]);
    let sealed = store.import(&a, &m).unwrap();
    assert_eq!(sealed.read("main.js").unwrap(), b"new code");
    fs::write(path.join("staging").join(a).join("payload"), b"attacker").unwrap();
    assert_eq!(sealed.read("main.js").unwrap(), b"new code");
}
#[test]
fn bundle_rejects_escape_collision_extra_missing_and_oversize() {
    for bad in ["/escape", "../escape", "a/../escape", "é.js", "a//b"] {
        let tmp = tempfile::tempdir().unwrap();
        let path = fs::canonicalize(tmp.path()).unwrap();
        fs::set_permissions(
            &path,
            <std::fs::Permissions as std::os::unix::fs::PermissionsExt>::from_mode(0o700),
        )
        .unwrap();
        let roots = FixtureRoots::open(&path).unwrap();
        let store = roots.artifacts().unwrap();
        let (a, m) = bundle(&path, vec![entry(bad)]);
        assert!(store.import(&a, &m).is_err(), "{bad}");
    }
    for variant in 0..5 {
        let tmp = tempfile::tempdir().unwrap();
        let path = fs::canonicalize(tmp.path()).unwrap();
        fs::set_permissions(
            &path,
            <std::fs::Permissions as std::os::unix::fs::PermissionsExt>::from_mode(0o700),
        )
        .unwrap();
        let roots = FixtureRoots::open(&path).unwrap();
        let store = roots.artifacts().unwrap();
        let mut entries = vec![entry("main.js")];
        if variant == 0 {
            let mut second = entry("MAIN.js");
            second.blob = "second".into();
            entries.push(second);
        }
        if variant == 4 {
            entries[0].size = 64 * 1024 * 1024 + 1;
        }
        let (a, m) = bundle(&path, entries);
        let dir = path.join("staging").join(&a);
        match variant {
            1 => fs::write(dir.join("extra"), b"extra").unwrap(),
            2 => fs::remove_file(dir.join("payload")).unwrap(),
            3 => {
                fs::remove_file(dir.join("payload")).unwrap();
                std::os::unix::fs::symlink("/etc/passwd", dir.join("payload")).unwrap();
            }
            _ => (),
        }
        assert!(store.import(&a, &m).is_err(), "variant {variant}");
    }
}

#[test]
fn rejects_real_acl_hardlink_fifo_and_writable_payload() {
    for variant in 0..4 {
        let tmp = tempfile::tempdir().unwrap();
        let path = fs::canonicalize(tmp.path()).unwrap();
        fs::set_permissions(
            &path,
            <std::fs::Permissions as std::os::unix::fs::PermissionsExt>::from_mode(0o700),
        )
        .unwrap();
        let roots = FixtureRoots::open(&path).unwrap();
        let store = roots.artifacts().unwrap();
        let (a, m) = bundle(&path, vec![entry("main.js")]);
        let payload = path.join("staging").join(a).join("payload");
        match variant {
            0 => {
                assert!(std::process::Command::new("/bin/chmod")
                    .args(["+a", "everyone allow write"])
                    .arg(&payload)
                    .status()
                    .unwrap()
                    .success());
            }
            1 => fs::hard_link(&payload, path.join("outside-hardlink")).unwrap(),
            2 => {
                fs::remove_file(&payload).unwrap();
                let c = std::ffi::CString::new(payload.to_str().unwrap()).unwrap();
                assert_eq!(unsafe { libc::mkfifo(c.as_ptr(), 0o600) }, 0);
            }
            3 => fs::set_permissions(&payload, fs::Permissions::from_mode(0o666)).unwrap(),
            _ => unreachable!(),
        }
        assert!(
            store
                .import(
                    payload
                        .parent()
                        .unwrap()
                        .file_name()
                        .unwrap()
                        .to_str()
                        .unwrap(),
                    &m
                )
                .is_err(),
            "variant {variant}"
        );
    }
}

#[test]
fn target_reads_reject_xattrs_and_preserve_external_symlink_sentinel() {
    let tmp = tempfile::tempdir().unwrap();
    let path = fs::canonicalize(tmp.path()).unwrap();
    fs::set_permissions(
        &path,
        <std::fs::Permissions as std::os::unix::fs::PermissionsExt>::from_mode(0o700),
    )
    .unwrap();
    let roots = FixtureRoots::open(&path).unwrap();
    let target = roots.target().unwrap();
    fs::write(path.join("sentinel"), b"outside").unwrap();
    std::os::unix::fs::symlink(&path, path.join("target/escape")).unwrap();
    assert!(target.read("escape/sentinel").is_err());
    assert_eq!(fs::read(path.join("sentinel")).unwrap(), b"outside");
    let file = path.join("target/metadata");
    fs::write(&file, b"data").unwrap();
    assert!(std::process::Command::new("/usr/bin/xattr")
        .args(["-w", "com.dcp.fixture", "unexpected"])
        .arg(&file)
        .status()
        .unwrap()
        .success());
    assert!(
        target.read("metadata").is_err(),
        "unknown extended metadata cannot silently disappear on rollback"
    );
}

#[test]
fn every_nested_target_ancestor_is_descriptor_checked() {
    for depth in 0..3 {
        let tmp = tempfile::tempdir().unwrap();
        let path = fs::canonicalize(tmp.path()).unwrap();
        fs::set_permissions(
            &path,
            <std::fs::Permissions as std::os::unix::fs::PermissionsExt>::from_mode(0o700),
        )
        .unwrap();
        let roots = FixtureRoots::open(&path).unwrap();
        let target = roots.target().unwrap();
        let mut parent = path.join("target");
        let mut parts = Vec::new();
        for level in 0..depth {
            let name = format!("p{level}");
            parent = parent.join(&name);
            fs::create_dir(&parent).unwrap();
            parts.push(name);
        }
        fs::write(path.join("sentinel"), b"unchanged").unwrap();
        std::os::unix::fs::symlink(&path, parent.join("link")).unwrap();
        parts.push("link".into());
        parts.push("sentinel".into());
        assert!(target.read(&parts.join("/")).is_err());
        assert_eq!(fs::read(path.join("sentinel")).unwrap(), b"unchanged");
    }
}
#[test]
fn payload_replacement_during_hash_cannot_change_sealed_bytes() {
    use std::sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    };
    let tmp = tempfile::tempdir().unwrap();
    let path = fs::canonicalize(tmp.path()).unwrap();
    fs::set_permissions(
        &path,
        <std::fs::Permissions as std::os::unix::fs::PermissionsExt>::from_mode(0o700),
    )
    .unwrap();
    let roots = FixtureRoots::open(&path).unwrap();
    let store = roots.artifacts().unwrap();
    let (a, m) = bundle(&path, vec![entry("main.js")]);
    let payload = path.join("staging").join(&a).join("payload");
    let stop = Arc::new(AtomicBool::new(false));
    let worker_stop = stop.clone();
    let worker = std::thread::spawn(move || {
        while !worker_stop.load(Ordering::SeqCst) {
            fs::write(&payload, b"attacker").unwrap();
            fs::write(&payload, b"new code").unwrap();
        }
    });
    let result = store.import(&a, &m);
    stop.store(true, Ordering::SeqCst);
    worker.join().unwrap();
    if let Ok(sealed) = result {
        assert_eq!(sealed.read("main.js").unwrap(), b"new code");
    }
}

#[test]
fn multiprocess_lock_worker() {
    let Ok(root) = std::env::var("DCP_LOCK_TEST_ROOT") else {
        return;
    };
    let roots = FixtureRoots::open(std::path::Path::new(&root)).unwrap();
    let _guard = roots.lock().unwrap();
    let intent = std::path::Path::new(&root).join("holder-intent");
    fs::write(&intent, b"durable nonterminal intent").unwrap();
    fs::File::open(&intent).unwrap().sync_all().unwrap();
    std::thread::sleep(std::time::Duration::from_secs(30));
}
#[test]
fn killed_holder_releases_kernel_lock_without_unlinking_inode_or_intent() {
    use std::os::unix::fs::MetadataExt;
    let tmp = tempfile::tempdir().unwrap();
    let path = fs::canonicalize(tmp.path()).unwrap();
    fs::set_permissions(
        &path,
        <std::fs::Permissions as std::os::unix::fs::PermissionsExt>::from_mode(0o700),
    )
    .unwrap();
    let roots = FixtureRoots::open(&path).unwrap();
    let mut child = std::process::Command::new(std::env::current_exe().unwrap())
        .args(["--exact", "multiprocess_lock_worker"])
        .env("DCP_LOCK_TEST_ROOT", &path)
        .stdout(std::process::Stdio::null())
        .spawn()
        .unwrap();
    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(5);
    while !path.join("holder-intent").exists() && std::time::Instant::now() < deadline {
        std::thread::sleep(std::time::Duration::from_millis(10));
    }
    assert!(path.join("holder-intent").exists());
    assert_eq!(roots.lock().err().unwrap().code(), "MUTEX_BUSY");
    let inode = fs::metadata(path.join("production.lock")).unwrap().ino();
    child.kill().unwrap();
    child.wait().unwrap();
    let _guard = roots.lock().unwrap();
    assert_eq!(
        fs::metadata(path.join("production.lock")).unwrap().ino(),
        inode
    );
    assert_eq!(
        fs::read(path.join("holder-intent")).unwrap(),
        b"durable nonterminal intent"
    );
}

#[test]
fn sealed_cas_remains_available_after_untrusted_staging_disappears() {
    let tmp = tempfile::tempdir().unwrap();
    let path = fs::canonicalize(tmp.path()).unwrap();
    fs::set_permissions(
        &path,
        <std::fs::Permissions as std::os::unix::fs::PermissionsExt>::from_mode(0o700),
    )
    .unwrap();
    let roots = FixtureRoots::open(&path).unwrap();
    let store = roots.artifacts().unwrap();
    let (a, m) = bundle(&path, vec![entry("main.js")]);
    store.import(&a, &m).unwrap();
    fs::remove_dir_all(path.join("staging").join(&a)).unwrap();
    assert_eq!(
        store.import(&a, &m).unwrap().read("main.js").unwrap(),
        b"new code"
    );
}
