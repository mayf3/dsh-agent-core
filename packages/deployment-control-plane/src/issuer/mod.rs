//! Fixed local evidence producers. No caller-facing arbitrary signing operation.
pub mod coordinator;
pub mod custody;
pub(crate) mod custody_transition;
pub mod github;
mod issuance;
mod issuance_io;
pub(crate) mod owner_policy;
pub(crate) mod policy;
pub mod review;
pub mod server;
pub mod source;
