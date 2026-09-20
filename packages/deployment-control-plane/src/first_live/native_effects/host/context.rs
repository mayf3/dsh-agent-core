use super::launch::{self, Metadata};
use crate::first_live::{
    compose,
    gate::{self, Grant},
    packet::Packet,
    process::{self, Tool},
};
use crate::{
    error::require,
    fs::{secure::Dir, MutationGuard},
    Result,
};
pub(in crate::first_live::native_effects) struct Context<'a> {
    pub root: &'a Dir,
    pub area: &'a Dir,
    pub packet_dir: &'a Dir,
    pub packet: &'a Packet,
    pub grant: &'a Grant,
    pub guard: &'a MutationGuard,
}
#[derive(serde::Serialize)]
pub(super) struct LaunchObservation {
    pub metadata: Metadata,
    pub raw_sha256: String,
}
impl Context<'_> {
    pub(super) fn check(&self) -> Result<()> {
        self.guard.binds(self.root)?;
        gate::validate(self.grant, self.grant, compose::now()?)
    }
    /// Only fixed targets selected by role data/Tailscale constants or a current
    /// kernel PID plus a fixed reviewed XPC bundle identifier reach this method.
    /// Raw launch output may contain environment fields and is never persisted.
    pub(super) fn query(&self, target: &str) -> Result<LaunchObservation> {
        self.query_optional(target)?
            .ok_or_else(|| crate::Error::new("HOST_LAUNCH_UNPROVEN"))
    }
    pub(super) fn query_optional(&self, target: &str) -> Result<Option<LaunchObservation>> {
        self.check()?;
        let out = process::run(
            Tool::Launchctl,
            &self.packet.native_enrollment.launchctl_sha256,
            &["print".into(), target.into()],
            None,
            5,
        )?;
        self.check()?;
        from_output(out, target)
    }
    /// A fixed multiple-instance parent is authoritative only when its current
    /// launchd record is complete, inactive itself, and names one exact child.
    /// Only the parent and child digests are retained; raw launch output may
    /// contain environment values and is never persisted.
    pub(super) fn query_single_instance(
        &self,
        parent: &str,
        prefix: &str,
    ) -> Result<LaunchObservation> {
        self.check()?;
        let out = process::run(
            Tool::Launchctl,
            &self.packet.native_enrollment.launchctl_sha256,
            &["print".into(), parent.into()],
            None,
            5,
        )?;
        self.check()?;
        require(
            out.code == Some(0)
                && out.stderr.is_empty()
                && launch::parse_optional(&out.stdout, parent)?.is_none(),
            "HOST_LAUNCH_UNPROVEN",
        )?;
        let parent_digest = crate::fs::file::sha(out.stdout.as_bytes());
        let label = launch::parse_single_instance(&out.stdout, parent, prefix)?;
        let mut instance = self.query(&format!("system/{label}"))?;
        instance.raw_sha256 = crate::trust::digest(&(parent_digest, &instance.raw_sha256))?;
        Ok(instance)
    }
}
fn from_output(out: process::Output, target: &str) -> Result<Option<LaunchObservation>> {
    let label = target
        .rsplit('/')
        .next()
        .ok_or_else(|| crate::Error::new("HOST_LAUNCH_UNPROVEN"))?;
    let missing = format!("Could not find service \"{label}\"");
    if out.code == Some(113)
        && out.stdout.is_empty()
        && out.stderr.contains(&missing)
        && !out.stderr.contains("Permission")
        && !out.stderr.contains("Operation not permitted")
    {
        return Ok(None);
    }

    require(
        out.code == Some(0) && out.stderr.is_empty(),
        "HOST_LAUNCH_UNPROVEN",
    )?;
    let Some(metadata) = launch::parse_optional(&out.stdout, target)? else {
        return Ok(None);
    };
    Ok(Some(LaunchObservation {
        metadata,
        raw_sha256: crate::fs::file::sha(out.stdout.as_bytes()),
    }))
}

#[cfg(test)]
#[path = "../../../../test/first_live/host/context.rs"]
mod tests;
