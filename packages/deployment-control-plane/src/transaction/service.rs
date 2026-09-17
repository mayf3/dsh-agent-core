use super::{
    journal::{Event, Journal},
    process::{identity, ProcessIdentity},
};
use crate::{error::require, trust::digest, Result};
use serde::{Deserialize, Serialize};
use std::process::{Child, Command, Stdio};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct ServiceImage {
    pub loaded: bool,
    pub running: bool,
    pub processes: Vec<ProcessIdentity>,
    pub generation: String,
    pub components: Vec<super::ComponentImage>,
}
pub(crate) enum ServiceDriver {
    Fixture(FixtureService),
    Native(super::native::NativeService),
}
pub(crate) struct FixtureService {
    child: Option<Child>,
}
impl FixtureService {
    pub fn new() -> Result<Self> {
        require(unsafe { libc::geteuid() } != 0, "FIXTURE_REFUSES_ROOT")?;
        Ok(Self { child: None })
    }
    fn image(&mut self) -> Result<ServiceImage> {
        let processes = match &mut self.child {
            Some(child) => {
                require(child.try_wait()?.is_none(), "SERVICE_EXITED")?;
                vec![identity(child.id())?]
            }
            None => vec![],
        };
        Ok(ServiceImage {
            loaded: true,
            running: !processes.is_empty(),
            generation: digest(&("fixture", &processes))?,
            processes,
            components: vec![],
        })
    }
    fn stop(&mut self, j: &mut Journal) -> Result<()> {
        j.append(Event::OperationIntent {
            action: "fixture-stop".into(),
            owner: digest(&identity(std::process::id())?)?,
        })?;
        if let Some(mut child) = self.child.take() {
            let process = digest(&identity(child.id())?)?;
            child.kill()?;
            let status = child.wait()?;
            j.append(Event::OperationExit {
                action: "fixture-stop".into(),
                process,
                success: !status.success(),
            })?;
        }
        j.append(Event::FixtureStopped)?;
        Ok(())
    }
    fn start(&mut self, j: &mut Journal) -> Result<()> {
        require(self.child.is_none(), "SERVICE_ALREADY_RUNNING")?;
        j.append(Event::OperationIntent {
            action: "fixture-start".into(),
            owner: digest(&identity(std::process::id())?)?,
        })?;
        let child = Command::new("/bin/sleep")
            .arg(if cfg!(test) { "2" } else { "300" })
            .env_clear()
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()?;
        let id = identity(child.id());
        self.child = Some(child);
        let process = digest(&id?)?;
        j.append(Event::OperationSpawned {
            action: "fixture-start".into(),
            process: process.clone(),
            kernel: self.child.as_ref().and_then(|c| identity(c.id()).ok()),
        })?;
        j.append(Event::FixtureStarted {
            process: identity(self.child.as_ref().unwrap().id())?,
        })?;
        Ok(())
    }
}
impl Drop for FixtureService {
    fn drop(&mut self) {
        if let Some(mut c) = self.child.take() {
            let _ = c.kill();
            let _ = c.wait();
        }
    }
}
impl ServiceDriver {
    pub fn image(&mut self) -> Result<ServiceImage> {
        match self {
            Self::Fixture(d) => d.image(),
            Self::Native(d) => d.image(),
        }
    }
    pub fn stop(&mut self, j: &mut Journal, before: &ServiceImage) -> Result<()> {
        match self {
            Self::Fixture(d) => d.stop(j),
            Self::Native(d) => d.stop(j, before),
        }
    }
    pub fn start(
        &mut self,
        j: &mut Journal,
        before: &ServiceImage,
        rollback: bool,
    ) -> Result<ServiceImage> {
        match self {
            Self::Fixture(d) => {
                if !rollback || before.running {
                    d.start(j)?;
                }
                d.image()
            }
            Self::Native(d) => d.start(j, before, rollback),
        }
    }
    pub fn prove(&mut self, expected: &ServiceImage) -> Result<ServiceImage> {
        if let Self::Native(d) = self {
            return d.prove(expected);
        }
        let actual = self.image()?;
        require(&actual == expected, "SERVICE_GENERATION_DRIFT")?;
        if let Self::Native(d) = self {
            d.health()?;
        }
        Ok(actual)
    }
}
