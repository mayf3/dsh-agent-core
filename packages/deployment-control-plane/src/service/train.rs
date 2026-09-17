use super::{
    intake::{Intake, VerifierBinding},
    server::now,
};
use crate::{
    error::require,
    fs::FixtureRoots,
    model::*,
    queue::Queue,
    transaction::Executor,
    trust::{digest, signing_bytes, verify_signed},
    Error, Result,
};
use ed25519_dalek::{Signer, SigningKey};
use serde::Serialize;
use std::{
    collections::BTreeMap,
    path::Path,
    time::{Duration, Instant},
};
pub(crate) struct Train {
    executors: BTreeMap<String, Executor>,
}
#[derive(Serialize)]
struct ObservationRequest<'a> {
    id: String,
    operation: &'static str,
    expected: &'a GoalReceipt,
    verification_profile: &'a str,
}
impl Train {
    pub fn open(intake: &Intake, q: &Queue, path: &Path, sandbox: bool) -> Result<Self> {
        let mut executors = BTreeMap::new();
        for (name, p) in &intake.config.catalog.profiles {
            if !p.enabled {
                continue;
            }
            let executor = if sandbox {
                let roots = FixtureRoots::open(path)?;
                if intake.config.catalog.profiles.len() > 1 {
                    Executor::fixture_target(&roots, &p.target_runtime)?
                } else {
                    Executor::fixture(&roots)?
                }
            } else {
                Executor::production(p)?
            };
            executors.insert(name.clone(), executor);
        }
        require(!executors.is_empty(), "PROFILE_NOT_ALLOWED")?;
        let guard = executors
            .values()
            .next()
            .ok_or(Error::new("PROFILE_NOT_ALLOWED"))?
            .lock()?;
        for executor in executors.values_mut() {
            executor.recover(&guard, q)?;
        }
        Ok(Self { executors })
    }
    pub fn tick(&mut self, intake: &Intake, q: &Queue) -> Result<()> {
        // Admission keeps working while a registered producer is disconnected.
        let _ = intake.poll(q);
        intake.deliver(q)?;
        self.recover_failed(intake, q)?;
        if let Some((id, generation)) = q.daemon_next_verification()? {
            let result = self.verify_late(intake, q, &id);
            q.daemon_finish_verification(&id, generation, result.as_ref().err().map(|e| e.code()))?;
            return result;
        }
        let Some(status) = q.next_ready(&intake.config.catalog)? else {
            return Ok(());
        };
        let id = &status.unit.deployment_unit_id;
        let p = &status.unit.deployment_profile;
        let executor = self
            .executors
            .get_mut(p)
            .ok_or(Error::new("PROFILE_NOT_ALLOWED"))?;
        let guard = executor.lock()?;
        let policy = intake.policy(p)?;
        // Refuse before install if an accepted typed verifier is not configured.
        for g in q.daemon_coverage(id)? {
            require(
                intake
                    .config
                    .verifiers
                    .contains_key(&g.payload.coverage.verification_profile),
                "VERIFIER_NOT_CONFIGURED",
            )?;
            if let VerifierBinding::NativeInstalledReadback { issuer } =
                &intake.config.verifiers[&g.payload.coverage.verification_profile]
            {
                native_signer(intake, issuer, p, &g.payload.coverage.verification_profile)?;
            }
        }
        let applied = executor.apply(
            &guard,
            q,
            &intake.config.catalog,
            id,
            &policy,
            now()?,
            &q.daemon_caller(id)?,
        )?;
        let receipt = applied.receipt;
        let result = verify_goals(
            intake,
            q,
            id,
            receipt.attempt,
            receipt.target_generation,
            &receipt.new_service_generation,
        );
        match result {
            Ok(()) => {
                executor.finalize(&guard, q, id)?;
            }
            Err(e) if e.code() == "UNKNOWN_CANARY" => {
                executor.quarantine(q, id, e.code())?;
                return Err(e);
            }
            Err(e) => {
                executor.rollback_for_failure(&guard, q, id, e.code())?;
                return Err(e);
            }
        }
        // Same guard is held until Goal observations and final eligibility commit are durable.
        drop(guard);
        intake.deliver(q)
    }
    fn recover_failed(&mut self, intake: &Intake, q: &Queue) -> Result<()> {
        for status in q.daemon_recovery_candidates()? {
            let id = &status.unit.deployment_unit_id;
            let Some(executor) = self.executors.get_mut(&status.unit.deployment_profile) else {
                continue;
            };
            let guard = executor.lock()?;
            // Missing/invalid remediation cannot skip the failed intent or clear STOP.
            let binding = match executor.recovery_binding(&guard, q, id) {
                Ok(b) => b,
                Err(_) => continue,
            };
            let request = digest(&binding)?;
            intake.publish("recovery-requests", &request, &binding)?;
            match intake.recovery(id, status.revision) {
                Ok(evidence) => {
                    let policy = intake.policy(&status.unit.deployment_profile)?;
                    executor.consume_recovery(
                        &guard,
                        q,
                        &intake.config.catalog,
                        &evidence,
                        &policy,
                        now()?,
                    )?;
                }
                Err(e) if e.code() == "ABSENT" => (),
                Err(e) => return Err(e),
            }
        }
        Ok(())
    }
    fn verify_late(&mut self, intake: &Intake, q: &Queue, id: &str) -> Result<()> {
        let s = q.daemon_status(id)?;
        let executor = self
            .executors
            .get_mut(&s.unit.deployment_profile)
            .ok_or(Error::new("PROFILE_NOT_ALLOWED"))?;
        let guard = executor.lock()?;
        let policy = intake.policy(&s.unit.deployment_profile)?;
        let current =
            executor.verify_installed(&guard, q, &intake.config.catalog, id, &policy, now()?)?;
        verify_goals(
            intake,
            q,
            id,
            current.attempt,
            current.target_generation,
            &current.service_generation,
        )
    }
}
fn verify_goals(
    intake: &Intake,
    q: &Queue,
    id: &str,
    attempt: u32,
    generation: u64,
    service: &str,
) -> Result<()> {
    let coverage = q.daemon_coverage(id)?;
    require(coverage.len() <= 256, "GOAL_VERIFICATION_LIMIT")?;
    let attachments = q.daemon_attachments(id)?;
    let status = q.daemon_status(id)?;
    let all_deadline = Instant::now() + Duration::from_secs(5);
    for goal in coverage {
        let g = &goal.payload;
        let previous = q.daemon_goal(id, &g.goal_id)?;
        if let Some(r) = &previous {
            require(
                r.payload.outcome != GoalOutcome::OutcomeUnknown,
                "UNKNOWN_CANARY",
            )?;
            if r.payload.outcome == GoalOutcome::Pass
                && r.payload.attempt == attempt
                && r.payload.service_generation == service
            {
                continue;
            }
        }
        let binding = q.daemon_goal_attachment(id, &g.goal_id)?;
        let attachment = attachments
            .iter()
            .find(|a| a.digest == binding && a.proposal.goals.contains(&goal))
            .ok_or(Error::new("GOAL_COVERAGE"))?;
        let expected = GoalReceipt {
            unit_id: id.into(),
            goal_id: g.goal_id.clone(),
            acceptance_revision: g.coverage.acceptance_revision.clone(),
            target_generation: generation,
            attempt,
            service_generation: service.into(),
            attachment_digest: attachment.digest.clone(),
            outcome: GoalOutcome::WaitingExternalAcceptance,
            evidence_digest: digest(&(id, &g.goal_id, "external-response-absent"))?,
            revision: previous.as_ref().map_or(1, |r| r.payload.revision + 1),
        };
        let binding = intake
            .config
            .verifiers
            .get(&g.coverage.verification_profile)
            .ok_or(Error::new("VERIFIER_NOT_CONFIGURED"))?;
        match binding {
            VerifierBinding::NativeInstalledReadback { issuer } => {
                let signer = native_signer(
                    intake,
                    issuer,
                    &status.unit.deployment_profile,
                    &g.coverage.verification_profile,
                )?;
                let mut payload = expected;
                payload.outcome = GoalOutcome::Pass;
                payload.evidence_digest = digest(&(
                    id,
                    attempt,
                    generation,
                    service,
                    "native-installed-byte-process-readback",
                ))?;
                let signature = hex::encode(signer.sign(&signing_bytes(&payload)?).to_bytes());
                q.record_goal(
                    &intake.config.catalog,
                    &Signed {
                        issuer: issuer.clone(),
                        payload,
                        signature,
                    },
                )?;
            }
            VerifierBinding::ExternalObservation { deadline_ms } => {
                // Publishing asks only for an existing observation. It never requests a canary,
                // sends a message, or conveys business-write authority to an external worker.
                let request_id = digest(&(
                    id,
                    &g.goal_id,
                    attempt,
                    generation,
                    service,
                    &attachment.digest,
                    expected.revision,
                ))?;
                // Each readback request pins the next receipt CAS; this is never a canary dispatch.
                intake.publish(
                    "requests",
                    &request_id,
                    &ObservationRequest {
                        id: request_id.clone(),
                        operation: "read-existing-acceptance",
                        expected: &expected,
                        verification_profile: &g.coverage.verification_profile,
                    },
                )?;
                let deadline = std::cmp::min(
                    Instant::now() + Duration::from_millis(*deadline_ms),
                    all_deadline,
                );
                let found = loop {
                    match intake.result(&request_id) {
                        Ok(receipt) => break Some(receipt),
                        Err(e) if e.code() == "ABSENT" && Instant::now() < deadline => {
                            std::thread::sleep(Duration::from_millis(10))
                        }
                        Err(e) if e.code() == "ABSENT" => break None,
                        Err(e) => return Err(e),
                    }
                };
                if let Some(receipt) = found {
                    verify_signed(
                        &receipt,
                        &intake.config.catalog,
                        &status.unit.deployment_profile,
                    )?;
                    let mut bound = receipt.payload.clone();
                    bound.outcome = expected.outcome;
                    bound.evidence_digest = expected.evidence_digest.clone();
                    require(bound == expected, "GOAL_READBACK_MISMATCH")?;
                    q.record_goal(&intake.config.catalog, &receipt)?;
                    require(
                        receipt.payload.outcome != GoalOutcome::OutcomeUnknown,
                        "UNKNOWN_CANARY",
                    )?;
                } else if previous.as_ref().is_none_or(|r| {
                    r.payload.outcome != GoalOutcome::WaitingExternalAcceptance
                        || r.payload.attempt != attempt
                        || r.payload.service_generation != service
                }) {
                    q.daemon_record_waiting(&intake.config.catalog, expected)?;
                }
            }
        }
    }
    Ok(())
}

