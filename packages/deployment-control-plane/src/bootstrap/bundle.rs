use super::{loader::*, prospective::*};
use crate::{
    error::require,
    fs::{
        file::{sha, snapshot, write_new},
        secure::Dir,
    },
    model::Profile,
    trust::{canonical_bytes, digest},
    Result,
};
use serde::{Deserialize, Serialize};
use std::{collections::BTreeMap, path::Path};
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct Payload {
    pub destination: String,
    pub blob: String,
    pub sha256: String,
    pub size: u64,
    pub mode: u32,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct Package {
    pub version: u32,
    pub source_revision: String,
    pub source_files: BTreeMap<String, String>,
    pub source_digest: String,
    pub profile: Profile,
    pub identities: Identities,
    pub issuers: Vec<IssuerRequirement>,
    pub target_dispositions: BTreeMap<String, String>,
    pub legacy_surfaces: Vec<String>,
    pub lifecycle_probes: Vec<String>,
    pub layout: Vec<Layout>,
    pub steps: Vec<String>,
    pub rollback: Vec<String>,
    pub platform_tools: BTreeMap<String, String>,
    pub payloads: Vec<Payload>,
    pub transition_sudoers: String,
    pub unresolved: Vec<String>,
}
/// Builds only a new inert directory as non-root. No activation or private key input exists.
pub fn generate(
    root: &Path,
    source_revision: &str,
    source_files: BTreeMap<String, String>,
    controller: &[u8],
    runtime: &BTreeMap<String, Vec<u8>>,
    platform_tools: BTreeMap<String, String>,
) -> Result<String> {
    require(unsafe { libc::geteuid() } != 0, "PREPARATION_REFUSES_ROOT")?;
    let dir = Dir::open(root, unsafe { libc::geteuid() })?;
    require(dir.names()?.is_empty(), "PACKAGE_NOT_EMPTY")?;
    verify_loader_images(
        ClosureKind::Controller,
        &BTreeMap::from([(
            "/usr/local/libexec/agent-deployd/agent-deployd".into(),
            controller.to_vec(),
        )]),
    )?;
    verify_loader_images(ClosureKind::Runtime, runtime)?;
    let mut package = prospective(source_revision, source_files, platform_tools)?;
    let mut all = runtime.clone();
    all.insert(
        "/usr/local/libexec/agent-deployd/agent-deployd".into(),
        controller.to_vec(),
    );
    for (n, (destination, bytes)) in all.into_iter().enumerate() {
        let blob = format!("payload-{n:02}");
        write_new(
            &dir,
            &blob,
            &bytes,
            dir.uid,
            unsafe { libc::getegid() },
            0o400,
        )?;
        package.payloads.push(Payload {
            destination,
            blob,
            sha256: sha(&bytes),
            size: bytes.len() as u64,
            mode: 0o555,
        });
    }
    write_new(
        &dir,
        "ai.agent-deployd.plist",
        PLIST.as_bytes(),
        dir.uid,
        unsafe { libc::getegid() },
        0o400,
    )?;
    let raw = canonical_bytes(&package)?;
    write_new(
        &dir,
        "manifest.json",
        &raw,
        dir.uid,
        unsafe { libc::getegid() },
        0o400,
    )?;
    dir.file.sync_all()?;
    digest(&package)
}
pub(crate) fn read_package(dir: &Dir) -> Result<Package> {
    let b = snapshot(
        &dir.open_file("manifest.json", libc::O_RDONLY, 0)?,
        dir.uid,
        4 * 1024 * 1024,
    )?
    .bytes;
    crate::service::protocol::depth(&b, 16)?;
    Ok(serde_json::from_slice(&b)?)
}
pub const PLIST: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>ai.agent-deployd</string>
<key>ProgramArguments</key><array><string>/usr/local/libexec/agent-deployd/agent-deployd</string></array>
<key>UserName</key><string>root</string><key>GroupName</key><string>wheel</string>
<key>Disabled</key><true/><key>RunAtLoad</key><false/><key>KeepAlive</key><false/>
<key>Umask</key><integer>63</integer>
</dict></plist>
"#;
