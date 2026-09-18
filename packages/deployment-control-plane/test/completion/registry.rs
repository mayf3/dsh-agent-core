use super::*;
use crate::registry::test_fixture as fixture;
#[test]
fn public_history_requires_no_keys_and_retains_existing_lock() {
    let t = crate::common::private::temp();
    let c = crate::common::fixture_catalog();
    let roots = FixtureRoots::open(t.path()).unwrap();
    let r = fixture::open(t.path(), &c);
    r.enroll(&fixture::enrollment("goal")).unwrap();
    let d = roots.root.child("registry").unwrap();
    let before = d
        .names()
        .unwrap()
        .into_iter()
        .map(|n| {
            (
                n.clone(),
                std::fs::read(t.path().join("registry").join(n)).unwrap(),
            )
        })
        .collect::<Vec<_>>();
    let o = read(&d, &c, "producer", "goal", None).unwrap();
    assert_eq!(o.row.state, DeploymentState::Pending);
    assert!(r.get("goal").is_err());
    drop(o);
    r.get("goal").unwrap();
    for (n, b) in before {
        assert_eq!(b, std::fs::read(t.path().join("registry").join(n)).unwrap());
    }
    assert!(!t.path().join("issuer-keys").exists());
}
