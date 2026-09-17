//! Offline, non-root preparation. Nothing in this module installs or grants authority.
pub(crate) mod loader;
pub use loader::{verify_loader_images, ClosureKind, LoaderFile};
mod bundle;
mod prospective;
mod verify;
pub use bundle::{generate, Package, Payload};
pub use loader::verify_platform_launchctl;
pub use prospective::{Identities, IssuerRequirement, Layout};
pub use verify::{verify_bundle, verify_sources, Preflight};
mod plist;
pub use plist::verify_service_plist;

mod binding;
pub use binding::{
    observed_host, profile_digest, validate_native_binding, validate_prepared_manifest,
};

pub(crate) mod socket;
pub use socket::SocketAncestor;

mod preparation;
pub use preparation::*;
