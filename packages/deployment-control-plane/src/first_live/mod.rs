//! One externally authorized first-live operation; no request-controlled executor.
pub(crate) mod gate;
#[cfg(test)]
#[path = "../../test/first_live/gate.rs"]
mod tests;

mod journal;
#[cfg(test)]
#[path = "../../test/first_live/journal.rs"]
mod journal_tests;

mod files;

mod initial_queue;
#[cfg(test)]
#[path = "../../test/first_live/queue.rs"]
mod queue_tests;

mod inventory;
#[cfg(test)]
#[path = "../../test/first_live/inventory.rs"]
mod inventory_tests;

mod packet;

mod materialize;

mod lifecycle;
#[cfg(test)]
#[path = "../../test/first_live/lifecycle.rs"]
mod lifecycle_tests;

#[cfg(test)]
#[path = "../../test/first_live/paths.rs"]
mod path_tests;

pub(crate) mod process;

mod compose;

mod canary;
#[cfg(test)]
#[path = "../../test/first_live/canary.rs"]
mod canary_tests;

mod inventory_path;

mod retirement;

mod native_tree;

mod legacy_locks;
pub(crate) fn run_fence_capability_probe() -> crate::Result<serde_json::Value> {
    legacy_locks::run_fence_capability_probe()
}
mod native_effects;
pub fn run_first_live() -> crate::Result<()> {
    crate::error::require(unsafe { libc::geteuid() } == 0, "FIRST_LIVE_REQUIRES_ROOT")?;
    native_effects::run()
}
#[cfg(test)]
#[path = "../../test/first_live/ancestors.rs"]
mod ancestor_tests;
#[cfg(test)]
#[path = "../../test/first_live/materialize.rs"]
mod materialize_tests;

mod template;

mod canary_timing;

mod sudo;