fn native_signer(
    intake: &Intake,
    issuer: &str,
    profile: &str,
    verification: &str,
) -> Result<SigningKey> {
    use std::os::unix::fs::MetadataExt;
    require(
        intake.config.catalog.profiles[profile]
            .goal_verifiers
            .get(verification)
            .is_some_and(|i| i == issuer),
        "VERIFIER_SCOPE",
    )?;
    let trusted = intake
        .config
        .catalog
        .keys
        .get(issuer)
        .ok_or(Error::new("UNKNOWN_ISSUER"))?;
    require(
        trusted.role == Role::Verifier && trusted.scopes.iter().any(|s| s == profile),
        "VERIFIER_SCOPE",
    )?;
    let trust = intake.root.child("verifier-keys")?;
    let file = trust.open_file(&format!("{issuer}.json"), libc::O_RDONLY, 0)?;
    let image = crate::fs::file::snapshot(&file, trust.uid, 1024)?;
    require(file.metadata()?.mode() & 0o777 == 0o600, "PRIVATE_KEY_MODE")?;
    let secret: String = serde_json::from_slice(&image.bytes)?;
    let seed: [u8; 32] = hex::decode(secret)
        .map_err(|_| Error::new("VERIFIER_KEY"))?
        .try_into()
        .map_err(|_| Error::new("VERIFIER_KEY"))?;
    let signer = SigningKey::from_bytes(&seed);
    require(
        hex::encode(signer.verifying_key().as_bytes()) == trusted.public_key,
        "VERIFIER_KEY",
    )?;
    Ok(signer)
}
