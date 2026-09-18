use crate::registry::test_fixture as fixture;
use crate::{common::*, Error, Result};
use std::cell::Cell;
thread_local! { static FAIL_READ_FLUSH: Cell<bool> = const { Cell::new(false) }; }
pub(super) fn before_history_sync() -> Result<()> {
    if FAIL_READ_FLUSH.with(|v| v.replace(false)) {
        return Err(Error::new("INJECTED_REGISTRY_FSYNC"));
    }
    Ok(())
}
#[test]
fn idempotent_ack_waits_for_committed_record_and_parent_flush() {
    let temp = private::temp();
    let c = fixture_catalog();
    let r = fixture::open(temp.path(), &c);
    let e = fixture::enrollment("goal");
    let first = r.enroll(&e).unwrap();
    // A rename may be visible even when its parent flush previously returned EIO.
    // Reading an existing immutable commit must reflush before acknowledging it.
    FAIL_READ_FLUSH.with(|v| v.set(true));
    assert_eq!(r.enroll(&e).unwrap_err().code(), "INJECTED_REGISTRY_FSYNC");
    assert_eq!(r.enroll(&e).unwrap(), first);
}
