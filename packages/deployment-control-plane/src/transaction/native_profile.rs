use super::process::ProcessIdentity;
use crate::{error::require, Error, Result};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

pub(crate) const NODE: &str = "/usr/local/libexec/agent-core/node-runtime/bin/node";
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
pub enum NativeKind {
    Runtime,
    WatchdogW1,
    WatchdogW2,
}
impl NativeKind {
    pub(crate) fn label(self) -> &'static str {
        match self {
            Self::Runtime => "system/ai.agent-core.runtime",
            Self::WatchdogW1 => "system/ai.agent-core.scheduler-watchdog-w1",
            Self::WatchdogW2 => "system/ai.agent-core.scheduler-watchdog-w2",
        }
    }
    pub(crate) fn plist(self) -> &'static str {
        match self {
            Self::Runtime => "/Library/LaunchDaemons/ai.agent-core.runtime.plist",
            Self::WatchdogW1 => "/Library/LaunchDaemons/ai.agent-core.scheduler-watchdog-w1.plist",
            Self::WatchdogW2 => "/Library/LaunchDaemons/ai.agent-core.scheduler-watchdog-w2.plist",
        }
    }
    pub(crate) fn argv(self, root: &str) -> Vec<String> {
        match self {
            Self::Runtime => vec![
                NODE.into(),
                "/usr/local/libexec/agent-core/app/scripts/production-runtime.mjs".into(),
                "--root".into(),
                root.into(),
            ],
            Self::WatchdogW1 | Self::WatchdogW2 => vec![
                NODE.into(),
                "/usr/local/libexec/agent-core/app/scripts/scheduler-watchdog.mjs".into(),
                "--role".into(),
                if self == Self::WatchdogW1 { "w1" } else { "w2" }.into(),
            ],
        }
    }
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ServiceEnrollment {
    pub kind: NativeKind,
    pub uid: u32,
    pub gid: u32,
    pub plist_sha256: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct EnrolledFile {
    pub path: String,
    pub sha256: Option<String>,
    pub mutable: bool,
    pub mode: u32,
    pub gid: u32,
}
#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum RuntimeStartup {
    #[default]
    Legacy,
    CatchupZero,
}
impl RuntimeStartup {
    pub fn legacy(&self) -> bool {
        *self == Self::Legacy
    }
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct NativeEnrollment {
    pub host: String,
    pub caller_uids: Vec<u32>,
    pub lifecycle_denial_digest: String,
    pub required_facets: Vec<String>,
    pub profile_revision: String,
    pub profile_id: String,
    pub profile_digest: String,
    pub initial_files: Vec<EnrolledFile>,
    pub runtime_root: String,
    #[serde(default, skip_serializing_if = "RuntimeStartup::legacy")]
    pub runtime_startup: RuntimeStartup,
    pub node_sha256: String,
    pub loader_files: Vec<crate::bootstrap::LoaderFile>,
    pub launchctl_sha256: String,
    pub plutil_sha256: String,
    pub services: Vec<ServiceEnrollment>,
}
impl NativeEnrollment {
    pub(crate) fn argv(&self, kind: NativeKind) -> Vec<String> {
        let mut argv = kind.argv(&self.runtime_root);
        if kind == NativeKind::Runtime && self.runtime_startup == RuntimeStartup::CatchupZero {
            argv.extend(["--catchup".into(), "0".into()]);
        }
        argv
    }
    pub fn validate(&self) -> Result<()> {
        crate::trust::valid_id(&self.profile_id)?;
        crate::trust::valid_id(&self.profile_revision)?;
        crate::trust::valid_digest(&self.profile_digest)?;
        crate::trust::valid_digest(&self.node_sha256)?;
        require(
            self.loader_files
                .iter()
                .any(|f| f.path == NODE && f.sha256 == self.node_sha256),
            "LOADER_CLOSURE_MISSING",
        )?;
        crate::trust::valid_digest(&self.launchctl_sha256)?;
        crate::trust::valid_digest(&self.plutil_sha256)?;
        require(
            !self.initial_files.is_empty() && self.initial_files.len() <= 4096,
            "PROFILE_NOT_ALLOWED",
        )?;
        let mut paths = std::collections::BTreeSet::new();
        for f in &self.initial_files {
            crate::fs::secure::relative(&f.path)?;
            if let Some(hash) = &f.sha256 {
                crate::trust::valid_digest(hash)?;
            }
            require(f.sha256.is_some() || f.mutable, "PROFILE_NOT_ALLOWED")?;
            require(
                paths.insert(f.path.to_ascii_lowercase())
                    && matches!(f.mode, 0o644 | 0o755 | 0o600 | 0o400),
                "PROFILE_NOT_ALLOWED",
            )?;
        }

        require(
            self.services.len() == 3
                && self.services.iter().map(|s| s.kind).collect::<Vec<_>>()
                    == vec![
                        NativeKind::Runtime,
                        NativeKind::WatchdogW1,
                        NativeKind::WatchdogW2,
                    ],
            "PROFILE_NOT_ALLOWED",
        )?;
        for service in &self.services {
            crate::trust::valid_digest(&service.plist_sha256)?;
        }
        require(
            self.services[0].uid != 0
                && self.services[1].uid == self.services[0].uid
                && self.services[2].uid == 0,
            "SERVICE_IDENTITY",
        )?;
        // This is a protected bootstrap reference, never a caller-provided filesystem destination.
        require(
            self.runtime_root.starts_with("/Users/") && !self.runtime_root.contains(".."),
            "PROFILE_NOT_ALLOWED",
        )
    }
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct ComponentImage {
    pub kind: NativeKind,
    pub loaded: bool,
    pub disabled: bool,
    pub running: bool,
    pub process: Option<ProcessIdentity>,
    pub runs: u64,
    pub last_exit: Option<i32>,
}
/// Selected exact one-tab top-level fields only; nested PID values never count.
pub fn parse_launchd(text: &str) -> Result<BTreeMap<String, String>> {
    require(text.len() <= 1024 * 1024, "SERVICE_READBACK_LIMIT")?;
    let mut fields = BTreeMap::new();
    for line in text.lines() {
        if let Some(top) = line.strip_prefix('\t') {
            if top.starts_with('\t') {
                continue;
            }
            if let Some((key, value)) = top.split_once(" = ") {
                if ["state", "program", "pid", "runs", "path", "last exit code"].contains(&key) {
                    require(
                        fields.insert(key.into(), value.into()).is_none(),
                        "SERVICE_READBACK_AMBIGUOUS",
                    )?;
                }
            }
        }
    }
    require(
        fields.contains_key("state") && fields.contains_key("program"),
        "SERVICE_READBACK_INCOMPLETE",
    )?;
    Ok(fields)
}
pub(crate) fn process_argv(pid: u32) -> Result<Vec<String>> {
    let mut mib = [libc::CTL_KERN, libc::KERN_PROCARGS2, pid as i32];
    let mut buffer = vec![0u8; 1024 * 1024];
    let mut len = buffer.len();
    require(
        unsafe {
            libc::sysctl(
                mib.as_mut_ptr(),
                3,
                buffer.as_mut_ptr() as *mut _,
                &mut len,
                std::ptr::null_mut(),
                0,
            )
        } == 0,
        "SERVICE_ARGV",
    )?;
    require(len >= 4, "SERVICE_ARGV")?;
    buffer.truncate(len);
    let argc = i32::from_ne_bytes(buffer[..4].try_into().unwrap());
    require((1..=128).contains(&argc), "SERVICE_ARGV")?;
    let mut pos = 4;
    while pos < len && buffer[pos] != 0 {
        pos += 1;
    }
    while pos < len && buffer[pos] == 0 {
        pos += 1;
    }
    let mut result = Vec::new();
    for _ in 0..argc {
        require(pos < len, "SERVICE_ARGV")?;
        let end = buffer[pos..]
            .iter()
            .position(|v| *v == 0)
            .ok_or(Error::new("SERVICE_ARGV"))?
            + pos;
        result.push(
            std::str::from_utf8(&buffer[pos..end])
                .map_err(|_| Error::new("SERVICE_ARGV"))?
                .into(),
        );
        pos = end + 1;
    }
    Ok(result)
}

#[cfg(test)]
#[path = "../../test/adoption/native_startup.rs"]
mod startup_tests;
