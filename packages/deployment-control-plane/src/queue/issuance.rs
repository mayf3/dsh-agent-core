//! Read-only coordinates for the fixed local issuer; no caller chosen generations.
use super::*;
#[cfg(test)]
#[path = "../../test/issuer/queue.rs"]
mod tests;
impl Queue {
    pub(crate) fn issuer_desired(&self, profile: &Profile, artifact: &str) -> Result<DesiredState> {
        self.transaction(|tx| {
            let prior: Option<(u64,String,String,u64)> = tx.query_row(
                "SELECT desired_revision,artifact,profile_revision,expected_generation FROM intents WHERE target=? ORDER BY desired_revision DESC LIMIT 1",
                [&profile.target_runtime], |r| Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?))).optional()?;
            if let Some((revision, old, p, generation)) = &prior {
                if old == artifact && p == &profile.revision {
                    return Ok(DesiredState { target_runtime: profile.target_runtime.clone(), revision: *revision,
                        expected_target_generation: *generation, artifact_sha256: artifact.into(), profile_revision: profile.revision.clone() });
                }
            }
            let generation: Option<u64> = tx.query_row("SELECT generation FROM installed WHERE target=?", [&profile.target_runtime], |r| r.get(0)).optional()?;
            Ok(DesiredState { target_runtime: profile.target_runtime.clone(), revision: prior.map_or(Ok(1), |p| p.0.checked_add(1).ok_or(Error::new("SIZE_LIMIT")))?,
                expected_target_generation: generation.unwrap_or(0), artifact_sha256: artifact.into(), profile_revision: profile.revision.clone() })
        })
    }
    pub(crate) fn issuer_dependencies(&self, goals: &[String]) -> Result<Vec<Dependency>> {
        self.transaction(|tx| {
            let mut out = Vec::new();
            for goal_id in goals {
                let raw: Option<String> = tx.query_row(
                    "SELECT g.record FROM goal_receipts g JOIN installed i ON i.unit=g.unit JOIN units u ON u.id=g.unit WHERE g.goal=? AND u.state='\"Applied\"' ORDER BY g.revision DESC LIMIT 1",
                    [goal_id], |r| r.get(0)).optional()?;
                let goal: Signed<GoalReceipt> = parse(raw.ok_or(Error::new("PRIOR_DEPENDENCY_PENDING"))?)?;
                let state = read_status(tx, &goal.payload.unit_id)?;
                require(!super::executor_finalization::pending(tx, &goal.payload.unit_id)? && goal.payload.outcome == GoalOutcome::Pass, "PRIOR_DEPENDENCY_PENDING")?;
                let (hash,receipt)=super::installation::installed(tx,&state.unit.target_runtime)?.ok_or(Error::new("PRIOR_DEPENDENCY_PENDING"))?;
                let coordinates=receipt.current(&hash);
                let physical = super::physical::current(tx, &state.unit.target_runtime)?.ok_or(Error::new("PRIOR_DEPENDENCY_PENDING"))?;
                require(goal.payload.attempt == coordinates.attempt && goal.payload.target_generation == coordinates.target_generation
                    && goal.payload.service_generation == physical.service_generation, "PRIOR_DEPENDENCY_PENDING")?;
                out.push(Dependency { unit_id: goal.payload.unit_id, receipt_digest: hash, capability: receipt.capability().into(),
                    required_goals: vec![goal_id.clone()], semantics: DependencySemantics::LiveInstallation });
            }
            Ok(out)
        })
    }
}
