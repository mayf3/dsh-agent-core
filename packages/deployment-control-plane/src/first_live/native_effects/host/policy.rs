use crate::{Error, Result};
use serde::Deserialize;
#[derive(Clone, Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct Authority {
    pub path: String,
    pub sha256: String,
    pub label: String,
    pub program: String,
}
#[derive(Clone, Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct Role {
    pub path: String,
    pub resolved_path: String,
    pub class: String,
    pub authorities: Vec<Authority>,
    pub identifier: Option<String>,
    pub executable_sha256: Option<String>,
    pub bundle_path: Option<String>,
    pub bundle_sha256: Option<String>,
    pub service_type: Option<String>,
    pub fixed_launch_target: Option<String>,
    pub tty: Option<String>,
}
// Mechanical projection of reviewed policy v3 fd562779ce789c3b9eb1891f53ea7199ac6d459bf835fdab32a7133fd57caf65.
// Historical PID values and observed PASS claims are intentionally not inputs.
pub(super) fn roles(path: &str) -> Result<Vec<Role>> {
    let mut found = Vec::new();
    for line in include_str!("roles.jsonl").lines() {
        let role: Role = serde_json::from_str(line)?;
        if role.resolved_path == path {
            found.push(role);
        }
    }
    if found.is_empty() {
        return Err(Error::new("HOST_ROLE_UNKNOWN"));
    }
    Ok(found)
}
#[cfg(test)]
#[path = "../../../../test/first_live/host/policy.rs"]
mod tests;
