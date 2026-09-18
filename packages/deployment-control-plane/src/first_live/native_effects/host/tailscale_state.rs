//! One consumed transition. Any interruption leaves closure false, never replayable.
use super::{Context, Identity};
use crate::{error::require, Result};
pub(super) trait Effects {
    fn check(&mut self) -> Result<()>;
    fn intent(&mut self) -> Result<()>;
    fn stage(&mut self) -> Result<()>;
    fn stop(&mut self) -> Result<()>;
    fn stopped(&mut self) -> Result<()>;
    fn publish(&mut self) -> Result<()>;
    fn start(&mut self) -> Result<()>;
    fn ready(&mut self) -> Result<(Identity, String)>;
    fn complete(&mut self, identity: &Identity, status: &str) -> Result<()>;
}
#[derive(Default)]
pub(super) struct Transition {
    consumed: bool,
    pub(super) sealed: Option<(Identity, String)>,
}
impl Transition {
    pub(super) fn run(&mut self, e: &mut impl Effects) -> Result<()> {
        require(!self.consumed, "TAILSCALE_ALREADY_CONSUMED")?;
        self.consumed = true;
        e.check()?;
        e.intent()?;
        e.check()?;
        e.stage()?;
        e.check()?;
        e.stop()?;
        e.stopped()?;
        e.check()?;
        e.publish()?;
        e.check()?;
        e.start()?;
        let (identity, status) = e.ready()?;
        e.check()?;
        e.complete(&identity, &status)?;
        self.sealed = Some((identity, status));
        Ok(())
    }
}
// Kept private to the native host module; external strings cannot construct a proof.
pub(super) fn checked(ctx: &Context<'_>) -> Result<()> {
    ctx.check()
}

#[cfg(test)]
#[path = "../../../../test/first_live/host/tailscale_state.rs"]
mod tests;
