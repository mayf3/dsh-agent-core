//! Authenticated, explicit business-prerequisite to deployment-child resolution.
use super::*;
use std::collections::BTreeSet;

pub(super) fn validate(rows: &BTreeMap<String, DeploymentRecord>, goal: &str) -> Result<()> {
    visit(rows, goal, &mut BTreeSet::new(), &mut BTreeSet::new())
}
fn visit(
    rows: &BTreeMap<String, DeploymentRecord>,
    goal: &str,
    active: &mut BTreeSet<String>,
    done: &mut BTreeSet<String>,
) -> Result<()> {
    if done.contains(goal) {
        return Ok(());
    }
    require(active.insert(goal.into()), "DEPENDENCY_CYCLE")?;
    let e = &rows
        .get(goal)
        .ok_or(Error::new("UNKNOWN_ENROLLMENT"))?
        .enrollment
        .payload;
    let mut effective = BTreeSet::new();
    for dependency in &e.prior_dependencies {
        let id = dependency.effective_goal();
        require(effective.insert(id), "DEPENDENCY_BINDING")?;
        if let Some(child) = &dependency.deployment_child {
            let signed = &rows
                .get(id)
                .ok_or(Error::new("DEPENDENCY_CHILD_MISSING"))?
                .enrollment;
            let c = &signed.payload;
            require(
                digest(signed)? == child.enrollment_digest
                    && c.business_goal_id == dependency.goal_id
                    && c.goal_id != e.goal_id
                    && c.goal_id != e.business_goal_id
                    && c.repo == e.repo
                    && c.target_runtime == e.target_runtime
                    && c.deployment_profile == e.deployment_profile
                    && c.producer_id == e.producer_id
                    && c.standing_authority_revision == e.standing_authority_revision,
                "DEPENDENCY_CHILD_BINDING",
            )?;
            // The full signed enrollment pins its accepted authority/contracts,
            // acceptance revision and exact catalog verifier. Never infer by label.
        }
        if rows.contains_key(id) {
            visit(rows, id, active, done)?;
        }
    }
    active.remove(goal);
    done.insert(goal.into());
    Ok(())
}
