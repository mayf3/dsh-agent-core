//! Deployment obligations only. Original business Goal completion is never inferred here.
mod closure;
mod dependencies;
mod storage;
mod types;
mod validation;
use crate::{
    error::require,
    fs::{secure::Dir, FixtureRoots},
    model::*,
    trust::*,
    Error, Result,
};
use ed25519_dalek::{Signer, SigningKey};
use std::{collections::BTreeMap, path::Path};
pub use types::*;

pub struct Registry {
    root: Dir,
    catalog: Catalog,
    producer: String,
    key: SigningKey,
}
impl Registry {
    /// Explicit non-root fixture mode, confined to the kernel-selected private temporary root.
    pub fn open_fixture(
        path: &Path,
        catalog: &Catalog,
        producer: &str,
        seed: [u8; 32],
    ) -> Result<Self> {
        let roots = FixtureRoots::open(path)?;
        Self::open(
            roots.root.mkdir("registry")?,
            catalog,
            producer,
            SigningKey::from_bytes(&seed),
        )
    }
    pub(crate) fn open_native(catalog: &Catalog) -> Result<Self> {
        require(unsafe { libc::geteuid() } == 0, "ROOT_REQUIRED")?;
        Self::open_local_root(
            &Dir::open(Path::new("/private/var/db/agent-deployd"), 0)?,
            catalog,
        )
    }
    /// Internal daemon adapter; callers supply only its already authenticated root.
    pub(crate) fn open_local_root(root: &Dir, catalog: &Catalog) -> Result<Self> {
        let keys = root.child("issuer-keys")?;
        let producer = "local-deployment-registry";
        let key = crate::issuer::custody::load(&keys, producer, Role::Producer, catalog)?;
        Self::open(root.child("registry")?, catalog, producer, key)
    }
    fn open(root: Dir, catalog: &Catalog, producer: &str, key: SigningKey) -> Result<Self> {
        valid_id(producer)?;
        let trusted = catalog
            .keys
            .get(producer)
            .ok_or(Error::new("UNKNOWN_ISSUER"))?;
        require(
            trusted.role == Role::Producer && trusted.scopes.iter().any(|s| s == producer),
            "PRODUCER_SCOPE",
        )?;
        require(
            trusted.public_key == hex::encode(key.verifying_key().as_bytes()),
            "ISSUER_KEY_MISMATCH",
        )?;
        storage::initialize(&root)?;
        let registry = Self {
            root,
            catalog: catalog.clone(),
            producer: producer.into(),
            key,
        };
        let _lock = storage::lock(&registry.root)?;
        registry.history()?;
        Ok(registry)
    }
    fn sign<T: Signable>(&self, payload: T) -> Result<Signed<T>> {
        require(T::ROLE == Role::Producer, "ISSUER_ROLE")?;
        let signature = hex::encode(self.key.sign(&signing_bytes(&payload)?).to_bytes());
        Ok(Signed {
            issuer: self.producer.clone(),
            payload,
            signature,
        })
    }
    pub fn enroll(&self, enrollment: &Signed<Enrollment>) -> Result<DeploymentRecord> {
        validation::enrollment(&self.catalog, &self.producer, enrollment)?;
        let _lock = storage::lock(&self.root)?;
        let history = self.history()?;
        let mut rows = Self::rows(&history);
        let id = &enrollment.payload.goal_id;
        if let Some(row) = rows.get(id) {
            require(row.enrollment == *enrollment, "ENROLLMENT_IMMUTABLE")?;
            return Ok(row.clone());
        }
        require(rows.len() < 256, "REGISTRY_QUOTA")?;
        let row = DeploymentRecord {
            enrollment: enrollment.clone(),
            state: DeploymentState::Pending,
            revision: 0,
            business_goal_complete: false,
            ready: None,
            proposal_digest: None,
            closure: None,
        };
        rows.insert(id.clone(), row.clone());
        dependencies::validate(&rows, id)?;
        self.commit(&history, rows)?;
        Ok(row)
    }
    pub fn get(&self, goal: &str) -> Result<DeploymentRecord> {
        valid_id(goal)?;
        let _lock = storage::lock(&self.root)?;
        Self::rows(&self.history()?)
            .remove(goal)
            .ok_or(Error::new("UNKNOWN_ENROLLMENT"))
    }
    /// Resolve only explicit signed child mappings from one authenticated locked snapshot.
    pub(crate) fn resolved_dependencies(&self, goal: &str) -> Result<Vec<String>> {
        valid_id(goal)?;
        let _lock = storage::lock(&self.root)?;
        let rows = Self::rows(&self.history()?);
        dependencies::validate(&rows, goal)?;
        Ok(rows[goal]
            .enrollment
            .payload
            .prior_dependencies
            .iter()
            .map(|p| p.effective_goal().to_owned())
            .collect())
    }
    /// Initial PENDING enrollment publishes an authenticated empty complete snapshot.
    pub fn snapshot(&self) -> Result<Signed<ProducerSnapshot>> {
        let _lock = storage::lock(&self.root)?;
        self.history()?
            .last()
            .map(|s| s.payload.snapshot.clone())
            .ok_or(Error::new("REGISTRY_EMPTY"))
    }
    /// Immutable cumulative snapshots, retained so missed publications survive restart.
    pub fn snapshots_after(
        &self,
        revision: u64,
        limit: usize,
    ) -> Result<Vec<Signed<ProducerSnapshot>>> {
        require(limit > 0 && limit <= 16, "PAGE_LIMIT")?;
        let _lock = storage::lock(&self.root)?;
        let history = self.history()?;
        require(revision <= history.len() as u64, "REGISTRY_AHEAD")?;
        Ok(history
            .into_iter()
            .skip(revision as usize)
            .take(limit)
            .map(|s| s.payload.snapshot)
            .collect())
    }
    pub fn activate(
        &self,
        actor: &Actor,
        proposal: &Proposal,
        expected: u64,
        now: u64,
    ) -> Result<DeploymentRecord> {
        validate_proposal(&self.catalog, actor, proposal, now)?;
        require(proposal.goals.len() == 1, "REGISTRY_ONE_GOAL")?;
        let ready = &proposal.goals[0];
        let _lock = storage::lock(&self.root)?;
        let history = self.history()?;
        let mut rows = Self::rows(&history);
        dependencies::validate(&rows, &ready.payload.goal_id)?;
        let row = rows
            .get_mut(&ready.payload.goal_id)
            .ok_or(Error::new("UNKNOWN_ENROLLMENT"))?;
        require(row.state != DeploymentState::Closed, "DEPLOYMENT_CLOSED")?;
        require(
            row.revision == expected && Some(ready.payload.revision) == expected.checked_add(1),
            "REGISTRY_CAS",
        )?;
        validation::ready(&row.enrollment.payload, proposal)?;
        row.ready = Some(ready.clone());
        row.revision = ready.payload.revision;
        row.proposal_digest = Some(digest(proposal)?);
        row.state = DeploymentState::Ready;
        let result = row.clone();
        self.commit(&history, rows)?;
        Ok(result)
    }
    fn rows(history: &[Signed<storage::Ledger>]) -> BTreeMap<String, DeploymentRecord> {
        history
            .last()
            .map(|h| h.payload.rows.clone())
            .unwrap_or_default()
    }
}

#[cfg(test)]
#[path = "../../test/registry/durability.rs"]
mod durability;

#[cfg(test)]
#[path = "../../test/registry/adapter.rs"]
mod adapter_tests;

#[cfg(test)]
#[path = "../../test/registry/fixture.rs"]
pub(crate) mod test_fixture;
