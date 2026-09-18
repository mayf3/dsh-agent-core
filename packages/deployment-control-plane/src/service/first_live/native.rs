use super::{enable, gate, records::*};
use crate::{
    error::require,
    fs::{
        file::{sha, snapshot},
        secure::Dir,
        MutationGuard,
    },
    Result,
};
use std::{
    os::unix::fs::{FileTypeExt, MetadataExt},
    path::Path,
    time::{Duration, Instant},
};
pub(super) const EXECUTABLE: &str = "/usr/local/libexec/agent-deployd/agent-deployd";
const ROOT: &str = "/private/var/db/agent-deployd";
const LABEL: &str = "system/ai.agent-deployd";
const PLIST: &str = "ai.agent-deployd.plist";
const OLD_PLIST: &str = "c09e24824db86db2267da236594b94d1d36399171e9d6b25e78a928c66af095b";
pub(super) fn controller() -> Result<String> {
    require(
        unsafe { libc::geteuid() } == 0 && std::env::current_exe()? == Path::new(EXECUTABLE),
        "ENABLE_FIXED_EXECUTABLE",
    )?;
    let dir = Dir::open(Path::new("/usr/local/libexec/agent-deployd"), 0)?;
    let f = dir.open_file("agent-deployd", libc::O_RDONLY, 0)?;
    require(
        f.metadata()?.mode() & 0o7777 == 0o555,
        "ENABLE_CONTROLLER_MODE",
    )?;
    Ok(sha(&snapshot(&f, 0, 128 * 1024 * 1024)?.bytes))
}
pub(super) struct Native {
    root: Dir,
    area: Dir,
    binding: Binding,
    pin: String,
    grant: crate::first_live::gate::Grant,
}
impl Native {
    fn check(&self) -> Result<()> {
        crate::first_live::gate::validate(&self.grant, &self.grant, super::super::server::now()?)?;
        require(
            controller()? == self.binding.controller_digest
                && gate::core(
                    &self.root,
                    Some(&self.binding.operation_id),
                    self.binding.expires_at,
                )? == self.binding,
            "ENABLE_BINDING",
        )
    }
    fn command(&self, args: &[&str]) -> Result<crate::first_live::process::Output> {
        self.check()?;
        let out = crate::first_live::process::run(
            crate::first_live::process::Tool::Launchctl,
            &self.pin,
            &args.iter().map(|s| s.to_string()).collect::<Vec<_>>(),
            None,
            5,
        )?;
        self.check()?;
        Ok(out)
    }
    fn success(&self, args: &[&str]) -> Result<()> {
        let o = self.command(args)?;
        require(
            o.code == Some(0) && o.stderr.is_empty(),
            "ENABLE_EFFECT_UNKNOWN",
        )
    }
    fn verify(&self, rb: &Readback) -> Result<()> {
        self.check()?;
        gate::generation(&self.area, rb)?;
        require(
            rb.binding == self.binding
                && crate::transaction::first_live_process_identity(rb.process.pid)? == rb.process
                && rb.process.uid == 0
                && rb.process.gid == 0
                && rb.process.executable == EXECUTABLE,
            "ENABLE_GENERATION_BINDING",
        )?;
        let out = self.command(&["print", LABEL])?;
        require(
            out.code == Some(0) && out.stderr.is_empty(),
            "ENABLE_SERVICE_UNPROVEN",
        )?;
        let pids: Vec<_> = out
            .stdout
            .lines()
            .filter_map(|l| l.strip_prefix("\tpid = "))
            .collect();
        let programs: Vec<_> = out
            .stdout
            .lines()
            .filter_map(|l| l.strip_prefix("\tprogram = "))
            .collect();
        require(
            pids == [rb.process.pid.to_string()] && programs == [EXECUTABLE],
            "ENABLE_SERVICE_UNPROVEN",
        )?;
        let m = std::fs::symlink_metadata("/private/var/run/agent-deployd/control.sock")?;
        require(
            m.file_type().is_socket()
                && m.uid() == 0
                && m.dev() == rb.socket_device
                && m.ino() == rb.socket_inode,
            "ENABLE_SOCKET_BINDING",
        )?;
        require(
            crate::transaction::first_live_process_identity(rb.process.pid)? == rb.process,
            "ENABLE_GENERATION_BINDING",
        )
    }
    fn wait<T: serde::de::DeserializeOwned>(&self, name: &str) -> Result<T> {
        let end = Instant::now() + Duration::from_secs(60);
        loop {
            self.check()?;
            if let Some(v) = gate::optional(&self.area, name)? {
                return Ok(v);
            }
            require(Instant::now() < end, "ENABLE_READBACK_TIMEOUT")?;
            std::thread::sleep(Duration::from_millis(25));
        }
    }
}
impl enable::Effects for Native {
    fn replace_plist(&mut self) -> Result<()> {
        self.check()?;
        let dir = Dir::open(Path::new("/Library/LaunchDaemons"), 0)?;
        let old = dir.open_file(PLIST, libc::O_RDONLY, 0)?;
        require(
            old.metadata()?.mode() & 0o7777 == 0o644 && old.metadata()?.gid() == 0,
            "ENABLE_PLIST_MODE",
        )?;
        let bytes = snapshot(&old, 0, 65536)?.bytes;
        let new = enabled_plist(&bytes)?;
        require(
            sha(&bytes) == self.binding.plist_before_digest
                && sha(&new) == self.binding.plist_after_digest,
            "ENABLE_PLIST_BINDING",
        )?;
        crate::fs::file::write_new(&self.area, "controller-plist-before", &bytes, 0, 0, 0o400)?;
        crate::fs::file::write_new(&dir, "ai.agent-deployd.plist.first-live", &new, 0, 0, 0o644)?;
        self.check()?;
        require(
            sha(&snapshot(&dir.open_file(PLIST, libc::O_RDONLY, 0)?, 0, 65536)?.bytes) == OLD_PLIST,
            "ENABLE_PLIST_DRIFT",
        )?;
        dir.rename("ai.agent-deployd.plist.first-live", &dir, PLIST)?;
        require(
            snapshot(&dir.open_file(PLIST, libc::O_RDONLY, 0)?, 0, 65536)?.bytes == new,
            "ENABLE_PLIST_DRIFT",
        )
    }
    fn enable(&mut self) -> Result<()> {
        self.success(&["enable", LABEL])
    }
    fn bootstrap(&mut self) -> Result<()> {
        self.success(&[
            "bootstrap",
            "system",
            "/Library/LaunchDaemons/ai.agent-deployd.plist",
        ])
    }
    fn readback(&mut self) -> Result<Readback> {
        let r = self.wait("daemon-readback.json")?;
        self.verify(&r)?;
        Ok(r)
    }
    fn ready(&mut self, r: &Readback) -> Result<Ready> {
        let ready: Ready = self.wait("daemon-ready.json")?;
        require(ready.readback == *r, "ENABLE_GENERATION_BINDING")?;
        self.verify(r)?;
        Ok(ready)
    }
}
pub(super) fn enabled_plist(old: &[u8]) -> Result<Vec<u8>> {
    require(
        sha(old) == OLD_PLIST && old == crate::bootstrap::DISABLED_CONTROLLER_PLIST.as_bytes(),
        "ENABLE_PLIST_DRIFT",
    )?;
    let old = "<key>Disabled</key><true/><key>RunAtLoad</key><false/><key>KeepAlive</key><false/>";
    let new = "<key>Disabled</key><false/><key>RunAtLoad</key><true/><key>KeepAlive</key><true/>";
    Ok(crate::bootstrap::DISABLED_CONTROLLER_PLIST
        .replacen(old, new, 1)
        .into_bytes())
}
pub(super) fn fresh() -> Result<()> {
    controller()?;
    let root = Dir::open(Path::new(ROOT), 0)?;
    gate::absent(&root, "first-live-pending.json")?;
    gate::absent(&root, "first-live-operation")
}
pub(super) fn run() -> Result<()> {
    let actual = controller()?;
    let root = Dir::open(Path::new(ROOT), 0)?;
    let guard = MutationGuard::acquire(&root, false)?;
    let packet_dir = Dir::open(Path::new("/private/var/db/agent-deploy-first-live"), 0)?;
    let packet_raw = snapshot(
        &packet_dir.open_file("packet.json", libc::O_RDONLY, 0)?,
        0,
        64 * 1024 * 1024,
    )?
    .bytes;
    let packet: serde_json::Value = crate::verification::documents::strict_json(&packet_raw)?;
    let file = packet_dir.open_file("owner-grant.json", libc::O_RDONLY, 0)?;
    require(
        file.metadata()?.mode() & 0o7777 == 0o600,
        "ENABLE_GRANT_MODE",
    )?;
    let grant_raw = snapshot(&file, 0, 65536)?.bytes;
    let grant: crate::first_live::gate::Grant =
        serde_json::from_value(crate::verification::documents::strict_json(&grant_raw)?)?;
    let mut expected = grant.clone();
    expected.host = crate::bootstrap::observed_host()?;
    expected.packet_sha256 = sha(&packet_raw);
    expected.controller_sha256 = actual;
    let text = |key: &str| -> Result<String> {
        packet
            .get(key)
            .and_then(|v| v.as_str())
            .map(str::to_string)
            .ok_or_else(|| crate::Error::new("ENABLE_PACKET"))
    };
    expected.operation_id = text("operation_id")?;
    expected.source_sha = text("source_sha")?;
    expected.review_sha256 = text("review_sha256")?;
    crate::first_live::gate::validate(&grant, &expected, super::super::server::now()?)?;
    let config: crate::service::Configuration = super::super::intake::read(&root, "service.json")?;
    let area = root.child("first-live-operation")?;
    let binding = gate::core(
        &root,
        config.first_target_adoption.as_deref(),
        grant.expires_at,
    )?;
    require(
        binding.grant_digest == sha(&grant_raw)
            && binding.package_digest == grant.packet_sha256
            && binding.controller_digest == grant.controller_sha256,
        "ENABLE_BINDING",
    )?;
    let pin = packet
        .pointer("/native_enrollment/launchctl_sha256")
        .and_then(|v| v.as_str())
        .ok_or_else(|| crate::Error::new("ENABLE_PACKET"))?
        .to_string();
    let mut n = Native {
        root,
        area,
        binding,
        pin,
        grant,
    };
    {
        n.check()?;
        let out = n.command(&["print", LABEL])?;
        require(
            out.code == Some(113)
                && out.stdout.is_empty()
                && out
                    .stderr
                    .contains("Could not find service \"ai.agent-deployd\""),
            "ENABLE_ALREADY_LOADED",
        )?;
        let disabled = n.command(&["print-disabled", "system"])?;
        let entries: Vec<_> = disabled
            .stdout
            .lines()
            .map(str::trim)
            .filter_map(|l| l.strip_prefix("\"ai.agent-deployd\" => "))
            .collect();
        require(
            disabled.code == Some(0) && entries == ["true"],
            "ENABLE_NOT_DISABLED",
        )?;
        enable::claim(&n.area, &n.root, &n.binding, &guard)?;
    }
    let area = Dir {
        file: n.area.file.try_clone()?,
        uid: n.area.uid,
    };
    let binding = n.binding.clone();
    let guarded_root = Dir {
        file: n.root.file.try_clone()?,
        uid: n.root.uid,
    };
    enable::run(&guarded_root, &area, &binding, &mut n, guard)?;
    println!(
        "FIRST_LIVE_ENABLED {}",
        sha(&gate::raw(&area, "enable-result.json")?)
    );
    Ok(())
}

#[cfg(test)]
#[path = "../../../test/service/first_live/native.rs"]
mod tests;
