//! Fixed one-operation artifact. It never calls or retries the old genesis login.
use crate::{error::require, fs::secure::Dir, Error, Result};
use serde::{Deserialize, Serialize};
mod binding;
mod native;
mod process;
mod state;
use super::genesis_install::append;

const HELPER: &str = "/usr/local/libexec/agent-deployd/agent-deploy-login-reconcile";
const ATTEMPT: &str = "/private/var/db/agent-deploy-bootstrap/genesis-65559dd-20260918-01";
const JOURNAL: &str = "/private/var/db/agent-deploy-bootstrap";
const GRANT: &str = "login-reconciliation-grant.json";
const INTENT: &str = "login-reconciliation-intent.json";
const RESULT: &str = "login-reconciliation-result.json";
const FAILURE: &str = "login-reconciliation-failure.json";
const SCOPE: &str = "EXACT_REVIEWER_LOGIN_RECONCILIATION_ONLY";
const ORIGINAL_INTENT: &str = "3ca4b44d4d3e418ea78df8ad6c0a04b7a650e0006c807ffd9f96441b0d10abc6";

#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Grant {
    version: u32,
    owner: String,
    scope: String,
    manifest_digest: String,
    helper_digest: String,
    issued_at: u64,
    expires_at: u64,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Intent {
    manifest_digest: String,
    original_intent_digest: String,
    grant_digest: String,
    parent_pid: u32,
    parent_start: String,
}
#[derive(Clone, Copy)]
enum Outcome {
    Completed,
    Failed,
    TimedOut,
}
trait Effects {
    fn preflight(&mut self) -> Result<Intent>;
    fn login(&mut self) -> Result<Outcome>;
    fn postflight(&mut self) -> Result<()>;
}
fn execute(dir: &Dir, effects: &mut impl Effects) -> Result<()> {
    require(
        !dir.names_bounded(32)?
            .iter()
            .any(|n| [INTENT, RESULT, FAILURE].contains(&n.as_str())),
        "LOGIN_RECONCILIATION_ALREADY_CONSUMED",
    )?;
    let intent = effects.preflight()?;
    append(dir, INTENT, &intent)?;
    #[cfg(test)]
    crate::transaction::fault::point("login-after-intent");
    // A created but incomplete intent also consumes the allowance. No fallback
    // record, changed grant, failure or crash may erase or replenish that budget.
    let completion = (|| {
        match effects.login()? {
            Outcome::Completed => (),
            Outcome::Failed => return Err(Error::new("LOGIN_COMMAND_FAILED")),
            Outcome::TimedOut => return Err(Error::new("LOGIN_COMMAND_TIMEOUT")),
        }
        effects.postflight()?;
        append(
            dir,
            RESULT,
            &serde_json::json!({"version":1,"manifest_digest":intent.manifest_digest,"grant_digest":intent.grant_digest,"original_intent_digest":intent.original_intent_digest,"state":"SEPARATE_LOGIN_COMMAND_COMPLETED_SAFE_LOCAL_AUTH_METADATA","original_provider_outcome":"UNKNOWN_RETAINED","independent_review_pass":false,"activation_allowed":false}),
        )
    })();
    if completion.is_err() {
        // No external command error text, device URL or credential enters records.
        let _ = append(
            dir,
            FAILURE,
            &serde_json::json!({"version":1,"manifest_digest":intent.manifest_digest,"state":"OUTCOME_UNKNOWN_RECONCILIATION_CONSUMED","original_provider_outcome":"UNKNOWN_RETAINED","activation_allowed":false}),
        );
        return Err(Error::new("LOGIN_RECONCILIATION_OUTCOME_UNKNOWN"));
    }
    Ok(())
}
fn validate_grant(g: &Grant, manifest: &str, helper: &str, now: u64) -> Result<()> {
    crate::trust::valid_digest(&g.helper_digest)?;
    crate::trust::valid_digest(&g.manifest_digest)?;
    require(
        g.version == 1
            && g.owner == "mayf3"
            && g.scope == SCOPE
            && g.manifest_digest == manifest
            && g.helper_digest == helper,
        "LOGIN_RECONCILIATION_GRANT_BINDING",
    )?;
    require(
        g.issued_at <= now
            && now < g.expires_at
            && g.issued_at < g.expires_at
            && g.expires_at - g.issued_at <= 3600,
        "LOGIN_RECONCILIATION_GRANT_EXPIRED",
    )
}
/// Exactly `run` or the private fixed `child` action; neither accepts a path/plan.
pub fn login_reconciliation(action: &str) -> Result<()> {
    require(matches!(action, "run" | "child"), "USAGE")?;
    native::entry(action)
}
#[cfg(test)]
#[path = "../../test/login_reconciliation/main.rs"]
mod tests;
