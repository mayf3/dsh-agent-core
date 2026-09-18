use super::{gate, native, records::*};
use crate::{error::require, fs::secure::Dir, service::Intake, trust::digest, Result};
use std::{
    os::unix::fs::{FileTypeExt, MetadataExt},
    path::Path,
    time::{Duration, Instant},
};
pub(crate) struct Startup {
    readback: Option<Readback>,
}
impl Startup {
    pub(crate) fn first(&self) -> bool {
        self.readback.is_some()
    }
    pub(crate) fn admit(intake: &Intake, socket: &Path) -> Result<Self> {
        match gate::startup(
            &intake.root,
            intake.config.first_target_adoption.as_deref(),
            super::super::server::now()?,
        )? {
            gate::Phase::Ordinary | gate::Phase::Complete => Ok(Self { readback: None }),
            gate::Phase::Readback(b) => {
                require(
                    native::controller()? == b.controller_digest,
                    "ENABLE_CONTROLLER_BINDING",
                )?;
                let process = crate::transaction::first_live_process_identity(std::process::id())?;
                require(
                    process.uid == 0
                        && process.gid == 0
                        && process.executable == native::EXECUTABLE,
                    "ENABLE_GENERATION_BINDING",
                )?;
                let m = std::fs::symlink_metadata(socket)?;
                require(
                    m.file_type().is_socket()
                        && m.uid() == 0
                        && m.gid() == intake.config.socket_gid,
                    "ENABLE_SOCKET_BINDING",
                )?;
                let rb = Readback {
                    binding: *b,
                    process,
                    socket_device: m.dev(),
                    socket_inode: m.ino(),
                };
                let area = intake.root.child("first-live-operation")?;
                gate::publish(&area, "daemon-readback.json", &rb)?;
                wait(
                    &intake.root,
                    intake.config.first_target_adoption.as_deref(),
                    &rb,
                    || {
                        if gate::optional::<Admission>(&area, "enable-admission.json")?.is_none() {
                            return Ok(false);
                        }
                        gate::initialization(&area, &rb)?;
                        Ok(true)
                    },
                )?;
                Ok(Self { readback: Some(rb) })
            }
        }
    }
    pub(crate) fn check_initialization(&self, intake: &Intake) -> Result<()> {
        if let Some(rb) = &self.readback {
            gate::startup(
                &intake.root,
                intake.config.first_target_adoption.as_deref(),
                super::super::server::now()?,
            )?;
            require(
                crate::transaction::first_live_process_identity(std::process::id())? == rb.process,
                "ENABLE_GENERATION_BINDING",
            )?;
            require(
                super::super::server::now()? < rb.binding.expires_at,
                "ENABLE_EXPIRED",
            )?;
            gate::initialization(&intake.root.child("first-live-operation")?, rb)
        } else {
            gate::ordinary(
                &intake.root,
                intake.config.first_target_adoption.as_deref(),
                super::super::server::now()?,
            )
        }
    }
    pub(crate) fn check_queue(&self, intake: &Intake, q: &crate::queue::Queue) -> Result<()> {
        let r = self
            .readback
            .as_ref()
            .ok_or_else(|| crate::Error::new("ENABLE_ADMISSION_PENDING"))?;
        self.check_initialization(intake)?;
        q.verify_first_live_startup(&r.binding.operation_id, &r.binding.standing_digest)
    }
    pub(crate) fn ready(self, intake: &Intake) -> Result<()> {
        if let Some(rb) = self.readback {
            let area = intake.root.child("first-live-operation")?;
            gate::initialization(&area, &rb)?;
            let admission: Admission = gate::read(&area, "enable-admission.json")?;
            gate::publish(
                &area,
                "daemon-ready.json",
                &Ready {
                    admission_digest: digest(&admission)?,
                    readback: rb.clone(),
                },
            )?;
            wait(
                &intake.root,
                intake.config.first_target_adoption.as_deref(),
                &rb,
                || {
                    Ok(matches!(
                        gate::startup(
                            &intake.root,
                            intake.config.first_target_adoption.as_deref(),
                            super::super::server::now()?
                        )?,
                        gate::Phase::Complete
                    ))
                },
            )?;
        }
        Ok(())
    }
}
fn wait(
    root: &Dir,
    op: Option<&str>,
    rb: &Readback,
    mut done: impl FnMut() -> Result<bool>,
) -> Result<()> {
    let end = Instant::now() + Duration::from_secs(60);
    loop {
        require(
            Instant::now() < end && super::super::server::now()? < rb.binding.expires_at,
            "ENABLE_READBACK_TIMEOUT",
        )?;
        require(
            crate::transaction::first_live_process_identity(std::process::id())? == rb.process,
            "ENABLE_GENERATION_BINDING",
        )?;
        gate::startup(root, op, super::super::server::now()?)?;
        if done()? {
            return Ok(());
        }
        std::thread::sleep(Duration::from_millis(25));
    }
}
pub(crate) fn preflight(intake: &Intake) -> Result<bool> {
    let phase = gate::startup(
        &intake.root,
        intake.config.first_target_adoption.as_deref(),
        super::super::server::now()?,
    )?;
    if !matches!(phase, gate::Phase::Ordinary) {
        let binding: Binding = gate::read(
            &intake.root.child("first-live-operation")?,
            "enable-intent.json",
        )?;
        require(
            native::controller()? == binding.controller_digest,
            "ENABLE_CONTROLLER_BINDING",
        )?;
    }
    if matches!(phase, gate::Phase::Readback(_)) {
        gate::absent(
            &intake.root.child("first-live-operation")?,
            "daemon-readback.json",
        )?;
    }
    Ok(matches!(phase, gate::Phase::Readback(_)))
}
