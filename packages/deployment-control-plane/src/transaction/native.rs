//! Fixed reviewed service group, with periodic jobs distinct from the continuous parent.
use super::{
    journal::Journal,
    native_profile::*,
    process::{bounded, identity, run},
    service::ServiceImage,
};
use crate::{
    error::require,
    fs::{
        file::{sha, snapshot, write_new},
        secure::Dir,
    },
    trust::digest,
    Error, Result,
};
use std::{
    os::unix::fs::MetadataExt,
    process::{Command, Stdio},
    time::{Duration, Instant},
};

pub(crate) struct NativeService {
    pub root: Dir,
    pub enrollment: NativeEnrollment,
}
impl NativeService {
    fn read_command(&self, args: &[&str]) -> Result<(i32, String)> {
        let name = "launchctl-readback";
        let file = write_new(
            &self.root,
            name,
            &[],
            0,
            self.root.file.metadata()?.gid(),
            0o600,
        )?;
        let mut child = Command::new("/bin/launchctl")
            .args(args)
            .env_clear()
            .stdin(Stdio::null())
            .stdout(Stdio::from(file.try_clone()?))
            .stderr(Stdio::from(file.try_clone()?))
            .spawn()?;
        let result = bounded(&mut child, Instant::now() + Duration::from_secs(5));
        let bytes = snapshot(&file, 0, 1024 * 1024);
        self.root.unlink(name)?;
        let code = result?
            .code()
            .ok_or(Error::new("SERVICE_READBACK_INVALID"))?;
        let text =
            String::from_utf8(bytes?.bytes).map_err(|_| Error::new("SERVICE_READBACK_INVALID"))?;
        Ok((code, text))
    }
    fn disabled(&self, kind: NativeKind) -> Result<bool> {
        let (code, text) = self.read_command(&["print-disabled", "system"])?;
        require(
            code == 0 && text.contains("disabled services = {"),
            "SERVICE_DISABLED_UNPROVEN",
        )?;
        let name = kind.label().strip_prefix("system/").unwrap();
        let prefix = format!("\"{name}\" => ");
        let found: Vec<_> = text
            .lines()
            .map(str::trim)
            .filter_map(|s| s.strip_prefix(&prefix))
            .collect();
        require(found.len() <= 1, "SERVICE_DISABLED_UNPROVEN")?;
        match found.first().copied() {
            None | Some("false") => Ok(false),
            Some("true") => Ok(true),
            _ => Err(Error::new("SERVICE_DISABLED_UNPROVEN")),
        }
    }
    fn component(&self, e: &ServiceEnrollment) -> Result<ComponentImage> {
        let disabled = self.disabled(e.kind)?;
        let (code, text) = self.read_command(&["print", e.kind.label()])?;
        if code == 113 && text.contains("Could not find service") {
            return Ok(ComponentImage {
                kind: e.kind,
                loaded: false,
                disabled,
                running: false,
                process: None,
                runs: 0,
                last_exit: None,
            });
        }
        require(code == 0, "SERVICE_UNAVAILABLE")?;
        let fields = parse_launchd(&text)?;
        require(
            fields.get("program").map(String::as_str) == Some(NODE)
                && fields.get("path").map(String::as_str) == Some(e.kind.plist()),
            "SERVICE_IDENTITY",
        )?;
        let running = fields.get("state").map(String::as_str) == Some("running");
        require(
            running || fields.get("state").map(String::as_str) == Some("not running"),
            "SERVICE_STATE_UNPROVEN",
        )?;
        let process = if running {
            let pid = fields
                .get("pid")
                .and_then(|p| p.parse().ok())
                .ok_or(Error::new("SERVICE_IDENTITY"))?;
            let p = identity(pid)?;
            require(
                p.uid == e.uid && p.gid == e.gid && p.executable == NODE,
                "SERVICE_IDENTITY",
            )?;
            require(
                process_argv(pid)? == e.kind.argv(&self.enrollment.runtime_root),
                "SERVICE_ARGV",
            )?;
            Some(p)
        } else {
            require(!fields.contains_key("pid"), "SERVICE_IDENTITY")?;
            None
        };
        let runs = fields
            .get("runs")
            .and_then(|s| s.parse().ok())
            .ok_or(Error::new("SERVICE_READBACK_INCOMPLETE"))?;
        let last_exit = fields.get("last exit code").and_then(|s| s.parse().ok());
        Ok(ComponentImage {
            kind: e.kind,
            loaded: true,
            disabled,
            running,
            process,
            runs,
            last_exit,
        })
    }
    pub fn image(&self) -> Result<ServiceImage> {
        self.dependencies()?;
        let components = self
            .enrollment
            .services
            .iter()
            .map(|s| self.component(s))
            .collect::<Result<Vec<_>>>()?;
        let processes = components
            .iter()
            .filter_map(|s| s.process.clone())
            .collect();
        let parent = &components[0];
        // Installed generation is carried by the transaction; periodic PID/runs are observations.
        let generation = digest(&(
            parent.process.clone(),
            components
                .iter()
                .map(|s| (s.kind, s.loaded, s.disabled))
                .collect::<Vec<_>>(),
        ))?;
        Ok(ServiceImage {
            loaded: parent.loaded,
            running: parent.running,
            processes,
            generation,
            components,
        })
    }
    fn dependencies(&self) -> Result<()> {
        self.enrollment.validate()?;
        crate::bootstrap::loader::installed(&self.enrollment.loader_files)?;
        crate::bootstrap::verify_platform_launchctl(&self.enrollment.launchctl_sha256)?;
        let dir = Dir::open(
            std::path::Path::new("/usr/local/libexec/agent-core/node-runtime/bin"),
            0,
        )?;
        require(
            sha(&snapshot(
                &dir.open_file("node", libc::O_RDONLY, 0)?,
                0,
                128 * 1024 * 1024,
            )?
            .bytes)
                == self.enrollment.node_sha256,
            "SERVICE_DEPENDENCY_DRIFT",
        )?;
        let dir = Dir::open(std::path::Path::new("/Library/LaunchDaemons"), 0)?;
        for e in &self.enrollment.services {
            let name = e.kind.plist().rsplit('/').next().unwrap();
            let bytes = snapshot(&dir.open_file(name, libc::O_RDONLY, 0)?, 0, 1024 * 1024)?.bytes;
            require(sha(&bytes) == e.plist_sha256, "SERVICE_DEPENDENCY_DRIFT")?;
            let plist =
                crate::bootstrap::verify_service_plist(&bytes, &self.enrollment.plutil_sha256)?;
            require(
                plist.get("ProgramArguments")
                    == Some(&serde_json::json!(e
                        .kind
                        .argv(&self.enrollment.runtime_root))),
                "SERVICE_ARGV",
            )?;
        }
        Ok(())
    }
    pub fn stop(&self, journal: &mut Journal, before: &ServiceImage) -> Result<()> {
        // Adjuncts first, shared parent last. No disabled-state mutation.
        for kind in [
            NativeKind::WatchdogW1,
            NativeKind::WatchdogW2,
            NativeKind::Runtime,
        ] {
            let e = self
                .enrollment
                .services
                .iter()
                .find(|s| s.kind == kind)
                .unwrap();
            let old = before
                .components
                .iter()
                .find(|s| s.kind == kind)
                .ok_or(Error::new("SERVICE_IDENTITY"))?;
            let current = self.component(e)?;
            require(
                current.loaded == old.loaded && current.disabled == old.disabled,
                "SERVICE_GENERATION_DRIFT",
            )?;
            if kind == NativeKind::Runtime {
                require(current.process == old.process, "SERVICE_GENERATION_DRIFT")?;
            }
            if !old.loaded {
                continue;
            }
            let exit = if let Some(p) = &current.process {
                Some(super::process::ExitWatch::new(p)?)
            } else {
                None
            };
            run(
                journal,
                &format!("{:?}-bootout", kind),
                "/bin/launchctl",
                &["bootout", kind.label()],
                Duration::from_secs(15),
            )?;
            if let Some(w) = exit {
                w.wait()?;
            }
            require(!self.component(e)?.loaded, "OLD_GENERATION_UNPROVEN")?;
            // Complete root kernel census plus unloaded launchd blocks tick/start races.
            super::process::prove_no_service_process(&kind.argv(&self.enrollment.runtime_root))?;
        }
        Ok(())
    }
    pub fn start(
        &self,
        journal: &mut Journal,
        before: &ServiceImage,
        _rollback: bool,
    ) -> Result<ServiceImage> {
        self.dependencies()?;
        for e in &self.enrollment.services {
            let old = before
                .components
                .iter()
                .find(|s| s.kind == e.kind)
                .ok_or(Error::new("SERVICE_IDENTITY"))?;
            require(
                self.disabled(e.kind)? == old.disabled,
                "SERVICE_DISABLED_DRIFT",
            )?;
            if old.loaded {
                require(!old.disabled, "DISABLED_LOADED_RESTORE_UNSUPPORTED")?;
                run(
                    journal,
                    &format!("{:?}-bootstrap", e.kind),
                    "/bin/launchctl",
                    &["bootstrap", "system", e.kind.plist()],
                    Duration::from_secs(15),
                )?;
            }
        }
        for _ in 0..3 {
            let image = self.image()?;
            let parent_ok = image.loaded == before.loaded && (!before.running || image.running);
            if parent_ok
                && image
                    .components
                    .iter()
                    .zip(&before.components)
                    .all(|(n, o)| n.loaded == o.loaded && n.disabled == o.disabled)
            {
                if image.running {
                    self.health()?;
                }
                return Ok(image);
            }
            std::thread::sleep(Duration::from_millis(250));
        }
        Err(Error::new("NEW_GENERATION_UNPROVEN"))
    }
    pub fn prove(&self, expected: &ServiceImage) -> Result<ServiceImage> {
        let actual = self.image()?;
        require(
            actual.generation == expected.generation,
            "SERVICE_GENERATION_DRIFT",
        )?;
        for (n, o) in actual.components.iter().zip(&expected.components) {
            require(
                n.kind == o.kind && n.loaded == o.loaded && n.disabled == o.disabled,
                "SERVICE_GENERATION_DRIFT",
            )?;
            if n.kind != NativeKind::Runtime && !n.running && n.loaded {
                require(n.last_exit == Some(0), "ADJUNCT_UNHEALTHY")?;
            }
        }
        if actual.running {
            self.health()?;
        }
        Ok(actual)
    }
    pub fn health(&self) -> Result<()> {
        super::health::probe("127.0.0.1:8790".parse().unwrap(), Duration::from_secs(2))
    }
}
