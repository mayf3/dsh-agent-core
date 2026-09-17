mod apply;
mod journal;
mod native;
mod native_profile;
mod process;
mod recovery;
mod service;
use crate::{
    fs::{secure::Dir, ArtifactStore, FixtureRoots, MutationGuard, TargetRoot},
    model::*,
    queue::Queue,
    Result,
};
use journal::Journal;
pub use native_profile::{
    parse_launchd, ComponentImage, EnrolledFile, NativeEnrollment, NativeKind, ServiceEnrollment,
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
        })
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
                && crate::trust::digest(profile)? == enrollment.profile_digest
                && profile.revision == enrollment.profile_revision
                && profile.launchd_domain == "system"
                && profile.launchd_label == "ai.agent-core.runtime"
                && profile.required_review_scopes.contains(&"root-code".into()),
            "PROFILE_NOT_ALLOWED",
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
            service: ServiceDriver::Native(native::NativeService {
                root: service_root,
                enrollment,
            }),
            root,
            active: None,
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
