//! Fail-closed negative for the Intake caller allowlist (service::intake).
//! Wired as an internal test module from src/service/mod.rs because
//! `Intake` is `pub(crate)`; no daemon is spawned.

use super::intake::{Caller, Configuration, Intake};
use crate::{common, fs::FixtureRoots};
use std::{fs, os::unix::fs::PermissionsExt};

fn intake() -> (tempfile::TempDir, Intake) {
    let d = common::private::temp();
    fs::set_permissions(d.path(), fs::Permissions::from_mode(0o700)).unwrap();
    let roots = FixtureRoots::open(&fs::canonicalize(d.path()).unwrap()).unwrap();
    let intake = Intake {
        root: roots.root,
        config: Configuration {
            first_target_adoption: None,
            catalog: common::fixture_catalog(),
            callers: vec![Caller {
                uid: 502,
                gid: 20,
                profiles: vec!["fixture".into()],
                producers: vec!["producer".into()],
            }],
            producers: vec!["producer".into()],
            verifiers: Default::default(),
            socket_gid: unsafe { libc::getegid() },
            socket_ancestor: None,
        },
    };
    (d, intake)
}

#[test]
fn intake_actor_denies_unconfigured_peer_and_admits_the_configured_caller() {
    let (_d, intake) = intake();
    for (uid, gid) in [(503, 20), (502, 21), (0, 0)] {
        assert_eq!(
            intake.actor(uid, gid).unwrap_err().code(),
            "CALLER_DENIED",
            "unconfigured peer uid={uid} gid={gid} must be refused"
        );
    }
    let actor = intake.actor(502, 20).unwrap();
    assert_eq!(actor.id, "uid-502");
    assert_eq!(actor.allowed_profiles, vec!["fixture".to_string()]);
    assert_eq!(actor.allowed_producers, vec!["producer".to_string()]);
}
