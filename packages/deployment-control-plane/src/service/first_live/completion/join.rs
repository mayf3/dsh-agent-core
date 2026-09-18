use crate::{model::*, queue::completion::Projection, registry::DeploymentRecord, Result};
pub(super) struct Expected<'a> {
    pub goal: &'a str,
    pub source: &'a str,
    pub artifact: &'a str,
    pub target: &'a str,
    pub profile: &'a str,
}
pub(super) fn validate(
    c: &Catalog,
    e: &Expected<'_>,
    row: &DeploymentRecord,
    p: &Projection,
    physical: &serde_json::Value,
) -> Result<Option<&'static str>> {
    use crate::{
        error::require,
        registry::DeploymentState,
        trust::{digest, valid_digest, verify_signed},
    };
    require(p.quarantine == 0, "UNKNOWN_OUTCOME")?;
    if p.pending != 0 {
        return Ok(Some("EXECUTOR_PENDING"));
    }
    let (Some(current), Some(s), Some(ready), Some(goal)) =
        (&p.current, &p.status, &p.ready, &p.goal)
    else {
        return Ok(Some("CURRENT_GOAL_EVIDENCE_PENDING"));
    };
    let u = &s.unit;
    let enrollment = &row.enrollment.payload;
    require(
        enrollment.goal_id == e.goal
            && enrollment.target_runtime == e.target
            && enrollment.deployment_profile == e.profile
            && !row.business_goal_complete,
        "COMPLETION_ENROLLMENT",
    )?;
    if s.state != State::Applied {
        return Ok(Some("UNIT_NOT_APPLIED"));
    }
    require(
        u.source_sha == e.source
            && u.artifact_sha256 == e.artifact
            && u.target_runtime == e.target
            && u.deployment_profile == e.profile
            && u.repo == enrollment.repo,
        "COMPLETION_FIXED_TUPLE",
    )?;
    require(
        current.unit_id == u.deployment_unit_id
            && current.attempt == s.mutating_attempts
            && u.expected_target_generation.checked_add(1) == Some(current.target_generation),
        "COMPLETION_INSTALLATION",
    )?;
    verify_signed(ready, c, &enrollment.producer_id)?;
    require(
        row.ready.as_ref() == Some(ready)
            && ready.issuer == enrollment.producer_id
            && ready.payload.goal_id == e.goal
            && ready.payload.producer_id == enrollment.producer_id
            && ready.payload.source_sha == e.source
            && ready.payload.artifact_sha256 == e.artifact
            && ready.payload.repo == u.repo
            && ready.payload.coverage.goal_id == e.goal
            && ready.payload.coverage.source_sha == e.source,
        "COMPLETION_READY",
    )?;
    require(
        !matches!(
            goal.payload.outcome,
            GoalOutcome::Fail | GoalOutcome::OutcomeUnknown
        ),
        "COMPLETION_GOAL_FAILED_OR_UNKNOWN",
    )?;
    if goal.payload.outcome != GoalOutcome::Pass {
        return Ok(Some("LATEST_GOAL_NOT_PASS"));
    }
    verify_signed(goal, c, e.profile)?;
    let profile = c
        .profiles
        .get(e.profile)
        .ok_or(crate::Error::new("PROFILE_NOT_ALLOWED"))?;
    require(
        profile.goal_verifiers.get(&enrollment.verification_profile) == Some(&goal.issuer),
        "VERIFIER_SCOPE",
    )?;
    let g = &goal.payload;
    valid_digest(&g.evidence_digest)?;
    require(
        g.goal_id == e.goal
            && g.unit_id == u.deployment_unit_id
            && g.acceptance_revision == enrollment.acceptance_revision
            && g.acceptance_revision == ready.payload.coverage.acceptance_revision
            && ready.payload.coverage.verification_profile == enrollment.verification_profile
            && g.target_generation == current.target_generation
            && g.attempt == current.attempt
            && g.service_generation == current.service_generation
            && p.attachment.as_ref() == Some(&g.attachment_digest),
        "COMPLETION_GOAL_BINDING",
    )?;
    for (key, value) in [
        ("service_generation", &current.service_generation),
        ("installation_binding_digest", &current.binding_digest),
        ("source_sha", &u.source_sha),
        ("target_runtime", &u.target_runtime),
    ] {
        require(
            physical.get(key).and_then(|v| v.as_str()) == Some(value.as_str()),
            "COMPLETION_PHYSICAL_BINDING",
        )?;
    }
    let Some(ack) = &row.closure else {
        return Ok(Some("REGISTRY_CLOSURE_PENDING"));
    };
    verify_signed(ack, c, &enrollment.producer_id)?;
    let Some((out, delivered)) = &p.outbox else {
        return Ok(Some("OUTBOX_PENDING"));
    };
    let a = &ack.payload;
    let receipt_digest = digest(goal)?;
    require(
        row.state == DeploymentState::Closed
            && ack.issuer == enrollment.producer_id
            && a.goal_id == e.goal
            && a.receipt_digest == receipt_digest
            && a.previous_revision == ready.payload.revision
            && a.previous_revision.checked_add(1) == Some(a.closed_revision)
            && row.revision == a.closed_revision
            && a.outbox_id == out.id
            && out.goal_id == e.goal
            && out.producer_id == enrollment.producer_id
            && out.receipt_digest == receipt_digest
            && out.expected_producer_revision == a.previous_revision
            && out.id == digest(&(&u.deployment_unit_id, e.goal, &receipt_digest))?,
        "COMPLETION_CLOSURE_BINDING",
    )?;
    if !delivered {
        return Ok(Some("QUEUE_ACK_PENDING"));
    }
    Ok(None)
}
#[cfg(test)]
#[path = "../../../../test/completion/join.rs"]
mod tests;
