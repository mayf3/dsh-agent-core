//! Fixed local evidence producers. No caller-facing arbitrary signing operation.
pub mod coordinator;
pub mod custody;
pub mod github;
mod issuance;
mod issuance_io;
pub(crate) mod policy;
pub mod review;
pub mod server;
pub mod source;
