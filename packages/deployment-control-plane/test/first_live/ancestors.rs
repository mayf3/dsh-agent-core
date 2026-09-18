use super::native_tree::*;
#[test]
fn ancestor_plan_is_exact_finite_root_owned_set_with_observed_platform_flags() {
    let entries: std::collections::BTreeMap<_, _> = ANCESTORS
        .iter()
        .map(|(p, flags)| {
            (
                p.to_string(),
                Ancestor {
                    device: 1,
                    inode: 2,
                    uid: 0,
                    gid: 0,
                    mode: 0o755,
                    flags: *flags,
                },
            )
        })
        .collect();
    validate_ancestors(&entries).unwrap();
    let mut missing = entries.clone();
    missing.remove("/usr/local");
    assert!(validate_ancestors(&missing).is_err());
    let mut writable = entries.clone();
    writable.get_mut("/usr/local").unwrap().mode = 0o777;
    assert!(validate_ancestors(&writable).is_err());
    let mut unknown = entries;
    unknown.get_mut("/usr").unwrap().flags |= 1;
    assert!(validate_ancestors(&unknown).is_err());
}
