use super::*;
#[test]
fn host_receipt_cannot_skip_ingress_and_publication_boundaries() {
    let mut stage = Stage::Prepared;
    assert!(stage.enter(Stage::Finishing).is_err());
    assert_eq!(stage, Stage::Prepared);
}
#[test]
fn unknown_inflight_step_cannot_be_reentered_or_promoted_to_finish() {
    for mut stage in [
        Stage::Switching,
        Stage::BeforeChecking,
        Stage::AfterChecking,
    ] {
        let original = stage;
        assert!(stage.enter(original).is_err());
        assert!(stage.enter(Stage::Finishing).is_err());
    }
}
#[test]
fn exact_once_phase_sequence_reaches_finish_only_after_both_publication_checks() {
    let mut stage = Stage::Prepared;
    for next in [
        Stage::Switching,
        Stage::Switched,
        Stage::BeforeChecking,
        Stage::Before,
        Stage::AfterChecking,
        Stage::After,
        Stage::Finishing,
        Stage::Finished,
    ] {
        stage.enter(next).unwrap();
    }
    assert!(stage.enter(Stage::Finishing).is_err());
}

#[test]
fn finishing_and_failed_checks_never_qualify_cached_recovery() {
    assert!(!Stage::Finishing.recoverable());
    assert!(!Stage::Failed.recoverable());
    assert!(Stage::After.recoverable());
}
