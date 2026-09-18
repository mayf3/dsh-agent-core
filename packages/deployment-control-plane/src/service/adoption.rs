//! Fixed one-shot first-target commands. No daemon startup or business mutation.
use super::{intake::read, train, Intake};
use crate::{
    error::require,
    fs::{
        file::{sha, snapshot},
        secure::{validate, Dir},
    },
    model::*,
    queue::Queue,
    transaction::Executor,
    trust::{digest, valid_digest},
    verification::{native, watchdog::WatchdogVerdict},
    Error, Result,
};
use std::{os::unix::fs::MetadataExt, path::Path};
const ROOT: &str = "/private/var/db/agent-deployd";
pub(crate) fn verify_materialization(root: &Dir, g: &Signed<AdoptionGrant>) -> Result<()> {
    let file = root.open_file("first-live-materialization.json", libc::O_RDONLY, 0)?;
    require(
        file.metadata()?.mode() & 0o777 == 0o400,
        "ADOPTION_MATERIALIZATION",
    )?;
    let receipt: FirstLiveMaterializationReceipt =
        serde_json::from_slice(&snapshot(&file, 0, 65536)?.bytes)?;
    let a = &g.payload;
    require(
        receipt
            == FirstLiveMaterializationReceipt {
                version: 1,
                package_digest: a.package_digest.clone(),
                controller_sha256: a.controller_sha256.clone(),
                configuration_digest: a.configuration_digest.clone(),
                enrollment_digest: a.enrollment_digest.clone(),
                issuer_bindings_digest: a.issuer_bindings_digest.clone(),
                adoption_grant_digest: digest(g)?,
                owner_acceptance_digest: a.owner_acceptance_digest.clone(),
                lifecycle_evidence_digest: a.lifecycle_evidence_digest.clone(),
            },
        "ADOPTION_MATERIALIZATION",
    )?;
    let executable = std::env::current_exe()?;
    let parent = Dir::open(
        executable
            .parent()
            .ok_or(Error::new("EXECUTABLE_BINDING"))?,
        0,
    )?;
    let file = parent.open_file(
        executable
            .file_name()
            .and_then(|n| n.to_str())
            .ok_or(Error::new("EXECUTABLE_BINDING"))?,
        libc::O_RDONLY,
        0,
    )?;
    require(
        sha(&snapshot(&file, 0, 128 * 1024 * 1024)?.bytes) == a.controller_sha256,
        "EXECUTABLE_BINDING",
    )
}
fn grant<T: serde::de::DeserializeOwned + serde::Serialize>(root: &Dir, hash: &str) -> Result<T> {
    valid_digest(hash)?;
    let area = root.child("adoption-authorizations")?;
    let value: T = read(&area, &format!("{hash}.json"))?;
    require(digest(&value)? == hash, "ADOPTION_BINDING")?;
    Ok(value)
}
fn now() -> Result<u64> {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|v| v.as_secs())
        .map_err(|_| Error::new("CLOCK"))
}
fn now_ms() -> Result<u64> {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|_| Error::new("CLOCK"))?
        .as_millis()
        .try_into()
        .map_err(|_| Error::new("CLOCK"))
}
pub fn run(args: &[String]) -> Result<serde_json::Value> {
    require(args.len() == 2 || args.len() == 3, "ARGUMENTS")?;
    let command = args[0].as_str();
    require(
        matches!(
            command,
            "--prepare-adoption"
                | "--adopt-existing"
                | "--begin-watchdog-observation"
                | "--finish-watchdog-observation"
                | "--verify-adopted-baseline"
                | "--complete-adoption-activation"
        ),
        "ARGUMENTS",
    )?;
    require(
        args.len()
            == if matches!(
                command,
                "--adopt-existing" | "--complete-adoption-activation"
            ) {
                3
            } else {
                2
            },
        "ARGUMENTS",
    )?;
    require(unsafe { libc::geteuid() } == 0, "ADOPTION_REQUIRES_ROOT")?;
    let intake = Intake::open(Path::new(ROOT), false)?;
    let g: Signed<AdoptionGrant> = grant(&intake.root, &args[1])?;
    let c = &intake.config.catalog;
    let profile = c
        .profiles
        .get(&g.payload.profile_id)
        .ok_or(Error::new("PROFILE_NOT_ALLOWED"))?;
    let mut executor = Executor::production(profile)?;
    let guard = executor.lock()?;
    let proof = executor.authorize_adoption(&guard, c, &g, now()?)?;
    let db = intake.root.open_file("queue.db", libc::O_RDONLY, 0)?;
    validate(&db, 0, false)?;
    let queue = Queue::open(Path::new(ROOT).join("queue.db"))?;
    if command == "--prepare-adoption" {
        queue.reserve_adoption(&proof, &profile.target_runtime)?;
        let proposal = crate::issuer::coordinator::prepare_adoption(&proof)?;
        return Ok(
            serde_json::json!({"proposal_digest":proposal,"operation_id":g.payload.operation_id}),
        );
    }
    if command == "--adopt-existing" {
        let p = intake.proposal(&args[2])?;
        intake.poll(&queue)?;
        let actor = intake.actor(502, 20)?;
        let receipt = executor.adopt_existing(&guard, &queue, c, &actor, &p, &g, now()?)?;
        return Ok(serde_json::to_value(receipt)?);
    }
    let id = queue
        .adoption_unit(&g)?
        .ok_or(Error::new("ADOPTION_REQUIRED"))?;
    let policy = intake.policy(&g.payload.profile_id)?;
    let current = executor.verify_installed(&guard, &queue, c, &id, &policy, now()?)?;
    match command {
        "--begin-watchdog-observation" => native::begin(
            &intake.root,
            c,
            &queue,
            &mut executor,
            &guard,
            &id,
            &g,
            now_ms()?,
        )?,
        "--finish-watchdog-observation" => native::finish(
            &intake.root,
            c,
            &queue,
            &mut executor,
            &guard,
            &id,
            &g,
            now_ms()?,
        )?,
        "--verify-adopted-baseline" | "--complete-adoption-activation" => {
            train::verify_goals(
                &intake,
                &queue,
                &id,
                current.attempt,
                current.target_generation,
                &current.service_generation,
                &mut executor,
                &guard,
            )?;
            if command == "--complete-adoption-activation" {
                let inputs = activation_inputs(&intake, &queue, &mut executor, &guard, &g)?;
                let activation: Signed<StandingActivationGrant> = grant(&intake.root, &args[2])?;
                require(
                    activation.payload.baseline_receipt_digest == inputs.baseline_receipt_digest
                        && inputs.current == current,
                    "ACTIVATION_BINDING",
                )?;
                let goal = queue
                    .daemon_goal(&id, &g.payload.release.goal_id)?
                    .ok_or(Error::new("ACTIVATION_CANARY"))?;
                require(
                    digest(&goal)? == inputs.goal_receipt_digest,
                    "ACTIVATION_CANARY",
                )?;
                valid_digest(&inputs.canary_evidence_digest)?;
                // Materializer binds this separate Owner decision before its custody signature.
                valid_digest(&activation.payload.owner_acceptance_digest)?;
                let receipt = executor.complete_adoption_activation(
                    &guard,
                    &queue,
                    c,
                    &g,
                    &activation,
                    inputs.canary,
                    &goal,
                    now()?,
                )?;
                return Ok(
                    serde_json::json!({"activation_receipt":receipt,"service_started":false,"standing_gate_complete":true}),
                );
            }
            intake.deliver(&queue)?;
        }
        _ => return Err(Error::new("ARGUMENTS")),
    }
    Ok(
        serde_json::json!({"operation":command,"unit_id":id,"mutating_attempts":0,"service_started":false}),
    )
}
/// Coordinates for the packet-bound conditional constructor. Never a PASS input.
pub(crate) struct StandingActivationInputs {
    pub(crate) canary: native::VerifiedCanary,
    pub baseline_receipt_digest: String,
    pub goal_receipt_digest: String,
    pub canary_evidence_digest: String,
    pub current: CurrentInstallation,
}
pub(crate) fn activation_inputs(
    intake: &Intake,
    queue: &Queue,
    executor: &mut Executor,
    guard: &crate::fs::MutationGuard,
    g: &Signed<AdoptionGrant>,
) -> Result<StandingActivationInputs> {
    let c = &intake.config.catalog;
    let id = queue
        .adoption_unit(g)?
        .ok_or(Error::new("ADOPTION_REQUIRED"))?;
    let policy = intake.policy(&g.payload.profile_id)?;
    let current = executor.verify_installed(guard, queue, c, &id, &policy, now()?)?;
    let request = digest(&(&id, digest(g)?, "conditional-activation-construction"))?;
    let (verdict, canary) = native::observe(
        &intake.root,
        c,
        queue,
        executor,
        guard,
        &id,
        g,
        &request,
        now_ms()?,
    )?;
    require(
        matches!(verdict, WatchdogVerdict::Pass { .. }),
        "ACTIVATION_CANARY",
    )?;
    let canary = canary.ok_or(Error::new("ACTIVATION_CANARY"))?;
    let goal = queue
        .daemon_goal(&id, &g.payload.release.goal_id)?
        .ok_or(Error::new("ACTIVATION_CANARY"))?;
    crate::trust::verify_signed(&goal, c, &g.payload.profile_id)?;
    require(
        goal.issuer == "local-verifier"
            && goal.payload.outcome == GoalOutcome::Pass
            && goal.payload.unit_id == current.unit_id
            && goal.payload.goal_id == g.payload.release.goal_id
            && goal.payload.acceptance_revision == g.payload.release.acceptance_revision
            && goal.payload.attempt == current.attempt
            && goal.payload.target_generation == current.target_generation
            && goal.payload.service_generation == current.service_generation
            && canary.current == current,
        "ACTIVATION_CANARY",
    )?;
    Ok(StandingActivationInputs {
        baseline_receipt_digest: current.transaction_receipt_digest.clone(),
        goal_receipt_digest: digest(&goal)?,
        canary_evidence_digest: canary.evidence_digest.clone(),
        canary,
        current,
    })
}
