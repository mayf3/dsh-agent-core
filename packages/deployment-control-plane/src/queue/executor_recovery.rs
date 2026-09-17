use super::*;
use crate::{transaction::RestorationProof, trust::digest};
impl Queue {
    pub(crate) fn latch_executor_failure(&self, evidence: &str) -> Result<()> {
        crate::trust::valid_digest(evidence)?;
        self.transaction(|tx| {
            tx.execute("UPDATE meta SET value=1 WHERE key='quarantine'", [])?;
            tx.execute("INSERT INTO meta(key,value) VALUES ('executor-failure',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", [evidence])?;
            Ok(())
        })
    }

    /// No public constructor/caller path; only the executor's real readback produces this proof.
    pub(crate) fn settle_executor_recovery(&self, proof: &RestorationProof) -> Result<()> {
        self.transaction(|tx| {
            let s = read_status(tx, &proof.unit)?;
            require(s.state == State::Recovering && s.revision == proof.status_revision
                && s.mutating_attempts == proof.attempt, "RECOVERY_BINDING")?;
            let unknown: u64 = tx.query_row("SELECT count(*) FROM goal_receipts WHERE unit=? AND json_extract(record,'$.payload.outcome')='OutcomeUnknown'", [&proof.unit], |r|r.get(0))?;
            require(unknown == 0, "UNKNOWN_CANARY")?;
            let hash = digest(proof)?;
            tx.execute("INSERT OR IGNORE INTO receipts VALUES (?,?,?,?)", (&hash, &proof.unit, "executor-recovery", json(proof)?))?;
            super::lifecycle::change(tx, &proof.unit, proof.status_revision, if proof.attempt == 0 { State::Blocked } else { State::RolledBack }, &hash)?;
            let unresolved: u64 = tx.query_row("SELECT count(*) FROM units WHERE state IN ('\"Recovering\"','\"Quarantined\"')", [], |r|r.get(0))?;
            let unknown: u64 = tx.query_row("SELECT count(*) FROM goal_receipts WHERE json_extract(record,'$.payload.outcome')='OutcomeUnknown'", [], |r|r.get(0))?;
            if unresolved == 0 && unknown == 0 { tx.execute("UPDATE meta SET value=0 WHERE key='quarantine'", [])?; }
            Ok(())
        })
    }
}
