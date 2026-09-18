//! An executed precondition is usable only for acceptance of its own finalized result.
use super::*;
use crate::{
    error::require,
    fs::file::FileImage,
    trust::{digest, verify_signed},
    Error,
};
use serde::{Deserialize, Serialize};
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct ExecutedPredecessor {
    unit: String,
    attempt: u32,
    predecessor: CurrentInstallation,
    dependency: Dependency,
    goals: Vec<Signed<GoalReceipt>>,
    retained: Vec<(String, FileImage)>,
}
pub(crate) struct VerifiedReadOnlyPredecessor {
    unit: String,
    dependency: Dependency,
}
impl VerifiedReadOnlyPredecessor {
    pub(crate) fn permits(&self, unit: &str, dep: &Dependency) -> bool {
        self.unit == unit && self.dependency == *dep
    }
}
impl Executor {
    pub(super) fn capture_predecessor(
        &self,
        q: &Queue,
        c: &Catalog,
        id: &str,
        attempt: u32,
    ) -> Result<Option<ExecutedPredecessor>> {
        let status = q.daemon_status(id)?;
        let Some(current) = q.daemon_current_installation(&status.unit.target_runtime)? else {
            return Ok(None);
        };
        let Some(dep) = status
            .unit
            .dependency_units
            .iter()
            .find(|d| d.unit_id == current.unit_id)
        else {
            return Ok(None);
        };
        require(
            dep.semantics == DependencySemantics::LiveInstallation
                && dep.receipt_digest == current.transaction_receipt_digest,
            "PREDECESSOR_BINDING",
        )?;
        let prior = q.daemon_status(&current.unit_id)?;
        require(
            prior.state == State::Applied
                && prior.unit.target_runtime == status.unit.target_runtime,
            "PREDECESSOR_BINDING",
        )?;
        let mut goals = Vec::new();
        for goal in &dep.required_goals {
            let receipt = q
                .daemon_goal(&dep.unit_id, goal)?
                .ok_or(Error::new("PREDECESSOR_GOAL"))?;
            verify_signed(&receipt, c, &prior.unit.deployment_profile)?;
            require(
                receipt.payload.outcome == GoalOutcome::Pass
                    && receipt.payload.attempt == current.attempt
                    && receipt.payload.target_generation == current.target_generation
                    && receipt.payload.service_generation == current.service_generation,
                "PREDECESSOR_GOAL",
            )?;
            goals.push(receipt);
        }
        require(!goals.is_empty(), "PREDECESSOR_GOAL")?;
        let artifact = self
            .artifacts
            .import(&prior.unit.artifact_sha256, &prior.unit.manifest_digest)?;
        let mut retained = Vec::new();
        for entry in &artifact.manifest.entries {
            let image = self
                .target
                .read(&entry.path)?
                .ok_or(Error::new("PREIMAGE_DRIFT"))?;
            require(image.bytes == artifact.read(&entry.path)?, "PREIMAGE_DRIFT")?;
            retained.push((entry.path.clone(), image));
        }
        Ok(Some(ExecutedPredecessor {
            unit: id.into(),
            attempt,
            predecessor: current,
            dependency: dep.clone(),
            goals,
            retained,
        }))
    }
    pub(super) fn read_only_predecessor(
        &self,
        q: &Queue,
        c: &Catalog,
        id: &str,
    ) -> Result<Option<VerifiedReadOnlyPredecessor>> {
        let status = q.daemon_status(id)?;
        require(status.state == State::Applied, "NOT_APPLIED")?;
        let Some(dep) = status.unit.dependency_units.iter().find(|dep| {
            q.daemon_status(&dep.unit_id)
                .is_ok_and(|s| s.unit.target_runtime == status.unit.target_runtime)
        }) else {
            return Ok(None);
        };
        let current = q
            .daemon_current_installation(&status.unit.target_runtime)?
            .ok_or(Error::new("INSTALLED_GENERATION_CHANGED"))?;
        require(current.unit_id == id, "INSTALLED_GENERATION_CHANGED")?;
        let receipt = q
            .daemon_installed_receipt(&status.unit.target_runtime)?
            .ok_or(Error::new("NO_VERIFIED_RECEIPT"))?;
        let journal = Journal::for_receipt(&self.journals, &receipt)?;
        require(
            matches!(journal.events.last(), Some(journal::Event::Finalized)),
            "FINALIZATION_PENDING",
        )?;
        let proof = match journal.events.get(1) {
            Some(journal::Event::ExecutedPredecessor { proof }) => proof,
            _ => return Err(Error::new("PREDECESSOR_PROOF_REQUIRED")),
        };
        require(
            receipt
                .step_results
                .contains(&format!("predecessor-{}", digest(proof)?))
                && proof.unit == id
                && proof.attempt == receipt.attempt
                && proof.dependency == *dep
                && proof.predecessor.unit_id == dep.unit_id
                && proof.predecessor.transaction_receipt_digest == dep.receipt_digest
                && proof.predecessor.target_generation == status.unit.expected_target_generation,
            "PREDECESSOR_BINDING",
        )?;
        match journal.events.first() {
            Some(journal::Event::Preflight {
                installed_before: Some(before),
                unit,
                attempt,
                ..
            }) => require(
                before == &proof.predecessor && unit == id && *attempt == proof.attempt,
                "PREDECESSOR_BINDING",
            )?,
            _ => return Err(Error::new("PREDECESSOR_BINDING")),
        }
        let prior = q.daemon_status(&dep.unit_id)?;
        require(
            proof.goals.len() == dep.required_goals.len() && !proof.goals.is_empty(),
            "PREDECESSOR_GOAL",
        )?;
        for (goal, name) in proof.goals.iter().zip(&dep.required_goals) {
            verify_signed(goal, c, &prior.unit.deployment_profile)?;
            let r = &goal.payload;
            require(
                r.unit_id == dep.unit_id
                    && &r.goal_id == name
                    && r.outcome == GoalOutcome::Pass
                    && r.attempt == proof.predecessor.attempt
                    && r.target_generation == proof.predecessor.target_generation
                    && r.service_generation == proof.predecessor.service_generation
                    && r.attachment_digest == q.daemon_goal_attachment(&dep.unit_id, name)?,
                "PREDECESSOR_GOAL",
            )?;
            require(
                q.daemon_goal_evidence(&digest(goal)?)? == *goal,
                "PREDECESSOR_GOAL",
            )?;
        }
        require(!proof.retained.is_empty(), "PREDECESSOR_FACET")?;
        for (path, expected) in &proof.retained {
            require(
                self.target
                    .read(path)?
                    .is_some_and(|actual| actual.content_matches(expected)),
                "PREDECESSOR_FACET",
            )?;
        }
        Ok(Some(VerifiedReadOnlyPredecessor {
            unit: id.into(),
            dependency: dep.clone(),
        }))
    }
}
