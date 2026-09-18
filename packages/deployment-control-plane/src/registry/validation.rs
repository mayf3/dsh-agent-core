use super::*;
use std::collections::BTreeSet;
fn source(value: &str) -> Result<()> {
    require(
        value.len() == 40 && value.bytes().all(|b| b.is_ascii_hexdigit()),
        "INVALID_SOURCE",
    )
}
fn reference(value: &EvidenceReference) -> Result<()> {
    require(
        !value.uri.is_empty()
            && value.uri.len() <= 2048
            && !value.uri.chars().any(char::is_control),
        "INVALID_REFERENCE",
    )?;
    valid_digest(&value.sha256)
}
pub(super) fn enrollment(
    catalog: &Catalog,
    producer: &str,
    signed: &Signed<Enrollment>,
) -> Result<()> {
    let e = &signed.payload;
    verify_signed(signed, catalog, &e.deployment_profile)?;
    for id in [
        &e.goal_id,
        &e.business_goal_id,
        &e.acceptance_revision,
        &e.verification_profile,
        &e.authority.revision,
        &e.standing_authority_revision,
    ] {
        valid_id(id)?;
    }
    require(
        e.owner == "mayf3" && e.producer_id == producer,
        "ENROLLMENT_OWNER",
    )?;
    require(e.goal_id != e.business_goal_id, "DEPLOYMENT_SCOPE")?;
    require(
        !e.origin_uri.is_empty()
            && e.origin_uri.len() <= 2048
            && !e.origin_uri.chars().any(char::is_control),
        "INVALID_REFERENCE",
    )?;
    require(
        !e.scope_description.trim().is_empty() && e.scope_description.len() <= 4096,
        "DEPLOYMENT_SCOPE",
    )?;
    let profile = catalog
        .profiles
        .get(&e.deployment_profile)
        .ok_or(Error::new("PROFILE_NOT_ALLOWED"))?;
    require(
        e.repo == profile.repo
            && e.target_runtime == profile.target_runtime
            && e.standing_authority_revision == profile.standing_authority_revision
            && profile
                .verification_profiles
                .contains(&e.verification_profile)
            && profile.goal_verifiers.contains_key(&e.verification_profile),
        "ENROLLMENT_BINDING",
    )?;
    source(&e.authority.semantic_head)?;
    source(&e.authority.lifecycle_head)?;
    if let Some(frozen) = &e.frozen_source_sha {
        source(frozen)?;
    }
    reference(&e.authority.source)?;
    reference(&e.authority.acceptance)?;
    reference(&e.original_request)?;
    require(
        !e.authority.contracts.is_empty() && e.authority.contracts.len() <= 256,
        "ACCEPTANCE_CONTRACT_REQUIRED",
    )?;
    let mut unique = BTreeSet::new();
    for contract in &e.authority.contracts {
        valid_id(&contract.id)?;
        require(unique.insert(&contract.id), "DUPLICATE_CONTRACT")?;
        reference(&contract.source)?;
    }
    if let Some(history) = &e.historical_source {
        source(&history.implementation_sha)?;
        source(&history.release_sha)?;
        reference(&history.review)?;
    }
    require(e.prior_dependencies.len() <= 256, "DEPENDENCY_LIMIT")?;
    unique.clear();
    for dependency in &e.prior_dependencies {
        valid_id(&dependency.goal_id)?;
        require(
            dependency.goal_id != e.goal_id && unique.insert(&dependency.goal_id),
            "DEPENDENCY_BINDING",
        )?;
        reference(&dependency.provenance)?;
        if let Some(child) = &dependency.deployment_child {
            valid_id(&child.goal_id)?;
            valid_digest(&child.enrollment_digest)?;
            require(
                child.goal_id != e.goal_id
                    && child.goal_id != dependency.goal_id
                    && child.goal_id != e.business_goal_id,
                "DEPENDENCY_BINDING",
            )?;
        }
    }
    Ok(())
}
pub(super) fn ready(e: &Enrollment, proposal: &Proposal) -> Result<()> {
    let r = &proposal.goals[0].payload;
    require(
        e.frozen_source_sha.as_ref().is_none_or(|sha| {
            sha == &r.source_sha && sha == &proposal.acceptance.payload.source_sha
        }),
        "FROZEN_SOURCE_MISMATCH",
    )?;
    require(
        proposal.deployment_profile == e.deployment_profile
            && r.goal_id == e.goal_id
            && r.producer_id == e.producer_id
            && r.repo == e.repo
            && proposal.desired.payload.target_runtime == e.target_runtime
            && r.coverage.acceptance_revision == e.acceptance_revision
            && r.coverage.verification_profile == e.verification_profile
            && r.authority_revisions.contains(&e.authority.revision)
            && r.authority_revisions
                .contains(&e.standing_authority_revision)
            && proposal.acceptance.payload.authority_revision == e.standing_authority_revision,
        "ENROLLMENT_BINDING",
    )?;
    require(
        e.prior_dependencies.iter().all(|required| {
            r.dependencies.iter().any(|dep| {
                dep.required_goals
                    .iter()
                    .any(|id| id == required.effective_goal())
                    && (required.deployment_child.is_none()
                        || dep.semantics == DependencySemantics::LiveInstallation)
                    && proposal.dependencies.contains(dep)
            })
        }),
        "PRIOR_DEPENDENCY_REQUIRED",
    )
}
