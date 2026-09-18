use super::*;
use crate::common as signing;
use deployment_control_plane::{
    bootstrap::*,
    model::*,
    service::{Caller, Configuration, VerifierBinding},
    transaction::{EnrolledFile, NativeEnrollment, NativeKind, ServiceEnrollment},
    trust::digest,
};
use std::collections::BTreeMap;
fn inputs(package: &Package) -> (ResolvedPreparation, Catalog) {
    let mut trust = signing::catalog();
    for key in trust.keys.values_mut() {
        key.scopes = vec![
            "bootstrap".into(),
            "preparation".into(),
            "dsh-app".into(),
            "producer".into(),
        ];
    }
    let mut profile = package.profile.clone();
    profile.host = "a".repeat(64);
    profile.toolchain = "fixture-reviewed-toolchain".into();
    profile.goal_verifiers =
        BTreeMap::from([("external-goal-acceptance-v1".into(), "verifier".into())]);
    let mut catalog = trust.clone();
    catalog.profiles.insert("dsh-app".into(), profile.clone());
    let config = Configuration {
        first_target_adoption: None,
        catalog,
        callers: vec![Caller {
            uid: 502,
            gid: 20,
            profiles: vec!["dsh-app".into()],
            producers: vec!["producer".into()],
        }],
        producers: vec!["producer".into()],
        verifiers: BTreeMap::from([(
            "external-goal-acceptance-v1".into(),
            VerifierBinding::ExternalObservation { deadline_ms: 500 },
        )]),
        socket_gid: 602,
        socket_ancestor: Some(SocketAncestor {
            host: profile.host.clone(),
            device: 1,
            inode: 2,
            uid: 0,
            gid: 1,
            mode: 0o775,
            flags: 0,
            acl_none: true,
            memberships: BTreeMap::from([(502, vec![20]), (505, vec![601])]),
            denial_receipt: "b".repeat(64),
        }),
    };
    let loader_files = package
        .payloads
        .iter()
        .filter(|p| {
            p.destination
                .starts_with("/usr/local/libexec/agent-core/node-runtime/")
        })
        .map(|p| LoaderFile {
            path: p.destination.clone(),
            sha256: p.sha256.clone(),
        })
        .collect::<Vec<_>>();
    let enrollment = NativeEnrollment {
        runtime_startup: Default::default(),
        host: profile.host.clone(),
        caller_uids: vec![502],
        lifecycle_denial_digest: "c".repeat(64),
        required_facets: vec![
            "app-slots".into(),
            "node-closure".into(),
            "service-plists".into(),
        ],
        profile_revision: profile.revision.clone(),
        profile_id: "dsh-app".into(),
        profile_digest: profile_digest(&profile).unwrap(),
        initial_files: vec![EnrolledFile {
            path: "main.js".into(),
            sha256: Some("d".repeat(64)),
            mutable: true,
            mode: 0o600,
            gid: 601,
        }],
        runtime_root: "/Users/fixture/runtime".into(),
        node_sha256: loader_files
            .iter()
            .find(|f| f.path.ends_with("/bin/node"))
            .unwrap()
            .sha256
            .clone(),
        loader_files,
        launchctl_sha256: package.platform_tools["/bin/launchctl"].clone(),
        plutil_sha256: package.platform_tools["/usr/bin/plutil"].clone(),
        services: [
            NativeKind::Runtime,
            NativeKind::WatchdogW1,
            NativeKind::WatchdogW2,
        ]
        .into_iter()
        .map(|kind| ServiceEnrollment {
            kind,
            uid: if kind == NativeKind::WatchdogW2 {
                0
            } else {
                505
            },
            gid: if kind == NativeKind::WatchdogW2 {
                0
            } else {
                601
            },
            plist_sha256: "e".repeat(64),
        })
        .collect(),
    };
    let bindings = trust
        .keys
        .iter()
        .map(|(id, key)| IssuerRequirement {
            proposed_key_id: id.clone(),
            role: key.role,
            scope: key.scopes.clone(),
            public_key: Some(key.public_key.clone()),
            service_identity: Some(format!("test-only-{id}")),
            custody_receipt: Some("f".repeat(64)),
            source_binding: "synthetic fixture receipt; no production custody".into(),
        })
        .collect();
    (
        ResolvedPreparation {
            configuration: config,
            enrollment,
            issuer_bindings: bindings,
            release_manifest: deployment_control_plane::fs::ArtifactManifest {
                version: 1,
                entries: vec![deployment_control_plane::fs::ArtifactEntry {
                    path: "main.js".into(),
                    blob: "payload".into(),
                    sha256: "1".repeat(64),
                    size: 8,
                    executable: false,
                }],
            },
            release_source_sha: "a".repeat(40),
            release_tree_sha: "b".repeat(40),
            semantic_authors: vec!["fixture-author".into()],
            operation_plan_digest: "2".repeat(64),
            rollback_plan_digest: "3".repeat(64),
            proofs: vec![],
        },
        trust,
    )
}
fn attest(input: &mut ResolvedPreparation, package: &str, source: &str) {
    input.enrollment.profile_digest =
        profile_digest(&input.configuration.catalog.profiles["dsh-app"]).unwrap();
    input.proofs.clear();
    for requirement in [
        Requirement::HostEnrollment,
        Requirement::IssuerCustody,
        Requirement::SourceAcceptance,
        Requirement::SourceBuild,
        Requirement::IndependentReview,
        Requirement::ReleaseFace,
        Requirement::LegacyLifecycle,
        Requirement::NativeClosure,
        Requirement::OperationRollback,
    ] {
        let statement = PreparationStatement {
            requirement,
            package_digest: package.into(),
            source_digest: source.into(),
            configuration_digest: digest(&input.configuration).unwrap(),
            enrollment_digest: digest(&input.enrollment).unwrap(),
            subject_digest: preparation_subject(input, requirement).unwrap(),
            issued_at: 1000,
            expires_at: 1200,
        };
        input.proofs.push(match requirement {
            Requirement::SourceBuild => {
                PreparationProof::Build(signing::signed("builder", BuildPreparation { statement }))
            }
            Requirement::IndependentReview | Requirement::NativeClosure => {
                PreparationProof::Review(signing::signed(
                    "reviewer",
                    ReviewPreparation { statement },
                ))
            }
            Requirement::OperationRollback => PreparationProof::Recovery(signing::signed(
                "recovery",
                RecoveryPreparation { statement },
            )),
            _ => PreparationProof::Authority(signing::signed(
                "authority",
                AuthorityPreparation { statement },
            )),
        });
    }
}
#[test]
fn resolved_fixture_is_ready_to_authorize_but_cannot_activate() {
    let (tmp, hash, source) = bundle();
    let package: Package =
        serde_json::from_slice(&std::fs::read(tmp.path().join("manifest.json")).unwrap()).unwrap();
    let (mut input, trust) = inputs(&package);
    attest(&mut input, &hash, &source);
    let result = verify_resolved(
        tmp.path(),
        &hash,
        &source,
        &input,
        &trust,
        &digest(&trust).unwrap(),
        &"a".repeat(64),
        1100,
    )
    .unwrap();
    assert!(result.bootstrap_ready);
    assert!(!result.activation_allowed);
    assert_eq!(result.preparation_digest, Some(digest(&input).unwrap()));
    let mut active = input.configuration.clone();
    active.catalog.profiles.get_mut("dsh-app").unwrap().enabled = true;
    validate_native_binding(&active, &input.enrollment, &"a".repeat(64), true).unwrap();
    assert!(validate_native_binding(&active, &input.enrollment, &"a".repeat(64), false).is_err());
    assert!(!input.configuration.catalog.profiles["dsh-app"].enabled);
    assert!(!tmp.path().join("daemon-activation.json").exists());
    assert!(
        !verify_bundle(tmp.path(), &hash, &source)
            .unwrap()
            .bootstrap_ready
    );
    for index in 0..9 {
        let mut missing = input.clone();
        missing.proofs.remove(index);
        assert!(validate_resolved(
            &missing,
            &trust,
            &digest(&trust).unwrap(),
            &hash,
            &source,
            &"a".repeat(64),
            1100
        )
        .is_err());
        let mut wrong = input.clone();
        match &mut wrong.proofs[index] {
            PreparationProof::Authority(p) => p.payload.statement.subject_digest = "0".repeat(64),
            PreparationProof::Build(p) => p.payload.statement.subject_digest = "0".repeat(64),
            PreparationProof::Review(p) => p.payload.statement.subject_digest = "0".repeat(64),
            PreparationProof::Recovery(p) => p.payload.statement.subject_digest = "0".repeat(64),
        }
        assert!(validate_resolved(
            &wrong,
            &trust,
            &digest(&trust).unwrap(),
            &hash,
            &source,
            &"a".repeat(64),
            1100
        )
        .is_err());
    }
    assert!(validate_resolved(
        &input,
        &trust,
        &"0".repeat(64),
        &hash,
        &source,
        &"a".repeat(64),
        1100
    )
    .is_err());
    assert!(validate_resolved(
        &input,
        &trust,
        &digest(&trust).unwrap(),
        &hash,
        &source,
        &"a".repeat(64),
        1300
    )
    .is_err());
}
#[test]
fn signed_foreign_driver_and_socket_counterexamples_refuse() {
    let (tmp, hash, source) = bundle();
    let package: Package =
        serde_json::from_slice(&std::fs::read(tmp.path().join("manifest.json")).unwrap()).unwrap();
    let (input, trust) = inputs(&package);
    for case in 0..16 {
        let mut bad = input.clone();
        let p = bad
            .configuration
            .catalog
            .profiles
            .get_mut("dsh-app")
            .unwrap();
        match case {
            0 => p.host = "9".repeat(64),
            1 => p.repo = "foreign/repo".into(),
            2 => p.target_runtime = "foreign".into(),
            3 => p.install_root_id = "foreign".into(),
            4 => p.privileged_apply_profile = "foreign".into(),
            5 => p.restart_profile = "foreign".into(),
            6 => p.rollback_profile = "foreign".into(),
            7 => {
                bad.enrollment.services[0].uid = 502;
                bad.enrollment.services[1].uid = 502;
            }
            8 => bad.configuration.socket_ancestor = None,
            9 => bad
                .configuration
                .socket_ancestor
                .as_mut()
                .unwrap()
                .memberships
                .get_mut(&502)
                .unwrap()
                .push(1),
            10 => bad.configuration.socket_ancestor.as_mut().unwrap().acl_none = false,
            11 => bad.configuration.socket_ancestor.as_mut().unwrap().gid = 20,
            12 => bad
                .enrollment
                .required_facets
                .push("incident-state-write".into()),
            13 => {
                let copy = p.clone();
                bad.configuration
                    .catalog
                    .profiles
                    .insert("overlap".into(), copy);
            }
            14 => bad.release_manifest.entries[0].path = "undeclared.js".into(),
            _ => bad.issuer_bindings[0].custody_receipt = None,
        }
        attest(&mut bad, &hash, &source);
        assert!(
            validate_resolved(
                &bad,
                &trust,
                &digest(&trust).unwrap(),
                &hash,
                &source,
                &"a".repeat(64),
                1100
            )
            .is_err(),
            "case {case}"
        );
    }
}
