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
            tx.execute(
                "INSERT OR IGNORE INTO verification_requests VALUES (?)",
                [id],
            )?;
            Ok(())
        })
    }
    pub(crate) fn daemon_next_verification(&self) -> Result<Option<String>> {
        self.transaction(|tx| {
            Ok(tx
                .query_row(
                    "SELECT unit FROM verification_requests ORDER BY unit LIMIT 1",
                    [],
                    |r| r.get(0),
                )
                .optional()?)
        })
    }
    pub(crate) fn daemon_finish_verification(&self, id: &str) -> Result<()> {
        self.transaction(|tx| {
            tx.execute("DELETE FROM verification_requests WHERE unit=?", [id])?;
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
