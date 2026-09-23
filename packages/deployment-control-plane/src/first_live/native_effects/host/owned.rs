//! Only this exact native operator, its sudo transport chain and its exact
//! journal sidecar.  Membership is bound by kernel parentage; verification
//! is decided by each member's ROLE, never by array position.
use super::{context::Context, credentials::Identity, environment, image, reader, signature};
use crate::{
    error::require,
    fs::file::{sha, snapshot},
    fs::secure::Dir,
    trust::valid_id,
    Error, Result,
};
use std::{os::unix::fs::MetadataExt, path::Path};
const SIDECAR_NAME: &str = "root_journal_sidecar.py";
const JOURNAL_ROOT: &str = "/private/var/db/agent-deploy-bootstrap";
#[derive(Clone, Debug, PartialEq, Eq)]
pub(super) enum MemberRole {
    Controller,
    SudoTransport,
    ExactJournalSidecar,
}
#[derive(Clone, Debug)]
pub(super) struct Member {
    pub(super) role: MemberRole,
    pub(super) identity: Identity,
}
pub(super) struct Owned {
    members: Vec<Member>,
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
        let mut members = vec![Member {
            role: MemberRole::Controller,
            identity: current,
        }];
        // Ancestor sudo transport: parentage comes from the kernel; it is
        // never a PID set from the packet.
        for _ in 0..3 {
            let parent = reader::identity(members.last().unwrap().identity.parent_pid)?;
            if !parent.credentials.root_capable() {
                break;
            }
            require(
                parent.executable.as_deref() == Some("/usr/bin/sudo"),
                "HOST_OPERATOR_PARENT",
            )?;
            members.push(Member {
                role: MemberRole::SudoTransport,
                identity: parent,
            });
        }
        // The one-auth session also runs its root journal sidecar as a
        // SIBLING worker of the same operator parent — alive for the whole
        // transaction.  macOS sudo re-parents through an inner sudo child,
        // and /usr/bin/python3 execs the CommandLineTools interpreter, so
        // the session's root descendants are a mixed sudo/python tree.  A
        // descendant joins the lineage only as a SudoTransport (sudo image)
        // or an ExactJournalSidecar (kernel parentage + operation/manifest/
        // script-digest coherence, sidecar_binding below); ANY other root
        // descendant — including an unapproved same-parent script — stays
        // unowned and must fail the census through the reviewed roles.
        let operator_parent = members.last().unwrap().identity.parent_pid;
        let snapshot = reader::snapshot()?;
        let mut frontiers: Vec<u32> = members.iter().map(|m| m.identity.pid).collect();
        frontiers.push(operator_parent);
        for _ in 0..3 {
            let mut added = Vec::new();
            for process in &snapshot {
                if members.iter().any(|m| m.identity.pid == process.pid)
                    || !frontiers.contains(&process.parent_pid)
                    || !process.credentials.root_capable()
                {
                    continue;
                }
                let role = if process.executable.as_deref() == Some("/usr/bin/sudo") {
                    Some(MemberRole::SudoTransport)
                } else if process.executable.as_deref().is_some_and(|e| e.ends_with(SIDECAR_NAME)) {
                    // TEMP DIAGNOSTIC: name exactly why a sidecar-shaped
                    // descendant fails the binding.
                    match sidecar_binding(ctx, process) {
                        Ok(()) => Some(MemberRole::ExactJournalSidecar),
                        Err(e) => {
                            eprintln!("SIDECAR_BIND_DEBUG {}", e);
                            None
                        }
                    }
                } else {
                    // Not our approved worker: leave unowned.
                    None
                };
                if let Some(role) = role {
                    added.push(Member {
                        role,
                        identity: process.clone(),
                    });
                }
            }
            if added.is_empty() {
                break;
            }
            frontiers.clear();
            for member in &added {
                frontiers.push(member.identity.pid);
                members.push(member.clone());
            }
        }
        let this = Self {
            members,
            executable: executable.into(),
            digest: digest.into(),
        };
        this.verify(ctx)?;
        Ok(this)
    }
    pub(super) fn contains(&self, identity: &Identity) -> bool {
        self.members.iter().any(|m| m.identity == *identity)
    }
    pub(super) fn verify(&self, ctx: &Context<'_>) -> Result<()> {
        ctx.check()?;
        for member in &self.members {
            require(
                reader::identity(member.identity.pid)? == member.identity,
                "HOST_OPERATOR_DRIFT",
            )?;
            match member.role {
                MemberRole::Controller => {
                    let before_environment = environment::running(member.identity.pid)?;
                    let actual = image::protected(&self.executable)?;
                    require(actual.digest == self.digest, "HOST_OPERATOR_CODE")?;
                    require(
                        environment::running(member.identity.pid)? == before_environment,
                        "HOST_ENVIRONMENT_DRIFT",
                    )?;
                }
                MemberRole::SudoTransport => {
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
                    signature::running_apple(member.identity.pid, "/usr/bin/sudo", None)?;
                }
                MemberRole::ExactJournalSidecar => {
                    // Re-prove the operation/manifest/script-digest coherence
                    // and that the running image is the Apple-signed
                    // interpreter of the bound script.  Membership itself is
                    // the kernel-parentage binding from capture.
                    sidecar_binding(ctx, &member.identity)?;
                    let exe = member
                        .identity
                        .executable
                        .as_deref()
                        .ok_or_else(|| Error::new("HOST_OPERATOR_CODE"))?;
                    signature::running_apple(member.identity.pid, exe, None)?;
                }
            }
        }
        ctx.check()
    }
}
#[cfg(test)]
#[path = "../../../../test/first_live/host/owned.rs"]
mod tests;

