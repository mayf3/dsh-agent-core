use super::journal::{self, Step};
use crate::{fs::FixtureRoots, Error};
#[test]
fn consumed_intent_never_replays_even_when_effect_failed() {
    let t = crate::common::private::temp();
    let roots = FixtureRoots::open(t.path()).unwrap();
    let area = roots.root.mkdir("operation").unwrap();
    let mut effects = 0;
    let result: crate::Result<()> = journal::execute(&area, Step::Lifecycle, "binding", || {
        effects += 1;
        Err(Error::new("UNKNOWN"))
    });
    assert!(result.is_err());
    assert!(journal::execute(&area, Step::Lifecycle, "binding", || {
        effects += 1;
        Ok(())
    })
    .is_err());
    assert_eq!(effects, 1);
    assert!(area
        .names()
        .unwrap()
        .contains(&"lifecycle-intent.json".into()));
}
#[test]
fn completed_step_is_not_replayed_or_overwritten() {
    let t = crate::common::private::temp();
    let roots = FixtureRoots::open(t.path()).unwrap();
    journal::execute(&roots.root, Step::Queue, "binding", || Ok(42)).unwrap();
    assert!(journal::execute(&roots.root, Step::Queue, "binding", || Ok(99)).is_err());
}
