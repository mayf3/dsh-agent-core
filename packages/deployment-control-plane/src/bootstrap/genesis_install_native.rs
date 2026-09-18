use super::{genesis_install::*, genesis_install_census as census, genesis_install_io as io, *};
use crate::{
    error::require,
    fs::{
        file::{sha, write_new},
        secure::{validate, Dir},
    },
    issuer::custody,
    model::*,
    registry::{Enrollment, Registry},
    service::{Caller, Configuration, VerifierBinding},
    trust::{canonical_bytes, digest},
    Error, Result,
};
use std::{
    collections::BTreeMap,
    ffi::CString,
    fs::File,
    os::{fd::AsRawFd, unix::fs::MetadataExt},
    path::Path,
    time::{SystemTime, UNIX_EPOCH},
};

pub(super) const RUNNER: &str = "/usr/local/libexec/agent-deployd/agent-deploy-bootstrap";
pub(super) const JOURNAL_ROOT: &str = "/private/var/db/agent-deploy-bootstrap";
const PLIST: &[u8] = super::bundle::PLIST.as_bytes();
const STATE_DIRS: &[&str] = &[
    "registry",
    "issuer-jobs",
    "intake",
    "staging",
    "sealed",
    "transactions",
    "recovery-requests",
    "admitted",
    "requests",
    "closure",
];

