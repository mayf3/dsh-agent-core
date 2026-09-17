use deployment_control_plane::bootstrap::{verify_loader_images, ClosureKind};
use std::collections::BTreeMap;
const NODE: &str = "/usr/local/libexec/agent-core/node-runtime/bin/node";
fn macho(loads: &[(u32, &str)]) -> Vec<u8> {
    let mut commands = Vec::new();
    for (cmd, name) in loads {
        let size = (24 + name.len() + 1 + 7) & !7;
        commands.extend(cmd.to_le_bytes());
        commands.extend((size as u32).to_le_bytes());
        commands.extend(24u32.to_le_bytes());
        commands.extend([0; 12]);
        commands.extend(name.as_bytes());
        commands.resize(commands.len() + size - 24 - name.len(), 0);
    }
    let mut b = Vec::new();
    for n in [
        0xfeedfacfu32,
        0x01000007,
        3,
        2,
        loads.len() as u32,
        commands.len() as u32,
        0,
        0,
    ] {
        b.extend(n.to_le_bytes());
    }
    b.extend(commands);
    b
}
#[test]
fn loader_rejects_transitive_homebrew_rpath_environment_and_wrong_architecture() {
    let lib = "/usr/local/libexec/agent-core/node-runtime/lib/libnode.141.dylib";
    let safe = BTreeMap::from([
        (NODE.into(), macho(&[(12, lib)])),
        (lib.into(), macho(&[(12, "/usr/lib/libc++.1.dylib")])),
    ]);
    verify_loader_images(ClosureKind::Runtime, &safe).unwrap();
    for name in [
        "/usr/local/opt/libuv/lib/libuv.1.dylib",
        "@rpath/libnode.141.dylib",
        "/usr/lib/../../tmp/evil",
        "/tmp/inject.dylib",
    ] {
        let mut images = safe.clone();
        images.insert(lib.into(), macho(&[(12, name)]));
        assert!(
            verify_loader_images(ClosureKind::Runtime, &images).is_err(),
            "unsafe transitive load accepted: {name}"
        );
    }
    for command in [0x8000001c, 0x27] {
        let mut images = safe.clone();
        images.insert(
            lib.into(),
            macho(&[(command, "DYLD_INSERT_LIBRARIES=/tmp/evil")]),
        );
        assert!(verify_loader_images(ClosureKind::Runtime, &images).is_err());
    }
    let mut wrong = safe.clone();
    wrong.get_mut(NODE).unwrap()[4..8].copy_from_slice(&0x0100000cu32.to_le_bytes());
    assert!(verify_loader_images(ClosureKind::Runtime, &wrong).is_err());
    let mut missing = safe.clone();
    missing.remove(lib);
    assert!(verify_loader_images(ClosureKind::Runtime, &missing).is_err());
    let mut extra = safe.clone();
    extra.insert("/tmp/unused".into(), macho(&[]));
    assert!(verify_loader_images(ClosureKind::Runtime, &extra).is_err());
    let mut truncated = safe.clone();
    truncated.insert(lib.into(), vec![0; 8]);
    assert!(verify_loader_images(ClosureKind::Runtime, &truncated).is_err());
}
use deployment_control_plane::{
    bootstrap::{generate, verify_bundle, verify_sources, Package},
    trust::digest,
};
use std::{fs, os::unix::fs::PermissionsExt, path::Path, process::Command};
fn sources() -> BTreeMap<String, String> {
    BTreeMap::from([
        (
            "packages/deployment-control-plane/src/lib.rs".into(),
            "a".repeat(64),
        ),
        (
            "packages/deployment-control-plane/Cargo.lock".into(),
            "b".repeat(64),
        ),
    ])
}
fn bundle() -> (tempfile::TempDir, String, String) {
    let d = tempfile::tempdir().unwrap();
    let root = d.path().canonicalize().unwrap();
    let mut controller = macho(&[(12, "/usr/lib/libSystem.B.dylib")]);
    if cfg!(target_arch = "aarch64") {
        controller[4..8].copy_from_slice(&0x0100000cu32.to_le_bytes());
    }
    let tools = [
        "/bin/launchctl",
        "/usr/bin/install",
        "/usr/bin/plutil",
        "/usr/bin/openssl",
        "/usr/bin/dscl",
        "/usr/sbin/dseditgroup",
    ]
    .into_iter()
    .map(|p| (p.into(), "d".repeat(64)))
    .collect();
    let s = digest(&sources()).unwrap();
    let h = generate(
        &root,
        &"b".repeat(40),
        sources(),
        &controller,
        &BTreeMap::from([(NODE.into(), macho(&[(12, "/usr/lib/libSystem.B.dylib")]))]),
        tools,
    )
    .unwrap();
    (d, h, s)
}
fn change(root: &Path, edit: impl FnOnce(&mut Package)) -> String {
    let p = root.join("manifest.json");
    let mut m: Package = serde_json::from_slice(&fs::read(&p).unwrap()).unwrap();
    edit(&mut m);
    fs::set_permissions(&p, fs::Permissions::from_mode(0o600)).unwrap();
    fs::write(p, serde_json::to_vec(&m).unwrap()).unwrap();
    digest(&m).unwrap()
}
#[test]
fn package_has_no_activation_or_secrets_and_parses_as_disabled_plist() {
    let (d, h, s) = bundle();
    let root = d.path().canonicalize().unwrap();
    let result = verify_bundle(&root, &h, &s).unwrap();
    assert!(result.integrity_verified);
    assert!(
        !result.bootstrap_ready,
        "fixture hashes/disabled profile must never imply readiness"
    );
    assert!(result.blockers.iter().any(|v| v.contains("ISSUER")));
    let p = Command::new("/usr/bin/plutil")
        .args(["-convert", "json", "-o", "-"])
        .arg(root.join("ai.agent-deployd.plist"))
        .output()
        .unwrap();
    assert!(p.status.success());
    let v: serde_json::Value = serde_json::from_slice(&p.stdout).unwrap();
    assert_eq!(v["Disabled"], true);
    assert_eq!(v["RunAtLoad"], false);
    assert_eq!(v["KeepAlive"], false);
    assert_eq!(
        v["ProgramArguments"],
        serde_json::json!(["/usr/local/libexec/agent-deployd/agent-deployd"])
    );
    assert!(!root.join("activation.json").exists());
    fs::write(root.join("private-key.json"), "fixture-unacceptable-secret").unwrap();
    assert!(verify_bundle(&root, &h, &s).is_err());
}
#[test]
fn package_rejects_source_binary_metadata_and_unallowlisted_target() {
    let (d, h, s) = bundle();
    let root = d.path().canonicalize().unwrap();
    assert!(verify_bundle(&root, &h, &"c".repeat(64)).is_err());
    assert!(verify_sources(&root, &root).is_err());
    let blob = root.join("payload-00");
    fs::set_permissions(&blob, fs::Permissions::from_mode(0o600)).unwrap();
    fs::write(&blob, b"changed binary").unwrap();
    assert!(verify_bundle(&root, &h, &s).is_err());
    for mutate in [0, 1, 2, 3, 4, 5, 6, 7, 8] {
        let (d, _, s) = bundle();
        let root = d.path().canonicalize().unwrap();
        let hash = change(&root, |p| match mutate {
            0 => p.profile.launchd_label = "com.evil.service".into(),
            1 => {
                p.profile.launchd_domain = "gui/502".into();
                p.profile.launchd_label = "com.svc-workflow".into();
                p.profile.enabled = true;
            }
            2 => p.transition_sudoers = "ALL ALL=(ALL) NOPASSWD: ALL".into(),
            3 => p.lifecycle_probes.clear(),
            4 => p.legacy_surfaces.pop().map(|_| ()).unwrap(),
            5 => p.layout[0].mode = 0o777,
            6 => p.issuers[0].public_key = Some("fixture".into()),
            7 => p.payloads[0].destination = "/tmp/evil".into(),
            _ => p.unresolved.clear(),
        });
        assert!(
            verify_bundle(&root, &hash, &s).is_err(),
            "unsafe package accepted: {mutate}"
        );
    }
    let (d, h, s) = bundle();
    let root = d.path().canonicalize().unwrap();
    fs::set_permissions(&root, fs::Permissions::from_mode(0o777)).unwrap();
    assert!(verify_bundle(&root, &h, &s).is_err());
    fs::set_permissions(&root, fs::Permissions::from_mode(0o700)).unwrap();
    fs::set_permissions(root.join("payload-00"), fs::Permissions::from_mode(0o666)).unwrap();
    assert!(verify_bundle(&root, &h, &s).is_err());
}
#[test]
fn fixed_apple_utility_accepts_os_protection_flags_but_rejects_hash_drift() {
    use sha2::{Digest, Sha256};
    let bytes = fs::read("/bin/launchctl").unwrap();
    deployment_control_plane::bootstrap::verify_platform_launchctl(&hex::encode(Sha256::digest(
        &bytes,
    )))
    .unwrap();
    assert!(
        deployment_control_plane::bootstrap::verify_platform_launchctl(&"0".repeat(64)).is_err()
    );
}
#[test]
fn plist_loader_environment_is_rejected_from_the_exact_supplied_bytes() {
    use deployment_control_plane::bootstrap::verify_service_plist;
    use sha2::{Digest, Sha256};
    let hash = hex::encode(Sha256::digest(fs::read("/usr/bin/plutil").unwrap()));
    let safe = serde_json::json!({"ProgramArguments":[NODE,"/protected/app.mjs"],"EnvironmentVariables":{"HOME":"/Users/authsvc","LOG_LEVEL":"info"}});
    assert_eq!(
        verify_service_plist(&serde_json::to_vec(&safe).unwrap(), &hash).unwrap(),
        safe
    );
    for key in [
        "NODE_OPTIONS",
        "NODE_PATH",
        "DYLD_LIBRARY_PATH",
        "DYLD_INSERT_LIBRARIES",
        "LD_PRELOAD",
        "OPENSSL_CONF",
        "OPENSSL_MODULES",
        "NODE_ICU_DATA",
    ] {
        let mut unsafe_plist = safe.clone();
        unsafe_plist["EnvironmentVariables"][key] = "test-private-value".into();
        assert!(
            verify_service_plist(&serde_json::to_vec(&unsafe_plist).unwrap(), &hash).is_err(),
            "accepted {key}"
        );
    }
    // XML entities must be parsed, not bypass a substring scanner.
    let xml=b"<?xml version=\"1.0\"?><plist version=\"1.0\"><dict><key>EnvironmentVariables</key><dict><key>NODE&#95;OPTIONS</key><string>inert-test</string></dict></dict></plist>";
    assert!(verify_service_plist(xml, &hash).is_err());
    assert!(verify_service_plist(b"invalid", &hash).is_err());
    assert!(verify_service_plist(&vec![0; 1024 * 1024 + 1], &hash).is_err());
    assert!(verify_service_plist(&serde_json::to_vec(&safe).unwrap(), &"0".repeat(64)).is_err());
}
#[test]
fn prospective_producer_scope_registers_and_unknown_host_is_explicit() {
    use deployment_control_plane::{
        model::{Catalog, Role, TrustedKey},
        queue::Queue,
    };
    let (d, h, s) = bundle();
    let root = d.path().canonicalize().unwrap();
    let p: Package =
        serde_json::from_slice(&fs::read(root.join("manifest.json")).unwrap()).unwrap();
    let producer = p.issuers.iter().find(|i| i.role == Role::Producer).unwrap();
    let catalog = Catalog {
        revision: "fixture-only".into(),
        profiles: BTreeMap::new(),
        keys: BTreeMap::from([(
            producer.proposed_key_id.clone(),
            TrustedKey {
                public_key: "not-used-for-signing".into(),
                role: Role::Producer,
                scopes: producer.scope.clone(),
            },
        )]),
    };
    let q = Queue::open(root.join("fixture-queue.db")).unwrap();
    q.register_producer(&catalog, &producer.proposed_key_id)
        .unwrap();
    // Remove no package files: use a fresh unmodified package for exact-inventory verification.
    let (d2, h2, s2) = bundle();
    let r = verify_bundle(&d2.path().canonicalize().unwrap(), &h2, &s2).unwrap();
    assert!(p.profile.host.starts_with("UNRESOLVED"));
    assert!(r.blockers.iter().any(|b| b.contains("HOST_IDENTITY")));
    assert!(!h.is_empty() && !s.is_empty());
}
