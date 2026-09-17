use super::*;
use crate::{error::require, trust::digest, Error};
use journal::Event;

impl Executor {
    pub(crate) fn quarantine(&mut self, q: &Queue, id: &str, reason: &str) -> Result<()> {
        // Queue quarantine must survive even if journal storage is unavailable.
        let hash = digest(&(id, reason))?;
        let s = q.daemon_status(id)?;
        if s.state != State::Quarantined {
            self.transition(q, id, State::Quarantined, &hash)?;
        }
        if let Some(j) = &mut self.active {
            j.append(Event::Quarantined {
                reason: reason.into(),
            })?;
        }
        Ok(())
    }
    pub fn rollback(&mut self, guard: &MutationGuard, q: &Queue, id: &str) -> Result<()> {
        guard.binds(&self.root)?;
        let mut j = self.active.take().ok_or(Error::new("NO_TRANSACTION"))?;
        let result = self.restore(q, id, &mut j);
        self.active = Some(j);
        if let Err(e) = result {
            self.quarantine(q, id, e.code())?;
            return Err(e);
        }
        self.active = None;
        Ok(())
    }
    fn restore(&mut self, q: &Queue, id: &str, j: &mut Journal) -> Result<()> {
        require(j.identity()?.0 == id, "TRANSACTION_BINDING")?;
        self.transition(q, id, State::RollingBack, &digest(&(id, "rollback"))?)?;
        let (before, old_service) = match &j.events[0] {
            Event::Preflight {
                before, service, ..
            } => (before.clone(), service.clone()),
            _ => return Err(Error::new("CORRUPT_JOURNAL")),
        };
        let current_service = self.service.image()?;
        self.service.stop(j, &current_service)?;
        for (index, (path, image)) in before.iter().enumerate().rev() {
            let known = j.events.iter().rev().find_map(|e| match e {
                Event::Installed { path: p, image } | Event::Prepared { path: p, image }
                    if p == path =>
                {
                    Some(image.clone())
                }
                _ => None,
            });
            let slot = self.target.slot(path)?;
            if slot.read()? == *image {
                if let Some(temporary) = j.events.iter().find_map(|e| match e {
                    Event::SlotIntent { path: p, temporary } if p == path => {
                        Some(temporary.clone())
                    }
                    _ => None,
                }) {
                    match slot.parent.open_file(&temporary, libc::O_RDONLY, 0) {
                        Ok(file) => {
                            let observed = crate::fs::file::snapshot(
                                &file,
                                slot.parent.uid,
                                crate::fs::file::MAX_FILE,
                            )?;
                            require(known.as_ref() == Some(&observed), "UNSAFE_ROLLBACK")?;
                            slot.parent.unlink(&temporary)?;
                        }
                        Err(e) if e.code() == "ABSENT" => (),
                        Err(e) => return Err(e),
                    }
                }
                continue;
            }
            let expected = known.ok_or(Error::new("UNSAFE_ROLLBACK"))?;
            j.append(Event::RollbackIntent { path: path.clone() })?;
            slot.restore(&format!("rollback-{}-{index}", &id[..16]), &expected, image)?;
            j.append(Event::Restored { path: path.clone() })?;
        }
        let restored = self.service.start(j, &old_service, true)?;
        require(
            restored.loaded == old_service.loaded && restored.running == old_service.running,
            "UNSAFE_ROLLBACK",
        )?;
        self.service.prove(&restored)?;
        if let Event::Preflight {
            installed_before: Some(previous),
            ..
        } = &j.events[0]
        {
            let restoring = q.daemon_status(id)?;
            q.record_restored_installation(VerifiedRestoration(RestoredInstallation {
                previous: previous.clone(),
                service_generation: restored.generation.clone(),
                physical_evidence_digest: digest(&(&before, &restored, &j.events))?,
                restoring_unit: id.into(),
                restoring_attempt: restoring.mutating_attempts,
            }))?;
        }
        let evidence = j.append(Event::RolledBack { service: restored })?;
        self.transition(q, id, State::RolledBack, &evidence)
    }
    /// At startup hold the permanent mutex. Nonterminal effects are inspected, never replayed.
    /// This conservative first recovery implementation returns exact physical dispositions
    /// but keeps interrupted service/business operations quarantined.
    pub fn recover(&mut self, guard: &MutationGuard, q: &Queue) -> Result<Vec<String>> {
        guard.binds(&self.root)?;
        require(self.active.is_none(), "TRANSACTION_ACTIVE")?;
        let mut result = q.mark_interrupted()?;
        for name in self.journals.names()? {
            let mut j = match Journal::load(&self.journals, &name) {
                Ok(j) => j,
                Err(e) => {
                    q.latch_executor_failure(&digest(&(&name, e.code()))?)?;
                    return Err(e);
                }
            };
            if j.terminal() {
                continue;
            }
            let (id, _) = j.identity()?;
            let id = id.to_string();
            // A crash before any owned operation or slot intent has a provable no-effect disposition.
            let no_effect_intent = j
                .events
                .iter()
                .all(|e| matches!(e, Event::Preflight { .. } | Event::Applying));
            if no_effect_intent {
                if let Event::Preflight {
                    before, service, ..
                } = &j.events[0]
                {
                    let unchanged = before
                        .iter()
                        .all(|(p, image)| self.target.read(p).ok().as_ref() == Some(image));
                    if unchanged && self.service.image().ok().as_ref() == Some(service) {
                        let evidence = j.append(Event::RolledBack {
                            service: service.clone(),
                        })?;
                        let s = q.daemon_status(&id)?;
                        q.settle_executor_recovery(&RestorationProof {
                            unit: id.clone(),
                            attempt: s.mutating_attempts,
                            status_revision: s.revision,
                            evidence_digest: evidence,
                        })?;
                        continue;
                    }
                }
            }
            // Same descriptors, at most one bounded pass over known slot evidence.
            q.latch_executor_failure(&digest(&(&id, "unresolved-executor-journal"))?)?;
            let readback = self.read_installed(&j);
            let reason = if readback.is_ok() {
                "OUTCOME_UNKNOWN"
            } else {
                "UNSAFE_ROLLBACK"
            };
            j.append(Event::Quarantined {
                reason: reason.into(),
            })?;
            let status = q.daemon_status(&id)?;
            if status.state == State::Recovering {
                self.transition(q, &id, State::Quarantined, &digest(&j.events)?)?;
            }
            if !result.contains(&id) {
                result.push(id);
            }
        }
        Ok(result)
    }
    /// Called after current-attempt Goal receipts are durable; verifies again before ACK.
    pub fn finalize(&mut self, guard: &MutationGuard, q: &Queue, id: &str) -> Result<String> {
        guard.binds(&self.root)?;
        let mut j = self.active.take().ok_or(Error::new("NO_TRANSACTION"))?;
        let result: Result<String> = (|| {
            require(j.identity()?.0 == id, "TRANSACTION_BINDING")?;
            let receipt = j
                .events
                .iter()
                .rev()
                .find_map(|e| {
                    if let Event::Verified { receipt } = e {
                        Some(receipt.clone())
                    } else {
                        None
                    }
                })
                .ok_or(Error::new("NO_VERIFIED_RECEIPT"))?;
            self.read_installed(&j)?;
            let image = j
                .events
                .iter()
                .rev()
                .find_map(|e| {
                    if let Event::ServiceStarted { image } = e {
                        Some(image)
                    } else {
                        None
                    }
                })
                .ok_or(Error::new("NO_SERVICE_READBACK"))?;
            self.service.prove(image)?;
            self.transition(q, id, State::Finalizing, &digest(&receipt)?)?;
            let hash = q.record_transaction(&receipt)?;
            self.transition(q, id, State::Applied, &hash)?;
            j.append(Event::Finalized)?;
            Ok(hash)
        })();
        if result.is_err() {
            self.active = Some(j);
        }
        Ok(result?)
    }
}
impl Executor {
    /// Late acceptance pins the current physical binding without install/restart.
    pub fn verify_installed(
        &mut self,
        guard: &MutationGuard,
        q: &Queue,
        c: &Catalog,
        id: &str,
        policy: &Signed<Policy>,
        now: u64,
    ) -> Result<CurrentInstallation> {
        guard.binds(&self.root)?;
        q.revalidate(c, id, policy, now)?;
        let s = q.daemon_status(id)?;
        require(s.state == State::Applied, "NOT_APPLIED")?;
        self.verify_live_baseline(q, &s.unit.target_runtime)?;
        let current = q
            .daemon_current_installation(&s.unit.target_runtime)?
            .ok_or(Error::new("INSTALLED_GENERATION_CHANGED"))?;
        require(current.unit_id == id, "INSTALLED_GENERATION_CHANGED")?;
        let actual = self.service.image()?;
        self.service.prove(&actual)?;
        require(
            actual.generation == current.service_generation,
            "SERVICE_GENERATION_DRIFT",
        )?;
        self.artifacts
            .import(&s.unit.artifact_sha256, &s.unit.manifest_digest)?
            .verify()?;
        Ok(current)
    }
}
