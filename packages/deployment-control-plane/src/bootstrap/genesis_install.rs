//! Disabled installation transaction. Native execution requires external root Owner authorization.
use super::*;
use crate::{
    error::require,
    fs::{
        file::{sha, snapshot, write_new},
        secure::Dir,
    },
    trust::{canonical_bytes, valid_id},
    Error, Result,
};
use serde::{Deserialize, Serialize};
use std::{collections::BTreeMap, path::Path};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct GenesisOwnerGrant {
    pub version: u32,
    pub owner: String,
    pub method: GenesisAuthorizationMethod,
    pub scope: GenesisAuthorizationScope,
    pub pins: GenesisPins,
    pub host: String,
    pub attempt_id: String,
    pub issued_at: u64,
    pub expires_at: u64,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct GenesisInstallPolicy {
    pub profile: crate::model::Profile,
    pub issuer_policy: crate::issuer::coordinator::SupervisorPolicy,
    pub platform_tools: BTreeMap<String, String>,
}
#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct GenesisInstallReceipt {
    pub state: String,
    pub plan_digest: String,
    pub activation_allowed: bool,
    pub runtime_enrollment_complete: bool,
}
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub(crate) enum InstallStep {
    CreateIdentities,
    CreateDirectories,
    InstallPayloads,
    GenerateRoleKeys,
    ImportRegistry,
    WriteDisabledConfiguration,
    ReadBack,
}
impl InstallStep {
    pub(crate) const ALL: &'static [Self] = &[
        Self::CreateIdentities,
        Self::CreateDirectories,
        Self::InstallPayloads,
        Self::GenerateRoleKeys,
        Self::ImportRegistry,
        Self::WriteDisabledConfiguration,
        Self::ReadBack,
    ];
}
pub(crate) trait InstallEffects {
    fn apply(&mut self, step: InstallStep) -> Result<serde_json::Value>;
}
pub fn validate_genesis_grant(
    plan: &GenesisPlan,
    pins: &GenesisPins,
    grant: &GenesisOwnerGrant,
    host: &str,
    now: u64,
) -> Result<()> {
    validate_genesis_plan(plan, pins)?;
    valid_id(&grant.attempt_id)?;
    crate::fs::secure::component(&grant.attempt_id)?;
    require(
        grant.version == 1 && grant.owner == "mayf3" && grant.pins == *pins && grant.host == host,
        "BOOTSTRAP_EXTERNAL_AUTHORIZATION",
    )?;
    require(
        grant.issued_at <= now
            && grant.expires_at > now
            && grant.expires_at > grant.issued_at
            && grant.expires_at - grant.issued_at <= plan.owner_authorization.validity_seconds,
        "BOOTSTRAP_AUTHORIZATION_EXPIRED",
    )
}
pub fn install_genesis_native(
    package: &Path,
    authorization: &Path,
    pins: &GenesisPins,
) -> Result<GenesisInstallReceipt> {
    require(unsafe { libc::geteuid() } == 0, "ROOT_REQUIRED")?;
    super::genesis_install_native::install(package, authorization, pins)
}
pub(crate) fn execute_steps(
    journal: &Dir,
    effects: &mut impl InstallEffects,
    plan_digest: &str,
    fault: Option<usize>,
) -> Result<GenesisInstallReceipt> {
    require(journal.names()?.is_empty(), "BOOTSTRAP_ATTEMPT_EXISTS")?;
    for (index, step) in InstallStep::ALL.iter().copied().enumerate() {
        append(
            journal,
            &format!("{:03}-intent.json", index * 2),
            &serde_json::json!({"step":step,"plan_digest":plan_digest}),
        )?;
        let result = effects.apply(step);
        if fault == Some(index) {
            return Err(Error::new("BOOTSTRAP_OUTCOME_UNKNOWN"));
        }
        match result {
            Ok(result) => append(
                journal,
                &format!("{:03}-result.json", index * 2 + 1),
                &result,
            )?,
            Err(error) => {
                append(
                    journal,
                    "failure.json",
                    &serde_json::json!({"step":step,"reason":error.code(),
                    "state":"OUTCOME_UNKNOWN_RECONCILIATION_REQUIRED"}),
                )?;
                return Err(Error::new("BOOTSTRAP_OUTCOME_UNKNOWN"));
            }
        }
    }
    let receipt = GenesisInstallReceipt {
        state: "INSTALLED_DISABLED_PENDING_OWNER_LOGIN".into(),
        plan_digest: plan_digest.into(),
        activation_allowed: false,
        runtime_enrollment_complete: false,
    };
    append(journal, "installation.json", &receipt)?;
    Ok(receipt)
}
pub(crate) fn append(dir: &Dir, name: &str, value: &impl Serialize) -> Result<()> {
    use std::os::unix::fs::MetadataExt;
    write_new(
        dir,
        name,
        &canonical_bytes(value)?,
        dir.uid,
        dir.file.metadata()?.gid(),
        0o600,
    )?;
    Ok(())
}
pub(crate) fn remove_owned_file(dir: &Dir, name: &str, hash: &str) -> Result<()> {
    let image = snapshot(
        &dir.open_file(name, libc::O_RDONLY, 0)?,
        dir.uid,
        512 * 1024 * 1024,
    )?;
    require(sha(&image.bytes) == hash, "BOOTSTRAP_ROLLBACK_DRIFT")?;
    dir.unlink(name)
}

#[cfg(test)]
struct FixtureEffects<'a> {
    root: &'a Dir,
    steps: Vec<InstallStep>,
}
#[cfg(test)]
impl<'a> FixtureEffects<'a> {
    fn new(root: &'a Dir) -> Self {
        Self {
            root,
            steps: vec![],
        }
    }
}
#[cfg(test)]
impl InstallEffects for FixtureEffects<'_> {
    fn apply(&mut self, step: InstallStep) -> Result<serde_json::Value> {
        self.steps.push(step);
        if step == InstallStep::InstallPayloads {
            let dir = self.root.mkdir("files")?;
            write_new(
                &dir,
                "agent-deployd",
                b"fixture-executable",
                dir.uid,
                unsafe { libc::getegid() },
                0o500,
            )?;
        }
        Ok(serde_json::json!({"step":step, "fixture":true}))
    }
}
#[cfg(test)]
#[path = "../../test/genesis_install/main.rs"]
mod tests;