pub(super) struct NativeEffects {
    pub plan: GenesisPlan,
    pub assets: GenesisArtifacts,
    pub policy: GenesisInstallPolicy,
    caller: String,
    catalog: Option<Catalog>,
    services: BTreeMap<String, String>,
    sudoers: BTreeMap<String, String>,
    created_files: BTreeMap<String, String>,
}
pub(super) fn authorized(
    package: &Path,
    authorization: &Path,
    pins: &GenesisPins,
) -> Result<(GenesisOwnerGrant, NativeEffects)> {
    require(unsafe { libc::geteuid() } == 0, "ROOT_REQUIRED")?;
    let (plan, assets) = load_genesis_package(package, pins)?;
    let grant: GenesisOwnerGrant = io::protected_record(authorization)?;
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|_| Error::new("CLOCK"))?
        .as_secs();
    let host = observed_host()?;
    validate_genesis_grant(&plan, pins, &grant, &host, now)?;
    require(
        std::env::current_exe()? == Path::new(RUNNER),
        "BOOTSTRAP_INSTALLED_RUNNER_REQUIRED",
    )?;
    require(
        plan.executables.get(RUNNER) == Some(&io::hash_protected(RUNNER, 512 * 1024 * 1024)?),
        "BOOTSTRAP_RUNNER_DRIFT",
    )?;
    let policy: GenesisInstallPolicy = serde_json::from_slice(&assets.supervisor_policy)?;
    validate_policy(&policy, &plan, &host)?;
    let initial: Vec<Enrollment> = serde_json::from_slice(&assets.initial_registry)?;
    require(
        initial.len() == 1
            && initial[0].owner == "mayf3"
            && initial[0].producer_id == "local-deployment-registry"
            && initial[0].deployment_profile == "dsh-app"
            && initial[0].repo == policy.profile.repo
            && initial[0].target_runtime == policy.profile.target_runtime
            && initial[0].authority.source.sha256
                == policy.issuer_policy.source.accepted_contract_sha256,
        "BOOTSTRAP_REGISTRY_SCOPE",
    )?;
    Ok((
        grant,
        NativeEffects {
            plan,
            assets,
            policy,
            caller: String::new(),
            catalog: None,
            services: BTreeMap::new(),
            sudoers: BTreeMap::new(),
            created_files: BTreeMap::new(),
        },
    ))
}
pub(super) fn install(
    package: &Path,
    authorization: &Path,
    pins: &GenesisPins,
) -> Result<GenesisInstallReceipt> {
    let (grant, mut effects) = authorized(package, authorization, pins)?;
    unsafe { libc::umask(0o077) };
    let (journals, _lock) = journal_lock()?;
    require(
        journals.names()? == vec!["bootstrap.lock"],
        "BOOTSTRAP_PRIOR_ATTEMPT_REQUIRES_RECONCILIATION",
    )?;
    effects.preflight()?;
    let attempt = make(&format!("{JOURNAL_ROOT}/{}", grant.attempt_id), 0, 0, 0o700)?;
    append(&attempt, "owner-authorization.json", &grant)?;
    append(
        &attempt,
        "preflight.json",
        &serde_json::json!({"sudoers":effects.sudoers,
        "existing_system_plists":effects.services,"new_targets":"ABSENT",
        "existing_tasks_mutated":false,"socket_parent":"DEFERRED_UNTIL_ACTIVATION"}),
    )?;
    let steps = attempt.mkdir("steps")?;
    execute_steps(&steps, &mut effects, &pins.plan_digest, None)
}
pub(super) fn journal_lock() -> Result<(Dir, File)> {
    let parent = Dir::open(Path::new("/private/var/db"), 0)?;
    let dir = parent.mkdir("agent-deploy-bootstrap")?;
    require(dir.file.metadata()?.mode() & 0o777 == 0o700, "UNSAFE_MODE")?;
    let lock = match dir.open_file("bootstrap.lock", libc::O_RDWR, 0) {
        Ok(file) => file,
        Err(e) if e.code() == "ABSENT" => write_new(&dir, "bootstrap.lock", b"", 0, 0, 0o600)?,
        Err(e) => return Err(e),
    };
    validate(&lock, 0, false)?;
    require(lock.metadata()?.mode() & 0o777 == 0o600, "UNSAFE_MODE")?;
    require(
        unsafe { libc::flock(lock.as_raw_fd(), libc::LOCK_EX | libc::LOCK_NB) } == 0,
        "BOOTSTRAP_BUSY",
    )?;
    Ok((dir, lock))
}
pub(crate) fn validate_policy(
    policy: &GenesisInstallPolicy,
    plan: &GenesisPlan,
    host: &str,
) -> Result<()> {
    let p = &policy.profile;
    require(
        !p.enabled
            && p.repo == "mayf3/dsh-agent-core"
            && p.host == host
            && p.target_runtime == "dsh-system-runtime"
            && p.launchd_domain == "system"
            && p.launchd_label == "ai.agent-core.runtime"
            && p.install_root_id == "agent-core-app"
            && p.architecture == "x86_64"
            && p.verification_profiles == ["native-installed-readback-v1"]
            && p.standing_authority_revision == "PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1"
            && p.goal_verifiers
                == BTreeMap::from([(
                    "native-installed-readback-v1".into(),
                    "local-verifier".into(),
                )]),
        "BOOTSTRAP_DISABLED_PROFILE_REQUIRED",
    )?;
    require(
        policy.issuer_policy.version == 1
            && policy.issuer_policy.policy_epoch == 1
            && plan.executables.get(crate::issuer::review::CODEX_PATH)
                == Some(&policy.issuer_policy.codex_sha256)
            && plan
                .executables
                .get("/usr/local/libexec/agent-deployd/agent-deploy-issuer")
                == Some(&policy.issuer_policy.review_helper_sha256)
            && policy.platform_tools.len() == 2
            && policy.platform_tools.contains_key(census::DSCL)
            && policy.platform_tools.contains_key(census::GROUP),
        "BOOTSTRAP_SUPERVISOR_POLICY",
    )?;
    policy.issuer_policy.source.validate()?;
    for hash in policy.platform_tools.values() {
        crate::trust::valid_digest(hash)?;
    }
    Ok(())
}
impl NativeEffects {
    fn preflight(&mut self) -> Result<()> {
        let code = Dir::open(Path::new(GENESIS_CODE_ROOT), 0)?;
        require(
            code.names()? == vec!["agent-deploy-bootstrap"],
            "BOOTSTRAP_UNEXPECTED_PREIMAGE",
        )?;
        for path in [
            &self.plan.paths.state_root,
            &self.plan.paths.reviewer_home,
            &self.plan.paths.reviewer_workspace,
            &self.plan.paths.plist,
        ] {
            absent(path)?;
        }
        self.caller = census::identity_census(&self.policy)?;
        self.services = census::service_census()?;
        self.sudoers = census::sudoers_census()?;
        Ok(())
    }
    fn directories(&mut self) -> Result<()> {
        let root = make(GENESIS_STATE_ROOT, 0, 0, 0o700)?;
        for name in STATE_DIRS {
            root.mkdir(name)?;
        }
        let intake = root.child("intake")?;
        for name in [
            "proposals",
            "snapshots",
            "policies",
            "results",
            "acks",
            "recovery",
        ] {
            intake.mkdir(name)?;
        }
        for name in [
            "daemon.lock",
            "production.lock",
            "publication.lock",
            "issuer.lock",
            "policy.lock",
        ] {
            write_new(&root, name, b"", 0, 0, 0o600)?;
        }
        make(&self.plan.paths.reviewer_home, 612, 612, 0o700)?;
        make(&self.plan.paths.reviewer_workspace, 0, 0, 0o755)?;
        Ok(())
    }
    fn identities(&self) -> Result<()> {
        let run = |args: &[&str]| census::command(&self.policy, census::DSCL, args).map(|_| ());
        for (name, gid) in [("_dcp_review", "612"), ("_agentdeploy", "602")] {
            let path = format!("/Groups/{name}");
            run(&[".", "-create", &path])?;
            run(&[".", "-create", &path, "PrimaryGroupID", gid])?;
            run(&[".", "-create", &path, "Password", "*"])?;
        }
        for (property, value) in [
            ("UniqueID", "612"),
            ("PrimaryGroupID", "612"),
            ("UserShell", "/usr/bin/false"),
            ("NFSHomeDirectory", self.plan.paths.reviewer_home.as_str()),
            ("Password", "*"),
            ("IsHidden", "1"),
        ] {
            run(&[".", "-create", "/Users/_dcp_review", property, value])?;
        }
        census::command(
            &self.policy,
            census::GROUP,
            &[
                "-o",
                "edit",
                "-a",
                &self.caller,
                "-t",
                "user",
                "_agentdeploy",
            ],
        )?;
        Ok(())
    }
    fn write(&mut self, path: &str, bytes: &[u8], mode: u32) -> Result<()> {
        let p = Path::new(path);
        let parent = Dir::open(p.parent().ok_or(Error::new("UNSAFE_PATH"))?, 0)?;
        write_new(
            &parent,
            p.file_name()
                .and_then(|n| n.to_str())
                .ok_or(Error::new("UNSAFE_PATH"))?,
            bytes,
            0,
            0,
            mode,
        )?;
        self.created_files.insert(path.into(), sha(bytes));
        Ok(())
    }
    fn payloads(&mut self) -> Result<()> {
        for (path, bytes) in self.assets.executables.clone() {
            if path != RUNNER {
                self.write(&path, &bytes, 0o555)?;
            }
        }
        for (path, bytes) in self.assets.support_files.clone() {
            self.write(&path, &bytes, 0o444)?;
        }
        self.verify_files()
    }
    fn registry(&self) -> Result<()> {
        let catalog = self
            .catalog
            .as_ref()
            .ok_or(Error::new("BOOTSTRAP_CUSTODY_MISSING"))?;
        let entries: Vec<Enrollment> = serde_json::from_slice(&self.assets.initial_registry)?;
        require(entries.len() == 1, "BOOTSTRAP_REGISTRY_SCOPE")?;
        let root = Dir::open(Path::new(GENESIS_STATE_ROOT), 0)?;
        let key = custody::load(
            &root.child("issuer-keys")?,
            "local-authority",
            Role::Authority,
            catalog,
        )?;
        let registry = Registry::open_native(catalog)?;
        let signed = custody::sign("local-authority", &key, entries[0].clone())?;
        let row = registry.enroll(&signed)?;
        require(
            row.state == crate::registry::DeploymentState::Pending && !row.business_goal_complete,
            "BOOTSTRAP_REGISTRY_SCOPE",
        )?;
        Ok(())
    }
    fn configuration(&mut self) -> Result<()> {
        let catalog = self
            .catalog
            .clone()
            .ok_or(Error::new("BOOTSTRAP_CUSTODY_MISSING"))?;
        let config = generated_configuration(catalog);
        self.write(
            &format!("{GENESIS_STATE_ROOT}/service.json"),
            &canonical_bytes(&config)?,
            0o600,
        )?;
        self.write(
            &format!("{GENESIS_STATE_ROOT}/issuer-policy.json"),
            &canonical_bytes(&self.policy.issuer_policy)?,
            0o600,
        )?;
        self.write(
            &format!("{GENESIS_STATE_ROOT}/bootstrap-plan.json"),
            &canonical_bytes(&self.plan)?,
            0o600,
        )?;
        self.write(
            "/Library/LaunchDaemons/ai.agent-deployd.plist",
            PLIST,
            0o644,
        )?;
        Ok(())
    }
    fn verify_files(&self) -> Result<()> {
        for (path, hash) in self
            .created_files
            .iter()
            .chain(self.plan.executables.iter())
        {
            require(
                io::hash_protected(path, 512 * 1024 * 1024)? == *hash,
                "BOOTSTRAP_INSTALLED_DRIFT",
            )?;
        }
        Ok(())
    }
}
impl InstallEffects for NativeEffects {
    fn apply(&mut self, step: InstallStep) -> Result<serde_json::Value> {
        match step {
            InstallStep::CreateIdentities => self.identities()?,
            InstallStep::CreateDirectories => self.directories()?,
            InstallStep::InstallPayloads => self.payloads()?,
            InstallStep::GenerateRoleKeys => {
                let mut catalog = custody::initialize_native()?;
                require(
                    catalog.keys.len() == self.plan.roles.len()
                        && self.plan.roles.iter().all(|role| {
                            catalog.keys.get(&role.key_id).is_some_and(|key| {
                                key.role == role.role && key.scopes == role.scopes
                            })
                        }),
                    "BOOTSTRAP_CUSTODY_DRIFT",
                )?;
                catalog
                    .profiles
                    .insert("dsh-app".into(), self.policy.profile.clone());
                self.catalog = Some(catalog);
            }
            InstallStep::ImportRegistry => self.registry()?,
            InstallStep::WriteDisabledConfiguration => self.configuration()?,
            InstallStep::ReadBack => {
                self.verify_files()?;
                census::identity_readback(&self.policy, &self.caller)?;
                let root = Dir::open(Path::new(GENESIS_STATE_ROOT), 0)?;
                let keys = root.child("issuer-keys")?;
                let catalog = self
                    .catalog
                    .as_ref()
                    .ok_or(Error::new("BOOTSTRAP_CUSTODY_MISSING"))?;
                for (issuer, role) in custody::ROLES {
                    custody::load(&keys, issuer, role, catalog)?;
                }
                require(
                    census::service_census()? == self.services
                        && census::sudoers_census()? == self.sudoers,
                    "BOOTSTRAP_EXISTING_SURFACE_DRIFT",
                )?;
                for name in ["activation.json", "daemon-activation.json"] {
                    absent(&format!("{GENESIS_STATE_ROOT}/{name}"))?;
                }
            }
        }
        Ok(
            serde_json::json!({"step":step,"new_files":self.created_files,
            "catalog_digest":self.catalog.as_ref().map(digest).transpose()?,"activation_allowed":false}),
        )
    }
}
pub(super) fn absent(path: &str) -> Result<()> {
    let p = Path::new(path);
    let dir = Dir::open(p.parent().ok_or(Error::new("UNSAFE_PATH"))?, 0)?;
    match dir.open_file(
        p.file_name()
            .and_then(|s| s.to_str())
            .ok_or(Error::new("UNSAFE_PATH"))?,
        libc::O_RDONLY,
        0,
    ) {
        Err(e) if e.code() == "ABSENT" => Ok(()),
        _ => Err(Error::new("BOOTSTRAP_UNEXPECTED_PREIMAGE")),
    }
}
fn make(path: &str, uid: u32, gid: u32, mode: u32) -> Result<Dir> {
    let p = Path::new(path);
    let parent = Dir::open(p.parent().ok_or(Error::new("UNSAFE_PATH"))?, 0)?;
    let name = p
        .file_name()
        .and_then(|v| v.to_str())
        .ok_or(Error::new("UNSAFE_PATH"))?;
    let c = CString::new(name).map_err(|_| Error::new("UNSAFE_PATH"))?;
    require(
        unsafe { libc::mkdirat(parent.file.as_raw_fd(), c.as_ptr(), 0o700) } == 0,
        "BOOTSTRAP_UNEXPECTED_PREIMAGE",
    )?;
    let dir = parent.child(name)?;
    require(
        unsafe { libc::fchown(dir.file.as_raw_fd(), uid, gid) } == 0
            && unsafe { libc::fchmod(dir.file.as_raw_fd(), mode as libc::mode_t) } == 0,
        "UNSAFE_MODE",
    )?;
    dir.file.sync_all()?;
    parent.file.sync_all()?;
    Ok(Dir {
        file: dir.file,
        uid,
    })
}

pub(crate) fn generated_configuration(catalog: Catalog) -> Configuration {
    Configuration {
        catalog,
        callers: vec![Caller {
            uid: 502,
            gid: 20,
            profiles: vec!["dsh-app".into()],
            producers: vec!["local-deployment-registry".into()],
        }],
        producers: vec!["local-deployment-registry".into()],
        socket_gid: 602,
        socket_ancestor: None,
        verifiers: BTreeMap::from([(
            "native-installed-readback-v1".into(),
            VerifierBinding::NativeInstalledReadback {
                issuer: "local-verifier".into(),
            },
        )]),
    }
}
