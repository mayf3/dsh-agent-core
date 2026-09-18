use super::*;
use std::{
    fs,
    os::unix::fs::{symlink, PermissionsExt},
};

fn package() -> (tempfile::TempDir, GenesisPins) {
    let temp = private::temp();
    let (plan, pins, artifacts) = support::fixture();
    let mut files = BTreeMap::from([
        ("plan.json".to_string(), serde_json::to_vec(&plan).unwrap()),
        ("package.json".to_string(), artifacts.package_manifest),
        ("review-record".to_string(), artifacts.review_record),
        (
            "initial-registry.json".to_string(),
            artifacts.initial_registry,
        ),
        (
            "supervisor-policy.json".to_string(),
            artifacts.supervisor_policy,
        ),
    ]);
    for (prefix, entries) in [
        ("sources", artifacts.sources),
        ("executables", artifacts.executables),
        ("support", artifacts.support_files),
    ] {
        for (path, bytes) in entries {
            let suffix = if prefix == "sources" {
                path.as_str()
            } else {
                Path::new(&path).file_name().unwrap().to_str().unwrap()
            };
            files.insert(format!("{prefix}/{suffix}"), bytes);
        }
    }
    for (path, bytes) in files {
        let path = temp.path().join(path);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(&path, bytes).unwrap();
        fs::set_permissions(path, fs::Permissions::from_mode(0o600)).unwrap();
    }
    (temp, pins)
}

#[test]
fn package_loader_reads_exact_bytes_and_rejects_unlisted_files() {
    let (temp, pins) = package();
    let (plan, artifacts) = load_genesis_package(temp.path(), &pins).unwrap();
    assert!(
        verify_genesis_artifacts(&plan, &pins, &artifacts)
            .unwrap()
            .plan_ready
    );
    fs::write(temp.path().join("extra"), b"extra").unwrap();
    assert_eq!(
        load_genesis_package(temp.path(), &pins).unwrap_err().code(),
        "UNDECLARED_PACKAGE_FILE"
    );
}

#[test]
fn package_loader_rejects_symbolic_hardlinks_and_writable_payloads() {
    for mutation in 0..3 {
        let (temp, pins) = package();
        let target = temp.path().join("executables/codex");
        match mutation {
            0 => {
                fs::rename(&target, temp.path().join("outside")).unwrap();
                symlink(temp.path().join("outside"), target).unwrap();
            }
            1 => fs::hard_link(&target, temp.path().join("duplicate")).unwrap(),
            _ => fs::set_permissions(&target, fs::Permissions::from_mode(0o666)).unwrap(),
        }
        assert!(load_genesis_package(temp.path(), &pins).is_err());
    }
}
