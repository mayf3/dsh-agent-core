//! Only current physical readback under the permanent mutex can support recovery intake.
use super::*;
use crate::{error::require, trust::digest, Error};
use journal::Event;

/// Scope comes from the failing operation, never a caller-supplied safety label.
#[derive(Debug)]
pub(crate) enum RecoveryFailure {
    UnitLocal(Error),
    Global(Error),
}
impl From<Error> for RecoveryFailure {
    fn from(error: Error) -> Self {
        Self::Global(error)
    }
}
impl RecoveryFailure {
    pub(crate) fn record(error: Error) -> Self {
        Self::at_stage(error, &["INVALID_RECORD", "NESTING_LIMIT", "SIZE_LIMIT"])
    }
    fn at_stage(error: Error, definite_refusals: &[&str]) -> Self {
        if definite_refusals.contains(&error.code()) {
            Self::UnitLocal(error)
        } else {
            Self::Global(error)
        }
    }
}
type RecoveryResult<T> = std::result::Result<T, RecoveryFailure>;
impl Executor {
    pub(crate) fn recovery_binding(
        &mut self,
        guard: &MutationGuard,
        q: &Queue,
        id: &str,
    ) -> RecoveryResult<RecoveryEvidence> {
        guard.binds(&self.root)?;
        require(self.active.is_none(), "TRANSACTION_ACTIVE")?;
        let status = q.daemon_status(id)?;
        require(
            matches!(status.state, State::Blocked | State::RolledBack),
            "UNKNOWN_OUTCOME",
        )?;
        let service = self.service.image()?;
        let mut last = None;
        let (preflight, attempt) = q.daemon_execution(id)?;
        for name in self.journals.names()? {
            let journal = Journal::load(&self.journals, &name)?;
            require(journal.terminal(), "RECOVERY_REQUIRED")?;
            if name == format!("{id}-{attempt}-{preflight}") {
                last = Some(journal);
            }
        }
        // Global journal safety is checked even when this unit exhausted its budget.
        require(
            status.preflight_attempts < 3 && status.mutating_attempts < 2,
            "RETRY_BUDGET_EXHAUSTED",
        )
        .map_err(RecoveryFailure::UnitLocal)?;
        let proposal = q.daemon_evidence(id)?;
        let artifact = self
            .artifacts
            .import(
                &proposal.build.payload.artifact_sha256,
                &proposal.build.payload.manifest_digest,
            )
            .map_err(|e| RecoveryFailure::at_stage(e, &["ABSENT", "INCOMPLETE_INTAKE"]))?;
        self.validate_slots(&artifact.manifest)?;
        self.verify_live_baseline(q, &status.unit.target_runtime)?;
        let paths = if let Some(slots) = &self.slots {
            slots.iter().map(|s| s.path.clone()).collect::<Vec<_>>()
        } else {
            artifact
                .manifest
                .entries
                .iter()
                .map(|e| e.path.clone())
                .collect()
        };
        let face = paths
            .iter()
            .map(|p| Ok((p.clone(), self.target.read(p)?)))
            .collect::<Result<Vec<_>>>()?;
        let mut cause = q.daemon_failure_cause(id)?;
        let (operations, dispositions) = if status.state == State::RolledBack {
            let journal = last.as_ref().ok_or(Error::new("RECOVERY_BINDING"))?;
            require(journal.operations_resolved(), "UNKNOWN_OUTCOME")?;
            let reason = journal.events.iter().rev().find_map(|event| match event {
                Event::KnownFailure { reason } => Some(reason.as_str()),
                _ => None,
            });
            let no_effect = journal.events.iter().all(|event| {
                matches!(
                    event,
                    Event::Preflight { .. } | Event::Applying | Event::RolledBack { .. }
                )
            });
            require(reason.is_some() || no_effect, "RECOVERY_CAUSE_REQUIRED")?;
            cause = digest(&(
                cause,
                attempt,
                preflight,
                reason.unwrap_or("startup-no-effect"),
            ))?;
            let restored = match journal.events.last() {
                Some(Event::RolledBack { service }) => service,
                _ => return Err(Error::new("RECOVERY_BINDING").into()),
            };
            self.service.prove(restored)?;
            if let Event::Preflight { before, .. } = &journal.events[0] {
                for (path, expected) in before {
                    let actual = self.target.read(path)?;
                    require(
                        match (expected, actual) {
                            (None, None) => true,
                            (Some(a), Some(b)) => a.content_matches(&b),
                            _ => false,
                        },
                        "UNSAFE_ROLLBACK",
                    )?;
                }
            }
            (
                digest(&journal.events)?,
                vec![StepDisposition::Restored("files-and-service".into())],
            )
        } else {
            if let Some(journal) = &last {
                require(
                    matches!(
                        journal.events.last(),
                        Some(Event::NoMutation { .. }) | Some(Event::RolledBack { .. })
                    ),
                    "RECOVERY_BINDING",
                )?;
            }
            (
                digest(&(
                    id,
                    status.revision,
                    status.preflight_attempts,
                    "no-mutation",
                ))?,
                vec![StepDisposition::Absent("apply".into())],
            )
        };
        Ok(RecoveryEvidence {
            unit_id: id.into(),
            status_revision: status.revision,
            failure_cause_digest: cause,
            remediation_digest: String::new(),
            restored_preimage_digest: digest(&face)?,
            service_readback_digest: digest(&service)?,
            owned_operations_receipt: operations,
            step_dispositions: dispositions,
            issued_at: 0,
        })
    }
    pub(crate) fn consume_recovery(
        &mut self,
        guard: &MutationGuard,
        q: &Queue,
        c: &Catalog,
        e: &Signed<RecoveryEvidence>,
        policy: &Signed<Policy>,
        now: u64,
    ) -> RecoveryResult<()> {
        let expected = self.recovery_binding(guard, q, &e.payload.unit_id)?;
        let mut supplied = e.payload.clone();
        supplied.remediation_digest = String::new();
        supplied.issued_at = 0;
        require(supplied == expected, "RECOVERY_BINDING").map_err(RecoveryFailure::UnitLocal)?;
        crate::trust::verify_signed(
            e,
            c,
            &q.daemon_status(&e.payload.unit_id)?.unit.deployment_profile,
        )
        .map_err(|e| {
            RecoveryFailure::at_stage(
                e,
                &[
                    "UNKNOWN_ISSUER",
                    "ISSUER_ROLE",
                    "ISSUER_SCOPE",
                    "INVALID_SIGNATURE",
                ],
            )
        })?;
        q.observe_policy(
            c,
            &q.daemon_status(&e.payload.unit_id)?.unit.deployment_profile,
            policy,
            now,
        )?;
        q.retry(c, e, now).map_err(|e| {
            RecoveryFailure::at_stage(
                e,
                &[
                    "RECOVERY_EXPIRED",
                    "REVISION_CAS",
                    "INVALID_DIGEST",
                    "RETRY_BUDGET_EXHAUSTED",
                    "REVOKED",
                    "PREIMAGE_MISMATCH",
                    "DEPENDENCY_NOT_SATISFIED",
                    "PROFILE_NOT_ALLOWED",
                ],
            )
        })?;
        Ok(())
    }
}
