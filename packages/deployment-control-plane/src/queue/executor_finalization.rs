use super::*;
use crate::{transaction::VerifiedFinalization, trust::digest};
impl Queue {
    pub(crate) fn block_executor_prewrite(
        &self,
        id: &str,
        revision: u64,
        evidence: &str,
    ) -> Result<()> {
        self.transaction(|tx| {
            require(
                read_status(tx, id)?.state == State::Precheck,
                "NOT_PRECHECK",
            )?;
            super::lifecycle::change(tx, id, revision, State::Blocked, evidence)?;
            tx.execute("DELETE FROM executor_pending WHERE unit=?", [id])?;
            Ok(())
        })
    }

    // Executor writes this before its first journal. Existing Queue-only APIs keep their contract.
    pub(crate) fn fence_executor_finalization(&self, id: &str) -> Result<()> {
        self.transaction(|tx| {
            require(
                read_status(tx, id)?.state == State::Precheck,
                "NOT_PRECHECK",
            )?;
            tx.execute("INSERT OR IGNORE INTO executor_pending VALUES (?)", [id])?;
            Ok(())
        })
    }
    // The private proof comes only from a flushed, hash-checked Finalized journal under the guard.
    pub(crate) fn complete_executor_finalization(&self, proof: VerifiedFinalization) -> Result<()> {
        let receipt = proof.0;
        self.transaction(|tx| {
            let status = read_status(tx, &receipt.unit_id)?;
            require(
                status.state == State::Applied && status.mutating_attempts == receipt.attempt,
                "FINALIZATION_BINDING",
            )?;
            let hash = digest(&receipt)?;
            let stored: String = tx.query_row(
                "SELECT record FROM receipts WHERE digest=? AND unit=? AND kind='transaction'",
                (&hash, &receipt.unit_id),
                |r| r.get(0),
            )?;
            require(stored == json(&receipt)?, "FINALIZATION_BINDING")?;
            tx.execute(
                "DELETE FROM executor_pending WHERE unit=?",
                [&receipt.unit_id],
            )?;
            Ok(())
        })
    }
}

pub(super) fn pending(tx: &Transaction<'_>, id: &str) -> Result<bool> {
    Ok(tx.query_row(
        "SELECT count(*) FROM executor_pending WHERE unit=?",
        [id],
        |r| r.get::<_, u64>(0),
    )? != 0)
}
pub(super) fn projected_status(tx: &Transaction<'_>, id: &str) -> Result<UnitStatus> {
    let mut status = read_status(tx, id)?;
    if status.state == State::Applied && pending(tx, id)? {
        status.state = State::Finalizing;
    }
    Ok(status)
}
