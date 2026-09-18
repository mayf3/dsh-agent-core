//! Offline inputs omit observations that only the protected lifecycle can produce.
use super::lifecycle::VerifiedLifecycle;
use crate::{
    bootstrap::LoaderFile,
    model::Catalog,
    service::{Caller, Configuration, VerifierBinding},
    transaction::{
        EnrolledFile, NativeEnrollment, NativeMaintenanceInput, RuntimeStartup, ServiceEnrollment,
    },
    Result,
};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

use crate::bootstrap::socket::SocketAncestorPlan;
#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct ConfigurationTemplate {
    pub catalog: Catalog,
    pub callers: Vec<Caller>,
    pub producers: Vec<String>,
    pub verifiers: BTreeMap<String, VerifierBinding>,
    pub socket_gid: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub first_target_adoption: Option<String>,
    #[serde(default)]
    pub socket_ancestor: Option<SocketAncestorPlan>,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct NativeEnrollmentTemplate {
    pub host: String,
    pub caller_uids: Vec<u32>,
    pub required_facets: Vec<String>,
    pub profile_revision: String,
    pub profile_id: String,
    pub profile_digest: String,
    pub initial_files: Vec<EnrolledFile>,
    pub runtime_root: String,
    #[serde(default, skip_serializing_if = "RuntimeStartup::legacy")]
    pub runtime_startup: RuntimeStartup,
    pub node_sha256: String,
    pub loader_files: Vec<LoaderFile>,
    pub launchctl_sha256: String,
    pub plutil_sha256: String,
    pub services: Vec<ServiceEnrollment>,
}
impl ConfigurationTemplate {
    pub(super) fn bind(&self, life: &VerifiedLifecycle) -> Result<Configuration> {
        crate::trust::valid_digest(life.digest())?;
        Ok(Configuration {
            catalog: self.catalog.clone(),
            callers: self.callers.clone(),
            producers: self.producers.clone(),
            verifiers: self.verifiers.clone(),
            socket_gid: self.socket_gid,
            first_target_adoption: self.first_target_adoption.clone(),
            socket_ancestor: self
                .socket_ancestor
                .as_ref()
                .map(|plan| plan.bind(life.digest()))
                .transpose()?,
        })
    }
}
impl NativeEnrollmentTemplate {
    pub(super) fn validate(&self) -> Result<()> {
        crate::transaction::NativeProfileInput {
            profile_id: &self.profile_id,
            profile_revision: &self.profile_revision,
            profile_digest: &self.profile_digest,
            initial_files: &self.initial_files,
            runtime_root: &self.runtime_root,
            node_sha256: &self.node_sha256,
            loader_files: &self.loader_files,
            launchctl_sha256: &self.launchctl_sha256,
            plutil_sha256: &self.plutil_sha256,
            services: &self.services,
        }
        .validate()
    }
    pub(super) fn bind(&self, life: &VerifiedLifecycle) -> Result<NativeEnrollment> {
        crate::trust::valid_digest(life.digest())?;
        let bound = NativeEnrollment {
            host: self.host.clone(),
            caller_uids: self.caller_uids.clone(),
            lifecycle_denial_digest: life.digest().into(),
            required_facets: self.required_facets.clone(),
            profile_revision: self.profile_revision.clone(),
            profile_id: self.profile_id.clone(),
            profile_digest: self.profile_digest.clone(),
            initial_files: self.initial_files.clone(),
            runtime_root: self.runtime_root.clone(),
            runtime_startup: self.runtime_startup,
            node_sha256: self.node_sha256.clone(),
            loader_files: self.loader_files.clone(),
            launchctl_sha256: self.launchctl_sha256.clone(),
            plutil_sha256: self.plutil_sha256.clone(),
            services: self.services.clone(),
        };
        bound.validate()?;
        Ok(bound)
    }
    pub(super) fn maintenance(&self) -> Result<NativeMaintenanceInput> {
        self.validate()?;
        let input = NativeMaintenanceInput {
            runtime_root: self.runtime_root.clone(),
            runtime_startup: self.runtime_startup,
            node_sha256: self.node_sha256.clone(),
            loader_files: self.loader_files.clone(),
            launchctl_sha256: self.launchctl_sha256.clone(),
            plutil_sha256: self.plutil_sha256.clone(),
            services: self.services.clone(),
        };
        input.validate()?;
        Ok(input)
    }
}
#[cfg(test)]
#[path = "../../test/first_live/template.rs"]
mod tests;
