//! One exact first-target observation; no historical apply or target mutation.
use super::*;
use crate::{
    error::require,
    fs::{
        file::{snapshot, write_new, FileImage},
        secure::Dir,
    },
    trust::{digest, valid_digest, valid_id, verify_signed},
    Error,
};
use serde::{Deserialize, Serialize};
use std::os::unix::fs::MetadataExt;
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct BaselineRecord {
    grant: Signed<AdoptionGrant>,
    receipt: AdoptedBaselineReceipt,
    face: Vec<(String, Option<FileImage>)>,
    service: ServiceImage,
}
pub(crate) struct VerifiedAdoptionGrant {
    grant: Signed<AdoptionGrant>,
}
impl VerifiedAdoptionGrant {
    pub(crate) fn get(&self) -> &Signed<AdoptionGrant> {
        &self.grant
    }
}
pub(crate) struct VerifiedAdoptedBaseline {
    receipt: AdoptedBaselineReceipt,
}
impl VerifiedAdoptedBaseline {
    pub(crate) fn receipt(&self) -> &AdoptedBaselineReceipt {
        &self.receipt
    }
}
pub(crate) struct VerifiedAdoptionFinalization {
    receipt: AdoptedBaselineReceipt,
}
impl VerifiedAdoptionFinalization {
    pub(crate) fn receipt(&self) -> &AdoptedBaselineReceipt {
        &self.receipt
    }
}
fn read<T: serde::de::DeserializeOwned>(root: &Dir, name: &str) -> Result<T> {
    Ok(serde_json::from_slice(
        &snapshot(
            &root.open_file(name, libc::O_RDONLY, 0)?,
            root.uid,
            384 * 1024 * 1024,
        )?
        .bytes,
    )?)
}
fn immutable<T: Serialize>(root: &Dir, name: &str, value: &T) -> Result<()> {
    let bytes = crate::trust::canonical_bytes(value)?;
    require(bytes.len() <= 384 * 1024 * 1024, "ADOPTION_RECORD_SIZE")?;
    match root.open_file(name, libc::O_RDONLY, 0) {
        Ok(file) => require(
            snapshot(&file, root.uid, 384 * 1024 * 1024)?.bytes == bytes,
            "ADOPTION_IMMUTABLE",
        ),
        Err(e) if e.code() == "ABSENT" => {
            write_new(
                root,
                name,
                &bytes,
                root.uid,
                root.file.metadata()?.gid(),
                0o400,
            )?;
            Ok(())
        }
        Err(e) => Err(e),
    }
}
impl Executor {
    pub(crate) fn authorize_adoption(
        &mut self,
        guard: &MutationGuard,
        c: &Catalog,
        g: &Signed<AdoptionGrant>,
        now: u64,
    ) -> Result<VerifiedAdoptionGrant> {
        let a = &g.payload;
        verify_signed(g, c, &a.profile_id)?;
        require(
            a.version == 1
                && a.issued_at <= now
                && now < a.expires_at
                && a.expires_at - a.issued_at <= 86400,
            "ADOPTION_EXPIRED",
        )?;
        valid_id(&a.operation_id)?;
        valid_id(&a.release.goal_id)?;
        valid_id(&a.release.acceptance_revision)?;
        crate::issuer::source::source_sha(&a.release.source_sha)?;
        for hash in [
            &a.package_digest,
            &a.controller_sha256,
            &a.profile_digest,
            &a.enrollment_digest,
            &a.configuration_digest,
            &a.issuer_bindings_digest,
            &a.owner_acceptance_digest,
            &a.lifecycle_evidence_digest,
            &a.initial_face_digest,
            &a.release.artifact_sha256,
            &a.release.manifest_digest,
            &a.canary_plan_digest,
            &a.observation_policy_digest,
        ] {
            valid_digest(hash)?;
        }
        let profile = c
            .profiles
            .get(&a.profile_id)
            .ok_or(Error::new("PROFILE_NOT_ALLOWED"))?;
        require(
            a.host == profile.host
                && a.profile_digest == crate::bootstrap::profile_digest(profile)?,
            "ADOPTION_BINDING",
        )?;
        let enrollment = match &self.service {
            service::ServiceDriver::Native(d) => digest(&d.enrollment)?,
            service::ServiceDriver::Fixture(_) => digest(&self.slots)?,
        };
        require(enrollment == a.enrollment_digest, "ADOPTION_BINDING")?;
        if matches!(self.service, service::ServiceDriver::Native(_)) {
            crate::service::adoption::verify_materialization(&self.root, g)?;
            let observed = self.initial_native_observation(guard)?;
            require(
                observed.enrollment_digest == a.enrollment_digest
                    && observed.complete_face_digest == a.initial_face_digest
                    && observed.service_generation == a.service_generation,
                "ADOPTION_NATIVE_BINDING",
            )?;
            let config: crate::service::Configuration = read(&self.root, "service.json")?;
            let bindings: serde_json::Value = read(&self.root, "issuer-bindings.json")?;
            require(
                config.first_target_adoption.as_deref() == Some(a.operation_id.as_str())
                    && digest(&config)? == a.configuration_digest
                    && digest(&bindings)? == a.issuer_bindings_digest,
                "ADOPTION_BINDING",
            )?;
        }
        Ok(VerifiedAdoptionGrant { grant: g.clone() })
    }
    fn verify_adoption_face(&mut self, record: &BaselineRecord) -> Result<()> {
        require(
            record.receipt.complete_face_digest == digest(&record.face)?
                && record.receipt.service_generation == record.service.generation,
            "ADOPTION_BINDING",
        )?;
        let face = self.complete_face()?;
        require(
            !face.is_empty() && face.len() == record.face.len(),
            "INCOMPLETE_RELEASE_FACE",
        )?;
        for ((path, actual), (expected_path, expected)) in face.iter().zip(&record.face) {
            require(
                path == expected_path
                    && match (actual, expected) {
                        (None, None) => true,
                        (Some(a), Some(b)) => a.content_matches(b),
                        _ => false,
                    },
                "PREIMAGE_DRIFT",
            )?;
        }
        let actual = self.service.image()?;
        self.service.prove(&actual)?;
        require(
            actual.generation == record.receipt.service_generation,
            "SERVICE_GENERATION_DRIFT",
        )
    }
    fn adoption_dir(&self, hash: &str) -> Result<Dir> {
        valid_digest(hash)?;
        self.root.mkdir("adoptions")?.mkdir(hash)
    }
    #[expect(
        clippy::too_many_arguments,
        reason = "Distinct authenticated adoption bindings remain explicit"
    )]
    pub fn adopt_existing(
        &mut self,
        guard: &MutationGuard,
        q: &Queue,
        c: &Catalog,
        actor: &Actor,
        p: &Proposal,
        g: &Signed<AdoptionGrant>,
        now: u64,
    ) -> Result<AdoptedBaselineReceipt> {
        guard.binds(&self.root)?;
        require(self.active.is_none(), "TRANSACTION_ACTIVE")?;
        let proof = self.authorize_adoption(guard, c, g, now)?;
        require(
            g.payload.profile_id == p.deployment_profile
                && g.payload.release.matches(p)
                && p.desired.payload.expected_target_generation == 0
                && p.desired.payload.revision == 1,
            "ADOPTION_BINDING",
        )?;
        crate::trust::validate_proposal(c, actor, p, now)?;
        q.observe_policy(c, &p.deployment_profile, &p.policy, now)?;
        for name in self.journals.names()? {
            require(
                Journal::load(&self.journals, &name)?.terminal(),
                "RECOVERY_REQUIRED",
            )?;
        }
        q.reserve_adoption(&proof, &p.desired.payload.target_runtime)?;
        q.pin_adoption_proposal(&proof, p)?;
        #[cfg(test)]
        super::fault::point("adoption-reserved");
        let grant_hash = digest(g)?;
        let directory = self.adoption_dir(&grant_hash)?;
        let id = match q.adoption_unit(g)? {
            Some(id) => id,
            None => {
                let submitted = q.submit_adoption(c, actor, p, now, &proof)?;
                #[cfg(test)]
                super::fault::point("adoption-unit-admitted");
                q.bind_adoption_unit(&proof, &submitted.unit_id)?;
                submitted.unit_id
            }
        };
        let record = match read::<BaselineRecord>(&directory, "observed.json") {
            Ok(record) => {
                require(
                    record.grant == *g && record.receipt.unit_id == id,
                    "ADOPTION_BINDING",
                )?;
                record
            }
            Err(e) if e.code() == "ABSENT" => {
                q.revalidate(c, &id, &p.policy, now)?;
                self.initial_face()?;
                let artifact = self.artifacts.import(
                    &p.build.payload.artifact_sha256,
                    &p.build.payload.manifest_digest,
                )?;
                self.validate_slots(&artifact.manifest)?;
                for entry in &artifact.manifest.entries {
                    let image = self
                        .target
                        .read(&entry.path)?
                        .ok_or(Error::new("PREIMAGE_DRIFT"))?;
                    let (mode, gid) = self.slot_mode_gid(&entry.path, entry.executable)?;
                    require(
                        image.bytes == artifact.read(&entry.path)?
                            && image.mode == mode
                            && image.gid == gid,
                        "PREIMAGE_DRIFT",
                    )?;
                }
                let face = self.complete_face()?;
                require(
                    !face.is_empty() && digest(&face)? == g.payload.initial_face_digest,
                    "ADOPTION_PREIMAGE",
                )?;
                let service = self.service.image()?;
                self.service.prove(&service)?;
                require(
                    !matches!(self.service, service::ServiceDriver::Native(_))
                        || (service.loaded && service.running),
                    "ADOPTION_SERVICE_NOT_RUNNING",
                )?;
                require(
                    service.generation == g.payload.service_generation,
                    "SERVICE_GENERATION_DRIFT",
                )?;
                let status = q.daemon_status(&id)?;
                let attachments = q.daemon_attachments(&id)?;
                let mut reviews: Vec<_> = attachments
                    .iter()
                    .flat_map(|a| a.proposal.reviews.iter())
                    .map(digest)
                    .collect::<Result<_>>()?;
                reviews.sort();
                reviews.dedup();
                let receipt = AdoptedBaselineReceipt {
                    version: 1,
                    origin: InstallationOrigin::ObservedExistingInstallation,
                    operation_id: g.payload.operation_id.clone(),
                    grant_digest: grant_hash.clone(),
                    unit_id: id.clone(),
                    target_runtime: status.unit.target_runtime,
                    target_generation: 1,
                    attempt: 0,
                    artifact_sha256: status.unit.artifact_sha256,
                    manifest_digest: status.unit.manifest_digest,
                    source_sha: status.unit.source_sha,
                    profile_revision: status.unit.profile_revision,
                    build_attestation_digest: status.unit.build_attestation_digest,
                    enrollment_digest: g.payload.enrollment_digest.clone(),
                    policy_digest: digest(&p.policy)?,
                    review_digests: reviews,
                    attachment_digests: attachments.iter().map(|a| a.digest.clone()).collect(),
                    dependency_receipts: p
                        .dependencies
                        .iter()
                        .map(|d| d.receipt_digest.clone())
                        .collect(),
                    caller: actor.id.clone(),
                    complete_face_digest: digest(&face)?,
                    service_generation: service.generation.clone(),
                    capability: "installed-release".into(),
                    install_count: 0,
                    restart_count: 0,
                    step_results: vec![
                        "authenticated-current-observation".into(),
                        "zero-target-writes".into(),
                        "zero-lifecycle-operations".into(),
                    ],
                };
                let record = BaselineRecord {
                    grant: g.clone(),
                    receipt,
                    face,
                    service,
                };
                immutable(&directory, "observed.json", &record)?;
                #[cfg(test)]
                super::fault::point("adoption-observed");
                record
            }
            Err(e) => return Err(e),
        };
        require(
            record.grant == *g
                && record.receipt.grant_digest == grant_hash
                && record.receipt.complete_face_digest == g.payload.initial_face_digest
                && record.receipt.service_generation == g.payload.service_generation
                && record.receipt.artifact_sha256 == p.build.payload.artifact_sha256
                && record.receipt.manifest_digest == p.build.payload.manifest_digest,
            "ADOPTION_BINDING",
        )?;
        self.artifacts
            .import(
                &record.receipt.artifact_sha256,
                &record.receipt.manifest_digest,
            )?
            .verify()?;
        self.verify_adoption_face(&record)?;
        let publication = (|| {
            q.publish_adoption(&VerifiedAdoptedBaseline {
                receipt: record.receipt.clone(),
            })?;
            #[cfg(test)]
            super::fault::point("adoption-published");
            self.verify_adoption_face(&record)?;
            immutable(&directory, "finalized.json", &digest(&record)?)?;
            #[cfg(test)]
            super::fault::point("adoption-finalized");
            let done: String = read(&directory, "finalized.json")?;
            require(done == digest(&record)?, "ADOPTION_FINALIZATION")?;
            q.complete_adoption_baseline(VerifiedAdoptionFinalization {
                receipt: record.receipt.clone(),
            })
        })();
        if let Err(error) = publication {
            q.latch_executor_failure(&digest(&(
                &id,
                error.code(),
                "adoption-publication-uncertain",
            ))?)?;
            return Err(error);
        }
        Ok(record.receipt)
    }
    pub(super) fn verify_adopted_baseline(&self, receipt: &AdoptedBaselineReceipt) -> Result<()> {
        let directory = self.root.child("adoptions")?.child(&receipt.grant_digest)?;
        let record: BaselineRecord = read(&directory, "observed.json")?;
        let done: String = read(&directory, "finalized.json")?;
        require(
            record.receipt == *receipt && done == digest(&record)?,
            "ADOPTION_FINALIZATION",
        )?;
        let face = self.complete_face()?;
        require(
            face.len() == record.face.len() && !face.is_empty(),
            "INCOMPLETE_RELEASE_FACE",
        )?;
        for ((path, actual), (expected_path, expected)) in face.iter().zip(&record.face) {
            require(
                path == expected_path
                    && match (actual, expected) {
                        (None, None) => true,
                        (Some(a), Some(b)) => a.content_matches(b),
                        _ => false,
                    },
                "PREIMAGE_DRIFT",
            )?;
        }
        Ok(())
    }
}
