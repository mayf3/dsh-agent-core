//! Finite current-ingress proof. No caller can construct a successful host receipt.
mod credentials;

mod reader;

mod launch;

mod policy;

mod signature;

mod attribution;

mod image;

mod macho;

mod context;

mod inspect;

mod owned;

// A host receipt is constructed only after the actual finite closure checks.
pub(in crate::first_live) struct VerifiedHost {
    receipt_sha256: String,
}
impl VerifiedHost {
    pub(in crate::first_live) fn receipt_sha256(&self) -> &str {
        &self.receipt_sha256
    }
}

mod census;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Stage {
    Prepared,
    Switching,
    Switched,
    BeforeChecking,
    Before,
    AfterChecking,
    After,
    Finishing,
    Finished,
    Failed,
}
impl Stage {
    fn recoverable(self) -> bool {
        matches!(self, Self::After | Self::Finished)
    }
    fn enter(&mut self, next: Self) -> crate::Result<()> {
        crate::error::require(
            matches!(
                (*self, next),
                (Self::Prepared, Self::Switching)
                    | (Self::Switching, Self::Switched)
                    | (Self::Switched, Self::BeforeChecking)
                    | (Self::BeforeChecking, Self::Before)
                    | (Self::Before, Self::AfterChecking)
                    | (Self::AfterChecking, Self::After)
                    | (Self::After, Self::Finishing)
                    | (Self::Finishing, Self::Finished)
            ),
            "HOST_PHASE_UNKNOWN_OR_REPLAY",
        )?;
        *self = next;
        Ok(())
    }
}
#[cfg(test)]
#[path = "../../../test/first_live/host/session.rs"]
mod session_tests;

mod tailscale;

mod session;
pub(super) use session::Session;

pub(super) use context::Context as Inputs;
pub(super) fn observed_services(
    packet: &crate::first_live::packet::Packet,
) -> crate::Result<crate::transaction::ServiceImage> {
    let components =
        crate::transaction::first_live_components(&packet.native_enrollment.maintenance()?)?;
    let runtime = components
        .iter()
        .find(|c| c.kind == crate::transaction::NativeKind::Runtime)
        .ok_or_else(|| crate::Error::new("HOST_SERVICE_GROUP"))?;
    Ok(crate::transaction::ServiceImage {
        loaded: runtime.loaded,
        running: runtime.running,
        processes: components
            .iter()
            .filter_map(|c| c.process.clone())
            .collect(),
        generation: crate::trust::digest(&components)?,
        components,
    })
}

mod environment;
