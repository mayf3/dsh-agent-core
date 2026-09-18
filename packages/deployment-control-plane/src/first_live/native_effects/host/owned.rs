//! Only this exact native operator and its observed fixed sudo parent lineage.
use super::{context::Context, credentials::Identity, environment, image, reader, signature};
use crate::{error::require, Error, Result};
pub(super) struct Owned {
    identities: Vec<Identity>,
}
impl Owned {
    pub(super) fn capture(ctx: &Context<'_>) -> Result<Self> {
        ctx.check()?;
        let current = reader::identity(std::process::id())?;
        require(
            current.executable.as_deref() == Some("/usr/local/libexec/agent-deployd/agent-deployd"),
            "HOST_OPERATOR_IDENTITY",
        )?;
        let mut identities = vec![current];
        // Parentage comes from the kernel; it is never a PID set from the packet.
        for _ in 0..3 {
            let parent = reader::identity(identities.last().unwrap().parent_pid)?;
            if !parent.credentials.root_capable() {
                break;
            }
            require(
                parent.executable.as_deref() == Some("/usr/bin/sudo"),
                "HOST_OPERATOR_PARENT",
            )?;
            identities.push(parent);
        }
        let this = Self { identities };
        this.verify(ctx)?;
        Ok(this)
    }
    pub(super) fn contains(&self, identity: &Identity) -> bool {
        self.identities.contains(identity)
    }
    pub(super) fn verify(&self, ctx: &Context<'_>) -> Result<()> {
        ctx.check()?;
        for (index, identity) in self.identities.iter().enumerate() {
            require(
                reader::identity(identity.pid)? == *identity,
                "HOST_OPERATOR_DRIFT",
            )?;
            if index == 0 {
                let before_environment = environment::running(identity.pid)?;
                let actual = image::protected("/usr/local/libexec/agent-deployd/agent-deployd")?;
                require(
                    actual.digest == ctx.grant.controller_sha256,
                    "HOST_OPERATOR_CODE",
                )?;
                require(
                    environment::running(identity.pid)? == before_environment,
                    "HOST_ENVIRONMENT_DRIFT",
                )?;
            } else {
                let pin = ctx
                    .packet
                    .lifecycle
                    .tool_sha256
                    .get("/usr/bin/sudo")
                    .ok_or_else(|| Error::new("HOST_OPERATOR_CODE"))?;
                crate::first_live::process::pinned(
                    crate::first_live::process::Tool::SudoAudit,
                    pin,
                )?;
                signature::running_apple(identity.pid, "/usr/bin/sudo", None)?;
            }
        }
        ctx.check()
    }
}
