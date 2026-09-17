use super::*;
use crate::trust::{validate_policy, validate_proposal};
pub(super) fn validate_unit(
    tx: &Transaction<'_>,
    catalog: &Catalog,
    id: &str,
    policy: &Signed<Policy>,
    now: u64,
) -> Result<()> {
    let status = read_status(tx, id)?;
    validate_policy(catalog, &status.unit.deployment_profile, policy, now)?;
    super::admission::pin_policy(tx, &status.unit.deployment_profile, policy)?;
    let attachments = super::readback::read_attachments(tx, id)?;
    require(!attachments.is_empty(), "GOAL_COVERAGE")?;
    for attachment in attachments {
        let mut evidence = attachment.proposal;
        evidence.policy = policy.clone();
        let actor = Actor {
            id: "daemon-revalidation".into(),
            allowed_profiles: vec![evidence.deployment_profile.clone()],
            allowed_producers: evidence
                .goals
                .iter()
                .map(|g| g.payload.producer_id.clone())
                .collect(),
        };
        validate_proposal(catalog, &actor, &evidence, now)?;
    }
    super::admission::check_dependencies(tx, &status.unit.dependency_units)?;
    require(
        super::dependencies::satisfied(tx, id)?,
        "DEPENDENCY_NOT_SATISFIED",
    )?;
    let current: Option<(String, u64)> = tx
        .query_row(
            "SELECT unit,generation FROM installed WHERE target=?",
            [&status.unit.target_runtime],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()?;
    if status.state == State::Applied {
        require(
            current.as_ref().is_some_and(|(unit, generation)| {
                unit == id && *generation == status.unit.expected_target_generation + 1
            }),
            "INSTALLED_GENERATION_CHANGED",
        )
    } else {
        require(
            current.map(|x| x.1).unwrap_or(0) == status.unit.expected_target_generation,
            "PREIMAGE_MISMATCH",
        )
    }
}
