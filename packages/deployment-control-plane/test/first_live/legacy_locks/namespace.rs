use super::*;
use crate::fs::FixtureRoots;
use std::os::unix::fs::PermissionsExt;
#[test]
fn exact_group_writable_first_parent_uses_bound_namespace_through_acquire_and_verify() {
    let t = crate::common::private::temp();
    let r = FixtureRoots::open(t.path()).unwrap();
    let guard = r.lock().unwrap();
    let parents: [Dir; 4] = std::array::from_fn(|i| r.root.mkdir(&format!("p{i}")).unwrap());
    std::fs::set_permissions(t.path().join("p0"), std::fs::Permissions::from_mode(0o775)).unwrap();
    let first = Identity::of(&parents[0].file).unwrap();
    let plan = crate::bootstrap::socket::SocketAncestorPlan {
        host: "a".repeat(64),
        device: first.device,
        inode: first.inode,
        uid: first.uid,
        gid: first.gid,
        mode: 0o775,
        flags: 0,
        acl_none: true,
        memberships: Default::default(),
    };
    // Equivalent descriptor fixture only; this nonroot tuple cannot pass production policy.
    assert!(plan.validate(&plan.host, &Default::default()).is_err());
    let ns = SocketNamespace {
        plan,
        gid: 602,
        identities: Default::default(),
        fixture: Some(t.path().join("p0")),
    };
    let expected = Expectations {
        ancestor_fence: AncestorFenceExpectation {
            identity: Identity::of(&parents[1].file).unwrap(),
            flags: 0,
            acl_none: true,
        },
        parents: std::array::from_fn(|i| Identity::of(&parents[i].file).unwrap()),
        permanent: PermanentExpectation::AbsentCreate,
    };
    let area = r.root.mkdir("journal").unwrap();
    let locks = LegacyLocks::acquire_with_namespace(
        "op",
        &"b".repeat(64),
        &area,
        parents,
        &expected,
        &guard,
        AcquisitionContext {
            namespace: Some(ns),
            ancestor_fence: None,
        },
    )
    .unwrap();
    locks.verify().unwrap();
    std::fs::set_permissions(t.path().join("p0"), std::fs::Permissions::from_mode(0o777)).unwrap();
    assert!(locks.verify().is_err());
}

#[test]
fn actual_os_tuple_requires_exact_excluded_memberships_and_no_wider_mode() {
    use std::collections::{BTreeMap, BTreeSet};
    let mut p = crate::bootstrap::socket::SocketAncestorPlan {
        host: "a".repeat(64),
        device: 16777230,
        inode: 59194365,
        uid: 0,
        gid: 1,
        mode: 0o775,
        flags: 0,
        acl_none: true,
        memberships: BTreeMap::from([(502, vec![20]), (505, vec![601])]),
    };
    let ids = BTreeSet::from([0, 502, 505]);
    p.validate(&p.host, &ids).unwrap();
    p.mode = 0o777;
    assert!(p.validate(&p.host, &ids).is_err());
    p.mode = 0o775;
    p.memberships.get_mut(&505).unwrap().push(1);
    assert!(p.validate(&p.host, &ids).is_err());
}

#[test]
fn group_write_on_other_parent_still_refuses_before_any_lock_intent() {
    let t = crate::common::private::temp();
    let r = FixtureRoots::open(t.path()).unwrap();
    let guard = r.lock().unwrap();
    let parents: [Dir; 4] = std::array::from_fn(|i| r.root.mkdir(&format!("p{i}")).unwrap());
    std::fs::set_permissions(t.path().join("p1"), std::fs::Permissions::from_mode(0o775)).unwrap();
    let expected = Expectations {
        ancestor_fence: AncestorFenceExpectation {
            identity: Identity::of(&parents[1].file).unwrap(),
            flags: 0,
            acl_none: true,
        },
        parents: std::array::from_fn(|i| Identity::of(&parents[i].file).unwrap()),
        permanent: PermanentExpectation::AbsentCreate,
    };
    let area = r.root.mkdir("journal").unwrap();
    assert!(
        LegacyLocks::acquire_at("op", &"b".repeat(64), &area, parents, &expected, &guard).is_err()
    );
    assert!(area.names().unwrap().is_empty());
}
