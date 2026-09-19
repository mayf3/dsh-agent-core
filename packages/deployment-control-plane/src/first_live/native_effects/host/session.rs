use super::{census, context::Context, environment, owned::Owned, tailscale, Stage, VerifiedHost};
use crate::first_live::{files, lifecycle::VerifiedLifecycle};
use crate::{error::require, transaction::ServiceImage, Result};
pub(in crate::first_live::native_effects) struct Session<'a> {
    ctx: Context<'a>,
    owned: Owned,
    tail: tailscale::Tailscale,
    stage: Stage,
}
impl<'a> Session<'a> {
    pub(in crate::first_live::native_effects) fn readonly_probe(
        ctx: Context<'a>,
        services: &ServiceImage,
        executable: &str,
        executable_digest: &str,
    ) -> Result<serde_json::Value> {
        ctx.check()?;
        let global = environment::global(&ctx)?;
        let running = environment::running(std::process::id())?;
        let owned = Owned::capture_probe(&ctx, executable, executable_digest)?;
        let tail = tailscale::prepare(&ctx)?;
        let census = census::probe(&ctx, services, tail.transition_identity(), &owned)?;
        owned.verify(&ctx)?;
        require(
            environment::global(&ctx)? == global,
            "HOST_ENVIRONMENT_DRIFT",
        )?;
        require(
            environment::running(std::process::id())? == running,
            "HOST_ENVIRONMENT_DRIFT",
        )?;
        ctx.check()?;
        Ok(serde_json::json!({
            "global_environment_digest":global,
            "operator_environment_digest":running,
            "process_role_census_digest":census,
            "service_generation_digest":services.generation,
            "tailscale_generation":"OBSERVED_UNCHANGED"
        }))
    }
    pub(in crate::first_live::native_effects) fn prepare(
        ctx: Context<'a>,
        services: &ServiceImage,
    ) -> Result<Self> {
        ctx.check()?;
        environment::global(&ctx)?;
        let owned = Owned::capture(&ctx)?;
        let tail = tailscale::prepare(&ctx)?;
        census::prove(
            &ctx,
            "transition-precheck",
            services,
            tail.transition_identity(),
            &owned,
        )?;
        Ok(Self {
            ctx,
            owned,
            tail,
            stage: Stage::Prepared,
        })
    }
    pub(in crate::first_live::native_effects) fn switch_tailscale(&mut self) -> Result<()> {
        self.stage.enter(Stage::Switching)?;
        self.ctx.check()?;
        self.tail.switch(&self.ctx)?;
        require(self.tail.is_closed(), "HOST_TAILSCALE_UNKNOWN")?;
        self.tail.verify(&self.ctx)?;
        self.stage.enter(Stage::Switched)
    }
    fn sealed_check(&self, phase: &str, services: &ServiceImage) -> Result<String> {
        self.ctx.check()?;
        require(self.tail.is_closed(), "HOST_TAILSCALE_UNKNOWN")?;
        self.tail.verify(&self.ctx)?;
        let environment = environment::global(&self.ctx)?;
        let identity = self
            .tail
            .sealed_identity()
            .ok_or_else(|| crate::Error::new("HOST_TAILSCALE_UNKNOWN"))?;
        let roles = census::prove(&self.ctx, phase, services, identity, &self.owned)?;
        self.tail.verify(&self.ctx)?;
        crate::error::require(
            environment::global(&self.ctx)? == environment,
            "HOST_ENVIRONMENT_DRIFT",
        )?;
        self.ctx.check()?;
        crate::trust::digest(&serde_json::json!({"roles":roles,"system_environment":environment}))
    }
    pub(in crate::first_live::native_effects) fn before_publication(
        &mut self,
        services: &ServiceImage,
    ) -> Result<()> {
        self.stage.enter(Stage::BeforeChecking)?;
        self.sealed_check("before-publication", services)?;
        self.stage.enter(Stage::Before)
    }
    pub(in crate::first_live::native_effects) fn after_publication(
        &mut self,
        services: &ServiceImage,
    ) -> Result<()> {
        self.stage.enter(Stage::AfterChecking)?;
        self.sealed_check("after-publication", services)?;
        self.stage.enter(Stage::After)
    }
    pub(in crate::first_live::native_effects) fn verify_failure_availability(
        &mut self,
        services: &ServiceImage,
    ) -> Result<()> {
        require(
            self.tail.is_closed() && self.stage.recoverable(),
            "HOST_TAILSCALE_UNKNOWN",
        )?;
        if let Err(error) = self.sealed_check("failure-before-availability", services) {
            self.stage = Stage::Failed;
            return Err(error);
        }
        Ok(())
    }
    pub(in crate::first_live::native_effects) fn finish(
        &mut self,
        life: &VerifiedLifecycle,
        services: &ServiceImage,
    ) -> Result<VerifiedHost> {
        self.stage.enter(Stage::Finishing)?;
        let root_roles_digest = self.sealed_check("final", services)?;
        let tailscale_digest = self.tail.verify(&self.ctx)?;
        self.ctx.check()?;
        let receipt = serde_json::json!({"version":1,"state":"CURRENT_HOST_INGRESS_CLOSED","operation_id":self.ctx.packet.operation_id,"packet_sha256":self.ctx.grant.packet_sha256,"controller_sha256":self.ctx.grant.controller_sha256,"lifecycle_digest":life.digest(),"tailscale_digest":tailscale_digest,"root_roles_digest":root_roles_digest});
        files::publish(self.ctx.area, "host-safety-result.json", &receipt)?;
        let raw = files::raw(self.ctx.area, "host-safety-result.json")?;
        require(
            raw == crate::trust::canonical_bytes(&receipt)?,
            "HOST_RECEIPT_READBACK",
        )?;
        self.stage.enter(Stage::Finished)?;
        Ok(VerifiedHost {
            receipt_sha256: crate::fs::file::sha(&raw),
        })
    }
}
