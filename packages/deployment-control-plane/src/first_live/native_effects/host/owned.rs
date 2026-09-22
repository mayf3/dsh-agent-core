//! Only this exact native operator and its observed fixed sudo parent lineage.
use super::{context::Context, credentials::Identity, environment, image, reader, signature};
use crate::{error::require, Error, Result};
pub(super) struct Owned {
    identities: Vec<Identity>,
    executable: String,
    digest: String,
}
impl Owned {
    pub(super) fn capture(ctx: &Context<'_>) -> Result<Self> {
        Self::capture_exact(
            ctx,
            "/usr/local/libexec/agent-deployd/agent-deployd",
            &ctx.grant.controller_sha256,
        )
    }
    pub(super) fn capture_probe(ctx: &Context<'_>, executable: &str, digest: &str) -> Result<Self> {
        Self::capture_exact(ctx, executable, digest)
    }
    fn capture_exact(ctx: &Context<'_>, executable: &str, digest: &str) -> Result<Self> {
        ctx.check()?;
        let current = reader::identity(std::process::id())?;
        require(
            current.executable.as_deref() == Some(executable),
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
        // The one-auth session also runs its root journal sidecar (and the
        // bootstrap root script) as SIBLING sudo processes of the same
        // operator parent — alive for the whole transaction, so the census
        // must classify them as owned lineage instead of aborting on the
        // session's own infrastructure.  macOS sudo additionally re-parents
        // the monitored command through an INNER sudo child, so the capture
        // walks two sudo generations out from the operator parent.  Every
        // member binds exactly like the ancestor chain: live, root-capable
        // /usr/bin/sudo, kernel parentage — never arbitrary pids.
        let operator_parent = identities.last().unwrap().parent_pid;
        let snapshot = reader::snapshot()?;
        let mut frontiers: Vec<u32> = identities.iter().map(|i| i.pid).collect();
        frontiers.push(operator_parent);
        for _ in 0..2 {
            let mut added = Vec::new();
            for process in &snapshot {
                if !identities.iter().any(|i| i.pid == process.pid)
                    && frontiers.contains(&process.parent_pid)
                    && process.executable.as_deref() == Some("/usr/bin/sudo")
                    && process.credentials.root_capable()
                {
                    added.push(process.clone());
                }
            }
            if added.is_empty() {
                break;
            }
            frontiers.clear();
            for process in &added {
                frontiers.push(process.pid);
                identities.push(process.clone());
            }
        }
        let this = Self {
            identities,
            executable: executable.into(),
            digest: digest.into(),
        };
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
                let actual = image::protected(&self.executable)?;
                require(actual.digest == self.digest, "HOST_OPERATOR_CODE")?;
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
