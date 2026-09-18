use crate::{
    bootstrap::IssuerRequirement, issuer::github::SourcePolicy, model::AdoptionRelease,
    registry::Enrollment, service::Configuration, transaction::NativeEnrollment,
};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct Packet {
    pub version: u32,
    pub operation_id: String,
    pub host: String,
    pub source_sha: String,
    pub review_sha256: String,
    pub controller_sha256: String,
    pub owner_acceptance_digest: String,
    pub previous: Previous,
    pub configuration: super::template::ConfigurationTemplate,
    pub native_enrollment: super::template::NativeEnrollmentTemplate,
    pub issuer_bindings: Vec<IssuerRequirement>,
    pub watchdog: Enrollment,
    pub broker: Enrollment,
    pub watchdog_source: SourcePolicy,
    pub broker_source: SourcePolicy,
    pub codex_sha256: String,
    pub review_helper_sha256: String,
    pub policy_epoch: u64,
    pub release: AdoptionRelease,
    pub canary_plan: super::canary_timing::CanaryPlanTemplate,
    pub health_max_age_ms: u64,
    pub heartbeat_max_age_ms: u64,
    pub lifecycle: LifecyclePlan,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct Previous {
    pub login_receipt_sha256: String,
    pub installation_receipt_sha256: String,
    pub service_sha256: String,
    pub issuer_policy_sha256: String,
    pub registry_sha256: String,
    pub trust_sha256: String,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct LifecyclePlan {
    pub legacy_locks: super::legacy_locks::Expectations,
    pub ancestors: BTreeMap<String, super::native_tree::Ancestor>,
    pub app_inventory_sha256: String,
    pub harness_inventory_sha256: String,
    pub node_inventory_sha256: String,
    pub node_payloads: BTreeMap<String, String>,
    pub tool_sha256: BTreeMap<String, String>,
    pub legacy_sha256: BTreeMap<String, String>,
    pub retired_binary_sha256: String,
    pub sudoers_sha256: BTreeMap<String, String>,
    pub caller_groups: Vec<u32>,
    pub runtime_groups: Vec<u32>,
    pub loaded_services: BTreeMap<String, bool>,
    pub effective_sudo_sha256: String,
    pub disabled_services: BTreeMap<String, bool>,
}

pub(super) struct BoundPacket<'a> {
    pub plan: &'a Packet,
    pub canary_plan_raw: String,
    pub configuration: Configuration,
    pub native_enrollment: NativeEnrollment,
}
impl std::ops::Deref for BoundPacket<'_> {
    type Target = Packet;
    fn deref(&self) -> &Packet {
        self.plan
    }
}
impl<'a> BoundPacket<'a> {
    pub(super) fn new(
        plan: &'a Packet,
        life: &super::lifecycle::VerifiedLifecycle,
        area: &crate::fs::secure::Dir,
        expires: u64,
    ) -> crate::Result<Self> {
        let mut result = Self {
            plan,
            canary_plan_raw: String::new(),
            configuration: plan.configuration.bind(life)?,
            native_enrollment: plan.native_enrollment.bind(life)?,
        };
        crate::bootstrap::validate_native_binding(
            &result.configuration,
            &result.native_enrollment,
            &plan.host,
            true,
        )?;
        result.canary_plan_raw =
            super::canary_timing::freeze(area, &plan.canary_plan, life, expires)?;
        Ok(result)
    }
}
