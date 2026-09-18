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

mod genesis;
mod genesis_policy;
mod genesis_types;
pub use genesis::*;
pub use genesis_policy::*;
pub use genesis_types::*;

mod genesis_install;
mod genesis_install_actions;
mod genesis_install_census;
mod genesis_install_io;
mod genesis_install_native;
pub use genesis_install::*;
pub use genesis_install_actions::{
    genesis_login_child, login_genesis_reviewer, rollback_genesis_files,
};
pub use genesis_install_io::load_genesis_package;

mod login_reconciliation;
pub use login_reconciliation::login_reconciliation;
