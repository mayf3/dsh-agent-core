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

/// Internal maintenance inputs carry no activation or acceptance authority.
/// Only the fixed operation consumes this type; it is not a wire/admission model.
#[derive(Clone)]
pub(crate) struct NativeMaintenanceInput {
    pub runtime_root: String,
    pub runtime_startup: RuntimeStartup,
    pub node_sha256: String,
    pub loader_files: Vec<crate::bootstrap::LoaderFile>,
    pub launchctl_sha256: String,
    pub plutil_sha256: String,
    pub services: Vec<ServiceEnrollment>,
}
impl NativeMaintenanceInput {
    fn admitted(e: &NativeEnrollment) -> Self {
        Self {
            runtime_root: e.runtime_root.clone(),
            runtime_startup: e.runtime_startup,
            node_sha256: e.node_sha256.clone(),
            loader_files: e.loader_files.clone(),
            launchctl_sha256: e.launchctl_sha256.clone(),
            plutil_sha256: e.plutil_sha256.clone(),
            services: e.services.clone(),
        }
    }
    pub(crate) fn validate(&self) -> Result<()> {
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
            self.services.iter().map(|s| s.kind).collect::<Vec<_>>()
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
        require(
            self.runtime_root.starts_with("/Users/") && !self.runtime_root.contains(".."),
            "PROFILE_NOT_ALLOWED",
        )
    }
    pub(crate) fn argv(&self, kind: NativeKind) -> Vec<String> {
        let mut argv = kind.argv(&self.runtime_root);
        if kind == NativeKind::Runtime && self.runtime_startup == RuntimeStartup::CatchupZero {
            argv.extend(["--catchup".into(), "0".into()]);
        }
        argv
    }
}
pub(crate) struct NativeMaintenanceService {
    pub root: Dir,
    pub input: NativeMaintenanceInput,
}
impl NativeService {
    fn driver(&self) -> NativeDriver<'_> {
        NativeDriver {
            root: &self.root,
            input: NativeMaintenanceInput::admitted(&self.enrollment),
            admitted: Some(&self.enrollment),
        }
    }
    pub fn image(&self) -> Result<ServiceImage> {
        self.driver().image()
    }
    pub fn stop(&self, journal: &mut Journal, before: &ServiceImage) -> Result<()> {
        self.driver().stop(journal, before)
    }
    pub fn start(
        &self,
        journal: &mut Journal,
        before: &ServiceImage,
        rollback: bool,
    ) -> Result<ServiceImage> {
        self.driver().start(journal, before, rollback)
    }
    pub fn prove(&self, expected: &ServiceImage) -> Result<ServiceImage> {
        self.driver().prove(expected)
    }
    pub fn health(&self) -> Result<()> {
        self.driver().health()
    }
}
impl NativeMaintenanceService {
    fn driver(&self) -> NativeDriver<'_> {
        NativeDriver {
            root: &self.root,
            input: self.input.clone(),
            admitted: None,
        }
    }
    pub(crate) fn components(&self) -> Result<Vec<ComponentImage>> {
        self.input.validate()?;
        crate::bootstrap::verify_platform_launchctl(&self.input.launchctl_sha256)?;
        let driver = self.driver();
        self.input
            .services
            .iter()
            .map(|e| driver.component(e))
            .collect()
    }
    pub(crate) fn stop(&self, journal: &mut Journal, before: &ServiceImage) -> Result<()> {
        self.input.validate()?;
        self.driver().stop(journal, before)
    }
    pub(crate) fn start(
        &self,
        journal: &mut Journal,
        before: &ServiceImage,
        rollback: bool,
    ) -> Result<ServiceImage> {
        self.driver().start(journal, before, rollback)
    }
    pub(crate) fn prove(&self, expected: &ServiceImage) -> Result<ServiceImage> {
        self.driver().prove(expected)
    }
}
struct NativeDriver<'a> {
    root: &'a Dir,
    input: NativeMaintenanceInput,
    admitted: Option<&'a NativeEnrollment>,
}
impl NativeDriver<'_> {
    fn argv(&self, kind: NativeKind) -> Vec<String> {
        match self.admitted {
            Some(e) => e.argv(kind),
            None => self.input.argv(kind),
        }
    }
    fn read_command(&self, args: &[&str]) -> Result<(i32, String)> {
        let name = "launchctl-readback";
        let file = write_new(
            self.root,
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
            require(process_argv(pid)? == self.argv(e.kind), "SERVICE_ARGV")?;
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
            .input
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
        if let Some(enrollment) = self.admitted {
            enrollment.validate()?;
        }
        self.input.validate()?;
        crate::bootstrap::loader::installed(&self.input.loader_files)?;
        crate::bootstrap::verify_platform_launchctl(&self.input.launchctl_sha256)?;
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
                == self.input.node_sha256,
            "SERVICE_DEPENDENCY_DRIFT",
        )?;
        let dir = Dir::open(std::path::Path::new("/Library/LaunchDaemons"), 0)?;
        for e in &self.input.services {
            let name = e.kind.plist().rsplit('/').next().unwrap();
            let bytes = snapshot(&dir.open_file(name, libc::O_RDONLY, 0)?, 0, 1024 * 1024)?.bytes;
            require(sha(&bytes) == e.plist_sha256, "SERVICE_DEPENDENCY_DRIFT")?;
            let plist = crate::bootstrap::verify_service_plist(&bytes, &self.input.plutil_sha256)?;
            require(
                plist.get("ProgramArguments") == Some(&serde_json::json!(self.argv(e.kind))),
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
            let e = self.input.services.iter().find(|s| s.kind == kind).unwrap();
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
            super::process::prove_no_service_process(&self.argv(kind))?;
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
        for e in &self.input.services {
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
/// Fixed first-live maintenance census before replacing the old Node closure.
/// Loader preimage validation belongs to the operation's complete inventory.
pub(crate) fn first_live_components(input: &NativeMaintenanceInput) -> Result<Vec<ComponentImage>> {
    require(unsafe { libc::geteuid() } == 0, "PRODUCTION_REQUIRES_ROOT")?;
    NativeMaintenanceService {
        root: Dir::open(std::path::Path::new("/private/var/db/agent-deployd"), 0)?,
        input: input.clone(),
    }
    .components()
}
