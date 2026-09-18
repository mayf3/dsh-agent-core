use super::*;
use crate::queue::Queue;
impl Registry {
    /// Root-side producer delivery adapter. No caller-supplied finalization flag or
    /// copied PASS is authoritative: the protected Queue must retain this outbox.
    pub fn close_from_queue(
        &self,
        queue: &Queue,
        actor: &Actor,
        entry: &OutboxEntry,
        receipt: &Signed<GoalReceipt>,
    ) -> Result<Signed<ClosureAcknowledgement>> {
        let _lock = storage::lock(&self.root)?;
        let history = self.history()?;
        let mut rows = Self::rows(&history);
        let row = rows
            .get_mut(&entry.goal_id)
            .ok_or(Error::new("UNKNOWN_ENROLLMENT"))?;
        let e = &row.enrollment.payload;
        verify_signed(receipt, &self.catalog, &e.deployment_profile)?;
        let profile = &self.catalog.profiles[&e.deployment_profile];
        require(
            profile.goal_verifiers.get(&e.verification_profile) == Some(&receipt.issuer),
            "VERIFIER_SCOPE",
        )?;
        let r = &receipt.payload;
        require(r.outcome == GoalOutcome::Pass, "DEPLOYMENT_PASS_REQUIRED")?;
        require(
            entry.producer_id == self.producer
                && entry.goal_id == r.goal_id
                && r.goal_id == e.goal_id
                && r.acceptance_revision == e.acceptance_revision
                && digest(receipt)? == entry.receipt_digest,
            "CLOSURE_BINDING",
        )?;
        let ready = row
            .ready
            .as_ref()
            .ok_or(Error::new("DEPLOYMENT_NOT_READY"))?;
        require(
            entry.expected_producer_revision == ready.payload.revision,
            "REGISTRY_CAS",
        )?;
        if let Some(ack) = &row.closure {
            require(
                ack.payload.outbox_id == entry.id
                    && ack.payload.receipt_digest == entry.receipt_digest
                    && ack.payload.previous_revision == entry.expected_producer_revision,
                "CLOSURE_BINDING",
            )?;
            return Ok(ack.clone());
        }
        require(
            row.state == DeploymentState::Ready && row.revision == entry.expected_producer_revision,
            "REGISTRY_CAS",
        )?;
        // Outbox visibility excludes executor_pending. status() projects a durable
        // Queue Applied / unfinished executor journal gap as Finalizing.
        require(
            queue.outbox(actor)?.contains(entry),
            "SAFE_FINALIZATION_REQUIRED",
        )?;
        let stored: Signed<GoalReceipt> =
            serde_json::from_str(&queue.receipt(actor, &entry.receipt_digest)?)?;
        require(stored == *receipt, "CLOSURE_BINDING")?;
        let status = queue.status(actor, &r.unit_id)?;
        require(status.state == State::Applied, "SAFE_FINALIZATION_REQUIRED")?;
        require(
            status.unit.repo == e.repo
                && status.unit.target_runtime == e.target_runtime
                && status.unit.deployment_profile == e.deployment_profile
                && status.unit.artifact_sha256 == ready.payload.artifact_sha256
                && status.mutating_attempts == r.attempt
                && status.unit.expected_target_generation.checked_add(1)
                    == Some(r.target_generation),
            "CLOSURE_BINDING",
        )?;
        let closed_revision = row
            .revision
            .checked_add(1)
            .ok_or(Error::new("REGISTRY_CAS"))?;
        let ack = self.sign(ClosureAcknowledgement {
            outbox_id: entry.id.clone(),
            goal_id: entry.goal_id.clone(),
            receipt_digest: entry.receipt_digest.clone(),
            previous_revision: row.revision,
            closed_revision,
        })?;
        row.state = DeploymentState::Closed;
        row.revision = closed_revision;
        row.closure = Some(ack.clone());
        self.commit(&history, rows)?;
        Ok(ack)
    }
}
