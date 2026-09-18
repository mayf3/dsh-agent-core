mod intake;
mod mailbox;
pub mod protocol;
mod server;
mod train;
pub(crate) use intake::Intake;
pub use intake::{Caller, Configuration, VerifierBinding};
pub use server::run;

#[cfg(test)]
#[path = "../../test/common/mailbox.rs"]
mod mailbox_tests;
