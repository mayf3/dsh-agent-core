use super::*;
impl Queue {
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
