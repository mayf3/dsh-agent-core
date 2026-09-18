//! First observed baseline → genuine successor apply → late acceptance/rollback.
use super::*;
use crate::{common::*, trust::digest, verification::native::VerifiedCanary};
use sha2::{Digest, Sha256};
use std::{fs, os::unix::fs::MetadataExt};
fn pass(
    q: &Queue,
    id: &str,
    service: &str,
    issuer: &str,
    outcome: GoalOutcome,
) -> Signed<GoalReceipt> {
    let s = q.daemon_status(id).unwrap();
    let g = q.daemon_coverage(id).unwrap().remove(0).payload;
    signed(
        issuer,
        GoalReceipt {
            unit_id: id.into(),
            goal_id: g.goal_id.clone(),
            acceptance_revision: g.coverage.acceptance_revision,
            target_generation: s.unit.expected_target_generation + 1,
            attempt: s.mutating_attempts,
            service_generation: service.into(),
            attachment_digest: q.daemon_goal_attachment(id, &g.goal_id).unwrap(),
            outcome,
            evidence_digest: "e".repeat(64),
            revision: 1,
        },
    )
}
#[test]
fn observed_first_installation_supports_real_successor_late_acceptance_and_restoration() {
    for rollback in [false, true] {
        let (tmp, roots, old, mut c, id) = test_fixture::prepared();
        fs::write(tmp.path().join("target/broker.js"), b"old broker").unwrap();
        let guard = roots.lock().unwrap();
        let mut e = Executor::fixture(&roots).unwrap();
        let policy = signed("authority", policy());
        // Establish an actually running non-root fixture before the observation lane.
        // Its old Queue is deliberately not imported into the first-target Queue.
        let applied = e
            .apply(&guard, &old, &c, &id, &policy, 1000, "caller")
            .unwrap();
        old.record_goal(
            &c,
            &pass(
                &old,
                &id,
                &applied.receipt.new_service_generation,
                "verifier",
                GoalOutcome::Pass,
            ),
        )
        .unwrap();
        e.finalize(&guard, &old, &id).unwrap();
        let p = old.daemon_evidence(&id).unwrap();
        drop(old);
        let q = Queue::open(tmp.path().join("first-queue.db")).unwrap();
        q.register_producer(&c, "producer").unwrap();
        register(&q, &c, &p);
        e.slots = Some(
            [
                ("main.js", b"new code".as_slice()),
                ("broker.js", b"old broker".as_slice()),
            ]
            .into_iter()
            .map(|(path, bytes)| EnrolledFile {
                path: path.into(),
                sha256: Some(crate::fs::file::sha(bytes)),
                mutable: true,
                mode: 0o644,
                gid: fs::metadata(tmp.path().join("target").join(path))
                    .unwrap()
                    .gid(),
            })
            .collect(),
        );
        let key = ed25519_dalek::SigningKey::from_bytes(&Sha256::digest(b"local-verifier").into());
        c.keys.insert(
            "local-verifier".into(),
            TrustedKey {
                public_key: hex::encode(key.verifying_key().as_bytes()),
                role: Role::Verifier,
                scopes: vec!["fixture".into()],
            },
        );
        c.profiles
            .get_mut("fixture")
            .unwrap()
            .goal_verifiers
            .insert("verify-1".into(), "local-verifier".into());
        let grant = signed(
            "authority",
            super::adopted_baseline_tests::grant_payload(&c, &p, &mut e),
        );
        let baseline = e
            .adopt_existing(&guard, &q, &c, &actor(), &p, &grant, 1000)
            .unwrap();
        assert_eq!(baseline.attempt, 0);
        let waiting = pass(
            &q,
            &baseline.unit_id,
            &baseline.service_generation,
            "local-verifier",
            GoalOutcome::WaitingExternalAcceptance,
        );
        q.record_goal(&c, &waiting).unwrap();
        assert!(q.issuer_dependencies(&["goal".into()]).is_err());
        let mut passed = pass(
            &q,
            &baseline.unit_id,
            &baseline.service_generation,
            "local-verifier",
            GoalOutcome::Pass,
        );
        passed.payload.revision = 2;
        passed = signed("local-verifier", passed.payload);
        q.record_goal(&c, &passed).unwrap();
        let current = q
            .daemon_current_installation(&baseline.target_runtime)
            .unwrap()
            .unwrap();
        let activation = signed(
            "authority",
            StandingActivationGrant {
                version: 1,
                adoption_grant_digest: digest(&grant).unwrap(),
                baseline_receipt_digest: digest(&baseline).unwrap(),
                canary_plan_digest: grant.payload.canary_plan_digest.clone(),
                owner_acceptance_digest: "f".repeat(64),
                issued_at: 999,
                expires_at: 1100,
            },
        );
        e.complete_adoption_activation(
            &guard,
            &q,
            &c,
            &grant,
            &activation,
            VerifiedCanary::fixture(current, digest(&grant).unwrap()),
            &passed,
            1000,
        )
        .unwrap();
        let dependency = q.issuer_dependencies(&["goal".into()]).unwrap();
        assert_eq!(dependency[0].receipt_digest, digest(&baseline).unwrap());
        let b = super::executed_predecessor_tests::successor(
            tmp.path(),
            &q,
            &c,
            &baseline.unit_id,
            &digest(&baseline).unwrap(),
        );
        let applied = e
            .apply(&guard, &q, &c, &b, &policy, 1000, "caller")
            .unwrap();
        if rollback {
            e.rollback_for_failure(&guard, &q, &b, "fixture-known-failure")
                .unwrap();
            let restored = e
                .verify_installed(&guard, &q, &c, &baseline.unit_id, &policy, 1000)
                .unwrap();
            assert_eq!(
                restored.origin,
                InstallationOrigin::ObservedExistingInstallation
            );
            assert_eq!(restored.attempt, 0);
            assert_ne!(restored.service_generation, baseline.service_generation);
            assert!(q.issuer_dependencies(&["goal".into()]).is_err());
            assert_eq!(
                fs::read(tmp.path().join("target/broker.js")).unwrap(),
                b"old broker"
            );
        } else {
            q.record_goal(
                &c,
                &pass(
                    &q,
                    &b,
                    &applied.receipt.new_service_generation,
                    "local-verifier",
                    GoalOutcome::WaitingExternalAcceptance,
                ),
            )
            .unwrap();
            e.finalize(&guard, &q, &b).unwrap();
            let current = e
                .verify_installed(&guard, &q, &c, &b, &policy, 1000)
                .unwrap();
            let mut accepted = pass(
                &q,
                &b,
                &current.service_generation,
                "local-verifier",
                GoalOutcome::Pass,
            );
            accepted.payload.revision = 2;
            accepted = signed("local-verifier", accepted.payload);
            q.record_goal(&c, &accepted).unwrap();
            assert_eq!(q.daemon_status(&b).unwrap().mutating_attempts, 1);
            assert_eq!(
                fs::read(tmp.path().join("target/broker.js")).unwrap(),
                b"new broker"
            );
        }
    }
}
