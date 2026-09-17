use super::*;
use crate::trust::{digest, valid_id, validate_policy, validate_proposal};
impl Queue {
    pub fn submit(
        &self,
        catalog: &Catalog,
        actor: &Actor,
        proposal: &Proposal,
        now: u64,
    ) -> Result<Submission> {
        valid_id(&actor.id)?;
        valid_id(&proposal.request_id)?;
        let request_digest = digest(proposal)?;
        if let Some(result) =
            self.transaction(|tx| recover_request(tx, actor, proposal, &request_digest))?
        {
            return Ok(result);
        }
        self.observe_policy(catalog, &proposal.deployment_profile, &proposal.policy, now)?;
        let profile = validate_proposal(catalog, actor, proposal, now)?;
        self.transaction(|tx| {
            if let Some(result)=recover_request(tx,actor,proposal,&request_digest)? { return Ok(result); }
            pin_policy(tx,&proposal.deployment_profile,&proposal.policy)?;
            let recent: u64 = tx.query_row("SELECT count(*) FROM requests WHERE actor=? AND created_at>=?",
                (&actor.id,now.saturating_sub(60)), |r|r.get(0))?;
            require(recent < profile.actor_quota as u64,"ACTOR_RATE_LIMIT")?;
            for g in &proposal.goals {
                let current: Option<String> = tx.query_row("SELECT record FROM ready WHERE goal=?", [&g.payload.goal_id], |r| r.get(0)).optional()?;
                require(current == Some(json(g)?), "READY_REVISION_MISMATCH")?;
            }
            check_dependencies(tx,&proposal.dependencies)?;
            // Passive late coverage of the exact current installed intent may use its
            // original signed desired record after another attempt was rolled back.
            // It cannot allocate/replay an old intent or attach to a historical installation.
            let installed_intent: Option<(u64,String)> = tx.query_row("SELECT units.intent,intents.desired_digest FROM installed JOIN units ON units.id=installed.unit JOIN intents ON intents.id=units.intent WHERE installed.target=? AND units.profile=? AND units.profile_revision=? AND units.artifact=? AND units.state='\"Applied\"'",
                (&profile.target_runtime,&proposal.deployment_profile,&profile.revision,&proposal.build.payload.artifact_sha256),|r|Ok((r.get(0)?,r.get(1)?))).optional()?;
            let intent = match installed_intent {
                Some((intent, desired)) if desired == digest(&proposal.desired)? => intent,
                _ => resolve_intent(tx,proposal)?,
            };
            let existing: Option<String> = tx.query_row("SELECT id FROM units WHERE target=? AND intent=? AND profile_revision=? AND artifact=?",
                (&profile.target_runtime,intent,&profile.revision,&proposal.build.payload.artifact_sha256), |r| r.get(0)).optional()?;
            let unit_id = if let Some(id) = existing {
                let unit = read_status(tx,&id)?;
                require(unit.unit.manifest_digest == proposal.build.payload.manifest_digest
                    && unit.unit.source_sha == proposal.build.payload.source_sha, "ARTIFACT_MISMATCH")?;
                require(unit.unit.dependency_units == proposal.dependencies, "DEPENDENCY_CONFLICT")?;
                require(!matches!(unit.state,State::Cancelled|State::Superseded), "INTENT_TERMINAL")?;
                id
            } else {
                create_unit(tx,profile,actor,proposal,intent)?
            };
            let attachment = digest(&(unit_id.as_str(),&proposal.goals,&proposal.build,&proposal.reviews))?;
            let existing_attachment: Option<String>=tx.query_row("SELECT digest FROM attachments WHERE digest=?",[&attachment],|r|r.get(0)).optional()?;
            require(existing_attachment.is_some() || matches!(read_status(tx,&unit_id)?.state,State::Queued|State::Applied),"ATTACHMENT_DEFERRED")?;
            tx.execute("INSERT OR IGNORE INTO attachments VALUES (?,?,?)", (&attachment,&unit_id,json(proposal)?))?;
            for g in &proposal.goals {
                let old: Option<String> = tx.query_row("SELECT record FROM coverage WHERE unit=? AND goal=?", (&unit_id,&g.payload.goal_id), |r| r.get(0)).optional()?;
                if let Some(old) = old { require(old == json(g)?, "COVERAGE_IMMUTABLE")?; }
                else { tx.execute("INSERT INTO coverage VALUES (?,?,?,?)", (&unit_id,&g.payload.goal_id,&attachment,json(g)?))?; }
            }
            tx.execute("INSERT OR IGNORE INTO actors VALUES (?,?)", (&unit_id,&actor.id))?;
            let status = read_status(tx,&unit_id)?;
            let state=status.state;
            let result = Submission { unit_id: unit_id.clone(), attachment_digest: attachment,
                install_required: installation_pending(state),
                state, status_revision: status.revision };
            tx.execute("INSERT INTO requests VALUES (?,?,?,?,?)", (&actor.id,&proposal.request_id,request_digest,json(&result)?,now))?;
            Ok(result)
        })
    }
    /// Persist a fresh authenticated registry observation even when its revocation denies the release.
    pub fn observe_policy(
        &self,
        catalog: &Catalog,
        profile: &str,
        policy: &Signed<Policy>,
        now: u64,
    ) -> Result<()> {
        validate_policy(catalog, profile, policy, now)?;
        self.transaction(|tx| pin_policy(tx, profile, policy))
    }
    /// Call under the host mutex immediately before any mutating edge, using the latest signed policy.
    pub fn revalidate(
        &self,
        catalog: &Catalog,
        id: &str,
        policy: &Signed<Policy>,
        now: u64,
    ) -> Result<()> {
        let profile = self.daemon_status(id)?.unit.deployment_profile;
        self.observe_policy(catalog, &profile, policy, now)?;
        self.transaction(|tx| super::gates::validate_unit(tx, catalog, id, policy, now))
    }
}
pub(super) fn pin_policy(
    tx: &Transaction<'_>,
    profile: &str,
    policy: &Signed<Policy>,
) -> Result<()> {
    let current: Option<(u64, String)> = tx
        .query_row(
            "SELECT epoch,digest FROM policies ORDER BY epoch DESC LIMIT 1",
            [],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()?;
    let hash = digest(policy)?;
    if let Some((epoch, old)) = current {
        require(policy.payload.epoch >= epoch, "POLICY_REPLAY")?;
        require(
            policy.payload.epoch != epoch || old == hash,
            "POLICY_EQUIVOCATION",
        )?;
    }
    tx.execute(
        "INSERT OR IGNORE INTO policy_history VALUES (?,?)",
        (&hash, json(policy)?),
    )?;
    tx.execute("INSERT INTO policies VALUES (?,?,?,?) ON CONFLICT(profile) DO UPDATE SET epoch=excluded.epoch,digest=excluded.digest,record=excluded.record",
        (profile,policy.payload.epoch,hash,json(policy)?))?;
    Ok(())
}
fn resolve_intent(tx: &Transaction<'_>, r: &Proposal) -> Result<u64> {
    let d = &r.desired.payload;
    let old: Option<(u64,u64,String)> = tx.query_row("SELECT id,desired_revision,desired_digest FROM intents WHERE target=? ORDER BY desired_revision DESC LIMIT 1",
        [&d.target_runtime], |r| Ok((r.get(0)?,r.get(1)?,r.get(2)?))).optional()?;
    let hash = digest(&r.desired)?;
    if let Some((id, revision, old_hash)) = old {
        require(d.revision >= revision, "DESIRED_STATE_REPLAY")?;
        if d.revision == revision {
            require(old_hash == hash, "DESIRED_STATE_CONFLICT")?;
            return Ok(id);
        }
        let artifact: String =
            tx.query_row("SELECT artifact FROM intents WHERE id=?", [id], |r| {
                r.get(0)
            })?;
        require(artifact != d.artifact_sha256, "UNCHANGED_DESIRED_STATE")?;
    }
    let generation: u64 = tx
        .query_row(
            "SELECT generation FROM installed WHERE target=?",
            [&d.target_runtime],
            |r| r.get(0),
        )
        .optional()?
        .unwrap_or(0);
    require(
        generation == d.expected_target_generation,
        "PREIMAGE_MISMATCH",
    )?;
    tx.execute("INSERT INTO intents(target,desired_revision,desired_digest,artifact,profile_revision,expected_generation) VALUES (?,?,?,?,?,?)",
        (&d.target_runtime,d.revision,hash,&d.artifact_sha256,&d.profile_revision,generation))?;
    Ok(tx.last_insert_rowid() as u64)
}
pub(super) fn check_dependencies(tx: &Transaction<'_>, deps: &[Dependency]) -> Result<()> {
    let mut seen = std::collections::BTreeSet::new();
    for dep in deps {
        require(
            dep.semantics == DependencySemantics::LiveInstallation,
            "UNSUPPORTED_DEPENDENCY_SEMANTICS",
        )?;
        require(seen.insert(&dep.unit_id), "DEPENDENCY_CYCLE")?;
        let state = read_status(tx, &dep.unit_id).map_err(|_| Error::new("MISSING_DEPENDENCY"))?;
        require(
            !matches!(
                state.state,
                State::Cancelled | State::Superseded | State::Quarantined
            ),
            "DEPENDENCY_UNACCEPTED",
        )?;
        crate::trust::valid_digest(&dep.receipt_digest)?;
        if state.state == State::Applied && dep.semantics == DependencySemantics::LiveInstallation {
            require(
                super::dependencies::is_current(tx, dep)?,
                "DEPENDENCY_NOT_CURRENT",
            )?;
        }
    }
    Ok(())
}
fn create_unit(
    tx: &Transaction<'_>,
    p: &Profile,
    actor: &Actor,
    r: &Proposal,
    intent: u64,
) -> Result<String> {
    let count: u64 = tx.query_row("SELECT count(*) FROM units WHERE state NOT IN ('\"Applied\"','\"Cancelled\"','\"Superseded\"')", [], |row| row.get(0))?;
    let actor_count: u64 = tx.query_row("SELECT count(*) FROM actors a JOIN units u ON u.id=a.unit WHERE actor=? AND u.state NOT IN ('\"Applied\"','\"Cancelled\"','\"Superseded\"')", [&actor.id], |row| row.get(0))?;
    require(
        count < p.queue_quota as u64 && actor_count < p.actor_quota as u64,
        "QUEUE_QUOTA",
    )?;
    let mut u = DeploymentUnit {
        version: 1,
        deployment_unit_id: String::new(),
        deployment_profile: r.deployment_profile.clone(),
        profile_revision: p.revision.clone(),
        target_runtime: p.target_runtime.clone(),
        repo: p.repo.clone(),
        source_sha: r.build.payload.source_sha.clone(),
        artifact_sha256: r.build.payload.artifact_sha256.clone(),
        build_attestation_digest: digest(&r.build)?,
        manifest_digest: r.build.payload.manifest_digest.clone(),
        deployment_intent_id: intent,
        desired_state_revision: r.desired.payload.revision,
        expected_target_generation: r.desired.payload.expected_target_generation,
        covered_goal_ids: r.goals.iter().map(|g| g.payload.goal_id.clone()).collect(),
        goal_coverage: r.goals.iter().map(|g| g.payload.coverage.clone()).collect(),
        dependency_units: r.dependencies.clone(),
        required_reviews: r.reviews.iter().map(digest).collect::<Result<_>>()?,
        preflight_policy: p.preflight_policy.clone(),
        privileged_apply_profile: p.privileged_apply_profile.clone(),
        restart_profile: p.restart_profile.clone(),
        verification_profiles: p.verification_profiles.clone(),
        rollback_profile: p.rollback_profile.clone(),
        standing_authority_revision: p.standing_authority_revision.clone(),
        policy_epoch: r.policy.payload.epoch,
        receipts: Vec::new(),
    };
    u.covered_goal_ids.sort();
    u.goal_coverage.sort_by(|a, b| a.goal_id.cmp(&b.goal_id));
    u.required_reviews.sort();
    u.dependency_units.sort_by(|a, b| a.unit_id.cmp(&b.unit_id));
    u.deployment_unit_id = digest(&u)?;
    let mut sequence = bump(tx, "sequence")?;
    for old_id in &r.supersedes {
        let old = read_status(tx, old_id)?;
        require(
            old.state == State::Queued && old.unit.target_runtime == u.target_runtime,
            "IN_FLIGHT_REPLACEMENT",
        )?;
        let mut stmt = tx.prepare("SELECT record FROM coverage WHERE unit=?")?;
        let records = stmt
            .query_map([old_id], |row| row.get::<_, String>(0))?
            .collect::<std::result::Result<Vec<_>, _>>()?;
        for raw in records {
            let previous: Signed<ReadyRecord> = parse(raw)?;
            require(
                r.goals.iter().any(|next| {
                    next.issuer == previous.issuer
                        && next.payload.producer_id == previous.payload.producer_id
                        && next.payload.revision >= previous.payload.revision
                        && next.payload.coverage == previous.payload.coverage
                }),
                "SUPERSESSION_COVERAGE",
            )?;
        }
        require(
            old.unit
                .dependency_units
                .iter()
                .all(|dep| u.dependency_units.contains(dep)),
            "SUPERSESSION_COVERAGE",
        )?;
        sequence = sequence.min(old.sequence);
    }
    tx.execute(
        "INSERT INTO units VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
        rusqlite::params![
            u.deployment_unit_id,
            intent,
            p.target_runtime,
            r.deployment_profile,
            p.revision,
            u.artifact_sha256,
            json(&u)?,
            json(&State::Queued)?,
            0,
            sequence,
            json(&p.failure_policy)?,
            p.install_root_id,
            json(r)?
        ],
    )?;
    for dep in &u.dependency_units {
        tx.execute(
            "INSERT INTO dependencies VALUES (?,?,?)",
            (&u.deployment_unit_id, &dep.unit_id, json(dep)?),
        )?;
    }
    for old_id in &r.supersedes {
        // Replacing an ancestor of a prerequisite would close a cycle.
        let cycle: u64 = tx.query_row("WITH RECURSIVE reach(id) AS (SELECT prerequisite FROM dependencies WHERE unit=? UNION SELECT d.prerequisite FROM dependencies d JOIN reach r ON d.unit=r.id) SELECT count(*) FROM reach WHERE id=?", (&u.deployment_unit_id,old_id), |r|r.get(0))?;
        require(cycle == 0, "DEPENDENCY_CYCLE")?;
        // Preserve inbound immutable exact-receipt edges. They stay blocked until their
        // own reviewed dependent replacement names the new prerequisite receipt.
        tx.execute(
            "INSERT OR IGNORE INTO actors SELECT ?,actor FROM actors WHERE unit=?",
            (&u.deployment_unit_id, old_id),
        )?;
        tx.execute(
            "UPDATE pauses SET unit=? WHERE unit=?",
            (&u.deployment_unit_id, old_id),
        )?;
        super::lifecycle::change(
            tx,
            old_id,
            read_status(tx, old_id)?.revision,
            State::Superseded,
            &u.deployment_unit_id,
        )?;
    }
    Ok(u.deployment_unit_id)
}

fn recover_request(
    tx: &Transaction<'_>,
    actor: &Actor,
    proposal: &Proposal,
    hash: &str,
) -> Result<Option<Submission>> {
    let saved: Option<(String, String)> = tx
        .query_row(
            "SELECT digest,result FROM requests WHERE actor=? AND request=?",
            (&actor.id, &proposal.request_id),
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()?;
    let Some((old, raw)) = saved else {
        return Ok(None);
    };
    require(old == hash, "REQUEST_CONFLICT")?;
    let mut result: Submission = parse(raw)?;
    authorize(tx, actor, &result.unit_id)?;
    let status = read_status(tx, &result.unit_id)?;
    result.state = status.state;
    result.status_revision = status.revision;
    result.install_required = installation_pending(status.state);
    Ok(Some(result))
}

fn installation_pending(state: State) -> bool {
    matches!(
        state,
        State::Queued
            | State::Precheck
            | State::Applying
            | State::Restarting
            | State::Verifying
            | State::Finalizing
    )
}
