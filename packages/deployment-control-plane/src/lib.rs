pub mod error;
pub mod model;
pub mod queue;
pub mod trust;
pub use error::{Error, Result};
pub mod fs;
pub mod transaction;

#[cfg(test)]
extern crate self as deployment_control_plane;

pub mod bootstrap;
pub mod issuer;
pub mod service;

#[cfg(test)]
#[path = "../test/common/mod.rs"]
#[allow(dead_code)]
mod common;

pub mod registry;
mod verification;

mod first_live;

pub use first_live::run_first_live;
pub use first_live::run_runtime_closure_recovery;

pub fn runtime_closure_recovery_status() -> Result<()> {
    use std::io::Write;
    let mut bytes = trust::canonical_bytes(&first_live::runtime_closure_recovery_status()?)?;
    bytes.push(b'\n');
    std::io::stdout().write_all(&bytes)?;
    Ok(())
}

pub fn run_first_live_fence_capability_probe() -> Result<serde_json::Value> {
    first_live::run_fence_capability_probe()
}

pub fn run_first_live_and_enable() -> Result<()> {
    service::first_live::fresh()?;
    first_live::run_first_live()?;
    service::first_live::enable()
}

pub fn run_first_live_recovery_and_enable() -> Result<()> {
    service::first_live::fresh()?;
    first_live::run_first_live_recovery()?;
    service::first_live::enable()
}

pub fn run_first_live_completion() -> Result<()> {
    service::first_live::completion()
}
