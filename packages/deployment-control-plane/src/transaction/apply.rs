use super::*;
use crate::{
    error::require,
    fs::{file::FileImage, SealedArtifact},
    trust::digest,
    Error,
};
use journal::Event;
type PrecheckedImage = (
    SealedArtifact,
    Vec<(String, Option<FileImage>)>,
    ServiceImage,
);

impl Executor {
    /// Guard is borrowed, never consumed or released. Train retains it through acceptance.
    #[expect(
        clippy::too_many_arguments,
        reason = "Reviewed API keeps distinct guard, queue, authority catalog, unit, policy, trusted time and caller bindings explicit"
    )]
    pub fn apply(
        &mut self,
        guard: &MutationGuard,
        q: &Queue,
        c: &Catalog,
        id: &str,
        policy: &Signed<Policy>,
        now: u64,
        caller: &str,
    ) -> Result<Applied> {
        let started = std::time::Instant::now();
        guard.binds(&self.root)?;
        require(self.active.is_none(), "TRANSACTION_ACTIVE")?;
        for name in self.journals.names()? {
            require(
                Journal::load(&self.journals, &name)?.terminal(),
                "RECOVERY_REQUIRED",
            )?;
        }
        let status = q.daemon_status(id)?;
        self.transition(
            q,
            id,
            State::Precheck,
            &digest(&(id, "authoritative-precheck"))?,
        )?;
        let precheck = self.precheck(guard, q, c, id, policy, now);
        let (artifact, before, service) = match precheck {
            Ok(p) => p,
            Err(e) => {
                self.transition(q, id, State::Blocked, &digest(&(id, e.code()))?)?;
                return Err(e);
            }
        };
        q.fence_executor_finalization(id)?;
        let attempt = status.mutating_attempts + 1;
        let mut journal =
            Journal::create(&self.journals, id, attempt, status.preflight_attempts + 1)?;
        let attachments = q.daemon_attachments(id)?;
        let proof = journal.append(Event::Preflight {
            unit: id.into(),
            attempt,
            policy: digest(policy)?,
            attachments: attachments.iter().map(|a| a.digest.clone()).collect(),
            before,
            service,
            installed_before: q.daemon_current_installation(&status.unit.target_runtime)?,
        })?;
        if let Some(predecessor) = self.capture_predecessor(q, c, id, attempt)? {
            journal.append(Event::ExecutedPredecessor { proof: predecessor })?;
        }
        self.active = Some(journal);
        let current = q.daemon_status(id)?;
        let gate_time = now.saturating_add(started.elapsed().as_secs());
        #[cfg(test)]
        let gate_time = self.gate_time.unwrap_or(gate_time);
        let begun = q.begin_apply(c, id, current.revision, policy, gate_time, &proof);
        if let Err(error) = begun {
            // Only definite authorization refusals are safe. Storage/commit errors
            // keep the active journal and fence for recovery, never guess no effect.
            if matches!(
                error.code(),
                "POLICY_EXPIRED" | "POLICY_REPLAY" | "POLICY_EQUIVOCATION" | "REVOKED"
            ) {
                let journal = self.active.as_mut().ok_or(Error::new("NO_TRANSACTION"))?;
                let evidence = journal.append(Event::NoMutation {
                    reason: error.code().into(),
                })?;
                q.block_executor_prewrite(id, current.revision, &evidence)?;
                self.active = None;
            }
            return Err(error);
        }
        let mut journal = self.active.take().ok_or(Error::new("NO_TRANSACTION"))?;
        let result = self.install(q, id, &artifact, &mut journal, caller);
        self.active = Some(journal);
        match result {
            Ok(receipt) => Ok(Applied { receipt }),
            Err(e) => {
                // Known slot-only failure can restore; unresolved service operation cannot replay.
                let unknown = self
                    .active
                    .as_ref()
                    .is_some_and(|j| !j.operations_resolved());
                if unknown {
                    self.quarantine(q, id, e.code())?;
                } else if self.rollback_for_failure(guard, q, id, e.code()).is_err() {
                    self.quarantine(q, id, "UNSAFE_ROLLBACK")?;
                }
                Err(e)
            }
        }
    }
    fn precheck(
        &mut self,
        guard: &MutationGuard,
        q: &Queue,
        c: &Catalog,
        id: &str,
        policy: &Signed<Policy>,
        now: u64,
    ) -> Result<PrecheckedImage> {
        guard.binds(&self.root)?;
        q.revalidate(c, id, policy, now)?;
        let status = q.daemon_status(id)?;
        if let ServiceDriver::Native(driver) = &self.service {
            require(
                status.unit.deployment_profile == driver.enrollment.profile_id,
                "PROFILE_NOT_ALLOWED",
            )?;
        }
        let artifact = self
            .artifacts
            .import(&status.unit.artifact_sha256, &status.unit.manifest_digest)?;
        self.validate_slots(&artifact.manifest)?;
        self.verify_live_baseline(q, &status.unit.target_runtime)?;
        if self.slots.is_some() {
            self.complete_face()?;
        }
        let mut before = Vec::new();
        let mut preimage_bytes = 0usize;
        for entry in &artifact.manifest.entries {
            let image = self.target.read(&entry.path)?;
            preimage_bytes += image.as_ref().map_or(0, |i| i.bytes.len());
            require(preimage_bytes <= 64 * 1024 * 1024, "PREIMAGE_SIZE_LIMIT")?;
            before.push((entry.path.clone(), image));
        }
        let service = self.service.image()?;
        if let Some(current) = q.daemon_current_installation(&status.unit.target_runtime)? {
            require(
                current.service_generation == service.generation,
                "SERVICE_GENERATION_DRIFT",
            )?;
        }
        require(
            !service.components.iter().any(|s| s.loaded && s.disabled),
            "DISABLED_LOADED_RESTORE_UNSUPPORTED",
        )?;
        artifact.verify()?;
        Ok((artifact, before, service))
    }
    fn install(
        &mut self,
        q: &Queue,
        id: &str,
        artifact: &SealedArtifact,
        journal: &mut Journal,
        caller: &str,
    ) -> Result<TransactionReceipt> {
        journal.append(Event::Applying)?;
        let (before, old_service, policy, attachment_digests) = match &journal.events[0] {
            Event::Preflight {
                before,
                service,
                policy,
                attachments,
                ..
            } => (
                before.clone(),
                service.clone(),
                policy.clone(),
                attachments.clone(),
            ),
            _ => return Err(Error::new("CORRUPT_JOURNAL")),
        };
        // Affected services are quiesced before the first target rename.
        self.service.stop(journal, &old_service)?;
        journal.append(Event::ServiceStopped)?;
        for (index, entry) in artifact.manifest.entries.iter().enumerate() {
            let slot = self.target.slot(&entry.path)?;
            let expected = &before[index].1;
            require(slot.read()? == *expected, "PREIMAGE_DRIFT")?;
            let temporary = format!("dcp-{}-{index}", &id[..16]);
            require(!slot.parent.names()?.contains(&temporary), "TEMP_COLLISION")?;
            journal.append(Event::SlotIntent {
                path: entry.path.clone(),
                temporary: temporary.clone(),
            })?;
            let bytes = artifact.read(&entry.path)?;
            let (mode, gid) = self.slot_mode_gid(&entry.path, entry.executable)?;
            let prepared = slot.prepare_metadata(&temporary, &bytes, mode, gid)?;
            journal.append(Event::Prepared {
                path: entry.path.clone(),
                image: prepared.clone(),
            })?;
            let actual = slot.replace(&temporary, expected)?;
            require(actual == prepared, "POSTIMAGE_DRIFT")?;
            journal.append(Event::Installed {
                path: entry.path.clone(),
                image: actual,
            })?;
        }
        artifact.verify()?;
        self.transition(q, id, State::Restarting, &digest(&(id, "installed"))?)?;
        let new_service = self.service.start(journal, &old_service, false)?;
        require(
            !old_service.running || new_service.generation != old_service.generation,
            "OLD_GENERATION_STILL_LOADED",
        )?;
        journal.append(Event::ServiceStarted {
            image: new_service.clone(),
        })?;
        self.service.prove(&new_service)?;
        if self.slots.is_some() {
            journal.append(Event::CompleteFace {
                entries: self.complete_face()?,
            })?;
        }
        let post = self.read_installed(journal)?;
        artifact.verify()?;
        self.transition(
            q,
            id,
            State::Verifying,
            &digest(&(id, &post, &new_service))?,
        )?;
        let s = q.daemon_status(id)?;
        let attachments = q.daemon_attachments(id)?;
        let mut reviews = Vec::new();
        for a in attachments {
            for review in a.proposal.reviews {
                reviews.push(digest(&review)?);
            }
        }
        reviews.sort();
        reviews.dedup();
        let mut receipt = TransactionReceipt {
            unit_id: id.into(),
            artifact_sha256: s.unit.artifact_sha256,
            source_sha: s.unit.source_sha,
            profile_revision: s.unit.profile_revision,
            policy_digest: policy,
            review_digests: reviews,
            caller: caller.into(),
            dependency_receipts: s
                .unit
                .dependency_units
                .iter()
                .map(|d| d.receipt_digest.clone())
                .collect(),
            preimage_digest: digest(&before)?,
            postimage_digest: digest(&post)?,
            old_service_generation: old_service.generation,
            new_service_generation: new_service.generation,
            target_generation: s.unit.expected_target_generation + 1,
            attempt: s.mutating_attempts,
            attachment_digests,
            step_results: vec![
                "preimage-captured".into(),
                "service-quiesced".into(),
                "slots-readback".into(),
                "process-verified".into(),
            ],
            rollback_digest: None,
            capability: "installed-release".into(),
        };
        if let Some(Event::ExecutedPredecessor { proof }) = journal.events.get(1) {
            receipt
                .step_results
                .push(format!("predecessor-{}", digest(proof)?));
        }
        journal.append(Event::Verified {
            receipt: receipt.clone(),
        })?;
        Ok(receipt)
    }
    pub(crate) fn verify_live_baseline(&self, q: &Queue, target: &str) -> Result<()> {
        let installed = q.daemon_installation_record(target)?;
        if let Some(crate::queue::InstallationReceipt::Adoption(receipt)) = &installed {
            return self.verify_adopted_baseline(receipt);
        }
        if let Some(crate::queue::InstallationReceipt::Mutation(receipt)) = installed {
            let journal = Journal::for_receipt(&self.journals, &receipt)?;
            require(journal.terminal(), "RECOVERY_REQUIRED")?;
            let mut bound = Vec::new();
            for event in &journal.events {
                if let Event::Installed { path, image } = event {
                    let current = self
                        .target
                        .read(path)?
                        .ok_or(Error::new("PREIMAGE_DRIFT"))?;
                    require(current.content_matches(image), "PREIMAGE_DRIFT")?;
                    bound.push((path.clone(), image.clone()));
                }
            }
            require(
                digest(&bound)? == receipt.postimage_digest,
                "PREIMAGE_DRIFT",
            )?;
            self.verify_complete_face(&journal)?;
        } else {
            self.initial_face()?;
        }
        Ok(())
    }

    pub(crate) fn read_installed(&self, j: &Journal) -> Result<Vec<(String, FileImage)>> {
        self.verify_complete_face(j)?;
        let mut result = Vec::new();
        for event in &j.events {
            if let Event::Installed { path, image } = event {
                require(
                    self.target.read(path)?.as_ref() == Some(image),
                    "POSTIMAGE_DRIFT",
                )?;
                result.push((path.clone(), image.clone()));
            }
        }
        Ok(result)
    }
}
