use super::*;
pub(super) fn is_current(tx: &Transaction<'_>, dep: &Dependency) -> Result<bool> {
    let s = read_status(tx, &dep.unit_id)?;
    let found: Option<String> = tx
        .query_row(
            "SELECT receipt FROM installed WHERE target=? AND unit=? AND generation=?",
            (
                &s.unit.target_runtime,
                &dep.unit_id,
                s.unit.expected_target_generation + 1,
            ),
            |r| r.get(0),
        )
        .optional()?;
    Ok(found.as_deref() == Some(dep.receipt_digest.as_str()))
}
pub(super) fn satisfied(tx: &Transaction<'_>, id: &str) -> Result<bool> {
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
        if dep.semantics == DependencySemantics::LiveInstallation && !is_current(tx, &dep)? {
            return Ok(false);
        }
        let raw: Option<String> = tx
            .query_row(
                "SELECT record FROM receipts WHERE digest=? AND unit=? AND kind='transaction'",
                (&dep.receipt_digest, &dep.unit_id),
                |r| r.get(0),
            )
            .optional()?;
        let Some(raw) = raw else {
            return Ok(false);
        };
        let transaction: TransactionReceipt = parse(raw)?;
        if transaction.capability != dep.capability || transaction.attempt != s.mutating_attempts {
            return Ok(false);
        }
        let physical = super::physical::current(tx, &s.unit.target_runtime)?
            .ok_or(Error::new("INSTALLED_GENERATION_CHANGED"))?;
        for goal in &dep.required_goals {
            let raw: Option<String>=tx.query_row("SELECT record FROM goal_receipts WHERE unit=? AND goal=? ORDER BY revision DESC LIMIT 1",
                (&dep.unit_id,goal),|r|r.get(0)).optional()?;
            let Some(raw) = raw else {
                return Ok(false);
            };
            let goal: Signed<GoalReceipt> = parse(raw)?;
            if goal.payload.outcome != GoalOutcome::Pass
                || goal.payload.attempt != transaction.attempt
                || goal.payload.target_generation != transaction.target_generation
                || goal.payload.service_generation != physical.service_generation
            {
                return Ok(false);
            }
        }
    }
    Ok(true)
}
