use crate::{error::require, Result};
use serde::{Deserialize, Serialize};
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct Credentials {
    pub effective_uid: u32,
    pub real_uid: u32,
    pub saved_uid: u32,
    pub effective_gid: u32,
    pub real_gid: u32,
    pub saved_gid: u32,
}
impl Credentials {
    pub(super) fn root_capable(&self) -> bool {
        self.effective_uid == 0 || self.real_uid == 0 || self.saved_uid == 0
    }
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct Identity {
    pub pid: u32,
    pub parent_pid: u32,
    pub birth_seconds: u64,
    pub birth_micros: u64,
    pub credentials: Credentials,
    pub tty_device: u32,
    pub process_group: u32,
    pub session_id: Option<u32>,
    pub executable: Option<String>,
}
pub(super) fn stable(before: &[Identity], after: &[Identity]) -> Result<Vec<Identity>> {
    require(
        !before.is_empty() && before.len() <= 16384,
        "HOST_CENSUS_INCOMPLETE",
    )?;
    let mut seen = std::collections::BTreeSet::new();
    for row in before {
        require(
            seen.insert(row.pid)
                && (row.pid == 0 || row.birth_seconds > 0)
                && row.birth_micros < 1_000_000,
            "HOST_CENSUS_INCOMPLETE",
        )?;
        if row.pid == 0 {
            require(
                row.parent_pid == 0
                    && row.process_group == 0
                    && row.executable.is_none()
                    && row.credentials
                        == Credentials {
                            effective_uid: 0,
                            real_uid: 0,
                            saved_uid: 0,
                            effective_gid: 0,
                            real_gid: 0,
                            saved_gid: 0,
                        },
                "HOST_KERNEL_IDENTITY",
            )?;
            continue;
        }
        require(
            !row.credentials.root_capable()
                || row.executable.as_ref().is_some_and(|p| {
                    p.starts_with('/') && p.len() < 4096 && !p.as_bytes().contains(&0)
                }),
            "HOST_CENSUS_INCOMPLETE",
        )?;
    }
    require(before == after, "HOST_CENSUS_DRIFT")?;
    Ok(before
        .iter()
        .filter(|p| p.credentials.root_capable())
        .cloned()
        .collect())
}
#[cfg(test)]
#[path = "../../../../test/first_live/host/credentials.rs"]
mod tests;
