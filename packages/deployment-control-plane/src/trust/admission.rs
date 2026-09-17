use crate::{error::require, model::*, trust::verify_signed, Error, Result};
use std::collections::BTreeSet;
pub fn valid_id(value: &str) -> Result<()> {
    require(
        !value.is_empty()
            && value.len() <= 128
            && value
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b"_-.:".contains(&b)),
        "INVALID_ID",
    )
}
pub fn valid_digest(value: &str) -> Result<()> {
    require(
        value.len() == 64
            && value
                .bytes()
                .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b)),
        "INVALID_DIGEST",
    )
}
fn source(value: &str) -> Result<()> {
    require(
        value.len() == 40 && value.bytes().all(|b| b.is_ascii_hexdigit()),
        "INVALID_SOURCE",
    )
}
pub fn validate_policy(
    c: &Catalog,
    profile_id: &str,
    policy: &Signed<Policy>,
    now: u64,
) -> Result<()> {
    valid_id(profile_id)?;
    let p = c
        .profiles
        .get(profile_id)
        .ok_or(Error::new("PROFILE_NOT_ALLOWED"))?;
    verify_signed(policy, c, profile_id)?;
    let v = &policy.payload;
    require(
        v.issued_at <= now
            && v.expires_at >= now
            && v.expires_at > v.issued_at
            && v.expires_at - v.issued_at <= p.policy_lease_seconds.min(300)
            && now - v.issued_at <= p.policy_lease_seconds.min(300),
        "POLICY_EXPIRED",
    )?;
    require(
        v.standing_authority_revision == p.standing_authority_revision,
        "AUTHORITY_MISMATCH",
    )
}
pub fn validate_proposal<'a>(
    c: &'a Catalog,
    actor: &Actor,
    r: &Proposal,
    now: u64,
) -> Result<&'a Profile> {
    valid_id(&r.request_id)?;
    valid_id(&r.deployment_profile)?;
    valid_id(&actor.id)?;
    require(
        actor.allowed_profiles.contains(&r.deployment_profile),
        "ACTOR_SCOPE",
    )?;
    let p = c
        .profiles
        .get(&r.deployment_profile)
        .ok_or(Error::new("PROFILE_NOT_ALLOWED"))?;
    require(p.enabled, "PROFILE_NOT_ALLOWED")?;
    require(
        c.profiles.values().all(|other| {
            !other.enabled
                || other.host != p.host
                || other.install_root_id != p.install_root_id
                || other.target_runtime == p.target_runtime
        }),
        "TARGET_ROOT_CONFLICT",
    )?;
    validate_policy(c, &r.deployment_profile, &r.policy, now)?;
    verify_signed(&r.acceptance, c, &r.deployment_profile)?;
    verify_signed(&r.build, c, &r.deployment_profile)?;
    verify_signed(&r.desired, c, &r.deployment_profile)?;
    require(r.build.issuer != actor.id, "BUILDER_NOT_ISOLATED")?;
    let a = &r.acceptance.payload;
    let b = &r.build.payload;
    let d = &r.desired.payload;
    source(&a.source_sha)?;
    source(&a.tree_sha)?;
    valid_digest(&b.artifact_sha256)?;
    valid_digest(&b.manifest_digest)?;
    require(!b.dependency_closure.is_empty(), "DEPENDENCY_CLOSURE")?;
    for hash in &b.dependency_closure {
        valid_digest(hash)?;
    }
    require(
        a.repo == p.repo
            && b.repo == p.repo
            && b.source_sha == a.source_sha
            && b.tree_sha == a.tree_sha,
        "SOURCE_MISMATCH",
    )?;
    require(b.artifact_sha256 == d.artifact_sha256, "ARTIFACT_MISMATCH")?;
    require(
        b.profile_revision == p.revision
            && d.profile_revision == p.revision
            && d.target_runtime == p.target_runtime,
        "PROFILE_MISMATCH",
    )?;
    require(
        a.authority_revision == p.standing_authority_revision,
        "AUTHORITY_MISMATCH",
    )?;
    require(
        b.recipe == p.build_recipe
            && b.toolchain == p.toolchain
            && b.architecture == p.architecture,
        "BUILD_BINDING",
    )?;
    require(
        !r.policy.payload.revoked_sources.contains(&a.source_sha)
            && !r
                .policy
                .payload
                .revoked_artifacts
                .contains(&b.artifact_sha256),
        "REVOKED",
    )?;
    let mut scopes = BTreeSet::new();
    for review in &r.reviews {
        verify_signed(review, c, &r.deployment_profile)?;
        require(!a.semantic_authors.contains(&review.issuer), "SELF_REVIEW")?;
        let v = &review.payload;
        require(
            v.repo == a.repo && v.source_sha == a.source_sha,
            "SOURCE_MISMATCH",
        )?;
        require(
            v.artifact_sha256 == b.artifact_sha256 && v.manifest_digest == b.manifest_digest,
            "ARTIFACT_MISMATCH",
        )?;
        require(v.profile_revision == p.revision, "PROFILE_MISMATCH")?;
        scopes.extend(v.scopes.iter().cloned());
    }
    require(
        p.required_review_scopes.iter().all(|s| scopes.contains(s)),
        "REVIEW_MISSING",
    )?;
    require(!r.goals.is_empty() && r.goals.len() <= 256, "GOAL_COVERAGE")?;
    let mut goals = BTreeSet::new();
    for ready in &r.goals {
        verify_signed(ready, c, &ready.payload.producer_id)?;
        let g = &ready.payload;
        valid_id(&g.goal_id)?;
        require(
            ready.issuer == g.producer_id && actor.allowed_producers.contains(&g.producer_id),
            "PRODUCER_SCOPE",
        )?;
        require(g.revision > 0 && g.repo == a.repo, "SOURCE_MISMATCH")?;
        require(g.artifact_sha256 == b.artifact_sha256, "ARTIFACT_MISMATCH")?;
        require(
            goals.insert(g.goal_id.clone())
                && g.coverage.goal_id == g.goal_id
                && g.coverage.source_sha == g.source_sha
                && b.goal_coverage.contains(&g.coverage)
                && g.authority_revisions.contains(&a.authority_revision)
                && p.verification_profiles
                    .contains(&g.coverage.verification_profile),
            "GOAL_COVERAGE",
        )?;
        valid_digest(&g.coverage.release_face_sha256)?;
        valid_id(&g.coverage.acceptance_revision)?;
        require(
            g.dependencies
                .iter()
                .all(|dep| r.dependencies.contains(dep)),
            "DEPENDENCY_COVERAGE",
        )?;
    }
    Ok(p)
}
