use super::*;
use crate::common::{actor, fixture_catalog, proposal};

#[test]
fn desired_issuance_reuses_exact_intent_and_cannot_invent_dependency_pass() {
    let catalog = fixture_catalog();
    let profile = &catalog.profiles["fixture"];
    let queue = Queue::open(":memory:").unwrap();
    let artifact = "a".repeat(64);
    let first = queue.issuer_desired(profile, &artifact).unwrap();
    assert_eq!((first.revision, first.expected_target_generation), (1, 0));
    let p = proposal("first", "a", 1, "goal-one");
    queue.register_producer(&catalog, "producer").unwrap();
    queue.register_ready(&catalog, &p.goals[0], 0).unwrap();
    queue.submit(&catalog, &actor(), &p, 1000).unwrap();
    assert_eq!(queue.issuer_desired(profile, &artifact).unwrap(), first);
    let next = queue.issuer_desired(profile, &"b".repeat(64)).unwrap();
    assert_eq!((next.revision, next.expected_target_generation), (2, 0));
    assert_eq!(
        queue
            .issuer_dependencies(&["goal-one".into()])
            .unwrap_err()
            .code(),
        "PRIOR_DEPENDENCY_PENDING"
    );
    assert_eq!(
        queue
            .issuer_dependencies(&["made-up-goal".into()])
            .unwrap_err()
            .code(),
        "PRIOR_DEPENDENCY_PENDING"
    );
}
