//! Standing mutation is enabled only by a separate exact conditional Owner grant.
use super::*;
use crate::{
    error::require,
    trust::{digest, verify_signed},
    verification::native::VerifiedCanary,
    Error,
};
pub(crate) struct VerifiedStandingActivation(StandingActivationReceipt);
impl VerifiedStandingActivation {
    pub(crate) fn receipt(&self) -> &StandingActivationReceipt {
        &self.0
    }
}
impl Executor {
    #[expect(
        clippy::too_many_arguments,
        reason = "Conditional activation binds separate Owner authorization and independently observed canary"
    )]
    pub(crate) fn complete_adoption_activation(
        &mut self,
        guard: &MutationGuard,
        q: &Queue,
        c: &Catalog,
        adoption: &Signed<AdoptionGrant>,
        grant: &Signed<StandingActivationGrant>,
        canary: VerifiedCanary,
        goal: &Signed<GoalReceipt>,
        now: u64,
    ) -> Result<String> {
        guard.binds(&self.root)?;
        let a = &grant.payload;
        verify_signed(grant, c, &adoption.payload.profile_id)?;
        require(
            a.version == 1
                && a.issued_at <= now
                && now < a.expires_at
                && a.expires_at - a.issued_at <= 86400,
            "ACTIVATION_EXPIRED",
        )?;
        require(
            a.adoption_grant_digest == digest(adoption)?
                && canary.grant_digest() == a.adoption_grant_digest
                && a.baseline_receipt_digest == canary.current.transaction_receipt_digest
                && a.canary_plan_digest == adoption.payload.canary_plan_digest,
            "ACTIVATION_BINDING",
        )?;
        let status = q.daemon_status(&canary.current.unit_id)?;
        let current = q
            .daemon_current_installation(&status.unit.target_runtime)?
            .ok_or(Error::new("INSTALLED_GENERATION_CHANGED"))?;
        require(
            current == canary.current
                && current.origin == InstallationOrigin::ObservedExistingInstallation,
            "ACTIVATION_BINDING",
        )?;
        self.verify_live_baseline(q, &status.unit.target_runtime)?;
        let actual = self.service.image()?;
        self.service.prove(&actual)?;
        require(
            actual.generation == current.service_generation,
            "SERVICE_GENERATION_DRIFT",
        )?;
        verify_signed(goal, c, &status.unit.deployment_profile)?;
        require(
            goal.issuer == "local-verifier"
                && goal.payload.unit_id == current.unit_id
                && goal.payload.goal_id == adoption.payload.release.goal_id
                && goal.payload.outcome == GoalOutcome::Pass
                && goal.payload.attempt == current.attempt
                && goal.payload.target_generation == current.target_generation
                && goal.payload.service_generation == current.service_generation,
            "ACTIVATION_CANARY",
        )?;
        require(
            q.daemon_goal(&current.unit_id, &goal.payload.goal_id)?
                .as_ref()
                == Some(goal),
            "ACTIVATION_CANARY",
        )?;
        q.complete_standing_activation(VerifiedStandingActivation(StandingActivationReceipt {
            version: 1,
            grant_digest: digest(grant)?,
            adoption_grant_digest: digest(adoption)?,
            unit_id: current.unit_id.clone(),
            current,
            goal_receipt_digest: digest(goal)?,
            canary_evidence_digest: canary.evidence_digest,
        }))
    }
}
