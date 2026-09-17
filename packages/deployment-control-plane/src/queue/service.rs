use super::*;
impl Queue {
    /// A refusal is bounded by unit/revision/stage/reason; repeated ticks do not
    /// grow the receipt ledger or change state, STOP, attempts or recovery authority.
    pub(crate) fn daemon_recovery_refused(
        &self,
        status: &UnitStatus,
        stage: &str,
        reason: &str,
    ) -> Result<()> {
        self.transaction(|tx| {
            let current = read_status(tx, &status.unit.deployment_unit_id)?;
            require(current.revision == status.revision, "REVISION_CAS")?;
            require(
                matches!(current.state, State::Blocked | State::RolledBack),
                "UNKNOWN_OUTCOME",
            )?;
            let record = serde_json::json!({
                "unit_id": current.unit.deployment_unit_id,
                "status_revision": current.revision,
                "target_runtime": current.unit.target_runtime,
                "deployment_profile": current.unit.deployment_profile,
                "intent": current.unit.deployment_intent_id,
                "expected_target_generation": current.unit.expected_target_generation,
                "preflight_attempts": current.preflight_attempts,
                "mutating_attempts": current.mutating_attempts,
                "operation": "mutation-recovery", "scope": "unit-local",
                "stage": stage, "reason": reason,
            });
            let hash = crate::trust::digest(&record)?;
            tx.execute(
                "INSERT OR IGNORE INTO receipts VALUES (?,?,?,?)",
                (
                    &hash,
                    &current.unit.deployment_unit_id,
                    "recovery-refusal",
                    json(&record)?,
                ),
            )?;
            Ok(())
        })
    }
    pub(crate) fn daemon_recovery_candidates(&self) -> Result<Vec<UnitStatus>> {
        self.transaction(|tx| {
            let mut statement=tx.prepare("SELECT id FROM units WHERE state IN ('\"Blocked\"','\"RolledBack\"') ORDER BY seq,id LIMIT 32")?;
            let ids=statement.query_map([],|r|r.get::<_,String>(0))?.collect::<std::result::Result<Vec<_>,_>>()?;
            ids.iter().map(|id|read_status(tx,id)).collect()
        })
    }
    pub(crate) fn daemon_failure_cause(&self, id: &str) -> Result<String> {
        self.transaction(|tx| {
            let status=read_status(tx,id)?;
            let unknown:u64=tx.query_row("SELECT count(*) FROM goal_receipts WHERE unit=? AND json_extract(record,'$.payload.outcome')='OutcomeUnknown'",[id],|r|r.get(0))?;
            require(unknown==0,"UNKNOWN_CANARY")?;
            Ok(tx.query_row("SELECT evidence FROM journal WHERE unit=? AND revision=?",(id,status.revision),|r|r.get(0))?)
        })
    }

    pub(crate) fn daemon_producer_revision(&self, id: &str) -> Result<u64> {
        self.transaction(|tx| {
            Ok(
                tx.query_row("SELECT revision FROM producers WHERE id=?", [id], |r| {
                    r.get(0)
                })?,
            )
        })
    }
    pub(crate) fn daemon_request_verification(&self, actor: &Actor, id: &str) -> Result<()> {
        self.transaction(|tx| {
            authorize(tx, actor, id)?;
            require(
                executor_finalization::projected_status(tx, id)?.state == State::Applied,
                "NOT_APPLIED",
            )?;
            // A durable monotonic token also prevents ABA after an earlier row was completed.
            let generation=bump(tx,"verification")?;
            tx.execute(
                "INSERT INTO verification_requests(unit,generation,last_error) VALUES (?,?,NULL) ON CONFLICT(unit) DO UPDATE SET generation=excluded.generation,last_error=NULL",
                (id,generation),
            )?;
            Ok(())
        })
    }
    pub(crate) fn daemon_next_verification(&self) -> Result<Option<(String, u64)>> {
        self.transaction(|tx| {
            Ok(tx
                .query_row(
                    "SELECT unit,generation FROM verification_requests WHERE last_error IS NULL OR last_error='MUTEX_BUSY' ORDER BY unit LIMIT 1",
                    [],
                    |r| Ok((r.get(0)?,r.get(1)?)),
                )
                .optional()?)
        })
    }
    pub(crate) fn daemon_finish_verification(
        &self,
        id: &str,
        generation: u64,
        error: Option<&str>,
    ) -> Result<()> {
        self.transaction(|tx| {
            if let Some(code) = error {
                // No acknowledged work disappears on failure. Contention remains runnable;
                // other failures retain an explicit durable disposition until a fresh retry.
                tx.execute(
                    "UPDATE verification_requests SET last_error=? WHERE unit=? AND generation=?",
                    (code, id, generation),
                )?;
            } else {
                tx.execute(
                    "DELETE FROM verification_requests WHERE unit=? AND generation=?",
                    (id, generation),
                )?;
            }
            Ok(())
        })
    }
    pub(crate) fn daemon_caller(&self, id: &str) -> Result<String> {
        self.transaction(|tx| {
            Ok(tx.query_row(
                "SELECT actor FROM actors WHERE unit=? ORDER BY actor LIMIT 1",
                [id],
                |r| r.get(0),
            )?)
        })
    }
    pub(crate) fn daemon_goal(&self, id: &str, goal: &str) -> Result<Option<Signed<GoalReceipt>>> {
        self.transaction(|tx|{
            let raw:Option<String>=tx.query_row("SELECT record FROM goal_receipts WHERE unit=? AND goal=? ORDER BY revision DESC LIMIT 1",(id,goal),|r|r.get(0)).optional()?;
            raw.map(parse).transpose()
        })
    }
    pub(crate) fn daemon_goal_attachment(&self, id: &str, goal: &str) -> Result<String> {
        self.transaction(|tx| {
            Ok(tx.query_row(
                "SELECT attachment FROM coverage WHERE unit=? AND goal=?",
                (id, goal),
                |r| r.get(0),
            )?)
        })
    }
}