/// ExactJournalSidecar binding: the live process's argv must name a
/// root_journal_sidecar.py inside a package whose manifest hashes to what
/// that package's own journal operation-intent claims (written by the
/// sidecar under bootstrap.lock at claim time), whose operation_id matches,
/// and whose manifest pins exactly the sidecar bytes running.  PID+birth,
/// parent chain and the Apple interpreter signature are verified by the
/// caller; none of them alone is authorization.
fn sidecar_binding(ctx: &Context<'_>, process: &Identity) -> Result<()> {
    ctx.check()?;
    let argv = environment::argv(process.pid)?;
    let candidates: Vec<&str> = argv
        .iter()
        .filter(|a| a.ends_with(SIDECAR_NAME))
        .map(|a| a.as_str())
        .collect();
    require(candidates.len() == 1, "HOST_OPERATOR_CODE")?;
    let script_path = Path::new(candidates[0]);
    let package = script_path
        .parent()
        .ok_or_else(|| Error::new("HOST_OPERATOR_CODE"))?;
    let package_dir = Dir::open(package, 502)?;
    let manifest_raw = snapshot(
        &package_dir.open_file("manifest.json", libc::O_RDONLY, 0)?,
        502,
        1024 * 1024,
    )?
    .bytes;
    let sidecar_raw = snapshot(
        &package_dir.open_file(SIDECAR_NAME, libc::O_RDONLY, 0)?,
        502,
        1024 * 1024,
    )?
    .bytes;
    let journal = Dir::open(Path::new(JOURNAL_ROOT), 0)?;
    let manifest: serde_json::Value = serde_json::from_slice(&manifest_raw)
        .map_err(|_| Error::new("HOST_OPERATOR_CODE"))?;
    let intent: serde_json::Value = serde_json::from_slice(
        &snapshot(
            &journal
                .child(manifest["operation_id"].as_str().ok_or_else(|| {
                    Error::new("HOST_OPERATOR_CODE")
                })?)?
                .open_file("phase-0001-operation-intent.json", libc::O_RDONLY, 0)?,
            0,
            1024 * 1024,
        )?
        .bytes,
    )
    .map_err(|_| Error::new("HOST_OPERATOR_CODE"))?;
    let intent_raw = crate::trust::canonical_bytes(&intent)?;
    sidecar_coherent(&manifest_raw, &sidecar_raw, &intent_raw)?;
    ctx.check()
}
/// Pure coherence kernel over the three durable byte strings: the package
/// manifest, the sidecar script bytes, and the journal operation-intent.
/// Everything the census needs to accept the sidecar as THIS operation's
/// exact worker is checked here; anything missing or mismatched refuses.
pub(super) fn sidecar_coherent(
    manifest_raw: &[u8],
    sidecar_raw: &[u8],
    intent_raw: &[u8],
) -> Result<()> {
    let manifest: serde_json::Value = serde_json::from_slice(manifest_raw)
        .map_err(|_| Error::new("HOST_OPERATOR_CODE"))?;
    require(
        manifest["version"] == 1
            && manifest["files"][SIDECAR_NAME]["mode"] == "0400"
            && manifest["files"][SIDECAR_NAME]["sha256"] == sha(sidecar_raw),
        "HOST_OPERATOR_CODE",
    )?;
    let operation_id = manifest["operation_id"]
        .as_str()
        .ok_or_else(|| Error::new("HOST_OPERATOR_CODE"))?;
    valid_id(operation_id)?;
    let intent: serde_json::Value = serde_json::from_slice(intent_raw)
        .map_err(|_| Error::new("HOST_OPERATOR_CODE"))?;
    require(
        intent["version"] == 1
            && intent["state"] == "CONSUMED"
            && intent["operation_id"] == manifest["operation_id"]
            && intent["manifest_sha256"] == sha(manifest_raw),
        "HOST_OPERATOR_CODE",
    )
}
