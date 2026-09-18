use super::{genesis_install::*, genesis_install_io as io, genesis_install_native as native, *};
use crate::{
    error::require,
    fs::secure::{validate, Dir},
    Error, Result,
};
use std::{
    collections::BTreeMap,
    os::unix::{fs::MetadataExt, process::CommandExt},
    path::Path,
    process::{Command, Stdio},
    time::{Duration, Instant},
};

fn attempt(grant: &GenesisOwnerGrant) -> Result<Dir> {
    let root = Dir::open(Path::new(native::JOURNAL_ROOT), 0)?;
    let dir = root.child(&grant.attempt_id)?;
    let original: GenesisOwnerGrant =
        serde_json::from_slice(&io::read(&dir, "owner-authorization.json", 65536)?)?;
    require(
        original.pins == grant.pins
            && original.host == grant.host
            && original.attempt_id == grant.attempt_id,
        "BOOTSTRAP_ATTEMPT_BINDING",
    )?;
    Ok(dir)
}
fn disabled() -> Result<()> {
    for name in ["activation.json", "daemon-activation.json"] {
        native::absent(&format!("{GENESIS_STATE_ROOT}/{name}"))?;
    }
    Ok(())
}
fn installed(grant: &GenesisOwnerGrant, pins: &GenesisPins) -> Result<Dir> {
    disabled()?;
    let dir = attempt(grant)?;
    let receipt: GenesisInstallReceipt =
        serde_json::from_slice(&io::read(&dir, "steps/installation.json", 65536)?)?;
    require(
        receipt.plan_digest == pins.plan_digest
            && !receipt.activation_allowed
            && receipt.state == "INSTALLED_DISABLED_PENDING_OWNER_LOGIN",
        "BOOTSTRAP_INSTALLATION_REQUIRED",
    )?;
    let config: crate::service::Configuration =
        io::protected_record(Path::new(&format!("{GENESIS_STATE_ROOT}/service.json")))?;
    require(
        config.catalog.profiles.values().all(|p| !p.enabled),
        "BOOTSTRAP_MUST_REMAIN_DISABLED",
    )?;
    Ok(dir)
}
fn arguments(
    action: &str,
    package: &Path,
    authorization: &Path,
    pins: &GenesisPins,
) -> Vec<String> {
    vec![
        action.into(),
        package.to_string_lossy().into(),
        authorization.to_string_lossy().into(),
        pins.plan_digest.clone(),
        pins.package_digest.clone(),
        pins.source_digest.clone(),
        pins.review_record_digest.clone(),
        pins.initial_registry_digest.clone(),
        pins.supervisor_policy_digest.clone(),
    ]
}
pub fn login_genesis_reviewer(
    package: &Path,
    authorization: &Path,
    pins: &GenesisPins,
) -> Result<serde_json::Value> {
    let (grant, _) = native::authorized(package, authorization, pins)?;
    let (_journals, _lock) = native::journal_lock()?;
    let dir = installed(&grant, pins)?;
    append(
        &dir,
        "login-intent.json",
        &serde_json::json!({"plan_digest":pins.plan_digest,
        "parent_pid":std::process::id(),"operation":"FIXED_REVIEWER_DEVICE_LOGIN"}),
    )?;
    let mut child = Command::new(native::RUNNER)
        .args(arguments("login-child", package, authorization, pins))
        .env_clear()
        .current_dir("/")
        .stdin(Stdio::inherit())
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .spawn()?;
    let start = Instant::now();
    let status = loop {
        if let Some(status) = child.try_wait()? {
            break status;
        }
        if start.elapsed() > Duration::from_secs(600) {
            let _ = child.kill();
            let _ = child.wait();
            return Err(Error::new("BOOTSTRAP_LOGIN_OUTCOME_UNKNOWN"));
        }
        std::thread::sleep(Duration::from_millis(50));
    };
    require(status.success(), "BOOTSTRAP_LOGIN_OUTCOME_UNKNOWN")?;
    let receipt = serde_json::json!({"plan_digest":pins.plan_digest,
        "state":"REVIEWER_DEVICE_LOGIN_COMMAND_COMPLETED","activation_allowed":false});
    append(&dir, "login-result.json", &receipt)?;
    Ok(receipt)
}
/// Fresh process only: drop privilege before exec, avoiding unsafe threaded pre_exec.
pub fn genesis_login_child(package: &Path, authorization: &Path, pins: &GenesisPins) -> Result<()> {
    let (grant, effects) = native::authorized(package, authorization, pins)?;
    let dir = installed(&grant, pins)?;
    let intent: serde_json::Value =
        serde_json::from_slice(&io::read(&dir, "login-intent.json", 65536)?)?;
    require(
        intent["parent_pid"].as_u64() == Some(unsafe { libc::getppid() } as u64)
            && intent["plan_digest"] == pins.plan_digest,
        "BOOTSTRAP_LOGIN_PARENT",
    )?;
    require(
        effects
            .plan
            .executables
            .get(crate::issuer::review::CODEX_PATH)
            == Some(&io::hash_protected(
                crate::issuer::review::CODEX_PATH,
                512 * 1024 * 1024,
            )?),
        "BOOTSTRAP_INSTALLED_DRIFT",
    )?;
    let home = Dir::open(Path::new(crate::issuer::review::REVIEW_HOME), 612)?;
    validate(&home.file, 612, true)?;
    require(
        home.file.metadata()?.mode() & 0o777 == 0o700 && home.file.metadata()?.gid() == 612,
        "UNSAFE_MODE",
    )?;
    require(
        unsafe { libc::setgroups(1, [612u32].as_ptr()) } == 0
            && unsafe { libc::setgid(612) } == 0
            && unsafe { libc::setuid(612) } == 0,
        "BOOTSTRAP_REVIEW_IDENTITY",
    )?;
    let error = Command::new(crate::issuer::review::CODEX_PATH)
        .args(["login", "--device-auth"])
        .env_clear()
        .env("HOME", crate::issuer::review::REVIEW_HOME)
        .env("CODEX_HOME", crate::issuer::review::REVIEW_HOME)
        .env("PATH", "/usr/bin:/bin")
        .current_dir(crate::issuer::review::REVIEW_HOME)
        .exec();
    Err(error.into())
}
pub fn rollback_genesis_files(
    package: &Path,
    authorization: &Path,
    pins: &GenesisPins,
) -> Result<serde_json::Value> {
    let (grant, effects) = native::authorized(package, authorization, pins)?;
    let (_journals, _lock) = native::journal_lock()?;
    disabled()?;
    let dir = attempt(&grant)?;
    let steps = dir.child("steps")?;
    let mut owned = BTreeMap::<String, String>::new();
    for name in steps.names()? {
        if name.ends_with("-result.json") {
            let record: serde_json::Value =
                serde_json::from_slice(&io::read(&steps, &name, 4 * 1024 * 1024)?)?;
            let files: BTreeMap<String, String> =
                serde_json::from_value(record["new_files"].clone())?;
            owned.extend(files);
        }
    }
    owned.retain(|path, _| {
        path != native::RUNNER
            && (effects.plan.executables.contains_key(path)
                || effects.plan.support_files.contains_key(path)
                || path == "/Library/LaunchDaemons/ai.agent-deployd.plist")
    });
    append(
        &dir,
        "rollback-intent.json",
        &serde_json::json!({"new_nonsecret_files":owned,"plan_digest":pins.plan_digest}),
    )?;
    for (path, hash) in owned.iter().rev() {
        let p = Path::new(path);
        let parent = Dir::open(p.parent().ok_or(Error::new("UNSAFE_PATH"))?, 0)?;
        remove_owned_file(&parent, p.file_name().unwrap().to_str().unwrap(), hash)?;
    }
    let receipt = serde_json::json!({"state":"KNOWN_NEW_FILES_REMOVED_RECONCILIATION_REQUIRED",
        "activation_allowed":false,"keys_journals_identities_locks_retained":true,"plan_digest":pins.plan_digest});
    append(&dir, "rollback-result.json", &receipt)?;
    Ok(receipt)
}
