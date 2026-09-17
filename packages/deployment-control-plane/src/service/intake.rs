use crate::{
    error::require,
    fs::{file::snapshot, secure::Dir},
    model::*,
    queue::Queue,
    trust::{digest, valid_digest, valid_id, verify_signed, Signable},
    Error, Result,
};
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use std::{
    collections::{BTreeMap, BTreeSet},
    os::unix::fs::MetadataExt,
    path::Path,
};
pub const MAX_PROTECTED_RECORD: u64 = 32 * 1024 * 1024;
#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Caller {
    pub uid: u32,
    pub gid: u32,
    pub profiles: Vec<String>,
    pub producers: Vec<String>,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "kebab-case", deny_unknown_fields)]
pub enum VerifierBinding {
    ExternalObservation { deadline_ms: u64 },
    NativeInstalledReadback { issuer: String },
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Configuration {
    pub catalog: Catalog,
    pub callers: Vec<Caller>,
    pub producers: Vec<String>,
    pub verifiers: BTreeMap<String, VerifierBinding>,
    pub socket_gid: u32,
    #[serde(default)]
    pub socket_ancestor: Option<crate::bootstrap::SocketAncestor>,
}
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Activation {
    epoch: u64,
    configuration_digest: String,
    enrollment_digest: String,
    owner_acceptance_digest: String,
    issuer_bindings_digest: String,
}
impl Signable for Activation {
    const DOMAIN: &'static str = "DaemonActivation";
    const ROLE: Role = Role::Authority;
}
pub(crate) struct Intake {
    pub root: Dir,
    pub config: Configuration,
}
impl Intake {
    pub fn open(path: &Path, sandbox: bool) -> Result<Self> {
        let uid = unsafe { libc::geteuid() };
        let root = Dir::open(path, uid)?;
        require(root.file.metadata()?.mode() & 0o777 == 0o700, "UNSAFE_MODE")?;
        let config: Configuration = read(&root, "service.json")?;
        require(
            config.callers.len() <= 256
                && config.catalog.profiles.len() <= 64
                && config.producers.len() <= 256,
            "CONFIG_LIMIT",
        )?;
        require(!config.producers.is_empty(), "PRODUCER_REGISTRY_EMPTY")?;
        let mut identities = BTreeSet::new();
        for caller in &config.callers {
            require(identities.insert(caller.uid), "SHARED_UID_SCOPE")?;
            require(
                caller
                    .profiles
                    .iter()
                    .all(|p| config.catalog.profiles.contains_key(p))
                    && caller
                        .producers
                        .iter()
                        .all(|p| config.producers.contains(p)),
                "ACTOR_SCOPE",
            )?;
        }
        for (name, binding) in &config.verifiers {
            valid_id(name)?;
            if let VerifierBinding::ExternalObservation { deadline_ms } = binding {
                require(
                    *deadline_ms > 0 && *deadline_ms <= 2000,
                    "VERIFIER_DEADLINE",
                )?;
            }
        }
        if !sandbox {
            let proof: Signed<Activation> = read(&root, "daemon-activation.json")?;
            verify_signed(&proof, &config.catalog, "bootstrap")?;
            require(
                proof.payload.epoch > 0 && proof.payload.configuration_digest == digest(&config)?,
                "ACTIVATION_BINDING",
            )?;
            valid_digest(&proof.payload.owner_acceptance_digest)?;
            let enrollment: crate::transaction::NativeEnrollment = read(&root, "activation.json")?;
            require(
                proof.payload.enrollment_digest == digest(&enrollment)?,
                "ACTIVATION_BINDING",
            )?;
            let bindings: serde_json::Value = read(&root, "issuer-bindings.json")?;
            require(
                proof.payload.issuer_bindings_digest == digest(&bindings)?,
                "ISSUER_BINDING",
            )?;
            crate::bootstrap::validate_native_binding(
                &config,
                &enrollment,
                &crate::bootstrap::observed_host()?,
                true,
            )?;
        }
        Ok(Self { root, config })
    }
    pub fn actor(&self, uid: u32, gid: u32) -> Result<Actor> {
        let c = self
            .config
            .callers
            .iter()
            .find(|c| c.uid == uid && c.gid == gid)
            .ok_or(Error::new("CALLER_DENIED"))?;
        Ok(Actor {
            id: format!("uid-{uid}"),
            allowed_profiles: c.profiles.clone(),
            allowed_producers: c.producers.clone(),
        })
    }
    fn area(&self, name: &str) -> Result<Dir> {
        self.root.child("intake")?.child(name)
    }
    pub fn proposal(&self, hash: &str) -> Result<Proposal> {
        valid_digest(hash)?;
        let name = format!("{hash}.json");
        let cache = self.root.child("admitted")?;
        let p: Proposal = match read(&cache, &name) {
            Ok(p) => p,
            Err(e) if e.code() == "ABSENT" => read(&self.area("proposals")?, &name)?,
            Err(e) => return Err(e),
        };
        require(digest(&p)? == hash, "INTAKE_DIGEST")?;
        self.publish("admitted", hash, &p)?;
        Ok(p)
    }
    pub fn recovery(
        &self,
        id: &str,
        revision: u64,
    ) -> std::result::Result<Option<Signed<RecoveryEvidence>>, crate::transaction::RecoveryFailure>
    {
        valid_digest(id)?;
        // Losing the protected namespace is global uncertainty. Only absence of
        // this exact unit/revision file means no remediation has been supplied.
        let area = self.area("recovery")?;
        match read(&area, &format!("{id}-{revision}.json")) {
            Ok(record) => Ok(Some(record)),
            Err(error) if error.code() == "ABSENT" => Ok(None),
            Err(error) => Err(crate::transaction::RecoveryFailure::record(error)),
        }
    }
    pub fn policy(&self, profile: &str) -> Result<Signed<Policy>> {
        valid_id(profile)?;
        read(&self.area("policies")?, &format!("{profile}.json"))
    }
    pub fn poll(&self, q: &Queue) -> Result<()> {
        for producer in &self.config.producers {
            q.register_producer(&self.config.catalog, producer)?;
            // At most 16 snapshots per poll; a gap leaves census incomplete.
            for _ in 0..16 {
                let revision = q.daemon_producer_revision(producer)?;
                let file = format!("{producer}-{}.json", revision + 1);
                match read::<Signed<ProducerSnapshot>>(&self.area("snapshots")?, &file) {
                    Ok(s) => q.ingest_snapshot(&self.config.catalog, &s)?,
                    Err(e) if e.code() == "ABSENT" => break,
                    Err(e) => return Err(e),
                }
            }
        }
        let revision = q.census_revision()?;
        let mut cursor = None;
        // Complete paginated read; no empty/disconnected registry success.
        for _ in 0..4096 {
            let page = q.census(revision, cursor.as_deref(), 256)?;
            require(page.exhaustive, "PRODUCER_WATERMARK_GAP")?;
            cursor = page.next_cursor;
            if cursor.is_none() {
                return Ok(());
            }
        }
        Err(Error::new("CENSUS_LIMIT"))
    }
    pub fn result(&self, id: &str) -> Result<Signed<GoalReceipt>> {
        valid_digest(id)?;
        read(&self.area("results")?, &format!("{id}.json"))
    }
    pub fn publish(&self, area: &str, id: &str, body: &impl Serialize) -> Result<()> {
        valid_digest(id)?;
        let raw = crate::trust::canonical_bytes(body)?;
        require(raw.len() <= MAX_PROTECTED_RECORD as usize, "SIZE_LIMIT")?;
        super::mailbox::publish(&self.root, area, id, &raw)
    }

    pub fn deliver(&self, q: &Queue) -> Result<()> {
        for caller in &self.config.callers {
            let actor = self.actor(caller.uid, caller.gid)?;
            for entry in q.outbox(&actor)? {
                self.publish("closure", &entry.id, &entry)?;
                match read::<Signed<ClosureAcknowledgement>>(
                    &self.area("acks")?,
                    &format!("{}.json", entry.id),
                ) {
                    Ok(ack) => q.acknowledge_closure(&self.config.catalog, &ack)?,
                    Err(e) if e.code() == "ABSENT" => (),
                    Err(e) => return Err(e),
                }
            }
        }
        Ok(())
    }
}
pub(crate) fn read<T: DeserializeOwned>(dir: &Dir, name: &str) -> Result<T> {
    let bytes = snapshot(
        &dir.open_file(name, libc::O_RDONLY, 0)?,
        dir.uid,
        MAX_PROTECTED_RECORD,
    )?
    .bytes;
    super::protocol::depth(&bytes, 32)?;
    Ok(serde_json::from_slice(&bytes)?)
}
