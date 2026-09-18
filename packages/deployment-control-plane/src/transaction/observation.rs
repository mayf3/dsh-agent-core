//! Physical observation uses the caller's existing guard; no second worker/lock.
use super::*;
use crate::{error::require, trust::digest, Error};
impl Executor {
    pub(crate) fn native_observation(
        &mut self,
        guard: &MutationGuard,
        q: &Queue,
        id: &str,
    ) -> Result<(serde_json::Value, ServiceImage)> {
        guard.binds(&self.root)?;
        let status = q.daemon_status(id)?;
        require(status.state == State::Applied, "NOT_APPLIED")?;
        let current = q
            .daemon_current_installation(&status.unit.target_runtime)?
            .ok_or(Error::new("INSTALLED_GENERATION_CHANGED"))?;
        require(current.unit_id == id, "INSTALLED_GENERATION_CHANGED")?;
        self.verify_live_baseline(q, &status.unit.target_runtime)?;
        let image = self.service.image()?;
        self.service.prove(&image)?;
        require(
            image.loaded && image.running,
            "ADOPTION_SERVICE_NOT_RUNNING",
        )?;
        require(
            image.generation == current.service_generation,
            "SERVICE_GENERATION_DRIFT",
        )?;
        let ServiceDriver::Native(native) = &self.service else {
            return Err(Error::new("NATIVE_OBSERVER_REQUIRED"));
        };
        let face = self.complete_face()?;
        require(!face.is_empty(), "INCOMPLETE_RELEASE_FACE")?;
        Ok((
            serde_json::json!({"native_enrollment_digest":digest(&native.enrollment)?,"complete_face_digest":digest(&face)?,"service_generation":image.generation,"target_runtime":status.unit.target_runtime,"host_identity":native.enrollment.host,"installation_binding_digest":current.binding_digest,"source_sha":status.unit.source_sha}),
            image,
        ))
    }
    pub(crate) fn native_runtime_identity(&self) -> Result<(u32, u32)> {
        let ServiceDriver::Native(native) = &self.service else {
            return Err(Error::new("NATIVE_OBSERVER_REQUIRED"));
        };
        let runtime = native
            .enrollment
            .services
            .iter()
            .find(|s| s.kind == NativeKind::Runtime)
            .ok_or(Error::new("SERVICE_IDENTITY"))?;
        Ok((runtime.uid, runtime.gid))
    }
}
/// Kernel/filesystem observation for the packet-bound grant constructor. This
/// contains no business/Watchdog acceptance and does not authorize activation.
#[derive(serde::Serialize)]
pub(crate) struct InitialNativeObservation {
    pub(crate) enrollment_digest: String,
    pub(crate) complete_face_digest: String,
    pub(crate) service_generation: String,
}
impl Executor {
    pub(crate) fn initial_native_observation(
        &mut self,
        guard: &MutationGuard,
    ) -> Result<InitialNativeObservation> {
        guard.binds(&self.root)?;
        require(self.active.is_none(), "TRANSACTION_ACTIVE")?;
        self.initial_face()?;
        let face = self.complete_face()?;
        require(!face.is_empty(), "INCOMPLETE_RELEASE_FACE")?;
        let service = self.service.image()?;
        self.service.prove(&service)?;
        require(
            service.loaded && service.running,
            "ADOPTION_SERVICE_NOT_RUNNING",
        )?;
        let ServiceDriver::Native(native) = &self.service else {
            return Err(Error::new("NATIVE_OBSERVER_REQUIRED"));
        };
        Ok(InitialNativeObservation {
            enrollment_digest: digest(&native.enrollment)?,
            complete_face_digest: digest(&face)?,
            service_generation: service.generation,
        })
    }
}
