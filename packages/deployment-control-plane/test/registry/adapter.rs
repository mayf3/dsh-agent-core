use crate::registry::test_fixture as registry_fixture;
use crate::transaction::test_fixture as transaction_fixture;
use crate::{
    common::*,
    fs::{file::write_new, FixtureRoots},
    model::*,
    queue::Queue,
    registry::{DeploymentState, Registry},
    service::{Caller, Configuration, Intake},
    transaction::Executor,
    trust::*,
};
use ed25519_dalek::SigningKey;
use sha2::{Digest, Sha256};
use std::{collections::BTreeMap, os::unix::fs::MetadataExt};
const PRODUCER: &str = "local-deployment-registry";
fn local_catalog() -> Catalog {
    let mut c = fixture_catalog();
    c.keys.insert(
        PRODUCER.into(),
        TrustedKey {
            public_key: hex::encode(
                SigningKey::from_bytes(&Sha256::digest(PRODUCER.as_bytes()).into())
                    .verifying_key()
                    .as_bytes(),
            ),
            role: Role::Producer,
            scopes: vec![PRODUCER.into()],
        },
    );
    c
}
fn fixture(path: &std::path::Path, catalog: &Catalog) -> Intake {
    let roots = FixtureRoots::open(path).unwrap();
    let keys = roots.root.mkdir("issuer-keys").unwrap();
    write_new(
        &keys,
        &format!("{PRODUCER}.json"),
        &canonical_bytes(&hex::encode(Sha256::digest(PRODUCER.as_bytes()))).unwrap(),
        keys.uid,
        keys.file.metadata().unwrap().gid(),
        0o600,
    )
    .unwrap();
    roots.root.mkdir("registry").unwrap();
    Intake {
        root: roots.root,
        config: Configuration {
            catalog: catalog.clone(),
            callers: vec![Caller {
                uid: unsafe { libc::geteuid() },
                gid: unsafe { libc::getegid() },
                profiles: vec!["fixture".into()],
                producers: vec![PRODUCER.into()],
            }],
            producers: vec![PRODUCER.into()],
            verifiers: BTreeMap::new(),
            socket_gid: unsafe { libc::getegid() },
            socket_ancestor: None,
        },
    }
}
fn enroll(intake: &Intake) -> Registry {
    let registry = Registry::open_local_root(&intake.root, &intake.config.catalog).unwrap();
    let mut e = registry_fixture::enrollment("goal").payload;
    e.producer_id = PRODUCER.into();
    registry.enroll(&signed("authority", e)).unwrap();
    registry
}
fn actor(intake: &Intake) -> Actor {
    intake
        .actor(unsafe { libc::geteuid() }, unsafe { libc::getegid() })
        .unwrap()
}
#[test]
fn pending_local_registry_is_polled_without_a_caller_mailbox() {
    let temp = private::temp();
    let c = local_catalog();
    let intake = fixture(temp.path(), &c);
    let registry = enroll(&intake);
    let queue = Queue::open(temp.path().join("queue.db")).unwrap();
    intake.poll(&queue).unwrap();
    let page = queue
        .census(queue.census_revision().unwrap(), None, 256)
        .unwrap();
    assert!(page.exhaustive);
    assert!(page.records.is_empty());
    assert_eq!(queue.daemon_producer_revision(PRODUCER).unwrap(), 1);
    intake.poll(&queue).unwrap();
    assert_eq!(
        registry.get("goal").unwrap().state,
        DeploymentState::Pending
    );
}
#[test]
fn local_poll_and_delivery_close_after_real_executor_finalization_and_retry() {
    for replay_gap in [false, true] {
        let (temp, roots, original_queue, _c, original_id) = transaction_fixture::prepared();
        let c = local_catalog();
        let intake = fixture(temp.path(), &c);
        let registry = enroll(&intake);
        let queue = Queue::open(temp.path().join("local-queue.db")).unwrap();
        let mut p = original_queue.daemon_evidence(&original_id).unwrap();
        p.goals[0].payload.producer_id = PRODUCER.into();
        p.goals[0] = signed(PRODUCER, p.goals[0].payload.clone());
        let actor = actor(&intake);
        registry.activate(&actor, &p, 0, 1001).unwrap();
        intake.poll(&queue).unwrap();
        let id = queue.submit(&c, &actor, &p, 1001).unwrap().unit_id;
        let guard = roots.lock().unwrap();
        let mut executor = Executor::fixture(&roots).unwrap();
        let applied = executor
            .apply(
                &guard,
                &queue,
                &c,
                &id,
                &signed("authority", policy()),
                1001,
                &actor.id,
            )
            .unwrap();
        queue
            .record_goal(
                &c,
                &signed(
                    "verifier",
                    GoalReceipt {
                        unit_id: id.clone(),
                        goal_id: "goal".into(),
                        acceptance_revision: "accept-1".into(),
                        target_generation: 1,
                        attempt: 1,
                        service_generation: applied.receipt.new_service_generation.clone(),
                        attachment_digest: applied.receipt.attachment_digests[0].clone(),
                        outcome: GoalOutcome::Pass,
                        evidence_digest: "d".repeat(64),
                        revision: 1,
                    },
                ),
            )
            .unwrap();
        intake.deliver(&queue).unwrap();
        assert_eq!(registry.get("goal").unwrap().state, DeploymentState::Ready);
        executor.finalize(&guard, &queue, &id).unwrap();
        if replay_gap {
            let entry = queue.outbox(&actor).unwrap().remove(0);
            let receipt: Signed<GoalReceipt> =
                serde_json::from_str(&queue.receipt(&actor, &entry.receipt_digest).unwrap())
                    .unwrap();
            registry
                .close_from_queue(&queue, &actor, &entry, &receipt)
                .unwrap();
            // Emulate losing the process after registry commit, before Queue ACK.
            assert_eq!(queue.outbox(&actor).unwrap().len(), 1);
        }
        intake.deliver(&queue).unwrap();
        assert!(queue.outbox(&actor).unwrap().is_empty());
        assert_eq!(registry.get("goal").unwrap().state, DeploymentState::Closed);
        assert!(!registry.get("goal").unwrap().business_goal_complete);
        drop(registry);
        intake.deliver(&queue).unwrap();
        intake.poll(&queue).unwrap();
        assert_eq!(queue.status(&actor, &id).unwrap().mutating_attempts, 1);
        assert_eq!(queue.daemon_producer_revision(PRODUCER).unwrap(), 3);
    }
}

