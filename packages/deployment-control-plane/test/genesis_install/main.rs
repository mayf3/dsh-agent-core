use super::*;
use crate::{common::private, fs::file::sha};
mod package_io;
#[path = "../genesis/support.rs"]
mod support;

fn authorization(pins: &GenesisPins) -> GenesisOwnerGrant {
    GenesisOwnerGrant {
        version: 1,
        owner: "mayf3".into(),
        method: GenesisAuthorizationMethod::ExternalExactPackageAuthorization,
        scope: GenesisAuthorizationScope::DisabledInstallationOnly,
        pins: pins.clone(),
        host: "fixture-host".into(),
        attempt_id: "fixture-attempt-1".into(),
        issued_at: 100,
        expires_at: 200,
    }
}

#[test]
fn generated_configuration_resolves_each_accepted_verification_profile() {
    use crate::bootstrap::genesis_install_native::generated_configuration;
    use crate::service::{Configuration, VerifierBinding};
    let mut catalog = crate::common::fixture_catalog();
    let mut profile = catalog.profiles.remove("fixture").unwrap();
    profile.enabled = false;
    profile.verification_profiles = vec!["native-installed-readback-v1".into()];
    profile.goal_verifiers = BTreeMap::from([(
        "native-installed-readback-v1".into(),
        "local-verifier".into(),
    )]);
    catalog.profiles.insert("dsh-app".into(), profile);
    // Use exactly the generator serialized by the native service.json writer.
    let bytes = canonical_bytes(&generated_configuration(catalog)).unwrap();
    let config: Configuration = serde_json::from_slice(&bytes).unwrap();
    let installed_profile = &config.catalog.profiles["dsh-app"];
    assert!(!installed_profile.enabled);
    for verification in &installed_profile.verification_profiles {
        match config.verifiers.get(verification) {
            Some(VerifierBinding::NativeInstalledReadback { issuer }) => {
                assert_eq!(issuer, &installed_profile.goal_verifiers[verification]);
            }
            _ => panic!("VERIFIER_NOT_CONFIGURED for {verification}"),
        }
    }
    assert!(!config.verifiers.contains_key("local-verifier"));
}

#[test]
fn rejects_wrong_owner_expiry_host_and_pin_before_effect() {
    let (plan, pins, _) = support::fixture();
    for change in 0..5 {
        let mut grant = authorization(&pins);
        match change {
            0 => grant.owner = "agent".into(),
            1 => grant.expires_at = 120,
            2 => grant.host = "other-host".into(),
            3 => grant.pins.package_digest = "00".repeat(32),
            _ => grant.issued_at = 160,
        }
        assert!(validate_genesis_grant(&plan, &pins, &grant, "fixture-host", 150).is_err());
    }
}

#[test]
fn rejects_noncomponent_attempt_before_any_journal() {
    let (plan, pins, _) = support::fixture();
    for id in ["..", "nested/attempt", "bad:attempt"] {
        let mut grant = authorization(&pins);
        grant.attempt_id = id.into();
        assert!(validate_genesis_grant(&plan, &pins, &grant, "fixture-host", 150).is_err());
    }
}

#[test]
fn numeric_identity_census_rejects_name_id_and_ambiguous_caller_collisions() {
    use crate::bootstrap::genesis_install_census::validate_identities;
    assert_eq!(
        validate_identities("owner 502\nruntime 505", "staff 20\nruntime 601").unwrap(),
        "owner"
    );
    for users in [
        "owner 502\n_dcp_review 999",
        "owner 502\nforeign 612",
        "one 502\ntwo 502",
        "malformed",
    ] {
        assert!(validate_identities(users, "staff 20").is_err());
    }
    for groups in ["foreign 602", "foreign 612", "_agentdeploy 999"] {
        assert!(validate_identities("owner 502", groups).is_err());
    }
}

#[test]
fn native_entry_refuses_nonroot_before_reading_inputs() {
    private::nonroot();
    let (_, pins, _) = support::fixture();
    assert_eq!(
        install_genesis_native(
            Path::new("/must-not-open"),
            Path::new("/must-not-open"),
            &pins
        )
        .unwrap_err()
        .code(),
        "ROOT_REQUIRED"
    );
}

#[test]
fn fixture_executes_durable_typed_steps_without_native_calls() {
    let tmp = private::temp();
    let root = crate::fs::FixtureRoots::open(tmp.path()).unwrap();
    let journal = root.root.mkdir("journal").unwrap();
    let mut effects = FixtureEffects::new(&root.root);
    let receipt = execute_steps(&journal, &mut effects, "fixture-plan", None).unwrap();
    assert_eq!(receipt.state, "INSTALLED_DISABLED_PENDING_OWNER_LOGIN");
    assert!(!receipt.activation_allowed);
    assert_eq!(
        crate::bootstrap::genesis_install_census::NATIVE_COMMAND_CALLS
            .load(std::sync::atomic::Ordering::SeqCst),
        0
    );
    assert_eq!(
        journal.names().unwrap().len(),
        1 + 2 * InstallStep::ALL.len()
    );
    assert!(tmp.path().join("files/agent-deployd").is_file());
}

#[test]
fn incomplete_intent_is_quarantined_and_never_replayed() {
    let tmp = private::temp();
    let root = crate::fs::FixtureRoots::open(tmp.path()).unwrap();
    let journal = root.root.mkdir("journal").unwrap();
    let mut effects = FixtureEffects::new(&root.root);
    assert_eq!(
        execute_steps(&journal, &mut effects, "fixture-plan", Some(2))
            .unwrap_err()
            .code(),
        "BOOTSTRAP_OUTCOME_UNKNOWN"
    );
    let performed = effects.steps.len();
    assert_eq!(
        execute_steps(&journal, &mut effects, "fixture-plan", None)
            .unwrap_err()
            .code(),
        "BOOTSTRAP_ATTEMPT_EXISTS"
    );
    assert_eq!(performed, effects.steps.len());
    assert!(tmp.path().join("journal/004-intent.json").is_file());
    assert!(!tmp.path().join("journal/005-result.json").exists());
}

#[test]
fn rollback_only_removes_exact_recorded_new_nonsecret_files() {
    let tmp = private::temp();
    let root = crate::fs::FixtureRoots::open(tmp.path()).unwrap();
    let files = root.root.mkdir("files").unwrap();
    write_new(
        &files,
        "owned",
        b"owned",
        files.uid,
        unsafe { libc::getegid() },
        0o600,
    )
    .unwrap();
    write_new(
        &files,
        "foreign",
        b"foreign",
        files.uid,
        unsafe { libc::getegid() },
        0o600,
    )
    .unwrap();
    remove_owned_file(&files, "owned", &sha(b"owned")).unwrap();
    assert_eq!(
        remove_owned_file(&files, "foreign", &sha(b"wrong"))
            .unwrap_err()
            .code(),
        "BOOTSTRAP_ROLLBACK_DRIFT"
    );
    assert!(tmp.path().join("files/foreign").is_file());
}
