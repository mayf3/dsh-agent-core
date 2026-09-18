mod apply;
mod health;
mod journal;
mod native;
mod native_profile;
mod observation;
mod predecessor;
mod process;
pub(crate) use predecessor::VerifiedReadOnlyPredecessor;
mod recovery;
mod remediation;
pub(crate) use remediation::RecoveryFailure;
mod service;
mod slots;
use crate::{
    fs::{secure::Dir, ArtifactStore, FixtureRoots, MutationGuard, TargetRoot},
    model::*,
    queue::Queue,
    Result,
};
use journal::Journal;
pub use native_profile::{
    parse_launchd, ComponentImage, EnrolledFile, NativeEnrollment, NativeKind, RuntimeStartup,
    ServiceEnrollment,
};
pub use process::ProcessIdentity;
pub use service::ServiceImage;
use service::{FixtureService, ServiceDriver};

pub struct Executor {
    root: Dir,
    target: TargetRoot,
    artifacts: ArtifactStore,
    journals: Dir,
    service: ServiceDriver,
    active: Option<Journal>,
    slots: Option<Vec<EnrolledFile>>,
    #[cfg(test)]
    gate_time: Option<u64>,
    #[cfg(test)]
    fail_finalize_health: Option<&'static str>,
}
pub struct Applied {
    pub receipt: TransactionReceipt,
}
impl Executor {
    pub fn fixture(roots: &FixtureRoots) -> Result<Self> {
        Ok(Self {
            root: Dir {
                file: roots.root.file.try_clone()?,
                uid: roots.root.uid,
            },
            target: roots.target()?,
            artifacts: roots.artifacts()?,
            journals: roots.root.mkdir("transactions")?,
            service: ServiceDriver::Fixture(FixtureService::new()?),
            active: None,
            slots: None,
            #[cfg(test)]
            gate_time: None,
            #[cfg(test)]
            fail_finalize_health: None,
        })
    }
    /// Private, non-root fixture targets share the host state and permanent lock.
    /// Target identifiers come only from the fixture catalog, never socket paths.
    pub(crate) fn fixture_target(roots: &FixtureRoots, target: &str) -> Result<Self> {
        crate::trust::valid_id(target)?;
        let mut executor = Self::fixture(roots)?;
        executor.target = TargetRoot {
            dir: roots.root.mkdir("targets")?.mkdir(target)?,
        };
        executor.journals = roots.root.mkdir("transactions")?.mkdir(target)?;
        Ok(executor)
    }
    /// Task 3 may call only after validating the root-owned activation against Catalog.
    /// All physical roots remain compiled; no runtime path or command selection.
    pub fn production(profile: &Profile) -> Result<Self> {
        use crate::{
            error::require,
            fs::file::{snapshot, MAX_FILE},
        };
        use std::path::Path;
        require(unsafe { libc::geteuid() } == 0, "PRODUCTION_REQUIRES_ROOT")?;
        let root = Dir::open(Path::new("/private/var/db/agent-deployd"), 0)?;
        let bytes = snapshot(
            &root.open_file("activation.json", libc::O_RDONLY, 0)?,
            0,
            MAX_FILE,
        )?
        .bytes;
        let enrollment: NativeEnrollment = serde_json::from_slice(&bytes)?;
        require(
            profile.enabled
                && crate::bootstrap::profile_digest(profile)? == enrollment.profile_digest
                && profile.revision == enrollment.profile_revision
                && profile.launchd_domain == "system"
                && profile.launchd_label == "ai.agent-core.runtime"
                && profile.required_review_scopes.contains(&"root-code".into()),
            "PROFILE_NOT_ALLOWED",
        )?;
        let config: crate::service::Configuration = serde_json::from_slice(
            &snapshot(
                &root.open_file("service.json", libc::O_RDONLY, 0)?,
                0,
                MAX_FILE,
            )?
            .bytes,
        )?;
        crate::bootstrap::validate_native_binding(
            &config,
            &enrollment,
            &crate::bootstrap::observed_host()?,
            true,
        )?;
        let service_root = Dir {
            file: root.file.try_clone()?,
            uid: 0,
        };
        Ok(Self {
            target: TargetRoot {
                dir: Dir::open(Path::new("/usr/local/libexec/agent-core/app"), 0)?,
            },
            artifacts: ArtifactStore {
                staging: root.child("staging")?,
                sealed: root.child("sealed")?,
            },
            journals: root.child("transactions")?,
            slots: Some(enrollment.initial_files.clone()),
            service: ServiceDriver::Native(Box::new(native::NativeService {
                root: service_root,
                enrollment,
            })),
            root,
            active: None,
            #[cfg(test)]
            gate_time: None,
            #[cfg(test)]
            fail_finalize_health: None,
        })
    }
    pub fn lock(&self) -> Result<MutationGuard> {
        MutationGuard::acquire(&self.root, false)
    }
    fn transition(&self, q: &Queue, id: &str, next: State, evidence: &str) -> Result<()> {
        let s = q.daemon_status(id)?;
        q.transition(id, s.revision, next, evidence)?;
        #[cfg(test)]
        fault::point(&format!("queue-{next:?}"));
        Ok(())
    }
}

#[cfg(test)]
#[path = "../../test/transaction_crashes.rs"]
mod crashes;

// Constructed only after descriptor and service readback under the matching OS guard.
#[derive(serde::Serialize)]
pub(crate) struct RestorationProof {
    pub unit: String,
    pub attempt: u32,
    pub status_revision: u64,
    pub evidence_digest: String,
}

pub(crate) struct VerifiedRestoration(pub(crate) RestoredInstallation);

#[cfg(test)]
#[path = "../../test/transaction_repair.rs"]
mod repair;

#[cfg(test)]
pub(crate) mod fault;
#[cfg(test)]
#[path = "../../test/transaction_faults.rs"]
mod faults;

pub(crate) struct VerifiedFinalization(pub(crate) TransactionReceipt);

#[cfg(test)]
#[path = "../../test/transaction_finalization.rs"]
mod finalization_tests;

#[cfg(test)]
#[path = "../../test/transaction_fixture.rs"]
pub(crate) mod test_fixture;

#[cfg(test)]
#[path = "../../test/common/final_transaction.rs"]
mod final_repair_tests;

#[cfg(test)]
#[path = "../../test/adoption/executed_predecessor.rs"]
mod executed_predecessor_tests;

#[cfg(test)]
#[path = "../../test/adoption/adopted_baseline.rs"]
mod adopted_baseline_tests;
pub(crate) mod adoption;

pub(crate) mod activation;
#[cfg(test)]
#[path = "../../test/adoption/adopted_chain.rs"]
mod adopted_chain_tests;
#[cfg(test)]
#[path = "../../test/adoption/adoption_activation.rs"]
mod adoption_activation_tests;
#[cfg(test)]
#[path = "../../test/adoption/adoption_crashes.rs"]
mod adoption_crash_tests;
