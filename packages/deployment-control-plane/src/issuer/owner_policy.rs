//! Two finite Owner-owned policy shapes; caller requests remain goal + source SHA.
use super::{coordinator::SupervisorPolicy, github::SourcePolicy};
use crate::{
    error::require,
    model::*,
    registry::{Enrollment, Registry},
    transaction::NativeEnrollment,
    trust::{canonical_bytes, digest, valid_digest, valid_id},
    Error, Result,
};
use serde::{
    de::{self, MapAccess, Visitor},
    Deserialize, Deserializer, Serialize,
};
use std::collections::{BTreeMap, BTreeSet};

#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct GoalSource {
    enrollment_digest: String,
    source: SourcePolicy,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct MultiSourcePolicy {
    version: u32,
    #[serde(deserialize_with = "unique_sources")]
    sources_by_goal: BTreeMap<String, GoalSource>,
    codex_sha256: String,
    review_helper_sha256: String,
    policy_epoch: u64,
    revoked_sources: Vec<String>,
    revoked_artifacts: Vec<String>,
}
#[derive(Clone, Serialize)]
#[serde(untagged)]
pub(crate) enum OwnerPolicy {
    V1(SupervisorPolicy),
    V2(MultiSourcePolicy),
}
// Decode without Value/untagged buffering so duplicate keys cannot be lost.
impl<'de> Deserialize<'de> for OwnerPolicy {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> std::result::Result<Self, D::Error> {
        #[derive(Deserialize)]
        #[serde(deny_unknown_fields)]
        struct Wire {
            version: u32,
            #[serde(default, deserialize_with = "optional_source")]
            source: Option<SourcePolicy>,
            #[serde(default, deserialize_with = "optional_sources")]
            sources_by_goal: Option<BTreeMap<String, GoalSource>>,
            codex_sha256: String,
            review_helper_sha256: String,
            policy_epoch: u64,
            revoked_sources: Vec<String>,
            revoked_artifacts: Vec<String>,
        }
        let w = Wire::deserialize(deserializer)?;
        match (w.version, w.source, w.sources_by_goal) {
            (1, Some(source), None) => Ok(Self::V1(SupervisorPolicy {
                version: 1,
                source,
                codex_sha256: w.codex_sha256,
                review_helper_sha256: w.review_helper_sha256,
                policy_epoch: w.policy_epoch,
                revoked_sources: w.revoked_sources,
                revoked_artifacts: w.revoked_artifacts,
            })),
            (2, None, Some(sources_by_goal)) => Ok(Self::V2(MultiSourcePolicy {
                version: 2,
                sources_by_goal,
                codex_sha256: w.codex_sha256,
                review_helper_sha256: w.review_helper_sha256,
                policy_epoch: w.policy_epoch,
                revoked_sources: w.revoked_sources,
                revoked_artifacts: w.revoked_artifacts,
            })),
            _ => Err(de::Error::custom("ISSUER_POLICY_SHAPE")),
        }
    }
}
fn optional_source<'de, D: Deserializer<'de>>(
    d: D,
) -> std::result::Result<Option<SourcePolicy>, D::Error> {
    SourcePolicy::deserialize(d).map(Some)
}
fn optional_sources<'de, D: Deserializer<'de>>(
    d: D,
) -> std::result::Result<Option<BTreeMap<String, GoalSource>>, D::Error> {
    unique_sources(d).map(Some)
}
fn unique_sources<'de, D: Deserializer<'de>>(
    d: D,
) -> std::result::Result<BTreeMap<String, GoalSource>, D::Error> {
    struct Sources;
    impl<'de> Visitor<'de> for Sources {
        type Value = BTreeMap<String, GoalSource>;
        fn expecting(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
            f.write_str("unique finite Goal source map")
        }
        fn visit_map<M: MapAccess<'de>>(
            self,
            mut map: M,
        ) -> std::result::Result<Self::Value, M::Error> {
            let mut entries = BTreeMap::new();
            while let Some((key, value)) = map.next_entry::<String, GoalSource>()? {
                if entries.len() >= 256 || entries.insert(key, value).is_some() {
                    return Err(de::Error::custom("ISSUER_SOURCE_MAP"));
                }
            }
            if entries.is_empty() {
                return Err(de::Error::custom("ISSUER_SOURCE_MAP"));
            }
            Ok(entries)
        }
    }
    d.deserialize_map(Sources)
}
impl OwnerPolicy {
    pub(crate) fn epoch(&self) -> u64 {
        match self {
            Self::V1(p) => p.policy_epoch,
            Self::V2(p) => p.policy_epoch,
        }
    }
    pub(crate) fn codex(&self) -> &str {
        match self {
            Self::V1(p) => &p.codex_sha256,
            Self::V2(p) => &p.codex_sha256,
        }
    }
    pub(crate) fn helper(&self) -> &str {
        match self {
            Self::V1(p) => &p.review_helper_sha256,
            Self::V2(p) => &p.review_helper_sha256,
        }
    }
    pub(crate) fn revoked_sources(&self) -> &Vec<String> {
        match self {
            Self::V1(p) => &p.revoked_sources,
            Self::V2(p) => &p.revoked_sources,
        }
    }
    pub(crate) fn revoked_artifacts(&self) -> &Vec<String> {
        match self {
            Self::V1(p) => &p.revoked_artifacts,
            Self::V2(p) => &p.revoked_artifacts,
        }
    }
    pub(crate) fn source_digest(&self) -> Result<String> {
        match self {
            Self::V1(p) => digest(&p.source),
            Self::V2(p) => digest(&p.sources_by_goal),
        }
    }
    pub(crate) fn validate(&self) -> Result<()> {
        require(self.epoch() > 0, "ISSUER_POLICY")?;
        require(
            canonical_bytes(self)?.len() <= 4 * 1024 * 1024,
            "SIZE_LIMIT",
        )?;
        match self {
            Self::V1(p) => {
                require(p.version == 1, "ISSUER_POLICY")?;
                p.source.validate()?;
            }
            Self::V2(p) => {
                require(
                    p.version == 2
                        && !p.sources_by_goal.is_empty()
                        && p.sources_by_goal.len() <= 256,
                    "ISSUER_SOURCE_MAP",
                )?;
                for (goal, entry) in &p.sources_by_goal {
                    valid_id(goal)?;
                    valid_digest(&entry.enrollment_digest)?;
                    entry.source.validate()?;
                }
            }
        }
        valid_digest(self.codex())?;
        valid_digest(self.helper())?;
        require(
            self.revoked_sources().len() <= 4096 && self.revoked_artifacts().len() <= 4096,
            "SIZE_LIMIT",
        )?;
        for source in self.revoked_sources() {
            super::source::source_sha(source)?;
        }
        for artifact in self.revoked_artifacts() {
            valid_digest(artifact)?;
        }
        Ok(())
    }
    pub(crate) fn select<'a>(
        &'a self,
        signed: &Signed<Enrollment>,
        profile: &Profile,
        native: &NativeEnrollment,
    ) -> Result<&'a SourcePolicy> {
        self.validate()?;
        let e = &signed.payload;
        let source = match self {
            Self::V1(p) => &p.source,
            Self::V2(p) => {
                let entry = p
                    .sources_by_goal
                    .get(&e.goal_id)
                    .ok_or(Error::new("ISSUER_SOURCE_NOT_ENROLLED"))?;
                require(
                    entry.enrollment_digest == digest(signed)?,
                    "ISSUER_ENROLLMENT_BINDING",
                )?;
                &entry.source
            }
        };
        require(
            source.repo == e.repo
                && source.repo == profile.repo
                && source.accepted_contract_sha256 == e.authority.source.sha256,
            "AUTHORITY_MISMATCH",
        )?;
        require(
            native.profile_id == e.deployment_profile
                && native.profile_revision == profile.revision
                && native.profile_digest == digest(profile)?
                && e.target_runtime == profile.target_runtime
                && profile
                    .verification_profiles
                    .contains(&e.verification_profile)
                && profile.goal_verifiers.contains_key(&e.verification_profile),
            "ISSUER_PROFILE_BINDING",
        )?;
        let mut targets = BTreeSet::new();
        for slot in &source.slots {
            require(
                targets.insert(slot.target.to_ascii_lowercase())
                    && native.initial_files.iter().any(|f| {
                        f.path == slot.target
                            && f.mutable
                            && (f.mode & 0o111 != 0) == slot.executable
                    }),
                "ISSUER_SLOT_BINDING",
            )?;
        }
        Ok(source)
    }
    pub(crate) fn validate_registry(
        &self,
        registry: &Registry,
        catalog: &Catalog,
        native: &NativeEnrollment,
    ) -> Result<()> {
        if let Self::V2(p) = self {
            for goal in p.sources_by_goal.keys() {
                let row = registry.get(goal)?;
                let profile = catalog
                    .profiles
                    .get(&row.enrollment.payload.deployment_profile)
                    .ok_or(Error::new("PROFILE_NOT_ALLOWED"))?;
                self.select(&row.enrollment, profile, native)?;
                registry.resolved_dependencies(goal)?;
            }
        }
        Ok(())
    }
    pub(crate) fn issue_digest(
        &self,
        signed: &Signed<Enrollment>,
        selected: &SourcePolicy,
        native_digest: &str,
    ) -> Result<String> {
        if matches!(self, Self::V1(_))
            && signed
                .payload
                .prior_dependencies
                .iter()
                .all(|p| p.deployment_child.is_none())
        {
            // Historical immutable v1 drafts retain their original binding. Registry
            // immutability guarantees this Goal cannot later acquire a child mapping.
            digest(&(selected, native_digest))
        } else {
            digest(&(self, selected, signed, native_digest))
        }
    }
}
#[cfg(test)]
#[path = "../../test/issuer/owner_policy.rs"]
mod tests;
