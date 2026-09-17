use super::*;
use crate::trust::{digest, valid_digest, valid_id, verify_signed};
impl Queue {
    /// Trusted executor only, after actual bytes/metadata/service readback under the mutex.
    pub fn record_transaction(&self, receipt: &TransactionReceipt) -> Result<String> {
        for d in [
            &receipt.artifact_sha256,
            &receipt.preimage_digest,
            &receipt.postimage_digest,
            &receipt.policy_digest,
        ] {
            valid_digest(d)?;
        }
        require(
            !receipt.step_results.is_empty() && !receipt.new_service_generation.is_empty(),
            "RECEIPT_INCOMPLETE",
        )?;
        for value in [
            &receipt.old_service_generation,
            &receipt.new_service_generation,
            &receipt.capability,
            &receipt.caller,
        ] {
            valid_id(value)?;
        }
        for result in &receipt.step_results {
            valid_id(result)?;
        }
        self.transaction(|tx| {
            let s = read_status(tx, &receipt.unit_id)?;
            require(s.state == State::Finalizing, "NOT_FINALIZING")?;
            require(
                receipt.artifact_sha256 == s.unit.artifact_sha256
                    && receipt.source_sha == s.unit.source_sha
                    && receipt.profile_revision == s.unit.profile_revision
                    && receipt.review_digests == s.unit.required_reviews
                    && receipt.attempt == s.mutating_attempts
                    && receipt.target_generation == s.unit.expected_target_generation + 1
                    && receipt.dependency_receipts
                        == s.unit
                            .dependency_units
                            .iter()
                            .map(|d| d.receipt_digest.clone())
                            .collect::<Vec<_>>(),
                "RECEIPT_BINDING",
            )?;
            authorize(
                tx,
                &Actor {
                    id: receipt.caller.clone(),
                    allowed_profiles: vec![],
                    allowed_producers: vec![],
                },
                &receipt.unit_id,
            )?;
            let policy: String = tx.query_row(
                "SELECT digest FROM policies WHERE profile=?",
                [&s.unit.deployment_profile],
                |r| r.get(0),
            )?;
            require(receipt.policy_digest == policy, "RECEIPT_BINDING")?;
            let hash = digest(receipt)?;
            let old: Option<String> = tx
                .query_row(
                    "SELECT digest FROM receipts WHERE unit=? AND kind='transaction'",
                    [&receipt.unit_id],
                    |r| r.get(0),
                )
                .optional()?;
            require(old.as_ref().is_none_or(|x| x == &hash), "RECEIPT_IMMUTABLE")?;
            tx.execute(
                "INSERT OR IGNORE INTO receipts VALUES (?,?,?,?)",
                (&hash, &receipt.unit_id, "transaction", json(receipt)?),
            )?;
            Ok(hash)
        })
    }
    pub fn record_goal(&self, catalog: &Catalog, receipt: &Signed<GoalReceipt>) -> Result<String> {
        self.transaction(|tx| {
            let r = &receipt.payload;
            let s = read_status(tx,&r.unit_id)?;
            require(matches!(s.state,State::Verifying|State::Finalizing|State::Applied),"NOT_VERIFYING")?;
            verify_signed(receipt,catalog,&s.unit.deployment_profile)?;
            valid_digest(&r.evidence_digest)?;
            let coverage: Option<String> = tx.query_row("SELECT record FROM coverage WHERE unit=? AND goal=?", (&r.unit_id,&r.goal_id), |r|r.get(0)).optional()?;
            let g: Signed<ReadyRecord> = parse(coverage.ok_or(Error::new("GOAL_COVERAGE"))?)?;
            let p = catalog.profiles.get(&s.unit.deployment_profile).ok_or(Error::new("PROFILE_NOT_ALLOWED"))?;
            require(p.goal_verifiers.get(&g.payload.coverage.verification_profile) == Some(&receipt.issuer),"VERIFIER_SCOPE")?;
            require(r.acceptance_revision == g.payload.coverage.acceptance_revision
                && r.target_generation == s.unit.expected_target_generation+1,"RECEIPT_BINDING")?;
            if s.state == State::Applied {
                let installed: Option<String> = tx.query_row("SELECT unit FROM installed WHERE target=? AND generation=?", (&s.unit.target_runtime,r.target_generation), |r|r.get(0)).optional()?;
                require(installed.as_deref() == Some(&r.unit_id),"INSTALLED_GENERATION_CHANGED")?;
            }
            let previous: Option<(u64,String)> = tx.query_row("SELECT revision,record FROM goal_receipts WHERE unit=? AND goal=? ORDER BY revision DESC LIMIT 1",
                (&r.unit_id,&r.goal_id), |r|Ok((r.get(0)?,r.get(1)?))).optional()?;
            if let Some((revision,raw)) = &previous {
                if *revision == r.revision && *raw == json(receipt)? { return digest(receipt); }
                let old: Signed<GoalReceipt> = parse(raw.clone())?;
                require(old.payload.outcome != GoalOutcome::OutcomeUnknown,"UNKNOWN_CANARY")?;
                require(old.payload.outcome != GoalOutcome::Pass,"GOAL_ALREADY_PASSED")?;
            }
            require(r.revision == previous.map(|x|x.0).unwrap_or(0)+1,"GOAL_REVISION_CAS")?;
            let hash = digest(receipt)?;
            tx.execute("INSERT INTO receipts VALUES (?,?,?,?)", (&hash,&r.unit_id,"goal",json(receipt)?))?;
            tx.execute("INSERT INTO goal_receipts VALUES (?,?,?,?,?)", (&r.unit_id,&r.goal_id,r.revision,&hash,json(receipt)?))?;
            if r.outcome == GoalOutcome::OutcomeUnknown {
                tx.execute("UPDATE meta SET value=1 WHERE key='quarantine'", [])?;
            }
            if s.state == State::Applied && r.outcome == GoalOutcome::Pass { enqueue(tx,&g,&hash,&r.unit_id)?; }
            Ok(hash)
        })
    }
    pub fn receipt(&self, actor: &Actor, receipt_digest: &str) -> Result<String> {
        self.transaction(|tx| {
            let (id, raw): (String, String) = tx
                .query_row(
                    "SELECT unit,record FROM receipts WHERE digest=?",
                    [receipt_digest],
                    |r| Ok((r.get(0)?, r.get(1)?)),
                )
                .optional()?
                .ok_or(Error::new("UNKNOWN_RECEIPT"))?;
            authorize(tx, actor, &id)?;
            Ok(raw)
        })
    }
    pub fn outbox(&self, actor: &Actor) -> Result<Vec<OutboxEntry>> {
        self.transaction(|tx| {
            let mut stmt = tx.prepare("SELECT o.id,o.goal,o.producer,o.expected_revision,o.receipt FROM outbox o JOIN actors a ON a.unit=o.unit WHERE a.actor=? AND o.delivered=0 ORDER BY o.id")?;
            let rows = stmt.query_map([&actor.id], |r|Ok(OutboxEntry {id:r.get(0)?,goal_id:r.get(1)?,producer_id:r.get(2)?,expected_producer_revision:r.get(3)?,receipt_digest:r.get(4)?}))?
                .collect::<std::result::Result<Vec<_>,_>>()?;
            Ok(rows)
        })
    }
    pub fn acknowledge_closure(
        &self,
        catalog: &Catalog,
        ack: &Signed<ClosureAcknowledgement>,
    ) -> Result<()> {
        self.transaction(|tx| {
            let a = &ack.payload;
            let (goal, producer, rev, receipt): (String, String, u64, String) = tx
                .query_row(
                    "SELECT goal,producer,expected_revision,receipt FROM outbox WHERE id=?",
                    [&a.outbox_id],
                    |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
                )
                .optional()?
                .ok_or(Error::new("UNKNOWN_OUTBOX"))?;
            verify_signed(ack, catalog, &producer)?;
            require(
                ack.issuer == producer
                    && a.goal_id == goal
                    && a.previous_revision == rev
                    && a.closed_revision == rev + 1
                    && a.receipt_digest == receipt,
                "CLOSURE_BINDING",
            )?;
            tx.execute("UPDATE outbox SET delivered=1 WHERE id=?", [&a.outbox_id])?;
            Ok(())
        })
    }
}
pub(super) fn finalize(tx: &Transaction<'_>, s: &UnitStatus) -> Result<()> {
    let (hash, raw): (String, String) = tx
        .query_row(
            "SELECT digest,record FROM receipts WHERE unit=? AND kind='transaction'",
            [&s.unit.deployment_unit_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()?
        .ok_or(Error::new("TRANSACTION_RECEIPT_REQUIRED"))?;
    let receipt: TransactionReceipt = parse(raw)?;
    let current: u64 = tx
        .query_row(
            "SELECT generation FROM installed WHERE target=?",
            [&s.unit.target_runtime],
            |r| r.get(0),
        )
        .optional()?
        .unwrap_or(0);
    require(
        current == s.unit.expected_target_generation,
        "PREIMAGE_MISMATCH",
    )?;
    let mut stmt = tx.prepare("SELECT record FROM coverage WHERE unit=?")?;
    let goals = stmt
        .query_map([&s.unit.deployment_unit_id], |r| r.get::<_, String>(0))?
        .collect::<std::result::Result<Vec<_>, _>>()?;
    for raw in goals {
        let g: Signed<ReadyRecord> = parse(raw)?;
        let (hash,raw): (String,String) = tx.query_row("SELECT digest,record FROM goal_receipts WHERE unit=? AND goal=? ORDER BY revision DESC LIMIT 1",
            (&s.unit.deployment_unit_id,&g.payload.goal_id), |r|Ok((r.get(0)?,r.get(1)?))).optional()?.ok_or(Error::new("GOAL_RECEIPT_REQUIRED"))?;
        let receipt: Signed<GoalReceipt> = parse(raw)?;
        require(
            receipt.payload.outcome != GoalOutcome::OutcomeUnknown,
            "UNKNOWN_CANARY",
        )?;
        if receipt.payload.outcome == GoalOutcome::Pass {
            enqueue(tx, &g, &hash, &s.unit.deployment_unit_id)?;
        }
    }
    tx.execute("INSERT INTO installed VALUES (?,?,?,?) ON CONFLICT(target) DO UPDATE SET unit=excluded.unit,generation=excluded.generation,receipt=excluded.receipt",
        (&s.unit.target_runtime,&s.unit.deployment_unit_id,receipt.target_generation,hash))?;
    Ok(())
}
fn enqueue(
    tx: &Transaction<'_>,
    goal: &Signed<ReadyRecord>,
    receipt: &str,
    unit: &str,
) -> Result<()> {
    let id = digest(&(unit, &goal.payload.goal_id, receipt))?;
    tx.execute("INSERT OR IGNORE INTO outbox(id,unit,goal,producer,expected_revision,receipt) VALUES (?,?,?,?,?,?)",
        (id,unit,&goal.payload.goal_id,&goal.issuer,goal.payload.revision,receipt))?;
    Ok(())
}
