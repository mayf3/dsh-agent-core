use super::*;
use crate::trust::{digest, valid_digest, verify_signed};
impl Queue {
    pub fn next_ready(&self, _catalog: &Catalog) -> Result<Option<UnitStatus>> {
        self.transaction(select_ready)
    }

    /// Daemon executor only. Caller transport cannot expose arbitrary phase transitions.
    pub fn transition(
        &self,
        id: &str,
        revision: u64,
        next: State,
        evidence_digest: &str,
    ) -> Result<UnitStatus> {
        valid_digest(evidence_digest)?;
        require(next != State::Queued, "RECOVERY_EVIDENCE_REQUIRED")?;
        self.transaction(|tx| change(tx, id, revision, next, evidence_digest))
    }
    pub fn cancel_pending(&self, actor: &Actor, id: &str, revision: u64) -> Result<UnitStatus> {
        self.transaction(|tx| {
            authorize(tx, actor, id)?;
            change(
                tx,
                id,
                revision,
                State::Cancelled,
                &digest(&(actor, id, revision))?,
            )
        })
    }
    /// Signed recovery evidence can authorize bounded known-failure retries, never unlock unknowns.
    pub fn retry(
        &self,
        catalog: &Catalog,
        evidence: &Signed<RecoveryEvidence>,
        now: u64,
    ) -> Result<UnitStatus> {
        self.transaction(|tx| {
            let e = &evidence.payload;
            let s = read_status(tx, &e.unit_id)?;
            verify_signed(evidence, catalog, &s.unit.deployment_profile)?;
            require(s.revision == e.status_revision, "REVISION_CAS")?;
            require(
                matches!(s.state, State::Blocked | State::RolledBack),
                "UNKNOWN_OUTCOME",
            )?;
            require(
                e.issued_at <= now && now - e.issued_at <= 300,
                "RECOVERY_EXPIRED",
            )?;
            for d in [
                &e.failure_cause_digest,
                &e.remediation_digest,
                &e.restored_preimage_digest,
                &e.service_readback_digest,
                &e.owned_operations_receipt,
            ] {
                valid_digest(d)?;
            }
            require(
                !e.step_dispositions.is_empty()
                    && e.step_dispositions
                        .iter()
                        .all(|s| !matches!(s, StepDisposition::Unknown(_))),
                "UNKNOWN_OUTCOME",
            )?;
            require(
                s.preflight_attempts < 3 && s.mutating_attempts < 2,
                "RETRY_BUDGET_EXHAUSTED",
            )?;
            let profile = catalog
                .profiles
                .get(&s.unit.deployment_profile)
                .ok_or(Error::new("PROFILE_NOT_ALLOWED"))?;
            require(
                profile.enabled && profile.revision == s.unit.profile_revision,
                "PROFILE_NOT_ALLOWED",
            )?;
            let hash = digest(evidence)?;
            tx.execute(
                "INSERT OR IGNORE INTO receipts VALUES (?,?,?,?)",
                (&hash, &e.unit_id, "recovery", json(evidence)?),
            )?;
            let result = change(
                tx,
                &e.unit_id,
                s.revision,
                State::Queued,
                &digest(evidence)?,
            )?;
            tx.execute("DELETE FROM pauses WHERE unit=?", [&e.unit_id])?;
            Ok(result)
        })
    }
    /// Startup executor calls this only while holding the permanent OS mutex.
    /// It never invents a safe result; all interrupted phases become RECOVERING and quarantine the lane.
    pub fn mark_interrupted(&self) -> Result<Vec<String>> {
        self.transaction(|tx| {
            let mut stmt = tx.prepare("SELECT id FROM units WHERE state IN ('\"Precheck\"','\"Applying\"','\"Restarting\"','\"Verifying\"','\"Finalizing\"','\"RollingBack\"')")?;
            let ids = stmt.query_map([], |r|r.get::<_,String>(0))?.collect::<std::result::Result<Vec<_>,_>>()?;
            for id in &ids {
                let s = read_status(tx,id)?;
                change(tx,id,s.revision,State::Recovering,&digest(&(id,s.revision,"startup-interrupted"))?)?;
            }
            Ok(ids)
        })
    }
}
pub(super) fn change(
    tx: &Transaction<'_>,
    id: &str,
    revision: u64,
    next: State,
    evidence: &str,
) -> Result<UnitStatus> {
    let s = read_status(tx, id)?;
    require(s.revision == revision, "REVISION_CAS")?;
    let legal = matches!(
        (s.state, next),
        (
            State::Queued,
            State::Precheck | State::Cancelled | State::Superseded
        ) | (
            State::Precheck,
            State::Applying | State::Blocked | State::Recovering
        ) | (
            State::Applying,
            State::Restarting | State::RollingBack | State::Recovering | State::Quarantined
        ) | (
            State::Restarting,
            State::Verifying | State::RollingBack | State::Recovering | State::Quarantined
        ) | (
            State::Verifying,
            State::Finalizing | State::RollingBack | State::Recovering | State::Quarantined
        ) | (
            State::Finalizing,
            State::Applied | State::RollingBack | State::Recovering | State::Quarantined
        ) | (
            State::RollingBack,
            State::RolledBack | State::Recovering | State::Quarantined
        ) | (State::Recovering, State::Quarantined)
            | (State::Blocked | State::RolledBack, State::Queued)
    );
    require(legal, "ILLEGAL_TRANSITION")?;
    if next == State::Precheck {
        let occupied: u64 = tx.query_row("SELECT count(*) FROM units WHERE state IN ('\"Precheck\"','\"Applying\"','\"Restarting\"','\"Verifying\"','\"Finalizing\"','\"RollingBack\"','\"Recovering\"')", [], |r|r.get(0))?;
        let blocked: u64 = tx.query_row(
            "SELECT value+(SELECT count(*) FROM pauses) FROM meta WHERE key='quarantine'",
            [],
            |r| r.get(0),
        )?;
        require(occupied == 0 && blocked == 0, "LANE_BLOCKED")?;
        require(
            select_ready(tx)?.is_some_and(|s| s.unit.deployment_unit_id == id),
            "NOT_QUEUE_HEAD",
        )?;
        require(s.preflight_attempts < 3, "RETRY_BUDGET_EXHAUSTED")?;
        tx.execute(
            "UPDATE intents SET preflight=preflight+1 WHERE id=?",
            [s.unit.deployment_intent_id],
        )?;
    }
    if next == State::Applying {
        require(s.mutating_attempts < 2, "RETRY_BUDGET_EXHAUSTED")?;
        tx.execute(
            "UPDATE intents SET mutations=mutations+1 WHERE id=?",
            [s.unit.deployment_intent_id],
        )?;
    }
    if next == State::Applied {
        super::receipts::finalize(tx, &s)?;
    }
    if matches!(next, State::Recovering | State::Quarantined) {
        tx.execute("UPDATE meta SET value=1 WHERE key='quarantine'", [])?;
    }
    if matches!(next, State::Blocked | State::RolledBack) {
        let policy: String =
            tx.query_row("SELECT failure_policy FROM units WHERE id=?", [id], |r| {
                r.get(0)
            })?;
        if parse::<FailurePolicy>(policy)? == FailurePolicy::StopTrain {
            tx.execute("INSERT OR IGNORE INTO pauses VALUES (?)", [id])?;
        }
    }
    tx.execute(
        "UPDATE units SET state=?,revision=revision+1 WHERE id=? AND revision=?",
        (json(&next)?, id, revision),
    )?;
    tx.execute(
        "INSERT INTO journal(unit,revision,state,evidence) VALUES (?,?,?,?)",
        (id, revision + 1, json(&next)?, evidence),
    )?;
    read_status(tx, id)
}
pub(super) fn dependencies_satisfied(tx: &Transaction<'_>, id: &str) -> Result<bool> {
    let mut stmt = tx.prepare("SELECT record FROM dependencies WHERE unit=?")?;
    let records = stmt
        .query_map([id], |r| r.get::<_, String>(0))?
        .collect::<std::result::Result<Vec<_>, _>>()?;
    for raw in records {
        let dep: Dependency = parse(raw)?;
        let s = read_status(tx, &dep.unit_id)?;
        if s.state != State::Applied {
            return Ok(false);
        }
        let receipt: Option<String> = tx
            .query_row(
                "SELECT record FROM receipts WHERE digest=? AND unit=? AND kind='transaction'",
                (&dep.receipt_digest, &dep.unit_id),
                |r| r.get(0),
            )
            .optional()?;
        let Some(raw) = receipt else {
            return Ok(false);
        };
        let r: TransactionReceipt = parse(raw)?;
        if r.capability != dep.capability {
            return Ok(false);
        }
        for goal in &dep.required_goals {
            let raw: Option<String> = tx.query_row("SELECT record FROM goal_receipts WHERE unit=? AND goal=? ORDER BY revision DESC LIMIT 1",
                (&dep.unit_id,goal), |r|r.get(0)).optional()?;
            let Some(raw) = raw else {
                return Ok(false);
            };
            let receipt: Signed<GoalReceipt> = parse(raw)?;
            if receipt.payload.outcome != GoalOutcome::Pass {
                return Ok(false);
            }
        }
    }
    Ok(true)
}

