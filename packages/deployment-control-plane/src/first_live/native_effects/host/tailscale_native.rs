use super::*;
use crate::first_live::{
    files,
    process::{self, Tool},
};
use crate::{
    error::require,
    fs::{
        file::{sha, snapshot, write_new, FileImage},
        secure::Dir,
    },
    Error,
};
use std::{
    os::{fd::AsRawFd, unix::fs::MetadataExt},
    path::Path,
    time::{Duration, Instant},
};
const PLIST_PATH: &str = "/Library/LaunchDaemons/com.tailscale.tailscaled.plist";
const RESULT: &str = "tailscale-result.json";
fn launch_dir() -> Result<Dir> {
    Dir::open(Path::new("/Library/LaunchDaemons"), 0)
}
fn libexec() -> Result<Dir> {
    Dir::open(Path::new("/usr/local/libexec"), 0)
}
fn image(dir: &Dir, name: &str, digest: &str, mode: u32) -> Result<FileImage> {
    let f = dir.open_file(name, libc::O_RDONLY, 0)?;
    let value = snapshot(&f, dir.uid, 32 * 1024 * 1024)?;
    require(
        value.gid == 0 && value.mode == mode && sha(&value.bytes) == digest,
        "TAILSCALE_FILE_DRIFT",
    )?;
    let now = dir.open_file(name, libc::O_RDONLY, 0)?.metadata()?;
    require(
        (now.dev(), now.ino()) == (value.device, value.inode),
        "TAILSCALE_FILE_DRIFT",
    )?;
    Ok(value)
}
fn input(dir: &Dir, name: &str, digest: &str) -> Result<Vec<u8>> {
    let b = files::raw(dir, name)?;
    require(sha(&b) == digest, "TAILSCALE_PACKET")?;
    Ok(b)
}
fn generation(id: &Identity, program: &str) -> Result<()> {
    let c = &id.credentials;
    require(
        id.pid > 1
            && id.parent_pid == 1
            && id.birth_seconds > 0
            && id.birth_micros < 1_000_000
            && [
                c.effective_uid,
                c.real_uid,
                c.saved_uid,
                c.effective_gid,
                c.real_gid,
                c.saved_gid,
            ] == [0; 6]
            && id.executable.as_deref() == Some(program),
        "TAILSCALE_GENERATION",
    )
}
fn observed(ctx: &Context<'_>, program: &str) -> Result<Identity> {
    let job = ctx.query(LABEL)?;
    require(
        job.metadata.path == PLIST_PATH
            && job.metadata.kind == "LaunchDaemon"
            && job.metadata.program
                == if program == OLD {
                    "/usr/local/bin/tailscaled"
                } else {
                    NEW
                },
        "TAILSCALE_LAUNCH",
    )?;
    let id = super::super::reader::identity(job.metadata.pid)?;
    generation(&id, program)?;
    Ok(id)
}
fn state_directory() -> Result<(u64, u64)> {
    let d = Dir::open(Path::new("/Library/Tailscale"), 0)?;
    let m = d.file.metadata()?;
    require(
        m.gid() == 0 && m.mode() & 0o7777 == 0o700,
        "TAILSCALE_STATE_DIRECTORY",
    )?;
    Ok((m.dev(), m.ino()))
}
fn sealed() -> Result<FileImage> {
    let dir = libexec()?.child("tailscale-sealed")?;
    let m = dir.file.metadata()?;
    require(
        m.uid() == 0 && m.gid() == 0 && m.mode() & 0o7777 == 0o755,
        "TAILSCALE_FILE_DRIFT",
    )?;
    require(
        dir.names_bounded(2)? == ["tailscaled"],
        "TAILSCALE_FILE_DRIFT",
    )?;
    let code = image(&dir, "tailscaled", PAYLOAD, 0o555)?;
    let deps = super::super::macho::dependencies(&code.bytes, 0x01000007)?;
    let expected = [
        "/usr/lib/libresolv.9.dylib",
        "/System/Library/Frameworks/CoreFoundation.framework/Versions/A/CoreFoundation",
        "/System/Library/Frameworks/Security.framework/Versions/A/Security",
        "/System/Library/Frameworks/IOKit.framework/Versions/A/IOKit",
        "/usr/lib/libSystem.B.dylib",
    ];
    require(
        deps.len() == expected.len() && deps.iter().all(|p| expected.contains(&p.as_str())),
        "TAILSCALE_LOADER",
    )?;
    Ok(code)
}
fn absent_old(old: &Identity) -> Result<()> {
    // No signal is delivered. Reuse or inaccessible identity is conservatively unknown.
    require(
        unsafe { libc::kill(old.pid as i32, 0) } == -1
            && std::io::Error::last_os_error().raw_os_error() == Some(libc::ESRCH),
        "TAILSCALE_OLD_GENERATION_PRESENT",
    )
}
#[derive(serde::Serialize, serde::Deserialize)]
#[serde(deny_unknown_fields)]
struct Receipt {
    version: u32,
    state: String,
    operation_id: String,
    packet_sha256: String,
    controller_sha256: String,
    old: Identity,
    new: Identity,
    status_sha256: String,
    state_directory: (u64, u64),
    executable_inode: (u64, u64),
    plist_inode: (u64, u64),
}
pub(super) fn prepare(ctx: &Context<'_>) -> Result<Tailscale> {
    ctx.check()?;
    require(unsafe { libc::geteuid() } == 0, "ROOT_REQUIRED")?;
    super::super::environment::global(ctx)?;
    for n in [
        "tailscale-intent.json",
        RESULT,
        "tailscale-original.plist",
        "tailscale-stage.json",
        "tailscale-bootout-intent.json",
        "tailscale-bootout-result.json",
        "tailscale-bootstrap-intent.json",
        "tailscale-bootstrap-result.json",
    ] {
        files::absent(ctx.area, n)?;
    }
    files::absent(&libexec()?, "tailscale-sealed")?;
    files::absent(&launch_dir()?, "tailscale-first-live.plist")?;
    image(&launch_dir()?, PLIST, OLD_PLIST, 0o644)?;
    let b = input(ctx.packet_dir, "tailscaled", PAYLOAD)?;
    require(b.len() == 23331104, "TAILSCALE_PACKET")?;
    input(ctx.packet_dir, "tailscaled.plist", NEW_PLIST)?;
    old_preimage()?;
    let original = observed(ctx, OLD)?;
    let status = io::read(ctx, &original)?;
    let state_directory = state_directory()?;
    require(observed(ctx, OLD)? == original, "TAILSCALE_GENERATION")?;
    ctx.check()?;
    Ok(Tailscale {
        original,
        status,
        state_directory,
        transition: state::Transition::default(),
        failed: std::cell::Cell::new(false),
    })
}
fn current(t: &Tailscale, ctx: &Context<'_>) -> Result<(Identity, FileImage, FileImage)> {
    ctx.check()?;
    super::super::environment::global(ctx)?;
    let code = sealed()?;
    let plist = image(&launch_dir()?, PLIST, NEW_PLIST, 0o644)?;
    require(
        state_directory()? == t.state_directory,
        "TAILSCALE_STATE_DIRECTORY",
    )?;
    let expected = t
        .sealed_identity()
        .ok_or_else(|| Error::new("TAILSCALE_NOT_CLOSED"))?;
    let actual = observed(ctx, NEW)?;
    super::super::environment::running(actual.pid)?;
    require(
        &actual == expected && io::read(ctx, &actual)? == t.status,
        "TAILSCALE_GENERATION",
    )?;
    require(observed(ctx, NEW)? == actual, "TAILSCALE_GENERATION")?;
    ctx.check()?;
    Ok((actual, code, plist))
}
pub(super) fn verify(t: &Tailscale, ctx: &Context<'_>) -> Result<String> {
    let (actual, code, plist) = current(t, ctx)?;
    let raw = files::raw(ctx.area, RESULT)?;
    let receipt: Receipt =
        serde_json::from_value(crate::verification::documents::strict_json(&raw)?)?;
    require(
        receipt.version == 1
            && receipt.state == "SEALED_SAME_IDENTITY_RUNNING"
            && receipt.operation_id == ctx.packet.operation_id
            && receipt.packet_sha256 == ctx.grant.packet_sha256
            && receipt.controller_sha256 == ctx.packet.controller_sha256
            && receipt.old == t.original
            && receipt.new == actual
            && receipt.status_sha256 == t.status
            && receipt.state_directory == t.state_directory
            && receipt.executable_inode == (code.device, code.inode)
            && receipt.plist_inode == (plist.device, plist.inode),
        "TAILSCALE_RECEIPT",
    )?;
    Ok(sha(&raw))
}
pub(super) struct Native<'a, 'b> {
    pub ctx: &'a Context<'b>,
    pub old: &'a Identity,
    pub status: &'a str,
    pub state_directory: (u64, u64),
}
impl Native<'_, '_> {
    fn effect(&self, name: &str, args: Vec<String>) -> Result<()> {
        self.ctx.check()?;
        files::publish(
            self.ctx.area,
            &format!("tailscale-{name}-intent.json"),
            &serde_json::json!({
            "operation_id":self.ctx.packet.operation_id,"packet_sha256":self.ctx.grant.packet_sha256,"args":args}),
        )?;
        self.ctx.check()?;
        let out = process::run(
            Tool::Launchctl,
            &self.ctx.packet.native_enrollment.launchctl_sha256,
            &args,
            None,
            10,
        )?;
        // Output can contain launch metadata; only hashes and status are retained.
        files::publish(
            self.ctx.area,
            &format!("tailscale-{name}-result.json"),
            &serde_json::json!({
            "code":out.code,"stdout_sha256":sha(out.stdout.as_bytes()),"stderr_sha256":sha(out.stderr.as_bytes())}),
        )?;
        require(
            out.code == Some(0) && out.stdout.is_empty() && out.stderr.is_empty(),
            "TAILSCALE_EFFECT_UNKNOWN",
        )?;
        self.ctx.check()
    }
}
impl state::Effects for Native<'_, '_> {
    fn check(&mut self) -> Result<()> {
        state::checked(self.ctx)
    }
    fn intent(&mut self) -> Result<()> {
        old_preimage()?;
        require(
            observed(self.ctx, OLD)? == *self.old
                && io::read(self.ctx, self.old)? == self.status
                && state_directory()? == self.state_directory,
            "TAILSCALE_PREIMAGE",
        )?;
        image(&launch_dir()?, PLIST, OLD_PLIST, 0o644)?;
        files::publish(
            self.ctx.area,
            "tailscale-intent.json",
            &serde_json::json!({"version":1,
            "operation_id":self.ctx.packet.operation_id,"packet_sha256":self.ctx.grant.packet_sha256,
            "old":self.old,"status_sha256":self.status,"state_directory":self.state_directory}),
        )
    }
    fn stage(&mut self) -> Result<()> {
        let old = image(&launch_dir()?, PLIST, OLD_PLIST, 0o644)?;
        write_new(
            self.ctx.area,
            "tailscale-original.plist",
            &old.bytes,
            0,
            0,
            0o400,
        )?;
        let bytes = input(self.ctx.packet_dir, "tailscaled", PAYLOAD)?;
        let parent = libexec()?;
        files::absent(&parent, "tailscale-sealed")?;
        self.ctx.check()?;
        let dir = parent.mkdir("tailscale-sealed")?;
        write_new(&dir, "tailscaled", &bytes, 0, 0, 0o555)?;
        require(
            unsafe { libc::fchmod(dir.file.as_raw_fd(), 0o755) } == 0,
            "TAILSCALE_FILE_DRIFT",
        )?;
        dir.file.sync_all()?;
        parent.file.sync_all()?;
        let code = sealed()?;
        files::publish(
            self.ctx.area,
            "tailscale-stage.json",
            &serde_json::json!({"sha256":PAYLOAD,"device":code.device,"inode":code.inode}),
        )
    }
    fn stop(&mut self) -> Result<()> {
        old_preimage()?;
        require(
            observed(self.ctx, OLD)? == *self.old,
            "TAILSCALE_GENERATION",
        )?;
        image(&launch_dir()?, PLIST, OLD_PLIST, 0o644)?;
        self.effect("bootout", vec!["bootout".into(), LABEL.into()])
    }
    fn stopped(&mut self) -> Result<()> {
        require(
            self.ctx.query_optional(LABEL)?.is_none(),
            "TAILSCALE_JOB_STILL_LOADED",
        )?;
        absent_old(self.old)
    }
    fn publish(&mut self) -> Result<()> {
        let parent = launch_dir()?;
        image(&parent, PLIST, OLD_PLIST, 0o644)?;
        sealed()?;
        let bytes = input(self.ctx.packet_dir, "tailscaled.plist", NEW_PLIST)?;
        self.stopped()?;
        self.ctx.check()?;
        write_new(&parent, "tailscale-first-live.plist", &bytes, 0, 0, 0o644)?;
        image(&parent, PLIST, OLD_PLIST, 0o644)?;
        self.ctx.check()?;
        parent.rename("tailscale-first-live.plist", &parent, PLIST)?;
        image(&parent, PLIST, NEW_PLIST, 0o644)?;
        Ok(())
    }
    fn start(&mut self) -> Result<()> {
        self.stopped()?;
        sealed()?;
        image(&launch_dir()?, PLIST, NEW_PLIST, 0o644)?;
        super::super::environment::global(self.ctx)?;
        self.effect(
            "bootstrap",
            vec!["bootstrap".into(), "system".into(), PLIST_PATH.into()],
        )
    }
    fn ready(&mut self) -> Result<(Identity, String)> {
        let id = observed(self.ctx, NEW)?;
        require(id.pid != self.old.pid, "TAILSCALE_GENERATION")?;
        super::super::environment::global(self.ctx)?;
        super::super::environment::running(id.pid)?;
        let deadline = Instant::now() + Duration::from_secs(30);
        loop {
            self.ctx.check()?;
            match io::read(self.ctx, &id) {
                Ok(status) => {
                    require(
                        status == self.status
                            && observed(self.ctx, NEW)? == id
                            && state_directory()? == self.state_directory,
                        "TAILSCALE_IDENTITY_CHANGED",
                    )?;
                    return Ok((id, status));
                }
                Err(e)
                    if [
                        "TAILSCALE_SOCKET_ABSENT",
                        "TAILSCALE_CONNECT_UNAVAILABLE",
                        "TAILSCALE_NOT_RUNNING",
                    ]
                    .contains(&e.code())
                        && Instant::now() < deadline =>
                {
                    std::thread::sleep(Duration::from_millis(100))
                }
                Err(e) => return Err(e),
            }
        }
    }
    fn complete(&mut self, new: &Identity, status: &str) -> Result<()> {
        let code = sealed()?;
        let plist = image(&launch_dir()?, PLIST, NEW_PLIST, 0o644)?;
        require(
            observed(self.ctx, NEW)? == *new && status == self.status,
            "TAILSCALE_GENERATION",
        )?;
        self.ctx.check()?;
        files::publish(
            self.ctx.area,
            RESULT,
            &Receipt {
                version: 1,
                state: "SEALED_SAME_IDENTITY_RUNNING".into(),
                operation_id: self.ctx.packet.operation_id.clone(),
                packet_sha256: self.ctx.grant.packet_sha256.clone(),
                controller_sha256: self.ctx.packet.controller_sha256.clone(),
                old: self.old.clone(),
                new: new.clone(),
                status_sha256: status.into(),
                state_directory: self.state_directory,
                executable_inode: (code.device, code.inode),
                plist_inode: (plist.device, plist.inode),
            },
        )
    }
}