#[test]
fn mapped_child_needs_real_current_pass_finalize_and_producer_closure() {
    use crate::registry::{DeploymentChild, PriorDependency};
    let (temp, roots, original_queue, _c, original_id) = transaction_fixture::prepared();
    let c = local_catalog();
    let intake = fixture(temp.path(), &c);
    let registry = enroll(&intake);
    let child = registry.get("goal").unwrap().enrollment;
    let mut broker = registry_fixture::enrollment("broker-child").payload;
    broker.producer_id = PRODUCER.into();
    broker.prior_dependencies = vec![PriorDependency {
        goal_id: child.payload.business_goal_id.clone(),
        provenance: registry_fixture::reference("original-prerequisite"),
        deployment_child: Some(DeploymentChild {
            goal_id: "goal".into(),
            enrollment_digest: digest(&child).unwrap(),
        }),
    }];
    registry.enroll(&signed("authority", broker)).unwrap();
    let frozen_first_ledger =
        std::fs::read(temp.path().join("registry/state-00000000000000000001.json")).unwrap();
    let prerequisites = registry.resolved_dependencies("broker-child").unwrap();
    assert_eq!(prerequisites, vec!["goal"]);
    let queue = Queue::open(temp.path().join("local-queue.db")).unwrap();
    assert!(queue.issuer_dependencies(&prerequisites).is_err());
    let mut p = original_queue.daemon_evidence(&original_id).unwrap();
    p.goals[0].payload.producer_id = PRODUCER.into();
    p.goals[0] = signed(PRODUCER, p.goals[0].payload.clone());
    let actor = actor(&intake);
    registry.activate(&actor, &p, 0, 1001).unwrap();
    intake.poll(&queue).unwrap();
    let id = queue.submit(&c, &actor, &p, 1001).unwrap().unit_id;
    let guard = roots.lock().unwrap();
    let mut executor = Executor::fixture(&roots).unwrap();
    let applied = executor
        .apply(
            &guard,
            &queue,
            &c,
            &id,
            &signed("authority", policy()),
            1001,
            &actor.id,
        )
        .unwrap();
    assert!(queue.issuer_dependencies(&prerequisites).is_err());
    for (i, outcome) in [
        GoalOutcome::Pending,
        GoalOutcome::Fail,
        GoalOutcome::WaitingExternalAcceptance,
        GoalOutcome::Pass,
    ]
    .into_iter()
    .enumerate()
    {
        queue
            .record_goal(
                &c,
                &signed(
                    "verifier",
                    GoalReceipt {
                        unit_id: id.clone(),
                        goal_id: "goal".into(),
                        acceptance_revision: "accept-1".into(),
                        target_generation: 1,
                        attempt: 1,
                        service_generation: applied.receipt.new_service_generation.clone(),
                        attachment_digest: applied.receipt.attachment_digests[0].clone(),
                        outcome,
                        evidence_digest: "d".repeat(64),
                        revision: i as u64 + 1,
                    },
                ),
            )
            .unwrap();
        // Even PASS cannot stand in for the pending executor finalize.
        assert!(queue.issuer_dependencies(&prerequisites).is_err());
    }
    executor.finalize(&guard, &queue, &id).unwrap();
    intake.deliver(&queue).unwrap();
    assert_eq!(registry.get("goal").unwrap().state, DeploymentState::Closed);
    let dependencies = queue.issuer_dependencies(&prerequisites).unwrap();
    assert_eq!(dependencies[0].unit_id, id);
    assert_eq!(dependencies[0].required_goals, vec!["goal"]);
    assert_eq!(
        dependencies[0].semantics,
        DependencySemantics::LiveInstallation
    );
    assert!(queue
        .issuer_dependencies(&[child.payload.business_goal_id])
        .is_err());
    let mut broker_proposal = proposal("broker", "f", 2, "broker-child");
    broker_proposal.dependencies = dependencies;
    broker_proposal.goals[0].payload.dependencies = broker_proposal.dependencies.clone();
    broker_proposal.goals[0].payload.producer_id = PRODUCER.into();
    broker_proposal.goals[0] = signed(PRODUCER, broker_proposal.goals[0].payload.clone());
    registry
        .activate(&actor, &broker_proposal, 0, 1001)
        .unwrap();
    assert!(!registry.get("broker-child").unwrap().business_goal_complete);
    assert_eq!(
        std::fs::read(temp.path().join("registry/state-00000000000000000001.json")).unwrap(),
        frozen_first_ledger
    );
}
