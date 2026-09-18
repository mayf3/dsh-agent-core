//! Fixed one-time Tailscale same-byte path transition, never a service manager.
use super::{context::Context, credentials::Identity};
#[path = "tailscale_io.rs"]
mod io;
#[path = "tailscale_native.rs"]
mod native;
#[path = "tailscale_state.rs"]
mod state;
#[path = "tailscale_status.rs"]
mod status;
use crate::Result;
pub(super) const LABEL: &str = "system/com.tailscale.tailscaled";
pub(super) const PLIST: &str = "com.tailscale.tailscaled.plist";
pub(super) const OLD: &str = "/usr/local/Cellar/tailscale/1.94.2/bin/tailscaled";
pub(super) const NEW: &str = "/usr/local/libexec/tailscale-sealed/tailscaled";
pub(super) const OLD_PLIST: &str =
    "d8b2ca94c6fe9d417f7541c882d87b95a4bdea8a5a6a4e80484e7e9a7e11ffdf";
pub(super) const NEW_PLIST: &str =
    "ec12e0c62acf5cd44984fdf8474dca8fafc098842c2a9f8c3f62bfb03caa19f8";
pub(super) const PAYLOAD: &str = "5d9c03785aa534b0bd42071f1b7632474ae932e876dcaa7fd3866f685010d8da";
pub(super) struct Tailscale {
    original: Identity,
    status: String,
    state_directory: (u64, u64),
    transition: state::Transition,
    failed: std::cell::Cell<bool>,
}
pub(super) fn prepare(ctx: &Context<'_>) -> Result<Tailscale> {
    native::prepare(ctx)
}
impl Tailscale {
    pub(super) fn transition_identity(&self) -> &Identity {
        &self.original
    }
    pub(super) fn sealed_identity(&self) -> Option<&Identity> {
        if self.failed.get() {
            None
        } else {
            self.transition.sealed.as_ref().map(|v| &v.0)
        }
    }
    pub(super) fn is_closed(&self) -> bool {
        !self.failed.get() && self.transition.sealed.is_some()
    }
    pub(super) fn switch(&mut self, ctx: &Context<'_>) -> Result<()> {
        let mut effects = native::Native {
            ctx,
            old: &self.original,
            status: &self.status,
            state_directory: self.state_directory,
        };
        let result = self.transition.run(&mut effects);
        if result.is_err() {
            self.failed.set(true);
        }
        result
    }
    pub(super) fn verify(&self, ctx: &Context<'_>) -> Result<String> {
        crate::error::require(!self.failed.get(), "TAILSCALE_PROOF_INVALIDATED")?;
        let result = native::verify(self, ctx);
        if result.is_err() {
            self.failed.set(true);
        }
        result
    }
}
