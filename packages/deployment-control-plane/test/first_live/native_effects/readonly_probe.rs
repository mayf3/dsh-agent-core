use super::*;

fn input() -> crate::transaction::NativeMaintenanceInput {
    use crate::transaction::{NativeKind, RuntimeStartup, ServiceEnrollment};
    crate::transaction::NativeMaintenanceInput {
        runtime_root: "/Users/fixture/runtime".into(),
        runtime_startup: RuntimeStartup::Legacy,
        node_sha256: "a".repeat(64),
        loader_files: vec![crate::bootstrap::LoaderFile {
            path: crate::transaction::FIRST_LIVE_NODE.into(),
            sha256: "a".repeat(64),
        }],
        launchctl_sha256: "b".repeat(64),
        plutil_sha256: "c".repeat(64),
        services: vec![
            ServiceEnrollment {
                kind: NativeKind::Runtime,
                uid: 502,
                gid: 20,
                plist_sha256: "d".repeat(64),
            },
            ServiceEnrollment {
                kind: NativeKind::WatchdogW1,
                uid: 502,
                gid: 20,
                plist_sha256: "e".repeat(64),
            },
            ServiceEnrollment {
                kind: NativeKind::WatchdogW2,
                uid: 0,
                gid: 0,
                plist_sha256: "f".repeat(64),
            },
        ],
    }
}

#[test]
fn readonly_service_parser_uses_only_bounded_in_memory_results() {
    let sentinel = tempfile::tempdir().unwrap();
    std::fs::write(sentinel.path().join("unchanged"), b"fixed").unwrap();
    let mut calls = Vec::new();
    let services = readonly_components_from(&input(), |args| {
        calls.push(args.clone());
        if args == ["print-disabled", "system"] {
            return Ok((0, "disabled services = {\n}\n".into()));
        }
        let label = args[1].strip_prefix("system/").unwrap();
        let kind = input()
            .services
            .into_iter()
            .find(|service| service.kind.label() == args[1])
            .unwrap()
            .kind;
        Ok((
            0,
            format!(
                "system/{label} = {{\n\tpath = {}\n\tprogram = {}\n\tstate = not running\n\truns = 1\n}}\n",
                kind.plist(),
                crate::transaction::FIRST_LIVE_NODE
            ),
        ))
    })
    .unwrap();
    assert_eq!(services.len(), 3);
    assert_eq!(calls.len(), 6);
    assert_eq!(
        std::fs::read(sentinel.path().join("unchanged")).unwrap(),
        b"fixed"
    );
    assert_eq!(sentinel.path().read_dir().unwrap().count(), 1);
}