fn select_ready(tx: &Transaction<'_>) -> Result<Option<UnitStatus>> {
    let quarantine: u64 =
        tx.query_row("SELECT value FROM meta WHERE key='quarantine'", [], |r| {
            r.get(0)
        })?;
    let paused: u64 = tx.query_row("SELECT count(*) FROM pauses", [], |r| r.get(0))?;
    let inflight: u64 = tx.query_row("SELECT count(*) FROM units WHERE state IN ('\"Precheck\"','\"Applying\"','\"Restarting\"','\"Verifying\"','\"Finalizing\"','\"RollingBack\"','\"Recovering\"')", [], |r|r.get(0))?;
    if quarantine > 0 || paused > 0 || inflight > 0 {
        return Ok(None);
    }
    let mut stmt =
        tx.prepare("SELECT id,resource FROM units WHERE state='\"Queued\"' ORDER BY seq,id")?;
    let rows = stmt
        .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))?
        .collect::<std::result::Result<Vec<_>, _>>()?;
    for (id, resource) in rows {
        let conflicts: u64 = tx.query_row("SELECT count(*) FROM units WHERE resource=? AND state IN ('\"Blocked\"','\"RolledBack\"','\"Quarantined\"')", [&resource], |r|r.get(0))?;
        if conflicts == 0 && dependencies_satisfied(tx, &id)? {
            return Ok(Some(read_status(tx, &id)?));
        }
    }
    Ok(None)
}
