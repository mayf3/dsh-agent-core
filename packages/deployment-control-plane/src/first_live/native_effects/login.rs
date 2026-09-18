//! Once-only reviewer login after authenticated fresh custody under the same guard.
use super::super::{gate::Grant, packet::Packet};
use crate::{
    fs::{secure::Dir, MutationGuard},
    issuer::custody_transition::Proof,
    Error, Result,
};
mod native;
mod process;
mod state;

pub(in crate::first_live) struct VerifiedLogin {
    receipt_sha256: String,
    root_identity: (u64, u64),
    area_identity: (u64, u64),
    receipt: state::Receipt,
}
fn identity(dir: &Dir) -> Result<(u64, u64)> {
    use std::os::unix::fs::MetadataExt;
    let m = dir.file.metadata()?;
    Ok((m.dev(), m.ino()))
}
impl VerifiedLogin {
    pub(in crate::first_live) fn receipt_sha256(&self) -> &str {
        &self.receipt_sha256
    }
    pub(in crate::first_live) fn validate(
        &self,
        root: &Dir,
        area: &Dir,
        packet: &Packet,
        grant: &Grant,
        guard: &MutationGuard,
        custody: &Proof,
    ) -> Result<()> {
        let native = native::Native {
            root,
            area,
            packet,
            grant,
            guard,
            custody,
            intent: None,
        };
        let (intent, auth) = native.checked(true)?;
        self.readback(root, area, &intent, auth.as_ref())
    }
    fn readback(
        &self,
        root: &Dir,
        area: &Dir,
        intent: &state::Intent,
        auth: Option<&state::AuthMetadata>,
    ) -> Result<()> {
        crate::error::require(
            self.root_identity == identity(root)?
                && self.area_identity == identity(area)?
                && self.receipt_sha256 == crate::fs::file::sha(&state::raw(area, state::RESULT)?)
                && self.receipt == state::receipt(area)?
                && &self.receipt.intent == intent
                && auth == Some(&self.receipt.auth),
            "FIRST_LIVE_LOGIN_PROOF",
        )
    }
}
pub(in crate::first_live) fn run(
    root: &Dir,
    area: &Dir,
    packet: &Packet,
    grant: &Grant,
    guard: &MutationGuard,
    custody: &Proof,
) -> Result<VerifiedLogin> {
    native::root_required()?;
    let mut effects = native::Native {
        root,
        area,
        packet,
        grant,
        guard,
        custody,
        intent: None,
    };
    let receipt_sha256 = state::execute(area, &mut effects)?;
    let proof = VerifiedLogin {
        receipt_sha256,
        root_identity: identity(root)?,
        area_identity: identity(area)?,
        receipt: state::receipt(area)?,
    };
    proof.validate(root, area, packet, grant, guard, custody)?;
    Ok(proof)
}
#[cfg(test)]
#[path = "../../../test/first_live/login.rs"]
mod tests;
