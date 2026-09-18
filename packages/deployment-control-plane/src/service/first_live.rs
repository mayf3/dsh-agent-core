//! Closed first-live startup fence and one-use native enable handoff.
mod enable;
mod gate;
mod native;
mod records;
mod startup;
pub(crate) use startup::Startup;
pub(crate) fn preflight(intake: &super::Intake) -> crate::Result<bool> {
    startup::preflight(intake)
}
pub(crate) fn ordinary(intake: &super::Intake) -> crate::Result<()> {
    gate::ordinary(
        &intake.root,
        intake.config.first_target_adoption.as_deref(),
        super::server::now()?,
    )
}

pub(crate) fn fresh() -> crate::Result<()> {
    native::fresh()
}
pub(crate) fn enable() -> crate::Result<()> {
    native::run()
}
