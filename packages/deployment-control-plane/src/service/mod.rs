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

pub(crate) mod adoption;
pub use adoption::run as run_adoption;

pub(crate) use mailbox::initialize as initialize_mailbox;
pub(crate) use server::queue as initialize_queue;

pub(crate) use intake::Activation;
pub(crate) use train::verify_goals;

pub(crate) mod first_live;
