//! Non-root unit-test-only fault injection. This module is absent from production builds.
use crate::{Error, Result};
pub(crate) fn point(name: &str) {
    if std::env::var("DCP_TEST_POINT").ok().as_deref() == Some(name) {
        assert_ne!(unsafe { libc::geteuid() }, 0);
        std::process::exit(75);
    }
}
pub(crate) fn before_sync(file: &std::fs::File, name: &str) -> Result<()> {
    let edge = std::env::var("DCP_TEST_FAULT_RECORD").ok();
    if edge.as_deref() != Some(name) {
        return Ok(());
    }
    assert_ne!(unsafe { libc::geteuid() }, 0);
    match std::env::var("DCP_TEST_RECORD_FAULT").ok().as_deref() {
        // Emulate a failed fsync return at its exact call boundary; not hardware failure.
        Some("fsync") => Err(std::io::Error::from_raw_os_error(libc::EIO).into()),
        Some("partial") => {
            file.set_len(file.metadata()?.len() / 2)?;
            file.sync_all()?;
            Err(Error::new("INJECTED_PARTIAL_RECORD"))
        }
        _ => Ok(()),
    }
}
