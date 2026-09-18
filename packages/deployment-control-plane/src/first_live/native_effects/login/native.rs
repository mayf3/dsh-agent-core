use super::*;
use crate::{
    bootstrap::reviewer_login as observed,
    error::require,
    first_live::{files, gate},
    fs::file::{sha, snapshot},
    model::Catalog,
    registry::preactivation::{Completion, CATALOG_REVISION, STATE, VERSION},
    service::Configuration,
    trust::{digest, valid_digest},
};
use serde::Deserialize;
use std::{os::unix::fs::MetadataExt, path::Path};
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct OperationIntent {
    version: u32,
    operation_id: String,
    packet_sha256: String,
    grant_sha256: String,
    controller_sha256: String,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Pending {
    operation_id: String,
    package_digest: String,
}
pub(super) struct Native<'a> {
    pub root: &'a Dir,
    pub area: &'a Dir,
    pub packet: &'a Packet,
    pub grant: &'a Grant,
    pub guard: &'a MutationGuard,
    pub custody: &'a Proof,
    pub intent: Option<state::Intent>,
}
pub(super) fn root_required() -> Result<()> {
    require(
        unsafe { libc::getuid() } == 0 && unsafe { libc::geteuid() } == 0,
        "ROOT_REQUIRED",
    )
}
fn identity(a: &Dir, b: &Dir) -> Result<()> {
    let x = a.file.metadata()?;
    let y = b.file.metadata()?;
    require(
        a.uid == 0
            && x.uid() == 0
            && x.gid() == 0
            && x.mode() & 0o7777 == 0o700
            && (x.dev(), x.ino()) == (y.dev(), y.ino()),
        "FIRST_LIVE_LOGIN_DIRECTORY",
    )
}
fn record(dir: &Dir, name: &str, mode: u32) -> Result<Vec<u8>> {
    let r = snapshot(&dir.open_file(name, libc::O_RDONLY, 0)?, 0, 4 * 1024 * 1024)?;
    require(r.mode == mode && r.gid == 0, "FIRST_LIVE_LOGIN_RECORD_MODE")?;
    Ok(r.bytes)
}
impl Native<'_> {
    pub(super) fn checked(
        &self,
        auth_required: bool,
    ) -> Result<(state::Intent, Option<state::AuthMetadata>)> {
        root_required()?;
        self.guard.binds(self.root)?;
        identity(
            self.root,
            &Dir::open(Path::new(crate::issuer::custody::ROOT), 0)?,
        )?;
        identity(self.area, &self.root.child("first-live-operation")?)?;
        require(
            std::env::current_exe()? == Path::new(process::CONTROLLER),
            "FIRST_LIVE_LOGIN_EXECUTABLE",
        )?;
        let p = self.packet;
        let g = self.grant;
        let now = crate::first_live::compose::now()?;
        gate::validate(g, g, now)?;
        require(
            p.operation_id == g.operation_id
                && p.controller_sha256 == g.controller_sha256
                && p.host == g.host
                && g.host == crate::bootstrap::observed_host()?,
            "FIRST_LIVE_LOGIN_BINDING",
        )?;
        if !auth_required {
            require(
                g.expires_at
                    .checked_sub(now)
                    .is_some_and(|n| n >= process::LIMIT_SECONDS),
                "FIRST_LIVE_LOGIN_DEADLINE",
            )?;
        }
        let packet_dir = Dir::open(Path::new("/private/var/db/agent-deploy-first-live"), 0)?;
        let packet_raw = files::raw(&packet_dir, "packet.json")?;
        let actual_packet: Packet =
            serde_json::from_value(crate::verification::documents::strict_json(&packet_raw)?)?;
        require(
            sha(&packet_raw) == g.packet_sha256 && digest(&actual_packet)? == digest(p)?,
            "FIRST_LIVE_LOGIN_PACKET",
        )?;
        let grant_raw = record(&packet_dir, "owner-grant.json", 0o600)?;
        let actual_grant: Grant =
            serde_json::from_value(crate::verification::documents::strict_json(&grant_raw)?)?;
        require(actual_grant == *g, "FIRST_LIVE_LOGIN_GRANT")?;
        let intent: OperationIntent = files::read(self.area, "first-live-intent.json")?;
        let pending: Pending = files::read(self.root, "first-live-pending.json")?;
        require(
            intent.version == 1
                && intent.operation_id == p.operation_id
                && intent.packet_sha256 == g.packet_sha256
                && intent.grant_sha256 == sha(&grant_raw)
                && intent.controller_sha256 == g.controller_sha256
                && pending.operation_id == p.operation_id
                && pending.package_digest == g.packet_sha256,
            "FIRST_LIVE_LOGIN_OPERATION",
        )?;
        let completion_raw = record(
            &self.root.child("custody-transition")?,
            "result.json",
            0o400,
        )?;
        let completion: Completion = serde_json::from_value(
            crate::verification::documents::strict_json(&completion_raw)?,
        )?;
        require(
            sha(&completion_raw) == self.custody.completion_sha256()
                && completion.version == VERSION
                && completion.state == STATE
                && completion.operation_id == p.operation_id
                && completion.package_digest == g.packet_sha256
                && completion.owner_grant_digest == sha(&grant_raw)
                && completion.controller_sha256 == g.controller_sha256
                && completion.installation_receipt_digest == p.previous.installation_receipt_sha256
                && completion.catalog_revision == CATALOG_REVISION
                && completion.keyset_digest == digest(&self.custody.catalog().keys)?,
            "FIRST_LIVE_LOGIN_CUSTODY",
        )?;
        let service_raw = record(self.root, "service.json", 0o600)?;
        let config: Configuration =
            serde_json::from_value(crate::verification::documents::strict_json(&service_raw)?)?;
        require(
            sha(&service_raw) == self.custody.service_sha256()
                && config.catalog == *self.custody.catalog()
                && config.catalog.profiles.values().all(|p| !p.enabled),
            "FIRST_LIVE_LOGIN_CUSTODY",
        )?;
        let trust: Catalog = files::read(self.root, "local-trust.json")?;
        require(
            trust.keys == config.catalog.keys && trust.revision == CATALOG_REVISION,
            "FIRST_LIVE_LOGIN_CUSTODY",
        )?;
        crate::registry::Registry::open_local_root(self.root, self.custody.catalog())?;
        for name in ["activation.json", "daemon-activation.json"] {
            files::absent(self.root, name)?;
        }
        observed::original_unknown()?;
        observed::executable(process::CONTROLLER, &g.controller_sha256)?;
        observed::executable(crate::issuer::review::CODEX_PATH, &p.codex_sha256)?;
        let ps = p
            .lifecycle
            .tool_sha256
            .get("/bin/ps")
            .ok_or(Error::new("FIRST_LIVE_LOGIN_PS_PIN"))?;
        valid_digest(ps)?;
        let current = process::check(&observed::census(ps)?, std::process::id())?;
        let auth = observed::reviewer(auth_required)?.map(|m| state::AuthMetadata {
            device: m.dev(),
            inode: m.ino(),
            uid: m.uid(),
            gid: m.gid(),
            mode: m.mode() & 0o7777,
            bytes: m.len(),
        });
        Ok((
            state::Intent {
                version: 1,
                operation_id: p.operation_id.clone(),
                package_digest: g.packet_sha256.clone(),
                owner_grant_digest: sha(&grant_raw),
                controller_sha256: g.controller_sha256.clone(),
                custody_completion_sha256: self.custody.completion_sha256().into(),
                original_intent_digest: state::ORIGINAL_INTENT.into(),
                parent_pid: current.pid,
                parent_start: current.start,
                expires_at: g.expires_at,
            },
            auth,
        ))
    }
}
impl state::Effects for Native<'_> {
    fn preflight(&mut self) -> Result<state::Intent> {
        require(
            (0..=2).all(|fd| unsafe { libc::isatty(fd) } == 1),
            "VISIBLE_TERMINAL_REQUIRED",
        )?;
        let (intent, auth) = self.checked(false)?;
        require(auth.is_none(), "FIRST_LIVE_LOGIN_UNEXPECTED_AUTH")?;
        self.intent = Some(intent.clone());
        Ok(intent)
    }
    fn login(&mut self, expires: u64) -> Result<()> {
        process::login(expires)
    }
    fn postflight(&mut self) -> Result<state::AuthMetadata> {
        let (intent, auth) = self.checked(true)?;
        require(
            self.intent.as_ref() == Some(&intent),
            "FIRST_LIVE_LOGIN_CHANGED",
        )?;
        auth.ok_or(Error::new("FIRST_LIVE_LOGIN_AUTH_MISSING"))
    }
}
