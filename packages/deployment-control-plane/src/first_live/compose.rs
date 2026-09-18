//! One in-process guard across initialization, custody, genuine issuance and adoption.
use super::{
    files, gate, initial_queue,
    journal::{self, Step},
    materialize,
    packet::BoundPacket,
};
use crate::{
    fs::{secure::Dir, MutationGuard},
    service::Intake,
    transaction::Executor,
    trust::digest,
    Result,
};
use std::path::Path;
pub(super) fn now() -> Result<u64> {
    Ok(std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|_| crate::Error::new("CLOCK"))?
        .as_secs())
}
pub(super) fn run(
    root: &Dir,
    area: &Dir,
    p: &BoundPacket<'_>,
    g: &gate::Grant,
    guard: &MutationGuard,
) -> Result<String> {
    guard.binds(root)?;
    let check = || gate::validate(g, g, now()?);
    check()?;
    let history = area.mkdir("public-preimages")?;
    crate::error::require(
        files::read::<serde_json::Value>(root, "first-live-pending.json")?
            == serde_json::json!({"operation_id":p.operation_id,"package_digest":g.packet_sha256}),
        "FIRST_LIVE_PENDING_FENCE",
    )?;
    journal::execute(area, Step::Queue, &g.packet_sha256, || {
        check()?;
        let q = initial_queue::initialize(root, Path::new(crate::issuer::custody::ROOT))?;
        q.verify_first_live_empty()?;
        Ok(())
    })?;
    // It is safe to open this just-created DB; no absent/recovery fallback is used.
    let queue =
        crate::queue::Queue::open(Path::new(crate::issuer::custody::ROOT).join("queue.db"))?;
    materialize::publish_configuration(root, &history, p)?;
    let mut executor = Executor::production(&p.configuration.catalog.profiles["dsh-app"])?;
    let grant = journal::execute(area, Step::Materialize, &g.packet_sha256, || {
        check()?;
        materialize::publish(root, &history, p, &mut executor, guard, g, now()?)
    })?;
    let intake = Intake::open(Path::new(crate::issuer::custody::ROOT), false)?;
    let proof = executor.authorize_adoption(guard, &intake.config.catalog, &grant, now()?)?;
    queue.reserve_adoption(
        &proof,
        &p.configuration.catalog.profiles["dsh-app"].target_runtime,
    )?;
    let proposal_hash = journal::execute(area, Step::BuildReview, &g.packet_sha256, || {
        check()?;
        crate::issuer::coordinator::prepare_adoption(&proof)
    })?;
    let proposal = intake.proposal(&proposal_hash)?;
    intake.poll(&queue)?;
    let actor = intake.actor(502, 20)?;
    journal::execute(area, Step::Adopt, &g.packet_sha256, || {
        check()?;
        executor.adopt_existing(
            guard,
            &queue,
            &intake.config.catalog,
            &actor,
            &proposal,
            &grant,
            now()?,
        )
    })?;
    let unit = queue
        .adoption_unit(&grant)?
        .ok_or(crate::Error::new("ADOPTION_REQUIRED"))?;
    super::canary::run(&intake, &queue, &mut executor, guard, &unit, &grant, p, g)?;
    check()?;
    let current = executor.verify_installed(
        guard,
        &queue,
        &intake.config.catalog,
        &unit,
        &intake.policy("dsh-app")?,
        now()?,
    )?;
    crate::service::verify_goals(
        &intake,
        &queue,
        &unit,
        current.attempt,
        current.target_generation,
        &current.service_generation,
        &mut executor,
        guard,
    )?;
    let activation = journal::execute(area, Step::Standing, &digest(&grant)?, || {
        check()?;
        materialize::standing(
            &intake,
            &queue,
            &mut executor,
            guard,
            &grant,
            now()?,
            g.expires_at,
        )
    })?;
    intake.deliver(&queue)?;
    // This receipt is a standing gate only; launchd/socket startup is a later explicit effect.
    Ok(activation)
}

pub(super) fn now_ms() -> Result<u64> {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|_| crate::Error::new("CLOCK"))?
        .as_millis()
        .try_into()
        .map_err(|_| crate::Error::new("CLOCK"))
}
